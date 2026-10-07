/**
 * CRYPT DRESSING — what the `gothic-stone` kit lays over its rooms, read from its style card (style/crypt.js):
 *   tomb     the set piece: a tomb chest on a stepped dais in the last room of the walk, set back from the way in;
 *   candles  a cluster at each dais corner: wax, a flame, a small warm light baked like a torch (and kept as a light);
 *   cobwebs  painted cards in the angle of a pilaster and the wall, above the plinth and under the cornice, where
 *            nothing disturbs them; no two neighbouring pilasters dress alike;
 *   blends   moss up the wall bases and in the gutter, grime at the floor's edges worn off the walking line (blendsByCause).
 * Every placement has a cause and a seeded die (integer hashes); a pure function of the plan.
 */
import { hash3, walkLine } from './dirt.js';
import { P, r5, box, card as cardRaw, hexRgb, lathe } from './geom.js';
import { blendsByCause } from './nave.js';
import { cornerThings, skull, obox } from './props.js';
import { tileFamilyOf } from './tile-specs.js';
import { panel, wallBox } from './geom.js';
import { roundArch, archUnder, archRing } from './arches.js';
import './leaf-cards.js';

const mix = (a, b, t) => a + (b - a) * t;
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const at = (F, u, off, z) => [F.o[0] + F.U[0] * u + F.N[0] * off, F.o[1] + F.U[1] * u + F.N[1] * off, z];

/** The last room of the walk, and where the way comes into it. */
function lastRoom(plan) {
  const walk = walkLine(plan), byId = new Map(plan.rooms.map((r) => [r.id, r]));
  const last = plan.links.length ? byId.get(plan.links[plan.links.length - 1].to) : plan.rooms[0];
  return { r: last, entry: walk.length > 2 ? walk[walk.length - 2] : walk[0] };
}

/** The tomb: dais, chest and lid, set back from the way in along the room's long axis. → { faces, corners }. */
export function cryptTomb(plan) {
  const T = plan.kit.dress.tomb, { r, entry } = lastRoom(plan), out = [];
  const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2, alongX = r.x1 - r.x0 >= r.y1 - r.y0;
  // set back: from the centre, away from the way in, as far as the dais and a walkway round it allow
  const half = alongX ? (r.x1 - r.x0) / 2 : (r.y1 - r.y0) / 2, dl = (alongX ? T.dais.w : T.dais.d) / 2 + 1.2;
  const away = Math.sign(alongX ? cx - entry[0] : cy - entry[1]) || 1, shift = Math.max(0, Math.min(half * 0.45, half - dl));
  const [tx, ty] = alongX ? [cx + away * shift, cy] : [cx, cy + away * shift];
  const [dw, dd] = alongX ? [T.dais.w, T.dais.d] : [T.dais.d, T.dais.w], [cw, cd] = alongX ? [T.chest.w, T.chest.d] : [T.chest.d, T.chest.w];
  const stone = { key: T.stone.key, scale: T.stone.scale, tint: T.stone.tint, group: 'stage:focus' };
  let z = 0;
  for (let s = 0; s < T.dais.steps; s++) {
    const k = s * T.dais.inset;
    box(out, [tx - dw / 2 + k, ty - dd / 2 + k, z], [tx + dw / 2 - k, ty + dd / 2 - k, z + T.dais.step], { ...stone, group: 'stage:focus-dais' }, 0.6, ['-z']);
    z += T.dais.step;
  }
  // the set piece itself, by its kind (art direction picks one): a closed tomb, an EMPTY one (its lid off and leaning,
  // the dark inside showing), an altar, or a well
  const kind = T.kind || 'tomb';
  if (kind === 'altar') {
    for (const sg of [-1, 1]) { const ox = alongX ? sg * cw * 0.32 : 0, oy = alongX ? 0 : sg * cd * 0.32; box(out, [tx + ox - (alongX ? 0.2 : cw / 2 - 0.1), ty + oy - (alongX ? cd / 2 - 0.1 : 0.2), z], [tx + ox + (alongX ? 0.2 : cw / 2 - 0.1), ty + oy + (alongX ? cd / 2 - 0.1 : 0.2), z + T.chest.h - 0.14], stone, 0.5, ['-z']); }
    box(out, [tx - cw / 2 - 0.12, ty - cd / 2 - 0.12, z + T.chest.h - 0.14], [tx + cw / 2 + 0.12, ty + cd / 2 + 0.12, z + T.chest.h + 0.04], { ...stone, group: 'stage:focus-lid' }, 0.5);
  } else if (kind === 'well') {
    const rw = Math.min(cw, cd) * 0.75 + 0.2, wall = rw - 0.2;
    lathe(out, [tx, ty], [[rw, z], [rw, z + 0.82], [wall, z + 0.82], [wall, z + 0.12]].map(([a, b]) => [a, b]), 16, stone, 'stage:focus');
    out.push({ corners: [...Array(16).keys()].map((k) => P([tx + wall * Math.cos((k / 16) * 2 * Math.PI), ty + wall * Math.sin((k / 16) * 2 * Math.PI), z + 0.12])), normal: [0, 0, 1], outNormal: [0, 0, 1], tint: [0.04, 0.04, 0.05], group: 'stage:focus' });
  } else {
    box(out, [tx - cw / 2, ty - cd / 2, z], [tx + cw / 2, ty + cd / 2, z + T.chest.h], stone, 0.5, kind === 'open-tomb' ? ['-z', '+z'] : ['-z']);
  }
  if (kind === 'open-tomb') {
    // the void: a dark floor just under the rim, and the inner faces of the walls round it
    const w = 0.09, zi = z + T.chest.h - 0.04, inner = { ...stone, tint: stone.tint.map((v) => v * 0.45) };
    panel(out, [tx - cw / 2 + w, ty - cd / 2 + w, z + 0.3], [1, 0, 0], cw - 2 * w, [0, 1, 0], cd - 2 * w, [0, 0, 1], { key: null, scale: 1, tint: [0.05, 0.05, 0.06], group: 'stage:focus' }, 0.5);
    for (const [o0, A, len, N] of [[[tx - cw / 2 + w, ty - cd / 2 + w], [1, 0, 0], cw - 2 * w, [0, 1, 0]], [[tx + cw / 2 - w, ty + cd / 2 - w], [-1, 0, 0], cw - 2 * w, [0, -1, 0]], [[tx + cw / 2 - w, ty - cd / 2 + w], [0, 1, 0], cd - 2 * w, [-1, 0, 0]], [[tx - cw / 2 + w, ty + cd / 2 - w], [0, -1, 0], cd - 2 * w, [1, 0, 0]]])
      panel(out, [o0[0], o0[1], z + 0.3], A, len, [0, 0, 1], zi - z - 0.3, N, inner, 0.5);
    for (const [a, b, c, d] of [[-1, -1, 1, -1 + 2 * w / cd], [-1, 1 - 2 * w / cd, 1, 1]]) box(out, [tx + a * cw / 2, ty + b * cd / 2, zi], [tx + c * cw / 2, ty + d * cd / 2, z + T.chest.h], stone, 0.5, ['-z']);
    for (const [a, b] of [[-1, -1 + 2 * w / cw], [1 - 2 * w / cw, 1]]) box(out, [tx + a * cw / 2, ty - cd / 2 + w, zi], [tx + b * cw / 2, ty + cd / 2 - w, z + T.chest.h], stone, 0.5, ['-z']);
    // the lid, off and leaning against the chest's long side, its foot on the dais
    const o = T.lid.over, lw = (alongX ? cw : cd) + 2 * o, ld = (alongX ? cd : cw) + 2 * o, ang = 1.15, side = alongX ? [0, -1, 0] : [-1, 0, 0], long = alongX ? [1, 0, 0] : [0, 1, 0];
    const up = [-side[0] * Math.cos(ang), -side[1] * Math.cos(ang), Math.sin(ang)], thin = [side[0] * Math.sin(ang), side[1] * Math.sin(ang), Math.cos(ang)];
    const foot = alongX ? [tx, ty - cd / 2 - ld * Math.cos(ang) - T.lid.h, z] : [tx - cw / 2 - ld * Math.cos(ang) - T.lid.h, ty, z];
    obox(out, [foot[0] + up[0] * ld / 2 + thin[0] * T.lid.h / 2, foot[1] + up[1] * ld / 2 + thin[1] * T.lid.h / 2, z + up[2] * ld / 2 + thin[2] * T.lid.h / 2], long, up, thin, [lw / 2, ld / 2, T.lid.h / 2], { ...stone, group: 'stage:focus-lid' }, 0.5);
  }
  if (kind === 'tomb') {
  const o = T.lid.over;
  box(out, [tx - cw / 2 - o, ty - cd / 2 - o, z + T.chest.h], [tx + cw / 2 + o, ty + cd / 2 + o, z + T.chest.h + T.lid.h], { ...stone, group: 'stage:focus-lid' }, 0.5);
  if (T.lid.round) {
    // a coped lid: a low round cushion across the short span, run the chest's length, its ends closed
    const zt = z + T.chest.h + T.lid.h, hl = (alongX ? cw : cd) / 2 + o * 0.5, hs = (alongX ? cd : cw) / 2 + o * 0.5, sec = roundArch(-hs, hs, zt, T.lid.round, 6);
    const pt = (s, l, zz) => P(alongX ? [tx + l, ty + s, zz] : [tx + s, ty + l, zz]), n3 = (n) => (alongX ? [0, -n[0], -n[1]] : [-n[0], 0, -n[1]]).map(r5);
    for (let i = 0; i < 6; i++) {
      const p = sec[i], q = sec[i + 1], n = n3([(p.n[0] + q.n[0]) / 2, (p.n[1] + q.n[1]) / 2]);
      out.push({ corners: [pt(p.u, -hl, p.z), pt(q.u, -hl, q.z), pt(q.u, hl, q.z), pt(p.u, hl, p.z)], normal: n, outNormal: n, texture: stone.key, textureLit: true,
        uv: [[p.u, -hl], [q.u, -hl], [q.u, hl], [p.u, hl]].map(([a, b]) => [r5(a / stone.scale), r5(b / stone.scale)]), tint: stone.tint, group: 'stage:focus-lid' });
    }
    for (const sg of [-1, 1]) { const n = alongX ? [sg, 0, 0] : [0, sg, 0]; out.push({ corners: sec.map((q) => pt(q.u, sg * hl, q.z)), normal: n, outNormal: n, tint: stone.tint, group: 'stage:focus-lid' }); }
  }
  }
  const top = z - T.dais.step * 0 , k = (T.dais.steps - 1) * T.dais.inset + 0.18;
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => [tx + sx * (dw / 2 - k), ty + sy * (dd / 2 - k), top]);
  return { faces: out, corners };
}

/** A cluster of candles at each dais corner: wax faces, flame faces, and one baked light per cluster. */
export function cryptCandles(plan, spots) {
  const C = plan.kit.dress.candles, faces = [], lights = [];
  spots.forEach((p, i) => {
    let hi = 0;
    for (let j = 0; j < C.per; j++) {
      const a = (j / C.per) * Math.PI * 2 + hash3(i, j, 4201) * 1.3, d = j === 0 ? 0 : 0.08 + hash3(i, j, 4203) * 0.05;
      const x = p[0] + Math.cos(a) * d, y = p[1] + Math.sin(a) * d, h = mix(C.h[0], C.h[1], hash3(i, j, 4205));
      const wax = [];
      box(wax, [x - C.r, y - C.r, p[2]], [x + C.r, y + C.r, p[2] + h], { key: null, scale: 1, tint: [1, 1, 1], group: 'stage:candle' }, 1, ['-z']);
      for (const { texture, textureLit, uv, tint, ...f } of wax) faces.push({ ...f, fill: C.wax });
      // the flame: two crossed quads, emissive, carrying its glow
      for (const [ax, ay] of [[1, 0], [0, 1]]) {
        const zb = p[2] + h, n = [ay, -ax, 0], q = (u, zz) => P([x + ax * u, y + ay * u, zz]);
        faces.push({ corners: [q(-0.018, zb), q(0.018, zb), q(0.004, zb + 0.07), q(-0.004, zb + 0.07)], fill: '#fff2c8', normal: n, outNormal: n, group: 'stage:candle', emissive: hexRgb(C.color), emissiveStrength: 3, glow: `0 0 5px 2px ${C.color}` });
      }
      hi = Math.max(hi, h);
    }
    lights.push({ at: P([p[0], p[1], p[2] + hi + 0.06]), n: [0, 0, 1], color: C.color, intensity: C.intensity, radius: C.radius, fixture: 'candle' });
  });
  return { faces, lights };
}

/** Which pilasters wear cobwebs: a share of them, by die, never two neighbours on one wall. */
export function cobwebPilasters(plan, pilasters) {
  const W = plan.kit.dress.cobwebs;
  let prev = null;
  return pilasters.map((p, i) => {
    const neighbour = prev && prev.room === p.room && prev.F === p.F && prev.k === p.k - 1 && prev.dressed;
    const dressed = !neighbour && hash3(i, p.k, 4301) < W.share;
    prev = { ...p, dressed };
    return dressed;
  });
}

/** Cobwebs in the pilaster angles, where nothing disturbs them; a dressed pilaster never stands beside another. */
export function cryptCobwebs(plan, pilasters) {
  const W = plan.kit.dress.cobwebs, pw = plan.kit.pilaster.w, out = [], dressed = cobwebPilasters(plan, pilasters);
  pilasters.forEach((p, i) => {
    if (!dressed[i]) return;
    for (const [lvl, z, up] of [[0, plan.kit.plinth.h + 0.04, 1], [1, p.top - 0.04, -1]]) {
      const sg = hash3(i, lvl, 4303) < 0.5 ? -1 : 1;
      if (p.u + sg * pw < 0 || p.u + sg * pw > p.F.len) continue;
      const s = mix(W.size[0], W.size[1], hash3(i, lvl, 4305));
      const along = unit([p.F.U[0] * -sg + p.F.N[0], p.F.U[1] * -sg + p.F.N[1], 0]), corner = at(p.F, p.u + sg * (pw / 2 + 0.01), 0.02, z);
      cardRaw(out, [corner[0] + along[0] * s / 2, corner[1] + along[1] * s / 2, corner[2]], along, [0, 0, up], s, s, 'card:cobweb', W.tint, 'stage:cobweb');
    }
  });
  return out;
}

/** The walls of the plan, each with its pilasters in order: the bays between two neighbours are its runs of bare wall. */
function wallsOf(pilasters) {
  const by = new Map();
  for (const p of pilasters) { const k = `${p.room}|${p.F.o.join()}|${p.F.U.join()}`; if (!by.has(k)) by.set(k, { F: p.F, room: p.room, ps: [] }); by.get(k).ps.push(p); }
  for (const w of by.values()) w.ps.sort((a, b) => a.k - b.k);
  return [...by.values()];
}

/** Whether a doorway opens in the wall `F` between `u0` and `u1` (its centre on the wall's plane, its span overlapping). */
export function doorIn(plan, F, u0, u1) {
  return plan.links.some((l) => {
    const mid = (l.lo + l.hi) / 2, c = l.wall.endsWith('y') ? [mid, l.at] : [l.at, mid], half = (l.hi - l.lo) / 2 + plan.kit.door.frame;
    const off = (c[0] - F.o[0]) * F.N[0] + (c[1] - F.o[1]) * F.N[1], u = (c[0] - F.o[0]) * F.U[0] + (c[1] - F.o[1]) * F.U[1];
    return Math.abs(off) < plan.kit.wall + 0.1 && u + half > u0 && u - half < u1;
  });
}

/** The accent wall: in the last room, the wall behind the tomb (its normal faces back toward the way in). */
export function accentWall(plan, pilasters, tombAt) {
  const { r } = lastRoom(plan);
  let best = null;
  for (const w of wallsOf(pilasters)) {
    if (w.room !== r.id) continue;
    const mid = [w.F.o[0] + w.F.U[0] * w.F.len / 2, w.F.o[1] + w.F.U[1] * w.F.len / 2], d = Math.hypot(mid[0] - tombAt[0], mid[1] - tombAt[1]);
    const behind = (tombAt[0] - mid[0]) * w.F.N[0] + (tombAt[1] - mid[1]) * w.F.N[1] > 0;   // the tomb stands in front of it
    if (behind && (!best || d < best.d)) best = { ...w, d };
  }
  return best;
}

/** The repeating element: a burial niche (a loculus) centred in every bare bay, the same on every wall, in tiers where
 *  the wall is tall; a niche holds an urn now and then. The accent wall carries none: it breaks the repeat. */
export function cryptNiches(plan, pilasters, accent) {
  const N = plan.kit.dress.niches, pw = plan.kit.pilaster.w, out = [];
  const trimT = plan.kit.tiles.trim, trim = { key: trimT.family ? `${trimT.family}-a` : trimT.key, scale: trimT.scale, tint: plan.kit.tint.trim, group: 'stage:motif' };
  const back = { key: null, scale: 1, tint: N.dark, group: 'stage:niche' };
  let n = 0;
  for (const w of wallsOf(pilasters)) {
    if (accent && w.room === accent.room && w.F === accent.F) continue;
    for (let i = 0; i + 1 < w.ps.length; i++) {
      const a = w.ps[i], b = w.ps[i + 1];
      if (b.k !== a.k + 1) continue;   // a doorway lies between: not a bare run
      const u0 = a.u + pw / 2, u1 = b.u - pw / 2, wd = Math.min(N.w, (u1 - u0) * 0.6), um = (u0 + u1) / 2;
      if (doorIn(plan, w.F, u0, u1)) continue;   // a doorway inside the bay: not bare either
      // a round head (an arcosolium) rises half the niche's width over its jambs; a flat one is a loculus's slot
      const round = N.head === 'round', nh = N.h + (round ? wd / 2 : 0), z0 = plan.kit.plinth.h + N.sill;
      const tiers = Math.max(1, Math.min(N.tiers ?? 2, Math.floor((a.top - z0 - 0.3 + N.gap) / (nh + N.gap))));
      for (let t = 0; t < tiers; t++) {
        const zb = z0 + t * (nh + N.gap), zt = zb + N.h, F = w.F, f = N.frame, u0 = um - wd / 2, u1 = um + wd / 2;
        // the recess reads by its dark back; the frame stands proud of the wall around it
        panel(out, at(F, u0, 0.012, zb), F.U, wd, [0, 0, 1], N.h, F.N, back, 0.5);
        wallBox(out, F, u0 - f, u1 + f, zb - f, zb, N.out, trim, 0.5);        // sill
        if (round) {
          archUnder(out, F, roundArch(u0, u1, zt, wd / 2, 6), zt, back, 0.012);
          archRing(out, F, u0, u1, zt, wd / 2, 6, f, N.out, trim);             // the archivolt
        } else wallBox(out, F, u0 - f, u1 + f, zt, zt + f, N.out, trim, 0.5);   // lintel
        wallBox(out, F, u0 - f, u0, zb, zt, N.out, trim, 0.5, true);          // jambs
        wallBox(out, F, u1, u1 + f, zb, zt, N.out, trim, 0.5, true);
        if (N.sealed && hash3(n, t, 4407) < N.sealed) panel(out, at(F, u0 + 0.04, 0.03, zb + 0.03), F.U, wd - 0.08, [0, 0, 1], N.h - 0.06, F.N, { ...trim, group: 'stage:motif', tint: N.slab || trim.tint }, 0.5);   // a slab closes it
        if (hash3(n++, t, 4401) < N.urns) {
          const c = at(F, um + (hash3(n, t, 4403) - 0.5) * wd * 0.5, 0.18, zb);
          for (let k = 0; k < 8; k++) {
            const a0 = (k / 8) * 2 * Math.PI, a1 = ((k + 1) / 8) * 2 * Math.PI, nrm = [Math.cos((a0 + a1) / 2), Math.sin((a0 + a1) / 2), 0].map(r5);
            const pt = (a, rr, z) => P([c[0] + rr * Math.cos(a), c[1] + rr * Math.sin(a), z]);
            out.push({ corners: [pt(a0, 0.09, zb), pt(a1, 0.09, zb), pt(a1, 0.12, zb + 0.18), pt(a0, 0.12, zb + 0.18)], normal: nrm, outNormal: nrm, tint: N.urn, group: 'stage:motif-urn', doubleSided: true });
            out.push({ corners: [pt(a0, 0.12, zb + 0.18), pt(a1, 0.12, zb + 0.18), pt(a1, 0.07, zb + 0.3), pt(a0, 0.07, zb + 0.3)], normal: nrm, outNormal: nrm, tint: N.urn, group: 'stage:motif-urn', doubleSided: true });
          }
        }
      }
    }
  }
  return out;
}

/** An ossuary accent: on ledges along the accent wall, rows of skulls between its piers, over its courses of bone ends. */
export function ossuaryRows(plan, pilasters, accent) {
  const O = plan.kit.dress.accent.skulls, pw = plan.kit.pilaster.w, out = [];
  const ledge = { key: null, scale: 1, tint: O.ledge, group: 'stage:accent-ledge' };
  const piers = pilasters.filter((p) => p.room === accent.room && p.F === accent.F).map((p) => p.u).sort((a, b) => a - b);
  const runs = piers.slice(0, -1).map((u, i) => [u + pw / 2 + 0.05, piers[i + 1] - pw / 2 - 0.05]).filter(([a, b]) => b - a > 0.6);
  O.rows.forEach((z, ri) => {
    for (const [a, b] of runs) {
      wallBox(out, accent.F, a, b, z - 0.06, z, O.r * 2.4, ledge, 0.5);
      const n = Math.floor((b - a) / O.gap);
      for (let k = 0; k < n; k++) {
        const u = a + (b - a - (n - 1) * O.gap) / 2 + k * O.gap, s = O.r * mix(0.9, 1.08, hash3(ri, k, 4501));
        skull(out, at(accent.F, u, O.r * 1.1, z), accent.F.N, s, O.tone, 'stage:accent-skull');
      }
    }
  });
  return out;
}

/**
 * IVY through the cracks: rooted in the joint above the plinth at the side of a bare bay (clear of its niche),
 * climbing in a ragged tongue; now and then a shorter tuft from a crack higher up. The ivy card hangs from its top
 * edge, so it is laid upside down: its mass at the root, its tips reaching up. `amount` 0–1: how much of the place it
 * has taken. Never on the accent wall (it breaks the repeat on its own terms).
 */
export function ivyGrowth(plan, pilasters, accent, amount, tint) {
  const N = plan.kit.dress.niches, pw = plan.kit.pilaster.w, out = [];
  if (!(amount > 0)) return out;
  let n = 0;
  for (const w of wallsOf(pilasters)) {
    if (accent && w.room === accent.room && w.F === accent.F) continue;
    for (let i = 0; i + 1 < w.ps.length; i++) {
      const a = w.ps[i], b = w.ps[i + 1];
      if (b.k !== a.k + 1 || doorIn(plan, w.F, a.u, b.u)) continue;
      const k = n++, um = (a.u + b.u) / 2, wd = Math.min(N.w, (b.u - a.u - pw) * 0.6), side = hash3(k, 1, 4601) < 0.5 ? -1 : 1;
      const s0 = side < 0 ? a.u + pw / 2 + 0.04 : um + wd / 2 + N.frame + 0.04, s1 = side < 0 ? um - wd / 2 - N.frame - 0.04 : b.u - pw / 2 - 0.04;
      if (s1 - s0 < 0.3) continue;
      if (hash3(k, 2, 4603) < amount * 0.75) {
        const wdt = Math.min(s1 - s0, mix(0.55, 1.1, hash3(k, 3, 4605))), h = Math.min(a.top - plan.kit.plinth.h - 0.3, mix(1.1, 3.4, hash3(k, 4, 4607)) * (0.6 + 0.4 * amount));
        const u = s0 + wdt / 2 + (s1 - s0 - wdt) * hash3(k, 5, 4609), z0 = plan.kit.plinth.h - 0.05;
        cardRaw(out, at(w.F, u, 0.03, z0 + h), w.F.U, [0, 0, -1], wdt, h, 'card:ivy', tint, 'stage:ivy');
      }
      if (hash3(k, 6, 4611) < amount * 0.3) {   // a tuft from a crack higher up
        const wdt = Math.min(s1 - s0, 0.5), h = mix(0.5, 0.9, hash3(k, 7, 4613)), z = mix(plan.kit.plinth.h + 1.2, a.top - 0.4, hash3(k, 8, 4615));
        if (z - h > plan.kit.plinth.h + 0.3) cardRaw(out, at(w.F, s0 + (s1 - s0) / 2, 0.03, z), w.F.U, [0, 0, -1], wdt, h, 'card:ivy', tint, 'stage:ivy');
      }
    }
  }
  return out;
}

/** The accent's stone: larger, darker ashlar than the courses round it, named from its own numbers. */
const accentFamily = (A) => tileFamilyOf({ gen: 'stone-brick', ...A.stone });

/** The view the walk leads to: from the way into the last room, eye height, on the tomb. */
export function tombCamera(plan, corners) {
  const { r, entry } = lastRoom(plan), cx = corners.reduce((s, c) => s + c[0], 0) / 4, cy = corners.reduce((s, c) => s + c[1], 0) / 4;
  // stand in the way in, a little above the eye, a step to the side so the dais reads in three-quarter
  const dx = cx - entry[0], dy = cy - entry[1], L = Math.hypot(dx, dy) || 1, ex = entry[0] + (dx / L) * 0.4 - (dy / L) * 0.6, ey = entry[1] + (dy / L) * 0.4 + (dx / L) * 0.6;
  return { name: 'tomb', worldFraming: { cameraPosition: P([Math.min(r.x1 - 0.6, Math.max(r.x0 + 0.6, ex)), Math.min(r.y1 - 0.6, Math.max(r.y0 + 0.6, ey)), plan.kit.dress.camera?.z ?? 2.3]), lookAt: P([cx, cy, plan.kit.dress.camera?.at ?? 0.45]), horizontalFov: 80, pictureCenter: [560, 390] } };
}

// a coffin is cut from the kit's own dressed stone (its trim), not the tomb's marble
const coffinStone = (plan) => { const t = plan.kit.tiles.trim; return { key: t.family ? `${t.family}-a` : t.key, scale: t.scale || 1.5, tint: plan.kit.tint.trim }; };

/** Everything the crypt adds, in the shape the stage composes (see naveDress). */
export function cryptDress(plan, geom) {
  const D = plan.kit.dress, tomb = cryptTomb(plan), candles = cryptCandles(plan, tomb.corners), pil = geom.pilasters || [];
  const tc = [tomb.corners.reduce((s, c) => s + c[0], 0) / 4, tomb.corners.reduce((s, c) => s + c[1], 0) / 4];
  const accent = accentWall(plan, pil, tc), fam = accentFamily(D.accent);
  // the accent wall's courses re-cut in its own stone: the shell's wall faces on that plane are replaced, variant kept
  const onAccent = (f) => accent && f.group === 'stage:wall' && f.normal[0] === accent.F.N[0] && f.normal[1] === accent.F.N[1]
    && f.corners.every((c) => Math.abs((c[0] - accent.F.o[0]) * accent.F.N[0] + (c[1] - accent.F.o[1]) * accent.F.N[1]) < 0.02);
  const k = D.accent.repeat || 1, uv = (f) => (k === 1 ? f.uv : f.uv.map(([u, v]) => [r5(u * k), r5(v * k)]));
  const accentFaces = accent ? geom.faces.filter(onAccent).map((f) => ({ ...f, texture: `${fam}-${(f.texture || 'x-a').slice(-1)}`, uv: uv(f), tint: D.accent.tint, group: 'stage:accent' })) : [];
  const keepClear = [{ x: tc[0], y: tc[1], r: Math.hypot(D.tomb.dais.w, D.tomb.dais.d) / 2 + 0.6 }];
  return {
    cameras: [tombCamera(plan, tomb.corners)],
    faces: [...tomb.faces, ...accentFaces, ...(accent && D.accent.skulls ? ossuaryRows(plan, pil, accent) : []), ...cryptNiches(plan, pil, accent), ...cryptCobwebs(plan, pil), ...(D.ivy && D.ivy.amount > 0 ? ivyGrowth(plan, pil, accent, D.ivy.amount, D.ivy.tint) : []), ...cornerThings(plan, pil, { stone: coffinStone(plan), ...D.props }, keepClear)],
    blends: (faces) => blendsByCause(plan, faces, D.moss, D.grime, D.earth),
    after: candles.faces, pools: [], lights: candles.lights, cut: onAccent, shadowSkip: () => false,
  };
}
