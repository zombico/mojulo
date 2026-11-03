/**
 * time — a shot's TIME MAP: how the world's clock plays on the screen's. A shot shows its span of the world; by default
 * one world second a screen second (or its constant `speed`, plan.js). A time map says more:
 *
 *   shot.time:  [{ span: [t0, t1], speed, ramp? }   that stretch of the world at a speed (0.05 … 4): slow motion under
 *                                                    1, faster over it; `ramp` world seconds at each end where the speed
 *                                                    eases from the shot's own to this one and back (a speed ramp: the
 *                                                    speed changes evenly on the screen's clock)
 *                | { at: t, hold }]                the world held at an instant for `hold` screen seconds (a freeze, an
 *                                                    impact's beat); `frames` reads as frames at the plan's fps
 *   shot.clock: 'screen'                            the camera's keys read on the screen's clock from the span's start, so
 *                                                    it moves at its own pace while the world holds or crawls (bullet time);
 *                                                    absent, the camera is the world's (its keys are world instants)
 *   shot.grain: 2 | 3                               the world shown on twos or threes at the plan's fps (limited
 *                                                    animation), the camera on ones
 *
 * World instants are the world's clock (as a shot's span); every moment lies inside its shot's span. Presentation, not
 * simulation: the map changes what the screen shows of the world, never how the world steps.
 *
 *   normalizeTime(shot, { fps, warn }) → { time?, clock?, grain? }   the canonical fields, empty when there are none
 *   warped(shot)                       → does the shot carry any of them
 *   timeline(shot, fps)                → { length, pieces: [{ u0, len, t0, s0, s1 }], step?, screen? } compiled: the
 *                                        speed in a piece runs evenly from s0 to s1 on the screen's clock (a hold: 0, 0)
 *   clocksAt(tl, span, u)              → { t, camera_t } at u screen seconds into the shot
 *   timelineReadout(shot, tl)          → { world_s, slowest, held_s?, grain?, clock? }
 *
 * Pure and deterministic; a shot without a map is not compiled here (plan.js and sample.js keep its old arithmetic).
 */
export const MIN_SPEED = 0.05, MAX_SPEED = 4, MAX_HOLD = 10, MAX_MOMENTS = 16, GRAINS = [1, 2, 3];
const fin = (v) => typeof v === 'number' && Number.isFinite(v);
const r4 = (v) => Math.round(v * 1e4) / 1e4;
const CLOCK_WORDS = { screen: 'screen', program: 'screen', real: 'screen', camera: 'screen', world: null };
const GRAIN_WORDS = { ones: 1, twos: 2, threes: 3, 1: 1, 2: 2, 3: 3 };

/** Does a shot carry a time map, a screen clock or a grain? */
export const warped = (s) => !!(s && (s.time || s.clock || s.grain));

/**
 * The canonical time fields of a raw shot whose span is already read: moments sorted by their world instant, each
 * inside the span, slowed stretches not overlapping (a later one is dropped), holds anywhere (inside a stretch too).
 * Words: `{ slow: [t0, t1] }` or `{ from, to }` for a stretch's span; `freeze: t` for a hold's instant, `for` or
 * `frames` for its length; `clock: 'screen' | 'program' | 'camera'`; `grain: 'ones' | 'twos' | 'threes'`.
 */
export function normalizeTime(s, { fps = 24, warn = () => {}, name = 'shot' } = {}) {
  const [a, b] = s.span, out = {};
  const inside = (t) => Math.max(a, Math.min(b, t));
  if (s.time != null) {
    const raw = Array.isArray(s.time) ? s.time : [s.time];
    if (raw.length > MAX_MOMENTS) warn(`${name}: only the first ${MAX_MOMENTS} time moments are kept`);
    const stretches = [], holds = [];
    raw.slice(0, MAX_MOMENTS).forEach((m, i) => {
      if (!m || typeof m !== 'object') { warn(`${name}: time moment ${i} is not an object, dropped`); return; }
      const span = Array.isArray(m.span) ? m.span : Array.isArray(m.slow) ? m.slow : (fin(m.from) && fin(m.to) ? [m.from, m.to] : null);
      const at = fin(m.at) ? m.at : fin(m.freeze) ? m.freeze : null;
      if (span && span.length === 2 && span.every(fin)) {
        const t0 = inside(span[0]), t1 = inside(span[1]);
        if (!(t1 > t0)) { warn(`${name}: time moment ${i} spans no world time inside the shot [${a}, ${b}], dropped`); return; }
        if (!(fin(m.speed) && m.speed >= MIN_SPEED && m.speed <= MAX_SPEED)) { warn(`${name}: time moment ${i} needs a speed ${MIN_SPEED}–${MAX_SPEED}, dropped`); return; }
        const ramp = fin(m.ramp) && m.ramp > 0 ? Math.min(m.ramp, (t1 - t0) / 2) : 0;
        if (fin(m.ramp) && m.ramp > (t1 - t0) / 2) warn(`${name}: time moment ${i}'s ramp is longer than half its span, ramped over half`);
        stretches.push({ span: [r4(t0), r4(t1)], speed: m.speed, ...(ramp > 0 ? { ramp: r4(ramp) } : {}) });
      } else if (at !== null) {
        const hold = fin(m.hold) ? m.hold : fin(m.for) ? m.for : fin(m.frames) ? m.frames / fps : null;
        if (!(hold > 0)) { warn(`${name}: time moment ${i} holds the world at ${at}s for no time, dropped`); return; }
        if (at < a || at > b) warn(`${name}: time moment ${i} holds the world at ${at}s, outside the shot [${a}, ${b}]; held at its edge`);
        if (hold > MAX_HOLD) warn(`${name}: time moment ${i} holds ${hold}s, held ${MAX_HOLD}s`);
        holds.push({ at: r4(inside(at)), hold: r4(Math.min(MAX_HOLD, hold)) });
      } else warn(`${name}: time moment ${i} is neither a stretch { span, speed } nor a hold { at, hold }, dropped`);
    });
    stretches.sort((x, y) => x.span[0] - y.span[0]);
    const kept = [];
    for (const m of stretches) {
      if (kept.length && m.span[0] < kept.at(-1).span[1]) { warn(`${name}: the stretch from ${m.span[0]}s overlaps the one before it, dropped`); continue; }
      kept.push(m);
    }
    const time = [...kept, ...holds].sort((x, y) => (x.at ?? x.span[0]) - (y.at ?? y.span[0]) || (x.at !== undefined ? -1 : 1));
    if (time.length) out.time = time;
  }
  if (s.clock != null) {
    const c = CLOCK_WORDS[String(s.clock).toLowerCase()];
    if (c === undefined) warn(`${name}: unknown clock '${s.clock}', the camera keeps the world's`);
    else if (c) out.clock = c;
  }
  if (s.grain != null) {
    const g = GRAIN_WORDS[String(s.grain).toLowerCase()];
    if (!g) warn(`${name}: grain is ones, twos or threes (1, 2, 3); '${s.grain}' played on ones`);
    else if (g > 1) out.grain = g;
  }
  return out;
}

// the screen time a piece takes to cover `w` world seconds, its speed running evenly from s0 to s1
const lenOf = (w, s0, s1) => (2 * w) / (s0 + s1);
// screen seconds into a moving piece at which it has covered w world seconds (the even-acceleration root)
function untilCovered(p, w) {
  const k = (p.s1 - p.s0) / p.len;
  if (Math.abs(k) < 1e-12) return w / p.s0;
  return (-p.s0 + Math.sqrt(Math.max(0, p.s0 * p.s0 + 2 * k * w))) / k;
}

/** A shot's time map compiled to pieces on its screen clock (see the header); `fps` sets a grain's step. */
export function timeline(s, fps = 24) {
  const [a, b] = s.span, base = s.speed || 1, moving = [];
  let w = a;
  const run = (to, s0, s1) => { if (to > w + 1e-12) { moving.push({ t0: w, w: to - w, s0, s1 }); w = to; } };
  for (const m of (s.time || []).filter((x) => x.span)) {
    const [t0, t1] = m.span, r = m.ramp || 0;
    run(t0, base, base);
    if (r > 0) run(t0 + r, base, m.speed);
    run(t1 - r, m.speed, m.speed);
    if (r > 0) run(t1, m.speed, base);
  }
  run(b, base, base);
  // the pieces on the screen's clock, the holds cut in at their instants
  const holds = (s.time || []).filter((x) => x.at !== undefined), pieces = [];
  let u = 0, h = 0;
  const cutHolds = (upTo) => { while (h < holds.length && holds[h].at <= upTo + 1e-12) { pieces.push({ u0: u, len: holds[h].hold, t0: holds[h].at, s0: 0, s1: 0 }); u += holds[h].hold; h++; } };
  for (const m of moving) {
    let p = { t0: m.t0, s0: m.s0, s1: m.s1, len: lenOf(m.w, m.s0, m.s1) }, end = m.t0 + m.w;
    cutHolds(p.t0);
    while (h < holds.length && holds[h].at < end - 1e-12) {
      // split the piece where the world reaches the hold's instant, then hold
      const du = untilCovered(p, holds[h].at - p.t0), mid = p.s0 + ((p.s1 - p.s0) * du) / p.len;
      pieces.push({ u0: u, len: du, t0: p.t0, s0: p.s0, s1: mid }); u += du;
      p = { t0: holds[h].at, s0: mid, s1: p.s1, len: p.len - du };
      cutHolds(p.t0);
    }
    pieces.push({ u0: u, ...p }); u += p.len;
  }
  cutHolds(b);
  return { length: u, pieces, ...(s.grain > 1 ? { step: s.grain / fps } : {}), ...(s.clock === 'screen' ? { screen: true } : {}) };
}

/**
 * The world's clock and the camera's u screen seconds into a shot whose time map is `tl` and span `span`. Import-free:
 * the World page's shoot channel runs this very source (its toString), so the page and the kernel read one map alike.
 */
export function clocksAt(tl, span, u) {
  const x = Math.max(0, Math.min(tl.length, u));
  const shown = tl.step && x < tl.length - 1e-9 ? Math.floor(x / tl.step + 1e-9) * tl.step : x;
  const worldAt = (v) => {
    if (v >= tl.length - 1e-12) return span[1];
    let i = 0;
    while (i + 1 < tl.pieces.length && tl.pieces[i + 1].u0 <= v) i++;
    const p = tl.pieces[i], d = Math.min(p.len, v - p.u0);
    return Math.min(span[1], p.t0 + (p.len > 0 ? p.s0 * d + ((p.s1 - p.s0) * d * d) / (2 * p.len) : 0));
  };
  const t = worldAt(shown);
  return { t, camera_t: tl.screen ? span[0] + x : tl.step ? worldAt(x) : t };
}

/** A warped shot in the readout's words: its world seconds, the slowest speed it plays, the screen seconds it holds. */
export function timelineReadout(s, tl) {
  const span = s.span;
  const moving = tl.pieces.filter((p) => p.s0 + p.s1 > 0);
  const holds = tl.pieces.filter((p) => p.s0 + p.s1 === 0);
  return {
    world_s: r4(span[1] - span[0]), slowest: r4(Math.min(...moving.flatMap((p) => [p.s0, p.s1]))),
    ...(holds.length ? { held_s: r4(holds.reduce((n, p) => n + p.len, 0)) } : {}),
    ...(s.grain ? { grain: s.grain } : {}), ...(s.clock ? { clock: s.clock } : {}),
  };
}
