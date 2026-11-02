import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SearchSelect, type SearchSelectOption } from './SearchSelect';

const OPTIONS: SearchSelectOption[] = [
  { id: 'thunderbolt', label: 'Thunderbolt', searchText: 'Rayo' },
  { id: 'thunder', label: 'Thunder', searchText: 'Trueno' },
  { id: 'surf', label: 'Surf' },
];

function Harness({ onChange }: { onChange?: (id: string | null) => void }) {
  const [value, setValue] = useState<string | null>(null);
  return (
    <SearchSelect
      label="Move"
      options={OPTIONS}
      value={value}
      onChange={(id) => {
        setValue(id);
        onChange?.(id);
      }}
      noMatches="No matches"
      clearLabel="Clear"
    />
  );
}

describe('SearchSelect', () => {
  it('filters by any of the names and picks with the keyboard', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByRole('combobox', { name: 'Move' });
    fireEvent.focus(input);
    expect(screen.getAllByRole('option')).toHaveLength(3);

    fireEvent.change(input, { target: { value: 'rayo' } });
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Thunderbolt']);

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith('thunderbolt');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(input).toHaveValue('Thunderbolt');
  });

  it('moves through the list with the arrow keys', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByRole('combobox', { name: 'Move' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'thun' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveAttribute('aria-activedescendant', screen.getAllByRole('option')[1]?.id);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith('thunder');
  });

  it('says when nothing matches and closes with Escape', () => {
    render(<Harness />);
    const input = screen.getByRole('combobox', { name: 'Move' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'zzz' } });
    expect(screen.getByText('No matches')).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('can be cleared', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByRole('combobox', { name: 'Move' });
    fireEvent.focus(input);
    fireEvent.click(screen.getByRole('option', { name: 'Surf' }));
    expect(onChange).toHaveBeenLastCalledWith('surf');
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
