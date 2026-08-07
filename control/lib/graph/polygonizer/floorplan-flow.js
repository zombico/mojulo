// ── floorplan-flow — the movement field over the placement field ─────────────
// A diagnostic + repair stage that runs DOWNSTREAM of generateProgramPlan, over the
// plan object it already emits ({ rooms, halls, doors, stairZone, … }). It does NOT
// touch the generator: every lever it needs (the wing-mouth, the entry door, room
// door midpoints) is a field in the returned `doors` array, so a plan→plan rewrite
// suffices. Design + rationale in floorplan-movement-flow.plan.md.
//
//   assessFlow(plan)   → { impairment, necessary[], preferential[], ok }   (pure check)
//   repairFlow(plan)   → { plan, repairs }   (pure plan→plan; clears NECESSARY faults)
//   selectBestPlan(…)  → the best-effort-of-N-seeds wrapper (Tier A)
//
// Where livability (floorplan-livability.plan.md) asks "where does this sit", this asks
// "how does a body move through it" — and reports the FAULTS (impairments), not a style
// score. Two classes: NECESSARY (cheap to repair, normally cleared) and PREFERENTIAL
// (minimized by seed selection, tolerated). Nothing is ever hard-rejected — the operator
// can force a draw that carries impairment (CLAUDE.md: assessments surface, the operator
// owns the consequence).

import { generateProgramPlan, assessLivability } from './floorplan-glyphs.js';
import {
  openAlongAxis as alongAxis, openAcrossAxis as acrossAxis, openAlong as along, openAcross as across,
  bbox, pointInRect, rectSpan, overlap1d as overlap,
} from '../worlds/movement-flow.js';

// bounding box of the tiled footprint (rooms + halls), since the plan carries no fp.
const planFootprint = (plan) => bbox([...(plan.rooms || []), ...(plan.halls || [])]);
const entryDoor = (plan) => (plan.doors || []).find((d) => d.entry) || null;

// ── detectors ────────────────────────────────────────────────────────────────

// AXIAL THROUGH-SHOT (NECESSARY) — the entry pierces in a straight line to a far
// opening (the core→hall wing-mouth, or a rear exterior door): a body/draught runs
// straight in and deep. Only a GENUINELY deeper opening on the entry's pierce axis
// counts (a same-wall terrace door is not a pierce), so we gate on a depth gap.
function detectThroughShot(plan, opts) {
  const entry = entryDoor(plan);
  if (!entry) return null;
  const ax = alongAxis(entry), band = opts.shotBand ?? 3;
  for (const d of plan.doors) {
    if (d === entry || alongAxis(d) !== ax) continue;
    const deeper = Math.abs(across(d) - across(entry)) > 4;          // genuinely further into the plan
    const isFar = (d.onto === 'core' && d.kind === 'cased') || d.exterior;
    if (deeper && isFar && Math.abs(along(d) - along(entry)) < band) {
      return { target: d, entry, ax, delta: along(d) - along(entry) };
    }
  }
  return null;
}

// OPPOSING-DOOR CONFRONTATION (NECESSARY) — two room doors open head-on across the
// same hall (their openings on opposite hall walls, along-coords aligned). The classic
// bedroom-door-faces-bathroom-door clash.
function detectConfrontations(plan, opts) {
  const band = opts.faceBand ?? 1.5, hits = [];
  const hd = (plan.doors || []).filter((d) => d.onto === 'hall');
  for (let i = 0; i < hd.length; i += 1) {
    for (let j = i + 1; j < hd.length; j += 1) {
      const a = hd[i], b = hd[j];
      if (alongAxis(a) !== alongAxis(b)) continue;
      if (Math.abs(across(a) - across(b)) < 2) continue;             // same wall → not facing
      if (Math.abs(along(a) - along(b)) < band) hits.push([a, b]);
    }
  }
  return hits;
}

// OCCLUDED CENTER (PREFERENTIAL) — dead mass (the stair, or a bathroom) sits on the
// home's geometric centroid, where light/circulation want to be.
function detectOccludedCenter(plan) {
  const fp = planFootprint(plan);
  const cx = (fp.x0 + fp.x1) / 2, cy = (fp.y0 + fp.y1) / 2;
  const s = plan.stairZone;
  if (s && cx >= s.x0 && cx <= s.x1 && cy >= s.y0 && cy <= s.y1) return { kind: 'stair' };
  for (const r of plan.rooms) if (r.glyph === 'W' && pointInRect(cx, cy, r)) return { kind: 'bath' };
  return null;
}

// WET-ROOM IN REST CORNER (PREFERENTIAL) — a W/Y squats the far-diagonal corner from
// the entry (the deepest rest point), which a draining room should yield to a lounge/bed.
function detectWetRestCorner(plan) {
  const entry = entryDoor(plan);
  if (!entry) return null;
  const fp = planFootprint(plan);
  const ax = alongAxis(entry), dax = acrossAxis(entry);
  const [aLo, aHi] = ax === 'x' ? [fp.x0, fp.x1] : [fp.y0, fp.y1];
  const [dLo, dHi] = dax === 'x' ? [fp.x0, fp.x1] : [fp.y0, fp.y1];
  const farD = Math.abs(entry[dax] - dLo) < Math.abs(entry[dax] - dHi) ? dHi : dLo;   // depth end away from entry
  const farA = (entry[ax] - aLo) > (aHi - entry[ax]) ? aLo : aHi;                      // along side away from entry
  const qa = (aHi - aLo) * 0.34, qd = (dHi - dLo) * 0.34;
  const cA = farA === aLo ? [aLo, aLo + qa] : [aHi - qa, aHi];
  const cD = farD === dLo ? [dLo, dLo + qd] : [dHi - qd, dHi];
  for (const r of plan.rooms) {
    if (r.glyph !== 'W' && r.glyph !== 'Y') continue;
    const [rA0, rA1] = rectSpan(r, ax), [rD0, rD1] = rectSpan(r, dax);
    if (overlap(rA0, rA1, cA[0], cA[1]) > 0 && overlap(rD0, rD1, cD[0], cD[1]) > 0) return { glyph: r.glyph };
  }
  return null;
}

// ENTRY CHOKE (PREFERENTIAL) — no breath of space on entry: the cell the front door
// opens into is shallow, so a wall is in your face. The open core normally prevents this.
function detectEntryChoke(plan, opts) {
  const entry = entryDoor(plan);
  if (!entry) return null;
  const r = plan.rooms[entry.room];
  if (!r) return null;
  const depth = alongAxis(entry) === 'x' ? r.h : r.w;                // across-depth of the entered cell
  const min = opts.chokeDepth ?? 7;
  return depth < min ? { depth } : null;
}

// ── assess ─────────────────────────────────────────────────────────────────—

/**
 * Pure movement-flow CHECK over a generated plan. Mirrors assessLivability's shape:
 * @returns {{ impairment:number, necessary:{rule,detail}[], preferential:{rule,detail}[], ok:boolean }}
 *   ok = no NECESSARY impairment remains. `impairment` is a coarse penalty (lower better).
 */
export function assessFlow(plan, opts = {}) {
  const necessary = [], preferential = [];
  const shot = detectThroughShot(plan, opts);
  if (shot) necessary.push({ rule: 'axial-through-shot', detail: `entry pierces straight to a ${shot.target.onto === 'core' ? 'core mouth' : 'rear opening'} (Δ${shot.delta.toFixed(1)}ft)` });
  for (const _ of detectConfrontations(plan, opts)) necessary.push({ rule: 'opposing-door-confrontation', detail: 'two hall doors open head-on' });
  const occ = detectOccludedCenter(plan);
  if (occ) preferential.push({ rule: 'occluded-center', detail: `${occ.kind} sits on the home's centroid` });
  const wet = detectWetRestCorner(plan);
  if (wet) preferential.push({ rule: 'wet-room-rest-corner', detail: `${wet.glyph} squats the far rest corner` });
  const choke = detectEntryChoke(plan, opts);
  if (choke) preferential.push({ rule: 'entry-choke', detail: `only ${choke.depth.toFixed(1)}ft clear ahead of the entry` });
  return { impairment: necessary.length * 10 + preferential.length * 3, necessary, preferential, ok: necessary.length === 0 };
}

// ── repair ───────────────────────────────────────────────────────────────────

const clonePlan = (plan) => ({
  ...plan,
  doors: (plan.doors || []).map((d) => ({ ...d })),
  rooms: (plan.rooms || []).map((r) => ({ ...r })),
  halls: (plan.halls || []).map((h) => ({ ...h })),
});

// slide the pierced far opening (the wing-mouth) OFF the entry axis, so the path bends
// (the AL/2 lever; the `shiftLineOut` move on a door). Clamped within the footprint span.
function repairThroughShot(plan, hit, opts) {
  const fp = planFootprint(plan);
  const ax = hit.ax;
  const [lo, hi] = ax === 'x' ? [fp.x0, fp.x1] : [fp.y0, fp.y1];
  const m = hit.target, half = (m.width ?? 3) / 2 + 0.5, clear = 1.5;
  const ea = hit.entry[ax], want = (opts.shotBand ?? 3) + 1.5;
  const loRoom = ea - (lo + clear + half), hiRoom = (hi - clear - half) - ea;
  let t = hiRoom >= loRoom ? ea + want : ea - want;
  t = Math.max(lo + clear + half, Math.min(hi - clear - half, t));
  m[ax] = t;
}

// stagger one of two confronting doors within its own room's wall span.
function repairConfrontation(plan, pair, opts) {
  const want = (opts.faceBand ?? 1.5) + 0.6;
  const nudge = (d, dir) => {
    const r = plan.rooms[d.room];
    if (!r) return false;
    const ax = alongAxis(d), [lo, hi] = rectSpan(r, ax), half = (d.width ?? 3) / 2 + 0.4;
    const t = Math.max(lo + half, Math.min(hi - half, d[ax] + dir * want));
    if (Math.abs(t - d[ax]) < 0.2) return false;
    d[ax] = t; return true;
  };
  const [a, b] = pair, axb = alongAxis(b);
  const dir = b[axb] >= a[alongAxis(a)] ? 1 : -1;
  return nudge(b, dir) || nudge(a, -dir);
}

/**
 * Pure plan→plan rewrite that clears the NECESSARY impairments (door-position faults).
 * PREFERENTIAL faults are geometry-bound (would re-tile a room) and are NOT repaired
 * here — they are reduced by seed selection (selectBestPlan). @returns { plan, repairs }.
 */
export function repairFlow(plan, opts = {}) {
  const p = clonePlan(plan);
  let repairs = 0;
  for (let guard = 0; guard < 8; guard += 1) {
    const shot = detectThroughShot(p, opts);
    if (shot) { repairThroughShot(p, shot, opts); repairs += 1; continue; }
    const conf = detectConfrontations(p, opts);
    if (conf.length && repairConfrontation(p, conf[0], opts)) { repairs += 1; continue; }
    break;
  }
  return { plan: p, repairs };
}

// ── select best (Tier A) ──────────────────────────────────────────────────────

/**
 * Best-effort-of-N: generate a few seed variants, repair NECESSARY faults on each, keep
 * the lowest-impairment livable draw. The only mechanism for the geometry-bound
 * PREFERENTIAL rules (occluded-center, wet-rest-corner). Falls back to the base seed if
 * none clear livability. Deterministic: variant seeds are derived from `seed`.
 * @returns {{ plan, seed, score, flow }}
 */
export function selectBestPlan(seed, genOpts = {}, flowOpts = {}) {
  const n = flowOpts.candidates ?? 5;
  let best = null;
  for (let i = 0; i < n; i += 1) {
    const s = (((seed >>> 0) + i * 0x9e3779b1) >>> 0) || 1;
    const repaired = repairFlow(generateProgramPlan(s, genOpts), flowOpts).plan;
    if (!assessLivability(repaired).ok) continue;
    const flow = assessFlow(repaired, flowOpts);
    if (!best || flow.impairment < best.score) best = { plan: repaired, seed: s, score: flow.impairment, flow };
  }
  if (!best) {
    const repaired = repairFlow(generateProgramPlan(seed, genOpts), flowOpts).plan;
    best = { plan: repaired, seed, score: assessFlow(repaired, flowOpts).impairment, flow: assessFlow(repaired, flowOpts) };
  }
  return best;
}
