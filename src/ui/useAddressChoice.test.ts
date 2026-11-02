import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAddressChoice } from './useAddressChoice';

describe('useAddressChoice', () => {
  it('shows a choice at once, then follows the address again', () => {
    const { result, rerender } = renderHook(({ address }) => useAddressChoice(address), {
      initialProps: { address: 'edit' },
    });
    expect(result.current[0]).toBe('edit');

    act(() => result.current[1]('overview'));
    // Before the address has caught up.
    expect(result.current[0]).toBe('overview');

    rerender({ address: 'overview' });
    expect(result.current[0]).toBe('overview');

    // A link back to the first value wins.
    rerender({ address: 'edit' });
    expect(result.current[0]).toBe('edit');
  });
});
