import { describe, expect, it } from 'vitest';
import { composeLive } from './compose.js';
import { shooterPole } from '../../gameworld/shooter-pole.js';

// A MIND'S KIT (opt-in `rule.kit`, the stylized pole's): under fire it hops and dashes off the line (no invincibility),
// low it heals, charged by the hits it lands it spends its ultimate on a foe it sees (overdrive, hp full).

const E = composeLive();
const hooks = { ground: () => 0 };
const PERSON = { a: 0.35, c: 0.9, cz: 0.9 };
const S = shooterPole('stylized');
const fighter = (id, pos, heading, kit) => ({
  id, rule: { type: 'ai', mind: { motivation: 'frag', perception: 'memory' }, sightRange: 40, sightCone: 1.4, standoff: 30, speed: 4, turn: 4, dodge: false, burst: 0.3, pause: 1, eye: 0, collideRadius: 0.3, collideHeight: 1.7, step: 0.3, ...(kit ? { kit } : {}) },
  weapon: { ...S.weapon, eye: 1.4 }, body: { type: 'mesh', hittable: true, hp: S.hp, poise: 9, radius: 0.6, egg: { ...PERSON } }, transform: { pos, heading, pitch: 0 },
});
const hit = (w, id, by) => { const e = w.byId[id]; e.hits = (e.hits || 0) + 1; e.lastHitBy = by; };

describe('a mind\'s kit', () => {
  it('under fire it hops, and a fresh hit dashes it off the line, square to the shooter, without i-frames', () => {
    const w = E.createWorld({ entities: [fighter('a', [0, 0, 0], 0, S.mind.kit), fighter('b', [20, 0, 0], Math.PI)] });
    const a = w.byId.a;
    hit(w, 'a', 'b');
    let top = 0, rolled = false, inv = false;
    for (let k = 0; k < 20; k++) { E.stepWorld(w, {}, 1 / 30, hooks); top = Math.max(top, a.hopZ || 0); rolled ||= a.dodgeT != null; inv ||= !!a.invincible; }
    expect(top).toBeGreaterThan(0.5);
    expect(rolled).toBe(true);
    expect(inv).toBe(false);
    expect(Math.abs(a.transform.pos[1])).toBeGreaterThan(0.5);   // off the line the shot came along (the x axis)
    for (let k = 0; k < 30; k++) E.stepWorld(w, {}, 1 / 30, hooks);
    expect(a.hopZ).toBe(0);
  });

  it('low, it heals; charged, it spends its ultimate on a foe it sees', () => {
    // the foe faces away: it does not fire back while this is measured
    const w = E.createWorld({ entities: [fighter('a', [0, 0, 0], 0, S.mind.kit), fighter('b', [20, 0, 0], 0)] });
    const a = w.byId.a;
    a.body.hp = 40;
    E.stepWorld(w, {}, 1 / 30, hooks);
    expect(a.body.hp).toBe(40 + S.mind.kit.heal.amount);
    a.kitCharge = 100;
    for (let k = 0; k < 10 && !a.kitUlts; k++) E.stepWorld(w, {}, 1 / 30, hooks);
    expect(a.kitUlts).toBe(1);
    expect(a.statuses.overdrive).toBeTruthy();
    expect(a.body.hp).toBe(a.hpMax);
  });

  it('its hits charge it; without a kit a mind does none of it', () => {
    const w = E.createWorld({ entities: [fighter('a', [0, 0, 0], 0, S.mind.kit), fighter('b', [12, 0, 0], Math.PI)] });
    for (let k = 0; k < 60; k++) E.stepWorld(w, {}, 1 / 30, hooks);
    expect(w.byId.a.kitCharge).toBeGreaterThan(0);
    const plain = E.createWorld({ entities: [fighter('a', [0, 0, 0], 0), fighter('b', [20, 0, 0], Math.PI)] });
    hit(plain, 'a', 'b');
    for (let k = 0; k < 20; k++) E.stepWorld(plain, {}, 1 / 30, hooks);
    expect([plain.byId.a.hopZ ?? 0, plain.byId.a.kitHops ?? 0, plain.byId.a.kitCharge ?? 0]).toEqual([0, 0, 0]);
  });
});
