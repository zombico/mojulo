// fatigues.test.js — the soldier from the ground up, on the game body: the military boots are footwear cards an outfit
// wears by name; trousers INTO the boots end at the top of what covers the shin (a boot's shaft, a puttee's wrap) and
// blouse over it; BREECHES full at the thigh and close below the knee; CARGO pockets wrapped round the thigh on the
// trousers, never hung off it. One boot per construction (a shaft, a wrap), chosen in code from the shelf.
import { describe, it, expect } from 'vitest';
import { FOOTWEAR } from '../footwear/styles.js';
import { validateFootwear } from '../footwear/expand.js';
import { SEEDED_OUTFITS, validateOutfitCard } from './styles.js';
import { expandOutfit } from './expand.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';

const STRUCT = new Set(['torso', 'pelvis', 'neck', 'upperArm', 'foreArm', 'thigh', 'shank', 'foot', 'hallux', 'pectoral']);
const MILITARY = Object.entries(FOOTWEAR).filter(([, C]) => C.family === 'military').map(([w]) => w);
/** what `w` is cut from, merged (styles.js `from`) */
const cardOf = (w) => { const C = FOOTWEAR[w]; return C.from ? { ...cardOf(C.from), ...C, sock: { ...cardOf(C.from).sock, ...(C.sock || {}) } } : C; };
const WRAPPED = MILITARY.find((w) => (cardOf(w).adorn || []).some((a) => a.prim === 'wrap'));
const SHAFTED = MILITARY.find((w) => w !== WRAPPED && cardOf(w).sock?.height === 'boot');
const card = (bottom, feet = 'boots') => ({ ...SEEDED_OUTFITS.fatigues, language: { ...SEEDED_OUTFITS.fatigues.language, feet, bottom: { family: 'woven', leg: 'long', cut: 'straight', ...bottom } } });
const pieces = (bottom, feet) => Object.fromEntries(expandOutfit({ type: 'outfit', style: card(bottom, feet) }, { have: STRUCT, scale: 1 }).garments.map((g) => [g.id, g]));
const recipeOf = (bottom, feet) => expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', outfit: { type: 'outfit', style: card(bottom, feet) } }) }).recipe;
const mid = (st) => [0, 1, 2].map((k) => Object.values(st.points).reduce((s, p) => s + p[k], 0) / Object.values(st.points).length);
/** a piece's mean radius about its own axis at its ring nearest `z` */
const radiusAt = (P, z) => { const st = P.stations.reduce((b, x) => (Math.abs(mid(x)[2] - z) < Math.abs(mid(b)[2] - z) ? x : b)), c = mid(st); return Object.values(st.points).reduce((s, p) => s + Math.hypot(p[0] - c[0], p[1] - c[1]), 0) / Object.values(st.points).length; };

describe('fatigues', () => {
  it('the military boots are footwear cards an outfit wears by name', () => {
    expect(MILITARY.length).toBeGreaterThan(0);
    expect(WRAPPED && SHAFTED).toBeTruthy();
    for (const w of [WRAPPED, SHAFTED]) { expect(validateFootwear(cardOf(w))).toEqual([]); expect(validateOutfitCard(card({}, w))).toEqual([]); }
    expect(validateOutfitCard(card({}, 'clogs')).join()).toMatch(/language\.feet: 'clogs'/);
    expect(validateOutfitCard(card({ into: 'shoes' })).join()).toMatch(/bottom\.into/);
  });

  it('trousers into the boots end at the top of what covers the shin, bloused over it; loose, to the ankle', () => {
    const loose = pieces({}, SHAFTED);
    expect(loose.bottomBlouse).toBeUndefined();
    const ends = (feet) => { const P = pieces({ into: 'boots' }, feet); expect(P.bottomBlouse).toBeTruthy(); expect(P.bottomShin.run[1]).toBe(P.bottomBlouse.run[0]); return P.bottomBlouse.run[1]; };
    // (a shaft's top is 1 − its share up the shank; a wrap's its own `from`; each end a little below it)
    const shaft = 1 - cardOf(SHAFTED).sock.shaft, wrap = Math.min(...cardOf(WRAPPED).adorn.filter((a) => a.prim === 'wrap').map((a) => a.from));
    expect(ends(SHAFTED)).toBeCloseTo(Math.min(0.94, shaft + 0.025), 5);
    expect(ends(WRAPPED)).toBeCloseTo(Math.min(0.94, wrap + 0.025), 5);
    expect(ends('boots')).toBeLessThan(loose.bottomShin.run[1]);
    // (the blouse flares out over the boot's edge)
    const B = pieces({ into: 'boots' }, SHAFTED).bottomBlouse;
    expect(B.flare[1]).toBeGreaterThan(B.flare[0]);
  });

  it('breeches are full at the thigh and close from the knee', () => {
    const R = recipeOf({ cut: 'breeches', into: 'boots' }, SHAFTED), S = recipeOf({ cut: 'straight', into: 'boots' }, SHAFTED);
    const thigh = (X) => { const P = X.parts.bottomLeg_thighR, z = P.stations.map((st) => mid(st)[2]); return radiusAt(P, (Math.min(...z) + Math.max(...z)) / 2); };
    expect(thigh(R)).toBeGreaterThan(thigh(S) * 1.08);
    const shin = (X) => { const P = X.parts.bottomShin_shankR, z = P.stations.map((st) => mid(st)[2]); return radiusAt(P, Math.min(...z)); };
    expect(shin(R)).toBeLessThan(shin(S) * 1.05);
  });

  it('cargo pockets wrap round the thigh on the trousers: a bag, its flap over it and a button, riding the leg', () => {
    const R = recipeOf({ pockets: 'cargo' }), bag = R.parts.cargoRBag_kit, flap = R.parts.cargoRFlap_kit, leg = R.parts.bottomLeg_thighR;
    expect(bag && flap && R.parts.cargoRButton_kit).toBeTruthy();
    expect(recipeOf({}).parts.cargoRBag_kit).toBeUndefined();
    // (round the leg's axis at each of the bag's rows: the bag spans a wide arc, its every point off the trousers by its
    // bellows at most, never standing out from them as a hung box would)
    const pts = Object.values(bag.stations[Math.floor(bag.stations.length / 2)].points), z = pts[0][2], c = mid(leg.stations.reduce((b, x) => (Math.abs(mid(x)[2] - z) < Math.abs(mid(b)[2] - z) ? x : b)));
    const ang = pts.map((p) => Math.atan2(p[1] - c[1], p[0] - c[0])), span = Math.max(...ang) - Math.min(...ang);
    expect(span).toBeGreaterThan(Math.PI / 3);
    const r = radiusAt(leg, z), out = pts.map((p) => Math.hypot(p[0] - c[0], p[1] - c[1]) - r);
    expect(Math.max(...out)).toBeLessThan(0.03);
    expect(Math.min(...out)).toBeGreaterThan(-0.015);
    // (the flap above the bag's mouth; both bound to the thigh)
    const top = (P) => Math.max(...P.stations.flatMap((st) => Object.values(st.points).map((p) => p[2])));
    expect(top(flap)).toBeGreaterThan(top(bag));
    for (const P of [bag, flap]) expect(Object.values(P.bind.blend).some((w) => Object.keys(w).some((b) => /thigh|hip|upLeg/i.test(b)))).toBe(true);
  });
});
