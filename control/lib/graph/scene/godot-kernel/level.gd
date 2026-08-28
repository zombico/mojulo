extends Node3D
# mojulo-godot kernel — the level interpreter (godot-handoff.plan.md G6).
# Hand-authored and versioned (kernel/VERSION); packs ship DATA, this script
# performs it. Reads the engine-agnostic score.json (z-up frame) and realizes
# it with stock Godot nodes: ground + AABB colliders, cameras, the walker,
# and the declarative mechanics vocabulary (reach-exit / collect /
# hazard-damage / survive / fail-on-death). One score, two instruments —
# game-shell.js is the web kernel, this is the Godot one.

@export_file("*.json") var score_path: String = ""
@export var music_path: String = ""
@export var music_db: float = 0.0

const WalkerScript := preload("res://kernel/walker.gd")
const HAZARD_COOLDOWN := 0.8

var score: Dictionary = {}
var eye := 1.7
var eye_scale := 1.0
var walker: CharacterBody3D = null
var state := "playing"  # playing | complete | failed

# mechanics state
var exit_zones: Array = []      # {pos, radius?, half?, planar}
var pickups: Array = []         # {item, into, pos, radius, taken}
var hazards: Array = []         # {pos, radius, damage, cool}
var survive_left := -1.0
var fail_on_death := false
var hp := -1.0
var start_hp := 100.0
var bag: Dictionary = {}

var hud: Label = null
var banner_layer: CanvasLayer = null


static func to_yup(v: Array) -> Vector3:
	return Vector3(float(v[0]), float(v[2]), -float(v[1]))


func _ready() -> void:
	var txt := FileAccess.get_file_as_string(score_path)
	var parsed = JSON.parse_string(txt)
	if parsed is Dictionary:
		score = parsed
	eye = float(score.get("eye", 1.7))
	eye_scale = maxf(0.5, eye / 1.7)
	_fix_materials()
	_hide_player_double()
	_mark_meshless_entities()
	_build_colliders()
	_build_cameras()
	_spawn_walker()
	_build_mechanics()
	_start_music()
	_build_hud()


# G0 material contract (Finding 1): Godot's glTF import does not set
# vertex_color_use_as_albedo — without this every vertex-coloured face
# renders white. COLOR_0 is linear: is_srgb stays false.
func _fix_materials() -> void:
	for mi in find_children("*", "MeshInstance3D", true, false):
		var mesh: Mesh = mi.mesh
		if mesh == null:
			continue
		for s in range(mesh.get_surface_count()):
			var mat: Material = mi.get_active_material(s)
			if mat is StandardMaterial3D:
				mat.vertex_color_use_as_albedo = true
				mat.vertex_color_is_srgb = false


# The operator IS the walker — hide the player entity's exported body double.
func _hide_player_double() -> void:
	var player = score.get("player")
	if player == null or String(player) == "":
		return
	var nm := ("entity:" + String(player)).replace(":", "_")
	var double := find_child(nm, true, false)
	if double is Node3D:
		double.visible = false


# Entities that baked no mesh (glyph/primitive bodies — export-side gap) get
# a gold placeholder marker so gameplay anchors aren't invisible.
func _mark_meshless_entities() -> void:
	var size := 0.7 * eye_scale
	for ent in find_children("entity_*", "Node3D", true, false):
		if ent.visible and ent.find_children("*", "MeshInstance3D", true, false).is_empty():
			var marker := MeshInstance3D.new()
			var box := BoxMesh.new()
			box.size = Vector3(size, size, size)
			var mm := StandardMaterial3D.new()
			mm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
			mm.albedo_color = Color(0.92, 0.76, 0.3)
			box.material = mm
			marker.mesh = box
			marker.position = Vector3(0, size / 2, 0)
			ent.add_child(marker)


# Implicit ground plane (z=0 unless the score says otherwise) + AABB obstacle
# hulls. The collider list is never the floor (G1 finding).
func _build_colliders() -> void:
	var body := StaticBody3D.new()
	body.name = "Colliders"
	add_child(body)
	var ground = score.get("ground")
	if ground != null:
		var gshape := CollisionShape3D.new()
		gshape.shape = WorldBoundaryShape3D.new()
		gshape.position = Vector3(0, float(ground), 0)
		body.add_child(gshape)
	for c in score.get("colliders", []):
		if not (c is Dictionary and c.get("min") is Array and c.get("max") is Array):
			continue
		var mn: Array = c["min"]
		var mx: Array = c["max"]
		var shape := CollisionShape3D.new()
		var box := BoxShape3D.new()
		box.size = Vector3(float(mx[0]) - float(mn[0]), float(mx[2]) - float(mn[2]), float(mx[1]) - float(mn[1]))
		shape.shape = box
		shape.position = to_yup([(float(mn[0]) + float(mx[0])) / 2, (float(mn[1]) + float(mx[1])) / 2, (float(mn[2]) + float(mx[2])) / 2])
		body.add_child(shape)


# Authored framings become real cameras (key 0 toggles). The score's camera
# rotation quat is z-up; conjugate by the same -90°-about-X the GLB root bakes.
func _build_cameras() -> void:
	var r := Quaternion(-sqrt(0.5), 0, 0, sqrt(0.5))
	var cams: Array = score.get("cameras", [])
	for i in range(cams.size()):
		var cam: Dictionary = cams[i]
		var node := Camera3D.new()
		node.name = "View%d" % i
		var t: Array = cam.get("translation", [0, 0, 0])
		node.position = to_yup(t)
		var q: Array = cam.get("rotation", [0, 0, 0, 1])
		node.quaternion = r * Quaternion(float(q[0]), float(q[1]), float(q[2]), float(q[3]))
		node.fov = rad_to_deg(float(cam.get("yfov", 1.0)))
		node.near = 0.1
		node.far = 8000.0
		add_child(node)


func _spawn_walker() -> void:
	walker = WalkerScript.new()
	walker.name = "Walker"
	var spawn := to_yup(score.get("spawn", [0, 0, 2]))
	spawn.y += 0.3 * eye_scale
	walker.spawn = spawn
	walker.position = spawn
	walker.speed = 6.0 * eye_scale
	walker.jump = 4.5 * eye_scale
	walker.gravity = 9.8 * eye_scale
	var kill_y := spawn.y - 300.0
	var colliders: Array = score.get("colliders", [])
	if colliders.size() > 0:
		var min_z := 1e18
		for c in colliders:
			if c is Dictionary and c.get("min") is Array:
				min_z = minf(min_z, float(c["min"][2]))
		kill_y = min_z - 100.0
	walker.kill_y = kill_y
	add_child(walker)
	walker.build_body(eye, eye_scale)


func _build_mechanics() -> void:
	for m in score.get("mechanics", []):
		if not m is Dictionary:
			continue
		match String(m.get("kind", "")):
			"reach-exit":
				exit_zones.append({
					"pos": to_yup(m.get("at", [0, 0, 0])),
					"half": m.get("half"),
					"radius": float(m.get("radius", 2.0)),
					"planar": bool(m.get("planar", true)),
				})
			"collect":
				for p in m.get("pickups", []):
					if p is Dictionary:
						pickups.append({
							"item": String(p.get("item", "item")),
							"into": String(m.get("into", "bag")),
							"pos": to_yup(p.get("at", [0, 0, 0])),
							"radius": float(p.get("radius", 1.4)),
							"taken": false,
						})
			"hazard-damage":
				start_hp = float(m.get("startHp", 100))
				hp = start_hp
				for h in m.get("hazards", []):
					if h is Dictionary:
						var hpos := to_yup(h.get("at", [0, 0, 0]))
						var hrad := float(h.get("radius", 1.5))
						hazards.append({
							"pos": hpos,
							"radius": hrad,
							"damage": float(h.get("damage", 20)),
							"cool": 0.0,
						})
						_hazard_marker(hpos, hrad)
			"fail-on-death":
				fail_on_death = true
				if hp < 0:
					start_hp = float(m.get("startHp", 100))
					hp = start_hp
			"survive":
				survive_left = float(m.get("seconds", 30))


# Hazards export no visual at all (they are score data, not entities) — a
# translucent danger sphere keeps the gameplay anchor visible, same doctrine
# as the gold entity markers; the web build is the reference look.
func _hazard_marker(pos: Vector3, radius: float) -> void:
	var marker := MeshInstance3D.new()
	var sphere := SphereMesh.new()
	sphere.radius = radius
	sphere.height = radius * 2.0
	var mm := StandardMaterial3D.new()
	mm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mm.albedo_color = Color(0.95, 0.25, 0.2, 0.35)
	sphere.material = mm
	marker.mesh = sphere
	marker.position = pos
	add_child(marker)


# Distance from a point to the walker's BODY (the feet→head segment), not the
# feet point — a hazard floating at chest height must still connect.
func _body_distance(target: Vector3) -> float:
	var feet := walker.global_position
	var y := clampf(target.y, feet.y, feet.y + eye)
	return target.distance_to(Vector3(feet.x, y, feet.z))


func _start_music() -> void:
	if music_path == "":
		return
	var stream = load(music_path)
	if stream == null:
		return
	var music := AudioStreamPlayer.new()
	music.name = "Music"
	music.stream = stream
	music.volume_db = music_db
	add_child(music)
	if stream is AudioStreamWAV:
		stream.loop_mode = AudioStreamWAV.LOOP_FORWARD
		stream.loop_end = int(stream.get_length() * stream.mix_rate)
	music.play()


func _build_hud() -> void:
	if hp < 0 and survive_left < 0 and pickups.is_empty():
		return
	var layer := CanvasLayer.new()
	hud = Label.new()
	hud.position = Vector2(16, 12)
	hud.add_theme_font_size_override("font_size", 20)
	layer.add_child(hud)
	add_child(layer)
	_update_hud()


func _update_hud() -> void:
	if hud == null:
		return
	var parts: Array = []
	if hp >= 0:
		parts.append("HP %d" % int(ceil(hp)))
	if survive_left >= 0:
		parts.append("SURVIVE %d" % int(ceil(survive_left)))
	for item in bag:
		parts.append("%s ×%d" % [String(item).to_upper(), int(bag[item])])
	hud.text = "   ".join(parts)


func _zone_hit(zone: Dictionary, pos: Vector3) -> bool:
	var zp: Vector3 = zone["pos"]
	if zone.get("half") is Array:
		var h: Array = zone["half"]
		if absf(pos.x - zp.x) > float(h[0]) or absf(pos.z - zp.z) > float(h[1]):
			return false
		return bool(zone.get("planar", true)) or absf(pos.y - zp.y) <= float(h[2])
	var r := float(zone.get("radius", 2.0))
	if bool(zone.get("planar", true)):
		return Vector2(pos.x - zp.x, pos.z - zp.z).length() <= r
	return pos.distance_to(zp) <= r


func _process(delta: float) -> void:
	if state != "playing" or walker == null:
		return
	var pos := walker.global_position
	for z in exit_zones:
		if _zone_hit(z, pos):
			_complete()
			return
	if survive_left >= 0:
		survive_left = maxf(0.0, survive_left - delta)
		if survive_left == 0.0:
			_complete()
			return
	for p in pickups:
		if not p["taken"] and _body_distance(p["pos"]) <= float(p["radius"]) + 0.4 * eye_scale:
			p["taken"] = true
			bag[p["item"]] = int(bag.get(p["item"], 0)) + 1
			print("moj: picked up %s" % p["item"])
	for h in hazards:
		h["cool"] = maxf(0.0, float(h["cool"]) - delta)
		if float(h["cool"]) == 0.0 and _body_distance(h["pos"]) <= float(h["radius"]) + 0.4 * eye_scale:
			h["cool"] = HAZARD_COOLDOWN
			hp = maxf(0.0, hp - float(h["damage"]))
			print("moj: hazard hit, hp %d" % int(hp))
			if fail_on_death and hp <= 0.0:
				_fail()
				return
	_update_hud()


func _banner(text: String, color: Color) -> void:
	banner_layer = CanvasLayer.new()
	var label := Label.new()
	label.text = text
	label.set_anchors_preset(Control.PRESET_CENTER)
	label.add_theme_font_size_override("font_size", 48)
	label.add_theme_color_override("font_color", color)
	banner_layer.add_child(label)
	add_child(banner_layer)


func _game() -> Node:
	return get_node_or_null("/root/Game")


func _complete() -> void:
	state = "complete"
	print("moj: level complete")
	_banner("LEVEL COMPLETE", Color(1, 1, 1))
	var game := _game()
	if game != null:
		game.level_complete()


func _fail() -> void:
	state = "failed"
	print("moj: level failed")
	_banner("FAILED", Color(1, 0.35, 0.3))
	var game := _game()
	if game != null:
		game.level_failed()
	else:
		await get_tree().create_timer(1.5).timeout
		_reset()


func _reset() -> void:
	if banner_layer != null:
		banner_layer.queue_free()
		banner_layer = null
	hp = start_hp if (hp >= 0 or fail_on_death) else -1.0
	for p in pickups:
		p["taken"] = false
	bag = {}
	for m in score.get("mechanics", []):
		if m is Dictionary and String(m.get("kind", "")) == "survive":
			survive_left = float(m.get("seconds", 30))
	walker.global_position = walker.spawn
	walker.velocity = Vector3.ZERO
	state = "playing"
	_update_hud()


func _unhandled_key_input(event: InputEvent) -> void:
	if not (event is InputEventKey and event.pressed):
		return
	if event.physical_keycode == KEY_0 and score.get("cameras", []).size() > 0:
		var view: Camera3D = get_node_or_null("View0")
		var head: Camera3D = walker.head if walker != null else null
		if view != null and head != null:
			if view.current:
				head.make_current()
			else:
				view.make_current()
	if event.physical_keycode == KEY_M and _game() != null:
		_game().to_menu()
