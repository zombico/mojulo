# godot-pose-probe.gd — where a figure's bones stand in the world as its scene plays a clip (gate-only; nothing of it
# rides the pack). godot-humanoid-pack.test.js holds a humanoid pack's bones on the flat pack's, key for key.
#   godot --headless --path <pack> --script <this file> -- <scene> <anim> <t1,t2,…> <bone1,bone2,…>
# One line per bone: [mojulo-pose] <bone> x,y,z x,y,z … (its global origin at each time; "missing" when the skeleton
# has no such bone).
extends SceneTree

var _scene: Node = null
var _frames := 0


func _init() -> void:
	var args := OS.get_cmdline_user_args()
	_scene = (load(args[0]) as PackedScene).instantiate()
	get_root().add_child(_scene)


func _process(_delta: float) -> bool:
	_frames += 1
	if _frames < 3:
		return false
	var args := OS.get_cmdline_user_args()
	var sk := _scene.find_children("*", "Skeleton3D", true, false)[0] as Skeleton3D
	var ap := _scene.find_children("*", "AnimationPlayer", true, false)[0] as AnimationPlayer
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
	return true
