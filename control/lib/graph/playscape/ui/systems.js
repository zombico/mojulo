/**
 * SYSTEMS — what a game's systems publish for the UI to read (rung 3: compose the systems and you have composed the
 * HUD). A part binds a system with `bind: { from: '<system>' }` instead of a bus var; the fields and events each one
 * publishes are listed here, read off the piloted runtime that already keeps them (worlds/controllable/*), so a part
 * names only what exists.
 *
 *   SYSTEMS        system → { about, fields, events, source }
 *   SYSTEM_IDS
 *
 * Today the piloted runtime draws its own HUD from these (scene/channels/controllable/index.js: the reticle, the
 * weapon panel, the lock bracket, the overhead bars); a part bound to a system is designed on the board, and reaches
 * the page when that HUD is drawn from parts.
 */

export const SYSTEMS = Object.freeze({
  weapon: {
    about: 'the active weapon slot',
    fields: ['ammo', 'magazine', 'reserve', 'reloading', 'reload', 'cooldown', 'ready', 'charge', 'energy', 'overheat', 'name', 'icon', 'spread'],
    events: ['hit', 'assist-hit', 'miss', 'kill', 'switch'],
    source: 'worlds/controllable/combat-ranged.js, the weapon subsystem',
  },
  lock: {
    about: 'the target lock: what the pilot is locked onto',
    fields: ['target', 'locked'],
    events: ['acquire', 'cycle', 'release'],
    source: 'worlds/controllable/lock.js',
  },
  body: {
    about: 'the pilot\'s own body',
    fields: ['hp', 'hp-max', 'downed', 'boost'],
    events: ['harm', 'heal', 'down'],
    source: 'worlds/controllable/combat-hit.js',
  },
  match: {
    about: 'the match: kills and the feed',
    fields: ['kills', 'deaths', 'score', 'time'],
    events: ['kill', 'round-start', 'round-end'],
    source: 'worlds/controllable/combat-match.js',
  },
});
export const SYSTEM_IDS = Object.keys(SYSTEMS);
