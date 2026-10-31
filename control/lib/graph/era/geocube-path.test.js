// The open path: a trail with no far cliff (`ground.cliff: false`), the land open on both sides of the walk; the cube's
// `outside.cliff` laid on every trail it paints (a game's levels as well as a scene's); and the geocube kind's
// `show: 'path'`, the way through the cube's land with nobody on it: a place to walk, not a game.
import { describe, expect, it } from 'vitest';
import { outTrailOf } from './out-trail-board.js';
import { treeItems } from './nature.js';
import { withGeocube, assembleGeocubeScene } from './geocube.js';
import { assembleStageScene } from './stage.js';
import { layLevel } from '../level/index.js';

const built = new Map(), once = (k, make) => (built.has(k) ? built.get(k) : built.set(k, make()).get(k));
const trail = (ground) => once(JSON.stringify(ground), () => outTrailOf({ kit: 'isekai-meadow', seed: 5, trail: { run: 14, ...(ground ? { ground } : {}) } }));
// the trees on each side of the walk: [the far (cliff) side, the open side]
const sides = ({ st, site, seed }) => {
  const t = treeItems(st, site, seed);
  return [t.filter((q) => q.x < site.trailX(q.y)).length, t.filter((q) => q.x > site.trailX(q.y)).length];
};
const OPEN = { from: 'island-noon', outside: { cliff: false } };

describe('an open trail: no far cliff, the land open on both sides', () => {
  it('lays no scarp or geology, and grows the meadow on both sides of the walk', () => {
    const cliff = trail(), open = trail({ cliff: false });
    // the cliff's geology (its scarp's apron, its beds) is not laid
    expect(cliff.site.grid.apron.some((v) => v > 0.05)).toBe(true);
    expect(open.site.grid.apron.every((v) => v === 0)).toBe(true);
    expect(open.site.grid.strata).toBe(null);
    expect(open.site.open).toBe(true);
    // the far side grows: trees stand on both sides, where the cliff top held almost none
    const [cFar] = sides(cliff), [oFar, oNear] = sides(open);
    expect(oFar).toBeGreaterThan(cFar);
    expect(oFar).toBeGreaterThan(0);
    expect(oNear).toBeGreaterThan(0);
    // the walk itself is the same spine
    expect(open.site.out.plan.profile.smoothed).toEqual(cliff.site.out.plan.profile.smoothed);
  });

  it('an absent cliff, or one with settings, is the card\'s far cliff as before', () => {
    const a = trail(), b = trail({});
    expect(Buffer.from(b.site.grid.z.buffer).equals(Buffer.from(a.site.grid.z.buffer))).toBe(true);
    expect(trail({ cliff: { height: 6 } }).site.open).toBeUndefined();
  });

  it('stands an overlook over the land in place of the cliff-top', () => {
    const P = once('open-stage', () => assembleStageScene({ kind: 'stage', kit: 'isekai-meadow', seed: 5, trail: { run: 14, ground: { cliff: false } } }));
    const names = P.cameras.map((c) => c.name);
    expect(names).toContain('overlook');
    expect(names).not.toContain('cliff-top');
    const [x, y, z] = P.cameras.find((c) => c.name === 'overlook').worldFraming.cameraPosition;
    const { site } = outTrailOf({ kit: 'isekai-meadow', seed: 5, trail: { run: 14, ground: { cliff: false } } });
    expect(z - site.ground(x, y)).toBeGreaterThan(5);
  });
});

describe('the cube\'s cliff, on every trail it paints', () => {
  it('a trail on the cube takes it; a trail that names its own keeps it; a cube with none leaves the trail as written', () => {
    expect(withGeocube({ kind: 'stage', geocube: OPEN, trail: { run: 12 } }).trail).toEqual({ run: 12, ground: { cliff: false } });
    expect(withGeocube({ kind: 'stage', geocube: OPEN, trail: { ground: { cliff: { height: 8 } } } }).trail.ground.cliff).toEqual({ height: 8 });
    expect(withGeocube({ kind: 'stage', geocube: 'island-noon', trail: { run: 12 } }).trail).toEqual({ run: 12 });
    // a terrain names its own
    const cube = { from: 'island-noon', outside: { terrains: { plain: { reads: 'an open plain', cliff: false } } } };
    expect(withGeocube({ kind: 'stage', geocube: cube, terrain: 'plain', trail: {} }).trail.ground.cliff).toBe(false);
    expect(withGeocube({ kind: 'stage', geocube: cube, trail: {} }).trail.ground).toBeUndefined();
  });

  it('a game\'s level on the cube gets open trails with no game-side setting', () => {
    const stages = layLevel({ geocube: OPEN, nodes: { a: { trail: true }, b: { trail: true } } }).stages;
    for (const s of stages) expect(withGeocube(s.manifest).trail.ground.cliff).toBe(false);
  });

  it('teaches what is wrong', () => {
    expect(() => withGeocube({ kind: 'stage', geocube: { from: 'island-noon', outside: { cliff: true } }, trail: {} })).toThrow(/outside\.cliff/);
    expect(() => withGeocube({ kind: 'stage', geocube: { from: 'island-noon', outside: { cliff: { height: 99 } } }, trail: {} })).toThrow(/outside\.cliff\.height/);
  });
});

describe('the geocube kind shows the path: a place to walk, not a game', () => {
  it('lays one trail on the cube, nobody on it, walked by the dummy, seen from the overlook', () => {
    const P = once('path', () => assembleGeocubeScene({ kind: 'geocube', cube: OPEN, show: 'path', seed: 3 }, {}, assembleStageScene));
    expect(P.cameras.map((c) => c.name)).toContain('overlook');
    expect(P.route.length).toBeGreaterThan(10);
    expect((P.entities ?? []).filter((e) => e.pilotable)).toEqual([]);
    expect(P.anchors.filter((a) => a.kind === 'house')).toEqual([]);
    expect(P.geocube).toBeTruthy();
  });

  it('teaches what is wrong', () => {
    expect(() => assembleGeocubeScene({ kind: 'geocube', cube: 'island-noon', show: 'room', biocube: 'meadow' }, {}, assembleStageScene)).toThrow(/show 'path' or 'town'/);
    // (the view cone is the outside's, its reach a number of metres in range)
    expect(() => assembleGeocubeScene({ kind: 'geocube', cube: 'island-noon', show: 'room', cone: 40 }, {}, assembleStageScene)).toThrow(/cone is the view cone over the outside/);
    expect(() => assembleGeocubeScene({ kind: 'geocube', cube: 'island-noon', show: 'path', cone: 'far' }, {}, assembleStageScene)).toThrow(/cone is the view cone's reach in metres/);
  });
});
