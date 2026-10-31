extends SceneTree

# THE HANDOFF'S PROBE in Godot (scene/handoff-godot.js's gate): run headless after the pack is imported
# (`godot --headless --path <pack> --script res://mojulo/handoff_probe.gd`). It instances the imported level and prints
# one line, `[mojulo-handoff-probe] {json}`: what the importer built from the handoff, to be held against handoff.json.

func _init() -> void:
	var packed = load("res://mojulo/level.glb")
	if packed == null:
		print("[mojulo-handoff-probe] " + JSON.stringify({ "ok": false, "why": "res://mojulo/level.glb did not import" }))
		quit(1)
		return
	var scene: Node = packed.instantiate()
	var out := { "ok": true, "materials": 0, "albedo": 0, "normal": 0, "orm": 0, "height": 0, "bodies": 0, "markers": 0, "seats": 0,
		"environment": false, "sky": false, "ssao": false, "sun": false, "sun_shadow": false, "omni": 0, "handoff": scene.get_meta("mojulo_handoff", "") }
	var seen := {}
	for mi in scene.find_children("*", "MeshInstance3D", true, false):
		if mi.mesh == null:
			continue
		for s in range(mi.mesh.get_surface_count()):
			var m = mi.mesh.surface_get_material(s)
			if m is BaseMaterial3D and not seen.has(m):
				seen[m] = true
				out["materials"] += 1
				if m.vertex_color_use_as_albedo: out["albedo"] += 1
				if m.normal_enabled and m.normal_texture != null: out["normal"] += 1
				if m.roughness_texture != null or m.ao_texture != null: out["orm"] += 1
				if m.heightmap_enabled and m.heightmap_texture != null: out["height"] += 1
	out["bodies"] = scene.find_children("*", "StaticBody3D", true, false).size()
	var mk = scene.get_node_or_null("MojuloMarkers")
	if mk != null: out["markers"] = mk.get_child_count()
	var st = scene.get_node_or_null("MojuloSeats")
	if st != null: out["seats"] = st.get_child_count()
	var we = scene.get_node_or_null("MojuloEnvironment")
	if we != null and we.environment != null:
		out["environment"] = true
		out["sky"] = we.environment.sky != null
		out["ssao"] = we.environment.ssao_enabled
	var sun = scene.get_node_or_null("MojuloSun")
	if sun != null:
		out["sun"] = true
		out["sun_shadow"] = sun.shadow_enabled
	out["omni"] = scene.find_children("*", "OmniLight3D", true, false).size()
	print("[mojulo-handoff-probe] " + JSON.stringify(out))
	scene.free()
	quit(0)
