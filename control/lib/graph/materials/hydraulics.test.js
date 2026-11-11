// Flowing water as a circuit (hydraulics.js): a pump, a nozzle, tiers that spill what they receive, and the mist where
// the water lands on the air solved round it. One small fountain, and the page's channel for its mist.
import { describe, it, expect } from 'vitest';
import { solveHydraulics, mistAir, HYDRAULICS } from './hydraulics.js';
import { hydraulicsScript, impactDrops, WATER_IMPACT } from '../scene/channels/hydraulics.js';
import { vayoPoints } from '../rupa/vayo.js';
import { waterWorks } from '../era/stage.js';

const FOUNTAIN = { id: 'f', basin: { at: [0, 0, 0], radius: 2.2, level: 0.45 }, pump: { head: 4 }, nozzle: { at: [0, 0, 2.5], radius: 0.012 }, tiers: [{ id: 'bowl', at: [0, 0, 1.9], radius: 1 }] };

describe('flowing water as a circuit', () => {
  it('the pump\'s head sets the flow and the jet; what a tier receives it spills; deterministic', () => {
    const W = solveHydraulics(FOUNTAIN), more = solveHydraulics({ ...FOUNTAIN, pump: { head: 6 } });
    // (a stronger pump: more water, thrown higher)
    expect(more.report.flow).toBeGreaterThan(W.report.flow);
    expect(more.report.rise).toBeGreaterThan(W.report.rise);
    // (the jet climbs by what is left of the head past the nozzle, with the basin's own depth behind the pump: v² / 2g,
    // never more than that head)
    expect(W.report.rise).toBeLessThan(4 - (2.5 - 0.45) + 0.45);
    expect(W.report.rise).toBeCloseTo((W.report.speed ** 2) / (2 * 9.81), 2);
    // (continuity: the sheets round the lip pass the riser's whole flow between them)
    const riser = W.jets.find((j) => j.id === 'f:riser'), sheets = W.jets.filter((j) => j.shape === 'sheet');
    expect(sheets).toHaveLength(HYDRAULICS.lips);
    expect(sheets.reduce((a, j) => a + j.discharge, 0)).toBeCloseTo(riser.discharge, 9);
    expect(W.report.tiers[0].fall).toBeCloseTo(1.9 - 0.45, 6);
    expect(JSON.stringify(solveHydraulics(FOUNTAIN))).toBe(JSON.stringify(W));
  });

  it('a circuit that cannot run teaches; one with no nozzle takes its flow as given', () => {
    expect(() => solveHydraulics({ ...FOUNTAIN, pump: { head: 1 } })).toThrow(/nothing reaches it \(raise pump.head\)/);
    expect(() => solveHydraulics({ ...FOUNTAIN, tiers: [{ at: [0, 0, 9], radius: 1 }] })).toThrow(/it is never fed/);
    expect(() => solveHydraulics({ ...FOUNTAIN, basin: { at: [0, 0, 0], radius: 2 } })).toThrow(/basin is/);
    const spring = solveHydraulics({ basin: FOUNTAIN.basin, flow: 2, tiers: FOUNTAIN.tiers });
    expect(spring.report).toMatchObject({ flow: 2, rise: 0 });
    expect(spring.jets.every((j) => j.shape === 'sheet')).toBe(true);
  });

  it('where the water lands a mist rides the air solved round that spot: a wall beside it shapes it; none where asked for none', () => {
    const open = solveHydraulics(FOUNTAIN), walled = solveHydraulics(FOUNTAIN, { colliders: [{ min: [1.4, -4, 0], max: [1.8, 4, 4] }] });
    expect(open.mists.length).toBeGreaterThan(0);
    expect(JSON.stringify(walled.mists[0].env)).not.toBe(JSON.stringify(open.mists[0].env));
    // (each mote's place is a formula of the clock: finite, and moving)
    const M = open.mists[0], at = (t) => vayoPoints(M.spray, M.env, t, true).map((p) => p.p);
    expect(at(1).flat().every(Number.isFinite)).toBe(true);
    expect(JSON.stringify(at(1))).not.toBe(JSON.stringify(at(2)));
    expect(JSON.stringify(at(1))).toBe(JSON.stringify(at(1)));
    expect(solveHydraulics({ ...FOUNTAIN, mist: false }).mists).toEqual([]);
    // (a circuit a kit laid in the open has its air solved again among the world's solids, the mist's spray as it was)
    const again = mistAir(open.mists, { colliders: [{ min: [1.4, -4, 0], max: [1.8, 4, 4] }] });
    expect(JSON.stringify(again[0].env)).toBe(JSON.stringify(walled.mists[0].env));
    expect(again[0].spray).toEqual(open.mists[0].spray);
  });

  it('where water strikes water it lands with the speed of its fall: the sheets on a ring round their tier, the jet on the water under it', () => {
    const W = solveHydraulics(FOUNTAIN), bowl = W.impacts.find((i) => i.id === 'f:bowl'), riser = W.impacts.find((i) => i.id === 'f:riser');
    // (the sheets are thrown a little out from the lip, onto the basin's water, inside the basin)
    expect(bowl.ring).toBeGreaterThan(1);
    expect(bowl.ring).toBeLessThan(bowl.reach);
    expect(bowl.reach).toBe(2.2);
    expect(bowl.at[2]).toBe(0.45);
    expect(bowl.lips).toBe(HYDRAULICS.lips);
    // (a fall's speed: the root of twice g times the drop, and a little more for the speed it left the lip with)
    expect(bowl.speed).toBeGreaterThanOrEqual(Math.sqrt(2 * 9.81 * (1.9 - 0.45)) - 1e-3);
    // (the jet falls back from its top onto the bowl: straight down, on the axis)
    expect(riser.ring).toBe(0);
    // (onto the bowl's own water, a little under its lip, where the jet's fall ends too: it does not pass through)
    expect(riser.at[2]).toBeCloseTo(1.9 - HYDRAULICS.brim, 6);
    expect(riser.speed).toBeCloseTo(Math.sqrt(2 * 9.81 * (2.5 + W.report.rise - riser.at[2])), 2);
    expect(W.jets.find((j) => j.id === 'f:riser').fall).toBeCloseTo(2.5 - riser.at[2], 3);
    expect(W.jets.find((j) => j.shape === 'sheet').fall).toBeCloseTo(1.9 - 0.45, 3);
    expect(solveHydraulics({ ...FOUNTAIN, tiers: [{ ...FOUNTAIN.tiers[0], level: 1.7 }] }).impacts.find((i) => i.id === 'f:riser').at[2]).toBe(1.7);
    // (a harder landing throws its drops higher, never past the most; a ring of sheets throws more than a single jet)
    const soft = impactDrops({ ...bowl, speed: 1 }), hard = impactDrops({ ...bowl, speed: 6 });
    expect(hard.high).toBeGreaterThan(soft.high);
    expect(impactDrops({ ...bowl, speed: 60 }).high).toBe(WATER_IMPACT.high);
    expect(impactDrops(bowl).n).toBeGreaterThan(impactDrops(riser).n);
    expect(solveHydraulics({ ...FOUNTAIN, impact: false }).impacts).toEqual([]);
    // (the page: the rings' shader writes the page's logarithmic depth, or it is hidden behind everything)
    const page = hydraulicsScript({ impacts: W.impacts });
    expect(page).toContain('#include <logdepthbuf_fragment>');
    expect(page).toContain('"impacts":[');
  });

  it('the page plays the mist only when carried; a stage\'s water is a circuit only when it says works', () => {
    expect(hydraulicsScript({ mists: [] })).toBe('');
    const page = hydraulicsScript({ mists: solveHydraulics(FOUNTAIN).mists, report: [] });
    expect(page).toContain('window.__mojWater');
    expect(page).toContain('new THREE.Points');
    expect(waterWorks(true)).toBeNull();
    expect(waterWorks(undefined)).toBeNull();
    expect(waterWorks('works')).toEqual({});
    expect(waterWorks({ works: { head: 5 } })).toEqual({ head: 5 });
    expect(() => waterWorks({ works: { speed: 3 } })).toThrow(/water.works.speed is not a dial/);
  });
});
