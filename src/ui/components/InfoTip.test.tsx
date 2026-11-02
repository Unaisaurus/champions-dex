import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InfoTip } from './InfoTip';

function renderTip() {
  render(
    <p>
      Ability: <InfoTip label="Levitate">Gives full immunity to Ground-type moves.</InfoTip>
      <button type="button">Elsewhere</button>
    </p>,
  );
  return screen.getByRole('button', { name: 'Levitate' });
}

describe('InfoTip', () => {
  it('opens on a click or tap and stays open until closed', () => {
    const word = renderTip();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.click(word);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Ground-type');
    expect(word).toHaveAttribute('aria-expanded', 'true');
    expect(word).toHaveAccessibleDescription('Gives full immunity to Ground-type moves.');
    fireEvent.click(word);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('closes with Escape or a tap elsewhere, but not a tap on the bubble', () => {
    const word = renderTip();
    fireEvent.click(word);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.click(word);
    fireEvent.pointerDown(screen.getByRole('tooltip'));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Elsewhere' }));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
