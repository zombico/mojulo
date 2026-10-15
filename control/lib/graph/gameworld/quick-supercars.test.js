// A field of supercars on the quick race, and its mood. The concepts: the field read and refused as the racers'
// is; each car a recipe (card, seed, livery) its figure draws, the cards in turn; liveries solved clear of the
// mood's ground where none is given, a given one kept; each on its own rule; the mood on the roadway level; deterministic.
import { describe, it, expect } from 'vitest';
import { readQuick, quickSupercars, quickWorld, raceRivals } from './quick.js';
import { SUPERCAR_LIBRARY } from '../car-designer/vehicle-library.js';
import { moodGround, moodOf } from '../roads/race-mood.js';
import { deltaE, hexToRgb } from '../color-theorist/oklab.js';

const race = (extra) => ({ goal: 'race', roadway: 'kart-oval', ...extra });

describe('a field of supercars', () => {
  it('is read like a field of racers, and refused beside a ride, a hero or rivals', () => {
    expect(() => readQuick(race({ supercars: 3, mood: 'night' }))).not.toThrow();
    expect(() => readQuick(race({ supercars: 1 }))).toThrow(/2 to 8/);
    expect(() => readQuick(race({ supercars: 3, ride: 'coupe' }))).toThrow(/first of the field/);
    expect(() => readQuick(race({ supercars: 3, rivals: 2 }))).toThrow(/whole field/);
    expect(() => readQuick(race({ supercars: [{ preset: 'van' }, {}] }))).toThrow(/preset is one of/);
    expect(() => readQuick(race({ supercars: [{ paint: 'nope' }, {}] }))).toThrow(/unknown paint/);
    expect(() => readQuick({ goal: 'race', supercars: 2, mood: 'night' })).toThrow(/mood lights a roadway/);
    expect(() => readQuick(race({ supercars: 2, mood: 'midnight' }))).toThrow(/mood is one of/);
    expect(raceRivals(race({ supercars: 4 }))).toEqual(['rival-1', 'rival-2', 'rival-3']);
  });

  it('dresses each car: the cards in turn, a given livery kept, the rest solved clear of the mood\'s ground', () => {
    const given = { preset: 'touring', paint: '#20252a', livery: { pattern: 'split', secondary: '#eef0f2' } };
    const Q = race({ supercars: [{}, given, {}, {}], mood: 'night' }), { field } = quickSupercars(Q, 3);
    const cards = Object.keys(SUPERCAR_LIBRARY);
    expect(field.map((c) => c.spec.preset)).toEqual([cards[0], 'touring', cards[2], cards[3]]);
    expect(field[1].spec.surface).toEqual({ paint: given.paint, livery: given.livery });
    for (const c of field) expect(c.figure).toEqual({ supercar: c.spec });
    expect(field.every((c) => c.spec.mood === 'night')).toBe(true);
    const ground = moodGround(moodOf('night'));
    for (const c of [field[0], field[2], field[3]]) for (const g of ground) expect(deltaE(hexToRgb(c.spec.surface.paint), hexToRgb(g.hex))).toBeGreaterThan(0.05);
    expect(field.every((c) => c.rule.type === 'drive' && c.rule.vehicle === 'sports' && c.rule.tuning === 'arcade')).toBe(true);
    expect(quickSupercars(Q, 3)).toEqual(quickSupercars(Q, 3));
  });

  it('the mood rides the roadway level, absent nothing', () => {
    expect(quickWorld({ id: 'gt', quick: race({ supercars: 2, mood: 'dusk' }) }).levels.run.roadway).toEqual({ course: 'kart-oval', dress: true, mood: 'dusk' });
    expect(quickWorld({ id: 'gt', quick: race({ supercars: 2 }) }).levels.run.roadway).toEqual({ course: 'kart-oval', dress: true });
  });
});
