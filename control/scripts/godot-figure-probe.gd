# godot-figure-probe.gd — the machine-gate FIGURE probe (a rigged layered figure's pack; export-godot.mjs).
#   godot --headless --path <pack> --script <this file> [-- res://level.tscn [<clip>]]
# Loads res://model.glb as Godot imported it and reports the skeleton, the AnimationPlayer's clips and how many
# surfaces came in compressed or with LODs; then runs the pack's scene for a few frames and reports the clip it
# plays, its loop mode and the current camera. A second argument sets the scene's `clip` before it enters the tree
# (the ambient layer's run). Gate-only: nothing of this rides the pack. One line:
#   [mojulo-figure] skeletons=N bones=N players=N animations=a,b,… compressed=N lods=N playing=<anim> loop=N camera=<node>
# A figure whose mesh carries blend shapes (the anime face) adds: shapes=a,b,… (the blend shapes by name), face=v,…
# (their values when the scene is ready, before anything plays), face_tracks=<anim>:N,… (the blend-shape tracks of
# each clip), lengths=<anim>:s,… (each clip's length) and tree=0|1 (an active AnimationTree; its body clip is then the
# one playing).
extends SceneTree

var _scene: Node = null
var _frames := 0
var _line := ""
var _face_line := ""


func _blend_mesh(root: Node) -> MeshInstance3D:
	for n in root.find_children("*", "MeshInstance3D", true, false):
		var mi := n as MeshInstance3D
		if mi.mesh != null and mi.mesh.get_blend_shape_count() > 0:
			return mi
	return null


func _init() -> void:
	var packed := load("res://model.glb")
	if not (packed is PackedScene):
		print("[mojulo-figure] error=model_glb_not_a_scene")
		quit(1)
		return
	var root: Node = (packed as PackedScene).instantiate()
	var skels := root.find_children("*", "Skeleton3D", true, false)
	var players := root.find_children("*", "AnimationPlayer", true, false)
	var anims := (players[0] as AnimationPlayer).get_animation_list() if players.size() > 0 else PackedStringArray()
	var compressed := 0
	var lods := 0
	for mi in root.find_children("*", "MeshInstance3D", true, false):
		var m: Mesh = (mi as MeshInstance3D).mesh
		if m == null:
			continue
		for s in range(m.get_surface_count()):
			if (m.surface_get_format(s) & Mesh.ARRAY_FLAG_COMPRESS_ATTRIBUTES) != 0:
				compressed += 1
			lods += (RenderingServer.mesh_get_surface(m.get_rid(), s).get("lods", []) as Array).size()
	var bones: int = (skels[0] as Skeleton3D).get_bone_count() if skels.size() > 0 else 0
	_line = "skeletons=%d bones=%d players=%d animations=%s compressed=%d lods=%d" % [skels.size(), bones, players.size(), ",".join(anims), compressed, lods]
	var bm := _blend_mesh(root)
	if bm != null and players.size() > 0:
		var shapes := PackedStringArray()
		for i in bm.mesh.get_blend_shape_count():
			shapes.append(str(bm.mesh.get_blend_shape_name(i)))
		var ap := players[0] as AnimationPlayer
		var tracks := PackedStringArray()
		var lengths := PackedStringArray()
		for a in anims:
			var anim := ap.get_animation(a)
			var n := 0
			for t in anim.get_track_count():
				if anim.track_get_type(t) == Animation.TYPE_BLEND_SHAPE:
					n += 1
			tracks.append("%s:%d" % [a, n])
			lengths.append("%s:%s" % [a, str(snappedf(anim.length, 0.0001))])
		_face_line = " shapes=%s face_tracks=%s lengths=%s" % [",".join(shapes), ",".join(tracks), ",".join(lengths)]
	root.free()
	var args := OS.get_cmdline_user_args()
	var scene := load(args[0] if args.size() > 0 else "res://level.tscn")
	if not (scene is PackedScene):
		print("[mojulo-figure] %s error=scene_not_loaded" % _line)
		quit(1)
		return
	_scene = (scene as PackedScene).instantiate()
	if args.size() > 1:
		_scene.set("clip", args[1])
	get_root().add_child(_scene)


func _process(_delta: float) -> bool:
	_frames += 1
	if _frames == 1 and _face_line != "":
		# the scene is ready and nothing has played yet: the blend shapes as the scene's script left them
		var mi := _blend_mesh(_scene)
		var vals := PackedStringArray()
		if mi != null:
			for i in mi.mesh.get_blend_shape_count():
				vals.append(str(snappedf(mi.get_blend_shape_value(i), 0.000001)))
		_face_line += " face=%s" % ",".join(vals)
	if _frames < 3:
		return false
	var playing := ""
	var loop := -1
	var tree := 0
	for t in _scene.find_children("*", "AnimationTree", true, false):
		var at := t as AnimationTree
		if at.active and at.tree_root is AnimationNodeBlendTree and (at.tree_root as AnimationNodeBlendTree).has_node("body"):
			tree = 1
			var body := ((at.tree_root as AnimationNodeBlendTree).get_node("body") as AnimationNodeAnimation).animation
			var ap := at.get_node(at.anim_player) as AnimationPlayer
			playing = str(body)
			loop = ap.get_animation(body).loop_mode if ap != null and ap.has_animation(body) else -1
			break
	if tree == 0:
		for p in _scene.find_children("*", "AnimationPlayer", true, false):
			var ap := p as AnimationPlayer
			if ap.current_animation != "":
				playing = ap.current_animation
				loop = ap.get_animation(playing).loop_mode
				break
	var cam := get_root().get_viewport().get_camera_3d()
	var tail := "%s tree=%d" % [_face_line, tree] if _face_line != "" else ""
	print("[mojulo-figure] %s playing=%s loop=%d camera=%s%s" % [_line, playing, loop, String(cam.name) if cam != null else "", tail])
	quit(0)
	return true
