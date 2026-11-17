import { useId } from "react";

export function Input({
  id,
  label,
  labelClassName,
  prefix,
  className = "",
  ...props
}) {
  const generatedId = useId();
  const inputId = id || generatedId;

  const input = (
    <input id={inputId} className={`ui-input ${className}`.trim()} {...props} />
  );

  return (
    <>
      <label htmlFor={inputId} className={labelClassName}>
        {label}
      </label>
      {prefix ? (
        <div className="ui-input-group">
          <span className="ui-input-prefix" aria-hidden="true">
            {prefix}
          </span>
          {input}
        </div>
      ) : (
        input
      )}
    </>
  );
}
