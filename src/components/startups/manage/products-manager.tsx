"use client";

import { useActionState, useState } from "react";
import { deleteProductAction, saveProductAction } from "@/app/dashboard/startup/actions";
import { TextAreaField, TextField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { ConfirmActionForm } from "@/components/forms/confirm-action-form";
import { FormMessage, firstError, valueOf } from "@/components/forms/form-message";
import { LIMITS } from "@/lib/startups/constants";
import { idleState } from "@/lib/types";

type Product = { id: string; name: string; description: string | null; url: string | null; content_type?: "external_link" | "file_upload"; file_name?: string | null };

function ProductForm({ startupId, product }: { startupId: string; product?: Product }) {
  const [state, action] = useActionState(saveProductAction, idleState);
  const editing = Boolean(product);
  const [contentType,setContentType] = useState<"external_link"|"file_upload">(product?.content_type ?? "external_link");
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
      <fieldset className="space-y-2"><legend className="text-sm font-medium">How should people access this product?</legend>
        <div className="flex flex-wrap gap-4 text-sm"><label className="flex items-center gap-2"><input type="radio" name="contentType" value="external_link" checked={contentType==="external_link"} onChange={()=>setContentType("external_link")}/>External link</label><label className="flex items-center gap-2"><input type="radio" name="contentType" value="file_upload" checked={contentType==="file_upload"} onChange={()=>setContentType("file_upload")}/>Upload a file</label></div>
      </fieldset>
      {contentType === "external_link" ? <TextField label="External product link" name="url" type="url" inputMode="url" placeholder="https://" defaultValue={pick("url", product?.content_type==="file_upload" ? "" : product?.url ?? "")} error={firstError(state, "url")} /> : <div className="space-y-2"><label className="block text-sm font-medium" htmlFor={`product-file-${product?.id ?? "new"}`}>Product file</label><input id={`product-file-${product?.id ?? "new"}`} name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.zip,application/pdf,image/jpeg,image/png,image/webp,text/plain,application/zip" className="block w-full text-sm"/><p className="text-xs text-muted">PDF, image, text or ZIP · up to 20 MB. {product?.file_name ? `Current file: ${product.file_name}. Choose another file to replace it.` : "A file is required when creating a product this way."}</p></div>}
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
                  <span className="min-w-0 truncate">{p.name}<span className="ml-2 text-xs font-normal text-muted">{p.content_type === "file_upload" ? "Uploaded file" : "External link"}</span></span><span className="text-xs text-muted">Edit</span>
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
