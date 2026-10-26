-- Share an analysis or a comparison by email.
-- The browser sends only structured report data; the email HTML is built here with every value escaped,
-- so nobody can push arbitrary HTML out of our sending domain. Safe to re-run.

-- "Unknown"/empty values show as "not available" in shared emails
create or replace function public.p2p_na(v text) returns text language sql immutable as $$
  select case when v is null or btrim(v) = '' or lower(btrim(v)) in ('unknown', 'n/a', '—') then null else v end
$$;

create or replace function public.p2p_escn(v text) returns text language sql immutable as $$
  select case when v is null then null else public.p2p_esc(v) end
$$;

create or replace function public.p2p_score_color(s numeric) returns text language sql immutable as $$
  select case when s >= 75 then '#1F9D74' when s >= 50 then '#E0A21B' else '#D9534F' end
$$;
create or replace function public.p2p_score_label(s numeric) returns text language sql immutable as $$
  select case when s >= 85 then 'Strongest' when s >= 70 then 'Strong' when s >= 50 then 'Mixed' else 'Needs attention' end
$$;

-- one horizontal bar as an email-safe table
create or replace function public.p2p_bar(p_score numeric, p_color text) returns text language sql immutable as $$
  select '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>'
    || '<td style="background:#ECE5D9;border-radius:6px;height:10px;font-size:0;line-height:0"><table role="presentation" width="' || greatest(2, least(100, round(coalesce(p_score, 0)))) || '%" cellpadding="0" cellspacing="0"><tr><td style="background:' || p_color || ';border-radius:6px;height:10px;font-size:0;line-height:0">&nbsp;</td></tr></table></td></tr></table>'
$$;

create or replace function public.p2p_li(p_arr jsonb, p_color text) returns text language plpgsql immutable set search_path = public as $$
declare r text := ''; v text; n int := 0;
begin
  if jsonb_typeof(p_arr) <> 'array' then return ''; end if;
  for v in select left(value #>> '{}', 300) from jsonb_array_elements(p_arr) loop
    n := n + 1; exit when n > 6;
    r := r || '<tr><td width="18" valign="top" style="padding:3px 0;color:' || p_color || ';font-size:15px;line-height:20px">&bull;</td><td style="padding:3px 0;font-size:14px;line-height:20px;color:#3B3A37">' || public.p2p_esc(v) || '</td></tr>';
  end loop;
  return case when r = '' then '' else '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' || r || '</table>' end;
end $$;

create or replace function public.p2p_h(p_text text, p_color text default '#14161A') returns text language sql immutable as $$
  select '<p style="margin:26px 0 8px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;font-weight:bold;color:' || p_color || '">' || public.p2p_esc(p_text) || '</p>'
$$;

create or replace function public.share_email_html(p_who text, p_note text, p_kind text, p_a jsonb, p_b jsonb) returns text
language plpgsql immutable set search_path = public as $fn$
declare
  body text := ''; head text; sub text; a jsonb; asp jsonb; nm text; sc numeric; sa numeric; sb_ numeric;
  names text[]; k text; aw int := 0; bw int := 0; verdict text; learn text := ''; ln int := 0; an text; bn text;
begin
  if p_kind = 'compare' then
    an := coalesce(nullif(left(p_a ->> 'name', 80), ''), 'Business A'); bn := coalesce(nullif(left(p_b ->> 'name', 80), ''), 'Business B');
    head := an || ' vs ' || bn;
    sub := 'Side-by-side review comparison';
    body := '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
      || '<td width="50%" valign="top" style="padding:0 6px 0 0"><div style="background:#FFF4E2;border:1px solid #F3D9AC;border-radius:14px;padding:14px"><div style="font-size:11px;font-weight:bold;color:#C97A00;letter-spacing:.1em">A</div><div style="font-size:16px;font-weight:bold;color:#14161A;margin-top:2px">' || public.p2p_esc(an) || '</div><div style="font-size:13px;color:#5E5A54;margin-top:4px">' || coalesce(public.p2p_escn(public.p2p_na(p_a ->> 'rating')) || ' / 5', 'Rating not available') || ' &middot; ' || coalesce(public.p2p_escn(public.p2p_na(p_a ->> 'review_count')) || ' reviews', 'review count not available') || '</div></div></td>'
      || '<td width="50%" valign="top" style="padding:0 0 0 6px"><div style="background:#E8F4F4;border:1px solid #BFDDDD;border-radius:14px;padding:14px"><div style="font-size:11px;font-weight:bold;color:#1F7A7A;letter-spacing:.1em">B</div><div style="font-size:16px;font-weight:bold;color:#14161A;margin-top:2px">' || public.p2p_esc(bn) || '</div><div style="font-size:13px;color:#5E5A54;margin-top:4px">' || coalesce(public.p2p_escn(public.p2p_na(p_b ->> 'rating')) || ' / 5', 'Rating not available') || ' &middot; ' || coalesce(public.p2p_escn(public.p2p_na(p_b ->> 'review_count')) || ' reviews', 'review count not available') || '</div></div></td></tr></table>';

    select array_agg(g.nme order by g.o) into names from (
      select q.nme, min(q.o) as o from (
        select left(value ->> 'name', 60) as nme, ord as o from jsonb_array_elements(case when jsonb_typeof(p_a -> 'aspects') = 'array' then p_a -> 'aspects' else '[]'::jsonb end) with ordinality as t(value, ord)
        union all
        select left(value ->> 'name', 60), 1000 + ord from jsonb_array_elements(case when jsonb_typeof(p_b -> 'aspects') = 'array' then p_b -> 'aspects' else '[]'::jsonb end) with ordinality as t(value, ord)) q
      where q.nme is not null group by q.nme) g;
    body := body || public.p2p_h('Aspect comparison');
    foreach k in array coalesce(names, array[]::text[]) loop
      ln := ln + 1; exit when ln > 12;
      select nullif(value ->> 'score', '')::numeric into sa from jsonb_array_elements(case when jsonb_typeof(p_a -> 'aspects') = 'array' then p_a -> 'aspects' else '[]'::jsonb end) where left(value ->> 'name', 60) = k limit 1;
      select nullif(value ->> 'score', '')::numeric into sb_ from jsonb_array_elements(case when jsonb_typeof(p_b -> 'aspects') = 'array' then p_b -> 'aspects' else '[]'::jsonb end) where left(value ->> 'name', 60) = k limit 1;
      if sa is not null and sb_ is not null then
        if sa - sb_ >= 12 then aw := aw + 1; if length(learn) < 400 and aw + bw <= 3 then learn := learn || public.p2p_esc(bn) || ' could take cues from ' || public.p2p_esc(an) || ' on ' || public.p2p_esc(lower(k)) || '. '; end if;
        elsif sb_ - sa >= 12 then bw := bw + 1; if length(learn) < 400 and aw + bw <= 3 then learn := learn || public.p2p_esc(an) || ' could take cues from ' || public.p2p_esc(bn) || ' on ' || public.p2p_esc(lower(k)) || '. '; end if;
        end if;
      end if;
      body := body || '<div style="margin:0 0 14px"><div style="font-size:14px;font-weight:bold;color:#14161A;margin-bottom:6px">' || public.p2p_esc(k) || '</div>'
        || case when sa is not null then '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:5px"><tr><td width="22" style="font-size:12px;font-weight:bold;color:#C97A00">A</td><td>' || public.p2p_bar(sa, '#E8943A') || '</td><td width="34" align="right" style="font-size:13px;font-weight:bold;color:#14161A">' || round(sa) || '</td></tr></table>' else '' end
        || case when sb_ is not null then '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="22" style="font-size:12px;font-weight:bold;color:#1F7A7A">B</td><td>' || public.p2p_bar(sb_, '#2E8F8F') || '</td><td width="34" align="right" style="font-size:13px;font-weight:bold;color:#14161A">' || round(sb_) || '</td></tr></table>' else '' end
        || '</div>';
      sa := null; sb_ := null;
    end loop;

    body := body || public.p2p_h('What guests love', '#0B6B54')
      || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="50%" valign="top" style="padding-right:8px"><div style="font-size:13px;font-weight:bold;margin-bottom:4px">' || public.p2p_esc(an) || '</div>' || public.p2p_li(p_a -> 'likes', '#1F9D74') || '</td><td width="50%" valign="top" style="padding-left:8px"><div style="font-size:13px;font-weight:bold;margin-bottom:4px">' || public.p2p_esc(bn) || '</div>' || public.p2p_li(p_b -> 'likes', '#1F9D74') || '</td></tr></table>'
      || public.p2p_h('Where each slips', '#B4442F')
      || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="50%" valign="top" style="padding-right:8px"><div style="font-size:13px;font-weight:bold;margin-bottom:4px">' || public.p2p_esc(an) || '</div>' || public.p2p_li(p_a -> 'dislikes', '#D9534F') || '</td><td width="50%" valign="top" style="padding-left:8px"><div style="font-size:13px;font-weight:bold;margin-bottom:4px">' || public.p2p_esc(bn) || '</div>' || public.p2p_li(p_b -> 'dislikes', '#D9534F') || '</td></tr></table>';

    verdict := case when aw > bw then '<b>' || public.p2p_esc(an) || '</b> comes out ahead, leading on ' || aw || ' aspect' || case when aw = 1 then '' else 's' end || ' vs ' || bw || ' for ' || public.p2p_esc(bn) || '.'
                    when bw > aw then '<b>' || public.p2p_esc(bn) || '</b> comes out ahead, leading on ' || bw || ' aspect' || case when bw = 1 then '' else 's' end || ' vs ' || aw || ' for ' || public.p2p_esc(an) || '.'
                    else public.p2p_esc(an) || ' and ' || public.p2p_esc(bn) || ' are closely matched overall, each leading in different areas.' end;
    body := body || '<div style="margin-top:26px;background:#14161A;color:#F3EEE6;border-radius:14px;padding:16px 18px;font-size:14px;line-height:1.6"><div style="font-size:11px;letter-spacing:.12em;font-weight:bold;color:#F5B041;margin-bottom:6px">VERDICT</div>' || verdict || case when learn <> '' then '<br><br>' || learn else '' end || '</div>';
  else
    a := p_a;
    head := coalesce(nullif(left(a ->> 'name', 80), ''), 'Business analysis');
    sub := coalesce(nullif(left(a ->> 'address', 120), ''), 'Review analysis');
    body := '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
      || '<td width="50%" style="padding-right:6px"><div style="background:#FFF4E2;border:1px solid #F3D9AC;border-radius:14px;padding:14px"><div style="font-size:11px;font-weight:bold;color:#C97A00;letter-spacing:.1em">' || case when public.p2p_na(a ->> 'rating') is null and public.p2p_na(a ->> 'ai_rating') is not null then 'AI RATING' else 'RATING' end || '</div><div style="font-size:26px;font-weight:bold;color:#14161A">' || coalesce(public.p2p_escn(coalesce(public.p2p_na(a ->> 'rating'), public.p2p_na(a ->> 'ai_rating'))) || '<span style="font-size:13px;color:#7A756C"> / 5</span>', '<span style="font-size:15px;color:#7A756C">Not available</span>') || '</div></div></td>'
      || '<td width="50%" style="padding-left:6px"><div style="background:#E8F4F4;border:1px solid #BFDDDD;border-radius:14px;padding:14px"><div style="font-size:11px;font-weight:bold;color:#1F7A7A;letter-spacing:.1em">' || case when public.p2p_na(a ->> 'review_count') is null and public.p2p_na(a ->> 'themes') is not null then 'THEMES FOUND' else 'REVIEW VOLUME' end || '</div><div style="font-size:26px;font-weight:bold;color:#14161A">' || coalesce(public.p2p_escn(coalesce(public.p2p_na(a ->> 'review_count'), public.p2p_na(a ->> 'themes'))), '<span style="font-size:15px;color:#7A756C">Not available</span>') || '</div></div></td></tr></table>'
      || case when public.p2p_na(a ->> 'rating') is null or public.p2p_na(a ->> 'review_count') is null then '<p style="margin:12px 0 0;font-size:12.5px;line-height:18px;color:#7A756C">Google&rsquo;s star rating and review count were not available for this business, so these are AI measures: the AI rating is the overall business health score shown out of 5, and themes found counts what guests praise and criticise.</p>' else '' end;
    if jsonb_typeof(a -> 'extras' -> 'overall') = 'object' then
      sc := nullif(a -> 'extras' -> 'overall' ->> 'score', '')::numeric;
      body := body || public.p2p_h('Overall business health')
        || '<p style="margin:0 0 10px;font-size:14px;line-height:21px;color:#3B3A37"><b style="font-size:30px;color:' || public.p2p_score_color(coalesce(sc, 0)) || '">' || coalesce(round(sc)::text, '–') || '</b> / 100 &middot; ' || public.p2p_score_label(coalesce(sc, 0))
        || case when (a -> 'extras' -> 'overall' ->> 'complete') = 'true' then '' else ' &middot; provisional, not every area has been checked' end || '</p>';
      if jsonb_typeof(a -> 'extras' -> 'overall' -> 'parts') = 'array' then
        for asp in select value from jsonb_array_elements(a -> 'extras' -> 'overall' -> 'parts') limit 3 loop
          sa := nullif(asp ->> 'score', '')::numeric; continue when sa is null;
          body := body || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:6px"><tr><td style="font-size:13px;color:#3B3A37">' || public.p2p_esc(coalesce(left(asp ->> 'name', 30), '')) || ' <span style="color:#7A756C">(counts ' || coalesce(left(asp ->> 'weight', 3), '') || '%)</span></td><td align="right" style="font-size:13px;font-weight:bold;color:' || public.p2p_score_color(sa) || '">' || round(sa) || '</td></tr></table>' || public.p2p_bar(sa, public.p2p_score_color(sa));
        end loop;
      end if;
      if coalesce(a -> 'extras' -> 'overall' ->> 'weak', '') <> '' and coalesce(nullif(a -> 'extras' -> 'overall' ->> 'gain', '')::numeric, 0) > 0 then
        body := body || '<p style="margin:10px 0 0;font-size:13.5px;line-height:20px;color:#7A4A10;background:#FEF3E2;border-radius:10px;padding:10px 12px"><b>Biggest opening: ' || public.p2p_esc(left(a -> 'extras' -> 'overall' ->> 'weak', 30)) || '.</b> Getting it to 80 would lift the overall score by about ' || (a -> 'extras' -> 'overall' ->> 'gain') || ' points.</p>';
      end if;
    end if;
    body := body || public.p2p_h('Aspect breakdown');
    if jsonb_typeof(a -> 'aspects') = 'array' then
      for asp in select value from jsonb_array_elements(a -> 'aspects') limit 12 loop
        sc := nullif(asp ->> 'score', '')::numeric; continue when sc is null;
        body := body || '<div style="margin:0 0 14px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:6px"><tr><td style="font-size:14px;font-weight:bold;color:#14161A">' || public.p2p_esc(left(asp ->> 'name', 60)) || '</td><td align="right" style="font-size:12px;font-weight:bold;color:' || public.p2p_score_color(sc) || '">' || public.p2p_score_label(sc) || ' &middot; ' || round(sc) || '</td></tr></table>' || public.p2p_bar(sc, public.p2p_score_color(sc)) || '</div>';
      end loop;
    end if;
    body := body || public.p2p_h('What guests love', '#0B6B54') || public.p2p_li(a -> 'likes', '#1F9D74')
      || public.p2p_h('Where it slips', '#B4442F') || public.p2p_li(a -> 'dislikes', '#D9534F');
    if jsonb_typeof(a -> 'suggestions') = 'array' then
      body := body || public.p2p_h('Suggested next steps');
      ln := 0;
      for k in select left(value #>> '{}', 300) from jsonb_array_elements(a -> 'suggestions') limit 6 loop
        ln := ln + 1;
        body := body || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px"><tr><td width="34" valign="top"><div style="width:24px;height:24px;border-radius:12px;background:#E8943A;color:#fff;font-size:12px;font-weight:bold;line-height:24px;text-align:center">' || ln || '</div></td><td style="font-size:14px;line-height:21px;color:#3B3A37;padding-top:1px">' || public.p2p_esc(k) || '</td></tr></table>';
      end loop;
    end if;
    if coalesce(a -> 'seasonal_outlook' ->> 'guidance', '') <> '' then
      body := body || public.p2p_h('Trend outlook') || '<p style="margin:0;font-size:14px;line-height:21px;color:#3B3A37">' || public.p2p_esc(left(a -> 'seasonal_outlook' ->> 'guidance', 500)) || '</p>';
    end if;
    if jsonb_typeof(a -> 'seasonal_outlook' -> 'rising') = 'array' and jsonb_array_length(a -> 'seasonal_outlook' -> 'rising') > 0 then
      body := body || '<div style="font-size:13px;font-weight:bold;margin:12px 0 2px;color:#0B6B54">Rising</div>' || public.p2p_li(a -> 'seasonal_outlook' -> 'rising', '#1F9D74');
    end if;
    if jsonb_typeof(a -> 'seasonal_outlook' -> 'watch') = 'array' and jsonb_array_length(a -> 'seasonal_outlook' -> 'watch') > 0 then
      body := body || '<div style="font-size:13px;font-weight:bold;margin:12px 0 2px;color:#B4442F">Watch</div>' || public.p2p_li(a -> 'seasonal_outlook' -> 'watch', '#D9534F');
    end if;
    if jsonb_typeof(a -> 'campaign_ideas') = 'array' and jsonb_array_length(a -> 'campaign_ideas') > 0 then
      body := body || public.p2p_h('Campaign ideas');
      for asp in select value from jsonb_array_elements(a -> 'campaign_ideas') limit 4 loop
        body := body || '<p style="margin:0 0 10px;font-size:14px;line-height:20px;color:#3B3A37"><b>' || public.p2p_esc(coalesce(left(asp ->> 'title', 100), '')) || '</b><br>' || public.p2p_esc(coalesce(left(asp ->> 'angle', 300), '')) || '</p>';
      end loop;
    end if;
    if jsonb_typeof(a -> 'extras' -> 'progress') = 'object' then
      body := body || public.p2p_h('Progress since ' || coalesce(left(a -> 'extras' -> 'progress' ->> 'since', 30), 'the last assessment'))
        || '<p style="margin:0 0 8px;font-size:14px;line-height:21px;color:#14161A"><b>' || public.p2p_esc(coalesce(left(a -> 'extras' -> 'progress' ->> 'head', 80), '')) || '.</b> ' || public.p2p_esc(coalesce(left(a -> 'extras' -> 'progress' ->> 'summary', 300), '')) || '</p>';
      if jsonb_typeof(a -> 'extras' -> 'progress' -> 'rows') = 'array' then
        for asp in select value from jsonb_array_elements(a -> 'extras' -> 'progress' -> 'rows') limit 12 loop
          body := body || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:3px 0;font-size:13px;color:#3B3A37">' || public.p2p_esc(coalesce(left(asp ->> 'name', 40), '')) || '</td><td align="right" style="padding:3px 0;font-size:13px;font-weight:bold;color:#3B3A37">' || coalesce(asp ->> 'prev', '–') || ' &rarr; ' || coalesce(asp ->> 'cur', '–') || '</td></tr></table>';
        end loop;
      end if;
      if jsonb_array_length(coalesce(a -> 'extras' -> 'progress' -> 'new_concerns', '[]'::jsonb)) > 0 then body := body || '<div style="font-size:13px;font-weight:bold;margin:12px 0 2px;color:#B4442F">New concerns</div>' || public.p2p_li(a -> 'extras' -> 'progress' -> 'new_concerns', '#D9534F'); end if;
      if jsonb_array_length(coalesce(a -> 'extras' -> 'progress' -> 'gone_concerns', '[]'::jsonb)) > 0 then body := body || '<div style="font-size:13px;font-weight:bold;margin:12px 0 2px;color:#0B6B54">No longer coming up</div>' || public.p2p_li(a -> 'extras' -> 'progress' -> 'gone_concerns', '#1F9D74'); end if;
      if jsonb_array_length(coalesce(a -> 'extras' -> 'progress' -> 'new_strengths', '[]'::jsonb)) > 0 then body := body || '<div style="font-size:13px;font-weight:bold;margin:12px 0 2px;color:#0B6B54">New strengths</div>' || public.p2p_li(a -> 'extras' -> 'progress' -> 'new_strengths', '#1F9D74'); end if;
      if jsonb_array_length(coalesce(a -> 'extras' -> 'progress' -> 'lost_strengths', '[]'::jsonb)) > 0 then body := body || '<div style="font-size:13px;font-weight:bold;margin:12px 0 2px;color:#B4442F">Strengths that faded</div>' || public.p2p_li(a -> 'extras' -> 'progress' -> 'lost_strengths', '#D9534F'); end if;
    end if;
    if jsonb_typeof(a -> 'extras' -> 'forecast') = 'object' then
      body := body || public.p2p_h('Forecast');
      if jsonb_typeof(a -> 'extras' -> 'forecast' -> 'nums') = 'object' then
        body := body || '<p style="margin:0 0 8px;font-size:13.5px;color:#7A756C">Today: <b style="color:#14161A">' || coalesce(left(a -> 'extras' -> 'forecast' -> 'nums' ->> 'now', 4), '–') || '</b> / 100</p>'
          || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px"><tr><td width="50%" valign="top" style="padding-right:6px"><div style="background:#14161A;border-radius:12px;padding:12px;color:#fff"><div style="font-size:11px;letter-spacing:.08em;color:#F5B041;font-weight:bold">NEXT MONTH &middot; IF NOTHING CHANGES</div><div style="font-size:26px;font-weight:bold;margin-top:4px;color:'
          || public.p2p_score_color(coalesce(nullif(a -> 'extras' -> 'forecast' -> 'nums' ->> 'm1', '')::numeric, 0)) || '">' || coalesce(left(a -> 'extras' -> 'forecast' -> 'nums' ->> 'm1', 4), '–') || '<span style="font-size:13px;color:#B9B4AA"> / 100</span></div><div style="font-size:12px;margin-top:2px;color:#F3EEE6">'
          || coalesce(case when (a -> 'extras' -> 'forecast' -> 'nums' ->> 'm1')::numeric >= (a -> 'extras' -> 'forecast' -> 'nums' ->> 'now')::numeric then '&#9650; +' else '&#9660; ' end || ((a -> 'extras' -> 'forecast' -> 'nums' ->> 'm1')::numeric - (a -> 'extras' -> 'forecast' -> 'nums' ->> 'now')::numeric)::text || ' vs today', '')
          || '</div><div style="font-size:12px;margin-top:6px;color:#7FE0BD">&#10003; If you fix the top issues: <b>' || coalesce(left(a -> 'extras' -> 'forecast' -> 'nums' ->> 'i1', 4), '–') || '</b></div></div></td>'
          || '<td width="50%" valign="top" style="padding-left:6px"><div style="background:#14161A;border-radius:12px;padding:12px;color:#fff"><div style="font-size:11px;letter-spacing:.08em;color:#F5B041;font-weight:bold">NEXT 6 MONTHS &middot; IF NOTHING CHANGES</div><div style="font-size:26px;font-weight:bold;margin-top:4px;color:'
          || public.p2p_score_color(coalesce(nullif(a -> 'extras' -> 'forecast' -> 'nums' ->> 'm6', '')::numeric, 0)) || '">' || coalesce(left(a -> 'extras' -> 'forecast' -> 'nums' ->> 'm6', 4), '–') || '<span style="font-size:13px;color:#B9B4AA"> / 100</span></div><div style="font-size:12px;margin-top:2px;color:#F3EEE6">'
          || coalesce(case when (a -> 'extras' -> 'forecast' -> 'nums' ->> 'm6')::numeric >= (a -> 'extras' -> 'forecast' -> 'nums' ->> 'now')::numeric then '&#9650; +' else '&#9660; ' end || ((a -> 'extras' -> 'forecast' -> 'nums' ->> 'm6')::numeric - (a -> 'extras' -> 'forecast' -> 'nums' ->> 'now')::numeric)::text || ' vs today', '')
          || '</div><div style="font-size:12px;margin-top:6px;color:#7FE0BD">&#10003; If you fix the top issues: <b>' || coalesce(left(a -> 'extras' -> 'forecast' -> 'nums' ->> 'i6', 4), '–') || '</b></div></div></td></tr></table>';
        body := body || '<p style="margin:0 0 10px;font-size:13.5px;line-height:20px;color:#7A4A10;background:#FEF3E2;border-radius:10px;padding:10px 12px">'
          || case when coalesce(nullif(a -> 'extras' -> 'forecast' -> 'nums' ->> 'stake', '')::numeric, 0) >= 1
                  then '<b>What is at stake: about ' || (a -> 'extras' -> 'forecast' -> 'nums' ->> 'stake') || ' points over 6 months if nothing changes.</b> '
                  else '<b>Momentum is working for you, but it will not last on its own.</b> ' end
          || case when jsonb_typeof(a -> 'extras' -> 'forecast' -> 'nums' -> 'weak') = 'array' and jsonb_array_length(a -> 'extras' -> 'forecast' -> 'nums' -> 'weak') > 0 then 'The biggest openings are ' || public.p2p_esc(left((select string_agg(v, ' and ') from jsonb_array_elements_text(a -> 'extras' -> 'forecast' -> 'nums' -> 'weak') v), 120)) || '. ' else '' end
          || case when (a -> 'extras' -> 'forecast' -> 'nums' ->> 'n') = '1' then 'With one check-in this is a modelled scenario, not a measured trend.' else '' end || '</p>';
        if jsonb_typeof(a -> 'extras' -> 'forecast' -> 'nums' -> 'asp') = 'array' then
          body := body || '<div style="font-size:12px;letter-spacing:.08em;font-weight:bold;color:#7A756C;margin:6px 0 4px">WHERE IT IS HEADING, BY ASPECT <span style="font-weight:normal;letter-spacing:0">(today &rarr; 1 month &rarr; 6 months)</span></div>';
          for asp in select value from jsonb_array_elements(a -> 'extras' -> 'forecast' -> 'nums' -> 'asp') limit 8 loop
            body := body || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:3px 0;font-size:13px;color:#3B3A37">' || public.p2p_esc(coalesce(left(asp ->> 'name', 30), '')) || '</td><td align="right" style="padding:3px 0;font-size:13px;font-weight:bold;color:#3B3A37">' || coalesce(asp ->> 'now', '–') || ' &rarr; ' || coalesce(asp ->> 'm1', '–') || ' &rarr; ' || coalesce(asp ->> 'm6', '–')
              || case when nullif(asp ->> 'fix', '') is not null then ' <span style="color:#1D9E75;font-size:11.5px">fix: ' || (asp ->> 'fix') || '</span>' else '' end || '</td></tr></table>';
          end loop;
        end if;
      end if;
      if coalesce(a -> 'extras' -> 'forecast' ->> 'headline', '') <> '' then body := body || '<p style="margin:0 0 8px;font-size:14px;line-height:21px;color:#14161A"><b>' || public.p2p_esc(left(a -> 'extras' -> 'forecast' ->> 'headline', 200)) || '</b></p>'; end if;
      if coalesce(a -> 'extras' -> 'forecast' ->> 'next_month', '') <> '' then body := body || '<p style="margin:0 0 8px;font-size:14px;line-height:21px;color:#3B3A37"><b>Next month:</b> ' || public.p2p_esc(left(a -> 'extras' -> 'forecast' ->> 'next_month', 400)) || '</p>'; end if;
      if coalesce(a -> 'extras' -> 'forecast' ->> 'next_6_months', '') <> '' then body := body || '<p style="margin:0 0 8px;font-size:14px;line-height:21px;color:#3B3A37"><b>Next 6 months:</b> ' || public.p2p_esc(left(a -> 'extras' -> 'forecast' ->> 'next_6_months', 400)) || '</p>'; end if;
      body := body || public.p2p_li(a -> 'extras' -> 'forecast' -> 'actions', '#E8943A');
    end if;
    if jsonb_typeof(a -> 'extras' -> 'seo') = 'object' then
      sc := nullif(a -> 'extras' -> 'seo' ->> 'score', '')::numeric;
      body := body || public.p2p_h('Website SEO check') || '<p style="margin:0 0 8px;font-size:14px;line-height:21px;color:#3B3A37"><b style="font-size:20px;color:' || public.p2p_score_color(coalesce(sc, 0)) || '">' || coalesce(sc::text, '–') || '</b> / 100 &middot; ' || public.p2p_esc(coalesce(left(a -> 'extras' -> 'seo' ->> 'url', 120), '')) || '</p>';
      if jsonb_typeof(a -> 'extras' -> 'seo' -> 'cats') = 'array' then
        for asp in select value from jsonb_array_elements(a -> 'extras' -> 'seo' -> 'cats') limit 10 loop
          sa := nullif(asp ->> 'score', '')::numeric; continue when sa is null;
          body := body || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:6px"><tr><td style="font-size:13px;color:#3B3A37">' || public.p2p_esc(coalesce(left(asp ->> 'name', 40), '')) || '</td><td align="right" style="font-size:13px;font-weight:bold;color:' || public.p2p_score_color(sa) || '">' || round(sa) || '</td></tr></table>' || public.p2p_bar(sa, public.p2p_score_color(sa));
        end loop;
      end if;
      if coalesce(a -> 'extras' -> 'seo' ->> 'headline', '') <> '' then body := body || '<p style="margin:10px 0 6px;font-size:14px;line-height:21px;color:#14161A"><b>' || public.p2p_esc(left(a -> 'extras' -> 'seo' ->> 'headline', 200)) || '</b></p>'; end if;
      if jsonb_array_length(coalesce(a -> 'extras' -> 'seo' -> 'quick_wins', '[]'::jsonb)) > 0 then body := body || '<div style="font-size:13px;font-weight:bold;margin:8px 0 2px">Quick wins (this week)</div>' || public.p2p_li(a -> 'extras' -> 'seo' -> 'quick_wins', '#E8943A'); end if;
      if jsonb_array_length(coalesce(a -> 'extras' -> 'seo' -> 'this_month', '[]'::jsonb)) > 0 then body := body || '<div style="font-size:13px;font-weight:bold;margin:8px 0 2px">This month</div>' || public.p2p_li(a -> 'extras' -> 'seo' -> 'this_month', '#E8943A'); end if;
      if jsonb_array_length(coalesce(a -> 'extras' -> 'seo' -> 'local_tips', '[]'::jsonb)) > 0 then body := body || '<div style="font-size:13px;font-weight:bold;margin:8px 0 2px">Local search tips</div>' || public.p2p_li(a -> 'extras' -> 'seo' -> 'local_tips', '#E8943A'); end if;
    end if;
    if jsonb_typeof(a -> 'extras' -> 'social') = 'array' and jsonb_array_length(a -> 'extras' -> 'social') > 0 then
      body := body || public.p2p_h('Social media');
      for asp in select value from jsonb_array_elements(a -> 'extras' -> 'social') limit 4 loop
        body := body || '<p style="margin:0 0 4px;font-size:14px;line-height:20px;color:#3B3A37"><b>' || public.p2p_esc(coalesce(left(asp ->> 'platform', 20), '')) || ' @' || public.p2p_esc(coalesce(left(asp ->> 'handle', 60), '')) || '</b> &middot; <b style="color:' || public.p2p_score_color(coalesce(nullif(asp ->> 'score', '')::numeric, 0)) || '">' || coalesce(nullif(asp ->> 'score', ''), '–') || '/100</b>'
          || case when nullif(asp ->> 'followers', '') is not null then ' &middot; ' || to_char(nullif(asp ->> 'followers', '')::numeric, 'FM999,999,999') || ' followers' else '' end
          || case when nullif(asp ->> 'growth', '') is not null then ' (' || case when (asp ->> 'growth')::numeric >= 0 then '+' else '' end || to_char((asp ->> 'growth')::numeric, 'FM999,999,999') || ' since last check)' else '' end
          || '</p><p style="margin:0 0 6px;font-size:13.5px;line-height:20px;color:#3B3A37">' || public.p2p_esc(coalesce(left(asp ->> 'headline', 250), '')) || '</p>';
        if jsonb_array_length(coalesce(asp -> 'strengths', '[]'::jsonb)) > 0 then body := body || '<div style="font-size:12.5px;font-weight:bold;margin:4px 0 2px;color:#0B6B54">What is working</div>' || public.p2p_li(asp -> 'strengths', '#1F9D74'); end if;
        if jsonb_array_length(coalesce(asp -> 'gaps', '[]'::jsonb)) > 0 then body := body || '<div style="font-size:12.5px;font-weight:bold;margin:4px 0 2px;color:#B4442F">Gaps to close</div>' || public.p2p_li(asp -> 'gaps', '#D9534F'); end if;
        if jsonb_array_length(coalesce(asp -> 'ideas', '[]'::jsonb)) > 0 then body := body || '<div style="font-size:12.5px;font-weight:bold;margin:4px 0 2px">Post ideas</div>' || public.p2p_li(asp -> 'ideas', '#E8943A'); end if;
        body := body || '<div style="height:10px"></div>';
      end loop;
    end if;
    if coalesce(a ->> 'engine', '') <> '' then
      body := body || '<p style="margin:22px 0 0;font-size:12px;color:#7A756C">Assessed by ' || public.p2p_esc(left(a ->> 'engine', 80)) || '.</p>';
    end if;
    if coalesce(a ->> 'website', '') <> '' or coalesce(a ->> 'phone', '') <> '' then
      body := body || '<p style="margin:6px 0 0;font-size:12px;color:#7A756C">' || public.p2p_esc(concat_ws(' · ', nullif(left(a ->> 'website', 120), ''), nullif(left(a ->> 'phone', 40), ''))) || '</p>';
    end if;
  end if;

  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>Proof to Profit</title></head><body style="margin:0;padding:0;background:#F3EEE6">'
    || '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#F3EEE6">' || public.p2p_esc(p_who) || ' shared a Proof to Profit report with you.</div>'
    || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3EEE6"><tr><td align="center" style="padding:24px 12px">'
    || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#FFFFFF;border-radius:20px;overflow:hidden;border:1px solid #E6DFD3;font-family:Arial,Helvetica,sans-serif">'
    || '<tr><td style="background:#14161A;padding:22px 28px"><div style="font-size:12px;letter-spacing:.16em;font-weight:bold;color:#F5B041">PROOF TO PROFIT</div><div style="font-size:24px;line-height:30px;font-weight:bold;color:#FFFFFF;margin-top:8px">' || public.p2p_esc(head) || '</div><div style="font-size:13px;color:#B9B4AA;margin-top:4px">' || public.p2p_esc(sub) || '</div></td></tr>'
    || '<tr><td style="padding:22px 28px 6px;font-size:14px;line-height:21px;color:#3B3A37"><b>' || public.p2p_esc(p_who) || '</b> shared this ' || case when p_kind = 'compare' then 'comparison' else 'analysis' end || ' with you.'
    || case when coalesce(trim(p_note), '') <> '' then '<div style="margin-top:12px;background:#FAF6EE;border:1px solid #E6DFD3;border-radius:12px;padding:12px 14px;color:#5E5A54">&ldquo;' || public.p2p_esc(left(trim(p_note), 400)) || '&rdquo;</div>' else '' end
    || '</td></tr>'
    || '<tr><td style="padding:6px 28px 26px">' || body || '</td></tr>'
    || '<tr><td style="background:#FAF6EE;border-top:1px solid #E6DFD3;padding:16px 28px;font-size:12px;line-height:18px;color:#7A756C">Scores and themes are AI estimates based on review patterns &mdash; a starting point, not an audit. Sent by Proof to Profit on behalf of ' || public.p2p_esc(p_who) || '. Replying to this message will not reach them; contact them directly.</td></tr>'
    || '</table></td></tr></table></body></html>';
end $fn$;

-- Called from the portal. Up to 5 recipients, 30 recipient emails per day per person.
create or replace function public.share_report(p_to text[], p_note text, p_kind text, p_a jsonb, p_b jsonb default null, p_copy boolean default false) returns json
language plpgsql security definer set search_path = public as $$
declare
  me public.allowed_emails; who text; subj text; html text; addr text; clean text[] := array[]::text[]; used int; nm text; n int := 0;
begin
  me := public._p2p_me();
  if me.email is null or auth.uid() is null then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_kind not in ('single', 'compare') or jsonb_typeof(p_a) <> 'object' or (p_kind = 'compare' and jsonb_typeof(p_b) <> 'object') then raise exception 'invalid report'; end if;
  if length(p_a::text) > 60000 or length(coalesce(p_b::text, '')) > 60000 then raise exception 'report too large'; end if;
  foreach addr in array coalesce(p_to, array[]::text[]) loop
    addr := lower(trim(addr));
    if addr = '' then continue; end if;
    if addr !~ '^[a-z0-9._%+''-]+@[a-z0-9.-]+\.[a-z]{2,}$' or length(addr) > 120 then raise exception 'bad email: %', addr; end if;
    if not (addr = any(clean)) then clean := clean || addr; end if;
  end loop;
  if array_length(clean, 1) is null then raise exception 'Add at least one email address'; end if;
  if array_length(clean, 1) > 5 then raise exception 'You can share with up to 5 people at a time'; end if;
  select count(*) into used from public.email_outbox where user_id = auth.uid() and kind = 'share' and created_at > now() - interval '1 day';
  if used + array_length(clean, 1) + (p_copy)::int > 30 then raise exception 'Daily sharing limit reached. Try again tomorrow.'; end if;

  select coalesce(nullif(trim(p.display_name), ''), split_part(me.email, '@', 1)) into who from public.profiles p where p.user_id = auth.uid();
  who := coalesce(who, split_part(me.email, '@', 1));
  nm := case when p_kind = 'compare' then coalesce(nullif(left(p_a ->> 'name', 60), ''), 'Business A') || ' vs ' || coalesce(nullif(left(p_b ->> 'name', 60), ''), 'Business B')
             else coalesce(nullif(left(p_a ->> 'name', 80), ''), 'a business') end;
  subj := who || ' shared ' || case when p_kind = 'compare' then 'a comparison: ' else 'an analysis: ' end || nm;
  html := public.share_email_html(who, p_note, p_kind, p_a, p_b);
  foreach addr in array clean loop
    perform public.queue_email(auth.uid(), addr, 'share', subj, html); n := n + 1;
  end loop;
  if p_copy then perform public.queue_email(auth.uid(), me.email, 'share', 'Copy: ' || subj, html); n := n + 1; end if;
  return json_build_object('queued', n);
end $$;

revoke all on function public.share_report(text[], text, text, jsonb, jsonb, boolean) from public, anon;
grant execute on function public.share_report(text[], text, text, jsonb, jsonb, boolean) to authenticated;
