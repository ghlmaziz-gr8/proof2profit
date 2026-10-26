-- Daily usage and daily limits per AI engine (provider:model). Safe to re-run.
create table if not exists public.ai_usage_daily (
  day date not null default ((now() at time zone 'utc')::date),
  engine text not null,
  provider text not null,
  model text not null,
  calls int not null default 0,
  errors int not null default 0,
  blocked int not null default 0,
  primary key (day, engine)
);
alter table public.ai_usage_daily enable row level security;
revoke all on public.ai_usage_daily from anon, authenticated;

create table if not exists public.ai_limits (
  engine text primary key,
  daily_limit int not null check (daily_limit >= 0),
  set_by text, updated_at timestamptz not null default now()
);
alter table public.ai_limits enable row level security;
revoke all on public.ai_limits from anon, authenticated;

create or replace function public._ai_secret_ok(p_secret text) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.app_secrets where name = 'outbox' and hash = encode(digest(p_secret, 'sha256'), 'hex'))
$$;
revoke all on function public._ai_secret_ok(text) from public, anon, authenticated;

-- Worker: count one call against the engine, unless its daily limit is already reached.
create or replace function public.ai_usage_take(p_secret text, p_provider text, p_model text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare e text := left(p_provider, 40) || ':' || left(p_model, 120); lim int; c int;
begin
  if not public._ai_secret_ok(p_secret) then raise exception 'forbidden' using errcode = '42501'; end if;
  select daily_limit into lim from public.ai_limits where engine = e;
  insert into public.ai_usage_daily (day, engine, provider, model) values ((now() at time zone 'utc')::date, e, left(p_provider, 40), left(p_model, 120))
    on conflict (day, engine) do nothing;
  if lim is not null then
    update public.ai_usage_daily set calls = calls + 1 where day = (now() at time zone 'utc')::date and engine = e and calls < lim returning calls into c;
    if c is null then
      update public.ai_usage_daily set blocked = blocked + 1 where day = (now() at time zone 'utc')::date and engine = e;
      return json_build_object('allowed', false, 'limit', lim);
    end if;
  else
    update public.ai_usage_daily set calls = calls + 1 where day = (now() at time zone 'utc')::date and engine = e returning calls into c;
  end if;
  return json_build_object('allowed', true, 'calls', c, 'limit', lim);
end $$;
revoke all on function public.ai_usage_take(text, text, text) from public, anon, authenticated;
grant execute on function public.ai_usage_take(text, text, text) to anon, authenticated;

create or replace function public.ai_usage_fail(p_secret text, p_provider text, p_model text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public._ai_secret_ok(p_secret) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.ai_usage_daily set errors = errors + 1 where day = (now() at time zone 'utc')::date and engine = left(p_provider, 40) || ':' || left(p_model, 120);
end $$;
revoke all on function public.ai_usage_fail(text, text, text) from public, anon, authenticated;
grant execute on function public.ai_usage_fail(text, text, text) to anon, authenticated;

-- Portal: today, the last 7 days and the limits (any invited user can read; the numbers are totals, nothing personal).
create or replace function public.ai_usage_info() returns json
language plpgsql stable security definer set search_path = public as $$
declare me public.allowed_emails; res json;
begin
  me := public._p2p_me();
  if me.email is null then raise exception 'forbidden' using errcode = '42501'; end if;
  select json_build_object(
    'is_admin', me.role in ('super','admin'),
    'today', (select coalesce(json_agg(json_build_object('engine', engine, 'provider', provider, 'model', model, 'calls', calls, 'errors', errors, 'blocked', blocked)), '[]'::json) from public.ai_usage_daily where day = (now() at time zone 'utc')::date),
    'days', (select coalesce(json_agg(json_build_object('day', day, 'engine', engine, 'calls', calls)), '[]'::json) from public.ai_usage_daily where day > (now() at time zone 'utc')::date - 7),
    'limits', (select coalesce(json_agg(json_build_object('engine', engine, 'limit', daily_limit)), '[]'::json) from public.ai_limits)
  ) into res;
  return res;
end $$;
revoke all on function public.ai_usage_info() from public, anon;
grant execute on function public.ai_usage_info() to authenticated;

-- Admins: set (or clear with null) the daily limit for one engine.
create or replace function public.ai_limit_set(p_engine text, p_limit int) returns void
language plpgsql security definer set search_path = public as $$
declare me public.allowed_emails;
begin
  me := public._p2p_me();
  if me.email is null or me.role not in ('super','admin') then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_engine is null or length(p_engine) > 170 or p_engine !~ '^[A-Za-z0-9_.-]+:[^\s"''<>]+$' then raise exception 'bad engine'; end if;
  if p_limit is null then delete from public.ai_limits where engine = p_engine;
  else insert into public.ai_limits (engine, daily_limit, set_by) values (p_engine, greatest(0, least(p_limit, 10000000)), lower(me.email))
    on conflict (engine) do update set daily_limit = excluded.daily_limit, set_by = excluded.set_by, updated_at = now(); end if;
end $$;
revoke all on function public.ai_limit_set(text, int) from public, anon;
grant execute on function public.ai_limit_set(text, int) to authenticated;
