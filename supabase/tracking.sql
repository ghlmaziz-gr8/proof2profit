-- Invitation tracking, login counts and behaviour analytics (click heat map, time per section, exit points).
-- Run once in the Supabase SQL editor (safe to re-run). Nothing here is readable directly: only the role-checked functions at the bottom.

-- ---------- invitation history ----------
create table if not exists public.invite_log (
  id bigint generated always as identity primary key,
  email text not null, role text, invited_by text, owner_email text, note text,
  sent_at timestamptz not null default now(), removed_at timestamptz
);
create index if not exists invite_log_email_idx on public.invite_log (lower(email));
alter table public.invite_log enable row level security;

create or replace function public.trg_invite_log() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.invite_log (email, role, invited_by, owner_email, note, sent_at)
    values (new.email, new.role, new.invited_by, new.owner_email, new.note, coalesce(new.added_at, now()));
    return new;
  else
    update public.invite_log set removed_at = now()
    where id = (select max(id) from public.invite_log where lower(email) = lower(old.email) and removed_at is null);
    return old;
  end if;
end $$;
drop trigger if exists allowed_email_log_ins on public.allowed_emails;
create trigger allowed_email_log_ins after insert on public.allowed_emails for each row execute function public.trg_invite_log();
drop trigger if exists allowed_email_log_del on public.allowed_emails;
create trigger allowed_email_log_del after delete on public.allowed_emails for each row execute function public.trg_invite_log();

insert into public.invite_log (email, role, invited_by, owner_email, note, sent_at)
select a.email, a.role, a.invited_by, a.owner_email, a.note, a.added_at from public.allowed_emails a
where not exists (select 1 from public.invite_log l where lower(l.email) = lower(a.email));

-- ---------- logins and behaviour events ----------
create table if not exists public.login_events (
  id bigint generated always as identity primary key,
  user_id uuid, email text not null, at timestamptz not null default now()
);
create index if not exists login_events_email_idx on public.login_events (lower(email));
alter table public.login_events enable row level security;

create table if not exists public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid, email text, sid text, at timestamptz not null default now(),
  kind text not null, section text, target text, x real, y real, device text, dur_ms int
);
create index if not exists usage_events_at_idx on public.usage_events (at);
create index if not exists usage_events_user_idx on public.usage_events (user_id, at);
alter table public.usage_events enable row level security;

-- Called once when someone opens the portal; counts a new sign-in when the last one was over 30 minutes ago.
create or replace function public.record_login() returns json
language plpgsql security definer set search_path = public as $$
declare me public.allowed_emails; n int;
begin
  me := public._p2p_me();
  if me.email is null or auth.uid() is null then return null; end if;
  if not exists (select 1 from public.login_events where user_id = auth.uid() and at > now() - interval '30 minutes') then
    insert into public.login_events (user_id, email) values (auth.uid(), me.email);
  end if;
  select count(*) into n from public.login_events where user_id = auth.uid();
  return json_build_object('logins', n);
end $$;

-- Batches of click / view / exit events from the portal. Only counts for invited people; never stores typed text.
create or replace function public.track_events(p_events jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare me public.allowed_emails; ev jsonb; n int := 0; recent int; k text;
begin
  me := public._p2p_me();
  if me.email is null or auth.uid() is null or jsonb_typeof(p_events) <> 'array' then return 0; end if;
  select count(*) into recent from public.usage_events where user_id = auth.uid() and at > now() - interval '1 hour';
  if recent > 4000 then return 0; end if;
  for ev in select value from jsonb_array_elements(p_events) limit 40 loop
    begin
      k := ev ->> 'kind';
      if k in ('click', 'view', 'exit') then
        insert into public.usage_events (user_id, email, sid, kind, section, target, x, y, device, dur_ms)
        values (auth.uid(), me.email, left(ev ->> 'sid', 40), k, left(ev ->> 'section', 24), left(ev ->> 'target', 60),
                least(100, greatest(0, nullif(ev ->> 'x', '')::real)), least(100, greatest(0, nullif(ev ->> 'y', '')::real)),
                case when ev ->> 'device' in ('d', 'm', 't') then ev ->> 'device' else null end,
                least(1800000, greatest(0, nullif(ev ->> 'dur_ms', '')::int)));
        n := n + 1;
      end if;
    exception when others then null;
    end;
  end loop;
  return n;
end $$;

-- Keep 90 days of behaviour events.
do $$ begin
  perform cron.schedule('p2p_prune_events', '30 7 * * *', 'delete from public.usage_events where at < now() - interval ''90 days''');
exception when others then null;
end $$;

-- ---------- staff views ----------
-- Every invitation, whether the email went out, whether the person signed in, and how many times.
create or replace function public.invite_tracker() returns json
language plpgsql stable security definer set search_path = public as $$
declare me public.allowed_emails; rows_ json; sm json;
begin
  me := public._p2p_me();
  if me.email is null or me.role not in ('super', 'admin', 'sales') then raise exception 'not allowed' using errcode = '42501'; end if;
  select coalesce(json_agg(r order by r.sent_at desc), '[]'::json) into rows_ from (
    select l.id, l.email, l.role, l.invited_by, l.note, l.sent_at, l.removed_at,
           (select o.status from public.email_outbox o where lower(o.to_email) = lower(l.email) and o.kind = 'welcome' and o.created_at >= l.sent_at - interval '5 minutes' order by o.id limit 1) as email_status,
           (select o.sent_at from public.email_outbox o where lower(o.to_email) = lower(l.email) and o.kind = 'welcome' and o.created_at >= l.sent_at - interval '5 minutes' order by o.id limit 1) as email_sent_at,
           u.created_at as first_login,
           greatest((select count(*) from public.login_events e where lower(e.email) = lower(l.email)), case when u.last_sign_in_at is not null then 1 else 0 end) as login_count,
           coalesce((select max(e.at) from public.login_events e where lower(e.email) = lower(l.email)), u.last_sign_in_at) as last_login
    from public.invite_log l
    left join auth.users u on lower(u.email) = lower(l.email)
    where l.invited_by is not null and (me.role in ('super', 'admin') or lower(l.invited_by) = lower(me.email))
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

-- Heat map, time per section, exit points: super user and admins only.
create or replace function public.analytics_summary(p_days int default 30, p_email text default null) returns json
language plpgsql stable security definer set search_path = public as $$
declare me public.allowed_emails; d int := least(greatest(coalesce(p_days, 30), 1), 90); res json;
begin
  me := public._p2p_me();
  if me.email is null or me.role not in ('super', 'admin') then raise exception 'not allowed' using errcode = '42501'; end if;
  with ev as (
    select * from public.usage_events
    where at > now() - make_interval(days => d) and (p_email is null or p_email = '' or lower(email) = lower(p_email))
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
    'users', (select coalesce(json_agg(distinct lower(email)), '[]'::json) from (select email from public.usage_events where at > now() - make_interval(days => d) limit 5000) u)
  ) into res;
  return res;
end $$;

revoke all on function public.record_login(), public.track_events(jsonb), public.invite_tracker(), public.analytics_summary(int, text) from public, anon;
grant execute on function public.record_login(), public.track_events(jsonb), public.invite_tracker(), public.analytics_summary(int, text) to authenticated;
