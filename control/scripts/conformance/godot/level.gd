extends SceneTree
# The Godot side of the level corpus (lib/graph/scene/level-conformance.js): each level's bus built from its config, its
# game channel (kernel/game_channel.gd) from its contract and session, stepped over the track the web recorded (where
# every body stands as a frame begins) in the page's order: the session's start events and the frame's presses, the
# zone facts, the bus's frame, the warps and intents it queued, the channel hearing the frame's log. Each frame's bus
# hash, ctrl and channel (door, envelope) written out. scripts/conformance.mjs --engine godot --corpus level copies this
# beside the kernel in a scratch project, runs it headless and compares.
#
#   godot --headless --path <scratch> --script res://conformance.gd -- <corpus.json> <out.json>

const Js := preload("res://kernel/js.gd")
const GameChannel := preload("res://kernel/game_channel.gd")


func _init() -> void:
	var args := OS.get_cmdline_user_args()
	var corpus = load("res://kernel/json_exact.gd").parse(FileAccess.get_file_as_string(args[0]))
	var Bus = load("res://kernel/bus.gd")
	var results := {}
	for sc in corpus:
		var config: Dictionary = sc.get("config", {}) if sc.get("config") is Dictionary else {}
		var bus = Bus.new()
		var st: Dictionary = bus.create_bus_state(config, config.get("entities", []) if config.get("entities") is Array else [])
		if config.get("stats") is Dictionary:
			bus.stats = load("res://kernel/stats.gd").new()
			bus.stats_cfg = config["stats"]
		if config.get("initial") is Array:
			bus.process_events(st, (config["initial"] as Array).duplicate(true))
		var sources: Array = config.get("sources", []) if config.get("sources") is Array else []
		var ch: Dictionary = GameChannel.create(sc.get("contract"), sc.get("params"))
		var first: Array = GameChannel.start(ch)
		var zone_prev = null
		var snaps := []
		for f in sc["frames"]:
			var n0: int = (st["log"] as Array).size()
			var incoming: Array = first
			first = []
			incoming.append_array((f.get("events", []) as Array).duplicate(true))
			var z: Dictionary = bus.derive_zone_events((f.get("walkers", []) as Array).duplicate(true), zone_prev, sources)
			zone_prev = z["prev"]
			incoming.append_array(z["events"])
			bus.frame(st, incoming, float(f.get("dt", 0.0)))
			var ctrl: Dictionary = bus.take_ctrl(st)
			st["_statBodyOps"] = []
			GameChannel.hear(ch, st["log"], n0)
			var said := {"door": GameChannel.door(ch), "envelope": GameChannel.envelope(ch, st["vars"])}
			snaps.append(bus.hash_state(st) + "|" + Js.ss(ctrl) + "|" + Js.ss(said))
		results[sc["id"]] = snaps
	var out := FileAccess.open(args[1], FileAccess.WRITE)
	out.store_string(JSON.stringify(results))
	out.close()
	quit(0)
