import { describe, it, expect } from 'vitest';
import { shipDeck, SHIP_DECK } from './ship-deck.js';
import { readInfiltration } from './infiltration-words.js';
import { infiltrationStage, infiltrationCast } from './infiltration-level.js';

// A SHIP'S DECK TO PLAY ON: a boat of the craft shelf by its word, held still with its deck at the floor, its sea below
describe('a ship\'s deck', () => {
  const S = shipDeck('supply ship', { speed: 10, night: true });

  it('stands its weather deck at the floor, the sea under it by its freeboard, its bow along +y', () => {
    expect(S.archetype).toBe('supplyShip');
    expect(S.at[2]).toBeCloseTo(-S.deckZ, 5);
    expect(S.seaZ).toBeLessThan(-2.5);                     // (lower than a vault lands: never a way down to it)
    expect(S.seaZ).toBeGreaterThan(-6);
    expect(S.heading).toBeCloseTo(Math.PI / 2, 6);
    expect(S.figure).toEqual({ craft: { archetype: 'supplyShip', look: 'naval' } });
  });

  it('walks inside its rail: the deck\'s outline is the hull\'s, its taper closed at the bow, its house a wall to go round', () => {
    expect(S.inside(0, 0)).toBe(true);
    expect(S.inside(S.halfAt(0) + 0.5, 0)).toBe(false);
    expect(S.inside(0, S.yEnd + 1)).toBe(false);
    const rails = S.colliders.filter((c) => c.of === 'ship:rail'), house = S.colliders.find((c) => c.of === 'ship:house');
    for (const c of rails) expect(c.max[2]).toBe(SHIP_DECK.rail);
    // (each side's rail deeper than a vault crosses, free-run.js depth 1.6)
    for (const c of rails.filter((c) => c.max[1] - c.min[1] <= SHIP_DECK.step + 1e-6)) expect(c.max[0] - c.min[0]).toBeGreaterThan(1.6);
    expect(house.max[0] - house.min[0]).toBeLessThan(2 * S.halfAt((house.min[1] + house.max[1]) / 2) - 2);   // (side decks round it)
  });

  it('lays its sea as a ship making way, the water reflecting the night', () => {
    expect(S.speed).toBeCloseTo(10 * 0.514444, 2);
    expect(S.sea.kind).toBe('ocean');
    expect(S.sea.wakes.length).toBeGreaterThan(0);
    expect(S.sea.foamCol).toBeTruthy();
  });

  it('is an infiltration level\'s ground by its word: the ship a body of the cast, its places held to its deck', () => {
    const P = readInfiltration({ ground: { ship: 'supply ship', speed: 8 }, night: true, start: [0, -32], tasks: [{ take: [0, 27] }] });
    const St = infiltrationStage({}, P);
    expect(St.shipSea).toMatchObject({ speed: expect.any(Number), z: expect.any(Number) });
    expect(St.faces.some((f) => f.group === 'sea')).toBe(false);   // (the live water, not a sheet)
    const C = infiltrationCast({ id: 's', feel: 'steel-serpents' }, P);
    expect(C.figures.ship).toEqual({ craft: { archetype: 'supplyShip', look: 'naval' } });
    expect(C.entities.find((e) => e.id === 'ship').body).toEqual({ type: 'figure-rig', figure: 'ship' });
    expect(() => infiltrationStage({}, readInfiltration({ ground: { ship: 'supply ship' }, start: [7.4, 0], tasks: [{ act: 'x' }] }))).toThrow(/off the .* deck/);
    expect(() => readInfiltration({ ground: { ship: 'supply ship', half: 10 }, start: [0, 0], tasks: [{ act: 'x' }] })).toThrow(/ground is/);
  });
});
