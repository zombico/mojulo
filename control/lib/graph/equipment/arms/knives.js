// equipment/arms/knives — the knife's models: combat (a clip point, a cross guard, a ridged handle), tanto (the angled
// point, a choil, a cord wrap), dagger (a double-edged spear point, full-tang scales) and karambit (a hawkbill claw and
// the finger ring at its pommel). Generic forms. The frame is the sword's (equipment/sword.js): the pommel at z = 0,
// the blade up +z, its edge toward +x, its flat in the xz plane; the hero holds it as a blade (polygonizer/hero-gear.js).
// The blade is ground toward its spine with a brighter secondary bevel along its edge (arms law 8); the future line's
// edge is the glow (law 7).
import * as dmath from '../../../util/dmath.js';
import { slabC, grind, box, tube, r4 } from './geom.js';

const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const C01 = (t) => Math.max(0, Math.min(1, t));

/**
 * The blade outlines: for each, the stations (t from the heel 0 to the tip 1) and, at each, the spine's and the edge's
 * offset across the blade (x; the edge +x), the tip's own x, and which stations are ground. W the width, L the length.
 */
const BLADES = Object.freeze({
  clip: { ts: [0, 0.07, 0.25, 0.45, 0.62, 0.72, 0.82, 0.9, 0.96, 1], tip: -0.14,
    spine: (t, h, W) => (t <= 0.62 ? -h : lerp(-h, -0.14 * W, dmath.pow(smooth((t - 0.62) / 0.38), 0.85))),
    edge: (t, h, W) => (t <= 0.6 ? h * (1 - 0.04 * t) : lerp(-0.14 * W, h * 0.976, Math.sqrt(C01(1 - ((t - 0.6) / 0.4) ** 2)))),
    falseEdge: (t) => (t > 0.64 ? 0.7 : 0) },
  drop: { ts: [0, 0.07, 0.25, 0.45, 0.6, 0.72, 0.82, 0.9, 0.96, 1], tip: 0.04,
    spine: (t, h, W) => (t <= 0.55 ? -h : lerp(-h, 0.04 * W, dmath.pow((t - 0.55) / 0.45, 1.7))),
    edge: (t, h, W) => (t <= 0.6 ? h : lerp(0.04 * W, h, Math.sqrt(C01(1 - ((t - 0.6) / 0.4) ** 2)))) },
  tanto: { ts: [0, 0.07, 0.3, 0.55, 0.8, 0.86, 1], tip: -0.34,
    spine: (t, h, W) => (t <= 0.86 ? -h : lerp(-h, -0.34 * W, (t - 0.86) / 0.14)),
    edge: (t, h, W) => (t <= 0.8 ? h : lerp(h, -0.34 * W, (t - 0.8) / 0.2)) },
  spear: { ts: [0, 0.07, 0.25, 0.45, 0.65, 0.82, 0.93, 1], tip: 0,
    spine: (t, h) => (t <= 0.07 ? -h : -h * (1 - dmath.pow((t - 0.07) / 0.93, 1.6)) * (1 - 0.12 * t)),
    edge: (t, h) => (t <= 0.07 ? h : h * (1 - dmath.pow((t - 0.07) / 0.93, 1.6)) * (1 - 0.12 * t)),
    falseEdge: (t) => (t > 0.07 ? 1 : 0) },
});

/** A hawkbill's stations: the centre line an arc curving toward the edge, the width tapering into the claw's point. */
function hawkbill(L, W, z0) {
  const th = (70 * Math.PI) / 180, R = L / th, spine = [], edge = [], ts = [0, 0.1, 0.25, 0.4, 0.55, 0.7, 0.82, 0.92, 1];
  for (const t of ts) {
    const a = th * t, cz = z0 + R * dmath.sin(a), cx = R * (1 - dmath.cos(a)), nz = -dmath.sin(a), nx = dmath.cos(a), w = (W / 2) * (1 - 0.92 * dmath.pow(t, 1.4));
    // the spine on the outside of the curve (−n), the edge inside it (+n, toward +x)
    spine.push([cz - nz * w, cx - nx * w]); edge.push([cz + nz * w, cx + nx * w]);
  }
  edge[edge.length - 1] = spine[spine.length - 1];
  return { spine, edge, edgeW: ts.map((t) => (t < 0.1 ? 0 : 1)), spineW: ts.map(() => 0), tip: [spine[spine.length - 1][1], spine[spine.length - 1][0]] };
}

/** The knife. `spec` is the model's row (arms/models.js); a karambit carries its ring. */
export function buildKnife(c, spec) {
  const { parts: p, P } = c, g = P.girth, fut = c.line === 'future';
  const L = c.length * P.length, W = (p.blade === 'hawkbill' ? 2.6 : p.blade === 'spear' ? 2.6 : 3.3) * g, T = (p.blade === 'spear' ? 0.5 : 0.6) * g;
  const Lh = (spec.ring ? 9.5 : p.blade === 'spear' ? 10.5 : 11.8) * P.length * P.hand, hx = 1.25 * g * P.hand, hy = 1.3 * g * P.hand;
  const gD = p.guard === 'none' ? 0 : p.guard === 'choil' ? 0.55 : 0.85, zb = Lh + gD;
  const blade = c.R.blade, edgeRole = fut && c.R.glow ? c.R.glow : c.R.edge;
  // the blade, paired stations from the heel to the tip, ground toward its spine (law 8)
  let st;
  if (p.blade === 'hawkbill') st = hawkbill(L, W, zb);
  else {
    const B = BLADES[p.blade], h = W / 2;
    const spine = B.ts.map((t) => [zb + t * L, B.spine(t, h, W)]), edge = B.ts.map((t) => [zb + t * L, B.edge(t, h, W)]);
    edge[edge.length - 1] = spine[spine.length - 1];
    st = { spine, edge, edgeW: B.ts.map((t) => (t < 0.07 ? 0 : 1)), spineW: B.ts.map((t) => (B.falseEdge ? B.falseEdge(t) : 0)), tip: [spine[spine.length - 1][1], zb + L] };
  }
  grind({ spine: st.spine, edge: st.edge, spineW: st.spineW, edgeW: st.edgeW, T, grind: p.blade === 'spear' ? 0.85 : 0.62, role: blade, edgeRole, group: 'blade' }).forEach((e) => c.add('extrudes', e));
  // the spine's saw (serrations): teeth proud of the spine along its first half (law 5: fewer, bigger as it stylizes)
  if (p.serrations && p.blade !== 'hawkbill' && p.blade !== 'spear') {
    const pz = c.pitch(0.7), n = Math.max(3, Math.floor((L * 0.42) / pz)), x0 = -W / 2;
    for (let i = 0; i < n; i++) { const z = zb + L * 0.1 + i * pz; slabC({ ring: [[z, x0 + 0.02], [z + pz, x0 + 0.02], [z + pz * 0.5, x0 - 0.42 * g]], plane: 'plan', hw: T * 0.32, role: blade, group: 'serrations' }).forEach((e) => c.add('extrudes', e)); }
  }
  // the guard: a cross (both sides), a choil's single lug toward the edge, or none
  if (p.guard === 'cross') slabC({ ring: [[Lh, -2.3 * g], [Lh + gD, -2.1 * g], [Lh + gD, 2.1 * g], [Lh, 2.3 * g]], plane: 'plan', hw: 0.62 * g, chamfer: c.ch(1.2 * g), role: fut ? c.R.metal : c.R.accent, group: 'guard' }).forEach((e) => c.add('extrudes', e));
  if (p.guard === 'choil') slabC({ ring: [[Lh, -1.6 * g], [Lh + gD, -1.55 * g], [Lh + gD, 1.65 * g], [Lh - 0.1, 2.1 * g]], plane: 'plan', hw: 0.55 * g, chamfer: c.ch(1.1 * g), role: fut ? c.R.metal : c.R.accent, group: 'guard' }).forEach((e) => c.add('extrudes', e));
  if (fut && c.R.glow) c.add('extrudes', box({ lo: [-W / 2 + 0.2, -T / 2 - 0.12, zb - 0.02], hi: [W / 2 - 0.2, T / 2 + 0.12, zb + 0.25], role: c.R.glow, group: 'glow' }));
  // the handle: a palm swell, a finger notch by the guard, its butt rounding off (law 1); in the hand's response
  const hs = [0, 0.08, 0.22, 0.4, 0.55, 0.7, 0.82, 0.9, 1], half = (t) => hx * (0.92 + 0.14 * dmath.sin(Math.PI * Math.min(1, t * 1.15)) - (t > 0.78 && t < 0.95 ? 0.12 : 0)) * (t < 0.06 ? 0.92 : 1);
  const ring = [...hs.map((t) => [t * Lh, half(t) * (spec.ring ? 0.9 : 1)]), ...hs.slice().reverse().map((t) => [t * Lh, -half(t)])];
  const scales = p.handle === 'slab';
  if (scales) {
    // a full tang in the metal between two scales, pinned (law 3: the metal, the hand's own, the pins)
    slabC({ ring, plane: 'plan', hw: 0.3 * g, chamfer: 0.06, role: c.R.metal, group: 'tang' }).forEach((e) => c.add('extrudes', e));
    const inner = ring.map(([z, x]) => [Math.min(Lh - 0.3, Math.max(0.4, z)), x * 0.9]);
    for (const s of [1, -1]) slabC({ ring: inner, plane: 'plan', hw: (hy - 0.3 * g) / 2, chamfer: c.ch(hy * 0.6), role: c.R.grip, group: 'handle' }).forEach((e) => {
      const off = s * (0.3 * g + (hy - 0.3 * g) / 2);
      c.add('extrudes', { ...e, axisFrom: { ...e.axisFrom, y: r4(e.axisFrom.y + off) }, axisTo: { ...e.axisTo, y: r4(e.axisTo.y + off) } });
    });
    for (const zp of [Lh * 0.28, Lh * 0.68]) c.add('lathes', tube({ axis: 'y', z0: -hy - 0.03, z1: hy + 0.03, x: 0, y: zp, profile: [[0, 0.28], [1, 0.28]], samples: 10, role: c.R.accent, group: 'pins' }));
  } else {
    slabC({ ring, plane: 'plan', hw: hy, chamfer: c.ch(hy * 2) * 1.4, role: fut ? c.R.frame : c.R.grip, group: 'handle' }).forEach((e) => c.add('extrudes', e));
    // the ridges (or the cord's turns): bands proud of the handle, every pitch (law 5)
    const pz = c.pitch(p.handle === 'cord' ? 0.62 : 1.5), n = Math.max(3, Math.floor((Lh - 2.2) / pz)), role = p.handle === 'cord' || fut ? c.R.grip : c.R.frame;
    for (let i = 0; i < n; i++) {
      const z = 1.2 + i * pz, t = (z + pz * 0.25) / Lh, hxx = half(t) + 0.07, w = p.handle === 'cord' ? pz * 0.55 : 0.4;
      slabC({ ring: [[z, -hxx], [z + w, -hxx], [z + w, hxx], [z, hxx]], plane: 'plan', hw: hy + 0.07, chamfer: 0.08, role, group: 'handle-bands' }).forEach((e) => c.add('extrudes', e));
    }
    if (fut && c.R.glow) for (const s of [1, -1]) c.add('extrudes', box({ lo: [-0.25, s > 0 ? hy - 0.02 : -hy - 0.08, Lh * 0.25], hi: [0.25, s > 0 ? hy + 0.08 : -hy + 0.02, Lh * 0.75], role: c.R.glow, group: 'glow' }));
  }
  // the pommel: a butt cap with its lanyard hole, or the karambit's finger ring
  let back = -0.9;
  if (spec.ring) {
    const R = 1.75 * g * P.hand, r = 0.42 * g, cz = -R + 0.25, n = 20, path = [];
    for (let i = 0; i <= n; i++) { const a = (i / n) * 2 * Math.PI; path.push([r4(R * dmath.sin(a)), 0, r4(cz + R * dmath.cos(a))]); }
    c.add('sweeps', { group: 'ring', path, radius: r4(r), sides: 10, caps: false, ...(Array.isArray(c.R.metal) ? { material: c.R.metal[0], tint: c.R.metal[1] } : { material: c.R.metal }) });
    back = cz - R - r;
  } else {
    slabC({ ring: [[0, -hx * 0.95], [0, hx * 0.95], [-0.7, hx * 0.82], [-0.9, hx * 0.5], [-0.9, -hx * 0.5], [-0.7, -hx * 0.82]], plane: 'plan', hw: hy * 0.92, chamfer: c.ch(hy), role: c.R.accent, group: 'pommel' }).forEach((e) => c.add('extrudes', e));
    c.add('lathes', tube({ axis: 'y', z0: -hy * 0.92 - 0.03, z1: hy * 0.92 + 0.03, x: 0, y: -0.45, profile: [[0, 0.24], [1, 0.24]], samples: 10, role: c.R.bore, group: 'pommel' }));
  }
  return { back, fist: [0, 0, r4(Lh / 2)], gripL: Lh, guard: zb, tip: [st.tip[0], 0, st.tip[1]] };
}
