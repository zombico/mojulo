// Car designer V1 laws: the vehicle sheet, the Egocube's method for a machine. One case per procedure (CLAUDE.md: test
// the concept, not the catalog): determinism, asks never re-drawn, the brief as an ask, a realistic sheet's shape from
// its class, a racer's rolled, faults re-drawn or held, each dial claimed once by the highest source, and every derive
// naming a live dial (the register cross-checked against the tables the compiler will read).
import { describe, it, expect } from 'vitest';
import { DIALS, PROPORTION_KEYS, LIVERY_KEYS, readDerive } from './channels.js';
import { FACET_TABLES, CLASS_TRAITS, SILHOUETTES } from './facets.js';
import { rollVehicleSheet, readVehicleSheet, FAULTS, PRIORS } from './sheet.js';
import { readBrief } from './lexicon.js';
import { VEH_CHASSIS_FAMILIES } from '../vehicle-designer/veh-chassis.js';
import { VEH_BODY_FAMILIES } from '../vehicle-designer/veh-body.js';
import { VEH_WHEEL_FAMILIES } from '../vehicle-designer/veh-wheel.js';
import { VEH_ENGINE_FAMILIES } from '../vehicle-designer/veh-engine.js';
import { VEH_CABIN_FAMILIES } from '../vehicle-designer/veh-cabin.js';
import { VEH_LIGHTS_FAMILIES } from '../vehicle-designer/veh-lights.js';
import { MOTIFS } from '../gameworld/tech-direction.js';
import { ADORNMENT_PIECES } from '../gameworld/tech-adornment.js';
import { BODY_PLANS } from '../gameworld/tech-bodyplan.js';
import { VEHICLES } from '../roads/vehicles.js';

const keysOf = (o) => Object.keys(o).sort();

describe('every derive names a live dial', () => {
  it('the word families are the live tables\' own keys', () => {
    expect(keysOf(Object.fromEntries(DIALS.chassis.keys.map((k) => [k, 1])))).toEqual(keysOf(VEH_CHASSIS_FAMILIES));
    expect([...DIALS.body.keys].sort()).toEqual(keysOf(VEH_BODY_FAMILIES));
    expect([...DIALS.wheel.keys].sort()).toEqual(keysOf(VEH_WHEEL_FAMILIES));
    expect([...DIALS.engine.keys].sort()).toEqual(keysOf(VEH_ENGINE_FAMILIES));
    expect([...DIALS.cabin.keys].sort()).toEqual(keysOf(VEH_CABIN_FAMILIES));
    expect([...DIALS.lights.keys].sort()).toEqual(keysOf(VEH_LIGHTS_FAMILIES));
    expect([...DIALS.motif.keys].sort()).toEqual(keysOf(MOTIFS));
    for (const k of DIALS.adorn.keys) expect(ADORNMENT_PIECES, k).toHaveProperty(k);
    expect([...DIALS.bodyplan.keys].sort()).toEqual(BODY_PLANS['vehicle/wheeled'].variants.map((x) => x.name).sort());
    // the classes are the physics rows, but a two-wheeler (not built yet)
    expect([...DIALS.class.keys].sort()).toEqual(keysOf(VEHICLES).filter((k) => VEHICLES[k].track > 0));
    expect([...new Set(Object.values(VEHICLES).map((r) => r.drive))].sort()).toEqual([...DIALS.drive.keys].sort());
    for (const k of DIALS.physics.keys) expect(VEHICLES.compact, k).toHaveProperty(k === 'share' ? 'share' : k);
    expect(DIALS.proportion.keys).toBe(PROPORTION_KEYS);
    expect(DIALS.livery.keys).toBe(LIVERY_KEYS);
  });
  it('every reading\'s derives parse against the register (the tables are the register\'s only callers)', () => {
    for (const [facet, table] of Object.entries(FACET_TABLES)) for (const [val, row] of Object.entries(table)) {
      for (const list of Object.values(row.derives ?? {})) for (const d of list) expect(() => readDerive(d), `${facet}.${val}: ${d}`).not.toThrow();
    }
    expect(() => readDerive('body = limousine')).toThrow(/unknown body 'limousine'/);
    expect(() => readDerive('physics = mass')).toThrow(/'physics' takes a direction/);
  });
});

describe('a roll', () => {
  it('is deterministic per seed and path; another seed rolls another racer', () => {
    const a = rollVehicleSheet({ facets: { pole: 'racer' }, seed: 3 });
    expect(JSON.stringify(rollVehicleSheet({ facets: { pole: 'racer' }, seed: 3 }))).toBe(JSON.stringify(a));
    expect(JSON.stringify(rollVehicleSheet({ facets: { pole: 'racer' }, seed: 4 }).facets)).not.toBe(JSON.stringify(a.facets));
    expect(JSON.stringify(rollVehicleSheet({ facets: { pole: 'racer' }, seed: 3, path: 'rival-2' }).facets)).not.toBe(JSON.stringify(a.facets));
  });
  it('never re-draws an asked facet, and fixing one never moves another', () => {
    const base = rollVehicleSheet({ facets: { pole: 'racer' }, seed: 9 }), other = Object.keys(SILHOUETTES).find((k) => k !== base.facets.silhouette);
    const fixed = rollVehicleSheet({ facets: { pole: 'racer', silhouette: other }, seed: 9 });
    expect(fixed.facets.silhouette).toBe(other);
    for (const k of ['stance', 'era', 'motif', 'wear', 'livery', 'exaggeration']) if (base.attempt === fixed.attempt) expect(fixed.facets[k], k).toBe(base.facets[k]);
    expect(fixed.given).toEqual(['pole', 'silhouette']);
  });
  it('reads a brief as asks, longest phrase first, an explicit facet over a word, the rest unread', () => {
    const b = readBrief('A rusty lifted muscle car with racing stripes, very loud');
    expect(b.facets).toMatchObject({ class: 'sports', engine: 'oversized', era: 'classic', drive: 'rear', stance: 'raised', wear: 'battered', livery: 'striped' });
    expect(b.unread).toEqual(['a', 'with', 'very', 'loud']);
    const s = rollVehicleSheet({ brief: 'muscle car', facets: { era: 'modern' } });
    expect(s.facets).toMatchObject({ pole: 'realistic', class: 'sports', era: 'modern', engine: 'oversized' });
    expect(s.given).toEqual(expect.arrayContaining(['class', 'engine', 'era', 'drive']));
  });
});

describe('the poles', () => {
  it('a realistic vehicle takes its shape from its class, true to it: exaggeration 0', () => {
    const cls = Object.keys(PRIORS.realistic.class).find((k) => CLASS_TRAITS[k].stance === 'raised');
    const s = rollVehicleSheet({ facets: { pole: 'realistic', class: cls }, seed: 2 });
    for (const k of ['silhouette', 'stance', 'cockpit', 'engine', 'motif', 'drive']) expect(s.facets[k], k).toBe(CLASS_TRAITS[cls][k]);
    expect(s.facets.exaggeration).toBe(0);
    expect(s.derives.frame[0]).toBe(`class = ${cls}`);
    expect(() => rollVehicleSheet({ facets: { pole: 'realistic', exaggeration: 0.5 } })).toThrow(/true to its class: exaggeration is 0/);
    // a brief can still lift it: an asked stance wins the class's
    expect(rollVehicleSheet({ brief: 'lowered pickup', seed: 2 }).facets).toMatchObject({ class: 'pickup', stance: 'low' });
  });
  it('a racer rolls its own shape at kart scale, exaggerated between 0.4 and 1, its wheels big for its body', () => {
    const s = rollVehicleSheet({ facets: { pole: 'racer' }, seed: 5 });
    expect(s.facets.class).toBe('kart');
    expect(s.facets.exaggeration).toBeGreaterThanOrEqual(0.4);
    expect(s.facets.exaggeration).toBeLessThanOrEqual(1);
    expect(s.derives.stance).toContain('proportion.wheelScale +');
    expect(s.derives.frame).toContain('bodyplan = car');
  });
  it('each dial once, from the highest source: the class\'s body over the silhouette\'s', () => {
    const s = rollVehicleSheet({ facets: { pole: 'realistic', class: 'sports', silhouette: 'brick' }, seed: 1 });
    const bodies = Object.values(s.derives).flat().filter((d) => d.startsWith('body ='));
    expect(bodies).toEqual(['body = coupeThree']);
    expect(s.notes.silhouette[0]).toEqual({ line: SILHOUETTES.brick.notes.silhouette, from: 'silhouette.brick' });
  });
  it('a two-wheeler is not built yet, and an unknown word names the known', () => {
    expect(() => readVehicleSheet({ class: 'dirtBike' })).toThrow(/not built yet .* astride/);
    expect(() => readVehicleSheet({ silhouette: 'blob' })).toThrow(/unknown silhouette 'blob' \(known: wedge/);
    expect(() => readVehicleSheet({ colour: 'red' })).toThrow(/unknown facet 'colour'/);
  });
});

describe('faults', () => {
  const f = FAULTS.find((x) => x.id === 'vintage-canopy');
  it('a fault the seed made is drawn again; one the operator asked for is held', () => {
    // asked: vintage and a canopy, both: held
    const held = rollVehicleSheet({ facets: { pole: 'racer', era: 'vintage', cockpit: 'canopy' }, seed: 1 });
    expect(held.faults).toEqual([{ id: f.id, why: f.why, held: true }]);
    // asked: vintage only: over the seeds, no canopy survives
    for (let seed = 1; seed <= 12; seed++) {
      const s = rollVehicleSheet({ facets: { pole: 'racer', era: 'vintage' }, seed });
      expect(s.facets.cockpit, `seed ${seed}`).not.toBe('canopy');
      expect(s.faults.filter((x) => !x.held)).toEqual([]);
    }
  });
});
