import { SelectField } from "@/components/ui/fields";
import { AFRICAN_COUNTRIES, DIASPORA_COUNTRIES } from "@/lib/geo";
import { FOUNDER_STATUSES } from "@/lib/validation/profile";

export function CountrySelect({ defaultValue, error }: { defaultValue?: string; error?: string }) {
  return (
    <SelectField label="Country" name="country" defaultValue={defaultValue ?? ""} error={error}>
      <option value="">Prefer not to say</option>
      <optgroup label="Africa">
        {AFRICAN_COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
      </optgroup>
      <optgroup label="Elsewhere">
        {DIASPORA_COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
      </optgroup>
    </SelectField>
  );
}

export function FounderStatusSelect({ defaultValue, error }: { defaultValue?: string; error?: string }) {
  return (
    <SelectField label="What best describes you?" name="founderStatus" defaultValue={defaultValue ?? ""} error={error}>
      <option value="">Choose one (optional)</option>
      {FOUNDER_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
    </SelectField>
  );
}
