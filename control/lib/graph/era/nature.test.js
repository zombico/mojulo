import { describe, it, expect } from 'vitest';
import zlib from 'node:zlib';
import { assembleNatureScene, natureSite, treeItems, rockItems } from './nature.js';
import { assembleStageScene } from './stage.js';
import { NATURE_TRAIL } from './style/nature-trail.js';
import { surfaceTexture } from '../landscape/surface-textures.js';

const TRAIL = { kind: 'stage', kit: 'trail-valley' };
// a tile's mean colour (0..1) from its data-URL PNG (truecolour, filter 0 rows — the encoder in surface-textures)
function tileMean(key) {
  const b = Buffer.from(surfaceTexture(key).split(',')[1], 'base64');
  let o = 8, W = 0, H = 0; const idat = [];
  while (o < b.length) { const len = b.readUInt32BE(o), type = b.toString('ascii', o + 4, o + 8); if (type === 'IHDR') { W = b.readUInt32BE(o + 8); H = b.readUInt32BE(o + 12); } if (type === 'IDAT') idat.push(b.subarray(o + 8, o + 8 + len)); o += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat)), sum = [0, 0, 0];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let k = 0; k < 3; k++) sum[k] += raw[y * (1 + W * 3) + 1 + x * 3 + k];
  return sum.map((v) => v / (W * H * 255));
}
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

describe('the nature-trail style card', () => {
  it('states its principles and the order its values must keep', () => {
    expect(NATURE_TRAIL.principles.length).toBeGreaterThanOrEqual(10);
    expect(NATURE_TRAIL.values).toEqual(['trail', 'rock', 'grass', 'foliage']);
  });
});

describe('the trail-valley stage', () => {
  const scene = assembleStageScene(TRAIL);
  const site = natureSite(NATURE_TRAIL, 1);
  it('is reached through the stage kind and is deterministic', () => {
    expect(JSON.stringify(assembleNatureScene({ ...TRAIL, style: 'nature-trail' }))).toBe(JSON.stringify(scene));
    expect(scene.sky.zenith).toEqual(NATURE_TRAIL.air.dome.zenith);
  }, 60000);
  it('principle 5 — values: trail > rock > grass > foliage, measured as baked colour × tile mean', () => {
    const seen = (sel) => {
      const fs = scene.faces.filter(sel), vals = fs.flatMap((f) => (f.cornerFills || [f.fill]).map((h) => { const c = hex(h), t = f.texture ? tileMean(f.texture) : [1, 1, 1]; return lum(c.map((v, k) => v * t[k])); }));
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    };
    const v = { trail: seen((f) => f.texture === 'soil-dirt'), rock: seen((f) => f.group === 'trail:cliff'), grass: seen((f) => f.texture === 'grass-meadow'), foliage: seen((f) => f.group === 'trail:tree') };
    console.log('[nature values]', JSON.stringify(v));
    expect(v.trail).toBeGreaterThan(v.rock);
    expect(v.rock).toBeGreaterThan(v.grass);
    expect(v.grass).toBeGreaterThan(v.foliage);
  }, 60000);
  it('principle 6 — trees stand in clusters with gaps, never an even scatter', () => {
    const trees = treeItems(NATURE_TRAIL, site, 1);
    expect(trees.length).toBeGreaterThan(15);
    const nn = trees.map((t) => Math.min(...trees.filter((u) => u !== t).map((u) => Math.hypot(u.x - t.x, u.y - t.y))));
    const meanNN = nn.reduce((a, b) => a + b, 0) / nn.length;
    // Clark–Evans: an even (random) scatter over the site would put the mean nearest neighbour near 0.5/√density
    const density = trees.length / (site.W * site.D), random = 0.5 / Math.sqrt(density);
    expect(meanNN / random).toBeLessThan(0.6);
    for (const t of trees) expect(site.trailDist(t.x, t.y)).toBeGreaterThan(NATURE_TRAIL.trees.clearTrail - 1e-6);
  });
  it('principle 3 — slope decides material: no grass facet is steep, and talus lies at the cliff foot', () => {
    const grass = scene.faces.filter((f) => f.texture === 'grass-meadow');
    expect(grass.every((f) => f.normal[2] >= NATURE_TRAIL.slope.rock - 1e-6)).toBe(true);
    const talus = scene.faces.filter((f) => f.texture === 'soil-scree');
    expect(talus.length).toBeGreaterThan(0);
    expect(talus.every((f) => f.corners[0][0] < site.cliffX(f.corners[0][1]) + NATURE_TRAIL.landform.keep[1])).toBe(true);   // the apron lies at the cliff's foot
    expect(scene.faces.filter((f) => f.group === 'trail:rock').length).toBeGreaterThan(50);
  });
  it('principle 7 — the accent red appears only on the trail blazes', () => {
    const red = (h) => { const c = hex(h); return c[0] > 0.4 && c[0] > c[1] * 2 && c[0] > c[2] * 2; };
    const reds = scene.faces.filter((f) => (f.fill || f.cornerFills) && (f.cornerFills || [f.fill]).some(red));   // decals carry no colour
    expect(reds.length).toBeGreaterThan(0);
    expect(reds.every((f) => f.group === 'trail:blaze')).toBe(true);
  });
  it('principle 4 — the trail is a ribbon on its centreline, not the ground grid', () => {
    const trail = scene.faces.filter((f) => f.texture === 'soil-dirt');
    for (const f of trail) for (const c of f.corners) expect(site.trailDist(c[0], c[1])).toBeLessThan(site.halfWAt(c[1]) + 0.05);
  });
  it('principle 9 — the far ridges are flat silhouettes mixed toward the fog', () => {
    const ridge = scene.faces.filter((f) => f.group === 'trail:ridge');
    expect(ridge.length).toBeGreaterThan(0);
    expect(ridge.every((f) => !f.cornerFills && !f.texture)).toBe(true);
  });
  it('composition — rocks are chipped (detail 1) and each its own variant only inside a focus radius; the gate frames the trail', () => {
    const rocks = rockItems(NATURE_TRAIL, site, 1);
    const near = rocks.filter((r) => r.detail === 1);
    expect(near.length).toBeGreaterThanOrEqual(3);
    expect(near.every((r) => site.inRadius(r.x, r.y))).toBe(true);
    expect(new Set(near.map((r) => r.v)).size).toBe(near.length);
    expect(rocks.filter((r) => r.role === 'talus').every((r) => r.detail === 0)).toBe(true);
    const gate = rocks.filter((r) => r.role === 'gate'), side = (r) => Math.sign(r.x - site.trailX(r.y));
    expect(gate).toHaveLength(2);
    expect(side(gate[0])).not.toBe(side(gate[1]));
  });
  it('composition — grass is instanced: fuller tufts (L1) inside a radius, L0 outside, more tufts per m² inside', () => {
    const reps = scene.repeats;
    expect(reps.length).toBeGreaterThan(0);
    const count = (lvl) => reps.filter((r) => r.group.includes(`:${lvl}:`)).reduce((n, r) => n + r.transforms.length, 0);
    expect(count('L1')).toBeGreaterThan(0); expect(count('L0')).toBeGreaterThan(0);
    for (const r of reps) for (const t of r.transforms) expect(site.inRadius(t.pos[0], t.pos[1])).toBe(r.group.includes(':L1:'));
    const area = site.foci.reduce((a, f) => a + Math.PI * f.r * f.r, 0), total = site.W * site.D;
    expect(count('L1') / area).toBeGreaterThan(count('L0') / (total - area));
  });
  it('nothing floats: a contact-shadow blob under every boulder and every tree', () => {
    const blobs = scene.faces.filter((f) => f.decal === 'shadow');
    const rocks = rockItems(NATURE_TRAIL, site, 1).filter((r) => r.role !== 'pebble'), trees = treeItems(NATURE_TRAIL, site, 1);
    expect(blobs.length).toBe(rocks.length + trees.length);
  });
  it('walk: the spawn stands at eye height over the trail ribbon, so the first floor ray starts above what it must hit', () => {
    const [x, y, z] = scene.walk.spawn;
    expect(z - site.ground(x, y)).toBeCloseTo(1.7, 3);
    const ribbon = scene.faces.filter((f) => f.texture === 'soil-dirt' && Math.min(...f.corners.map((c) => c[1])) <= y && Math.max(...f.corners.map((c) => c[1])) >= y);
    expect(ribbon.length).toBeGreaterThan(0);
    expect(Math.max(...ribbon.flatMap((f) => f.corners.map((c) => c[2])))).toBeLessThan(z);
  });
  it('the cliff is geology: steep facets rise well above the valley, and the talus op left scree for the rocks', () => {
    const cliff = scene.faces.filter((f) => f.group === 'trail:cliff');
    expect(Math.max(...cliff.flatMap((f) => f.corners.map((c) => c[2])))).toBeGreaterThan(14);
    expect(site.scree.length).toBeGreaterThan(50);
  });
  it('debris with causes: roots, a barked fallen log, sticks and cones, flush slabs, and a feathered puddle', () => {
    const debris = scene.faces.filter((f) => f.group === 'trail:debris');
    expect(debris.some((f) => f.texture === 'bark-spruce')).toBe(true);
    expect(debris.some((f) => f.texture === 'slate')).toBe(true);
    expect(debris.length).toBeGreaterThan(100);
    const water = scene.faces.filter((f) => f.water);
    expect(water.length).toBeGreaterThan(0);
    const alphas = water.flatMap((f) => f.cornerAlpha);
    expect(Math.min(...alphas)).toBe(0); expect(Math.max(...alphas)).toBeGreaterThan(0.5);
  });
  it('the sky has weather: a cloud deck lit by the style sun, banded well above the cliff', () => {
    expect(scene.effects).toHaveLength(1);
    const deck = scene.effects[0];
    expect(typeof deck.frag).toBe('string');
    expect(deck.meta.mode).toBe('undershot');
    const cliffTop = Math.max(...scene.faces.filter((f) => f.group === 'trail:cliff').flatMap((f) => f.corners.map((c) => c[2])));
    expect(deck.meta.base).toBeGreaterThan(cliffTop + 30);
  });
});
