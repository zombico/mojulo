/**
 * teardown — a piece taken apart and put together IN ORDER, read off what it already knows; nothing authored.
 *
 * A workbench `frames` entry already orders itself for its instruction manual (construction/manual.js manualPlan:
 * fit steps, then join steps, each with the parts it adds and the way they seat) and already knows its exploded view
 * (construction/frame.js explodeParts: each member back along its seat, a sub-assembly back as one, a piece with its
 * host). The teardown joins the two: every term of the exploded view moves on the manual step that seats it, so the
 * exploded pose is the frame's own `explode` and the order is the manual's.
 *
 *   teardownPlan(spec, { distance? })   → { subject, id, unit, k, steps, terms, rides, owners, lock }
 *     steps   the manual's fit and join steps: [{ n, kind, parts, pieces, dir }]
 *     terms   [{ id, step, d }]: part `id` is `d` (the frame's unit) out from where it rests when step `step` is undone
 *     rides   { piece: host }: a loose piece moves with its host, then on its own term
 *     owners  { faceGroup: part }: face groups drawn for a part (a cushion's cord and buttons)
 *     k       the distance: `distance`, else 12% of the piece's largest side
 *   teardownTracks(plan, { show, seconds, hold, sample })
 *     show 'disassemble' (the last step seated comes off first), 'assemble' (the same tracks, reversed in time),
 *     'exploded' (every term at once) → { show, seconds, steps: [{ n, t0, t1 }], tracks: [{ id, frames: [{ t, off }] }] }
 *     `off` is the part's displacement from where it rests, in the frame's unit.
 *   teardownPose(plan, { at? })   → Map part → offset after the first `at` steps are undone (all of them by default)
 *   poseFaces(faces, pose, owners) → the faces moved by a pose (the frame's own rule for which part a face is)
 *
 * Pure: the same piece gives the same bytes. Slides only: nothing falls, so no dice.
 */
import { manualPlan } from '../../construction/manual.js';
import { explodeParts } from '../../construction/frame.js';

export const TEARDOWN_SHOWS = Object.freeze(['exploded', 'disassemble', 'assemble']);
export const TEARDOWN_DEFAULTS = Object.freeze({ share: 0.12, seconds: 0.6, hold: 0.25, sample: 1 / 30 });

const r5 = (x) => Math.round(x * 1e5) / 1e5 + 0;
const ease = (u) => 1 - (1 - u) * (1 - u) * (1 - u);   // collapse.js's spread ease: out fast, settle slow

function largestSide(faces) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) for (const c of f.corners) for (let i = 0; i < 3; i++) { if (c[i] < lo[i]) lo[i] = c[i]; if (c[i] > hi[i]) hi[i] = c[i]; }
  return Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
}

/** A frames entry's teardown: the manual's steps, and the exploded view's terms each on the step that seats it. */
export function teardownPlan(spec, { distance } = {}) {
  const plan = manualPlan(spec), low = plan.low, { report, seat, parts } = low;
  const k = Number.isFinite(distance) && distance > 0 ? distance : r5(TEARDOWN_DEFAULTS.share * largestSide(low.faces));
  const steps = plan.steps.filter((s) => s.kind === 'fit' || s.kind === 'join').map((s) => ({
    n: s.n, kind: s.kind, parts: s.kind === 'join' ? [...s.adds] : [...s.hosts], pieces: [...s.pieces], dir: s.dir || null,
  }));
  const softIds = new Set((low.soft || []).map((L) => L.id));
  const memberIds = new Set(report.members.map((m) => m.id));
  const assembly = { ...report.assembly, moves: seat };
  const X = explodeParts(assembly, {
    k, order: assembly.order || report.members.map((m) => m.id), isPart: (id) => memberIds.has(id) || softIds.has(id),
    pieces: parts.map((p) => ({ id: p.id, host: p.host })), soft: softIds.size > 0,
  });
  // the step that seats each thing: a part where it is first added; a sub-assembly where it joins as one; a piece where
  // it goes in (else with its host); anything the manual never moves goes on the first step
  const firstAdd = new Map(), pieceStep = new Map();
  for (const s of steps) { if (s.kind === 'join') for (const id of s.parts) if (!firstAdd.has(id)) firstAdd.set(id, s.n); for (const p of s.pieces) if (!pieceStep.has(p)) pieceStep.set(p, s.n); }
  const first = steps.length ? steps[0].n : 1;
  const subStep = (sa) => { const s = steps.find((x) => x.kind === 'join' && sa.parts.every((id) => x.parts.includes(id))); return s ? s.n : Math.max(...sa.parts.map((id) => firstAdd.get(id) ?? first)); };
  const terms = [];
  for (const [id, d] of X.self) terms.push({ id, step: firstAdd.get(id) ?? first, d });
  for (const sa of X.subs) { const n = subStep(sa); for (const id of sa.parts) terms.push({ id, step: n, d: sa.d.map((x) => -x) }); }
  const rides = {};
  for (const p of X.pieces) { rides[p.id] = p.host; terms.push({ id: p.id, step: pieceStep.get(p.id) ?? firstAdd.get(p.host) ?? first, d: p.d.map((x) => -x) }); }
  const owners = {};
  for (const L of low.soft || []) for (const g of L.extras) owners[g] = L.id;
  return { subject: 'frame', id: plan.id, unit: plan.unit, k, steps, terms, rides, owners, lock: report.assembly.lock || null };
}

// the offset of every part with `share(step)` of each term applied; a piece adds its host's
function offsets(plan, share) {
  const own = new Map();
  for (const t of plan.terms) {
    const s = share(t.step); if (s === 0) continue;
    const o = own.get(t.id) || [0, 0, 0];
    own.set(t.id, s === 1 ? o.map((x, i) => x + t.d[i]) : o.map((x, i) => x + t.d[i] * s));
  }
  const out = new Map();
  for (const [id, o] of own) if (!(id in plan.rides)) out.set(id, o);
  for (const [p, host] of Object.entries(plan.rides)) {
    const h = out.get(host), o = own.get(p);
    if (h || o) out.set(p, (h || [0, 0, 0]).map((x, i) => x + (o ? o[i] : 0)));
  }
  return out;
}

/** The pose after the first `at` steps are undone (the last seated first); all of them by default: the exploded view. */
export function teardownPose(plan, { at } = {}) {
  const ns = plan.steps.map((s) => s.n), undone = new Set(at == null ? ns : ns.slice(ns.length - Math.max(0, at)));
  const known = new Set(ns);
  return offsets(plan, (n) => (undone.has(n) || (at == null && !known.has(n)) ? 1 : 0));
}

/** Move faces by a pose: a face belongs to its group's part (a soft part's extras to it, rebar to its member). */
export function poseFaces(faces, pose, owners = {}) {
  return faces.map((f) => {
    const g = f.group, o = pose.get(owners[g] || g) || pose.get(String(g).replace(/:rebar$/, ''));
    return o ? { ...f, corners: f.corners.map((c) => [c[0] + o[0], c[1] + o[1], c[2] + o[2]]) } : f;
  });
}

/** The teardown played: per-part offset tracks on one clock. */
export function teardownTracks(plan, { show = 'disassemble', seconds = TEARDOWN_DEFAULTS.seconds, hold = TEARDOWN_DEFAULTS.hold, sample = TEARDOWN_DEFAULTS.sample } = {}) {
  if (!TEARDOWN_SHOWS.includes(show)) throw new Error(`teardown: show must be one of ${TEARDOWN_SHOWS.join(', ')}`);
  // disassembly: the last step seated comes off first, each step `seconds` then a `hold`
  const order = show === 'exploded' ? [] : [...plan.steps].reverse();
  const slot = new Map(order.map((s, j) => [s.n, j * (seconds + hold)]));
  const T = show === 'exploded' ? seconds + hold : order.length * (seconds + hold);
  const at = (t) => offsets(plan, (n) => ease(Math.min(1, Math.max(0, (t - (slot.get(n) ?? 0)) / seconds))));
  const times = [];
  for (let i = 0; i * sample < T - 1e-9; i++) times.push(i * sample);
  times.push(T);
  const ids = [...offsets(plan, () => 1).keys()];
  const frames = new Map(ids.map((id) => [id, []]));
  for (const t of times) {
    const o = at(show === 'assemble' ? T - t : t);
    for (const id of ids) frames.get(id).push({ t: r5(t), off: (o.get(id) || [0, 0, 0]).map(r5) });
  }
  const steps = (show === 'assemble' ? [...order].reverse() : show === 'exploded' ? plan.steps : order).map((s) => {
    const t0 = show === 'exploded' ? 0 : show === 'assemble' ? T - slot.get(s.n) - seconds : slot.get(s.n);
    return { n: s.n, t0: r5(t0), t1: r5(t0 + seconds) };
  });
  return { show, seconds: r5(T), steps, tracks: ids.map((id) => ({ id, frames: frames.get(id) })) };
}
