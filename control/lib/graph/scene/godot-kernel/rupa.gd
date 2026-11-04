extends RefCounted
# mojulo-godot kernel — destructible physics (rupa: a level's `destruction: 'physical'`), its ENERGY slice, ported from
# the web's controllable engine (worlds/controllable/rupa.js: the blows, a block's joules, breaking, the landing and the
# load pass; rules-basic.js: what loses its hold falls) and held equal to it frame by frame by the rupa conformance
# corpus (lib/graph/scene/rupa-conformance.js). Everything is in the RECIPE's frame: z up, metres. A block is a box
# { min, max } with its matter's numbers as the mint gave them (rupa/matter.js blockMatter: joules, mass, compressive,
# cohesion, stiff, bounce, fill); nothing here touches a node: a level's blocks are posed from the state it keeps.
#
#   world(blocks, settings, floor) → state      settings: the level's `matter` ({ power?, swing?, shot?, blastZ? })
#   step(state, blows, dt)                       blows this frame: [{ burst: { pos, radius } } | { shot: { from, to } }
#                                                | { break: id }], in the order the web puts them
#   snapshot(state) → String                     the corpus's canonical frame: each block's state, foot and joules
#
# The slice is the matter that breaks before it flows (brick, concrete, stone, glass). What the web does that this port
# does not yet (docs/rupa.md names the slices): a plastic block's dents and cuts, felling, heat and fire, wind, trees,
# bodies and fluids, the ground and its water, scars, the debris and dust a break throws (the page's, not the state's).

const Js := preload("res://kernel/js.gd")

const TNT := 4.184e6
const G := 9.81
const EPS := 0.05
const TOUCH := 0.02
const GRID_MOST := 4096
const FLOOR := {"stiff": 30e9, "bounce": 0.2, "fixed": true}


# ── a world: its blocks, their colliders (each block's own box, shared), the floor and the settings ─────────────────
static func world(blocks: Array, settings: Dictionary, floor_z: float) -> Dictionary:
	var state := {"blocks": [], "colliders": [], "floor": floor_z, "fall_g": 18.0, "time": 0.0, "settle_dirty": true, "break_seq": 0}
	for i in blocks.size():
		var s: Dictionary = blocks[i]
		var mn := [float(s["min"][0]), float(s["min"][1]), float(s["min"][2])]
		var mx := [float(s["max"][0]), float(s["max"][1]), float(s["max"][2])]
		var c := {"min": mn, "max": mx, "of": s["id"], "blk": i}
		state["colliders"].append(c)
		var b := {"id": s["id"], "min": mn, "max": mx, "bond": str(s["bond"]) if s.get("bond") != null else "", "broken": null, "falling": null, "landed": null, "collider": c, "fell": null}
		if s.has("joules") and float(s["joules"]) > 0.0:
			var j := float(s["joules"])
			b["rupa"] = {"cap": j, "joules": j, "mass": float(s.get("mass", 0.0)), "compressive": float(s.get("compressive", 0.0)), "cohesion": float(s.get("cohesion", 0.0)),
				"stiff": float(s.get("stiff", 1e10)), "bounce": float(s.get("bounce", 0.2)), "fill": float(s.get("fill", 1.0))}
		else:
			b["rupa"] = null
		state["blocks"].append(b)
	state["rupa"] = {"power": float(settings.get("power", 1.0)), "swing": float(settings.get("swing", 300.0)), "shot": float(settings.get("shot", 2000.0)),
		"blast_z": float(settings.get("blastZ", 4.0)), "g": float(settings.get("g", G)), "seq": -1}
	return state


# ── the physics (rupa.js's pure half) ───────────────────────────────────────────────────────────────────────────────
static func ovl(a: Dictionary, b: Dictionary, k: int) -> float:
	return minf(a["max"][k], b["max"][k]) - maxf(a["min"][k], b["min"][k])

static func rests_on(a: Dictionary, s: Dictionary, touch: float) -> bool:
	return absf(a["min"][2] - s["max"][2]) <= touch and ovl(a, s, 0) > 1e-3 and ovl(a, s, 1) > 1e-3

# the side two boxes share: { k, at, b, t } (the axis across it, where, its width along the other, its height) or null
static func side_face(a: Dictionary, s: Dictionary, touch: float):
	if ovl(a, s, 2) <= 1e-3:
		return null
	for k in [0, 1]:
		if ovl(a, s, 1 - k) <= 1e-3:
			continue
		if absf(a["max"][k] - s["min"][k]) <= touch:
			return {"k": k, "at": a["max"][k], "b": ovl(a, s, 1 - k), "t": ovl(a, s, 2)}
		if absf(s["max"][k] - a["min"][k]) <= touch:
			return {"k": k, "at": a["min"][k], "b": ovl(a, s, 1 - k), "t": ovl(a, s, 2)}
	return null

static func centre(b: Dictionary) -> Array:
	return [(b["min"][0] + b["max"][0]) / 2.0, (b["min"][1] + b["max"][1]) / 2.0, (b["min"][2] + b["max"][2]) / 2.0]

static func box_dist(b: Dictionary, p: Array) -> float:
	var d := []
	for k in 3:
		d.append(maxf(maxf(b["min"][k] - float(p[k]), 0.0), float(p[k]) - b["max"][k]))
	return Js.hypot3(d[0], d[1], d[2])

static func blast_joules(radius: float, blast_z: float) -> float:
	return pow(maxf(0.0, radius) / blast_z, 3.0) * TNT

# the area a box shows toward a point: each face's area weighted by how squarely it faces the point
static func face_area(b: Dictionary, from: Array) -> float:
	var c := centre(b)
	var d := [c[0] - float(from[0]), c[1] - float(from[1]), c[2] - float(from[2])]
	var n := Js.hypot3(d[0], d[1], d[2])
	if n == 0.0:
		n = 1.0
	var sx: float = b["max"][0] - b["min"][0]
	var sy: float = b["max"][1] - b["min"][1]
	var sz: float = b["max"][2] - b["min"][2]
	return (absf(d[0]) * sy * sz + absf(d[1]) * sx * sz + absf(d[2]) * sx * sy) / n

# the share of a burst's energy a block takes: the solid angle its face fills of a ground burst's hemisphere
static func burst_share(b: Dictionary, at: Array, joules: float, r0: float = 0.5) -> float:
	return joules * minf(1.0, face_area(b, at) / (2.0 * PI * pow(box_dist(b, at) + r0, 2.0)))

static func blow_joules(how: String, R: Dictionary, radius: float = 0.0) -> float:
	var p: float = R["power"]
	if how == "swing":
		return R["swing"] * p
	if how == "shot":
		return R["shot"] * p
	if how == "burst":
		return blast_joules(radius, R["blast_z"]) * p
	return 0.0

# matter meets matter: the dissipated closing energy, split inversely to stiffness; a target that breaks takes only the
# joules it had left, and the mover pays only what that cost
static func impact(a: Dictionary, b: Dictionary, vn: float) -> Dictionary:
	var e := minf(float(a.get("bounce", 0.2)), float(b.get("bounce", 0.2)))
	var mu: float = a["mass"] if (b.get("fixed", false) or not (float(b.get("mass", 0.0)) > 0.0)) else (a["mass"] * b["mass"]) / (a["mass"] + b["mass"])
	var dE := 0.5 * mu * vn * vn * (1.0 - e * e)
	var sa_s: float = a.get("stiff", 1e10) if float(a.get("stiff", 0.0)) != 0.0 else 1e10
	var sb_s: float = b.get("stiff", 1e10) if float(b.get("stiff", 0.0)) != 0.0 else 1e10
	var ca := 1.0 / sa_s
	var cb := 1.0 / sb_s
	var sa := ca / (ca + cb)
	var sb := 1.0 - sa
	var cap_b: float = b["joules"] if b.has("joules") else INF
	if dE * sb >= cap_b:
		var used := cap_b / sb
		return {"to_a": used * sa, "to_b": cap_b, "breaks_b": true}
	return {"to_a": dE * sa, "to_b": dE * sb, "breaks_b": false}

static func target_of(b: Dictionary) -> Dictionary:
	var r: Dictionary = b["rupa"]
	return {"stiff": r["stiff"], "bounce": r["bounce"], "joules": maxf(0.0, r["joules"]), "fixed": true}


# ── the grid over boxes' footprints: a box's neighbours, in the list's own order (rupa.js gridOf) ──────────────────────
static func _span(b: Dictionary, cell: float, pad: float) -> Array:
	return [int(floor((b["min"][0] - pad) / cell)), int(floor((b["max"][0] + pad) / cell)), int(floor((b["min"][1] - pad) / cell)), int(floor((b["max"][1] + pad) / cell))]

static func grid_of(list: Array, cell: float = 2.0, pad: float = 0.05) -> Dictionary:
	var cells := {}
	var wide := []
	for n in list.size():
		var sp := _span(list[n], cell, pad)
		if (sp[1] - sp[0] + 1) * (sp[3] - sp[2] + 1) > GRID_MOST:
			wide.append(n)
			continue
		for i in range(sp[0], sp[1] + 1):
			for j in range(sp[2], sp[3] + 1):
				var key := "%d,%d" % [i, j]
				if not cells.has(key):
					cells[key] = []
				cells[key].append(n)
	return {"list": list, "cells": cells, "wide": wide, "cell": cell, "pad": pad}

static func near(grid: Dictionary, b: Dictionary) -> Array:
	var list: Array = grid["list"]
	var sp := _span(b, grid["cell"], grid["pad"])
	if (sp[1] - sp[0] + 1) * (sp[3] - sp[2] + 1) > GRID_MOST:
		return list.duplicate()
	var seen := {}
	for n in grid["wide"]:
		seen[n] = true
	for i in range(sp[0], sp[1] + 1):
		for j in range(sp[2], sp[3] + 1):
			var key := "%d,%d" % [i, j]
			if grid["cells"].has(key):
				for n in grid["cells"][key]:
					seen[n] = true
	var idx := seen.keys()
	idx.sort()
	var out := []
	for n in idx:
		out.append(list[n])
	return out

static func _index_of(list: Array, x) -> int:
	for i in list.size():
		if is_same(list[i], x):
			return i
	return -1

static func _has(list: Array, x) -> bool:
	return _index_of(list, x) >= 0


# LOAD over plain boxes { min, max, mass, compressive, bond, lateral, left, ref }: the weight down the stack to the
# supports by contact area, a hung group's to the blocks it bonds to; crushing, and a hung run in bending at its roots
static func load_pass(blocks: Array, fixed: Array, floor_z: float, g: float, touch: float) -> Dictionary:
	var near_b := grid_of(blocks, 2.0, touch + 0.01)
	var near_f := grid_of(fixed, 2.0, touch + 0.01)
	var below := []
	for b in blocks:
		var sup := []
		for s in near(near_b, b):
			if not is_same(s, b) and rests_on(b, s, touch):
				sup.append(s)
		var fx := []
		for s in near(near_f, b):
			if rests_on(b, s, touch):
				fx.append(s)
		below.append({"blocks": sup, "fixed": fx, "ground": b["min"][2] <= floor_z + touch})
	var rests := func(i: int) -> bool:
		var u: Dictionary = below[i]
		return u["ground"] or u["fixed"].size() > 0 or u["blocks"].size() > 0
	# the hung groups: blocks resting on nothing, joined sideways; their roots the resting blocks they bond to
	var hung := []
	for i in blocks.size():
		if not rests.call(i) and blocks[i].get("lateral", false):
			hung.append(blocks[i])
	var seen := []
	var groups := []
	for h in hung:
		if _has(seen, h):
			continue
		var g0 := [h]
		var q := [h]
		seen.append(h)
		while q.size() > 0:
			var a = q.pop_back()
			for s in near(near_b, a):
				if not _has(seen, s) and _has(hung, s) and side_face(a, s, touch) != null:
					seen.append(s)
					g0.append(s)
					q.append(s)
		var roots := []
		for a in g0:
			for s in near(near_b, a):
				if _has(g0, s) or not rests.call(_index_of(blocks, s)):
					continue
				var f = side_face(a, s, touch)
				if f != null:
					roots.append({"block": a, "root": s, "k": f["k"], "at": f["at"], "b": f["b"], "t": f["t"], "bond": minf(a["bond"], s.get("bond", a["bond"]))})
		groups.append({"blocks": g0, "roots": roots, "weight": 0.0})
	var group_of := {}
	for gi in groups.size():
		for b in groups[gi]["blocks"]:
			group_of[_index_of(blocks, b)] = gi
	var carried := []
	carried.resize(blocks.size())
	carried.fill(0.0)
	var weight := []
	weight.resize(blocks.size())
	weight.fill(0.0)
	var stress := []
	stress.resize(blocks.size())
	stress.fill(0.0)
	# down the stack, highest first (a grouped block before an ungrouped one at the same height; else as listed)
	var order := []
	for i in blocks.size():
		order.append(i)
	order.sort_custom(func(x: int, y: int) -> bool:
		var dz: float = blocks[y]["min"][2] - blocks[x]["min"][2]
		if dz != 0.0:
			return dz < 0.0
		var gx := 1 if group_of.has(x) else 0
		var gy := 1 if group_of.has(y) else 0
		if gx != gy:
			return gx > gy
		return x < y)
	var root_set := {}
	for gr in groups:
		for r in gr["roots"]:
			root_set[_index_of(blocks, r["root"])] = true
	var pending := []
	var pass_one := func(i: int) -> void:
		var b: Dictionary = blocks[i]
		var w: float = b["mass"] * g + carried[i]
		weight[i] = w
		if group_of.has(i):
			groups[group_of[i]]["weight"] += w
			return
		var u: Dictionary = below[i]
		var areas := []
		var total := 0.0
		for s in u["blocks"]:
			var a := ovl(b, s, 0) * ovl(b, s, 1)
			areas.append(a)
			total += a
		for s in u["fixed"]:
			total += ovl(b, s, 0) * ovl(b, s, 1)
		if u["ground"]:
			total += (b["max"][0] - b["min"][0]) * (b["max"][1] - b["min"][1])
		stress[i] = w / total if total > 0.0 else 0.0
		if total > 0.0:
			for k in u["blocks"].size():
				var si := _index_of(blocks, u["blocks"][k])
				carried[si] += (w * areas[k]) / total
	for i in order:
		if root_set.has(i):
			pending.append(i)
		else:
			pass_one.call(i)
	for gr in groups:
		if gr["roots"].size() == 0:
			continue
		var share: float = gr["weight"] / gr["roots"].size()
		for r in gr["roots"]:
			var ri := _index_of(blocks, r["root"])
			carried[ri] += share
	for i in pending:
		pass_one.call(i)
	# crushing: the stress on what it rests on against its compressive strength, less as it is damaged
	var crush := []
	for i in blocks.size():
		var b: Dictionary = blocks[i]
		if not group_of.has(i) and b["compressive"] > 0.0 and stress[i] > b["compressive"] * float(b.get("left", 1.0)):
			crush.append(b)
	# spans: a hung group in bending at its roots
	var span := []
	for gr in groups:
		if gr["roots"].size() == 0:
			span.append(gr["blocks"])
			continue
		var mx := 0.0
		var my := 0.0
		var W := 0.0
		for b in gr["blocks"]:
			var w: float = weight[_index_of(blocks, b)]
			var c := centre(b)
			W += w
			mx += w * c[0]
			my += w * c[1]
		var den := W if W != 0.0 else 1.0
		var cg := [mx / den, my / den]
		var lever := INF
		var S := 0.0
		var bond := INF
		var both := false
		for r in gr["roots"]:
			lever = minf(lever, absf(cg[r["k"]] - r["at"]))
			S += (r["b"] * r["t"] * r["t"]) / 6.0
			bond = minf(bond, r["bond"] * minf(float(r["block"].get("left", 1.0)), float(r["root"].get("left", 1.0))))
			for o in gr["roots"]:
				if o["k"] == r["k"] and signf(cg[r["k"]] - o["at"]) != signf(cg[r["k"]] - r["at"]):
					both = true
		var M := W * lever / (4.0 if both else 1.0)
		if M > bond * S:
			span.append(gr["blocks"])
	return {"crush": crush, "span": span}


# ── the runtime: a blow spent, a break, what loses its hold, the landing and the load ───────────────────────────────
static func break_it(state: Dictionary, b: Dictionary, how: String) -> void:
	if b["broken"] != null:
		return
	b["rupa"]["joules"] = 0.0
	b["broken"] = {"t": state["time"], "how": how}
	var k := _index_of(state["colliders"], b["collider"])
	if k >= 0:
		state["colliders"].remove_at(k)
	state["break_seq"] += 1
	state["settle_dirty"] = true

static func spend(state: Dictionary, b: Dictionary, joules: float, how: String) -> void:
	if b["broken"] != null or b["rupa"] == null or not (joules > 0.0):
		return
	b["rupa"]["joules"] -= joules
	if b["rupa"]["joules"] <= 0.0:
		break_it(state, b, how)

# a block broken by a call (a trigger, a script): under the physics it breaks outright
static func break_block(state: Dictionary, id) -> void:
	for b in state["blocks"]:
		if b["id"] == id:
			if b["rupa"] != null and b["broken"] == null:
				break_it(state, b, "call")
			return

static func _live(state: Dictionary) -> Array:
	var out := []
	for b in state["blocks"]:
		if b["broken"] == null:
			out.append(b)
	return out

static func _side_by(a: Dictionary, s: Dictionary) -> bool:
	if ovl(a, s, 2) <= 1e-3:
		return false
	for k in [0, 1]:
		if ovl(a, s, 1 - k) > 1e-3 and (absf(a["max"][k] - s["min"][k]) <= TOUCH or absf(s["max"][k] - a["min"][k]) <= TOUCH):
			return true
	return false

# which blocks are held, from the floor and the fixed colliders up; the rest start to fall (rules-basic.js settle)
static func settle(state: Dictionary) -> void:
	state["settle_dirty"] = false
	var live := _live(state)
	var fixed := []
	for c in state["colliders"]:
		if c["blk"] == null:
			fixed.append(c)
	var held := []
	for b in live:
		if b["falling"] != null:
			continue
		var ok: bool = b["min"][2] <= state["floor"] + TOUCH
		if not ok:
			for c in fixed:
				if rests_on(b, c, TOUCH):
					ok = true
					break
		if ok:
			held.append(b)
	var queue := held.duplicate()
	while queue.size() > 0:
		var s = queue.pop_back()
		for b in live:
			if _has(held, b) or b["falling"] != null:
				continue
			if rests_on(b, s, TOUCH) or (b["bond"] == "lateral" and _side_by(b, s)):
				held.append(b)
				queue.append(b)
	for b in live:
		if not _has(held, b) and b["falling"] == null:
			b["falling"] = {"vz": 0.0, "from": b["min"][2], "t": state["time"]}
			b["landed"] = null

static func fall(state: Dictionary, dt: float) -> void:
	var falling := []
	for b in state["blocks"]:
		if b["broken"] == null and b["falling"] != null:
			falling.append(b)
	# lowest first, the list's order between equals (the web's sort is stable)
	var idx := []
	for i in falling.size():
		idx.append(i)
	idx.sort_custom(func(x: int, y: int) -> bool:
		var d: float = falling[x]["min"][2] - falling[y]["min"][2]
		return d < 0.0 if d != 0.0 else x < y)
	for i in idx:
		var b: Dictionary = falling[i]
		if b["broken"] != null or b["falling"] == null:
			continue
		b["falling"]["vz"] -= state["fall_g"] * dt
		var dz: float = b["falling"]["vz"] * dt
		var land: float = state["floor"]
		var on = null
		for c in state["colliders"]:
			if is_same(c, b["collider"]) or (c["blk"] != null and state["blocks"][c["blk"]]["falling"] != null):
				continue
			if ovl(b, c, 0) > 1e-3 and ovl(b, c, 1) > 1e-3 and c["max"][2] <= b["min"][2] + TOUCH and c["max"][2] > land:
				land = c["max"][2]
				on = c
		if b["min"][2] + dz > land:
			b["min"][2] += dz
			b["max"][2] += dz
			continue
		var h: float = b["max"][2] - b["min"][2]
		b["min"][2] = land
		b["max"][2] = Js.js_round((land + h) * 1e6) / 1e6
		var speed: float = -b["falling"]["vz"]
		b["landed"] = {"t": state["time"], "speed": speed, "drop": b["falling"]["from"] - b["min"][2], "on": on["of"] if on != null else null}
		b["falling"] = null
		state["settle_dirty"] = true

static func step(state: Dictionary, blows: Array, dt: float) -> void:
	var R: Dictionary = state["rupa"]
	var bursts := []
	var shots := []
	for x in blows:
		if x.has("burst"):
			bursts.append(x["burst"])
		if x.has("shot"):
			shots.append(x["shot"])
		if x.has("break"):
			break_block(state, x["break"])
	# the blows (rupa.js rupa-blows): a round on the first block at its end, a burst on every block in its reach
	var live := []
	for b in state["blocks"]:
		if b["broken"] == null and b["rupa"] != null:
			live.append(b)
	if live.size() > 0:
		for s in shots:
			for b in live:
				if b["broken"] == null and box_dist(b, s["to"]) <= EPS:
					spend(state, b, blow_joules("shot", R), "shot")
					break
		for u in bursts:
			var J := blow_joules("burst", R, float(u["radius"]))
			for b in live:
				if box_dist(b, u["pos"]) <= float(u["radius"]) + EPS:
					spend(state, b, burst_share(b, u["pos"], J), "burst")
	# gravity (rules-basic.js break pass): what lost its hold falls; what lands is noted
	if _live(state).size() > 0:
		if state["settle_dirty"]:
			settle(state)
		fall(state, dt)
		if state["settle_dirty"]:
			settle(state)
	# the landing and the load (rupa.js rupa-load)
	var changed: bool = R["seq"] != state["break_seq"]
	for b in state["blocks"]:
		if b["broken"] != null or b["rupa"] == null or b["landed"] == null or b["landed"]["t"] != state["time"] or b["landed"]["speed"] <= 0.0:
			continue
		changed = true
		var under = null
		if b["landed"]["on"] != null:
			for q in state["blocks"]:
				if q["id"] == b["landed"]["on"] and q["broken"] == null:
					under = q
					break
		var r := impact({"mass": b["rupa"]["mass"], "stiff": b["rupa"]["stiff"], "bounce": b["rupa"]["bounce"]}, target_of(under) if (under != null and under["rupa"] != null) else FLOOR, b["landed"]["speed"])
		spend(state, b, r["to_a"], "fall")
		if under != null and under["rupa"] != null:
			spend(state, under, r["to_b"], "crush")
	if changed:
		var boxes := []
		for b in state["blocks"]:
			if b["broken"] != null or b["falling"] != null or b["rupa"] == null or b["fell"] != null:
				continue
			var rr: Dictionary = b["rupa"]
			boxes.append({"min": b["min"], "max": b["max"], "mass": maxf(0.0, rr["mass"]), "compressive": rr["compressive"], "lateral": b["bond"] == "lateral", "bond": rr["cohesion"],
				"left": maxf(0.0, rr["joules"]) / rr["cap"] if rr["cap"] > 0.0 else 1.0, "ref": b})
		var fixed := []
		for c in state["colliders"]:
			if c["blk"] == null:
				fixed.append(c)
		var L := load_pass(boxes, fixed, state["floor"], R["g"], TOUCH)
		for x in L["crush"]:
			break_it(state, x["ref"], "crush")
		for grp in L["span"]:
			for x in grp:
				if x["ref"]["broken"] == null:
					x["ref"]["bond"] = ""
					state["settle_dirty"] = true
		R["seq"] = state["break_seq"]
	state["time"] += dt


# ── the canonical frame (rupa-conformance.js snapshot): each block's state, its foot to 1e-6, its joules to 1e-3 ────
static func _fixed(x: float, places: int) -> String:
	var m := pow(10.0, places)
	var v := Js.js_round(x * m) / m + 0.0
	return ("%." + str(places) + "f") % v

static func snapshot(state: Dictionary) -> String:
	var parts := []
	for b in state["blocks"]:
		var how := "-"
		if b["broken"] != null:
			how = b["broken"]["how"]
		elif b["falling"] != null:
			how = "falling"
		var j: float = maxf(0.0, b["rupa"]["joules"]) if b["rupa"] != null else 0.0
		parts.append("%s|%s|%s|%s" % [str(b["id"]), how, _fixed(b["min"][2], 6), _fixed(j, 3)])
	return ";".join(parts)
