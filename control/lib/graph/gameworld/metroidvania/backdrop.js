/**
 * THE BACKDROP'S CRAFT (docs/metroidvania-map.md "The backdrop's craft"): in a side view the back wall does the work a
 * dungeon's walls do in 3D. What the eye reads in a room behind the lane, said as principles and measured as laws:
 *
 *   1  the back is the wall          a closed room's back is built, never painted flat: ashlar courses, a plinth along
 *                                    the floor, its structure at the bays (a pillar between cells, a vault or beams
 *                                    under the ceiling)
 *   2  detail by the EYE SEGMENT     a screen is EYE.across × EYE.up eye segments (a glance's worth of wall); every
 *                                    segment of a closed room holds DETAIL.min to DETAIL.max pieces of detail (faces of
 *                                    dress, each counted in every segment it covers), so none reads as a void and none
 *                                    as noise
 *   3  calm behind the play          the band the hero moves in (the lowest of a storey's segments) holds less detail
 *                                    than the bands above it: what she fights reads against it
 *   4  structure, dressing, story    bays dressed by the wall's rhythm (A and B, never three alike, never a pair
 *                                    repeated: era/wall-rhythm.js), and ONE focal piece a room, larger than a bay's,
 *                                    the thing the room is remembered by (a portrait, a statue, a coat of arms)
 *   5  three depths                  the near layer between the lane and the wall (a column, a hanging chain), the wall,
 *                                    and through it (a window's moonlit glass, the night over an open ring)
 *   6  light is pools in the dark    a dark mood: where no lamp reaches the wall falls to its ring's `dark`; light only
 *                                    from sources seen (a sconce, a brazier, a cold lamp, a torch), each a pool that
 *                                    falls off within its `reach`; measured, the share of a storey's wall lit above its
 *                                    dark is POOLS.lit, and a pool's heart stands POOLS.contrast times the dark between
 *   7  every flame glows             a flame is haloed (the page's glow sprites) and dust hangs in its light (motes)
 *   8  the lane reads                the tops she stands on are lighter than the wall behind them
 *   9  a kit, a composition          a ring's rooms draw on one kit (its look's bays, ceiling, near layer, focal piece);
 *                                    each room composed by a seeded hand from its own id, so neighbours differ
 *
 *   EYE, DETAIL, POOLS, BAY_PIECES, FOCAL_PIECES, DETAIL_GROUPS, BACKDROP_LAWS
 *   composeRoom(room, look, { cellsAcross }) → { order: 'ABBA…', focal: { cell, bay } }   the room's bays by the wall's rhythm
 *                                    (seeded by its id), and where its focal piece stands
 *   drawPiece(out, id, at, look, dice)   a piece on the back at a bay: `at` { s, floor, top, x, scale? } (the bay's middle,
 *                                    the storey's floor and the underside of its ceiling, the wall's plane, its size)
 *   backdropLaws(B, D, theme) → [{ id, holds, says, rooms? }]   measured on the box (B: scene.js boxOf's) and its dress
 *                                    (D: dress.js dressBox's faces and plan)
 *
 * Pure: a room's composition from its id, a piece's from its dice.
 */
import { rhythmFaults, wallRhythm } from '../../era/wall-rhythm.js';
import { r5, hexRgb, rgbHex } from '../../era/geom.js';
import { mulberry32 } from '../../city/plan/dice.js';

/** a screen in eye segments: four across, three up (a glance's worth of wall: about two of her heights each way) */
export const EYE = Object.freeze({ across: 4, up: 3 });
/** the detail a closed room's eye segment holds, in faces of dress: none is a void (no glance finds a bare wall), more
 * than `max` is noise */
export const DETAIL = Object.freeze({ min: 1, max: 60 });
/** the pools of light: the share of a storey's wall lit above its dark, and a pool's heart against the dark between */
export const POOLS = Object.freeze({ lit: Object.freeze([0.15, 0.7]), contrast: 2.5 });
/** what counts as detail: the dress's own faces, not the wall's blocks nor the closed parts */
export const DETAIL_GROUPS = Object.freeze(['box:dress', 'box:glass', 'box:lamp', 'box:flame']);
export const BAY_PIECES = Object.freeze({
  arch: 'a pointed window of moonlit glass, its frame and its mullion',
  shelf: 'a shelf of books in a frame, three boards of spines',
  niche: 'a recessed arch and the statue standing in it',
  banner: 'a hanging banner on its rod, edged and striped in its trim',
  arms: 'a coat of arms: a shield and two blades crossed behind it',
  ivy: 'cracked stone, ivy grown over it',
  merlons: 'a parapet\'s teeth against the sky',
});
export const FOCAL_PIECES = Object.freeze({
  portrait: 'a great portrait in a gilt frame: the lord of the castle, looking down',
  statue: 'a broken statue on its plinth, its rubble at its foot',
  arms: 'the house\'s arms, twice a bay\'s size, over the room',
  gargoyle: 'a gargoyle crouched on the parapet against the sky',
});
export const BACKDROP_LAWS = Object.freeze(['eye-detail', 'calm-play', 'bay-rhythm', 'focal', 'depths', 'pools', 'lane-reads']);

const N = Object.freeze({ px: [1, 0, 0] });
const poly = (out, x, pts, fill, group = 'box:dress', extra) => out.push({ corners: pts.map(([s, z]) => [x, s, z].map(r5)), normal: N.px, fill, group, ...(extra || {}) });
const rect = (out, x, s0, s1, z0, z1, fill, group = 'box:dress', extra) => { if (s1 - s0 > 1e-4 && z1 - z0 > 1e-4) poly(out, x, [[s0, z0], [s1, z0], [s1, z1], [s0, z1]], fill, group, extra); };
// a bar from one point to another, `w` wide: a rib, a blade, a crack
const bar = (out, x, a, b, w, fill, group) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = (-dz / l) * (w / 2), nz = (dx / l) * (w / 2); poly(out, x, [[a[0] + nx, a[1] + nz], [b[0] + nx, b[1] + nz], [b[0] - nx, b[1] - nz], [a[0] - nx, a[1] - nz]], fill, group); };
const shade = (hex, k) => rgbHex(hexRgb(hex).map((v) => Math.min(1, v * k)));
const mix = (a, b, k) => rgbHex(hexRgb(a).map((v, i) => v + (hexRgb(b)[i] - v) * k));
const seedOf = (id) => { let h = 2166136261; for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619); return h >>> 0; };
export const diceOf = (id) => mulberry32(seedOf(String(id)));

/** A room's composition: its bays by the wall's rhythm, seeded by its id, and the cell and bay its focal piece takes. */
export function composeRoom(room, look, { cellsAcross = room.rect[2] } = {}) {
  const dice = diceOf(room.id), n = cellsAcross * 2;
  const order = wallRhythm(n, { kinds: look.bays[0] === look.bays[1] ? 1 : 2, pick: dice() });
  const cells = room.rect[2] * room.rect[3];
  // (the focal piece: off the middle, at a third of the room, in its lowest storey)
  const cell = Math.min(room.rect[2] - 1, Math.floor(room.rect[2] / 3)), bay = room.rect[2] === 1 ? Math.floor(dice() * 2) : (dice() < 0.5 ? 0 : 1);
  return { order: Array.isArray(order) ? order.join('') : String(order), focal: { cell, bay }, cells };
}

/** A piece on the back at a bay. */
export function drawPiece(out, id, { s, floor, top, x, scale = 1 }, L, dice) {
  const trim = L.trim, dark = shade(L.back, 0.55), mid = (floor + top) / 2;
  if (id === 'arch') {
    const aw = 3.2, a0 = floor + 2.6, a1 = Math.min(top - aw * 0.85 - 0.9, floor + 8.5);
    poly(out, x, [[s - aw / 2 - 0.35, a0 - 0.35], [s + aw / 2 + 0.35, a0 - 0.35], [s + aw / 2 + 0.35, a1], [s, a1 + aw * 0.85 + 0.45], [s - aw / 2 - 0.35, a1]], trim);
    poly(out, x + 0.01, [[s - aw / 2, a0], [s + aw / 2, a0], [s + aw / 2, a1], [s, a1 + aw * 0.85], [s - aw / 2, a1]], L.glass || '#4b5f86', 'box:glass');
    rect(out, x + 0.02, s - 0.06, s + 0.06, a0, a1 + aw * 0.8, trim);
    rect(out, x + 0.02, s - aw / 2, s + aw / 2, (a0 + a1) / 2 - 0.05, (a0 + a1) / 2 + 0.05, trim);   // (its transom)
    rect(out, x + 0.02, s - aw / 2 - 0.5, s + aw / 2 + 0.5, a0 - 0.55, a0 - 0.3, shade(L.top, 0.8));   // (its sill)
  } else if (id === 'shelf') {
    const w = 4.2, z0 = floor + 2.2, z1 = Math.min(top - 1.2, z0 + 4.2), boards = 3, dz = (z1 - z0) / boards;
    rect(out, x, s - w / 2 - 0.2, s + w / 2 + 0.2, z0 - 0.2, z1 + 0.25, trim);
    rect(out, x + 0.01, s - w / 2, s + w / 2, z0, z1, dark);
    const spines = ['#5a1c22', '#2f3f2a', '#4a3520', '#262c46', '#6b4e2a', '#3a2433'];
    for (let k = 0; k < boards; k++) {
      const zb = z0 + k * dz;
      rect(out, x + 0.02, s - w / 2, s + w / 2, zb, zb + 0.1, trim);
      for (let t = s - w / 2 + 0.1; t < s + w / 2 - 0.3;) {
        const bw = 0.16 + dice() * 0.18, bh = dz * (0.55 + dice() * 0.35);
        if (dice() < 0.12) { t += bw; continue; }   // (a gap where a book was taken)
        rect(out, x + 0.03, t, t + bw - 0.03, zb + 0.1, zb + 0.1 + bh, spines[Math.floor(dice() * spines.length)]);
        t += bw;
      }
    }
  } else if (id === 'niche') {
    const w = 2.8, z0 = floor + 1.4, z1 = Math.min(top - 1.6, floor + 7.4);
    poly(out, x, [[s - w / 2 - 0.3, z0 - 0.3], [s + w / 2 + 0.3, z0 - 0.3], [s + w / 2 + 0.3, z1], [s, z1 + w * 0.6 + 0.3], [s - w / 2 - 0.3, z1]], trim);
    poly(out, x + 0.01, [[s - w / 2, z0], [s + w / 2, z0], [s + w / 2, z1], [s, z1 + w * 0.6], [s - w / 2, z1]], shade(L.back, 0.4));
    const stone = mix(L.stone, '#d8d2c4', 0.35), h = (z1 - z0) * 0.86;
    rect(out, x + 0.02, s - 0.8, s + 0.8, z0, z0 + 0.6, shade(stone, 0.8));
    poly(out, x + 0.02, [[s - 0.55, z0 + 0.6], [s + 0.55, z0 + 0.6], [s + 0.42, z0 + h * 0.78], [s - 0.42, z0 + h * 0.78]], stone);
    rect(out, x + 0.03, s - 0.24, s + 0.24, z0 + h * 0.8, z0 + h * 0.97, stone);
    bar(out, x + 0.03, [s - 0.42, z0 + h * 0.72], [s - 0.7, z0 + h * 0.45], 0.2, shade(stone, 0.92));
  } else if (id === 'banner') {
    const b1 = top - 0.9, b0 = Math.max(floor + 3, b1 - 6.4), c = L.carpet || '#6a1420';
    rect(out, x, s - 1.4, s + 1.4, b1, b1 + 0.15, trim);
    poly(out, x + 0.01, [[s - 1, b1], [s + 1, b1], [s + 1, b0], [s, b0 - 0.9], [s - 1, b0]], c);
    rect(out, x + 0.02, s - 1, s + 1, b1 - 0.2, b1, trim);
    rect(out, x + 0.02, s - 0.12, s + 0.12, b0 + 0.8, b1 - 0.6, trim);
    rect(out, x + 0.02, s - 0.6, s + 0.6, (b0 + b1) / 2 - 0.06, (b0 + b1) / 2 + 0.06, trim);
  } else if (id === 'arms') {
    const k = scale, cz = mid + 0.6, w = 1.6 * k, h = 2 * k;
    bar(out, x, [s - 1.9 * k, cz - 1.7 * k], [s + 1.9 * k, cz + 1.7 * k], 0.22 * k, shade(L.top, 1.05));
    bar(out, x, [s + 1.9 * k, cz - 1.7 * k], [s - 1.9 * k, cz + 1.7 * k], 0.22 * k, shade(L.top, 1.05));
    poly(out, x + 0.01, [[s - w / 2, cz + h / 2], [s + w / 2, cz + h / 2], [s + w / 2, cz - h * 0.1], [s, cz - h / 2 - 0.4 * k], [s - w / 2, cz - h * 0.1]], trim);
    poly(out, x + 0.02, [[s - w / 2 + 0.15, cz + h / 2 - 0.15], [s + w / 2 - 0.15, cz + h / 2 - 0.15], [s + w / 2 - 0.15, cz - h * 0.1], [s, cz - h / 2 - 0.2 * k], [s - w / 2 + 0.15, cz - h * 0.1]], L.carpet || '#6a1420');
    rect(out, x + 0.03, s - 0.1, s + 0.1, cz - h * 0.35, cz + h * 0.4, trim);
  } else if (id === 'ivy') {
    const leaf = ['#2f4a2a', '#3c5a32', '#26402a'];
    let p = [s - 1.6 + dice() * 0.8, top - 0.8];
    for (let k = 0; k < 4; k++) { const q = [p[0] + (dice() - 0.4) * 1.6, p[1] - 1.1 - dice() * 0.8]; bar(out, x, p, q, 0.07, shade(L.back, 0.45)); p = q; }
    for (let k = 0; k < 14; k++) {
      const ls = s - 2.2 + dice() * 4.4, lz = top - 0.6 - dice() * (top - floor) * 0.55, r = 0.18 + dice() * 0.2;
      poly(out, x + 0.02, [[ls - r, lz], [ls, lz + r], [ls + r, lz], [ls, lz - r]], leaf[Math.floor(dice() * leaf.length)]);
    }
  } else if (id === 'portrait') {
    const w = 3.6, z0 = floor + 3, z1 = Math.min(top - 0.9, z0 + 5);
    rect(out, x, s - w / 2 - 0.4, s + w / 2 + 0.4, z0 - 0.4, z1 + 0.4, '#b08a3e');
    rect(out, x + 0.01, s - w / 2, s + w / 2, z0, z1, '#1c1418');
    rect(out, x + 0.02, s - w / 2 + 0.2, s + w / 2 - 0.2, z0 + 0.2, z1 - 0.2, '#2d1e26');
    poly(out, x + 0.03, [[s - 1.3, z0 + 0.2], [s + 1.3, z0 + 0.2], [s + 0.8, z0 + (z1 - z0) * 0.48], [s - 0.8, z0 + (z1 - z0) * 0.48]], '#3a1420');
    // (the lord: his dark hair falling round a pale face, two dark eyes)
    const zf = (k) => z0 + (z1 - z0) * k;
    poly(out, x + 0.03, [[s - 0.7, zf(0.42)], [s + 0.7, zf(0.42)], [s + 0.6, zf(0.82)], [s, zf(0.9)], [s - 0.6, zf(0.82)]], '#1a1014');
    poly(out, x + 0.04, [[s - 0.36, zf(0.52)], [s + 0.36, zf(0.52)], [s + 0.38, zf(0.74)], [s, zf(0.8)], [s - 0.38, zf(0.74)]], '#d8c4b6');
    for (const e of [-0.15, 0.15]) rect(out, x + 0.05, s + e - 0.07, s + e + 0.07, zf(0.66), zf(0.685), '#2a0a10');
    rect(out, x + 0.04, s - 0.5, s + 0.5, z0 - 0.75, z0 - 0.5, '#b08a3e');   // (its name, a gilt plate)
  } else if (id === 'statue') {
    const stone = mix(L.stone, '#cfcac0', 0.22);
    rect(out, x, s - 1.3, s + 1.3, floor, floor + 1.1, shade(stone, 0.75));
    rect(out, x + 0.01, s - 1.5, s + 1.5, floor + 1.1, floor + 1.3, shade(stone, 0.9));
    poly(out, x + 0.02, [[s - 0.7, floor + 1.3], [s + 0.7, floor + 1.3], [s + 0.55, floor + 3.8], [s - 0.55, floor + 3.8]], stone);
    poly(out, x + 0.02, [[s - 0.85, floor + 3.8], [s + 0.85, floor + 3.8], [s + 0.6, floor + 5.6], [s - 0.75, floor + 5.3]], stone);
    bar(out, x + 0.03, [s + 0.6, floor + 5.4], [s + 1.5, floor + 6.6], 0.35, shade(stone, 0.95));   // (an arm raised, its hand gone)
    for (const [ds, w] of [[-2.1, 0.6], [1.9, 0.45], [2.4, 0.3]]) poly(out, x + 0.03, [[s + ds - w, floor], [s + ds + w, floor], [s + ds + w * 0.4, floor + w * 0.9]], shade(stone, 0.85));
  } else if (id === 'gargoyle') {
    const g = shade(L.stone, 0.7), b = floor + 2.2;
    poly(out, x, [[s - 0.9, b], [s + 0.9, b], [s + 0.7, b + 1.2], [s - 0.6, b + 1.3]], g);
    poly(out, x, [[s - 0.6, b + 1.1], [s - 2.2, b + 2.4], [s - 0.4, b + 1.9]], g);
    poly(out, x, [[s + 0.5, b + 1.1], [s + 2, b + 2.3], [s + 0.3, b + 1.9]], g);
    poly(out, x + 0.01, [[s + 0.4, b + 1.2], [s + 1.1, b + 1.4], [s + 1.2, b + 1.9], [s + 0.5, b + 1.9]], g);
    poly(out, x + 0.01, [[s + 0.6, b + 1.9], [s + 0.75, b + 2.35], [s + 0.9, b + 1.9]], g);
  }
}

const lum = (hex) => { const c = hexRgb(hex).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const centre = (f) => { const n = f.corners.length; return f.corners.reduce((a, p) => [a[0] + p[0] / n, a[1] + p[1] / n, a[2] + p[2] / n], [0, 0, 0]); };

/** The backdrop's laws, measured on the box and its dress. */
export function backdropLaws(B, D) {
  const { layout: L, greybox: G } = B, W = G.screen.width, H = G.screen.height, out = [];
  const law = (id, holds, says, rooms) => out.push({ id, holds: !!holds, says, ...(rooms && rooms.length ? { rooms: [...new Set(rooms)] } : {}) });
  const closed = L.rooms.filter((r) => !D.plan[r.id]?.open);
  // count the dress's faces by eye segment, a cell at a time
  const seg = new Map(), cellOf = (s, z) => `${Math.floor(s / W)},${Math.floor(z / H)}`;
  // (a piece counts in every eye segment it covers: a plinth along a whole cell is seen in every glance along it)
  const sw = W / EYE.across, sh = H / EYE.up;
  for (const f of D.faces) {
    if (!DETAIL_GROUPS.includes(f.group)) continue;
    const ss = f.corners.map((p) => p[1]), zs = f.corners.map((p) => p[2]);
    const i0 = Math.floor(Math.min(...ss) / sw + 1e-6), i1 = Math.floor(Math.max(...ss) / sw - 1e-6), j0 = Math.floor(Math.min(...zs) / sh + 1e-6), j1 = Math.floor(Math.max(...zs) / sh - 1e-6);
    for (let gi = i0; gi <= Math.max(i0, i1); gi++) for (let gj = j0; gj <= Math.max(j0, j1); gj++) {
      const cs = Math.floor(gi / EYE.across), cz = Math.floor(gj / EYE.up), k = `${cs},${cz}`;
      const a = seg.get(k) ?? seg.set(k, Array.from({ length: EYE.up }, () => Array(EYE.across).fill(0))).get(k);
      a[gj - cz * EYE.up][gi - cs * EYE.across]++;
    }
  }
  // (2) every eye segment of a closed room's cell holds its detail within the bounds
  const bare = [], busy = [];
  for (const r of closed) for (const c of r.cells) {
    const a = seg.get(`${c[0]},${c[1]}`) ?? Array.from({ length: EYE.up }, () => Array(EYE.across).fill(0));
    const flat = a.flat();
    if (Math.min(...flat) < DETAIL.min) bare.push(r.id);
    if (Math.max(...flat) > DETAIL.max) busy.push(r.id);
  }
  law('eye-detail', !bare.length && !busy.length, bare.length || busy.length ? [bare.length ? `an eye segment bare in ${[...new Set(bare)].join(', ')}` : '', busy.length ? `an eye segment past ${DETAIL.max} pieces in ${[...new Set(busy)].join(', ')}` : ''].filter(Boolean).join('; ') : `every eye segment of every closed room holds ${DETAIL.min} to ${DETAIL.max} pieces of detail (${EYE.across} × ${EYE.up} a screen)`, [...bare, ...busy]);
  // (3) calm behind the play: the play band no busier than the bands above it
  const loud = [];
  for (const r of closed) for (const c of r.cells) {
    const a = seg.get(`${c[0]},${c[1]}`);
    if (!a) continue;
    const low = a[0].reduce((x, y) => x + y, 0), above = a.slice(1).flat().reduce((x, y) => x + y, 0) / (EYE.up - 1);
    if (low > above) loud.push(r.id);
  }
  law('calm-play', !loud.length, loud.length ? `the play band busier than the wall above it in ${[...new Set(loud)].join(', ')}` : 'behind the play the wall is calmer than above it in every closed room', loud);
  // (4) the bays by the wall's rhythm, and a focal piece a room
  const broken = Object.entries(D.plan).filter(([, p]) => p.order && rhythmFaults(p.order).length).map(([id]) => id);
  law('bay-rhythm', !broken.length, broken.length ? `bays out of rhythm in ${broken.join(', ')}` : 'every room\'s bays keep the wall\'s rhythm: never three alike, never a pair repeated', broken);
  const unfocused = L.rooms.filter((r) => (D.plan[r.id]?.focals ?? 0) !== 1).map((r) => r.id);
  law('focal', !unfocused.length, unfocused.length ? `${unfocused.length} room${unfocused.length === 1 ? '' : 's'} without one focal piece: ${unfocused.slice(0, 6).join(', ')}${unfocused.length > 6 ? '…' : ''}` : 'every room holds one focal piece', unfocused);
  // (5) three depths: the near layer, the wall, and through it (glass, or the night)
  const shallow = closed.filter((r) => !(D.plan[r.id]?.near && D.plan[r.id]?.through)).map((r) => r.id);
  law('depths', !shallow.length, shallow.length ? `${shallow.length} closed room${shallow.length === 1 ? '' : 's'} short of three depths: ${shallow.slice(0, 6).join(', ')}${shallow.length > 6 ? '…' : ''}` : 'every closed room shows the near layer, the wall and something through it', shallow);
  // (6) pools in the dark: a storey's wall lit in part, its pools' hearts well above the dark
  const flat = [], washed = [];
  const backs = D.faces.filter((f) => f.group === 'box:back');
  for (const r of closed) for (const c of r.cells) {
    const mine = backs.filter((f) => { const p = centre(f); return Math.floor(p[1] / W) === c[0] && Math.floor(p[2] / H) === c[1]; });
    if (!mine.length) continue;
    const ls = mine.map((f) => lum(f.fill)), lo = Math.min(...ls), hi = Math.max(...ls), share = ls.filter((v) => v > lo * 1.6).length / ls.length;
    if (hi < lo * POOLS.contrast) flat.push(r.id);
    else if (share < POOLS.lit[0] || share > POOLS.lit[1]) washed.push(r.id);
  }
  law('pools', !flat.length && !washed.length, flat.length || washed.length ? [flat.length ? `no pool stands ${POOLS.contrast} times its dark in ${[...new Set(flat)].join(', ')}` : '', washed.length ? `lit outside ${POOLS.lit.join('–')} of its wall in ${[...new Set(washed)].join(', ')}` : ''].filter(Boolean).join('; ') : `light in pools: every storey's wall lit ${POOLS.lit[0] * 100}–${POOLS.lit[1] * 100}% above its dark, each pool ${POOLS.contrast} times the dark between`, [...flat, ...washed]);
  // (8) the lane reads: the tops she stands on lighter than the wall behind them
  const sunk = [];
  const tops = D.faces.filter((f) => (f.group === 'box:stone' || f.group === 'box:ledge') && f.normal[2] > 0.5);
  for (const r of closed) {
    const [c, rr, w, h] = r.rect, inRoom = (p) => p[1] >= c * W && p[1] <= (c + w) * W && p[2] >= rr * H && p[2] <= (rr + h) * H;
    const T = tops.filter((f) => inRoom(centre(f))), K = backs.filter((f) => inRoom(centre(f)));
    if (!T.length || !K.length) continue;
    const t = T.reduce((a, f) => a + lum(f.fill), 0) / T.length, k = K.reduce((a, f) => a + lum(f.fill), 0) / K.length;
    if (t <= k) sunk.push(r.id);
  }
  law('lane-reads', !sunk.length, sunk.length ? `the tops sink into the wall behind them in ${sunk.join(', ')}` : 'in every closed room the tops she stands on are lighter than the wall behind them', sunk);
  return out;
}
