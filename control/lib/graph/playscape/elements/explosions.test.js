import { describe, it, expect } from 'vitest';
import { composeLive } from '../../worlds/controllable/compose.js';
import { readCues } from '../ui/cues.js';
import { lowerPlay, resolvePlayUi } from '../ui/direction.js';
import { uiBoardHtml } from '../ui/board-html.js';
import { readSpray, sprayPoints } from './elements.js';
import { EXPLOSIONS, EXPLOSION_NAMES, readExplosion, explosionSignature } from './explosions.js';
import { BEAMS, beamLanding } from './beams.js';

const CW = composeLive();
const DT = 1 / 30;

describe('sprays slow and change colour', () => {
  it('a dragged particle goes v / drag at most and lies on the ground; u runs its life', () => {
    const S = readSpray({ count: 6, from: 'point', z: 0, v: 8, el: [0, 0], drag: 4, life: 3 }, 's');
    for (const t of [0.5, 1, 2.9]) for (const q of sprayPoints(S, [0, 0, 0], t, false)) {
      if (!q.w) continue;
      expect(Math.hypot(q.p[0], q.p[1])).toBeLessThanOrEqual(8 * 1.4 / 4 + 1e-9);
      expect(q.u).toBeGreaterThan(0); expect(q.u).toBeLessThanOrEqual(1);
    }
    const far = sprayPoints(S, [0, 0, 0], 2.9, false).filter((q) => q.w), near = sprayPoints(S, [0, 0, 0], 2.5, false).filter((q) => q.w);
    expect(Math.abs(Math.hypot(...far[0].p) - Math.hypot(...near[0].p))).toBeLessThan(0.002);   // it has stopped
    const fall = readSpray({ count: 4, from: 'point', z: 1, gravity: 9.8, drag: 1, life: 3 }, 'f');
    for (const q of sprayPoints(fall, [0, 0, 0], 2.5, false)) expect(q.p[2]).toBeGreaterThanOrEqual(0);
    // a shell's particles going in reach the middle
    const inn = readSpray({ count: 8, from: 'shell', r: 2, z: 0, v: -4, el: [0, 0], life: 0.5 }, 'i');
    const rs = sprayPoints(inn, [0, 0, 0], 0.45, false).filter((q) => q.w).map((q) => Math.hypot(q.p[0], q.p[1]));
    expect(Math.max(...rs)).toBeLessThan(1.5);
    expect(rs.reduce((a, b) => a + b, 0) / rs.length).toBeLessThan(1);
    expect(readSpray({ ramp: ['#ffffff', 'copper', [0, 0, 0]] }, 'r').ramp).toHaveLength(3);
    expect(() => readSpray({ ramp: ['#fff'] }, 'r')).toThrow(/r.ramp is 2 to 6 colours/);
  });
});

describe('an explosion', () => {
  it('is its parts, lowered to the moment channel\'s spec; presets read apart in values', () => {
    expect(EXPLOSION_NAMES).toEqual(['pop', 'blast', 'mushroom', 'comic', 'chain', 'implode']);
    expect(new Set(EXPLOSION_NAMES.map((n) => explosionSignature(EXPLOSIONS[n]))).size).toBe(EXPLOSION_NAMES.length);
    const B = EXPLOSIONS.blast;
    expect(B.parts.map((p) => p.glyph)).toEqual(['soft', 'dot', 'soft', 'chip', 'streak']);
    expect(B.parts[0].ramp[1]).toEqual(B.color);
    expect(B.rings.map((r) => (r.air ? 'air' : 'ground'))).toEqual(['ground', 'air']);
    expect(B.dur).toBeGreaterThan(3);
    // an implosion comes first: every other part waits for it
    const I = EXPLOSIONS.implode, wait = I.rings[0].life;
    expect(I.rings[0].inward).toBe(true);
    expect(I.star.delay).toBe(wait);
    expect(I.parts.slice(1).every((p) => p.delay >= wait)).toBe(true);
    expect(EXPLOSIONS.chain.chain).toEqual({ count: 5, spread: 3.5, stagger: 0.18 });
  });

  it('teaches', () => {
    expect(() => readExplosion({}, 'x')).toThrow(/x has no parts/);
    expect(() => readExplosion({ boom: true }, 'x')).toThrow(/x has no boom: an explosion's parts are color, flash/);
    expect(() => readExplosion({ fireball: { radius: 99 } }, 'x')).toThrow(/x.fireball.radius is how far it billows \(m\), 0.1 to 30/);
    expect(() => readExplosion({ flash: { heat: 1 } }, 'x')).toThrow(/x.flash has no heat/);
    expect(() => readExplosion({ flash: true, count: 40 }, 'x')).toThrow(/x.count is how many blasts/);
    expect(() => readExplosion('kaboom', 'x')).toThrow(/is not an explosion: name a preset \(pop, blast/);
  });
});

describe('the engine', () => {
  const ents = () => [{ id: 'hero', rule: { type: 'walk', eye: 0.85 }, transform: { pos: [0, 0, 0.85], heading: 0 }, body: { type: 'none' } }, { id: 'golem', rule: { type: 'static' }, transform: { pos: [10, 0, 0.9] }, body: { type: 'none' } }];
  it('a chain is count blasts, scattered by seeded dice within its spread, one after another; one shake over them', () => {
    const run = () => { const w = CW.createWorld({ entities: ents() }); CW.stepWorld(w, {}, DT); CW.castOps(w, [{ op: 'puff', at: [4, 4], is: 'chain', spec: EXPLOSIONS.chain, scale: 2 }]); return w; };
    const w = run(), t0 = w.time, ms = w.moments.filter((m) => m.spec);
    expect(ms).toHaveLength(5);
    ms.forEach((m, j) => { expect(m.t0).toBeCloseTo(t0 + j * 0.18, 9); expect(Math.hypot(m.at[0] - 4, m.at[1] - 4)).toBeLessThanOrEqual(3.5 * 2 + 1e-9); expect(m.until).toBeCloseTo(m.t0 + m.spec.dur + 0.2, 9); expect(m.scale).toBe(2); });
    expect(ms[0].at).toEqual([4, 4, 0]);
    expect(run().moments.map((m) => m.at)).toEqual(w.moments.map((m) => m.at));
    const sh = w.moments.filter((m) => m.is === 'shake');
    expect(sh).toHaveLength(1);
    expect(sh[0].for).toBeCloseTo(0.4 + 0.18 * 4, 9);
  });

  it('a beam whose impact is an explosion sets it off where it lands, when it lands', () => {
    const w = CW.createWorld({ entities: ents() });
    CW.castOps(w, [{ op: 'beam', who: 'hero', to: 'golem', spec: BEAMS.nova, land: beamLanding(BEAMS.nova) }]);
    const M = w.moments.find((m) => m.is === 'beam'), X = w.moments.find((m) => m.spec && m.is === 'blast');
    expect(X).toMatchObject({ at: [10, 0, 0.9], t0: M.hit });
    expect(X.spec).toEqual(EXPLOSIONS.blast);
  });
});

describe('explosions in the cues', () => {
  const ENTS = [{ id: 'hero', rule: { type: 'walk' }, transform: { pos: [0, 0, 0] }, body: { type: 'none' } }];
  it('read a preset, a play.explosions name or parts; at a character or a place; the board says them', () => {
    const play = { spots: [{ id: 'well', at: [4, 4] }], explosions: { flare: { implode: true, flash: true } }, beams: { bomb: { strands: { form: 'bolt' }, impact: 'flare' } }, cues: [{ id: 'a', when: { start: true }, then: [
      { explode: 'hero' }, { explode: { at: 'well', is: 'mushroom', scale: 0.5 } }, { explode: { who: 'hero', is: 'flare', color: 'copper' } }, { explode: { at: [1, 1], is: { comic: true } } }, { beam: { who: 'hero', to: 'well', is: 'bomb' } },
    ] }] };
    const ev = lowerPlay({ entities: ENTS, play }, { player: 'hero' });
    const rs = ev.reactions.filter((r) => r.op === 'puff');
    expect(rs.map((r) => [r.who, r.at, r.is, r.scale, r.color])).toEqual([['hero', undefined, 'blast', undefined, undefined], [undefined, [4, 4, 0], 'mushroom', 0.5, undefined], ['hero', undefined, 'flare', undefined, 'copper'], [undefined, [1, 1, 0], 'explosion', undefined, undefined]]);
    expect(rs[0].spec).toEqual(EXPLOSIONS.blast);
    expect(ev.reactions.find((r) => r.op === 'beam').spec.impactSpec.rings[0].inward).toBe(true);
    const bad = (then) => () => readCues({ cues: [{ id: 'x', when: { start: true }, then }] });
    expect(bad({ explode: { is: 'blast' } })).toThrow(/explode is a character's id, or \{ who \| at: place/);
    expect(bad({ explode: { who: 'hero', scale: 40 } })).toThrow(/scale is how big/);
    const html = uiBoardHtml(resolvePlayUi({ entities: ENTS, play: { ...play, ui: 'propose' } }, () => 7));
    for (const w of ['a blast at hero', 'a mushroom at well (× 0.5)', 'an explosion at [1, 1]']) expect(html).toContain(w);
  });
});

describe('the page', () => {
  const entities = [{ id: 'hero', pilotable: true, rule: { type: 'walk', eye: 0.85 }, transform: { pos: [0, 0, 0.85] }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } }];
  const page = async (then) => {
    const { emitThreeWorld } = await import('../../scene/scene-three.js');
    return emitThreeWorld({ entities, events: lowerPlay({ entities, play: { cues: [{ id: 'x', when: { start: true }, then }] } }, { player: 'hero' }), inline: false });
  };
  it('carries the explosion pieces only when one goes off', async () => {
    const boom = await page({ explode: { at: [3, 3], is: 'comic' } });
    expect(boom).toContain('const __moComic = ');
    expect(boom).toContain('const __moShake = ');
    expect(boom).toContain('const __moLight = ');
    const puff = await page({ puff: { at: [3, 3], is: 'dust' } });
    expect(puff).toContain('__stepMoments();');
    expect(puff).not.toContain('const __moComic = ');
  });

  it('the page source compiles with explosions and every puff kind', async () => {
    const { momentScript } = await import('../../scene/channels/moment-channel.js');
    const { PUFFS } = await import('./moments.js');
    expect(() => new Function('THREE', 'scene', 'camera', 'renderer', 'window', 'document', `${momentScript([...PUFFS, 'explosion', 'shake'])}; return 1;`)).not.toThrow();
  });
});
