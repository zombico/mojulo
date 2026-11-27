// A castle of boxes played a SEGMENT a page (castle.js segmentsOf; levels.js mapPlan, the megaworld's chain): Vampire
// Sonata's tower, courtyard and keep each its own level, the ways between them the doors the connectors cross by. The
// tower's page holds the tower and its bridge alone; walked to the door at the bridge's end, she takes the way on; come
// into the courtyard by it, she stands inside that door; and what she gained in the tower (a boss felled, the rooms
// walked) is carried into the courtyard as it stood (the journey: worlds/controllable/held-gates.js carryIn).
import { describe, it, expect, beforeAll } from 'vitest';
import { readGameworld } from '../world.js';
import { gameStages, stageLevelOrder, mapPlan, gameStore } from '../levels.js';
import { stampMegaworld } from '../megaworld.js';
import { resolveWorldScene } from '../../worlds/world-scene.js';
import { composeLive } from '../../worlds/controllable/compose.js';
import { simLevel } from '../../game/level-sim.js';
import { faceGround, pageGroundFaces, SIM_DT } from '../../game/level-equivalence.js';
import { vampireSonataGame } from './vampire-sonata.js';
import { boxOf } from './scene.js';
import { JOURNEY_SLICE } from './level.js';

const ZERO = { forward: 0, strafe: 0, turn: 0, jump: 0, jumpHeld: 0, boost: 0, fire: 0 };
const E = composeLive();
let W, stages, refs, plan;
const page = {};
async function pageOf(i) {
  const m = stageLevelOrder(W, stages[i], { heroRef: 'erina-ref', heroStature: 1.69, ref: refs[i], map: plan[i] }).args.manifest;
  m.figures = {}; m.entities = m.entities.map((e) => ({ ...e, body: { ...e.body, type: 'none', figure: undefined } }));
  const { payload } = await resolveWorldScene({ manifest: m });
  return { manifest: m, payload, B: boxOf(m) };
}
beforeAll(async () => {
  W = readGameworld(stampMegaworld(vampireSonataGame({ heroRef: 'erina-ref', castle: 'segments' })));
  stages = gameStages(W); refs = stages.map((s) => `vs-${s.level}`); plan = mapPlan(W, stages, refs);
  page.tower = await pageOf(0);
  page.court = await pageOf(1);
}, 300000);

function play({ payload }) {
  const sim = simLevel({ entities: payload.entities, events: payload.events, colliders: payload.colliders, camera: payload.camera, world: payload }, { ground: faceGround(pageGroundFaces(payload.faces)) });
  const hero = sim.world.byId.hero;
  const step = (inp = {}, n = 1, events) => { for (let i = 0; i < n; i++) { Object.assign(sim.input, ZERO, inp); sim.frame(SIM_DT, i === 0 ? events : undefined); } };
  return { sim, hero, step };
}

describe('a castle played a segment a page, its maps joined by the megaworld', () => {
  it('reads as three levels on a chain, each a box of the castle, its ways naming the segment they lead to', () => {
    expect(stages.map((s) => s.manifest.segment)).toEqual(['tower', 'court', 'keep']);
    expect(W.topology).toBe('interconnected');
    expect(plan[1].on.map((w) => w.segment)).toEqual(['keep']);
    expect(plan[1].back.map((w) => w.segment)).toEqual(['tower']);
    expect(gameStore(vampireSonataGame({ heroRef: 'erina-ref', castle: 'segments' })).slices.some((s) => s.name === JOURNEY_SLICE && s.kind === 'flags')).toBe(true);
  });

  it('cuts each page to its own columns: its faces, its camera\'s rooms, its gains, what lies beyond named and never laid', () => {
    const { payload, B } = page.tower, [c0, c1] = payload.segment.cols, Wd = B.greybox.screen.width;
    expect(payload.segment.id).toBe('tower');
    expect(payload.faces.every((f) => { const ss = f.corners.map((q) => q[1]); return Math.max(...ss) >= c0 * Wd - 1e-6 && Math.min(...ss) <= (c1 + 1) * Wd + 1e-6; })).toBe(true);
    expect(payload.faces.length).toBeLessThan(page.court.payload.faces.length * 2);
    expect(payload.camera.zones.length).toBe(B.segment.rooms.filter((r) => B.layout.walk.includes(r)).length);
    expect(payload.heldGates.relics.every((r) => r.at[1] <= (c1 + 1) * Wd)).toBe(true);
    // (the keep's throne is not this page's: its goal is the way on)
    expect(payload.game.mechanics.filter((m) => m.kind === 'reach-exit').map((m) => m.exit)).toEqual(['on']);
    expect(payload.heldGates.elsewhere.map((x) => x.id)).toContain('boss-keep-throne-1');
    // (the explored map stays the castle's whole: the pause map shows every segment)
    expect(payload.explored.tiles.length).toBeGreaterThan(page.court.payload.explored.tiles.length / 2);
    expect(payload.explored.tiles).toEqual(page.court.payload.explored.tiles);
  });

  it('takes the way on at the door the bridge crosses into the courtyard by', () => {
    const P = play(page.tower), exit = page.tower.payload.game.mechanics.find((m) => m.exit === 'on');
    const [, sIn, zIn] = page.court.payload.game.mechanics && page.tower.manifest.events.reactions.find((r) => r.on === 'arrive:vs-court').to;
    P.hero.transform.pos = [0, sIn, zIn + (P.hero.rule.eye || 0)]; P.hero.vel = [0, 0, 0];
    P.step({}, 20);
    expect(P.sim.bus.log.some((e) => e.type === 'goal:reached:on')).toBe(false);
    P.step({ strafe: Math.sign(exit.at[1] - sIn) }, 120);
    expect(P.sim.bus.log.some((e) => e.type === 'goal:reached:on')).toBe(true);
  });

  it('stands her inside the courtyard\'s far door when she comes back in from the keep', () => {
    const P = play(page.court), to = page.court.manifest.events.reactions.find((r) => r.on === 'arrive:vs-keep').to;
    P.step({}, 2);
    expect(Math.abs(P.hero.transform.pos[1] - to[1])).toBeGreaterThan(1);
    P.step({}, 30, [{ type: 'arrive:vs-keep' }]);
    expect(Math.abs(P.hero.transform.pos[1] - to[1])).toBeLessThan(1);
    // (on her feet there, clear of the way out to the keep she came by)
    const back = page.court.payload.game.mechanics.find((m) => m.exit === 'on');
    expect(Math.abs(P.hero.transform.pos[1] - back.at[1])).toBeGreaterThan(back.radius);
  });

  it('raises the rooms she walks as the journey, and carries the tower\'s gains into the courtyard as they stood', () => {
    const P = play(page.tower);
    P.step({ strafe: 1 }, 90);
    const raised = P.sim.bus.log.map((e) => e.type).filter((t) => t.startsWith('journey:'));
    expect(raised.some((t) => t.startsWith('journey:seen:'))).toBe(true);
    // (the tower's belfry felled and its rooms walked, carried into the courtyard's page)
    const C = play(page.court), bell = page.tower.payload.heldGates.bosses.find((b) => b.id.includes('belfry'));
    const n = E.carryIn(C.sim.world, [`journey:felled:${bell.id}`, ...raised]);
    expect(n).toBeGreaterThan(1);
    for (const k of bell.gives) expect(C.sim.world.heldGates.held[k]).toBeDefined();
    const seen = raised.find((t) => t.startsWith('journey:seen:')).slice('journey:seen:'.length);
    expect(C.sim.world.explored.visited[seen]).toBeDefined();
    expect(C.sim.world.heldGates.got).toEqual([]);
  });
});
