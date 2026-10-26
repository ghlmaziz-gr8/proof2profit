-- Game Plan: a service catalog per org and AI-drafted, staff-edited plans for business owners.
-- Run once in the Supabase SQL editor (safe to re-run), after orgs.sql.
-- Everything is scoped to the caller's org. Super, admin and agency admin see all plans in their org; sales see their own.

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id),
  name text not null,
  description text,
  price numeric(12,2) not null default 0 check (price >= 0),
  unit text not null default 'one-time' check (unit in ('one-time','per month')),
  category text not null default 'Other',
  active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists services_org_idx on public.services (org_id);
alter table public.services enable row level security; -- no policies: only the functions below touch it

create table if not exists public.game_plans (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id),
  created_by text not null,
  business_slug text not null,
  business_name text not null,
  address text,
  title text,
  status text not null default 'draft' check (status in ('draft','sent')),
  content jsonb not null default '{}'::jsonb,
  snapshot jsonb not null default '{}'::jsonb,
  version int not null default 1,
  share_token text unique,
  share_enabled boolean not null default false,
  recipient_email text,
  sent_at timestamptz,
  first_opened_at timestamptz,
  last_opened_at timestamptz,
  open_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists game_plans_org_idx on public.game_plans (org_id, business_slug);
alter table public.game_plans enable row level security; -- no policies: only the functions below touch it

-- ---------- service catalog ----------
create or replace function public.list_services() returns json
language plpgsql stable security definer set search_path = public as $$
declare me public.allowed_emails; res json;
begin
  me := public._p2p_me();
  if me.email is null or me.role not in ('super','admin','agency_admin','sales') then raise exception 'not allowed' using errcode = '42501'; end if;
  select coalesce(json_agg(x order by x.category, x.name), '[]'::json) into res from (
    select s.id, s.name, s.description, s.price, s.unit, s.category, s.active from public.services s where s.org_id = me.org_id
  ) x;
  return res;
end $$;

create or replace function public.save_service(p_id uuid, p_name text, p_description text, p_price numeric, p_unit text, p_category text, p_active boolean default true) returns json
language plpgsql security definer set search_path = public as $$
declare me public.allowed_emails; nid uuid;
begin
  me := public._p2p_me();
  if me.email is null or me.role not in ('super','admin','agency_admin') then raise exception 'Only admins manage the service catalog' using errcode = '42501'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Enter a service name' using errcode = '22023'; end if;
  if p_price is null or p_price < 0 or p_price > 100000000 then raise exception 'Enter a valid price' using errcode = '22023'; end if;
  if p_unit not in ('one-time','per month') then raise exception 'Pick one-time or per month' using errcode = '22023'; end if;
  if p_id is null then
    if (select count(*) from public.services where org_id = me.org_id) >= 60 then raise exception 'The catalog is full (60 services)' using errcode = '54000'; end if;
    insert into public.services (org_id, name, description, price, unit, category, active, created_by)
    values (me.org_id, left(trim(p_name), 120), left(p_description, 600), p_price, p_unit, left(coalesce(nullif(trim(p_category), ''), 'Other'), 40), coalesce(p_active, true), me.email) returning id into nid;
  else
    update public.services set name = left(trim(p_name), 120), description = left(p_description, 600), price = p_price, unit = p_unit,
      category = left(coalesce(nullif(trim(p_category), ''), 'Other'), 40), active = coalesce(p_active, true)
    where id = p_id and org_id = me.org_id returning id into nid;
    if nid is null then raise exception 'Service not found' using errcode = 'P0002'; end if;
  end if;
  return json_build_object('ok', true, 'id', nid);
end $$;

create or replace function public.delete_service(p_id uuid) returns json
language plpgsql security definer set search_path = public as $$
declare me public.allowed_emails;
begin
  me := public._p2p_me();
  if me.email is null or me.role not in ('super','admin','agency_admin') then raise exception 'Only admins manage the service catalog' using errcode = '42501'; end if;
  delete from public.services where id = p_id and org_id = me.org_id;
  return json_build_object('ok', true);
end $$;

-- ---------- plans ----------
create or replace function public._gp_can(me public.allowed_emails, p public.game_plans) returns boolean
language sql immutable as $$
  select p.org_id = me.org_id and (me.role in ('super','admin','agency_admin') or (me.role = 'sales' and lower(p.created_by) = lower(me.email)))
$$;

create or replace function public.list_plans(p_slug text default null) returns json
language plpgsql stable security definer set search_path = public as $$
declare me public.allowed_emails; res json;
begin
  me := public._p2p_me();
  if me.email is null or me.role not in ('super','admin','agency_admin','sales') then raise exception 'not allowed' using errcode = '42501'; end if;
  select coalesce(json_agg(x order by x.updated_at desc), '[]'::json) into res from (
    select g.id, g.business_slug, g.business_name, g.address, g.title, g.status, g.version, g.created_by, g.recipient_email,
           g.share_enabled, g.sent_at, g.first_opened_at, g.last_opened_at, g.open_count, g.created_at, g.updated_at
    from public.game_plans g
    where g.org_id = me.org_id and (me.role in ('super','admin','agency_admin') or lower(g.created_by) = lower(me.email))
      and (p_slug is null or g.business_slug = p_slug)
  ) x;
  return res;
end $$;

create or replace function public.get_plan(p_id uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare me public.allowed_emails; g public.game_plans;
begin
  me := public._p2p_me();
  if me.email is null or me.role not in ('super','admin','agency_admin','sales') then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into g from public.game_plans where id = p_id;
  if g.id is null or not public._gp_can(me, g) then raise exception 'Plan not found' using errcode = 'P0002'; end if;
  return json_build_object('id', g.id, 'business_slug', g.business_slug, 'business_name', g.business_name, 'address', g.address, 'title', g.title,
    'status', g.status, 'content', g.content, 'snapshot', g.snapshot, 'version', g.version, 'created_by', g.created_by,
    'recipient_email', g.recipient_email, 'share_enabled', g.share_enabled, 'sent_at', g.sent_at, 'open_count', g.open_count, 'updated_at', g.updated_at);
end $$;

create or replace function public.save_plan(p_id uuid, p_slug text, p_name text, p_address text, p_title text, p_content jsonb, p_snapshot jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare me public.allowed_emails; g public.game_plans; nid uuid;
begin
  me := public._p2p_me();
  if me.email is null or me.role not in ('super','admin','agency_admin','sales') then raise exception 'not allowed' using errcode = '42501'; end if;
  if jsonb_typeof(p_content) <> 'object' or length(p_content::text) > 80000 then raise exception 'That plan is too large' using errcode = '22023'; end if;
  if p_snapshot is not null and (jsonb_typeof(p_snapshot) <> 'object' or length(p_snapshot::text) > 20000) then raise exception 'Snapshot too large' using errcode = '22023'; end if;
  if p_id is null then
    if coalesce(trim(p_slug), '') = '' or coalesce(trim(p_name), '') = '' then raise exception 'Pick a business first' using errcode = '22023'; end if;
    if (select count(*) from public.game_plans where org_id = me.org_id and lower(created_by) = lower(me.email)) >= 300 then raise exception 'Too many plans' using errcode = '54000'; end if;
    insert into public.game_plans (org_id, created_by, business_slug, business_name, address, title, content, snapshot)
    values (me.org_id, me.email, left(p_slug, 120), left(p_name, 160), left(p_address, 200), left(p_title, 160), p_content, coalesce(p_snapshot, '{}'::jsonb)) returning id into nid;
  else
    select * into g from public.game_plans where id = p_id;
    if g.id is null or not public._gp_can(me, g) then raise exception 'Plan not found' using errcode = 'P0002'; end if;
    if g.status <> 'draft' then raise exception 'This plan was already sent and is frozen. Create a new version to change it.' using errcode = '22023'; end if;
    update public.game_plans set title = left(p_title, 160), content = p_content, snapshot = coalesce(p_snapshot, snapshot), updated_at = now() where id = p_id;
    nid := p_id;
  end if;
  return json_build_object('ok', true, 'id', nid);
end $$;

-- Copy a plan (usually a sent one) into a new editable draft with the next version number.
create or replace function public.new_plan_version(p_id uuid) returns json
language plpgsql security definer set search_path = public as $$
declare me public.allowed_emails; g public.game_plans; nid uuid; v int;
begin
  me := public._p2p_me();
  if me.email is null or me.role not in ('super','admin','agency_admin','sales') then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into g from public.game_plans where id = p_id;
  if g.id is null or not public._gp_can(me, g) then raise exception 'Plan not found' using errcode = 'P0002'; end if;
  select coalesce(max(version), 0) + 1 into v from public.game_plans where org_id = g.org_id and business_slug = g.business_slug;
  insert into public.game_plans (org_id, created_by, business_slug, business_name, address, title, content, snapshot, version)
  values (g.org_id, me.email, g.business_slug, g.business_name, g.address, g.title, g.content, g.snapshot, v) returning id into nid;
  return json_build_object('ok', true, 'id', nid, 'version', v);
end $$;

create or replace function public.delete_plan(p_id uuid) returns json
language plpgsql security definer set search_path = public as $$
declare me public.allowed_emails; g public.game_plans;
begin
  me := public._p2p_me();
  if me.email is null or me.role not in ('super','admin','agency_admin','sales') then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into g from public.game_plans where id = p_id;
  if g.id is null or not public._gp_can(me, g) then raise exception 'Plan not found' using errcode = 'P0002'; end if;
  delete from public.game_plans where id = p_id;
  return json_build_object('ok', true);
end $$;

revoke all on function public.list_services(), public.save_service(uuid, text, text, numeric, text, text, boolean), public.delete_service(uuid),
  public.list_plans(text), public.get_plan(uuid), public.save_plan(uuid, text, text, text, text, jsonb, jsonb), public.new_plan_version(uuid), public.delete_plan(uuid) from public, anon;
grant execute on function public.list_services(), public.save_service(uuid, text, text, numeric, text, text, boolean), public.delete_service(uuid),
  public.list_plans(text), public.get_plan(uuid), public.save_plan(uuid, text, text, text, text, jsonb, jsonb), public.new_plan_version(uuid), public.delete_plan(uuid) to authenticated;
