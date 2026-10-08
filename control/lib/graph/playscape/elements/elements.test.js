import { describe, it, expect } from 'vitest';
import { LOOKS, LOOK_NAMES, readLook, readLooks, valueSignature, wavePoints, kokusenBolts, BOLT_SHAPE } from './elements.js';
import { createBusState, processEvents, watchEvents, syncToCtrl, deriveZoneEvents } from '../../worlds/event-bus.js';
import { composeLive } from '../../worlds/controllable/compose.js';
import { readCues } from '../ui/cues.js';
import { lowerPlay, resolvePlayUi } from '../ui/direction.js';
import { uiBoardHtml } from '../ui/board-html.js';
import { uiAdvice } from '../ui/laws.js';

const CW = composeLive();
const DT = 1 / 30;

describe('looks', () => {
  it('presets start from what they do; each reads apart with the colour taken out', () => {
    expect(LOOK_NAMES).toEqual(['glow', 'orbit', 'rise', 'spiral', 'burst', 'converge', 'ring', 'twinkle', 'fall', 'column', 'flare', 'kokusen', 'fire', 'blaze', 'ice', 'frost', 'wet', 'steam']);
    const sigs = LOOK_NAMES.map((n) => valueSignature(LOOKS[n]));
    expect(new Set(sigs).size).toBe(LOOK_NAMES.length);
  });

  it('a look is its layers; a bad one teaches', () => {
    const L = readLook({ color: 'copper', coat: { k: 0.4, shape: 'hold' }, motes: { count: 3, r: [1, 0.2], z: [0, 1.5] }, fire: { size: 2 } }, 'x');
    expect(L.motes[0]).toMatchObject({ count: 3, trail: 6, r: [1, 0.2], z: [0, 1.5], turn: 1, env: 'steady' });
    expect(L.fire).toEqual({ size: 2 });
    expect(L.color).toBe('copper');
    expect(() => readLook({ glitter: 1 }, 'x')).toThrow(/has no layer glitter: its layers are color, coat, motes/);
    expect(() => readLook({ motes: { r: 'wide' } }, 'x')).toThrow(/x.motes.r is the radius/);
    expect(() => readLook({ coat: { shape: 'wobble' } }, 'x')).toThrow(/shape is one of: breathe, grow, flash, flicker, hold/);
    expect(() => readLook({ fire: { size: 9 } }, 'x')).toThrow(/0.5 to 5/);
    expect(() => readLook('sparkly', 'x')).toThrow(/'sparkly' is not a look: name a preset \(glow, orbit/);
    expect(readLooks({ looks: { cursed: 'fall' } }).cursed).toBe(LOOKS.fall);
  });

  it('one wave draws every orbiting light: deterministic in t, a ring stands up, scatter twinkles in place', () => {
    const W = LOOKS.orbit.motes[0];
    expect(wavePoints(W, [1, 2, 0], 0.7)).toEqual(wavePoints(W, [1, 2, 0], 0.7));
    expect(wavePoints(W, [0, 0, 0], 0)).toHaveLength(16);
    // a ring (tilt 90) leaves the ground plane: its lights spread in height, not across y
    const ring = wavePoints(LOOKS.ring.motes[0], [0, 0, 0], 1.3), zs = ring.map((b) => b.p[2]), ys = ring.map((b) => Math.abs(b.p[1]));
    expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(1);
    expect(Math.max(...ys)).toBeLessThan(1e-9);
    // a rise climbs: the head of a stream is higher a moment later in its cycle
    const R = LOOKS.rise.motes[0];
    expect(wavePoints(R, [0, 0, 0], 1)[0].p[2]).toBeGreaterThan(wavePoints(R, [0, 0, 0], 0.5)[0].p[2]);
    const tw = LOOKS.twinkle.motes[0];
    expect(wavePoints(tw, [0, 0, 0], 0.4).map((b) => b.p)).toEqual(wavePoints(tw, [0, 0, 0], 2.1).map((b) => b.p));
  });

  it('kokusen strikes nine varied, tapering bolts afresh 8 times a second, some forking', () => {
    const a = kokusenBolts([0, 0, 0], 0.01, BOLT_SHAPE), c = kokusenBolts([0, 0, 0], 0.2, BOLT_SHAPE), main = a.filter((x) => !x.fork);
    expect(a).toHaveLength(18);
    expect(new Set(main.map((x) => x.t[0].toFixed(3))).size).toBe(9);
    for (const x of main) expect(x.t[11]).toBeLessThan(x.t[0]);
    expect(JSON.stringify(c.map((x) => x.nodes[3]))).not.toBe(JSON.stringify(a.map((x) => x.nodes[3])));
  });
});

// the page's loop in node: world, zones, cast facts, the bus, the cast's ops
function level(play) {
  const entities = [
    { id: 'hero', rule: { type: 'walk' }, transform: { pos: [0, -6, 0] }, body: { type: 'none' } },
    { id: 'guard', rule: { type: 'static' }, transform: { pos: [0, 0, 0] }, body: { type: 'none', hp: 10 } },
  ];
  const ev = lowerPlay({ entities, play }, { player: 'hero' });
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

describe('statuses are names; looks are what they wear', () => {
  it('reads a status by any name, its look given, from play.looks, or the preset of its name', () => {
    const play = { looks: { hexed: { color: '#7a3cff', coat: { k: 0.7 }, motes: { count: 3, r: [0.3, 1.2], z: [1.6, 0.2], env: 'ends' } } }, cues: [
      { id: 'a', when: { start: true }, then: [{ status: { who: 'guard', is: 'hexed' } }, { status: { who: 'guard', is: 'poisoned', look: 'fall', color: '#33ff66' } }, { status: { who: 'hero', is: 'ice' } }] },
    ] };
    const [c] = readCues(play);
    expect(c.then.map((t) => [t.is, t.look.motes.length, t.color])).toEqual([['hexed', 1, undefined], ['poisoned', 1, '#33ff66'], ['ice', 0, undefined]]);
    expect(c.then[0].look.color).toBe('#7a3cff');
    const ev = lowerPlay({ play }, { player: 'hero' });
    expect(Object.keys(ev.looks)).toEqual(['hexed', 'poisoned', 'ice']);
    expect(ev.looks.ice.ice).toEqual({ mode: 'encase' });
    expect(() => readCues({ cues: [{ id: 'x', when: { start: true }, then: { status: { who: 'guard', is: 'sparkly' } } }] })).toThrow(/'sparkly' is not a look/);
    expect(() => readCues({ cues: [{ id: 'x', when: { start: true }, then: { status: { who: 'guard', is: 'Bad Name', look: 'glow' } } }] })).toThrow(/is the status's name, a lower-case word/);
  });

  it('a timed status runs out on the world clock and fires faded; an untimed one comes off with its cue; lift takes one off', () => {
    const L = level({ cues: [
      { id: 'flash', when: { start: true }, then: { status: { who: 'guard', is: 'struck', look: 'kokusen', for: 0.5 } } },
      { id: 'after', when: { faded: { who: 'guard', is: 'struck' } }, then: { set: 'done', to: 1 } },
      { id: 'close', when: { near: { at: [0, 0], r: 2 } }, then: { status: { who: 'guard', is: 'shielded', look: 'ring' } } },
      { id: 'cure', when: { on: 'cure' }, then: { lift: { who: 'guard', is: 'struck' } } },
    ] });
    expect(L.ev.reactions).toContainEqual({ on: 'cue-end:close', do: 'ctrl', op: 'lift', who: 'guard', is: 'shielded' });
    L.tick();
    expect(Object.keys(L.guard().statuses)).toEqual(['struck']);
    L.run(20);
    expect(L.guard().statuses.struck).toBeUndefined();
    expect(L.bus.vars.done).toBe(1);
    L.world.byId.hero.transform.pos = [0, -1, 0];
    L.run(2);
    expect(Object.keys(L.guard().statuses)).toEqual(['shielded']);
    L.world.byId.hero.transform.pos = [0, -6, 0];
    L.run(2);
    expect(L.guard().statuses).toEqual({});
    expect(L.fired('faded')).toBe(2);
  });

  it('the board says them; the laws name a status that never comes off and two that look alike in greys', () => {
    const html = uiBoardHtml(resolvePlayUi({ play: { ui: 'propose', cues: [{ id: 'go', when: { faded: { who: 'guard', is: 'shielded' } }, then: { status: { who: 'guard', is: 'burning', look: 'fire', for: 3 } } }] } }, () => 7));
    expect(html).toContain('guard is no longer shielded');
    expect(html).toContain('guard is burning for 3 s');
    const law = (cues, k) => uiAdvice({ cues }, null, { entities: [{ id: 'guard' }] }).filter((l) => l.law === k).map((l) => l.at);
    expect(law([{ id: 'a', when: { start: true }, then: { status: { who: 'guard', is: 'shielded', look: 'ring' } } }], 'status-lifts')).toEqual(['cue a']);
    expect(law([{ id: 'a', when: { start: true }, then: { status: { who: 'guard', is: 'shielded', look: 'ring', for: 2 } } }], 'status-lifts')).toEqual([]);
    expect(law([{ id: 'a', when: { start: true }, then: [{ status: { who: 'guard', is: 'poisoned', look: 'fall', for: 2 } }, { status: { who: 'guard', is: 'cursed', look: 'fall', color: '#7a3cff', for: 2 } }] }], 'looks-apart')).toEqual(['poisoned, cursed']);
  });
});

describe('the page', () => {
  it('carries only the looks its cues name and only the layers they use, and exposes the bodies', async () => {
    const { emitThreeWorld } = await import('../../scene/scene-three.js');
    const entities = [{ id: 'hero', pilotable: true, rule: { type: 'walk', eye: 0.85 }, transform: { pos: [0, 0, 0.85] }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } }];
    const page = (cues) => emitThreeWorld({ entities, events: lowerPlay({ entities, play: { cues } }, { player: 'hero' }), inline: false });
    const js = page([{ id: 'x', when: { start: true }, then: { status: { who: 'hero', is: 'frozen', look: 'ice' } } }]);
    expect(js).toContain('__stepStatus();');
    expect(js).toContain('function __elEncase(');
    expect(js).not.toContain('const kokusenBolts = ');
    expect(js).toContain(' bodies: __bodies,');
    const dark = page([{ id: 'x', when: { start: true }, then: { status: { who: 'hero', is: 'struck', look: 'kokusen' } } }]);
    expect(dark).toContain('const kokusenBolts = ');
    expect(dark).not.toContain('function __elEncase(');
    const plain = page([{ id: 'x', when: { start: true }, then: { kill: 'hero' } }]);
    expect(plain).not.toContain('__stepStatus');
    expect(plain).not.toContain(' bodies: __bodies,');
  });

  it('the page source runs with every preset', async () => {
    const { statusScript } = await import('../../scene/channels/status-channel.js');
    expect(() => new Function('THREE', 'scene', 'camera', 'renderer', 'location', 'window', 'document', `${statusScript(LOOKS)}; return 1;`)).not.toThrow();
    // and the bolts it strikes run with their own helpers (the page has no module scope)
    const src = statusScript({ k: LOOKS.kokusen }), at = src.indexOf('const __BOLT'), end = src.indexOf('})();', at) + 5;
    const bolts = new Function(`${src.slice(at, end)}; return kokusenBolts([0, 0, 0], 0.3, __BOLT);`)();
    expect(bolts).toEqual(kokusenBolts([0, 0, 0], 0.3, BOLT_SHAPE));
  });
});

describe('fire: one layer, a size and a colour', () => {
  const entities = [{ id: 'hero', rule: { type: 'walk', eye: 0.85 }, transform: { pos: [0, 0, 0.85] }, body: { type: 'mesh', shape: 'box', size: [0.5, 0.5, 1.7] } }];
  it('each status whose look burns is one fire source on its body: small licks from the top, big engulfs from the feet', async () => {
    const { bodyFires } = await import('./body-fire.js');
    const play = { cues: [{ id: 'a', when: { start: true }, then: [
      { status: { who: 'hero', is: 'burning', look: 'fire' } }, { status: { who: 'hero', is: 'witchfire', look: 'fire', color: 'copper' } },
      { status: { who: 'hero', is: 'pyre', look: { fire: { size: 3.5, color: '#66ff88' } } } }, { status: { who: 'ghost', is: 'burning', look: 'fire' } }, { status: { who: 'hero', is: 'shielded', look: 'ring' } },
    ] }] };
    expect(bodyFires(play, entities)).toEqual([
      { kind: 'brazier', at: [0, 0, 0], size: 1.5, follow: 'hero', el: 'burning', key: '', rise: 0.85 },
      { kind: 'brazier', at: [0, 0, 0], size: 1.5, color: 'copper', follow: 'hero', el: 'witchfire', key: 'copper', rise: 0.85 },
      { kind: 'campfire', at: [0, 0, 0], size: 3.5, color: '#66ff88', follow: 'hero', el: 'pyre', key: '', rise: 0 },
    ]);
  });

  it('the fire channel carries a body\'s fire with no prop; a page without one is unchanged', async () => {
    const { resolveFire } = await import('../../fire/fire.js');
    const { fireChannelScript } = await import('../../scene/channels/fire.js');
    const r = resolveFire({}, [{ kind: 'brazier', at: [0, 0, 0], size: 1.5, color: 'copper', follow: 'hero', el: 'burning', key: 'copper', rise: 0.85 }]);
    expect(r.sources[0]).toMatchObject({ follow: 'hero', el: 'burning', key: 'copper', rise: 0.85, line: [expect.any(Number), expect.any(Number), 1] });
    expect(r.sources[0].light).toBeLessThanOrEqual(1.6);
    const js = fireChannelScript(r);
    expect(js).toContain('function __fireFollow(K)');
    expect(js).toContain('FIRE_PROPS = [[]];');
    expect(fireChannelScript(resolveFire({ sources: [{ kind: 'brazier', at: [0, 0, 0] }] }))).not.toContain('__fireFollow');
  });
});

describe('the drawer', () => {
  it('teaches statuses, looks, the wave and the presets', async () => {
    const { playCards } = await import('../ui/cards.js');
    const body = playCards().get('play-elements').body;
    for (const w of ['a status is a name you give', 'A WAVE (every orbiting light)', ...LOOK_NAMES]) expect(body).toContain(w);
    expect(playCards().get('ui-menus').body).not.toContain('later step');
  });
});
