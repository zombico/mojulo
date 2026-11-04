extends SceneTree
# The Godot side of the destructible physics corpus, its energy slice (lib/graph/scene/rupa-conformance.js): each
# scenario's blocks with their matter's numbers, stepped by kernel/rupa.gd under the world's settings with the blows of
# each frame, one canonical snapshot a frame (each block's state, its foot's height, its joules left).
# scripts/conformance.mjs --engine godot --corpus rupa copies this beside the kernel in a scratch project, runs it headless and compares.
#
#   godot --headless --path <scratch> --script res://conformance.gd -- <corpus.json> <out.json>


func _init() -> void:
	var args := OS.get_cmdline_user_args()
	var corpus = load("res://kernel/json_exact.gd").parse(FileAccess.get_file_as_string(args[0]))
	var Rupa = load("res://kernel/rupa.gd")
	var results := {}
	for sc in corpus:
		var state: Dictionary = Rupa.world(sc["blocks"], sc["world"], float(sc["floor"]))
		var snaps := []
		for f in int(sc["frames"]):
			var blows := []
			for b in sc["blows"]:
				if int(b["frame"]) == f:
					blows.append(b)
			Rupa.step(state, blows, float(sc["dt"]))
			snaps.append(Rupa.snapshot(state))
		results[sc["id"]] = snaps
	var out := FileAccess.open(args[1], FileAccess.WRITE)
	out.store_string(JSON.stringify(results))
	out.close()
	quit(0)
