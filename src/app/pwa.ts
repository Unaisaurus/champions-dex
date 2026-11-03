/**
 * The installable app: a service worker keeps the app and its data on the
 * device (so it works offline) and the artwork you've seen. When a new version
 * has been published, it's downloaded in the background and waits until you
 * choose to reload (`updateReady`).
 */
import { create } from 'zustand';
import type { CoreData, Manifest } from '@/data/contracts';
import { imageSources } from '@/ui/images';

/** Chrome's install prompt (not in TypeScript's DOM types yet). */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type ArtworkJob =
  | { state: 'idle' }
  | { state: 'saving'; done: number; total: number; failed: number }
  | { state: 'done'; total: number; failed: number }
  | { state: 'stopped'; done: number; total: number };

interface PwaState {
  /** False when the browser can't keep the app for offline use. */
  supported: boolean;
  /** The app and its data are saved on the device. */
  offlineReady: boolean;
  /** A new version is waiting. */
  updateReady: boolean;
  /** Reloads into the new version. */
  applyUpdate: (() => void) | null;
  /** The browser's own install prompt, when it offers one. */
  installPrompt: InstallPromptEvent | null;
  /** Set once, when the app has just been saved for offline use for the first time. */
  justSavedOffline: boolean;
  artwork: ArtworkJob;
}

export const usePwa = create<PwaState>(() => ({
  supported: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
  offlineReady: false,
  updateReady: false,
  applyUpdate: null,
  installPrompt: null,
  justSavedOffline: false,
  artwork: { state: 'idle' },
}));

/** Whether the app is running installed (on its own, not in a browser tab). */
export function isInstalled(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

/** Registers the service worker (production builds only) and listens for install prompts. */
export async function setupPwa(): Promise<void> {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    usePwa.setState({ installPrompt: event as InstallPromptEvent });
  });
  window.addEventListener('appinstalled', () => usePwa.setState({ installPrompt: null }));
  if (!usePwa.getState().supported || import.meta.env.DEV) return;

  const { registerSW } = await import('virtual:pwa-register');
  const updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      usePwa.setState({ updateReady: true, applyUpdate: () => void updateServiceWorker(true) });
    },
    onOfflineReady() {
      usePwa.setState({ offlineReady: true, justSavedOffline: true });
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      if (registration.active) usePwa.setState({ offlineReady: true });
      // Look for a new version every hour while the app stays open.
      setInterval(() => void registration.update(), 60 * 60 * 1000);
    },
  });
}

/** Shows the browser's install prompt. */
export async function promptInstall(): Promise<void> {
  const prompt = usePwa.getState().installPrompt;
  if (!prompt) return;
  await prompt.prompt();
  await prompt.userChoice;
  usePwa.setState({ installPrompt: null });
}

/** Every artwork and icon URL the app can show (shiny ones optional). */
export function artworkUrls(
  data: Pick<CoreData, 'forms' | 'items'>,
  manifest: Manifest,
  shiny: boolean,
): string[] {
  const keys = new Set<string>();
  for (const form of data.forms) {
    const art = form.art;
    for (const key of [art.official, art.officialFemale, art.icon]) if (key) keys.add(key);
    if (shiny)
      for (const key of [art.officialShiny, art.officialFemaleShiny, art.iconShiny]) if (key) keys.add(key);
  }
  for (const item of data.items) if (item.icon) keys.add(item.icon);
  const urls = new Set<string>();
  for (const key of keys) {
    for (const url of imageSources(key, manifest.images)) if (url.startsWith('https://')) urls.add(url);
  }
  return [...urls];
}

/** A rough size for a set of artwork URLs, from typical file sizes. */
export function estimateArtworkBytes(urls: readonly string[]): number {
  return urls.reduce(
    (total, url) =>
      total + (url.includes('/official-artwork/') ? 140_000 : url.includes('/icons/') ? 15_000 : 2_000),
    0,
  );
}

let stopRequested = false;

/** Downloads every artwork once, so the service worker keeps it for offline use. */
export async function saveAllArtwork(urls: readonly string[]): Promise<void> {
  if (usePwa.getState().artwork.state === 'saving') return;
  stopRequested = false;
  let done = 0;
  let failed = 0;
  const total = urls.length;
  usePwa.setState({ artwork: { state: 'saving', done, total, failed } });
  let next = 0;
  const worker = async () => {
    while (next < urls.length && !stopRequested) {
      const url = urls[next++] as string;
      try {
        const response = await fetch(url, { mode: 'cors' });
        if (!response.ok) failed += 1;
        // Read the body so the whole file is stored.
        await response.arrayBuffer();
      } catch {
        failed += 1;
      }
      done += 1;
      if (done % 10 === 0 || done === total) {
        usePwa.setState({ artwork: { state: 'saving', done, total, failed } });
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  usePwa.setState({
    artwork: stopRequested ? { state: 'stopped', done, total } : { state: 'done', total, failed },
  });
}

export function stopSavingArtwork(): void {
  stopRequested = true;
}
