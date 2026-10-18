--!nonstrict
-- mojulo-roblox kernel — the EVENT BUS, a literal port of buildBus (lib/graph/worlds/event-bus.js), laid out as the
-- Godot kernel's bus.gd is (the same module in another language). Every behaviour mojulo lowers (cues, chapters,
-- menu picks, mechanics) arrives as a bus fragment: reactions, watches, sequences, timers, vars. This module runs
-- that fragment the way the web page does, so behaviour travels as data and one reducer performs it everywhere. It
-- is held EQUAL to the web reducer by the bus conformance corpus (lib/graph/scene/bus-conformance.js), run under Lune:
-- the same event script gives the same canonical state string, frame by frame.
--
-- JS semantics are the js module's (null and undefined, array and object tags, number printing, UTF-16 hashing).
-- Read the fragment with K.json.decode. Pure Luau, no host API.
--
--   local bus = K.bus
--   local st = bus.createBusState(config, entities)
--   bus.processEvents(st, events); bus.watchEvents(st); bus.tickTimers(st, dt); bus.stepTime(st, dt)
--   bus.frame(st, incoming, dt, stats?)  the web page's frame order (scene/channels/events.js), for a driver; `stats`
--                                        is { kernel = K.stats, cfg } when the world has stats (the page's __STATS)
--   bus.hashState(st)                    the canonical snapshot the conformance corpus compares

return function(K)
local js = K.js
local NULL, UNDEF = js.NULL, js.UNDEF
local arr, obj, get, has, truthy, ss = js.arr, js.obj, js.get, js.has, js.truthy, js.ss

local bus = {}

local RESERVED = { ["do"] = 1, type = 1, source = 1, scope = 1, on = 1, match = 1, await = 1, target = 1, template = 1, at = 1, to = 1, vector = 1, dir = 1, gain = 1, var = 1, by = 1, ["if"] = 1 }
local DIRS = { up = { 0, 0, 1 }, down = { 0, 0, -1 }, left = { -1, 0, 0 }, right = { 1, 0, 0 }, forward = { 0, 1, 0 }, back = { 0, -1, 0 } }

-- a value written into state as it resolved: an undefined stays UNDEF (a table cannot hold nil); ss prints it null
local function stored(v)
	if v == nil then
		return UNDEF
	end
	return v
end

local function isDict(v)
	return js.isObj(v)
end

local function append(list, items)
	for _, x in ipairs(items) do
		table.insert(list, x)
	end
end

-- ── glob / match / references ────────────────────────────────────────────────────────────────────────────────────
local function matches(ev, matchObj)
	if not isDict(matchObj) then
		return true
	end
	for k, pat in pairs(matchObj) do
		if not js.glob(get(ev, k), pat) then
			return false
		end
	end
	return true
end
bus.matches = matches

-- 'event.<path>' reads from the firing / context event; anything else is literal
local function resolveRef(v, ev)
	if type(v) == "string" and string.sub(v, 1, 6) == "event." then
		local cur = ev
		for part in string.gmatch(string.sub(v, 7) .. ".", "([^.]*)%.") do
			if js.isNullish(cur) then
				return UNDEF
			end
			if js.isArr(cur) then
				local idx = (part == "0" or string.match(part, "^[1-9]%d*$")) and tonumber(part) or nil
				if idx == nil or idx >= #cur then
					return UNDEF
				end
				cur = cur[idx + 1]
			elseif isDict(cur) then
				cur = get(cur, part)
			else
				return UNDEF
			end
		end
		return cur
	end
	return v
end
bus.resolveRef = resolveRef

local function resolveFields(o, ev)
	local out = obj()
	for k, v in pairs(o) do
		out[k] = stored(resolveRef(v, ev))
	end
	return out
end

-- ── events ───────────────────────────────────────────────────────────────────────────────────────────────────────
local function normalizeEvent(raw)
	local e = js.copy(raw)
	setmetatable(e, js.OBJ)
	if type(e.type) ~= "string" then
		e.type = (has(e, "type") and truthy(e.type)) and js.str(e.type) or "event"
	end
	if not js.defined(e, "source") then
		e.source = js.defined(e, "a") and e.a or (js.defined(e, "id") and e.id or "")
	end
	if not js.defined(e, "scope") then
		e.scope = NULL
	end
	return e
end
bus.normalizeEvent = normalizeEvent

local function sortKey(e)
	return ss(e)
end
bus.sortKey = sortKey

local function sortEvents(list)
	local keyed = {}
	for i, e in ipairs(list) do
		keyed[i] = { k = sortKey(e), e = e, i = i }
	end
	-- stable, as Array.prototype.sort is: equal keys keep their arrival order
	table.sort(keyed, function(x, y)
		if x.k ~= y.k then
			return js.lt(x.k, y.k)
		end
		return x.i < y.i
	end)
	local out = arr()
	for i, o in ipairs(keyed) do
		out[i] = o.e
	end
	return out
end

-- ── entities ─────────────────────────────────────────────────────────────────────────────────────────────────────
local function addEntity(state, raw)
	local e = obj({
		id = stored(get(raw, "id")),
		type = truthy(get(raw, "type")) and raw.type or "entity",
		on = truthy(get(raw, "on")),
		position = js.isArr(raw.position) and js.copy(raw.position) or arr({ 0, 0, 0 }),
		velocity = js.isArr(raw.velocity) and js.copy(raw.velocity) or arr({ 0, 0, 0 }),
	})
	if has(raw, "pose") then
		e.pose = raw.pose
	end
	if has(raw, "color") then
		e.color = raw.color
	end
	if js.finite(raw.radius) then
		e.radius = raw.radius
	end
	table.insert(state.entities, e)
	state.byId[js.str(e.id)] = e
	return e
end
bus.addEntity = addEntity

local function impulseVec(spec, ev)
	local v = resolveRef(get(spec, "vector"), ev)
	if js.isArr(v) then
		return v
	end
	local dk = resolveRef(get(spec, "dir"), ev)
	local d = (type(dk) == "string" and DIRS[dk]) or { 0, 0, 0 }
	local g0 = resolveRef(get(spec, "gain"), ev)
	local g = js.finite(g0) and g0 or 1
	return arr({ d[1] * g, d[2] * g, d[3] * g })
end

local function clampVar(v, spec)
	if js.finite(spec.min) and v < spec.min then
		v = spec.min
	end
	if js.finite(spec.max) and v > spec.max then
		v = spec.max
	end
	return v
end

local function drop(state, n, reason)
	if n <= 0 then
		return
	end
	local m = state.metrics
	m.dropped += n
	m.capTrips += 1
	table.insert(state.log, obj({ op = "cap", reason = reason, count = n }))
end

-- the spawned id is CONTENT-derived (from the spawning event), so spawn order never changes ids
local function spawnEntity(state, spec, ev)
	local tmpl = isDict(spec.template) and spec.template or obj()
	local at = resolveRef(get(spec, "at"), ev)
	local typ = truthy(tmpl.type) and tmpl.type or (truthy(spec.type) and spec.type or "spawn")
	local id = truthy(tmpl.id) and tmpl.id or (js.str(typ) .. "-" .. js.fnv(sortKey(ev)))
	local raw = obj({
		id = id, type = typ, on = truthy(tmpl.on),
		position = js.isArr(at) and at or (truthy(tmpl.position) and tmpl.position or arr({ 0, 0, 0 })),
		velocity = truthy(tmpl.velocity) and tmpl.velocity or arr({ 0, 0, 0 }),
	})
	local key = js.str(id)
	local e = state.byId[key]
	if e then
		e.type = raw.type
		e.on = raw.on
		e.position = js.copy(raw.position)
		e.velocity = js.copy(raw.velocity)
	else
		addEntity(state, raw)
	end
end

-- one verb, from a reaction or a sequence step; only `emit` returns events
local function applyVerb(state, spec, ev)
	local verb = spec["do"]
	if not truthy(verb) then
		return {}
	end
	if verb == "emit" then
		local out = obj({ type = stored(spec.type) })
		local src = resolveRef(get(spec, "source"), ev)
		out.source = (src == UNDEF or src == nil) and stored(get(ev, "source")) or src
		out.scope = has(spec, "scope") and stored(resolveRef(spec.scope, ev)) or stored(get(ev, "scope"))
		for k, v in pairs(spec) do
			if not RESERVED[k] then
				out[k] = stored(resolveRef(v, ev))
			end
		end
		state.metrics.emitted += 1
		return { out }
	end
	if verb == "spawn" then
		spawnEntity(state, spec, ev)
		return {}
	end
	if verb == "ctrl" then
		local op = obj()
		for k, v in pairs(spec) do
			if k ~= "do" then
				op[k] = stored(resolveRef(v, ev))
			end
		end
		if state._ctrlOps == nil then
			state._ctrlOps = arr()
		end
		table.insert(state._ctrlOps, op)
		return {}
	end
	if verb == "set" then
		local v = resolveRef(get(spec, "to"), ev)
		if type(v) == "number" then
			v = clampVar(v, spec)
		end
		state.vars[js.str(spec.var)] = stored(v)
		return {}
	end
	if verb == "inc" then
		local by = js.toNumber(resolveRef(get(spec, "by"), ev))
		local cur = js.toNumber(get(state.vars, js.str(spec.var)))
		if cur ~= cur or cur == 0 then
			cur = 0
		end
		state.vars[js.str(spec.var)] = clampVar(cur + (js.finite(by) and by or 1), spec)
		return {}
	end

	local tid = resolveRef(get(spec, "target"), ev)
	local tkey = js.str(tid)
	local target = state.byId[tkey]
	if not target then
		if verb == "move" then
			local to = resolveRef(get(spec, "to"), ev)
			if js.isArr(to) then
				if state._ctrlWarps == nil then
					state._ctrlWarps = obj()
				end
				state._ctrlWarps[tkey] = js.copy(to)
				return {}
			end
		end
		state.metrics.noops += 1
		table.insert(state.log, obj({ op = "noop", verb = verb, target = (tid == UNDEF or tid == nil) and NULL or tid }))
		return {}
	end
	if verb == "toggle" then
		if has(spec, "to") then
			target.on = truthy(resolveRef(spec.to, ev))
		else
			target.on = not truthy(target.on)
		end
	elseif verb == "impulse" then
		local iv = impulseVec(spec, ev)
		local vel = target.velocity
		target.velocity = arr({ js.toNumber(vel[1]) + js.toNumber(iv[1]), js.toNumber(vel[2]) + js.toNumber(iv[2]), js.toNumber(vel[3]) + js.toNumber(iv[3]) })
	elseif verb == "move" then
		local to = resolveRef(get(spec, "to"), ev)
		if js.isArr(to) then
			target.position = js.copy(to)
		else
			target.pose = stored(to)
		end
	end
	return {}
end
bus.applyVerb = applyVerb

-- ── watches: edge-detected predicates over vars, entities and the log ───────────────────────────────────────────
local function cmp(v, p)
	if has(p, "eq") then
		return js.strictEq(v, p.eq)
	end
	if has(p, "ne") then
		return not js.strictEq(v, p.ne)
	end
	local ok = true
	if has(p, "gte") then ok = ok and js.rel(v, p.gte, ">=") end
	if has(p, "gt") then ok = ok and js.rel(v, p.gt, ">") end
	if has(p, "lte") then ok = ok and js.rel(v, p.lte, "<=") end
	if has(p, "lt") then ok = ok and js.rel(v, p.lt, "<") end
	return ok
end

local function fieldOf(e, field)
	if field == "x" then return e.position[1] end
	if field == "y" then return e.position[2] end
	if field == "z" then return e.position[3] end
	if type(field) ~= "string" then
		return UNDEF
	end
	return get(e, field)
end

local function matchEntities(state, pat)
	local out = {}
	for _, e in ipairs(state.entities) do
		if js.glob(e.id, pat) then
			table.insert(out, e)
		end
	end
	return out
end

local function evalPredicate(state, when)
	if not isDict(when) then
		return false
	end
	if has(when, "var") then
		return cmp(get(state.vars, js.str(when.var)), when)
	end
	if has(when, "count") then
		local n = 0
		for _, r in ipairs(state.log) do
			if has(r, "type") and js.strictEq(r.type, when.count) then
				n += 1
			end
		end
		return cmp(n, when)
	end
	if has(when, "entity") then
		local e = state.byId[js.str(when.entity)]
		return e ~= nil and cmp(fieldOf(e, get(when, "field")), when)
	end
	if has(when, "all") then
		local es = matchEntities(state, when.all)
		if #es == 0 then
			return false
		end
		for _, e in ipairs(es) do
			if not cmp(fieldOf(e, get(when, "field")), when) then
				return false
			end
		end
		return true
	end
	if has(when, "any") then
		for _, e in ipairs(matchEntities(state, when.any)) do
			if cmp(fieldOf(e, get(when, "field")), when) then
				return true
			end
		end
		return false
	end
	return false
end
bus.evalPredicate = evalPredicate

-- ── sequences (sagas): ordered steps, one instance per resolved scope ───────────────────────────────────────────
local runForward

local function sagasSorted(state)
	local list = table.clone(state.sagas)
	table.sort(list, function(a, b) return js.lt(a.key, b.key) end)
	return list
end

local function instantiate(state, def, ev)
	local scope = has(def, "scope") and resolveRef(def.scope, ev) or NULL
	local key = js.str(get(def, "id")) .. " " .. ss(scope)
	if state.sagaIndex[key] then
		return {}
	end
	local ctx = js.copy(ev)
	if scope ~= NULL and scope ~= UNDEF and scope ~= nil then
		ctx.scope = scope
	end
	local saga = { def = def, key = key, scope = scope, ctx = ctx, stepIndex = 0, awaiting = nil, done = false }
	table.insert(state.sagas, saga)
	state.sagaIndex[key] = saga
	return runForward(state, saga)
end

function runForward(state, saga)
	local steps = js.isArr(saga.def.steps) and saga.def.steps or {}
	local out = {}
	while saga.stepIndex < #steps do
		local step = steps[saga.stepIndex + 1]
		if truthy(step["do"]) then
			append(out, applyVerb(state, step, saga.ctx))
		end
		if has(step, "await") then
			local aw = step.await
			if aw == "done" then
				saga.stepIndex += 1
				continue
			end
			if isDict(aw) and has(aw, "timer") and aw.timer ~= NULL then
				saga.awaiting = { timer = resolveRef(aw.timer, saga.ctx) }
				return out
			end
			local rest = obj()
			if isDict(aw) then
				for k, v in pairs(aw) do
					if k ~= "on" then
						rest[k] = v
					end
				end
			end
			saga.awaiting = { type = isDict(aw) and get(aw, "on") or UNDEF, match = resolveFields(rest, saga.ctx) }
			return out
		end
		saga.stepIndex += 1
	end
	saga.done = true
	local sagas = state.sagas
	for i, s in ipairs(sagas) do
		if s == saga then
			table.remove(sagas, i)
			break
		end
	end
	if state.sagaIndex[saga.key] == saga then
		state.sagaIndex[saga.key] = nil
	end
	return out
end

local function awaitMatches(awaiting, ev)
	local t = awaiting.type
	return t ~= nil and t ~= UNDEF and js.strictEq(get(ev, "type"), t) and matches(ev, awaiting.match)
end

local function advanceSaga(state, saga)
	saga.awaiting = nil
	saga.stepIndex += 1
	return runForward(state, saga)
end

-- a reaction's `if`: it matches only while its predicate holds, read against the state the reactions before it left
local function reactionMatch(state, ev, r)
	return js.strictEq(get(ev, "type"), get(r, "on")) and matches(ev, isDict(r.match) and r.match or obj())
		and (not truthy(r["if"]) or evalPredicate(state, r["if"]))
end

local function triggerMatch(ev, s)
	local tr = s.trigger
	if not truthy(tr) or not isDict(tr) then
		return false
	end
	if not js.strictEq(get(ev, "type"), get(tr, "on")) then
		return false
	end
	local rest = obj()
	for k, v in pairs(tr) do
		if k ~= "on" then
			rest[k] = v
		end
	end
	return matches(ev, rest)
end

-- ── state ────────────────────────────────────────────────────────────────────────────────────────────────────────
function bus.createBusState(config, initialEntities)
	local c = isDict(config) and config or obj()
	local state = {
		config = { budget = js.finite(c.budget) and c.budget or 4096, depthCap = js.finite(c.depthCap) and c.depthCap or 8 },
		reactions = js.isArr(c.reactions) and c.reactions or arr(),
		seqDefs = js.isArr(c.sequences) and c.sequences or arr(),
		watches = js.isArr(c.watches) and c.watches or arr(),
		timers = js.isArr(c.timers) and c.timers or arr(),
		vars = isDict(c.vars) and js.copy(c.vars) or obj(),
		entities = arr(), byId = {}, _linked = {},
		sagas = {}, sagaIndex = {},
		log = arr(),
		_watchPrev = {}, _timerAcc = {},
		metrics = { processed = 0, emitted = 0, dropped = 0, capTrips = 0, noops = 0, maxDepth = 0 },
	}
	if js.isArr(initialEntities) then
		for _, e in ipairs(initialEntities) do
			addEntity(state, e)
		end
	end
	return state
end

-- an edge-triggered event for each watch that newly holds
function bus.watchEvents(state)
	local out = {}
	for i, w in ipairs(state.watches) do
		local now = evalPredicate(state, w.when)
		local key = "w" .. (i - 1)
		if now and not truthy(state._watchPrev[key]) then
			local ev = obj({ type = stored(get(w, "type")), source = stored(get(w, "type")), scope = has(w, "scope") and w.scope or NULL })
			for k, v in pairs(w) do
				if k ~= "type" and k ~= "when" and k ~= "scope" then
					ev[k] = v
				end
			end
			table.insert(out, ev)
		end
		state._watchPrev[key] = now
	end
	return out
end

-- drain a tick's events to a fixed point: per depth a content sort, then reactions, sequence triggers, saga awaits
function bus.processEvents(state, incoming)
	local cap = state.config
	local frontier = {}
	for _, e in ipairs(incoming) do
		table.insert(frontier, normalizeEvent(e))
	end
	local depth = 0
	local stop = false
	-- the budget caps one drain, never the bus's life (metrics.processed keeps the lifetime total)
	local spent = 0
	while #frontier > 0 and not stop do
		if depth > cap.depthCap then
			drop(state, #frontier, "depth")
			break
		end
		if depth > state.metrics.maxDepth then
			state.metrics.maxDepth = depth
		end
		frontier = sortEvents(frontier)
		local nextEvents = {}
		for i, ev in ipairs(frontier) do
			if spent >= cap.budget then
				drop(state, #frontier - i + 1, "budget")
				stop = true
				break
			end
			spent += 1
			state.metrics.processed += 1
			table.insert(state.log, obj({ type = ev.type, source = stored(get(ev, "source")), scope = stored(get(ev, "scope")), depth = depth }))
			for _, r in ipairs(state.reactions) do
				if reactionMatch(state, ev, r) then
					append(nextEvents, applyVerb(state, r, ev))
				end
			end
			for _, s in ipairs(state.seqDefs) do
				if triggerMatch(ev, s) then
					append(nextEvents, instantiate(state, s, ev))
				end
			end
			for _, saga in ipairs(sagasSorted(state)) do
				if saga.awaiting ~= nil and awaitMatches(saga.awaiting, ev) then
					append(nextEvents, advanceSaga(state, saga))
				end
			end
		end
		if stop then
			drop(state, #nextEvents, "budget")
			break
		end
		depth += 1
		frontier = nextEvents
	end
	return state
end

-- recurring heartbeats: each { every, emit, while? } fires every `every` seconds while its predicate holds
function bus.tickTimers(state, dt)
	local out = {}
	for i, t in ipairs(state.timers) do
		if not isDict(t) or not truthy(t.emit) then
			continue
		end
		if truthy(t["while"]) and not evalPredicate(state, t["while"]) then
			continue
		end
		local key = "t" .. (i - 1)
		local period = js.finite(t.every) and math.max(1e-3, t.every) or 1
		state._timerAcc[key] = (state._timerAcc[key] or 0) + dt
		local guard = 0
		while state._timerAcc[key] >= period and guard < 64 do
			guard += 1
			state._timerAcc[key] -= period
			local ev = obj({ source = stored(get(t.emit, "type")), scope = NULL })
			for k, v in pairs(t.emit) do
				ev[k] = v
			end
			table.insert(out, ev)
		end
	end
	return out
end

-- advance saga timer awaits; returns what an expired one emits
function bus.stepTime(state, dt)
	local emitted = {}
	for _, saga in ipairs(sagasSorted(state)) do
		local aw = saga.awaiting
		if aw ~= nil and aw.timer ~= nil and aw.timer ~= NULL then
			aw.timer = js.toNumber(aw.timer) - dt
			if aw.timer <= 0 then
				append(emitted, advanceSaga(state, saga))
			end
		end
	end
	return emitted
end

-- the canonical snapshot of what happened: entities by id, vars, the durable log, the loud-cap counters
function bus.hashState(state)
	local entities = table.clone(state.entities)
	table.sort(entities, function(a, b) return js.lt(js.str(a.id), js.str(b.id)) end)
	local m = state.metrics
	return ss(obj({
		entities = arr(entities), vars = state.vars, log = state.log,
		metrics = obj({ processed = m.processed, emitted = m.emitted, dropped = m.dropped, capTrips = m.capTrips, noops = m.noops, maxDepth = m.maxDepth }),
	}))
end

-- ── zone facts: entities' positions against declared { type: 'zone' } sources, edge-triggered enter / exit ───────
local function zonePos(e)
	if not isDict(e) then
		return nil
	end
	if isDict(e.transform) then
		return e.transform.pos
	end
	return e.position
end

local function inZone(p, s)
	if not js.isArr(p) then
		return false
	end
	local at = js.isArr(s.at) and s.at or { 0, 0, 0 }
	local dims = truthy(s.planar) and 2 or 3
	if js.isArr(s.half) then
		for i = 1, dims do
			if math.abs(js.toNumber(p[i]) - js.toNumber(at[i])) > js.toNumber(s.half[i]) then
				return false
			end
		end
		return true
	end
	local r = js.finite(s.radius) and s.radius or 1
	local d2 = 0
	for i = 1, dims do
		local dd = js.toNumber(p[i]) - js.toNumber(at[i])
		d2 += dd * dd
	end
	return d2 <= r * r
end

-- `prev` carries the keys inside last step, in the order they went in (JS object order: exits follow it)
function bus.deriveZoneEvents(entities, prev, sources)
	local inside = (type(prev) == "table" and prev.inside) or { keys = {}, set = {} }
	local events = {}
	local cur = { keys = {}, set = {} }
	for _, s in ipairs(sources or {}) do
		if not isDict(s) or s.type ~= "zone" or not truthy(s.zone) then
			continue
		end
		local watch = truthy(s.watch) and s.watch or "*"
		for _, e in ipairs(entities or {}) do
			if not isDict(e) or not truthy(e.id) or truthy(e.gone) then
				continue
			end
			if not js.glob(e.id, watch) then
				continue
			end
			if not inZone(zonePos(e), s) then
				continue
			end
			local key = js.str(s.zone) .. "|" .. js.str(e.id)
			if not cur.set[key] then
				cur.set[key] = true
				table.insert(cur.keys, key)
			end
			if inside.set[key] then
				continue
			end
			local pos = zonePos(e)
			table.insert(events, obj({ type = "enter", zone = s.zone, entity = e.id, source = s.zone, at = js.isArr(pos) and js.copy(pos) or arr() }))
		end
	end
	for _, key in ipairs(inside.keys) do
		if cur.set[key] then
			continue
		end
		local i = string.find(key, "|", 1, true) :: number
		table.insert(events, obj({ type = "exit", zone = string.sub(key, 1, i - 1), entity = string.sub(key, i + 1), source = string.sub(key, 1, i - 1) }))
	end
	return { events = events, prev = { inside = cur } }
end

-- the character intents and warps a tick queued, handed to the kernel's adapters (the web's syncToCtrl), then cleared
function bus.takeCtrl(state)
	local ops = state._ctrlOps or arr()
	local warps = state._ctrlWarps or obj()
	state._ctrlOps = arr()
	state._ctrlWarps = obj()
	return obj({ ops = ops, warps = warps })
end

-- ── one page frame, in the web order (scene/channels/events.js): input → process → watch fixpoint → timers → sagas
-- with stats ({ kernel = K.stats, cfg }, the page's __STATS) each pass first steps them over the ctrl queue: their
-- events are processed before the watches are read, and the loop ends only when neither has anything left
local function watchFix(state, stats)
	for _ = 1, 8 do
		local st = stats and stats.kernel.step(stats.cfg, state) or {}
		if #st > 0 then
			bus.processEvents(state, st)
		end
		local w = bus.watchEvents(state)
		if #w == 0 and #st == 0 then
			break
		end
		if #w > 0 then
			bus.processEvents(state, w)
		end
	end
end
bus.watchFix = watchFix

function bus.frame(state, incoming, dt, stats)
	if #incoming > 0 then
		bus.processEvents(state, incoming)
	end
	watchFix(state, stats)
	local ticks = bus.tickTimers(state, dt)
	if #ticks > 0 then
		bus.processEvents(state, ticks)
	end
	local timed = bus.stepTime(state, dt)
	if #timed > 0 then
		bus.processEvents(state, timed)
	end
	watchFix(state, stats)
end

return bus
end
