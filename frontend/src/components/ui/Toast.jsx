export function Toast({ children, tone = 'success' }) {
  return <div className={`feedback-banner feedback-${tone}`} role={tone === 'error' ? 'alert' : 'status'} aria-live={tone === 'error' ? 'assertive' : 'polite'}>{children}</div>;
}
