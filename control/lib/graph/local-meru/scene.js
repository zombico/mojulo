/**
 * THE LOCAL MERU, BUILT — the plan (plan.js) drawn in the isekai look, as the page that follows the trail it is laid on
 * from. The place only: the ground, the mound, the shelf the walk runs on, its retaining wall, and the tower. What joins
 * the tiers (the flights' steps, the climb) is asked for as anchors and left to playscape; until it answers, a flight is
 * walked as the slope its shelf lays, as a trail's stairs site is.
 *
 *   ground     a grid on the followed trail's own lattice: its last row IS that trail's last row (the seam), easing to the
 *              level the mound stands on, the MOUND risen from it by the mandala's radius at every height. Facets steeper
 *              than the style's `slope.rock` are cliff (pixel-locked strata), the rest grass, as isekai.js draws a trail.
 *   shelf      the walk, a ribbon on the spiral from the foot to the summit, its inner edge sunk into the flank
 *   wall       the shelf's outer edge held up: a face from the walk down to the flank, pixel-locked as cliff
 *   tower      four posts to the eave, braced, a deck, a rail open where the climb arrives, a roof to the apex
 *   dressing   grass tufts on the level ground, a few boulders round the foot (isekai.js boulderFaces)
 *
 * The bake and the lock are the isekai builder's: plain faces baked by the sun (bakeStageLight) and locked to their
 * ramps; pixel-locked faces lit by choice of tile.
 */
import { ISEKAI_STYLES, isekaiKeyOf, boulderFaces } from '../era/isekai.js';
import { bakeStageLight } from '../era/stage.js';
import { makeSunShadow, sunDir } from '../era/sun.js';
import { lockFaces } from '../era/palette.js';
import { hash3, vnoise } from '../era/dirt.js';
import { P, r5, hexRgb, rgbHex, crossed } from '../era/geom.js';
import { obox } from '../era/props.js';
import { gridX, gridY } from '../polygonizer/landform.js';
import { planLocalMeru, localMeruLaws, moundHeightAt } from './plan.js';

const TAU = Math.PI * 2;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mean = (cs) => cs.reduce((a, p) => [a[0] + p[0] / cs.length, a[1] + p[1] / cs.length, a[2] + p[2] / cs.length], [0, 0, 0]);
const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const facet = (c, toward) => { const n = unit(cross(sub(c[2], c[0]), sub(c[3], c[1]))); return dot(n, toward) < 0 ? n.map((v) => -v) : n; };
const stopFill = (st, tile, lit) => { const T = st.tiles[tile], ramp = st.palette[T.ramp], w = T[lit ? 'lit' : 'shade']; return rgbHex(ramp[w[Math.floor(w.length / 2)]].map((v) => v / 255)); };

// how far the level ground runs past the mound's foot, how far the seam eases into it, the walk's lift off the ground
const APRON = 14, SEAM = 12, LIFT = 0.04;

/** The ground's height: the followed trail's last row eased to the level, the mound risen from it. */
function groundOf(p, seed) {
  const c = p.centre, z0 = p.join.at[2], M = p.recipe.mound, site = p.join.site, D = site ? site.D : p.join.at[1], N = p.join.N;
  const lump = (x, y) => 0.35 * (vnoise(x * 0.09, y * 0.09, seed + 311) - 0.5);
  return (x, y) => {
    const along = (x - p.join.at[0]) * N[0] + (y - p.join.at[1]) * N[1];
    const level = z0 + lump(x, y) * smooth(0, SEAM, y - D);
    const plain = site ? site.ground(x, D) + (level - site.ground(x, D)) * smooth(0, SEAM, y - D) : level;
    const r = Math.hypot(x - c[0], y - c[1]);
    const mound = r < M.foot ? z0 + moundHeightAt(M, r) : -Infinity;
    return along < -0.01 && site ? site.ground(x, D) : Math.max(plain, mound);
  };
}

/** The ground grid's faces on the followed trail's lattice (or a plain one standing alone), cliff and grass. */
function groundFaces(st, p, heightAt) {
  const site = p.join.site, c = p.centre, M = p.recipe.mound, reach = M.foot + APRON;
  const dx = site ? site.grid.dx : 0.5, xg0 = site ? site.grid.x0 : c[0] - reach;
  const xa = Math.min(site ? site.grid.x0 : Infinity, c[0] - reach), xb = Math.max(site ? site.W : -Infinity, c[0] + reach);
  const i0 = Math.floor((xa - xg0) / dx), i1 = Math.ceil((xb - xg0) / dx), y0 = site ? site.D : p.join.at[1] - 4, j1 = Math.ceil((c[1] + reach - y0) / dx);
  const g = { x0: xg0 + i0 * dx, y0, dx, nx: i1 - i0 + 1, ny: j1 + 1 };
  const z = new Float64Array(g.nx * g.ny);
  for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) z[j * g.nx + i] = heightAt(gridX(g, i), gridY(g, j));
  const at = (i, j) => [gridX(g, i), gridY(g, j), z[j * g.nx + i]], sc = st.tiles.cliff.scale, out = [];
  for (let j = 0; j + 1 < g.ny; j++) for (let i = 0; i + 1 < g.nx; i++) {
    const cs = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)], n = facet(cs, [0, 0, 1]);
    if (n[2] < st.slope.rock) {
      const h = Math.abs(n[0]) > Math.abs(n[1]) ? 1 : 0;
      out.push({ corners: cs.map(P), normal: n.map(r5), outNormal: n.map(r5), cel: 'cliff', celN: n, uv: cs.map((q) => [r5(q[h] / sc), r5(q[2] / sc)]), group: 'isekai:cliff' });
    } else out.push({ corners: cs.map(P), normal: n.map(r5), outNormal: n.map(r5), tint: st.tint.ground, group: 'isekai:ground', flat: n[2] });
  }
  return { faces: out, grid: g };
}

/** The walk: the approach from the seam to the foot, the shelf round the mound, and the shelf's retaining wall. */
function walkFaces(st, p, heightAt) {
  const R = p.recipe, W = R.path.width, c = p.centre, z0 = p.join.at[2], M = R.mound, out = [], wall = [], sc = st.tiles.cliff.scale;
  const trail = (cs) => { const n = facet(cs, [0, 0, 1]); out.push({ corners: cs.map(P), normal: n.map(r5), outNormal: n.map(r5), tint: st.tint.trail, group: 'isekai:trail' }); };
  // the approach: straight on from the seam, the trail's width narrowing to the shelf's
  const J = p.join, Nn = J.N, side = [-Nn[1], Nn[0], 0], hw0 = J.site ? J.site.halfWAt(J.site.D) : W / 2, len = R.path.approach;
  const st0 = [];
  for (let s = 0; s <= len + 1e-9; s += 0.5) {
    const hw = hw0 + (W / 2 - hw0) * smooth(0, len, s), x = J.at[0] + Nn[0] * s, y = J.at[1] + Nn[1] * s;
    st0.push([-1, 1].map((sg) => { const qx = x + side[0] * hw * sg, qy = y + side[1] * hw * sg; return [qx, qy, heightAt(qx, qy) + LIFT]; }));
  }
  for (let i = 0; i + 1 < st0.length; i++) trail([st0[i][0], st0[i][1], st0[i + 1][1], st0[i + 1][0]]);
  // the shelf: inner edge sunk a hand into the flank, outer edge out over it; the wall from the outer edge to the flank
  const ring = (q, r, z) => { const a = p.a0 + p.hand * q.th; return [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, z]; };
  const path = p.path.filter((q, i) => i === 0 || i === p.path.length - 1 || i % 2 === 0);
  let u = 0;
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i], b = path[i + 1], ra = p.mandala.shelfAt(a.z), rb = p.mandala.shelfAt(b.z);
    const ai = ring(a, ra - W / 2 - 0.3, a.z + LIFT), ao = ring(a, ra + W / 2, a.z + LIFT), bi = ring(b, rb - W / 2 - 0.3, b.z + LIFT), bo = ring(b, rb + W / 2, b.z + LIFT);
    trail([ai, ao, bo, bi]);
    // the wall: down to where the flank stands under the outer edge, sunk a little
    const fa = z0 + moundHeightAt(M, ra + W / 2) - 0.3, fb = z0 + moundHeightAt(M, rb + W / 2) - 0.3;
    if (a.z - fa < 0.15 && b.z - fb < 0.15) continue;
    const cs = [ring(a, ra + W / 2, Math.min(fa, a.z)), ring(b, rb + W / 2, Math.min(fb, b.z)), bo, ao], n = facet(cs, sub(mean(cs), [c[0], c[1], mean(cs)[2]]));
    const du = Math.hypot(bo[0] - ao[0], bo[1] - ao[1]);
    wall.push({ corners: cs.map(P), normal: n.map(r5), outNormal: n.map(r5), cel: 'cliff', celN: n, uv: [[u, cs[0][2]], [u + du, cs[1][2]], [u + du, cs[2][2]], [u, cs[3][2]]].map(([x, y]) => [r5(x / sc), r5(y / sc)]), group: 'isekai:cliff' });
    u += du;
  }
  return { faces: out, wall };
}

/** The watchtower: posts, bracing, the deck, the rail (open where the climb arrives), the roof. Timber, baked. */
function towerFaces(st, p) {
  const T = p.tower, n = T.n, u = T.u, c = T.centre, s0 = p.summit.z, out = [];
  const wood = { key: null, scale: 1, tint: st.tint.wood, group: 'isekai:wood' }, dark = { ...wood, tint: st.tint.wood.map((v) => v * 0.62) };
  const at = (a, b, z) => [c[0] + (n[0] * a + u[0] * b) * T.half, c[1] + (n[1] * a + u[1] * b) * T.half, z];
  const beam = (A, B, t, surf) => {   // a square member from A to B, `t` thick
    const d = sub(B, A), L = Math.hypot(...d), ax = unit(d), side = Math.abs(ax[2]) > 0.9 ? [n[0], n[1], 0] : unit(cross(ax, [0, 0, 1])), up = unit(cross(side, ax));
    obox(out, mean([A, B]), ax, side, up, [L / 2, t / 2, t / 2], surf, 8);
  };
  const corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  for (const [a, b] of corners) beam(at(a, b, s0 - 0.3), at(a, b, T.eave), 0.24, wood);
  // the bracing: an X on each side but the one the climb comes up
  for (let k = 0; k < 4; k++) {
    const [a0, b0] = corners[k], [a1, b1] = corners[(k + 1) % 4];
    if (a0 === 1 && a1 === 1) continue;
    beam(at(a0, b0, s0 + 0.3), at(a1, b1, T.deck - 0.35), 0.12, wood);
    beam(at(a1, b1, s0 + 0.3), at(a0, b0, T.deck - 0.35), 0.12, wood);
  }
  // the deck, its rail on three sides and either side of the climb's gap
  obox(out, [c[0], c[1], T.deck - 0.1], [n[0], n[1], 0], [u[0], u[1], 0], [0, 0, 1], [T.half + 0.15, T.half + 0.15, 0.1], dark, 8);
  for (let k = 0; k < 4; k++) {
    const [a0, b0] = corners[k], [a1, b1] = corners[(k + 1) % 4];
    if (a0 === 1 && a1 === 1) {
      const gap = 0.45 / T.half;
      beam(at(1, b0, T.rail), at(1, gap * Math.sign(b0), T.rail), 0.1, wood);
      beam(at(1, b1, T.rail), at(1, gap * Math.sign(b1), T.rail), 0.1, wood);
      continue;
    }
    beam(at(a0, b0, T.rail), at(a1, b1, T.rail), 0.1, wood);
  }
  // the roof: four faces from the eave (overhung) to the apex
  const o = 1 + 0.35 / T.half, apex = [c[0], c[1], T.apex], R = (q) => { const cs = q.map(P), nn = facet(cs, sub(mean(cs), [c[0], c[1], T.eave])); out.push({ corners: cs, normal: nn.map(r5), outNormal: nn.map(r5), tint: dark.tint, group: 'isekai:wood' }); };
  for (let k = 0; k < 4; k++) { const [a0, b0] = corners[k], [a1, b1] = corners[(k + 1) % 4]; R([at(a0 * o, b0 * o, T.eave), at(a1 * o, b1 * o, T.eave), apex, apex]); }
  return out.map((f) => ({ ...f, node: 'tower' }));
}

// what a climb is answered with until playscape's ladder stands there: two rails up the face, rungs a hand apart, the
// rails standing past the lip to hold when stepping off. A stand-in; the climb anchor names what it prefers.
const RUNG = 0.3, LADDER_W = 0.5, HORNS = 1;
function ladderFaces(st, p) {
  const C = p.climb, N = C.N, U = [-N[1], N[0], 0], out = [], wood = { key: null, scale: 1, tint: st.tint.wood.map((v) => v * 0.8), group: 'isekai:wood' };
  const foot = [C.to[0] - N[0] * 0.12, C.to[1] - N[1] * 0.12], z0 = C.from[2] - 0.1, z1 = C.to[2] + HORNS;
  for (const sg of [-1, 1]) obox(out, [foot[0] + U[0] * sg * LADDER_W / 2, foot[1] + U[1] * sg * LADDER_W / 2, (z0 + z1) / 2], [N[0], N[1], 0], U, [0, 0, 1], [0.04, 0.04, (z1 - z0) / 2], wood, 8);
  for (let z = C.from[2] + RUNG; z < C.to[2] - 0.05; z += RUNG) obox(out, [foot[0], foot[1], z], U, [N[0], N[1], 0], [0, 0, 1], [LADDER_W / 2, 0.025, 0.025], wood, 8);
  return out.map((f) => ({ ...f, node: 'climb-1' }));
}

/** manifest → World payload, for a stage whose recipe carries a `meru` (a local meru on an isekai kit). */
export function assembleLocalMeruScene(manifest = {}, ctx = {}) {
  const st = ISEKAI_STYLES[manifest.style || 'isekai-meadow'];
  if (!st) throw new Error(`stage: meru: unknown isekai style '${manifest.style}' (known: ${Object.keys(ISEKAI_STYLES).join(', ')})`);
  const seed = Number.isFinite(manifest.seed) ? manifest.seed : 1, M = manifest.meru === true ? {} : manifest.meru;
  // `after` reads the stage's own kit and seed unless it names others: the trail this page follows
  const after = M.after ? { kit: st.id, seed, ...M.after } : null, p = planLocalMeru({ ...M, after });
  const heightAt = groundOf(p, seed), ground = groundFaces(st, p, heightAt), walk = walkFaces(st, p, heightAt), tower = [...towerFaces(st, p), ...ladderFaces(st, p)];
  // a few boulders round the foot, off the approach
  const c = p.centre, foot = p.recipe.mound.foot, rocks = [];
  for (let i = 0; i < 9; i++) {
    const a = TAU * hash3(i, 3, seed + 401), r = foot + 1.5 + 6 * hash3(i, 5, seed + 403), x = c[0] + Math.cos(a) * r, y = c[1] + Math.sin(a) * r;
    const toSeam = Math.abs((x - p.join.at[0]) * -p.join.N[1] + (y - p.join.at[1]) * p.join.N[0]);
    if (toSeam < 3 || (p.join.site && y < p.join.site.D + 2)) continue;
    rocks.push(boulderFaces(st, { x: r5(x), y: r5(y), z0: heightAt(x, y), size: 2 + Math.floor(3 * hash3(i, 7, seed + 405)), v: i }, seed));
  }
  const solid = [...ground.faces, ...walk.faces, ...walk.wall, ...tower, ...rocks.flatMap((b) => [...b.sides, ...b.cap])];
  const key = st.light.key, dir = sunDir(key.elevation, key.azimuth), shadow = makeSunShadow(solid, dir, { cell: 0.6 });
  const sun = { dir, rgb: hexRgb(key.color), gain: st.light.sunGain, bounce: st.light.bounce, bounceGain: st.light.bounceGain, shadow };
  const reach = (q, nn) => Math.max(0, dot(nn, dir)) * shadow(add(q, mul(nn, 0.05)), nn), lit = (q, nn) => reach(q, nn) >= st.cel;
  // the pixel-locked faces: the cel band is the choice of tile
  const cel = [];
  const draw = (f, tile, isLit) => { const { cel: _c, celN: _n, size: _s, ...rest } = f; cel.push({ ...rest, texture: isekaiKeyOf(st, tile, isLit), fill: stopFill(st, tile, isLit) }); };
  for (const f of [...ground.faces, ...walk.wall]) if (f.cel === 'cliff') draw(f, 'cliff', lit(mean(f.corners), f.celN));
  for (const b of rocks) { for (const f of b.sides) draw(f, 'rock', lit(mean(f.corners), f.normal)); for (const f of b.cap) draw(f, 'hat', lit(mean(f.corners), f.normal)); }
  // grass: crossed blade cards on the level ground, the band by the shadow at the root
  const G = st.grass.cards;
  ground.faces.forEach((f, i) => {
    if (f.cel || f.flat < 0.9 || hash3(i, 11, seed + 421) > 0.3) return;
    const q = mean(f.corners), h = G.height * (0.6 + 0.6 * hash3(i, 13, seed + 423)), raw = [], lt = shadow([q[0], q[1], q[2] + 0.3], [0, 0, 1]) > 0;
    crossed(raw, [q[0], q[1], q[2] - 0.03], Math.PI * hash3(i, 17, seed + 427), h * G.width, h, isekaiKeyOf(st, 'blades', lt), [1, 1, 1], 'isekai:grass', 2);
    for (const { tint, textureLit, ...g } of raw) cel.push({ ...g, fill: stopFill(st, 'blades', lt) });
  });
  // the bake, then the lock
  const ambient = hexRgb(st.light.ambient).map((v) => v * st.light.fill);
  const plain = [...ground.faces.filter((f) => !f.cel).map(({ flat, ...f }) => f), ...walk.faces, ...tower];
  const baked = bakeStageLight(plain, [], ambient, undefined, sun);
  const faces = lockFaces([...baked, ...cel], (f) => (st.lock[f.group] ? st.palette[st.lock[f.group]] : null));
  const cutouts = [...new Set(faces.filter((f) => /^isekai:.*:(blades)-/.test(f.texture || '')).map((f) => f.texture))].sort();
  // the frames: from the seam to the tower; from the deck back over the way come; the whole level from off its flank
  const J = p.join, eye = [J.at[0], J.at[1], J.at[2] + 1.7], T = p.tower, sky = st.palette.sky;
  const deckEye = [T.centre[0], T.centre[1], T.deck + 1.6], wide = [c[0] + J.N[1] * foot * 3.6, c[1] - J.N[0] * foot * 3.6, J.at[2] + p.recipe.mound.height * 1.15];
  const cam = (name, from, to, fov = 70) => ({ name, worldFraming: { cameraPosition: from.map(r5), lookAt: to.map(r5), horizontalFov: fov, pictureCenter: [560, 390] } });
  return {
    faces,
    cutouts,
    lights: [],
    cameras: [manifest.camera || cam('seam', eye, [c[0], c[1], T.deck]), cam('wide', wide, [c[0], c[1], J.at[2] + p.recipe.mound.height * 0.8], 60), cam('climb', [p.climb.from[0] - p.climb.N[0] * 7, p.climb.from[1] - p.climb.N[1] * 7, p.climb.from[2] + 2.5], [p.climb.to[0], p.climb.to[1], p.climb.to[2] - 1], 70), cam('deck', deckEye, [J.at[0], J.at[1] - 20, J.at[2]], 80)],
    viewBox: manifest.viewBox || { width: 1120, height: 780 },
    title: ctx.title || manifest.title || `mojulo stage · local meru · ${st.id.replace('-', ' ')}`,
    bg: rgbHex(sky[sky.length - 1].map((v) => v / 255)),
    haze: { color: st.air.fog.color, density: st.air.fog.density },
    sky: { zenith: sky[0], horizon: sky[sky.length - 1], day: 1, stars: 0, seed: 1, ...(st.sun ? { sun: { dir: dir.map(r5), size: st.sun.size, glow: st.sun.glow } } : {}) },
    pack: true,
    // the walk, and the climb the walker can take: each climb anchor's foot, lip and way in (channels/walk.js CLIMB)
    walk: manifest.walk === false ? false : { speed: 6, spawn: eye.map(r5), minEye: 1.7, gravity: 22, radius: 0.4,
      climbs: p.anchors.filter((a) => a.site === 'climb').map((a) => ({ id: a.id, base: a.from, top: a.to, N: a.N, width: 1.2, speed: 2 })) },
    anchors: p.anchors,
    localMeru: {
      id: `local-meru:${p.recipe.id}`, ...(J.from ? { after: J.from } : {}),
      meru: p.meru.stack, length: p.length, turns: p.turns,
      laws: localMeruLaws(p).map(({ law, ok, value }) => ({ law, ok, value })),
    },
  };
}
