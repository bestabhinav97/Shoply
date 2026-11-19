import { Icon } from './Icon';
import './modal-close.css';

export function ModalCloseButton({ onClick, disabled = false }) {
  return <button type="button" className="modal-close" aria-label="Close dialog" onClick={onClick} disabled={disabled}>
    <Icon name="close" />
  </button>;
}
