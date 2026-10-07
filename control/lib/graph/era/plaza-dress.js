/**
 * PLAZA DRESSING — what the `delfino-plaza` kit lays over its square, read from its style card (style/delfino-plaza.js):
 *   fountain   the set piece at the square's centre: a lathed basin, pedestal, bowl and finial in marble, water standing
 *              in basin and bowl and spilling from the bowl's lip (translucent sheets), a ring of granite round it;
 *   fronts     per house one dressing from a cycle, so neighbours never match: flower boxes under the windows (a box
 *              and a painted card), a striped awning over the door (a cutout the sun reads, so its shade is striped);
 *   laundry    lines strung across the corner where two closed sides meet, washing hung from them;
 *   rooftops   rows of skyline cards beyond the closed sides, paler and bluer row by row: the town goes on;
 *   blends     sand blown against the fronts and drifted into the corner, worn off at doors and along the way in; the
 *              ring round the basin dark where it splashes.
 * Every placement has a cause and a seeded die (integer hashes); a pure function of the plan.
 */
import { hash3, vnoise, walkLine } from './dirt.js';
import { P, r5, card as cardRaw, box, wallFrame, lathe } from './geom.js';
import { sunDir } from './sun.js';
import { plazaNight } from './plaza-night.js';
import { plazaPortico, plazaObelisks, plazaQuoins, plazaSkyline } from './piazza.js';
import './leaf-cards.js';
import './floor-tiles.js';

const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const at = (F, u, off, z) => [F.o[0] + F.U[0] * u + F.N[0] * off, F.o[1] + F.U[1] * u + F.N[1] * off, z];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const SIDES = ['-y', '+x', '+y', '-x'];

/** The square's centre (the fountain's place) and its closed sides. */
export function plazaSite(plan) {
  const r = plan.rooms[0];
  return { r, c: [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2], closed: SIDES.filter((s) => !r.open.includes(s)) };
}

/** A flat annulus (water, paving) at height z from r0 to r1, `alpha` per ring when it is water. */
function annulus(out, c, r0, r1, z, sides, face) {
  for (let k = 0; k < sides; k++) {
    const a0 = (2 * Math.PI * k) / sides, a1 = (2 * Math.PI * (k + 1)) / sides, p = (r, a) => P([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, z]);
    out.push({ corners: [p(r0, a0), p(r1, a0), p(r1, a1), p(r0, a1)], normal: [0, 0, 1], outNormal: [0, 0, 1], ...face(a0, a1, r0, r1) });
  }
}

/** The fountain: stone (lathed and ringed, baked like the shell) and water (self-lit translucent sheets, drawn after). */
export function plazaFountain(plan, { live = false } = {}) {
  const Fo = plan.kit.dress.fountain, { c } = plazaSite(plan), stone = [], water = [], S = Fo.sides, st = { ...Fo.stone };
  const inner = Fo.R - Fo.lip, B = Fo.bowl, br = B.R - 0.14;
  // one path round the solid: up the basin's outside, over its rim, down into it, across its floor, up the pedestal,
  // out under the bowl, over its lip, down into it, across, and up the finial to its knob
  lathe(stone, c, [[Fo.R, -0.02], [Fo.R + 0.08, 0.1], [Fo.R, 0.18], [Fo.R, Fo.rim - 0.08], [Fo.R + 0.06, Fo.rim], [inner, Fo.rim], [inner, 0.16], [Fo.pedestal + 0.14, 0.16], [Fo.pedestal, 0.36],
    [Fo.pedestal, B.z - B.depth - 0.25], [Fo.pedestal * 0.75, B.z - B.depth], [B.R * 0.7, B.z - 0.18], [B.R, B.z - 0.04], [B.R + 0.04, B.z], [br, B.z], [br, B.z - B.depth + 0.12], [0.18, B.z - B.depth + 0.12],
    [0.16, Fo.top - 0.55], [0.3, Fo.top - 0.38], [0.24, Fo.top - 0.18], [0.08, Fo.top - 0.04], [0, Fo.top]], S, st, 'stage:fountain');
  // the ring of granite round it, a hand's height proud of the setts, its texture running round
  const Rg = Fo.ring;
  annulus(stone, c, Fo.R, Fo.R + Rg.width, 0.012, S * 2, (a0, a1, r0, r1) => ({ texture: Rg.key, textureLit: true, uv: [[a0 * r0, r0], [a0 * r1, r1], [a1 * r1, r1], [a1 * r0, r0]].map((q) => q.map((v) => r5(v / Rg.scale))), tint: Rg.tint, group: 'stage:ring' }));
  // the water: standing in the basin and the bowl, and spilling from the bowl's lip as a falling sheet
  // standing water takes the aqua look when the card names one (materials/aqua-look.js): ripples, the sky in it at a
  // grazing angle, the basin's floor seen through it; the falling streams stay plain sheets
  // with live water (the recipe's `water`) standing water takes the aqua look (materials/aqua-look.js: ripples, the sky
  // in it at a grazing angle, the basin's floor seen through it) and the spill falls as jets (materials/jet.js) drawn
  // on the page; without it, the floor: plain sheets, and the spill painted as translucent strips
  const pool = (r0, r1, z) => annulus(water, c, r0, r1, z, S, () => ({ water: true, ...(live && Fo.look ? { liquid: Fo.look } : {}), fill: Fo.pool, cornerAlpha: [0.86, 0.86, 0.86, 0.86], group: 'stage:water' }));
  pool(Fo.pedestal + 0.02, inner, Fo.water); pool(0.18, br, B.z - 0.1);
  const cut = (f) => f.group === 'stage:floor' && f.corners.every((q) => Math.hypot(q[0] - c[0], q[1] - c[1]) < Fo.R - 0.05);
  if (live && Fo.jets) {
    // the bowl brims over its lip in sheets, one per stretch of lip, each pouring outward and falling to the basin
    const Jt = Fo.jets, jets = Array.from({ length: Jt.count }, (_, k) => {
      const a = (2 * Math.PI * (k + 0.5)) / Jt.count, o = [Math.cos(a), Math.sin(a)];
      return { id: `spill${k}`, shape: 'sheet', width: Jt.width, at: P([c[0] + o[0] * (B.R + 0.04), c[1] + o[1] * (B.R + 0.04), B.z - 0.01]), dir: [r5(o[0]), r5(o[1]), 0], flow: Jt.flow, fall: B.z - Fo.water + 0.2, mist: false, controls: false };
    });
    return { stone, water, cut, jets };
  }
  // the spill falls in streams from the lip (a whole sheet reads as glass), each arcing out and down to the pool
  const fall = [[B.R + 0.05, B.z - 0.02], [B.R + 0.22, B.z - 0.6], [B.R + 0.42, Fo.water]], Sp = Fo.spill;
  for (let i = 0; i + 1 < fall.length; i++) for (let k = 0; k < Sp.streams; k++) {
    const am = (2 * Math.PI * (k + 0.5)) / Sp.streams, half = (Sp.width / B.R) / 2, a0 = am - half, a1 = am + half, p = ([r, z], a) => P([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, z]);
    const al = [Sp.alpha[1], Sp.alpha[1] * 0.75, Sp.alpha[0]];
    water.push({ corners: [p(fall[i], a0), p(fall[i], a1), p(fall[i + 1], a1), p(fall[i + 1], a0)], normal: [0, 0, 1], water: true, fill: Sp.color, cornerAlpha: [al[i], al[i], al[i + 1], al[i + 1]].map(r5), group: 'stage:water' });
  }
  return { stone, water, cut, jets: [] };
}

/** The fronts' dressing (flower boxes, awnings), the corner's laundry and the far rooftops. */
export function plazaCutouts(plan, houses) {
  const D = plan.kit.dress, out = [], iron = [], far = [], porticoO = D.portico ? wallFrame(plazaSite(plan).r, D.portico.side).o.join() : null;
  const card = (base, along, up, w, h, key, tint, group, F) => {
    cardRaw(out, base, along, up, w, h, key, tint, group);
    const f = out[out.length - 1];
    if (F && f.normal[0] * F.N[0] + f.normal[1] * F.N[1] + f.normal[2] * 0 < 0) { f.normal = f.normal.map((v) => r5(-v) + 0); f.outNormal = f.normal; }
  };
  const block = (F, u0, u1, off0, off1, z0, z1, tint, group) => {
    const a = at(F, u0, off0, z0), b = at(F, u1, off1, z1), raw = [];
    box(raw, [0, 1, 2].map((k) => Math.min(a[k], b[k])), [0, 1, 2].map((k) => Math.max(a[k], b[k])), { key: null, scale: 1, tint, group }, 1);
    for (const { texture, textureLit, uv, ...f } of raw) iron.push(f);
  };
  // each wall's houses take the dressings in a cycle, from a seeded start: neighbours never match
  const start = new Map();
  houses.forEach((h) => {
    const sideKey = `${h.F.o.join(',')}`;
    if (!start.has(sideKey)) start.set(sideKey, Math.floor(hash3(start.size, 3, 5101) * D.dressings.length));
    // under a portico a door wants no awning: those houses take flowers and plain, in turn
    const cycle = sideKey === porticoO ? D.dressings.filter((d) => !d.includes('awning')) : D.dressings;
    const dress = cycle[(start.get(sideKey) + h.k) % cycle.length];
    h.dress = dress;
    if (dress.includes('flowers')) for (const w of h.windows) {
      const Fl = D.flowers, z = w.sill;
      block(h.F, w.c - w.hw - 0.08, w.c + w.hw + 0.08, 0.02, Fl.box[0], z, z + Fl.box[1], Fl.boxTint, 'stage:planter');
      card(at(h.F, w.c, Fl.box[0] * 0.55, z + 0.06), h.F.U, [0, 0, 1], 2 * w.hw + 0.5, Fl.h, 'card:flowers', Fl.tint, 'stage:flowers', h.F);
    }
    if (dress.includes('awning')) {
      const A = D.awning, zt = h.door.top + A.over, hem = at(h.F, h.door.mid, A.out, zt - A.drop), top = at(h.F, h.door.mid, 0.02, zt);
      const up = unit([top[0] - hem[0], top[1] - hem[1], top[2] - hem[2]]), len = Math.hypot(A.out, A.drop);
      // the hem sits a fifth of the way up the painted card: start the card that far below the hem
      card([hem[0] - up[0] * len * 0.25, hem[1] - up[1] * len * 0.25, hem[2] - up[2] * len * 0.25], h.F.U, up, 2 * h.door.dw + 0.7, len * 1.25, 'card:awning', A.tint, 'stage:awning', h.F);
      for (const sg of [-1, 1]) block(h.F, h.door.mid + sg * (h.door.dw + 0.33) - 0.025, h.door.mid + sg * (h.door.dw + 0.33) + 0.025, 0, A.out, zt - A.drop - 0.03, zt - A.drop + 0.02, [0.22, 0.2, 0.2], 'stage:iron');
    }
  });
  // laundry across the corner where two closed sides meet
  const { r, closed } = plazaSite(plan), L = D.laundry;
  for (let i = 0; i < 4; i++) {
    const s1 = SIDES[i], s2 = SIDES[(i + 1) % 4]; if (!closed.includes(s1) || !closed.includes(s2)) continue;
    const F1 = wallFrame(r, s1), F2 = wallFrame(r, s2);   // F1 ends where F2 starts
    for (let l = 0; l < L.lines; l++) {
      const z = mix(L.z[0], L.z[1], l / Math.max(1, L.lines - 1)), a = at(F1, F1.len - 3.2 - 1.6 * l, 0.15, z), b = at(F2, 3.4 + 1.4 * l, 0.15, z);
      const along = unit([b[0] - a[0], b[1] - a[1], 0]), w = Math.hypot(b[0] - a[0], b[1] - a[1]);
      card([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z - L.drop * 1.25], along, [0, 0, 1], w, L.drop * 1.3, 'card:laundry', L.tint, 'stage:laundry', { N: unit([r.x0 + r.x1 - 2 * a[0], r.y0 + r.y1 - 2 * a[1], 0]) });
    }
  }
  // the rooftops beyond the closed sides, row by row further and paler
  // the rows are not baked: aerial perspective comes after the light. A row is lit or shaded by the way it faces, then
  // carried toward the reference's horizon colour row by row (over the card's near-neutral paint)
  const Rt = D.rooftops, horizon = plan.ref.air.dome.horizon.map((v) => v / 255), PAINT = [236 / 255, 234 / 255, 230 / 255], WARM = [1, 0.93, 0.82];
  const key = plan.ref.light.key, E = (key.elevation * Math.PI) / 180, Az = ((key.azimuth ?? 225) * Math.PI) / 180, toSun = [Math.cos(E) * Math.cos(Az), Math.cos(E) * Math.sin(Az)];
  const hexOf = (c) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v * 255))).toString(16).padStart(2, '0')).join('')}`;
  for (const s of closed) {
    const F = wallFrame(r, s), light = (F.N[0] * toSun[0] + F.N[1] * toSun[1] > 0 ? 1 : 0.68) * (plan.night ? plan.night.far : 1);
    for (let row = 0; row < Rt.rows; row++) {
      const t = row / Math.max(1, Rt.rows - 1), dist = Rt.first + row * Rt.gap, hgt = mix(Rt.height[0], Rt.height[1], t), fade = mix(Rt.fade[0], Rt.fade[1], t);
      const fill = hexOf(WARM.map((w, k) => mix(w * light, horizon[k] / PAINT[k], fade)));
      for (let u = -14 - row * 6, i = 0; u < F.len + 14 + row * 6; u += Rt.card * 0.8, i++) {
        const base = at(F, u + Rt.card * 0.4 * hash3(i, row, 5103), -dist, -1);
        cardRaw(far, base, F.U, [0, 0, 1], Rt.card, hgt * (0.85 + 0.3 * hash3(i, row, 5107)), 'card:roofs', [1, 1, 1], 'stage:far');
        const { tint, ...f } = far.pop(); f.normal = F.N.map((v) => r5(v) + 0); f.outNormal = f.normal; f.fill = fill; far.push(f);
      }
    }
  }
  return [...out, ...iron, ...far];
}

/** The blends: sand against the fronts and into the corner, worn off at doors and the way in; the splash round the basin. */
export function plazaBlends(plan, faces, houses) {
  const D = plan.kit.dress, Sd = D.sand, Sp = D.splash, Fo = D.fountain, { r, c, closed } = plazaSite(plan), walk = walkLine(plan), out = [];
  const toWalk = (q) => { let best = Infinity; for (let i = 0; i + 1 < walk.length; i++) { const [ax, ay] = walk[i], [bx, by] = walk[i + 1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-9, t = Math.max(0, Math.min(1, ((q[0] - ax) * dx + (q[1] - ay) * dy) / L2)); best = Math.min(best, Math.hypot(q[0] - ax - t * dx, q[1] - ay - t * dy)); } return best; };
  const wallD = (q) => closed.map((s) => (s === '-x' ? q[0] - r.x0 : s === '+x' ? r.x1 - q[0] : s === '-y' ? q[1] - r.y0 : r.y1 - q[1]));
  const doors = houses.map((h) => at(h.F, h.door.mid, 0, 0));
  const patch = (q, s, p) => smooth(p[0], p[1], 0.65 * vnoise(q[0] * 0.35, q[1] * 0.35, s) + 0.35 * vnoise(q[0] * 1.3, q[1] * 1.3, s + 1));
  for (const f of faces) {
    if (!f.tint || f.corners.length !== 4) continue;
    if (f.group === 'stage:floor' || f.group === 'stage:step') {
      const alpha = f.corners.map((q) => {
        const ds = wallD(q).sort((x, y) => x - y), d = ds[0], second = ds[1] ?? Infinity;
        const drift = 1 - smooth(0, Sd.reach + Sd.corner * (1 - smooth(0, Sd.reach + Sd.corner, second)), d);   // deeper where two walls meet
        const door = doors.reduce((m, p) => Math.min(m, smooth(Sd.door * 0.3, Sd.door, Math.hypot(q[0] - p[0], q[1] - p[1]))), 1);
        return Sd.max * drift * mix(0.35, 1, patch(q, 5201, Sd.patch)) * door * smooth(Sd.walk * 0.4, Sd.walk, toWalk(q));
      });
      if (alpha.every((a) => a < 0.02)) continue;
      out.push({ corners: f.corners, normal: f.normal, outNormal: f.normal, texture: Sd.key, textureLit: true, uv: f.corners.map((q) => [r5(q[0] / Sd.scale), r5(q[1] / Sd.scale)]), tint: Sd.tint, cornerAlpha: alpha.map(r5), blend: true, group: 'stage:sand' });
    } else if (f.group === 'stage:ring') {
      const alpha = f.corners.map((q) => Sp.max * (1 - smooth(0, Sp.width, Math.hypot(q[0] - c[0], q[1] - c[1]) - Fo.R)) * mix(0.5, 1, patch(q, 5203, [0.25, 0.6])));
      out.push({ corners: f.corners, normal: f.normal, outNormal: f.normal, texture: Sp.key, textureLit: true, uv: f.corners.map((q) => [r5(q[0] / Sp.scale), r5(q[1] / Sp.scale)]), tint: Sp.tint, cornerAlpha: alpha.map(r5), blend: true, group: 'stage:splash' });
    }
  }
  return out;
}

/** Everything the plaza's dressing adds, in the shape the stage composes (see nave.js `naveDress`). */
export function plazaDress(plan, geom) {
  const D = plan.kit.dress, site = plazaSite(plan), fo = plazaFountain(plan, { live: !!geom.water }), houses = geom.houses || [];
  const key = plan.ref.light.key, toSun = sunDir(key.elevation, key.azimuth ?? 225);
  const portico = D.portico ? plazaPortico(plan, site) : null;
  // at night (`time: 'night'`): lanterns, the basin's glow, lit windows (plaza-night.js)
  const night = plan.night ? plazaNight(plan, houses, portico, site) : null;
  return {
    faces: [...fo.stone, ...plazaCutouts(plan, houses), ...(portico ? portico.faces : []), ...(D.obelisks ? plazaObelisks(plan, site, geom.ends).faces : []),
      ...(D.quoins ? plazaQuoins(plan, houses, portico) : []), ...(D.skyline ? plazaSkyline(plan, site, toSun) : []), ...(night ? night.faces : [])],
    blends: (faces) => plazaBlends(plan, faces, houses),
    after: fo.water,
    pools: [],
    // the setts under the basin, and the paving and kerb the portico's stylobate and stair stand on
    cut: (f) => fo.cut(f) || (!!portico && (f.group === 'stage:floor' || f.group === 'stage:step') && portico.under(f)),
    // the far rows and the skyline stand beyond the houses: they shade nothing in the square
    shadowSkip: (f) => f.group === 'stage:far' || f.group === 'stage:skyline',
    clouds: D.clouds ? (night ? { ...D.clouds, ...plan.night.clouds } : D.clouds) : null,
    ...(night ? { night } : {}),
    jets: fo.jets,
  };
}
