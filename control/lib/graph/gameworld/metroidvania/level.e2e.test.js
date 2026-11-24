// A metroidvania level played as its page resolves it (worlds/world-scene.js, game/level-sim.js: its world, its held
// gates and its camera on the page's own ground). Erina's castle, Vampire Sonata: the hero walks the castle's floor
// room to room under the side map's camera to the outer wall's key; a lock holds until she has it; the Gate Warden's
// stand-in falls to her saber string, its seal breaks (and is no ground: she drops through) and the second leap is hers
// (the double jump's move); the sill
// into the halls is cleared by the second jump and never by one; the cracked wall stands every cut until the ram strike
// is held. The hero's body is left out (no stored hero here): the play is the rule's, not the figure's.
import { describe, it, expect, beforeAll } from 'vitest';
import { readGameworld } from '../world.js';
import { gameStages, stageLevelOrder } from '../levels.js';
import { resolveWorldScene } from '../../worlds/world-scene.js';
import { simLevel } from '../../game/level-sim.js';
import { faceGround, pageGroundFaces, SIM_DT } from '../../game/level-equivalence.js';
import { vampireSonataGame } from './vampire-sonata.js';
import { boxOf } from './scene.js';
import { FLOOR } from './rooms.js';

const ZERO = { forward: 0, strafe: 0, turn: 0, jump: 0, jumpHeld: 0, boost: 0, fire: 0 };
let payload, B;
beforeAll(async () => {
  const W = readGameworld(vampireSonataGame({ heroRef: 'erina-ref' })), [stage] = gameStages(W);
  const m = stageLevelOrder(W, stage, { heroRef: 'erina-ref', heroStature: 1.69, ref: 'lvl' }).args.manifest;
  m.figures = {}; m.entities = m.entities.map((e) => ({ ...e, body: { ...e.body, type: 'none', figure: undefined } }));
  ({ payload } = await resolveWorldScene({ manifest: m }));
  B = boxOf(m);
}, 120000);

function play() {
  const sim = simLevel({ entities: payload.entities, events: payload.events, colliders: payload.colliders, camera: payload.camera, world: payload }, { ground: faceGround(pageGroundFaces(payload.faces)) });
  const hero = sim.world.byId.hero, W = B.greybox.screen.width, H = B.greybox.screen.height;
  const step = (inp = {}, n = 1) => { for (let i = 0; i < n; i++) { Object.assign(sim.input, ZERO, inp); sim.frame(SIM_DT); } };
  const room = (id) => B.layout.rooms.find((r) => r.id === id);
  // stand the hero in a room at a share across it, on its floor, and let it settle
  const place = (id, share) => { const r = room(id); hero.transform.pos = [0, r.rect[0] * W + share * r.rect[2] * W, r.rect[1] * H + FLOOR + (hero.rule.eye || 0) + 0.05]; hero.vel = [0, 0, 0]; step({}, 30); };
  // the saber string pressed at what is `dir` of her: turned to it, then the press and the release, over and over
  const cut = (dir, n) => { step({ strafe: dir }, 3); for (let i = 0; i < n; i++) { step({ fire: 1 }, 2); step({}, 10); } };
  const gate = (door) => sim.world.breakables.find((b) => b.id === `gate-${door}`);
  const s = () => hero.transform.pos[1];
  return { sim, hero, W, H, step, place, cut, gate, s, held: sim.world.heldGates.held, room };
}
const doorOf = (pred) => B.layout.doors.find(pred);

describe('a metroidvania level, played as its page resolves it', () => {
  it('lays the castle on the side map\'s runtime: a camera zone a room, the gates held, what is picked up', () => {
    expect(payload.camera.rule).toBe('side-map');
    expect(payload.camera.zones.length).toBe(B.layout.rooms.length);
    expect(payload.heldGates.gates.map((g) => g.kind).sort()).toEqual(expect.arrayContaining(['boss', 'form', 'key', 'wall-break']));
    expect(payload.breakables.length).toBe(payload.heldGates.gates.length + payload.heldGates.bosses.length);
    expect(payload.entities[0].rule.strike).toBe('melee');
    expect(payload.entities[0].rule.cling).toBeUndefined();
  });

  it('plays an action RPG\'s vitals, never lives: health and MP, a save room fills her, her death a waking there', () => {
    expect(payload.game.mechanics.some((m) => m.kind === 'lives')).toBe(false);
    const P = play(), H = P.hero, hall = B.layout.rooms.find((r) => r.save && r.ring === 1);
    expect(H.body.hp).toBeGreaterThan(0); expect(H.hpMax).toBe(H.body.hp);
    expect(H.rule.moveset.mp.max).toBeGreaterThan(0);
    // (stood in the halls' save room: she is full, and wakes there from now on)
    H.body.hp = 5;
    P.place(hall.id, 0.5);
    expect(P.sim.world.heldGates.save).toBe(hall.id);
    expect(H.body.hp).toBe(H.hpMax);
    // (elsewhere, holding a key, her health spent: she wakes in the halls' save room, full, the key still hers)
    P.held['key:0'] = P.sim.world.time;
    P.place(B.layout.rooms.find((r) => r.ring === 0 && r.kind === 'corridor').id, 0.5);
    H.body.hp = 0;
    P.step({}, 30);
    expect(P.room(hall.id).rect[0] * P.W <= P.s() && P.s() <= (P.room(hall.id).rect[0] + 1) * P.W).toBe(true);
    expect(H.body.hp).toBe(H.hpMax);
    expect(P.sim.world.heldGates.deaths).toBe(1);
    expect(P.held['key:0']).toBeDefined();
  });

  it('walks the castle\'s floor room to room under the side map\'s camera to the outer wall\'s key', () => {
    const P = play();
    const zones = new Set();
    for (let i = 0; i < 60 * 40 && P.held['key:0'] == null; i++) { P.step({ strafe: 1 }); zones.add(P.sim.world.camera._zoneAt); }
    expect(P.held['key:0']).toBeDefined();
    expect([...zones].length).toBeGreaterThanOrEqual(5);
    expect(P.sim.world.sideFalls ?? 0).toBe(0);
  });

  it('holds the lock until the key is held, then opens it as she comes to it', () => {
    const d = doorOf((x) => x.gate === 'key'), P = play(), g = P.gate(d.id);
    P.place(d.a, 0.6);
    P.step({ strafe: -1 }, 240);
    expect(g.broken).toBeFalsy();
    expect(P.s()).toBeGreaterThan(g.max[1]);
    P.held['key:0'] = P.sim.world.time;
    P.step({ strafe: -1 }, 240);
    expect(g.broken).toBeTruthy();
    expect(P.s()).toBeLessThan(g.min[1]);
  });

  it('cuts the Gate Warden down with the saber string: its seal breaks and the second leap is hers', () => {
    const r = B.layout.rooms.find((x) => x.boss === 'the Gate Warden'), P = play(), seal = P.gate(doorOf((x) => x.gate === 'boss' && x.a === r.id).id);
    const boss = P.sim.world.breakables.find((b) => b.id === `boss-${r.id}`);
    expect(P.hero.rule.airJumps ?? 0).toBe(0);
    P.place(r.id, 0.5);
    const dir = Math.sign((boss.min[1] + boss.max[1]) / 2 - P.s());
    P.step({ strafe: dir }, 40);
    P.cut(dir, 12);
    expect(boss.broken).toBeTruthy();
    expect(P.held[`boss:${r.id}`]).toBeDefined();
    expect(P.held['gate:double-jump']).toBeDefined();
    expect(P.hero.rule.airJumps).toBe(1);
    P.step({}, 10);
    expect(seal.broken).toBeTruthy();
    // (gone, the seal is no ground: she drops through the hole it held, onto the top of the shaft's stair under it)
    const hole = (seal.min[1] + seal.max[1]) / 2, floor = r.rect[1] * P.H + FLOOR;
    for (let f = 0; f < 360 && P.hero.transform.pos[2] > floor - 1; f++) P.step({ strafe: Math.sign(hole - P.s()) * (Math.abs(hole - P.s()) > 0.3 ? 1 : 0) });
    expect(P.hero.transform.pos[2]).toBeLessThan(floor - 1);
  });

  it('clears the sill into the great halls on the second jump, and never on one', () => {
    const d = doorOf((x) => x.kind === 'step' && x.gate === 'double-jump'), wall = Math.max(d.cells[0][0], d.cells[1][0]);
    const tryIt = (second) => {
      const P = play(), edge = wall * P.W;
      if (second) P.hero.rule.airJumps = 1;
      P.place(d.a, 0.93);
      for (let f = 0; f < 240; f++) {
        const up = P.hero.vel[2], press = f === 30 || (second && f > 30 && !P.hero.grounded && up < 0.5 && (P.hero.airJumpsUsed ?? 0) < 1);
        P.step({ strafe: 1, jump: press ? 1 : 0, jumpHeld: 1 });
      }
      return P.s() > edge;
    };
    expect(tryIt(false)).toBe(false);
    expect(tryIt(true)).toBe(true);
  });

  it('keeps the cracked wall standing every cut until the ram strike is held, then cuts it down', () => {
    const d = doorOf((x) => x.kind === 'step' && x.gate === 'wall-break'), P = play(), g = P.gate(d.id);
    P.place(d.a, 0.95);
    P.step({ strafe: 1 }, 30);
    P.cut(1, 8);
    expect(g.broken).toBeFalsy();
    P.held['gate:wall-break'] = P.sim.world.time;
    P.step({}, 2);
    P.cut(1, 8);
    expect(g.broken).toBeTruthy();
  });
});
