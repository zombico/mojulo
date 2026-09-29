import { describe, it, expect, beforeAll } from 'vitest';
import { CATALOG, ASSEMBLIES, TRADITIONS, assemblyProps, materialError } from './catalog.js';
import { ifcGuid } from './elements.js';
import { validateFraming } from './house-frame.js';
import { structurizeHouse, storeyLevels } from '../polygonizer/floorplan-structure.js';
import { ensureExactKernel } from '../polygonizer/field-exact.js';

const M = { storeys: 2, seed: 4, tier: 'house', windows: true, roof: 'mission' };
const house = (framing) => { const m = { ...M, framing }; return structurizeHouse({ ...m, ...storeyLevels(m) }, m); };
const check = (h, rule) => h.construction.checks.filter((c) => c.rule === rule);

describe('construction — the catalog, linings, wiring and the building model', () => {
  beforeAll(async () => { await ensureExactKernel(); });

  it('names every material an assembly is built of, and sums an assembly', () => {
    for (const a of Object.values(ASSEMBLIES)) for (const l of a.layers) expect(materialError(l.material), l.material).toBeNull();
    for (const t of Object.values(TRADITIONS)) for (const k of ['exterior', 'partition', 'ceiling']) if (t[k]) expect(ASSEMBLIES[t[k]]).toBeDefined();
    expect(assemblyProps('na-2x6-exterior')).toEqual({ mm: 163.8, rsi: 3.43 });
    expect(CATALOG['cable:nm-b-12-2'].amps).toBe(20);
    expect(materialError('board:cardboard')).toMatch(/not in the catalog/);
  });

  it('is the frame alone at stage frame, byte for byte', () => {
    expect(JSON.stringify(house({ system: 'platform', stage: 'frame' }).faces)).toBe(JSON.stringify(house({ system: 'platform' }).faces));
    expect(house({ system: 'platform' }).construction).toBeUndefined();
  });

  it('wires a North American house: receptacles within 6 ft of any wall point, a switch at every door, kitchen circuits', () => {
    const h = house({ system: 'platform', stage: 'rough-in' });
    expect(h.construction.summary.failed).toBe(0);
    for (const c of check(h, 'receptacle-spacing')) expect(c.worstFt).toBeLessThanOrEqual(6);
    for (const c of check(h, 'switch-at-door')) expect(c.switches).toBe(c.doors);
    const panel = h.construction.schedules.panel;
    expect(panel.filter((c) => c.use === 'kitchen')).toHaveLength(2);
    expect(panel.filter((c) => c.use === 'kitchen').every((c) => c.amps === 20 && c.cable === 'cable:nm-b-12-2')).toBe(true);
    expect(h.construction.summary.holes.studs).toBeGreaterThan(20);
    expect(h.construction.summary.byClass.IfcElectricDistributionBoard).toBe(1);
  });

  it('gives every element a stable, unique IFC GlobalId', () => {
    const a = house({ system: 'platform', stage: 'lined' }).construction.elements, b = house({ system: 'platform', stage: 'lined' }).construction.elements;
    expect(a.map((e) => e.guid)).toEqual(b.map((e) => e.guid));
    expect(new Set(a.map((e) => e.guid)).size).toBe(a.length);
    expect(a.every((e) => /^[0-9A-Za-z_$]{22}$/.test(e.guid))).toBe(true);
    expect(ifcGuid('x')).toBe(ifcGuid('x'));
    const sheets = house({ system: 'platform', stage: 'lined' }).construction.schedules.sheets;
    expect(sheets.find((s) => s.material === 'board:gypsum-12.7').sheetsToBuy).toBeGreaterThan(100);
  });

  it('lines a kigumi house in shinkabe, with fusuma and shoji, wired down the posts, never through them', () => {
    const h = house({ system: 'kigumi', stage: 'lined' });
    const types = h.construction.elements.map((e) => e.key);
    expect(types.some((k) => /:fusuma:/.test(k))).toBe(true);
    expect(types.some((k) => /:shoji:/.test(k))).toBe(true);
    expect(h.construction.elements.some((e) => e.material === 'plaster:jura')).toBe(true);
    expect(h.construction.summary.holes.posts).toBe(0);
    expect(h.construction.summary.holes.mouldingFt).toBeGreaterThan(50);
    expect(check(h, 'materials-in-catalog')[0].ok).toBe(true);
    expect(h.construction.schedules.panel.every((c) => c.amps === 20)).toBe(true);
  });

  it('rings a British house in 2.5 mm², chased in the brick, and plasters it', () => {
    const h = house({ system: 'masonry', stage: 'lined' });
    const rings = h.construction.schedules.panel.filter((c) => c.use !== 'lighting');
    expect(rings.every((c) => c.amps === 32 && c.cable === 'cable:te-2.5')).toBe(true);
    expect(h.construction.summary.holes.chasesFt).toBeGreaterThan(20);
    expect(h.construction.elements.some((e) => e.material === 'plaster:gypsum-two-coat')).toBe(true);
    expect(h.framing).toMatchObject({ stage: 'lined', tradition: 'british' });
  });

  it('infills a concrete frame with block and validates the stage', () => {
    const h = house({ system: 'concrete', stage: 'lined' });
    expect(h.construction.elements.some((e) => e.material === 'block:cmu')).toBe(true);
    expect(h.construction.elements.some((e) => e.material === 'plaster:render')).toBe(true);
    expect(validateFraming({ stage: 'plastered', tradition: 'martian' }).join('\n')).toMatch(/stage: one of[\s\S]*tradition: one of/);
  });
});
