-- Multi-team membership. Run once in the Supabase SQL editor (safe to re-run).
-- A person can sit on several owners' teams. Their sign-in role stays whatever it already is.
create table if not exists public.team_members (
  owner_email text not null,
  member_email text not null,
  title text,
  added_at timestamptz not null default now(),
  primary key (owner_email, member_email)
);
alter table public.team_members enable row level security; -- no policies: only the functions below touch it
insert into public.team_members (owner_email, member_email, title, added_at)
select lower(owner_email), lower(email), title, added_at from public.allowed_emails
where owner_email is not null on conflict do nothing;

create or replace function public.invite_team_member(p_email text, p_title text default null) returns json
language plpgsql security definer set search_path = public as $$
declare me public.allowed_emails; e text := lower(trim(coalesce(p_email, ''))); existing boolean;
begin
  me := public._p2p_me();
  if me.email is null or me.role <> 'owner' then raise exception 'Only business owners can add team members' using errcode = '42501'; end if;
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email address' using errcode = '22023'; end if;
  if e = lower(me.email) then raise exception 'That is your own email' using errcode = '22023'; end if;
  if exists (select 1 from public.team_members where owner_email = lower(me.email) and member_email = e) then
    raise exception 'Already on your team' using errcode = '23505';
  end if;
  if (select count(*) from public.team_members where owner_email = lower(me.email)) >= 5 then
    raise exception 'Your team is full (5 people)' using errcode = '54000';
  end if;
  existing := exists (select 1 from public.allowed_emails where lower(email) = e);
  if not existing then
    insert into public.allowed_emails (email, role, invited_by, owner_email, title)
    values (e, 'member', me.email, me.email, left(p_title, 60));
  end if;
  insert into public.team_members (owner_email, member_email, title) values (lower(me.email), e, left(p_title, 60));
  return json_build_object('ok', true, 'existing', existing);
end $$;

create or replace function public.list_team() returns json
language plpgsql stable security definer set search_path = public as $$
declare me public.allowed_emails; res json;
begin
  me := public._p2p_me();
  if me.email is null or me.role <> 'owner' then raise exception 'not allowed' using errcode = '42501'; end if;
  select coalesce(json_agg(x order by x.added_at), '[]'::json) into res from (
    select t.member_email as email, t.title, t.added_at, a.role,
           (u.last_sign_in_at is not null) as joined
    from public.team_members t
    left join public.allowed_emails a on lower(a.email) = t.member_email
    left join auth.users u on lower(u.email) = t.member_email
    where t.owner_email = lower(me.email)
  ) x;
  return res;
end $$;

create or replace function public.remove_team_member(p_email text) returns json
language plpgsql security definer set search_path = public as $$
declare me public.allowed_emails; e text := lower(trim(coalesce(p_email, '')));
begin
  me := public._p2p_me();
  if me.email is null or me.role <> 'owner' then raise exception 'not allowed' using errcode = '42501'; end if;
  delete from public.team_members where owner_email = lower(me.email) and member_email = e;
  -- a pure team member with no team left loses access; anyone else keeps their own role
  if not exists (select 1 from public.team_members where member_email = e) then
    delete from public.allowed_emails where lower(email) = e and role = 'member';
  else
    update public.allowed_emails set owner_email = (select owner_email from public.team_members where member_email = e order by added_at limit 1)
    where lower(email) = e and role = 'member' and lower(coalesce(owner_email, '')) = lower(me.email);
  end if;
  return json_build_object('ok', true);
end $$;

create or replace function public.remove_user(p_email text) returns json
language plpgsql security definer set search_path = public as $$
declare me public.allowed_emails; t public.allowed_emails; e text := lower(trim(coalesce(p_email, '')));
begin
  me := public._p2p_me();
  if me.email is null or me.role not in ('super','admin','sales') then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into t from public.allowed_emails where lower(email) = e;
  if t.email is null then raise exception 'Not on the list' using errcode = 'P0002'; end if;
  if lower(t.email) = lower(me.email) then raise exception 'You cannot remove yourself' using errcode = '42501'; end if;
  if not (
    me.role = 'super' or
    (me.role = 'admin' and t.role in ('sales','owner','member')) or
    (me.role = 'sales' and t.role = 'owner' and lower(t.invited_by) = lower(me.email))
  ) then raise exception 'Your role cannot remove this person' using errcode = '42501'; end if;
  delete from public.team_members where owner_email = e or member_email = e;
  -- team members whose only team was this person's lose access with them
  delete from public.allowed_emails a where a.role = 'member' and lower(a.owner_email) = e
    and not exists (select 1 from public.team_members m where m.member_email = lower(a.email));
  delete from public.allowed_emails where lower(email) = e;
  return json_build_object('ok', true);
end $$;
revoke all on function public.invite_team_member(text, text), public.list_team(), public.remove_team_member(text), public.remove_user(text) from public, anon;
grant execute on function public.invite_team_member(text, text), public.list_team(), public.remove_team_member(text), public.remove_user(text) to authenticated;
