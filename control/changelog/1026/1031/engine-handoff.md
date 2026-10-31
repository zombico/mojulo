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

Built so far: nothing yet; the theme opens with its design.
