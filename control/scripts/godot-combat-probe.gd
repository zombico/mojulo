extends SceneTree
# The fight inside a real level (kernel/level.gd), headless: the level is built from <pack>/score.json and its
# bus.json (and contract.json), the walker is set down at a place facing a point, and the fire is held for a few
# frames every 40, `swings` times; the level is dumped at the start, after each swing and at the end.
# lib/graph/scene/godot-bus-level.test.js writes the pack and reads the [mojulo-combat] / [mojulo-cast] lines.
#
#   godot --headless --path <pack> --script res://probe.gd -- <x> <y> <tx> <ty> [swings]   (the place and the point it
#                                     faces, in the score's z-up metres)

var level: Node3D
var f := 0
var at := Vector2.ZERO
var face := Vector2.ZERO
var swings := 3


func _init() -> void:
	var args := OS.get_cmdline_user_args()
	at = Vector2(float(args[0]), float(args[1]))
	face = Vector2(float(args[2]), float(args[3]))
	if args.size() > 4:
		swings = int(args[4])
	level = Node3D.new()
	level.set_script(load("res://kernel/level.gd"))
	level.score_path = "res://score.json"
	root.add_child(level)


func _process(_delta: float) -> bool:
	f += 1
	if f == 3:
		level._dump("start")
	elif f == 5:
		level.walker.global_position = Vector3(at.x, level.walker.global_position.y, -at.y)
		# face the point: the walker looks down its -Z
		var d := Vector2(face.x - at.x, -(face.y - at.y))
		level.walker.rotation.y = atan2(-d.x, -d.y)
	elif f >= 20 and f < 20 + 40 * swings:
		var k := (f - 20) % 40
		level.combat_fire = k < 3
		if k == 39:
			level._dump("swing-%d" % ((f - 20) / 40 + 1))
	elif f == 30 + 40 * swings:
		level._dump("end")
		quit(0)
	return false
