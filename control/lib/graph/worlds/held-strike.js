/**
 * THE HELD STRIKE's wielder (worlds/world-scene.js): which body strikes with what a hero holds in its right hand, and
 * the rule it strikes by. A platform body whose rule carries a feel's string (its contact window, gameworld/feel/lower.js)
 * and no strike of its own wields the hero it plays: its own figure, or the figure its combat draws (an action hero is
 * sheathed out of combat, gameworld/levels.js actionHero: it plays `<hero>-sheathed` and draws `<hero>` in a fight).
 * Pure.
 *
 *   wieldsFigure(e, name) → true when e strikes with the hero `name` holds
 *   armHeld(e, held, moveClips?) → e, its rule armed with the held item's reach and its class's seconds and damage (any
 *                           the rule names stand); `moveClips` where its figure carries its moveset's own clips
 */
export function wieldsFigure(e, name) {
  if (!e || !e.body || !e.rule || e.rule.type !== 'platform' || !Array.isArray(e.rule.strikeContact) || e.rule.strike != null) return false;
  return e.body.figure === name || (!!e.rule.combat && e.rule.combat.drawn === name);
}
export function armHeld(e, held, moveClips = false) {
  return { ...e, rule: { ...e.rule, strike: 'melee', strikeReach: e.rule.strikeReach ?? held.reach, strikeDur: e.rule.strikeDur ?? held.seconds, strikeDamage: e.rule.strikeDamage ?? held.damage, ...(moveClips ? { moveClips: true } : {}) } };
}
