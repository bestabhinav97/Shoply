import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../../../components/ui/Button";
import { Icon } from "../../../../components/ui/Icon";
import { blank } from "../../utils/productEditor";
import { creationErrors, specificationsFromRows } from "../../utils/productCreation";
import { useSaveAdminProduct } from "../../hooks/useAdminProduct";
import { ProductCreateDetails } from "./ProductCreateDetails";
import { ProductOptionsEditor } from "../product-form/ProductOptionsEditor";
import { ProductVariantsEditor } from "../product-form/ProductVariantsEditor";
import { ProductImagesEditor } from "../product-form/ProductImagesEditor";
import { ProductCreateReview } from "./ProductCreateReview";

const steps = [
  {
    id: "details",
    name: "Details",
    description: "Start with the information shared by every variant.",
  },
  {
    id: "options",
    name: "Options",
    description:
      "Define the choices for this product, or continue without options for a simple product.",
  },
  {
    id: "variants",
    name: "Variants",
    description:
      "Add the combinations you sell. Stock belongs to each individual variant.",
  },
  {
    id: "images",
    name: "Images",
    description:
      "Add shared photos or link a photo to a particular variant. You can also continue without images.",
  },
  {
    id: "review",
    name: "Review",
    description: "Check the product before saving it to your catalog.",
  },
];

export function ProductCreateForm({ categories }) {
  const [product, setProduct] = useState(blank);
  const [specifications, setSpecifications] = useState([]);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState([]);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const heading = useRef(null);
  const save = useSaveAdminProduct();
  const navigate = useNavigate();
  const set = (key, value) => setProduct((p) => ({ ...p, [key]: value }));
  const current = steps[step];
  // Announce each new section and restore a predictable keyboard starting point.
  useEffect(() => {
    heading.current?.focus();
  }, [step]);
  function back() {
    setErrors([]);
    setCategoryOpen(false);
    setStep(step - 1);
  }
  async function submit(event) {
    event.preventDefault();
    if (save.isPending || categoryOpen) return;
    const problems = creationErrors(
      product,
      specifications,
      current.id === "review" ? undefined : current.id,
    );
    setErrors(problems);
    if (problems.length) {
      if (current.id === "review")
        setStep(
          steps.findIndex(
            (s) => creationErrors(product, specifications, s.id).length,
          ),
        );
      return;
    }
    if (step < steps.length - 1) {
      setStep(step + 1);
      return;
    }
    try {
      await save.mutateAsync({
        ...product,
        specifications: specificationsFromRows(specifications),
      });
      navigate("/admin/products", { state: { saved: true } });
    } catch (error) {
      setErrors([
        error.message,
        ...Object.entries(error.fields || {}).map(
          ([field, message]) => `${field}: ${message}`,
        ),
      ]);
    }
  }
  return (
    <form className="product-editor product-create" onSubmit={submit}>
      <nav aria-label="Product creation progress">
        <ol className="creation-steps">
          {steps.map((s, i) => (
            <li
              key={s.id}
              aria-current={step === i ? "step" : undefined}
              className={i < step ? "complete" : ""}
            >
              <span>{i < step ? <Icon name="check" /> : i + 1}</span>
              {s.name}
            </li>
          ))}
        </ol>
      </nav>
      <div className="creation-heading">
        <p className="muted">
          Step {step + 1} of {steps.length}
        </p>
        <h2 tabIndex={-1} ref={heading}>
          {current.name}
        </h2>
        <p>{current.description}</p>
      </div>
      {errors.length > 0 && (
        <div role="alert" className="editor-error">
          <p>Please check the following:</p>
          <ul>
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      <fieldset className="creation-body" disabled={save.isPending}>
        <legend className="sr-only">{current.name}</legend>
        {current.id === "details" && (
          <ProductCreateDetails
            product={product}
            set={set}
            categories={categories}
            specifications={specifications}
            setSpecifications={setSpecifications}
            onCategoryOpen={setCategoryOpen}
          />
        )}
        {current.id === "options" && (
          <ProductOptionsEditor
            options={product.options}
            variants={product.variants}
            onChange={(value) => set("options", value)}
          />
        )}
        {current.id === "variants" && (
          <ProductVariantsEditor
            options={product.options}
            variants={product.variants}
            images={product.images}
            onChange={(value) => set("variants", value)}
            pricesInSek
          />
        )}
        {current.id === "images" && (
          <ProductImagesEditor
            images={product.images}
            variants={product.variants}
            onChange={(value) => set("images", value)}
          />
        )}
        {current.id === "review" && (
          <ProductCreateReview
            onEdit={(index) => {
              setErrors([]);
              setStep(index);
            }}
            product={product}
            categories={categories}
            specifications={specifications}
          />
        )}
      </fieldset>
      <div className="creation-footer">
        <div className="editor-actions">
          {step > 0 && (
            <Button disabled={save.isPending} onClick={back}>
              Back
            </Button>
          )}
          <Link className="text-button" to="/admin/products">
            Cancel
          </Link>
        </div>
        <div className="editor-actions">
          <Button
            variant="primary"
            type="submit"
            disabled={save.isPending || categoryOpen}
          >
            {save.isPending
              ? "Saving…"
              : step === steps.length - 1
                ? "Save product"
                : "Continue"}
          </Button>
        </div>
      </div>
    </form>
  );
}
