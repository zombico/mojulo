--!nonstrict
-- mojulo-roblox kernel — THE STATS: a literal port of the web's stats kernel (lib/graph/playscape/stats/kernel.js
-- buildStats), laid out as the Godot kernel's stats.gd, held equal to the web by the bus conformance corpus. Levels
-- climb on xp, resources are spent, purchases are guarded and atomic, epochs are reached, tech nodes rank up and open
-- their subtrees, modifiers stack on stats, derived stats follow what they are made of, and a phenomenon's number is
-- read off a formula. It runs inside the bus's watch fixpoint (bus.frame's stats): each pass takes the stat ops off the
-- bus's ctrl queue, resolves the formulas on the cast ops left there, and returns the events its transactions raise.
--
--   K.stats.step(cfg, state) → { event }   cfg: bus.json `stats` (stats.js readStats); state: the bus state
--   K.stats.evalF(cfg, vars, f, ctx)       one formula's number
--
-- Pure Luau, no host API.

return function(K)
local js = K.js
local NULL, UNDEF = js.NULL, js.UNDEF
local arr, obj, truthy = js.arr, js.obj, js.truthy

local stats = {}

local STAT_OPS = { raise = 1, grant = 1, xp = 1, level = 1, buy = 1, buff = 1, unbuff = 1 }
stats.STAT_OPS = STAT_OPS
-- where a cast op may carry a formula, and the range the read number is held to
local FIELDS = {
	hurt = { by = { 0, 1e9 } }, heal = { by = { 0, 1e9 } },
	puff = { scale = { 0.1, 10 }, shake = { 0, 1 } }, status = { ["for"] = { 0.05, 1e6 } },
	shake = { k = { 0, 1 }, ["for"] = { 0.05, 3 } }, walk = { speed = { 0.1, 50 } },
	raise = { by = { -1e9, 1e9 } }, grant = { by = { -1e9, 1e9 } }, xp = { by = { 0, 1e9 } }, level = { by = { 0, 1e3 } },
}

-- JS `v != null` (neither null nor undefined)
local function nn(v)
	return not js.isNullish(v)
end

local function clamp(v, lo, hi)
	if nn(lo) and v < lo then
		return lo
	end
	if nn(hi) and v > hi then
		return hi
	end
	return v
end

-- JS `x || 0`
local function or0(v)
	if truthy(v) then
		return v
	end
	return 0
end

local function isFormula(v)
	return js.isObj(v) and (type(v.stat) == "string" or js.isArr(v.sum) or js.isArr(v.mul))
end

local function holderOf(cfg, op)
	if truthy(op.of) then
		return op.of
	end
	return cfg.holders[1]
end

local function key(h, k)
	return js.str(h) .. "." .. js.str(k)
end

local function epochIx(cfg, id)
	for i, e in ipairs(cfg.epochs) do
		if js.strictEq(e.id, id) then
			return i - 1
		end
	end
	return -1
end

local function value(cfg, vars, h, k)
	if k == "epoch" then
		return math.max(0, epochIx(cfg, js.get(vars, js.str(h) .. ".epoch")))
	end
	local v = vars[key(h, k)]
	return type(v) == "number" and v or 0
end

-- a formula's number; ctx: { self, target } (holders' ids; a target that is no holder reads 0)
local function evalF(cfg, vars, f, ctx)
	if type(f) == "number" then
		return f
	end
	if not truthy(f) or type(f) ~= "table" then
		return 0
	end
	ctx = ctx or {}
	local v
	if type(f.stat) == "string" then
		local h
		if f.of == "target" then
			h = ctx.target
		elseif f.of == "self" or not nn(f.of) then
			h = truthy(ctx.self) and ctx.self or cfg.holders[1]
		else
			h = f.of
		end
		v = (nn(f.base) and f.base or 0) + (nn(f.per) and f.per or 1) * (truthy(h) and value(cfg, vars, h, f.stat) or 0)
	else
		v = truthy(f.sum) and 0 or 1
		if truthy(f.sum) then
			for _, x in ipairs(f.sum) do
				v += evalF(cfg, vars, x, ctx)
			end
		end
		if truthy(f.mul) then
			for _, x in ipairs(f.mul) do
				v *= evalF(cfg, vars, x, ctx)
			end
		end
	end
	local c = f.curve
	if c == "sqrt" then
		v = v < 0 and -math.sqrt(-v) or math.sqrt(v)
	elseif truthy(c) and type(c) == "table" and nn(c.mitigate) then
		v = c.mitigate / (c.mitigate + math.max(0, v))
	elseif truthy(c) and type(c) == "table" and nn(c.soft) and v > c.soft then
		v = c.soft + (v - c.soft) * (nn(c.slope) and c.slope or 0.5)
	end
	return clamp(v, f.min, f.max)
end
stats.evalF = evalF

local function requires(cfg, vars, h, r)
	if not truthy(r) then
		return true
	end
	if truthy(r.all) then
		for _, x in ipairs(r.all) do
			if not requires(cfg, vars, h, x) then
				return false
			end
		end
		return true
	end
	if truthy(r.any) then
		for _, x in ipairs(r.any) do
			if requires(cfg, vars, h, x) then
				return true
			end
		end
		return false
	end
	if nn(r.level) then
		return value(cfg, vars, h, "level") >= r.level
	end
	if nn(r.epoch) then
		return value(cfg, vars, h, "epoch") >= epochIx(cfg, r.epoch)
	end
	if nn(r.has) then
		return value(cfg, vars, h, r.has) >= (nn(r.rank) and r.rank or 1)
	end
	if nn(r.stat) then
		return value(cfg, vars, h, r.stat) >= (nn(r.gte) and r.gte or 0)
	end
	return false
end

-- a node can be bought or ranked: its parent at its opening rank, its epoch reached, its requirements met
local function nodeOpen(cfg, vars, h, id)
	local n = cfg.nodes[id]
	if truthy(n.parent) and value(cfg, vars, h, n.parent) < n.opens then
		return false
	end
	if nn(n.epoch) and value(cfg, vars, h, "epoch") < epochIx(cfg, n.epoch) then
		return false
	end
	return requires(cfg, vars, h, n.requires)
end

local function costAt(cost, growth, rank)
	local out = obj()
	for k, c in pairs(cost) do
		out[k] = math.ceil(c * growth ^ rank - 1e-9)
	end
	return out
end
local function affordable(vars, h, cost)
	for k, c in pairs(cost) do
		if not js.rel(or0(vars[key(h, k)]), c, ">=") then
			return false
		end
	end
	return true
end
local function pay(vars, h, cost)
	for k, c in pairs(cost) do
		vars[key(h, k)] = js.toNumber(or0(vars[key(h, k)])) - c
	end
end

-- the effective values: each stat in order (a derived one after what it reads), its modifiers stacked on its base, the
-- buffs summed in the order they were put on (a JS object's order: the sum is floating point)
local function settle(cfg, S, h)
	local vars = S.vars
	local mods = S._statMods and S._statMods[js.str(h)]
	for _, id in ipairs(cfg.order) do
		local d = cfg.stats[id]
		local base = truthy(d.from) and evalF(cfg, vars, d.from, { self = h }) or value(cfg, vars, h, id .. ".base")
		local add, pct, mul = 0, 0, 1
		if mods then
			for _, k in ipairs(mods:keys()) do
				for _, m in ipairs(mods:get(k)) do
					if m.stat == id then
						add += or0(m.add)
						pct += or0(m.pct)
						mul *= nn(m.mul) and m.mul or 1
					end
				end
			end
		end
		vars[key(h, id)] = clamp((base + add) * (1 + pct) * mul, d.min, d.max)
	end
end

local function raise(cfg, vars, h, stat, by)
	local d = cfg.stats[js.str(stat)]
	if not d or truthy(d.from) then
		return
	end
	vars[key(h, js.str(stat) .. ".base")] = clamp(value(cfg, vars, h, js.str(stat) .. ".base") + by, d.min, d.max)
end
local function grant(cfg, vars, h, res, by)
	local d = cfg.resources[js.str(res)]
	if not d then
		return
	end
	vars[key(h, res)] = clamp(value(cfg, vars, h, res) + by, 0, d.cap)
end

local gainXp

local function give(cfg, S, h, g, out)
	if not truthy(g) then
		return
	end
	if truthy(g.raise) then
		for k, by in pairs(g.raise) do
			raise(cfg, S.vars, h, k, by)
		end
	end
	if truthy(g.grant) then
		for k, by in pairs(g.grant) do
			grant(cfg, S.vars, h, k, by)
		end
	end
	if truthy(g.raise) then
		settle(cfg, S, h)
	end
	if truthy(g.xp) then
		gainXp(cfg, S, h, g.xp, out)
	end
end

-- an epoch reached by level alone (one with a cost is bought: its level is then a requirement)
local function epochsByLevel(cfg, vars, h, out)
	local cur = value(cfg, vars, h, "epoch")
	local to = cur
	for i = cur + 1, #cfg.epochs - 1 do
		local e = cfg.epochs[i + 1]
		if truthy(e.cost) or not nn(e.level) then
			break   -- epochs are in order: a bought one stands in the way of the next
		end
		if value(cfg, vars, h, "level") >= e.level and requires(cfg, vars, h, e.requires) then
			to = i
		else
			break
		end
	end
	if to ~= cur then
		vars[js.str(h) .. ".epoch"] = cfg.epochs[to + 1].id
		table.insert(out, obj({ type = "epoch", of = h, epoch = cfg.epochs[to + 1].id }))
	end
end

local function levelUp(cfg, S, h, out)
	local L, vars = cfg.level, S.vars
	if not truthy(L) then
		return false
	end
	local lv = value(cfg, vars, h, "level")
	if nn(L.max) and lv >= L.max then
		return false
	end
	vars[js.str(h) .. ".level"] = lv + 1
	settle(cfg, S, h)   -- a derived stat may read the level
	give(cfg, S, h, L.each, out)
	give(cfg, S, h, truthy(L.at) and js.get(L.at, js.str(lv + 1)) or nil, out)
	table.insert(out, obj({ type = "level-up", of = h, level = lv + 1 }))
	if #cfg.epochs > 0 then
		epochsByLevel(cfg, vars, h, out)
	end
	return true
end

function gainXp(cfg, S, h, by, out)
	local L, vars = cfg.level, S.vars
	if not truthy(L) then
		return
	end
	vars[js.str(h) .. ".xp"] = value(cfg, vars, h, "xp") + by
	local guard = 0
	while guard < 1000 do
		guard += 1
		local i = value(cfg, vars, h, "level") - L.start
		if i >= #L.xp or value(cfg, vars, h, "xp") < L.xp[i + 1] then
			break
		end
		if not levelUp(cfg, S, h, out) then
			break
		end
	end
end

-- ONE TRANSACTION: every check first; on any failure nothing changes and `denied` says why
local function buy(cfg, S, h, id, out)
	local vars = S.vars
	local function deny(why)
		table.insert(out, obj({ type = "denied", of = h, id = js.isUndef(id) and UNDEF or id, why = why }))
	end
	local sid = js.str(id)
	local n, o, ei = cfg.nodes[sid], cfg.offers[sid], epochIx(cfg, id)
	if n then
		local rank = value(cfg, vars, h, sid)
		if rank >= n.ranks then return deny("max") end
		if not nodeOpen(cfg, vars, h, sid) then return deny("requires") end
		local cost = costAt(n.cost, n.growth, rank)
		if not affordable(vars, h, cost) then return deny("cost") end
		pay(vars, h, cost)
		vars[key(h, sid)] = rank + 1
		settle(cfg, S, h)
		give(cfg, S, h, n.gives, out)
		table.insert(out, obj({ type = "bought", of = h, id = id, rank = rank + 1 }))
		return
	end
	if o then
		local count = value(cfg, vars, h, sid)
		if nn(o.max) and count >= o.max then return deny("max") end
		if not requires(cfg, vars, h, o.requires) then return deny("requires") end
		if not affordable(vars, h, o.cost) then return deny("cost") end
		pay(vars, h, o.cost)
		vars[key(h, sid)] = count + 1
		give(cfg, S, h, o.gives, out)
		table.insert(out, obj({ type = "bought", of = h, id = id, rank = count + 1 }))
		return
	end
	if ei >= 0 then
		local cur, e = value(cfg, vars, h, "epoch"), cfg.epochs[ei + 1]
		if ei <= cur then return deny("max") end
		if ei > cur + 1 then return deny("requires") end   -- epochs are reached in order
		if nn(e.level) and value(cfg, vars, h, "level") < e.level then return deny("requires") end
		if not requires(cfg, vars, h, e.requires) then return deny("requires") end
		local cost = truthy(e.cost) and e.cost or obj()
		if not affordable(vars, h, cost) then return deny("cost") end
		pay(vars, h, cost)
		vars[js.str(h) .. ".epoch"] = e.id
		settle(cfg, S, h)
		table.insert(out, obj({ type = "bought", of = h, id = id, rank = 1 }))
		table.insert(out, obj({ type = "epoch", of = h, epoch = e.id }))
		return
	end
	deny("unknown")
end

-- a buff's mods are read now (a formula in add / pct / mul reads the holder as it is) and replace any under its id
local function buff(cfg, S, h, op)
	local mods = {}
	for _, m in ipairs(js.isArr(op.mods) and op.mods or {}) do
		if not truthy(m) or not cfg.stats[js.str(m.stat)] then
			continue
		end
		local r = { stat = m.stat }
		for _, k in { "add", "pct", "mul" } do
			if nn(m[k]) then
				r[k] = evalF(cfg, S.vars, m[k], { self = h })
			end
		end
		table.insert(mods, r)
	end
	S._statMods = S._statMods or {}
	local hk = js.str(h)
	S._statMods[hk] = S._statMods[hk] or js.omap()
	S._statMods[hk]:set(js.str(op.id), mods)
end
local function unbuff(S, h, id)
	local mine = S._statMods and S._statMods[js.str(h)]
	if not mine or type(id) ~= "string" then
		return
	end
	if string.sub(id, -1) == "*" then
		local p = string.sub(id, 1, -2)
		for _, k in ipairs(mine:keys()) do
			if string.sub(k, 1, #p) == p then
				mine:delete(k)
			end
		end
	else
		mine:delete(id)
	end
end

-- the open flags, and `opened` on each that turns on
local function refreshOpen(cfg, vars, out)
	for _, h in ipairs(cfg.holders) do
		for id, n in pairs(cfg.nodes) do
			local k = key(h, id .. ".open")
			local now = (nodeOpen(cfg, vars, h, id) and value(cfg, vars, h, id) < n.ranks) and 1 or 0
			if now ~= 0 and not truthy(vars[k]) then
				table.insert(out, obj({ type = "opened", of = h, id = id }))
			end
			vars[k] = now
		end
	end
end

-- a bound stat that changed: a body change waiting for that holder's character
local function bodies(cfg, S)
	if not truthy(cfg.bodies) then
		return
	end
	S._statBody = S._statBody or {}
	S._statBodyOps = S._statBodyOps or arr()
	local sent, q = S._statBody, S._statBodyOps
	for _, h in ipairs(cfg.holders) do
		local op = obj({ who = h })
		local any = false
		for field, stat in pairs(cfg.bodies) do
			local v, k = value(cfg, S.vars, h, stat), key(h, field)
			if sent[k] ~= v then
				sent[k] = v
				op[field] = v
				any = true
			end
		end
		if any then
			table.insert(q, op)
		end
	end
end

-- a cast op's (and a stat op's) formulas, read now, held to the field's range
local function resolveOp(cfg, vars, op)
	local f = FIELDS[js.str(op.op)] or {}
	local isStat = STAT_OPS[js.str(op.op)] ~= nil
	local ctx
	if isStat then
		ctx = { self = holderOf(cfg, op) }
	else
		ctx = {
			self = op.op == "beam" and op.who or cfg.holders[1],
			target = op.op == "beam" and (type(op.to) == "string" and op.to or nil) or op.who,
		}
	end
	for k, v in pairs(op) do
		if k == "mods" or not isFormula(v) then
			continue
		end
		local r = f[k] or {}
		op[k] = clamp(evalF(cfg, vars, v, ctx), r[1], r[2])
	end
	if op.op == "level" and nn(op.by) then
		op.by = js.round(op.by)
	end
end

local function apply(cfg, S, op, out)
	local h, vars = holderOf(cfg, op), S.vars
	local verb = op.op
	if verb == "raise" then
		raise(cfg, vars, h, op.stat, nn(op.by) and op.by or 1)
		settle(cfg, S, h)
	elseif verb == "grant" then
		grant(cfg, vars, h, op.res, nn(op.by) and op.by or 1)
		settle(cfg, S, h)
	elseif verb == "xp" then
		gainXp(cfg, S, h, nn(op.by) and op.by or 1, out)
	elseif verb == "level" then
		local n = nn(op.by) and op.by or 1
		local i = 0
		while i < n do
			if not levelUp(cfg, S, h, out) then
				break
			end
			i += 1
		end
	elseif verb == "buy" then
		buy(cfg, S, h, js.get(op, "id"), out)
	elseif verb == "buff" then
		buff(cfg, S, h, op)
		settle(cfg, S, h)
	elseif verb == "unbuff" then
		unbuff(S, h, op.id)
		settle(cfg, S, h)
	end
end

-- one pass over the bus's queued intents: stat ops applied and taken off, formulas resolved, events returned
function stats.step(cfg, S)
	local ops = S._ctrlOps or arr()
	local first = not S._statInit
	if #ops == 0 and not first then
		return {}
	end
	S._statInit = 1
	local keep, out = arr(), {}
	local touched = first
	for _, op in ipairs(ops) do
		if STAT_OPS[js.str(op.op)] then
			resolveOp(cfg, S.vars, op)
			apply(cfg, S, op, out)
			touched = true
		else
			resolveOp(cfg, S.vars, op)
			table.insert(keep, op)
		end
	end
	if touched then
		refreshOpen(cfg, S.vars, out)
		bodies(cfg, S)
	end
	S._ctrlOps = keep
	return out
end

return stats
end
