@tool
extends EditorScenePostImport

# THE ENGINE HANDOFF IN GODOT (mojulo's scene/handoff.js, written by scene/handoff-godot.js): run by Godot's importer
# every time res://mojulo/level.glb is imported (its .import names this script), so a re-handoff (a new level.glb and
# handoff.json, reimported) rebuilds what mojulo owns and leaves the developer's own scene, level.tscn, which only
# instances this one, as they left it. From handoff.json it:
#   - gives every material its vertex colour as albedo (glTF's COLOR_0 is linear) and, where the handoff names one, its
#     height map for parallax (a dressed face's relief, a bark's), bound but off: the relief's normal map carries it, and
#     at the relief's own depth a few millimetres of parallax reads as nothing; a developer turns it on
#   - lays the layered ground (`terrain`): every part it names takes the terrain shader (handoff_terrain.gdshader, the
#     World page's fragment), its layers' base, normal and ORM as arrays (Godot's importer cuts the atlases), the scree's
#     dice, the trail's mask and the grass's cover as textures built into the import from mojulo/terrain/, and the rest
#     of its read as the shader's uniforms
#   - lays the sea (`sea`): its plane takes the water shader (handoff_sea.gdshader, the World page's sea): its colour,
#     faded toward the shore by its depth map, the level's sky in its reflection; it casts no shadow
#   - gives the level's static meshes trimesh collision (not the instances: stones, plants; not what is see-through: a
#     decal, a sun patch, glass, water)
#   - builds the environment: a WorldEnvironment (the sky's zenith and horizon, or the level's background colour where it
#     has no sky; the ambient, SSAO, the page's tone (linear below its shoulder), the haze as fog in its colour and
#     density, over the land and not the sky) and the sun as a
#     DirectionalLight3D casting shadows (a level with no sun and no lamps is given a default one, marked so)
#   - stands each rigged figure as the page stands it when its clock reads zero (`stands`: the first frame of the clip it
#     names, else its rest)
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
						m.heightmap_enabled = false
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
	lamps(scene, H.get("lamps", []))
	if typeof(H.get("stands")) == TYPE_DICTIONARY:
		stand(scene, H["stands"])
	if typeof(H.get("terrain")) == TYPE_DICTIONARY:
		terrain(scene, H["terrain"])
	if typeof(H.get("sea")) == TYPE_DICTIONARY:
		var lv = H.get("level")
		sea(scene, H["sea"], lv.get("environment", {}) if typeof(lv) == TYPE_DICTIONARY else {})
	var level = H.get("level")
	if typeof(level) == TYPE_DICTIONARY:
		environment(scene, level.get("environment", {}))
		markers(scene, level)
		camera(scene, level)
		scene.set_meta("mojulo_level", level)
	scene.set_meta("mojulo_handoff", H.get("version", ""))
	return scene

# (a clip's name as a key: Godot's importer remakes a glTF animation's name, `dummy:forward` among them)
func akey(s: String) -> String:
	var o := ""
	for c in s.to_lower():
		if (c >= "a" and c <= "z") or (c >= "0" and c <= "9"):
			o += c
	return o

# (each rigged figure stands as the page stands it when its clock reads zero: in the first frame of the clip `stands`
# names, where Godot would show its rest; a figure not named keeps its rest, as on the page)
func stand(scene: Node, stands: Dictionary) -> void:
	var want := {}
	for f in stands:
		want[akey(String(stands[f]))] = true
	for ap in scene.find_children("*", "AnimationPlayer", true, false):
		var root: Node = ap.get_node_or_null(ap.root_node)
		if root == null:
			continue
		for n in ap.get_animation_list():
			if not want.has(akey(String(n))):
				continue
			var anim: Animation = ap.get_animation(n)
			for t in range(anim.get_track_count()):
				var p: NodePath = anim.track_get_path(t)
				var at = root.get_node_or_null(NodePath(String(p.get_concatenated_names())))
				var ty := anim.track_get_type(t)
				if at is Skeleton3D and p.get_subname_count() > 0:
					var b: int = at.find_bone(String(p.get_concatenated_subnames()))
					if b < 0:
						continue
					if ty == Animation.TYPE_POSITION_3D:
						at.set_bone_pose_position(b, anim.position_track_interpolate(t, 0.0))
					elif ty == Animation.TYPE_ROTATION_3D:
						at.set_bone_pose_rotation(b, anim.rotation_track_interpolate(t, 0.0))
					elif ty == Animation.TYPE_SCALE_3D:
						at.set_bone_pose_scale(b, anim.scale_track_interpolate(t, 0.0))
				elif at is Node3D and p.get_subname_count() == 0:
					if ty == Animation.TYPE_POSITION_3D:
						at.position = anim.position_track_interpolate(t, 0.0)
					elif ty == Animation.TYPE_ROTATION_3D:
						at.quaternion = anim.rotation_track_interpolate(t, 0.0)
					elif ty == Animation.TYPE_SCALE_3D:
						at.scale = anim.scale_track_interpolate(t, 0.0)

func raw(res: String) -> Image:
	var img := Image.load_from_file(ProjectSettings.globalize_path(res))
	if img != null:
		img.convert(Image.FORMAT_RGBA8)
	return img


func flat(res: String, mips: bool) -> ImageTexture:
	var img := raw(res)
	if img == null:
		return null
	if mips:
		img.generate_mipmaps()
	return ImageTexture.create_from_image(img)

func v2(a) -> Vector2:
	return Vector2(float(a[0]), float(a[1]))

func v3(a) -> Vector3:
	return Vector3(float(a[0]), float(a[1]), float(a[2]))

func terrain(scene: Node, T: Dictionary) -> void:
	var shader = load(String(T.get("shader", "res://mojulo/handoff_terrain.gdshader")))
	var R: Dictionary = T.get("read", {})
	var I: Dictionary = T.get("images", {})
	if shader == null or not I.has("base"):
		push_error("[mojulo-handoff] the terrain's shader or atlases are missing")
		return
	var sm := ShaderMaterial.new()
	sm.resource_name = "mojulo:terrain"
	sm.shader = shader
	# (each layer its own slice of an array, repeating on its own, as the page cuts them: an atlas's cells bleed into each
	# other's mips as seams; Godot's array importer cuts them, a cell a layer)
	sm.set_shader_parameter("tBase", load(I["base"]))
	sm.set_shader_parameter("tNorm", load(I["normal"]))
	sm.set_shader_parameter("tOrm", load(I["orm"]))
	if I.has("dice"):
		sm.set_shader_parameter("tDice", flat(I["dice"], true))
	var tile := PackedFloat32Array()
	for t in R.get("tile", []):
		tile.append(float(t))
	sm.set_shader_parameter("uTile", tile)
	var mean := PackedVector3Array()
	for m in R.get("mean", []):
		mean.append(v3(m))
	sm.set_shader_parameter("uMean", mean)
	var B: Dictionary = R.get("bases", {})
	for k in [["path", "uPathBase"], ["clay", "uClayBase"], ["stone", "uStoneBase"], ["under", "uUnderBase"]]:
		if B.get(k[0]) != null:
			sm.set_shader_parameter(k[1], v3(B[k[0]]))
	sm.set_shader_parameter("uUnder", 1.0 if R.get("green", false) else 0.0)
	sm.set_shader_parameter("uMoss", float(R.get("moss", 0.0)))
	var D = R.get("dress")
	if typeof(D) == TYPE_DICTIONARY:
		sm.set_shader_parameter("uClay", float(D.get("clay", 0.0)))
		sm.set_shader_parameter("uDress", Vector3(float(D.get("rubble", 0.0)), float(D.get("dust", 0.0)), float(D.get("reach", 0.0))))
		sm.set_shader_parameter("uSdIn", float(D.get("sdIn", 1.5)))
		sm.set_shader_parameter("uPatch", v3(D.get("patches", [0, 0, 0])))
	var W = R.get("wet")
	if typeof(W) == TYPE_DICTIONARY:
		sm.set_shader_parameter("uWet", Vector4(-1e9 if W.get("z") == null else float(W["z"]), float(W.get("band", 1.0)), float(W.get("tone", 1.0)), float(W.get("rough", 1.0))))
	var P = R.get("path")
	if typeof(P) == TYPE_DICTIONARY and I.has("path"):
		sm.set_shader_parameter("tPath", flat(I["path"], false))
		sm.set_shader_parameter("uHasPath", 1.0)
		sm.set_shader_parameter("uPathO", v2(P["origin"]))
		sm.set_shader_parameter("uPathM", v2(P["metres"]))
		sm.set_shader_parameter("uPathZ", v2(P["z"]))
	var G = R.get("grass")
	if typeof(G) == TYPE_DICTIONARY and I.has("grass"):
		sm.set_shader_parameter("tGrassL", flat(I["grass"], false))
		sm.set_shader_parameter("uHasG", 1.0)
		sm.set_shader_parameter("uGOl", v2(G["origin"]))
		sm.set_shader_parameter("uGMl", v2(G["metres"]))
	var X = R.get("parallax")
	if typeof(X) == TYPE_DICTIONARY:
		sm.set_shader_parameter("uGpCell", Vector3(float(X["pebbles"]["cell"]), float(X["cracks"]["cell"]), float(X["plates"]["cell"])))
		sm.set_shader_parameter("uGpDepth", Vector3(float(X["pebbles"]["depth"]), float(X["cracks"]["depth"]), float(X["plates"]["depth"])))
		sm.set_shader_parameter("uGp", Vector3(float(X["dry"]), float(X["stretch"]), float(X["near"])))
	var parts: Array = T.get("parts", [])
	for mi in scene.find_children("*", "MeshInstance3D", true, false):
		var mesh: Mesh = mi.mesh
		if mesh == null:
			continue
		for s in range(mesh.get_surface_count()):
			var m = mesh.surface_get_material(s)
			if m != null and parts.has(m.resource_name):
				mesh.surface_set_material(s, sm)

func sea(scene: Node, S: Dictionary, env: Dictionary) -> void:
	var shader = load(String(S.get("shader", "res://mojulo/handoff_sea.gdshader")))
	if shader == null:
		push_error("[mojulo-handoff] the sea's shader is missing")
		return
	var R: Dictionary = S.get("read", {})
	var sm := ShaderMaterial.new()
	sm.resource_name = "mojulo:sea"
	sm.shader = shader
	if S.has("image"):
		sm.set_shader_parameter("tDepth", flat(S["image"], false))
	sm.set_shader_parameter("uDO", v2(R.get("origin", [0, 0])))
	sm.set_shader_parameter("uDM", v2(R.get("metres", [1, 1])))
	sm.set_shader_parameter("uDMax", float(R.get("max", 1.0)))
	sm.set_shader_parameter("uOpacity", float(R.get("opacity", 0.9)))
	# (the sky's light on its colour, linear: none where the handoff names none)
	if R.has("irradiance"):
		sm.set_shader_parameter("uIrr", v3(R["irradiance"]))
	# (the sky it reflects: the level's, else its background)
	var sky = env.get("sky", {})
	var bg := String(env.get("background", "#c8d4e0"))
	sm.set_shader_parameter("uZenith", Color.html(sky.get("zenith", bg)) if typeof(sky) == TYPE_DICTIONARY else Color.html(bg))
	sm.set_shader_parameter("uHorizon", Color.html(sky.get("horizon", bg)) if typeof(sky) == TYPE_DICTIONARY else Color.html(bg))
	for mi in scene.find_children("*", "MeshInstance3D", true, false):
		var mesh: Mesh = mi.mesh
		if mesh == null:
			continue
		for s in range(mesh.get_surface_count()):
			var m = mesh.surface_get_material(s)
			if m is BaseMaterial3D and m.resource_name == String(S.get("part", "form:sea")):
				# (its colour and roughness the plane's own, glTF's: linear)
				sm.set_shader_parameter("uBase", Vector3(m.albedo_color.srgb_to_linear().r, m.albedo_color.srgb_to_linear().g, m.albedo_color.srgb_to_linear().b))
				sm.set_shader_parameter("uRough", m.roughness)
				mesh.surface_set_material(s, sm)
				mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

# (a room's lamps, handoff.json's `lamps` by their GLB node names, carry π × the solve's level as their glTF intensity,
# the page's convention: Godot's importer takes it as the light's energy, which Godot lights by as it does a sun's, so a
# lamp's energy is its level, intensity / π, as the sun's is; any other light keeps the importer's)
func lamps(scene: Node, names: Array) -> void:
	var want := {}
	for n in names:
		want[safe(String(n))] = true
	for l in scene.find_children("*", "OmniLight3D", true, false):
		if want.has(String(l.name)):
			l.light_energy = l.light_energy / PI
			l.set_meta("mojulo_lamp", true)

func environment(scene: Node, env: Dictionary) -> void:
	var e := Environment.new()
	var sm := ProceduralSkyMaterial.new()
	if env.has("sky"):
		sm.sky_top_color = Color.html(env["sky"].get("zenith", "#6a8fc0"))
		sm.sky_horizon_color = Color.html(env["sky"].get("horizon", "#c8d4e0"))
		# (below the horizon the page's dome keeps the horizon's colour)
		sm.ground_horizon_color = sm.sky_horizon_color
		sm.ground_bottom_color = sm.sky_horizon_color
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
		# (the solve's ambient is the sky's light already, as the page lights with it: none of Godot's sky over it, and the
		# sky not reflected again)
		e.ambient_light_sky_contribution = 0.0
		e.reflected_light_source = Environment.REFLECTION_SOURCE_DISABLED
	e.ssao_enabled = true
	# (the page's tone curve is Khronos's neutral, which Godot has not: linear is it below its shoulder, ~0.76)
	e.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	if env.has("haze") and typeof(env["haze"]) == TYPE_DICTIONARY:
		e.fog_enabled = true
		# (the page draws its sky past the fog)
		e.fog_sky_affect = 0.0
		if env["haze"].has("color"):
			# (the colour the page's haze shows: three mixes its fog after the output's sRGB encoding, by the colour's linear
			# values, so the hex lands darker and bluer than itself)
			e.fog_light_color = Color.html(env["haze"]["color"]).srgb_to_linear()
		if env["haze"].has("density"):
			# (the page's fog is exp-squared, 1 - exp(-(density × distance)²): faint near, closing late. Godot's depth fog,
			# smoothstep(0, end, distance) to a power, follows it within 0.03 everywhere at an end of 1.92 / density and a
			# power of 0.8; its exponential fog, matched at the half distance, lay three times as thick at mid distance)
			var rho := maxf(float(env["haze"]["density"]), 0.000001)
			e.fog_mode = Environment.FOG_MODE_DEPTH
			e.fog_density = 1.0
			e.fog_depth_begin = 0.0
			e.fog_depth_end = 1.92 / rho
			e.fog_depth_curve = 0.8
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

