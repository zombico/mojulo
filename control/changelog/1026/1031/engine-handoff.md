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
- **The Godot adapter, first slice.** A handoff becomes a Godot 4 project: the GLB, a `handoff.json` with the level
  record and what glTF has no slot for (each material's height map, the terrain's atlases), and a post-import script
  that, on every import, gives the materials their colours and parallax, the static meshes their collision, the level
  its sky, ambient, occlusion and shadowed sun, and stands every marker and seat as a node carrying its record. The
  developer's `project.godot` and `level.tscn` are written once and kept: a re-handoff replaces mojulo's folder, Godot
  reimports, and whatever the developer wired stays. CI's Godot job imports a couch level and a dressed bay and probes
  what the importer built.
- **The cast travels.** A level's rigged bodies (its hero, its creatures) leave as their figures, skinned with every clip
  they play, on their entities' nodes; a primitive body (a box, a sphere) leaves as its mesh on its entity's node, so
  moving the entity in the engine moves the body. Found in the first Godot runs, with three more: a dressed face's
  relief lit by its normal map (its parallax bound but off: at the relief's real depth it reads as nothing), the haze's
  density taken so Godot's fog reaches half at the page's distance, and a default sun, background and camera.

- **The layered ground in Godot.** A form land's ground leaves Godot looking as it does on the World page: the page's
  layered-ground shader ported to Godot's shading language (each layer along the face's dominant axis, raised by its own
  height, the trail's powder and clay, the scree thinned by its stones, the ledges' dirt, the moss, the undergrowth, the
  pebbles, cracked earth and plates, the wet sand line), bound on import to every layered part with its layers as
  texture arrays. The corners' weights ride the GLB twice over the same bytes, as `_SPLAT` and as two UV sets an engine
  that drops an application attribute keeps, and the handoff now carries everything the page's ground reads (the trail's
  mask, the scree's dice, the dress, the bases, the wet line) for every engine. Found beside it: a cube's sky reached the
  record as colour bytes and broke Godot's environment (now hex, as the rest of the record), and the environment now
  lights as the page does (its tone curve, its solved ambient alone, the haze's colour as the page shows it, the sky
  clear of the fog). CI's Godot job imports a trail too, and fails on any script or shader error in the import.
- **The sea as the engine's own water.** Where a land has a sea's depth, its sea leaves as one plane at the water's
  height over the bed, see-through and fading to nothing toward the shore by the depth under it, in place of the painted
  sheet; in Godot it takes a water shader ported from the page's (the sea's colour lit, the shore's fade, the level's
  sky in its reflection), so the cliff's cut faces below the waterline no longer show through. The haze in Godot now
  follows the page's curve (faint near, closing late) instead of matching it at one distance only.
- **Hand a world to Godot from the agent.** `export_model { engine: 'godot' }` writes the handoff as a Godot 4 project in
  the world's outcome folder (`godot-handoff/`): open it and play `level.tscn`. Handing off a changed recipe again
  replaces mojulo's folder and keeps the developer's project and scene; `what: 'asset'` hands off a thing without its
  level. The result says what travelled, what stayed the web's, and the command that checks the import in a headless
  Godot. A desktop app built from the same outcome folder now leaves every engine pack out (Godot's handoff, Unreal's
  and Blender's packs had been packed into it).
