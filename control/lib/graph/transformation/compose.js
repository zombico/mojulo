/**
 * compose.js — one robot and one vehicle (or a robot alone) become ONE rig figure that is both, and the sequence
 * between them.
 *
 * The robot is a baked biped (worlds/unit-rig.js): bones, parts, clips, in the rig frame (+y forward, +z up, feet on
 * z = 0). The vehicle is a set of PIECES (id, triangle soup, head) in the vehicle frame (+y the nose, +z up, centred,
 * wheels on z = 0), from a rig figure (`piecesOfFigure`) or the craft shelf (craft-rig.js craftPieces).
 *
 *   1. The STOW: the scheme's pose of the robot's skeleton that is the vehicle form (fk, no limits), set in the
 *      vehicle's middle at the scheme's height, where the shell hides it.
 *   2. The vehicle is scaled to the robot (its length = the robot's height / the scheme's ratio) and cut into PANELS:
 *      its parts are taken as the scheme says (cut triangle by triangle into the scheme's regions, whole, a wheel, or
 *      a seat of their own). A triangle no region holds welds onto the stowed bone it lies over (co-location).
 *   3. Every panel rides one robot bone and has TWO places on it: where the vehicle form has it (read off the stow:
 *      the panel lying on the folded bone) and its SEAT in the robot form (on the bone's face, turned as the scheme
 *      says). In the robot's clips it sits on its seat; in the vehicle form at its place in the vehicle (a wheel
 *      turning); in the sequence the skeleton unfolds joint by joint while each panel slides from one place to the
 *      other on its bone, on an eased arc, in the panels' window.
 *   4. Clips: the robot's own (each panel on its seat), `vehicle:idle` and `vehicle:drive`, and the once-clips
 *      `transform:vehicle` (robot → vehicle: the root turns, the joints fold, a hop, each key set on the ground) and
 *      `transform:robot` (the same keys, back).
 *
 * The robot's bones stay first and in order, so everything the robot carried by bone index or id (arm overlays,
 * the muzzle, thruster nozzles, the rim) still means what it meant. Deterministic: pure arithmetic in a fixed order.
 */

import { QI, qmul, qconj, qrot, qslerp, qaxis, qx, qy, qz, vadd, vsub, vlerp, vscale, vlen, windowEase, r4, DEG } from './kin.js';
import { robotSkeleton, fk, CORE_BONES } from './skeleton.js';
import { decodePart, packSoup, appendSoup, mapSoup, splitSoup, soupBounds, soupTris, emptySoup } from './rig-parts.js';
import { TRANSFORM_SCHEMES, boneGroup } from './schemes.js';

const AXIS = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
const euler = ([rx = 0, ry = 0, rz = 0] = []) => qmul(qz(rz), qmul(qy(ry), qx(rx)));
const corners = (b) => {
  const out = [];
  for (const x of [b.min[0], b.max[0]]) for (const y of [b.min[1], b.max[1]]) for (const z of [b.min[2], b.max[2]]) out.push([x, y, z]);
  return out;
};
const boxDist = (p, b) => {
  let d = 0;
  for (let k = 0; k < 3; k++) { const v = p[k] < b.min[k] ? b.min[k] - p[k] : p[k] > b.max[k] ? p[k] - b.max[k] : 0; d += v * v; }
  return Math.sqrt(d);
};
const inRange = (r, v) => !r || (v >= r[0] && v < r[1]);
// the face a seat sits against: its axis and outward sign (outer/inner by the robot's side)
const FACE = { front: [1, 1], back: [1, -1], top: [2, 1], bottom: [2, -1], outer: [0, 0], inner: [0, 0] };

/** piecesOfFigure(fig) → { pieces, length, width, height }: a vehicle rig figure's bones as pieces (centred, grounded). */
export function piecesOfFigure(fig) {
  const raw = fig.bones.map((b, i) => ({ id: b.id, head: b.head.slice(), soup: decodePart(fig.parts[i]) })).filter((p) => p.soup && soupTris(p.soup));
  return normalizePieces(raw);
}

export function normalizePieces(raw) {
  const all = emptySoup();
  for (const p of raw) appendSoup(all, { pos: p.soup.pos, col: p.soup.col, spec: null });
  const b = soupBounds(all);
  if (!b) throw new Error('transformation: the vehicle has no geometry');
  const d = [-b.center[0], -b.center[1], -b.min[2]];
  const pieces = raw.map((p) => ({ id: p.id, head: vadd(p.head, d), soup: mapSoup(p.soup, (v) => vadd(v, d)) }));
  return { pieces, length: b.size[1], width: b.size[0], height: b.size[2] };
}

/**
 * frameCover(robot, skel, stow, V) → { top, side, both }: how much of the frame the vehicle form's shell hides, seen
 * as a viewer sees it: the share of the frame's own triangles (not the shell's) under the shell from above, inside
 * it from the side, and both. The shell is rasterized into a height map over the ground and a breadth map over the
 * side, cells a ninety-sixth of its longest side.
 */
function frameCover(robot, skel, stow, V) {
  const g = Math.max(...V.bounds.size) / 96, top = new Map(), side = new Map();
  const cell = (a, b) => `${Math.floor(a / g)},${Math.floor(b / g)}`;
  for (const p of V.pieces) {
    const P = p.soup.pos;
    for (let o = 0; o < P.length; o += 9) {
      const a = [P[o], P[o + 1], P[o + 2]], b = [P[o + 3], P[o + 4], P[o + 5]], c = [P[o + 6], P[o + 7], P[o + 8]];
      const n = Math.min(40, Math.ceil(Math.max(vlen(vsub(b, a)), vlen(vsub(c, a)), vlen(vsub(c, b))) / g) + 1);
      for (let i = 0; i <= n; i++) for (let j = 0; i + j <= n; j++) {
        const q = vadd(a, vadd(vscale(vsub(b, a), i / n), vscale(vsub(c, a), j / n)));
        const kt = cell(q[0], q[1]), ks = cell(q[1], q[2]);
        if (!(top.get(kt) >= q[2])) top.set(kt, q[2]);
        const sv = side.get(ks);
        if (!sv) side.set(ks, [q[0], q[0]]); else { if (q[0] < sv[0]) sv[0] = q[0]; if (q[0] > sv[1]) sv[1] = q[0]; }
      }
    }
  }
  let n = 0, t = 0, sd = 0, both = 0;
  robot.parts.forEach((part, i) => {
    const s = decodePart(part);
    if (!s) return;
    for (let o = 0; o < s.pos.length; o += 9) {
      const c = [(s.pos[o] + s.pos[o + 3] + s.pos[o + 6]) / 3, (s.pos[o + 1] + s.pos[o + 4] + s.pos[o + 7]) / 3, (s.pos[o + 2] + s.pos[o + 5] + s.pos[o + 8]) / 3];
      const w = vadd(stow.h[i], qrot(stow.q[i], vsub(c, skel.bones[i].head)));
      const ht = top.get(cell(w[0], w[1])), sv = side.get(cell(w[1], w[2]));
      const a = ht != null && ht > w[2], b = !!sv && sv[0] < w[0] && w[0] < sv[1];
      n++; if (a) t++; if (b) sd++; if (a && b) both++;
    }
  });
  return n ? { top: r4(t / n), side: r4(sd / n), both: r4(both / n) } : null;
}

// the root of the sequence at t (0 robot … 1 vehicle): the scheme's turns, each eased over its window, the first innermost
function rootTurn(stow, t) {
  let q = QI;
  for (const s of stow.root || []) q = qmul(qaxis(AXIS[s.axis], s.deg * DEG * windowEase(t, s.at[0], s.at[1])), q);
  return q;
}
const rootWindow = (stow) => {
  const steps = stow.root || [];
  return steps.length ? [Math.min(...steps.map((s) => s.at[0])), Math.max(...steps.map((s) => s.at[1]))] : [0, 1];
};

/**
 * composeTransformer({ robot, vehicle, scheme, keys }) → { figure, readout }.
 * `robot`: a baked biped figure. `vehicle`: { pieces, length, height } or null (the robot's own alt form).
 * `scheme`: a TRANSFORM_SCHEMES id or a row. `keys`: the transformation's keys.
 */
export function composeTransformer({ robot, vehicle = null, scheme = 'car-bot', keys = 24 } = {}) {
  const S = typeof scheme === 'string' ? TRANSFORM_SCHEMES[scheme] : scheme;
  if (!S) throw new Error(`transformation: unknown scheme '${scheme}'`);
  if (!robot || !robot.rig) throw new Error('transformation: the robot must be a baked rig figure');
  const skel = robotSkeleton(robot);
  const NB = skel.bones.length;
  const H = robot.figH || 1;
  const head = (i) => skel.bones[i].head;

  // ── the robot at rest: each bone's soup and box ──
  const soups = robot.parts.map((p) => decodePart(p) || emptySoup());
  const box = soups.map((s, i) => soupBounds(s) || { min: vsub(head(i), [0.01, 0.01, 0.01]), max: vadd(head(i), [0.01, 0.01, 0.01]), center: head(i).slice(), size: [0.02, 0.02, 0.02] });
  const robotTris = soups.reduce((a, s) => a + soupTris(s), 0);

  // ── the vehicle, scaled to the robot ──
  let V = null;
  if (vehicle) {
    const s = (H / S.ratio) / (vehicle.length || 1);
    V = {
      height: vehicle.height * s, length: vehicle.length * s,
      pieces: vehicle.pieces.map((p) => ({ id: p.id, head: vscale(p.head, s), soup: mapSoup(p.soup, (v) => vscale(v, s)) })),
    };
    const all = emptySoup();
    for (const p of V.pieces) appendSoup(all, p.soup);
    V.bounds = soupBounds(all);
  }

  // ── 1. the stow ──
  const local = Object.fromEntries(Object.entries(S.stow.local || {}).map(([id, e]) => [id, euler(e)]));
  const rootQ = rootTurn(S.stow, 1);
  const pelvisRest = head(skel.byId.pelvis);
  const stowedBounds = (pose) => {
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < NB; i++) for (const c of corners(box[i])) {
      const w = vadd(pose.h[i], qrot(pose.q[i], vsub(c, head(i))));
      for (let k = 0; k < 3; k++) { if (w[k] < mn[k]) mn[k] = w[k]; if (w[k] > mx[k]) mx[k] = w[k]; }
    }
    return { min: mn, max: mx, center: [0, 1, 2].map((k) => (mn[k] + mx[k]) / 2) };
  };
  const b0 = stowedBounds(fk(skel, { root: { q: rootQ, at: pelvisRest }, local }));
  const want = V ? [0, 0, S.stow.z * V.height] : [0, 0, b0.center[2] - b0.min[2]];
  const stowAt = vadd(pelvisRest, vsub(want, b0.center));
  const stow = fk(skel, { root: { q: rootQ, at: stowAt }, local });
  const toRest = (i, v) => vadd(head(i), qrot(qconj(stow.q[i]), vsub(v, stow.h[i])));

  // ── 2. the panels ──
  const holds = new Set(S.holds || []);
  const capturing = skel.bones.map((b, i) => i).filter((i) => skel.bones[i].core && !holds.has(skel.bones[i].id) && soupTris(soups[i]));
  const nearest = (c) => {
    let best = capturing[0], bd = Infinity;
    for (const i of capturing) { const d = boxDist(toRest(i, c), box[i]); if (d < bd - 1e-9) { bd = d; best = i; } }
    return best;
  };
  // a seat's bone: its name with the side's L/R when it is a sided bone, climbing to a present ancestor
  const boneOf = (name, side) => {
    let id = skel.byId[name] != null ? name : `${name}${side < 0 ? 'L' : 'R'}`;
    while (id && skel.byId[id] == null) id = { handL: 'forearmL', handR: 'forearmR', forearmL: 'upperArmL', forearmR: 'upperArmR', shinL: 'thighL', shinR: 'thighR' }[id] || (CORE_BONES.includes(id) ? 'torso' : null);
    return skel.byId[id ?? 'torso'];
  };
  const weld = {};               // robot bone id → stray triangles welded on (co-located)
  const weldOn = (i, soup) => {
    appendSoup(soups[i], soup, (v) => toRest(i, v));
    weld[skel.bones[i].id] = (weld[skel.bones[i].id] || 0) + soupTris(soup);
  };
  const panels = [];             // { id, bone, soup, head, Rr, mr, Rv, mv, spin }
  // seat a panel (its soup in the vehicle frame) on the robot: both its places on bone `bi`
  const seat = (id, soup, rule, sv, spin = false) => {
    const pb = soupBounds(soup), c = pb.center;
    const side = rule.flip ? -sv : sv;
    const bi = boneOf(rule.bone || 'torso', side);
    const bb = box[bi];
    const Rv = qconj(stow.q[bi]), mv = vadd(head(bi), qrot(Rv, vsub(c, stow.h[bi])));
    let Rr, mr;
    if (rule.at) {
      // pinned by its inboard edge (a wing's root) at a point of the bone's box; turned about to point outboard
      const at = rule.at, rot = rule.rot || [0, 0, 0];
      const A = [bb.center[0] + at[0] * side * bb.size[0] / 2, bb.center[1] + at[1] * bb.size[1] / 2, bb.center[2] + at[2] * bb.size[2] / 2];
      Rr = qmul(euler([rot[0], rot[1] * -side, rot[2] * -side]), sv !== side ? qz(180) : QI);
      const a = rule.anchor === 'root' ? [sv > 0 ? pb.min[0] : pb.max[0], c[1], c[2]] : c;
      mr = vadd(A, qrot(Rr, vsub(c, a)));
    } else {
      Rr = rule.turn === 'stow' || rule.turn == null ? Rv : euler(rule.turn);
      // the panel's extent once turned
      const ext = [0, 0, 0];
      for (const k of corners(pb)) { const r = qrot(Rr, vsub(k, c)); for (let j = 0; j < 3; j++) ext[j] = Math.max(ext[j], Math.abs(r[j])); }
      mr = bb.center.slice();
      mr[2] = bb.center[2] + (rule.along || 0) * bb.size[2] / 2;
      const f = FACE[rule.face];
      if (f) {
        const [k, n0] = f, n = rule.face === 'outer' ? (side || 1) : rule.face === 'inner' ? -(side || 1) : n0;
        const embed = rule.embed ?? 0.35;
        mr[k] = (n > 0 ? bb.max[k] : bb.min[k]) + n * ext[k] * (1 - 2 * embed);
      }
    }
    panels.push({ id, bone: bi, soup, head: c, Rr, mr, Rv, mv, spin });
  };

  let vehicleTris = 0;
  if (V) {
    const bb = V.bounds, half = [bb.size[0] / 2 || 1, bb.size[1] / 2 || 1, bb.size[2] || 1];
    const norm = (c) => [c[1] / half[1], c[0] / half[0], c[2] / half[2]];   // [u, w, h]
    const regionOf = (c) => {
      const [u, w, h] = norm(c);
      const r = (S.regions || []).find((g) => inRange(g.u, u) && inRange(g.w, w) && inRange(g.h, h));
      if (!r) return null;
      return r.sided ? `${r.id}:${w < 0 ? -1 : 1}` : `${r.id}:0`;
    };
    const how = (id) => { const row = (S.parts || []).find(([re]) => re.test(id)); return row ? row[1] : 'cut'; };
    const gathered = new Map();   // region key → soup
    const gather = (key, soup) => { if (!gathered.has(key)) gathered.set(key, emptySoup(!!soup.spec)); appendSoup(gathered.get(key), soup); };
    for (const p of V.pieces) {
      vehicleTris += soupTris(p.soup);
      const kind = how(p.id);
      if (kind === 'cut') {
        for (const [key, chunk] of splitSoup(p.soup, (c) => regionOf(c) ?? 'stray')) {
          if (key === 'stray') for (const [, bit] of splitSoup(chunk, (c) => nearest(c))) weldOn(nearest(soupBounds(bit).center), bit);
          else gather(key, chunk);
        }
      } else if (kind === 'whole') {
        const key = regionOf(soupBounds(p.soup).center);
        if (key) gather(key, p.soup); else weldOn(nearest(soupBounds(p.soup).center), p.soup);
      } else if (kind === 'wheel') {
        const front = p.head[1] > 0, sv = p.head[0] < 0 ? -1 : 1;
        seat(`v_${p.id}`, p.soup, (S.wheels && S.wheels[front ? 'front' : 'rear']) || { bone: 'torso', face: 'center' }, sv, true);
      } else if (kind && typeof kind === 'object') {
        seat(`v_${p.id}`, p.soup, kind, soupBounds(p.soup).center[0] < 0 ? -1 : 1);
      }
    }
    for (const [key, soup] of gathered) {
      const [rid, sv] = key.split(':');
      const r = S.regions.find((g) => g.id === rid);
      seat(`v_${rid}${sv === '-1' ? 'L' : sv === '1' ? 'R' : ''}`, soup, r, Number(sv) || 1);
    }
  }

  // ── the composed bone list and parts ──
  const boxWelded = soups.map((s, i) => soupBounds(s) || box[i]);
  const bones = [...skel.bones.map((b) => ({ id: b.id, head: b.head.map(r4) })), ...panels.map((x) => ({ id: x.id, head: x.head.map(r4) }))];
  const parts = [...soups.map((s) => packSoup(s)), ...panels.map((x) => packSoup(x.soup))];
  const NX = bones.length;

  // a panel's frame while its bone is posed (q, h), at its place (R, m) on the bone
  const onBone = (x, q, h, R, m) => [qmul(q, R), vadd(h, qrot(q, vsub(m, head(x.bone))))];
  const push = (out, q, h) => { out.push(r4(q[0]), r4(q[1]), r4(q[2]), r4(q[3]), r4(h[0]), r4(h[1]), r4(h[2])); };

  // ── 4. clips ──
  const clips = {};
  for (const [name, c] of Object.entries(robot.clips)) {
    const b = [];
    for (let k = 0; k < c.k; k++) {
      const o = k * NB * 7;
      for (let i = 0; i < NB * 7; i++) b.push(c.b[o + i]);
      for (const x of panels) {
        const ob = o + x.bone * 7;
        const [q, h] = onBone(x, [c.b[ob], c.b[ob + 1], c.b[ob + 2], c.b[ob + 3]], [c.b[ob + 4], c.b[ob + 5], c.b[ob + 6]], x.Rr, x.mr);
        push(b, q, h);
      }
    }
    clips[name] = { ...c, b };
  }
  const vehicleKey = (spin) => {
    const b = [];
    for (let i = 0; i < NB; i++) push(b, stow.q[i], stow.h[i]);
    for (const x of panels) push(b, x.spin ? qx(spin) : QI, x.head);
    return b;
  };
  clips['vehicle:idle'] = { k: 1, b: vehicleKey(0) };
  if (panels.some((x) => x.spin)) {
    const K = 12, b = [];
    for (let k = 0; k < K; k++) b.push(...vehicleKey(-360 * k / K));
    clips['vehicle:drive'] = { k: K, b };
  }

  // the sequence robot → vehicle, keyed 0 … 1 inclusive
  const W = S.windows || {};
  const winOf = (id) => W[boneGroup(id)] || W.riders || [0, 1];
  const rw = rootWindow(S.stow), pw = W.panels || [0.4, 1];
  const seq = [];
  let groundMin = Infinity;
  for (let k = 0; k < keys; k++) {
    const t = k / (keys - 1);
    const loc = {};
    for (const [id, q] of Object.entries(local)) { const w = winOf(id); loc[id] = qslerp(QI, q, windowEase(t, w[0], w[1])); }
    const at = vlerp(pelvisRest, stowAt, windowEase(t, rw[0], rw[1]));
    at[2] += (S.hop || 0) * H * Math.sin(Math.PI * t);
    const P = fk(skel, { root: { q: rootTurn(S.stow, t), at }, local: loc });
    const frames = [];
    for (let i = 0; i < NB; i++) frames.push([P.q[i], P.h[i]]);
    const a = windowEase(t, pw[0], pw[1]);
    for (const x of panels) {
      // slide from the seat to the vehicle's place on the bone, bowing out from the bone's middle
      const mid = vlerp(x.mr, x.mv, 0.5), out = vsub(mid, box[x.bone].center), ol = vlen(out) || 1;
      const bow = 0.3 * vlen(vsub(x.mv, x.mr)) * Math.sin(Math.PI * a);
      const m = vadd(vlerp(x.mr, x.mv, a), vscale(out, bow / ol));
      frames.push(onBone(x, P.q[x.bone], P.h[x.bone], qslerp(x.Rr, x.Rv, a), m));
    }
    // set on the ground: the lowest corner of any part, lifted to z = 0 (never pushed down)
    let mn = Infinity;
    frames.forEach(([q, h], i) => {
      const bx = i < NB ? boxWelded[i] : soupBounds(panels[i - NB].soup);
      for (const c of corners(bx)) { const z = h[2] + qrot(q, vsub(c, bones[i].head))[2]; if (z < mn) mn = z; }
    });
    const lift = mn < 0 ? -mn : 0;
    groundMin = Math.min(groundMin, mn + lift);
    seq.push(frames.map(([q, h]) => [q, [h[0], h[1], h[2] + lift]]));
  }
  const flat = (order) => { const b = []; for (const k of order) for (const [q, h] of seq[k]) push(b, q, h); return b; };
  const idx = seq.map((_, k) => k);
  clips['transform:vehicle'] = { k: keys, b: flat(idx), once: true };
  clips['transform:robot'] = { k: keys, b: flat(idx.slice().reverse()), once: true };

  // ── the readout: what the machine gate measures ──
  const composedTris = soups.reduce((a, s) => a + soupTris(s), 0) + panels.reduce((a, x) => a + soupTris(x.soup), 0);
  const hiddenShare = V ? frameCover(robot, skel, stow, V) : null;
  const wheels = panels.filter((x) => x.spin);
  const readout = {
    scheme: typeof scheme === 'string' ? scheme : 'custom',
    form: S.form,
    height: r4(H),
    vehicle: V ? { length: r4(V.length), height: r4(V.height), pieces: V.pieces.length } : null,
    // triangles: every one of the robot's and the vehicle's is in the composed figure
    tris: { robot: robotTris, vehicle: vehicleTris, composed: composedTris },
    panels: panels.map((x) => ({ id: x.id, on: skel.bones[x.bone].id, tris: soupTris(x.soup), travel: r4(vlen(vsub(x.mv, x.mr))) })),
    weld,
    ground: { transformMin: r4(groundMin) },
    frameHidden: hiddenShare,
    bones: NX,
  };

  const { rig, bones: _b, parts: _p, clips: _c, figH, model, ...carry } = robot;
  const figure = {
    ...carry,
    rig: true,
    model: 'transformer',
    facing: '+y',
    bones,
    parts,
    clips,
    figH: r4(H),
    forms: {
      base: 'robot', alt: 'vehicle', kind: S.form,
      // what the vehicle form's rule needs of the body (drive: its wheelbase and wheel radius, in the figure's metres)
      ...(wheels.length >= 2 ? {
        wheelbase: r4(Math.max(...wheels.map((w) => w.head[1])) - Math.min(...wheels.map((w) => w.head[1]))),
        wheelRadius: r4(Math.max(...wheels.map((w) => w.head[2]))),
      } : {}),
      length: V ? r4(V.length) : r4(H),
    },
  };
  return { figure, readout };
}
