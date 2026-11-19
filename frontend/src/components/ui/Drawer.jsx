import { useEffect, useRef } from "react";
import { ModalCloseButton } from "./ModalCloseButton";
import { lockDialogScroll } from './dialogScrollLock';
import "./drawer.css";

export function Drawer({ id, open, onClose, label, children }) {
  const dialog = useRef(null);

  useEffect(() => {
    const element = dialog.current;

    if (!open) return;
    const trigger = document.activeElement;
    const unlockScroll = lockDialogScroll();
    if (!element.open) element.showModal();
    element.querySelector('button, [href], [tabindex="0"]')?.focus();
    return () => {
      if (element.open) element.close();
      unlockScroll();
      if (trigger?.isConnected) trigger.focus();
    };
  }, [open]);

  return (
    <dialog
      ref={dialog}
      id={id}
      className="drawer"
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="drawer-panel">
        <ModalCloseButton onClick={onClose} />
        {children}
      </div>
    </dialog>
  );
}
