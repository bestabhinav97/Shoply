const variants = {
  primary: "button primary",
  secondary: "button",
  text: "text-button",
  ghost: "button ghost",
};

export function Button({
  variant = "secondary",
  type = "button",
  className = "",
  size = "md",
  loading = false,
  disabled = false,
  children,
  ...props
}) {
  return (
    <button
      type={type}
      className={`${variants[variant]} button-${size} ${className}`.trim()}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <span className="spinner" aria-hidden="true" />}{children}
    </button>
  );
}
