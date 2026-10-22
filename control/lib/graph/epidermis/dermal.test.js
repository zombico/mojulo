// The dermal texturizer's concepts on the realistic head (a coarse net: the concept, not the look): the shape is only an
// adapter (a ring-stack body texturizes with no head at all), the map reads the head's relations, the ear grows no hair,
// the atlas is deterministic and every skin face lands on it, and the scalp is COMBED: neighbouring strands run parallel
// and a type's waves crest together.
import { describe, it, expect } from 'vitest';
import { relationalHead } from '../polygonizer/head-relational.js';
import { relationalHeadChart } from './dermal-head.js';
import { chartFromRings, meshOcclusion } from './dermal-chart.js';
import { readLook, LOOKS, readAncestry } from './dermal-looks.js';
import { HUMAN_ANCESTRIES } from '../egocube/ancestry.js';
import { readDermis, dermisAt, dermalDetail, toneAlbedo, hexLin, headXY } from './dermal-map.js';
import { MST } from '../egocube/ancestry.js';
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
    const jaw = chart.parts.head.marks.points.goR.Z / 1000;
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

describe('the creator\'s sliders', () => {
  it('reads occlusion from the mesh: a point at the bottom of a groove is darker than one on a dome', () => {
    // a ring of points rising round a centre (a socket) and the same ring falling away (a dome)
    const ring = (h) => Array.from({ length: 24 }, (_, i) => [0.01 * Math.cos(i / 3.82), 0.01 * Math.sin(i / 3.82), h]);
    const socket = meshOcclusion([[0, 0, 0], ...ring(0.006)], [[0, 0, 1], ...ring(0).map(() => [0, 0, 1])]);
    const dome = meshOcclusion([[0, 0, 0], ...ring(-0.006)], [[0, 0, 1], ...ring(0).map(() => [0, 0, 1])]);
    expect(socket[0]).toBeLessThan(0.7);
    expect(dome[0]).toBe(1);
  });
  it('paints war paint where its pattern lies, by the face\'s own landmarks, and nothing without it', () => {
    const P = chart.parts.head, M = P.marks.points;
    const at = (X, Y) => ({ key: 'head', part: 'head', side: '', marks: P.marks, around: ((X / (2 * Math.PI * P.marks.r0)) % 1 + 1) % 1, along: Y / (P.length * 1000), length: P.length, girth: P.girth });
    const woad = readDermis({ from: 'male', paint: { pattern: 'eyes', colour: 'woad' } });
    expect(dermalDetail(at(M.eyeR.X + 12, M.eyeR.Y), woad).paint).not.toBeNull();
    expect(dermalDetail(at(0, M.pg.Y), woad).paint).toBeNull();
    expect(dermalDetail(at(M.eyeR.X + 12, M.eyeR.Y), readDermis('male')).paint).toBeNull();
    expect(() => readDermis({ paint: { pattern: 'tiger' } })).toThrow(/pattern/);
  });
  it('reads every look into documents the readers take', () => {
    for (const name of Object.keys(LOOKS).slice(0, 2)) {
      const L = readLook(name);
      expect(() => readDermis(L.dermis)).not.toThrow();
      expect(() => readScalp(L.scalp)).not.toThrow();
      expect(L.relations.skinWave).toBeLessThan(0.03);
    }
  });
});

describe('people of the egocube\'s ancestries', () => {
  it('rolls inside the ancestry\'s own ranges, its eye note through its own derive, its face the individual\'s', () => {
    for (const id of ['east-asian', 'african']) {
      const A = HUMAN_ANCESTRIES[id], P = readAncestry({ id, sex: 'female', seed: 3 });
      expect(P.dermis.tone).toBeGreaterThanOrEqual(A.tones[0]);
      expect(P.dermis.tone).toBeLessThanOrEqual(A.tones[1]);
      expect(A.textures).toContain(P.rolled.texture);
      expect(P.relations).toEqual({});   // never the face's structure
      expect(Object.keys(P.eyes).length > 0).toBe(!!A.derives?.eyes?.includes('sculpt.lidCover +'));
      if (P.rolled.eyes) expect(['inner-fold', 'monolid', 'parallel', 'hooded']).toContain(P.rolled.eyes);
      expect(() => readScalp(P.scalp)).not.toThrow();
    }
  });
  it('stands an afro off the scalp, rounded: its ends within its envelope, well off the head', () => {
    const a = growScalp(chart, D, readScalp({ style: 'afro', spacing: 0.02, strandGap: 0.01 }), { colliders: ['head'] });
    const top = a.guides.filter((g) => g.pts[0][2] > 0.18), off = top.map((g) => Math.hypot(...sub(g.pts[g.pts.length - 1], g.pts[0])));
    expect(off.reduce((x, y) => x + y, 0) / off.length).toBeGreaterThan(0.035);
  });
});

describe('the tie', () => {
  it('gathers every strand of a ponytail to its band, and plaits a braid in three', () => {
    const t = growScalp(chart, D, readScalp({ style: 'braid', spacing: 0.02, strandGap: 0.01 }), { colliders: ['head'] });
    expect(t.bands.length).toBe(2);
    const band = t.bands[0];
    // every strand passes within a little more than the band's radius of its middle
    const near = t.strands.filter((st) => Math.min(...st.pts.map((p) => Math.hypot(...sub(p, band.c)))) < band.r * 2.2);
    expect(near.length).toBe(t.strands.length);
    // the plait: a strand swings from side to side across the braid (its offset from the bundle's middle turns sign)
    const g = t.guides.find((q) => q.tie === 0), tail = g.pts.slice(g.walk.length, g.walk.length + 36);
    const chord = sub(tail[tail.length - 1], tail[0]), cl = Math.hypot(...chord), d = chord.map((v) => v / cl);
    // the offset from the braid's chord, across it: it changes sides as the bundle weaves
    const across = tail.map((p) => { const o = sub(p, tail[0]), a = o[0] * d[0] + o[1] * d[1] + o[2] * d[2]; return [o[0] - d[0] * a, o[1] - d[1] * a, o[2] - d[2] * a]; });
    const ref = across.reduce((m, o) => (Math.hypot(...o) > Math.hypot(...m) ? o : m), [0, 0, 0]);
    const signs = across.slice(2, -2).map((o) => Math.sign(o[0] * ref[0] + o[1] * ref[1] + o[2] * ref[2])).filter(Boolean);
    let flips = 0; for (let i = 1; i < signs.length; i++) if (signs[i] !== signs[i - 1]) flips++;
    expect(flips).toBeGreaterThanOrEqual(2);
  });
});

describe('the deep tones as albedo', () => {
  it('keeps every swatch down to the knee, and below it lifts the deepest in order, red over blue like the knee', () => {
    for (let t = 1; t <= 8; t++) expect(toneAlbedo(t)).toEqual(hexLin(MST[t - 1]));
    const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], [a8, a9, a10] = [8, 9, 10].map(toneAlbedo);
    expect(lum(a8)).toBeGreaterThan(lum(a9)); expect(lum(a9)).toBeGreaterThan(lum(a10));
    expect(lum(a10)).toBeGreaterThan(lum(hexLin(MST[9])));
    expect(a10[0] / a10[2]).toBeGreaterThan(3);
  });
});

describe('the shading painted in', () => {
  it('absent paints nothing, and asked for darkens the enclosed skin, deeper the more it is asked', () => {
    const L = layoutDermis(chart, { page: 128 }), D = readDermis('male');
    const plain = paintDermis(chart, D, L), half = paintDermis(chart, readDermis({ from: 'male', shade: 0.5 }), L), full = paintDermis(chart, readDermis({ from: 'male', shade: 1 }), L);
    expect(paintDermis(chart, readDermis({ from: 'male', shade: 0 }), L).albedo).toEqual(plain.albedo);
    const sum = (T) => T.albedo.reduce((a, v, i) => a + (i % 4 === 3 ? 0 : v), 0);
    expect(sum(half)).toBeLessThan(sum(plain)); expect(sum(full)).toBeLessThan(sum(half));
    for (let i = 0; i < plain.albedo.length; i++) expect(full.albedo[i]).toBeLessThanOrEqual(plain.albedo[i]);
    expect(() => readDermis({ from: 'male', shade: 1.2 })).toThrow(/shade/);
  });
  it('takes an art direction\'s shade: its colour leans the shade to its hue, its steps band it', () => {
    const L = layoutDermis(chart, { page: 128 }), plain = paintDermis(chart, readDermis({ from: 'male', shade: 1 }), L);
    const blue = paintDermis(chart, readDermis({ from: 'male', shade: { amount: 1, colour: '#3050a0' } }), L), cel = paintDermis(chart, readDermis({ from: 'male', shade: { amount: 1, steps: 2 } }), L);
    const ch = (T, c) => T.albedo.reduce((a, v, i) => a + (i % 4 === c ? v : 0), 0);
    expect(ch(blue, 2) / ch(blue, 0)).toBeGreaterThan(ch(plain, 2) / ch(plain, 0));
    expect(cel.albedo).not.toEqual(plain.albedo);
    // (the deep curve: the same shade until the knee, then a near-black only in the deepest few texels)
    const deep = paintDermis(chart, readDermis({ from: 'male', shade: { amount: 1, curve: 'deep' } }), L);
    let moved = 0, n = 0;
    for (let i = 0; i < plain.albedo.length; i += 4) { if (plain.albedo[i + 3] === 0) continue; n++; if (deep.albedo[i] < plain.albedo[i]) moved++; expect(deep.albedo[i]).toBeLessThanOrEqual(plain.albedo[i]); }
    expect(moved).toBeGreaterThan(0); expect(moved / n).toBeLessThan(0.05);
    expect(() => readDermis({ from: 'male', shade: { amount: 1, curve: 'cliff' } })).toThrow(/shade/);
    for (const bad of [{ amount: 2 }, { amount: 1, steps: 1 }, { amount: 1, colour: 'blue' }, { amount: 1, gloss: 1 }]) expect(() => readDermis({ from: 'male', shade: bad })).toThrow(/shade/);
  });
});

describe('the beard\'s styles', () => {
  const beardAt = (D) => chart.samples.map((s) => (s ? dermisAt(s, D, { detail: false }).hair : null)).map((h, i) => ({ h, s: chart.samples[i] })).filter((x) => x.s);
  it('absent, the tract as it was; a style masks its zones and gives each its length', () => {
    const plain = beardAt(readDermis('male')), goatee = beardAt(readDermis({ from: 'male', beardStyle: 'goatee' })), full = beardAt(readDermis({ from: 'male', beardStyle: 'full' }));
    const beard = (xs) => xs.filter((x) => x.h.tract === 'beard');
    expect(beard(goatee).length).toBeLessThan(beard(plain).length);
    expect(beard(goatee).length).toBeGreaterThan(0);
    expect(Math.max(...beard(full).map((x) => x.h.length))).toBeGreaterThan(20);
    expect(beard(plain).every((x) => x.h.length === readDermis('male').stubble)).toBe(true);
  });
  it('grows a lock\'s length as ribbons of hair, curled by the hair\'s type', () => {
    const D = readDermis({ from: 'male', beardStyle: 'full' }), straight = growBodyHair(chart, D, { tracts: ['beard'] }), curly = growBodyHair(chart, D, { tracts: ['beard'], type: 'curly' });
    expect(straight.counts.beard.lock).toBe(true);
    expect(straight.strands.some((s) => s.ribbon > 0 && s.represents >= 1)).toBe(true);
    const wander = (G) => G.strands.reduce((m, s) => m + s.pts.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - s.pts[i][0], p[1] - s.pts[i][1], p[2] - s.pts[i][2]), 0) / Math.hypot(...[0, 1, 2].map((k) => s.pts.at(-1)[k] - s.pts[0][k])), 0) / G.strands.length;
    expect(wander(curly)).toBeGreaterThan(wander(straight));
    expect(() => readDermis({ from: 'male', beardStyle: 'mutton' })).toThrow(/beardStyle/);
  });  it('trims the moustache at the lip line: a hair above the upper lip no longer than its way down to the lip', () => {
    const D = readDermis({ from: 'male', beardStyle: 'moustache' }), near = chart.samples.filter((x) => x?.marks).map((x) => ({ q: headXY(x), M: x.marks.points, h: dermisAt(x, D, { detail: false }).hair })).filter(({ q, M, h }) => h.tract === 'beard' && q.Y > M.ls.Y && q.Y < M.ls.Y + 4 && Math.abs(q.X) < 20);
    expect(near.length).toBeGreaterThan(0);
    for (const { q, M, h } of near) expect(h.length).toBeLessThanOrEqual(Math.max(1.5, (q.Y - M.ls.Y) * 1.15) + 1e-9);
    // (and thick: a styled moustache denser than the bare tract, its hairs lifted off the lip)
    expect(Math.max(...near.map(({ h }) => h.density))).toBeGreaterThan(55 * 1.5);
    expect(Math.max(...near.map(({ h }) => h.lift))).toBeGreaterThan(0.3);
  });
});

describe('the beard\'s growth direction', () => {
  it('fans the moustache out from the philtrum, flatter toward the corners; slants the cheek toward the chin, more lower down', () => {
    const D = readDermis('male'), at = chart.samples.filter((x) => x?.marks).map((x) => ({ q: headXY(x), M: x.marks.points, h: dermisAt(x, D, { detail: false }).hair })).filter(({ h }) => h.tract === 'beard');
    const slant = (h) => Math.abs(Math.atan2(Math.sin(h.flow), -Math.cos(h.flow)));
    const mean = (xs) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
    const lip = at.filter(({ q, M }) => q.Y > M.sto.Y + 2 && q.Y < M.sn.Y - 2), mid = lip.filter(({ q }) => Math.abs(q.X) < 8), edge = lip.filter(({ q, M }) => Math.abs(q.X) > Math.abs(M.chR.X) - 10 && Math.abs(q.X) < Math.abs(M.chR.X));
    expect(mean(edge.map(({ h }) => slant(h)))).toBeGreaterThan(mean(mid.map(({ h }) => slant(h))));
    const cheek = at.filter(({ q, M }) => Math.abs(q.X) > Math.abs(M.chR.X) + 20 && Math.abs(q.X) < Math.abs(M.porionR.X) * 0.5);
    const low = cheek.filter(({ q, M }) => q.Y > M.me.Y + 8 && q.Y < M.goR.Y + 15), high = cheek.filter(({ q, M }) => q.Y > M.sto.Y);
    expect(mean(low.map(({ h }) => slant(h)))).toBeGreaterThan(mean(high.map(({ h }) => slant(h))));
  });
});

describe('a man\'s loss to the horseshoe', () => {
  it('leaves a band round the sides and the back, level, its top about the parietal ridge: no island above it', () => {
    const D = readDermis({ from: 'male', bald: 0.95, peak: 6 }), pts = chart.samples.filter((x) => x?.marks).map((x) => ({ q: headXY(x), M: x.marks.points, s: dermisAt(x, D, { detail: false }).regions.scalp || 0 }));
    const kept = pts.filter(({ s }) => s > 0.5);
    expect(kept.length).toBeGreaterThan(0);
    for (const { q, M } of kept) expect(q.Y).toBeLessThan(M.porionR.Y + 70);
    // (and a full head keeps its crown)
    expect(chart.samples.filter((x) => x?.marks).some((x) => (dermisAt(x, readDermis('male'), { detail: false }).regions.scalp || 0) > 0.5 && headXY(x).Y > x.marks.points.porionR.Y + 70)).toBe(true);
  });
});
