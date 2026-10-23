// Trail dress (trail-dress.js): a gritty dirt trail strewn at its edges and worn in patches in its own colours; a paved
// trail in the street's ground words; a quiet trail as it came.
import { describe, expect, it } from 'vitest';
import { readTrailDress, surfaceDress, PATCH_KINDS, PATCH_DEFAULT, TRAIL_SURFACES, IN_DIRT, SAND_BANDS, TURF_BANDS } from './trail-dress.js';
import { sandKey, sandTexels } from './sand-tiles.js';
import { readOutTrail, outTrailSite } from './out-trail.js';
import { assembleStageScene } from './stage.js';
import { assembleGeocubeScene } from './geocube.js';
import { MATERIAL_WORDS } from './arch-style.js';
import { ISEKAI_MEADOW } from './style/isekai-meadow.js';

const M = { kind: 'stage', kit: 'isekai-meadow', seed: 1 };
const rocks = (P) => P.faces.filter((f) => f.group === 'isekai:rock').length;
const patches = (P) => P.faces.filter((f) => f.patch);
const trail = (P) => P.faces.filter((f) => f.group === 'isekai:trail' && !f.patch);
// (each stage built once in this file and shared: the tests only read them)
const built = new Map(), stage = (m) => { const k = JSON.stringify(m); if (!built.has(k)) built.set(k, assembleStageScene(m)); return built.get(k); };
const hue = (hex) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); return r - b; };

describe('reading a trail\'s dress', () => {
  it('the dirt, its rubble and the default patches where it says nothing; a list picks the kinds', () => {
    expect(readTrailDress(undefined)).toEqual({ surface: 'earth', rubble: true, patches: PATCH_DEFAULT });
    expect(readTrailDress({ rubble: false, patches: false })).toMatchObject({ rubble: false, patches: [] });
    expect(readTrailDress({ patches: ['puddle', 'crown', 'puddle'] }).patches).toEqual(['puddle', 'crown']);
    // (the street's ground words, the two a trail brought among them)
    expect(TRAIL_SURFACES).toEqual(expect.arrayContaining(['earth', 'stone-road', 'gravel', 'flags', 'setts', 'brick-paving']));
    expect(TRAIL_SURFACES.every((w) => MATERIAL_WORDS[w].on === 'ground')).toBe(true);
  });

  it('refuses off its words by name, from the trail grammar too', () => {
    expect(() => readOutTrail({ surface: 'marble' })).toThrow(/trail\.surface 'marble' is not a ground word/);
    expect(() => readOutTrail({ patches: ['mud'] })).toThrow(new RegExp(`'mud' is not a patch kind \\(${PATCH_KINDS.join(', ')}\\)`));
    expect(() => readOutTrail({ rubble: 'lots' })).toThrow(/trail\.rubble is true/);
    expect(() => assembleGeocubeScene({ kind: 'geocube', cube: 'valley-morning', show: 'room', path: { surface: 'setts' } }, {}, assembleStageScene)).toThrow(/path is the dress of the trail/);
  });

  it('a paved word leans to its colour, or the kit\'s rock where it has none; its tile only on a gritty land', () => {
    expect(surfaceDress('earth')).toBeNull();
    expect(surfaceDress('brick-paving', { grit: 0.2 })).toEqual({ colour: MATERIAL_WORDS['brick-paving'].colour, share: 0.65, dirt: false, tile: null });
    expect(surfaceDress('flags', { grit: 0.7, rock: ISEKAI_MEADOW.palette.rock }).colour).toMatch(/^#[0-9a-f]{6}$/);
    expect(surfaceDress('flags', { grit: 0.7, rock: ISEKAI_MEADOW.palette.rock }).tile.params.face).toBe('floor');
    // (the floor stones are the rooms' own, art-direction.js: brick their herringbone, a stone road their rubble)
    expect(surfaceDress('brick-paving', { grit: 0.7 }).tile.params).toMatchObject({ gen: 'stone-brick', bond: 'herringbone' });
    expect(surfaceDress('stone-road', { grit: 0.7 })).toMatchObject({ dirt: true, share: IN_DIRT['stone-road'].share, tile: { params: { gen: 'stone-brick', bond: 'rubble' } } });
  });
});

describe('a trail dressed on a stage', () => {
  it('a quiet dirt trail is as it came, whatever its rubble and patches say', () => {
    const Q = JSON.stringify(stage({ ...M, trail: {}, shading: true }));
    expect(JSON.stringify(stage({ ...M, trail: { rubble: false, patches: ['puddle'] }, shading: true }))).toBe(Q);
  });

  it('a gritty dirt trail: rubble at its edges, patches on it in its own colours; each off by its own word', () => {
    const G = stage({ ...M, trail: {}, shading: { grit: 0.7 } });
    const bare = stage({ ...M, trail: { rubble: false, patches: false }, shading: { grit: 0.7 } });
    expect(rocks(G)).toBeGreaterThan(rocks(bare));
    expect(patches(bare)).toHaveLength(0);
    expect(new Set(patches(G).map((f) => f.patch))).toEqual(new Set(PATCH_DEFAULT));
    // (each patch inside the trail, a hair over its ribbon, laid with a relief; its colour a shade of the trail's)
    const site = outTrailSite(ISEKAI_MEADOW, {}, 1);
    expect(patches(G).every((f) => f.corners.every((c) => site.trailDist(c[0], c[1]) <= site.halfWAt(c[1]) + 1e-3))).toBe(true);
    expect(patches(G).every((f) => f.normal[2] > 0.7 && /^detail:/.test(f.texture))).toBe(true);
    const sign = (h) => Math.sign(hue(h)), tr = sign(trail(G)[0].fill);
    expect(patches(G).filter((f) => f.patch !== 'crown').every((f) => sign(f.fill) === tr)).toBe(true);
    // (its edge spilled over: the trail's own dirt and relief reaching out past it onto the verge)
    const spill = G.faces.filter((f) => f.spill), path = new Set(trail(G).filter((f) => !f.spill).map((f) => f.texture));
    expect(spill.length).toBeGreaterThan(0);
    expect(spill.every((f) => path.has(f.texture))).toBe(true);
    expect(spill.some((f) => f.corners.some((c) => site.trailDist(c[0], c[1]) > site.halfWAt(c[1]) + 0.1))).toBe(true);
    expect(bare.faces.filter((f) => f.spill).length).toBe(spill.length);
    // (and its verge starts in the trail's own dirt: a fringe lane's corners at the edge the trail's colour there)
    const key = (c) => `${c[0].toFixed(3)},${c[1].toFixed(3)}`, at = new Map(trail(G).filter((f) => !f.spill).flatMap((f) => f.corners.map((c, k) => [key(c), f.cornerFills[k]])));
    const verge = G.faces.filter((f) => f.group === 'isekai:ground' && f.uv && f.uv.every((q) => q[1] === 0 || q[1] === 0.999));
    const inner = verge.flatMap((f) => f.corners.filter((c, k) => f.uv[k][1] === 0 && at.has(key(c))).map((c) => [f.cornerFills[f.corners.indexOf(c)], at.get(key(c))]));
    expect(inner.length).toBeGreaterThan(0);
    expect(inner.every(([a, b]) => a === b)).toBe(true);
  }, 90000);

  it('a paved trail leans to its word, quiet or gritty; gritty, its tile laid; no rubble, patches or verge', () => {
    const word = 'brick-paving', toward = hue(MATERIAL_WORDS[word].colour);
    const Q = stage({ ...M, trail: {}, shading: true }), QB = stage({ ...M, trail: { surface: word }, shading: true });
    expect(trail(QB).every((f) => f.texture === undefined)).toBe(true);
    expect(hue(trail(QB)[0].fill) - hue(trail(Q)[0].fill)).toBeGreaterThan(0);
    expect(toward).toBeGreaterThan(0);
    const B = stage({ ...M, trail: { surface: word }, shading: { grit: 0.7 } }), D = stage({ ...M, trail: { rubble: false, patches: false }, shading: { grit: 0.7 } });
    const tex = (P) => new Set(trail(P).map((f) => f.texture));
    expect([...tex(B)].every((k) => /^detail:/.test(k) && !tex(D).has(k))).toBe(true);
    expect(patches(B)).toHaveLength(0);
    expect(rocks(B)).toBeLessThanOrEqual(rocks(D));
    // (its fringe turf to its edge: no lane laid across)
    const across = (P) => P.faces.filter((f) => f.group === 'isekai:ground' && f.uv && f.uv.every((q) => q[1] === 0 || q[1] === 0.999)).length;
    expect(across(D)).toBeGreaterThan(0);
    expect(across(B)).toBe(0);
  }, 90000);

  it('an outdoor surface is laid in the dirt: its stones leant part way, one tile running on, its edge the dirt trail\'s', () => {
    const R = stage({ ...M, trail: { surface: 'stone-road' }, shading: { grit: 0.7 } });
    const D = stage({ ...M, trail: {}, shading: { grit: 0.7 } });
    const laid = trail(R).filter((f) => !f.spill && !f.sand);
    expect(new Set(laid.map((f) => f.texture)).size).toBe(1);
    // (its edge: the dirt spilled over it with the dirt's own relief, the verge laid across, the rubble beside it)
    const dirtTex = new Set(trail(D).filter((f) => !f.spill).map((f) => f.texture));
    expect(R.faces.filter((f) => f.spill).every((f) => dirtTex.has(f.texture))).toBe(true);
    expect(R.faces.filter((f) => f.spill).length).toBeGreaterThan(0);
    expect(R.faces.some((f) => f.group === 'isekai:ground' && f.uv && f.uv.every((q) => q[1] === 0 || q[1] === 0.999))).toBe(true);
    expect(rocks(R)).toBeGreaterThan(rocks(D));
    expect(patches(R)).toHaveLength(0);
    // (its border sand worked into its cracks: cutouts of its own tile, in bands from the cracks alone to mostly sand)
    const sand = R.faces.filter((f) => f.sand), road = [...new Set(laid.filter((f) => !f.sand).map((f) => f.texture))][0];
    expect(sand.length).toBeGreaterThan(0);
    expect(new Set(sand.map((f) => f.texture))).toEqual(new Set(SAND_BANDS.map((b) => sandKey(road, b.level))));
    expect(sand.every((f) => R.cutouts.includes(f.texture) && f.uv.length === f.corners.length)).toBe(true);
    const T = SAND_BANDS.map((b) => sandTexels(sandKey(road, b.level))), cover = (t) => t.a.reduce((n, v) => n + (v ? 1 : 0), 0) / t.a.length;
    expect(T.every((t, i) => i === 0 || cover(t) > cover(T[i - 1]))).toBe(true);
    expect(cover(T[T.length - 1])).toBeLessThan(1);
    // (and the land's turf worked into its verge's outer edge the same way, its blades a share at a time)
    const turf = R.faces.filter((f) => f.turf), U = [...new Set(turf.map((f) => f.texture))].sort((a, b) => +a.split('~')[1] - +b.split('~')[1]).map(sandTexels);
    expect(turf.length).toBeGreaterThan(0);
    expect(turf.every((f) => /~light$/.test(f.texture) && R.cutouts.includes(f.texture) && f.group === 'isekai:ground')).toBe(true);
    expect(U).toHaveLength(TURF_BANDS.length);
    expect(U.every((t, i) => i === 0 || cover(t) > cover(U[i - 1]))).toBe(true);
  }, 90000);

  it('a geocube\'s street hands its `path` to the trail it lies on; no stone or patch on ground a town has claimed', () => {
    // (the stage the street lowers to, read and not built)
    let low; const STOP = new Error('lowered');
    try { assembleGeocubeScene({ kind: 'geocube', cube: 'limestone-crags', show: 'town', walk: false, path: { surface: 'setts', rubble: false } }, {}, (m) => { low = m; throw STOP; }); } catch (e) { if (e !== STOP) throw e; }
    expect(low.trail).toMatchObject({ surface: 'setts', rubble: false });
    // (the middle of the trail claimed: nothing strewn or worn in it, the rest as before)
    const box = [0, 24, 60, 48], inBox = (c) => c[0] > box[0] && c[0] < box[2] && c[1] > box[1] && c[1] < box[3];
    const K = stage({ ...M, trail: {}, shading: { grit: 0.7 }, _keepOut: [box] });
    expect(patches(K).length).toBeGreaterThan(0);
    expect(patches(K).some((f) => f.corners.some(inBox))).toBe(false);
  }, 90000);
});
