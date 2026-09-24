/** lower-workbench.mjs — a thin shim over the core lowering (control/lib/graph/polygonizer/
 * station-loft-workbench.js): a compiled layered head → a `mint_solid` kind 'workbench' spec. The loft
 * declarations that drive it are in recipe.json (written by seed-recipe.mjs); nothing here is dragon-specific. */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { compile, loadRecipe } from './compile.mjs';
import { lowerLayeredToWorkbench, loftBasis } from '../../../control/lib/graph/polygonizer/station-loft-workbench.js';
export { loftBasis };
export const lowerToWorkbench = (mesh, { title = 'Dragon head (layered)', seat = true } = {}) => lowerLayeredToWorkbench(mesh, { title, seat });

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dials = process.argv[2] ? JSON.parse(process.argv[2]) : {}; const name = process.argv[3] || 'baseline'; const outDir = process.argv[4] ? resolve(process.argv[4]) : fileURLToPath(new URL('.', import.meta.url));
  const { spec, loweringError, omitted } = lowerToWorkbench(compile(loadRecipe(), dials), { title: `Dragon head (layered) — ${name}` });
  writeFileSync(resolve(outDir, `${name}.workbench.json`), JSON.stringify({ kind: 'workbench', spec }) + '\n');
  console.log(JSON.stringify({ name, lofts: spec.lofts.length, omitted, maxLoweringError_m: Math.max(...Object.values(loweringError)), l1Error_m: { cranium: loweringError.cranium, jaw: loweringError.jaw } }));
}
