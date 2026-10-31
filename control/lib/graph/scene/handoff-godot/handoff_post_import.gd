@tool
extends EditorScenePostImport

# THE ENGINE HANDOFF IN GODOT (mojulo's scene/handoff.js, written by scene/handoff-godot.js): run by Godot's importer
# every time res://mojulo/level.glb is imported (its .import names this script), so a re-handoff (a new level.glb and
# handoff.json, reimported) rebuilds what mojulo owns and leaves the developer's own scene, level.tscn, which only
# instances this one, as they left it. From handoff.json it:
#   - gives every material its vertex colour as albedo (glTF's COLOR_0 is linear) and, where the handoff names one, its
#     height map for parallax (a dressed face's relief, a bark's)
#   - gives the level's static meshes trimesh collision (not the instances: stones, plants; not what is see-through: a
#     decal, a sun patch, glass, water)
#   - builds the environment: a WorldEnvironment (the sky's zenith and horizon, or the level's background colour where it
#     has no sky; the ambient, SSAO, a filmic tone, the haze as fog in its colour and density) and the sun as a
#     DirectionalLight3D casting shadows (a level with no sun and no lamps is given a default one, marked so)
#   - makes a camera current: the GLB's first, or one stood at the level's camera marker looking at what it looks at
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
		var see_through := false
		for s in range(mesh.get_surface_count()):
			var sm = mesh.surface_get_material(s)
			if sm is BaseMaterial3D and sm.transparency != BaseMaterial3D.TRANSPARENCY_DISABLED:
				see_through = true
		if not instanced and not see_through:
			mi.create_trimesh_collision()
			own(mi, scene)
	var level = H.get("level")
	if typeof(level) == TYPE_DICTIONARY:
		environment(scene, level.get("environment", {}))
		markers(scene, level)
		camera(scene, level)
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
	if env.has("sky") or not env.has("background"):
		var sky := Sky.new()
		sky.sky_material = sm
		e.background_mode = Environment.BG_SKY
		e.sky = sky
	else:
		e.background_mode = Environment.BG_COLOR
		e.background_color = Color.html(env["background"])
	if env.has("ambient"):
		var a: Array = env["ambient"]
		var m := maxf(maxf(float(a[0]), float(a[1])), maxf(float(a[2]), 0.000001))
		e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
		e.ambient_light_color = lin([float(a[0]) / m, float(a[1]) / m, float(a[2]) / m])
		e.ambient_light_energy = m
	e.ssao_enabled = true
	e.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	if env.has("haze") and typeof(env["haze"]) == TYPE_DICTIONARY:
		e.fog_enabled = true
		if env["haze"].has("color"):
			e.fog_light_color = Color.html(env["haze"]["color"])
		if env["haze"].has("density"):
			e.fog_density = float(env["haze"]["density"])
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
		if env["sun"].get("default", false):
			sun.set_meta("mojulo_default", true)
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

func camera(scene: Node, level: Dictionary) -> void:
	var cams := scene.find_children("*", "Camera3D", true, false)
	if cams.size() > 0:
		cams[0].current = true
		return
	var at := Vector3(0, 5, 8)
	var look := Vector3.ZERO
	var fov := 60.0
	var found := false
	for m in level.get("markers", []):
		if m.get("kind") == "camera" and m.get("at") != null and not found:
			at = zup(m["at"])
			if m.get("look") != null:
				look = zup(m["look"])
			if m.get("yfov") != null:
				fov = rad_to_deg(float(m["yfov"]))
			found = true
	if not found:
		for m in level.get("markers", []):
			if m.get("kind") == "spawn" and m.get("at") != null:
				look = zup(m["at"])
				at = look + Vector3(0, 5, 8)
	var cam := Camera3D.new()
	cam.name = "MojuloCamera"
	cam.fov = fov
	var dir := (look - at).normalized()
	var up := Vector3.UP if absf(dir.y) < 0.99 else Vector3.FORWARD
	cam.transform = Transform3D(Basis.looking_at(dir, up), at)
	cam.current = true
	scene.add_child(cam)
	cam.owner = scene

