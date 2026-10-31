// progression.test.js — the dressing PROGRESSION (outfit/styles.js: civilian security, private security, the mercenary,
// the PMC squad member, the soldier, special forces), each rung a card carrying its own GEAR (`pieces`, worn under a
// build's own: outfitPieces) on the hero door's game body. The gear's concepts, one case each: the plate carrier's
// pieces (its plate, its magazine pouches, its cummerbund, its back panel lying on the back, on no belt); the elbow pads
// over the elbows; the helmet's headset; a card's gear refused when it is not a list of pieces.
import { describe, it, expect } from 'vitest';
import { SEEDED_OUTFITS, validateOutfitCard } from './styles.js';
import { outfitPieces } from './expand.js';
import { headOf, helmetKit } from '../headgear/helmets.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { withDefaultForm } from '../polygonizer/motion-stamp.js';

const RUNGS = ['guard', 'security', 'mercenary', 'pmc', 'bdu', 'specops'];
const mint = (style, pieces) => expandLayeredManifest({ kind: 'layered', hero: heroRecord(withDefaultForm({ cast: 'male', outfit: { type: 'outfit', style, ...(pieces ? { pieces } : {}) } })) });
const mid = (P) => { const ps = P.stations ? P.stations.flatMap((st) => Object.values(st.points)) : Object.values(P.points ?? {}); return [0, 1, 2].map((k) => ps.reduce((s, p) => s + p[k], 0) / ps.length); };
/** the card that carries `kind` (of the vest, its `cut`), chosen in code */
const carrying = (kind, cut) => RUNGS.find((r) => (SEEDED_OUTFITS[r].pieces || []).some((P) => P.kind === kind && (cut === undefined || P.cut === cut)));

describe('the dressing progression', () => {
  it('every rung is a card; a card\'s gear is worn under the build\'s own', () => {
    for (const r of RUNGS) expect(validateOutfitCard(SEEDED_OUTFITS[r])).toEqual([]);
    const r = carrying('pouches');
    expect(outfitPieces({ type: 'outfit', style: r, pieces: [{ kind: 'kneepads' }] }).map((P) => P.kind)).toEqual([...SEEDED_OUTFITS[r].pieces.map((P) => P.kind), 'kneepads']);
    expect(validateOutfitCard({ ...SEEDED_OUTFITS[r], pieces: 'pouches' }).join()).toMatch(/\.pieces/);
  });

  it('the plate carrier: its plate, its magazine pouches, its cummerbund, its back panel on the back and on no belt', { timeout: 120000 }, () => {
    const R = mint(carrying('vest', 'plate')).recipe, names = Object.keys(R.parts);
    expect(names.some((k) => /^adorn\.vest[RL]\b/.test(k) || /^vest[RL]/.test(k))).toBe(true);
    expect(names.filter((k) => /^vestMag[RL]\d.*_kit$/.test(k) && /Body_kit$/.test(k))).toHaveLength(6);
    expect(names.some((k) => /vestCummer/.test(k))).toBe(true);
    const back = names.filter((k) => /^vestBack.*_kit$/.test(k)).map((k) => R.parts[k]);
    expect(back.length).toBeGreaterThan(0);
    // (behind the trunk's middle, and well above the belt: a plate high on the back, not hung at the hip)
    const torso = mid(R.parts.torso), c = mid(back[0]), belt = names.filter((k) => /Belt_/.test(k) && R.parts[k].stations).map((k) => mid(R.parts[k])[2]);
    expect(c[1]).toBeLessThan(torso[1] - 0.05);
    expect(c[2]).toBeGreaterThan(Math.max(...belt) + 0.15);
  });

  it('the elbow pads ride the forearms\' tops; the headset its cups and its boom on the helmet', { timeout: 120000 }, () => {
    const R = mint('casual', [{ kind: 'elbowpads' }]).recipe;
    expect(Object.keys(R.parts).filter((k) => /elbowpad[RL]/.test(k)).length).toBeGreaterThan(0);
    const H = carrying('vest', 'plate'), head = headOf(SEEDED_OUTFITS[H].language), F = helmetKit(head)[0].signature.fittings;
    expect(head.headset).toBe(true);
    expect(F.filter((x) => x.group === 'HelmetComms' && x.kind === 'earpiece')).toHaveLength(2);
    expect(F.some((x) => x.kind === 'arm' && x.group === 'HelmetComms')).toBe(true);
  });
});
