import { useState } from 'react';
import { test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuantityStepper } from '../src/components/ui/QuantityStepper';

function Example({ initial = '1', disabled = false }) {
  const [value, setValue] = useState(initial);
  return <QuantityStepper value={value} onChange={setValue} max={3} disabled={disabled} />;
}

test('stepper has a label, respects boundaries, and works with keyboard controls', async () => {
  const user = userEvent.setup();
  render(<Example />);
  expect(screen.getByLabelText('Quantity')).toHaveValue(1);
  expect(screen.getByRole('button', { name: 'Decrease quantity' })).toBeDisabled();
  await user.tab();
  expect(screen.getByLabelText('Quantity')).toHaveFocus();
  await user.tab();
  await user.keyboard('{Enter}');
  expect(screen.getByLabelText('Quantity')).toHaveValue(2);
  await user.click(screen.getByRole('button', { name: 'Increase quantity' }));
  expect(screen.getByLabelText('Quantity')).toHaveValue(3);
  expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Decrease quantity' }));
  expect(screen.getByLabelText('Quantity')).toHaveValue(2);
});

test('manual entry reports invalid quantities and disabled controls cannot change values', async () => {
  const user = userEvent.setup();
  const view = render(<Example />);
  const input = screen.getByLabelText('Quantity');
  await user.clear(input);
  expect(input).toHaveAttribute('aria-invalid', 'true');
  await user.type(input, '4');
  expect(screen.getByText('Choose 1–3.')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Decrease quantity' }));
  expect(input).toHaveValue(1);
  view.unmount();
  render(<Example disabled />);
  expect(screen.getByLabelText('Quantity')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeDisabled();
});
