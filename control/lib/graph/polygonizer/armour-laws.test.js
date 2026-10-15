// armour-laws.test.js — the designed plate pieces (outfit-plan.js pauldron, chestPlate, bracers) drawn as games draw armour
// (armor/principles.js laws 13–15) and as a hollow plate (station-loft-adorn.js `edge`): within the figure's width,
// segmented and layered, ornament on the edge or in the surface; a thin wall whose inside and liner are in shade. One
// hero, the pieces worn together.
import { describe, expect, it } from 'vitest';
import { heroRecord, heroPlanOf, planLayered, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { compileOutfit, COLOUR_GROUPS } from './outfit-plan.js';
import { validateKit } from './station-loft-adorn.js';
import { silhouetteMoves } from '../stylism/silhouette.js';

const PIECES = [{ kind: 'pauldron', pair: true, colour: 'metal' }, { kind: 'chestPlate', cut: 'cuirass', colour: 'metal', role: 'focal' }, { kind: 'bracers' }];
const h = heroRecord({ cast: 'male', head: 'anime', outfit: { type: 'outfit', style: 'adventurer', pieces: PIECES } });
const plan = heroPlanOf(h), ex = expandLayeredManifest({ kind: 'layered', title: 't', hero: h });
const mesh = planLayered({ kind: 'layered', title: 't', recipe: ex.recipe, plan, hero: h, dials: ex.dials, units: 'm' }).mesh;
const kit = compileOutfit(plan).adorn.filter((A) => /^(pauldron|chestPlate|bracer)/.test(A.id));
const partOf = (vi) => mesh.provenance[vi]?.part ?? '';

describe('armour as games draw it (laws 13–15)', () => {
  it('13: no plate stands past the figure\'s own width at its height by more than its thickness', () => {
    const body = mesh.vertices.filter((_, vi) => !partOf(vi).startsWith('adorn.'));
    const reach = (z) => body.reduce((w, v) => (Math.abs(v[2] - z) < 0.04 && Math.abs(v[0]) > w ? Math.abs(v[0]) : w), 0);
    const plate = mesh.vertices.filter((_, vi) => /^adorn\.(pauldron|chestPlate)[RL](Lame\d)?$/.test(partOf(vi)));
    expect(plate.length).toBeGreaterThan(100);
    for (const v of plate) expect(Math.abs(v[0])).toBeLessThanOrEqual(reach(v[2]) + 0.025);
  });
  it('14: segmented, never one plate over a whole part: a cop over lames, a breastplate over a fauld, a bracer in two bands', () => {
    for (const S of ['R', 'L']) {
      expect(kit.filter((A) => A.id.startsWith(`pauldron${S}`)).length).toBeGreaterThanOrEqual(3);
      expect(kit.filter((A) => A.id.startsWith(`chestPlate${S}`)).length).toBeGreaterThanOrEqual(3);
      const bands = kit.filter((A) => A.id.startsWith(`bracer${S}`)).map((A) => A.s).sort((a, b) => a[0] - b[0]);
      expect(bands.length).toBe(2); expect(bands[1][0]).toBeGreaterThan(bands[0][1]);   // the skin or sleeve shows between
    }
    // no torso plate wraps its part, and the lames shingle: each one up stands further off than the one under it
    for (const A of kit.filter((x) => x.part === 'torso')) expect(Array.isArray(A.t)).toBe(true);
    const lames = kit.filter((A) => /^chestPlateRLame\d$/.test(A.id)).sort((a, b) => a.s[0] - b.s[0]);
    for (let i = 1; i < lames.length; i++) { expect(lames[i].mugen).toBeGreaterThan(lames[i - 1].mugen); expect(lames[i].s[0]).toBeLessThan(lames[i - 1].s[1]); }
  });
  it('15: the ornament is on the edge or in the surface: no knob on a plate\'s field', () => {
    for (const A of kit) { expect(['motif', 'studs']).toContain(A.signature.kind); }
    for (const A of kit.filter((x) => x.part === 'torso')) expect(A.rim?.group).toBe(COLOUR_GROUPS.trim);
    // the focal is embossed (raised, in the accent), every other motif engraved (a cut line in the shade)
    const motifs = kit.filter((A) => A.signature.kind === 'motif');
    expect(motifs.some((A) => A.signature.group === COLOUR_GROUPS.accent)).toBe(true);
    for (const A of motifs.filter((x) => x.signature.group !== COLOUR_GROUPS.accent)) expect(A.signature.group).toBe(COLOUR_GROUPS.shade);
  });
});

describe('how much of the chest a breastplate covers', () => {
  const at = (cover) => compileOutfit(heroPlanOf(heroRecord({ cast: 'male', head: 'anime', outfit: { type: 'outfit', style: 'adventurer', pieces: [{ kind: 'chestPlate', cut: 'cuirass', colour: 'metal', cover }] } }))).adorn.filter((A) => /^chestPlateR/.test(A.id));
  const width = (K) => K.find((A) => A.id === 'chestPlateR').t[1];
  it('grows with the cover: fewer and narrower plates below it, the belly\'s cloth showing; past 0.8 it grows down, never wider', () => {
    const lo = at(0.6), mid = at(0.8), hi = at(1);
    expect(lo.length).toBeLessThan(mid.length); expect(mid.length).toBeLessThan(hi.length);
    expect(width(lo)).toBeLessThan(width(mid)); expect(width(hi)).toBe(width(mid));
  });
  it('one buckle at the waist: with a belt worn, a sash ties with a knot', () => {
    const P = compileOutfit(heroPlanOf(heroRecord({ cast: 'female', head: 'anime', outfit: { type: 'outfit', style: 'adventurer', pieces: [{ kind: 'sash' }] } })));   // the card wears its own belt
    expect(P.adorn.filter((A) => A.signature?.kind === 'buckle' && !/mantle|cloak/i.test(A.id)).length).toBe(1);
    expect(P.adorn.find((A) => /sash/.test(A.id)).signature.kind).toBe('boss');
  });
  it('the stylism keeps the base proportion at every detail: the whole front is only ever asked for by name', () => {
    const cover = (d) => silhouetteMoves('fantasy', 'knight', 0.7, d).flatMap((m) => m.pieces || []).find((p) => p.kind === 'chestPlate')?.cover;
    for (const d of [0, 0.35, 0.7, 1]) expect(cover(d)).toBeUndefined();
    expect(at(undefined).length).toBe(at(0.8).length);
  });
});

describe('a hollow plate', () => {
  it('a thin wall with its inside in the shade, a liner under the cop, the shade derived from the plate when unnamed', () => {
    const groups = new Set(mesh.groups.filter((_, fi) => /^adorn\.chestPlateR$/.test(partOf(mesh.faces[fi][0]))));
    expect(groups.has(COLOUR_GROUPS.shade)).toBe(true); expect(groups.has(COLOUR_GROUPS.trim)).toBe(true);
    expect(mesh.provenance.some((p) => p?.part === 'adorn.pauldronR.liner')).toBe(true);
    expect(compileOutfit(plan).palette[COLOUR_GROUPS.shade]).toMatch(/^#[0-9a-f]{6}$/i);
  });
  it('the plate words are a shell\'s with an `edge`, and say so', () => {
    const parts = { torso: { layer: 1 } }, A = { id: 'p', mode: 'shell', part: 'torso', s: [0, 1], t: [0, 1], mugen: 0, thick: 0.01, signature: { kind: 'studs' } };
    expect(validateKit([{ ...A, edge: 'roll', crown: 0.01, within: 0.01, liner: { group: 'X' }, interior: 'Y', hover: true }], parts)).toEqual([]);
    expect(validateKit([{ ...A, crown: 0.01 }], parts)[0]).toMatch(/crown.*edge/);
    expect(validateKit([{ ...A, edge: 'curl' }], parts)[0]).toMatch(/edge: 'roll' \| 'flat'/);
  });
});
