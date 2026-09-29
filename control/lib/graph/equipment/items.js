// equipment/items — the staff, the bow and the shield, on the same dials and laws as the sword. Each one is where a
// law was found:
//   staff   the focal at the END of a long shaft (law 6). Heads: plain · branch (grown by the pipe model, law 7,
//           cradling a stone at its girdle) · claw (prongs orbiting the stone) · crescent (a boss inside a moon, with
//           wings) · block (a reliquary with a face-set stone) · mace · ringed (a loop hung with rings)
//   bow     a focal that IS a curve (`curve`, `length`), or the riser under the hand when it carries a stone. Limbs:
//           longbow · recurve · horn · yumi (the grip a third of the way up). Tips: leaf · wing · spike · horn
//   shield  a focal on a FACE (law 1b), with leading lines from the rim into it. Outlines: round · heater · kite.
//           Devices: chevron · rays · bands · spikes · mon · wings · vine
import { focalStone, recede, focalGrow as growOf, lerp } from './principles.js';
import { mulberry32, r3, P, A, circle, mat, mergeInto as merge, push, setStone, feather, ribbon } from './shapes.js';

export const ITEMS = Object.freeze({ staff: { L: 175, R: 1.6 }, bow: { L: 180, W: 3.0, T: 2.2, brace: 16 }, shield: { R: 38, H: 72, T: 1.8 } });
const GEMLESS_HEADS = ['plain', 'mace', 'ringed'];

// ---------------------------------------------------------------- staff
function staff(m, { d, law, roles, gem, lang, minF, focalGrow, rng }) {
  const L = ITEMS.staff.L * law.length, R = ITEMS.staff.R * law.hilt ** 0.5 * d.mass ** 0.5;
  const head = lang.head, fit = mat(roles.fittings), acc = mat(roles.accent);
  const st = gem ? focalStone({ stylize: d.stylize, host: R * 2.6 }) : null;
  const trace = {};
  if (st) trace.focal = { at: 'head', gem: gem.gem, size: r3(st.size), share: r3(st.size / (2 * R)), setting: st.setting };
  // head height budget, from the focal
  const HH = st ? st.size * 1.9 + R * 2 : head === 'plain' ? R * 5 : R * 9 * focalGrow;
  const zTop = L - HH;
  push(m, 'lathes', { group: 'heel', axisFrom: P(0, 0, 0), axisTo: P(0, 0, 6), profile: [{ t: 0, radius: r3(R * 0.55) }, { t: 0.2, radius: r3(R * 1.12) }, { t: 1, radius: r3(R * 1.08) }], ...fit });
  if (lang.shaftForm === 'gnarled') {
    // a grown stick, not a turned one: the axis wanders, the girth swells at knots (seeded, deterministic)
    const path = [], n = 36, knots = [0.18, 0.41, 0.63, 0.86].map((k) => k + 0.05 * (rng() - 0.5));
    for (let i = 0; i <= n; i++) { const t = i / n; path.push([1.1 * R * Math.sin(2.3 * Math.PI * t + 0.7) * (0.6 + 0.4 * rng()), 0.9 * R * Math.sin(1.7 * Math.PI * t), 5 + t * (zTop - 4.5)]); }
    push(m, 'lofts', ribbon({ path, w: (t) => R * (1.08 - 0.18 * t) * (1 + knots.reduce((a, k) => a + 0.28 * Math.exp(-(((t - k) / 0.025) ** 2)), 0)), h: () => 0, round: true, role: roles.shaft, group: 'shaft', minF }));
  } else push(m, 'lathes', { group: 'shaft', axisFrom: P(0, 0, 5), axisTo: P(0, 0, zTop + 0.5), profile: [{ t: 0, radius: r3(R) }, { t: 0.5, radius: r3(R * 0.94) }, { t: 1, radius: r3(R * 0.9) }], ...mat(roles.shaft) });
  const gz = 0.56 * L, gl = 22;  // the grip band, where the hand goes
  push(m, 'lathes', { group: 'grip', axisFrom: P(0, 0, gz - gl / 2), axisTo: P(0, 0, gz + gl / 2), profile: Array.from({ length: 9 }, (_, i) => ({ t: r3(i / 8), radius: r3(R * (i % 2 ? 1.13 : 1.06)) })), ...mat(roles.wrap) });
  push(m, 'lathes', { group: 'collar', axisFrom: P(0, 0, zTop - 3 * law.hilt), axisTo: P(0, 0, zTop + 1), profile: [{ t: 0, radius: r3(R * 0.95) }, { t: 0.4, radius: r3(R * 1.3) }, { t: 1, radius: r3(R * 1.15) }], ...acc });
  const sockets = { grip: { origin: A(0, 0, gz), axis: [0, 0, 1], length: gl }, tip: { origin: A(0, 0, L) }, heel: { origin: A(0, 0, 0) } };

  if (head === 'plain') {
    push(m, 'lathes', { group: 'head', axisFrom: P(0, 0, zTop), axisTo: P(0, 0, L), profile: [{ t: 0, radius: r3(R * 1.08) }, { t: 0.8, radius: r3(R * 1.12) }, { t: 1, radius: r3(R * 0.55) }], ...fit });
  } else if (head === 'branch') {
    // law 7: limbs share the shaft's cross-section (r² = Σ rᵢ²), spiral up, cradle the stone at its girdle (law 3),
    // and fork into twigs by the same rule; fewer, fatter twigs as stylize rises (law 2)
    const nL = lang.limbs || 3, rL = R * Math.sqrt(1 / nL) * 1.2, Rc = st.r + rL * 0.35, zc = zTop + Rc * 0.94 + 1;
    const twist = law.twist * Math.PI;
    const limbPts = [];
    for (let k = 0; k < nL; k++) {
      const phi = (2 * Math.PI * k) / nL + 0.4 * (rng() - 0.5), path = [[R * 0.35 * Math.cos(phi), R * 0.35 * Math.sin(phi), zTop - 2]];
      for (let i = 0; i <= 20; i++) { const u = i / 20, th = (-72 + 150 * u) * Math.PI / 180, sp = phi + twist * u * (k % 2 ? -0.35 : 1);
        const rho = Rc * Math.cos(th) + (u > 0.78 ? (u - 0.78) * st.r * 2.4 : 0) + 0.12 * rL * (rng() - 0.5);
        path.push([rho * Math.cos(sp), rho * Math.sin(sp), zc + Rc * Math.sin(th) * 1.2 + (u > 0.85 ? (u - 0.85) * st.r * 1.5 : 0)]); }
      const rOf = (t) => rL * (1 - 0.82 * t ** 1.2);
      push(m, 'lofts', ribbon({ path, w: rOf, h: () => 0, round: true, role: roles.shaft, group: 'branches', minF }));
      limbPts.push({ path, rOf, phi });
    }
    const nT = Math.max(0, Math.round((lang.twigs || 0) * law.notches));
    const leafAt = (p, dir, size) => { const lp = []; for (let i = 0; i <= 8; i++) { const v = i / 8; lp.push([p[0] + dir[0] * size * v, p[1] + dir[1] * size * v, p[2] + size * 0.35 * v + size * 0.15 * Math.sin(Math.PI * v)]); }
      push(m, 'lofts', ribbon({ path: lp, w: (t) => size * 0.32 * Math.sin(Math.PI * Math.min(1, t * 1.02)) ** 0.8, h: () => Math.max(minF / 2, size * 0.03), role: roles.leaf || ['matte', '#5d8a3c'], group: 'leaves', minF })); };
    limbPts.forEach(({ path, rOf, phi }, k) => {
      for (let j = 0; j < nT; j++) {
        const u0 = 0.3 + 0.4 * (j + rng()) / Math.max(1, nT), i0 = Math.round(u0 * (path.length - 1)), p0 = path[i0], r0 = rOf(u0) * Math.sqrt(0.3);
        const out = [Math.cos(phi + j * 1.9), Math.sin(phi + j * 1.9)], len = st.size * (0.7 + 0.5 * rng()) * lerp(1, 1.25, d.stylize), tw = [];
        for (let i = 0; i <= 10; i++) { const v = i / 10; tw.push([p0[0] + out[0] * len * v, p0[1] + out[1] * len * v, p0[2] + len * (0.2 * v + 0.55 * v * v)]); }
        push(m, 'lofts', ribbon({ path: tw, w: (t) => r0 * (1 - 0.85 * t), h: () => 0, round: true, role: roles.shaft, group: 'branches', minF }));
        if (lang.leaves) { leafAt(tw[10], out, st.size * 0.55 * lerp(1, 1.3, d.stylize)); leafAt(tw[6], [-out[1], out[0]], st.size * 0.4); }
      }
      if (lang.leaves) { const tip = path[path.length - 1]; leafAt(tip, [Math.cos(phi), Math.sin(phi)], st.size * 0.5); }
    });
    push(m, 'fields', { group: 'head', cells: 40, terms: [{ id: 'stone', op: 'add', shape: { kind: 'crystal', gem: gem.gem, cut: gem.cut || 'brilliant', center: A(0, 0, zc), size: r3(st.size), axis: [0, 0, 1], glow: r3(Math.min(1, gem.glow)) } }], ...mat(roles.accent) });
    sockets.focal = { origin: A(0, 0, zc) };
  } else if (head === 'claw') {
    // law 3: the prongs are an orbit around the stone, touching its girdle
    const pr = Math.max(minF, R * 0.42 * law.hilt ** 0.3), Rc = st.r + pr * 0.55, zc = zTop + Rc * 0.94 + 0.5;
    const n = head === 'claw' ? 5 : 3;
    for (let k = 0; k < n; k++) {
      const phi = (2 * Math.PI * k) / n, path = [];
      for (let i = 0; i <= 18; i++) { const u = i / 18;
        if (true) { const th = (-70 + 142 * u) * Math.PI / 180, rho = Rc * Math.cos(th) * (u > 0.85 ? 1 + (u - 0.85) * 1.2 : 1);
          path.push([rho * Math.cos(phi), rho * Math.sin(phi), zc + Rc * Math.sin(th)]); }
        else { const th = (-70 + 150 * u) * Math.PI / 180, sp = phi + 1.3 * Math.PI * u, rho = Rc * Math.cos(th) + (u > 0.8 ? (u - 0.8) * st.r * 1.6 : 0);
          path.push([rho * Math.cos(sp), rho * Math.sin(sp), zc + Rc * Math.sin(th) * 1.15]); } }
      path.unshift([R * 0.5 * Math.cos(phi), R * 0.5 * Math.sin(phi), zTop - 1]);
      push(m, 'lofts', ribbon({ path, w: (t) => pr * (1 - 0.75 * t ** 1.5), h: () => 0, round: true, role: head === 'branch' ? roles.shaft : roles.accent, group: 'head', minF }));
    }
    push(m, 'fields', { group: 'head', cells: 40, terms: [{ id: 'stone', op: 'add', shape: { kind: 'crystal', gem: gem.gem, cut: gem.cut || 'brilliant', center: A(0, 0, zc), size: r3(st.size), axis: [0, 0, 1], glow: r3(Math.min(1, gem.glow)) } }], ...acc });
    sockets.focal = { origin: A(0, 0, zc) };
  } else if (head === 'crescent') {
    const zc = zTop + st.size * 1.1 + R, Rm = st.bossR * 1.75;
    push(m, 'lathes', { group: 'head', axisFrom: P(0, 0, zTop), axisTo: P(0, 0, zc), profile: [{ t: 0, radius: r3(R * 1.1) }, { t: 1, radius: r3(R * 0.8) }], ...fit });
    const arc = []; for (let i = 0; i <= 28; i++) { const th = (150 + 240 * i / 28) * Math.PI / 180; arc.push([Rm * Math.cos(th), 0, zc + Rm * Math.sin(th)]); }
    push(m, 'lofts', ribbon({ path: arc, w: (t) => st.r * 0.55 * Math.sin(Math.PI * t) ** 0.7, h: () => R * 0.45, role: roles.fittings, group: 'head', minF }));
    merge(m, setStone({ at: [0, 0, zc], axis: [0, 1, 0], st, gem, roles, group: 'head', bossDepth: Math.max(R * 0.8, st.r * 0.45) }));
    if (lang.wings) for (const s of [1, -1]) {
      push(m, 'lofts', feather({ s, root: [s * st.bossR * 0.7, 0, zc], len: Rm * 1.6, rise: 0.75, width: st.r * 0.5, thick: R * 0.3, role: roles.fittings, minF }));
      push(m, 'lofts', feather({ s, root: [s * st.bossR * 0.7, 0, zc - st.r * 0.3], len: Rm * 1.2, rise: 0.35, width: st.r * 0.4, thick: R * 0.26, role: roles.fittings, minF }));
    }
    sockets.focal = { origin: A(0, 0, zc) };
  } else if (head === 'block') {
    const bw = st.bossR * 2.3, bh = st.bossR * 2.2, D = Math.max(R * 1.3, st.r * 0.5), zc = zTop + bh / 2 + 1;
    push(m, 'extrudes', { group: 'head', profile: { rect: { w: bw, h: bh, r: bw * 0.06 } }, axisFrom: P(0, -D, zc), axisTo: P(0, D, zc), ...fit });
    for (const z of [zc - bh / 2, zc + bh / 2]) push(m, 'extrudes', { group: 'head', profile: { rect: { w: bw * 1.08, h: bh * 0.1, r: 0 } }, axisFrom: P(0, -D * 1.08, z), axisTo: P(0, D * 1.08, z), ...acc });
    push(m, 'lathes', { group: 'head', axisFrom: P(0, 0, zc + bh * 0.55), axisTo: P(0, 0, zc + bh * 0.55 + bw * 0.45), profile: [{ t: 0, radius: r3(bw * 0.45) }, { t: 1, radius: 0 }], samples: 4, ...fit });
    merge(m, setStone({ at: [0, 0, zc], axis: [0, 1, 0], st, gem, roles, group: 'head', bossDepth: D + st.r * 0.2 }));
    sockets.focal = { origin: A(0, 0, zc) };
  } else if (head === 'mace') {
    const hr = R * 2.6 * focalGrow, hl = R * 4.5 * focalGrow, z0 = zTop;
    push(m, 'lathes', { group: 'head', axisFrom: P(0, 0, z0), axisTo: P(0, 0, z0 + hl), profile: [{ t: 0, radius: r3(R) }, { t: 0.25, radius: r3(hr * 0.9) }, { t: 0.6, radius: r3(hr) }, { t: 1, radius: r3(hr * 0.3) }], harmonics: [{ n: 6, amplitude: r3(hr * 0.22) }], samples: 48, ...fit });
    for (let k = 0; k < 6; k++) { const a = (2 * Math.PI * k) / 6, zc = z0 + hl * 0.58;
      push(m, 'lathes', { group: 'head', axisFrom: P(hr * 0.9 * Math.cos(a), hr * 0.9 * Math.sin(a), zc), axisTo: P(hr * 1.8 * Math.cos(a), hr * 1.8 * Math.sin(a), zc + hr * 0.2), profile: [{ t: 0, radius: r3(hr * 0.28) }, { t: 1, radius: 0 }], ...fit }); }
    push(m, 'lathes', { group: 'head', axisFrom: P(0, 0, z0 + hl * 0.9), axisTo: P(0, 0, z0 + hl + hr * 1.3), profile: [{ t: 0, radius: r3(hr * 0.32) }, { t: 1, radius: 0 }], ...fit });
    sockets.focal = { origin: A(0, 0, z0 + hl * 0.6) };
  } else if (head === 'ringed') {
    const a = R * 4.2 * focalGrow, b = R * 4.8 * focalGrow, zb = zTop, tube = Math.max(minF / 2, R * 0.32);
    const loop = []; for (let i = 0; i <= 48; i++) { const th = -Math.PI / 2 + (2 * Math.PI * i) / 48, s = Math.sin(th);
      loop.push(A(a * Math.cos(th) * (1 - 0.35 * Math.max(0, s) ** 3), 0, zb + b * (1 + s) * (1 + 0.28 * Math.max(0, s) ** 6))); }
    push(m, 'sweeps', { group: 'head', path: loop, radius: r3(tube), sides: 10, ...acc });
    push(m, 'lathes', { group: 'head', axisFrom: P(0, 0, zb), axisTo: P(0, 0, zb + b * 1.3), profile: [{ t: 0, radius: r3(R * 0.9) }, { t: 0.5, radius: r3(R * 1.3) }, { t: 0.7, radius: r3(R * 0.6) }, { t: 1, radius: 0 }], harmonics: [{ n: 8, amplitude: r3(R * 0.12) }], ...acc });
    const rr = R * 1.5 * focalGrow ** 0.6;
    for (const th of [200, 180, 160, 340, 0, 20]) { const t = th * Math.PI / 180, s = Math.sin(t);
      const p = [a * Math.cos(t) * (1 - 0.35 * Math.max(0, s) ** 3), 0, zb + b * (1 + s) * (1 + 0.28 * Math.max(0, s) ** 6)];
      push(m, 'sweeps', { group: 'head', path: circle([p[0], p[1], p[2] - rr + tube], rr, 24, 'yz'), radius: r3(Math.max(minF / 2, tube * 0.55)), sides: 6, ...acc }); }
    sockets.focal = { origin: A(0, 0, zb + b) };
  }
  return { sockets, trace, length: L };
}

// ---------------------------------------------------------------- bow
function bow(m, { d, law, roles, gem, lang, minF, focalGrow }) {
  const I = ITEMS.bow, L = I.L * law.length * (lang.limb === 'horn' ? 0.62 : lang.limb === 'recurve' ? 0.86 : lang.limb === 'yumi' ? 1.18 : 1);
  const W = I.W * law.bladeW, T = I.T * law.bladeT, depth = I.brace * law.curve * (lang.limb === 'horn' ? 0.8 : 1);
  const rec = { longbow: 0, recurve: 0.9, horn: 1.5, yumi: 0.35 }[lang.limb] * law.curve;
  const riserL = L * 0.15, zg = L * (lang.limb === 'yumi' ? 0.37 : 0.5);
  const limbs = [{ s: 1, len: L - zg - riserL / 2 }, { s: -1, len: zg - riserL / 2 }];
  const xOf = (u) => -depth * u ** 1.6 + rec * depth * Math.max(0, (u - 0.7) / 0.3) ** 2 * 1.1;
  const tips = [];
  for (const { s, len } of limbs) {
    const path = []; for (let i = 0; i <= 24; i++) { const u = i / 24; path.push([xOf(u) - (u === 0 ? 0 : 0), 0, zg + s * (riserL / 2 - 1 + u * (len + 1))]); }
    push(m, 'lofts', ribbon({ path, w: (t) => W / 2 * lerp(1, 0.42, t), h: (t) => T / 2 * lerp(1, 0.5, t), roll: 0, role: roles.shaft, group: 'limb', minF }));
    tips.push(path[path.length - 1]);
    push(m, 'lathes', { group: 'limb', axisFrom: P(...path[path.length - 2]), axisTo: P(...path[path.length - 1].map((v, k) => v + (k === 2 ? s * 1.5 : 0))), profile: [{ t: 0, radius: r3(T * 0.4) }, { t: 1, radius: r3(T * 0.25) }], ...mat(roles.fittings) });
  }
  // riser: thicker, and the hand's place
  push(m, 'lofts', ribbon({ path: [[0, 0, zg - riserL / 2], [T * 0.35, 0, zg], [0, 0, zg + riserL / 2]], w: (t) => W / 2 * 1.15, h: (t) => T * lerp(0.6, 1.1, Math.sin(Math.PI * t)), roll: 0, role: roles.shaft, group: 'riser', minF }));
  push(m, 'lathes', { group: 'grip', axisFrom: P(T * 0.2, 0, zg - riserL * 0.28), axisTo: P(T * 0.2, 0, zg + riserL * 0.05), profile: [{ t: 0, radius: r3(T * 0.95) }, { t: 0.5, radius: r3(T * 1.02) }, { t: 1, radius: r3(T * 0.95) }], ...mat(roles.wrap) });
  const string = [tips[0].map((v, k) => (k === 0 ? v - T * 0.2 : v)), tips[1].map((v, k) => (k === 0 ? v - T * 0.2 : v))];
  push(m, 'sweeps', { group: 'string', path: string.map((p) => A(...p)), radius: r3(Math.max(0.12, minF / 2)), sides: 6, tint: '#e8e2d0', material: 'matte' });
  const trace = {}; const sockets = { grip: { origin: A(T * 0.2, 0, zg - riserL * 0.1), axis: [0, 0, 1], length: riserL * 0.33 }, nockTop: { origin: A(...tips[0]) }, nockBottom: { origin: A(...tips[1]) } };
  if (gem) {
    const st = focalStone({ stylize: d.stylize, host: W * 1.1 });
    merge(m, setStone({ at: [T * 0.35, 0, zg + riserL * 0.24], axis: [0, 1, 0], st, gem, roles, group: 'riser', bossDepth: Math.max(W * 0.55, st.r * 0.4) }));
    trace.focal = { at: 'riser', gem: gem.gem, size: r3(st.size), share: r3(st.size / W), setting: st.setting };
  }
  // tip ornaments: secondary, they scale with the law but stay below the focal
  const orn = lerp(1, 1.8, d.stylize);
  tips.forEach((tp, k) => { const s = k === 0 ? 1 : -1;
    if (lang.tips === 'wing') { push(m, 'lofts', feather({ s: 1, root: [tp[0] - W * 0.2, 0, tp[2] - s * W], len: 14 * orn, rise: -0.25 * s, width: W * 0.9 * orn, thick: T * 0.2, role: roles.accent, minF }));
      push(m, 'lofts', feather({ s: 1, root: [tp[0] - W * 0.2, 0, tp[2] - s * W * 2.5], len: 10 * orn, rise: -0.5 * s, width: W * 0.7 * orn, thick: T * 0.18, role: roles.accent, minF })); }
    if (lang.tips === 'leaf') { const path = []; for (let i = 0; i <= 10; i++) { const u = i / 10; path.push([tp[0] + 6 * orn * u, 0, tp[2] + s * (2 + 5 * orn * Math.sin(u * 1.4))]); }
      push(m, 'lofts', ribbon({ path, w: (t) => W * 0.9 * orn * Math.sin(Math.PI * Math.min(1, t * 1.05)) ** 0.8, h: () => T * 0.15, role: roles.accent, group: 'tips', minF })); }
    if (lang.tips === 'spike') for (const a of [0.3, -0.5]) push(m, 'lathes', { group: 'tips', axisFrom: P(tp[0], 0, tp[2] - s * 2), axisTo: P(tp[0] + 9 * orn * Math.cos(a), 0, tp[2] + s * 9 * orn * Math.sin(a + 0.8)), profile: [{ t: 0, radius: r3(T * 0.55) }, { t: 1, radius: 0 }], ...mat(roles.accent) });
    if (lang.tips === 'horn') { const path = []; for (let i = 0; i <= 16; i++) { const u = i / 16, a = u * 1.7 * Math.PI, rr = 4 * orn * (1 - 0.55 * u); path.push([tp[0] + rr * Math.sin(a), 0, tp[2] + s * (rr * (1 - Math.cos(a)) * 0.9)]); }
      push(m, 'lofts', ribbon({ path, w: (t) => T * 0.7 * (1 - 0.7 * t), h: () => 0, round: true, role: roles.accent, group: 'tips', minF })); }
  });
  if (d.focus === 'tips') trace.focal = { at: 'tips', grow: r3(orn) };
  return { sockets, trace, length: L };
}

// ---------------------------------------------------------------- shield
function outlinePts(kind, R, H) {
  const pts = [];
  if (kind === 'round') return null;
  const Wd = kind === 'kite' ? H * 0.58 : H * 0.8, top = H, shoulder = kind === 'kite' ? H * 0.72 : H * 0.55;
  // CCW in (x, z), starting at the bottom point
  const N = 16;
  for (let i = 0; i <= N; i++) { const u = i / N; const z = u * shoulder; const x = (Wd / 2) * Math.sin((Math.PI / 2) * u) ** (kind === 'kite' ? 0.9 : 0.65); pts.push([x, z]); }
  for (let i = 1; i <= 6; i++) { const u = i / 6; pts.push([Wd / 2 * (kind === 'kite' ? 1 - 0.18 * Math.sin(Math.PI / 2 * u) : 1), shoulder + (top - shoulder) * u]); }
  const right = pts.slice(); const topArc = [];
  for (let i = 1; i < 8; i++) { const u = i / 8; topArc.push([Wd / 2 * (kind === 'kite' ? 0.82 : 1) * (1 - 2 * u), top + (kind === 'kite' ? H * 0.06 : H * 0.03) * Math.sin(Math.PI * u)]); }
  const left = right.slice(1).reverse().map(([x, z]) => [-x, z]);
  return [...right, ...topArc, ...left];
}
function shield(m, { d, law, roles, gem, lang, minF, focalGrow }) {
  const I = ITEMS.shield, th = I.T * law.hilt ** 0.5, rimT = Math.max(minF / 2, 0.9 * law.rim), relief = 0.5 * law.relief;
  const fit = mat(roles.fittings), acc = mat(roles.accent), board = mat(roles.board);
  const out = outlinePts(lang.outline, I.R, I.H);
  let centre, span;
  if (!out) { const R = I.R, zc = R + rimT; centre = [0, 0, zc]; span = R;
    push(m, 'lathes', { group: 'board', axisFrom: P(0, th, zc), axisTo: P(0, 0, zc), profile: [{ t: 0, radius: r3(R * 0.97) }, { t: 0.3, radius: R }, { t: 1, radius: R }], samples: 64, ...board });
    push(m, 'sweeps', { group: 'rim', path: circle([0, -rimT * 0.2, zc], R, 64, 'xz'), radius: r3(rimT), sides: 10, ...fit });
  } else { const z0 = rimT; const pts = out.map(([x, z]) => [r3(x), r3(z + z0)]);
    centre = [0, 0, z0 + I.H * 0.6]; span = I.H * 0.4;
    push(m, 'extrudes', { group: 'board', profile: { points: pts }, axisFrom: P(0, 0, 0), axisTo: P(0, th, 0), ...board });
    push(m, 'sweeps', { group: 'rim', path: [...pts, pts[0]].map(([x, z]) => [x, -rimT * 0.2, z]), radius: r3(rimT), sides: 8, ...fit }); }
  const [cx, , cz] = centre, front = -relief * 0.5;
  const trace = {};
  const bossR = I.R * 0.17 * focalGrow;
  let st = null;
  if (gem) { st = focalStone({ stylize: d.stylize, face: 2 * span });
    merge(m, setStone({ at: [cx, 0, cz], axis: [0, -1, 0], st, gem, roles, group: 'boss', both: false, bossDepth: Math.max(th, st.r * 0.35) }));
    trace.focal = { at: 'boss', gem: gem.gem, size: r3(st.size), share: r3(st.size / (2 * span)), setting: st.setting }; }
  else if (lang.device === 'spikes') { push(m, 'lathes', { group: 'boss', axisFrom: P(cx, th * 0.5, cz), axisTo: P(cx, -bossR * 2.4, cz), profile: [{ t: 0, radius: r3(bossR) }, { t: 0.35, radius: r3(bossR * 0.8) }, { t: 1, radius: 0 }], ...fit }); trace.focal = { at: 'boss', grow: r3(focalGrow) }; }
  else if (d.focus !== 'none' || lang.outline === 'round') push(m, 'lathes', { group: 'boss', axisFrom: P(cx, th * 0.5, cz), axisTo: P(cx, -bossR * 0.7, cz), profile: [{ t: 0, radius: r3(bossR) }, { t: 0.5, radius: r3(bossR * 0.85) }, { t: 1, radius: 0 }], samples: 40, ...fit });
  const hub = st ? st.bossR : bossR;
  // leading lines: from the frame into the focal (law 6)
  const plate = (pts, role = roles.accent) => push(m, 'extrudes', { group: 'device', profile: { points: pts.map(([x, z]) => [r3(x), r3(z)]) }, axisFrom: P(0, th * 0.4, 0), axisTo: P(0, -relief, 0), ...mat(role) });
  if (lang.device === 'rays') { const n = Math.max(6, Math.round(12 * law.notches)); for (let k = 0; k < n; k++) { const a = (2 * Math.PI * k) / n + Math.PI / 2, a2 = Math.PI / n * 0.45, r0 = hub * 0.9, r1 = span * (k % 2 ? 0.75 : 1.05);
    plate([[cx + r0 * Math.cos(a - a2), cz + r0 * Math.sin(a - a2)], [cx + r1 * Math.cos(a), cz + r1 * Math.sin(a)], [cx + r0 * Math.cos(a + a2), cz + r0 * Math.sin(a + a2)]].reverse()); } }
  if (lang.device === 'chevron') { const w = 6 * law.relief ** 0.5, y0 = cz - span * 0.9, y1 = cz + span * 0.1, X = I.H * 0.4;
    plate([[-X, y0], [0, y1 - w], [X, y0], [X, y0 + w], [0, y1], [-X, y0 + w]]); }
  if (lang.device === 'bands') { const w = 3.2 * law.rim ** 0.5, R = span;
    for (const a of [0, Math.PI / 2]) { const c = Math.cos(a), s = Math.sin(a); plate([[cx - R * c - w * s, cz - R * s + w * c], [cx - R * c + w * s, cz - R * s - w * c], [cx + R * c + w * s, cz + R * s - w * c], [cx + R * c - w * s, cz + R * s + w * c]].map((p, i, arr) => arr[i])); }
    push(m, 'sweeps', { group: 'device', path: circle([cx, -relief * 0.4, cz], R * 0.62, 48, 'xz'), radius: r3(w * 0.45), sides: 8, ...acc });
    for (let k = 0; k < 8; k++) { const a = (2 * Math.PI * k) / 8 + Math.PI / 8; push(m, 'lathes', { group: 'device', axisFrom: P(cx + R * 0.82 * Math.cos(a), 0, cz + R * 0.82 * Math.sin(a)), axisTo: P(cx + R * 0.82 * Math.cos(a), -relief - w * 0.5, cz + R * 0.82 * Math.sin(a)), profile: [{ t: 0, radius: r3(w * 0.5) }, { t: 1, radius: r3(w * 0.15) }], ...acc }); } }
  if (lang.device === 'spikes') for (let k = 0; k < 8; k++) { const a = (2 * Math.PI * k) / 8; const R = span;
    push(m, 'lathes', { group: 'device', axisFrom: P(cx + R * Math.cos(a), -rimT * 0.2, cz + R * Math.sin(a)), axisTo: P(cx + R * 1.18 * Math.cos(a), -rimT - 5 * focalGrow, cz + R * 1.18 * Math.sin(a)), profile: [{ t: 0, radius: r3(rimT * 1.3) }, { t: 1, radius: 0 }], ...fit }); }
  if (lang.device === 'mon') { push(m, 'sweeps', { group: 'device', path: circle([cx, -relief * 0.3, cz], span * 0.6, 64, 'xz'), radius: r3(Math.max(minF / 2, 0.8 * law.relief)), sides: 8, ...acc });
    for (let k = 0; k < 3; k++) { const a0 = (2 * Math.PI * k) / 3, path = []; for (let i = 0; i <= 12; i++) { const u = i / 12, a = a0 + u * 1.9, rr = bossR * 1.1 + u * span * 0.42; path.push([cx + rr * Math.cos(a), -relief * 0.3, cz + rr * Math.sin(a)]); }
      push(m, 'lofts', ribbon({ path, w: (t) => 3.2 * law.relief ** 0.5 * (1 - 0.8 * t), h: () => relief * 0.5, role: roles.accent, group: 'device', minF })); } }
  if (lang.device === 'wings') for (const s of [1, -1]) for (const [dz, len, rise] of [[0, 1, 0.35], [-0.25, 0.8, 0.05], [-0.5, 0.6, -0.25]]) {
    push(m, 'lofts', feather({ s, root: [cx + s * hub * 0.8, -relief * 0.6, cz + dz * hub * 2], len: span * 0.95 * len, rise, width: hub * 0.45, thick: relief * 0.6, role: roles.accent, minF })); }
  if (lang.device === 'vine') for (const s of [1, -1]) { const path = []; const bot = [cx, -relief * 0.3, cz - span * (lang.outline === 'round' ? 0.92 : 1.35)]; for (let i = 0; i <= 20; i++) { const u = i / 20;
      path.push([cx + s * span * 0.42 * Math.sin(Math.PI * u) * (1 - 0.3 * u), -relief * 0.3, bot[2] + (cz - hub * 0.9 - bot[2]) * u]); }
    push(m, 'lofts', ribbon({ path, w: (t) => Math.max(minF, 1.1 * law.relief ** 0.5 * (0.6 + 0.4 * t)), h: () => relief * 0.5, role: roles.accent, group: 'device', minF }));
    for (const u of [0.3, 0.55, 0.8]) { const p = path[Math.round(u * 20)], lp = []; for (let i = 0; i <= 8; i++) { const v = i / 8; lp.push([p[0] + s * 5 * law.relief ** 0.5 * v, p[1], p[2] + 3 * v]); }
      push(m, 'lofts', ribbon({ path: lp, w: (t) => 1.8 * law.relief ** 0.5 * Math.sin(Math.PI * t) ** 0.7, h: () => relief * 0.4, role: roles.accent, group: 'device', minF })); } }
  const sockets = { grip: { origin: A(cx, th + 4, cz), axis: [1, 0, 0], length: 12 }, focal: { origin: A(cx, -relief, cz) } };
  return { sockets, trace, length: out ? I.H : 2 * I.R };
}


/**
 * Build a staff, a bow or a shield. `ctx` is resolved by expand.js: { item, card, d, law, roles, gem, parts, seed }.
 * The item's language is the card's `language[item]` under the build's `parts`; its focus is the build's dial, else
 * the language's, else the card's. → { monomers, sockets, trace }.
 */
export function buildItem({ item, card, d, law, roles, gem: g, lang, seed }) {
  const gem = g && ['head', 'riser', 'boss'].includes(d.focus) && !GEMLESS_HEADS.includes(lang.head) && lang.device !== 'spikes'
    ? { ...g, glow: (g.glow || 0) + 0.35 * d.stylize } : null;
  roles = { ...roles, shaft: lang.shaft || roles.shaft || ['wood', '#6b4a2e'], board: lang.board || roles.board || ['wood', '#6b4a2e'],
    ...(gem ? { fittings: [roles.fittings[0], recede(roles.fittings[1], d.stylize)] } : {}) };
  const minF = law.minFeature * (ITEMS[item].L || ITEMS[item].H * 1.5);
  const m = {};
  const rng = mulberry32(seed * 2654435761 + item.length * 97 + (card.id || '').length);
  const r = ({ staff, bow, shield })[item](m, { d, law, roles, gem, lang, minF, focalGrow: growOf(d.stylize), rng });
  // law 7: a barked part (the shaft role on a shaft, a branch, a limb or a riser) wears the trees' bark. The tile is
  // in stem radii (crack spacing ∝ thickness), coarser when stylized (law 4); the monomer keeps its tint as the plain
  // colour for a consumer without textures.
  if (lang.bark) {
    const tile = r3(law.barkTile * (ITEMS[item].R || 1.4));
    for (const k of ['lathes', 'lofts']) for (const s of m[k] || []) {
      if (['shaft', 'branches', 'limb', 'riser'].includes(s.group) && s.tint === roles.shaft[1]) s.bark = { species: lang.bark, tile };
    }
  }
  return { monomers: m, sockets: r.sockets, trace: { variants: lang, ...r.trace, ...(lang.bark ? { bark: lang.bark } : {}), length: r3(r.length), minFeature: r3(minF) } };
}
