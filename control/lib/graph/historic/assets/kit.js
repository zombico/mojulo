/**
 * historic/assets/kit — the asset contract. The planner lays out SLOTS ({ asset, rect, facing, … });
 * the kit turns each slot into masses. An asset is designed once (read off a massing sheet the image
 * worker dreamed — a reasoning aid, never the artifact) and built here from shared pattern parts.
 *
 * Every asset builds in a CANONICAL LOCAL FRAME, in metres: its footprint is [0, W] × [0, D], its
 * FRONT faces −y (stairs and porches may reach past y = 0), z up from the ground. `placeAsset` fits it
 * to a slot rect and turns it so the front faces the slot's `facing` ('n' −y, 's' +y, 'e' +x, 'w' −x).
 * Builders are pure: dressing dice come in as an rng keyed per slot. A mass may be an angled SOLID
 * (battered frustum, sloped wedge, round vault — ./solids.js); its own directions turn with it.
 */
import { orientSolid } from './solids.js';
import { scaleHex } from '../../polygonizer/vexar.js';

/** Local footprint size for a world rect seen from a facing (east/west swap the axes). */
export function localSize(rect, facing = 'n') {
  return facing === 'e' || facing === 'w' ? { W: rect.d, D: rect.w } : { W: rect.w, D: rect.d };
}

/** Map a local box (front −y) into the world rect, turned to face `facing`. */
export function orientBox(b, rect, facing = 'n') {
  const { W, D } = localSize(rect, facing);
  const u0 = b.x, u1 = b.x + b.w, v0 = b.y, v1 = b.y + b.d;
  let x0, x1, y0, y1;
  if (facing === 's') { x0 = W - u1; x1 = W - u0; y0 = D - v1; y1 = D - v0; }
  else if (facing === 'e') { x0 = D - v1; x1 = D - v0; y0 = u0; y1 = u1; }
  else if (facing === 'w') { x0 = v0; x1 = v1; y0 = W - u1; y1 = W - u0; }
  else { x0 = u0; x1 = u1; y0 = v0; y1 = v1; }
  return { ...b, x: rect.x + x0, y: rect.y + y0, w: x1 - x0, d: y1 - y0 };
}

/**
 * Build one slot with its asset. Returns `{ boxes, grounds }` in world metres. An asset may return
 * plain boxes or `{ boxes, grounds }` (grounds are flat rects with a `z`, oriented the same way).
 */
export function placeAsset(asset, slot, ctx) {
  const { W, D } = localSize(slot.rect, slot.facing);
  const out = asset.build({ W, D, slot }, ctx);
  const boxes = Array.isArray(out) ? out : out.boxes, grounds = Array.isArray(out) ? [] : out.grounds || [];
  const lift = slot.z || 0;
  // some houses were never rendered (or have lost it): their mud plaster turns to bare brick. Decided
  // by the lot's position, not the slot's dice, so the choice moves nothing else.
  const R = ctx && ctx.culture && ctx.culture.skins, bare = R && R.bare && lotHash(slot.rect) < R.bare.share;
  const skinned = (b) => {
    let skin = b.skin !== undefined ? b.skin : skinFor(ctx && ctx.culture, { ...b, asset: asset.id });
    if (bare && skin === R.bare.from) skin = R.bare.skin;
    return skin ? { skin } : {};
  };
  // a panel's corners are points in the asset's frame: turned and lifted like everything else, its `out` turned with them
  const pt = ([u, v, z]) => { const r = orientBox({ x: u, y: v, w: 0, d: 0 }, slot.rect, slot.facing); return [r.x, r.y, z + lift]; };
  const dir = ([a, b, c]) => ({ n: [a, b, c], s: [-a, -b, c], e: [-b, a, c], w: [b, -a, c] })[slot.facing || 'n'];
  const panel = (b) => (b.solid === 'panel' && b.pts ? { pts: b.pts.map(pt), out: dir(b.out) } : {});
  return {
    boxes: boxes.map((b) => ({ ...orientBox(b, slot.rect, slot.facing), ...orientSolid(b, slot.facing, (r) => orientBox(r, slot.rect, slot.facing)), ...panel(b), z0: b.z0 + lift, z1: b.z1 + lift, asset: asset.id, ...skinned(b) })),
    grounds: grounds.map((g) => ({ ...orientBox(g, slot.rect, slot.facing), z: g.z + lift })),
  };
}

/**
 * What a mass is made of, by the culture's `skins` rule: its asset's own override, else its kind's;
 * a pale (whitewashed) tint turns any skinned mass to the whitewash skin. Null: no skin.
 */
export function skinFor(culture, b) {
  const R = culture && culture.skins;
  if (!R || b.plant) return null;
  const skin = (b.asset && R.assets && R.assets[b.asset] && R.assets[b.asset][b.kind]) || R.kinds[b.kind] || null;
  if (!skin || !b.tint || !R.whitewash) return skin;
  const [r, g, bl] = [1, 3, 5].map((i) => parseInt(b.tint.slice(i, i + 2), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl > 205 ? R.whitewash : skin;
}

const lotHash = (r) => { let h = 2166136261; for (const v of [r.x, r.y, r.w, r.d]) { h = Math.imul(h ^ Math.round(v * 100), 16777619) >>> 0; h = Math.imul(h ^ (h >>> 13), 2246822507) >>> 0; } return (h >>> 0) / 4294967296; };

// ── shared parts (local frame) ──

/** A rim of merlons along the top edge of a rect: the crenellated read. */
export function merlons({ x, y, w, d }, z, tint, { pitch = 1.8, size = 0.8, height = 0.7, depth = 0.6 } = {}) {
  const out = [];
  const run = (len, at) => { const n = Math.max(1, Math.floor(len / pitch)); const step = len / n; for (let i = 0; i < n; i++) at(i * step + (step - size) / 2); };
  run(w, (u) => out.push({ kind: 'merlon', x: x + u, y, w: size, d: depth, z0: z, z1: z + height, tint }, { kind: 'merlon', x: x + u, y: y + d - depth, w: size, d: depth, z0: z, z1: z + height, tint }));
  run(d - 2 * depth, (v) => out.push({ kind: 'merlon', x, y: y + depth + v, w: depth, d: size, z0: z, z1: z + height, tint }, { kind: 'merlon', x: x + w - depth, y: y + depth + v, w: depth, d: size, z0: z, z1: z + height, tint }));
  return out;
}

/**
 * Buttress ribs standing proud of a rect's faces (which faces: any of 'front','back','left','right').
 * With `lean` (metres, over the rib's height) each rib leans in with a battered face.
 */
export function ribs({ x, y, w, d }, z0, z1, tint, { pitch = 2.6, width = 1, depth = 0.6, faces = ['front', 'back', 'left', 'right'], lean = 0 } = {}) {
  const out = [];
  const rib = (r, dx, dy) => out.push(lean > 0 ? { kind: 'rib', solid: 'frustum', ...r, z0, z1, top: { x: r.x + dx * lean, y: r.y + dy * lean, w: r.w, d: r.d }, tint } : { kind: 'rib', ...r, z0, z1, tint });
  const along = (len, at) => { const n = Math.max(1, Math.round(len / pitch)); const step = len / n; for (let i = 1; i < n; i++) at(i * step - width / 2); };
  if (faces.includes('front')) along(w, (u) => rib({ x: x + u, y: y - depth, w: width, d: depth }, 0, 1));
  if (faces.includes('back')) along(w, (u) => rib({ x: x + u, y: y + d, w: width, d: depth }, 0, -1));
  if (faces.includes('left')) along(d, (v) => rib({ x: x - depth, y: y + v, w: depth, d: width }, 1, 0));
  if (faces.includes('right')) along(d, (v) => rib({ x: x + w, y: y + v, w: depth, d: width }, -1, 0));
  return out;
}

/** A flight of steps climbing toward +y (dir 'y') or toward ±x (dir 'x+' / 'x-'), from z0 to z1. */
export function flight({ x, y, w, d }, z0, z1, tint, dir = 'y', steps = 12) {
  const out = [];
  for (let i = 0; i < steps; i++) {
    const t = (i + 1) / steps, zt = z0 + (z1 - z0) * t;
    if (dir === 'y') out.push({ kind: 'stair', x, y: y + (d * i) / steps, w, d: d / steps + 0.02, z0, z1: zt, tint });
    else if (dir === 'x+') out.push({ kind: 'stair', x: x + (w * i) / steps, y, w: w / steps + 0.02, d, z0, z1: zt, tint });
    else out.push({ kind: 'stair', x: x + w - (w * (i + 1)) / steps, y, w: w / steps + 0.02, d, z0, z1: zt, tint });
  }
  return out;
}

/** A dark doorway panel set just proud of a front face at local y. */
export function doorway(cx, y, z0, w, h, tint) {
  return { kind: 'door', x: cx - w / 2, y: y - 0.05, w, d: 0.1, z0, z1: z0 + h, tint };
}

/** A battered block: the rect at z0 leaning in by `lean` (metres) on the listed sides by z1. */
export function battered(r, z0, z1, tint, lean, { sides = ['front', 'back', 'left', 'right'], kind = 'mass' } = {}) {
  const l = (k) => (sides.includes(k) ? lean : 0);
  const top = { x: r.x + l('left'), y: r.y + l('front'), w: r.w - l('left') - l('right'), d: r.d - l('front') - l('back') };
  return { kind, solid: 'frustum', ...r, z0, z1, top, tint };
}

/** A sloped flight: a ramp from z0 up to z1 rising toward `rise`, with step stripes on the slope (a monumental ~0.9 m riser unless `riser` says otherwise). */
export function slopedFlight(r, z0, z1, tint, rise = 'y+', { cheek = 0, cheekTint, riser: riserH = 0.9 } = {}) {
  const out = [{ kind: 'stair', solid: 'wedge', ...r, z0, z1, rise, tint }];
  // the treads: thin steps riding the slope, so the flight still reads as stairs
  const along = rise[0] === 'y', up = rise[1] === '+', len = along ? r.d : r.w, n = Math.max(4, Math.round((z1 - z0) / riserH)), riser = (z1 - z0) / n;
  for (let i = 0; i < n; i++) {
    const t0 = i / n, s0 = up ? t0 * len : len - (t0 + 1 / n) * len, sz = len / n, zt = z0 + (i + 1) * riser;
    out.push({ kind: 'tread', ...(along ? { x: r.x, y: r.y + s0, w: r.w, d: sz } : { x: r.x + s0, y: r.y, w: sz, d: r.d }), z0: Math.max(z0, zt - riser * 1.6), z1: zt, tint: scaleHex(tint, 1.06) });
  }
  if (cheek > 0) {
    // sloped cheek walls either side, a little proud of the treads
    const c = (o) => (along ? { x: o, y: r.y, w: cheek, d: r.d } : { x: r.x, y: o, w: r.w, d: cheek });
    const lo = along ? r.x - cheek : r.y - cheek, hi = along ? r.x + r.w : r.y + r.d;
    for (const o of [lo, hi]) out.push({ kind: 'stair-cheek', solid: 'wedge', ...c(o), z0, z1: z1 + Math.min(0.5, (z1 - z0) * 0.12), rise, tint: cheekTint || tint });   // a little proud, in proportion
  }
  return out;
}
