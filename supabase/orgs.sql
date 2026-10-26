-- Agency workspaces (orgs). Run once in the Supabase SQL editor (safe to re-run), after roles.sql, teams.sql and tracking.sql.
-- Every person belongs to one org. Staff only ever see their own org: the super user and admins see "Proof to Profit",
-- an agency's people see that agency. Nobody can list another org's people, invites, logins or behaviour data.
-- The super user can create an agency and see only its name and head count (list_orgs), never its content.

create table if not exists public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_platform boolean not null default false,
  created_by text,
  created_at timestamptz not null default now()
);
alter table public.orgs enable row level security; -- no policies: only the functions below touch it
create unique index if not exists orgs_one_platform on public.orgs (is_platform) where is_platform;
insert into public.orgs (name, is_platform, created_by) select 'Proof to Profit', true, 'ebizmatrix@gmail.com'
  where not exists (select 1 from public.orgs where is_platform);

create or replace function public._p2p_platform_org() returns uuid
language sql stable security definer set search_path = public as $$ select id from public.orgs where is_platform limit 1 $$;
revoke all on function public._p2p_platform_org() from public, anon, authenticated;

alter table public.allowed_emails add column if not exists org_id uuid references public.orgs(id);
update public.allowed_emails set org_id = public._p2p_platform_org() where org_id is null;
alter table public.invite_log add column if not exists org_id uuid;
alter table public.login_events add column if not exists org_id uuid;
alter table public.usage_events add column if not exists org_id uuid;
create index if not exists usage_events_org_idx on public.usage_events (org_id, at);

-- New roles list.
do $$ begin
  alter table public.allowed_emails drop constraint if exists allowed_emails_role_chk;
  alter table public.allowed_emails add constraint allowed_emails_role_chk
    check (role in ('super','admin','agency_admin','sales','owner','member'));
end $$;

-- Safety net: whoever inserts a person, they land in the inviter's org (or Proof to Profit).
create or replace function public.trg_set_org() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.org_id is null then
    select a.org_id into new.org_id from public.allowed_emails a where lower(a.email) = lower(coalesce(new.invited_by, '')) limit 1;
  end if;
  if new.org_id is null then new.org_id := public._p2p_platform_org(); end if;
  return new;
end $$;
drop trigger if exists a_allowed_email_org on public.allowed_emails;
create trigger a_allowed_email_org before insert on public.allowed_emails for each row execute function public.trg_set_org();

-- Logs and behaviour events are tagged with the person's org when written.
create or replace function public.trg_tag_org() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.org_id is null then
    select a.org_id into new.org_id from public.allowed_emails a where lower(a.email) = lower(coalesce(new.email, '')) limit 1;
  end if;
  if new.org_id is null then new.org_id := public._p2p_platform_org(); end if;
  return new;
end $$;
drop trigger if exists a_invite_log_org on public.invite_log;
create trigger a_invite_log_org before insert on public.invite_log for each row execute function public.trg_tag_org();
drop trigger if exists a_login_events_org on public.login_events;
create trigger a_login_events_org before insert on public.login_events for each row execute function public.trg_tag_org();
drop trigger if exists a_usage_events_org on public.usage_events;
create trigger a_usage_events_org before insert on public.usage_events for each row execute function public.trg_tag_org();

update public.invite_log l set org_id = coalesce((select a.org_id from public.allowed_emails a where lower(a.email) = lower(l.email) limit 1), public._p2p_platform_org()) where l.org_id is null;
update public.login_events l set org_id = coalesce((select a.org_id from public.allowed_emails a where lower(a.email) = lower(l.email) limit 1), public._p2p_platform_org()) where l.org_id is null;
update public.usage_events l set org_id = coalesce((select a.org_id from public.allowed_emails a where lower(a.email) = lower(l.email) limit 1), public._p2p_platform_org()) where l.org_id is null;

-- Welcome email: an agency admin gets the staff version of the welcome.
create or replace function public.trg_allowed_email() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text;
begin
  select coalesce(nullif(trim(p.display_name), ''), split_part(new.invited_by, '@', 1)) into who
  from auth.users u left join public.profiles p on p.user_id = u.id where lower(u.email) = lower(new.invited_by) limit 1;
  who := coalesce(who, nullif(split_part(coalesce(new.invited_by, ''), '@', 1), ''));
  perform public.queue_email(null, new.email, 'welcome',
    case when who is null then 'You are invited to Proof to Profit' else who || ' invited you to Proof to Profit' end,
    public.invite_email_html(new.email, case when new.role = 'agency_admin' then 'admin' else new.role end, who, new.note, new.title));
  return new;
end $$;

-- Who am I (now with the org).
create or replace function public.my_role() returns json
language plpgsql stable security definer set search_path = public as $$
declare me public.allowed_emails; oname text; plat boolean;
begin
  me := public._p2p_me();
  if me.email is null then return null; end if;
  select o.name, o.is_platform into oname, plat from public.orgs o where o.id = me.org_id;
  return json_build_object('email', me.email, 'role', me.role, 'owner_email', me.owner_email, 'org_name', oname, 'is_platform', coalesce(plat, false));
end $$;

-- Invite: the person joins the inviter's org.
create or replace function public.invite_user(p_email text, p_role text, p_note text default null) returns json
language plpgsql security definer set search_path = public as $$
declare me public.allowed_emails; e text := lower(trim(coalesce(p_email, '')));
begin
  me := public._p2p_me();
  if me.email is null then raise exception 'not invited' using errcode = '42501'; end if;
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email address' using errcode = '22023'; end if;
  if not (
    (me.role = 'super' and p_role in ('super','admin','sales','owner')) or
    (me.role = 'admin' and p_role in ('sales','owner')) or
    (me.role = 'agency_admin' and p_role in ('sales','owner')) or
    (me.role = 'sales' and p_role = 'owner')
  ) then raise exception 'Your role cannot invite that role' using errcode = '42501'; end if;
  if exists (select 1 from public.allowed_emails where lower(email) = e) then
    raise exception 'That email is already on the list' using errcode = '23505';
  end if;
  insert into public.allowed_emails (email, role, note, invited_by, org_id) values (e, p_role, left(p_note, 200), me.email, me.org_id);
  return json_build_object('ok', true);
end $$;

-- People in my org only. Super, admin and agency admin see the whole org; sales see their own invites.
create or replace function public.list_invites() returns json
language plpgsql stable security definer set search_path = public as $$
declare me public.allowed_emails; res json;
begin
  me := public._p2p_me();
  if me.email is null or me.role not in ('super','admin','agency_admin','sales') then raise exception 'not allowed' using errcode = '42501'; end if;
  select coalesce(json_agg(x order by x.added_at desc), '[]'::json) into res from (
    select a.email, a.role, a.note, a.invited_by, a.owner_email, a.title, a.added_at,
           (u.last_sign_in_at is not null) as joined
    from public.allowed_emails a
    left join auth.users u on lower(u.email) = lower(a.email)
    where a.org_id = me.org_id and (me.role in ('super','admin','agency_admin') or lower(a.invited_by) = lower(me.email))
  ) x;
  return res;
end $$;

create or replace function public.remove_user(p_email text) returns json
language plpgsql security definer set search_path = public as $$
declare me public.allowed_emails; t public.allowed_emails; e text := lower(trim(coalesce(p_email, '')));
begin
  me := public._p2p_me();
  if me.email is null or me.role not in ('super','admin','agency_admin','sales') then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into t from public.allowed_emails where lower(email) = e and org_id = me.org_id;
  if t.email is null then raise exception 'Not on the list' using errcode = 'P0002'; end if;
  if lower(t.email) = lower(me.email) then raise exception 'You cannot remove yourself' using errcode = '42501'; end if;
  if not (
    me.role = 'super' or
    (me.role in ('admin','agency_admin') and t.role in ('sales','owner','member')) or
    (me.role = 'sales' and t.role = 'owner' and lower(t.invited_by) = lower(me.email))
  ) then raise exception 'Your role cannot remove this person' using errcode = '42501'; end if;
  delete from public.team_members where owner_email = e or member_email = e;
  delete from public.allowed_emails a where a.role = 'member' and lower(a.owner_email) = e
    and not exists (select 1 from public.team_members m where m.member_email = lower(a.email));
  delete from public.allowed_emails where lower(email) = e;
  return json_build_object('ok', true);
end $$;

-- Only the super user changes roles, and only inside the Proof to Profit org.
create or replace function public.set_role(p_email text, p_role text) returns json
language plpgsql security definer set search_path = public as $$
declare me public.allowed_emails; t public.allowed_emails; e text := lower(trim(coalesce(p_email, '')));
begin
  me := public._p2p_me();
  if me.email is null or me.role <> 'super' then raise exception 'Only the super user can change roles' using errcode = '42501'; end if;
  if p_role not in ('super','admin','sales','owner') then raise exception 'Invalid role' using errcode = '22023'; end if;
  select * into t from public.allowed_emails where lower(email) = e and org_id = me.org_id;
  if t.email is null then raise exception 'Not on the list' using errcode = 'P0002'; end if;
  if t.role in ('member','agency_admin') then raise exception 'That role cannot be changed here' using errcode = '22023'; end if;
  if lower(t.email) = lower(me.email) then raise exception 'You cannot change your own role' using errcode = '42501'; end if;
  update public.allowed_emails set role = p_role where lower(email) = e;
  return json_build_object('ok', true);
end $$;

-- Owners adding team members: an email already used in another org cannot be pulled in.
create or replace function public.invite_team_member(p_email text, p_title text default null) returns json
language plpgsql security definer set search_path = public as $$
declare me public.allowed_emails; e text := lower(trim(coalesce(p_email, ''))); existing boolean;
begin
  me := public._p2p_me();
  if me.email is null or me.role <> 'owner' then raise exception 'Only business owners can add team members' using errcode = '42501'; end if;
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email address' using errcode = '22023'; end if;
  if e = lower(me.email) then raise exception 'That is your own email' using errcode = '22023'; end if;
  if exists (select 1 from public.allowed_emails where lower(email) = e and org_id <> me.org_id) then
    raise exception 'That email is already on the list' using errcode = '23505';
  end if;
  if exists (select 1 from public.team_members where owner_email = lower(me.email) and member_email = e) then
    raise exception 'Already on your team' using errcode = '23505';
  end if;
  if (select count(*) from public.team_members where owner_email = lower(me.email)) >= 5 then
    raise exception 'Your team is full (5 people)' using errcode = '54000';
  end if;
  existing := exists (select 1 from public.allowed_emails where lower(email) = e);
  if not existing then
    insert into public.allowed_emails (email, role, invited_by, owner_email, title, org_id)
    values (e, 'member', me.email, me.email, left(p_title, 60), me.org_id);
  end if;
  insert into public.team_members (owner_email, member_email, title) values (lower(me.email), e, left(p_title, 60));
  return json_build_object('ok', true, 'existing', existing);
end $$;

-- Super user only: create an agency with its first admin, and see agency names and head counts (nothing else).
create or replace function public.create_agency(p_name text, p_admin_email text) returns json
language plpgsql security definer set search_path = public as $$
declare me public.allowed_emails; e text := lower(trim(coalesce(p_admin_email, ''))); oid uuid;
begin
  me := public._p2p_me();
  if me.email is null or me.role <> 'super' then raise exception 'Only the super user can create agencies' using errcode = '42501'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Enter the agency name' using errcode = '22023'; end if;
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email address' using errcode = '22023'; end if;
  if exists (select 1 from public.allowed_emails where lower(email) = e) then
    raise exception 'That email is already on the list' using errcode = '23505';
  end if;
  insert into public.orgs (name, created_by) values (left(trim(p_name), 80), me.email) returning id into oid;
  insert into public.allowed_emails (email, role, invited_by, org_id, note) values (e, 'agency_admin', me.email, oid, 'Agency admin for ' || left(trim(p_name), 80));
  return json_build_object('ok', true, 'org_id', oid);
end $$;

create or replace function public.list_orgs() returns json
language plpgsql stable security definer set search_path = public as $$
declare me public.allowed_emails; res json;
begin
  me := public._p2p_me();
  if me.email is null or me.role <> 'super' then raise exception 'not allowed' using errcode = '42501'; end if;
  select coalesce(json_agg(x order by x.is_platform desc, x.created_at), '[]'::json) into res from (
    select o.id, o.name, o.is_platform, o.created_at,
           (select a.email from public.allowed_emails a where a.org_id = o.id and a.role = 'agency_admin' order by a.added_at limit 1) as admin_email,
           (select count(*) from public.allowed_emails a where a.org_id = o.id) as people
    from public.orgs o
  ) x;
  return res;
end $$;

create or replace function public.invite_tracker() returns json
language plpgsql stable security definer set search_path = public as $$
declare me public.allowed_emails; rows_ json; sm json;
begin
  me := public._p2p_me();
  if me.email is null or me.role not in ('super', 'admin', 'agency_admin', 'sales') then raise exception 'not allowed' using errcode = '42501'; end if;
  select coalesce(json_agg(r order by r.sent_at desc), '[]'::json) into rows_ from (
    select l.id, l.email, l.role, l.invited_by, l.note, l.sent_at, l.removed_at,
           (select o.status from public.email_outbox o where lower(o.to_email) = lower(l.email) and o.kind = 'welcome' and o.created_at >= l.sent_at - interval '5 minutes' order by o.id limit 1) as email_status,
           (select o.sent_at from public.email_outbox o where lower(o.to_email) = lower(l.email) and o.kind = 'welcome' and o.created_at >= l.sent_at - interval '5 minutes' order by o.id limit 1) as email_sent_at,
           u.created_at as first_login,
           greatest((select count(*) from public.login_events e where lower(e.email) = lower(l.email)), case when u.last_sign_in_at is not null then 1 else 0 end) as login_count,
           coalesce((select max(e.at) from public.login_events e where lower(e.email) = lower(l.email)), u.last_sign_in_at) as last_login
    from public.invite_log l
    left join auth.users u on lower(u.email) = lower(l.email)
    where l.invited_by is not null and l.org_id = me.org_id and (me.role in ('super', 'admin', 'agency_admin') or lower(l.invited_by) = lower(me.email))
    order by l.sent_at desc limit 500
  ) r;
  select json_build_object(
    'total', count(*),
    'accepted', count(*) filter (where (x ->> 'login_count')::int > 0),
    'pending', count(*) filter (where (x ->> 'login_count')::int = 0 and (x ->> 'removed_at') is null),
    'removed', count(*) filter (where (x ->> 'removed_at') is not null),
    'avg_hours_to_join', round(avg(extract(epoch from ((x ->> 'first_login')::timestamptz - (x ->> 'sent_at')::timestamptz)) / 3600.0) filter (where (x ->> 'first_login') is not null and (x ->> 'login_count')::int > 0)::numeric, 1)
  ) into sm from json_array_elements(rows_) x;
  return json_build_object('summary', sm, 'rows', rows_);
end $$;

create or replace function public.analytics_summary(p_days int default 30, p_email text default null) returns json
language plpgsql stable security definer set search_path = public as $$
declare me public.allowed_emails; d int := least(greatest(coalesce(p_days, 30), 1), 90); res json;
begin
  me := public._p2p_me();
  if me.email is null or me.role not in ('super', 'admin', 'agency_admin') then raise exception 'not allowed' using errcode = '42501'; end if;
  with ev as (
    select * from public.usage_events
    where org_id = me.org_id and at > now() - make_interval(days => d) and (p_email is null or p_email = '' or lower(email) = lower(p_email))
  )
  select json_build_object(
    'kpi', (select json_build_object(
        'sessions', count(distinct sid), 'users', count(distinct lower(email)),
        'clicks', count(*) filter (where kind = 'click'),
        'avg_session_sec', coalesce(round((sum(dur_ms) filter (where kind = 'view') / 1000.0 / nullif(count(distinct sid), 0))::numeric), 0)) from ev),
    'by_section', (select coalesce(json_agg(t order by t.seconds desc), '[]'::json) from (
        select section, round(sum(dur_ms) / 1000.0)::int as seconds, count(*) as views, count(distinct sid) as sessions
        from ev where kind = 'view' and section is not null group by section) t),
    'exits', (select coalesce(json_agg(t order by t.n desc), '[]'::json) from (
        select section, count(*) as n from ev where kind = 'exit' and section is not null group by section) t),
    'top_targets', (select coalesce(json_agg(t order by t.clicks desc), '[]'::json) from (
        select target, section, count(*) as clicks from ev where kind = 'click' and target is not null group by target, section order by count(*) desc limit 15) t),
    'cells', (select coalesce(json_agg(t), '[]'::json) from (
        select device, section, floor(x / 2)::int as cx, floor(y / 2)::int as cy, count(*) as n
        from ev where kind = 'click' and x is not null and y is not null group by device, section, floor(x / 2), floor(y / 2) order by count(*) desc limit 3000) t),
    'users', (select coalesce(json_agg(distinct lower(email)), '[]'::json) from (select email from public.usage_events where org_id = me.org_id and at > now() - make_interval(days => d) limit 5000) u)
  ) into res;
  return res;
end $$;

revoke all on function public.my_role(), public.invite_user(text, text, text), public.list_invites(), public.remove_user(text), public.set_role(text, text),
  public.invite_team_member(text, text), public.create_agency(text, text), public.list_orgs(), public.invite_tracker(), public.analytics_summary(int, text) from public, anon;
grant execute on function public.my_role(), public.invite_user(text, text, text), public.list_invites(), public.remove_user(text), public.set_role(text, text),
  public.invite_team_member(text, text), public.create_agency(text, text), public.list_orgs(), public.invite_tracker(), public.analytics_summary(int, text) to authenticated;
