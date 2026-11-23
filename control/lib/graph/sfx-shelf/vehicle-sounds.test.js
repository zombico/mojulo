// What each registry vehicle sounds like (vehicle-sounds.js): every word the table names is a shelf row, every kind of
// vehicle the registry holds (realm and role) is answered, a vehicle's own events are its whole set, and a ride the
// sound sheet's words leave to the car's engine is asked of the registry.
import { describe, expect, it } from 'vitest';
import { vehicleSounds, vehicleSoundWords } from './vehicle-sounds.js';
import { SOUNDS } from './roster.js';
import { VEHICLES } from '../vehicle-registry/roster.js';
import { rideSound } from '../gameworld/sound-sheet.js';

// one vehicle per kind (realm and role) the registry holds, found in code: the procedure, not the catalog
const KINDS = [...new Map(Object.entries(VEHICLES).map(([id, r]) => [`${r.realm}/${r.role}`, id])).values()];

describe('vehicle sounds', () => {
  it('every word the table names is a row on the shelf', () => {
    expect(vehicleSoundWords().filter((w) => !SOUNDS[w])).toEqual([]);
  });

  it('every kind of vehicle the registry holds is answered, by rows a shelf holds', () => {
    for (const id of KINDS) {
      const v = vehicleSounds(id);
      expect(v, id).toBeTruthy();
      for (const w of [v.engine, v.runs, ...Object.values(v.events)].filter(Boolean)) expect(SOUNDS[w], `${id}: ${w}`).toBeTruthy();
    }
  });

  it('a vehicle that names its own events has those, not its kind\'s; one that adds to them keeps its kind\'s', () => {
    const pedalled = Object.keys(VEHICLES).find((id) => vehicleSounds(id).runs === 'bicycle-freewheel' && VEHICLES[id].realm === 'road');
    expect(vehicleSounds(pedalled).events).not.toHaveProperty('start');
    const siren = Object.keys(VEHICLES).find((id) => vehicleSounds(id).events.siren && VEHICLES[id].role === 'service');
    expect(vehicleSounds(siren).events).toMatchObject({ brake: expect.any(String), siren: expect.any(String) });
  });

  it('a ride the sheet\'s words leave to the car is asked of the registry; the words it knows keep theirs', () => {
    const G = { sound: {} };
    const rotor = Object.keys(VEHICLES).find((id) => vehicleSounds(id).engine === 'helicopter');
    expect(rideSound(G, { words: rotor, top: 40 }).engine.voice).toBe('helicopter');
    expect(rideSound(G, { words: 'a superbike cycle', top: 60 }).engine.voice).toBe('motorbike-engine');
    expect(rideSound(G, { words: 'coupe sports', top: 40 }).engine.voice).toBe('car-engine');
  });
});
