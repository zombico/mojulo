# godot-verify.gd — the Godot half of the interchange I4 gate (godot-handoff.plan.md G0).
#
# Standalone SceneTree script run by godot-verify.mjs:
#   godot --headless --path <tmp-project> --script res://godot-verify.gd -- <model.glb> [shot.png]
#
# Machine gate: runtime-import the GLB via GLTFDocument (the same API an exported
# Godot game would use), then assert the interchange contract:
#   - the file parses and generates a scene;
#   - rig clips imported (probe clip g_multi:forward — 1.0 s, K+1 = 13 keys);
#   - glTF cameras imported (cam:view 0);
#   - moj:* level semantics present in the raw glTF JSON (scene extras: spawn /
#     colliders / game; node extras: entity/rule/body) and visible as node metadata;
#   - KHR_materials_unlit + COLOR_0 vertex colours survive as Godot materials.
# Report is a single JSON line: GODOT_VERIFY_RESULT={...}; exit 0 iff pass.
#
# Eyes gate (optional second arg, run WITHOUT --headless): adds the scene to the
# tree, activates the imported cam:view 0, waits a few frames, saves a PNG.
extends SceneTree

const FRAMES_BEFORE_CAPTURE := 16
const PROBE_CLIP := "g_multi_forward"

var _report := {}
var _pass := false
var _capture_path := ""
var _scene_root: Node = null
var _frame := 0

# Godot sanitizes glTF names on import (":" etc. are invalid in node/animation
# names) — compare through this normalizer instead of guessing the exact result.
static func _norm(s: String) -> String:
	var out := ""
	for ch in s.to_lower():
		out += ch if (ch >= "a" and ch <= "z") or (ch >= "0" and ch <= "9") else "_"
	return out

func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	if args.is_empty():
		push_error("usage: godot --script godot-verify.gd -- <model.glb> [shot.png]")
		quit(2)
		return
	var glb_path: String = args[0]
	_capture_path = args[1] if args.size() > 1 else ""
	_verify(glb_path)
	print("GODOT_VERIFY_RESULT=" + JSON.stringify(_report))
	if _capture_path == "" or _scene_root == null:
		quit(0 if _pass else 1)

func _verify(glb_path: String) -> void:
	_report = { "glb": glb_path, "godot": Engine.get_version_info().string, "checks": {} }
	var checks: Dictionary = _report["checks"]

	var doc := GLTFDocument.new()
	var state := GLTFState.new()
	var err := doc.append_from_file(glb_path, state)
	checks["parses"] = err == OK
	if err != OK:
		_report["error"] = "append_from_file err=%d" % err
		return

	# ── raw glTF JSON (authoritative for what the FILE carries) ──
	var gj: Dictionary = state.json
	var animations: Array = gj.get("animations", [])
	var materials: Array = gj.get("materials", [])
	var scenes: Array = gj.get("scenes", [])
	_report["animations_total"] = animations.size()
	_report["cameras_total"] = (gj.get("cameras", []) as Array).size()
	var unlit := 0
	for m in materials:
		if (m as Dictionary).get("extensions", {}).has("KHR_materials_unlit"):
			unlit += 1
	_report["unlit_materials"] = unlit
	_report["materials_total"] = materials.size()
	var scene_extras: Dictionary = (scenes[0] as Dictionary).get("extras", {}) if scenes.size() > 0 else {}
	checks["moj_spawn"] = scene_extras.has("moj:spawn")
	checks["moj_colliders"] = scene_extras.has("moj:colliders")
	checks["moj_game"] = scene_extras.has("moj:game")
	_report["moj_spawn"] = scene_extras.get("moj:spawn", null)
	_report["moj_colliders_count"] = (scene_extras.get("moj:colliders", []) as Array).size()
	_report["moj_game"] = scene_extras.get("moj:game", null)
	var entity_nodes_in_file := []
	for n in gj.get("nodes", []):
		var nd := n as Dictionary
		if nd.get("extras", {}).has("moj:entity"):
			entity_nodes_in_file.append({ "name": nd.get("name", "?"), "extras": nd.get("extras") })
	_report["entity_nodes_in_file"] = entity_nodes_in_file
	checks["entity_extras_in_file"] = entity_nodes_in_file.size() > 0

	# Probe clip keys, from the FILE (authoritative — Godot resamples on import):
	# find the animation, follow its first sampler's input accessor to its count.
	var probe_file_keys := -1
	for a in animations:
		var ad := a as Dictionary
		if _norm(String(ad.get("name", ""))).contains(PROBE_CLIP):
			var samplers: Array = ad.get("samplers", [])
			if samplers.size() > 0:
				var input_idx: int = (samplers[0] as Dictionary).get("input", -1)
				var accessors: Array = gj.get("accessors", [])
				if input_idx >= 0 and input_idx < accessors.size():
					probe_file_keys = (accessors[input_idx] as Dictionary).get("count", -1)
			break
	_report["probe_keys_in_file"] = probe_file_keys
	checks["probe_keys_13_in_file"] = probe_file_keys == 13

	# ── generated scene (what an operator/game actually gets) ──
	_scene_root = doc.generate_scene(state)
	checks["generates_scene"] = _scene_root != null
	if _scene_root == null:
		return

	# Rig clips → AnimationPlayer.
	var players := _scene_root.find_children("*", "AnimationPlayer", true, false)
	checks["animation_player"] = players.size() > 0
	if players.size() > 0:
		var player: AnimationPlayer = players[0]
		var names := player.get_animation_list()
		_report["scene_animations"] = names.size()
		var probe := ""
		for n in names:
			if _norm(n).contains(PROBE_CLIP):
				probe = n
				break
		checks["probe_clip_found"] = probe != ""
		if probe != "":
			var anim := player.get_animation(probe)
			_report["probe_clip"] = probe
			_report["probe_length_s"] = anim.length
			_report["probe_tracks"] = anim.get_track_count()
			var keys := -1
			for t in anim.get_track_count():
				if anim.track_get_type(t) == Animation.TYPE_ROTATION_3D:
					keys = anim.track_get_key_count(t)
					break
			# Informational: Godot resamples imported clips (30 fps bake), so the
			# scene-side key count differs from the file's 13 by design.
			_report["probe_rotation_keys_resampled"] = keys
			checks["probe_length_1s"] = absf(anim.length - 1.0) < 0.001

	# glTF cameras → Camera3D nodes.
	var cams := _scene_root.find_children("*", "Camera3D", true, false)
	var cam_names := []
	for c in cams:
		cam_names.append(String(c.name))
	_report["scene_cameras"] = cam_names
	checks["camera_imported"] = cams.size() > 0

	# Extras as node METADATA on the generated scene (operator-facing): report
	# every distinct meta key we find rather than assuming a mapping.
	var meta_keys := {}
	var meta_nodes := 0
	var meta_sample := []
	var stack := [_scene_root]
	while stack.size() > 0:
		var node: Node = stack.pop_back()
		var keys := node.get_meta_list()
		if keys.size() > 0:
			meta_nodes += 1
			for key in keys:
				meta_keys[String(key)] = true
			if meta_sample.size() < 4:
				var vals := {}
				for key in keys:
					vals[String(key)] = node.get_meta(key)
				meta_sample.append({ "node": String(node.name), "meta": vals })
		for child in node.get_children():
			stack.push_back(child)
	_report["nodes_with_metadata"] = meta_nodes
	_report["metadata_keys_seen"] = meta_keys.keys()
	_report["metadata_sample"] = meta_sample

	# COLOR_0 + unlit survive as mesh arrays / materials (probe a bounded sample).
	var mis := _scene_root.find_children("*", "MeshInstance3D", true, false)
	_report["mesh_instances"] = mis.size()
	var with_colors := 0
	var unshaded := 0
	var vtx_albedo := 0
	var srgb_flagged := 0
	var probed := 0
	var first_albedo := ""
	for mi in mis:
		if probed >= 50:
			break
		var mesh: Mesh = mi.mesh
		if mesh == null or mesh.get_surface_count() == 0:
			continue
		probed += 1
		var arrays := mesh.surface_get_arrays(0)
		if arrays[Mesh.ARRAY_COLOR] != null:
			with_colors += 1
		var mat: Material = mi.get_active_material(0)
		if mat is BaseMaterial3D:
			if mat.shading_mode == BaseMaterial3D.SHADING_MODE_UNSHADED:
				unshaded += 1
			if mat.vertex_color_use_as_albedo:
				vtx_albedo += 1
			if mat.vertex_color_is_srgb:
				srgb_flagged += 1
			if first_albedo == "":
				first_albedo = mat.albedo_color.to_html(false)
	_report["meshes_probed"] = probed
	_report["meshes_with_vertex_colors"] = with_colors
	_report["materials_unshaded"] = unshaded
	# Findings, not gates: whether the importer wired COLOR_0 into the material
	# (vertex_color_use_as_albedo) is importer behavior the eyes gate judges.
	_report["materials_vertex_color_albedo"] = vtx_albedo
	_report["materials_vertex_color_srgb"] = srgb_flagged
	_report["first_albedo_color"] = first_albedo
	checks["vertex_colors_survive"] = with_colors > 0
	checks["unshaded_survives"] = unshaded > 0

	_pass = true
	for k in checks:
		if not checks[k]:
			_pass = false
	_report["pass"] = _pass

	# Eyes-gate setup (windowed run only): stage the scene, activate cam:view 0.
	if _capture_path != "":
		# G0 FINDING + REMEDY: neither Godot import path (runtime GLTFDocument,
		# editor --import) wires COLOR_0 into the material — vertex-coloured-only
		# faces render WHITE out of the box. The one-flag fixup below is what a
		# generated G1 project must apply (mojulo COLOR_0 is linear: srgb stays off).
		for mi in mis:
			var mesh: Mesh = mi.mesh
			if mesh == null:
				continue
			for s in mesh.get_surface_count():
				var mat: Material = mi.get_active_material(s)
				if mat is BaseMaterial3D:
					mat.vertex_color_use_as_albedo = true
		root.add_child(_scene_root)
		var pick: Camera3D = null
		for c in cams:
			if _norm(String(c.name)).contains("view_0"):
				pick = c
				break
		if pick == null and cams.size() > 0:
			pick = cams[0]
		if pick != null:
			pick.current = true

func _process(_delta: float) -> bool:
	if _capture_path == "" or _scene_root == null:
		return true
	_frame += 1
	if _frame < FRAMES_BEFORE_CAPTURE:
		return false
	var img := root.get_viewport().get_texture().get_image()
	var err := img.save_png(_capture_path)
	print("GODOT_VERIFY_SHOT=" + JSON.stringify({ "path": _capture_path, "ok": err == OK, "size": [img.get_width(), img.get_height()] }))
	quit(0 if _pass else 1)
	return true
