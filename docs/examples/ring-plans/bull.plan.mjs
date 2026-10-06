/** bull.plan.mjs — THE BULL's canonical JSON and the docs-side entry to it.
 *
 * The form itself is core: control/lib/graph/polygonizer/bull-form.js (`bullPlan({ scale, palette })`, built by the
 * creature-from-plan loop: a thesis, the form filled with numbers, the wire read at named views, every fix a number).
 * A historic city's statue entry names it as `form: 'bull'` (Sumer's copper guardians). This file re-exports it and writes bull.plan.json (the canonical
 * bull, byte for byte) when run as a script: `node docs/examples/ring-plans/bull.plan.mjs`. */
import { writeFileSync } from 'node:fs';
import { expandPlan } from '../../../control/lib/graph/polygonizer/station-loft-plan.js';
import { bullPlan } from '../../../control/lib/graph/polygonizer/bull-form.js';

export * from '../../../control/lib/graph/polygonizer/bull-form.js';
export const planPath = new URL('./bull.plan.json', import.meta.url);

export const plan = bullPlan();
export const recipe = expandPlan(plan);
if (process.argv[1] && new URL(`file://${process.argv[1]}`).pathname === new URL(import.meta.url).pathname) {
  writeFileSync(planPath, JSON.stringify(plan, null, 1) + '\n');
  console.log('joints', Object.keys(plan.joints).length, 'segments', plan.segments.length, 'parts', Object.keys(recipe.parts).length);
}
