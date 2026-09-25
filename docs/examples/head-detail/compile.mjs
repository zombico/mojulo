/** head-detail/compile.mjs — two detailed heads as PLAN DATA: `heads/dragon.head.json` and `heads/bear.head.json`
 * (schema `layered-head-v1`), interpreted by the core (control/lib/graph/polygonizer/station-loft-head.js:
 * `headFromPlan`) into the head the detail operators build (station-loft-detail.js: addresses, refinement, strips,
 * sweeps, tiles, carriers, the eye / nostril / fold / cheek-web / tongue regions, `build`, `toSource`, `bakeLayered`).
 * Everything that names an anatomy — station tables, refinement, skin maps, regions, ornaments, the dragon's crest,
 * palette — is in the JSON; nothing here is code but the loading. Species-neutral EXPRESSIONS drive both heads.
 * Deterministic, no dice. */
import { readFileSync } from 'node:fs';
import { compile, loadRecipe } from '../dragon-layered/compile.mjs';
import { build, toSource, carriers, jawFloor, bakeLayered, keepOut, vec, address, clone, frameAt, refineSlot, refineStation } from '../../../control/lib/graph/polygonizer/station-loft-detail.js';
import { headFromPlan, EXPRESSIONS } from '../../../control/lib/graph/polygonizer/station-loft-head.js';

export const HEAD_PLANS = Object.fromEntries(['dragon', 'bear'].map((n) => [n, JSON.parse(readFileSync(new URL(`./heads/${n}.head.json`, import.meta.url), 'utf8'))]));
const HEADS = Object.fromEntries(Object.entries(HEAD_PLANS).map(([n, p]) => [n, headFromPlan(p)]));

export { HEADS, EXPRESSIONS, build, toSource, carriers, frameAt, compile, refineStation, refineSlot, loadRecipe, clone, jawFloor, bakeLayered, address, keepOut, headFromPlan };
export { vec };
