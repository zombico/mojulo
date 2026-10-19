--!nonstrict
-- mojulo-roblox kernel — THE MIND: what a non-player body decides, every frame, through the same rules the player's
-- body plays by. A port of the web's mind (lib/graph/worlds/controllable/mind.js, the `ai` rule), laid out as the Godot
-- kernel's mind.gd is (the same module in another language), over the kernel's cast entities (kernel/cast.luau, with
-- kernel/combat.luau's fight fields: pos, heading, pitch, hp, hittable, egg, weapon), in the bus's frame (z-up, recipe
-- units, radians). One frame, in the order the situations are met:
--   commitments  an in-flight roll, charge or swing owns the body and finishes
--   idle         the world switch is off, or nothing to target: stand down (by motivation: guard, escort, wander,
--                territorial, forage; a group member keeps its slot)
--   notice       pickTarget: the pilot, the nearest live body, or the nearest enemy; flee, sentry, cover, perception
--                (sight, memory and search), guard and escort posts, the territorial warning, pathing (kernel/nav.luau)
--   pressed      reflexes on edges: roll off the line after a stagger, roll back off a clash
--   strike       the counter (the opportunist's charge), the blade commit with its timeout and give-up, the trigger
--   engage       spacing by the tool in hand (rush · skirmish · siege), the juke, group slots, space
-- then the detune: aim wobble after every decision. A world's tier (aiDifficulty) and a body's `rule.mind` tune it; a
-- boss crosses health phases and adapts. Held EQUAL to the web frame by frame by the mind conformance corpus
-- (lib/graph/scene/mind-conformance.js), run under Lune. The module holds no state: a mind's lives on its entity.
--
-- Pure Luau, no host API. A kernel module: the loader hands it the kernel (K.js, K.nav, K.rules).
--
--   mind.ai(e, dt, world)        world: { byId, order, colliders, pilotId, aiEnabled, aiTuning, time, ground, navCache }
--   mind.TIERS[aiDifficulty]     the world's tier
--   mind.pickTarget(e, world, policy, skip?)   mind.threatOf(e, world)   mind.hash01(id, n)   mind.idOrder(entities)

return function(K)
local js = K.js
local NULL, UNDEF = js.NULL, js.UNDEF

local mind = {}

local PI = math.pi
local TAU = PI * 2.0
local INF = math.huge
local sin, cos, sqrt, atan2, floor, abs, fmod = math.sin, math.cos, math.sqrt, math.atan2, math.floor, math.abs, math.fmod

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
local function isTable(v)
	return type(v) == "table" and v ~= NULL and v ~= UNDEF
end
local function isDict(v)
	return isTable(v) and not js.isArr(v)
end
local function isList(v)
	return js.isArr(v)
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

-- `d.k ?? x`: the value when present and not null
local function nn(d, k, x)
	if isTable(d) then
		local v = nz(d[k])
		if v ~= nil then
			return v
		end
	end
	return x
end
-- `d.k || x` for a number
local function orf(d, k, x)
	local v = isTable(d) and d[k] or nil
	if type(v) == "number" and truthy(v) then
		return v
	end
	return x
end
local function hyp(a, b)
	return sqrt(a * a + b * b)
end
local function hyp3(a, b, c)
	return sqrt(a * a + b * b + c * c)
end
local function fwdXY(h)
	return { cos(h), sin(h), 0.0 }
end
local function rightXY(h)
	return { sin(h), -cos(h), 0.0 }
end
local function fwd3(h, p)
	return { cos(p) * cos(h), cos(p) * sin(h), sin(p) }
end
local function wrapPi(x)
	return fmod(fmod(x + PI, TAU) + TAU, TAU) - PI
end
local function copy(t)
	local o = {}
	for k, v in pairs(t) do
		o[k] = v
	end
	return o
end
local function merge(t, src)
	for k, v in pairs(src) do
		v = nz(v)
		if v ~= nil then
			t[k] = v
		end
	end
end

-- ── TUNING (mind.js MIND_SKILL / MIND_AGGRESSIVENESS / AI_DIFFICULTY) ───────────────────────────────────────────────
local MIND_SKILL = {
	novice = { aimWobble = 0.09, wobbleHz = 1.7, reactDelay = 1.2, burstMul = 0.5, pauseMul = 2.2 },
	regular = { aimWobble = 0.04, wobbleHz = 1.4, reactDelay = 0.55, burstMul = 0.75, pauseMul = 1.5 },
	veteran = { aimWobble = 0.02, wobbleHz = 1.2, reactDelay = 0.25, burstMul = 0.9, pauseMul = 1.2 },
	ace = { aimWobble = 0.0, wobbleHz = 0.0, reactDelay = 0.0, burstMul = 1.0, pauseMul = 1.0 },
}
-- `passive` is the web's null (no tuning layer): `false` here, a table cannot hold nil
local MIND_AGGRESSIVENESS = {
	passive = false,
	defensive = { dodgeCdMul = 3.0, standoffMul = 1.3, closeMul = 0.55, boostBurstMul = 0.5, boostRestMul = 1.8, noTopple = true },
	wary = { dodgeCdMul = 3.0, standoffMul = 1.3, closeMul = 0.55, boostBurstMul = 0.5, boostRestMul = 1.8, noTopple = true },
	bold = { dodgeCdMul = 1.6, standoffMul = 1.12, closeMul = 0.8, boostBurstMul = 0.75, boostRestMul = 1.3 },
	opportunist = { dodgeCdMul = 1.0, standoffMul = 1.0, closeMul = 1.0, boostBurstMul = 1.0, boostRestMul = 1.0, tackleGuard = true },
	relentless = { dodgeCdMul = 0.8, standoffMul = 0.85, closeMul = 1.2, boostBurstMul = 1.2, boostRestMul = 0.8 },
}
local NEUTRAL_AGGRESSION = { dodgeCdMul = 1.0, standoffMul = 1.0, closeMul = 1.0, boostBurstMul = 1.0, boostRestMul = 1.0 }
local AGGR_KEYS = { "dodgeCdMul", "standoffMul", "closeMul", "boostBurstMul", "boostRestMul", "noTopple", "tackleGuard" }
local TEMPERS = { "passive", "defensive", "wary", "bold", "opportunist", "relentless" }
-- SPACING by the tool in hand: { standoffMul, close, weave }
local SPACING = { rush = { 0.48, 1.0, 0.45 }, skirmish = { 1.0, 0.7, 1.0 }, siege = { 1.55, 0.6, 1.15 } }
local SIDE_STRIKE_YAW = 0.6981317007977318   -- combat-melee.js SIDE_STRIKE_YAW (40°)

local function tier(skill, aggr)
	local t = copy(MIND_SKILL[skill])
	merge(t, MIND_AGGRESSIVENESS[aggr])
	return t
end
mind.TIERS = { easy = tier("novice", "wary"), medium = tier("regular", "bold"), max = tier("ace", "opportunist") }

-- ── seeded dice ──────────────────────────────────────────────────────────────────────────────────────────────────────
-- Math.imul's low 32 bits, unsigned (in halves, so no partial product leaves the double's exact range)
local function imul32(a, b)
	local bl, bh = bit32.band(b, 0xFFFF), bit32.rshift(b, 16)
	local lo = a * bl
	local hi = bit32.band(a * bh, 0xFFFF) * 65536
	return (lo + hi) % 4294967296
end

-- seeded per body (its id and a counter through an FNV-style hash): the same world wanders the same way every run
local function hash01(id, n)
	local s = js.str(id) .. ":" .. js.numStr(n, "NaN")
	local h = 2166136261
	for _, u in ipairs(js.units(s)) do
		h = imul32(bit32.bxor(h, u), 16777619)
	end
	h = bit32.bxor(h, bit32.rshift(h, 13))
	h = imul32(h, 0x5bd1e995)
	h = bit32.bxor(h, bit32.rshift(h, 15))
	return h / 4294967296
end
mind.hash01 = hash01

-- an array index as a JS object holds it first (a canonical integer string below 2^32 - 1)
local function indexKey(s)
	if s == "0" or string.match(s, "^[1-9]%d*$") then
		local n = tonumber(s)
		if n < 4294967295 then
			return n
		end
	end
	return nil
end

-- a body's ids in the web's `for (const id in world.byId)` order: integer keys ascending first, then the rest as placed
function mind.idOrder(entities)
	local ints, rest = {}, {}
	for _, e in ipairs(entities) do
		if indexKey(e.id) then
			table.insert(ints, e.id)
		else
			table.insert(rest, e.id)
		end
	end
	table.sort(ints, function(a, b) return indexKey(a) < indexKey(b) end)
	for _, id in ipairs(rest) do
		table.insert(ints, id)
	end
	return ints
end

-- ── the world's geometry (core.js resolveBlocking / sightBlocked, the ground hook) ────────────────────────────────────
local function segAabbT(a, b, mn, mx)
	local t0 = 0.0
	local t1 = 1.0
	for k = 1, 3 do
		local d = b[k] - a[k]
		if abs(d) < 1e-9 then
			if a[k] < mn[k] or a[k] > mx[k] then
				return nil
			end
		else
			local tn = (mn[k] - a[k]) / d
			local tf = (mx[k] - a[k]) / d
			if tn > tf then
				tn, tf = tf, tn
			end
			if tn > t0 then
				t0 = tn
			end
			if tf < t1 then
				t1 = tf
			end
			if t0 > t1 then
				return nil
			end
		end
	end
	return t0
end

local function sightBlocked(a, b, colliders)
	if not isList(colliders) then
		return false
	end
	for _, c in ipairs(colliders) do
		local t = segAabbT(a, b, c.min, c.max)
		if t ~= nil and t > 1e-3 and t < 1.0 - 1e-3 then
			return true
		end
	end
	return false
end
mind.sightBlocked = sightBlocked

local function groundAt(world, p)
	local g = world.ground
	if type(g) == "function" then
		return g(p)
	end
	return nil
end

-- ── PHASES and ADAPTING (a duelist's ways of switching) ─────────────────────────────────────────────────────────────
local function indexOf(list, v)
	for i, x in ipairs(list) do
		if x == v then
			return i - 1
		end
	end
	return -1
end

local function phasesOf(m)
	if not isDict(m) then
		return {}
	end
	if isList(m.phases) then
		return m.phases
	end
	if m.rank ~= "boss" then
		return {}
	end
	local at = math.max(indexOf(TEMPERS, js.str(nn(m, "aggressiveness", "bold"))), 1)
	return {
		{ below = 2.0 / 3.0, aggressiveness = TEMPERS[math.min(at + 1, #TEMPERS - 1) + 1], shift = 1.0 },
		{ below = 1.0 / 3.0, aggressiveness = "relentless", rule = { meleeSeek = true }, shift = 1.2 },
	}
end

local function layer(t, src)
	if truthy(src.skill) and MIND_SKILL[src.skill] ~= nil then
		merge(t, MIND_SKILL[src.skill])
	end
	if truthy(src.aggressiveness) and MIND_AGGRESSIVENESS[src.aggressiveness] ~= nil then
		for _, k in ipairs(AGGR_KEYS) do
			t[k] = nil
		end
		if MIND_AGGRESSIVENESS[src.aggressiveness] then
			merge(t, MIND_AGGRESSIVENESS[src.aggressiveness])
		end
	end
	if isDict(src.tune) then
		merge(t, src.tune)
	end
end

local function tuningOf(e, world)
	local base = world.aiTuning
	local m = e.rule.mind
	if not truthy(m) then
		return base
	end
	local t = copy(MIND_SKILL.ace)
	merge(t, NEUTRAL_AGGRESSION)
	if isDict(base) then
		merge(t, base)
	end
	layer(t, m)
	local ph = e.mindPhase ~= nil and phasesOf(m)[e.mindPhase + 1] or nil
	if isDict(ph) then
		layer(t, ph)
	end
	return t
end
mind.tuningOf = tuningOf

-- stepPhase: cross every phase the health has fallen under (once per life), patch the rule, hold the SHIFT beat
local function stepPhase(e, r, dt)
	if e.phaseShiftT ~= nil then
		e.phaseShiftT = e.phaseShiftT - dt
		if e.phaseShiftT > 0.0 then
			e.moving = false
			e.invincible = true
			e.locomotion = "phase_shift"
			return true
		end
		e.phaseShiftT = nil
		e.locomotion = "forward"
		if e.cineT == nil then
			e.invincible = false
		end
	end
	local ps = phasesOf(r.mind)
	if #ps == 0 or not (fin(e.hpMax) and e.hpMax > 0.0) or not fin(e.hp) or truthy(e.downed) then
		return false
	end
	local frac = e.hp / e.hpMax
	local nxt = e.mindPhase ~= nil and e.mindPhase + 1 or 0
	local crossed = false
	while nxt < #ps and frac < ps[nxt + 1].below do
		e.mindPhase = nxt
		crossed = true
		if isDict(ps[nxt + 1].rule) then
			merge(r, ps[nxt + 1].rule)
		end
		nxt += 1
	end
	if crossed and nn(ps[e.mindPhase + 1], "shift", 0.0) > 0.0 then
		e.phaseShiftT = ps[e.mindPhase + 1].shift
		e.phaseShifts = (e.phaseShifts or 0) + 1
		e.aiFire = 0
		e.moving = false
		e.invincible = true
		e.locomotion = "phase_shift"
		return true
	end
	return false
end

local function adapts(m)
	return isDict(m) and (m.adapt == true or (m.rank == "boss" and m.adapt ~= false))
end

local function stepAdapt(e, r, dt, world)
	if type(e.adapt) ~= "table" then
		e.adapt = { clock = 0.0, melee = { 0.0, 0.0 }, ranged = { 0.0, 0.0 }, foeId = nil, foeHp = nil, hp = fin(e.hp) and e.hp or 0.0, benched = nil, benchT = 0.0, log = {} }
	end
	local a = e.adapt
	local mode = (e.swingT ~= nil or nn(e, "meleeCommitT", 0.0) > 0.0) and "melee" or "ranged"
	if fin(e.hp) then
		if e.hp < a.hp then
			a[mode][2] += a.hp - e.hp
		end
		a.hp = e.hp
	end
	local foe = a.foeId ~= nil and world.byId[a.foeId] or nil
	if foe ~= nil and fin(foe.hp) and a.foeHp ~= nil and foe.hp < a.foeHp then
		a[mode][1] += a.foeHp - foe.hp
	end
	a.foeHp = (foe ~= nil and fin(foe.hp)) and foe.hp or nil
	if a.benchT > 0.0 then
		a.benchT = a.benchT - dt
		if a.benchT <= 0.0 then
			a.benched = nil
		end
	end
	a.clock = a.clock + dt
	if a.clock >= nn(r, "adaptEvery", 6.0) then
		local margin = nn(r, "adaptMargin", 8.0)
		local nm = a.melee[1] - a.melee[2]
		local nr = a.ranged[1] - a.ranged[2]
		local loser = nil
		if nm < -margin and nm < nr then
			loser = "melee"
		elseif nr < -margin and nr < nm then
			loser = "ranged"
		end
		if loser ~= nil then
			a.benched = loser
			a.benchT = nn(r, "adaptEvery", 6.0)
			table.insert(a.log, loser)
		end
		a.clock = 0.0
		a.melee = { 0.0, 0.0 }
		a.ranged = { 0.0, 0.0 }
	end
end

-- ── STRIKE: the blade (combat-melee.js meleeSwingSpec, combat-hit.js breakGuards) ───────────────────────────────────
local function swingSpec(sc, r, dir, combo)
	local verbs = sc.strikeVerbs
	local sv = (isDict(verbs) and isDict(verbs[dir])) and verbs[dir] or {}
	local contact = nn(sv, "strikeContact", nn(sc, "strikeContact", nz(r.strikeContact)))
	local cone = nn(sv, "strikeCone", nn(sc, "strikeCone", nn(r, "strikeCone", 70)))
	local yaw
	if nz(sv.strikeYaw) ~= nil then
		yaw = sv.strikeYaw * PI / 180.0
	else
		yaw = dir == "left" and SIDE_STRIKE_YAW or (dir == "right" and -SIDE_STRIKE_YAW or 0.0)
	end
	local set = truthy(sv.swingSet) and js.str(sv.swingSet) or (truthy(sc.swingSet) and js.str(sc.swingSet) or "swing")
	return {
		clip = set .. "_" .. dir,
		params = {
			reach = nn(sv, "strikeReach", nn(sc, "strikeReach", nn(r, "strikeReach", nn(r, "speed", 6)))),
			damage = nn(sv, "strikeDamage", nn(sc, "strikeDamage", nn(r, "strikeDamage", 0))),
			impact = nn(sv, "strikeImpact", nn(sc, "strikeImpact", nn(r, "strikeImpact", 0))),
			launch = nn(sv, "strikeLaunch", nn(sc, "strikeLaunch", nn(r, "strikeLaunch", 0))),
			eye = nn(sc, "strikeEye", nn(r, "eye", 0)),
			cosCone = cos(cone * PI / 180.0),
			combo = combo,
			from = (isList(contact) and #contact > 0 and nz(contact[1]) ~= nil) and contact[1] or 0.28,
			to = (isList(contact) and #contact > 1 and nz(contact[2]) ~= nil) and contact[2] or 0.62,
			topple = sv.topple == true or (sv.topple ~= false and dir == "back"),
			aimYaw = yaw,
			fx = nn(sv, "strikeFx", nn(sc, "strikeFx", nn(r, "strikeFx", nil))),
		},
	}
end

local function breakGuards(e)
	if truthy(e.spawnGuard) then
		e.spawnGuard = false
	end
	if nn(e, "wakeGuardT", 0.0) > 0.0 then
		e.wakeGuardT = 0.0
	end
	if e.dodgeT ~= nil then
		e.dodgeSpent = true
	end
	e.downPauseT = nil
	e.invincible = false
end

local function beginSwingDir(e, sc, r, dir, isCombo, noTopple)
	local spec = swingSpec(sc, r, dir, isCombo)
	if isCombo then
		spec.params.topple = true
	end
	if noTopple then
		spec.params.topple = false
	end
	e.swingT = 0.0
	e.swingClip = spec.clip
	e.strikeParams = spec.params
	e.struckThisSwing = {}
	e.swingCount = (e.swingCount or 0) + 1
	e.swingCombo = isCombo
	e.lastSwingDir = dir
	e.swingDur = nn(sc, "strikeDur", nn(r, "strikeDur", 0.9))
	e.swingCd = nn(sc, "strikeCooldown", nn(r, "strikeCooldown", 0))
	local lunge = nn(sc, "strikeLunge", nz(r.strikeLunge))
	if truthy(lunge) then
		e.swingLunge = lunge
	elseif truthy(e.swingLunge) then
		e.swingLunge = 0.0
	end
	breakGuards(e)
end

local function beginSwing(e, sc, r, dif)
	local noTopple = isDict(dif) and truthy(dif.noTopple)
	if r.meleeCombo ~= false or noTopple then
		e.aiSwingAlt = (e.aiSwingAlt or 0) + 1
		local alt = e.aiSwingAlt % 3
		local opener = alt == 0 and "neutral" or (alt == 1 and "left" or "right")
		beginSwingDir(e, sc, r, opener, false, noTopple)
		if noTopple then
			e.swingCd = maxf(orf(e, "swingCd", 0.0), nn(sc, "comboCooldown", nn(r, "comboCooldown", 2.5)))
			e.aiComboWant = false
			return
		end
		e.aiComboWant = true
		e.aiComboCfg = sc
		e.aiComboRule = r
		e.aiComboCooldown = nn(sc, "comboCooldown", nn(r, "comboCooldown", 2.5))
	else
		beginSwingDir(e, sc, r, "back", false, false)
		e.aiComboWant = false
	end
end

-- ── PRESSED: the roll ───────────────────────────────────────────────────────────────────────────────────────────────
local function dodgeExhaust(e, r)
	if nn(r, "dodgeBoostCost", 2.0) <= 0.0 or not truthy(nn(r, "dodgeOverheat", true)) then
		return
	end
	local bm = nn(r, "boostMax", 0.0)
	local win = bm > 0.0 and bm / nn(r, "overheatRegen", bm / 7.5) or 7.5
	e.aiBoostRestT = nn(r, "dodgeExhaust", win)
end

local function rollOff(e, r, dif, dir, rt)
	e.dodgeDir = dir
	local sd = dir[1] * rt[1] + dir[2] * rt[2]
	e.dodgeT = 0.0
	e.dodgeClip = "dodge_sideroll"
	e.dodgeKind = "side"
	e.dodgeSign = sd < 0.0 and -1 or 1
	e.dodgeSpent = false
	e.dodgeCdT = nn(r, "dodgeCooldown", 8.0) * (isDict(dif) and dif.dodgeCdMul or 1.0)
	e.dodgeCount = (e.dodgeCount or 0) + 1
	dodgeExhaust(e, r)
end

-- ── NOTICE: who ─────────────────────────────────────────────────────────────────────────────────────────────────────
local function pickTarget(e, world, policy, skip)
	local target = nil
	if policy == "all" or policy == "enemy" then
		local teamAware = policy == "enemy" and truthy(e.team)
		local bd = INF
		for _, id in ipairs(world.order) do
			local o = world.byId[id]
			if o == e or (skip ~= nil and o == skip) or truthy(o.isCamera) or truthy(o.downed) or truthy(o.invincible) or not truthy(o.hittable) then
				continue
			end
			if teamAware and truthy(o.team) and o.team == e.team then
				continue
			end
			local ddx = o.pos[1] - e.pos[1]
			local ddy = o.pos[2] - e.pos[2]
			local dd = ddx * ddx + ddy * ddy
			if dd < bd then
				bd = dd
				target = o
			end
		end
	elseif world.pilotId ~= nil and world.byId[world.pilotId] ~= nil and not (skip ~= nil and world.byId[world.pilotId] == skip) then
		target = world.byId[world.pilotId]
	end
	return target
end
mind.pickTarget = pickTarget

local function threatOf(e, world)
	local best = nil
	if world.pilotId ~= nil and world.byId[world.pilotId] ~= nil and world.byId[world.pilotId] ~= e then
		best = world.byId[world.pilotId]
	end
	local bd = best ~= nil and hyp(best.pos[1] - e.pos[1], best.pos[2] - e.pos[2]) or INF
	for _, id in ipairs(world.order) do
		local o = world.byId[id]
		if o == e or truthy(o.downed) or not isDict(o.rule) or not isDict(o.rule.mind) or o.rule.mind.motivation ~= "hunt" then
			continue
		end
		if truthy(e.team) and o.team == e.team then
			continue
		end
		local d = hyp(o.pos[1] - e.pos[1], o.pos[2] - e.pos[2])
		if d < bd then
			bd = d
			best = o
		end
	end
	return best
end
mind.threatOf = threatOf

-- ── shared moves ────────────────────────────────────────────────────────────────────────────────────────────────────
local function block(e, r, eye, world)
	if not isList(world.colliders) then
		return
	end
	K.rules.resolveBlocking(e.pos, e.pos[3] - eye, nn(r, "collideHeight", 24.0), nn(r, "collideRadius", 0.0), world.colliders, nn(r, "step", 0.35))
end

local function standOnGround(e, r, eye, world)
	local g = groundAt(world, { e.pos[1], e.pos[2], (e.pos[3] - eye) + nn(r, "collideHeight", 24.0) })
	if g ~= nil then
		e.pos[3] = g + eye
	end
end

local function turnToward(e, want, r, dt)
	local dh = wrapPi(want - e.heading)
	local mt = nn(r, "turn", 1.8) * dt
	e.heading = e.heading + clampf(dh, -mt, mt)
	return wrapPi(want - e.heading)
end

local function nextJuke(e, r, dt)
	local jp = nn(r, "jukePeriod", 0.9)
	e.aiJukeClock = orf(e, "aiJukeClock", 0.0) + dt
	if e.aiJukeClock >= jp then
		e.aiJukeClock = 0.0
		e.aiJukeSide = nn(e, "aiJukeSide", 0) == 1 and -1 or 1
	end
	return truthy(e.aiJukeSide) and e.aiJukeSide or 1
end

local function walkToward(e, r, want, dt, world, speed)
	local eye = nn(r, "eye", 0.0)
	local rem = turnToward(e, want, r, dt)
	local stp = 0.0
	if abs(rem) < 1.1 then
		local f = fwdXY(e.heading)
		stp = speed * dt
		e.pos[1] += f[1] * stp
		e.pos[2] += f[2] * stp
	end
	if isList(world.colliders) then
		block(e, r, eye, world)
	end
	standOnGround(e, r, eye, world)
	if stp > 0.0 then
		e.locomotion = "forward"
		e.gaitPhase = orf(e, "gaitPhase", 0.0) + stp / nn(r, "stride", 2.4)
		e.moving = true
	else
		e.moving = false
	end
	return stp
end

-- PATHING `navmesh`: with the grid line to the goal blocked, walk the path's next corner (replanned every `navReplan` s,
-- or when the goal moves a cell); true while pathing owns the step
local function navTo(e, r, dt, world, goal, speed)
	if not (isDict(r.mind) and r.mind.pathing == "navmesh") or not isList(world.colliders) then
		return false
	end
	local eye = nn(r, "eye", 0.0)
	local opts = { radius = orf(r, "collideRadius", 0.5), height = nn(r, "collideHeight", 24.0), footZ = e.pos[3] - eye, step = nn(r, "step", 0.35) }
	if fin(r.navCell) and r.navCell > 0.0 then
		opts.cell = r.navCell
	end
	if K.nav.clear(world, e.pos, goal, opts) then
		e.navPath = nil
		return false
	end
	local cell
	if truthy(opts.cell) then
		cell = opts.cell
	elseif truthy(world.navCell) then
		cell = world.navCell
	else
		cell = maxf(1.0, opts.radius)
	end
	e.navT = orf(e, "navT", 0.0) - dt
	local moved = e.navGoal == nil or hyp(goal[1] - e.navGoal[1], goal[2] - e.navGoal[2]) > cell
	if e.navPath == nil or e.navT <= 0.0 or moved then
		e.navPath = K.nav.path(world, e.pos, goal, opts)
		e.navGoal = { goal[1], goal[2] }
		e.navT = nn(r, "navReplan", 0.5)
	end
	local p = e.navPath
	if p == nil or #p == 0 then
		return false
	end
	local reach = truthy(opts.cell) and maxf(opts.radius, opts.cell * 0.6) or maxf(1.0, opts.radius)
	while #p > 1 and hyp(p[1][1] - e.pos[1], p[1][2] - e.pos[2]) < reach do
		table.remove(p, 1)
	end
	local wp = p[1]
	walkToward(e, r, atan2(wp[2] - e.pos[2], wp[1] - e.pos[1]), dt, world, speed)
	e.aiFire = 0
	return true
end

-- ── PERCEPTION ──────────────────────────────────────────────────────────────────────────────────────────────────────
local function eyeH(b)
	local rr = b.rule
	local ch = (isDict(rr) and nz(rr.collideHeight) ~= nil) and rr.collideHeight or 24.0
	local ey = isDict(rr) and orf(rr, "eye", 0.0) or 0.0
	return ch * 0.75 - ey
end

local function perceive(e, r, target, world)
	local q = target.pos
	local now = world.time or 0.0
	local dx = q[1] - e.pos[1]
	local dy = q[2] - e.pos[2]
	if hyp(dx, dy) > nn(r, "sightRange", 120.0) then
		return false
	end
	local ls = e.lastSeen
	local recent = type(ls) == "table" and ls.id == target.id and now - ls.t < 0.5
	if not recent then
		local off = atan2(dy, dx) - e.heading
		if abs(atan2(sin(off), cos(off))) > nn(r, "sightCone", 1.2) then
			return false
		end
	end
	if isList(world.colliders) and sightBlocked({ e.pos[1], e.pos[2], e.pos[3] + eyeH(e) }, { q[1], q[2], q[3] + eyeH(target) }, world.colliders) then
		return false
	end
	if not recent then
		e.sightings = (e.sightings or 0) + 1
		e.seenId = target.id
	end
	e.lastSeen = { pos = { q[1], q[2], q[3] }, t = now, id = target.id }
	if e.searchT ~= nil and e.locomotion == "search" then
		e.locomotion = "forward"
	end
	e.searchT = nil
	return true
end

local goTo

-- COVER (opt-in `rule.cover`): hurt or reloading, break for the nearest spot within `radius` the colliders hide from the
-- target's eye (its own eye, the top of its head, its flanks) and hold there facing the target, trigger cold
local function takeCover(e, r, dt, world, target)
	local cfg = type(r.cover) == "boolean" and {} or r.cover
	local now = world.time or 0.0
	if (e.hits or 0) > (e.coverHits or 0) then
		e.coverHits = e.hits
		e.coverUntil = now + nn(cfg, "hold", 2.5)
		e.lastSeen = { pos = { target.pos[1], target.pos[2], target.pos[3] }, t = now, id = target.id }
	end
	local w = e.weapon
	local fear = (isDict(w) and truthy(w.reloading)) or (e.coverUntil ~= nil and now < e.coverUntil)
	if not fear or not isList(world.colliders) then
		e.coverAt = nil
		return false
	end
	local cs = world.colliders
	local q = target.pos
	local from = { q[1], q[2], q[3] + eyeH(target) }
	local eye = nn(r, "eye", 0.0)
	local up = eyeH(e)
	local top = nn(r, "collideHeight", 24.0) - eye
	local flank = orf(r, "collideRadius", 0.5) + 0.2
	local function hides(p)
		local ddx = p[1] - q[1]
		local ddy = p[2] - q[2]
		local dn = hyp(ddx, ddy)
		if dn == 0.0 then
			dn = 1.0
		end
		local sx = (-ddy / dn) * flank
		local sy = (ddx / dn) * flank
		for _, pt in ipairs({ { p[1], p[2], up }, { p[1], p[2], top }, { p[1] + sx, p[2] + sy, up }, { p[1] - sx, p[2] - sy, up } }) do
			if not sightBlocked(from, { pt[1], pt[2], p[3] + pt[3] }, cs) then
				return false
			end
		end
		return true
	end
	if e.coverAt == nil or not hides(e.coverAt) then
		e.coverAt = nil
		local R = nn(cfg, "radius", 8.0)
		local rad = orf(r, "collideRadius", 0.5) + 0.35
		local ring = 1
		while ring <= 4 and e.coverAt == nil do
			local best = nil
			local bd = INF
			for k = 0, 11 do
				local a = (k * TAU) / 12.0 + ring * 0.26
				local d = (R * ring) / 4.0
				local x = e.pos[1] + cos(a) * d
				local y = e.pos[2] + sin(a) * d
				local g = groundAt(world, { x, y, e.pos[3] + 2.0 })
				local p = { x, y, g ~= nil and g + eye or e.pos[3] }
				local inside = false
				for _, c in ipairs(cs) do
					if x > c.min[1] - rad and x < c.max[1] + rad and y > c.min[2] - rad and y < c.max[2] + rad and c.max[3] > p[3] - eye + 0.3 then
						inside = true
						break
					end
				end
				if inside then
					continue
				end
				if not hides(p) then
					continue
				end
				local dd = hyp(x - q[1], y - q[2])
				if dd < bd then
					bd = dd
					best = p
				end
			end
			e.coverAt = best
			ring += 1
		end
	end
	if e.coverAt == nil then
		return false
	end
	local c = e.coverAt
	if hyp(c[1] - e.pos[1], c[2] - e.pos[2]) > 0.4 then
		goTo(e, r, dt, world, c, nn(r, "speed", 6.0) * 1.2)
	else
		e.moving = false
		turnToward(e, atan2(q[2] - e.pos[2], q[1] - e.pos[1]), r, dt)
	end
	e.aiFire = 0
	return true
end

-- MEMORY: walk to the last-seen spot, then SEARCH there; past `memorySpan` or once the search is done, it forgets
local function recall(e, r, dt, world)
	local ls = e.lastSeen
	local now = world.time or 0.0
	if type(ls) ~= "table" or now - ls.t > nn(r, "memorySpan", 8.0) then
		e.lastSeen = nil
		e.searchT = nil
		return false
	end
	local dx = ls.pos[1] - e.pos[1]
	local dy = ls.pos[2] - e.pos[2]
	e.aiFire = 0
	if e.searchT == nil and hyp(dx, dy) > maxf(1.5, orf(r, "collideRadius", 0.0)) then
		if not navTo(e, r, dt, world, ls.pos, nn(r, "speed", 6.0)) then
			walkToward(e, r, atan2(dy, dx), dt, world, nn(r, "speed", 6.0))
		end
		e.searchFrom = e.heading
		return true
	end
	e.searchT = orf(e, "searchT", 0.0) + dt
	if e.searchT > nn(r, "searchTime", 3.0) then
		e.lastSeen = nil
		e.searchT = nil
		e.locomotion = "forward"
		return false
	end
	turnToward(e, nn(e, "searchFrom", e.heading) + sin(e.searchT * 2.1) * 1.4, r, dt)
	e.moving = false
	e.locomotion = "search"
	return true
end

local function wardOf(e, r, world)
	if truthy(r.escort) and world.byId[r.escort] ~= nil then
		return world.byId[r.escort]
	end
	if truthy(e.team) then
		local best = nil
		local bd = INF
		for _, id in ipairs(world.order) do
			local o = world.byId[id]
			if o == e or truthy(o.isCamera) or o.team ~= e.team then
				continue
			end
			local d = hyp(o.pos[1] - e.pos[1], o.pos[2] - e.pos[2])
			if d < bd then
				bd = d
				best = o
			end
		end
		if best ~= nil then
			return best
		end
	end
	local p = world.pilotId ~= nil and world.byId[world.pilotId] or nil
	if p ~= nil and p ~= e then
		return p
	end
	return nil
end

local function homeOf(e, r)
	if isList(r.post) then
		return r.post
	end
	if type(e.home) ~= "table" then
		local src = isDict(e.spawn) and e.spawn.pos or e.pos
		e.home = { src[1], src[2], src[3] }
	end
	return e.home
end

local function postOf(e, r, world)
	if isDict(r.mind) and r.mind.motivation == "escort" then
		local w = wardOf(e, r, world)
		if w ~= nil then
			return w.pos
		end
	end
	if isList(r.post) then
		return r.post
	end
	return isDict(e.spawn) and e.spawn.pos or e.pos
end

local function returnToPost(e, r, dt, world)
	local p = postOf(e, r, world)
	local dx = p[1] - e.pos[1]
	local dy = p[2] - e.pos[2]
	local arrive = (isDict(r.mind) and r.mind.motivation == "escort") and nn(r, "followDist", 6.0) or nn(r, "arrive", 1.5)
	if hyp(dx, dy) <= arrive then
		e.moving = false
		if fin(r.scan) and r.scan > 0.0 then
			if e.scanFrom == nil then
				e.scanFrom = e.heading
			end
			local now = world.time or 0.0
			turnToward(e, e.scanFrom + sin((now * TAU) / nn(r, "scanPeriod", 6.0)) * r.scan, r, dt)
		end
		return
	end
	if not navTo(e, r, dt, world, p, nn(r, "speed", 6.0)) then
		walkToward(e, r, atan2(dy, dx), dt, world, nn(r, "speed", 6.0))
	end
end

-- ── IDLE MOTION ─────────────────────────────────────────────────────────────────────────────────────────────────────
function goTo(e, r, dt, world, goal, speed)
	if not navTo(e, r, dt, world, goal, speed) then
		walkToward(e, r, atan2(goal[2] - e.pos[2], goal[1] - e.pos[1]), dt, world, speed)
	end
end

local function wanderStep(e, r, dt, world, o)
	local home = homeOf(e, r)
	if nn(e, "wanderPauseT", 0.0) > 0.0 then
		e.wanderPauseT = e.wanderPauseT - dt
		e.moving = false
		if truthy(o.pauseLoco) then
			e.locomotion = e.wanderPauseT > 0.0 and o.pauseLoco or "forward"
		end
		return
	end
	if type(e.wanderGoal) ~= "table" then
		e.wanderN = (e.wanderN or 0) + 1
		local n = e.wanderN
		local a = hash01(e.id, 2 * n) * TAU
		local d = sqrt(hash01(e.id, 2 * n + 1)) * nn(r, "wanderRadius", 12.0)
		e.wanderGoal = { home[1] + cos(a) * d, home[2] + sin(a) * d, (#home > 2 and truthy(home[3])) and home[3] or 0.0 }
		e.wanderLegT = 0.0
	end
	local g = e.wanderGoal
	e.wanderLegT = e.wanderLegT + dt
	if hyp(g[1] - e.pos[1], g[2] - e.pos[2]) < 1.0 or e.wanderLegT > 20.0 then
		e.wanderGoal = nil
		local pz = o.pause
		e.wanderPauseT = pz[1] + hash01(e.id, -e.wanderN) * (pz[2] - pz[1])
		e.moving = false
		return
	end
	goTo(e, r, dt, world, g, nn(r, "speed", 6.0) * o.speedMul)
end

local function grazeStep(e, r, dt, world)
	local now = world.time or 0.0
	if nn(e, "grazeT", 0.0) > 0.0 then
		e.grazeT = e.grazeT - dt
		e.moving = false
		e.locomotion = "graze"
		if e.grazeT <= 0.0 then
			e.locomotion = "forward"
			if truthy(e.grazeFood) then
				if type(e.grazed) ~= "table" then
					e.grazed = {}
				end
				e.grazed[e.grazeFood] = now
				e.grazeFood = nil
			end
		end
		return
	end
	local home = homeOf(e, r)
	local food = nil
	local bd = INF
	for _, id in ipairs(world.order) do
		local o = world.byId[id]
		if o == e or not truthy(o.food) then
			continue
		end
		if type(e.grazed) == "table" and e.grazed[o.id] ~= nil and now - e.grazed[o.id] < nn(r, "regrow", 30.0) then
			continue
		end
		local q = o.pos
		if hyp(q[1] - home[1], q[2] - home[2]) > nn(r, "forageRadius", 20.0) then
			continue
		end
		local d = hyp(q[1] - e.pos[1], q[2] - e.pos[2])
		if d < bd then
			bd = d
			food = o
		end
	end
	if food ~= nil then
		if bd < 2.0 then
			e.grazeT = nn(r, "grazeTime", 4.0)
			e.grazeFood = food.id
			e.moving = false
			e.locomotion = "graze"
			return
		end
		goTo(e, r, dt, world, food.pos, nn(r, "speed", 6.0) * 0.6)
		return
	end
	wanderStep(e, r, dt, world, { speedMul = 0.35, pause = { 4.0, 7.0 }, pauseLoco = "graze" })
end

local function idle(e, r, dt, world, motive)
	if truthy(e.groupId) and type(e.groupSlot) == "table" then
		local gs = e.groupSlot
		local d = hyp(gs[1] - e.pos[1], gs[2] - e.pos[2])
		if d > 1.5 then
			goTo(e, r, dt, world, { gs[1], gs[2], e.pos[3] }, nn(r, "speed", 6.0))
		else
			e.moving = false
		end
		return
	end
	if motive == "guard" or motive == "escort" then
		returnToPost(e, r, dt, world)
		return
	end
	if motive == "wander" or motive == "territorial" then
		local wp = nn(r, "wanderPause", 2.0)
		wanderStep(e, r, dt, world, { speedMul = nn(r, "wanderSpeedMul", 0.5), pause = { wp, wp * 2.0 } })
		return
	end
	if motive == "forage" then
		grazeStep(e, r, dt, world)
		return
	end
	e.moving = false
end

-- ── the rule ────────────────────────────────────────────────────────────────────────────────────────────────────────
local function spacingOf(w, ov)
	if isDict(ov) and truthy(ov.style) then
		return js.str(ov.style)
	end
	if not isDict(w) then
		return "skirmish"
	end
	if w.fireClass == "lob" then
		return "siege"
	end
	if w.fireClass == "area" then
		return "rush"
	end
	return "skirmish"
end

local function eggCz(o)
	if isDict(o.egg) then
		local egg = o.egg
		return fin(egg.cz) and egg.cz or nn(egg, "c", 0.0)
	end
	return orf(o, "radius", 0.0)
end

-- maneuvers.js armSwitchReady: a mind pays the loadout switch's ready-time too
local function armSwitchReady(e, r, sc)
	e.readyMax = (isDict(sc) and fin(sc.switchReady)) and sc.switchReady or nn(r, "switchReady", 1.0)
	e.readyT = e.readyMax
end
mind.armSwitchReady = armSwitchReady

local function firstMelee(lo)
	for _, c in ipairs(lo) do
		if isDict(c) and c.strike == "melee" then
			return c
		end
	end
	return nil
end

function mind.ai(e, dt, world)
	local r = e.rule
	local speed = nn(r, "speed", 6.0)
	local strideLen = nn(r, "stride", 2.4)
	local eye = nn(r, "eye", 0.0)
	local m = nz(r.mind)
	if isDict(m) and (nz(m.phases) ~= nil or m.rank == "boss") and stepPhase(e, r, dt) then
		e.aiFire = 0
		return
	end
	if isDict(m) and adapts(m) then
		stepAdapt(e, r, dt, world)
	end
	local dif = tuningOf(e, world)
	e.aiFire = 0
	e.thrust = 0.0
	e.thrustYaw = 0.0
	e.boosting = false
	if nn(e, "aiBoostRestT", 0.0) > 0.0 then
		e.aiBoostRestT = maxf(0.0, e.aiBoostRestT - dt)
	end
	local f = fwdXY(e.heading)
	local rt = rightXY(e.heading)
	local space = truthy(r.space)
	local cols = world.colliders

	-- COMMITMENTS: the roll
	if e.dodgeT ~= nil then
		e.dodgeT = e.dodgeT + dt / nn(r, "dodgeDur", 0.55)
		if e.dodgeT >= 1.0 then
			e.dodgeT = nil
			e.tumble = nil
			e.invincible = false
			e.dodgeDir = nil
		else
			local env = sin(minf(1.0, e.dodgeT) * PI)
			local dsp = nn(r, "dodgeSpeed", speed * 2.6) * env * dt
			if type(e.dodgeDir) == "table" then
				e.pos[1] += e.dodgeDir[1] * dsp
				e.pos[2] += e.dodgeDir[2] * dsp
			end
			if not space and isList(cols) then
				block(e, r, eye, world)
			end
			local gd = (not space) and groundAt(world, e.pos) or nil
			if gd ~= nil then
				e.pos[3] = gd + eye
			end
			e.locomotion = truthy(e.dodgeClip) and e.dodgeClip or "dodge_sideroll"
			e.moving = true
			e.invincible = not truthy(e.dodgeSpent)
			e.gaitPhase = 0.0
			local ang = minf(1.0, e.dodgeT) * nn(r, "dodgeTurns", 1.0) * TAU
			local sg = truthy(e.dodgeSign) and e.dodgeSign or 1.0
			e.tumble = { axis = { f[1] * sg, f[2] * sg, 0.0 }, angle = ang }
			return
		end
	end
	-- the charge
	if e.tackleT ~= nil then
		e.tackleT = e.tackleT + dt / nn(r, "tackleDur", 2.0)
		if e.tackleT >= 1.0 then
			e.tackleT = nil
			e.tackleDir = nil
			if e.cineT == nil then
				e.invincible = false
			end
		else
			local tsp = nn(r, "tackleSpeed", nn(r, "boostSpeed", speed * 3.5)) * dt
			if type(e.tackleDir) == "table" then
				local td = e.tackleDir
				e.pos[1] += td[1] * tsp
				e.pos[2] += td[2] * tsp
				if space and #td > 2 and truthy(td[3]) then
					e.pos[3] += td[3] * tsp
				end
			end
			if not space and isList(cols) then
				block(e, r, eye, world)
			end
			if not space then
				standOnGround(e, r, eye, world)
			end
			e.locomotion = "boost"
			e.moving = true
			e.invincible = true
			e.tumble = nil
			e.gaitPhase = orf(e, "gaitPhase", 0.0) + tsp / strideLen
			e.boosting = true
			e.thrust = 1.0
			return
		end
	end
	-- the swing
	if e.swingT ~= nil then
		e.swingT = e.swingT + dt / orf(e, "swingDur", 0.9)
		e.locomotion = truthy(e.swingClip) and e.swingClip or "swing_neutral"
		e.moving = true
		e.gaitPhase = minf(1.0, e.swingT)
		e.aiFire = 0
		local lungeTo = truthy(e.lungeTo) and world.byId[e.lungeTo] or nil
		local sp = e.strikeParams
		local lungeRoom = lungeTo == nil or hyp(lungeTo.pos[1] - e.pos[1], lungeTo.pos[2] - e.pos[2]) > (isDict(sp) and sp.reach or 1.0) * 0.5
		if truthy(e.swingLunge) and isDict(sp) and e.swingT < sp.to and lungeRoom then
			local lf = fwdXY(e.heading)
			local ls = e.swingLunge * dt
			e.pos[1] += lf[1] * ls
			e.pos[2] += lf[2] * ls
			if not space and isList(cols) then
				block(e, r, eye, world)
			end
		end
		if not space then
			standOnGround(e, r, nn(r, "eye", 0.0), world)
		end
		if e.swingT >= 1.0 then
			if truthy(e.aiComboWant) and not truthy(e.swingCombo) and isDict(e.aiComboCfg) then
				e.aiComboWant = false
				beginSwingDir(e, e.aiComboCfg, isDict(e.aiComboRule) and e.aiComboRule or r, "back", true, false)
			else
				local wasCombo = truthy(e.swingCombo)
				e.swingT = nil
				e.locomotion = "forward"
				e.moving = false
				e.aiComboWant = false
				if wasCombo then
					e.strikeCdT = nn(e, "aiComboCooldown", nn(e, "swingCd", 0))
				else
					e.strikeCdT = nn(e, "swingCd", 0.0) > 0.0 and e.swingCd or orf(e, "strikeCdT", 0.0)
				end
			end
		end
		return
	end

	-- IDLE: the world switch
	if world.aiEnabled == false then
		e.moving = false
		e.reactionEnded = false
		return
	end
	local motive = isDict(m) and nz(m.motivation) or nil
	if motive == "flee" then
		e.reactionEnded = false
		if truthy(e.groupAlarm) and type(e.groupSlot) == "table" then
			local gs = e.groupSlot
			walkToward(e, r, atan2(gs[2] - e.pos[2], gs[1] - e.pos[1]), dt, world, nn(r, "fleeSpeed", speed * 1.6))
			return
		end
		local threat
		if truthy(r.target) then
			threat = pickTarget(e, world, r.target)
		else
			threat = threatOf(e, world)
		end
		if threat == nil or threat == e then
			if truthy(e.groupId) and type(e.groupSlot) == "table" then
				idle(e, r, dt, world, motive)
			else
				e.moving = false
			end
			return
		end
		local fx = e.pos[1] - threat.pos[1]
		local fy = e.pos[2] - threat.pos[2]
		if hyp(fx, fy) < nn(r, "fearRadius", 18.0) then
			walkToward(e, r, atan2(fy, fx), dt, world, nn(r, "fleeSpeed", speed * 1.6))
		elseif truthy(e.groupId) and type(e.groupSlot) == "table" then
			idle(e, r, dt, world, motive)
		else
			e.moving = false
		end
		return
	end
	local livePh = (isDict(m) and e.mindPhase ~= nil) and phasesOf(m)[e.mindPhase + 1] or nil
	local temper = nil
	if isDict(m) then
		if isDict(livePh) and truthy(livePh.aggressiveness) then
			temper = livePh.aggressiveness
		else
			temper = nz(m.aggressiveness)
		end
	end
	if temper == "passive" or (temper == "defensive" and not (fin(e.hpMax) and e.hpMax > 0.0 and fin(e.hp) and e.hp < e.hpMax)) then
		e.reactionEnded = false
		idle(e, r, dt, world, motive)
		return
	end
	-- SENTRY: a body that never moves
	if motive == "sentry" then
		e.moving = false
		local best = nil
		local w0 = e.weapon
		local bd = nn(r, "range", (isDict(w0) and fin(w0.range) and w0.range < 400.0) and w0.range or 16.0)
		for _, id in ipairs(world.order) do
			local o = world.byId[id]
			if o == e or truthy(o.isCamera) or truthy(o.downed) or truthy(o.gone) or not truthy(o.hittable) then
				continue
			end
			if truthy(r.foes) then
				if o.team ~= r.foes then
					continue
				end
			elseif truthy(e.team) and o.team == e.team then
				continue
			end
			local d = hyp(o.pos[1] - e.pos[1], o.pos[2] - e.pos[2])
			if d < bd then
				bd = d
				best = o
			end
		end
		if best == nil then
			e.aiFire = 0
			e.sentryPull = false
			return
		end
		local q = best.pos
		local rem0 = turnToward(e, atan2(q[2] - e.pos[2], q[1] - e.pos[1]), r, dt)
		local tcz = isDict(best.egg) and eggCz(best) or orf(best, "radius", 1.0)
		local weye = isDict(w0) and orf(w0, "eye", 0.0) or 0.0
		e.pitch = clampf(atan2((q[3] + tcz) - (e.pos[3] + weye), bd ~= 0.0 and bd or 1e-6), -1.2, 1.2)
		local onAim = isDict(w0) and abs(rem0) <= (nn(r, "fireArc", 6.0) * PI) / 180.0
		e.sentryPull = onAim and not truthy(e.sentryPull)
		e.aiFire = e.sentryPull and 1 or 0
		return
	end
	-- NOTICE
	local ward = motive == "escort" and wardOf(e, r, world) or nil
	local policy = nz(r.target)
	if policy == nil and motive == "escort" then
		policy = truthy(e.team) and "enemy" or "all"
	end
	local target = pickTarget(e, world, policy, ward)
	if truthy(r.cover) and target ~= nil and target ~= e and takeCover(e, r, dt, world, target) then
		e.reactionEnded = false
		return
	end
	local percept = isDict(m) and nz(m.perception) or nil
	if truthy(percept) and target ~= nil and target ~= e and not perceive(e, r, target, world) and e.groupFocus ~= target.id then
		target = nil
		if percept == "memory" and recall(e, r, dt, world) then
			e.reactionEnded = false
			return
		end
	end
	if target == nil or target == e then
		e.reactionEnded = false
		idle(e, r, dt, world, motive)
		return
	end
	-- GUARD / ESCORT: a target farther than `guardRadius` from the post is not its business
	if motive == "guard" or motive == "escort" then
		local pp = postOf(e, r, world)
		if hyp(target.pos[1] - pp[1], target.pos[2] - pp[2]) > nn(r, "guardRadius", 20.0) then
			e.reactionEnded = false
			e.aiClock = (isDict(dif) and truthy(dif.reactDelay)) and -dif.reactDelay or 0.0
			returnToPost(e, r, dt, world)
			return
		end
	end
	-- TERRITORIAL: warned first, then attacked
	if motive == "territorial" then
		local home = homeOf(e, r)
		local q = target.pos
		if hyp(q[1] - home[1], q[2] - home[2]) > nn(r, "territory", 16.0) then
			e.warnFor = nil
			e.reactionEnded = false
			idle(e, r, dt, world, motive)
			return
		end
		if e.warnFor ~= target.id then
			e.warnFor = target.id
			e.warnT = 0.0
		end
		if e.warnT < nn(r, "warnTime", 1.2) then
			e.warnT = e.warnT + dt
			turnToward(e, atan2(q[2] - e.pos[2], q[1] - e.pos[1]), r, dt)
			e.moving = false
			e.locomotion = "warn"
			e.aiFire = 0
			e.reactionEnded = false
			return
		end
		if e.locomotion == "warn" then
			e.locomotion = "forward"
		end
	end
	if type(e.adapt) == "table" and e.adapt.foeId ~= target.id then
		e.adapt.foeId = target.id
		e.adapt.foeHp = fin(target.hp) and target.hp or nil
	end
	-- PATHING
	if navTo(e, r, dt, world, target.pos, speed) then
		e.reactionEnded = false
		return
	end
	local dx = target.pos[1] - e.pos[1]
	local dy = target.pos[2] - e.pos[2]
	local dist2d = hyp(dx, dy)
	if dist2d == 0.0 then
		dist2d = 1e-6
	end

	-- PRESSED: just recovered from a stagger
	if truthy(e.reactionEnded) then
		e.reactionEnded = false
		if r.dodge ~= false and nn(e, "dodgeCdT", 0.0) <= 0.0 then
			e.aiDodgeSide = nn(e, "aiDodgeSide", 0) == 1 and -1 or 1
			local ux = dx / dist2d
			local uy = dy / dist2d
			local sd = e.aiDodgeSide
			rollOff(e, r, dif, { -uy * sd, ux * sd }, rt)
			e.locomotion = "dodge_sideroll"
			e.invincible = true
			e.gaitPhase = 0.0
			e.moving = true
			return
		end
	end
	-- blades crossed: roll back off the clash line
	if truthy(e.clashRetreat) then
		e.clashRetreat = false
		if r.dodge ~= false and nn(e, "dodgeCdT", 0.0) <= 0.0 then
			e.aiDodgeSide = nn(e, "aiDodgeSide", 0) == 1 and -1 or 1
			local ux = dx / dist2d
			local uy = dy / dist2d
			local sd = e.aiDodgeSide
			rollOff(e, r, dif, { (-ux - uy * sd) * 0.7071, (-uy + ux * sd) * 0.7071 }, rt)
			e.locomotion = "dodge_sideroll"
			e.invincible = true
			e.gaitPhase = 0.0
			e.moving = true
			return
		end
	end

	-- STRIKE: the counter (the opportunist's tackleGuard)
	if isDict(dif) and truthy(dif.tackleGuard) and nn(e, "tackleCdT", 0.0) <= 0.0 and not (nn(e, "aiBoostRestT", 0.0) > 0.0)
		and target.swingT ~= nil and target.strikeParams ~= nil and target.staggerT == nil and not truthy(target.downed)
		and (f[1] * dx + f[2] * dy) / dist2d >= cos(nn(r, "tackleGuardCone", 1.1)) then
		local tspeed = nn(r, "tackleSpeed", nn(r, "boostSpeed", speed * 3.5))
		local mdz0 = target.pos[3] - e.pos[3]
		local tdist = space and hyp3(dx, dy, mdz0) or dist2d
		if tdist < nn(r, "tackleReach", 8.0) + tspeed * nn(r, "tackleDur", 2.0) * 0.6 then
			local ux = dx / dist2d
			local uy = dy / dist2d
			if space then
				local n3 = hyp3(dx, dy, mdz0)
				if n3 == 0.0 then
					n3 = 1e-6
				end
				e.tackleDir = { dx / n3, dy / n3, mdz0 / n3 }
			else
				e.tackleDir = { ux, uy }
			end
			e.heading = atan2(dy, dx)
			e.tackleT = 0.0
			e.tackleHits = {}
			e.tackleCount = (e.tackleCount or 0) + 1
			e.tackleCdT = nn(r, "aiTackleCooldown", 1.5)
			e.invincible = true
			e.tumble = nil
			e.locomotion = "boost"
			e.moving = true
			e.gaitPhase = 0.0
			return
		end
	end
	local lo = nil
	if isDict(e.pilotRule) and isList(e.pilotRule.loadout) then
		lo = e.pilotRule.loadout
	elseif isList(r.loadout) then
		lo = r.loadout
	end
	-- the blade commit, and the give-up
	if nn(e, "meleeGiveUpT", 0.0) > 0.0 then
		e.meleeGiveUpT = maxf(0.0, e.meleeGiveUpT - dt)
	end
	local bench = type(e.adapt) == "table" and e.adapt.benched or nil
	local meleeCfg = nil
	if (truthy(r.meleeSeek) or bench == "ranged") and bench ~= "melee" and lo ~= nil and nn(e, "strikeCdT", 0.0) <= 0.0 and not (nn(e, "meleeGiveUpT", 0.0) > 0.0) then
		meleeCfg = firstMelee(lo)
	end
	local meleeReach = meleeCfg ~= nil and nn(meleeCfg, "strikeReach", nn(r, "strikeReach", speed)) or 0.0
	local targetReeling = target.staggerT ~= nil and truthy(target.staggerT) and not truthy(target.downed)
	local meleeVreach = nn(r, "meleeVReach", nn(r, "collideHeight", 24.0) * 1.5)
	local mdz = target.pos[3] - e.pos[3]
	local targetHigh = not space and abs(mdz) > meleeVreach
	local meleeDist = space and hyp3(dx, dy, mdz) or dist2d
	local targetSafe = not (isDict(dif) and truthy(dif.tackleGuard)) or target.dodgeT ~= nil or targetReeling
	local meleeCommit = meleeCfg ~= nil and not truthy(target.downed) and not targetHigh and targetSafe and (not truthy(e.groupId) or truthy(e.groupToken))
		and (meleeDist < meleeReach * 3.0 or (targetReeling and meleeDist < meleeReach * 9.0))
	if meleeCommit then
		e.meleeCommitT = orf(e, "meleeCommitT", 0.0) + dt
		if e.meleeCommitT >= nn(r, "meleeTimeout", 5.0) then
			e.meleeGiveUpT = nn(r, "meleeGiveUp", 4.0)
			e.meleeCommitT = 0.0
		end
	else
		e.meleeCommitT = 0.0
	end
	if meleeCommit then
		local idx = indexOf(lo, meleeCfg)
		if nn(e, "loadoutIdx", 0) ~= idx then
			e.loadoutIdx = idx
			e.weapon = isList(e.loadoutWeapons) and nz(e.loadoutWeapons[idx + 1]) or nil
			if truthy(meleeCfg.figure) then
				e.figure = meleeCfg.figure
			end
			armSwitchReady(e, r, meleeCfg)
		end
	elseif isList(e.loadoutWeapons) and lo ~= nil then
		local ranged = {}
		local lws = e.loadoutWeapons
		for i = 1, #lws do
			if nz(lws[i]) ~= nil and not truthy(js.get(lo[i], "throw")) then
				table.insert(ranged, i - 1)
			end
		end
		if #ranged > 0 then
			if e.aiRangedPick == nil then
				local cur = indexOf(ranged, nn(e, "loadoutIdx", 0))
				e.aiRangedPick = cur >= 0 and cur or 0
			end
			if #ranged > 1 then
				e.aiWeaponT = orf(e, "aiWeaponT", 0.0) + dt
				if e.aiWeaponT >= nn(r, "weaponRotate", 6.0) then
					e.aiWeaponT = 0.0
					e.aiRangedPick = (e.aiRangedPick + 1) % #ranged
				end
			end
			local want = ranged[(e.aiRangedPick % #ranged) + 1]
			if not truthy(e.weapon) or nn(e, "loadoutIdx", 0) ~= want then
				e.loadoutIdx = want
				e.weapon = lws[want + 1]
				if truthy(js.get(lo[want + 1], "figure")) then
					e.figure = lo[want + 1].figure
				end
				armSwitchReady(e, r, lo[want + 1])
			end
		end
	end
	-- aim: turn toward the target, pitch at its egg centre
	local rem = turnToward(e, atan2(dy, dx), r, dt)
	local w = e.weapon
	local tcz2 = eggCz(target)
	local weye2 = isDict(w) and orf(w, "eye", 0.0) or 0.0
	e.pitch = clampf(atan2((target.pos[3] + tcz2) - (e.pos[3] + weye2), dist2d), -1.2, 1.2)

	-- ENGAGE: spacing
	local dz = target.pos[3] - e.pos[3]
	local dist3d = hyp3(dx, dy, dz)
	if dist3d == 0.0 then
		dist3d = 1e-6
	end
	local rangeD = space and dist3d or dist2d
	local li = nn(e, "loadoutIdx", 0)
	local aSlot = (lo ~= nil and li < #lo) and lo[li + 1] or nil
	local aOv = nil
	if isDict(aSlot) and truthy(aSlot.approach) then
		aOv = aSlot.approach
	elseif truthy(r.approach) then
		aOv = r.approach
	end
	local aProf = SPACING[spacingOf(w, aOv)] or { 1.0, 0.7, 1.0 }
	local bladeOnly = not isDict(w) and lo ~= nil and #lo > 0
	if bladeOnly then
		for _, c in ipairs(lo) do
			if isDict(c) and c.strike ~= "melee" then
				bladeOnly = false
				break
			end
		end
	end
	local bladeReach = 0.0
	if bladeOnly then
		local bc = firstMelee(lo)
		bladeReach = nn(bc or {}, "strikeReach", nn(r, "strikeReach", speed))
	end
	local baseStandoff
	if nz(r.standoff) ~= nil then
		baseStandoff = r.standoff
	elseif isDict(w) then
		baseStandoff = orf(w, "range", 400.0) * 0.42
	elseif bladeOnly then
		baseStandoff = bladeReach * 0.8
	else
		baseStandoff = speed * 8.0
	end
	local standoff
	if isDict(w) then
		standoff = (isDict(aOv) and fin(aOv.standoff)) and aOv.standoff or baseStandoff * aProf[1]
	else
		standoff = baseStandoff
	end
	standoff *= isDict(dif) and dif.standoffMul or 1.0
	local closeBias = ((isDict(aOv) and fin(aOv.close)) and aOv.close or aProf[2]) * (isDict(dif) and dif.closeMul or 1.0)
	local weaveMul = (isDict(aOv) and fin(aOv.weave)) and aOv.weave or aProf[3]
	local f2 = fwdXY(e.heading)
	local rt2 = rightXY(e.heading)
	local facing = abs(rem) < 1.1
	local boostBurst = false
	if truthy(r.boost) and not (nn(e, "aiBoostRestT", 0.0) > 0.0) then
		local bb = nn(r, "boostBurst", 2.5) * (isDict(dif) and dif.boostBurstMul or 1.0)
		local brest = nn(r, "boostRest", 1.6) * (isDict(dif) and dif.boostRestMul or 1.0)
		local cyc = maxf(0.1, bb + brest)
		e.aiBoostClock = orf(e, "aiBoostClock", 0.0) + dt
		boostBurst = fmod(e.aiBoostClock, cyc) < bb
	end
	local moveMag = 0.0
	local clip = "forward"
	if meleeCommit then
		if meleeDist > meleeReach * 0.85 then
			local canBoost = (truthy(r.boost) or truthy(r.boostSpeed)) and not (nn(e, "aiBoostRestT", 0.0) > 0.0)
			local spd = (canBoost and nn(r, "boostSpeed", speed * 3.5) or speed) * dt
			if facing then
				if space then
					local ux = dx / meleeDist
					local uy = dy / meleeDist
					local uz = mdz / meleeDist
					e.pos[1] += ux * spd
					e.pos[2] += uy * spd
					e.pos[3] += uz * spd
					moveMag = spd
					clip = "boost"
					if canBoost then
						e.boosting = true
						e.thrust = 1.0
					else
						e.thrust = maxf(e.thrust, 0.5)
					end
				else
					e.pos[1] += f2[1] * spd
					e.pos[2] += f2[2] * spd
					moveMag = spd
					if canBoost then
						clip = "boost"
						e.boosting = true
						e.thrust = 1.0
					else
						clip = "forward"
					end
				end
			end
		elseif facing and nn(e, "readyT", 0.0) <= 0.0 then
			beginSwing(e, meleeCfg, r, dif)
			e.lungeTo = target.id
			e.meleeCommitT = 0.0
		end
	elseif truthy(e.groupId) and type(e.groupSlot) == "table" and not space and not (truthy(e.groupToken) and bladeOnly) then
		local gs = e.groupSlot
		local gx = gs[1] - e.pos[1]
		local gy = gs[2] - e.pos[2]
		local gdist = hyp(gx, gy)
		local sp = nn(e, "groupSpacing", 3.0)
		local sx = 0.0
		local sy = 0.0
		for _, id in ipairs(world.order) do
			local o = world.byId[id]
			if o == e or o.groupId ~= e.groupId then
				continue
			end
			local ox = e.pos[1] - o.pos[1]
			local oy = e.pos[2] - o.pos[2]
			local od = hyp(ox, oy)
			if od > 1e-6 and od < sp then
				sx += (ox / od) * (sp - od) / sp
				sy += (oy / od) * (sp - od) / sp
			end
		end
		if gdist > 0.6 or sx ~= 0.0 or sy ~= 0.0 then
			local mx = (gdist > 0.6 and gx / gdist or 0.0) + sx * 1.5
			local my = (gdist > 0.6 and gy / gdist or 0.0) + sy * 1.5
			local mn = hyp(mx, my)
			if mn == 0.0 then
				mn = 1.0
			end
			local stp = minf(speed * dt, gdist + 0.5)
			e.pos[1] += (mx / mn) * stp
			e.pos[2] += (my / mn) * stp
			moveMag = stp
			clip = "forward"
		end
	elseif space then
		local ux = dx / dist3d
		local uy = dy / dist3d
		local uz = dz / dist3d
		if boostBurst then
			local side = nextJuke(e, r, dt)
			local bias = dist3d > standoff and closeBias or (dist3d < standoff * 0.55 and -closeBias or 0.0)
			local vWeave = sin(orf(e, "aiBoostClock", 0.0) * 2.4) * 0.5
			local mvx = rt2[1] * side * weaveMul + ux * bias
			local mvy = rt2[2] * side * weaveMul + uy * bias
			local mvz = vWeave + uz * bias
			local mn = hyp3(mvx, mvy, mvz)
			if mn == 0.0 then
				mn = 1.0
			end
			mvx /= mn
			mvy /= mn
			mvz /= mn
			local bstep = nn(r, "boostSpeed", speed * 3.5) * dt
			e.pos[1] += mvx * bstep
			e.pos[2] += mvy * bstep
			e.pos[3] += mvz * bstep
			moveMag = bstep
			if abs(mvx * rt2[1] + mvy * rt2[2]) > 0.4 then
				clip = side > 0 and "boost_right" or "boost_left"
			else
				clip = "boost"
			end
			e.boosting = true
			e.thrust = 1.0
		elseif dist3d > standoff and facing then
			local stp = speed * dt
			e.pos[1] += ux * stp
			e.pos[2] += uy * stp
			e.pos[3] += uz * stp
			moveMag = stp
			clip = "boost"
			e.thrust = maxf(e.thrust, 0.5)
		end
	elseif boostBurst then
		local side = nextJuke(e, r, dt)
		local bias = dist2d > standoff and closeBias or (dist2d < standoff * 0.55 and -closeBias or 0.0)
		local mvx = rt2[1] * side * weaveMul + f2[1] * bias
		local mvy = rt2[2] * side * weaveMul + f2[2] * bias
		local mn = hyp(mvx, mvy)
		if mn == 0.0 then
			mn = 1.0
		end
		mvx /= mn
		mvy /= mn
		local bstep = nn(r, "boostSpeed", speed * 3.5) * dt
		e.pos[1] += mvx * bstep
		e.pos[2] += mvy * bstep
		moveMag = bstep
		if abs(mvx * rt2[1] + mvy * rt2[2]) > 0.5 then
			clip = side > 0 and "boost_right" or "boost_left"
		else
			clip = "boost"
		end
		e.boosting = true
		e.thrust = 1.0
	else
		local moveF = 0.0
		if dist2d > standoff and facing then
			moveF = speed * dt
		end
		if moveF ~= 0.0 then
			e.pos[1] += f2[1] * moveF
			e.pos[2] += f2[2] * moveF
		end
		moveMag = moveF
	end
	if not space and isList(cols) then
		block(e, r, eye, world)
	end
	if not space then
		standOnGround(e, r, eye, world)
	end
	if moveMag > 0.0 then
		e.locomotion = clip
		e.gaitPhase = orf(e, "gaitPhase", 0.0) + moveMag / strideLen
		e.moving = true
	else
		e.moving = false
	end

	-- STRIKE: the trigger
	local fireArc = (nn(r, "fireArc", 6.0) * PI) / 180.0
	local origin = { e.pos[1], e.pos[2], e.pos[3] + weye2 }
	local onAim2
	if space then
		local a3 = fwd3(e.heading, orf(e, "pitch", 0.0))
		onAim2 = (a3[1] * (dx / dist3d) + a3[2] * (dy / dist3d) + a3[3] * (dz / dist3d)) >= cos(fireArc)
	else
		onAim2 = abs(rem) <= fireArc
	end
	local engaged = isDict(w) and onAim2 and rangeD <= orf(w, "range", 400.0) and not sightBlocked(origin, target.pos, cols)
	if engaged then
		local burstOn = nn(r, "burst", 1.1) * (isDict(dif) and dif.burstMul or 1.0)
		local cycle = burstOn + nn(r, "pause", 0.9) * (isDict(dif) and dif.pauseMul or 1.0)
		e.aiClock = orf(e, "aiClock", 0.0) + dt
		e.aiFire = (e.aiClock >= 0.0 and fmod(e.aiClock, cycle) <= burstOn) and 1 or 0
	else
		e.aiClock = (isDict(dif) and truthy(dif.reactDelay)) and -dif.reactDelay or 0.0
	end
	-- DETUNE: the tuning's accuracy, a sinusoidal wobble after every decision
	if isDict(dif) and truthy(dif.aimWobble) then
		e.aiWobT = orf(e, "aiWobT", 0.0) + dt
		local wobY = sin(e.aiWobT * dif.wobbleHz * TAU) * dif.aimWobble
		e.heading = e.heading + wobY - orf(e, "aiWobPrev", 0.0)
		e.aiWobPrev = wobY
		e.pitch = clampf(orf(e, "pitch", 0.0) + sin(e.aiWobT * dif.wobbleHz * 0.77 * TAU + 1.3) * dif.aimWobble * 0.6, -1.2, 1.2)
	end
end

return mind
end
