import { describe, it, expect } from 'vitest';
import { composeLive, composeControllable, EMISSION, emissionSource } from './compose.js';
import { readKnockback, carriesKnock } from '../../rupa/knock.js';
import { readActions } from '../../gameworld/actions.js';

const CW = composeLive();
const G = { ground: () => 0 };
const L = CW.knockLaw;
const hero = (extra = {}) => ({ id: 'p', pilotable: true, transform: { pos: [-20, 0, 0], heading: 0 }, rule: { type: 'platform', speed: 4, eye: 0, ...extra }, body: { type: 'mesh', hittable: true, hp: 99, egg: { a: 0.35, c: 0.9 } } });
const foe = (id, x, body = {}) => ({ id, team: 'foes', rule: { type: 'ai', speed: 0 }, body: { type: 'mesh', hittable: true, hp: 100, egg: { a: 0.35, c: 0.9 }, ...body }, transform: { pos: [x, 0, 0], heading: 0 } });
const world = (entities, knock = true, spec = {}) => CW.createWorld({ entities, pilot: 'p', ...(knock ? { knock } : {}), ...spec });
const steps = (w, n, input = {}) => { for (let i = 0; i < n; i++) CW.stepWorld(w, input, 1 / 60, G); return w; };
const burst = (w, pos, radius, extra = {}) => { if (!w.bursts) { w.bursts = []; w.burstSeq = 0; } w.bursts.push({ seq: w.burstSeq++, pos, t: w.time, radius, ...extra }); };
const speed = (e) => (e.knock ? Math.hypot(...e.knock.v) : 0);

describe('the law: what holds, and what flies', () => {
  it('a body\'s mass from its hitbox (a person about 75 kg), or its own', () => {
    expect(L.massOf(foe('a', 0))).toBeGreaterThan(65); expect(L.massOf(foe('a', 0))).toBeLessThan(85);
    expect(L.massOf(foe('a', 0, { mass: 500 }))).toBe(500);
  });

  it('what passes its hold is thrown, √(2(E − hold)/m), held to the cap; under it, nothing', () => {
    const m = 75, hold = 0.6 * m * 9.81 * 0.15;
    expect(L.throwSpeed(m, hold * 0.9, hold)).toBe(0);
    expect(L.throwSpeed(m, hold + 600, hold)).toBeCloseTo(4, 6);
    expect(L.throwSpeed(m, 1e9, hold, 40)).toBe(40);
  });

  it('a shock\'s share falls with distance and grows with the body\'s area', () => {
    expect(L.shareOf(1, 4)).toBeLessThan(L.shareOf(1, 2));
    expect(L.shareOf(2, 4)).toBeGreaterThan(L.shareOf(1, 4));
    expect(L.joulesOf('heavy')).toBe(3000); expect(L.joulesOf(120)).toBe(120);
  });
});

describe('natural knockback on the runtime', () => {
  it('a burst\'s impact throws the near harder than the far, light and heavy each as they are', () => {
    const w = world([hero(), foe('near', 2), foe('far', 7), foe('tank', -3, { mass: 3000 })]);
    steps(w, 1); burst(w, [0, 0, 0.2], 4); steps(w, 1);
    expect(speed(w.byId.near)).toBeGreaterThan(speed(w.byId.far));
    expect(speed(w.byId.far)).toBeGreaterThan(0);
    expect(w.byId.tank.knock).toBeFalsy();
    expect(w.byId.near.knock.v[0]).toBeGreaterThan(0); expect(w.byId.near.knock.v[2]).toBeGreaterThan(0);   // outward and up
    expect(w.knock.log.some((x) => x.kind === 'impact' && x.ground > 0)).toBe(true);
    steps(w, 240);
    expect(w.byId.near.knock).toBeNull(); expect(w.byId.near.transform.pos[0]).toBeGreaterThan(3);   // an arc, a slide, a stop
    expect(w.byId.near.transform.pos[2]).toBeCloseTo(0, 6);
  });

  it('a wall stops a thrown body, with a stagger and a record', () => {
    const w = world([hero(), foe('near', 1.5)], true, { colliders: [{ min: [2.6, -3, 0], max: [3, 3, 3] }] });
    steps(w, 1); burst(w, [0, 0, 0.2], 6); steps(w, 120);
    expect(w.byId.near.transform.pos[0]).toBeLessThan(2.6);
    expect(w.knock.log.some((x) => x.kind === 'wall')).toBe(true);
  });

  it('the hero is thrown too, unless the level says not', () => {
    const on = world([{ ...hero(), transform: { pos: [2, 0, 0], heading: 0 } }]); steps(on, 1); burst(on, [0, 0, 0.2], 4); steps(on, 1);
    expect(on.byId.p.knock).toBeTruthy();
    const off = world([{ ...hero(), transform: { pos: [2, 0, 0], heading: 0 } }], { hero: false }); steps(off, 1); burst(off, [0, 0, 0.2], 4); steps(off, 1);
    expect(off.byId.p.knock).toBeFalsy();
  });

  it('a hard landing is a slam that shoves what stands by', () => {
    const w = world([{ ...hero(), transform: { pos: [0, 0, 30], heading: 0 } }, foe('by', 1.5)]);
    steps(w, 120);
    expect(w.knock.log.some((x) => x.kind === 'slam' && x.id === 'p')).toBe(true);
    expect(w.knock.log.some((x) => x.kind === 'push' && x.id === 'by')).toBe(true);
  });

  it('attacks carrying their own: a burst\'s impact and kinetic, without a natural level', () => {
    const w = world([hero(), foe('a', 2)], { attacks: true });
    steps(w, 1); burst(w, [0, 0, 0.2], 4); steps(w, 1);
    expect(w.byId.a.knock).toBeFalsy();   // no natural impact from its size
    burst(w, [0, 0, 0.2], 4, { knock: { kinetic: 'heavy' } }); steps(w, 1);
    expect(w.byId.a.knock).toBeTruthy();
  });

  it('a direct hit\'s kinetic pushes along the blow; its impact goes into the ground under it', () => {
    const w = world([hero(), foe('a', 2), foe('b', 3)], { attacks: true });
    steps(w, 1);
    CW.knockHit(w, w.byId.a, w.byId.p, { kinetic: 'heavy' }, [1, 0]);
    expect(w.byId.a.knock.v[0]).toBeGreaterThan(5); expect(w.byId.b.knock).toBeFalsy();
    CW.knockHit(w, w.byId.a, w.byId.p, { impact: 'massive' }, [1, 0]);
    expect(w.byId.b.knock).toBeTruthy();
  });
});

describe('splash by proximity, and the seams', () => {
  const shell = (extra = {}) => ({ pos: [0, 0, 0.9], owner: 'p', splashRadius: 4, projRadius: 0.5, damage: 40, impact: 0, ...extra });
  it('in a level with knockback a burst\'s damage falls off with distance; without it, it is whole', () => {
    const w = world([hero(), foe('near', 0.3), foe('edge', 3.6)]);   // (near: touching it)
    CW.burstProjectile(w, shell());
    const near = 100 - w.byId.near.body.hp, edge = 100 - w.byId.edge.body.hp;
    expect(near).toBeCloseTo(40, 6); expect(edge).toBeLessThan(near); expect(edge).toBeGreaterThanOrEqual(40 * 0.2 - 1e-9);
    const flat = world([hero(), foe('near', 0.5), foe('edge', 3.6)], null);
    CW.burstProjectile(flat, shell());
    expect(100 - flat.byId.edge.body.hp).toBe(40);
    const kept = world([hero(), foe('edge', 3.6)], { splash: 'flat' });
    CW.burstProjectile(kept, shell());
    expect(100 - kept.byId.edge.body.hp).toBe(40);
  });

  it('a weapon\'s knock rides its burst record', () => {
    const w = world([hero(), foe('a', 2)], { attacks: true });
    CW.burstProjectile(w, shell({ knock: { impact: 'heavy' } }));
    expect(w.bursts[w.bursts.length - 1].knock).toEqual({ impact: 'heavy' });
    expect(w.bursts[w.bursts.length - 1].by).toBe('p');
    CW.burstProjectile(w, shell());
    expect(w.bursts[w.bursts.length - 1].knock).toBeUndefined();
  });

  it('a world without it carries no byte of it and steps as the engine does', () => {
    expect(emissionSource({})).not.toContain('buildKnock');
    expect(emissionSource({ knock: true })).toContain('buildKnock');
    expect(composeControllable(EMISSION).pipelineOrder().bodyOwners).not.toContain('knock');
    const spec = { entities: [hero(), foe('a', 2)], pilot: 'p' }, plain = composeControllable(EMISSION);
    const a = CW.createWorld(spec), b = plain.createWorld(spec);
    for (const w of [a, b]) { (w.bursts = []).push({ seq: 0, pos: [0, 0, 0.2], t: 0, radius: 4 }); w.burstSeq = 1; }
    for (let i = 0; i < 30; i++) { CW.stepWorld(a, { forward: 1 }, 1 / 60, G); plain.stepWorld(b, { forward: 1 }, 1 / 60, G); }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('read and carried', () => {
  it('a level\'s knockback, read with teaching messages', () => {
    expect(readKnockback(true)).toBe(true);
    expect(readKnockback({ scale: 2, hero: false })).toEqual({ scale: 2, hero: false });
    expect(() => readKnockback({ splash: 'cone' })).toThrow(/splash/);
    expect(() => readKnockback({ force: 1 })).toThrow(/not a knockback word/);
  });

  it('attacks carrying their own are found; a power says kinetic and impact', () => {
    expect(carriesKnock([{ weapon: { knock: { kinetic: 300 } } }])).toBe(true);
    expect(carriesKnock([{ rule: { strikeKnock: { kinetic: 'light' } } }])).toBe(true);
    expect(carriesKnock([{ rule: { speed: 4 } }], null)).toBe(false);
    const A = readActions({ powers: [{ id: 'quake', verb: 'shake', attack: 'orb', kinetic: 'heavy', impact: 5000 }] });
    expect(A.powers[0]).toMatchObject({ kinetic: 'heavy', impact: 5000 });
    expect(() => readActions({ powers: [{ id: 'q', verb: 'shake', kinetic: 'huge' }] })).toThrow(/kinetic/);
  });
});
