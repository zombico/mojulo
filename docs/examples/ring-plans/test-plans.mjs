// node --test docs/examples/ring-plans/test-plans.mjs — every worked plan expands, compiles and closes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { expandPlan } from '../../../control/lib/graph/polygonizer/station-loft-plan.js';
import { compileLayered, auditLayered } from '../../../control/lib/graph/polygonizer/station-loft.js';

const here = new URL('./', import.meta.url);
for (const file of readdirSync(here).filter((f) => f.endsWith('.plan.json'))) {
  test(`${file}: expands, every part closes at rest and at every dial extreme, deterministic`, () => {
    const plan = JSON.parse(readFileSync(new URL(file, here), 'utf8'));
    const recipe = expandPlan(plan); assert.equal(JSON.stringify(expandPlan(plan)), JSON.stringify(recipe));
    const D = recipe.dials; const extremes = [{}, Object.fromEntries(Object.entries(D).map(([k, s]) => [k, s.min])), Object.fromEntries(Object.entries(D).map(([k, s]) => [k, s.max]))];
    const rest = compileLayered(recipe);
    for (const dials of extremes) { const m = compileLayered(recipe, dials); const bad = Object.entries(auditLayered(m)).filter(([, r]) => !r.pass).map(([n]) => n); assert.deepEqual(bad, [], JSON.stringify(dials)); assert.deepEqual(m.pointIds, rest.pointIds); }
    assert.ok(Object.keys(recipe.parts).length >= 8);
  });
}
