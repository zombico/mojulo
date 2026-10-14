import { describe, it, expect } from 'vitest';
import { STRUCTURE_USE_IDS, STRUCTURE_KITS, STRUCTURE_RING_IDS, STRUCTURE_USES, structureStyle } from './out-structures.js';
import { ANCHOR_IDS, decompileAnchor, seedAnchor, speak, secondaryOf } from './out-anchor-structure.js';

// anchors that between them build every element kind and form (authored, then seeded, elements first) and their
// secondaries, each speaking every use at every ring, the lot, heartbeat band, kit craft and seed walked across them:
// the laws hold (the programme advises on a lot too small for its use)
const LOTS = [{ w: 6, d: 18 }, { w: 11, d: 13 }, { w: 16, d: 11 }, { w: 14, d: 24 }, { w: 22, d: 22 }, { w: 9, d: 14 }, { w: 7, d: 7 }];
const BANDS = [null, [1, 1], [3, 4]];
const ANCHORS = (() => {
  const seen = new Set(), out = [];
  for (const L of [...ANCHOR_IDS.map((a) => decompileAnchor(a)), ...Array.from({ length: 16 }, (_, i) => decompileAnchor(seedAnchor(i + 1)))]) {
    const ways = Object.values(L.elements).map((e) => `${e.kind}:${e.form ?? ''}`);
    if (ANCHOR_IDS.includes(L.id) || ways.some((w) => !seen.has(w))) { out.push(L); ways.forEach((w) => seen.add(w)); }
  }
  return out;
})();
describe('out-anchor-structure, swept', () => {
  it('holds every law but the programme across anchors, uses and rings; lots, bands, kits and seeds walked across them', () => {
    const broken = [], langs = [...ANCHORS, ...ANCHORS.map(secondaryOf)];
    let n = 0;
    for (const L of langs) for (const u of STRUCTURE_USE_IDS) {
      const fits = LOTS.filter((lot) => lot.w >= STRUCTURE_USES[u].lot.w && lot.d >= STRUCTURE_USES[u].lot.d);
      for (const ring of STRUCTURE_RING_IDS) {
        const lot = fits[n % fits.length], band = BANDS[n % BANDS.length], k = STRUCTURE_KITS[n % STRUCTURE_KITS.length], s = [1, 7][n % 2];
        n++;
        for (const l of speak(L, u, lot, structureStyle(k, s), s, { ring, band }).laws) if (!l.ok && l.law !== 'programme') broken.push(`${L.id} ${k} s${s} ${u} ${lot.w}×${lot.d} ${ring} ${band}: ${l.law} ${l.value}`);
      }
    }
    expect(broken.slice(0, 20)).toEqual([]);
  });
});
