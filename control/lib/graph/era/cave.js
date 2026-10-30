/**
 * THE CAVE — the room of building against the rock: a passage cut into a trail's cliff (out-trail.js), two walls of the
 * cliff's own rock, a floor of its scree and a ceiling under the land. On the trail's ground grid, so its walls, floor,
 * scree and the land over it are drawn as the cliff's are (isekai.js isekaiGround) and the sun's shadow test sees it.
 *
 *   trail.ground.caves: [{ y, depth?, width?, height?, along?, id? }]
 *     y        the station along the trail its mouth opens at, in the cliff's foot
 *     depth    metres into the rock from the cliff's line (CAVE.depth)
 *     along    metres it then runs along behind the cliff's face, toward the trail's end (+) or its start (−): a gallery
 *     width    metres across, wall to wall (CAVE.width)        height   metres from its floor to its ceiling's crown
 *     light    the register it is lit by past its daylight (CAVE_LIGHTS): 'daylight' (none, the default), 'fluorescent',
 *              'torch' or 'bio'
 *     mouth    the mouth's height (its `height` when left out): a taller entrance, the ceiling flaring down from it to its
 *              height over a width in; a mouth taller than the rock over it opens to the sky, a cleft
 *
 *   readCaves(list, at)   the recipe checked → caves with their defaults
 *   cutCaves(g, caves, { gridX, gridY, cliffX, floorAt, back }) → [cave]   the grid cut to each cave's floor, its walls
 *       the cut's sides (steep: the cliff's rock), its floor's apron scree; each cave's plan returned with what stood
 *       there before (`top`), its centreline (`path`), `inside(x, y)` → its distance across and along, `ceil(x, y)`
 *   lidFaces(cave, g, { gridX, gridY }) → [{ corners, normal, under: bool }]   the LID: wherever the land stood above the
 *       ceiling, its underside the ceiling (a dome, springing at 0.55 of its height at the walls) and its top the land as
 *       it stood. The MOUTH is where the cliff's face falls below the ceiling: the lid is not laid there
 *   caveClear(caves) → (x, y) → bool   where nothing grows: the cave's floor and a margin round it
 *
 * Pure: the same recipe cuts the same cave.
 */

export const CAVE = Object.freeze({ width: 8, height: 5, depth: 10, along: 0, rise: 0.02, spring: 0.55, margin: 0.6, out: 3, apron: 1.2 });
const KEYS = ['id', 'y', 'depth', 'width', 'height', 'along', 'mouth', 'light'];
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

export function readCaves(list, at = 'trail.ground.caves') {
  if (!Array.isArray(list) || !list.length || list.length > 6) throw new Error(`stage: ${at} is a list of 1 to 6 caves, each { y, depth?, width?, height?, along? }`);
  return list.map((c, i) => {
    const w = `${at}[${i}]`;
    if (!isObj(c)) throw new Error(`stage: ${w} is { y, depth?, width?, height?, along? }`);
    for (const k of Object.keys(c)) if (!KEYS.includes(k)) throw new Error(`stage: ${w}.${k} is not a cave setting (${KEYS.join(', ')})`);
    const num = (k, lo, hi, d, words) => {
      if (c[k] === undefined) return d;
      if (typeof c[k] !== 'number' || !(c[k] >= lo && c[k] <= hi)) throw new Error(`stage: ${w}.${k} is ${words}`);
      return c[k];
    };
    if (c.id !== undefined && (typeof c.id !== 'string' || !/^[a-z][a-z0-9-]{0,31}$/.test(c.id))) throw new Error(`stage: ${w}.id is a short lower-case name`);
    return { id: c.id ?? `cave-${i + 1}`, y: num('y', 0, 400, null, 'the station its mouth opens at, metres along the trail'), depth: num('depth', 2, 60, CAVE.depth, 'metres into the rock, 2 to 60'),
      width: num('width', 2, 40, CAVE.width, 'metres wall to wall, 2 to 40'), height: num('height', 2, 30, CAVE.height, 'metres floor to crown, 2 to 30'),
      along: num('along', -200, 200, CAVE.along, 'metres along behind the face, −200 to 200'), mouth: num('mouth', 2, 40, null, 'the mouth\'s height in metres, 2 to 40'), light: (() => {
        if (c.light === undefined) return 'daylight';
        if (!CAVE_LIGHT_IDS.includes(c.light)) throw new Error(`stage: ${w}.light is one of ${CAVE_LIGHT_IDS.join(', ')}`);
        return c.light;
      })() };
  });
}

/** A point's distance to a polyline and how far along it its nearest point stands. */
function onPath(path, x, y) {
  let best = { d: Infinity, s: 0 }, s0 = 0;
  for (let k = 0; k + 1 < path.length; k++) {
    const [ax, ay] = path[k], [bx, by] = path[k + 1], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-9;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (L * L))), px = ax + dx * t, py = ay + dy * t, d = Math.hypot(x - px, y - py);
    if (d < best.d) best = { d, s: s0 + t * L };
    s0 += L;
  }
  return best;
}

export function cutCaves(g, caves, { gridX, gridY, cliffX, floorAt, back }) {
  return caves.map((c) => {
    // its centreline: from the land before the cliff's foot, into the rock, then along behind the face; held a wall's
    // breadth inside the site's back edge (`back`, the grid's x0)
    const xm = cliffX(c.y), xin = Math.max(back + c.width / 2 + 1, xm - c.depth);
    const path = [[xm + CAVE.out, c.y], [xin, c.y], ...(c.along ? [[xin, c.y + c.along]] : [])];
    const z0 = floorAt(xm + CAVE.out, c.y), half = c.width / 2, M = CAVE.margin;
    const floor = (s) => z0 + CAVE.rise * Math.max(0, s - CAVE.out);
    // (its height at s: the mouth's at the cliff, flaring down to its own over a width in; the crown at the centre,
    // springing at the walls at `spring` of it)
    const heightAt = (s) => (c.mouth === null ? c.height : c.height + (c.mouth - c.height) * (1 - smooth(CAVE.out, CAVE.out + Math.max(c.width, 6), s)));
    const ceil = (s, d) => floor(s) + heightAt(s) * (CAVE.spring + (1 - CAVE.spring) * Math.sqrt(Math.max(0, 1 - (Math.min(d, half) / half) ** 2)));
    const top = new Map();
    for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) {
      const x = gridX(g, i), y = gridY(g, j), { d, s } = onPath(path, x, y);
      if (d > half + M + 1) continue;
      const q = j * g.nx + i;
      top.set(q, g.z[q]);
      // (it only cuts: past the cliff's foot, where the land lies under its floor, the land is left as it lies)
      const w = 1 - smooth(half, half + M, d); if (w <= 0) continue;
      g.z[q] += (Math.min(floor(s), g.z[q]) - g.z[q]) * w;
      // (its floor scree, thickest at the walls' feet)
      if (g.apron) g.apron[q] = Math.max(g.apron[q] * (1 - w), w * (0.5 + 0.5 * smooth(half - CAVE.apron, half, d)));
      if (g.hard) g.hard[q] *= 1 - w;
    }
    const at = (x, y) => onPath(path, x, y), ceilAt = (x, y) => { const { d, s } = at(x, y); return ceil(s, d); };
    // (under the lid: where the land stood above the ceiling, read at the nearest node)
    const covered = (x, y) => { const i = Math.round((x - g.x0) / g.dx), j = Math.round((y - g.y0) / g.dx), t = top.get(j * g.nx + i); return t !== undefined && t > ceilAt(x, y) + 0.05; };
    return { ...c, path: path.map((p) => p.map((v) => Math.round(v * 1e5) / 1e5)), floorZ: Math.round(z0 * 1e5) / 1e5, top, inside: at, ceil: ceilAt, floor, heightAt, covered,
      // (its OPENING, the mouth's shape: across it at the cliff's line, from its floor to its ceiling's arch)
      opening: { at: [xm, c.y], into: [Math.sign(xin - (xm + CAVE.out)) || -1, 0], half, z: floor(CAVE.out), arch: (t) => floor(CAVE.out) + heightAt(CAVE.out) * (CAVE.spring + (1 - CAVE.spring) * Math.sqrt(Math.max(0, 1 - t * t))) } };
  });
}

export function lidFaces(cave, g, { gridX, gridY }) {
  const half = cave.width / 2, reach = half + CAVE.margin + 0.5, out = [];
  // a node of the lid: in the cave's reach, where the land stood above the ceiling
  const node = (i, j) => {
    const q = j * g.nx + i, t = cave.top.get(q);
    if (t === undefined) return null;
    const x = gridX(g, i), y = gridY(g, j);
    if (cave.inside(x, y).d > reach) return null;
    // (where the land fell below the ceiling, the mouth, both close to the ceiling: the lip of the mouth; `v` how far the
    // land stands over the ceiling, the lid's edge where it is 0)
    const c = cave.ceil(x, y), lid = t > c + 0.05;
    return { x, y, under: c, over: lid ? t : c, lid, v: t - c, t };
  };
  const cells = new Map();
  for (let j = 0; j + 1 < g.ny; j++) for (let i = 0; i + 1 < g.nx; i++) {
    const n = [node(i, j), node(i + 1, j), node(i + 1, j + 1), node(i, j + 1)];
    if (n.some((v) => !v) || !n.some((v) => v.lid)) continue;
    // (a cell at the mouth's edge, some corners where the land fell below the ceiling: cut along the line the land meets
    // the ceiling on, so the lid closes there, its underside and its top one edge)
    cells.set(`${i},${j}`, n);
    if (n.every((q) => q.lid)) { out.push({ corners: n.map((v) => [v.x, v.y, v.under]).reverse(), under: true }, { corners: n.map((v) => [v.x, v.y, v.over]), under: false }); continue; }
    const P = [];
    for (let k = 0; k < 4; k++) {
      const a = n[k], b = n[(k + 1) % 4];
      if (a.v > 0) P.push({ x: a.x, y: a.y, under: a.under, over: a.t });
      if ((a.v > 0) !== (b.v > 0)) { const u = a.v / (a.v - b.v), z = a.under + (b.under - a.under) * u; P.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, under: z, over: z }); }
    }
    // (as the land's faces are, quads: a triangle its last corner twice, a polygon fanned into them)
    for (let k = 1; k + 1 < P.length; k++) {
      const T = [P[0], P[k], P[k + 1], P[k + 1]];
      out.push({ corners: [T[2], T[1], T[0], T[0]].map((v) => [v.x, v.y, v.under]), under: true }, { corners: T.map((v) => [v.x, v.y, v.over]), under: false });
    }
  }
  // its SKIRT: where a cell of the lid has none beside it, a face from its underside up to its top, so the lid is a solid
  // of rock wherever its edge shows (at the mouth, where the land over it falls away)
  for (const [k, n] of cells) {
    const [i, j] = k.split(',').map(Number);
    for (const [di, dj, a, b] of [[0, -1, 0, 1], [1, 0, 1, 2], [0, 1, 2, 3], [-1, 0, 3, 0]]) {
      if (cells.has(`${i + di},${j + dj}`)) continue;
      const A = n[a], B = n[b];
      if (A.over - A.under < 0.02 && B.over - B.under < 0.02) continue;
      out.push({ corners: [[A.x, A.y, A.under], [B.x, B.y, B.under], [B.x, B.y, B.over], [A.x, A.y, A.over]], under: false, skirt: [di, dj] });
    }
  }
  return out;
}

export function caveClear(caves) {
  return (x, y) => caves.some((c) => c.inside(x, y).d < c.width / 2 + CAVE.margin + 1);
}

// ── the light under the lid ────────────────────────────────────────────────────────────────────────────────────────
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm3 = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** A polygon clipped to the half-space a face at `p` with normal `n` sees (in front of its plane). */
function clipFront(poly, p, n) {
  const out = [], side = (q) => dot3(sub3(q, p), n) - 1e-4;
  for (let k = 0; k < poly.length; k++) {
    const a = poly[k], b = poly[(k + 1) % poly.length], sa = side(a), sb = side(b);
    if (sa >= 0) out.push(a);
    if ((sa >= 0) !== (sb >= 0)) { const t = sa / (sa - sb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]); }
  }
  return out;
}

/**
 * The FORM FACTOR from a point (normal `n`) to a polygon: the share of the light a uniformly bright polygon lays on it
 * against the whole sky's (Lambert's polygon formula, the polygon clipped to the face's front). 0…1.
 */
export function formFactor(p, n, poly) {
  const P = clipFront(poly, p, n);
  if (P.length < 3) return 0;
  let f = 0;
  for (let k = 0; k < P.length; k++) {
    const a = norm3(sub3(P[k], p)), b = norm3(sub3(P[(k + 1) % P.length], p)), g = cross3(a, b), l = Math.hypot(...g);
    if (l < 1e-9) continue;
    f += Math.atan2(l, dot3(a, b)) * dot3(n, g) / l;
  }
  return Math.abs(f) / (2 * Math.PI);
}

// the mouth cut into strips across it, each its own window of sky; the land before it the bounce's
const STRIPS = 8, BOUNCE = Object.freeze({ reach: 6, wide: 2, gain: 0.5 }), DARK = 0.03;

/** Can a point in the cave see a point at its mouth: the line between them inside the cave, under its ceiling. */
function sees(cave, p, q) {
  const n = Math.max(2, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 0.75));
  for (let k = 1; k < n; k++) {
    const t = k / n, x = p[0] + (q[0] - p[0]) * t, y = p[1] + (q[1] - p[1]) * t, z = p[2] + (q[2] - p[2]) * t;
    if (cave.inside(x, y).d > cave.width / 2 + 0.2 || z > cave.ceil(x, y) + 0.05 || z < cave.floor(cave.inside(x, y).s) - 0.3) return false;
  }
  return true;
}

/** A point and the way on at `s` along a cave's centreline. */
function along(cave, s) {
  let s0 = 0;
  for (let k = 0; k + 1 < cave.path.length; k++) {
    const [ax, ay] = cave.path[k], [bx, by] = cave.path[k + 1], L = Math.hypot(bx - ax, by - ay);
    if (s <= s0 + L || k + 2 === cave.path.length) { const t = Math.min(1, (s - s0) / L); return { at: [ax + (bx - ax) * t, ay + (by - ay) * t], dir: [(bx - ax) / L, (by - ay) / L] }; }
    s0 += L;
  }
  return null;
}
const RHO = 0.5;
/**
 * The cave's SECTIONS: its cross-section every half its width along its centreline from the mouth in, each glowing
 * with the light its rock gives back of what reaches it from the sections nearer the mouth (the mouth itself the sky's,
 * 1): the light carried round a bend by the walls, as far in as it goes. Scaled with the cave, so a big cave and a small
 * one of one shape glow alike. Read once a cave. → [{ s, strips: [polygon], glow }]
 */
function sectionsOf(cave) {
  if (cave._sections) return cave._sections;
  const half = cave.width / 2, step = half, out = [];
  const total = cave.path.slice(1).reduce((a, p, k) => a + Math.hypot(p[0] - cave.path[k][0], p[1] - cave.path[k][1]), 0);
  for (let s = CAVE.out; s < total - step / 2; s += step) {
    const A = along(cave, s), v = [-A.dir[1], A.dir[0]], z0 = cave.floor(s), arch = (t) => z0 + cave.heightAt(s) * (CAVE.spring + (1 - CAVE.spring) * Math.sqrt(Math.max(0, 1 - t * t)));
    const at = (t, z) => [A.at[0] + v[0] * t * half, A.at[1] + v[1] * t * half, z];
    const strips = Array.from({ length: STRIPS }, (_, k) => { const t0 = -1 + (2 * k) / STRIPS, t1 = -1 + (2 * (k + 1)) / STRIPS, tm = (t0 + t1) / 2; return { poly: [at(t0, z0), at(t1, z0), at(t1, arch(t1)), at(t0, arch(t0))], mid: at(tm, (z0 + arch(tm)) / 2) }; });
    const sec = { s, strips, centre: at(0, (z0 + arch(0)) / 2), back: [-A.dir[0], -A.dir[1], 0], glow: out.length ? 0 : 1 };
    // (what its rock gives back: the light of the sections before it, seen from its middle facing the mouth)
    if (out.length) sec.glow = Math.min(1, RHO * out.reduce((a, q) => a + q.glow * q.strips.reduce((b, st) => b + (sees(cave, sec.centre, st.mid) ? formFactor(sec.centre, sec.back, st.poly) : 0), 0), 0));
    out.push(sec);
  }
  cave._sections = out;
  return out;
}

/** What a point under the lid sees of the day: the sky through the mouth and the glow of the sections between it and
 *  the mouth, strip by strip where it can see them, and the sunlit land before the mouth (the bounce); against what an
 *  open face of its tilt would see. → 0…1 */
export function caveSky(cave, p, n, day = 1) {
  const M = cave.opening, [ux, uy] = M.into, v = [-uy, ux], sp = cave.inside(p[0], p[1]).s;
  let f = 0;
  for (const sec of sectionsOf(cave)) {
    if (sec.s > sp - 0.2 || sec.glow < 1e-3) continue;
    for (const st of sec.strips) if (sees(cave, p, st.mid)) f += sec.glow * formFactor(p, n, st.poly);
  }
  // (the bounce: the land before the mouth, lit by the day, a window of its own below the sky's)
  const o = (t, r) => [M.at[0] - ux * r + v[0] * t * (M.half + BOUNCE.wide), M.at[1] - uy * r + v[1] * t * (M.half + BOUNCE.wide), M.z];
  if (sees(cave, p, [M.at[0], M.at[1], M.z + 0.3])) f += BOUNCE.gain * day * formFactor(p, n, [o(-1, 0), o(1, 0), o(1, BOUNCE.reach), o(-1, BOUNCE.reach)]);
  // (against what a face of its tilt sees in the open: the sky above its plane, the lit land below it)
  const open = (1 + n[2]) / 2 + BOUNCE.gain * day * (1 - n[2]) / 2;
  return Math.max(DARK, Math.min(1, f / Math.max(0.05, open)));
}

/**
 * The faces under a cave's lid lit by what they see (caveSky): each corner's light that is not the sun's scaled by it,
 * its share of the sun kept (`sunShare`: what the page's live sun redraws). Faces out from under every lid as they were.
 */
export function caveLight(faces, caves, { day = 1, open = 1 } = {}) {
  // (`open`: the share of the day's light a face takes in the open at this hour, its bake's light: a lamp lays its own
  // whatever the hour, so its light against the face's baked light is the more as the hour is darker)
  const lampGain = 1 / Math.max(0.12, open);
  const hex = (c) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`, rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  return faces.map((f) => {
    if (!f.fill || !f.corners || f.lamp) return f;
    // (a face is the cave's when a corner of it stands under a lid: a wall's cell runs from the floor up into the rock)
    const n = f.normal ?? [0, 0, 1], under = (c, q) => c.covered(q[0], q[1]) && q[2] < c.ceil(q[0], q[1]) + 0.1 && c.inside(q[0], q[1]).d < c.width / 2 + CAVE.margin + 0.5;
    const cave = caves.find((c) => f.corners.some((q) => under(c, q)));
    if (!cave) return f;
    const shares = Array.isArray(f.sunShare) ? f.sunShare : f.corners.map(() => f.sunShare ?? 0);
    // (each corner a hand off its face, so it does not see its own wall)
    // (a corner up in the rock is read where its face meets the ceiling)
    // (and its lamps' light, per channel: a register's colour on the rock)
    const ks = f.corners.map((c, i) => {
      const sh = shares[i] ?? 0, z = Math.min(c[2], cave.ceil(c[0], c[1]) - 0.15), q = [c[0] + n[0] * 0.1, c[1] + n[1] * 0.1, z + n[2] * 0.1], k = caveSky(cave, q, n, day), lm = lampLight(cave, q, n);
      const all = sh + (1 - sh) * k, rgbK = lm.map((v) => all + v * lampGain), lum = 0.3 * rgbK[0] + 0.59 * rgbK[1] + 0.11 * rgbK[2];
      return { all: lum, rgbK, share: sh > 0 ? sh / Math.max(1e-6, lum) : 0 };
    });
    const fills = (f.cornerFills ?? f.corners.map(() => f.fill)).map((c, i) => hex(rgb(c).map((v, ch) => v * ks[i].rgbK[ch])));
    const mean = [0, 1, 2].map((ch) => ks.reduce((a, q) => a + q.rgbK[ch], 0) / ks.length);
    return { ...f, fill: hex(rgb(f.fill).map((v, ch) => v * mean[ch])), cornerFills: fills, ...(f.sunShare !== undefined ? { sunShare: Array.isArray(f.sunShare) ? ks.map((q) => Math.round(q.share * 1e3) / 1e3) : Math.round((ks.reduce((a, q) => a + q.share, 0) / ks.length) * 1e3) / 1e3 } : {}) };
  });
}

// ── the rock it is built of: the geocube's boulders ─────────────────────────────────────────────────────────────────
/**
 * The cave's ROCKS: the land's own boulders (isekai.js boulderFaces) lining it, so its walls and its ceiling are the
 * geocube's rock, its broken edges and all, rather than a carved surface; the cut and the lid stand behind them as the
 * rock they are set in. Along each wall and across its far end two staggered rows, half in the wall, the lower bigger, rising to where its
 * ceiling springs; across its ceiling slabs hung upside down from it (`flip`: their caps its face), three abreast, from
 * where a taller mouth has come down to its height. Only under the lid: the mouth is the cliff's own. `unit` the land's rock unit (metres a size); → [{ x, y, z0, size, v, tall?, flip? }]
 */
export const CAVE_ROCKS = Object.freeze({ wall: [[0, 0.62, 0.75], [0.55, 0.5, 0.7]], ceiling: { across: [-0.55, 0, 0.55], every: 0.3, size: 0.38, tall: 0.45 } });
export function caveRocks(cave, unit) {
  const half = cave.width / 2, out = [], total = cave.path.slice(1).reduce((a, p, k) => a + Math.hypot(p[0] - cave.path[k][0], p[1] - cave.path[k][1]), 0);
  let v = 1000;
  const spring = (s) => cave.heightAt(s) * CAVE.spring;
  // the walls: each row a band of the spring's height (`at` its foot's share, `of` its rocks' height), rocks a
  // three-quarter step apart, the upper row on the gaps of the lower
  CAVE_ROCKS.wall.forEach(([at, of, step], row) => {
    for (const side of [-1, 1]) for (let s = CAVE.out; s < total; ) {
      const A = along(cave, s), h = Math.max(0.6, of * spring(s)), size = h / (0.7 * unit), d = side * (half + 0.12 * size * unit);
      const x = A.at[0] - A.dir[1] * d, y = A.at[1] + A.dir[0] * d;
      // (under the lid, and never in the way: at a bend a wall of one leg is the way into the next)
      if (cave.covered(x - A.dir[1] * -side * 0.8, y + A.dir[0] * -side * 0.8) && cave.inside(x, y).d >= half) out.push({ x, y, z0: cave.floor(s) + at * spring(s), size: Math.round(size * 100) / 100, v: v++ });
      s += step * size * unit + (row && s === CAVE.out ? 0.5 * size * unit : 0);
    }
  });
  // the far end: its rows across it too, the end's wall set back into the rock as the sides' are
  const E = along(cave, total), across = [-E.dir[1], E.dir[0]];
  CAVE_ROCKS.wall.forEach(([at, of, step], row) => {
    const h = Math.max(0.6, of * spring(total)), size = h / (0.7 * unit), r = size * unit;
    for (let t = -half + (row ? r : r / 2); t < half; t += step * r) {
      const x = E.at[0] + E.dir[0] * 0.12 * r + across[0] * t, y = E.at[1] + E.dir[1] * 0.12 * r + across[1] * t;
      out.push({ x, y, z0: cave.floor(total) + at * spring(total), size: Math.round(size * 100) / 100, v: v++ });
    }
  });
  // the ceiling: slabs hung from it, three abreast, a slab's breadth apart along it
  const C = CAVE_ROCKS.ceiling, size = (C.size * cave.width) / unit;
  // (from where a taller mouth has come down to its height: the entrance stands open, its own rock)
  for (let s = CAVE.out + 1; s < total; s += C.every * cave.width) {
    if (cave.heightAt(s) > cave.height * 1.1) continue;
    const A = along(cave, s);
    for (const t of C.across) {
      const x = A.at[0] - A.dir[1] * t * half, y = A.at[1] + A.dir[0] * t * half;
      if (cave.covered(x, y)) out.push({ x, y, z0: cave.ceil(x, y) + 0.1, size: Math.round(size * 100) / 100, v: v++, tall: C.tall, flip: true });
    }
  }
  return out;
}

/** A boulder hung from the ceiling: mirrored through its foot's level, so its cap is its face and it hangs below. */
export function flipBoulder(b, z0) {
  const fl = (f) => ({ ...f, corners: f.corners.map((c) => [c[0], c[1], 2 * z0 - c[2]]).reverse(), normal: [f.normal[0], f.normal[1], -f.normal[2]], outNormal: [f.normal[0], f.normal[1], -f.normal[2]] });
  return { ...b, sides: b.sides.map(fl), cap: b.cap.map(fl), rim: [] };
}

// ── its lamps: the register a cave is lit by past its daylight ──────────────────────────────────────────────────────
/**
 * CAVE_LIGHTS: what lights a cave past what its mouth lets in, by REGISTER (a cave's `light`): the same rock, a military
 * base's or a temple's or a grotto's by its light. Each lamp lays its light on the faces that can see it (in the cave,
 * under its ceiling) in the daylight's units (1: what an open face takes from the sky), `strength` at `near` metres and
 * falling with the square past it, nothing past `reach`; its fixture is drawn bright, its own light (no bake darkens it).
 * A register is laid for a cave 8 m across and scaled with this one (`lampScale`): in a hall twice as wide its lamps reach
 * twice as far and its fixtures stand twice the size (a base's tubes become its high-bay floods, a temple's sconces its
 * braziers), so a big cave and a small one of a shape are lit alike, as the day lights them.
 *   fluorescent  strip tubes hung along its crown a step apart (two rows in a wide cave), cold white: a base's
 *   torch        sconces on both walls in front of their rock, warm: a temple's
 *   bio          clusters of glowing growth at the walls' feet and from the ceiling, cyan-green, faint: a grotto's
 */
export const CAVE_LIGHTS = Object.freeze({
  fluorescent: Object.freeze({ colour: [0.88, 0.95, 1.0], strength: 0.9, near: 2.5, reach: 14, every: 4.5, fixture: '#f2f8ff' }),
  torch: Object.freeze({ colour: [1.0, 0.66, 0.34], strength: 0.85, near: 1.4, reach: 10, every: 6, z: 2.2, fixture: '#ffb24a' }),
  bio: Object.freeze({ colour: [0.42, 1.0, 0.82], strength: 0.5, near: 1.3, reach: 7, every: 2.6, fixture: '#7dffd8' }),
});
export const CAVE_LIGHT_IDS = Object.freeze(['daylight', ...Object.keys(CAVE_LIGHTS)]);

// how far the ceiling's slabs hang below it, and how far the walls' lower rocks stand out of them (caveRocks)
const slabDepth = (cave) => CAVE_ROCKS.ceiling.size * cave.width * 0.7 * CAVE_ROCKS.ceiling.tall;
const wallOut = (cave, s) => 0.38 * (CAVE_ROCKS.wall[0][1] * cave.heightAt(s) * CAVE.spring) / 0.7;

/** A cave's lamps by its register: [{ at: [x, y, z], kind, dir }] (`dir` the way along the cave at it). Memoised. */
export function caveLamps(cave) {
  if (cave._lamps) return cave._lamps;
  const L = CAVE_LIGHTS[cave.light], out = [];
  if (L) {
    const half = cave.width / 2, total = cave.path.slice(1).reduce((a, p, k) => a + Math.hypot(p[0] - cave.path[k][0], p[1] - cave.path[k][1]), 0);
    const step = Math.max(L.every, cave.light === 'fluorescent' ? cave.width * 0.45 : cave.light === 'torch' ? cave.width * 0.6 : 0);
    let k = 0;
    for (let s = CAVE.out + Math.max(2, cave.width * 0.5); s < total - 0.5; s += step, k++) {
      const A = along(cave, s), across = [-A.dir[1], A.dir[0]], at = (t, z) => [A.at[0] + across[0] * t, A.at[1] + across[1] * t, z];
      if (cave.light === 'fluorescent') for (const t of cave.width > 12 ? [-0.35 * half, 0.35 * half] : [0]) { const p = at(t, 0); if (cave.covered(p[0], p[1])) out.push({ at: [p[0], p[1], cave.ceil(p[0], p[1]) - slabDepth(cave) - 0.3], kind: 'fluorescent', dir: A.dir }); }
      if (cave.light === 'torch') for (const sg of [-1, 1]) { const p = at(sg * (half - wallOut(cave, s) - 0.25), 0); if (cave.covered(p[0], p[1])) out.push({ at: [p[0], p[1], cave.floor(s) + L.z], kind: 'torch', dir: A.dir, side: sg }); }
      if (cave.light === 'bio') { const sg = k % 2 ? 1 : -1, p = at(sg * (half - wallOut(cave, s) - 0.35), 0), q = at(-sg * 0.3 * half, 0);
        // (its light from the glow over the growth, half a metre up, not its foot: it lights the floor round it too)
        if (cave.covered(p[0], p[1])) out.push({ at: [p[0], p[1], cave.floor(s) + 0.5 * lampScale(cave)], kind: 'bio', dir: A.dir, foot: cave.floor(s) });
        if (k % 2 === 0 && cave.covered(q[0], q[1])) out.push({ at: [q[0], q[1], cave.ceil(q[0], q[1]) - slabDepth(cave) * 0.6], kind: 'bio', dir: A.dir, hung: true }); }
    }
  }
  cave._lamps = out.map((l) => ({ ...l, at: l.at.map((v) => Math.round(v * 1e5) / 1e5) }));
  return cave._lamps;
}

/** How a cave's register is scaled from the 8 m cave it is laid for. */
export const lampScale = (cave) => Math.max(1, cave.width / 8);

/** A CRACK in a ceiling (era/cavern.js): a thread of day where the rock is split, its light daylight's, falling mostly
 *  straight down (`down` its share that does: a shaft, the floor under it lit), carried the height of a hall. A lamp of
 *  its own kind, beside any register. */
export const CRACK = Object.freeze({ colour: [0.86, 0.93, 1.0], strength: 0.9, near: 6, reach: 32, down: 0.7 });

/** The lamps' light on a point (normal `n`) in a cave, per channel, in the daylight's units: the register's lamps and
 *  any of their own kind (a crack's), in the cave's colour key where it has one (era/cavern-key.js: `cave.key`), and a
 *  lamp that carries its own light (`l.light`: { colour, strength, near, reach }, its metres as they are: a light plot's
 *  key, era/cavern-set.js). */
export function lampLight(cave, p, n) {
  const out = [0, 0, 0], s = lampScale(cave), key = cave.key;
  for (const l of caveLamps(cave)) {
    const L = l.light ?? (l.kind === 'crack' ? CRACK : CAVE_LIGHTS[cave.light]);
    if (!L) continue;
    const colour = l.light ? L.colour : l.kind === 'crack' ? (key?.crack ?? L.colour) : (key?.light ?? L.colour), k = l.light ? 1 : s;
    const near = L.near * k, reach = L.reach * k, d = sub3(l.at, p), r = Math.hypot(...d);
    if (r > reach || r < 1e-6) continue;
    const cos = dot3(n, d) / r;
    if (cos <= 0 || !sees(cave, p, l.at)) continue;
    // (a crack's light falls: the more as the point stands straight under it)
    const aim = L.down ? 1 - L.down + L.down * Math.max(0, (l.at[2] - p[2]) / r) : 1;
    const e = L.strength * cos * aim / (1 + (r / near) ** 2) * (1 - smooth(reach * 0.7, reach, r));
    for (let c = 0; c < 3; c++) out[c] += e * colour[c];
  }
  return out;
}

/** The lamps' fixtures, drawn bright: a fluorescent's tube under its housing, a torch's flame on its bracket, a bio
 *  cluster's crystals. → [{ corners, normal, group, fill, lamp: true }] (`lamp` faces are their own light). */
export function lampFaces(cave) {
  const L0 = CAVE_LIGHTS[cave.light], out = [];
  if (!L0) return out;
  // (drawn in the cave's colour key where it has one, era/cavern-key.js)
  const L = cave.key?.fixture ? { ...L0, fixture: cave.key.fixture } : L0, glow = cave.key?.glow ?? '#4fe0b0';
  const box = (c, ex, ey, ez, fill, group, lamp) => {
    const [x, y, z] = c, P = (a, b, h) => [x + ex[0] * a + ey[0] * b, y + ex[1] * a + ey[1] * b, z + h];
    const sides = [[[-1, -1, 0], [1, -1, 0], [1, -1, 1], [-1, -1, 1], [0, -1, 0]], [[1, -1, 0], [1, 1, 0], [1, 1, 1], [1, -1, 1], [1, 0, 0]], [[1, 1, 0], [-1, 1, 0], [-1, 1, 1], [1, 1, 1], [0, 1, 0]], [[-1, 1, 0], [-1, -1, 0], [-1, -1, 1], [-1, 1, 1], [-1, 0, 0]],
      [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1], null], [[-1, 1, 0], [1, 1, 0], [1, -1, 0], [-1, -1, 0], null]];
    sides.forEach((q, i) => {
      const cs = q.slice(0, 4).map(([a, b, h]) => P(a * ez[0], b * ez[1], h * ez[2] - ez[2] / 2)), nrm = i === 4 ? [0, 0, 1] : i === 5 ? [0, 0, -1] : (() => { const [a, b] = q[4]; return [ex[0] * a + ey[0] * b, ex[1] * a + ey[1] * b, 0]; })();
      out.push({ corners: cs.map((v) => v.map((w) => Math.round(w * 1e5) / 1e5)), normal: nrm, group, fill: fill, ...(lamp ? { lamp: true } : {}) });
    });
  };
  const m = lampScale(cave), sz = (v) => v.map((x) => x * m);
  for (const l of caveLamps(cave)) {
    // (a crack's light is drawn as its slit, era/cavern.js crackFaces; a lamp with its own light draws its own)
    if (l.kind === 'crack' || l.light) continue;
    const ex = l.dir, ey = [-l.dir[1], l.dir[0]];
    if (l.kind === 'fluorescent') { box(l.at, ex, ey, sz([0.8, 0.07, 0.07]), L.fixture, 'cave:lamp', true); box([l.at[0], l.at[1], l.at[2] + 0.1 * m], ex, ey, sz([0.85, 0.12, 0.05]), '#2e3338', 'cave:fixture'); }
    if (l.kind === 'torch') { const w = [-ey[0] * l.side, -ey[1] * l.side]; box([l.at[0] - w[0] * 0.15 * m, l.at[1] - w[1] * 0.15 * m, l.at[2] - 0.3 * m], ex, ey, sz([0.05, 0.18, 0.3]), '#2a2420', 'cave:fixture'); box([l.at[0], l.at[1], l.at[2] + 0.12 * m], ex, ey, sz([0.09, 0.09, 0.32]), L.fixture, 'cave:lamp', true); }
    if (l.kind === 'bio') for (let k = 0; k < 4; k++) {
      const a = (k * 1.9) % (2 * Math.PI), r = (0.12 + 0.08 * k) * m, h = (l.hung ? -1 : 1) * (0.18 + 0.1 * ((k * 7) % 3)) * m;
      box([l.at[0] + Math.cos(a) * r, l.at[1] + Math.sin(a) * r, l.hung ? l.at[2] + h : l.foot], ex, ey, [(0.05 + 0.02 * k) * m, (0.05 + 0.02 * k) * m, Math.abs(h)], k % 2 ? L.fixture : glow, 'cave:lamp', true);
    }
  }
  return out;
}
