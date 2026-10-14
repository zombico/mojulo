extends SceneTree
# The level's sound inside a real level (kernel/level.gd), headless: the level is built from <pack>/score.json, its
# bus.json and contract.json, the walker is set down facing the foes and swings `swings` times, then stands still
# while the tension leaks. Every sound played and every change of score is printed with its frame, and the buses at
# the start. lib/graph/scene/godot-sound.test.js writes the pack and reads the [mojulo-sound] lines.
#
#   godot --headless --path <pack> --script res://probe.gd -- <x> <y> <tx> <ty> <swings> <frames>

var level: Node3D
var f := 0
var at := Vector2.ZERO
var face := Vector2.ZERO
var swings := 2
var frames := 900


func _init() -> void:
	var args := OS.get_cmdline_user_args()
	at = Vector2(float(args[0]), float(args[1]))
	face = Vector2(float(args[2]), float(args[3]))
	swings = int(args[4])
	frames = int(args[5])
	level = Node3D.new()
	level.set_script(load("res://kernel/level.gd"))
	level.score_path = "res://score.json"
	level.music_path = "res://audio/explore.wav"
	root.add_child(level)


func _process(_delta: float) -> bool:
	f += 1
	if f == 2:
		var names := []
		for i in range(AudioServer.bus_count):
			names.append(AudioServer.get_bus_name(i))
		var m := AudioServer.get_bus_index("Music")
		var fx := AudioServer.get_bus_effect(m, 0).get_class() if m >= 0 and AudioServer.get_bus_effect_count(m) > 0 else "none"
		var snd = level.get_node_or_null("Sound")
		print("[mojulo-sound] start buses=%s duck=%s sounds=%d fight=%s music_bus=%s" % [",".join(names), fx, snd.players.size() if snd else -1, str(snd != null and snd.fight != null), level.get_node("Music").bus if level.get_node_or_null("Music") else "none"])
		if snd != null:
			snd.played.connect(func(id: String) -> void: print("[mojulo-sound] played %s f=%d" % [id, f]))
			snd.music_changed.connect(func(to: String) -> void: print("[mojulo-sound] music %s f=%d t=%.3f" % [to, f, snd.tension]))
	elif f == 5:
		level.walker.global_position = Vector3(at.x, level.walker.global_position.y, -at.y)
		var d := Vector2(face.x - at.x, -(face.y - at.y))
		level.walker.rotation.y = atan2(-d.x, -d.y)
	elif f >= 20 and f < 20 + 40 * swings:
		level.combat_fire = (f - 20) % 40 < 3
	elif f == frames:
		var snd = level.get_node_or_null("Sound")
		print("[mojulo-sound] end active=%s t=%.3f" % [snd.music["active"], snd.tension])
		quit(0)
	return false
