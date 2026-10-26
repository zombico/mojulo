// The water on a trail's land (out-water.js): a lake beside the walk, the open side falling to the sea, a river beside
// the walk, the falls off the far cliff; cut into the ground after the walk is laid, drawn as a surface in the land's
// look. The cube names it (`outside.water`) and every trail it paints takes it, a game's levels as well as a scene's.
import { describe, expect, it } from 'vitest';
import { outTrailOf } from './out-trail-board.js';
import { treeItems } from './nature.js';
import { readWater, WATER } from './out-water.js';
import { withGeocube, assembleGeocubeScene, readGeocube } from './geocube.js';
import { assembleStageScene } from './stage.js';
import { layLevel } from '../level/index.js';
import { layerFaces, ISEKAI_STYLES } from './isekai.js';

const built = new Map(), once = (k, make) => (built.has(k) ? built.get(k) : built.set(k, make()).get(k));
const trail = (ground, beats) => once(JSON.stringify([ground, beats]), () => outTrailOf({ kit: 'isekai-meadow', seed: 5, trail: { run: 14, ...(beats ? { beats } : {}), ...(ground ? { ground } : {}) } }));
const zOf = (t) => Buffer.from(t.site.grid.z.buffer);
// the walk's own line, its ground under it: the water never moves it
const walkZ = ({ site }) => Array.from({ length: Math.floor(site.D) }, (_, y) => site.ground(site.trailX(y), y));

describe('a trail\'s water, cut into its land', () => {
  it('absent adds nothing: no water, false, or an empty one build the same ground', () => {
    const a = trail();
    for (const g of [{ water: false }, { water: {} }]) expect(zOf(trail(g)).equals(zOf(a))).toBe(true);
    expect(a.site.water).toBeUndefined();
    expect(a.site.wet).toBeUndefined();
  });

  it('a lake: a basin off the walk, its water under its shore, a sand shore, no tree in it, the walk where it was', () => {
    const t = trail({ water: { lake: true } }), W = t.site.water, [L] = W.forms;
    expect(L).toMatchObject({ form: 'lake', side: 'open' });
    const [cx, cy, level] = L.at;
    expect(cx).toBeGreaterThan(t.site.trailX(cy));
    expect(W.wet(cx, cy)).toBe(true);
    expect(t.site.ground(cx, cy)).toBeLessThan(level - 0.5);
    // the shore stands over the water all round
    for (let k = 0; k < 16; k++) { const a = (k / 16) * 2 * Math.PI, r = L.r * 1.5; expect(t.site.ground(cx + r * Math.cos(a), cy + r * Math.sin(a))).toBeGreaterThan(level); }
    expect(W.sand(cx + L.r * 1.05, cy)).toBeGreaterThan(-1);
    expect(treeItems(t.st, t.site, 5).filter((q) => W.wet(q.x, q.y))).toEqual([]);
    expect(walkZ(t)).toEqual(walkZ(trail()));
    // drawn: its sheet, a hazard and an anchor on the trail, a still that sees it
    expect(W.faces.length).toBeGreaterThan(10);
    expect(t.site.out.hazards.map((h) => h.id)).toContain('hazard-lake-1');
    expect(W.cameras.map((c) => c.name)).toEqual(['lake']);
  });

  it('a coast: the site runs on past its edge, the land falls through a beach to the sea, the sea to the horizon', () => {
    const t = trail({ water: { coast: true } }), W = t.site.water, base = trail();
    expect(t.site.W).toBe(base.site.W + WATER.coast.room);
    const y = 30, xc = W.coast(y);
    expect(t.site.ground(xc - 2, y)).toBeGreaterThan(W.sea);
    expect(t.site.ground(xc + 6, y)).toBeLessThan(W.sea);
    expect(W.sand(xc - 2, y)).toBeGreaterThan(0);
    expect(W.faces.some((f) => f.corners.some((c) => c[0] > t.site.W + 100))).toBe(true);
    expect(walkZ(t)).toEqual(walkZ(base));
    // the far layers sink into the sea on its side, and stand as they were on the land's
    const st = ISEKAI_STYLES['isekai-meadow'], sea = (a) => (Math.cos(a) > 0.32 ? 0 : 1);
    const top = (fs, side) => Math.max(...fs.filter((f) => f.group === 'isekai:ridge' && Math.sign(f.corners[0][0] - t.site.W / 2) === side).map((f) => Math.max(...f.corners.map((c) => c[2]))));
    expect(top(layerFaces(st, t.site, [0, 0, 1], null, sea), 1)).toBeLessThan(top(layerFaces(st, t.site), 1));
    expect(top(layerFaces(st, t.site, [0, 0, 1], null, sea), -1)).toBe(top(layerFaces(st, t.site), -1));
  });

  it('a river: beside the walk on the far side, its water never climbing more than a step, off the walk', () => {
    const t = trail({ water: { river: true } }), W = t.site.water, [R] = W.forms, a = W.anchors[0];
    expect(R).toMatchObject({ form: 'river', side: 'far' });
    expect(a.at[0]).toBeLessThan(t.site.trailX(a.at[1]));
    expect(W.wet(a.at[0], a.at[1])).toBe(true);
    expect(walkZ(t)).toEqual(walkZ(trail()));
    // its sheet down its reach: each step down, or up at most the land's step
    const levels = W.faces.map((f) => f.corners[0][2]);
    for (let k = 1; k < levels.length; k++) expect(Math.abs(levels[k] - levels[k - 1])).toBeLessThan(WATER.river.step + 0.01);
  });

  it('the falls: off the far cliff into a pool, the crossing\'s stream rising from it', () => {
    const t = trail({ water: { falls: true } }, ['landmark', 'crossing', 'pocket', 'reveal']), [F] = t.site.water.forms;
    expect(F.form).toBe('falls');
    expect(F.drop).toBeGreaterThan(8);
    expect(F.stream).toBe('crossing-1');
    expect(t.site.water.wet(F.pool[0], F.pool[1])).toBe(true);
    // white water down the face: its sheet spans the drop
    const zs = t.site.water.faces.flatMap((f) => f.corners.map((c) => c[2]));
    expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(F.drop - 1);
  });

  it('teaches what is wrong', () => {
    expect(() => readWater({ sea: true })).toThrow(/water\.sea is not a water \(waters: lake, coast, river, falls\)/);
    expect(() => readWater({ lake: { size: 40 } })).toThrow(/lake\.size is the basin's radius/);
    expect(() => readWater({ coast: true, lake: { side: 'open' } })).toThrow(/coast takes the open side/);
    expect(() => readWater({ lake: { side: 'far' }, river: true })).toThrow(/both on the far side/);
    expect(() => trail({ cliff: false, water: { falls: true } })).toThrow(/falls drop off the far cliff/);
  });
});

describe('the cube\'s water, on every trail it paints', () => {
  const LAKE = { from: 'island-noon', outside: { water: { lake: true } } };
  it('a trail on the cube takes it; a trail\'s own form wins; its false refuses it; a cube with none leaves the trail', () => {
    expect(withGeocube({ kind: 'stage', geocube: LAKE, trail: { run: 12 } }).trail).toEqual({ run: 12, ground: { water: { lake: true } } });
    expect(withGeocube({ kind: 'stage', geocube: LAKE, trail: { ground: { water: { lake: { size: 4 }, river: true } } } }).trail.ground.water).toEqual({ lake: { size: 4 }, river: true });
    expect(withGeocube({ kind: 'stage', geocube: LAKE, trail: { ground: { water: false } } }).trail.ground.water).toBe(false);
    expect(withGeocube({ kind: 'stage', geocube: 'island-noon', trail: { run: 12 } }).trail).toEqual({ run: 12 });
  });

  it('a fall keeps the cliff it drops from; an open cube with falls is refused', () => {
    const open = { from: 'island-noon', outside: { cliff: false } };
    expect(withGeocube({ kind: 'stage', geocube: open, trail: { ground: { water: { falls: true } } } }).trail.ground.cliff).toBeUndefined();
    expect(() => readGeocube({ from: 'island-noon', outside: { cliff: false, water: { falls: true } } })).toThrow(/outside\.water.*falls drop off the far cliff/);
    expect(() => readGeocube({ from: 'island-noon', outside: { water: { pond: true } } })).toThrow(/outside\.water.*not a water/);
  });

  it('a game\'s level on the cube is cut with it, with no game-side setting', () => {
    const stages = layLevel({ geocube: LAKE, nodes: { a: { trail: true }, b: { trail: true } } }).stages;
    for (const s of stages) expect(withGeocube(s.manifest).trail.ground.water).toEqual({ lake: true });
  });

  it('the geocube kind\'s path shows it: its water drawn, its shores sand, its stills', () => {
    const P = once('path', () => assembleGeocubeScene({ kind: 'geocube', cube: { from: 'island-noon', outside: { water: { coast: true, lake: true } } }, show: 'path', seed: 3, camera: 'overhead' }, {}, assembleStageScene));
    expect(P.faces.filter((f) => f.water).length).toBeGreaterThan(50);
    expect(P.faces.filter((f) => f.group === 'isekai:sand').length).toBeGreaterThan(50);
    expect(P.cameras.map((c) => c.name)).toEqual(expect.arrayContaining(['shore', 'lake']));
    expect((P.anchors ?? []).filter((a) => a.kind === 'water').map((a) => a.id).sort()).toEqual(['coast-1', 'lake-1']);
    // a camera glyph's still, first: overhead, high over what the kind's own frame looks at
    const [still, own] = P.cameras;
    expect(still.name).toBe('still');
    expect(still.worldFraming.cameraPosition[2] - own.worldFraming.lookAt[2]).toBeGreaterThan(30);
    expect(() => assembleGeocubeScene({ kind: 'geocube', cube: 'island-noon', show: 'path', camera: 'drone' }, {}, assembleStageScene)).toThrow(/camera is the still.*low, overhead, wide, close/);
  });
});
