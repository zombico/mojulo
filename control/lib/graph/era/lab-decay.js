/**
 * The LAB GONE DERELICT (`decay`, decay.js): what each event does to the lab's dressing, by cause.
 *
 *   abandon   the records change before they are built: chairs tipped and shoved, monitors off their benches and
 *             face down on the floor, the cart rolled away and over, the extinguisher down, papers strewn (more of
 *             them against the walls, where the draughts left them); glassware broken
 *   blackout  screens dead but one or two on their batteries; red emergency lamps on the columns, baked red
 *   collapse  a debris pile under the hole (pooled concrete, deck sheets lying in it, the bay's fallen troffer)
 *   leak      a puddle under the burst pipe (the water look with `water`), a thin stream into it (a jet) with
 *             `water`; the streaks down the wall are the dirt's (dirt.js `leaks`)
 *   breach    the spill round the tank, spread toward the side it split, and its shards
 *
 * Dice are hash3 on the decay's seed; nothing here is random.
 */
import { add, mul, P, r5, hexRgb, box, onWall, wallFrame } from './geom.js';
import { hash3 } from './dirt.js';
import { rockPool, rockRepeats, expandRepeats } from '../polygonizer/rock-pool.js';
import { troffer, turnFaces } from './lab.js';

const Z = [0, 0, 1];

/** Abandonment, on the records: returns new records (and new ones: fallen monitors, strewn sheets). */
export function abandonThings(things, r, ri, D, Dz) {
  const a = Dz.k.abandon, b = Dz.k.blackout, Ab = D.decay.abandon, S = Dz.seed * 97 + ri, out = [], h = (i, k) => hash3(S, i, k);
  const clamp = (p) => [Math.min(r.x1 - 0.5, Math.max(r.x0 + 0.5, p[0])), Math.min(r.y1 - 0.5, Math.max(r.y0 + 0.5, p[1])), 0];
  things.forEach((t, i) => {
    if (t.kind === 'chair' && a > 0) {
      const d = (0.3 + 1.4 * h(i, 9001)) * a, th = 2 * Math.PI * h(i, 9003), tipped = h(i, 9005) < Ab.tip * a;
      const tip = tipped ? (h(i, 9007) < 0.5 ? { axis: [1, 0, 0], a: -Math.PI / 2 } : { axis: [0, 1, 0], a: h(i, 9009) < 0.5 ? Math.PI / 2 : -Math.PI / 2 }) : null;
      out.push({ ...t, at: clamp([t.at[0] + Math.cos(th) * d, t.at[1] + Math.sin(th) * d, 0]), yaw: t.yaw + (h(i, 9011) - 0.5) * 3 * a, ...(tip ? { tip } : {}) });
      return;
    }
    if (t.kind === 'bench') {
      // monitors off the bench, face down on the floor before it; screens dead in the blackout, but for a few on
      // their batteries; some glassware gone (broken)
      const fx = Math.cos(t.yaw + Math.PI / 2), fy = Math.sin(t.yaw + Math.PI / 2), ux = Math.cos(t.yaw), uy = Math.sin(t.yaw);
      const items = [];
      t.items.forEach((it, j) => {
        if (it.kind === 'monitor' && h(i * 7 + j, 9021) < Ab.monitors * a) {
          const off = D.bench.depth / 2 + 0.3 + 0.5 * h(i * 7 + j, 9023);
          out.push({ kind: 'screen', at: clamp([t.at[0] + fx * off + ux * it.x, t.at[1] + fy * off + uy * it.x, 0]), yaw: t.yaw + (h(i * 7 + j, 9025) - 0.5) * 1.6, tip: { axis: [1, 0, 0], a: -Math.PI / 2 }, on: false, seed: t.seed });
          return;
        }
        if (it.kind === 'monitor') { items.push({ ...it, on: !(b > 0 && h(i * 7 + j, 9027) < 0.9 * b) }); return; }
        if (it.kind === 'glassware' && a > 0) { items.push({ ...it, flasks: it.flasks.filter((_, q) => h(i * 13 + q, 9029) > 0.6 * a) }); return; }
        items.push(it);
      });
      out.push({ ...t, items });
      return;
    }
    if (t.kind === 'cart' && a > 0) {
      const th = 2 * Math.PI * h(i, 9031), d = Ab.roll * a;
      out.push({ ...t, at: clamp([t.at[0] + Math.cos(th) * d, t.at[1] + Math.sin(th) * d, 0]), yaw: t.yaw + 2 * a, ...(a > 0.5 ? { tip: { axis: [1, 0, 0], a: Math.PI / 2 } } : {}) });
      return;
    }
    if (t.kind === 'extinguisher' && a > 0.4) {
      // off its bracket: on the floor at the wall's foot, rolled a little way out
      out.push({ ...t, floor: true, tip: { axis: [0, 1, 0], a: Math.PI / 2 }, at: clamp([t.at[0] + Math.cos(t.yaw + Math.PI / 2) * 0.6, t.at[1] + Math.sin(t.yaw + Math.PI / 2) * 0.6, 0]), yaw: t.yaw + 1.1 });
      return;
    }
    if (t.kind === 'rack' && b > 0) { out.push({ ...t, led: D.decay.abandon.ledDead }); return; }
    out.push(t);
  });
  // papers strewn: a share by the benches, the rest blown against the walls
  const n = Math.round(Ab.papers * a);
  for (let i = 0; i < n; i++) {
    const wallward = h(i, 9041) < 0.55, side = Math.floor(h(i, 9043) * 4), u = h(i, 9045);
    const p = wallward
      ? [side === 0 ? r.x0 + 0.25 + 0.4 * h(i, 9047) : side === 1 ? r.x1 - 0.25 - 0.4 * h(i, 9047) : r.x0 + (r.x1 - r.x0) * u,
        side === 2 ? r.y0 + 0.25 + 0.4 * h(i, 9047) : side === 3 ? r.y1 - 0.25 - 0.4 * h(i, 9047) : r.y0 + (r.y1 - r.y0) * u, 0]
      : [r.x0 + 1 + (r.x1 - r.x0 - 2) * h(i, 9049), r.y0 + 1 + (r.y1 - r.y0 - 2) * u, 0];
    out.push({ kind: 'sheet', at: clamp(p), yaw: 2 * Math.PI * h(i, 9051), seed: i });
  }
  return out;
}

/** Red emergency lamps on every `every`th column line of the lab's walls (not at the corners or the portal). */
export function emergencyLamps(geomBays, D, Dz, L) {
  const E = D.decay.emergency, faces = [], lights = [], cw = L.column, seen = new Set();
  const byWall = new Map(); for (const b of geomBays) { const k = b.F.o.join(); (byWall.get(k) || byWall.set(k, []).get(k)).push(b); }
  for (const bays of byWall.values()) {
    bays.sort((p, q) => p.u0 - q.u0);
    bays.forEach((b, i) => {
      if (i === 0 || i % E.every || b.portal || bays[i - 1].portal) return;
      const F = b.F, u = b.u0, key = `${F.o.join()}:${u}`; if (seen.has(key)) return; seen.add(key);
      const out = cw.out + 0.04, p = onWall(F, u, out, E.z), N = F.N;
      box(faces, add(p, [-0.09, -0.09, -0.06]), add(p, [0.09, 0.09, 0.08]), { key: null, scale: 1, tint: [0.2, 0.2, 0.22], group: 'stage:fixture' }, 1);
      const q = onWall(F, u, out + 0.091, E.z), s = (du, dz) => P(add(onWall(F, u + du, out + 0.091, E.z + dz), [0, 0, 0]));
      faces.push({ corners: [s(-0.07, -0.04), s(0.07, -0.04), s(0.07, 0.06), s(-0.07, 0.06)], normal: N, outNormal: N, fill: E.color, group: 'stage:lamp', emissive: hexRgb(E.color), emissiveStrength: 3, glow: `0 0 12px 5px ${E.color}` });
      lights.push({ at: P(add(q, mul(N, 0.3))), n: N, color: E.color, intensity: r5(E.intensity * Dz.k.blackout), radius: E.radius, fixture: 'emergency' });
    });
  }
  return { faces, lights };
}

/** The collapse's debris pile under the hole: pooled concrete heaped toward the middle, deck sheets lying in it, the
 *  bay's fallen troffers on it upside down. */
export function debrisPile(hole, D, Dz, kit, surfDeck) {
  const Db = D.decay.debris, k = Dz.k.collapse, [x0, y0, x1, y1] = hole.rect, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) / 2 + 0.6, ry = (y1 - y0) / 2 + 0.6;
  const S = Dz.seed * 131, h = (i, s) => hash3(S, i, s), items = [];
  const n = Math.round(Db.rocks * (x1 - x0) * (y1 - y0) * k);
  const mound = (x, y) => Math.max(0, 1 - ((x - cx) / rx) ** 2 - ((y - cy) / ry) ** 2);
  for (let i = 0; i < n; i++) {
    const x = cx + (h(i, 9101) - 0.5) * 2 * rx, y = cy + (h(i, 9103) - 0.5) * 2 * ry, m = mound(x, y); if (m <= 0) continue;
    items.push({ x: r5(x), y: r5(y), z0: r5(Db.heap * m * k * (0.4 + 0.6 * h(i, 9105))), size: r5(Db.size[0] + (Db.size[1] - Db.size[0]) * h(i, 9107) ** 2) });
  }
  const pool = rockPool({ rock: 'basalt', variants: 6, detail: 0, tone: Db.tone, seed: 'lab-debris', group: 'stage:debris' });
  const tint = hexRgb(Db.tone);
  const faces = expandRepeats(rockRepeats(pool, items, { sink: 0.2, group: 'stage:debris' }))
    .map((f) => ({ corners: f.corners.map(P), normal: f.outNormal, outNormal: f.outNormal, tint, group: 'stage:debris', doubleSided: true }));
  // deck sheets lying on the heap, tilted
  for (let i = 0; i < Math.round(Db.sheets * k); i++) {
    const x = cx + (h(i, 9111) - 0.5) * 1.6 * rx, y = cy + (h(i, 9113) - 0.5) * 1.6 * ry, z = 0.05 + Db.heap * mound(x, y) * k, a = 2 * Math.PI * h(i, 9115), t = 0.15 + 0.4 * h(i, 9117);
    const w = 0.8 + 0.6 * h(i, 9119), l = 1 + 0.8 * h(i, 9121), ca = Math.cos(a), sa = Math.sin(a);
    const pt = (u, v) => [x + u * ca - v * sa, y + u * sa + v * ca, z + v * Math.sin(t)];
    const nn = [sa * Math.sin(t), -ca * Math.sin(t), Math.cos(t)].map(r5);
    faces.push({ corners: [pt(-w / 2, -l / 2), pt(w / 2, -l / 2), pt(w / 2, l / 2), pt(-w / 2, l / 2)].map(P), normal: nn, outNormal: nn, texture: surfDeck.key, textureLit: true, uv: [[0, 0], [w / surfDeck.scale, 0], [w / surfDeck.scale, l / surfDeck.scale], [0, l / surfDeck.scale]].map((q) => q.map(r5)), tint: surfDeck.tint, group: 'stage:debris', doubleSided: true });
  }
  // the fallen troffers: on their backs on the heap, turned
  for (const [i, fl] of hole.fallen.entries()) {
    const raw = []; troffer(raw, [0, 0, 0], fl.ax, kit.lab.troffer, null, { housing: { key: null, scale: 1, tint: kit.tint.housing, group: 'stage:housing' }, chain: null }, true);
    const flipped = turnFaces(raw, [0, 0, 0], fl.ax ? [0, 1, 0] : [1, 0, 0], Math.PI * 0.85);
    const yaw = (h(i, 9131) - 0.5) * 1.4, c = Math.cos(yaw), s = Math.sin(yaw), z = 0.25 + 0.25 * mound(fl.at[0], fl.at[1]) * k;
    faces.push(...flipped.map((f) => ({ ...f, corners: f.corners.map((p) => P([fl.at[0] + p[0] * c - p[1] * s + 0.4, fl.at[1] + p[0] * s + p[1] * c, p[2] + z])), normal: [f.normal[0] * c - f.normal[1] * s, f.normal[0] * s + f.normal[1] * c, f.normal[2]].map(r5) })));
  }
  return { faces, centre: [cx, cy], reach: Math.max(rx, ry) };
}

/** An irregular puddle: a fan of `n` wedges round `c`, radius r(θ) from `radiusAt`, its edge fading. */
export function puddle(c, z, radiusAt, n, face) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a0 = (2 * Math.PI * i) / n, a1 = (2 * Math.PI * (i + 1)) / n, r0 = radiusAt(a0), r1 = radiusAt(a1);
    const p = (r, a) => [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, z];
    out.push({ corners: [P([c[0], c[1], z]), P(p(r0 * 0.55, a0)), P(p(r1 * 0.55, a1)), P([c[0], c[1], z])], normal: Z, cornerAlpha: [0.85, 0.85, 0.85, 0.85], ...face });
    out.push({ corners: [P(p(r0 * 0.55, a0)), P(p(r0, a0)), P(p(r1, a1)), P(p(r1 * 0.55, a1))], normal: Z, cornerAlpha: [0.85, 0, 0, 0.85], ...face });
  }
  return out;
}

/** The leak: on the picked wall, mid-bay; the source at the service band, a puddle at the foot. → { source, n, faces,
 *  jet? } */
export function leakAt(r, geomBays, D, Dz, L, pick, live) {
  const Lk = D.decay.leak, k = Dz.k.leak, F = wallFrame(r, pick.wall), bays = geomBays.filter((b) => b.F.o.join() === F.o.join() && !b.portal);
  const u0 = pick.along * F.len, bay = bays.find((b) => u0 >= b.u0 && u0 <= b.u1) || bays[0];
  const u = (bay.u0 + bay.u1) / 2 + (bay.u1 - bay.u0) * 0.18, zs = L.field.top + L.service.h * 0.5;
  const source = onWall(F, u, L.service.out, zs), foot = onWall(F, u, 0.55, 0), S = Dz.seed * 7 + 3;
  const R = (a) => Lk.puddle * k * (0.75 + 0.45 * hash3(S, Math.round(a * 4), 9201)) * (1 + 0.35 * Math.cos(a - Math.atan2(F.N[1], F.N[0])));
  const face = { water: true, fill: Lk.color, group: 'stage:water', ...(live ? { liquid: Lk.look } : {}) };
  const faces = puddle([foot[0], foot[1]], 0.015, R, 14, face);
  const jet = live ? { id: 'leak', shape: undefined, at: P(source), dir: [0, 0, -1], radius: 0.006, flow: 0.02 + 0.03 * k, fall: zs - 0.02, mist: false, controls: false } : null;
  return { source: P(source), n: F.N, width: Lk.streak, faces, ...(jet ? { jet } : {}) };
}

/** The breach's spill round the tank, spread toward the side it split; shards of glass strewn the same way. */
export function spillAt(c, D, Dz, pick, live) {
  const T = D.tank, Br = D.decay.breach, k = Dz.k.breach, S = Dz.seed * 11 + 5, toward = pick.toward;
  const R = (a) => T.dais[0].r + Br.spill * k * (0.3 + 0.7 * Math.max(0, Math.cos(a - toward)) ** 1.5) * (0.8 + 0.35 * hash3(S, Math.round(a * 5), 9301));
  const face = { water: true, fill: Br.color, group: 'stage:water', ...(live ? { liquid: Br.look } : {}) };
  const faces = puddle(c, 0.016, R, 24, face);
  const shards = [];
  for (let i = 0; i < Math.round(Br.shards * k); i++) {
    const a = toward + (hash3(S, i, 9311) - 0.5) * 2.6, d = T.dais[0].r * (0.3 + 1.4 * hash3(S, i, 9313)), s = 0.04 + 0.12 * hash3(S, i, 9315) ** 2, sp = 2 * Math.PI * hash3(S, i, 9317);
    const x = c[0] + Math.cos(a) * d, y = c[1] + Math.sin(a) * d, z = d < T.dais[1].r ? T.dais[0].h + T.dais[1].h + 0.004 : d < T.dais[0].r ? T.dais[0].h + 0.004 : 0.018;
    const p = (q) => [x + Math.cos(sp + q) * s, y + Math.sin(sp + q) * s, z];
    shards.push({ corners: [P(p(0)), P(p(2.2)), P(p(4.1)), P(p(4.1))], normal: Z, outNormal: Z, tint: hexRgb(T.glass).map((v) => r5(v * 1.1)), group: 'stage:shards' });
  }
  return { faces, shards };
}
