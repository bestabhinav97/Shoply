import { useState } from "react";
import { Input } from "../../../../components/ui/Input";
import { priceFromText, priceToText } from "../../utils/productCreation";

export function VariantPriceInput({ label, value, onChange }) {
  const [text, setText] = useState(() => priceToText(value));
  return (
    <Input
      label={label}
      required
      inputMode="decimal"
      value={text}
      placeholder="449.00"
      maxLength={11}
      onChange={(e) => {
        setText(e.target.value);
        onChange(priceFromText(e.target.value));
      }}
    />
  );
}
