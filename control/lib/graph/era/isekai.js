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
 *
 * THE POLYGON LAND (a stage's `shading`, opt-in: the same object the local meru reads, local-meru/plan.js
 * `readShading`; a geocube's town and trail carry its land's): the land drawn as the island's is, by its functions. No
 * tiles on the land: cliff and boulders baked flat per facet, the ground, the scree and the trail smooth at each corner,
 * then the land's rules (local-meru/shading.js: crevice, ridge, blend, mix, valley), the rock drawn toward planes with
 * `facet` (local-meru/land-form.js, on the faces' own heights); no grass on it (no tufts, no field, no
 * fringe, no hat, no trail blend). A gritty land (`grit` from GRIT_PIXELS) breaks its boulders, its cliffs' rims and
 * strews stones (local-meru/broken-land.js), and the page draws its rock's fabric near the eye (matte-paint/fabric.js:
 * the site's own strata and joints, the land's `skin` and `rocks`). Absent, every face is as it was.
 * A stage's `biocube` (era/biocube.js) lays its flora over the card's trees and grass and grows its bushes; on a polygon
 * land it brings the grass back (tufts and the field; the lips' and hats' fringes stay the island's: none). Its `fauna`
 * (era/biocube-fauna.js) lays the field's swarms and birds on the page and its herds as `faunaUnits`, which the world
 * lowers to bodies (worlds/fauna-units.js).
 * Deterministic: integer-hash dice, pooled plants from fixed seeds.
 */
import { reserveSite, kept, CROWN } from './reserve.js';
import { lookOf } from './style/looks.js';
import { poleOf } from './style/pole.js';
import { ISEKAI_STYLES, isekaiMask } from './isekai-tiles.js';
import { hash3, vnoise } from './dirt.js';
import { P, r5, hexRgb, rgbHex, crossed } from './geom.js';
import { sunShare } from '../scene/live-light.js';
import { makeSunShadow, makeSoftSunShadow, sunDir } from './sun.js';
import { bakeStageLight } from './stage.js';
import { natureSite, trailFaces, trailRims, rockItems, treeItems, grassTufts, tube } from './nature.js';
import { blobTris } from '../vegetation/tree-mesh.js';
import { lockFaces } from './palette.js';
import { gridX, gridY } from '../polygonizer/landform.js';
import { composeCloudDeck } from '../effects/effects-clouds.js';
import { cloudBand } from '../matte-paint/sky.js';
import { resolveTerrainWind, windPageChannel } from '../vegetation/wind.js';
import { grassLadder } from '../vegetation/grass.js';
import { resolveGrassContact, validateGrassContact } from '../vegetation/grass-contact.js';
import { wildflowerLadder, flowerRamp, WILDFLOWER_KINDS } from '../vegetation/wildflowers.js';
import { outTrailSite, streamFaces, outTrailPayload, outTrailCamera } from './out-trail.js';
import { boundFaces } from './out-bounds.js';
import { placeIkebana, ikebanaFaces, ikebanaFill, SOFT_GROUP, SOLID_GROUP } from './ikebana-place.js';
import { placeShrubs, validateShrubs, SHRUB_GROUP } from './shrubs.js';
import { readShading } from '../local-meru/plan.js';
import { readBiocube, withFlora } from './biocube.js';
import { placeFauna, placeHerds } from './biocube-fauna.js';
import { withGrittyFlora, withGrittyGround, trailKey, turfKey, groundKey, pavementJoints, GROUND_CUTS, TALUS_CUTS } from './gritty-flora.js';
import { bakeLand, ruleLand } from '../local-meru/shading.js';
import { breakRims, strewStones, strewEdge } from '../local-meru/broken-land.js';
import { readTrailDress, trailPatches, surfaceDress, edgeSpill, verged, sandBands, turfBands, screeBands, IN_DIRT } from './trail-dress.js';
import { detailKey, layDetail } from '../matte-paint/detail.js';
import { screeKey } from './scree-tiles.js';
import { substrateMap, turnField, cutFace, FORMATION_TURNS, SUBSTRATE_IDS } from './substrate.js';
import { strewStrand, strandFill, duneGrass, duneGrassFaces } from './strand.js';
import { leafChips, CHIP_DEFAULTS } from './leaf-chips.js';
import { LEAF_FORMS, readKind, pickByShare, leafForm, lobeTris, formChips, withinLobe } from './leaf-forms.js';
import { floraRamps, harmonyRamps } from './flora-colours.js';
import { placeThickets, clumpBushes, readBush, SOFT_BRUSH } from './thickets.js';
import { growRockFlora, rockFloraFill } from './rock-flora.js';
import { SOFT_GROUNDS } from '../materials/soft-ground.js';
import { readSnow, snowRamp, snowFar, snowField, snowAlbedo, grassUnder, capOf } from './snow.js';
import { leanHue } from './town-dress.js';
import { valleyOf, planarise, FACET_PASSES } from '../local-meru/land-form.js';
import { rockFabric, FABRIC_GROUPS, GRIT_PIXELS } from '../matte-paint/fabric.js';

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
// a pixel-locked face's SUN SHARE (the live light, scene/live-light.js): its band is its light, so a lit band's share is
// what its tile's value loses down to the shade band's (an actor's shadow takes it to the band in the shade beside it);
// a band in the shade, 0 (never darkened again)
const celShare = (st, tile, lit) => (lit ? sunShare(hexRgb(stopFill(st, tile, true)), hexRgb(stopFill(st, tile, false)), (v) => v) : 0);

/**
 * The GROUND as the landform grid's facets. Steep facets are cliff (pixel-locked, `cel: 'cliff'`, uv up the face along
 * its own horizontal); the talus apron is scree; the rest is grass. The trail's corridor is left to its ribbon. Each
 * cliff LIP — the edge a grass cell shares with a cliff cell that falls away below it — is returned with the way down.
 * `z` (optional): the grid's heights to draw instead of its own (a polygon land's rock drawn toward planes).
 */
// the grid's heights with its rock (steeper than the card's `slope.rock`) drawn toward planes `span` metres across
function facetedZ(st, g, span) {
  const z = Float64Array.from(g.z), at = (i, j) => [gridX(g, i), gridY(g, j), z[j * g.nx + i]], isCliff = (_cs, n) => n[2] < st.slope.rock;
  for (let pass = 0; pass < FACET_PASSES; pass++) planarise(g, z, at, isCliff, span);
  return z;
}
export function isekaiGround(st, site, z = site.grid.z) {
  const out = [], lips = [], { grid: g, trailDist, halfWAt, W } = site, sc = st.tiles.cliff.scale;
  const at = (i, j) => [gridX(g, i), gridY(g, j), z[j * g.nx + i]];
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
export function boulderFaces(st, it, seed, broken = 0) {
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
  if (broken > 0) return brokenBoulder(st, rings, centre, k, S, s, broken);
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

/**
 * BROKEN EDGES (`broken`, 0..1: a gritty style's): the same boulder with its edges broken, so no long edge reads as a
 * ruled line against the sky. Its side quads and cap triangles are refined into ONE grid of shared vertices (each a few
 * tenths of the boulder apart), so an edge vertex is one vertex and the rock stays closed. Each vertex is pushed into the
 * rock toward its centre by a chip field: stepped dice in 3D cells at two sizes, so the breaks are blocky, never a
 * wobble. It is strongest on the polytope's real edges (the rim, the corners between sides, and a ring's bend by its
 * angle) and fades over a band inside them. The flats only undulate a little, and the sunk foot is left as it is.
 */
const BREAK_SEG = 0.15, BREAK_DEPTH = 0.075, BREAK_BAND = 0.2, BREAK_FLAT = 0.012;
function brokenBoulder(st, rings, centre, k, S, s, broken) {
  const n = rings[0].length, R = rings.length, sc = st.tiles.rock.scale, hs = st.tiles.hat.scale, seg = Math.max(0.1, s * BREAK_SEG), D2R = Math.PI / 180;
  const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  let around = 0; for (const ring of rings) for (let i = 0; i < n; i++) around = Math.max(around, len(ring[i], ring[(i + 1) % n]));
  const nu = Math.max(1, Math.min(6, Math.ceil(around / seg)));
  const nv = []; for (let r = 0; r + 1 < R; r++) { let up = 0; for (let i = 0; i < n; i++) up = Math.max(up, len(rings[r][i], rings[r + 1][i])); nv.push(Math.max(1, Math.min(4, Math.ceil(up / seg)))); }
  // the polytope's own facets and how sharply each edge bends (0 a flat continuation, 1 a real arris)
  const qn = rings.slice(0, -1).map((_, r) => Array.from({ length: n }, (_, i) => { const cs = [rings[r][i], rings[r][(i + 1) % n], rings[r + 1][(i + 1) % n], rings[r + 1][i]]; return facet(cs, sub(mean(cs), centre)); }));
  const bend = (a, b) => smooth(8, 35, Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) / D2R);
  const wV = (r, i) => bend(qn[r][(i + n - 1) % n], qn[r][i]);                       // the corner at column i, row r
  const wH = (r, i) => (r <= 0 ? 0 : r >= R - 1 ? 1 : bend(qn[r - 1][i], qn[r][i]));  // ring r: the foot none, the rim whole
  const band = BREAK_BAND * s, fall = (d) => 1 - smooth(0, band, d);
  // the chip field: blocky dice in 3D cells (two sizes, warped), and a soft undulation everywhere
  const chip = (p) => {
    let c = 0;
    for (const [cs, wt, o] of [[0.17 * s, 1, 0], [0.07 * s, 0.45, 1]]) {
      const w = (vnoise(p[0] / cs + 3.1, p[1] / cs, S + 731 + o) - 0.5) * 0.6, q = [Math.floor(p[0] / cs + w), Math.floor(p[1] / cs - w), Math.floor(p[2] / cs + w)];
      const v = hash3(q[0] * 7919 + q[2] * 131, q[1], S + 733 + o);
      c += wt * (v < 0.3 ? 0.1 : v < 0.7 ? 0.55 : 1);
    }
    return c / 1.45;
  };
  const seen = new Map();
  const vert = (p0, prox) => {
    const key = P(p0).join(',');
    if (seen.has(key)) return seen.get(key);
    const into = unit(sub(centre, p0)), flat = BREAK_FLAT * s * (vnoise(p0[0] / (0.5 * s), p0[1] / (0.5 * s) + p0[2] / (0.5 * s), S + 739) - 0.5) * 2;
    const p = P(addv(p0, into.map((v) => v * broken * (BREAK_DEPTH * s * chip(p0) * prox + flat))));
    seen.set(key, p);
    return p;
  };
  // the sides: levels up the rows (a row's own count), columns round the rings (nu a side)
  const sides = [], levels = []; for (let r = 0; r + 1 < R; r++) for (let b = 0; b < nv[r]; b++) levels.push([r, b / nv[r]]); levels.push([R - 1, 0]);
  const belly = rings[Math.min(1, R - 1)], arc = [0]; for (let i = 0; i < n; i++) arc.push(arc[i] + Math.hypot(belly[(i + 1) % n][0] - belly[i][0], belly[(i + 1) % n][1] - belly[i][1]));
  const C = n * nu, grid = levels.map(([r, b]) => Array.from({ length: C }, (_, c) => {
    const i = Math.floor(c / nu), a = (c % nu) / nu, i1 = (i + 1) % n;
    const lo = lerp3(rings[r][i], rings[r][i1], a), p0 = r >= R - 1 ? lo : lerp3(lo, lerp3(rings[r + 1][i], rings[r + 1][i1], a), b);
    const rowLen = r >= R - 1 ? 1 : len(rings[r][i], rings[r + 1][i]), alongLen = len(rings[Math.min(r, R - 1)][i], rings[Math.min(r, R - 1)][i1]);
    const prox = Math.max(wV(Math.min(r, R - 2), a < 0.5 ? i : i1) * fall(Math.min(a, 1 - a) * alongLen),
      wH(r, i) * fall(b * rowLen), r < R - 1 ? wH(r + 1, i) * fall((1 - b) * rowLen) : 0);
    return { p: vert(p0, r === 0 && b === 0 ? 0 : prox), u: arc[i] + (arc[i + 1] - arc[i]) * a };
  }));
  for (let L = 0; L + 1 < grid.length; L++) for (let c = 0; c < C; c++) {
    const c1 = (c + 1) % C, A = grid[L][c], B = grid[L][c1], Cc = grid[L + 1][c1], Dd = grid[L + 1][c], u1 = c1 === 0 ? arc[n] : B.u;
    const cs = [A.p, B.p, Cc.p, Dd.p], nn = facet(cs, sub(mean(cs), centre));
    sides.push({ corners: cs, normal: nn.map(r5), outNormal: nn.map(r5), cel: 'rock', uv: [[A.u, cs[0][2]], [u1, cs[1][2]], [u1, cs[2][2]], [Dd.u, cs[3][2]]].map(([u, v]) => [r5(u / sc), r5(v / sc)]), group: 'isekai:rock', size: s });
  }
  // the cap: a fan of triangles, each refined to the rim's count; a vertex's break by how near the rim it lies
  const top = rings[R - 1], c0 = P(mean(top)), rad = top.reduce((a, q) => a + len(q, c0), 0) / n, cap = [];
  for (let i = 0; i < n; i++) {
    // (a rim point is taken exactly as the sides take it, so the two meet in one vertex)
    const i1 = (i + 1) % n, at = (ia, ib) => vert(ia + ib === nu ? lerp3(top[i], top[i1], ib / nu) : P([0, 1, 2].map((d) => c0[d] + (top[i][d] - c0[d]) * (ia / nu) + (top[i1][d] - c0[d]) * (ib / nu))), fall((1 - (ia + ib) / nu) * rad));
    for (let ia = 0; ia < nu; ia++) for (let ib = 0; ia + ib < nu; ib++) {
      const tris = [[at(ia, ib), at(ia + 1, ib), at(ia, ib + 1)]];
      if (ia + ib + 2 <= nu) tris.push([at(ia + 1, ib), at(ia + 1, ib + 1), at(ia, ib + 1)]);
      for (const [a, b, c] of tris) { const cs = [a, b, c, c], nn = facet(cs, [0, 0, 1]); cap.push({ corners: cs, normal: nn.map(r5), outNormal: nn.map(r5), uv: cs.map((q) => [r5(q[0] / hs), r5(q[1] / hs)]), group: 'isekai:rock', size: s }); }
    }
  }
  const rim = []; for (let i = 0; i < n; i++) rim.push({ a: top[i], b: top[(i + 1) % n], a2: rings[R - 2][i], b2: rings[R - 2][(i + 1) % n], s });
  return { sides, cap, rim, s };
}

const lumaOf = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
/** A light (rgb 0…1) as a canopy BAND (0 lit … 3 deep shade, between the sky's fill and the full sun) and the light left
 *  over once the band's skin has drawn its value: the light over the band's own, its hue kept. */
/**
 * THE HOUR'S SHIFT along a ramp: where the stage's bake lands a tint in full light under the hour's light, against where
 * it lands under the cube's OWN light (its reference, `ownLight`, era/geocube.js outsideAt), in stops, never above 0.
 * What is drawn in a ramp's stops rather than baked (a gritty crown's chips and core, the live grass's windows) moves by
 * it, so a cube's own palette at dusk or night darkens as its land does; a cube at its own hour (a night palette under
 * its own moon, a day cube at noon) and a kit's own card move by none.
 */
// the flora drawn in swatch colours, not a ramp's stops: dimmed by the hour (hourDim) where the ramp-drawn moves by stops
// (a leaf card's tile and fill are its window of the foliage, moved by the shift itself: era/geocube.js outsideOf)
const SWATCH_FLORA = new Set([SHRUB_GROUP, SOFT_GROUP, SOLID_GROUP]);
/** How far the world's foliage comes down at the stage's hour, as a share of its light (1 by day, at the cube's own). */
export function hourDim(st) {
  const R = st.palette?.foliage, s = R ? hourShift(st, st.tint.crown, R) : 0;
  if (!s) return 1;
  const L = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], i = Math.floor(R.length / 2);
  return L(R[Math.max(0, i + s)]) / Math.max(1, L(R[i]));
}
const dimmed = (f, k) => ({ ...f, ...(f.fill ? { fill: rgbHex(hexRgb(f.fill).map((v) => v * k)) } : {}), ...(f.cornerFills ? { cornerFills: f.cornerFills.map((c) => rgbHex(hexRgb(c).map((v) => v * k))) } : {}) });
// a live grass's windows moved by the hour's shift (the same object by day)
export const hourWin = (w, s) => (s ? { lit: w.lit.map((v) => Math.max(0, v + s)), shade: w.shade.map((v) => Math.max(0, v + s)) } : w);
export function hourShift(st, tint, ramp) {
  const day = st.ownLight;
  if (!day || !ramp || !tint) return 0;
  const E = st.ground?.exposure ?? 1;
  const at = (L) => {
    const A = hexRgb(L.ambient).map((v) => v * L.fill), K = hexRgb(L.key.color), c = tint.map((a, k) => Math.min(1, a * (A[k] + K[k] * L.sunGain) * E) * 255);
    let b = 0, bd = Infinity; ramp.forEach((q, i) => { const d = Math.hypot(q[0] - c[0], q[1] - c[1], q[2] - c[2]); if (d < bd) { bd = d; b = i; } });
    return b;
  };
  return Math.min(0, at(st.light) - at(day));
}
function canopyBand(light, shadeL, litL) {
  const t = Math.max(0, Math.min(1, (lumaOf(light) - shadeL) / Math.max(0.01, litL - shadeL))), band = t > 0.72 ? 0 : t > 0.45 ? 1 : t > 0.2 ? 2 : 3;
  const nominal = shadeL + (litL - shadeL) * [0.88, 0.6, 0.32, 0.08][band];
  return { band, fill: rgbHex(light.map((v) => Math.min(1, (v / Math.max(0.05, nominal)) * 0.82))) };
}
/** A crown's face on the canopy: its skin's band by the light it was baked with, its uv laid like a material's. */
function canopyFace(st, f, shadeL, litL) {
  const M = materialFace(st, { ...f, mat: 'canopy' }, st.tiles.canopy.scale ?? 1.2), { band, fill } = canopyBand(hexRgb(f.fill), shadeL, litL);
  return { ...M, texture: `isekai:${st.id}:canopy-b${band}`, fill, cornerFills: undefined };
}
/** A baked face made its material (`f.mat`: a tile the card has), its uv laid from the axis it faces most (1.2 m a
 *  repeat): texel × the light it was baked with. */
function materialFace(st, { mat, ...f }, scale = 1.2) {
  const n = f.normal, ax = Math.abs(n[2]) >= Math.max(Math.abs(n[0]), Math.abs(n[1])) ? [0, 1] : Math.abs(n[0]) > Math.abs(n[1]) ? [1, 2] : [0, 2];
  // (a triangle as a quad, its last corner doubled: the page textures quads)
  const cs = f.corners.length === 3 ? [...f.corners, f.corners[2]] : f.corners;
  return { ...f, corners: cs, texture: isekaiKeyOf(st, mat, true), textureLit: true, uv: cs.map((p) => [r5(p[ax[0]] / scale), r5(p[ax[1]] / scale)]) };
}

/**
 * THE REALISTIC POLE's ground (a card's `ground`): the colour is the MATERIAL's — a `dirt` / `scree` tile painted in the
 * ramp's stops, world-locked every `scale` metres — and the corners carry LIGHT only, so the GPU draws texel × light.
 * The light is smooth over the form (the heightfield's normal at each corner, shared by every cell meeting there), a
 * warm key and the cool sky fill, × the patches, × CAVITY (a hollow darker, a crest lighter, by the heightfield's
 * curvature). The sun's shadow is hard: a cell whose reach changes inside it is split, up to `split` times, and each
 * piece is lit or not, so the shade gathers into pockets with an edge instead of smearing over a triangle.
 * The tile comes in `variants` that join, one per tile-sized block, so the ground doesn't repeat in rows from far.
 * → faces, unlocked (the tile is already in the ramp's stops).
 */
function realGround(st, site, cells, shadow, sun, ambient, marks, S, share = false) {
  const G = st.ground, g = site.grid, h = g.dx, z = site.ground, E = G.exposure ?? 1;
  // the tile snapped to a whole number of grid cells, so a tile's edge is a cell's: one VARIANT per tile-sized block (any
  // variant joins any other at that edge, isekai-tiles.js), chosen by the block's dice; the trail's ribbon, which
  // follows its centreline and not the grid, keeps the first
  const ox = gridX(g, 0), oy = gridY(g, 0), tile = Math.max(1, Math.round(G.scale / h)) * h, V = G.variants ?? 1;   // (variants: 1 or 16)
  // (each EDGE between blocks has a type, 0 or 1, by its own dice; a block's variant is its four edges' types: left,
  // right, bottom, top — `variants` 1 keeps every edge 0, the one tile wrapped)
  const edgeV = (i, j) => (V > 1 && hash3(i, j, S + 307) < 0.5 ? 1 : 0), edgeH = (i, j) => (V > 1 && hash3(i, j, S + 311) < 0.5 ? 1 : 0);
  const variantOf = (f) => {
    if (f.group === 'isekai:trail' || !f.grid) return '';
    const c = mean(f.corners), i = Math.floor((c[0] - ox) / tile), j = Math.floor((c[1] - oy) / tile);
    return `~${edgeV(i, j) | (edgeV(i + 1, j) << 1) | (edgeH(i, j) << 2) | (edgeH(i, j + 1) << 3)}`;
  };
  const normalAt = (x, y) => unit([(z(x - h, y) - z(x + h, y)) / (2 * h), (z(x, y - h) - z(x, y + h)) / (2 * h), 1]);
  const cavityAt = (x, y) => { const k = 2 * h, lap = (z(x + k, y) + z(x - k, y) + z(x, y + k) + z(x, y - k)) / 4 - z(x, y); return 1 - G.cavity * Math.max(-0.5, Math.min(1, lap / 0.12)); };
  const reach = (p) => { const n = normalAt(p[0], p[1]); return dot(n, sun.dir) > 0 && shadow(addv(p, mul(n, 0.05)), n) > 0 ? 1 : 0; };
  const light = (f, p, s) => {
    const n = normalAt(p[0], p[1]), lam = Math.max(0, dot(n, sun.dir)) * s, down = Math.max(0, 0.5 - 0.5 * n[2]), cav = cavityAt(p[0], p[1]), m = marks(f, p);
    return [0, 1, 2].map((k) => Math.min(1, (ambient[k] + sun.rgb[k] * sun.gain * lam + sun.bounce[k] * sun.bounceGain * down) * cav * m[k] * E));
  };
  const lerp = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t), bil = (cs, u, v) => lerp(lerp(cs[0], cs[1], u), lerp(cs[3], cs[2], u), v);
  const out = [];
  // THE PATCHES (a card's `ground.patches`), each a weight by its CAUSE, broken up by its own noise: fines in the hollows,
  // gravel on the slopes and the talus apron, dust drifted over the flats, a crust on the stable flats off the trail,
  // fines trodden out along the trail's edges. Laid over each lit piece on the blend layer, alpha-tested (`blend:
  // 'cut'`: the tile's alpha × the weight against ½), lit as the piece is, so a patch's edge is a ragged pixel edge
  const PT = G.patches ? Object.keys(G.patches).filter((k) => G.patches[k] && st.tiles[k]) : [];
  const lapAt = (x, y) => { const k = 2 * h; return (z(x + k, y) + z(x - k, y) + z(x, y + k) + z(x, y - k)) / 4 - z(x, y); };
  const amin = st.landform.apronMin, clamp01 = (v) => Math.max(0, Math.min(1, v));
  const CAUSE = {
    fines: (x, y) => smooth(0.02, 0.07, lapAt(x, y)),
    gravel: (x, y) => Math.max(smooth(0.1, 0.3, 1 - normalAt(x, y)[2]), site.apronAt ? smooth(amin * 0.5, amin * 1.5, site.apronAt(x, y)) : 0),
    dust: (x, y) => smooth(0.95, 0.99, normalAt(x, y)[2]) * smooth(0.62, 0.8, vnoise(x * 0.16, y * 0.16, S + 421)),
    crust: (x, y) => smooth(0.97, 0.995, normalAt(x, y)[2]) * smooth(site.halfWAt(y) + 2, site.halfWAt(y) + 5, site.trailDist(x, y)) * smooth(0.66, 0.85, vnoise(x * 0.3, y * 0.3, S + 431)),
    trodden: (x, y) => 1 - smooth(site.halfWAt(y) + 0.1, site.halfWAt(y) + 1.1, site.trailDist(x, y)),
  };
  // (the cause sets where a patch may lie; its noise, at a metre or two, how much of that it covers)
  const weight = (k, [x, y]) => clamp01(CAUSE[k](x, y) * (0.15 + 1.05 * vnoise(x * 0.7, y * 0.7, S + 401 + PT.indexOf(k) * 7)));
  const patches = [];
  const leaf = (f, cs, s) => {
    const cornerFills = cs.map((p) => rgbHex(light(f, p, s))), base = { corners: cs.map(P), normal: f.normal, outNormal: f.outNormal, ...(f.doubleSided ? { doubleSided: true } : {}),
      // (the live light's share: each corner's light with the sun and without it; 0 where the sun does not reach)
      ...(share ? { sunShare: cs.map((p) => (s ? sunShare(light(f, p, s), light(f, p, 0), (v) => v) : 0)) } : {}) };
    out.push({ ...base, texture: isekaiKeyOf(st, f.group === 'isekai:scree' ? 'scree' : f.group === 'isekai:trail' ? 'packed' : 'dirt', true) + f.v, textureLit: true,
      uv: cs.map((p) => [r5((p[0] - ox) / tile), r5((p[1] - oy) / tile)]), cornerFills, fill: rgbHex(light(f, mean(cs), s)), group: f.group });
    if (f.group === 'isekai:trail') return;
    for (const k of PT) {
      const al = cs.map((p) => r5(weight(k, p)));
      if (al.every((a) => a < 0.5)) continue;   // (below ½ nothing passes the test)
      patches.push({ ...base, texture: isekaiKeyOf(st, k, true), textureLit: true, uv: cs.map((p) => [r5(p[0] / G.scale), r5(p[1] / G.scale)]), cornerFills, fill: cornerFills[0], cornerAlpha: al, blend: 'cut', uvScale: G.scale, group: 'isekai:patch' });
    }
  };
  const split = (f, cs, depth) => {
    const probes = [[0.5, 0.5], [0.12, 0.12], [0.88, 0.12], [0.88, 0.88], [0.12, 0.88]].map(([u, v]) => reach(bil(cs, u, v)));
    if (depth >= G.split || probes.every((s) => s === probes[0])) return leaf(f, cs, probes[0]);
    for (const [u0, v0] of [[0, 0], [0.5, 0], [0.5, 0.5], [0, 0.5]]) split(f, [[u0, v0], [u0 + 0.5, v0], [u0 + 0.5, v0 + 0.5], [u0, v0 + 0.5]].map(([u, v]) => bil(cs, u, v)), depth + 1);
  };
  for (const f of cells) split({ ...f, v: variantOf(f) }, f.corners, 0);
  return [...out, ...patches];
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
  const st0 = ISEKAI_STYLES[manifest.style || 'isekai-meadow'] ?? lookOf(manifest.style)?.card;
  // a `biocube` (era/biocube.js): the level's flora laid over the card's own trees and grass
  const B = st0 && manifest.biocube !== undefined ? readBiocube(manifest.biocube) : null, st1 = B ? withFlora(st0, B) : st0;
  if (!st1) throw new Error(`stage: unknown isekai style '${manifest.style}' (known: ${Object.keys(ISEKAI_STYLES).join(', ')})`);
  const seed = Number.isFinite(manifest.seed) ? manifest.seed : 1, S = seed | 0;
  // the polygon land (`shading`, see the header): the island's drawing, and a gritty one's broken rock
  const SH = readShading(manifest.shading), broken = SH && SH.grit !== undefined && SH.grit >= GRIT_PIXELS ? SH.grit : 0;
  // (a gritty land whose trees are kinds: the theorist's offer of foliage and bark as ramps beside the world's own)
  // (and an arranged clump's harmony, its colours by role: era/flora-colours.js harmonyRamps)
  const st2 = broken && (st1.trees?.leafKinds || st1.thickets) ? { ...st1, palette: { ...st1.palette, ...floraRamps(st1.palette), ...(st1.trees?.leafHarmony ? harmonyRamps(st1.palette, st1.trees.leafHarmony) : {}) } } : st1;
  // SNOW (era/snow.js): a polygon land's snow, its colour the theorist's from the world's own sky and sun, beside the
  // world's ramps (`snow`, and `snow-far` the far ridges' caps)
  if (manifest.snow !== undefined && manifest.snow !== false && !SH) throw new Error('stage: snow lies on a polygon land (`shading`, a geocube\'s land)');
  const SN = SH ? readSnow(manifest.snow) : null, snowR = SN ? snowRamp(st2.palette, st2.light) : null;
  const st = SN ? { ...st2, palette: { ...st2.palette, snow: snowR, 'snow-far': snowFar(st2.palette, snowR) } } : st2;
  // a recipe's `trail` (out-trail.js) builds the site from the trail grammar; absent, the style's own trail
  // ground a stage's buildings have claimed (`_keepOut`, era/reserve.js): planned before anything grows
  const keep = manifest._keepOut ?? null;
  // the trail's dress (era/trail-dress.js): its surface, its rubble, its patches
  // (`dirt`: the dirt trail; `inDirt`: it, or an outdoor surface laid in the dirt, its edge the dirt trail's)
  const TD = readTrailDress(manifest.trail), dirt = TD.surface === 'earth', inDirt = dirt || TD.surface in IN_DIRT;
  const site = reserveSite(manifest.trail !== undefined ? outTrailSite(st, manifest.trail, seed) : natureSite(st, seed), keep), key = st.light.key, dir = sunDir(key.elevation, key.azimuth);
  // ── the geometry ──
  // (a polygon land's rock drawn toward planes, `shading.facet`: on the faces' own heights, as the island's; the land the
  // rest is placed on keeps its own)
  const zG = SH && SH.facet > 0 ? facetedZ(st, site.grid, SH.facet) : site.grid.z;
  const ground = isekaiGround(st, site, zG);
  // (the SAND, era/substrate.js: on a polygon land whose formation turns its flats to sand, those cells' ground is drawn
  // as sand and no grass stands on it; no sand cell, nothing changes)
  // (and a land whose rock names its formation, era/substrate.js, draws its ground by it: the turned ground — sand,
  // bedrock's pavement — and the talus as loose stone, no grass on either; no formation, nothing changes)
  const GF = SH ? formationGround(st, site, SH, seed, broken) : null, onSand0 = GF?.bare ?? null, SA = GF?.to === 'sand' && GF.cells.length ? GF : null;
  if (GF) ground.faces = ground.faces.flatMap((f) => (f.cel ? [f] : GF.cut(f)));
  // (the SNOW over it, era/snow.js: the lying ground cut where its field crosses, a cliff's ledge level enough to hold
  // it whole; the trail's ribbon kept, walked bare)
  const zLow = SN ? site.grid.z.reduce((a, v) => Math.min(a, v), Infinity) : 0, SF = SN ? snowField(SN, { base: zLow, sun: dir, seed }) : null;
  const snowAt = SF ? (p) => SF(p[0], p[1], p[2] ?? site.ground(p[0], p[1]), [0, 0, 1]) > 0 : null;
  if (SF) ground.faces = ground.faces.flatMap((f) => snowOn(f, SF));
  // (no grass on the sand, the bare rock or the talus; in the snow, the share its depth leaves standing, grassUnder)
  const under = SN ? grassUnder(SN) : 1, inSnow = SF && under < 1 ? (p) => snowAt(p) && hash3(Math.round(p[0] * 4), Math.round(p[1] * 4), seed + 1823) >= under : null;
  const onSand = inSnow ? (p) => !!onSand0?.(p) || inSnow(p) : onSand0;
  const plainTiles = { trail: { key: null, scale: 1, tint: st.tint.trail }, fringe: { key: null, scale: 1, tint: st.tint.ground } };
  const ribbon = trailFaces({ ...st, tiles: plainTiles }, site).map(({ texture, textureLit, uv, cls, ...f }) => ({ ...f, tint: cls === 'trail' ? st.tint.trail : st.tint.ground, group: cls === 'trail' ? 'isekai:trail' : 'isekai:ground', cls }));
  // (the TRAIL under snow: its fringe the snow's, its path trodden snow, packed and greyed, the soil showing through
  // as far as the snow is shallow)
  if (SF) {
    const A = snowAlbedo(st.palette.snow), soil = st.palette.soil[Math.floor(st.palette.soil.length / 2)].map((v) => v / 255), worn = SN.depth >= 0.1 ? 0.2 : 0.5;
    const trodden = A.map((v, k) => v * 0.86 * (1 - worn) + soil[k] * worn);
    for (const f of ribbon) if (SF(...mean(f.corners), [0, 0, 1]) > 0) { if (f.cls === 'trail') f._tint = trodden; else f.group = 'isekai:snow'; }
  }
  // a named stone (the trail's landmark) carries its node on every face
  const named = (fs, it) => (it.node ? fs.map((f) => ({ ...f, node: it.node })) : fs);
  const rocks = keep ? rockItems(st, site, seed).filter((r) => kept(keep, r.x, r.y, 1.5)) : rockItems(st, site, seed), boulders = rocks.map((it) => { const b = boulderFaces(st, it, seed, broken); return { it, ...b, sides: named(b.sides, it), cap: named(b.cap, it) }; });
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
  if (keep) for (let i = trees.length - 1; i >= 0; i--) if (!kept(keep, trees[i].x, trees[i].y, CROWN)) trees.splice(i, 1);
  // (a clump's roles its cast names a bush, thickets.js clumpBushes: those trees taken out, bushes stood where they stood)
  const CB = st.thickets && !bamboo && !sakura ? clumpBushes(trees, st.trees, st.thickets, site, { far: TREE_BANDS.far }) : null;
  if (CB && CB.items.length) trees.splice(0, trees.length, ...CB.trees);
  const grove = bamboo ? bambooFaces(st, site, trees) : null;
  const sak = sakura ? sakuraFaces(st, site, trees) : null;
  // the trees BANDED by the trail (a card's `trees.bands`, treeBands): the hero near built whole, the stock past it
  // stamped from templates (built off the map, through everything below, then lifted out), the far a shell
  const TB = !bamboo && !sak && !st.glow ? treeBands(st, site, trees, broken) : null;
  // BUSHES in sections (a biocube's `bushes`, thickets.js): tree kinds with the trunk taken away, drawn through the
  // trees' own path; a blocking bush a collider, a walked-through one drawn in the page's soft groups
  const TS = st.thickets && !bamboo && !sak ? placeThickets(st.thickets, site, { rocks, trees, reserved: site.reserved, far: TREE_BANDS.far }, seed) : null;
  const TH = TS || CB?.items.length ? { items: [...(TS?.items ?? []), ...(CB?.items ?? [])], colliders: [...(TS?.colliders ?? []), ...(CB?.colliders ?? [])], anchors: TS?.anchors ?? [] } : null;
  const wood = bamboo || sak ? [] : treeFaces(st, site, [...(TB ? [...TB.built, ...TB.phantoms] : trees), ...(TH ? TH.items : [])], broken);
  // IKEBANA (a card's `ikebana`, ikebana-place.js): arrangements painted along the banks, standing on the land; what
  // the grass keeps clear of is the trees and every blocking stem
  const ike = st.ikebana ? placeIkebana(st, site, seed) : null, ikeRaw = ike ? ikebanaFaces(st, ike) : [];
  // SHRUBS (a card's `shrubs`, shrubs.js): bushes through the grass by the trail, in flower, in fruit or green; drawn the
  // ikebana's way, and the grass kept off their feet
  // (a biocube's bushes when the recipe names none)
  const shrubAsk = manifest.shrubs !== undefined ? manifest.shrubs : B?.flora?.shrubs ?? undefined;
  const shrubErr = validateShrubs(shrubAsk); if (shrubErr.length) throw new Error(`isekai: ${shrubErr.join('; ')}`);
  const shr = placeShrubs(st.shrubs, shrubAsk, site, { rocks, trees, unit: st.rubble.unit, reserved: site.reserved }, seed);
  const shrRaw0 = ikebanaFaces(st, shr).map((f) => ({ ...f, group: SHRUB_GROUP }));
  // (on a gritty land a bush is a crown's kin: its faces lumped about its own middle, and it stands leaf cards like a
  // crown's mass, below)
  const bushes = broken ? bushMasses(shrRaw0) : [], shrRaw = broken ? lumpBushes(shrRaw0, bushes, broken) : shrRaw0;
  // (and the bushes' footprints: no grass grows up through a bush, `clearR` its reach)
  const near = [...trees, ...(ike ? ike.avoid : []), ...shr.avoid, ...(TH ? TH.items.map((b) => ({ x: b.x, y: b.y, clearR: r5(readBush(st.thickets.kinds[b.bushIx]).spread * b.h * 0.75) })) : [])];
  // THE GLOW (a card's `glow`): every lantern crown a light, baked into the ground round it and lifting the cel band
  const Gl = st.glow, glowLights = Gl ? trees.filter((t) => t.crownAt).map((t) => ({ at: t.crownAt, color: Gl.color, intensity: t.hero ? Gl.trees.hero : Gl.trees.intensity, radius: Gl.trees.radius * (t.hero ? 1.6 : 1) })) : [];
  const glowAt = (p) => { let g = 0; for (const l of glowLights) { const d = Math.hypot(l.at[0] - p[0], l.at[1] - p[1], l.at[2] - p[2]); if (d < l.radius) g = Math.max(g, l.intensity * (1 - d / l.radius) ** 2); } return g; };
  // (a gritty polygon land: its cliffs' rims broken and stones strewn, as the island's; broken-land.js)
  const strewn = [];
  if (broken) {
    breakRims([...ground.faces, ...ribbon], { grit: broken, seed, dx: site.grid.dx });
    // (a made trail takes no pebbles off its corners: it is kept)
    strewn.push(...strewStones(st, { faces: [...ground.faces, ...(inDirt ? ribbon : ribbon.filter((f) => f.cls !== 'trail'))], rocks: [...boulders], heightAt: site.ground, seed, grit: broken }));
    // (and the same stones along a dirt trail's edges, thinning out onto the land)
    // (a road laid in the dirt: more of the stones in on its border)
    if (inDirt && TD.rubble) strewn.push(...strewEdge(st, { site, heightAt: site.ground, seed, grit: broken, keep, ...(dirt ? {} : { inShare: 0.35, inReach: 0.5 }) }));
  }
  // (the strewn stones are drawn and lit but cast nothing: a pebble's shadow is a few centimetres, and each would be one
  // more set of triangles every lit point is tested against)
  // (a broken boulder casts its unbroken shape's shadow: the chips change its outline by centimetres and its faces by
  // many times, and every lit point is tested against them)
  // many times, and every lit point is tested against them; drawn in by an eighth about its foot, so no chip, cut at most
  // a thirteenth in, lies inside the shape that casts for it)
  const inset = (it) => (f) => ({ ...f, corners: f.corners.map((c) => [it.x + (c[0] - it.x) * 0.88, it.y + (c[1] - it.y) * 0.88, it.z0 + (c[2] - it.z0) * 0.88]) });
  const casters = broken ? rocks.flatMap((it) => { const b = boulderFaces(st, it, seed); return [...b.sides, ...b.cap].map(inset(it)); }) : boulders.flatMap((b) => [...b.sides, ...b.cap]);
  // (a stock tree casts as its shell does: its template is drawn, not cast, off the map)
  // (a gritty crown's core, treeFaces: it casts as the crown, and is drawn in its own stops, below, not baked)
  const coreG = broken ? wood.filter((f) => f.group === CORE_GROUP) : [], woodDrawn = broken ? wood.filter((f) => f.group !== CORE_GROUP) : wood;
  const woodCast = TB ? [...wood.filter((f) => !TB.isPhantom(f)), ...treeFaces(st, site, TB.stock.map((t) => ({ ...t, band: 'far' })), broken)] : wood;
  const solid = [...ground.faces, ...ribbon, ...casters, ...woodCast, ...ikeRaw, ...shrRaw, ...(grove ? [...grove.culms, ...grove.sprays] : []), ...(sak ? [...sak.wood, ...sak.clumps, ...sak.sprigs] : [])];
  boulders.push(...strewn);
  // a spray (or a sprig) stops the sun only where its leaves (its flowers) are painted: the floor under it is dappled
  const cardMask = grove ? 'spray' : sak ? 'sprig' : null;
  const shadow = SH && SH.sun && !cardMask ? makeSoftSunShadow(solid, dir, SH.sun, { cell: 0.6 })
    : makeSunShadow(solid, dir, cardMask ? { cell: 0.6, maskOf: (f) => (f.cel === cardMask ? isekaiMask(isekaiKeyOf(st, cardMask, true)) : null) } : { cell: 0.6 });
  // (the live light's SUN SHARE, scene/live-light.js: a world whose page takes actor shadows has the bake write each
  // corner's share of its light that comes straight from the sun, as the stage does; ctx.liveSun, world-scene)
  const sun = { dir, rgb: hexRgb(key.color), gain: st.light.sunGain, bounce: st.light.bounce, bounceGain: st.light.bounceGain, shadow, ...(ctx.liveSun ? { share: true } : {}) };
  const reach = (p, n) => Math.max(0, dot(n, dir)) * shadow(addv(p, mul(n, 0.05)), n);
  const lit = Gl ? (p, n) => reach(p, n) >= st.cel || glowAt(p) >= st.cel : (p, n) => reach(p, n) >= st.cel;
  // ── the pixel-locked faces: the cel band is the choice of tile ──
  // (on the MATERIAL pole, era/style/pole.js, the band is the light's: every tile its one centred window, drawn
  // texel × light — the sun's Lambert where it reaches, the sky's fill where it doesn't)
  const LITL = 0.92;   // (the light of a face in full sun, as a canopy's bands are cut)
  const MAT = poleOf(st) === 'material', fill0 = hexRgb(st.light.ambient).map((v) => v * st.light.fill), E = st.ground?.exposure ?? 1;
  const lightHex = (n, isLit) => { const lam = isLit ? (n ? Math.max(0, dot(n, dir)) : 0.8) : 0, down = n ? Math.max(0, 0.5 - 0.5 * n[2]) : 0; return rgbHex(fill0.map((a, k) => Math.min(1, (a + hexRgb(key.color)[k] * st.light.sunGain * lam + st.light.bounce[k] * st.light.bounceGain * down) * E))); };
  // (`vn`: the form's normal at a corner — rock and cliff are lit SMOOTH over their form, corner by corner, the shadow
  // still the face's own and crisp)
  // (the live light's share, sun.share: a material face's from its light with the sun and without; a cel face's from its band)
  const shareOf = (n, isLit) => {
    if (!isLit) return 0;
    const lam = n ? Math.max(0, dot(n, dir)) : 0.8, down = n ? Math.max(0, 0.5 - 0.5 * n[2]) : 0, K = hexRgb(key.color);
    const noSun = fill0.map((a, k) => a + st.light.bounce[k] * st.light.bounceGain * down);
    return sunShare(noSun.map((v, k) => v + K[k] * st.light.sunGain * lam), noSun, (v) => Math.min(1, v * E));
  };
  const matSun = (rest, n, isLit, vn) => (!sun.share ? {} : { sunShare: vn ? rest.corners.map((c) => shareOf(vn(c) ?? n, isLit)) : shareOf(n, isLit) });
  const celSun = (tile, isLit) => (sun.share ? { sunShare: celShare(st, tile, isLit) } : {});
  const put = (rest, tile, isLit, n = null, vn = null) => (MAT ? { ...rest, texture: isekaiKeyOf(st, tile, true), textureLit: true, fill: lightHex(n, isLit), ...(vn ? { cornerFills: rest.corners.map((c) => lightHex(vn(c) ?? n, isLit)) } : {}), ...matSun(rest, n, isLit, vn) } : { ...rest, texture: isekaiKeyOf(st, tile, isLit), fill: stopFill(st, tile, isLit), ...celSun(tile, isLit) });
  // a form's corner normals: every face's normal summed at the corners it shares
  const formNormals = (faces) => { const m = new Map(), k = (c) => c.map((v) => v.toFixed(2)).join(','); for (const f of faces) for (const c of f.corners) { const a = m.get(k(c)) ?? [0, 0, 0]; m.set(k(c), addv(a, f.normal)); } return (c) => { const a = m.get(k(c)); return a ? unit(a) : null; }; };
  const cel = [];
  const draw = (f, tile, isLit, vn = null) => { const { cel: _c, size: _s, key: _k, celN, ...rest } = f; cel.push(put(rest, tile, isLit, celN ?? f.normal, vn)); };
  const cliffN = MAT ? formNormals(ground.faces.filter((f) => f.cel === 'cliff')) : null;
  // (the polygon land: the rock untiled, lit with the land below; its albedo the rock ramp's middle, as the island's; the
  // talus apron is ground, as the island's is)
  const mid = (ramp) => ramp[Math.floor(ramp.length / 2)].map((v) => v / 255);
  const landTint = SH ? { 'isekai:cliff': mid(st.palette.rock), 'isekai:rock': mid(st.palette.rock), 'isekai:ground': mid(st.palette.grass), 'isekai:scree': mid(st.palette.grass), 'isekai:trail': mid(st.palette.soil), ...(GF ? FORMATION_TINTS(st, mid) : {}), ...(SN ? { 'isekai:snow': snowAlbedo(st.palette.snow) } : {}) } : null;
  const asRock = (f) => { const { cel: _c, celN: _n, size: _s, uv: _u, key: _k, ...rest } = f; return { ...rest, tint: landTint[f.group] }; };
  // (on a polygon land the grass is a biocube's: the island grows none of its own; with it, a boulder big enough wears
  // its hat again, its top the ground's)
  const grows = !!st.grass && (!SH || !!B), hatOf = (b) => grows && b.s >= st.boulder.minHat;
  const capSnow = (f) => SF && f.normal[2] > SN.hold && SF(...mean(f.corners), f.normal) > 0;
  const asCap = (b) => (f) => (capSnow(f) ? { ...asRock(f), group: 'isekai:snow', tint: landTint['isekai:snow'] } : SH && hatOf(b) ? { ...asRock(f), group: 'isekai:ground', tint: landTint['isekai:ground'] } : asRock(f));
  const rockFaces = SH ? [...ground.faces.filter((f) => f.cel === 'cliff').map(asRock), ...boulders.flatMap((b) => [...b.sides.map(asRock), ...b.cap.map(asCap(b))])] : [];
  if (!SH) for (const f of ground.faces) if (f.cel === 'cliff') draw(f, 'cliff', lit(mean(f.corners), f.celN), cliffN);
  const H = st.hat, fringes = [];
  for (const b of boulders) {
    const hatted = SH ? hatOf(b) : b.s >= st.boulder.minHat;
    if (!SH) {
      const bn = MAT ? formNormals([...b.sides, ...b.cap]) : null;
      for (const f of b.sides) draw(f, 'rock', lit(mean(f.corners), f.normal), bn);
      for (const f of b.cap) draw(f, hatted ? 'hat' : 'rock', lit(mean(f.corners), f.normal), bn);
    }
    if (hatted) for (const e of b.rim) {
      const n = facet([e.a, e.b, e.b2, e.a2], sub(mean([e.a, e.b]), [b.it.x, b.it.y, b.it.z0]));
      drape(fringes, e.a, e.b, e.a2, e.b2, H.fringe * b.s, H.out, n, null, H.scale, 'isekai:hat');
      fringes[fringes.length - 1].lit = lit(mean([e.a, e.b]), [0, 0, 1]) && dot(n, dir) > -0.35;
    }
  }
  const Lp = st.lip;
  // (a card with no grass, an airless one's, drapes no fringe over its cliff lips and stands no blades)
  for (const l of grows ? (inSnow ? ground.lips.filter((q) => !inSnow(q.a)) : ground.lips) : []) {
    drape(fringes, l.a, l.b, addv(l.a, mul(l.down, Lp.fringe * 2)), addv(l.b, mul(l.down, Lp.fringe * 2)), Lp.fringe, Lp.out, l.out, null, Lp.scale, 'isekai:lip');
    fringes[fringes.length - 1].lit = lit(mean([l.a, l.b]), [0, 0, 1]) && dot(l.out, dir) > -0.35;
  }
  for (const f of fringes) { const { lit: L, key: _k, ...rest } = f; cel.push(put(rest, 'fringe', L, f.normal)); }
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
  // the arrangements: each face its part's ramp in the kit's skin, a stop up where the sun reaches it
  for (const f of [...ikeRaw, ...shrRaw]) { const { part: _p, value: _v, ...rest } = f; cel.push({ ...rest, fill: rgbHex(ikebanaFill(st, f, lit(mean(f.corners), f.normal), dot(f.normal, dir) < -0.2).map((v) => v / 255)) }); }
  // grass: crossed blade cards, the band by the shadow at the root
  const tufts = grows ? grassTufts(st, site, near, rocks, sun, seed).filter((t) => !onSand?.(t.pos)) : [], G = st.grass?.cards;
  tufts.forEach((t, i) => {
    const raw = [], h = t.scale * G.height;
    crossed(raw, [t.pos[0], t.pos[1], t.pos[2] - 0.03], Math.PI * hash3(i, 61, S + 157), h * G.width, h, isekaiKeyOf(st, 'blades', t.lit), [1, 1, 1], 'isekai:grass', t.level === 'L1' ? 3 : 2);
    for (const { tint, textureLit, ...f } of raw) cel.push(MAT ? put(f, 'blades', t.lit) : { ...f, fill: stopFill(st, 'blades', t.lit), ...celSun('blades', t.lit) });
  });
  // the FIELD: within `reach` of the trail the meadow stands as one sea of blades, a tuft on a jittered grid every
  // `every` metres (never on the ribbon, a rock or a trunk), the band by the shadow at its root
  const F = grows ? st.grass.field : null;
  if (F) {
    let i = 0;
    for (let y = 0.2; y < site.D; y += F.every) for (let x = 0; x < site.W; x += F.every, i++) {
      const px = x + (hash3(i, 71, S + 181) - 0.5) * F.every, py = y + (hash3(i, 73, S + 191) - 0.5) * F.every, d = site.trailDist(px, py), edge = site.halfWAt(py) + site.fringeAt(py);
      if (d < edge || d > edge + F.reach * (0.75 + 0.5 * vnoise(px * 0.2, py * 0.2, S + 193))) continue;
      if (site.apronAt(px, py) > st.landform.apronMin || px < site.cliffX(py) + 1 || onSand?.([px, py])) continue;
      if (rocks.some((r) => r.role !== 'pebble' && Math.hypot(r.x - px, r.y - py) < r.size * st.rubble.unit * 0.55) || near.some((t) => Math.hypot(t.x - px, t.y - py) < 0.5)) continue;
      const z = site.ground(px, py), lt = shadow([px, py, z + 0.3], [0, 0, 1]) > 0 || (Gl ? glowAt([px, py, z + 0.3]) >= st.cel : false), h = mix(F.height[0], F.height[1], hash3(i, 75, S + 197)) * G.height;
      const raw = [];
      crossed(raw, [px, py, z - 0.03], Math.PI * hash3(i, 77, S + 199), h * G.width, h, isekaiKeyOf(st, 'blades', lt), [1, 1, 1], 'isekai:grass', 2);
      for (const { tint, textureLit, ...f } of raw) cel.push(MAT ? put(f, 'blades', lt) : { ...f, fill: stopFill(st, 'blades', lt), ...celSun('blades', lt) });
    }
  }
  // the SAND dressed (era/strand.js): pebbles in drifts and driftwood lying on it, dune grass in clumps (no shells: no
  // shore inland); each piece a stop up where the sun reaches it, and cast nothing
  if (SA) {
    for (const p of strewStrand(st, { cells: SA.cells, cell: SA.cell, heightAt: site.ground, seed, grit: broken, keep, on: SA.at })) {
      const isLit = lit([p.at[0], p.at[1], site.ground(p.at[0], p.at[1]) + 0.15], [0, 0, 1]);
      for (const { part: _p, value: _v, ...f } of p.faces) cel.push({ ...f, fill: rgbHex(strandFill(st, { part: _p, value: _v }, isLit, dot(f.normal, dir) < -0.2).map((v) => v / 255)) });
    }
    const avoid = [...rocks.filter((r) => r.role !== 'pebble').map((r) => ({ x: r.x, y: r.y, r: r.size * st.rubble.unit * 0.6 })), ...near.map((t) => ({ x: t.x, y: t.y, r: 0.6 }))];
    const dune = duneGrass(st, { cells: SA.cells, cell: SA.cell, heightAt: site.ground, seed, keep, avoid, on: SA.at });
    for (const { rgb, ...f } of duneGrassFaces(st, dune, (p) => lit(p, [0, 0, 1]), site.inRadius)) cel.push({ ...f, fill: rgbHex(rgb.map((v) => v / 255)) });
  }
  // the ROCK GROUND grown (era/rock-flora.js): lichen on a formation's pavement, its boulders' and stones' caps and its
  // talus; on a pavement, cushions, stonecrop and (in the shade) ferns in its joints — the karst tile's own, gritty
  if (GF) {
    const caps = boulders.flatMap((b) => b.cap).filter((f) => f.normal[2] > 0.6), talus = ground.faces.filter((f) => f.group === 'isekai:talus' || f.group === 'isekai:rubble').map((f) => mean(f.corners));
    const shadeAt = (p) => shadow([p[0], p[1], p[2] + 0.2], [0, 0, 1]) <= 0;
    // (drawn in its ramps' stops: down its ramps as far as the world's foliage dims at the hour, hourDim)
    const rs = hourDim(st);
    for (const q of growRockFlora(st, { cells: GF.to === 'bedrock' ? GF.cells : [], cell: GF.cell, talus, caps, heightAt: site.ground, seed, grit: broken || 0.5, keep, on: GF.at, joints: broken ? pavementJoints() : null, shadeAt })) {
      if (snowAt && snowAt(q.at)) continue;
      const isLit = lit([q.at[0], q.at[1], site.ground(q.at[0], q.at[1]) + 0.15], [0, 0, 1]);
      for (const { part, value, ...f } of q.faces) cel.push({ ...f, fill: rgbHex(rockFloraFill(st, { part, value }, isLit, dot(f.normal, dir) < -0.2, rs).map((v) => v / 255)) });
    }
  }
  // a gritty crown CHIPPED (era/leaf-chips.js; the stage's crowns are never plain balls on a gritty land): its core in its
  // two darkest stops by the sun, and over it the chips, each low, mid or high by the crown's light and the sun's reach,
  // those buried in a neighbouring core left out; a far tree its core alone (treeBands)
  if (broken && coreG.length) {
    const C = st.trees.crown, ramp = st.palette[st.lock[st.trees.form === 'blossom' ? 'isekai:blossom' : 'isekai:crown']] ?? st.palette.foliage, hexOf = (c) => rgbHex(c.map((v) => v / 255));
    // (the hour's shift along the foliage: a core's lit stop and every chip's stops come down at dusk and night)
    // (the hour's light is one: measured on the world's foliage, every picked foliage moves the same stops)
    const hs = hourShift(st, st.tint.crown, ramp), dark = hexOf(ramp[0]), lite = hexOf(ramp[Math.max(0, Math.min(1, ramp.length - 1) + hs)]);
    // (a tree kind's core in the foliage it picked: its ramp's two darkest stops)
    const stopsOf = (f) => (f._ramp && st.palette[f._ramp] ? [hexOf(st.palette[f._ramp][0]), hexOf(st.palette[f._ramp][Math.max(0, 1 + hs)])] : [dark, lite]);
    for (const { tint: _t, ...f } of coreG) { const c = mean(f.corners), [dk, lt] = stopsOf(f); cel.push({ ...f, fill: dot(f.normal, dir) > 0.15 && shadow(addv(c, mul(f.normal, 0.05)), f.normal) > 0.5 ? lt : dk }); }
    const crowned = [...(TB ? [...TB.built, ...TB.phantoms] : trees), ...(TH ? TH.items : [])].filter((t) => t.masses || t.lobes), cores = crowned.flatMap((t) => (t.lobes ? [] : t.masses.map((m) => ({ ...m, t }))));
    // (a species' lobes, era/leaf-forms.js: buried in a lobe of another tree by the same share of the lobe as a ball's)
    const lobes = crowned.flatMap((t) => (t.lobes ? t.lobes.map((L) => ({ L, t, r: Math.max(...L.axes) })) : []));
    const buried = (p, t) => cores.some((m) => Math.abs(m.at[0] - p[0]) < m.r && Math.abs(m.at[1] - p[1]) < m.r && Math.hypot((p[0] - m.at[0]) / m.r, (p[1] - m.at[1]) / m.r, (p[2] - m.at[2]) / (m.r * C.squash)) < CHIP_DEFAULTS.shrink * CHIP_BURIED)
      || (lobes.length > 0 && lobes.some((q) => q.t !== t && Math.abs(q.L.at[0] - p[0]) < q.r && Math.abs(q.L.at[1] - p[1]) < q.r && withinLobe(p, q.L, CHIP_DEFAULTS.shrink * CHIP_BURIED)));
    for (const t of crowned) {
      if (t.band === 'far') continue;
      const opts = { crown: { c: t.crownAt, Rc: t.crownR, squash: C.squash }, toSun: dir, shadow, ramp: (t.leafRamp && st.palette[t.leafRamp]) || ramp, seed: Math.round(t.x * 17 + t.y * 5), ...(hs ? { shift: hs } : {}) };
      const chips = t.lobes ? formChips(t.lobes, { ...opts, grain: LEAF_FORMS[t.form].grain, lean: LEAF_FORMS[t.form].lean }) : leafChips(t.masses, opts);
      for (const f of chips) if (!buried(mean(f.corners), t)) cel.push(t.soft ? { ...f, _soft: true } : f);
    }
  }
  // LEAF CARDS (the material pole, a canopy): crossed cutout cards stood out of each crown mass, stamped with the look's
  // leaf die — dense at the foot on the crown, ragged at the tip — so a crown's edge is leaves, not a blob's curve
  // (and on a gritty land, gritty-flora.js: the same cards, each its band's tile drawn hi-def in the foliage's own stops
  // rather than lit by the vertex, so a crown's outline is leaves on either pole)
  if ((MAT || broken) && st.tiles.leafcard) {
    const fillL = lumaOf(fill0);
    // (a gritty land's trees are chipped, above: its bushes keep their cards)
    for (const t of [...(broken ? [] : TB ? [...TB.built.filter((q) => q.band !== 'far'), ...TB.phantoms] : trees), ...bushes]) for (const [mi, m] of (t.masses ?? []).entries()) {
      const N = 6 + Math.round(m.r * 4);
      for (let i = 0; i < N; i++) {
        const zc = 1 - 1.7 * ((i + 0.5) / N), rr = Math.sqrt(Math.max(0, 1 - zc * zc)), az = i * 2.39996 + hash3(mi, i, 1201) * 0.6, d = unit([Math.cos(az) * rr, Math.sin(az) * rr, zc]);
        const at = (k) => [m.at[0] + d[0] * m.r * k, m.at[1] + d[1] * m.r * k, m.at[2] + d[2] * m.r * m.squash * k];
        const p0 = at(0.7), p1 = at(1.45), e1 = unit(Math.abs(d[2]) > 0.9 ? cross(d, [1, 0, 0]) : cross(d, [0, 0, 1])), e2 = unit(cross(d, e1)), w = m.r * 0.85, mid = at(1);
        const lam = Math.max(0, dot(d, dir)), reach = shadow(addv(mid, mul(d, 0.2)), [0, 0, 1]) > 0 ? 1 : 0;
        const light = fill0.map((a, k) => Math.min(1, (a + hexRgb(key.color)[k] * st.light.sunGain * (0.35 + 0.65 * lam) * reach) * E));
        const { band, fill } = canopyBand(light, fillL, LITL);
        for (const e of [e1, e2]) {
          const cs = [sub(p0, mul(e, w / 2)), addv(p0, mul(e, w / 2)), addv(p1, mul(e, w / 2)), sub(p1, mul(e, w / 2))].map(P), n = unit(cross(e, d));
          cel.push({ corners: cs, normal: n.map(r5), outNormal: n.map(r5), uv: [[0, 0], [1, 0], [1, 1], [0, 1]], ...(MAT ? { texture: `isekai:${st.id}:leafcard-b${band}`, textureLit: true, fill } : { texture: `isekai:${st.id}:leafcard-b${band}+hd`, fill: stopFill(st, 'leafcard', band < 2) }), group: 'isekai:leaves', doubleSided: true });
        }
      }
    }
  }
  // ── the bake, then the lock ──
  const ambient = hexRgb(st.light.ambient).map((v) => v * st.light.fill);
  // the realistic pole (a card's `ground`) draws the ground and the scree itself: material × light, shadows crisp
  // (the trail ribbon too: the old bake of it is kept only as what the trail blend reads its stops from)
  const bare = ground.faces.filter((f) => !f.cel), real = st.ground && !SH ? realGround(st, site, [...bare.map((f) => ({ ...f, grid: true })), ...ribbon], shadow, sun, ambient, isekaiMarks(st, site, S), S, !!sun.share) : [];
  // the trees on the material pole: their faces light only (white), then the bark's grain and the leaf's tile on
  const woodM = MAT ? woodDrawn.map((f) => ({ ...f, tint: [1, 1, 1], mat: f.group === 'isekai:wood' ? 'grain' : 'leaf' })) : woodDrawn;
  // (the polygon land: the land baked and ruled as the island's, the rest as before)
  const land = SH ? ruleLand(bakeLand([...[...bare, ...ribbon].map(({ cls: _c, _tint, ...f }) => ({ ...f, tint: _tint ?? landTint[f.group] ?? f.tint })), ...rockFaces], ambient, sun, SH), SH, landTint, { cell: site.grid.dx, seed: seed + 517, ...(SH.valley > 0 ? { valley: valleyOf({ ...site.grid, z: zG }) } : {}) }) : [];
  const plain = SH ? woodM : [...(st.ground ? [] : bare), ...ribbon, ...woodM];
  const baked = bakeStageLight(plain, glowLights, ambient, SH ? undefined : isekaiMarks(st, site, S), sun).map(({ cls, ...f }) => f);
  // (the crowns on the material pole with a canopy: each face its skin's BAND by the light it was baked with)
  const SHADEL = lumaOf(ambient);
  const drawn = (st.ground && !SH ? baked.slice(ribbon.length) : baked).map((f) => (!f.mat ? f : f.mat === 'leaf' && st.tiles.canopy ? canopyFace(st, f, SHADEL, LITL) : materialFace(st, f)));
  // the TRAIL BLEND: the soil's rim out over the grass and the grass's creep in over the trail, each in the stop nearest
  // the baked colour of the lane it carries on — the trail's along the edge for the rim, the fringe's for the creep —
  // so the blend is the two materials meeting, not a third laid between them
  if (st.trailBlend && !SH) {
    const rb = baked.slice(st.ground ? 0 : bare.length).slice(0, ribbon.length), strips = trailRims(st, site, seed);
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
  const ridges = layerFaces(st, site, dir, SN ? { line: SN.line, base: zLow, seed } : null);
  if (st.cumulus) for (const f of cumulusFaces(st, site, dir, !!broken)) cel.push(f);
  // (a gritty polygon land's ground in detail: the path, the turf, the verge across the trail's fringe lanes; the land is
  // the bare ground, then the ribbon's lanes in order, then the rock. A paved trail, era/trail-dress.js `surface`, leans
  // its lanes to its word's colour and, gritty, lays its word's tile for the path's; its fringe is turf to its edge)
  const nb = bare.length, lane = (i) => (i >= nb && i < nb + ribbon.length ? ribbon[i - nb].cls : null), SD = dirt ? null : surfaceDress(TD.surface, { grit: broken, rock: st.palette.rock });
  const lean = (f) => ({ ...f, fill: leanHue(f.fill, SD.colour, SD.share), ...(f.cornerFills ? { cornerFills: f.cornerFills.map((c) => leanHue(c, SD.colour, SD.share)) } : {}) });
  // (a gritty trail in the dirt: its verge fades from the dirt to the land across it, and the dirt spills over its edge
  // in a ragged band, era/trail-dress.js; an outdoor surface's stones leant over the dirt after, so its edge is dirt)
  const landV = broken && inDirt ? verged(land, lane) : land;
  const landP = SD?.colour ? landV.map((f, i) => (lane(i) === 'trail' ? lean(f) : f)) : landV;
  const TC = GF ? TALUS_CUTS[GF.skin] : null;
  const landD0 = broken ? withGrittyGround(landP, broken, { verge: (i) => inDirt && lane(i) !== null && lane(i) !== 'trail', nearTrail: (c) => site.trailDist(c[0], c[1]), ...(SD?.tile ? { trail: SD.tile } : {}), ...(TC ? { cuts: TC } : {}) }) : landP;
  // (a gritty talus's edge, formationGround: over the turf of its bands its scree's stones, fewer band by band, coloured
  // as the turf beneath is lit, in the talus's albedo)
  const toTalus = GF ? ((T, G) => (hex) => rgbHex(hexRgb(hex).map((v, k) => Math.min(1, (v * T[k]) / G[k]))))(landTint['isekai:talus'], landTint['isekai:ground']) : null;
  const screeOf = TC && broken ? (level) => screeKey(groundKey(TC['isekai:talus'], broken), level) : null;
  const talusEdge = [];
  if (screeOf) for (const { screeLevel: level, ...f } of landP) {
    // (under snow the edge's stones are buried)
    if (level === undefined || f.group === 'isekai:snow') continue;
    const over = { ...f, corners: f.corners.map((c) => [c[0], c[1], r5(c[2] + 0.006)]), group: 'isekai:talus', fill: toTalus(f.fill), ...(f.cornerFills ? { cornerFills: f.cornerFills.map(toTalus) } : {}) };
    talusEdge.push({ ...layDetail(over, { key: screeOf(level), metres: TC['isekai:talus'].metres, as: 'floor' }), scree: true });
  }
  const landD = GF ? landD0.map(({ screeLevel: _s, ...f }) => f) : landD0;
  // (a gritty dirt trail's patches, worn, damp, gravel…, on its ribbon: era/trail-dress.js)
  const lanes = broken && inDirt ? landV.slice(nb, nb + ribbon.length).map((f, i) => ({ ...f, cls: ribbon[i].cls })) : null;
  // (a road laid in the dirt: its border sand worked into its cracks, the road showing through beneath)
  const sand = broken && SD?.dirt && SD.tile ? sandBands({ site, lanes, roadKey: detailKey(SD.tile.params, SD.tile.seed, SD.tile.metres, 0), metres: SD.tile.metres, seed, keep }) : [];
  // (and any trail in the dirt: the land's turf worked into its verge's outer edge)
  // (beside a talus, its scree instead, its stones thinning in onto the verge)
  const besideTalus = GF ? (cs) => GF.talus(cs.reduce((a, c) => (site.trailDist(c[0], c[1]) > site.trailDist(a[0], a[1]) ? c : a))) : null;
  const turf = broken && inDirt ? turfBands({ site, lanes, turfKey: turfKey(broken, 0), metres: GROUND_CUTS['isekai:ground'].metres, seed, keep, ...(besideTalus ? { where: (cs) => !besideTalus(cs) } : {}) }) : [];
  const screeVerge = broken && inDirt && screeOf ? screeBands({ site, lanes, keyOf: screeOf, metres: TC['isekai:talus'].metres, seed, keep, where: besideTalus, tone: toTalus }) : [];
  const patches = broken && inDirt ? [...sand, ...turf, ...screeVerge, ...edgeSpill({ site, lanes, grit: broken, seed, keep, key: (v) => trailKey(broken, v), metres: GROUND_CUTS['isekai:trail'].metres, scale: IN_DIRT[TD.surface]?.spill ?? 1 }),
    ...(dirt ? trailPatches({ site, lanes: land.slice(nb, nb + ribbon.length).map((f, i) => ({ ...f, cls: ribbon[i].cls })), kinds: TD.patches, grit: broken, seed, keep }) : [])] : [];
  // (no dirt patch, turf or spill lies over the snow)
  const patchesS = SF ? patches.filter((f) => !(SF(...mean(f.corners), [0, 0, 1]) > 0)) : patches;
  const faces = [...landD, ...talusEdge, ...patchesS, ...lockFaces([...drawn, ...cel, ...ridges], (f) => (f.textureLit ? null : f._ramp ? st.palette[f._ramp] : st.lock[f.group] ? st.palette[st.lock[f.group]] : null)).map((f) => (f._ramp === undefined ? f : (({ _ramp: _r, ...g }) => g)(f))), ...real, ...(site.out ? streamFaces(site, st) : [])];
  if (Gl) glowFaces(faces, Gl, trees, st);
  // the trail's boundary (out-bounds.js): a painted panel, a mirrored band
  if (site.out) faces.push(...boundFaces(site, site.bounds, faces, st, seed));
  // (a gritty polygon land's flora in detail, as its rock: leaves on the crowns, bark up the trunks, gritty-flora.js; its
  // clouds' cards drawn hi-def in their own stops, isekai-tiles.js `+hd`)
  const hdCloud = (k) => (broken && /:cumulus-/.test(k || '') ? `${k}+hd` : k);
  // (the older flora drawn in swatch colours rather than a ramp, the shrubs, their leaf cards and the ikebana, darkened at
  // the hour as far as the world's foliage comes down its ramp: hourShift)
  const nightDim = hourDim(st);
  // (and under SNOW, era/snow.js: a leaf turned up far enough carries it, its share of them, the bushes mounds)
  const facesS = SF ? snowOnFlora(faces, st, SN, (c) => SF(c[0], c[1], site.ground(c[0], c[1]), [0, 0, 1]) > 0) : faces;
  const drawnFaces0 = (broken ? withGrittyFlora(facesS, broken).map((f) => (hdCloud(f.texture) === f.texture ? f : { ...f, texture: hdCloud(f.texture) })) : facesS).map(softBrush).map((f) => (nightDim < 1 && SWATCH_FLORA.has(f.group) ? dimmed(f, nightDim) : f));
  // (the stock's templates lifted out of the drawn faces, each stamped where its trees stand, in the shade a step down)
  const drawnFaces = TB ? drawnFaces0.filter((f) => !TB.isPhantom(f)) : drawnFaces0;
  const treeRepeats = TB ? TB.repeats(drawnFaces0.filter((f) => TB.isPhantom(f)), (p) => shadow(p, [0, 0, 1])) : [];
  const cutouts = [...new Set(faces.filter((f) => /^isekai:.*:(fringe|blades|cumulus|spray|petals|sprig|rim|creep|leafcard)-|^sand:|^scree:/.test(f.texture || '')).map((f) => hdCloud(f.texture)))].sort();
  // ── the frame ──
  const Fr = st.frame || { look: 28, top: { y: 22, lookY: 48 } };
  const y0 = 2.5, x0 = site.trailX(y0), y1 = Fr.look, x1 = site.trailX(y1), eye = [x0, y0, site.ground(x0, y0) + 1.7];
  const ly = Fr.top.y, lx = site.cliffX(ly) - 1.6, lip = [lx, ly, site.ground(lx, ly) + 1.7];
  const sky = st.palette.sky, Fh = Fr.hero, heroCam = [];
  // the HERO frame: from the trail short of the hero, up into its crown (none when reserved ground took the tree)
  const ht = Fh && sak ? trees.filter((q) => q.hero)[Fh.tree] : null;
  if (ht) {
    const t = ht, hy = t.y - Fh.back, hx = site.trailX(hy), at = [hx, hy, site.ground(hx, hy) + Fh.eye];
    heroCam.push({ name: 'hero', worldFraming: { cameraPosition: at.map(r5), lookAt: [t.crownAt[0], t.crownAt[1], t.crownAt[2] - 0.2 * t.crownR].map(r5), horizontalFov: Fh.fov, pictureCenter: [560, 390] } });
  }
  const payload = {
    faces: drawnFaces,
    cutouts,
    ...(treeRepeats.length ? { repeats: treeRepeats } : {}),
    ...(st.clouds ? { effects: [composeCloudDeck([], { up: 'z', ...st.clouds, sun: dir })] } : {}),
    lights: [],
    cameras: [manifest.camera || (site.out ? outTrailCamera(site) : { name: 'trail', worldFraming: { cameraPosition: eye.map(r5), lookAt: [x1, y1, site.ground(x1, y1) + 3].map(r5), horizontalFov: 75, pictureCenter: [560, 390] } }),
      { name: 'cliff-top', worldFraming: { cameraPosition: lip.map(r5), lookAt: [site.W * 0.75, Fr.top.lookY, site.ground(site.W * 0.75, Fr.top.lookY)].map(r5), horizontalFov: 75, pictureCenter: [560, 390] } }, ...heroCam],
    viewBox: manifest.viewBox || { width: 1120, height: 780 },
    title: ctx.title || manifest.title || `mojulo stage · ${st.id.replace('-', ' ')}`,
    bg: rgbHex(sky[sky.length - 1].map((v) => v / 255)),
    haze: { color: st.air.fog.color, density: st.air.fog.density },
    sky: { ...(st.night ? nightSky(st, dir) : st.void ? voidSky(st, dir) : { zenith: sky[0], horizon: sky[sky.length - 1], day: 1, stars: 0, seed: 1, ...(st.sun ? { sun: { dir: dir.map(r5), size: st.sun.size, glow: st.sun.glow } } : {}), ...(st.companion ? { moon: domeAt(st.companion) } : {}) }),
      // (a geocube's weather: its clouds painted round the dome, matte-paint/sky.js)
      ...(st.cloudBand ? { clouds: cloudBand(st.cloudBand) } : {}) },
    glow: !!Gl,
    pack: true,
    // (the live grass: asked for by the recipe, or the carpet a biocube's grass lays by default)
    ...((manifest.wind || manifest.grass || (B?.flora?.grass && B.flora.grass.live !== null)) && grows ? { liveGrass: offSand(grittyGrass(liveGrassConfig(st, site, rocks, near, shadow, manifest.wind || true, seed, manifest.grass ?? (B?.flora?.flowers ? { flowers: B.flora.flowers } : undefined)), broken, st), onSand) } : {}),
    // a gritty polygon land's rock: its fabric drawn near the eye, as the island's (its own strata and joints)
    ...(broken ? { fabric: (() => {
      const base = { joints: site.grid.joints ?? { spacing: st.landform.joint }, strata: site.grid.strata ?? null, grit: SH.grit, sun: dir, seed, rockColour: stopFill(st, 'cliff', true), green: stopFill(st, 'blades', true) };
      if (SH.skin === undefined) return rockFabric({ ...base, rockColour: null, green: null });
      if (SH.rocks === undefined) return rockFabric({ ...base, skin: SH.skin });
      return { ...rockFabric({ ...base, skin: SH.skin, groups: FABRIC_GROUPS }), also: rockFabric({ ...base, skin: SH.rocks, seed: seed + 101, groups: ['isekai:rock'], key: 'rock-fabric-rocks' }) };
    })() } : {}),
    walk: manifest.walk === false ? false : { speed: 6, spawn: eye.map(r5), minEye: WALK_EYE, gravity: 22, radius: 0.4 },
    ...(site.out ? outTrailPayload(site) : {}),
  };
  // (the SNOW's prints: a footprint bed round the walker on the snow, scene/channels/snow-prints.js)
  if (SF) payload.snowPrints = snowPrintsConfig(st, site, zG, SN, SF, shadow, dir, drawnFaces);
  // the arrangements on the page: the soft group is walked through; what blocks is a collider and every arrangement an
  // anchor an engine can find
  if (shr.anchors.length) Object.assign(payload, { colliders: [...(payload.colliders ?? []), ...shr.colliders], anchors: [...(payload.anchors ?? []), ...shr.anchors] });
  if (ike) Object.assign(payload, { soft: [SOFT_GROUP], colliders: [...(payload.colliders ?? []), ...ike.colliders], anchors: [...(payload.anchors ?? []), ...ike.anchors] });
  // (the bushes' sections: a blocking bush a collider, the walked-through drawn in soft groups, each section an anchor)
  if (TH && TH.items.length) Object.assign(payload, { colliders: [...(payload.colliders ?? []), ...TH.colliders], anchors: [...(payload.anchors ?? []), ...TH.anchors],
    ...(TH.items.some((t) => t.soft) ? { soft: [...(payload.soft ?? []), ...Object.values(SOFT_BRUSH)] } : {}) });
  // a biocube's FAUNA (era/biocube-fauna.js): the field's swarms and birds on the page (scene/channels/fauna.js), and its
  // herds as the units the world lowers to bodies on their rigs (worlds/fauna-units.js), each on its own ground; none,
  // not one byte
  if (B?.fauna) {
    const at = { st, site, trees, seed, formation: SH && typeof SH.skin === 'string' && FORMATION_TURNS[SH.skin] ? SH.skin : null };
    const field = placeFauna(B.fauna, at), units = placeHerds(B.fauna, at);
    if (Object.keys(field).length > 1) payload.fauna = field;
    if (units) payload.faunaUnits = units;
  }
  return payload;
}

/**
 * THE NIGHT SKY (a card's `night`): dark to the zenith, the stars out, the moon drawn on the dome where the key light
 * comes from (the dome's front-sky u, h: azimuth −90° at u = ½, swinging 180° per unit), and a pale world hanging where
 * the card puts it.
 */
/** A body on the dome's front sky (u, h) from its azimuth and elevation (degrees), with its phase and size: a card's
 *  `companion` (a world hanging in the day sky) is drawn as the dome's moon is. */
function domeAt({ azimuth, elevation, size = 4, phase = 0.6 }) {
  const d = sunDir(elevation, azimuth), az = Math.atan2(d[1], d[0]), el = Math.asin(Math.max(-1, Math.min(1, d[2])));
  return { u: r5((az + Math.PI / 2) / Math.PI + 0.5), h: r5(el / (Math.PI / 2)), phase, size };
}
/** THE VOID (a card's `void`: a world with no air): the sky the palette's void, the stars out by day, the sun a white
 *  disc where the key comes from, and a world hanging where the card puts it. */
function voidSky(st, dir) {
  const V = st.void, sky = st.palette.sky;
  return { zenith: sky[0], horizon: sky[sky.length - 1], day: 0, stars: V.stars ?? 1, seed: 1,
    sun: { dir: dir.map(r5), size: st.sun?.size ?? 1, glow: V.glow ?? 0.5 }, ...(V.companion ? { moon: { ...domeAt(V.companion), ...(V.companion.color ? { color: V.companion.color } : {}) } } : {}) };
}
export function nightSky(st, dir) {
  const N = st.night, sky = st.palette.sky, az = Math.atan2(dir[1], dir[0]), el = Math.asin(Math.max(-1, Math.min(1, dir[2])));
  return { zenith: sky[0], horizon: sky[sky.length - 1], day: N.day, stars: N.stars, seed: 1,
    moon: { u: r5((az + Math.PI / 2) / Math.PI + 0.5), h: r5(el / (Math.PI / 2)), phase: N.moon.phase, size: N.moon.size },
    ...(N.planet ? { sun: { dir: sunDir(N.planet.elevation, N.planet.azimuth).map(r5), size: N.planet.size, glow: N.planet.glow } } : {}) };
}

/** Self-lit faces for a card's `glow`: the groups it names glow in their own (locked) colour; the crown face nearest the
 *  top of each of the first `halos` lanterns (the hero first) carries a halo. */
function glowFaces(faces, Gl, trees, st) {
  const halos = trees.filter((t) => t.crownAt).sort((a, b) => (b.hero ? 1 : 0) - (a.hero ? 1 : 0)).slice(0, Gl.halos), best = halos.map(() => [Infinity, -1]);
  faces.forEach((f, i) => {
    const k = Gl.emissive[f.group];
    if (!k) return;
    // lifted `lift` stops up its locked ramp: the night left it dark, the glow is its own
    const ramp = st.palette[st.lock[f.group]], rgb = hexRgb(f.fill).map((v) => v * 255);
    const at = ramp ? ramp.reduce((b, s, j) => (Math.hypot(...s.map((v, q) => v - rgb[q])) < Math.hypot(...ramp[b].map((v, q) => v - rgb[q])) ? j : b), 0) : -1;
    const fill = ramp ? rgbHex(ramp[Math.min(ramp.length - 1, at + (Gl.lift || 0))].map((v) => v / 255)) : f.fill;
    faces[i] = { ...f, fill, emissive: hexRgb(fill), emissiveStrength: k };
    const c = mean(f.corners);
    halos.forEach((t, j) => { const d = Math.hypot(c[0] - t.crownAt[0], c[1] - t.crownAt[1], c[2] - t.crownAt[2] - t.crownR); if (d < best[j][0]) best[j] = [d, i]; });
  });
  for (const [, i] of best) if (i >= 0) faces[i] = { ...faces[i], glow: `0 0 12px 5px ${Gl.color}` };
}

/**
 * The far LAYERS: rings of standing panels round the site's centre, each a stop of the far ramp (its own colour: the
 * haze is thin and does not make the depth), its skyline a ridged noise round the ring — peaks, not lumps.
 */
export function layerFaces(st, site, dir = [0, 0, 1], snow = null) {
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
      if (!L.skirt) {
        // (under SNOW, era/snow.js: the ridge white over its line, hazed into the layer's far stop; the line wandering
        // down the gullies, and over the whole ridge without one but its foot)
        const cap = snow ? (kk) => Math.min(sky(kk), snowCapLine(snow, L, kk, n, li)) : null;
        out.push({ corners: [at(k, -20), at(k + 1, -20), at(k + 1, cap ? cap(k + 1) : sky(k + 1)), at(k, cap ? cap(k) : sky(k))].map(P), normal: nn, outNormal: nn, fill, group: 'isekai:ridge' });
        if (cap && (sky(k) > cap(k) + 0.05 || sky(k + 1) > cap(k + 1) + 0.05)) out.push({ corners: [at(k, cap(k)), at(k + 1, cap(k + 1)), at(k + 1, sky(k + 1)), at(k, sky(k))].map(P), normal: nn, outNormal: nn, fill: hexOf(st.palette['snow-far'][L.stop]), group: 'isekai:ridge', _ramp: 'snow-far' });
        continue;
      }
      // a SKIRT: land from the site's own edge out to the layer's skyline, in bands of its own colours — the near
      // ones the meadow's grass, the far ones the layer's
      const pt = (kk, t) => { const e = edge((2 * Math.PI * kk) / n), r = at(kk, sky(kk)); return [mix(e[0], r[0], t), mix(e[1], r[1], t), mix(e[2], r[2], Math.pow(t, 1.6))]; };
      L.skirt.forEach((band, bi) => {
        const t0 = bi / L.skirt.length, t1 = (bi + 1) / L.skirt.length, cs = [pt(k, t0), pt(k + 1, t0), pt(k + 1, t1), pt(k, t1)].map(P);
        const up = facetN(cs, [0, 0, 1]), grass = band.ramp === 'grass';
        // (under snow over the skirt's line: its bands the snow's, hazed as they run out to the ridge)
        const white = snow && (snow.line === null || mean(cs)[2] - snow.base > snow.line);
        out.push({ corners: cs, normal: up, outNormal: up, ...(white ? { fill: hexOf(st.palette['snow-far'][Math.min(st.palette.far.length - 1, Math.floor(t0 * 2))]), _ramp: 'snow-far' } : { fill: hexOf(st.palette[band.ramp][band.stop]) }), group: grass ? 'isekai:ground' : 'isekai:ridge', doubleSided: true });
      });
    }
    // CLUMPS of trees out on the skirt (the background's few chosen things): a few crowns each, every facet one of
    // two foliage stops by whether it turns to the sun
    if (L.skirt && L.clumps) {
      const Cl = L.clumps, fol = st.palette.foliage, bareWoods = st.trees?.season === 'bare' && st.palette.bark, pt = (kk, t) => { const e = edge((2 * Math.PI * kk) / n), r = at(kk, sky(kk)); return [mix(e[0], r[0], t), mix(e[1], r[1], t), mix(e[2], r[2], Math.pow(t, 1.6))]; };
      for (let ci = 0; ci < Cl.n; ci++) {
        const h = (q) => hash3(ci, q, 1409 + li), k0 = n * (ci + 0.7 * (h(1) - 0.5)) / Cl.n, m = Cl.trees[0] + Math.floor(h(2) * (Cl.trees[1] - Cl.trees[0] + 1));
        for (let ti = 0; ti < m; ti++) {
          const kk = k0 + (h(10 + ti) - 0.5) * Cl.spread, t = mix(Cl.band[0], Cl.band[1], h(30 + ti)), foot = pt(kk, t), r = mix(Cl.size[0], Cl.size[1], h(50 + ti));
          for (const b of [[0, 0, 1.1], [0.45, 0.2, 0.75], [-0.4, -0.25, 0.8]]) for (const tri of blobTris([foot[0] + b[0] * r, foot[1] + b[1] * r, foot[2] + r * 0.45 * b[2]], [r * b[2] * 0.6, r * b[2] * 0.6, r * b[2] * 0.5], null)) {
            const cs = tri.p.map(P), nn = facetN(cs, [cs[0][0] - foot[0], cs[0][1] - foot[1], cs[0][2] - foot[2] - r * 0.6]);
            // (in a bare season the far woods are their wood, the bark's stops: a grey-brown haze of limbs)
            out.push({ corners: cs, normal: nn, outNormal: nn, ...(bareWoods ? { fill: hexOf(st.palette.bark[Math.min(st.palette.bark.length - 1, (dot(nn, dir) > 0.2 ? Cl.stops[1] : Cl.stops[0]) + 1)]), _ramp: 'bark' } : { fill: hexOf(fol[dot(nn, dir) > 0.2 ? Cl.stops[1] : Cl.stops[0]]) }), group: 'isekai:crown' });
          }
        }
      }
    }
  });
  return out;
}

/** The page's footprint bed on the snow (scene/channels/snow-prints.js): the ground's grid and per cell its mask (bit 0
 *  snow, bit 1 the sun reaches it), the fresh-snow ground (materials/soft-ground.js), a foot's sink as deep as the snow
 *  lets it, and the snow's lit and shaded colours as the land baked it (the mean of its level faces in the sun and out
 *  of it; the albedo under the light without them). */
function snowPrintsConfig(st, site, zG, SN, SF, shadow, dir, faces) {
  const g = site.grid, nx = g.nx, ny = g.ny, x0 = gridX(g, 0), y0 = gridY(g, 0), dx = gridX(g, 1) - x0, m = new Uint8Array((nx - 1) * (ny - 1));
  for (let j = 0; j + 1 < ny; j++) for (let i = 0; i + 1 < nx; i++) {
    const a = zG[j * nx + i], b = zG[j * nx + i + 1], c = zG[(j + 1) * nx + i], d = zG[(j + 1) * nx + i + 1], z = (a + b + c + d) / 4;
    const gx = (b + d - a - c) / (2 * dx), gy = (c + d - a - b) / (2 * dx), l = Math.hypot(gx, gy, 1), x = x0 + (i + 0.5) * dx, y = y0 + (j + 0.5) * dx;
    m[j * (nx - 1) + i] = (SF(x, y, z, [-gx / l, -gy / l, 1 / l]) > 0 ? 1 : 0) | (shadow([x, y, z + 0.05], [0, 0, 1]) > 0 ? 2 : 0);
  }
  const A = snowAlbedo(st.palette.snow), amb = hexRgb(st.light.ambient).map((v) => v * st.light.fill), K = hexRgb(st.light.key.color), E = st.ground?.exposure ?? 1, up = Math.max(0, dir[2]);
  const sum = [[0, 0, 0, 0], [0, 0, 0, 0]];
  for (const f of faces) if (f.group === 'isekai:snow' && f.normal[2] > 0.9) { const c = mean(f.corners), q = sum[shadow([c[0], c[1], c[2] + 0.05], [0, 0, 1]) > 0 ? 0 : 1], h = hexRgb(f.fill); for (let k = 0; k < 3; k++) q[k] += h[k]; q[3]++; }
  const meanOf = (q, or) => (q[3] ? q.slice(0, 3).map((v) => v / q[3]) : or);
  const r4 = (v) => Math.round(v * 1e4) / 1e4, G = SOFT_GROUNDS['fresh-snow'], depth = r4(Math.max(0.03, Math.min(0.4, SN.depth)));
  return { cols: 200, rows: 200, cell: 0.04, quantum: 0.002, depth, ground: { friction: G.friction, staticFriction: G.staticFriction, cohesion: G.cohesion, compaction: G.compaction, spill: G.spill, viscosity: G.viscosity },
    sink: r4(Math.min(G.sink, depth * 0.8)), stride: 0.38, foot: { offset: 0.11, length: 0.28, width: 0.11, rim: 0.03 }, pull: 0.25, sun: dir.map(r5),
    lit: meanOf(sum[0], A.map((v, k) => Math.min(1, v * (amb[k] + K[k] * st.light.sunGain * up) * E))).map(r4), shade: meanOf(sum[1], A.map((v, k) => Math.min(1, v * amb[k] * E))).map(r4),
    grid: { x0: r5(x0), y0: r5(y0), cell: r5(dx), nx, ny, z: b64(Float32Array.from(zG)), m: b64(m) } };
}
/** Where a far ridge's snow begins round its ring (column `k` of `n`): over the snow's line, or over the ridge's lower
 *  third without one, wandering down the gullies by a ridged noise. */
function snowCapLine(snow, L, k, n, li) {
  const a = (2 * Math.PI * k) / n, q = vnoise(Math.cos(a) * L.peaks * 3 + 4, Math.sin(a) * L.peaks * 3 + li * 5, (snow.seed | 0) + 1831), [h0, h1] = L.height;
  const line = snow.line === null ? h0 + (h1 - h0) * 0.3 : Math.max(h0, snow.base + snow.line);
  return line - (h1 - h0) * 0.25 * q * q;
}
const WALK_EYE = 1.7;
// the material pole's grass: the root `ao` (its colour × this at the ground), the sun's `back` light through a blade seen
// against it, the `dry` share of tufts gone to straw at the tips
// the wildflowers' defaults: a card's `live.flowers`, then a recipe's `grass.flowers`, over these
const FLOWERS_DEFAULT = Object.freeze({ size: 1, lift: 1, share: 0.12, mix: Object.freeze({ daisy: 3, buttercup: 2, clover: 2, lupine: 1, poppy: 1 }), variants: 2 });
const REAL_GRASS = Object.freeze({ ao: 0.45, back: 0.7, dry: 0.22 });
/** A gritty land's live grass (`grit` from GRIT_PIXELS): the material light, its contrast the grit's, the roots darker
 *  (`ao` from 0.6 to 0.3) and the light through the blades stronger (`back` from 0.6 to 1) as the grit rises; no dry
 *  tips (a hue the cube's ramps do not hold). A quiet land's grass as it was. */
function grittyGrass(LG, grit, st) {
  if (!LG || !grit) return LG;
  const t = Math.max(0, Math.min(1, (grit - GRIT_PIXELS) / (1 - GRIT_PIXELS)));
  return { ...LG, real: { ...(LG.real ?? {}), ao: r5(0.6 - 0.3 * t), back: r5(0.6 + 0.4 * t), dry: 0, sun: sunDir(st.light.key.elevation, st.light.key.azimuth).map(r5), sunColor: hexRgb(st.light.key.color).map((v) => Math.round(v * 255)) },
    // (its crowns are chipped: the core and the chips sway with the wood)
    ...(LG.crowns ? { crowns: { ...LG.crowns, groups: [...LG.crowns.groups, CORE_GROUP, CHIP_GROUP, ...(st.thickets ? [SOFT_BRUSH.core, SOFT_BRUSH.chips] : [])] } } : {}) };
}
const GRASS_KEYS = ['look', 'contact', 'density', 'height', 'flowers', 'far'];
/**
 * `grass` on an isekai stage: the live field's own dials, beside `wind` (and standing it in the default wind without one).
 * { look?: 'banded' | 'material' (default the kit's pole), contact?: true | false | { body?, press?, recover?, wave?,
 * land? } (vegetation/grass-contact.js), density? (tufts a square metre), height?: [lo, hi] (metres) } → error strings.
 */
export function validateIsekaiGrass(g) {
  if (g === undefined || g === null || g === true) return [];
  if (typeof g !== 'object' || Array.isArray(g) || Object.keys(g).some((k) => !GRASS_KEYS.includes(k))) return ['grass must be true or { look?, contact?, density?, height? }'];
  const e = [];
  if (g.look !== undefined && !['banded', 'material'].includes(g.look)) e.push("grass.look must be 'banded' (the ramp's stops, locked) or 'material' (a material under light)");
  if (g.far !== undefined && typeof g.far !== 'boolean') e.push('grass.far must be true or false (the far grass past the field: the card\'s, or none)');
  if (g.density !== undefined && !(Number.isFinite(g.density) && g.density >= 0.5 && g.density <= 12)) e.push('grass.density must be 0.5–12 (tufts a square metre)');
  if (g.height !== undefined && !(Array.isArray(g.height) && g.height.length === 2 && g.height.every((v) => Number.isFinite(v) && v >= 0.1 && v <= 2.5) && g.height[0] <= g.height[1])) e.push('grass.height must be [lo, hi], 0.1–2.5 m, lo ≤ hi');
  const F = g.flowers;
  if (F !== undefined && F !== true && F !== false) {
    if (!F || typeof F !== 'object' || Array.isArray(F) || Object.keys(F).some((k) => !['share', 'mix'].includes(k))) e.push('grass.flowers must be true, false or { share?, mix? }');
    else {
      if (F.share !== undefined && !(Number.isFinite(F.share) && F.share >= 0 && F.share <= 1)) e.push('grass.flowers.share must be 0–1 (the share of tufts in flower)');
      if (F.mix !== undefined && (!F.mix || typeof F.mix !== 'object' || Array.isArray(F.mix) || Object.entries(F.mix).some(([k, v]) => !WILDFLOWER_KINDS.includes(k) || !(Number.isFinite(v) && v >= 0)) || !Object.values(F.mix).some((v) => v > 0))) e.push(`grass.flowers.mix must weigh some of ${WILDFLOWER_KINDS.join(', ')} (numbers ≥ 0, one over 0)`);
    }
  }
  return [...e, ...validateGrassContact(g.contact)];
}

/**
 * The WILDFLOWERS in the live grass (scene/channels/stage-grass.js): a `share` of the tufts carries the flowers of a kind
 * drawn by its weight in `mix` (vegetation/wildflowers.js). The flowers' ramp is the grass's stops, then each ramp a
 * petal or an eye takes in the kit's palette; a part's window is the ramp's upper stops in the sun, its lower in shade.
 */
function flowerConfig(st, F, seed) {
  const ramp = [...st.palette.grass], at = new Map();
  const win = (name) => {
    if (!at.has(name)) { at.set(name, ramp.length); ramp.push(...st.palette[name]); }
    const a = at.get(name), n = st.palette[name].length; return { lit: [a + 1, a + n - 1], shade: [a, a + n - 2] };
  };
  const templates = [], kinds = [];
  for (const [kind, weight] of Object.entries(F.mix)) {
    const petal = flowerRamp(kind, 'petal', st.palette); if (!(weight > 0) || !petal) continue;
    const eye = flowerRamp(kind, 'eye', st.palette) ?? petal, variants = [];
    for (let v = 0; v < (F.variants ?? 2); v++) {
      const lad = wildflowerLadder(kind, { seed: seed * 13 + 101 * v + kind.length, size: F.size, lift: F.lift }), ids = {};
      for (const lv of ['L2', 'L1', 'L0']) {
        const P = lad[lv].flatMap((t) => t.p.flat()), plo = [0, 1, 2].map((k) => Math.min(...P.filter((_, i) => i % 3 === k))), phi = [0, 1, 2].map((k) => Math.max(...P.filter((_, i) => i % 3 === k)));
        const sc = plo.map((l, k) => Math.max(1e-9, (phi[k] - l) / 65535));
        templates.push({ lo: plo.map(r5), sc, q: b64(Int16Array.from(P, (x, i) => Math.round((x - plo[i % 3]) / sc[i % 3]) - 32768)),
          seg: b64(Uint8Array.from(lad[lv].flatMap((t) => [0, 1, 2].map(() => ({ stem: 0, petal: 1, eye: 2 })[t.part])))), v: b64(Uint8Array.from(lad[lv].flatMap((t) => t.v.map((x) => Math.round(x * 255))))), tris: lad[lv].length });
        ids[lv] = templates.length - 1;
      }
      variants.push(ids);
    }
    kinds.push({ kind, weight, petal: win(petal), eye: win(eye), variants });
  }
  return kinds.length ? { share: F.share, ramp, kinds, templates } : null;
}

const b64 = (a) => ({ __b64: Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64'), t: a.constructor.name });
/** A polygon land drawn by its FORMATION (era/substrate.js: the turn its rock's `skin` names): { to ('sand' |
 *  'bedrock'), group (what a turned face is drawn as: `isekai:sand`, `isekai:pavement`), at (a test on a point's (x, y):
 *  turned), bare (turned, or the talus: no grass), cut (a ground face → its turf, its talus and its turned ground, each
 *  line drawn through the cells where its field crosses), cells (the turned cells' centres), cell (m) }; null without
 *  one. */
const TURNED = Object.freeze({ sand: 'isekai:sand', bedrock: 'isekai:pavement' });
// the lying ground snow settles on (era/snow.js), cut where its field crosses
/** The flora under snow: a leaf turned up past the depth's `capOf`, its share of them (hashed), where the snow lies on
 *  the ground beneath (`snowy`), drawn in the snow's stops by how lit the leaf is against the foliage's lightest, so a
 *  leaf in shade or at night takes a darker snow. */
function snowOnFlora(faces, st, SN, snowy) {
  // (the flora snow settles on: a crown's faces, its core and chips, the bushes', the shrubs' and the arrangements')
  // (and the wood's: a limb's top, turned further up, takes it too)
  const SNOW_FLORA = new Set(['isekai:crown', CORE_GROUP, CHIP_GROUP, SOFT_BRUSH.core, SOFT_BRUSH.chips, SHRUB_GROUP, SOFT_GROUP, SOLID_GROUP]), WOOD = new Set(['isekai:wood', SOFT_BRUSH.wood]);
  const R = st.palette.snow, n = R.length, cap = capOf(SN), lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], topOf = (r) => Math.max(1, lum(r[r.length - 1]));
  const leafTop = topOf(st.palette.foliage), woodTop = topOf(st.palette.bark ?? st.palette.foliage);
  // (a leaf's light against its ramp's lightest, the snow's stop as far up its own)
  const white = (hex, top) => { const t = Math.min(1, (lum(hexRgb(hex)) * 255) / top); return rgbHex(R[Math.max(0, Math.min(n - 1, Math.round((0.35 + 0.65 * t) * (n - 1))))].map((v) => v / 255)); };
  return faces.map((f) => {
    const wood = WOOD.has(f.group);
    if (!(SNOW_FLORA.has(f.group) || wood) || f.texture || !f.fill || !f.normal || !(f.normal[2] > (wood ? Math.max(0.6, cap.up) : cap.up))) return f;
    const c = mean(f.corners);
    if (hash3(Math.round(c[0] * 23), Math.round(c[1] * 23) + Math.round(c[2] * 23) * 131, 1847) >= cap.share || !snowy(c)) return f;
    const top = wood ? woodTop : leafTop;
    return { ...f, fill: white(f.fill, top), ...(f.cornerFills ? { cornerFills: f.cornerFills.map((h) => white(h, top)) } : {}) };
  });
}
const LYING = new Set(['isekai:ground', 'isekai:scree', 'isekai:sand', 'isekai:pavement', 'isekai:talus', 'isekai:rubble']);
/** A ground face under the snow: lying ground cut through where the field crosses, a cliff's facet level enough to hold
 *  it taken whole (it leaves the rock: baked as the ground is). */
function snowOn(f, SF) {
  if (f.cel === 'cliff') {
    if (!(f.normal[2] > 0.5) || !(SF(...mean(f.corners), f.normal) > 0)) return [f];
    const { cel: _c, celN: _n, size: _s, uv: _u, key: _k, ...rest } = f;
    return [{ ...rest, group: 'isekai:snow' }];
  }
  if (f.cel || !LYING.has(f.group)) return [f];
  return cutFace(f, f.corners.map((c) => SF(c[0], c[1], c[2], f.normal)), 'isekai:snow');
}
// THE TALUS'S EDGE on a gritty land: within `reach` metres either side of the apron's line its stones thin out, the turf
// showing through — the ground there turf, a cutout of the scree's own tile over it (era/scree-tiles.js) in bands
// between `lines` (signed metres from the line, + into the talus) at `levels` (the share of the stones kept); past the
// first line the talus whole. Its COARSE patches (`isekai:rubble`): where a slow field passes `coarse`
export const TALUS_EDGE = Object.freeze({ reach: 1, lines: Object.freeze([0.7, 0.5, 0.33, 0.19, 0.07, -0.06, -0.2, -0.38, -0.6]),
  levels: Object.freeze([0.85, 0.7, 0.56, 0.44, 0.32, 0.21, 0.12, 0.06]), coarse: 0.62, coarseScale: 4.5 });
/** The talus's signed distance (m, + inside) from the line where its apron passes the land's: found at the grid's nodes
 *  (to the nearest crossing on any grid edge, out to `reach`), read between them bilinearly. */
function talusDistance(g, amin, reach) {
  const nx = g.nx, ny = g.ny, x0 = gridX(g, 0), y0 = gridY(g, 0), dx = gridX(g, 1) - x0, dy = gridY(g, 1) - y0, v = (i, j) => g.apron[j * nx + i] - amin;
  const B = new Map(), key = (x, y) => `${Math.floor(x / reach)},${Math.floor(y / reach)}`, put = (x, y) => { const k = key(x, y); if (!B.has(k)) B.set(k, []); B.get(k).push([x, y]); };
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    if (i + 1 < nx && v(i, j) > 0 !== v(i + 1, j) > 0) { const t = v(i, j) / (v(i, j) - v(i + 1, j)); put(x0 + (i + t) * dx, y0 + j * dy); }
    if (j + 1 < ny && v(i, j) > 0 !== v(i, j + 1) > 0) { const t = v(i, j) / (v(i, j) - v(i, j + 1)); put(x0 + i * dx, y0 + (j + t) * dy); }
  }
  const sd = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + i * dx, y = y0 + j * dy, bi = Math.floor(x / reach), bj = Math.floor(y / reach);
    let d = reach;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const q of B.get(`${bi + a},${bj + b}`) ?? []) d = Math.min(d, Math.hypot(q[0] - x, q[1] - y));
    sd[j * nx + i] = v(i, j) > 0 ? d : -d;
  }
  return (x, y) => {
    const u = Math.max(0, Math.min(nx - 1.001, (x - x0) / dx)), w = Math.max(0, Math.min(ny - 1.001, (y - y0) / dy)), i = Math.floor(u), j = Math.floor(w), fu = u - i, fw = w - j;
    const a = sd[j * nx + i] + (sd[j * nx + i + 1] - sd[j * nx + i]) * fu, b = sd[(j + 1) * nx + i] + (sd[(j + 1) * nx + i + 1] - sd[(j + 1) * nx + i]) * fu;
    return a + (b - a) * fw;
  };
}
export function formationGround(st, site, SH, seed, grit = 0) {
  const skin = typeof SH.skin === 'string' && FORMATION_TURNS[SH.skin] ? SH.skin : null;
  if (!skin) return null;
  const to = FORMATION_TURNS[skin].to, group = TURNED[to], M = substrateMap(st, site, { formation: skin, seed }), S = SUBSTRATE_IDS.indexOf(to), field = turnField(skin, seed);
  const g = site.grid, gx0 = gridX(g, 0), gy0 = gridY(g, 0), dx = gridX(g, 1) - gx0, amin = st.landform.apronMin, E = TALUS_EDGE;
  const turnable = (p) => {
    const i = Math.floor((p[0] - M.x0) / M.cell), j = Math.floor((p[1] - M.y0) / M.cell);
    return i >= 0 && j >= 0 && i < M.nx && j < M.ny && M.turnable[j * M.nx + i] === 1;
  };
  const at = (p) => turnable(p) && field(p[0], p[1]) > 0;
  // (the talus apron at a grid node, a ground face's corners being the grid's)
  const apron = (c) => { const i = Math.round((c[0] - gx0) / dx), j = Math.round((c[1] - gy0) / dx); return g.apron[Math.max(0, Math.min(g.ny - 1, j)) * g.nx + Math.max(0, Math.min(g.nx - 1, i))]; };
  const sd = grit ? talusDistance(g, amin, E.reach) : null, coarse = (c) => vnoise(c[0] / E.coarseScale, c[1] / E.coarseScale, seed + 1621) - E.coarse;
  // the talus: quiet, where its apron passes the land's; gritty, past the edge's first line, its stones thinning across
  // the bands to the last, a band's turf carrying its `screeLevel`; and its coarse patches
  const talusOf = (f) => {
    if (!sd) return cutFace(f, f.corners.map((c) => apron(c) - amin), 'isekai:talus');
    const out = [];
    let rest = [f];
    E.lines.forEach((t, k) => {
      const next = [];
      for (const q of rest) for (const r of cutFace(q, q.corners.map((c) => sd(c[0], c[1]) - t), 'past')) {
        if (r.group !== 'past') next.push(r);
        else if (k === 0) out.push(...cutFace({ ...r, group: 'isekai:talus' }, r.corners.map(coarse), 'isekai:rubble'));
        else out.push({ ...r, group: 'isekai:ground', screeLevel: E.levels[k - 1] });
      }
      rest = next;
    });
    return [...out, ...rest];
  };
  const cut = (f) => {
    if (f.group !== 'isekai:ground' && f.group !== 'isekai:scree') return [f];
    // the talus, then the turn on what is left of a turnable cell (not under the talus's edge)
    return talusOf({ ...f, group: 'isekai:ground', tint: st.tint.ground }).flatMap((q) => (q.group === 'isekai:ground' && q.screeLevel === undefined && turnable(mean(f.corners)) ? cutFace(q, q.corners.map((c) => field(c[0], c[1])), group) : [q]));
  };
  const cells = [];
  for (let k = 0; k < M.cells.length; k++) if (M.cells[k] === S) cells.push([M.x0 + (k % M.nx + 0.5) * M.cell, M.y0 + (Math.floor(k / M.nx) + 0.5) * M.cell]);
  return { skin, to, group, at, bare: (p) => at(p) || (sd ? sd(p[0], p[1]) > 0 : site.apronAt(p[0], p[1]) > amin), talus: (p) => (sd ? sd(p[0], p[1]) > 0 : site.apronAt(p[0], p[1]) > amin), cut, cells, cell: M.cell };
}
// a formation's grounds: the sand in its own ramp (the soil's without one), the pavement the rock's, the talus the rock's
// leaned a third to the soil
const FORMATION_TINTS = (st, mid) => ({ 'isekai:sand': mid(st.palette.sand ?? st.palette.soil), 'isekai:pavement': mid(st.palette.rock),
  'isekai:talus': mid(st.palette.rock).map((v, k) => v + (mid(st.palette.soil)[k] - v) / 3),
  'isekai:rubble': mid(st.palette.rock).map((v, k) => (v + (mid(st.palette.soil)[k] - v) / 4) * 0.94) });
/** The live grass kept off the sand: its mask's cells there cleared (the same landform cells). */
function offSand(LG, onSand) {
  if (!LG || !onSand) return LG;
  const g = LG.grid, m = Uint8Array.from(Buffer.from(g.m.__b64, 'base64')), w = g.nx - 1;
  for (let k = 0; k < m.length; k++) if (m[k] && onSand([g.x0 + (k % w + 0.5) * g.cell, g.y0 + (Math.floor(k / w) + 0.5) * g.cell])) m[k] = 0;
  return { ...LG, grid: { ...g, m: b64(m) } };
}
/**
 * The LIVE GRASS the World page stands round the walker with `wind` (scene/channels/stage-grass.js): the ground as the
 * landform grid's heights, and per cell a mask — bit 0: grass may stand (not the cliff, the scree apron, the trail's
 * packed ribbon, a rock's footprint or a trunk); bit 1: the sun reaches it — the stylized meadow's grown tufts (positions
 * only: the colour is the ramp's, by height), the grass ramp and its lit and shade windows, the wind and its grass taker,
 * and the crowns that sway.
 */
export function liveGrassConfig(st, site, rocks, trees, shadow, wind, seed = 1, grass = undefined) {
  const errs = validateIsekaiGrass(grass); if (errs.length) throw new Error(`isekai: ${errs.join('; ')}`);
  const G = grass && grass !== true ? grass : {}, L = st.live, g = site.grid, nx = g.nx, ny = g.ny, x0 = gridX(g, 0), y0 = gridY(g, 0), cell = gridX(g, 1) - x0;
  let lo = Infinity, hi = -Infinity; for (const z of g.z) { lo = Math.min(lo, z); hi = Math.max(hi, z); }
  const zsc = Math.max(1e-6, (hi - lo) / 65535), zq = Int16Array.from(g.z, (z) => Math.round((z - lo) / zsc) - 32768);
  const m = new Uint8Array((nx - 1) * (ny - 1)), node = (i, j) => [gridX(g, i), gridY(g, j), g.z[j * nx + i]];
  for (let j = 0; j + 1 < ny; j++) for (let i = 0; i + 1 < nx; i++) {
    const cs = [node(i, j), node(i + 1, j), node(i + 1, j + 1), node(i, j + 1)], c = mean(cs), n = facet(cs, [0, 0, 1]);
    if (c[0] > site.W || n[2] < st.slope.rock) continue;
    if ((g.apron[j * nx + i] + g.apron[(j + 1) * nx + i + 1]) / 2 > st.landform.apronMin) continue;
    // (a cell's tufts stand anywhere in it: the whole cell clear of the trail, its half-diagonal past the edge)
    if (site.trailDist(c[0], c[1]) < site.halfWAt(c[1]) + 0.1 + cell * 0.71) continue;
    if (rocks.some((r) => r.role !== 'pebble' && Math.hypot(r.x - c[0], r.y - c[1]) < r.size * st.rubble.unit * 0.5 + 0.15)) continue;
    if (trees.some((t) => Math.hypot(t.x - c[0], t.y - c[1]) < (t.clearR ?? 0.45))) continue;
    if (site.reserved && !kept(site.reserved, c[0], c[1], 0.3)) continue;
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
  const W = windPageChannel(spec, { grassKinds: [L.kind] }), T = st.tiles.blades, contact = resolveGrassContact(G.contact, L.contact);
  // opt-in: a recipe asks (`grass.flowers`), the card's `live.flowers` its defaults
  const fl = !G.flowers ? null : flowerConfig(st, { ...FLOWERS_DEFAULT, ...(L.flowers || {}), ...(G.flowers && G.flowers !== true ? G.flowers : {}) }, seed);
  return {
    grid: { x0: r5(x0), y0: r5(y0), cell: r5(cell), nx, ny, zlo: r5(lo), zsc, z: b64(zq), m: b64(m) },
    ramp: st.palette.grass, win: hourWin(L.win || { lit: [T.lit[0], T.lit[T.lit.length - 1]], shade: [T.shade[0], T.shade[T.shade.length - 1]] }, hourShift(st, st.tint.ground, st.palette.grass)),
    templates, variants, size: 1.2, radius: L.radius, near: L.near, tile: L.tile, density: G.density ?? L.density, height: G.height ?? L.height, px: L.px, drawTris: L.drawTris, seed: seed | 0,
    sheen: L.sheen, taker: W.grass[0],
    // CONTACT: what walks, lands or strikes in the grass lays it (vegetation/grass-contact.js); `contact: false` ⇒ none
    ...(contact ? { contact: { ...contact, eye: WALK_EYE } } : {}),
    // WILDFLOWERS on a share of the tufts, riding their tufts (`grass.flowers: false` ⇒ none)
    ...(fl ? { flowers: fl } : {}),
    // the FAR grass (the card's `live.far`): the meadow out past the field in clumps of its own, wider and sparser, that
    // stand where the field has thinned and give way to it as it fills in (stage-grass.js); `grass.far: false` ⇒ none
    ...(L.far && G.far !== false ? { far: { density: L.far.density, width: L.far.width } } : {}),
    // the MATERIAL pole draws the grass as a material under light: by the look's pole unless the recipe says
    ...((G.look ?? poleOf(st)) === 'material' ? { real: { ...REAL_GRASS, ...(L.real || {}), sun: sunDir(st.light.key.elevation, st.light.key.azimuth).map(r5), sunColor: hexRgb(st.light.key.color).map((v) => Math.round(v * 255)) } } : {}),
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
// a gritty land's cloud: the main card and two smaller ones set behind it and to a side, one mirrored, so the heap has
// depth and shifts as the eye moves: [behind m, aside × width, up × height, size, mirrored]
const HEAP = Object.freeze([[0, 0, 0, 1, false], [14, -0.28, 0.12, 0.72, true], [26, 0.3, 0.2, 0.6, false]]);
export function cumulusFaces(st, site, dir, heap = false) {
  const out = [], c = [site.W / 2, site.D / 2], Cu = st.cumulus, sunAz = Math.atan2(dir[1], dir[0]);
  Cu.tiers.forEach((T, ti) => {
    for (let i = 0; i < T.n; i++) {
      const h = (k) => hash3(i, k, 1301 + ti * 17);
      const az = (2 * Math.PI * (i + 0.6 * (h(1) - 0.5))) / T.n, R = mix(T.at[0], T.at[1], h(2)), z = mix(T.base[0], T.base[1], h(3));
      const w = mix(T.width[0], T.width[1], h(4)), ht = w * T.tall, p = [c[0] + Math.cos(az) * R, c[1] + Math.sin(az) * R, z];
      const along = [-Math.sin(az), Math.cos(az), 0], n = [-Math.cos(az), -Math.sin(az), 0].map(r5);
      const d = Math.abs(((az - sunAz + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) * 180 / Math.PI, isLit = d > Cu.towardSun;
      for (const [back, side, up, size, flip] of heap ? HEAP : HEAP.slice(0, 1)) {
        const q = [p[0] - n[0] * back + along[0] * side * w, p[1] - n[1] * back + along[1] * side * w, p[2] + up * ht], a = mul(along, (w * size) / 2), hh = ht * size;
        out.push({ corners: [sub(q, a), addv(q, a), addv(addv(q, a), [0, 0, hh]), addv(sub(q, a), [0, 0, hh])].map(P), normal: n, outNormal: n, uv: flip ? [[1, 0], [0, 0], [0, 1], [1, 1]] : [[0, 0], [1, 0], [1, 1], [0, 1]], texture: isekaiKeyOf(st, 'cumulus', isLit), fill: stopFill(st, 'cumulus', isLit), group: 'isekai:cloud', doubleSided: true });
      }
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
// a gritty crown's lobes: each mass three overlapping lobes about its middle (a little out from the crown's),
// every vertex pushed by a lumpy noise, and a face's tint darkened by how deep in the crown it lies (the dark core)
// a bush's middle and reach, from its faces (each carries its bush's id, `node`): a crown's mass for the leaf cards
function bushMasses(faces) {
  const by = new Map();
  for (const f of faces) { const b = by.get(f.node) ?? { pts: [] }; for (const c of f.corners) b.pts.push(c); by.set(f.node, b); }
  return [...by.values()].map(({ pts }) => {
    const c = mean(pts), r = Math.max(...pts.map((q) => Math.hypot(q[0] - c[0], q[1] - c[1], q[2] - c[2])));
    return { node: null, at: c, masses: [{ at: c.map(r5), r: r5(r * 0.75), squash: 0.85 }] };
  }).map((b, i) => ({ ...b, node: [...by.keys()][i] }));
}
// a bush's faces lumped about its middle as a crown's lobes are (more with grit), their normals taken again
function lumpBushes(faces, bushes, grit) {
  const t = Math.max(0, Math.min(1, (grit - GRIT_PIXELS) / (1 - GRIT_PIXELS))), lump = 0.14 + 0.16 * t, at = new Map(bushes.map((b) => [b.node, b]));
  return faces.map((f) => {
    const b = at.get(f.node); if (!b) return f;
    const c = b.at, R = b.masses[0].r || 1;
    const cs = f.corners.map((v) => { const q = 1 + lump * (2 * vnoise(v[0] / (0.3 * R), v[1] / (0.3 * R) + v[2] / (0.3 * R), 1321) - 1); return P([c[0] + (v[0] - c[0]) * q, c[1] + (v[1] - c[1]) * q, c[2] + (v[2] - c[2]) * q]); });
    return { ...f, corners: cs, normal: facetN(cs.length === 3 ? cs : cs.slice(0, 3), sub(mean(cs), c)) };
  });
}
/**
 * THE TREES BANDED by the trail (a card's `trees.bands`: true, or { hero, far, stock }): every tree in one band by how
 * far it stands from the trail's edge — HERO within `hero` m (and the named hero) built whole; STOCK to `far` m stamped
 * from `stock` templates, one a variant, each a tree built off the map through the same light, lock and detail as the
 * rest and lifted out as the page's instanced repeats (light baked, so never turned: variety is the variant, the
 * height its scale, the shade a tint); FAR past it a shell (treeFaces `band: 'far'`). → { built (hero and far), stock,
 * phantoms (the templates' trees), isPhantom(face), repeats(templateFaces, sunAt) } | null without bands.
 */
export const TREE_BANDS = Object.freeze({ hero: 6, far: 15, stock: 3, shade: 0.62, off: -4000, gap: 80, vary: 0.1 });
// a walked-through bush's faces into the page's soft groups (thickets.js SOFT_BRUSH), the mark leaving with it
const softBrush = (f) => { if (f._soft === undefined) return f; const { _soft, ...g } = f; return { ...g, group: g.group === 'isekai:wood' ? SOFT_BRUSH.wood : g.group === CHIP_GROUP ? SOFT_BRUSH.chips : SOFT_BRUSH.core }; };
// a tree's kind on a gritty land (the biocube's `kinds`, era/leaf-forms.js): each clump one of them, by its dice; none
// where the land is quiet or the level names none (its crown the balls)
// (a clump's role takes the kind its cast names, `clump`; else each clump one kind by its dice, weighed by the kinds'
// shares when they name any)
const kindIx = (T, t, grit) => {
  if (!grit || !T.leafKinds) return -1;
  if (t.kindIx !== undefined) return t.kindIx;
  if (T.leafClump && t.role && T.leafClump[t.role] !== undefined) return T.leafClump[t.role];
  return pickByShare(T.leafKinds, hash3(t.cluster ?? 0, 13, 4127));
};
const treeKind = (T, t, grit) => { const i = kindIx(T, t, grit); return i < 0 ? null : readKind(T.leafKinds[i]); };
// the ramp a tree's crown is locked to: its role's in the clump's harmony, else the kind's pick from the offer, else the
// world's (null)
const leafKey = (T, t, K) => (t.leafKey !== undefined ? t.leafKey : T.leafHarmony && t.role ? `role-${t.role}` : K && K.leaf ? `foliage-${K.leaf}` : null);
function treeBands(st, site, trees, grit = 0) {
  const T = st.trees, B0 = T.bands;
  if (!B0) return null;
  const B = { ...TREE_BANDS, ...(B0 === true ? {} : B0) }, h0 = (T.heights[0] + T.heights[1]) / 2;
  for (const t of trees) { const d = site.trailDist(t.x, t.y) - site.halfWAt(t.y); t.band = t.hero || d < B.hero ? 'hero' : d > B.far ? 'far' : 'stock'; }
  const stock = trees.filter((t) => t.band === 'stock'), built = trees.filter((t) => t.band !== 'stock');
  // (a gritty land's kinds, treeKind: a template for each kind and variant, so a stamped tree keeps its kind; built at
  // the level's middle height, the kind's scale its own, so a stamp's scale is the tree's height against it)
  // (with kinds: a template for each kind and crown colour the stock takes, so a role's harmony stamps true)
  const n = Math.min(B.stock, T.variants ?? B.stock), combos = new Map();
  if (grit && T.leafKinds) for (const t of stock) { const ki = kindIx(T, t, grit), lk = leafKey(T, t, treeKind(T, t, grit)); combos.set(`${ki}|${lk}`, { kindIx: ki, leafKey: lk }); }
  const kinds = grit && T.leafKinds ? [...combos.values()] : [null];
  const phantoms = kinds.flatMap((ki, si) => Array.from({ length: n }, (_, v) => ({ x: B.off - B.gap * (si * n + v), y: B.off, z0: 0, h: h0, v, cluster: -2, band: 'stock', ...(ki !== null ? ki : {}) })));
  const isPhantom = (f) => f.corners[0][0] < B.off / 2;
  const repeats = (faces, sunAt) => phantoms.map((ph, v) => {
    const mine = stock.filter((t) => t.v % n === ph.v && (ph.kindIx === undefined || (kindIx(T, t, grit) === ph.kindIx && leafKey(T, t, treeKind(T, t, grit)) === ph.leafKey)));
    if (!mine.length) return null;
    const template = faces.filter((f) => Math.round((B.off - f.corners[0][0]) / B.gap) === v).map((f) => ({ ...f, corners: f.corners.map((c) => [r5(c[0] - ph.x), r5(c[1] - ph.y), c[2]]) }));
    return { template, group: `isekai:trees:${v}`, transforms: mine.map((t) => {
      const z = site.ground(t.x, t.y) - 0.15, lit = sunAt([t.x, t.y, z + t.h * (T.crown?.height ?? 0.62) + 0.5]);
      // (a kind's stamp a little darker or not, by its own dice: no two stamped trees the same value; B.vary)
      const vr = ph.kindIx !== undefined ? 1 - B.vary * hash3(Math.round(t.x * 100), Math.round(t.y * 100), 4157) : 1, sh = lit < 1 ? B.shade + (1 - B.shade) * lit : 1;
      return { pos: [t.x, t.y, r5(z)], scale: r5(t.h / h0), ...(lit < 1 || vr < 1 ? { tint: [0, 1, 2].map(() => r5(sh * vr)) } : {}) };
    }) };
  }).filter(Boolean);
  return { built, stock, phantoms, isPhantom, repeats };
}
function treeFaces(st, site, trees, grit = 0) {
  const T = st.trees, C = T.crown, out = [], lobesAll = [], blossom = T.form === 'blossom', crownGroup = blossom ? 'isekai:blossom' : 'isekai:crown', crownTint = blossom ? st.tint.blossom : st.tint.crown;
  trees.forEach((t, ti) => {
    // (a stock tree's template stands at its own `z0`, off the map: era/isekai.js treeBands)
    const z0 = t.z0 ?? site.ground(t.x, t.y) - 0.15, h = t.h, k = Math.round(t.x * 17 + t.y * 5) + ti * 131;
    const Rc = C.radius * h, c = [t.x + (hash3(k, 1, 941) - 0.5) * 0.3, t.y + (hash3(k, 2, 943) - 0.5) * 0.3, z0 + C.height * h];
    // the trunk, bending a little, into the crown's heart; two limbs up into the shoulder masses
    // a sakura leans (its crown carried off to one side over a trunk that tips toward it); the meadow's stand
    const tip = blossom ? Math.tan(((C.lean || 0) * Math.PI) / 180) * h * mix(0.4, 1, hash3(k, 7, 983)) : 0, ta = 2 * Math.PI * hash3(k, 8, 991);
    if (tip) { c[0] += Math.cos(ta) * tip; c[1] += Math.sin(ta) * tip; }
    const bend = [(hash3(k, 3, 947) - 0.5) * 0.08 * h + Math.cos(ta) * tip * 0.5, (hash3(k, 4, 953) - 0.5) * 0.08 * h + Math.sin(ta) * tip * 0.5];
    // (a gritty land's tree KIND, era/leaf-forms.js: its trunk to the fork, its limbs throwing leaf branches, each
    // ending in a lobe its form shapes; the lobes the dark core, hollowed, their chips once the sun is known; far, the
    // cores coarse and no twigs. Its proportions the kind's, else the kit's; its wood and crown locked to the colours it
    // picked from the theorist's offer, era/flora-colours.js)
    // (a bush of a section, thickets.js: a tree kind with the trunk taken away, on any land; a tree's kind, gritty only)
    // (in a BARE season, a biocube's `trees.season`: the leaves fallen, a tree with no kind grown as a spray's limbs and
    // twigs; an evergreen kind keeps its leaves)
    const K = (t.bushIx !== undefined ? readBush(st.thickets.kinds[t.bushIx]) : treeKind(T, t, grit)) ?? (T.season === 'bare' && !blossom ? BARE_KIND : null);
    if (K) {
      // (a kind evergreen by its word, else by its form's: a spire keeps its crown)
      const leafless = T.season === 'bare' && !(K.evergreen ?? LEAF_FORMS[K.form]?.evergreen);
      const hk = h * (K.scale ?? 1), Rk = (K.spread ?? C.radius) * hk, far = t.band === 'far', form = K.form, g = (K.girth ?? C.trunk) * hk;
      const ck = K.scale === undefined && K.spread === undefined && K.trunk === undefined ? c : [c[0], c[1], K.trunk !== undefined ? z0 + K.trunk * hk + 0.45 * Rk : z0 + C.height * hk];
      const fork = [ck[0], ck[1], ck[2] - 0.45 * Rk], bark = grit && K.bark ? { _ramp: `bark-${K.bark}` } : {}, lk = grit ? leafKey(T, t, K) : null, leafRamp = lk ? { _ramp: lk } : {};
      // (a walked-through bush's faces marked, drawn at the end in the page's soft groups)
      const soft = t.soft ? { _soft: true } : {};
      const stem = [0, 0.35, 0.7, 1].map((f) => [t.x + bend[0] * f * f + (fork[0] - t.x) * f, t.y + bend[1] * f * f + (fork[1] - t.y) * f, z0 + (fork[2] - z0) * f]);
      // (its wood's albedo the picked bark's against the world's: the bake lights it, the lock keeps it on its ramp)
      const pb = K.bark && st.palette[bark._ramp], wb = st.palette.bark, mid = (r) => r[Math.floor(r.length / 2)];
      const wt = pb && wb ? st.tint.wood.map((v, q) => Math.min(1, (v * mid(pb)[q]) / Math.max(8, mid(wb)[q]))) : st.tint.wood, wood = [];
      // (several stems, `stems`: each from the foot, leaning out `splay` degrees on its own side to its own top, the
      // limbs shared among their tops: two a V; thinner each, as one trunk's wood is shared)
      const ns = K.stems ?? 1, forks = ns > 1 ? [] : null;
      if (ns > 1) {
        const yawS = 2 * Math.PI * hash3(k, 14, 4133), lean = Math.tan(((K.splay ?? 16) * Math.PI) / 180), rise = fork[2] - z0;
        for (let q = 0; q < ns; q++) {
          const a = yawS + (2 * Math.PI * (q + 0.2 * hash3(k, 15 + q, 4139))) / ns, ca = Math.cos(a), sa = Math.sin(a);
          const top = [ck[0] + ca * lean * rise, ck[1] + sa * lean * rise, fork[2] - rise * 0.06 * q], foot = [t.x + ca * g * 0.5, t.y + sa * g * 0.5, z0];
          const midS = [mix(foot[0], top[0], 0.45) + ca * lean * rise * 0.08, mix(foot[1], top[1], 0.45) + sa * lean * rise * 0.08, mix(z0, top[2], 0.45)];
          tube(wood, [foot, midS, top], [g * 0.78, g * 0.62, g * 0.5], 6, wt, 'isekai:wood');
          forks.push(top);
        }
      } else tube(wood, stem, [g, g * 0.85, g * 0.72, g * 0.62], 6, wt, 'isekai:wood');
      const G = leafForm(form, { base: [t.x, t.y, z0], h: hk, c: ck, Rc: Rk, seed: k, density: K.density ?? 1, forks, branch: K.branch ?? 1, split: K.split ?? 0 });
      for (const l of G.limbs) tube(wood, l.pts, l.radii, 5, wt, 'isekai:wood');
      // (a bush draws no twigs: too fine to see at its size; but leafless, the twigs are all it has)
      if (!far && (t.bushIx === undefined || leafless)) for (const tw of G.twigs) tube(wood, tw.pts, tw.radii, 4, wt, 'isekai:wood');
      // (its bark's colour, `_ramp` for the lock; its marks, `_rind` for the relief, era/gritty-flora.js)
      const rind = grit && K.barkForm && K.barkForm !== 'furrowed' ? { _rind: K.barkForm } : {};
      for (const f of wood) out.push(bark._ramp || rind._rind || t.soft ? { ...f, ...bark, ...rind, ...soft } : f);
      t.crownAt = ck.map(r5); t.crownR = r5(Rk); t.lobes = leafless ? [] : G.lobes; t.form = form; t.leafRamp = leafRamp._ramp ?? null;
      for (const L of t.lobes) {
        const lobe = { at: L.at, r: Math.max(...L.axes) * CHIP_DEFAULTS.shrink, tris: [], id: lobesAll.length };
        lobesAll.push(lobe);
        // (a far tree's lobes coarse, and a bush's always: small, and under its chips)
        for (const cs of lobeTris(L, { detail: far || t.bushIx !== undefined ? 0 : 1, shrink: CHIP_DEFAULTS.shrink })) {
          const nn = facetN(cs, sub(mean(cs), L.at));
          lobe.tris.push(cs);
          // (a quiet land's bush draws its lobes as a crown's masses, locked to the foliage: no core, no chips)
          out.push({ corners: cs, normal: nn, outNormal: nn, tint: crownTint, group: grit ? CORE_GROUP : crownGroup, ...(grit ? { _lobe: lobe.id } : {}), ...leafRamp, ...soft });
        }
      }
      return;
    }
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
    t.masses = masses.map((m) => ({ at: m.at, r: m.r, squash: C.squash }));   // (the realistic pole's leaf cards stand out of these)
    // (a FAR tree, treeBands, is its locked shape alone: each mass one coarse blob, no lobes, no leaf cards)
    const far = t.band === 'far';
    if (!grit) for (const m of masses) for (const tri of blobTris(m.at, [m.r, m.r, m.r * C.squash], null, { detail: far ? 0 : 1 })) {
      const cs = tri.p.map(P), nn = facetN(cs, sub(mean(cs), m.at));
      out.push({ corners: cs, normal: nn, outNormal: nn, tint: crownTint, group: crownGroup });
    }
    // (a gritty crown, era/leaf-chips.js: its masses the dark CORE, hollowed across the clump; the chips over it and the
    // core's colour come once the sun's shadow is known, assembleIsekaiScene)
    else for (const m of masses) {
      const r = m.r * CHIP_DEFAULTS.shrink, lobe = { at: m.at, r, tris: [], id: lobesAll.length };
      lobesAll.push(lobe);
      for (const tri of blobTris(m.at, [r, r, r * C.squash], null, { detail: 1 })) {
        const cs = tri.p.map(P), nn = facetN(cs, sub(mean(cs), m.at));
        lobe.tris.push(cs);
        out.push({ corners: cs, normal: nn, outNormal: nn, tint: crownTint, group: CORE_GROUP, _lobe: lobe.id });
      }
    }
  });
  return grit ? hollowed(out, lobesAll) : out;
}
// a gritty crown's core and its chips (era/leaf-chips.js): drawn in their own stops, never baked, textured or locked; a
// chip whose middle lies within this share of a core's radius (its own mass's or a neighbour's) is buried in it
export const CORE_GROUP = 'isekai:core', CHIP_GROUP = 'isekai:chips';
// a tree with no kind in a bare season: grown as a spray's limbs and twigs
const BARE_KIND = Object.freeze({ form: 'spray' });
const CHIP_BURIED = 0.92;
/**
 * HOLLOW: a gritty crown's lobe faces buried inside another lobe — its own tree's, or a neighbour's in the clump — are
 * never seen (every corner inside that lobe's own facets), so they are not built. The crown's shape is its outer
 * lobes'; its core is left out. Faces not of a lobe (trunks, limbs) are kept.
 */
export function hollowed(faces, lobes) {
  const B = new Map(), key = (i, j, k) => `${i},${j},${k}`, C = 2;
  for (const L of lobes) {
    const R = L.r;
    for (let i = Math.floor((L.at[0] - R) / C); i <= Math.floor((L.at[0] + R) / C); i++) for (let j = Math.floor((L.at[1] - R) / C); j <= Math.floor((L.at[1] + R) / C); j++) for (let k = Math.floor((L.at[2] - R) / C); k <= Math.floor((L.at[2] + R) / C); k++) {
      const q = key(i, j, k); if (!B.has(q)) B.set(q, []); B.get(q).push(L);
    }
  }
  // inside a lobe: a lobe is star-shaped about its centre, so the facet its centre sees `p` through decides — `p` behind
  // that facet's plane (by a hair) is inside
  const inside = (p, L) => {
    const d = sub(p, L.at);
    if (Math.hypot(d[0], d[1], d[2]) > L.r) return false;
    for (const [a, b, c] of L.tris) {
      const A = sub(a, L.at), Bv = sub(b, L.at), Cv = sub(c, L.at), s1 = dot(d, cross(A, Bv)), s2 = dot(d, cross(Bv, Cv)), s3 = dot(d, cross(Cv, A));
      if (!((s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0))) continue;
      const n = cross(sub(b, a), sub(c, a)), out = dot(n, A) > 0 ? 1 : -1;
      return out * dot(n, sub(p, a)) < -HOLLOW_EPS * Math.hypot(n[0], n[1], n[2]);
    }
    return false;
  };
  const out = [];
  for (const f of faces) {
    if (f._lobe === undefined) { out.push(f); continue; }
    const c = mean(f.corners), near = B.get(key(Math.floor(c[0] / C), Math.floor(c[1] / C), Math.floor(c[2] / C))) ?? [];
    const { _lobe: id, ...face } = f;
    if (!near.some((L) => L.id !== id && f.corners.every((p) => inside(p, L)))) out.push(face);
  }
  return out;
}
// (how far behind a facet a corner must lie to count as inside, m)
const HOLLOW_EPS = 0.01;
const facetN = (cs, toward) => { const n = unit(cross(sub(cs[1], cs[0]), sub(cs[2], cs[0]))); return (dot(n, toward) < 0 ? n.map((v) => -v) : n).map(r5); };

/** Nature by cause, kept broad (the lock quantizes it): grass in patches, the trail packed bright at its centre. */
function isekaiMarks(st, site, S) {
  return (f, c) => {
    if (f.group === 'isekai:trail') { const t = site.trailDist(c[0], c[1]) / site.halfWAt(c[1]), v = 1.08 - 0.2 * t * t; return [v, v, v]; }
    if (f.group === 'isekai:ground') { const v = 0.86 + 0.28 * smooth(0.3, 0.7, vnoise(c[0] * 0.12, c[1] * 0.12, S + 71)); return [v, v, v]; }
    return [1, 1, 1];
  };
}
