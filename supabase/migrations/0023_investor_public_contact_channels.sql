-- 0023: optional public contact channels for approved investor listings.
-- These columns are intentionally independent from investor_accounts private contact fields.
alter table public.investors
  add column if not exists public_contact_email text,
  add column if not exists public_contact_phone text,
  add column if not exists public_contact_whatsapp text,
  add column if not exists public_contact_telegram text,
  add column if not exists public_contact_facebook text,
  add column if not exists public_contact_other_url text;

alter table public.investors
  add constraint investors_public_contact_email_len check (public_contact_email is null or char_length(public_contact_email) <= 254),
  add constraint investors_public_contact_phone_len check (public_contact_phone is null or char_length(public_contact_phone) <= 40),
  add constraint investors_public_contact_whatsapp_len check (public_contact_whatsapp is null or char_length(public_contact_whatsapp) <= 100),
  add constraint investors_public_contact_telegram_len check (public_contact_telegram is null or char_length(public_contact_telegram) <= 100),
  add constraint investors_public_contact_facebook_len check (public_contact_facebook is null or char_length(public_contact_facebook) <= 500),
  add constraint investors_public_contact_other_url_len check (public_contact_other_url is null or char_length(public_contact_other_url) <= 500);

comment on column public.investors.public_contact_email is 'Investor-selected email published for founder outreach; independent of private application contact data.';
comment on column public.investors.public_contact_phone is 'Investor-selected phone published for founder outreach.';
comment on column public.investors.public_contact_whatsapp is 'Investor-selected WhatsApp contact published for founder outreach.';
comment on column public.investors.public_contact_telegram is 'Investor-selected Telegram contact published for founder outreach.';
comment on column public.investors.public_contact_facebook is 'Investor-selected Facebook URL published for founder outreach.';
comment on column public.investors.public_contact_other_url is 'Investor-selected additional contact URL published for founder outreach.';
