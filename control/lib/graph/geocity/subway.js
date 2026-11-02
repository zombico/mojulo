/**
 * THE SUBWAY UNDER A GEOCITY — a line (network/subway.js) laid under one of its arterials (the flatter spine over its
 * span, unless it names one), through its evocation: the
 * line's frame turned to the street's axis (a north-south street's line runs north, an east-west one's east), its
 * stations in a row under the carriageway round the evocation's middle, its track bed under the street's lowest ground
 * along it by the line's depth, its tunnels between them, each station's way out a stair up to the street's sidewalk.
 *
 *   subwayUnder(d, { S, kerb }) → { line, axis, faces, colliders, wells, anchors, cameras, readout }
 *     d      the geocity's design (geocity/design.js): its spec's `subway`, its lines, its evocation, its blocks
 *     S      (x, y) → the street's ground; kerb the walk's height over it
 *     wells  [[x0, y0, x1, y1]]: where each entrance's stairwell opens in the walk (the city cuts its walk there)
 *
 * Metres, z up. Pure: the line follows from its street, its evocation and its settings.
 */
import { laySubway } from '../network/subway.js';

const r5 = (v) => Math.round(v * 1e5) / 1e5 + 0;
const P3 = (p) => p.map(r5);

/** The arterial a line runs under: its `along` (a line's id, or a spine), else the flatter spine over the span `at`
 *  ([t0, t1] along each axis round the evocation's middle: a line keeps to the contour where it can). */
export function subwayStreet(d, along = 'spine', { S = null, mid = null, total = 0 } = {}) {
  const lines = d.lines, spineOf = (axis) => lines.find((l) => l.axis === axis && l.rank === 'spine');
  const fall = (l) => { if (!S || !l) return Infinity; const m = l.axis === 'ns' ? mid[1] : mid[0], zs = []; for (let t = m - total / 2; t <= m + total / 2; t += 8) zs.push(l.axis === 'ns' ? S(l.at, t) : S(t, l.at)); return Math.max(...zs) - Math.min(...zs); };
  const flatter = () => [spineOf('ns'), spineOf('ew')].filter(Boolean).sort((a, b) => fall(a) - fall(b) || (a.axis < b.axis ? 1 : -1))[0];
  const l = along === 'spine' ? flatter() : along === 'ns-spine' ? spineOf('ns') : along === 'ew-spine' ? spineOf('ew') : lines.find((x) => x.id === along);
  if (!l) throw new Error(`geocity: subway.along '${along}' is not one of its arterials (${lines.map((x) => x.id).join(', ')})`);
  if (l.kind?.oneway) throw new Error(`geocity: subway.along '${l.id}' is one of a one-way pair: a line runs under a two-way street`);
  return l;
}

export function subwayUnder(d, { S, kerb = 0.15 }) {
  const SP = d.spec.subway, n = SP.stations ?? 2, len = 72, gap = SP.gap ?? 120, total = n * len + (n - 1) * gap;
  // (centred on the evocation's middle along the street, kept on its land)
  const blockOf = new Map(d.regions.flatMap((r) => r.blocks).map((b) => [b.id, b])), shown = (d.evoked?.blocks ?? []).map((id) => blockOf.get(id)).filter(Boolean);
  const centre = shown.length ? [(Math.min(...shown.map((b) => b.rect[0])) + Math.max(...shown.map((b) => b.rect[2]))) / 2, (Math.min(...shown.map((b) => b.rect[1])) + Math.max(...shown.map((b) => b.rect[3]))) / 2] : d.seat;
  const l = subwayStreet(d, SP.along, { S, mid: centre, total }), ns = l.axis === 'ns', mid = ns ? centre[1] : centre[0];
  const [lo, hi] = ns ? [d.land.rect[1], d.land.rect[3]] : [d.land.rect[0], d.land.rect[2]];
  const t0 = r5(Math.max(lo + 40, Math.min(hi - 40 - total, mid - total / 2)));
  // the line's frame: x across the street, y along it, turned to the street's axis
  const W = ns ? ([x, y, z]) => [l.at + x, t0 + y, z] : ([x, y, z]) => [t0 + y, l.at - x, z];
  const N = ns ? ([x, y, z]) => [x, y, z] : ([x, y, z]) => [y, -x, z];
  const ground = (x, y) => { const [wx, wy] = W([x, y, 0]); return S(wx, wy) + kerb; };
  // (each station's track bed under the street's lowest ground over it, by the line's depth; where two would grade the
  // tunnel between them steeper than a rail's grade, the higher one let down)
  const depth = SP.depth ?? 14, most = (gap - 3) / 30;
  const zs = Array.from({ length: n }, (_, i) => { let low = Infinity; for (let y = i * (len + gap) - 10; y <= i * (len + gap) + len + 10; y += 4) low = Math.min(low, ground(0, y) - kerb); return low - depth; });
  for (let pass = 0; pass < n; pass++) for (let i = 0; i + 1 < n; i++) { if (zs[i + 1] > zs[i] + most) zs[i + 1] = zs[i] + most; if (zs[i] > zs[i + 1] + most) zs[i] = zs[i + 1] + most; }
  const z0 = zs.map(r5);
  const { along: _a, stations: _n, depth: _d, gap: _g, plan, line } = SP;
  const stations = Array.from({ length: n }, (_, i) => ({ id: `${l.id}-s${i + 1}`, ...(plan ? { plan: i === n - 1 && plan === 'terminus' ? 'terminus' : plan === 'terminus' ? 'island' : plan } : {}) }));
  const out = (l.road / 2 + l.half) / 2;
  const L = laySubway({ stations, gap, ...(line ? { line } : {}) }, { z0, ground, entrance: 'sidewalk', out, kerb: { at: l.road / 2, h: kerb } });
  // ── into the city's frame: every face, box, walk and camera ──
  const face = (f) => ({ ...f, corners: f.corners.map((c) => P3(W(c))), ...(f.normal ? { normal: P3(N(f.normal)) } : {}), ...(f.outNormal ? { outNormal: P3(N(f.outNormal)) } : {}) });
  const box = (c) => { const a = W(c.min), b = W(c.max); return { min: P3([Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])]), max: P3([Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])]), of: `subway:${c.of}` }; };
  const pts = (ps) => ps.map((p) => P3(W(p)));
  const rect = (q) => { const a = W([q[0], q[1], 0]), b = W([q[2], q[3], 0]); return P3([Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])]); };
  const faces = [...L.stations.flatMap((s) => s.faces), ...L.tunnels.flatMap((t) => t.faces), ...L.entrances.flatMap((e) => e.faces)].map(face);
  const colliders = [...L.stations.flatMap((s) => s.colliders), ...L.tunnels.flatMap((t) => t.colliders), ...L.entrances.flatMap((e) => e.colliders)].map(box);
  const wells = L.entrances.map((e) => rect(e.well));
  const anchors = [
    ...L.stations.map((s) => ({ id: `station-${s.id}`, kind: 'station', plan: s.plan, platforms: s.routes.platforms.map(pts), up: s.routes.up.map(pts) })),
    ...L.tunnels.map((t) => ({ id: `rail-${t.id}`, kind: 'rail-tunnel', from: `station-${t.a}`, to: `station-${t.b}`, length: t.length, walk: pts(t.walk) })),
    ...L.entrances.map((e) => ({ id: `entrance-${e.id}`, kind: 'entrance', station: `station-${e.station}`, walk: pts(e.walk), door: P3(W(e.door)) })),
  ];
  // (its cameras: down a platform, into a tunnel from a platform's end, the first entrance from the walk and down it)
  const cam = (name, from, to, fov = 70) => ({ name, worldFraming: { cameraPosition: P3(W(from)), lookAt: P3(W(to)), horizontalFov: fov } });
  const S0 = L.stations[0], lane = S0.routes.platforms[0], T0 = L.tunnels[0], E0 = L.entrances[0];
  const cameras = [
    cam('subway-platform', [lane[2][0], lane[2][1] - 1, lane[2][2] + 1.7], [lane[0][0] * 0.3, lane[0][1] + 10, lane[0][2] + 1.6]),
    ...(T0 ? [cam('subway-tunnel', [T0.walk[3][0], T0.walk[3][1] + 6, T0.walk[3][2] + 1.7], [T0.axis, T0.walk[3][1] + 60, T0.walk[3][2] + 1.2])] : []),
    ...(E0 ? [cam('subway-entrance', [E0.door[0] - Math.sign(E0.door[0]) * 5, E0.door[1] + E0.N[1] * 9, E0.door[2] + 1.7], [E0.door[0], E0.door[1] - E0.N[1] * 4, E0.door[2] - 0.5], 65),
      cam('subway-stair', [E0.walk[3][0], E0.walk[3][1], E0.walk[3][2] + 1.7], [E0.walk[2][0], E0.walk[2][1], E0.walk[2][2] + 1])] : []),
  ];
  const readout = {
    along: l.id, axis: l.axis, depth: r5(depth), z0, gap, section: L.section,
    stations: L.stations.map((s) => ({ id: s.id, ...s.readout })),
    tunnels: L.tunnels.map((t) => ({ id: t.id, length: t.length, cover: t.cover, grade: t.grade, ...(t.findings.length ? { findings: t.findings } : {}) })),
    entrances: L.entrances.map((e) => ({ id: e.id, rise: e.rise, steps: e.steps })),
  };
  return { line: l, axis: l.axis, span: [t0, t0 + total].map(r5), faces, colliders, wells, anchors, cameras, readout, tunnels: L.tunnels, stations: L.stations };
}
