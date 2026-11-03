/**
 * boat-ship — the builders of a warship's parts on the craft shelf (boat-odm.js), reached through the kinds that own
 * them (boat-mil.js dispatches by family): a ship's superstructure, funnel and hangar (`boat-cabin`), its pyramid mast
 * (`boat-arch`), its main gun's turret, its close-in weapon and its vertical launch cells (`boat-mount`). Every weapon is
 * modelled, never fired: it trains and elevates as a pose, and nothing leaves it. Each stands on a hull's or a part's
 * point (its mount the middle of its foot, +y the bow). Pure.
 *
 *   superstructure   stepped tiers lofted bow to stern, their sides leaning in (the faceted, stealthy hull of a modern
 *                    warship's upperworks), the top tier raked to the bridge's band of windows; doors along the lowest
 *                    tier. Points: `mount`, `top` (where a mast stands), and the row's `points` on a tier's roof
 *   funnel           a faceted stack, raked aft, tapering; its exhausts and its grille on top. Points: `mount`, `top`
 *   hangar           a box with its sides leaning in, its door aft (a helicopter's), its roof. Points: `mount`, `roof`
 *   pyramid          a faceted tower tapering to its platform, a flat radar array on each of its four faces, a
 *                    topmast with its yards, its domes, its whips and the masthead light. Points: `mount`, `top`
 *   turret           a main gun: its ring, its shell faceted and tapered at its nose (it trains), the long barrel with
 *                    its muzzle and the boot at its root (it elevates). Points: `mount`, `muzzle`
 *   ciws             a close-in weapon: its drum, its mount (it trains), the radome over the rotary gun's barrels, its
 *                    shroud, its magazine (it elevates). Points: `mount`, `muzzle`
 *   vls              vertical launch cells in the deck: a block, its cells' hatches in rows. Points: `mount`
 *
 *   scaled(geom, k)  a builder's recipe (its monomers, points and joints) grown k times about its mount: a part drawn
 *                    at its base size and set to a ship's (a shaft drive's `scale`)
 *
 * Craft space: +y forward, +z up, +x starboard, metres.
 */
import { DEG, lathe, sweep, extrudeWorld, loftWorld, planeUV, round3, tone } from './craft-common.js';

const r3v = (v) => v.map(round3);
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => a.map((v) => v * k);
const unit = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, Number.isFinite(v) ? v : 0));
const ccw = (from, to, ring) => { const uv = planeUV(from, to, ring), a = uv.reduce((t, p, i) => { const q = uv[(i + 1) % uv.length]; return t + p[0] * q[1] - q[0] * p[1]; }, 0); return a < 0 ? ring.slice().reverse() : ring; };
const rect = (u, v, w, h) => [[0, 1], [1, 1], [1, 0], [0, 0]].map(([a, b]) => [0, 1, 2].map((k) => u[k] * (a - 0.5) * w + v[k] * (b - 0.5) * h));
const E = (id, from, to, offsets, tint, extra) => extrudeWorld(id, from, to, ccw(from, to, offsets), tint, extra);
const octagon = (r) => Array.from({ length: 8 }, (_, i) => { const a = Math.PI / 8 + (Math.PI * i) / 4; return [r * Math.cos(a), r * Math.sin(a)]; });
const GUNMETAL = '#2e3032', WHITE = '#e7e7e2', ARRAY = '#3a4046';

/** A recipe grown k times about its mount: every axis, profile, path, radius, station, point and joint. */
export function scaled(g, k) {
  if (!k || k === 1) return g;
  const P = (p) => ({ x: round3(p.x * k), y: round3(p.y * k), z: round3(p.z * k) });
  const out = { ...g };
  if (g.lathes) out.lathes = g.lathes.map((l) => ({ ...l, axisFrom: P(l.axisFrom), axisTo: P(l.axisTo), profile: l.profile.map((q) => ({ t: q.t, radius: round3(q.radius * k) })) }));
  if (g.extrudes) out.extrudes = g.extrudes.map((e) => ({ ...e, axisFrom: P(e.axisFrom), axisTo: P(e.axisTo), profile: { ...e.profile, points: e.profile.points.map(([u, v]) => [round3(u * k), round3(v * k)]) } }));
  if (g.sweeps) out.sweeps = g.sweeps.map((w) => ({ ...w, path: w.path.map((q) => q.map((v) => round3(v * k))), radius: round3(w.radius * k) }));
  if (g.lofts) out.lofts = g.lofts.map((l) => ({ ...l, axisFrom: P(l.axisFrom), axisTo: P(l.axisTo), stations: l.stations.map((st) => ({ ...st, profile: st.profile.map(([u, v]) => [round3(u * k), round3(v * k)]) })) }));
  out.hardpoints = Object.fromEntries(Object.entries(g.hardpoints).map(([n, v]) => [n, v.map((x) => round3(x * k))]));
  if (g.joints) out.joints = g.joints.map((j) => ({ ...j, at: j.at.map((x) => round3(x * k)) }));
  return out;
}

// (a faceted section: its sides leaning in from its foot to its top; at z0, h high, w wide at its foot)
const facet = (w, h, z0, lean) => [[w / 2, 0, z0], [w / 2 - lean, 0, z0 + h], [-(w / 2 - lean), 0, z0 + h], [-w / 2, 0, z0]];

export function buildSuperstructure(row, C) {
  const b = row.build, lofts = [], extrudes = [];
  let z = 0;
  const tops = [];
  for (const [i, T] of b.tiers.entries()) {
    const [y0, y1] = T.y, len = y1 - y0, z0 = z - (i ? 0.05 : 0);
    const st = T.front ? [[0, 1], [1 - T.front.rake / len, 1], [1, T.front.k]] : [[0, 1], [1, 1]];
    lofts.push(loftWorld(`tier_${i}`, [0, y0, 0], [0, y1, 0], st.map(([t, k]) => ({ t, points: facet(T.width, T.height * k, z0, T.lean * k) })), C.paint));
    tops.push(z0 + T.height);
    // the bridge: its raked front a band of panes, its leaning sides a row each
    if (T.bridge) {
      const zt = z0 + T.height, zs = z0 + T.height * T.front.k, yf = y1 - T.front.rake, slope = unit([0, y1 - yf, zs - zt]);
      const nrm = unit([0, -slope[2], slope[1]]), up = nrm[2] < 0 ? mul(nrm, -1) : nrm, mid = [0, (yf + y1) / 2, (zt + zs) / 2], span = Math.hypot(y1 - yf, zt - zs);
      const n = T.bridge.panes, pw = (T.width - 2 * T.lean - 1.2) / n;
      for (let k = 0; k < n; k += 1) {
        const c = add(mid, [(k - (n - 1) / 2) * pw, 0, 0]);
        extrudes.push(E(`window_front_${k}`, add(c, mul(up, -0.03)), add(c, mul(up, 0.06)), rect([1, 0, 0], slope, pw - 0.18, span * 0.55), C.glass, { material: 'glass' }));
      }
      for (const sx of [1, -1]) for (let k = 0; k < T.bridge.side; k += 1) {
        const y = y0 + 1 + k * (yf - y0 - 1.5) / T.bridge.side, x = sx * (T.width / 2 - T.lean * 0.55), zc = z0 + T.height * 0.55;
        extrudes.push(E(`window_side_${sx > 0 ? 'r' : 'l'}${k}`, [x - sx * 0.12, y + (yf - y0 - 1.5) / T.bridge.side / 2, zc], [x + sx * 0.05, y + (yf - y0 - 1.5) / T.bridge.side / 2, zc], rect([0, 1, 0], [0, 0, 1], (yf - y0 - 1.5) / T.bridge.side - 0.3, T.height * 0.35), C.glass, { material: 'glass' }));
      }
    }
    z = z0 + T.height;
  }
  // the doors along the lowest tier
  const T0 = b.tiers[0];
  for (const sx of [1, -1]) for (const y of b.doors ?? []) {
    const x = sx * (T0.width / 2 - T0.lean * 0.45);
    extrudes.push(E(`door_${sx > 0 ? 'r' : 'l'}${Math.round(y)}`, [x - sx * 0.04, y, 1.1], [x + sx * 0.06, y, 1.1], rect([0, 1, 0], [0, 0, 1], 1.0, 2.0), tone(C.paint, -0.1)));
  }
  const last = b.tiers[b.tiers.length - 1];
  const hardpoints = { mount: [0, 0, 0], top: r3v([0, b.mastAt ?? (last.y[0] + last.y[1]) / 2, tops[tops.length - 1]]) };
  for (const [name, [i, y, x]] of Object.entries(b.points ?? {})) hardpoints[name] = r3v([x ?? 0, y, tops[i]]);
  return { lofts, extrudes, hardpoints };
}

export function buildFunnel(row, C) {
  const b = row.build, { width: W, length: D } = row.dims, H = b.height, ch = Math.min(W, D) * 0.22;
  const ring = (k, dy) => [[W / 2, D / 2 - ch], [W / 2 - ch, D / 2], [-(W / 2 - ch), D / 2], [-W / 2, D / 2 - ch], [-W / 2, -D / 2 + ch], [-(W / 2 - ch), -D / 2], [W / 2 - ch, -D / 2], [W / 2, -D / 2 + ch]].map(([x, y]) => [x * k, y * k + dy, 0]);
  const lofts = [loftWorld('stack', [0, 0, -0.1], [0, 0, H], [[0, 1, 0], [1, b.taper, -b.rake]].map(([t, k, dy]) => ({ t, points: ring(k, dy) })), C.paint)];
  const extrudes = [E('grille', [0, -b.rake, H - 0.05], [0, -b.rake, H + 0.08], ring(b.taper * 0.9, 0).map(([x, y]) => [x, y, 0]), tone(C.paint, -0.45))];
  const lathes = [];
  for (const sx of [1, -1]) {
    const c = [sx * W * b.taper * 0.2, -b.rake, H];
    lathes.push(lathe(`exhaust_${sx > 0 ? 'r' : 'l'}`, add(c, [0, 0, -0.1]), add(c, [0, -0.15, 0.9]), [[0, 0.5], [1, 0.45]], C.rubber, { samples: 16, crossSections: 2 }));
  }
  return { lofts, extrudes, lathes, hardpoints: { mount: [0, 0, 0], top: r3v([0, -b.rake, H]) } };
}

export function buildHangar(row, C) {
  const b = row.build, { width: W, length: D } = row.dims, H = b.height;
  const lofts = [loftWorld('hangar', [0, -D / 2, 0], [0, D / 2, 0], [0, 1].map((t) => ({ t, points: facet(W, H, 0, b.lean) })), C.paint)];
  // its door aft: a roller door's slats in its frame
  const extrudes = [E('door_frame', [0, -D / 2 + 0.05, b.door.height / 2 + 0.05], [0, -D / 2 - 0.1, b.door.height / 2 + 0.05], rect([1, 0, 0], [0, 0, 1], b.door.width + 0.6, b.door.height + 0.3), tone(C.paint, -0.12))];
  for (let k = 0; k < 8; k += 1) { const z = 0.1 + ((b.door.height - 0.2) * (k + 0.5)) / 8; extrudes.push(E(`door_slat_${k}`, [0, -D / 2 - 0.08, z], [0, -D / 2 - 0.16, z], rect([1, 0, 0], [0, 0, 1], b.door.width, b.door.height / 8 - 0.06), tone(C.paint, -0.25))); }
  return { lofts, extrudes, hardpoints: { mount: [0, 0, 0], roof: r3v([0, D / 2 - 2.5, H]) } };
}

export function buildPyramid(row, C, opts = {}) {
  const b = row.build, H = b.height, [w0, w1] = b.widths, ch = 0.18;
  const sq = (w) => { const h = w / 2, c = w * ch; return [[h, h - c], [h - c, h], [-(h - c), h], [-h, h - c], [-h, -(h - c)], [-(h - c), -h], [h - c, -h], [h, -(h - c)]].map(([x, y]) => [x, y, 0]); };
  const lofts = [loftWorld('tower', [0, 0, -0.1], [0, 0, H], [[0, w0], [1, w1]].map(([t, w]) => ({ t, points: sq(w) })), C.paint)];
  const extrudes = [], lathes = [], sweeps = [];
  // a flat array on each face, on the face's own slope
  const a = Math.atan(((w0 - w1) / 2) / H), hz = H * b.arrays.at, half = w0 / 2 - ((w0 - w1) / 2) * b.arrays.at;
  for (const [k, d] of [[0, 1], [1, 0], [0, -1], [-1, 0]].entries()) {
    const n = unit([d[0] * Math.cos(a), d[1] * Math.cos(a), Math.sin(a)]), c = [d[0] * half, d[1] * half, hz];
    extrudes.push(E(`array_${k}`, add(c, mul(n, -0.05)), add(c, mul(n, 0.12)), octagon(b.arrays.size / 2).map(([u, v]) => { const t = [-d[1], d[0], 0], up = unit([-n[0] * n[2], -n[1] * n[2], 1 - n[2] * n[2]]); return add(mul(t, u), mul(up, v)); }), ARRAY));
  }
  // the topmast, its yards, its domes, its whips, the masthead light
  const top = [0, 0, H], M = b.topmast;
  lathes.push(lathe('platform', add(top, [0, 0, -0.05]), add(top, [0, 0, 0.2]), [[0, w1 * 0.62], [1, w1 * 0.62]], C.paint, { samples: 16, crossSections: 2 }));
  lathes.push(lathe('topmast', add(top, [0, 0, 0.15]), add(top, [0, 0, M.height]), [[0, 0.28], [1, 0.12]], C.paint, { samples: 12, crossSections: 2 }));
  for (const [k, f] of [0.35, 0.7].entries()) sweeps.push(sweep(`yard_${k}`, [add(top, [-M.yard / 2 * (1 - 0.3 * k), 0, M.height * f]), add(top, [M.yard / 2 * (1 - 0.3 * k), 0, M.height * f])], 0.1, C.paint, { sides: 8 }));
  for (const sx of [1, -1]) {
    lathes.push(lathe(`dome_${sx > 0 ? 'r' : 'l'}`, add(top, [sx * M.yard * 0.42, 0, M.height * 0.35 + 0.05]), add(top, [sx * M.yard * 0.42, 0, M.height * 0.35 + 0.9]), [[0, 0.45], [0.55, 0.45], [0.85, 0.32], [1, 0.06]], WHITE, { samples: 20, crossSections: 5 }));
    const e = add(top, [sx * M.yard * 0.35, 0, M.height * 0.7]);
    sweeps.push(sweep(`whip_${sx > 0 ? 'r' : 'l'}`, [e, add(e, [sx * 0.1, -0.2, 2.5]), add(e, [sx * 0.3, -0.6, 5])], 0.03, C.rubber, { sides: 6 }));
  }
  extrudes.push(E('nav_radar', add(top, [-M.yard * 0.3, 0, 0.6]), add(top, [M.yard * 0.3, 0, 0.6]), [[0, 0.3, -0.18], [0, 0.3, 0.18], [0, -0.2, 0.2], [0, -0.3, -0.18]], tone(C.paint, 0.12)));
  const lit = opts.lights === 'covert' ? [C.rubber, {}] : ['#f4f6f8', { material: 'neon' }];
  lathes.push(lathe('masthead_light', add(top, [0, 0, M.height]), add(top, [0, 0, M.height + 0.35]), [[0, 0.14], [0.5, 0.15], [1, 0.08]], lit[0], { ...lit[1], samples: 12, crossSections: 3 }));
  return { lofts, extrudes, lathes, sweeps, hardpoints: { mount: [0, 0, 0], top: r3v(add(top, [0, 0, M.height])) } };
}

// a weapon's frames: what stands (its base), what trains (about the vertical), what elevates (about its trunnions' pin)
function weaponFrames(b, pose, pin) {
  const yaw = ((b.bearing ?? 0) + clamp(pose.train, -1, 1) * 180) * DEG, pitch = clamp(pose.elevate, -1, 1) * (b.elevation ?? 40) * DEG;
  const rz = (v) => [v[0] * Math.cos(yaw) - v[1] * Math.sin(yaw), v[0] * Math.sin(yaw) + v[1] * Math.cos(yaw), v[2]];
  const rx = (v) => [v[0], v[1] * Math.cos(pitch) - v[2] * Math.sin(pitch), v[1] * Math.sin(pitch) + v[2] * Math.cos(pitch)];
  const FR = { base: { P: (p) => p, D: (v) => v }, turn: { P: rz, D: rz }, gun: { P: (p) => rz(add(pin, rx([p[0] - pin[0], p[1] - pin[1], p[2] - pin[2]]))), D: (v) => rz(rx(v)) } };
  const joints = [
    { name: 'train', control: 'train', kind: 'hinge', at: [0, 0, round3(pin[2])], dir: [0, 0, 1], range: [-180, 180], angle: round3((yaw / DEG) - (b.bearing ?? 0)) || 0 },
    { name: 'elevate', control: 'elevate', kind: 'hinge', at: r3v(rz(pin)), dir: r3v(rz([1, 0, 0])), range: [-(b.elevation ?? 40), b.elevation ?? 40], angle: round3(pitch / DEG) || 0 },
  ];
  return { FR, joints };
}
function adders(FR, out) {
  return {
    L: (f, id, a, z, pairs, tint, extra) => out.lathes.push(lathe(id, FR[f].P(a), FR[f].P(z), pairs, tint, extra)),
    F: (f, id, a, z, stations, tint, extra) => out.lofts.push(loftWorld(id, FR[f].P(a), FR[f].P(z), stations.map((st) => ({ t: st.t, points: st.points.map(FR[f].D) })), tint, extra)),
    X: (f, id, a, z, offsets, tint, extra) => { const A = FR[f].P(a), Z = FR[f].P(z); out.extrudes.push(extrudeWorld(id, A, Z, ccw(A, Z, offsets.map(FR[f].D)), tint, extra)); },
  };
}

export function buildTurret(row, C, opts = {}) {
  const b = row.build, S = b.shell, pin = [0, S.length * 0.25, S.height * 0.55];
  const { FR, joints } = weaponFrames(b, opts.pose || {}, pin), out = { lathes: [], lofts: [], extrudes: [] }, { L, F } = adders(FR, out);
  L('base', 'ring', [0, 0, -0.05], [0, 0, 0.35], [[0, S.width * 0.62], [1, S.width * 0.6]], tone(C.paint, -0.08), { samples: 28, crossSections: 2 });
  // the shell: faceted, tapering to its nose, trained with the gun's mount
  const sec = (k) => facet(S.width * k, S.height * (0.55 + 0.45 * k), 0.3, S.width * 0.18 * k);
  F('turn', 'shell', [0, -S.length * 0.45, 0], [0, S.length * 0.55, 0], [[0, 0.92], [0.35, 1], [1, 0.55]].map(([t, k]) => ({ t, points: sec(k) })), C.paint);
  // the barrel from its boot through the shell's nose, its muzzle
  const y0 = S.length * 0.5, zb = pin[2];
  L('gun', 'boot', [0, y0 - 0.4, zb], [0, y0 + 0.4, zb], [[0, 0.55], [1, 0.35]], C.rubber, { samples: 16, crossSections: 3 });
  L('gun', 'barrel', [0, y0, zb], [0, y0 + b.barrel, zb], [[0, 0.24], [1, 0.17]], tone(C.paint, -0.05), { samples: 16, crossSections: 2 });
  L('gun', 'muzzle', [0, y0 + b.barrel - 0.05, zb], [0, y0 + b.barrel + 0.35, zb], [[0, 0.21], [1, 0.2]], tone(C.paint, -0.1), { samples: 16, crossSections: 2 });
  return { ...out, hardpoints: { mount: [0, 0, 0], muzzle: r3v(FR.gun.P([0, y0 + b.barrel + 0.35, zb])) }, joints };
}

export function buildCiws(row, C, opts = {}) {
  const b = row.build, R = b.radome, pin = [0, 0, b.drum + 0.5];
  const { FR, joints } = weaponFrames(b, opts.pose || {}, pin), out = { lathes: [], lofts: [], extrudes: [] }, { L, X } = adders(FR, out);
  L('base', 'drum', [0, 0, -0.05], [0, 0, b.drum], [[0, 0.8], [1, 0.75]], C.paint, { samples: 20, crossSections: 2 });
  X('turn', 'mount', [0, 0.5, b.drum + 0.4], [0, -0.6, b.drum + 0.4], rect([1, 0, 0], [0, 0, 1], 1.0, 0.8), tone(C.paint, -0.06));
  // the radome over the gun (it elevates with it), the rotary barrels in their shroud before it, the magazine under it
  L('gun', 'radome', [0, -0.2, pin[2] + 0.3], [0, -0.2, pin[2] + 0.3 + R.height], [[0, R.radius], [0.62, R.radius], [0.85, R.radius * 0.75], [1, R.radius * 0.1]], WHITE, { samples: 24, crossSections: 5 });
  L('gun', 'shroud', [0, 0.35, pin[2]], [0, 0.35 + b.barrel * 0.35, pin[2]], [[0, 0.22], [1, 0.2]], tone(C.paint, -0.1), { samples: 14, crossSections: 2 });
  for (let k = 0; k < 6; k += 1) { const a = (2 * Math.PI * k) / 6, o = [0.09 * Math.cos(a), 0, 0.09 * Math.sin(a)]; L('gun', `barrel_${k}`, add([0, 0.35, pin[2]], o), add([0, 0.35 + b.barrel, pin[2]], o), [[0, 0.03], [1, 0.03]], GUNMETAL, { samples: 8, crossSections: 2 }); }
  X('gun', 'magazine', [0, 0.25, pin[2] - 0.45], [0, -0.55, pin[2] - 0.45], rect([1, 0, 0], [0, 0, 1], 0.7, 0.5), tone(C.paint, -0.06));
  return { ...out, hardpoints: { mount: [0, 0, 0], muzzle: r3v(FR.gun.P([0, 0.35 + b.barrel, pin[2]])) }, joints };
}

export function buildVls(row, C) {
  const b = row.build, [n, m] = b.cells, p = b.pitch, W = m * p + 0.4, D = n * p + 0.4, extrudes = [];
  extrudes.push(E('block', [0, D / 2, b.height / 2 - 0.05], [0, -D / 2, b.height / 2 - 0.05], rect([1, 0, 0], [0, 0, 1], W, b.height + 0.1), tone(C.paint, -0.06)));
  for (let i = 0; i < n; i += 1) for (let j = 0; j < m; j += 1) {
    const y = (i - (n - 1) / 2) * p, x = (j - (m - 1) / 2) * p;
    extrudes.push(E(`cell_${i}_${j}`, [x, y + p * 0.42, b.height + 0.01], [x, y - p * 0.42, b.height + 0.01], rect([1, 0, 0], [0, 0, 1], p * 0.84, 0.06), tone(C.paint, -0.2)));
  }
  return { extrudes, hardpoints: { mount: [0, 0, 0] } };
}
