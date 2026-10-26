-- Every generated assessment or comparison is recorded in the notification bell (in-app only, no email).
create or replace function public.notify_assessment(p_title text, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not public.is_allowed() then raise exception 'not allowed' using errcode = '42501'; end if;
  insert into public.notifications (user_id, kind, title, body) values (uid, 'assessment', left(p_title, 140), left(p_body, 500));
end $$;
revoke all on function public.notify_assessment(text, text) from public, anon;
grant execute on function public.notify_assessment(text, text) to authenticated;
