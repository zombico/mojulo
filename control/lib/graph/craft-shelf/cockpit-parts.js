/**
 * cockpit-parts — a cockpit as a part of its own (`craft-cockpit`), drawn by default wherever a craft's glass lets one
 * see in: a helicopter's bubble, a light aircraft's windscreen. Sized by its row, seated on a hull point at the cabin's
 * floor just behind the nose (its mount the floor's front edge on the centreline, +y forward, +z up). A fighter's made
 * cockpit (air-kit-parts.js cockpit) is fitted to its canopy instead; this one is a row's.
 *
 *   craft-cockpit  { layout: 'side' | 'tandem', seats, panel: 'glass' | 'dials', controls: 'heli' | 'stick' | 'yoke',
 *                    bench?, rake? }
 *     side     the seats side by side across the floor, one panel across in front of them, a centre console between
 *     tandem   the seats one behind the other down the centreline, the rear raised, a panel in front of each
 *     the floor; the panel's coaming and its glare shield, its displays ('glass') or its dials ('dials') facing aft; each
 *     seat's pan, its raked back, its headrest and its harness; each seat's controls: a helicopter's cyclic between the
 *     knees and its collective by the left hand ('heli'), a stick ('stick') or a yoke on its column ('yoke'), and its
 *     pedals; a bench across the floor behind (`bench`: its seats)
 *
 * Its row's dims: { length (the panel's face to the rearmost seat's back), width (wall to wall at the seats), height
 * (the floor to the roof over the seats) }. Pure.
 */
import { lathe, sweep, extrudeWorld, planeUV } from './craft-common.js';

// the cabin's own colours, whatever the paint outside: a dark coaming and console, grey upholstery, a harness's webbing
const DARK = '#25282b', CONSOLE = '#2e3236', SEAT = '#4b5057', SEAT_DARK = '#3a3e43', WEB = '#a07a2c', METAL = '#8a9096';
const ccw = (from, to, ring) => { const uv = planeUV(from, to, ring), a = uv.reduce((t, p, i) => { const q = uv[(i + 1) % uv.length]; return t + p[0] * q[1] - q[0] * p[1]; }, 0); return a < 0 ? ring.slice().reverse() : ring; };
// a box from x0..x1, y0..y1 (y0 the front), z0..z1, extruded down y
const box = (id, x0, x1, y0, y1, z0, z1, tint, extra = {}) => {
  const from = [(x0 + x1) / 2, y0, (z0 + z1) / 2], to = [(x0 + x1) / 2, y1, (z0 + z1) / 2], w = (x1 - x0) / 2, h = (z1 - z0) / 2;
  return { ...extrudeWorld(id, from, to, ccw(from, to, [[w, 0, h], [-w, 0, h], [-w, 0, -h], [w, 0, -h]]), tint), ...extra };
};

/** One seat at (x, y) facing +y: its pan, its back raked aft, its headrest, its harness over its back. */
function seat(id, x, y, { w, z0: floor, H }, out) {
  // (its cushion a seat's height off the floor, on its base)
  const lift = 0.32, z0 = floor + lift, pan = 0.1, back = (H - lift) * 0.66, rake = 0.18;
  out.extrudes.push(box(`${id}_base`, x - w * 0.36, x + w * 0.36, y + w * 0.35, y - w * 0.4, floor, z0, SEAT_DARK));
  out.extrudes.push(box(`${id}_pan`, x - w / 2, x + w / 2, y + w * 0.45, y - w * 0.45, z0, z0 + pan, SEAT));
  const by = y - w * 0.45, from = [x, by, z0 + pan], to = [x, by - 0.07, z0 + pan];
  out.extrudes.push(extrudeWorld(`${id}_back`, from, to, ccw(from, to, [[w / 2, 0, 0], [-w / 2, 0, 0], [-w * 0.45, -back * rake, back], [w * 0.45, -back * rake, back]]), SEAT));
  const hy = by - back * rake - 0.02, hz = z0 + pan + back;
  out.extrudes.push(box(`${id}_headrest`, x - w * 0.3, x + w * 0.3, hy + 0.04, hy - 0.06, hz, hz + 0.16, SEAT_DARK));
  // (its harness: two straps over the shoulders down to the buckle, a lap belt across)
  for (const s of [-1, 1]) out.sweeps.push(sweep(`${id}_strap_${s > 0 ? 'r' : 'l'}`, [[x + s * w * 0.18, hy + 0.06, hz - 0.02], [x + s * w * 0.12, by + 0.06, z0 + pan + back * 0.45], [x, y + w * 0.05, z0 + pan + 0.06]], 0.012, WEB, { sides: 4 }));
  out.sweeps.push(sweep(`${id}_lap`, [[x - w * 0.42, y - w * 0.2, z0 + pan + 0.04], [x, y + w * 0.08, z0 + pan + 0.07], [x + w * 0.42, y - w * 0.2, z0 + pan + 0.04]], 0.013, WEB, { sides: 4 }));
}

/** One seat's controls, its seat at (x, y): a helicopter's cyclic and collective, a stick or a yoke; its pedals ahead. */
function controls(id, kind, x, y, { w, z0 }, out) {
  const zs = z0 + 0.1, zc = z0 + 0.27;
  if (kind === 'heli') {
    out.sweeps.push(sweep(`${id}_cyclic`, [[x, y + w * 0.75, z0], [x, y + w * 0.7, zs + 0.38]], 0.014, DARK, { sides: 6 }));
    out.sweeps.push(sweep(`${id}_cyclic_grip`, [[x, y + w * 0.7, zs + 0.36], [x, y + w * 0.68, zs + 0.5]], 0.024, DARK, { sides: 6 }));
    // (the collective by the left hand, rising forward from beside the seat)
    out.sweeps.push(sweep(`${id}_collective`, [[x - w * 0.6, y - w * 0.3, zc], [x - w * 0.6, y + w * 0.3, zc + 0.16]], 0.016, DARK, { sides: 6 }));
    out.sweeps.push(sweep(`${id}_throttle`, [[x - w * 0.6, y + w * 0.28, zc + 0.15], [x - w * 0.6, y + w * 0.42, zc + 0.2]], 0.026, CONSOLE, { sides: 6 }));
  } else if (kind === 'stick') {
    out.sweeps.push(sweep(`${id}_stick`, [[x, y + w * 0.7, z0], [x, y + w * 0.65, zs + 0.42]], 0.016, DARK, { sides: 6 }));
  } else if (kind === 'yoke') {
    const yy = y + w * 1.25, zz = zs + 0.42;
    out.sweeps.push(sweep(`${id}_column`, [[x, yy + 0.25, zz], [x, yy, zz]], 0.018, METAL, { sides: 6 }));
    out.sweeps.push(sweep(`${id}_yoke`, [[x - w * 0.22, yy, zz + 0.08], [x - w * 0.2, yy, zz - 0.02], [x + w * 0.2, yy, zz - 0.02], [x + w * 0.22, yy, zz + 0.08]], 0.016, DARK, { sides: 6 }));
  }
  for (const s of [-1, 1]) out.extrudes.push(box(`${id}_pedal_${s > 0 ? 'r' : 'l'}`, x + s * w * 0.18 - 0.04, x + s * w * 0.18 + 0.04, y + w * 1.45, y + w * 1.35, z0 + 0.02, z0 + 0.16, METAL));
}

/** A panel across `x0..x1` at `y`: its coaming and glare shield, its displays or dials facing aft. */
function panel(id, kind, x0, x1, y, { z0, H }, out) {
  const zt = z0 + H * 0.62, zb = z0 + H * 0.3;
  out.extrudes.push(box(`${id}`, x0, x1, y, y - 0.12, zb, zt, DARK));
  out.extrudes.push(box(`${id}_shield`, x0 - 0.02, x1 + 0.02, y + 0.03, y - 0.18, zt, zt + 0.035, DARK));
  const w = x1 - x0, n = Math.max(1, Math.round(w / 0.32));
  for (let i = 0; i < n; i++) {
    const cx = x0 + ((i + 0.5) * w) / n, hw = Math.min(0.11, (w / n) * 0.36), cz = (zb + zt) / 2;
    if (kind === 'glass') out.extrudes.push(box(`${id}_display_${i}`, cx - hw, cx + hw, y - 0.12, y - 0.124, cz - hw * 0.8, cz + hw * 0.8, '#1d2a33', { material: 'glass' }));
    else for (const [j, [dx, dz]] of [[-0.5, 0.4], [0.5, 0.4], [-0.5, -0.4], [0.5, -0.4]].entries()) out.lathes.push(lathe(`${id}_dial_${i}_${j}`, [cx + dx * hw, y - 0.12, cz + dz * hw], [cx + dx * hw, y - 0.126, cz + dz * hw], [[0, hw * 0.42], [1, hw * 0.36]], METAL, { samples: 12, crossSections: 2 }));
  }
}

export function buildCockpit(row, C) {
  const { length: L, width: W, height: H } = row.dims, b = row.build, out = { extrudes: [], sweeps: [], lathes: [] };
  if (!['side', 'tandem'].includes(b.layout)) throw new Error(`Unknown craft-cockpit layout '${b.layout}'`);
  const z0 = 0, sw = Math.min(0.52, (b.layout === 'side' ? W / Math.max(2, b.seats) : W) * 0.78);
  out.extrudes.push(box('floor', -W / 2, W / 2, 0, -L, z0 - 0.02, z0, CONSOLE));
  if (b.layout === 'side') {
    const xs = Array.from({ length: b.seats }, (_, i) => (i - (b.seats - 1) / 2) * (W / b.seats)), ys = -L * (b.bench ? 0.42 : 0.6);
    panel('panel', b.panel, -W * 0.42, W * 0.42, -0.05, { z0, H }, out);
    // (the centre console from the panel down between the seats)
    out.extrudes.push(box('console', -0.09, 0.09, -0.17, ys + sw * 0.1, z0, z0 + H * 0.3, CONSOLE));
    xs.forEach((x, i) => { seat(`seat_${i}`, x, ys, { w: sw, z0, H }, out); controls(`ctl_${i}`, b.controls, x, ys, { w: sw, z0 }, out); });
    if (b.bench) {
      const by = -L + sw * 0.5;
      out.extrudes.push(box('bench', -W * 0.44, W * 0.44, by + sw * 0.45, by - sw * 0.45, z0, z0 + 0.42, SEAT));
      const from = [0, by - sw * 0.45, z0 + 0.42], to = [0, by - sw * 0.45 - 0.08, z0 + 0.42];
      out.extrudes.push(extrudeWorld('bench_back', from, to, ccw(from, to, [[W * 0.44, 0, 0], [-W * 0.44, 0, 0], [-W * 0.44, -0.08, H * 0.5], [W * 0.44, -0.08, H * 0.5]]), SEAT));
    }
  } else {
    // tandem: the front seat low, the rear raised behind it, a panel in front of each
    const step = L / Math.max(1, b.seats);
    for (let i = 0; i < b.seats; i++) {
      const y = -step * (i + 0.62), zr = z0 + i * (b.rake ?? 0.32);
      panel(`panel_${i}`, b.panel, -W * 0.4, W * 0.4, y + step * 0.55, { z0: zr, H: H - i * (b.rake ?? 0.32) }, out);
      if (i) out.extrudes.push(box(`deck_${i}`, -W / 2, W / 2, y + step * 0.45, y - step * 0.5, z0, zr, CONSOLE));
      seat(`seat_${i}`, 0, y, { w: sw, z0: zr, H: H - i * (b.rake ?? 0.32) }, out);
      controls(`ctl_${i}`, b.controls, 0, y, { w: sw, z0: zr }, out);
    }
  }
  return { ...out, hardpoints: { mount: [0, 0, 0] } };
}
