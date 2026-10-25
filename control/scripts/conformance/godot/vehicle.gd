extends SceneTree
# The Godot side of the vehicle conformance corpus (lib/graph/scene/vehicle-conformance.js): each scenario's machine
# driven by kernel/rules.gd over its triangles with its held input, the facts a game sets laid on it, then posed and its
# juice read by kernel/vehicle.gd, one canonical string a frame.
# scripts/conformance.mjs --engine godot --corpus vehicle copies this beside the kernel in a scratch project, runs it headless and compares.
#
#   godot --headless --path <scratch> --script res://conformance.gd -- <corpus.json> <out.json>

const Js := preload("res://kernel/js.gd")


func _init() -> void:
	var args := OS.get_cmdline_user_args()
	var corpus = load("res://kernel/json_exact.gd").parse(FileAccess.get_file_as_string(args[0]))
	var Rules = load("res://kernel/rules.gd")
	var Vehicle = load("res://kernel/vehicle.gd")
	var results := {}
	for sc in corpus:
		var r: Dictionary = sc["rule"]
		var V: Dictionary = sc["vehicle"]
		var J: Dictionary = V["juice"]
		var e: Dictionary = Rules.entity(sc["pos"], 0.0)
		var world := {"ground": Rules.make_ground(sc["tris"]), "colliders": []}
		var dt := float(sc["dt"])
		var S: Dictionary = Vehicle.pose_state()
		var js: Dictionary = Vehicle.juice_state()
		var nb := 0
		for b in V["bones"]:
			if b["part"]:
				nb += 1
		var snaps := []
		var i := 0
		for f in sc["frames"]:
			Rules.step(e, r, f["input"], dt, world)
			if f.get("set") is Dictionary:
				for k in f["set"]:
					e[k] = f["set"][k]
			var t := float(i + 1) * dt
			i += 1
			var pose: Array = Vehicle.pose(V, S, e, dt, t)
			var d := minf(0.05, dt)
			var F: Dictionary = Vehicle.facts(r, e, js, d)
			var on := []
			for row in (J["rows"] as Array) + (J.get("fx", []) as Array):
				if Vehicle.when(row["when"], F) != 0.0:
					on.append(row["id"])
			# the slots' bones count the bones with a part, as the page's uniforms do
			var st: Dictionary = Vehicle.status(J, js, F, d, t, (V["bones"] as Array).size(), sc["slots"])
			var tint := []
			for k in (V["bones"] as Array).size():
				if V["bones"][k]["part"]:
					var u: Dictionary = st["u"][k]
					tint.append(((u["tint"] as Array) + [u["mix"]] + (u["mixCol"] as Array) + (u["add"] as Array)).map(_nano))
			var facts := {}
			for k in F:
				facts[k] = _nano(F[k])
			var halo := {}
			for k in st["halo"]:
				halo[k] = _nano(st["halo"][k])
			var bub = st["bubble"]
			snaps.append(Js.ss({"pose": pose.map(func(b): return (b as Array).map(_nano)), "facts": facts, "on": on, "tint": tint, "halo": halo,
				"bubble": {"on": bub["on"], "col": (bub["col"] as Array).map(_nano), "a": _nano(bub["a"])} if bub is Dictionary else null}))
		results[sc["id"]] = snaps
	var out := FileAccess.open(args[1], FileAccess.WRITE)
	out.store_string(JSON.stringify(results))
	out.close()
	quit(0)


static func _nano(x):
	if x == null or is_nan(float(x)) or is_inf(float(x)):
		return null
	return floor(float(x) * 1e9 + 0.5) / 1e9
