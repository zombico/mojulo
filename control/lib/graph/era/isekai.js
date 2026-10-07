/**
 * ISEKAI — the open-field anime look of the current era (Genshin Impact, Breath of the Wild: current-gen.js), built
 * from sixth-gen parts to a STYLE CARD (style/isekai-meadow.js). The `isekai-meadow` kit of the stage kind.
 *
 * The site is the nature trail's (nature.js): one landform heightfield with a cliff by geology, the trail ribbon, the
 * rock and tree and tuft placements. What differs is how it is DRAWN:
 *   palette   every baked colour on the ground, the trail, the scree, the trees and the far ridges is projected onto
 *             its ramp (palette.js): light moves a colour along its ramp, never off it
 *   cliffs    the landform's steep facets, PIXEL-LOCKED: drawn unlit in `isekai:` strata tiles painted only in the
 *             rock ramp's stops (isekai-tiles.js). Each facet takes the lit or the shade tile by the sun's Lambert ×
 *             its cast shadow — the cel band is the choice of tile, and the screen shows nothing but palette texels
 *   rocks     NEW chunky boulders: an irregular footprint lofted through foot, belly and shoulder rings to a flat top,
 *             their sides pixel-locked the same way
 *   hats      a boulder big enough wears one: its top cap is a grass tile and a ragged grass FRINGE drapes over its
 *             shoulder; every cliff LIP (a grass cell above a cliff cell) drapes the same fringe down the face
 *   grass     tufts as crossed blade cards, pixel-locked, lit or shade by the shadow at the tuft's root
 *   trees     a crown of overlapping round masses on a short trunk, baked and locked to the foliage ramp
 *   layers    the far ridges painted from the far ramp; a thin haze; the sky dome from the sky ramp; a high cloud deck
 * Deterministic: integer-hash dice, pooled plants from fixed seeds.
 */
import { ISEKAI_STYLES, isekaiMask } from './isekai-tiles.js';
import { hash3, vnoise } from './dirt.js';
import { P, r5, hexRgb, rgbHex, crossed } from './geom.js';
import { makeSunShadow, sunDir } from './sun.js';
import { bakeStageLight } from './stage.js';
import { natureSite, trailFaces, trailRims, rockItems, treeItems, grassTufts, tube } from './nature.js';
import { blobTris } from '../vegetation/tree-mesh.js';
import { lockFaces } from './palette.js';
import { gridX, gridY } from '../polygonizer/landform.js';
import { composeCloudDeck } from '../effects/effects-clouds.js';
import { resolveTerrainWind, windPageChannel } from '../vegetation/wind.js';
import { grassLadder } from '../vegetation/grass.js';
import { outTrailSite, streamFaces, outTrailPayload, outTrailCamera } from './out-trail.js';

export { ISEKAI_STYLES };
const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const addv = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mean = (cs) => cs.reduce((a, p) => [a[0] + p[0] / cs.length, a[1] + p[1] / cs.length, a[2] + p[2] / cs.length], [0, 0, 0]);
/** A quad's facet normal (from its diagonals; a doubled last corner makes it a triangle's), turned to face `toward`. */
const facet = (c, toward) => {
  const n = c[2] === c[3] || (c[2][0] === c[3][0] && c[2][1] === c[3][1] && c[2][2] === c[3][2]) ? unit(cross(sub(c[1], c[0]), sub(c[2], c[0]))) : unit(cross(sub(c[2], c[0]), sub(c[3], c[1])));
  return dot(n, toward) < 0 ? n.map((v) => -v) : n;
};
export const isekaiKeyOf = (st, tile, lit) => `isekai:${st.id}:${tile}-${lit ? 'lit' : 'shade'}`;
const stopFill = (st, tile, lit) => { const T = st.tiles[tile], ramp = st.palette[T.ramp], w = T[lit ? 'lit' : 'shade']; return rgbHex(ramp[w[Math.floor(w.length / 2)]].map((v) => v / 255)); };

/**
 * The GROUND as the landform grid's facets. Steep facets are cliff (pixel-locked, `cel: 'cliff'`, uv up the face along
 * its own horizontal); the talus apron is scree; the rest is grass. The trail's corridor is left to its ribbon. Each
 * cliff LIP — the edge a grass cell shares with a cliff cell that falls away below it — is returned with the way down.
 */
export function isekaiGround(st, site) {
  const out = [], lips = [], { grid: g, trailDist, halfWAt, W } = site, sc = st.tiles.cliff.scale;
  const at = (i, j) => [gridX(g, i), gridY(g, j), g.z[j * g.nx + i]];
  const cls = new Map(), nrm = new Map(), cell = (i, j) => [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
  for (let j = 0; j + 1 < g.ny; j++) for (let i = 0; i + 1 < g.nx; i++) {
    const cs = cell(i, j);
    if (cs[0][0] > W) continue;
    const n = facet(cs, [0, 0, 1]);
    if (n[2] < st.slope.rock) {
      const h = Math.abs(n[0]) > Math.abs(n[1]) ? 1 : 0;
      out.push({ corners: cs.map(P), normal: n.map(r5), outNormal: n.map(r5), cel: 'cliff', uv: cs.map((p) => [r5(p[h] / sc), r5(p[2] / sc)]), group: 'isekai:cliff', ij: [i, j] });
      cls.set(j * g.nx + i, 'cliff'); nrm.set(j * g.nx + i, n);
      continue;
    }
    cls.set(j * g.nx + i, 'grass');
    if (cs.every((p) => trailDist(p[0], p[1]) < halfWAt(p[1]))) continue;   // wholly under the trail ribbon
    const apron = (g.apron[j * g.nx + i] + g.apron[(j + 1) * g.nx + i + 1]) / 2;
    const scree = apron > st.landform.apronMin;
    out.push({ corners: cs.map(P), normal: n.map(r5), outNormal: n.map(r5), tint: scree ? st.tint.scree : st.tint.ground, group: scree ? 'isekai:scree' : 'isekai:ground' });
  }
  // the cel normal of a cliff facet: the mean of the cliff's normals within `cliffCelR` cells
  const Rc = st.cliffCelR || 0;
  for (const f of out) if (f.ij) {
    const [i, j] = f.ij; let m = [0, 0, 0];
    for (let dj = -Rc; dj <= Rc; dj++) for (let di = -Rc; di <= Rc; di++) { const q = nrm.get((j + dj) * g.nx + i + di); if (q && i + di >= 0 && i + di + 1 < g.nx) m = addv(m, q); }
    f.celN = unit(m); delete f.ij;
  }
  // lips: a grass cell's edge shared with a cliff cell whose centre lies below that edge
  const edgeOf = { '1,0': [1, 2], '-1,0': [3, 0], '0,1': [2, 3], '0,-1': [0, 1] };
  for (let j = 0; j + 1 < g.ny; j++) for (let i = 0; i + 1 < g.nx; i++) {
    if (cls.get(j * g.nx + i) !== 'grass') continue;
    const cs = cell(i, j);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni + 1 >= g.nx || nj + 1 >= g.ny || cls.get(nj * g.nx + ni) !== 'cliff') continue;
      const [a, b] = edgeOf[`${di},${dj}`].map((k) => cs[k]), m = mean([a, b]), below = mean(cell(ni, nj));
      if (below[2] > m[2] - 0.2) continue;   // the cliff cell rises from here: a foot, not a lip
      lips.push({ a, b, down: unit(sub(below, m)), out: unit([di, dj, 0]) });
    }
  }
  return { faces: out, lips };
}

/**
 * A BOULDER, drawn new: a footprint of `sides` points (each its own radius and a jittered angle) lofted through the
 * style's rings — [height share, radius share] from the sunk foot to the flat top — leaning a little, the top tilted.
 * → { sides: faces (cel 'rock'), cap: faces, rim: [{ a, b, s }] } (the rim edges with the shoulder point below each).
 */
export function boulderFaces(st, it, seed) {
  const B = st.boulder, R = st.rubble, s = it.size * R.unit, k = Math.round(it.x * 13 + it.y * 7) + it.v * 101, S = seed | 0;
  const n = B.sides[0] + Math.floor(hash3(k, 1, S + 701) * (B.sides[1] - B.sides[0] + 1));
  const h = s * mix(B.height[0], B.height[1], hash3(k, 2, S + 703)) * (it.tall || 1), sink = B.sink * s;   // a landmark stands `tall`
  const lean = [(hash3(k, 3, S + 707) - 0.5) * 2 * B.lean * s, (hash3(k, 4, S + 709) - 0.5) * 2 * B.lean * s];
  const tilt = [(hash3(k, 5, S + 711) - 0.5) * 0.16, (hash3(k, 6, S + 713) - 0.5) * 0.16], yaw = 2 * Math.PI * hash3(k, 7, S + 719);
  const foot = Array.from({ length: n }, (_, i) => {
    const a = yaw + (2 * Math.PI * (i + 0.35 * (hash3(k, 10 + i, S + 721) - 0.5))) / n, r = 0.5 * s * (0.74 + 0.42 * hash3(k, 40 + i, S + 723));
    return [Math.cos(a) * r, Math.sin(a) * r];
  });
  // each ring wobbles on its own, so no two facets of a side line up into a barrel
  const rings = B.rings.map(([t, sh], ri) => foot.map(([x, y], i) => {
    const w = sh * (1 + (B.wobble || 0) * 2 * (hash3(k, 80 + ri * 17 + i, S + 727) - 0.5));
    const z = ri === 0 ? it.z0 - sink : it.z0 + t * h + (ri === B.rings.length - 1 ? tilt[0] * x + tilt[1] * y : 0);
    return P([it.x + x * w + lean[0] * t, it.y + y * w + lean[1] * t, z]);
  }));
  const centre = [it.x, it.y, it.z0 + h * 0.4], sc = st.tiles.rock.scale, sides = [], cap = [], rim = [];
  // u runs round the belly, so a side's tile is continuous from facet to facet
  const belly = rings[1], arc = [0]; for (let i = 0; i < n; i++) arc.push(arc[i] + Math.hypot(belly[(i + 1) % n][0] - belly[i][0], belly[(i + 1) % n][1] - belly[i][1]));
  for (let r = 0; r + 1 < rings.length; r++) for (let i = 0; i < n; i++) {
    const i1 = (i + 1) % n, cs = [rings[r][i], rings[r][i1], rings[r + 1][i1], rings[r + 1][i]];
    const nn = facet(cs, sub(mean(cs), centre));
    sides.push({ corners: cs, normal: nn.map(r5), outNormal: nn.map(r5), cel: 'rock', uv: [[arc[i], cs[0][2]], [arc[i + 1], cs[1][2]], [arc[i + 1], cs[2][2]], [arc[i], cs[3][2]]].map(([u, v]) => [r5(u / sc), r5(v / sc)]), group: 'isekai:rock', size: s });
  }
  const top = rings[rings.length - 1], sh = rings[rings.length - 2], c = P(mean(top)), hs = st.tiles.hat.scale;
  for (let i = 0; i < n; i++) {
    const i1 = (i + 1) % n, cs = [c, top[i], top[i1], top[i1]], nn = facet(cs, [0, 0, 1]);
    cap.push({ corners: cs, normal: nn.map(r5), outNormal: nn.map(r5), uv: cs.map((p) => [r5(p[0] / hs), r5(p[1] / hs)]), group: 'isekai:rock', size: s });
    rim.push({ a: top[i], b: top[i1], a2: sh[i], b2: sh[i1], s });
  }
  return { sides, cap, rim, s };
}

/** A FRINGE draped from edge a–b toward a2–b2 (each `len` down that way at most), stood `out` off the surface. */
function drape(out, a, b, a2, b2, len, off, n, key, scale, group) {
  const da = sub(a2, a), db = sub(b2, b), la = Math.hypot(...da), lb = Math.hypot(...db);
  const A2 = addv(a, mul(da, Math.min(1, len / (la || 1)))), B2 = addv(b, mul(db, Math.min(1, len / (lb || 1))));
  const o = mul(n, off), w = Math.hypot(...sub(b, a)) / scale;
  out.push({ corners: [addv(A2, o), addv(B2, o), addv(b, o), addv(a, o)].map(P), normal: n.map(r5), outNormal: n.map(r5), uv: [[0, 0], [r5(w), 0], [r5(w), 1], [0, 1]], key, group, doubleSided: true });
}

/** manifest → World payload, for a stage whose kit is an isekai kit. */
export function assembleIsekaiScene(manifest = {}, ctx = {}) {
  const st = ISEKAI_STYLES[manifest.style || 'isekai-meadow'];
  if (!st) throw new Error(`stage: unknown isekai style '${manifest.style}' (known: ${Object.keys(ISEKAI_STYLES).join(', ')})`);
  const seed = Number.isFinite(manifest.seed) ? manifest.seed : 1, S = seed | 0;
  // a recipe's `trail` (out-trail.js) builds the site from the trail grammar; absent, the style's own trail
  const site = manifest.trail !== undefined ? outTrailSite(st, manifest.trail, seed) : natureSite(st, seed), key = st.light.key, dir = sunDir(key.elevation, key.azimuth);
  // ── the geometry ──
  const ground = isekaiGround(st, site);
  const plainTiles = { trail: { key: null, scale: 1, tint: st.tint.trail }, fringe: { key: null, scale: 1, tint: st.tint.ground } };
  const ribbon = trailFaces({ ...st, tiles: plainTiles }, site).map(({ texture, textureLit, uv, cls, ...f }) => ({ ...f, tint: cls === 'trail' ? st.tint.trail : st.tint.ground, group: cls === 'trail' ? 'isekai:trail' : 'isekai:ground', cls }));
  // a named stone (the trail's landmark) carries its node on every face
  const named = (fs, it) => (it.node ? fs.map((f) => ({ ...f, node: it.node })) : fs);
  const rocks = rockItems(st, site, seed), boulders = rocks.map((it) => { const b = boulderFaces(st, it, seed); return { it, ...b, sides: named(b.sides, it), cap: named(b.cap, it) }; });
  // the TREES, by the card's form: round-mass crowns (the meadow's), bamboo culms with leaf sprays, or sakura
  const form = st.trees.form || 'blob', bamboo = form === 'bamboo';
  const trees = bamboo ? bambooItems(st, site, seed) : treeItems(st, site, seed);
  // the HERO: one big tree where the eye lands, its crown fuller than the rest
  // a sakura grove has HEROES (several, framed, the grove's trees kept clear of them); the meadow one
  const Hr = st.trees.hero, sakura = form === 'blossom' && st.trees.sakura;
  if (sakura) {
    const Hs = st.trees.heroes.map((H) => ({ x: r5(site.trailX(H.y) + H.side * (site.halfWAt(H.y) + H.off)), y: H.y, h: H.h, v: 0, cluster: -1, hero: true }));
    for (let i = trees.length - 1; i >= 0; i--) if (Hs.some((H) => Math.hypot(H.x - trees[i].x, H.y - trees[i].y) < st.trees.heroClear)) trees.splice(i, 1);
    trees.push(...Hs);
  } else if (Hr) { const x = site.trailX(Hr.y) + Hr.side * (site.halfWAt(Hr.y) + Hr.off); trees.push({ x: r5(x), y: Hr.y, h: Hr.h, v: 0, cluster: -1, hero: true }); }
  const grove = bamboo ? bambooFaces(st, site, trees) : null;
  const sak = sakura ? sakuraFaces(st, site, trees) : null;
  const wood = bamboo || sak ? [] : treeFaces(st, site, trees);
  const solid = [...ground.faces, ...ribbon, ...boulders.flatMap((b) => [...b.sides, ...b.cap]), ...wood, ...(grove ? [...grove.culms, ...grove.sprays] : []), ...(sak ? [...sak.wood, ...sak.clumps, ...sak.sprigs] : [])];
  // a spray (or a sprig) stops the sun only where its leaves (its flowers) are painted: the floor under it is dappled
  const cardMask = grove ? 'spray' : sak ? 'sprig' : null;
  const shadow = makeSunShadow(solid, dir, cardMask ? { cell: 0.6, maskOf: (f) => (f.cel === cardMask ? isekaiMask(isekaiKeyOf(st, cardMask, true)) : null) } : { cell: 0.6 });
  const sun = { dir, rgb: hexRgb(key.color), gain: st.light.sunGain, bounce: st.light.bounce, bounceGain: st.light.bounceGain, shadow };
  const reach = (p, n) => Math.max(0, dot(n, dir)) * shadow(addv(p, mul(n, 0.05)), n);
  const lit = (p, n) => reach(p, n) >= st.cel;
  // ── the pixel-locked faces: the cel band is the choice of tile ──
  const cel = [];
  const draw = (f, tile, isLit) => { const { cel: _c, size: _s, key: _k, celN: _n, ...rest } = f; cel.push({ ...rest, texture: isekaiKeyOf(st, tile, isLit), fill: stopFill(st, tile, isLit) }); };
  for (const f of ground.faces) if (f.cel === 'cliff') draw(f, 'cliff', lit(mean(f.corners), f.celN));
  const H = st.hat, fringes = [];
  for (const b of boulders) {
    for (const f of b.sides) draw(f, 'rock', lit(mean(f.corners), f.normal));
    const hatted = b.s >= st.boulder.minHat;
    for (const f of b.cap) draw(f, hatted ? 'hat' : 'rock', lit(mean(f.corners), f.normal));
    if (hatted) for (const e of b.rim) {
      const n = facet([e.a, e.b, e.b2, e.a2], sub(mean([e.a, e.b]), [b.it.x, b.it.y, b.it.z0]));
      drape(fringes, e.a, e.b, e.a2, e.b2, H.fringe * b.s, H.out, n, null, H.scale, 'isekai:hat');
      fringes[fringes.length - 1].lit = lit(mean([e.a, e.b]), [0, 0, 1]) && dot(n, dir) > -0.35;
    }
  }
  const Lp = st.lip;
  for (const l of ground.lips) {
    drape(fringes, l.a, l.b, addv(l.a, mul(l.down, Lp.fringe * 2)), addv(l.b, mul(l.down, Lp.fringe * 2)), Lp.fringe, Lp.out, l.out, null, Lp.scale, 'isekai:lip');
    fringes[fringes.length - 1].lit = lit(mean([l.a, l.b]), [0, 0, 1]) && dot(l.out, dir) > -0.35;
  }
  for (const f of fringes) { const { lit: L, key: _k, ...rest } = f; cel.push({ ...rest, texture: isekaiKeyOf(st, 'fringe', L), fill: stopFill(st, 'fringe', L) }); }
  if (grove) {
    for (const f of grove.culms) draw(f, 'culm', lit(mean(f.corners), f.normal));
    // a spray's band: the sun at its heart (a card is lit from either side; its painted gaps let light through)
    for (const f of grove.sprays) draw(f, 'spray', shadow(addv(mean(f.corners), [0, 0, 0.05]), [0, 0, 1]) > 0);
  }
  if (sak) {
    // the grown sakura: bark by the sun on each facet; a clump's skin by its SPHERICAL normal (the clump's and the
    // crown's, blended — the crown lit as a few big shapes); a sprig by the same normal at its heart
    for (const f of sak.wood) draw(f, 'bark', lit(mean(f.corners), f.normal));
    // (the sun is asked from out past the skin by `probe` × the clump's radius: clumps overlap, and a point on one
    // skin lies inside its neighbours)
    // and blossom is thin: it takes the light at its own, lower `cel` (the sun wraps round a clump)
    const { probe: pr, cel: bc } = st.trees.sakura;
    for (const f of sak.clumps) { const { sn, r, ...rest } = f; draw(rest, 'bloom', reach(addv(mean(f.corners), mul(sn, pr * r)), sn) >= bc); }
    for (const f of sak.sprigs) { const { sn, at, r, ...rest } = f; draw(rest, 'sprig', reach(addv(at, mul(sn, pr * r)), sn) >= bc); }
  }
  // PETALS: litter under each sakura, flat cutout cards, the band by the shade each lies in
  if (st.trees.petals) for (const f of petalFaces(st, site, trees)) draw(f, 'petals', shadow(addv(mean(f.corners), [0, 0, 0.3]), [0, 0, 1]) > 0);
  // grass: crossed blade cards, the band by the shadow at the root
  const tufts = grassTufts(st, site, trees, rocks, sun, seed), G = st.grass.cards;
  tufts.forEach((t, i) => {
    const raw = [], h = t.scale * G.height;
    crossed(raw, [t.pos[0], t.pos[1], t.pos[2] - 0.03], Math.PI * hash3(i, 61, S + 157), h * G.width, h, isekaiKeyOf(st, 'blades', t.lit), [1, 1, 1], 'isekai:grass', t.level === 'L1' ? 3 : 2);
    for (const { tint, textureLit, ...f } of raw) cel.push({ ...f, fill: stopFill(st, 'blades', t.lit) });
  });
  // the FIELD: within `reach` of the trail the meadow stands as one sea of blades, a tuft on a jittered grid every
  // `every` metres (never on the ribbon, a rock or a trunk), the band by the shadow at its root
  const F = st.grass.field;
  if (F) {
    let i = 0;
    for (let y = 0.2; y < site.D; y += F.every) for (let x = 0; x < site.W; x += F.every, i++) {
      const px = x + (hash3(i, 71, S + 181) - 0.5) * F.every, py = y + (hash3(i, 73, S + 191) - 0.5) * F.every, d = site.trailDist(px, py), edge = site.halfWAt(py) + site.fringeAt(py);
      if (d < edge || d > edge + F.reach * (0.75 + 0.5 * vnoise(px * 0.2, py * 0.2, S + 193))) continue;
      if (site.apronAt(px, py) > st.landform.apronMin || px < site.cliffX(py) + 1) continue;
      if (rocks.some((r) => r.role !== 'pebble' && Math.hypot(r.x - px, r.y - py) < r.size * st.rubble.unit * 0.55) || trees.some((t) => Math.hypot(t.x - px, t.y - py) < 0.5)) continue;
      const z = site.ground(px, py), lt = shadow([px, py, z + 0.3], [0, 0, 1]) > 0, h = mix(F.height[0], F.height[1], hash3(i, 75, S + 197)) * G.height;
      const raw = [];
      crossed(raw, [px, py, z - 0.03], Math.PI * hash3(i, 77, S + 199), h * G.width, h, isekaiKeyOf(st, 'blades', lt), [1, 1, 1], 'isekai:grass', 2);
      for (const { tint, textureLit, ...f } of raw) cel.push({ ...f, fill: stopFill(st, 'blades', lt) });
    }
  }
  // ── the bake, then the lock ──
  const ambient = hexRgb(st.light.ambient).map((v) => v * st.light.fill);
  const plain = [...ground.faces.filter((f) => !f.cel), ...ribbon, ...wood];
  const baked = bakeStageLight(plain, [], ambient, isekaiMarks(st, site, S), sun).map(({ cls, ...f }) => f);
  // the TRAIL BLEND: the soil's rim out over the grass and the grass's creep in over the trail, each in the stop nearest
  // the baked colour of the lane it carries on — the trail's along the edge for the rim, the fringe's for the creep —
  // so the blend is the two materials meeting, not a third laid between them
  if (st.trailBlend) {
    const rb = baked.slice(ground.faces.filter((f) => !f.cel).length).slice(0, ribbon.length), strips = trailRims(st, site, seed);
    if (strips.length !== ribbon.length) throw new Error('isekai: the trail blend steps with the ribbon (trailBlend.step 0.75)');
    // per station the ribbon is [fringe −, trail −, trail +, fringe +] and the strips [bleed −, over −, bleed +, over +];
    // a lane's corners on the edge: the inner pair of a fringe, the outer pair of a trail lane
    const from = [[1, [0, 3]], [0, [1, 2]], [2, [1, 2]], [3, [0, 3]]];
    strips.forEach(({ band, side: _s, mid: _m, ...f }, i) => {
      const [lane, edge] = from[i % 4], L = rb[i - (i % 4) + lane], tile = band === 'bleed' ? 'rim' : 'creep', ramp = st.palette[st.tiles[tile].ramp];
      const cs = L.cornerFills ? edge.map((c) => hexRgb(L.cornerFills[c])) : [hexRgb(L.fill)], rgb = mean(cs.map((c) => [...c])).map((v) => v * 255);
      const k = ramp.reduce((b, s, j) => (Math.hypot(...s.map((v, q) => v - rgb[q])) < Math.hypot(...ramp[b].map((v, q) => v - rgb[q])) ? j : b), 0);
      cel.push({ ...f, texture: `isekai:${st.id}:${tile}-s${k}`, fill: rgbHex(ramp[k].map((v) => v / 255)), group: band === 'bleed' ? 'isekai:trail' : 'isekai:ground', doubleSided: true });
    });
  }
  const ridges = layerFaces(st, site, dir);
  if (st.cumulus) for (const f of cumulusFaces(st, site, dir)) cel.push(f);
  const faces = [...lockFaces([...baked, ...cel, ...ridges], (f) => (st.lock[f.group] ? st.palette[st.lock[f.group]] : null)), ...(site.out ? streamFaces(site, st) : [])];
  const cutouts = [...new Set(faces.filter((f) => /^isekai:.*:(fringe|blades|cumulus|spray|petals|sprig|rim|creep)-/.test(f.texture || '')).map((f) => f.texture))].sort();
  // ── the frame ──
  const Fr = st.frame || { look: 28, top: { y: 22, lookY: 48 } };
  const y0 = 2.5, x0 = site.trailX(y0), y1 = Fr.look, x1 = site.trailX(y1), eye = [x0, y0, site.ground(x0, y0) + 1.7];
  const ly = Fr.top.y, lx = site.cliffX(ly) - 1.6, lip = [lx, ly, site.ground(lx, ly) + 1.7];
  const sky = st.palette.sky, Fh = Fr.hero, heroCam = [];
  if (Fh && sak) {
    // the HERO frame: from the trail short of the hero, up into its crown
    const t = trees.filter((q) => q.hero)[Fh.tree], hy = t.y - Fh.back, hx = site.trailX(hy), at = [hx, hy, site.ground(hx, hy) + Fh.eye];
    heroCam.push({ name: 'hero', worldFraming: { cameraPosition: at.map(r5), lookAt: [t.crownAt[0], t.crownAt[1], t.crownAt[2] - 0.2 * t.crownR].map(r5), horizontalFov: Fh.fov, pictureCenter: [560, 390] } });
  }
  return {
    faces,
    cutouts,
    ...(st.clouds ? { effects: [composeCloudDeck([], { up: 'z', ...st.clouds, sun: dir })] } : {}),
    lights: [],
    cameras: [manifest.camera || (site.out ? outTrailCamera(site) : { name: 'trail', worldFraming: { cameraPosition: eye.map(r5), lookAt: [x1, y1, site.ground(x1, y1) + 3].map(r5), horizontalFov: 75, pictureCenter: [560, 390] } }),
      { name: 'cliff-top', worldFraming: { cameraPosition: lip.map(r5), lookAt: [site.W * 0.75, Fr.top.lookY, site.ground(site.W * 0.75, Fr.top.lookY)].map(r5), horizontalFov: 75, pictureCenter: [560, 390] } }, ...heroCam],
    viewBox: manifest.viewBox || { width: 1120, height: 780 },
    title: ctx.title || manifest.title || `mojulo stage · ${st.id.replace('-', ' ')}`,
    bg: rgbHex(sky[sky.length - 1].map((v) => v / 255)),
    haze: { color: st.air.fog.color, density: st.air.fog.density },
    sky: { zenith: sky[0], horizon: sky[sky.length - 1], day: 1, stars: 0, seed: 1, ...(st.sun ? { sun: { dir: dir.map(r5), size: st.sun.size, glow: st.sun.glow } } : {}) },
    glow: false,
    pack: true,
    ...(manifest.wind ? { liveGrass: liveGrassConfig(st, site, rocks, trees, shadow, manifest.wind, seed) } : {}),
    walk: manifest.walk === false ? false : { speed: 6, spawn: eye.map(r5), minEye: 1.7, gravity: 22, radius: 0.4 },
    ...(site.out ? outTrailPayload(site) : {}),
  };
}

/**
 * The far LAYERS: rings of standing panels round the site's centre, each a stop of the far ramp (its own colour: the
 * haze is thin and does not make the depth), its skyline a ridged noise round the ring — peaks, not lumps.
 */
export function layerFaces(st, site, dir = [0, 0, 1]) {
  const out = [], c = [site.W / 2, site.D / 2], base = Math.hypot(site.W, site.D) / 2, far = st.palette.far;
  const hexOf = (stop) => rgbHex(stop.map((v) => v / 255));
  // where a ray from the centre leaves the site's ground (the landform grid's rectangle), a little inside it
  const g = site.grid, x0 = gridX(g, 0), x1 = gridX(g, g.nx - 1), y0 = gridY(g, 0), y1 = gridY(g, g.ny - 1);
  const edge = (a) => {
    const d = [Math.cos(a), Math.sin(a)], t = Math.min(d[0] > 0 ? (x1 - c[0]) / d[0] : d[0] < 0 ? (x0 - c[0]) / d[0] : Infinity, d[1] > 0 ? (y1 - c[1]) / d[1] : d[1] < 0 ? (y0 - c[1]) / d[1] : Infinity) - 0.6;
    const x = c[0] + d[0] * t, y = c[1] + d[1] * t; return [x, y, site.ground(x, y) - 0.25];
  };
  st.layers.forEach((L, li) => {
    const R = base + L.at, n = Math.max(64, Math.round((2 * Math.PI * R) / 6)), fill = hexOf(far[L.stop]);
    const sky = (k) => { const a = (2 * Math.PI * k) / n, q = vnoise(Math.cos(a) * L.peaks + 9, Math.sin(a) * L.peaks + li * 7, 917 + li), ridged = 1 - Math.abs(2 * q - 1); return mix(L.height[0], L.height[1], ridged * ridged); };
    const at = (k, z) => { const a = (2 * Math.PI * k) / n; return [c[0] + Math.cos(a) * R, c[1] + Math.sin(a) * R, z]; };
    for (let k = 0; k < n; k++) {
      const a = (2 * Math.PI * (k + 0.5)) / n, nn = [-Math.cos(a), -Math.sin(a), 0].map(r5);
      if (!L.skirt) { out.push({ corners: [at(k, -20), at(k + 1, -20), at(k + 1, sky(k + 1)), at(k, sky(k))].map(P), normal: nn, outNormal: nn, fill, group: 'isekai:ridge' }); continue; }
      // a SKIRT: land from the site's own edge out to the layer's skyline, in bands of its own colours — the near
      // ones the meadow's grass, the far ones the layer's
      const pt = (kk, t) => { const e = edge((2 * Math.PI * kk) / n), r = at(kk, sky(kk)); return [mix(e[0], r[0], t), mix(e[1], r[1], t), mix(e[2], r[2], Math.pow(t, 1.6))]; };
      L.skirt.forEach((band, bi) => {
        const t0 = bi / L.skirt.length, t1 = (bi + 1) / L.skirt.length, cs = [pt(k, t0), pt(k + 1, t0), pt(k + 1, t1), pt(k, t1)].map(P);
        const up = facetN(cs, [0, 0, 1]), grass = band.ramp === 'grass';
        out.push({ corners: cs, normal: up, outNormal: up, fill: hexOf(st.palette[band.ramp][band.stop]), group: grass ? 'isekai:ground' : 'isekai:ridge', doubleSided: true });
      });
    }
    // CLUMPS of trees out on the skirt (the background's few chosen things): a few crowns each, every facet one of
    // two foliage stops by whether it turns to the sun
    if (L.skirt && L.clumps) {
      const Cl = L.clumps, fol = st.palette.foliage, pt = (kk, t) => { const e = edge((2 * Math.PI * kk) / n), r = at(kk, sky(kk)); return [mix(e[0], r[0], t), mix(e[1], r[1], t), mix(e[2], r[2], Math.pow(t, 1.6))]; };
      for (let ci = 0; ci < Cl.n; ci++) {
        const h = (q) => hash3(ci, q, 1409 + li), k0 = n * (ci + 0.7 * (h(1) - 0.5)) / Cl.n, m = Cl.trees[0] + Math.floor(h(2) * (Cl.trees[1] - Cl.trees[0] + 1));
        for (let ti = 0; ti < m; ti++) {
          const kk = k0 + (h(10 + ti) - 0.5) * Cl.spread, t = mix(Cl.band[0], Cl.band[1], h(30 + ti)), foot = pt(kk, t), r = mix(Cl.size[0], Cl.size[1], h(50 + ti));
          for (const b of [[0, 0, 1.1], [0.45, 0.2, 0.75], [-0.4, -0.25, 0.8]]) for (const tri of blobTris([foot[0] + b[0] * r, foot[1] + b[1] * r, foot[2] + r * 0.45 * b[2]], [r * b[2] * 0.6, r * b[2] * 0.6, r * b[2] * 0.5], null)) {
            const cs = tri.p.map(P), nn = facetN(cs, [cs[0][0] - foot[0], cs[0][1] - foot[1], cs[0][2] - foot[2] - r * 0.6]);
            out.push({ corners: cs, normal: nn, outNormal: nn, fill: hexOf(fol[dot(nn, dir) > 0.2 ? Cl.stops[1] : Cl.stops[0]]), group: 'isekai:crown' });
          }
        }
      }
    }
  });
  return out;
}

const b64 = (a) => ({ __b64: Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64'), t: a.constructor.name });
/**
 * The LIVE GRASS the World page stands round the walker with `wind` (scene/channels/stage-grass.js): the ground as the
 * landform grid's heights, and per cell a mask — bit 0: grass may stand (not the cliff, the scree apron, the trail's
 * packed ribbon, a rock's footprint or a trunk); bit 1: the sun reaches it — the stylized meadow's grown tufts (positions
 * only: the colour is the ramp's, by height), the grass ramp and its lit and shade windows, the wind and its grass taker,
 * and the crowns that sway.
 */
export function liveGrassConfig(st, site, rocks, trees, shadow, wind, seed = 1) {
  const L = st.live, g = site.grid, nx = g.nx, ny = g.ny, x0 = gridX(g, 0), y0 = gridY(g, 0), cell = gridX(g, 1) - x0;
  let lo = Infinity, hi = -Infinity; for (const z of g.z) { lo = Math.min(lo, z); hi = Math.max(hi, z); }
  const zsc = Math.max(1e-6, (hi - lo) / 65535), zq = Int16Array.from(g.z, (z) => Math.round((z - lo) / zsc) - 32768);
  const m = new Uint8Array((nx - 1) * (ny - 1)), node = (i, j) => [gridX(g, i), gridY(g, j), g.z[j * nx + i]];
  for (let j = 0; j + 1 < ny; j++) for (let i = 0; i + 1 < nx; i++) {
    const cs = [node(i, j), node(i + 1, j), node(i + 1, j + 1), node(i, j + 1)], c = mean(cs), n = facet(cs, [0, 0, 1]);
    if (c[0] > site.W || n[2] < st.slope.rock) continue;
    if ((g.apron[j * nx + i] + g.apron[(j + 1) * nx + i + 1]) / 2 > st.landform.apronMin) continue;
    if (site.trailDist(c[0], c[1]) < site.halfWAt(c[1]) + 0.1) continue;
    if (rocks.some((r) => r.role !== 'pebble' && Math.hypot(r.x - c[0], r.y - c[1]) < r.size * st.rubble.unit * 0.5 + 0.15)) continue;
    if (trees.some((t) => Math.hypot(t.x - c[0], t.y - c[1]) < 0.45)) continue;
    m[j * (nx - 1) + i] = 1 | (shadow([c[0], c[1], c[2] + 0.3], [0, 0, 1]) > 0 ? 2 : 0);
  }
  // the grown tufts, positions only, quantized; a variant's levels index into the templates
  const templates = [], variants = [];
  for (let v = 0; v < L.variants; v++) {
    const lad = grassLadder(L.kind, { seed: 17 + 31 * v, style: 'stylized' }), yaw = (v * 2 * Math.PI) / L.variants, cy = Math.cos(yaw), sy = Math.sin(yaw), ids = {};
    for (const lv of ['L2', 'L1', 'L0']) {
      const P = lad[lv].flatMap((t) => t.p.flatMap((q) => [q[0] * cy - q[1] * sy, q[0] * sy + q[1] * cy, q[2]]));
      const plo = [0, 1, 2].map((k) => Math.min(...P.filter((_, i) => i % 3 === k))), phi = [0, 1, 2].map((k) => Math.max(...P.filter((_, i) => i % 3 === k)));
      const sc = plo.map((l, k) => Math.max(1e-9, (phi[k] - l) / 65535));
      templates.push({ lo: plo.map(r5), sc, q: b64(Int16Array.from(P, (x, i) => Math.round((x - plo[i % 3]) / sc[i % 3]) - 32768)), H: r5(phi[2]), tris: lad[lv].length });
      ids[lv] = templates.length - 1;
    }
    variants.push(ids);
  }
  const spec = resolveTerrainWind(wind === true ? { debris: false } : { ...wind, debris: false });
  const W = windPageChannel(spec, { grassKinds: [L.kind] }), T = st.tiles.blades;
  return {
    grid: { x0: r5(x0), y0: r5(y0), cell: r5(cell), nx, ny, zlo: r5(lo), zsc, z: b64(zq), m: b64(m) },
    ramp: st.palette.grass, win: L.win || { lit: [T.lit[0], T.lit[T.lit.length - 1]], shade: [T.shade[0], T.shade[T.shade.length - 1]] },
    templates, variants, size: 1.2, radius: L.radius, near: L.near, tile: L.tile, density: L.density, height: L.height, px: L.px, drawTris: L.drawTris, seed: seed | 0,
    sheen: L.sheen, part: L.part, taker: W.grass[0],
    // the sakura's PETALS: falling from under each crown, and the CARPET lying round the walker
    ...(L.petals && st.trees.form === 'blossom' ? { petals: petalConfig(st, site, rocks, trees, shadow, L.petals, seed) } : {}), cards: ['isekai:grass'], crowns: L.crowns ? { groups: ['isekai:crown', 'isekai:wood'], ...L.crowns } : null, wind: W,
  };
}

/**
 * The sakura's live PETALS (stage-grass.js): the falling ones' sources (a crown's centre and radius), the blossom ramp
 * and the petal tile's lit and shade windows of it, the sun; with a `carpet`, a grid over the landform's cells — the low
 * six bits the petals' density there (by the nearest crown's spread × the carpet's `reach`: the wind carries them past
 * the crown; heaped in PILES — drifts, the trail's edges, the trunks' feet — and thin on open grass; none on the cliff,
 * the apron or a rock), bit 6 the sun reaching it.
 */
function petalConfig(st, site, rocks, trees, shadow, Pt, seed = 1) {
  const T = st.tiles.petals, dir = sunDir(st.light.key.elevation, st.light.key.azimuth), { carpet, ...rest } = Pt;
  const out = { ...rest, sources: trees.filter((t) => t.crownAt).map((t) => [...t.crownAt, t.crownR]), ramp: st.palette.blossom,
    win: { lit: [T.lit[0], T.lit[T.lit.length - 1]], shade: [T.shade[0], T.shade[T.shade.length - 1]] }, sun: dir.map(r5) };
  if (!carpet) return out;
  const g = site.grid, nx = g.nx, ny = g.ny, m = new Uint8Array((nx - 1) * (ny - 1)), node = (i, j) => [gridX(g, i), gridY(g, j), g.z[j * nx + i]], reach = carpet.reach;
  for (let j = 0; j + 1 < ny; j++) for (let i = 0; i + 1 < nx; i++) {
    const cs = [node(i, j), node(i + 1, j), node(i + 1, j + 1), node(i, j + 1)], c = mean(cs), n = facet(cs, [0, 0, 1]);
    if (c[0] > site.W || n[2] < st.slope.rock || (g.apron[j * nx + i] + g.apron[(j + 1) * nx + i + 1]) / 2 > st.landform.apronMin) continue;
    if (rocks.some((r) => r.role !== 'pebble' && Math.hypot(r.x - c[0], r.y - c[1]) < r.size * st.rubble.unit * 0.5 + 0.1)) continue;
    let w = 0, base = 0;
    for (const t of trees) if (t.spread) {
      const r = Math.hypot(t.x - c[0], t.y - c[1]), d = r / (t.spread * reach);
      if (d < 1) w = Math.max(w, Math.sqrt(1 - d * d));
      if (r < carpet.base) base = 1;
    }
    // PILES, not a sheet: petals gather in drifts (a patch noise), along the trail's edges and round the trunks' feet;
    // on open grass only a `grass` share of them (the grass stays the ground's read), on the trodden middle of the trail
    // a `trodden` share
    const off = site.trailDist(c[0], c[1]) - site.halfWAt(c[1]), edge = Math.abs(off) < carpet.edge ? 1 : 0;
    const pile = smooth(carpet.drift[0], carpet.drift[1], vnoise(c[0] * carpet.drift[2], c[1] * carpet.drift[2], (seed | 0) + 1231));
    w *= Math.max(pile, edge, base) * (off > carpet.edge ? carpet.grass : off < -carpet.edge ? carpet.trodden : 1);
    const q = Math.round(w * 63);
    if (q) m[j * (nx - 1) + i] = q | (shadow([c[0], c[1], c[2] + 0.3], [0, 0, 1]) > 0 ? 64 : 0);
  }
  out.carpet = { ...carpet, m: b64(m) };
  return out;
}

/**
 * THE PAINTED SKY: cumulus as cutout cards on a ring past the far layers, each facing the site's centre, pixel-locked
 * (the `cumulus` tile). A card within `towardSun`° of the sun's azimuth is seen from its shaded side.
 */
export function cumulusFaces(st, site, dir) {
  const out = [], c = [site.W / 2, site.D / 2], Cu = st.cumulus, sunAz = Math.atan2(dir[1], dir[0]);
  Cu.tiers.forEach((T, ti) => {
    for (let i = 0; i < T.n; i++) {
      const h = (k) => hash3(i, k, 1301 + ti * 17);
      const az = (2 * Math.PI * (i + 0.6 * (h(1) - 0.5))) / T.n, R = mix(T.at[0], T.at[1], h(2)), z = mix(T.base[0], T.base[1], h(3));
      const w = mix(T.width[0], T.width[1], h(4)), ht = w * T.tall, p = [c[0] + Math.cos(az) * R, c[1] + Math.sin(az) * R, z];
      const along = [-Math.sin(az), Math.cos(az), 0], n = [-Math.cos(az), -Math.sin(az), 0].map(r5);
      const d = Math.abs(((az - sunAz + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) * 180 / Math.PI, isLit = d > Cu.towardSun;
      const a = mul(along, w / 2);
      out.push({ corners: [sub(p, a), addv(p, a), addv(addv(p, a), [0, 0, ht]), addv(sub(p, a), [0, 0, ht])].map(P), normal: n, outNormal: n, uv: [[0, 0], [1, 0], [1, 1], [0, 1]], texture: isekaiKeyOf(st, 'cumulus', isLit), fill: stopFill(st, 'cumulus', isLit), group: 'isekai:cloud', doubleSided: true });
    }
  });
  return out;
}

/**
 * BAMBOO: where the culms stand — clump centres by rejection (clear of the path, the bank and each other), then
 * `perCluster` culms within `spread` of each, at least `gap` apart. → [{ x, y, h, v, cluster }] (the trees' shape).
 */
export function bambooItems(st, site, seed) {
  const T = st.trees, S = seed | 0, { W, D, trailDist, cliffX, apronAt, halfWAt } = site, centres = [], out = [];
  const ok = (x, y, clear) => x > cliffX(y) + T.clearCliff && x < W - 0.5 && y > 0.5 && y < D - 0.5 && trailDist(x, y) > halfWAt(y) + clear && apronAt(x, y) < 0.02;
  for (let i = 0; i < 600 && centres.length < T.clusters; i++) {
    const x = W * hash3(i, 1, S + 1051), y = D * hash3(i, 2, S + 1053);
    if (ok(x, y, T.clearTrail + T.spread) && centres.every((c) => Math.hypot(c[0] - x, c[1] - y) > T.spread * 3)) centres.push([x, y]);
  }
  centres.forEach(([cx, cy], ci) => {
    const want = T.perCluster[0] + Math.floor(hash3(ci, 3, S + 1057) * (T.perCluster[1] - T.perCluster[0] + 1));
    for (let k = 0, tries = 0; k < want && tries < 80; tries++) {
      const a = 2 * Math.PI * hash3(ci * 113 + tries, 4, S + 1059), r = T.spread * Math.sqrt(hash3(ci * 113 + tries, 5, S + 1061)), x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (!ok(x, y, T.clearTrail) || out.some((t) => Math.hypot(t.x - x, t.y - y) < T.gap)) continue;
      out.push({ x: r5(x), y: r5(y), h: r5(mix(T.heights[0], T.heights[1], hash3(ci * 113 + tries, 6, S + 1063))), v: k % T.variants, cluster: ci }); k++;
    }
  });
  return out;
}

/**
 * BAMBOO, drawn: each culm a `sides`-faceted tube leaning a little out of its clump and bowed at the top, in segments
 * a node long (the `culm` tile, u round the pole, v up one internode: the node ring falls at every node); SPRAYS of
 * leaves as cutout cards fanned from its upper part, out and drooping. → { culms, sprays } (cel 'culm' / 'spray').
 */
export function bambooFaces(st, site, items) {
  const T = st.trees, Cu = T.culm, Sp = T.spray, culms = [], sprays = [];
  const centre = new Map(); for (const t of items) { const c = centre.get(t.cluster) || centre.set(t.cluster, [0, 0, 0]).get(t.cluster); c[0] += t.x; c[1] += t.y; c[2]++; }
  items.forEach((t, ti) => {
    const k = Math.round(t.x * 31 + t.y * 17) + ti * 7, z0 = site.ground(t.x, t.y) - 0.1, r = mix(Cu.r[0], Cu.r[1], hash3(k, 1, 1101)) * (t.h / T.heights[1]) ** 0.5;
    const cc = centre.get(t.cluster), away = unit([t.x - cc[0] / cc[2] + 1e-3, t.y - cc[1] / cc[2], 0]), lean = Math.tan(((Cu.lean * hash3(k, 2, 1103)) * Math.PI) / 180);
    const segs = Math.max(4, Math.round(t.h / (Cu.node * 4))), axis = (f) => [t.x + away[0] * (lean * t.h * f + Cu.bow * f * f), t.y + away[1] * (lean * t.h * f + Cu.bow * f * f), z0 + t.h * f];
    const ring = (f, i) => { const p = axis(f), a = (2 * Math.PI * i) / Cu.sides, rr = r * (1 - 0.35 * f); return P([p[0] + Math.cos(a) * rr, p[1] + Math.sin(a) * rr, p[2]]); };
    for (let sgi = 0; sgi < segs; sgi++) for (let i = 0; i < Cu.sides; i++) {
      const f0 = sgi / segs, f1 = (sgi + 1) / segs, cs = [ring(f0, i), ring(f0, i + 1), ring(f1, i + 1), ring(f1, i)];
      const nn = facet(cs, sub(mean(cs), axis((f0 + f1) / 2))), v0 = (t.h * f0) / Cu.node, v1 = (t.h * f1) / Cu.node;
      culms.push({ corners: cs, normal: nn.map(r5), outNormal: nn.map(r5), cel: 'culm', uv: [[i / Cu.sides, v0], [(i + 1) / Cu.sides, v0], [(i + 1) / Cu.sides, v1], [i / Cu.sides, v1]].map((q) => q.map(r5)), group: 'isekai:culm' });
    }
    // the sprays: from `from` of the height up, each a card from the culm out and down, turned round the pole
    for (let q = 0; q < Sp.per; q++) {
      const f = mix(Sp.from, 0.97, q / Math.max(1, Sp.per - 1)), at = axis(f), a = 2 * Math.PI * (hash3(k, 10 + q, 1107) + q * 0.382), len = mix(Sp.len[0], Sp.len[1], hash3(k, 30 + q, 1109)) * (1 - 0.3 * f);
      const out = [Math.cos(a), Math.sin(a), 0], up = unit([out[0], out[1], -Sp.droop + 0.4 * (1 - f)]), along = unit(cross(up, [0, 0, 1])), w = len * Sp.width;
      const A = mul(along, w / 2), U = mul(up, len), cs = [sub(at, A), addv(at, A), addv(addv(at, A), U), addv(sub(at, A), U)].map(P), nn = unit(cross(along, up)).map(r5);
      sprays.push({ corners: cs, normal: nn, outNormal: nn, cel: 'spray', uv: [[0, 0], [1, 0], [1, 1], [0, 1]], group: 'isekai:spray', doubleSided: true });
    }
  });
  return { culms, sprays };
}

/** PETALS: litter under each sakura — flat cutout cards lying on the ground within `reach` × its crown's radius. */
export function petalFaces(st, site, trees) {
  const T = st.trees, Pt = T.petals, out = [];
  trees.forEach((t, ti) => {
    const R = (t.spread || T.crown.radius * t.h) * Pt.reach, n = Math.round(Pt.per * (t.hero ? 1.6 : 1));
    for (let q = 0; q < n; q++) {
      const k = ti * 97 + q, a = 2 * Math.PI * hash3(k, 1, 1201), d = R * Math.sqrt(hash3(k, 2, 1203)), x = t.x + Math.cos(a) * d, y = t.y + Math.sin(a) * d;
      if (site.trailDist(x, y) < site.halfWAt(y) * 0.6 && hash3(k, 5, 1209) < 0.6) continue;   // fewer on the packed path
      const s = mix(Pt.size[0], Pt.size[1], hash3(k, 3, 1205)) / 2, rot = Math.PI * hash3(k, 4, 1207);
      const cs = [0, 1, 2, 3].map((c) => { const b = rot + (c * Math.PI) / 2 + Math.PI / 4, px = x + Math.cos(b) * s * Math.SQRT2, py = y + Math.sin(b) * s * Math.SQRT2; return P([px, py, site.ground(px, py) + 0.03]); });
      out.push({ corners: cs, normal: [0, 0, 1], outNormal: [0, 0, 1], cel: 'petals', uv: [[0, 0], [1, 0], [1, 1], [0, 1]], group: 'isekai:petals' });
    }
  });
  return out;
}

/**
 * A SAKURA, GROWN: a trunk that leans and forks into limbs, each splitting into branches to the tier's depth (the card's
 * `trees.sakura.hero` / `.grove`), every branch a tapering limb tube pixel-locked in the `bark` tile (u round it, v
 * along it), rising less by each generation and the tips turning down — the wide, flat-topped spread of a sakura.
 * Blossom CLUMPS at the tips and along the last generation: small round masses skinned in the `bloom` tile (a planar
 * projection per facet), each carrying `sn`, its spherical normal (the clump's blended with the crown's), and wearing
 * crossed `sprig` cutout cards that break its silhouette. Records each tree's `crownAt`, `crownR` and `spread`.
 * → { wood, clumps, sprigs } (cel 'bark' / 'bloom' / 'sprig').
 */
export function sakuraFaces(st, site, trees) {
  const T = st.trees, C = T.crown, wood = [], clumps = [], sprigs = [], sc = st.tiles.bark.scale, bs = st.tiles.bloom.scale;
  trees.forEach((t, ti) => {
    const Ti = T.sakura[t.hero ? 'hero' : 'grove'], h = t.h, k = Math.round(t.x * 17 + t.y * 5) + ti * 131, H = (a, b) => hash3(k, a, b);
    const z0 = site.ground(t.x, t.y) - 0.15, ta = 2 * Math.PI * H(8, 991), lean = (C.lean * mix(0.4, 1, H(7, 983)) * Math.PI) / 180;
    const tdir = [Math.sin(lean) * Math.cos(ta), Math.sin(lean) * Math.sin(ta), Math.cos(lean)], r0 = C.trunk * h, base = [t.x, t.y, z0];
    const fork = addv(base, mul(tdir, h * C.fork)), mid = addv(addv(base, mul(tdir, h * C.fork * 0.5)), [(H(3, 947) - 0.5) * 0.06 * h, (H(4, 953) - 0.5) * 0.06 * h, 0]);
    limb(wood, [base, mid, fork], [r0 * 1.3, r0, r0 * 0.88], 7, sc);
    const tips = [], blobs = [], joints = []; let id = 0;
    const grow = (p, az, gen, r, len) => {
      const my = id++, el = ((Ti.rise[gen] + (hash3(k, 200 + my, 1001) - 0.5) * 16) * Math.PI) / 180, d = [Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)];
      const last = gen === Ti.depth - 1, end = addv(addv(p, mul(d, len)), [0, 0, last ? -Ti.droop * len : 0]), m = addv(addv(p, mul(d, len * 0.5)), [0, 0, len * 0.07]);
      const r1 = Math.max(0.025, r * 0.6);
      limb(wood, [p, m, end], [r, r * 0.8, r1], gen < 1 ? 6 : gen < 2 ? 5 : 4, sc);
      if (last) { tips.push({ at: end, mid: m, d, my }); return; }
      if (gen >= Ti.depth - 1 - (Ti.joints || 0)) joints.push({ at: end, cr: mix(Ti.clump[0], Ti.clump[1], hash3(k, 2000 + my, 1019)) });
      const n = Ti.split[0] + Math.floor(hash3(k, 400 + my, 1003) * (Ti.split[1] - Ti.split[0] + 1));
      for (let c = 0; c < n; c++) {
        const caz = az + (c - (n - 1) / 2) * mix(0.5, 0.8, hash3(k, 600 + my * 7 + c, 1005)) + (hash3(k, 800 + my * 7 + c, 1007) - 0.5) * 0.3;
        grow(end, caz, gen + 1, r1 * (n > 1 ? 0.85 : 1), h * Ti.ratio[gen + 1] * mix(0.8, 1.15, hash3(k, 1000 + my * 7 + c, 1009)));
      }
    };
    const nl = C.limbs[0] + Math.floor(H(9, 997) * (C.limbs[1] - C.limbs[0] + 1));
    for (let c = 0; c < nl; c++) grow(fork, ta + (2 * Math.PI * (c + 0.3 * (H(20 + c, 1011) - 0.5))) / nl, 0, r0 * 0.8, h * Ti.ratio[0] * mix(0.85, 1.15, H(30 + c, 1013)));
    // the clumps: at every tip, a head and its trailing heads; one along the twig, by chance; at every fork of the
    // tier's `joints` generations, one more (the crown filled in from inside)
    for (const j of joints) blobs.push({ at: addv(j.at, [0, 0, j.cr * 0.3]), r: j.cr });
    for (const tp of tips) {
      const q = (a) => hash3(k, 3000 + tp.my * 11 + a, 1021), cr = mix(Ti.clump[0], Ti.clump[1], q(0));
      blobs.push({ at: addv(tp.at, [0, 0, cr * 0.3]), r: cr });
      for (let j = 1; j < Ti.perTip; j++) blobs.push({ at: addv(addv(tp.at, mul(tp.d, -cr * 0.75 * j)), [(q(j) - 0.5) * cr, (q(j + 5) - 0.5) * cr, cr * (0.15 + 0.3 * q(j + 9))]), r: cr * mix(0.65, 0.85, q(j + 13)) });
      if (q(20) < Ti.along) blobs.push({ at: addv(tp.mid, [0, 0, cr * 0.4]), r: cr * 0.8 });
    }
    const cc = mean(blobs.map((b) => b.at));
    t.crownAt = cc.map(r5); t.crownR = r5(Math.sqrt(blobs.reduce((s, b) => s + (b.at[0] - cc[0]) ** 2 + (b.at[1] - cc[1]) ** 2, 0) / blobs.length) + Ti.clump[1]);
    t.spread = r5(Math.max(...blobs.map((b) => Math.hypot(b.at[0] - t.x, b.at[1] - t.y))));
    blobs.forEach((b, bi) => {
      const q = (a) => hash3(k, 5000 + bi * 7 + a, 1031), rr = [b.r * mix(0.9, 1.15, q(1)), b.r * mix(0.9, 1.15, q(2)), b.r * 0.8];
      for (const tri of blobTris(b.at, rr, null, { detail: Ti.detail })) {
        const cs = tri.p.map(P), m = mean(cs), no = unit(sub(m, b.at)), sn = unit(addv(no, mul(unit(sub(m, cc)), 0.8))).map(r5), nn = facetN(cs, no);
        // the skin's tile by a BOX projection on the clump's normal (neighbouring facets share it, so the flowers run on
        // across them); a textured face is a quad: the triangle's last corner doubled, as a boulder's cap
        const ax = Math.abs(no[0]) >= Math.abs(no[1]) && Math.abs(no[0]) >= Math.abs(no[2]) ? 0 : Math.abs(no[1]) >= Math.abs(no[2]) ? 1 : 2;
        const uv = cs.map((c) => (ax === 0 ? [c[1], c[2]] : ax === 1 ? [c[0], c[2]] : [c[0], c[1]]).map((v) => r5(v / bs)));
        clumps.push({ corners: [...cs, cs[2]], normal: nn, outNormal: nn, sn, r: b.r, uv: [...uv, uv[2]], group: 'isekai:blossom' });
      }
      // the sprigs: crossed upright cards straddling the clump's skin, out and up from it
      for (let j = 0; j < Ti.sprigs; j++) {
        const u = unit(addv([q(10 + j) - 0.5, q(20 + j) - 0.5, q(30 + j) * 0.8 - 0.15], mul(unit(sub(b.at, cc)), 0.5))), at = addv(b.at, [u[0] * b.r, u[1] * b.r, u[2] * b.r * 0.8]), s = b.r * Ti.sprig;
        const sn = unit(addv(u, mul(unit(sub(at, cc)), 1.3))).map(r5), yaw = Math.PI * q(40 + j), foot = sub(at, [0, 0, s * 0.45]);
        for (const a of [yaw, yaw + Math.PI / 2]) {
          const A = [Math.cos(a) * s * 0.5, Math.sin(a) * s * 0.5, 0], U = [0, 0, s], nn = [r5(-Math.sin(a)), r5(Math.cos(a)), 0];
          sprigs.push({ corners: [sub(foot, A), addv(foot, A), addv(addv(foot, A), U), addv(sub(foot, A), U)].map(P), normal: nn, outNormal: nn, sn, at: at.map(r5), r: b.r, cel: 'sprig', uv: [[0, 0], [1, 0], [1, 1], [0, 1]], group: 'isekai:sprig', doubleSided: true });
        }
      }
    });
  });
  return { wood, clumps, sprigs };
}
/** A LIMB: a tapering tube through `pts` with `radii`, `sides` facets, its bark tile u round it and v along it. */
function limb(out, pts, radii, sides, scale) {
  let v0 = 0;
  for (let k = 0; k + 1 < pts.length; k++) {
    const a = pts[k], b = pts[k + 1], d = unit(sub(b, a)), up = Math.abs(d[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1], len = Math.hypot(...sub(b, a));
    const u = unit(cross(d, up)), v = cross(u, d), ku = Math.max(1, Math.round((2 * Math.PI * radii[k]) / scale)), v1 = v0 + len / scale;
    const ring = (p, r, i) => { const th = (2 * Math.PI * i) / sides; return P([p[0] + (u[0] * Math.cos(th) + v[0] * Math.sin(th)) * r, p[1] + (u[1] * Math.cos(th) + v[1] * Math.sin(th)) * r, p[2] + (u[2] * Math.cos(th) + v[2] * Math.sin(th)) * r]); };
    for (let i = 0; i < sides; i++) {
      const tm = (2 * Math.PI * (i + 0.5)) / sides, n = unit([u[0] * Math.cos(tm) + v[0] * Math.sin(tm), u[1] * Math.cos(tm) + v[1] * Math.sin(tm), u[2] * Math.cos(tm) + v[2] * Math.sin(tm)]).map(r5);
      out.push({ corners: [ring(a, radii[k], i), ring(a, radii[k], i + 1), ring(b, radii[k + 1], i + 1), ring(b, radii[k + 1], i)], normal: n, outNormal: n, cel: 'bark',
        uv: [[(i / sides) * ku, v0], [((i + 1) / sides) * ku, v0], [((i + 1) / sides) * ku, v1], [(i / sides) * ku, v1]].map((q) => q.map(r5)), group: 'isekai:wood', doubleSided: true });
    }
    v0 = v1;
  }
}

/**
 * A TREE as the current era draws one: a CROWN of overlapping round masses (the blob primitive, vegetation/tree-mesh.js)
 * heaped on a short trunk — one mass on top, a ring of them round its shoulders, each squashed a little — so the crown
 * reads as one cloud-shaped form lit as a few big shapes. Wood and crown are their own groups for the lock.
 */
function treeFaces(st, site, trees) {
  const T = st.trees, C = T.crown, out = [], blossom = T.form === 'blossom', crownGroup = blossom ? 'isekai:blossom' : 'isekai:crown', crownTint = blossom ? st.tint.blossom : st.tint.crown;
  trees.forEach((t, ti) => {
    const z0 = site.ground(t.x, t.y) - 0.15, h = t.h, k = Math.round(t.x * 17 + t.y * 5) + ti * 131;
    const Rc = C.radius * h, c = [t.x + (hash3(k, 1, 941) - 0.5) * 0.3, t.y + (hash3(k, 2, 943) - 0.5) * 0.3, z0 + C.height * h];
    // the trunk, bending a little, into the crown's heart; two limbs up into the shoulder masses
    // a sakura leans (its crown carried off to one side over a trunk that tips toward it); the meadow's stand
    const tip = blossom ? Math.tan(((C.lean || 0) * Math.PI) / 180) * h * mix(0.4, 1, hash3(k, 7, 983)) : 0, ta = 2 * Math.PI * hash3(k, 8, 991);
    if (tip) { c[0] += Math.cos(ta) * tip; c[1] += Math.sin(ta) * tip; }
    const bend = [(hash3(k, 3, 947) - 0.5) * 0.08 * h + Math.cos(ta) * tip * 0.5, (hash3(k, 4, 953) - 0.5) * 0.08 * h + Math.sin(ta) * tip * 0.5];
    const trunk = [0, 0.35, 0.7, 1].map((f) => [t.x + bend[0] * f * f + (c[0] - t.x) * f, t.y + bend[1] * f * f + (c[1] - t.y) * f, z0 + (c[2] - z0) * f]);
    tube(out, trunk, [C.trunk * h, C.trunk * h * 0.8, C.trunk * h * 0.62, C.trunk * h * 0.5], 6, st.tint.wood, 'isekai:wood');
    const Ms = t.hero ? st.trees.hero.masses : C.masses, n = Ms[0] + Math.floor(hash3(k, 5, 957) * (Ms[1] - Ms[0] + 1)), yaw = 2 * Math.PI * hash3(k, 6, 959);
    const masses = [{ at: [c[0], c[1], c[2] + 0.38 * Rc], r: 0.6 * Rc }];
    t.crownAt = c.map(r5); t.crownR = r5(Rc);   // where the crown hangs (the live channel's petals fall from it)
    for (let i = 0; i < n; i++) {
      const a = yaw + (2 * Math.PI * (i + 0.3 * hash3(k, 10 + i, 961))) / n, e = mix(-0.25, 0.45, hash3(k, 30 + i, 967)), d = Rc * mix(0.55, 0.72, hash3(k, 50 + i, 971));
      masses.push({ at: [c[0] + Math.cos(a) * Math.cos(e) * d, c[1] + Math.sin(a) * Math.cos(e) * d, c[2] + Math.sin(e) * d * 0.8], r: Rc * mix(0.4, 0.55, hash3(k, 70 + i, 977)) });
    }
    // limbs into the shoulder masses: a sakura forks lower and into more of them, each limb bending up at its elbow
    const nl = blossom ? C.limbs[0] + Math.floor(hash3(k, 9, 997) * (C.limbs[1] - C.limbs[0] + 1)) : 2, from = blossom ? trunk[0].map((v, q) => mix(v, c[q], C.fork)) : trunk[1];
    masses.slice(1, 1 + nl).forEach((m) => {
      const to = [mix(from[0], m.at[0], 0.8), mix(from[1], m.at[1], 0.8), mix(from[2], m.at[2], 0.8)];
      if (!blossom) { tube(out, [trunk[1], to], [C.trunk * h * 0.5, C.trunk * h * 0.25], 5, st.tint.wood, 'isekai:wood'); return; }
      const elbow = [mix(from[0], to[0], 0.6), mix(from[1], to[1], 0.6), mix(from[2], to[2], 0.35)];
      tube(out, [from, elbow, to], [C.trunk * h * 0.6, C.trunk * h * 0.42, C.trunk * h * 0.22], 5, st.tint.wood, 'isekai:wood');
    });
    for (const m of masses) for (const tri of blobTris(m.at, [m.r, m.r, m.r * C.squash], null, { detail: 1 })) {
      const cs = tri.p.map(P), nn = facetN(cs, sub(mean(cs), m.at));
      out.push({ corners: cs, normal: nn, outNormal: nn, tint: crownTint, group: crownGroup });
    }
  });
  return out;
}
const facetN = (cs, toward) => { const n = unit(cross(sub(cs[1], cs[0]), sub(cs[2], cs[0]))); return (dot(n, toward) < 0 ? n.map((v) => -v) : n).map(r5); };

/** Nature by cause, kept broad (the lock quantizes it): grass in patches, the trail packed bright at its centre. */
function isekaiMarks(st, site, S) {
  return (f, c) => {
    if (f.group === 'isekai:trail') { const t = site.trailDist(c[0], c[1]) / site.halfWAt(c[1]), v = 1.08 - 0.2 * t * t; return [v, v, v]; }
    if (f.group === 'isekai:ground') { const v = 0.86 + 0.28 * smooth(0.3, 0.7, vnoise(c[0] * 0.12, c[1] * 0.12, S + 71)); return [v, v, v]; }
    return [1, 1, 1];
  };
}
