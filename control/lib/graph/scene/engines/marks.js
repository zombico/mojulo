/**
 * THE MARKS, engine-neutral: the vocabulary every engine's marks module speaks, and the tables that say what a world
 * asks of an engine without saying which engine. Each engine with a runtime kernel has its own marks module
 * (scene/godot-marks.js, scene/roblox-marks.js) exporting the same tables over the same closed key sets; a mark row is
 * keyed by the engine it belongs to, so a row can never be read as another engine's:
 *
 *   { godot: 'built', how: 'kernel/rules.gd: …' }      { roblox: 'absent', how: 'not in the Roblox kernel yet' }
 *
 *   built         the kernel runs it as the web does (or, for a look, carries it whole)
 *   approximated  it runs, simpler or in part: the `how` says what stays the web's
 *   absent        nothing in the kernel runs it: the export names it, never drops it silently
 *
 * The closed key sets (what each table must mark) are read from the sources by engines/mark-sources.js; the ratchet
 * (engines/marks.test.js) holds every engine's tables to them.
 *
 * Pure data and small reads. No module with a builder in it is imported, so the cosmos facets can read it.
 */

export const MARKS = Object.freeze(['built', 'approximated', 'absent']);
const RANK = { built: 0, approximated: 1, absent: 2 };
/** The worse of marks: absent over approximated over built; none → built. */
export const worstMark = (...marks) => marks.flat().reduce((w, m) => (RANK[m] > RANK[w] ? m : w), 'built');

/** A row maker for one engine: `const m = markRow('roblox'); m('absent', 'why')` → { roblox: 'absent', how: 'why' }. */
export const markRow = (engine) => (mark, how) => Object.freeze({ [engine]: mark, ...(how ? { how } : {}) });

/** The bus contract's statuses (bus-abi.js: built | partial | absent) as marks. */
export const BUS_STATUS_MARK = Object.freeze({ built: 'built', partial: 'approximated', absent: 'absent' });

// space.camera's values, by the camera rule each lowers to (gameworld/cameras.js)
export const CAMERA_RULE = Object.freeze({ 'third-person': 'follow', 'first-person': 'eye', 'top-down': 'overhead', side: 'side', fixed: 'fixed' });

// space.traversal (playscape/objects ENTRIES): the runtime rule each lowers to, if any
export const TRAVERSAL_RULE = Object.freeze({ door: null, platform: 'mover', lift: 'mover', catapult: 'launcher', bridge: null, ladder: 'platform', stairs: null });

// the World page inputs that say how the page is drawn, not what the world is: they carry nothing to any engine
export const PAGE_OPTIONS = Object.freeze(['viewBox', 'title', 'inline', 'cdn', 'capture', 'pack', 'hud', 'wireframe', 'spin', 'decollide', 'metersPerUnit']);
/** An option row for one engine: built (there is nothing to carry), flagged so no reading lists it. */
export const optionRow = (engine) => Object.freeze({ [engine]: 'built', option: true });

// the ledger rows engine-score.js writes that say what travels (read by no verdict); every other row is marked per engine
export const LEDGER_INFO = Object.freeze([
  'greybox_declared', 'skipped_runtime', 'sfx_carried', 'combat_music_carried', 'hud_declared', 'lights_carried', 'look_declared',
  'crystals_carried', 'water_carried', 'address_carried', 'contract', 'bus_carried', 'combat_carried', 'rules_carried',
  'channels_carried', 'figures_carried', 'events_carried',
]);
// the game manifest's shell keys that carry nothing to judge (a soundtrack plays wherever a level plays)
export const SHELL_INFO = Object.freeze(['music']);

/** The overlays a payload's rigged figures carry: a vehicle's live overlay, a racer's juice and its lamps (sorted). */
export function figureOverlays(figures) {
  const on = new Set();
  for (const f of Object.values(figures && typeof figures === 'object' ? figures : {})) {
    if (!f || !f.rig) continue;
    if (f.live) on.add('live');
    if (f.juice) { on.add('juice'); if (f.juice.beams) on.add('beams'); if (f.juice.trails) on.add('trails'); }
  }
  return [...on].sort();
}
