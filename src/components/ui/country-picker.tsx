"use client";

import { useState } from "react";
import { ALL_COUNTRIES, AFRICAN_COUNTRY_CODES } from "@/lib/geo";
import { CountryFlag } from "@/components/ui/country-flag";

type CountryPickerProps = {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  error?: string;
  hint?: string;
};

export function CountryPicker({ label, name, defaultValue = "", placeholder = "Choose a country", error, hint }: CountryPickerProps) {
  const [value, setValue] = useState(defaultValue.toUpperCase());
  const african = ALL_COUNTRIES.filter((country) => AFRICAN_COUNTRY_CODES.includes(country.code as typeof AFRICAN_COUNTRY_CODES[number]));
  const other = ALL_COUNTRIES.filter((country) => !AFRICAN_COUNTRY_CODES.includes(country.code as typeof AFRICAN_COUNTRY_CODES[number]));
  return (
    <div className="min-w-0">
      <label htmlFor={name} className="block text-sm font-medium text-ink">{label}</label>
      <div className="mt-1.5 flex min-h-11 items-center gap-2 rounded-lg border border-line bg-surface px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
        {value ? <CountryFlag code={value} size={20} /> : <span aria-hidden="true" className="h-[15px] w-5 rounded-sm bg-primary-pale" />}
        <select id={name} name={name} value={value} onChange={(event) => setValue(event.target.value)}
          className="h-10 min-w-0 flex-1 bg-transparent text-sm text-ink outline-none">
          <option value="">{placeholder}</option>
          <optgroup label="Africa">{african.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}</optgroup>
          <optgroup label="Rest of the world">{other.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}</optgroup>
        </select>
      </div>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      {error ? <p role="alert" className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
