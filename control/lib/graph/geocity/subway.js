/**
 * THE SUBWAY UNDER A GEOCITY — a line (network/subway.js) laid under one of its arterials (the flatter spine over its
 * span, unless it names one), through its evocation: the
 * line's frame turned to the street's axis (a north-south street's line runs north, an east-west one's east), its
 * stations in a row under the carriageway round the evocation's middle, its track bed under the street's lowest ground
 * along it by the line's depth, its tunnels between them, each station's way out a stair up to the street's sidewalk.
 *
 *   subwayPlan(d, { S, kerb }) → the line placed: its street, frame, track beds, and its stations as nodes (`nodes`)
 *   subwayUnder(d, { S, kerb, plan?, links? }) → { line, axis, faces, colliders, wells, anchors, cameras, readout, ports }
 *     d      the geocity's design (geocity/design.js): its spec's `subway`, its lines, its evocation, its blocks
 *     S      (x, y) → the street's ground; kerb the walk's height over it
 *     wells  [[x0, y0, x1, y1]]: where each entrance's stairwell opens in the walk (the city cuts its walk there)
 *
 * Metres, z up. Pure: the line follows from its street, its evocation and its settings.
 */
import { laySubway, levelOfLine } from '../network/subway.js';
import { STATION_PLANS } from '../network/station-plans.js';

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

/**
 * The line placed before it is built: its street, its frame, each station's track bed and its hall in the city, and each
 * station as a node another network's passages may join (its mezzanine's reach along its hall clear of its street
 * entrance's way out, both its walls: network/edges.js), so the PATH under the city meets its platforms.
 */
export function subwayPlan(d, { S, kerb = 0.15 }) {
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
  // (a downtown's line is cut and cover by default: side platforms, shallow; an island's lies deeper)
  const planId = SP.plan ?? 'side', depth = SP.depth ?? (STATION_PLANS[planId].exit === 'sides' ? 10 : 14), most = (gap - 3) / 30;
  const zs = Array.from({ length: n }, (_, i) => { let low = Infinity; for (let y = i * (len + gap) - 10; y <= i * (len + gap) + len + 10; y += 4) low = Math.min(low, ground(0, y) - kerb); return low - depth; });
  for (let pass = 0; pass < n; pass++) for (let i = 0; i + 1 < n; i++) { if (zs[i + 1] > zs[i] + most) zs[i + 1] = zs[i] + most; if (zs[i] > zs[i + 1] + most) zs[i] = zs[i + 1] + most; }
  const { line } = SP;
  const stations = Array.from({ length: n }, (_, i) => ({ id: `${l.id}-s${i + 1}`, plan: planId === 'terminus' ? (i === n - 1 ? 'terminus' : 'island') : planId }));
  // each station's node: its hall in the city, and the reach a passage may leave it by (a mezzanine's beyond its street
  // entrance's way out; a side platform's wall past its middle's)
  const MEZZ = 12, sideName = (sg) => (ns ? (sg > 0 ? '+x' : '-x') : (sg > 0 ? '-y' : '+y'));
  const rectOf = (x0, y0, x1, y1) => { const a = W([x0, y0, 0]), b = W([x1, y1, 0]); return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])].map(r5); };
  const nodes = stations.map((st, i) => {
    const P = STATION_PLANS[st.plan ?? 'island'], hw = P.width / 2, y = i * (len + gap);
    // (a mezzanine's reach beyond its street way out; a side platform's wall either side of its street way out's middle)
    const reaches = P.exit === 'mezzanine' ? [P.mezzanine === '-y' ? [5.2, MEZZ - 0.3] : [len - MEZZ + 0.3, len - 5.2]] : [[6, len / 2 - 3], [len / 2 + 3, len - 6]];
    return { id: st.id, rect: rectOf(-hw, y, hw, y + len), door: 3.6, rooms: reaches.map((r, k) => ({ id: `reach-${k}`, rect: rectOf(-hw + 0.3, y + r[0], hw - 0.3, y + r[1]), sides: [sideName(1), sideName(-1)] })), station: true, at: y };
  });
  // (the stations' own joins: each to the next by its running tunnels, for a network's every-node-reached)
  const rails = stations.slice(1).map((st, i) => ({ a: stations[i].id, b: st.id, cover: Infinity, slab: Infinity, grade: 0, length: 0 }));
  return { SP, l, ns, n, len, gap, total, t0, W, N, ground, kerb, z0: zs.map(r5), depth, line, stations, nodes, rails, MEZZ, sideName };
}

/** The line built: its stations with their ways out (each station's street entrance, and each `link` another network
 *  asked of it: `{ <station id>: [{ side: '+x' | …, u (along that side, the city's), width, id }] }`), its tunnels, its
 *  entrances; everything turned into the city's frame, each link's way out handed back in the city (`ports`). */
export function subwayUnder(d, { S, kerb = 0.15, plan = null, links = {} }) {
  const PL = plan ?? subwayPlan(d, { S, kerb }), { l, n, len, gap, total, t0, W, N, ground, z0, depth, line, stations, MEZZ, sideName } = PL;
  const ns = PL.ns;
  // (a link's side and its place along the city's side, in the station's own frame)
  const exits = Object.fromEntries(stations.map((st, i) => {
    const P = STATION_PLANS[st.plan ?? 'island'], mzEnd = P.mezzanine === '+y', y = i * (len + gap);
    const street = P.exit === 'mezzanine' ? (mzEnd ? [len - 4.5, len - 1.5] : [1.5, 4.5]) : [len / 2 - 1.5, len / 2 + 1.5];
    const own = (links[st.id] ?? []).map((k) => {
      const sg = k.side === sideName(1) ? 1 : -1, sl = (ns ? k.u - t0 : k.u - t0) - y;
      return { side: sg, s0: r5(sl - k.width / 2), s1: r5(sl + k.width / 2), id: `path-${k.id}` };
    });
    // (a way out to the street: one from a mezzanine; one from each side platform, on each side of the street)
    const streets = P.exit === 'sides' ? [1, -1].map((sg, k) => ({ side: sg, s0: street[0], s1: street[1], id: `street-${k}` })) : [{ side: 1, s0: street[0], s1: street[1], id: 'street-0' }];
    return [st.id, [...streets, ...own]];
  }));
  const out = (l.road / 2 + l.half) / 2;
  const L = laySubway({ stations, gap, ...(line ? { line } : {}), ...(PL.SP.tunnels ? { tunnels: PL.SP.tunnels } : {}) }, { z0, ground, entrance: 'sidewalk', out, kerb: { at: l.road / 2, h: kerb }, exits, mezzDepth: MEZZ });
  // ── into the city's frame: every face, box, walk and camera ──
  const face = (f) => ({ ...f, corners: f.corners.map((c) => P3(W(c))), ...(f.normal ? { normal: P3(N(f.normal)) } : {}), ...(f.outNormal ? { outNormal: P3(N(f.outNormal)) } : {}) });
  const box = (c) => { const a = W(c.min), b = W(c.max); return { min: P3([Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])]), max: P3([Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])]), of: `subway:${c.of}` }; };
  const pts = (ps) => ps.map((p) => P3(W(p)));
  const rect = (q) => { const a = W([q[0], q[1], 0]), b = W([q[2], q[3], 0]); return P3([Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])]); };
  const faces = [...L.stations.flatMap((s) => s.faces), ...L.tunnels.flatMap((t) => t.faces), ...L.stubs.flatMap((t) => t.faces), ...L.entrances.flatMap((e) => e.faces)].map(face);
  const colliders = [...L.stations.flatMap((s) => s.colliders), ...L.tunnels.flatMap((t) => t.colliders), ...L.stubs.flatMap((t) => t.colliders), ...L.entrances.flatMap((e) => e.colliders)].map(box);
  // (a heading in the line's frame, in the city's)
  const turn = (h) => { const v = N([Math.cos(h), Math.sin(h), 0]); return r5(Math.atan2(v[1], v[0])); };
  const wells = L.entrances.map((e) => rect(e.well));
  const anchors = [
    ...L.stations.map((s) => ({ id: `station-${s.id}`, kind: 'station', plan: s.plan, platforms: s.routes.platforms.map(pts), up: s.routes.up.map(pts), exits: s.ports.walks.map((q) => q.id) })),
    ...L.tunnels.map((t) => ({ id: `rail-${t.id}`, kind: 'rail-tunnel', from: `station-${t.a}`, to: `station-${t.b}`, length: t.length, walk: pts(t.walk) })),
    ...L.entrances.map((e) => ({ id: `entrance-${e.id}`, kind: 'entrance', station: `station-${e.station}`, walk: pts(e.walk), door: P3(W(e.door)) })),
    ...L.warps.map((w) => ({ id: `warp-${w.id}`, kind: 'warp', from: `station-${w.from}`, to: `station-${w.to}`, at: P3(W(w.at)), spot: P3(W(w.spot)), heading: turn(w.heading), walk: pts(w.walk) })),
  ];
  // (its cameras: down a platform, into a tunnel from a platform's end, the first entrance from the walk and down it)
  const cam = (name, from, to, fov = 70) => ({ name, worldFraming: { cameraPosition: P3(W(from)), lookAt: P3(W(to)), horizontalFov: fov } });
  const S0 = L.stations[0], lane = S0.routes.platforms[0], T0 = L.tunnels[0], E0 = L.entrances[0];
  const cameras = [
    cam('subway-platform', [lane[2][0], lane[2][1] - 1, lane[2][2] + 1.7], [lane[0][0] * 0.3, lane[0][1] + 10, lane[0][2] + 1.6]),
    ...(!T0 && L.warps[0] ? [cam('subway-tunnel', [L.warps[0].walk[1][0], L.warps[0].walk[1][1] + Math.sign(L.warps[0].at[1] - L.warps[0].walk[1][1]) * 3, L.warps[0].walk[1][2] + 1.7], [L.warps[0].at[0], L.warps[0].at[1], L.warps[0].at[2] + 1.2])] : []),
    ...(T0 ? [cam('subway-tunnel', [T0.walk[3][0], T0.walk[3][1] + 6, T0.walk[3][2] + 1.7], [T0.axis, T0.walk[3][1] + 60, T0.walk[3][2] + 1.2])] : []),
    ...(E0 ? [cam('subway-entrance', [E0.door[0] - Math.sign(E0.door[0]) * 5, E0.door[1] + E0.N[1] * 9, E0.door[2] + 1.7], [E0.door[0], E0.door[1] - E0.N[1] * 4, E0.door[2] - 0.5], 65),
      cam('subway-stair', [E0.walk[3][0], E0.walk[3][1], E0.walk[3][2] + 1.7], [E0.walk[2][0], E0.walk[2][1], E0.walk[2][2] + 1])] : []),
  ];
  const readout = {
    along: l.id, axis: l.axis, depth: r5(depth), z0, gap, section: L.section, tunnels: L.mode,
    ...(L.warps.length ? { warps: L.warps.map((w) => ({ id: w.id, from: w.from, to: w.to })) } : {}),
    stations: L.stations.map((s) => ({ id: s.id, ...s.readout })),
    runs: L.tunnels.map((t) => ({ id: t.id, length: t.length, cover: t.cover, grade: t.grade, ...(t.findings.length ? { findings: t.findings } : {}) })),
    entrances: L.entrances.map((e) => ({ id: e.id, rise: e.rise, steps: e.steps })),
  };
  // (each link's way out in the city: its jambs, its plane, its floor and head, as a passage meets it)
  const ports = L.stations.flatMap((St) => St.ports.walks.filter((q) => q.id.startsWith('path-')).map((q) => {
    const a = W([q.lo[0], q.lo[1], 0]), b = W([q.hi[0], q.hi[1], 0]);
    return { station: St.id, id: q.id.slice('path-'.length), z0: q.z0, top: q.top, lo: P3([a[0], a[1]]), hi: P3([b[0], b[1]]), plane: r5(ns ? a[0] : a[1]) };
  }));
  return { line: l, axis: l.axis, span: [t0, t0 + total].map(r5), faces, colliders, wells, anchors, cameras, readout, ports, tunnels: L.tunnels, stations: L.stations, laid: L, W, turn };
}

/**
 * A geocity with a subway played as a LEVEL (structure/level.js lowers a geocube's `level` by it, registered by the
 * scene): its walker on the line's first platform, its goal the pavement outside its last station's first entrance;
 * between them the line's tunnels walked, or (`tunnels: 'teleport'`) its warps, each arrival shown over the walker's
 * shoulder (network/subway.js levelOfLine, in the city's frame). A geocube that is not a geocity with a subway passes
 * through.
 */
export function withGeocitySubwayLevel(m, ref, { designGeocity, eye = 1.7, probe = 0.6 } = {}) {
  if (m.show !== 'geocity' || !m.geocity?.subway) return m;
  const d = designGeocity(m.geocity, { seed: m.seed ?? 1 }), S = d.land.S, U = subwayUnder(d, { S, kerb: 0.15 });
  const pilot = Array.isArray(m.entities) ? m.entities.find((e) => e && e.pilotable) : null, R = levelOfLine(U.laid, { player: pilot?.id ?? 'player' });
  const w = (p) => P3(U.W(p)), lv = m.level ?? {};
  const warps = R.warps.map((x) => { const to = w(x.to); return { ...x, at: w(x.at), to: [to[0], to[1], r5(to[2] + eye)] }; });
  const goal = w(R.goal), exit = { kind: 'reach-exit', at: [goal[0], goal[1], r5(goal[2] + eye)], radius: lv.radius ?? 1.5, planar: false, via: R.route.map(w) };
  const game = { levelRef: ref, mechanics: [...(lv.mechanics ?? []), ...warps, ...(lv.exit === false ? [] : [exit])], fall: { mode: 'respawn' } };
  const spots = R.spots.map((sp) => { const at = w([sp.at[0], sp.at[1], sp.at[2] ?? 0]); const f = (U.turn((sp.face * Math.PI) / 180) * 180) / Math.PI; return { ...sp, at, face: Math.round(f) }; });
  const play = R.scenes.length ? { play: { ...(m.play ?? {}), spots: [...(m.play?.spots ?? []), ...spots], scenes: [...(m.play?.scenes ?? []), ...R.scenes] } } : {};
  if (pilot) return { ...m, ...play, game };
  const sp = w(R.spawn);
  return {
    ...m, ...play, game,
    entities: [{ id: 'player', pilotable: true, rule: { type: 'walk', speed: 4.5, turn: 4, eye, turnMode: 'look', keyTurn: true, strafe: 1, collideRadius: 0.3, probe }, body: { type: 'none' }, transform: { pos: [sp[0], sp[1], r5(sp[2] + eye)], heading: U.turn(R.heading) } }],
    camera: { rule: 'follow', target: 'player', dist: 0.05, height: 0, lookH: 0, lead: 2, turnMode: 'look' },
  };
}
