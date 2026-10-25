import { describe, expect, it } from 'vitest';

import { RESONANCES, resonancesOf, resonanceCheck, latentOf } from './resonance.js';
import { quickWorld } from './quick.js';
import { runSteps } from './index.js';
import { cubeOfWorld } from './intent.js';

// RESONANCE (the Resonance theme): an outcome only a composition of facets makes; the compiler checks it opened, laid
// and held. One case per row, the orders a design run's own where the compiler lays it today, a small level of our own
// for the law's two answers.
const orders = (w) => runSteps(w, { ref: 'r' }).map((s) => s.order);
const level = (title, entities, extra = {}) => ({ title, manifest: { title, entities, game: { mechanics: [] }, ...extra } });

describe('which resonances a cube opens', () => {
  it('every key of a row must hold (AND); inside a key, any of its values (OR); a list setting holds by any member', () => {
    expect(resonancesOf({})).toEqual([]);
    expect(resonancesOf({ soul: { seats: 'two', frame: 'follow-all' } })).toEqual([]);   // no camera: not opened
    expect(resonancesOf({ soul: { seats: 'four', frame: 'follow-all' }, space: { camera: 'top-down' } }).map((r) => r.id)).toEqual(['co-op-screen']);
    expect(resonancesOf({ mind: { perception: 'memory' }, power: { mechanics: ['reach-exit', 'unseen'] } }).map((r) => r.id)).toEqual(['watched-sneak']);
  });

  it('every row is a composition: two facets or more, what lays it named, a law to check it', () => {
    for (const r of RESONANCES) {
      expect(new Set(r.when.map((k) => k.split('.')[0])).size, r.id).toBeGreaterThanOrEqual(2);
      expect(r.of.length, r.id).toBeGreaterThanOrEqual(2);
      expect(r.lowers.length, r.id).toBeGreaterThan(0);
      expect(typeof r.law, r.id).toBe('function');
    }
  });
});

describe('the co-op screen', () => {
  const W = (soul) => ({ ...quickWorld({ id: 'duo', quick: { goal: 'collect', pickup: 'coin', camera: 'side', hero: { cast: 'female' } }, style: { kit: 'trail-valley' } }), intent: { cube: { soul } } });

  it('a two-seat co-op cube on a side camera: opened, laid by the run (a hero per seat, the shared camera), held', () => {
    const w = W({ seats: 'two', frame: 'follow-all', pool: 'own' }), cube = cubeOfWorld(w).cube;
    expect(resonanceCheck(cube, orders(w))).toEqual([{ id: 'co-op-screen', name: 'A co-op screen', laid: true, held: true, says: null }]);
  }, 300_000);

  it('a cube a value short opens nothing; a level whose seats miss what the cube asks is laid and does not hold', () => {
    expect(resonanceCheck(cubeOfWorld(W({ seats: 'two' })).cube, [])).toEqual([]);
    const cube = { soul: { seats: 'four', frame: 'follow-all' }, space: { camera: 'side' } };
    const hero = (id) => ({ id, pilotable: true, team: 'party' });
    const [r] = resonanceCheck(cube, [level('L', [hero('hero'), hero('hero-2')], { seats: { bodies: ['hero-2'], max: 2 }, camera: { rule: 'side' } })]);
    expect(r).toMatchObject({ laid: true, held: false });
    expect(r.says).toMatch(/2 seats laid where the cube asks 4/);
  });
});

describe('the sneak past watchers', () => {
  it('a quick sneak opens it, and its run lays guards who see and the unseen goal, as its cube asks', () => {
    const w = quickWorld({ id: 'sn', quick: { goal: 'sneak' }, style: { kit: 'trail-valley' } }), cube = cubeOfWorld(w).cube;
    const [r] = resonanceCheck(cube, orders(w));
    // (the check's first finding, 1025: the stealth cube asked for watchers who remember and the run laid guards who
    // see; guards stay goldfish, simple and local, so the cube now asks for sight, and the sneak holds)
    expect(r).toMatchObject({ id: 'watched-sneak', laid: true, held: true, says: null });
  }, 300_000);

  it('watchers laid as the cube asks hold; the unseen goal alone is not laid', () => {
    const cube = { mind: { perception: 'sight' }, power: { mechanics: ['unseen'] } };
    const g = { id: 'g', rule: { type: 'ai', mind: { motivation: 'guard', perception: 'sight' } } };
    const goal = (ents) => ({ title: 'S', manifest: { title: 'S', entities: ents, game: { mechanics: [{ kind: 'unseen' }] } } });
    expect(resonanceCheck(cube, [goal([g])])[0]).toMatchObject({ laid: true, held: true, says: null });
    expect(resonanceCheck(cube, [goal([])])[0]).toMatchObject({ laid: false, held: null });
  });
});

describe('companions who follow', () => {
  const cube = { soul: { party: 'party' }, mind: { motivation: 'escort' } };
  const escort = (id, ward) => ({ id, rule: { type: 'ai', mind: { motivation: 'escort' }, escort: ward } });

  it('laid when a level has a companion on the escort motive; it holds when its ward is in the level', () => {
    expect(resonanceCheck(cube, [level('A', [{ id: 'hero', pilotable: true }, escort('teodor', 'hero')])])[0]).toMatchObject({ laid: true, held: true });
    const [lost] = resonanceCheck(cube, [level('B', [escort('teodor', 'nobody')])]);
    expect(lost).toMatchObject({ laid: true, held: false });
    expect(lost.says).toMatch(/teodor escorts no one the level has/);
  });

  it('a party cube with no companion laid is opened and not laid: a gap for the compiler', () => {
    expect(resonanceCheck(cube, [level('C', [{ id: 'hero', pilotable: true }])])).toEqual([{ id: 'escorting-party', name: 'Companions who follow', laid: false, held: null, says: null }]);
    expect(resonanceCheck({ soul: { party: 'party' } }, [])).toEqual([]);
  });
});

// LATENT: the one field the agent reads. A voiced resonance the cube is one move from: it holds some of the row's keys,
// and every key it lacks sits in one facet (seats and the frame are both soul's: one move).
describe('what a cube is one move from', () => {
  it('a side-on platformer is one move from a co-op screen: the seats and the shared frame, both soul\'s', () => {
    expect(latentOf({ space: { camera: 'side' }, power: { rules: ['platform'] } })).toEqual([{ id: 'co-op-screen', name: 'A co-op screen', missing: ['soul.seats=two|four', 'soul.frame=follow-all'] }]);
  });

  it('an unseen goal with no watchers named is one move from a sneak', () => {
    expect(latentOf({ power: { mechanics: ['unseen'] } }).map((l) => [l.id, l.missing])).toEqual([['watched-sneak', ['mind.perception=sight|memory']]]);
  });

  it('nothing held, everything held, or what is lacking spread over two facets: nothing latent', () => {
    expect(latentOf({})).toEqual([]);
    expect(latentOf({ soul: { seats: 'two', frame: 'follow-all' }, space: { camera: 'side' } })).toEqual([]);
    expect(latentOf({ soul: { seats: 'two' } })).toEqual([]);   // the frame (soul) and the camera (space): two moves
  });
});
