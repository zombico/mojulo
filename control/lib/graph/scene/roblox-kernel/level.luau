--!strict
-- mojulo-roblox kernel — ONE LEVEL, stepped: the page's frame (scene/channels/events.js, then the world's step;
-- game/level-sim.js) over where the place's bodies stand. The host (the place's server script) reports each frame where
-- its own bodies are, in the recipe's frame (z-up, recipe units, a walker's position at its eye); the level turns that
-- into zone facts, runs the bus in the page's order (input → process → watch and stats fixpoint → timers → sagas →
-- fixpoint), hands the cast the intents the bus queued and back the warps, plays the scenes, steps the cast and the
-- fight, and lets the game channel hear the frame's log. Nothing here touches a Roblox object: the presenter applies
-- what a step returns. Held equal by the level corpus (the bus and the channel over a track) and the levelcast corpus
-- (a whole level with its cast, fight and minds over the pilot's poses) in lib/graph/scene/level-conformance.js.
--
-- A WHOLE LEVEL (bus.json carrying `cast`): the cast (kernel/cast.luau) is built from its rows, the fight
-- (kernel/combat.luau) from `combat` and the minds from `minds`, the scenes (kernel/scenes.luau) and the quests'
-- journal (kernel/quests.luau) from theirs. A frame then runs as the web's does:
--   1 zone facts over every cast body where the last frame left it (the host's pilot as it was last placed; one sent
--     away stands in no zone, one downed still does), then any walker the cast does not hold
--   2 the cast's facts as the last frame left them, read BEFORE the bus (the page's castFacts)
--   3 the bus's frame; its ops to the cast; its warps onto the cast's bodies (the host's own handed back)
--   4 the scenes: the runner hears the log, steps, its beats to the bus and its ops to the cast; while one plays the
--     pilot's input is held
--   5 the world: the fight, the pilot placed where the host reports it WHEN the loop reaches it (the web steps the pilot
--     in its turn among the bodies: a mind before it in the list sees where it stood, one after where it stands), then
--     the rounds in flight and the falls; then the cast's walks and its clock
-- The host's pilot is input: a Roblox Humanoid has moved by the time the server steps (physics runs before Heartbeat),
-- so the pose it reports IS where the pilot's own step left it this frame. That is why one fight call is the web's
-- order exactly; Godot's level.gd splits the fight around its pilot's step because its kernel steps the pilot after
-- the bus. A host that steps its pilot after the level can do the same: step(..., { part = "hero", … }) then settle.
--
-- Pure Luau, no host API. A kernel module: the loader hands it the kernel (K.js, K.bus, K.game; K.stats, K.cast,
-- K.combat with K.rules, K.nav, K.mind and K.group, K.scenes, K.quests when a level carries them).
--
--   level.create(events, contract, params)        → L   the bus built from a world's events, its `initial` processed
--   level.fromBus(doc, contract, params, opts?)   → L   the same from a pack's bus.json (bus/1: its fragment, the inputs,
--                                                     stats, cast, combat, minds, scenes and quests beside it); no
--                                                     document, a level with no behaviour. opts: { ground, pilot }
--                                                     ground: the land a mind stands on, function(pos) → z | nil, or
--                                                     triangles ({ {x,y,z} ×3 } in recipe units, kernel/rules.luau
--                                                     makeGround); pilot: the pilot's id (else the fight's hero, else the
--                                                     first walker the cast holds: the one the minds look for)
--   level.keyEvents(L, key)                       → [event]   the events.inputs a key (the page's KeyboardEvent.key) emits
--   level.step(L, walkers, extra, dt, input?)     → { ops, warps, bodies, cast, scene, quests }
--     walkers  [{ id, transform: { pos }, heading?, pitch?, grounded? }]   the host's bodies; one the cast holds (the
--              pilot) is placed in it, the rest stand in the zones as reported
--     input    the pilot's frame: { fire, forward, strafe, turn, aiToggle, scene: { next, held, skip, move, pick },
--              part? ("hero": the fight's first half only, settle runs the rest) }
--     ops      the intents the bus queued (handed to the cast already when there is one)
--     warps    { [id]: pos } every warp the bus queued (the cast's own applied already; the host moves its own)
--     cast     the cast's bodies to draw, read-only: [{ id, pos, heading, gone, downed, staggerT, reactClip, ... }]
--     scene    the scene runner's view ({ on, bars, line, choice }), or nil
--     quests   the journal's news this frame ([{ kind, name, text? }]), or nil
--   level.settle(L, walkers, dt, input?)          the fight's second half (the minds, the rounds, the falls, the cast's
--                                                 step) after a step whose input says part = "hero", the pilot placed
--                                                 first where the host's own step left it
--   level.body(L, id)                             → a cast body, or nil
--   L.channel                                     the game channel (kernel/game.luau: envelope, door, ended, entry)

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
		cast = nil, fight = nil, hero = nil, scenes = nil, scnSeen = 0, quests = nil, questSeen = 0,
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

-- the land a mind stands on: the host's function, or triangles through kernel/rules.luau (NaN, no land: nil)
local function groundOf(g: any): any
	if type(g) == "function" then
		return g
	end
	if type(g) == "table" and K.rules then
		local land = K.rules.makeGround(g)
		return function(p)
			local z = K.rules.groundAt(land, p)
			if z ~= z then
				return nil
			end
			return z
		end
	end
	return nil
end

function level.fromBus(doc: any, contract: any, params: any, opts: any?): any
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
	local L = level.create(events, contract, params)
	L.pilot = (opts and type((opts :: any).pilot) == "string") and (opts :: any).pilot or nil
	if not doc then
		return L
	end
	-- the cast, and the fight and the minds over it (the level with neither runs the bus alone, as before)
	if js.isArr(get(doc, "cast")) and #doc.cast > 0 and K.cast then
		L.cast = K.cast.create(js.dup(doc.cast))
		local cb, md = get(doc, "combat"), get(doc, "minds")
		if (js.isObj(cb) or js.isObj(md)) and K.combat then
			local F = K.combat.new()
			F:arm(L.cast, js.isObj(cb) and js.dup(cb) or obj())
			if js.isObj(md) then
				F:armMinds(L.cast, js.dup(md))
			end
			local g = groundOf(opts and (opts :: any).ground)
			if g then
				F.groundFn = g
			end
			L.fight = F
			-- the pilot the minds look for and the hero who swings: the fight's own, else the host's (a level whose
			-- guards only watch ships minds and no fight)
			L.hero = js.isObj(cb) and type(get(cb, "hero")) == "string" and cb.hero or nil
		end
		K.cast.facts(L.cast)   -- the first read seeds: nothing the world was minted with fires
	end
	if js.isArr(get(doc, "scenes")) and #doc.scenes > 0 and K.scenes then
		L.scenes = K.scenes.create(js.dup(doc.scenes))
	end
	if js.isArr(get(doc, "quests")) and #doc.quests > 0 and K.quests then
		L.quests = js.dup(doc.quests)
	end
	return L
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

function level.body(L: any, id: string): any
	return L.cast and L.cast.byId[id] or nil
end

-- the host's walker as the pose the fight places (its eye, its heading and pitch)
local function poseOf(w: any): any
	local p = w.transform.pos
	return { pos = { p[1], p[2], p[3] }, heading = js.finite(get(w, "heading")) and w.heading or 0.0, pitch = js.finite(get(w, "pitch")) and w.pitch or 0.0 }
end

-- the host's walkers the cast holds, by id, and the first of them
local function held(L: any, walkers: { any }): (any, string?)
	local out, first = {}, nil
	for _, w in ipairs(walkers) do
		if js.isObj(w) and type(get(w, "id")) == "string" and L.cast.byId[w.id] and js.isObj(get(w, "transform")) and js.isArr(get(w.transform, "pos")) then
			out[w.id] = w
			first = first or w.id
		end
	end
	return out, first
end

-- the cast's ops and the warps onto its bodies (the web's syncToCtrl), the host's own handed back untouched
local function toCast(L: any, ctrl: any, mine: any)
	if #ctrl.ops > 0 then
		K.cast.ops(L.cast, ctrl.ops)
	end
	for _, id in ipairs(js.keys(ctrl.warps)) do
		local e = L.cast.byId[id]
		local to = ctrl.warps[id]
		if e and not mine[id] and js.isArr(to) then
			e.pos = { to[1], to[2], to[3] }
		end
	end
end

-- the world's step: the fight (the pilot placed in its turn), then the cast's walks and clock; a host's other bodies
-- stand where it reports them. `part`: nil (the whole frame), "hero" (the fight's first half only), "minds" (the rest)
local function world(L: any, mine: any, first: string?, input: any, dt: number, part: string?)
	local F, st = L.fight, L.cast
	local hid = L.hero or L.pilot or first
	local hero = hid and st.byId[hid] or nil
	local hw = hero and mine[hero.id] or nil
	if F and (hero or F.mind) then
		local pose = hw and poseOf(hw) or nil
		if part == "minds" then
			if hero and pose then
				hero.pos = pose.pos
				hero.heading = pose.heading
				hero.pitch = pose.pitch
			end
			F:step(st, hero, input, dt, hw ~= nil and truthy(get(hw, "grounded")), nil, "minds")
		else
			F:step(st, hero, input, dt, hw ~= nil and truthy(get(hw, "grounded")), pose, part == "hero" and "hero" or "all")
		end
		if part == "hero" then
			return
		end
	end
	for id, w in pairs(mine) do
		if not (F and hero and id == hero.id) then
			local e = st.byId[id]
			local p = poseOf(w)
			e.pos = p.pos
			e.heading = p.heading
		end
	end
	K.cast.step(st, dt)
end

function level.step(L: any, walkers: { any }, extra: { any }?, dt: number, input: any?): any
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
	local mine, first = {}, nil
	if L.cast then
		mine, first = held(L, walkers)
	end
	-- 1 the zone facts: every cast body where the last frame left it, then the host's bodies the cast does not hold
	local zoned = walkers
	if L.cast then
		zoned = arr()
		for _, e in ipairs(L.cast.entities) do
			table.insert(zoned, obj({ id = e.id, position = e.pos, gone = e.gone }))
		end
		for _, w in ipairs(walkers) do
			if js.isObj(w) and not mine[js.str(get(w, "id"))] then
				table.insert(zoned, w)
			end
		end
	end
	local z = bus.deriveZoneEvents(zoned, L.zonePrev, L.sources)
	L.zonePrev = z.prev
	for _, e in ipairs(z.events) do
		table.insert(incoming, e)
	end
	-- 2 the cast's facts as the last frame left them, before the bus
	if L.cast then
		for _, e in ipairs(K.cast.facts(L.cast)) do
			table.insert(incoming, e)
		end
	end
	-- 3 the bus, its ops and warps
	bus.frame(st, incoming, dt, L.stats)
	local ctrl = bus.takeCtrl(st)
	local bodies = st._statBodyOps or arr()
	st._statBodyOps = arr()
	-- a level of the bus alone: its warps and intents handed back, the channel told
	if not L.cast and not L.scenes and not L.quests then
		game.hear(L.channel, st.log, n0)
		return { ops = ctrl.ops, warps = ctrl.warps, bodies = bodies }
	end
	if L.cast then
		toCast(L, ctrl, mine)
	end
	-- 4 the scenes: the log heard since the last step, the frame's presses, the beats to the bus, the ops to the cast
	local view = nil
	local inp = js.isObj(input) and input or obj()
	if L.scenes then
		local types = arr()
		for i = L.scnSeen + 1, #st.log do
			local t = get(st.log[i], "type")
			if type(t) == "string" then
				table.insert(types, t)
			end
		end
		L.scnSeen = #st.log
		K.scenes.hear(L.scenes, types)
		local c = js.isObj(get(inp, "scene")) and js.copy(inp.scene) or obj()
		c.vars = st.vars
		local o = K.scenes.step(L.scenes, dt, c)
		if #o.fire > 0 then
			local fire = arr()
			for _, t in ipairs(o.fire) do
				table.insert(fire, obj({ type = t }))
			end
			bus.processEvents(st, fire)
			bus.watchFix(st, L.stats)
			local more = bus.takeCtrl(st)
			for _, id in ipairs(js.keys(more.warps)) do
				ctrl.warps[id] = more.warps[id]
			end
			for _, op in ipairs(more.ops) do
				table.insert(ctrl.ops, op)
			end
			if L.cast then
				toCast(L, more, mine)
			end
		end
		if #o.ops > 0 and L.cast then
			K.cast.ops(L.cast, o.ops)
		end
		view = K.scenes.view(L.scenes)
	end
	-- the journal's news: the flags the frame set
	local news = nil
	if L.quests then
		local set = arr()
		for i = L.questSeen + 1, #st.log do
			local t = get(st.log[i], "type")
			if type(t) == "string" and string.sub(t, 1, 5) == "flag:" then
				table.insert(set, string.sub(t, 6))
			end
		end
		L.questSeen = #st.log
		news = K.quests.news(L.quests, set)
	end
	-- 5 the world: while a scene plays the pilot's input is held, the world steps on
	if L.cast then
		local pilotIn = (view and truthy(get(view, "on"))) and obj() or inp
		world(L, mine, first, pilotIn, dt, get(inp, "part") == "hero" and "hero" or nil)
	end
	game.hear(L.channel, st.log, n0)
	return { ops = ctrl.ops, warps = ctrl.warps, bodies = bodies, cast = L.cast and L.cast.entities or nil, scene = view, quests = news }
end

function level.settle(L: any, walkers: { any }, dt: number, input: any?)
	if not L.cast then
		return
	end
	local mine, first = held(L, walkers)
	world(L, mine, first, js.isObj(input) and input or obj(), dt, "minds")
end

return level
end
