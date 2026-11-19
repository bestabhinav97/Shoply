import { afterEach, test, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ProductGallery } from '../src/features/products/components/details/ProductGallery';
import { RelatedProducts } from '../src/features/products/components/details/RelatedProducts';

afterEach(() => vi.unstubAllGlobals());

test('gallery thumbnails select photos and the zoom dialog dismisses with Escape', async () => {
  const prototype = HTMLDialogElement.prototype;
  const show = Object.getOwnPropertyDescriptor(prototype, 'showModal');
  const close = Object.getOwnPropertyDescriptor(prototype, 'close');
  Object.defineProperty(prototype, 'showModal', { configurable: true, value() { this.open = true; } });
  Object.defineProperty(prototype, 'close', { configurable: true, value() { this.open = false; } });
  const images = [{ url: '/one.webp', alt: 'Front of cup', width: 800, height: 800 }, { url: '/two.webp', alt: 'Side of cup', width: 800, height: 800 }];
  const user = userEvent.setup();
  let view;
  try {
    view = render(<ProductGallery images={images} productName="Cup" />);
    await user.click(screen.getByRole('button', { name: 'Show photo 2' }));
    expect(screen.getByRole('button', { name: 'Show photo 2' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('img', { name: 'Side of cup' })).toHaveAttribute('src', '/two.webp');
    await user.click(screen.getByRole('button', { name: 'Zoom photo of Cup' }));
    const dialog = screen.getByRole('dialog', { name: 'Cup enlarged photo' });
    expect(within(dialog).getByRole('img', { name: 'Side of cup' })).toBeVisible();
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  } finally {
    view?.unmount();
    if (show) Object.defineProperty(prototype, 'showModal', show); else delete prototype.showModal;
    if (close) Object.defineProperty(prototype, 'close', close); else delete prototype.close;
  }
});

test('missing photos have a labeled fallback and no nonfunctional zoom control', () => {
  render(<ProductGallery images={[]} productName="Cup" />);
  expect(screen.getByRole('img', { name: 'Product photo unavailable' })).toBeVisible();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

test('recommendations use category data, exclude the current product, and preserve SEK prices', async () => {
  const product = { id: 'current', category: { slug: 'home', name: 'Home' } };
  const other = { id: 'other', name: 'Another cup', category: product.category, priceMinor: 14900, inStock: true };
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ items: [{ ...other, id: 'current' }, other] }))));
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><RelatedProducts product={product} /></MemoryRouter></QueryClientProvider>);
  expect(await screen.findByRole('heading', { level: 3, name: 'Another cup' })).toBeVisible();
  expect(screen.getByText('149,00 kr')).toBeVisible();
  expect(screen.getAllByRole('article')).toHaveLength(1);
  expect(fetch.mock.calls[0][0]).toContain('category=home');
});
