import { useId } from 'react';
import { Button } from './Button';

export function QuantityStepper({ value, onChange, min = 1, max = 99, disabled = false, label = 'Quantity' }) {
  const id = useId();
  const numeric = Number(value);
  const valid = value !== '' && Number.isInteger(numeric) && numeric >= min && numeric <= max;
  return <div className="quantity-control">
    <label htmlFor={id}>{label}</label>
    <div className="quantity-stepper">
      <Button variant="ghost" disabled={disabled || numeric <= min} aria-label={`Decrease ${label.toLowerCase()}`}
        onClick={() => onChange(String(Math.max(min, (valid ? numeric : min) - 1)))}>−</Button>
      <input id={id} type="number" inputMode="numeric" min={min} max={max} step="1" required value={value}
        disabled={disabled} aria-invalid={!valid || undefined} onChange={(event) => onChange(event.target.value)} />
      <Button variant="ghost" disabled={disabled || numeric >= max} aria-label={`Increase ${label.toLowerCase()}`}
        onClick={() => onChange(String(Math.min(max, (valid ? numeric : min - 1) + 1)))}>+</Button>
    </div>
    {!valid && <span className="field-error">Choose {min}–{max}.</span>}
  </div>;
}
