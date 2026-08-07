/**
 * Bound voice samples — worker-rendered WAVs bound onto a `voice-register`
 * ref so the /maker/voice shelf can PLAY a register. Same posture as
 * render-store.js (the image seam's PNG slots): append-only snapshots in
 * the ref's outcome folder, never edited in place, never required — a
 * register with no bound sample is still a complete artifact (the recipe
 * is the artifact; the sample is a derived render with provenance).
 *
 * Slots are AXIS-STAMPED: `voice-sample-c065-d040-<n>.wav` is a render of
 * the register's bank at confidence 0.65 / depth 0.40 (axes × 100, zero-
 * padded). That makes the shelf tunable to the edges — the card's sliders
 * recompute the blend live (pure math) and play the nearest rendered
 * point, chihaya edge to motoko edge, without mojulo ever synthesizing.
 *
 * Timeless module: `n` comes from what's on disk, never from the clock.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const SLOT_PATTERN = /^voice-sample-c(\d{3})-d(\d{3})-(\d+)\.wav$/;

function outcomesBaseDir() {
  return process.env.MOJULO_OUTCOMES_DIR || path.join(process.cwd(), 'data', 'outcomes');
}

export function voiceSampleDir(ref) {
  return path.join(outcomesBaseDir(), ref);
}

function clamp01(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

/** Normalize axes to the 2-decimal grid the slot key carries. */
export function normalizeSampleAxes(axes = {}) {
  return {
    confidence: Math.round(clamp01(axes.confidence, 0.5) * 100) / 100,
    depth: Math.round(clamp01(axes.depth, 0) * 100) / 100,
  };
}

function axisKey(axes) {
  const c = String(Math.round(axes.confidence * 100)).padStart(3, '0');
  const d = String(Math.round(axes.depth * 100)).padStart(3, '0');
  return `c${c}-d${d}`;
}

function readSidecar(wavPath) {
  try {
    return JSON.parse(readFileSync(`${wavPath}.json`, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Every bound sample point for `ref`: latest slot per (confidence, depth),
 * sidecar provenance attached. Sorted by (confidence, depth) so the same
 * disk state always lists the same way.
 */
export function listVoiceSamples(ref) {
  const dir = voiceSampleDir(ref);
  if (!existsSync(dir)) return [];
  const latest = new Map();
  for (const f of readdirSync(dir)) {
    const m = f.match(SLOT_PATTERN);
    if (!m) continue;
    const point = {
      confidence: Number(m[1]) / 100,
      depth: Number(m[2]) / 100,
      n: Number(m[3]),
      path: path.join(dir, f),
    };
    const key = `${m[1]}-${m[2]}`;
    if (!latest.has(key) || latest.get(key).n < point.n) latest.set(key, point);
  }
  return [...latest.values()]
    .map((p) => ({ ...p, sidecar: readSidecar(p.path) }))
    .sort((a, b) => a.confidence - b.confidence || a.depth - b.depth);
}

/** The rendered point nearest to `axes` (euclidean in axis space), or null. */
export function nearestVoiceSample(ref, axes) {
  const target = normalizeSampleAxes(axes);
  let best = null;
  let bestDist = Infinity;
  for (const sample of listVoiceSamples(ref)) {
    const dist = (sample.confidence - target.confidence) ** 2 + (sample.depth - target.depth) ** 2;
    if (dist < bestDist) {
      best = sample;
      bestDist = dist;
    }
  }
  return best;
}

/** Reserve the next append-only slot for (ref, axes). */
export function nextVoiceSamplePath(ref, axes) {
  const normalized = normalizeSampleAxes(axes);
  const key = axisKey(normalized);
  const dir = voiceSampleDir(ref);
  let maxN = 0;
  if (existsSync(dir)) {
    for (const f of readdirSync(dir)) {
      const m = f.match(SLOT_PATTERN);
      if (m && `c${m[1]}-d${m[2]}` === key) maxN = Math.max(maxN, Number(m[3]));
    }
  }
  mkdirSync(dir, { recursive: true });
  const n = maxN + 1;
  return { n, axes: normalized, path: path.join(dir, `voice-sample-${key}-${n}.wav`) };
}
