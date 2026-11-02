"use client";

import { useEffect, useState } from "react";
import { WebsiteFavicon } from "./website-favicon";

type Props = {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  hint?: string;
  error?: string;
};

export function WebsiteUrlField({ name, label, defaultValue = "", placeholder = "https://example.com", hint, error, required = false }: Props) {
  const [value, setValue] = useState(defaultValue);
  const [preview, setPreview] = useState(defaultValue);

  useEffect(() => {
    const timer = window.setTimeout(() => setPreview(value.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [value]);

  return (
    <div className="min-w-0">
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium text-ink">{label}</label>
      <div className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 focus-within:ring-2 focus-within:ring-primary">
        {preview ? <WebsiteFavicon url={preview} size={20} /> : null}
        <input
          id={name}
          name={name}
          type="url"
          inputMode="url"
          autoComplete="url"
          placeholder={placeholder}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
          className="min-w-0 w-full bg-transparent py-2.5 text-sm text-ink outline-none placeholder:text-muted"
        />
      </div>
      {hint ? <p id={`${name}-hint`} className="mt-1.5 text-xs text-muted">{hint}</p> : null}
      {error ? <p id={`${name}-error`} role="alert" className="mt-1.5 text-xs text-danger">{error}</p> : null}
      {preview ? <p className="mt-1 text-xs text-muted">Website icon preview · a custom logo always takes priority.</p> : null}
    </div>
  );
}
