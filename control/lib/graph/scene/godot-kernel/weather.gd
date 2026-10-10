extends Node
# mojulo-godot kernel — the world's weather (world-weather plan). Plays the sky the web build plays, as far as an engine's
# stock nodes go: the score's `weather` row carries the schedule's first half hour (timeline: runs of states, each easing into
# the next over `blend` seconds) and what each state is in the style's air (fog factor, colour, the light taken off). Here
# the fog's density and colour, the background and the light follow it, off the engine's own clock from the level's start.
# Falling rain, snow, dust and petals, their landings and the lightning stay the web build's (ledger.weather_partial);
# the web page's schedule is the module's own dice, so this plays the SAME sky for the span the score carries and holds
# the last state after it. Hand-authored and versioned with the kernel (kernel/VERSION).

var weather: Dictionary = {}
var env: Environment = null
var t := 0.0
var base_density := 0.01
var base_ambient := 0.25
var lights: Array = []        # [{node, energy}]: the sun and the rest, dimmed as the sky closes
var timeline: Array = []
var states: Dictionary = {}
var blend := 20.0


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


func _apply(s: float) -> void:
	var L := look_at(s)
	env.fog_density = L["density"]
	env.fog_light_color = L["color"]
	if env.background_mode == Environment.BG_COLOR:
		env.background_color = L["color"]
	var off := 1.0 - minf(0.7, float(L["dim"]) * 0.7)
	env.ambient_light_energy = base_ambient * off
	for l in lights:
		if is_instance_valid(l["node"]):
			l["node"].light_energy = float(l["energy"]) * off
