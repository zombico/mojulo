/**
 * THE SPOTS: a corpse's flesh gone in patches, scattered as a cow's spots are, each showing the layers under it. A patch
 * is a thin plate lying on the surface it is on (its rim projected onto that surface, so it hugs a trunk's section, a
 * limb's tube, a skull's rows or a head's shape): the meat where the skin went, and on a deep one the bone in the meat.
 *
 *   body       patches of MEAT on the torso and the limbs a corpse still has the flesh of; a deep one with BONE in it
 *   face       on a corpse's own head: patches of bare BONE with a rim of meat (a cheekbone, the brow, a temple, the jaw),
 *              lying on the head's own cranium
 *   skull      on a bared skull: what is left of the face, patches of SKIN with a rim of meat (the scalp, a cheek)
 *
 *   spots(plan, spec, { k, rand, bared })   → { segments }   each patch rigid on its bone
 *   spec { count: [lo, hi], deep, face: [lo, hi] }: how many on the body, the share of them deep, how many on the head
 *   `bared`: the picks (./tiered.js undeadPicks), so no patch lies on a limb gone to bone
 *
 * Pure: the dice are the caller's. Metres; sizes × k (the hero's height over 2 m).
 */
const r3 = (x) => Math.round(x * 1000) / 1000;
const add = (a, b) => a.map((x, i) => x + b[i]);
const sub = (a, b) => a.map((x, i) => x - b[i]);
const mul = (a, s) => a.map((x) => x * s);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v) => mul(v, 1 / (Math.hypot(...v) || 1));
const rad = (r) => (Array.isArray(r) ? (r[0] + r[1]) / 2 : r);
const SLOTS = ['front', 'frontR', 'frontSideR', 'sideR', 'backSideR', 'backR', 'back', 'backL', 'backSideL', 'sideL', 'frontSideL', 'frontL'];
const TINT = '#cccccc';

// ── the surfaces a patch lies on: each takes a point near it → { p: on the surface, n: its outward normal } ──
// a trunk's: its section at the point's height (a superellipse of half width, half depth, centre forward)
function onTrunk(trunk) {
  const S = trunk.stations;
  return (q) => {
    const f = S.findIndex((st, j) => j < S.length - 1 && q[2] <= S[j + 1].z), i = f < 0 ? S.length - 2 : f, a = S[i], b = S[i + 1];
    const t = Math.max(0, Math.min(1, (q[2] - a.z) / (b.z - a.z || 1))), rr = (r) => (Array.isArray(r) ? r : [r, r]), [ax, ay] = rr(a.r), [bx, by] = rr(b.r);
    const rx = ax + (bx - ax) * t, ry = ay + (by - ay) * t, yc = (a.yc ?? 0) + ((b.yc ?? 0) - (a.yc ?? 0)) * t, e = a.e ?? 2.2;
    const th = Math.atan2(q[0] / rx, (q[1] - yc) / ry), pw = (v) => Math.sign(v) * Math.abs(v) ** (2 / e);
    return { p: [rx * pw(Math.sin(th)), yc + ry * pw(Math.cos(th)), q[2]], n: unit([Math.sin(th) / rx, Math.cos(th) / ry, 0]) };
  };
}
// a limb's: the tube round its bone between two joints, its radius drawn between its ends
function onTube(A, B, rA, rB) {
  const d = unit(sub(B, A)), L = Math.hypot(...sub(B, A));
  return (q) => {
    const s = Math.max(0, Math.min(L, dot(sub(q, A), d))), c = add(A, mul(d, s)), n = unit(sub(sub(q, c), mul(d, dot(sub(q, c), d))));
    return { p: add(c, mul(n, rA + (rB - rA) * (s / L))), n };
  };
}
// a head's: its own cranium's points, the reach in a direction read from the nearest few of them about its middle
function onHead(points) {
  const c = [0, 1, 2].map((i) => (Math.min(...points.map((q) => q[i])) + Math.max(...points.map((q) => q[i]))) / 2);
  const dirs = points.map((q) => { const v = sub(q, c); return { d: unit(v), r: Math.hypot(...v) }; });
  return (q) => {
    const d = unit(sub(q, c)), near = dirs.map((x) => ({ ...x, cos: dot(x.d, d) })).sort((a, b) => b.cos - a.cos).slice(0, 4);
    const w = near.map((x) => Math.max(1e-6, x.cos) ** 8), r = near.reduce((t, x, i) => t + x.r * w[i], 0) / w.reduce((t, x) => t + x, 0);
    return { p: add(c, mul(d, r)), n: d };
  };
}

// one patch: a thin plate about `centre` on `surface`, `a` × `b` across (along u and its cross), its two faces `lift`
// and `sink` off the surface; its caps a little proud, so it reads as a raised scab of its layer
// (its outline a blob, not an ellipse: each rim point's reach `wob[i]` × the ellipse's, as a cow's spot is ragged)
function patch(name, surface, centre, u0, a, b, { lift, sink = lift }, group, bone, wob = null) {
  const { p: c, n } = surface(centre), u = unit(sub(u0, mul(n, dot(u0, n))));
  let s = unit(cross(u, n)); if (s[0] < 0) s = mul(s, -1);
  const rim = SLOTS.map((_, i) => { const t = (2 * Math.PI * i) / SLOTS.length, w = wob?.[i] ?? 1; return surface(add(c, add(mul(u, a * w * Math.cos(t)), mul(s, b * w * Math.sin(t))))); });
  const ring = (off) => Object.fromEntries(SLOTS.map((sl, i) => [sl, add(rim[i].p, mul(rim[i].n, off)).map(r3)]));
  return { name, kind: 'rings', slots: 'ring12', stations: [{ id: 'st0', points: ring(-sink) }, { id: 'st1', points: ring(lift) }],
    caps: { back: add(c, mul(n, -sink * 1.5)).map(r3), tip: add(c, mul(n, lift * 1.6)).map(r3) }, group, tint: TINT, mirror: null, bind: { bone } };
}

export function spots(plan, spec, { k, rand, bared = [] }) {
  const segments = [], J = plan.joints, seg = (n) => plan.segments.find((s) => s.name === n);
  const range = ([lo, hi]) => lo + Math.floor(rand() * (hi - lo + 1)), between = (lo, hi) => lo + (hi - lo) * rand();
  // a ragged outline: two lobes and three, at seeded phases, the reach between 0.6 and 1.4 of the ellipse's
  const blob = () => { const p2 = rand() * 6.283, p3 = rand() * 6.283, a2 = between(0.12, 0.25), a3 = between(0.06, 0.16);
    return SLOTS.map((_, i) => { const t = (2 * Math.PI * i) / SLOTS.length; return Math.max(0.6, Math.min(1.4, 1 + a2 * Math.sin(2 * t + p2) + a3 * Math.sin(3 * t + p3))); }); };
  const gone = new Set(bared.flatMap(({ part, side }) => ({ arm: ['upperArm', 'foreArm'], foreArm: ['foreArm'], halfForeArm: ['foreArm'], halfUpperArm: ['upperArm'], thigh: ['thigh'], halfThigh: ['thigh'], shin: ['shank'], halfShin: ['shank'] }[part] ?? []).map((l) => `${l}${side}`)));
  const mir = (p) => [-p[0], p[1], p[2]];
  // the places a patch can lie: the torso, and each limb the corpse still has the flesh of
  const torso = seg('torso'), places = [];
  if (torso?.kind === 'trunk') places.push({ w: 3, bone: 'torso', surface: onTrunk(torso), pick: () => { const z = between(J.hip[2] + 0.12 * k, J.shoulder[2] - 0.05 * k), th = between(-Math.PI, Math.PI); return [Math.sin(th), Math.cos(th), z]; } });
  for (const [limb, from, to] of [['upperArm', 'shoulder', 'elbow'], ['foreArm', 'elbow', 'wrist'], ['thigh', 'hip', 'knee'], ['shank', 'knee', 'ankle']]) for (const S of ['R', 'L']) {
    const P = seg(`${limb}R`); if (!P || gone.has(`${limb}${S}`)) continue;
    const A = S === 'R' ? J[from] : J[`${from}__L`] ?? mir(J[from]), B = S === 'R' ? J[to] : J[`${to}__L`] ?? mir(J[to]);
    const rA = P.kind === 'loft' ? rad(P.stations[0].r) : rad(P.rA), rB = P.kind === 'loft' ? rad(P.stations.at(-1).r) : rad(P.rB);
    const d = unit(sub(B, A)), side = unit(cross(d, [0, 1, 0]));
    places.push({ w: 1, bone: `${limb}${S}`, surface: onTube(A, B, rA, rB), axis: d, pick: () => { const t = between(0.25, 0.75), phi = between(0, 2 * Math.PI); return add(add(A, mul(sub(B, A), t)), add(mul(side, Math.cos(phi) * 0.2), mul(unit(cross(d, side)), Math.sin(phi) * 0.2))); } });
  }
  const total = places.reduce((t, p) => t + p.w, 0), choose = () => { let x = rand() * total; for (const p of places) { x -= p.w; if (x <= 0) return p; } return places.at(-1); };
  // the body's patches: meat where the skin went; a deep one with the bone in it
  const n = places.length ? range(spec.count ?? [5, 9]) : 0;
  for (let i = 0; i < n; i++) {
    const P = choose(), q0 = P.pick(), q = P.bone === 'torso' ? (({ p }) => p)(P.surface([q0[0] * 0.3, (torso.stations[0].yc ?? 0) + q0[1] * 0.3, q0[2]])) : q0;
    const big = P.bone === 'torso' ? between(0.03, 0.065) * k : between(0.014, 0.028) * k, a = big, b = big * between(0.55, 1), u = P.axis ?? [rand() - 0.5, rand() - 0.5, rand() - 0.5];
    segments.push(patch(`spot${i}`, P.surface, q, u, a, b, { lift: 0.004 * k, sink: 0.01 * k }, 'Meat', P.bone, blob()));
    if (rand() < (spec.deep ?? 0.3)) segments.push(patch(`spot${i}Bone`, P.surface, q, u, a * 0.5, b * 0.45, { lift: 0.008 * k, sink: 0.004 * k }, 'Bone', P.bone, blob()));
  }
  // the head: on a corpse's own head, bone showing through the face; on a bared skull, what is left of the face
  const hb = J.headBase, brain = seg('braincase'), m = range(spec.face ?? [2, 3]);
  const FACE = [[0.06, 0.08, 0.06], [0, 0.11, 0.1], [0.07, 0.03, 0.1], [0.05, 0.07, -0.01], [-0.06, 0.08, 0.06], [-0.07, 0.03, 0.1], [0.02, -0.06, 0.13]];
  const picks = [...FACE].sort(() => rand() - 0.5).slice(0, m);
  if (brain) {
    // (the skull's own rows: a patch of skin on a meat rim, the meat a share wider so its edge shows)
    // (a patch at the front lies on the face's rows, the rest on the braincase's)
    const face = seg('face'), onBrain = onTrunk(brain), onFace = face?.kind === 'trunk' ? onTrunk(face) : onBrain;
    picks.forEach(([x, y, z], i) => { const q = add(hb, mul([x, y, z + 0.03], k)), s = between(0.025, 0.045) * k, surface = y > 0.05 ? onFace : onBrain;
      const w = blob();
      segments.push(patch(`skullMeat${i}`, surface, q, [0, 0, 1], s * 1.2, s * 0.95, { lift: 0.004 * k, sink: 0.006 * k }, 'Meat', 'head', w));
      segments.push(patch(`skullSkin${i}`, surface, q, [0, 0, 1], s, s * 0.78, { lift: 0.008 * k, sink: 0.002 * k }, 'Skin', 'head', w)); });
  } else if (plan.include?.some((x) => x.name === 'head')) {
    // (the corpse's own head, as an ellipsoid about its middle: a patch of bone in a rim of meat)
    const inc = plan.include.find((x) => x.name === 'head'), shift = inc.shift ?? hb;
    const surface = onHead(Object.values(inc.parts.cranium?.stations ?? []).flatMap((st) => Object.values(st.points)).map((q) => add(q, shift)));
    picks.forEach(([x, y, z], i) => { const q = add(hb, mul([x, y, z], k)), s = between(0.022, 0.036) * k, w = blob();
      segments.push(patch(`faceMeat${i}`, surface, q, [0, 0, 1], s * 1.35, s * 1.1, { lift: 0.003 * k, sink: 0.006 * k }, 'Meat', 'head', w));
      segments.push(patch(`faceBone${i}`, surface, q, [0, 0, 1], s, s * 0.8, { lift: 0.006 * k, sink: 0.002 * k }, 'Bone', 'head', blob())); });
  }
  return { segments };
}
