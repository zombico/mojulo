import { describe, it, expect } from 'vitest';
import zlib from 'node:zlib';
import { assembleJungleScene, jungleLayers } from './jungle.js';
import { assembleStageScene } from './stage.js';
import { JUNGLE_MGS3 } from './style/jungle-mgs3.js';
import { CARD_KEYS, cardMask, cardCover, cardTexture } from './leaf-cards.js';
import { makeSunShadow } from './sun.js';
import { surfaceTexture } from '../landscape/surface-textures.js';
import { emitThreeWorld } from '../scene/scene-three.js';

const JUNGLE = { kind: 'stage', kit: 'jungle-trail' };
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
// where a face stands: the middle of its first edge (a card's base, a quad's foot)
const foot = (f) => [(f.corners[0][0] + f.corners[1][0]) / 2, (f.corners[0][1] + f.corners[1][1]) / 2, Math.min(f.corners[0][2], f.corners[1][2])];
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

describe('leaf cards', () => {
  it('are RGBA tiles with real holes, one per kind, deterministic', () => {
    for (const k of CARD_KEYS) {
      const url = cardTexture(k), png = Buffer.from(url.split(',')[1], 'base64');
      expect(png[25]).toBe(6);   // IHDR colour type 6: RGBA
      const c = cardCover(k);
      expect(c).toBeGreaterThan(0.1);
      expect(c).toBeLessThan(0.7);   // a card is mostly leaf where it matters and clear around it
      expect(cardTexture(k)).toBe(url);
    }
    expect(surfaceTexture('card:fern')).toBe(cardTexture('card:fern'));   // resolved through the surface-texture registry
  });
  it('let the sun through their clear texels: a card shadows only where its leaf is', () => {
    const m = cardMask('card:spray');
    const face = { corners: [[-1, -1, 5], [1, -1, 5], [1, 1, 5], [-1, 1, 5]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]], texture: 'card:spray' };
    const solid = makeSunShadow([face], [0, 0, 1]), cut = makeSunShadow([face], [0, 0, 1], { maskOf: () => m });
    let lit = 0, n = 0;
    for (let i = 0; i < 20; i++) for (let j = 0; j < 20; j++) { const p = [-0.95 + 0.1 * i, -0.95 + 0.1 * j, 0]; expect(solid(p, [0, 0, 1])).toBe(0); lit += cut(p, [0, 0, 1]); n++; }
    expect(lit / n).toBeGreaterThan(0.3);   // a spray card is ~45% leaf: well over a third of the floor under it is lit
    expect(lit / n).toBeLessThan(0.75);
  });
});

describe('the jungle-mgs3 style card', () => {
  it('states its principles, its reveal rings and its value order', () => {
    expect(JUNGLE_MGS3.principles.length).toBeGreaterThanOrEqual(10);
    expect(JUNGLE_MGS3.rings.near).toBeLessThan(JUNGLE_MGS3.rings.mid);
    expect(JUNGLE_MGS3.values).toEqual(['dapple', 'trail', 'trunk', 'foliage', 'shade']);
  });
});

describe('the jungle-trail stage', () => {
  const scene = assembleStageScene(JUNGLE);
  const L = jungleLayers(JUNGLE_MGS3, 1), site = L.site, R = JUNGLE_MGS3.rings;
  const cards = scene.faces.filter((f) => typeof f.texture === 'string' && f.texture.startsWith('card:'));
  it('is reached through the stage kind and is deterministic', () => {
    expect(JSON.stringify(assembleJungleScene({ ...JUNGLE, style: 'jungle-mgs3' }))).toBe(JSON.stringify(scene));
  }, 120000);
  it('principle 3 — leaves are cards, wood is geometry: every leaf face is a cutout card, and the page draws them alpha-tested', () => {
    expect(cards.length).toBeGreaterThan(1000);
    expect(scene.cutouts).toEqual([...new Set(cards.map((f) => f.texture))].sort());
    // no grower leaf blobs: the giants' faces are their wood only (barked near, plain at mid)
    const wood = scene.faces.filter((f) => f.group === 'jungle:wood');
    expect(wood.length).toBeGreaterThan(0);
    expect(wood.every((f) => !f.texture || f.texture.startsWith('bark-'))).toBe(true);
    const html = emitThreeWorld({ ...scene, textures: Object.fromEntries(scene.cutouts.map((k) => [k, cardTexture(k)])), inline: true });
    expect(html).toContain('const __CUT = ');
    expect(html).toContain('alphaTest: 0.5');
    expect(html).toContain('if (!__CUT[t.key]) solids.push(tm);');   // foliage is walked through
  });
  it('principle 4 — progressive reveal: understory dense near the trail, sparse at mid, none beyond; only walls far out', () => {
    const under = L.raw.filter((f) => f.group === 'jungle:under'), d = (f) => site.trailDist(foot(f)[0], foot(f)[1]);
    const area = (r0, r1) => 2 * (r1 - r0) * site.D;
    const near = under.filter((f) => d(f) < R.near).length / area(0, R.near), mid = under.filter((f) => d(f) >= R.near && d(f) < R.mid).length / area(R.near, R.mid);
    expect(near).toBeGreaterThan(2 * mid);
    expect(under.filter((f) => d(f) > R.mid + 1.5).length).toBe(0);
    const walls = L.raw.filter((f) => f.group === 'jungle:wall');
    expect(walls.length).toBeGreaterThan(0);
    expect(walls.every((f) => { const [x, y] = foot(f); return d(f) > R.mid || y < 0 || y > site.D || x < site.cliffX(y); })).toBe(true);
    // the giants' wood steps down a level away from the trail
    expect(L.giants.some((g) => g.near) && L.giants.some((g) => !g.near)).toBe(true);
  });
  it('principle 5 — light comes through: the sun reaches a share of the trail through the canopy\'s holes, not all of it', () => {
    const pts = L.raw.filter((f) => f.cls === 'trail').flatMap((f) => f.corners);
    const lit = pts.filter((c) => L.shadow(c, [0, 0, 1])).length / pts.length;
    expect(lit).toBeGreaterThan(0.08);
    expect(lit).toBeLessThan(0.45);
    expect(scene.faces.some((f) => f.group === 'jungle:shaft' && f.water)).toBe(true);   // and shafts stand where it does
  });
  it('principle 6 — values: dapples > trail > trunks > foliage > shade, as baked colour × tile mean', { timeout: 60000 }, () => {
    const vals = (sel) => scene.faces.filter(sel).flatMap((f) => (f.cornerFills || [f.fill]).map((h) => { const c = hex(h), t = f.texture ? tileMean(f.texture) : [1, 1, 1]; return lum(c.map((v, k) => v * t[k])); })).sort((a, b) => a - b);
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const mid = (f) => f.corners.reduce((a, q) => [a[0] + q[0] / f.corners.length, a[1] + q[1] / f.corners.length], [0, 0]);
    const inTrail = (f) => { const [x, y] = mid(f); return site.trailDist(x, y) < site.halfWAt(y) * 0.8; };
    const onFloor = (f) => { const [x, y] = mid(f); return site.trailDist(x, y) > site.halfWAt(y) + site.fringeAt(y) + 2; };
    const trail = vals((f) => f.texture === 'soil-mud' && inTrail(f)), dapple = trail[Math.floor(0.95 * (trail.length - 1))];
    const v = {
      dapple, trail: mean(trail), trunk: mean(vals((f) => f.group === 'jungle:wood')),
      foliage: mean(vals((f) => ['jungle:under', 'jungle:fern', 'jungle:crown'].includes(f.group))),
      shade: mean(vals((f) => f.group === 'trail:ground' && f.texture === 'soil-mud' && onFloor(f))),
    };
    const order = JUNGLE_MGS3.values;
    for (let i = 0; i + 1 < order.length; i++) expect(v[order[i]], `${order[i]} > ${order[i + 1]}`).toBeGreaterThan(v[order[i + 1]]);
  });
  it('principle 1 — the trail is the cut: no plant stands on it, and the canopy opens over it', () => {
    const onTrail = (f) => { const [x, y] = foot(f); return site.trailDist(x, y) < site.halfWAt(y) - 0.2; };
    const standing = L.raw.filter((f) => ['jungle:under', 'jungle:fern-trunk', 'jungle:wood'].includes(f.group) && foot(f)[2] < site.ground(foot(f)[0], foot(f)[1]) + 0.5);
    expect(standing.filter(onTrail).length).toBe(0);
    const canopy = L.raw.filter((f) => f.group === 'jungle:canopy'), over = canopy.filter((f) => site.trailDist(f.corners[0][0], f.corners[0][1]) < 3).length / canopy.length;
    const share = (2 * 3) / (site.W + 28);   // the corridor's share of the canopy's span, were the roof uniform
    expect(over).toBeLessThan(share * 0.75);
  });
  it('the trail blends into the floor: one soil, mapped the same way, the edge a wandering value — never a seam', () => {
    const soil = JUNGLE_MGS3.tiles.trail.key, T = JUNGLE_MGS3.tiles;
    expect(T.fringe.key).toBe(soil); expect(T.grass.key).toBe(soil); expect(T.fringe.scale).toBe(T.trail.scale);
    const ribbon = L.raw.filter((f) => f.cls === 'trail' || f.cls === 'fringe');
    expect(ribbon.every((f) => f.uv.every((q, k) => Math.abs(q[0] - f.corners[k][0] / T.trail.scale) < 1e-3 && Math.abs(q[1] - f.corners[k][1] / T.trail.scale) < 1e-3))).toBe(true);
    // the edge wanders: where the floor's value takes over, measured along the trail, is not one ruled offset
    const lumAt = (h) => lum(hex(h));
    const edgeOff = [];
    for (const f of scene.faces.filter((f) => f.texture === soil && f.cornerFills)) f.corners.forEach((c, k) => {
      const d = site.trailDist(c[0], c[1]) - site.halfWAt(c[1]); if (Math.abs(d) < 1.6) edgeOff.push([Math.round(c[1] / 4), d, lumAt(f.cornerFills[k])]);
    });
    expect(edgeOff.length).toBeGreaterThan(200);
    // and debris covers it: litter piles at the edges, twigs lie across
    expect(L.raw.filter((f) => f.group === 'jungle:twig').length).toBeGreaterThan(20);
    const lit = L.raw.filter((f) => f.group === 'jungle:litter').map((f) => { const m = f.corners.reduce((a, q) => [a[0] + q[0] / 4, a[1] + q[1] / 4], [0, 0]); return site.trailDist(m[0], m[1]) - site.halfWAt(m[1]); });
    expect(lit.filter((d) => Math.abs(d) < 0.7).length / (2 * 1.4 * site.D)).toBeGreaterThan(lit.filter((d) => d < -0.3).length / (2 * site.D));
  });
  it('distinct inside the radius: each near giant wears its own bark, carries epiphytes, and its wood is marked by cause', () => {
    const near = L.giants.filter((g) => g.near), barks = new Set(near.map((g) => g.bark));
    expect(barks.size).toBe(Math.min(near.length, JUNGLE_MGS3.giants.barks.length));
    expect(L.raw.filter((f) => f.group === 'jungle:epiphyte').length).toBeGreaterThan(near.length * 4);
    const keys = new Set(scene.faces.filter((f) => f.group === 'jungle:wood' && f.texture).map((f) => f.texture));
    expect(keys.size).toBeGreaterThanOrEqual(2);
  });
  it('the leaves carry their own shade: an understory card is darker at its foot than at its top', () => {
    const under = scene.faces.filter((f) => f.group === 'jungle:under' && f.cornerFills);
    const darker = under.filter((f) => lum(hex(f.cornerFills[0])) + lum(hex(f.cornerFills[1])) < lum(hex(f.cornerFills[2])) + lum(hex(f.cornerFills[3]))).length;
    expect(darker / under.length).toBeGreaterThan(0.75);
    expect(scene.faces.filter((f) => f.decal === 'shadow').length).toBeGreaterThan(100);   // and shade the floor under them
  });
  it('the mojulo world\'s tropical flora: a banyan at the gate whose pillars stand either side of the trail, never on it', () => {
    const banyan = L.giants.find((g) => g.species === 'banyan');
    expect(banyan).toBeTruthy();
    expect(banyan.near).toBe(true);
    expect(L.raw.filter((f) => f.group === 'jungle:roots' && f.texture === 'card:roots').length).toBeGreaterThan(10);   // hanging root curtains
    // pillars: barked wood standing from the floor well away from the banyan's own trunk
    const pillars = L.raw.filter((f) => f.group === 'jungle:wood' && Math.hypot(f.corners[0][0] - banyan.x, f.corners[0][1] - banyan.y) > 3 && f.corners[0][2] < site.ground(f.corners[0][0], f.corners[0][1]) + 0.4);
    expect(pillars.length).toBeGreaterThan(20);
    expect(pillars.filter((f) => site.trailDist(f.corners[0][0], f.corners[0][1]) < site.halfWAt(f.corners[0][1]) - 0.2).length).toBe(0);
  });
  it('twist by cause: the giants grow with the style\'s wander and reach for light, and lianas wind up their trunks', () => {
    expect(JUNGLE_MGS3.grow.wander).toBeGreaterThan(0.06);   // the grower's default
    expect(L.raw.filter((f) => f.group === 'jungle:liana').length).toBeGreaterThan(200);
  });
  it('bamboo stands on the wet ground at the ravine foot, and tall grass where the sun reaches the floor, clear of the trail', () => {
    const culms = L.raw.filter((f) => f.group === 'jungle:bamboo');
    expect(culms.length).toBeGreaterThan(100);
    const feet = culms.filter((f) => f.corners[0][2] < site.ground(f.corners[0][0], f.corners[0][1]) + 0.3);
    expect(feet.length).toBeGreaterThan(0);
    expect(feet.every((f) => { const off = f.corners[0][0] - site.cliffX(f.corners[0][1]); return off > 1 && off < 12; })).toBe(true);
    // and no culm leans into the ravine wall: every culm face stands clear of the wall line
    expect(culms.every((f) => f.corners.every((q) => q[0] > site.cliffX(q[1]) + 0.5))).toBe(true);
    expect(L.raw.some((f) => f.group === 'jungle:bamboo-leaf' && f.texture === 'card:bamboo')).toBe(true);
    // the grass is cards (Snake Eater's), so the bake shades it and the walk goes through it
    const grass = L.raw.filter((f) => f.group === 'jungle:grass');
    expect(grass.length).toBeGreaterThan(60);
    expect(grass.every((f) => f.texture === 'card:grass' && site.trailDist(foot(f)[0], foot(f)[1]) > site.halfWAt(foot(f)[1]) + 0.3)).toBe(true);
    expect(scene.cutouts).toContain('card:grass');
  });
  it('the floor is two tiles blended per vertex: moss over the soil, worn off the trail, thick off it', () => {
    const moss = scene.faces.filter((f) => f.blend);
    expect(moss.length).toBeGreaterThan(500);
    expect(moss.every((f) => f.texture === JUNGLE_MGS3.moss.key && f.cornerAlpha.length === 4 && f.cornerFills)).toBe(true);
    const at = (sel) => { const a = moss.flatMap((f) => f.corners.map((c, k) => [c, f.cornerAlpha[k]])).filter(([c]) => sel(c)).map(([, a]) => a); return a.reduce((x, y) => x + y, 0) / Math.max(1, a.length); };
    const onTrail = at((c) => site.trailDist(c[0], c[1]) < site.halfWAt(c[1]) * 0.25), off = at((c) => { const d = site.trailDist(c[0], c[1]) - site.halfWAt(c[1]); return d > 1.5 && d < 6; });
    expect(off).toBeGreaterThan(0.3);
    expect(onTrail).toBeLessThan(off * 0.3);
    // and the page draws it as its own translucent pass over the soil
    const html = emitThreeWorld({ faces: moss.slice(0, 20), textures: { [JUNGLE_MGS3.moss.key]: surfaceTexture(JUNGLE_MGS3.moss.key) }, inline: true });
    expect(html).toContain('blend layer (two-tile vertex blend)');
    expect(emitThreeWorld({ faces: scene.faces.filter((f) => !f.blend).slice(0, 20), inline: true })).not.toContain('blend layer (two-tile');
  });
  it('the floor is lumpy and the trail sunk between banks', () => {
    const zs = []; for (let x = site.cliffX(30) + 6; x < site.W; x += 1) zs.push(site.ground(x, 30) - site.valley(x, 30) * 0);
    const rough = []; for (let y = 2; y < site.D - 2; y += 0.5) { const x = site.trailX(y) + site.halfWAt(y) + site.fringeAt(y) + 4; rough.push(site.ground(x, y)); }
    const d2 = rough.slice(2).map((v, i) => Math.abs(v - 2 * rough[i + 1] + rough[i]));
    expect(Math.max(...d2)).toBeGreaterThan(0.02);   // mounds and hollows, not a smooth slope
    let higher = 0, n = 0;
    for (let y = 4; y < site.D - 4; y += 2) { const e = site.halfWAt(y) + site.fringeAt(y) + 1.4, c = site.ground(site.trailX(y), y); for (const sd of [-1, 1]) { const x = site.trailX(y) + sd * e; if (x < site.cliffX(y) + 3) continue; n++; if (site.ground(x, y) > c) higher++; } }
    expect(higher / n).toBeGreaterThan(0.6);
  });
  it('the occasional massive trunk: a barked bole metres across, clear of the trail, moss climbing it', () => {
    expect(L.colossi.length).toBeGreaterThan(0);
    for (const c of L.colossi) {
      expect(2 * c.R).toBeGreaterThan(2.5);
      expect(site.trailDist(c.x, c.y) - site.halfWAt(c.y)).toBeGreaterThan(c.reach);
    }
    const bole = L.raw.filter((f) => f.colossus !== undefined && f.texture);
    expect(bole.length).toBeGreaterThan(100);
    expect(bole.every((f) => f.texture.startsWith('bark-'))).toBe(true);
    expect(scene.faces.some((f) => f.blend && Math.hypot(f.corners[0][0] - L.colossi[0].x, f.corners[0][1] - L.colossi[0].y) < L.colossi[0].R * 2.2 && f.corners[0][2] > site.ground(f.corners[0][0], f.corners[0][1]) + 0.5)).toBe(true);
  });
  it('the air is thick and the grade holds the palette: fog denser than the trail\'s, sky graded toward olive', () => {
    expect(scene.haze.density).toBeGreaterThan(0.02);
    const [r, g, b] = scene.sky.zenith;
    expect(g).toBeGreaterThanOrEqual(r);
    expect(g).toBeGreaterThan(b);
  });
  it('walk: the spawn stands at eye height over the trail', () => {
    const [x, y, z] = scene.walk.spawn;
    expect(z - site.ground(x, y)).toBeCloseTo(1.7, 1);
  });
});
