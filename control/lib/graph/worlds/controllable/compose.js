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
import { buildLock } from './lock.js';
import { buildTutorial } from './tutorial.js';
import { buildCast } from './cast.js';
import { buildManeuvers } from './maneuvers.js';
import { buildNav } from './nav.js';
import { buildMind } from './mind.js';
import { buildGroup } from './group.js';

export function composeControllable(builders) {
  const E = {};
  for (const b of builders) b(E);
  return E;
}

// The ordered builder lists — the SINGLE source of composition + emission order. Core FIRST
// (later builders destructure its helpers at build time). ENGINE is the pack-less composition
// (basic rules + platform + combat + maneuvers + pathfinding + the mind + groups — runs any world). EMISSION is the same list:
// the mobile-suit pack's two behavior modules were lifted into the engine whole (maneuvers.js, the
// pack's ms-maneuvers; mind.js, its ai brain), so no pack content composes in any more. Kept as its
// own export for the callers that name it. S4: all.js is dissolved.
export const EMISSION_ENGINE = [buildCore, buildGait, buildRulesBasic, buildRulesPlatform, buildRulesDrive, buildRulesFly, buildCombatHit, buildCombatMatch, buildCombatRanged, buildCombatMelee, buildLock, buildTutorial, buildCast, buildManeuvers, buildNav, buildMind, buildGroup];
export const EMISSION = [...EMISSION_ENGINE];

// The live Node instance factory (the façade composes one; tests may compose their own).
export function composeLive() {
  return composeControllable(EMISSION);
}

// The browser-emission source: the kernel + every builder, stringified. The emitter interpolates
// this ONE expression where it used to interpolate `(${buildControllable.toString()})()`.
export function emissionSource() {
  return `(${composeControllable.toString()})([\n${EMISSION.map((b) => b.toString()).join(',\n')}\n])`;
}
