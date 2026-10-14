import { describe, it, expect } from 'vitest';
import { shooterPole, readPole, THRESHOLDS } from './shooter-pole.js';
import { composeLive } from '../worlds/controllable/compose.js';
import { composeMechanics } from '../game/mechanics.js';
import { buildBus } from '../worlds/event-bus.js';

// THE SHOOTER POLE: one dial from a realistic shooter (a few rounds kill, the head worth four, walk, no kit, peek) to a
// stylized one (a long burst, run, double jump, dash, a heal and an ultimate, hp that mends, strafe). Its laws: the time
// to kill is the dial's spine and a duel lasts it; each feature switches on along the dial and stays on; a head hit
// pays its multiplier; the kit works on the bus.

const E = composeLive();
const PERSON = { a: 0.35, c: 0.9, cz: 0.9 };

describe('the dial', () => {
  it('reads its names and a number between them, and says what it takes', () => {
    expect([readPole('realistic'), readPole('stylized'), readPole(0.4)]).toEqual([0, 1, 0.4]);
    expect(() => readPole('arcade')).toThrow(/realistic.*stylized.*0 \(realistic\) to 1/);
  });

  it('the time to kill is its spine: a body takes the rounds the dial says, at the gun\'s rate', () => {
    for (const p of [0, 0.5, 1]) {
      const P = shooterPole(p), w = P.weapon;
      expect(w.damage * P.rounds).toBeGreaterThanOrEqual(P.hp);
      expect(w.damage * (P.rounds - 1)).toBeLessThan(P.hp);
      expect((P.rounds - 1) / w.rof).toBeCloseTo(P.ttk, 0);
    }
    const R = shooterPole('realistic'), S = shooterPole('stylized');
    expect(S.ttk / R.ttk).toBeGreaterThan(3);
    // the head: realistic, a round or two; stylized, still a burst
    expect(Math.ceil(R.hp / (R.weapon.damage * R.weapon.headshot))).toBeLessThanOrEqual(2);
    expect(Math.ceil(S.hp / (S.weapon.damage * S.weapon.headshot))).toBeGreaterThanOrEqual(4);
  });

  it('each feature switches on where its pole wins and stays on; peeking is the realistic pole\'s', () => {
    const has = (P) => [P.move.dash, P.move.jump, P.regen, P.abilities.heal, P.abilities.ultimate].filter(Boolean).length;
    let last = -1;
    for (let p = 0; p <= 1.0001; p += 0.05) { const n = has(shooterPole(Math.min(1, p))); expect(n).toBeGreaterThanOrEqual(last); last = n; }
    expect(has(shooterPole(0))).toBe(0);
    expect(has(shooterPole(1))).toBe(5);
    expect([shooterPole(0).mind.peek, shooterPole(1).mind.peek]).toEqual([true, false]);
    expect(shooterPole(THRESHOLDS.airJump).move.airJumps).toBe(1);
    expect(shooterPole(0).arena).toMatch(/close quarters/);
    expect(shooterPole(1).arena).toMatch(/large sparse ring/);
  });
});

describe('a head hit, and the damage a hit says', () => {
  const duel = (P, at) => {
    const w = E.createWorld({ entities: [
      { id: 'p', pilotable: true, rule: { type: 'walk', speed: 0, eye: 0 }, weapon: { ...P.weapon, eye: 1.6, hand: undefined }, body: { type: 'none' }, transform: { pos: [0, 0, 0], heading: 0, pitch: Math.atan2(at - 1.6, 12) } },
      { id: 't', rule: { type: 'walk', speed: 0, eye: 0 }, body: { type: 'mesh', hittable: true, hp: P.hp, egg: { ...PERSON } }, transform: { pos: [12, 0, 0], heading: Math.PI } },
    ] });
    E.stepWorld(w, { fire: 1 }, 1 / 30, { ground: () => 0 });
    return w.byId.t;
  };
  it('a round to the head deals the multiplier, to the body the damage; the hit fact says which', () => {
    const P = shooterPole('realistic');
    const head = duel(P, 1.7), body = duel(P, 1.0);
    expect(P.hp - head.body.hp).toBeCloseTo(Math.min(P.hp, P.weapon.damage * P.weapon.headshot), 6);
    expect(P.hp - body.body.hp).toBeCloseTo(P.weapon.damage, 6);
    expect([head.lastHitHead, body.lastHitHead]).toEqual([true, false]);
  });
  it('overdrive: its rounds hit harder', () => {
    const P = shooterPole('stylized');
    const w = E.createWorld({ entities: [
      { id: 'p', pilotable: true, rule: { type: 'walk', speed: 0, eye: 0 }, weapon: { ...P.weapon, eye: 1.0, hand: undefined }, body: { type: 'none' }, transform: { pos: [0, 0, 0], heading: 0, pitch: 0 } },
      { id: 't', rule: { type: 'walk', speed: 0, eye: 0 }, body: { type: 'mesh', hittable: true, hp: P.hp, egg: { ...PERSON } }, transform: { pos: [12, 0, 0], heading: Math.PI } },
    ] });
    E.castOps(w, [{ op: 'status', who: 'p', is: 'overdrive', for: 6 }]);
    E.stepWorld(w, { fire: 1 }, 1 / 30, { ground: () => 0 });
    expect(P.hp - w.byId.t.body.hp).toBeCloseTo(P.weapon.damage * E.OVERDRIVE, 6);
  });
});

describe('the kit on the bus', () => {
  const B = buildBus();
  const play = (mechs, script) => {
    const c = composeMechanics(mechs, { player: 'hero' }), s = B.createBusState(c.events), ops = [];
    const pump = (list) => { B.processEvents(s, list); let w = B.watchEvents(s); while (w.length) { B.processEvents(s, w); w = B.watchEvents(s); } if (s._ctrlOps) { ops.push(...s._ctrlOps); s._ctrlOps = []; } };
    pump([]);
    for (const [e, secs = 0] of script) { if (e) pump([e]); for (let k = 0; k < Math.round(secs * 10); k++) { pump(B.tickTimers(s, 0.1)); pump(B.stepTime(s, 0.1)); } }
    return { s, ops, c };
  };
  const frags = { kind: 'frags', rivals: ['bot-1'], frags: 9, hp: 200, damage: true };
  const hitMe = (harm, head = 0) => ({ type: 'hit:hero', entity: 'hero', by: 'bot-1', dmg: -harm, harm, head });

  it('the player\'s hp takes each round\'s own damage; a hit that says none costs none', () => {
    const { s } = play([frags], [[hitMe(-30)], [hitMe(-60, 1)], [{ type: 'hit:hero', entity: 'hero', by: 'bot-1' }]]);
    expect(s.vars.hp).toBe(110);
  });

  it('hp mends once left alone, never past its max, never from 0', () => {
    const { s } = play([frags, { kind: 'regen', after: 4, rate: 25, max: 200 }], [[hitMe(-100), 3.9]]);
    expect(s.vars.hp).toBe(100);
    const later = play([frags, { kind: 'regen', after: 4, rate: 25, max: 200 }], [[hitMe(-100), 9]]).s;
    expect(later.vars.hp).toBe(200);
  });

  it('a heal on its key, then its cooldown; the ultimate charged by hits landed, spent into overdrive', () => {
    const kit = { kind: 'abilities', heal: { amount: 60, cooldown: 8, max: 200 }, ultimate: { per: 25, for: 6, max: 200, rivals: ['bot-1'] } };
    const { s, c } = play([frags, kit], [[hitMe(-150)], [{ type: 'ability:heal' }], [{ type: 'ability:heal' }]]);
    expect(s.vars.hp).toBe(110);   // once: the second press is on its cooldown
    expect(c.events.inputs.map((i) => i.key)).toEqual(['q', 'x']);
    const charged = play([frags, kit], [[hitMe(-150)], ...Array.from({ length: 4 }, () => [{ type: 'hit:bot-1', entity: 'bot-1', by: 'hero' }]), [{ type: 'ability:ultimate' }]]);
    expect(charged.s.vars.hp).toBe(200);
    expect(charged.ops.some((o) => o.op === 'status' && o.who === 'hero' && o.is === 'overdrive' && o.for === 6)).toBe(true);
    // uncharged, it does nothing
    const early = play([frags, kit], [[{ type: 'hit:bot-1', entity: 'bot-1', by: 'hero' }], [{ type: 'ability:ultimate' }]]);
    expect(early.ops).toEqual([]);
  });
});
