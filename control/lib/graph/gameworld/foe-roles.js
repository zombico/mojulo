/**
 * THE CAST'S ROLES — the four parts a game's foes play, in the order they are cast: the rank each stands at and what
 * it is for. A leaf, so what reads the roles (the casting call, gameworld/foe-casting.js; the lorecube's monster
 * manual, lorecube/manual.js) loads nothing else with them: the manual is read by the battles page, which the casting
 * call's own imports reach back to.
 */
export const ROLES = Object.freeze({
  grunt: { rank: 'minion', line: 'the bulk the hero cuts through' },
  harrier: { rank: 'minion', line: 'a second threat the grunt is not: it hurts from where the grunt cannot' },
  elite: { rank: 'elite', line: 'the test of what the hero has learned' },
  boss: { rank: 'boss', line: 'the encounter a level ends on' },
});
