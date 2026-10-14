/**
 * TRACKSCAPE — where a driver's eye needs something, before anything is built. Scapeshift's trail beats (pinch,
 * reveal, landmark, pocket …) read at speed (eye.js: rings in seconds, the eye spot at the look-ahead): a plan of
 * SLOTS, each a place, a ring, the least span that reads there, an interest rank and a beat. No geometry: the kit's
 * set pieces fill the slots (a stand or a castle for a focus, a board for a brake marker), so one plan dresses a GT
 * circuit or a kart track.
 *
 *   a corner is the pocket   braking: a run of boards counting down to the braking point on the approach's outside;
 *                            turn-in: a FOCUS where the gaze lands, beyond the outside of the corner (the ray from the
 *                            eye through the line ahead leaves the road there); exit: a REVEAL down the next straight
 *   a straight carries rhythm   posts or hoardings at a passing period (RHYTHM: a few a second at its speed), the side
 *                            of the corner ahead; POCKETS beside it every few seconds (a stand, a grove), sides
 *                            alternating; a long one gains a SPAN across it (a bridge, a gantry)
 *   the lines are gantries   across the start (a lap's finish too) and a stage's finish
 *   a crest is a reveal      the land falling away beyond it
 *   the lap has a landmark   far, big, seen from the grid and again in the lap (searched round the track, scored by
 *                            the lap's own eye)
 *   the inside of a corner is kept clear   the sight line from turn-in to the apex (`keepClear`), for the dressing
 *
 *   planTrackscape(plan, { cls?, seed?, landmarkMax? }) → { slots, keepClear, corners, straights, landmark }
 *                                           (`landmarkMax`: the least extent, m, of the largest landmark the dressing
 *                                           set can build; the search stays where it would read)
 *   slotThings(slots)                     → things for eye.js (each slot at its least span)
 *   trackscapeLaws(plan, scape, census)   → advisories: every corner focused, no long blank, the landmark seen twice,
 *                                           the rhythm in band, no two focuses framed alike in a row, slots off the
 *                                           road and out of the sight lines
 *
 * Pure, deterministic (the seed only turns the focus forms' wheel).
 */
import { speedPlan, driverEye, cornersOf, eyeSpotAt, DRIVER, TRACK_VEHICLE } from './eye.js';
import { terrainAt } from './track.js';
import { mulberry32 } from '../vegetation/grow.js';

/** Bands off the barrier line (m) a slot of each ring stands in, and the passing period a straight's rhythm keeps. */
export const SCAPE = Object.freeze({
  near: [1.5, 6],        // boards, posts: just past the barrier
  mid: [8, 40],          // set pieces: stands, structures, groves
  focusSpan: 3,          // a focus shows segments: three eye spots across at its read distance
  rhythm: [0.15, 0.4],   // s between things passing on a straight
  longStraight: 5,       // s: a straight this long gains a span across it
  boards: 3,             // the countdown to a braking point
  landmarkSpan: 2,       // eye spots across, far (prominent, and within what a set can build)
  blankMax: 3,           // s: the longest run with nothing to look at
  pocket: 2.5,           // s between set pieces beside a straight
});
/** A focus's form: the kit decides what each is; the plan only keeps them from repeating. */
export const FOCUS_FORMS = Object.freeze(['built', 'natural', 'crowd', 'sign']);

const r3 = (v) => Math.round(v * 1000) / 1000;

export function planTrackscape(plan, { cls = TRACK_VEHICLE[plan.course.class] ?? 'sports', seed = 1, landmarkMax = Infinity } = {}) {
  const a = plan.alignment, X = plan.X, L = a.length, closed = a.closed;
  const line = speedPlan(plan, cls), n = line.length;
  const T = closed ? line[n - 1].t + Math.hypot(line[0].x - line[n - 1].x, line[0].y - line[n - 1].y) / Math.max(0.5, line[n - 1].v) : line[n - 1].t;
  // the centreline sampled, for a point's station and its signed offset (+ left of the way)
  const C = Array.from({ length: Math.max(16, Math.round(L)) + 1 }, (_, i) => a.at(Math.min(L, (i * L) / Math.max(16, Math.round(L)))));
  const nearest = (x, y) => { let b = C[0], d = Infinity; for (const c of C) { const e = (c.x - x) ** 2 + (c.y - y) ** 2; if (e < d) { d = e; b = c; } } return b; };
  const offsetOf = (x, y) => { const c = nearest(x, y); return -(x - c.x) * Math.sin(c.heading) + (y - c.y) * Math.cos(c.heading); };
  const clearOfRoad = (x, y, m) => Math.abs(offsetOf(x, y)) > X.outer + m;
  const ground = (x, y) => (plan.terrain ? terrainAt(plan.terrain, x, y) : 0);
  const side = (st, off) => [st.x - Math.sin(st.heading) * off, st.y + Math.cos(st.heading) * off];
  const lineAt = (t) => { const tt = closed ? ((t % T) + T) % T : Math.max(0, Math.min(t, line[n - 1].t)); let i = 0; while (i < n - 1 && line[i + 1].t <= tt) i++; return line[i]; };
  const rnd = mulberry32((seed * 2654435761) >>> 0);
  const slots = [], keepClear = [];
  // a slot stands off every part of the road (a lap's other leg too, where it passes near: a figure eight); one that
  // would stand on it is dropped (a span stands across it by design)
  let dropped = 0;
  const slot = (beat, ring, xy, interest, span, extra = {}) => {
    if (beat !== 'span' && beat !== 'gantry' && !clearOfRoad(xy[0], xy[1], 0.5)) { dropped++; return; }
    slots.push({ beat, ring, at: [r3(xy[0]), r3(xy[1]), r3(ground(xy[0], xy[1]))], interest, span: r3(span), ...extra });
  };

  // corners and straights: where grip sets the speed, and the runs between (eye.js, the census's own)
  const { corners, straights } = cornersOf(line, cls, closed);

  // ── a corner is the pocket ──
  let lastForm = null;
  for (const [ci, c] of corners.entries()) {
    const out = -c.turn;                                            // the outside: right of a left-hander
    // braking: walk back from turn-in while the speed falls; the boards count down to it on the approach's outside
    let ib = c.i0;
    for (let k = 0; k < n; k++) { const i = (c.i0 - k - 1 + n) % n, q = line[(i + 1) % n]; if (line[i].v <= q.v + 1e-6) break; ib = i; if (!closed && i === 0) break; }
    const pb = line[ib], unit = Math.max(10, Math.round((pb.v * 0.45) / 5) * 5);
    for (let b = 1; b <= SCAPE.boards; b++) {
      const st = a.at(Math.max(0, Math.min(L, nearest(pb.x, pb.y).s - b * unit)));
      if (!closed && st.s <= 0) continue;
      const off = out * (X.outer + (SCAPE.near[0] + SCAPE.near[1]) / 2);
      slot('braking', 'near', side(st, off), 'prop', eyeSpotAt(Math.max(6, pb.v * 1.5)), { count: b, corner: ci, run: SCAPE.boards });
    }
    // turn-in: the gaze from half a second before it, through the line ahead, carried on past the outside edge
    const p = lineAt(c.t0 - 0.5), g = lineAt(c.t0 - 0.5 + DRIVER.gazeAhead);
    const dx = g.x - p.x, dy = g.y - p.y, dl = Math.hypot(dx, dy) || 1;
    let f = null;
    for (let m = dl; m < dl + 300; m += 2) {
      const x = p.x + (dx / dl) * m, y = p.y + (dy / dl) * m;
      if (clearOfRoad(x, y, SCAPE.mid[0])) { f = [x + (dx / dl) * (SCAPE.mid[0] * 0.5), y + (dy / dl) * (SCAPE.mid[0] * 0.5), m]; break; }
    }
    if (f) {
      const forms = FOCUS_FORMS.filter((x) => x !== lastForm), form = forms[Math.floor(rnd() * forms.length)];
      lastForm = form;
      slot('focus', 'mid', f, 'focus', SCAPE.focusSpan * eyeSpotAt(f[2]), { corner: ci, form, facing: r3(Math.atan2(-dy, -dx)) });
    }
    // the inside kept clear: the sight line from turn-in to the apex
    const ap = line[c.apex];
    keepClear.push({ from: [r3(p.x), r3(p.y)], to: [r3(ap.x), r3(ap.y)], corner: ci });
    // exit: a reveal down the next straight, far
    const pe = line[(c.i1 - 1 + n) % n], qe = line[c.i1 % n], hx = qe.x - pe.x, hy = qe.y - pe.y, hl = Math.hypot(hx, hy) || 1;
    const D = Math.max(80, Math.min(500, 3.5 * qe.v));
    let rv = [qe.x + (hx / hl) * D, qe.y + (hy / hl) * D];
    for (let push = 0; push < 200 && !clearOfRoad(rv[0], rv[1], SCAPE.mid[1]); push += 10) {
      const st = nearest(rv[0], rv[1]), o = offsetOf(rv[0], rv[1]) >= 0 ? 1 : -1; rv = side(st, o * (X.outer + SCAPE.mid[1] + push));
    }
    slot('reveal', 'far', rv, 'prop', SCAPE.focusSpan * eyeSpotAt(Math.hypot(rv[0] - qe.x, rv[1] - qe.y)), { corner: ci });
  }

  // ── a straight carries rhythm ──
  for (const [si, s] of straights.entries()) {
    if (s.dur < 1) continue;
    const next = corners.find((c) => c.t0 >= s.t1 - 1e-6) ?? corners[0];
    const out = next ? -next.turn : 1;
    const mid = (SCAPE.rhythm[0] + SCAPE.rhythm[1]) / 2;
    for (let t = s.t0 + mid; t < s.t1 - mid; t += mid) {
      const p = lineAt(t), st = nearest(p.x, p.y);
      slot('rhythm', 'near', side(st, out * (X.outer + SCAPE.near[0])), 'filler', eyeSpotAt(6), { straight: si });
    }
    // pockets: a set piece every `pocket` seconds where the gaze will hold it as it comes. Where the line bends the gaze
    // runs along a chord, and a chord carried on leaves the bend on its OUTSIDE: the piece stands on that ray just past
    // the road (as a corner's focus does). Where the ray never leaves it (a straight), beside it, within 12° of the line
    // two seconds out at that speed (a kart's close, a GT car's back), sides alternating
    let alt = out;
    for (let t = s.t0 + SCAPE.pocket; t < s.t1 - 1; t += SCAPE.pocket) {
      const p = lineAt(t), st = nearest(p.x, p.y), before = lineAt(t - DRIVER.gazeAhead), span = SCAPE.focusSpan * eyeSpotAt(Math.max(20, before.v * 2));
      // the gaze's ray first (the racing line bends where the centreline barely does); a ray that never leaves the road
      // within a few seconds is a straight
      const dx = p.x - before.x, dy = p.y - before.y, dl = Math.hypot(dx, dy) || 1;
      let onRay = null;
      for (let m = dl; m < dl + Math.min(200, 2 * before.v * DRIVER.gazeAhead); m += 2) { const x = before.x + (dx / dl) * m, y = before.y + (dy / dl) * m; if (clearOfRoad(x, y, SCAPE.near[1])) { onRay = [x, y]; break; } }
      if (onRay) { slot('pocket', 'mid', onRay, 'prop', span, { straight: si }); continue; }
      const lat = Math.max(X.outer + SCAPE.near[0], Math.min(X.outer + SCAPE.mid[0], Math.tan((12 * Math.PI) / 180) * before.v * 2));
      slot('pocket', 'mid', side(st, alt * lat), 'prop', span, { straight: si });
      alt = -alt;
    }
    if (s.dur >= SCAPE.longStraight) {
      const p = lineAt((s.t0 + s.t1) / 2), st = nearest(p.x, p.y);
      slot('span', 'mid', [st.x, st.y], 'focus', SCAPE.focusSpan * eyeSpotAt(p.v * 2), { straight: si, across: r3(2 * X.outer), heading: r3(st.heading) });
    }
  }

  // ── the lines: a gantry across the start (a lap's start is its finish), and a stage's finish ──
  const lines = [['start', plan.lines?.start ?? 0], ...(closed ? [] : [['finish', plan.lines?.finish ?? L]])];
  for (const [which, sl] of lines) {
    const st = a.at(Math.max(0, Math.min(L, sl))), p = line.reduce((b, q) => (Math.hypot(q.x - st.x, q.y - st.y) < Math.hypot(b.x - st.x, b.y - st.y) ? q : b));
    slot('gantry', 'mid', [st.x, st.y], 'focus', SCAPE.focusSpan * eyeSpotAt(Math.max(20, p.v * 2)), { line: which, across: r3(2 * X.outer), heading: r3(st.heading) });
  }

  // ── a crest is a reveal ──
  const z = (s) => a.at(closed ? ((s % L) + L) % L : Math.max(0, Math.min(L, s))).z;
  for (let s = 0; s < L; s += 5) {
    const here = z(s), before = z(s - 60), after = z(s + 60);
    if (here - before > 2 && here - after > 2 && here >= z(s - 5) && here >= z(s + 5)) {
      const st = a.at(s), ahead = a.at(Math.min(L, s + 120));
      const off = offsetOf(ahead.x, ahead.y) >= 0 ? -1 : 1;
      slot('reveal', 'far', side(ahead, off * (X.outer + SCAPE.mid[1])), 'prop', SCAPE.focusSpan * eyeSpotAt(150), { crest: r3(st.s) });
    }
  }

  // ── the landmark: far and big, scored by the lap's own eye (seen from the grid, and in the most moments after) ──
  const xs = C.map((c) => c.x), ys = C.map((c) => c.y), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const R = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2;
  // (taller, up to thrice, when the land hides every candidate from the grid: a tower over the hills)
  let landmark = null;
  for (const tall of [1, 2, 3]) {
  if (landmark?.fromGrid) break;
  // candidates: rings round the track, and (where the driver first looks) ahead of the grid, off to either side
  const h0 = Math.atan2(line[1].y - line[0].y, line[1].x - line[0].x), cands = [];
  for (const k of [1.15, 1.5, 2.5]) for (let i = 0; i < 24; i++) { const ang = (i / 24) * 2 * Math.PI; cands.push([cx + Math.cos(ang) * R * k, cy + Math.sin(ang) * R * k]); }
  for (const d of [150, 250, 400, 600]) for (const o of [-150, -60, 60, 150]) cands.push([line[0].x + Math.cos(h0) * d - Math.sin(h0) * o, line[0].y + Math.sin(h0) * d + Math.cos(h0) * o]);
  for (const [x, y] of cands) {
    if (!clearOfRoad(x, y, SCAPE.mid[1])) continue;
    const d = Math.hypot(x - line[0].x, y - line[0].y), span = SCAPE.landmarkSpan * eyeSpotAt(d) * tall;
    if (span > landmarkMax) continue;                                // past what the set can build to read there
    const e = driverEye(plan, [{ kind: 'landmark', interest: 'focus', landmark: true, at: [x, y, ground(x, y) + span / 2], span }], { cls, dt: 0.5, line, ground: plan.terrain ? ground : null });
    const seen = e.samples.filter((sm) => sm.landmark), fromGrid = seen.some((sm) => sm.t < 2);
    const moments = new Set(seen.map((sm) => Math.floor(sm.t / 3))).size;
    const score = (fromGrid ? 100 : 0) + moments;
    if (!landmark || score > landmark.score) landmark = { at: [x, y], span, score, fromGrid, moments };
  }
  }
  if (landmark) slot('landmark', 'far', landmark.at, 'focus', landmark.span, { landmark: true });

  return {
    cls, lap: r3(T), slots, keepClear, dropped,
    corners: corners.map((c) => ({ t: r3(c.t0), dur: r3(c.dur), turn: c.turn, vMin: r3(c.vMin) })),
    straights: straights.map((s) => ({ t: r3(s.t0), dur: r3(s.dur) })),
    landmark: landmark && { at: landmark.at.map(r3), fromGrid: landmark.fromGrid, moments: landmark.moments },
  };
}

/** The slots as things for the eye, each at its least readable span, centred that high over its ground. */
export function slotThings(slots) {
  return slots.map((s) => ({ kind: s.beat, interest: s.interest, at: [s.at[0], s.at[1], s.at[2] + s.span / 2], span: s.span, ...(s.landmark ? { landmark: true } : {}) }));
}

/** The plan's laws, advisory: what the lap's eye found (`census`: driverEye over slotThings), and where slots stand. */
export function trackscapeLaws(plan, scape, census) {
  const out = [], X = plan.X, a = plan.alignment, L = a.length;
  const C = Array.from({ length: Math.round(L) + 1 }, (_, i) => a.at(Math.min(L, i)));
  const off = (x, y) => { let b = C[0], d = Infinity; for (const c of C) { const e = (c.x - x) ** 2 + (c.y - y) ** 2; if (e < d) { d = e; b = c; } } return Math.abs(-(x - b.x) * Math.sin(b.heading) + (y - b.y) * Math.cos(b.heading)); };
  const unfocused = census.corners.filter((c) => !c.focused);
  if (unfocused.length) out.push({ law: 'every-corner-focused', detail: `${unfocused.length} of ${census.corners.length} corners have nothing held in the gaze before turn-in` });
  let run = 0, worst = 0;
  for (const s of census.seconds) { run = s.looked ? 0 : run + 1; worst = Math.max(worst, run); }
  if (worst > SCAPE.blankMax) out.push({ law: 'no-long-blank', detail: `${worst} s in a row with nothing to look at (at most ${SCAPE.blankMax})` });
  const lm = census.samples.filter((s) => s.landmark);
  // (a lap comes round to it again; a stage runs away from it: seen from the start is its whole law)
  const again = plan.alignment.closed ? new Set(lm.map((s) => Math.floor(s.t / 3))).size >= 2 : true;
  if (!lm.some((s) => s.t < 2) || !again) out.push({ law: 'landmark-seen', detail: plan.alignment.closed ? 'the landmark must be seen from the grid and again in the lap' : 'the landmark must be seen from the start' });
  const forms = scape.slots.filter((s) => s.beat === 'focus').map((s) => s.form);
  for (let i = 1; i < forms.length; i++) if (forms[i] === forms[i - 1]) out.push({ law: 'framed-alike', detail: `two corners in a row framed ${forms[i]}` });
  const across = (s) => s.beat === 'span' || s.beat === 'gantry';
  for (const s of scape.slots) if (!across(s) && off(s.at[0], s.at[1]) < X.outer) out.push({ law: 'off-the-road', detail: `a ${s.beat} slot stands on the road` });
  for (const s of scape.slots) for (const k of scape.keepClear) if (!across(s) && segDist(s.at, k.from, k.to) < 2) out.push({ law: 'sight-line-clear', detail: `a ${s.beat} slot stands in corner ${k.corner}'s sight line` });
  return out;
}
function segDist(p, a, b) {
  const vx = b[0] - a[0], vy = b[1] - a[1], l2 = vx * vx + vy * vy || 1, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / l2));
  return Math.hypot(p[0] - a[0] - vx * t, p[1] - a[1] - vy * t);
}
