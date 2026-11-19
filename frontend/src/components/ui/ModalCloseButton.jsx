import { Icon } from './Icon';
import './modal-close.css';

export function ModalCloseButton({ onClick }) {
  return <button type="button" className="modal-close" aria-label="Close dialog" onClick={onClick}>
    <Icon name="close" />
  </button>;
}
