-- Remove the deleted marketplace's email preference branch from the shared helper.
create or replace function public.create_notification(
  p_user uuid,p_type text,p_title text,p_body text,p_url text,p_dedupe text,p_pref text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare v_email boolean := false;
begin
  if p_user is null then return; end if;
  select case p_pref
    when 'comments' then np.email_comments
    when 'replies' then np.email_replies
    when 'inquiries' then np.email_inquiries
    when 'moderation' then np.email_moderation
    when 'deadlines' then np.email_opportunity_deadlines
    else false
  end into v_email
  from public.notification_preferences np where np.user_id=p_user;
  insert into public.notifications(user_id,type,title,body,url,dedupe_key,email_status)
  values(p_user,p_type,p_title,p_body,p_url,p_dedupe,
    case when coalesce(v_email,false) then 'pending'::public.email_delivery_status end)
  on conflict(user_id,dedupe_key) do nothing;
end;
$$;
