// The scroll stage, built (scroll-stage/stage-scene.js, an airspace's `scroll`). The concepts: the ship sets the screen
// (its length off the craft shelf's measures at the frame's share); a track is written in screens and played in metres;
// the play plane holds the ship alone (every layer and hull stands off it); a level flies the ship's airframe, a bare
// page a slab; the airspace hands a scroll stage its own reader and builder, and refuses its words teaching.
import { describe, it, expect } from 'vitest';
import { readScrollStage, scrollStageOf, scrollStagePlay, assembleScrollStage, SCROLL_PACE, HULL_DEPTH, TARGET_HP, SHIP_HP } from './stage-scene.js';
import { POD_IDS, PODS } from './pods.js';
import { SCROLL_FRAME, toScreen } from './frame.js';
import { validateAirspace, assembleAirspace } from '../../skyscape/airspace.js';
import { CAPITAL_CLASSES } from '../../fleet/classes.js';

// (the smallest capital, chosen from the classes, so a hull is built cheaply)
const small = Object.keys(CAPITAL_CLASSES).sort((a, b) => (CAPITAL_CLASSES[a].length ?? 1e9) - (CAPITAL_CLASSES[b].length ?? 1e9))[0];
const stage = (scroll = {}) => ({ kind: 'airspace', scroll: { layers: ['near'], backdrop: false, ...scroll } });

describe('the scroll stage', () => {
  it('the ship sets the screen: its length the frame\'s share across', () => {
    const G = scrollStageOf(stage());
    expect(G.ship.length / G.cam.screen.across).toBeCloseTo(SCROLL_FRAME.shipShare, 2);
  });

  it('a track is written in screens and played in metres, at the stage\'s pace where a leg names none', () => {
    const G = scrollStageOf(stage({ track: [{ by: [2, 0] }, { hold: 3 }, { by: [0, 1], pace: 0.2 }], start: [1, 0] }));
    const A = G.cam.screen.along, C = G.cam.screen.across;
    expect(G.track[0].by[0]).toBeCloseTo(2 * A, 1);
    expect(G.track[0].pace).toBeCloseTo(SCROLL_PACE * A, 1);
    expect(G.track[1]).toEqual({ hold: 3 });
    expect(G.track[2].by[1]).toBeCloseTo(C, 1);
    expect(G.start[0]).toBeCloseTo(A, 1);
    expect(G.extent.u[1]).toBeCloseTo(3 * A, 1);
    expect(G.extent.v[1]).toBeCloseTo(C, 1);
  });

  it('the play plane holds the ship alone: every layer and hull stands off it', () => {
    const P = assembleScrollStage(stage({ layers: ['dust', 'near'], hulls: [{ capital: small, at: 1 }] }));
    expect(P.faces.length).toBeGreaterThan(0);
    for (const f of P.faces) for (const p of f.corners) expect(Math.abs(toScreen('side', p)[2])).toBeGreaterThan(1);
    const hull = P.faces.filter((f) => f.group.startsWith('break:'));
    expect(hull.length).toBeGreaterThan(0);
    const d = hull.flatMap((f) => f.corners.map((p) => toScreen('side', p)[2]));
    expect(Math.max(...d)).toBeLessThan(0);
    expect((Math.min(...d) + Math.max(...d)) / 2).toBeCloseTo(HULL_DEPTH * P.camera.dist, -1);
    // (plated as Rebel Storm's fleet is: each block's kibble for the page's hull kibble; the bloom on)
    expect(Object.keys(P.kibble.blocks).every((id) => id.startsWith('hull-0/'))).toBe(true);
    expect(P.finish.bloom).toBeTruthy();
  });

  it('a level flies the ship\'s airframe; a bare page a slab', () => {
    const play = scrollStagePlay(stage()), P = assembleScrollStage(stage());
    expect(play.entities[0].body).toMatchObject({ type: 'figure-rig', figure: 'craft', hp: SHIP_HP });
    expect(play.figures.craft.craft.archetype).toBe(scrollStageOf(stage()).ship.craft);
    expect(P.entities[0].body.type).toBe('mesh');
    expect(P.figures).toBeUndefined();
    expect(P.camera).toMatchObject({ rule: 'scroll', target: 'player', view: 'side' });
    expect(P.entities[0].rule.type).toBe('scroll-ship');
  });

  it('the ship carries the stage\'s arsenal, only the pods it names; its targets stand as foes, a carrier in its pod\'s hue', () => {
    const [p0, p1] = POD_IDS, play = scrollStagePlay(stage({ pods: [p0], targets: [{ at: [0.5, 0.1], carries: p0 }, { at: [0.8, -0.1], hp: 9 }] }));
    const ship = play.entities[0], [a, b] = play.entities.slice(1);
    expect(Object.keys(ship.rule.arsenal.pods)).toEqual([p0]);
    expect(ship.rule.arsenal.pods[p1]).toBeUndefined();
    expect(a).toMatchObject({ team: 'foes', rule: { carries: p0 }, body: { hp: TARGET_HP, color: PODS[p0].hue } });
    expect(b.body.hp).toBe(9);
    expect(Math.abs(toScreen('side', a.transform.pos)[2])).toBeLessThan(1e-9);
  });

  it('a wave comes in as its foes, each waiting at its place in the formation, flying its craft, the last bringing its pod', () => {
    const play = scrollStagePlay(stage({ waves: [{ at: 1, foe: 'drone', count: 3, formation: 'column', carries: POD_IDS[0] }] }));
    const foes = play.entities.filter((e) => e.rule.type === 'scroll-foe'), A = scrollStageOf(stage()).cam.screen.along;
    expect(foes.length).toBe(3);
    for (const f of foes) expect(f.rule.enter).toBeCloseTo(A, 1);                            // a column comes in together
    expect(new Set(foes.map((f) => f.rule.v)).size).toBe(3);                                  // side by side across
    expect(foes.map((f) => f.rule.carries ?? null)).toEqual([null, null, POD_IDS[0]]);
    expect(play.figures['foe-drone'].craft.archetype).toBeTruthy();
    expect(foes[0].body).toMatchObject({ type: 'figure-rig', figure: 'foe-drone' });
    expect(foes[0].team).toBe('foes');
    expect(play.entities[0].rule.hitbox.r).toBeLessThan(play.entities[0].rule.size[0] / 8);  // a core, far smaller than the ship
    expect(readScrollStage({ waves: [{ at: 1, foe: 'kraken' }] }).join(' ')).toMatch(/is a foe/);
  });

  it('a hull on the play plane is Rebel Storm\'s procedural enemy: its near face the plane, its systems the targets, its guns turrets, breakable in zero g', () => {
    const M = stage({ hulls: [{ capital: small, at: 1, depth: 0 }] }), G = scrollStageOf(M), P = assembleScrollStage(M), play = scrollStagePlay(M);
    const near = Math.max(...G.plane[0].P.blocks.map((b) => b.max[0]));
    expect(near).toBeCloseTo(0, 6);                                                            // the whole hull behind the plane
    expect(P.physicalFleet[0].id).toBe('hull-0');
    const hull = play.entities.find((e) => e.id === 'hull-0'), sys = play.entities.filter((e) => hull.structure.systems.includes(e.id));
    expect(hull.body.hittable).toBe(false);
    expect(sys.length).toBeGreaterThan(0);
    for (const y of sys) expect(y).toMatchObject({ team: 'foes', body: { hittable: true } });
    for (const y of sys) expect(G.plane[0].P.blocks.map((b) => b.id)).toContain(y.onBlock);
    const guns = play.entities.filter((e) => e.id.startsWith('hull-0-gun'));
    for (const g of guns) expect(g.rule).toMatchObject({ type: 'scroll-foe', path: { kind: 'fixed' } });
    expect(play).toMatchObject({ destruction: 'physical', matter: { g: 0 } });
    expect(P.destruction).toBeUndefined();                                                     // a bare page breaks nothing
  });

  it('the side view shows a hull\'s profile: nothing that stands wholly off its flanks toward the camera', () => {
    const big = Object.keys(CAPITAL_CLASSES).find((c) => scrollStageOf(stage({ hulls: [{ capital: c, at: 1, depth: 0 }], view: 'top' })).plane[0].P.blocks.length
      > scrollStageOf(stage({ hulls: [{ capital: c, at: 1, depth: 0 }] })).plane[0].P.blocks.length);
    expect(big).toBeTruthy();                                                                  // a class with flank wings exists
    // (every block overlaps the body's own depth: none stands wholly off its flank, toward the camera or away)
    const side = scrollStageOf(stage({ hulls: [{ capital: big, at: 1, depth: 0 }] })).plane[0].P.blocks, body = side.filter((b) => ['hull', 'core', 'drive', 'bow'].includes(b.role));
    const lo = Math.min(...body.map((b) => b.min[0])), hi = Math.max(...body.map((b) => b.max[0]));
    for (const b of side) expect(b.max[0] > lo - 1e-6 && b.min[0] < hi + 1e-6, b.id).toBe(true);
  });

  it('the airspace hands a scroll stage its own reader and builder', () => {
    expect(validateAirspace(stage())).toEqual([]);
    expect(validateAirspace({ kind: 'airspace', scroll: { speed: 3 } }).join(' ')).toMatch(/not a scroll stage's word/);
    expect(assembleAirspace(stage()).camera.rule).toBe('scroll');
  });

  it('refuses its words, teaching', () => {
    expect(readScrollStage({ view: 'diagonal' }).join(' ')).toMatch(/'side'.*'top'/);
    expect(readScrollStage({ ship: { craft: 'trainer' } }).join(' ')).toMatch(/space craft/);
    expect(readScrollStage({ track: [{ by: [0, 0] }] }).join(' ')).toMatch(/not both 0/);
    expect(readScrollStage({ track: [{ hold: true }] }).join(' ')).toMatch(/until/);
    expect(readScrollStage({ hulls: [{ capital: 'dreadnought', at: 1, depth: 2 }] }).join(' ')).toMatch(/fleet class.*negative|negative.*fleet class/s);
    expect(readScrollStage({ backdrop: { toward: { bearing: 0, elevation: 0 } } }).join(' ')).toMatch(/camera's view/);
    expect(readScrollStage({ pods: ['railgun'] }).join(' ')).toMatch(/names pods/);
    expect(readScrollStage({ pods: [POD_IDS[0]], targets: [{ at: [1, 0], carries: POD_IDS[1] }] }).join(' ')).toMatch(/leave out/);
    expect(readScrollStage({ targets: [{ at: [1, 0], hp: -1 }] }).join(' ')).toMatch(/positive/);
  });
});
