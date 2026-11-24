// The scroll stage, built (scroll-stage/stage-scene.js, an airspace's `scroll`). The concepts: the ship sets the screen
// (its length off the craft shelf's measures at the frame's share); a track is written in screens and played in metres;
// the play plane holds the ship alone (every layer and hull stands off it); a level flies the ship's airframe, a bare
// page a slab; the airspace hands a scroll stage its own reader and builder, and refuses its words teaching.
import { describe, it, expect } from 'vitest';
import { readScrollStage, scrollStageOf, scrollStagePlay, assembleScrollStage, SCROLL_PACE, HULL_DEPTH } from './stage-scene.js';
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
    const hull = P.faces.filter((f) => f.group.startsWith('fleet:'));
    expect(hull.length).toBeGreaterThan(0);
    const d = hull.flatMap((f) => f.corners.map((p) => toScreen('side', p)[2]));
    expect(Math.max(...d)).toBeLessThan(0);
    expect((Math.min(...d) + Math.max(...d)) / 2).toBeCloseTo(HULL_DEPTH * P.camera.dist, -1);
  });

  it('a level flies the ship\'s airframe; a bare page a slab', () => {
    const play = scrollStagePlay(stage()), P = assembleScrollStage(stage());
    expect(play.entities[0].body).toEqual({ type: 'figure-rig', figure: 'craft' });
    expect(play.figures.craft.craft.archetype).toBe(scrollStageOf(stage()).ship.craft);
    expect(P.entities[0].body.type).toBe('mesh');
    expect(P.figures).toBeUndefined();
    expect(P.camera).toMatchObject({ rule: 'scroll', target: 'player', view: 'side' });
    expect(P.entities[0].rule.type).toBe('scroll-ship');
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
  });
});
