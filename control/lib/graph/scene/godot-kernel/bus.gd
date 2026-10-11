extends RefCounted
# mojulo-godot kernel — the EVENT BUS, a literal port of buildBus (lib/graph/worlds/event-bus.js). Every behaviour
# mojulo lowers (cues, chapters, menu picks, mechanics) arrives as a bus fragment: reactions, watches, sequences,
# timers, vars. This script runs that fragment the way the web page does, so behaviour travels as data and one
# reducer performs it on both sides. The port is held EQUAL to the web reducer by a conformance corpus
# (scripts/godot-bus-conformance.mjs): the same event script gives the same canonical state string, frame by frame.
#
# JS semantics, made explicit: Godot reads every JSON number as a float, so numbers are compared as numbers, printed
# the way JSON.stringify prints them, and hashed over UTF-16 code units. Read the fragment with kernel/json_exact.gd:
# Godot's own JSON parser rounds some decimals to a neighbouring double, and the bus would then diverge. A key the reducer never wrote reads as
# UNDEF (JS undefined), which is distinct from null where JS tells them apart (match wildcards, `!== undefined`).
# Numbers below 1e-6 or from 1e21 up print in decimal here and in exponent form in JS: keep scores clear of them.
#
#   var bus = preload("res://kernel/bus.gd").new()
#   var st = bus.create_bus_state(config, entities)
#   bus.process_events(st, events); bus.watch_events(st); bus.tick_timers(st, dt); bus.step_time(st, dt)
#   bus.frame(st, incoming, dt)     the web page's frame order (scene/channels/events.js), for a driver
#   bus.hash_state(st)              the canonical snapshot the conformance corpus compares

const UNDEF := "\uE000undef"   # a private-use mark no score spells
const RESERVED := {"do": 1, "type": 1, "source": 1, "scope": 1, "on": 1, "match": 1, "await": 1, "target": 1, "template": 1, "at": 1, "to": 1, "vector": 1, "dir": 1, "gain": 1, "var": 1, "by": 1}
const DIRS := {"up": [0, 0, 1], "down": [0, 0, -1], "left": [-1, 0, 0], "right": [1, 0, 0], "forward": [0, 1, 0], "back": [0, -1, 0]}

var _rx_cache := {}

# ── JS value semantics ───────────────────────────────────────────────────────────────────────────────────────────
static func is_num(v) -> bool:
	return typeof(v) == TYPE_INT or typeof(v) == TYPE_FLOAT

static func is_undef(v) -> bool:
	return typeof(v) == TYPE_STRING and v == UNDEF

static func finite(v) -> bool:
	return is_num(v) and not is_nan(float(v)) and not is_inf(float(v))

# JS ToNumber: undefined → NaN, null → 0, booleans → 0 / 1, strings parsed (blank → 0, junk → NaN)
static func to_number(v) -> float:
	if is_num(v):
		return float(v)
	if v == null:
		return 0.0
	if typeof(v) == TYPE_BOOL:
		return 1.0 if v else 0.0
	if typeof(v) == TYPE_STRING:
		if is_undef(v):
			return NAN
		var s: String = v.strip_edges()
		if s == "":
			return 0.0
		if s.is_valid_float() or s.is_valid_int():
			return s.to_float()
		return NAN
	return NAN

static func truthy(v) -> bool:
	if v == null or is_undef(v):
		return false
	match typeof(v):
		TYPE_BOOL: return v
		TYPE_INT, TYPE_FLOAT: return float(v) != 0.0 and not is_nan(float(v))
		TYPE_STRING: return v != ""
	return true

# JS ===: numbers by value, strings / booleans / null by value, arrays and objects by identity
static func strict_eq(a, b) -> bool:
	if is_undef(a) or is_undef(b):
		return is_undef(a) and is_undef(b)
	if is_num(a) and is_num(b):
		return float(a) == float(b)
	if typeof(a) != typeof(b):
		return false
	if typeof(a) == TYPE_ARRAY or typeof(a) == TYPE_DICTIONARY:
		return is_same(a, b)
	return a == b

# JS relational (<, <=, >, >=): two strings compare as strings; anything else as numbers (NaN compares false)
static func rel(a, b, op: String) -> bool:
	if typeof(a) == TYPE_STRING and typeof(b) == TYPE_STRING and not is_undef(a) and not is_undef(b):
		match op:
			"<": return a < b
			"<=": return a <= b
			">": return a > b
			">=": return a >= b
	var x := to_number(a)
	var y := to_number(b)
	if is_nan(x) or is_nan(y):
		return false
	match op:
		"<": return x < y
		"<=": return x <= y
		">": return x > y
		">=": return x >= y
	return false

# JS String(v), for glob
static func js_string(v) -> String:
	if is_undef(v):
		return "undefined"
	if v == null:
		return "null"
	if typeof(v) == TYPE_BOOL:
		return "true" if v else "false"
	if is_num(v):
		return num_str(float(v), "NaN")
	if typeof(v) == TYPE_ARRAY:
		var parts := []
		for x in v:
			parts.append("" if x == null or is_undef(x) else js_string(x))
		return ",".join(parts)
	if typeof(v) == TYPE_DICTIONARY:
		return "[object Object]"
	return str(v)

# a number the way JS prints it: integers whole, the rest as the shortest decimal that names the double
# (String.num_scientific prints that form; decimal range only, see the header)
static func num_str(x: float, nan_as: String = "null") -> String:
	if is_nan(x) or is_inf(x):
		return nan_as
	if x == floor(x) and absf(x) < 1e21:
		return str(int(x))
	return String.num_scientific(x)

static func js_quote(s: String) -> String:
	var out := "\""
	for i in s.length():
		var c := s.unicode_at(i)
		match c:
			34: out += "\\\""
			92: out += "\\\\"
			8: out += "\\b"
			12: out += "\\f"
			10: out += "\\n"
			13: out += "\\r"
			9: out += "\\t"
			_:
				if c < 0x20:
					out += "\\u%04x" % c
				else:
					out += String.chr(c)
	return out + "\""

# the deterministic stringify (sorted keys): the sort key and the state hash
static func ss(v) -> String:
	if v == null or is_undef(v):
		return "null"
	match typeof(v):
		TYPE_BOOL: return "true" if v else "false"
		TYPE_INT, TYPE_FLOAT: return num_str(float(v))
		TYPE_STRING, TYPE_STRING_NAME: return js_quote(String(v))
		TYPE_ARRAY:
			var parts := []
			for x in v:
				parts.append(ss(x))
			return "[" + ",".join(parts) + "]"
		TYPE_DICTIONARY:
			var ks: Array = v.keys()
			ks.sort()
			var parts := []
			for k in ks:
				parts.append(js_quote(String(k)) + ":" + ss(v[k]))
			return "{" + ",".join(parts) + "}"
	return js_quote(str(v))

# FNV-1a over UTF-16 code units, base 36 (the content-derived spawn id)
static func fnv(s: String) -> String:
	var h := 0x811c9dc5
	for i in s.length():
		var c := s.unicode_at(i)
		var units := [c]
		if c > 0xFFFF:
			var u := c - 0x10000
			units = [0xD800 + (u >> 10), 0xDC00 + (u & 0x3FF)]
		for unit in units:
			h = h ^ unit
			h = (h * 0x01000193) & 0xFFFFFFFF
	var digits := "0123456789abcdefghijklmnopqrstuvwxyz"
	if h == 0:
		return "0"
	var out := ""
	while h > 0:
		out = digits[h % 36] + out
		h = h / 36
	return out

# ── glob / match / references ────────────────────────────────────────────────────────────────────────────────────
func glob(value, pat) -> bool:
	if is_undef(pat) or (typeof(pat) == TYPE_STRING and pat == "*"):
		return true
	var p := js_string(pat)
	var sv := js_string(value)
	if p.find("*") < 0:
		return sv == p
	if not _rx_cache.has(p):
		var parts := []
		for piece in p.split("*"):
			parts.append(_rx_escape(piece))
		var rx := RegEx.new()
		rx.compile("^" + ".*".join(parts) + "$")
		_rx_cache[p] = rx
	return (_rx_cache[p] as RegEx).search(sv) != null

static func _rx_escape(s: String) -> String:
	var out := ""
	for ch in s:
		if ".*+?^${}()|[]\\".find(ch) >= 0:
			out += "\\" + ch
		else:
			out += ch
	return out

static func get_or_undef(obj, key):
	if typeof(obj) == TYPE_DICTIONARY:
		return obj[key] if obj.has(key) else UNDEF
	return UNDEF

func matches(ev: Dictionary, match_obj) -> bool:
	if typeof(match_obj) != TYPE_DICTIONARY:
		return true
	for k in match_obj:
		if not glob(get_or_undef(ev, k), match_obj[k]):
			return false
	return true

# 'event.<path>' reads from the firing / context event; anything else is literal
static func resolve_ref(v, ev):
	if typeof(v) == TYPE_STRING and not is_undef(v) and v.begins_with("event."):
		var cur = ev
		for part in v.substr(6).split("."):
			if cur == null or is_undef(cur):
				return UNDEF
			if typeof(cur) == TYPE_DICTIONARY:
				cur = cur[part] if cur.has(part) else UNDEF
			elif typeof(cur) == TYPE_ARRAY and part.is_valid_int() and int(part) >= 0 and int(part) < cur.size():
				cur = cur[int(part)]
			else:
				return UNDEF
		return cur
	return v

static func resolve_fields(obj: Dictionary, ev) -> Dictionary:
	var out := {}
	for k in obj:
		out[k] = resolve_ref(obj[k], ev)
	return out

# a value written into state as it resolved: an undefined stays UNDEF (JS keeps undefined, which compares false
# where null compares as 0); ss prints it as null, as JSON does
static func stored(v):
	return v

# JS `x.k !== undefined`
static func defined(d: Dictionary, k) -> bool:
	return d.has(k) and not is_undef(d[k])

static func dup(v):
	if typeof(v) == TYPE_ARRAY or typeof(v) == TYPE_DICTIONARY:
		return v.duplicate(true)
	return v

# ── events ───────────────────────────────────────────────────────────────────────────────────────────────────────
static func normalize_event(raw: Dictionary) -> Dictionary:
	var e := raw.duplicate()
	if typeof(e.get("type")) != TYPE_STRING or is_undef(e.get("type")):
		e["type"] = js_string(e["type"]) if e.has("type") and truthy(e["type"]) else "event"
	if not defined(e, "source"):
		e["source"] = e["a"] if defined(e, "a") else (e["id"] if defined(e, "id") else "")
	if not defined(e, "scope"):
		e["scope"] = null
	return e

static func sort_key(e) -> String:
	return ss(e)

static func sort_events(list: Array) -> Array:
	var keyed := []
	for e in list:
		keyed.append([sort_key(e), e])
	keyed.sort_custom(func(x, y): return x[0] < y[0])
	var out := []
	for o in keyed:
		out.append(o[1])
	return out

# ── entities ─────────────────────────────────────────────────────────────────────────────────────────────────────
static func add_entity(state: Dictionary, raw: Dictionary) -> Dictionary:
	var e := {
		"id": stored(raw.get("id", UNDEF)),
		"type": raw["type"] if raw.has("type") and truthy(raw["type"]) else "entity",
		"on": truthy(raw.get("on")),
		"position": (raw["position"] as Array).duplicate() if typeof(raw.get("position")) == TYPE_ARRAY else [0, 0, 0],
		"velocity": (raw["velocity"] as Array).duplicate() if typeof(raw.get("velocity")) == TYPE_ARRAY else [0, 0, 0],
	}
	if raw.has("pose"):
		e["pose"] = raw["pose"]
	if raw.has("color"):
		e["color"] = raw["color"]
	if finite(raw.get("radius")):
		e["radius"] = raw["radius"]
	state["entities"].append(e)
	state["byId"][js_string(e["id"])] = e
	return e

static func impulse_vec(spec: Dictionary, ev) -> Array:
	var v = resolve_ref(spec.get("vector", UNDEF), ev)
	if typeof(v) == TYPE_ARRAY:
		return v
	var dk = resolve_ref(spec.get("dir", UNDEF), ev)
	var d: Array = DIRS.get(js_string(dk), [0, 0, 0]) if typeof(dk) == TYPE_STRING and not is_undef(dk) else [0, 0, 0]
	var g0 = resolve_ref(spec.get("gain", UNDEF), ev)
	var g := float(g0) if finite(g0) else 1.0
	return [d[0] * g, d[1] * g, d[2] * g]

static func clamp_var(v: float, spec: Dictionary) -> float:
	if finite(spec.get("min")) and v < float(spec["min"]):
		v = float(spec["min"])
	if finite(spec.get("max")) and v > float(spec["max"]):
		v = float(spec["max"])
	return v

# one verb, from a reaction or a sequence step; only `emit` returns events
func apply_verb(state: Dictionary, spec: Dictionary, ev: Dictionary) -> Array:
	var verb = spec.get("do")
	if not truthy(verb):
		return []
	if verb == "emit":
		var out := {"type": stored(spec.get("type", UNDEF))}
		var src = resolve_ref(spec.get("source", UNDEF), ev)
		out["source"] = stored(ev.get("source", UNDEF)) if is_undef(src) else src
		out["scope"] = stored(resolve_ref(spec["scope"], ev)) if spec.has("scope") else stored(ev.get("scope", UNDEF))
		for k in spec:
			if not RESERVED.has(k):
				out[k] = stored(resolve_ref(spec[k], ev))
		state["metrics"]["emitted"] += 1
		return [out]
	if verb == "spawn":
		_spawn_entity(state, spec, ev)
		return []
	if verb == "ctrl":
		var op := {}
		for k in spec:
			if k != "do":
				op[k] = stored(resolve_ref(spec[k], ev))
		if not state.has("_ctrlOps"):
			state["_ctrlOps"] = []
		state["_ctrlOps"].append(op)
		return []
	if verb == "set":
		var v = resolve_ref(spec.get("to", UNDEF), ev)
		if is_num(v):
			v = clamp_var(float(v), spec)
		state["vars"][spec.get("var")] = stored(v)
		return []
	if verb == "inc":
		var by := to_number(resolve_ref(spec.get("by", UNDEF), ev))
		var cur := to_number(state["vars"].get(spec.get("var"), UNDEF))
		if is_nan(cur) or cur == 0.0:
			cur = 0.0
		state["vars"][spec.get("var")] = clamp_var(cur + (by if not is_nan(by) and not is_inf(by) else 1.0), spec)
		return []

	var tid = resolve_ref(spec.get("target", UNDEF), ev)
	var by_id: Dictionary = state["byId"]
	var tkey := js_string(tid)
	if not by_id.has(tkey):
		if verb == "move":
			var to = resolve_ref(spec.get("to", UNDEF), ev)
			if typeof(to) == TYPE_ARRAY:
				if not state.has("_ctrlWarps"):
					state["_ctrlWarps"] = {}
				state["_ctrlWarps"][tkey] = to.duplicate()
				return []
		state["metrics"]["noops"] += 1
		state["log"].append({"op": "noop", "verb": verb, "target": null if is_undef(tid) else tid})
		return []
	var target: Dictionary = by_id[tkey]
	if verb == "toggle":
		target["on"] = truthy(resolve_ref(spec["to"], ev)) if spec.has("to") else not truthy(target["on"])
	elif verb == "impulse":
		var iv := impulse_vec(spec, ev)
		var vel: Array = target["velocity"]
		target["velocity"] = [to_number(vel[0]) + to_number(iv[0]), to_number(vel[1]) + to_number(iv[1]), to_number(vel[2]) + to_number(iv[2])]
	elif verb == "move":
		var to = resolve_ref(spec.get("to", UNDEF), ev)
		if typeof(to) == TYPE_ARRAY:
			target["position"] = to.duplicate()
		else:
			target["pose"] = stored(to)
	return []

# the spawned id is CONTENT-derived (from the spawning event), so spawn order never changes ids
func _spawn_entity(state: Dictionary, spec: Dictionary, ev: Dictionary) -> void:
	var tmpl: Dictionary = spec["template"] if typeof(spec.get("template")) == TYPE_DICTIONARY else {}
	var at = resolve_ref(spec.get("at", UNDEF), ev)
	var typ = tmpl["type"] if truthy(tmpl.get("type")) else (spec["type"] if truthy(spec.get("type")) else "spawn")
	var id = tmpl["id"] if truthy(tmpl.get("id")) else (js_string(typ) + "-" + fnv(sort_key(ev)))
	var raw := {
		"id": id, "type": typ, "on": truthy(tmpl.get("on")),
		"position": at if typeof(at) == TYPE_ARRAY else (tmpl["position"] if truthy(tmpl.get("position")) else [0, 0, 0]),
		"velocity": tmpl["velocity"] if truthy(tmpl.get("velocity")) else [0, 0, 0],
	}
	var key := js_string(id)
	if state["byId"].has(key):
		var e: Dictionary = state["byId"][key]
		e["type"] = raw["type"]; e["on"] = raw["on"]
		e["position"] = (raw["position"] as Array).duplicate(); e["velocity"] = (raw["velocity"] as Array).duplicate()
	else:
		add_entity(state, raw)

# ── sequences (sagas): ordered steps, one instance per resolved scope ───────────────────────────────────────────
func _instantiate(state: Dictionary, def: Dictionary, ev: Dictionary) -> Array:
	var scope = resolve_ref(def["scope"], ev) if def.has("scope") else null
	var key := js_string(def.get("id", UNDEF)) + " " + ss(scope)
	if state["sagaIndex"].has(key):
		return []
	var ctx := ev.duplicate()
	if scope != null and not is_undef(scope):
		ctx["scope"] = scope
	var saga := {"def": def, "key": key, "scope": scope, "ctx": ctx, "stepIndex": 0, "awaiting": null, "done": false}
	state["sagas"].append(saga)
	state["sagaIndex"][key] = saga
	return _run_forward(state, saga)

func _run_forward(state: Dictionary, saga: Dictionary) -> Array:
	var steps: Array = saga["def"].get("steps", []) if typeof(saga["def"].get("steps")) == TYPE_ARRAY else []
	var out := []
	while saga["stepIndex"] < steps.size():
		var step: Dictionary = steps[saga["stepIndex"]]
		if truthy(step.get("do")):
			out.append_array(apply_verb(state, step, saga["ctx"]))
		if step.has("await"):
			var aw = step["await"]
			if typeof(aw) == TYPE_STRING and aw == "done":
				saga["stepIndex"] += 1
				continue
			if typeof(aw) == TYPE_DICTIONARY and aw.has("timer") and aw["timer"] != null:
				saga["awaiting"] = {"timer": resolve_ref(aw["timer"], saga["ctx"])}
				return out
			var rest := {}
			if typeof(aw) == TYPE_DICTIONARY:
				for k in aw:
					if k != "on":
						rest[k] = aw[k]
			saga["awaiting"] = {"type": aw.get("on", UNDEF) if typeof(aw) == TYPE_DICTIONARY else UNDEF, "match": resolve_fields(rest, saga["ctx"])}
			return out
		saga["stepIndex"] += 1
	saga["done"] = true
	var sagas: Array = state["sagas"]
	for i in sagas.size():
		if is_same(sagas[i], saga):
			sagas.remove_at(i)
			break
	if state["sagaIndex"].has(saga["key"]) and is_same(state["sagaIndex"][saga["key"]], saga):
		state["sagaIndex"].erase(saga["key"])
	return out

func _await_matches(awaiting: Dictionary, ev: Dictionary) -> bool:
	var t = awaiting.get("type", UNDEF)
	return not is_undef(t) and strict_eq(ev.get("type"), t) and matches(ev, awaiting.get("match"))

func _advance_saga(state: Dictionary, saga: Dictionary) -> Array:
	saga["awaiting"] = null
	saga["stepIndex"] += 1
	return _run_forward(state, saga)

static func _sagas_sorted(state: Dictionary) -> Array:
	var list: Array = (state["sagas"] as Array).duplicate()
	list.sort_custom(func(a, b): return a["key"] < b["key"])
	return list

func _reaction_match(ev: Dictionary, r: Dictionary) -> bool:
	return strict_eq(ev.get("type"), r.get("on", UNDEF)) and matches(ev, r["match"] if typeof(r.get("match")) == TYPE_DICTIONARY else {})

func _trigger_match(ev: Dictionary, s: Dictionary) -> bool:
	var tr = s.get("trigger")
	if not truthy(tr) or typeof(tr) != TYPE_DICTIONARY:
		return false
	if not strict_eq(ev.get("type"), tr.get("on", UNDEF)):
		return false
	var rest := {}
	for k in tr:
		if k != "on":
			rest[k] = tr[k]
	return matches(ev, rest)

static func _drop(state: Dictionary, n: int, reason: String) -> void:
	if n <= 0:
		return
	state["metrics"]["dropped"] += n
	state["metrics"]["capTrips"] += 1
	state["log"].append({"op": "cap", "reason": reason, "count": n})

# ── state ────────────────────────────────────────────────────────────────────────────────────────────────────────
func create_bus_state(config, initial_entities = []) -> Dictionary:
	var c: Dictionary = config if typeof(config) == TYPE_DICTIONARY else {}
	var state := {
		"config": {"budget": c["budget"] if finite(c.get("budget")) else 4096, "depthCap": c["depthCap"] if finite(c.get("depthCap")) else 8},
		"reactions": c["reactions"] if typeof(c.get("reactions")) == TYPE_ARRAY else [],
		"seqDefs": c["sequences"] if typeof(c.get("sequences")) == TYPE_ARRAY else [],
		"watches": c["watches"] if typeof(c.get("watches")) == TYPE_ARRAY else [],
		"timers": c["timers"] if typeof(c.get("timers")) == TYPE_ARRAY else [],
		"vars": (c["vars"] as Dictionary).duplicate() if typeof(c.get("vars")) == TYPE_DICTIONARY else {},
		"entities": [], "byId": {}, "_linked": {},
		"sagas": [], "sagaIndex": {},
		"log": [],
		"_watchPrev": {}, "_timerAcc": {},
		"metrics": {"processed": 0, "emitted": 0, "dropped": 0, "capTrips": 0, "noops": 0, "maxDepth": 0},
	}
	for e in (initial_entities if typeof(initial_entities) == TYPE_ARRAY else []):
		add_entity(state, e)
	return state

# ── watches: edge-detected predicates over vars, entities and the log ───────────────────────────────────────────
static func cmp(v, p: Dictionary) -> bool:
	if p.has("eq"):
		return strict_eq(v, p["eq"])
	if p.has("ne"):
		return not strict_eq(v, p["ne"])
	var ok := true
	if p.has("gte"): ok = ok and rel(v, p["gte"], ">=")
	if p.has("gt"): ok = ok and rel(v, p["gt"], ">")
	if p.has("lte"): ok = ok and rel(v, p["lte"], "<=")
	if p.has("lt"): ok = ok and rel(v, p["lt"], "<")
	return ok

static func field_of(e: Dictionary, field):
	if typeof(field) == TYPE_STRING:
		if field == "x": return e["position"][0]
		if field == "y": return e["position"][1]
		if field == "z": return e["position"][2]
	return get_or_undef(e, field)

func _match_entities(state: Dictionary, pat) -> Array:
	var out := []
	for e in state["entities"]:
		if glob(e["id"], pat):
			out.append(e)
	return out

func eval_predicate(state: Dictionary, when) -> bool:
	if typeof(when) != TYPE_DICTIONARY:
		return false
	if when.has("var"):
		return cmp(get_or_undef(state["vars"], when["var"]), when)
	if when.has("count"):
		var n := 0
		for r in state["log"]:
			if r.has("type") and strict_eq(r["type"], when["count"]):
				n += 1
		return cmp(n, when)
	if when.has("entity"):
		var key := js_string(when["entity"])
		return cmp(field_of(state["byId"][key], when.get("field", UNDEF)), when) if state["byId"].has(key) else false
	if when.has("all"):
		var es := _match_entities(state, when["all"])
		if es.is_empty():
			return false
		for e in es:
			if not cmp(field_of(e, when.get("field", UNDEF)), when):
				return false
		return true
	if when.has("any"):
		for e in _match_entities(state, when["any"]):
			if cmp(field_of(e, when.get("field", UNDEF)), when):
				return true
		return false
	return false

func watch_events(state: Dictionary) -> Array:
	var out := []
	var watches: Array = state["watches"]
	for i in watches.size():
		var w: Dictionary = watches[i]
		var now := eval_predicate(state, w.get("when"))
		var key := "w" + str(i)
		if now and not truthy(state["_watchPrev"].get(key)):
			var ev := {"type": stored(w.get("type", UNDEF)), "source": stored(w.get("type", UNDEF)), "scope": w["scope"] if w.has("scope") else null}
			for k in w:
				if k != "type" and k != "when" and k != "scope":
					ev[k] = w[k]
			out.append(ev)
		state["_watchPrev"][key] = now
	return out

# drain a tick's events to a fixed point: per depth a content sort, then reactions, sequence triggers, saga awaits
func process_events(state: Dictionary, incoming: Array) -> Dictionary:
	var cap: Dictionary = state["config"]
	var frontier := []
	for e in incoming:
		frontier.append(normalize_event(e))
	var depth := 0
	var stop := false
	while frontier.size() > 0 and not stop:
		if depth > float(cap["depthCap"]):
			_drop(state, frontier.size(), "depth")
			break
		if depth > state["metrics"]["maxDepth"]:
			state["metrics"]["maxDepth"] = depth
		frontier = sort_events(frontier)
		var next := []
		for i in frontier.size():
			if state["metrics"]["processed"] >= float(cap["budget"]):
				_drop(state, frontier.size() - i, "budget")
				stop = true
				break
			var ev: Dictionary = frontier[i]
			state["metrics"]["processed"] += 1
			state["log"].append({"type": ev["type"], "source": stored(ev.get("source", UNDEF)), "scope": stored(ev.get("scope", UNDEF)), "depth": depth})
			for r in state["reactions"]:
				if _reaction_match(ev, r):
					next.append_array(apply_verb(state, r, ev))
			for s in state["seqDefs"]:
				if _trigger_match(ev, s):
					next.append_array(_instantiate(state, s, ev))
			for saga in _sagas_sorted(state):
				if saga["awaiting"] != null and _await_matches(saga["awaiting"], ev):
					next.append_array(_advance_saga(state, saga))
		if stop:
			_drop(state, next.size(), "budget")
			break
		depth += 1
		frontier = next
	return state

# recurring heartbeats: each { every, emit, while? } fires every `every` seconds while its predicate holds
func tick_timers(state: Dictionary, dt: float) -> Array:
	var out := []
	var timers: Array = state["timers"]
	for i in timers.size():
		var t = timers[i]
		if typeof(t) != TYPE_DICTIONARY or not truthy(t.get("emit")):
			continue
		if truthy(t.get("while")) and not eval_predicate(state, t["while"]):
			continue
		var key := "t" + str(i)
		var period := maxf(1e-3, float(t["every"])) if finite(t.get("every")) else 1.0
		state["_timerAcc"][key] = float(state["_timerAcc"].get(key, 0.0)) + dt
		var guard := 0
		while state["_timerAcc"][key] >= period and guard < 64:
			guard += 1
			state["_timerAcc"][key] -= period
			var ev := {"source": stored(t["emit"].get("type", UNDEF)), "scope": null}
			for k in t["emit"]:
				ev[k] = t["emit"][k]
			out.append(ev)
	return out

# advance saga timer awaits; returns what an expired one emits
func step_time(state: Dictionary, dt: float) -> Array:
	var emitted := []
	for saga in _sagas_sorted(state):
		var aw = saga["awaiting"]
		if aw != null and aw.has("timer") and aw["timer"] != null:
			aw["timer"] = to_number(aw["timer"]) - dt
			if aw["timer"] <= 0:
				emitted.append_array(_advance_saga(state, saga))
	return emitted

# the canonical snapshot of what happened: entities by id, vars, the durable log, the loud-cap counters
func hash_state(state: Dictionary) -> String:
	var entities: Array = (state["entities"] as Array).duplicate()
	entities.sort_custom(func(a, b): return js_string(a["id"]) < js_string(b["id"]))
	var m: Dictionary = state["metrics"]
	return ss({"entities": entities, "vars": state["vars"], "log": state["log"], "metrics": {"processed": m["processed"], "emitted": m["emitted"], "dropped": m["dropped"], "capTrips": m["capTrips"], "noops": m["noops"], "maxDepth": m["maxDepth"]}})

# ── zone facts: entities' positions against declared { type: 'zone' } sources, edge-triggered enter / exit ───────
static func _zone_pos(e):
	if typeof(e) != TYPE_DICTIONARY:
		return null
	if typeof(e.get("transform")) == TYPE_DICTIONARY:
		return e["transform"].get("pos")
	return e.get("position")

static func _in_zone(p, s: Dictionary) -> bool:
	if typeof(p) != TYPE_ARRAY:
		return false
	var at: Array = s["at"] if typeof(s.get("at")) == TYPE_ARRAY else [0, 0, 0]
	var dims := 2 if truthy(s.get("planar")) else 3
	if typeof(s.get("half")) == TYPE_ARRAY:
		for i in dims:
			if absf(to_number(p[i]) - to_number(at[i])) > to_number(s["half"][i]):
				return false
		return true
	var r := float(s["radius"]) if finite(s.get("radius")) else 1.0
	var d2 := 0.0
	for i in dims:
		var dd := to_number(p[i]) - to_number(at[i])
		d2 += dd * dd
	return d2 <= r * r

func derive_zone_events(entities: Array, prev, sources: Array) -> Dictionary:
	var inside: Dictionary = prev["inside"] if typeof(prev) == TYPE_DICTIONARY and typeof(prev.get("inside")) == TYPE_DICTIONARY else {}
	var events := []
	var cur := {}
	for s in sources:
		if typeof(s) != TYPE_DICTIONARY or s.get("type") != "zone" or not truthy(s.get("zone")):
			continue
		var watch = s["watch"] if truthy(s.get("watch")) else "*"
		for e in entities:
			if typeof(e) != TYPE_DICTIONARY or not truthy(e.get("id")) or truthy(e.get("gone")):
				continue
			if not glob(e["id"], watch):
				continue
			if not _in_zone(_zone_pos(e), s):
				continue
			var key := js_string(s["zone"]) + "|" + js_string(e["id"])
			cur[key] = 1
			if inside.has(key):
				continue
			var pos = _zone_pos(e)
			events.append({"type": "enter", "zone": s["zone"], "entity": e["id"], "source": s["zone"], "at": (pos as Array).duplicate() if typeof(pos) == TYPE_ARRAY else []})
	for key in inside:
		if cur.has(key):
			continue
		var i: int = key.find("|")
		events.append({"type": "exit", "zone": key.substr(0, i), "entity": key.substr(i + 1), "source": key.substr(0, i)})
	return {"events": events, "prev": {"inside": cur}}

# the character intents and warps a tick queued, handed to the kernel's adapters (the web's syncToCtrl), then cleared
func take_ctrl(state: Dictionary) -> Dictionary:
	var ops: Array = state.get("_ctrlOps", [])
	var warps: Dictionary = state.get("_ctrlWarps", {})
	state["_ctrlOps"] = []
	state["_ctrlWarps"] = {}
	return {"ops": ops, "warps": warps}

# ── one page frame, in the web order (scene/channels/events.js): input → process → watch fixpoint → timers → sagas
# with stats (kernel/stats.gd, the page's __STATS) each pass first steps them over the ctrl queue: their events are
# processed before the watches are read, and the loop ends only when neither has anything left
var stats = null
var stats_cfg = null

func _watch_fix(state: Dictionary) -> void:
	for g in 8:
		var st: Array = stats.step(stats_cfg, state) if stats != null else []
		if not st.is_empty():
			process_events(state, st)
		var w := watch_events(state)
		if w.is_empty() and st.is_empty():
			break
		if not w.is_empty():
			process_events(state, w)

func frame(state: Dictionary, incoming: Array, dt: float) -> void:
	if not incoming.is_empty():
		process_events(state, incoming)
	_watch_fix(state)
	var ticks := tick_timers(state, dt)
	if not ticks.is_empty():
		process_events(state, ticks)
	var timed := step_time(state, dt)
	if not timed.is_empty():
		process_events(state, timed)
	_watch_fix(state)
