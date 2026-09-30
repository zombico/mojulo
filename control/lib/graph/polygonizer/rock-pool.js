/**
 * rock-pool — many rocks for the memory of a few. A scatter of N boulders is K pooled
 * `rock` templates (unit size, base seated at z = 0, each baked at its own yaw in the scene's light) stamped N times
 * through the `repeats` channel: one shared mesh per variant in the World (InstancedMesh), the .glb (shared mesh +
 * nodes), USD (PointInstancer) and 3MF. Instances only translate and scale uniformly, never yaw: baked light would
 * rotate with them, so the variety is in the variants, not the transforms.
 *
 * `detail` is the rock's `octaves`; 0 is the block alone, emitted as its exact convex polytope (about a dozen faces:
 * the far level of detail, and what the CSS scene expands per instance).
 *
 * Pure and deterministic: seeds are hashed from the caller's seed string and the variant index.
 */
import { fieldToFaces } from './field-faces.js';
import { rockBlockFaces } from './rock-fracture.js';
import { shadeHexMat } from './vexar.js';

function hashSeed(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const yawed = (p, deg) => { const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]]; };

/**
 * K templates of a rock: [{ faces }]. `tone` (a hex) tints every face (the art-directed palette read) and skips the
 * grain; without it the rock's own modal mean colours it.
 */
export function rockPool({ rock, variants = 6, detail = 2, tone = null, seed = 'rocks', light, aspect, group = 'rocks' }) {
  const pool = [];
  for (let k = 0; k < variants; k++) {
    const yaw = (k * 360) / variants;
    const shape = { kind: 'rock', center: [0, 0, 0], size: 1, unit: 'm', rock, seed: hashSeed(`${seed}::rock::${k}`) % 1000000, octaves: detail, color: tone ? false : 'mean', ...(aspect ? { aspect } : {}) };
    let faces;
    if (detail === 0) {
      faces = rockBlockFaces(shape).map((f) => {
        const n = yawed(f.normal, yaw);
        return { corners: f.corners.map((p) => yawed(p, yaw)), fill: shadeHexMat(tone || f.tint, n, null, light ? { light } : {}), outNormal: n, doubleSided: true, group };
      });
    } else {
      faces = fieldToFaces({ terms: [{ id: group, op: 'add', shape }, { op: 'transform', rotate: [0, 0, yaw] }], cells: 24 + 8 * detail, ...(tone ? { tint: tone } : {}) }, light ? { light } : {})
        .map((f) => ({ ...f, group }));
    }
    let lo = Infinity; for (const f of faces) for (const p of f.corners) if (p[2] < lo) lo = p[2];
    pool.push({ faces: faces.map((f) => ({ ...f, corners: f.corners.map((p) => [p[0], p[1], p[2] - lo]) })) });
  }
  return pool;
}

/**
 * Place items ({ x, y, z0, size }) as repeats of a pool: an item's variant comes from its index, its instance sits
 * `sink` of its size into the ground and scales to `size`. → [{ template, transforms, group }] (variants in use only).
 */
export function rockRepeats(pool, items, { sink = 0.2, group = 'rocks' } = {}) {
  const out = pool.map((p) => ({ template: p.faces, transforms: [], group }));
  items.forEach((it, i) => { out[i % pool.length].transforms.push({ pos: [it.x, it.y, it.z0 - sink * it.size * 0.66], scale: it.size }); });
  return out.filter((r) => r.transforms.length);
}

/** Repeats → a plain face list (for a renderer without instancing, e.g. the CSS scene). */
export function expandRepeats(repeats) {
  const faces = [];
  for (const r of repeats) for (const t of r.transforms) {
    const s = t.scale ?? 1;
    for (const f of r.template) faces.push({ ...f, corners: f.corners.map((p) => [t.pos[0] + p[0] * s, t.pos[1] + p[1] * s, t.pos[2] + p[2] * s]) });
  }
  return faces;
}
