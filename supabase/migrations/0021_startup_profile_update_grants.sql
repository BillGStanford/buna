-- Buna 0021 — allow startup editors to update the structured profile fields added in 0020.
-- Keep the column-level grant narrow; RLS still decides which startup rows they may edit.

grant update (
  problem_statement,
  solution,
  target_customers,
  target_geographies,
  market_opportunity,
  business_model,
  funding_round,
  fundraising_status,
  funding_target,
  funding_currency
) on public.startups to authenticated;
