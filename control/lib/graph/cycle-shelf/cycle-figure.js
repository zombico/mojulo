/**
 * cycle-figure — a cycle shelf machine as the doors draw it: its faces on the studio grid (mint_solid's vehicle
 * preview, the family layer's `cycle` instance), and its figure in a level (a parked vehicle: world-scene.js, the
 * vehicle registry's parked.js).
 *
 *   readCycleSpec(spec, at?)   → { archetype, look?, pose?, rider?, posture? }, or throws naming what it takes
 *   cycleInstanceFaces(spec)   → (async) { faces, spec, stats }: the machine assembled, lowered to the grid's faces; with
 *                                `rider` (true, or the realistic hero's spec) its rider astride in its `posture`
 *                                (cycle-rider.js; absent, the machine's own)
 *   cycleFigure(spec)          → the rig figure (vehicle-designer/vehicle-rig.js packVehicleFigure): the machine the
 *                                root, each wheel its own bone at its axle; parked on its stand unless the pose says
 *                                otherwise; centred along its length (a parked footprint is centred on its spot)
 *   cycleRideFigure(spec)      → (async) the machine ridden (`ride: true`, a quick game's ride: vehicle-registry/ride.js):
 *                                upright on its tyres, its rider astride in the root (`rider`), the parts that steer a
 *                                bone of their own (`front`), each wheel its own bone rolling with the road, and its
 *                                `live` overlay (scene/channels/controllable): the front turned about the steering axis
 *                                through the head (a kingpin wheel about its own upright), the machine and its rider
 *                                leaning into a turn by the drive rule's own lean when its wheels are in line, and a
 *                                three-wheeler's inner wheel lifting as the turn's pull nears what tips it, about the
 *                                edge it would tip over (its stability each side, read off its contacts as the
 *                                stability law reads it)
 *   riderOf(spec)              → (async) the rider a ridden machine carries, solved once a process
 *   rideFigureOf(spec, rider)  → cycleRideFigure's figure at once, its rider already solved (riderOf's, or null): for a
 *                                caller that builds in one go (the artillery range: gameworld/combat/roadsters.js)
 *
 * The recipe is the machine's words, never its geometry: it regenerates on every read. Pure.
 */
import { lowerAssemblerBuild, lowerAssemblerFaces } from '../worlds/workbench-assembler.js';
import { packVehicleFigure } from '../vehicle-designer/vehicle-rig.js';
import { VEHICLES as PHYSICS } from '../roads/vehicles.js';
import { CYCLE_ARCHETYPES, assembleCycle, composeMachine } from './index.js';
import { lookCard } from './cycle-looks.js';
import { postureCard, readRiderHero, riderOn } from './cycle-rider.js';

const KEYS = Object.freeze(['archetype', 'look', 'pose', 'ride', 'rider', 'posture', 'addons']);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const r3 = (n) => Math.round(n * 1000) / 1000 + 0;

export function readCycleSpec(spec, at = 'cycle') {
  if (!isObj(spec)) throw new Error(`${at} is { archetype, look?, pose?, ride?, rider?, posture?, addons? }`);
  for (const k of Object.keys(spec)) if (!KEYS.includes(k)) throw new Error(`${at}.${k} is not a cycle's word (${KEYS.join(', ')})`);
  if (!CYCLE_ARCHETYPES[spec.archetype]) throw new Error(`${at}.archetype is one of ${Object.keys(CYCLE_ARCHETYPES).join(', ')}`);
  if (spec.look !== undefined) lookCard(spec.look);
  if (spec.addons !== undefined) composeMachine(spec.archetype, Array.isArray(spec.addons) ? spec.addons : [spec.addons]);
  if (spec.pose !== undefined) {
    if (!isObj(spec.pose)) throw new Error(`${at}.pose is { stand?: 'up' | 'down', steer?: degrees }`);
    for (const k of Object.keys(spec.pose)) if (!['stand', 'steer'].includes(k)) throw new Error(`${at}.pose.${k} is not a cycle's pose (stand, steer)`);
  }
  if (spec.rider !== undefined && spec.rider !== false) {
    readRiderHero(spec.rider, `${at}.rider`);
    if (spec.pose?.stand === 'down') throw new Error(`${at}: a ridden machine stands on its tyres, its stand up`);
    if (spec.pose?.steer) throw new Error(`${at}: a rider is seated on the machine steered straight`);
  }
  if (spec.ride !== undefined && typeof spec.ride !== 'boolean') throw new Error(`${at}.ride is true (the machine ridden: its front steers and it leans on the page) or false`);
  if (spec.ride && spec.pose !== undefined) throw new Error(`${at}: a ridden machine is posed by its ride (its steer and its lean live on the page), never by a pose`);
  if (spec.posture !== undefined) {
    postureCard(spec.posture);
    if (!spec.rider) throw new Error(`${at}.posture is a rider's: give a rider`);
  }
  return spec;
}

const addonsOf = (spec) => (spec.addons === undefined ? [] : Array.isArray(spec.addons) ? spec.addons : [spec.addons]);
const assembled = (spec) => assembleCycle(spec.archetype, { ...(spec.look ? { look: spec.look } : {}), ...(spec.addons ? { addons: addonsOf(spec) } : {}), pose: spec.pose ?? {} });

export async function cycleInstanceFaces(spec) {
  readCycleSpec(spec);
  const { manifest, readout } = assembled(spec);
  const faces = lowerAssemblerFaces(manifest);
  // (its rider astride, posed on its own rider points, in its frame)
  const rider = spec.rider ? await riderOn(spec.archetype, { hero: spec.rider, posture: spec.posture, rider: readout.rider }) : null;
  if (rider) faces.push(...rider.faces);
  return {
    faces,
    spec,
    stats: { archetype: spec.archetype, ...(readout.addons ? { addons: readout.addons } : {}), label: readout.label, layout: readout.layout, measures: readout.measures, laws: readout.laws.ok, ...(readout.lean ? { lean: readout.lean } : {}), ...(rider ? { rider: rider.report } : {}), faces: faces.length },
  };
}

/** Each placed part's faces into its bone's bucket, the machine shifted along its length to centre it. */
function bucketed(manifest, own) {
  const { faces, placements } = lowerAssemblerBuild(manifest);
  let lo = Infinity, hi = -Infinity, top = 0;
  for (const f of faces) for (const c of f.corners) { if (c[1] < lo) lo = c[1]; if (c[1] > hi) hi = c[1]; if (c[2] > top) top = c[2]; }
  const cy = (lo + hi) / 2, shift = (c) => [c[0], r3(c[1] - cy), c[2]];
  const buckets = new Map([['root', []]]), bones = [{ id: 'root', head: [0, 0, 0] }];
  placements.forEach((p, i) => {
    const item = manifest.items[i], o = own(item, p);
    if (o.bone !== 'root' && !buckets.has(o.bone)) {
      buckets.set(o.bone, []);
      bones.push({ id: o.bone, head: shift(o.head ?? [0, 1, 2].map((k) => (p.bounds.min[k] + p.bounds.max[k]) / 2)) });
    }
    const list = buckets.get(o.bone);
    for (let k = p.faceStart; k < p.faceStart + p.faceCount; k++) list.push({ ...faces[k], corners: faces[k].corners.map(shift) });
  });
  return { bones, buckets, cy, shift, top };
}

export function cycleFigure(spec) {
  readCycleSpec(spec);
  if (spec.rider) throw new Error('cycle: a parked machine stands with no rider');
  if (spec.ride) throw new Error('cycle: a parked machine is not ridden (cycleRideFigure rides it)');
  // (a parked machine stands on its stand: its pose's own word wins)
  const pose = { stand: CYCLE_ARCHETYPES[spec.archetype].layout.some((e) => e.id === 'stand') && !addonsOf(spec).length ? 'down' : 'up', ...(spec.pose ?? {}) };
  const { manifest, readout } = assembled({ ...spec, pose });
  // (each wheel its own bone, named for its part: a pair's two wheels each turn about their own axle)
  const { bones, buckets } = bucketed(manifest, (item) => ({ bone: item.source.garage.kind === 'cycle-wheel' ? item.id : 'root' }));
  return {
    ...packVehicleFigure(bones, buckets, { keys: 2, rolls: [] }),
    cycle: { archetype: spec.archetype, measures: readout.measures, ...(readout.lean ? { lean: readout.lean } : {}) },
  };
}

// ── ridden ──────────────────────────────────────────────────────────────────
const RIDERS = new Map();
/** The rider's faces on a machine, posed once a process for each machine, posture and hero (a field of rivals shares it). */
function riderFaces(spec, readout) {
  const key = JSON.stringify([readout.archetype, readout.addons ?? [], spec.posture ?? null, spec.rider]);
  if (!RIDERS.has(key)) RIDERS.set(key, riderOn(spec.archetype, { hero: spec.rider, posture: spec.posture, rider: readout.rider }));
  return RIDERS.get(key);
}

/** The convex hull of ground points [x, y], anticlockwise (the stability law's). */
function hullOf(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.slice().reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

/**
 * The edges a machine on three wheels or more tips over, each side: for the side a turn throws it toward (r for a turn
 * to the left, l to the right), where that edge crosses the line the centre of mass sits on (x) and how far inside it
 * the centre of mass sits, over its height (ssf). The centre of mass as the stability law places it: ahead of the rear
 * axle by the share the front carries, toward a sidecar's chair by a fifth of its track.
 */
export function tipEdges(contacts, physics, layout) {
  const ys = contacts.map((c) => c[1]), y0 = Math.min(...ys), wb = Math.max(...ys) - y0;
  const rear = physics.drive === 'front' ? 1 - physics.share : physics.share;
  const chair = layout === 'sidecar' ? contacts.reduce((m, c) => (Math.abs(c[0]) > Math.abs(m[0]) ? c : m), [0, 0]) : null;
  const g = [chair ? 0.2 * chair[0] : 0, y0 + wb * (1 - rear)];
  const H = hullOf(contacts.map((c) => [c[0], c[1]]));
  const edge = (s) => {
    let best = null;
    H.forEach((a, i) => {
      const b = H[(i + 1) % H.length], ex = b[0] - a[0], ey = b[1] - a[1], L = Math.hypot(ex, ey), nx = ey / L;
      if (!best || s * nx > best.n) best = { n: s * nx, a, b, L, ex, ey };
    });
    const { a, L, ex, ey } = best, t = Math.abs(ey) > 1e-9 ? (g[1] - a[1]) / ey : 0.5;
    return { x: r3(a[0] + ex * t), ssf: r3(Math.abs(ex * (g[1] - a[1]) - ey * (g[0] - a[0])) / L / physics.cgH)};
  };
  const r = edge(1), l = edge(-1);
  return { r: { x: r.x, ssf: r.ssf }, l: { x: l.x, ssf: l.ssf }, gy: r3(g[1]) };
}

// how a ridden machine's overlay moves: the bar turned less than the rule steers (the rider's hands are the root's and
// do not follow it: no more than 7°, a grip a few centimetres off its hand),
// the lean the rule's own (no more than a tyre's edge), a squat and a dive a fork and a shock allow; a three-wheeler's
// body rolls a little on its springs and its inner wheel lifts no more than a hand's height
const RIDDEN = Object.freeze({ steer: 0.6, steerMax: 0.12, lean: 0, leanMax: 0.9, squat: 0.05, dive: 0.08, bounce: 0.2, wobble: 0, wobbleMax: 0 });
const ROLLED = Object.freeze({ ...RIDDEN, lean: 0.02, leanMax: 0.06, liftMax: 0.12 });

export async function cycleRideFigure(spec) {
  readCycleSpec(spec);
  if (!spec.ride) throw new Error('cycle: cycleRideFigure rides a machine (`ride: true`)');
  return rideFigureOf(spec, spec.rider ? await riderOf(spec) : null);
}

/** The rider a ridden machine carries, solved on its rig (async: the realistic hero is built once a process). */
export function riderOf(spec) {
  const { readout } = assembled({ ...spec, pose: {} });
  return riderFaces(spec, readout);
}

/** The ridden machine with its rider already solved (riderOf's; null for none): cycleRideFigure's, at once. */
export function rideFigureOf(spec, rider) {
  readCycleSpec(spec);
  if (!spec.ride) throw new Error('cycle: rideFigureOf rides a machine (`ride: true`)');
  if (!!spec.rider !== !!rider) throw new Error('cycle: rideFigureOf takes the rider its spec asks for (riderOf\'s), or none');
  const { manifest, readout } = assembled({ ...spec, pose: {} });
  const S = readout.steering, steersOf = (id) => S.parts[id];
  const { bones, buckets, cy, shift, top: machineTop } = bucketed(manifest, (item) => {
    const wheel = item.source.garage.kind === 'cycle-wheel';
    if (wheel) return { bone: item.id, head: item.source.garage.hardpoints.axle };
    return steersOf(item.id) === true ? { bone: 'front', head: S.at } : { bone: 'root' };
  });
  // (the rider astride, in the root: it leans with the machine)
  let top = machineTop;
  if (rider) {
    const faces = rider.faces;
    for (const f of faces) for (const c of f.corners) if (c[2] > top) top = c[2];
    buckets.get('root').push(...faces.map((f) => ({ ...f, corners: f.corners.map(shift) })));
  }
  const at = shift(S.at), byId = new Map(bones.map((b) => [b.id, b]));
  // (the bones that steer: the front, and each wheel that turns with it or on its own kingpin)
  const steer = bones.filter((b) => b.id === 'front' || (byId.has(b.id) && steersOf(b.id))).map((b) => b.id);
  const physics = PHYSICS[readout.physics], inline = readout.layout === 'inline';
  const ys = readout.contacts.map((c) => c.at[1]), mid = r3((Math.min(...ys) + Math.max(...ys)) / 2 - cy);
  const tip = inline ? null : tipEdges(readout.contacts.map((c) => c.at), { ...physics }, readout.layout);
  const wheels = manifest.items.filter((it) => it.source.garage.kind === 'cycle-wheel');
  const radius = Math.max(...wheels.map((it) => it.source.garage.hardpoints.axle[2]));
  const live = {
    ridden: true,
    steer,
    steerAxis: S.axis,
    // (each part that turns about the steering axis orbits the point on it through the head; a kingpin wheel turns in place)
    steerAt: Object.fromEntries(steer.filter((id) => id === 'front' || steersOf(id) === true).map((id) => [id, at])),
    // (all of it leans and pitches: the root, its rider in it, and the wheels that do not steer; the steered ones after their turn)
    body: { bones: bones.map((b) => b.id).filter((id) => !steer.includes(id)), pivot: [0, mid, 0] },
    ...(inline ? { lean: 'rule' } : { lift: { r: tip.r, l: tip.l, wb: physics.wheelbase } }),
    gains: inline ? { ...RIDDEN } : { ...ROLLED },
  };
  return {
    ...packVehicleFigure(bones, buckets, { keys: 12, rolls: wheels.map((it) => it.id) }),
    live,
    figH: r3(top),
    wheelbase: r3(Math.max(...ys) - Math.min(...ys)),
    wheelRadius: r3(radius),
    cycle: { archetype: spec.archetype, ...(readout.addons ? { addons: readout.addons } : {}), layout: readout.layout, measures: readout.measures, ...(rider ? { rider: rider.report } : {}) },
  };
}
