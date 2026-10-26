/**
 * THE ENGINE REGISTRY: which engines a game translates into, said once. The web runtime is the game; every engine
 * here is a translation of it (CHANGELOG "Desktop export: … the engines as translations"). A row says what kind of
 * translation it is and, for an engine with a runtime kernel, where its marks live and what an unwritten mark means.
 *
 *   kind     runtime   a kernel runs the game's behaviour (the bus, the rules, the minds) and is held equal to the web
 *            scene     a project with a small closed kernel of its own (walker, five mechanics, menu); no marks
 *            art       geometry and materials for an art pass or an asset; no game
 *   marks    the engine's marks module (engines/marks.js says the shape); null for an engine with none
 *   unmarked what a cosmos value with no mark for this engine reads as: null (closed: the registry throws, the mark must
 *            be written) or 'absent' (a young kernel: what nobody marked does not run, so its flow offers nothing
 *            it cannot carry)
 *   proof    the env var a test names when it runs the engine: a `built` mark names such a test
 *   outDir   the folder its game pack lands in, under the game's outcome folder (export_game); none for an art pass
 *
 * Light on purpose: marks modules are pure data, so the cosmos registry can read this. Pack builders and runners
 * register elsewhere (they import builders).
 */
import * as godotMarks from '../godot-marks.js';
import * as robloxMarks from '../roblox-marks.js';

export const ENGINES = Object.freeze({
  godot: Object.freeze({ id: 'godot', name: 'Godot', kind: 'runtime', marks: godotMarks, marksPath: 'lib/graph/scene/godot-marks.js', unmarked: null, proof: 'MOJULO_GODOT', outDir: 'godot' }),
  roblox: Object.freeze({ id: 'roblox', name: 'Roblox', kind: 'runtime', marks: robloxMarks, marksPath: 'lib/graph/scene/roblox-marks.js', unmarked: 'absent', proof: 'MOJULO_LUNE', outDir: 'roblox' }),
  unity: Object.freeze({ id: 'unity', name: 'Unity', kind: 'scene', marks: null, outDir: 'unity' }),
  // Unreal takes mojulo's assets (export_model { format: 'unreal' }: a character, a prop, a building), not its games
  unreal: Object.freeze({ id: 'unreal', name: 'Unreal', kind: 'art', marks: null }),
  blender: Object.freeze({ id: 'blender', name: 'Blender', kind: 'art', marks: null }),
});

/** The engines with marks (a runtime kernel), in registry order. */
export const MARKED_ENGINES = Object.freeze(Object.values(ENGINES).filter((e) => e.marks).map((e) => e.id));

/** The folders engine packs land in under a game's outcome folder, in registry order. */
export const ENGINE_OUT_DIRS = Object.freeze(Object.values(ENGINES).map((e) => e.outDir).filter(Boolean));

/** The engine a call that names none reads: Godot, the most complete translation (its callers predate the registry). */
export const DEFAULT_ENGINE = 'godot';

/** An engine's row; throws on an unknown id. */
export function engineOf(id) {
  const e = ENGINES[id];
  if (!e) throw new Error(`engines: unknown engine '${id}' (known: ${Object.keys(ENGINES).join(', ')})`);
  return e;
}

/** An engine's marks module, or null for an engine that has none (and for no engine at all). */
export const marksOf = (id) => (id == null ? null : engineOf(id).marks);

/** A mark row's mark for an engine (rows are keyed by their engine's id). */
export const markIn = (row, engine) => (row ? row[engine] : undefined);

/** A value's marks in every engine with marks, from one reading of an engine's marks module:
 * `marksAcross((M, e) => M.RULE_MARKS.walk[e])` → { godot: 'built', roblox: 'absent' }. */
export const marksAcross = (read) => Object.fromEntries(MARKED_ENGINES.map((e) => [e, read(marksOf(e), e)]));
