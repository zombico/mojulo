extends RefCounted
# mojulo-godot kernel — the CAST: what the bus may do to a character, and what a character tells the bus back. A port of
# the web's character world (lib/graph/worlds/controllable/cast.js castOps / castFacts / stepRoute) over plain data, in
# the bus's frame (z-up, recipe units, heading in radians); level.gd draws each character from it. What the port leaves
# to the web: a walk's collider push-out and ground snap (a character walks its straight lines on the ground it stands
# on) and transits (the look of a coming or going). Stuck is still found (a second closing less than a sixth of the
# pace). Puffs, explosions (a chain scattered by the web's own dice) and beams are moments on the cast's clock, as the
# web keeps them: a beam lands at its hit time and its target hears `struck` (since 0.18.0).
#
#   var C = preload("res://kernel/cast.gd").new()
#   var st = C.create(rows)              rows: [{ id, pos, heading?, dormant?, hp?, speed? }]
#   C.ops(st, ops)                       the bus's queued `ctrl` intents (bus.take_ctrl), in order (a spawn's `among`
#                                        picks the spot farthest from the living; its `guard` holds it unhittable)
#   C.step(st, dt)                       routes walk; the world clock moves
#   C.facts(st) → [event]                down · gone · spawned · arrive { at, last, pose? } · stuck · hit:<id> { by }
#                                        (once per hit kernel/combat.gd counted) · faded { is } · struck { by, beam? }

const Bus := preload("res://kernel/bus.gd")
const DEG := PI / 180.0
var _prev = null


func create(rows: Array) -> Dictionary:
	var st := {"time": 0.0, "entities": [], "byId": {}, "moments": []}
	for r in rows:
		if not (r is Dictionary) or not Bus.truthy(r.get("id")):
			continue
		var p: Array = r.get("pos", [0, 0, 0]) if r.get("pos") is Array else [0, 0, 0]
		var e := {
			"id": String(r["id"]), "pos": [float(p[0]), float(p[1]), float(p[2]) if p.size() > 2 else 0.0],
			"heading": float(r.get("heading", 0.0)) if Bus.finite(r.get("heading")) else 0.0,
			"dormant": Bus.truthy(r.get("dormant")), "gone": Bus.truthy(r.get("dormant")), "downed": false, "castDown": false,
			"route": null, "held": false, "pose": null, "speed": float(r["speed"]) if Bus.finite(r.get("speed")) else 2.5,
			"arrivals": 0, "arrivedAt": null, "arrivedLast": false, "stucks": 0, "statuses": {}, "faded": [], "moving": false,
		}
		if Bus.finite(r.get("hp")):
			e["hp"] = float(r["hp"])
			e["hpMax"] = float(r["hp"])
		e["foot"] = float(r["foot"]) if Bus.finite(r.get("foot")) else 0.0
		st["entities"].append(e)
		st["byId"][e["id"]] = e
	return st


static func _pt3(p: Array, z: float) -> Array:
	return [float(p[0]), float(p[1]), float(p[2]) if p.size() > 2 and Bus.finite(p[2]) else z]


func ops(st: Dictionary, list: Array) -> void:
	for o in list:
		if not (o is Dictionary):
			continue
		var op = o.get("op")
		if op == "shake":
			_moment(st, {"is": "shake", "at": [0.0, 0.0, 0.0], "k": float(o["k"]) if Bus.finite(o.get("k")) else 0.5, "for": float(o["for"]) if Bus.finite(o.get("for")) else 0.4})
			continue
		if op == "puff" and not Bus.truthy(o.get("who")) and o.get("at") is Array:
			_puff(st, o, _pt3(o["at"], 0.0), st["time"])
			continue
		var e = st["byId"].get(Bus.js_string(o.get("who", Bus.UNDEF)))
		if e == null:
			continue
		if op == "puff":
			_puff(st, o, _pt3(o["at"], 0.0) if o.get("at") is Array else _feet(e), st["time"])
			continue
		if op == "beam":
			_beam(st, e, o)
			continue
		if op == "transfigure":
			var b = st["byId"].get(Bus.js_string(o.get("into", Bus.UNDEF)))
			if b == null or is_same(b, e) or e["gone"]:
				continue
			ops(st, [{"op": "spawn", "who": b["id"], "at": (e["pos"] as Array).duplicate(), "face": e["heading"] / DEG}, {"op": "vanish", "who": e["id"]}])
			continue
		match op:
			"spawn":
				e["dormant"] = false; e["gone"] = false; e["downed"] = false; e["castDown"] = false; e["route"] = null; e["held"] = false; e["pose"] = null
				if e.has("hpMax"):
					e["hp"] = e["hpMax"]
					e["hittable"] = true
				if o.get("among") is Array and not (o["among"] as Array).is_empty():
					# the spawn farthest from the living (the nearest other standing body; a tie to the first), as the web
					var best = null
					var bd := -1.0
					for sp in o["among"]:
						if not (sp is Array):
							continue
						var dmin := INF
						for x in st["entities"]:
							if is_same(x, e) or x["downed"] or x["gone"] or x["dormant"] or not Bus.truthy(x.get("hittable")):
								continue
							dmin = minf(dmin, Vector2(float(x["pos"][0]) - float(sp[0]), float(x["pos"][1]) - float(sp[1])).length())
						if dmin > bd:
							bd = dmin
							best = sp
					if best != null:
						e["pos"] = _pt3(best, e["pos"][2])
				elif o.get("at") is Array:
					e["pos"] = _pt3(o["at"], e["pos"][2])
				if Bus.finite(o.get("face")):
					e["heading"] = float(o["face"]) * DEG
				# the spawn guard: unhittable its seconds (the wake guard's clock: combat.gd ticks a poised body's, step the rest)
				if Bus.finite(o.get("guard")) and float(o["guard"]) > 0.0:
					e["wakeGuardT"] = float(o["guard"])
					e["invincible"] = true
			"vanish":
				e["gone"] = true; e["dormant"] = true; e["route"] = null; e["held"] = false; e["moving"] = false
				e["hittable"] = false
			"kill", "hurt":
				if e["downed"] or e["gone"]:
					continue
				var has_hp: bool = e.has("hp")
				if op == "hurt":
					if not has_hp:
						continue
					e["hp"] = maxf(0.0, e["hp"] - (float(o["by"]) if Bus.finite(o.get("by")) else 1.0))
					if e["hp"] > 0.0:
						continue
				if has_hp:
					e["hp"] = 0.0
				e["downed"] = true; e["castDown"] = true; e["route"] = null; e["held"] = false; e["moving"] = false
			"heal":
				if e["downed"] or not e.has("hp"):
					continue
				var mx: float = e.get("hpMax", e["hp"])
				e["hp"] = minf(mx, e["hp"] + float(o["by"])) if Bus.finite(o.get("by")) else mx
			"walk":
				if e["downed"] or e["gone"] or not (o.get("points") is Array) or (o["points"] as Array).is_empty():
					continue
				var points := []
				for p in o["points"]:
					if p is Array and p.size() >= 2 and Bus.finite(p[0]) and Bus.finite(p[1]):
						points.append([float(p[0]), float(p[1])])
				if points.is_empty():
					continue
				var names := []
				for i in points.size():
					names.append(String(o["names"][i]) if o.get("names") is Array and i < o["names"].size() and o["names"][i] is String else str(i))
				e["held"] = false; e["pose"] = null
				e["route"] = {
					"points": points, "names": names, "i": 0, "back": false, "best": INF, "watch": 0.0,
					"speed": float(o["speed"]) if Bus.finite(o.get("speed")) and float(o["speed"]) > 0 else e["speed"],
					"turn": float(o["turn"]) if Bus.finite(o.get("turn")) and float(o["turn"]) > 0 else 8.0,
					"reach": float(o["reach"]) if Bus.finite(o.get("reach")) and float(o["reach"]) > 0 else 0.3,
					"then": o["then"] if o.get("then") == "loop" or o.get("then") == "back" else "stay",
					"face": float(o["face"]) * DEG if Bus.finite(o.get("face")) else null, "pose": o["pose"] if o.get("pose") is String else null,
				}
			"stop":
				e["route"] = null; e["held"] = false; e["moving"] = false
			"status":
				if not (o.get("is") is String) or e["gone"]:
					continue
				e["statuses"][o["is"]] = {"t0": st["time"], "until": st["time"] + float(o["for"]) if Bus.finite(o.get("for")) and float(o["for"]) > 0 else null}
			"lift":
				for k in (e["statuses"] as Dictionary).keys():
					if o.get("is") == null or o.get("is") == k:
						e["statuses"].erase(k)
						e["faded"].append(k)


# a dumb path: turn toward the point, step, arrive within reach; `then` at the last point
func _step_route(e: Dictionary, dt: float) -> void:
	var r: Dictionary = e["route"]
	var p: Array = r["points"][r["i"]]
	var dx: float = p[0] - e["pos"][0]
	var dy: float = p[1] - e["pos"][1]
	var d := sqrt(dx * dx + dy * dy)
	if d <= r["reach"]:
		var last: bool = r["i"] == (r["points"] as Array).size() - 1
		e["arrivals"] += 1
		e["arrivedAt"] = r["names"][r["i"]]
		e["arrivedLast"] = last and r["then"] != "loop" and not (r["then"] == "back" and not r["back"])
		if not last:
			r["i"] += 1
		elif r["then"] == "loop":
			r["i"] = 0
		elif r["then"] == "back" and not r["back"]:
			r["points"].reverse()
			r["names"].reverse()
			r["back"] = true
			r["i"] = 1 if (r["points"] as Array).size() > 1 else 0
		else:
			e["route"] = null
			e["held"] = true
			if r["face"] != null:
				e["heading"] = r["face"]
			e["pose"] = r["pose"]
		r["best"] = INF
		r["watch"] = 0.0
		e["moving"] = false
		return
	r["watch"] += dt
	if d < r["best"] and (r["best"] - d >= r["speed"] / 6.0 or is_inf(r["best"])):
		r["best"] = d
		r["watch"] = 0.0
	if r["watch"] >= 1.0:
		e["route"] = null
		e["stucks"] += 1
		e["moving"] = false
		return
	var want := atan2(dy, dx)
	var dh := fposmod(want - e["heading"] + PI, TAU) - PI
	e["heading"] = fmod(e["heading"] + clampf(dh, -r["turn"] * dt, r["turn"] * dt), TAU)
	var stp := minf(r["speed"] * dt, d)
	e["pos"][0] += dx / d * stp
	e["pos"][1] += dy / d * stp
	e["moving"] = true


func step(st: Dictionary, dt: float) -> void:
	st["time"] += dt
	for e in st["entities"]:
		if not Bus.finite(e.get("poise")) and Bus.finite(e.get("wakeGuardT")) and float(e["wakeGuardT"]) > 0.0:
			e["wakeGuardT"] = maxf(0.0, float(e["wakeGuardT"]) - dt)
			e["invincible"] = float(e["wakeGuardT"]) > 0.0
		if e["route"] != null:
			if e["downed"] or e["gone"]:
				e["route"] = null
			else:
				_step_route(e, dt)


# ── moments (the web's cast.js moment / puff / beam) ─────────────────────────────────────────────────────────────
# a moment, kept until its `until` (else 3 s); the old ones go when a new one comes, as on the web
static func _moment(st: Dictionary, m: Dictionary) -> void:
	var t: float = st["time"]
	var kept := []
	for x in st["moments"]:
		if t < (float(x["until"]) if x.get("until") != null else float(x["t0"]) + 3.0):
			kept.append(x)
	var row := {"t0": t}
	for k in m:
		row[k] = m[k]
	kept.append(row)
	st["moments"] = kept


# where a character stands: its pos less its foot
static func _feet(e: Dictionary) -> Array:
	var p: Array = e["pos"]
	return [float(p[0]), float(p[1]), float(p[2]) - float(e.get("foot", 0.0))]


# a puff, or an explosion (o.spec): a chain is count blasts scattered round the spot by the web's own dice (a sine
# hash), one after another; a scale sizes it and its spread
static func _puff(st: Dictionary, o: Dictionary, at: Array, t0: float) -> void:
	var X = o.get("spec") if o.get("spec") is Dictionary else null
	var sc := float(o["scale"]) if Bus.finite(o.get("scale")) else 1.0
	var C = X.get("chain") if X != null and X.get("chain") is Dictionary else null
	var n := int(C["count"]) if C != null else 1
	for j in n:
		var d := func(k: int) -> float:
			var x := sin(j * 12.9898 + k * 78.233 + 5.1) * 43758.5453
			return x - floor(x)
		var a: float = d.call(1) * TAU
		var r: float = float(C["spread"]) * sc * sqrt(d.call(2)) if j > 0 and C != null else 0.0
		var tj := t0 + (j * float(C["stagger"]) if C != null else 0.0)
		var m := {"is": o["is"] if o.get("is") is String else "smoke", "at": [at[0] + cos(a) * r, at[1] + sin(a) * r, at[2]], "t0": tj}
		if X != null:
			m["spec"] = X
			m["until"] = tj + float(X["dur"]) + 0.2
		if sc != 1.0:
			m["scale"] = sc
		if o.has("color"):
			m["color"] = o["color"]
		_moment(st, m)
	var k := 0.0
	if Bus.finite(o.get("shake")) and float(o["shake"]) > 0.0:
		k = float(o["shake"])
	elif X != null and Bus.truthy(X.get("shake")):
		k = float(X["shake"])
	if k != 0.0:
		_moment(st, {"is": "shake", "at": at.duplicate(), "k": minf(1.0, k * sqrt(sc)), "for": 0.4 + float(C["stagger"]) * (n - 1) if C != null else 0.4, "t0": t0})


# a beam from the hand (or over the head) at a character's middle or a point: it lands at hit, its impact and shake
# are moments then, and its target hears struck
static func _beam(st: Dictionary, e: Dictionary, o: Dictionary) -> void:
	if e["gone"] or not (o.get("spec") is Dictionary):
		return
	var spec: Dictionary = o["spec"]
	var f := _feet(e)
	var h := float(e["heading"])
	var above: bool = spec.get("charge") is Dictionary and spec["charge"].get("at") == "above"
	var from := [f[0], f[1], f[2] + 2.7] if above else [f[0] + cos(h) * 0.45, f[1] + sin(h) * 0.45, f[2] + 1.15]
	var T = st["byId"].get(o["to"]) if o.get("to") is String else null
	if o.get("to") is String and (T == null or T["gone"]):
		return
	var to: Array = (T["pos"] as Array).duplicate() if T != null else _pt3(o["to"], 0.0)
	var D := sqrt((to[0] - from[0]) * (to[0] - from[0]) + (to[1] - from[1]) * (to[1] - from[1]) + (to[2] - from[2]) * (to[2] - from[2]))
	var land_rule: Array = o["land"] if o.get("land") is Array and not (o["land"] as Array).is_empty() else [[0, 0]]
	var best := INF
	for ab in land_rule:
		best = minf(best, float(ab[0]) + float(ab[1]) * D)
	var hit: float = st["time"] + best
	var m := {"is": "beam", "at": from, "from": from, "to": to, "by": e["id"], "name": o["name"] if o.get("name") is String and o["name"] != "" else null, "spec": spec, "hit": hit, "until": hit + 8.0}
	if T != null:
		m["target"] = T["id"]
	if o.has("color"):
		m["color"] = o["color"]
	_moment(st, m)
	var land := _feet(T) if T != null else to
	if Bus.truthy(spec.get("impact")):
		var imp := {"is": spec["impact"]}
		if spec.get("impactSpec") is Dictionary:
			imp["spec"] = spec["impactSpec"]
		if o.has("color"):
			imp["color"] = o["color"]
		_puff(st, imp, land, hit)
	if Bus.truthy(spec.get("shake")):
		_moment(st, {"is": "shake", "at": land, "k": spec["shake"], "for": 0.4, "t0": hit})


# edge-detected happenings, as bus events with `entity` (the first read seeds: nothing a world was minted with fires)
func facts(st: Dictionary) -> Array:
	var seed: bool = _prev == null
	var next := {}
	var events := []
	for e in st["entities"]:
		var cur := {"d": e["downed"], "g": e["gone"], "a": e["arrivals"], "s": e["stucks"], "h": int(e.get("hits", 0))}
		next[e["id"]] = cur
		var p = null if seed else _prev.get(e["id"])
		if p == null:
			continue
		if cur["d"] and not p["d"]:
			events.append({"type": "down", "entity": e["id"]})
		if cur["g"] and not p["g"]:
			events.append({"type": "gone", "entity": e["id"]})
		if not cur["g"] and p["g"]:
			events.append({"type": "spawned", "entity": e["id"]})
		if cur["a"] > p["a"]:
			var ev := {"type": "arrive", "entity": e["id"], "at": e["arrivedAt"], "last": 1 if e["arrivedLast"] else 0}
			if e["arrivedLast"] and e["pose"] != null:
				ev["pose"] = e["pose"]
			events.append(ev)
		if cur["s"] > p["s"]:
			events.append({"type": "stuck", "entity": e["id"]})
		for k in range(int(p.get("h", 0)), cur["h"]):
			events.append({"type": "hit:" + String(e["id"]), "entity": e["id"], "by": e.get("lastHitBy")})
		for k in (e["statuses"] as Dictionary).keys():
			var u = e["statuses"][k]["until"]
			if u != null and st["time"] >= u:
				e["statuses"].erase(k)
				e["faded"].append(k)
		for k in e["faded"]:
			events.append({"type": "faded", "entity": e["id"], "is": k})
		e["faded"] = []
	# a beam that has reached its character
	for M in st["moments"]:
		if M["is"] == "beam" and M.get("target") != null and not Bus.truthy(M.get("struck")) and st["time"] >= float(M["hit"]):
			M["struck"] = true
			if not seed:
				var ev := {"type": "struck", "entity": M["target"], "by": M["by"]}
				if M.get("name") != null:
					ev["beam"] = M["name"]
				events.append(ev)
	_prev = next
	return events
