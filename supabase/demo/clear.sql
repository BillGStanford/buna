-- Removes all demo data (rows flagged is_demo). Child rows and slug history cascade.
delete from public.startups where is_demo;
delete from public.launches where is_demo;
delete from public.opportunities where is_demo;
delete from public.investors where is_demo;
