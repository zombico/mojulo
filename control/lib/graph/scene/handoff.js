/**
 * THE ENGINE HANDOFF (the `engine-handoff` theme): what an engine is handed of a mojulo world, written once and read by
 * every engine's adapter (Godot, Unity, Unreal, Blender), never a game's rules. The web is the game, end to end; an
 * engine gets the polygon-level work: the ASSETS (every surface as a material the engine lights, the form render's
 * instances), the ANIMATION (the rigs, clips and faces the GLB already carries) and the LEVELS (layout, light, colliders
 * and markers).
 *
 * It reads the world in the form render (gen-7, era/eras.js): a surface carries its material and its form, never light,
 * which is how an engine lights a scene. The read is unshaded (`handoff: true` lets the form render's land read run under
 * it, worlds/world-scene.js), so a surface not yet built as form leaves as ALBEDO UNLIT: its own colour, no light baked
 * in, under a lit material the engine shades.
 *
 *   resolveHandoff(sketch, { what? }) → { kind, payload, exported, instances, ledger }
 *     what      'level' (a world, default) | 'asset' (one thing by ref)
 *     exported  facesToGlb's result: the GLB, lit (glTF metal-rough, no unlit extension), the instances in it
 *     ledger    { version, era, what, carried: { faces, instances: { <set>: n } }, stays: [what stayed the web's] }
 *   stoneInstances(stones) → [instance set]: the form land's scree stones (form/land-stones.js), one set per shape, size
 *     and tone, each stone a node turned to its ground's normal and yawed by its index, as the World page stands them
 *
 * Built so far: the albedo floor and the scree's stones. The land's layers, the dressed faces' relief, the bark, the
 * plants, the rooms, the environment and the markers join as their phases land.
 */
import { resolveWorldScene } from '../worlds/world-scene.js';
import { facesToGlb } from './scene-gltf.js';
import { stoneForms } from '../form/land-stones.js';

export const HANDOFF_VERSION = 'handoff/0';
export const HANDOFF_WHATS = Object.freeze(['level', 'asset']);
/** The form render the handoff reads, whatever the recipe's own era. */
export const HANDOFF_ERA = 'gen-7';

// (what the page draws that the handoff does not carry yet: each leaves the ledger as the phase that adds it lands)
const STAYS = Object.freeze([
  'the land\'s layered ground (its layers, their relief and parallax): the land leaves as its painted faces\' albedo',
  'the stones\' skin (the rock layer\'s tile over them): each stone leaves in its solved colour',
  'the plants, the grass and its drifts',
  'the light: the sun at the level\'s hour, the sky, fog and occlusion',
]);

// (the page's per-stone jitter, channels/form-land.js: the same hash, so a stone stands as wide and as deep as on the page)
const hsh = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
const r5 = (v) => Math.round(v * 1e5) / 1e5;
// (a stone whose radius is under CAST_R takes the far shape, its block of fractures; the page's own split)
const CAST_R = 0.18, PER = 9, YAW = 2.399;

// the rotation that takes +Z to the unit normal n (three's setFromUnitVectors), then the yaw `a` about +Z after it
function standOn(n, a) {
  const l = Math.hypot(n[0], n[1], n[2]) || 1, x = n[0] / l, y = n[1] / l, z = n[2] / l;
  let q;
  if (z < -1 + 1e-6) q = [0, -1, 0, 0];
  else { const w = 1 + z, k = Math.hypot(-y, x, 0, w); q = [-y / k, x / k, 0, w / k]; }
  const s = Math.sin(a / 2), c = Math.cos(a / 2);
  // q × (0, 0, s, c)
  return [q[3] * 0 + q[0] * c + q[1] * s - q[2] * 0, q[3] * 0 - q[0] * s + q[1] * c + q[2] * 0, q[3] * s + q[0] * 0 - q[1] * 0 + q[2] * c, q[3] * c - q[0] * 0 - q[1] * 0 - q[2] * s];
}

export function stoneInstances(stones) {
  if (!stones || !stones.n) return [];
  const buf = Buffer.from(stones.px, 'base64'), SP = new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const forms = stoneForms();
  const sets = new Map();
  for (let i = 0; i < stones.n; i++) {
    const o = i * PER, r = SP[o + 3], v = SP[o + 8], big = r >= CAST_R, tone = Math.round(SP[o + 7] * 10) / 10;
    const key = `${v}:${big ? 'near' : 'far'}:${tone.toFixed(1)}`;
    if (!sets.has(key)) {
      const F = forms[big ? 'near' : 'far'][v];
      sets.set(key, { name: `form:stones:${v}:${big ? 'near' : 'far'}:${tone.toFixed(1)}`, positions: Float32Array.from(F.pos), normals: Float32Array.from(F.nrm),
        color: stones.base.map((c) => r5(Math.min(1, c * tone))), roughness: 0.85, transforms: [] });
    }
    sets.get(key).transforms.push({
      translation: [r5(SP[o]), r5(SP[o + 1]), r5(SP[o + 2])],
      rotation: standOn([SP[o + 4], SP[o + 5], SP[o + 6]], i * YAW).map(r5),
      scale: [r5(r * (0.9 + 0.3 * hsh(i, 1))), r5(r * (0.8 + 0.3 * hsh(i, 2))), r5(r)],
    });
  }
  return [...sets.keys()].sort().map((k) => sets.get(k));
}

export async function resolveHandoff(sketch, { what = 'level' } = {}) {
  if (!HANDOFF_WHATS.includes(what)) throw new Error(`handoff: what is ${HANDOFF_WHATS.join(' | ')} (got '${what}')`);
  const { payload, kind } = await resolveWorldScene(sketch, { unshaded: true, era: HANDOFF_ERA, handoff: true });
  if (!payload) throw new Error(`handoff: '${sketch?.ref ?? sketch?.title ?? '?'}' resolves to no scene`);
  const instances = stoneInstances(payload.form?.land?.stones);
  const exported = facesToGlb(payload, { generator: `mojulo handoff ${sketch?.ref ?? ''}`.trim(), lit: true, handoff: true, instances });
  if (!exported) throw new Error(`handoff: '${sketch?.ref ?? sketch?.title ?? '?'}' has nothing to hand off`);
  const counts = {};
  for (const s of instances) { const k = s.name.split(':')[1]; counts[k] = (counts[k] ?? 0) + s.transforms.length; }
  const ledger = {
    version: HANDOFF_VERSION, era: HANDOFF_ERA, what,
    carried: { faces: Array.isArray(payload.faces) ? payload.faces.length : 0, instances: counts },
    stays: [...STAYS],
  };
  return { kind, payload, exported, instances, ledger };
}
