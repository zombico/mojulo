--!nonstrict
-- mojulo-roblox kernel — the CAST: what the bus may do to a character, and what a character tells the bus back. A port
-- of the web's character world (lib/graph/worlds/controllable/cast.js castOps / castFacts / stepRoute) over plain data,
-- in the bus's frame (z-up, recipe units, heading in radians), laid out as the Godot kernel's cast.gd is (the same
-- module in another language). What the port leaves to the web: a walk's collider push-out and ground snap (a
-- character walks its straight lines on the ground it stands on) and transits (the look of a coming or going). Stuck is
-- still found (a second closing less than a sixth of the pace). Puffs, explosions (a chain scattered by the web's own
-- dice) and beams are moments on the cast's clock, as the web keeps them: a beam lands at its hit time and its target
-- hears `struck`. Held EQUAL to the web by the combat and mind conformance corpora, run under Lune.
--
-- An entity is a table (a missing field nil, the web's undefined): id, pos { x, y, z }, heading, dormant, gone,
-- downed, castDown, route, held, pose, speed, arrivals, arrivedAt, arrivedLast, stucks, statuses (a js.omap: a JS
-- object's key order), faded, moving, hp / hpMax, foot. The facts' last read rides the state (st._factsPrev), never
-- the module. Pure Luau, no host API. A kernel module: the loader hands it the kernel (K.js).
--
--   local st = cast.create(rows)        rows: [{ id, pos, heading?, dormant?, hp?, speed?, foot? }] (K.json.decode)
--   cast.ops(st, ops)                   the bus's queued `ctrl` intents (bus.takeCtrl), in order (a spawn's `among`
--                                       picks the spot farthest from the living; its `guard` holds it unhittable)
--   cast.step(st, dt)                   routes walk; the world clock moves
--   cast.facts(st) → { event }          down · gone · spawned · arrive { at, last, pose? } · stuck · seen { target } ·
--                                       hit:<id> { by } (once per hit kernel/combat.luau counted) · faded { is } ·
--                                       struck { by, beam? }

return function(K)
local js = K.js
local NULL, UNDEF = js.NULL, js.UNDEF
local truthy = js.truthy

local cast = {}

local PI = math.pi
local TAU = PI * 2.0
local DEG = PI / 180.0
local INF = math.huge
local sin, cos, sqrt, atan2, floor, fmod = math.sin, math.cos, math.sqrt, math.atan2, math.floor, math.fmod

local function nz(v)
	if v == NULL or v == UNDEF then
		return nil
	end
	return v
end
local function fin(v)
	return js.finite(v)
end
local function isList(v)
	return js.isArr(v)
end
local function isDict(v)
	return js.isObj(v)
end
local function minf(a, b)
	if a ~= a or b ~= b then
		return 0 / 0
	end
	return a < b and a or b
end
local function maxf(a, b)
	if a ~= a or b ~= b then
		return 0 / 0
	end
	return a > b and a or b
end
local function clampf(x, lo, hi)
	return maxf(lo, minf(hi, x))
end

function cast.create(rows)
	local st = { time = 0.0, entities = {}, byId = {}, moments = {} }
	for _, r in ipairs(rows) do
		if not isDict(r) or not truthy(r.id) then
			continue
		end
		local p = isList(r.pos) and r.pos or { 0, 0, 0 }
		local e = {
			id = js.str(r.id), pos = { p[1], p[2], (#p > 2 and type(p[3]) == "number") and p[3] or 0.0 },
			heading = fin(r.heading) and r.heading or 0.0,
			dormant = truthy(r.dormant), gone = truthy(r.dormant), downed = false, castDown = false,
			route = nil, held = false, pose = nil, speed = fin(r.speed) and r.speed or 2.5,
			arrivals = 0, arrivedAt = nil, arrivedLast = false, stucks = 0, statuses = js.omap(), faded = {}, moving = false,
		}
		if fin(r.hp) then
			e.hp = r.hp
			e.hpMax = r.hp
		end
		e.foot = fin(r.foot) and r.foot or 0.0
		table.insert(st.entities, e)
		st.byId[e.id] = e
	end
	return st
end

local function pt3(p, z)
	return { p[1], p[2], (#p > 2 and fin(p[3])) and p[3] or z }
end

-- ── moments (the web's cast.js moment / puff / beam) ─────────────────────────────────────────────────────────────
-- a moment, kept until its `until` (else 3 s); the old ones go when a new one comes, as on the web
local function moment(st, m)
	local t = st.time
	local kept = {}
	for _, x in ipairs(st.moments) do
		if t < (x["until"] ~= nil and x["until"] or x.t0 + 3.0) then
			table.insert(kept, x)
		end
	end
	local row = { t0 = t }
	for k, v in pairs(m) do
		row[k] = v
	end
	table.insert(kept, row)
	st.moments = kept
end

-- where a character stands: its pos less its foot
local function feet(e)
	local p = e.pos
	return { p[1], p[2], p[3] - (e.foot or 0.0) }
end

-- a puff, or an explosion (o.spec): a chain is count blasts scattered round the spot by the web's own dice (a sine
-- hash), one after another; a scale sizes it and its spread
local function puff(st, o, at, t0)
	local X = truthy(o.spec) and o.spec or nil
	local sc = fin(o.scale) and o.scale or 1.0
	local C = (X ~= nil and truthy(X.chain)) and X.chain or nil
	local n = C ~= nil and C.count or 1
	for j = 0, n - 1 do
		local function d(k)
			local x = sin(j * 12.9898 + k * 78.233 + 5.1) * 43758.5453
			return x - floor(x)
		end
		local a = d(1) * TAU
		local r = (j ~= 0 and C ~= nil) and C.spread * sc * sqrt(d(2)) or 0.0
		local tj = t0 + (C ~= nil and j * C.stagger or 0.0)
		local m = { is = type(o.is) == "string" and o.is or "smoke", at = { at[1] + cos(a) * r, at[2] + sin(a) * r, at[3] }, t0 = tj }
		if X ~= nil then
			m.spec = X
			m["until"] = tj + X.dur + 0.2
		end
		if sc ~= 1.0 then
			m.scale = sc
		end
		if js.has(o, "color") then
			m.color = o.color
		end
		moment(st, m)
	end
	local k = 0.0
	if fin(o.shake) and o.shake > 0.0 then
		k = o.shake
	elseif X ~= nil and truthy(X.shake) then
		k = X.shake
	end
	if truthy(k) then
		moment(st, { is = "shake", at = { at[1], at[2], at[3] }, k = minf(1.0, k * sqrt(sc)), ["for"] = C ~= nil and 0.4 + C.stagger * (n - 1) or 0.4, t0 = t0 })
	end
end

-- a beam from the hand (or over the head) at a character's middle or a point: it lands at hit, its impact and shake
-- are moments then, and its target hears struck
local function beam(st, e, o)
	if e.gone or not truthy(o.spec) then
		return
	end
	local spec = o.spec
	local f = feet(e)
	local h = e.heading
	local above = truthy(spec.charge) and js.strictEq(js.get(spec.charge, "at"), "above")
	local from = above and { f[1], f[2], f[3] + 2.7 } or { f[1] + cos(h) * 0.45, f[2] + sin(h) * 0.45, f[3] + 1.15 }
	local T = nil
	if type(o.to) == "string" then
		T = st.byId[o.to]
		if T == nil or T.gone then
			return
		end
	end
	local to = T ~= nil and { T.pos[1], T.pos[2], T.pos[3] } or pt3(o.to, 0.0)
	local D = sqrt((to[1] - from[1]) * (to[1] - from[1]) + (to[2] - from[2]) * (to[2] - from[2]) + (to[3] - from[3]) * (to[3] - from[3]))
	-- the least a + b × distance of `land` (Math.min over an empty list is Infinity, as the web's)
	local landRule = truthy(o.land) and o.land or { { 0, 0 } }
	local best = INF
	for _, ab in ipairs(landRule) do
		best = minf(best, ab[1] + ab[2] * D)
	end
	local hit = st.time + best
	local m = { is = "beam", at = from, from = from, to = to, by = e.id, name = truthy(o.name) and o.name or NULL, spec = spec, hit = hit, ["until"] = hit + 8.0 }
	if T ~= nil then
		m.target = T.id
	end
	if js.has(o, "color") then
		m.color = o.color
	end
	moment(st, m)
	local land = T ~= nil and feet(T) or to
	if truthy(spec.impact) then
		local imp = { is = spec.impact }
		if truthy(spec.impactSpec) then
			imp.spec = spec.impactSpec
		end
		if js.has(o, "color") then
			imp.color = o.color
		end
		puff(st, imp, land, hit)
	end
	if truthy(spec.shake) then
		moment(st, { is = "shake", at = land, k = spec.shake, ["for"] = 0.4, t0 = hit })
	end
end

local function reversed(t)
	local o = {}
	for i = #t, 1, -1 do
		table.insert(o, t[i])
	end
	return o
end

-- a dumb path: turn toward the point, step, arrive within reach; `then` at the last point
local function stepRoute(e, dt)
	local R = e.route
	local p = R.points[R.i + 1]
	local dx = p[1] - e.pos[1]
	local dy = p[2] - e.pos[2]
	local d = sqrt(dx * dx + dy * dy)
	if d <= R.reach then
		local last = R.i == #R.points - 1
		e.arrivals += 1
		e.arrivedAt = R.names[R.i + 1]
		e.arrivedLast = last and R["then"] ~= "loop" and not (R["then"] == "back" and not R.back)
		if not last then
			R.i += 1
		elseif R["then"] == "loop" then
			R.i = 0
		elseif R["then"] == "back" and not R.back then
			R.points = reversed(R.points)
			R.names = reversed(R.names)
			R.back = true
			R.i = #R.points > 1 and 1 or 0
		else
			e.route = nil
			e.held = true
			if R.face ~= nil then
				e.heading = R.face
			end
			e.pose = R.pose
		end
		R.best = INF
		R.watch = 0.0
		e.moving = false
		return
	end
	-- stuck: a second that closes less than a sixth of the pace
	R.watch += dt
	if d < R.best and (R.best - d >= R.speed / 6.0 or R.best == INF) then
		R.best = d
		R.watch = 0.0
	end
	if R.watch >= 1.0 then
		e.route = nil
		e.stucks += 1
		e.moving = false
		return
	end
	local want = atan2(dy, dx)
	-- the web's ((x % τ) + τ) % τ − π, `%` as C fmod
	local dh = fmod(fmod(want - e.heading + PI, TAU) + TAU, TAU) - PI
	e.heading = fmod(e.heading + clampf(dh, -R.turn * dt, R.turn * dt), TAU)
	local stp = minf(R.speed * dt, d)
	e.pos[1] += dx / d * stp
	e.pos[2] += dy / d * stp
	e.moving = true
end

function cast.ops(st, list)
	for _, o in ipairs(list) do
		if not isDict(o) then
			continue
		end
		local op = nz(o.op)
		if op == "shake" then
			moment(st, { is = "shake", at = { 0.0, 0.0, 0.0 }, k = fin(o.k) and o.k or 0.5, ["for"] = fin(o["for"]) and o["for"] or 0.4 })
			continue
		end
		-- a skipped scene (scene-runner.js): every walk lands where it was going, its last point, its face and pose, and
		-- the arrive fact; a looping walk keeps walking
		if op == "finish" then
			for _, w in ipairs(st.entities) do
				local R = w.route
				if R == nil or R["then"] == "loop" then
					continue
				end
				if R["then"] == "back" and not R.back then
					R.points = reversed(R.points)
					R.names = reversed(R.names)
					R.back = true
				end
				R.i = #R.points - 1
				w.pos[1] = R.points[R.i + 1][1]
				w.pos[2] = R.points[R.i + 1][2]
				stepRoute(w, 0.0)
			end
			continue
		end
		if op == "puff" and not truthy(o.who) and isList(o.at) then
			puff(st, o, pt3(o.at, 0.0), st.time)
			continue
		end
		local e = st.byId[js.str(js.get(o, "who"))]
		if e == nil then
			continue
		end
		if op == "puff" then
			puff(st, o, isList(o.at) and pt3(o.at, 0.0) or feet(e), st.time)
			continue
		end
		if op == "beam" then
			beam(st, e, o)
			continue
		end
		if op == "transfigure" then
			local b = st.byId[js.str(js.get(o, "into"))]
			if b == nil or b == e or e.gone then
				continue
			end
			cast.ops(st, { js.obj({ op = "spawn", who = b.id, at = js.arr({ e.pos[1], e.pos[2], e.pos[3] }), face = e.heading / DEG }), js.obj({ op = "vanish", who = e.id }) })
			continue
		end
		if op == "spawn" then
			e.dormant = false
			e.gone = false
			e.downed = false
			e.castDown = false
			e.route = nil
			e.held = false
			e.pose = nil
			-- a fresh life: what its mind knew and was doing goes (a sighting, a search, a cover spot, a path, a crossed
			-- health phase); the hits it took before are not a new hit
			if type(e.rule) == "table" and e.rule.type == "ai" then
				e.lastSeen = nil
				e.searchT = nil
				e.coverAt = nil
				e.coverUntil = nil
				e.navPath = nil
				e.mindPhase = nil
				e.coverHits = e.hits or 0
			end
			if fin(e.hpMax) then
				e.hp = e.hpMax
				e.hittable = true
			end
			if isList(o.among) and #o.among > 0 then
				-- the spawn farthest from the living (the nearest other standing body; a tie to the first), as the web
				local best = nil
				local bd = -1.0
				for _, sp in ipairs(o.among) do
					if not isList(sp) then
						continue
					end
					local dmin = INF
					for _, x in ipairs(st.entities) do
						if x == e or x.downed or x.gone or x.dormant or not truthy(x.hittable) then
							continue
						end
						local ddx, ddy = x.pos[1] - sp[1], x.pos[2] - sp[2]
						dmin = minf(dmin, sqrt(ddx * ddx + ddy * ddy))
					end
					if dmin > bd then
						bd = dmin
						best = sp
					end
				end
				if best ~= nil then
					e.pos = pt3(best, e.pos[3])
				end
			elseif isList(o.at) then
				e.pos = pt3(o.at, e.pos[3])
			end
			if fin(o.face) then
				e.heading = o.face * DEG
			end
			-- the spawn guard: unhittable its seconds (the wake guard's clock: combat ticks a poised body's, step the rest)
			if fin(o.guard) and o.guard > 0.0 then
				e.wakeGuardT = o.guard
				e.invincible = true
			end
		elseif op == "vanish" then
			e.gone = true
			e.dormant = true
			e.route = nil
			e.held = false
			e.moving = false
			e.hittable = false
		elseif op == "kill" or op == "hurt" then
			if e.downed or e.gone then
				continue
			end
			local hasHp = fin(e.hp)
			if op == "hurt" then
				if not hasHp then
					continue
				end
				e.hp = maxf(0.0, e.hp - (fin(o.by) and o.by or 1.0))
				if e.hp > 0.0 then
					continue
				end
			end
			if hasHp then
				e.hp = 0.0
			end
			e.downed = true
			e.castDown = true
			e.route = nil
			e.held = false
			e.moving = false
		elseif op == "heal" then
			if e.downed or not fin(e.hp) then
				continue
			end
			local mx = fin(e.hpMax) and e.hpMax or e.hp
			e.hp = minf(mx, fin(o.by) and e.hp + o.by or mx)
		elseif op == "rearm" then
			-- rounds for the weapon in its hand: `by` more in its reserve, or with no reserve or no by, the magazine full
			local w = e.weapon
			if e.downed or not isDict(w) then
				continue
			end
			if nz(w.reserve) ~= nil and fin(o.by) then
				w.reserve = w.reserve + maxf(0.0, o.by)
			else
				w.ammo = w.magazine
				w.reloading = false
				w.reloadT = 0.0
			end
		elseif op == "walk" then
			if e.downed or e.gone or not isList(o.points) or #o.points == 0 then
				continue
			end
			local points = {}
			for _, p in ipairs(o.points) do
				if isList(p) and #p >= 2 and fin(p[1]) and fin(p[2]) then
					table.insert(points, { p[1], p[2] })
				end
			end
			if #points == 0 then
				continue
			end
			local names = {}
			for i = 1, #points do
				local nm = isList(o.names) and o.names[i] or nil
				names[i] = type(nm) == "string" and nm or tostring(i - 1)
			end
			e.held = false
			e.pose = nil
			e.route = {
				points = points, names = names, i = 0, back = false, best = INF, watch = 0.0,
				speed = (fin(o.speed) and o.speed > 0) and o.speed or e.speed,
				turn = (fin(o.turn) and o.turn > 0) and o.turn or 8.0,
				reach = (fin(o.reach) and o.reach > 0) and o.reach or 0.3,
				["then"] = (o["then"] == "loop" or o["then"] == "back") and o["then"] or "stay",
				face = fin(o.face) and o.face * DEG or nil, pose = type(o.pose) == "string" and o.pose or nil,
			}
		elseif op == "stop" then
			e.route = nil
			e.held = false
			e.moving = false
		elseif op == "status" then
			if type(o.is) ~= "string" or e.gone then
				continue
			end
			e.statuses:set(o.is, { t0 = st.time, ["until"] = (fin(o["for"]) and o["for"] > 0.0) and st.time + o["for"] or nil })
		elseif op == "lift" then
			for _, k in ipairs(e.statuses:keys()) do
				if js.isNullish(o.is) or o.is == k then
					e.statuses:delete(k)
					table.insert(e.faded, k)
				end
			end
		end
	end
end

function cast.step(st, dt)
	st.time += dt
	for _, e in ipairs(st.entities) do
		if not fin(e.poise) and fin(e.wakeGuardT) and e.wakeGuardT > 0.0 then
			e.wakeGuardT = maxf(0.0, e.wakeGuardT - dt)
			e.invincible = e.wakeGuardT > 0.0
		end
		if e.route ~= nil then
			if e.downed or e.gone then
				e.route = nil
			else
				stepRoute(e, dt)
			end
		end
	end
end

-- edge-detected happenings, as bus events with `entity` (the first read seeds: nothing a world was minted with fires)
function cast.facts(st)
	local prev = st._factsPrev
	local seed = prev == nil
	local nxt = {}
	local events = {}
	for _, e in ipairs(st.entities) do
		local cur = { d = e.downed, g = e.gone, a = e.arrivals, s = e.stucks, h = e.hits or 0, n = e.sightings or 0 }
		nxt[e.id] = cur
		local p = (not seed) and prev[e.id] or nil
		if p == nil then
			continue
		end
		if cur.d and not p.d then
			table.insert(events, { type = "down", entity = e.id })
		end
		if cur.g and not p.g then
			table.insert(events, { type = "gone", entity = e.id })
		end
		if not cur.g and p.g then
			table.insert(events, { type = "spawned", entity = e.id })
		end
		if cur.a > p.a then
			local ev = { type = "arrive", entity = e.id, at = e.arrivedAt, last = e.arrivedLast and 1 or 0 }
			if e.arrivedLast and e.pose ~= nil then
				ev.pose = e.pose
			end
			table.insert(events, ev)
		end
		if cur.s > p.s then
			table.insert(events, { type = "stuck", entity = e.id })
		end
		-- a mind's fresh sighting (kernel/mind.luau perceive): the bus's `seen`, and who it saw
		if cur.n > (p.n or 0) then
			table.insert(events, { type = "seen", entity = e.id, target = truthy(e.seenId) and e.seenId or NULL })
		end
		for _ = p.h or 0, cur.h - 1 do
			local hv = { type = "hit:" .. e.id, entity = e.id, by = truthy(e.lastHitBy) and e.lastHitBy or NULL }
			-- what a round dealt rides the fact the count it was dealt at (cast.js: the bus can take it from an hp of its own)
			if js.finite(e.lastHitDmg) and e.lastHitDmgN == cur.h then
				hv.dmg = e.lastHitDmg
				hv.harm = 0.0 - e.lastHitDmg
				hv.head = truthy(e.lastHitHead) and 1 or 0
			end
			table.insert(events, hv)
		end
		for _, k in ipairs(e.statuses:keys()) do
			local u = e.statuses:get(k)["until"]
			if u ~= nil and st.time >= u then
				e.statuses:delete(k)
				table.insert(e.faded, k)
			end
		end
		for _, k in ipairs(e.faded) do
			table.insert(events, { type = "faded", entity = e.id, is = k })
		end
		e.faded = {}
	end
	-- a beam that has reached its character
	for _, M in ipairs(st.moments) do
		if M.is == "beam" and M.target ~= nil and not truthy(M.struck) and st.time >= M.hit then
			M.struck = true
			if not seed then
				local ev = { type = "struck", entity = M.target, by = M.by }
				if truthy(M.name) then
					ev.beam = M.name
				end
				table.insert(events, ev)
			end
		end
	end
	st._factsPrev = nxt
	return events
end

cast.moment = moment
cast.feet = feet

return cast
end
