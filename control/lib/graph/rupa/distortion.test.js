import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { MATTER, MATTER_IDS, PLASTIC_IDS, KERF, isPlastic, isBrittle, isCuttable, blockMatter, resolveMatter } from './matter.js';
import { MATERIALS } from '../strength/materials.js';
import { rupaPhysics, readTool, TOOL_IDS } from './index.js';

const { dentOf } = rupaPhysics;
const hard = (m) => 3 * m.yield;
const byYield = PLASTIC_IDS.map((k) => MATTER[k]).sort((a, b) => a.yield - b.yield);
const softest = byYield[0], hardest = byYield[byYield.length - 1];

describe('yield: one dial across the table', () => {
  it('a metal whose strength table states a yield keeps it as its own; brittle stuff has none', () => {
    expect(MATTER.steel.yield).toBe(MATERIALS.s235.strength * 1e6);
    const brittle = MATTER_IDS.map((k) => MATTER[k]).filter((m) => m.strain !== undefined && isBrittle(m));
    expect(brittle.length).toBeGreaterThan(0);
    for (const m of brittle) expect(isPlastic(m)).toBe(false);
  });

  it('a liquid\'s yield is its Bingham stress, not plasticity; a paste sits between it and a metal', () => {
    const bingham = MATTER_IDS.map((k) => MATTER[k]).find((m) => m.family === 'liquid' && m.yield > 0);
    expect(isPlastic(bingham)).toBe(false);
    expect(softest.yield).toBeGreaterThan(bingham.yield);
    expect(hardest.yield).toBeGreaterThan(MATTER.steel.yield);
  });

  it('a shell carries its wall: the thickness a blow must pass; a solid carries none', () => {
    const box = { min: [0, 0, 0], max: [1, 1, 1] };
    const shell = PLASTIC_IDS.find((k) => MATTER[k].fill < 1);
    expect(blockMatter(box, shell).wall).toBeCloseTo(MATTER[shell].fill / 6, 4);
    expect(blockMatter(box, hardest.id).wall).toBeUndefined();
    expect(blockMatter(box, hardest.id).yield).toBe(hardest.yield);
    expect(blockMatter(box, 'brick').yield).toBeUndefined();
    expect(resolveMatter({ is: 'brick', yield: 1e6 }).yield).toBe(1e6);
    expect(() => resolveMatter({ is: 'brick', yield: -1 })).toThrow(/yield/);
  });
});

describe('a dent is a crater in a solid', () => {
  it('the work pushes aside work ÷ hardness, kept in the rim', () => {
    const D = dentOf(5e4, hard(MATTER.steel), { how: 'swing' });
    expect(D.V).toBeCloseTo(5e4 / hard(MATTER.steel), 12);
    expect(0.5 * Math.PI * D.a * D.a * D.d).toBeCloseTo(D.V, 12);             // the bowl holds it
    expect(1.5 * Math.PI * D.a * D.a * D.rim).toBeCloseTo(D.V, 12);           // and the rim (a to 2a, sin²) stands it
    expect(D.d / D.a).toBeCloseTo(rupaPhysics.SHARP.swing, 9);
  });

  it('orders: a rifle round dents mild steel about a centimetre and a swing a few millimetres', () => {
    const shot = dentOf(2000, hard(MATTER.steel), { how: 'shot' }), swing = dentOf(300, hard(MATTER.steel), { how: 'swing' });
    expect(shot.d).toBeGreaterThan(0.005); expect(shot.d).toBeLessThan(0.03);
    expect(swing.d).toBeGreaterThan(0.001); expect(swing.d).toBeLessThan(0.01);
  });

  it('the same work digs the soft deep and the hard shallow; a sharper blow digs deeper', () => {
    const soft = dentOf(300, hard(softest), { how: 'swing' }), stiff = dentOf(300, hard(hardest), { how: 'swing' });
    expect(soft.V / stiff.V).toBeCloseTo(hardest.yield / softest.yield, 6);
    expect(dentOf(300, hard(MATTER.steel), { how: 'shot' }).d).toBeGreaterThan(dentOf(300, hard(MATTER.steel), { how: 'burst' }).d);
  });

  it('powerscaling goes through: a round passes a centimetre of mild steel, paying only for the plug', () => {
    const H = hard(MATTER.steel), thin = dentOf(2000, H, { how: 'shot', thick: 0.01 }), thick = dentOf(2000, H, { how: 'shot', thick: 0.05 });
    expect(thin.through).toBe(true);
    expect(thin.cost).toBeLessThan(2000);
    const plug = Math.min(rupaPhysics.SHOT_R, 0.01 / rupaPhysics.SHARP.shot);   // no wider than the round, nor than the plate is thick
    expect(thin.cost).toBeCloseTo(H * 0.5 * Math.PI * plug ** 2 * 0.01, 6);
    expect(thick.through).toBe(false);
    // the same round on armour of that thickness only dents it; a thousand times it goes through
    const A = hard(hardest);
    expect(dentOf(2000, A, { how: 'shot', thick: 0.01 }).through).toBe(false);
    expect(dentOf(2e6, A, { how: 'shot', thick: 0.01 }).through).toBe(true);
  });

  it('no work, no dent', () => {
    expect(dentOf(0, hard(MATTER.steel))).toMatchObject({ V: 0, d: 0, through: false, cost: 0 });
  });
});

describe('the tool and the cut', () => {
  const H = 3 * MATTER.steel.yield;
  it('a thin panel dishes past its collapse force: a bat\'s force dents a millimetre sheet, not a centimetre plate', () => {
    const { dishOf, TOOLS } = rupaPhysics, sy = MATTER.steel.yield, F = TOOLS.bat.force;
    const thin = dishOf(300, sy, 0.001, { force: F }), thick = dishOf(300, sy, 0.01, { force: F });
    expect(thin.Pc).toBeCloseTo(0.5 * Math.PI * sy * 1e-6, 6);
    expect(thin.d).toBeGreaterThan(0.01); expect(thin.d).toBeLessThan(0.06);
    expect(thick).toBeNull();
    expect(dishOf(300, sy, 0.01, { force: 10 * F })).not.toBeNull();   // ten times the force bends it
    expect(dishOf(300, sy, 0.001, { force: F, half: 0.02 }).d).toBeLessThanOrEqual(0.01);   // no deeper than half its face
  });

  it('what an edge cuts: plastic stuff and wood, never what shatters; brittle stuff carries no kerf', () => {
    const glassy = MATTER_IDS.map((k) => MATTER[k]).find((m) => m.family === 'glass');
    const wood = MATTER_IDS.map((k) => MATTER[k]).find((m) => m.family === 'wood');
    expect(isCuttable(glassy)).toBe(false);
    expect(isCuttable(wood)).toBe(true);
    const box = { min: [0, 0, 0], max: [1, 1, 1] };
    expect(blockMatter(box, wood.id).kerfHard).toBe(wood.compressive);
    expect(blockMatter(box, 'steel').kerfHard).toBe(H);
    expect(blockMatter(box, 'steel').kerfWork).toBeCloseTo(MATTER.steel.frac + MATTER.steel.yield * KERF, 0);
    expect(blockMatter(box, glassy.id).kerfWork).toBeUndefined();
    // the same stroke cuts the softer, weaker stuff deeper
    expect(rupaPhysics.cutDepth(300, blockMatter(box, wood.id).kerfWork, 0.1)).toBeGreaterThan(rupaPhysics.cutDepth(300, blockMatter(box, 'steel').kerfWork, 0.1));
  });

  it('the runtime opens the kerf the matter table names', () => {
    const src = readFileSync(new URL('../worlds/controllable/rupa.js', import.meta.url), 'utf8');
    expect(src).toContain(`KERF_W = ${KERF}`);
  });

  it('a tool is a name or its own numbers over one, checked', () => {
    expect(TOOL_IDS).toContain('bat');
    expect(readTool('bat')).toBe('bat');
    expect(readTool({ is: 'bat', strength: 2e8 })).toEqual({ is: 'bat', strength: 2e8 });
    expect(() => readTool('spoon')).toThrow(/strikeTool is a tool/);
    expect(() => readTool({ edge: 'blunt' })).toThrow(/strength/);
    expect(() => readTool({ is: 'sword', stroke: 'spin' })).toThrow(/stroke/);
    expect(() => readTool({ is: 'bat', colour: 'red' })).toThrow(/not part of a tool/);
    // edges are harder than the mild steel they cut and softer than the armour they ring off
    const sword = rupaPhysics.TOOLS.sword;
    expect(sword.strength).toBeGreaterThan(H);
    expect(sword.strength).toBeLessThan(3 * MATTER['armour-steel'].yield);
  });
});
