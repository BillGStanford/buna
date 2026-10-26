"use client";

import { useActionState } from "react";
import { deleteProductAction, saveProductAction } from "@/app/dashboard/startup/actions";
import { TextAreaField, TextField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { ConfirmActionForm } from "@/components/forms/confirm-action-form";
import { FormMessage, firstError, valueOf } from "@/components/forms/form-message";
import { LIMITS } from "@/lib/startups/constants";
import { idleState } from "@/lib/types";

type Product = { id: string; name: string; description: string | null; url: string | null };

function ProductForm({ startupId, product }: { startupId: string; product?: Product }) {
  const [state, action] = useActionState(saveProductAction, idleState);
  const editing = Boolean(product);
  // After a successful add the server returns empty values, which clears the form.
  const cleared = state.status === "success" && !editing;
  const pick = (k: string, fallback: string) => (state.status === "error" ? valueOf(state, k, fallback) : fallback);
  return (
    <form key={cleared ? `done-${state.message}` : "form"} action={action} className="space-y-3" noValidate>
      <input type="hidden" name="startupId" value={startupId} />
      <input type="hidden" name="productId" value={product?.id ?? ""} />
      <FormMessage state={state} />
      <TextField label="Product name" name="name" required maxLength={80} defaultValue={pick("name", product?.name ?? "")} error={firstError(state, "name")} />
      <TextAreaField label="Description" name="description" rows={3} maxLength={1000} defaultValue={pick("description", product?.description ?? "")} error={firstError(state, "description")} />
      <TextField label="Link" name="url" type="url" inputMode="url" placeholder="https://" defaultValue={pick("url", product?.url ?? "")} error={firstError(state, "url")} />
      <SubmitButton variant={editing ? "secondary" : "primary"} size="sm" pendingLabel="Saving…">{editing ? "Save product" : "Add product"}</SubmitButton>
    </form>
  );
}

export function ProductsManager({ startupId, products }: { startupId: string; products: Product[] }) {
  return (
    <div className="space-y-6">
      {products.length > 0 ? (
        <ul className="space-y-3">
          {products.map((p) => (
            <li key={p.id} className="rounded-lg border border-line">
              <details>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium">
                  <span className="truncate">{p.name}</span><span className="text-xs text-muted">Edit</span>
                </summary>
                <div className="space-y-4 border-t border-line p-4">
                  <ProductForm startupId={startupId} product={p} />
                  <ConfirmActionForm action={deleteProductAction} fields={{ startupId, productId: p.id }} trigger="Delete product"
                    title={`Delete ${p.name}?`} description="It will be removed from your public profile." confirmLabel="Delete product" />
                </div>
              </details>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-muted">No products yet.</p>}

      {products.length >= LIMITS.products ? (
        <p className="text-sm text-muted">You’ve reached the limit of <span className="tabular-nums">{LIMITS.products}</span> products.</p>
      ) : (
        <div className="rounded-lg border border-line bg-primary-pale p-4">
          <h3 className="mb-3 font-semibold">Add a product or service</h3>
          <ProductForm startupId={startupId} />
        </div>
      )}
    </div>
  );
}
