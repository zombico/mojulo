import { describe, expect, it } from 'vitest';
import { composeLive, emissionSource } from './compose.js';
import { armsLoadout } from '../../gameworld/arms-kit.js';
import { SHOOT } from '../../gameworld/quick.js';

// GUNPLAY (opt-in `gunplay` on the pilot's rule, gameworld/arms-kit.js): the sights come up over the arm's aim time and
// tighten its cone and slow its feet, a body moves and fires aimed; the aim sways by the arm, from the hip more, and a
// scope's breath held steadies it until the body wants air; R reloads a spent magazine; the wheel and the keys switch a
// walker's arms with the switch's ready-time; a bow's arrow flies faster the further it was drawn. Absent, nothing.

const E = composeLive();
const hooks = { ground: () => 0 };
const PERSON = { a: 0.35, c: 0.9, cz: 0.9 };
function world(arms, { type = 'walk', target = false } = {}) {
  const loadout = armsLoadout(arms, SHOOT.rifle, { eye: 1.5 });
  return E.createWorld({ entities: [
    { id: 'p', pilotable: true, rule: { type, speed: 4, eye: 0, turnMode: 'look', strafe: 1, loadout, gunplay: true }, weapon: loadout[0].weapon, body: { type: 'none' }, transform: { pos: [0, 0, 0], heading: 0, pitch: 0 } },
    ...(target ? [{ id: 't', rule: { type: 'walk', speed: 0, eye: 0 }, body: { type: 'mesh', hittable: true, hp: 1e9, egg: { ...PERSON } }, transform: { pos: [40, 0, 0], heading: Math.PI } }] : []),
  ] });
}
const run = (w, input, seconds, each) => { for (let k = 0; k < Math.round(seconds * 30); k++) { E.stepWorld(w, typeof input === 'function' ? input(k) : input, 1 / 30, hooks); each?.(k); } };
// how far the sway carries the aim off where the player put it, its widest over a while (degrees)
function swayOver(w, input, seconds) {
  const P = w.byId.p; let most = 0;
  run(w, input, seconds, () => { most = Math.max(most, Math.hypot(P.gp.sx, P.gp.sy)); });
  return most;
}

describe('gunplay', () => {
  it('the sights come up over the arm\'s aim time, tighten the cone and slow the feet; down twice as fast', () => {
    const w = world(['rifle']), P = w.byId.p, g = P.rule.loadout[0].gunplay, hipBase = P.weapon.spread.base;
    run(w, { aim: 1 }, g.ads.time / 2);
    expect(P.gp.aim).toBeGreaterThan(0.4); expect(P.gp.aim).toBeLessThan(0.6);
    run(w, { aim: 1 }, g.ads.time);
    expect(P.gp.aim).toBe(1);
    expect(P.weapon.spread.base).toBeCloseTo(hipBase * g.ads.spread, 6);
    // aimed and walking forward: the feet at the sights' pace, and it still fires on the move
    const x0 = P.transform.pos[0]; run(w, { aim: 1, forward: 1 }, 1);
    const aimed = P.transform.pos[0] - x0;
    const h = world(['rifle']), Q = h.byId.p; run(h, { forward: 1 }, 1);
    expect(aimed / Q.transform.pos[0]).toBeLessThan(0.75);
    run(w, { aim: 1, strafe: 1, fire: 1 }, 0.5);
    expect(P.weapon.shots).toBeGreaterThan(2);
    run(w, {}, g.ads.time / 2 + 1e-3);
    expect(P.gp.aim).toBe(0);
  });

  it('sway: from the hip more than aimed, on the move more than still; a scope\'s breath held steadies it, then the body wants air', () => {
    const hip = swayOver(world(['sniper']), {}, 6), aimed = swayOver(world(['sniper']), { aim: 1 }, 6), moving = swayOver(world(['sniper']), { aim: 1, forward: 1 }, 6);
    expect(hip).toBeGreaterThan(aimed * 1.5); expect(moving).toBeGreaterThan(aimed);
    const w = world(['sniper']), P = w.byId.p;
    run(w, { aim: 1 }, 1);
    const held = swayOver(w, { aim: 1, breath: 1 }, 3);
    expect(P.gp.steady).toBe(true);
    expect(held).toBeLessThan(aimed * 0.4);
    run(w, { aim: 1, breath: 1 }, 1.5);
    expect(P.gp.tired).toBeGreaterThan(0); expect(P.gp.steady).toBe(false);
    // the player's own look is kept: the sway is a wander about it, never a drift
    const w2 = world(['rifle']), P2 = w2.byId.p; run(w2, {}, 20);
    expect(Math.abs(P2.transform.heading - P2.gp.sx * Math.PI / 180)).toBeLessThan(1e-9);
  });

  it('R reloads a partly spent magazine over its reload; a full one is left', () => {
    const w = world(['handgun']), P = w.byId.p, W = P.weapon;
    run(w, (k) => ({ fire: k % 10 === 0 ? 1 : 0 }), 1);
    const spent = W.ammo; expect(spent).toBeLessThan(W.magazine);
    E.stepWorld(w, { reload: 1 }, 1 / 30, hooks);
    expect(W.reloading).toBe(true);
    run(w, {}, W.reload + 0.1);
    expect(W.ammo).toBe(W.magazine);
    E.stepWorld(w, { reload: 1 }, 1 / 30, hooks);
    expect(W.reloading).toBe(false);
  });

  it('a walker switches on the keys with each arm\'s ready-time; nothing fires till the new arm is up', () => {
    const w = world(['rifle', 'sniper']), P = w.byId.p, S = P.rule.loadout[1];
    E.stepWorld(w, { slot: 2 }, 1 / 30, hooks);
    expect(P.loadoutIdx).toBe(1); expect(P.weapon).toBe(P.loadoutWeapons[1]);
    expect(P.readyMax).toBe(S.switchReady);
    expect(S.switchReady).toBeCloseTo(S.gunplay.swap.out + S.gunplay.swap.in, 6);
    run(w, { fire: 1 }, S.switchReady * 0.8);
    expect(P.weapon.shots).toBe(0);
    E.stepWorld(w, { cycle: 1 }, 1 / 30, hooks);
    expect(P.loadoutIdx).toBe(0);
  });

  it('the bow: held, the string draws; loosed, a fuller draw flies faster and harder, and the arrow falls', () => {
    const shoot = (frames) => {
      const w = world(['bow']); run(w, (k) => ({ fire: k < frames ? 1 : 0 }), frames / 30 + 1 / 30);
      return w.projectiles[0];
    };
    const twitch = shoot(4), full = shoot(40);
    const speed = (r) => Math.hypot(...r.vel);
    expect(speed(full)).toBeGreaterThan(speed(twitch) * 2);
    expect(full.damage).toBeGreaterThan(twitch.damage);
    expect(full.gravity).toBeGreaterThan(5);
  });

  it('absent, nothing: the page\'s sim source carries the hands only when asked', () => {
    expect(emissionSource()).not.toContain('buildGunplay');
    expect(emissionSource({ gunplay: true })).toContain('function buildGunplay(E)');
  });
});
