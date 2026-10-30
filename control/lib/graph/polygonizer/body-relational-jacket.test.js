// The jacket as built (body-relational-jacket.js), on the smallest made-up cloth that exercises it: its front a real
// opening (each ring a C, no cloth across the gap, two faces a leather's thickness apart, the ends turned in); its pieces
// on its own face; its words through the outfit card to the tailor.
import { describe, it, expect } from 'vitest';
import { openFront, zipDown, patchOn, faceAt, JACKET } from './body-relational-jacket.js';
import { ringSlots } from './body-relational-resample.js';
import { compileLayered, auditLayered } from './station-loft.js';
import { validateOutfitCard } from '../outfit/styles.js';

const SLOTS = ringSlots(48), range = (a, b, n) => Array.from({ length: n }, (_, k) => a + ((b - a) * k) / (n - 1));
/** a jacket's body: a tube up the z axis, radius 0.16, its slots from the front (+y) round the right */
const body = () => ({ layer: 1, closure: 'closed', garment: true, group: 'Outer', slots: SLOTS, bind: { bone: 'torso', blend: {} },
  stations: range(1.0, 1.45, 19).map((z, i) => ({ id: `st${i}`, u: i, points: Object.fromEntries(SLOTS.map((sl, j) => { const a = (2 * Math.PI * j) / 48; return [sl, [Math.sin(a) * 0.16, Math.cos(a) * 0.16, z]]; })) })),
  caps: { back: [0, 0, 0.99], tip: [0, 0, 1.46] } });
const pts = (P) => P.stations.flatMap((st) => Object.values(st.points));

describe('a jacket that opens', () => {
  it('splits each ring at the centre front: no cloth across the gap, both faces apart, a closed well-wound part', () => {
    for (const g of [JACKET.zipGap, 0.12]) {
      const J = openFront(body(), { gap: () => g });
      // (nothing of it in the gap on the front: the shirt shows there)
      for (const q of pts(J).filter((p) => p[1] > 0.1)) expect(Math.abs(q[0])).toBeGreaterThanOrEqual(g / 2 - JACKET.thick);
      // (its two front edges each side of the gap, at its height)
      const st = J.stations[5]; expect(st.points[J.fronts[0]][0]).toBeCloseTo(g / 2, 4); expect(st.points[J.fronts[1]][0]).toBeCloseTo(-g / 2, 4);
      // (the inner face a leather's thickness inside the outer)
      const r = (p) => Math.hypot(p[0], p[1]), radii = Object.values(st.points).map(r);
      expect(Math.abs(Math.max(...radii) - Math.min(...radii) - JACKET.thick)).toBeLessThan(0.0005);
      // (its ends turned in and drawn small, inside the body, so its caps close it out of sight)
      expect(Math.max(...Object.values(J.stations[0].points).map(r))).toBeLessThan(0.16 * 0.5);
      const A = auditLayered(compileLayered({ schema: 'layered-v1', dials: {}, parts: { outer_body: J } }, {}, { details: false, creases: false })).outer_body;
      expect([A.windingErrors, A.nonManifold, A.boundaryEdges]).toEqual([0, 0, 0]);
    }
  });
  it('closes on a zip in the gap, and carries its pieces on its own face', () => {
    const J = openFront(body(), { gap: () => JACKET.zipGap }), Z = zipDown(J, 'zip');
    expect(Object.keys(Z).sort()).toEqual(['zipPull', 'zipTape', 'zipTeeth']);
    for (const q of pts(Z.zipTeeth)) expect(Math.abs(q[0])).toBeLessThan(JACKET.zipGap);
    // (the face read where the cloth is, nothing in the gap)
    expect(faceAt(J, 0.08, 1.2).p[1]).toBeGreaterThan(0.1); expect(faceAt(J, 0, 1.2)).toBeNull();
    // (a patch on it lies over the face, its own thickness out)
    const P = patchOn(J, { z0: 1.2, z1: 1.05, cx: () => 0.08, width: () => 0.1 });
    for (const q of pts(P)) expect(Math.hypot(q[0], q[1])).toBeGreaterThan(0.16 - 1e-6);
  });
});

describe('the jacket\'s words', () => {
  it('takes its construction on the outer garment, a zip without lapels or buttons, naming what it refuses', () => {
    const card = (outer) => ({ language: { top: { family: 'knit', sleeve: 'short', hem: 'hip' }, outer: { family: 'woven', sleeve: 'long', hem: 'hip', ...outer } } });
    expect(validateOutfitCard(card({ front: 'zip', collar: 'shirt', rib: 'both', pockets: 'flap', epaulettes: true, cloth: 'leather', open: true }))).toEqual([]);
    const errs = validateOutfitCard(card({ front: 'zip', lapel: 'notch', rib: 'sleeves', pockets: 'patch', collar: 'mandarin', cloth: 'chainmail' })).join('\n');
    for (const want of ["front: 'zip' closes without lapels or buttons", 'outer.rib', 'outer.pockets', 'outer.collar', 'outer.cloth']) expect(errs).toContain(want);
  });
});
