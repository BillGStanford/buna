import { SelectField } from "@/components/ui/fields";
import { CountryPicker } from "@/components/ui/country-picker";
import { STAGES } from "@/lib/startups/constants";
import type { CategoryOption } from "@/lib/startups/queries";

export function StartupCountrySelect({ defaultValue, error, hint }: { defaultValue?: string; error?: string; hint?: string }) {
  return <CountryPicker label="Country" name="country" defaultValue={defaultValue} placeholder="Choose a country" error={error} hint={hint} />;
}

export function CategorySelect({ categories, defaultValue, error, hint }: { categories: CategoryOption[]; defaultValue?: string; error?: string; hint?: string }) {
  return (
    <SelectField label="Sector" name="categoryId" defaultValue={defaultValue ?? ""} error={error} hint={hint}>
      <option value="">Choose a sector</option>
      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </SelectField>
  );
}

export function StageSelect({ defaultValue, error }: { defaultValue?: string; error?: string }) {
  return (
    <SelectField label="Stage" name="stage" defaultValue={defaultValue ?? ""} error={error}>
      <option value="">Not set</option>
      {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
    </SelectField>
  );
}
