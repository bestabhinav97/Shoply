import { NavLink } from 'react-router-dom';
import { Icon } from '../../../components/ui/Icon';
import { useAuth } from '../../auth';

const items = [
  { path: 'profile', label: 'Profile', icon: 'user' },
  { path: 'addresses', label: 'Addresses', icon: 'pin' },
  { path: 'payment-methods', label: 'Payment methods', icon: 'card' },
  { path: 'orders', label: 'Orders', icon: 'bag' },
];

export function AccountSidebar() {
  const { data: user } = useAuth();
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Your account';
  return <>
    <div className="account-user-summary">
      <span className="account-avatar" aria-hidden="true">{user?.firstName?.slice(0, 1).toUpperCase() || 'S'}</span>
      <div><p>{fullName}</p><span title={user?.email}>{user?.email}</span></div>
    </div>
    <nav className="account-sidebar" aria-label="Account navigation">
    {items.map(({ path, label, icon }) => <NavLink key={path} to={`/account/${path}`}>
      <Icon name={icon} /><span>{label}</span>
    </NavLink>)}
  </nav></>;
}
