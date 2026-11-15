// A SHOP WALKED INTO, PLAYED: a level on a town whose shops are entered (geotown.shops) gives the hero ground inside
// them and their tills, and an errand's trade had in a shop of a kind stands at such a till.
import { describe, it, expect } from 'vitest';
import { stageEnds } from './levels.js';
import { readErrands, errandLegs, layErrand, TILL_REACH } from './errand.js';
import { readGameworld } from './world.js';
import { gameStages } from './levels.js';
import { stageFolk, folkExtra } from './folk-cast.js';
import { runSteps } from './runner.js';

// the smallest town with a row of shops, its shops one kind
const M = { kind: 'geocube', cube: 'valley-morning', show: 'geotown', seed: 4, geotown: { shops: { cards: ['electronics'] }, evoke: 'segment', segment: 'main-street', hills: { height: 4 }, margin: 12 } };
const ends = stageEnds(M), within = (p, c) => p[0] > c.min[0] && p[0] < c.max[0] && p[1] > c.min[1] && p[1] < c.max[1] && p[2] > c.min[2] && p[2] < c.max[2];

describe('a level on a town whose shops are walked into', () => {
  it('tells its tills, each on ground the hero stands on and clear of every box', () => {
    expect(ends.tills.length).toBeGreaterThan(0);
    const t = ends.tills[0];
    expect(t.card).toBe('electronics');
    const z = ends.ground(t.at[0], t.at[1]);
    expect(z).not.toBeNull();
    expect(Math.abs(z - t.at[2])).toBeLessThan(0.1);
    expect(ends.colliders.some((c) => within([t.at[0], t.at[1], z + 1], c))).toBe(false);
  });
  it('opens no door to a scene of its own on a shop walked into where it stands', () => {
    const doored = stageEnds({ ...M, enter: ['shop'] });
    expect(doored.doors ?? []).toHaveLength(0);
  });
});

describe('an errand\'s trade had in a shop', () => {
  const G = { levels: { town: {}, home: {} }, ids: ['town', 'home'], links: [{ from: 'home', to: 'town' }, { from: 'town', to: 'home' }], start: 'home', topology: 'interconnected', foes: null };
  const spec = [{ id: 'radio', giver: 'home', list: [{ item: 'coin', at: 'home' }, { item: 'radio', at: 'town', needs: ['coin'], shop: 'electronics' }, { item: 'tape', at: 'town' }] }];
  it('stands at the till of a store of its kind, the rest on spots', () => {
    const E = readErrands(spec, G), legs = errandLegs(E, 'town'), spots = [[1, 1, 0], [2, 2, 0]];
    const laid = layErrand(legs, spots, ends.tills), radio = laid.find((l) => l.item === 'radio'), tape = laid.find((l) => l.item === 'tape');
    expect(radio.at).toEqual(ends.tills[0].at);
    expect(radio.till).toBe(ends.tills[0].id);
    expect(radio.radius).toBe(TILL_REACH);
    expect(radio.shop).toBeUndefined();
    expect(tape.at).toEqual(spots[0]);
    // (a stage with no such shop: the trade on a spot, as any)
    expect(layErrand(legs, spots, []).find((l) => l.item === 'radio').at).toEqual(spots[0]);
  });
  it('refuses a shop that is no store card, and a bounty at a counter', () => {
    expect(() => readErrands([{ ...spec[0], list: [{ item: 'radio', at: 'town', shop: 'nowhere' }] }], G)).toThrow(/shop is the kind of store/);
  });
});

describe('a shop\'s keeper', () => {
  // a game whose level is that town, its people asked for
  const W = { id: 'shop-walk', name: 'Shop walk', seed: 3, characters: { direction: { tradition: 'western' }, folk: true }, levels: { town: { name: 'Main street', seed: 4, geotown: { ...M.geotown, enter: [] } } } };
  const G = readGameworld(W), stage = gameStages(G).find((x) => x.section === 'geotown'), E = stageEnds(stage.manifest), plan = stageFolk(G, stage);
  it('is grown from the town\'s own houses: a keeper a shop, the households their houses', () => {
    expect(plan).not.toBeNull();
    const keepers = plan.folk.people.filter((p) => p.role === 'keeper');
    expect(keepers.length).toBeGreaterThan(0);
    expect(keepers.every((p) => p.service === 'merchant' && /^town-shop-/.test(plan.houseOf[p.lot]))).toBe(true);
    expect(plan.folk.people.some((p) => p.role === 'townie')).toBe(true);
    // (a world that asks for no folk has none, as before)
    expect(stageFolk(readGameworld({ ...W, characters: undefined }), stage)).toBeNull();
  });
  it('stands behind its counter in the shop walked into, facing its till, within reach of it and clear of every box', () => {
    const part = folkExtra(plan, () => 'sk_body')(E), door = E.townDoors.find((d) => d.rooms), stand = door.rooms[0].stand;
    const keeper = part.entities.find((e) => Math.hypot(e.transform.pos[0] - stand.at[0], e.transform.pos[1] - stand.at[1]) < 1e-6);
    expect(keeper).toBeTruthy();
    const [kx, ky, kz] = stand.at, t = stand.face, box = door.rooms[0].box;
    expect(kx).toBeGreaterThan(box.min[0]); expect(kx).toBeLessThan(box.max[0]); expect(ky).toBeGreaterThan(box.min[1]); expect(ky).toBeLessThan(box.max[1]);
    // (the counter between them: further from the door than the till, and near enough to talk across)
    expect(Math.hypot(kx - door.at[0], ky - door.at[1])).toBeGreaterThan(Math.hypot(t[0] - door.at[0], t[1] - door.at[1]));
    expect(Math.hypot(kx - t[0], ky - t[1])).toBeLessThan(2.2);
    expect(E.colliders.some((c) => within([kx, ky, kz + 1], c))).toBe(false);
    // (everyone else by their doors, outside)
    expect(part.entities.length).toBeGreaterThan(1);
  });
  it('is in the game the run makes: its body a step of the run, itself in the level, a talk of its own', () => {
    const S = runSteps(W, { ref: 'gw' }), level = S.find((x) => x.key.startsWith('level-')).order.manifest;
    expect(S.some((x) => x.key.startsWith('folk-'))).toBe(true);
    const stand = E.townDoors.find((d) => d.rooms).rooms[0].stand;
    const keeper = level.entities.find((e) => e.id.startsWith('folk-') && Math.hypot(e.transform.pos[0] - stand.at[0], e.transform.pos[1] - stand.at[1]) < 1e-6);
    expect(keeper).toBeTruthy();
    expect(level.play.menus.some((m) => m.id === `talk-${keeper.id}`)).toBe(true);
    expect(level.geotown.shops).toBeTruthy();
  });
});
