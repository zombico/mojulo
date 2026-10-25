extends SceneTree
# The Godot side of the sprites conformance corpus (lib/graph/scene/sprites-conformance.js): each scenario's layer read
# by kernel/sfx.gd at each clock reading, its beads and the cards drawn, one canonical string a reading.
# scripts/conformance.mjs --engine godot --corpus sprites copies this beside the kernel in a scratch project, runs it headless and compares.
#
#   godot --headless --path <scratch> --script res://conformance.gd -- <corpus.json> <out.json>

const Js := preload("res://kernel/js.gd")


func _init() -> void:
	var args := OS.get_cmdline_user_args()
	var corpus = load("res://kernel/json_exact.gd").parse(FileAccess.get_file_as_string(args[0]))
	var Sfx = load("res://kernel/sfx.gd")
	var results := {}
	for sc in corpus:
		var snaps := []
		var size := float(sc["size"])
		for t in sc["clock"]:
			var bs: Array = Sfx.beads(String(sc["verb"]), sc["cc"], float(t) * float(sc["rate"]), sc["params"])
			var beads := []
			var cards := []
			for b in bs:
				beads.append([(b["p"] as Array).map(_nano), _nano(b["w"])])
				var c = Sfx.card(b, size)
				cards.append([_nano(c["size"]), _nano(c["opacity"])] if c != null else null)
			snaps.append(Js.ss({"beads": beads, "cards": cards}))
		results[sc["id"]] = snaps
	var out := FileAccess.open(args[1], FileAccess.WRITE)
	out.store_string(JSON.stringify(results))
	out.close()
	quit(0)


static func _nano(x):
	if x == null or is_nan(float(x)) or is_inf(float(x)):
		return null
	return floor(float(x) * 1e6 + 0.5) / 1e6   # the corpus says why 1e-6
