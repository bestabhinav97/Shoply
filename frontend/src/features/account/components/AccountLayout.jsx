import { Outlet, useLocation } from 'react-router-dom';
import { Breadcrumbs } from '../../../components/ui/Breadcrumbs';
import { AccountSidebar } from './AccountSidebar';
import '../styles/account.css';

const titles = { profile: 'Profile', addresses: 'Addresses', 'payment-methods': 'Payment methods', orders: 'Orders' };

export function AccountLayout() {
  const { pathname } = useLocation();
  const title = titles[pathname.split('/').filter(Boolean).at(-1)];
  return <main className="account-area container">
    <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Account', to: '/account' }, ...(title ? [{ label: title }] : [])]} />
    <div className="account-columns">
      <aside><p className="account-nav-title">My account</p><AccountSidebar /></aside>
      <div className="account-content">{title === 'Profile' ? <Outlet /> : <section className="account-panel"><Outlet /></section>}</div>
    </div>
  </main>;
}
