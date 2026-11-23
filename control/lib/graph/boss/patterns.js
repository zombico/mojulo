/**
 * ATTACK PATTERNS — a boss's attack as a timeline, so every one can be read, drawn and held to the laws a body needs of
 * it (laws.js): its TELL (the wind-up: what the boss does, and each hazard's mark on the ground from the moment it is
 * shown), its HAZARDS (shapes in time, each the harm it does and how it is escaped), and its OPENING (the recovery: the
 * seconds the boss can be hit hard). A pattern is laid in the boss's frame: its origin the boss, +x the way it faces the
 * body it attacks when the pattern starts (the AIM), the body standing `reach` metres down it.
 *
 *   hazard shapes (each { shape, at: s when it lands, for: s it lasts, harm: share of a body's health, mark?: s it is
 *   shown from (0), low?: true (a crouch is under it), cover?: true (a box between its origin and a body stops it),
 *   origin?: 'boss' | 'target' } and its own words):
 *     line    { from: [x, y], to: [x, y], width }            a beam, a charge's lane, a lock's shot
 *     cone    { half, reach }                                a volley's fan down the aim
 *     sweep   { from, to, beam, reach }                      a beam turned across an arc, from angle to angle (radians
 *                                                            off the aim), `beam` its own half width
 *     ring    { from, to, band }                             a shockwave's front, from radius to radius over its time
 *     disc    { at: [x, y] (hazard key `c`), r }             a shell's landing, a slam, a pool
 *     square  { c: [x, y], side }                            a floor tile charged
 *     strafe  { from: [x, y], to: [x, y], r, step }          a run of landings walking down a line, one every `step`
 *                                                            metres through its time (a gunship's rockets)
 *   A `lock` (on a line or a strafe, `track: s`) follows the body until `track` seconds and is fixed there: its end, or the
 *   strafe's line, laid through where the body stood then.
 *
 *   PATTERNS                    the shelf (a new attack is a row)
 *   readPattern(p)              → the pattern checked (throws naming the fault)
 *   layPattern(p, boss, target, t0, rand?) → the hazards in the world: { shape, ..., t0, t1, tm } absolute seconds and
 *                                 metres; `target` the body's place, the aim; a lock laid through the target given
 *   hazardHit(h, x, y, t)       → is a point inside the hazard at that moment (false outside its time)
 *   hazardFoot(h)               → [x0, y0, x1, y1] the ground it can touch, over its whole time
 *
 * layPattern and hazardHit are import-free and pure: the page runs their source (worlds/controllable/boss.js).
 */

const no = (msg) => { throw new Error(`boss pattern: ${msg}`); };
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const SHAPES = Object.freeze({
  line: ['from', 'to', 'width'], cone: ['half', 'reach'], sweep: ['from', 'to', 'beam', 'reach'], ring: ['from', 'to', 'band'],
  disc: ['c', 'r'], square: ['c', 'side'], strafe: ['from', 'to', 'r', 'step'],
});
const COMMON = ['shape', 'at', 'for', 'harm', 'mark', 'low', 'cover', 'origin', 'track', 'says'];

/** the patterns on the shelf. `reach` the distance the pattern is thrown at (the body that far down the aim), `tell` what
 *  the boss does before it, `open` its recovery, `reads` what a body does about it */
export const PATTERNS = Object.freeze({
  // a beam turned across the arc in front: fire from a nozzle, a cutting laser; behind cover, out of its reach, or a dive
  // through it as it passes
  sweep: { reach: 7, tell: { for: 1.1, says: 'braces, and the arc it will cut glows on the floor' },
    hazards: [{ shape: 'sweep', from: -1.05, to: 1.05, beam: 0.16, reach: 10, at: 1.1, for: 1.5, harm: 0.22, cover: true }],
    open: { at: 2.8, for: 1.8 }, reads: 'a beam cut across the arc: behind cover, out of reach, or a dive through it as it passes' },
  // a fan of rounds down the aim: out of its side, or behind cover
  fan: { reach: 10, tell: { for: 1, says: 'levels the weapon; the fan is drawn' },
    hazards: [{ shape: 'cone', half: 0.42, reach: 22, at: 1, for: 0.35, harm: 0.2, cover: true }],
    open: { at: 1.6, for: 1.4 }, reads: 'a volley fanned down the aim: step out of its side, or behind cover' },
  // a charge down a lane through where the body stood, the boss carried with it: out of the lane's side
  charge: { reach: 9, tell: { for: 1, says: 'lowers its shoulder; the lane lights' },
    hazards: [{ shape: 'line', from: [0, 0], to: [16, 0], width: 2.4, at: 1, for: 0.7, harm: 0.25, says: 'the boss along it' }],
    open: { at: 1.9, for: 2.2 }, reads: 'a charge down a lane: out of its side; it overruns and stands winded' },
  // a slam's front rolling out over the floor: out of its reach, or a dive through the front
  ring: { reach: 5, tell: { for: 1.1, says: 'rears up; the floor round it cracks' },
    hazards: [{ shape: 'ring', from: 1, to: 11, band: 1.1, at: 1.1, for: 1.1, harm: 0.2 }],
    open: { at: 2.3, for: 2 }, reads: 'a front rolling out: be past its reach, or dive through it as it comes' },
  // shells, debris or drones falling in a scatter round the body, one after another: out of each mark
  rain: { reach: 9, tell: { for: 0.4, says: 'calls it in; each landing is marked before it comes' },
    hazards: [-1, 0, 1, 2, 3].map((k, i) => ({ shape: 'disc', origin: 'target', c: [[0, 0], [2.6, 2.2], [-2.4, 1.8], [1.8, -2.6], [-2.2, -2.4]][i], r: 1.9, mark: 0.2 + 0.25 * i, at: 1.4 + 0.25 * i, for: 0.35, harm: 0.15 })).slice(0, 5),
    open: { at: 2.8, for: 1.6 }, reads: 'landings marked one after another round the body: out of each mark in turn' },
  // a lock: a line that follows the body, then holds, then fires: break the line behind cover, or step off it once held
  lock: { reach: 14, tell: { for: 1.6, says: 'the lock follows; it holds, and fires' },
    hazards: [{ shape: 'line', from: [0, 0], to: [30, 0], width: 0.9, track: 1.25, at: 1.75, for: 0.12, harm: 0.3, cover: true }],
    open: { at: 2.1, for: 1.5 }, reads: 'a lock that follows and holds before it fires: off its line once it holds, or behind cover' },
  // a run of landings walking down a line through the body (a gunship's rockets): out of its side, or under hard cover
  strafe: { reach: 12, tell: { for: 1.6, says: 'lines up its run; the run is marked down the floor' },
    hazards: [{ shape: 'strafe', from: [-14, 0], to: [14, 0], r: 2.2, step: 2, track: 0.8, at: 1.6, for: 1.4, harm: 0.25, cover: true }],
    open: { at: 3.4, for: 2.4 }, reads: 'a run walked down a line through the body: out of its side, or under hard cover' },
  // the floor's tiles charged in a checker: onto a dark tile before they burn
  grid: { reach: 6, tell: { for: 1.3, says: 'the charged tiles hum and light' },
    hazards: [-1, 0, 1].flatMap((i) => [-1, 0, 1].map((j) => ({ i, j }))).filter(({ i, j }) => (i + j) % 2 === 0).map(({ i, j }) => ({ shape: 'square', origin: 'target', c: [i * 3, j * 3], side: 3, at: 1.3, for: 1.1, harm: 0.2 })),
    open: { at: 2.6, for: 1.6 }, reads: 'tiles charged in a checker round the body: onto an unlit one before they burn' },
  // a beam at chest height cut across the arc: down under it
  scythe: { reach: 6, tell: { for: 1, says: 'draws back at waist height; the arc glows at the chest' },
    hazards: [{ shape: 'sweep', from: 1.2, to: -1.2, beam: 0.2, reach: 9, at: 1, for: 0.9, harm: 0.22, low: true, cover: true }],
    open: { at: 2.1, for: 1.6 }, reads: 'a cut at chest height: down under it, behind cover, or out of its reach' },
});
export const PATTERN_IDS = Object.keys(PATTERNS);

/** Read a pattern's words (a row of PATTERNS, or one of the same shape); → the pattern (throws naming the fault). */
export function readPattern(p, where = 'pattern') {
  if (typeof p === 'string') { if (!PATTERNS[p]) no(`${where}: '${p}' is one of ${PATTERN_IDS.join(', ')}`); return PATTERNS[p]; }
  if (!p || typeof p !== 'object' || !Array.isArray(p.hazards) || !p.hazards.length) no(`${where}: { reach, tell: { for }, hazards: [...], open: { at, for } }`);
  if (!isNum(p.reach) || p.reach <= 0) no(`${where}: reach is the metres the body stands down the aim`);
  if (!p.tell || !isNum(p.tell.for) || p.tell.for < 0) no(`${where}: tell.for is its wind-up's seconds`);
  if (!p.open || !isNum(p.open.at) || !isNum(p.open.for)) no(`${where}: open is its recovery, { at, for } seconds`);
  p.hazards.forEach((h, k) => {
    const S = SHAPES[h.shape];
    if (!S) no(`${where}.hazards[${k}]: shape is one of ${Object.keys(SHAPES).join(', ')}`);
    for (const key of Object.keys(h)) if (!S.includes(key) && !COMMON.includes(key)) no(`${where}.hazards[${k}]: '${key}' is not a ${h.shape}'s word (${[...S, ...COMMON].join(', ')})`);
    for (const key of S) if (h[key] === undefined) no(`${where}.hazards[${k}]: a ${h.shape} has its ${key}`);
    if (!isNum(h.at) || !isNum(h.for) || h.for <= 0) no(`${where}.hazards[${k}]: at and for are seconds`);
    if (!isNum(h.harm) || h.harm <= 0 || h.harm > 1) no(`${where}.hazards[${k}]: harm is a share of a body's health, over 0 to 1`);
  });
  return p;
}

/** Lay a pattern in the world (see the header). `boss` [x, y], `target` [x, y], `t0` when it starts. Import-free. */
export function layPattern(p, boss, target, t0) {
  const dx = target[0] - boss[0], dy = target[1] - boss[1], d = Math.hypot(dx, dy) || 1, fx = dx / d, fy = dy / d, aim = Math.atan2(dy, dx);
  const W = (q, o) => [o[0] + fx * q[0] - fy * q[1], o[1] + fy * q[0] + fx * q[1]];
  const out = [];
  for (const h of p.hazards) {
    const o = h.origin === 'target' ? target : boss, base = { shape: h.shape, harm: h.harm, t0: t0 + h.at, t1: t0 + h.at + h.for, tm: t0 + (h.mark || 0), ...(h.low ? { low: true } : {}), ...(h.cover ? { cover: true, o: [boss[0], boss[1]] } : {}), ...(h.track != null ? { track: t0 + h.track } : {}) };
    if (h.shape === 'line') out.push({ ...base, a: W(h.from, o), b: W(h.to, o), w: h.width });
    else if (h.shape === 'cone') out.push({ ...base, o: [o[0], o[1]], dir: aim, half: h.half, reach: h.reach });
    else if (h.shape === 'sweep') out.push({ ...base, o: [o[0], o[1]], a0: aim + h.from, a1: aim + h.to, beam: h.beam, reach: h.reach });
    else if (h.shape === 'ring') out.push({ ...base, o: [o[0], o[1]], r0: h.from, r1: h.to, band: h.band });
    else if (h.shape === 'disc') out.push({ ...base, c: W(h.c, o), r: h.r });
    else if (h.shape === 'square') out.push({ ...base, c: W(h.c, o), side: h.side, dir: aim });
    else if (h.shape === 'strafe') out.push({ ...base, a: W(h.from, o), b: W(h.to, o), r: h.r, step: h.step });
  }
  return out;
}

/** Is (x, y) inside the hazard at t? (see the header). Import-free. */
export function hazardHit(h, x, y, t) {
  if (t < h.t0 || t > h.t1) return false;
  const u = h.t1 > h.t0 ? (t - h.t0) / (h.t1 - h.t0) : 1;
  const seg = (a, b, w) => { const vx = b[0] - a[0], vy = b[1] - a[1], L2 = vx * vx + vy * vy || 1, s = Math.max(0, Math.min(1, ((x - a[0]) * vx + (y - a[1]) * vy) / L2)); return Math.hypot(x - a[0] - vx * s, y - a[1] - vy * s) <= w / 2; };
  const ang = (o) => Math.atan2(y - o[1], x - o[0]), wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  switch (h.shape) {
    case 'line': return seg(h.a, h.b, h.w);
    case 'cone': { const r = Math.hypot(x - h.o[0], y - h.o[1]); return r <= h.reach && Math.abs(wrap(ang(h.o) - h.dir)) <= h.half; }
    case 'sweep': { const r = Math.hypot(x - h.o[0], y - h.o[1]), a = h.a0 + (h.a1 - h.a0) * u; return r <= h.reach && Math.abs(wrap(ang(h.o) - a)) <= h.beam; }
    case 'ring': { const r = Math.hypot(x - h.o[0], y - h.o[1]), at = h.r0 + (h.r1 - h.r0) * u; return Math.abs(r - at) <= h.band / 2; }
    case 'disc': return Math.hypot(x - h.c[0], y - h.c[1]) <= h.r;
    case 'square': { const c = Math.cos(-h.dir), s = Math.sin(-h.dir), lx = (x - h.c[0]) * c - (y - h.c[1]) * s, ly = (x - h.c[0]) * s + (y - h.c[1]) * c; return Math.abs(lx) <= h.side / 2 && Math.abs(ly) <= h.side / 2; }
    case 'strafe': {
      // (the landings so far down the line, each burning a moment: the last half second's)
      const L = Math.hypot(h.b[0] - h.a[0], h.b[1] - h.a[1]), n = Math.max(1, Math.floor(L / h.step)), dt = (h.t1 - h.t0) / n;
      for (let k = 0; k <= n; k++) { const tk = h.t0 + k * dt; if (t < tk || t > tk + 0.5) continue; const q = [h.a[0] + ((h.b[0] - h.a[0]) * k) / n, h.a[1] + ((h.b[1] - h.a[1]) * k) / n]; if (Math.hypot(x - q[0], y - q[1]) <= h.r) return true; }
      return false;
    }
  }
  return false;
}

/** the ground a hazard can touch over its whole time: [x0, y0, x1, y1] */
export function hazardFoot(h) {
  const box = (pts, pad) => [Math.min(...pts.map((p) => p[0])) - pad, Math.min(...pts.map((p) => p[1])) - pad, Math.max(...pts.map((p) => p[0])) + pad, Math.max(...pts.map((p) => p[1])) + pad];
  switch (h.shape) {
    case 'line': return box([h.a, h.b], h.w / 2);
    case 'strafe': return box([h.a, h.b], h.r);
    case 'disc': return box([h.c], h.r);
    case 'square': return box([h.c], (h.side * Math.SQRT2) / 2);
    case 'ring': return box([h.o], h.r1 + h.band / 2);
    default: return box([h.o], h.reach);
  }
}
