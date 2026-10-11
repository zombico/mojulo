extends SceneTree
# The keys inside a real level (kernel/level.gd), headless: the level is built from <pack>/score.json and its
# bus.json, each key is pressed at its frame (as the page names it: "1", "i"), and the level is dumped at the start,
# a few frames after each press and at the end. lib/graph/scene/godot-bus-level.test.js writes the pack and reads
# the [mojulo-bus] / [mojulo-hud] / [mojulo-menu] / [mojulo-stats] lines.
#
#   godot --headless --path <pack> --script res://probe.gd -- <key>@<frame> ...

var level: Node3D
var f := 0
var presses := {}
var end := 0


func _init() -> void:
	for a in OS.get_cmdline_user_args():
		var p := String(a).split("@")
		presses[int(p[1])] = p[0]
		end = maxi(end, int(p[1]) + 20)
	level = Node3D.new()
	level.set_script(load("res://kernel/level.gd"))
	level.score_path = "res://score.json"
	root.add_child(level)


func _process(_delta: float) -> bool:
	f += 1
	if f == 3:
		level._dump("start")
	if presses.has(f):
		level.press_key(presses[f])
	if presses.has(f - 10):
		level._dump("after-%s" % presses[f - 10])
	if f == end:
		level._dump("end")
		quit(0)
	return false
