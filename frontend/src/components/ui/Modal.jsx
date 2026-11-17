import { useEffect, useRef } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';

export function Modal({ open, onClose, label, labelledBy, describedBy, iconOnlyClose = false, closeLabel = 'Close enlarged photo', className = '', children }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    if (!open) return;
    const trigger = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (open && !element.open) element.showModal();
    element.querySelector('button, [href], [tabindex="0"]')?.focus();
    return () => {
      if (element.open) element.close();
      document.body.style.overflow = previousOverflow;
      if (trigger?.isConnected) trigger.focus();
    };
  }, [open]);
  return <dialog ref={dialog} className={`modal ${className}`.trim()} aria-modal="true" aria-label={labelledBy ? undefined : label}
    aria-labelledby={labelledBy} aria-describedby={describedBy}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => {
      if (event.currentTarget !== event.target) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }}>
    <Button className={`modal-close${iconOnlyClose ? ' modal-close-icon' : ''}`} onClick={onClose} aria-label={closeLabel}>
      {iconOnlyClose ? <Icon name="close" /> : 'Close ×'}
    </Button>
    {open && children}
  </dialog>;
}
