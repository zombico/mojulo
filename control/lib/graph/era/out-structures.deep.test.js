import { describe, it, expect } from 'vitest';
import { STRUCTURE_USE_IDS, STRUCTURE_KITS, STRUCTURE_RING_IDS, STRUCTURE_USES, structureStyle } from './out-structures.js';
import { ANCHOR_IDS, decompileAnchor, seedAnchor, speak, secondaryOf } from './out-anchor-structure.js';

// every anchor (authored and seeded, elements first) and its secondary × kit craft × seed × use × lot × ring × heartbeat band: the laws
// hold (the programme advises on a lot too small for its use)
const LOTS = [{ w: 6, d: 18 }, { w: 11, d: 13 }, { w: 16, d: 11 }, { w: 14, d: 24 }, { w: 22, d: 22 }, { w: 9, d: 14 }, { w: 7, d: 7 }];
describe('out-anchor-structure, swept', () => {
  it('holds every law but the programme across anchors, kits, seeds, uses, lots and rings', () => {
    const anchors = [...ANCHOR_IDS.map((a) => decompileAnchor(a)), ...Array.from({ length: 16 }, (_, i) => decompileAnchor(seedAnchor(i + 1)))];
    // and every anchor's secondary, derived by contrast
    const broken = [], langs = [...anchors, ...anchors.map(secondaryOf)];
    for (const L of langs) for (const k of STRUCTURE_KITS) for (const s of [1, 7]) {
      const st = structureStyle(k, s);
      for (const u of STRUCTURE_USE_IDS) for (const lot of LOTS) {
        if (lot.w < STRUCTURE_USES[u].lot.w || lot.d < STRUCTURE_USES[u].lot.d) continue;
        for (const ring of STRUCTURE_RING_IDS) for (const band of [null, [1, 1], [3, 4]]) for (const l of speak(L, u, lot, st, s, { ring, band }).laws) if (!l.ok && l.law !== 'programme') broken.push(`${L.id} ${k} s${s} ${u} ${lot.w}×${lot.d} ${ring} ${band}: ${l.law} ${l.value}`);
      }
    }
    expect(broken.slice(0, 20)).toEqual([]);
  });
});
