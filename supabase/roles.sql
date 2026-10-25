-- Roles and invitations. Run once in the Supabase SQL editor (safe to re-run).
-- Roles: super (everything) > admin > sales > owner (business owner) > member (owner's team).
-- The invite list can only be read or changed through the functions below, and each one checks the caller's role.

alter table public.allowed_emails add column if not exists role text not null default 'owner';
alter table public.allowed_emails add column if not exists invited_by text;
alter table public.allowed_emails add column if not exists owner_email text;
alter table public.allowed_emails add column if not exists title text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'allowed_emails_role_chk') then
    alter table public.allowed_emails add constraint allowed_emails_role_chk check (role in ('super','admin','sales','owner','member'));
  end if;
end $$;
update public.allowed_emails set role = 'super' where lower(email) = 'ebizmatrix@gmail.com';

-- Who is calling (the row for the signed-in email; all-null when not invited).
create or replace function public._p2p_me() returns public.allowed_emails
language plpgsql stable security definer set search_path = public as $$
declare me public.allowed_emails;
begin
  select * into me from public.allowed_emails a where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', '')) limit 1;
  return me;
end $$;
revoke all on function public._p2p_me() from public, anon, authenticated;

create or replace function public.my_role() returns json
language plpgsql stable security definer set search_path = public as $$
declare me public.allowed_emails;
begin
  me := public._p2p_me();
  if me.email is null then return null; end if;
  return json_build_object('email', me.email, 'role', me.role, 'owner_email', me.owner_email);
end $$;
revoke all on function public.my_role() from public, anon;
grant execute on function public.my_role() to authenticated;

-- Staff (super, admin, sales) invite people to the platform.
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
    (me.role = 'sales' and p_role = 'owner')
  ) then raise exception 'Your role cannot invite that role' using errcode = '42501'; end if;
  if exists (select 1 from public.allowed_emails where lower(email) = e) then
    raise exception 'That email is already on the list' using errcode = '23505';
  end if;
  insert into public.allowed_emails (email, role, note, invited_by) values (e, p_role, left(p_note, 200), me.email);
  return json_build_object('ok', true);
end $$;

-- Staff see invitations: super and admin see all, sales see only their own.
create or replace function public.list_invites() returns json
language plpgsql stable security definer set search_path = public as $$
declare me public.allowed_emails; res json;
begin
  me := public._p2p_me();
  if me.email is null or me.role not in ('super','admin','sales') then raise exception 'not allowed' using errcode = '42501'; end if;
  select coalesce(json_agg(x order by x.added_at desc), '[]'::json) into res from (
    select a.email, a.role, a.note, a.invited_by, a.owner_email, a.title, a.added_at,
           (u.last_sign_in_at is not null) as joined
    from public.allowed_emails a
    left join auth.users u on lower(u.email) = lower(a.email)
    where me.role in ('super','admin') or lower(a.invited_by) = lower(me.email)
  ) x;
  return res;
end $$;

-- Remove someone (their team goes with them if they are a business owner).
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
  delete from public.allowed_emails where lower(owner_email) = lower(t.email);
  delete from public.allowed_emails where lower(email) = lower(t.email);
  return json_build_object('ok', true);
end $$;

-- Only the super user changes roles.
create or replace function public.set_role(p_email text, p_role text) returns json
language plpgsql security definer set search_path = public as $$
declare me public.allowed_emails; t public.allowed_emails; e text := lower(trim(coalesce(p_email, '')));
begin
  me := public._p2p_me();
  if me.email is null or me.role <> 'super' then raise exception 'Only the super user can change roles' using errcode = '42501'; end if;
  if p_role not in ('super','admin','sales','owner') then raise exception 'Invalid role' using errcode = '22023'; end if;
  select * into t from public.allowed_emails where lower(email) = e;
  if t.email is null then raise exception 'Not on the list' using errcode = 'P0002'; end if;
  if t.role = 'member' then raise exception 'Team members belong to a business owner' using errcode = '22023'; end if;
  if lower(t.email) = lower(me.email) then raise exception 'You cannot change your own role' using errcode = '42501'; end if;
  update public.allowed_emails set role = p_role where lower(email) = e;
  return json_build_object('ok', true);
end $$;

-- Business owners manage their own team (managers, marketing crew), up to 5 people.
create or replace function public.list_team() returns json
language plpgsql stable security definer set search_path = public as $$
declare me public.allowed_emails; res json;
begin
  me := public._p2p_me();
  if me.email is null or me.role <> 'owner' then raise exception 'not allowed' using errcode = '42501'; end if;
  select coalesce(json_agg(x order by x.added_at), '[]'::json) into res from (
    select a.email, a.title, a.added_at, (u.last_sign_in_at is not null) as joined
    from public.allowed_emails a left join auth.users u on lower(u.email) = lower(a.email)
    where lower(a.owner_email) = lower(me.email)
  ) x;
  return res;
end $$;

create or replace function public.invite_team_member(p_email text, p_title text default null) returns json
language plpgsql security definer set search_path = public as $$
declare me public.allowed_emails; e text := lower(trim(coalesce(p_email, '')));
begin
  me := public._p2p_me();
  if me.email is null or me.role <> 'owner' then raise exception 'Only business owners can add team members' using errcode = '42501'; end if;
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email address' using errcode = '22023'; end if;
  if (select count(*) from public.allowed_emails where lower(owner_email) = lower(me.email)) >= 5 then
    raise exception 'Your team is full (5 people)' using errcode = '54000';
  end if;
  if exists (select 1 from public.allowed_emails where lower(email) = e) then
    raise exception 'That email is already on the list' using errcode = '23505';
  end if;
  insert into public.allowed_emails (email, role, invited_by, owner_email, title)
  values (e, 'member', me.email, me.email, left(p_title, 60));
  return json_build_object('ok', true);
end $$;

create or replace function public.remove_team_member(p_email text) returns json
language plpgsql security definer set search_path = public as $$
declare me public.allowed_emails; e text := lower(trim(coalesce(p_email, '')));
begin
  me := public._p2p_me();
  if me.email is null or me.role <> 'owner' then raise exception 'not allowed' using errcode = '42501'; end if;
  delete from public.allowed_emails where lower(email) = e and lower(owner_email) = lower(me.email);
  return json_build_object('ok', true);
end $$;

revoke all on function public.invite_user(text, text, text), public.list_invites(), public.remove_user(text), public.set_role(text, text),
  public.list_team(), public.invite_team_member(text, text), public.remove_team_member(text) from public, anon;
grant execute on function public.invite_user(text, text, text), public.list_invites(), public.remove_user(text), public.set_role(text, text),
  public.list_team(), public.invite_team_member(text, text), public.remove_team_member(text) to authenticated;
