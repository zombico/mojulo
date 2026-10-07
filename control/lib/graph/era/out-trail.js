/**
 * OUT-TRAIL — an outdoor trail from a recipe, not from code: the first rung of the outdoor ladder (out-trail →
 * out-section → out-level; `out-` keeps them apart from the rooms' hall, section and floor). A trail is the stretch a
 * player runs through in about 12 s (the isekai meadow's 72 m) and explores in two or three minutes. What the hand-built trails (nature.js,
 * isekai.js) share is lifted into principles the builder reads as numbers:
 *
 *   spine      one line, swaying, its LENGTH set by the run: `run` seconds at the walk's speed
 *   beats      what happens along the spine, one every ~20 m: a pinch (the edges close in), a reveal (the climb to a
 *              crest, the view opening), a landmark (seen from the trailhead, it pulls the eye), a crossing (a stream to
 *              ford), a pocket (a dead-end off the spine with something in it), a rest, a pit. The run is the spine;
 *              the exploring is the beats' dwell and the pockets' detours
 *   heartbeat  the trail's height along its length, each beat its own shape (a climb into a reveal, a drop into a
 *              pinch, a dip to a ford, flat at a rest); `heartbeat` 0…1 is how hard it rises and falls
 *   bumpiness  mounds and hollows over the ground, low on the walk and full toward the edges; `bumpiness` 0…1
 *
 * The ground is built in PASSES, each on the one before, and each kept so the board can show it:
 *   1 rough    the heartbeat and the beats' edges and the bumps: the raw elevation
 *   2 smooth   the profile averaged; the walk held to a grade a walker takes, steeper runs marked as STAIRS sites;
 *              the ground eased; the geology (scarp, strata, joints, talus) at the cliff; the walk laid level again
 *              over it; the pits cut
 *   3 build    (stairs, bridges, posts: the next rung) — the sites are recorded here
 *   4 cover    the kit's own builder lays grass, rocks and trees on the site this returns
 *
 * Every beat and every hazard is ANNOTATED: an anchor with its kind, its station and its place; a hazard carries its
 * severity and the safe place to respawn. Pure functions of (style, recipe, seed): the same recipe builds the same trail.
 */
import { hash3, vnoise } from './dirt.js';
import { r5 } from './geom.js';
import { landformGrid, bakeGrid, applyLandform, gridSample, gridX, gridY } from '../polygonizer/landform.js';
import { readBounds, boundSegments, boundAnchors, boundColliders, boundLaw } from './out-bounds.js';

const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const gauss = (v, w) => Math.exp(-(v * v) / (2 * w * w));

/**
 * THE TRAIL CARD: the numbers the principles are enforced by. Times in seconds, lengths in metres.
 *   speed    the walk's run (the stage walker's `speed`); `pace` the exploring walk
 *   run      the run through, [lo, hi] and the default: 12 s is the isekai meadow's 72 m, the size a trail was first liked
 *            at and the least that holds two minutes of exploring (shorter, the beats' spacing leaves room for three);
 *            `explore` the exploring time's band
 *   rise     the heartbeat at 1: metres from the lowest dip to the highest crest
 *   grade    the steepest walk (rise over run): steeper is a stairs site
 *   spacing  the least distance between two beats
 *   bump     the bumpiness at 1: metres of mound, in octaves [share, frequency /m]; `walk` the share left on the walk
 */
export const OUT_TRAIL = Object.freeze({
  speed: 6, pace: 1.5,
  run: [12, 25, 12], explore: [120, 180],
  rise: 7, grade: 0.3, spacing: 11, ends: 4, level: 3,
  bump: { m: 1.1, octaves: [[0.55, 0.08], [0.3, 0.22], [0.15, 0.6]], walk: 0.12 },
  // each beat: its DWELL (seconds an explorer spends there), its share of the heartbeat and how wide it reaches (m)
  beats: Object.freeze({
    pinch: { detour: 0, dwell: 4, words: 'the edges close in: the cliff pulls close, a bank rises across' },
    reveal: { detour: 16, dwell: 12, words: 'a climb to a crest, the far side falling away: the view opens' },
    landmark: { dwell: 10, words: 'a great stone, seen from the trailhead, a little off the line' },
    crossing: { detour: 12, dwell: 6, words: 'the trail drops to a stream and fords it' },
    pocket: { dwell: 8, words: 'a dead-end clearing off the spine, a bank round it, something in it' },
    rest: { detour: 0, dwell: 6, words: 'flat ground, the trail wider, the trees standing back' },
    pit: { detour: 12, dwell: 6, words: 'a gap across the trail to jump, or to walk round wide of it' },
  }),
  caps: { pit: 1, crossing: 1, pocket: 2, rest: 1, landmark: 1 },
  pocket: { reach: [9, 14], r: 4.5, berm: 1.3 },
  pit: { w: 2.6, depth: 2.6, wide: 4 },
  stream: { depth: 0.9, w: 1.3, water: 0.42 },
  landmark: { size: 3.6, sizes: [3.6, 4.6, 5.8, 7.2], tall: 2.2, off: [8, 11], ahead: 5 },
});
export const OUT_BEATS = Object.freeze(Object.keys(OUT_TRAIL.beats));
const C = OUT_TRAIL;

/** Read a recipe's `trail` and say what is wrong. → { run, heartbeat, bumpiness, beats: [kind] | null, id }. */
export function readOutTrail(t, depth = 0) {
  if (t === true) t = {};
  if (!t || typeof t !== 'object' || Array.isArray(t)) throw new Error('stage: trail is { run?, heartbeat?, bumpiness?, beats?, after? } (or true)');
  const known = ['id', 'run', 'heartbeat', 'bumpiness', 'beats', 'after', 'bounds'];
  for (const k of Object.keys(t)) if (!known.includes(k)) throw new Error(`stage: trail.${k} is not a trail setting (settings: ${known.join(', ')})`);
  const num = (k, lo, hi, d, words) => {
    if (t[k] === undefined) return d;
    if (typeof t[k] !== 'number' || !(t[k] >= lo && t[k] <= hi)) throw new Error(`stage: trail.${k} is ${words}`);
    return t[k];
  };
  const run = num('run', C.run[0], C.run[1], C.run[2], `the seconds a runner takes to pass through, ${C.run[0]} to ${C.run[1]}`);
  const heartbeat = num('heartbeat', 0, 1, 0.5, 'a number from 0 (level) to 1 (hard climbs and drops)');
  const bumpiness = num('bumpiness', 0, 1, 0.4, 'a number from 0 (smooth) to 1 (rough mounds and hollows)');
  let beats = null;
  if (t.beats !== undefined) {
    if (!Array.isArray(t.beats) || t.beats.length < 3 || t.beats.length > 8) throw new Error('stage: trail.beats is a list of 3 to 8 beats, in walking order');
    for (const b of t.beats) if (!OUT_BEATS.includes(b)) throw new Error(`stage: trail.beats: '${b}' is not a beat (beats: ${OUT_BEATS.join(', ')})`);
    beats = [...t.beats];
  }
  const id = t.id === undefined ? 'trail' : t.id;
  if (typeof id !== 'string' || !/^[a-z][a-z0-9-]{0,31}$/.test(id)) throw new Error('stage: trail.id is a short lower-case name (letters, digits, hyphens)');
  // AFTER: the trail this one follows — its own trail recipe and its stage's `seed`. This trail starts where that one
  // leaves: on its line, at its height, on its last row of ground, its cliff carried on
  let after = null;
  if (t.after !== undefined) {
    if (!t.after || typeof t.after !== 'object' || Array.isArray(t.after)) throw new Error('stage: trail.after is the trail this one follows: its trail recipe and its stage seed, { id, seed?, run?, … }');
    if (depth >= 7) throw new Error('stage: trail.after: a chain of more than eight trails is a section, not a trail');
    const { seed: aSeed, ...rest } = t.after;
    if (aSeed !== undefined && !Number.isFinite(aSeed)) throw new Error('stage: trail.after.seed is the followed trail\'s stage seed (a number)');
    const prev = readOutTrail(rest, depth + 1);
    if (rest.id === undefined || prev.id === id) throw new Error('stage: trail.after names the trail it follows by an id of its own (trail.after.id), not this trail\'s');
    after = { seed: aSeed ?? 1, recipe: rest, id: prev.id };
  }
  return { id, run, heartbeat, bumpiness, beats, ...(after ? { after } : {}), bounds: readBounds(t.bounds) };
}

/** The beats in walking order, drawn by dice when the recipe names none: a reveal, a landmark and a pocket always (a
 *  trail with no dead-end hides nothing), the landmark in
 *  the first half (so the trailhead sees it), never two alike together, nothing over its cap. */
export function drawBeats(n, seed) {
  const pool = ['pinch', 'pinch', 'crossing', 'pocket', 'pocket', 'rest', 'pit', 'reveal'];
  for (let k = 0; k < 64; k++) {
    const r = (i) => hash3(i, k, seed + 907);
    const picks = ['reveal', 'landmark', 'pocket'].slice(0, n), left = pool.filter(() => true);
    for (let i = 0; picks.length < n && left.length; i++) {
      const j = Math.floor(r(i) * left.length), b = left.splice(j, 1)[0];
      if (picks.filter((p) => p === b).length < (C.caps[b] ?? 2)) picks.push(b);
    }
    const order = picks.map((b, i) => [r(40 + i), b]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
    if (beatOrderFaults(order).length === 0) return order;
  }
  return ['landmark', 'pinch', 'reveal', 'pocket', 'crossing', 'rest'].slice(0, Math.max(3, n));
}
/** What is wrong with an order of beats (the grammar's sequence rules). */
export function beatOrderFaults(order) {
  const out = [];
  order.forEach((b, i) => { if (i && order[i - 1] === b) out.push(`two ${b}s together`); });
  for (const [b, cap] of Object.entries(C.caps)) if (order.filter((x) => x === b).length > cap) out.push(`more than ${cap} ${b}`);
  if (order[0] === 'reveal') out.push('a reveal first: there is no climb before it');
  const lm = order.indexOf('landmark');
  if (lm > Math.floor(order.length / 2)) out.push('the landmark is past the middle: the trailhead cannot be drawn by it');
  return out;
}

/**
 * The PLAN of a trail: its spine, its beats at their stations, its heartbeat (rough and smoothed), its stairs runs.
 * `st` is the kit's style card (its trail width, sway and site width); → everything the passes read.
 */
export function planOutTrail(st, T, seed = 1, beatCount = null, join = null) {
  const S = seed | 0, W = st.site.w, L = T.run * C.speed + 2 * C.ends;
  const [a1, f1, a2, f2] = st.trail.sway, ph = 6.2832 * hash3(S, 1, 701);
  const rawX = (y) => W * st.trail.x + a1 * Math.sin(y * f1 + 0.5 + ph) + a2 * Math.sin(y * f2 + 1.3 + ph * 0.7);
  const rawSlope = (y) => a1 * f1 * Math.cos(y * f1 + 0.5 + ph) + a2 * f2 * Math.cos(y * f2 + 1.3 + ph * 0.7);
  // JOINED (a trail `after` another): the line starts on the followed trail's, in its heading, and eases into its own
  // sway over the first `JOIN` metres
  const dx = join ? join.x - rawX(0) : 0, dsl = join ? join.slope - rawSlope(0) : 0;
  const fade = (y) => (y >= JOIN ? 0 : 1 - smooth(0, JOIN, y)), fadeD = (y) => { const t = y / JOIN; return y >= JOIN || y <= 0 ? 0 : (-6 * t * (1 - t)) / JOIN; };
  const trailX = (y) => rawX(y) + fade(y) * (dx + dsl * y);
  const trailSlope = (y) => rawSlope(y) + fadeD(y) * (dx + dsl * y) + fade(y) * dsl;
  // the site is as deep as the spine needs: the arc from 0 to D is the run plus the two ends
  const dy = 0.25, ys = [0], arc = [0];
  for (let y = 0; arc[arc.length - 1] < L; y += dy) { ys.push(y + dy); arc.push(arc[arc.length - 1] + Math.hypot(1, trailSlope(y + dy / 2)) * dy); }
  // a whole number of the ground's cells: every trail's grid on one spacing, so two trails' vertices meet at a seam
  const cell = st.landform.cell, D = Math.ceil(ys[ys.length - 1] / cell - 1e-9) * cell;
  const sOf = (y) => { const k = Math.max(0, Math.min(ys.length - 2, Math.floor(y / dy))), t = (y - ys[k]) / dy; return mix(arc[k], arc[k + 1], Math.max(0, Math.min(1, t))); };
  const yOf = (s) => { let lo = 0, hi = arc.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (arc[m] < s) lo = m; else hi = m; } return mix(ys[lo], ys[hi], (s - arc[lo]) / (arc[hi] - arc[lo] || 1)); };
  // the BEATS: the trailhead and the exit at the ends, the rest evenly between, each nudged by its dice
  const order = T.beats || drawBeats(beatCount || beatRoom(T.run * C.speed), S);
  const s0 = C.ends + C.spacing + 1, s1 = L - C.ends - C.spacing, gap = (s1 - s0) / Math.max(1, order.length - 1);
  const beats = [{ kind: 'trailhead', s: C.ends }];
  // the nudge never brings two beats under the spacing, nor a beat past the first or last station
  const jit = Math.min(0.3 * gap, Math.max(0, gap - C.spacing));
  order.forEach((kind, i) => beats.push({ kind, s: r5(order.length === 1 ? (s0 + s1) / 2 : Math.max(s0, Math.min(s1, s0 + gap * i + (hash3(i, 3, S + 911) - 0.5) * jit))) }));
  beats.push({ kind: 'exit', s: r5(L - C.ends) });
  const count = {};
  for (const b of beats) { count[b.kind] = (count[b.kind] || 0) + 1; b.id = b.kind === 'trailhead' || b.kind === 'exit' ? b.kind : `${b.kind}-${count[b.kind]}`; b.y = r5(yOf(b.s)); }
  // which side a beat's feature takes: away from the cliff (the left), unless the dice put a pocket under it
  for (const [i, b] of beats.entries()) b.side = b.kind === 'pocket' && hash3(i, 5, S + 919) < 0.25 ? -1 : 1;

  // the HEARTBEAT: the height along the spine, from the beats' shapes over a slow drift
  const A = T.heartbeat * C.rise, ds = 0.5, n = Math.ceil(L / ds) + 1;
  const rough = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const s = k * ds; let h = A * 0.3 * (2 * vnoise(s * 0.035, 2.5, S + 921) - 1);
    for (const b of beats) {
      const u = s - b.s;
      if (b.kind === 'reveal') h += A * (u < 0 ? smooth(-20, 0, u) : 1 - 0.7 * smooth(0, 18, u));
      else if (b.kind === 'landmark') h += 0.3 * A * gauss(u, 6);
      else if (b.kind === 'pinch') h -= 0.45 * A * gauss(u, 6);
      else if (b.kind === 'crossing') h -= 0.6 * A * gauss(u, 7);
    }
    rough[k] = h;
  }
  for (const b of beats.filter((q) => q.kind === 'rest' || q.kind === 'trailhead' || q.kind === 'exit')) {
    const hb = rough[Math.round(b.s / ds)];
    for (let k = 0; k < n; k++) rough[k] = mix(rough[k], hb, 1 - smooth(3, 8, Math.abs(k * ds - b.s)));
  }
  // pass 2 on the profile: averaged twice over 6 m (a box of 13 samples), then the stairs where it is still too steep
  const box = (a, w) => { const o = new Float64Array(a.length); for (let k = 0; k < a.length; k++) { let t = 0, c = 0; for (let j = k - w; j <= k + w; j++) if (j >= 0 && j < a.length) { t += a[j]; c++; } o[k] = t / c; } return o; };
  const smoothed = box(box(rough, 6), 6);
  // a pit is jumped from level ground, a ford is waded level: the smoothed walk is laid flat about each, and eased back
  for (const b of beats.filter((q) => q.kind === 'pit' || q.kind === 'crossing')) {
    const hb = smoothed[Math.round(b.s / ds)];
    for (let k = 0; k < n; k++) smoothed[k] = mix(smoothed[k], hb, 1 - smooth(C.level, C.level + 7, Math.abs(k * ds - b.s)));
  }
  // joined, the whole heartbeat stands at the followed trail's height where it leaves
  if (join) { const dz = join.z - smoothed[0]; for (let k = 0; k < n; k++) { rough[k] += dz; smoothed[k] += dz; } }
  const stairs = [];
  for (let k = 1; k < n; k++) {
    const g = Math.abs(smoothed[k] - smoothed[k - 1]) / ds, s = (k - 0.5) * ds, last = stairs[stairs.length - 1];
    if (g <= C.grade) continue;
    if (last && s - last.s1 < 2) last.s1 = s; else stairs.push({ s0: s, s1: s });
  }
  // a run is at least a metre of steps, centred on the steep stretch it was found on
  const runs = stairs.map((r) => (r.s1 - r.s0 >= 1 ? r : { s0: Math.max(0, (r.s0 + r.s1) / 2 - 0.5), s1: Math.min(L, (r.s0 + r.s1) / 2 + 0.5) })).map((r, i) => {
    const h0 = smoothed[Math.round(r.s0 / ds)], h1 = smoothed[Math.round(r.s1 / ds)];
    return { id: `stairs-${i + 1}`, s0: r5(r.s0), s1: r5(r.s1), y0: r5(yOf(r.s0)), y1: r5(yOf(r.s1)), rise: r5(h1 - h0) };
  });
  const at = (a) => (s) => { const k = Math.max(0, Math.min(n - 1, s / ds)), i = Math.floor(k), t = k - i; return i + 1 < n ? mix(a[i], a[i + 1], t) : a[n - 1]; };
  return { id: T.id, T, S, W, D, L, trailX, trailSlope, sOf, yOf, beats, order, profile: { ds, rough, smoothed }, roughAt: at(rough), smoothAt: at(smoothed), stairs: runs, join };
}

/** How many beats a spine of `len` metres holds at the least spacing (3 to 7). */
export const beatRoom = (len) => Math.max(3, Math.min(7, Math.floor((len - 2 * C.ends - 2 * C.spacing - 1) / C.spacing) + 1));

/**
 * THE SITE: the plan's ground, built in passes, in the shape every outdoor builder already reads (nature.js natureSite):
 * the trail and cliff lines, the ground, the grid, the scree, the foci; plus what the grammar adds — `clear` (where no
 * tree stands: the pockets, the rests, the view off a reveal), `gapAt` (where the ribbon breaks: a pit), `rocks` (the
 * landmark), `passes` (each pass's grid, for the board) and `out` (the plan, its hazards and its anchors).
 */
export function outTrailSite(st, recipe, seed = 1) {
  const T = readOutTrail(recipe), join = T.after ? joinOf(outTrailSite(st, T.after.recipe, T.after.seed)) : null;
  if (T.beats) return siteOf(st, planOutTrail(st, T, seed, null, join));
  // drawn beats: as many as the spine holds, fewer while exploring would run past the band (a long trail is a sparse
  // one: the run grows, the exploring stays two or three minutes)
  for (let n = beatRoom(T.run * C.speed); ; n--) {
    const site = siteOf(st, planOutTrail(st, T, seed, n, join));
    if (n <= 3 || exploreSeconds(site) <= C.explore[1]) return site;
  }
}
/** Where a trail leaves, for the one that follows it: its line, heading and height at its far edge, its last row of
 *  ground, its cliff, and where the follower's site sits in the section (`origin`, metres along y). */
function joinOf(prev) {
  const D = prev.D, P = prev.out.plan;
  return { from: P.id, x: prev.trailX(D), slope: P.trailSlope(D), z: P.smoothAt(P.L), cliff: prev.cliffX(D), ground: (x) => prev.ground(x, D), origin: r5(prev.origin + D) };
}
const JOIN = 24, SEAM = 12;

function siteOf(st, plan) {
  const { T, S, W, D, trailX, trailSlope, sOf, beats } = plan;
  const Lf = st.landform, halfW = st.trail.width / 2;
  const at = (kind) => beats.filter((b) => b.kind === kind);
  const near = (b, y, w) => gauss(sOf(y) - b.s, w);
  const halfWAt = (y) => {
    let k = 1 + st.trail.widthVary * (vnoise(y * 0.15, 1.5, S + 81) - 0.5) * 2;
    for (const b of at('rest')) k *= 1 + 0.4 * near(b, y, 4);
    for (const b of at('pinch')) k *= 1 - 0.2 * near(b, y, 4);
    return halfW * k;
  };
  const fringeAt = (y) => st.trail.fringe * (1 + st.trail.fringeVary * (vnoise(y * 0.22, 4.5, S + 83) - 0.5) * 2);
  const lineDist = (x, y) => Math.abs(x - trailX(y)) / Math.sqrt(1 + trailSlope(y) ** 2);
  const edge = (y) => halfWAt(y) + fringeAt(y);
  // the CLIFF breathes with the beats: drawn in at a pinch, pushed back at a reveal
  const cliffRaw = (y) => st.cliff.x + 3 * (vnoise(y * 0.05, 0.5, S + 3) - 0.5);
  const J = plan.join, seamW = (y) => (J ? 1 - smooth(0, SEAM, y) : 0);
  const cliff0 = (y) => cliffRaw(y) + (J ? (1 - smooth(0, JOIN, y)) * (J.cliff - cliffRaw(0)) : 0);
  const cliffX = (y) => {
    let x = cliff0(y);
    const k = 1 - seamW(y);   // (at a seam the followed trail's cliff holds: no beat moves it there)
    for (const b of at('pinch')) x = mix(x, Math.max(x, trailX(y) - edge(y) - 6), k * near(b, y, 5));
    for (const b of at('reveal')) x -= 3 * k * near(b, y, 8);
    return x;
  };
  // the POCKETS: a clearing off the spine, reached by a short spur, a bank round it but for its mouth
  const pockets = at('pocket').map((b, i) => {
    const reach = mix(C.pocket.reach[0], C.pocket.reach[1], hash3(i, 7, S + 931)), x0 = trailX(b.y);
    const cx = x0 + b.side * (edge(b.y) + reach), cy = b.y + (hash3(i, 8, S + 937) - 0.5) * 4;
    return { b, cx: Math.max(-Lf.back + 6, Math.min(W - 6, cx)), cy, mouth: [x0, b.y], r: C.pocket.r };
  });
  const spurDist = (p, x, y) => {
    const [ax, ay] = p.mouth, dx = p.cx - ax, dy = p.cy - ay, l2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
    return Math.hypot(x - ax - t * dx, y - ay - t * dy);
  };
  // the LANDMARK: a great stone off the line, a little ahead of its station, on the open side
  const marks = at('landmark').map((b, i) => {
    const y = Math.min(D - 4, b.y + C.landmark.ahead), off = mix(C.landmark.off[0], C.landmark.off[1], hash3(i, 9, S + 941));
    return { b, y, off, x: Math.min(W - 5, trailX(y) + off), size: C.landmark.size };
  });
  const pits = at('pit').map((b) => ({ b, y: b.y, w: C.pit.w, depth: C.pit.depth }));
  const streams = at('crossing').map((b) => ({ b, y: b.y }));

  // ── pass 1: ROUGH — the heartbeat under the trail, the beats' edges, the bumps ──
  const B = T.bumpiness * C.bump.m;
  const bump = (x, y) => C.bump.octaves.reduce((a, [share, f], i) => a + B * share * (2 * vnoise(x * f, y * f, S + 951 + i) - 1), 0);
  const field = (hAt) => (x, y) => {
    const side = x < trailX(y) ? -1 : 1, d = lineDist(x, y), e = edge(y), out = Math.max(0, d - e);
    let z = hAt(sOf(y)) + (side > 0 ? 0.05 : 0.03) * out;
    for (const b of at('pinch')) if (side > 0) z += (1.6 + 2.4 * T.heartbeat) * gauss(d - e - 2.2, 1.6) * near(b, y, 5);
    for (const b of at('reveal')) if (side > 0) z -= (2 + 4 * T.heartbeat) * smooth(e + 1, e + 14, d) * near(b, y, 9);
    for (const s of streams) z -= C.stream.depth * gauss(y - s.y, C.stream.w);
    for (const p of pockets) {
      const r = Math.hypot(x - p.cx, y - p.cy), floor = hAt(sOf(p.mouth[1])) + 0.1;
      const mouthward = ((p.mouth[0] - p.cx) * (x - p.cx) + (p.mouth[1] - p.cy) * (y - p.cy)) / ((Math.hypot(p.mouth[0] - p.cx, p.mouth[1] - p.cy) || 1) * (r || 1));
      z += C.pocket.berm * gauss(r - p.r - 2.4, 1.1) * smooth(0.55, 0.85, -mouthward + 1.0);
      z = mix(z, floor, Math.max(1 - smooth(p.r, p.r + 3, r), 1 - smooth(1.6, 3.6, spurDist(p, x, y))));
    }
    return z + bump(x, y) * (C.bump.walk + (1 - C.bump.walk) * smooth(e, e + 5, d));
  };
  const grid = () => landformGrid({ x0: -Lf.back, x1: W, y0: 0, y1: D, res: Math.round(D / Lf.cell) + 1 });
  const rough = bakeGrid(grid(), field(plan.roughAt));

  // ── pass 2: SMOOTH — the profile averaged, the ground eased, the walk laid level across, the geology, the pits ──
  const g = bakeGrid(grid(), field(plan.smoothAt));
  for (let it = 0; it < 2; it++) {
    const z = g.z.slice();
    for (let j = 1; j + 1 < g.ny; j++) for (let i = 1; i + 1 < g.nx; i++) {
      let t = 0; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) t += z[(j + b) * g.nx + i + a];
      g.z[j * g.nx + i] = t / 9;
    }
  }
  const walkLevel = (x, y) => { const d = lineDist(x, y), e = edge(y); return 1 - smooth(e + 0.5, e + 3.5, d); };
  for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) {
    const x = gridX(g, i), y = gridY(g, j), q = j * g.nx + i;
    g.z[q] = mix(g.z[q], plan.smoothAt(sOf(y)), walkLevel(x, y));
  }
  const eased = g.z.slice();
  const valley = (x, y) => gridSample({ ...g, z: eased }, x, y);
  const path = []; for (let y = -8; y <= D + 8; y += 2) path.push([cliffX(y), y]);
  applyLandform(g, [
    { op: 'scarp', path, throw: Lf.throw, face: Lf.face, side: 'left', rough: 0.02, taper: 0 },
    { op: 'strata', thickness: Lf.bed, contrast: 0.85, hardShare: 0.5, jitter: 0.4 },
    { op: 'joints', rock: 'granite', spacing: Lf.joint, steep: 40 },
    { op: 'talus', angle: 34, cliff: 50, retreat: Lf.retreat, scree: Lf.scree, rmin: 0.25, rmax: 1.3 },
  ], { seed: `out-trail-${S}` });
  for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) {
    const x = gridX(g, i), y = gridY(g, j), w = smooth(Lf.keep[0], Lf.keep[1], x - cliffX(y)); if (w <= 0) continue;
    const q = j * g.nx + i; g.z[q] = mix(g.z[q], eased[q], w); g.apron[q] *= 1 - w; g.hard[q] *= 1 - w;
  }
  // the walk laid again over the geology: no talus rolls onto it, no scarp lifts it (a pinch brings the cliff close)
  for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) {
    const x = gridX(g, i), y = gridY(g, j), w = walkLevel(x, y); if (w <= 0) continue;
    const q = j * g.nx + i; g.z[q] = mix(g.z[q], plan.smoothAt(sOf(y)), w); g.apron[q] *= 1 - w;
  }
  // the SEAM: a followed trail's last row of ground is this one's first, eased into over `SEAM` metres
  if (J) for (let j = 0; j < g.ny; j++) {
    const y = gridY(g, j), w = seamW(y); if (w <= 0) continue;
    for (let i = 0; i < g.nx; i++) { const q = j * g.nx + i; g.z[q] = mix(g.z[q], J.ground(gridX(g, i)), w); g.apron[q] *= 1 - w; g.hard[q] *= 1 - w; }
  }
  // the PITS, cut last so nothing fills them: across the walk and a little wider, the ground whole beyond (the way round)
  for (const p of pits) for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) {
    const x = gridX(g, i), y = gridY(g, j), d = lineDist(x, y), e = edge(y);
    const k = (1 - smooth(p.w / 2 - 0.35, p.w / 2, Math.abs(y - p.y))) * (1 - smooth(e + C.pit.wide - 2, e + C.pit.wide, d));
    if (k > 0) g.z[j * g.nx + i] -= p.depth * k;
  }
  const ground = (x, y) => gridSample(g, x, y), apronAt = (x, y) => gridSample(g, x, y, g.apron);
  const scree = g.scree.filter((r) => r.x - cliffX(r.y) < Lf.keep[0]).map((r) => ({ ...r, z0: ground(r.x, r.y) }));

  // the site's reading of the trail: a pit is no trail (the ribbon breaks, the ground under it stays)
  const inPit = (y) => pits.some((p) => Math.abs(y - p.y) < p.w / 2);
  const trailDist = (x, y) => (inPit(y) ? 50 : lineDist(x, y));
  const gapAt = (y) => pits.some((p) => Math.abs(y - p.y) < p.w / 2 + 0.2);
  const clear = (x, y) => pockets.some((p) => Math.hypot(x - p.cx, y - p.cy) < p.r + 2 || spurDist(p, x, y) < 3)
    || at('rest').some((b) => Math.hypot(x - trailX(b.y), y - b.y) < 9)
    || at('reveal').some((b) => x > trailX(y) && Math.abs(sOf(y) - b.s) < 10)
    || marks.some((m) => Math.hypot(x - m.x, y - m.y) < m.size + 2)
    || pits.some((p) => Math.abs(y - p.y) < p.w + 2)
    || streams.some((s) => Math.abs(y - s.y) < 3);
  // the foci (where the eye lands, nature.js inRadius): the trailhead, and every beat; a pinch is framed as a gate
  const foci = beats.filter((b) => b.kind !== 'exit').map((b) => ({ name: b.id, y: b.y, r: b.kind === 'trailhead' ? 11 : 9, x: trailX(b.y), ...(b.kind === 'pinch' ? { gate: true } : {}) }));
  const inRadius = (x, y) => foci.some((f) => Math.hypot(x - f.x, y - f.y) < f.r);
  // the landmark is SEEN: from the trailhead if it can be, else from an earlier beat at least 15 m short of it (a crest
  // that shows it); the open side first, then the cliff's, and the least stone that is seen wins
  const eyeOf = (b) => [trailX(b.y), b.y, ground(trailX(b.y), b.y) + 1.7];
  for (const m of marks) {
    const tries = C.landmark.sizes.flatMap((size) => [1, -1].map((side) => ({ size, x: side > 0 ? Math.min(W - 5, trailX(m.y) + m.off) : Math.max(cliffX(m.y) + 6, trailX(m.y) - m.off) })));
    const eyes = beats.filter((b, i) => i === 0 || b.s <= m.b.s - 15).map(eyeOf);
    const seenBy = (c, es) => es.some((e) => sightClear(ground, e, [c.x, m.y, ground(c.x, m.y) + c.size * 0.6 * C.landmark.tall]));
    const ok = tries.find((c) => seenBy(c, eyes.slice(0, 1))) || tries.find((c) => seenBy(c, eyes)) || tries[tries.length - 2];
    m.x = ok.x; m.size = ok.size;
  }
  const rocks = marks.map((m, i) => ({ x: m.x, y: m.y, size: m.size, detail: 1, v: i, role: 'landmark', node: m.b.id, tall: C.landmark.tall }));
  const out = annotate(plan, { pockets, marks, pits, streams, ground, trailX, edge });
  const origin = J ? J.origin : 0;
  const site = { W, D, halfW, halfWAt, fringeAt, trailX, trailDist, cliffX, ground, valley, apronAt, grid: g, scree, foci, inRadius,
    clear, gapAt, rocks, passes: { rough, smooth: g }, out, origin };
  // the BOUNDARY (out-bounds.js): the site's edge as walls with faces; every segment an anchor on this trail
  site.bounds = boundSegments(site, T.bounds, { after: !!J, cliff: !!st.cliff });
  out.anchors.push(...boundAnchors(site, site.bounds).map((a) => ({ ...a, trail: `out-trail:${plan.id}` })));
  return site;
}

/**
 * The ANNOTATION: every beat an anchor at its station (`kind: 'beat'`, `beat`, `s` metres along, `N` the way on), the
 * pockets' reward spots, the landmark, the stairs runs as sites, and every HAZARD: a zone with its `hazard`, its
 * `severity` and the safe place to `respawn` (the last beat before it).
 */
function annotate(plan, { pockets, marks, pits, streams, ground, trailX, edge }) {
  const { beats, trailSlope } = plan;
  const N = (y) => { const l = Math.hypot(trailSlope(y), 1); return [r5(trailSlope(y) / l), r5(1 / l), 0]; };
  const P3 = (x, y, dz = 0) => [r5(x), r5(y), r5(ground(x, y) + dz)];
  const anchors = beats.map((b) => {
    const p = b.kind === 'pocket' ? pockets.find((q) => q.b === b) : null, m = b.kind === 'landmark' ? marks.find((q) => q.b === b) : null;
    return { id: b.id, kind: 'beat', beat: b.kind, s: b.s, at: p ? P3(p.cx, p.cy) : m ? P3(m.x, m.y) : P3(trailX(b.y), b.y), N: N(b.y),
      ...(p ? { mouth: P3(p.mouth[0], p.mouth[1]), r: p.r } : {}), ...(m ? { size: m.size, node: b.id, solid: true } : {}) };
  });
  const before = (y) => { const b = [...beats].filter((q) => q.y < y - 1 && q.kind !== 'pit').pop() || beats[0]; return P3(trailX(b.y), b.y, 0.1); };
  const hazards = [
    ...pits.map((p, i) => {
      const x = trailX(p.y), w = edge(p.y) + C.pit.wide - 1;
      return { id: `hazard-pit-${i + 1}`, kind: 'hazard', hazard: 'pit', severity: 'fall', at: P3(x, p.y), of: p.b.id,
        box: { min: [r5(x - w), r5(p.y - p.w / 2), r5(ground(x, p.y))], max: [r5(x + w), r5(p.y + p.w / 2), r5(ground(x, p.y) + C.pit.depth)] },
        jump: p.w, around: true, respawn: before(p.y) };
    }),
    ...streams.map((s, i) => {
      const x = trailX(s.y);
      return { id: `hazard-water-${i + 1}`, kind: 'hazard', hazard: 'water', severity: 'slow', at: P3(x, s.y), of: s.b.id,
        box: { min: [r5(-plan.W * 0.2), r5(s.y - 1.6), r5(ground(x, s.y) - 0.6)], max: [r5(plan.W), r5(s.y + 1.6), r5(ground(x, s.y) + C.stream.water)] },
        depth: C.stream.water, respawn: before(s.y) };
    }),
  ];
  // a stairs site says its way on (`N`, as a beat does) and its two ends on the walk, so what answers it need not guess
  const sites = plan.stairs.map((r) => ({ id: r.id, kind: 'site', site: 'stairs', at: P3(trailX((r.y0 + r.y1) / 2), (r.y0 + r.y1) / 2), N: N((r.y0 + r.y1) / 2),
    from: P3(trailX(r.y0), r.y0), to: P3(trailX(r.y1), r.y1), s0: r.s0, s1: r.s1, rise: r.rise }));
  // the JUNCTION where a followed trail hands over to this one (as a doorway between rooms): on the seam, the walk's width
  const J = plan.join, tid = `out-trail:${plan.id}`;
  const junction = J ? [{ id: `junction-${J.from}-${plan.id}`, kind: 'junction', between: [`out-trail:${J.from}`, tid], at: P3(trailX(0), 0), N: N(0), width: r5(2 * edge(0)) }] : [];
  // every anchor says which trail it is on (as a room's anchors say their room): ids are a trail's own
  return { plan, anchors: [...junction, ...anchors, ...hazards, ...sites].map((a) => ({ ...a, trail: tid })), hazards, streams, pits };
}

/** The trailhead's frame: the eye at the trailhead, on the landmark when there is one (it is what pulls the walker
 *  on), else along the trail. */
export function outTrailCamera(site) {
  const th = site.out.anchors.find((a) => a.beat === 'trailhead'), lm = site.out.anchors.find((a) => a.beat === 'landmark');
  const eye = [th.at[0], th.at[1], th.at[2] + 1.7], y1 = Math.min(site.D - 2, th.at[1] + 24);
  const look = lm ? [lm.at[0], lm.at[1], lm.at[2] + lm.size * 0.5 * C.landmark.tall] : [site.trailX(y1), y1, site.ground(site.trailX(y1), y1) + 2];
  return { name: 'trailhead', worldFraming: { cameraPosition: eye.map(r5), lookAt: look.map(r5), horizontalFov: 75, pictureCenter: [560, 390] } };
}

/**
 * What a trail adds to its stage's payload: its anchors (every beat, hazard and stairs site) and `outTrail`, the trail
 * as a whole — its id, its length, its run and exploring seconds, its beats in order, its stairs runs and its laws.
 */
export function outTrailPayload(site) {
  const P = site.out.plan;
  return {
    anchors: site.out.anchors,
    colliders: boundColliders(site, site.bounds, `out-trail:${P.id}`),
    outTrail: { id: `out-trail:${P.id}`, length: r5(P.L - 2 * C.ends), run: r5((P.L - 2 * C.ends) / C.speed), explore: exploreSeconds(site),
      heartbeat: P.T.heartbeat, bumpiness: P.T.bumpiness, beats: P.beats.map((b) => ({ id: b.id, beat: b.kind, s: b.s })),
      stairs: P.stairs, laws: outTrailLaws(site).map(({ law, ok, value }) => ({ law, ok, value })),
      // a trail that follows another: which, and where its site sits beside it (the followed one's frame, metres)
      ...(P.join ? { after: `out-trail:${P.join.from}`, origin: [0, site.origin, 0] } : {}) },
  };
}

/** The water a crossing fords: a sheet down the stream's bed across the site, a little over the bed wherever the bed
 *  runs (so it follows the ground as a stream does), sky-tinted, drawn after the bake. */
export function streamFaces(site, st) {
  const out = [], x1 = site.W, n = 40, w = C.stream.w * 0.9;
  for (const s of site.out.streams) {
    // it rises at the cliff's foot (past the talus), and runs out across the valley
    const x0 = site.cliffX(s.y) + (st.cliff ? st.cliff.talus : 3);
    const z = (x) => site.ground(x, s.y) + C.stream.water * 0.55;
    for (let i = 0; i < n; i++) {
      const xa = mix(x0, x1, i / n), xb = mix(x0, x1, (i + 1) / n);
      out.push({ corners: [[xa, s.y - w, z(xa)], [xb, s.y - w, z(xb)], [xb, s.y + w, z(xb)], [xa, s.y + w, z(xa)]].map((p) => p.map(r5)), normal: [0, 0, 1], water: true,
        fill: st.water ? st.water.fill : st.debris ? st.debris.water : '#7f95ab', cornerAlpha: [0.55, 0.55, 0.55, 0.55], group: 'trail:water' });
    }
  }
  return out;
}

/**
 * THE LAWS of a trail, measured: the run through, the exploring time, the beats' spacing and order, the walk's grade
 * off the stairs, every hazard with a way back, and the landmark seen from the trailhead. → [{ law, ok, value, want }].
 */
export function outTrailLaws(site) {
  const P = site.out.plan, { beats, stairs, profile } = P, out = [];
  const law = (id, ok, value, want) => out.push({ law: id, ok: !!ok, value, want });
  const runS = (P.L - 2 * C.ends) / C.speed;
  law('run', runS >= C.run[0] - 0.01 && runS <= C.run[1] + 0.01, r5(runS), `${C.run[0]}–${C.run[1]} s to run through`);
  const ex = exploreSeconds(site);
  law('explore', ex >= C.explore[0] && ex <= C.explore[1], ex, `${C.explore[0]}–${C.explore[1]} s to explore deeply`);
  const gaps = beats.slice(1).map((b, i) => b.s - beats[i].s), least = Math.min(...gaps);
  law('spacing', least >= C.spacing - 0.01, r5(least), `beats at least ${C.spacing} m apart`);
  const faults = beatOrderFaults(P.order);
  law('order', faults.length === 0, faults.join('; ') || 'ok', 'a reveal after a climb, the landmark early, never two alike together');
  const onStairs = (s) => stairs.some((r) => s >= r.s0 - 0.5 && s <= r.s1 + 0.5);
  let steep = 0;
  for (let k = 1; k < profile.smoothed.length; k++) {
    const s = (k - 0.5) * profile.ds, g = Math.abs(profile.smoothed[k] - profile.smoothed[k - 1]) / profile.ds;
    if (!onStairs(s)) steep = Math.max(steep, g);
  }
  law('grade', steep <= C.grade + 1e-9, r5(steep), `the walk off the stairs no steeper than ${C.grade}`);
  const hz = beats.filter((b) => b.kind === 'pit' || b.kind === 'crossing'), onHazard = hz.filter((b) => stairs.some((r) => r.s1 > b.s - C.level && r.s0 < b.s + C.level));
  law('level', onHazard.length === 0, onHazard.map((b) => b.id).join(', ') || hz.length, `a pit or a ford on level ground, no stairs within ${C.level} m`);
  const reveal = beats.filter((b) => b.kind === 'reveal');
  law('crest', reveal.every((b) => P.smoothAt(b.s) >= P.smoothAt(b.s - 12) + 0.25 * P.T.heartbeat * C.rise - 0.05), reveal.length, 'every reveal at the top of a climb');
  law('hazards', site.out.hazards.every((h) => h.respawn && h.severity && (h.hazard !== 'pit' || h.around)), site.out.hazards.length, 'every hazard with a severity, a way round and a respawn');
  const J = P.join;
  if (J) {
    let gap = Math.abs(site.trailX(0) - J.x) + Math.abs(P.trailSlope(0) - J.slope) + Math.abs(P.smoothAt(0) - J.z);
    for (let x = site.grid.x0; x <= site.W; x += 1) gap = Math.max(gap, Math.abs(site.ground(x, 0) - J.ground(x)));
    law('seam', gap < 0.01, r5(gap), `starts where out-trail:${J.from} leaves: its line, heading, height and ground`);
  }
  const bf = boundLaw(site, site.bounds);
  law('bounded', bf.length === 0, bf.join('; ') || site.bounds.length, 'every side walled or open to a seam: nobody walks off the world');
  const lm = site.out.anchors.find((a) => a.beat === 'landmark');
  law('landmark', !lm || seen(site, lm), lm ? lm.id : 'none', 'the landmark seen from the trailhead, or from a beat 15 m or more short of it');
  return out;
}
/** Seconds to explore DEEPLY: the spine at an exploring pace, each beat's dwell, and each beat's feature walked to and
 *  back — the landmark's stone, a pocket's clearing, a reveal's lip, a ford's banks up and down the stream, the way
 *  round a pit (`detour`, metres there and back). */
export function exploreSeconds(site) {
  const P = site.out.plan, A = site.out.anchors;
  const dwell = P.beats.reduce((a, b) => a + (C.beats[b.kind] ? C.beats[b.kind].dwell : 2), 0);
  const detour = A.filter((a) => a.kind === 'beat').reduce((t, a) => {
    if (a.beat === 'pocket') return t + 2 * Math.hypot(a.at[0] - a.mouth[0], a.at[1] - a.mouth[1]);
    if (a.beat === 'landmark') return t + 2 * Math.max(0, Math.hypot(a.at[0] - site.trailX(a.at[1]), 0) - a.size);
    return t + (C.beats[a.beat] ? C.beats[a.beat].detour || 0 : 0);
  }, 0);
  return Math.round((P.L - 2 * C.ends + detour) / C.pace + dwell);
}
// the landmark's top from the trailhead's eye: no ground in between (the trees are the cover pass's, and stand clear)
function seen(site, lm) {
  const eyes = site.out.anchors.filter((a) => a.kind === 'beat' && (a.beat === 'trailhead' || (a.beat !== 'pocket' && a.beat !== 'landmark' && a.s <= lm.s - 15)));
  return eyes.some((e) => sightClear(site.ground, [e.at[0], e.at[1], e.at[2] + 1.7], [lm.at[0], lm.at[1], lm.at[2] + lm.size * 0.6 * C.landmark.tall]));
}
function sightClear(ground, eye, top) {
  for (let k = 1; k < 80; k++) {
    const t = k / 80, x = mix(eye[0], top[0], t), y = mix(eye[1], top[1], t), z = mix(eye[2], top[2], t);
    if (ground(x, y) > z) return false;
  }
  return true;
}
