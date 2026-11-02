/**
 * Writing the data files: one record per line (small files that still give
 * readable line-by-line differences on GitHub), written to a staging folder
 * first and swapped in at the end, so a failed run never leaves half-written data.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** JSON with one array element or object entry per line. */
export function formatJson(value: unknown): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]\n';
    return `[\n${value.map((item) => JSON.stringify(item)).join(',\n')}\n]\n`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 0) return '{}\n';
    return `{\n${entries.map(([key, item]) => `${JSON.stringify(key)}: ${JSON.stringify(item)}`).join(',\n')}\n}\n`;
  }
  return `${JSON.stringify(value)}\n`;
}

export class OutputFolder {
  private readonly files = new Map<string, string>();

  /** Adds a file; `path` is relative to the data folder, e.g. `text/en/move-names.json`. */
  add(path: string, value: unknown): void {
    this.files.set(path, formatJson(value));
  }

  /** Fingerprint of every file except the ones listed (manifest, changelog). */
  hash(except: readonly string[] = []): string {
    const digest = createHash('sha256');
    for (const path of [...this.files.keys()].sort()) {
      if (except.includes(path)) continue;
      digest
        .update(path)
        .update('\0')
        .update(this.files.get(path) ?? '')
        .update('\0');
    }
    return digest.digest('hex').slice(0, 16);
  }

  get paths(): string[] {
    return [...this.files.keys()].sort();
  }

  /** Replaces `target` with exactly these files. */
  commit(target: string): void {
    const staging = `${target}.new`;
    const previous = `${target}.old`;
    rmSync(staging, { recursive: true, force: true });
    rmSync(previous, { recursive: true, force: true });
    for (const [path, content] of this.files) {
      const full = join(staging, path);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, content, 'utf8');
    }
    if (existsSync(target)) renameSync(target, previous);
    renameSync(staging, target);
    rmSync(previous, { recursive: true, force: true });
  }
}

export function readJsonFile<T = unknown>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return null;
  }
}
