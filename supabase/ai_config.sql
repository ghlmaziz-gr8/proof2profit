-- AI engine settings (one row, organisation-wide). Run once in the Supabase SQL editor (safe to re-run).
-- Admins and super users choose the engine in the portal. The API key is encrypted by the Worker before it is stored
-- and is never sent back to a browser. Nothing here is readable or writable directly from the browser.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.ai_config (
  id int primary key default 1 check (id = 1),
  provider text not null,
  kind text not null check (kind in ('gemini','openai','anthropic')),
  base_url text,
  model text not null,
  key_enc text,
  key_last4 text,
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table public.ai_config enable row level security;
revoke all on public.ai_config from anon, authenticated;

-- Admin check + non-secret view of the current setting.
create or replace function public.ai_config_info() returns json
language plpgsql stable security definer set search_path = public as $$
declare me public.allowed_emails; c public.ai_config;
begin
  me := public._p2p_me();
  if me.email is null or me.role not in ('super','admin') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into c from public.ai_config where id = 1;
  if c.id is null then return json_build_object('configured', false); end if;
  return json_build_object('configured', true, 'provider', c.provider, 'kind', c.kind, 'base_url', c.base_url, 'model', c.model,
    'has_key', c.key_enc is not null, 'key_last4', c.key_last4, 'updated_by', c.updated_by, 'updated_at', c.updated_at);
end $$;
revoke all on function public.ai_config_info() from public, anon;
grant execute on function public.ai_config_info() to authenticated;

-- Worker-only functions, guarded by the same secret as the email outbox.
create or replace function public.ai_config_get(p_secret text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare ok boolean; c public.ai_config;
begin
  select exists (select 1 from public.app_secrets where name = 'outbox' and hash = encode(digest(p_secret, 'sha256'), 'hex')) into ok;
  if not ok then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into c from public.ai_config where id = 1;
  if c.id is null then return null; end if;
  return json_build_object('provider', c.provider, 'kind', c.kind, 'base_url', c.base_url, 'model', c.model, 'key_enc', c.key_enc);
end $$;

create or replace function public.ai_config_put(p_secret text, p_provider text, p_kind text, p_base_url text, p_model text, p_key_enc text, p_key_last4 text, p_keep_key boolean, p_by text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare ok boolean;
begin
  select exists (select 1 from public.app_secrets where name = 'outbox' and hash = encode(digest(p_secret, 'sha256'), 'hex')) into ok;
  if not ok then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.ai_config (id, provider, kind, base_url, model, key_enc, key_last4, updated_by, updated_at)
  values (1, p_provider, p_kind, p_base_url, p_model, p_key_enc, p_key_last4, p_by, now())
  on conflict (id) do update set provider = excluded.provider, kind = excluded.kind, base_url = excluded.base_url, model = excluded.model,
    key_enc = case when p_keep_key then public.ai_config.key_enc else excluded.key_enc end,
    key_last4 = case when p_keep_key then public.ai_config.key_last4 else excluded.key_last4 end,
    updated_by = excluded.updated_by, updated_at = now();
end $$;

create or replace function public.ai_config_clear(p_secret text, p_by text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare ok boolean;
begin
  select exists (select 1 from public.app_secrets where name = 'outbox' and hash = encode(digest(p_secret, 'sha256'), 'hex')) into ok;
  if not ok then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.ai_config where id = 1;
end $$;

revoke all on function public.ai_config_get(text) from public;
revoke all on function public.ai_config_put(text, text, text, text, text, text, text, boolean, text) from public;
revoke all on function public.ai_config_clear(text, text) from public;
grant execute on function public.ai_config_get(text) to anon, authenticated;
grant execute on function public.ai_config_put(text, text, text, text, text, text, text, boolean, text) to anon, authenticated;
grant execute on function public.ai_config_clear(text, text) to anon, authenticated;
