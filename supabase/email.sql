-- Email notifications: a queue (email_outbox), triggers that fill it, and two guarded functions
-- the Cloudflare Worker uses to claim and finish sends. Secrets stay in the Worker.
create table if not exists public.app_secrets (name text primary key, hash text not null);
alter table public.app_secrets enable row level security;

create table if not exists public.email_outbox (
  id bigint generated always as identity primary key,
  user_id uuid, to_email text not null, kind text not null, subject text not null, html text not null,
  status text not null default 'pending', attempts int not null default 0, error text,
  created_at timestamptz not null default now(), claimed_at timestamptz, sent_at timestamptz
);
alter table public.email_outbox enable row level security;

create or replace function public.email_html(heading text, body text, cta text, url text) returns text
language sql immutable as $$
  select '<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1f2430"><h2 style="margin:0 0 12px;color:#111">' || heading || '</h2><p style="font-size:15px;line-height:1.5">' || body || '</p><p style="margin:24px 0"><a href="' || url || '" style="background:#f59e0b;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:bold">' || cta || '</a></p><p style="font-size:12px;color:#6b7280">You can choose which emails you get from your profile in the portal (click your name at the top left).</p><p style="font-size:12px;color:#6b7280">Proof to Profit</p></div>'
$$;

create or replace function public.queue_email(p_user uuid, p_to text, p_kind text, p_subject text, p_html text) returns void
language sql security definer set search_path = public as $$
  insert into public.email_outbox (user_id, to_email, kind, subject, html) values (p_user, p_to, p_kind, p_subject, p_html)
$$;
revoke all on function public.queue_email(uuid, text, text, text, text) from public, anon, authenticated;

-- 1) Access granted: email the invitee when their address is added to the list.
create or replace function public.trg_allowed_email() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.queue_email(null, new.email, 'welcome', 'You are invited to Proof to Profit',
    public.email_html('You are in', 'You have been given access to Proof to Profit. Sign in with Google using this email address (' || new.email || ') to analyze businesses, save reports, and see what changes over time.', 'Open Proof to Profit', 'https://app.proof2profit.site'));
  return new;
end $$;
drop trigger if exists allowed_email_welcome on public.allowed_emails;
create trigger allowed_email_welcome after insert on public.allowed_emails for each row execute function public.trg_allowed_email();

-- 2) Limit and alert notifications also go out by email (when the user's email preference is on).
create or replace function public.trg_notification_email() returns trigger
language plpgsql security definer set search_path = public as $$
declare em text; wants boolean;
begin
  if new.kind not in ('limit', 'alert') then return new; end if;
  select coalesce((prefs ->> 'email')::boolean, true) into wants from public.profiles where user_id = new.user_id;
  if not coalesce(wants, true) then return new; end if;
  select email into em from auth.users where id = new.user_id;
  if em is null then return new; end if;
  perform public.queue_email(new.user_id, em, 'notify', 'New notification from Proof to Profit',
    public.email_html('You have a new notification', 'Something new is waiting for you in Proof to Profit. Open the portal and click the bell to read it.', 'Open Proof to Profit', 'https://app.proof2profit.site'));
  return new;
end $$;
drop trigger if exists notification_email on public.notifications;
create trigger notification_email after insert on public.notifications for each row execute function public.trg_notification_email();

-- 3) Weekly summary (run by pg_cron, Mondays 13:00 UTC).
create or replace function public.enqueue_weekly() returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; saved int; alerts int; msg text;
begin
  for r in
    select p.user_id, u.email,
           coalesce((p.prefs ->> 'weekly')::boolean, true) as w,
           coalesce((p.prefs ->> 'email')::boolean, true) as e
    from public.profiles p join auth.users u on u.id = p.user_id
    where exists (select 1 from public.allowed_emails a where lower(a.email) = lower(u.email))
  loop
    if not r.w then continue; end if;
    saved := coalesce((select case when jsonb_typeof(k.value) = 'array' then jsonb_array_length(k.value) else 0 end
                       from public.kv k where k.user_id = r.user_id and k.key = 'reviewlens_saved_index'), 0);
    if saved = 0 then continue; end if;
    alerts := (select count(*) from public.notifications x where x.user_id = r.user_id and x.kind = 'alert' and x.created_at > now() - interval '7 days');
    msg := 'You have ' || saved || ' saved ' || case when saved = 1 then 'business' else 'businesses' end || ' in Proof to Profit. ' ||
           case when alerts = 0 then 'No changes were detected this week. Re-run an analysis to check for new feedback.'
                else alerts || ' change ' || case when alerts = 1 then 'alert was' else 'alerts were' end || ' recorded this week.' end;
    insert into public.notifications (user_id, kind, title, body) values (r.user_id, 'weekly', 'Your weekly summary', msg);
    if r.e then
      perform public.queue_email(r.user_id, r.email, 'weekly', 'Your weekly Proof to Profit summary',
        public.email_html('Your weekly summary', msg, 'Open Proof to Profit', 'https://app.proof2profit.site'));
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.enqueue_weekly() from public, anon, authenticated;

-- Worker access: claim pending emails, then report results. Guarded by a secret whose hash is stored in app_secrets.
create or replace function public.claim_outbox(p_secret text, p_limit int default 20) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare ok boolean; res json;
begin
  select exists (select 1 from public.app_secrets where name = 'outbox' and hash = encode(digest(p_secret, 'sha256'), 'hex')) into ok;
  if not ok then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.email_outbox set status = 'pending' where status = 'sending' and claimed_at < now() - interval '15 minutes';
  with c as (
    select id from public.email_outbox where status = 'pending' and attempts < 5 order by id limit least(p_limit, 50) for update skip locked
  ), u as (
    update public.email_outbox o set status = 'sending', attempts = o.attempts + 1, claimed_at = now()
    from c where o.id = c.id returning o.id, o.to_email, o.subject, o.html
  )
  select coalesce(json_agg(u), '[]'::json) into res from u;
  return res;
end $$;

create or replace function public.finish_outbox(p_secret text, p_results jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare ok boolean; item jsonb;
begin
  select exists (select 1 from public.app_secrets where name = 'outbox' and hash = encode(digest(p_secret, 'sha256'), 'hex')) into ok;
  if not ok then raise exception 'forbidden' using errcode = '42501'; end if;
  for item in select * from jsonb_array_elements(p_results) loop
    update public.email_outbox set
      status = case when (item ->> 'ok')::boolean then 'sent' when attempts >= 5 then 'failed' else 'pending' end,
      error = item ->> 'error',
      sent_at = case when (item ->> 'ok')::boolean then now() else null end
    where id = (item ->> 'id')::bigint;
  end loop;
end $$;
revoke all on function public.claim_outbox(text, int) from public;
revoke all on function public.finish_outbox(text, jsonb) from public;
grant execute on function public.claim_outbox(text, int) to anon, authenticated;
grant execute on function public.finish_outbox(text, jsonb) to anon, authenticated;
