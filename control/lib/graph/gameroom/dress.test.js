// The dress: each place drawn as the thing of its trade, fitted to its box, what stands never moved. One case per
// trade's procedure: a shift's (each starter's trade, chosen from the starters in code) and a fight's (the hall).
import { describe, it, expect } from 'vitest';
import { DRESSES, OWN_PIECES, dressOf, dressPlaces } from './dress.js';
import { PIECES } from '../era/compose-dress.js';
import { SCENARIOS } from '../worksim/scenarios.js';
import { workRoom } from '../gameworld/work-room.js';
import { gameRoom } from '../gameworld/game-room.js';
import { POLES, POLE_IDS } from '../gameworld/feel/cards.js';

const FIGHTER = POLE_IDS.find((id) => POLES[id].demo.includes('attack') && POLES[id].base === 'action');
const within = (faces, place, tol) => faces.every((f) => f.corners.every(([x, y, z]) =>
  x >= place.at[0] - place.size[0] / 2 - tol && x <= place.at[0] + place.size[0] / 2 + tol && y >= place.at[1] - place.size[1] / 2 - tol && y <= place.at[1] + place.size[1] / 2 + tol && z >= (place.at[2] ?? 0) - 1e-6 && z <= (place.at[2] ?? 0) + place.size[2] + tol));

describe('the dress', () => {
  it('picks the trade: the one asked, the card\'s own, its starter\'s, else a kitchen for a shift and the hall for a fight', () => {
    expect(dressOf(null)).toBe('hall');
    expect(dressOf(SCENARIOS.roof)).toBe('chores');
    expect(dressOf({ ...SCENARIOS.kitchen, dress: 'farm' })).toBe('farm');
    expect(dressOf(SCENARIOS.kitchen, 'site')).toBe('site');
    expect(() => dressOf(null, 'castle')).toThrow(/dress is/);
  });
  it('every thing a trade lays is a piece mojulo draws', () => {
    const kinds = ['counter', 'bin', 'shelf', 'pass', 'cover-low', 'cover-tall', 'crate', 'pillar'];
    for (const [t, D] of Object.entries(DRESSES)) for (const kind of kinds) for (const verb of ['shovel', 'bucket']) {
      const k = D.piece({ kind, verb, item: 'rice' }, null);
      if (k) expect(OWN_PIECES[k] ?? PIECES[k], `${t}/${kind}`).toBeTruthy();
    }
  });
  it('draws each place inside its box, so what is seen is what is walked round', () => {
    const place = { id: 'p', kind: 'counter', at: [2, 3, 0], size: [1, 1, 0.9], sid: 'pot', verb: 'shovel' };
    // a trade drawn from the furniture door's builds (a kitchen's counters) and one drawn from parts (a chore's piles)
    for (const trade of ['kitchen', 'chores']) {
      const D = dressPlaces([place, { ...place, id: 'q', verb: 'bucket' }, { id: 'b', kind: 'bin', at: [0, 0, 0], size: [0.8, 0.8, 0.7], item: 'fish' }], trade, { card: SCENARIOS.kitchen });
      for (const id of D.dressed) expect(within(D.faces.filter((f) => f.group === `room:dress:${id}`), id === 'b' ? { at: [0, 0, 0], size: [0.8, 0.8, 0.7] } : place, 0.06), `${trade}/${id}`).toBe(true);
    }
  });
  it('a shift\'s room dressed in its trade keeps every collider of its greybox, and draws its things in place of blocks', () => {
    // a shift laid on the floor and one laid on a deck (a site)
    for (const card of [Object.keys(SCENARIOS).find((c) => !SCENARIOS[c].site), Object.keys(SCENARIOS).find((c) => SCENARIOS[c].site)]) {
      const dressed = workRoom({ id: card, quick: { goal: 'work', card } }), grey = workRoom({ id: card, quick: { goal: 'work', card } }, { dress: false });
      expect(dressed.manifest.colliders).toEqual(grey.manifest.colliders);
      expect(dressed.dress.trade).toBe(dressOf(SCENARIOS[card]));
      expect(dressed.dress.laid.length).toBeGreaterThan(0);
      expect(grey.dress).toBeNull();
      expect(grey.manifest.faces.some((f) => String(f.group).startsWith('room:dress:'))).toBe(false);
    }
  });
  it('a fight\'s room is dressed as a hall, its cover drawn as furniture, its colliders as built', () => {
    const dressed = gameRoom({ id: 'f', feel: FIGHTER }), grey = gameRoom({ id: 'f', feel: FIGHTER }, { dress: false });
    expect(dressed.dress.trade).toBe('hall');
    expect(dressed.manifest.colliders).toEqual(grey.manifest.colliders);
    expect(dressed.dress.laid.every((l) => ['long-table', 'shelves', 'crate'].includes(l.piece))).toBe(true);
  });
});
