extends SceneTree
# The sound conformance runner (scripts/godot-sound-conformance.mjs): kernel/sound.gd's meter and change over the
# corpus, written as JSON for the Node side to compare with the page's (adaptive-music.js buildAdaptive).

const Sound := preload("res://kernel/sound.gd")


func _init() -> void:
	var args := OS.get_cmdline_user_args()
	var corpus = JSON.parse_string(FileAccess.get_file_as_string(args[0]))
	var out := {"globs": [], "bars": [], "traces": []}
	for g in corpus["globs"]:
		out["globs"].append(Sound.glob(String(g[0]), String(g[1])))
	for b in corpus["bars"]:
		out["bars"].append(Sound.next_bar(float(b[0]), float(b[1]), float(b[2])))
	for tr in corpus["traces"]:
		var cfg: Dictionary = tr["cfg"]
		var st := {"active": "explore", "below": 0.0}
		var t := 0.0
		var rows := []
		for f in tr["frames"]:
			for ev in f["events"]:
				t = Sound.raise(t, String(ev), cfg["on"])
			t = Sound.leak(t, float(f["dt"]), float(cfg["decay"]))
			var nx: Dictionary = Sound.decide(st, t, float(f["dt"]), cfg, float(tr["bar"]))
			rows.append([t, nx["active"], nx["below"], nx.get("to", "")])
			st = {"active": nx["active"], "below": nx["below"]}
		out["traces"].append(rows)
	var fh := FileAccess.open(args[1], FileAccess.WRITE)
	fh.store_string(JSON.stringify(out, "", false, true))
	fh.close()
	quit(0)
