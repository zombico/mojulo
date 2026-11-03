/**
 * cycle-laws — the geometry a machine ridden astride is held to, MEASURED from what was built (its parts' faces and
 * hardpoints), never restated from its card. Advisory, as every gate is: a law that fails is said in the readout, the
 * machine is still built.
 *
 *   layout      how it stands on its wheels, read from where they meet the ground (two in line, a sidecar, a delta,
 *               a tadpole, a quad), its class's
 *   centreline  its single wheels meet the ground on the centreline (x = 0); `track` its wheels side by side (or its
 *               chair's) its class's track apart (±3 %)
 *   wheelbase   the axles as far apart as its physics class says (±3 %)
 *   size        its length, width and height its class's (±8 %, ±8 %, ±10 %)
 *   trail       where the steering axis meets the ground, ahead of the front contact, in its family's band: positive,
 *               so the front wheel trails and the machine steers itself straight
 *   seat        the seat's top at the rider's place, in its family's band
 *   clearance   the lowest part between the wheels (frame, engine, exhaust, pegs, body) at least its band above the ground
 *   lean        two in line: the angle each side leans before a hard part touches the ground, at least its band
 *   stability   on three or four wheels: its static stability factor (its centre of mass's ground point to the nearest
 *               line it tips about, over the height of its centre of mass: the class's), at least its band
 *   chain       the sprockets in one plane: the chain runs straight
 *   stand       on its stand, the machine leans toward it in its band: it stands, and does not fall the other way
 *
 *   cycleLaws({ row, G, physics, parts, measures, standFoot }) → { ok, laws: [{ id, value, band, ok, says }] }
 *
 * Pure.
 */
import { lowerObjectFaces } from '../worlds/workbench.js';
import { DEG } from './cycle-common.js';
import { wheelLayout } from '../roads/vehicles.js';

const centred = (c) => Math.abs(c[0]) < 1e-3;
/** How a machine stands on its wheels, read from where they meet the ground: inline (two in line), sidecar (two in line
 *  and one beside), delta (one ahead of two), tadpole (two ahead of one), quad (two pairs), else 'n wheels'. */
export function wheelLayoutOf(contacts) {
  const n = contacts.length, c = contacts.filter(centred), off = contacts.filter((p) => !centred(p));
  if (n === 2 && c.length === 2) return 'inline';
  if (n === 3 && c.length === 2) return 'sidecar';
  if (n === 3 && c.length === 1) return c[0][1] > off[0][1] ? 'delta' : 'tadpole';
  if (n === 4 && c.length === 0) return 'quad';
  return `${n} wheels`;
}
/** The layout a class says (roads/vehicles.js wheelLayout): its axles are a quad's on the shelf. */
const classLayout = (physics) => { const l = wheelLayout(physics); return l === 'axles' ? 'quad' : l; };

/** The convex hull of points in the plane (monotone chain), counter-clockwise. */
function hull(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.slice().reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
/** The static stability factor: the distance from the centre of mass's ground point to the nearest edge of the
 *  contacts' hull, over its height. The centre of mass ahead of the rear axle by the share its front carries (the class's
 *  `share` is its driven, rear, wheels'), and toward a sidecar's chair by a fifth of its track (an empty chair). */
function stabilityOf(contacts, physics, layout, chair) {
  const ys = contacts.map((c) => c[1]), y0 = Math.min(...ys), wb = Math.max(...ys) - y0;
  const rear = physics.drive === 'front' ? 1 - physics.share : physics.share;
  const g = [layout === 'sidecar' && chair ? 0.2 * chair[0] : 0, y0 + wb * (1 - rear)];
  const H = hull(contacts.map((c) => [c[0], c[1]]));
  let d = Infinity;
  H.forEach((a, i) => { const b = H[(i + 1) % H.length], ex = b[0] - a[0], ey = b[1] - a[1], L = Math.hypot(ex, ey); d = Math.min(d, Math.abs(ex * (g[1] - a[1]) - ey * (g[0] - a[0])) / L); });
  return d / physics.cgH;
}

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

export function cycleLaws({ row, G, physics, parts, measures, standFoot, expect = null }) {
  const band = row.laws, laws = [];
  const law = (id, value, b, ok, says) => laws.push({ id, value, band: b, ok, says });
  const hp = (kind, name) => parts.filter((p) => p.recipe.garage.kind === kind).map((p) => p.recipe.garage.hardpoints[name]).filter(Boolean);
  const wheels = parts.filter((p) => p.recipe.garage.kind === 'cycle-wheel'), contacts = wheels.map((p) => p.recipe.garage.hardpoints.contact);
  const layout = wheelLayoutOf(contacts), want = expect ?? classLayout(physics), inline = layout === 'inline';
  law('layout', layout, want, layout === want, 'how it stands on its wheels, read from where they meet the ground');
  // (its single wheels on the centreline; its wheels side by side, or its chair, the class's track apart)
  const single = wheels.filter((p) => ['front', 'rear'].includes(p.recipe.garage.slot)).map((p) => Math.abs(p.recipe.garage.hardpoints.contact[0]));
  const xs = single.length ? single : [0];
  law('centreline', r3(Math.max(...xs)), [0, 0.001], Math.max(...xs) <= 0.001, inline ? 'both tyres meet the ground on the line the machine leans about' : 'its single wheels meet the ground on the centreline');
  const side = contacts.filter((c) => !centred(c)), chairAt = wheels.find((p) => p.recipe.garage.slot === 'chair')?.recipe.garage.hardpoints.contact ?? null;
  if (side.length) {
    const track = chairAt ? Math.abs(chairAt[0]) : Math.max(...side.map((c) => c[0])) - Math.min(...side.map((c) => c[0]));
    law('track', r3(track), [r3(physics.track * 0.97), r3(physics.track * 1.03)], physics.track > 0 && Math.abs(track / physics.track - 1) <= 0.03, chairAt ? 'its chair\'s wheel its class\'s track off the centreline' : 'its wheels side by side its class\'s track apart');
  }
  const ys = contacts.map((c) => c[1]), wb = Math.max(...ys) - Math.min(...ys);
  law('wheelbase', r3(wb), [r3(physics.wheelbase * 0.97), r3(physics.wheelbase * 1.03)], Math.abs(wb / physics.wheelbase - 1) <= 0.03, 'the axles as far apart as its class');
  // (a sidecar the door added spans more than its class: its width is the chair's to say)
  const size = [['length', 'L', 0.08], ...(expect && expect !== classLayout(physics) ? [] : [['width', 'W', 0.08]]), ['height', 'H', 0.1]].map(([m, k, tol]) => Math.abs(measures[m] / physics[k] - 1) <= tol);
  law('size', { length: measures.length, width: measures.width, height: measures.height }, { L: physics.L, W: physics.W, H: physics.H }, size.every(Boolean), 'its length, width and height its class\'s');
  // (the steering axis as the fork's joint says it runs, met with the ground)
  const steer = parts.flatMap((p) => p.recipe.garage.joints || []).find((j) => j.name === 'steer');
  // (a quad steers on its kingpins, which the shelf does not draw: its column says no trail)
  if (steer && layout !== 'quad') {
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
  if (inline) {
    const leanMin = Math.min(lean.r, lean.l);
    law('lean', { r: r1(lean.r), l: r1(lean.l) }, [band.lean, null], leanMin >= band.lean, 'how far it leans each way before a hard part touches the ground');
  } else {
    const ssf = stabilityOf(contacts, physics, layout, chairAt);
    law('stability', r3(ssf), [band.stability ?? 0, null], ssf >= (band.stability ?? 0), 'how far its centre of mass sits inside the lines it tips about, over its height');
  }
  const [front] = hp('cycle-drive', 'front'), [rear] = hp('cycle-drive', 'rear');
  if (front && rear) law('chain', r3(Math.abs(front[0] - rear[0])), [0, 0.002], Math.abs(front[0] - rear[0]) <= 0.002, 'the sprockets in one plane: the chain runs straight');
  if (standFoot) {
    const a = Math.atan2(standFoot[2], -standFoot[0]) / DEG;
    law('stand', r1(a), band.stand, standFoot[0] < 0 && a >= band.stand[0] && a <= band.stand[1], 'on its stand it leans toward the stand, and stands');
  }
  return { ok: laws.every((l) => l.ok), laws, layout, G: { wheelbase: r3(wb), rake: r1(G.rake / DEG), offset: G.offset, trail: r3(G.trail) } };
}
