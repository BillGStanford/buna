import { Alert } from "@/components/ui/alert";
import type { ActionState } from "@/lib/types";

/** Shows the overall result of a form action (field-level errors are rendered by each field). */
export function FormMessage({ state }: { state: ActionState }) {
  if (state.status === "idle" || !state.message) return null;
  return <Alert tone={state.status === "success" ? "success" : "error"}>{state.message}</Alert>;
}

export const firstError = (state: ActionState, key: string): string | undefined => state.fieldErrors?.[key]?.[0];

export function valueOf(state: ActionState, key: string, fallback = ""): string {
  const v = state.values?.[key];
  return typeof v === "string" ? v : fallback;
}
