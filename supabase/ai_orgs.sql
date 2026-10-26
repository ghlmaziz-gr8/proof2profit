-- AI keys and usage per org. Run once in the Supabase SQL editor (safe to re-run), after orgs.sql, ai_engines.sql and ai_usage.sql.
-- Proof to Profit people keep today's behaviour (own engine, then the org default, then the platform key).
-- Agency people only ever use their own key: no org default and no platform key. Usage counts and daily limits are per org.

alter table public.ai_usage_daily add column if not exists org_id uuid;
update public.ai_usage_daily set org_id = public._p2p_platform_org() where org_id is null;
alter table public.ai_usage_daily alter column org_id set not null;
alter table public.ai_usage_daily drop constraint if exists ai_usage_daily_pkey;
alter table public.ai_usage_daily add primary key (day, org_id, engine);

alter table public.ai_limits add column if not exists org_id uuid;
update public.ai_limits set org_id = public._p2p_platform_org() where org_id is null;
alter table public.ai_limits alter column org_id set not null;
alter table public.ai_limits drop constraint if exists ai_limits_pkey;
alter table public.ai_limits add primary key (org_id, engine);

create or replace function public._p2p_org_of(p_email text) returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce((select a.org_id from public.allowed_emails a where lower(a.email) = lower(coalesce(p_email, '')) limit 1), public._p2p_platform_org())
$$;
revoke all on function public._p2p_org_of(text) from public, anon, authenticated;

drop function if exists public.ai_usage_take(text, text, text);
drop function if exists public.ai_usage_fail(text, text, text);

create or replace function public.ai_usage_take(p_secret text, p_provider text, p_model text, p_email text default null) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare e text := left(p_provider, 40) || ':' || left(p_model, 120); o uuid := public._p2p_org_of(p_email); lim int; c int;
begin
  if not public._ai_secret_ok(p_secret) then raise exception 'forbidden' using errcode = '42501'; end if;
  select daily_limit into lim from public.ai_limits where org_id = o and engine = e;
  insert into public.ai_usage_daily (day, org_id, engine, provider, model) values ((now() at time zone 'utc')::date, o, e, left(p_provider, 40), left(p_model, 120))
    on conflict (day, org_id, engine) do nothing;
  if lim is not null then
    update public.ai_usage_daily set calls = calls + 1 where day = (now() at time zone 'utc')::date and org_id = o and engine = e and calls < lim returning calls into c;
    if c is null then
      update public.ai_usage_daily set blocked = blocked + 1 where day = (now() at time zone 'utc')::date and org_id = o and engine = e;
      return json_build_object('allowed', false, 'limit', lim);
    end if;
  else
    update public.ai_usage_daily set calls = calls + 1 where day = (now() at time zone 'utc')::date and org_id = o and engine = e returning calls into c;
  end if;
  return json_build_object('allowed', true, 'calls', c, 'limit', lim);
end $$;
revoke all on function public.ai_usage_take(text, text, text, text) from public, anon, authenticated;
grant execute on function public.ai_usage_take(text, text, text, text) to anon, authenticated;

create or replace function public.ai_usage_fail(p_secret text, p_provider text, p_model text, p_email text default null) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public._ai_secret_ok(p_secret) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.ai_usage_daily set errors = errors + 1
  where day = (now() at time zone 'utc')::date and org_id = public._p2p_org_of(p_email) and engine = left(p_provider, 40) || ':' || left(p_model, 120);
end $$;
revoke all on function public.ai_usage_fail(text, text, text, text) from public, anon, authenticated;
grant execute on function public.ai_usage_fail(text, text, text, text) to anon, authenticated;

-- Portal: my org's usage and limits. Super, admin and agency admin can set limits.
create or replace function public.ai_usage_info() returns json
language plpgsql stable security definer set search_path = public as $$
declare me public.allowed_emails; res json; d date := (now() at time zone 'utc')::date;
begin
  me := public._p2p_me();
  if me.email is null then raise exception 'forbidden' using errcode = '42501'; end if;
  select json_build_object(
    'is_admin', me.role in ('super','admin','agency_admin'),
    'today', (select coalesce(json_agg(json_build_object('engine', engine, 'provider', provider, 'model', model, 'calls', calls, 'errors', errors, 'blocked', blocked)), '[]'::json) from public.ai_usage_daily where org_id = me.org_id and day = d),
    'days', (select coalesce(json_agg(json_build_object('day', day, 'engine', engine, 'calls', calls)), '[]'::json) from public.ai_usage_daily where org_id = me.org_id and day > d - 7),
    'limits', (select coalesce(json_agg(json_build_object('engine', engine, 'limit', daily_limit)), '[]'::json) from public.ai_limits where org_id = me.org_id)
  ) into res;
  return res;
end $$;
revoke all on function public.ai_usage_info() from public, anon;
grant execute on function public.ai_usage_info() to authenticated;

create or replace function public.ai_limit_set(p_engine text, p_limit int) returns void
language plpgsql security definer set search_path = public as $$
declare me public.allowed_emails;
begin
  me := public._p2p_me();
  if me.email is null or me.role not in ('super','admin','agency_admin') then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_engine is null or length(p_engine) > 170 or p_engine !~ '^[A-Za-z0-9_.-]+:[^\s"''<>]+$' then raise exception 'bad engine'; end if;
  if p_limit is null then delete from public.ai_limits where org_id = me.org_id and engine = p_engine;
  else insert into public.ai_limits (org_id, engine, daily_limit, set_by) values (me.org_id, p_engine, greatest(0, least(p_limit, 10000000)), lower(me.email))
    on conflict (org_id, engine) do update set daily_limit = excluded.daily_limit, set_by = excluded.set_by, updated_at = now(); end if;
end $$;
revoke all on function public.ai_limit_set(text, int) from public, anon;
grant execute on function public.ai_limit_set(text, int) to authenticated;

-- Engine settings: the org default and the platform fallback exist only for Proof to Profit people.
create or replace function public.ai_engine_info() returns json
language plpgsql stable security definer set search_path = public as $$
declare me public.allowed_emails; m public.ai_engines; o public.ai_engines; plat boolean;
begin
  me := public._p2p_me();
  if me.email is null then raise exception 'forbidden' using errcode = '42501'; end if;
  select coalesce(g.is_platform, false) into plat from public.orgs g where g.id = me.org_id;
  select * into m from public.ai_engines where scope = lower(me.email);
  if plat then select * into o from public.ai_engines where scope = 'org'; end if;
  return json_build_object('email', lower(me.email), 'is_admin', (me.role in ('super','admin') and plat), 'platform', plat,
    'mine', case when m.scope is null then null else json_build_object('provider', m.provider, 'kind', m.kind, 'base_url', m.base_url, 'model', m.model, 'has_key', m.key_enc is not null, 'key_last4', m.key_last4, 'updated_at', m.updated_at) end,
    'org', case when o.scope is null then null else json_build_object('provider', o.provider, 'kind', o.kind, 'base_url', o.base_url, 'model', o.model, 'has_key', o.key_enc is not null, 'key_last4', o.key_last4, 'updated_by', o.updated_by, 'updated_at', o.updated_at) end);
end $$;
revoke all on function public.ai_engine_info() from public, anon;
grant execute on function public.ai_engine_info() to authenticated;

create or replace function public.ai_engine_get(p_secret text, p_email text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare m public.ai_engines; o public.ai_engines; plat boolean;
begin
  if not public._ai_secret_ok(p_secret) then raise exception 'forbidden' using errcode = '42501'; end if;
  select coalesce(g.is_platform, false) into plat from public.allowed_emails a join public.orgs g on g.id = a.org_id where lower(a.email) = lower(coalesce(p_email, '')) limit 1;
  plat := coalesce(plat, false);
  select * into m from public.ai_engines where scope = lower(p_email);
  if plat then select * into o from public.ai_engines where scope = 'org'; end if;
  return json_build_object('platform', plat,
    'mine', case when m.scope is null then null else json_build_object('provider', m.provider, 'kind', m.kind, 'base_url', m.base_url, 'model', m.model, 'key_enc', m.key_enc) end,
    'org', case when o.scope is null then null else json_build_object('provider', o.provider, 'kind', o.kind, 'base_url', o.base_url, 'model', o.model, 'key_enc', o.key_enc) end);
end $$;
revoke all on function public.ai_engine_get(text, text) from public;
grant execute on function public.ai_engine_get(text, text) to anon, authenticated;
