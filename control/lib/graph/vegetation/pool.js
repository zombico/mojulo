/**
 * vegetation/pool — many grown plants for the memory of a few, the plant twin of polygonizer/rock-pool.js. A species
 * is K grown variants × four levels of detail, each baked in the scene's light and stamped N times through `repeats`
 * (one template, N transforms: translate + uniform scale + optional tint). Never yaw: the light is baked, so variety
 * lives in the variants (each baked at its own yaw, or grown leaning its own way).
 *
 * Kinds (docs/vegetation.md has the science):
 *   tree  — grown by the self-organizing engine (grow.js) with a Hallé–Oldeman architecture; unit height, so an
 *           instance scales to its height (elastic similarity is close enough within a species' range);
 *   palm  — grown to an AGE (palm.js): a palm's girth never grows, so a young palm is not a small old one; variants by
 *           age, placed in metres, scaled at most ±8%;
 *   culm  — a bamboo culm (bamboo.js): the culm (a lathe) and its foliage are two templates, each picking its level by
 *           its own ruler (the culm's diameter on screen, the leaf's length); age is a per-instance tint, and
 *           first-year culms use their own wax-ringed variant;
 *   tuft  — a tuft of reed culms from the same builder, one level.
 *   conifer — spruce, silver fir, Scots pine grown by rule (conifer.js), with needles as shoots and far levels from the
 *           crown's own envelope (conifer-mesh.js); unit height like a tree, and the pool it makes IS a tree pool
 *           (kind 'tree'), so placement, the page channel and the exports take it unchanged.
 *
 * Growth is deterministic, so it is cached in-process by its inputs (a tree takes 0.5–1.5 s to grow).
 */
import { shadeHexMat } from '../polygonizer/vexar.js';
import { grow, measure, ARCHITECTURES } from './grow.js';
import { ladder } from './ladder.js';
import { growPalm, palmLadder } from './palm.js';
import { growCulm, culmLadder, culmTris, foliageTris, ageTint, runningGrove, clumpGrove, BAMBOOS } from './bamboo.js';
import { growConifer } from './conifer.js';
import { coniferLadder } from './conifer-mesh.js';
import { LEVELS, SPECIES } from './species.js';
import { barkTile, palmTrunkTexture } from './tiles.js';
import { FIGS } from './ficus.js';

export { LEVELS, SPECIES };
/** Projected-size thresholds (px) at which each level starts: trees and palms by height, culms by diameter and leaf. */
export const LEVEL_PX = Object.freeze({
  height: { L0: 0, L1: 40, L2: 110, L3: 300 },
  culm: { L0: 0, L1: 1.2, L2: 4, L3: 24 },
  leaf: { L0: 0, L1: 0.5, L2: 3.5, L3: 12 },
});

function hashSeed(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const hex = (c) => `#${c.map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('')}`;
const rotZ = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a), p[2]];
function faceNormal(c) {
  const u = [c[1][0] - c[0][0], c[1][1] - c[0][1], c[1][2] - c[0][2]], v = [c[2][0] - c[0][0], c[2][1] - c[0][1], c[2][2] - c[0][2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const l = Math.hypot(...n) || 1; return [n[0] / l, n[1] / l, n[2] / l];
}
/**
 * Triangles ({ p, c, kind }) → World faces with the light baked; a leaf shows its lit side. A bark quad ({ q, uv, n, c,
 * key }) becomes a textured face: `fill` is white lit (the page multiplies the tile by it) and `plainFill` its tile's
 * mean colour lit, for a consumer that cannot draw the tile.
 */
export function trisToFaces(tris, { light = null, yaw = 0, scale = 1, group = 'plants' } = {}) {
  const out = new Array(tris.length); const lit = light ? { light } : {};
  for (let i = 0; i < tris.length; i++) {
    const t = tris[i];
    if (t.q) {
      const corners = t.q.map((q) => { const r = rotZ(q, yaw); return [r[0] * scale, r[1] * scale, r[2] * scale]; }); const n = rotZ(t.n, yaw);
      out[i] = { corners, fill: shadeHexMat('#ffffff', n, null, lit), plainFill: shadeHexMat(hex(t.c), n, null, lit), texture: t.key, textureLit: true, uv: t.uv, outNormal: n, doubleSided: true, group };
      continue;
    }
    const corners = t.p.map((q) => { const r = rotZ(q, yaw); return [r[0] * scale, r[1] * scale, r[2] * scale]; });
    // a tri may carry its own normal (a grass tuft lit as one volume); else its face's, a leaf's lit side up
    let n = t.n ? rotZ(t.n, yaw) : faceNormal(corners); if (!t.n && t.kind === 'leaf' && n[2] < 0) n = [-n[0], -n[1], -n[2]];
    out[i] = { corners, fill: shadeHexMat(hex(t.c), n, null, lit), outNormal: n, doubleSided: true, group };
  }
  return out;
}

// in-process cache of grown ladders (triangles, before light): deterministic in its key, capped
const CACHE = new Map(); const CACHE_MAX = 48;
function cached(key, make) {
  if (CACHE.has(key)) { const v = CACHE.get(key); CACHE.delete(key); CACHE.set(key, v); return v; }
  const v = make(); CACHE.set(key, v); if (CACHE.size > CACHE_MAX) CACHE.delete(CACHE.keys().next().value); return v;
}
const cut = (lad, maxLevel) => Object.fromEntries(LEVELS.map((l) => [l, LEVELS.indexOf(l) <= LEVELS.indexOf(maxLevel) ? lad[l] : lad[maxLevel]]));

/**
 * K variants of a species, baked: { species, kind, variants: [{ height, D0?, leafLen?, wax?, levels | parts }], textures }.
 * `textures` ({ key: data URL }) holds the tiles its templates wear (a tree's bark); a payload carries them beside
 * its repeats.
 * `maxLevel` caps the detail a template may carry (an oak's full-detail level is ~80k triangles: a hero, not a pool).
 */
export function plantPool({ species, variants = 3, seed = 'plants', light = null, maxLevel = 'L2', group = null } = {}) {
  const S = SPECIES[species]; if (!S) throw new Error(`unknown species '${species}' (one of ${Object.keys(SPECIES).join(', ')})`);
  const g = group || species; const out = { species, kind: S.kind, variants: [], textures: {} };
  if (S.kind === 'tree') {
    // the trunk and limbs thicker than 6 cm wear the species' bark tile in the near levels
    const tile = S.bark ? barkTile(S.bark) : null; if (tile) out.textures[tile.key] = tile.url;
    const bark = tile ? { minR: 0.03, tile: tile.metres, color: tile.mean, key: tile.key } : null;
    for (let k = 0; k < variants; k++) {
      const sd = hashSeed(`${seed}::${species}::${k}`) % 100000;
      const arch = S.fig ? FIGS[S.fig] : S.leafLife ? { ...ARCHITECTURES[S.arch], leafLife: S.leafLife } : S.arch;
      const grown = cached(`tree:${S.arch}:${S.years}:${sd}:${S.leafScale}:${S.bark || ''}${S.leafLife ? `:${S.leafLife}` : ''}${S.fig ? `:fig-${S.fig}` : ''}`, () => { const p = grow(arch, { years: S.years, seed: sd }); const H = measure(p).height; return { H, lad: ladder(p, H, { leafScale: S.leafScale, bark }) }; });
      const yaw = (k * 2 * Math.PI) / variants; const lad = cut(grown.lad, maxLevel);
      out.variants.push({ height: 1, grownHeight: grown.H, levels: Object.fromEntries(LEVELS.map((l) => [l, trisToFaces(lad[l], { light, yaw, scale: 1 / grown.H, group: `${g}-${l}` })])) });
    }
  } else if (S.kind === 'conifer') {
    const tiles = { low: barkTile(S.bark), ...(S.barkHigh ? { high: barkTile(S.barkHigh) } : {}) };
    for (const t of Object.values(tiles)) out.textures[t.key] = t.url;
    out.kind = 'tree';
    for (let k = 0; k < variants; k++) {
      const sd = hashSeed(`${seed}::${species}::${k}`) % 100000;
      const grown = cached(`conifer:${S.conifer}:${S.stand}:${sd}`, () => { const p = growConifer(S.conifer, { seed: sd, stand: S.stand }); return { H: p.H, lad: coniferLadder(p, S.conifer, { barks: tiles }) }; });
      const yaw = (k * 2 * Math.PI) / variants; const lad = cut(grown.lad, maxLevel);
      out.variants.push({ height: 1, grownHeight: grown.H, levels: Object.fromEntries(LEVELS.map((l) => [l, trisToFaces(lad[l], { light, yaw, scale: 1 / grown.H, group: `${g}-${l}` })])) });
    }
  } else if (S.kind === 'palm') {
    S.ages.slice(0, Math.max(1, variants)).forEach((age, k) => {
      const sd = hashSeed(`${seed}::${species}::${k}`) % 100000;
      // its trunk wears its own surface (scar rings, the leaf-base lattice) in the near levels, unrolled over its length
      const grown = cached(`palm:${S.palm}:${age}:${sd}:tex`, () => {
        const p = growPalm(S.palm, { years: age, seed: sd, hand: k % 2 ? -1 : 1 }); const t = palmTrunkTexture(p, `trunk-${S.palm}-${age}-${sd}`);
        return { H: p.nodes.at(-1).pos[2], lad: palmLadder(p, { tex: { key: t.key, length: t.length, color: t.mean } }), tex: t };
      });
      out.textures[grown.tex.key] = grown.tex.url;
      const lad = cut(grown.lad, maxLevel); const yaw = (k * 2 * Math.PI) / S.ages.length;
      out.variants.push({ height: grown.H, age, levels: Object.fromEntries(LEVELS.map((l) => [l, trisToFaces(lad[l], { light, yaw, group: `${g}-${l}` })])) });
    });
  } else if (S.kind === 'culm') {
    // by size, a first-year culm with its wax ring, and for a clumping bamboo culms grown leaning outward (14° and 24°,
    // six azimuths): a clump's inner culms stand and its outer ones lean out; light is baked, so a lean is a variant,
    // never a yaw
    const sizes = [...S.sizes.slice(0, Math.max(1, variants)).map((size) => ({ size, wax: false })), { size: 1, wax: true }];
    if (BAMBOOS[S.bamboo].habit === 'clumping') for (const lean of [14, 24]) for (let a = 0; a < 360; a += 60) sizes.push({ size: 1, wax: false, lean, az: a });
    sizes.forEach(({ size, wax, lean = null, az = 0 }, k) => {
      const sd = hashSeed(`${seed}::${species}::${k}`) % 100000;
      const grown = cached(`culm:${S.bamboo}:${size}:${wax}:${lean}:${az}:${sd}`, () => { const c = growCulm(S.bamboo, { seed: sd, size, age: wax ? 0.5 : 4, ...(lean !== null ? { lean, az } : {}) }); return { H: c.height, D0: c.D[0], lad: culmLadder(c, { wax }) }; });
      const yaw = lean !== null ? 0 : (k * 2 * Math.PI) / sizes.length;
      const part = (which) => { const lad = cut(grown.lad[which], maxLevel); return Object.fromEntries(LEVELS.map((l) => [l, trisToFaces(lad[l], { light, yaw, group: `${g}-${which}-${l}` })])); };
      out.variants.push({ height: grown.H, size, wax, ...(lean !== null ? { lean, az } : {}), D0: grown.D0, leafLen: BAMBOOS[S.bamboo].leafLen, parts: { culm: part('culm'), foliage: part('foliage') } });
    });
  } else {                                                                                  // tuft
    for (let k = 0; k < Math.max(1, variants); k++) {
      const tris = cached(`tuft:${S.bamboo}:${S.stems}:${seed}:${k}`, () => {
        const acc = [];
        for (let q = 0; q < S.stems; q++) {
          const c = growCulm(S.bamboo, { seed: hashSeed(`${seed}::${species}::${k}::${q}`) % 100000, size: 0.8 + (0.35 * ((q * 7) % 5)) / 4, age: 0.5, lean: 2 + (q % 4) * 3, az: q * 67 + k * 20 });
          const off = [0.28 * Math.cos(q * 2.4) * Math.sqrt(q), 0.28 * Math.sin(q * 2.4) * Math.sqrt(q), 0];
          for (const t of [...culmTris(c, { mode: 'plain', sides: 3, segs: 5 }), ...foliageTris(c, { mode: 'fans' })]) acc.push({ ...t, p: t.p.map((p) => [p[0] + off[0], p[1] + off[1], p[2]]) });
        }
        return acc;
      });
      const H = BAMBOOS[S.bamboo].H; const faces = trisToFaces(tris, { light, yaw: (k * Math.PI) / 3, scale: 1 / H, group: `${g}` });
      out.variants.push({ height: 1, levels: Object.fromEntries(LEVELS.map((l) => [l, faces])) });
    }
  }
  return out;
}

/**
 * A bamboo item (a scene's tree, standing where one culm would) as the grove it stands for: a clump of a clumping
 * bamboo (clumpGrove: 50–90 culms, leaning out) or a patch of a running one (runningGrove, about 6,500 culms/ha), grown
 * in metres and laid into the scene's units by the item's height (a culm of the species' height is the item's height).
 * Each culm stands on `groundAt(x, y)` and is dropped below `water`. → items { x, y, z0, height, age, lean?, az? };
 * any other species returns [item].
 */
export function groveItems(species, item, { groundAt = null, water = null, seed = 'grove', index = 0 } = {}) {
  const S = SPECIES[species]; if (!S || S.kind !== 'culm') return [item];
  const B = BAMBOOS[S.bamboo]; const k = item.height / B.H; const sd = hashSeed(`${seed}::grove::${species}::${index}`) % 100000;
  let culms;
  if (B.habit === 'clumping') {
    const g = clumpGrove({ W: 24, D: 24, clumps: 1, years: 12, seed: sd, minGap: 0 }); const c0 = g.centres[0];
    culms = g.culms.map((c) => ({ dx: c.pos[0] - c0[0], dy: c.pos[1] - c0[1], size: c.size, age: c.age, lean: c.lean, az: c.az }));
  } else {
    const W = Math.max(12, (1.6 * (item.width || item.height * 0.5)) / k);
    const g = runningGrove({ W, D: W, years: 16, founders: 4, seed: sd });
    culms = g.culms.filter((c) => Math.hypot(c.pos[0] - W / 2, c.pos[1] - W / 2) < W / 2).map((c) => ({ dx: c.pos[0] - W / 2, dy: c.pos[1] - W / 2, size: c.size, age: c.age }));
  }
  const out = [];
  for (const c of culms) {
    const x = item.x + c.dx * k, y = item.y + c.dy * k; const z0 = groundAt ? groundAt(x, y) : item.z0;
    if (water !== null && z0 < water) continue;
    out.push({ x, y, z0, height: B.H * c.size * k, age: c.age, ...(c.lean !== undefined ? { lean: c.lean, az: c.az } : {}) });
  }
  return out;
}

/**
 * Place items ({ x, y, z0, height, age? }) as repeats of a pool. With an `eye` (and `focalPx`), each item's level is
 * picked by the size it projects to, capped at `level`; with `eyes` ([{ pos, focalPx }], a scene's bookmarks), by the
 * largest size any of them sees it at, so a tree near any bookmark has the detail that bookmark needs. With neither,
 * every item takes `level`. A `budget` (faces drawn, summed over the instances) then spends what the thresholds left
 * unspent: the items seen largest step up a level first, round after round, until the budget or the cap. A scene of a
 * few dozen trees gets the cap everywhere; a forest keeps the ladder. A palm or culm is scaled at most ±8% from the
 * variant grown nearest its height (girth does not follow height); `clamp: false` lets it scale freely, for a scene
 * whose units are not metres. → { repeats, stats }.
 */
export function plantRepeats(pool, items, { eye = null, eyes = null, focalPx = 1000, level = 'L1', budget = null, sink = 0.05, clamp = true } = {}) {
  const byLevel = { L0: 0, L1: 0, L2: 0, L3: 0 };
  const cap = LEVELS.indexOf(level); const pick = (px, T) => { let lv = 'L0'; for (const l of LEVELS) if (px >= T[l] && LEVELS.indexOf(l) <= cap) lv = l; return lv; };
  const fit = (want, have) => (clamp ? Math.max(0.92, Math.min(1.08, want / have)) : want / have);
  const views = eyes && eyes.length ? eyes : eye ? [{ pos: eye, focalPx }] : null;
  const projected = (size, p) => {
    let m = 0;
    for (const v of views) { const e = v.pos, d = Math.max(1e-6, Math.hypot(p[0] - e[0], p[1] - e[1], p[2] - e[2])), px = (size * v.focalPx) / d; if (px > m) m = px; }
    return m;
  };
  // one slot per template an item takes (a culm takes two: the culm and its foliage, each by its own ruler)
  const slots = [];
  const slot = (levels, key, group, size, at, T, t, counted) => {
    const px = views ? projected(size, at) : 0;
    slots.push({ levels, key, group, px, lv: LEVELS.indexOf(views ? pick(px, T) : level), t, counted });
  };
  items.forEach((it, i) => {
    const pos = [it.x, it.y, it.z0 - sink];
    if (pool.kind === 'tree' || pool.kind === 'tuft') {
      const k = i % pool.variants.length; const v = pool.variants[k]; const h = it.height;
      slot(v.levels, (l) => `${k}:${l}`, (l) => `${pool.species}-${l}`, h, [it.x, it.y, it.z0 + h / 2], LEVEL_PX.height, { pos, scale: h }, true);
    } else if (pool.kind === 'palm') {
      let k = 0; pool.variants.forEach((v, j) => { if (Math.abs(Math.log(it.height / v.height)) < Math.abs(Math.log(it.height / pool.variants[k].height))) k = j; });
      const v = pool.variants[k]; const s = fit(it.height, v.height);
      slot(v.levels, (l) => `${k}:${l}`, (l) => `${pool.species}-${l}`, v.height * s, [it.x, it.y, it.z0 + v.height / 2], LEVEL_PX.height, { pos, scale: s }, true);
    } else {                                                                                // culm
      // a first-year culm wears the wax variant; a culm leaning out of its clump (it.lean > 9°, it.az in degrees) the
      // variant nearest its lean and way; any other the upright variant nearest its height
      const young = (it.age ?? 4) < 1; const leaning = !young && Number.isFinite(it.lean) && it.lean > 9 && pool.variants.some((v) => v.lean);
      const cands = pool.variants.map((v, j) => ({ v, j })).filter(({ v }) => v.wax === young && !!v.lean === leaning);
      const off = (v) => (leaning ? Math.abs((((it.az ?? 0) - v.az + 540) % 360) - 180) / 30 + Math.abs(it.lean - v.lean) / 6 : 0) + Math.abs(Math.log(it.height / v.height));
      let best = cands[0]; for (const c of cands) if (off(c.v) < off(best.v)) best = c;
      const { v, j } = best; const s = fit(it.height, v.height); const tint = it.age !== undefined && !young ? ageTint(SPECIES[pool.species].bamboo, it.age) : null;
      slot(v.parts.culm, (l) => `${j}:culm:${l}`, (l) => `${pool.species}-culm-${l}`, v.D0 * s, [it.x, it.y, it.z0 + 1.5], LEVEL_PX.culm, { pos, scale: s, ...(tint ? { tint } : {}) }, true);
      slot(v.parts.foliage, (l) => `${j}:foliage:${l}`, (l) => `${pool.species}-foliage-${l}`, v.leafLen * s, [it.x, it.y, it.z0 + 0.72 * v.height * s], LEVEL_PX.leaf, { pos, scale: s }, false);
    }
  });
  const facesAt = (s, lv) => s.levels[LEVELS[lv]].length;
  let drawn = 0; for (const s of slots) drawn += facesAt(s, s.lv);
  if (budget !== null && views) {
    const order = slots.map((_, q) => q).sort((a, b) => slots[b].px - slots[a].px || a - b);
    for (let stepped = true; stepped;) {
      stepped = false;
      for (const q of order) {
        const s = slots[q]; if (s.lv >= cap) continue;
        const cost = facesAt(s, s.lv + 1) - facesAt(s, s.lv); if (drawn + cost > budget) continue;
        s.lv++; drawn += cost; stepped = true;
      }
    }
  }
  const reps = new Map();
  for (const s of slots) {
    const l = LEVELS[s.lv], key = s.key(l);
    if (!reps.has(key)) reps.set(key, { template: s.levels[l], transforms: [], group: s.group(l) });
    reps.get(key).transforms.push(s.t); if (s.counted) byLevel[l]++;
  }
  const repeats = [...reps.values()].filter((r) => r.template.length);
  return { repeats, stats: { placements: items.length, templates: repeats.length, templateFaces: repeats.reduce((a, r) => a + r.template.length, 0), drawnFaces: drawn, byLevel } };
}
