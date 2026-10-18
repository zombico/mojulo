-- The Roblox side of the combat conformance corpus (lib/graph/scene/combat-conformance.js), run under Lune: each
-- scenario's cast and combat from bus.json, the hero's pose replayed from the web's trace, kernel/combat.luau's strike,
-- contacts and hits, and kernel/cast.luau's facts; one snapshot a frame, printed as the web's snapshot prints it.
-- scripts/conformance.mjs --engine roblox --corpus combat copies this beside the kernel in a scratch folder, runs it and
-- compares.
--
--   lune run conformance.luau <corpus.json> <out.json>

local fs = require("@lune/fs")
local process = require("@lune/process")

-- the kernel, loaded as a Roblox place loads it: each module handed the kernel it needs
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
-- a round's flight to 1e-9 (the corpus says why)
local function nano(x)
	return math.floor(x * 1e9 + 0.5) / 1e9
end
local function nanos(v)
	local out = arr()
	for i, x in ipairs(v) do
		out[i] = nano(x)
	end
	return out
end

local WEAPON_STATE = { "ammo", "reserve", "cooldownT", "reloading", "reloadT", "burstLeft", "shots", "prevFire", "charging", "chargeT", "chargeReady", "energy", "energyLock" }

local function snapshot(st, F, ids, events)
	local h = st.byId.hero
	local bodies = obj()
	for _, id in ipairs(ids) do
		local e = st.byId[id]
		local b = obj({ hp = N(e.hp), hits = e.hits or 0, by = N(e.lastHitBy), downed = e.downed == true, pos = js.arr({ nano(e.pos[1]), nano(e.pos[2]), nano(e.pos[3]) }), hittable = js.truthy(e.hittable), invincible = js.truthy(e.invincible) })
		if js.finite(e.poise) then
			b.poise = e.poise
			b.staggerT = N(e.staggerT)
			b.react = N(e.reactClip)
			b.pause = N(e.downPauseT)
		end
		if js.finite(e.shieldHp) then
			b.shield = e.shieldHp
			b.broken = js.truthy(e.shieldBroken)
		end
		bodies[id] = b
	end
	local facts = arr()
	for _, ev in ipairs(events) do
		local x = obj({ type = ev.type, entity = ev.entity })
		if string.sub(ev.type, 1, 4) == "hit:" or ev.type == "struck" then
			x.by = N(ev.by)
		end
		if ev.dmg ~= nil then
			x.dmg, x.harm, x.head = ev.dmg, ev.harm, ev.head
		end
		table.insert(facts, x)
	end
	local hero = obj({
		swingT = N(h.swingT), clip = N(h.swingClip), cd = js.truthy(h.strikeCdT) and h.strikeCdT or 0, combo = js.truthy(h.comboT) and h.comboT or 0,
		chain = js.truthy(h.swingCombo), dir = N(h.lastSwingDir), swings = h.swingCount or 0, dealt = h.meleeHitCount or 0,
		untouchable = js.truthy(h.invincible),
	})
	if js.isObj(h.weapon) then
		local w = obj()
		for _, k in ipairs(WEAPON_STATE) do
			w[k] = N(h.weapon[k])
		end
		hero.weapon = w
	end
	local rounds = arr()
	for _, p in ipairs(F.projectiles) do
		table.insert(rounds, arr({ nanos(p.pos), nanos(p.vel), p.age }))
	end
	local moments = arr()
	for _, m in ipairs(st.moments) do
		local x = obj({ is = m.is, t0 = m.t0, at = nanos(m.at) })
		if not js.isNullish(m["until"]) then
			x["until"] = m["until"]
		end
		if not js.isNullish(m.hit) then
			x.hit = m.hit
			x.to = nanos(m.to)
			x.target = N(m.target)
			x.struck = js.truthy(m.struck)
		end
		if not js.isNullish(m.k) then
			x.k = m.k
			x["for"] = m["for"]
		end
		if not js.isNullish(m.scale) then
			x.scale = m.scale
		end
		table.insert(moments, x)
	end
	return js.ss(obj({ hero = hero, bodies = bodies, rounds = rounds, moments = moments, facts = facts }))
end

local corpus = json.decode(fs.readFile(process.args[1]))
local results = obj()
for _, sc in ipairs(corpus) do
	local st = cast.create(sc.cast)
	local F = combat.new()
	F:arm(st, sc.combat)
	-- the web world's land: flat ground (the corpus's FLAT) and the scenario's boxes, for the walks
	st.walkWorld = { ground = function() return 0.0 end, colliders = F.colliders }
	cast.facts(st)
	local hero = st.byId.hero
	local snaps = arr()
	for _, f in ipairs(sc.frames) do
		local fh = f.hero
		hero.pos = { fh.pos[1], fh.pos[2], fh.pos[3] }
		hero.heading = fh.heading
		hero.pitch = fh.pitch
		F:step(st, hero, f.input, f.dt, js.truthy(fh.grounded))
		cast.step(st, f.dt)
		table.insert(snaps, snapshot(st, F, sc.bodies, cast.facts(st)))
		if js.isArr(get(f, "ops")) then
			cast.ops(st, f.ops)
		end
	end
	results[sc.id] = snaps
end
fs.writeFile(process.args[2], json.encode(results))
