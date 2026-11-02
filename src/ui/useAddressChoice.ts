import { useState } from 'react';

/**
 * A choice kept in the page address (so reloading and sharing keep it) that
 * changes on screen at once when made here, without waiting for the address
 * to update. As soon as the address changes (catching up, or because of a
 * link), the address is followed again.
 *
 * Returns the current value and a function to call, together with the address
 * update, when the choice is made here.
 */
export function useAddressChoice<T>(fromAddress: T): [T, (next: T) => void] {
  // A choice made here while the address still says `from`.
  const [pending, setPending] = useState<{ value: T; from: T } | null>(null);
  const waiting = pending !== null && Object.is(fromAddress, pending.from);
  // The address moved on: forget the choice (React's way of adjusting state to new props).
  if (pending !== null && !waiting) setPending(null);
  const current = waiting ? pending.value : fromAddress;
  const choose = (next: T) =>
    setPending(Object.is(next, fromAddress) ? null : { value: next, from: fromAddress });
  return [current, choose];
}
