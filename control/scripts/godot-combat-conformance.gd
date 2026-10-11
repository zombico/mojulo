extends SceneTree
# The Godot side of the combat conformance corpus (lib/graph/scene/combat-conformance.js): each scenario's cast and
# combat from bus.json, the hero's pose replayed from the web's trace, kernel/combat.gd's strike, contacts and hits,
# and kernel/cast.gd's facts; one snapshot a frame. scripts/godot-combat-conformance.mjs copies this beside the kernel
# in a scratch project, runs it headless and compares.
#
#   godot --headless --path <scratch> --script res://conformance.gd -- <corpus.json> <out.json>

var Bus = null


func _init() -> void:
	var args := OS.get_cmdline_user_args()
	var corpus = load("res://kernel/json_exact.gd").parse(FileAccess.get_file_as_string(args[0]))
	Bus = load("res://kernel/bus.gd")
	var Cast = load("res://kernel/cast.gd")
	var Combat = load("res://kernel/combat.gd")
	var results := {}
	for sc in corpus:
		var C = Cast.new()
		var st: Dictionary = C.create(sc["cast"])
		var K = Combat.new()
		K.arm(st, sc["combat"])
		C.facts(st)
		var hero: Dictionary = st["byId"]["hero"]
		var snaps := []
		for f in sc["frames"]:
			hero["pos"] = (f["hero"]["pos"] as Array).duplicate()
			hero["heading"] = float(f["hero"]["heading"])
			hero["pitch"] = float(f["hero"]["pitch"])
			K.step(st, hero, f["input"], float(f["dt"]), bool(f["hero"]["grounded"]))
			snaps.append(_snapshot(st, K, sc["bodies"], C.facts(st)))
			if f.get("ops") is Array:
				C.ops(st, f["ops"])
		results[sc["id"]] = snaps
	var out := FileAccess.open(args[1], FileAccess.WRITE)
	out.store_string(JSON.stringify(results))
	out.close()
	quit(0)


# a round's flight to 1e-9 (the corpus says why)
static func _nano(x) -> float:
	return floor(float(x) * 1e9 + 0.5) / 1e9


const WEAPON_STATE := ["ammo", "cooldownT", "reloading", "reloadT", "burstLeft", "shots", "prevFire", "charging", "chargeT", "chargeReady", "energy", "energyLock"]


func _snapshot(st: Dictionary, K, ids: Array, events: Array) -> String:
	var h: Dictionary = st["byId"]["hero"]
	var bodies := {}
	for id in ids:
		var e: Dictionary = st["byId"][id]
		var b := {"hp": e.get("hp"), "hits": e.get("hits", 0), "by": e.get("lastHitBy"), "downed": bool(e["downed"]), "hittable": bool(e.get("hittable", false)), "invincible": Bus.truthy(e.get("invincible"))}
		if Bus.finite(e.get("poise")):
			b["poise"] = e["poise"]
			b["staggerT"] = e["staggerT"]
			b["react"] = e["reactClip"]
			b["pause"] = e["downPauseT"]
		if Bus.finite(e.get("shieldHp")):
			b["shield"] = e["shieldHp"]
			b["broken"] = Bus.truthy(e.get("shieldBroken"))
		bodies[id] = b
	var facts := []
	for ev in events:
		var x := {"type": ev["type"], "entity": ev["entity"]}
		if String(ev["type"]).begins_with("hit:"):
			x["by"] = ev.get("by")
		facts.append(x)
	var hero := {"swingT": h.get("swingT"), "clip": h.get("swingClip"), "cd": h.get("strikeCdT", 0), "combo": h.get("comboT", 0), "chain": Bus.truthy(h.get("swingCombo")), "dir": h.get("lastSwingDir"), "swings": h.get("swingCount", 0), "dealt": h.get("meleeHitCount", 0)}
	if h.get("weapon") is Dictionary:
		var w := {}
		for k in WEAPON_STATE:
			w[k] = h["weapon"].get(k)
		hero["weapon"] = w
	var rounds := []
	for p in K.projectiles:
		rounds.append([(p["pos"] as Array).map(_nano), (p["vel"] as Array).map(_nano), p["age"]])
	return Bus.ss({"hero": hero, "bodies": bodies, "rounds": rounds, "facts": facts})
