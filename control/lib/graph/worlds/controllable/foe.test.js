// The foe runtime's laws (foe.js): each own move on the real engine (a pacer turns at its end, at a ledge and at a
// wall; a hopper leaves the ground to travel; a rusher braces, charges and is stunned by a wall; a diver braces,
// dives and climbs back; a lurker lies still till the hero comes near), and the hero body to body with them (a touch
// hits it once, then mercy; a stomp is a blow and a bounce, higher with the jump held; a spiny one hurts the stomper; a
// big one only bounces it). Each foe is resolved from the shelf (lib/graph/foes), its class chosen in code by the
// procedure it runs. A world without a foe steps byte for byte as the engine without the opt-in.
import { describe, it, expect } from 'vitest';
import { composeLive, composeControllable, EMISSION, emissionSource } from './compose.js';
import { FOE_CLASSES } from '../../foes/index.js';
import { MOVES, ATTACKS } from '../../foes/vocab.js';
import { resolveFoe } from '../../foes/resolve.js';

const E = composeLive();
const DT = 1 / 30;
const PERSON = { a: 0.35, c: 0.9, cz: 0.9 };
const STOMP = { low: 0.6, high: 1.8, blow: 20, mercy: 1 };
const classBy = (what, pred) => { const c = Object.values(FOE_CLASSES).find(pred); if (!c) throw new Error(`no class ${what}`); return c; };
const byMove = (m) => classBy(`that ${m}s`, (c) => c.move === m);
const pilot = (pos, extra = {}) => ({ id: 'p', pilotable: true, rule: { type: 'platform', speed: 4, eye: 0, collideRadius: 0.3, collideHeight: 1.7, stomp: STOMP, ...(extra.rule || {}) }, body: { type: 'mesh', hittable: true, hp: 99, egg: PERSON }, transform: { pos, heading: 0 } });
const foe = (id, cls, pos, heading = 0, over = {}) => {
  const f = resolveFoe({ class: cls.id });
  return { id, team: 'foes', rule: { ...f.entity.rule, eye: 0, collideRadius: 0.4, collideHeight: 0.6, ...(over.rule || {}), foe: { ...f.entity.rule.foe, ...(over.foe || {}) } }, ...(f.entity.weapon ? { weapon: f.entity.weapon } : {}), body: { type: 'mesh', hittable: true, hp: f.toll.hp, poise: 2, egg: { a: 0.3, c: 0.3, cz: 0.3 } }, transform: { pos, heading } };
};
const world = (entities, colliders) => E.createWorld({ entities, ...(colliders ? { colliders } : {}) });
const run = (st, n, { ground = () => 0, input = {} } = {}) => { for (let i = 0; i < n; i++) E.stepWorld(st, input, DT, { ground }); return st; };
const FAR = [0, -40, 0];

describe('a foe\'s own moves', () => {
  const PACER = byMove('pace');
  it('a pacer walks its stretch and turns at its end', () => {
    const st = run(world([pilot(FAR), foe('w', PACER, [0, 0, 0], 0, { foe: { stretch: 4 } })]), 1);
    const xs = [];
    for (let i = 0; i < 200; i++) { run(st, 1); xs.push(st.byId.w.transform.pos[0]); }
    // (it turns once within a quarter metre of an end)
    expect(Math.max(...xs)).toBeGreaterThan(1.7);
    expect(Math.min(...xs)).toBeLessThan(-1.7);
    expect(Math.max(...xs)).toBeLessThanOrEqual(2 + 1e-9);
  });
  it('turns at a ledge before it steps off, and at a wall it cannot pass', () => {
    const ledge = (p) => (p[0] < 1 ? 0 : null);
    const a = world([pilot(FAR), foe('w', PACER, [0, 0, 0], 0, { foe: { stretch: 10 } })]), far = [];
    for (let i = 0; i < 240; i++) { run(a, 1, { ground: ledge }); far.push(a.byId.w.transform.pos[0]); }
    expect(Math.max(...far)).toBeLessThan(1);
    expect(Math.min(...far)).toBeLessThan(-4);
    const xs = []; const b = world([pilot(FAR), foe('w', PACER, [0, 0, 0], 0, { foe: { stretch: 10 } })], [{ min: [1.5, -2, 0], max: [2, 2, 2] }]);
    for (let i = 0; i < 300; i++) { run(b, 1); xs.push(b.byId.w.transform.pos[0]); }
    expect(Math.max(...xs)).toBeLessThan(1.5);
    expect(Math.min(...xs)).toBeLessThan(-4);
  });
  it('a hopper travels only off the ground, an arc above it', () => {
    const H = byMove('hop'), st = world([pilot(FAR), foe('h', H, [0, 0, 0], 0)]);
    let air = 0, still = 0;
    for (let i = 0; i < 90; i++) {
      const x0 = st.byId.h.transform.pos[0]; run(st, 1);
      const z = st.byId.h.transform.pos[2], dx = Math.abs(st.byId.h.transform.pos[0] - x0);
      if (z > 0.05) air++; else if (dx < 1e-9) still++;
    }
    expect(air).toBeGreaterThan(10);
    expect(still).toBeGreaterThan(10);
  });
  it('a rusher braces, charges its line and is stunned by a wall; its charge hurts, its brace does not', () => {
    const R = byMove('rush'), st = world([pilot([0, 6, 0]), foe('r', R, [0, 0, 0], Math.PI / 2)], [{ min: [-3, 12, 0], max: [3, 13, 2] }]);
    const seen = new Set();
    for (let i = 0; i < 120; i++) { run(st, 1); seen.add(st.byId.r.foeRush); }
    expect([...seen]).toEqual(expect.arrayContaining(['brace', 'charge', 'stun']));
    expect(st.byId.p.hits).toBeGreaterThan(0);
    expect(ATTACKS[R.attack.kind].during).toBe('charge');
  });
  it('a diver braces for a hero inside its radius, dives at where it stood, and climbs back to its perch', () => {
    const D = byMove('dive'), st = world([pilot([4, 0, 0]), foe('d', D, [0, 0, 3], 0)]);
    const seen = [];
    for (let i = 0; i < 240; i++) { run(st, 1); if (seen[seen.length - 1] !== st.byId.d.foeDive) seen.push(st.byId.d.foeDive); }
    // (the hero stands inside its radius from the start: it braces on its first frame)
    expect(seen.slice(0, 4)).toEqual(['brace', 'dive', 'climb', 'drift']);
  });
  it('a lurker lies still till the hero comes inside its radius, then the mind has it', () => {
    const L = byMove('lurk'), r = MOVES.lurk.own.lurk.radius, st = world([pilot([r + 3, 0, 0]), foe('l', L, [0, 0, 0], 0)]);
    run(st, 60);
    expect(st.byId.l.transform.pos).toEqual([0, 0, 0]);
    expect(st.byId.l.foeAwake).toBeFalsy();
    st.byId.p.transform.pos = [r - 1, 0, 0];
    run(st, 30);
    expect(st.byId.l.foeAwake).toBe(true);
    expect(st.byId.l.transform.pos[0]).toBeGreaterThan(0);
  });
});

describe('body to body', () => {
  const TOUCH = classBy('that hurts by touch', (c) => ATTACKS[c.attack.kind].verb === 'contact' && !ATTACKS[c.attack.kind].during && c.stomp === 'blow');
  const still = { foe: { move: 'hold' } };
  it('a touch hits the hero once, knocks it off, and spares it for its mercy', () => {
    const st = world([pilot([0, 0, 0]), foe('t', TOUCH, [0.3, 0, 0], Math.PI, still)]);
    run(st, 1);
    expect(st.byId.p.hits).toBe(1);
    expect(st.byId.p.transform.pos[0]).toBeLessThan(0);
    st.byId.p.transform.pos = [0, 0, 0]; run(st, Math.floor(STOMP.mercy / DT) - 2);
    expect(st.byId.p.hits).toBe(1);
  });
  const fall = (cls, held) => {
    const st = world([pilot([0, 0, 1.0]), foe('t', cls, [0, 0, 0], 0, still)]);
    st.byId.p.vel = [0, 0, -4]; st.byId.p.grounded = false;
    // falls till it meets the head (or the ground): the frame it does, it bounces or is hurt
    for (let i = 0; i < 20 && !(st.byId.p.vel[2] > 0); i++) run(st, 1, { input: held ? { jumpHeld: 1 } : {} });
    return st;
  };
  it('falling onto its head is a blow and a bounce, higher with the jump held', () => {
    const lo = fall(TOUCH, false), hi = fall(TOUCH, true);
    expect(lo.byId.t.hits).toBe(1);
    expect(lo.byId.t.body.hp).toBe(resolveFoe({ class: TOUCH.id }).toll.hp - STOMP.blow);
    expect(lo.byId.p.hits).toBe(0);
    expect(lo.byId.p.vel[2]).toBeGreaterThan(0);
    expect(hi.byId.p.vel[2]).toBeGreaterThan(lo.byId.p.vel[2]);
  });
  it('a spiny one hurts the stomper; a big one only bounces it', () => {
    const spiny = classBy('that hurts a stomper', (c) => c.stomp === 'hurts'), big = classBy('that only bounces', (c) => c.stomp === 'bounce');
    const s = fall(spiny, false), b = fall(big, false);
    expect(s.byId.p.hits).toBe(1);
    expect(s.byId.t.hits).toBe(0);
    expect(b.byId.p.hits).toBe(0);
    expect(b.byId.t.hits).toBe(0);
    expect(b.byId.p.vel[2]).toBeGreaterThan(0);
  });
});

describe('the opt-in', () => {
  it('a world without a foe steps byte for byte as the engine without it', () => {
    const plain = composeControllable(EMISSION), spec = { entities: [pilot([0, 0, 0]), { id: 'm', team: 'foes', rule: { type: 'ai', speed: 3, mind: { motivation: 'hunt', aggressiveness: 'bold' }, standoff: 0.5 }, body: { type: 'mesh', hittable: true, hp: 20, egg: PERSON }, transform: { pos: [6, 0, 0], heading: 0 } }] };
    const a = E.createWorld(spec), b = plain.createWorld(spec);
    for (let i = 0; i < 90; i++) { E.stepWorld(a, { forward: 1 }, DT, { ground: () => 0 }); plain.stepWorld(b, { forward: 1 }, DT, { ground: () => 0 }); }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  it('is emitted only into a page that asks for it', () => {
    expect(emissionSource()).not.toContain('buildFoe');
    expect(emissionSource({ foe: true })).toContain('buildFoe');
  });
});
