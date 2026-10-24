/**
 * FLORA COLOURS — the colour theorist's offer to a level's trees: more foliage than the world's one and barks of its
 * own, solved from the world's own colours (its foliage, grass, rock and soil), so whatever a tree is made of reads
 * as this world's. The theorist offers; the trees choose (a biocube's tree kinds, era/biocube.js `leaf` and `bark`):
 * which tree takes which colour is the composition's, not the palette's.
 *
 *   floraColours({ foliage, grass, rock, soil, accent? })  (rgb 0..255, the world's key colours)
 *     → { leaves: [deep, young, turn], barks: [warm, pale, dark] }, rgb
 *        leaves: deep (darker, cooler), young (lighter, toward the yellow), turn (toward the accent, or autumn's warm);
 *                each kept apart from the grass and from each other, so a crown reads against the ground
 *        barks:  warm (the soil's hue, dark), pale (the rock's hue, light and grey), dark (a cool near-black)
 *   floraRamps(palette)  → { 'foliage-1..3', 'bark-1..3' }: the offer as ramps the length of the palette's foliage and
 *                          bark, for the lock (a tree kind's `leaf: n` locks its crown to `foliage-n`, `bark: n` its
 *                          wood to `bark-n`; 0 is the world's own)
 *
 * Pure.
 */
import { lchOf, oklch, deltaE, hueGap } from '../color-theorist/oklab.js';
import { rampFrom } from './look-facets.js';

/** The number of foliage colours and barks the theorist offers beyond the world's own. */
export const FLORA_OFFER = 3;
// how far apart (OKLab) a crown must stand from the grass and a leaf colour from another
const APART = 0.05;
const mixHue = (a, b, t) => { const d = ((b - a + 540) % 360) - 180; return (a + d * t + 360) % 360; };

export function floraColours({ foliage, grass, rock, soil, accent = null }) {
  const [L, C, h] = lchOf(foliage), G = grass, A = accent ? lchOf(accent) : null;
  const want = [
    [L * 0.78, C * 1.05, mixHue(h, 205, 0.18)],
    [Math.min(0.86, L * 1.18 + 0.03), C * 1.2, mixHue(h, 100, 0.35)],
    // (turned: toward the world's accent when it has one and it sits in reach, else autumn's warm)
    [Math.min(0.8, L * 1.06), Math.max(C, 0.09), A && A[1] > 0.04 && hueGap(h, A[2]) < 150 ? mixHue(h, A[2], 0.7) : mixHue(h, 58, 0.75)],
  ];
  const leaves = [];
  for (const [l, c, hh] of want) {
    let rgb = oklch(l, c, hh);
    // (kept apart: from the grass, the world's own foliage and the leaves before it, by lightness, away from each)
    for (let i = 0; i < 6 && [G, foliage, ...leaves].some((o) => deltaE(rgb, o) < APART); i++) {
      const near = [G, foliage, ...leaves].find((o) => deltaE(rgb, o) < APART), [Ln] = lchOf(near), [Lr] = lchOf(rgb);
      rgb = oklch(Lr + (Lr >= Ln ? 0.04 : -0.04), c, hh);
    }
    leaves.push(rgb);
  }
  const [, Cs, hs] = lchOf(soil), [, Cr, hr] = lchOf(rock);
  const barks = [oklch(0.36, Math.min(Cs, 0.045), hs), oklch(0.6, Math.min(Cr, 0.022), hr), oklch(0.27, 0.02, mixHue(hs, 255, 0.55))];
  return { leaves, barks };
}

/** The offer as ramps for the lock, from a palette's own ramps (their middle stops the world's key colours). */
export function floraRamps(palette) {
  const mid = (r) => r[Math.floor(r.length / 2)], F = palette.foliage, B = palette.bark;
  if (!F || !B || !palette.grass || !palette.rock || !palette.soil) return {};
  const { leaves, barks } = floraColours({ foliage: mid(F), grass: mid(palette.grass), rock: mid(palette.rock), soil: mid(palette.soil), accent: palette.accent ? mid(palette.accent) : null });
  // (each ramp cut as a kit's are, rampFrom: its dark end leaning to the shade's default hue)
  const out = {};
  leaves.forEach((c, i) => { out[`foliage-${i + 1}`] = rampFrom(c, F.length); });
  barks.forEach((c, i) => { out[`bark-${i + 1}`] = rampFrom(c, B.length); });
  return out;
}
