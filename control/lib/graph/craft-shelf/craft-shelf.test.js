import { describe, it, expect } from 'vitest';

import { planWorkbench } from '../worlds/workbench.js';
import { planAssembler } from '../worlds/workbench-assembler.js';
import { VEH_PALETTES } from '../vehicle-designer/veh-common.js';
import {
  CRAFT_ARCHETYPES, CRAFT_KINDS, CRAFT_ODM, CRAFT_REALMS,
  assembleCraft, craftNameIndex, findCraftPart, listCraftShelf, planCraftBuild, resolveCraftPart,
} from './index.js';

// One part per distinct procedure: a (kind, family) pair is one builder path. Chosen from the catalogue in code,
// so a new row is covered by the procedure it runs through and a new family joins this list on its own.
const PROCEDURES = (() => {
  const seen = new Map();
  for (const [sku, row] of Object.entries(CRAFT_ODM)) {
    const key = `${row.kind}/${row.build.family || (row.build.vertical ? 'vertical' : 'surface')}`;
    if (!seen.has(key)) seen.set(key, sku);
  }
  return [...seen.entries()];
})();

const contactsOf = (readout) => readout.gear.map((g) => g.contact);

describe('craft-odm: the inventory is data a builder can read', () => {
  it('names every row by a known kind and realm, in metres, with a mount and a mass', () => {
    for (const [sku, row] of Object.entries(CRAFT_ODM)) {
      expect(CRAFT_KINDS, sku).toHaveProperty(row.kind);
      expect(CRAFT_REALMS, sku).toContain(row.realm);
      expect(row.mass, sku).toBeGreaterThan(0);
      expect(Object.values(row.dims).every((v) => v > 0 && v < 100), sku).toBe(true);
    }
  });

  it('holds one word to one part, and answers the words people say', () => {
    expect(() => craftNameIndex()).not.toThrow();
    expect(findCraftPart('turbofan')).toBe('eng-turbofan-narrow');
    expect(findCraftPart('S-foil')).toBe('foil-strike');
    expect(findCraftPart('Bubble canopy')).toBe('canopy-bubble-warbird');
    expect(findCraftPart('warp core')).toBeNull();
    expect(listCraftShelf({ realm: 'space', kind: 'craft-engine' }).every((p) => p.realm === 'space' && p.kind === 'craft-engine')).toBe(true);
  });
});

describe('resolveCraftPart: one row, one part', () => {
  it.each(PROCEDURES)('%s builds a deterministic, workbench-valid part in metres (%s)', (_proc, sku) => {
    const a = resolveCraftPart(sku);
    expect(resolveCraftPart(sku)).toEqual(a);
    expect(a.units).toBe('m');
    expect(a.garage).toMatchObject({ kind: CRAFT_ODM[sku].kind, sku, realm: CRAFT_ODM[sku].realm });
    const { stats } = planWorkbench(a);
    expect(stats.faces).toBeGreaterThan(0);
  });

  it('keeps the mount at the origin for assembly, and seats a preview on the grid', () => {
    const sku = 'eng-turbofan-narrow';
    const mount = resolveCraftPart(sku, { seat: 'mount' });
    expect(mount.garage.hardpoints.mount).toEqual([0, 0, 0]);
    const grid = resolveCraftPart(sku);
    // the nacelle hangs below its pylon mount: seated, the mount rises by the nacelle's depth
    expect(grid.garage.hardpoints.mount[2]).toBeCloseTo(CRAFT_ODM[sku].dims.diameter, 1);
    expect(() => resolveCraftPart(sku, { seat: 'air' })).toThrow(/seat/);
    expect(() => resolveCraftPart('flux-capacitor')).toThrow(/Unknown craft part/);
  });

  it('dresses in any shelf palette and changes only the role it is told to', () => {
    const sku = 'foil-strike';
    const base = resolveCraftPart(sku, { seat: 'mount' });
    const veh = resolveCraftPart(sku, { seat: 'mount', palette: 'glacierMono' });
    expect(veh.lofts[0].tint).toBe(VEH_PALETTES.glacierMono.paint);
    const red = resolveCraftPart(sku, { seat: 'mount', colors: { paint: '#aa0000' } });
    expect(red.lofts[0].tint).toBe('#aa0000');
    expect(red.lofts[0].stations).toEqual(base.lofts[0].stations);
    expect(() => resolveCraftPart(sku, { colors: { hull: '#000000' } })).toThrow(/color role/);
  });

  it('authors a right-hand wing panel out along +x, swept aft and lifted by its dihedral', () => {
    const wing = resolveCraftPart('wing-narrowbody', { seat: 'mount' });
    const { span } = CRAFT_ODM['wing-narrowbody'].dims;
    const loft = wing.lofts[0];
    expect(loft.axisTo).toEqual({ x: span, y: 0, z: 0 });
    const engine = wing.garage.hardpoints.engine;
    expect(engine[0]).toBeGreaterThan(0);
    expect(engine[1]).toBeLessThan(0);   // aft of the root leading edge: the sweep
  });
});

describe('assembleCraft: a layout of inventory parts stands on its gear', () => {
  it('rests a tricycle airliner level on all its wheels, the nacelles clear of the ground', () => {
    const { manifest, readout } = assembleCraft('narrowbody');
    expect(Math.abs(readout.pitch)).toBeLessThan(1);
    for (const c of contactsOf(readout)) expect(Math.abs(c[2])).toBeLessThan(0.02);
    expect(readout.clearance['craft-engine']).toBeGreaterThan(0.3);
    expect(planAssembler(manifest).stats.warnings).toBeUndefined();
  });

  it('sits a taildragger nose-up on its tailwheel', () => {
    const { readout } = assembleCraft('warbird');
    expect(readout.pitch).toBeGreaterThan(8);
    expect(readout.pitch).toBeLessThan(16);
    for (const c of contactsOf(readout)) expect(Math.abs(c[2])).toBeLessThan(0.03);
    const level = assembleCraft('warbird', { attitude: 'level' }).readout;
    expect(level.pitch).toBe(0);
    expect(() => assembleCraft('warbird', { attitude: 'inverted' })).toThrow(/attitude/);
  });

  it('stands a craft with no gear on its lowest point', () => {
    const { manifest, readout } = assembleCraft('twinPanel');
    expect(readout.gear).toEqual([]);
    expect(readout.clearance['craft-wing']).toBeCloseTo(0, 2);
    expect(planAssembler(manifest).stats.warnings).toBeUndefined();
  });

  it('mirrors a pair across the centreline, and a part on a paired parent pairs with it', () => {
    const { manifest } = assembleCraft('strikeFoil');
    const at = Object.fromEntries(manifest.items.map((i) => [i.id, i]));
    for (const id of ['foilU', 'driveU', 'gunD']) {
      expect(at[`${id}-l`].at).toEqual([-at[`${id}-r`].at[0], at[`${id}-r`].at[1], at[`${id}-r`].at[2]]);
      expect(at[`${id}-l`].flip).toContain('x');
    }
    // the lower foils are the upper ones under flip z: their tips (and the guns on them) hang below
    expect(at['foilD-r'].flip).toBe('z');
    expect(at['gunD-r'].at[2]).toBeLessThan(at['gunU-r'].at[2]);
  });

  it('hangs a T-tail on the fin tip, above the fin root', () => {
    const { manifest } = assembleCraft('bizjet');
    const at = Object.fromEntries(manifest.items.map((i) => [i.id, i.at]));
    expect(at['stab-r'][2] - at.fin[2]).toBeCloseTo(CRAFT_ODM['fin-bizjet'].dims.span, 1);
  });

  it('is a pure function of its arguments', () => {
    expect(assembleCraft('lightSingle')).toEqual(assembleCraft('lightSingle'));
  });
});

describe('planCraftBuild: the audit advises, it never refuses', () => {
  it('passes the stock layout of an archetype against its own BOM', () => {
    const audit = planCraftBuild('heavyFighter');
    expect(audit.ok).toBe(true);
    expect(audit.bom.counts['craft-weapon']).toBe(CRAFT_ARCHETYPES.heavyFighter.bom['craft-weapon']);
  });

  it('names a part from the other realm, a part of the wrong kind, a slot that is not there', () => {
    const swap = { engine: 'drive-pod-light', fin: 'gear-nose-light', canopy: 'canopy-snub' };
    const audit = planCraftBuild('lightSingle', { swap });
    expect(audit.ok).toBe(false);
    expect(audit.warnings.join('\n')).toMatch(/engine: drive-pod-light is a space part on a earth craft/);
    expect(audit.warnings.join('\n')).toMatch(/fin: gear-nose-light is a craft-gear in a craft-fin slot/);
    expect(audit.warnings.join('\n')).toMatch(/swap 'canopy'/);
    expect(audit.bom.missing).toContain('craft-fin: have 0, need 1');
    // and the swapped craft still builds: the propeller has no hub to sit on, so it is left off and named
    const { readout } = assembleCraft('lightSingle', { swap: { engine: 'drive-pod-light' } });
    expect(readout.audit.ok).toBe(false);
    expect(readout.audit.warnings.join('\n')).toMatch(/prop: left off, 'engine' \(drive-pod-light\) has no hardpoint 'propHub'/);
    expect(readout.audit.bom.missing).toContain('craft-propeller: have 0, need 1');
  });
});
