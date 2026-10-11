extends Node
# mojulo-godot kernel — the world's weather (world-weather plan). Plays the sky the web build plays, as far as an engine's
# stock nodes go: the score's `weather` row carries the schedule's first half hour (timeline: runs of states, each easing into
# the next over `blend` seconds) and what each state is in the style's air (fog factor, colour, the light taken off). Here
# the fog's density and colour, the background and the light follow it, off the engine's own clock from the level's start.
# Falling rain, snow, dust and petals, their landings and the lightning stay the web build's (ledger.weather_partial);
# the web page's schedule is the module's own dice, so this plays the SAME sky for the span the score carries and holds
# the last state after it. Hand-authored and versioned with the kernel (kernel/VERSION).
#
# A CUE may force the sky (since 0.12.0): the bus sets weather-force:<cue> to a state and weather-blend:<cue> to how long
# the change takes. level.gd hands the newest force still set to force(); the sky eases to it over its blend (or the
# schedule's), holds it, and eases back to the schedule when no force is left: the web page's rule
# (scene/channels/weather.js).

var weather: Dictionary = {}
var env: Environment = null
var t := 0.0
var base_density := 0.01
var base_ambient := 0.25
var lights: Array = []        # [{node, energy}]: the sun and the rest, dimmed as the sky closes
var timeline: Array = []
var states: Dictionary = {}
var blend := 20.0
var forced = null             # {n, t0, from, len}: easing to a forced state, then holding it
var freed = null              # {t0, from, len}: easing back to the schedule
var force_key := ""           # the force last handed in (its name, var and order)
var last: Dictionary = {}


func setup(w: Dictionary, e: Environment, light_nodes: Array) -> void:
	weather = w
	env = e
	timeline = w.get("timeline", [])
	for s in w.get("states", []):
		states[String(s["name"])] = s
	blend = float(w.get("blend", 20.0))
	base_density = float(w.get("fogDensity", 0.01))
	base_ambient = e.ambient_light_energy
	for n in light_nodes:
		if n is Light3D:
			lights.append({"node": n, "energy": n.light_energy})
	env.fog_enabled = true
	_apply(0.0)


func _process(delta: float) -> void:
	t += delta
	_apply(t)


static func _smooth(u: float) -> float:
	u = clampf(u, 0.0, 1.0)
	return u * u * (3.0 - 2.0 * u)


# the state at time `s`: { a, b, mix } by name; the schedule's last state holds past the span
func state_at(s: float) -> Dictionary:
	if timeline.is_empty():
		return {"a": String(weather.get("now", "clear")), "b": String(weather.get("now", "clear")), "mix": 0.0}
	for i in timeline.size():
		var run: Dictionary = timeline[i]
		if s < float(run["to"]):
			var a := String(run["is"])
			var b := String(timeline[i + 1]["is"]) if i + 1 < timeline.size() else a
			var u := 0.0
			if blend > 0.0 and b != a:
				u = _smooth((s - (float(run["to"]) - blend)) / blend)
			return {"a": a, "b": b, "mix": u}
	var last := String(timeline[timeline.size() - 1]["is"])
	return {"a": last, "b": last, "mix": 0.0}


static func _col(c) -> Color:
	return Color(float(c[0]), float(c[1]), float(c[2]))


# fog, colour and light at time `s` (also the headless probe's entry)
func look_at(s: float) -> Dictionary:
	var st := state_at(s)
	var A: Dictionary = states.get(st["a"], {})
	var B: Dictionary = states.get(st["b"], A)
	var u: float = st["mix"]
	var fa := float(A.get("fog", 1.0))
	var fb := float(B.get("fog", fa))
	var fog := exp(lerpf(log(fa), log(fb), u))
	var ca := _col(A.get("color", [0.7, 0.75, 0.8]))
	var cb := _col(B.get("color", A.get("color", [0.7, 0.75, 0.8])))
	var dim := lerpf(float(A.get("dim", 0.0)), float(B.get("dim", A.get("dim", 0.0))), u)
	return {"density": base_density * fog, "color": ca.lerp(cb, u), "dim": dim, "a": st["a"], "b": st["b"], "mix": u}


# the newest force still set ({n, k, at, bl}), or null: changes start an ease to it, or back to the schedule
func force(top) -> void:
	var f := "" if top == null else "%s|%s|%s" % [top["n"], top["k"], top["at"]]
	if f == force_key:
		return
	var from: Dictionary = last if not last.is_empty() else look_at(t)
	if top != null:
		var bl = top.get("bl")
		var len := float(bl) if (bl is float or bl is int) and float(bl) >= 0.0 else blend
		forced = {"n": String(top["n"]), "t0": t, "from": from, "len": len}
		freed = null
	elif forced != null:
		freed = {"t0": t, "from": from, "len": forced["len"]}
		forced = null
	force_key = f


# a state held: its fog, colour and light
func look_of(n: String) -> Dictionary:
	var S: Dictionary = states.get(n, {})
	return {"density": base_density * float(S.get("fog", 1.0)), "color": _col(S.get("color", [0.7, 0.75, 0.8])), "dim": float(S.get("dim", 0.0)), "a": n, "b": n, "mix": 0.0}


static func _ease(a: Dictionary, b: Dictionary, u: float) -> Dictionary:
	return {"density": exp(lerpf(log(maxf(a["density"], 1e-9)), log(maxf(b["density"], 1e-9)), u)), "color": (a["color"] as Color).lerp(b["color"], u), "dim": lerpf(a["dim"], b["dim"], u), "a": a["a"], "b": b["b"], "mix": u}


# the sky now: a force eased in and held, the schedule eased back to, or the schedule
func look(s: float) -> Dictionary:
	var L: Dictionary
	if forced != null:
		var u: float = 1.0 if forced["len"] <= 0.0 else _smooth((s - forced["t0"]) / forced["len"])
		L = _ease(forced["from"], look_of(forced["n"]), u)
	elif freed != null:
		var u: float = 1.0 if freed["len"] <= 0.0 else (s - freed["t0"]) / freed["len"]
		if u >= 1.0:
			freed = null
			L = look_at(s)
		else:
			L = _ease(freed["from"], look_at(s), _smooth(maxf(0.0, u)))
	else:
		L = look_at(s)
	last = L
	return L


func _apply(s: float) -> void:
	var L := look(s)
	env.fog_density = L["density"]
	env.fog_light_color = L["color"]
	if env.background_mode == Environment.BG_COLOR:
		env.background_color = L["color"]
	var off := 1.0 - minf(0.7, float(L["dim"]) * 0.7)
	env.ambient_light_energy = base_ambient * off
	for l in lights:
		if is_instance_valid(l["node"]):
			l["node"].light_energy = float(l["energy"]) * off
