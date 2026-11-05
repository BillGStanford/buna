-- 0017 — allow staff to moderate individual community replies.
-- The existing RLS policy restricts these status updates to active staff.
grant update (status) on public.community_replies to authenticated;
