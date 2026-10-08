import { describe, it, expect } from 'vitest';
import { ELEMENTS, ELEMENT_IDS, valueSignature, elementMotifs, elementBeads } from './elements.js';
import { SPRITE_VERB_IDS, DEFERRED_VERBS } from '../../game/glyph-sfx-sprites.js';
import { createBusState, processEvents, watchEvents, syncToCtrl, deriveZoneEvents } from '../../worlds/event-bus.js';
import { composeLive } from '../../worlds/controllable/compose.js';
import { readCues } from '../ui/cues.js';
import { lowerPlay, resolvePlayUi } from '../ui/direction.js';
import { uiBoardHtml } from '../ui/board-html.js';

const CW = composeLive();
const DT = 1 / 30;

describe('the elements', () => {
  it('carry the whole shelf and the two it left behind, each saying what it means', () => {
    expect([...ELEMENT_IDS].sort()).toEqual([...SPRITE_VERB_IDS, ...DEFERRED_VERBS, 'burning', 'blaze'].sort());
    for (const id of ELEMENT_IDS) {
      const E = ELEMENTS[id];
      expect(E.says.length, id).toBeGreaterThan(10);
      expect(E.when.length, id).toBeGreaterThan(5);
      expect(['breathe', 'grow', 'flash', 'flicker']).toContain(E.coat.shape);
    }
    expect(ELEMENTS.kokusen.tone).toBe('dark');
  });

  it('read apart in values: no two share a signature (light or dark, motion, coat shape, strength, pace)', () => {
    const sigs = ELEMENT_IDS.map((id) => JSON.stringify(valueSignature(id)));
    expect(new Set(sigs).size).toBe(ELEMENT_IDS.length);
  });

  it('their marks are deterministic in ph, kokusen strikes nine bolts afresh 8 times a second, and the page source runs', () => {
    expect(elementBeads('ssj-aura', [1, 2, 0], 0.7)).toEqual(elementBeads('ssj-aura', [1, 2, 0], 0.7));
    const M = new Function(`${elementMotifs(['kokusen', 'ward'])}; return __ELM;`)();
    const P = ELEMENTS.kokusen.params, a = M.kokusen.bolts([0, 0, 0], 0.01, P), b = M.kokusen.bolts([0, 0, 0], 0.1, P), c = M.kokusen.bolts([0, 0, 0], 0.2, P);
    expect(a).toHaveLength(18);   // nine bolts, then nine fork slots
    expect(a.filter((x) => !x.fork).every((x) => x.nodes.length === 12 && x.t.length === 12)).toBe(true);
    expect(a.filter((x) => x.fork).every((x) => x.nodes.length === 5)).toBe(true);
    // no two strokes the same line: each bolt its own weight, every node its own kink of it, tapering root to tip
    const main = a.filter((x) => !x.fork), roots = main.map((x) => x.t[0].toFixed(3));
    expect(new Set(roots).size).toBe(9);
    for (const x of main) expect(x.t[11]).toBeLessThan(x.t[0]);
    expect(new Set(main[0].t.map((v) => v.toFixed(3))).size).toBe(12);
    // within one frame a bolt only turns with ph; across frames it is struck afresh (which sit out changes too)
    expect(a.map((x) => x.w > 0)).toEqual(b.map((x) => x.w > 0));
    expect(JSON.stringify(c.map((x) => x.nodes[3]))).not.toBe(JSON.stringify(a.map((x) => x.nodes[3])));
    expect(M.kokusen.beads([0, 0, 0], 0.3, P)).toHaveLength(10);   // a fixed pool: the aura and a spark per bolt
    expect(M.ward.beads([0, 0, 0], 0.3, ELEMENTS.ward.params)).toEqual(elementBeads('ward', [0, 0, 0], 0.3));
    expect(Object.keys(M)).toEqual(['kokusen', 'ward']);
  });
});

// the page's loop in node: world, zones, cast facts, the bus, the cast's ops
function level(cues) {
  const entities = [
    { id: 'hero', rule: { type: 'walk' }, transform: { pos: [0, -6, 0] }, body: { type: 'none' } },
    { id: 'guard', rule: { type: 'static' }, transform: { pos: [0, 0, 0] }, body: { type: 'none', hp: 10 } },
  ];
  const ev = lowerPlay({ entities, play: { cues } }, { player: 'hero' });
  const world = CW.createWorld({ entities: JSON.parse(JSON.stringify(entities)) });
  const bus = createBusState(ev, []);
  let prev, zp = null;
  const settle = (evs) => { if (evs.length) processEvents(bus, evs); for (let k = 0; k < 6; k++) { const w = watchEvents(bus); if (!w.length) break; processEvents(bus, w); } };
  const tick = (extra = []) => {
    CW.stepWorld(world, {}, DT);
    const f = CW.castFacts(world, prev); prev = f.prev;
    const z = deriveZoneEvents(world.entities, zp, ev.sources); zp = z.prev;
    settle([...z.events, ...f.events, ...extra]);
    syncToCtrl(bus, world.entities, (ops) => CW.castOps(world, ops));
  };
  tick(); settle(ev.initial || []); syncToCtrl(bus, world.entities, (ops) => CW.castOps(world, ops));
  return { ev, world, bus, tick, run: (n, x) => { for (let i = 0; i < n; i++) tick(x); }, guard: () => world.byId.guard, fired: (t) => bus.log.filter((r) => r.type === t).length };
}

describe('statuses on the bus', () => {
  it('reads status, lift and faded, and teaches', () => {
    const [c] = readCues({ cues: [{ id: 'x', when: { faded: { who: 'guard', is: 'ward' } }, then: [{ status: { who: 'guard', is: 'kokusen', for: 0.6, color: '#ff0000' } }, { lift: 'hero' }] }] });
    expect(c.when).toEqual({ kind: 'faded', who: 'guard', at: null, is: 'ward' });
    expect(c.then.map((t) => [t.op, t.who, t.is, t.for, t.color])).toEqual([['status', 'guard', 'kokusen', 0.6, [1, 0, 0]], ['lift', 'hero', undefined, undefined, undefined]]);
    const bad = (then) => () => readCues({ cues: [{ id: 'x', when: { start: true }, then }] });
    expect(bad({ status: { who: 'guard', is: 'glow' } })).toThrow(/is is an element: enchant/);
    expect(bad({ status: { who: 'guard', is: 'ward', for: 0 } })).toThrow(/for is seconds/);
    expect(bad({ status: { who: 'guard', is: 'ward', color: 'red' } })).toThrow(/#rrggbb/);
  });

  it('a timed status is carried on the world clock, then fades and fires faded', () => {
    const L = level([
      { id: 'flash', when: { start: true }, then: { status: { who: 'guard', is: 'kokusen', for: 0.5 } } },
      { id: 'after', when: { faded: { who: 'guard', is: 'kokusen' } }, then: { set: 'done', to: 1 } },
    ]);
    L.tick();
    expect(Object.keys(L.guard().statuses)).toEqual(['kokusen']);
    L.run(10);
    expect(L.guard().statuses.kokusen).toBeTruthy();
    L.run(10);
    expect(L.guard().statuses.kokusen).toBeUndefined();
    expect(L.fired('faded')).toBe(1);
    expect(L.bus.vars.done).toBe(1);
  });

  it('a status with no time comes off when its cue ends (walking off a near); lift takes one off', () => {
    const L = level([
      { id: 'close', when: { near: { at: [0, 0], r: 2 } }, then: { status: { who: 'guard', is: 'ward' } } },
      { id: 'hurt', when: { on: 'zap' }, then: [{ status: { who: 'guard', is: 'drain' } }, { status: { who: 'hero', is: 'heal' } }] },
      { id: 'cure', when: { on: 'cure' }, then: { lift: { who: 'guard', is: 'drain' } } },
    ]);
    expect(L.ev.reactions).toContainEqual({ on: 'cue-end:close', do: 'ctrl', op: 'lift', who: 'guard', is: 'ward' });
    L.world.byId.hero.transform.pos = [0, -1, 0];
    L.run(2);
    expect(Object.keys(L.guard().statuses)).toEqual(['ward']);
    L.world.byId.hero.transform.pos = [0, -6, 0];
    L.run(2);
    expect(L.guard().statuses.ward).toBeUndefined();
    L.tick([{ type: 'zap' }]);
    L.run(1);
    expect(Object.keys(L.guard().statuses)).toEqual(['drain']);
    expect(Object.keys(L.world.byId.hero.statuses)).toEqual(['heal']);
    L.tick([{ type: 'cure' }]);
    L.run(1);
    expect(L.guard().statuses).toEqual({});
    expect(L.fired('faded')).toBe(2);
  });

  it('the board says them', () => {
    const html = uiBoardHtml(resolvePlayUi({ play: { ui: 'propose', cues: [{ id: 'go', when: { faded: { who: 'guard', is: 'ward' } }, then: { status: { who: 'guard', is: 'kokusen', for: 0.6 } } }] } }, () => 7));
    expect(html).toContain('guard is no longer ward');
    expect(html).toContain('guard is kokusen for 0.6 s');
  });
});

describe('the page', () => {
  it('draws statuses only when cues put one on someone, with only the elements they name, and exposes the bodies', async () => {
    const { emitThreeWorld } = await import('../../scene/scene-three.js');
    const entities = [{ id: 'hero', pilotable: true, rule: { type: 'walk', eye: 0.85 }, transform: { pos: [0, 0, 0.85] }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } }];
    const page = (cues) => emitThreeWorld({ entities, events: lowerPlay({ entities, play: { cues } }, { player: 'hero' }), inline: false });
    const js = page([{ id: 'x', when: { start: true }, then: { status: { who: 'hero', is: 'kokusen' } } }]);
    expect(js).toContain('__stepStatus();');
    expect(js).toContain('"kokusen": { beads:');
    expect(js).not.toContain('"ward": { beads:');
    expect(js).toContain(' bodies: __bodies,');
    const plain = page([{ id: 'x', when: { start: true }, then: { kill: 'hero' } }]);
    expect(plain).not.toContain('__stepStatus');
    expect(plain).not.toContain(' bodies: __bodies,');
  });
});

describe('the laws and the cards', () => {
  it('a status that never comes off is named; a timed, ended or lifted one is not', async () => {
    const { uiAdvice } = await import('../ui/laws.js');
    const law = (cues) => uiAdvice({ cues }, null, { entities: [{ id: 'guard' }] }).filter((l) => l.law === 'status-lifts').map((l) => l.at);
    expect(law([{ id: 'a', when: { start: true }, then: { status: { who: 'guard', is: 'ward' } } }])).toEqual(['cue a']);
    expect(law([{ id: 'a', when: { start: true }, then: { status: { who: 'guard', is: 'ward', for: 2 } } }])).toEqual([]);
    expect(law([{ id: 'a', when: { near: { at: [0, 0], r: 1 } }, then: { status: { who: 'guard', is: 'ward' } } }])).toEqual([]);
    expect(law([{ id: 'a', when: { start: true }, then: { status: { who: 'guard', is: 'ward' } } }, { id: 'b', when: { on: 'x' }, then: { lift: 'guard' } }])).toEqual([]);
  });

  it('the play drawer lists every element', async () => {
    const { playCards } = await import('../ui/cards.js');
    const card = playCards().get('play-elements');
    for (const id of ELEMENT_IDS) expect(card.body).toContain(`  ${id.padEnd(10)} `);
    expect(playCards().get('ui-menus').body).not.toContain('later step');
  });
});

describe("burning elements: the world's own fire on a body", () => {
  const entities = [{ id: 'hero', rule: { type: 'walk', eye: 0.85 }, transform: { pos: [0, 0, 0.85] }, body: { type: 'mesh', shape: 'box', size: [0.5, 0.5, 1.7] } }];
  it('each burning status a play may set is one fire source, carried by its body, in its colorant', async () => {
    const { bodyFires } = await import('./body-fire.js');
    const play = { cues: [
      { id: 'a', when: { start: true }, then: [{ status: { who: 'hero', is: 'burning' } }, { status: { who: 'hero', is: 'burning', color: 'copper' } }, { status: { who: 'ghost', is: 'blaze' } }, { status: { who: 'hero', is: 'ward' } }] },
      { id: 'b', when: { on: 'x' }, then: { status: { who: 'hero', is: 'burning' } } },
    ] };
    expect(bodyFires(play, entities)).toEqual([
      { kind: 'brazier', at: [0, 0, 0], size: 1.5, follow: 'hero', el: 'burning', key: '', rise: 0.85 },
      { kind: 'brazier', at: [0, 0, 0], size: 1.5, color: 'copper', follow: 'hero', el: 'burning', key: 'copper', rise: 0.85 },
    ]);
    expect(() => readCues({ cues: [{ id: 'x', when: { start: true }, then: { status: { who: 'hero', is: 'burning', color: 'plasma' } } }] })).toThrow(/colorant the flame burns in \(sodium/);
  });

  it('the page lights them with no prop, carries them to the body, and puts them out with the status', async () => {
    const { resolveFire } = await import('../../fire/fire.js');
    const { fireChannelScript } = await import('../../scene/channels/fire.js');
    const r = resolveFire({}, [{ kind: 'brazier', at: [0, 0, 0], size: 1, color: 'copper', follow: 'hero', el: 'burning', key: 'copper', rise: 0.7 }]);
    expect(r.sources[0]).toMatchObject({ follow: 'hero', el: 'burning', key: 'copper', rise: 0.7, line: [expect.any(Number), expect.any(Number), 1] });
    const js = fireChannelScript(r);
    expect(js).toContain('function __fireFollow(K)');
    expect(js).toContain('FIRE_PROPS = [[]];');
    const plain = fireChannelScript(resolveFire({ sources: [{ kind: 'brazier', at: [0, 0, 0] }] }));
    expect(plain).not.toContain('__fireFollow');
  });
});
