/**
 * figure absent-channel characterization net (outfit.plan.md, P1 gate).
 *
 * Hash-pins the SVG of figures that wear NO cut-and-sewn garment and NO `outfit`: a shell
 * outfit, a posed shell dress, and a bare body. The hashes were computed on a `main` worktree
 * at 2.0.2 (2026-09-13) BEFORE the pattern-garment / outfit work, so they pin the promise that
 * an absent opt-in channel contributes zero bytes — not merely that the render is deterministic.
 *
 * Re-pinning is legitimate ONLY alongside a plan phase that says the legacy figure emission
 * changes (the emit-channels.char.test.js contract).
 *
 * Re-pin log:
 * - 2026-09-14, footwear P0 (the flat stand). All three. A figure that says nothing
 *   about its feet now stands with its soles ON THE FLOOR: `flatOf` (figure-render.js) falls
 *   back to 1, not 0, when neither `footFlat` nor `plant` is given. Before, the foot was built
 *   ⊥ to the shank and the rest shank tilts 11° back, so every standing figure balanced on its
 *   toe tip with the heel ≈ 3.8 cm in the air (sole pitch 11.3°). The three figures here are all
 *   standing, so all three move; the walk and the sprint pass `plant` / `footFlat` explicitly and
 *   are byte-identical (16 frames checked). The absent-channel PROMISE is unchanged — these
 *   hashes still pin that a figure with no pattern garment and no `outfit` costs zero bytes for
 *   those channels; only the legacy stand itself was corrected.
 * - 2026-09-14, footwear (the big toe). All three, again, and for the same kind of reason: the
 *   FOOT'S SHAPE changed. The forefoot was a symmetric spearhead tapering to a point on the
 *   midline — the same shape on both feet, with no handedness at all. The big toe now LEADS and
 *   sits medially, the toe line slants back to the little toe, and the two feet are exact mirrors,
 *   so a shoe last has a side to be drafted for. The forefoot then gained a `roll` and a blunt
 *   `box` station and a small closing `tip` — the narrow cap walked medially read as a BLADE, and
 *   widening it exposed the hole every ring stack has at its end (`litFaces` caps neither end).
 *   The foot was then RESIZED: it measured 18.1 % of stature, a EU 47 on a 170 cm figure, where a
 *   human foot is about 15 % — and a shoe drafted from that tape would have printed at that size.
 *   Length, breadth and depth scale together, so the shape is the one above and only the size
 *   changed. The sole is part of the body's z extent, so `worldPerCm` moves with it and every
 *   tape reading rises ~0.4 % (female @165: bust 93.3 → 93.7, hip 113.3 → 113.8).
 *   `figure-foot.test.js` holds all of it; these hashes only record that the flesh moved.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { renderFigureToSvg } from './figure-render.js';

const sha = (s) => createHash('sha256').update(s).digest('hex');

const PINS = {
  femaleTeeTrousers: {
    manifest: { kind: 'figure', proto: { sex: 'female' }, garment: ['tee', 'trousers'], view: 'three-quarter' },
    hash: '76c64695b355b8bb18a46f605abe65a27b58abe6b9a916e8acdc10b7708eee57',
  },
  maleDressPosed: {
    manifest: { kind: 'figure', proto: { sex: 'male' }, garment: 'dress', pose: { shL: { pitch: 40 }, kneeR: 30 }, view: 'lateral' },
    hash: '4439c173ebeefd76689211d8738a2d7c5dd42865bbdcf483e35ad438e36fe34f',
  },
  bare: {
    manifest: { kind: 'figure', view: 'frontal' },
    hash: 'c9d442005ef4775e18ec018ed19a319b5c5ec1822261d6328f5b91db616bca90',
  },
};

describe('figure absent-channel pins (pre-branch hashes)', () => {
  for (const [name, { manifest, hash }] of Object.entries(PINS)) {
    it(`${name} renders byte-identical to 2.0.2`, () => {
      expect(sha(renderFigureToSvg(manifest))).toBe(hash);
    });
  }
});
