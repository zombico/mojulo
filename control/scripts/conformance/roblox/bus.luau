-- The Roblox side of the bus conformance corpus (lib/graph/scene/bus-conformance.js), run under Lune: every scenario
-- through kernel/bus.luau in the web page's frame order, each frame's snapshot written out; the store scenarios through
-- kernel/store.luau, each op's result. scripts/conformance.mjs --engine roblox --corpus bus copies this beside the
-- kernel in a scratch folder, runs it and compares.
--
--   lune run conformance.luau <corpus.json> <out.json>

local fs = require("@lune/fs")
local process = require("@lune/process")

-- the kernel, loaded as a Roblox place loads it: each module handed the kernel it needs
local K = {}
K.js = require("./kernel/js")
for _, name in { "json", "stats", "bus", "store" } do
	local ok, mod = pcall(require, "./kernel/" .. name)
	if ok then
		K[name] = mod(K)
	end
end
local js, json, bus = K.js, K.json, K.bus
local arr, obj, get = js.arr, js.obj, js.get

-- a store scenario: each op's result (a gate's bool; the reachable map; where an exit leads; a write's ok, errors and
-- the state after), the state carried only when a write is ok, printed as the web prints it (bus-conformance.js)
local function runStore(sc)
	local S = K.store
	local schema = sc.schema
	local state = S.createStore(schema)
	local out = arr()
	for _, op in ipairs(sc.ops) do
		if js.has(op, "gate") then
			table.insert(out, js.json(S.evalGate(schema, state, op.gate)))
		elseif js.has(op, "reachable") then
			table.insert(out, js.json(S.reachable(schema, state, op.reachable)))
		elseif js.has(op, "travel") then
			table.insert(out, js.json(S.travel(schema, state, op.travel.levels, get(op.travel, "from"), get(op.travel, "exit"))))
		else
			local r
			if js.has(op, "transit") then
				r = S.applyTransit(schema, state, op.transit.contract, op.transit.envelope)
			elseif js.has(op, "events") then
				r = S.applyEvents(schema, state, op.events)
			else
				r = S.applyOutcome(schema, state, op.outcome.contract, op.outcome.envelope)
			end
			if r.ok then
				state = r.state
			end
			local snap = obj({ ok = r.ok, state = state })
			if not r.ok then
				snap.errors = r.errors
			end
			table.insert(out, js.json(snap))
		end
	end
	return out
end

local corpus = json.decode(fs.readFile(process.args[1]))
local results = obj()
for _, sc in ipairs(corpus) do
	if js.truthy(get(sc, "store")) then
		if K.store then
			results[sc.id] = runStore(sc)
		end
		continue
	end
	local config = js.isObj(sc.config) and sc.config or obj()
	local st = bus.createBusState(js.dup(config), js.dup(js.isArr(sc.entities) and sc.entities or arr()))
	local stats = nil
	if js.isObj(sc.stats) then
		if not K.stats then
			continue
		end
		stats = { kernel = K.stats, cfg = js.dup(sc.stats) }
	end
	local sources = js.isArr(config.sources) and config.sources or arr()
	local zonePrev = nil
	local snaps = arr()
	for _, f in ipairs(sc.frames) do
		local incoming = js.dup(js.isArr(f.events) and f.events or arr())
		if js.isArr(f.walkers) then
			local z = bus.deriveZoneEvents(js.dup(f.walkers), zonePrev, sources)
			zonePrev = z.prev
			for _, e in ipairs(z.events) do
				table.insert(incoming, e)
			end
		end
		local dt = js.truthy(get(f, "dt")) and f.dt or 0
		bus.frame(st, incoming, dt, stats)
		local ctrl = bus.takeCtrl(st)
		local bodies = ""
		if stats then
			bodies = "|" .. js.json(st._statBodyOps or arr())
			st._statBodyOps = arr()
		end
		table.insert(snaps, bus.hashState(st) .. "|" .. js.json(ctrl) .. bodies)
	end
	results[sc.id] = snaps
end
fs.writeFile(process.args[2], json.encode(results))
