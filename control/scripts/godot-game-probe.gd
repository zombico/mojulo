extends Node
# A game played through, headless: an autoload beside Game that survives the scene changes. It reads the gates,
# plays the first level (the walker set down at a place, the interact key pressed there), lets the level end and
# Game apply its outcome, then starts the second level and reads what was carried in. Prints [mojulo-game] lines
# for lib/graph/scene/godot-bus-level.test.js. The place comes from the user args: -- <x> <y> (z-up metres).

const Js := preload("res://kernel/js.gd")

var f := 0
var at := Vector2.ZERO
var refs: Array = []


func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	at = Vector2(float(args[0]), float(args[1]))
	for p in ["user://store.json", "user://progress.cfg"]:
		DirAccess.remove_absolute(ProjectSettings.globalize_path(p))


func _gates() -> String:
	var g = get_node("/root/Game")
	var out := []
	for i in g.levels.size():
		out.append("%s:%s" % [g.levels[i]["ref"], str(g.is_unlocked(i))])
	return ",".join(out)


func _process(_delta: float) -> void:
	f += 1
	var g = get_node("/root/Game")
	if f == 5:
		print("[mojulo-game] start gates=%s" % _gates())
		g.start_level(g.levels[0]["ref"])
	elif f == 20:
		var lv = get_tree().current_scene
		lv.walker.global_position = Vector3(at.x, lv.walker.global_position.y, -at.y)
	elif f == 25:
		get_tree().current_scene.bus_interact = true
	elif f == 40:
		var lv = get_tree().current_scene
		print("[mojulo-game] played state=%s events=%s" % [lv.state, Js.ss(lv.channel.get("events", []))])
	elif f == 160:
		print("[mojulo-game] after gates=%s store=%s saved=%s" % [_gates(), Js.ss(g.state), str(FileAccess.file_exists("user://store.json"))])
		g.start_level(g.levels[1]["ref"])
	elif f == 180:
		var lv = get_tree().current_scene
		print("[mojulo-game] carried vars=%s" % Js.ss(lv.bus_state["vars"]))
		for p in ["user://store.json", "user://progress.cfg"]:
			DirAccess.remove_absolute(ProjectSettings.globalize_path(p))
		get_tree().quit(0)
