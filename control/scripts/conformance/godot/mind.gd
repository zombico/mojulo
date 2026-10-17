extends SceneTree
# The Godot side of the mind conformance corpus (lib/graph/scene/mind-conformance.js): each scenario's cast, combat and
# minds from bus.json, the pilot's pose replayed from the web's trace, kernel/mind.gd deciding for every mind (with
# kernel/nav.gd's paths) and kernel/combat.gd firing and swinging for it; one snapshot a frame.
# scripts/conformance.mjs --engine godot --corpus mind copies this beside the kernel in a scratch project, runs it headless and compares.
#
#   godot --headless --path <scratch> --script res://conformance.gd -- <corpus.json> <out.json>

const Js := preload("res://kernel/js.gd")

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
		K.arm_minds(st, sc["minds"])
		var hero: Dictionary = st["byId"]["p"]
		C.facts(st)
		var snaps := []
		for f in sc["frames"]:
			for p in f.get("poke", []):
				_poke(st["byId"][p["id"]], String(p["key"]), p["value"])
			K.step(st, hero, f["input"], float(f["dt"]), bool(f["pilot"]["grounded"]), f["pilot"])
			C.step(st, float(f["dt"]))
			snaps.append(_snapshot(st, K, sc["mindIds"], sc["bodyIds"], C.facts(st)))
			if f.get("ops") is Array:
				C.ops(st, f["ops"])
		results[sc["id"]] = snaps
	var out := FileAccess.open(args[1], FileAccess.WRITE)
	out.store_string(JSON.stringify(results))
	out.close()
	quit(0)


# a poke's dotted key into the entity (the web's body.hp is the cast's hp)
func _poke(e: Dictionary, key: String, value) -> void:
	var ks := key.replace("body.hp", "hp").split(".")
	var t = e
	for i in ks.size() - 1:
		t = t[ks[i]]
	t[ks[ks.size() - 1]] = value


# a pose to 1e-9 (the corpus says why)
static func _nano(x):
	if x == null:
		return null
	return floor(float(x) * 1e9 + 0.5) / 1e9


const WEAPON_STATE := ["ammo", "reserve", "cooldownT", "reloading", "reloadT", "shots"]


func _snapshot(st: Dictionary, K, mind_ids: Array, body_ids: Array, events: Array) -> String:
	var minds := {}
	for id in mind_ids:
		var e: Dictionary = st["byId"][id]
		var m := {
			"pos": (e["pos"] as Array).map(_nano), "heading": _nano(e["heading"]), "pitch": _nano(e.get("pitch", 0.0)),
			"fire": 1 if Js.truthy(e.get("aiFire")) else 0, "loco": e.get("locomotion"), "moving": Js.truthy(e.get("moving")),
			"cover": (e["coverAt"] as Array).map(_nano) if e.get("coverAt") is Array else null,
			"seen": _nano(e["lastSeen"]["t"]) if e.get("lastSeen") is Dictionary else null, "sightings": int(e.get("sightings", 0)),
			"search": _nano(e.get("searchT")), "dodge": _nano(e.get("dodgeT")), "dodgeCd": _nano(e["dodgeCdT"] if Js.truthy(e.get("dodgeCdT")) else 0.0),
			"swing": _nano(e.get("swingT")), "strikeCd": _nano(e["strikeCdT"] if Js.truthy(e.get("strikeCdT")) else 0.0),
			"slot": int(e["loadoutIdx"]) if Js.truthy(e.get("loadoutIdx")) else 0, "ready": _nano(e["readyT"] if Js.truthy(e.get("readyT")) else 0.0),
			"phase": e.get("mindPhase"), "path": (e["navPath"] as Array).size() if e.get("navPath") is Array else null,
			"warn": e.get("warnFor"), "graze": _nano(e["grazeT"] if Js.truthy(e.get("grazeT")) else 0.0),
		}
		if e.get("weapon") is Dictionary:
			var w: Dictionary = e["weapon"]
			var ws := []
			for k in WEAPON_STATE:
				var v = w.get(k)
				ws.append(_nano(v) if (v is float or v is int) else v)
			m["weapon"] = ws
		minds[id] = m
	var bodies := {}
	for id in body_ids:
		var e: Dictionary = st["byId"][id]
		bodies[id] = {"hp": _nano(e["hp"]) if Js.finite(e.get("hp")) else null, "hits": int(e.get("hits", 0)), "downed": Js.truthy(e.get("downed")),
			"stagger": _nano(e.get("staggerT")), "react": e.get("reactClip") if Js.finite(e.get("poise")) else null}
	var rounds := []
	for p in K.projectiles:
		rounds.append([(p["pos"] as Array).map(_nano), (p["vel"] as Array).map(_nano)])
	var seen := []
	for ev in events:
		if ev["type"] == "seen":
			seen.append([ev["entity"], ev.get("target")])
	return Js.ss({"minds": minds, "bodies": bodies, "rounds": rounds, "seen": seen})
