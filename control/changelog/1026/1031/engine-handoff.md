### Engine handoff: assets, animation and levels at the polygon level, on gen 7's form

Two outcomes, said plainly. The web is the whole game, end to end: `export_game` to the browser or the desktop app,
unchanged. An engine gets a handoff: one export, `export_model { engine }`, gives Godot, Unity, Unreal and Blender every
surface as a gen-7 material (base colour, normal, occlusion and roughness, relief for parallax, the land's layers, the
plants and the scree's stones as instances), every rig with its clips and faces, and every level as layout, light,
colliders and named markers (the spawn, the foes, triggers, doors and keys, the critical path, the shots), for a
developer to wire and finish there. The form render's data is the bridge: it already holds a surface's material and
form and never its light, which is how every engine lights a scene.

It supersedes every engine export before it. The game runtimes ported into the engines (Godot's GDScript kernel, Unity's
C# runtime, Roblox's Luau kernel) and the conformance machinery that held them to the web are culled, Roblox is dropped as
a target, and "plays in an engine" stops being a measure: the hillclimb page loses its engine columns, and the engine
marks become one handoff ledger of what each export carried and what stayed the web's.

Built so far:

- **The runtimes are frozen.** The engine game runtimes take no new ports while the handoff replaces them.
- **A real Godot in CI.** The workflow's `godot` job fetches a pinned Godot (4.7.2, from the builds repository, checked
  against the release's SHA512 sums and cached), names it as `MOJULO_GODOT`, and runs the Godot legs the handoff keeps:
  a figure's import with its engine skeleton, BoneMap, retarget and clips.
- **The form data is pinned.** The land read's payload (a small meru island with its grass map) is hashed painted fresh
  and memoized, the two must agree, and the hash is held on every reference leg, so a run, a process or a CPU that paints
  a different byte fails before anything is handed off from it.
- **The handoff's contract, first slice.** `scene/handoff.js` reads a world unshaded in the form render (gen-7) and hands
  it off lit: every surface a glTF metal-rough material in its own colour with no light baked in, the water a smooth
  translucent one, and the form render's scree stones as instances, each standing on its ground's normal as the page
  stands it. A ledger says what was carried and what stays the web's for now (the land's layers, the stones' skin, the
  plants and grass, the light). Every other export is byte for byte as it was.

