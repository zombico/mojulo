import { describe, it, expect } from 'vitest';
import zlib from 'node:zlib';
import { assembleNatureScene, natureSite, treeItems, rockItems, trailFaces, spruceFaces } from './nature.js';
import { assembleStageScene } from './stage.js';
import { NATURE_TRAIL } from './style/nature-trail.js';
import { surfaceTexture } from '../landscape/surface-textures.js';
import { emitThreeWorld } from '../scene/scene-three.js';

const TRAIL = { kind: 'stage', kit: 'trail-valley' };
// a tile's mean colour (0..1) from its data-URL PNG, over its opaque texels (RGB or RGBA, filter-0 rows)
const MEANS = {};
function tileMean(key) {
  if (MEANS[key]) return MEANS[key];
  const b = Buffer.from(surfaceTexture(key).split(',')[1], 'base64');
  let o = 8, W = 0, H = 0, ct = 2; const idat = [];
  while (o < b.length) { const len = b.readUInt32BE(o), type = b.toString('ascii', o + 4, o + 8); if (type === 'IHDR') { W = b.readUInt32BE(o + 8); H = b.readUInt32BE(o + 12); ct = b[o + 17]; } if (type === 'IDAT') idat.push(b.subarray(o + 8, o + 8 + len)); o += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat)), bpp = ct === 6 ? 4 : 3, sum = [0, 0, 0]; let n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const q = y * (1 + W * bpp) + 1 + x * bpp; if (bpp === 4 && raw[q + 3] === 0) continue; n++; for (let k = 0; k < 3; k++) sum[k] += raw[q + k]; }
  return (MEANS[key] = sum.map((v) => v / (n * 255)));
}
const foot = (f) => [(f.corners[0][0] + f.corners[1][0]) / 2, (f.corners[0][1] + f.corners[1][1]) / 2, Math.min(f.corners[0][2], f.corners[1][2])];
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

describe('the nature-trail style card', () => {
  it('states its principles and the order its values must keep', () => {
    expect(NATURE_TRAIL.principles.length).toBeGreaterThanOrEqual(15);
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
    const centre = (f) => f.texture === 'soil-dirt' && f.corners.every((c) => site.trailDist(c[0], c[1]) < site.halfWAt(c[1]) * 0.7);
    const v = { trail: seen(centre), rock: seen((f) => f.group === 'trail:cliff'), grass: seen((f) => f.texture === 'grass-meadow' && !f.blend), foliage: seen((f) => f.group === 'trail:bough') };
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
    const ribbon = trailFaces(NATURE_TRAIL, site).filter((f) => f.cls === 'trail');
    expect(ribbon.length).toBeGreaterThan(100);
    for (const f of ribbon) for (const c of f.corners) expect(site.trailDist(c[0], c[1])).toBeLessThan(site.halfWAt(c[1]) + 0.05);
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
  it('principle 13 — one ground: the trail is the soil worn bare and the grass blends back over it, never at a seam', () => {
    const T = NATURE_TRAIL.tiles, soil = scene.faces.filter((f) => f.texture === T.trail.key && !f.blend);
    // the ribbon and the meadow near it wear one soil, mapped the floor's way (world x, y)
    expect(soil.every((f) => f.uv.every((q, k) => Math.abs(q[0] - f.corners[k][0] / T.trail.scale) < 1e-3 && Math.abs(q[1] - f.corners[k][1] / T.trail.scale) < 1e-3))).toBe(true);
    expect(soil.some((f) => f.corners.every((c) => site.trailDist(c[0], c[1]) > site.halfWAt(c[1]) + site.fringeAt(c[1]) + 2))).toBe(true);
    // the grass over it: none on the trail's centre, patchy at its edge, whole at the ring (where the meadow tile begins)
    const blend = scene.faces.filter((f) => f.blend);
    expect(blend.length).toBeGreaterThan(1000);
    expect(blend.every((f) => f.texture === T.grass.key && f.cornerAlpha.length === 4 && f.cornerFills)).toBe(true);
    const at = (sel) => { const a = blend.flatMap((f) => f.corners.map((c, k) => [c, f.cornerAlpha[k]])).filter(([c]) => sel(c)).map(([, a]) => a); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; };
    const d = (c) => site.trailDist(c[0], c[1]), ring = NATURE_TRAIL.grassBlend.ring;
    expect(at((c) => d(c) < site.halfWAt(c[1]) * 0.3)).toBeLessThan(0.05);
    const edge = blend.flatMap((f) => f.corners.map((c, k) => [c, f.cornerAlpha[k]])).filter(([c]) => Math.abs(d(c) - site.halfWAt(c[1]) - site.fringeAt(c[1])) < 0.3).map(([, a]) => a);
    expect(Math.max(...edge) - Math.min(...edge)).toBeGreaterThan(0.5);   // the edge wanders: worn here, grassy there
    expect(at((c) => d(c) > ring - 0.05)).toBeGreaterThan(0.98);
    const html = emitThreeWorld({ faces: blend.slice(0, 20), textures: { [T.grass.key]: surfaceTexture(T.grass.key) }, inline: true });
    expect(html).toContain('blend layer (two-tile vertex blend)');
  });
  it('principle 14 — foliage is painted cards: spruce boughs on grown wood, grass as tufts, cut out on the page', () => {
    expect(scene.repeats).toBeUndefined();
    expect(scene.cutouts).toEqual(expect.arrayContaining(['card:bough', 'card:meadow']));
    const trees = treeItems(NATURE_TRAIL, site, 1), boughs = scene.faces.filter((f) => f.group === 'trail:bough');
    expect(boughs.every((f) => f.texture === 'card:bough')).toBe(true);
    // finer near the trail: a near spruce wears more cards than a far one of its height
    const per = (t) => spruceFaces(NATURE_TRAIL, site, [t]).filter((f) => f.group === 'trail:bough').length / t.h;
    const near = trees.filter((t) => site.trailDist(t.x, t.y) < NATURE_TRAIL.trees.cards.near - 2), far = trees.filter((t) => site.trailDist(t.x, t.y) > NATURE_TRAIL.trees.cards.near + 6);
    expect(near.length).toBeGreaterThan(0); expect(far.length).toBeGreaterThan(0);
    expect(Math.min(...near.map(per))).toBeGreaterThan(Math.max(...far.map(per)) * 1.2);
    // the trunks near the trail are barked
    expect(scene.faces.some((f) => f.group === 'trail:tree' && f.texture === 'bark-spruce')).toBe(true);
    // the crown shades itself: card corners at the trunk darker than at the tips
    const byR = (lo, hi) => { const v = boughs.flatMap((f) => f.corners.map((c, k) => [c, f.cornerFills[k]])).filter(([c]) => trees.some((t) => { const r = Math.hypot(c[0] - t.x, c[1] - t.y); return r >= lo && r < hi; })).map(([, h]) => lum(hex(h))); return v.reduce((a, b) => a + b, 0) / v.length; };
    expect(byR(0, 0.4)).toBeLessThan(byR(2.6, 4));
    // grass tufts: more per m² inside a focus radius, a fuller star of cards there
    const grass = scene.faces.filter((f) => f.group === 'trail:grass'), inside = grass.filter((f) => site.inRadius(foot(f)[0], foot(f)[1]));
    const area = site.foci.reduce((a, f) => a + Math.PI * f.r * f.r, 0), total = site.W * site.D;
    expect(inside.length / area).toBeGreaterThan((grass.length - inside.length) / (total - area));
    expect(grass.every((f) => f.texture.startsWith('card:'))).toBe(true);
  });
  it('principle 15 — the ground is never flat: mounds and hollows, and the trail worn between banks', () => {
    const rough = []; for (let y = 2; y < site.D - 2; y += 0.5) { const x = site.trailX(y) + site.halfWAt(y) + site.fringeAt(y) + 5; rough.push(site.ground(x, y)); }
    const d2 = rough.slice(2).map((v, i) => Math.abs(v - 2 * rough[i + 1] + rough[i]));
    expect(Math.max(...d2)).toBeGreaterThan(0.02);
    let higher = 0, n = 0;
    for (let y = 4; y < site.D - 4; y += 2) { const e = site.halfWAt(y) + site.fringeAt(y) + 1.2, c = site.ground(site.trailX(y), y); for (const sd of [-1, 1]) { const x = site.trailX(y) + sd * e; if (x < site.cliffX(y) + 4) continue; n++; if (site.ground(x, y) > c) higher++; } }
    expect(higher / n).toBeGreaterThan(0.6);
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
    expect(debris.some((f) => f.texture === NATURE_TRAIL.debris.slabs.key)).toBe(true);
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
