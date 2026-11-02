/**
 * THE HEAVY CLASSES in the form render (road-form.js): a realistic bus, box truck and semi built as their own bodies,
 * at the class's true numbers (roads/fleet.js FLEET) and round the fleet's own wheels, in place of the fleet's boxes.
 * The physics, the census and the wheels (road-wheel.js) are the fleet's; the body is drawn here. The glasshouse and
 * the panels (road-glass.js, road-panels.js) read it after, as they read a car: its window band is parted and framed,
 * its cab's doors cut and fitted.
 *
 *   bus        a city bus: a plan rounded at its corners, arches over its wheels, a skirt to the belt, a window band
 *              (side glass the glasshouse parts into panes, a flat windscreen between painted corners), a roof edge
 *              and a bevel to the roof, a pod on it; a front door and a middle door on the kerb side, glazed full
 *              height; a destination sign lit over the screen, head lamps and bumpers, a rear grille and tail lamps
 *   straight   a box truck: a cab over its front wheels (a screen, a door's window each side, a grille between head
 *              lamps, a bumper) and its box (panels between posts, rails at the top and the floor, two rear doors
 *              with their lock bars, marker lamps), the frame under it, mud flaps
 *   semi       a tractor and its trailer: a long hood to a chrome grille (head lamps at its corners, a chrome bumper),
 *              a cab and its sleeper, two exhaust stacks, five marker lamps on the roof, chrome fuel tanks, the frame;
 *              the trailer a box as the truck's, its side skirts, landing gear and underride guard, mud flaps
 *
 *   heavyBody(spec, { hubs, body, seed }) → form faces { corners, part, material, albedo, outNormal }, or null for a
 *                                           class that is not heavy
 *     hubs   the wheels' hubs in the loft's frame (realistic.js hubOf), so the arches and the flaps sit over them
 *     body   the paint colour (the bus and the cabs); boxes and trailers are white
 *
 * Vehicle space (+y forward, x across, +x the kerb side, z up), the body on y from −L/2 to L/2. Pure and deterministic.
 */

export const HEAVY_KINDS = Object.freeze(['bus', 'straight', 'semi']);
const C = Object.freeze({
  white: '#eceeea', post: '#c9ccd0', seal: '#141518', rubber: '#1b1c1f', chrome: '#d4d7da', carbon: '#1d2024',
  pod: '#dfe2e4', frame: '#26282a', lamp: '#e9edf0', tail: '#9a1a17', amber: '#ffa62b',
});

const unit = (v) => { const d = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / d, v[1] / d, v[2] / d]; };
function newell(c) {
  const n = [0, 0, 0];
  for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length]; n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); }
  return n;
}
// a face, its normal its own turned toward `toward` (the side it faces)
function face(corners, part, material, albedo, toward) {
  let n = unit(newell(corners));
  if (n[0] * toward[0] + n[1] * toward[1] + n[2] * toward[2] < 0) { n = n.map((v) => -v); corners = corners.slice().reverse(); }
  return { corners, part, material, albedo, outNormal: n };
}
const paintOf = (body) => ({ part: 'body', material: 'paint', albedo: body });
const M = (part, material, albedo) => ({ part, material, albedo });

/** A box: x, y, z extents, its sides each `look` (or `look(side)`), the bottom left off unless asked. */
function box([x0, x1], [y0, y1], [z0, z1], look, { bottom = false } = {}) {
  const L = typeof look === 'function' ? look : () => look;
  const P = (x, y, z) => [x, y, z];
  const sides = [
    ['+x', [P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)], [1, 0, 0]],
    ['-x', [P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0)], [-1, 0, 0]],
    ['+y', [P(x0, y1, z0), P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0)], [0, 1, 0]],
    ['-y', [P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)], [0, -1, 0]],
    ['+z', [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], [0, 0, 1]],
    ...(bottom ? [['-z', [P(x0, y0, z0), P(x0, y1, z0), P(x1, y1, z0), P(x1, y0, z0)], [0, 0, -1]]] : []),
  ];
  return sides.map(([s, c, n]) => { const m = L(s); return m ? face(c, m.part, m.material, m.albedo, n) : null; }).filter(Boolean);
}
/** A cylinder along an axis ('y' or 'z') through `at`, radius r, from a to b along it, n sides, its caps. */
function cylinder(axis, at, r, [a, b], look, n = 12) {
  const P = (t, s) => (axis === 'z' ? [at[0] + r * Math.cos(t), at[1] + r * Math.sin(t), s] : [at[0] + r * Math.cos(t), s, at[2] + r * Math.sin(t)]);
  const out = [], toward = (t) => (axis === 'z' ? [Math.cos(t), Math.sin(t), 0] : [Math.cos(t), 0, Math.sin(t)]);
  for (let i = 0; i < n; i++) {
    const t0 = (2 * Math.PI * i) / n, t1 = (2 * Math.PI * (i + 1)) / n;
    out.push(face([P(t0, a), P(t1, a), P(t1, b), P(t0, b)], look.part, look.material, look.albedo, toward((t0 + t1) / 2)));
  }
  const cap = (s, sign) => face(Array.from({ length: n }, (_, i) => P((2 * Math.PI * i) / n, s)), look.part, look.material, look.albedo, axis === 'z' ? [0, 0, sign] : [0, sign, 0]);
  out.push(cap(a, -1), cap(b, 1));
  return out;
}
/** A quad just proud of a face that looks along `n` (an end's or a side's), centred `at`, size w (across) by h. */
function plate(at, n, [w, h], look) {
  const [x, y, z] = at, hw = w / 2, hh = h / 2;
  const c = Math.abs(n[1]) > 0.5 ? [[x - hw, y, z - hh], [x + hw, y, z - hh], [x + hw, y, z + hh], [x - hw, y, z + hh]] : [[x, y - hw, z - hh], [x, y + hw, z - hh], [x, y + hw, z + hh], [x, y - hw, z + hh]];
  return face(c, look.part, look.material, look.albedo, n);
}

// ── the plan and its bands ──────────────────────────────────────────────────────
// a plan rounded at its four corners (radius rf at the front, rr at the rear), its sides sampled at `ys` (an arch's
// stations, a door's edges), anticlockwise from the kerb side's rear: [{ x, y, edge }] (edge: 'side+', 'front', …)
function roundPlan(hw, [y0, y1], rf, rr, ys = [], seg = 4) {
  const pts = [];
  const arc = (cx, cy, r, a0, a1, edge) => { for (let i = 0; i <= seg; i++) { const a = a0 + ((a1 - a0) * i) / seg; pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), edge }); } };
  const side = (sx, from, to) => { const s = [...new Set(ys.filter((y) => y > Math.min(from, to) + 0.01 && y < Math.max(from, to) - 0.01).map((y) => Math.round(y * 1e4) / 1e4))].sort((a, b) => (from < to ? a - b : b - a)); for (const y of s) pts.push({ x: sx * hw, y, edge: sx > 0 ? 'side+' : 'side-' }); };
  arc(hw - rr, y0 + rr, rr, -Math.PI / 2, 0, 'corner-rear');
  side(1, y0 + rr, y1 - rf);
  arc(hw - rf, y1 - rf, rf, 0, Math.PI / 2, 'corner-front');
  arc(-hw + rf, y1 - rf, rf, Math.PI / 2, Math.PI, 'corner-front');
  side(-1, y1 - rf, y0 + rr);
  arc(-hw + rr, y0 + rr, rr, Math.PI, 1.5 * Math.PI, 'corner-rear');
  return pts.filter((p, i) => i === 0 || Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) > 1e-4);
}
// a plan's edges extruded from z0(p) to z1(p), each the look `look(a, b)` gives it (null: none)
function band(plan, z0, z1, look) {
  const out = [], cx = plan.reduce((s, p) => s + p.x, 0) / plan.length, cy = plan.reduce((s, p) => s + p.y, 0) / plan.length;
  for (let i = 0; i < plan.length; i++) {
    const a = plan[i], b = plan[(i + 1) % plan.length], m = look(a, b);
    if (!m) continue;
    const c = [[a.x, a.y, z0(a)], [b.x, b.y, z0(b)], [b.x, b.y, z1(b)], [a.x, a.y, z1(a)]];
    if (Math.abs(c[0][2] - c[3][2]) < 1e-4 && Math.abs(c[1][2] - c[2][2]) < 1e-4) continue;
    out.push(face(c, m.part, m.material, m.albedo, [(a.x + b.x) / 2 - cx, (a.y + b.y) / 2 - cy, 0]));
  }
  return out;
}
const capAt = (plan, z, look, up = 1) => face(plan.map((p) => [p.x, p.y, z]), look.part, look.material, look.albedo, [0, 0, up]);
const inset = (plan, d) => { const cx = plan.reduce((s, p) => s + p.x, 0) / plan.length, cy = plan.reduce((s, p) => s + p.y, 0) / plan.length; return plan.map((p) => { const dx = p.x - cx, dy = p.y - cy, l = Math.hypot(dx, dy) || 1; return { ...p, x: p.x - (dx / l) * d * Math.abs(dx / l), y: p.y - (dy / l) * d * Math.abs(dy / l) }; }); };
// the arch over each axle: the skirt's foot rises round the tyre
const archOf = (hubs, r) => { const axles = [...new Set(hubs.map((h) => Math.round(h[1] * 1e3) / 1e3))], R = r * 1.12 + 0.04; return { axles, R, foot: (y, z0) => { let z = z0; for (const a of axles) { const d = Math.abs(y - a); if (d < R) z = Math.max(z, r + Math.sqrt(R * R - d * d) * 0.98); } return z; }, stations: axles.flatMap((a) => Array.from({ length: 11 }, (_, i) => a - R * Math.cos((Math.PI * i) / 10))) }; };
const evenly = (y0, y1, step) => Array.from({ length: Math.ceil((y1 - y0) / step) + 1 }, (_, i) => Math.min(y1, y0 + i * step));

// mud flaps behind an axle: a rubber sheet each side, facing back
const flaps = (y, hw, z1 = 0.85) => [-1, 1].map((sx) => face([[sx * hw - 0.3, y, 0.18], [sx * hw + 0.3, y, 0.18], [sx * hw + 0.3, y, z1], [sx * hw - 0.3, y, z1]], 'mudflap', 'rubber', C.rubber, [0, -1, 0]));

// a box body (a truck's or a trailer's): panels between posts, rails at its floor and its top, two rear doors with
// their lock bars, marker lamps at its corners; its front face white
function cargoBox(hw, [y0, y1], [z0, z1]) {
  const out = [], post = M('box.post', 'alloy', C.post), panel = M('box', 'paint', C.white), rail = M('box.rail', 'alloy', C.post);
  // the sides as columns between posts every 0.62 m, each a panel and its post, between the floor's rail and the top's
  const cols = evenly(y0, y1, 0.62);
  for (const sx of [-1, 1]) {
    for (let i = 0; i + 1 < cols.length; i++) {
      const ya = cols[i], yb = cols[i + 1], yp = Math.max(ya, yb - 0.06), x = sx * hw;
      const strip = (yA, yB, za, zb, m) => out.push(face([[x, yA, za], [x, yB, za], [x, yB, zb], [x, yA, zb]], m.part, m.material, m.albedo, [sx, 0, 0]));
      strip(ya, yb, z0, z0 + 0.14, rail);
      strip(ya, yb, z1 - 0.1, z1, rail);
      strip(ya, yp, z0 + 0.14, z1 - 0.1, panel);
      if (yp < yb) strip(yp, yb, z0 + 0.14, z1 - 0.1, post);
    }
  }
  out.push(...box([-hw, hw], [y0, y1], [z0, z1], (s) => (s === '+z' ? panel : s === '+y' ? panel : s === '-y' ? M('box.door', 'paint', C.white) : null), { bottom: true }).map((f) => (f.outNormal[2] < -0.5 ? { ...f, part: 'floor', material: 'seal', albedo: C.frame } : f)));
  // the rear doors: a seam between the leaves, a frame round them, four lock bars, the marker lamps
  const back = y0 - 0.006, n = [0, -1, 0];
  out.push(plate([0, back, (z0 + z1) / 2], n, [0.025, z1 - z0 - 0.1], M('seam', 'seal', C.seal)));
  for (const x of [-hw * 0.72, -hw * 0.22, hw * 0.22, hw * 0.72]) out.push(plate([x, back - 0.004, (z0 + z1) / 2], n, [0.035, z1 - z0 - 0.3], M('box.lockbar', 'alloy', C.chrome)));
  for (const [x, z] of [[-hw + 0.05, z1 - 0.05], [hw - 0.05, z1 - 0.05]]) out.push(plate([x, back - 0.004, z], n, [0.08, 0.05], M('marker', 'marker', C.amber)));
  for (const sx of [-1, 1]) out.push(plate([sx * (hw + 0.004), y1 - 0.08, z1 - 0.06], [sx, 0, 0], [0.08, 0.05], M('marker', 'marker', C.amber)));
  return out;
}

// ── the bus ─────────────────────────────────────────────────────────────────────
function bus({ L, W, H, r }, hubs, body) {
  const hw = W / 2, y0 = -L / 2, y1 = L / 2, A = archOf(hubs, r), belt = 1.25, win = 2.75, base = 0.32;
  // the kerb side's doors: one ahead of the front axle (as wide as the overhang lets it), one between the axles
  const [front, rear] = [Math.max(...A.axles), Math.min(...A.axles)];
  const fd = [front + A.R + 0.12, Math.min(y1 - 0.4, front + A.R + 1.22)], md = [(front + rear) / 2 - 0.62, (front + rear) / 2 + 0.62];
  const doors = [fd, md].filter(([a, b]) => b - a > 0.55);
  const inDoor = (a, b) => a.edge === 'side+' && b.edge === 'side+' && doors.some(([d0, d1]) => Math.min(a.y, b.y) >= d0 - 1e-6 && Math.max(a.y, b.y) <= d1 + 1e-6);
  const plan = roundPlan(hw, [y0, y1], 0.3, 0.2, [...A.stations, ...evenly(y0 + 0.2, y1 - 0.3, 0.6), ...doors.flat()]);
  const paint = paintOf(body), glass = M('glass', 'glass', '#1e2630'), door = M('door.glass', 'glass', '#1e2630');
  const side = (a, b) => a.edge.startsWith('side') && b.edge.startsWith('side');
  const out = [
    // the skirt to the belt, rising round the arches; the doors glazed full height
    ...band(plan, (p) => (p.edge.startsWith('side') ? A.foot(p.y, base) : base), () => belt, (a, b) => (inDoor(a, b) ? door : paint)),
    // the window band: the sides' glass, a flat screen between the painted corners, the rear in paint
    ...band(plan, () => belt, () => win, (a, b) => (inDoor(a, b) ? door : side(a, b) ? glass : a.edge === 'corner-front' && b.edge === 'corner-front' && Math.abs(a.y - b.y) < 1e-3 ? glass : paint)),
    // the roof's edge and its bevel to the roof, the roof itself, a pod on it
    ...band(plan, () => win, () => H - 0.08, () => paint),
  ];
  const top = inset(plan, 0.1);
  for (let i = 0; i < plan.length; i++) {
    const a = plan[i], b = plan[(i + 1) % plan.length], c = top[(i + 1) % plan.length], d = top[i];
    out.push(face([[a.x, a.y, H - 0.08], [b.x, b.y, H - 0.08], [c.x, c.y, H], [d.x, d.y, H]], 'roof', 'paint', body, [(a.x + b.x) / 2, (a.y + b.y) / 2, 1]));
  }
  out.push(capAt(top, H, M('roof', 'paint', body)));
  out.push(...box([-0.85, 0.85], [-1.2, 1.6], [H, H + 0.22], M('roof.pod', 'paint', C.pod)));
  // the face: the destination sign over the screen, the head lamps, the bumpers; the rear's grille, window and lamps
  out.push(plate([0, y1 + 0.006, H - 0.24], [0, 1, 0], [W - 0.7, 0.2], M('sign', 'sign', C.amber)));
  for (const sx of [-1, 1]) {
    out.push(plate([sx * (hw - 0.42), y1 + 0.006, 0.78], [0, 1, 0], [0.34, 0.14], M('headlamp', 'lamp', C.lamp)));
    out.push(plate([sx * (hw - 0.12), y0 - 0.006, 1.05], [0, -1, 0], [0.12, 0.6], M('taillamp', 'tail', C.tail)));
  }
  out.push(...box([-hw + 0.1, hw - 0.1], [y1, y1 + 0.06], [base, 0.56], M('bumper', 'carbon', C.carbon)));
  out.push(...box([-hw + 0.1, hw - 0.1], [y0 - 0.06, y0], [base, 0.56], M('bumper', 'carbon', C.carbon)));
  out.push(plate([0, y0 - 0.006, 0.95], [0, -1, 0], [W - 0.9, 0.55], M('grille', 'carbon', C.carbon)));
  out.push(plate([0, y0 - 0.006, 2.25], [0, -1, 0], [W - 0.8, 0.7], M('glass', 'glass', '#1e2630')));
  return out;
}

// ── a cab: a cab over its front wheels (the truck's), or behind a hood (the semi's) ─────────────────────────────────
function cab({ hw, y0, y1, z0, z1, screen, body, window: winY }) {
  const plan = roundPlan(hw, [y0, y1], 0.18, 0.04, evenly(y0, y1, 0.4).concat(winY));
  const paint = paintOf(body), glass = M('glass', 'glass', '#1e2630'), sill = screen[0], head = screen[1];
  const glazedSide = (a, b) => a.edge.startsWith('side') && b.edge.startsWith('side') && Math.min(a.y, b.y) >= winY[0] - 1e-6 && Math.max(a.y, b.y) <= winY[1] + 1e-6;
  const front = (a, b) => a.edge === 'corner-front' && b.edge === 'corner-front' && Math.abs(a.y - b.y) < 1e-3;
  return [
    ...band(plan, () => z0, () => sill, () => paint),
    ...band(plan, () => sill, () => head, (a, b) => (glazedSide(a, b) || front(a, b) ? glass : paint)),
    ...band(plan, () => head, () => z1, () => paint),
    capAt(plan, z1, M('roof', 'paint', body)),
  ];
}

// ── the box truck ───────────────────────────────────────────────────────────────
function straight({ L, W, H, r, cab: cabL, cabH }, hubs, body) {
  const hw = W / 2, y1 = L / 2, yc = y1 - cabL;
  const out = cab({ hw: hw - 0.05, y0: yc, y1, z0: 0.55, z1: cabH, screen: [1.7, cabH - 0.3], body, window: [yc + 0.35, y1 - 0.4] });
  // its face: a grille between head lamps over a bumper
  out.push(plate([0, y1 + 0.006, 1.12], [0, 1, 0], [W - 1.0, 0.6], M('grille', 'carbon', C.carbon)));
  for (const sx of [-1, 1]) out.push(plate([sx * (hw - 0.3), y1 + 0.006, 0.95], [0, 1, 0], [0.32, 0.18], M('headlamp', 'lamp', C.lamp)));
  out.push(...box([-hw + 0.05, hw - 0.05], [y1, y1 + 0.08], [0.42, 0.72], M('bumper', 'carbon', C.carbon)));
  // the box, the frame under it, the flaps behind the rear wheels, the tail lamps on the underride bar
  const by1 = yc - 0.15, by0 = -L / 2;
  out.push(...cargoBox(hw, [by0, by1], [1.05, H]));
  out.push(...box([-0.45, 0.45], [by0 + 0.3, y1 - 0.2], [0.62, 1.05], M('frame', 'seal', C.frame)));
  const back = Math.min(...hubs.map((h) => h[1]));
  out.push(...flaps(back - r - 0.15, hw - 0.35));
  out.push(...box([-hw + 0.15, hw - 0.15], [by0 + 0.05, by0 + 0.18], [0.45, 0.6], M('bumper', 'alloy', C.chrome)));
  for (const sx of [-1, 1]) out.push(plate([sx * (hw - 0.3), by0 + 0.04, 0.52], [0, -1, 0], [0.22, 0.1], M('taillamp', 'tail', C.tail)));
  return out;
}

// ── the semi ────────────────────────────────────────────────────────────────────
function semi({ L, W, H, r, kingpin, trailerL, cabH }, hubs, body) {
  const hw = W / 2, y1 = L / 2, hoodL = 2.0, cabL = 3.4, yh = y1 - hoodL, ys = yh - cabL, out = [];
  // the hood: narrower than the cab, its top rising to the cowl; a chrome grille, its lamps at the corners
  const hood = roundPlan(1.05, [yh, y1], 0.22, 0.02, evenly(yh, y1, 0.3));
  const hoodTop = (p) => 1.75 + 0.4 * ((y1 - p.y) / hoodL);
  out.push(...band(hood, () => 0.78, hoodTop, () => paintOf(body)));
  for (let i = 1; i + 1 < hood.length; i++) out.push(face([[hood[0].x, hood[0].y, hoodTop(hood[0])], [hood[i].x, hood[i].y, hoodTop(hood[i])], [hood[i + 1].x, hood[i + 1].y, hoodTop(hood[i + 1])]], 'body', 'paint', body, [0, 0.2, 1]));
  out.push(plate([0, y1 + 0.008, 1.28], [0, 1, 0], [1.4, 0.78], M('grille', 'alloy', C.chrome)));
  for (const sx of [-1, 1]) out.push(plate([sx * 0.86, y1 + 0.008, 1.3], [0, 1, 0], [0.3, 0.2], M('headlamp', 'lamp', C.lamp)));
  out.push(...box([-hw + 0.02, hw - 0.02], [y1, y1 + 0.14], [0.5, 0.82], M('bumper', 'alloy', C.chrome)));
  // the cab and its sleeper, two stacks, the roof's markers, the tanks, the frame, the flaps behind the drive axles
  out.push(...cab({ hw: hw - 0.06, y0: ys, y1: yh, z0: 0.95, z1: cabH, screen: [2.2, 3.0], body, window: [yh - 1.35, yh - 0.25] }));
  for (const sx of [-1, 1]) out.push(...cylinder('z', [sx * (hw - 0.16), ys + 0.2, 0], 0.07, [1.3, cabH + 0.55], M('exhaust', 'alloy', C.chrome)));
  for (let i = 0; i < 5; i++) out.push(plate([(i - 2) * 0.32, yh + 0.006 - 0.02, cabH - 0.06], [0, 1, 0], [0.09, 0.05], M('marker', 'marker', C.amber)));
  for (const sx of [-1, 1]) out.push(...cylinder('y', [sx * 0.95, 0, 0.8], 0.25, [ys + 0.3, ys + 1.8], M('tank', 'alloy', C.chrome)));
  const yk = y1 - kingpin, drive = hubs.map((h) => h[1]).filter((y) => y < ys + 1 && y > yk - 2);
  out.push(...box([-0.5, 0.5], [yk - 1.4, y1 - 0.2], [0.75, 1.1], M('frame', 'seal', C.frame)));
  if (drive.length) out.push(...flaps(Math.min(...drive) - r - 0.12, hw - 0.4));
  // the trailer: its box, skirts between the landing gear and its axles, the landing gear, the underride guard, flaps
  const yr0 = yk + 1.0, yr1 = yr0 - trailerL, axles = hubs.map((h) => h[1]).filter((y) => y < yr1 + 6);
  out.push(...cargoBox(hw, [yr1, yr0], [1.25, H]));
  for (const sx of [-1, 1]) out.push(face([[sx * (hw - 0.03), yr1 + 5.0, 0.35], [sx * (hw - 0.03), yk - 2.0, 0.35], [sx * (hw - 0.03), yk - 2.0, 1.25], [sx * (hw - 0.03), yr1 + 5.0, 1.25]], 'skirt', 'carbon', C.carbon, [sx, 0, 0]));
  for (const sx of [-1, 1]) out.push(...box([sx * 0.95 - 0.07, sx * 0.95 + 0.07], [yk - 1.9, yk - 1.75], [0.1, 1.25], M('frame', 'seal', C.frame)));
  out.push(...box([-hw + 0.2, hw - 0.2], [yr1 + 0.05, yr1 + 0.2], [0.45, 0.6], M('bumper', 'alloy', C.chrome)));
  for (const sx of [-1, 1]) out.push(plate([sx * 1.05, yr1 - 0.005, 1.02], [0, -1, 0], [0.2, 0.15], M('taillamp', 'tail', C.tail)));
  if (axles.length) out.push(...flaps(Math.min(...axles) - r - 0.15, hw - 0.35));
  return out;
}

/** A heavy class's body in the form render, or null (a car's is the loft's). */
export function heavyBody(spec, { hubs, body = '#8a8f96' } = {}) {
  if (spec.kind === 'bus') return bus(spec, hubs, body);
  if (spec.kind === 'straight') return straight(spec, hubs, body);
  if (spec.kind === 'semi') return semi(spec, hubs, body);
  return null;
}
