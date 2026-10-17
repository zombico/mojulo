extends RefCounted
# mojulo-godot kernel — the EVENT BUS, a literal port of buildBus (lib/graph/worlds/event-bus.js). Every behaviour
# mojulo lowers (cues, chapters, menu picks, mechanics) arrives as a bus fragment: reactions, watches, sequences,
# timers, vars. This script runs that fragment the way the web page does, so behaviour travels as data and one
# reducer performs it on both sides. The port is held EQUAL to the web reducer by a conformance corpus
# (scripts/conformance.mjs --engine godot --corpus bus): the same event script gives the same canonical state string, frame by frame.
#
# JS semantics, made explicit: Godot reads every JSON number as a float, so numbers are compared as numbers, printed
# the way JSON.stringify prints them, and hashed over UTF-16 code units. Read the fragment with kernel/json_exact.gd:
# Godot's own JSON parser rounds some decimals to a neighbouring double, and the bus would then diverge. A key the reducer never wrote reads as
# Js.UNDEF (JS undefined), which is distinct from null where JS tells them apart (match wildcards, `!== undefined`).
# Numbers print as JS prints them (kernel/json_exact.gd js_number: the shortest digits, exponent forms included).
#
#   var bus = preload("res://kernel/bus.gd").new()
#   var st = bus.create_bus_state(config, entities)
#   bus.process_events(st, events); bus.watch_events(st); bus.tick_timers(st, dt); bus.step_time(st, dt)
#   bus.frame(st, incoming, dt)     the web page's frame order (scene/channels/events.js), for a driver
#   bus.hash_state(st)              the canonical snapshot the conformance corpus compares

const JsonExact := preload("res://kernel/json_exact.gd")
const Js := preload("res://kernel/js.gd")
const RESERVED := {"do": 1, "type": 1, "source": 1, "scope": 1, "on": 1, "match": 1, "await": 1, "target": 1, "template": 1, "at": 1, "to": 1, "vector": 1, "dir": 1, "gain": 1, "var": 1, "by": 1, "if": 1}
const DIRS := {"up": [0, 0, 1], "down": [0, 0, -1], "left": [-1, 0, 0], "right": [1, 0, 0], "forward": [0, 1, 0], "back": [0, -1, 0]}


static func get_or_undef(obj, key):
	if typeof(obj) == TYPE_DICTIONARY:
		return obj[key] if obj.has(key) else Js.UNDEF
	return Js.UNDEF

func matches(ev: Dictionary, match_obj) -> bool:
	if typeof(match_obj) != TYPE_DICTIONARY:
		return true
	for k in match_obj:
		if not Js.glob(get_or_undef(ev, k), match_obj[k]):
			return false
	return true

# 'event.<path>' reads from the firing / context event; anything else is literal
static func resolve_ref(v, ev):
	if typeof(v) == TYPE_STRING and not Js.is_undef(v) and v.begins_with("event."):
		var cur = ev
		for part in v.substr(6).split("."):
			if cur == null or Js.is_undef(cur):
				return Js.UNDEF
			if typeof(cur) == TYPE_DICTIONARY:
				cur = cur[part] if cur.has(part) else Js.UNDEF
			elif typeof(cur) == TYPE_ARRAY and part.is_valid_int() and int(part) >= 0 and int(part) < cur.size():
				cur = cur[int(part)]
			else:
				return Js.UNDEF
		return cur
	return v

static func resolve_fields(obj: Dictionary, ev) -> Dictionary:
	var out := {}
	for k in obj:
		out[k] = resolve_ref(obj[k], ev)
	return out

# a value written into state as it resolved: an undefined stays Js.UNDEF (JS keeps undefined, which compares false
# where null compares as 0); ss prints it as null, as JSON does
static func stored(v):
	return v

# JS `x.k !== undefined`
static func defined(d: Dictionary, k) -> bool:
	return d.has(k) and not Js.is_undef(d[k])

static func dup(v):
	if typeof(v) == TYPE_ARRAY or typeof(v) == TYPE_DICTIONARY:
		return v.duplicate(true)
	return v

# ── events ───────────────────────────────────────────────────────────────────────────────────────────────────────
static func normalize_event(raw: Dictionary) -> Dictionary:
	var e := raw.duplicate()
	if typeof(e.get("type")) != TYPE_STRING or Js.is_undef(e.get("type")):
		e["type"] = Js.js_string(e["type"]) if e.has("type") and Js.truthy(e["type"]) else "event"
	if not defined(e, "source"):
		e["source"] = e["a"] if defined(e, "a") else (e["id"] if defined(e, "id") else "")
	if not defined(e, "scope"):
		e["scope"] = null
	return e

static func sort_key(e) -> String:
	return Js.ss(e)

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
		"id": stored(raw.get("id", Js.UNDEF)),
		"type": raw["type"] if raw.has("type") and Js.truthy(raw["type"]) else "entity",
		"on": Js.truthy(raw.get("on")),
		"position": (raw["position"] as Array).duplicate() if typeof(raw.get("position")) == TYPE_ARRAY else [0, 0, 0],
		"velocity": (raw["velocity"] as Array).duplicate() if typeof(raw.get("velocity")) == TYPE_ARRAY else [0, 0, 0],
	}
	if raw.has("pose"):
		e["pose"] = raw["pose"]
	if raw.has("color"):
		e["color"] = raw["color"]
	if Js.finite(raw.get("radius")):
		e["radius"] = raw["radius"]
	state["entities"].append(e)
	state["byId"][Js.js_string(e["id"])] = e
	return e

static func impulse_vec(spec: Dictionary, ev) -> Array:
	var v = resolve_ref(spec.get("vector", Js.UNDEF), ev)
	if typeof(v) == TYPE_ARRAY:
		return v
	var dk = resolve_ref(spec.get("dir", Js.UNDEF), ev)
	var d: Array = DIRS.get(Js.js_string(dk), [0, 0, 0]) if typeof(dk) == TYPE_STRING and not Js.is_undef(dk) else [0, 0, 0]
	var g0 = resolve_ref(spec.get("gain", Js.UNDEF), ev)
	var g := float(g0) if Js.finite(g0) else 1.0
	return [d[0] * g, d[1] * g, d[2] * g]

static func clamp_var(v: float, spec: Dictionary) -> float:
	if Js.finite(spec.get("min")) and v < float(spec["min"]):
		v = float(spec["min"])
	if Js.finite(spec.get("max")) and v > float(spec["max"]):
		v = float(spec["max"])
	return v

# one verb, from a reaction or a sequence step; only `emit` returns events
func apply_verb(state: Dictionary, spec: Dictionary, ev: Dictionary) -> Array:
	var verb = spec.get("do")
	if not Js.truthy(verb):
		return []
	if verb == "emit":
		var out := {"type": stored(spec.get("type", Js.UNDEF))}
		var src = resolve_ref(spec.get("source", Js.UNDEF), ev)
		out["source"] = stored(ev.get("source", Js.UNDEF)) if Js.is_undef(src) else src
		out["scope"] = stored(resolve_ref(spec["scope"], ev)) if spec.has("scope") else stored(ev.get("scope", Js.UNDEF))
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
		var v = resolve_ref(spec.get("to", Js.UNDEF), ev)
		if Js.is_num(v):
			v = clamp_var(float(v), spec)
		state["vars"][spec.get("var")] = stored(v)
		return []
	if verb == "inc":
		var by := Js.to_number(resolve_ref(spec.get("by", Js.UNDEF), ev))
		var cur := Js.to_number(state["vars"].get(spec.get("var"), Js.UNDEF))
		if is_nan(cur) or cur == 0.0:
			cur = 0.0
		state["vars"][spec.get("var")] = clamp_var(cur + (by if not is_nan(by) and not is_inf(by) else 1.0), spec)
		return []

	var tid = resolve_ref(spec.get("target", Js.UNDEF), ev)
	var by_id: Dictionary = state["byId"]
	var tkey := Js.js_string(tid)
	if not by_id.has(tkey):
		if verb == "move":
			var to = resolve_ref(spec.get("to", Js.UNDEF), ev)
			if typeof(to) == TYPE_ARRAY:
				if not state.has("_ctrlWarps"):
					state["_ctrlWarps"] = {}
				state["_ctrlWarps"][tkey] = to.duplicate()
				return []
		state["metrics"]["noops"] += 1
		state["log"].append({"op": "noop", "verb": verb, "target": null if Js.is_undef(tid) else tid})
		return []
	var target: Dictionary = by_id[tkey]
	if verb == "toggle":
		target["on"] = Js.truthy(resolve_ref(spec["to"], ev)) if spec.has("to") else not Js.truthy(target["on"])
	elif verb == "impulse":
		var iv := impulse_vec(spec, ev)
		var vel: Array = target["velocity"]
		target["velocity"] = [Js.to_number(vel[0]) + Js.to_number(iv[0]), Js.to_number(vel[1]) + Js.to_number(iv[1]), Js.to_number(vel[2]) + Js.to_number(iv[2])]
	elif verb == "move":
		var to = resolve_ref(spec.get("to", Js.UNDEF), ev)
		if typeof(to) == TYPE_ARRAY:
			target["position"] = to.duplicate()
		else:
			target["pose"] = stored(to)
	return []

# the spawned id is CONTENT-derived (from the spawning event), so spawn order never changes ids
func _spawn_entity(state: Dictionary, spec: Dictionary, ev: Dictionary) -> void:
	var tmpl: Dictionary = spec["template"] if typeof(spec.get("template")) == TYPE_DICTIONARY else {}
	var at = resolve_ref(spec.get("at", Js.UNDEF), ev)
	var typ = tmpl["type"] if Js.truthy(tmpl.get("type")) else (spec["type"] if Js.truthy(spec.get("type")) else "spawn")
	var id = tmpl["id"] if Js.truthy(tmpl.get("id")) else (Js.js_string(typ) + "-" + Js.fnv(sort_key(ev)))
	var raw := {
		"id": id, "type": typ, "on": Js.truthy(tmpl.get("on")),
		"position": at if typeof(at) == TYPE_ARRAY else (tmpl["position"] if Js.truthy(tmpl.get("position")) else [0, 0, 0]),
		"velocity": tmpl["velocity"] if Js.truthy(tmpl.get("velocity")) else [0, 0, 0],
	}
	var key := Js.js_string(id)
	if state["byId"].has(key):
		var e: Dictionary = state["byId"][key]
		e["type"] = raw["type"]; e["on"] = raw["on"]
		e["position"] = (raw["position"] as Array).duplicate(); e["velocity"] = (raw["velocity"] as Array).duplicate()
	else:
		add_entity(state, raw)

# ── sequences (sagas): ordered steps, one instance per resolved scope ───────────────────────────────────────────
func _instantiate(state: Dictionary, def: Dictionary, ev: Dictionary) -> Array:
	var scope = resolve_ref(def["scope"], ev) if def.has("scope") else null
	var key := Js.js_string(def.get("id", Js.UNDEF)) + " " + Js.ss(scope)
	if state["sagaIndex"].has(key):
		return []
	var ctx := ev.duplicate()
	if scope != null and not Js.is_undef(scope):
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
		if Js.truthy(step.get("do")):
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
			saga["awaiting"] = {"type": aw.get("on", Js.UNDEF) if typeof(aw) == TYPE_DICTIONARY else Js.UNDEF, "match": resolve_fields(rest, saga["ctx"])}
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
	var t = awaiting.get("type", Js.UNDEF)
	return not Js.is_undef(t) and Js.strict_eq(ev.get("type"), t) and matches(ev, awaiting.get("match"))

func _advance_saga(state: Dictionary, saga: Dictionary) -> Array:
	saga["awaiting"] = null
	saga["stepIndex"] += 1
	return _run_forward(state, saga)

static func _sagas_sorted(state: Dictionary) -> Array:
	var list: Array = (state["sagas"] as Array).duplicate()
	list.sort_custom(func(a, b): return a["key"] < b["key"])
	return list

# a reaction's `if`: it matches only while its predicate holds, read against the state the reactions before it left
func _reaction_match(state: Dictionary, ev: Dictionary, r: Dictionary) -> bool:
	return Js.strict_eq(ev.get("type"), r.get("on", Js.UNDEF)) and matches(ev, r["match"] if typeof(r.get("match")) == TYPE_DICTIONARY else {}) \
		and (not Js.truthy(r.get("if", Js.UNDEF)) or eval_predicate(state, r["if"]))

func _trigger_match(ev: Dictionary, s: Dictionary) -> bool:
	var tr = s.get("trigger")
	if not Js.truthy(tr) or typeof(tr) != TYPE_DICTIONARY:
		return false
	if not Js.strict_eq(ev.get("type"), tr.get("on", Js.UNDEF)):
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
		"config": {"budget": c["budget"] if Js.finite(c.get("budget")) else 4096, "depthCap": c["depthCap"] if Js.finite(c.get("depthCap")) else 8},
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
		return Js.strict_eq(v, p["eq"])
	if p.has("ne"):
		return not Js.strict_eq(v, p["ne"])
	var ok := true
	if p.has("gte"): ok = ok and Js.rel(v, p["gte"], ">=")
	if p.has("gt"): ok = ok and Js.rel(v, p["gt"], ">")
	if p.has("lte"): ok = ok and Js.rel(v, p["lte"], "<=")
	if p.has("lt"): ok = ok and Js.rel(v, p["lt"], "<")
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
		if Js.glob(e["id"], pat):
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
			if r.has("type") and Js.strict_eq(r["type"], when["count"]):
				n += 1
		return cmp(n, when)
	if when.has("entity"):
		var key := Js.js_string(when["entity"])
		return cmp(field_of(state["byId"][key], when.get("field", Js.UNDEF)), when) if state["byId"].has(key) else false
	if when.has("all"):
		var es := _match_entities(state, when["all"])
		if es.is_empty():
			return false
		for e in es:
			if not cmp(field_of(e, when.get("field", Js.UNDEF)), when):
				return false
		return true
	if when.has("any"):
		for e in _match_entities(state, when["any"]):
			if cmp(field_of(e, when.get("field", Js.UNDEF)), when):
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
		if now and not Js.truthy(state["_watchPrev"].get(key)):
			var ev := {"type": stored(w.get("type", Js.UNDEF)), "source": stored(w.get("type", Js.UNDEF)), "scope": w["scope"] if w.has("scope") else null}
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
	# the budget caps one drain, never the bus's life (metrics.processed keeps the lifetime total)
	var spent := 0
	while frontier.size() > 0 and not stop:
		if depth > float(cap["depthCap"]):
			_drop(state, frontier.size(), "depth")
			break
		if depth > state["metrics"]["maxDepth"]:
			state["metrics"]["maxDepth"] = depth
		frontier = sort_events(frontier)
		var next := []
		for i in frontier.size():
			if spent >= float(cap["budget"]):
				_drop(state, frontier.size() - i, "budget")
				stop = true
				break
			var ev: Dictionary = frontier[i]
			spent += 1
			state["metrics"]["processed"] += 1
			state["log"].append({"type": ev["type"], "source": stored(ev.get("source", Js.UNDEF)), "scope": stored(ev.get("scope", Js.UNDEF)), "depth": depth})
			for r in state["reactions"]:
				if _reaction_match(state, ev, r):
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
		if typeof(t) != TYPE_DICTIONARY or not Js.truthy(t.get("emit")):
			continue
		if Js.truthy(t.get("while")) and not eval_predicate(state, t["while"]):
			continue
		var key := "t" + str(i)
		var period := maxf(1e-3, float(t["every"])) if Js.finite(t.get("every")) else 1.0
		state["_timerAcc"][key] = float(state["_timerAcc"].get(key, 0.0)) + dt
		var guard := 0
		while state["_timerAcc"][key] >= period and guard < 64:
			guard += 1
			state["_timerAcc"][key] -= period
			var ev := {"source": stored(t["emit"].get("type", Js.UNDEF)), "scope": null}
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
			aw["timer"] = Js.to_number(aw["timer"]) - dt
			if aw["timer"] <= 0:
				emitted.append_array(_advance_saga(state, saga))
	return emitted

# the canonical snapshot of what happened: entities by id, vars, the durable log, the loud-cap counters
func hash_state(state: Dictionary) -> String:
	var entities: Array = (state["entities"] as Array).duplicate()
	entities.sort_custom(func(a, b): return Js.js_string(a["id"]) < Js.js_string(b["id"]))
	var m: Dictionary = state["metrics"]
	return Js.ss({"entities": entities, "vars": state["vars"], "log": state["log"], "metrics": {"processed": m["processed"], "emitted": m["emitted"], "dropped": m["dropped"], "capTrips": m["capTrips"], "noops": m["noops"], "maxDepth": m["maxDepth"]}})

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
	var dims := 2 if Js.truthy(s.get("planar")) else 3
	if typeof(s.get("half")) == TYPE_ARRAY:
		for i in dims:
			if absf(Js.to_number(p[i]) - Js.to_number(at[i])) > Js.to_number(s["half"][i]):
				return false
		return true
	var r := float(s["radius"]) if Js.finite(s.get("radius")) else 1.0
	var d2 := 0.0
	for i in dims:
		var dd := Js.to_number(p[i]) - Js.to_number(at[i])
		d2 += dd * dd
	return d2 <= r * r

func derive_zone_events(entities: Array, prev, sources: Array) -> Dictionary:
	var inside: Dictionary = prev["inside"] if typeof(prev) == TYPE_DICTIONARY and typeof(prev.get("inside")) == TYPE_DICTIONARY else {}
	var events := []
	var cur := {}
	for s in sources:
		if typeof(s) != TYPE_DICTIONARY or s.get("type") != "zone" or not Js.truthy(s.get("zone")):
			continue
		var watch = s["watch"] if Js.truthy(s.get("watch")) else "*"
		for e in entities:
			if typeof(e) != TYPE_DICTIONARY or not Js.truthy(e.get("id")) or Js.truthy(e.get("gone")):
				continue
			if not Js.glob(e["id"], watch):
				continue
			if not _in_zone(_zone_pos(e), s):
				continue
			var key := Js.js_string(s["zone"]) + "|" + Js.js_string(e["id"])
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
