--!strict
-- mojulo-roblox kernel — ONE LEVEL, stepped: the page's frame (scene/channels/events.js) over where the place's bodies
-- stand. The host (the place's server script) reports each frame where every body is, in the recipe's frame (z-up,
-- metres, a walker's position at its eye); the level turns that into zone facts, runs the bus in the page's order
-- (input → process → watch and stats fixpoint → timers → sagas → fixpoint), hands back the warps and intents the bus
-- queued, and lets the game channel hear the frame's log. Nothing here touches a Roblox object: the presenter applies
-- what a step returns. Held equal by the level corpus (lib/graph/scene/level-conformance.js).
--
-- Pure Luau, no host API. A kernel module: the loader hands it the kernel (K.js, K.bus, K.game, K.stats?).
--
--   level.create(events, contract, params)   → L   the bus built from a world's events, its `initial` processed
--   level.fromBus(doc, contract, params)     → L   the same from a pack's bus.json (bus/1: its fragment, the inputs and
--                                                stats beside it); no document, a level with no behaviour
--   level.keyEvents(L, key)                  → [event]   the events.inputs a key (the page's KeyboardEvent.key) emits
--   level.step(L, walkers, extra, dt)        → { ops, warps, bodies }   walkers: [{ id, transform: { pos } }]
--   L.channel                                the game channel (kernel/game.luau: envelope, door, ended, entry)

return function(K)
local js, bus, game = K.js, K.bus, K.game
local arr, obj, get, truthy = js.arr, js.obj, js.get, js.truthy

local level = {}

function level.create(events: any, contract: any, params: any): any
	local cfg = js.isObj(events) and events or obj()
	local L = {
		events = cfg,
		bus = bus.createBusState(js.dup(cfg), js.dup(js.isArr(get(cfg, "entities")) and cfg.entities or arr())),
		sources = js.isArr(get(cfg, "sources")) and cfg.sources or arr(),
		zonePrev = nil,
		stats = nil,
		channel = game.create(contract, params),
	}
	if js.isObj(get(cfg, "stats")) and K.stats then
		L.stats = { kernel = K.stats, cfg = js.dup(cfg.stats) }
	end
	if js.isArr(get(cfg, "initial")) then
		bus.processEvents(L.bus, js.dup(cfg.initial))
	end
	L.first = game.start(L.channel)
	return L
end

function level.fromBus(doc: any, contract: any, params: any): any
	if doc ~= nil and (not js.isObj(doc) or get(doc, "version") ~= "bus/1" or not js.isObj(get(doc, "fragment"))) then
		error("level: bus.json is not a bus/1 document")
	end
	local events = doc and js.dup(doc.fragment) or obj()
	if doc and js.isArr(get(doc, "inputs")) then
		events.inputs = js.dup(doc.inputs)
	end
	if doc and js.isObj(get(doc, "stats")) then
		events.stats = js.dup(doc.stats)
	end
	return level.create(events, contract, params)
end

function level.keyEvents(L: any, key: string): { any }
	local out = arr()
	for _, i in ipairs(js.isArr(get(L.events, "inputs")) and L.events.inputs or {}) do
		if js.isObj(i) and get(i, "on") == "key" and truthy(get(i, "emit")) then
			local k = get(i, "key")
			if type(k) ~= "string" or k == "" or k == key then
				table.insert(out, js.dup(i.emit))
			end
		end
	end
	return out
end

function level.step(L: any, walkers: { any }, extra: { any }?, dt: number): any
	local st = L.bus
	local n0 = #st.log
	local incoming = arr()
	for _, e in ipairs(L.first) do
		table.insert(incoming, e)
	end
	L.first = arr()
	for _, e in ipairs(extra or {}) do
		table.insert(incoming, e)
	end
	local z = bus.deriveZoneEvents(walkers, L.zonePrev, L.sources)
	L.zonePrev = z.prev
	for _, e in ipairs(z.events) do
		table.insert(incoming, e)
	end
	bus.frame(st, incoming, dt, L.stats)
	local ctrl = bus.takeCtrl(st)
	local bodies = st._statBodyOps or arr()
	st._statBodyOps = arr()
	game.hear(L.channel, st.log, n0)
	return { ops = ctrl.ops, warps = ctrl.warps, bodies = bodies }
end

return level
end
