/**
 * cycle-laws — the geometry a machine ridden astride is held to, MEASURED from what was built (its parts' faces and
 * hardpoints), never restated from its card. Advisory, as every gate is: a law that fails is said in the readout, the
 * machine is still built.
 *
 *   centreline  both tyres meet the ground on the line the machine leans about (x = 0)
 *   wheelbase   the axles as far apart as its physics class says (±3 %)
 *   size        its length, width and height its class's (±8 %, ±8 %, ±10 %)
 *   trail       where the steering axis meets the ground, ahead of the front contact, in its family's band: positive,
 *               so the front wheel trails and the machine steers itself straight
 *   seat        the seat's top at the rider's place, in its family's band
 *   clearance   the lowest part between the wheels (frame, engine, exhaust, pegs, body) at least its band above the ground
 *   lean        the angle each side leans before a hard part touches the ground, at least its band
 *   chain       the sprockets in one plane: the chain runs straight
 *   stand       on its stand, the machine leans toward it in its band: it stands, and does not fall the other way
 *
 *   cycleLaws({ row, G, physics, parts, measures, standFoot }) → { ok, laws: [{ id, value, band, ok, says }] }
 *
 * Pure.
 */
import { lowerObjectFaces } from '../worlds/workbench.js';
import { DEG } from './cycle-common.js';

const r3 = (n) => Math.round(n * 1000) / 1000;
const r1 = (n) => Math.round(n * 10) / 10;
// the parts the ground clearance is read off (the wheels, the brakes, the drive and the arms ride at the axles)
const BETWEEN = new Set(['cycle-frame', 'cycle-engine', 'cycle-exhaust', 'cycle-peg', 'cycle-shock', 'cycle-body', 'cycle-radiator', 'cycle-tank', 'cycle-seat']);
// the parts a lean never grounds first (a tyre is what leans on the ground; a disc sits inside its wheel)
const ROLLING = new Set(['cycle-wheel', 'cycle-brake']);

function cornersOf(recipe) {
  const out = [];
  for (const f of lowerObjectFaces(recipe)) for (const c of f.corners) out.push(c);
  return out;
}

export function cycleLaws({ row, G, physics, parts, measures, standFoot }) {
  const band = row.laws, laws = [];
  const law = (id, value, b, ok, says) => laws.push({ id, value, band: b, ok, says });
  const hp = (kind, name) => parts.filter((p) => p.recipe.garage.kind === kind).map((p) => p.recipe.garage.hardpoints[name]).filter(Boolean);
  const contacts = hp('cycle-wheel', 'contact');
  const xs = contacts.map((c) => Math.abs(c[0]));
  law('centreline', r3(Math.max(...xs)), [0, 0.001], Math.max(...xs) <= 0.001, 'both tyres meet the ground on the line the machine leans about');
  const ys = contacts.map((c) => c[1]), wb = Math.max(...ys) - Math.min(...ys);
  law('wheelbase', r3(wb), [r3(physics.wheelbase * 0.97), r3(physics.wheelbase * 1.03)], Math.abs(wb / physics.wheelbase - 1) <= 0.03, 'the axles as far apart as its class');
  const size = [['length', 'L', 0.08], ['width', 'W', 0.08], ['height', 'H', 0.1]].map(([m, k, tol]) => Math.abs(measures[m] / physics[k] - 1) <= tol);
  law('size', { length: measures.length, width: measures.width, height: measures.height }, { L: physics.L, W: physics.W, H: physics.H }, size.every(Boolean), 'its length, width and height its class\'s');
  // (the steering axis as the fork's joint says it runs, met with the ground)
  const steer = parts.flatMap((p) => p.recipe.garage.joints || []).find((j) => j.name === 'steer');
  if (steer) {
    const s0 = -steer.at[2] / steer.dir[2], groundY = steer.at[1] + steer.dir[1] * s0, front = Math.max(...ys), trail = groundY - front;
    law('trail', r3(trail), band.trail, trail >= band.trail[0] && trail <= band.trail[1], 'the front wheel trails the steering axis: it steers itself straight');
    law('rake', r1(Math.atan2(-steer.dir[1], steer.dir[2]) / DEG), null, true, 'the steering axis\'s lean back from the vertical');
  }
  const seat = parts.find((p) => p.recipe.garage.kind === 'cycle-seat');
  if (seat) {
    const ride = seat.recipe.garage.hardpoints.seat[1];
    const top = Math.max(...cornersOf(seat.recipe).filter((c) => Math.abs(c[1] - ride) < 0.2).map((c) => c[2]));
    law('seat', r3(top), band.seat, top >= band.seat[0] && top <= band.seat[1], 'the seat\'s top where the rider sits');
  }
  let low = Infinity;
  const lean = { r: 90, l: 90 };
  for (const p of parts) {
    const kind = p.recipe.garage.kind, cs = cornersOf(p.recipe);
    if (BETWEEN.has(kind)) for (const c of cs) low = Math.min(low, c[2]);
    if (ROLLING.has(kind)) continue;
    for (const c of cs) {
      if (Math.abs(c[0]) < 0.03) continue;
      const a = Math.atan2(c[2], Math.abs(c[0])) / DEG;
      const side = c[0] > 0 ? 'r' : 'l';
      if (a < lean[side]) lean[side] = a;
    }
  }
  law('clearance', r3(low), [band.clearance, null], low >= band.clearance, 'the lowest part between the wheels, above the ground');
  const leanMin = Math.min(lean.r, lean.l);
  law('lean', { r: r1(lean.r), l: r1(lean.l) }, [band.lean, null], leanMin >= band.lean, 'how far it leans each way before a hard part touches the ground');
  const [front] = hp('cycle-drive', 'front'), [rear] = hp('cycle-drive', 'rear');
  if (front && rear) law('chain', r3(Math.abs(front[0] - rear[0])), [0, 0.002], Math.abs(front[0] - rear[0]) <= 0.002, 'the sprockets in one plane: the chain runs straight');
  if (standFoot) {
    const a = Math.atan2(standFoot[2], -standFoot[0]) / DEG;
    law('stand', r1(a), band.stand, standFoot[0] < 0 && a >= band.stand[0] && a <= band.stand[1], 'on its stand it leans toward the stand, and stands');
  }
  return { ok: laws.every((l) => l.ok), laws, G: { wheelbase: r3(wb), rake: r1(G.rake / DEG), offset: G.offset, trail: r3(G.trail) } };
}
