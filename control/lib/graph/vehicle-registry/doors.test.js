import { describe, it, expect } from 'vitest';
import { quickVehicleWords, patchVehicleWords, readThrough, registryReadout } from './doors.js';
import { VEHICLES, handlesOf } from './roster.js';
import { RIDES } from '../gameworld/ride.js';
import { CRAFT_ARCHETYPES } from '../craft-shelf/craft-archetypes.js';
import { quickWorld } from '../gameworld/quick.js';
import { rideableRows } from './ride.js';

// a row chosen in code for each table a quick word reads: one whose registry word is not the table's own key
const rowFor = (table) => Object.keys(VEHICLES).find((id) => handlesOf(id)[table] && !handlesOf(id)[table].includes(id));
// a row the ride door cannot take: no assembled ride and nothing a ride can drive (vehicle-registry/ride.js)
const rowWithout = () => Object.keys(VEHICLES).find((id) => !handlesOf(id).ride && !rideableRows().includes(id));

describe('a quick game\'s vehicle words, read through the registry', () => {
  it('writes a registry word as its table\'s key, and says so', () => {
    const id = rowFor('ride'), key = handlesOf(id).ride[0];
    const { quick, redirects } = quickVehicleWords({ goal: 'reach', ride: VEHICLES[id].label });
    expect(quick).toEqual({ goal: 'reach', ride: key });
    expect(redirects).toEqual([{ key: 'ride', said: VEHICLES[id].label, id, as: key }]);
  });
  it('leaves a legacy key, and a spec with no vehicle word, as they are: the same object', () => {
    const Q = { goal: 'race', ride: Object.keys(RIDES)[0] };
    expect(quickVehicleWords(Q).quick).toBe(Q);
    const plain = { goal: 'collect', pickup: 'coin' };
    expect(quickVehicleWords(plain)).toEqual({ quick: plain, redirects: [] });
  });
  it('reads the physics, the flight model and the transformer\'s craft each through its own table', () => {
    const phys = rowFor('physics'), sky = rowFor('sky'), craft = rowFor('craft');
    const { quick } = quickVehicleWords({ goal: 'reach', ride: Object.keys(RIDES)[0], vehicle: phys, craft: sky });
    expect(quick.vehicle).toBe(handlesOf(phys).physics[0]);
    expect(quick.craft).toBe(handlesOf(sky).sky[0]);
    const T = quickVehicleWords({ goal: 'fly', transformer: { vehicle: { craft: VEHICLES[craft].label } } });
    expect(Object.keys(CRAFT_ARCHETYPES)).toContain(T.quick.transformer.vehicle.craft);
  });
  it('refuses a vehicle the table has none of, naming the row and what it needs', () => {
    const id = rowWithout();
    expect(() => quickVehicleWords({ goal: 'reach', ride: VEHICLES[id].label })).toThrow(new RegExp(`ride is one of .*the registry's ${id}`));
  });
  it('refuses a word the registry does not know, pointing at the rows it nearly names', () => {
    expect(() => readThrough('flying stealth jet', 'ride', Object.keys(RIDES), '.ride')).toThrow(/vehicle registry has/);
  });
});

describe('the quick path writes the legacy key', () => {
  it('a world asked by a registry word is the world asked by its key, byte for byte', () => {
    const id = rowFor('ride'), key = handlesOf(id).ride[0];
    const by = (ride) => JSON.stringify(quickWorld({ id: 'w', quick: { goal: 'reach', ride } }));
    expect(by(VEHICLES[id].label)).toBe(by(key));
  });
});

describe('design_game\'s patch ops, read the same way', () => {
  it('reads an op that sets a vehicle word, and a whole quick spec', () => {
    const id = rowFor('ride'), key = handlesOf(id).ride[0];
    const ops = [{ op: 'set', path: '/quick/ride', value: VEHICLES[id].label }, { op: 'set', path: '/name', value: 'x' }];
    const { patch, redirects } = patchVehicleWords(ops);
    expect(patch[0].value).toBe(key);
    expect(patch[1]).toBe(ops[1]);
    expect(redirects).toHaveLength(1);
    expect(patchVehicleWords([{ op: 'set', path: '/quick', value: { goal: 'reach', ride: id } }]).patch[0].value.ride).toBe(key);
  });
  it('passes ops with no vehicle word through untouched', () => {
    const ops = [{ op: 'set', path: '/name', value: 'x' }];
    expect(patchVehicleWords(ops).patch).toBe(ops);
  });
});

describe('the registry\'s readout', () => {
  it('names the row, the build at the tier, every build and its upscale', () => {
    const id = rowFor('ride');
    const r = registryReadout(id, { tier: 'stylised' });
    expect(r).toMatchObject({ id, label: VEHICLES[id].label, tier: 'stylised' });
    expect(r.builds.length).toBeGreaterThan(1);
    expect(['live', 'preview', 'asleep', 'none']).toContain(r.upscale.realistic);
    expect(registryReadout('no-such')).toBe(null);
  });
});
