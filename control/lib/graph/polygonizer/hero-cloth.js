/**
 * hero-cloth — a hero's loose cloth hung on strings and its swing baked into every clip, so the skinned GLB and the World
 * page play it as they play the body: as bone keys. The mount's hair bake's pattern (mount/hair-bake.js), on the hero's
 * own flow solver (hero-flow.js).
 *
 *   • WHAT FLOWS: every part that says how it moves (a `rigidity` below 1 or a `material`, cloth-law.js): the cloak, a
 *     robe's or a gown's skirt, a card's drape panels, a bow's tails. The hair stays as it is (its own sections are the
 *     solver's too; not yet baked here), a hood is locked to the head, and a card's panels under a flowing cloak keep
 *     their skin (the layers do not collide with each other yet). What is worked on the cloth (a hem's embroidery, a
 *     trim) rides the flowing vertex nearest it.
 *   • THE BUDGET is the register's (cloth-law.js CLOTH_REGISTERS: strings round each curtain, links along each); the
 *     strings are bones appended after the body's, so every bone the body had keeps its index and its keys.
 *   • THE BAKE: each clip sampled at its own keys (the packer's, station-loft-rig.js packLayeredRig), simulated between
 *     them at SIM_HZ (a coarse clip's targets would otherwise jump a leg through the cloth in one step), a cycle run in
 *     until it repeats and its seam faded, a one-shot from rest (simulateClip). The air is the body's own travel (a gait's
 *     ground speed, `speeds`) by the register's share, as a headwind; the result held on the register's `hold`.
 *   • GATED by the hero laws (hero-form.js HERO_LAWS_VERSION 23): a row minted before keeps the clips it had. A hero with
 *     nothing that flows bakes nothing: the rig, the skin and the clips are the ones given, byte for byte.
 *
 *   clothFlows(hero)                         whether its laws hang the cloth on strings
 *   heroClothRig(mesh, recipe, hero)         → flowRig's { R, skin, strings, pairs, form }, or null (nothing flows)
 *   bakeClothClips(H, clips, R, opts)        → the clips, each a function clip carrying its baked `flow` per key
 */
import { flowRig, simulateClip } from './hero-flow.js';
import { layeredClip } from './station-loft-rig.js';
import { CLOTH_REGISTERS, clothRegisterOf, clothRigidity } from './cloth-law.js';

/** the hero laws from which a hero's loose cloth flows */
export const CLOTH_LAWS = 23;
/** the simulation's sampling of a clip between its keys (Hz) */
export const SIM_HZ = 30;
/** the solver's step (s) and the most cycles a loop is run in for before its seam is faded (hero-flow.js simulateClip) */
const SOLVE = Object.freeze({ substep: 1 / 120, settle: 4 });
/** the most bones a pack carries (its joint indices are bytes) */
const MAX_BONES = 256;
/** the World page's seconds for a clip that carries none (the rig preview's period) */
const PAGE_PERIOD = 3;

/** whether a hero's laws hang its loose cloth on strings */
export const clothFlows = (hero) => !!hero && (hero.laws ?? 1) >= CLOTH_LAWS;

/**
 * The cloth's rig: each part that flows hung on the register's strings, the hair locked. Null when nothing flows, when a
 * strand or a curtain finds no hold on the mesh, or when the strings would carry the pack past its bones.
 */
export function heroClothRig(mesh, recipe, hero) {
  const reg = CLOTH_REGISTERS[clothRegisterOf(hero)];
  const flows = Object.entries(recipe.parts || {}).filter(([, p]) => { const r = clothRigidity(p); return r !== null && r < 1; }).map(([n]) => n);
  // cloth under a flowing cloak (a card's drape panels) keeps its skin: the two layers do not collide with each other
  // yet, so a panel swung on its own strand comes out through the cloak over it
  const caped = flows.some((n) => /_cape$/.test(n)), locked = new Set(caped ? flows.filter((n) => /_panel$/.test(n)) : []);
  const pieces = Object.fromEntries(flows.filter((n) => !locked.has(n)).map((n) => [n, Array.isArray(recipe.parts[n].root) ? { links: reg.links } : { strings: reg.strings, links: reg.links }]));
  if (!Object.keys(pieces).length) return null;
  const rec = locked.size ? { ...recipe, parts: Object.fromEntries(Object.entries(recipe.parts).map(([n, p]) => [n, locked.has(n) ? (({ rigidity: _r, material: _m, ...q }) => q)(p) : p])) } : recipe;
  const H = flowRig(mesh, rec, { hair: false, pieces });
  if (!H.strings.length || H.R.bones.length > MAX_BONES) return null;
  ridersOf(mesh, rec, H, new Set(Object.keys(pieces)));
  return { ...H, register: clothRegisterOf(hero) };
}

/** how near (m) an adornment's vertices lie to the cloth it is worked on, at the median, for it to ride that cloth */
const RIDE = 0.025;
/**
 * WHAT IS WORKED ON THE CLOTH rides it: an adornment (`adorn.*`, not a rigid plate) lying on a flowing piece (a hem's
 * embroidery on a skirt, a trim on a cloak) takes, vertex by vertex, the skin of the flowing vertex nearest it, so it
 * swings with the cloth instead of floating where the cloth was. In place on H.skin.
 */
function ridersOf(mesh, recipe, H, flowing) {
  const V = mesh.vertices, cell = RIDE, key = (p) => `${Math.floor(p[0] / cell)},${Math.floor(p[1] / cell)},${Math.floor(p[2] / cell)}`, grid = new Map();
  mesh.provenance.forEach((p, i) => { if (flowing.has(p.part)) { const k = key(V[i]); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); } });
  const nearest = (p) => { let best = -1, bd = Infinity; const c = [0, 1, 2].map((a) => Math.floor(p[a] / cell));
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) for (const j of grid.get(`${c[0] + x},${c[1] + y},${c[2] + z}`) || []) { const d = Math.hypot(V[j][0] - p[0], V[j][1] - p[1], V[j][2] - p[2]); if (d < bd || (d === bd && j < best)) { bd = d; best = j; } }
    return [best, bd]; };
  const byPart = {}; mesh.provenance.forEach((p, i) => { if (/^adorn\./.test(p.part) && !flowing.has(p.part) && !recipe.parts[p.part]?.rigid) (byPart[p.part] ??= []).push(i); });
  for (const ids of Object.values(byPart)) {
    const near = ids.map((i) => nearest(V[i])), d = near.map(([, x]) => x).sort((a, b) => a - b);
    if (!(d[Math.floor(d.length / 2)] < RIDE)) continue;
    ids.forEach((i, q) => { const j = near[q][0]; if (j < 0) return; H.skin.joints[i] = [...H.skin.joints[j]]; H.skin.weights[i] = [...H.skin.weights[j]]; H.skin.dominant[i] = H.skin.dominant[j]; });
  }
}

/**
 * Each clip with its cloth baked: a function clip (its own key count and flags kept) whose pose at each of the packer's
 * keys carries the strings' `flow`. `clips` the pack's clips (keyposes or function clips), `R` the body's rig they were
 * built on, `seconds` and `speeds` the pack's (a clip's duration, a gait's ground speed), `keys` the packer's default count.
 */
export function bakeClothClips(H, clips, R, { seconds = null, speeds = null, keys = 12, register = H.register ?? 'round' } = {}) {
  const reg = CLOTH_REGISTERS[register] ?? CLOTH_REGISTERS.round, out = {};
  for (const [name, clip] of Object.entries(clips || {})) {
    const fn = typeof clip === 'function' ? clip : layeredClip(clip, R);
    const K = typeof clip === 'function' && clip.keys > 0 ? clip.keys : keys, once = fn.once === true, s = seconds?.[name] > 0 ? seconds[name] : PAGE_PERIOD;
    // simulated between the keys: `sub` samples a key, the keys among them
    const sub = Math.max(1, Math.ceil((s * SIM_HZ) / Math.max(1, once ? K - 1 : K))), M = once ? (K - 1) * sub + 1 : K * sub;
    const poses = Array.from({ length: M }, (_, m) => fn(once ? (M > 1 ? m / (M - 1) : 0) : m / M));
    const v = speeds?.[name] > 0 ? speeds[name] : 0, air = [0, -reg.travel * v, 0];
    // a held pose (a stand, a one-key clip): settled once, every key the same
    const still = poses.every((p) => JSON.stringify(p) === JSON.stringify(poses[0]));
    const sim = still ? simulateClip(H, [poses[0]], s, { ...SOLVE, loop: false, air: () => air }) : simulateClip(H, poses, s, { ...SOLVE, loop: !once, air: () => air });
    const flowAt = (k) => (still ? sim[0].flow : sim[(k - (k % reg.hold)) * sub].flow);
    const flows = Array.from({ length: K }, (_, k) => flowAt(k));
    const baked = (phase) => { const k = once ? Math.round(Math.max(0, Math.min(1, phase)) * (K - 1)) : ((Math.round(phase * K) % K) + K) % K; return { ...fn(phase), flow: flows[k] }; };
    out[name] = Object.assign(baked, fn, { keys: K });
  }
  return out;
}
