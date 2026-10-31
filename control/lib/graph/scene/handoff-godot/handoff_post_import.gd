@tool
extends EditorScenePostImport

# THE ENGINE HANDOFF IN GODOT (mojulo's scene/handoff.js, written by scene/handoff-godot.js): run by Godot's importer
# every time res://mojulo/level.glb is imported (its .import names this script), so a re-handoff (a new level.glb and
# handoff.json, reimported) rebuilds what mojulo owns and leaves the developer's own scene, level.tscn, which only
# instances this one, as they left it. From handoff.json it:
#   - gives every material its vertex colour as albedo (glTF's COLOR_0 is linear) and, where the handoff names one, its
#     height map for parallax (a dressed face's relief, a bark's)
#   - gives the level's static meshes trimesh collision (not the instances: stones, plants)
#   - builds the environment: a WorldEnvironment (the sky's zenith and horizon, the ambient, SSAO, a filmic tone) and the
#     sun at the level's hour as a DirectionalLight3D casting shadows
#   - stands every marker (the spawn, the entities with their part in the loop, the anchors, the cameras) and every
#     seat as a Marker3D under MojuloMarkers and MojuloSeats, its record in its metadata ("mojulo"), and the whole level
#     record on the root ("mojulo_level")
# Mojulo's frame is z-up in metres; the GLB turns its own nodes to Godot's y-up, and what is added here is turned by zup().

const HANDOFF := "res://mojulo/handoff.json"

func zup(a) -> Vector3:
	return Vector3(float(a[0]), float(a[2]), -float(a[1]))

func lin(a) -> Color:
	return Color(float(a[0]), float(a[1]), float(a[2])).linear_to_srgb()

func safe(n: String) -> String:
	return n.validate_node_name().replace(":", "_")

func own(node: Node, owner_node: Node) -> void:
	node.owner = owner_node
	for c in node.get_children():
		own(c, owner_node)

func _post_import(scene: Node) -> Object:
	var H = JSON.parse_string(FileAccess.get_file_as_string(HANDOFF))
	if typeof(H) != TYPE_DICTIONARY:
		push_error("[mojulo-handoff] res://mojulo/handoff.json is missing or not JSON")
		return scene
	var mats: Dictionary = H.get("materials", {})
	var still: Array = H.get("instanced", [])
	for mi in scene.find_children("*", "MeshInstance3D", true, false):
		var mesh: Mesh = mi.mesh
		if mesh == null:
			continue
		for s in range(mesh.get_surface_count()):
			var m = mesh.surface_get_material(s)
			if m is BaseMaterial3D:
				m.vertex_color_use_as_albedo = true
				m.vertex_color_is_srgb = false
				var spec = mats.get(m.resource_name)
				if typeof(spec) == TYPE_DICTIONARY and spec.has("height"):
					var img := Image.load_from_file(ProjectSettings.globalize_path(spec["height"]))
					if img != null:
						m.heightmap_enabled = true
						m.heightmap_texture = ImageTexture.create_from_image(img)
						m.heightmap_scale = clampf(float(spec.get("depth", 0.02)) / max(float(spec.get("metres", 1.0)), 0.001) * 100.0, 0.5, 16.0)
		var instanced := false
		for p in still:
			if String(mi.name).begins_with(safe(p)):
				instanced = true
		if not instanced:
			mi.create_trimesh_collision()
			own(mi, scene)
	var level = H.get("level")
	if typeof(level) == TYPE_DICTIONARY:
		environment(scene, level.get("environment", {}))
		markers(scene, level)
		scene.set_meta("mojulo_level", level)
	scene.set_meta("mojulo_handoff", H.get("version", ""))
	return scene

func environment(scene: Node, env: Dictionary) -> void:
	var e := Environment.new()
	var sm := ProceduralSkyMaterial.new()
	if env.has("sky"):
		sm.sky_top_color = Color.html(env["sky"].get("zenith", "#6a8fc0"))
		sm.sky_horizon_color = Color.html(env["sky"].get("horizon", "#c8d4e0"))
		sm.ground_horizon_color = sm.sky_horizon_color
	var sky := Sky.new()
	sky.sky_material = sm
	e.background_mode = Environment.BG_SKY
	e.sky = sky
	if env.has("ambient"):
		var a: Array = env["ambient"]
		var m := maxf(maxf(float(a[0]), float(a[1])), maxf(float(a[2]), 0.000001))
		e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
		e.ambient_light_color = lin([float(a[0]) / m, float(a[1]) / m, float(a[2]) / m])
		e.ambient_light_energy = m
	e.ssao_enabled = true
	e.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	if env.has("haze"):
		e.fog_enabled = true
	var we := WorldEnvironment.new()
	we.name = "MojuloEnvironment"
	we.environment = e
	scene.add_child(we)
	we.owner = scene
	if env.has("sun"):
		var sun := DirectionalLight3D.new()
		sun.name = "MojuloSun"
		var d := zup(env["sun"]["direction"]).normalized()
		var up := Vector3.UP if absf(d.y) < 0.99 else Vector3.FORWARD
		sun.transform = Transform3D(Basis.looking_at(-d, up), d * 100.0)
		sun.light_color = lin(env["sun"]["color"])
		sun.light_energy = float(env["sun"]["intensity"]) / PI
		sun.shadow_enabled = true
		scene.add_child(sun)
		sun.owner = scene

func markers(scene: Node, level: Dictionary) -> void:
	var root := Node3D.new()
	root.name = "MojuloMarkers"
	scene.add_child(root)
	root.owner = scene
	for m in level.get("markers", []):
		var mk := Marker3D.new()
		mk.name = safe(String(m.get("name", "marker")))
		if m.has("at") and m["at"] != null:
			mk.position = zup(m["at"])
		mk.set_meta("mojulo", m)
		root.add_child(mk)
		mk.owner = scene
	var seats = level.get("seats")
	if typeof(seats) == TYPE_DICTIONARY:
		var sroot := Node3D.new()
		sroot.name = "MojuloSeats"
		sroot.set_meta("mojulo", { "screen": seats.get("screen"), "lives": seats.get("lives"), "pool": seats.get("pool"), "join": seats.get("join"), "drop": seats.get("drop") })
		scene.add_child(sroot)
		sroot.owner = scene
		for r in seats.get("rows", []):
			var sk := Marker3D.new()
			sk.name = "seat_" + String(r.get("label", str(r.get("n"))))
			if r.has("spawn") and r["spawn"] != null:
				sk.position = zup(r["spawn"])
			sk.set_meta("mojulo", r)
			sroot.add_child(sk)
			sk.owner = scene
