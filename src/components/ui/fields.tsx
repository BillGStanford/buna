import * as React from "react";
import { cn } from "@/lib/utils";

const control =
  "block w-full rounded-md border bg-surface px-3 text-sm text-ink placeholder:text-muted/70 transition-colors disabled:bg-primary-pale disabled:text-muted";

type Common = { label: string; name: string; error?: string; hint?: string; required?: boolean };

function FieldShell({
  id, label, error, hint, required, children,
}: { id: string; label: string; error?: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
        {required ? <span className="ml-0.5 text-danger" aria-hidden="true">*</span> : null}
        {required ? <span className="sr-only"> (required)</span> : null}
      </label>
      {children}
      {hint && !error ? <p id={`${id}-hint`} className="text-xs text-muted">{hint}</p> : null}
      {error ? <p id={`${id}-error`} className="text-xs font-medium text-danger">{error}</p> : null}
    </div>
  );
}

function aria(id: string, error?: string, hint?: string) {
  return {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : hint ? `${id}-hint` : undefined,
  } as const;
}

const borderFor = (error?: string) => (error ? "border-danger" : "border-line hover:border-primary/40");

export function TextField({
  label, name, error, hint, required, className, ...props
}: Common & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name">) {
  const id = props.id ?? `f-${name}`;
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} required={required}>
      <input id={id} name={name} required={required} className={cn(control, "h-10", borderFor(error), className)} {...aria(id, error, hint)} {...props} />
    </FieldShell>
  );
}

export function TextAreaField({
  label, name, error, hint, required, className, ...props
}: Common & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "name">) {
  const id = props.id ?? `f-${name}`;
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} required={required}>
      <textarea id={id} name={name} required={required} rows={props.rows ?? 4} className={cn(control, "py-2", borderFor(error), className)} {...aria(id, error, hint)} {...props} />
    </FieldShell>
  );
}

export function SelectField({
  label, name, error, hint, required, className, children, ...props
}: Common & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "name">) {
  const id = props.id ?? `f-${name}`;
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} required={required}>
      <select id={id} name={name} required={required} className={cn(control, "h-10", borderFor(error), className)} {...aria(id, error, hint)} {...props}>
        {children}
      </select>
    </FieldShell>
  );
}

export function CheckboxField({
  label, name, hint, defaultChecked, value, id: idProp,
}: { label: string; name: string; hint?: string; defaultChecked?: boolean; value?: string; id?: string }) {
  const id = idProp ?? `f-${name}`;
  return (
    <div className="flex items-start gap-3">
      <input id={id} type="checkbox" name={name} value={value ?? "on"} defaultChecked={defaultChecked}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="mt-0.5 h-4 w-4 rounded border-line accent-[rgb(var(--primary))]" />
      <div>
        <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>
        {hint ? <p id={`${id}-hint`} className="text-xs text-muted">{hint}</p> : null}
      </div>
    </div>
  );
}
