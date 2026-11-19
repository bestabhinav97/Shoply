import { useEffect, useRef } from 'react';
import { ModalCloseButton } from './ModalCloseButton';
import { lockDialogScroll } from './dialogScrollLock';

export function Modal({ open, onClose, label, labelledBy, describedBy, className = '', dismissible = true, children }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    if (!open) return;
    const trigger = document.activeElement;
    const unlockScroll = lockDialogScroll();
    if (open && !element.open) element.showModal();
    element.querySelector('button, [href], [tabindex="0"]')?.focus();
    return () => {
      if (element.open) element.close();
      unlockScroll();
      if (trigger?.isConnected) trigger.focus();
    };
  }, [open]);
  return <dialog ref={dialog} className={`modal ${className}`.trim()} aria-modal="true" aria-label={labelledBy ? undefined : label}
    aria-labelledby={labelledBy} aria-describedby={describedBy}
    onCancel={(event) => { event.preventDefault(); if (dismissible) onClose(); }}
    onClick={(event) => {
      if (!dismissible || event.currentTarget !== event.target) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }}>
    <ModalCloseButton onClick={onClose} disabled={!dismissible} />
    {open && children}
  </dialog>;
}
