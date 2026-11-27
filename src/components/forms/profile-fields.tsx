import { CountryPicker } from "@/components/ui/country-picker";
import { SelectField } from "@/components/ui/fields";
import { FOUNDER_STATUSES } from "@/lib/validation/profile";

export function CountrySelect({ defaultValue, error }: { defaultValue?: string; error?: string }) {
  return <CountryPicker label="Country" name="country" defaultValue={defaultValue} placeholder="Prefer not to say" error={error} />;
}

export function FounderStatusSelect({ defaultValue, error }: { defaultValue?: string; error?: string }) {
  return (
    <SelectField label="What best describes you?" name="founderStatus" defaultValue={defaultValue ?? ""} error={error}>
      <option value="">Choose one (optional)</option>
      {FOUNDER_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
    </SelectField>
  );
}
