import { useEffect, useRef } from "react";
import { Button } from "./Button";
import "./drawer.css";

export function Drawer({ id, open, onClose, label, children }) {
  const dialog = useRef(null);

  useEffect(() => {
    const element = dialog.current;

    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();

    return () => {
      if (element.open) element.close();
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
        <Button
          className="drawer-close"
          onClick={onClose}
          aria-label="Close menu"
        >
          Close ×
        </Button>
        {children}
      </div>
    </dialog>
  );
}
