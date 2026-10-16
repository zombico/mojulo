// The mascot driver: a racer whose setting leans it to a mascot is driven by that person's mascot, seated in the
// cockpit in the stand-in's place. The concepts: the setting's die (or the entry) makes a mascot racer, carried in the
// recipe; the machine and its physics are the person's either way; the mascot sits, is seen, keeps its own colours and
// is counted apart from the machine's budget; hidden faces are left out; deterministic.
import { describe, it, expect } from 'vitest';
import { ARCHETYPES } from '../egocube/facets.js';
import { GENRES } from '../egocube/setting.js';
import { racerSpec, racerOf, solveRoster } from './roster.js';
import { mascotSlot } from './mascot-driver.js';

const arch = Object.keys(ARCHETYPES)[0];
// the genre that leans hardest toward a mascot, chosen from the table
const MASCOT_GENRE = Object.keys(GENRES).sort((a, b) => GENRES[b].weight - GENRES[a].weight)[0];

describe('the mascot driver', () => {
  it('a racer is a mascot by its entry, or by its setting\'s die, and the recipe says so', () => {
    expect(racerSpec({ archetype: arch, tuning: 'mascot' })).toMatchObject({ tuning: 'mascot' });
    expect(racerSpec({ archetype: arch })).not.toHaveProperty('tuning');
    expect(() => racerSpec({ archetype: arch, tuning: 'robot' })).toThrow(/tuning is person or mascot/);
    const field = solveRoster(4, { seed: 1, setting: { genre: MASCOT_GENRE } }).racers;
    expect(field.some((r) => r.spec.tuning === 'mascot')).toBe(true);
    // the operator's word beats the die
    expect(racerSpec({ archetype: arch, tuning: 'person' }, 0, 1, { genre: MASCOT_GENRE })).not.toHaveProperty('tuning');
  });

  it('seats the mascot in the person\'s machine: the frame and the physics the stand-in\'s, the driver seen', () => {
    const spec = { facets: { archetype: arch }, seed: 7 };
    const person = racerOf(spec), mascot = racerOf({ ...spec, tuning: 'mascot' });
    expect(mascot.S.ids).toEqual(person.S.ids);
    expect(mascot.S.frame).toEqual(person.S.frame);
    expect(mascot.S.physics.mass).toBe(person.S.physics.mass);
    expect(mascot.S.laws.map((l) => l.law)).not.toContain('driver-seen');
    expect(mascot.S.laws.map((l) => l.law)).not.toContain('budget');
    // its faces painted in its own colours, standing above the seat
    const painted = new Set(mascot.S.faces.root.map((f) => f.fill));
    expect(painted.size).toBeGreaterThan(new Set(person.S.faces.root.map((f) => f.fill)).size);
    expect(mascot.S.faces.root.length).toBeGreaterThan(person.S.faces.root.length);
    expect(mascotSlot('Body')).toBe('mascot:Body');
  });

  it('is deterministic: the recipe resolves to the same figure', () => {
    const spec = { facets: { archetype: arch }, seed: 3, tuning: 'mascot' };
    expect(JSON.stringify(racerOf(spec).S.figure)).toBe(JSON.stringify(racerOf(spec).S.figure));
  });
});
