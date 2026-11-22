/**
 * hero-cloth — a hero's loose cloth hung on strings and its swing baked into every clip, so the skinned GLB and the World
 * page play it as they play the body: as bone keys. The mount's hair bake's pattern (mount/hair-bake.js), on the hero's
 * own flow solver (hero-flow.js).
 *
 *   • WHAT FLOWS: every part that says how it moves (a `rigidity` below 1 or a `material`, cloth-law.js): the cloak, a
 *     robe's or a gown's skirt, a card's drape panels, a bow's tails, a hood's liripipe (its long point, a strand of the
 *     hood's cloth). Not the realistic body's cape (kept on its skin: its edges sheared into flaps). The hair stays as it is (its own sections are the solver's too; not yet baked here), a hood's body
 *     is locked to the head (or, worn down, to the shoulders), and a card's panels under a flowing cloak keep
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
import { layeredClip, validateRig } from './station-loft-rig.js';
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
export function heroClothRig(mesh, recipe, hero, plan = null) {
  const reg = CLOTH_REGISTERS[clothRegisterOf(hero)];
  // (the REALISTIC body's tailored robe (outfit laws 2): its skirt below the hips hung on the register's strings, the
  // tailor's own rings their rest, so the trailing leg carries the cloth back and the forward leg pushes it out)
  const skirts = tailoredSkirts(recipe, hero, plan);
  // (the REALISTIC body's cape keeps its skin: hung on strings, its open side edges sheared into angular flaps where the
  // arm carries the cloth draped on it and the strings swing the rest, and the shirt showed through between them; it
  // rides its weights as it did before the hero laws 23, until the strings and the arm share one drape there)
  // (under outfit laws 2 it SWAYS instead: hung on stiff strings below the hanging hand's reach (`top`, CAPE_FROM of the
  // way up from the knee to the hip), its shoulders and its sides, where the arms carry it, kept on their skin, so the
  // edges the arm carries never shear and the swinging hand never comes through it; its lower skirt swings a little)
  const realistic = clothRegisterOf(hero) === 'realistic', sways = realistic && (hero?.outfit?.laws ?? 1) >= 2;
  const kept = (n) => realistic && !sways && /_cape$/.test(n);
  const flows = Object.entries(recipe.parts || {}).filter(([n, p]) => { const r = clothRigidity(p); return r !== null && r < 1 && !kept(n); }).map(([n]) => n);
  // cloth under a flowing cloak (a card's drape panels) keeps its skin: the two layers do not collide with each other
  // yet, so a panel swung on its own strand comes out through the cloak over it
  const caped = flows.some((n) => /_cape$/.test(n)), locked = new Set([...(caped ? flows.filter((n) => /_panel$/.test(n)) : []), ...Object.keys(recipe.parts || {}).filter(kept)]);
  const pieces = Object.fromEntries(flows.filter((n) => !locked.has(n)).map((n) => [n, Array.isArray(recipe.parts[n].root) ? { links: reg.links } : { strings: reg.strings, links: reg.links }]));
  for (const [n, S] of Object.entries(skirts)) pieces[n] = { strings: reg.strings, links: reg.links, ...S };
  if (sways) { const R0 = validateRig(recipe.rig), knee = R0.joints[R0.bones[R0.boneIndex.shankR]?.head]?.[2], hip = R0.joints[R0.bones[R0.boneIndex.thighR]?.head]?.[2], top = knee + CAPE_FROM * (hip - knee);
    for (const n of Object.keys(pieces)) if (/_cape$/.test(n) && Number.isFinite(top)) pieces[n] = { ...pieces[n], top, strings: CAPE_STRINGS, links: 2, rigidity: CAPE_SWAY, carrier: 'pelvis' }; }
  if (!Object.keys(pieces).length) return null;
  const rec = locked.size ? { ...recipe, parts: Object.fromEntries(Object.entries(recipe.parts).map(([n, p]) => [n, locked.has(n) ? (({ rigidity: _r, material: _m, ...q }) => q)(p) : p])) } : recipe;
  const H = flowRig(mesh, rec, { hair: false, pieces, legs: true });
  if (!H.strings.length || H.R.bones.length > MAX_BONES) return null;
  ridersOf(mesh, rec, H, new Set(Object.keys(pieces)));
  return { ...H, register: clothRegisterOf(hero) };
}

/**
 * THE TAILORED SKIRTS (the realistic body, outfit laws 2): each skirt garment of the plan that names its cloth (`material`
 * or `rigidity`), worn by the tailor as rings carried down from its garment's body (body-relational-tailor.js carrySkirt,
 * stations `stSkirt…`), closed round the legs: its host part → { material, rigidity?, carrier: 'pelvis', top } (`top` the
 * skirt's first ring, the hips: above it the tailor's bodice keeps its skin). An open coat's skirt is left on its skin.
 */
export function tailoredSkirts(recipe, hero, plan) {
  const out = {};
  if (clothRegisterOf(hero) !== 'realistic' || !((hero?.outfit?.laws ?? 1) >= 2) || !Array.isArray(plan?.garments)) return out;
  for (const g of plan.garments) {
    if (g.fit !== 'skirt' || (g.material === undefined && g.rigidity === undefined)) continue;
    const G = g.id.replace(/Skirt$/, ''), host = [`${G}_body`, `${G}_torso`, `${G}_pelvis`].find((k) => recipe.parts?.[k]?.stations?.some((st) => /^stSkirt\d/.test(st.id)));
    if (!host || recipe.parts[host].closure !== 'closed' || recipe.parts[host].fronts) continue;
    const P = recipe.parts[host], first = P.stations.filter((st) => /^stSkirt\d/.test(st.id)), zs = first.map((st) => Object.values(st.points).reduce((t, p) => t + p[2], 0) / Object.keys(st.points).length);
    out[host] = { ...(g.material !== undefined ? { material: g.material } : {}), ...(g.rigidity !== undefined ? { rigidity: g.rigidity } : {}), carrier: 'pelvis', top: Math.max(...zs) + 0.004 };
  }
  return out;
}

/** the realistic cape's rigidity as it sways from the hips (cloth-law.js: stiff), whatever its cloth: a mild swing */
export const CAPE_SWAY = 0.8;
/** where the realistic cape's sway starts: this share of the way up from the knee to the hip (below the hand's reach) */
export const CAPE_FROM = 0.6;
/** the strings round the realistic cape's sway: its rings are coarse (the authored cape's), and at the register's twelve most
 * strings found too few of its points to hang from */
export const CAPE_STRINGS = 6;

/** how near (m) an adornment's vertices lie to the cloth it is worked on, at the median, for it to ride that cloth */
const RIDE = 0.025;
/**
 * WHAT IS WORKED ON THE CLOTH rides it: an adornment (`adorn.*`, not a rigid plate) lying on a flowing piece (a hem's
 * embroidery on a skirt, a trim on a cloak) takes, vertex by vertex, the skin of the flowing vertex nearest it, so it
 * swings with the cloth instead of floating where the cloth was. In place on H.skin.
 */
function ridersOf(mesh, recipe, H, flowing) {
  const V = mesh.vertices, P = mesh.provenance, cell = RIDE_CELL, key = (x, y, z) => `${x},${y},${z}`, grid = new Map();
  // (a skirt's own rings only, never the hem turned up inside it (body-garment.js skirtPart: its second half of rings), so
  // the work on its outer face rides the outer face where the two part in a stride)
  const stOf = (p) => Number(/^st(\d+)$/.exec(p.station ?? '')?.[1] ?? -1), last = {};
  P.forEach((p) => { if (flowing.has(p.part) && /_skirt$/.test(p.part)) last[p.part] = Math.max(last[p.part] ?? 0, stOf(p)); });
  const outer = (i) => last[P[i].part] === undefined || stOf(P[i]) <= last[P[i].part] / 2;
  // THE CLOTH'S SURFACE, its triangles by the cells they span (a coarse register's faces are wider than a vertex's reach:
  // read off the nearest vertex, the low-poly robe's hem work lay 3–6 cm from one and never rode the skirt)
  const tris = [];
  mesh.faces.forEach((f) => { if (!flowing.has(P[f[0]].part) || !f.every(outer)) return; for (let q = 1; q + 1 < f.length; q++) tris.push([f[0], f[q], f[q + 1]]); });
  tris.forEach((t, ti) => { const lo = [0, 1, 2].map((a) => Math.floor(Math.min(...t.map((v) => V[v][a])) / cell)), hi = [0, 1, 2].map((a) => Math.floor(Math.max(...t.map((v) => V[v][a])) / cell));
    for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) { const k = key(x, y, z); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(ti); } });
  const nearest = (p) => { let best = null, bd = Infinity; const c = [0, 1, 2].map((a) => Math.floor(p[a] / cell));
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) for (const ti of grid.get(key(c[0] + x, c[1] + y, c[2] + z)) || []) { const r = closest(p, tris[ti].map((v) => V[v])); if (r.d < bd || (r.d === bd && ti < best.ti)) { bd = r.d; best = { ti, w: r.w }; } }
    return [best, bd]; };
  const byPart = {}; P.forEach((p, i) => { if ((/^adorn\./.test(p.part) || /HemWork\w*_/.test(p.part)) && !flowing.has(p.part) && !recipe.parts[p.part]?.rigid) (byPart[p.part] ??= []).push(i); });
  const blend = (t, w) => { const acc = {}; t.forEach((v, k) => H.skin.joints[v].forEach((j, q) => { const x = H.skin.weights[v][q] * w[k]; if (x) acc[j] = (acc[j] || 0) + x; }));
    const e = Object.entries(acc).sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 4), tot = e.reduce((s, [, x]) => s + x, 0), J = [0, 0, 0, 0], W = [0, 0, 0, 0];
    e.forEach(([j, x], k) => { J[k] = Number(j); W[k] = x / tot; }); return [J, W]; };
  for (const ids of Object.values(byPart)) {
    const near = ids.map((i) => nearest(V[i])), d = near.map(([, x]) => x).sort((a, b) => a - b);
    if (!(d[Math.floor(d.length / 2)] < RIDE)) continue;
    ids.forEach((i, q) => { const hit = near[q][0]; if (!hit) return; const [J, W] = blend(tris[hit.ti], hit.w); H.skin.joints[i] = J; H.skin.weights[i] = W; H.skin.dominant[i] = J[0]; });
  }
}
/** the cell (m) the cloth's triangles are filed by, for a worked vertex's nearest */
const RIDE_CELL = 0.06;
/** the nearest point of triangle [a, b, c] to p: its distance and its barycentric weights (Ericson's regions) */
function closest(p, [a, b, c]) {
  const sb = (u, v) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]], dt = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const ab = sb(b, a), ac = sb(c, a), ap = sb(p, a), d1 = dt(ab, ap), d2 = dt(ac, ap);
  const at = (w) => { const q = [0, 1, 2].map((k) => a[k] * w[0] + b[k] * w[1] + c[k] * w[2]); return { d: Math.sqrt(dt(sb(p, q), sb(p, q))), w }; };
  if (d1 <= 0 && d2 <= 0) return at([1, 0, 0]);
  const bp = sb(p, b), d3 = dt(ab, bp), d4 = dt(ac, bp); if (d3 >= 0 && d4 <= d3) return at([0, 1, 0]);
  const vc = d1 * d4 - d3 * d2; if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return at([1 - v, v, 0]); }
  const cp = sb(p, c), d5 = dt(ab, cp), d6 = dt(ac, cp); if (d6 >= 0 && d5 <= d6) return at([0, 0, 1]);
  const vb = d5 * d2 - d1 * d6; if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return at([1 - w, 0, w]); }
  const va = d3 * d6 - d5 * d4; if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / (d4 - d3 + d5 - d6); return at([0, 1 - w, w]); }
  const den = 1 / (va + vb + vc), v = vb * den, w = vc * den; return at([1 - v - w, v, w]);
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
    // (simulated over the seconds its consumers play it: the pack's, which the page and an export both play
    // (hero-gesture.js clothClipSeconds), an act's own clock, else the page's period)
    const K = typeof clip === 'function' && clip.keys > 0 ? clip.keys : keys, once = fn.once === true, s = seconds?.[name] > 0 ? seconds[name] : fn.act?.seconds > 0 ? fn.act.seconds : PAGE_PERIOD;
    // simulated between the keys: `sub` samples a key, the keys among them
    const sub = Math.max(1, Math.ceil((s * SIM_HZ) / Math.max(1, once ? K - 1 : K))), M = once ? (K - 1) * sub + 1 : K * sub;
    const poses = Array.from({ length: M }, (_, m) => fn(once ? (M > 1 ? m / (M - 1) : 0) : m / M));
    const v = speeds?.[name] > 0 ? speeds[name] : 0, air = [0, -reg.travel * v, 0];
    // a held pose (a stand, a one-key clip): settled once, every key the same
    const still = poses.every((p) => JSON.stringify(p) === JSON.stringify(poses[0]));
    const sim = still ? simulateClip(H, [poses[0]], s, { ...SOLVE, loop: false, air: () => air }) : simulateClip(H, poses, s, { ...SOLVE, loop: !once, air: () => air });
    const flowAt = (k) => (still ? sim[0].flow : sim[(k - (k % reg.hold)) * sub].flow);
    const flows = Array.from({ length: K }, (_, k) => flowAt(k));
    const baked = (phase) => { const k = once ? Math.round(Math.max(0, Math.min(1, phase)) * (K - 1)) : ((Math.round(phase * K) % K) + K) % K, p = fn(phase); return { ...p, flow: p.flow ? { ...p.flow, ...flows[k] } : flows[k] }; };
    out[name] = Object.assign(baked, fn, { keys: K });
  }
  return out;
}
