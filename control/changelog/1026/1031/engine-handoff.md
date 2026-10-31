### Engine handoff: assets, animation and levels at the polygon level, on gen 7's form

Mojulo makes single-player and couch-multiplayer games, for two audiences. A solo creator gets the whole game, end to
end, on the web: `export_game` to the browser or the desktop app, unchanged. Developers and teams get a handoff, with the
recipe and its bible as their design source, the web build as the prototype that validated the loop, and a re-handoff
that keeps their own wiring, so more of a team can make prototypes and iterate on them: one export, `export_model { engine }`, gives Godot, Unity, Unreal and Blender every
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
- **The plants.** Each plant leaves as a copy of its template: its wood on its bark (the bark's own colour, its relief's
  normal, occlusion and roughness, and its height for parallax) and its crown, its leaf clumps merged as the page merges
  them, each leaf's normal bent toward the crown's outside so the crown takes the sun as one volume. Each plant's own
  tint, the wind, the sprays near the eye, the far levels of detail and a conifer's needles stay the web's for now.
- **The dressed faces.** Every tile the matte painter painted from relief (a bay kit's floors, walls, columns, crowns and
  soffits, a crypt's ashlar, a house's render and tiles) leaves as the material it was painted from: its colour under no
  light, its relief's normal, its occlusion and roughness, and its height for parallax, instead of the tile with the
  light painted in. A tile painted any other way leaves as its paint, and the ledger counts both.
- **The land as form.** The island's and the trail's ground leaves as the form render draws it, in place of its painted
  faces: each ground class a mesh of its own, shaded smooth, each corner its palette-solved colour, and on the layered
  ground each corner's four layers' weights with the layers' textures alongside, for an engine's terrain shader to blend
  as the page does. The cliff's rock relief leaves as geometry, cut and pushed as the page pushes it, meeting the land
  round it without a gap.
- **A room's lamps.** A room under the form render leaves with its surfaces in their solved colours under no light and
  its lamps as point lights at the levels the solve gives them, so the engine's lamps light it as the page's bake does.
- **The level a developer wires.** A level's handoff carries a record of what its web prototype validated: its
  environment (the sky, the sun at its hour, the ambient), its markers (the spawn, every entity by its node's name with
  its part in the loop: the pilot, a seat's body, a foe with its rank and skill, a thing; the anchors; the cameras), its
  contract (what it produces, consumes and audits, synthesized from its mechanics as the game resolves it), its seats
  (each seat's number, colour, body and spawn, the screen they share, their lives) and its reference (the web build and
  the bible pages of the same recipe). Every name comes from the recipe, so handing off a changed level keeps the names
  of what did not change, and an engine can take the new version without losing a developer's own wiring.

