/**
 * What a body can do, measured from the entity it already is, the way fauna/behavior/capabilities.js measures a
 * skeleton. Nothing here is authored per mind: a strategy that needs a verb asks for it here, and a character gets it
 * or not by its rule, loadout and body.
 *
 *   actionsOf(entity)     → { melee, ranged, lob, area, dash, dodge, tackle, jump, contact }   (./vocab.js ACTIONS)
 *   capabilityOf(entity)  → { flier, swimmer, route, sight, memory, navmesh, commanded, speed, hp }   (./vocab.js CAPABILITY)
 *
 * An entity is a controllable world entity spec: `{ rule, body, weapon?, ... }`, read the way the runtime reads it. A
 * mind's rule (`ai`, worlds/controllable/mind.js) rolls unless `dodge: false` and can always charge (the counter is
 * the opportunist's), and draws a blade only when it seeks melee and its loadout holds a `strike: 'melee'` slot.
 *
 * Pure and deterministic.
 */
const weaponsOf = (entity, rule) => [
  ...(Array.isArray(rule.loadout) ? rule.loadout.map((s) => s && s.weapon).filter(Boolean) : []),
  ...(entity && entity.weapon ? [entity.weapon] : []),
];
// a blade is a loadout slot that strikes in melee; the mind draws it when its rule seeks melee (meleeSeek)
const isBlade = (slot) => !!(slot && slot.strike === 'melee');

export function actionsOf(entity) {
  const rule = (entity && entity.rule) || {};
  const weapons = weaponsOf(entity, rule);
  const mind = rule.type === 'ai';
  const blade = Array.isArray(rule.loadout) && rule.loadout.some(isBlade);
  return {
    melee: mind ? !!(rule.meleeSeek && blade) : !!(blade || rule.strikeDur),
    ranged: weapons.length > 0,
    lob: weapons.some((w) => w.fireClass === 'lob'),
    area: weapons.some((w) => w.fireClass === 'area'),
    dash: !!rule.boost,
    dodge: mind ? rule.dodge !== false : !!rule.dodge,
    tackle: mind ? true : !!rule.tackle,
    jump: !!(rule.jumpSpeed || rule.type === 'platform'),
    contact: !!(rule.foe && rule.foe.touch),
  };
}

export function capabilityOf(entity) {
  const rule = (entity && entity.rule) || {}, body = (entity && entity.body) || {};
  return {
    flier: !!(rule.space || rule.type === 'fly' || rule.flier),
    swimmer: !!rule.swimmer,
    route: (Array.isArray(rule.waypoints) && rule.waypoints.length > 0) || !!(rule.foe && (rule.foe.move === 'pace' || rule.foe.move === 'hop')),
    sight: true,
    memory: !!(rule.mind && rule.mind.perception === 'memory'),
    navmesh: !!(rule.mind && rule.mind.pathing === 'navmesh'),
    commanded: !!rule.commanded,
    speed: Number.isFinite(rule.speed) ? rule.speed : null,
    hp: Number.isFinite(body.hp) ? body.hp : null,
  };
}
