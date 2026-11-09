/**
 * THE METRO'S TRAFFIC — the old city's "ants" (scene/channels/cars.js, traffic-model.js) at the metro's scale: every
 * arterial's travel lanes a ring its vehicles drive round (out at the land's edge, back in at the other), a signal at
 * every crossing (two exclusive phases and an all-red clearance, the shared model's), each vehicle one of the fleets'
 * (fleets.js: the family cars mostly, a taxi, a delivery van or truck, a bus, a works pickup now and then), stopping at
 * its stop line behind the crosswalk on red, queueing behind the one ahead and pulling away on green.
 *
 * The page runs it (scene/channels/flow.js): one model per lane, stepped only while the camera is within reach of it
 * (a lane far off waits; one come into reach starts from its cycle's last turn of the clock, so the pose at a clock is
 * the clock's), its vehicles drawn as instances only within reach and before the camera. Nothing here is drawn: it is
 * the plan the page drives.
 *
 *   FLOW          the numbers: the model's (metres and seconds), a lane's speed, the spacing its vehicles start at, the mix
 *   flowOf(d, { seed, near }) → { T, signals, lanes, kinds, tints, cars, near } | null: `lanes` each { axis, cross, lo,
 *                 hi, dir, total, speed, crossings, ground: [u, z, …] } (the road's height along it, u the axis
 *                 coordinate ascending), `kinds` each { model, extra?, len, wid }, `cars` each [lane, kind, tint,
 *                 startFrac]; the streetcars' lanes kept to them
 *   flowLaws(F)   → [{ law, ok, value }]: every lane holds its vehicles, the clearance covers the widest box
 *
 * Metres, the design's frame. Pure; seeded dice only.
 */
import { TRAFFIC, buildSignals, pairLanes, laneCapacity, deriveClearance } from '../scene/channels/traffic-model.js';
import { streamOf } from '../city/plan/dice.js';
import { carModel } from '../geotown/cars.js';
import { fleetOf, pickOf } from './fleets.js';
import { HIGHWAY } from './highways.js';

const r2 = (v) => Math.round(v * 100) / 100 + 0, r4 = (v) => Math.round(v * 1e4) / 1e4 + 0;
export const FLOW = Object.freeze({
  // the model's numbers in metres (traffic-model.js TRAFFIC is in the old city's units): a green long enough for a
  // metro's crossing, a stop line past its crosswalk (frontage of the kit's bars, scene.js: 0.6 to 3.6 past the box)
  T: { GREEN: 24, AMBER: 3, STOP_MARGIN: 4.2, MARGIN: 0.2, GAP: 2, ACCEL: 2.5, DT: 1 / 20, MAX_STEPS: 1800 },
  // (MARGIN: two lanes 3.3 m apart, the widest truck's 2.8 m with its mirrors, each grown by it, never touch)
  // a lane's speed (m/s: some 43 km/h), the gap its vehicles start at on average, the lane's own share of it
  speed: 12, spacing: 42, spread: [0.75, 1.35],
  // a highway's (highways.js): faster, its vehicles farther apart, no signal on it
  highway: { speed: 24, spacing: 55 },
  // what drives: each role's share (fleets.js), the core's taxis over it
  mix: [['civilian', 0.84], ['delivery', 0.07], ['taxi', 0.04], ['bus', 0.02], ['utility', 0.02], ['garbage', 0.01]],
  // the road's height along a lane sampled at the drape's cells (scene.js CELL), a kerb's ramp where a lane crosses a walk
  cell: 40, ramp: 0.3,
});

// a paint as the tint over a pale body (linear rgb: cars.js)
const lin = (h) => [1, 3, 5].map((k) => { const c = parseInt(h.slice(k, k + 2), 16) / 255; return r4(c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4); });
const cuts = (a, b, step) => { const n = Math.max(1, Math.ceil((b - a) / step - 1e-9)); return Array.from({ length: n + 1 }, (_, k) => a + ((b - a) * k) / n); };
const runsOf = (spans, lo, hi) => { const out = []; let at = lo; for (const [a, b] of spans.slice().sort((p, q) => p[0] - q[0])) { if (a > at) out.push([at, a]); at = Math.max(at, b); } if (hi > at) out.push([at, hi]); return out; };

/** The metro's traffic, planned: its lanes, its signals, its vehicles. */
export function flowOf(d, { seed = 1, near = 320, kerb = 0.15 } = {}) {
  const S = d.land.S, [lx0, ly0, lx1, ly1] = d.land.rect, NS = d.lines.filter((l) => l.axis === 'ns'), EW = d.lines.filter((l) => l.axis === 'ew');
  if (!NS.length && !EW.length) return null;
  // the road's height along a lane: at each drape cell's edge the road's own (its two kerbs' heights between, as the
  // drape's quad lies), over a crossing's walks a kerb up (an east-west street's walks run over its crossings)
  const across = (l, off, u) => { const R2 = l.road / 2, k = (off + R2) / (2 * R2), at = (o) => (l.axis === 'ns' ? S(l.at + o, u) : S(u, l.at + o)); return at(-R2) + (at(R2) - at(-R2)) * k; };
  const runsNS = runsOf(EW.map((l) => [l.at - l.half, l.at + l.half]), ly0, ly1);
  const groundOf = (l, off) => {
    const pts = [];
    if (l.axis === 'ew') for (const u of cuts(lx0, lx1, FLOW.cell)) pts.push([u, across(l, off, u)]);
    else {
      const x = l.at + off;
      for (const [p, q] of runsNS) for (const u of cuts(p, q, FLOW.cell)) pts.push([u, across(l, off, u)]);
      // (over each east-west street: up its walk, its road, down its far walk)
      for (const b of EW) {
        const R2 = b.road / 2, g = (u) => S(x, u), e = FLOW.ramp;
        pts.push([b.at - b.half + e, g(b.at - b.half) + kerb], [b.at - R2 - e, g(b.at - R2) + kerb], [b.at - R2 + e, g(b.at - R2)], [b.at, g(b.at)], [b.at + R2 - e, g(b.at + R2)], [b.at + R2 + e, g(b.at + R2) + kerb], [b.at + b.half - e, g(b.at + b.half) + kerb]);
      }
    }
    pts.sort((a, b) => a[0] - b[0]);
    const flat = [];
    for (const [u, z] of pts) if (!flat.length || u - flat[flat.length - 2] > 1e-6) flat.push(r2(u), r2(z));
    return flat;
  };
  // the lanes: each travel band but a streetcar's (its tracks kept to it), the land's length
  const raw = [];
  for (const l of d.lines) for (const b of l.bands) {
    if (b.kind !== 'travel' || b.streetcar) continue;
    const off = (b.from + b.to) / 2;
    raw.push({ axis: l.axis === 'ns' ? 'y' : 'x', cross: r4(l.at + off), lo: l.axis === 'ns' ? ly0 : lx0, hi: l.axis === 'ns' ? ly1 : lx1, dir: b.dir, line: l.id, ground: groundOf(l, off) });
  }
  if (!raw.length && !(d.highways ?? []).length && !(d.waterfront ?? []).some((W) => W.boulevard)) return null;
  // what drives: each vehicle a role's (its model, paint and roof), measured
  const kinds = [], kindOf = new Map(), tints = [], tintOf = new Map();
  const pick = (R) => {
    let u = R(), role = FLOW.mix[FLOW.mix.length - 1][0];
    for (const [r, w] of FLOW.mix) { if (u < w) { role = r; break; } u -= w; }
    const v = pickOf(fleetOf(role), R);
    // (a site's machine never drives the arterials)
    if (v.model.startsWith('site:')) return null;
    const key = `${v.model}|${v.extra ?? ''}`;
    if (!kindOf.has(key)) { const M = carModel(v.model); kindOf.set(key, kinds.length); kinds.push({ model: v.model, ...(v.extra ? { extra: v.extra } : {}), len: r2(M.L), wid: r2(M.W) }); }
    if (!tintOf.has(v.paint)) { tintOf.set(v.paint, tints.length); tints.push(lin(v.paint)); }
    return { kind: kindOf.get(key), tint: tintOf.get(v.paint) };
  };
  // each lane's vehicles chosen first (the longest of them sizes the model's boxes), then counted to what it holds
  const picks = raw.map((L, i) => {
    const R = streamOf(seed, 'flow', `${L.line}:${L.cross}`), span = FLOW.spacing * (FLOW.spread[0] + (FLOW.spread[1] - FLOW.spread[0]) * R());
    const want = Math.max(1, Math.round(Math.abs(L.hi - L.lo) / span)), list = [];
    for (let k = 0; k < want * 2 && list.length < want; k++) { const p = pick(R); if (p) list.push(p); }
    return { list, start: R(), i };
  });
  // the highways' lanes (highways.js): each way its lanes on the right of its median by the metro's hand, on its deck,
  // nothing crossing them; their vehicles chosen with the rest (the longest of all sizes the boxes)
  const hand = d.grammar?.traffic === 'left' ? -1 : 1, hw = [], own = new Map();
  for (const h of d.highways ?? []) for (const dir of [1, -1]) for (let k = 0; k < h.lanes; k++) {
    const sg = (h.axis === 'x' ? -dir : dir) * hand, off = sg * (HIGHWAY.median / 2 + HIGHWAY.shoulder + HIGHWAY.lane * (k + 0.5));
    const L = { axis: h.axis, cross: r4(h.at + off), lo: h.lo, hi: h.hi, dir, total: r2(h.hi - h.lo), speed: FLOW.highway.speed, crossings: [], line: h.id, ground: h.stations };
    const R = streamOf(seed, 'flow', `${h.id}:${dir}:${k}`), want = Math.max(1, Math.round(L.total / (FLOW.highway.spacing * (FLOW.spread[0] + (FLOW.spread[1] - FLOW.spread[0]) * R())))), list = [];
    for (let j = 0; j < want * 2 && list.length < want; j++) { const p = pick(R); if (p) list.push(p); }
    own.set(L, { list, start: R() });
    hw.push(L);
  }
  // (the waterfront's boulevard, waterfront.js: two lanes each way along its shore, at the land's edge's height)
  for (const Wf of d.waterfront ?? []) {
    const B = Wf.boulevard;
    if (!B) continue;
    const tc = (B.t0 + B.t1) / 2, axis = Wf.side === 's' || Wf.side === 'n' ? 'x' : 'y', centre = Wf.side === 's' || Wf.side === 'w' ? Wf.edge - tc : Wf.edge + tc;
    const n = Math.max(2, Math.ceil((Wf.a1 - Wf.a0) / 16)), ground = Array.from({ length: n + 1 }, (_, i) => { const u = Wf.a0 + ((Wf.a1 - Wf.a0) * i) / n, z = axis === 'x' ? S(u, Wf.edge) : S(Wf.edge, u); return [r2(u), r2(z)]; }).flat();
    for (const dir of [1, -1]) for (let k = 0; k < B.lanes; k++) {
      const sg = (axis === 'x' ? -dir : dir) * hand, L = { axis, cross: r4(centre + sg * (1 + 3.5 * (k + 0.5))), lo: Wf.a0, hi: Wf.a1, dir, total: r2(Wf.a1 - Wf.a0), speed: FLOW.speed, crossings: [], line: `wf-${Wf.side}`, ground };
      const R = streamOf(seed, 'flow', `wf-${Wf.side}:${dir}:${k}`), want = Math.max(1, Math.round(L.total / (FLOW.spacing * (FLOW.spread[0] + (FLOW.spread[1] - FLOW.spread[0]) * R())))), list = [];
      for (let j = 0; j < want * 2 && list.length < want; j++) { const p = pick(R); if (p) list.push(p); }
      own.set(L, { list, start: R() });
      hw.push(L);
    }
  }
  const T = { ...TRAFFIC, ...FLOW.T, CAR_LEN: Math.max(...kinds.map((k) => k.len)), CAR_WID: Math.max(...kinds.map((k) => k.wid)) };
  // the crossings: each north-south line over each east-west one, its box the two rights-of-way
  const junctions = [];
  for (const a of NS) for (const b of EW) junctions.push({ x: r4(a.at), y: r4(b.at), wx: r4(2 * a.half), wy: r4(2 * b.half) });
  const widest = Math.max(1, ...junctions.map((j) => Math.max(j.wx, j.wy)));
  T.CLEARANCE = deriveClearance(widest, T.CAR_LEN, FLOW.speed, T.ACCEL);
  const signals = buildSignals(junctions, seed >>> 0, { w: d.frame.W, d: d.frame.D }, T);
  const lanes = [...pairLanes(raw, signals, FLOW.speed, T), ...hw];
  const cars = [];
  lanes.forEach((L, li) => {
    const P = own.get(L) ?? picks[raw.findIndex((x) => x.line === L.line && x.cross === L.cross)], lenFor = (k) => kinds[P.list[k].kind].len;
    const n = laneCapacity(L.total, P.list.length, T, L.crossings, lenFor);
    L.cars = n;
    for (let k = 0; k < n; k++) cars.push([li, P.list[k].kind, P.list[k].tint, k ? 0 : r4(P.start)]);
  });
  return {
    T, signals, near, kinds, tints,
    lanes: lanes.map((L) => ({ axis: L.axis, cross: L.cross, lo: r2(L.lo), hi: r2(L.hi), dir: L.dir, total: r2(L.total), speed: L.speed, line: L.line, cars: L.cars, crossings: L.crossings.map((c) => ({ sig: c.sig, sigs: c.sigs, sIn: r2(c.sIn), sOut: r2(c.sOut), sStop: r2(c.sStop) })), ground: L.ground })),
    cars,
  };
}

/** The traffic's laws: every lane holds what it carries (each vehicle's footprint, its gap, its crossings' room), the
 *  all-red clearance long enough for the longest vehicle to clear the widest box. */
export function flowLaws(F) {
  if (!F) return [];
  const T = F.T, over = F.lanes.filter((L, li) => {
    const lens = F.cars.filter((c) => c[0] === li).map((c) => F.kinds[c[1]].len);
    return lens.length > 1 && laneCapacity(L.total, lens.length, T, L.crossings, (k) => lens[k]) < lens.length;
  });
  const widest = Math.max(...F.signals.map((s) => Math.max(s.wx, s.wy))), need = deriveClearance(widest, T.CAR_LEN, FLOW.speed, T.ACCEL);
  return [
    { law: 'flow-holds', ok: !over.length, value: `${F.cars.length} vehicles on ${F.lanes.length} lanes through ${F.signals.length} signals${over.length ? `; over what they hold: ${over.map((L) => `${L.line} at ${L.cross}`).join(', ')}` : ', each lane within what it holds'}` },
    { law: 'flow-clearance', ok: T.CLEARANCE >= need, value: `an all-red of ${T.CLEARANCE} s for a ${T.CAR_LEN} m vehicle across a ${r2(widest)} m box (${need} s needed)` },
  ];
}
