/**
 * THE LOCAL MERU, BUILT — the plan (plan.js) drawn in the isekai look, as the page that follows the trail it is laid on
 * from. The place only: the ground, the mounds, the walks, the towers. What joins the tiers (the flights' steps, the
 * climbs) is asked for as anchors and left to playscape; until it answers, a spiral's flight is walked as the slope its
 * shelf lays (as a trail's stairs site is), a stair stands in as blocks, and a climb as a plain ladder.
 *
 *   ground     a grid on the followed trail's own lattice: its last row IS that trail's last row (the seam), easing to the
 *              level; every MOUND risen from it by its mandala (round, or a polygon's apothem); a stair cut into a flank
 *              where it runs below it. Facets steeper than the style's `slope.rock` are cliff (pixel-locked strata), the
 *              rest grass, as isekai.js draws a trail.
 *   walk       the approach from the seam; a path across each terrace from where a way up arrives to where the next leaves
 *   spiral     a shelf round the flank, its inner edge sunk into it, its outer edge held up by a wall down to the flank
 *   stair      blocks, one a tread, down to the tier's foot: hidden where the flank stands over them, a stair's mass where not
 *   tower      four posts, braced, a deck, a rail open where the climb arrives, and — the top tier — an eave and a roof
 *   dressing   grass tufts on the level ground, a few boulders round the foot (isekai.js boulderFaces)
 *
 * What people build takes the scapeshift kit's made style (era/out-made.js madeStyle): the timber's chunk sizes the
 * members, the edge word says whether a stair is stone or timber, the paint share whether a roof is painted, and every
 * made colour is locked to the kit's made ramps (era/style/swatches.js). The bake and the lock are the isekai builder's.
 */
import { ISEKAI_STYLES, isekaiKeyOf, boulderFaces } from '../era/isekai.js';
import { bakeStageLight } from '../era/stage.js';
import { makeSunShadow, sunDir } from '../era/sun.js';
import { lockFaces } from '../era/palette.js';
import { madeStyle } from '../era/out-made.js';
import { hash3, vnoise } from '../era/dirt.js';
import { P, r5, hexRgb, rgbHex, crossed } from '../era/geom.js';
import { obox } from '../era/props.js';
import { gridX, gridY } from '../polygonizer/landform.js';
import { planLocalMeru, localMeruLaws, moundHeightAt, moundRadius, planFactor } from './plan.js';

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

// how far the level ground runs past the widest foot, how far the seam eases into it, the walk's lift off the ground
const APRON = 14, SEAM = 12, LIFT = 0.04;

// a mound's surface at (x, y): its foot's height plus its flank's, or nothing past its foot
const moundAt = (t, x, y) => {
  const dx = x - t.centre[0], dy = y - t.centre[1], r = Math.hypot(dx, dy) / planFactor(t.sides, t.turnAt, Math.atan2(dy, dx));
  return r < t.foot ? t.base + moundHeightAt(t, r) : -Infinity;
};
// a stair's walk at (x, y): its height if inside its strip, else nothing
const stairAt = (L, x, y) => {
  const o = [Math.cos(L.face), Math.sin(L.face)], c = L.at(0, 0), dx = x - c[0], dy = y - c[1];
  const s = -(dx * o[0] + dy * o[1]), lat = -dx * o[1] + dy * o[0];
  if (Math.abs(lat) > L.width / 2 + 0.25 || s < -0.5 || s > L.length + 0.3) return null;
  const q = L.path[Math.max(0, Math.min(L.path.length - 1, Math.round(s / 0.25)))];
  return q.z;
};

/** The ground's height: the followed trail's last row eased to the level, every mound risen from it, the stairs cut. */
function groundOf(p, seed) {
  const z0 = p.join.at[2], site = p.join.site, D = site ? site.D : p.join.at[1], N = p.join.N;
  const mounds = p.tiers.filter((t) => t.form === 'mound'), stairs = p.links.filter((L) => L.via === 'stair');
  const lump = (x, y) => 0.35 * (vnoise(x * 0.09, y * 0.09, seed + 311) - 0.5);
  return (x, y) => {
    const along = (x - p.join.at[0]) * N[0] + (y - p.join.at[1]) * N[1];
    if (along < -0.01 && site) return site.ground(x, D);
    const level = z0 + lump(x, y) * smooth(0, SEAM, y - D);
    let h = site ? site.ground(x, D) + (level - site.ground(x, D)) * smooth(0, SEAM, y - D) : level;
    for (const t of mounds) h = Math.max(h, moundAt(t, x, y));
    for (const L of stairs) { const z = stairAt(L, x, y); if (z !== null && z < h) h = Math.max(z - 0.02, p.tiers.find((t) => t.id === L.tier).base); }
    return h;
  };
}

/** The ground grid's faces on the followed trail's lattice (or a plain one standing alone), cliff and grass. */
function groundFaces(st, p, heightAt) {
  const site = p.join.site, c = p.tiers[0].centre;
  const reach = Math.max(...p.tiers.map((t) => (t.form === 'mound' ? t.foot * (t.sides >= 3 ? 1 / Math.cos(Math.PI / t.sides) : 1) : t.half * 1.5))) + APRON;
  const dx = site ? site.grid.dx : 0.5, xg0 = site ? site.grid.x0 : c[0] - reach;
  const xa = Math.min(site ? site.grid.x0 : Infinity, c[0] - reach), xb = Math.max(site ? site.W : -Infinity, c[0] + reach);
  const i0 = Math.floor((xa - xg0) / dx), i1 = Math.ceil((xb - xg0) / dx), y0 = site ? site.D : Math.min(p.join.at[1] - 4, c[1] - reach), j1 = Math.ceil((c[1] + reach - y0) / dx);
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

/** The walks: the approach, a path across each terrace, every spiral's shelf and wall, every stair's blocks. */
function walkFaces(st, p, heightAt, made) {
  const out = [], wall = [], sc = st.tiles.cliff.scale;
  const trail = (cs) => { const n = facet(cs, [0, 0, 1]); out.push({ corners: cs.map(P), normal: n.map(r5), outNormal: n.map(r5), tint: st.tint.trail, group: 'isekai:trail' }); };
  // a path on the ground from a to b, its half-width easing from h0 to h1
  const ribbon = (a, b, h0, h1) => {
    const d = [b[0] - a[0], b[1] - a[1]], len = Math.hypot(...d); if (len < 0.3) return;
    const u = [d[0] / len, d[1] / len], side = [-u[1], u[0]], rows = [];
    for (let s = 0; s <= len + 1e-9; s += Math.min(0.5, len)) {
      const hw = h0 + (h1 - h0) * smooth(0, len, s), x = a[0] + u[0] * s, y = a[1] + u[1] * s;
      rows.push([-1, 1].map((sg) => { const qx = x + side[0] * hw * sg, qy = y + side[1] * hw * sg; return [qx, qy, heightAt(qx, qy) + LIFT]; }));
    }
    for (let i = 0; i + 1 < rows.length; i++) trail([rows[i][0], rows[i][1], rows[i + 1][1], rows[i + 1][0]]);
  };
  const J = p.join, first = p.links[0], hw0 = J.site ? J.site.halfWAt(J.site.D) : 0.8;
  ribbon(J.at, p.route[1].at, hw0, (first.width || 1.6) / 2);
  // across each terrace: from where the way up the tier below arrives to where this tier's way up leaves
  p.tiers.forEach((t, k) => {
    if (!k || p.tiers[k - 1].form !== 'mound') return;
    const L = p.links[k], start = L.via === 'climb' ? L.climb.from : L.path[0].at;
    ribbon(p.tiers[k - 1].arrive.at, start, 0.8, (L.width || 1.6) / 2);
  });
  const stone = { key: null, scale: 1, tint: made.tint.stone, group: 'meru:stone' }, timber = { key: null, scale: 1, tint: made.tint.timber, group: 'meru:timber' };
  for (const L of p.links) {
    const t = p.tiers.find((q) => q.id === L.tier);
    if (L.via === 'spiral') {
      // the shelf: inner edge sunk a hand into the flank, outer edge out over it; the wall from the outer edge to the flank
      const W = L.width, path = L.path.filter((q, i) => i === 0 || i === L.path.length - 1 || i % 2 === 0);
      let u = 0;
      for (let i = 0; i + 1 < path.length; i++) {
        const a = path[i], b = path[i + 1], za = a.z - t.base, zb = b.z - t.base;
        const ai = L.ring(a.th, za + LIFT, -W / 2 - 0.3), ao = L.ring(a.th, za + LIFT, W / 2), bi = L.ring(b.th, zb + LIFT, -W / 2 - 0.3), bo = L.ring(b.th, zb + LIFT, W / 2);
        trail([ai, ao, bo, bi]);
        const fa = t.base + moundHeightAt(t, moundRadius(t, za) + W) - 0.3, fb = t.base + moundHeightAt(t, moundRadius(t, zb) + W) - 0.3;
        if (a.z - fa < 0.15 && b.z - fb < 0.15) continue;
        const cs = [[ao[0], ao[1], Math.min(fa, a.z)], [bo[0], bo[1], Math.min(fb, b.z)], bo, ao], n = facet(cs, sub(mean(cs), [t.centre[0], t.centre[1], mean(cs)[2]]));
        const du = Math.hypot(bo[0] - ao[0], bo[1] - ao[1]);
        wall.push({ corners: cs.map(P), normal: n.map(r5), outNormal: n.map(r5), cel: 'cliff', celN: n, uv: [[u, cs[0][2]], [u + du, cs[1][2]], [u + du, cs[2][2]], [u, cs[3][2]]].map(([x, y]) => [r5(x / sc), r5(y / sc)]), group: 'isekai:cliff' });
        u += du;
      }
    } else if (L.via === 'stair') {
      // the stand-in steps: a block a tread, down to the tier's foot, the edge word's material
      const surf = made.tokens.edge === 'stone' ? stone : timber, o = [Math.cos(L.face), Math.sin(L.face), 0], lat = [-o[1], o[0], 0], inw = mul(o, -1);
      const block = (s0, s1, z) => { const c = L.at((s0 + s1) / 2, 0); const zb = t.base - 0.3; obox(out, [c[0], c[1], (z + zb) / 2], inw, lat, [0, 0, 1], [(s1 - s0) / 2, L.width / 2, (z - zb) / 2], surf, 8); };
      for (const f of L.flights) for (let i = 0; i < f.risers; i++) block(f.s0 + i * L.going.T, f.s0 + (i + 1) * L.going.T, f.z0 + (i + 1) * L.going.R);
      for (const l of L.landings) block(l.s0, l.s1, l.z);
    }
  }
  return { faces: out, wall };
}

/** A watchtower: posts, bracing, the deck, the rail (open where its climb arrives), and on the top tier the roof. */
function towerFaces(t, made, seed) {
  const n = t.n, u = t.u, c = t.centre, s0 = t.base, out = [], ch = Math.max(0.8, Math.min(1.3, made.tokens.chunk));
  const wood = { key: null, scale: 1, tint: made.tint.timber, group: 'meru:timber' }, dark = { ...wood, tint: made.tint.timber.map((v) => v * 0.7) };
  const painted = hash3(t.k, 5, seed + 431) < made.tokens.paint, roofSurf = painted ? { key: null, scale: 1, tint: made.tint.paint, group: 'meru:paint' } : dark;
  const at = (a, b, z) => [c[0] + (n[0] * a + u[0] * b) * t.half, c[1] + (n[1] * a + u[1] * b) * t.half, z];
  const beam = (A, B, w, surf) => {
    const d = sub(B, A), L = Math.hypot(...d), ax = unit(d), side = Math.abs(ax[2]) > 0.9 ? [n[0], n[1], 0] : unit(cross(ax, [0, 0, 1])), up = unit(cross(side, ax));
    obox(out, mean([A, B]), ax, side, up, [L / 2, (w * ch) / 2, (w * ch) / 2], surf, 8);
  };
  const corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]], postTop = t.roofed ? t.eaveZ : t.railZ;
  for (const [a, b] of corners) beam(at(a, b, s0 - 0.3), at(a, b, postTop), 0.2, wood);
  // the bracing: an X on each side but the one the climb comes up
  for (let k = 0; k < 4; k++) {
    const [a0, b0] = corners[k], [a1, b1] = corners[(k + 1) % 4];
    if (a0 === 1 && a1 === 1) continue;
    beam(at(a0, b0, s0 + 0.3), at(a1, b1, t.deckZ - 0.35), 0.1, wood);
    beam(at(a1, b1, s0 + 0.3), at(a0, b0, t.deckZ - 0.35), 0.1, wood);
  }
  obox(out, [c[0], c[1], t.deckZ - 0.1], [n[0], n[1], 0], [u[0], u[1], 0], [0, 0, 1], [t.half + 0.15, t.half + 0.15, 0.1], dark, 8);
  for (let k = 0; k < 4; k++) {
    const [a0, b0] = corners[k], [a1, b1] = corners[(k + 1) % 4];
    if (a0 === 1 && a1 === 1) {
      const gap = 0.45 / t.half;
      beam(at(1, b0, t.railZ), at(1, gap * Math.sign(b0), t.railZ), 0.08, wood);
      beam(at(1, b1, t.railZ), at(1, gap * Math.sign(b1), t.railZ), 0.08, wood);
      continue;
    }
    beam(at(a0, b0, t.railZ), at(a1, b1, t.railZ), 0.08, wood);
  }
  if (t.roofed) {
    const o = 1 + 0.35 / t.half, apex = [c[0], c[1], t.apexZ];
    for (let k = 0; k < 4; k++) {
      const [a0, b0] = corners[k], [a1, b1] = corners[(k + 1) % 4], cs = [at(a0 * o, b0 * o, t.eaveZ), at(a1 * o, b1 * o, t.eaveZ), apex, apex].map(P);
      const nn = facet(cs, sub(mean(cs), [c[0], c[1], t.eaveZ]));
      out.push({ corners: cs, normal: nn.map(r5), outNormal: nn.map(r5), tint: roofSurf.tint, group: roofSurf.group });
    }
  }
  return out.map((f) => ({ ...f, node: t.id }));
}

// what a climb is answered with until playscape's ladder stands there: two rails up the face, rungs a hand apart, the
// rails standing past the lip to hold when stepping off. A stand-in; the climb anchor names what it prefers.
const RUNG = 0.3, LADDER_W = 0.5, HORNS = 1;
function ladderFaces(C, made) {
  const N = C.N, U = [-N[1], N[0], 0], out = [], wood = { key: null, scale: 1, tint: made.tint.timber.map((v) => v * 0.85), group: 'meru:timber' };
  const foot = [C.to[0] - N[0] * 0.12, C.to[1] - N[1] * 0.12], z0 = C.from[2] - 0.1, z1 = C.to[2] + HORNS;
  for (const sg of [-1, 1]) obox(out, [foot[0] + (U[0] * sg * LADDER_W) / 2, foot[1] + (U[1] * sg * LADDER_W) / 2, (z0 + z1) / 2], [N[0], N[1], 0], U, [0, 0, 1], [0.04, 0.04, (z1 - z0) / 2], wood, 8);
  for (let z = C.from[2] + RUNG; z < C.to[2] - 0.05; z += RUNG) obox(out, [foot[0], foot[1], z], U, [N[0], N[1], 0], [0, 0, 1], [LADDER_W / 2, 0.025, 0.025], wood, 8);
  return out.map((f) => ({ ...f, node: C.id }));
}

/** The kit's made style, with each made ramp's middle as the tint a made face is baked from. */
function madeOf(kitId, seed) {
  const m = madeStyle(kitId, seed), mid = (role) => { const S = m.swatch[role].stops; return S[Math.floor(S.length / 2)].map((v) => v / 255); };
  return { ...m, tint: { timber: mid('timber'), stone: mid('stone'), paint: mid('paint') }, ramps: { 'meru:timber': m.swatch.timber.stops, 'meru:stone': m.swatch.stone.stops, 'meru:paint': m.swatch.paint.stops } };
}

/** manifest → World payload, for a stage whose recipe carries a `meru` (a local meru on an isekai kit). */
export function assembleLocalMeruScene(manifest = {}, ctx = {}) {
  const st = ISEKAI_STYLES[manifest.style || 'isekai-meadow'];
  if (!st) throw new Error(`stage: meru: unknown isekai style '${manifest.style}' (known: ${Object.keys(ISEKAI_STYLES).join(', ')})`);
  const seed = Number.isFinite(manifest.seed) ? manifest.seed : 1, M = manifest.meru === true ? {} : manifest.meru;
  // `after` reads the stage's own kit and seed unless it names others: the trail this page follows
  const after = M.after ? { kit: st.id, seed, ...M.after } : null, p = planLocalMeru({ ...M, after });
  const made = madeOf(manifest.kit || st.id, seed);
  const heightAt = groundOf(p, seed), ground = groundFaces(st, p, heightAt), walk = walkFaces(st, p, heightAt, made);
  const built = [...p.tiers.filter((t) => t.form === 'tower').flatMap((t) => towerFaces(t, made, seed)), ...p.links.filter((L) => L.via === 'climb').flatMap((L) => ladderFaces(L.climb, made))];
  // a few boulders round the first tier's foot, off the approach
  const t0 = p.tiers[0], c = t0.centre, foot = t0.form === 'mound' ? t0.foot : t0.half * 2, rocks = [];
  for (let i = 0; i < 9; i++) {
    const a = TAU * hash3(i, 3, seed + 401), r = foot * planFactor(t0.sides, t0.turnAt, a) + 1.5 + 6 * hash3(i, 5, seed + 403), x = c[0] + Math.cos(a) * r, y = c[1] + Math.sin(a) * r;
    const toSeam = Math.abs((x - p.join.at[0]) * -p.join.N[1] + (y - p.join.at[1]) * p.join.N[0]);
    if (toSeam < 3 || (p.join.site && y < p.join.site.D + 2)) continue;
    rocks.push(boulderFaces(st, { x: r5(x), y: r5(y), z0: heightAt(x, y), size: 2 + Math.floor(3 * hash3(i, 7, seed + 405)), v: i }, seed));
  }
  const solid = [...ground.faces, ...walk.faces, ...walk.wall, ...built, ...rocks.flatMap((b) => [...b.sides, ...b.cap])];
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
  // the bake, then the lock: the land to the card's ramps, what people build to the kit's made ramps
  const ambient = hexRgb(st.light.ambient).map((v) => v * st.light.fill);
  const plain = [...ground.faces.filter((f) => !f.cel).map(({ flat, ...f }) => f), ...walk.faces, ...built];
  const baked = bakeStageLight(plain, [], ambient, undefined, sun);
  const faces = lockFaces([...baked, ...cel], (f) => made.ramps[f.group] || (st.lock[f.group] ? st.palette[st.lock[f.group]] : null));
  const cutouts = [...new Set(faces.filter((f) => /^isekai:.*:(blades)-/.test(f.texture || '')).map((f) => f.texture))].sort();
  // the frames: from the seam to the top; the whole level from off its flank; at each climb; from the top back
  const J = p.join, eye = [J.at[0], J.at[1], J.at[2] + 1.7], top = p.top, sky = st.palette.sky;
  const peakZ = top.form === 'tower' ? (top.roofed ? top.apexZ : top.railZ) : top.top, rise = peakZ - J.at[2], span = Math.max(foot, rise * 0.6);
  const wide = [c[0] + J.N[1] * span * 3.2, c[1] - J.N[0] * span * 3.2, J.at[2] + rise * 1.0];
  const cam = (name, from, to, fov = 70) => ({ name, worldFraming: { cameraPosition: from.map(r5), lookAt: to.map(r5), horizontalFov: fov, pictureCenter: [560, 390] } });
  const climbCams = p.links.filter((L) => L.via === 'climb').map((L, i) => { const C = L.climb; return cam(i ? `climb-${i + 1}` : 'climb', [C.from[0] - C.N[0] * 7, C.from[1] - C.N[1] * 7, C.from[2] + 2.5], [C.to[0], C.to[1], C.to[2] - 1]); });
  return {
    faces,
    cutouts,
    lights: [],
    cameras: [manifest.camera || cam('seam', eye, [c[0], c[1], peakZ - 2]), cam('wide', wide, [c[0], c[1], J.at[2] + rise * 0.55], 60), ...climbCams, cam('top', [top.arrive.at[0], top.arrive.at[1], top.arrive.at[2] + 1.6], [J.at[0], J.at[1], J.at[2]], 80)],
    viewBox: manifest.viewBox || { width: 1120, height: 780 },
    title: ctx.title || manifest.title || `mojulo stage · local meru · ${st.id.replace('-', ' ')}`,
    bg: rgbHex(sky[sky.length - 1].map((v) => v / 255)),
    haze: { color: st.air.fog.color, density: st.air.fog.density },
    sky: { zenith: sky[0], horizon: sky[sky.length - 1], day: 1, stars: 0, seed: 1, ...(st.sun ? { sun: { dir: dir.map(r5), size: st.sun.size, glow: st.sun.glow } } : {}) },
    pack: true,
    // the walk, and the climbs the walker can take: each climb anchor's foot, lip and way in (channels/walk.js CLIMB)
    walk: manifest.walk === false ? false : { speed: 6, spawn: eye.map(r5), minEye: 1.7, gravity: 22, radius: 0.4,
      climbs: p.anchors.filter((a) => a.site === 'climb').map((a) => ({ id: a.id, base: a.from, top: a.to, N: a.N, width: 1.2, speed: 2 })) },
    anchors: p.anchors,
    localMeru: {
      id: `local-meru:${p.recipe.id}`, ...(J.from ? { after: J.from } : {}),
      tiers: p.tiers.map((t) => ({ id: t.id, form: t.form, up: t.up.via, base: t.base, top: t.top })),
      meru: p.meru.stack, made: { kit: made.kitId, tokens: made.tokens },
      laws: localMeruLaws(p).map(({ law, ok, value }) => ({ law, ok, value })),
    },
  };
}
