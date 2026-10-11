extends SceneTree
# The bus inside a real level (kernel/level.gd), headless: the level is built from <pack>/score.json and its bus.json,
# the walker is set down at a place, the interact key is pressed there, and the bus is dumped before and after; then
# the open menu's focus moves down and accepts, and the bus is dumped once more.
# lib/graph/scene/godot-bus-level.test.js writes the pack and reads the [mojulo-bus] lines.
#
#   godot --headless --path <pack> --script res://probe.gd -- <x> <y> [end]   (the place, in the score's z-up metres;
#                                                                            the frame of the last dump, 30)

var level: Node3D
var f := 0
var at := Vector2.ZERO
var end := 30


func _init() -> void:
	var args := OS.get_cmdline_user_args()
	at = Vector2(float(args[0]), float(args[1]))
	if args.size() > 2:
		end = int(args[2])
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
	elif f == 10:
		level._dump("there")
		level.bus_interact = true
	elif f == 20:
		level._dump("after")
		level.menu_do("down")
	elif f == 22:
		level.menu_do("accept")
	elif f == end:
		level._dump("picked")
		quit(0)
	return false
