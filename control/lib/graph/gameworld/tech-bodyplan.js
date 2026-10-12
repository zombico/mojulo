/**
 * THE BODY-PLAN SOLVER — a crafted thing's chassis solved from a BODY PLAN, not drawn by hand. A body plan is data: a
 * CORE mass and the PARTS it carries, each a kind the solver knows how to build, attach, rig and offer sockets on. A
 * new form is a row; nothing in the solver names a form.
 *
 *   core   { axis: 'x' | 'y' | 'z', dims: [length, width, height] (m), lift (m, its underside off the ground), front?,
 *            rear? ([w, h, dz] shares of its section at its ends), role, group, lattice? }
 *            x: a thing that goes (nose to tail along x); z: a thing that rises (base to top); y: a span (end to end)
 *   parts  [{ kind, when?, unless?, …its settings }]: limbs, tracks, wheels, skirt, pods, cabin, fin, plinth, deck,
 *            mast, piers, pedestal, barrels, sail, stack, oars (PART_KINDS says what each is); `when` names a dial the
 *            thing's words must set (a sail when it sails), `unless` the dials that leave it out (oars unless sail or steam)
 *   lead   the piece that takes the picture ('core' unless named)
 *
 * The solver builds every mass in the workbench's vocabulary (lofts, lathes, sweeps, extrudes), sections shaped by the
 * motif and rounds sized for where the world's camera meets the thing (tech-chassis.js `fitter`); RIGS it (a root joint
 * at the core, a joint at every hip and knee, every wheel, every barrel, a crown that turns); and DERIVES its sockets:
 * every block-like mass offers its top, front, rear and sides (sized by the face's area, serving what a face in that
 * direction can show), and every limb segment its outer side. Nothing is listed by hand.
 *
 *   BODY_PLANS                                   the rows, by `<kind>/<form>`
 *   PART_KINDS                                   what each part kind is
 *   solveBodyPlan(row, thing, { motif, scale, fit, fitLen, thick }) → { manifest, joints, sockets, pieces, masses,
 *                                                  lead, functions, dims }
 *
 * Pure; no dice.
 */
import { section } from './tech-chassis.js';

const r3 = (v) => Math.round(v * 1000) / 1000;
const P = (p) => ({ x: r3(p[0]), y: r3(p[1]), z: r3(p[2]) });
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const VALUE = { 'tech:body': '#9a9a9a', 'tech:frame': '#6e6e6e', 'tech:skin': '#b8b8b8', 'tech:trim': '#808080', 'tech:light': '#e6e6e6', 'tech:glass': '#262626' };

export const PART_KINDS = Object.freeze({
  limbs: 'jointed legs in pairs along the core: a hip, an upper segment out and up to a knee, a lower down to a foot',
  tracks: 'a track run down each side, the core riding on them',
  wheels: 'wheels in pairs (axles) along the core, each turning',
  skirt: 'a cushion skirt under the core, wider than it',
  pods: 'rounded pods along x (a head at the front, engines or fans at the rear), in pairs or one on the centreline',
  cabin: 'a smaller mass on the core\'s top (a house, a cab)',
  fin: 'a blade at the rear (a rudder, a tail)',
  plinth: 'a dressed base the core stands on',
  deck: 'a disc at the core\'s top',
  mast: 'a pole from the top and the beacon on it, turning (unless the thing lights: then its crown is the deck)',
  piers: 'columns down from a span\'s ends to the ground',
  pedestal: 'a ring the core turns on',
  barrels: 'barrels out of the core\'s front, each pitching',
  sail: 'a mast from the core\'s top and a sail on it',
  stack: 'a smokestack on the core\'s top: it burns to go',
  oars: 'oars down each side into the water',
});

/** The rows. Dimensions in metres at true size; the style's exaggeration and the thing's own scale multiply them. */
export const BODY_PLANS = Object.freeze({
  'vehicle/walker': { core: { axis: 'x', dims: [3.2, 2.2, 1.5], lift: 2.4, front: [0.7, 0.62, -0.08], rear: [0.88, 0.85, 0], role: 'body' },
    parts: [{ kind: 'pods', at: 'front', r: 0.56, len: 0.95, role: 'sensor', group: 'tech:skin', name: 'head' }, { kind: 'limbs', pairs: 2, spread: 0.6, out: 1.05, up: 0.55, r: 0.36, foot: 'claw' }] },
  'vehicle/tracked': { core: { axis: 'x', dims: [4.6, 2.3, 1.0], lift: 0.7, front: [0.86, 0.7, -0.05], rear: [0.94, 0.9, 0], role: 'body' },
    parts: [{ kind: 'tracks', r: 0.42, w: 0.55 }] },
  'vehicle/hover': { core: { axis: 'x', dims: [3.8, 2.0, 0.9], lift: 0.8, front: [0.7, 0.7, -0.05], rear: [0.9, 0.9, 0], role: 'body' }, lead: 'skirt',
    parts: [{ kind: 'skirt', h: 0.8, grow: 1.14 }, { kind: 'pods', at: 'rear', r: 0.34, len: 0.5, pair: true, role: 'running', name: 'fans' }] },
  'vehicle/ship': { core: { axis: 'x', dims: [16, 4.6, 2.4], lift: 0, front: [0.16, 0.9, 0.12], rear: [0.82, 0.95, 0], role: 'body' }, mounts: ['water'],
    parts: [{ kind: 'cabin', at: -0.28, dims: [0.25, 0.7, 0.9] }, { kind: 'fin', role: 'running', l: 1.6, h: 2.2, name: 'rudder' }, { kind: 'sail', when: 'sail', h: 11 }, { kind: 'stack', when: 'stack', r: 0.55, h: 3 }, { kind: 'oars', unless: ['sail', 'stack'], n: 5 }] },
  'structure/tower': { core: { axis: 'z', dims: [18, 2.4, 1.3], lift: 1.4, role: 'body' },
    parts: [{ kind: 'plinth', grow: 2.3, h: 1.4 }, { kind: 'deck', r: 2.5, h: 0.6 }, { kind: 'mast', h: 4, r: 0.32 }] },
  'structure/gate': { core: { axis: 'y', dims: [14, 3.2, 3.2], lift: 10, role: 'span', group: 'tech:skin' }, lead: 'core',
    parts: [{ kind: 'piers', w: 2.35, inset: 1.2 }] },
  'weapon/turret': { core: { axis: 'x', dims: [2.7, 2.2, 1.3], lift: 0.75, front: [0.8, 0.75, 0], rear: [0.95, 0.95, 0], role: 'mount' },
    parts: [{ kind: 'pedestal', r: 1.25, h: 0.75 }, { kind: 'barrels', r: 0.14, len: 2.6 }] },
  'weapon/cannon': { core: { axis: 'x', dims: [1.6, 0.75, 0.5], lift: 0.5, front: [0.8, 0.8, 0], rear: [0.6, 0.6, -0.1], role: 'mount', group: 'tech:frame' }, lead: 'wheels',
    parts: [{ kind: 'wheels', axles: 1, r: 0.62, w: 0.12, at: [0.05] }, { kind: 'barrels', r: 0.17, len: 2.2, raise: 0.12 }] },
});

// ── the solver ──────────────────────────────────────────────────────────────────────────────────────────────────────
export function solveBodyPlan(row, t, { motif = 'smooth', scale = 1, fit, fitLen, thick = {}, tuck = 1 } = {}) {
  const s = scale, m = motif, d = t.dials ?? {}, fns = t.block?.functions ?? [];
  const lofts = [], lathes = [], sweeps = [], extrudes = [], joints = [], pieces = {}, masses = [];
  const k = (id) => thick[id] ?? 1;
  // a monomer, its piece and role, and the mass the sockets are read off (a box, or a segment a → b of radius r)
  const mono = (arr, spec, piece, role, group, mass) => {
    const g = group ?? 'tech:frame';
    arr.push({ ...lathed(spec, fit, fitLen), group: g, tint: VALUE[g] ?? '#888888' });
    pieces[spec.id] = { piece, role };
    if (mass) masses.push({ id: spec.id, piece, role, ...mass });
  };
  const lathe = (id, a, b, profile, fitR, piece, role, group, mass) => mono(lathes, { id, axisFrom: P(a), axisTo: P(b), profile: profile.map((p) => ({ t: p[0], radius: r3(p[1]) })), fitR }, piece, role, group, mass);
  const C = row.core, ck = k('core'), coreRole = C.role ?? 'body', coreGroup = C.group ?? 'tech:body';
  let [L, W, H] = C.dims.map((v) => v * s * ck);
  if (C.axis === 'z') { L = C.dims[0] * s * (d.tall ? 1.35 : 1); W = C.dims[1] * s * ck; H = C.dims[2] * s * ck; }
  const lift = C.lift * s, box = (lo, hi) => ({ box: { lo: lo.map(r3), hi: hi.map(r3) } });
  const dims = {};

  // ── the core ──
  if (C.axis === 'x') {
    const zc = lift + H / 2, fr = C.front ?? [0.8, 0.8, 0], re = C.rear ?? [0.9, 0.9, 0], n = fit((W + H) / 4);
    const st = (tt, [ws, hs, dz]) => ({ t: tt, profile: { points: section(m, W * ws, H * hs, n).map(([u, v]) => [u, r3(v + dz * H)]) } });
    mono(lofts, { id: 'core', interp: 'smooth', segments: fitLen(L / 2), axisFrom: P([-L / 2, 0, zc]), axisTo: P([L / 2, 0, zc]), stations: [st(0, re), { t: 0.55, profile: { points: section(m, W, H, n) } }, st(1, fr)] }, 'core', coreRole, coreGroup, box([-L / 2, -W / 2, lift], [L / 2, W / 2, lift + H]));
    Object.assign(dims, { L, W, H, lift, zc });
  } else if (C.axis === 'y') {
    const zc = lift + H / 2, n = fit((W + H) / 4);
    mono(lofts, { id: 'core', axisFrom: P([0, -L / 2, zc]), axisTo: P([0, L / 2, zc]), stations: [{ t: 0, profile: { points: section(m === 'smooth' ? 'faceted' : m, W, H, n) } }, { t: 1, profile: { points: section(m === 'smooth' ? 'faceted' : m, W, H, n) } }] }, 'core', coreRole, coreGroup, box([-W / 2, -L / 2, lift], [W / 2, L / 2, lift + H]));
    Object.assign(dims, { L, W, H, lift, zc });
  } else {
    // a thing that rises: base width W to top width H (half-widths), from its lift to its top, solid or a lattice
    const top = L - 1.2 * s, w0 = W, w1 = H;
    if (d.lattice || C.lattice) {
      const bays = Math.max(3, Math.round((top - lift) / (3.6 * s))), legR = 0.22 * s * ck, sides = Math.max(5, fit(legR));
      const corner = (i, z) => { const a = Math.PI / 4 + (i * Math.PI) / 2, w = w0 + (w1 - w0) * ((z - lift) / (top - lift)); return [r3(Math.cos(a) * w), r3(Math.sin(a) * w), r3(z)]; };
      for (let i = 0; i < 4; i++) mono(sweeps, { id: `core-leg-${i + 1}`, path: [corner(i, lift), corner(i, top)], radius: r3(legR), sides }, 'core', 'frame', 'tech:frame');
      for (let b = 0; b < bays; b++) for (let i = 0; i < 4; i++) {
        const z0 = lift + ((top - lift) * b) / bays, z1 = lift + ((top - lift) * (b + 1)) / bays, j = (i + 1) % 4;
        mono(sweeps, { id: `core-brace-${b + 1}-${i + 1}`, path: [corner(b % 2 ? i : j, z0), corner(b % 2 ? j : i, z1)], radius: r3(legR * 0.6), sides: Math.max(4, sides - 1) }, 'core', 'frame', 'tech:frame');
      }
      masses.push({ id: 'core-leg-1', piece: 'core', role: 'frame', box: { lo: [-w0, -w0, lift].map(r3), hi: [w0, w0, top].map(r3) } });
    } else {
      const n = fit(w0);
      mono(lofts, { id: 'core', axisFrom: P([0, 0, lift]), axisTo: P([0, 0, top]), stations: [{ t: 0, profile: { points: section(m, 2 * w0, 2 * w0, n) } }, { t: 1, profile: { points: section(m, 2 * w1, 2 * w1, n) } }] }, 'core', coreRole, coreGroup, box([-w0, -w0, lift], [w0, w0, top]));
    }
    Object.assign(dims, { top, w0, w1, lift, lattice: !!(d.lattice || C.lattice) });
  }
  joints.push({ id: 'core', parent: null, pivot: C.axis === 'x' ? [0, 0, r3(dims.zc)] : [0, 0, r3(lift)], axis: [0, 0, 1], range: C.axis === 'x' ? [-12, 12] : [0, 0], pieces: [] });
  const onCore = joints[0].pieces;

  // ── the parts ──
  const lights = fns.includes('light');
  for (const p of row.parts) {
    if (p.when && !d[p.when]) continue;
    if (p.unless && p.unless.some((u) => d[u])) continue;
    if (p.kind === 'limbs') {
      const r = p.r * s * k('limbs');
      for (let i = 0; i < p.pairs; i++) for (const [sy, side] of [[-1, 'l'], [1, 'r']]) {
        const fx = p.pairs === 1 ? 0 : i === 0 ? 1 : -1, leg = `${p.pairs === 1 ? '' : i === 0 ? 'f' : 'b'}${side}`, hip = [fx * dims.L * p.spread * tuck / 2, sy * dims.W * 0.45, dims.lift + 0.25 * s];
        const knee = add(hip, [fx * 0.25 * s * tuck, sy * p.out * s * tuck, p.up * s * tuck]), ankle = add(knee, [fx * 0.1 * s * tuck, sy * 0.35 * s * tuck, -(knee[2] - 0.35 * s)]), piece = `limb-${leg}`;
        lathe(`hip-${leg}`, add(hip, [0, -sy * 0.2 * s, 0]), add(hip, [0, sy * 0.35 * s, 0]), [[0, r * 0.9], [0.5, r * 1.25], [1, r * 0.9]], r * 1.25, piece, 'joint', 'tech:frame');
        mono(lofts, { id: `upper-${leg}`, axisFrom: P(hip), axisTo: P(knee), stations: [{ t: 0, profile: { points: section(m, r * 1.6, r * 1.9, fit(r * 0.9)) } }, { t: 1, profile: { points: section(m, r * 1.25, r * 1.4, fit(r * 0.9)) } }] }, piece, 'running', 'tech:frame', { seg: [hip, knee], r, out: [0, sy, 0] });
        lathe(`knee-${leg}`, add(knee, [-0.3 * s, 0, 0]), add(knee, [0.3 * s, 0, 0]), [[0, r * 0.8], [0.5, r * 1.05], [1, r * 0.8]], r * 1.05, piece, 'joint', 'tech:frame');
        mono(lofts, { id: `lower-${leg}`, axisFrom: P(knee), axisTo: P(ankle), stations: [{ t: 0, profile: { points: section(m, r * 1.4, r * 1.6, fit(r * 0.75)) } }, { t: 0.7, profile: { points: section(m, r * 1.05, r * 1.15, fit(r * 0.75)) } }, { t: 1, profile: { points: section(m, r * 0.85, r * 0.9, fit(r * 0.75)) } }] }, piece, 'running', 'tech:frame', { seg: [knee, ankle], r, out: [fx || 1, 0, 0] });
        const foot = [ankle[0], ankle[1], 0], fz = 0.3 * s, feet = [`foot-${leg}`];
        mono(extrudes, { id: `foot-${leg}`, profile: { points: [[-0.3, -0.25], [0.3, -0.25], [0.38, 0], [0.3, 0.25], [-0.3, 0.25], [-0.38, 0]].map(([u, v]) => [r3(foot[0] + u * s), r3(foot[1] + v * s)]) }, axisFrom: P([0, 0, 0]), axisTo: P([0, 0, fz]) }, piece, 'running', 'tech:trim');
        if (p.foot === 'claw') for (const [j, deg] of [[1, -38], [2, 0], [3, 38]]) {
          const a = Math.atan2(sy * 0.6, fx || 0.0001) + (deg * Math.PI) / 180, dd = [Math.cos(a), Math.sin(a)], q = [-dd[1], dd[0]];
          mono(extrudes, { id: `toe-${leg}-${j}`, profile: { points: [[0.15, -0.14], [0.82, 0], [0.15, 0.14]].map(([l, w]) => [r3(foot[0] + (dd[0] * l + q[0] * w) * s), r3(foot[1] + (dd[1] * l + q[1] * w) * s)]) }, axisFrom: P([0, 0, 0]), axisTo: P([0, 0, fz * 0.75]) }, piece, 'running', 'tech:trim');
          feet.push(`toe-${leg}-${j}`);
        }
        joints.push({ id: `hip-${leg}`, parent: 'core', pivot: hip.map(r3), axis: [1, 0, 0], range: [-25, 35], pieces: [`hip-${leg}`, `upper-${leg}`] });
        joints.push({ id: `knee-${leg}`, parent: `hip-${leg}`, pivot: knee.map(r3), axis: [1, 0, 0], range: [-30, 40], pieces: [`knee-${leg}`, `lower-${leg}`, ...feet] });
      }
    } else if (p.kind === 'tracks') {
      // its ends rounded in as many steps as where it is met asks (half a round each)
      const r = p.r * s * k('tracks'), len = dims.L * 0.98, hl = len / 2 - r, pts = [], st = Math.max(3, Math.round(fit(r) / 2));
      for (let i = 0; i <= st; i++) { const a = -Math.PI / 2 + (Math.PI * i) / st; pts.push([r3(-(hl + r * Math.cos(a))), r3(r + r * Math.sin(a))]); }
      for (let i = 0; i <= st; i++) { const a = Math.PI / 2 + (Math.PI * i) / st; pts.push([r3(-(-hl + r * Math.cos(a))), r3(r + r * Math.sin(a))]); }
      for (const [sy, side] of [[-1, 'l'], [1, 'r']]) {
        const y0 = sy * (dims.W / 2 - p.w * s * 0.3), y1 = y0 + sy * p.w * s;
        mono(extrudes, { id: `track-${side}`, profile: { points: sy < 0 ? pts : [...pts].reverse() }, axisFrom: P([0, Math.min(y0, y1), 0]), axisTo: P([0, Math.max(y0, y1), 0]) }, `track-${side}`, 'running', 'tech:frame', box([-len / 2, Math.min(y0, y1), 0], [len / 2, Math.max(y0, y1), 2 * r]));
        onCore.push(`track-${side}`);
      }
    } else if (p.kind === 'wheels') {
      const r = p.r * s * k('wheels'), xs = p.at ?? Array.from({ length: p.axles }, (_, i) => (p.axles === 1 ? 0 : -0.4 + (0.8 * i) / (p.axles - 1)));
      xs.forEach((fx, i) => { for (const [sy, side] of [[-1, 'l'], [1, 'r']]) {
        const y = sy * (dims.W / 2 + p.w * s * 0.6), id = `wheel-${side}${xs.length > 1 ? i + 1 : ''}`, cx = fx * dims.L;
        lathe(id, [cx, y - (p.w * s) / 2, r], [cx, y + (p.w * s) / 2, r], [[0, r * 0.92], [0.5, r], [1, r * 0.92]], r, 'wheels', 'running', 'tech:frame');
        joints.push({ id, parent: 'core', pivot: [r3(cx), r3(y), r3(r)], axis: [0, 1, 0], range: [0, 360], pieces: [id] });
      } });
    } else if (p.kind === 'skirt') {
      const n = fit((dims.W + p.h * s) / 4), g = p.grow * k('skirt');
      mono(lofts, { id: 'skirt', axisFrom: P([-dims.L * g / 2, 0, (p.h * s) / 2]), axisTo: P([dims.L * g / 2, 0, (p.h * s) / 2]), stations: [{ t: 0, profile: { points: section(m, dims.W * g, p.h * s, n) } }, { t: 1, profile: { points: section(m, dims.W * g * 0.8, p.h * s, n) } }] }, 'skirt', 'running', 'tech:frame', box([-dims.L * g / 2, -dims.W * g / 2, 0], [dims.L * g / 2, dims.W * g / 2, p.h * s]));
      onCore.push('skirt');
    } else if (p.kind === 'pods') {
      const r = p.r * s * k(p.name ?? 'pod'), len = p.len * s, front = p.at === 'front', x0 = front ? dims.L / 2 - 0.2 * s : -dims.L / 2 - len * 0.8, ys = p.pair ? [-dims.W * 0.3, dims.W * 0.3] : [0];
      ys.forEach((y, i) => { const id = `${p.name ?? 'pod'}${ys.length > 1 ? `-${i ? 'r' : 'l'}` : ''}`, z = front ? dims.zc - 0.05 * s : dims.lift + dims.H + r * 0.6;
        lathe(id, [x0, y, z], [x0 + len, y, z], front ? [[0, r * 0.9], [0.45, r], [1, r * 0.4]] : [[0, r * 0.85], [0.5, r], [1, r * 0.9]], r, p.name ?? 'pod', p.role ?? 'running', p.group ?? 'tech:frame', box([x0, y - r, z - r], [x0 + len, y + r, z + r]));
        onCore.push(id); });
    } else if (p.kind === 'cabin') {
      const [cl, cw, ch] = [p.dims[0] * dims.L * k('cabin'), p.dims[1] * dims.W, p.dims[2] * 2.4 * s * k('cabin')], cx = p.at * dims.L, z0 = dims.lift + dims.H, n = fit((cw + ch) / 4);
      mono(lofts, { id: 'cabin', axisFrom: P([cx - cl / 2, 0, z0 + ch / 2]), axisTo: P([cx + cl / 2, 0, z0 + ch / 2]), stations: [{ t: 0, profile: { points: section(m, cw, ch, n) } }, { t: 1, profile: { points: section(m, cw * 0.9, ch * 0.9, n) } }] }, 'cabin', 'body', 'tech:skin', box([cx - cl / 2, -cw / 2, z0], [cx + cl / 2, cw / 2, z0 + ch]));
      onCore.push('cabin');
    } else if (p.kind === 'fin') {
      const x = -dims.L / 2, l = p.l * s, h = p.h * s;
      mono(extrudes, { id: p.name ?? 'fin', profile: { points: [[x, 0], [x - l, 0], [x, h]].map(([a, b]) => [r3(-a), r3(b)]) }, axisFrom: P([0, -0.08 * s, 0]), axisTo: P([0, 0.08 * s, 0]) }, p.name ?? 'fin', p.role ?? 'running', 'tech:frame');
      onCore.push(p.name ?? 'fin');
    } else if (p.kind === 'plinth') {
      const B = dims.w0 * p.grow, h = p.h * s, sec = m === 'smooth' ? 'faceted' : m;
      mono(lofts, { id: 'plinth', axisFrom: P([0, 0, 0]), axisTo: P([0, 0, h]), stations: [{ t: 0, profile: { points: section(sec, B, B, 8) } }, { t: 1, profile: { points: section(sec, B * 0.82, B * 0.82, 8) } }] }, 'plinth', 'mount', 'tech:trim', box([-B / 2, -B / 2, 0], [B / 2, B / 2, h]));
      onCore.push('plinth');
    } else if (p.kind === 'deck') {
      const R = p.r * s * k('deck'), z = dims.top;
      lathe('deck', [0, 0, z], [0, 0, z + p.h * s], [[0, R * 0.7], [0.35, R], [1, R * 0.95]], R, 'deck', 'frame', 'tech:skin', box([-R, -R, z], [R, R, z + p.h * s]));
      onCore.push('deck'); dims.deckTop = z + p.h * s;
    } else if (p.kind === 'mast' && !lights) {
      const z0 = dims.deckTop ?? dims.top, z1 = z0 + p.h * s, R = p.r * s;
      lathe('mast', [0, 0, z0], [0, 0, z1], [[0, R], [1, R * 0.5]], R, 'mast', 'frame', 'tech:frame');
      lathe('beacon', [0, 0, z1], [0, 0, z1 + 1.1 * s], [[0, 0.25 * s], [0.3, 0.6 * s], [0.7, 0.6 * s], [1, 0.2 * s]], 0.6 * s, 'beacon', 'beacon', 'tech:light', box([-0.6 * s, -0.6 * s, z1], [0.6 * s, 0.6 * s, z1 + 1.1 * s]));
      joints.push({ id: 'crown', parent: 'core', pivot: [0, 0, r3(z0)], axis: [0, 0, 1], range: [0, 360], pieces: ['mast', 'beacon'] });
    } else if (p.kind === 'piers') {
      const w = p.w * s * k('piers'), n = fit(w / 2), sec = m === 'smooth' ? 'faceted' : m;
      for (const [sy, side] of [[-1, 'l'], [1, 'r']]) {
        const y = sy * (dims.L / 2 - p.inset * s);
        mono(lofts, { id: `pier-${side}`, axisFrom: P([0, y, 0]), axisTo: P([0, y, dims.lift]), stations: [{ t: 0, profile: { points: section(sec, w * 1.1, w * 1.1, n) } }, { t: 1, profile: { points: section(sec, w, w, n) } }] }, `pier-${side}`, 'pier', 'tech:body', box([-w / 2, y - w / 2, 0], [w / 2, y + w / 2, dims.lift]));
        onCore.push(`pier-${side}`);
      }
    } else if (p.kind === 'pedestal') {
      const R = p.r * s, h = p.h * s;
      lathe('pedestal', [0, 0, 0], [0, 0, h], [[0, R * 1.1], [0.3, R], [1, R * 0.85]], R * 1.1, 'pedestal', 'mount', 'tech:frame', box([-R, -R, 0], [R, R, h]));
      // the pedestal stays; the core turns on it
      joints[0] = { ...joints[0], id: 'core', parent: 'pedestal', axis: [0, 0, 1], range: [0, 360] };
      joints.unshift({ id: 'pedestal', parent: null, pivot: [0, 0, 0], axis: [0, 0, 1], range: [0, 0], pieces: ['pedestal'] });
    } else if (p.kind === 'sail') {
      const x = dims.L * 0.05, z0 = dims.lift + dims.H, h = p.h * s, sw = dims.W * 1.3;
      mono(sweeps, { id: 'mast', path: [[x, 0, z0], [x, 0, z0 + h]].map((q) => q.map(r3)), radius: r3(0.16 * s), sides: Math.max(5, fit(0.16 * s)) }, 'mast', 'frame', 'tech:frame');
      mono(extrudes, { id: 'sail', profile: { points: [[-sw / 2, z0 + h * 0.25], [sw / 2, z0 + h * 0.25], [sw * 0.42, z0 + h * 0.95], [-sw * 0.42, z0 + h * 0.95]].map(([u, v]) => [r3(u), r3(v)]) }, axisFrom: P([x + 0.25 * s, 0, 0]), axisTo: P([x + 0.35 * s, 0, 0]) }, 'sail', 'running', 'tech:skin', box([x, -sw / 2, z0 + h * 0.25], [x + 0.35 * s, sw / 2, z0 + h * 0.95]));
      onCore.push('mast', 'sail');
    } else if (p.kind === 'stack') {
      const r = p.r * s, z0 = dims.lift + dims.H, x = -dims.L * 0.05;
      lathe('stack', [x, 0, z0], [x, 0, z0 + p.h * s], [[0, r], [0.85, r * 0.9], [0.92, r * 1.25], [1, r * 1.15]], r * 1.25, 'stack', 'source', 'tech:frame', box([x - r, -r, z0], [x + r, r, z0 + p.h * s]));
      onCore.push('stack');
    } else if (p.kind === 'oars') {
      for (const [sy, side] of [[-1, 'l'], [1, 'r']]) for (let i = 0; i < p.n; i++) {
        const x = -dims.L * 0.25 + i * dims.L * 0.1, a = [x, sy * dims.W / 2, dims.lift + dims.H * 0.8], b = [x - 0.6 * s, sy * (dims.W / 2 + 3.4 * s), 0];
        mono(sweeps, { id: `oar-${side}${i + 1}`, path: [a, b].map((q) => q.map(r3)), radius: r3(0.1 * s), sides: 5 }, 'oars', 'running', 'tech:frame');
      }
    } else if (p.kind === 'barrels') {
      const nb = Math.max(1, d.barrels ?? 1), r = p.r * s * k('barrels'), len = p.len * s, z = dims.zc + (p.raise ?? 0) * len;
      for (let i = 0; i < nb; i++) {
        const y = (i - (nb - 1) / 2) * r * 2.6, id = `barrel${nb > 1 ? `-${i + 1}` : ''}`, x0 = dims.L * 0.35;
        lathe(id, [x0, y, dims.zc], [x0 + len, y, z], [[0, r * 1.35], [0.12, r], [0.9, r * 0.9], [0.94, r * 1.25], [1, r * 1.15]], r * 1.35, 'barrels', 'weapon', 'tech:frame', { seg: [[x0, y, dims.zc], [x0 + len, y, z]], r, out: [0, 0, 1] });
        joints.push({ id: `pitch${nb > 1 ? `-${i + 1}` : ''}`, parent: 'core', pivot: [r3(x0), r3(y), r3(dims.zc)], axis: [0, 1, 0], range: [-10, 35], pieces: [id] });
      }
    }
  }
  for (const id of Object.keys(pieces)) if (!joints.some((j) => j.pieces.includes(id))) onCore.push(id);
  // the functions the masses show, read off the roles they carry
  const roles = new Set(Object.values(pieces).map((x) => x.role)), functions = [];
  if (roles.has('running') && (roles.has('body'))) functions.push('move');
  if (roles.has('weapon') && (roles.has('mount') || roles.has('grip'))) functions.push('strike');
  if (roles.has('span') && roles.has('pier')) functions.push('pass');
  if (roles.has('beacon')) functions.push('signal');
  if (roles.has('sensor') && !functions.includes('move')) functions.push('sense');
  return { manifest: { kind: 'workbench', title: t.read ?? t.intent ?? 'chassis', units: 'm', lofts, lathes, sweeps, extrudes }, joints, sockets: deriveSockets(masses, dims), pieces, masses, lead: row.lead ?? 'core', functions, dims, mounts: row.mounts ?? ['ground'] };
}

/** A lathe sized by where it is met: points round by `fitR`, rings along by its profile's arc (the slant counts). */
export function lathed(spec, fit, fitLen) {
  if (spec.fitR === undefined) return spec;
  const { fitR, ...rest } = spec, a = [spec.axisFrom.x, spec.axisFrom.y, spec.axisFrom.z], b = [spec.axisTo.x, spec.axisTo.y, spec.axisTo.z], L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  let arc = 0;
  for (let i = 1; i < spec.profile.length; i++) arc += Math.hypot((spec.profile[i].t - spec.profile[i - 1].t) * L, spec.profile[i].radius - spec.profile[i - 1].radius);
  return { ...rest, samples: fit(fitR), crossSections: fitLen(arc) };
}

// what a face turned each way can show
export const SERVES_BY_FACE = Object.freeze({
  top: ['sense', 'signal', 'strike', 'power', 'light'], front: ['sense', 'strike', 'light', 'signal'], rear: ['power', 'store'],
  side: ['guard', 'store', 'strike'], outer: ['guard'],
});
const sizeOf = (area) => (area < 0.6 ? 'small' : area < 3 ? 'medium' : 'large');
/**
 * The sockets, derived: a block-like mass offers its top, front, rear and sides (a face under 0.15 m² offers nothing),
 * a segment its outer side at its middle. Each socket says the face it is on, its size by the face's area, and what a
 * face that way can show.
 */
export function deriveSockets(masses, dims) {
  const out = [];
  for (const M of masses) {
    if (M.seg) {
      const [a, b] = M.seg, mid = a.map((v, i) => (v + b[i]) / 2), len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      out.push({ id: `${M.id}-outer`, on: M.id, mass: M.piece, face: 'outer', at: add(mid, M.out, M.r).map(r3), normal: M.out, size: sizeOf(len * M.r * 2), extent: [r3(M.r * 2), r3(len)], serves: SERVES_BY_FACE.outer });
      continue;
    }
    const { lo, hi } = M.box, c = lo.map((v, i) => (v + hi[i]) / 2), [dx, dy, dz] = hi.map((v, i) => v - lo[i]);
    // each face: where, which way, and its extent in its own plane (across, up): what hangs there fits it
    const faces = [['top', [c[0], c[1], hi[2]], [0, 0, 1], [dy, dx]], ['front', [hi[0], c[1], c[2]], [1, 0, 0], [dy, dz]], ['rear', [lo[0], c[1], c[2]], [-1, 0, 0], [dy, dz]],
      ['side-l', [c[0], lo[1], c[2]], [0, -1, 0], [dx, dz]], ['side-r', [c[0], hi[1], c[2]], [0, 1, 0], [dx, dz]]];
    for (const [face, at, normal, ext] of faces) { const area = ext[0] * ext[1]; if (area >= 0.15) out.push({ id: `${M.id}-${face}`, on: M.id, mass: M.piece, role: M.role, face: face.startsWith('side') ? 'side' : face, at: at.map(r3), normal, size: sizeOf(area), extent: ext.map(r3), serves: SERVES_BY_FACE[face.startsWith('side') ? 'side' : face] }); }
  }
  return out;
}
