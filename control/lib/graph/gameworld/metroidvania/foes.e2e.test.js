// The castle's foes played as its page resolves them (cast.js; foes.js hostileCast; worlds/controllable): Vampire
// Sonata's bestiary haunting its rooms region by region, each on the lane's rail with its class's mind, a stand-in block
// until its figure is made. A rat in the outer wall falls to Erina's saber string and its soul fills the trees' purse.
// Its bosses stood with them (bosses.js), each in its room: the Gate Warden cut down gives the second leap and breaks its
// seal.
import { describe, it, expect, beforeAll } from 'vitest';
import { readGameworld } from '../world.js';
import { gameStages, stageLevelOrder } from '../levels.js';
import { hostileCast } from '../foes.js';
import { resolveWorldScene } from '../../worlds/world-scene.js';
import { simLevel } from '../../game/level-sim.js';
import { faceGround, pageGroundFaces, SIM_DT } from '../../game/level-equivalence.js';
import { vampireSonataGame, VAMPIRE_SONATA_FOES } from './vampire-sonata.js';
import { FLOOR } from './rooms.js';
import { boxOf } from './scene.js';
import { bossRow } from './bosses.js';

const ZERO = { forward: 0, strafe: 0, turn: 0, jump: 0, jumpHeld: 0, boost: 0, fire: 0, heavy: 0, special: 0, mod: 0 };
let payload, order, B;
beforeAll(async () => {
  const W = readGameworld(vampireSonataGame({ heroRef: 'erina-ref' })), [stage] = gameStages(W);
  order = stageLevelOrder(W, stage, { heroRef: 'erina-ref', heroStature: 1.69, ref: 'lvl', extra: (ends) => hostileCast(W, 'castle', ends, { refs: {}, hero: true }) });
  const m = order.args.manifest;
  m.figures = {}; m.entities = m.entities.map((e) => (e.id === 'hero' ? { ...e, body: { ...e.body, type: 'none', figure: undefined } } : e));
  ({ payload } = await resolveWorldScene({ manifest: m }));
  B = boxOf(m);
}, 180000);

describe('the castle\'s foes, played', () => {
  it('haunts its rooms region by region, held to the cast\'s laws, stand-ins until their figures are made', () => {
    const foes = payload.entities.filter((e) => e.team === 'foes' && !e.id.startsWith('boss-'));
    expect(foes.length).toBeGreaterThan(20);
    expect(new Set(foes.map((e) => e.id.replace(/-\d+$/, '').replace(/^foe-/, '')))).toEqual(new Set(Object.keys(VAMPIRE_SONATA_FOES)));
    expect(foes.every((e) => e.body.type === 'mesh' && e.rule.rail)).toBe(true);
    expect(order.laws.filter((l) => l.id.startsWith('foes:') && !l.holds)).toEqual([]);
    // (no stomp: the castle refuses it)
    expect(payload.entities[0].rule.stomp).toBeUndefined();
  });

  it('a rat in the outer wall falls to her saber string, and its soul fills the trees\' purse', () => {
    const sim = simLevel({ entities: payload.entities, events: payload.events, colliders: payload.colliders, camera: payload.camera, world: payload }, { ground: faceGround(pageGroundFaces(payload.faces)) });
    const w = sim.world, H = w.byId.hero, step = (inp = {}, n = 1) => { for (let i = 0; i < n; i++) { Object.assign(sim.input, ZERO, inp); sim.frame(SIM_DT); } };
    const rat = w.entities.find((e) => e.id === 'foe-rat-1');
    // (stood a little short of it, facing it, on its floor)
    const dir = 1, floor = Math.floor(rat.transform.pos[2] / B.greybox.screen.height) * B.greybox.screen.height + FLOOR;
    H.transform.pos = [0, rat.transform.pos[1] - dir * 2.2, floor + (H.rule.eye || 0) + 0.05]; H.vel = [0, 0, 0];
    step({}, 10);
    const souls0 = w.trees.souls;
    for (let k = 0; k < 16 && !rat.downed; k++) { step({ strafe: Math.sign(rat.transform.pos[1] - H.transform.pos[1]) }, 3); step({ fire: 1 }, 2); step({}, 10); }
    expect(rat.downed).toBeTruthy();
    step({}, 2);
    expect(w.trees.souls).toBe(souls0 + 1);
  });

  it('stands each boss in its room, shuts the room behind her, puts a lost fight back whole, and the Gate Warden cut down gives the second leap', () => {
    const bosses = payload.entities.filter((e) => e.id.startsWith('boss-'));
    expect(bosses.length).toBe(B.bosses.length);
    expect(payload.breakables.some((b) => b.id.startsWith('boss-'))).toBe(false);
    for (const e of bosses) {
      const b = B.bosses.find((x) => x.id === e.id), q = payload.heldGates.bosses.find((x) => x.id === e.id);
      expect(q.entity).toBe(e.id);
      expect(e.rule.rail.a[1]).toBeGreaterThanOrEqual(q.room[0]);
      expect(e.rule.rail.b[1]).toBeLessThanOrEqual(q.room[1]);
      expect(e.body.hpBar).toBe('none');
      expect(e.rule.collideHeight).toBeCloseTo(1.69 * bossRow(b.name).tier, 2);
    }
    const sim = simLevel({ entities: payload.entities, events: payload.events, colliders: payload.colliders, camera: payload.camera, world: payload }, { ground: faceGround(pageGroundFaces(payload.faces)) });
    const w = sim.world, H = w.byId.hero, step = (inp = {}, n = 1) => { for (let i = 0; i < n; i++) { Object.assign(sim.input, ZERO, inp); sim.frame(SIM_DT); } };
    const r = B.layout.rooms.find((x) => x.boss === 'the Gate Warden'), warden = w.byId[`boss-${r.id}`];
    const seal = w.breakables.find((b) => b.id === `gate-${B.layout.doors.find((d) => d.gate === 'boss' && d.a === r.id).id}`);
    expect(H.rule.airJumps ?? 0).toBe(0);
    // (her health held full: the cut is what is measured here, not the fight's toll)
    const floor = r.rect[1] * B.greybox.screen.height + FLOOR;
    const mid = (r.rect[0] + r.rect[2] / 2) * B.greybox.screen.width;
    const placeIn = () => { H.transform.pos = [0, warden.transform.pos[1] + Math.sign(mid - warden.transform.pos[1]) * 2.4, floor + (H.rule.eye || 0) + 0.05]; H.vel = [0, 0, 0]; step({}, 10); };
    placeIn();
    // (its fight the director's: left standing, she is struck by its moves, each marked before it lands)
    // (and only the boss whose room she is in: every other keeps to its own)
    const laid = new Set(), others = new Set();
    for (let k = 0; k < 100; k++) { step({}, 1); for (const h of w.bossHazards ?? []) (h.by === warden.id ? laid : others).add(h.move); }
    expect([...laid].length).toBeGreaterThan(0);
    expect([...others]).toEqual([]);
    expect(w.bosses[warden.id].name).toBe('The Gate Warden');
    expect(H.body.hp).toBeLessThan(H.hpMax);
    H.body.hp = H.hpMax;
    // (in, the room is shut behind her while it stands: run at its way out and she is held inside)
    const G = w.heldGates, walls = () => w.colliders.filter((c) => c.of === `boss-shut:boss-${r.id}`).length;
    expect(G.fight).toBe(`boss-${r.id}`);
    expect(walls()).toBe(payload.heldGates.bosses.find((b) => b.id === `boss-${r.id}`).shut.length);
    const way = B.greybox.doorways.find((d) => d.s > r.rect[0] * B.greybox.screen.width - 0.5 && d.s < (r.rect[0] + r.rect[2]) * B.greybox.screen.width + 0.5 && Math.abs(d.z0 - floor) < 0.5);
    for (let k = 0; k < 12; k++) { H.body.hp = H.hpMax; step({ strafe: Math.sign(way.s - H.transform.pos[1]) }, 15); }
    expect(Math.abs(H.transform.pos[1] - way.s)).toBeGreaterThan(0.3);
    expect(Math.sign(H.transform.pos[1] - way.s)).toBe(Math.sign(mid - way.s));
    // (a fight lost: she wakes at her save, the room opens, and the Warden is back where it stood, whole)
    const hp0 = warden.body.hp, at0 = payload.entities.find((e) => e.id === warden.id).transform.pos;
    warden.body.hp = 40; H.body.hp = 0;
    step({}, 3);
    expect(G.fight).toBe(null);
    expect(walls()).toBe(0);
    expect(warden.body.hp).toBe(hp0);
    expect(warden.transform.pos).toEqual(at0);
    expect(G.deaths).toBe(1);
    placeIn();
    expect(G.fight).toBe(`boss-${r.id}`);
    // (closed in to a cut's reach, turned to it, the string pressed; followed as each blow knocks it back. Her cuts land
    // on it; brought to its last blow (the fight's length is the shelf's `blows`, not what is measured here), it is cut down)
    for (let k = 0; k < 400 && !warden.downed; k++) {
      H.body.hp = H.hpMax;
      const d = warden.transform.pos[1] - H.transform.pos[1];
      if (Math.abs(d) > 1.6) { step({ strafe: Math.sign(d) }, 4); continue; }
      step({ strafe: Math.sign(d) }, 1); step({ fire: 1 }, 2); step({}, 10);
      if (warden.body.hp < hp0 && warden.body.hp > 1) warden.body.hp = 1;
    }
    expect(hp0).toBe(14 * 20);
    expect(warden.downed).toBeTruthy();
    step({}, 4);
    expect(w.heldGates.held[`boss:${r.id}`]).toBeDefined();
    expect(w.heldGates.held['gate:double-jump']).toBeDefined();
    expect(H.rule.airJumps).toBe(1);
    step({}, 10);
    expect(seal.broken).toBeTruthy();
    // (felled, its room is open for good)
    expect(G.fight).toBe(null);
    expect(walls()).toBe(0);
  });
});
