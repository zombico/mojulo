// A side map level played as its page resolves it (worlds/world-scene.js, game/level-sim.js: its world and its bus on
// the page's own ground). The concepts: the bot plays Galaxy Boy's first level to its goal (the bus hears it reached)
// without losing a life, and with its foes stood shoots its way through them, and with its boss stood in the last room
// brings it down, its fall the level's end; Zero Boy does the same with his saber's string; a frame that rises faster than the hero climbs costs a life on the bus, and the hero is back at
// the zone's checkpoint. The hero's body is left out (no stored hero here): the play is the rule's, not the figure's.
import { describe, it, expect } from 'vitest';
import { platformerGame } from '../platformer-game.js';
import { gameStages, stageLevelOrder } from '../levels.js';
import { resolveWorldScene } from '../../worlds/world-scene.js';
import { simLevel } from '../../game/level-sim.js';
import { faceGround, pageGroundFaces, SIM_DT } from '../../game/level-equivalence.js';
import { sideMapOf } from './scene.js';
import { playSideMap } from './bot.js';
import { hostileCast } from '../foes.js';
import { readGameworld } from '../world.js';
import { sideMapBossCast } from './boss-cast.js';
import { composeExtras } from '../stage-figures.js';

const ZERO = { forward: 0, strafe: 0, turn: 0, jump: 0, jumpHeld: 0, boost: 0, fire: 0 };
async function played(edit = (m) => m, { foes = false, boss = false, hero } = {}) {
  const W = readGameworld({ id: 'gb', name: 'Galaxy Boy', ...platformerGame({ pole: 'galaxy-boy', ...(hero ? { hero } : {}) }).words }), [stage] = gameStages(W);
  // (`foes`: the level's foes stood by the runner's foe cast, cast.js; their figures left out as the hero's is)
  const cast = foes ? (ends) => hostileCast(W, stage.level, ends, { refs: Object.fromEntries(Object.keys(W.foes).map((k) => [k, `gb-foes-${k}`])), hero: true }) : null;
  // (`boss`: the chain's boss stood in its last room by the runner's boss cast, boss-cast.js)
  const bossCast = boss ? (ends) => sideMapBossCast(W, ends, { refs: { [W.levels.first.sidemap.boss]: 'gb-foe-boss' }, stature: 1.67 }) : null;
  const extra = composeExtras(cast, bossCast);
  const m = edit(stageLevelOrder(W, stage, { heroRef: 'hero-ref', heroStature: 1.67, ref: 'lvl', ...(extra ? { extra } : {}) }).args.manifest);
  m.figures = {}; m.entities = m.entities.map((e, i) => (i === 0 ? { ...e, body: { type: 'none' } } : e.team === 'foes' ? { ...e, body: { ...e.body, type: 'none' } } : e));
  const { payload } = await resolveWorldScene({ manifest: m });
  const sim = simLevel({ entities: payload.entities, events: payload.events, colliders: payload.colliders, camera: payload.camera, world: payload }, { ground: faceGround(pageGroundFaces(payload.faces)) });
  return { m, sim, M: sideMapOf(m) };
}
const drive = (sim) => ({ world: sim.world, dt: SIM_DT, step: (inp) => { Object.assign(sim.input, ZERO, inp); sim.frame(SIM_DT); } });

describe('a side map level, played as its page resolves it', () => {
  it('the bot plays Galaxy Boy\'s first level to its goal without losing a life', async () => {
    const { sim, M } = await played();
    const R = playSideMap(M.layout, M.reach, { stature: 1.67, seconds: 240, drive: drive(sim) });
    for (let i = 0; i < 6; i++) sim.frame(SIM_DT);
    expect(R).toMatchObject({ done: true, falls: 0 });
    expect(sim.bus.log.some((e) => e.type === 'goal:reached')).toBe(true);
    expect(sim.bus.vars.lives).toBe(3);
  }, 60000);
  it('with its foes, the bot shoots its way through to the goal', async () => {
    const { sim, M } = await played((m) => m, { foes: true });
    expect(sim.world.entities.filter((e) => e.team === 'foes').length).toBe(M.layout.spawners.length);
    const R = playSideMap(M.layout, M.reach, { stature: 1.67, seconds: 240, drive: drive(sim) });
    for (let i = 0; i < 6; i++) sim.frame(SIM_DT);
    expect(R.done).toBe(true);
    expect(R.downed).toBeGreaterThan(0);
    expect(sim.bus.log.some((e) => e.type === 'goal:reached')).toBe(true);
    expect(sim.bus.vars.lives).toBeGreaterThan(0);
  }, 90000);
  it('with its boss in the last room, the bot brings it down: its fall the level\'s end', async () => {
    const { sim, M } = await played((m) => m, { foes: true, boss: true });
    const B = sim.world.entities.find((e) => e.id.startsWith('boss-'));
    expect(B).toBeDefined();
    const R = playSideMap(M.layout, M.reach, { stature: 1.67, seconds: 300, drive: drive(sim) });
    for (let i = 0; i < 6; i++) sim.frame(SIM_DT);
    expect(B.gone || B.downed || B.body.hp <= 0).toBe(true);
    // (the defeat-all's own ending, in place of the far side's reach)
    expect(sim.bus.log.some((e) => e.type === 'all:defeated')).toBe(true);
    expect(sim.bus.log.some((e) => e.type === 'goal:reached')).toBe(false);
    expect(sim.bus.vars.lives).toBeGreaterThan(0);
    // (its health the HUD's bar, run down to none by the hits; never a bar over its head)
    const bar = Object.keys(sim.bus.vars).find((k) => k.startsWith('boss_'));
    expect(sim.bus.vars[bar]).toBe(0);
    expect(B.body.hpBar).toBe('none');
  }, 120000);
  it('Zero Boy, his saber\'s string in place of the buster, in place, cuts his way through the foes', async () => {
    const { sim, M } = await played((m) => m, { foes: true, hero: 'zero-boy' });
    const H = sim.world.byId.hero;
    expect(H.rule.buster).toBeUndefined();
    // (the string's three cuts on the ground, and the air cut)
    expect(Object.keys(H.rule.moveset.moves).length).toBe(4);
    expect(H.rule.moveset.airTree.L.move).toBe('saber-air');
    // (the string in place: not one of its cuts travels)
    expect(Object.values(H.rule.moveset.moves).every((m) => m.travel == null)).toBe(true);
    const R = playSideMap(M.layout, M.reach, { stature: 1.67, seconds: 240, drive: drive(sim) });
    expect(R.downed).toBeGreaterThan(1);
  }, 120000);
  it('Zero Boy brings the boss down with his string, its fall the level\'s end', async () => {
    const { sim, M } = await played((m) => m, { boss: true, hero: 'zero-boy' });
    const B = sim.world.entities.find((e) => e.id.startsWith('boss-'));
    playSideMap(M.layout, M.reach, { stature: 1.67, seconds: 300, drive: drive(sim) });
    for (let i = 0; i < 6; i++) sim.frame(SIM_DT);
    expect(B.gone || B.downed || B.body.hp <= 0).toBe(true);
    expect(sim.bus.log.some((e) => e.type === 'all:defeated')).toBe(true);
    expect(sim.bus.vars.lives).toBeGreaterThan(0);
  }, 120000);
  it('a frame rising faster than the hero climbs costs a life on the bus', async () => {
    const { sim, M } = await played((m) => ({ ...m, camera: { ...m.camera, zones: m.camera.zones.map((z) => (z.rise ? { ...z, rise: z.rise * 5 } : z)) } }));
    const R = playSideMap(M.layout, M.reach, { stature: 1.67, seconds: 90, drive: drive(sim) });
    expect(R.falls).toBeGreaterThan(0);
    expect(sim.bus.vars.lives).toBeLessThan(3);
  }, 60000);
});
