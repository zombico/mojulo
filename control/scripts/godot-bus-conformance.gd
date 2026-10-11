extends SceneTree
# The Godot side of the bus conformance corpus (lib/graph/scene/bus-conformance.js): runs every scenario through
# kernel/bus.gd in the web page's frame order and writes each frame's snapshot. scripts/godot-bus-conformance.mjs
# copies this beside the kernel in a scratch project, runs it headless and compares.
#
#   godot --headless --path <scratch> --script res://conformance.gd -- <corpus.json> <out.json>


func _init() -> void:
	var args := OS.get_cmdline_user_args()
	var corpus = load("res://kernel/json_exact.gd").parse(FileAccess.get_file_as_string(args[0]))
	var Bus = load("res://kernel/bus.gd")
	var results := {}
	for sc in corpus:
		var bus = Bus.new()
		var st: Dictionary = bus.create_bus_state(sc.get("config", {}), sc.get("entities", []))
		var sources: Array = sc.get("config", {}).get("sources", []) if typeof(sc.get("config", {}).get("sources")) == TYPE_ARRAY else []
		var zone_prev = null
		var snaps := []
		for f in sc["frames"]:
			var incoming: Array = (f.get("events", []) as Array).duplicate(true)
			if f.has("walkers"):
				var z: Dictionary = bus.derive_zone_events(f["walkers"], zone_prev, sources)
				zone_prev = z["prev"]
				incoming.append_array(z["events"])
			bus.frame(st, incoming, float(f.get("dt", 0.0)))
			var ctrl: Dictionary = bus.take_ctrl(st)
			snaps.append(bus.hash_state(st) + "|" + bus.ss(ctrl))
		results[sc["id"]] = snaps
	var out := FileAccess.open(args[1], FileAccess.WRITE)
	out.store_string(JSON.stringify(results))
	out.close()
	quit(0)
