-- AI engine settings. Run once in the Supabase SQL editor (safe to re-run).
-- Every signed-in user can choose their own AI engine and key. Admins and super users can also set an organisation default.
-- Keys are encrypted by the Worker before they are stored and are never sent back to a browser.
-- Resolution order for each request: the user's own engine, then the organisation default, then the platform's Gemini key.

create extension if not exists pgcrypto with schema extensions;

-- Replaces the earlier single-row table from the first version of this feature.
drop function if exists public.ai_config_info();
drop function if exists public.ai_config_get(text);
drop function if exists public.ai_config_put(text, text, text, text, text, text, text, boolean, text);
drop function if exists public.ai_config_clear(text, text);
drop table if exists public.ai_config;

create table if not exists public.ai_engines (
  scope text primary key,                  -- 'org' or the user's lower-case email
  provider text not null,
  kind text not null check (kind in ('gemini','openai','anthropic')),
  base_url text,
  model text not null,
  key_enc text,
  key_last4 text,
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table public.ai_engines enable row level security;
revoke all on public.ai_engines from anon, authenticated;

-- Who am I, am I an admin, and what are my settings and the organisation default (no secrets).
create or replace function public.ai_engine_info() returns json
language plpgsql stable security definer set search_path = public as $$
declare me public.allowed_emails; m public.ai_engines; o public.ai_engines;
begin
  me := public._p2p_me();
  if me.email is null then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into m from public.ai_engines where scope = lower(me.email);
  select * into o from public.ai_engines where scope = 'org';
  return json_build_object('email', lower(me.email), 'is_admin', me.role in ('super','admin'),
    'mine', case when m.scope is null then null else json_build_object('provider', m.provider, 'kind', m.kind, 'base_url', m.base_url, 'model', m.model, 'has_key', m.key_enc is not null, 'key_last4', m.key_last4, 'updated_at', m.updated_at) end,
    'org', case when o.scope is null then null else json_build_object('provider', o.provider, 'kind', o.kind, 'base_url', o.base_url, 'model', o.model, 'has_key', o.key_enc is not null, 'key_last4', o.key_last4, 'updated_by', o.updated_by, 'updated_at', o.updated_at) end);
end $$;
revoke all on function public.ai_engine_info() from public, anon;
grant execute on function public.ai_engine_info() to authenticated;

-- Worker-only functions, guarded by the same secret as the email outbox.
create or replace function public.ai_engine_get(p_secret text, p_email text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare ok boolean; m public.ai_engines; o public.ai_engines;
begin
  select exists (select 1 from public.app_secrets where name = 'outbox' and hash = encode(digest(p_secret, 'sha256'), 'hex')) into ok;
  if not ok then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into m from public.ai_engines where scope = lower(p_email);
  select * into o from public.ai_engines where scope = 'org';
  return json_build_object(
    'mine', case when m.scope is null then null else json_build_object('provider', m.provider, 'kind', m.kind, 'base_url', m.base_url, 'model', m.model, 'key_enc', m.key_enc) end,
    'org', case when o.scope is null then null else json_build_object('provider', o.provider, 'kind', o.kind, 'base_url', o.base_url, 'model', o.model, 'key_enc', o.key_enc) end);
end $$;

create or replace function public.ai_engine_put(p_secret text, p_scope text, p_provider text, p_kind text, p_base_url text, p_model text, p_key_enc text, p_key_last4 text, p_keep_key boolean, p_by text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare ok boolean;
begin
  select exists (select 1 from public.app_secrets where name = 'outbox' and hash = encode(digest(p_secret, 'sha256'), 'hex')) into ok;
  if not ok then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.ai_engines (scope, provider, kind, base_url, model, key_enc, key_last4, updated_by, updated_at)
  values (lower(p_scope), p_provider, p_kind, p_base_url, p_model, p_key_enc, p_key_last4, p_by, now())
  on conflict (scope) do update set provider = excluded.provider, kind = excluded.kind, base_url = excluded.base_url, model = excluded.model,
    key_enc = case when p_keep_key then public.ai_engines.key_enc else excluded.key_enc end,
    key_last4 = case when p_keep_key then public.ai_engines.key_last4 else excluded.key_last4 end,
    updated_by = excluded.updated_by, updated_at = now();
end $$;

create or replace function public.ai_engine_clear(p_secret text, p_scope text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare ok boolean;
begin
  select exists (select 1 from public.app_secrets where name = 'outbox' and hash = encode(digest(p_secret, 'sha256'), 'hex')) into ok;
  if not ok then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.ai_engines where scope = lower(p_scope);
end $$;

revoke all on function public.ai_engine_get(text, text) from public;
revoke all on function public.ai_engine_put(text, text, text, text, text, text, text, text, boolean, text) from public;
revoke all on function public.ai_engine_clear(text, text) from public;
grant execute on function public.ai_engine_get(text, text) to anon, authenticated;
grant execute on function public.ai_engine_put(text, text, text, text, text, text, text, text, boolean, text) to anon, authenticated;
grant execute on function public.ai_engine_clear(text, text) to anon, authenticated;
