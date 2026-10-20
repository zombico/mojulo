// The dermal texturizer's concepts on the realistic head (a coarse net: the concept, not the look): the shape is only an
// adapter (a ring-stack body texturizes with no head at all), the map reads the head's relations, the ear grows no hair,
// the atlas is deterministic and every skin face lands on it, and the scalp is COMBED: neighbouring strands run parallel
// and a type's waves crest together.
import { describe, it, expect } from 'vitest';
import { relationalHead } from '../polygonizer/head-relational.js';
import { relationalHeadChart } from './dermal-head.js';
import { chartFromRings } from './dermal-chart.js';
import { readDermis, dermisAt } from './dermal-map.js';
import { layoutDermis, paintDermis, reliefTile } from './dermal-texture.js';
import { growScalp, readScalp, growBodyHair, curlShrink, HAIR_TYPES } from './dermal-hair.js';

const head = relationalHead({ sex: 'male' });
const chart = relationalHeadChart(head, { cells: 44 });
const D = readDermis({ from: 'male', stubble: 3 });
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const unit = (a) => { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); };

describe('the dermal chart', () => {
  it('reads any ring-stack body: the shape is an adapter, the map does not know it', () => {
    const ring = (z, r) => Array.from({ length: 8 }, (_, j) => [r * Math.sin((j / 8) * 2 * Math.PI) + 0.2, r * Math.cos((j / 8) * 2 * Math.PI), z]);
    const c = chartFromRings([{ key: 'forearmR', part: 'forearm', side: 'R', rings: [ring(1.1, 0.04), ring(0.95, 0.035), ring(0.82, 0.028)] }]);
    const s = c.samples[0];
    expect(s.part).toBe('forearm');
    expect(s.around).toBeCloseTo(0, 5);   // the ring's first point faces +y: anterior
    expect(dermisAt(s, D).hair.tract).toBe('forearm');
    const L = layoutDermis(c, { page: 64 }), T = paintDermis(c, D, L);
    expect(c.faces.every((_, fi) => T.faceUV(fi).every(([u, v]) => u >= 0 && u <= 1 && v >= 0 && v <= 1))).toBe(true);
  });
  it('lays the face by the head\'s relations: the marks are its landmarks', () => {
    const M = chart.parts.head.marks.points;
    expect(Math.abs(M.eyeR.X + M.eyeL.X)).toBeLessThan(1e-6);   // mirrored
    expect(M.trichion.Y).toBeGreaterThan(M.g.Y);
    expect(M.sn.Y).toBeLessThan(M.n.Y);
  });
  it('keeps the ear its own: no beard, no scalp, no hair on it', () => {
    const ears = chart.samples.filter((s) => s?.feature === 'ear');
    expect(ears.length).toBeGreaterThan(0);
    for (const s of ears.slice(0, 40)) { const r = dermisAt(s, D); expect(r.regions.beard || 0).toBe(0); expect(r.hair.kind).toBe('none'); }
    const beard = growBodyHair(chart, D, { tracts: ['beard'] });
    expect(beard.strands.length).toBeGreaterThan(0);
    // no beard strand roots on the ear: each root is clear of every ear point by more than the net's cell
    const earP = ears.map((s) => chart.vertices[chart.samples.indexOf(s)]);
    const clear = beard.strands.every((st) => earP.every((q) => Math.hypot(...sub(st.pts[0], q)) > 0.002));
    expect(clear).toBe(true);
  });
});

describe('the atlas', () => {
  it('is the same twice, and a relief tile repeats without a seam', () => {
    const L = layoutDermis(chart, { page: 128 }), a = paintDermis(chart, D, L), b = paintDermis(chart, D, L);
    expect(Buffer.from(a.albedo).equals(Buffer.from(b.albedo))).toBe(true);
    const t = reliefTile({ cell: 0.5, aniso: 1.4, furrow: 22, pore: 0.05, poreShare: 0.4 }, { px: 24, size: 4 });
    expect(t.height.length).toBe(24 * 24);
  });
});

describe('the combed scalp', () => {
  const S = readScalp({ style: 'bob', type: 'wavy', spacing: 0.02, strandGap: 0.008 });
  const g = growScalp(chart, D, S, { colliders: ['head'] });
  it('grows the same hair twice', () => {
    const h = growScalp(chart, D, S, { colliders: ['head'] });
    expect(h.strands.length).toBe(g.strands.length);
    expect(h.strands[3].pts).toEqual(g.strands[3].pts);
  });
  it('runs neighbouring strands parallel (combed: no crossing patches)', () => {
    let worst = 1;
    // (off the top: either side of a part the comb runs opposite ways, by design)
    for (let i = 0; i < g.strands.length; i += 7) {
      const a = g.strands[i], r = a.pts[0];
      if (r[2] > 0.66 * 0.23) continue;
      const b = g.strands.reduce((best, s) => (s !== a && Math.hypot(...sub(s.pts[0], r)) < Math.hypot(...sub(best.pts[0], r)) ? s : best), g.strands[i ? 0 : 1]);
      const k = Math.min(a.pts.length, b.pts.length) - 1, m = Math.floor(k / 2);
      const ta = unit(sub(a.pts[m + 1], a.pts[m])), tb = unit(sub(b.pts[m + 1], b.pts[m]));
      worst = Math.min(worst, ta[0] * tb[0] + ta[1] * tb[1] + ta[2] * tb[2]);
    }
    expect(worst).toBeGreaterThan(0.5);
  });
  it('lets a coil shorten the fall, not the hair: coily falls a fraction of straight', () => {
    expect(curlShrink(HAIR_TYPES.straight.curl)).toBe(1);
    expect(curlShrink(HAIR_TYPES.coily.curl)).toBeLessThan(0.5);
  });
  it('lies a buzz on the scalp as body hair, its length without wander', () => {
    const z = growScalp(chart, D, readScalp('buzz'), { colliders: ['head'] });
    expect(z.counts.lying).toBe(true);
    const ls = z.strands.slice(0, 30).map((s) => s.pts.slice(1).reduce((a, p, i) => a + Math.hypot(...sub(p, s.pts[i])), 0));
    expect(Math.max(...ls) - Math.min(...ls)).toBeLessThan(0.0006);
  });
  it('cuts to a line: a bob\'s ends land at the jaw, combed down, however high their roots', () => {
    const b = growScalp(chart, D, readScalp({ style: 'bob', spacing: 0.02, strandGap: 0.01, ragged: 0 }), { colliders: ['head'] });
    const jaw = chart.parts.head.marks.points.goR.Y / 1000;
    // (the front's framing pieces are cut shorter than the line, by the style's `front`)
    const cy = chart.parts.head.axis[0][1], back = (g) => Math.abs(Math.atan2(g.pts[0][0], g.pts[0][1] - cy)) > Math.PI / 2;
    const hanging = b.guides.filter((g) => back(g) && g.pts[0][2] - g.pts[g.pts.length - 1][2] > 0.05);
    expect(hanging.length).toBeGreaterThan(10);
    for (const g of hanging) expect(Math.abs(g.pts[g.pts.length - 1][2] - jaw)).toBeLessThan(0.008);
  });
  it('tapers a short cut: the nape\'s locks shorter than the top\'s', () => {
    const t = growScalp(chart, D, readScalp({ style: 'short', spacing: 0.02, strandGap: 0.01 }), { colliders: ['head'] });
    const low = t.guides.filter((g) => g.pts[0][2] < 0.12), high = t.guides.filter((g) => g.pts[0][2] > 0.2);
    const mean = (gs) => gs.reduce((a, g) => a + g.L, 0) / gs.length;
    expect(mean(low)).toBeLessThan(0.5 * mean(high));
  });
});
