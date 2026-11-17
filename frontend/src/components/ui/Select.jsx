import { useId } from "react";

export function Select({
  id,
  label,
  labelClassName,
  className = "",
  children,
  ...props
}) {
  const generatedId = useId();
  const selectId = id || generatedId;

  return (
    <>
      <label htmlFor={selectId} className={labelClassName}>
        {label}
      </label>
      <select
        id={selectId}
        className={`ui-select ${className}`.trim()}
        {...props}
      >
        {children}
      </select>
    </>
  );
}
