-- Invite-only access: only emails listed in allowed_emails can use the portal.
create table if not exists public.allowed_emails (
  email text primary key,
  note text,
  added_at timestamptz not null default now()
);
alter table public.allowed_emails enable row level security; -- no policies: clients can't read or write it
insert into public.allowed_emails (email, note) values ('ebizmatrix@gmail.com', 'owner') on conflict do nothing;

create or replace function public.is_allowed() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.allowed_emails a
                 where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
$$;
revoke all on function public.is_allowed() from public;
grant execute on function public.is_allowed() to authenticated;

create or replace function public.bump_usage(kind text, daily_limit int)
returns json language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c int;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not public.is_allowed() then raise exception 'not invited' using errcode = '42501'; end if;
  insert into public.usage as u (user_id, day, kind, count)
  values (uid, (now() at time zone 'utc')::date, kind, 1)
  on conflict on constraint usage_pkey do update set count = u.count + 1 where u.count < daily_limit
  returning u.count into c;
  if c is null then return json_build_object('allowed', false); end if;
  return json_build_object('allowed', true, 'used', c);
end $$;

drop policy if exists "own rows" on public.kv;
create policy "own rows" on public.kv for all
  using (user_id = auth.uid() and public.is_allowed())
  with check (user_id = auth.uid() and public.is_allowed());
