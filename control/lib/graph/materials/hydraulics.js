/**
 * HYDRAULICS — flowing water as a circuit, solved once (a fountain, a wall spout, a cascade of basins; anything a pump
 * lifts and gravity brings back). Three things mojulo already has are joined, none of them simulated on the page:
 *
 *   the hydraulics   rupa/fluid.js: a basin, a pipe with a pump, a nozzle. The pump's head against the nozzle's height
 *                    is the pressure left behind it, and that is the jet's speed and the flow (Torricelli, Hagen–Poiseuille)
 *   the falls        materials/jet.js: what leaves the nozzle rises and falls as a closed-form stream; what a tier
 *                    receives it spills (continuity: at rest every tier passes the pump's flow), over its lip as sheets
 *                    at critical depth, each a function of time the page draws with no state
 *   the air          rupa/vayo.js: where water lands, mist is carried by the air round that spot, presolved here (the
 *                    walls and the ground it meets, the wind) so each mote's path is a formula of time
 *
 *   solveHydraulics(circuit, { colliders?, wind? }) → { jets, mists, impacts, report }
 *     circuit   { id?, basin: { at: [x, y, floor z], radius, level (z of its water) },
 *                 pump: { head (m of water the pump lifts) }, liquid?: 'water',
 *                 nozzle?: { at: [x, y, z], dir?: [0, 0, 1], radius (m) },      the riser's mouth; none ⇒ the flow is
 *                 flow?: L/s,                                                    given (a spring, a channel)
 *                 tiers: [{ id?, at: [x, y, lip z], radius (the lip's), lips?: sheets round it (8), share?: of the lip
 *                           that pours (0.6), arc?: [from, to] radians of the lip that pours (all of it), level?: z of its own water (a little under its lip), to?: z its water
 *                           lands at (the next tier's water, or the basin's) }],
 *                 mist?: false | { size?, count? } }
 *     jets      raw jets for materials/jet.js normalizeJets: the riser (a round jet up), a sheet a lip
 *     mists     [{ at, env (rupa/vayo.js vayoEnvelope, trimmed), spray }]: one where each tier's water lands and one
 *               where the riser falls back; the page's channel (scene/channels/hydraulics.js) plays them on the clock
 *     impacts   [{ at (on the water it lands on), ring (m from the axis the water lands at: 0 a jet's own fall), reach
 *               (the pool's radius), speed (m/s it lands with), flow (L/s), lips? (the sheets round a lip that land there) }]: what the page draws on the struck water,
 *               rings running out from where it lands and the drops it throws up (`impact: false` for none)
 *     report    { flow (L/s), speed (m/s), rise (m the jet climbs over its nozzle), power (W the pump gives the
 *               water), lands ([x, y] where the jet comes down), tiers: [{ id, per (L/s a sheet), depth (m over the lip, critical), fall (m) }] }
 *   hydraulicsFaces(circuit) → faces: the circuit's own vessels as plain stone and standing water (a basin, each tier
 *     a bowl on a stem), for a world that brings none; `stone: false` on the circuit for none
 *   mistAir(mists, { colliders?, wind? }) → the mists with their air solved among a world's own solids
 *   A circuit that cannot run teaches (a pump too weak to reach its nozzle; a tier above the jet's rise; a jet thrown
 *   past the water meant for it).
 *
 * Pure and deterministic: no dice, no clock. SI units (metres, seconds), `unit` the world's metres a unit.
 */
import { stepVessels } from '../rupa/fluid.js';
import { vayoEnvelope } from '../rupa/vayo.js';
import { sheetProfile } from './jet.js';

/** A fountain's measures where a circuit names none: the sheets round a lip, the share of it that pours, how far under
 *  its lip a tier's own water stands (`brim`, m), a mist's motes
 *  and their size against the fall that makes them, and the least fall that raises any. */
export const HYDRAULICS = Object.freeze({ lips: 8, share: 0.6, brim: 0.05, mist: Object.freeze({ count: 14, size: 0.45, life: 3.2, least: 0.3 }) });

const G = 9.81, RHO = 1000;
const r4 = (v) => Math.round(v * 1e4) / 1e4, r3 = (v) => Math.round(v * 1e3) / 1e3;
const vec = (p, n = 3) => Array.isArray(p) && p.length === n && p.every(Number.isFinite);

export function solveHydraulics(circuit, { colliders = [], wind = [0, 0, 0] } = {}) {
  const no = (msg) => { throw new Error(`hydraulics${circuit && circuit.id ? ` '${circuit.id}'` : ''}: ${msg}`); };
  if (!circuit || typeof circuit !== 'object') no('a circuit is { basin, pump, nozzle?, tiers }');
  const B = circuit.basin, N = circuit.nozzle || null, tiers = Array.isArray(circuit.tiers) ? circuit.tiers : [];
  if (!B || !vec(B.at) || !(B.radius > 0) || !Number.isFinite(B.level) || B.level <= B.at[2]) no('basin is { at: [x, y, floor z], radius, level (z of its water, over its floor) }');
  let Q, speed = 0, rise = 0, power = 0;
  if (N) {
    if (!vec(N.at) || !(N.radius > 0)) no('nozzle is { at: [x, y, z], radius (m), dir? }');
    const head = circuit.pump && circuit.pump.head;
    if (!(head > 0)) no('pump.head is the metres of water the pump lifts (over 0)');
    const lift = N.at[2] - B.level;
    if (head <= lift) no(`the pump lifts ${head} m and the nozzle stands ${r3(lift)} m over the basin's water: nothing reaches it (raise pump.head)`);
    // (the hydraulics: the basin, the riser with its pump, the nozzle open to the air; one second of it is its rate)
    // (the pump's head less the climb to the nozzle is what is left to throw the water: rupa/fluid.js takes a nozzle at
    // its opening's height, so the climb is taken off here)
    const net = { vessels: [{ id: 'basin', at: B.at, radius: B.radius, height: (B.level - B.at[2]) * 4 + 1, liquid: circuit.liquid || 'water', volume: Math.PI * B.radius * B.radius * (B.level - B.at[2]) }],
      pipes: [{ id: 'riser', from: 'basin', to: { nozzle: { at: N.at, dir: N.dir || [0, 0, 1] } }, z: B.at[2] + 0.02, radius: N.radius, length: Math.max(0.5, lift + 0.5), pump: RHO * G * (head - lift) }] };
    const jet = stepVessels(net, { seconds: 1 }).jets.find((j) => j.pipe === 'riser');
    if (!jet || !(jet.flow > 0)) no('the riser passes no water (its pump\'s head against its lift)');
    Q = jet.flow; speed = jet.speed;
    const d = N.dir || [0, 0, 1], dl = Math.hypot(d[0], d[1], d[2]) || 1;
    rise = ((speed * d[2] / dl) ** 2) / (2 * G); power = RHO * G * Q * head;
  } else {
    if (!(circuit.flow > 0)) no('with no nozzle the flow is given: flow (L/s)');
    Q = circuit.flow / 1000;
  }
  const impacts = [], jets = [], mists = [], rep = [], M = circuit.mist === false ? null : { ...HYDRAULICS.mist, ...(circuit.mist && typeof circuit.mist === 'object' ? circuit.mist : {}) };
  const id = circuit.id || 'works';
  // a tier's own water: its `level`, or a little under its lip; and the water under the nozzle
  const poolOf = (T) => (Number.isFinite(T.level) ? T.level : T.at[2] - HYDRAULICS.brim), under = tiers.length ? poolOf(tiers[0]) : B.level;
  // the air round a landing, solved once: the faces it meets, the wind it rides
  const mistAt = (at, fall, r, key) => {
    if (!M || fall < M.least) return;
    const E = vayoEnvelope(at, { colliders, floor: at[2], wind, size: Math.max(0.4, r), n: 16 });
    mists.push({ id: key, at: at.map(r4), size: r3(Math.max(0.4, r)), env: trimEnv(E),
      spray: { flow: 'smoke', count: Math.max(4, Math.round(M.count * Math.min(2, 0.5 + fall / 2))), life: M.life, size: r3(M.size * Math.min(1.8, 0.6 + fall / 3)), r: r3(Math.max(0.4, r)), rise: 0.35, grow: 1.2, swirl: 0.2, env: 'ends', stagger: M.life } });
  };
  if (N) {
    // (the jet climbs, turns and falls back to the water under its nozzle: the first tier's pool, or the basin's)
    jets.push({ id: `${id}:riser`, at: N.at.map(r4), dir: (N.dir || [0, 0, 1]).map(r4), radius: r4(N.radius), discharge: Q, fall: r3(Math.max(0.05, N.at[2] - under)), mist: false, controls: false });
    if (tiers.length && tiers[0].at[2] > N.at[2] + rise + 1e-6) no(`the jet climbs ${r3(rise)} m over its nozzle and the first tier's lip stands above it: it is never fed`);
  }
  tiers.forEach((T, i) => {
    if (!vec(T.at) || !(T.radius > 0)) no(`tier ${i} is { at: [x, y, lip z], radius, lips?, share?, to? }`);
    const lips = Number.isInteger(T.lips) && T.lips > 0 ? T.lips : HYDRAULICS.lips, share = T.share > 0 && T.share <= 1 ? T.share : HYDRAULICS.share;
    const arcOf = Array.isArray(T.arc) && T.arc.length === 2 && T.arc.every(Number.isFinite) && T.arc[1] > T.arc[0] ? Math.min(2 * Math.PI, T.arc[1] - T.arc[0]) : 2 * Math.PI;
    const W = (arcOf * T.radius * share) / lips, per = Q / lips, S = sheetProfile({ W, Q: per });
    const to = Number.isFinite(T.to) ? T.to : i + 1 < tiers.length ? poolOf(tiers[i + 1]) : B.level, fall = T.at[2] - to;
    if (!(fall > 0)) no(`tier ${i} pours onto water that is not below its lip`);
    // (the lip pours all the way round, or over an `arc` [from, to] in radians: a trough against a wall pours forward)
    const arc = Array.isArray(T.arc) && T.arc.length === 2 && T.arc.every(Number.isFinite) && T.arc[1] > T.arc[0] ? T.arc : [0, 2 * Math.PI], span = Math.min(2 * Math.PI, arc[1] - arc[0]);
    for (let k = 0; k < lips; k++) {
      const a = arc[0] + (span * (k + 0.5)) / lips, o = [Math.cos(a), Math.sin(a)];
      jets.push({ id: `${id}:${T.id || `tier${i}`}:${k}`, shape: 'sheet', width: r4(W), at: [r4(T.at[0] + o[0] * T.radius), r4(T.at[1] + o[1] * T.radius), r4(T.at[2])], dir: [r4(o[0]), r4(o[1]), 0], discharge: per, fall: r3(fall), mist: false, controls: false });   // (it ends on the water it lands on, not under it)
    }
    rep.push({ id: T.id || `tier${i}`, per: r4(per * 1000), depth: r4(S.hc), fall: r3(fall) });
    // (where the sheets land: thrown out from the lip by their own speed over the fall's time, a ring round the tier,
    // on the water below; what they hit it with is their speed there)
    const tf = Math.sqrt((2 * fall) / G), ring = T.radius + S.v0 * tf, pool = i + 1 < tiers.length ? tiers[i + 1].radius : B.radius;
    impacts.push({ id: `${id}:${T.id || `tier${i}`}`, at: [r4(T.at[0]), r4(T.at[1]), r4(to)], ring: r4(Math.min(ring, pool - 0.05)), reach: r4(pool), speed: r3(Math.hypot(S.v0, G * tf)), flow: r4(Q * 1000), ...(arcOf >= 2 * Math.PI - 1e-6 ? { lips } : {}) });
    mistAt([T.at[0], T.at[1], to], fall, T.radius + 0.15, `${id}:${T.id || `tier${i}`}`);
  });
  // (the jet's own fall back, from its top to the water under it: the first tier's, or the basin's)
  // (where the jet comes down: thrown along its nozzle's way for as long as it is in the air, onto that water)
  let land = N ? [N.at[0], N.at[1]] : null;
  if (N) { const d = N.dir || [0, 0, 1], dl = Math.hypot(d[0], d[1], d[2]) || 1, vz = (speed * d[2]) / dl, drop0 = N.at[2] - under;
    const t = (vz + Math.sqrt(vz * vz + 2 * G * Math.max(0, drop0))) / G; land = [N.at[0] + ((speed * d[0]) / dl) * t, N.at[1] + ((speed * d[1]) / dl) * t]; }
  // (a jet that comes down outside the water meant for it feeds nothing: the first tier's bowl, or the basin)
  const thrown = N ? Math.hypot(land[0] - (tiers.length ? tiers[0].at[0] : B.at[0]), land[1] - (tiers.length ? tiers[0].at[1] : B.at[1])) : 0;
  if (N && thrown > (tiers.length ? tiers[0].radius : B.radius)) no(`the jet comes down ${r3(thrown)} m from the middle of ${tiers.length ? 'its first tier' : 'its basin'}, outside it: turn the nozzle down, move it, or lower pump.head`);
  if (N) { const z = under, drop = N.at[2] + rise - z;
    if (drop > 0) impacts.push({ id: `${id}:riser`, at: [r4(land[0]), r4(land[1]), r4(z)], ring: 0, reach: r4(tiers.length ? tiers[0].radius : B.radius), speed: r3(Math.sqrt(2 * G * drop)), flow: r4(Q * 1000) }); }
  if (N) mistAt([land[0], land[1], under], rise + Math.max(0, N.at[2] - under), 0.3, `${id}:riser`);
  return { jets, mists, impacts: circuit.impact === false ? [] : impacts, report: { flow: r4(Q * 1000), speed: r3(speed), rise: r3(rise), power: r3(power), ...(N ? { lands: [r3(land[0]), r3(land[1])] } : {}), tiers: rep } };
}

// an envelope as a page carries it: what vayoPoints reads, rounded
const trimEnv = (E) => JSON.parse(JSON.stringify(E, (k, v) => (typeof v === 'number' ? (Number.isFinite(v) ? Math.round(v * 1e3) / 1e3 : null) : v)));

/** The mists' air solved again against a world's own solids (`colliders`: boxes { min, max }) and wind: a circuit laid
 *  by a kit is solved before its world has its colliders, in the open; the world gives them here. → the mists, each its
 *  envelope the air round its spot among those solids. */
export function mistAir(mists, { colliders = [], wind = [0, 0, 0] } = {}) {
  return (Array.isArray(mists) ? mists : []).map((m) => ({ ...m, env: trimEnv(vayoEnvelope(m.at, { colliders, floor: m.at[2], wind, size: m.size > 0 ? m.size : 0.4, n: 16 })) }));
}

/** A circuit's vessels as faces, for a world that brings no stone of its own: the basin a walled ring with its water,
 *  each tier a bowl on a stem with its water. Plain paint (a top lighter than a side), the water the aqua look's. */
export const HYDRAULICS_STONE = Object.freeze({ sides: 20, wall: 0.12, rim: 0.12, depth: 0.22, stem: 0.3, top: '#cfc8ba', side: '#a9a295', inside: '#8f897d', pool: '#4f9cc4', look: Object.freeze({ kind: 'lagoon', tint: '#3aa8c8', shore: 0.04 }) });
export function hydraulicsFaces(circuit) {
  const K = HYDRAULICS_STONE, out = [], B = circuit.basin, tiers = Array.isArray(circuit.tiers) ? circuit.tiers : [], id = circuit.id || 'works';
  const ring = (c, r, z) => Array.from({ length: K.sides + 1 }, (_, k) => { const a = (2 * Math.PI * k) / K.sides; return [r4(c[0] + Math.cos(a) * r), r4(c[1] + Math.sin(a) * r), r4(z)]; });
  const band = (A, Bq, fill, group, extra = {}) => { for (let k = 0; k < K.sides; k++) out.push({ corners: [A[k], A[k + 1], Bq[k + 1], Bq[k]], fill, group, ...extra }); };
  const vessel = (c, R, floor, rim, level, group) => {
    const o = R + K.wall;
    band(ring(c, o, floor), ring(c, o, rim), K.side, group);            // its outside
    band(ring(c, o, rim), ring(c, R, rim), K.top, group);               // its rim
    band(ring(c, R, rim), ring(c, R, floor), K.inside, group);          // its inside
    band(ring(c, R, floor), ring(c, 0.02, floor), K.inside, group);     // its floor
    band(ring(c, 0.02, level), ring(c, R, level), K.pool, `${group}:water`, { water: true, liquid: K.look, cornerAlpha: [0.86, 0.86, 0.86, 0.86] });
  };
  vessel(B.at, B.radius, B.at[2], B.level + K.rim, B.level, `hydraulics:${id}:basin`);
  tiers.forEach((T, i) => {
    const level = Number.isFinite(T.level) ? T.level : T.at[2] - HYDRAULICS.brim, floor = T.at[2] - K.depth, g = `hydraulics:${id}:${T.id || `tier${i}`}`, R = T.radius - K.wall;
    vessel(T.at, Math.max(0.05, R), floor, T.at[2], level, g);
    // (its stem, from the floor of what it stands over)
    const base = i + 1 < tiers.length ? tiers[i + 1].at[2] - K.depth : B.at[2], sr = Math.max(0.04, T.radius * K.stem);
    band(ring(T.at, sr, base), ring(T.at, sr, floor), K.side, g);
    band(ring(T.at, sr, floor), ring(T.at, T.radius, floor), K.inside, g);   // the bowl's underside
  });
  return out;
}
