extends RefCounted
# mojulo-godot kernel — THE FIGHT: the hero's melee and ranged weapon, and how the bodies they hit react, over the cast
# in the bus's frame (z-up, recipe units, radians). A port of the web's controllable engine (lib/graph/worlds/
# controllable): the platform strike (the fire edge, the direction pick, the cooldown, the two-hit combo),
# meleeContacts and stepMelee's hit; the trigger (semi, auto, burst, charge, magazine and reload, heat), the hitscan
# ray against eggs and spheres, cover, frontal shields, lob rounds swept along their flight and their splash; and
# the reaction a poise-bearing body plays (armReaction / stepReaction: stagger, topple, the flat hold, the getup and
# its wake guard; a killing blow floors it, and its fall blasts a stagger around it). Held EQUAL to the web frame by frame by
# scripts/godot-combat-conformance.mjs. What stays on the web: the combo's stun, scaling and juggle, the clash and the
# other set pieces, boost armor and the charge-through-boost, a loadout's other slots and every AI's attack. A hit
# counts on the body (`hits`), and kernel/cast.gd tells the bus (hit:<id>).
#
#   var K = preload("res://kernel/combat.gd").new()
#   K.arm(cast_state, combat)            bus.json's `combat`: the hittable bodies take their fields, the hero its arms
#   K.step(cast_state, hero, input, dt, grounded)
#                                        input: { fire, forward, strafe, turn }; one frame in the web engine's order

const Bus := preload("res://kernel/bus.gd")
var strike = null
var look := false
var colliders = null
var projectiles := []


func arm(st: Dictionary, combat: Dictionary) -> void:
	strike = combat.get("strike") if combat.get("strike") is Dictionary else null
	look = Bus.truthy(combat.get("look"))
	colliders = combat.get("colliders") if combat.get("colliders") is Array else null
	projectiles = []
	var bodies: Dictionary = combat.get("bodies", {}) if combat.get("bodies") is Dictionary else {}
	var hero = st["byId"].get(String(combat.get("hero", "")))
	if hero != null:
		if combat.get("team") is String:
			hero["team"] = combat["team"]
		if combat.get("weapon") is Dictionary:
			hero["weapon"] = (combat["weapon"] as Dictionary).duplicate(true)
		hero["pitch"] = 0.0
	for e in st["entities"]:
		e["hits"] = 0
		e["lastHitBy"] = null
		var b = bodies.get(e["id"])
		if not (b is Dictionary):
			continue
		e["hittable"] = not e["dormant"]
		if b.get("egg") is Dictionary:
			e["egg"] = b["egg"]
		else:
			e["radius"] = float(b.get("radius", 0.5))
		for k in ["team", "hpMax", "poise", "poiseMax", "poiseRegen", "staggerDur", "toppleDur", "getupDur", "wakeGuard", "downPause", "shieldHp", "shieldArc"]:
			if b.has(k):
				e[k] = b[k]
		if e.has("poise"):
			e["staggerT"] = null
			e["reactClip"] = "stagger"
			e["reactDur"] = null
			e["downPauseT"] = null
		if e.has("shieldHp"):
			e["shieldBroken"] = false
		e["noDestroy"] = Bus.truthy(b.get("noDestroy"))


# ── vectors (core.js) ────────────────────────────────────────────────────────────────────────────────────────────
static func _fwd_xy(h: float) -> Array:
	return [cos(h), sin(h), 0.0]


static func _right_xy(h: float) -> Array:
	return [sin(h), -cos(h), 0.0]


static func _fwd3(h: float, p: float) -> Array:
	return [cos(p) * cos(h), cos(p) * sin(h), sin(p)]


static func _sub(a: Array, b: Array) -> Array:
	return [float(a[0]) - float(b[0]), float(a[1]) - float(b[1]), float(a[2]) - float(b[2])]


static func _lerp3(a: Array, b: Array, t: float) -> Array:
	return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]


# JS Math.hypot: the root of the summed squares
static func _hypot3(a: float, b: float, c: float) -> float:
	return sqrt(a * a + b * b + c * c)


static func _hypot2(a: float, b: float) -> float:
	return sqrt(a * a + b * b)


static func _fin(v) -> bool:
	return Bus.finite(v)


# JS `x || d` for a number: 0, null and NaN fall through
static func _or(v, d: float) -> float:
	return float(v) if _fin(v) and float(v) != 0.0 else d


# ── cover (core.js segAabbT / sightBlocked / nearestWallT) ─────────────────────────────────────────────────────────
static func _seg_aabb_t(a: Array, b: Array, mn: Array, mx: Array):
	var t0 := 0.0
	var t1 := 1.0
	for k in 3:
		var d: float = b[k] - a[k]
		if absf(d) < 1e-9:
			if a[k] < float(mn[k]) or a[k] > float(mx[k]):
				return null
		else:
			var tn: float = (float(mn[k]) - a[k]) / d
			var tf: float = (float(mx[k]) - a[k]) / d
			if tn > tf:
				var s := tn
				tn = tf
				tf = s
			if tn > t0:
				t0 = tn
			if tf < t1:
				t1 = tf
			if t0 > t1:
				return null
	return t0


func _sight_blocked(a: Array, b: Array) -> bool:
	if colliders == null:
		return false
	for c in colliders:
		var t = _seg_aabb_t(a, b, c["min"], c["max"])
		if t != null and t > 1e-3 and t < 1.0 - 1e-3:
			return true
	return false


func _nearest_wall_t(a: Array, b: Array):
	if colliders == null:
		return null
	var best = null
	for c in colliders:
		var t = _seg_aabb_t(a, b, c["min"], c["max"])
		if t != null and t > 1e-3 and (best == null or t < best):
			best = t
	return best


# ── hit volumes (combat-hit.js) ──────────────────────────────────────────────────────────────────────────────────
static func _flat(tg: Dictionary) -> bool:
	return tg.get("reactClip") == "topple" and tg.get("staggerT") != null and float(tg["staggerT"]) >= 1.0


# a flat toppled body presents its length along the floor
static func lat_r(tg: Dictionary) -> float:
	if tg.get("egg") is Dictionary:
		return float(tg["egg"]["c"]) if _flat(tg) else float(tg["egg"]["a"])
	return _or(tg.get("radius"), 0.5)


# the egg's long axis: up, or along the floor when it lies toppled (a kernel body never boosts, so it never leans)
static func _egg_axis(tg: Dictionary) -> Array:
	if _flat(tg):
		var h := float(tg["heading"])
		return [cos(h), sin(h), 0.0]
	return [0.0, 0.0, 1.0]


static func _egg_scale(u: Array, ez: Array, a: float, cc: float) -> Array:
	var par: float = u[0] * ez[0] + u[1] * ez[1] + u[2] * ez[2]
	var f: float = (1.0 / cc - 1.0 / a) * par
	return [u[0] / a + f * ez[0], u[1] / a + f * ez[1], u[2] / a + f * ez[2]]


static func hit_egg(origin: Array, dir: Array, tg: Dictionary):
	var egg: Dictionary = tg["egg"]
	var a := float(egg["a"])
	var cc := float(egg["c"])
	var cz := a if _flat(tg) else (float(egg["cz"]) if _fin(egg.get("cz")) else cc)
	var p: Array = tg["pos"]
	var C := [float(p[0]), float(p[1]), float(p[2]) + cz]
	var ez := _egg_axis(tg)
	var O := _egg_scale(_sub(origin, C), ez, a, cc)
	var D := _egg_scale(dir, ez, a, cc)
	var A: float = D[0] * D[0] + D[1] * D[1] + D[2] * D[2]
	if A <= 1e-12:
		return null
	var B: float = 2.0 * (O[0] * D[0] + O[1] * D[1] + O[2] * D[2])
	var K: float = O[0] * O[0] + O[1] * O[1] + O[2] * O[2] - 1.0
	var disc := B * B - 4.0 * A * K
	if disc < 0.0:
		return null
	var sq := sqrt(disc)
	var t0 := (-B - sq) / (2.0 * A)
	var t1 := (-B + sq) / (2.0 * A)
	return t0 if t0 > 1e-4 else (t1 if t1 > 1e-4 else null)


static func point_in_egg(pt: Array, tg: Dictionary, pad: float) -> bool:
	var egg: Dictionary = tg["egg"]
	var a := float(egg["a"]) + pad
	var cc := float(egg["c"]) + pad
	var cz := a if _flat(tg) else (float(egg["cz"]) if _fin(egg.get("cz")) else float(egg["c"]))
	var ez := _egg_axis(tg)
	var p: Array = tg["pos"]
	var u := [pt[0] - float(p[0]), pt[1] - float(p[1]), pt[2] - (float(p[2]) + cz)]
	var par: float = u[0] * ez[0] + u[1] * ez[1] + u[2] * ez[2]
	var perp2 := maxf(0.0, (u[0] * u[0] + u[1] * u[1] + u[2] * u[2]) - par * par)
	return perp2 / (a * a) + (par * par) / (cc * cc) <= 1.0


# a frontal shield eats a hit whose source lies in its arc; breaking it staggers the body
static func _shield_covers(tg: Dictionary, src: Array) -> bool:
	if _or(tg.get("shieldHp"), 0.0) == 0.0 or Bus.truthy(tg.get("shieldBroken")):
		return false
	var front := _fwd_xy(float(tg["heading"]))
	var ix: float = src[0] - float(tg["pos"][0])
	var iy: float = src[1] - float(tg["pos"][1])
	var m := _hypot2(ix, iy)
	if m == 0.0:
		m = 1e-6
	return (ix * front[0] + iy * front[1]) / m >= cos(_or(tg.get("shieldArc"), PI * 0.6) / 2.0)


static func _absorb_shield(tg: Dictionary, src: Array, drain: float) -> bool:
	if not _shield_covers(tg, src):
		return false
	tg["shieldHp"] = float(tg["shieldHp"]) - drain
	if float(tg["shieldHp"]) <= 0.0:
		tg["shieldHp"] = 0.0
		tg["shieldBroken"] = true
		arm_reaction(tg, "stagger")
	return true


# ── the reaction (combat-hit.js armReaction / stepReaction, without the combo) ───────────────────────────────────────
static func arm_reaction(tg: Dictionary, kind: String, force: bool = false) -> void:
	if not _fin(tg.get("poise")):
		return
	var dead := _fin(tg.get("hp")) and float(tg["hp"]) <= 0.0
	if dead:
		kind = "topple"
	var in_knockdown: bool = tg["staggerT"] != null and tg["reactClip"] in ["topple", "downpause", "getup"]
	if tg["staggerT"] != null and not dead and not (force and not in_knockdown):
		return
	var sd := _or(tg.get("staggerDur"), 1.3)
	tg["poise"] = tg["poiseMax"]
	tg["staggerT"] = 0.0
	tg["downPauseT"] = null
	tg["reactClip"] = "topple" if kind == "topple" else "stagger"
	tg["reactDur"] = _or(tg.get("toppleDur"), sd * 1.3) if kind == "topple" else sd
	if dead:
		if Bus.truthy(tg.get("noDestroy")) and _fin(tg.get("hpMax")):
			tg["hp"] = float(tg["hpMax"])
		else:
			tg["downed"] = true


# one frame of a poise-bearing body's reaction; true while it reels (its rule and arms wait)
static func step_reaction(e: Dictionary, dt: float) -> bool:
	if not _fin(e.get("poise")):
		return false
	if _or(e.get("wakeGuardT"), 0.0) > 0.0:
		e["wakeGuardT"] = maxf(0.0, float(e["wakeGuardT"]) - dt)
		e["invincible"] = float(e["wakeGuardT"]) > 0.0
	if e["staggerT"] == null:
		if float(e["poise"]) < float(e["poiseMax"]):
			e["poise"] = minf(float(e["poiseMax"]), float(e["poise"]) + _or(e.get("poiseRegen"), 0.0) * dt)
		return false
	var hold := float(e["downPause"]) if _fin(e.get("downPause")) else 2.0
	if e["reactClip"] == "topple" and e["downPauseT"] != null:
		e["downPauseT"] = float(e["downPauseT"]) + dt
		if float(e["downPauseT"]) >= hold:
			e["reactClip"] = "getup"
			e["reactDur"] = _or(e.get("getupDur"), _or(e.get("staggerDur"), 1.3) * 1.4)
			e["staggerT"] = 0.0
			e["downPauseT"] = null
			e["locomotion"] = "getup"
			e["invincible"] = true
			return true
		e["staggerT"] = 1.0
		e["locomotion"] = "topple"
		e["invincible"] = false
		return true
	e["staggerT"] = float(e["staggerT"]) + dt / _or(e.get("reactDur"), _or(e.get("staggerDur"), 1.3))
	if float(e["staggerT"]) >= 1.0:
		if e["reactClip"] == "topple":
			if not Bus.truthy(e.get("downed")):
				e["downPauseT"] = 0.0
			e["staggerT"] = 1.0
			e["locomotion"] = "topple"
			e["invincible"] = false
			return true
		var rose: bool = e["reactClip"] == "getup"
		e["staggerT"] = null
		e["downPauseT"] = null
		e["locomotion"] = null
		if rose and _or(e.get("wakeGuard"), 0.0) > 0.0:
			e["wakeGuardT"] = float(e["wakeGuard"])
			e["invincible"] = true
		else:
			e["invincible"] = false
		return false
	e["locomotion"] = e["reactClip"]
	e["invincible"] = e["reactClip"] == "getup"
	return true


# a hit's count and who dealt it, and its damage
static func _hit(tg: Dictionary, by: String) -> void:
	tg["hits"] = int(tg.get("hits", 0)) + 1
	tg["lastHitBy"] = by


static func _hurt(tg: Dictionary, dmg: float) -> void:
	if _fin(tg.get("hp")):
		tg["hp"] = maxf(0.0, float(tg["hp"]) - dmg)


static func _hittable(tg: Dictionary) -> bool:
	return not Bus.truthy(tg.get("invincible")) and Bus.truthy(tg.get("hittable"))


# ── melee (combat-melee.js) ──────────────────────────────────────────────────────────────────────────────────────
# meleeContacts: who this swing meets this step, before anything is done to them, in entity order; a clash (a target
# itself mid-swing) consumes the swing, so the list stops there
static func melee_contacts(e: Dictionary, entities: Array) -> Array:
	var out := []
	var P = e.get("strikeParams")
	if e.get("swingT") == null or not (P is Dictionary):
		return out
	var sw := float(e["swingT"])
	if sw < float(P["from"]) or sw > float(P["to"]):
		return out
	var h := float(e["heading"]) + _or(P.get("aimYaw"), 0.0)
	var aim := [cos(h), sin(h)]
	var p: Array = e["pos"]
	var origin := [float(p[0]), float(p[1]), float(p[2]) + float(P["eye"])]
	var struck: Dictionary = e.get("struckThisSwing", {})
	for tg in entities:
		if is_same(tg, e) or not _hittable(tg):
			continue
		if struck.has(tg["id"]):
			continue
		var v := _sub(tg["pos"], origin)
		var d := _hypot3(v[0], v[1], v[2])
		if d < 1e-3 or d > float(P["reach"]) + lat_r(tg):
			continue
		var flat := _hypot2(v[0], v[1])
		if flat == 0.0:
			flat = 1e-6
		if (v[0] * aim[0] + v[1] * aim[1]) / flat < float(P["cosCone"]):
			continue
		if tg.get("team") is String and e.get("team") is String and tg["team"] == e["team"]:
			out.append({"tg": tg, "kind": "ally"})
			continue
		if tg.get("swingT") != null and tg.get("strikeParams") is Dictionary and tg.get("staggerT") == null:
			out.append({"tg": tg, "kind": "clash"})
			break
		out.append({"tg": tg, "kind": "hit"})
	return out


# stepMelee's writes: an ally reels, a clash is marked (the lock stays the web's), a hit counts, is credited, takes its
# damage, and reels or topples (a toppling verb, or the back cleave; on a combo slot only the follow-up)
static func step_melee(e: Dictionary, entities: Array) -> void:
	var P = e.get("strikeParams")
	for c in melee_contacts(e, entities):
		var tg: Dictionary = c["tg"]
		e["struckThisSwing"][tg["id"]] = true
		if c["kind"] == "ally":
			if _fin(tg.get("poise")) and tg["staggerT"] == null:
				arm_reaction(tg, "stagger")
			continue
		if c["kind"] == "clash":
			break
		e["meleeHitCount"] = int(e.get("meleeHitCount", 0)) + 1
		_hit(tg, e["id"])
		_hurt(tg, float(P["damage"]))
		var topples: bool = (Bus.truthy(P["topple"]) if P.get("topple") != null else e.get("swingClip") == "swing_back") and (Bus.truthy(e.get("swingCombo")) if Bus.truthy(P.get("combo")) else true)
		arm_reaction(tg, "topple" if topples else "stagger", topples)


# the platform strike: a fire press swings (the held direction picks the cut), the swing runs over dur, its end arms
# the cooldown, and on a combo slot the opener opens a window for one follow-up in another direction
func strike_step(e: Dictionary, input: Dictionary, dt: float, grounded: bool) -> void:
	if strike == null:
		return
	var fire := Bus.truthy(input.get("fire"))
	var edge := fire and not Bus.truthy(e.get("strikePrev"))
	e["strikePrev"] = fire
	var depth := int(strike.get("combo", 0))
	var cd := float(strike.get("cooldown", 0.0))
	var fwd := float(input.get("forward", 0.0))
	var side := clampf(float(input.get("strafe", 0.0)) + (float(input.get("turn", 0.0)) if look else 0.0), -1.0, 1.0)
	var dir := ("right" if side > 0.0 else "left") if absf(side) > absf(fwd) else ("back" if fwd < -1e-3 else ("forward" if fwd > 1e-3 else "neutral"))
	var combo_click: bool = depth > 0 and float(e.get("comboT", 0.0)) > 0.0 and dir != e.get("lastSwingDir")
	if e.get("swingT") == null and edge and ((float(e.get("strikeCdT", 0.0)) > 0.0 and not combo_click) or float(e.get("readyT", 0.0)) > 0.0):
		pass
	elif e.get("swingT") == null and edge and grounded:
		var spec: Dictionary = strike["swings"][dir]
		e["swingT"] = 0.0
		e["swingClip"] = spec["clip"]
		e["swingCombo"] = combo_click
		e["comboT"] = 0.0
		e["swingCount"] = int(e.get("swingCount", 0)) + 1
		e["struckThisSwing"] = {}
		e["strikeParams"] = spec["params"]
		e["lastSwingDir"] = dir
	elif e.get("swingT") != null:
		var was_combo := Bus.truthy(e.get("swingCombo"))
		e["swingT"] = float(e["swingT"]) + dt / float(strike["dur"])
		if float(e["swingT"]) >= 1.0 or not grounded:
			if float(e["swingT"]) >= 1.0 and depth > 0 and not was_combo:
				e["comboT"] = float(strike["comboWindow"])
			var c := float(strike["comboCooldown"]) if float(e["swingT"]) >= 1.0 and was_combo else cd
			if c > 0.0:
				e["strikeCdT"] = c
			e["swingT"] = null
			e["swingCombo"] = false
	if e.get("swingT") == null and float(e.get("comboT", 0.0)) > 0.0:
		e["comboT"] = maxf(0.0, float(e["comboT"]) - dt)


# ── the trigger (combat-ranged.js tickWeapon / stepWeapon) ─────────────────────────────────────────────────────────
static func tick_weapon(w: Dictionary, dt: float) -> void:
	if float(w["cooldownT"]) > 0.0:
		w["cooldownT"] = maxf(0.0, float(w["cooldownT"]) - dt)
	if float(w["energyMax"]) > 0.0:
		var rr: float = float(w["energyRegen"])
		if Bus.truthy(w["energyLock"]) and w.get("energyOverheatRegen") != null:
			rr = float(w["energyOverheatRegen"])
		if rr > 0.0:
			w["energy"] = minf(float(w["energyMax"]), (float(w["energy"]) if w.get("energy") != null else float(w["energyMax"])) + rr * dt)
		if Bus.truthy(w["energyLock"]) and float(w["energy"]) >= float(w["energyMax"]) * maxf(0.0, minf(1.0, float(w["energyUnlockFrac"]))):
			w["energy"] = minf(float(w["energyMax"]), float(w["energy"]))
			w["energyLock"] = false
	if float(w["ammo"]) <= 0.0 and not Bus.truthy(w["reloading"]) and not dry(w):
		w["reloading"] = true
		w["reloadT"] = float(w["reload"])
		w["burstLeft"] = 0
	if Bus.truthy(w["reloading"]):
		w["reloadT"] = float(w["reloadT"]) - dt
		if float(w["reloadT"]) <= 0.0:
			# a reload draws from the reserve (since 0.22.0, combat-ranged.js): all of it when it is less than a magazine;
			# no reserve (null) is the endless reload it always was
			var take: float = float(w["magazine"]) if w.get("reserve") == null else minf(float(w["magazine"]), float(w["reserve"]))
			w["ammo"] = take
			w["reloading"] = false
			w["reloadT"] = 0.0
			if w.get("reserve") != null:
				w["reserve"] = float(w["reserve"]) - take


# out of rounds in the magazine and the reserve both: the weapon is dry and does not reload (the web's reserve !== 0)
static func dry(w: Dictionary) -> bool:
	return w.get("reserve") != null and float(w["reserve"]) == 0.0


static func _cancel_charge(w: Dictionary) -> void:
	if not Bus.truthy(w.get("charging")):
		return
	w["charging"] = false
	w["chargeT"] = 0.0
	w["chargeFrac"] = 0.0
	w["chargeReady"] = false


# `x ?? y ?? 0` over a weapon's optional numbers
static func _nn(w: Dictionary, k: String, d: float) -> float:
	return float(w[k]) if w.get(k) != null else d


func step_weapon(e: Dictionary, input: Dictionary, dt: float, st: Dictionary) -> void:
	var w: Dictionary = e["weapon"]
	var fire_held := Bus.truthy(input.get("fire"))
	if Bus.truthy(w["reloading"]) or (float(w["energyMax"]) > 0.0 and Bus.truthy(w["energyLock"])) or float(e.get("readyT", 0.0)) > 0.0:
		_cancel_charge(w)
		w["prevFire"] = fire_held
		return
	var edge := fire_held and not Bus.truthy(w["prevFire"])
	var release := not fire_held and Bus.truthy(w["prevFire"])
	var energy_ready := not (float(w["energyMax"]) > 0.0) or float(w["energy"]) > 0.0
	var forced := false
	var charged := false
	if float(w["chargeTime"]) > 0.0 and not Bus.truthy(w["auto"]):
		var ready_pull: bool = float(w["cooldownT"]) <= 0.0 and float(w["burstLeft"]) <= 0.0 and float(w["ammo"]) > 0.0 and energy_ready
		if Bus.truthy(w["charging"]) and fire_held:
			w["chargeT"] = minf(float(w["chargeTime"]), _or(w.get("chargeT"), 0.0) + dt)
			w["chargeFrac"] = maxf(0.0, minf(1.0, float(w["chargeT"]) / float(w["chargeTime"])))
			w["chargeReady"] = float(w["chargeFrac"]) >= 1.0
			w["prevFire"] = true
			return
		if Bus.truthy(w["charging"]) and release:
			charged = Bus.truthy(w["chargeReady"])
			_cancel_charge(w)
			if charged:
				forced = true
			elif ready_pull:
				w["burstLeft"] = w["burst"]
		elif edge and ready_pull:
			w["charging"] = true
			w["chargeT"] = 0.0
			w["chargeFrac"] = 0.0
			w["chargeReady"] = false
			w["chargeCount"] = int(_or(w.get("chargeCount"), 0.0)) + 1
			w["prevFire"] = true
			return
		elif float(w["burstLeft"]) <= 0.0:
			w["prevFire"] = fire_held
			return
	w["prevFire"] = fire_held
	var impact: float = _nn(w, "chargedImpact", _nn(w, "impact", 0.0)) if charged else _or(w.get("impact"), 0.0)
	var shot_range: float = float(w["range"]) * _or(w.get("chargedRangeMul"), 1.0) if charged else float(w["range"])
	var damage: float = _nn(w, "chargedDamage", _nn(w, "damage", 0.0)) if charged else _or(w.get("damage"), 0.0)
	if not Bus.truthy(w["auto"]) and not forced and edge and float(w["cooldownT"]) <= 0.0 and float(w["burstLeft"]) <= 0.0 and float(w["ammo"]) > 0.0:
		w["burstLeft"] = w["burst"]
	var want: bool = energy_ready and float(w["ammo"]) > 0.0 and float(w["cooldownT"]) <= 0.0 and (forced or (fire_held if Bus.truthy(w["auto"]) else float(w["burstLeft"]) > 0.0))
	if want:
		_shoot(e, w, st, charged, forced, impact, shot_range, damage)
	if float(w["ammo"]) <= 0.0 and not Bus.truthy(w["reloading"]) and not dry(w):
		w["reloading"] = true
		w["reloadT"] = float(w["reload"])


func _shoot(e: Dictionary, w: Dictionary, st: Dictionary, charged: bool, forced: bool, impact: float, shot_range: float, damage: float) -> void:
	w["ammo"] = float(w["ammo"]) - (minf(float(w["chargedAmmoCost"]), float(w["ammo"])) if charged and _or(w.get("chargedAmmoCost"), 0.0) != 0.0 else 1.0)
	w["shots"] = int(w["shots"]) + 1
	if float(w["energyMax"]) > 0.0:
		var ec: float = _nn(w, "chargedEnergyCost", _or(w.get("energyCost"), 0.0)) if charged else _or(w.get("energyCost"), 0.0)
		w["energy"] = maxf(0.0, _nn(w, "energy", float(w["energyMax"])) - ec)
		if float(w["energy"]) <= 0.0:
			w["energy"] = 0.0
			w["energyLock"] = true
			w["burstLeft"] = 0
	if charged:
		w["chargedShots"] = int(_or(w.get("chargedShots"), 0.0)) + 1
	if not Bus.truthy(w["auto"]) and not forced:
		w["burstLeft"] = float(w["burstLeft"]) - 1.0
	if Bus.truthy(w["auto"]):
		w["cooldownT"] = 1.0 / _or(w.get("rof"), 10.0)
	else:
		w["cooldownT"] = 1.0 / _or(w.get("burstRof"), 8.0) if float(w["burstLeft"]) > 0.0 else _or(w.get("cooldown"), 0.5)
	var p: Array = e["pos"]
	var h := float(e["heading"])
	var pitch := _or(e.get("pitch"), 0.0)
	var origin := [float(p[0]), float(p[1]), float(p[2]) + float(w["eye"])]
	var aim := _fwd3(h, pitch)
	var mo = w.get("muzzleOffset")
	var hf := _fwd_xy(h)
	var hr := _right_xy(h)
	var from: Array = origin.duplicate()
	if mo is Dictionary:
		var r_mul := -1.0 if Bus.truthy(w.get("muzzleAlt")) and int(w["shots"]) % 2 == 0 else 1.0
		var mf := _or(mo.get("f"), 0.0)
		var mr := _or(mo.get("r"), 0.0)
		from = [float(p[0]) + hf[0] * mf + hr[0] * mr * r_mul, float(p[1]) + hf[1] * mf + hr[1] * mr * r_mul, float(p[2]) + _nn(mo, "u", float(w["eye"]))]
	if w["fireClass"] == "lob":
		var dir := _fwd3(h, pitch + _or(w.get("lobAngle"), 0.0) * PI / 180.0)
		var sp := _or(w.get("projectileSpeed"), 60.0)
		projectiles.append({"owner": e["id"], "pos": from.duplicate(), "vel": [dir[0] * sp, dir[1] * sp, dir[2] * sp], "gravity": _or(w.get("projectileGravity"), 0.0), "splashRadius": _or(w.get("splashRadius"), 0.0), "projRadius": _or(w.get("projRadius"), 0.5), "prox": _or(w.get("proximity"), 0.0), "damage": _or(w.get("damage"), 0.0), "impact": impact, "age": 0.0, "armTime": _or(w.get("armTime"), 0.0), "fuse": _or(w.get("fuse"), 4.0)})
		return
	var core_r := float(w["coreAngle"]) * PI / 180.0
	var assist_r := float(w["assistAngle"]) * PI / 180.0
	var best = null
	var friend = null
	for tg in st["entities"]:
		if is_same(tg, e) or not _hittable(tg):
			continue
		var friendly: bool = e.get("team") is String and tg.get("team") is String and tg["team"] == e["team"]
		var v := _sub(tg["pos"], origin)
		var d := _hypot3(v[0], v[1], v[2])
		if d < 1e-3 or d > shot_range:
			continue
		var mode = null
		var hd := d
		if tg.get("egg") is Dictionary:
			var te = hit_egg(origin, aim, tg)
			if te != null and te <= shot_range:
				mode = "core"
				hd = te
			elif w["fireClass"] == "area":
				var ang := acos(clampf((v[0] * aim[0] + v[1] * aim[1] + v[2] * aim[2]) / d, -1.0, 1.0))
				if ang <= assist_r + atan(float(tg["egg"]["a"]) / d):
					mode = "assist"
		else:
			var ang := acos(clampf((v[0] * aim[0] + v[1] * aim[1] + v[2] * aim[2]) / d, -1.0, 1.0))
			var subtend := atan(_or(tg.get("radius"), 0.5) / d)
			if ang <= core_r + subtend:
				mode = "core"
			elif w["fireClass"] == "area" and ang <= assist_r + subtend:
				mode = "assist"
		if friendly:
			if mode != null and not _sight_blocked(from, tg["pos"]) and (friend == null or hd < friend["d"]):
				friend = {"d": hd, "tg": tg}
			continue
		if mode != null and _sight_blocked(from, tg["pos"]):
			mode = null
		if mode != null and (best == null or hd < best["d"]):
			best = {"d": hd, "tg": tg}
	if friend != null and (best == null or friend["d"] <= best["d"]) and impact > 0.0 and _fin(friend["tg"].get("poise")) and friend["tg"]["staggerT"] == null:
		friend["tg"]["poise"] = float(friend["tg"]["poise"]) - impact
		if float(friend["tg"]["poise"]) <= 0.0:
			arm_reaction(friend["tg"], "stagger")
	if best == null:
		return
	var tg: Dictionary = best["tg"]
	_hit(tg, e["id"])
	if _absorb_shield(tg, origin, damage):
		return
	_hurt(tg, damage)
	if _fin(tg.get("poise")) and tg["staggerT"] == null and impact > 0.0:
		tg["poise"] = float(tg["poise"]) - impact
		if float(tg["poise"]) <= 0.0:
			arm_reaction(tg, "stagger")
	if _fin(tg.get("hp")) and float(tg["hp"]) <= 0.0:
		arm_reaction(tg, "stagger")


# ── lob rounds (combat-ranged.js stepProjectiles / burstProjectile) ────────────────────────────────────────────────
func step_projectiles(st: Dictionary, dt: float) -> void:
	for i in range(projectiles.size() - 1, -1, -1):
		var p: Dictionary = projectiles[i]
		p["age"] = float(p["age"]) + dt
		var prev: Array = (p["pos"] as Array).duplicate()
		p["vel"][2] = float(p["vel"][2]) - float(p["gravity"]) * dt
		p["pos"] = [p["pos"][0] + p["vel"][0] * dt, p["pos"][1] + p["vel"][1] * dt, p["pos"][2] + p["vel"][2] * dt]
		var hit_id = null
		if float(p["age"]) >= float(p["armTime"]):
			var seg := _hypot3(p["pos"][0] - prev[0], p["pos"][1] - prev[1], p["pos"][2] - prev[2])
			var det := float(p["projRadius"]) + float(p["prox"])
			for tg in st["entities"]:
				if tg["id"] == p["owner"] or not _hittable(tg):
					continue
				var step_len := maxf(lat_r(tg) * 0.5, 1e-3)
				var n := mini(24, maxi(1, ceili(seg / step_len)))
				var hit_pt = null
				var k2 := 1
				while k2 <= n and hit_pt == null:
					var pt := _lerp3(prev, p["pos"], float(k2) / float(n))
					var hit := false
					if tg.get("egg") is Dictionary:
						hit = point_in_egg(pt, tg, det)
					else:
						var v := _sub(tg["pos"], pt)
						hit = _hypot3(v[0], v[1], v[2]) <= _or(tg.get("radius"), 0.5) + det
					if hit:
						hit_pt = pt
					k2 += 1
				if hit_pt != null:
					hit_id = tg["id"]
					p["pos"] = hit_pt
					break
		var wall := false
		if float(p["age"]) >= float(p["armTime"]) and colliders != null:
			var wt = _nearest_wall_t(prev, p["pos"])
			if wt != null:
				p["pos"] = _lerp3(prev, p["pos"], wt)
				wall = true
		var ground: bool = p["pos"][2] <= 0.0
		if hit_id != null or ground or wall or float(p["age"]) >= float(p["fuse"]):
			if ground:
				p["pos"][2] = 0.0
			_burst(st, p)
			projectiles.remove_at(i)


func _burst(st: Dictionary, p: Dictionary) -> void:
	var R := maxf(float(p["splashRadius"]), float(p["projRadius"]))
	var owner = st["byId"].get(p["owner"])
	var owner_team = owner.get("team") if owner != null else null
	for tg in st["entities"]:
		if tg["id"] == p["owner"] or not _hittable(tg):
			continue
		if tg.get("egg") is Dictionary:
			if not point_in_egg(p["pos"], tg, R):
				continue
		else:
			var v := _sub(tg["pos"], p["pos"])
			if _hypot3(v[0], v[1], v[2]) > R + _or(tg.get("radius"), 0.5):
				continue
		if owner_team is String and tg.get("team") is String and tg["team"] == owner_team:
			if _fin(tg.get("poise")) and tg["staggerT"] == null:
				arm_reaction(tg, "stagger")
			continue
		_hit(tg, p["owner"])
		if _absorb_shield(tg, p["pos"], float(p["damage"])):
			continue
		_hurt(tg, float(p["damage"]))
		if _fin(tg.get("hp")) and float(tg["hp"]) <= 0.0:
			arm_reaction(tg, "stagger")
		elif float(p["impact"]) > 0.0:
			if _fin(tg.get("poise")) and tg["staggerT"] == null:
				tg["poise"] = float(tg["poise"]) - float(p["impact"])
				if float(tg["poise"]) <= 0.0:
					arm_reaction(tg, "stagger")
		else:
			arm_reaction(tg, "stagger")


# ── the death burst (combat-match.js explodeUnit): the frame a body goes down it blasts a stagger (no damage, no
# credit) over a radius set by its height (an egg's, else 24), a frontal shield eating it; the deferred wreck finisher
# stays the web's
func _death_bursts(st: Dictionary) -> void:
	for e in st["entities"]:
		if Bus.truthy(e.get("gone")) or not Bus.truthy(e.get("downed")) or Bus.truthy(e.get("deathBurstDone")):
			continue
		e["deathBurstDone"] = true
		var egg = e.get("egg")
		var hgt := 24.0
		if egg is Dictionary:
			hgt = (float(egg["cz"]) if _fin(egg.get("cz")) else float(egg["c"])) + float(egg["c"])
		var R: float = floor(hgt * 0.54 * 10.0 + 0.5) / 10.0
		var cz := hgt * 0.5
		if egg is Dictionary:
			cz = float(egg["cz"]) if _fin(egg.get("cz")) else float(egg["c"])
		var pos := [float(e["pos"][0]), float(e["pos"][1]), float(e["pos"][2]) + cz]
		for tg in st["entities"]:
			if is_same(tg, e) or Bus.truthy(tg.get("downed")) or not _hittable(tg):
				continue
			if tg.get("egg") is Dictionary:
				if not point_in_egg(pos, tg, R):
					continue
			else:
				var v := _sub(tg["pos"], pos)
				if _hypot3(v[0], v[1], v[2]) > R + _or(tg.get("radius"), 0.5):
					continue
			if _absorb_shield(tg, pos, 0.0):
				continue
			arm_reaction(tg, "stagger")


# ── one frame, in the web engine's order: per body its timers, its reaction, its rule and its arms; then the rounds ──
func step(st: Dictionary, hero: Dictionary, input: Dictionary, dt: float, grounded: bool) -> void:
	for e in st["entities"]:
		var me := is_same(e, hero)
		if me:
			if e.get("weapon") is Dictionary:
				tick_weapon(e["weapon"], dt)
			if e.get("swingT") == null and float(e.get("strikeCdT", 0.0)) > 0.0:
				e["strikeCdT"] = maxf(0.0, float(e["strikeCdT"]) - dt)
		var owned := step_reaction(e, dt)
		if not me:
			continue
		if owned and e.get("weapon") is Dictionary:
			_cancel_charge(e["weapon"])
		if not owned:
			strike_step(e, input, dt, grounded)
		if not owned and e.get("weapon") is Dictionary:
			step_weapon(e, input, dt, st)
		if not owned:
			step_melee(e, st["entities"])
	step_projectiles(st, dt)
	_death_bursts(st)
