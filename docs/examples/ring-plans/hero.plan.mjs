/** hero.plan.mjs — the HERO FORM's canonical JSON and the docs-side entry to it.
 *
 * The form itself is core: control/lib/graph/polygonizer/hero-form.js (`heroPlan({ cast, register, girth, headScale,
 * scale, palette, head, body, tune })`, the casts, the body controls, the registers, the TUNE — proportion as
 * percentages of a cast's own baseline — and `scalePlan`). This file re-exports it, so the worked examples, the tests
 * and the starters keep their import, and writes hero.plan.json (the canonical hero, byte for byte) when run as a script. */
import { writeFileSync } from 'node:fs';
import { expandPlan } from '../../../control/lib/graph/polygonizer/station-loft-plan.js';
import { heroPlan } from '../../../control/lib/graph/polygonizer/hero-form.js';

export * from '../../../control/lib/graph/polygonizer/hero-form.js';
export const planPath = new URL('./hero.plan.json', import.meta.url);

export const plan = heroPlan();
export const recipe = expandPlan(plan);
if (process.argv[1] && new URL(`file://${process.argv[1]}`).pathname === new URL(import.meta.url).pathname) {
  writeFileSync(planPath, JSON.stringify(plan, null, 1) + '\n');
  console.log('joints', Object.keys(plan.joints).length, 'segments', plan.segments.length, 'parts', Object.keys(recipe.parts).length, 'dials', Object.keys(recipe.dials).length);
}
