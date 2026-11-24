// The castle's foes played as its page resolves them (cast.js; foes.js hostileCast; worlds/controllable): Vampire
// Sonata's bestiary haunting its rooms region by region, each on the lane's rail with its class's mind, a stand-in block
// until its figure is made. A rat in the outer wall falls to Erina's saber string and its soul fills the trees' purse.
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
    const foes = payload.entities.filter((e) => e.team === 'foes');
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
});
