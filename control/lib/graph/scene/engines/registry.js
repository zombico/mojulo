/**
 * THE ENGINE REGISTRY: the engines a team's work is handed off to, said once. The web build is the game; an engine takes
 * a handoff of it (export_model { engine }): Godot a project of a world's or a game's levels (assets, materials,
 * markers), Blender the same handoff built into a .blend, Unreal an asset. No engine runs a game: the game runtimes are
 * retired.
 *
 *   proof    the env var a test names when it runs the engine (its gate)
 *   handoff  the folder export_model's pack for it lands in, under the outcome folder
 *   art      a second folder of the engine's own under the outcome folder: Blender's art pack (`format: 'blender'`,
 *            blender-pack.js, and forge_motion's film), which keeps its folder beside the handoff's
 *
 * Light on purpose: pure data, no builder imported.
 */
export const ENGINES = Object.freeze({
  godot: Object.freeze({ id: 'godot', name: 'Godot', proof: 'MOJULO_GODOT', handoff: 'godot-handoff' }),
  // Unreal takes mojulo's assets (export_model { engine: 'unreal' }: a character, a prop, a building), not its games
  unreal: Object.freeze({ id: 'unreal', name: 'Unreal', handoff: 'unreal' }),
  blender: Object.freeze({ id: 'blender', name: 'Blender', proof: 'MOJULO_BLENDER', handoff: 'blender-handoff', art: 'blender' }),
});

/** The folders export_model's engine packs land in under an outcome folder, in registry order (an engine's handoff, then
 *  its art pack's). */
export const ENGINE_HANDOFF_DIRS = Object.freeze(Object.values(ENGINES).flatMap((e) => [e.handoff, e.art]).filter(Boolean));
