/**
 * Asks the browser to keep this app's storage even when the device is low on
 * space. Without it, browsers may clear site data under storage pressure.
 */

export interface StorageStatus {
  /** Whether the browser has promised to keep the data. null = unknown/unsupported. */
  persisted: boolean | null;
  usageBytes: number | null;
  quotaBytes: number | null;
}

export async function getStorageStatus(): Promise<StorageStatus> {
  const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  if (!storage) return { persisted: null, usageBytes: null, quotaBytes: null };
  const [persisted, estimate] = await Promise.all([
    storage.persisted ? storage.persisted() : Promise.resolve(null),
    storage.estimate ? storage.estimate() : Promise.resolve(undefined),
  ]);
  return { persisted, usageBytes: estimate?.usage ?? null, quotaBytes: estimate?.quota ?? null };
}

export async function requestPersistentStorage(): Promise<boolean> {
  const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  if (!storage?.persist) return false;
  try {
    return await storage.persist();
  } catch {
    return false;
  }
}
