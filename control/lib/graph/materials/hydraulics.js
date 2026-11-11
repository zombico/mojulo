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
 *   solveHydraulics(circuit, { colliders?, wind?, unit? }) → { jets, mists, report }
 *     circuit   { id?, basin: { at: [x, y, floor z], radius, level (z of its water) },
 *                 pump: { head (m of water the pump lifts) }, liquid?: 'water',
 *                 nozzle?: { at: [x, y, z], dir?: [0, 0, 1], radius (m) },      the riser's mouth; none ⇒ the flow is
 *                 flow?: L/s,                                                    given (a spring, a channel)
 *                 tiers: [{ id?, at: [x, y, lip z], radius (the lip's), lips?: sheets round it (8), share?: of the lip
 *                           that pours (0.6), to?: z its water lands at (the next tier's lip, or the basin's level) }],
 *                 mist?: false | { size?, count? } }
 *     jets      raw jets for materials/jet.js normalizeJets: the riser (a round jet up), a sheet a lip
 *     mists     [{ at, env (rupa/vayo.js vayoEnvelope, trimmed), spray }]: one where each tier's water lands and one
 *               where the riser falls back; the page's channel (scene/channels/hydraulics.js) plays them on the clock
 *     report    { flow (L/s), speed (m/s), rise (m the jet climbs over its nozzle), power (W the pump gives the
 *               water), tiers: [{ id, per (L/s a sheet), depth (m over the lip, critical), fall (m) }] }
 *   A circuit that cannot run teaches (a pump too weak to reach its nozzle; a tier above the jet's rise).
 *
 * Pure and deterministic: no dice, no clock. SI units (metres, seconds), `unit` the world's metres a unit.
 */
import { stepVessels } from '../rupa/fluid.js';
import { vayoEnvelope } from '../rupa/vayo.js';
import { sheetProfile } from './jet.js';

/** A fountain's measures where a circuit names none: the sheets round a lip, the share of it that pours, a mist's motes
 *  and their size against the fall that makes them, and the least fall that raises any. */
export const HYDRAULICS = Object.freeze({ lips: 8, share: 0.6, mist: Object.freeze({ count: 14, size: 0.45, life: 3.2, least: 0.3 }) });

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
  const jets = [], mists = [], rep = [], M = circuit.mist === false ? null : { ...HYDRAULICS.mist, ...(circuit.mist && typeof circuit.mist === 'object' ? circuit.mist : {}) };
  const id = circuit.id || 'works';
  // the air round a landing, solved once: the faces it meets, the wind it rides
  const mistAt = (at, fall, r, key) => {
    if (!M || fall < M.least) return;
    const E = vayoEnvelope(at, { colliders, floor: at[2], wind, size: Math.max(0.4, r), n: 16 });
    mists.push({ id: key, at: at.map(r4), env: trimEnv(E),
      spray: { flow: 'smoke', count: Math.max(4, Math.round(M.count * Math.min(2, 0.5 + fall / 2))), life: M.life, size: r3(M.size * Math.min(1.8, 0.6 + fall / 3)), r: r3(Math.max(0.4, r)), rise: 0.35, grow: 1.2, swirl: 0.2, env: 'ends', stagger: M.life } });
  };
  if (N) {
    jets.push({ id: `${id}:riser`, at: N.at.map(r4), dir: (N.dir || [0, 0, 1]).map(r4), radius: r4(N.radius), discharge: Q, fall: r3(2 * rise + 0.5), mist: false, controls: false });
    if (tiers.length && tiers[0].at[2] > N.at[2] + rise + 1e-6) no(`the jet climbs ${r3(rise)} m over its nozzle and the first tier's lip stands above it: it is never fed`);
  }
  tiers.forEach((T, i) => {
    if (!vec(T.at) || !(T.radius > 0)) no(`tier ${i} is { at: [x, y, lip z], radius, lips?, share?, to? }`);
    const lips = Number.isInteger(T.lips) && T.lips > 0 ? T.lips : HYDRAULICS.lips, share = T.share > 0 && T.share <= 1 ? T.share : HYDRAULICS.share;
    const W = (2 * Math.PI * T.radius * share) / lips, per = Q / lips, S = sheetProfile({ W, Q: per });
    const to = Number.isFinite(T.to) ? T.to : i + 1 < tiers.length ? tiers[i + 1].at[2] : B.level, fall = T.at[2] - to;
    if (!(fall > 0)) no(`tier ${i} pours onto water that is not below its lip`);
    for (let k = 0; k < lips; k++) {
      const a = (2 * Math.PI * (k + 0.5)) / lips, o = [Math.cos(a), Math.sin(a)];
      jets.push({ id: `${id}:${T.id || `tier${i}`}:${k}`, shape: 'sheet', width: r4(W), at: [r4(T.at[0] + o[0] * T.radius), r4(T.at[1] + o[1] * T.radius), r4(T.at[2])], dir: [r4(o[0]), r4(o[1]), 0], discharge: per, fall: r3(fall + 0.2), mist: false, controls: false });
    }
    rep.push({ id: T.id || `tier${i}`, per: r4(per * 1000), depth: r4(S.hc), fall: r3(fall) });
    mistAt([T.at[0], T.at[1], to], fall, T.radius + 0.15, `${id}:${T.id || `tier${i}`}`);
  });
  if (N && rise > 0) mistAt([N.at[0], N.at[1], tiers.length ? tiers[0].at[2] : B.level], rise + Math.max(0, N.at[2] - (tiers.length ? tiers[0].at[2] : B.level)), 0.3, `${id}:riser`);
  return { jets, mists, report: { flow: r4(Q * 1000), speed: r3(speed), rise: r3(rise), power: r3(power), tiers: rep } };
}

// an envelope as a page carries it: what vayoPoints reads, rounded
const trimEnv = (E) => JSON.parse(JSON.stringify(E, (k, v) => (typeof v === 'number' ? (Number.isFinite(v) ? Math.round(v * 1e3) / 1e3 : null) : v)));
