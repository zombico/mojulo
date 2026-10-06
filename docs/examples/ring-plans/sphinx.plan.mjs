/** sphinx.plan.mjs — THE SPHINX's canonical JSON and the docs-side entry to it.
 *
 * The form itself is core: control/lib/graph/polygonizer/sphinx-form.js (`sphinxPlan({ preset, scale, palette })`, built by the
 * creature-from-plan loop: a thesis, the form filled with numbers, the wire read at named views, every fix a number).
 * A historic city's statue entry names it as `form: 'sphinx'` (Giza's Great Sphinx). This file re-exports it and writes sphinx.plan.json (the canonical
 * sphinx, byte for byte) when run as a script: `node docs/examples/ring-plans/sphinx.plan.mjs`. */
import { writeFileSync } from 'node:fs';
import { expandPlan } from '../../../control/lib/graph/polygonizer/station-loft-plan.js';
import { sphinxPlan } from '../../../control/lib/graph/polygonizer/sphinx-form.js';

export * from '../../../control/lib/graph/polygonizer/sphinx-form.js';
export const planPath = new URL('./sphinx.plan.json', import.meta.url);

export const plan = sphinxPlan();
export const recipe = expandPlan(plan);
if (process.argv[1] && new URL(`file://${process.argv[1]}`).pathname === new URL(import.meta.url).pathname) {
  writeFileSync(planPath, JSON.stringify(plan, null, 1) + '\n');
  console.log('joints', Object.keys(plan.joints).length, 'segments', plan.segments.length, 'parts', Object.keys(recipe.parts).length);
}
