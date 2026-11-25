import { describe, it, expect } from 'vitest';
import { composeLive, emissionSource } from './compose.js';

// A CARRIER'S DECK IS FOOTING: the world's ground knows only the road (as the World page's knows no body); a moving deck
// is stood on all the same, and ridden
const CW = composeLive();
const DT = 1 / 60;
const ROAD = { ground: () => 0 };
const deck = (extra = {}) => ({ id: 'd', rule: { type: 'mover', path: [[0, 0, 2.5], [400, 0, 2.5]], period: 50, mode: 'loop' },
  body: { type: 'mesh', shape: 'box', size: [10, 2.4, 3], carrier: true, carryHalf: [5, 1.2], deck: 1.5, ...extra }, transform: { pos: [0, 0, 2.5] } });
const world = (d = deck(), at = [1, 0, 4.4]) => {
  const w = CW.createWorld({ entities: [{ id: 'h', pilotable: true, rule: { type: 'platform', eye: 0, speed: 5, collideRadius: 0.3 }, transform: { pos: at, heading: 0 } }, d] });
  w.pilotId = 'h';
  return w;
};
const run = (w, n, input = {}) => { for (let i = 0; i < n; i++) CW.stepWorld(w, input, DT, ROAD); return w; };

describe('a carrier\'s deck', () => {
  it('is emitted only into a page with a carrier', () => {
    expect(emissionSource({})).not.toContain('stepWithDecks');
    expect(emissionSource({ decks: true })).toContain('stepWithDecks');
  });

  it('is stood on where the world\'s ground knows only the road, and ridden down it', () => {
    const w = run(world(), 30), h = w.byId.h, on = h.transform.pos[0] - w.byId.d.transform.pos[0];
    run(w, 120);
    expect(h.transform.pos[2]).toBeCloseTo(4, 3);              // on the deck's top (2.5 + 1.5), never down on the road
    expect(h.grounded).toBe(true);
    expect(h.carriedBy).toBe('d');
    // (two seconds more at 8 m/s down the road, and where it stood on the deck still)
    expect(w.byId.d.transform.pos[0]).toBeGreaterThan(19);
    expect(h.transform.pos[0] - w.byId.d.transform.pos[0]).toBeCloseTo(on, 3);
  });

  it('is not footing past its footprint, nor over the probe', () => {
    // (beside the deck the hero falls to the road; a deck above the hero is not stood on from under it)
    expect(run(world(deck(), [1, 3, 4.4]), 120).byId.h.transform.pos[2]).toBeCloseTo(0, 3);
    expect(run(world(deck(), [1, 0, 0]), 60).byId.h.transform.pos[2]).toBeCloseTo(0, 3);
    // (a round footprint: carryRadius)
    const r = run(world(deck({ carryHalf: undefined, carryRadius: 2 }), [1.5, 0, 4.4]), 30).byId.h;
    expect(r.transform.pos[2]).toBeCloseTo(4, 3);
  });
});
