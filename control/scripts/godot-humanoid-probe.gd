# godot-humanoid-probe.gd — what Godot made of a skinned figure GLB export_model wrote, and where its bones stand as it
# plays a clip (gate-only; nothing of it rides an export). export-model.godot-humanoid.test.js holds a humanoid GLB's
# import (its BoneMap and .import, godot-humanoid.js) to the flat GLB of the same figure.
#   godot --headless --path <project> --script <this file> -- <res://…/model.glb> <anim> <t1,t2,…> <bone1,bone2,…>
# One line for the import:
#   [mojulo-humanoid] {"skeletons":N,"skeleton":"<name>","bones":N,"hips":0|1,"animations":[…]}
# then one line per bone: [mojulo-pose] <bone> x,y,z x,y,z … (its global origin at each time; "missing" when the
# skeleton has no such bone).
extends SceneTree

var _scene: Node = null
var _frames := 0


func _init() -> void:
	var args := OS.get_cmdline_user_args()
	var packed := load(args[0])
	if not (packed is PackedScene):
		print("[mojulo-humanoid] " + JSON.stringify({ "error": "not_a_scene" }))
		quit(1)
		return
	_scene = (packed as PackedScene).instantiate()
	get_root().add_child(_scene)


func _process(_delta: float) -> bool:
	_frames += 1
	if _frames < 3:
		return false
	var args := OS.get_cmdline_user_args()
	var skels := _scene.find_children("*", "Skeleton3D", true, false)
	var players := _scene.find_children("*", "AnimationPlayer", true, false)
	var sk := skels[0] as Skeleton3D if skels.size() > 0 else null
	var ap := players[0] as AnimationPlayer if players.size() > 0 else null
	var anims := Array(ap.get_animation_list()) if ap != null else []
	print("[mojulo-humanoid] " + JSON.stringify({ "skeletons": skels.size(), "skeleton": String(sk.name) if sk != null else "",
		"bones": sk.get_bone_count() if sk != null else 0, "hips": 1 if sk != null and sk.find_bone("Hips") >= 0 else 0, "animations": anims }))
	if sk == null or ap == null:
		quit(1)
		return true
	var times := Array(args[2].split(",")).map(func(t): return float(t))
	for bone in args[3].split(","):
		var bi := sk.find_bone(bone)
		if bi < 0:
			print("[mojulo-pose] %s missing" % bone)
			continue
		var out := PackedStringArray()
		for t in times:
			ap.play(args[1])
			ap.seek(t, true)
			var o := (sk.global_transform * sk.get_bone_global_pose(bi)).origin
			out.append("%.5f,%.5f,%.5f" % [o.x, o.y, o.z])
		print("[mojulo-pose] %s %s" % [bone, " ".join(out)])
	quit(0)
	return true
