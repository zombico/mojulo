// A castle of boxes played as its page resolves it (castle.js; worlds/world-scene.js, game/level-sim.js): Vampire
// Sonata's tower, courtyard and keep laid as one level on the side map's runtime. At the tower's open spire the Great
// Bell stands before the port out: its seal holds until the Bell falls to her saber string, then she walks out across
// the bell bridge into the courtyard's barbican. At the keep's gatehouse she wakes in its hall, and its Gatekeeper
// stands in the portcullis: cut down, the way into the keep is open. The hero's body is left out: the play is the rule's.
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
  const W = readGameworld(vampireSonataGame({ heroRef: 'erina-ref', castle: true })), [stage] = gameStages(W);
  const m = stageLevelOrder(W, stage, { heroRef: 'erina-ref', heroStature: 1.69, ref: 'lvl' }).args.manifest;
  m.figures = {}; m.entities = m.entities.map((e) => ({ ...e, body: { ...e.body, type: 'none', figure: undefined } }));
  ({ payload } = await resolveWorldScene({ manifest: m }));
  B = boxOf(m);
}, 180000);

function play() {
  const sim = simLevel({ entities: payload.entities, events: payload.events, colliders: payload.colliders, camera: payload.camera, world: payload }, { ground: faceGround(pageGroundFaces(payload.faces)) });
  const hero = sim.world.byId.hero, W = B.greybox.screen.width, H = B.greybox.screen.height;
  const step = (inp = {}, n = 1) => { for (let i = 0; i < n; i++) { Object.assign(sim.input, ZERO, inp); sim.frame(SIM_DT); } };
  const room = (id) => B.layout.rooms.find((r) => r.id === id);
  const place = (id, share) => { const r = room(id); hero.transform.pos = [0, r.rect[0] * W + share * r.rect[2] * W, r.rect[1] * H + FLOOR + (hero.rule.eye || 0) + 0.05]; hero.vel = [0, 0, 0]; step({}, 30); };
  const cut = (dir, n) => { step({ strafe: dir }, 3); for (let i = 0; i < n; i++) { step({ fire: 1 }, 2); step({}, 10); } };
  const s = () => hero.transform.pos[1];
  const inRoom = (id) => { const r = room(id); return s() >= r.rect[0] * W && s() <= (r.rect[0] + r.rect[2]) * W && hero.transform.pos[2] >= r.rect[1] * H && hero.transform.pos[2] <= (r.rect[1] + r.rect[3]) * H; };
  return { sim, hero, W, H, step, place, cut, s, inRoom, held: sim.world.heldGates.held, room };
}
const portOut = (box) => B.layout.doors.find((d) => d.kind === 'port' && d.a === B.layout.castle.boxes.find((b) => b.id === box).out.room);

describe('a castle of boxes, played as its page resolves it', () => {
  it('lays the castle as one level: a camera zone a room, every box and connector on the runtime', () => {
    expect(payload.camera.rule).toBe('side-map');
    expect(payload.camera.zones.length).toBe(B.layout.rooms.length);
    expect(B.layout.castle.boxes.map((b) => b.shape)).toEqual(['serpentine', 'hub', 'spiral']);
    expect(B.laws.filter((l) => !l.holds).map((l) => l.id)).toEqual([]);
    // (each connector's own saves and bosses on the runtime: the gatehouse's hall a save room, its Gatekeeper a stand-in)
    expect(payload.heldGates.saves.some((x) => x.id.startsWith('gatehouse'))).toBe(true);
    expect(payload.heldGates.bosses.some((b) => b.name.startsWith('the Gatekeeper'))).toBe(true);
  });

  it('holds the spire\'s port shut until the Great Bell falls, then walks out across the bridge to the barbican', () => {
    const d = portOut('tower'), spire = B.layout.rooms.find((r) => r.id === d.a), P = play();
    const bell = P.sim.world.breakables.find((b) => b.id === `boss-${spire.id}`), seal = P.sim.world.breakables.find((b) => b.id === `gate-${d.id}`);
    expect(d.gate).toBe('boss');
    P.place(spire.id, 0.2);
    P.step({ strafe: 1 }, 200);
    expect(P.s()).toBeLessThan(bell.min[1]);
    P.cut(1, 14);
    expect(bell.broken).toBeTruthy();
    P.step({ strafe: 1 }, 30);
    expect(seal.broken).toBeTruthy();
    const barbican = B.layout.castle.boxes.find((b) => b.id === 'court').in.room;
    for (let f = 0; f < 60 * 20 && !P.inRoom(barbican); f++) P.step({ strafe: 1 });
    expect(P.inRoom(barbican)).toBe(true);
  });

  it('wakes her in the gatehouse\'s hall, and opens the keep when its Gatekeeper is cut down', () => {
    const J = B.layout.castle.joins.find((x) => x.by === 'gatehouse'), [hall, gate] = J.rooms, d = B.layout.doors.find((x) => x.kind === 'port' && x.a === gate), P = play();
    P.place(hall, 0.5);
    expect(P.sim.world.heldGates.save).toBe(hall);
    const keeper = P.sim.world.breakables.find((b) => b.id === `boss-${gate}`), seal = P.sim.world.breakables.find((b) => b.id === `gate-${d.id}`);
    P.step({ strafe: 1 }, 240);
    expect(P.s()).toBeLessThan(keeper.min[1]);
    P.cut(1, 14);
    expect(keeper.broken).toBeTruthy();
    for (let f = 0; f < 60 * 12 && !P.inRoom(d.b); f++) P.step({ strafe: 1 });
    expect(seal.broken).toBeTruthy();
    expect(P.inRoom(d.b)).toBe(true);
  });
});
