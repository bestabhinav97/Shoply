import { useEffect, useRef } from 'react';
import { Button } from './Button';

export function Modal({ open, onClose, label, closeLabel = 'Close enlarged photo', children }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
    return () => { if (element.open) element.close(); };
  }, [open]);
  return <dialog ref={dialog} className="modal" aria-label={label} onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <Button className="modal-close" onClick={onClose} aria-label={closeLabel}>Close ×</Button>
    {open && children}
  </dialog>;
}
