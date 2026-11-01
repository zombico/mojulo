/**
 * THE ENGINE REGISTRY: the engines a team's work is handed off to, said once. The web build is the game; an engine takes
 * a handoff of it (export_model { engine }): Godot a project of a world's or a game's levels (assets, materials,
 * markers), Unreal an asset, Blender an art pack. No engine runs a game: the game runtimes are retired.
 *
 *   proof    the env var a test names when it runs the engine (its gate)
 *   handoff  the folder export_model's pack for it lands in, under the outcome folder
 *
 * Light on purpose: pure data, no builder imported.
 */
export const ENGINES = Object.freeze({
  godot: Object.freeze({ id: 'godot', name: 'Godot', proof: 'MOJULO_GODOT', handoff: 'godot-handoff' }),
  // Unreal takes mojulo's assets (export_model { engine: 'unreal' }: a character, a prop, a building), not its games
  unreal: Object.freeze({ id: 'unreal', name: 'Unreal', handoff: 'unreal' }),
  blender: Object.freeze({ id: 'blender', name: 'Blender', handoff: 'blender' }),
});

/** The folders export_model's engine packs land in under an outcome folder, in registry order. */
export const ENGINE_HANDOFF_DIRS = Object.freeze(Object.values(ENGINES).map((e) => e.handoff).filter(Boolean));
