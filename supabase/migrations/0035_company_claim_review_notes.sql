-- 0035: retain staff rationale for company-claim decisions.
alter table public.startup_data_claims add column review_note text
  check (review_note is null or char_length(review_note) <= 1000);
