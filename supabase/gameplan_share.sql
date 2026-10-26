-- Game Plan sharing: email the plan with a private read-only link, public page lookup, on/off switch.
-- Run once in the Supabase SQL editor (safe to re-run), after gameplan.sql and share_cc.sql.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.plan_email_html(p_who text, p_org text, p_biz text, p_title text, p_note text, p_link text, p_snap jsonb, p_content jsonb) returns text
language plpgsql immutable set search_path = public as $fn$
declare
  e text := ''; it jsonb; i int := 0; sm text; inv jsonb; tot text := '';
begin
  sm := left(coalesce(p_content #>> '{standing,summary}', ''), 500);
  for it in select * from jsonb_array_elements(coalesce(p_content -> 'priorities', '[]'::jsonb)) loop
    i := i + 1; exit when i > 5;
    e := e || '<tr><td valign="top" style="padding:8px 10px 8px 0;font-size:14px;font-weight:bold;color:#C26A00;width:22px">' || i || '</td><td style="padding:8px 0;border-bottom:1px solid #EFE9DE;font-size:14px;line-height:20px;color:#26231F"><b>' || public.p2p_esc(left(it ->> 'title', 140)) || '</b><br><span style="color:#5E5A54">' || public.p2p_esc(left(coalesce(it ->> 'why', ''), 220)) || '</span></td></tr>';
  end loop;
  inv := p_content -> 'investment';
  if inv is not null and coalesce((inv ->> 'total_90')::numeric, 0) > 0 then
    tot := '<p style="margin:16px 0 0;font-size:14px;color:#26231F"><b>Investment:</b> ' ||
      concat_ws(' + ', case when coalesce((inv ->> 'total_once')::numeric, 0) > 0 then '$' || trim(to_char((inv ->> 'total_once')::numeric, 'FM999,999,990.##')) || ' one-time' end,
                       case when coalesce((inv ->> 'total_monthly')::numeric, 0) > 0 then '$' || trim(to_char((inv ->> 'total_monthly')::numeric, 'FM999,999,990.##')) || ' per month' end) || '</p>';
  end if;
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>Game Plan</title><style>a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}.hl a{color:#B9B4AA!important;text-decoration:none!important}</style></head><body style="margin:0;padding:0;background:#F3EEE6">'
    || '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#F3EEE6">' || public.p2p_esc(p_who) || ' prepared a 90-day Game Plan for ' || public.p2p_esc(p_biz) || '.</div>'
    || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3EEE6"><tr><td align="center" style="padding:24px 12px">'
    || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#FFFFFF;border-radius:20px;overflow:hidden;border:1px solid #E6DFD3;font-family:Arial,Helvetica,sans-serif">'
    || '<tr><td style="background:#14161A;padding:22px 28px"><div style="font-size:12px;letter-spacing:.16em;font-weight:bold;color:#F5B041">PROOF TO PROFIT</div><div style="font-size:24px;line-height:30px;font-weight:bold;color:#FFFFFF;margin-top:8px">' || public.p2p_esc(coalesce(nullif(p_title, ''), 'Game Plan for ' || p_biz)) || '</div><div class="hl" style="font-size:13px;color:#B9B4AA;margin-top:4px">90-day growth plan for ' || public.p2p_esc(p_biz) || '</div></td></tr>'
    || '<tr><td style="padding:22px 28px 6px;font-size:14px;line-height:21px;color:#3B3A37"><b>' || public.p2p_esc(p_who) || '</b>' || case when coalesce(p_org, '') <> '' then ' at ' || public.p2p_esc(p_org) else '' end || ' prepared this plan for you.'
    || case when coalesce(trim(p_note), '') <> '' then '<div style="margin-top:12px;background:#FAF6EE;border:1px solid #E6DFD3;border-radius:12px;padding:12px 14px;color:#5E5A54">&ldquo;' || public.p2p_esc(left(trim(p_note), 600)) || '&rdquo;</div>' else '' end
    || '</td></tr>'
    || '<tr><td style="padding:6px 28px 8px">'
    || case when p_snap ->> 'overall' is not null then '<p style="margin:10px 0 4px;font-size:13px;color:#7A756C">Where you stand today</p><p style="margin:0;font-size:30px;font-weight:bold;color:#14161A">' || public.p2p_esc(p_snap ->> 'overall') || '<span style="font-size:14px;color:#7A756C;font-weight:normal"> / 100 business health</span></p>' else '' end
    || case when sm <> '' then '<p style="margin:8px 0 0;font-size:14px;line-height:21px;color:#3B3A37">' || public.p2p_esc(sm) || '</p>' else '' end
    || case when i > 0 then '<p style="margin:18px 0 4px;font-size:12px;letter-spacing:.1em;font-weight:bold;color:#7A756C">PRIORITY FIXES</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0">' || e || '</table>' else '' end
    || tot || '</td></tr>'
    || '<tr><td align="center" style="padding:18px 28px 28px"><a href="' || p_link || '" style="display:inline-block;background:#F59E0B;color:#FFFFFF;text-decoration:none;font-weight:bold;font-size:15px;padding:13px 26px;border-radius:12px">View your full Game Plan</a><p style="margin:12px 0 0;font-size:12px;color:#7A756C">No sign-in needed. This private link is just for you.</p></td></tr>'
    || '<tr><td style="background:#FAF6EE;border-top:1px solid #E6DFD3;padding:16px 28px;font-size:12px;line-height:18px;color:#7A756C">Scores are AI estimates based on public review, website and social patterns &mdash; a starting point, not an audit. Sent by Proof to Profit on behalf of ' || public.p2p_esc(p_who) || '. Replying to this message will not reach them; contact them directly.</td></tr>'
    || '</table></td></tr></table></body></html>';
end $fn$;
revoke all on function public.plan_email_html(text, text, text, text, text, text, jsonb, jsonb) from public, anon, authenticated;

-- Send (or resend) a plan. Freezes it, creates the private link on first send.
create or replace function public.share_plan(p_id uuid, p_to text, p_note text, p_base text) returns json
language plpgsql security definer set search_path = public as $$
declare
  me public.allowed_emails; g public.game_plans; addr text; who text; org text; tok text; link text; used int; subj text; html text;
begin
  me := public._p2p_me();
  if me.email is null or auth.uid() is null or me.role not in ('super','admin','agency_admin','sales') then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into g from public.game_plans where id = p_id;
  if g.id is null or not public._gp_can(me, g) then raise exception 'Plan not found' using errcode = 'P0002'; end if;
  addr := lower(trim(coalesce(p_to, '')));
  if addr !~ '^[a-z0-9._%+''-]+@[a-z0-9.-]+\.[a-z]{2,}$' or length(addr) > 120 then raise exception 'Enter a valid email address' using errcode = '22023'; end if;
  if coalesce(p_base, '') !~ '^https://[a-z0-9.-]+(:[0-9]+)?$' then raise exception 'Bad link base' using errcode = '22023'; end if;
  select count(*) into used from public.email_outbox where user_id = auth.uid() and kind = 'plan' and created_at > now() - interval '1 day';
  if used >= 20 then raise exception 'Daily sending limit reached. Try again tomorrow.' using errcode = '54000'; end if;

  tok := coalesce(g.share_token, encode(extensions.gen_random_bytes(24), 'hex'));
  link := p_base || '/plan.html?t=' || tok;
  select coalesce(nullif(trim(p.display_name), ''), split_part(me.email, '@', 1)) into who from public.profiles p where p.user_id = auth.uid();
  who := coalesce(who, split_part(me.email, '@', 1));
  select name into org from public.orgs where id = g.org_id;
  subj := who || ' prepared a Game Plan for ' || g.business_name;
  html := public.plan_email_html(who, org, g.business_name, g.title, p_note, link, g.snapshot, g.content);
  perform public.queue_email(auth.uid(), addr, 'plan', subj, html, case when lower(me.email) = addr then null else lower(me.email) end);
  update public.game_plans set status = 'sent', share_token = tok, share_enabled = true, recipient_email = addr,
    sent_at = coalesce(sent_at, now()), updated_at = now() where id = g.id;
  return json_build_object('ok', true, 'link', link);
end $$;

-- Staff: get the link for a sent plan (to copy) and switch it on or off.
create or replace function public.plan_link(p_id uuid, p_base text) returns json
language plpgsql stable security definer set search_path = public as $$
declare me public.allowed_emails; g public.game_plans;
begin
  me := public._p2p_me();
  if me.email is null or me.role not in ('super','admin','agency_admin','sales') then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into g from public.game_plans where id = p_id;
  if g.id is null or not public._gp_can(me, g) then raise exception 'Plan not found' using errcode = 'P0002'; end if;
  if g.share_token is null then return json_build_object('link', null); end if;
  if coalesce(p_base, '') !~ '^https://[a-z0-9.-]+(:[0-9]+)?$' then raise exception 'Bad link base' using errcode = '22023'; end if;
  return json_build_object('link', p_base || '/plan.html?t=' || g.share_token, 'enabled', g.share_enabled);
end $$;

create or replace function public.set_plan_sharing(p_id uuid, p_enabled boolean) returns json
language plpgsql security definer set search_path = public as $$
declare me public.allowed_emails; g public.game_plans;
begin
  me := public._p2p_me();
  if me.email is null or me.role not in ('super','admin','agency_admin','sales') then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into g from public.game_plans where id = p_id;
  if g.id is null or not public._gp_can(me, g) then raise exception 'Plan not found' using errcode = 'P0002'; end if;
  update public.game_plans set share_enabled = coalesce(p_enabled, false) where id = g.id;
  return json_build_object('ok', true, 'enabled', coalesce(p_enabled, false));
end $$;

-- Public (no sign-in): the owner's page. Only returns a sent plan whose link is switched on.
create or replace function public.public_plan(p_token text, p_count boolean default true) returns json
language plpgsql security definer set search_path = public as $$
declare g public.game_plans; org text; who text;
begin
  if coalesce(p_token, '') !~ '^[a-f0-9]{48}$' then return null; end if;
  select * into g from public.game_plans where share_token = p_token and share_enabled and status = 'sent';
  if g.id is null then return null; end if;
  if p_count then
    update public.game_plans set open_count = open_count + 1, last_opened_at = now(), first_opened_at = coalesce(first_opened_at, now()) where id = g.id;
  end if;
  select name into org from public.orgs where id = g.org_id;
  select coalesce(nullif(trim(p.display_name), ''), split_part(g.created_by, '@', 1)) into who
    from auth.users u join public.profiles p on p.user_id = u.id where lower(u.email) = lower(g.created_by) limit 1;
  return json_build_object('business_name', g.business_name, 'address', g.address, 'title', g.title, 'content', g.content, 'snapshot', g.snapshot,
    'sent_at', g.sent_at, 'prepared_by', coalesce(who, split_part(g.created_by, '@', 1)), 'org', org);
end $$;

revoke all on function public.share_plan(uuid, text, text, text), public.plan_link(uuid, text), public.set_plan_sharing(uuid, boolean) from public, anon;
grant execute on function public.share_plan(uuid, text, text, text), public.plan_link(uuid, text), public.set_plan_sharing(uuid, boolean) to authenticated;
revoke all on function public.public_plan(text, boolean) from public;
grant execute on function public.public_plan(text, boolean) to anon, authenticated;
