/**
 * What a body can do, measured from the entity it already is, the way fauna/behavior/capabilities.js measures a
 * skeleton. Nothing here is authored per mind: a strategy that needs a verb asks for it here, and a character gets it
 * or not by its rule, loadout and body.
 *
 *   actionsOf(entity)     → { melee, ranged, lob, area, dash, dodge, tackle, jump }   (./vocab.js ACTIONS)
 *   capabilityOf(entity)  → { flier, swimmer, route, sight, memory, navmesh, speed, hp }   (./vocab.js CAPABILITY)
 *
 * An entity is a controllable world entity spec: `{ rule, body, ... }`. The arena's `ai` rule always rolls and
 * body-checks (ms-ai.js writes them itself), so its rule type counts as holding dodge and tackle.
 *
 * Pure and deterministic.
 */
const weaponsOf = (rule) => [
  ...(Array.isArray(rule.loadout) ? rule.loadout.map((s) => s && s.weapon).filter(Boolean) : []),
  ...(rule.weapon ? [rule.weapon] : []),
];
const isBlade = (slot) => !!(slot && (slot.melee || slot.blade));

export function actionsOf(entity) {
  const rule = (entity && entity.rule) || {};
  const weapons = weaponsOf(rule);
  const arena = rule.type === 'ai';
  return {
    melee: !!(rule.meleeSeek || rule.strikeDur || rule.melee || (Array.isArray(rule.loadout) && rule.loadout.some(isBlade))),
    ranged: weapons.length > 0,
    lob: weapons.some((w) => w.fireClass === 'lob'),
    area: weapons.some((w) => w.fireClass === 'area'),
    dash: !!rule.boost,
    dodge: !!(rule.dodge || arena),
    tackle: !!(rule.tackle || arena),
    jump: !!(rule.jumpSpeed || rule.type === 'platform'),
  };
}

export function capabilityOf(entity) {
  const rule = (entity && entity.rule) || {}, body = (entity && entity.body) || {};
  return {
    flier: !!(rule.space || rule.type === 'fly' || rule.flier),
    swimmer: !!rule.swimmer,
    route: Array.isArray(rule.waypoints) && rule.waypoints.length > 0,
    sight: true,
    memory: false,
    navmesh: false,
    speed: Number.isFinite(rule.speed) ? rule.speed : null,
    hp: Number.isFinite(body.hp) ? body.hp : null,
  };
}
