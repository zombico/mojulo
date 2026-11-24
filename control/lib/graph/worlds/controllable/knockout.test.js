import { describe, expect, it } from 'vitest';
import { composeControllable, EMISSION, emissionSource } from './compose.js';
import { buildTakedown } from './takedown.js';
import { buildVeil } from './veil.js';
import { buildAlarm } from './alarm.js';
import { buildKnockout } from './knockout.js';

// KO AND KILL (knockout.js): a blow or a dart knocks out, a round kills; a sleeper is found and woken by a teammate that
// sees it, and dragged out of sight it is not.

// (a blow dealt inside the step, as a fist's or a gun's would be: `state.blow` { to, hurt, dealt?, head?, shot? })
function buildBlow(E) {
  const step = E.stepWorld;
  E.stepWorld = function stepWithBlow(state, input, dt, hooks) {
    const t0 = state.time, out = step(state, input, dt, hooks), B = state.blow;
    if (B) {
      state.blow = null;
      const tg = state.byId[B.to];
      tg.body.hp = Math.max(0, tg.body.hp - B.hurt); tg.lastHitBy = 'p'; tg.lastHitDmg = B.dealt ?? B.hurt; tg.lastHitHead = !!B.head;
      if (B.shot) state.byId.p.lastShot = { t: t0, targetId: B.to };
      if (tg.body.hp <= 0) tg.downed = true;
    }
    return out;
  };
}
const E = composeControllable([...EMISSION, buildTakedown, buildAlarm, buildVeil, buildBlow, buildKnockout]);
const hooks = { ground: () => 0 };
const DT = 1 / 60;
const DART = { name: 'dart gun', weapon: { fireClass: 'sight', cooldown: 1, damage: 100, stun: true, quiet: true, drowse: 2 } };
const GUN = { name: 'handgun', weapon: { fireClass: 'sight', cooldown: 0.25, damage: 25 } };
const guard = (id, pos, heading, more = {}) => ({ id, team: 'guards', rule: { type: 'ai', mind: { motivation: 'guard', perception: 'sight' }, speed: 1.5, sightRange: 14, sightCone: 0.8, eye: 0, collideHeight: 1.8, guardRadius: 0.1, ...more }, body: { type: 'mesh', hittable: true, hp: 100 }, transform: { pos, heading } });
const world = ({ at = [0, -20, 0], heading = Math.PI / 2, slot = DART, others = [], colliders = null, veils = null, takedown = null } = {}) => E.createWorld({
  ...(colliders ? { colliders } : {}), ...(veils ? { veils } : {}),
  camera: { rule: 'follow', target: 'p' },
  entities: [
    { id: 'p', pilotable: true, rule: { type: 'platform', speed: 4, eye: 0, knockout: true, loadout: [slot], ...(takedown ? { takedown } : {}) }, body: { type: 'mesh', hittable: true, hp: 100 }, transform: { pos: at, heading } },
    guard('g', [0, 0, 0], Math.PI / 2),
    ...others,
  ],
});
const run = (w, n, input = {}) => { for (let k = 0; k < n; k++) E.stepWorld(w, input, DT, hooks); return w; };
const hit = (w, B) => { w.blow = B; E.stepWorld(w, {}, DT, hooks); return w.byId[B.to]; };

describe('KO and kill', () => {
  it('is emitted only into a world that asks for it', () => {
    expect(emissionSource({})).not.toContain('stepWithKnockout');
    expect(emissionSource({ knockout: true })).toContain('stepWithKnockout');
  });

  it('a dart sleeps a body after its drowse, in the head at once; it hurts nothing', () => {
    const w = world(), g = hit(w, { to: 'g', hurt: 30, dealt: 100, shot: true });
    expect(g.body.hp).toBe(100);
    expect(g.ko).toBeFalsy(); expect(g.koDrowse).toBeTruthy();
    run(w, 60);
    expect(g.ko).toBeFalsy();                                   // 1 s in: still on its feet
    run(w, 70);
    expect(g.ko).toBeTruthy(); expect(g.downed).toBe(true); expect(g.body.hp).toBe(100);
    run(w, 60);
    expect(g.tumble.angle).toBeCloseTo(-Math.PI / 2, 5);        // on its back
    const w2 = world(), g2 = hit(w2, { to: 'g', hurt: 30, dealt: 200, head: true, shot: true });
    run(w2, 40);
    expect(g2.ko).toBeTruthy();
  });

  it('a round from a gun kills as it always did', () => {
    const w = world({ slot: GUN }), g = hit(w, { to: 'g', hurt: 100, shot: true });
    expect(g.body.hp).toBe(0); expect(g.downed).toBe(true); expect(g.ko).toBeFalsy();
    expect(w.byId.p.kills).toBe(1);
  });

  it('blows stun and give back what they hurt: a combo knocks out', () => {
    const w = world();
    let g = hit(w, { to: 'g', hurt: 1.2 });
    expect(g.body.hp).toBe(100); expect(g.koStun).toBeCloseTo(36, 6); expect(g.ko).toBeFalsy();
    g = hit(w, { to: 'g', hurt: 1.2 });
    g = hit(w, { to: 'g', hurt: 1.6 });
    expect(g.ko).toBeTruthy(); expect(g.ko.how).toBe('blow');
    expect(w.byId.p.kos).toBe(1);
  });

  it('a stun not enough to knock out is shaken off', () => {
    const w = world(), g = hit(w, { to: 'g', hurt: 1 });
    run(w, 60 * 3);
    expect(g.koStun).toBeCloseTo(30, 6);                        // (within its calm: kept)
    run(w, 60 * 5);
    expect(g.koStun).toBe(0);
  });

  it('a teammate that sees the sleeper goes to it and wakes it; both search there', () => {
    const w = world({ others: [guard('w', [-6, 0, 0], 0)] });
    hit(w, { to: 'g', hurt: 30, dealt: 200, head: true, shot: true });
    run(w, 40);
    const g = w.byId.g, wk = w.byId.w;
    expect(g.ko).toBeTruthy();
    expect(wk.koWake && wk.koWake.id).toBe('g');
    run(w, 60 * 2.5);
    expect(Math.hypot(wk.transform.pos[0], wk.transform.pos[1])).toBeLessThan(1.2);   // (beside it)
    expect(g.ko).toBeTruthy();                                  // (still asleep while it is woken)
    run(w, 60 * 3);
    expect(g.ko).toBeFalsy(); expect(g.downed).toBe(false);
    run(w, 60);
    expect(g.tumble).toBeFalsy(); expect(g.held).toBe(false);
    expect(g.lastSeen && g.lastSeen.pos[0]).toBeCloseTo(0, 1);
  });

  it('behind a wall or in tall grass, a sleeper is not found', () => {
    const walled = world({ others: [guard('w', [-6, 0, 0], 0)], colliders: [{ min: [-3, -4, 0], max: [-2.6, 4, 3] }] });
    hit(walled, { to: 'g', hurt: 30, dealt: 200, head: true, shot: true }); run(walled, 60 * 6);
    expect(walled.byId.g.ko).toBeTruthy(); expect(walled.byId.w.koWake).toBeFalsy();
    const grass = world({ others: [guard('w', [-6, 0, 0], 0)], veils: [{ at: [0, 0, 0], r: 2.5, h: 1.2 }] });
    hit(grass, { to: 'g', hurt: 30, dealt: 200, head: true, shot: true }); run(grass, 60 * 6);
    expect(grass.byId.g.ko).toBeTruthy(); expect(grass.byId.w.koWake).toBeFalsy();
  });

  it('the action takes hold of a sleeper: it trails behind, the pilot slowed; the action again lets go', () => {
    const w = world({ at: [-1, 0, 0], heading: Math.PI });
    hit(w, { to: 'g', hurt: 30, dealt: 200, head: true, shot: true }); run(w, 60);
    const p = w.byId.p, g = w.byId.g;
    expect(E.koDragTarget(w, p)).toBe(g);
    E.stepWorld(w, { act: 1 }, DT, hooks);
    expect(p.koDrag).toBe('g');
    run(w, 60, { forward: 1 });
    expect(p.transform.pos[0]).toBeGreaterThan(-2.5); expect(p.transform.pos[0]).toBeLessThan(-2.2);   // (1.4 m/s, not 4)
    expect(Math.hypot(g.transform.pos[0] - p.transform.pos[0], g.transform.pos[1] - p.transform.pos[1])).toBeCloseTo(1.1, 3);
    expect(g.ko).toBeTruthy();
    run(w, 2); E.stepWorld(w, { act: 1 }, DT, hooks);
    expect(p.koDrag).toBeFalsy(); expect(g.koDragged).toBeFalsy();
    const at = g.transform.pos.slice(); run(w, 30, { forward: 1 });
    expect(g.transform.pos).toEqual(at);
  });

  it('a body gone from where it lay when the waker gets there is searched for there', () => {
    const w = world({ others: [guard('w', [-6, 0, 0], 0)] });
    hit(w, { to: 'g', hurt: 30, dealt: 200, head: true, shot: true }); run(w, 40);
    const wk = w.byId.w, g = w.byId.g;
    expect(wk.koWake).toBeTruthy();
    g.transform.pos = [2, 7, 0];                                // (dragged off out of its cone, as the pilot would)
    let k = 0; while (wk.koWake && k++ < 60 * 6) E.stepWorld(w, {}, DT, hooks);
    expect(wk.koWake).toBeFalsy(); expect(g.ko).toBeTruthy();
    expect(Math.hypot(wk.lastSeen.pos[0], wk.lastSeen.pos[1])).toBeLessThan(0.1);   // (where it lay)
  });

  it('with the knockout, the takedown knocks out', () => {
    const w = world({ at: [0, -1.2, 0], heading: Math.PI / 2, takedown: {} });
    E.stepWorld(w, { act: 1 }, DT, hooks); run(w, 80);
    expect(w.byId.g.ko && w.byId.g.ko.how).toBe('takedown'); expect(w.byId.g.body.hp).toBe(100);
  });

  it('a dart in hand is quiet', () => {
    const w = world(); w.byId.p.weapon = w.byId.p.weapon || {};
    run(w, 1);
    expect(w.byId.p.weapon.quiet).toBe(true);
  });
});
