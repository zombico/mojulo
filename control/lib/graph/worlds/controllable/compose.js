/**
 * compose.js — the controllable-world composition kernel (controllable-split.plan.md, S0).
 *
 * The engine is a set of BUILDER closures composed over a shared namespace: each builder is
 * import-free inside its function (the browser runs the exact same source via toString() — the
 * single-source-of-truth doctrine, now per-system), takes the namespace `E`, defines its functions
 * closing over it, and attaches its public pieces onto it. `composeControllable` runs them in
 * order and returns `E` — which ends up carrying the whole public API (createWorld, stepWorld,
 * RULES, …) exactly as the old monolithic buildControllable() return did.
 *
 * EMISSION is the one ordered list: registration order = array order = browser-emission order.
 * Core (currently `all.js`, the monolith wholesale) comes first; later builders may destructure
 * its helpers at build time; cross-SYSTEM calls at runtime go through `E.*` (late-binding), so
 * ordering between non-core builders never matters.
 *
 * The per-builder self-containment test (controllable-world.test.js, "single source of truth")
 * instantiates every EMISSION entry via `new Function` — the tripwire that catches an
 * accidentally-imported symbol before it ships a silently-broken browser copy.
 */

import { buildCore } from './core.js';
import { buildGait } from './gait.js';
import { buildRulesBasic } from './rules-basic.js';
import { buildCombatHit } from './combat-hit.js';
import { buildCombatMatch } from './combat-match.js';
import { buildCombatRanged } from './combat-ranged.js';
import { buildCombatMelee } from './combat-melee.js';
import { buildRulesPlatform } from './rules-platform.js';
import { buildRulesDrive } from './rules-drive.js';
import { buildRulesFly } from './rules-fly.js';
import { buildMsManeuvers } from '../../mobile-suit/ms-maneuvers.js';
import { buildMsAi } from '../../mobile-suit/ms-ai.js';

export function composeControllable(builders) {
  const E = {};
  for (const b of builders) b(E);
  return E;
}

// The ordered builder lists — the SINGLE source of composition + emission order. Core FIRST
// (later builders destructure its helpers at build time). ENGINE is the pack-less composition
// (basic rules + platform + combat — runs any non-arena world); EMISSION appends the mobile-suit
// content pack (maneuvers riding the platform seam, the ai brain). S4: all.js is dissolved.
export const EMISSION_ENGINE = [buildCore, buildGait, buildRulesBasic, buildRulesPlatform, buildRulesDrive, buildRulesFly, buildCombatHit, buildCombatMatch, buildCombatRanged, buildCombatMelee];
export const EMISSION = [...EMISSION_ENGINE, buildMsManeuvers, buildMsAi];

// The live Node instance factory (the façade composes one; tests may compose their own).
export function composeLive() {
  return composeControllable(EMISSION);
}

// The browser-emission source: the kernel + every builder, stringified. The emitter interpolates
// this ONE expression where it used to interpolate `(${buildControllable.toString()})()`.
export function emissionSource() {
  return `(${composeControllable.toString()})([\n${EMISSION.map((b) => b.toString()).join(',\n')}\n])`;
}
