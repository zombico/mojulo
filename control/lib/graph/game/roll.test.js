import { describe, expect, it } from 'vitest';
import { readRoll, rolledIds, rollWays } from './roll.js';
import { simLevel, rollOf } from './level-sim.js';
import { composeLive, emissionSource } from '../worlds/controllable/compose.js';
import { buildRoll } from '../worlds/controllable/roll.js';
import { standBlocks } from '../playscape/terrain.js';
import { gameChannelScript } from '../scene/channels/game.js';
import { controllableChannelScript } from '../scene/channels/controllable/index.js';

// A LEVEL'S ROLL: what its seed picks on it. One small level: a corridor shut by either of two walls, a crate beside.
const E = composeLive();
const BLOCKS = [
  { id: 'wall-a', form: 'wall', at: [10, 0, 0], N: [-1, 0], length: 8, height: 2, thick: 0.5 },
  { id: 'wall-b', form: 'wall', at: [20, 0, 0], N: [-1, 0], length: 8, height: 2, thick: 0.5 },
  { id: 'crate', form: 'crate', at: [15, 2, 0] },
  { form: 'pillar', at: [30, 0, 0] },
];
const ROLL = { cover: [{ of: ['wall-a', 'wall-b', 'crate'], stand: [1, 2] }] };
// the corridor's own sides and ends: fixed colliders round x -5…40, y ±4, so a wall across it shuts it
const SIDES = [{ min: [-6, 4, 0], max: [41, 5, 3] }, { min: [-6, -5, 0], max: [41, -4, 3] }, { min: [-6, -5, 0], max: [-5, 5, 3] }, { min: [40, -5, 0], max: [41, 5, 3] }];
const hero = { id: 'hero', pilotable: true, rule: { type: 'walk', speed: 4, eye: 1.7, collideRadius: 0.3, collideHeight: 1.7, step: 0.3 }, body: { type: 'none' }, transform: { pos: [0, 0, 1.7], heading: 0 } };
function level() {
  const read = readRoll(ROLL, { blocks: BLOCKS });
  const B = standBlocks(BLOCKS, { rolled: rolledIds(read) });
  return { read, B, roll: { cover: read.cover, things: B.things }, colliders: [...SIDES, ...B.colliders] };
}

describe('the roll, read', () => {
  it('names the level\'s blocks by id, a number or a band of them standing', () => {
    expect(readRoll({ cover: [{ of: ['wall-a', 'wall-b'], stand: 1 }, { of: ['crate'], stand: [0, 1] }] }, { blocks: BLOCKS })).toEqual({ cover: [{ of: ['wall-a', 'wall-b'], stand: [1, 1] }, { of: ['crate'], stand: [0, 1] }] });
    expect([...rolledIds(readRoll(ROLL, { blocks: BLOCKS }))].sort()).toEqual(['crate', 'wall-a', 'wall-b']);
  });

  it('counts its ways', () => {
    expect(rollWays(readRoll(ROLL, { blocks: BLOCKS }))).toBe(3 + 3);   // one of three, or two of three
    expect(rollWays(readRoll({ cover: [{ of: ['wall-a', 'wall-b'], stand: 1 }, { of: ['crate'], stand: [0, 1] }] }, { blocks: BLOCKS }))).toBe(2 * 2);
  });

  it('refuses the malformed, teaching', () => {
    const bad = (roll, blocks = BLOCKS) => () => readRoll(roll, { blocks });
    expect(bad('often')).toThrow(/what the level's seed picks/);
    expect(bad({ cover: [], foes: [] })).toThrow(/no 'foes' \(a roll has: cover\)/);
    expect(bad({ cover: [] })).toThrow(/a list of groups/);
    expect(bad({ cover: [{ of: [], stand: 1 }] })).toThrow(/at least one/);
    expect(bad({ cover: [{ of: ['gate'], stand: 1 }] })).toThrow(/no block 'gate'.*give the block an id.*wall-a, wall-b, crate/);
    expect(bad({ cover: [{ of: ['wall-a'], stand: 1 }, { of: ['wall-a'], stand: 1 }] })).toThrow(/in two groups/);
    expect(bad({ cover: [{ of: ['wall-a'], stand: 2 }] })).toThrow(/from 0 to 1/);
    expect(bad({ cover: [{ of: ['wall-a', 'wall-b'], stand: [2, 1] }] })).toThrow(/a number or \[min, max\]/);
    expect(bad({ cover: [{ of: ['wall-a'], stand: 1, often: true }] })).toThrow(/no 'often'/);
    expect(bad({ cover: [{ of: ['wall-a'], stand: 1 }] }, [...BLOCKS, { id: 'wall-a', form: 'crate', at: [0, 9, 0] }])).toThrow(/two blocks are called 'wall-a'/);
  });
});

describe('the dice', () => {
  const { read } = level();
  it('the same seed rolls the same; every roll keeps its band and splits its group whole', () => {
    for (const seed of [1, 2, 77, 4096, 2 ** 31, 12345678901]) {
      const a = rollOf(read, seed);
      expect(rollOf(read, seed)).toEqual(a);
      expect(a.stand.length).toBeGreaterThanOrEqual(1);
      expect(a.stand.length).toBeLessThanOrEqual(2);
      expect([...a.stand, ...a.gone].sort()).toEqual(['crate', 'wall-a', 'wall-b']);
    }
  });

  it('neighbouring seeds roll unlike: every way is met inside a short run of seeds', () => {
    const met = new Set(Array.from({ length: 60 }, (_, k) => rollOf(read, k + 1).stand.join('+')));
    expect(met.size).toBe(rollWays(read));
  });

  it('whole numbers only: a roll is a compatibility promise, the same on every runtime', () => {
    // (pinned: a level minted today plays these maps for these seeds tomorrow, in Node and in every browser)
    expect([1, 2, 3, 4, 5, 6].map((seed) => rollOf(read, seed).stand.join('+'))).toMatchInlineSnapshot(`
      [
        "wall-a",
        "wall-a",
        "crate+wall-a",
        "wall-b",
        "wall-a",
        "crate",
      ]
    `);
    expect(buildRoll.toString()).not.toMatch(/Math\.(random|floor|round|sin|cos|sqrt|pow)|Date|\/ 4294967296/);
  });
});

describe('the roll on a world', () => {
  it('until it is rolled every thing stands; rolled, what the seed left out is gone whole and the rest stand', () => {
    const L = level(), W = E.createWorld({ entities: [hero], colliders: L.colliders, roll: L.roll });
    const of = (w) => w.colliders.filter((c) => c.roll != null).map((c) => c.roll).sort();
    expect(of(W)).toEqual(['crate', 'wall-a', 'wall-b']);
    const R = E.applyRoll(W, 3);
    expect(of(W)).toEqual(R.stand);
    expect(R).toEqual({ seed: 3, ...rollOf(L.read, 3) });
    // once a world: a second roll changes nothing
    expect(E.applyRoll(W, 9)).toBe(R);
    expect(of(W)).toEqual(R.stand);
    // the block in no group stands either way
    expect(W.colliders.filter((c) => c.roll == null).length).toBe(L.colliders.length);
  });

  it('a wall that stands shuts the sight and the way; gone, both are open', () => {
    const L = level();
    const world = (seed) => { const W = E.createWorld({ entities: [hero], colliders: L.colliders, roll: L.roll }); E.applyRoll(W, seed); return W; };
    const seeds = Array.from({ length: 40 }, (_, k) => k + 1);
    const shut = seeds.find((s) => rollOf(L.read, s).stand.includes('wall-a')), open = seeds.find((s) => { const r = rollOf(L.read, s); return r.stand.length === 1 && r.stand[0] === 'crate'; });
    const across = [[0, 0, 1], [14, 0, 1]], body = { radius: 0.3, height: 1.7 };
    expect(E.sightBlocked(...across, world(shut).colliders)).toBe(true);
    expect(E.navPath(world(shut), [0, 0], [35, 0], body)).toBeNull();
    expect(E.sightBlocked(...across, world(open).colliders)).toBe(false);
    expect(E.navPath(world(open), [0, 0], [35, 0], body)).not.toBeNull();
  });

  it('a world with no roll is as it was', () => {
    const W = E.createWorld({ entities: [hero], colliders: SIDES });
    expect(E.applyRoll(W, 5)).toBeNull();
    expect(W.roll).toBeUndefined();
    expect(W.colliders).toHaveLength(SIDES.length);
  });

  it('a level played in Node rolls as its seed says (1: the reference roll)', () => {
    const L = level(), sim = (seed) => simLevel({ entities: [hero], colliders: L.colliders, roll: L.roll }, seed === undefined ? {} : { seed });
    expect(sim().world.rolled).toEqual({ seed: 1, ...rollOf(L.read, 1) });
    expect(sim(7).world.rolled.stand).toEqual(rollOf(L.read, 7).stand);
    expect(simLevel({ entities: [hero], colliders: SIDES }).world.rolled).toBeUndefined();
  });
});

describe('the blocks a roll takes', () => {
  it('a rolled block is one thing: its faces one render group, its box the runtime\'s to stand', () => {
    const L = level();
    expect(Object.keys(L.B.things).sort()).toEqual(['crate', 'wall-a', 'wall-b']);
    expect(L.B.things['wall-a']).toEqual({ min: [9.75, -4, 0], max: [10.25, 4, 2] });
    expect(new Set(L.B.faces.map((f) => f.group))).toEqual(new Set(['roll:wall-a', 'roll:wall-b', 'roll:crate', 'obj:body']));
    // no collider of its own in the level's list: the runtime stands it
    expect(L.B.colliders.every((c) => c.of.startsWith('block:block-3'))).toBe(true);
  });

  it('no roll: the blocks as they were, to the last field', () => {
    const was = standBlocks(BLOCKS);
    expect(was.things).toBeUndefined();
    expect(standBlocks(BLOCKS, {})).toEqual(was);
    expect(was.faces.every((f) => f.group === 'obj:body')).toBe(true);
  });
});

describe('the page', () => {
  const L = level(), ents = [hero];
  it('absent, a roll adds nothing: the runtime\'s source and the game channel are as they were', () => {
    expect(emissionSource()).not.toContain('applyRoll');
    expect(emissionSource({ roll: true })).toContain(buildRoll.toString());
    const game = { levelRef: 'l', produces: { events: [] } };
    expect(gameChannelScript(game, {})).toBe(gameChannelScript(game));
    const page = controllableChannelScript(ents, null, null, { colliders: L.colliders });
    expect(page).not.toContain('__applyRoll');
    expect(page).not.toContain('applyRoll');
  });

  it('with one, the page carries the kernel and the roll, and rolls where the level starts', () => {
    const hosted = controllableChannelScript(ents, null, null, { colliders: L.colliders, roll: L.roll, rollWaits: true });
    expect(hosted).toContain(buildRoll.toString());
    expect(hosted).toContain(`roll: ${JSON.stringify(L.roll)}`);
    expect(hosted).toContain('window.__mojGame.onStart(function (p, seed) { __applyRoll(seed); })');
    // no game channel: the reference roll, at once
    const alone = controllableChannelScript(ents, null, null, { colliders: L.colliders, roll: L.roll });
    expect(alone).toContain('__applyRoll(1);');
    expect(alone).not.toContain('__mojGame.onStart(function (p, seed)');
  });

  it('a rolled level says it is shown only once it has started', () => {
    const game = { levelRef: 'l', produces: { events: [] } };
    const js = gameChannelScript(game, { shownOnStart: true });
    expect(js).toContain("st.onStart.push(() => requestAnimationFrame(() => requestAnimationFrame(() => { try { window.parent.postMessage({ moj: 'game-shown' }");
    expect(gameChannelScript(game)).not.toContain('st.onStart.push(() => requestAnimationFrame');
  });
});
