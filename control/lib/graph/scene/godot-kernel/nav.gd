extends RefCounted
# mojulo-godot kernel — PATHFINDING for minds on the ground (since 0.26.0): a port of the web's nav
# (lib/graph/worlds/controllable/nav.js). A walk grid baked from the world's colliders, A* over it, and a string pull
# so a mind walks corner to corner instead of cell to cell. The grid is cached on the world (one per body radius,
# height, foot band and cell; rebuilt when the collider set changes). A box blocks a cell when it overlaps the cell's
# centre circle inflated by the body radius and its z band meets the body's (a body walks under a raised slab and over
# a box it stands on). One floor at the body's height. Deterministic: ties broken by cell index. Held equal to the web's
# by scripts/conformance.mjs --engine godot --corpus mind (the mind corpus walks it).
#
#   path(world, from, to, opts) → [[x, y], …] corners after `from` ending at `to`, [] when the line is clear, or null
#                                 when no path exists (opts: { radius, height, footZ, step, cell })
#   clear(world, from, to, opts) → true when the grid line between the two points is walkable
# `world` is a Dictionary with `colliders` (an Array of { min, max } or null), `navCell` and the cache `navCache`.

const Js := preload("res://kernel/js.gd")

const MAX_CELLS := 250000
const SQRT2 := 1.4142135623730951


# a cheap fingerprint of the collider set: count plus the sum of every coordinate (as JS's toFixed(3))
static func _colliders_key(cs) -> String:
	if not (cs is Array) or (cs as Array).is_empty():
		return "0"
	var s := 0.0
	for c in cs:
		if c is Dictionary and c.get("min") is Array and c.get("max") is Array:
			var mn: Array = c["min"]
			var mx: Array = c["max"]
			s += float(mn[0]) + float(mn[1]) + float(mn[2]) + 3.0 * (float(mx[0]) + float(mx[1]) + float(mx[2]))
	return "%d:%s" % [(cs as Array).size(), _fixed3(s)]


# Number.prototype.toFixed(3): round half away from zero on the decimal value
static func _fixed3(v: float) -> String:
	return "%.3f" % v


static func _bake(world: Dictionary, o: Dictionary) -> Dictionary:
	var cs: Array = world.get("colliders") if world.get("colliders") is Array else []
	var cell := float(o["cell"])
	var r := float(o["radius"])
	var pad := r + cell * 4.0
	var fr: Array = o["from"]
	var to: Array = o["to"]
	var x0 := minf(float(fr[0]), float(to[0])) - pad
	var y0 := minf(float(fr[1]), float(to[1])) - pad
	var x1 := maxf(float(fr[0]), float(to[0])) + pad
	var y1 := maxf(float(fr[1]), float(to[1])) + pad
	for c in cs:
		if not (c is Dictionary and c.get("min") is Array and c.get("max") is Array):
			continue
		x0 = minf(x0, float(c["min"][0]) - pad)
		y0 = minf(y0, float(c["min"][1]) - pad)
		x1 = maxf(x1, float(c["max"][0]) + pad)
		y1 = maxf(y1, float(c["max"][1]) + pad)
	while ceilf((x1 - x0) / cell) * ceilf((y1 - y0) / cell) > MAX_CELLS:
		cell *= 1.5
	var nx := int(ceilf((x1 - x0) / cell))
	var ny := int(ceilf((y1 - y0) / cell))
	var block := PackedByteArray()
	block.resize(nx * ny)
	var foot := float(o["footZ"])
	for c in cs:
		if not (c is Dictionary and c.get("min") is Array and c.get("max") is Array):
			continue
		var mn: Array = c["min"]
		var mx: Array = c["max"]
		if foot >= float(mx[2]) - float(o["step"]):
			continue
		if foot + float(o["height"]) <= float(mn[2]):
			continue
		var i0 := maxi(0, int(floorf((float(mn[0]) - r - x0) / cell)))
		var i1 := mini(nx - 1, int(floorf((float(mx[0]) + r - x0) / cell)))
		var j0 := maxi(0, int(floorf((float(mn[1]) - r - y0) / cell)))
		var j1 := mini(ny - 1, int(floorf((float(mx[1]) + r - y0) / cell)))
		for j in range(j0, j1 + 1):
			for i in range(i0, i1 + 1):
				var cx := x0 + (float(i) + 0.5) * cell
				var cy := y0 + (float(j) + 0.5) * cell
				var qx := float(mn[0]) if cx < float(mn[0]) else (float(mx[0]) if cx > float(mx[0]) else cx)
				var qy := float(mn[1]) if cy < float(mn[1]) else (float(mx[1]) if cy > float(mx[1]) else cy)
				if (cx - qx) * (cx - qx) + (cy - qy) * (cy - qy) < r * r:
					block[j * nx + i] = 1
	return {"x0": x0, "y0": y0, "cell": cell, "nx": nx, "ny": ny, "block": block}


static func _inside(g: Dictionary, p: Array) -> bool:
	return float(p[0]) >= g["x0"] and float(p[1]) >= g["y0"] and float(p[0]) < g["x0"] + g["nx"] * g["cell"] and float(p[1]) < g["y0"] + g["ny"] * g["cell"]


# JS's `String(number)` for the key's radius, height and cell (an integer prints without a point)
static func _num(v: float) -> String:
	if v == floorf(v) and absf(v) < 1e15:
		return str(int(v))
	return str(v)


static func _grid(world: Dictionary, o: Dictionary) -> Dictionary:
	var ck := _colliders_key(world.get("colliders"))
	var key := "%s|%s|%s|%d|%s" % [ck, _num(float(o["radius"])), _num(float(o["height"])), int(_js_round(float(o["footZ"]) * 10.0)), _num(float(o["cell"]))]
	if not (world.get("navCache") is Dictionary):
		world["navCache"] = {}
	var cache: Dictionary = world["navCache"]
	var g = cache.get(key)
	if g == null or not _inside(g, o["from"]) or not _inside(g, o["to"]):
		for k in cache.keys():
			if String(k).split("|")[0] != ck:
				cache.erase(k)
		g = _bake(world, o)
		cache[key] = g
	return g


# Math.round: half up
static func _js_round(v: float) -> float:
	return floorf(v + 0.5)


static func _cell_idx(g: Dictionary, p: Array) -> int:
	var i := mini(int(g["nx"]) - 1, maxi(0, int(floorf((float(p[0]) - g["x0"]) / g["cell"]))))
	var j := mini(int(g["ny"]) - 1, maxi(0, int(floorf((float(p[1]) - g["y0"]) / g["cell"]))))
	return j * int(g["nx"]) + i


static func _centre(g: Dictionary, idx: int) -> Array:
	var nx := int(g["nx"])
	return [g["x0"] + (float(idx % nx) + 0.5) * g["cell"], g["y0"] + (float(idx / nx) + 0.5) * g["cell"]]


# the nearest open cell to a blocked one (a goal inside an inflated wall, or a body pressed against one)
static func _nearest_open(g: Dictionary, idx: int) -> int:
	var block: PackedByteArray = g["block"]
	if block[idx] == 0:
		return idx
	var nx := int(g["nx"])
	var ny := int(g["ny"])
	var i0 := idx % nx
	var j0 := idx / nx
	for rad in range(1, 12):
		var best := -1
		var bd := INF
		for j in range(j0 - rad, j0 + rad + 1):
			for i in range(i0 - rad, i0 + rad + 1):
				if i < 0 or j < 0 or i >= nx or j >= ny:
					continue
				if maxi(absi(i - i0), absi(j - j0)) != rad:
					continue
				var k := j * nx + i
				if block[k] != 0:
					continue
				var d := float((i - i0) * (i - i0) + (j - j0) * (j - j0))
				if d < bd or (d == bd and k < best):
					bd = d
					best = k
		if best >= 0:
			return best
	return -1


# line of sight on the grid: sample the segment between two cell centres every quarter cell; every cell a sample
# lands in must be open (the grid is already inflated by the body radius: a swept-body test)
static func _line_open(g: Dictionary, a: int, b: int) -> bool:
	var p := _centre(g, a)
	var q := _centre(g, b)
	var block: PackedByteArray = g["block"]
	var dx: float = q[0] - p[0]
	var dy: float = q[1] - p[1]
	var n := maxi(1, int(ceilf((sqrt(dx * dx + dy * dy) / g["cell"]) * 4.0)))
	for k in range(n + 1):
		var x: float = p[0] + ((q[0] - p[0]) * k) / n
		var y: float = p[1] + ((q[1] - p[1]) * k) / n
		if block[_cell_idx(g, [x, y])] != 0:
			return false
	return true


# A*: 8-connected, no corner cutting, octile heuristic, a binary heap ordered by (f, index)
static func _less(a: Array, b: Array) -> bool:
	return a[0] < b[0] or (a[0] == b[0] and a[1] < b[1])


static func _a_star(g: Dictionary, s: int, t: int):
	var nx := int(g["nx"])
	var ny := int(g["ny"])
	var n := nx * ny
	var block: PackedByteArray = g["block"]
	var G := PackedFloat64Array()
	G.resize(n)
	G.fill(INF)
	var from := PackedInt32Array()
	from.resize(n)
	from.fill(-1)
	var closed := PackedByteArray()
	closed.resize(n)
	var heap: Array = []
	var ti := t % nx
	var tj := t / nx
	var h := func(k: int) -> float:
		var dx := absi(k % nx - ti)
		var dy := absi(k / nx - tj)
		return float(maxi(dx, dy)) + (SQRT2 - 1.0) * float(mini(dx, dy))
	G[s] = 0.0
	_push(heap, [h.call(s), s])
	while not heap.is_empty():
		var top: Array = _pop(heap)
		var k: int = top[1]
		if closed[k] != 0:
			continue
		if k == t:
			break
		closed[k] = 1
		var i := k % nx
		var j := k / nx
		for dj in [-1, 0, 1]:
			for di in [-1, 0, 1]:
				if di == 0 and dj == 0:
					continue
				var ni: int = i + di
				var nj: int = j + dj
				if ni < 0 or nj < 0 or ni >= nx or nj >= ny:
					continue
				var nk := nj * nx + ni
				if block[nk] != 0 or closed[nk] != 0:
					continue
				if di != 0 and dj != 0 and (block[j * nx + ni] != 0 or block[nj * nx + i] != 0):
					continue
				var ng: float = G[k] + (SQRT2 if di != 0 and dj != 0 else 1.0)
				if ng < G[nk]:
					G[nk] = ng
					from[nk] = k
					_push(heap, [ng + h.call(nk), nk])
	if G[t] == INF:
		return null
	var cells: Array = []
	var k2 := t
	while k2 != -1:
		cells.append(k2)
		k2 = from[k2]
	cells.reverse()
	return cells


static func _push(heap: Array, x: Array) -> void:
	heap.append(x)
	var k := heap.size() - 1
	while k > 0:
		var p := (k - 1) >> 1
		if not _less(heap[k], heap[p]):
			break
		var tmp = heap[k]
		heap[k] = heap[p]
		heap[p] = tmp
		k = p


static func _pop(heap: Array) -> Array:
	var top: Array = heap[0]
	var last: Array = heap.pop_back()
	if not heap.is_empty():
		heap[0] = last
		var k := 0
		while true:
			var l := 2 * k + 1
			var r := l + 1
			var m := k
			if l < heap.size() and _less(heap[l], heap[m]):
				m = l
			if r < heap.size() and _less(heap[r], heap[m]):
				m = r
			if m == k:
				break
			var tmp = heap[k]
			heap[k] = heap[m]
			heap[m] = tmp
			k = m
	return top


static func _opts(world: Dictionary, from: Array, to: Array, opts: Dictionary) -> Dictionary:
	var radius := maxf(0.01, float(opts.get("radius", 0.0)) if Js.truthy(opts.get("radius")) else 0.5)
	var cell := 0.0
	if Js.truthy(opts.get("cell")):
		cell = float(opts["cell"])
	elif Js.truthy(world.get("navCell")):
		cell = float(world["navCell"])
	else:
		cell = maxf(1.0, radius)
	return {
		"from": from, "to": to, "radius": radius,
		"height": float(opts["height"]) if opts.get("height") != null else 24.0,
		"footZ": float(opts["footZ"]) if opts.get("footZ") != null else 0.0,
		"step": float(opts["step"]) if opts.get("step") != null else 0.35,
		"cell": cell,
	}


static func _has_colliders(world: Dictionary) -> bool:
	return world.get("colliders") is Array and not (world["colliders"] as Array).is_empty()


static func clear(world: Dictionary, from: Array, to: Array, opts: Dictionary) -> bool:
	if not _has_colliders(world):
		return true
	var o := _opts(world, from, to, opts)
	var g := _grid(world, o)
	var own := _cell_idx(g, from)
	var s := _nearest_open(g, own)
	return s == own and _line_open(g, s, _cell_idx(g, to))


static func path(world: Dictionary, from: Array, to: Array, opts: Dictionary):
	if not _has_colliders(world):
		return []
	var o := _opts(world, from, to, opts)
	var g := _grid(world, o)
	var own := _cell_idx(g, from)
	var s := _nearest_open(g, own)
	var t := _nearest_open(g, _cell_idx(g, to))
	if s < 0 or t < 0:
		return null
	var out: Array = [] if s == own else [_centre(g, s)]
	if _line_open(g, s, t):
		if out.is_empty():
			return []
		out.append([to[0], to[1]])
		return out
	var cells = _a_star(g, s, t)
	if cells == null:
		return null
	var a := 0
	while a < cells.size() - 1:
		var b: int = cells.size() - 1
		while b > a + 1 and not _line_open(g, cells[a], cells[b]):
			b -= 1
		out.append([to[0], to[1]] if b == cells.size() - 1 else _centre(g, cells[b]))
		a = b
	return out
