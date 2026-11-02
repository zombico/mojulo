/**
 * THE ENGINE REGISTRY: the engines a team's work is handed off to, said once. The web build is the game; an engine takes
 * a handoff of it (export_model { engine }): Godot a project of a world's or a game's levels (assets, materials,
 * markers), Blender the same handoff built into a .blend, Unreal the same as a UE5 project (or one thing by its ref as
 * an asset pack), Unity the same as a Unity 6 project (URP). No engine runs a game: the game runtimes are retired.
 *
 *   proof    the env var a test names when it runs the engine (its gate)
 *   handoff  the folder export_model's pack for it lands in, under the outcome folder
 *   art      a second folder of the engine's own under the outcome folder: Blender's art pack (`format: 'blender'`,
 *            blender-pack.js, and forge_motion's film), which keeps its folder beside the handoff's
 *   asset    the folder of an engine's one-thing asset pack beside its handoff's: Unreal's (`what: 'asset'`,
 *            unreal-pack.js)
 *
 * Light on purpose: pure data, no builder imported.
 */
export const ENGINES = Object.freeze({
  godot: Object.freeze({ id: 'godot', name: 'Godot', proof: 'MOJULO_GODOT', handoff: 'godot-handoff' }),
  // Unreal takes a world's or a game's levels as a UE5 project (scene/handoff-unreal.js), and a character, a prop or a
  // building by its ref as its asset pack (`what: 'asset'`, unreal-pack.js)
  unreal: Object.freeze({ id: 'unreal', name: 'Unreal', proof: 'MOJULO_UNREAL', handoff: 'unreal-handoff', asset: 'unreal' }),
  blender: Object.freeze({ id: 'blender', name: 'Blender', proof: 'MOJULO_BLENDER', handoff: 'blender-handoff', art: 'blender' }),
  // Unity takes a world's or a game's levels as a Unity 6 project, URP and glTFast (scene/handoff-unity.js)
  unity: Object.freeze({ id: 'unity', name: 'Unity', proof: 'MOJULO_UNITY', handoff: 'unity-handoff' }),
});

/** The folders export_model's engine packs land in under an outcome folder, in registry order (an engine's handoff, then
 *  its art pack's, then its asset pack's). */
export const ENGINE_HANDOFF_DIRS = Object.freeze(Object.values(ENGINES).flatMap((e) => [e.handoff, e.art, e.asset]).filter(Boolean));
