/**
 * con-tools — the tools a machine's chain may carry in place of its bucket (the tool swap): each drawn in the tool's
 * frame, its pins where its mount's pins are, so any tool of a mount closes the same linkage and takes the same rams.
 *
 *   the excavator's mount (its pin at the origin, its link's pin where the digging bucket's is): a hydraulic breaker
 *   (its housing and its chisel), a grapple (its head and its two jaws of tines), an auger (its drive and its flight)
 *   the skid steer's plate (its pin at the origin, its tilt rams' pins where the bucket's are): pallet forks, an auger,
 *   a pickup sweeper
 *
 * Each returns its hardpoints (pin, link, its rams' pins, its tip or edge) and its outline (what the laws sweep and the
 * ground meets). Pure: no clock, no dice.
 */
import { add, box, extrudeWorld, loftWorld, mul, panel as rawPanel, roundRect, spin, sub, sweep, tone, tube } from './con-common.js';

const area = (o) => o.reduce((s, p, i) => { const q = o[(i + 1) % o.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
const wound = (o, sign) => (area(o) * sign < 0 ? o.slice().reverse() : o);
const panel = (id, x0, x1, outline, tint) => rawPanel(id, x0, x1, wound(outline, Math.sign(x1 - x0) || 1), tint);
const boss = (id, p, x0, x1, r, tint) => spin(id, [x0, p[1], p[2]], [x1, p[1], p[2]], [[0, r], [1, r]], tint, 16);
const side = (s) => (s > 0 ? 'r' : 'l');
function beam(id, a, b, w, h, w1, h1, tint, r = 0.03) {
  const ax = sub(b, a);
  return loftWorld(id, a, b, [{ t: 0, points: roundRect(ax, w, h, r, 2) }, { t: 1, points: roundRect(ax, w1, h1, r, 2) }], tint);
}
/** A helix about +y from y0 to y1, `r` round, `turns` times: an auger's flight. */
const helix = (y0, y1, r, turns, n = 48) => Array.from({ length: n + 1 }, (_, k) => { const t = k / n, a = 2 * Math.PI * turns * t; return [r * Math.cos(a), y0 + (y1 - y0) * t, r * Math.sin(a)]; });

// ── the excavator's mount: the ears and their bosses round the pin and the link's pin ────────────────────────────
function excavatorEars(row, C, out) {
  const L = row.dims.link, steel = tone(C.trim, 0.05);
  for (const s of [1, -1]) {
    out.extrudes.push(panel(`ear_${side(s)}`, s * 0.24, s * 0.3, [[-0.15, -0.18], [0.3, -0.16], [0.3, 0.2], [L[1] + 0.02, L[2] + 0.12], [L[1] - 0.12, L[2] + 0.05]], steel));
    out.lathes.push(boss(`pin_${side(s)}`, [0, 0, 0], s * 0.22, s * 0.32, 0.08, steel));
    out.lathes.push(boss(`lpin_${side(s)}`, L, s * 0.19, s * 0.32, 0.07, steel));
  }
  out.extrudes.push(box('top', [0, -0.1, 0.1], [0, 0.32, 0.1], 0.5, 0.2, steel));
}

/** A hydraulic breaker: its housing down from the pins, its chisel. */
export function breaker(row, C) {
  const d = row.dims, out = { extrudes: [], lathes: [], lofts: [], sweeps: [] }, body = C.paint, steel = tone(C.trim, 0.1);
  excavatorEars(row, C, out);
  out.lofts.push(beam('housing', [0, 0.3, 0.02], [0, d.length, 0], d.w, d.h, d.w * 0.85, d.h * 0.85, body, 0.06));
  out.extrudes.push(box('band', [0, d.length * 0.55, 0], [0, d.length * 0.6, 0], d.w + 0.03, d.h + 0.03, steel));
  out.lathes.push(spin('bush', [0, d.length, 0], [0, d.length + 0.12, 0], [[0, d.chisel * 1.8], [1, d.chisel * 1.5]], steel, 16));
  out.lathes.push(spin('chisel', [0, d.length + 0.12, 0], [0, d.length + d.point, 0], [[0, d.chisel], [0.8, d.chisel * 0.95], [1, d.chisel * 0.2]], tone(C.chrome, -0.2), 16));
  for (const s of [1, -1]) out.sweeps.push(tube(`hose_${side(s)}`, [[s * 0.08, 0.05, 0.22], [s * 0.1, 0.4, 0.3], [s * 0.12, 0.7, d.h / 2]], 0.022, C.rubber, 8));
  const tip = [0, d.length + d.point, 0];
  return { ...out, hardpoints: { pin: [0, 0, 0], link: d.link, tip }, outline: [tip, [0, d.length, d.h / 2], [0, d.length, -d.h / 2], [0, 0.3, d.h / 2], [0, 0.3, -d.h / 2]] };
}

/** A grapple: its head on the pins, two jaws of curved tines half open. */
export function grapple(row, C) {
  const d = row.dims, out = { extrudes: [], lathes: [], lofts: [], sweeps: [] }, body = C.paint, steel = tone(C.trim, 0.15);
  excavatorEars(row, C, out);
  out.lathes.push(spin('head', [0, 0.3, 0], [0, 0.65, 0], [[0, 0.24], [1, 0.22]], body, 18));
  for (const [j, sz] of [['a', 1], ['b', -1]]) for (const x of [-d.w / 2 + 0.05, 0, d.w / 2 - 0.05]) {
    const pts = [[x, 0.62, sz * 0.12], [x, 0.95, sz * 0.5], [x, 1.4, sz * 0.62], [x, d.length, sz * 0.25]];
    out.sweeps.push(tube(`tine_${j}${Math.round(x * 100)}`, pts, 0.045, steel, 8));
  }
  for (const sz of [1, -1]) out.extrudes.push(box(`jaw_bar_${sz > 0 ? 'a' : 'b'}`, [-d.w / 2, 0.95, sz * 0.5], [d.w / 2, 0.95, sz * 0.5], 0.08, 0.08, body, [0, 0, 1]));
  const tip = [0, d.length, 0];
  return { ...out, hardpoints: { pin: [0, 0, 0], link: d.link, tip }, outline: [[0, d.length, 0.25], [0, d.length, -0.25], [0, 1.4, 0.62], [0, 1.4, -0.62]] };
}

/** An auger: its drive hung from the pins, its shaft and its flight, its pilot point. */
export function auger(row, C) {
  const d = row.dims, out = { extrudes: [], lathes: [], lofts: [], sweeps: [] }, body = C.paint, steel = tone(C.trim, 0.2);
  // (on a skid steer's plate its frame holds the drive forward of the plate; on an excavator's pins it hangs)
  const y0 = d.skid ? 0.45 : 0.3, axis = d.skid ? [0, 0, -1] : [0, 1, 0], at = (u) => (d.skid ? [0, y0, d.drop - u] : [0, y0 + u, 0]);
  if (d.skid) skidPlate(row, C, out); else excavatorEars(row, C, out);
  if (d.skid) out.extrudes.push(box('frame', [0, 0.06, 0.25], [0, y0, 0.25], 0.12, 0.12, body));
  out.lathes.push(spin('drive', at(-0.05), at(0.5), [[0, 0.16], [0.2, 0.2], [0.8, 0.2], [1, 0.12]], body, 18));
  out.lathes.push(spin('shaft', at(0.5), at(0.5 + d.length), [[0, 0.06], [1, 0.06]], steel, 12));
  const h = helix(0, d.length - 0.1, d.r, d.turns).map(([x, y, z]) => (d.skid ? [x, y0 + z, d.drop - 0.5 - y] : [x, y0 + 0.5 + y, z]));
  out.sweeps.push(tube('flight', h, 0.03, steel, 6));
  out.lathes.push(spin('pilot', at(0.5 + d.length), at(0.5 + d.length + 0.18), [[0, 0.06], [1, 0.005]], tone(C.trim, 0.3), 12));
  const tip = at(0.5 + d.length + 0.18);
  void axis;
  return { ...out, hardpoints: { pin: [0, 0, 0], link: d.link, ...(d.skid ? { 'link.r': [d.linkW, d.link[1], d.link[2]], 'link.l': [-d.linkW, d.link[1], d.link[2]], edge: tip } : {}), tip }, outline: [tip, at(0.5)] };
}

// ── the skid steer's plate: the face every attachment hangs on, its pins at the bucket's ─────────────────────────
function skidPlate(row, C, out) {
  const d = row.dims, steel = tone(C.trim, 0.1);
  out.extrudes.push(box('plate', [0, 0.03, 0.2], [0, 0.06, 0.2], d.width ? Math.min(d.width, 1.4) : 1.4, 0.7, steel));
  for (const s of [1, -1]) out.lathes.push(boss(`pin_${side(s)}`, [0, 0, 0], s * (d.ears - 0.06), s * (d.ears + 0.06), 0.07, steel));
  out.lathes.push(boss('link_pin', d.link, -d.linkW, d.linkW, 0.065, steel));
}

/** Pallet forks on a skid steer's plate: their frame, their backrest, two forks forward. */
export function forks(row, C) {
  const d = row.dims, out = { extrudes: [], lathes: [], lofts: [], sweeps: [] }, steel = tone(C.trim, 0.15), fork = tone(C.trim, -0.05);
  skidPlate(row, C, out);
  for (let k = 0; k <= 4; k++) { const x = -0.6 + (1.2 * k) / 4; out.extrudes.push(box(`rest_${k}`, [x, 0.08, 0.5], [x, 0.08, 1.05], 0.03, 0.03, steel, [0, 1, 0])); }
  out.extrudes.push(box('rest_top', [-0.6, 0.08, 1.05], [0.6, 0.08, 1.05], 0.04, 0.04, steel));
  for (const s of [1, -1]) {
    const x = s * d.spread / 2;
    out.extrudes.push(box(`shank_${side(s)}`, [x, 0.12, -0.15], [x, 0.12, 0.45], 0.1, 0.045, fork, [0, 1, 0]));
    out.lofts.push(loftWorld(`blade_${side(s)}`, [x, 0.1, -0.15], [x, 0.12 + d.fork, -0.15], [{ t: 0, points: roundRect([0, 1, 0], 0.1, 0.045, 0.005, 1) }, { t: 1, points: roundRect([0, 1, 0], 0.1, 0.02, 0.005, 1) }], fork));
  }
  const tip = [0, 0.12 + d.fork, -0.15];
  return { ...out, hardpoints: { pin: [0, 0, 0], link: d.link, 'link.r': [d.linkW, d.link[1], d.link[2]], 'link.l': [-d.linkW, d.link[1], d.link[2]], edge: tip, tip }, outline: [[d.spread / 2, 0.12 + d.fork, -0.17], [-d.spread / 2, 0.12 + d.fork, -0.17], [0, 0.12, -0.17]] };
}

/** A pickup sweeper on a skid steer's plate: its hood, its broom across, its bin. */
export function sweeper(row, C) {
  const d = row.dims, out = { extrudes: [], lathes: [], lofts: [], sweeps: [] }, body = C.paint;
  skidPlate(row, C, out);
  const w = d.width;
  out.extrudes.push(extrudeWorld('hood', [-w / 2, 0.5, 0.2], [w / 2, 0.5, 0.2], [[0, -0.45, 0.25], [0, 0.45, 0.25], [0, 0.45, -0.05], [0, 0.3, 0.28], [0, -0.45, 0.28]].map(([x, y, z]) => [x, y, z - 0.2]), body));
  out.lathes.push(spin('broom', [-w / 2 + 0.05, 0.62, -0.08], [w / 2 - 0.05, 0.62, -0.08], [[0, 0.28], [0.05, 0.3], [0.95, 0.3], [1, 0.28]], '#3a3a36', 18));
  out.extrudes.push(box('bin', [0, 0.12, -0.15], [0, 0.42, -0.15], w - 0.1, 0.3, tone(C.trim, 0.1)));
  const edge = [0, 0.62, -0.38];
  return { ...out, hardpoints: { pin: [0, 0, 0], link: d.link, 'link.r': [d.linkW, d.link[1], d.link[2]], 'link.l': [-d.linkW, d.link[1], d.link[2]], edge, tip: edge }, outline: [edge, [0, 0.95, 0.0], [0, 0.12, -0.3]] };
}

export { add, mul, sweep };
