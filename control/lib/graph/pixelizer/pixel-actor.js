/**
 * pixel-actor — the qwen→pixelizer asset pipeline, productized: one
 * call takes a worker's meru-locked render set (base + face/state
 * variants, the exact shape the keyframe-animation pipeline already
 * writes to data/outcomes/<ref>/) and returns a living actor's whole
 * sprite kit — quantized base, diff-extracted sub-cel groups with
 * placement coordinates, blanks for the "off" states, provenance, and
 * alignment health.
 *
 * The economics this makes real: ONE base render + one small edit
 * render per expression state buys an actor; every minute of animation
 * after that costs zero renders — blinks, flaps, and beats are timing
 * charts over the extracted cels. The worker supplies STATES; the
 * track grammar supplies TIME.
 *
 *   const actor = await bakeActor({
 *     dir, decode,                          // sharp-backed decode(absPath)
 *     files: { base: 'key.png', 'blink-closed': '...', 'mouth-open': '...' },
 *     grid: [88, 88], budget: 15,
 *     groups: { eyes: ['blink-half', 'blink-closed'], mouth: ['mouth-mid', 'mouth-open'] },
 *   });
 *   // actor.base                          → the portrait raster
 *   // actor.groups.eyes.cell              → overlay placement (base-relative)
 *   // actor.groups.eyes.sprites[name]     → cels on a shared box
 *   // actor.groups.eyes.blank             → the open/rest state
 *   // actor.provenance / actor.changedRatios
 *
 * Decoding stays injected (sharp lives with callers); hashing reads
 * the source files directly. Everything downstream of decode is the
 * pure quantize.js math — same files + params → same kit.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { quantizeRgba, diffRasters, unionCels, jointPalette } from './quantize.js';

// meru-locked variants change a few percent of cells; past this the
// pair has drifted and the cel would smear — refuse loudly.
const DRIFT_CEILING = 0.5;

export async function bakeActor({ dir, decode, files, grid, budget = 15, groups = {}, tolerance = 32 }) {
  const decoded = {};
  for (const [name, file] of Object.entries(files)) {
    decoded[name] = await decode(join(dir, file));
  }

  // ONE palette over base + every variant, then pin it everywhere:
  // colors only a variant introduces (a tongue, a glow) still earn
  // slots, and cell diffs mean pixel change, never palette drift
  const palette = jointPalette(Object.values(decoded), { grid, budget });
  const b = decoded.base;
  const base = quantizeRgba(b.data, b.width, b.height, { grid, palette });

  const rasters = {};
  for (const name of Object.keys(files)) {
    if (name === 'base') continue;
    const v = decoded[name];
    rasters[name] = quantizeRgba(v.data, v.width, v.height, { grid, palette });
  }

  const provenance = {};
  for (const [name, file] of Object.entries(files)) {
    let sha256 = null;
    try {
      sha256 = createHash('sha256').update(readFileSync(join(dir, file))).digest('hex').slice(0, 16);
    } catch {
      // synthetic sources (tests) have no file to hash
    }
    provenance[name] = { file, sha256, grid, budget };
  }

  const changedRatios = {};
  const bakedGroups = {};
  for (const [groupName, members] of Object.entries(groups)) {
    const diffs = members.map((m) => {
      const d = diffRasters(base, rasters[m], { tolerance });
      if (!d) throw new Error(`variant "${m}" is identical to the base — nothing to extract`);
      if (d.changedRatio > DRIFT_CEILING) {
        throw new Error(`variant "${m}" changed ${(d.changedRatio * 100).toFixed(0)}% of cells — the pair has drifted, not meru-locked`);
      }
      changedRatios[m] = d.changedRatio;
      return d;
    });
    const u = unionCels(diffs);
    bakedGroups[groupName] = {
      cell: u.cell,
      blank: u.blank,
      sprites: Object.fromEntries(members.map((m, i) => [m, u.sprites[i]])),
    };
  }

  return { base, groups: bakedGroups, provenance, changedRatios };
}
