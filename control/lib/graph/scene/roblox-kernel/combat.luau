--!nonstrict
-- mojulo-roblox kernel — THE FIGHT: the hero's melee and ranged weapon, and how the bodies they hit react, over the
-- cast in the bus's frame (z-up, recipe units, radians). A port of the web's controllable engine (lib/graph/worlds/
-- controllable: combat-melee.js, combat-ranged.js, combat-hit.js, combat-match.js), laid out as the Godot kernel's
-- combat.gd is (the same module in another language): the platform strike (the fire edge, the direction pick, the
-- cooldown, the two-hit combo), meleeContacts and stepMelee's hit; the trigger (semi, auto, burst, charge, magazine and
-- reload, heat), the hitscan ray against eggs and spheres, cover, frontal shields, lob rounds swept along their flight
-- and their splash; the reaction a poise-bearing body plays (stagger, topple, the flat hold, the getup and its wake
-- guard; a killing blow floors it, and its fall blasts a stagger around it); and the minds (kernel/mind.luau decides,
-- kernel/group.luau gives a group's members their slots; their trigger, blade and charge are this file's). Held EQUAL to
-- the web frame by frame by the combat and mind conformance corpora, run under Lune. What stays on the web: the
-- combo's stun, scaling and juggle, the clash and the other set pieces, boost armor, the hero's other loadout slots and
-- the commander. A hit counts on the body (`hits`), and kernel/cast.luau tells the bus (hit:<id>).
--
-- What the GDScript holds on its instance (the strike, the colliders, the rounds in flight, the minds and their
-- groups, the switch) is held on an instance table here, one per world: never module state.
--
-- Pure Luau, no host API. A kernel module: the loader hands it the kernel (K.js; K.mind and K.group for the minds).
--
--   local F = combat.new()
--   F:arm(castState, combat)              bus.json's `combat`: the hittable bodies take their fields, the hero its arms
--   F:armMinds(castState, minds)          bus.json's `minds` (mind-score.js): the bodies on the `ai` rule
--   F:step(castState, hero, input, dt, grounded, pose?, part?)
--                                         input: { fire, forward, strafe, turn, aiToggle }; one frame in the web's order
--   F.projectiles                         the rounds in flight

return function(K)
local js = K.js
local NULL, UNDEF = js.NULL, js.UNDEF
local truthy = js.truthy

local combat = {}

local PI = math.pi
local INF = math.huge
local sin, cos, sqrt, atan, atan2, acos, floor, ceil, abs, fmod = math.sin, math.cos, math.sqrt, math.atan, math.atan2, math.acos, math.floor, math.ceil, math.abs, math.fmod

local function nz(v)
	if v == NULL or v == UNDEF then
		return nil
	end
	return v
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
-- JS `x || d` for a number: 0, null and NaN fall through
local function orf(v, d)
	if fin(v) and v ~= 0.0 then
		return v
	end
	return d
end
-- `x ?? d`
local function nn(v, d)
	v = nz(v)
	if v == nil then
		return d
	end
	return v
end
-- an input axis: a number, a boolean as 0 / 1, anything else 0
local function axis(input, k)
	local v = input[k]
	if type(v) == "number" then
		return v
	end
	if type(v) == "boolean" then
		return v and 1.0 or 0.0
	end
	return 0.0
end
local function isStr(v)
	return type(v) == "string"
end

-- ── vectors (core.js) ────────────────────────────────────────────────────────────────────────────────────────────
local function fwdXY(h)
	return { cos(h), sin(h), 0.0 }
end
local function rightXY(h)
	return { sin(h), -cos(h), 0.0 }
end
local function fwd3(h, p)
	return { cos(p) * cos(h), cos(p) * sin(h), sin(p) }
end
local function sub(a, b)
	return { a[1] - b[1], a[2] - b[2], a[3] - b[3] }
end
local function lerp3(a, b, t)
	return { a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t }
end
-- Math.hypot as the root of the summed squares (the snapshots read a pose to 1e-9)
local function hypot3(a, b, c)
	return sqrt(a * a + b * b + c * c)
end
local function hypot2(a, b)
	return sqrt(a * a + b * b)
end
local function copy3(p)
	return { p[1], p[2], p[3] }
end

combat.fwdXY = fwdXY
combat.rightXY = rightXY
combat.fwd3 = fwd3

-- ── cover (core.js segAabbT / sightBlocked / nearestWallT) ─────────────────────────────────────────────────────────
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
combat.segAabbT = segAabbT

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
combat.sightBlocked = sightBlocked

local function nearestWallT(a, b, colliders)
	if not isList(colliders) then
		return nil
	end
	local best = nil
	for _, c in ipairs(colliders) do
		local t = segAabbT(a, b, c.min, c.max)
		if t ~= nil and t > 1e-3 and (best == nil or t < best) then
			best = t
		end
	end
	return best
end

-- ── hit volumes (combat-hit.js) ──────────────────────────────────────────────────────────────────────────────────
local function flat(tg)
	return tg.reactClip == "topple" and tg.staggerT ~= nil and tg.staggerT >= 1.0
end

-- a flat toppled body presents its length along the floor
local function latR(tg)
	if isDict(tg.egg) then
		return flat(tg) and tg.egg.c or tg.egg.a
	end
	return orf(tg.radius, 0.5)
end
combat.latR = latR

-- the egg's long axis: up, or along the floor when it lies toppled (a kernel body never boosts, so it never leans)
local function eggAxis(tg)
	if flat(tg) then
		local h = tg.heading
		return { cos(h), sin(h), 0.0 }
	end
	return { 0.0, 0.0, 1.0 }
end

local function eggScale(u, ez, a, cc)
	local par = u[1] * ez[1] + u[2] * ez[2] + u[3] * ez[3]
	local f = (1.0 / cc - 1.0 / a) * par
	return { u[1] / a + f * ez[1], u[2] / a + f * ez[2], u[3] / a + f * ez[3] }
end

local function hitEgg(origin, dir, tg)
	local egg = tg.egg
	local a = egg.a
	local cc = egg.c
	local cz = flat(tg) and a or (fin(egg.cz) and egg.cz or cc)
	local p = tg.pos
	local C = { p[1], p[2], p[3] + cz }
	local ez = eggAxis(tg)
	local O = eggScale(sub(origin, C), ez, a, cc)
	local D = eggScale(dir, ez, a, cc)
	local A = D[1] * D[1] + D[2] * D[2] + D[3] * D[3]
	if A <= 1e-12 then
		return nil
	end
	local B = 2.0 * (O[1] * D[1] + O[2] * D[2] + O[3] * D[3])
	local Kk = O[1] * O[1] + O[2] * O[2] + O[3] * O[3] - 1.0
	local disc = B * B - 4.0 * A * Kk
	if disc < 0.0 then
		return nil
	end
	local sq = sqrt(disc)
	local t0 = (-B - sq) / (2.0 * A)
	local t1 = (-B + sq) / (2.0 * A)
	if t0 > 1e-4 then
		return t0
	end
	if t1 > 1e-4 then
		return t1
	end
	return nil
end

local function pointInEgg(pt, tg, pad)
	local egg = tg.egg
	local a = egg.a + pad
	local cc = egg.c + pad
	local cz = flat(tg) and a or (fin(egg.cz) and egg.cz or egg.c)
	local ez = eggAxis(tg)
	local p = tg.pos
	local u = { pt[1] - p[1], pt[2] - p[2], pt[3] - (p[3] + cz) }
	local par = u[1] * ez[1] + u[2] * ez[2] + u[3] * ez[3]
	local perp2 = maxf(0.0, (u[1] * u[1] + u[2] * u[2] + u[3] * u[3]) - par * par)
	return perp2 / (a * a) + (par * par) / (cc * cc) <= 1.0
end

-- ── the reaction (combat-hit.js armReaction / stepReaction, without the combo) ───────────────────────────────────────
local function armReaction(tg, kind, force)
	if not fin(tg.poise) then
		return
	end
	local dead = fin(tg.hp) and tg.hp <= 0.0
	if dead then
		kind = "topple"
	end
	local rc = tg.reactClip
	local inKnockdown = tg.staggerT ~= nil and (rc == "topple" or rc == "downpause" or rc == "getup")
	if tg.staggerT ~= nil and not dead and not (force and not inKnockdown) then
		return
	end
	local sd = orf(tg.staggerDur, 1.3)
	tg.poise = tg.poiseMax
	tg.staggerT = 0.0
	tg.downPauseT = nil
	tg.reactClip = kind == "topple" and "topple" or "stagger"
	tg.reactDur = kind == "topple" and orf(tg.toppleDur, sd * 1.3) or sd
	if dead then
		if truthy(tg.noDestroy) and fin(tg.hpMax) then
			tg.hp = tg.hpMax
		else
			tg.downed = true
		end
	end
end
combat.armReaction = armReaction

-- a frontal shield eats a hit whose source lies in its arc; breaking it staggers the body
local function shieldCovers(tg, src)
	if orf(tg.shieldHp, 0.0) == 0.0 or truthy(tg.shieldBroken) then
		return false
	end
	local front = fwdXY(tg.heading)
	local ix = src[1] - tg.pos[1]
	local iy = src[2] - tg.pos[2]
	local m = hypot2(ix, iy)
	if m == 0.0 then
		m = 1e-6
	end
	return (ix * front[1] + iy * front[2]) / m >= cos(orf(tg.shieldArc, PI * 0.6) / 2.0)
end

local function absorbShield(tg, src, drain)
	if not shieldCovers(tg, src) then
		return false
	end
	tg.shieldHp = tg.shieldHp - drain
	if tg.shieldHp <= 0.0 then
		tg.shieldHp = 0.0
		tg.shieldBroken = true
		armReaction(tg, "stagger")
	end
	return true
end

-- one frame of a poise-bearing body's reaction; true while it reels (its rule and arms wait)
local function stepReaction(e, dt)
	if not fin(e.poise) then
		return false
	end
	if orf(e.wakeGuardT, 0.0) > 0.0 then
		e.wakeGuardT = maxf(0.0, e.wakeGuardT - dt)
		e.invincible = e.wakeGuardT > 0.0
	end
	if e.staggerT == nil then
		if e.poise < e.poiseMax then
			e.poise = minf(e.poiseMax, e.poise + orf(e.poiseRegen, 0.0) * dt)
		end
		return false
	end
	local hold = fin(e.downPause) and e.downPause or 2.0
	if e.reactClip == "topple" and e.downPauseT ~= nil then
		e.downPauseT = e.downPauseT + dt
		if e.downPauseT >= hold then
			e.reactClip = "getup"
			e.reactDur = orf(e.getupDur, orf(e.staggerDur, 1.3) * 1.4)
			e.staggerT = 0.0
			e.downPauseT = nil
			e.locomotion = "getup"
			e.moving = true
			e.gaitPhase = 0.0
			e.invincible = true
			return true
		end
		e.staggerT = 1.0
		e.locomotion = "topple"
		e.moving = true
		e.gaitPhase = 1.0
		e.invincible = false
		return true
	end
	e.staggerT = e.staggerT + dt / orf(e.reactDur, orf(e.staggerDur, 1.3))
	if e.staggerT >= 1.0 then
		if e.reactClip == "topple" then
			if not truthy(e.downed) then
				e.downPauseT = 0.0
			end
			e.staggerT = 1.0
			e.locomotion = "topple"
			e.moving = true
			e.gaitPhase = 1.0
			e.invincible = false
			return true
		end
		local rose = e.reactClip == "getup"
		e.staggerT = nil
		e.downPauseT = nil
		-- back on its feet: the recovery EDGE a mind consumes (it rolls out on it), its clip the one it returns to
		e.locomotion = truthy(e.staggerReturn) and e.staggerReturn or "forward"
		e.reactionEnded = true
		if rose and orf(e.wakeGuard, 0.0) > 0.0 then
			e.wakeGuardT = e.wakeGuard
			e.invincible = true
		else
			e.invincible = false
		end
		return false
	end
	e.locomotion = e.reactClip
	e.moving = true
	e.gaitPhase = e.staggerT
	e.invincible = e.reactClip == "getup"
	return true
end
combat.stepReaction = stepReaction

-- a hit's count and who dealt it, and its damage
local function hit(tg, by)
	tg.hits = (tg.hits or 0) + 1
	tg.lastHitBy = by
end

-- what a round dealt, for the cast's hit fact (dmg, harm, head): the count it was dealt at, so a later swing's hit
-- carries none (combat-ranged.js; no headshot or falloff here: WEAPON_LOST)
local function dealt(tg, dmg)
	tg.lastHitDmg = dmg
	tg.lastHitHead = false
	tg.lastHitDmgN = tg.hits
end

local function hurt(tg, dmg)
	if fin(tg.hp) then
		tg.hp = maxf(0.0, tg.hp - dmg)
	end
end

local function hittable(tg)
	return not truthy(tg.invincible) and truthy(tg.hittable)
end

-- combat-hit.js breakGuards: acting a weapon spends any protection (the spawn shield, the wake guard, a roll's frames)
local function breakGuards(e)
	if truthy(e.spawnGuard) then
		e.spawnGuard = false
	end
	if orf(e.wakeGuardT, 0.0) > 0.0 then
		e.wakeGuardT = 0.0
	end
	if e.dodgeT ~= nil then
		e.dodgeSpent = true
	end
	e.downPauseT = nil
	e.invincible = false
end
combat.breakGuards = breakGuards

local function sameTeam(a, b)
	return isStr(a.team) and isStr(b.team) and a.team == b.team
end

-- ── melee (combat-melee.js) ──────────────────────────────────────────────────────────────────────────────────────
-- meleeContacts: who this swing meets this step, before anything is done to them, in entity order; a clash (a target
-- itself mid-swing) consumes the swing, so the list stops there
local function meleeContacts(e, entities)
	local out = {}
	local P = e.strikeParams
	if e.swingT == nil or not isDict(P) then
		return out
	end
	local sw = e.swingT
	if sw < P.from or sw > P.to then
		return out
	end
	local h = e.heading + orf(P.aimYaw, 0.0)
	local aim = { cos(h), sin(h) }
	local p = e.pos
	local origin = { p[1], p[2], p[3] + P.eye }
	local struck = e.struckThisSwing or {}
	for _, tg in ipairs(entities) do
		if tg == e or not hittable(tg) then
			continue
		end
		if struck[tg.id] then
			continue
		end
		local v = sub(tg.pos, origin)
		local d = hypot3(v[1], v[2], v[3])
		if d < 1e-3 or d > P.reach + latR(tg) then
			continue
		end
		local fl = hypot2(v[1], v[2])
		if fl == 0.0 then
			fl = 1e-6
		end
		if (v[1] * aim[1] + v[2] * aim[2]) / fl < P.cosCone then
			continue
		end
		if sameTeam(tg, e) then
			table.insert(out, { tg = tg, kind = "ally" })
			continue
		end
		if tg.swingT ~= nil and isDict(tg.strikeParams) and tg.staggerT == nil then
			table.insert(out, { tg = tg, kind = "clash" })
			break
		end
		table.insert(out, { tg = tg, kind = "hit" })
	end
	return out
end
combat.meleeContacts = meleeContacts

-- stepMelee's writes: an ally reels, a clash is marked (the lock stays the web's), a hit counts, is credited, takes its
-- damage, and reels or topples (a toppling verb, or the back cleave; on a combo slot only the follow-up)
local function stepMelee(e, entities)
	local P = e.strikeParams
	for _, c in ipairs(meleeContacts(e, entities)) do
		local tg = c.tg
		e.struckThisSwing[tg.id] = true
		if c.kind == "ally" then
			if fin(tg.poise) and tg.staggerT == nil then
				armReaction(tg, "stagger")
			end
			continue
		end
		if c.kind == "clash" then
			break
		end
		e.meleeHitCount = (e.meleeHitCount or 0) + 1
		hit(tg, e.id)
		hurt(tg, P.damage)
		local topples
		if nz(P.topple) ~= nil then
			topples = truthy(P.topple)
		else
			topples = e.swingClip == "swing_back"
		end
		topples = topples and (truthy(P.combo) and truthy(e.swingCombo) or not truthy(P.combo))
		armReaction(tg, topples and "topple" or "stagger", topples)
	end
end
combat.stepMelee = stepMelee

-- ── the trigger (combat-ranged.js tickWeapon / stepWeapon) ─────────────────────────────────────────────────────────
-- out of rounds in the magazine and the reserve both: the weapon is dry and does not reload (the web's reserve !== 0)
local function dry(w)
	return nz(w.reserve) ~= nil and w.reserve == 0.0
end

local function tickWeapon(w, dt)
	if w.cooldownT > 0.0 then
		w.cooldownT = maxf(0.0, w.cooldownT - dt)
	end
	if w.energyMax > 0.0 then
		local rr = w.energyRegen
		if truthy(w.energyLock) and nz(w.energyOverheatRegen) ~= nil then
			rr = w.energyOverheatRegen
		end
		if rr > 0.0 then
			w.energy = minf(w.energyMax, nn(w.energy, w.energyMax) + rr * dt)
		end
		if truthy(w.energyLock) and w.energy >= w.energyMax * maxf(0.0, minf(1.0, w.energyUnlockFrac)) then
			w.energy = minf(w.energyMax, w.energy)
			w.energyLock = false
		end
	end
	if w.ammo <= 0.0 and not truthy(w.reloading) and not dry(w) then
		w.reloading = true
		w.reloadT = w.reload
		w.burstLeft = 0
	end
	if truthy(w.reloading) then
		w.reloadT = w.reloadT - dt
		if w.reloadT <= 0.0 then
			-- a reload draws from the reserve: all of it when it is less than a magazine; no reserve (null) is the endless
			-- reload it always was
			local take = nz(w.reserve) == nil and w.magazine or minf(w.magazine, w.reserve)
			w.ammo = take
			w.reloading = false
			w.reloadT = 0.0
			if nz(w.reserve) ~= nil then
				w.reserve = w.reserve - take
			end
		end
	end
end
combat.tickWeapon = tickWeapon

local function cancelCharge(w)
	if not truthy(w.charging) then
		return
	end
	w.charging = false
	w.chargeT = 0.0
	w.chargeFrac = 0.0
	w.chargeReady = false
end

local Fight = {}
Fight.__index = Fight

function combat.new()
	local F = setmetatable({}, Fight)
	F.strike = nil
	F.look = false
	F.colliders = nil
	F.projectiles = {}
	F.mind = nil
	F.groups = nil
	F.mindIds = {}
	F.mindOff = false
	F.mindTier = nil
	F.mindOrder = {}
	-- the ground a mind stands on (the web's hooks.ground): a level hands it the land; flat at 0 without one
	F.groundFn = function(_p)
		return 0.0
	end
	-- the clock a mind decides by (a level sets it to the frame's start, before the cast's clock moves); < 0: the cast's
	F.mindClock = -1.0
	F._frameWorld = nil
	return F
end

function Fight:arm(st, cb)
	self.strike = isDict(cb.strike) and cb.strike or nil
	self.look = truthy(cb.look)
	self.colliders = isList(cb.colliders) and cb.colliders or nil
	self.projectiles = {}
	local bodies = isDict(cb.bodies) and cb.bodies or {}
	local hero = st.byId[js.str(nn(cb.hero, ""))]
	if hero ~= nil then
		if isStr(cb.team) then
			hero.team = cb.team
		end
		if isDict(cb.weapon) then
			hero.weapon = js.dup(cb.weapon)
		end
		hero.pitch = 0.0
	end
	for _, e in ipairs(st.entities) do
		e.hits = 0
		e.lastHitBy = nil
		local b = bodies[e.id]
		if not isDict(b) then
			continue
		end
		e.hittable = not e.dormant
		if isDict(b.egg) then
			e.egg = b.egg
		else
			e.radius = nn(b.radius, 0.5)
		end
		for _, k in ipairs({ "team", "hpMax", "poise", "poiseMax", "poiseRegen", "staggerDur", "toppleDur", "getupDur", "wakeGuard", "downPause", "shieldHp", "shieldArc" }) do
			if nz(b[k]) ~= nil then
				e[k] = b[k]
			end
		end
		if e.poise ~= nil then
			e.staggerT = nil
			e.reactClip = "stagger"
			e.reactDur = nil
			e.downPauseT = nil
		end
		if e.shieldHp ~= nil then
			e.shieldBroken = false
		end
		e.noDestroy = truthy(b.noDestroy)
	end
end

-- the platform strike: a fire press swings (the held direction picks the cut), the swing runs over dur, its end arms
-- the cooldown, and on a combo slot the opener opens a window for one follow-up in another direction
function Fight:strikeStep(e, input, dt, grounded)
	local strike = self.strike
	if strike == nil then
		return
	end
	local fire = truthy(input.fire)
	local edge = fire and not truthy(e.strikePrev)
	e.strikePrev = fire
	local depth = nn(strike.combo, 0)
	local cd = nn(strike.cooldown, 0.0)
	local fwd = axis(input, "forward")
	local side = clampf(axis(input, "strafe") + (self.look and axis(input, "turn") or 0.0), -1.0, 1.0)
	local dir
	if abs(side) > abs(fwd) then
		dir = side > 0.0 and "right" or "left"
	elseif fwd < -1e-3 then
		dir = "back"
	elseif fwd > 1e-3 then
		dir = "forward"
	else
		dir = "neutral"
	end
	local comboClick = depth > 0 and (e.comboT or 0.0) > 0.0 and dir ~= e.lastSwingDir
	if e.swingT == nil and edge and (((e.strikeCdT or 0.0) > 0.0 and not comboClick) or (e.readyT or 0.0) > 0.0) then
		-- the cooldown (or the switch's ready-time) eats the press
	elseif e.swingT == nil and edge and grounded then
		local spec = strike.swings[dir]
		e.swingT = 0.0
		e.swingClip = spec.clip
		-- attacking spends any protection (the web's combat-melee.js)
		breakGuards(e)
		e.swingCombo = comboClick
		e.comboT = 0.0
		e.swingCount = (e.swingCount or 0) + 1
		e.struckThisSwing = {}
		e.strikeParams = spec.params
		e.lastSwingDir = dir
	elseif e.swingT ~= nil then
		local wasCombo = truthy(e.swingCombo)
		e.swingT = e.swingT + dt / strike.dur
		if e.swingT >= 1.0 or not grounded then
			if e.swingT >= 1.0 and depth > 0 and not wasCombo then
				e.comboT = strike.comboWindow
			end
			local c = (e.swingT >= 1.0 and wasCombo) and strike.comboCooldown or cd
			if c > 0.0 then
				e.strikeCdT = c
			end
			e.swingT = nil
			e.swingCombo = false
		end
	end
	if e.swingT == nil and (e.comboT or 0.0) > 0.0 then
		e.comboT = maxf(0.0, e.comboT - dt)
	end
end

function Fight:stepWeapon(e, input, dt, st)
	local w = e.weapon
	local fireHeld = truthy(input.fire)
	if truthy(w.reloading) or (w.energyMax > 0.0 and truthy(w.energyLock)) or (e.readyT or 0.0) > 0.0 then
		cancelCharge(w)
		w.prevFire = fireHeld
		return
	end
	local edge = fireHeld and not truthy(w.prevFire)
	local release = not fireHeld and truthy(w.prevFire)
	local energyReady = not (w.energyMax > 0.0) or w.energy > 0.0
	-- NO FIRE WHILE BOOSTING (a mind's boost juke): a thrusting body cannot line up a semi or lob shot; an auto weapon
	-- keeps streaming (`boostFire` overrides the class), and a charge keeps flowing through the thrust
	local canBoostFire
	if nz(w.boostFire) ~= nil then
		canBoostFire = truthy(w.boostFire)
	else
		canBoostFire = truthy(w.auto)
	end
	if truthy(e.boosting) and not canBoostFire then
		local chargeFlow = w.chargeTime > 0.0 and not truthy(w.auto) and ((truthy(w.charging) and fireHeld)
			or (edge and w.cooldownT <= 0.0 and w.burstLeft <= 0.0 and w.ammo > 0.0 and energyReady)
			or (truthy(w.charging) and release and truthy(w.chargeReady)))
		if not chargeFlow then
			cancelCharge(w)
			w.prevFire = fireHeld
			return
		end
	end
	local forced = false
	local charged = false
	if w.chargeTime > 0.0 and not truthy(w.auto) then
		local readyPull = w.cooldownT <= 0.0 and w.burstLeft <= 0.0 and w.ammo > 0.0 and energyReady
		if truthy(w.charging) and fireHeld then
			w.chargeT = minf(w.chargeTime, orf(w.chargeT, 0.0) + dt)
			w.chargeFrac = maxf(0.0, minf(1.0, w.chargeT / w.chargeTime))
			w.chargeReady = w.chargeFrac >= 1.0
			w.prevFire = true
			return
		end
		if truthy(w.charging) and release then
			charged = truthy(w.chargeReady)
			cancelCharge(w)
			if charged then
				forced = true
			elseif readyPull then
				w.burstLeft = w.burst
			end
		elseif edge and readyPull then
			w.charging = true
			w.chargeT = 0.0
			w.chargeFrac = 0.0
			w.chargeReady = false
			w.chargeCount = orf(w.chargeCount, 0.0) + 1
			w.prevFire = true
			return
		elseif w.burstLeft <= 0.0 then
			w.prevFire = fireHeld
			return
		end
	end
	w.prevFire = fireHeld
	local impact = charged and nn(w.chargedImpact, nn(w.impact, 0.0)) or orf(w.impact, 0.0)
	local shotRange = charged and w.range * orf(w.chargedRangeMul, 1.0) or w.range
	-- OVERDRIVE (a status, the cast's `status { is: 'overdrive' }`): its rounds hit 1.5 times as hard
	local damage = (charged and nn(w.chargedDamage, nn(w.damage, 0.0)) or orf(w.damage, 0.0)) * ((e.statuses and e.statuses:get("overdrive") ~= nil) and 1.5 or 1)
	if not truthy(w.auto) and not forced and edge and w.cooldownT <= 0.0 and w.burstLeft <= 0.0 and w.ammo > 0.0 then
		w.burstLeft = w.burst
	end
	local want = energyReady and w.ammo > 0.0 and w.cooldownT <= 0.0 and (forced or (truthy(w.auto) and fireHeld or (not truthy(w.auto) and w.burstLeft > 0.0)))
	if want then
		self:shoot(e, w, st, charged, forced, impact, shotRange, damage)
	end
	if w.ammo <= 0.0 and not truthy(w.reloading) and not dry(w) then
		w.reloading = true
		w.reloadT = w.reload
	end
end

function Fight:shoot(e, w, st, charged, forced, impact, shotRange, damage)
	w.ammo = w.ammo - ((charged and orf(w.chargedAmmoCost, 0.0) ~= 0.0) and minf(w.chargedAmmoCost, w.ammo) or 1.0)
	w.shots = w.shots + 1
	if w.energyMax > 0.0 then
		local ec = charged and nn(w.chargedEnergyCost, orf(w.energyCost, 0.0)) or orf(w.energyCost, 0.0)
		w.energy = maxf(0.0, nn(w.energy, w.energyMax) - ec)
		if w.energy <= 0.0 then
			w.energy = 0.0
			w.energyLock = true
			w.burstLeft = 0
		end
	end
	if charged then
		w.chargedShots = orf(w.chargedShots, 0.0) + 1
	end
	-- a round leaving spends any protection (the web's combat-ranged.js)
	breakGuards(e)
	if not truthy(w.auto) and not forced then
		w.burstLeft = w.burstLeft - 1.0
	end
	if truthy(w.auto) then
		w.cooldownT = 1.0 / orf(w.rof, 10.0)
	else
		w.cooldownT = w.burstLeft > 0.0 and 1.0 / orf(w.burstRof, 8.0) or orf(w.cooldown, 0.5)
	end
	local p = e.pos
	local h = e.heading
	local pitch = orf(e.pitch, 0.0)
	local origin = { p[1], p[2], p[3] + w.eye }
	local aim = fwd3(h, pitch)
	local mo = nz(w.muzzleOffset)
	local hf = fwdXY(h)
	local hr = rightXY(h)
	local from = copy3(origin)
	if isDict(mo) then
		local rMul = (truthy(w.muzzleAlt) and w.shots % 2 == 0) and -1.0 or 1.0
		local mf = orf(mo.f, 0.0)
		local mr = orf(mo.r, 0.0)
		from = { p[1] + hf[1] * mf + hr[1] * mr * rMul, p[2] + hf[2] * mf + hr[2] * mr * rMul, p[3] + nn(mo.u, w.eye) }
	end
	if w.fireClass == "lob" then
		local dir = fwd3(h, pitch + orf(w.lobAngle, 0.0) * PI / 180.0)
		local sp = orf(w.projectileSpeed, 60.0)
		table.insert(self.projectiles, { owner = e.id, pos = copy3(from), vel = { dir[1] * sp, dir[2] * sp, dir[3] * sp }, gravity = orf(w.projectileGravity, 0.0), splashRadius = orf(w.splashRadius, 0.0), projRadius = orf(w.projRadius, 0.5), prox = orf(w.proximity, 0.0), damage = orf(w.damage, 0.0), impact = impact, age = 0.0, armTime = orf(w.armTime, 0.0), fuse = orf(w.fuse, 4.0) })
		return
	end
	local coreR = w.coreAngle * PI / 180.0
	local assistR = w.assistAngle * PI / 180.0
	local best = nil
	local friend = nil
	for _, tg in ipairs(st.entities) do
		if tg == e or not hittable(tg) then
			continue
		end
		local friendly = sameTeam(e, tg)
		local v = sub(tg.pos, origin)
		local d = hypot3(v[1], v[2], v[3])
		if d < 1e-3 or d > shotRange then
			continue
		end
		local mode = nil
		local hd = d
		if isDict(tg.egg) then
			local te = hitEgg(origin, aim, tg)
			if te ~= nil and te <= shotRange then
				mode = "core"
				hd = te
			elseif w.fireClass == "area" then
				local ang = acos(clampf((v[1] * aim[1] + v[2] * aim[2] + v[3] * aim[3]) / d, -1.0, 1.0))
				if ang <= assistR + atan(tg.egg.a / d) then
					mode = "assist"
				end
			end
		else
			local ang = acos(clampf((v[1] * aim[1] + v[2] * aim[2] + v[3] * aim[3]) / d, -1.0, 1.0))
			local subtend = atan(orf(tg.radius, 0.5) / d)
			if ang <= coreR + subtend then
				mode = "core"
			elseif w.fireClass == "area" and ang <= assistR + subtend then
				mode = "assist"
			end
		end
		if friendly then
			if mode ~= nil and not sightBlocked(from, tg.pos, self.colliders) and (friend == nil or hd < friend.d) then
				friend = { d = hd, tg = tg }
			end
			continue
		end
		-- COVER: an egg is traced to where the ray enters it (a head over a low wall is hit), a sphere to its centre
		local hitAt = (isDict(tg.egg) and mode == "core") and { origin[1] + aim[1] * hd, origin[2] + aim[2] * hd, origin[3] + aim[3] * hd } or tg.pos
		if mode ~= nil and sightBlocked(from, hitAt, self.colliders) then
			mode = nil
		end
		if mode ~= nil and (best == nil or hd < best.d) then
			best = { d = hd, tg = tg }
		end
	end
	if friend ~= nil and (best == nil or friend.d <= best.d) and impact > 0.0 and fin(friend.tg.poise) and friend.tg.staggerT == nil then
		friend.tg.poise = friend.tg.poise - impact
		if friend.tg.poise <= 0.0 then
			armReaction(friend.tg, "stagger")
		end
	end
	if best == nil then
		return
	end
	local tg = best.tg
	hit(tg, e.id)
	dealt(tg, damage)
	if absorbShield(tg, origin, damage) then
		return
	end
	hurt(tg, damage)
	if fin(tg.poise) and tg.staggerT == nil and impact > 0.0 then
		tg.poise = tg.poise - impact
		if tg.poise <= 0.0 then
			armReaction(tg, "stagger")
		end
	end
	if fin(tg.hp) and tg.hp <= 0.0 then
		armReaction(tg, "stagger")
	end
end

-- ── lob rounds (combat-ranged.js stepProjectiles / burstProjectile) ────────────────────────────────────────────────
function Fight:burst(st, p)
	local R = maxf(p.splashRadius, p.projRadius)
	local owner = st.byId[p.owner]
	local ownerTeam = owner ~= nil and owner.team or nil
	for _, tg in ipairs(st.entities) do
		if tg.id == p.owner or not hittable(tg) then
			continue
		end
		if isDict(tg.egg) then
			if not pointInEgg(p.pos, tg, R) then
				continue
			end
		else
			local v = sub(tg.pos, p.pos)
			if hypot3(v[1], v[2], v[3]) > R + orf(tg.radius, 0.5) then
				continue
			end
		end
		if isStr(ownerTeam) and isStr(tg.team) and tg.team == ownerTeam then
			if fin(tg.poise) and tg.staggerT == nil then
				armReaction(tg, "stagger")
			end
			continue
		end
		hit(tg, p.owner)
		dealt(tg, truthy(p.damage) and p.damage or 0.0)
		if absorbShield(tg, p.pos, p.damage) then
			continue
		end
		hurt(tg, p.damage)
		if fin(tg.hp) and tg.hp <= 0.0 then
			armReaction(tg, "stagger")
		elseif p.impact > 0.0 then
			if fin(tg.poise) and tg.staggerT == nil then
				tg.poise = tg.poise - p.impact
				if tg.poise <= 0.0 then
					armReaction(tg, "stagger")
				end
			end
		else
			armReaction(tg, "stagger")
		end
	end
end

function Fight:stepProjectiles(st, dt)
	local list = self.projectiles
	for i = #list, 1, -1 do
		local p = list[i]
		p.age = p.age + dt
		local prev = copy3(p.pos)
		p.vel[3] = p.vel[3] - p.gravity * dt
		p.pos = { p.pos[1] + p.vel[1] * dt, p.pos[2] + p.vel[2] * dt, p.pos[3] + p.vel[3] * dt }
		local hitId = nil
		if p.age >= p.armTime then
			local seg = hypot3(p.pos[1] - prev[1], p.pos[2] - prev[2], p.pos[3] - prev[3])
			local det = p.projRadius + p.prox
			for _, tg in ipairs(st.entities) do
				if tg.id == p.owner or not hittable(tg) then
					continue
				end
				local stepLen = maxf(latR(tg) * 0.5, 1e-3)
				local n = math.min(24, math.max(1, ceil(seg / stepLen)))
				local hitPt = nil
				local k2 = 1
				while k2 <= n and hitPt == nil do
					local pt = lerp3(prev, p.pos, k2 / n)
					local h
					if isDict(tg.egg) then
						h = pointInEgg(pt, tg, det)
					else
						local v = sub(tg.pos, pt)
						h = hypot3(v[1], v[2], v[3]) <= orf(tg.radius, 0.5) + det
					end
					if h then
						hitPt = pt
					end
					k2 += 1
				end
				if hitPt ~= nil then
					hitId = tg.id
					p.pos = hitPt
					break
				end
			end
		end
		local wall = false
		if p.age >= p.armTime and self.colliders ~= nil then
			local wt = nearestWallT(prev, p.pos, self.colliders)
			if wt ~= nil then
				p.pos = lerp3(prev, p.pos, wt)
				wall = true
			end
		end
		local ground = p.pos[3] <= 0.0
		if hitId ~= nil or ground or wall or p.age >= p.fuse then
			if ground then
				p.pos[3] = 0.0
			end
			self:burst(st, p)
			table.remove(list, i)
		end
	end
end

-- ── the death burst (combat-match.js explodeUnit): the frame a body goes down it blasts a stagger (no damage, no
-- credit) over a radius set by its height (an egg's, else 24), a frontal shield eating it; the deferred wreck finisher
-- stays the web's
local function deathBursts(st)
	for _, e in ipairs(st.entities) do
		if truthy(e.gone) or not truthy(e.downed) or truthy(e.deathBurstDone) then
			continue
		end
		e.deathBurstDone = true
		local egg = e.egg
		local hgt = 24.0
		if isDict(egg) then
			hgt = (fin(egg.cz) and egg.cz or egg.c) + egg.c
		end
		local R = floor(hgt * 0.54 * 10.0 + 0.5) / 10.0
		local cz = hgt * 0.5
		if isDict(egg) then
			cz = fin(egg.cz) and egg.cz or egg.c
		end
		local pos = { e.pos[1], e.pos[2], e.pos[3] + cz }
		for _, tg in ipairs(st.entities) do
			if tg == e or truthy(tg.downed) or not hittable(tg) then
				continue
			end
			if isDict(tg.egg) then
				if not pointInEgg(pos, tg, R) then
					continue
				end
			else
				local v = sub(tg.pos, pos)
				if hypot3(v[1], v[2], v[3]) > R + orf(tg.radius, 0.5) then
					continue
				end
			end
			if absorbShield(tg, pos, 0.0) then
				continue
			end
			armReaction(tg, "stagger")
		end
	end
end

-- ── one frame, in the web engine's order: per body its timers, its reaction, its rule and its arms; then the rounds ──
-- `pose` ({ pos, heading, pitch }, optional): where the pilot's own rule leaves it this frame, set when the loop reaches
-- it (the web steps the pilot in its turn, after the frame's pre-steps: a group reads where it stood); absent, the
-- caller has placed it already. `part`: "all" (one frame), or the frame in two halves around the pilot's own step:
-- "hero" (the pre-steps, the pilot and the bodies), then "minds" (the minds, the rounds in flight and the falls).
function Fight:step(st, hero, input, dt, grounded, pose, part)
	part = part or "all"
	if part ~= "minds" then
		-- the minds' world switch (the web's ai-toggle pre-step: the G press flips it), then their frame's world
		if self.mind ~= nil and truthy(input.aiToggle) then
			self.mindOff = not self.mindOff
		end
		self._frameWorld = self.mind ~= nil and self:mindWorld(st, hero) or nil
		-- the groups give their members slots before the bodies step (the web's `groups` pre-step)
		if self._frameWorld ~= nil then
			self.groups:step(st, dt, self.mind, self._frameWorld)
		end
	end
	local world = self._frameWorld
	for _, e in ipairs(st.entities) do
		local me = hero ~= nil and e == hero
		if world ~= nil and self.mindIds[e.id] then
			if part ~= "hero" then
				self:stepMind(st, e, dt, world)
			end
			continue
		end
		if part == "minds" then
			continue
		end
		if me and isDict(pose) then
			e.pos = { pose.pos[1], pose.pos[2], pose.pos[3] }
			e.heading = pose.heading
			e.pitch = pose.pitch
		end
		if me then
			if isDict(e.weapon) then
				tickWeapon(e.weapon, dt)
			end
			if e.swingT == nil and (e.strikeCdT or 0.0) > 0.0 then
				e.strikeCdT = maxf(0.0, e.strikeCdT - dt)
			end
		end
		local owned = stepReaction(e, dt)
		if not me then
			continue
		end
		if owned and isDict(e.weapon) then
			cancelCharge(e.weapon)
		end
		if not owned then
			self:strikeStep(e, input, dt, grounded)
		end
		if not owned and isDict(e.weapon) then
			self:stepWeapon(e, input, dt, st)
		end
		if not owned then
			stepMelee(e, st.entities)
		end
	end
	if part == "hero" then
		return
	end
	self:stepProjectiles(st, dt)
	deathBursts(st)
end

-- ── THE MINDS: bodies on the web's `ai` rule decide in kernel/mind.luau and fight with this file's trigger and blade,
-- in the web engine's order for each body: its timers (its weapons and cooldowns), its owners (asleep, or reacting:
-- the rule and the weapon wait), the rule, then its trigger (its own, never the pilot's) and its blade. bus.json's
-- `minds` (mind-score.js): each body's rule, the minds' weapons and loadouts, where each was placed, the world's tier
-- and switch, the food a forager grazes.
function Fight:armMinds(st, minds)
	self.mind = K.mind
	self.groups = K.group.new()
	self.mindIds = {}
	self.mindOff = truthy(minds.off)
	self.mindTier = isDict(minds.tier) and minds.tier or nil
	-- the walls a mind sees past and paths round (the fight's own, when it has them)
	if self.colliders == nil and isList(minds.colliders) then
		self.colliders = minds.colliders
	end
	local rules = isDict(minds.rules) and minds.rules or {}
	for _, e in ipairs(st.entities) do
		if isDict(rules[e.id]) then
			e.rule = js.dup(rules[e.id])
		end
		if e.pitch == nil then
			e.pitch = 0.0
		end
	end
	local ms = isDict(minds.minds) and minds.minds or {}
	for _, id in ipairs(js.keys(ms)) do
		local e = st.byId[id]
		if e == nil then
			continue
		end
		local m = ms[id]
		e.spawn = js.dup(nz(m.spawn) or js.obj({ pos = e.pos }))
		if isList(m.loadoutWeapons) then
			e.loadoutWeapons = js.dup(m.loadoutWeapons)
			e.loadoutIdx = nn(m.loadoutIdx, 0)
			e.weapon = nz(e.loadoutWeapons[e.loadoutIdx + 1])
		elseif isDict(m.weapon) then
			e.weapon = js.dup(m.weapon)
		end
		if isDict(m.pilotRule) then
			e.pilotRule = js.dup(m.pilotRule)
		end
		if isStr(m.team) then
			e.team = m.team
		end
		e.locomotion = "forward"
		e.moving = false
		e.gaitPhase = 0.0
		e.aiFire = 0
		self.mindIds[id] = true
	end
	if isList(minds.food) then
		for _, id in ipairs(minds.food) do
			local f = st.byId[js.str(id)]
			if f ~= nil then
				f.food = true
			end
		end
	end
	self.mindOrder = K.mind.idOrder(st.entities)
end

-- the world a mind decides in this frame (the web builds it afresh each step: its path grids live one frame)
function Fight:mindWorld(st, hero)
	return {
		byId = st.byId, order = self.mindOrder, colliders = self.colliders, pilotId = hero ~= nil and hero.id or nil,
		aiEnabled = not self.mindOff, aiTuning = self.mindTier, time = self.mindClock >= 0.0 and self.mindClock or st.time,
		ground = self.groundFn, navCache = {},
	}
end

-- A CHARGE (combat-melee.js stepTackle): a body checking down its line rams the first hittable body in front within
-- reach, once, and stops on it: an ally only reels; one caught mid-swing is STUFFED (the counter: it topples, its swing
-- spent, and the charger's gauge is refilled), which the web plays as the shove-down set piece when the pilot is in it
-- and a camera watches (that stays the web's: here it is the plain counter); anything else takes the charge's damage and
-- reels.
local function endTackle(e)
	e.tackleT = nil
	e.tackleDir = nil
	if e.cineT == nil then
		e.invincible = false
	end
end

local function tackleCounter(tackler, victim)
	armReaction(victim, "topple", true)
	victim.swingT = nil
	victim.swingCombo = false
	victim.comboT = 0.0
	victim.struckThisSwing = {}
	hit(victim, tackler.id)
	local tr = tackler.rule
	local dmg = (isDict(tr) and fin(tr.counterDamage)) and tr.counterDamage or 0.0
	if dmg > 0.0 and fin(victim.hp) then
		victim.hp = maxf(0.0, victim.hp - dmg)
		if victim.hp <= 0.0 then
			if truthy(victim.noDestroy) and fin(victim.hpMax) then
				victim.hp = victim.hpMax
			else
				victim.downed = true
			end
		end
	end
	local bm = (isDict(tr) and fin(tr.boostMax) and tr.boostMax > 0.0) and tr.boostMax or 0.0
	if bm > 0.0 then
		tackler.boost = bm
		tackler.boostLock = false
	end
	tackler.tackleCounterHit = (tackler.tackleCounterHit or 0) + 1
	local pv = victim.pos
	local pt = tackler.pos
	local ux = pv[1] - pt[1]
	local uy = pv[2] - pt[2]
	local ul = hypot2(ux, uy)
	if ul == 0.0 then
		ul = 1e-6
	end
	victim.heading = atan2(-uy / ul, -ux / ul)
end

local function stepTackle(e, st)
	local r = e.rule
	local reach = nn(r.tackleReach, 8.0)
	local dmg = nn(r.tackleDamage, 15.0)
	local cosCone = cos(nn(r.tackleCone, 70.0) * PI / 180.0)
	local aim = fwdXY(e.heading)
	local p = e.pos
	local origin = { p[1], p[2], p[3] + nn(r.eye, 0.0) }
	if type(e.tackleHits) ~= "table" then
		e.tackleHits = {}
	end
	for _, tg in ipairs(st.entities) do
		if tg == e or truthy(tg.invincible) or not hittable(tg) then
			continue
		end
		if e.tackleHits[tg.id] then
			continue
		end
		local v = sub(tg.pos, origin)
		local d = hypot3(v[1], v[2], v[3])
		if d < 1e-3 or d > reach + latR(tg) then
			continue
		end
		local fl = hypot2(v[1], v[2])
		if fl == 0.0 then
			fl = 1e-6
		end
		if (v[1] * aim[1] + v[2] * aim[2]) / fl < cosCone then
			continue
		end
		e.tackleHits[tg.id] = true
		if sameTeam(e, tg) then
			if fin(tg.poise) and tg.staggerT == nil then
				armReaction(tg, "stagger")
			end
			endTackle(e)
			return
		end
		if tg.swingT ~= nil and tg.strikeParams ~= nil and tg.staggerT == nil then
			tackleCounter(e, tg)
			endTackle(e)
			return
		end
		e.tackleHitCount = (e.tackleHitCount or 0) + 1
		hit(tg, e.id)
		if fin(tg.hp) then
			hurt(tg, dmg)
		end
		armReaction(tg, "stagger")
		endTackle(e)
		return
	end
end

function Fight:stepMind(st, e, dt, world)
	-- timers: every carried weapon, the swing, roll and charge cooldowns, the switch ready-time
	if isList(e.loadoutWeapons) then
		for _, lw in ipairs(e.loadoutWeapons) do
			if isDict(lw) then
				tickWeapon(lw, dt)
			end
		end
	elseif isDict(e.weapon) then
		tickWeapon(e.weapon, dt)
	end
	if e.swingT == nil and orf(e.strikeCdT, 0.0) > 0.0 then
		e.strikeCdT = maxf(0.0, e.strikeCdT - dt)
	end
	if e.dodgeT == nil and orf(e.dodgeCdT, 0.0) > 0.0 then
		e.dodgeCdT = maxf(0.0, e.dodgeCdT - dt)
	end
	if e.tackleT == nil and orf(e.tackleCdT, 0.0) > 0.0 then
		e.tackleCdT = maxf(0.0, e.tackleCdT - dt)
	end
	if orf(e.readyT, 0.0) > 0.0 then
		e.readyT = maxf(0.0, e.readyT - dt)
	end
	-- owners: asleep (the cast's dormant), the reaction, the cast (a route it walks, a spot it holds, felled by a cue)
	local owned = truthy(e.dormant)
	owned = stepReaction(e, dt) or owned
	owned = owned or truthy(e.castDown) or e.route ~= nil or truthy(e.held)
	if owned and isDict(e.weapon) then
		cancelCharge(e.weapon)
	end
	if owned then
		return
	end
	self.mind.ai(e, dt, world)
	if isDict(e.weapon) then
		self:stepWeapon(e, { fire = truthy(e.aiFire) and 1 or 0 }, dt, st)
	end
	if e.swingT ~= nil then
		stepMelee(e, st.entities)
	end
	if e.tackleT ~= nil then
		stepTackle(e, st)
	end
end

return combat
end
