--!nonstrict
-- mojulo-roblox kernel — GROUPS: N minds as one. A port of the web's groups (lib/graph/worlds/controllable/group.js),
-- laid out as the Godot kernel's group.gd is (the same module in another language): a shared FOCUS (a target), an
-- ANCHOR (its leader), SPACING, a PLAN of traversal PATTERNS, and ATTACK TOKENS. One pre-step a frame gives every
-- member a SLOT; kernel/mind.luau walks a member to it instead of its own standoff and keeps its reflexes. Only a member
-- holding a token presses in to strike. A herd keeps together and scatters as one on an alarm. Membership is authored
-- on the member: `rule.mind.group` (an id, or { id, plan, spacing, attackers, leader, shareSight, travel, kind,
-- cohesion, alarmRadius, memorySpan, tokenEvery }). Held equal to the web's by the mind conformance corpus.
--
-- The groups' running state (stage, tokens, slot assignment) is held on an instance, one per world: never module state.
-- Pure Luau, no host API. A kernel module: the loader hands it the kernel (K.js, K.mind).
--
--   local G = group.new()
--   G:step(castState, dt, mind, world)    before the bodies step (the web's `groups` pre-step)

return function(K)
local js = K.js
local NULL, UNDEF = js.NULL, js.UNDEF

local group = {}

local PI = math.pi
local TAU = PI * 2.0
local INF = math.huge
local sin, cos, sqrt, atan2, ceil = math.sin, math.cos, math.sqrt, math.atan2, math.ceil

local function nz(v)
	if v == NULL or v == UNDEF then
		return nil
	end
	return v
end
local function truthy(v)
	return js.truthy(v)
end
local function fin(v)
	return js.finite(v)
end
local function isDict(v)
	return js.isObj(v)
end
local function isList(v)
	return js.isArr(v)
end
local function maxf(a, b)
	return a > b and a or b
end
local function hyp(a, b)
	return sqrt(a * a + b * b)
end
-- `d.k ?? x`
local function nf(d, k, x)
	local v = nz(d[k])
	if v ~= nil then
		return v
	end
	return x
end

local PLANS = {
	["pack-hunt"] = { "fan-out", { pattern = "encircle", when = { dist = 22 }, radius = 9, close = 1.2 }, { pattern = "close", when = { t = 4 } } },
	squad = { "line", { pattern = "pincer", when = { dist = 40 } } },
	herd = { "hold", { pattern = "scatter", when = { dist = 30 } } },
}
group.PLANS = PLANS

local function stagesOf(plan)
	local src
	if isList(plan) then
		src = plan
	elseif type(plan) == "string" and PLANS[plan] ~= nil then
		src = PLANS[plan]
	else
		src = PLANS["pack-hunt"]
	end
	local out = {}
	for _, s in ipairs(src) do
		table.insert(out, type(s) == "string" and { pattern = s } or s)
	end
	return out
end

-- ── PATTERNS (pure: members → slots, around the anchor A and the focus F; u the unit A→F, v its left normal) ─────────
local function pattern(name, c)
	local out = {}
	local n = c.n
	local sp = c.spacing
	local A, F, u, v, p, members = c.A, c.F, c.u, c.v, c.p, c.members
	if name == "column" then
		for i = 0, n - 1 do
			table.insert(out, { A[1] - u[1] * i * sp, A[2] - u[2] * i * sp })
		end
	elseif name == "line" then
		for i = 0, n - 1 do
			local k = i - (n - 1) / 2
			table.insert(out, { A[1] + v[1] * k * sp, A[2] + v[2] * k * sp })
		end
	elseif name == "wedge" then
		for i = 0, n - 1 do
			local k = ceil(i / 2)
			local side = i % 2 == 1 and 1 or -1
			table.insert(out, { A[1] - u[1] * k * sp + v[1] * side * k * sp, A[2] - u[2] * k * sp + v[2] * side * k * sp })
		end
	elseif name == "fan-out" then
		local R = nf(p, "radius", maxf(8, c.dist - sp))
		local arc = maxf(nf(p, "arc", 1.6), (sp * (n - 1)) / maxf(R, 1))
		for i = 0, n - 1 do
			local a = c.base + (n > 1 and (i / (n - 1) - 0.5) * arc or 0)
			table.insert(out, { F[1] + cos(a) * R, F[2] + sin(a) * R })
		end
	elseif name == "encircle" then
		local R0 = nf(p, "radius", maxf(6, (sp * n) / TAU))
		local R = maxf(nf(p, "min", 2.5), R0 - (truthy(p.close) and p.close or 0) * c.stageT)
		for i = 0, n - 1 do
			local a = c.base + (i * TAU) / n
			table.insert(out, { F[1] + cos(a) * R, F[2] + sin(a) * R })
		end
	elseif name == "close" then
		local c2 = table.clone(c)
		c2.p = { radius = nf(p, "radius", 2.5), min = nf(p, "min", 2) }
		return pattern("encircle", c2)
	elseif name == "pincer" then
		local R = nf(p, "radius", maxf(8, c.dist * 0.6))
		local ang = nf(p, "angle", 1.2)
		local half = ceil(n / 2)
		for i = 0, n - 1 do
			local left = i < half
			local k = left and i or i - half
			local cnt = left and half or n - half
			local a = c.base + (left and ang or -ang) + (cnt > 1 and (k / (cnt - 1) - 0.5) * ((sp * (cnt - 1)) / maxf(R, 1)) or 0)
			table.insert(out, { F[1] + cos(a) * R, F[2] + sin(a) * R })
		end
	elseif name == "scatter" then
		for _, m in ipairs(members) do
			local q = m.pos
			local a = atan2(q[2] - F[2], q[1] - F[1]) + (K.mind.hash01(m.id, 7) - 0.5) * 1.4
			local d = nf(p, "dist", 30)
			table.insert(out, { q[1] + cos(a) * d, q[2] + sin(a) * d })
		end
	else
		for _, m in ipairs(members) do
			table.insert(out, { m.pos[1], m.pos[2] })
		end
	end
	return out
end
group.pattern = pattern

-- stable slot assignment: keep a member's slot while the count holds; else greedy by id onto the nearest free slot
local function assign(g, members, slots)
	local stale = g.assignN ~= #members
	if not stale then
		for _, m in ipairs(members) do
			if g.assign[m.id] == nil then
				stale = true
				break
			end
		end
	end
	if stale then
		g.assign = {}
		local used = {}
		for _, m in ipairs(members) do
			local best = -1
			local bd = INF
			for k = 0, #slots - 1 do
				if used[k] then
					continue
				end
				local d = hyp(slots[k + 1][1] - m.pos[1], slots[k + 1][2] - m.pos[2])
				if d < bd then
					bd = d
					best = k
				end
			end
			used[best] = true
			g.assign[m.id] = best
		end
		g.assignN = #members
	end
	for _, m in ipairs(members) do
		local k = g.assign[m.id]
		m.groupSlot = (k >= 0 and k < #slots) and slots[k + 1] or nil
	end
end

local function ruleMind(m)
	if isDict(m.rule) and isDict(m.rule.mind) then
		return m.rule.mind
	end
	return {}
end

local Groups = {}
Groups.__index = Groups

function group.new()
	return setmetatable({ groups = {} }, Groups)
end

function Groups:stepHerd(st, g, cfg, members, leader, spacing, mind, world)
	local threat = g.alarm ~= nil and st.byId[g.alarm] or nil
	if threat ~= nil then
		local allFar = truthy(threat.downed)
		if not allFar then
			allFar = true
			for _, m in ipairs(members) do
				local ar = nf(cfg, "alarmRadius", nf(m.rule, "fearRadius", 18.0) * 1.5)
				if not (hyp(threat.pos[1] - m.pos[1], threat.pos[2] - m.pos[2]) > ar) then
					allFar = false
					break
				end
			end
		end
		if allFar then
			threat = nil
		end
	end
	if threat == nil then
		for _, m in ipairs(members) do
			local t = mind.threatOf(m, world)
			if t ~= nil and hyp(t.pos[1] - m.pos[1], t.pos[2] - m.pos[2]) < nf(m.rule, "fearRadius", 18.0) then
				threat = t
				break
			end
		end
	end
	g.alarm = threat ~= nil and threat.id or nil
	local cohesion = nf(cfg, "cohesion", spacing * 3.0)
	for _, m in ipairs(members) do
		m.groupId = g.id
		m.groupToken = false
		m.groupFocus = nil
		m.groupSpacing = spacing
		if threat ~= nil then
			m.groupAlarm = threat.id
			m.groupPattern = "scatter"
			m.groupSlot = pattern("scatter", { n = 1, spacing = spacing, A = { 0.0, 0.0 }, F = { threat.pos[1], threat.pos[2] }, u = { 0.0, 0.0 }, v = { 0.0, 0.0 }, p = { dist = 30 }, members = { m } })[1]
		else
			m.groupAlarm = nil
			m.groupPattern = "cohere"
			local d = m == leader and 0.0 or hyp(leader.pos[1] - m.pos[1], leader.pos[2] - m.pos[2])
			m.groupSlot = d > cohesion and { leader.pos[1], leader.pos[2] } or nil
		end
	end
end

-- the web's stepGroups: `world` is the frame's mind world (its pickTarget and threatOf read byId and the pilot)
function Groups:step(st, dt, mind, world)
	local any = false
	for _, e in ipairs(st.entities) do
		if truthy(ruleMind(e).group) then
			any = true
			break
		end
	end
	if not any then
		return
	end
	local byGroup = {}
	local ids = {}
	for _, e in ipairs(st.entities) do
		local gm = ruleMind(e).group
		if not truthy(gm) or truthy(e.downed) then
			continue
		end
		local id = type(gm) == "string" and gm or js.str(gm.id)
		if byGroup[id] == nil then
			byGroup[id] = {}
			table.insert(ids, id)
		end
		table.insert(byGroup[id], e)
	end
	table.sort(ids, js.lt)
	for _, id in ipairs(ids) do
		local members = byGroup[id]
		table.sort(members, function(a, b) return js.lt(a.id, b.id) end)
		local cfg = {}
		for _, m in ipairs(members) do
			if isDict(ruleMind(m).group) then
				cfg = ruleMind(m).group
				break
			end
		end
		if self.groups[id] == nil then
			self.groups[id] = { id = id, stage = 0, stageT = 0.0, tokenT = 0.0, assign = {}, assignN = 0, seen = nil, alarm = nil, engaged = false, base = nil, tokens = nil }
		end
		local g = self.groups[id]
		local leader = members[1]
		if truthy(cfg.leader) then
			for _, m in ipairs(members) do
				if m.id == cfg.leader then
					leader = m
					break
				end
			end
		end
		local spacing = nf(cfg, "spacing", 3.0)
		if cfg.kind == "herd" then
			self:stepHerd(st, g, cfg, members, leader, spacing, mind, world)
			continue
		end
		-- the focus: the target of the first member willing to fight (the leader first)
		local focus = nil
		local candidates = { leader }
		for _, m in ipairs(members) do
			table.insert(candidates, m)
		end
		for _, m in ipairs(candidates) do
			local tm = ruleMind(m).aggressiveness
			if tm == "passive" or (tm == "defensive" and not (fin(m.hpMax) and m.hpMax > 0.0 and fin(m.hp) and m.hp < m.hpMax)) then
				continue
			end
			focus = mind.pickTarget(m, world, nz(m.rule.target))
			if focus ~= nil and focus ~= m then
				break
			end
			focus = nil
		end
		-- shared sight: the freshest sighting of the focus by any member is the group's
		if focus ~= nil and cfg.shareSight ~= false then
			local best = nil
			for _, m in ipairs(members) do
				local ls = m.lastSeen
				if type(ls) == "table" and ls.id == focus.id and (best == nil or ls.t > best.t) then
					best = ls
				end
			end
			g.seen = best
		else
			g.seen = nil
		end
		local A = { 0.0, 0.0 }
		if focus ~= nil then
			for _, m in ipairs(members) do
				A[1] += m.pos[1] / #members
				A[2] += m.pos[2] / #members
			end
		else
			A = { leader.pos[1], leader.pos[2] }
		end
		local known = false
		if focus ~= nil then
			if g.seen == nil then
				known = true
				for _, m in ipairs(members) do
					if truthy(ruleMind(m).perception) then
						known = false
						break
					end
				end
			else
				known = world.time - g.seen.t < nf(cfg, "memorySpan", 8.0)
			end
		end
		local F, stages
		if focus ~= nil and known then
			F = { focus.pos[1], focus.pos[2] }
			stages = stagesOf(nz(cfg.plan))
		else
			local hd = leader.heading
			F = { A[1] + cos(hd) * 10.0, A[2] + sin(hd) * 10.0 }
			stages = { { pattern = truthy(cfg.travel) and cfg.travel or "column" } }
			if truthy(g.engaged) then
				g.stage = 0
				g.stageT = 0.0
				g.base = nil
			end
		end
		if not truthy(g.engaged) and focus ~= nil and known then
			g.base = nil
		end
		g.engaged = focus ~= nil and known
		local dist = hyp(F[1] - A[1], F[2] - A[2])
		if dist == 0.0 then
			dist = 1e-6
		end
		local u = { (F[1] - A[1]) / dist, (F[2] - A[2]) / dist }
		local v = { -u[2], u[1] }
		if g.stage >= #stages then
			g.stage = #stages - 1
		end
		g.stageT = g.stageT + dt
		local nxt = stages[g.stage + 2]
		if isDict(nxt) and isDict(nxt.when) then
			local w = nxt.when
			local go = true
			if nz(w.dist) ~= nil and not (dist <= w.dist) then
				go = false
			end
			if nz(w.t) ~= nil and not (g.stageT >= w.t) then
				go = false
			end
			if nz(w.arrived) ~= nil then
				local ok = 0
				for _, m in ipairs(members) do
					if type(m.groupSlot) == "table" and hyp(m.groupSlot[1] - m.pos[1], m.groupSlot[2] - m.pos[2]) < 2.0 then
						ok += 1
					end
				end
				if ok / #members < w.arrived then
					go = false
				end
			end
			if go then
				g.stage = g.stage + 1
				g.stageT = 0.0
				g.base = nil
			end
		end
		local stg = stages[g.stage + 1]
		local pat = js.str(stg.pattern)
		local travel = pat == "column" or pat == "line" or pat == "wedge"
		local anchor = travel and { leader.pos[1], leader.pos[2] } or A
		if g.base == nil then
			g.base = atan2(A[2] - F[2], A[1] - F[1])
		end
		local ctx = { A = anchor, F = F, u = u, v = v, n = #members, spacing = spacing, stageT = g.stageT, members = members, p = stg, dist = dist, base = g.base }
		assign(g, members, pattern(pat, ctx))
		if travel then
			leader.groupSlot = nil
		end
		-- attack tokens: the K members nearest the focus, re-dealt every tokenEvery s
		local Kn = nf(cfg, "attackers", #members)
		g.tokenT = g.tokenT - dt
		if g.tokenT <= 0.0 or g.tokens == nil then
			local order = table.clone(members)
			table.sort(order, function(a, b)
				local da = hyp(a.pos[1] - F[1], a.pos[2] - F[2])
				local db = hyp(b.pos[1] - F[1], b.pos[2] - F[2])
				if da ~= db then
					return da < db
				end
				return js.lt(a.id, b.id)
			end)
			local toks = {}
			for i = 1, math.min(Kn, #order) do
				toks[order[i].id] = true
			end
			g.tokens = toks
			g.tokenT = nf(cfg, "tokenEvery", 2.0)
		end
		for _, m in ipairs(members) do
			m.groupId = id
			m.groupToken = truthy(g.engaged) and g.tokens[m.id] == true
			m.groupFocus = truthy(g.engaged) and focus.id or nil
			m.groupPattern = pat
			m.groupSpacing = spacing
			local gs = g.seen
			if type(gs) == "table" and truthy(ruleMind(m).perception) and (type(m.lastSeen) ~= "table" or m.lastSeen.t < gs.t) then
				m.lastSeen = { pos = { gs.pos[1], gs.pos[2], gs.pos[3] }, t = gs.t, id = gs.id }
			end
		end
	end
end

return group
end
