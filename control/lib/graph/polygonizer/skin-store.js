/**
 * Bound polygomer skins — the reskinned deterministic render a polygomer WEARS
 * after a diffusion skin is projected onto its faces (skin-projection.js).
 * Snapshotted append-only into the sketch's outcome folder
 * (`data/outcomes/<ref>/skin-<n>.png`), same posture as sheet-store /
 * render-store: the manji-tree recipe stays the source of truth; a bound skin
 * render is a numbered, never-edited-in-place artifact.
 *
 * Timeless module: `n` comes from what's on disk, never from the clock.
 */

import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';

function outcomesBaseDir() {
  return process.env.MOJULO_OUTCOMES_DIR || path.join(process.cwd(), 'data', 'outcomes');
}

export function skinDir(ref) {
  return path.join(outcomesBaseDir(), ref);
}

const SKIN_FILE = /^skin-(\d+)\.png$/;

function skinNumbers(ref) {
  const dir = skinDir(ref);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .map((f) => f.match(SKIN_FILE))
    .filter(Boolean)
    .map((m) => Number(m[1]))
    .sort((a, b) => a - b);
}

/** Latest skinned render for a ref, or null if none yet. */
export function latestSkin(ref) {
  const numbers = skinNumbers(ref);
  if (!numbers.length) return null;
  const n = numbers[numbers.length - 1];
  return { n, path: path.join(skinDir(ref), `skin-${n}.png`) };
}

/** Reserve the next append-only slot; creates the outcome folder. */
export function nextSkinPath(ref) {
  const numbers = skinNumbers(ref);
  const n = numbers.length ? numbers[numbers.length - 1] + 1 : 1;
  mkdirSync(skinDir(ref), { recursive: true });
  return { n, path: path.join(skinDir(ref), `skin-${n}.png`) };
}

// The INPUT painted skin (`skin-input-<n>.png`) — kept alongside the projected
// output so the world/GLB resolver can bake it onto the 3D faces on demand
// (the turnable model wears the same skin as the 2D render).
const INPUT_FILE = /^skin-input-(\d+)\.png$/;

function inputNumbers(ref) {
  const dir = skinDir(ref);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .map((f) => f.match(INPUT_FILE))
    .filter(Boolean)
    .map((m) => Number(m[1]))
    .sort((a, b) => a - b);
}

/** Path for the input skin at slot `n` (pairs with nextSkinPath's n). */
export function skinInputPath(ref, n) {
  return path.join(skinDir(ref), `skin-input-${n}.png`);
}

/** Latest bound INPUT skin for a ref, or null. */
export function latestSkinInput(ref) {
  const numbers = inputNumbers(ref);
  if (!numbers.length) return null;
  const n = numbers[numbers.length - 1];
  return { n, path: path.join(skinDir(ref), `skin-input-${n}.png`) };
}
