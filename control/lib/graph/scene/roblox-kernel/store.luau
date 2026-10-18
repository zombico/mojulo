--!nonstrict
-- mojulo-roblox kernel — THE GAME STORE: a literal port of the web's store kernel (lib/graph/game/store-kernel.js
-- buildGameStoreKernel), laid out as the Godot kernel's store.gd, held equal to the web by the bus conformance corpus's
-- store scenarios. Five slice kinds (character, inventory, party, progression, flags) mutated only by typed events;
-- one write per session (the outcome envelope at a level's exit, validated against the level contract and applied
-- whole, or rejected whole, word for word the web's errors); gates; the map's reachable levels and where an exit leads.
--
--   K.store.createStore(schema) → state
--   K.store.applyEvents(schema, state, events) / applyOutcome(schema, state, contract, envelope) /
--     applyTransit(schema, state, contract, envelope) → { ok, state } | { ok = false, errors }
--   K.store.evalGate(schema, state, gate) → bool;  reachable(schema, state, levels) → { [ref]: bool }
--   K.store.travel(schema, state, levels, from, exit) → ref | js.NULL
--
-- Pure Luau, no host API.

return function(K)
local js = K.js
local NULL, UNDEF = js.NULL, js.UNDEF
local arr, obj, get, truthy = js.arr, js.obj, js.get, js.truthy

local store = {}

local CONTRACT_VERSION = 1
store.CONTRACT_VERSION = CONTRACT_VERSION
local SLICE_KINDS = { "character", "inventory", "party", "progression", "flags" }
local EVENTS_BY_KIND = {
	character = { "setStat", "levelUp" },
	inventory = { "grant", "consume" },
	party = { "recruit", "dismiss", "setStat", "levelUp" },
	progression = { "promote" },
	flags = { "setFlag" },
}
local EVENT_TYPES = { "grant", "consume", "setStat", "levelUp", "setFlag", "promote", "recruit", "dismiss" }

-- JS `a.indexOf(v) >= 0` (strict equality)
local function includes(list, v)
	for _, x in ipairs(list) do
		if js.strictEq(x, v) then
			return true
		end
	end
	return false
end
-- JS `a.join(sep)`: null and undefined join as ''
local function join(list, sep)
	local parts = {}
	for i, x in ipairs(list) do
		parts[i] = (x == NULL or x == UNDEF) and "" or js.str(x)
	end
	return table.concat(parts, sep)
end
-- JS `a && a.k`
local function andGet(a, k)
	if not truthy(a) then
		return a == nil and UNDEF or a
	end
	return get(a, k)
end

-- JSON.parse(JSON.stringify(v)): undefined vanishes from objects (and is undefined alone), NaN and ±Infinity become null
local function clone(v)
	if v == nil or v == UNDEF then
		return UNDEF
	end
	if type(v) == "number" then
		return js.finite(v) and v or NULL
	end
	if type(v) ~= "table" or v == NULL then
		return v
	end
	if js.isArr(v) then
		local out = arr()
		for i = 1, #v do
			local x = v[i]
			out[i] = (x == UNDEF) and NULL or clone(x)
		end
		return out
	end
	local out = obj()
	for k, x in pairs(v) do
		if x ~= UNDEF then
			out[k] = clone(x)
		end
	end
	return out
end

-- JS `x || fallback`
local function orElse(x, fallback)
	if truthy(x) then
		return x
	end
	return fallback
end

local function isPosInt(v)
	return type(v) == "number" and js.finite(v) and v > 0 and math.floor(v) == v
end

local function member(m, idFallback)
	return obj({
		name = orElse(get(m, "name"), idFallback),
		level = js.isNullish(get(m, "level")) and 1 or m.level,
		xp = orElse(get(m, "xp"), 0),
		stats = orElse(clone(get(m, "stats")), obj()),
		tags = orElse(clone(get(m, "tags")), arr()),
	})
end

local function initSlice(kind, init)
	local s = truthy(init) and init or obj()
	if kind == "character" then
		return obj({ level = js.isNullish(get(s, "level")) and 1 or s.level, xp = orElse(get(s, "xp"), 0), stats = orElse(clone(get(s, "stats")), obj()) })
	end
	if kind == "inventory" then
		return obj({ items = orElse(clone(get(s, "items")), obj()) })
	end
	if kind == "party" then
		local roster = obj()
		for id, m in pairs(orElse(get(s, "roster"), obj())) do
			roster[id] = member(orElse(m, obj()), id)
		end
		return obj({ roster = roster })
	end
	if kind == "progression" then
		return obj({ completed = orElse(clone(get(s, "completed")), obj()), unlocked = orElse(clone(get(s, "unlocked")), arr()) })
	end
	if kind == "flags" then
		return obj({ flags = orElse(clone(get(s, "flags")), obj()) })
	end
	error('game-store: unknown slice kind "' .. js.str(kind) .. '" (kinds: ' .. table.concat(SLICE_KINDS, ", ") .. ")")
end

local function slicesOf(schema)
	return (truthy(schema) and js.isArr(schema.slices)) and schema.slices or {}
end

function store.createStore(schema)
	local state = obj()
	for _, sl in ipairs(slicesOf(schema)) do
		if not truthy(sl) or not truthy(get(sl, "name")) then
			error("game-store: bad slice declaration " .. js.json(sl))
		end
		if state[sl.name] then
			error('game-store: duplicate slice name "' .. js.str(sl.name) .. '"')
		end
		state[sl.name] = initSlice(sl.kind, get(sl, "init"))
	end
	return state
end

local function sliceKind(schema, name)
	for _, sl in ipairs(slicesOf(schema)) do
		if js.strictEq(sl.name, name) then
			return sl.kind
		end
	end
	return nil
end
local function firstSliceOfKind(schema, kind)
	for _, sl in ipairs(slicesOf(schema)) do
		if sl.kind == kind then
			return sl.name
		end
	end
	return nil
end

-- ── reducers ─────────────────────────────────────────────────────────────────────────────────────────────────────
local function applyToMember(target, ev, where, errors)
	if ev.type == "setStat" then
		if not truthy(get(ev, "stat")) or type(ev.stat) ~= "string" then
			table.insert(errors, where .. ": setStat needs a stat name")
			return
		end
		local cur = orElse(get(target.stats, ev.stat), 0)
		if js.defined(ev, "delta") and type(ev.delta) == "number" then
			target.stats[ev.stat] = js.toNumber(cur) + ev.delta
		elseif js.defined(ev, "value") and type(ev.value) == "number" then
			target.stats[ev.stat] = ev.value
		else
			table.insert(errors, where .. ": setStat needs numeric value or delta")
		end
	end
	if ev.type == "levelUp" then
		local by = js.defined(ev, "by") and ev.by or 1
		if not isPosInt(by) then
			table.insert(errors, where .. ": levelUp.by must be a positive integer")
			return
		end
		target.level += by
		if type(get(ev, "xp")) == "number" then
			target.xp += ev.xp
		end
	end
end

-- typed events, ATOMICALLY: every event validated first; any failure touches nothing
function store.applyEvents(schema, state, events)
	local errors = {}
	if not js.isArr(events) then
		return { ok = false, errors = arr({ "events must be an array" }) }
	end
	local nxt = clone(state)
	for i, ev in ipairs(events) do
		local where = "events[" .. (i - 1) .. "]"
		if not truthy(ev) or type(ev) ~= "table" then
			table.insert(errors, where .. " must be an object")
			continue
		end
		local etype = get(ev, "type")
		if not includes(EVENT_TYPES, etype) then
			table.insert(errors, where .. '.type "' .. js.str(etype) .. '" is not a typed event (' .. table.concat(EVENT_TYPES, ", ") .. ")")
			continue
		end
		local kind = sliceKind(schema, get(ev, "slice"))
		if not kind then
			table.insert(errors, where .. '.slice "' .. js.str(get(ev, "slice")) .. '" is not a declared slice')
			continue
		end
		if not includes(EVENTS_BY_KIND[kind], etype) then
			table.insert(errors, where .. ': slice "' .. js.str(ev.slice) .. '" (' .. kind .. ') does not accept "' .. etype .. '" (accepts: ' .. table.concat(EVENTS_BY_KIND[kind], ", ") .. ")")
			continue
		end
		local s = nxt[ev.slice]

		if kind == "inventory" then
			local count = js.defined(ev, "count") and ev.count or 1
			if not truthy(get(ev, "item")) or type(ev.item) ~= "string" then
				table.insert(errors, where .. ": needs an item id")
				continue
			end
			if not isPosInt(count) then
				table.insert(errors, where .. ": count must be a positive integer")
				continue
			end
			if etype == "grant" then
				s.items[ev.item] = js.toNumber(orElse(get(s.items, ev.item), 0)) + count
			else
				local have = orElse(get(s.items, ev.item), 0)
				if js.rel(have, count, "<") then
					table.insert(errors, where .. ": cannot consume " .. js.str(count) .. ' × "' .. ev.item .. '" (have ' .. js.str(have) .. ")")
					continue
				end
				if js.strictEq(have, count) then
					s.items[ev.item] = nil
				else
					s.items[ev.item] = have - count
				end
			end
		end

		if kind == "character" then
			applyToMember(s, ev, where, errors)
		end

		if kind == "party" then
			if etype == "recruit" then
				local m = get(ev, "member")
				if not truthy(m) or type(m) ~= "table" or not truthy(get(m, "id")) or type(m.id) ~= "string" then
					table.insert(errors, where .. ": recruit needs member: { id, name?, stats?, ... }")
					continue
				end
				if truthy(get(s.roster, m.id)) then
					table.insert(errors, where .. ': member "' .. m.id .. '" is already in the roster')
					continue
				end
				s.roster[m.id] = member(m, m.id)
			elseif etype == "dismiss" then
				if not truthy(get(ev, "id")) or not truthy(get(s.roster, js.str(ev.id))) then
					table.insert(errors, where .. ': dismiss — no member "' .. js.str(get(ev, "id")) .. '" in the roster')
					continue
				end
				s.roster[js.str(ev.id)] = nil
			else
				if not truthy(get(ev, "id")) or not truthy(get(s.roster, js.str(ev.id))) then
					table.insert(errors, where .. ": " .. etype .. ' on a party needs id of a roster member (no "' .. js.str(get(ev, "id")) .. '")')
					continue
				end
				applyToMember(s.roster[js.str(ev.id)], ev, where, errors)
			end
		end

		if kind == "progression" and etype == "promote" then
			if not truthy(get(ev, "ref")) or type(ev.ref) ~= "string" then
				table.insert(errors, where .. ": promote needs the level ref")
				continue
			end
			local result = js.defined(ev, "result") and ev.result or "success"
			if result ~= "success" and result ~= "fail" then
				table.insert(errors, where .. ": promote.result must be success | fail")
				continue
			end
			s.completed[ev.ref] = result
			if result == "success" and not includes(s.unlocked, ev.ref) then
				table.insert(s.unlocked, ev.ref)
			end
		end

		if kind == "flags" and etype == "setFlag" then
			if not truthy(get(ev, "key")) or type(ev.key) ~= "string" then
				table.insert(errors, where .. ": setFlag needs a key")
				continue
			end
			local v = get(ev, "value")
			local t = type(v)
			if v ~= UNDEF and t ~= "boolean" and t ~= "number" and t ~= "string" then
				table.insert(errors, where .. ": setFlag.value must be boolean | number | string")
				continue
			end
			s.flags[ev.key] = v == UNDEF and true or v
		end
	end
	if #errors > 0 then
		return { ok = false, errors = arr(errors) }
	end
	return { ok = true, state = nxt }
end

-- ── outcome envelopes ────────────────────────────────────────────────────────────────────────────────────────────
function store.validateEnvelope(contract, envelope)
	local errors = {}
	if not truthy(envelope) or type(envelope) ~= "table" then
		return { ok = false, errors = arr({ "envelope must be an object" }) }
	end
	local cv = get(envelope, "contractVersion")
	if not js.strictEq(cv, CONTRACT_VERSION) then
		table.insert(errors, "envelope.contractVersion " .. js.str(cv) .. " ≠ shell contract version " .. CONTRACT_VERSION)
	end
	local produces = truthy(contract) and get(contract, "produces") or UNDEF
	local results = (truthy(produces) and truthy(get(produces, "results"))) and produces.results or { "success", "fail", "abort" }
	if not includes(results, get(envelope, "result")) then
		table.insert(errors, 'envelope.result "' .. js.str(get(envelope, "result")) .. '" not allowed (allowed: ' .. join(results, ", ") .. ")")
	end
	local allowed = (truthy(produces) and truthy(get(produces, "events"))) and produces.events or {}
	local events = js.isArr(envelope.events) and envelope.events or {}
	if not js.isArr(envelope.events) then
		table.insert(errors, "envelope.events must be an array (may be empty)")
	end
	local counts = {}
	for i, ev in ipairs(events) do
		local et, es = andGet(ev, "type"), andGet(ev, "slice")
		local rule = nil
		for _, r in ipairs(allowed) do
			if js.strictEq(r.type, et) and js.strictEq(r.slice, es) then
				rule = r
				break
			end
		end
		if not rule then
			table.insert(errors, "events[" .. (i - 1) .. "] (" .. js.str(et) .. " → " .. js.str(es) .. ") is not declared in the level contract’s produces.events")
			continue
		end
		local k = js.str(rule.type) .. "→" .. js.str(rule.slice)
		local n = (counts[k] or 0) + 1
		counts[k] = n
		if js.defined(rule, "max") and js.rel(n, rule.max, ">") then
			table.insert(errors, "events[" .. (i - 1) .. "] exceeds produces max for " .. k .. " (max " .. js.str(rule.max) .. ")")
		end
	end
	if #errors > 0 then
		return { ok = false, errors = arr(errors) }
	end
	return { ok = true }
end

-- a door crossed: what the session gathered (an envelope whose result is 'transit'), validated and applied whole
function store.applyTransit(schema, state, contract, envelope)
	if not truthy(envelope) or get(envelope, "result") ~= "transit" then
		return { ok = false, errors = arr({ "a door's envelope has result 'transit'" }) }
	end
	local c = js.copy(truthy(contract) and contract or obj())
	setmetatable(c, js.OBJ)
	local p = js.copy(truthy(get(c, "produces")) and c.produces or obj())
	setmetatable(p, js.OBJ)
	p.results = arr({ "transit" })
	c.produces = p
	local v = store.validateEnvelope(c, envelope)
	if not v.ok then
		return { ok = false, errors = v.errors }
	end
	return store.applyEvents(schema, state, orElse(get(envelope, "events"), arr()))
end

-- the one write per session: validate the envelope against the contract, then apply atomically
function store.applyOutcome(schema, state, contract, envelope)
	local v = store.validateEnvelope(contract, envelope)
	if not v.ok then
		return { ok = false, errors = v.errors }
	end
	return store.applyEvents(schema, state, orElse(get(envelope, "events"), arr()))
end

-- ── gates ────────────────────────────────────────────────────────────────────────────────────────────────────────
function store.evalGate(schema, state, gate)
	if not truthy(gate) then
		return true
	end
	if js.defined(gate, "has") then
		local name = orElse(get(gate, "slice"), firstSliceOfKind(schema, "inventory"))
		local s = truthy(name) and get(state, name) or UNDEF
		return truthy(s) and js.rel(orElse(get(s.items, js.str(gate.has)), 0), js.isNullish(get(gate, "count")) and 1 or gate.count, ">=")
	end
	if js.defined(gate, "flag") then
		local name = orElse(get(gate, "slice"), firstSliceOfKind(schema, "flags"))
		local s = truthy(name) and get(state, name) or UNDEF
		if not truthy(s) then
			return false
		end
		local v = get(s.flags, js.str(gate.flag))
		if not js.defined(gate, "equals") then
			return truthy(v)
		end
		return js.strictEq(v, gate.equals)
	end
	if js.defined(gate, "completed") then
		local name = orElse(get(gate, "slice"), firstSliceOfKind(schema, "progression"))
		local s = truthy(name) and get(state, name) or UNDEF
		return truthy(s) and get(s.completed, js.str(gate.completed)) == "success"
	end
	return false
end

-- ── the map ──────────────────────────────────────────────────────────────────────────────────────────────────────
local function isMap(levels)
	for _, lv in ipairs(levels or {}) do
		if truthy(lv) and js.isArr(get(lv, "exits")) and #lv.exits > 0 then
			return true
		end
	end
	return false
end
store.isMap = isMap

function store.reachable(schema, state, levels)
	local open = obj()
	if not isMap(levels) then
		for _, lv in ipairs(levels) do
			open[js.str(lv.ref)] = store.evalGate(schema, state, get(lv, "gate"))
		end
		return open
	end
	local prog = firstSliceOfKind(schema, "progression")
	local done = (prog and truthy(get(state, prog))) and state[prog].completed or obj()
	local found = {}
	if #levels > 0 then
		found[js.str(levels[1].ref)] = true
	end
	for _, lv in ipairs(levels) do
		if get(done, js.str(lv.ref)) ~= "success" then
			continue
		end
		for _, x in ipairs(js.isArr(get(lv, "exits")) and lv.exits or {}) do
			if store.evalGate(schema, state, get(x, "gate")) then
				found[js.str(x.to)] = true
			end
		end
	end
	for _, lv in ipairs(levels) do
		open[js.str(lv.ref)] = found[js.str(lv.ref)] == true and store.evalGate(schema, state, get(lv, "gate"))
	end
	return open
end

-- where a level's exit leads, when that exit is open: the level ref, or null
function store.travel(schema, state, levels, from, exit)
	local lv = nil
	for _, l in ipairs(levels or {}) do
		if truthy(l) and js.strictEq(l.ref, from) then
			lv = l
			break
		end
	end
	local x = nil
	if lv then
		for _, e in ipairs(js.isArr(get(lv, "exits")) and lv.exits or {}) do
			if js.strictEq(e.id, exit) then
				x = e
				break
			end
		end
	end
	if x and store.evalGate(schema, state, get(x, "gate")) then
		return x.to
	end
	return NULL
end

return store
end
