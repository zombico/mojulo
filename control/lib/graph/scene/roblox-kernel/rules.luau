--!nonstrict
-- mojulo-roblox kernel — THE MOTION RULES, a literal port of the web's controllable engine (worlds/controllable
-- rules-basic.js walk and the cameras, rules-platform.js platform, rules-drive.js drive and racer, rules-fly.js fly,
-- core.js resolveBlocking and laneNear), laid out as the Godot kernel's rules.gd is (the same module in another
-- language), and held equal to the web frame by frame by the rules conformance corpus (lib/graph/scene/
-- rules-conformance.js), run under Lune. Everything here is in the RECIPE's own frame: z up, recipe units, a heading
-- counter-clockwise from +x seen from above, a position at the eye (the rule's `eye` above the feet). Nothing here
-- touches an Instance: the presenter turns a pose into a CFrame.
--
-- An entity is a table: pos { x, y, z }, heading, pitch, vel { x, y, z }, and the rule's own state (grounded, coyote,
-- jumpBuf, jumpWind, airJumpsUsed, gaitPhase, moving, locomotion, jumped, landed; a car's speed, steerAngle, vz,
-- airborne; a racer's lineAt, laps; a craft's airspeed, bank, tilt…), a missing field nil (the web's undefined). A rule
-- is the score's JSON (K.json.decode: js.NULL kept, tags kept). An input is the web rule's axes (forward, strafe, turn,
-- lookDX, lookDY, jump, jumpHeld, boost, lift). A world is { ground = rules.makeGround(tris), colliders = { {min, max} },
-- surface = fn(pos)?, aiEnabled? }.
--
-- Arithmetic runs in the web's order so a step is the same double; `%` on a float is C fmod (math.fmod), as JS's `%`
-- is (Luau's own `%` floors). What the platform rule does that this port does not is rules.gd's list (the boost hover
-- and inertia, space, the charged jump, the kneel, the maneuver packs).
--
-- Pure Luau, no host API. A kernel module: the loader hands it the kernel (K.js).
--
--   rules.makeGround(tris, flat?)  rules.groundAt(g, pos)  rules.rayLand(g, from, dir, far)
--   rules.entity(pos, heading)     rules.step(e, r, input, dt, world, halt?)
--   rules.camera(pos, heading)     rules.cameraStep(c, r, tgt, tgtRule, dt, world, byId?, pilot?)
--   rules.setShot(c, current, shot) → rule    rules.unshot(c, current) → rule
--   rules.resolveBlocking(pos, footZ, height, cr, colliders, step)   rules.laneNear(lane, x, y, bias?)

return function(K)
local js = K.js
local NULL, UNDEF = js.NULL, js.UNDEF
local truthy = js.truthy

local rules = {}

local PI = math.pi
local TAU = PI * 2.0
local HALF_PI = PI / 2.0
local CELL = 4.0
local INF = math.huge
local NAN = 0 / 0
local G = 9.81

local sin, cos, tan, atan, atan2, sqrt, exp, floor, abs = math.sin, math.cos, math.tan, math.atan, math.atan2, math.sqrt, math.exp, math.floor, math.abs
local fmod = math.fmod

local function isnan(x)
	return x ~= x
end

-- Math.min / Math.max (a NaN wins)
local function minf(a, b)
	if a ~= a or b ~= b then
		return NAN
	end
	if a < b then
		return a
	end
	return b
end
local function maxf(a, b)
	if a ~= a or b ~= b then
		return NAN
	end
	if a > b then
		return a
	end
	return b
end
local function clampf(x, lo, hi)
	return maxf(lo, minf(hi, x))
end
local function signf(x)
	if x > 0 then
		return 1.0
	end
	if x < 0 then
		return -1.0
	end
	return x
end
local function trunc(x)
	if x >= 0 then
		return floor(x)
	end
	return -floor(-x)
end

local function isDict(v)
	return js.isObj(v)
end
local function isList(v)
	return js.isArr(v)
end
local function nullish(v)
	return v == nil or v == NULL or v == UNDEF
end

-- ── the helpers the rules share (core.js) ────────────────────────────────────────────────────────────────────────
-- a number field, or the default
local function num(d, k, dflt)
	local v = d[k]
	if type(v) == "number" then
		return v
	end
	return dflt
end

-- `d.k || 0` for a number
local function num0(d, k)
	local v = d[k]
	if type(v) == "number" and v == v then
		return v
	end
	return 0.0
end

-- a positive number field, or the default
local function posNum(r, k, dflt)
	local v = r[k]
	if type(v) == "number" and v > 0.0 then
		return v
	end
	return dflt
end

-- an input axis: a number, a boolean as 0 / 1, anything else 0
local function inp(input, k)
	local v = input[k]
	if type(v) == "boolean" then
		return v and 1.0 or 0.0
	end
	if type(v) == "number" then
		return v
	end
	return 0.0
end

local function fwdXY(h)
	return { cos(h), sin(h) }
end
local function rightXY(h)
	return { sin(h), -cos(h) }
end
rules.fwdXY = fwdXY
rules.rightXY = rightXY

local function hypot(a, b)
	return sqrt(a * a + b * b)
end

-- (x + π) wrapped to (−π, π] the web's way: ((x + π) % τ + τ) % τ − π
local function wrapPi(x)
	return fmod(fmod(x + PI, TAU) + TAU, TAU) - PI
end

-- ── the ground: the page's raycast straight down, over the level's triangles (level-equivalence.js faceGround) ─────
-- a level with no faces at all stands on the score's implicit plane (`flat`: its height), as level-sim.js's default
local function cellKey(x, y)
	return x * 1048576 + y
end

-- a triangle over more than WIDE cells is kept once with its cell box instead of in every cell (a 6 km quad would be
-- millions of entries); the nearest surface is a maximum and the ray's hit a minimum, so where a candidate is listed
-- never changes the answer
local WIDE = 64

function rules.makeGround(tris, flat)
	if #tris == 0 and type(flat) == "number" then
		return { flat = flat, grid = {}, tris = {}, wide = {} }
	end
	local grid = {}
	local kept = {}
	local wide = {}
	for _, t in ipairs(tris) do
		if not (isList(t) and #t == 3) then
			continue
		end
		table.insert(kept, t)
		local k = #kept
		local x0 = floor(minf(minf(t[1][1], t[2][1]), t[3][1]) / CELL)
		local x1 = floor(maxf(maxf(t[1][1], t[2][1]), t[3][1]) / CELL)
		local y0 = floor(minf(minf(t[1][2], t[2][2]), t[3][2]) / CELL)
		local y1 = floor(maxf(maxf(t[1][2], t[2][2]), t[3][2]) / CELL)
		if (x1 - x0 + 1) * (y1 - y0 + 1) > WIDE then
			table.insert(wide, { k = k, x0 = x0, x1 = x1, y0 = y0, y1 = y1 })
			continue
		end
		for x = x0, x1 do
			for y = y0, y1 do
				local key = cellKey(x, y)
				local list = grid[key]
				if not list then
					list = {}
					grid[key] = list
				end
				table.insert(list, k)
			end
		end
	end
	return { grid = grid, tris = kept, wide = wide }
end

-- the triangles listed at a cell (k, by index into g.tris): its own list, then the wide ones whose box holds it
local function candidates(g, cx, cy)
	local list = g.grid[cellKey(cx, cy)]
	local wide = g.wide
	if wide == nil or #wide == 0 then
		return list
	end
	local out = nil
	for _, w in ipairs(wide) do
		if cx >= w.x0 and cx <= w.x1 and cy >= w.y0 and cy <= w.y1 then
			if out == nil then
				out = list and table.clone(list) or {}
			end
			table.insert(out, w.k)
		end
	end
	return out or list
end

-- the height of triangle t over (x, y), or NaN when (x, y) is outside it (barycentric, edges included)
local function heightIn(t, x, y)
	local a, b, c = t[1], t[2], t[3]
	local d = (b[2] - c[2]) * (a[1] - c[1]) + (c[1] - b[1]) * (a[2] - c[2])
	if abs(d) < 1e-12 then
		return NAN
	end
	local u = ((b[2] - c[2]) * (x - c[1]) + (c[1] - b[1]) * (y - c[2])) / d
	local v = ((c[2] - a[2]) * (x - c[1]) + (a[1] - c[1]) * (y - c[2])) / d
	local w = 1.0 - u - v
	if u < -1e-9 or v < -1e-9 or w < -1e-9 then
		return NAN
	end
	return u * a[3] + v * b[3] + w * c[3]
end

-- the nearest surface at or below pos + 0.05, straight down; NaN when there is none (the web's null)
local function groundAt(g, pos)
	if type(g) ~= "table" then
		return NAN
	end
	if g.flat ~= nil then
		if g.flat <= pos[3] + 0.05 then
			return g.flat
		end
		return NAN
	end
	local x, y = pos[1], pos[2]
	local top = pos[3] + 0.05
	local list = candidates(g, floor(x / CELL), floor(y / CELL))
	if list == nil then
		return NAN
	end
	local best = NAN
	for _, k in ipairs(list) do
		local z = heightIn(g.tris[k], x, y)
		if z == z and z <= top and (best ~= best or z > best) then
			best = z
		end
	end
	return best
end
rules.groundAt = groundAt

-- core.js laneNear: the nearest point of a polyline lane and the lane's direction there
local function laneNear(lane, x, y, bias)
	bias = bias or 0.0
	local best = INF
	local px, py = lane[1][1], lane[1][2]
	local tx, ty = 1.0, 0.0
	for i = 2, #lane do
		local ax, ay = lane[i - 1][1], lane[i - 1][2]
		local dx = lane[i][1] - ax
		local dy = lane[i][2] - ay
		local l2 = dx * dx + dy * dy
		if l2 < 1e-12 then
			continue
		end
		local u = maxf(0.0, minf(1.0, ((x - ax) * dx + (y - ay) * dy) / l2))
		local qx = ax + dx * u
		local qy = ay + dy * u
		local d2 = (x - qx) * (x - qx) + (y - qy) * (y - qy)
		if d2 < best - 1e-12 or (bias > 0.0 and d2 <= best + 1e-12) then
			local L = sqrt(l2)
			best = d2
			px, py = qx, qy
			tx = dx / L
			ty = dy / L
		end
	end
	return { px = px, py = py, tx = tx, ty = ty }
end
rules.laneNear = laneNear

-- core.js resolveBlocking: the footprint circle pushed out of every box whose z-band the body overlaps
local function resolveBlocking(pos, footZ, height, cr, colliders, step)
	if #colliders == 0 or not (cr > 0.0) then
		return
	end
	for _, c in ipairs(colliders) do
		if not (isDict(c) and isList(c.min) and isList(c.max)) then
			continue
		end
		local mn, mx = c.min, c.max
		if footZ >= mx[3] - step then
			continue
		end
		if footZ + height <= mn[3] then
			continue
		end
		local px, py = pos[1], pos[2]
		local insideX = px > mn[1] and px < mx[1]
		local insideY = py > mn[2] and py < mx[2]
		if insideX and insideY then
			local dl = px - mn[1]
			local dr = mx[1] - px
			local dd = py - mn[2]
			local du = mx[2] - py
			local m = minf(minf(dl, dr), minf(dd, du))
			if m == dl then
				pos[1] = mn[1] - cr
			elseif m == dr then
				pos[1] = mx[1] + cr
			elseif m == dd then
				pos[2] = mn[2] - cr
			else
				pos[2] = mx[2] + cr
			end
		else
			local nx = px < mn[1] and mn[1] or (px > mx[1] and mx[1] or px)
			local ny = py < mn[2] and mn[2] or (py > mx[2] and mx[2] or py)
			local dx = px - nx
			local dy = py - ny
			local d2 = dx * dx + dy * dy
			if d2 < cr * cr and d2 > 1e-9 then
				local d = sqrt(d2)
				pos[1] = nx + (dx / d) * cr
				pos[2] = ny + (dy / d) * cr
			end
		end
	end
end
rules.resolveBlocking = resolveBlocking

-- the world's colliders when it has a list of them (an empty one blocks nothing)
local function colliderList(world)
	local c = world.colliders
	if isList(c) or (type(c) == "table" and getmetatable(c) == nil and next(c) == nil) then
		return c
	end
	return nil
end

-- a fresh entity's rule state, as core.js normalizeEntity starts it
function rules.entity(pos, heading)
	return { pos = { pos[1], pos[2], pos[3] }, heading = heading, pitch = 0.0, vel = { 0.0, 0.0, 0.0 }, gaitPhase = 0.0, moving = false, locomotion = "forward" }
end

-- ── walk — ground-locked: a tank turn (or a look), forward and strafe, the feet on the ground under the eye ────────
function rules.walk(e, r, input, dt, world)
	local speed = num(r, "speed", 6.0)
	local turn = num(r, "turn", 2.2)
	local stride = num(r, "stride", 2.4)
	local strafe = num(r, "strafe", 0.0)
	local eye = num(r, "eye", 0.0)
	local turnMode = r.turnMode
	local tank = (type(turnMode) == "string" and turnMode or "tank") == "tank"
	local sens = num(r, "lookSens", 0.0025)
	if tank then
		e.heading = fmod(e.heading - inp(input, "turn") * turn * dt, TAU)
	else
		e.heading = fmod(e.heading + inp(input, "lookDX") * sens, TAU)
		if truthy(r.keyTurn) then
			e.heading = fmod(e.heading - inp(input, "turn") * turn * dt, TAU)
		end
	end
	if truthy(r.lookPitch) and not tank then
		e.pitch = clampf((e.pitch or 0.0) + inp(input, "lookDY") * sens, -HALF_PI + 0.05, HALF_PI - 0.05)
	end
	local f = fwdXY(e.heading)
	local rt = rightXY(e.heading)
	local moveF = inp(input, "forward") * speed * dt
	local moveS = inp(input, "strafe") * strafe * speed * dt
	local p = e.pos
	p[1] = p[1] + (f[1] * moveF + rt[1] * moveS)
	p[2] = p[2] + (f[2] * moveF + rt[2] * moveS)
	local cr = num(r, "collideRadius", 0.0)
	local cols = colliderList(world)
	if cr > 0.0 and cols then
		resolveBlocking(p, p[3] - eye, num(r, "collideHeight", num(r, "eye", 1.7)), cr, cols, num(r, "step", 0.35))
	end
	local probe = num(r, "probe", 0.0)
	local gz = groundAt(world.ground, probe > 0.0 and { p[1], p[2], p[3] - eye + probe } or p)
	if gz == gz then
		p[3] = gz + eye
	end
	local dist = hypot(moveF, moveS)
	e.gaitPhase = (e.gaitPhase or 0.0) + (moveF < 0.0 and -dist or dist) / stride
	e.moving = abs(inp(input, "forward")) + abs(inp(input, "strafe")) > 1e-3
end

-- ── platform — the ground half of the platform rule: turn (tank, look, world, lane), run, jump, fall and land ──────
function rules.platform(e, r, input, dt, world, halt)
	halt = halt or 1.0
	local speed = num(r, "speed", 6.0)
	local turnRate = num(r, "turn", 2.4)
	local strafe = num(r, "strafe", 1.0)
	local eye = num(r, "eye", 0.0)
	local riseG = num(r, "gravity", 20.0)
	local fallG = num(r, "fallGravity", riseG * 1.7)
	local jumpV = num(r, "jumpSpeed", 8.5)
	local maxFall = num(r, "maxFall", 26.0)
	local snap = num(r, "snap", 0.15)
	local stepUp = num(r, "step", 0.35)
	local coyoteT = num(r, "coyote", 0.1)
	local bufferT = num(r, "buffer", 0.1)
	local cutV = num(r, "jumpCut", 0.0)
	local air = num(r, "airControl", 0.7)
	local boostSpeed = num(r, "boostSpeed", speed * 3.5)
	local boostMax = num(r, "boostMax", 0.0)
	local hasGauge = boostMax > 0.0
	if hasGauge and e.boost == nil then
		e.boost = boostMax
	end
	local p = e.pos
	local vel = e.vel
	local g = world.ground
	local turnMode = r.turnMode
	local lookMode = (type(turnMode) == "string" and turnMode or "tank") ~= "tank"
	local sens = num(r, "lookSens", 0.0025)
	local lane = r.lane
	local laneMove = r.move == "lane" and isList(lane) and #lane >= 2
	local worldMove = r.move == "world" or laneMove
	local turnAmt = 0.0
	local wmX, wmY, wmMag = 0.0, 0.0, 0.0
	if worldMove then
		local side = clampf(inp(input, "strafe") + inp(input, "turn"), -1.0, 1.0)
		if laneMove then
			local L = laneNear(lane, p[1], p[2], side)
			wmX = L.tx * side
			wmY = L.ty * side
		else
			local my = num(r, "moveYaw", HALF_PI)
			local wf = fwdXY(my)
			local wr = rightXY(my)
			wmX = wf[1] * inp(input, "forward") + wr[1] * side
			wmY = wf[2] * inp(input, "forward") + wr[2] * side
		end
		wmMag = minf(1.0, hypot(wmX, wmY))
		if wmMag > 1e-3 then
			local d = wrapPi(atan2(wmY, wmX) - e.heading)
			local mx = num(r, "faceRate", 12.0) * dt
			turnAmt = clampf(d, -mx, mx)
			e.heading = fmod(e.heading + turnAmt, TAU)
		end
	elseif lookMode then
		turnAmt = inp(input, "lookDX") * sens
		e.heading = fmod(e.heading + turnAmt, TAU)
		e.pitch = clampf((e.pitch or 0.0) + inp(input, "lookDY") * sens, -HALF_PI + 0.05, HALF_PI - 0.05)
	else
		turnAmt = -inp(input, "turn") * turnRate * dt
		e.heading = fmod(e.heading + turnAmt, TAU)
	end

	local footZ = p[3] - eye
	local gz0 = groundAt(g, { p[1], p[2], footZ + stepUp })
	local wasGrounded = e.grounded == true
	local fallSpeed = wasGrounded and 0.0 or maxf(0.0, -vel[3])
	e.grounded = gz0 == gz0 and vel[3] <= 1e-4 and abs(footZ - gz0) <= snap
	local landedEdge = e.grounded and not wasGrounded
	if landedEdge then
		e.landVel = fallSpeed
	end
	if e.grounded then
		e.coyote = 0.0
	else
		local c0 = e.coyote
		if c0 == nil then
			c0 = coyoteT
		end
		e.coyote = minf(c0 + dt, 1.0)
	end
	e.jumpBuf = inp(input, "jump") ~= 0.0 and bufferT or maxf(0.0, (e.jumpBuf or 0.0) - dt)

	local fwdIn = worldMove and wmMag or inp(input, "forward")
	local sideIn = 0.0
	if not worldMove then
		sideIn = clampf(inp(input, "strafe") + (lookMode and inp(input, "turn") or 0.0), -1.0, 1.0)
	end
	local h = (worldMove and wmMag > 1e-3) and atan2(wmY, wmX) or e.heading
	local f = fwdXY(h)
	local rt = rightXY(h)
	local ctl = e.grounded and 1.0 or air

	local windup = num(r, "jumpWindup", 0.0)
	local jumped = false
	local wind = e.jumpWind or 0.0
	if (inp(input, "jump") ~= 0.0 or e.jumpBuf > 0.0) and (e.grounded or e.coyote < coyoteT) and not (wind > 0.0) then
		if windup > 0.0 then
			e.jumpWind = windup
			e.jumpBuf = 0.0
		else
			vel[3] = jumpV
			e.grounded = false
			e.coyote = coyoteT
			e.jumpBuf = 0.0
			jumped = true
		end
	end
	if (e.jumpWind or 0.0) > 0.0 then
		e.jumpWind = e.jumpWind - dt
		e.gaitPhase = (1.0 - maxf(0.0, e.jumpWind) / windup) * 0.9
		if e.jumpWind <= 0.0 then
			e.jumpWind = 0.0
			vel[3] = jumpV
			e.grounded = false
			e.coyote = coyoteT
			jumped = true
		end
	end
	local airJumps = num(r, "airJumps", 0.0)
	if airJumps > 0.0 then
		if e.grounded then
			e.airJumpsUsed = 0.0
		elseif inp(input, "jump") ~= 0.0 and not jumped and not ((e.jumpWind or 0.0) > 0.0) and e.coyote >= coyoteT and (e.airJumpsUsed or 0.0) < airJumps then
			vel[3] = jumpV * num(r, "airJumpMult", 0.9)
			e.airJumpsUsed = (e.airJumpsUsed or 0.0) + 1.0
			e.jumpBuf = 0.0
			jumped = true
		end
	end
	if vel[3] > 0.0 and inp(input, "jumpHeld") == 0.0 and not truthy(e.launchedBy) then
		vel[3] = minf(vel[3], cutV)
	end
	if jumped then
		e.jumpPower = 0.2
	end

	-- boost (F held): the dash at boostSpeed along the held direction (plain F: forward), while its gauge lasts
	local boostAvailable = not hasGauge or (e.boost > 1e-6 and not truthy(e.boostLock))
	if inp(input, "boost") == 0.0 then
		e.boostCut = false
	end
	local boosting = inp(input, "boost") ~= 0.0 and boostAvailable and not truthy(e.boostCut)
	e.boosting = boosting
	local bf = boosting and fwdIn or 0.0
	local bs = boosting and sideIn or 0.0
	if boosting and abs(bf) + abs(bs) < 1e-3 then
		bf = 1.0
	end
	local bn = hypot(bf, bs)
	if bn == 0.0 then
		bn = 1.0
	end
	local fwdMove, sideMove
	if boosting then
		fwdMove = ((bf / bn) * boostSpeed * ctl * dt) * halt
		sideMove = ((bs / bn) * boostSpeed * ctl * dt) * halt
	else
		fwdMove = (fwdIn * speed * ctl * dt) * halt
		sideMove = (sideIn * strafe * speed * ctl * dt) * halt
	end
	p[1] = p[1] + (f[1] * fwdMove + rt[1] * sideMove)
	p[2] = p[2] + (f[2] * fwdMove + rt[2] * sideMove)

	local cols = colliderList(world)
	if cols then
		resolveBlocking(p, footZ, num(r, "collideHeight", eye ~= 0.0 and eye or 24.0), num(r, "collideRadius", 0.0), cols, stepUp)
	end
	if laneMove then
		local L = laneNear(lane, p[1], p[2])
		p[1] = L.px
		p[2] = L.py
	end

	e.hovering = false
	local footZ0 = p[3] - eye
	local glide = num(r, "glideFall", 0.0)
	local fallCap = (glide > 0.0 and inp(input, "jumpHeld") ~= 0.0 and vel[3] <= 0.0) and minf(maxFall, glide) or maxFall
	vel[3] = maxf(-fallCap, vel[3] - (vel[3] > 0.0 and riseG or fallG) * dt)
	p[3] = p[3] + vel[3] * dt
	local gz1 = groundAt(g, { p[1], p[2], maxf(footZ0, p[3] - eye) + stepUp })
	if gz1 == gz1 and vel[3] <= 0.0 and p[3] - eye <= gz1 + 1e-4 then
		p[3] = gz1 + eye
		vel[3] = 0.0
		e.coyote = 0.0
		e.grounded = true
		if e.jumpBuf > 0.0 then
			vel[3] = jumpV
			e.grounded = false
			e.jumpBuf = 0.0
		end
	elseif vel[3] <= 0.0 and not e.grounded and type(g) == "table" then
		local footNow = p[3] - eye
		local climbUp = num(r, "collideHeight", eye ~= 0.0 and eye or 24.0)
		local head = groundAt(g, { p[1], p[2], footNow + climbUp })
		if head == head and head > footNow + 1e-4 and head <= footNow + climbUp + 1e-4 then
			p[3] = head + eye
			vel[3] = 0.0
			e.grounded = true
		end
	end
	e.hoverGrace = maxf(0.0, (e.hoverGrace or 0.0) - dt)

	e.jumped = jumped
	e.landed = landedEdge
	local strideLen = num(r, "stride", 2.4)
	local boostClip
	if abs(bs) > abs(bf) then
		boostClip = bs > 0.0 and "boost_right" or "boost_left"
	else
		boostClip = bf < 0.0 and "boost_back" or "boost"
	end
	local boostPhase = (abs(sideMove) > abs(fwdMove) and sideMove or fwdMove) / strideLen
	if not e.grounded then
		if boosting then
			e.locomotion = boostClip
			e.gaitPhase = (e.gaitPhase or 0.0) + boostPhase
		elseif fwdIn > 0.0 then
			e.locomotion = "boost"
			e.gaitPhase = (e.gaitPhase or 0.0) + fwdMove / strideLen
		else
			e.locomotion = "leap"
		end
		e.moving = true
	elseif (e.jumpWind or 0.0) > 0.0 then
		e.locomotion = "squat"
		e.moving = true
	elseif boosting then
		e.locomotion = boostClip
		e.gaitPhase = (e.gaitPhase or 0.0) + boostPhase
		e.moving = true
	elseif abs(fwdMove) + abs(sideMove) < 1e-6 and abs(turnAmt) > num(r, "turnStepMin", 0.0025) then
		e.locomotion = "turn"
		e.gaitPhase = (e.gaitPhase or 0.0) + turnAmt / num(r, "turnStride", 0.6)
		e.moving = true
	elseif abs(sideMove) > abs(fwdMove) then
		e.locomotion = "strafe"
		e.gaitPhase = (e.gaitPhase or 0.0) + sideMove / strideLen
		e.moving = abs(fwdMove) + abs(sideMove) > 1e-6
	else
		e.locomotion = "forward"
		e.gaitPhase = (e.gaitPhase or 0.0) + fwdMove / strideLen
		e.moving = abs(fwdMove) + abs(sideMove) > 1e-6
	end

	-- the gauge: a jump bites, the thrust drains a unit a second, a flip of the dash's direction bites; cold, it refills
	if hasGauge then
		if jumped then
			e.boost = maxf(0.0, e.boost - num(r, "jumpBoostCost", 0.8))
		end
		if boosting then
			e.boost = maxf(0.0, e.boost - dt)
			local turnCost = num(r, "boostTurnCost", 0.75)
			if turnCost > 0.0 and e.boostDir ~= nil and e.boostDir ~= boostClip then
				e.boost = maxf(0.0, e.boost - turnCost)
			end
			e.boostDir = boostClip
		else
			e.boostDir = nil
			local rr
			if truthy(e.boostLock) then
				rr = num(r, "overheatRegen", boostMax / 7.5)
			else
				rr = num(r, "boostRegen", boostMax / 5.0)
			end
			e.boost = minf(boostMax, e.boost + rr * dt)
		end
		if e.boost <= 1e-6 then
			e.boostLock = true
		elseif truthy(e.boostLock) and e.boost >= boostMax * num(r, "boostUnlockFrac", 1.0) then
			e.boostLock = false
		end
	end
end

-- ── the camera rules (rules-basic.js follow, eye, overhead, side, fixed, shot), stepped after the pilot as the web's
-- world steps its camera last. A camera is a table: pos, heading, pitch, lookAt (an { x, y, z } or nil: aim along
-- heading and pitch), and its rule's state. `tgt` is the target entity (the pilot); `tgtRule` its rule (a side camera
-- reads its lane). A follow camera's cinematic and lock tracking are the web's (roblox-marks.js names what is lost).
local function smooth(rate, dt)
	return 1.0 - exp(-maxf(0.0, rate) * dt)
end
rules.smooth = smooth

function rules.camera(pos, heading)
	return { pos = { pos[1], pos[2], pos[3] }, heading = heading, pitch = 0.0, lookAt = nil }
end

local function easeTo(c, want, k)
	local p = c.pos
	c.pos = { p[1] + (want[1] - p[1]) * k, p[2] + (want[2] - p[2]) * k, p[3] + (want[3] - p[3]) * k }
end

local function follow(c, r, tgt, dt)
	local dist = num(r, "dist", 6.0)
	local height = num(r, "height", 3.0)
	local shoulder = num(r, "shoulder", 0.0)
	local lead = num(r, "lead", 4.0)
	local lookH = num(r, "lookH", 1.5)
	local wantFlip = truthy(r.reverse) and 1.0 or 0.0
	if c.flipMix == nil then
		c.flipMix = wantFlip
	end
	c.flipMix = c.flipMix + (wantFlip - c.flipMix) * smooth(num(r, "flipRate", 3.0), dt)
	local h = tgt.heading + PI * c.flipMix
	local f = fwdXY(h)
	local rt = rightXY(h)
	local pf = num(r, "pitchFollow", 1.0)
	local pp = (tgt.pitch or 0.0) * pf * (c.flipMix > 0.5 and -1.0 or 1.0)
	local cp = cos(pp)
	local sp = sin(pp)
	local tp = tgt.pos
	local want = { tp[1] - f[1] * dist * cp + rt[1] * shoulder, tp[2] - f[2] * dist * cp + rt[2] * shoulder, tp[3] + height - dist * sp }
	local k = smooth(num(r, "lerp", 8.0), dt)
	easeTo(c, want, k)
	c.lookAt = { tp[1] + f[1] * lead * cp, tp[2] + f[2] * lead * cp, tp[3] + lookH + lead * sp }
	-- the bank (opt-in `rollFollow`): the chase rolls with a target that rolls (the fly rule's tilt), eased on the same
	-- lerp; absent, `roll` is never set
	local rf = num(r, "rollFollow", 0.0)
	if rf ~= 0.0 then
		local tl = tgt.tilt
		local tr = type(tl) == "table" and num(tl, "roll", 0.0) or 0.0
		c.roll = (c.roll or 0.0) + (tr * rf - (c.roll or 0.0)) * k
	end
end

local function overhead(c, r, tgt, dt)
	local yaw = num(r, "yaw", HALF_PI)
	local tilt = clampf(num(r, "tilt", PI / 3.0), 0.2, 1.45)
	local dist = num(r, "dist", 14.0)
	local lookH = num(r, "lookH", 1.0)
	local f = fwdXY(yaw)
	local co = cos(tilt)
	local si = sin(tilt)
	local p = tgt.pos
	easeTo(c, { p[1] - f[1] * dist * co, p[2] - f[2] * dist * co, p[3] + lookH + dist * si }, smooth(num(r, "lerp", 8.0), dt))
	c.heading = yaw
	c.lookAt = { p[1], p[2], p[3] + lookH }
end

local function side(c, r, tgt, tgtRule, dt)
	local p = tgt.pos
	local lane = tgtRule.lane
	local want = num(r, "yaw", HALF_PI)
	if isList(lane) and #lane >= 2 then
		local L = laneNear(lane, p[1], p[2])
		want = atan2(L.ty, L.tx) + HALF_PI
	end
	if c._sideYaw == nil then
		c._sideYaw = want
	end
	local d = wrapPi(want - c._sideYaw)
	c._sideYaw = c._sideYaw + d * smooth(num(r, "turnLerp", 2.5), dt)
	local yaw = c._sideYaw
	local tilt = clampf(num(r, "tilt", 0.2), 0.0, 1.2)
	local dist = num(r, "dist", 11.0)
	local lookH = num(r, "lookH", 1.2)
	local f = fwdXY(yaw)
	local co = cos(tilt)
	local si = sin(tilt)
	easeTo(c, { p[1] - f[1] * dist * co, p[2] - f[2] * dist * co, p[3] + lookH + dist * si }, smooth(num(r, "lerp", 8.0), dt))
	c.heading = yaw
	c.lookAt = { p[1], p[2], p[3] + lookH }
end

local function fixed(c, r, tgt)
	local S = r.stations
	if not isList(S) or #S == 0 then
		return
	end
	local p = tgt.pos
	local function d(s)
		return hypot(s.focus[1] - p[1], s.focus[2] - p[2])
	end
	-- _fixedAt is the station's 0-based index, as the web holds it
	local at = c._fixedAt
	local k = (at ~= nil and at < #S) and at or 0
	for i = 0, #S - 1 do
		if d(S[i + 1]) < d(S[k + 1]) - (i == k and 0.0 or num(r, "hold", 1.5)) then
			k = i
		end
	end
	if at == nil then
		k = 0
		for i = 1, #S - 1 do
			if d(S[i + 1]) < d(S[k + 1]) then
				k = i
			end
		end
	end
	c._fixedAt = k
	local st = S[k + 1]
	local u = num(r, "track", 0.6)
	local lookH = num(r, "lookH", 1.0)
	local fo = st.focus
	local fz = (#fo > 2 and type(fo[3]) == "number") and fo[3] or p[3]
	c.lookAt = { fo[1] + (p[1] - fo[1]) * u, fo[2] + (p[2] - fo[2]) * u, fz + (p[3] - fz) * u + lookH }
	local sa = st.at
	c.pos = { sa[1], sa[2], sa[3] }
	c.heading = atan2(c.lookAt[2] - sa[2], c.lookAt[1] - sa[1])
end

-- the nearest of the land's triangles along a ray from `from` (direction `dir`, unit) within `far`; `far` when none
-- (the page's chase camera pull-in casts its ray at the level's meshes, as this casts it at the faces the ground stands
-- on). The hit is Möller–Trumbore with Godot's epsilons, in doubles (Godot's Vector3 is single precision).
local function rayTri(o, dv, a, b, c)
	local e1 = { b[1] - a[1], b[2] - a[2], b[3] - a[3] }
	local e2 = { c[1] - a[1], c[2] - a[2], c[3] - a[3] }
	local h = { dv[2] * e2[3] - dv[3] * e2[2], dv[3] * e2[1] - dv[1] * e2[3], dv[1] * e2[2] - dv[2] * e2[1] }
	local det = e1[1] * h[1] + e1[2] * h[2] + e1[3] * h[3]
	if abs(det) < 1e-5 then
		return nil
	end
	local f = 1.0 / det
	local s = { o[1] - a[1], o[2] - a[2], o[3] - a[3] }
	local u = f * (s[1] * h[1] + s[2] * h[2] + s[3] * h[3])
	if u < 0.0 or u > 1.0 then
		return nil
	end
	local q = { s[2] * e1[3] - s[3] * e1[2], s[3] * e1[1] - s[1] * e1[3], s[1] * e1[2] - s[2] * e1[1] }
	local v = f * (dv[1] * q[1] + dv[2] * q[2] + dv[3] * q[3])
	if v < 0.0 or u + v > 1.0 then
		return nil
	end
	local t = f * (e2[1] * q[1] + e2[2] * q[2] + e2[3] * q[3])
	if t > 1e-5 then
		return t
	end
	return nil
end

function rules.rayLand(g, from, dir, far)
	if type(g) ~= "table" or far <= 0.0 or g.grid == nil then
		return far
	end
	local seen = {}
	local best = far
	local o = { from[1], from[2], from[3] }
	local dv = { dir[1], dir[2], dir[3] }
	local dlen = sqrt(dv[1] * dv[1] + dv[2] * dv[2] + dv[3] * dv[3])
	local steps = math.ceil(far / (CELL * 0.5)) + 1
	for s = 0, steps do
		local m = minf(far, s * CELL * 0.5)
		local qx, qy = o[1] + dv[1] * m, o[2] + dv[2] * m
		local list = candidates(g, floor(qx / CELL), floor(qy / CELL))
		if list ~= nil then
			for _, k in ipairs(list) do
				if not seen[k] then
					seen[k] = true
					local t = g.tris[k]
					local hit = rayTri(o, dv, t[1], t[2], t[3])
					if hit then
						best = minf(best, hit * dlen)
					end
				end
			end
		end
	end
	return best
end

-- ── shot — the DIRECTING camera (the scene layer, rules-basic.js shot): it frames the characters `on` and the places
-- `at` by a word (`frame`), opening until they fill a `fov`, never under the ground; `move` holds, tracks, pushes or
-- orbits; a new shot cuts (the cast op `shot` resets its state: rules.setShot). Its clear-view search samples the land
-- along the line to the subjects, as the page's.
local FRAMES = { wide = { 5.0, 2.2, 0.0 }, low = { 1.6, -0.8, 0.0 }, profile = { 1.2, 0.2, 1.0 }, corner = { 3.0, 3.5, 0.5 }, overhead = { 2.5, 0.0, 0.0 }, two = { 0.8, 0.35, 0.0 }, close = { 0.35, 0.1, 0.25 } }
local LIFTS = { 0.0, 1.5, 3.5 }
local SWINGS = { 0.0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2 }

local function top(world, x, y)
	return groundAt(world.ground, { x, y, 1e4 })
end

-- a cut lands at once; else the camera eases in at `lerp` (the over and lone-place shots set their own _shotAt after)
local function shotPlace(c, at, lerp, dt)
	if truthy(c._shotCut) or c._shotAt == nil then
		c.pos = { at[1], at[2], at[3] }
		c._shotCut = false
	else
		easeTo(c, at, smooth(lerp, dt))
	end
end

local function shot(c, r, dt, world, byId, pilot)
	local subs = {}
	if isList(r.on) then
		for _, id in ipairs(r.on) do
			local s = byId[js.str(id)]
			if type(s) == "table" and not truthy(s.gone) then
				table.insert(subs, { pos = s.pos, heading = s.heading, place = false })
			end
		end
	end
	if isList(r.at) then
		for _, p in ipairs(r.at) do
			local z = nil
			if #p > 2 and not nullish(p[3]) then
				z = p[3]
			end
			if z == nil then
				local g = top(world, p[1], p[2])
				z = g ~= g and 0.0 or g
			end
			table.insert(subs, { pos = { p[1], p[2], z }, heading = nil, place = true })
		end
	end
	if #subs == 0 then
		return
	end
	local cx, cy, cz = 0.0, 0.0, 0.0
	for _, s in ipairs(subs) do
		cx += s.pos[1]
		cy += s.pos[2]
		cz += s.pos[3]
	end
	cx /= #subs
	cy /= #subs
	cz = cz / #subs + num(r, "lookH", 1.4)
	local spread = 0.0
	for _, s in ipairs(subs) do
		spread = maxf(spread, hypot(s.pos[1] - cx, s.pos[2] - cy))
	end
	c._shotT = (c._shotT or 0.0) + dt
	local lerp = num(r, "lerp", 3.0)
	if r.frame == "over" and #subs >= 2 then
		local A, B = subs[1].pos, subs[2].pos
		local sd = num(r, "side", 1.0)
		local lh = num(r, "lookH", 1.4)
		local yaw = atan2(B[2] - A[2], B[1] - A[1])
		local f = fwdXY(yaw)
		local rt = rightXY(yaw)
		local at = { B[1] + f[1] * 1.1 + rt[1] * 0.45 * sd, B[2] + f[2] * 1.1 + rt[2] * 0.45 * sd, B[3] + lh + 0.15 }
		shotPlace(c, at, lerp, dt)
		c._shotAt = at
		c.heading = yaw + PI
		c.lookAt = { A[1], A[2], A[3] + lh }
		return
	end
	local fr = FRAMES[type(r.frame) == "string" and r.frame or ""] or FRAMES.wide
	local room, rise, off = fr[1], fr[2], fr[3]
	if nullish(r.side) and c._shotSide == nil and #subs >= 2 then
		local a, b = subs[1].pos, subs[2].pos
		local u = atan2(b[2] - a[2], b[1] - a[1]) - HALF_PI
		local toCam = (c.pos[1] - cx) * cos(u) + (c.pos[2] - cy) * sin(u)
		c._shotSide = toCam >= 0.0 and 1.0 or -1.0
	end
	local sd = num(r, "side", c._shotSide ~= nil and c._shotSide or 1.0)
	local face = 0.0
	if #subs >= 2 then
		local a, b = subs[1].pos, subs[2].pos
		face = atan2(b[2] - a[2], b[1] - a[1]) - HALF_PI * sd
	elseif subs[1].place then
		-- a lone place: the pilot's view of it, from just behind and above the pilot
		local P = byId[pilot]
		if type(P) == "table" and r.frame ~= "overhead" then
			local p = P.pos
			local a = subs[1].pos
			local yaw = atan2(a[2] - p[2], a[1] - p[1])
			local f = fwdXY(yaw)
			local at = { p[1] - f[1] * 3.0, p[2] - f[2] * 3.0, p[3] + 2.4 }
			shotPlace(c, at, lerp, dt)
			c._shotAt = at
			c.heading = yaw
			c.lookAt = { a[1], a[2], a[3] + num(r, "lookH", 1.4) }
			return
		end
		face = 0.0
	else
		local h = subs[1].heading
		face = type(h) == "number" and h or 0.0
	end
	local yaw = num(r, "yaw", face) + off * HALF_PI * sd
	if r.move == "orbit" then
		yaw += num(r, "rate", 0.25) * c._shotT
	end
	local dist = maxf(1.2, (spread + room) / tan((num(r, "fov", 50.0) * PI) / 360.0))
	if r.move == "push" then
		dist *= 1.0 + 0.35 * (1.0 - minf(1.0, c._shotT / num(r, "for", 3.0)))
	end
	local isOverhead = r.frame == "overhead"
	local function place(y, lift)
		local f = fwdXY(y)
		local at
		if isOverhead then
			at = { cx + f[1] * dist * 0.3, cy + f[2] * dist * 0.3, cz + dist }
		else
			at = { cx + f[1] * dist, cy + f[2] * dist, cz + rise + lift }
		end
		local g = top(world, at[1], at[2])
		if g == g and at[3] < g + 0.8 then
			at[3] = g + 0.8
		end
		return at
	end
	if c._shotTry == nil then
		c._shotTry = { 0.0, 0.0 }
		if type(world.ground) == "table" then
			local found = false
			for _, lift in ipairs(LIFTS) do
				for _, dy in ipairs(SWINGS) do
					local at = place(yaw + dy, lift)
					local clear = true
					for k = 1, 7 do
						local u = k / 8.0
						local x = at[1] + (cx - at[1]) * u
						local y = at[2] + (cy - at[2]) * u
						local z = at[3] + (cz - at[3]) * u
						local g = top(world, x, y)
						if g == g and g > z - 0.3 then
							clear = false
							break
						end
					end
					if clear then
						c._shotTry = { dy, lift }
						found = true
						break
					end
				end
				if found then
					break
				end
			end
		end
	end
	local at = place(yaw + c._shotTry[1], c._shotTry[2])
	if c._shotAt == nil or (truthy(r.move) and r.move ~= "hold") then
		c._shotAt = at
	end
	if truthy(c._shotCut) then
		c.pos = { c._shotAt[1], c._shotAt[2], c._shotAt[3] }
		c._shotCut = false
	else
		easeTo(c, c._shotAt, smooth(lerp, dt))
	end
	c.heading = atan2(cy - c.pos[2], cx - c.pos[1])
	c.lookAt = { cx, cy, cz }
end

-- `byId`: the level's characters ({ pos, heading, gone }) by id, the pilot among them, for a directing shot; `pilot` its id
function rules.cameraStep(c, r, tgt, tgtRule, dt, world, byId, pilot)
	local t = r.type
	if t == "shot" then
		shot(c, r, dt, world, byId or {}, pilot or "")
	elseif t == "follow" then
		follow(c, r, tgt, dt)
	elseif t == "eye" then
		local p = tgt.pos
		c.pos = { p[1], p[2], p[3] + num(r, "height", 0.0) }
		c.heading = tgt.heading
		c.pitch = tgt.pitch or 0.0
		c.lookAt = nil
	elseif t == "overhead" then
		overhead(c, r, tgt, dt)
	elseif t == "side" then
		side(c, r, tgt, tgtRule, dt)
	elseif t == "fixed" then
		fixed(c, r, tgt)
	end
end

-- the cast op `shot`: the camera's rule held aside for a directing shot (its state reset; a cut unless `cut: false`);
-- `unshot` hands the held rule back. → the rule now in force
function rules.setShot(c, current, shotRule)
	if c.heldRule == nil then
		c.heldRule = current
	end
	c._shotT = 0.0
	c._shotAt = nil
	c._shotSide = nil
	c._shotTry = nil
	c._shotCut = not (isDict(shotRule) and shotRule.cut == false)
	local r = js.dup(shotRule)
	r.type = "shot"
	return r
end

function rules.unshot(c, current)
	local held = c.heldRule
	if type(held) == "table" then
		c.heldRule = nil
		return held
	end
	return current
end

-- ── drive — a designed vehicle you board and drive (rules-drive.js) ─────────────────────────────────────────────────
local driveFly

function rules.drive(e, r, input, dt, world)
	local p = e.pos
	local mass = posNum(r, "mass", 1400.0)
	local powerN = posNum(r, "horsepower", 130.0) * 745.7
	local S = nil
	if truthy(r.surfaceGrip) and type(world.surface) == "function" then
		S = world.surface(p)
	end
	local soft = posNum(r, "surfaceSoft", 1.0)
	local grip = posNum(r, "grip", 1.0) * (S ~= nil and (1.0 - (1.0 - S.mu) * soft) or 1.0) * posNum(r, "muScale", 1.0)
	local tractionCap = grip * mass * G * posNum(r, "drivenShare", 1.0)
	local brake0 = posNum(r, "brakeForce", mass * G * 0.8)
	local brakeForce = posNum(r, "brakeEff", 0.0) > 0.0 and minf(brake0, grip * mass * G * r.brakeEff) or brake0
	local dragK = num(r, "drag", 0.42)
	local rollForce = num(r, "rollResist", 0.015) * mass * G * (S ~= nil and (1.0 + (S.roll - 1.0) * soft) or 1.0)
	local airborne = truthy(r.air) and truthy(e.airborne)
	local wheelbase = posNum(r, "wheelbase", 2.8)
	local wheelR = posNum(r, "wheelRadius", 0.33)
	local reverseSpeed = posNum(r, "reverseSpeed", 6.0)
	local steerMax = num(r, "steerMax", 0.55)
	local steerSpeed = num(r, "steerSpeed", 2.5)
	local vFloor = posNum(r, "vFloor", 2.0)
	local eye = num(r, "eye", 0.0)
	local v = e.speed or 0.0
	local throttle = clampf(inp(input, "forward"), 0.0, 1.0)
	local brakeIn = clampf(-inp(input, "forward"), 0.0, 1.0)
	local F = 0.0
	local braking = false
	if airborne then
		-- no wheel on the ground: no drive, no brake
	elseif throttle > 0.0 then
		if v >= -1e-3 then
			F = minf(powerN / maxf(abs(v), vFloor), tractionCap) * throttle
		else
			F = brakeForce * throttle
			braking = true
		end
	elseif brakeIn > 0.0 then
		if v > 1e-3 then
			F = -brakeForce * brakeIn
			braking = true
		else
			F = -minf(powerN / maxf(abs(v), vFloor), tractionCap) * brakeIn
		end
	end
	local resist = dragK * v * abs(v) + ((not airborne and abs(v) > 1e-3) and rollForce * signf(v) or 0.0)
	local v0 = v
	v += ((F - resist) / mass) * dt
	if F == 0.0 and v0 ~= 0.0 and signf(v) ~= signf(v0) then
		v = 0.0
	end
	if F == 0.0 and abs(v) < 0.15 then
		v = 0.0
	end
	v = clampf(v, -reverseSpeed, posNum(r, "topSpeed", INF))
	local effMax = steerMax / (1.0 + abs(v) * num(r, "steerTighten", 0.03))
	if truthy(r.lateralGrip) and abs(v) > 1.0 then
		effMax = minf(effMax, atan((grip * G * wheelbase) / (v * v)))
	end
	local steerTarget = clampf(-inp(input, "turn"), -1.0, 1.0) * effMax
	local sa = e.steerAngle or 0.0
	e.steerAngle = sa + clampf(steerTarget - sa, -steerSpeed * dt, steerSpeed * dt)
	if not airborne then
		e.heading = fmod(e.heading + (v / wheelbase) * tan(e.steerAngle) * dt, TAU)
	end
	local f = fwdXY(e.heading)
	p[1] = p[1] + f[1] * v * dt
	p[2] = p[2] + f[2] * v * dt
	local cols = colliderList(world)
	if cols then
		resolveBlocking(p, p[3] - eye, num(r, "collideHeight", 3.0), num(r, "collideRadius", 0.0), cols, num(r, "step", 0.3))
	end
	local gz = groundAt(world.ground, { p[1], p[2], (p[3] - eye) + num(r, "collideHeight", 3.0) })
	if gz == gz and truthy(r.air) then
		v = driveFly(e, r, gz + eye, v, f, dt, world)
	elseif gz == gz then
		local want = gz + eye
		if want < p[3] then
			p[3] = maxf(want, p[3] - num(r, "fallRate", 25.0) * dt)
		else
			p[3] = want
		end
	end
	e.speed = v
	e.wheelPhase = (e.wheelPhase or 0.0) + v * dt / (TAU * wheelR)
	e.wheelSpin = v / (TAU * wheelR)
	e.throttle = throttle
	e.brakeStart = braking and not truthy(e.braking)
	e.braking = braking
	local lat = (v * v * abs(tan(e.steerAngle))) / wheelbase
	local skid = lat > grip * G
	e.skidStart = skid and not truthy(e.skidding)
	e.skidding = skid
	e.boarded = not truthy(e._driven)
	e._driven = true
	e.locomotion = "drive"
	e.gaitPhase = e.wheelPhase
	e.moving = abs(v) > 1e-3
	if r.wheels == 2 then
		e.lean = atan((v * v * tan(e.steerAngle)) / (wheelbase * G))
	end
end

-- FLIGHT (opt-in `air`): off a ramp's lip or a crest the ground falls away faster than gravity takes the car; it flies
-- ballistic and lands keeping the speed along the landing. → the speed after
function driveFly(e, r, want, v, f, dt, world)
	local p = e.pos
	local z0 = p[3]
	local vz = e.vz or 0.0
	local ballistic = z0 + vz * dt - 0.5 * G * dt * dt
	local eye = num(r, "eye", 0.0)
	local topZ = want - eye + num(r, "collideHeight", 3.0)
	local dir = v < 0.0 and -1.0 or 1.0
	local sp = abs(v)
	local g = world.ground
	local function gAt(d)
		local z = groundAt(g, { p[1] + f[1] * d * dir, p[2] + f[2] * d * dir, topZ })
		if z ~= z then
			return NAN
		end
		return z + eye
	end
	e.landed = false
	if truthy(e.airborne) then
		e.vz = vz - G * dt
		e.airT = (e.airT or 0.0) + dt
		if ballistic > want then
			p[3] = ballistic
			return v
		end
		local ahead = gAt(1.0)
		local slope = ahead ~= ahead and 0.0 or ahead - want
		local keep = maxf(cos(atan2(vz, sp) - atan(slope)), posNum(r, "landKeep", 0.0))
		p[3] = want
		e.airborne = false
		e.landed = true
		e.airTime = e.airT
		e.landLoss = 1.0 - keep
		e.vz = sp * keep * slope
		e.vzs = e.vz
		return v * keep
	end
	local b2 = gAt(-0.2)
	local b1 = gAt(-1.0)
	local vzLip = b2 == b2 and sp * (want - b2) / 0.2 or (want - z0) / dt
	local vzS = b1 == b1 and sp * (want - b1) or vzLip
	local az = e.vzs == nil and 0.0 or (vzS - e.vzs) / dt
	if want < ballistic - 0.003 and sp > 1.0 then
		local function onRamp(d)
			local a = gAt(d)
			local b = gAt(d - 0.05)
			return a == a and b == b and a - b > -0.02
		end
		local lo = -sp * dt - 0.05
		local hi = 0.0
		if onRamp(lo) then
			for _ = 1, 10 do
				local m = (lo + hi) / 2.0
				if onRamp(m) then
					lo = m
				else
					hi = m
				end
			end
			local za = gAt(lo - 0.03)
			local zb = gAt(lo - 0.23)
			local slope = (za == za and zb == zb) and (za - zb) / 0.2 or vz / sp
			local zl = (za ~= za and want or za) + slope * 0.03
			local vzl = clampf(sp * slope, -50.0, sp * 0.8)
			local tau = -lo / sp
			p[3] = maxf(zl + vzl * tau - 0.5 * G * tau * tau, want)
			e.vz = vzl - G * tau
		else
			p[3] = maxf(ballistic, want)
			e.vz = vz - G * dt
		end
		e.airborne = true
		e.airT = 0.0
		e.vzs = nil
		return v
	end
	if az < -G then
		p[3] = maxf(ballistic, want)
		e.airborne = true
		e.airT = 0.0
		e.vz = vz - G * dt
		e.vzs = nil
		return v
	end
	e.vz = clampf(vzLip, -50.0, sp * 0.8)
	e.vzs = vzS
	p[3] = want
	return v
end

-- ── racer — a driver no one pilots: the same drive, its stick moved by the road ahead (rules-drive.js racer) ────────
-- lineAt is the 0-based index the web keeps (and the snapshot prints)
local function lineAt(L, closed, i)
	local n = #L
	if closed then
		return L[((i % n) + n) % n + 1]
	end
	return L[math.min(i, n - 1) + 1]
end

function rules.racer(e, r, dt, world)
	local L = isList(r.line) and r.line or {}
	local n = #L
	if n == 0 or world.aiEnabled == false then
		rules.drive(e, r, { forward = 0.0, turn = 0.0 }, dt, world)
		return
	end
	local closed = truthy(r.closed)
	local p = e.pos
	if e.lineAt == nil then
		local best = 0
		local bd = INF
		for i = 0, n - 1 do
			local d = hypot(L[i + 1][1] - p[1], L[i + 1][2] - p[2])
			if d < bd then
				bd = d
				best = i
			end
		end
		local f = fwdXY(e.heading)
		local q = L[best + 1]
		e.lineAt = ((q[1] - p[1]) * f[1] + (q[2] - p[2]) * f[2] < 0.0) and best + 1 or best
		e.laps = 0
		e.stuckT = 0.0
		e.backT = 0.0
	end
	local reach = posNum(r, "reach", 4.0)
	for _ = 1, n do
		local pt = lineAt(L, closed, e.lineAt)
		local nx = lineAt(L, closed, e.lineAt + 1)
		local d = hypot(pt[1] - p[1], pt[2] - p[2])
		local passed = (p[1] - pt[1]) * (nx[1] - pt[1]) + (p[2] - pt[2]) * (nx[2] - pt[2]) > 0.0
		if not (d < reach or (passed and d < reach * 3.0)) then
			break
		end
		if not closed and e.lineAt >= n - 1 then
			break
		end
		e.lineAt = e.lineAt + 1
		if closed and e.lineAt % n == 0 then
			e.laps = e.laps + 1
		end
	end
	local look = trunc(posNum(r, "look", 3.0))
	local a = lineAt(L, closed, e.lineAt + look - 1)
	local b = lineAt(L, closed, e.lineAt + look)
	local dl = hypot(b[1] - a[1], b[2] - a[2])
	if dl == 0.0 then
		dl = 1.0
	end
	local lane = num(r, "lane", 0.0)
	local aim = { b[1] - ((b[2] - a[2]) / dl) * lane, b[2] + ((b[1] - a[1]) / dl) * lane }
	local err = atan2(aim[2] - p[2], aim[1] - p[1]) - e.heading
	err = wrapPi(err)
	local c = lineAt(L, closed, e.lineAt + look * 2)
	local h1 = atan2(b[2] - a[2], b[1] - a[1])
	local h2 = atan2(c[2] - b[2], c[1] - b[1])
	local bend = abs(wrapPi(h2 - h1))
	local v = e.speed or 0.0
	local pace = posNum(r, "pace", 1.0)
	local corner = posNum(r, "corner", 9.0)
	local forward = pace
	if bend > 0.25 and v > corner / bend then
		forward = -0.6
	elseif abs(err) > 0.6 and v > corner then
		forward = 0.0
	end
	if truthy(r.lateralGrip) then
		local Sg = nil
		if truthy(r.surfaceGrip) and type(world.surface) == "function" then
			Sg = world.surface(p)
		end
		local mu = posNum(r, "grip", 1.0) * posNum(r, "muScale", 1.0) * (Sg ~= nil and Sg.mu or 1.0) * 0.9
		local aB = mu * G * posNum(r, "brakeEff", 0.8)
		local want = INF
		local pNow = lineAt(L, closed, e.lineAt)
		local d = hypot(pNow[1] - p[1], pNow[2] - p[2])
		local k = 0
		while k < 60 and d < (v * v) / (2.0 * aB) + 30.0 do
			local p0 = lineAt(L, closed, e.lineAt + k - 2)
			local p1 = lineAt(L, closed, e.lineAt + k)
			local p2 = lineAt(L, closed, e.lineAt + k + 2)
			local ab = hypot(p1[1] - p0[1], p1[2] - p0[2])
			local bc = hypot(p2[1] - p1[1], p2[2] - p1[2])
			local ac = hypot(p2[1] - p0[1], p2[2] - p0[2])
			local kap = 0.0
			if ab ~= 0.0 and bc ~= 0.0 and ac ~= 0.0 then
				kap = abs(2.0 * ((p1[1] - p0[1]) * (p2[2] - p1[2]) - (p1[2] - p0[2]) * (p2[1] - p1[1]))) / (ab * bc * ac)
			end
			if kap > 1e-4 then
				want = minf(want, sqrt((mu * G) / kap + 2.0 * aB * d))
			end
			local q = lineAt(L, closed, e.lineAt + k + 1)
			d += hypot(q[1] - p1[1], q[2] - p1[2])
			k += 1
		end
		local toAim = hypot(aim[1] - p[1], aim[2] - p[2])
		if abs(err) > 0.35 then
			want = minf(want, sqrt((mu * G * toAim) / (2.0 * sin(minf(abs(err), PI / 2.0)))))
		end
		if v > want then
			forward = -1.0
		elseif v > want * 0.97 then
			forward = 0.0
		else
			forward = pace
		end
	end
	if isList(r.ramps) then
		for _, q in ipairs(r.ramps) do
			local dx = q.at[1] - p[1]
			local dy = q.at[2] - p[2]
			local fw = fwdXY(e.heading)
			local aimV = (not nullish(q.lo)) and (q.lo + q.hi) / 2.0 or q.hi
			local reachB = (v * v - aimV * aimV) / (2.0 * 6.0) + 15.0
			if dx * fw[1] + dy * fw[2] > 0.0 and hypot(dx, dy) < maxf(15.0, reachB) and v > aimV then
				forward = minf(forward, v > aimV + 0.4 and -1.0 or 0.0)
			end
		end
	end
	if e.backT > 0.0 then
		e.backT = e.backT - dt
		rules.drive(e, r, { forward = -1.0, turn = clampf(err * 2.0, -1.0, 1.0) }, dt, world)
		return
	end
	e.stuckT = (forward > 0.0 and abs(v) < 0.5) and e.stuckT + dt or 0.0
	if e.stuckT > 1.0 then
		e.stuckT = 0.0
		e.backT = 1.0
	end
	rules.drive(e, r, { forward = forward, turn = clampf(-err * 2.5, -1.0, 1.0) }, dt, world)
end

-- ── fly — fixed-wing flight (rules-fly.js) ─────────────────────────────────────────────────────────────────────────
function rules.fly(e, r, input, dt, world)
	local p = e.pos
	local mass = posNum(r, "mass", 1200.0)
	-- the flight dials (the web's skyscape: one flight model under every flight game); each absent, as it was
	local maxThrust = r.engine == false and 0.0 or posNum(r, "thrust", mass * 6.0)
	local grav = r.gravity ~= false
	local lifts = r.lift ~= false
	local dragK = num(r, "drag", 0.6)
	local vStall = posNum(r, "stallSpeed", 18.0)
	local vTakeoff = posNum(r, "takeoffSpeed", js.round(vStall * 1.25))
	local vMax = posNum(r, "maxSpeed", 80.0)
	local bankMax = num(r, "bankMax", 1.0)
	local bankRate = num(r, "bankRate", 1.8)
	local levelRate = num(r, "levelRate", 0.9)
	local pitchMax = num(r, "pitchMax", 0.6)
	local pitchRate = num(r, "pitchRate", 1.1)
	local lookSens = num(r, "lookSens", 0.0025)
	local eye = num(r, "eye", 0.0)
	-- launchSpeed: a craft that starts flying (a glider aloft)
	local v
	if e.airspeed ~= nil then
		v = e.airspeed
	elseif truthy(r.launchSpeed) then
		v = r.launchSpeed
	else
		v = 0.0
	end
	local throttle = clampf(inp(input, "forward"), 0.0, 1.0)
	local brakeIn = clampf(-inp(input, "forward"), 0.0, 1.0)
	if truthy(r.lever) then
		-- the lever: W / S move it and it stays; S held at idle is the brakes (on the ground, the wheels)
		local was
		if e.lever ~= nil then
			was = e.lever
		elseif truthy(r.leverStart) then
			was = r.leverStart
		else
			was = 0.0
		end
		e.lever = clampf(was + inp(input, "forward") * num(r, "leverRate", 0.6) * dt, 0.0, 1.0)
		throttle = e.lever
		brakeIn = (was <= 0.0 and inp(input, "forward") < 0.0) and clampf(-inp(input, "forward"), 0.0, 1.0) or 0.0
	end
	local gz = NAN
	if grav or truthy(r.space) then
		gz = groundAt(world.ground, { p[1], p[2], (p[3] - eye) + num(r, "collideHeight", 3.0) })
	end
	local onGround = gz == gz and p[3] - eye <= gz + 0.05
	local wasAirborne = truthy(e.airborne)
	-- the boost (opt-in): input.boost held multiplies thrust while its charge lasts, refilled when let go
	local boostMul = 1.0
	if truthy(r.boost) then
		local B = isDict(r.boost) and r.boost or {}
		local full = num(B, "time", 3.0)
		if e.boostE == nil then
			e.boostE = full
		end
		e.boosting = truthy(input.boost) and e.boostE > 0.0 and maxThrust > 0.0
		if e.boosting then
			boostMul = num(B, "thrust", 2.0)
			e.boostE = maxf(0.0, e.boostE - dt)
		else
			e.boostE = minf(full, e.boostE + num(B, "recharge", 0.5) * dt)
		end
	end
	local force = maxThrust * throttle * boostMul - dragK * v * v
	if brakeIn > 0.0 then
		force -= (num(r, "brakeDrag", dragK * 5.0) * v * v + (onGround and num(r, "wheelBrake", mass * G * 0.5) or 0.0)) * brakeIn
	end
	local a = force / mass
	if not onGround and grav then
		a -= G * sin(e.pitch or 0.0)
	end
	v = clampf(v + a * dt, 0.0, vMax)
	if onGround and throttle == 0.0 and brakeIn == 0.0 and v < 0.4 then
		v = 0.0
	end
	local bankIn = clampf(inp(input, "turn"), -1.0, 1.0)
	local liftIn = inp(input, "lift")
	-- the bound: warned outside the map's reach, then turned back toward its centre
	if isDict(r.bound) then
		local Bd = r.bound
		local cx = num0(Bd, "cx")
		local cy = num0(Bd, "cy")
		local cz = num0(Bd, "cz")
		local hz = num0(Bd, "hz")
		local out = abs(p[1] - cx) > Bd.hx or abs(p[2] - cy) > Bd.hy or (hz > 0.0 and abs(p[3] - cz) > hz)
		if out then
			e.boundT = (truthy(e.boundT) and e.boundT or 0.0) + dt
		else
			e.boundT = 0.0
		end
		e.outOfBounds = out
		if out and e.boundT > num(Bd, "warn", 5.0) then
			local d = atan2(cy - p[2], cx - p[1]) - e.heading
			d = fmod(fmod(d, TAU) + TAU + PI, TAU) - PI
			bankIn = clampf(-2.0 * d, -1.0, 1.0)
			local toward = 0.0
			if hz > 0.0 then
				toward = clampf(atan2(cz - p[3], hypot(cx - p[1], cy - p[2])), -pitchMax, pitchMax)
			end
			liftIn = clampf(3.0 * (toward - (e.pitch or 0.0)), -1.0, 1.0)
		end
	end
	-- the assist: slow, an arcade craft's nose will not come up (it is eased down below, and it never stalls)
	local assist = (r.assist == "arcade" or r.assist == "sim") and r.assist or nil
	local guarded = assist == "arcade" and not onGround and lifts and grav and v < vStall * 1.2
	if guarded and liftIn > 0.0 then
		liftIn = 0.0
	end
	local stalled = false
	if onGround and v < vTakeoff then
		e.heading = fmod(e.heading - bankIn * num(r, "taxiTurn", 1.1) * minf(1.0, v / vTakeoff) * dt, TAU)
		local bk = e.bank or 0.0
		e.bank = bk - clampf(bk, -levelRate * 2.0 * dt, levelRate * 2.0 * dt)
		local pt = e.pitch or 0.0
		e.pitch = pt - clampf(pt, -pitchRate * dt, pitchRate * dt)
	else
		e.bank = clampf((e.bank or 0.0) + bankIn * bankRate * dt, -bankMax, bankMax)
		if bankIn == 0.0 and assist ~= "sim" then
			local lr = levelRate * (assist == "arcade" and 2.0 or 1.0)
			e.bank = e.bank - clampf(e.bank, -lr * dt, lr * dt)
		end
		local turn
		if lifts then
			turn = (G / maxf(v, vStall)) * tan(e.bank)
		else
			turn = num(r, "turnRate", 1.2) * e.bank / bankMax
		end
		e.heading = fmod(e.heading - turn * dt, TAU)
		local warned = isDict(r.bound) and (e.boundT or 0.0) > num(r.bound, "warn", 5.0)
		e.pitch = clampf((e.pitch or 0.0) + (warned and 0.0 or inp(input, "lookDY") * lookSens) + liftIn * pitchRate * dt, -pitchMax, pitchMax)
		if guarded and e.pitch > -0.05 then
			e.pitch = e.pitch - minf(0.5 * pitchRate * dt, e.pitch + 0.05)
		end
		if not onGround and lifts and grav and v < vStall and assist ~= "arcade" then
			stalled = true
			e.pitch = maxf(-pitchMax, e.pitch - num(r, "stallDrop", 0.8) * dt)
		end
	end
	local pathPitch = (onGround and v < vTakeoff) and 0.0 or (e.pitch or 0.0)
	local dir = { cos(pathPitch) * cos(e.heading), cos(pathPitch) * sin(e.heading), sin(pathPitch) }
	p[1] = p[1] + dir[1] * v * dt
	p[2] = p[2] + dir[2] * v * dt
	local vz = (onGround and pathPitch <= 0.0) and 0.0 or dir[3] * v
	if not onGround and stalled and grav then
		vz -= num(r, "sinkRate", 6.0) * (1.0 - v / vStall)
	end
	p[3] = p[3] + vz * dt
	local airborne
	if gz == gz then
		local surf = gz + eye
		if p[3] <= surf + 0.05 then
			p[3] = surf
			airborne = false
		else
			airborne = p[3] > surf + 0.1 or wasAirborne
		end
	else
		airborne = true
	end
	e.takeoff = airborne and not wasAirborne
	e.touchdown = not airborne and wasAirborne
	e.airborne = airborne
	e.airspeed = v
	e.throttle = throttle
	e.climbRate = airborne and vz or 0.0
	e.stallStart = stalled and not truthy(e.stalled)
	e.stalled = stalled
	-- the barrel roll (opt-in): a strafe press rolls the craft a full turn over `time` s, carrying it `side` m that
	-- way, untouchable while it rolls
	local spin = 0.0
	if truthy(r.roll) and airborne then
		local R = isDict(r.roll) and r.roll or {}
		local T = num(R, "time", 0.7)
		local sIn = signf(inp(input, "strafe"))
		if (e.rollCd or 0.0) > 0.0 then
			e.rollCd = maxf(0.0, e.rollCd - dt)
		end
		if not ((e.rollT or 0.0) > 0.0) and sIn ~= 0.0 and not truthy(e.strafePrev) and not ((e.rollCd or 0.0) > 0.0) then
			e.rollT = T
			e.rollDir = sIn
			e.rollCd = num(R, "cooldown", 1.5)
		end
		if (e.rollT or 0.0) > 0.0 then
			local stp = minf(dt, e.rollT)
			local sd = num(R, "side", 30.0) / T
			p[1] = p[1] + sin(e.heading) * e.rollDir * sd * stp
			p[2] = p[2] - cos(e.heading) * e.rollDir * sd * stp
			e.rollT = e.rollT - stp
			spin = e.rollDir * 2.0 * PI * (1.0 - maxf(0.0, e.rollT) / T)
		end
		e.rolling = (e.rollT or 0.0) > 0.0
		e.invincible = e.rolling
		e.strafePrev = sIn ~= 0.0
	end
	e.tilt = { pitch = airborne and (e.pitch or 0.0) or 0.0, roll = (e.bank or 0.0) + spin }
	e.locomotion = airborne and "fly" or "taxi"
	e.gaitPhase = (e.gaitPhase or 0.0) + (0.2 + throttle) * num(r, "propRate", 3.0) * dt
	e.moving = v > 1e-3
end

function rules.step(e, r, input, dt, world, halt)
	local t = r.type
	if t == "walk" then
		rules.walk(e, r, input, dt, world)
	elseif t == "platform" then
		rules.platform(e, r, input, dt, world, halt)
	elseif t == "drive" then
		rules.drive(e, r, input, dt, world)
	elseif t == "racer" then
		rules.racer(e, r, dt, world)
	elseif t == "fly" then
		rules.fly(e, r, input, dt, world)
	end
end

return rules
end
