extends Node
# THE LEVEL-EQUIVALENCE HARNESS, Godot's side: an autoload beside Game in an exported game pack. It starts the level
# the sim file names, hands the level its recorded input (level.gd sim_start: the walker stepped after the bus, at the
# fixed step the run is given), and quits when the input runs out or the level ends. level.gd prints a [mojulo-sim]
# key a frame; scripts/godot-fixture-matrix.mjs compares them with lib/graph/game/level-equivalence.js, frame by frame.
#
#   godot --headless --fixed-fps 30 --path <pack> -- --mojulo-sim=<abs path to sim.json>
#   sim.json: { ref, frames: [{ forward?, strafe?, turn?, lookDX?, jump? }], ids: [pilot, …], feet: { id: eye } }

var sim: Dictionary = {}
var started := false
var handed := false


func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if String(a).begins_with("--mojulo-sim="):
			sim = JSON.parse_string(FileAccess.get_file_as_string(String(a).substr("--mojulo-sim=".length())))
	Engine.physics_ticks_per_second = 30
	for p in ["user://store.json", "user://progress.cfg"]:
		DirAccess.remove_absolute(ProjectSettings.globalize_path(p))


func _process(_delta: float) -> void:
	if sim.is_empty():
		print("[mojulo-sim] error no sim file")
		get_tree().quit(1)
		return
	if not started:
		started = true
		get_node("/root/Game").start_level(String(sim["ref"]))
		return
	var lv = get_tree().current_scene
	if lv == null or not ("sim_frame" in lv):
		return
	if not handed:
		handed = true
		print("[mojulo-sim] start %s frames=%d" % [String(sim["ref"]), (sim["frames"] as Array).size()])
		lv.sim_start(sim["frames"], sim["ids"], sim.get("feet", {}))
		return
	if lv.sim_frame >= (sim["frames"] as Array).size() or lv.state != "playing":
		print("[mojulo-sim] done state=%s frame=%d" % [lv.state, lv.sim_frame])
		for p in ["user://store.json", "user://progress.cfg"]:
			DirAccess.remove_absolute(ProjectSettings.globalize_path(p))
		get_tree().quit(0)
