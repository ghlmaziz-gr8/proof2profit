-- Proof to Profit: run this once in Supabase -> SQL Editor.

-- Per-user key/value storage (saved businesses, trend history, recent searches...)
create table if not exists public.kv (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  key text not null,
  value jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.kv enable row level security;
drop policy if exists "own rows" on public.kv;
create policy "own rows" on public.kv for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Daily usage counters (no direct access; only through bump_usage)
create table if not exists public.usage (
  user_id uuid not null references auth.users on delete cascade,
  day date not null default ((now() at time zone 'utc')::date),
  kind text not null,
  count int not null default 0,
  primary key (user_id, day, kind)
);
alter table public.usage enable row level security;

create or replace function public.bump_usage(kind text, daily_limit int)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  c int;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  insert into public.usage as u (user_id, day, kind, count)
  values (uid, (now() at time zone 'utc')::date, kind, 1)
  on conflict (user_id, day, kind)
  do update set count = u.count + 1 where u.count < daily_limit
  returning u.count into c;
  if c is null then
    return json_build_object('allowed', false);
  end if;
  return json_build_object('allowed', true, 'used', c);
end $$;
revoke all on function public.bump_usage(text, int) from public;
grant execute on function public.bump_usage(text, int) to authenticated;
