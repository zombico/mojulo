extends RefCounted
# mojulo-godot kernel — GROUPS (since 0.26.0): N minds as one. A port of the web's groups (lib/graph/worlds/controllable/
# group.js): a shared FOCUS (a target), an ANCHOR (its leader), SPACING, a PLAN of traversal PATTERNS, and ATTACK TOKENS.
# One pre-step a frame gives every member a SLOT; kernel/mind.gd walks a member to it instead of its own standoff and
# keeps its reflexes. Only a member holding a token presses in to strike. A herd keeps together and scatters as one on
# an alarm. Membership is authored on the member: `rule.mind.group` (an id, or { id, plan, spacing, attackers, leader,
# shareSight, travel, kind, cohesion, alarmRadius, memorySpan, tokenEvery }). Held equal to the web's by the mind corpus.
#
#   var G = preload("res://kernel/group.gd").new()
#   G.step(st, dt, mind, world)          before the bodies step (the web's `groups` pre-step)

const Mind := preload("res://kernel/mind.gd")

const PLANS := {
	"pack-hunt": ["fan-out", {"pattern": "encircle", "when": {"dist": 22}, "radius": 9, "close": 1.2}, {"pattern": "close", "when": {"t": 4}}],
	"squad": ["line", {"pattern": "pincer", "when": {"dist": 40}}],
	"herd": ["hold", {"pattern": "scatter", "when": {"dist": 30}}],
}
var groups := {}


static func stages_of(plan) -> Array:
	var src: Array = plan if plan is Array else (PLANS[plan] if plan is String and PLANS.has(plan) else PLANS["pack-hunt"])
	var out := []
	for s in src:
		out.append({"pattern": s} if s is String else s)
	return out


static func _hyp(a: float, b: float) -> float:
	return sqrt(a * a + b * b)


static func _nf(d: Dictionary, k: String, x: float) -> float:
	return float(d[k]) if d.get(k) != null else x


# ── PATTERNS (pure: members → slots, around the anchor A and the focus F; u the unit A→F, v its left normal) ─────────
static func pattern(name: String, c: Dictionary) -> Array:
	var out := []
	var n: int = c["n"]
	var sp: float = c["spacing"]
	var A: Array = c["A"]
	var F: Array = c["F"]
	var u: Array = c["u"]
	var v: Array = c["v"]
	var p: Dictionary = c["p"]
	var members: Array = c["members"]
	match name:
		"column":
			for i in n:
				out.append([A[0] - u[0] * i * sp, A[1] - u[1] * i * sp])
		"line":
			for i in n:
				var k := float(i) - float(n - 1) / 2.0
				out.append([A[0] + v[0] * k * sp, A[1] + v[1] * k * sp])
		"wedge":
			for i in n:
				var k := ceilf(float(i) / 2.0)
				var side := 1.0 if i % 2 == 1 else -1.0
				out.append([A[0] - u[0] * k * sp + v[0] * side * k * sp, A[1] - u[1] * k * sp + v[1] * side * k * sp])
		"fan-out":
			var R := _nf(p, "radius", maxf(8.0, float(c["dist"]) - sp))
			var arc := maxf(_nf(p, "arc", 1.6), (sp * (n - 1)) / maxf(R, 1.0))
			for i in n:
				var a: float = c["base"] + ((float(i) / (n - 1) - 0.5) * arc if n > 1 else 0.0)
				out.append([F[0] + cos(a) * R, F[1] + sin(a) * R])
		"encircle":
			var R0 := _nf(p, "radius", maxf(6.0, (sp * n) / TAU))
			var R := maxf(_nf(p, "min", 2.5), R0 - (float(p["close"]) if Mind.truthy(p.get("close")) else 0.0) * float(c["stageT"]))
			for i in n:
				var a: float = c["base"] + (float(i) * TAU) / n
				out.append([F[0] + cos(a) * R, F[1] + sin(a) * R])
		"close":
			var c2 := c.duplicate()
			c2["p"] = {"radius": _nf(p, "radius", 2.5), "min": _nf(p, "min", 2.0)}
			return pattern("encircle", c2)
		"pincer":
			var R := _nf(p, "radius", maxf(8.0, float(c["dist"]) * 0.6))
			var ang := _nf(p, "angle", 1.2)
			var half := int(ceilf(n / 2.0))
			for i in n:
				var left := i < half
				var k := i if left else i - half
				var cnt := half if left else n - half
				var a: float = c["base"] + (ang if left else -ang) + ((float(k) / (cnt - 1) - 0.5) * ((sp * (cnt - 1)) / maxf(R, 1.0)) if cnt > 1 else 0.0)
				out.append([F[0] + cos(a) * R, F[1] + sin(a) * R])
		"scatter":
			for m in members:
				var q: Array = m["pos"]
				var a: float = atan2(q[1] - F[1], q[0] - F[0]) + (Mind.hash01(String(m["id"]), 7) - 0.5) * 1.4
				var d := _nf(p, "dist", 30.0)
				out.append([q[0] + cos(a) * d, q[1] + sin(a) * d])
		_:
			for m in members:
				out.append([m["pos"][0], m["pos"][1]])
	return out


# stable slot assignment: keep a member's slot while the count holds; else greedy by id onto the nearest free slot
static func _assign(g: Dictionary, members: Array, slots: Array) -> void:
	var stale: bool = int(g["assignN"]) != members.size()
	if not stale:
		for m in members:
			if g["assign"].get(m["id"]) == null:
				stale = true
				break
	if stale:
		g["assign"] = {}
		var used := {}
		for m in members:
			var best := -1
			var bd := INF
			for k in slots.size():
				if used.has(k):
					continue
				var d := _hyp(slots[k][0] - m["pos"][0], slots[k][1] - m["pos"][1])
				if d < bd:
					bd = d
					best = k
			used[best] = true
			g["assign"][m["id"]] = best
		g["assignN"] = members.size()
	for m in members:
		var k: int = g["assign"][m["id"]]
		m["groupSlot"] = slots[k] if k >= 0 and k < slots.size() else null


static func _rule_mind(m: Dictionary) -> Dictionary:
	return m["rule"]["mind"] if m.get("rule") is Dictionary and m["rule"].get("mind") is Dictionary else {}


func _step_herd(st: Dictionary, g: Dictionary, cfg: Dictionary, members: Array, leader: Dictionary, spacing: float, mind, world: Dictionary) -> void:
	var threat = st["byId"].get(g["alarm"]) if g.get("alarm") != null else null
	if threat != null:
		var all_far := Mind.truthy(threat.get("downed"))
		if not all_far:
			all_far = true
			for m in members:
				var ar := _nf(cfg, "alarmRadius", _nf(m["rule"], "fearRadius", 18.0) * 1.5)
				if not (_hyp(threat["pos"][0] - m["pos"][0], threat["pos"][1] - m["pos"][1]) > ar):
					all_far = false
					break
		if all_far:
			threat = null
	if threat == null:
		for m in members:
			var t = mind.threat_of(m, world)
			if t != null and _hyp(t["pos"][0] - m["pos"][0], t["pos"][1] - m["pos"][1]) < _nf(m["rule"], "fearRadius", 18.0):
				threat = t
				break
	g["alarm"] = threat["id"] if threat != null else null
	var cohesion := _nf(cfg, "cohesion", spacing * 3.0)
	for m in members:
		m["groupId"] = g["id"]
		m["groupToken"] = false
		m["groupFocus"] = null
		m["groupSpacing"] = spacing
		if threat != null:
			m["groupAlarm"] = threat["id"]
			m["groupPattern"] = "scatter"
			m["groupSlot"] = pattern("scatter", {"n": 1, "spacing": spacing, "A": [0.0, 0.0], "F": [threat["pos"][0], threat["pos"][1]], "u": [0.0, 0.0], "v": [0.0, 0.0], "p": {"dist": 30}, "members": [m]})[0]
		else:
			m["groupAlarm"] = null
			m["groupPattern"] = "cohere"
			var d := 0.0 if is_same(m, leader) else _hyp(leader["pos"][0] - m["pos"][0], leader["pos"][1] - m["pos"][1])
			m["groupSlot"] = [leader["pos"][0], leader["pos"][1]] if d > cohesion else null


# the web's stepGroups: `world` is the frame's mind world (its pickTarget and threatOf read byId and the pilot)
func step(st: Dictionary, dt: float, mind, world: Dictionary) -> void:
	var any := false
	for e in st["entities"]:
		if Mind.truthy(_rule_mind(e).get("group")):
			any = true
			break
	if not any:
		return
	var by_group := {}
	for e in st["entities"]:
		var gm = _rule_mind(e).get("group")
		if not Mind.truthy(gm) or Mind.truthy(e.get("downed")):
			continue
		var id := String(gm) if gm is String else String(gm["id"])
		if not by_group.has(id):
			by_group[id] = []
		by_group[id].append(e)
	var ids := by_group.keys()
	ids.sort()
	for id in ids:
		var members: Array = by_group[id]
		members.sort_custom(func(a, b): return String(a["id"]) < String(b["id"]))
		var cfg: Dictionary = {}
		for m in members:
			if _rule_mind(m).get("group") is Dictionary:
				cfg = _rule_mind(m)["group"]
				break
		if not groups.has(id):
			groups[id] = {"id": id, "stage": 0, "stageT": 0.0, "tokenT": 0.0, "assign": {}, "assignN": 0, "seen": null, "alarm": null, "engaged": false, "base": null, "tokens": null}
		var g: Dictionary = groups[id]
		var leader: Dictionary = members[0]
		if Mind.truthy(cfg.get("leader")):
			for m in members:
				if m["id"] == cfg["leader"]:
					leader = m
					break
		var spacing := _nf(cfg, "spacing", 3.0)
		if cfg.get("kind") == "herd":
			_step_herd(st, g, cfg, members, leader, spacing, mind, world)
			continue
		# the focus: the target of the first member willing to fight (the leader first)
		var focus = null
		for m in [leader] + members:
			var tm = _rule_mind(m).get("aggressiveness")
			if tm == "passive" or (tm == "defensive" and not (Mind.fin(m.get("hpMax")) and float(m["hpMax"]) > 0.0 and Mind.fin(m.get("hp")) and float(m["hp"]) < float(m["hpMax"]))):
				continue
			focus = mind.pick_target(m, world, m["rule"].get("target"))
			if focus != null and not is_same(focus, m):
				break
			focus = null
		# shared sight: the freshest sighting of the focus by any member is the group's
		if focus != null and cfg.get("shareSight") != false:
			var best = null
			for m in members:
				var ls = m.get("lastSeen")
				if ls is Dictionary and ls["id"] == focus["id"] and (best == null or float(ls["t"]) > float(best["t"])):
					best = ls
			g["seen"] = best
		else:
			g["seen"] = null
		var A := [0.0, 0.0]
		if focus != null:
			for m in members:
				A[0] += m["pos"][0] / members.size()
				A[1] += m["pos"][1] / members.size()
		else:
			A = [leader["pos"][0], leader["pos"][1]]
		var known := false
		if focus != null:
			if g["seen"] == null:
				known = true
				for m in members:
					if Mind.truthy(_rule_mind(m).get("perception")):
						known = false
						break
			else:
				known = float(world["time"]) - float(g["seen"]["t"]) < _nf(cfg, "memorySpan", 8.0)
		var F: Array
		var stages: Array
		if focus != null and known:
			F = [focus["pos"][0], focus["pos"][1]]
			stages = stages_of(cfg.get("plan"))
		else:
			var hd := float(leader["heading"])
			F = [A[0] + cos(hd) * 10.0, A[1] + sin(hd) * 10.0]
			stages = [{"pattern": cfg["travel"] if Mind.truthy(cfg.get("travel")) else "column"}]
			if Mind.truthy(g.get("engaged")):
				g["stage"] = 0
				g["stageT"] = 0.0
				g["base"] = null
		if not Mind.truthy(g.get("engaged")) and focus != null and known:
			g["base"] = null
		g["engaged"] = focus != null and known
		var dist := _hyp(F[0] - A[0], F[1] - A[1])
		if dist == 0.0:
			dist = 1e-6
		var u := [(F[0] - A[0]) / dist, (F[1] - A[1]) / dist]
		var v := [-u[1], u[0]]
		if int(g["stage"]) >= stages.size():
			g["stage"] = stages.size() - 1
		g["stageT"] = float(g["stageT"]) + dt
		var nxt = stages[int(g["stage"]) + 1] if int(g["stage"]) + 1 < stages.size() else null
		if nxt is Dictionary and nxt.get("when") is Dictionary:
			var w: Dictionary = nxt["when"]
			var go := true
			if w.get("dist") != null and not (dist <= float(w["dist"])):
				go = false
			if w.get("t") != null and not (float(g["stageT"]) >= float(w["t"])):
				go = false
			if w.get("arrived") != null:
				var ok := 0
				for m in members:
					if m.get("groupSlot") is Array and _hyp(m["groupSlot"][0] - m["pos"][0], m["groupSlot"][1] - m["pos"][1]) < 2.0:
						ok += 1
				if float(ok) / members.size() < float(w["arrived"]):
					go = false
			if go:
				g["stage"] = int(g["stage"]) + 1
				g["stageT"] = 0.0
				g["base"] = null
		var stg: Dictionary = stages[int(g["stage"])]
		var pat := String(stg["pattern"])
		var travel := pat == "column" or pat == "line" or pat == "wedge"
		var anchor: Array = [leader["pos"][0], leader["pos"][1]] if travel else A
		if g["base"] == null:
			g["base"] = atan2(A[1] - F[1], A[0] - F[0])
		var ctx := {"A": anchor, "F": F, "u": u, "v": v, "n": members.size(), "spacing": spacing, "stageT": g["stageT"], "members": members, "p": stg, "dist": dist, "base": g["base"]}
		_assign(g, members, pattern(pat, ctx))
		if travel:
			leader["groupSlot"] = null
		# attack tokens: the K members nearest the focus, re-dealt every tokenEvery s
		var K := int(_nf(cfg, "attackers", members.size()))
		g["tokenT"] = float(g["tokenT"]) - dt
		if float(g["tokenT"]) <= 0.0 or g["tokens"] == null:
			var order := members.duplicate()
			order.sort_custom(func(a, b):
				var da := _hyp(a["pos"][0] - F[0], a["pos"][1] - F[1])
				var db := _hyp(b["pos"][0] - F[0], b["pos"][1] - F[1])
				if da != db:
					return da < db
				return String(a["id"]) < String(b["id"]))
			var toks := []
			for i in mini(K, order.size()):
				toks.append(order[i]["id"])
			g["tokens"] = toks
			g["tokenT"] = _nf(cfg, "tokenEvery", 2.0)
		for m in members:
			m["groupId"] = id
			m["groupToken"] = Mind.truthy(g["engaged"]) and (g["tokens"] as Array).has(m["id"])
			m["groupFocus"] = focus["id"] if Mind.truthy(g["engaged"]) else null
			m["groupPattern"] = pat
			m["groupSpacing"] = spacing
			var gs = g["seen"]
			if gs is Dictionary and Mind.truthy(_rule_mind(m).get("perception")) and (not (m.get("lastSeen") is Dictionary) or float(m["lastSeen"]["t"]) < float(gs["t"])):
				m["lastSeen"] = {"pos": (gs["pos"] as Array).duplicate(), "t": gs["t"], "id": gs["id"]}
