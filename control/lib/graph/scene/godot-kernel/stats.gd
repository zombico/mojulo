extends RefCounted
# mojulo-godot kernel — THE STATS: a literal port of the web's stats kernel (lib/graph/playscape/stats/kernel.js
# buildStats), held equal to it by the bus conformance corpus (scripts/conformance.mjs --engine godot --corpus bus). Levels climb on xp,
# resources are spent, purchases are guarded and atomic, epochs are reached, tech nodes rank up and open their
# subtrees, modifiers stack on stats, derived stats follow what they are made of, and a phenomenon's number is read off
# a formula. It runs inside the bus's watch fixpoint (bus.gd _watch_fix, as the page's __watchFix does): each pass
# takes the stat ops off the bus's ctrl queue, resolves the formulas on the cast ops left there, and returns the
# events its transactions raise for the bus to process.
#
#   var S = preload("res://kernel/stats.gd").new()
#   S.step(cfg, state) → [event]        cfg: bus.json `stats` (stats.js readStats); state: the bus state
#   S.apply_bodies(state, cast_state)   the bound stats that changed onto the cast's characters (hpMax, speed)
#   S.eval_f(cfg, vars, f, ctx)         one formula's number

const Bus := preload("res://kernel/bus.gd")
const Js := preload("res://kernel/js.gd")
const STAT_OPS := {"raise": 1, "grant": 1, "xp": 1, "level": 1, "buy": 1, "buff": 1, "unbuff": 1}
# where a cast op may carry a formula, and the range the read number is held to
const FIELDS := {
	"hurt": {"by": [0, 1e9]}, "heal": {"by": [0, 1e9]},
	"puff": {"scale": [0.1, 10], "shake": [0, 1]}, "status": {"for": [0.05, 1e6]},
	"shake": {"k": [0, 1], "for": [0.05, 3]}, "walk": {"speed": [0.1, 50]},
	"raise": {"by": [-1e9, 1e9]}, "grant": {"by": [-1e9, 1e9]}, "xp": {"by": [0, 1e9]}, "level": {"by": [0, 1e3]},
}


static func _clamp(v: float, lo, hi) -> float:
	if lo != null and v < float(lo):
		return float(lo)
	if hi != null and v > float(hi):
		return float(hi)
	return v


static func _nn(v) -> bool:   # JS `v != null`
	return v != null and not Js.is_undef(v)


static func _or0(v) -> float:   # JS `v || 0`, as a number
	return Js.to_number(v) if Js.truthy(v) else 0.0


static func _is_formula(v) -> bool:
	return v is Dictionary and (v.get("stat") is String or v.get("sum") is Array or v.get("mul") is Array)


static func _holder_of(cfg: Dictionary, op: Dictionary):
	return op["of"] if Js.truthy(op.get("of")) else cfg["holders"][0]


static func _epoch_ix(cfg: Dictionary, id) -> int:
	var eps: Array = cfg["epochs"]
	for i in eps.size():
		if Js.strict_eq(eps[i]["id"], id):
			return i
	return -1


static func _value(cfg: Dictionary, vars: Dictionary, h, key: String) -> float:
	if key == "epoch":
		return float(maxi(0, _epoch_ix(cfg, vars.get(str(h) + ".epoch", Js.UNDEF))))
	var v = vars.get(str(h) + "." + key)
	return float(v) if Js.is_num(v) else 0.0


# a formula's number; ctx: { self, target } (holders' ids; a target that is no holder reads 0)
func eval_f(cfg: Dictionary, vars: Dictionary, f, ctx = null) -> float:
	if Js.is_num(f):
		return float(f)
	if not (f is Dictionary or f is Array):
		return 0.0
	if f is Array:
		return 1.0   # an array is an object with no fields: the product's identity, as JS reads it
	if ctx == null:
		ctx = {}
	var v := 0.0
	if f.get("stat") is String:
		var of = f.get("of")
		var h = null
		if Js.strict_eq(of, "target"):
			h = ctx.get("target")
		elif Js.strict_eq(of, "self") or not _nn(of):
			h = ctx["self"] if Js.truthy(ctx.get("self")) else cfg["holders"][0]
		else:
			h = of
		v =(Js.to_number(f["base"]) if _nn(f.get("base")) else 0.0) + (Js.to_number(f["per"]) if _nn(f.get("per")) else 1.0) * (_value(cfg, vars, h, f["stat"]) if Js.truthy(h) else 0.0)
	else:
		v = 0.0 if Js.truthy(f.get("sum")) else 1.0
		if Js.truthy(f.get("sum")):
			for x in f["sum"]:
				v += eval_f(cfg, vars, x, ctx)
		if Js.truthy(f.get("mul")):
			for x in f["mul"]:
				v *= eval_f(cfg, vars, x, ctx)
	var c = f.get("curve")
	if c is String and c == "sqrt":
		v = -sqrt(-v) if v < 0 else sqrt(v)
	elif c is Dictionary and _nn(c.get("mitigate")):
		v = float(c["mitigate"]) / (float(c["mitigate"]) + maxf(0.0, v))
	elif c is Dictionary and _nn(c.get("soft")) and v > float(c["soft"]):
		v = float(c["soft"]) + (v - float(c["soft"])) * (float(c["slope"]) if _nn(c.get("slope")) else 0.5)
	return _clamp(v, f.get("min"), f.get("max"))


func requires(cfg: Dictionary, vars: Dictionary, h, r) -> bool:
	if not Js.truthy(r):
		return true
	if Js.truthy(r.get("all")):
		for x in r["all"]:
			if not requires(cfg, vars, h, x):
				return false
		return true
	if Js.truthy(r.get("any")):
		for x in r["any"]:
			if requires(cfg, vars, h, x):
				return true
		return false
	if _nn(r.get("level")):
		return _value(cfg, vars, h, "level") >= float(r["level"])
	if _nn(r.get("epoch")):
		return _value(cfg, vars, h, "epoch") >= _epoch_ix(cfg, r["epoch"])
	if _nn(r.get("has")):
		return _value(cfg, vars, h, str(r["has"])) >= (float(r["rank"]) if _nn(r.get("rank")) else 1.0)
	if _nn(r.get("stat")):
		return _value(cfg, vars, h, str(r["stat"])) >= (float(r["gte"]) if _nn(r.get("gte")) else 0.0)
	return false


# a node can be bought or ranked: its parent at its opening rank, its epoch reached, its requirements met
func node_open(cfg: Dictionary, vars: Dictionary, h, id: String) -> bool:
	var n: Dictionary = cfg["nodes"][id]
	if Js.truthy(n.get("parent")) and _value(cfg, vars, h, n["parent"]) < float(n["opens"]):
		return false
	if _nn(n.get("epoch")) and _value(cfg, vars, h, "epoch") < _epoch_ix(cfg, n["epoch"]):
		return false
	return requires(cfg, vars, h, n.get("requires"))


static func cost_at(cost: Dictionary, growth: float, rank: float) -> Dictionary:
	var out := {}
	for k in cost:
		out[k] = ceil(float(cost[k]) * pow(growth, rank) - 1e-9)
	return out


static func _affordable(vars: Dictionary, h, cost: Dictionary) -> bool:
	for k in cost:
		if not Js.rel(vars.get(str(h) + "." + k) if Js.truthy(vars.get(str(h) + "." + k)) else 0, cost[k], ">="):
			return false
	return true


static func _pay(vars: Dictionary, h, cost: Dictionary) -> void:
	for k in cost:
		vars[str(h) + "." + k] = _or0(vars.get(str(h) + "." + k)) - float(cost[k])


# the effective values: each stat in order (a derived one after what it reads), its modifiers stacked on its base
func _settle(cfg: Dictionary, S: Dictionary, h) -> void:
	var vars: Dictionary = S["vars"]
	var mods: Dictionary = S["_statMods"].get(h, {}) if S.get("_statMods") is Dictionary and S["_statMods"].get(h) is Dictionary else {}
	for id in cfg["order"]:
		var d: Dictionary = cfg["stats"][id]
		var base := eval_f(cfg, vars, d["from"], {"self": h}) if Js.truthy(d.get("from")) else _value(cfg, vars, h, id + ".base")
		var add := 0.0
		var pct := 0.0
		var mul := 1.0
		for k in mods:
			for m in mods[k]:
				if Js.strict_eq(m.get("stat"), id):
					add += _or0(m.get("add"))
					pct += _or0(m.get("pct"))
					mul *= Js.to_number(m["mul"]) if _nn(m.get("mul")) else 1.0
		vars[str(h) + "." + id] = _clamp((base + add) * (1.0 + pct) * mul, d.get("min"), d.get("max"))


func _raise(cfg: Dictionary, vars: Dictionary, h, stat, by: float) -> void:
	var d = cfg["stats"].get(str(stat)) if stat is String else null
	if not Js.truthy(d) or Js.truthy(d.get("from")):
		return
	vars[str(h) + "." + stat + ".base"] = _clamp(_value(cfg, vars, h, stat + ".base") + by, d.get("min"), d.get("max"))


func _grant(cfg: Dictionary, vars: Dictionary, h, res, by: float) -> void:
	var d = cfg["resources"].get(str(res)) if res is String else null
	if not Js.truthy(d):
		return
	vars[str(h) + "." + res] = _clamp(_value(cfg, vars, h, res) + by, 0, d.get("cap"))


func _give(cfg: Dictionary, S: Dictionary, h, g, out: Array) -> void:
	if not Js.truthy(g):
		return
	if Js.truthy(g.get("raise")):
		for k in g["raise"]:
			_raise(cfg, S["vars"], h, k, Js.to_number(g["raise"][k]))
	if Js.truthy(g.get("grant")):
		for k in g["grant"]:
			_grant(cfg, S["vars"], h, k, Js.to_number(g["grant"][k]))
	if Js.truthy(g.get("raise")):
		_settle(cfg, S, h)
	if Js.truthy(g.get("xp")):
		_gain_xp(cfg, S, h, Js.to_number(g["xp"]), out)


# an epoch reached by level alone (one with a cost is bought: its level is then a requirement)
func _epochs_by_level(cfg: Dictionary, vars: Dictionary, h, out: Array) -> void:
	var cur := int(_value(cfg, vars, h, "epoch"))
	var to := cur
	var eps: Array = cfg["epochs"]
	for i in range(cur + 1, eps.size()):
		var e: Dictionary = eps[i]
		if Js.truthy(e.get("cost")) or not _nn(e.get("level")):
			break   # epochs are in order: a bought one stands in the way of the next
		if _value(cfg, vars, h, "level") >= float(e["level"]) and requires(cfg, vars, h, e.get("requires")):
			to = i
		else:
			break
	if to != cur:
		vars[str(h) + ".epoch"] = eps[to]["id"]
		out.append({"type": "epoch", "of": h, "epoch": eps[to]["id"]})


func _level_up(cfg: Dictionary, S: Dictionary, h, out: Array) -> bool:
	var L = cfg.get("level")
	var vars: Dictionary = S["vars"]
	if not Js.truthy(L):
		return false
	var lv := _value(cfg, vars, h, "level")
	if _nn(L.get("max")) and lv >= float(L["max"]):
		return false
	vars[str(h) + ".level"] = lv + 1
	_settle(cfg, S, h)   # a derived stat may read the level
	_give(cfg, S, h, L.get("each"), out)
	_give(cfg, S, h, L["at"].get(Js.num_str(lv + 1)) if Js.truthy(L.get("at")) else null, out)
	out.append({"type": "level-up", "of": h, "level": lv + 1})
	if not (cfg["epochs"] as Array).is_empty():
		_epochs_by_level(cfg, vars, h, out)
	return true


func _gain_xp(cfg: Dictionary, S: Dictionary, h, by: float, out: Array) -> void:
	var L = cfg.get("level")
	var vars: Dictionary = S["vars"]
	if not Js.truthy(L):
		return
	vars[str(h) + ".xp"] = _value(cfg, vars, h, "xp") + by
	var guard := 0
	while guard < 1000:
		guard += 1
		var i := int(_value(cfg, vars, h, "level") - float(L["start"]))
		if i >= (L["xp"] as Array).size() or _value(cfg, vars, h, "xp") < float(L["xp"][i]):
			break
		if not _level_up(cfg, S, h, out):
			break


# ONE TRANSACTION: every check first; on any failure nothing changes and `denied` says why
func _buy(cfg: Dictionary, S: Dictionary, h, id, out: Array) -> void:
	var vars: Dictionary = S["vars"]
	var key: String = Js.js_string(id)
	var n = cfg["nodes"].get(key)
	var o = cfg["offers"].get(key)
	var ei := _epoch_ix(cfg, id)
	var deny := func(why: String) -> void: out.append({"type": "denied", "of": h, "id": id, "why": why})
	if n != null:
		var rank := _value(cfg, vars, h, key)
		if rank >= float(n["ranks"]):
			deny.call("max")
			return
		if not node_open(cfg, vars, h, key):
			deny.call("requires")
			return
		var cost := cost_at(n["cost"], float(n["growth"]), rank)
		if not _affordable(vars, h, cost):
			deny.call("cost")
			return
		_pay(vars, h, cost)
		vars[str(h) + "." + key] = rank + 1
		_settle(cfg, S, h)
		_give(cfg, S, h, n.get("gives"), out)
		out.append({"type": "bought", "of": h, "id": id, "rank": rank + 1})
		return
	if o != null:
		var count := _value(cfg, vars, h, key)
		if _nn(o.get("max")) and count >= float(o["max"]):
			deny.call("max")
			return
		if not requires(cfg, vars, h, o.get("requires")):
			deny.call("requires")
			return
		if not _affordable(vars, h, o["cost"]):
			deny.call("cost")
			return
		_pay(vars, h, o["cost"])
		vars[str(h) + "." + key] = count + 1
		_give(cfg, S, h, o.get("gives"), out)
		out.append({"type": "bought", "of": h, "id": id, "rank": count + 1})
		return
	if ei >= 0:
		var cur := int(_value(cfg, vars, h, "epoch"))
		var e: Dictionary = cfg["epochs"][ei]
		if ei <= cur:
			deny.call("max")
			return
		if ei > cur + 1:
			deny.call("requires")   # epochs are reached in order
			return
		if _nn(e.get("level")) and _value(cfg, vars, h, "level") < float(e["level"]):
			deny.call("requires")
			return
		if not requires(cfg, vars, h, e.get("requires")):
			deny.call("requires")
			return
		var cost: Dictionary = e["cost"] if Js.truthy(e.get("cost")) else {}
		if not _affordable(vars, h, cost):
			deny.call("cost")
			return
		_pay(vars, h, cost)
		vars[str(h) + ".epoch"] = e["id"]
		_settle(cfg, S, h)
		out.append({"type": "bought", "of": h, "id": id, "rank": 1})
		out.append({"type": "epoch", "of": h, "epoch": e["id"]})
		return
	deny.call("unknown")


# a buff's mods are read now (a formula in add / pct / mul reads the holder as it is) and replace any under its id
func _buff(cfg: Dictionary, S: Dictionary, h, op: Dictionary) -> void:
	var mods := []
	for m in (op["mods"] if Js.truthy(op.get("mods")) else []):
		if not Js.truthy(m) or not (m is Dictionary) or not Js.truthy(cfg["stats"].get(Js.js_string(m.get("stat", Js.UNDEF)))):
			continue
		var r := {"stat": m["stat"]}
		for k in ["add", "pct", "mul"]:
			if _nn(m.get(k)):
				r[k] = eval_f(cfg, S["vars"], m[k], {"self": h})
		mods.append(r)
	if not (S.get("_statMods") is Dictionary):
		S["_statMods"] = {}
	if not (S["_statMods"].get(h) is Dictionary):
		S["_statMods"][h] = {}
	S["_statMods"][h][Js.js_string(op.get("id", Js.UNDEF))] = mods


static func _unbuff(S: Dictionary, h, id) -> void:
	var mine = S["_statMods"].get(h) if S.get("_statMods") is Dictionary else null
	if not Js.truthy(mine) or not (id is String):
		return
	if id.ends_with("*"):
		var p: String = id.substr(0, id.length() - 1)
		for k in (mine as Dictionary).keys():
			if String(k).begins_with(p):
				mine.erase(k)
	else:
		mine.erase(id)


# the open flags, and `opened` on each that turns on
func _refresh_open(cfg: Dictionary, vars: Dictionary, out: Array) -> void:
	for h in cfg["holders"]:
		for id in cfg["nodes"]:
			var key: String = str(h) + "." + id + ".open"
			var now := 1 if node_open(cfg, vars, h, id) and _value(cfg, vars, h, id) < float(cfg["nodes"][id]["ranks"]) else 0
			if now == 1 and not Js.truthy(vars.get(key)):
				out.append({"type": "opened", "of": h, "id": id})
			vars[key] = now


# a bound stat that changed: a body change waiting for that holder's character (apply_bodies hands it over)
func _bodies(cfg: Dictionary, S: Dictionary) -> void:
	if not Js.truthy(cfg.get("bodies")):
		return
	if not (S.get("_statBody") is Dictionary):
		S["_statBody"] = {}
	if not (S.get("_statBodyOps") is Array):
		S["_statBodyOps"] = []
	var sent: Dictionary = S["_statBody"]
	for h in cfg["holders"]:
		var op := {"who": h}
		var any := false
		for field in cfg["bodies"]:
			var v := _value(cfg, S["vars"], h, cfg["bodies"][field])
			var key: String = str(h) + "." + field
			if not Js.strict_eq(sent.get(key, Js.UNDEF), v):
				sent[key] = v
				op[field] = v
				any = true
		if any:
			S["_statBodyOps"].append(op)


# the waiting body changes onto the cast's characters (kernel/cast.gd rows): hpMax (a rise adds the difference to
# hp; a fallen body stays down), speed (its pace). A holder with no character: nothing.
static func apply_bodies(S: Dictionary, cast_state) -> void:
	var q = S.get("_statBodyOps")
	if not (q is Array) or q.is_empty():
		return
	S["_statBodyOps"] = []
	for o in q:
		var e = cast_state["byId"].get(o["who"]) if cast_state is Dictionary else null
		if e == null:
			continue
		if Js.finite(o.get("hpMax")) and float(o["hpMax"]) > 0:
			var was = e.get("hpMax")
			e["hpMax"] = float(o["hpMax"])
			if not e.has("hp"):
				e["hp"] = float(o["hpMax"])
			elif not e["downed"]:
				e["hp"] = minf(float(o["hpMax"]), e["hp"] + (float(o["hpMax"]) - was if was != null and float(o["hpMax"]) > was else 0.0))
		if Js.finite(o.get("speed")) and float(o["speed"]) > 0:
			e["speed"] = float(o["speed"])


# a cast op's (and a stat op's) formulas, read now, held to the field's range
func _resolve_op(cfg: Dictionary, vars: Dictionary, op: Dictionary) -> void:
	var f: Dictionary = FIELDS.get(op.get("op"), {})
	var stat := STAT_OPS.has(op.get("op"))
	var ctx := {"self": _holder_of(cfg, op)} if stat else {"self": op.get("who") if op.get("op") == "beam" else cfg["holders"][0], "target": (op["to"] if op.get("to") is String else null) if op.get("op") == "beam" else op.get("who")}
	for k in op.keys():
		if k == "mods" or not _is_formula(op[k]):
			continue
		var r: Array = f.get(k, [null, null])
		op[k] = _clamp(eval_f(cfg, vars, op[k], ctx), r[0], r[1])
	if op.get("op") == "level" and _nn(op.get("by")):
		op["by"] = floor(Js.to_number(op["by"]) + 0.5)   # JS Math.round: halves up


func _apply(cfg: Dictionary, S: Dictionary, op: Dictionary, out: Array) -> void:
	var h = _holder_of(cfg, op)
	var vars: Dictionary = S["vars"]
	var by: float = Js.to_number(op["by"]) if _nn(op.get("by")) else 1.0
	match op.get("op"):
		"raise":
			_raise(cfg, vars, h, op.get("stat"), by)
			_settle(cfg, S, h)
		"grant":
			_grant(cfg, vars, h, op.get("res"), by)
			_settle(cfg, S, h)
		"xp":
			_gain_xp(cfg, S, h, by, out)
		"level":
			for i in int(by):
				if not _level_up(cfg, S, h, out):
					break
		"buy":
			_buy(cfg, S, h, op.get("id", Js.UNDEF), out)
		"buff":
			_buff(cfg, S, h, op)
			_settle(cfg, S, h)
		"unbuff":
			_unbuff(S, h, op.get("id"))
			_settle(cfg, S, h)


# one pass over the bus's queued intents: stat ops applied and taken off, formulas resolved, events returned
func step(cfg: Dictionary, S: Dictionary) -> Array:
	var ops: Array = S.get("_ctrlOps", []) if S.get("_ctrlOps") is Array else []
	var first := not Js.truthy(S.get("_statInit"))
	if ops.is_empty() and not first:
		return []
	S["_statInit"] = 1
	var keep := []
	var out := []
	var touched := first
	for op in ops:
		_resolve_op(cfg, S["vars"], op)
		if STAT_OPS.has(op.get("op")):
			_apply(cfg, S, op, out)
			touched = true
		else:
			keep.append(op)
	if touched:
		_refresh_open(cfg, S["vars"], out)
		_bodies(cfg, S)
	S["_ctrlOps"] = keep
	return out
