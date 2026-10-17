-- The Roblox side of the mind conformance corpus (lib/graph/scene/mind-conformance.js), run under Lune: each
-- scenario's cast, combat and minds from bus.json, the pilot's pose replayed from the web's trace, kernel/mind.luau
-- deciding for every mind (with kernel/nav.luau's paths and kernel/group.luau's slots) and kernel/combat.luau firing and
-- swinging for it; one snapshot a frame, printed as the web's snapshot prints it. scripts/conformance.mjs --engine
-- roblox --corpus mind copies this beside the kernel in a scratch folder, runs it and compares.
--
--   lune run conformance.luau <corpus.json> <out.json>

local fs = require("@lune/fs")
local process = require("@lune/process")

local K = {}
K.js = require("./kernel/js")
for _, name in { "json", "bus", "rules", "nav", "mind", "group", "cast", "combat" } do
	K[name] = require("./kernel/" .. name)(K)
end
local js, json, cast, combat = K.js, K.json, K.cast, K.combat
local arr, obj, get, NULL = js.arr, js.obj, js.get, js.NULL

local function N(v)
	if v == nil then
		return NULL
	end
	return v
end
-- a pose to 1e-9 (the corpus says why)
local function nano(x)
	if js.isNullish(x) then
		return NULL
	end
	return math.floor(x * 1e9 + 0.5) / 1e9
end
local function nanos(v)
	local out = arr()
	for i, x in ipairs(v) do
		out[i] = nano(x)
	end
	return out
end
-- JS `v || 0`
local function orZero(v)
	return js.truthy(v) and v or 0
end

-- a poke's dotted key into the entity (the web's body.hp is the cast's hp)
local function poke(e, key, value)
	local ks = string.split((string.gsub(key, "body%.hp", "hp")), ".")
	local t = e
	for i = 1, #ks - 1 do
		t = t[ks[i]]
	end
	t[ks[#ks]] = value
end

local WEAPON_STATE = { "ammo", "reserve", "cooldownT", "reloading", "reloadT", "shots" }

local function snapshot(st, F, mindIds, bodyIds, events)
	local minds = obj()
	for _, id in ipairs(mindIds) do
		local e = st.byId[id]
		local m = obj({
			pos = nanos(e.pos), heading = nano(e.heading), pitch = nano(e.pitch or 0),
			fire = js.truthy(e.aiFire) and 1 or 0, loco = N(e.locomotion), moving = js.truthy(e.moving),
			cover = type(e.coverAt) == "table" and nanos(e.coverAt) or NULL,
			seen = type(e.lastSeen) == "table" and nano(e.lastSeen.t) or NULL, sightings = e.sightings or 0,
			search = nano(e.searchT), dodge = nano(e.dodgeT), dodgeCd = nano(orZero(e.dodgeCdT)),
			swing = nano(e.swingT), strikeCd = nano(orZero(e.strikeCdT)), slot = orZero(e.loadoutIdx), ready = nano(orZero(e.readyT)),
			phase = N(e.mindPhase), path = type(e.navPath) == "table" and #e.navPath or NULL,
			warn = N(e.warnFor), graze = nano(orZero(e.grazeT)),
		})
		if js.isObj(e.weapon) then
			local ws = arr()
			for i, k in ipairs(WEAPON_STATE) do
				local v = e.weapon[k]
				ws[i] = type(v) == "number" and nano(v) or N(v)
			end
			m.weapon = ws
		end
		minds[id] = m
	end
	local bodies = obj()
	for _, id in ipairs(bodyIds) do
		local e = st.byId[id]
		bodies[id] = obj({ hp = js.finite(e.hp) and nano(e.hp) or NULL, hits = e.hits or 0, downed = js.truthy(e.downed), stagger = nano(e.staggerT), react = js.finite(e.poise) and N(e.reactClip) or NULL })
	end
	local rounds = arr()
	for _, p in ipairs(F.projectiles) do
		table.insert(rounds, arr({ nanos(p.pos), nanos(p.vel) }))
	end
	local seen = arr()
	for _, ev in ipairs(events) do
		if ev.type == "seen" then
			table.insert(seen, arr({ ev.entity, N(ev.target) }))
		end
	end
	return js.ss(obj({ minds = minds, bodies = bodies, rounds = rounds, seen = seen }))
end

local corpus = json.decode(fs.readFile(process.args[1]))
local results = obj()
for _, sc in ipairs(corpus) do
	local st = cast.create(sc.cast)
	local F = combat.new()
	F:arm(st, sc.combat)
	F:armMinds(st, sc.minds)
	local hero = st.byId.p
	cast.facts(st)
	local snaps = arr()
	for _, f in ipairs(sc.frames) do
		if js.isArr(get(f, "poke")) then
			for _, p in ipairs(f.poke) do
				poke(st.byId[p.id], js.str(p.key), js.dup(p.value))
			end
		end
		local pose = f.pilot
		F:step(st, hero, f.input, f.dt, js.truthy(pose.grounded), { pos = pose.pos, heading = pose.heading, pitch = pose.pitch })
		cast.step(st, f.dt)
		table.insert(snaps, snapshot(st, F, sc.mindIds, sc.bodyIds, cast.facts(st)))
		if js.isArr(get(f, "ops")) then
			cast.ops(st, f.ops)
		end
	end
	results[sc.id] = snaps
end
fs.writeFile(process.args[2], json.encode(results))
