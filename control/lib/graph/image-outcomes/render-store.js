/**
 * Bound page/panel renders — the externally-generated PNGs the render
 * worker submits for an `image-outcome` / `sequential-art` ref, keyed by
 * render target ('page' or a panel id). Same posture as sheet-store.js
 * (character sheets keep their own store): append-only snapshots in the
 * ref's outcome folder, never edited in place, never required — a packet
 * with no bound renders is still a complete artifact. The I5 composite
 * (final-page.js) reads the latest binding per target.
 *
 * Timeless module: `n` comes from what's on disk, never from the clock.
 */

import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';

function outcomesBaseDir() {
  return process.env.MOJULO_OUTCOMES_DIR || path.join(process.cwd(), 'data', 'outcomes');
}

function assertTarget(target) {
  if (typeof target !== 'string' || !/^[A-Za-z0-9_/-]{1,128}$/.test(target)) {
    throw new Error(`invalid render target: ${target}`);
  }
  return target;
}

function targetSlug(target) {
  return assertTarget(target).replaceAll('/', '__');
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function renderDir(ref) {
  return path.join(outcomesBaseDir(), ref);
}

function boundNumbers(ref, target) {
  const dir = renderDir(ref);
  if (!existsSync(dir)) return [];
  const slug = escapeRegExp(targetSlug(target));
  const pattern = new RegExp(`^render-${slug}-(\\d+)\\.png$`);
  return readdirSync(dir)
    .map((f) => f.match(pattern))
    .filter(Boolean)
    .map((m) => Number(m[1]))
    .sort((a, b) => a - b);
}

/** Latest bound render for (ref, target), or null. */
export function latestBoundRender(ref, target) {
  const slug = targetSlug(target);
  const numbers = boundNumbers(ref, target);
  if (!numbers.length) return null;
  const n = numbers[numbers.length - 1];
  return { n, path: path.join(renderDir(ref), `render-${slug}-${n}.png`) };
}

/** Reserve the next append-only slot for (ref, target). */
export function nextRenderPath(ref, target) {
  const slug = targetSlug(target);
  const numbers = boundNumbers(ref, target);
  const n = numbers.length ? numbers[numbers.length - 1] + 1 : 1;
  mkdirSync(renderDir(ref), { recursive: true });
  return { n, path: path.join(renderDir(ref), `render-${slug}-${n}.png`) };
}

/** { target: { n, path } } for every target that has a binding. */
export function boundRenderMap(ref, targets) {
  const out = {};
  for (const target of targets) {
    const bound = latestBoundRender(ref, target);
    if (bound) out[target] = bound;
  }
  return out;
}
