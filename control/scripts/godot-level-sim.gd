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
var waited := 0


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
		# a game pack starts the level through Game (its scene arrives a frame later); a world pack's main scene is the
		# level already, and it is handed its input this very frame, before it runs one of its own
		if get_node_or_null("/root/Game") != null:
			get_node("/root/Game").start_level(String(sim["ref"]))
			return
	var lv = get_tree().current_scene
	waited += 1
	if lv == null or not ("sim_frame" in lv):
		# a level that never comes (a script error, a missing scene) fails the run, never hangs it
		if waited > 300:
			print("[mojulo-sim] error no level after 300 frames")
			get_tree().quit(1)
		return
	if not handed:
		handed = true
		print("[mojulo-sim] start %s frames=%d" % [String(sim["ref"]), (sim["frames"] as Array).size()])
		lv.sim_start(sim["frames"], sim["ids"], sim.get("feet", {}))
		return
	if lv.sim_frame >= (sim["frames"] as Array).size() or lv.state != "playing":
		print("[mojulo-sim] done state=%s frame=%d" % [lv.state, lv.sim_frame])
		# the sky's clock dial (kernel 0.22.0): the night, the dim shown, the season, the state
		var wx = lv.get_node_or_null("MojuloWeather")
		if wx != null and wx.clock_on:
			print("[mojulo-dial] night=%.4f dim=%.4f season=%d state=%s" % [wx.night, float(wx.shown.get("dim", 0.0)), wx.season, String(wx.shown.get("a", ""))])
		# the markers as drawn (the bus's entities, kernel 0.22.0): id, shown, where (recipe units, in 5 cm quanta)
		if "marker_nodes" in lv:
			var rows := []
			for id in lv.marker_nodes:
				var m: MeshInstance3D = lv.marker_nodes[id]
				var p: Vector3 = m.position / lv.bus_units
				rows.append("%s:%s:%d,%d,%d" % [id, "on" if m.visible else "off", lv._sim_q(p.x, 0.05), lv._sim_q(-p.z, 0.05), lv._sim_q(p.y, 0.05)])
			rows.sort()
			print("[mojulo-markers] " + " ".join(rows))
		for p in ["user://store.json", "user://progress.cfg"]:
			DirAccess.remove_absolute(ProjectSettings.globalize_path(p))
		get_tree().quit(0)
