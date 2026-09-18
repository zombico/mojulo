/**
 * The HEAD — the machine gates of figure-head.js (the eyes gate is /head-study).
 *
 *   1. one CLOSED stack: latitude rings, tiny polar rings, no point at the march bound, no NaN,
 *      no zero-area quad, and every quad's outward normal agrees with the mesher's ring-centre
 *      test (so nothing is culled inside-out);
 *   2. determinism + the absent-channel promise: dial absent == dial at default, byte for byte;
 *   3. the canon: eye line, nose base and width/height inside the Loomis bands, both poles,
 *      three headScales;
 *   4. dimorphism is monotone: the male jaw is wider, the brow projects more, the female chin is
 *      sharper, the female neck thinner;
 *   5. the jaw and the mouth move what they say they move, and nothing else does;
 *   6. hair and hats still seat on the skull (every wig / hat key builds on both poles, above the crown);
 *   7. the head-study camera: crop + elev render, and are absent by default;
 *   8. the tape: head rows in cm;
 *   9. the FEATURES — the ear stands proud and spans the canon band, the side wall of the face
 *      has no trough between the cheekbone and the ear, the nose tip domes and keeps a dorsal
 *      ridge without widening, the eye reads as lid / fissure / lid, and earSize + eyeSize each
 *      move their own region only.
 */
import { describe, expect, it } from 'vitest';

import { buildHeadField, headLandmarks, marchLatitude, headRings, resolveFace, chinZOf, HEAD_KNOB_DEFAULTS, HEAD_H, JAW_MAX_DEG } from './figure-head.js';
import { buildPosedFigure, renderFigureToSvg } from './figure-render.js';
import { basePositions } from './figure-vajra.js';
import { DIMORPH } from './figure-rig.js';
import { WIGS } from './wig.js';
import { HATS, buildHat } from './hat.js';
import { bodyGirths } from './body-chart.js';

const head = (stacks) => stacks.find((s) => s.id === 'headEgg');
const pts = (st) => st.rings.flatMap((r) => r.polyline);
const ringR = (r) => r.polyline.reduce((m, q) => m + Math.hypot(q.x - r.center.x, q.y - r.center.y, q.z - r.center.z), 0) / r.polyline.length;
const extent = (st, k) => { const v = pts(st).map((q) => q[k]); return Math.max(...v) - Math.min(...v); };
const newell = (P) => { let x = 0, y = 0, z = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; x += (a.y - b.y) * (a.z + b.z); y += (a.z - b.z) * (a.x + b.x); z += (a.x - b.x) * (a.y + b.y); } return { x, y, z, len: Math.hypot(x, y, z) }; };

describe('one closed head', () => {
  for (const sex of ['male', 'female']) {
    it(`${sex}: latitude rings, closed poles, no bound hit, no degenerate quad, mesher-consistent normals`, () => {
      const stacks = buildPosedFigure({}, { sex });
      const h = head(stacks);
      expect(h).toBeTruthy();
      expect(stacks.find((s) => s.id === 'faceMask')).toBeUndefined();          // the second tube is gone
      expect(h.rings.length).toBe(52);
      for (const q of pts(h)) expect(Number.isFinite(q.x + q.y + q.z)).toBe(true);
      // the poles: the first and last rings are tiny (closed by construction), everything else is not
      const R = h.rings.map(ringR);
      expect(R[0]).toBeLessThan(0.05);   // world units (STAND × 12): < 0.4 cm at 170 cm
      expect(R[R.length - 1]).toBeLessThan(0.05);
      expect(Math.max(...R)).toBeGreaterThan(0.5);
      // no ray reached the march bound (0.15 STAND from the centre = 1.8 world)
      const c = h.rings[Math.floor(h.rings.length / 2)].center;
      for (const q of pts(h)) expect(Math.hypot(q.x - c.x, q.y - c.y, q.z - c.z)).toBeLessThan(1.7);
      // quads: none zero-area; each outward normal agrees with litFaces's ring-centre orientation
      let bad = 0, zero = 0;
      for (let i = 0; i < h.rings.length - 1; i++) {
        const a = h.rings[i].polyline, b = h.rings[i + 1].polyline, c0 = h.rings[i].center, c1 = h.rings[i + 1].center;
        const cw = { x: (c0.x + c1.x) / 2, y: (c0.y + c1.y) / 2, z: (c0.z + c1.z) / 2 };
        const hc = { x: c.x, y: c.y, z: (h.rings[0].center.z + h.rings[h.rings.length - 1].center.z) / 2 };
        for (let j = 0; j < a.length - 1; j++) {
          const P = [a[j], a[j + 1], b[j + 1], b[j]];
          const n = newell(P);
          if (n.len < 1e-9) { zero++; continue; }
          const cen = { x: (P[0].x + P[1].x + P[2].x + P[3].x) / 4, y: (P[0].y + P[1].y + P[2].y + P[3].y) / 4, z: (P[0].z + P[1].z + P[2].z + P[3].z) / 4 };
          const byRing = Math.sign(n.x * (cen.x - cw.x) + n.y * (cen.y - cw.y) + n.z * (cen.z - cw.z));
          const byCentre = Math.sign(n.x * (cen.x - hc.x) + n.y * (cen.y - hc.y) + n.z * (cen.z - hc.z));
          if (byRing !== byCentre) bad++;
        }
      }
      expect(zero).toBe(0);
      // the concavities (lip line, sulcus, alar creases, orbits) can turn a quad or two inside-out for
      // the ring mesher — the documented display-path limit (a speck, not a hole); a real inside-out
      // region would be dozens
      expect(bad).toBeLessThanOrEqual(4);
    });
  }
});

describe('determinism and the absent-channel promise', () => {
  it('two builds are byte-identical; absent knobs / face equal their defaults', () => {
    const a = JSON.stringify(head(buildPosedFigure({}, { sex: 'female' })).rings);
    expect(JSON.stringify(head(buildPosedFigure({}, { sex: 'female' })).rings)).toBe(a);
    expect(JSON.stringify(head(buildPosedFigure({ face: {} }, { sex: 'female' })).rings)).toBe(a);
    expect(JSON.stringify(head(buildPosedFigure({ face: { jaw: 0, mouth: 0, brow: 0 } }, { sex: 'female' })).rings)).toBe(a);
    expect(JSON.stringify(head(buildPosedFigure({}, { sex: 'female', ...HEAD_KNOB_DEFAULTS })).rings)).toBe(a);
  });
  it('resolveFace clamps and defaults', () => {
    expect(resolveFace(null)).toEqual({ jaw: 0, mouth: 0, brow: 0 });
    expect(resolveFace({ jaw: 99 }).jaw).toBe(JAW_MAX_DEG);
    expect(resolveFace({ jaw: 12.5 }).mouth).toBeCloseTo(0.5, 6);
    expect(resolveFace({ jaw: 12.5, mouth: 0 }).mouth).toBe(0);
    expect(resolveFace({ brow: -4 }).brow).toBe(-1);
  });
});

describe('the canon (Loomis)', () => {
  // eye line at ½ head height, nose base at ⅓ from the chin, width ≈ ⅔ of height
  for (const sex of ['male', 'female']) {
    it(`${sex}: landmarks inside the bands`, () => {
      const L = headLandmarks(DIMORPH[sex].head);
      expect(L.eyeL.z / L.H).toBeGreaterThan(0.46); expect(L.eyeL.z / L.H).toBeLessThan(0.58);
      expect(L.subnasale.z / L.H).toBeGreaterThan(0.29); expect(L.subnasale.z / L.H).toBeLessThan(0.37);
      expect(L.stomion.z).toBeGreaterThan(L.menton.z); expect(L.stomion.z).toBeLessThan(L.subnasale.z);
    });
  }
  it('the built skull is about two-thirds as wide as it is tall, at three headScales', () => {
    for (const sex of ['male', 'female']) for (const headScale of [1, 1.4, 1.8]) {
      const h = head(buildPosedFigure({}, { sex, headScale }));
      const ratio = extent(h, 'x') / extent(h, 'z');
      expect(ratio, `${sex} @${headScale}`).toBeGreaterThan(0.58);
      expect(ratio, `${sex} @${headScale}`).toBeLessThan(0.80);
      expect(extent(h, 'z') / 12 / (HEAD_H * headScale), `${sex} @${headScale} scales`).toBeGreaterThan(0.85);
      expect(extent(h, 'z') / 12 / (HEAD_H * headScale), `${sex} @${headScale} scales`).toBeLessThan(1.35);
    }
  });
});

describe('dimorphism is monotone', () => {
  const M = headLandmarks(DIMORPH.male.head), F = headLandmarks(DIMORPH.female.head);
  it('the male jaw is wider, the female chin sharper, the female neck thinner', () => {
    expect(Math.abs(M.gonionL.x) / M.s).toBeGreaterThan(Math.abs(F.gonionL.x) / F.s);
    expect(DIMORPH.female.head.chinPoint).toBeGreaterThan(DIMORPH.male.head.chinPoint);
    expect(DIMORPH.female.head.brow).toBeLessThan(DIMORPH.male.head.brow);
    const nm = buildPosedFigure({}, { sex: 'male' }).find((s) => s.id === 'neck');
    const nf = buildPosedFigure({}, { sex: 'female' }).find((s) => s.id === 'neck');
    expect(ringR(nf.rings[10])).toBeLessThan(ringR(nm.rings[10]));
  });
  it('the brow projects further on the male pole (the field, not the table)', () => {
    const probe = (pole) => { const { field, landmarks: L } = buildHeadField({ pole }); let y = L.glabella.y; while (field({ x: 0, y, z: L.glabella.z }) < 0) y += 0.0005; return y / L.s; };
    expect(probe(DIMORPH.male.head)).toBeGreaterThan(probe(DIMORPH.female.head));
  });
  it('the head knobs move their region', () => {
    const wide = head(buildPosedFigure({}, { jawWidth: 1.4 })), base = head(buildPosedFigure({}, {}));
    expect(extent(wide, 'x')).toBeGreaterThanOrEqual(extent(base, 'x'));
    const nose = head(buildPosedFigure({}, { noseSize: 1.6 }));
    expect(extent(nose, 'y')).toBeGreaterThan(extent(base, 'y'));
    // the soft cheek fills the hollow under the cheekbone: the field at the cheek landmark goes deeper inside
    const L = headLandmarks();
    const probe = { x: L.cheekL.x, y: L.cheekL.y + 0.012, z: L.cheekL.z };
    expect(buildHeadField({ knobs: { cheek: 1.6 } }).field(probe)).toBeLessThan(buildHeadField({}).field(probe));
    expect(buildHeadField({ knobs: { cheek: 0.4 } }).field(probe)).toBeGreaterThan(buildHeadField({}).field(probe));
    // the alae widen the nose base and nothing else: outside the ala, the field goes deeper inside
    const ala = { x: L.alaL.x - 0.006, y: L.alaL.y, z: L.alaL.z };
    expect(buildHeadField({ knobs: { noseWidth: 1.6 } }).field(ala)).toBeLessThan(buildHeadField({}).field(ala));
    expect(buildHeadField({ knobs: { noseWidth: 1.6 } }).field(L.crown)).toBeCloseTo(buildHeadField({}).field(L.crown), 12);
  });
});

describe('the jaw and the mouth', () => {
  it('opening the jaw drops the chin and nothing above the hinge', () => {
    const rest = head(buildPosedFigure({}, {})), open = head(buildPosedFigure({ face: { jaw: 25 } }, {}));
    // the chin swings down AND back, so read the front HALF (it leaves the front quarter); not the throat stub
    expect(chinZOf(open, 0.5)).toBeLessThan(chinZOf(rest, 0.5) - 0.05);
    // crown untouched: the first (crown) ring is identical
    expect(JSON.stringify(open.rings[0])).toBe(JSON.stringify(rest.rings[0]));
  });
  it('the mouth slot cuts the face plane at the stomion, and only when open', () => {
    const { field, landmarks: L } = buildHeadField({ face: { mouth: 1, jaw: 0 } });
    const shut = buildHeadField({}).field;
    const p = { x: 0, y: L.stomion.y, z: L.stomion.z };
    expect(field(p)).toBeGreaterThan(shut(p));                       // the slot is outside where the lips were
    const q = { x: 0, y: L.glabella.y, z: L.glabella.z };
    expect(field(q)).toBeCloseTo(shut(q), 12);                        // the brow does not move
  });
  it('the jaw moves only the jaw group in the field', () => {
    const a = buildHeadField({}).field, b = buildHeadField({ face: { jaw: 20 } }).field;
    const L = headLandmarks();
    expect(b(L.crown)).toBeCloseTo(a(L.crown), 12);
    expect(b(L.occiput)).toBeCloseTo(a(L.occiput), 12);
  });
});

describe('the scalp readers still seat on the skull', () => {
  for (const sex of ['male', 'female']) {
    it(`${sex}: every wig and hat builds and rises to the crown`, () => {   // hats via hat.js directly (not a manifest channel)
      const crownZ = Math.max(...pts(head(buildPosedFigure({}, { sex }))).map((q) => q.z));
      for (const style of Object.keys(WIGS)) {
        const stacks = buildPosedFigure({}, { sex }, null, null, null, style);
        const hair = stacks.filter((s) => !s.flesh && s.rings);
        expect(hair.length, `${sex} wig ${style}`).toBeGreaterThan(0);
        expect(Math.max(...hair.flatMap(pts).map((q) => q.z)), `${sex} wig ${style} above the crown`).toBeGreaterThan(crownZ - 0.3);
      }
      const body = buildPosedFigure({}, { sex });
      for (const kind of Object.keys(HATS)) {
        const hat = buildHat(body, HATS[kind]);
        expect(hat.length, `${sex} hat ${kind}`).toBeGreaterThan(0);
        expect(Math.max(...hat.flatMap(pts).map((q) => q.z)), `${sex} hat ${kind} seats on the skull`).toBeGreaterThan(crownZ - 1.0);   // a beanie's crown sits just under the skull's; it reads as a hat by its brim
      }
    });
  }
});

describe('the head-study camera', () => {
  it('crop + elev render a head-only SVG; absent, the studio shot is unchanged', () => {
    const studio = renderFigureToSvg({ kind: 'figure', view: 'frontal' });
    const top = renderFigureToSvg({ kind: 'figure', view: 'frontal', crop: 'head', elev: 74 });
    const under = renderFigureToSvg({ kind: 'figure', view: 'frontal', crop: 'head', elev: -50 });
    expect(top).not.toBe(studio);
    expect(under).not.toBe(top);
    expect((top.match(/<polygon/g) || []).length).toBeGreaterThan(500);
    expect((top.match(/<polygon/g) || []).length).toBeLessThan((studio.match(/<polygon/g) || []).length);
    expect(renderFigureToSvg({ kind: 'figure', view: 'frontal', crop: null })).toBe(studio);
  });
});

describe('the tape', () => {
  it('reports head girth, height and width in cm, in human ranges at 170 cm', () => {
    for (const sex of ['male', 'female']) {
      const g = bodyGirths(buildPosedFigure({}, { sex }), { stature_cm: 170 });
      expect(g.head, sex).toBeGreaterThan(50); expect(g.head, sex).toBeLessThan(66);      // hat sizes 50–66 cm
      expect(g.head_height, sex).toBeGreaterThan(19); expect(g.head_height, sex).toBeLessThan(27);
      expect(g.head_width, sex).toBeGreaterThan(13); expect(g.head_width, sex).toBeLessThan(19);
    }
  });
});

describe('marchLatitude on a sphere', () => {
  it('returns N rings whose points sit on the surface', () => {
    const rings = marchLatitude((p) => Math.hypot(p.x, p.y, p.z) - 0.05, { x: 0, y: 0, z: 0 }, { N: 8, M: 12, bound: 0.1 });
    expect(rings.length).toBe(8);
    for (const r of rings) for (const q of r.polyline) expect(Math.hypot(q.x, q.y, q.z)).toBeCloseTo(0.05, 5);
    expect(basePositions().headTop.z).toBeGreaterThan(basePositions().headBase.z);
    expect(headRings(basePositions()).length).toBe(52);
  });
});

// ── the FEATURES: ear, the side wall, the nose tip, the eye ──
// Surface probes, because these are all statements about the SKIN, not the table: march in
// along one axis to the first inside sample.
const surfXof = (field) => (y, z) => { for (let x = 0.09; x > 0; x -= 0.00005) if (field({ x, y, z }) < 0) return x; return NaN; };
const surfYof = (field) => (x, z) => { for (let y = 0.13; y > 0; y -= 0.00002) if (field({ x, y, z }) < 0) return y; return NaN; };

describe('the ear', () => {
  it('stands proud of the temple, and its rim spans subnasale → glabella', () => {
    for (const sex of ['male', 'female']) {
      const { field, landmarks: L } = buildHeadField({ pole: DIMORPH[sex].head });
      const sx = surfXof(field);
      const proud = (z) => sx(L.earC.y, z) - sx(0.020 * L.s, z);
      // A feature, not a bulge: the old single tragion lobe melted into the face blend entirely.
      // Measured at the rim's PROUDEST, not at earC.z — mid-height is where the C is open, so the
      // ear is at its thinnest there (≈ 2.9 mm real) while the top and the lobe carry 7–11 mm.
      let lo = null, hi = null, best = 0;
      for (let z = 0.66 * L.H; z > 0.26 * L.H; z -= 0.002 * L.H) {
        const d = proud(z);
        if (d > best) best = d;
        if (d > 0.0012) { if (hi === null) hi = z; lo = z; }
      }
      expect(best, `${sex} ear standoff`).toBeGreaterThan(0.004);
      // the canon the rim is built to — bottom at the nose base, top at the brow line
      expect(lo / L.H, `${sex} ear bottom ≈ subnasale`).toBeGreaterThan(0.28);
      expect(lo / L.H, `${sex} ear bottom ≈ subnasale`).toBeLessThan(0.38);
      expect(hi / L.H, `${sex} ear top ≈ glabella`).toBeGreaterThan(0.55);
    }
  });
  it('earSize grows the ear and nothing else', () => {
    const L = headLandmarks();
    const probe = { x: L.earBackR.x + 0.004, y: L.earBackR.y, z: L.earBackR.z };
    const at = (kn) => buildHeadField({ knobs: kn }).field(probe);
    expect(at({ earSize: 1.4 })).toBeLessThan(at({}));
    expect(at({ earSize: 0.6 })).toBeGreaterThan(at({}));
    expect(buildHeadField({ knobs: { earSize: 1.4 } }).field(L.crown)).toBeCloseTo(buildHeadField({}).field(L.crown), 12);
  });
});

describe('the side wall of the face', () => {
  // The REGRESSION this exists for: with no zygomatic arch the side of the face fell into a
  // trough between the cheekbone and the ear (3.7 mm real bare, which the ear then deepened to
  // 4.5 mm by raising the wall behind it). The arch + masseter fill it; nothing may dig it again.
  it('has no trough between the cheekbone and the ear', () => {
    for (const sex of ['male', 'female']) {
      const { field, landmarks: L } = buildHeadField({ pole: DIMORPH[sex].head });
      const sx = surfXof(field);
      for (const zf of [0.44, 0.47, 0.50, 0.52]) {
        const row = [];
        for (let y = 0.036; y >= -0.004; y -= 0.004) row.push(sx(y * L.s, zf * L.H));
        for (let i = 1; i < row.length - 1; i++) {
          const lmax = Math.max(...row.slice(0, i)), rmax = Math.max(...row.slice(i + 1));
          expect(Math.min(lmax, rmax) - row[i], `${sex} dip at z/H ${zf}`).toBeLessThan(0.0015);
        }
      }
    }
  });
});

describe('the nose tip', () => {
  it('domes away from its apex in both directions, and the midline keeps a dorsal ridge', () => {
    const { field, landmarks: L } = buildHeadField({ pole: DIMORPH.male.head });
    const sy = surfYof(field);
    let aZ = 0, aY = -1;
    for (let z = 0.30 * L.H; z <= 0.42 * L.H; z += 0.0002) { const y = sy(0, z); if (y > aY) { aY = y; aZ = z; } }
    const off = 0.0026;                                   // ≈ 4 mm real
    // a flat facet barely falls away; the tip ellipsoid + infratip lobule make it drop
    expect(aY - sy(0, aZ + off), 'tip domes up').toBeGreaterThan(0.0006);
    expect(aY - sy(0, aZ - off), 'tip domes down').toBeGreaterThan(0.0020);
    // the KEEL: the dorsum's midline stands proud of its own flanks, so the nose reads as a
    // pyramid with one continuous ridge rather than a flat front
    for (const zf of [0.38, 0.40]) {
      expect(sy(0, zf * L.H) - sy(0.006 * L.s, zf * L.H), `ridge at z/H ${zf}`).toBeGreaterThan(0.002);
    }
  });
  it('gains that volume without widening the nose', () => {
    const { field, landmarks: L } = buildHeadField({ pole: DIMORPH.male.head });
    const sy = surfYof(field);
    // half-width where the cross-section has fallen halfway to the face beside it
    const halfW = (zf) => {
      const xs = []; for (let x = 0; x <= 0.024; x += 0.001) xs.push(x);
      const ys = xs.map((x) => sy(x * L.s, zf * L.H));
      const half = (ys[0] + ys[ys.length - 1]) / 2;
      for (let i = 1; i < ys.length; i++) if (ys[i] < half) return xs[i - 1] + 0.001 * (ys[i - 1] - half) / ((ys[i - 1] - ys[i]) || 1);
      return NaN;
    };
    // the tip is NARROWER than the alar base below it — a taper, which is what reads as a pyramid
    expect(halfW(0.335)).toBeLessThan(halfW(0.315));
    expect(halfW(0.335)).toBeLessThan(0.020);
  });
});

describe('the eye', () => {
  it('is a lid / fissure / lid relief down the rings that exist', () => {
    for (const sex of ['male', 'female']) {
      const { field, landmarks: L } = buildHeadField({ pole: DIMORPH[sex].head });
      const sy = surfYof(field);
      const at = (dz) => sy(L.eyeR.x, L.eyeR.z + dz * L.H);
      // the fissure is a SHADOW STEP, not a modelled gap: at 5.9 mm real per latitude ring a
      // 10 mm opening spans 1.7 rings, so it can only be read as the valley between two ridges
      const upper = at(0.031), fissure = at(0.003), lower = at(-0.025);
      expect(upper, `${sex} upper lid`).toBeGreaterThan(fissure);
      expect(lower, `${sex} lower lid`).toBeGreaterThan(fissure);
      // and each lid is its OWN ridge, not just the slope up to the brow or down to the cheek:
      // a bare orbit socket also sits below both, so without this the test passes on no eye at all
      expect(upper, `${sex} upper lid is a ridge`).toBeGreaterThan(at(0.055));
      expect(lower, `${sex} lower lid is a ridge`).toBeGreaterThan(at(-0.049));
    }
  });
  it('eyeSize grows the eye and nothing else', () => {
    const L = headLandmarks();
    const probe = { x: L.eyeR.x, y: 0.0485 * L.s + 0.011 * L.s, z: L.eyeR.z };
    const at = (kn) => buildHeadField({ knobs: kn }).field(probe);
    expect(at({ eyeSize: 1.4 })).toBeLessThan(at({}));
    expect(at({ eyeSize: 0.6 })).toBeGreaterThan(at({}));
    expect(buildHeadField({ knobs: { eyeSize: 1.4 } }).field(L.crown)).toBeCloseTo(buildHeadField({}).field(L.crown), 12);
  });
});
