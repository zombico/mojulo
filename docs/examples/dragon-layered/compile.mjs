/** compile.mjs — a thin shim over the core `layered` grammar (control/lib/graph/polygonizer/station-loft.js)
 * bound to this example's recipe. The dragon's species rules live in seed-recipe.mjs; nothing here is
 * dragon-specific. Kept so the example's tests and render.py read the way they always did. */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { compileLayered, auditLayered, resolveLayeredDials, pinFrame, mirrorPid, mirrorFaceId, surfaceLocalOffset } from '../../../control/lib/graph/polygonizer/station-loft.js';
export const recipePath = new URL('./recipe.json', import.meta.url);
export function loadRecipe() { return JSON.parse(readFileSync(recipePath, 'utf8')); }
const R = loadRecipe();
export const DIALS = R.dials;
export const CRANIUM_SLOTS = R.parts.cranium.slots; export const JAW_SLOTS = R.parts.jaw.slots;
export const resolveDials = (d = {}) => resolveLayeredDials(R.dials, d);
export const mirrorFace = (id) => mirrorFaceId(id, id.startsWith('jaw/') ? JAW_SLOTS.length : CRANIUM_SLOTS.length);
export const compile = (recipe = R, dials = {}, channels = {}) => compileLayered(recipe, dials, channels);
export const audit = auditLayered;
export { pinFrame, mirrorPid, surfaceLocalOffset };

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dials = process.argv[2] ? JSON.parse(process.argv[2]) : {}; const name = process.argv[3] || 'baseline';
  const outDir = process.argv[4] ? resolve(process.argv[4]) : fileURLToPath(new URL('.', import.meta.url));
  const mesh = compile(R, dials); writeFileSync(resolve(outDir, `${name}.json`), JSON.stringify(mesh) + '\n');
  const a = audit(mesh); console.log(JSON.stringify({ dials: mesh.dials, vertices: mesh.vertices.length, faces: mesh.faces.length, pass: Object.values(a).every((r) => r.pass), parts: Object.fromEntries(Object.entries(a).map(([k, r]) => [k, r.pass ? 'ok' : r])) }));
}
