/** horse.plan.mjs — THE HORSE's canonical JSON and the docs-side entry to it.
 *
 * The form itself is core: control/lib/graph/polygonizer/horse-form.js (`horsePlan({ scale, palette })`, built by the
 * creature-from-plan loop: a thesis, the form filled with numbers, the wire read at named views, every fix a number).
 * The statue maker's equestrian statues ride it. This file re-exports it and writes horse.plan.json (the canonical
 * horse, byte for byte) when run as a script: `node docs/examples/ring-plans/horse.plan.mjs`. */
import { writeFileSync } from 'node:fs';
import { expandPlan } from '../../../control/lib/graph/polygonizer/station-loft-plan.js';
import { horsePlan } from '../../../control/lib/graph/polygonizer/horse-form.js';

export * from '../../../control/lib/graph/polygonizer/horse-form.js';
export const planPath = new URL('./horse.plan.json', import.meta.url);

export const plan = horsePlan();
export const recipe = expandPlan(plan);
if (process.argv[1] && new URL(`file://${process.argv[1]}`).pathname === new URL(import.meta.url).pathname) {
  writeFileSync(planPath, JSON.stringify(plan, null, 1) + '\n');
  console.log('joints', Object.keys(plan.joints).length, 'segments', plan.segments.length, 'parts', Object.keys(recipe.parts).length);
}
