/**
 * boat-helm — the builders of the craft shelf's helm kinds (boat-odm.js), merged into BOAT_BUILDERS: a console, a seat
 * and a top over the helm, each standing on a hull's point on its sole (its mount the middle of its foot, +y the bow). Pure, as the shelf is.
 *
 *   boat-console  moulded   (each piece only when its row names it: a dash under a hull's own windscreen has no
 *                           windscreen or rail, a passenger's no helm or throttle but a grab handle and glovebox)
 *                           the console's body from its side's outline pushed across its width (its front, its dash
 *                           sloping down aft to the helm, its back); its access door; the windscreen in three panels
 *                           (the middle, two wings swept aft) and its frame; the grab rail round its front and sides on
 *                           bent posts; on the dash the screen, two gauges and the compass; the helm: its pod, the
 *                           wheel's rim, hub and spokes, its axis raked toward the helmsman; the throttle's binnacle on
 *                           the starboard side and its lever. Points: `mount`, `wheel` (the wheel's middle)
 *   boat-seat     cooler    a cooler (its seam, its rope handles) and its cushion on top
 *                 bucket    a bucket seat on a pedestal: its foot, post and swivel, its pan and shell, its back raked aft
 *   boat-top      tTop      a T-top: four legs from feet on the sole beside the console, bent in to its frame, a front
 *                           brace over the windscreen, the hardtop (`over`: its front and back, overhanging aft over the
 *                           helm) and its lip, rod holders along its back edge, spreader lights under it, the all-round
 *                           light and an antenna on it
 *
 * Craft space: +y forward, +z up, +x starboard, metres.
 */
import { lathe, sweep, extrudeWorld, loftWorld, section, planeUV, round3, tone } from './craft-common.js';

const r3v = (v) => v.map(round3);
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const unit = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const ccw = (from, to, ring) => { const uv = planeUV(from, to, ring), a = uv.reduce((t, p, i) => { const q = uv[(i + 1) % uv.length]; return t + p[0] * q[1] - q[0] * p[1]; }, 0); return a < 0 ? ring.slice().reverse() : ring; };
const rect = (u, v, w, h) => [[0, 1], [1, 1], [1, 0], [0, 0]].map(([a, b]) => [0, 1, 2].map((k) => u[k] * (a - 0.5) * w + v[k] * (b - 0.5) * h));
const E = (id, from, to, offsets, tint, extra) => extrudeWorld(id, from, to, ccw(from, to, offsets), tint, extra);
const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

function buildConsole(row, C) {
  const b = row.build;
  if (b.family !== 'moulded') throw new Error(`Unknown boat-console family '${b.family}'`);
  const { width: W, length: D } = row.dims, y0 = -D / 2, y1 = D / 2, h = b.height, dash = b.dash;
  const extrudes = [], lathes = [], sweeps = [];
  // its body: the side's outline (y, z) across its width, its edges chamfered
  const side = [[y0, 0], [y1 - 0.02, 0], [y1, 0.06], [y1, h * 0.7], [y1 - 0.07, h * 0.93], [dash[0][0], dash[0][1]], [dash[1][0], dash[1][1]], [y0 + 0.03, dash[1][1] - 0.02], [y0, dash[1][1] - 0.06]];
  extrudes.push(E('body', [-W / 2, 0, 0], [W / 2, 0, 0], side.map(([y, z]) => [0, y, z]), C.paint));
  // its access door in the front, a hair proud, its latch
  extrudes.push(E('door', [0, y1 - 0.002, h * 0.36], [0, y1 + 0.008, h * 0.36], rect([1, 0, 0], [0, 0, 1], W * 0.55, h * 0.42), tone(C.paint, -0.07)));
  lathes.push(lathe('door_latch', [W * 0.2, y1 + 0.006, h * 0.36], [W * 0.2, y1 + 0.02, h * 0.36], [[0, 0.014], [1, 0.012]], C.chrome, { samples: 10, crossSections: 2 }));
  // the dash: its line from its front top to its back, the normal off it up toward the helmsman
  const [dF, dB] = dash, dd = [0, dB[0] - dF[0], dB[1] - dF[1]], dl = Math.hypot(dd[1], dd[2]), du = [0, dd[1] / dl, dd[2] / dl];
  const n = [0, -du[2], du[1]].map((v) => v * (du[1] < 0 ? -1 : 1));
  const nUp = n[2] < 0 ? scale(n, -1) : n;
  const on = (u, x, lift = 0) => { const p = lerp2(dF, dB, u); return add([x, p[0], p[1]], scale(nUp, lift)); };
  // the windscreen: its middle panel raked aft from the dash's front edge, two wings swept aft at its ends; its frame
  // (each piece the row names: a dash under a hull's own windscreen has none of its own, a passenger's no helm)
  const ws = b.windscreen;
  if (ws) {
  const bot = [dF[0] + 0.03, dF[1] - 0.012], topY = bot[0] - ws.height * Math.sin(ws.rake * Math.PI / 180), topZ = bot[1] + ws.height * Math.cos(ws.rake * Math.PI / 180);
  const panel = (x0, x1, sweepAft) => {
    const t = 0.008, base = [[0, bot[0], bot[1]], [0, topY, topZ], [0, topY - t, topZ], [0, bot[0] - t, bot[1]]];
    return { from: [x0, 0, 0], to: [x1, -sweepAft, 0], base };
  };
  const mid = panel(-ws.width / 2, ws.width / 2, 0);
  extrudes.push(E('windscreen', mid.from, mid.to, mid.base, C.glass, { material: 'glass' }));
  for (const sx of [1, -1]) {
    const from = [sx * ws.width / 2, bot[0], bot[1]], to = [sx * (ws.width / 2 + ws.wing), bot[0] - ws.wingAft, bot[1]];
    const off = [[0, 0, 0], [0, topY - bot[0], topZ - bot[1]], [0, topY - bot[0] - 0.008, topZ - bot[1]], [0, -0.008, 0]];
    extrudes.push(E(`windscreen_${sx > 0 ? 'r' : 'l'}`, from, to, off, C.glass, { material: 'glass' }));
  }
  const fr = 0.01;
  sweeps.push(sweep('windscreen_frame', [
    [-(ws.width / 2 + ws.wing), topY - ws.wingAft, topZ], [-ws.width / 2, topY, topZ], [ws.width / 2, topY, topZ], [ws.width / 2 + ws.wing, topY - ws.wingAft, topZ],
  ], fr, C.chrome, { sides: 6 }));
  }
  // the grab rail round its front and sides on bent posts from its walls
  const R = b.rail;
  if (R) {
  const zr = R.height, xo = W / 2 + R.out, yf = y1 + R.out;
  const railPath = [[xo, y0 + 0.06, zr], [xo, y1 - 0.08, zr], [xo * 0.7, yf, zr], [-xo * 0.7, yf, zr], [-xo, y1 - 0.08, zr], [-xo, y0 + 0.06, zr]];
  sweeps.push(sweep('grab_rail', railPath, R.radius, C.chrome, { sides: 8 }));
  for (const sx of [1, -1]) for (const [k, y] of [y0 + 0.08, (y0 + y1) / 2, y1 - 0.1].entries()) {
    sweeps.push(sweep(`rail_post_${sx > 0 ? 'r' : 'l'}${k}`, [[sx * (W / 2 - 0.02), y, zr - 0.3], [sx * xo, y, zr - 0.24], [sx * xo, y, zr]], R.radius * 0.85, C.chrome, { sides: 6 }));
  }
  for (const sx of [1, -1]) sweeps.push(sweep(`rail_post_f${sx > 0 ? 'r' : 'l'}`, [[sx * xo * 0.6, y1 - 0.02, zr - 0.28], [sx * xo * 0.65, yf, zr - 0.22], [sx * xo * 0.65, yf, zr]], R.radius * 0.85, C.chrome, { sides: 6 }));
  }
  // on the dash: the screen, two gauges and the compass ahead of them
  if (b.screen !== false) {
    extrudes.push(E('screen_bezel', on(0.3, 0, -0.005), on(0.3, 0, 0.02), rect([1, 0, 0], du, 0.32, 0.17), C.rubber));
    extrudes.push(E('screen', on(0.3, 0, 0.019), on(0.3, 0, 0.023), rect([1, 0, 0], du, 0.29, 0.14), C.glass, { material: 'glass' }));
  }
  if (b.gauges !== false) for (const sx of [1, -1]) {
    lathes.push(lathe(`gauge_${sx > 0 ? 'r' : 'l'}`, on(0.55, sx * 0.25, -0.004), on(0.55, sx * 0.25, 0.016), [[0, 0.05], [0.8, 0.048], [1, 0.044]], C.chrome, { samples: 16, crossSections: 3 }));
    lathes.push(lathe(`gauge_glass_${sx > 0 ? 'r' : 'l'}`, on(0.55, sx * 0.25, 0.016), on(0.55, sx * 0.25, 0.02), [[0, 0.042], [1, 0.042]], C.glass, { material: 'glass', samples: 16, crossSections: 2 }));
  }
  if (b.compass !== false) lathes.push(lathe('compass', on(0.06, 0, -0.005), on(0.06, 0, 0.07), [[0, 0.06], [0.3, 0.06], [0.45, 0.055], [0.8, 0.035], [1, 0.005]], C.glass, { material: 'glass', samples: 16, crossSections: 5 }));
  // the helm: its pod off the dash, the wheel on its axis raked toward the helmsman, its rim, hub and spokes
  const H = b.helm, hardpoints = { mount: [0, 0, 0] };
  if (H) {
  const base = on(H.at, 0, 0), axis = unit(add(nUp, [0, -H.rake, 0])), wc = add(base, scale(axis, H.reach));
  hardpoints.wheel = r3v(wc);
  lathes.push(lathe('helm_pod', add(base, scale(nUp, -0.01)), add(base, scale(nUp, 0.06)), [[0, 0.075], [1, 0.065]], C.rubber, { samples: 14, crossSections: 2 }));
  lathes.push(lathe('helm_shaft', add(base, scale(axis, 0.05)), wc, [[0, 0.03], [1, 0.022]], C.rubber, { samples: 10, crossSections: 2 }));
  const e1 = [1, 0, 0], e2 = unit(cross(axis, e1)), rim = H.diameter / 2;
  const ring = Array.from({ length: 25 }, (_, k) => { const a = (2 * Math.PI * k) / 24; return add(wc, add(scale(e1, rim * Math.cos(a)), scale(e2, rim * Math.sin(a)))); });
  sweeps.push(sweep('wheel_rim', ring, 0.013, C.rubber, { sides: 8 }));
  lathes.push(lathe('wheel_hub', add(wc, scale(axis, -0.02)), add(wc, scale(axis, 0.035)), [[0, 0.045], [0.6, 0.042], [1, 0.025]], C.chrome, { samples: 14, crossSections: 3 }));
  for (let k = 0; k < 3; k += 1) {
    const a = Math.PI / 2 + (2 * Math.PI * k) / 3, dir = add(scale(e1, Math.cos(a)), scale(e2, Math.sin(a)));
    sweeps.push(sweep(`spoke_${k}`, [add(wc, scale(dir, 0.03)), add(add(wc, scale(dir, rim * 0.6)), scale(axis, -0.012)), add(wc, scale(dir, rim))], 0.008, C.chrome, { sides: 6 }));
  }
  }
  // the throttle's binnacle on the starboard wall, its lever and knob
  const T = b.throttle;
  if (T) {
  const by = T.at, bz = T.height;
  extrudes.push(E('binnacle', [W / 2 - 0.01, by, bz], [W / 2 + 0.08, by, bz], rect([0, 1, 0], [0, 0, 1], 0.13, 0.15), C.rubber));
  const lv = [[W / 2 + 0.06, by, bz + 0.05], [W / 2 + 0.075, by + 0.06, bz + 0.17]];
  sweeps.push(sweep('throttle', lv, 0.011, C.chrome, { sides: 6 }));
  lathes.push(lathe('throttle_knob', lv[1], add(lv[1], [0.02, 0.012, 0.03]), [[0, 0.022], [0.7, 0.02], [1, 0.008]], C.rubber, { samples: 10, crossSections: 3 }));
  }
  // a passenger's: the grab handle across the dash's top, the glovebox's door in its back
  if (b.grab) {
    const g0 = on(0.2, W * 0.36, 0.01), g1 = on(0.2, -W * 0.36, 0.01);
    sweeps.push(sweep('grab_handle', [g0, add(on(0.25, W * 0.33, 0.01), scale(nUp, 0.07)), add(on(0.25, -W * 0.33, 0.01), scale(nUp, 0.07)), g1], 0.012, C.chrome, { sides: 6 }));
  }
  if (b.glovebox) extrudes.push(E('glovebox', [0, y0 + 0.002, dB[1] * 0.55], [0, y0 - 0.008, dB[1] * 0.55], rect([1, 0, 0], [0, 0, 1], W * 0.6, dB[1] * 0.3), tone(C.paint, -0.07)));
  return { extrudes, lathes, sweeps, hardpoints };
}

// a bucket seat on its pedestal: the pedestal's foot and post, the seat's pan and its bolsters, the back raked aft
function buildBucket(row, C) {
  const b = row.build, { width: W, length: D } = row.dims, zs = b.seat, back = b.back;
  const lathes = [
    lathe('pedestal_foot', [0, 0, -0.004], [0, 0, 0.02], [[0, 0.17], [0.6, 0.16], [1, 0.1]], C.chrome, { samples: 18, crossSections: 3 }),
    lathe('pedestal', [0, 0, 0.02], [0, 0, zs - 0.06], [[0, 0.045], [1, 0.04]], C.chrome, { samples: 12, crossSections: 2 }),
    lathe('swivel', [0, 0, zs - 0.07], [0, 0, zs - 0.03], [[0, 0.11], [1, 0.11]], C.rubber, { samples: 14, crossSections: 2 }),
  ];
  const pan = [[0.5, 0.0], [0.5, 0.75], [0.42, 1], [-0.42, 1], [-0.5, 0.75], [-0.5, 0]].map(([x, z]) => [x * W, 0, z * 0.11]);
  const extrudes = [extrudeWorld('seat_pan', [0, D / 2 - 0.02, zs - 0.03], [0, -D / 2 + 0.04, zs - 0.03], ccw([0, D / 2 - 0.02, zs - 0.03], [0, -D / 2 + 0.04, zs - 0.03], pan), C.trim)];
  // the back, raked aft from the pan's back edge
  const r = back.rake * Math.PI / 180, b0 = [0, -D / 2 + 0.06, zs + 0.04], b1 = [0, b0[1] - Math.sin(r) * back.height, b0[2] + Math.cos(r) * back.height];
  const bk = [[0.48, -0.04], [0.48, 0.04], [0.4, 0.07], [-0.4, 0.07], [-0.48, 0.04], [-0.48, -0.04]].map(([x, y]) => [x * W, y, 0]);
  extrudes.push(extrudeWorld('seat_back', b0, b1, ccw(b0, b1, bk), C.trim));
  extrudes.push(extrudeWorld('seat_shell', [0, D / 2 - 0.01, zs - 0.08], [0, -D / 2 + 0.03, zs - 0.08], ccw([0, D / 2 - 0.01, zs - 0.08], [0, -D / 2 + 0.03, zs - 0.08], rect([1, 0, 0], [0, 0, 1], W * 0.96, 0.06)), C.paint));
  return { lathes, extrudes, hardpoints: { mount: [0, 0, 0], seat: [0, 0, zs + 0.08] } };
}

function buildSeat(row, C) {
  const b = row.build;
  if (b.family === 'bucket') return buildBucket(row, C);
  if (b.family !== 'cooler') throw new Error(`Unknown boat-seat family '${b.family}'`);
  const { width: W, length: D, height: H } = row.dims, c = b.cushion;
  const box = (id, y, z0, z1, w, d, tint) => E(id, [0, y + d / 2, (z0 + z1) / 2], [0, y - d / 2, (z0 + z1) / 2], rect([1, 0, 0], [0, 0, 1], w, z1 - z0), tint);
  const extrudes = [
    box('cooler', 0, 0, H - c, W, D, C.paint),
    // (its lid's seam: a dark band a hair proud)
    box('seam', 0, H - c - 0.035, H - c - 0.025, W + 0.006, D + 0.006, tone(C.paint, -0.3)),
    box('cushion', 0, H - c - 0.002, H, W - 0.02, D - 0.02, C.trim),
  ];
  // its rope handles at either end
  const sweeps = [1, -1].map((sx) => sweep(`handle_${sx > 0 ? 'r' : 'l'}`, [[sx * W / 2, -0.07, H * 0.62], [sx * (W / 2 + 0.03), -0.05, H * 0.55], [sx * (W / 2 + 0.03), 0.05, H * 0.55], [sx * W / 2, 0.07, H * 0.62]], 0.008, C.rubber, { sides: 6 }));
  return { extrudes, sweeps, hardpoints: { mount: [0, 0, 0], seat: [0, 0, H] } };
}

// a T-top over a console: its four legs up from feet on the sole beside the console, bent in under the top; its front
// brace above the windscreen; its frame under the hardtop; the hardtop lofted bow to stern with its lip, overhanging aft
// over the helm; its rod holders raked aft along its back edge; its spreader lights under it, the all-round light and an
// antenna on it
function buildTop(row, C) {
  const b = row.build;
  if (b.family !== 'tTop') throw new Error(`Unknown boat-top family '${b.family}'`);
  const { width: W, length: D } = row.dims, Ht = b.height, [yF, yB] = [b.over[0], b.over[1]], lg = b.legs;
  const lathes = [], sweeps = [], lofts = [];
  // the legs: feet on the sole beside the console, straight up, bent in to the frame under the top
  const tops = [];
  for (const [k, y] of [lg.front, lg.aft].entries()) for (const sx of [1, -1]) {
    const foot = [sx * lg.x, y, 0], top = [sx * lg.xTop, y - lg.lean, Ht - 0.03];
    tops.push(top);
    lathes.push(lathe(`foot_${k}${sx > 0 ? 'r' : 'l'}`, [foot[0], y, -0.004], [foot[0], y, 0.012], [[0, 0.06], [1, 0.05]], C.chrome, { samples: 14, crossSections: 2 }));
    sweeps.push(sweep(`leg_${k}${sx > 0 ? 'r' : 'l'}`, [foot, [foot[0], y, Ht * 0.62], [(foot[0] + top[0]) / 2, y - lg.lean * 0.5, Ht * 0.86], top], lg.radius, C.chrome, { sides: 10 }));
  }
  // the front brace, above the windscreen, and the frame joining the legs' tops under the top
  sweeps.push(sweep('brace_front', [[lg.x, lg.front, b.brace], [-lg.x, lg.front, b.brace]], lg.radius * 0.8, C.chrome, { sides: 8 }));
  const [fr, fl, ar, al] = tops;
  sweeps.push(sweep('frame', [fr, fl, al, ar, fr], lg.radius * 0.85, C.chrome, { sides: 8 }));
  // the hardtop: rounded in plan, crowned a little, its lip round its edge
  const zc = Ht + 0.03, sect = (k) => section((W / 2) * k, b.thickness / 2, 5, 0.7).map(([x, z]) => [x, 0, zc + z]);
  lofts.push(loftWorld('hardtop', [0, yF, 0], [0, yB, 0], [[0, 0.84], [0.04, 0.97], [0.15, 1], [0.85, 1], [0.96, 0.97], [1, 0.88]].map(([t, k]) => ({ t, points: sect(k) })), C.paint, { interp: 'smooth', segments: 3 }));
  const rim = (Array.from({ length: 33 }, (_, i) => {
    const a = (2 * Math.PI * i) / 32, cx = Math.cos(a), cy = Math.sin(a), e = 4;
    return [(W / 2) * 0.995 * Math.sign(cx) * Math.abs(cx) ** (2 / e), (yF + yB) / 2 + ((yF - yB) / 2) * 0.99 * Math.sign(cy) * Math.abs(cy) ** (2 / e), zc - b.thickness * 0.3];
  }));
  sweeps.push(sweep('lip', rim, b.thickness * 0.35, tone(C.paint, -0.08), { sides: 8 }));
  // the rod holders raked aft along the back edge
  for (let i = 0; i < b.rods; i += 1) {
    const x = (i - (b.rods - 1) / 2) * (W * 0.6 / Math.max(1, b.rods - 1)), y = yB + 0.12;
    lathes.push(lathe(`rocket_${i}`, [x, y + 0.04, zc], [x, y - 0.14, zc + 0.32], [[0, 0.026], [0.06, 0.022], [1, 0.021]], C.chrome, { samples: 10, crossSections: 3 }));
  }
  // the spreader lights under it, the all-round light and the antenna on it
  for (const sx of [1, -1]) lathes.push(lathe(`spreader_${sx > 0 ? 'r' : 'l'}`, [sx * W * 0.3, yB + 0.1, zc - b.thickness * 0.45], [sx * W * 0.3, yB + 0.1, zc - b.thickness * 0.45 - 0.03], [[0, 0.04], [1, 0.035]], '#f4f6f8', { material: 'neon', samples: 12, crossSections: 2 }));
  const ztop = zc + b.thickness * 0.5, lp = [0, yB + 0.25, ztop];
  lathes.push(lathe('light_mast', add(lp, [0, 0, -0.01]), add(lp, [0, 0, 0.3]), [[0, 0.03], [0.05, 0.012], [1, 0.012]], C.chrome, { samples: 10, crossSections: 3 }));
  lathes.push(lathe('all_round_light', add(lp, [0, 0, 0.3]), add(lp, [0, 0, 0.36]), [[0, 0.02], [0.5, 0.022], [1, 0.012]], '#f4f6f8', { material: 'neon', samples: 12, crossSections: 3 }));
  const ab = [W * 0.38, yB + 0.2, ztop];
  lathes.push(lathe('antenna_base', add(ab, [0, 0, -0.01]), add(ab, [0, 0, 0.12]), [[0, 0.03], [1, 0.016]], C.chrome, { samples: 10, crossSections: 2 }));
  sweeps.push(sweep('antenna', [add(ab, [0, 0, 0.11]), add(ab, [0.02, -0.03, 0.7]), add(ab, [0.05, -0.08, 1.25])], 0.007, C.paint, { sides: 6 }));
  void D;
  return { lathes, sweeps, lofts, hardpoints: { mount: [0, 0, 0] } };
}

export const HELM_BUILDERS = {
  'boat-console': buildConsole,
  'boat-seat': buildSeat,
  'boat-top': buildTop,
};
