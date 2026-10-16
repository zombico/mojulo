extends SceneTree
# The Godot side of the scenes conformance corpus (lib/graph/scene/scenes-conformance.js): each scenario's frames
# through kernel/scenes.gd, each journal's flags through kernel/quests.gd, one canonical snapshot a step.
#
#   godot --headless --path <scratch> --script res://conformance.gd -- <corpus.json> <out.json>


static func _nano(x) -> float:
	return floor(float(x) * 1e9 + 0.5) / 1e9


func _init() -> void:
	var args := OS.get_cmdline_user_args()
	var corpus = load("res://kernel/json_exact.gd").parse(FileAccess.get_file_as_string(args[0]))
	var Bus = load("res://kernel/bus.gd")
	var R = load("res://kernel/scenes.gd").new()
	var Q = load("res://kernel/quests.gd")
	var results := {}
	for sc in corpus["scenes"]:
		var S: Dictionary = R.create(corpus["program"].duplicate(true))
		var vars := {}
		var snaps := []
		for f in sc["frames"]:
			if f.get("vars") is Dictionary:
				vars.merge(f["vars"], true)
			R.hear(S, f.get("heard", []))
			var ctl: Dictionary = (f.get("ctl", {}) as Dictionary).duplicate()
			ctl["vars"] = vars
			var out: Dictionary = R.step(S, 1.0 / 30.0, ctl)
			var v: Dictionary = R.view(S)
			v["bars"] = _nano(v["bars"])
			snaps.append(Bus.ss({"out": out, "view": v}))
		results[sc["id"]] = snaps
	for j in corpus["journal"]:
		var vars := {}
		var snaps := []
		for set in j["flags"]:
			for f in set:
				vars["flag-" + String(f)] = 1
			snaps.append(Bus.ss({"view": Q.view(corpus["quests"], vars), "news": Q.news(corpus["quests"], set)}))
		results[j["id"]] = snaps
	var out := FileAccess.open(args[1], FileAccess.WRITE)
	out.store_string(JSON.stringify(results))
	out.close()
	quit(0)
