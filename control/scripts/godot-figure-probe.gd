# godot-figure-probe.gd — the machine-gate FIGURE probe (a rigged layered figure's pack; export-godot.mjs).
#   godot --headless --path <pack> --script <this file> [-- res://level.tscn]
# Loads res://model.glb as Godot imported it and reports the skeleton, the AnimationPlayer's clips and how many
# surfaces came in compressed or with LODs; then runs the pack's scene for a few frames and reports the clip it
# plays, its loop mode and the current camera. Gate-only: nothing of this rides the pack. One line:
#   [mojulo-figure] skeletons=N bones=N players=N animations=a,b,… compressed=N lods=N playing=<anim> loop=N camera=<node>
extends SceneTree

var _scene: Node = null
var _frames := 0
var _line := ""


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
	root.free()
	var args := OS.get_cmdline_user_args()
	var scene := load(args[0] if args.size() > 0 else "res://level.tscn")
	if not (scene is PackedScene):
		print("[mojulo-figure] %s error=scene_not_loaded" % _line)
		quit(1)
		return
	_scene = (scene as PackedScene).instantiate()
	get_root().add_child(_scene)


func _process(_delta: float) -> bool:
	_frames += 1
	if _frames < 3:
		return false
	var playing := ""
	var loop := -1
	for p in _scene.find_children("*", "AnimationPlayer", true, false):
		var ap := p as AnimationPlayer
		if ap.current_animation != "":
			playing = ap.current_animation
			loop = ap.get_animation(playing).loop_mode
			break
	var cam := get_root().get_viewport().get_camera_3d()
	print("[mojulo-figure] %s playing=%s loop=%d camera=%s" % [_line, playing, loop, String(cam.name) if cam != null else ""])
	quit(0)
	return true
