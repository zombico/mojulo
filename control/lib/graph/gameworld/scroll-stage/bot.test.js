// Blaze Gunner's bot (scroll-stage/bot.js) on small worlds of the scroll stage's runtime. The concepts: it steps off a
// bullet aimed at it, where a ship that holds still is hit; it does not fly into a hull's outline in its way; among safe
// choices it lines up with the foe ahead; with the live slot empty and a pod in the other, it switches to it.
import { describe, it, expect } from 'vitest';
import { composeLive } from '../../worlds/controllable/compose.js';
import { scrollCamera } from './frame.js';
import { lowerFoes } from './patterns.js';
import { lowerArsenal, POD_IDS } from './pods.js';
import { botInput } from './bot.js';

const E = composeLive(), DT = 1 / 30, LEN = 12, C = scrollCamera(LEN), SA = C.screen.along, SC = C.screen.across;
const FS = lowerFoes([], { L: LEN, S: SC }), ARS = lowerArsenal(POD_IDS.slice(0, 2), { L: LEN, S: SC });
const world = ({ foes = [], at = [-SA / 4, 0] } = {}) => E.createWorld({
  entities: [{ id: 'player', pilotable: true, rule: { type: 'scroll-ship', size: [LEN, 4], at, hitbox: { r: FS.hitbox, at: 0 }, invuln: 1, arsenal: ARS }, body: { type: 'none', hp: 10 }, transform: { pos: [0, 0, 0] } }, ...foes],
  camera: { rule: 'scroll', target: 'player', view: 'side', dist: C.dist, screen: [SA, SC], track: [] }, pilot: 'player',
});
const ship = (w) => w.byId.player;
// (a bullet from ahead, aimed square at the ship's hitbox)
const aimed = (w) => { const h = ship(w).screenAt; return { u: h[0] + SA * 0.35, v: h[1], du: -SC * 0.4, dv: 0, r: 0.9, dmg: 1, t: 0, hue: '#ff3fa4' }; };

describe('the bot', () => {
  it('steps off a bullet aimed at it, where a ship that holds still is hit', () => {
    for (const drive of [true, false]) {
      const w = world();
      E.stepWorld(w, {}, DT);
      w.foeShots = [aimed(w)];
      for (let i = 0; i < 90; i++) E.stepWorld(w, drive ? { ...botInput(w), fire: 0 } : {}, DT);
      expect(ship(w).hitsTaken || 0).toBe(drive ? 0 : 1);
    }
  });

  it('does not fly into a hull\'s outline in its way', () => {
    const w = world();
    E.stepWorld(w, {}, DT);
    const h = ship(w).screenAt;
    // (a block from just under the ship to the bottom of the screen, reaching back over it: up is the only way clear)
    w.breakables = [{ id: 'h/b', min: [-30, h[0] - SA / 2, -SC], max: [0, h[0] + SA, h[1] - FS.hitbox - 1.2], broken: null }];
    for (let i = 0; i < 60; i++) E.stepWorld(w, { ...botInput(w), fire: 0 }, DT);
    expect(ship(w).hitsTaken || 0).toBe(0);
  });

  it('lines up with the foe ahead when nothing threatens it', () => {
    const w = world({ foes: [{ id: 'f', team: 'foes', rule: { type: 'static' }, body: { type: 'none', hp: 99, radius: 2 }, transform: { pos: [0, SA * 0.25, SC * 0.3] } }] });
    for (let i = 0; i < 90; i++) E.stepWorld(w, { ...botInput(w), fire: 0 }, DT);
    expect(Math.abs(ship(w).screenAt[1] - SC * 0.3)).toBeLessThan(2);
  });

  it('switches to a pod in the other slot when the live one is empty', () => {
    const w = world();
    E.stepWorld(w, {}, DT);
    ship(w).slots = [null, { id: POD_IDS[0], ammo: 50 }];
    E.stepWorld(w, botInput(w), DT);
    expect(ship(w).live).toBe(1);
  });
});
