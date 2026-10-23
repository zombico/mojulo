/**
 * THE CLOSED KEY SETS every engine's marks are held to, read from the sources themselves (the ratchets read this; the
 * product does not). A new page input, controllable rule, platform-rule key, ledger row, bus row, mechanic, system or
 * link appears here the moment the source gains it, and every engine's marks module must then mark it.
 *
 *   pageInputs()        scene-three.js emitThreeWorld's parameters (a resolved payload spreads into it)
 *   controllableRules() worlds/controllable compose.js RULES
 *   platformRuleKeys()  every `r.<key>` the platform rule's modules read (rules-platform, maneuvers, combat-melee)
 *   walkRuleKeys()      every `r.<key>` the walk rule reads (rules-basic.js walk)
 *   ledgerKeys()        every ledger row engine-score.js writes
 *   busRows()           bus-abi.js BUS_ABI's facts and effects
 *   systemKinds()       power.systems' kinds and the place pad
 *   linkKinds()         era/floormap.js LINK_KINDS
 *   pageEventKeys()     every `events.<key>` the World page's events channel reads (scene/channels/events.js)
 */
import fs from 'node:fs';
import path from 'node:path';
import { composeControllable, EMISSION_ENGINE } from '../../worlds/controllable/compose.js';
import { BUS_ABI } from '../bus-abi.js';
import { SYSTEM_KINDS } from '../../gameworld/actions.js';
import { LINK_KINDS } from '../../era/floormap.js';

const CONTROL = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../..');
export const SRC = (rel) => fs.readFileSync(path.join(CONTROL, rel), 'utf8');

export function pageInputs() {
  const sig = /export function emitThreeWorld\(\{([\s\S]*?)\}\s*=\s*\{\}\)\s*\{/.exec(SRC('lib/graph/scene/scene-three.js'));
  if (!sig) throw new Error('mark-sources: emitThreeWorld signature not found');
  return [...sig[1].matchAll(/(?:^|,)\s*([A-Za-z_$][\w$]*)\s*=/g)].map((x) => x[1]);
}

export const controllableRules = () => Object.keys(composeControllable(EMISSION_ENGINE).RULES);

export function platformRuleKeys() {
  const keys = new Set(['type']);
  for (const f of ['rules-platform', 'maneuvers', 'combat-melee', 'wall', 'swing']) for (const x of SRC(`lib/graph/worlds/controllable/${f}.js`).matchAll(/\br\.([A-Za-z]+)/g)) keys.add(x[1]);
  return [...keys];
}

export function walkRuleKeys() {
  const src = SRC('lib/graph/worlds/controllable/rules-basic.js');
  const body = src.slice(src.indexOf('function walk('), src.indexOf('function follow('));
  return [...new Set([...body.matchAll(/\br\.([A-Za-z]+)/g)].map((x) => x[1]))];
}

export function ledgerKeys() {
  const src = SRC('lib/graph/scene/engine-score.js');
  return [...new Set([...src.matchAll(/ledger\.([a-z_]+) =/g), ...src.matchAll(/skip\('([a-z_]+)'/g)].map((x) => x[1]))];
}

export const busRows = () => ({ facts: Object.keys(BUS_ABI.facts), effects: Object.keys(BUS_ABI.effects) });
export const systemKinds = () => [...Object.keys(SYSTEM_KINDS), 'place'];
export const linkKinds = () => [...LINK_KINDS];

export function pageEventKeys() {
  const src = SRC('lib/graph/scene/channels/events.js');
  return [...new Set([...src.matchAll(/\bevents0?\.([A-Za-z_$][\w$]*)/g)].map((x) => x[1]))];
}
