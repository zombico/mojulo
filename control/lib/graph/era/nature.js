/**
 * NATURE — an exterior stage with no architecture: a trail through a valley under a cliff, built to a STYLE CARD
 * (style/nature-trail.js) whose principles the builder reads as numbers. The `trail-valley` kit of the stage kind.
 *
 *   ground   ONE heightfield for valley and cliff: the valley (with the trail carved) baked, then mojulo's landform
 *            geology on it (polygonizer/landform.js) — a scarp along the cliff line, hard and soft strata that bench,
 *            blocky joints that cut the face into planar facets and ledges, and talus that sheds down to the angle of
 *            repose and leaves an apron with scree. Facets are lit flat; material by slope, apron and bed;
 *   rocks    the talus op's scree placements, a few big boulders beside the trail (each its own variant);
 *   debris   on and beside the trail: roots from nearby trees, a fallen log at the gate, sticks and cones, flush
 *            stone slabs, a puddle;
 *   trees    one family (spruce) planted in clusters with gaps, clear of the trail and the cliff — with `trees.cards`
 *            grown (vegetation/conifer.js) and dressed in painted bough cards on the grown wood, else the pool's L1 tiers;
 *   grass    tufts on the fringe, in meadow clumps, as sedge at the cliff foot — with `grass.cards` painted cutout
 *            cards lit by the bake, else instanced tufts;
 *   soil     with `grassBlend`, ONE soil under the ribbon and the near meadow, the grass faded back over it per vertex;
 *   blazes   the accent: posts with a red band along the trail;
 *   ridges   two flat silhouettes beyond the site, mixed toward the fog colour;
 *   marks    nature by cause: moss on shaded and up-facing rock, a wet cliff foot, streaks under ledges, a packed
 *            light trail centre with darker edges, patchy grass.
 * Lit by the stage bake with a sun (cast shadows per vertex, trees included; a card casts only where it is painted) and
 * a sky fill. Deterministic.
 */
import { NATURE_TRAIL } from './style/nature-trail.js';
import { hash3, vnoise } from './dirt.js';
import { P, hexRgb, rgbHex, r5, quad, box, card, crossed } from './geom.js';
import { makeSunShadow, sunDir } from './sun.js';
import { bakeStageLight } from './stage.js';
import { rockPool, rockRepeats, expandRepeats } from '../polygonizer/rock-pool.js';
import { plantPool, trisToFaces } from '../vegetation/pool.js';
import { grassLadder } from '../vegetation/grass.js';
import { FLAT_LIGHT, makeLight } from '../polygonizer/vexar.js';
import { landformGrid, bakeGrid, applyLandform, gridSample, gridX, gridY, bedAt } from '../polygonizer/landform.js';
import '../polygonizer/bark-skin.js';   // registers the `bark-<species>` tile resolver the fallen log wears
import { composeCloudDeck } from '../effects/effects-clouds.js';
import { cardMask } from './leaf-cards.js';
import { growConifer } from '../vegetation/conifer.js';
import { axisChains, tubeTris, barkQuads } from '../vegetation/tree-mesh.js';
import { barkTile } from '../vegetation/tiles.js';

export const NATURE_STYLES = Object.freeze({ 'nature-trail': NATURE_TRAIL });

const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
/** A quad's facet normal (from its diagonals), turned to face `toward`. */
const isCard = (f) => typeof f.texture === 'string' && f.texture.startsWith('card:');
const facet = (c, toward) => { const n = unit(cross(sub(c[2], c[0]), sub(c[3], c[1]))); return n[0] * toward[0] + n[1] * toward[1] + n[2] * toward[2] < 0 ? n.map((v) => -v) : n; };

/**
 * The site's fields: the trail line, the cliff line, and the GROUND — a landform heightfield (valley baked, then the
 * cliff from geology), read bilinearly. All pure functions of (style, seed).
 */
export function natureSite(st, seed = 1) {
  const S = seed | 0, { w: W, d: D } = st.site, [a1, f1, a2, f2] = st.trail.sway, halfW = st.trail.width / 2, L = st.landform;
  // the trail breathes: its width and its grass fringe vary along it, so its edge never reads ruled
  const halfWAt = (y) => halfW * (1 + st.trail.widthVary * (vnoise(y * 0.15, 1.5, S + 81) - 0.5) * 2);
  const fringeAt = (y) => st.trail.fringe * (1 + st.trail.fringeVary * (vnoise(y * 0.22, 4.5, S + 83) - 0.5) * 2);
  const trailX = (y) => W * st.trail.x + a1 * Math.sin(y * f1 + 0.5) + a2 * Math.sin(y * f2 + 1.3);
  const trailSlope = (y) => a1 * f1 * Math.cos(y * f1 + 0.5) + a2 * f2 * Math.cos(y * f2 + 1.3);
  const trailDist = (x, y) => Math.abs(x - trailX(y)) / Math.sqrt(1 + trailSlope(y) ** 2);
  const cliffX = (y) => st.cliff.x + 3 * (vnoise(y * 0.05, 0.5, S + 3) - 0.5);
  // optional LUMPS (a style's `lumps`): more octaves of mounds and hollows, and BANKS — a raised lip either side of the
  // trail, which wears down between them; absent, the ground is exactly the trail level's
  const Lu = st.lumps, oct = Lu ? Lu.octaves : [];
  const lumps = (x, y) => oct.reduce((a, [amp, f], i) => a + amp * 2 * (vnoise(x * f, y * f, S + 11 + i) - 0.5), 0);
  const base = (x, y) => 1.4 * vnoise(x * 0.05, y * 0.05, S + 5) + 0.45 * vnoise(x * 0.14, y * 0.14, S + 7) + 0.07 * (x - cliffX(y)) + (Lu ? lumps(x, y) : 0);
  const bank = (x, y) => {
    if (!Lu || !Lu.banks) return 0;
    const B = Lu.banks, e = halfWAt(y) + fringeAt(y), d = trailDist(x, y);
    return B.h * (0.45 + 1.1 * vnoise(y * 0.09, 7.5, S + 19)) * smooth(e - 0.3, e + 0.7, d) * (1 - smooth(e + 0.7, e + B.w, d));
  };
  const valley = (x, y) => {
    const d = trailDist(x, y), k = smooth(halfWAt(y) + fringeAt(y) + 0.8, halfWAt(y) * 0.5, d);
    return mix(base(x, y), base(trailX(y), y) - 0.08, k) + bank(x, y);
  };
  // the geology: a scarp along the cliff line raises the far side; strata bench it, joints facet it, talus sheds an apron
  const g = landformGrid({ x0: -L.back, x1: W, y0: 0, y1: D, res: Math.round(D / L.cell) + 1 });
  bakeGrid(g, valley);
  const path = []; for (let y = -8; y <= D + 8; y += 2) path.push([cliffX(y), y]);
  applyLandform(g, [
    { op: 'scarp', path, throw: L.throw, face: L.face, side: 'left', rough: 0.02, taper: 0 },
    { op: 'strata', thickness: L.bed, contrast: 0.85, hardShare: 0.5, jitter: 0.4 },
    { op: 'joints', rock: 'granite', spacing: L.joint, steep: 40 },
    { op: 'talus', angle: 34, cliff: 50, retreat: L.retreat, scree: L.scree, rmin: 0.25, rmax: 1.3 },
  ], { seed: `trail-valley-${S}` });
  // keep the geology at the cliff; out in the valley (and on the trail) the ground stays as baked
  for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) {
    const x = gridX(g, i), y = gridY(g, j), w = smooth(L.keep[0], L.keep[1], x - cliffX(y)); if (w <= 0) continue;
    const q = j * g.nx + i; g.z[q] = mix(g.z[q], valley(x, y), w); g.apron[q] *= 1 - w; g.hard[q] *= 1 - w;
  }
  const ground = (x, y) => gridSample(g, x, y), apronAt = (x, y) => gridSample(g, x, y, g.apron);
  const scree = g.scree.filter((r) => r.x - cliffX(r.y) < L.keep[0]).map((r) => ({ ...r, z0: ground(r.x, r.y) }));
  // the composition's focus radii, centred on the trail at each focus's station
  const foci = (st.focus || []).map((f) => ({ ...f, x: trailX(f.y) }));
  const inRadius = (x, y) => foci.some((f) => Math.hypot(x - f.x, y - f.y) < f.r);
  return { W, D, halfW, halfWAt, fringeAt, trailX, trailDist, cliffX, ground, valley, apronAt, grid: g, scree, foci, inRadius };
}

/** The ground as the landform grid's facets: rock where steep (mapped up the face, tinted by its bed), scree on the
 *  talus apron, dry grass on the plateau and benches, meadow elsewhere; the trail's corridor is left to its ribbon. */
export function groundFaces(st, site) {
  const out = [], { grid: g, trailDist, halfWAt, cliffX, W } = site, T = st.tiles;
  const surf = (k, group = 'trail:ground') => ({ key: T[k].key, scale: T[k].scale, tint: T[k].tint, group });
  const at = (i, j) => [gridX(g, i), gridY(g, j), g.z[j * g.nx + i]];
  for (let j = 0; j + 1 < g.ny; j++) for (let i = 0; i + 1 < g.nx; i++) {
    const cs = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
    if (cs[0][0] > W) continue;
    if (cs.every((p) => trailDist(p[0], p[1]) < halfWAt(p[1]))) continue;   // wholly under the trail ribbon
    const n = facet(cs, [0, 0, 1]), mx = (cs[0][0] + cs[2][0]) / 2, my = (cs[0][1] + cs[2][1]) / 2, mz = (cs[0][2] + cs[2][2]) / 2;
    const apron = (g.apron[j * g.nx + i] + g.apron[(j + 1) * g.nx + i + 1]) / 2;
    if (n[2] < st.slope.rock) {
      // a cliff facet: the tile runs up the face along its own horizontal, its tone set by the bed it cuts
      const bed = bedAt(g, mx, my, mz), hardBed = bed >= 0 && g.strata.layers[bed].hard, jit = 0.92 + 0.16 * hash3(bed, 3, 211);
      const rs = surf('rock', 'trail:cliff'), h = Math.abs(n[0]) > Math.abs(n[1]) ? 1 : 0;
      quad(out, cs, n, { ...rs, tint: rs.tint.map((v) => v * jit * (hardBed ? 1.08 : 0.9)) }, null, null, cs.map((p) => [p[h] / rs.scale, p[2] / rs.scale]));
      continue;
    }
    const cls = apron > st.landform.apronMin ? 'talus' : mx < cliffX(my) - 1 ? 'top' : 'grass';
    const sf = cls === 'top' ? surf('rockTop', 'trail:top') : surf(cls);
    quad(out, cs, n, sf, null, null, cs.map((p) => [p[0] / sf.scale, p[1] / sf.scale]));
    out[out.length - 1].cls = cls;
  }
  return out;
}

/**
 * The TRAIL as a ribbon that follows its centreline (never the ground grid's staircase): a packed strip `width` wide in
 * two lanes, and a grass fringe either side, laid a little above the ground, stations every `step` metres.
 */
export function trailFaces(st, site) {
  const out = [], { D, halfWAt, fringeAt, trailX, ground } = site, T = st.tiles, step = 0.75;
  const surf = (k) => ({ key: T[k].key, scale: T[k].scale, tint: T[k].tint, group: 'trail:ground' });
  // lanes as fractions: [−edge−fringe, −edge], [−edge, 0], [0, edge], [edge, edge+fringe] at each station's own widths
  // one lift for every lane: the ground under the trail is cut away, so lanes at different heights would open a crack
  const lanes = [[-1, -2, 'fringe', 0.05], [-2, 0, 'trail', 0.05], [0, 2, 'trail', 0.05], [2, 1, 'fringe', 0.05]];
  const offAt = (code, y) => (code === 0 ? 0 : code === -2 ? -halfWAt(y) : code === 2 ? halfWAt(y) : code === -1 ? -halfWAt(y) - fringeAt(y) : halfWAt(y) + fringeAt(y));
  const station = (y) => { const sl = (trailX(y + 0.01) - trailX(y - 0.01)) / 0.02, l = Math.hypot(sl, 1); return { c: [trailX(y), y], n: [1 / l, -sl / l] }; };
  const at = (S, off, lift) => { const x = S.c[0] + S.n[0] * off, y = S.c[1] + S.n[1] * off; return [x, y, ground(x, y) + lift]; };
  let s0 = 0;
  for (let y = 0; y < D; y += step) {
    const A = station(y), B = station(Math.min(D, y + step)), s1 = s0 + Math.hypot(B.c[0] - A.c[0], B.c[1] - A.c[1]);
    for (const [c0, c1, cls, lift] of lanes) {
      const a0 = offAt(c0, A.c[1]), a1 = offAt(c1, A.c[1]), b0 = offAt(c0, B.c[1]), b1 = offAt(c1, B.c[1]);
      const sf = surf(cls), cs = [at(A, a0, lift), at(A, a1, lift), at(B, b1, lift), at(B, b0, lift)];
      quad(out, cs, facet(cs, [0, 0, 1]), sf, null, null, [[a0 / sf.scale, s0 / sf.scale], [a1 / sf.scale, s0 / sf.scale], [b1 / sf.scale, s1 / sf.scale], [b0 / sf.scale, s1 / sf.scale]]);
      out[out.length - 1].cls = cls;
    }
    s0 = s1;
  }
  return out;
}

/** Dice a quad n×n (bilinear corners and uv): a vertex-lit floor needs vertices where the dapples fall. */
export function dice(f, n) {
  const lerp = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t), at = (arr, u, v) => lerp(lerp(arr[0], arr[1], u), lerp(arr[3], arr[2], u), v), out = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const q = [[i / n, j / n], [(i + 1) / n, j / n], [(i + 1) / n, (j + 1) / n], [i / n, (j + 1) / n]];
    out.push({ ...f, corners: q.map(([u, v]) => P(at(f.corners, u, v))), uv: q.map(([u, v]) => at(f.uv, u, v).map(r5)) });
  }
  return out;
}

/**
 * ONE SOIL (a style's `grassBlend`): the ribbon — trail and fringe — and the meadow within `ring` of the trail all wear
 * the trail's soil, mapped the floor's way (world x, y), so no seam shows where the ribbon meets the ground; the grass
 * comes back over it as a blend (grassBlendFaces). → [ground, ribbon].
 */
export function oneSoil(st, site, ground, ribbon) {
  const T = st.tiles.trail, ring = st.grassBlend.ring, worldUv = (f) => f.corners.map((q) => [r5(q[0] / T.scale), r5(q[1] / T.scale)]);
  const soil = (f) => ({ ...f, texture: T.key, tint: T.tint, uv: worldUv(f) });
  return [
    ground.map((f) => (f.cls === 'grass' && Math.min(...f.corners.map((q) => site.trailDist(q[0], q[1]))) < ring ? soil(f) : f)),
    ribbon.map(soil),
  ];
}

/**
 * The GRASS BLEND: a copy of every soil face wearing the meadow's grass tile, faded in per corner by cause (the World
 * page's blend layer, `blend: true`) — worn off where feet go (the trail, wandering at its edge), thinned to bare soil
 * in patches and under the spruce (needle duff), and whole at the ring, where the meadow tile takes over.
 */
export function grassBlendFaces(st, site, faces, trees, seed) {
  const Gb = st.grassBlend, G = st.tiles.grass, S = seed | 0, out = [];
  const alpha = (c) => {
    const hw = site.halfWAt(c[1]), d = site.trailDist(c[0], c[1]);
    const wander = (vnoise(c[0] * 0.5, c[1] * 0.5, S + 401) - 0.5) * 2 * Gb.wander + (vnoise(c[0] * 2.1, c[1] * 2.1, S + 403) - 0.5) * 0.3;
    const worn = smooth(hw * Gb.wear[0], hw + site.fringeAt(c[1]) + Gb.wear[1], d + wander);
    const bare = smooth(Gb.bare[0], Gb.bare[1], 0.7 * vnoise(c[0] * 0.2, c[1] * 0.2, S + 405) + 0.3 * vnoise(c[0] * 0.7, c[1] * 0.7, S + 407));
    const near = trees.reduce((m, t) => Math.min(m, Math.hypot(t.x - c[0], t.y - c[1])), Infinity), duff = 1 - Gb.duff * smooth(Gb.duffR, 0.8, near);
    return worn * mix(mix(Gb.floor, 1, bare) * duff, 1, smooth(Gb.ring - 3, Gb.ring, d));
  };
  for (const f of faces) {
    if (f.group !== 'trail:ground' || f.texture !== st.tiles.trail.key) continue;
    const al = f.corners.map((c) => r5(alpha(c)));
    if (al.every((a) => a < 0.02)) continue;
    out.push({ corners: f.corners, normal: f.normal, outNormal: f.normal, texture: G.key, textureLit: true, uv: f.corners.map((q) => [r5(q[0] / G.scale), r5(q[1] / G.scale)]), tint: G.tint, cornerAlpha: al, blend: true, group: 'trail:grassblend' });
  }
  return out;
}

/** Every rock as an item { x, y, z0, size, detail, v, role }: talus at the cliff foot (detail 0: repetition, outside
 *  the radius), boulders beside the trail (detail 1 and each its own variant inside a radius), the gate pair framing the
 *  trail at a gate focus, and pebbles along the trail's edges. */
export function rockItems(st, site, seed) {
  const R = st.rubble, { D, halfWAt, fringeAt, trailX, ground, inRadius, foci } = site, S = seed | 0, items = [];
  // the talus: where the landform's own scree came to rest (power-law sizes, the big blocks on the thin distal edge)
  site.scree.slice(0, R.maxScree).forEach((r, i) => items.push({ x: r.x, y: r.y, size: r.size / (R.unit * 0.66), detail: 0, v: i % R.variants, role: 'talus' }));
  let distinct = 0;
  for (let i = 0; i < R.boulders; i++) {
    const y = D * (0.12 + 0.76 * (i + hash3(i, 5, S + 31)) / R.boulders), side = hash3(i, 6, S + 37) < 0.5 ? -1 : 1;
    const x = trailX(y) + side * (halfWAt(y) + fringeAt(y) + 1 + 2 * hash3(i, 7, S + 41)), inside = inRadius(x, y);
    items.push({ x, y, size: 1.3 + 1.1 * hash3(i, 8, S + 43), detail: inside ? 1 : 0, v: inside ? distinct++ % R.variants : i % R.variants, role: 'boulder' });
  }
  for (const f of foci.filter((f) => f.gate)) R.gate.sizes.forEach((size, k) => {
    const side = k ? 1 : -1, y = f.y + (k ? 0.8 : -0.6), x = trailX(y) + side * (halfWAt(y) + R.gate.off + size * 0.35);
    items.push({ x, y, size, detail: 1, v: distinct++ % R.variants, role: 'gate' });
  });
  const np = Math.round(D * R.pebbles.perMetre);
  for (let i = 0; i < np; i++) {
    const y = D * hash3(i, 9, S + 47), side = hash3(i, 10, S + 53) < 0.5 ? -1 : 1;
    const x = trailX(y) + side * (halfWAt(y) * (0.75 + 0.6 * hash3(i, 11, S + 59)));
    items.push({ x, y, size: mix(R.pebbles.size[0], R.pebbles.size[1], hash3(i, 12, S + 61)), detail: 0, v: i % R.variants, role: 'pebble' });
  }
  return items.map((it) => ({ ...it, x: r5(it.x), y: r5(it.y), size: r5(it.size), z0: r5(ground(it.x, it.y)) }));
}

export function rockFaces(st, items) {
  const R = st.rubble, tint = hexRgb(R.tone), out = [];
  const pools = [0, 1].map((detail) => (items.some((i) => i.detail === detail) ? rockPool({ rock: R.rock, variants: R.variants, detail, tone: R.tone, seed: 'trail-rock', group: 'trail:rock' }) : null));
  for (const it of items) {
    const s = it.size * R.unit, sink = (it.role === 'pebble' ? 0.15 : 0.3) * s, centre = [it.x, it.y, it.z0 + s * 0.3];
    for (const f of pools[it.detail][it.v].faces) {
      const cs = f.corners.map((p) => P([it.x + p[0] * s, it.y + p[1] * s, it.z0 - sink + p[2] * s]));
      // a field rock carries no normal: take the facet's, turned away from the stone's centre
      const mid = cs.reduce((a, p) => [a[0] + p[0] / cs.length, a[1] + p[1] / cs.length, a[2] + p[2] / cs.length], [0, 0, 0]);
      const n = f.outNormal || (cs.length >= 4 ? facet(cs, sub(mid, centre)) : facet([cs[0], cs[1], cs[2], cs[2]], sub(mid, centre)));
      out.push({ corners: cs, normal: n, outNormal: n, tint, group: 'trail:rock', doubleSided: true, ...(it.detail ? { detail: 1 } : {}) });
    }
  }
  return out;
}

/** Tree positions: cluster centres by rejection (apart from each other, the trail and the cliff), 3–7 trees each. */
export function treeItems(st, site, seed) {
  const T = st.trees, { W, D, trailDist, cliffX, apronAt } = site, S = seed | 0, centres = [], trees = [];
  const ok = (x, y, clear) => x > cliffX(y) + T.clearCliff && x < W - 1 && y > 1 && y < D - 1 && trailDist(x, y) > clear && apronAt(x, y) < 0.02;
  for (let i = 0; i < 400 && centres.length < T.clusters; i++) {
    const x = W * hash3(i, 1, S + 51), y = D * hash3(i, 2, S + 53);
    if (ok(x, y, T.clearTrail + T.spread * 0.6) && centres.every((c) => Math.hypot(c[0] - x, c[1] - y) > T.spread * 2.6)) centres.push([x, y]);
  }
  centres.forEach(([cx, cy], ci) => {
    const want = T.perCluster[0] + Math.floor(hash3(ci, 3, S + 57) * (T.perCluster[1] - T.perCluster[0] + 1));
    for (let k = 0, tries = 0; k < want && tries < 60; tries++) {
      const a = 2 * Math.PI * hash3(ci * 97 + tries, 4, S + 59), r = T.spread * Math.sqrt(hash3(ci * 97 + tries, 5, S + 61));
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (!ok(x, y, T.clearTrail) || trees.some((t) => Math.hypot(t.x - x, t.y - y) < 1.7)) continue;
      const h = mix(T.heights[0], T.heights[1], (1 - r / T.spread) * 0.6 + 0.4 * hash3(ci * 97 + tries, 6, S + 67));
      trees.push({ x: r5(x), y: r5(y), h: r5(h), v: (ci + k) % T.variants, cluster: ci });
      k++;
    }
  });
  return trees;
}

function treeFaces(st, site, trees) {
  const T = st.trees, pool = plantPool({ species: T.species, variants: T.variants, seed: 'trail', light: FLAT_LIGHT, maxLevel: T.level });
  const out = [];
  for (const t of trees) {
    const z = site.ground(t.x, t.y) - 0.15;
    for (const f of pool.variants[t.v].levels[T.level]) {
      // the pool's flat fill is the albedo (textured bark falls back to its tile's mean: no bark tile on this page),
      // pulled halfway to the style's foliage colour so every tree sits in the palette
      const albedo = hexRgb(f.texture ? f.plainFill : f.fill).map((v, k) => mix(v, T.foliage[k], f.texture ? 0.2 : 0.5));
      out.push({ corners: f.corners.map((p) => P([t.x + p[0] * t.h, t.y + p[1] * t.h, z + p[2] * t.h])), normal: f.outNormal, outNormal: f.outNormal, tint: albedo, group: 'trail:tree', doubleSided: true });
    }
  }
  return out;
}

// ── the spruce as the era stood it: grown wood, needle cards ──────────────────────
/** A chain kept at points about `step` apart along it (its first and last always): a grown axis has a node per
 *  internode, more rings than the eye needs. */
function thin(ch, step) {
  const keep = [0]; let run = 0;
  for (let i = 1; i < ch.pts.length - 1; i++) { run += Math.hypot(...sub(ch.pts[i], ch.pts[i - 1])); if (run >= step) { keep.push(i); run = 0; } }
  keep.push(ch.pts.length - 1);
  return { ...ch, pts: keep.map((i) => ch.pts[i]), rs: keep.map((i) => ch.rs[i]) };
}
const SPRUCE = new Map();
/** A grown spruce (vegetation/conifer.js): its trunk and limbs as chains, and its BOUGHS — per limb, where it leaves
 *  the trunk and how far its needled shoots reach. Memoized per (variant, stand). */
function grownSpruce(v, stand) {
  const k = `${v}:${stand}`; if (SPRUCE.has(k)) return SPRUCE.get(k);
  const p = growConifer('spruce', { seed: 11 + v * 29, stand }), chains = axisChains(p);
  const limbOf = (n) => { let m = n; while (m.order > 1) m = p.nodes[m.parent]; return m.order === 1 ? m.axis : -1; };
  const by = new Map(), chainOf = new Map(chains.map((c) => [c.axis, c]));
  for (const n of p.nodes) {
    if (n.died || !n.leaves || n.order < 1) continue;
    const a = limbOf(n); if (a < 0) continue;
    const b = by.get(a) || by.set(a, { tip: null, far: -1 }).get(a), ch = chainOf.get(a);
    const base = ch ? ch.pts[0] : n.pos, d = Math.hypot(n.pos[0] - base[0], n.pos[1] - base[1]);
    if (d > b.far) { b.far = d; b.tip = n.pos; b.base = base; }
  }
  const boughs = [...by.values()].filter((b) => b.far > 0.05).map((b) => ({ base: b.base, tip: b.tip }));
  const g = { H: p.H, trunk: chains.filter((c) => c.order === 0), limbs: chains.filter((c) => c.order === 1), boughs }; SPRUCE.set(k, g); return g;
}

/**
 * A SPRUCE: its grown trunk (barked near the trail) and, for its crown, BOUGH CARDS — the limbs binned by height band
 * and azimuth sector, one pair of cards per cell from where the limbs leave the trunk out to their needles' reach: one
 * tipped near flat (seen from below and above) and one standing on the bough's line (seen from the side, the walker's
 * view). Finer cells near the trail, coarser out in the valley; a crossed card at the leader. The light comes through
 * the cards' painted gaps (the sun bake reads their alpha), so the crown shades itself and dapples the ground.
 */
export function spruceFaces(st, site, trees) {
  const T = st.trees, Cd = T.cards, out = [], tile = barkTile(T.bark || 'spruce');
  for (const t of trees) {
    const first = out.length, g = grownSpruce(t.v, Cd.stand), s = t.h / g.H, yaw = 2 * Math.PI * hash3(t.v, Math.round(t.x * 10), Math.round(t.y * 10)), c = Math.cos(yaw), sn = Math.sin(yaw);
    const z0 = site.ground(t.x, t.y) - 0.15, near = site.trailDist(t.x, t.y) < Cd.near, R = near ? Cd.fine : Cd.coarse;
    const at = (q) => [t.x + (q[0] * c - q[1] * sn) * s, t.y + (q[0] * sn + q[1] * c) * s, z0 + q[2] * s];
    const rot = (n) => [n[0] * c - n[1] * sn, n[0] * sn + n[1] * c, n[2]].map(r5);
    const wood = [];
    for (const ch of g.trunk) for (const q of near ? barkQuads(thin(ch, Cd.seg / s), { sidesFor: () => 6, tile: tile.metres, color: tile.mean, key: tile.key }) : tubeTris(thin(ch, (2 * Cd.seg) / s), { sidesFor: () => 4, colorFor: () => [96, 78, 62] })) wood.push(q);
    if (near) for (const ch of g.limbs) if (ch.dMax >= Cd.limbD) for (const q of tubeTris(thin(ch, ch.pts.length), { sidesFor: () => 3, colorFor: () => [88, 72, 56] })) wood.push(q);
    for (const q of wood) {
      if (q.q) { const n = rot(q.n); out.push({ corners: q.q.map(at).map(P), normal: n, outNormal: n, texture: q.key, textureLit: true, uv: q.uv.map((u) => u.map((v) => r5(v * s))), tint: T.barkTint, group: 'trail:tree', doubleSided: true }); continue; }
      const cs = q.p.map(at).map(P), n = unit(cross(sub(cs[1], cs[0]), sub(cs[2], cs[0]))).map(r5);
      out.push({ corners: [...cs, cs[2]], normal: n, outNormal: n, tint: q.c.map((v, k) => r5((v / 255) * T.barkTint[k])), group: 'trail:tree', doubleSided: true });
    }
    // the crown: boughs binned, one card pair per cell
    const cells = new Map();
    for (const b of g.boughs) {
      const az = Math.atan2(b.tip[1] - b.base[1], b.tip[0] - b.base[0]), key = `${Math.floor((b.base[2] * s) / R.band)},${Math.floor(((az + Math.PI) / (2 * Math.PI)) * R.sectors) % R.sectors}`;
      const m = cells.get(key) || cells.set(key, { base: [0, 0, 0], d: [0, 0, 0], len: 0, n: 0 }).get(key), d = sub(b.tip, b.base), l = Math.hypot(d[0], d[1], d[2]);
      for (let k = 0; k < 3; k++) { m.base[k] += b.base[k]; m.d[k] += d[k] / l; }
      m.len = Math.max(m.len, l); m.n++;
    }
    [...cells.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).forEach(([, m], i) => {
      const base = at(m.base.map((v) => v / m.n)), d0 = unit(m.d), dir = unit(rot(d0)), len = m.len * s * R.reach;
      const side = unit(cross(dir, [0, 0, 1])), fin = unit(cross(side, dir)), tilt = mix(Cd.tilt[0], Cd.tilt[1], hash3(i, t.v, Math.round(t.x * 7)));
      const flat = side.map((v, k) => v * Math.cos(tilt) + fin[k] * Math.sin(tilt)), j = 0.9 + 0.2 * hash3(i, 3, Math.round(t.y * 7));
      const tint = Cd.tint.map((v) => v * j), foot = sub(base, dir.map((v) => v * len * 0.08));
      card(out, foot, flat, dir, len * Cd.width[0], len, 'card:bough', tint, 'trail:bough');
      card(out, [foot[0], foot[1], foot[2] - len * 0.06], fin, dir, len * Cd.width[1], len, 'card:bough', tint.map((v) => v * 0.94), 'trail:bough');
    });
    const top = at([0, 0, g.H]), lead = t.h * Cd.leader;
    crossed(out, [top[0], top[1], top[2] - lead], yaw, lead * 0.55, lead * 1.05, 'card:bough', Cd.tint, 'trail:bough');
    for (let i = first; i < out.length; i++) if (out[i].group === 'trail:bough') out[i].ax = [t.x, t.y];   // for the marks: how deep in its crown
  }
  return out;
}

function blazeFaces(st, site) {
  const out = [], B = st.blazes, { D, halfW, trailX, ground } = site;
  const post = { key: null, scale: 1, tint: B.post, group: 'trail:blaze' }, band = { ...post, tint: hexRgb(B.colour) };
  for (let y = B.every / 2, i = 0; y < D; y += B.every, i++) {
    const x = trailX(y) + (i % 2 ? -1 : 1) * (site.halfWAt(y) + 0.35), z = ground(x, y) - 0.2;
    box(out, [x - 0.07, y - 0.07, z], [x + 0.07, y + 0.07, z + 1.35], post, 0.5, ['-z']);
    box(out, [x - 0.08, y - 0.08, z + 1.08], [x + 0.08, y + 0.08, z + 1.24], band, 0.5, ['-z', '+z']);
  }
  return out.map(({ texture, textureLit, uv, ...f }) => f);
}

export function ridgeFaces(st, site) {
  const out = [], fog = hexRgb(st.air.fog.color);
  st.ridges.forEach((rg, i) => {
    const y = site.D + rg.at, col = rgbHex(rg.base.map((v, k) => mix(v / 255, fog[k], rg.fog)));
    for (let x = -160; x < site.W + 160; x += 4) {   // wide enough that no end of the card shows from inside the site
      const h = (u) => mix(rg.height[0], rg.height[1], vnoise(u * 0.035, i * 5 + 0.5, 91));
      out.push({ corners: [[x, y, -10], [x + 4, y, -10], [x + 4, y, h(x + 4)], [x, y, h(x)]].map(P), normal: [0, -1, 0], outNormal: [0, -1, 0], fill: col, group: 'trail:ridge' });
    }
  });
  return out;
}

/** Nature by cause → `(face, corner) => [r, g, b]` multipliers. */
export function natureMarks(st, site, sun, seed, trees = [], wet = []) {
  const S = seed | 0, { trailDist, cliffX, valley, apronAt } = site;
  const Sl = st.soil, Cd = st.trees && st.trees.cards, Gc = st.grass && st.grass.cards;
  return (f, c) => {
    const n = f.normal;
    if (Sl && f.group === 'trail:ground' && f.texture === st.tiles.trail.key) {
      // one soil: a value that wanders from the packed centre out to the floor under the grass, duff-dark under spruce
      const hw = site.halfWAt(c[1]), d = trailDist(c[0], c[1]);
      const wander = (vnoise(c[0] * 0.55, c[1] * 0.55, S + 411) - 0.5) * 2 * Sl.wander + (vnoise(c[0] * 2.3, c[1] * 2.3, S + 413) - 0.5) * 0.3;
      const w = smooth(hw * Sl.edge[0], hw + site.fringeAt(c[1]) + Sl.edge[1], d + wander);
      const packed = 1.1 - 0.22 * Math.min(1, (d / hw) ** 2), patch = 1 - Sl.patch + 2 * Sl.patch * vnoise(c[0] * 0.35, c[1] * 0.35, S + 415);
      const duff = trees.some((tr) => Math.hypot(tr.x - c[0], tr.y - c[1]) < 4.5) ? [0.86, 0.82, 0.76] : [1, 1, 1];
      const damp = wet.reduce((m, q) => Math.min(m, mix(0.7, 1, smooth(q.r * 0.7, q.r * 1.8, Math.hypot(q.x - c[0], q.y - c[1])))), 1);
      return [0, 1, 2].map((k) => mix(packed, Sl.floor[k] * patch, w) * mix(1, duff[k], w) * damp);
    }
    if (f.group === 'trail:grassblend') { const v = 0.8 + 0.32 * vnoise(c[0] * 0.3, c[1] * 0.3, S + 71); return [v, v, v]; }   // the meadow's own patches
    if (Cd && f.group === 'trail:bough') {
      // deep in the crown the boughs shade each other: dark at the trunk, lit at the tips
      const v = mix(Cd.inner, 1, smooth(0.3, 2.6, Math.hypot(c[0] - f.ax[0], c[1] - f.ax[1]))); return [v, v, v];
    }
    if (Gc && f.group === 'trail:grass') { const v = mix(Gc.foot, 1, smooth(0, 0.45, c[2] - site.ground(c[0], c[1]))); return [v, v, v * 0.96]; }
    if (f.group === 'trail:ground') {
      if (f.cls === 'trail') {
        const t = trailDist(c[0], c[1]) / site.halfWAt(c[1]); let v = 1.1 - 0.22 * t * t;                    // packed centre
        const duff = trees.some((tr) => Math.hypot(tr.x - c[0], tr.y - c[1]) < 4.5) ? 0.86 : 1;                  // needle litter under trees
        const damp = wet.reduce((m, w) => Math.min(m, mix(0.7, 1, smooth(w.r * 0.7, w.r * 1.8, Math.hypot(w.x - c[0], w.y - c[1])))), 1);   // wet soil round a puddle
        v *= duff * damp; return [v, v * (duff < 1 ? 0.95 : 0.98), v * (duff < 1 ? 0.88 : 0.95)];
      }
      if (f.cls === 'talus') { const v = 0.74 + 0.26 * smooth(0.5, 0.05, apronAt(c[0], c[1])); return [v, v, v]; }   // deeper scree reads darker
      const v = 0.8 + 0.32 * vnoise(c[0] * 0.3, c[1] * 0.3, S + 71);                                          // grass in patches
      return f.cls === 'fringe' ? [v * 0.95, v, v * 0.9] : [v, v, v];
    }
    if (f.group === 'trail:cliff' || f.group === 'trail:rock') {
      const shade = 1 - Math.max(0, n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2]);
      // moss takes the up-facing planes, more where the sun never reaches (a loose stone keeps its moss on top only)
      const moss = Math.min(1, Math.max(0, n[2]) * 0.7 + (f.group === 'trail:cliff' ? 0.45 * shade : 0.1 * shade)) * smooth(0.35, 0.75, vnoise(c[1] * 0.35, c[2] * 0.35, S + 73));
      let m = [1 - 0.22 * moss, 1 - 0.04 * moss, 1 - 0.32 * moss];
      if (f.group === 'trail:cliff') {
        const wet = 1 - smooth(0, 2.4, c[2] - valley(c[0], c[1]));   // the seep at the foot
        const streak = smooth(0.55, 0.8, vnoise(c[1] * 1.1, 3.3, S + 79)) * 0.3;
        m = m.map((v, k) => v * (1 - 0.34 * wet * (k === 2 ? 0.7 : 1)) * (1 - streak));
      }
      return m;
    }
    return [1, 1, 1];
  };
}

/**
 * GRASS as instanced tufts (the World's `repeats`): fescue along the trail's fringe, meadow grass in clumps, sedge at
 * the cliff foot. Templates are the grass ladder's tufts baked in the scene's sun at a few yaws; a tuft inside a
 * focus radius uses the fuller L1, outside L0. Each instance is tinted to the palette and darkened where the sun
 * shadow falls on its foot, so tufts sit in the shade of trees and boulders.
 */
export function grassRepeats(st, site, trees, rocks, sun, seed) {
  const G = st.grass, light = makeLight({ direction: sun.dir.map((v) => -v), ambient: 0.5, diffuse: 0.62 });
  // natural tufts, lit as a volume (the stylized ladder read as saturated blocks against the meadow tile)
  const ladders = Object.fromEntries(Object.entries(G.kinds).map(([zone, kind]) => [zone, grassLadder(kind, { seed: 3 })]));
  const tufts = grassTufts(st, site, trees, rocks, sun, seed).map((t) => ({ ...t, tint: G.tint[t.zone].map((v) => r5(v * (t.lit ? 1 : G.shade))) }));
  // group into one repeat per (zone, level, variant): the template is that tuft baked at that variant's yaw
  const groups = new Map();
  for (const t of tufts) { const k = `${t.zone}:${t.level}:${t.v}`; (groups.get(k) || groups.set(k, []).get(k)).push(t); }
  return [...groups.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([k, list]) => {
    const [zone, level, v] = k.split(':');
    const template = trisToFaces(ladders[zone][level], { light, yaw: (Number(v) * 2 * Math.PI) / G.variants, group: `trail:grass:${zone}` });
    return { template, transforms: list.map((t) => ({ pos: t.pos, scale: t.scale, tint: t.tint })), group: `trail:grass:${k}` };
  });
}

/**
 * GRASS AS CARDS (a style's `grass.cards`): each tuft a star of painted cutout cards (leaf-cards.js) — three inside a
 * focus radius, two outside — lit and shadowed by the stage bake like every face, so a tuft in a tree's shade is in
 * it (instanced tufts keep the light they were baked in and read lit in the shade).
 */
export function grassCards(st, site, tufts, seed) {
  const G = st.grass, Gc = G.cards, S = seed | 0, out = [];
  tufts.forEach((t, i) => {
    const h = t.scale * Gc.height, key = Gc.keys[t.zone];
    crossed(out, [t.pos[0], t.pos[1], t.pos[2] - 0.03], Math.PI * hash3(i, 61, S + 157), h * Gc.width, h, key, G.tint[t.zone].map((v) => v * (0.9 + 0.2 * hash3(i, 63, S + 163))), 'trail:grass', t.level === 'L1' ? 3 : 2);
  });
  return out;
}

/** Where the tufts stand, each { zone, level, v, pos, scale, lit }: the fringe, meadow clumps, sedge at the cliff foot,
 *  and a scatter outside the radii. */
export function grassTufts(st, site, trees, rocks, sun, seed) {
  const G = st.grass, S = seed | 0, { D, W, trailX, trailDist, halfWAt, fringeAt, cliffX, ground, inRadius } = site;
  const placed = new Map(), cellOf = (x, y) => `${Math.floor(x / G.spacing)},${Math.floor(y / G.spacing)}`;
  const free = (x, y) => {
    if (placed.has(cellOf(x, y))) return false;
    if (trees.some((t) => Math.hypot(t.x - x, t.y - y) < 0.6) || rocks.some((r) => r.role !== 'pebble' && Math.hypot(r.x - x, r.y - y) < r.size * st.rubble.unit * 0.35)) return false;
    placed.set(cellOf(x, y), 1); return true;
  };
  const tufts = [];
  const add = (zone, x, y, i) => {
    if (x < 0 || y < 0 || x > W || y > D || !free(x, y)) return;
    const z = ground(x, y), lit = sun.shadow([x, y, z + 0.25], [0, 0, 1]);
    const h = mix(G.height[0], G.height[1], hash3(i, 31, S + 101)) * (zone === 'cliff' ? 1.2 : 1);
    tufts.push({ zone, level: inRadius(x, y) ? 'L1' : 'L0', v: i % G.variants, pos: [r5(x), r5(y), r5(z - 0.03)], scale: r5(h * (zone === 'scatter' ? 0.7 : 1)), lit });
  };
  // the fringe: both edges of the trail, every `fringeEvery` metres, inside the fringe band
  let i = 0;
  for (let y = 0.3; y < D; y += G.fringeEvery) for (const side of [-1, 1]) {
    const off = halfWAt(y) + fringeAt(y) * (0.15 + 0.85 * hash3(i, 33, S + 103));
    add('fringe', trailX(y) + side * off, y + (hash3(i, 35, S + 107) - 0.5) * 0.3, i++);
  }
  // meadow clumps: centres in the grass (never on the trail or the talus), more tufts inside a radius
  for (let c = 0; c < G.clusters; c++) {
    const cx = W * hash3(c, 41, S + 109), cy = D * hash3(c, 43, S + 113);
    if (trailDist(cx, cy) < halfWAt(cy) + fringeAt(cy) + 0.6 || cx < cliffX(cy) + st.cliff.talus + 0.5) continue;
    const n = Math.round(mix(G.perCluster[0], G.perCluster[1], hash3(c, 47, S + 127)) * (inRadius(cx, cy) ? G.insideBoost : 1));
    for (let k = 0; k < n; k++) {
      const a = 2 * Math.PI * hash3(c * 61 + k, 49, S + 131), r = 1.6 * Math.sqrt(hash3(c * 61 + k, 51, S + 137));
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (trailDist(x, y) > halfWAt(y) + fringeAt(y)) add('meadow', x, y, i++);
    }
  }
  // sedge along the apron's edge, where the seep keeps the foot of the talus wet
  for (let y = 0.5; y < D; y += 0.8) {
    let x = cliffX(y) + 2; while (x < cliffX(y) + 16 && site.apronAt(x, y) > st.landform.apronMin) x += 0.25;
    add('cliff', x + 0.6 * hash3(i, 53, S + 139), y, i++);
  }
  // a sparse scatter of small tufts over the meadow OUTSIDE the radii (repetition is allowed there), so the tile never
  // reads flat between the clumps
  for (let k = 0; k < Math.round(W * D * G.scatter); k++) {
    const x = W * hash3(k, 55, S + 149), y = D * hash3(k, 57, S + 151);
    if (!inRadius(x, y) && trailDist(x, y) > halfWAt(y) + fringeAt(y) + 0.3 && x > cliffX(y) + 1 && site.apronAt(x, y) < st.landform.apronMin) add('scatter', x, y, i++);
  }
  return tufts;
}

/** Soft contact-shadow blobs under every boulder and tree (the World's shadow-decal pass), so nothing floats. */
export function contactShadows(st, site, trees, rocks) {
  const C = st.contact, out = [];
  const blob = (x, y, half, alpha) => {
    const z = site.ground(x, y) + 0.05;
    out.push({ corners: [[x - half, y - half, z], [x + half, y - half, z], [x + half, y + half, z], [x - half, y + half, z]].map(P), normal: [0, 0, 1], decal: 'shadow', shadowAlpha: alpha, group: 'trail:shadow' });
  };
  for (const r of rocks) if (r.role !== 'pebble') blob(r.x, r.y, r.size * st.rubble.unit * 0.6, C.rock);
  for (const t of trees) blob(t.x, t.y, 0.9 + t.h * 0.09, C.tree);
  return out;
}

// ── debris on and beside the trail ──────────────────────────────────────────────
/** A tube along a polyline (radius per point), `sides`-gon, as tinted quads — roots and sticks. */
export function tube(out, pts, radii, sides, tint, group) {
  for (let k = 0; k + 1 < pts.length; k++) {
    const a = pts[k], b = pts[k + 1], d = unit(sub(b, a)), up = Math.abs(d[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
    const u = unit(cross(d, up)), v = cross(u, d);
    const ring = (p, r, i) => { const t = (2 * Math.PI * i) / sides; return P([p[0] + (u[0] * Math.cos(t) + v[0] * Math.sin(t)) * r, p[1] + (u[1] * Math.cos(t) + v[1] * Math.sin(t)) * r, p[2] + (u[2] * Math.cos(t) + v[2] * Math.sin(t)) * r]); };
    for (let i = 0; i < sides; i++) {
      const tm = (2 * Math.PI * (i + 0.5)) / sides, n = unit([u[0] * Math.cos(tm) + v[0] * Math.sin(tm), u[1] * Math.cos(tm) + v[1] * Math.sin(tm), u[2] * Math.cos(tm) + v[2] * Math.sin(tm)]);
      out.push({ corners: [ring(a, radii[k], i), ring(a, radii[k], i + 1), ring(b, radii[k + 1], i + 1), ring(b, radii[k + 1], i)], normal: n, outNormal: n, tint, group, doubleSided: true });
    }
  }
}
/**
 * The trail's debris, each piece with a cause: roots from trees that stand near the trail run out across its edge; a
 * fallen spruce lies in the fringe by the gate (barked); sticks and cones drop under the trees nearest the trail; flat
 * stones surface where the trail has worn down to them.
 */
export function debrisFaces(st, site, trees, seed) {
  const out = [], Db = st.debris, S = seed | 0, { D, trailX, trailDist, halfWAt, fringeAt, ground, foci } = site;
  const wood = Db.wood, near = trees.filter((t) => trailDist(t.x, t.y) < Db.rootReach);
  // roots: two or three per near tree, each a tapering half-buried tube that bends toward the trail and stops in it
  near.forEach((t, ti) => {
    const roots = 2 + Math.floor(hash3(ti, 1, S + 301) * 2), toward = Math.sign(trailX(t.y) - t.x) || 1;
    for (let r = 0; r < roots; r++) {
      // the root runs out to the trail's edge and a hand's width onto it, then dives: it surfaces, it is not a rail
      const ang = (hash3(ti, r + 2, S + 303) - 0.5) * 1.1, len = trailDist(t.x, t.y) - halfWAt(t.y) * (0.7 + 0.2 * hash3(ti, r + 5, S + 307));
      const pts = [], radii = [], segs = 8;
      for (let k = 0; k <= segs; k++) {
        const f = k / segs, x = t.x + toward * Math.cos(ang) * len * f, y = t.y + Math.sin(ang) * len * f + Math.sin(f * 4 + r) * 0.22;
        const rad = mix(Db.root[1], Db.root[0], f), dive = f > 0.85 ? (f - 0.85) / 0.15 * rad * 1.5 : 0;
        // with `rootDive`, a root surfaces in pieces along its run and goes under between them
        const under = Db.rootDive ? (1 - smooth(0.5, 0.62, vnoise(f * len * 2.2, r * 3.1 + ti * 1.7, S + 309))) * rad * Db.rootDive : 0;
        pts.push([x, y, ground(x, y) + 0.05 - rad * 0.55 - dive - under]); radii.push(rad);   // mostly buried: a ridge in the soil
      }
      tube(out, pts, radii, 5, wood, 'trail:debris');
    }
  });
  // the fallen log: lying in the fringe a little past the gate, its trunk barked, its cut ends pale
  for (const f of foci.filter((f) => f.gate)) {
    const y0 = f.y + Db.log.after, side = -1, off = halfWAt(y0) + fringeAt(y0) + Db.log.r + 0.2;
    const a = [trailX(y0) + side * off, y0], yaw = Db.log.yaw * Math.PI / 180;
    const b = [a[0] + side * Math.sin(yaw) * Db.log.len, a[1] + Math.cos(yaw) * Db.log.len];
    const za = ground(a[0], a[1]) + Db.log.r * 0.75, zb = ground(b[0], b[1]) + Db.log.r * 0.75;
    const A = [a[0], a[1], za], B = [b[0], b[1], zb], d = unit(sub(B, A)), u = unit(cross(d, [0, 0, 1])), v = cross(u, d), sides = 8, R = Db.log.r;
    const ring = (p, i) => { const t = (2 * Math.PI * i) / sides; return P([p[0] + (u[0] * Math.cos(t) + v[0] * Math.sin(t)) * R, p[1] + (u[1] * Math.cos(t) + v[1] * Math.sin(t)) * R, p[2] + (u[2] * Math.cos(t) + v[2] * Math.sin(t)) * R]); };
    const circ = 2 * Math.PI * R, segs = 4;
    for (let k = 0; k < segs; k++) for (let i = 0; i < sides; i++) {
      const p0 = [A[0] + (B[0] - A[0]) * k / segs, A[1] + (B[1] - A[1]) * k / segs, A[2] + (B[2] - A[2]) * k / segs];
      const p1 = [A[0] + (B[0] - A[0]) * (k + 1) / segs, A[1] + (B[1] - A[1]) * (k + 1) / segs, A[2] + (B[2] - A[2]) * (k + 1) / segs];
      const tm = (2 * Math.PI * (i + 0.5)) / sides, n = unit([u[0] * Math.cos(tm) + v[0] * Math.sin(tm), u[1] * Math.cos(tm) + v[1] * Math.sin(tm), u[2] * Math.cos(tm) + v[2] * Math.sin(tm)]);
      const L0 = (Db.log.len * k) / segs / Db.log.tile, L1 = (Db.log.len * (k + 1)) / segs / Db.log.tile, U0 = (circ * i) / sides / Db.log.tile, U1 = (circ * (i + 1)) / sides / Db.log.tile;
      quad(out, [ring(p0, i), ring(p0, i + 1), ring(p1, i + 1), ring(p1, i)], n, { key: Db.log.bark, scale: 1, tint: [1, 1, 1], group: 'trail:debris' }, null, null, [[U0, L0], [U1, L0], [U1, L1], [U0, L1]]);
    }
    for (const [p, sgn] of [[A, -1], [B, 1]]) for (let i = 0; i < sides; i += 2) {   // the cut ends, as four quads each
      const n = d.map((x) => x * sgn);
      out.push({ corners: [P(p), ring(p, i), ring(p, i + 1), ring(p, i + 2)], normal: n, outNormal: n, tint: Db.log.endTint, group: 'trail:debris' });
    }
  }
  // sticks and cones under the trees nearest the trail, spilling onto its edges
  near.forEach((t, ti) => {
    for (let k = 0; k < Db.litter; k++) {
      const a = 2 * Math.PI * hash3(ti * 31 + k, 11, S + 311), r = 1 + 3.2 * hash3(ti * 31 + k, 12, S + 313);
      const x = t.x + Math.cos(a) * r, y = t.y + Math.sin(a) * r, z = ground(x, y) + 0.06;
      if (trailDist(x, y) > halfWAt(y) + fringeAt(y) + 1.5) continue;
      if (hash3(ti * 31 + k, 13, S + 317) < 0.6) {   // a stick
        const yaw = Math.PI * hash3(ti * 31 + k, 14, S + 319), len = 0.25 + 0.45 * hash3(ti * 31 + k, 15, S + 323);
        tube(out, [[x, y, z], [x + Math.cos(yaw) * len, y + Math.sin(yaw) * len, z + 0.01]], [0.02, 0.012], 3, wood, 'trail:debris');
      } else {                                          // a cone: a little four-sided spindle on its side
        const yaw = Math.PI * hash3(ti * 31 + k, 16, S + 329);
        tube(out, [[x, y, z], [x + Math.cos(yaw) * 0.05, y + Math.sin(yaw) * 0.05, z], [x + Math.cos(yaw) * 0.1, y + Math.sin(yaw) * 0.1, z]], [0.012, 0.03, 0.008], 4, Db.cone, 'trail:debris');
      }
    }
  });
  // flat stones the trail has worn down to: irregular slabs just proud of the ribbon, more often on slopes
  for (let y = 1, i = 0; y < D; y += Db.slabs.every, i++) {
    if (hash3(i, 21, S + 331) > Db.slabs.chance) continue;
    const c = [trailX(y) + (hash3(i, 22, S + 337) - 0.5) * halfWAt(y), y], sz = mix(Db.slabs.size[0], Db.slabs.size[1], hash3(i, 23, S + 347)), rot = Math.PI * hash3(i, 24, S + 349);
    const cs = [0, 1, 2, 3].map((k) => { const t = rot + (k * Math.PI) / 2 + (hash3(i, 25 + k, S + 353) - 0.5) * 0.6, r = sz * (0.4 + 0.25 * hash3(i, 30 + k, S + 359)); const x = c[0] + Math.cos(t) * r, yy = c[1] + Math.sin(t) * r; return [x, yy, ground(x, yy) + 0.075]; });
    quad(out, cs, facet(cs, [0, 0, 1]), { key: Db.slabs.key, scale: 0.8, tint: Db.slabs.tint, group: 'trail:debris' }, null, null, cs.map((p) => [p[0] / 0.8, p[1] / 0.8]));
  }
  return out;
}

/** Where water stands: low points on the trail inside a focus radius (a cause: the trail dips). */
export function puddleSpots(st, site) {
  return (st.debris.puddles || []).map((p) => { const f = site.foci.find((q) => q.name === p.focus); const y = f.y + p.dy; return { x: site.trailX(y) + p.dx, y, r: p.r }; });
}
/** A puddle as a feathered water sheet: opaque-ish at its heart, clear at its rim (per-corner alpha), sky-tinted. */
export function puddleFaces(st, site, spots) {
  const out = [], n = 6;
  for (const w of spots) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const pt = (a, b) => { const u = (a / n - 0.5) * 2, v = (b / n - 0.5) * 2; const x = w.x + u * w.r * 1.3, y = w.y + v * w.r; return [x, y, site.ground(x, y) + 0.065]; };
    const al = (a, b) => { const u = (a / n - 0.5) * 2, v = (b / n - 0.5) * 2; return r5(Math.max(0, 0.7 * (1 - smooth(0.45, 1, Math.hypot(u, v) + 0.12 * vnoise(a, b, 7))))); };
    out.push({ corners: [pt(i, j), pt(i + 1, j), pt(i + 1, j + 1), pt(i, j + 1)].map(P), normal: [0, 0, 1], water: true, fill: st.debris.water, cornerAlpha: [al(i, j), al(i + 1, j), al(i + 1, j + 1), al(i, j + 1)], group: 'trail:water' });
  }
  return out;
}

/** manifest → World payload, for a stage whose kit is a nature kit. */
export function assembleNatureScene(manifest = {}, ctx = {}) {
  const st = NATURE_STYLES[manifest.style || 'nature-trail'];
  if (!st) throw new Error(`stage: unknown nature style '${manifest.style}' (known: ${Object.keys(NATURE_STYLES).join(', ')})`);
  const seed = Number.isFinite(manifest.seed) ? manifest.seed : 1;
  const site = natureSite(st, seed), trees = treeItems(st, site, seed);
  const rocks = rockItems(st, site, seed);
  const puddles = puddleSpots(st, site);
  let ground = groundFaces(st, site), ribbon = trailFaces(st, site);
  if (st.trail.dice > 1) ribbon = ribbon.flatMap((f) => dice(f, st.trail.dice));
  if (st.grassBlend) [ground, ribbon] = oneSoil(st, site, ground, ribbon);
  const raw = [...ground, ...ribbon, ...rockFaces(st, rocks), ...(st.trees.cards ? spruceFaces(st, site, trees) : treeFaces(st, site, trees)), ...blazeFaces(st, site), ...debrisFaces(st, site, trees, seed)];
  const key = st.light.key, dir = sunDir(key.elevation, key.azimuth);
  // a card stops the sun only where its painted needles are; grass is no occluder
  const shadow = makeSunShadow(raw, dir, { cell: 0.6, ...(st.trees.cards ? { maskOf: (f) => (isCard(f) ? cardMask(f.texture) : null) } : {}) });
  const sun = { dir, rgb: hexRgb(key.color), gain: st.light.sunGain, bounce: st.light.bounce, bounceGain: st.light.bounceGain, shadow };
  const ambient = hexRgb(st.light.ambient).map((v) => v * st.light.fill);
  // grass as cards stands in the bake (after the sun: it grows where it is placed, shaded where the shade falls)
  if (st.grass.cards) raw.push(...grassCards(st, site, grassTufts(st, site, trees, rocks, sun, seed), seed));
  // a leaf is lit from either side (it lets the light through): its card faces the sun, and lifts a little on its own
  const faced = [...raw, ...(st.grassBlend ? grassBlendFaces(st, site, raw, trees, seed) : [])].map((f) => {
    if (!isCard(f)) return f;
    const d = f.normal[0] * dir[0] + f.normal[1] * dir[1] + f.normal[2] * dir[2], n = d < 0 ? f.normal.map((v) => -v) : f.normal, lift = 1 + (st.light.leafLift || 0);
    return { ...f, normal: n, outNormal: n, tint: f.tint.map((v) => v * lift) };
  });
  const lit = ctx.unshaded
    ? faced.map(({ tint, cls, ax, ...f }) => ({ ...f, fill: rgbHex(tint) }))
    : bakeStageLight(faced, [], ambient, natureMarks(st, site, dir, seed, trees, puddles), sun).map(({ cls, detail, ax, ...f }) => f);
  const decals = contactShadows(st, site, trees, rocks);
  const y0 = 2.5, x0 = site.trailX(y0), y1 = 28, x1 = site.trailX(y1);
  const eye = [x0, y0, site.ground(x0, y0) + 1.7];
  const faces = [...lit, ...decals, ...puddleFaces(st, site, puddles), ...ridgeFaces(st, site)];
  const cutouts = [...new Set(faces.filter(isCard).map((f) => f.texture))].sort();
  return {
    faces,
    ...(st.grass.cards ? {} : { repeats: grassRepeats(st, site, trees, rocks, sun, seed) }),
    ...(cutouts.length ? { cutouts } : {}),
    // the sky's weather: mojulo's cloud deck over the mesh, lit by the style's own sun (an overlay layer: the World
    // page draws it, exports carry none)
    ...(st.clouds ? { effects: [composeCloudDeck([], { up: 'z', ...st.clouds, sun: dir })] } : {}),
    lights: [],
    cameras: [manifest.camera || { name: 'trail', worldFraming: { cameraPosition: eye.map(r5), lookAt: [x1, y1, site.ground(x1, y1) + 3].map(r5), horizontalFov: 75, pictureCenter: [560, 390] } }],
    viewBox: manifest.viewBox || { width: 1120, height: 780 },
    title: ctx.title || manifest.title || 'mojulo stage · nature trail',
    bg: rgbHex(st.air.dome.horizon.map((v) => v / 255)),
    haze: { color: st.air.fog.color, density: st.air.fog.density },
    sky: { zenith: st.air.dome.zenith, horizon: st.air.dome.horizon, day: 1, stars: 0, seed: 1 },
    glow: false,
    // the spawn is at EYE height: the trail ribbon floats over a cut-away ground, so a spawn at ground level would
    // cast its first floor ray from under the ribbon, find nothing, and fall through
    walk: manifest.walk === false ? false : { speed: 6, spawn: eye.map(r5), minEye: 1.7, gravity: 22, radius: 0.4 },
  };
}
