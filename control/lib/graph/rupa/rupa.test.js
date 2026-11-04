import { describe, it, expect } from 'vitest';
import { MATTER, MATTER_IDS, SOIL_IDS, CLASS_MATTER, resolveMatter, isBrittle, isCombustible, cutOfMatter, blockMatter, meltJoules } from './matter.js';
import { MATERIALS } from '../strength/materials.js';
import { rupaPhysics, POWER, readMatterSpec, impactJoules, breaches } from './index.js';
import { groundField, crater, slump, dig, deposit, shovel, volumeOf, heightAt } from './ground.js';

const box = (min, max) => ({ min, max });

describe('matter: the principles as numbers', () => {
  it('steel and timber are the strength table converted, not a second truth', () => {
    expect(MATTER.steel.E).toBe(MATERIALS.s235.E * 1e6);
    expect(MATTER.steel.density).toBe(MATERIALS.s235.density * 1000);
    expect(MATTER.timber.E).toBe(MATERIALS.oak.E * 1e6);
  });

  it('brittleness picks the cut: glass shatters, masonry blasts, a ductile metal chips', () => {
    const glassy = MATTER_IDS.map((k) => MATTER[k]).find((m) => m.family === 'glass');
    const masonry = MATTER_IDS.map((k) => MATTER[k]).find((m) => m.family === 'masonry' && isBrittle(m));
    const ductile = MATTER_IDS.map((k) => MATTER[k]).find((m) => m.family === 'metal');
    expect(cutOfMatter(glassy)).toBe('shatter');
    expect(cutOfMatter(masonry)).toBe('blast');
    expect(isBrittle(ductile)).toBe(false);
    expect(cutOfMatter(ductile)).toBe('chip');
  });

  it('every class default names a matter; a custom matter lays over one and is checked', () => {
    for (const v of Object.values(CLASS_MATTER)) expect(MATTER[v.matter]).toBeDefined();
    const m = resolveMatter({ is: 'concrete', toughness: 1e5 });
    expect(m.density).toBe(MATTER.concrete.density);
    expect(m.toughness).toBe(1e5);
    expect(() => resolveMatter('adamantium')).toThrow(/no matter/);
    expect(() => resolveMatter({ density: 1 })).toThrow(/toughness/);
    expect(() => resolveMatter({ is: 'brick', colour: 'red' })).toThrow(/not part of a matter/);
  });

  it('a block holds toughness × volume × fill joules and weighs density × volume × fill', () => {
    const b = box([0, 0, 0], [1, 0.5, 0.4]), solid = blockMatter(b, 'brick'), shell = blockMatter(b, { matter: 'brick', fill: 0.5 });
    expect(solid.joules).toBeCloseTo(MATTER.brick.toughness * 0.2, 0);
    expect(solid.mass).toBeCloseTo(MATTER.brick.density * 0.2, 2);
    expect(shell.joules).toBeCloseTo(solid.joules / 2, 0);
    expect(shell.compressive).toBeCloseTo(solid.compressive / 2, 0);
    expect(solid.cohesion).toBe(MATTER.brick.bond);
  });
});

describe('heat: its own numbers', () => {
  it('a stuff that melts takes its heat to the melt, then its latent heat; what burns has fuel and no melt', () => {
    const ice = MATTER.ice, steel = MATTER.steel;
    expect(meltJoules(ice, 1, -10)).toBeCloseTo(ice.heat * 10 + ice.fusion, 6);
    expect(meltJoules(steel, 1)).toBeGreaterThan(meltJoules(ice, 1, -10));
    const burns = MATTER_IDS.map((k) => MATTER[k]).find(isCombustible);
    expect(meltJoules(burns, 1)).toBeNull();
    const b = blockMatter({ min: [0, 0, 0], max: [1, 0.5, 0.4] }, burns.id);
    expect(b.fuel).toBeCloseTo(b.mass * burns.burn, -3);
    expect(b.burnRate).toBeGreaterThan(0);
    expect(blockMatter({ min: [0, 0, 0], max: [1, 1, 1] }, 'steel').fuel).toBeUndefined();
    // steel is stronger than concrete and gives way to heat about as soon
    expect(steel.compressive).toBeGreaterThan(MATTER.concrete.compressive);
    expect(Math.abs(steel.soften - MATTER.concrete.soften)).toBeLessThan(100);
    expect(() => resolveMatter({ is: 'brick', ignite: 300 })).toThrow(/both ignite/);
  });
});

describe('impact: a blow is joules, a block holds joules', () => {
  it('the cannonball law: a foot of concrete is breached, a foot of steel holds', () => {
    const ball = impactJoules(5.44, 440);                   // a 12-pounder at its muzzle speed, about half a megajoule
    const wall = box([0, 0, 0], [0.6, 0.3048, 0.6]);        // the section a ball engages, a foot thick
    expect(breaches('concrete', wall, ball).breaks).toBe(true);
    const steel = breaches('steel', wall, ball);
    expect(steel.breaks).toBe(false);
    expect(steel.left / steel.capacity).toBeGreaterThan(0.9);   // a dent, not a breach
  });

  it('power tiers are orders of magnitude, and they scale every blow', () => {
    const by = Object.values(POWER).map((p) => p.by);
    for (let i = 1; i < by.length; i++) expect(by[i] / by[i - 1]).toBeGreaterThanOrEqual(10);
    const human = rupaPhysics.blowJoules('swing', readMatterSpec({ power: 'human' }));
    const sup = rupaPhysics.blowJoules('swing', readMatterSpec({ power: 'super' }));
    expect(sup / human).toBe(POWER.super.by / POWER.human.by);
    expect(() => readMatterSpec({ power: 'godlike' })).toThrow(/power/);
    expect(readMatterSpec(undefined)).toEqual({});
  });

  it('a burst: energy by cube-root blast scaling, its share falling off with distance', () => {
    const { blastKg, blastJoules, burstShare } = rupaPhysics;
    expect(blastKg(8) / blastKg(4)).toBeCloseTo(8, 6);
    const J = blastJoules(4), b = box([-0.5, 1, 0], [0.5, 1.4, 0.5]), far = box([-0.5, 3, 0], [0.5, 3.4, 0.5]);
    const near = burstShare(b, [0, 0, 0.25], J), farther = burstShare(far, [0, 0, 0.25], J);
    expect(near).toBeGreaterThan(farther);
    expect(near).toBeLessThanOrEqual(J);
  });
});

describe('impact: matter meets matter', () => {
  const { impact } = rupaPhysics;
  const ball = (matter, size = 0.2) => { const m = blockMatter({ min: [0, 0, 0], max: [size, size, size] }, matter); return { mass: m.mass, stiff: m.stiff, bounce: m.bounce, joules: m.joules }; };
  const wall = (matter) => { const m = blockMatter({ min: [0, 0, 0], max: [0.3, 0.6, 0.5] }, matter); return { stiff: m.stiff, bounce: m.bounce, joules: m.joules, fixed: true }; };

  it('the softer side takes the larger share of one contact: steel into glass, steel into timber', () => {
    const intoGlass = impact(ball('steel'), { ...wall('glass'), joules: Infinity }, 10), intoWood = impact(ball('steel'), { ...wall('timber'), joules: Infinity }, 10);
    expect(intoGlass.toB / intoGlass.dissipated).toBeCloseTo(MATTER.steel.E / (MATTER.steel.E + MATTER.glass.E), 9);
    expect(intoWood.toB / intoWood.dissipated).toBeGreaterThan(intoGlass.toB / intoGlass.dissipated);
    expect(intoGlass.toA + intoGlass.toB).toBeCloseTo(intoGlass.dissipated, 6);
  });

  it('density is the mass behind the speed: same size, same speed, steel goes through brick and pine shatters on it', () => {
    const steel = impact(ball('steel'), wall('brick'), 30), pine = impact(ball('pine'), wall('brick'), 30);
    expect(steel.breaksB).toBe(true);
    expect(steel.toA).toBeLessThan(ball('steel').joules);                 // the ball is unhurt, and pays only what the block cost
    expect(steel.dissipated).toBeLessThan(0.5 * ball('steel').mass * 30 * 30);
    expect(pine.breaksB).toBe(false);
    expect(pine.toA).toBeGreaterThan(ball('pine').joules);                // the pine ball is the one that breaks
  });

  it('a free target shares the blow by reduced mass: a light one is knocked away more than it is hurt', () => {
    const fixed = impact(ball('steel'), { ...wall('pine'), joules: Infinity }, 20);
    const free = impact(ball('steel'), { ...wall('pine'), joules: Infinity, fixed: false, mass: 1 }, 20);
    expect(free.dissipated).toBeLessThan(fixed.dissipated);
  });
});

describe('load: what holds it up', () => {
  const { loadPass } = rupaPhysics;
  const blk = (min, max, matter = 'concrete', lateral = true) => { const m = blockMatter({ min, max }, matter); return { min, max, mass: m.mass, compressive: m.compressive, bond: m.cohesion, lateral }; };

  it('weight goes down the stack: the bottom block carries all above it', () => {
    const s = [0, 1, 2].map((k) => blk([0, 0, k * 0.5], [1, 1, (k + 1) * 0.5]));
    const L = loadPass(s);
    expect(L.weight.get(s[0])).toBeCloseTo((s[0].mass + s[1].mass + s[2].mass) * 9.81, 3);
    expect(L.crush).toEqual([]);
  });

  it('a damaged support crushes under what an intact one carries', () => {
    const base = blk([0, 0, 0], [0.2, 0.2, 1]), heavy = { ...blk([-2, -2, 1], [2, 2, 3]), mass: 5e4 };   // 12 MPa on a 30 MPa post
    expect(loadPass([base, heavy]).crush).toEqual([]);
    const hurt = { ...base, left: 0.01 };
    expect(loadPass([hurt, heavy]).crush).toEqual([hurt]);
  });

  it('a lintel held on both sides spans; an unreinforced overhang past its span snaps', () => {
    const jamb = (x) => blk([x, 0, 0], [x + 0.5, 0.3, 2], 'concrete', false);
    const lintel = blk([0.5, 0, 1.7], [1.5, 0.3, 2]);
    expect(loadPass([jamb(0), jamb(1.5), lintel]).span).toEqual([]);
    // a slab cantilevered off one post: a short tongue holds, a long one snaps at the root (plain concrete, σt 3 MPa)
    const post = blk([0, 0, 0], [0.5, 1, 2], 'concrete', false);
    const tongue = (n) => Array.from({ length: n }, (_, i) => blk([0.5 + i, 0, 1.8], [1.5 + i, 1, 2]));
    expect(loadPass([post, ...tongue(1)]).span).toEqual([]);
    expect(loadPass([post, ...tongue(6)]).span.length).toBe(1);
  });
});

describe('ground: craters, slumps and the shovel', () => {
  const field = (soil, o = {}) => groundField({ origin: [-6, -6], size: [12, 12], cell: 0.25, soil, soilDepth: 3, ...o });

  it('a crater throws its volume into a rim, bulked by the swell, none lost', () => {
    const f = field('loam'), before = volumeOf(f);
    const C = crater(f, { at: [0, 0], joules: 4.184e6, settle: false });
    expect(C.radius).toBeGreaterThan(0.5); expect(C.radius).toBeLessThan(1.5);   // a kilogram of TNT on loam: about a metre
    expect(volumeOf(C.field) - before).toBeCloseTo(C.removed * (MATTER.loam.swell - 1), 6);
    expect(heightAt(C.field, 0, 0)).toBeLessThan(0);
    expect(heightAt(C.field, C.radius * 1.3, 0)).toBeGreaterThan(0);              // the rim
  });

  it('bedrock stops a crater', () => {
    const C = crater(field('sand', { soilDepth: 0.2 }), { at: [0, 0], joules: 4e7, settle: false });
    expect(C.rock).toBe(true);
    expect(Math.min(...C.field.h)).toBeCloseTo(-0.2, 9);
  });

  it('sand slumps to its angle of repose; clay holds a trench wall', () => {
    const trench = (soil) => dig(field(soil), { at: [0, 0], radius: 1.5, depth: 1.2 }).field;
    const steep = (f) => { let s = 0; for (let j = 0; j < f.ny; j++) for (let i = 0; i + 1 < f.nx; i++) s = Math.max(s, Math.abs(f.h[j * f.nx + i] - f.h[j * f.nx + i + 1]) / f.cell); return s; };
    const sand = slump(trench('sand')), clay = slump(trench('clay'));
    expect(sand.moved).toBeGreaterThan(0);
    expect(steep(sand.field)).toBeLessThanOrEqual(Math.tan(MATTER.sand.phi * Math.PI / 180) + 1e-3);
    expect(clay.moved).toBe(0);
    expect(volumeOf(sand.field)).toBeCloseTo(volumeOf(trench('sand')), 6);
  });

  it('a shovel moves a scoop: bank out here, loose in there, the volume kept but for the swell', () => {
    const f = field('gravel'), S = shovel(f, { from: [-2, 0], to: [2, 0], scoop: 'bucket' });
    expect(S.bank).toBeGreaterThan(0.5);
    expect(volumeOf(S.field) - volumeOf(f)).toBeCloseTo(S.bank * (MATTER.gravel.swell - 1), 6);
    expect(heightAt(S.field, -2, 0)).toBeLessThan(0);
    expect(heightAt(S.field, 2, 0)).toBeGreaterThan(0);
    expect(deposit(f, { at: [0, 0], volume: 0 }).field.h).toEqual(f.h);
  });

  it('deterministic: the same acts give the same heights', () => {
    const a = crater(field(SOIL_IDS[0]), { at: [0.3, -0.2], joules: 1e6 }), b = crater(field(SOIL_IDS[0]), { at: [0.3, -0.2], joules: 1e6 });
    expect(a.field.h).toEqual(b.field.h);
  });
});
