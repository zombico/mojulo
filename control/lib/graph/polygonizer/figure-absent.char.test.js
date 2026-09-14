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
 * Re-pin log: (none)
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { renderFigureToSvg } from './figure-render.js';

const sha = (s) => createHash('sha256').update(s).digest('hex');

const PINS = {
  femaleTeeTrousers: {
    manifest: { kind: 'figure', proto: { sex: 'female' }, garment: ['tee', 'trousers'], view: 'three-quarter' },
    hash: 'c38312b28616cf45c68c06c8c61ea5202896898711765d71976471d06f1ff8eb',
  },
  maleDressPosed: {
    manifest: { kind: 'figure', proto: { sex: 'male' }, garment: 'dress', pose: { shL: { pitch: 40 }, kneeR: 30 }, view: 'lateral' },
    hash: 'e3a37f0fc837a40bad6aea830aade4ff37876402cf76a8dc1389aecb470d01da',
  },
  bare: {
    manifest: { kind: 'figure', view: 'frontal' },
    hash: 'b6112b0fb178fecea02d0554cc1d00ae9decf09d6b09d7fea44d5de3e4c8a6b9',
  },
};

describe('figure absent-channel pins (pre-branch hashes)', () => {
  for (const [name, { manifest, hash }] of Object.entries(PINS)) {
    it(`${name} renders byte-identical to 2.0.2`, () => {
      expect(sha(renderFigureToSvg(manifest))).toBe(hash);
    });
  }
});
