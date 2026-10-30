// shirt-collar.test.js — a top's collar as one construction (shirt-collar.js over outfit/collar.js), on the game body, one
// hero per kind: the words read as kinds and fronts and refused when unknown; a shirt's FALL hangs from the stand's top,
// deepest at the front where its two points hang, its edges parting down from the middle (the M), nearly meeting closed
// and spread open, the stand itself parted in its V open; a band is the stand alone, its V widening up it; a turtleneck
// climbs higher than a shirt's stand, a ring all round, its fold all round it.
import { describe, it, expect } from 'vitest';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { collarSpec, COLLAR, COLLAR_KINDS } from './shirt-collar.js';
import { COLLAR_WORDS, validateOutfitCard, SEEDED_OUTFITS } from '../outfit/styles.js';

const recipeOf = (collar) => expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', outfit: { type: 'outfit', style: 'office', language: { top: { ...SEEDED_OUTFITS.office.language.top, collar } } } }) }).recipe;
const mean = (ps) => [0, 1, 2].map((k) => ps.reduce((s, p) => s + p[k], 0) / ps.length);
const pts = (P) => P.stations.flatMap((st) => Object.values(st.points));
const zr = (P) => { const z = pts(P).map((p) => p[2]); return [Math.min(...z), Math.max(...z)]; };
/** the gap at the front between a parted piece's two edges, on its station `i` */
const gapAt = (P, i) => { const st = P.stations[i], [R, L] = P.fronts.map((sl) => st.points[sl]); return R[0] - L[0]; };

describe('a top\'s collar', () => {
  it('reads its words as kinds and fronts; an unknown refused', () => {
    expect(Object.keys(COLLAR_KINDS).sort()).toEqual([...COLLAR_WORDS].sort());
    expect(collarSpec(true)).toEqual({ kind: 'shirt', open: false });
    expect(collarSpec(false)).toBeNull();
    expect(collarSpec('band')).toEqual({ kind: 'band', open: true });
    expect(collarSpec({ kind: 'shirt', open: true })).toEqual({ kind: 'shirt', open: true });
    expect(collarSpec('cowl')).toBeNull();
    const top = SEEDED_OUTFITS.office.language.top, card = (collar) => validateOutfitCard({ ...SEEDED_OUTFITS.office, language: { ...SEEDED_OUTFITS.office.language, top: { ...top, collar } } });
    for (const w of [true, false, 'band', 'turtle', { kind: 'shirt', open: true }]) expect(card(w)).toEqual([]);
    expect(card('cowl').join()).toMatch(/top\.collar\.kind/);
    expect(card({ kind: 'shirt', open: 'yes' }).join()).toMatch(/top\.collar\.open/);
  });

  it('a shirt\'s fall: deepest at the front where its points hang, its edges parting down from the middle; nearly meeting closed, spread open', () => {
    const closed = recipeOf(true).parts, open = recipeOf({ kind: 'shirt', open: true }).parts;
    for (const P of [closed, open]) {
      const F = P.topCollarFall_neck, S = P.topCollar_neck;
      expect(F && S).toBeTruthy();
      // (it hangs from the stand's top: its fold at it, its edge below it)
      expect(Math.abs(zr(F)[1] - zr(S)[1])).toBeLessThan(0.01);
      // (its edge lowest at the front, the points, its back higher)
      const edge = Object.values(F.stations[1].points), front = edge.filter((p) => p[1] > mean(edge)[1]), back = edge.filter((p) => p[1] < mean(edge)[1]);
      expect(Math.min(...front.map((p) => p[2]))).toBeLessThan(Math.min(...back.map((p) => p[2])) - 0.015);
      // (the M: its front edges apart wider at its edge than at its fold)
      expect(gapAt(F, 1)).toBeGreaterThan(gapAt(F, F.stations.length - 2) + 0.005);
    }
    expect(gapAt(open.topCollarFall_neck, 1)).toBeGreaterThan(gapAt(closed.topCollarFall_neck, 1) + 0.02);
    // (closed, the stand a ring buttoned up; open, parted in its V)
    expect(closed.topCollar_neck.fronts).toBeUndefined();
    expect(open.topCollar_neck.fronts).toBeTruthy();
  });

  it('a band is the stand alone, its V widening up it', () => {
    const P = recipeOf('band').parts, S = P.topCollar_neck, n = S.stations.length;
    expect(P.topCollarFall_neck).toBeUndefined();
    expect(gapAt(S, n - 2)).toBeGreaterThan(gapAt(S, 1) + 0.01);
    expect(gapAt(S, n - 2)).toBeLessThanOrEqual(COLLAR.v.top + 0.005);
  });

  it('a turtleneck climbs higher than a shirt\'s stand, a ring all round, its fold all round it', () => {
    const T = recipeOf('turtle').parts, Sh = recipeOf(true).parts;
    expect(zr(T.topCollar_neck)[1]).toBeGreaterThan(zr(Sh.topCollar_neck)[1] + 0.02);
    expect(T.topCollar_neck.fronts).toBeUndefined(); expect(T.topCollarFall_neck.fronts).toBeUndefined();
    // (its fold hangs the same way all round: its edge's height varies far less than a shirt's points do)
    const spread = (P) => { const z = Object.values(P.stations[0].points).map((p) => p[2]); return Math.max(...z) - Math.min(...z); };
    const stand = spread({ stations: [T.topCollar_neck.stations[T.topCollar_neck.stations.length - 1]] });
    expect(spread(T.topCollarFall_neck)).toBeLessThan(stand + 0.01);
  });
});
