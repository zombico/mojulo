// Armour fitted to the realistic body (body-relational-armour.js): every piece's ROLE read off its geometry, the same for
// a plate, a lamellar and a hardsuit family; what the realistic body leaves off (the head's, the optional gorget); and one
// realistic knight: its cuirass, its hoops, its boots and its pauldrons' caps made, the caps closed and wound once.
// (Beside the module, not in the critical tier: a realistic mint takes seconds.)
import { describe, it, expect, beforeAll } from 'vitest';
import { heroRecord, expandLayeredManifest, dressReadout } from '../../mcp/tools/layered.js';
import { compileLayered, auditLayered } from './station-loft.js';
import { roleOf, wornPieces } from './body-relational-armour.js';
import { validateArmor } from '../armor/expand.js';

/** a style's kit as the authored plan carries it */
const kitOf = (style) => expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', adorn: { type: 'armor', style } }) }).plan.adorn;
const rolesOf = (kit) => Object.fromEntries(kit.filter((A) => roleOf(A)).map((A) => [A.id, roleOf(A)]));

describe('a piece\'s role, read off its geometry', () => {
  it('plate (knight): the breast and the back panels, the fauld\'s wraps hoops, the pauldron\'s anchor a shoulder, the sabaton a foot, the gorget the neck', () => {
    const R = rolesOf(kitOf('knight'));
    expect(R).toMatchObject({ 'torso-breastR': 'panel', 'torso-backL': 'panel', 'torso-fauld': 'hoop', 'pelvis-fauld': 'hoop', 'torso-pauldronR': 'shoulder', 'footL-sabaton': 'foot', 'neck-gorget': 'neck' });
  });
  it('lamellar (aka): its rows hoops, its skirt\'s pinned plates none (they hang), its helm the head\'s', () => {
    const kit = kitOf('aka'), R = rolesOf(kit);
    expect(Object.entries(R).filter(([k]) => /^torso-do/.test(k)).every(([, r]) => r === 'hoop')).toBe(true);
    for (const A of kit.filter((x) => /kusazuri/.test(x.id))) expect(roleOf(A), A.id).toBeNull();
    expect(R['cranium-hachi']).toBe('head');
    expect(Object.entries(R).filter(([k]) => /^neck-shikoro[RL]\d$/.test(k)).every(([, r]) => r === 'head')).toBe(true);
  });
  it('hardsuit (armored-hero): its chest, back and abdomen panels, its belt a hoop, its boots feet, its collar the neck', () => {
    const R = rolesOf(kitOf('armored-hero'));
    expect(R).toMatchObject({ 'torso-chestR': 'panel', 'torso-backplateL': 'panel', 'torso-absR0': 'panel', 'torso-belt': 'hoop', 'footR-boot': 'foot', 'neck-collar': 'neck', 'torso-pauldronL': 'shoulder' });
  });
});

describe('what the realistic body leaves off', () => {
  it('the head\'s pieces and the straps hung from them always; the gorget unless worn', () => {
    const aka = wornPieces(kitOf('aka'));
    expect(aka.some((A) => /^(cranium-|neck-shikoro)/.test(A.id))).toBe(false);
    expect(aka.some((A) => /kusazuri/.test(A.id))).toBe(true);
    const knight = kitOf('knight');
    expect(wornPieces(knight).some((A) => A.id === 'neck-gorget')).toBe(false);
    expect(wornPieces(knight, ['gorget']).some((A) => A.id === 'neck-gorget')).toBe(true);
    expect(validateArmor({ type: 'armor', style: 'knight', wear: ['gorget'] })).toEqual([]);
    expect(validateArmor({ type: 'armor', style: 'knight', wear: ['helm'] }).join(' ')).toMatch(/adorn\.wear: .*gorget/);
  });
});

describe('the realistic knight', () => {
  let hero, m, r, mesh, A;
  beforeAll(() => {
    hero = heroRecord({ cast: 'male', form: 'realistic', adorn: { type: 'armor', style: 'knight' } });
    m = expandLayeredManifest({ kind: 'layered', hero }); r = m.recipe;
    mesh = compileLayered(r); A = auditLayered(mesh);
  }, 300_000);
  it('wears a cuirass, hoops, boots and two pauldron caps; the kit\'s own breast, fauld, sabatons and anchors gone', () => {
    for (const k of ['cuirass_torso', 'fauld_torso', 'fauld_pelvis', 'boots_footR', 'bootsSole_footL', 'adorn.pauldronR', 'adorn.pauldronL']) expect(r.parts[k], k).toBeTruthy();
    expect(Object.keys(r.parts).some((k) => /torso-(breast|back)[RL]$|-sabaton$|torso-pauldron[RL]$|neck-gorget/.test(k))).toBe(false);
  });
  it('its caps closed and wound once, its shells sound', () => {
    for (const k of ['adorn.pauldronR', 'adorn.pauldronL', 'cuirass_torso', 'fauld_pelvis']) {
      expect(A[k].nonManifold, k).toBe(0); expect(A[k].windingErrors, k).toBe(0); expect(A[k].boundaryEdges, k).toBe(0);
    }
  });
  it('its read judges what it wears: the pieces its own shells replaced and the ones it leaves off are unworn, never "does not read"', { timeout: 300_000 }, () => {
    const D = dressReadout(hero, m.plan, mesh, r);
    expect(D.unworn).toEqual(expect.arrayContaining(['torso-breastR', 'torso-backL', 'torso-fauld', 'pelvis-fauld', 'footR-sabaton', 'torso-pauldronR', 'neck-gorget']));
    expect(D.adornments.length).toBeGreaterThan(0);
    for (const a of D.adornments) { expect(D.unworn, a.id).not.toContain(a.id); expect(mesh.parts[`adorn.${a.id}`], a.id).toBeTruthy(); }
  });
});
