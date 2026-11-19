import { useEffect, useRef, useState } from "react";
import { Link, useBeforeUnload, useBlocker, useNavigate } from "react-router-dom";
import { Button } from "../../../../components/ui/Button";
import { Modal } from "../../../../components/ui/Modal";
import { editable } from "../../utils/productEditor";
import { creationErrors } from "../../utils/productCreation";
import { fetchAdminProduct } from "../../api/adminProducts.api";
import { useSaveAdminProduct } from "../../hooks/useAdminProduct";
import { ProductCreateDetails } from "../product-create/ProductCreateDetails";
import { ProductOptionsEditor } from "../product-form/ProductOptionsEditor";
import { ProductVariantsEditor } from "../product-form/ProductVariantsEditor";
import { ProductImagesEditor } from "../product-form/ProductImagesEditor";

function specificationRows(specifications) {
  return Object.entries(specifications).map(([name, original]) => ({
    id: crypto.randomUUID(), name, original,
    value: typeof original === "string" ? original : JSON.stringify(original),
  }));
}

function specificationValues(rows) {
  return Object.fromEntries(rows.map((row) => {
    const originalText = typeof row.original === "string"
      ? row.original : JSON.stringify(row.original);
    return [row.name.trim(), row.value === originalText ? row.original : row.value.trim()];
  }));
}

export function ProductEditForm({ id, initial, categories }) {
  const [product, setProduct] = useState(() => editable(initial));
  const [specifications, setSpecifications] = useState(() => specificationRows(initial.specifications));
  const [baseline, setBaseline] = useState(() => JSON.stringify(editable(initial)));
  const [errors, setErrors] = useState([]);
  const [conflict, setConflict] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [reloadOpen, setReloadOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [generation, setGeneration] = useState(0);
  const alert = useRef(null);
  const leavingAfterSave = useRef(false);
  const save = useSaveAdminProduct(id);
  const navigate = useNavigate();
  const body = { ...product, specifications: specificationValues(specifications) };
  const dirty = JSON.stringify(body) !== baseline;
  const busy = save.isPending || reloading;
  // The data router covers links, programmatic navigation and browser Back/Forward.
  const blocker = useBlocker(() => !leavingAfterSave.current && (dirty || busy));
  useEffect(() => {
    if (blocker.state === "blocked" && busy) blocker.reset();
  }, [blocker, busy]);
  useBeforeUnload((event) => {
    if ((dirty || busy) && !leavingAfterSave.current) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  useEffect(() => {
    if (errors.length) alert.current?.focus();
  }, [errors]);

  async function submit(event) {
    event.preventDefault();
    if (busy || categoryOpen || conflict) return;
    const problems = creationErrors(product, specifications);
    setErrors(problems);
    if (problems.length) return;
    try {
      await save.mutateAsync(body);
      leavingAfterSave.current = true;
      navigate("/admin/products", { state: { saved: true } });
    } catch (failure) {
      setErrors([failure.message, ...Object.entries(failure.fields || {}).map(
        ([field, message]) => `${field}: ${message}`,
      )]);
      // Duplicate slug/SKU conflicts remain editable; only a stale version needs reload.
      setConflict(failure.status === 409 && failure.message.startsWith("This product changed."));
    }
  }

  async function reload() {
    setReloadOpen(false);
    setReloading(true);
    try {
      const { product: latest } = await fetchAdminProduct(id);
      const next = editable(latest);
      setProduct(next);
      setSpecifications(specificationRows(latest.specifications));
      setBaseline(JSON.stringify(next));
      setGeneration((value) => value + 1);
      setCategoryOpen(false);
      setConflict(false);
      setErrors([]);
    } catch (failure) {
      setErrors([failure.message]);
    } finally {
      setReloading(false);
    }
  }

  const set = (key, value) => setProduct((current) => ({ ...current, [key]: value }));
  function closeConfirmation() {
    setReloadOpen(false);
    if (blocker.state === "blocked") blocker.reset();
  }

  return (
    <>
    <form className="product-editor product-create product-edit" onSubmit={submit}>
      <div className="creation-heading">
        <h2>Product configuration</h2>
        <p>Save your changes together. Removing a variant removes its stock record. Deactivate variants you want to keep.</p>
        <p role="status">{dirty ? "Unsaved changes" : "No unsaved changes"}</p>
      </div>
      {errors.length > 0 && (
        <div role="alert" className="editor-error" ref={alert} tabIndex={-1}>
          <ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul>
          {conflict && <p>Your edits are kept here until you choose to reload.</p>}
          {conflict && <Button onClick={() => setReloadOpen(true)} disabled={busy}>Reload latest product</Button>}
        </div>
      )}
      <fieldset className="creation-body" disabled={busy} key={generation}>
        <legend className="sr-only">Edit product configuration</legend>
        <ProductCreateDetails product={product} set={set} categories={categories}
          specifications={specifications} setSpecifications={setSpecifications}
          onCategoryOpen={setCategoryOpen} editing />
        <ProductOptionsEditor options={product.options} variants={product.variants}
          onChange={(value) => set("options", value)} />
        <ProductVariantsEditor variants={product.variants} options={product.options}
          images={product.images} onChange={(value) => set("variants", value)} pricesInSek />
        <ProductImagesEditor images={product.images} variants={product.variants}
          onChange={(value) => set("images", value)} />
      </fieldset>
      <div className="creation-footer">
        <Link className="text-button" to="/admin/products">Cancel</Link>
        <Button type="submit" variant="primary" disabled={busy || categoryOpen || conflict}>
          {save.isPending ? "Saving…" : reloading ? "Reloading…" : "Save product"}
        </Button>
      </div>
    </form>
    <Modal open={reloadOpen || (blocker.state === "blocked" && !busy)} onClose={closeConfirmation}
      label={reloadOpen ? 'Reload latest product?' : 'Discard unsaved changes?'} className="product-confirm-modal">
      <h2>{reloadOpen ? 'Reload latest product?' : 'Discard unsaved changes?'}</h2>
      <p>{reloadOpen ? 'Reload the latest product and discard your local changes?' : 'Your unsaved product changes will be lost.'}</p>
      <div className="account-actions">
        <Button onClick={closeConfirmation}>Keep editing</Button>
        <Button variant="primary" onClick={reloadOpen ? reload : () => blocker.proceed()}>{reloadOpen ? 'Reload product' : 'Discard changes'}</Button>
      </div>
    </Modal>
    </>
  );
}
