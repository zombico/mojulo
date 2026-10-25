extends SceneTree
# The Godot side of the rules conformance corpus (lib/graph/scene/rules-conformance.js): each scenario's pilot stepped by
# kernel/rules.gd over its triangles and colliders with its held input, one canonical snapshot a frame.
# scripts/conformance.mjs --engine godot --corpus rules copies this beside the kernel in a scratch project, runs it headless and compares.
#
#   godot --headless --path <scratch> --script res://conformance.gd -- <corpus.json> <out.json>

const Js := preload("res://kernel/js.gd")


func _init() -> void:
	var args := OS.get_cmdline_user_args()
	var corpus = load("res://kernel/json_exact.gd").parse(FileAccess.get_file_as_string(args[0]))
	var Bus = load("res://kernel/bus.gd")
	var Rules = load("res://kernel/rules.gd")
	var results := {}
	for sc in corpus:
		var r: Dictionary = sc["rule"]
		var e: Dictionary = Rules.entity(sc["pos"], float(sc["heading"]))
		var world := {"ground": Rules.make_ground(sc["tris"]), "colliders": sc["colliders"]}
		var snaps := []
		var cam = Rules.camera(sc["cameraAt"], 0.0) if sc.get("camera") is Dictionary else null
		# a carrier beside the pilot (a lift, a moving deck): stepped as kernel/level.gd steps the level's bodies, before
		# the pilot, the web's carry pass between them after both
		var car = sc.get("carrier")
		var ce = Rules.entity(car["pos"], float(car.get("heading", 0.0))) if car is Dictionary else null
		for inp in sc["input"]:
			var was = (ce["pos"] as Array).duplicate() if ce != null else null
			if ce != null:
				Rules.step(ce, car["rule"], {}, float(sc["dt"]), world)
			Rules.step(e, r, inp, float(sc["dt"]), world)
			if ce != null:
				Rules.carry_pass([{"id": car["id"], "ent": ce, "body": car["body"], "rule": car["rule"], "from": was}], [{"ent": e, "rule": r}])
			var snap: String = Js.ss(_snapshot(e, r))
			if cam != null:
				Rules.camera_step(cam, sc["camera"], e, r, float(sc["dt"]), world, {"hero": {"pos": e["pos"], "heading": e["heading"]}}, "hero")
				snap += "|" + Js.ss(_cam(cam))
			if ce != null:
				snap += "|" + Js.ss({"pos": (ce["pos"] as Array).map(_nano), "ridden": ce.get("_ridden") == true, "carried": e.get("carriedBy")})
			snaps.append(snap)
		results[sc["id"]] = snaps
	var out := FileAccess.open(args[1], FileAccess.WRITE)
	out.store_string(JSON.stringify(results))
	out.close()
	quit(0)


static func _nano(x) -> float:
	return floor(float(x) * 1e9 + 0.5) / 1e9


func _cam(c: Dictionary) -> Dictionary:
	var d := {"pos": (c["pos"] as Array).map(_nano), "heading": _nano(c["heading"]), "pitch": _nano(c.get("pitch", 0.0)), "lookAt": (c["lookAt"] as Array).map(_nano) if c["lookAt"] is Array else null}
	if c.has("roll"):
		d["roll"] = _nano(c["roll"])
	return d


func _snapshot(e: Dictionary, r: Dictionary) -> Dictionary:
	var s := {"pos": (e["pos"] as Array).map(_nano), "heading": _nano(e["heading"]), "pitch": _nano(e.get("pitch", 0.0)), "vz": _nano(e["vel"][2]),
		"gait": _nano(e.get("gaitPhase", 0.0)), "moving": bool(e.get("moving", false))}
	if r.get("type") == "platform":
		s["grounded"] = bool(e.get("grounded", false))
		s["coyote"] = _nano(e.get("coyote", 0.0))
		s["buf"] = _nano(e.get("jumpBuf", 0.0))
		s["wind"] = _nano(e.get("jumpWind", 0.0))
		s["air"] = e.get("airJumpsUsed", 0)
		s["loco"] = e.get("locomotion")
		s["jumped"] = bool(e.get("jumped", false))
		s["landed"] = bool(e.get("landed", false))
		s["boosting"] = bool(e.get("boosting", false))
		s["boost"] = null if e.get("boost") == null else _nano(e["boost"])
		s["lock"] = bool(e.get("boostLock", false))
	if r.get("type") == "drive" or r.get("type") == "racer":
		s["speed"] = _nano(e.get("speed", 0.0))
		s["steer"] = _nano(e.get("steerAngle", 0.0))
		s["cvz"] = _nano(e.get("vz", 0.0) if e.get("vz") != null else 0.0)
		s["airborne"] = bool(e.get("airborne", false))
		s["wheel"] = _nano(e.get("wheelPhase", 0.0))
		s["braking"] = bool(e.get("braking", false))
		s["skidding"] = null if r.get("lateralGrip") else bool(e.get("skidding", false))
		s["lean"] = null if e.get("lean") == null else _nano(e["lean"])
	if r.get("type") == "racer":
		s["lineAt"] = e.get("lineAt")
		s["laps"] = e.get("laps", 0)
		s["stuckT"] = _nano(e.get("stuckT", 0.0))
		s["backT"] = _nano(e.get("backT", 0.0))
	if r.get("type") == "fly":
		s["airspeed"] = _nano(e.get("airspeed", 0.0))
		s["bank"] = _nano(e.get("bank", 0.0))
		s["airborne"] = bool(e.get("airborne", false))
		s["stalled"] = bool(e.get("stalled", false))
		s["takeoff"] = bool(e.get("takeoff", false))
		s["touchdown"] = bool(e.get("touchdown", false))
		s["climb"] = _nano(e.get("climbRate", 0.0))
		s["loco"] = e.get("locomotion")
		s["lever"] = _nano(e["lever"]) if e.get("lever") != null else null
		s["boostE"] = _nano(e["boostE"]) if e.get("boostE") != null else null
		s["boosting"] = e.get("boosting") == true
		s["rolling"] = e.get("rolling") == true
		s["oob"] = e.get("outOfBounds") == true
		s["roll"] = _nano((e["tilt"] as Dictionary).get("roll", 0.0) if e.get("tilt") is Dictionary else 0.0)
	return s
