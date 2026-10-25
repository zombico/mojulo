extends RefCounted
# mojulo-godot kernel — THE FIGHT: the hero's melee and ranged weapon, and how the bodies they hit react, over the cast
# in the bus's frame (z-up, recipe units, radians). A port of the web's controllable engine (lib/graph/worlds/
# controllable): the platform strike (the fire edge, the direction pick, the cooldown, the two-hit combo),
# meleeContacts and stepMelee's hit; the trigger (semi, auto, burst, charge, magazine and reload, heat), the hitscan
# ray against eggs and spheres, cover, frontal shields, lob rounds swept along their flight and their splash; and
# the reaction a poise-bearing body plays (armReaction / stepReaction: stagger, topple, the flat hold, the getup and
# its wake guard; a killing blow floors it, and its fall blasts a stagger around it). Held EQUAL to the web frame by frame by
# scripts/conformance.mjs --engine godot --corpus combat. Since 0.26.0 the minds fight here too (kernel/mind.gd decides; its trigger,
# blade and charge are this file's), and a thrusting body holds a semi or lob shot as the web's does. What stays on
# the web: the combo's stun, scaling and juggle, the clash and the other set pieces, boost armor, the hero's other
# loadout slots. A hit
# counts on the body (`hits`), and kernel/cast.gd tells the bus (hit:<id>).
#
#   var K = preload("res://kernel/combat.gd").new()
#   K.arm(cast_state, combat)            bus.json's `combat`: the hittable bodies take their fields, the hero its arms
#   K.step(cast_state, hero, input, dt, grounded)
#                                        input: { fire, forward, strafe, turn }; one frame in the web engine's order

const Bus := preload("res://kernel/bus.gd")
const MindScript := preload("res://kernel/mind.gd")
const GroupScript := preload("res://kernel/group.gd")
const Js := preload("res://kernel/js.gd")
var strike = null
var look := false
var colliders = null
var projectiles := []


func arm(st: Dictionary, combat: Dictionary) -> void:
	strike = combat.get("strike") if combat.get("strike") is Dictionary else null
	look = Js.truthy(combat.get("look"))
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
		e["noDestroy"] = Js.truthy(b.get("noDestroy"))


static func _sub(a: Array, b: Array) -> Array:
	return [float(a[0]) - float(b[0]), float(a[1]) - float(b[1]), float(a[2]) - float(b[2])]


static func _lerp3(a: Array, b: Array, t: float) -> Array:
	return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]


# JS `x || d` for a number: 0, null and NaN fall through
static func _or(v, d: float) -> float:
	return float(v) if Js.finite(v) and float(v) != 0.0 else d


func _sight_blocked(a: Array, b: Array) -> bool:
	return Js.sight_blocked(a, b, colliders)


func _nearest_wall_t(a: Array, b: Array):
	if colliders == null:
		return null
	var best = null
	for c in colliders:
		var t = Js.seg_aabb_t(a, b, c["min"], c["max"])
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
	var cz := a if _flat(tg) else (float(egg["cz"]) if Js.finite(egg.get("cz")) else cc)
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
	var cz := a if _flat(tg) else (float(egg["cz"]) if Js.finite(egg.get("cz")) else float(egg["c"]))
	var ez := _egg_axis(tg)
	var p: Array = tg["pos"]
	var u := [pt[0] - float(p[0]), pt[1] - float(p[1]), pt[2] - (float(p[2]) + cz)]
	var par: float = u[0] * ez[0] + u[1] * ez[1] + u[2] * ez[2]
	var perp2 := maxf(0.0, (u[0] * u[0] + u[1] * u[1] + u[2] * u[2]) - par * par)
	return perp2 / (a * a) + (par * par) / (cc * cc) <= 1.0


# a frontal shield eats a hit whose source lies in its arc; breaking it staggers the body
static func _shield_covers(tg: Dictionary, src: Array) -> bool:
	if _or(tg.get("shieldHp"), 0.0) == 0.0 or Js.truthy(tg.get("shieldBroken")):
		return false
	var front := Js.fwd_xy(float(tg["heading"]))
	var ix: float = src[0] - float(tg["pos"][0])
	var iy: float = src[1] - float(tg["pos"][1])
	var m := Js.hypot2(ix, iy)
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
	if not Js.finite(tg.get("poise")):
		return
	var dead := Js.finite(tg.get("hp")) and float(tg["hp"]) <= 0.0
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
		if Js.truthy(tg.get("noDestroy")) and Js.finite(tg.get("hpMax")):
			tg["hp"] = float(tg["hpMax"])
		else:
			tg["downed"] = true


# one frame of a poise-bearing body's reaction; true while it reels (its rule and arms wait)
static func step_reaction(e: Dictionary, dt: float) -> bool:
	if not Js.finite(e.get("poise")):
		return false
	if _or(e.get("wakeGuardT"), 0.0) > 0.0:
		e["wakeGuardT"] = maxf(0.0, float(e["wakeGuardT"]) - dt)
		e["invincible"] = float(e["wakeGuardT"]) > 0.0
	if e["staggerT"] == null:
		if float(e["poise"]) < float(e["poiseMax"]):
			e["poise"] = minf(float(e["poiseMax"]), float(e["poise"]) + _or(e.get("poiseRegen"), 0.0) * dt)
		return false
	var hold := float(e["downPause"]) if Js.finite(e.get("downPause")) else 2.0
	if e["reactClip"] == "topple" and e["downPauseT"] != null:
		e["downPauseT"] = float(e["downPauseT"]) + dt
		if float(e["downPauseT"]) >= hold:
			e["reactClip"] = "getup"
			e["reactDur"] = _or(e.get("getupDur"), _or(e.get("staggerDur"), 1.3) * 1.4)
			e["staggerT"] = 0.0
			e["downPauseT"] = null
			e["locomotion"] = "getup"
			e["moving"] = true
			e["gaitPhase"] = 0.0
			e["invincible"] = true
			return true
		e["staggerT"] = 1.0
		e["locomotion"] = "topple"
		e["moving"] = true
		e["gaitPhase"] = 1.0
		e["invincible"] = false
		return true
	e["staggerT"] = float(e["staggerT"]) + dt / _or(e.get("reactDur"), _or(e.get("staggerDur"), 1.3))
	if float(e["staggerT"]) >= 1.0:
		if e["reactClip"] == "topple":
			if not Js.truthy(e.get("downed")):
				e["downPauseT"] = 0.0
			e["staggerT"] = 1.0
			e["locomotion"] = "topple"
			e["moving"] = true
			e["gaitPhase"] = 1.0
			e["invincible"] = false
			return true
		var rose: bool = e["reactClip"] == "getup"
		e["staggerT"] = null
		e["downPauseT"] = null
		# back on its feet: the recovery EDGE a mind consumes (it rolls out on it), its clip the one it returns to
		e["locomotion"] = e["staggerReturn"] if Js.truthy(e.get("staggerReturn")) else "forward"
		e["reactionEnded"] = true
		if rose and _or(e.get("wakeGuard"), 0.0) > 0.0:
			e["wakeGuardT"] = float(e["wakeGuard"])
			e["invincible"] = true
		else:
			e["invincible"] = false
		return false
	e["locomotion"] = e["reactClip"]
	e["moving"] = true
	e["gaitPhase"] = e["staggerT"]
	e["invincible"] = e["reactClip"] == "getup"
	return true


# a hit's count and who dealt it, and its damage
static func _hit(tg: Dictionary, by: String) -> void:
	tg["hits"] = int(tg.get("hits", 0)) + 1
	tg["lastHitBy"] = by


# what a round dealt, for the cast's hit fact (dmg, harm, head): the count it was dealt at, so a later swing's hit
# carries none (combat-ranged.js; no headshot or falloff here: WEAPON_LOST)
static func _dealt(tg: Dictionary, dmg: float) -> void:
	tg["lastHitDmg"] = dmg
	tg["lastHitHead"] = false
	tg["lastHitDmgN"] = tg["hits"]


static func _hurt(tg: Dictionary, dmg: float) -> void:
	if Js.finite(tg.get("hp")):
		tg["hp"] = maxf(0.0, float(tg["hp"]) - dmg)


static func _hittable(tg: Dictionary) -> bool:
	return not Js.truthy(tg.get("invincible")) and Js.truthy(tg.get("hittable"))


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
		var d := Js.hypot3(v[0], v[1], v[2])
		if d < 1e-3 or d > float(P["reach"]) + lat_r(tg):
			continue
		var flat := Js.hypot2(v[0], v[1])
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
			if Js.finite(tg.get("poise")) and tg["staggerT"] == null:
				arm_reaction(tg, "stagger")
			continue
		if c["kind"] == "clash":
			break
		e["meleeHitCount"] = int(e.get("meleeHitCount", 0)) + 1
		_hit(tg, e["id"])
		_hurt(tg, float(P["damage"]))
		var topples: bool = (Js.truthy(P["topple"]) if P.get("topple") != null else e.get("swingClip") == "swing_back") and (Js.truthy(e.get("swingCombo")) if Js.truthy(P.get("combo")) else true)
		arm_reaction(tg, "topple" if topples else "stagger", topples)


# the platform strike: a fire press swings (the held direction picks the cut), the swing runs over dur, its end arms
# the cooldown, and on a combo slot the opener opens a window for one follow-up in another direction
func strike_step(e: Dictionary, input: Dictionary, dt: float, grounded: bool) -> void:
	if strike == null:
		return
	var fire := Js.truthy(input.get("fire"))
	var edge := fire and not Js.truthy(e.get("strikePrev"))
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
		# attacking spends any protection (the web's combat-melee.js)
		MindScript.break_guards(e)
		e["swingCombo"] = combo_click
		e["comboT"] = 0.0
		e["swingCount"] = int(e.get("swingCount", 0)) + 1
		e["struckThisSwing"] = {}
		e["strikeParams"] = spec["params"]
		e["lastSwingDir"] = dir
	elif e.get("swingT") != null:
		var was_combo := Js.truthy(e.get("swingCombo"))
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
		if Js.truthy(w["energyLock"]) and w.get("energyOverheatRegen") != null:
			rr = float(w["energyOverheatRegen"])
		if rr > 0.0:
			w["energy"] = minf(float(w["energyMax"]), (float(w["energy"]) if w.get("energy") != null else float(w["energyMax"])) + rr * dt)
		if Js.truthy(w["energyLock"]) and float(w["energy"]) >= float(w["energyMax"]) * maxf(0.0, minf(1.0, float(w["energyUnlockFrac"]))):
			w["energy"] = minf(float(w["energyMax"]), float(w["energy"]))
			w["energyLock"] = false
	if float(w["ammo"]) <= 0.0 and not Js.truthy(w["reloading"]) and not dry(w):
		w["reloading"] = true
		w["reloadT"] = float(w["reload"])
		w["burstLeft"] = 0
	if Js.truthy(w["reloading"]):
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
	if not Js.truthy(w.get("charging")):
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
	var fire_held := Js.truthy(input.get("fire"))
	if Js.truthy(w["reloading"]) or (float(w["energyMax"]) > 0.0 and Js.truthy(w["energyLock"])) or float(e.get("readyT", 0.0)) > 0.0:
		_cancel_charge(w)
		w["prevFire"] = fire_held
		return
	var edge := fire_held and not Js.truthy(w["prevFire"])
	var release := not fire_held and Js.truthy(w["prevFire"])
	var energy_ready := not (float(w["energyMax"]) > 0.0) or float(w["energy"]) > 0.0
	# NO FIRE WHILE BOOSTING (since 0.26.0, a mind's boost juke): a thrusting body cannot line up a semi or lob shot; an
	# auto weapon keeps streaming (`boostFire` overrides the class), and a charge keeps flowing through the thrust
	var can_boost_fire: bool = Js.truthy(w["boostFire"]) if w.get("boostFire") != null else Js.truthy(w["auto"])
	if Js.truthy(e.get("boosting")) and not can_boost_fire:
		var charge_flow: bool = float(w["chargeTime"]) > 0.0 and not Js.truthy(w["auto"]) and ((Js.truthy(w["charging"]) and fire_held) \
				or (edge and float(w["cooldownT"]) <= 0.0 and float(w["burstLeft"]) <= 0.0 and float(w["ammo"]) > 0.0 and energy_ready) \
				or (Js.truthy(w["charging"]) and release and Js.truthy(w["chargeReady"])))
		if not charge_flow:
			_cancel_charge(w)
			w["prevFire"] = fire_held
			return
	var forced := false
	var charged := false
	if float(w["chargeTime"]) > 0.0 and not Js.truthy(w["auto"]):
		var ready_pull: bool = float(w["cooldownT"]) <= 0.0 and float(w["burstLeft"]) <= 0.0 and float(w["ammo"]) > 0.0 and energy_ready
		if Js.truthy(w["charging"]) and fire_held:
			w["chargeT"] = minf(float(w["chargeTime"]), _or(w.get("chargeT"), 0.0) + dt)
			w["chargeFrac"] = maxf(0.0, minf(1.0, float(w["chargeT"]) / float(w["chargeTime"])))
			w["chargeReady"] = float(w["chargeFrac"]) >= 1.0
			w["prevFire"] = true
			return
		if Js.truthy(w["charging"]) and release:
			charged = Js.truthy(w["chargeReady"])
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
	# OVERDRIVE (a status, the cast's `status { is: 'overdrive' }`): its rounds hit 1.5 times as hard
	var damage: float = (_nn(w, "chargedDamage", _nn(w, "damage", 0.0)) if charged else _or(w.get("damage"), 0.0)) * (1.5 if e.get("statuses") is Dictionary and (e["statuses"] as Dictionary).has("overdrive") else 1.0)
	if not Js.truthy(w["auto"]) and not forced and edge and float(w["cooldownT"]) <= 0.0 and float(w["burstLeft"]) <= 0.0 and float(w["ammo"]) > 0.0:
		w["burstLeft"] = w["burst"]
	var want: bool = energy_ready and float(w["ammo"]) > 0.0 and float(w["cooldownT"]) <= 0.0 and (forced or (fire_held if Js.truthy(w["auto"]) else float(w["burstLeft"]) > 0.0))
	if want:
		_shoot(e, w, st, charged, forced, impact, shot_range, damage)
	if float(w["ammo"]) <= 0.0 and not Js.truthy(w["reloading"]) and not dry(w):
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
	# a round leaving spends any protection (the web's combat-ranged.js)
	MindScript.break_guards(e)
	if not Js.truthy(w["auto"]) and not forced:
		w["burstLeft"] = float(w["burstLeft"]) - 1.0
	if Js.truthy(w["auto"]):
		w["cooldownT"] = 1.0 / _or(w.get("rof"), 10.0)
	else:
		w["cooldownT"] = 1.0 / _or(w.get("burstRof"), 8.0) if float(w["burstLeft"]) > 0.0 else _or(w.get("cooldown"), 0.5)
	var p: Array = e["pos"]
	var h := float(e["heading"])
	var pitch := _or(e.get("pitch"), 0.0)
	var origin := [float(p[0]), float(p[1]), float(p[2]) + float(w["eye"])]
	var aim := Js.fwd3(h, pitch)
	var mo = w.get("muzzleOffset")
	var hf := Js.fwd_xy(h)
	var hr := Js.right_xy(h)
	var from: Array = origin.duplicate()
	if mo is Dictionary:
		var r_mul := -1.0 if Js.truthy(w.get("muzzleAlt")) and int(w["shots"]) % 2 == 0 else 1.0
		var mf := _or(mo.get("f"), 0.0)
		var mr := _or(mo.get("r"), 0.0)
		from = [float(p[0]) + hf[0] * mf + hr[0] * mr * r_mul, float(p[1]) + hf[1] * mf + hr[1] * mr * r_mul, float(p[2]) + _nn(mo, "u", float(w["eye"]))]
	# the shot as the web keeps it (combat-ranged.js e.lastShot): when and from where, which a match player hears
	e["lastShot"] = {"t": mind_clock if mind_clock >= 0.0 else float(st.get("time", 0.0)), "from": from.duplicate()}
	if w["fireClass"] == "lob":
		var dir := Js.fwd3(h, pitch + _or(w.get("lobAngle"), 0.0) * PI / 180.0)
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
		var d := Js.hypot3(v[0], v[1], v[2])
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
		# COVER: a box on the muzzle → target sightline eats the shot. An egg is traced to where the ray enters it (a head
		# over a low wall is hit; the legs behind it are not); a legacy sphere to its centre (combat-ranged.js)
		var hit_at: Array = [origin[0] + aim[0] * hd, origin[1] + aim[1] * hd, origin[2] + aim[2] * hd] if tg.get("egg") is Dictionary and mode == "core" else tg["pos"]
		if mode != null and _sight_blocked(from, hit_at):
			mode = null
		if mode != null and (best == null or hd < best["d"]):
			best = {"d": hd, "tg": tg}
	if friend != null and (best == null or friend["d"] <= best["d"]) and impact > 0.0 and Js.finite(friend["tg"].get("poise")) and friend["tg"]["staggerT"] == null:
		friend["tg"]["poise"] = float(friend["tg"]["poise"]) - impact
		if float(friend["tg"]["poise"]) <= 0.0:
			arm_reaction(friend["tg"], "stagger")
	if best == null:
		return
	var tg: Dictionary = best["tg"]
	_hit(tg, e["id"])
	_dealt(tg, damage)
	if _absorb_shield(tg, origin, damage):
		return
	_hurt(tg, damage)
	if Js.finite(tg.get("poise")) and tg["staggerT"] == null and impact > 0.0:
		tg["poise"] = float(tg["poise"]) - impact
		if float(tg["poise"]) <= 0.0:
			arm_reaction(tg, "stagger")
	if Js.finite(tg.get("hp")) and float(tg["hp"]) <= 0.0:
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
			var seg := Js.hypot3(p["pos"][0] - prev[0], p["pos"][1] - prev[1], p["pos"][2] - prev[2])
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
						hit = Js.hypot3(v[0], v[1], v[2]) <= _or(tg.get("radius"), 0.5) + det
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
			if Js.hypot3(v[0], v[1], v[2]) > R + _or(tg.get("radius"), 0.5):
				continue
		if owner_team is String and tg.get("team") is String and tg["team"] == owner_team:
			if Js.finite(tg.get("poise")) and tg["staggerT"] == null:
				arm_reaction(tg, "stagger")
			continue
		_hit(tg, p["owner"])
		_dealt(tg, float(p["damage"]) if Js.truthy(p.get("damage")) else 0.0)
		if _absorb_shield(tg, p["pos"], float(p["damage"])):
			continue
		_hurt(tg, float(p["damage"]))
		if Js.finite(tg.get("hp")) and float(tg["hp"]) <= 0.0:
			arm_reaction(tg, "stagger")
		elif float(p["impact"]) > 0.0:
			if Js.finite(tg.get("poise")) and tg["staggerT"] == null:
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
		if Js.truthy(e.get("gone")) or not Js.truthy(e.get("downed")) or Js.truthy(e.get("deathBurstDone")):
			continue
		e["deathBurstDone"] = true
		var egg = e.get("egg")
		var hgt := 24.0
		if egg is Dictionary:
			hgt = (float(egg["cz"]) if Js.finite(egg.get("cz")) else float(egg["c"])) + float(egg["c"])
		var R: float = floor(hgt * 0.54 * 10.0 + 0.5) / 10.0
		var cz := hgt * 0.5
		if egg is Dictionary:
			cz = float(egg["cz"]) if Js.finite(egg.get("cz")) else float(egg["c"])
		var pos := [float(e["pos"][0]), float(e["pos"][1]), float(e["pos"][2]) + cz]
		for tg in st["entities"]:
			if is_same(tg, e) or Js.truthy(tg.get("downed")) or not _hittable(tg):
				continue
			if tg.get("egg") is Dictionary:
				if not point_in_egg(pos, tg, R):
					continue
			else:
				var v := _sub(tg["pos"], pos)
				if Js.hypot3(v[0], v[1], v[2]) > R + _or(tg.get("radius"), 0.5):
					continue
			if _absorb_shield(tg, pos, 0.0):
				continue
			arm_reaction(tg, "stagger")


# ── one frame, in the web engine's order: per body its timers, its reaction, its rule and its arms; then the rounds ──
# `pose` ({ pos, heading, pitch }, optional): where the pilot's own rule leaves it this frame, set when the loop reaches
# it (the web steps the pilot in its turn, after the frame's pre-steps: a group reads where it stood); absent, the
# caller has placed it already. `part`: "all" (one frame), or the frame in two halves around the pilot's own step,
# which the web takes in its turn before the minds after it: "hero" (the pre-steps, the pilot and the bodies), then
# "minds" (the minds, the rounds in flight and the falls), the pilot placed where its step left it in between.
var _frame_world = null


func step(st: Dictionary, hero, input: Dictionary, dt: float, grounded: bool, pose = null, part := "all") -> void:
	if part != "minds":
		# the minds' world switch (the web's ai-toggle pre-step: the G press flips it), then their frame's world
		if mind != null and Js.truthy(input.get("aiToggle")):
			mind_off = not mind_off
		_frame_world = mind_world(st, hero) if mind != null else null
		# the groups give their members slots before the bodies step (the web's `groups` pre-step)
		if _frame_world != null:
			groups.step(st, dt, mind, _frame_world)
	var world = _frame_world
	for e in st["entities"]:
		var me := hero != null and is_same(e, hero)
		if world != null and mind_ids.has(e["id"]):
			if part != "hero":
				_step_mind(st, e, dt, world)
			continue
		if part == "minds":
			continue
		if me and pose is Dictionary:
			e["pos"] = (pose["pos"] as Array).duplicate()
			e["heading"] = float(pose["heading"])
			e["pitch"] = float(pose["pitch"])
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
	if part == "hero":
		return
	step_projectiles(st, dt)
	_death_bursts(st)


# ── THE MINDS (since 0.26.0): bodies on the web's `ai` rule decide in kernel/mind.gd and fight with this file's trigger
# and blade, in the web engine's order for each body: its timers (its weapons and cooldowns), its owners (asleep, or
# reacting: the rule and the weapon wait), the rule, then its trigger (its own, never the pilot's) and its blade.
# bus.json's `minds` (mind-score.js): each body's rule, the minds' weapons and loadouts, where each was placed, the
# world's tier and switch, the food a forager grazes. What stays on the web: a clash of blades, the shove-down set
# piece a counter-charge on the pilot plays there, and the commander.
var mind = null
var groups = null
var mind_ids := {}
var mind_off := false
var mind_tier = null
var mind_order: Array = []
# the ground a mind stands on (the web's hooks.ground): level.gd hands it the land; flat at 0 without one
var ground_fn: Callable = func(_p): return 0.0
# the clock a mind decides by (level.gd sets it to the frame's start, before the cast's clock moves); < 0: the cast's
var mind_clock := -1.0


func arm_minds(st: Dictionary, minds: Dictionary) -> void:
	mind = MindScript.new()
	groups = GroupScript.new()
	mind_ids = {}
	mind_off = Js.truthy(minds.get("off"))
	mind_tier = minds.get("tier") if minds.get("tier") is Dictionary else null
	# the walls a mind sees past and paths round (the fight's own, when it has them)
	if colliders == null and minds.get("colliders") is Array:
		colliders = minds["colliders"]
	var rules: Dictionary = minds.get("rules", {}) if minds.get("rules") is Dictionary else {}
	for e in st["entities"]:
		if rules.get(e["id"]) is Dictionary:
			e["rule"] = (rules[e["id"]] as Dictionary).duplicate(true)
		if not e.has("pitch"):
			e["pitch"] = 0.0
	var ms: Dictionary = minds.get("minds", {}) if minds.get("minds") is Dictionary else {}
	for id in ms:
		var e = st["byId"].get(String(id))
		if e == null:
			continue
		var m: Dictionary = ms[id]
		e["spawn"] = (m.get("spawn", {"pos": e["pos"]}) as Dictionary).duplicate(true)
		if m.get("loadoutWeapons") is Array:
			e["loadoutWeapons"] = (m["loadoutWeapons"] as Array).duplicate(true)
			e["loadoutIdx"] = int(m.get("loadoutIdx", 0))
			e["weapon"] = e["loadoutWeapons"][e["loadoutIdx"]]
		elif m.get("weapon") is Dictionary:
			e["weapon"] = (m["weapon"] as Dictionary).duplicate(true)
		if m.get("pilotRule") is Dictionary:
			e["pilotRule"] = (m["pilotRule"] as Dictionary).duplicate(true)
		if m.get("team") is String:
			e["team"] = m["team"]
		e["locomotion"] = "forward"
		e["moving"] = false
		e["gaitPhase"] = 0.0
		e["aiFire"] = 0
		mind_ids[String(id)] = true
	for id in minds.get("food", []):
		if st["byId"].has(String(id)):
			st["byId"][String(id)]["food"] = true
	mind_order = MindScript.id_order(st["entities"])


# the world a mind decides in this frame (the web builds it afresh each step: its path grids live one frame)
func mind_world(st: Dictionary, hero) -> Dictionary:
	return {"byId": st["byId"], "order": mind_order, "colliders": colliders, "pilotId": hero["id"] if hero != null else null,
		"aiEnabled": not mind_off, "aiTuning": mind_tier, "time": mind_clock if mind_clock >= 0.0 else float(st["time"]), "ground": ground_fn, "navCache": {}}


func _step_mind(st: Dictionary, e: Dictionary, dt: float, world: Dictionary) -> void:
	# timers: every carried weapon, the swing, roll and charge cooldowns, the switch ready-time
	if e.get("loadoutWeapons") is Array:
		for lw in e["loadoutWeapons"]:
			if lw is Dictionary:
				tick_weapon(lw, dt)
	elif e.get("weapon") is Dictionary:
		tick_weapon(e["weapon"], dt)
	if e.get("swingT") == null and _or(e.get("strikeCdT"), 0.0) > 0.0:
		e["strikeCdT"] = maxf(0.0, float(e["strikeCdT"]) - dt)
	if e.get("dodgeT") == null and _or(e.get("dodgeCdT"), 0.0) > 0.0:
		e["dodgeCdT"] = maxf(0.0, float(e["dodgeCdT"]) - dt)
	if e.get("tackleT") == null and _or(e.get("tackleCdT"), 0.0) > 0.0:
		e["tackleCdT"] = maxf(0.0, float(e["tackleCdT"]) - dt)
	if _or(e.get("readyT"), 0.0) > 0.0:
		e["readyT"] = maxf(0.0, float(e["readyT"]) - dt)
	# owners: asleep (the cast's dormant), the reaction, the cast (a route it walks, a spot it holds, felled by a cue)
	var owned := Js.truthy(e.get("dormant"))
	owned = step_reaction(e, dt) or owned
	owned = owned or Js.truthy(e.get("castDown")) or e.get("route") != null or Js.truthy(e.get("held"))
	if owned and e.get("weapon") is Dictionary:
		_cancel_charge(e["weapon"])
	if owned:
		return
	mind.ai(e, dt, world)
	if e.get("weapon") is Dictionary:
		step_weapon(e, {"fire": 1 if Js.truthy(e.get("aiFire")) else 0}, dt, st)
	if e.get("swingT") != null:
		step_melee(e, st["entities"])
	if e.get("tackleT") != null:
		step_tackle(e, st)


# A CHARGE (combat-melee.js stepTackle): a body checking down its line rams the first hittable body in front within
# reach, once, and stops on it: an ally only reels; one caught mid-swing is STUFFED (the counter: it topples, its swing
# spent, and the charger's gauge is refilled), which the web plays as the shove-down set piece when the pilot is in it
# and a camera watches (that stays the web's: here it is the plain counter); anything else takes the charge's damage and
# reels.
func step_tackle(e: Dictionary, st: Dictionary) -> void:
	var r: Dictionary = e["rule"]
	var reach: float = float(r["tackleReach"]) if r.get("tackleReach") != null else 8.0
	var dmg: float = float(r["tackleDamage"]) if r.get("tackleDamage") != null else 15.0
	var cos_cone := cos((float(r["tackleCone"]) if r.get("tackleCone") != null else 70.0) * PI / 180.0)
	var aim := Js.fwd_xy(float(e["heading"]))
	var p: Array = e["pos"]
	var origin := [float(p[0]), float(p[1]), float(p[2]) + (float(r["eye"]) if r.get("eye") != null else 0.0)]
	if not (e.get("tackleHits") is Dictionary):
		e["tackleHits"] = {}
	for tg in st["entities"]:
		if is_same(tg, e) or Js.truthy(tg.get("invincible")) or not _hittable(tg):
			continue
		if e["tackleHits"].has(tg["id"]):
			continue
		var v := _sub(tg["pos"], origin)
		var d := Js.hypot3(v[0], v[1], v[2])
		if d < 1e-3 or d > reach + lat_r(tg):
			continue
		var flat := Js.hypot2(v[0], v[1])
		if flat == 0.0:
			flat = 1e-6
		if (v[0] * aim[0] + v[1] * aim[1]) / flat < cos_cone:
			continue
		e["tackleHits"][tg["id"]] = true
		if e.get("team") is String and tg.get("team") is String and tg["team"] == e["team"]:
			if Js.finite(tg.get("poise")) and tg["staggerT"] == null:
				arm_reaction(tg, "stagger")
			_end_tackle(e)
			return
		if tg.get("swingT") != null and tg.get("strikeParams") != null and tg.get("staggerT") == null:
			_tackle_counter(e, tg)
			_end_tackle(e)
			return
		e["tackleHitCount"] = int(e.get("tackleHitCount", 0)) + 1
		_hit(tg, e["id"])
		if Js.finite(tg.get("hp")):
			_hurt(tg, dmg)
		arm_reaction(tg, "stagger")
		_end_tackle(e)
		return


static func _end_tackle(e: Dictionary) -> void:
	e["tackleT"] = null
	e["tackleDir"] = null
	if e.get("cineT") == null:
		e["invincible"] = false


static func _tackle_counter(tackler: Dictionary, victim: Dictionary) -> void:
	arm_reaction(victim, "topple", true)
	victim["swingT"] = null
	victim["swingCombo"] = false
	victim["comboT"] = 0.0
	victim["struckThisSwing"] = {}
	_hit(victim, tackler["id"])
	var dmg: float = float(tackler["rule"]["counterDamage"]) if tackler.get("rule") is Dictionary and Js.finite(tackler["rule"].get("counterDamage")) else 0.0
	if dmg > 0.0 and Js.finite(victim.get("hp")):
		victim["hp"] = maxf(0.0, float(victim["hp"]) - dmg)
		if float(victim["hp"]) <= 0.0:
			if Js.truthy(victim.get("noDestroy")) and Js.finite(victim.get("hpMax")):
				victim["hp"] = float(victim["hpMax"])
			else:
				victim["downed"] = true
	var bm: float = float(tackler["rule"]["boostMax"]) if tackler.get("rule") is Dictionary and Js.finite(tackler["rule"].get("boostMax")) and float(tackler["rule"]["boostMax"]) > 0.0 else 0.0
	if bm > 0.0:
		tackler["boost"] = bm
		tackler["boostLock"] = false
	tackler["tackleCounterHit"] = int(tackler.get("tackleCounterHit", 0)) + 1
	var pv: Array = victim["pos"]
	var pt: Array = tackler["pos"]
	var ux: float = pv[0] - pt[0]
	var uy: float = pv[1] - pt[1]
	var ul := Js.hypot2(ux, uy)
	if ul == 0.0:
		ul = 1e-6
	victim["heading"] = atan2(-uy / ul, -ux / ul)
