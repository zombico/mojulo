extends RefCounted
# mojulo-godot kernel — the scene runner (since 0.23.0): a level's scenes (scenes.js sceneProgram, carried in bus.json
# `scenes`) played over the bus and the camera, ported from playscape/ui/scene-runner.js (the code the page ships) and
# held equal to it step by step by the scenes conformance corpus (lib/graph/scene/scenes-conformance.js).
#
#   var R = ScenesScript.new(); var S = R.create(program)
#   R.hear(S, types)        the bus event types since the last step (a scene starts on `scene:<id>`)
#   R.step(S, dt, ctl)      → { fire: [type], ops: [cast op], started: [id], ended: [id] }
#                           ctl: { next, held, skip, vars, move, pick }
#   R.view(S)               → { on, bars, line: { who, name, text, full, expression? } | null, choice: { options, sel } | null }
#
# A line types on at RATE characters a second; a press shows it whole, the next goes on; holding the advance key HOLD
# seconds, or Esc, skips to the end (or to a choice, which stays the player's).

const Bus := preload("res://kernel/bus.gd")
const Js := preload("res://kernel/js.gd")
const RATE := 40.0
const HOLD := 0.6
const BARS := 4.0


func create(program) -> Dictionary:
	var by_id := {}
	for sc in (program if program is Array else []):
		by_id[String(sc["id"])] = sc
	return {"byId": by_id, "active": null, "heard": [], "bars": 0.0, "played": {}}


static func _cmp(op: String, a, b) -> bool:
	match op:
		# JS's relational operators: a number's text compares as its number, two strings by their code units
		"gte":
			return Js.rel(a, b, ">=")
		"gt":
			return Js.rel(a, b, ">")
		"lte":
			return Js.rel(a, b, "<=")
		"lt":
			return Js.rel(a, b, "<")
		"eq":
			return Js.strict_eq(a, b)
		"ne":
			return not Js.strict_eq(a, b)
	return false


static func _holds(sc: Dictionary, vars) -> bool:
	for c in (sc.get("if") if sc.get("if") is Array else []):
		var v = vars.get(c["var"]) if vars is Dictionary and vars.get(c["var"]) != null else 0
		if not _cmp(String(c["op"]), v, c["n"]):
			return false
	return true


func hear(S: Dictionary, types) -> void:
	for t in (types if types is Array else []):
		if t is String:
			S["heard"].append(t)


func _end(S: Dictionary, out: Dictionary) -> void:
	var A: Dictionary = S["active"]
	out["ops"].append({"op": "unshot"})
	out["fire"].append("scene-end:" + String(A["sc"]["id"]))
	out["ended"].append(A["sc"]["id"])
	S["active"] = null


# run beats until one waits (a timer, an event, a click) or the scene ends
func _advance(S: Dictionary, out: Dictionary) -> void:
	var A: Dictionary = S["active"]
	while true:
		if A["line"] != null:
			A["said"] = A["line"]
		A["i"] = int(A["i"]) + 1
		A["wait"] = null
		A["line"] = null
		A["t"] = 0.0
		var beats: Array = A["sc"]["beats"]
		# the web's `if (!b)`: past the last beat, or a beat that is not there (null), ends the scene
		if int(A["i"]) >= beats.size() or not Js.truthy(beats[int(A["i"])]):
			_end(S, out)
			return
		var b: Dictionary = beats[int(A["i"])]
		match String(b["kind"]):
			"shot":
				out["ops"].append({"op": "shot", "shot": b["shot"]})
				if Js.truthy(b.get("for")):
					A["wait"] = {"time": float(b["for"])}
					return
			"fire":
				out["fire"].append(b["event"])
			"until":
				A["wait"] = {"event": b["event"]}
				return
			"wait":
				A["wait"] = {"time": float(b["wait"])}
				return
			"line":
				A["line"] = b
				A["typed"] = 0.0
				A["wait"] = {"click": true}
				return
			"choose":
				_choose(A, b)
				return
			"jump":
				A["i"] = int(b["to"]) - 1


# a choice: its question stays as the line (its own, or the last said), the answer waits
static func _choose(A: Dictionary, b: Dictionary) -> void:
	A["line"] = b["ask"] if Js.truthy(b.get("ask")) else (A["said"] if A["said"] != null else null)
	A["typed"] = float(_len(A["line"]["text"])) if A["line"] != null else 0.0
	A["choice"] = b
	A["sel"] = 0
	A["wait"] = {"choice": true}


func _answer(S: Dictionary, out: Dictionary, k: int) -> void:
	var A: Dictionary = S["active"]
	var o: Dictionary = A["choice"]["options"][k]
	for t in o["fire"]:
		out["fire"].append(t)
	A["choice"] = null
	A["i"] = int(o["to"]) - 1
	_advance(S, out)


# a skip: what is left fires at once, the walks land, the camera comes back; up to a choice, which stays the player's
func _skip(S: Dictionary, out: Dictionary) -> void:
	var A: Dictionary = S["active"]
	if A["choice"] != null:
		return
	var shot = null
	var beats: Array = A["sc"]["beats"]
	var j := int(A["i"]) + 1
	while j < beats.size():
		var b: Dictionary = beats[j]
		match String(b["kind"]):
			"fire":
				out["fire"].append(b["event"])
			"shot":
				shot = b["shot"]
			"line":
				A["said"] = b
			"jump":
				j = int(b["to"]) - 1
			"choose":
				out["ops"].append({"op": "finish"})
				if shot != null:
					out["ops"].append({"op": "shot", "shot": shot})
				A["i"] = j
				A["t"] = 0.0
				A["holdT"] = 0.0
				_choose(A, b)
				return
		j += 1
	out["ops"].append({"op": "finish"})
	_end(S, out)


func step(S: Dictionary, dt: float, ctl = null) -> Dictionary:
	var out := {"fire": [], "ops": [], "started": [], "ended": []}
	var c: Dictionary = ctl if ctl is Dictionary else {}
	var heard: Array = S["heard"]
	S["heard"] = []
	if S["active"] == null:
		for t in heard:
			if not String(t).begins_with("scene:"):
				continue
			var sc = S["byId"].get(String(t).substr(6))
			if sc == null or (not Js.strict_eq(sc.get("once"), false) and Js.truthy(S["played"].get(sc["id"]))) or not _holds(sc, c.get("vars")):
				continue
			S["played"][sc["id"]] = int(S["played"].get(sc["id"], 0)) + 1
			S["active"] = {"sc": sc, "i": -1, "wait": null, "line": null, "t": 0.0, "typed": 0.0, "holdT": 0.0, "said": null, "choice": null, "sel": 0}
			out["started"].append(sc["id"])
			_advance(S, out)
			break
	else:
		var A: Dictionary = S["active"]
		A["holdT"] = float(A["holdT"]) + dt if (Js.truthy(c.get("held")) and A["choice"] == null) else 0.0
		if A["choice"] == null and (Js.truthy(c.get("skip")) or float(A["holdT"]) >= HOLD):
			_skip(S, out)
		else:
			var w = A["wait"]
			var go: bool = w == null
			# the web's `w.time != null` (a null time is no timed wait) and `w.event` (an empty one is none)
			if w is Dictionary and w.get("time") != null and not Js.is_undef(w.get("time")):
				A["t"] = float(A["t"]) + dt
				go = Js.rel(A["t"], w["time"], ">=")
			elif w is Dictionary and Js.truthy(w.get("event")):
				go = w["event"] in heard
			elif w is Dictionary and Js.truthy(w.get("choice")):
				var n: int = (A["choice"]["options"] as Array).size()
				var mv = c.get("move")
				if Js.truthy(mv):
					A["sel"] = (int(A["sel"]) + (1 if float(mv) > 0 else -1) + n) % n
				var pk = c.get("pick")
				var k := -1
				if Js.is_num(pk) and float(pk) == floor(float(pk)) and int(pk) >= 0 and int(pk) < n:
					k = int(pk)
				elif Js.truthy(c.get("next")):
					k = int(A["sel"])
				if k >= 0:
					_answer(S, out, k)
			elif w is Dictionary and w.has("click"):
				A["typed"] = float(A["typed"]) + dt * RATE
				if Js.truthy(c.get("next")):
					if float(A["typed"]) < _len(A["line"]["text"]):
						A["typed"] = float(_len(A["line"]["text"]))
					else:
						go = true
			if go:
				_advance(S, out)
	var want := 1.0 if S["active"] != null else 0.0
	S["bars"] = float(S["bars"]) + maxf(-dt * BARS, minf(dt * BARS, want - float(S["bars"])))
	return out


# a line's length and its first n characters, in the page's own units (UTF-16 code units, String.prototype.slice)
static func _len(s) -> int:
	return String(s).to_utf16_buffer().size() / 2


# (a cut inside a surrogate pair keeps the whole pair back: the page draws half a character there for a frame)
static func _slice(s, n: int) -> String:
	var buf := String(s).to_utf16_buffer()
	var m := mini(n, buf.size() / 2)
	if m > 0 and (buf[m * 2 - 1] & 0xFC) == 0xD8:
		m -= 1
	return buf.slice(0, m * 2).get_string_from_utf16()


func view(S: Dictionary) -> Dictionary:
	var A = S["active"]
	var L = A["line"] if A != null else null
	var line = null
	if L != null:
		line = {"who": L.get("who"), "name": L.get("name"), "text": _slice(L["text"], int(floor(float(A["typed"])))), "full": float(A["typed"]) >= _len(L["text"])}
		if Js.truthy(L.get("expression")):
			line["expression"] = L["expression"]
	var choice = null
	if A != null and A["choice"] != null:
		choice = {"options": (A["choice"]["options"] as Array).map(func(o): return o["text"]), "sel": A["sel"]}
	return {"on": A != null, "bars": S["bars"], "line": line, "choice": choice}
