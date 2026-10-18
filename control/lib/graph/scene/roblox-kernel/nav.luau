--!nonstrict
-- mojulo-roblox kernel — PATHFINDING for minds on the ground: a port of the web's nav (lib/graph/worlds/controllable/
-- nav.js), laid out as the Godot kernel's nav.gd is (the same module in another language). A walk grid baked from the
-- world's colliders, A* over it, and a string pull so a mind walks corner to corner instead of cell to cell. The grid
-- is cached on the world (one per body radius, height, foot band and cell; rebuilt when the collider set changes). A
-- box blocks a cell when it overlaps the cell's centre circle inflated by the body radius and its z band meets the
-- body's (a body walks under a raised slab and over a box it stands on). One floor at the body's height.
-- Deterministic: ties broken by cell index. Held equal to the web's by the mind conformance corpus, run under Lune.
--
-- Pure Luau, no host API. A kernel module: the loader hands it the kernel (K.js).
--
--   nav.path(world, from, to, opts) → { {x, y}, … } corners after `from` ending at `to`, {} when the line is clear, or
--                                     nil when no path exists (opts: { radius, height, footZ, step, cell })
--   nav.clear(world, from, to, opts) → true when the grid line between the two points is walkable
-- `world` is a table with `colliders` (a list of { min, max } or nil), `navCell` and the cache `navCache`. Cells are
-- indexed from 0 as the web's are (a Lua list holds cell k at k + 1).

return function(K)
local js = K.js
local NULL, UNDEF = js.NULL, js.UNDEF

local nav = {}

local MAX_CELLS = 250000
local SQRT2 = 1.4142135623730951
local INF = math.huge
local floor, ceil, sqrt, abs = math.floor, math.ceil, math.sqrt, math.abs

local function nz(v)
	if v == NULL or v == UNDEF then
		return nil
	end
	return v
end
local function truthy(v)
	return js.truthy(v)
end
local function isList(v)
	return js.isArr(v)
end
local function isBox(c)
	return js.isObj(c) and isList(c.min) and isList(c.max)
end
local function minf(a, b)
	return a < b and a or b
end
local function maxf(a, b)
	return a > b and a or b
end
-- integer division and remainder of non-negative cell indices
local function idiv(a, b)
	return floor(a / b)
end

-- Number.prototype.toFixed(3) (exact for the sums a collider set makes; a key only has to tell two sets apart)
local function fixed3(v)
	return string.format("%.3f", v)
end

-- a cheap fingerprint of the collider set: count plus the sum of every coordinate
local function collidersKey(cs)
	if not isList(cs) or #cs == 0 then
		return "0"
	end
	local s = 0.0
	for _, c in ipairs(cs) do
		if isBox(c) then
			local mn, mx = c.min, c.max
			s += mn[1] + mn[2] + mn[3] + 3.0 * (mx[1] + mx[2] + mx[3])
		end
	end
	return tostring(#cs) .. ":" .. fixed3(s)
end

local function bake(world, o)
	local cs = isList(world.colliders) and world.colliders or {}
	local cell = o.cell
	local r = o.radius
	local pad = r + cell * 4.0
	local fr, to = o.from, o.to
	local x0 = minf(fr[1], to[1]) - pad
	local y0 = minf(fr[2], to[2]) - pad
	local x1 = maxf(fr[1], to[1]) + pad
	local y1 = maxf(fr[2], to[2]) + pad
	for _, c in ipairs(cs) do
		if not isBox(c) then
			continue
		end
		x0 = minf(x0, c.min[1] - pad)
		y0 = minf(y0, c.min[2] - pad)
		x1 = maxf(x1, c.max[1] + pad)
		y1 = maxf(y1, c.max[2] + pad)
	end
	while ceil((x1 - x0) / cell) * ceil((y1 - y0) / cell) > MAX_CELLS do
		cell *= 1.5
	end
	local nx = ceil((x1 - x0) / cell)
	local ny = ceil((y1 - y0) / cell)
	local block = table.create(nx * ny, 0)
	local foot = o.footZ
	for _, c in ipairs(cs) do
		if not isBox(c) then
			continue
		end
		local mn, mx = c.min, c.max
		if foot >= mx[3] - o.step then
			continue
		end
		if foot + o.height <= mn[3] then
			continue
		end
		local i0 = math.max(0, floor((mn[1] - r - x0) / cell))
		local i1 = math.min(nx - 1, floor((mx[1] + r - x0) / cell))
		local j0 = math.max(0, floor((mn[2] - r - y0) / cell))
		local j1 = math.min(ny - 1, floor((mx[2] + r - y0) / cell))
		for j = j0, j1 do
			for i = i0, i1 do
				local cx = x0 + (i + 0.5) * cell
				local cy = y0 + (j + 0.5) * cell
				local qx = cx < mn[1] and mn[1] or (cx > mx[1] and mx[1] or cx)
				local qy = cy < mn[2] and mn[2] or (cy > mx[2] and mx[2] or cy)
				if (cx - qx) * (cx - qx) + (cy - qy) * (cy - qy) < r * r then
					block[j * nx + i + 1] = 1
				end
			end
		end
	end
	return { x0 = x0, y0 = y0, cell = cell, nx = nx, ny = ny, block = block }
end

local function inside(g, p)
	return p[1] >= g.x0 and p[2] >= g.y0 and p[1] < g.x0 + g.nx * g.cell and p[2] < g.y0 + g.ny * g.cell
end

local function grid(world, o)
	local ck = collidersKey(world.colliders)
	local key = ck .. "|" .. js.numStr(o.radius) .. "|" .. js.numStr(o.height) .. "|" .. js.numStr(js.round(o.footZ * 10.0)) .. "|" .. js.numStr(o.cell)
	if type(world.navCache) ~= "table" then
		world.navCache = {}
	end
	local cache = world.navCache
	local g = cache[key]
	if g == nil or not inside(g, o.from) or not inside(g, o.to) then
		for k in pairs(cache) do
			if string.split(k, "|")[1] ~= ck then
				cache[k] = nil
			end
		end
		g = bake(world, o)
		cache[key] = g
	end
	return g
end

local function cellIdx(g, p)
	local i = math.min(g.nx - 1, math.max(0, floor((p[1] - g.x0) / g.cell)))
	local j = math.min(g.ny - 1, math.max(0, floor((p[2] - g.y0) / g.cell)))
	return j * g.nx + i
end

local function centre(g, idx)
	local nx = g.nx
	return { g.x0 + ((idx % nx) + 0.5) * g.cell, g.y0 + (idiv(idx, nx) + 0.5) * g.cell }
end

-- the nearest open cell to a blocked one (a goal inside an inflated wall, or a body pressed against one)
local function nearestOpen(g, idx)
	local block = g.block
	if block[idx + 1] == 0 then
		return idx
	end
	local nx, ny = g.nx, g.ny
	local i0 = idx % nx
	local j0 = idiv(idx, nx)
	for rad = 1, 11 do
		local best = -1
		local bd = INF
		for j = j0 - rad, j0 + rad do
			for i = i0 - rad, i0 + rad do
				if i < 0 or j < 0 or i >= nx or j >= ny then
					continue
				end
				if math.max(abs(i - i0), abs(j - j0)) ~= rad then
					continue
				end
				local k = j * nx + i
				if block[k + 1] ~= 0 then
					continue
				end
				local d = (i - i0) * (i - i0) + (j - j0) * (j - j0)
				if d < bd or (d == bd and k < best) then
					bd = d
					best = k
				end
			end
		end
		if best >= 0 then
			return best
		end
	end
	return -1
end

-- line of sight on the grid: sample the segment between two cell centres every quarter cell; every cell a sample
-- lands in must be open (the grid is already inflated by the body radius: a swept-body test)
local function lineOpen(g, a, b)
	local p = centre(g, a)
	local q = centre(g, b)
	local block = g.block
	local dx = q[1] - p[1]
	local dy = q[2] - p[2]
	local n = math.max(1, ceil((sqrt(dx * dx + dy * dy) / g.cell) * 4.0))
	for k = 0, n do
		local x = p[1] + ((q[1] - p[1]) * k) / n
		local y = p[2] + ((q[2] - p[2]) * k) / n
		if block[cellIdx(g, { x, y }) + 1] ~= 0 then
			return false
		end
	end
	return true
end

-- A*: 8-connected, no corner cutting, octile heuristic, a binary heap ordered by (f, index)
local function less(a, b)
	return a[1] < b[1] or (a[1] == b[1] and a[2] < b[2])
end

local function push(heap, x)
	table.insert(heap, x)
	local k = #heap
	while k > 1 do
		local p = floor(k / 2)
		if not less(heap[k], heap[p]) then
			break
		end
		heap[k], heap[p] = heap[p], heap[k]
		k = p
	end
end

local function pop(heap)
	local top = heap[1]
	local last = table.remove(heap)
	if #heap > 0 then
		heap[1] = last
		local k = 1
		local n = #heap
		while true do
			local l = 2 * k
			local r = l + 1
			local m = k
			if l <= n and less(heap[l], heap[m]) then
				m = l
			end
			if r <= n and less(heap[r], heap[m]) then
				m = r
			end
			if m == k then
				break
			end
			heap[k], heap[m] = heap[m], heap[k]
			k = m
		end
	end
	return top
end

local NEIGHBOURS = { -1, 0, 1 }

local function aStar(g, s, t)
	local nx, ny = g.nx, g.ny
	local n = nx * ny
	local block = g.block
	local G = table.create(n, INF)
	local from = table.create(n, -1)
	local closed = table.create(n, false)
	local heap = {}
	local ti = t % nx
	local tj = idiv(t, nx)
	local function h(k)
		local dx = abs(k % nx - ti)
		local dy = abs(idiv(k, nx) - tj)
		return math.max(dx, dy) + (SQRT2 - 1.0) * math.min(dx, dy)
	end
	G[s + 1] = 0.0
	push(heap, { h(s), s })
	while #heap > 0 do
		local top = pop(heap)
		local k = top[2]
		if closed[k + 1] then
			continue
		end
		if k == t then
			break
		end
		closed[k + 1] = true
		local i = k % nx
		local j = idiv(k, nx)
		for _, dj in ipairs(NEIGHBOURS) do
			for _, di in ipairs(NEIGHBOURS) do
				if di == 0 and dj == 0 then
					continue
				end
				local ni = i + di
				local nj = j + dj
				if ni < 0 or nj < 0 or ni >= nx or nj >= ny then
					continue
				end
				local nk = nj * nx + ni
				if block[nk + 1] ~= 0 or closed[nk + 1] then
					continue
				end
				if di ~= 0 and dj ~= 0 and (block[j * nx + ni + 1] ~= 0 or block[nj * nx + i + 1] ~= 0) then
					continue
				end
				local ng = G[k + 1] + ((di ~= 0 and dj ~= 0) and SQRT2 or 1.0)
				if ng < G[nk + 1] then
					G[nk + 1] = ng
					from[nk + 1] = k
					push(heap, { ng + h(nk), nk })
				end
			end
		end
	end
	if G[t + 1] == INF then
		return nil
	end
	local cells = {}
	local k2 = t
	while k2 ~= -1 do
		table.insert(cells, k2)
		k2 = from[k2 + 1]
	end
	local out = {}
	for i = #cells, 1, -1 do
		table.insert(out, cells[i])
	end
	return out
end

local function options(world, from, to, opts)
	local radius = maxf(0.01, truthy(opts.radius) and opts.radius or 0.5)
	local cell
	if truthy(opts.cell) then
		cell = opts.cell
	elseif truthy(world.navCell) then
		cell = world.navCell
	else
		cell = maxf(1.0, radius)
	end
	return {
		from = from, to = to, radius = radius,
		height = nz(opts.height) ~= nil and opts.height or 24.0,
		footZ = nz(opts.footZ) ~= nil and opts.footZ or 0.0,
		step = nz(opts.step) ~= nil and opts.step or 0.35,
		cell = cell,
	}
end

local function hasColliders(world)
	return isList(world.colliders) and #world.colliders > 0
end

function nav.clear(world, from, to, opts)
	if not hasColliders(world) then
		return true
	end
	local o = options(world, from, to, opts)
	local g = grid(world, o)
	local own = cellIdx(g, from)
	local s = nearestOpen(g, own)
	return s == own and lineOpen(g, s, cellIdx(g, to))
end

function nav.path(world, from, to, opts)
	if not hasColliders(world) then
		return {}
	end
	local o = options(world, from, to, opts)
	local g = grid(world, o)
	local own = cellIdx(g, from)
	local s = nearestOpen(g, own)
	local t = nearestOpen(g, cellIdx(g, to))
	if s < 0 or t < 0 then
		return nil
	end
	local out = s == own and {} or { centre(g, s) }
	if lineOpen(g, s, t) then
		if #out == 0 then
			return {}
		end
		table.insert(out, { to[1], to[2] })
		return out
	end
	local cells = aStar(g, s, t)
	if cells == nil then
		return nil
	end
	local a = 1
	while a < #cells do
		local b = #cells
		while b > a + 1 and not lineOpen(g, cells[a], cells[b]) do
			b -= 1
		end
		table.insert(out, b == #cells and { to[1], to[2] } or centre(g, cells[b]))
		a = b
	end
	return out
end

return nav
end
