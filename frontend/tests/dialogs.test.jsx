import { useState } from 'react';
import { expect, test, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from '../src/components/ui/Modal';
import { Drawer } from '../src/components/ui/Drawer';

function Example({ Component }) {
  const [open, setOpen] = useState(false);
  return <><button onClick={() => setOpen(true)}>Open panel</button>
    <Component open={open} onClose={() => setOpen(false)} label="Example panel"><h2>Panel title</h2></Component>
  </>;
}

for (const Component of [Modal, Drawer]) {
  test.each(['close button', 'Escape', 'backdrop'])(`${Component.name} dismisses with %s and restores focus`, async (method) => {
    const user = userEvent.setup();
    render(<Example Component={Component} />);
    const trigger = screen.getByRole('button', { name: 'Open panel' });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Example panel' });
    const close = within(dialog).getByRole('button', { name: 'Close dialog' });
    expect(close).toHaveFocus();
    expect(close).toHaveTextContent('');
    expect(document.body.style.overflow).toBe('hidden');
    if (method === 'close button') await user.click(close);
    else if (method === 'Escape') fireEvent(dialog, new Event('cancel', { cancelable: true }));
    else {
      vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({ left: 10, right: 110, top: 10, bottom: 110 });
      fireEvent.click(dialog, { clientX: 0, clientY: 0 });
    }
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
  });
}

function Nested() {
  const [outer, setOuter] = useState(false);
  const [inner, setInner] = useState(false);
  return <><button onClick={() => setOuter(true)}>Open outer</button>
    <Modal open={outer} onClose={() => setOuter(false)} label="Outer">
      <button onClick={() => setInner(true)}>Open inner</button>
      <Modal open={inner} onClose={() => setInner(false)} label="Inner"><h2>Inner title</h2></Modal>
    </Modal>
  </>;
}

test('nested address-style dialogs preserve scroll lock and restore their own triggers', async () => {
  const user = userEvent.setup();
  const view = render(<Nested />);
  await user.click(screen.getByRole('button', { name: 'Open outer' }));
  const trigger = screen.getByRole('button', { name: 'Open inner' });
  await user.click(trigger);
  await user.click(within(screen.getByRole('dialog', { name: 'Inner' })).getByRole('button', { name: 'Close dialog' }));
  expect(trigger).toHaveFocus();
  expect(document.body.style.overflow).toBe('hidden');
  await user.click(trigger);
  view.unmount();
  expect(document.body.style.overflow).toBe('');
});
