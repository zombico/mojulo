/**
 * Bound character-sheet renders — the externally-authored PNGs the render
 * worker hands back for a `character-sheet` sketch, snapshotted into the
 * outcomes folder (`data/outcomes/<ref>/sheet-<n>.png`, the I3 folder
 * pattern scoped to sheets). The manifest stays the source of truth; a
 * bound PNG is a numbered, append-only artifact — never edited in place,
 * never required. When plan I4's render sidecar table lands, these rows
 * move there; the folder layout is already the one I3 specifies.
 *
 * Timeless module: `n` comes from what's on disk, never from the clock.
 */

import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';

function outcomesBaseDir() {
  return process.env.MOJULO_OUTCOMES_DIR || path.join(process.cwd(), 'data', 'outcomes');
}

export function sheetDir(ref) {
  return path.join(outcomesBaseDir(), ref);
}

const SHEET_FILE = /^sheet-(\d+)\.png$/;

function boundSheetNumbers(ref) {
  const dir = sheetDir(ref);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .map((f) => f.match(SHEET_FILE))
    .filter(Boolean)
    .map((m) => Number(m[1]))
    .sort((a, b) => a - b);
}

/** Latest bound sheet render for a ref, or null if none bound yet. */
export function latestBoundSheet(ref) {
  const numbers = boundSheetNumbers(ref);
  if (!numbers.length) return null;
  const n = numbers[numbers.length - 1];
  return { n, path: path.join(sheetDir(ref), `sheet-${n}.png`) };
}

/** Reserve the next append-only slot; creates the outcome folder. */
export function nextSheetPath(ref) {
  const numbers = boundSheetNumbers(ref);
  const n = numbers.length ? numbers[numbers.length - 1] + 1 : 1;
  mkdirSync(sheetDir(ref), { recursive: true });
  return { n, path: path.join(sheetDir(ref), `sheet-${n}.png`) };
}
