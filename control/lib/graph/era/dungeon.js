/**
 * THE RPG DUNGEON KITS' DRESSING — one dressing for every dungeon room kit (stage.js STAGE_KITS: deep-forge,
 * fungal-grotto, drowned-shrine, arcane-vault), read off its style card (style/dungeon-kits.js), so a new dungeon is a
 * card and a new thing in it a doodad row here, never a dressing of its own.
 *
 * A kit is a CHAMBER and its HALLS: the largest room the chamber, every other room a hall leading to it. The card says
 * what stands where, by place:
 *   centre    the chamber's set piece, in its middle: { kind, ...its own numbers }
 *   lay       what is laid on the chamber's floor (never `floor`: a kit's dress.floor is the shell's own surface): { kind, of? (its share of the chamber's length), place?: 'end', ... }
 *             (a channel beside the walk, a flood across it, a pool toward its far end, a rune circle round its middle)
 *   walls     the chamber's wall bases between its pilasters: { kinds: [doodad], share }
 *   corners   the corners of every room: { kinds, share }
 *   hall      a hall's wall bases: { kinds, share }
 *   ceiling   what hangs or floats over a room: { kind, every (m apart), in: 'chamber' | 'halls' | 'all', z? }
 *   light     the colour, reach and strength of what the doodads' own glow casts
 *   materials role → '#hex' (stone, metal, wood, ...; `glow` and `glow2` the self-lit)
 * The places are the corner things' (props.js wallSpots): never in a doorway, on the walking line or on the set piece.
 * Self-lit faces (lab.js lit, group stage:lamp) are drawn after the bake and each glow lays a light. Pure and seeded:
 * the plan alone decides it.
 *
 *   DUNGEON_DOODADS             kind → builder(ctx, p, N, U, s, seed, opts)
 *   dungeonDress(plan, geom)    → the stage's dressing { faces, after, lights, pools, anchors, blends, cut, shadowSkip }
 *   sourceless(dress, reach?)   → the lights no self-lit face of it gives (the law 'light-has-a-source'; none, it holds)
 */
import { P, r5, panel, hexRgb, lathe } from './geom.js';
import { obox, wallSpots } from './props.js';
import { lit } from './lab.js';
import { hash3 } from './dirt.js';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const mix = (a, b, t) => a + (b - a) * t;
const Z = [0, 0, 1];

// ── the parts every doodad is made of ──
// (a material by its role on the card: a plain tinted surface, baked with the room)
const surfOf = (ctx, role, k = 1) => ({ key: null, scale: 1, tint: hexRgb(ctx.M[role] ?? '#808080').map((c) => r5(Math.min(1, c * k))), group: 'stage:prop' });
// (a box standing on the floor at `p`, its long side along `A`)
const stand = (ctx, p, A, w, d, h, role, z = 0, k = 1) => { const a = unit([A[0], A[1], 0]), b = unit(cross(Z, a)); obox(ctx.out, add(p, [0, 0, z + h / 2]), a, b, Z, [w / 2, d / 2, h / 2], surfOf(ctx, role, k), 0.5); };
// (a self-lit face, drawn after the bake: its corners, its normal, its role's colour)
const glowFace = (ctx, corners, n, role = 'glow', strength = 3) => ctx.after.push(lit(corners, n, ctx.M[role] ?? '#ffffff', 'stage:lamp', null, strength));
// (a self-lit box: its six faces glowing)
function glowBox(ctx, c, A, B, h, role = 'glow', strength = 3) {
  const C = Z, q = [];
  obox(q, c, A, B, C, h, { key: null, scale: 1, tint: [1, 1, 1], group: 'stage:lamp' }, 1);
  for (const f of q) ctx.after.push(lit(f.corners, f.normal, ctx.M[role] ?? '#ffffff', 'stage:lamp', null, strength));
}
// (a self-lit octahedron, a crystal: `c` its middle, `r` its half width, `h` its half height)
function glowGem(ctx, c, r, h, role = 'glow', strength = 3, yaw = 0) {
  const e = [0, 1, 2, 3].map((k) => { const a = yaw + (k * Math.PI) / 2; return add(c, [Math.cos(a) * r, Math.sin(a) * r, 0]); }), top = add(c, [0, 0, h]), bot = add(c, [0, 0, -h]);
  for (let k = 0; k < 4; k++) for (const tip of [top, bot]) {
    const a = e[k], b = e[(k + 1) % 4], n = unit(cross(sub(b, a), sub(tip, a))), out = tip === top ? n : mul(n, -1);
    ctx.after.push(lit(tip === top ? [a, b, tip] : [b, a, tip], out, ctx.M[role] ?? '#ffffff', 'stage:lamp', null, strength));
  }
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
// (a glow's light: where it is, the card's colour and reach, a share of its strength)
const shine = (ctx, at, share = 1, role = 'glow') => ctx.lights.push({ at: P(at), n: Z, color: ctx.M[role] ?? ctx.L.color, intensity: r5(ctx.L.intensity * share), radius: r5(ctx.L.radius * Math.sqrt(share)), fixture: 'glow' });
// (a flat disc lying at height z, in segments: a coal bed, a pool's face, a ring)
function disc(ctx, c, r, z, role, glow = false, seg = 12, strength = 2.2) {
  for (let k = 0; k < seg; k++) {
    const a0 = (2 * Math.PI * k) / seg, a1 = (2 * Math.PI * (k + 1)) / seg, pts = [[c[0], c[1], z], [c[0] + Math.cos(a0) * r, c[1] + Math.sin(a0) * r, z], [c[0] + Math.cos(a1) * r, c[1] + Math.sin(a1) * r, z]];
    if (glow) glowFace(ctx, pts, Z, role, strength);
    else ctx.out.push({ corners: pts.map(P), normal: Z, outNormal: Z, texture: null, tint: surfOf(ctx, role).tint, group: 'stage:prop' });
  }
}
// (a ring lying at height z: an annulus between r0 and r1, in segments)
function ring(ctx, c, r0, r1, z, role, glow = true, seg = 24, gaps = 0) {
  for (let k = 0; k < seg; k++) {
    if (gaps && k % gaps === gaps - 1) continue;
    const a0 = (2 * Math.PI * k) / seg, a1 = (2 * Math.PI * (k + 1)) / seg, at = (r, a) => [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, z];
    const pts = [at(r0, a0), at(r1, a0), at(r1, a1), at(r0, a1)];
    if (glow) glowFace(ctx, pts, Z, role, 2.4); else ctx.out.push({ corners: pts.map(P), normal: Z, outNormal: Z, texture: null, tint: surfOf(ctx, role).tint, group: 'stage:prop' });
  }
}

// ── THE DOODADS: (ctx, p the foot on the floor, N into the room, U along the wall, s a die, seed, o the card's numbers) ──
export const DUNGEON_DOODADS = Object.freeze({
  // THE DEEP FORGE's
  // the forge itself, the chamber's heart: a stone hearth, its coal bed glowing, a hood stepping up to the vault
  'forge-hearth'(ctx, p, N, U, s, seed, o = {}) {
    const w = o.w ?? 2.6, d = o.d ?? 1.8;
    stand(ctx, p, U, w, d, 0.9, 'stone', 0, 0.85);
    stand(ctx, p, U, w + 0.3, d + 0.3, 0.12, 'stone', 0.9, 0.7);
    for (const [k, sc] of [[0, 0.8], [1, 0.62], [2, 0.44]]) stand(ctx, p, U, (w + 0.2) * sc, (d + 0.2) * sc, 0.8, 'metal', 2.1 + k * 0.8, 0.9);
    // (the hood's legs, the coal under it)
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) stand(ctx, add(p, add(mul(U, sx * (w / 2 - 0.12)), mul(unit(cross(Z, U)), sy * (d / 2 - 0.12)))), U, 0.18, 0.18, 1.1, 'metal', 1.02, 0.8);
    const B = unit(cross(Z, U)), c = add(p, [0, 0, 1.03]);
    glowFace(ctx, [add(c, add(mul(U, -w / 2 + 0.2), mul(B, -d / 2 + 0.2))), add(c, add(mul(U, w / 2 - 0.2), mul(B, -d / 2 + 0.2))), add(c, add(mul(U, w / 2 - 0.2), mul(B, d / 2 - 0.2))), add(c, add(mul(U, -w / 2 + 0.2), mul(B, d / 2 - 0.2)))], Z, 'glow', 3.2);
    shine(ctx, add(p, [0, 0, 1.6]), 1.6);
  },
  // an anvil on its block: a waist, a face, a horn to one side
  anvil(ctx, p, N, U, s, seed) {
    const q = add(p, mul(N, 0.7));
    stand(ctx, q, U, 0.5, 0.5, 0.5, 'wood', 0, 0.8);
    stand(ctx, q, U, 0.32, 0.22, 0.12, 'metal', 0.5);
    stand(ctx, q, U, 0.2, 0.14, 0.14, 'metal', 0.62);
    stand(ctx, q, U, 0.62, 0.22, 0.12, 'metal', 0.76, 1.1);
    stand(ctx, add(q, mul(U, 0.4)), U, 0.2, 0.12, 0.08, 'metal', 0.79, 1.1);
    stand(ctx, add(q, mul(U, 0.54)), U, 0.12, 0.07, 0.05, 'metal', 0.8, 1.1);
  },
  // a mine cart on its wheels, heaped with ore, a vein of it glowing
  'ore-cart'(ctx, p, N, U, s, seed) {
    const q = add(p, mul(N, 0.6)), B = unit(cross(Z, U));
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) obox(ctx.out, add(add(q, add(mul(U, sx * 0.38), mul(B, sy * 0.36))), [0, 0, 0.17]), B, U, Z, [0.03, 0.16, 0.16], surfOf(ctx, 'metal', 0.7), 0.5);
    stand(ctx, q, U, 1.1, 0.72, 0.5, 'wood', 0.18, 0.75);
    stand(ctx, q, U, 1.14, 0.76, 0.06, 'metal', 0.66);
    for (let k = 0; k < 5; k++) stand(ctx, add(q, add(mul(U, (hash3(seed, k, 9001) - 0.5) * 0.7), mul(B, (hash3(seed, k, 9003) - 0.5) * 0.4))), [Math.cos(k), Math.sin(k), 0], 0.28, 0.24, 0.2, 'stone', 0.66 + 0.06 * (k % 2), 0.6);
    glowGem(ctx, add(q, [0, 0, 0.92]), 0.07, 0.11, 'glow2', 2.6, seed);
  },
  // a chain hung from the vault on a beam, a crucible on its hook
  'chain-hoist'(ctx, p, N, U, s, seed, o = {}) {
    const top = ctx.room.h - 0.3, low = o.z ?? 2.6;
    for (let z = low + 0.3; z < top; z += 0.18) stand(ctx, p, (Math.round(z / 0.18) % 2 ? U : N), 0.09, 0.03, 0.14, 'metal', z, 0.9);
    stand(ctx, p, U, 0.12, 0.12, 0.3, 'metal', low);
    lathe(ctx.out, p, [[0.05, low - 0.45], [0.24, low - 0.42], [0.26, low - 0.1], [0.2, low]], 10, surfOf(ctx, 'metal', 0.8), 'stage:prop');
    disc(ctx, p, 0.18, low - 0.06, 'glow', true, 10, 2.6);
  },
  // a rack of hafted tools against the wall: two uprights, a rail, their heads
  'tool-rack'(ctx, p, N, U, s, seed) {
    const q = add(p, mul(N, 0.18));
    for (const sx of [-0.7, 0.7]) stand(ctx, add(q, mul(U, sx)), U, 0.08, 0.08, 1.6, 'wood', 0, 0.8);
    stand(ctx, q, U, 1.5, 0.08, 0.08, 'wood', 1.3, 0.8);
    for (let k = 0; k < 4; k++) { const at = add(q, add(mul(U, -0.5 + k * 0.33), mul(N, 0.06))); stand(ctx, at, U, 0.04, 0.04, 1.25, 'wood', 0.08, 0.7); stand(ctx, at, U, k % 2 ? 0.26 : 0.12, 0.06, 0.16, 'metal', 1.3); }
  },
  // the molten channel: a straight run of glowing metal down the chamber between stone kerbs, lit along its length
  'molten-channel'(ctx, c, A, s, seed, o = {}) {
    const len = o.len ?? 8, w = o.w ?? 0.6, B = unit(cross(Z, A));
    for (const sy of [-1, 1]) stand(ctx, add(c, mul(B, sy * (w / 2 + 0.15))), A, len, 0.3, 0.18, 'stone', 0, 0.7);
    const e = (a, b) => add(c, add(mul(A, a * len / 2), mul(B, b * w / 2)));
    glowFace(ctx, [e(-1, -1), e(1, -1), e(1, 1), e(-1, 1)].map((q) => add(q, [0, 0, 0.06])), Z, 'glow', 3.4);
    for (let t = -0.4; t <= 0.41; t += 0.4) shine(ctx, add(add(c, mul(A, t * len)), [0, 0, 0.5]), 0.7);
  },

  // THE FUNGAL GROTTO's
  // a grove of giant mushrooms: stems, broad caps, their gills glowing under them
  'mushroom-grove'(ctx, p, N, U, s, seed, o = {}) {
    const n = o.n ?? 3;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * 2 * Math.PI + hash3(seed, k, 9101), d = k ? 1.4 : 0, q = add(p, [Math.cos(a) * d, Math.sin(a) * d, 0]);
      const h = mix(2.2, 3.6, hash3(seed, k, 9103)) * (k ? 0.8 : 1), R = mix(1.0, 1.7, hash3(seed, k, 9105)) * (k ? 0.75 : 1);
      lathe(ctx.out, q, [[0.32, 0], [0.24, 0.4], [0.2, h * 0.6], [0.24, h]], 10, surfOf(ctx, 'stem'), 'stage:prop');
      lathe(ctx.out, q, [[0.2, h], [R, h + 0.1], [R * 0.92, h + 0.32], [R * 0.6, h + 0.62], [0, h + 0.75]], 14, surfOf(ctx, 'cap'), 'stage:prop');
      ring(ctx, [q[0], q[1]], 0.25, R * 0.95, h + 0.08, 'glow', true, 14);
      shine(ctx, add(q, [0, 0, h - 0.3]), 0.8);
    }
  },
  // a cluster of small glowing caps where the floor meets the wall
  glowcaps(ctx, p, N, U, s, seed) {
    const q = add(p, mul(N, 0.35)), n = 5 + Math.floor(hash3(seed, 0, 9111) * 4);
    for (let k = 0; k < n; k++) {
      const at = add(q, add(mul(U, (hash3(seed, k, 9113) - 0.5) * 0.9), mul(N, (hash3(seed, k, 9115) - 0.5) * 0.5))), h = mix(0.12, 0.42, hash3(seed, k, 9117)), r = h * 0.45;
      lathe(ctx.out, at, [[0.03, 0], [0.025, h]], 6, surfOf(ctx, 'stem'), 'stage:prop');
      lathe(ctx.out, at, [[0.02, h], [r, h + 0.02], [r * 0.6, h + r * 0.6], [0, h + r * 0.75]], 8, { key: null, scale: 1, tint: hexRgb(ctx.M.glow2 ?? '#88ffcc'), group: 'stage:prop' }, 'stage:prop');
      disc(ctx, at, r * 0.9, h + 0.005, 'glow2', true, 8, 2.8);
    }
    shine(ctx, add(q, [0, 0, 0.4]), 0.45, 'glow2');
  },
  // bracket fungi stepping up the wall, shelf over shelf
  'shelf-fungus'(ctx, p, N, U, s, seed) {
    const B = unit(cross(Z, N));
    for (let k = 0; k < 4; k++) {
      const z = 0.6 + k * mix(0.35, 0.55, hash3(seed, k, 9121)), u = (hash3(seed, k, 9123) - 0.5) * 0.8, r = mix(0.22, 0.42, hash3(seed, k, 9125));
      const c = add(add(p, mul(U, u)), [0, 0, z]);
      for (let j = 0; j < 5; j++) { const a = -Math.PI / 2 + (j + 0.5) * (Math.PI / 5), at = add(c, add(mul(N, Math.sin(a + Math.PI / 2) * r * 0.5 + 0.08), mul(U, Math.cos(a + Math.PI / 2) * r * 0.5))); obox(ctx.out, add(at, [0, 0, 0]), N, B, Z, [r * 0.3, r * 0.25, 0.04], surfOf(ctx, 'cap', 0.9), 0.5); }
      glowFace(ctx, [add(c, add(mul(U, -r * 0.6), mul(N, 0.05))), add(c, add(mul(U, r * 0.6), mul(N, 0.05))), add(c, add(mul(U, r * 0.4), mul(N, r * 0.7))), add(c, add(mul(U, -r * 0.4), mul(N, r * 0.7)))].map((q) => add(q, [0, 0, -0.045])), [0, 0, -1], 'glow', 2.2);
    }
  },
  // roots hung from the vault, a few strands in a knot, twisting as they come down
  roots(ctx, p, N, U, s, seed, o = {}) {
    const top = ctx.room.h - 0.05;
    for (let k = 0; k < 6; k++) {
      const off = [(hash3(seed, k, 9131) - 0.5) * 0.9, (hash3(seed, k, 9133) - 0.5) * 0.9, 0], len = mix(0.9, Math.min(2.6, top - 2.2), hash3(seed, k, 9135));
      let at = add(p, off);
      for (let z = top; z > top - len; z -= 0.3) { at = add(at, [(hash3(seed, k * 31 + Math.round(z * 10), 9137) - 0.5) * 0.12, (hash3(seed, k * 37 + Math.round(z * 10), 9139) - 0.5) * 0.12, 0]); const r = 0.05 * (1 - (top - z) / len) + 0.015; obox(ctx.out, [at[0], at[1], z - 0.15], [1, 0, 0], [0, 1, 0], Z, [r, r, 0.16], surfOf(ctx, 'root'), 0.5); }
      if (k % 2 === 0) glowGem(ctx, [at[0], at[1], top - len - 0.06], 0.035, 0.06, 'glow2', 2.4);
    }
  },
  // spores hanging in the air, small glowing motes at many heights
  spores(ctx, p, N, U, s, seed, o = {}) {
    for (let k = 0; k < 14; k++) { const at = add(p, [(hash3(seed, k, 9141) - 0.5) * 3, (hash3(seed, k, 9143) - 0.5) * 3, mix(0.8, Math.min(4, ctx.room.h - 0.5), hash3(seed, k, 9145))]); glowGem(ctx, at, 0.03, 0.03, 'glow2', 2, k); }
  },
  // a pool of still black water at the chamber's foot, its rim glowing faintly with growth
  'still-pool'(ctx, c, A, s, seed, o = {}) {
    const r = o.r ?? 2.2;
    disc(ctx, c, r, 0.03, 'water', false, 18);
    ring(ctx, c, r, r + 0.25, 0.035, 'glow2', true, 18, 3);
    // (its light the rim's growth, where it glows)
    for (let k = 0; k < 3; k++) { const a = (k / 3) * 2 * Math.PI + 0.3; shine(ctx, [c[0] + Math.cos(a) * (r + 0.12), c[1] + Math.sin(a) * (r + 0.12), 0.35], 0.3, 'glow2'); }
  },

  // THE DROWNED SHRINE's
  // the drowned altar: steps up to a slab, a great shell standing open on it, a pearl glowing in it
  'drowned-altar'(ctx, p, N, U, s, seed, o = {}) {
    for (let k = 0; k < 3; k++) stand(ctx, p, U, 3.2 - k * 0.6, 2.4 - k * 0.5, 0.22, 'stone', k * 0.22, 0.8 + k * 0.05);
    stand(ctx, p, U, 1.4, 0.9, 0.6, 'stone', 0.66, 0.95);
    const B = unit(cross(Z, U)), c = add(p, [0, 0, 1.26]);
    for (let k = 0; k < 9; k++) { const a = Math.PI * (k / 8), at = add(c, add(mul(U, Math.cos(a) * 0.55), [0, 0, Math.sin(a) * 0.55])); obox(ctx.out, at, unit(add(mul(U, -Math.sin(a)), [0, 0, Math.cos(a)])), B, unit(add(mul(U, Math.cos(a)), [0, 0, Math.sin(a)])), [0.13, 0.08, 0.03], surfOf(ctx, 'shell'), 0.5); }
    glowGem(ctx, add(c, [0, 0, 0.18]), 0.13, 0.13, 'glow', 3.4);
    shine(ctx, add(c, [0, 0, 0.6]), 1.4);
  },
  // branching coral at a wall's foot, and a brain coral beside it
  coral(ctx, p, N, U, s, seed) {
    const q = add(p, mul(N, 0.45));
    lathe(ctx.out, add(q, mul(U, -0.35)), [[0.3, 0], [0.32, 0.12], [0.24, 0.3], [0, 0.36]], 10, surfOf(ctx, 'coral2'), 'stage:prop');
    const grow = (at, dir, len, r, depth) => {
      const end = add(at, mul(dir, len)), mid = mul(add(at, end), 0.5), a = unit(dir), b = unit(cross(a, Math.abs(a[2]) > 0.9 ? [1, 0, 0] : Z));
      obox(ctx.out, mid, a, b, unit(cross(a, b)), [len / 2, r, r], surfOf(ctx, 'coral'), 0.5);
      if (depth > 0) for (const t of [-1, 1]) grow(end, unit(add(dir, add(mul(U, t * 0.6), mul(N, (hash3(seed, depth, 9151 + t) - 0.5))))), len * 0.7, r * 0.75, depth - 1);
    };
    grow(add(q, mul(U, 0.2)), Z, 0.45, 0.05, 3);
  },
  // kelp standing up the wall, strands swaying in still water
  kelp(ctx, p, N, U, s, seed) {
    const q = add(p, mul(N, 0.3));
    for (let k = 0; k < 4; k++) {
      let at = add(q, mul(U, (k - 1.5) * 0.28));
      const len = mix(1.8, 3.4, hash3(seed, k, 9161));
      for (let z = 0; z < len; z += 0.35) { const sw = Math.sin(z * 2 + k) * 0.08; const c = add(at, add(mul(N, sw), [0, 0, z + 0.17])); obox(ctx.out, c, U, N, Z, [0.09 * (1 - z / len * 0.5), 0.015, 0.18], surfOf(ctx, 'kelp'), 0.5); }
    }
  },
  // a jellyfish lantern drifting over the room: a glowing bell, its strands hanging
  'jelly-lantern'(ctx, p, N, U, s, seed, o = {}) {
    const z = Math.min(ctx.room.h - 0.8, o.z ?? 3.2) + (hash3(seed, 1, 9171) - 0.5) * 0.6;
    const q = [p[0], p[1], 0];
    const bell = [];
    lathe(bell, q, [[0.32, z], [0.3, z + 0.14], [0.2, z + 0.28], [0, z + 0.34]], 10, { key: null, scale: 1, tint: [1, 1, 1] }, 'stage:lamp');
    for (const f of bell) ctx.after.push(lit(f.corners, f.normal, ctx.M.glow ?? '#88eeff', 'stage:lamp', null, 2.6));
    for (let k = 0; k < 6; k++) { const a = (k / 6) * 2 * Math.PI, at = add(q, [Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0]); glowBox(ctx, [at[0], at[1], z - 0.35], [1, 0, 0], [0, 1, 0], [0.008, 0.008, 0.35], 'glow2', 1.8); }
    shine(ctx, [p[0], p[1], z], 0.8);
  },
  // the flood across the chamber's floor: a still sheet of water, its rim of fallen stones
  flood(ctx, c, A, s, seed, o = {}) {
    const B = unit(cross(Z, A)), L = o.len ?? 8, W = o.w ?? 6, e = (a, b) => add(c, add(mul(A, a * L / 2), mul(B, b * W / 2)));
    ctx.out.push({ corners: [e(-1, -1), e(1, -1), e(1, 1), e(-1, 1)].map((q) => P(add(q, [0, 0, 0.05]))), normal: Z, outNormal: Z, texture: null, tint: surfOf(ctx, 'water').tint, group: 'stage:prop' });
    for (let k = 0; k < 14; k++) { const t = k / 14, side = k % 4, a = side < 2 ? (t * 2 - 1) : (side === 2 ? -1 : 1), b = side < 2 ? (side ? -1 : 1) : (t * 2 - 1); stand(ctx, e(a, b), A, mix(0.3, 0.6, hash3(seed, k, 9181)), mix(0.3, 0.5, hash3(seed, k, 9183)), mix(0.1, 0.25, hash3(seed, k, 9185)), 'stone', 0, 0.8); }
  },

  // THE ARCANE VAULT's
  // the orrery: a pedestal, the glowing sun at its heart, rings of planets round it
  orrery(ctx, p, N, U, s, seed, o = {}) {
    lathe(ctx.out, p, [[0.6, 0], [0.6, 0.2], [0.25, 0.3], [0.18, 1.1], [0.35, 1.25], [0, 1.28]], 12, surfOf(ctx, 'metal'), 'stage:prop');
    const c = add(p, [0, 0, 2.1]);
    glowGem(ctx, c, 0.22, 0.22, 'glow', 3.4);
    lathe(ctx.out, p, [[0.03, 1.25], [0.03, 1.9]], 6, surfOf(ctx, 'metal'), 'stage:prop');
    for (const [r, tilt, pl] of [[0.7, 0.2, 0.12], [1.15, -0.35, 0.16], [1.6, 0.5, 0.1]]) {
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * 2 * Math.PI, at = add(c, [Math.cos(a) * r, Math.sin(a) * r * Math.cos(tilt), Math.sin(a) * r * Math.sin(tilt)]);
        obox(ctx.out, at, [-Math.sin(a), Math.cos(a), 0], [0, 0, 1], unit([Math.cos(a), Math.sin(a), 0]), [r * 0.135, 0.015, 0.015], surfOf(ctx, 'trim'), 0.5);
      }
      const a = hash3(seed, Math.round(r * 10), 9191) * 2 * Math.PI;
      lathe(ctx.out, [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r * Math.cos(tilt), 0], [[0, c[2] + Math.sin(a) * r * Math.sin(tilt) - pl], [pl, c[2] + Math.sin(a) * r * Math.sin(tilt)], [0, c[2] + Math.sin(a) * r * Math.sin(tilt) + pl]], 8, surfOf(ctx, 'planet'), 'stage:prop');
    }
    shine(ctx, c, 1.5);
  },
  // the rune circle the orrery stands in: two rings and the glyphs between them, glowing
  'rune-circle'(ctx, c, A, s, seed, o = {}) {
    const r = o.r ?? 3;
    ring(ctx, c, r - 0.12, r, 0.012, 'glow', true, 32);
    ring(ctx, c, r + 0.5, r + 0.6, 0.012, 'glow', true, 32);
    for (let k = 0; k < 12; k++) { const a = (k / 12) * 2 * Math.PI, m = r + 0.25, at = [c[0] + Math.cos(a) * m, c[1] + Math.sin(a) * m, 0.014], t = [-Math.sin(a), Math.cos(a), 0], rd = [Math.cos(a), Math.sin(a), 0];
      const w = 0.07 + 0.05 * (k % 3), h = 0.14; glowFace(ctx, [add(at, add(mul(t, -w), mul(rd, -h))), add(at, add(mul(t, w), mul(rd, -h))), add(at, add(mul(t, w), mul(rd, h))), add(at, add(mul(t, -w), mul(rd, h)))], Z, 'glow', 2.6); }
    // (its light the runes', on the ring where they burn)
    for (let k = 0; k < 4; k++) { const a = (k / 4) * 2 * Math.PI + 0.4; shine(ctx, [c[0] + Math.cos(a) * (r + 0.25), c[1] + Math.sin(a) * (r + 0.25), 0.4], 0.3); }
  },
  // a tall bookcase in the wall's bay: its frame, shelves, and books of many bindings
  bookcase(ctx, p, N, U, s, seed) {
    const q = add(p, mul(N, 0.24)), W = 1.6, H = 2.6, B = unit(cross(Z, U));
    for (const sx of [-1, 1]) stand(ctx, add(q, mul(U, sx * W / 2)), U, 0.07, 0.42, H, 'wood', 0, 0.8);
    stand(ctx, add(q, mul(N, -0.2)), U, W, 0.04, H, 'wood', 0, 0.6);
    for (let k = 0; k <= 4; k++) stand(ctx, q, U, W, 0.42, 0.05, 'wood', k * (H - 0.05) / 4, 0.85);
    const binds = ['book', 'book2', 'trim'];
    for (let k = 0; k < 4; k++) { let u = -W / 2 + 0.06; while (u < W / 2 - 0.08) { const bw = mix(0.04, 0.09, hash3(seed, k * 97 + Math.round(u * 100), 9201)), bh = mix(0.32, 0.5, hash3(seed, k * 89 + Math.round(u * 100), 9203)); stand(ctx, add(q, add(mul(U, u + bw / 2), mul(N, 0.02))), U, bw, 0.3, bh, binds[Math.floor(hash3(seed, k, Math.round(u * 1000)) * 3)], 0.05 + k * (H - 0.05) / 4, 0.95); u += bw + 0.005; } }
  },
  // a lectern with an open tome, a mote of light over its pages
  lectern(ctx, p, N, U, s, seed) {
    const q = add(p, mul(N, 0.9));
    lathe(ctx.out, q, [[0.25, 0], [0.25, 0.06], [0.07, 0.12], [0.07, 1.0], [0.12, 1.05]], 8, surfOf(ctx, 'wood'), 'stage:prop');
    const c = add(q, [0, 0, 1.12]), a = unit(add(mul(N, -0.5), Z)), b = U;
    obox(ctx.out, c, b, unit(cross(Z, b)), Z, [0.3, 0.22, 0.03], surfOf(ctx, 'wood', 0.9), 0.5);
    glowFace(ctx, [add(c, add(mul(b, -0.27), mul(N, -0.18))), add(c, add(mul(b, 0.27), mul(N, -0.18))), add(c, add(mul(b, 0.27), mul(N, 0.18))), add(c, add(mul(b, -0.27), mul(N, 0.18)))].map((v) => add(v, [0, 0, 0.035])), Z, 'page', 1.6);
    glowGem(ctx, add(c, [0, 0, 0.35]), 0.04, 0.05, 'glow', 3);
    shine(ctx, add(c, [0, 0, 0.4]), 0.35);
  },
  // a cluster of crystals growing from the corner, tall and leaning, glowing
  'crystal-cluster'(ctx, p, N, U, s, seed) {
    const q = add(p, mul(N, 0.4));
    for (let k = 0; k < 5; k++) { const h = mix(0.35, 1.1, hash3(seed, k, 9211)), at = add(q, add(mul(U, (hash3(seed, k, 9213) - 0.5) * 0.7), mul(N, (hash3(seed, k, 9215) - 0.5) * 0.4))); glowGem(ctx, add(at, [0, 0, h * 0.55]), h * 0.16, h * 0.55, k % 2 ? 'glow2' : 'glow', 2.6, k); }
    shine(ctx, add(q, [0, 0, 0.6]), 0.55, 'glow2');
  },
  // a crystal floating under the vault, turning slowly in the air, a ring of light under it
  'floating-crystal'(ctx, p, N, U, s, seed, o = {}) {
    const z = Math.min(ctx.room.h - 0.9, o.z ?? 3.4) + (hash3(seed, 3, 9221) - 0.5) * 0.4;
    glowGem(ctx, [p[0], p[1], z], 0.18, 0.4, 'glow', 3.2, seed);
    ring(ctx, [p[0], p[1]], 0.3, 0.36, z - 0.55, 'glow2', true, 16, 2);
    shine(ctx, [p[0], p[1], z], 0.7);
  },
});
const FLOOR_KINDS = new Set(['molten-channel', 'still-pool', 'flood', 'rune-circle']);

/** LIGHT HAS A SOURCE (era/laws.js 'light-has-a-source'), measured: the dressing's lights that stand by none of its
 * own self-lit faces (none within `reach` m of the light, measured to the face's nearest point). A dungeon's every light is a thing in it
 * that gives it; none hangs from nowhere. → [light] (empty: the law holds) */
export function sourceless(dress, reach = 1.2) {
  return dress.lights.filter((l) => !dress.after.some((f) => faceDistance(f.corners, l.at) <= reach));
}
// (a point's distance to a flat convex face: to the face itself where it falls over it, else to its nearest edge)
function faceDistance(cs, q) {
  const n = unit(cross(sub(cs[1], cs[0]), sub(cs[2], cs[0]))), d = (q[0] - cs[0][0]) * n[0] + (q[1] - cs[0][1]) * n[1] + (q[2] - cs[0][2]) * n[2], p = sub(q, mul(n, d));
  const inside = cs.every((a, i) => { const b = cs[(i + 1) % cs.length], e = cross(sub(b, a), sub(p, a)); return e[0] * n[0] + e[1] * n[1] + e[2] * n[2] >= -1e-9; });
  if (inside) return Math.abs(d);
  let best = Infinity;
  for (let i = 0; i < cs.length; i++) { const a = cs[i], b = cs[(i + 1) % cs.length], ab = sub(b, a), t = Math.max(0, Math.min(1, ((q[0] - a[0]) * ab[0] + (q[1] - a[1]) * ab[1] + (q[2] - a[2]) * ab[2]) / ((ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2) || 1))); best = Math.min(best, Math.hypot(...sub(q, add(a, mul(ab, t))))); }
  return best;
}

/** The rooms of a kit's plan read as a chamber and its halls: the largest room the chamber. */
export function chamberOf(plan) {
  const area = (r) => (r.x1 - r.x0) * (r.y1 - r.y0);
  return plan.rooms.reduce((a, r) => (area(r) > area(a) ? r : a), plan.rooms[0]);
}

/** The dungeon kits' dressing (see the header). */
export function dungeonDress(plan, geom) {
  const D = plan.kit.dress, M = D.materials, L = D.light, out = [], after = [], lights = [], anchors = [];
  const ctx = (room) => ({ out, after, lights, M, L, room });
  const ch = chamberOf(plan), cx = (ch.x0 + ch.x1) / 2, cy = (ch.y0 + ch.y1) / 2, long = ch.x1 - ch.x0 >= ch.y1 - ch.y0, A = long ? [1, 0, 0] : [0, 1, 0];
  const span = long ? ch.x1 - ch.x0 : ch.y1 - ch.y0, across = long ? ch.y1 - ch.y0 : ch.x1 - ch.x0;
  // the set piece in the chamber's middle, kept clear of what stands by the walls
  const keepClear = [];
  if (D.centre) {
    DUNGEON_DOODADS[D.centre.kind](ctx(ch), [cx, cy, 0], [0, 1, 0], A, 0.5, 1, D.centre);
    keepClear.push({ x: cx, y: cy, r: D.centre.clear ?? 2.4 });
    anchors.push({ id: 'set-piece', kind: 'set-piece', form: D.centre.kind, room: ch.id, at: P([cx, cy, 0]), solid: true });
  }
  // what is laid on the chamber's floor: along it (a channel, a flood) or round its middle (a pool, a circle)
  if (D.lay) {
    const F = D.lay, alongIt = F.kind === 'molten-channel' || F.kind === 'flood';
    // (a channel runs beside the walk, a third of the way across; a round thing at the middle, or toward the far end, `place: 'end'`)
    const c = alongIt && F.kind === 'molten-channel' ? [cx + (long ? 0 : (across * 0.3)), cy + (long ? (across * 0.3) : 0), 0]
      : F.place === 'end' ? [cx + A[0] * span * 0.3, cy + A[1] * span * 0.3, 0] : [cx, cy, 0];
    DUNGEON_DOODADS[F.kind](ctx(ch), c, A, 0.5, 2, { ...F, len: r5(span * (F.of ?? 0.7)), w: F.w ?? (F.kind === 'flood' ? r5(across * 0.6) : 0.6) });
    if (F.kind === 'molten-channel') keepClear.push({ x: c[0], y: c[1], r: 0.9 });
    anchors.push({ id: 'floor-feature', kind: 'floor', form: F.kind, room: ch.id, at: P(c) });
  }
  // the walls' and corners' things, at the corner things' spots (never a door, the walk, the set piece)
  const isHall = (id) => id !== ch.id;
  wallSpots(plan, geom.pilasters || [], keepClear).forEach((sp, si) => {
    const room = plan.rooms.find((r) => r.id === sp.room), spec = sp.corner ? D.corners : isHall(sp.room) ? D.hall : D.walls;
    if (!spec || !spec.kinds?.length || hash3(si, 0, 9301) > (spec.share ?? 0.6)) return;
    const kind = spec.kinds[Math.floor(hash3(si, 1, 9303) * spec.kinds.length)], it = sp.items[0];
    if (FLOOR_KINDS.has(kind)) return;
    DUNGEON_DOODADS[kind](ctx(room), it.p, it.N, it.U, hash3(si, 2, 9305), si * 13 + 7, {});
    anchors.push({ id: `thing-${si + 1}`, kind: 'thing', form: kind, room: room.id, at: P(it.p) });
  });
  // what hangs or floats over a room, on a grid `every` metres apart, kept off the walls
  if (D.ceiling) for (const r of plan.rooms) {
    const C = D.ceiling, where = C.in ?? 'all';
    if ((where === 'chamber' && isHall(r.id)) || (where === 'halls' && !isHall(r.id))) continue;
    const e = C.every ?? 4, nx = Math.max(1, Math.floor((r.x1 - r.x0 - 1.5) / e)), ny = Math.max(1, Math.floor((r.y1 - r.y0 - 1.5) / e));
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      const x = r.x0 + (r.x1 - r.x0) * (i + 0.5) / nx, y = r.y0 + (r.y1 - r.y0) * (j + 0.5) / ny;
      if (!isHall(r.id) && D.centre && C.kind !== 'chain-hoist' && Math.hypot(x - cx, y - cy) < 1.2) continue;
      DUNGEON_DOODADS[C.kind](ctx(r), [x, y, 0], [0, 1, 0], [1, 0, 0], hash3(i, j, 9311), i * 31 + j * 17 + 3, C);
    }
  }
  return { faces: out, after, lights, pools: [], anchors, blends: () => [], cut: () => false, shadowSkip: () => false };
}
