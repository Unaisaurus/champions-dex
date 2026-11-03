/**
 * Downloading source files, pinned to exact Git revisions and cached on disk,
 * so a run can be repeated (or redone offline) with identical results.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { log } from './log';
import { SOURCES_DIR } from './paths';

export interface GitSource {
  /** Short name used for the cache folder and the manifest. */
  id: string;
  name: string;
  /** `owner/repo` on GitHub. */
  repo: string;
  branch: string;
  /**
   * A known-good revision, used by `--offline` runs when the current data
   * doesn't name one yet (a source added since the last update).
   */
  pin?: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function downloadText(url: string, attempts = 4): Promise<string> {
  return decodeText(await downloadBytes(url, attempts));
}

export async function downloadBytes(url: string, attempts = 4): Promise<Buffer> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) return Buffer.from(await response.arrayBuffer());
      if (response.status === 404) throw new Error(`Not found: ${url}`);
      lastError = new Error(`HTTP ${response.status} for ${url}`);
    } catch (error) {
      lastError = error;
      if (error instanceof Error && error.message.startsWith('Not found')) throw error;
    }
    await sleep(500 * attempt);
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/** Latest commit of a branch: GitHub API first, then `git ls-remote`. */
export async function resolveRevision(source: GitSource): Promise<string> {
  try {
    const headers: Record<string, string> = { Accept: 'application/vnd.github.sha' };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    const response = await fetch(`https://api.github.com/repos/${source.repo}/commits/${source.branch}`, {
      headers,
    });
    const text = (await response.text()).trim();
    if (response.ok && /^[0-9a-f]{40}$/.test(text)) return text;
  } catch {
    // fall through
  }
  try {
    const output = execFileSync(
      'git',
      ['ls-remote', `https://github.com/${source.repo}`, `refs/heads/${source.branch}`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 60_000 },
    );
    const sha = output.trim().split(/\s+/)[0];
    if (sha && /^[0-9a-f]{40}$/.test(sha)) return sha;
  } catch {
    // fall through
  }
  throw new Error(`Couldn't find the latest version of ${source.repo}. Check your internet connection.`);
}

/**
 * Text from file bytes: UTF-8, or UTF-16 when the file starts with a byte
 * order mark (some game text dumps are saved that way).
 */
export function decodeText(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  // TextDecoder drops a UTF-8 byte order mark by itself.
  return new TextDecoder('utf-8').decode(bytes);
}

/** A file from a source at a revision, downloaded once and then read from the cache. */
export async function sourceBytes(source: GitSource, revision: string, path: string): Promise<Buffer> {
  const cachePath = join(SOURCES_DIR, source.id, revision, path);
  if (existsSync(cachePath)) return readFile(cachePath);
  const bytes = await downloadBytes(`https://raw.githubusercontent.com/${source.repo}/${revision}/${path}`);
  await mkdir(dirname(cachePath), { recursive: true });
  await writeFile(cachePath, bytes);
  return bytes;
}

/** A text file from a source at a revision (UTF-8 or UTF-16), cached like `sourceBytes`. */
export async function sourceFile(source: GitSource, revision: string, path: string): Promise<string> {
  return decodeText(await sourceBytes(source, revision, path));
}

/** Runs async tasks with a concurrency limit. */
export async function mapLimit<T, R>(items: readonly T[], limit: number, task: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index] as T);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Lists the files of a repository folder at a revision, using a light Git
 * checkout that downloads names only. Returns null when Git isn't available.
 */
export function listRepoFiles(
  source: GitSource,
  revision: string,
  folders: readonly string[],
): Set<string> | null {
  const dir = join(SOURCES_DIR, `${source.id}-tree`);
  const git = (args: string[]) =>
    execFileSync('git', args, {
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 10 * 60_000,
    });
  try {
    if (!existsSync(join(dir, '.git'))) {
      git([
        'clone',
        '--quiet',
        '--filter=blob:none',
        '--no-checkout',
        '--depth',
        '1',
        `https://github.com/${source.repo}`,
        dir,
      ]);
    }
    try {
      git(['-C', dir, 'cat-file', '-e', `${revision}^{commit}`]);
    } catch {
      git(['-C', dir, 'fetch', '--quiet', '--filter=blob:none', '--depth', '1', 'origin', revision]);
    }
    const output = git(['-C', dir, 'ls-tree', '-r', '--name-only', revision, '--', ...folders]);
    return new Set(output.split('\n').filter(Boolean));
  } catch (error) {
    log.warn(
      `Couldn't list files of ${source.repo} with Git (${error instanceof Error ? error.message.split('\n')[0] : error}).`,
    );
    return null;
  }
}
