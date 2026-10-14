extends RefCounted
# mojulo-godot kernel — the GAME STORE, a literal port of buildGameStoreKernel (lib/graph/game/store-kernel.js): five
# slice kinds (character, inventory, party, progression, flags) changed only by typed events, one atomic write per
# level (the outcome envelope, checked against the level's contract), and the gates that open the level list. Held
# EQUAL to the web store by the conformance corpus (scripts/godot-bus-conformance.mjs, the store scenarios): the same
# schema and the same writes give the same state and the same errors, word for word.
#
#   var K = preload("res://kernel/store.gd").new()
#   var state = K.create_store(schema)
#   K.apply_outcome(schema, state, contract, envelope) → {ok, state} | {ok: false, errors}
#   K.eval_gate(schema, state, gate) → bool

const Bus := preload("res://kernel/bus.gd")
const CONTRACT_VERSION := 1
const SLICE_KINDS := ["character", "inventory", "party", "progression", "flags"]
const EVENTS_BY_KIND := {
	"character": ["setStat", "levelUp"],
	"inventory": ["grant", "consume"],
	"party": ["recruit", "dismiss", "setStat", "levelUp"],
	"progression": ["promote"],
	"flags": ["setFlag"],
}
const EVENT_TYPES := ["grant", "consume", "setStat", "levelUp", "setFlag", "promote", "recruit", "dismiss"]

static func _clone(v):
	if typeof(v) == TYPE_ARRAY or typeof(v) == TYPE_DICTIONARY:
		return v.duplicate(true)
	return v

static func _s(v) -> String:
	return Bus.js_string(v)

static func _at(d, k):
	return d[k] if typeof(d) == TYPE_DICTIONARY and d.has(k) else Bus.UNDEF

static func _undef(v) -> bool:
	return Bus.is_undef(v)

static func _pos_int(v) -> bool:
	return Bus.finite(v) and float(v) > 0 and floor(float(v)) == float(v)

static func _init_slice(kind, init):
	var s: Dictionary = init if typeof(init) == TYPE_DICTIONARY else {}
	match kind:
		"character":
			return {"level": s["level"] if s.has("level") and s["level"] != null else 1, "xp": s["xp"] if Bus.truthy(s.get("xp")) else 0, "stats": _clone(s["stats"]) if Bus.truthy(s.get("stats")) else {}}
		"inventory":
			return {"items": _clone(s["items"]) if Bus.truthy(s.get("items")) else {}}
		"party":
			var roster := {}
			var r: Dictionary = s["roster"] if typeof(s.get("roster")) == TYPE_DICTIONARY else {}
			for id in r:
				var m: Dictionary = r[id] if typeof(r[id]) == TYPE_DICTIONARY else {}
				roster[id] = {"name": m["name"] if Bus.truthy(m.get("name")) else id, "level": m["level"] if m.has("level") and m["level"] != null else 1, "xp": m["xp"] if Bus.truthy(m.get("xp")) else 0, "stats": _clone(m["stats"]) if Bus.truthy(m.get("stats")) else {}, "tags": _clone(m["tags"]) if Bus.truthy(m.get("tags")) else []}
			return {"roster": roster}
		"progression":
			return {"completed": _clone(s["completed"]) if Bus.truthy(s.get("completed")) else {}, "unlocked": _clone(s["unlocked"]) if Bus.truthy(s.get("unlocked")) else []}
		"flags":
			return {"flags": _clone(s["flags"]) if Bus.truthy(s.get("flags")) else {}}
	push_error("game-store: unknown slice kind \"" + _s(kind) + "\" (kinds: " + ", ".join(SLICE_KINDS) + ")")
	return null

func create_store(schema) -> Dictionary:
	var state := {}
	for sl in (schema.get("slices", []) if typeof(schema) == TYPE_DICTIONARY and typeof(schema.get("slices")) == TYPE_ARRAY else []):
		if typeof(sl) != TYPE_DICTIONARY or not Bus.truthy(sl.get("name")):
			push_error("game-store: bad slice declaration")
			continue
		state[sl["name"]] = _init_slice(sl.get("kind"), sl.get("init"))
	return state

static func _slices(schema) -> Array:
	return schema["slices"] if typeof(schema) == TYPE_DICTIONARY and typeof(schema.get("slices")) == TYPE_ARRAY else []

static func slice_kind(schema, name):
	for sl in _slices(schema):
		if Bus.strict_eq(sl.get("name"), name):
			return sl.get("kind")
	return null

static func first_slice_of_kind(schema, kind):
	for sl in _slices(schema):
		if sl.get("kind") == kind:
			return sl.get("name")
	return null

static func _apply_to_member(target: Dictionary, ev: Dictionary, where: String, errors: Array) -> void:
	var t = ev.get("type")
	if t == "setStat":
		var stat = _at(ev, "stat")
		if not Bus.truthy(stat) or typeof(stat) != TYPE_STRING:
			errors.append(where + ": setStat needs a stat name")
			return
		var cur = target["stats"][stat] if target["stats"].has(stat) and Bus.truthy(target["stats"][stat]) else 0
		if Bus.is_num(_at(ev, "delta")):
			target["stats"][stat] = float(cur) + float(ev["delta"])
		elif Bus.is_num(_at(ev, "value")):
			target["stats"][stat] = ev["value"]
		else:
			errors.append(where + ": setStat needs numeric value or delta")
	if t == "levelUp":
		var by = 1 if _undef(_at(ev, "by")) else ev["by"]
		if not _pos_int(by):
			errors.append(where + ": levelUp.by must be a positive integer")
			return
		target["level"] = float(target["level"]) + float(by)
		if Bus.is_num(_at(ev, "xp")):
			target["xp"] = float(target["xp"]) + float(ev["xp"])

# typed events, ATOMICALLY: every event checked first; any failure leaves the state untouched
func apply_events(schema, state: Dictionary, events) -> Dictionary:
	var errors := []
	if typeof(events) != TYPE_ARRAY:
		return {"ok": false, "errors": ["events must be an array"]}
	var next: Dictionary = state.duplicate(true)
	for i in events.size():
		var ev = events[i]
		var where := "events[" + str(i) + "]"
		if typeof(ev) != TYPE_DICTIONARY:
			errors.append(where + " must be an object")
			continue
		var t = _at(ev, "type")
		if not (typeof(t) == TYPE_STRING and EVENT_TYPES.has(t)):
			errors.append(where + ".type \"" + _s(t) + "\" is not a typed event (" + ", ".join(EVENT_TYPES) + ")")
			continue
		var kind = slice_kind(schema, _at(ev, "slice"))
		if kind == null:
			errors.append(where + ".slice \"" + _s(_at(ev, "slice")) + "\" is not a declared slice")
			continue
		if not (EVENTS_BY_KIND[kind] as Array).has(t):
			errors.append(where + ": slice \"" + _s(ev["slice"]) + "\" (" + kind + ") does not accept \"" + t + "\" (accepts: " + ", ".join(EVENTS_BY_KIND[kind]) + ")")
			continue
		var s: Dictionary = next[ev["slice"]]

		if kind == "inventory":
			var count = 1 if _undef(_at(ev, "count")) else ev["count"]
			var item = _at(ev, "item")
			if not Bus.truthy(item) or typeof(item) != TYPE_STRING:
				errors.append(where + ": needs an item id")
				continue
			if not _pos_int(count):
				errors.append(where + ": count must be a positive integer")
				continue
			if t == "grant":
				s["items"][item] = (float(s["items"][item]) if s["items"].has(item) and Bus.truthy(s["items"][item]) else 0.0) + float(count)
			else:
				var have = float(s["items"][item]) if s["items"].has(item) and Bus.truthy(s["items"][item]) else 0.0
				if have < float(count):
					errors.append(where + ": cannot consume " + _s(count) + " × \"" + item + "\" (have " + _s(have) + ")")
					continue
				if have == float(count):
					s["items"].erase(item)
				else:
					s["items"][item] = have - float(count)

		if kind == "character":
			_apply_to_member(s, ev, where, errors)

		if kind == "party":
			if t == "recruit":
				var m = _at(ev, "member")
				if typeof(m) != TYPE_DICTIONARY or not Bus.truthy(m.get("id")) or typeof(m.get("id")) != TYPE_STRING:
					errors.append(where + ": recruit needs member: { id, name?, stats?, ... }")
					continue
				if s["roster"].has(m["id"]):
					errors.append(where + ": member \"" + m["id"] + "\" is already in the roster")
					continue
				s["roster"][m["id"]] = {"name": m["name"] if Bus.truthy(m.get("name")) else m["id"], "level": m["level"] if m.has("level") and m["level"] != null else 1, "xp": m["xp"] if Bus.truthy(m.get("xp")) else 0, "stats": _clone(m["stats"]) if Bus.truthy(m.get("stats")) else {}, "tags": _clone(m["tags"]) if Bus.truthy(m.get("tags")) else []}
			elif t == "dismiss":
				var id = _at(ev, "id")
				if not Bus.truthy(id) or not s["roster"].has(_s(id)):
					errors.append(where + ": dismiss — no member \"" + _s(id) + "\" in the roster")
					continue
				s["roster"].erase(_s(id))
			else:
				var id = _at(ev, "id")
				if not Bus.truthy(id) or not s["roster"].has(_s(id)):
					errors.append(where + ": " + t + " on a party needs id of a roster member (no \"" + _s(id) + "\")")
					continue
				_apply_to_member(s["roster"][_s(id)], ev, where, errors)

		if kind == "progression" and t == "promote":
			var ref = _at(ev, "ref")
			if not Bus.truthy(ref) or typeof(ref) != TYPE_STRING:
				errors.append(where + ": promote needs the level ref")
				continue
			var result = "success" if _undef(_at(ev, "result")) else ev["result"]
			if not (Bus.strict_eq(result, "success") or Bus.strict_eq(result, "fail")):
				errors.append(where + ": promote.result must be success | fail")
				continue
			s["completed"][ref] = result
			if result == "success" and not (s["unlocked"] as Array).has(ref):
				s["unlocked"].append(ref)

		if kind == "flags" and t == "setFlag":
			var key = _at(ev, "key")
			if not Bus.truthy(key) or typeof(key) != TYPE_STRING:
				errors.append(where + ": setFlag needs a key")
				continue
			var v = _at(ev, "value")
			if not _undef(v) and not (typeof(v) == TYPE_BOOL or Bus.is_num(v) or typeof(v) == TYPE_STRING):
				errors.append(where + ": setFlag.value must be boolean | number | string")
				continue
			s["flags"][key] = true if _undef(v) else v
	if errors.is_empty():
		return {"ok": true, "state": next}
	return {"ok": false, "errors": errors}

# the outcome envelope against the level contract's produces
func validate_envelope(contract, envelope) -> Dictionary:
	var errors := []
	if typeof(envelope) != TYPE_DICTIONARY:
		return {"ok": false, "errors": ["envelope must be an object"]}
	if not Bus.strict_eq(_at(envelope, "contractVersion"), CONTRACT_VERSION):
		errors.append("envelope.contractVersion " + _s(_at(envelope, "contractVersion")) + " ≠ shell contract version " + str(CONTRACT_VERSION))
	var produces = contract.get("produces") if typeof(contract) == TYPE_DICTIONARY else null
	var results: Array = produces["results"] if typeof(produces) == TYPE_DICTIONARY and Bus.truthy(produces.get("results")) else ["success", "fail", "abort"]
	var res = _at(envelope, "result")
	var found := false
	for r in results:
		if Bus.strict_eq(r, res):
			found = true
	if not found:
		errors.append("envelope.result \"" + _s(res) + "\" not allowed (allowed: " + ", ".join(results.map(func(x): return _s(x))) + ")")
	var allowed: Array = produces["events"] if typeof(produces) == TYPE_DICTIONARY and Bus.truthy(produces.get("events")) else []
	var events: Array = envelope["events"] if typeof(envelope.get("events")) == TYPE_ARRAY else []
	if typeof(envelope.get("events")) != TYPE_ARRAY:
		errors.append("envelope.events must be an array (may be empty)")
	var counts := {}
	for i in events.size():
		var ev = events[i]
		var et = _at(ev, "type") if typeof(ev) == TYPE_DICTIONARY else Bus.UNDEF
		var es = _at(ev, "slice") if typeof(ev) == TYPE_DICTIONARY else Bus.UNDEF
		var rule = null
		for r in allowed:
			if typeof(r) == TYPE_DICTIONARY and Bus.strict_eq(_at(r, "type"), et) and Bus.strict_eq(_at(r, "slice"), es):
				rule = r
				break
		if rule == null:
			errors.append("events[" + str(i) + "] (" + _s(et) + " → " + _s(es) + ") is not declared in the level contract’s produces.events")
			continue
		var key := _s(rule["type"]) + "→" + _s(rule["slice"])
		counts[key] = int(counts.get(key, 0)) + 1
		if rule.has("max") and not _undef(rule["max"]) and counts[key] > float(rule["max"]):
			errors.append("events[" + str(i) + "] exceeds produces max for " + key + " (max " + _s(rule["max"]) + ")")
	if errors.is_empty():
		return {"ok": true}
	return {"ok": false, "errors": errors}

# the one write per level: the envelope against the contract, then applied atomically
func apply_outcome(schema, state: Dictionary, contract, envelope) -> Dictionary:
	var v := validate_envelope(contract, envelope)
	if not v["ok"]:
		return {"ok": false, "errors": v["errors"]}
	return apply_events(schema, state, envelope["events"] if typeof(envelope.get("events")) == TYPE_ARRAY else [])

# a gate on the level list: { has, count?, slice? } | { flag, equals?, slice? } | { completed: ref, slice? }; none is open
func eval_gate(schema, state: Dictionary, gate) -> bool:
	if not Bus.truthy(gate):
		return true
	if typeof(gate) != TYPE_DICTIONARY:
		return false
	# an item carried in an inventory slice (a key found in another level), at least `count` of it (since 0.23.0)
	if not _undef(_at(gate, "has")):
		var iname = gate["slice"] if Bus.truthy(gate.get("slice")) else first_slice_of_kind(schema, "inventory")
		if not Bus.truthy(iname) or not state.has(iname):
			return false
		var n = _at(state[iname]["items"], _s(gate["has"]))
		var have: float = float(n) if Bus.is_num(n) and Bus.truthy(n) else 0.0
		return have >= (float(gate["count"]) if gate.get("count") != null else 1.0)
	if not _undef(_at(gate, "flag")):
		var name = gate["slice"] if Bus.truthy(gate.get("slice")) else first_slice_of_kind(schema, "flags")
		if not Bus.truthy(name) or not state.has(name):
			return false
		var v = _at(state[name]["flags"], _s(gate["flag"]))
		return Bus.truthy(v) if _undef(_at(gate, "equals")) else Bus.strict_eq(v, gate["equals"])
	if not _undef(_at(gate, "completed")):
		var name = gate["slice"] if Bus.truthy(gate.get("slice")) else first_slice_of_kind(schema, "progression")
		if not Bus.truthy(name) or not state.has(name):
			return false
		return Bus.strict_eq(_at(state[name]["completed"], _s(gate["completed"])), "success")
	return false


# ── travel (since 0.23.0): a door's transit, and a map game's levels found, open and led to (store-kernel.js) ────────
# A door crossed: what the session gathered (an envelope whose result is 'transit') validated against the contract's
# produces like any envelope, then applied atomically; the session goes on in the next level.
func apply_transit(schema, state: Dictionary, contract, envelope) -> Dictionary:
	if typeof(envelope) != TYPE_DICTIONARY or not Bus.strict_eq(_at(envelope, "result"), "transit"):
		return {"ok": false, "errors": ["a door's envelope has result 'transit'"]}
	var c: Dictionary = (contract as Dictionary).duplicate() if typeof(contract) == TYPE_DICTIONARY else {}
	var pr: Dictionary = (c["produces"] as Dictionary).duplicate() if typeof(c.get("produces")) == TYPE_DICTIONARY else {}
	pr["results"] = ["transit"]
	c["produces"] = pr
	var v := validate_envelope(c, envelope)
	if not v["ok"]:
		return {"ok": false, "errors": v["errors"]}
	return apply_events(schema, state, envelope["events"] if typeof(envelope.get("events")) == TYPE_ARRAY else [])


# a game whose levels list `exits` is played as a map, not a list
static func is_map(levels) -> bool:
	for lv in (levels if levels is Array else []):
		if lv is Dictionary and lv.get("exits") is Array and not (lv["exits"] as Array).is_empty():
			return true
	return false


# { ref: open } — a list game reads each gate; a map opens the first level and those an open exit of a completed level
# leads to, each under its own gate
func reachable(schema, state: Dictionary, levels: Array) -> Dictionary:
	var open := {}
	if not is_map(levels):
		for lv in levels:
			open[_s(lv["ref"])] = eval_gate(schema, state, lv.get("gate"))
		return open
	var prog = first_slice_of_kind(schema, "progression")
	var done: Dictionary = state[prog]["completed"] if Bus.truthy(prog) and state.has(prog) and state[prog].get("completed") is Dictionary else {}
	var found := {}
	if not levels.is_empty():
		found[_s(levels[0]["ref"])] = true
	for lv in levels:
		if not Bus.strict_eq(_at(done, _s(lv["ref"])), "success"):
			continue
		for x in (lv.get("exits") if lv.get("exits") is Array else []):
			if eval_gate(schema, state, x.get("gate")):
				found[_s(x["to"])] = true
	for lv in levels:
		open[_s(lv["ref"])] = found.has(_s(lv["ref"])) and eval_gate(schema, state, lv.get("gate"))
	return open


# where a level's exit leads, when that exit is open: the level ref, or null
func travel(schema, state: Dictionary, levels: Array, from: String, exit: String):
	for lv in levels:
		if lv is Dictionary and _s(lv.get("ref")) == from:
			for x in (lv.get("exits") if lv.get("exits") is Array else []):
				if x is Dictionary and _s(x.get("id")) == exit:
					return x["to"] if eval_gate(schema, state, x.get("gate")) else null
			return null
	return null
