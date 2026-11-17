import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth, useLogout } from '../../../features/auth';
import { CatalogSearch, CategoryNav } from '../../../features/products';
import { CartLink } from '../../../features/cart';
import { DeliveryLocation } from '../../../features/delivery';
import { Icon } from '../../ui/Icon';
import { Container } from '../../ui/Container';
import { Button } from '../../ui/Button';
import { Drawer } from '../../ui/Drawer';

function AccountLinks({ user, logout, onNavigate }) {
  return <>
    <Link to="/products" onClick={onNavigate}>Shop</Link>
    <Link to={user ? '/account' : '/login'} onClick={onNavigate}>{user ? 'My account' : 'Sign in / Register'}</Link>
    {user && <Link to="/account/orders" onClick={onNavigate}>Orders</Link>}
    {user?.role === 'admin' && <Link to="/admin" onClick={onNavigate}>Admin</Link>}
    {user && <Button variant="ghost" loading={logout.isPending} onClick={() => logout.mutate(false)}>Sign out</Button>}
    {logout.error && <p role="alert">{logout.error.message}</p>}
  </>;
}

function AccountMenu({ user, logout }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef(null);
  const menu = useRef(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event) => { if (!menu.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);
  return <div ref={menu} className="account-menu" onKeyDown={(event) => {
    if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); }
  }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button ref={trigger} className="account-trigger" type="button" aria-label={user ? `${user.firstName}, account menu` : 'Account menu'}
      aria-expanded={open} aria-controls="account-dropdown" onClick={() => setOpen(!open)}>
      <span className="account-avatar" aria-hidden="true">{user?.firstName?.slice(0, 1).toUpperCase() || 'S'}</span>
      <span className="account-menu-label">{user?.firstName || 'Your account'}</span><Icon name="chevron" />
    </button>
    <div id="account-dropdown" className="account-dropdown" hidden={!open}>
      <AccountLinks user={user} logout={logout} onNavigate={() => setOpen(false)} />
    </div>
  </div>;
}

function MobileMenu({ user, logout }) {
  const [open, setOpen] = useState(false);
  return <div className="mobile-menu">
    <Button variant="ghost" aria-label="Open navigation" aria-controls="mobile-navigation" aria-expanded={open} onClick={() => setOpen(true)}><Icon name="menu" /></Button>
    <Drawer id="mobile-navigation" open={open} onClose={() => setOpen(false)} label="Navigation">
      <h2>Explore Shoply</h2><nav className="mobile-navigation" aria-label="Mobile navigation">
        <Link to="/" onClick={() => setOpen(false)}>Home</Link>
        <AccountLinks user={user} logout={logout} onNavigate={() => setOpen(false)} />
      </nav>
    </Drawer>
  </div>;
}

export function Header() {
  const auth = useAuth();
  const logout = useLogout();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const accountKey = `${location.key}-${auth.data?.id || 'guest'}`;
  return <header className={`site-header${scrolled ? ' is-scrolled' : ''}`}>
    <div className="announcement-bar">A little everyday inspiration. <span>Demo store · Checkout coming soon</span></div>
    <Container className="header-inner">
      <Link className="wordmark" to="/" aria-label="Shoply home">shoply<span aria-hidden="true">✳</span></Link>
      <DeliveryLocation key={auth.data?.id || 'guest'} user={auth.data} authPending={auth.isPending} authError={auth.error} />
      <CatalogSearch />
      <nav className="header-navigation" aria-label="Main navigation">
        <AccountMenu key={accountKey} user={auth.data} logout={logout} />
        <CartLink />
        <MobileMenu key={`mobile-${accountKey}`} user={auth.data} logout={logout} />
      </nav>
    </Container>
    <CategoryNav />
  </header>;
}
