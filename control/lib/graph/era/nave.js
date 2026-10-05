/**
 * NAVE DRESSING — what the `gothic-nave` kit lays over its shell, read from its style card (style/gothic-nave.js):
 *   cutouts  ivy spilling from the string course, cobwebs under the capitals, banners hung in the bays on iron rods
 *            (painted cards, leaf-cards.js; alpha-tested on the World page, never walk colliders);
 *   shafts   from each lancet on a wall that faces the sun, a beam across the nave as translucent sheets, landing as a
 *            POOL — a light baked into the corners there (it never leaves as a light, and leaves no soot);
 *   blends   moss up the wall bases and in the gutter, grime at the floor's edges worn off the walking line: copies of
 *            the shell's faces wearing a second tile, faded in per corner (the World page's blend layer).
 * Every placement has a cause and a seeded die (integer hashes); a pure function of the plan.
 */
import { hash3, vnoise, walkLine } from './dirt.js';
import { P, r5, card as cardRaw, box } from './geom.js';
import './leaf-cards.js';
import './floor-tiles.js';

const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const at = (F, u, off, z) => [F.o[0] + F.U[0] * u + F.N[0] * off, F.o[1] + F.U[1] * u + F.N[1] * off, z];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** The hung things: ivy, cobwebs, banners (with their rods). Untextured iron carries a tint only. */
export function naveCutouts(plan, bays, columns) {
  const D = plan.kit.dress, st = plan.kit.string, out = [], iron = [];
  // a card is lit from the room's side: its normal turned to face out of the wall it hangs on
  const card = (o, base, along, up, w, h, key, tint, group, F) => {
    cardRaw(o, base, along, up, w, h, key, tint, group);
    const f = o[o.length - 1];
    if (f.normal[0] * F.N[0] + f.normal[1] * F.N[1] < 0) { f.normal = f.normal.map((v) => r5(-v) + 0); f.outNormal = f.normal; }
  };
  let prev = null;
  bays.filter((b) => !b.portal).forEach((b, i) => {
    const F = b.F, mid = (b.u0 + b.u1) / 2, h = hash3(i, b.k, 4001);
    const bareBefore = prev && prev.side === b.side && prev.k === b.k - 1 && prev.dress === 'bare';
    // banners in every `every`-th bay of a long wall, in front of the arcade: hung from a rod under the string course
    const banner = b.k % D.banners.every === 1 && b.F.len > 12;
    if (banner) {
      const Bn = D.banners, top = b.zS - Bn.drop, w = Bn.w, hh = Math.min(Bn.h, top - 0.9);
      card(out, at(F, mid, Bn.off, top - hh), F.U, [0, 0, 1], w / 0.6, hh, 'card:banner', Bn.tint, 'stage:banner', F);   // the cloth is the card's middle 0.6
      const rod = [];
      box(rod, P(at(F, mid - w / 2 - 0.12, Bn.off - 0.03, top - 0.02)).map((v, k) => Math.min(v, at(F, mid + w / 2 + 0.12, Bn.off + 0.03, top + 0.04)[k])), P(at(F, mid - w / 2 - 0.12, Bn.off - 0.03, top - 0.02)).map((v, k) => Math.max(v, at(F, mid + w / 2 + 0.12, Bn.off + 0.03, top + 0.04)[k])), { key: null, scale: 1, tint: Bn.rod, group: 'stage:iron' }, 1);
      for (const sg of [-1, 1]) box(rod, P(at(F, mid + sg * (w / 2 + 0.08), 0, top)).map((v, k) => Math.min(v, at(F, mid + sg * (w / 2 + 0.12), Bn.off, top + 0.05)[k])), P(at(F, mid + sg * (w / 2 + 0.08), 0, top)).map((v, k) => Math.max(v, at(F, mid + sg * (w / 2 + 0.12), Bn.off, top + 0.05)[k])), { key: null, scale: 1, tint: Bn.rod, group: 'stage:iron' }, 1);
      iron.push(...rod);
    }
    // ivy where the clerestory's water runs down: a curtain from the string course's top (never over a banner); a bare
    // bay never stands beside another
    const ivy = !banner && (h < D.ivy.share || bareBefore);
    prev = { side: b.side, k: b.k, dress: banner ? 'banner' : ivy ? 'ivy' : 'bare' };
    if (ivy) {
      const len = mix(D.ivy.len[0], D.ivy.len[1], hash3(i, 2, 4003)), w = mix(D.ivy.width[0], D.ivy.width[1], hash3(i, 3, 4005)), u = mid + (hash3(i, 4, 4007) - 0.5) * (b.u1 - b.u0 - w) * 0.8;
      const top = b.zS + st.h + 0.05;
      card(out, at(F, u, st.out + 0.03, top - len), F.U, [0, 0, 1], w, len, 'card:ivy', D.ivy.tint, 'stage:ivy', F);
    }
  });
  // cobwebs in the angle between a column and the wall, where nothing disturbs them: just above the plinth (anchored
  // low, spun upward) and at the arcade's springing (hung from above), on a share of the columns' sides
  const spring = bays.find((b) => b.zs) ? bays.find((b) => b.zs).zs : 4;
  columns.forEach((c, i) => {
    for (const sg of [-1, 1]) for (const [lvl, z, up] of [[0, plan.kit.plinth.h + 0.05, 1], [1, spring, -1]]) {
      if (hash3(i * 3 + lvl, sg + 2, 4011) > D.cobwebs.share || c.u + sg * 0.6 < 0 || c.u + sg * 0.6 > c.F.len) continue;
      const s = mix(D.cobwebs.size[0], D.cobwebs.size[1], hash3(i * 3 + lvl, sg + 5, 4013)), r = plan.kit.column.r + plan.kit.column.embed;
      const along = unit([c.F.U[0] * sg + c.F.N[0], c.F.U[1] * sg + c.F.N[1], 0]), corner = at(c.F, c.u + sg * r * 0.9, 0.02, z);
      // the web's anchor is its card's bottom-left, set in the angle; `up` −1 hangs it from above
      card(out, [corner[0] + along[0] * s / 2, corner[1] + along[1] * s / 2, corner[2]], along, [0, 0, up], s, s, 'card:cobweb', D.cobwebs.tint, 'stage:cobweb', c.F);
    }
  });
  return [...out, ...iron.map(({ texture, textureLit, uv, ...f }) => f)];
}

/** Shafts and pools from the sunward lancets. → { faces (translucent sheets), pools (bake-only lights) }. */
export function naveShafts(plan, bays) {
  const Sh = plan.kit.dress.shafts, out = [], pools = [], E = (Sh.elevation * Math.PI) / 180, A = (Sh.azimuth * Math.PI) / 180;
  // the way the light TRAVELS: `azimuth` from +x toward +y, `elevation` down from the horizontal
  const d = [Math.cos(E) * Math.cos(A), Math.cos(E) * Math.sin(A), -Math.sin(E)];
  // three sheets round the beam's axis (two crossed ones go edge-on to the eye and read as a line)
  const s1 = unit(cross(d, [0, 0, 1])), s2 = unit(cross(d, s1)), sheets = [0, 1, 2].map((k) => { const t = (k * Math.PI) / 3; return s1.map((v, i) => v * Math.cos(t) + s2[i] * Math.sin(t)); });
  for (const b of bays) {
    if (!b.lancet || b.F.N[0] * d[0] + b.F.N[1] * d[1] < 0.3) continue;
    const o = at(b.F, b.lancet.mid, 0, b.lancet.z), L = o[2] / -d[2], w = b.lancet.w;
    const hit = [o[0] + d[0] * L, o[1] + d[1] * L, 0];
    const p = (t, sd, k) => P([o[0] + d[0] * L * t + sd[0] * k, o[1] + d[1] * L * t + sd[1] * k, o[2] + d[2] * L * t + sd[2] * k]);
    for (const sd of sheets) for (const [t0, t1, a0, a1] of [[0, 0.35, Sh.alpha[1] * 0.6, Sh.alpha[1]], [0.35, 1, Sh.alpha[1], Sh.alpha[0]]]) {
      const w0 = (w / 2) * (1 + Sh.grow * t0), w1 = (w / 2) * (1 + Sh.grow * t1);
      // each half in two strips: densest a third of the way out, clear at the axis seam and the edge
      for (const sg of [-1, 1]) for (const [f0, f1, k0, k1] of [[0, 0.4, 0.45, 1], [0.4, 1, 1, 0]]) {
        out.push({ corners: [p(t0, sd, sg * w0 * f0), p(t0, sd, sg * w0 * f1), p(t1, sd, sg * w1 * f1), p(t1, sd, sg * w1 * f0)], normal: [0, 0, 1], water: true, fill: Sh.color, cornerAlpha: [a0 * k0, a0 * k1, a1 * k1, a1 * k0].map(r5), group: 'stage:shaft' });
      }
    }
    pools.push({ at: P([hit[0], hit[1], Sh.pool.lift]), n: [0, 0, 1], color: Sh.pool.color, intensity: Sh.pool.intensity, radius: Sh.pool.radius, fixture: 'pool' });
  }
  return { faces: out, pools };
}

/** The blends over the shell (baked with it, by the same lights): moss up the wall bases and in the gutter, grime at the floor's edges. */
export function naveBlends(plan, shell) {
  const D = plan.kit.dress, M = D.moss, G = D.grime, walk = walkLine(plan), out = [];
  const roomAt = (x, y) => plan.rooms.find((r) => x >= r.x0 - 0.8 && x <= r.x1 + 0.8 && y >= r.y0 - 0.8 && y <= r.y1 + 0.8) || plan.rooms[0];
  const toWalk = (c) => { let best = Infinity; for (let i = 0; i + 1 < walk.length; i++) { const [ax, ay] = walk[i], [bx, by] = walk[i + 1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-9, t = Math.max(0, Math.min(1, ((c[0] - ax) * dx + (c[1] - ay) * dy) / L2)); best = Math.min(best, Math.hypot(c[0] - ax - t * dx, c[1] - ay - t * dy)); } return best; };
  const patch = (c, s, p) => smooth(p[0], p[1], 0.7 * vnoise(c[0] * 0.45 + c[2] * 0.3, c[1] * 0.45 + c[2] * 0.2, s) + 0.3 * vnoise(c[0] * 1.6, c[1] * 1.6 + c[2], s + 1));
  for (const f of shell) {
    if (!f.tint || f.corners.length !== 4) continue;
    const n = f.normal, g = f.group;
    let alpha = null, key, scale, tint, uv;
    if (g === 'stage:gutter' || ((g === 'stage:wall' || g === 'stage:trim') && Math.abs(n[2]) < 0.5 && Math.min(...f.corners.map((c) => c[2])) < M.rise[1])) {
      // moss: thickest at the foot and in the gutter, climbing in tongues (the wander) and patches
      alpha = f.corners.map((c) => (g === 'stage:gutter' ? M.max : M.max * (1 - smooth(M.rise[0], M.rise[1], c[2] + (vnoise(c[0] * 0.9 + c[1] * 0.9, 1.5, 4101) - 0.5) * 2 * M.wander))) * mix(0.35, 1, patch(c, 4103, M.patch)));
      const t = Math.abs(n[2]) > 0.9 ? [1, 0, 0] : unit([-n[1], n[0], 0]);
      key = M.key; scale = M.scale; tint = M.tint; uv = f.corners.map((c) => [r5((c[0] * t[0] + c[1] * t[1]) / scale), r5((Math.abs(n[2]) > 0.9 ? c[1] : c[2]) / scale)]);
    } else if (g === 'stage:floor') {
      // grime: pooled where feet never go, near the walls; worn off along the walking line
      alpha = f.corners.map((c) => {
        const r = roomAt(c[0], c[1]), e = Math.min(c[0] - r.x0, r.x1 - c[0], c[1] - r.y0, r.y1 - c[1]) + (r.open.includes('-x') && c[0] - r.x0 < 3 ? 9 : 0) + (r.open.includes('+x') && r.x1 - c[0] < 3 ? 9 : 0) + (r.open.includes('-y') && c[1] - r.y0 < 3 ? 9 : 0) + (r.open.includes('+y') && r.y1 - c[1] < 3 ? 9 : 0);
        return G.max * (1 - smooth(G.edge[0], G.edge[1], e)) * mix(0.3, 1, patch(c, 4107, G.patch)) * smooth(G.walk * 0.4, G.walk, toWalk(c));
      });
      key = G.key; scale = G.scale; tint = G.tint; uv = f.corners.map((c) => [r5(c[0] / scale), r5(c[1] / scale)]);
    }
    if (!alpha || alpha.every((a) => a < 0.02)) continue;
    out.push({ corners: f.corners, normal: n, outNormal: n, texture: key, textureLit: true, uv, tint, cornerAlpha: alpha.map(r5), blend: true, group: g === 'stage:floor' ? 'stage:grime' : 'stage:moss' });
  }
  return out;
}

/**
 * Everything the dressing adds, in the shape the stage composes: `faces` baked with the shell, `blends(faces)` the
 * blend copies (baked too), `after` drawn unbaked (translucent sheets), `pools` bake-only lights, `cut(face)` shell
 * faces the dressing replaces, `shadowSkip(face)` faces that cast no sun shadow.
 */
export function naveDress(plan, geom) {
  const sh = naveShafts(plan, geom.bays);
  return { faces: naveCutouts(plan, geom.bays, geom.columns), blends: (faces) => naveBlends(plan, faces), after: sh.faces, pools: sh.pools, cut: () => false, shadowSkip: () => false };
}
