// The lock hair (realistic laws 10): the groom's guides gathered into locks over a solid shell, one case a hair CLASS (a
// style chosen from the catalog by its class), each held to its concept: a crop and a coil are a shell alone (a coil a
// sculpted volume), short and standing hair locks, long hair falls below the chin, a tie's tail is a mass of its own, a
// rope is a tube a tie. Every class: laid off the head, one colour, the scalp shown only in splits (the overlap
// principle). The dial: fewer, chunkier locks and no cards at 1. Small inputs: a coarse chart, wide-spaced guides.
import { describe, it, expect } from 'vitest';
import { relationalHead } from '../polygonizer/head-relational.js';
import { relationalHeadChart } from './dermal-head.js';
import { readDermis, CLIPPER, clipCover, sideburnOf } from './dermal-map.js';
import { readScalp, growScalp, SCALP_STYLES } from './dermal-hair.js';
import { hairClass } from './hair-depict.js';
import { lockHair, lockStrands, beardShell, lockStyleAt, readStylize, surfaceClear, lockClass, HAIR_LOCKS, LOCK_GROUPS, LOCK_TIP, LOCK_FADE } from './hair-locks.js';
import { overlapHair } from './hair-score.js';

const chart = relationalHeadChart(relationalHead({ sex: 'male' }), { cells: 44 });
const D = readDermis({ from: 'male', grey: 0.2, hairColour: 'dark-brown' });
const centre = [0, 0.015, 0.11];
// (one style a class, found in the catalog by its class; wide-spaced guides keep it small)
const styleOf = (cls) => Object.keys(SCALP_STYLES).filter((k) => hairClass(readScalp(k)) === cls).sort((a, b) => readScalp(a).length - readScalp(b).length)[0];
const groom = (cls, extra = {}) => readScalp({ style: styleOf(cls), ...extra });
const skin = surfaceClear(chart);
const all = (H) => [H.mesh, H.cap, H.cards].filter(Boolean);
/** every point of the locks and the cards off the head's skin (a point the clearance would move is inside it or on it; the
 * shell's underside is sunk into the head by its construction, unseen, as the cap's always was) */
const clearOf = (H) => [H.mesh, H.cards].filter(Boolean).every((M) => M.vertices.every((p) => skin.out(p, 0.0002) === p));
/** how far a point stands off the head (its nearest skin point, every fifth) */
const sparse = chart.vertices.filter((_, i) => chart.samples[i] && i % 5 === 0);
const offHead = (p) => Math.min(...sparse.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])));
const groupsOf = (H) => new Set(all(H).flatMap((M) => M.groups));

describe('the lock hair', () => {
  it('reads its dial: 0 … 1, the default between; out of range refused by name', () => {
    expect(readStylize(undefined)).toBe(0.5); expect(readStylize(1)).toBe(1);
    expect(() => readStylize(1.5)).toThrow(/stylize: 0/);
    const [a, b] = [lockStyleAt(0), lockStyleAt(1)];
    expect(a.locks).toBe(HAIR_LOCKS.locks[0]); expect(b.locks).toBe(HAIR_LOCKS.locks[1]);
    expect(a.cards).toBe(1); expect(b.cards).toBe(0); expect(b.round).toBe(1);
  });
  it('a cropped head and a coil are a SHELL alone, the coil a sculpted volume standing off the head', () => {
    const crop = lockHair(chart, D, groom('cropped'), { centre }), coil = lockHair(chart, D, groom('coil'), { centre });
    for (const H of [crop, coil]) { expect(H.mesh).toBeNull(); expect(H.cap.closure).toBe('closed'); expect(clearOf(H)).toBe(true); expect([...groupsOf(H)]).toEqual([LOCK_GROUPS.shell]); }
    const rise = (H) => Math.max(...H.cap.vertices.filter((_, i) => i % 3 === 0).map(offHead));
    expect(rise(coil)).toBeGreaterThan(rise(crop) * 2);
  }, 120_000);
  it('short hair: the STROKE BUDGET (major flows and their trailers, no more), chunkier and fewer up the dial, tip cards only toward 0, the hairline faded; the scalp shown only in splits', () => {
    const S = groom('short'), lo = lockHair(chart, D, S, { centre, stylize: 0 }), hi = lockHair(chart, D, S, { centre, stylize: 1 });
    expect(hi.counts.locks).toBeLessThan(lo.counts.locks);
    for (const [H, s] of [[lo, 0], [hi, 1]]) { const St = lockStyleAt(s); expect(H.counts.locks).toBeLessThanOrEqual(Math.ceil(St.locks * 1.2)); expect(H.counts.trailers).toBeLessThanOrEqual(H.counts.locks * St.trailers); }
    expect(Math.max(...hi.locks.map((l) => l.width))).toBeGreaterThan(Math.max(...lo.locks.map((l) => l.width)));
    expect(lo.counts.cards).toBeGreaterThan(0); expect(hi.counts.cards).toBe(0);
    for (const H of [lo, hi]) { expect(H.counts.fade).toBeGreaterThan(0); expect(H.cards.uv.length).toBe(H.cards.vertices.length); }
    for (const H of [lo, hi]) { expect(H.mesh.closure).toBe('closed'); expect(clearOf(H)).toBe(true); expect(H.counts.overlap.open).toBeLessThan(0.03); expect([...groupsOf(H)]).toEqual([LOCK_GROUPS.mass]); }
    // (deterministic: the same groom and dial, the same mesh)
    expect(lockHair(chart, D, S, { centre, stylize: 1 }).mesh).toEqual(hi.mesh);
  }, 180_000);
  it('standing hair stands off the head; long hair falls below the chin', () => {
    const stand = lockHair(chart, D, groom('standing'), { centre, stylize: 1 }), long = lockHair(chart, D, groom('long', { length: 0.3 }), { centre, stylize: 1 });
    const off = (H) => Math.max(...H.mesh.vertices.filter((_, i) => i % 3 === 0).map(offHead));
    expect(off(stand)).toBeGreaterThan(0.015);
    expect(Math.min(...long.mesh.vertices.map((p) => p[2]))).toBeLessThan(0);
    for (const H of [stand, long]) { expect(clearOf(H)).toBe(true); expect(H.counts.overlap.open).toBeLessThan(0.03); }
  }, 240_000);
  it('the cards lie ON the hair: a broad flow\'s tip cards are narrow strips across its top, never a plank; the hairline is the fade\'s', () => {
    const H = lockHair(chart, D, groom('long', { length: 0.3 }), { centre, stylize: 0 });
    expect(H.counts.cards).toBeGreaterThan(H.counts.locks * HAIR_LOCKS.cards[0] * 0.5);
    // (each card a strip of point pairs across it: none wider than a tip card's width and its neighbour's share, or the fade's)
    const V = H.cards.vertices, widths = [];
    for (let i = 0; i + 1 < V.length; i += 2) widths.push(Math.hypot(...V[i].map((v, k) => v - V[i + 1][k])));
    expect(Math.max(...widths)).toBeLessThan(Math.max(2 * LOCK_TIP.width, 2 * LOCK_FADE.half) * 1.5);
    expect(clearOf(H)).toBe(true);
  }, 180_000);
  it('CLIPPED hair (a fade\'s foot) is no shell but the skin\'s shadow: the shell stops at the clipper\'s length, the guides\' places and lengths handed to the painter', () => {
    // (a cropped style a clipper takes under the shell's length, from the catalog; the same cut held over it, none)
    const name = Object.keys(SCALP_STYLES).find((k) => { const S = readScalp(k); return hairClass(S) === 'cropped' && S.cut?.taper && S.cut.taper.min * 1000 < CLIPPER.shell; });
    const S = readScalp({ style: name, spacing: 0.02 }), held = readScalp({ style: name, spacing: 0.02, cut: { ...S.cut, taper: { ...S.cut.taper, min: (CLIPPER.shell + 1) / 1000 } } });
    const F = lockHair(chart, D, S, { centre }), H = lockHair(chart, D, held, { centre });
    expect(F.clip.mm.some((mm) => mm >= 0 && mm < CLIPPER.shell)).toBe(true); expect(H.clip).toBeUndefined();
    expect(F.counts.shell).toBeLessThan(H.counts.shell);
    // (the shadow's share by length: clipper 0 about a third, clipper 1 about four fifths, never the whole skin)
    expect(clipCover(0.8)).toBeGreaterThan(0.3); expect(clipCover(0.8)).toBeLessThan(0.45); expect(clipCover(3)).toBeGreaterThan(0.7); expect(clipCover(30)).toBeLessThanOrEqual(CLIPPER.max);
  }, 120_000);
  it('the SIDEBURN connects a fade to a beard: a band in front of the ear in the beard\'s length where the face grows one, none on a shaven face', () => {
    const beard = readDermis({ from: 'male', beardStyle: 'short-boxed' }), shaven = readDermis({ from: 'male', beard: 0 });
    const band = chart.samples.map((a) => sideburnOf(a, beard)).filter(Boolean);
    expect(band.some((b) => b.w > 0.9)).toBe(true); expect(band[0].mm).toBeGreaterThan(CLIPPER.shell);
    expect(chart.samples.some((a) => sideburnOf(a, shaven))).toBe(false);
    // (and the groom's clipped length there holds it: a skin fade's sideburn at the beard's cheek, never the fade's foot)
    const G = growScalp(chart, beard, readScalp({ style: 'fade', spacing: 0.02 }), { colliders: ['head'], strands: false });
    const i = chart.samples.findIndex((a) => sideburnOf(a, beard)?.w > 0.9);
    expect(G.clipOf(chart.samples[i], chart.vertices[i]) * 1000).toBeGreaterThan(CLIPPER.shell);
  }, 60_000);
  it('a falling curly groom is drawn as flows; standing coils are the sculpted volume', () => {
    const coils = Object.keys(SCALP_STYLES).map((k) => readScalp(k)).filter((S) => hairClass(S) === 'coil');
    const falls = coils.find((S) => (S.stand ?? 0) < 0.3 && S.length >= 0.15), stands = coils.find((S) => (S.stand ?? 0) >= 0.5);
    expect(lockClass(falls)).toBe('long'); expect(lockClass(stands)).toBe('coil');
  });
  it('a tie\'s tail is a mass of its own; a rope a tube a tie', () => {
    const tied = lockHair(chart, D, groom('tied'), { centre, stylize: 1 }), S = readScalp({ style: styleOf('rope') }), rope = lockHair(chart, D, S, { centre, stylize: 1 });
    expect(tied.counts.tails).toBe(1); expect(tied.counts.overlap.open).toBeLessThan(0.03);
    expect(rope.counts.tails).toBe(S.ties.length); expect(rope.counts.locks).toBe(0);
    for (const H of [tied, rope]) { expect(clearOf(H)).toBe(true); expect(H.mesh.closure).toBe('closed'); }
  }, 180_000);
  it('one colour: a streak only where the groom asks for one', () => {
    const H = lockHair(chart, D, groom('short', { streaks: [{ kind: 'tips', colour: 'blue', from: 0.5 }] }), { centre, stylize: 1 });
    expect(groupsOf(H)).toEqual(new Set([LOCK_GROUPS.mass, LOCK_GROUPS.streak])); expect(H.streak).toHaveLength(3);
  }, 120_000);
  it('the overlap principle sees the scalp where nothing covers it', () => {
    const S = groom('short'), H = lockHair(chart, D, S, { centre, stylize: 1 });
    expect(overlapHair(chart, D, { mass: null, under: [] }, { px: 48 }).passes).toBe(false);
    expect(overlapHair(chart, D, { mass: H.mesh, under: [H.cap] }, { px: 48 }).mass).toBeGreaterThan(0.5);
  }, 120_000);
  // (the face's hair from guides drawn on the chart: a band of short hairs along a ridge, a tuft of long ones off the chin)
  const onSkin = (p) => skin.out(p, 0.0005);
  const band = (x0, dir) => Array.from({ length: 24 }, (_, i) => { const x = x0 + dir * i * 0.002, r = onSkin([x, 0.1, 0.07 + 0.003 * (i % 3)]); return { pts: [r, onSkin([x + dir * 0.006, 0.1, r[2] + 0.002])] }; });
  it('a BAND (a brow): its mass along it and the dial\'s strokes on it, one colour, fewer up the dial; each side its own', () => {
    const guides = [...band(0.012, 1), ...band(-0.012, -1)], lo = lockStrands(guides, chart, { kind: 'brow', centre, stylize: 0, group: 'Brow', sides: true }), hi = lockStrands(guides, chart, { kind: 'brow', centre, stylize: 1, group: 'Brow', sides: true });
    expect(lo.flows).toBeGreaterThan(hi.flows); expect(lo.mesh.closure).toBe('closed'); expect(new Set(lo.mesh.groups)).toEqual(new Set(['Brow']));
    // (its mass runs along the brow: as long as the band's roots, never a tuft at its middle)
    const xs = lo.mesh.vertices.map((p) => p[0]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(2 * 23 * 0.002 * 0.8);
    expect(lockStrands(guides, chart, { kind: 'brow', centre, stylize: 0, group: 'Brow', sides: true })).toEqual(lo);
  });
  it('a BEARD: a short one is its sculpted coat alone; only hair whose tip leaves the skin hangs as flows', () => {
    const short = band(0.012, 1), hang = Array.from({ length: 12 }, (_, i) => { const r = onSkin([-0.01 + i * 0.002, 0.08, -0.03]); return { pts: [r, [r[0], r[1] + 0.004, r[2] - 0.015], [r[0], r[1] + 0.006, r[2] - 0.035]] }; });
    expect(lockStrands(short, chart, { kind: 'beard', centre })).toBeNull();
    const H = lockStrands([...short, ...hang], chart, { kind: 'beard', centre });
    expect(H.flows).toBeGreaterThan(0); expect(Math.min(...H.mesh.vertices.map((p) => p[2]))).toBeLessThan(-0.04);
    // (the coat stands where the hairs stand, never past the shell's most)
    const h = beardShell(chart, short), at = short[5].pts[0];
    expect(h(at)).toBeGreaterThan(0.0005); expect(h(at)).toBeLessThan(0.012);
  });
});
