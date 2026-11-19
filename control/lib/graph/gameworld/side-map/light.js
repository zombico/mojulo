/**
 * THE SIDE MAP'S LIGHT (docs/side-map-principles.md "The look": light from sources that are seen; the benchmark measures
 * it): the built map's faces lit per corner, baked as the page's vertex colours (`cornerFills`, figures/face-mesh.js), so
 * the page draws it as cheaply as the flat build. Each face's colour is its BASE (the colour the dress gave it); the light
 * at each corner multiplies it, in linear light.
 *
 *   an INDOOR zone   a quiet ambient; the camera's fill on the lane only (what stands at the lane's plane and in front of
 *                    it), so the lane is the lit layer and the back a step down; each LAMP of the dress (an A bay's, at its
 *                    seam, near the top) a light with the house's falloff (form/room-light.js `falloff`, its radius a share
 *                    of the screen) and its bounce, so an A bay glows and a B bay falls to its shade between lamps
 *   an OUTDOOR zone  the cube's sky and sun (era/cube-light.js `cubeLight`): the sky by how much a face looks up, the sun by
 *                    its cosine, its direction the side map's key (from behind the camera, above: the cube's own azimuth
 *                    would light faces the camera never sees)
 *   CONTACT          a closed face darkens under its own lip, and the back wall under a ledge, a rest or a top above it
 *   SHADOWS          what stands in the map (its slabs, its props, its crates) thrown hard onto the back wall and a floor's
 *                    top, each a polygon a hair proud of it in its light darkened (shadow.js; `casters`, scene.js's)
 *   a CLIMB          the next zone's light carried down a shaft's top screen: the goal of a climb is a patch of light
 *   a CHUTE          darker as it drops
 *   the BOSS         the zones that lead to its room take its colour in their light, by the dress's share
 *   what GIVES light a lamp, the boss's emblem, the backdrop's far layers: as they are, never lit
 *
 *   SIDE_MAP_LIGHT   the light's measures
 *   sideMapTextures(faces) → the payload's `textures` for the tiles the faces name
 *   the MATERIAL     its finish baked with the camera's fixed view (cake.js): a glint at the key's half-vector, the sky
 *                    on what looks up, a metal's sheen in bands; its texture tile on world uvs (texture.js, `textureLit`)
 *   lightSideMap(faces, layout, dress, cube, { sky?, casters? }) → the faces, the large ones cut into cells (a lamp's pool needs corners to
 *                    fall across), each with `cornerFills` and its `fill` their mean
 *
 * Pure and deterministic.
 */
import { falloff, ROOM_LIGHT } from '../../form/room-light.js';
import { decodeSrgb, encodeSrgb } from '../../color-theorist/light.js';
import { cubeLight } from '../../era/cube-light.js';
import { SIDE } from '../../era/geocube-side.js';
import { MATERIALS } from './cake.js';
import { sideMapTexture, textureKey, TEXTURE_TILE } from './texture.js';
import { shadowOn, SHADOW } from './shadow.js';

export const SIDE_MAP_LIGHT = Object.freeze({
  cell: 2.5,                 // m: a face larger than this is cut into cells this size (a lamp's pool is four of them)
  ambient: 0.4, fill: 0.6,   // indoors: the ambient, and the camera's fill on the lane (a lane face square to it: 1)
  back: 0.45,                // indoors: the back wall's ambient (no fill reaches it)
  lamp: 2.2, radius: 0.42,   // a lamp's light at the reference distance, its radius a share of the screen's width
  warm: '#ffd9a8',           // a lamp's light, half its zone's edge colour
  lip: 0.4, lipH: 1.2,       // a closed face darkened by this under its own lip, over this many metres
  contact: 0.4, under: 1.6,  // the back wall darkened by this under a top, over this many metres below it
  top: 1.2,                  // a climb's top screen: the next zone's light, rising to this at its top
  chute: 0.45,               // a chute darker by this at its foot
  boss: 0.25,                // the boss's colour in the light of its lead-in, at a whole share
  // THE TERRAIN'S SHADING (a run and gun's 3D stage read from the side): a slice's face bright under its icing and falling
  // into shade deeper in the block (`depth` at `depthH` m under its top and past), a crisp shadow line under the icing's
  // overhang (`band` m tall, `bandCast`), and where a thing stands on a top, its contact (`foot` m round its foot, `footFront`
  // toward the camera, where the top is seen)
  depth: 0.5, depthH: 2.6, band: 0.1, bandCast: 0.45, foot: 0.12, footFront: 0.35, footCast: 0.4,
});
// (the foreground's doodads a silhouette nearer the camera than the lane: the light leaves them their own dark tone)
const KEEP = new Set(['sidemap:lamp', 'sidemap:emblem', 'sidemap:hills', 'sidemap:range', 'sidemap:doodad-foreground']);
const CLOSED = (g) => /^sidemap:(rock|built|machine|padded|paint-)/.test(g);
const lin = (h) => [1, 3, 5].map((i) => decodeSrgb(parseInt(h.slice(i, i + 2), 16) / 255));
const hexOf = (c) => `#${c.map((v) => Math.round(encodeSrgb(Math.min(1, Math.max(0, v))) * 255).toString(16).padStart(2, '0')).join('')}`;
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const unit = (c) => { const y = lum(c) || 1; return c.map((v) => v / y); };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const KEY = ((v) => { const l = Math.hypot(...v); return v.map((x) => x / l); })(SIDE.key), FRONT = KEY[0];
const r5 = (v) => Math.round(v * 1e5) / 1e5;

// a planar quad cut into cells of at most `cell` along both its sides, each cell in the quad's own winding
function cells(f, cell) {
  const [a, b, c, d] = f.corners, nu = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / cell)), nv = Math.max(1, Math.ceil(Math.hypot(d[0] - a[0], d[1] - a[1], d[2] - a[2]) / cell));
  if (nu === 1 && nv === 1) return [f];
  const at = (u, v) => [0, 1, 2].map((k) => r5(a[k] + (b[k] - a[k]) * u + (d[k] - a[k]) * v + (a[k] - b[k] + c[k] - d[k]) * u * v));
  const out = [];
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) out.push({ ...f, corners: [at(i / nu, j / nv), at((i + 1) / nu, j / nv), at((i + 1) / nu, (j + 1) / nv), at(i / nu, (j + 1) / nv)] });
  return out;
}

/** The lamps the map is lit by (scene.js hangs them: an A bay's, at its seam, under its open space's top), each
 * { at: [x, s, z], zone }: the bake's, and a cel body's key indoors (level.js, the side map's camera zones). */
export function sideMapLamps(layout, dress) {
  const out = [];
  for (const z of dress.zones) {
    if (!z.indoor || !z.lamps) continue;
    const o = layout.open.find((r) => r.zone === z.zone);
    if (o) for (const s of z.lamps) out.push({ at: [-2.6, s, o.z1 - 1.4], zone: z.zone });
  }
  return out;
}

/** The built map's faces lit per corner. */
export function lightSideMap(faces, layout, dress, cube, { sky = null, casters = null } = {}) {
  const L = layout, D = dress, W = L.screen.width, H = L.screen.height, S = SIDE_MAP_LIGHT;
  const CL = cubeLight(cube), sun = CL.sun.linear, amb = CL.ambient.linear, norm = sun.map((v, k) => amb[k] + v * FRONT);
  // the zone a face belongs to: the solid it is part of, else the open space it stands in (the latest, a doorway the
  // zone's it leads into), else the first swept area that holds it, else the nearest (zones' swept areas overlap at a
  // corner: a room's floor is not the chute's before it)
  const inR = (r, s, z, e = 1e-3) => s >= r.s0 - e && s <= r.s1 + e && z >= r.z0 - e && z <= r.z1 + e;
  const zoneOfFace = (f) => {
    const n = f.corners.length, s = f.corners.reduce((a, c) => a + c[1], 0) / n, z = f.corners.reduce((a, c) => a + c[2], 0) / n;
    const solid = L.solids.find((r) => inR(r, s, z, 0.02));
    if (solid && (CLOSED(f.group) || f.group === 'sidemap:edge')) return solid.zone;
    const open = L.open.filter((r) => inR(r, s, z, 0.05));
    if (open.length) return Math.max(...open.map((r) => r.zone));
    return zoneAt(s, z);
  };
  const zoneAt = (s, z) => {
    const r = L.swept.find((q) => s >= q.s0 - 1e-3 && s <= q.s1 + 1e-3 && z >= q.z0 - 1e-3 && z <= q.z1 + 1e-3);
    if (r) return r.zone;
    let best = 0, bd = Infinity;
    for (const Z of L.zones) { const [s0, s1, z0, z1] = Z.rect, d = Math.max(s0 - s, 0, s - s1) + Math.max(z0 - z, 0, z - z1); if (d < bd) { bd = d; best = Z.i; } }
    return best;
  };
  // the lamps, where the build hangs them (sideMapLamps), each in its zone's edge warmed
  const lamps = sideMapLamps(L, D).map((l) => ({ ...l, tone: unit(lin(D.zones[l.zone].edge)).map((v, k) => 0.5 * v + 0.5 * unit(lin(S.warm))[k]) }));
  const R = S.radius * W, ref = falloff(ROOM_LIGHT.at, R);
  const bossTone = unit(lin(D.palette.boss));
  const ups = new Map(L.zones.filter((Z) => Z.run === 'up').map((Z) => [Z.i, Z.exit[1]]));
  const chutes = new Map(L.zones.filter((Z) => Z.drop === 'chute').map((Z) => [Z.i, [Z.i ? L.zones[Z.i - 1].exit[1] : 0, Z.exit[1]]]));
  // the top over a point on a closed part (its own lip), and the nearest underside over a point on the back wall
  const lipOver = (s, z) => { let t = Infinity; for (const r of L.solids) if (s >= r.s0 - 1e-3 && s <= r.s1 + 1e-3 && z >= r.z0 - 1e-3 && z <= r.z1 + 1e-3) t = Math.min(t, r.z1); return t; };
  const underOver = (s, z) => { let g = Infinity; for (const r of L.solids) if (s > r.s0 && s < r.s1 && r.z0 >= z - 1e-3) g = Math.min(g, r.z0 - z); return g; };

  const light = (p, n, f, zi) => {
    const Z = D.zones[zi], indoor = Z?.indoor !== false, lane = p[0] >= -0.5;
    let c;
    if (indoor) {
      const a = lane ? S.ambient + S.fill * Math.max(0, dot(n, KEY)) / FRONT : S.back;
      c = [a, a, a];
      for (const l of lamps) {
        const to = [l.at[0] - p[0], l.at[1] - p[1], l.at[2] - p[2]], d = Math.hypot(...to);
        if (d >= R * ROOM_LIGHT.reach) continue;
        const ndl = d > 1e-6 ? dot(n, to.map((v) => v / d)) : 1;
        const w = S.lamp * ((ndl > 0 && d < R ? falloff(d, R) * ndl : 0) + ROOM_LIGHT.bounce * falloff(d, R * ROOM_LIGHT.reach)) / ref;
        if (w > 0) c = c.map((v, k) => v + w * l.tone[k]);
      }
    } else {
      // the sky by how far the face looks up, the sun by its cosine, normalised so a lane face square to the camera shows its base
      const t = 0.5 + 0.5 * n[2], cos = Math.max(0, dot(n, KEY));
      c = amb.map((v, k) => (v * (0.55 + 0.45 * t) + sun[k] * cos) / norm[k]);
    }
    // contact: a closed face under its own lip; the back wall under a top over it
    // (a slice's face toward the camera: its icing's line is the band's, crisp; below it the block falls into shade with
    // depth. Its sides keep the soft lip)
    if (CLOSED(f.group) && !/^sidemap:paint-(cap|jamb|bracket)/.test(f.group) && n[2] < 0.5) {
      const t = lipOver(p[1], p[2]);
      if (t < Infinity && n[0] > 0.9) { const d = Math.min(1, Math.max(0, (t - p[2]) / S.depthH)); c = c.map((v) => v * (1 - S.depth * d * d * (3 - 2 * d))); }
      else if (t < Infinity) c = c.map((v) => v * (1 - S.lip * Math.max(0, 1 - (t - p[2]) / S.lipH)));
    }
    if (f.group === 'sidemap:back') { const g = underOver(p[1], p[2]); if (g < S.under) c = c.map((v) => v * (1 - S.contact * (1 - g / S.under))); }
    // a climb's top: the next zone's light carried down its top screen; a chute darker as it drops
    if (ups.has(zi)) { const top = ups.get(zi), u = Math.min(1, 1 - (top - p[2]) / H); if (u > 0) c = c.map((v) => v + S.top * u); }
    if (chutes.has(zi)) { const [z0, z1] = chutes.get(zi), u = z0 > z1 ? Math.min(1, Math.max(0, (z0 - p[2]) / (z0 - z1))) : 0; c = c.map((v) => v * (1 - S.chute * u)); }
    if (Z && Z.boss > 0) c = c.map((v, k) => v * (1 + S.boss * Z.boss * (bossTone[k] - 1)));
    return c;
  };

  // THE MATERIAL, BAKED (cake.js finishes): the side map's camera always stands on the +x side, so what depends on the view
  // bakes truly. Over the light: a glint where the key's half-vector meets the face (its finish's spec and gloss), the
  // sky on what looks up (its share of the sky), and a metal's broad sheen across its faces (the sky it reflects, in
  // diagonal bands on world position: continuous from cell to cell), on the material's own surfaces (its slices, their
  // icing), never the back wall behind them. Added light, not multiplied: a glint is the light's
  const V = ((v) => { const l = Math.hypot(...v); return v.map((x) => x / l); })([1, 0, 0.05]);
  const HV = ((v) => { const l = Math.hypot(...v); return v.map((x) => x / l); })([KEY[0] + V[0], KEY[1] + V[1], KEY[2] + V[2]]);
  const skyLin = sky ? lin(sky) : amb.map((v) => v / Math.max(1e-6, lum(amb))), keyLin = unit(sun).map((v) => v * 0.9);
  const finishAt = (zi) => MATERIALS[D.zones[zi]?.material]?.finish ?? null;
  const glint = (p, n, F) => {
    if (!F) return null;
    const sp = F.spec * Math.max(0, dot(n, HV)) ** F.gloss, up = F.sky * Math.max(0, n[2]);
    const sheen = F.metal > 0.3 && n[0] > 0.5 ? F.sky * Math.max(0, Math.sin(0.55 * p[2] + 0.32 * p[1])) ** 4 : 0;
    return [0, 1, 2].map((k) => sp * keyLin[k] + (up + sheen) * skyLin[k]);
  };
  // (its texture: a near-white tile on world uvs a material wears, multiplied by the baked light: texture.js)
  const uvOf = (q) => { const n = q.normal, T = TEXTURE_TILE; return q.corners.map((c) => (Math.abs(n[2]) > 0.5 ? [c[1] / T, c[0] / T] : Math.abs(n[1]) > 0.5 ? [c[0] / T, c[2] / T] : [c[1] / T, c[2] / T]).map((v) => r5(v))); };
  const textured = (g) => CLOSED(g) || g === 'sidemap:edge' || /^sidemap:paint-(cap|jamb)/.test(g);
  // the receivers: the back wall (x its plane, its rectangle in s and z) and a floor's top (z its plane, in s and x), and
  // the shadows each takes, wound as the face is
  // (the icing: each cap's face toward the camera, its run and its foot)
  const caps = casters ? faces.filter((q) => q && q.group === 'sidemap:paint-cap' && q.normal && q.normal[0] > 0.9 && Array.isArray(q.corners)).map((q) => ({ s0: Math.min(...q.corners.map((c) => c[1])), s1: Math.max(...q.corners.map((c) => c[1])), z0: Math.min(...q.corners.map((c) => c[2])) })) : [];
  const shadowsOf = (f) => {
    const C = f.corners, n = f.normal, xs = C.map((c) => c[0]), ss = C.map((c) => c[1]), zs = C.map((c) => c[2]);
    const box = { s0: Math.min(...ss), s1: Math.max(...ss) };
    let R = null;
    if (f.group === 'sidemap:back' && n[0] > 0.9) R = { axis: 'x', at: xs[0], ...box, a0: Math.min(...zs), a1: Math.max(...zs) };
    else if (f.group === 'sidemap:edge' && n[2] > 0.9) {
      const at = zs[0], mid = (box.s0 + box.s1) / 2;
      R = { axis: 'z', at, ...box, a0: Math.min(...xs), a1: Math.max(...xs), own: casters.find((b) => b.of === 'solid' && Math.abs(b.z1 - at) < 1e-3 && mid >= b.s0 - 1e-3 && mid <= b.s1 + 1e-3) };
    }
    // a slice's face toward the camera: the crisp line under its ICING (the cake's cap, `paint-cap`: the layer whose top
    // meets a cap's foot takes it, as wide as both)
    if (!R && CLOSED(f.group) && !/^sidemap:paint-(cap|jamb|bracket)/.test(f.group) && n[0] > 0.9) {
      const top = Math.max(...zs), cap = caps.find((c) => Math.abs(c.z0 - top) < 0.02 && c.s1 > box.s0 + 1e-3 && c.s0 < box.s1 - 1e-3);
      if (cap) { const s0 = Math.max(box.s0, cap.s0), s1 = Math.min(box.s1, cap.s1), b = Math.max(Math.min(...zs), top - S.band), x = Math.max(...xs) + SHADOW.lift;
        return b < top - 1e-3 ? [{ poly: [[x, s0, b], [x, s1, b], [x, s1, top], [x, s0, top]], cast: S.bandCast }] : []; }
    }
    if (!R) return [];
    const wind = (P) => {
      // (wound as the face: its normal's way)
      const e1 = [0, 1, 2].map((k) => P[1][k] - P[0][k]), e2 = [0, 1, 2].map((k) => P[2][k] - P[0][k]);
      const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      return dot(cr, n) < 0 ? [...P].reverse() : P;
    };
    const cast = shadowOn(R, casters).map((P) => ({ poly: wind(P), cast: SHADOW.cast }));
    // (and on a top, the CONTACT round the foot of what stands on it: its footprint grown, cut to the top)
    if (R.axis === 'z') for (const b of casters) {
      if (b.of === 'solid' || Math.abs(b.z0 - R.at) > 0.02) continue;
      const s0 = Math.max(R.s0, b.s0 - S.foot), s1 = Math.min(R.s1, b.s1 + S.foot), x0 = Math.max(R.a0, b.x0 - S.foot), x1 = Math.min(R.a1, b.x1 + S.footFront);
      if (s1 - s0 > SHADOW.min && x1 - x0 > SHADOW.min) cast.push({ poly: wind([[x0, s0, R.at + SHADOW.lift], [x1, s0, R.at + SHADOW.lift], [x1, s1, R.at + SHADOW.lift], [x0, s1, R.at + SHADOW.lift]]), cast: S.footCast });
    }
    return cast;
  };
  const out = [];
  for (const f of faces) {
    if (!f || KEEP.has(f.group) || !Array.isArray(f.corners) || f.corners.length !== 4) { out.push(f); continue; }
    const base = lin(f.fill), zi = zoneOfFace(f), F = finishAt(zi), tex = MATERIALS[D.zones[zi]?.material]?.texture;
    for (const q of cells(f, S.cell)) {
      const mine = textured(q.group), cols = q.corners.map((p) => { const c = light(p, q.normal, q, zi), g = mine ? glint(p, q.normal, F) : null; return hexOf(base.map((v, k) => v * c[k] + (g ? g[k] : 0))); });
      const mean = hexOf([0, 1, 2].map((k) => cols.reduce((s, h) => s + lin(h)[k], 0) / 4));
      out.push({ ...q, fill: mean, cornerFills: cols, ...(tex && textured(q.group) ? { texture: textureKey(tex), uv: uvOf(q), textureLit: true } : {}) });
    }
    // its SHADOWS (shadow.js): what stands in the map thrown onto the back wall and onto a floor's top, a crisp polygon a
    // hair proud of it, in its own light darkened, its texture with it
    if (casters) for (const { poly: sh, cast } of shadowsOf(f)) {
      const n = f.normal, cols = sh.map((p) => { const c = light(p, n, f, zi); return hexOf(base.map((v, k) => v * c[k] * (1 - cast))); });
      const q = { ...f, corners: sh, group: 'sidemap:shadow' }, mean = hexOf([0, 1, 2].map((k) => cols.reduce((a, h) => a + lin(h)[k], 0) / cols.length));
      out.push({ ...q, fill: mean, cornerFills: cols, ...(tex && textured(f.group) ? { texture: textureKey(tex), uv: uvOf(q), textureLit: true } : {}) });
    }
  }
  return out;
}

/** The texture tiles a lit map's faces name, for the payload's `textures`. */
export function sideMapTextures(faces) {
  const keys = [...new Set(faces.map((f) => f && f.texture).filter((k) => typeof k === 'string' && k.startsWith('sidemap:')))].sort();
  return Object.fromEntries(keys.map((k) => [k, sideMapTexture(k.slice('sidemap:'.length))]));
}
