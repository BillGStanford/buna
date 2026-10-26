import { SelectField } from "@/components/ui/fields";
import { AFRICAN_COUNTRIES, DIASPORA_COUNTRIES } from "@/lib/geo";
import { STAGES } from "@/lib/startups/constants";
import type { CategoryOption } from "@/lib/startups/queries";

export function StartupCountrySelect({ defaultValue, error }: { defaultValue?: string; error?: string }) {
  return (
    <SelectField label="Country" name="country" defaultValue={defaultValue ?? ""} error={error}>
      <option value="">Choose a country</option>
      <optgroup label="Africa">{AFRICAN_COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</optgroup>
      <optgroup label="Elsewhere">{DIASPORA_COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</optgroup>
    </SelectField>
  );
}

export function CategorySelect({ categories, defaultValue, error }: { categories: CategoryOption[]; defaultValue?: string; error?: string }) {
  return (
    <SelectField label="Sector" name="categoryId" defaultValue={defaultValue ?? ""} error={error}>
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
