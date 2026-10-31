/**
 * OUT-WATER — the water on a trail's land, cut into its ground and drawn as a surface in the land's look (the card's
 * `water.fill`: a geocube's colour.water), not physics. Read as the trail's `ground.water` (out-ground.js), laid by the
 * site (out-trail.js siteOf) after the walk is laid, so no water moves the walk; a geocube lays its `outside.water` on
 * every trail it paints (era/geocube.js withGeocube), a game's levels as well as a scene's path.
 *
 *   lake    a basin beside the walk: its outline a wandering ring, its water at one level just under the lowest of its
 *           shore, the bed falling away under it, a sand shore round it. { side?, at?, size?, depth? }
 *   coast   the open side falls to the sea: the site runs on past its edge, the land eases down to a beach of sand and
 *           the beach into the sea, which runs on to the horizon (no far ridges over it). { beach?, depth? }
 *   river   a river beside the walk, on the far side unless named: its channel cut, its water falling with the land as a
 *           stream's does (never climbing more than a step), shingle on its banks. { side?, width?, off?, depth? }
 *   falls   water off the far cliff: a brook along the cliff top to the lip, the fall down the face, a pool at its foot;
 *           at the crossing's stream when the trail has one (the stream rises from the pool and fords the walk).
 *           { at?, width? }. A trail with no cliff (`cliff: false`) has none to fall from.
 *   `side` 'open' (the walk's open side) or 'far' (the cliff's side); `at` a share of the walk (0.15–0.85) where it
 *   stands; metres else. The coast takes the open side: a lake or a river beside a coast takes the far one.
 *
 *   UNDERGROUND (a cavern's trail, era/cavern.js: `ctx.cavern` its floor's span along the walk, { y0, y1 }): the river
 *   runs between its end walls, rising out of the rock at one and sinking into it at the other, a dark mouth on the wall
 *   at each; no sea lies under the rock (a coast is skipped); and the water is deepened toward the dark, its bed mostly
 *   lost (UNDERGROUND), so the cavern's own light is all that shows it (a fall's white water stays white).
 *
 *   readWater(w, at)                → the forms as written, checked (false: no water, a cube's refused) | null
 *   layWater(W, ctx)                → the bodies laid on the site's grid (it is cut in place): { forms, wet, sand,
 *                                     level, clear, faces, cameras, anchors, hazards, sea, coast, plan }
 *
 *   THE PLAN (`plan`): each body that moves as data, for a render to draw it live (era/water-live.js): a river's line
 *   downstream, its levels and its width; the falls' lip, its drop and width, the brook to it and its pool's carved bed;
 *   a lake's still water in its carved bed, a few leaves at rest on it.
 *   Each body's painted faces carry its id (`waterBody`), so a render that draws it live leaves them out.
 *   waterCameras(site)              → the stills each body is seen from (a lake, the shore, the river, the falls)
 *
 * Pure: integer-hash dice and value noise, the same recipe the same water.
 */
import { hash3, vnoise } from './dirt.js';
import { r5, rgbHex, hexRgb } from './geom.js';
import { gridSample, gridX, gridY } from '../polygonizer/landform.js';

const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * THE WATER CARD: what each form is by default, in metres.
 *   lake    size the basin's radius, depth under its level, gap off the walk's edge, shore the sand's rise over the water
 *   coast   beach the sand's width, depth the sea's fall past the shoreline, room how far the site runs on past its
 *           edge, berm the beach's crest over the sea, ease how far inland the land eases down to the beach
 *   river   width, off its line off the walk's, depth of its channel, step how far its water may climb with the land
 *   falls   width of the fall, pool its plunge pool's radius, brook the cliff-top brook's width
 */
export const WATER = Object.freeze({
  lake: Object.freeze({ size: 7, depth: 1.6, gap: 3, shore: 0.32, bank: 0.3, wander: 0.22 }),
  coast: Object.freeze({ beach: 6, depth: 3, room: 22, berm: 0.55, ease: 4, at: 3 }),
  river: Object.freeze({ width: 3, off: 8, depth: 0.7, step: 1.2, bank: 0.6, shingle: 0.8 }),
  falls: Object.freeze({ width: 2.4, pool: 3.2, poolDepth: 1.2, brook: 1.4, lift: 0.28 }),
});
export const WATER_FORMS = Object.freeze(Object.keys(WATER));
// underground water: its colour deepened this far toward black, its alpha [lo, hi] (the shallows' and the deeps': its
// bed mostly lost); a river's mouth in the wall where it rises and where it sinks, `h` metres over its water, `out`
// off the wall's foot, `into` how far its channel is cut into the wall
export const UNDERGROUND = Object.freeze({ deep: 0.55, alpha: Object.freeze([0.5, 0.95]), mouth: Object.freeze({ h: 1.1, into: 1, fill: '#0b0b0d' }) });
/** A water face's fill and alpha underground (a cavern's): deepened toward the dark, its bed mostly lost. */
export const undergroundFill = (hex) => rgbHex(hexRgb(hex).map((v) => v * (1 - UNDERGROUND.deep)));
export const undergroundAlpha = (a) => UNDERGROUND.alpha[0] + (UNDERGROUND.alpha[1] - UNDERGROUND.alpha[0]) * a;
// the plan's (era/water-live.js): a pool's bed read on a grid this fine (m)
// (`basin` how far out, in its radii, a pool's own water reaches; `dry` the least bank past it, m)
const WATER_LIVE = Object.freeze({ bedCell: 0.25, bedMax: 121, basin: 1.15, dry: 0.05 });
// how far a fresh water's bank reaches: a lake's (and a pool's) in its radii from its centre, a river's in metres past
// its edge (era/substrate.js reads its wet ground off it)
const BANK_REACH = Object.freeze({ lake: 1.7, river: 4 });
const SIDES = ['open', 'far'];
const KEYS = { lake: ['side', 'at', 'size', 'depth'], coast: ['beach', 'depth'], river: ['side', 'width', 'off', 'depth'], falls: ['at', 'width'] };
const RAILS = { at: [0.15, 0.85, 'a share of the walk, 0.15 to 0.85'], size: [3, 14, 'the basin\'s radius in metres, 3 to 14'], depth: [0.3, 8, 'metres under the water, 0.3 to 8'],
  beach: [2, 14, 'metres of sand, 2 to 14'], width: [1, 8, 'metres across, 1 to 8'], off: [4, 20, 'metres off the walk\'s line, 4 to 20'] };

/** Read a trail's `ground.water` and say what is wrong. → { lake?, coast?, river?, falls? } (each the settings written,
 *  `{}` for true), false (no water), or null (absent). */
export function readWater(w, at = 'trail.ground.water') {
  if (w === undefined) return null;
  if (w === false) return false;
  const forms = WATER_FORMS.join(', ');
  if (!isObj(w)) throw new Error(`stage: ${at} is { ${WATER_FORMS.map((f) => `${f}?`).join(', ')} } (or false: none)`);
  const out = {};
  for (const [k, v] of Object.entries(w)) {
    if (!WATER[k]) throw new Error(`stage: ${at}.${k} is not a water (waters: ${forms})`);
    if (v === false || v === undefined) continue;
    if (v !== true && !isObj(v)) throw new Error(`stage: ${at}.${k} is true or { ${KEYS[k].map((q) => `${q}?`).join(', ')} }`);
    const o = v === true ? {} : v;
    for (const q of Object.keys(o)) if (!KEYS[k].includes(q)) throw new Error(`stage: ${at}.${k}.${q} is not a ${k} setting (settings: ${KEYS[k].join(', ')})`);
    if (o.side !== undefined && !SIDES.includes(o.side)) throw new Error(`stage: ${at}.${k}.side is 'open' (the walk's open side) or 'far' (the cliff's side)`);
    for (const q of Object.keys(o)) if (RAILS[q] && !(typeof o[q] === 'number' && o[q] >= RAILS[q][0] && o[q] <= RAILS[q][1])) throw new Error(`stage: ${at}.${k}.${q} is ${RAILS[q][2]}`);
    out[k] = { ...o };
  }
  // the coast takes the open side: a lake or a river beside it stands on the far one
  if (out.coast) for (const f of ['lake', 'river']) if (out[f]?.side === 'open') throw new Error(`stage: ${at}.${f}.side: the coast takes the open side (the sea); a ${f} beside a coast is on the far side`);
  if (out.lake && out.river && sideOf(out, 'lake') === sideOf(out, 'river')) throw new Error(`stage: ${at}: the lake and the river are both on the ${sideOf(out, 'lake')} side; put one on the other (side: 'open' or 'far')`);
  return out;
}
// the side a lake or a river stands on: written, else the open side for a lake and the far one for a river, a coast's
// open side the sea's
const sideOf = (W, f) => W[f].side ?? (f === 'lake' && !W.coast ? 'open' : 'far');

/** The water's fill and its foam (a fall's white water), from the card. */
export const waterFill = (st) => (st.water ? st.water.fill : st.debris ? st.debris.water : '#7f95ab');
const foamOf = (hex) => rgbHex(hexRgb(hex).map((v) => mix(v, 1, 0.6)));

/**
 * The water laid on a trail's site. `ctx`: { st, g (the grid, cut in place), trailX, edge, cliffX, open, W (the plan's
 * width), Wg (the grid's: past W on a coast), D, S (the seed), beats, streams, x0 }. → the bodies (see the header).
 */
export function layWater(Wr, ctx) {
  const { st, g, trailX, edge, cliffX, open, W, Wg, D, S, streams } = ctx;
  const x0 = g.x0, talus = st.cliff ? st.cliff.talus : 3, G0 = { ...g, z: g.z.slice() }, pre = (x, y) => gridSample(G0, x, y);
  const nodes = (fn) => { for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) fn(j * g.nx + i, gridX(g, i), gridY(g, j)); };
  // (the far side's foot: the cliff's past its talus, or the site's back edge on an open trail)
  const farFoot = (y) => (open ? x0 + 2 : cliffX(y) + talus + 1);
  const bodies = [], wetFns = [], sandFns = [], levelFns = [], clearFns = [], faces = [], cameras = [], anchors = [], hazards = [];
  const fill = waterFill(st), under = ctx.cavern ?? null, plan = [], basins = new Map();
  // (the body the sheets laid now belong to: its painted faces carry it, `waterBody`)
  let body = null;
  // (underground the still water is deepened and its bed lost; a fall's white water, named by its own fill, stays white)
  const sheet = (corners, alpha, f = fill) => faces.push({ corners: corners.map((p) => p.map(r5)), normal: [0, 0, 1], outNormal: [0, 0, 1], fill: under && f === fill ? undergroundFill(f) : f, water: true,
    cornerAlpha: (under && f === fill ? alpha.map(undergroundAlpha) : alpha).map(r5), group: 'isekai:water', ...(body ? { waterBody: body } : {}) });
  const lower = (q, t) => { if (t < g.z[q]) { g.z[q] = t; g.apron[q] = 0; g.hard[q] = 0; } };
  const trailEye = (y) => { const x = trailX(y); return [x, y, pre(x, y) + 1.7]; };
  // (a basin: its outline a wandering ring of radius r round c, its level just under the lowest of its shore, its bed
  // falling `depth` under it; the bank eased up beyond. Lowers only: what stood under the level stays)
  const basin = (cx, cy, r, depth, seed, name, level = null) => {
    const rs = (a) => r * (1 + WATER.lake.wander * (2 * vnoise(Math.cos(a) * 1.3 + 5, Math.sin(a) * 1.3 + 5, seed) - 1));
    let L = Infinity; for (let k = 0; k < 48; k++) { const a = (2 * Math.PI * k) / 48, R = rs(a); L = Math.min(L, pre(cx + R * Math.cos(a), cy + R * Math.sin(a))); }
    L -= 0.15;
    // (on another water, the level it is laid at: a pool on a river is the river's)
    if (level !== null) L = level;
    const u = (x, y) => Math.hypot(x - cx, y - cy) / rs(Math.atan2(y - cy, x - cx));
    nodes((q, x, y) => { const k = u(x, y); if (k < 2) lower(q, k < 1 ? L - depth * (1 - k * k) : L + WATER.lake.bank * (k - 1) * r); });
    const R = r * (1 + WATER.lake.wander);
    // the sheet: 1 m cells over the basin, the dry ones left out; clear in the shallows, deep over the bed
    for (let y = Math.floor(cy - R - 1); y < cy + R + 1; y += 1) for (let x = Math.floor(cx - R - 1); x < cx + R + 1; x += 1) {
      const cs = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]];
      if (cs.every(([a, b]) => gridSample(g, a, b) > L + 0.02 || u(a, b) > 1.15)) continue;
      sheet(cs.map(([a, b]) => [a, b, L]), cs.map(([a, b]) => Math.max(0.2, Math.min(0.88, 0.2 + ((L - gridSample(g, a, b)) / depth) * 0.68))));
    }
    wetFns.push((x, y) => u(x, y) < 1.02 && gridSample(g, x, y) < L);
    sandFns.push((x, y, z) => (u(x, y) < 1.3 ? L + WATER.lake.shore - z : -1));
    clearFns.push((x, y) => u(x, y) < 1.4);
    levelFns.push((x, y) => (u(x, y) < BANK_REACH.lake ? L : null));
    return { name, at: [r5(cx), r5(cy), r5(L)], r: r5(r), level: r5(L), u };
  };
  const respawn = (y) => { const b = [...ctx.beats].filter((q) => q.y < y - 1 && q.kind !== 'pit').pop() || ctx.beats[0]; return [r5(trailX(b.y)), r5(b.y), r5(pre(trailX(b.y), b.y) + 0.1)]; };
  const hazard = (id, of, box, y) => hazards.push({ id, kind: 'hazard', hazard: 'water', severity: 'slow', at: [0, 1, 2].map((k) => r5((box[0][k] + box[1][k]) / 2)), of, box: { min: box[0].map(r5), max: box[1].map(r5) }, respawn: respawn(y) });

  // ── the COAST: the open side falls to the sea ──
  let sea = null, coastLine = null;
  // (no sea lies under a cavern's rock: its coast skipped, named)
  if (Wr.coast && under) bodies.push({ form: 'coast', skipped: 'a cavern is closed in by its rock: no sea under it' });
  if (Wr.coast && !under) {
    const C = { ...WATER.coast, ...Wr.coast };
    // the shoreline just past the plan's edge (the meadow as it was), wandering, never nearer the walk than the beach
    // and its ease allow
    const xc = (y) => Math.max(W + C.at + 2.5 * (2 * vnoise(y * 0.06, 3.5, S + 1301) - 1), trailX(y) + edge(y) + C.beach + C.ease + 1);
    let lo = Infinity; for (let y = 0; y <= D; y += 1) lo = Math.min(lo, pre(xc(y) - C.beach, y));
    const Zs = lo - C.berm - 0.25, top = Zs + C.berm;
    const prof = (u) => (u < -C.beach ? top : u < 0 ? Zs + C.berm * (-u / C.beach) : Zs - C.depth * smooth(0, 16, u));
    nodes((q, x, y) => {
      const u = x - xc(y), w = smooth(-C.beach - C.ease, -C.beach, u); if (w <= 0) return;
      g.z[q] = mix(g.z[q], prof(u), w); g.apron[q] *= 1 - w; g.hard[q] *= 1 - w;
    });
    sea = Zs; coastLine = xc;
    let xmin = Infinity; for (let y = 0; y <= D; y += 1) xmin = Math.min(xmin, xc(y));
    // the sea: 2 m cells over the grid wherever the ground lies under it, then out to the horizon beyond the grid
    const alpha = (x, y) => Math.max(0.18, Math.min(0.9, 0.18 + ((Zs - gridSample(g, x, y)) / C.depth) * 0.72));
    for (let y = 0; y < D - 1e-9; y += 2) for (let x = Math.floor(xmin - 2); x < Wg - 1e-9; x += 2) {
      const xb = Math.min(Wg, x + 2), yb = Math.min(D, y + 2), cs = [[x, y], [xb, y], [xb, yb], [x, yb]];
      if (cs.every(([a, b]) => gridSample(g, a, b) > Zs + 0.05)) continue;
      sheet(cs.map(([a, b]) => [a, b, Zs]), cs.map(([a, b]) => alpha(a, b)));
    }
    const F = 1200, deep = [0.9, 0.9, 0.9, 0.9], s0 = Math.floor(xmin - 2);
    sheet([[Wg, -F, Zs], [Wg + F, -F, Zs], [Wg + F, D + F, Zs], [Wg, D + F, Zs]], deep);
    sheet([[s0, -F, Zs], [Wg, -F, Zs], [Wg, 0, Zs], [s0, 0, Zs]], deep);
    sheet([[s0, D, Zs], [Wg, D, Zs], [Wg, D + F, Zs], [s0, D + F, Zs]], deep);
    wetFns.push((x, y) => x > xc(y) - 0.2 && gridSample(g, x, y) < Zs);
    sandFns.push((x, y) => x - xc(y) + C.beach + 0.5);
    clearFns.push((x, y) => x > xc(y) - C.beach - 1.5);
    bodies.push({ form: 'coast', level: r5(Zs), shore: [r5(xmin), 0, r5(Zs)], beach: C.beach });
    const ys = D * 0.12, xs = xc(ys) - C.beach * 0.55;
    cameras.push({ name: 'shore', worldFraming: { cameraPosition: [xs, ys, gridSample(g, xs, ys) + 1.7].map(r5), lookAt: [xc(D * 0.6) + 6, D * 0.6, Zs + 1].map(r5), horizontalFov: 75, pictureCenter: [560, 390] } });
    anchors.push({ id: 'coast-1', kind: 'water', water: 'coast', at: [r5(xc(D / 2)), r5(D / 2), r5(Zs)], level: r5(Zs) });
    hazard('hazard-sea-1', 'coast-1', [[xmin, 0, Zs - C.depth], [Wg, D, Zs]], D / 2);
  }

  // ── the RIVER: beside the walk, falling with the land (laid before the falls: a pool on it takes its level) ──
  let riv = null;
  if (Wr.river) {
    const Rv = { ...WATER.river, ...Wr.river }, side = sideOf(Wr, 'river') === 'open' ? 1 : -1, hw = Rv.width / 2, dy = 0.5;
    // (its reach: past both ends of the site, or underground between the cavern's end walls)
    const ya = under ? under.y0 : -2, yb = under ? under.y1 : D + 2, inReach = under ? (y) => y >= ya - UNDERGROUND.mouth.into && y <= yb + UNDERGROUND.mouth.into : () => true;
    const ys = []; for (let y = ya; y <= yb + 1e-9; y += dy) ys.push(y);
    // its line off the walk's, wandering, held off the walk and off the cliff's foot (or the site's edge), smoothed
    const raw = ys.map((y) => {
      const x = trailX(y) + side * (Rv.off + 2 * (2 * vnoise(y * 0.04, 7.5, S + 1341) - 1));
      return side > 0 ? Math.max(trailX(y) + edge(y) + hw + 1, Math.min((coastLine ? coastLine(y) - Wr.coast.beach - 2 : Wg - 2) - hw, x)) : Math.min(trailX(y) - edge(y) - hw - 1, Math.max(farFoot(y) + hw, x));
    });
    const xr = raw.map((_, k) => { let t = 0, c = 0; for (let j = k - 8; j <= k + 8; j++) if (j >= 0 && j < raw.length) { t += raw[j]; c++; } return t / c; });
    // its water: from the higher end down, the least of the land so far, climbing with it only where the land rises
    // more than a step (as a stream follows its bed)
    const zr = ys.map((y, k) => pre(xr[k], y) - 0.2), n = ys.length, down = zr.slice(0, 8).reduce((a, b) => a + b) > zr.slice(n - 8).reduce((a, b) => a + b);
    const wl = new Float64Array(n);
    for (let t = 0, m = Infinity; t < n; t++) { const k = down ? t : n - 1 - t; m = Math.min(m, zr[k]); wl[k] = Math.max(m, zr[k] - Rv.step); }
    const at = (a, y) => { const u = Math.max(0, Math.min(n - 1.001, (y - ys[0]) / dy)), i = Math.floor(u); return mix(a[i], a[i + 1], u - i); };
    const dist = (x, y) => Math.abs(x - at(xr, y));
    riv = { x: (y) => at(xr, y), level: (y) => at(wl, y), hw };
    nodes((q, x, y) => {
      const d = dist(x, y), L = at(wl, y); if (d > hw + 6 || !inReach(y)) return;
      lower(q, d < hw ? L - Rv.depth * (1 - (d / hw) ** 2) : L + Rv.bank * (d - hw));
    });
    body = 'river-1';
    for (let k = 0; k + 2 < n; k += 2) {
      const a = ys[k], b = ys[k + 2], xa = xr[k], xb = xr[k + 2], la = wl[k], lb = wl[k + 2], w = hw + 0.25;
      sheet([[xa - w, a, la], [xa + w, a, la], [xb + w, b, lb], [xb - w, b, lb]], [0.5, 0.5, 0.5, 0.5]);
    }
    body = null;
    // (its plan: its line every metre from its higher end down, the water's level on it; how far it falls in all)
    const line = []; for (let t = 0; t < n; t += 2) { const k = down ? t : n - 1 - t; line.push([r5(xr[k]), r5(ys[k]), r5(wl[k])]); }
    plan.push({ id: 'river-1', form: 'river', fill, line, half: r5(hw), depth: Rv.depth, bank: Rv.bank, fall: r5(Math.abs(wl[0] - wl[n - 1])), length: r5(Math.abs(ys[n - 1] - ys[0])) });
    wetFns.push((x, y) => inReach(y) && dist(x, y) < hw && gridSample(g, x, y) < at(wl, y));
    sandFns.push((x, y) => (inReach(y) ? hw + Rv.shingle - dist(x, y) : -1));
    clearFns.push((x, y) => inReach(y) && dist(x, y) < hw + 1.8);
    levelFns.push((x, y) => (inReach(y) && dist(x, y) < hw + BANK_REACH.river ? at(wl, y) : null));
    // (underground, its MOUTHS: where it rises out of the rock and where it sinks into it, a low dark arch on the wall's
    // foot over its water, facing into the cavern)
    if (under) for (const [k, toward] of [[0, 1], [n - 1, -1]]) {
      const M = UNDERGROUND.mouth, y = ys[k] - toward * M.into * 0.9, x = xr[k], z = wl[k] - 0.05, w = hw + 0.35, seg = 8;
      for (let i = 0; i < seg; i++) {
        const a0 = Math.PI * (i / seg), a1 = Math.PI * ((i + 1) / seg), p = (a, r) => [x - toward * Math.cos(a) * w * r, y, z + Math.sin(a) * M.h * r];
        faces.push({ corners: [[x, y, z], p(a0, 1), p(a1, 1), [x, y, z]].map((c) => c.map(r5)), normal: [0, toward, 0], outNormal: [0, toward, 0], fill: M.fill, group: 'isekai:water-mouth' });
      }
    }
    const mid = Math.floor(n / 2);
    bodies.push({ form: 'river', side: side > 0 ? 'open' : 'far', width: Rv.width, falls: r5(wl[down ? 0 : n - 1] - wl[down ? n - 1 : 0]) });
    anchors.push({ id: 'river-1', kind: 'water', water: 'river', at: [r5(xr[mid]), r5(ys[mid]), r5(wl[mid])], width: Rv.width });
    let xa = Infinity, xb = -Infinity; for (const x of xr) { xa = Math.min(xa, x); xb = Math.max(xb, x); }
    hazard('hazard-river-1', 'river-1', [[xa - hw, 0, Math.min(...wl) - Rv.depth], [xb + hw, D, Math.max(...wl)]], ys[mid]);
    // (seen from its own bank, raised, looking down its reach)
    const ey = D * 0.1, ex = at(xr, ey) + side * (hw + 1.5), eye = [ex, ey, pre(ex, ey) + 3], ly = D * 0.45;
    cameras.push({ name: 'river', worldFraming: { cameraPosition: eye.map(r5), lookAt: [at(xr, ly), ly, at(wl, ly)].map(r5), horizontalFov: 75, pictureCenter: [560, 390] } });
  }

  // ── the FALLS: water off the far cliff ──
  if (Wr.falls) {
    if (open) throw new Error('stage: trail.ground.water.falls drop off the far cliff: an open trail (ground.cliff: false) has none to fall from');
    const Fa = { ...WATER.falls, ...Wr.falls }, cross = streams[0];
    body = 'falls-1';
    const yf = cross ? cross.y : D * (Fa.at ?? 0.45), xcl = cliffX(yf);
    // the face's profile across it: the top, the lip (where the ground leaves the top), the foot past the talus
    const top = pre(xcl - 7, yf), foot = pre(xcl + talus + 2, yf);
    let xl = xcl - 7; while (xl < xcl + 4 && pre(xl, yf) > top - 0.4) xl += 0.25;
    let xf = xl; while (xf < xcl + talus + 4 && pre(xf, yf) > foot + 0.4) xf += 0.25;
    const hw = Fa.width / 2, bw = Fa.brook / 2;
    // the brook along the top to the lip: a shallow groove, its water a little under the bank
    nodes((q, x, y) => { const d = Math.abs(y - yf); if (x < xl && d < bw + 0.6) lower(q, pre(x, y) - 0.4 * (1 - smooth(bw * 0.4, bw + 0.6, d))); });
    const brook = [];
    for (let x = x0; x < xl - 0.25; x += 1) {
      const xb = Math.min(xl - 0.25, x + 1), za = gridSample(g, x, yf) + 0.3, zb = gridSample(g, xb, yf) + 0.3;
      sheet([[x, yf - bw, za], [xb, yf - bw, zb], [xb, yf + bw, zb], [x, yf + bw, za]], [0.6, 0.6, 0.6, 0.6]);
      brook.push([r5(x), r5(yf), r5(za)]);
    }
    brook.push([r5(xl - 0.25), r5(yf), r5(gridSample(g, xl - 0.25, yf) + 0.3)]);
    // the fall down the face: a ribbon on the face's own profile, stood out off it, white water
    const prof = []; for (let x = xl - 0.5; x <= xf + 0.5; x += 0.25) prof.push([x, gridSample(g, x, yf)]);
    for (let k = 0; k + 1 < prof.length; k++) {
      const off = (p, q) => { const dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz) || 1; return [(-dz / l) * Fa.lift, (dx / l) * Fa.lift]; };
      const [a, b] = [prof[k], prof[k + 1]], o = off(a, b);
      sheet([[a[0] + o[0], yf - hw, a[1] + o[1]], [b[0] + o[0], yf - hw, b[1] + o[1]], [b[0] + o[0], yf + hw, b[1] + o[1]], [a[0] + o[0], yf + hw, a[1] + o[1]]], [0.86, 0.86, 0.86, 0.86], foamOf(fill));
    }
    clearFns.push((x, y) => Math.abs(y - yf) < hw + 1.5 && x < xf + 1);
    sandFns.push((x, y) => (x < xl && Math.abs(y - yf) < bw + 0.4 ? 1 : -1));
    // the pool at its foot (the stream, when there is one, rises from it)
    // (where a river runs past its foot, the pool on it: at the river's level there, so the fall drops into the river)
    const px = xf + Fa.pool, onRiver = riv && Math.abs(riv.x(yf) - px) < Fa.pool * (1 + WATER.lake.wander) * 2 + riv.hw;
    const pool = basin(px, yf, Fa.pool, Fa.poolDepth, S + 1321, 'pool', onRiver ? riv.level(yf) : null);
    body = null;
    // (its plan: off the lip toward the walk, the brook down to it, the pool's bed read once the land is all cut)
    plan.push({ id: 'falls-1', form: 'falls', fill, lip: [r5(xl), r5(yf), r5(top)], dir: [1, 0, 0], width: Fa.width, drop: r5(top - pool.level), brook: { line: brook, half: r5(bw) },
      pool: { at: pool.at, r: r5(Fa.pool), depth: Fa.poolDepth, reach: r5(Fa.pool * (1 + WATER.lake.wander) * 1.6) } });
    basins.set('falls-1', pool.u);
    bodies.push({ form: 'falls', lip: [r5(xl), r5(yf), r5(top)], foot: [r5(xf), r5(yf), r5(foot)], drop: r5(top - foot), pool: pool.at, ...(cross ? { stream: cross.b.id } : {}) });
    anchors.push({ id: 'falls-1', kind: 'water', water: 'falls', at: [r5(xl), r5(yf), r5(top)], foot: [r5(xf), r5(yf), r5(foot)], pool: pool.at, ...(cross ? { of: cross.b.id } : {}) });
    const ey = yf - 14 >= 3 ? yf - 14 : yf + 14, eye = trailEye(ey);
    cameras.push({ name: 'falls', worldFraming: { cameraPosition: eye.map(r5), lookAt: [xl + 1, yf, (top + foot) / 2].map(r5), horizontalFov: 70, pictureCenter: [560, 390] } });
  }

  // ── the LAKE: a basin beside the walk ──
  if (Wr.lake) {
    const Lk = { ...WATER.lake, ...Wr.lake }, side = sideOf(Wr, 'lake') === 'open' ? 1 : -1;
    // its station: written, else where the beats leave the most room on its side (a pocket's clearing, the landmark,
    // a ford, a pit, the falls are what it keeps clear of)
    const busy = [...(ctx.pockets ?? []).filter((p) => Math.sign(p.cx - trailX(p.cy)) === side).map((p) => p.cy), ...(ctx.marks ?? []).filter((m) => Math.sign(m.x - trailX(m.y)) === side).map((m) => m.y),
      ...streams.map((s) => s.y), ...(ctx.pits ?? []).map((p) => p.y), 3, D - 4];
    const shares = Lk.at !== undefined ? [Lk.at] : [0.3, 0.4, 0.5, 0.6, 0.7].map((s, i) => s + (hash3(i, 3, S + 1331) - 0.5) * 0.04);
    const room = (y) => (side > 0 ? (coastLine ? coastLine(y) - 8 : Wg - 2) - (trailX(y) + edge(y) + Lk.gap) : (trailX(y) - edge(y) - Lk.gap) - farFoot(y));
    const pick = shares.map((s) => ({ y: D * s, far: Math.min(...busy.map((b) => Math.abs(D * s - b))) })).sort((a, b) => b.far - a.far || a.y - b.y)[0];
    const y = pick.y, r = Math.min(Lk.size, room(y) / (2 * (1 + Lk.wander)));
    if (r >= 2.5) {
      const cx = trailX(y) + side * (edge(y) + Lk.gap + r * (1 + Lk.wander));
      body = 'lake-1';
      const L = basin(cx, y, r, Lk.depth, S + 1311, 'lake');
      body = null;
      // (its plan: still water in its carved bed, a few leaves at rest on it)
      const floaters = [0, 1, 2].map((i) => { const a = 2 * Math.PI * hash3(i, 5, S + 1361), d = r * (0.25 + 0.4 * hash3(i, 7, S + 1361)); return { at: [r5(cx + d * Math.cos(a)), r5(y + d * Math.sin(a))], shape: 'leaf', r: 0.3, yaw: r5(2 * Math.PI * hash3(i, 9, S + 1361)) }; });
      plan.push({ id: 'lake-1', form: 'lake', fill, pool: { at: L.at, r: L.r, depth: Lk.depth, reach: r5(r * (1 + WATER.lake.wander) * 1.6), floaters } });
      basins.set('lake-1', L.u);
      bodies.push({ form: 'lake', at: L.at, r: L.r, side: side > 0 ? 'open' : 'far' });
      anchors.push({ id: 'lake-1', kind: 'water', water: 'lake', at: L.at, r: L.r });
      hazard('hazard-lake-1', 'lake-1', [[cx - r * 1.3, y - r * 1.3, L.level - Lk.depth], [cx + r * 1.3, y + r * 1.3, L.level]], y);
      // (seen from across the walk, a little short of it and raised, so its water shows over its shore)
      const ey = Math.max(3, y - r * 1.2), ex = trailX(ey) - side * (edge(ey) + 2), eye = [ex, ey, pre(ex, ey) + 4.5];
      cameras.push({ name: 'lake', worldFraming: { cameraPosition: eye.map(r5), lookAt: [cx, y + r * 0.3, L.level].map(r5), horizontalFov: 75, pictureCenter: [560, 390] } });
    } else bodies.push({ form: 'lake', skipped: 'no room beside the walk on its side' });
  }

  const wet = (x, y) => wetFns.some((f) => f(x, y));
  // (a pool's or a lake's bed, read off the land now every body is cut: its depth under its level on a grid round it,
  // + under the water, − the bank over it; past its own basin all bank, though another water's channel run under its
  // level there; a big one's grid coarser, at most `bedMax` a side)
  for (const P of plan) if (P.pool) {
    const { at: [cx, cy, L], reach } = P.pool, u = basins.get(P.id), cell = r5(Math.max(WATER_LIVE.bedCell, (2 * reach) / (WATER_LIVE.bedMax - 1)));
    const nb = Math.ceil((2 * reach) / cell) + 1, bx = cx - reach, by = cy - reach, depth = [];
    for (let j = 0; j < nb; j++) for (let i = 0; i < nb; i++) {
      const x = bx + i * cell, y = by + j * cell, d = L - gridSample(g, x, y);
      // (and where a river runs through it, the river's water: one surface, not two)
      const own = u(x, y) < WATER_LIVE.basin && !(riv && Math.abs(x - riv.x(y)) < riv.hw + WATER_LIVE.dry * 4);
      depth.push(r5(own ? d : Math.min(d, -WATER_LIVE.dry)));
    }
    P.pool.bed = { x0: r5(bx), y0: r5(by), dx: cell, dy: cell, nx: nb, ny: nb, depth };
  }
  return {
    forms: bodies, faces, cameras, anchors, hazards, plan, ...(sea !== null ? { sea, coast: coastLine } : {}),
    wet,
    // where the ground is sand (a shore, a beach, a river's shingle): + inside, − outside, at a point on the ground
    sand: (x, y, z = gridSample(g, x, y)) => sandFns.reduce((m, f) => Math.max(m, f(x, y, z)), -1),
    // the level of the fresh water (a lake's, a pool's, a river's) whose bank holds a point, else null (the sea's is `sea`)
    level: (x, y) => { for (const f of levelFns) { const L = f(x, y); if (L !== null) return L; } return null; },
    // where nothing grows or stands: the water and its shores
    clear: (x, y) => clearFns.some((f) => f(x, y)),
    // (the bare ground, grass kept off it: the water and the sand)
    bare: (x, y) => wet(x, y) || sandFns.some((f) => f(x, y, gridSample(g, x, y)) > 0),
  };
}

/** A coast's beach as sand cells for the strand (era/strand.js): its dry sand's 1 m cells, a piece only on the dry
 *  sand, shells where the tide reaches (within a third of a metre of the sea). */
export function beachOf(site) {
  const Wt = site.water, cells = [];
  for (let y = 0.5; y < site.D; y += 1) for (let x = Math.floor(Wt.coast(y) - 16) + 0.5; x < Wt.coast(y) + 1; x += 1) if (Wt.sand(x, y) > 0 && site.ground(x, y) > Wt.sea + 0.04) cells.push([x, y]);
  return { cells, cell: 1, at: (p) => Wt.sand(p[0], p[1]) > 0 && site.ground(p[0], p[1]) > Wt.sea + 0.04, shore: (x, y) => site.ground(x, y) < Wt.sea + 0.35 };
}

/** The stills a trail's water is seen from (a lake, the shore, the river, the falls); none without water. */
export const waterCameras = (site) => site.water?.cameras ?? [];
