extends RefCounted
# mojulo-godot kernel — THE MIND (since 0.26.0): what a non-player body decides, every frame, through the same rules
# the player's body plays by. A port of the web's mind (lib/graph/worlds/controllable/mind.js, the `ai` rule) over the
# kernel's cast entities (kernel/cast.gd, with kernel/combat.gd's fight fields: pos, heading, pitch, hp, hittable, egg,
# weapon), in the bus's frame (z-up, recipe units, radians). One frame, in the order the situations are met:
#   commitments  an in-flight roll, charge or swing owns the body and finishes
#   idle         the world switch is off, or nothing to target: stand down (by motivation: guard, escort, wander,
#                territorial, forage; a group member keeps its slot)
#   notice       pickTarget: the pilot, the nearest live body, or the nearest enemy; flee, sentry, cover, perception
#                (sight, memory and search), guard and escort posts, the territorial warning, pathing (kernel/nav.gd)
#   pressed      reflexes on edges: roll off the line after a stagger, roll back off a clash
#   strike       the counter (the opportunist's charge), the blade commit with its timeout and give-up, the trigger
#   engage       spacing by the tool in hand (rush · skirmish · siege), the juke, group slots, space
# then the detune: aim wobble after every decision. A world's tier (aiDifficulty) and a body's `rule.mind` tune it; a
# boss crosses health phases and adapts. Held EQUAL to the web frame by frame by scripts/conformance.mjs --engine godot --corpus mind
# (lib/graph/scene/mind-conformance.js; the cover law, worlds/controllable/cover.test.js, among its scenarios).
#
#   var M = preload("res://kernel/mind.gd").new()
#   M.ai(e, dt, world)          world: { byId, order, colliders, pilotId, aiEnabled, aiTuning, time, ground, navCache }
#   M.TIERS[aiDifficulty]       the world's tier

const Nav := preload("res://kernel/nav.gd")
const Rules := preload("res://kernel/rules.gd")
const Bus := preload("res://kernel/bus.gd")
const Js := preload("res://kernel/js.gd")
const TAU_ := TAU

# ── TUNING (mind.js MIND_SKILL / MIND_AGGRESSIVENESS / AI_DIFFICULTY) ───────────────────────────────────────────────
const MIND_SKILL := {
	"novice": {"aimWobble": 0.09, "wobbleHz": 1.7, "reactDelay": 1.2, "burstMul": 0.5, "pauseMul": 2.2},
	"regular": {"aimWobble": 0.04, "wobbleHz": 1.4, "reactDelay": 0.55, "burstMul": 0.75, "pauseMul": 1.5},
	"veteran": {"aimWobble": 0.02, "wobbleHz": 1.2, "reactDelay": 0.25, "burstMul": 0.9, "pauseMul": 1.2},
	"ace": {"aimWobble": 0.0, "wobbleHz": 0.0, "reactDelay": 0.0, "burstMul": 1.0, "pauseMul": 1.0},
}
const MIND_AGGRESSIVENESS := {
	"passive": null,
	"defensive": {"dodgeCdMul": 3.0, "standoffMul": 1.3, "closeMul": 0.55, "boostBurstMul": 0.5, "boostRestMul": 1.8, "noTopple": true},
	"wary": {"dodgeCdMul": 3.0, "standoffMul": 1.3, "closeMul": 0.55, "boostBurstMul": 0.5, "boostRestMul": 1.8, "noTopple": true},
	"bold": {"dodgeCdMul": 1.6, "standoffMul": 1.12, "closeMul": 0.8, "boostBurstMul": 0.75, "boostRestMul": 1.3},
	"opportunist": {"dodgeCdMul": 1.0, "standoffMul": 1.0, "closeMul": 1.0, "boostBurstMul": 1.0, "boostRestMul": 1.0, "tackleGuard": true},
	"relentless": {"dodgeCdMul": 0.8, "standoffMul": 0.85, "closeMul": 1.2, "boostBurstMul": 1.2, "boostRestMul": 0.8},
}
const NEUTRAL_AGGRESSION := {"dodgeCdMul": 1.0, "standoffMul": 1.0, "closeMul": 1.0, "boostBurstMul": 1.0, "boostRestMul": 1.0}
const AGGR_KEYS := ["dodgeCdMul", "standoffMul", "closeMul", "boostBurstMul", "boostRestMul", "noTopple", "tackleGuard"]
const TEMPERS := ["passive", "defensive", "wary", "bold", "opportunist", "relentless"]
# SPACING by the tool in hand: [standoffMul, close, weave]
const SPACING := {"rush": [0.48, 1.0, 0.45], "skirmish": [1.0, 0.7, 1.0], "siege": [1.55, 0.6, 1.15]}
const SIDE_STRIKE_YAW := 0.6981317007977318   # combat-melee.js SIDE_STRIKE_YAW (40°)


static func _tier(skill: String, aggr: String) -> Dictionary:
	var t: Dictionary = (MIND_SKILL[skill] as Dictionary).duplicate()
	t.merge(MIND_AGGRESSIVENESS[aggr], true)
	return t


static func tiers() -> Dictionary:
	return {"easy": _tier("novice", "wary"), "medium": _tier("regular", "bold"), "max": _tier("ace", "opportunist")}


# ── JS idioms ───────────────────────────────────────────────────────────────────────────────────────────────────────
# `d.k ?? x`: the value when present and not null
static func nn(d, k: String, x):
	if d is Dictionary and d.get(k) != null:
		return d[k]
	return x


static func nf(d, k: String, x: float) -> float:
	return float(nn(d, k, x))


# `d.k || x` for a number
static func orf(d, k: String, x: float) -> float:
	var v = d.get(k) if d is Dictionary else null
	return float(v) if Js.truthy(v) and (v is float or v is int) else x


static func jmod(a: float, b: float) -> float:
	return fmod(a, b)


static func wrap_pi(x: float) -> float:
	return fmod(fmod(x + PI, TAU_) + TAU_, TAU_) - PI


# a body's ids in the web's `for (const id in world.byId)` order: integer keys ascending first, then the rest as placed
static func id_order(entities: Array) -> Array:
	var ints: Array = []
	var rest: Array = []
	for e in entities:
		var id := String(e["id"])
		if _index_key(id):
			ints.append(id)
		else:
			rest.append(id)
	ints.sort_custom(func(a, b): return int(a) < int(b))
	return ints + rest


static func _index_key(s: String) -> bool:
	if s == "" or s.length() > 10 or not s.is_valid_int():
		return false
	if s != str(int(s)) or int(s) < 0 or int(s) >= 4294967295:
		return false
	return true


# seeded per body (its id and a counter through an FNV-style hash): the same world wanders the same way every run
static func hash01(id: String, n: int) -> float:
	var s := id + ":" + str(n)
	var buf := s.to_utf16_buffer()
	var h := Js.s32(2166136261)
	for i in range(0, buf.size(), 2):
		h = Js.s32(h ^ (buf[i] | (buf[i + 1] << 8)))
		h = Js.imul(h, 16777619)
	h = Js.s32(h ^ ((h & 0xFFFFFFFF) >> 13))
	h = Js.imul(h, 0x5bd1e995)
	h = Js.s32(h ^ ((h & 0xFFFFFFFF) >> 15))
	return float(h & 0xFFFFFFFF) / 4294967296.0


# core.js resolveBlocking: push a cylinder (foot z, height, radius) out of every box its z band meets, the shallowest
# axis of the flat overlap, a box it can step onto skipped
static func resolve_blocking(pos: Array, foot: float, h: float, r: float, colliders, step: float) -> void:
	if not (colliders is Array):
		return
	Rules.resolve_blocking(pos, foot, h, r, colliders, step)


static func ground_at(world: Dictionary, p: Array):
	var g = world.get("ground")
	if g is Callable:
		return g.call(p)
	return null


# ── PHASES and ADAPTING (a duelist's ways of switching) ─────────────────────────────────────────────────────────────
static func phases_of(m) -> Array:
	if not (m is Dictionary):
		return []
	if m.get("phases") is Array:
		return m["phases"]
	if m.get("rank") != "boss":
		return []
	var at := maxi(TEMPERS.find(String(nn(m, "aggressiveness", "bold"))), 1)
	return [
		{"below": 2.0 / 3.0, "aggressiveness": TEMPERS[mini(at + 1, TEMPERS.size() - 1)], "shift": 1.0},
		{"below": 1.0 / 3.0, "aggressiveness": "relentless", "rule": {"meleeSeek": true}, "shift": 1.2},
	]


func tuning_of(e: Dictionary, world: Dictionary):
	var base = world.get("aiTuning")
	var m = e["rule"].get("mind")
	if not Js.truthy(m):
		return base
	var t: Dictionary = (MIND_SKILL["ace"] as Dictionary).duplicate()
	t.merge(NEUTRAL_AGGRESSION, true)
	if base is Dictionary:
		t.merge(base, true)
	_layer(t, m)
	var ph = phases_of(m)[e["mindPhase"]] if e.get("mindPhase") != null else null
	if ph is Dictionary:
		_layer(t, ph)
	return t


static func _layer(t: Dictionary, src: Dictionary) -> void:
	if Js.truthy(src.get("skill")) and MIND_SKILL.has(src["skill"]):
		t.merge(MIND_SKILL[src["skill"]], true)
	if Js.truthy(src.get("aggressiveness")) and MIND_AGGRESSIVENESS.has(src["aggressiveness"]):
		for k in AGGR_KEYS:
			t.erase(k)
		if MIND_AGGRESSIVENESS[src["aggressiveness"]] != null:
			t.merge(MIND_AGGRESSIVENESS[src["aggressiveness"]], true)
	if src.get("tune") is Dictionary:
		t.merge(src["tune"], true)


# stepPhase: cross every phase the health has fallen under (once per life), patch the rule, hold the SHIFT beat
func step_phase(e: Dictionary, r: Dictionary, dt: float) -> bool:
	if e.get("phaseShiftT") != null:
		e["phaseShiftT"] = float(e["phaseShiftT"]) - dt
		if float(e["phaseShiftT"]) > 0.0:
			e["moving"] = false
			e["invincible"] = true
			e["locomotion"] = "phase_shift"
			return true
		e["phaseShiftT"] = null
		e["locomotion"] = "forward"
		if e.get("cineT") == null:
			e["invincible"] = false
	var ps := phases_of(r.get("mind"))
	if ps.is_empty() or not (Js.finite(e.get("hpMax")) and float(e["hpMax"]) > 0.0) or not Js.finite(e.get("hp")) or Js.truthy(e.get("downed")):
		return false
	var frac := float(e["hp"]) / float(e["hpMax"])
	var next: int = int(e["mindPhase"]) + 1 if e.get("mindPhase") != null else 0
	var crossed := false
	while next < ps.size() and frac < float(ps[next]["below"]):
		e["mindPhase"] = next
		crossed = true
		if ps[next].get("rule") is Dictionary:
			r.merge(ps[next]["rule"], true)
		next += 1
	if crossed and nf(ps[e["mindPhase"]], "shift", 0.0) > 0.0:
		e["phaseShiftT"] = float(ps[e["mindPhase"]]["shift"])
		e["phaseShifts"] = int(nn(e, "phaseShifts", 0)) + 1
		e["aiFire"] = 0
		e["moving"] = false
		e["invincible"] = true
		e["locomotion"] = "phase_shift"
		return true
	return false


static func adapts(m) -> bool:
	return m is Dictionary and (m.get("adapt") == true or (m.get("rank") == "boss" and m.get("adapt") != false))


func step_adapt(e: Dictionary, r: Dictionary, dt: float, world: Dictionary) -> void:
	if not (e.get("adapt") is Dictionary):
		e["adapt"] = {"clock": 0.0, "melee": [0.0, 0.0], "ranged": [0.0, 0.0], "foeId": null, "foeHp": null, "hp": float(e["hp"]) if Js.finite(e.get("hp")) else 0.0, "benched": null, "benchT": 0.0, "log": []}
	var a: Dictionary = e["adapt"]
	var mode := "melee" if (e.get("swingT") != null or nf(e, "meleeCommitT", 0.0) > 0.0) else "ranged"
	if Js.finite(e.get("hp")):
		if float(e["hp"]) < float(a["hp"]):
			a[mode][1] += float(a["hp"]) - float(e["hp"])
		a["hp"] = float(e["hp"])
	var foe = world["byId"].get(a["foeId"]) if a["foeId"] != null else null
	if foe != null and Js.finite(foe.get("hp")) and a["foeHp"] != null and float(foe["hp"]) < float(a["foeHp"]):
		a[mode][0] += float(a["foeHp"]) - float(foe["hp"])
	a["foeHp"] = float(foe["hp"]) if foe != null and Js.finite(foe.get("hp")) else null
	if float(a["benchT"]) > 0.0:
		a["benchT"] = float(a["benchT"]) - dt
		if float(a["benchT"]) <= 0.0:
			a["benched"] = null
	a["clock"] = float(a["clock"]) + dt
	if float(a["clock"]) >= nf(r, "adaptEvery", 6.0):
		var margin := nf(r, "adaptMargin", 8.0)
		var nm: float = a["melee"][0] - a["melee"][1]
		var nr: float = a["ranged"][0] - a["ranged"][1]
		var loser = "melee" if nm < -margin and nm < nr else ("ranged" if nr < -margin and nr < nm else null)
		if loser != null:
			a["benched"] = loser
			a["benchT"] = nf(r, "adaptEvery", 6.0)
			a["log"].append(loser)
		a["clock"] = 0.0
		a["melee"] = [0.0, 0.0]
		a["ranged"] = [0.0, 0.0]


# ── STRIKE: the blade (combat-melee.js meleeSwingSpec, combat-hit.js breakGuards) ───────────────────────────────────
static func swing_spec(sc: Dictionary, r: Dictionary, dir: String, combo: bool) -> Dictionary:
	var verbs = sc.get("strikeVerbs")
	var sv: Dictionary = verbs[dir] if verbs is Dictionary and verbs.get(dir) is Dictionary else {}
	var contact = nn(sv, "strikeContact", nn(sc, "strikeContact", r.get("strikeContact")))
	var cone := float(nn(sv, "strikeCone", nn(sc, "strikeCone", nn(r, "strikeCone", 70))))
	var yaw: float
	if sv.get("strikeYaw") != null:
		yaw = float(sv["strikeYaw"]) * PI / 180.0
	else:
		yaw = SIDE_STRIKE_YAW if dir == "left" else (-SIDE_STRIKE_YAW if dir == "right" else 0.0)
	return {
		"clip": "%s_%s" % [String(sv["swingSet"]) if Js.truthy(sv.get("swingSet")) else (String(sc["swingSet"]) if Js.truthy(sc.get("swingSet")) else "swing"), dir],
		"params": {
			"reach": float(nn(sv, "strikeReach", nn(sc, "strikeReach", nn(r, "strikeReach", nn(r, "speed", 6))))),
			"damage": float(nn(sv, "strikeDamage", nn(sc, "strikeDamage", nn(r, "strikeDamage", 0)))),
			"impact": float(nn(sv, "strikeImpact", nn(sc, "strikeImpact", nn(r, "strikeImpact", 0)))),
			"launch": nn(sv, "strikeLaunch", nn(sc, "strikeLaunch", nn(r, "strikeLaunch", 0))),
			"eye": float(nn(sc, "strikeEye", nn(r, "eye", 0))),
			"cosCone": cos(cone * PI / 180.0),
			"combo": combo,
			"from": float(contact[0]) if contact is Array and contact.size() > 0 and contact[0] != null else 0.28,
			"to": float(contact[1]) if contact is Array and contact.size() > 1 and contact[1] != null else 0.62,
			"topple": sv.get("topple") == true or (sv.get("topple") != false and dir == "back"),
			"aimYaw": yaw,
			"fx": nn(sv, "strikeFx", nn(sc, "strikeFx", nn(r, "strikeFx", null))),
		},
	}


static func break_guards(e: Dictionary) -> void:
	if Js.truthy(e.get("spawnGuard")):
		e["spawnGuard"] = false
	if nf(e, "wakeGuardT", 0.0) > 0.0:
		e["wakeGuardT"] = 0.0
	if e.get("dodgeT") != null:
		e["dodgeSpent"] = true
	e["downPauseT"] = null
	e["invincible"] = false


func begin_swing_dir(e: Dictionary, sc: Dictionary, r: Dictionary, dir: String, is_combo: bool, no_topple: bool) -> void:
	var spec := swing_spec(sc, r, dir, is_combo)
	if is_combo:
		spec["params"]["topple"] = true
	if no_topple:
		spec["params"]["topple"] = false
	e["swingT"] = 0.0
	e["swingClip"] = spec["clip"]
	e["strikeParams"] = spec["params"]
	e["struckThisSwing"] = {}
	e["swingCount"] = int(nn(e, "swingCount", 0)) + 1
	e["swingCombo"] = is_combo
	e["lastSwingDir"] = dir
	e["swingDur"] = float(nn(sc, "strikeDur", nn(r, "strikeDur", 0.9)))
	e["swingCd"] = float(nn(sc, "strikeCooldown", nn(r, "strikeCooldown", 0)))
	var lunge = nn(sc, "strikeLunge", r.get("strikeLunge"))
	if Js.truthy(lunge):
		e["swingLunge"] = float(lunge)
	elif Js.truthy(e.get("swingLunge")):
		e["swingLunge"] = 0.0
	break_guards(e)


func begin_swing(e: Dictionary, sc: Dictionary, r: Dictionary, dif) -> void:
	var no_topple: bool = dif is Dictionary and Js.truthy(dif.get("noTopple"))
	if r.get("meleeCombo") != false or no_topple:
		e["aiSwingAlt"] = int(nn(e, "aiSwingAlt", 0)) + 1
		var alt: int = e["aiSwingAlt"] % 3
		var opener := "neutral" if alt == 0 else ("left" if alt == 1 else "right")
		begin_swing_dir(e, sc, r, opener, false, no_topple)
		if no_topple:
			e["swingCd"] = maxf(orf(e, "swingCd", 0.0), float(nn(sc, "comboCooldown", nn(r, "comboCooldown", 2.5))))
			e["aiComboWant"] = false
			return
		e["aiComboWant"] = true
		e["aiComboCfg"] = sc
		e["aiComboRule"] = r
		e["aiComboCooldown"] = float(nn(sc, "comboCooldown", nn(r, "comboCooldown", 2.5)))
	else:
		begin_swing_dir(e, sc, r, "back", false, false)
		e["aiComboWant"] = false


# ── PRESSED: the roll ───────────────────────────────────────────────────────────────────────────────────────────────
static func dodge_exhaust(e: Dictionary, r: Dictionary) -> void:
	if nf(r, "dodgeBoostCost", 2.0) <= 0.0 or not Js.truthy(nn(r, "dodgeOverheat", true)):
		return
	var bm := nf(r, "boostMax", 0.0)
	var win := bm / nf(r, "overheatRegen", bm / 7.5) if bm > 0.0 else 7.5
	e["aiBoostRestT"] = nf(r, "dodgeExhaust", win)


func roll_off(e: Dictionary, r: Dictionary, dif, dir: Array, rt: Array) -> void:
	e["dodgeDir"] = dir
	var sd: float = dir[0] * rt[0] + dir[1] * rt[1]
	e["dodgeT"] = 0.0
	e["dodgeClip"] = "dodge_sideroll"
	e["dodgeKind"] = "side"
	e["dodgeSign"] = -1 if sd < 0.0 else 1
	e["dodgeSpent"] = false
	e["dodgeCdT"] = nf(r, "dodgeCooldown", 8.0) * (float(dif["dodgeCdMul"]) if dif is Dictionary else 1.0)
	e["dodgeCount"] = int(nn(e, "dodgeCount", 0)) + 1
	dodge_exhaust(e, r)


# ── NOTICE: who ─────────────────────────────────────────────────────────────────────────────────────────────────────
static func _hittable_body(o: Dictionary) -> bool:
	return Js.truthy(o.get("hittable"))


func pick_target(e: Dictionary, world: Dictionary, policy, skip = null):
	var target = null
	if policy == "all" or policy == "enemy":
		var team_aware: bool = policy == "enemy" and Js.truthy(e.get("team"))
		var bd := INF
		for id in world["order"]:
			var o: Dictionary = world["byId"][id]
			if is_same(o, e) or (skip != null and is_same(o, skip)) or Js.truthy(o.get("isCamera")) or Js.truthy(o.get("downed")) or Js.truthy(o.get("invincible")) or not _hittable_body(o):
				continue
			if team_aware and Js.truthy(o.get("team")) and o["team"] == e["team"]:
				continue
			var ddx: float = o["pos"][0] - e["pos"][0]
			var ddy: float = o["pos"][1] - e["pos"][1]
			var dd := ddx * ddx + ddy * ddy
			if dd < bd:
				bd = dd
				target = o
	elif world.get("pilotId") != null and world["byId"].has(world["pilotId"]) and not (skip != null and is_same(world["byId"][world["pilotId"]], skip)):
		target = world["byId"][world["pilotId"]]
	return target


func threat_of(e: Dictionary, world: Dictionary):
	var best = null
	if world.get("pilotId") != null and world["byId"].has(world["pilotId"]) and not is_same(world["byId"][world["pilotId"]], e):
		best = world["byId"][world["pilotId"]]
	var bd := Js.hypot2(best["pos"][0] - e["pos"][0], best["pos"][1] - e["pos"][1]) if best != null else INF
	for id in world["order"]:
		var o: Dictionary = world["byId"][id]
		if is_same(o, e) or Js.truthy(o.get("downed")) or not (o.get("rule") is Dictionary) or not (o["rule"].get("mind") is Dictionary) or o["rule"]["mind"].get("motivation") != "hunt":
			continue
		if Js.truthy(e.get("team")) and o.get("team") == e["team"]:
			continue
		var d := Js.hypot2(o["pos"][0] - e["pos"][0], o["pos"][1] - e["pos"][1])
		if d < bd:
			bd = d
			best = o
	return best


# ── shared moves ────────────────────────────────────────────────────────────────────────────────────────────────────
static func block(e: Dictionary, r: Dictionary, eye: float, world: Dictionary) -> void:
	resolve_blocking(e["pos"], float(e["pos"][2]) - eye, nf(r, "collideHeight", 24.0), nf(r, "collideRadius", 0.0), world.get("colliders"), nf(r, "step", 0.35))


static func stand_on_ground(e: Dictionary, r: Dictionary, eye: float, world: Dictionary) -> void:
	var g = ground_at(world, [e["pos"][0], e["pos"][1], (float(e["pos"][2]) - eye) + nf(r, "collideHeight", 24.0)])
	if g != null:
		e["pos"][2] = float(g) + eye


static func turn_toward(e: Dictionary, want: float, r: Dictionary, dt: float) -> float:
	var dh := wrap_pi(want - float(e["heading"]))
	var mt := nf(r, "turn", 1.8) * dt
	e["heading"] = float(e["heading"]) + clampf(dh, -mt, mt)
	return wrap_pi(want - float(e["heading"]))


static func next_juke(e: Dictionary, r: Dictionary, dt: float) -> int:
	var jp := nf(r, "jukePeriod", 0.9)
	e["aiJukeClock"] = orf(e, "aiJukeClock", 0.0) + dt
	if float(e["aiJukeClock"]) >= jp:
		e["aiJukeClock"] = 0.0
		e["aiJukeSide"] = -1 if int(nn(e, "aiJukeSide", 0)) == 1 else 1
	return int(e["aiJukeSide"]) if Js.truthy(e.get("aiJukeSide")) else 1


func walk_toward(e: Dictionary, r: Dictionary, want: float, dt: float, world: Dictionary, speed: float) -> float:
	var eye := nf(r, "eye", 0.0)
	var rem := turn_toward(e, want, r, dt)
	var stp := 0.0
	if absf(rem) < 1.1:
		var f := Js.fwd_xy(float(e["heading"]))
		stp = speed * dt
		e["pos"][0] += f[0] * stp
		e["pos"][1] += f[1] * stp
	if world.get("colliders") is Array:
		block(e, r, eye, world)
	stand_on_ground(e, r, eye, world)
	if stp > 0.0:
		e["locomotion"] = "forward"
		e["gaitPhase"] = orf(e, "gaitPhase", 0.0) + stp / nf(r, "stride", 2.4)
		e["moving"] = true
	else:
		e["moving"] = false
	return stp


# PATHING `navmesh`: with the grid line to the goal blocked, walk the path's next corner (replanned every `navReplan` s,
# or when the goal moves a cell); true while pathing owns the step
func nav_to(e: Dictionary, r: Dictionary, dt: float, world: Dictionary, goal: Array, speed: float) -> bool:
	if not (r.get("mind") is Dictionary and r["mind"].get("pathing") == "navmesh") or not (world.get("colliders") is Array):
		return false
	var eye := nf(r, "eye", 0.0)
	var opts := {"radius": orf(r, "collideRadius", 0.5), "height": nf(r, "collideHeight", 24.0), "footZ": float(e["pos"][2]) - eye, "step": nf(r, "step", 0.35)}
	if Js.finite(r.get("navCell")) and float(r["navCell"]) > 0.0:
		opts["cell"] = float(r["navCell"])
	if Nav.clear(world, e["pos"], goal, opts):
		e["navPath"] = null
		return false
	var cell: float
	if Js.truthy(opts.get("cell")):
		cell = float(opts["cell"])
	elif Js.truthy(world.get("navCell")):
		cell = float(world["navCell"])
	else:
		cell = maxf(1.0, float(opts["radius"]))
	e["navT"] = orf(e, "navT", 0.0) - dt
	var moved: bool = e.get("navGoal") == null or Js.hypot2(float(goal[0]) - e["navGoal"][0], float(goal[1]) - e["navGoal"][1]) > cell
	if e.get("navPath") == null or float(e["navT"]) <= 0.0 or moved:
		e["navPath"] = Nav.path(world, e["pos"], goal, opts)
		e["navGoal"] = [float(goal[0]), float(goal[1])]
		e["navT"] = nf(r, "navReplan", 0.5)
	var p = e["navPath"]
	if p == null or (p as Array).is_empty():
		return false
	var reach := maxf(float(opts["radius"]), float(opts["cell"]) * 0.6) if Js.truthy(opts.get("cell")) else maxf(1.0, float(opts["radius"]))
	while (p as Array).size() > 1 and Js.hypot2(p[0][0] - e["pos"][0], p[0][1] - e["pos"][1]) < reach:
		(p as Array).pop_front()
	var wp: Array = p[0]
	walk_toward(e, r, atan2(wp[1] - e["pos"][1], wp[0] - e["pos"][0]), dt, world, speed)
	e["aiFire"] = 0
	return true


# ── PERCEPTION ──────────────────────────────────────────────────────────────────────────────────────────────────────
static func eye_h(b: Dictionary) -> float:
	var rr = b.get("rule")
	var ch: float = float(rr["collideHeight"]) if rr is Dictionary and rr.get("collideHeight") != null else 24.0
	var ey: float = orf(rr, "eye", 0.0) if rr is Dictionary else 0.0
	return ch * 0.75 - ey


func perceive(e: Dictionary, r: Dictionary, target: Dictionary, world: Dictionary) -> bool:
	var q: Array = target["pos"]
	var now: float = world.get("time", 0.0)
	var dx: float = q[0] - e["pos"][0]
	var dy: float = q[1] - e["pos"][1]
	if Js.hypot2(dx, dy) > nf(r, "sightRange", 120.0):
		return false
	var ls = e.get("lastSeen")
	var recent: bool = ls is Dictionary and ls["id"] == target["id"] and now - float(ls["t"]) < 0.5
	if not recent:
		var off := atan2(dy, dx) - float(e["heading"])
		if absf(atan2(sin(off), cos(off))) > nf(r, "sightCone", 1.2):
			return false
	if world.get("colliders") is Array and Js.sight_blocked([e["pos"][0], e["pos"][1], float(e["pos"][2]) + eye_h(e)], [q[0], q[1], float(q[2]) + eye_h(target)], world["colliders"]):
		return false
	if not recent:
		e["sightings"] = int(nn(e, "sightings", 0)) + 1
		e["seenId"] = target["id"]
	e["lastSeen"] = {"pos": [float(q[0]), float(q[1]), float(q[2])], "t": now, "id": target["id"]}
	if e.get("searchT") != null and e.get("locomotion") == "search":
		e["locomotion"] = "forward"
	e["searchT"] = null
	return true


# COVER (opt-in `rule.cover`): hurt or reloading, break for the nearest spot within `radius` the colliders hide from the
# target's eye (its own eye, the top of its head, its flanks) and hold there facing the target, trigger cold
func take_cover(e: Dictionary, r: Dictionary, dt: float, world: Dictionary, target: Dictionary) -> bool:
	var cfg: Dictionary = {} if r["cover"] is bool else r["cover"]
	var now: float = world.get("time", 0.0)
	if int(nn(e, "hits", 0)) > int(nn(e, "coverHits", 0)):
		e["coverHits"] = e["hits"]
		e["coverUntil"] = now + nf(cfg, "hold", 2.5)
		e["lastSeen"] = {"pos": (target["pos"] as Array).duplicate(), "t": now, "id": target["id"]}
	var w = e.get("weapon")
	var fear: bool = (w is Dictionary and Js.truthy(w.get("reloading"))) or (e.get("coverUntil") != null and now < float(e["coverUntil"]))
	if not fear or not (world.get("colliders") is Array):
		e["coverAt"] = null
		return false
	var cs: Array = world["colliders"]
	var q: Array = target["pos"]
	var from := [q[0], q[1], float(q[2]) + eye_h(target)]
	var eye := nf(r, "eye", 0.0)
	var up := eye_h(e)
	var top := nf(r, "collideHeight", 24.0) - eye
	var flank := orf(r, "collideRadius", 0.5) + 0.2
	var hides := func(p: Array) -> bool:
		var ddx: float = p[0] - q[0]
		var ddy: float = p[1] - q[1]
		var dn := Js.hypot2(ddx, ddy)
		if dn == 0.0:
			dn = 1.0
		var sx := (-ddy / dn) * flank
		var sy := (ddx / dn) * flank
		for pt in [[p[0], p[1], up], [p[0], p[1], top], [p[0] + sx, p[1] + sy, up], [p[0] - sx, p[1] - sy, up]]:
			if not Js.sight_blocked(from, [pt[0], pt[1], float(p[2]) + pt[2]], cs):
				return false
		return true
	if e.get("coverAt") == null or not hides.call(e["coverAt"]):
		e["coverAt"] = null
		var R := nf(cfg, "radius", 8.0)
		var rad := orf(r, "collideRadius", 0.5) + 0.35
		var ring := 1
		while ring <= 4 and e["coverAt"] == null:
			var best = null
			var bd := INF
			for k in 12:
				var a := (float(k) * TAU_) / 12.0 + float(ring) * 0.26
				var d := (R * ring) / 4.0
				var x: float = e["pos"][0] + cos(a) * d
				var y: float = e["pos"][1] + sin(a) * d
				var g = ground_at(world, [x, y, float(e["pos"][2]) + 2.0])
				var p := [x, y, float(g) + eye if g != null else float(e["pos"][2])]
				var inside := false
				for c in cs:
					if x > float(c["min"][0]) - rad and x < float(c["max"][0]) + rad and y > float(c["min"][1]) - rad and y < float(c["max"][1]) + rad and float(c["max"][2]) > float(p[2]) - eye + 0.3:
						inside = true
						break
				if inside:
					continue
				if not hides.call(p):
					continue
				var dd := Js.hypot2(x - q[0], y - q[1])
				if dd < bd:
					bd = dd
					best = p
			e["coverAt"] = best
			ring += 1
	if e["coverAt"] == null:
		return false
	var c: Array = e["coverAt"]
	if Js.hypot2(c[0] - e["pos"][0], c[1] - e["pos"][1]) > 0.4:
		go_to(e, r, dt, world, c, nf(r, "speed", 6.0) * 1.2)
	else:
		e["moving"] = false
		turn_toward(e, atan2(q[1] - e["pos"][1], q[0] - e["pos"][0]), r, dt)
	e["aiFire"] = 0
	return true


# MEMORY: walk to the last-seen spot, then SEARCH there; past `memorySpan` or once the search is done, it forgets
func recall(e: Dictionary, r: Dictionary, dt: float, world: Dictionary) -> bool:
	var ls = e.get("lastSeen")
	var now: float = world.get("time", 0.0)
	if not (ls is Dictionary) or now - float(ls["t"]) > nf(r, "memorySpan", 8.0):
		e["lastSeen"] = null
		e["searchT"] = null
		return false
	var dx: float = ls["pos"][0] - e["pos"][0]
	var dy: float = ls["pos"][1] - e["pos"][1]
	e["aiFire"] = 0
	if e.get("searchT") == null and Js.hypot2(dx, dy) > maxf(1.5, orf(r, "collideRadius", 0.0)):
		if not nav_to(e, r, dt, world, ls["pos"], nf(r, "speed", 6.0)):
			walk_toward(e, r, atan2(dy, dx), dt, world, nf(r, "speed", 6.0))
		e["searchFrom"] = e["heading"]
		return true
	e["searchT"] = orf(e, "searchT", 0.0) + dt
	if float(e["searchT"]) > nf(r, "searchTime", 3.0):
		e["lastSeen"] = null
		e["searchT"] = null
		e["locomotion"] = "forward"
		return false
	turn_toward(e, nf(e, "searchFrom", float(e["heading"])) + sin(float(e["searchT"]) * 2.1) * 1.4, r, dt)
	e["moving"] = false
	e["locomotion"] = "search"
	return true


func ward_of(e: Dictionary, r: Dictionary, world: Dictionary):
	if Js.truthy(r.get("escort")) and world["byId"].has(r["escort"]):
		return world["byId"][r["escort"]]
	if Js.truthy(e.get("team")):
		var best = null
		var bd := INF
		for id in world["order"]:
			var o: Dictionary = world["byId"][id]
			if is_same(o, e) or Js.truthy(o.get("isCamera")) or o.get("team") != e["team"]:
				continue
			var d := Js.hypot2(o["pos"][0] - e["pos"][0], o["pos"][1] - e["pos"][1])
			if d < bd:
				bd = d
				best = o
		if best != null:
			return best
	var p = world["byId"].get(world["pilotId"]) if world.get("pilotId") != null else null
	return p if p != null and not is_same(p, e) else null


static func home_of(e: Dictionary, r: Dictionary) -> Array:
	if r.get("post") is Array:
		return r["post"]
	if not (e.get("home") is Array):
		e["home"] = ((e["spawn"]["pos"] if e.get("spawn") is Dictionary else e["pos"]) as Array).duplicate()
	return e["home"]


func post_of(e: Dictionary, r: Dictionary, world: Dictionary) -> Array:
	if r.get("mind") is Dictionary and r["mind"].get("motivation") == "escort":
		var w = ward_of(e, r, world)
		if w != null:
			return w["pos"]
	if r.get("post") is Array:
		return r["post"]
	return e["spawn"]["pos"] if e.get("spawn") is Dictionary else e["pos"]


func return_to_post(e: Dictionary, r: Dictionary, dt: float, world: Dictionary) -> void:
	var p := post_of(e, r, world)
	var dx: float = float(p[0]) - e["pos"][0]
	var dy: float = float(p[1]) - e["pos"][1]
	var arrive := nf(r, "followDist", 6.0) if r.get("mind") is Dictionary and r["mind"].get("motivation") == "escort" else nf(r, "arrive", 1.5)
	if Js.hypot2(dx, dy) <= arrive:
		e["moving"] = false
		if Js.finite(r.get("scan")) and float(r["scan"]) > 0.0:
			if e.get("scanFrom") == null:
				e["scanFrom"] = e["heading"]
			var now: float = world.get("time", 0.0)
			turn_toward(e, float(e["scanFrom"]) + sin((now * TAU_) / nf(r, "scanPeriod", 6.0)) * float(r["scan"]), r, dt)
		return
	if not nav_to(e, r, dt, world, p, nf(r, "speed", 6.0)):
		walk_toward(e, r, atan2(dy, dx), dt, world, nf(r, "speed", 6.0))


# ── IDLE MOTION ─────────────────────────────────────────────────────────────────────────────────────────────────────
func go_to(e: Dictionary, r: Dictionary, dt: float, world: Dictionary, goal: Array, speed: float) -> void:
	if not nav_to(e, r, dt, world, goal, speed):
		walk_toward(e, r, atan2(float(goal[1]) - e["pos"][1], float(goal[0]) - e["pos"][0]), dt, world, speed)


func wander_step(e: Dictionary, r: Dictionary, dt: float, world: Dictionary, o: Dictionary) -> void:
	var home := home_of(e, r)
	if nf(e, "wanderPauseT", 0.0) > 0.0:
		e["wanderPauseT"] = float(e["wanderPauseT"]) - dt
		e["moving"] = false
		if Js.truthy(o.get("pauseLoco")):
			e["locomotion"] = o["pauseLoco"] if float(e["wanderPauseT"]) > 0.0 else "forward"
		return
	if not (e.get("wanderGoal") is Array):
		e["wanderN"] = int(nn(e, "wanderN", 0)) + 1
		var n: int = e["wanderN"]
		var a := hash01(String(e["id"]), 2 * n) * TAU_
		var d := sqrt(hash01(String(e["id"]), 2 * n + 1)) * nf(r, "wanderRadius", 12.0)
		e["wanderGoal"] = [float(home[0]) + cos(a) * d, float(home[1]) + sin(a) * d, float(home[2]) if home.size() > 2 and Js.truthy(home[2]) else 0.0]
		e["wanderLegT"] = 0.0
	var g: Array = e["wanderGoal"]
	e["wanderLegT"] = float(e["wanderLegT"]) + dt
	if Js.hypot2(g[0] - e["pos"][0], g[1] - e["pos"][1]) < 1.0 or float(e["wanderLegT"]) > 20.0:
		e["wanderGoal"] = null
		var pz: Array = o["pause"]
		e["wanderPauseT"] = float(pz[0]) + hash01(String(e["id"]), -int(e["wanderN"])) * (float(pz[1]) - float(pz[0]))
		e["moving"] = false
		return
	go_to(e, r, dt, world, g, nf(r, "speed", 6.0) * float(o["speedMul"]))


func graze_step(e: Dictionary, r: Dictionary, dt: float, world: Dictionary) -> void:
	var now: float = world.get("time", 0.0)
	if nf(e, "grazeT", 0.0) > 0.0:
		e["grazeT"] = float(e["grazeT"]) - dt
		e["moving"] = false
		e["locomotion"] = "graze"
		if float(e["grazeT"]) <= 0.0:
			e["locomotion"] = "forward"
			if Js.truthy(e.get("grazeFood")):
				if not (e.get("grazed") is Dictionary):
					e["grazed"] = {}
				e["grazed"][e["grazeFood"]] = now
				e["grazeFood"] = null
		return
	var home := home_of(e, r)
	var food = null
	var bd := INF
	for id in world["order"]:
		var o: Dictionary = world["byId"][id]
		if is_same(o, e) or not Js.truthy(o.get("food")):
			continue
		if e.get("grazed") is Dictionary and e["grazed"].get(o["id"]) != null and now - float(e["grazed"][o["id"]]) < nf(r, "regrow", 30.0):
			continue
		var q: Array = o["pos"]
		if Js.hypot2(q[0] - float(home[0]), q[1] - float(home[1])) > nf(r, "forageRadius", 20.0):
			continue
		var d := Js.hypot2(q[0] - e["pos"][0], q[1] - e["pos"][1])
		if d < bd:
			bd = d
			food = o
	if food != null:
		if bd < 2.0:
			e["grazeT"] = nf(r, "grazeTime", 4.0)
			e["grazeFood"] = food["id"]
			e["moving"] = false
			e["locomotion"] = "graze"
			return
		go_to(e, r, dt, world, food["pos"], nf(r, "speed", 6.0) * 0.6)
		return
	wander_step(e, r, dt, world, {"speedMul": 0.35, "pause": [4.0, 7.0], "pauseLoco": "graze"})


# ── FRAG (`rule.mind.motivation: 'frag'`, mind.js, since 0.31.0): a match player. Everyone not on its team is its foe
# (`rule.target`, else 'enemy' on a team, 'all' without one). It fights whom it can SEE, never the nearest body behind a
# wall; seen, the one that shot it last (for `fragGrudge`, 3 s) and the one it already fights count closer. Seeing no
# one it never stands: an item it wants first (opt-in `rule.items`), then an objective to hold (`rule.objective`), then
# its freshest LEAD (the shooter that hit it, a shot heard within `hearRange` in the last half second, where it last saw
# a foe) for `leadSpan`; with none, a HUNCH: every `hunchEvery` s a rival its seeded dice pick. While it shoots it
# strafes on its juke clock (`strafe`). A perch for a long gun (`keepRange`, `perches`) and the peek stay the web's.
static func frag_policy(e: Dictionary, r: Dictionary):
	if r.get("target") != null:
		return r["target"]
	return "enemy" if Js.truthy(e.get("team")) else "all"


static func frag_foe(e: Dictionary, o: Dictionary, policy) -> bool:
	if is_same(o, e) or Js.truthy(o.get("isCamera")) or Js.truthy(o.get("downed")) or Js.truthy(o.get("gone")) or Js.truthy(o.get("invincible")) or not _hittable_body(o):
		return false
	return not (policy == "enemy" and Js.truthy(e.get("team")) and o.get("team") == e["team"])


# in sight range, in its facing cone (unless wide: the one it fights, the one that shot it), a clear line eye to eye
static func can_see(e: Dictionary, r: Dictionary, o: Dictionary, world: Dictionary, wide: bool) -> bool:
	var q: Array = o["pos"]
	var dx: float = q[0] - e["pos"][0]
	var dy: float = q[1] - e["pos"][1]
	if Js.hypot2(dx, dy) > nf(r, "sightRange", 120.0):
		return false
	if not wide:
		var off := atan2(dy, dx) - float(e["heading"])
		if absf(atan2(sin(off), cos(off))) > nf(r, "sightCone", 1.2):
			return false
	return not (world.get("colliders") is Array and Js.sight_blocked([e["pos"][0], e["pos"][1], float(e["pos"][2]) + eye_h(e)], [q[0], q[1], float(q[2]) + eye_h(o)], world["colliders"]))


func frag_notice(e: Dictionary, r: Dictionary, world: Dictionary):
	if not (world.get("byId") is Dictionary):
		return null
	var now: float = world.get("time", 0.0)
	var policy = frag_policy(e, r)
	# a hit says who and where from: a grudge, and a lead to the shooter
	if int(nn(e, "hits", 0)) > int(nn(e, "fragHits", 0)):
		e["fragHits"] = e["hits"]
		var by = world["byId"].get(e["lastHitBy"]) if Js.truthy(e.get("lastHitBy")) else null
		if by != null and not is_same(by, e):
			e["fragGrudge"] = {"id": by["id"], "t": now}
			e["fragLead"] = {"pos": (by["pos"] as Array).duplicate(), "t": now}
	var grudge = null
	if e.get("fragGrudge") is Dictionary and now - float(e["fragGrudge"]["t"]) < nf(r, "fragGrudge", 3.0):
		grudge = e["fragGrudge"]["id"]
	var best = null
	var bc := INF
	for id in world["order"]:
		var o: Dictionary = world["byId"][id]
		if not frag_foe(e, o, policy):
			continue
		var mine: bool = o["id"] == e.get("fragTarget") or o["id"] == grudge
		if not can_see(e, r, o, world, mine):
			continue
		var c := Js.hypot2(o["pos"][0] - e["pos"][0], o["pos"][1] - e["pos"][1])
		if o["id"] == e.get("fragTarget"):
			c *= 0.6
		if o["id"] == grudge:
			c *= 0.3
		if c < bc:
			bc = c
			best = o
	e["fragTarget"] = best["id"] if best != null else null
	return best


# ITEMS (opt-in `rule.items`: [{ at, gives, back }]): hurt (under `itemsBelow` of its hp) the nearest health or armor,
# short of rounds ammo, an overdrive within 12 m on the way, a weapon not yet carried or nearly dry within `gunReach`;
# each taken (stood on) is not gone back for before its `back`. → the item's place, or null
static func _num_int(v) -> bool:
	return (v is float or v is int) and float(v) == floor(float(v))


func item_goal(e: Dictionary, r: Dictionary, world: Dictionary):
	var items = r.get("items")
	var now: float = world.get("time", 0.0)
	if not (items is Array) or items.is_empty():
		return null
	if not (e.get("itemTook") is Dictionary):
		e["itemTook"] = {}
	var took: Dictionary = e["itemTook"]
	for k in items.size():
		var at: Array = items[k]["at"]
		if Js.hypot2(float(at[0]) - e["pos"][0], float(at[1]) - e["pos"][1]) < 1.2:
			took[k] = now
	var hurt: bool = Js.finite(e.get("hpMax")) and float(e["hpMax"]) > 0.0 and Js.finite(e.get("hp")) and float(e["hp"]) < nf(r, "itemsBelow", 0.6) * float(e["hpMax"])
	var w = e.get("weapon")
	var dry: bool = w is Dictionary and w.get("reserve") != null and float(w["ammo"]) + float(w["reserve"]) < float(w["magazine"])
	var lo = null
	if e.get("pilotRule") is Dictionary and e["pilotRule"].get("loadout") is Array:
		lo = e["pilotRule"]["loadout"]
	elif r.get("loadout") is Array:
		lo = r["loadout"]
	var best = null
	var bd := INF
	for k in items.size():
		var it: Dictionary = items[k]
		if took.get(k) != null and now - float(took[k]) < nf(it, "back", INF):
			continue
		var at: Array = it["at"]
		var d := Js.hypot2(float(at[0]) - e["pos"][0], float(at[1]) - e["pos"][1])
		var gives = it.get("gives")
		var want: bool = ((gives == "health" or gives == "armor") and hurt) or (gives == "ammo" and dry) or (gives == "overdrive" and d < 12.0)
		if not want and gives == "weapon" and d < nf(r, "gunReach", 18.0) and lo != null and e.get("loadoutWeapons") is Array:
			var i := -1
			if _num_int(it.get("slot")):
				i = int(it["slot"])
			else:
				for j in (lo as Array).size():
					if lo[j] is Dictionary and lo[j].get("name") == it.get("slot"):
						i = j
						break
			var lws: Array = e["loadoutWeapons"]
			var g = lws[i] if i >= 0 and i < lws.size() else null
			var held = e.get("loadoutHeld")
			want = g is Dictionary and ((held is Array and i < held.size() and not Js.truthy(held[i])) or (g.get("reserve") != null and float(g["ammo"]) + float(g["reserve"]) < float(g["magazine"])))
		if want and d < bd:
			bd = d
			best = it
	return best["at"] if best != null else null


# no foe in sight: an item it wants, an objective, then a lead (a hit, a shot heard, a sighting), else a hunch
func frag_roam(e: Dictionary, r: Dictionary, dt: float, world: Dictionary) -> void:
	var now: float = world.get("time", 0.0)
	var span := nf(r, "leadSpan", 6.0)
	var speed := nf(r, "speed", 6.0)
	var item = item_goal(e, r, world)
	if item != null:
		e["aiFire"] = 0
		e["seekingItem"] = true
		go_to(e, r, dt, world, item, speed)
		return
	e["seekingItem"] = false
	var ob = r.get("objective")
	if ob is Dictionary and ob.get("at") is Array:
		e["aiFire"] = 0
		var oa: Array = ob["at"]
		if Js.hypot2(float(oa[0]) - e["pos"][0], float(oa[1]) - e["pos"][1]) > nf(ob, "radius", 2.0):
			go_to(e, r, dt, world, oa, speed)
			return
		e["moving"] = false
		e["heading"] = float(e["heading"]) + nf(r, "turn", 3.0) * 0.3 * dt
		return
	if world.get("byId") is Dictionary:
		var heard = null
		var hd := nf(r, "hearRange", 35.0)
		for id in world["order"]:
			var o: Dictionary = world["byId"][id]
			var s = o.get("lastShot")
			if is_same(o, e) or not (s is Dictionary) or now - float(s["t"]) > 0.5 or not (s.get("from") is Array):
				continue
			var d := Js.hypot2(float(s["from"][0]) - e["pos"][0], float(s["from"][1]) - e["pos"][1])
			if d < hd:
				hd = d
				heard = s["from"]
		if heard != null and not (e.get("fragLead") is Dictionary and now - float(e["fragLead"]["t"]) < 0.5):
			e["fragLead"] = {"pos": (heard as Array).duplicate(), "t": now}
	# where it last saw a foe is a lead too, as old as the sighting
	var ls = e.get("lastSeen")
	if ls is Dictionary and (not (e.get("fragLead") is Dictionary) or float(ls["t"]) > float(e["fragLead"]["t"])):
		e["fragLead"] = {"pos": (ls["pos"] as Array).duplicate(), "t": ls["t"]}
	var goal = e["fragLead"]["pos"] if e.get("fragLead") is Dictionary and now - float(e["fragLead"]["t"]) < span else null
	if goal != null and Js.hypot2(float(goal[0]) - e["pos"][0], float(goal[1]) - e["pos"][1]) < 2.0:
		e["fragLead"] = null
		e["lastSeen"] = null
		goal = null
	if goal == null:
		if not (e.get("fragHunch") is Dictionary) or now >= float(e["fragHunch"]["until"]):
			var foes: Array = []
			var policy = frag_policy(e, r)
			for id in world["order"]:
				var o: Dictionary = world["byId"][id]
				if frag_foe(e, o, policy):
					foes.append(o)
			var n := int(nn(e, "fragHunchN", 0)) + 1
			e["fragHunchN"] = n
			if foes.is_empty():
				e["fragHunch"] = null
			else:
				e["fragHunch"] = {"id": foes[int(floor(hash01(String(e["id"]), 7919 + n) * foes.size()))]["id"], "until": now + nf(r, "hunchEvery", 8.0)}
		var h = world["byId"].get(e["fragHunch"]["id"]) if e.get("fragHunch") is Dictionary else null
		if h != null and not Js.truthy(h.get("downed")) and not Js.truthy(h.get("gone")):
			goal = h["pos"]
	if goal == null:
		e["moving"] = false
		return
	e["aiFire"] = 0
	go_to(e, r, dt, world, goal, speed)


func idle(e: Dictionary, r: Dictionary, dt: float, world: Dictionary, motive) -> void:
	if Js.truthy(e.get("groupId")) and e.get("groupSlot") is Array:
		var gs: Array = e["groupSlot"]
		var d := Js.hypot2(gs[0] - e["pos"][0], gs[1] - e["pos"][1])
		if d > 1.5:
			go_to(e, r, dt, world, [gs[0], gs[1], e["pos"][2]], nf(r, "speed", 6.0))
		else:
			e["moving"] = false
		return
	if motive == "guard" or motive == "escort":
		return_to_post(e, r, dt, world)
		return
	if motive == "wander" or motive == "territorial":
		var wp := nf(r, "wanderPause", 2.0)
		wander_step(e, r, dt, world, {"speedMul": nf(r, "wanderSpeedMul", 0.5), "pause": [wp, wp * 2.0]})
		return
	if motive == "forage":
		graze_step(e, r, dt, world)
		return
	if motive == "frag":
		frag_roam(e, r, dt, world)
		return
	e["moving"] = false


# ── the rule ────────────────────────────────────────────────────────────────────────────────────────────────────────
static func spacing_of(w, ov) -> String:
	if ov is Dictionary and Js.truthy(ov.get("style")):
		return String(ov["style"])
	if not (w is Dictionary):
		return "skirmish"
	return "siege" if w.get("fireClass") == "lob" else ("rush" if w.get("fireClass") == "area" else "skirmish")


func _egg_cz(o: Dictionary) -> float:
	if o.get("egg") is Dictionary:
		var egg: Dictionary = o["egg"]
		return float(egg["cz"]) if Js.finite(egg.get("cz")) else float(egg.get("c", 0.0))
	return orf(o, "radius", 0.0)


func ai(e: Dictionary, dt: float, world: Dictionary) -> void:
	var r: Dictionary = e["rule"]
	var speed := nf(r, "speed", 6.0)
	var stride_len := nf(r, "stride", 2.4)
	var eye := nf(r, "eye", 0.0)
	var mind = r.get("mind")
	if mind is Dictionary and (mind.get("phases") != null or mind.get("rank") == "boss") and step_phase(e, r, dt):
		e["aiFire"] = 0
		return
	if mind is Dictionary and adapts(mind):
		step_adapt(e, r, dt, world)
	var dif = tuning_of(e, world)
	e["aiFire"] = 0
	e["thrust"] = 0.0
	e["thrustYaw"] = 0.0
	e["boosting"] = false
	if nf(e, "aiBoostRestT", 0.0) > 0.0:
		e["aiBoostRestT"] = maxf(0.0, float(e["aiBoostRestT"]) - dt)
	var f := Js.fwd_xy(float(e["heading"]))
	var rt := Js.right_xy(float(e["heading"]))
	var space := Js.truthy(r.get("space"))
	var cols = world.get("colliders")

	# COMMITMENTS: the roll
	if e.get("dodgeT") != null:
		e["dodgeT"] = float(e["dodgeT"]) + dt / nf(r, "dodgeDur", 0.55)
		if float(e["dodgeT"]) >= 1.0:
			e["dodgeT"] = null
			e["tumble"] = null
			e["invincible"] = false
			e["dodgeDir"] = null
		else:
			var env := sin(minf(1.0, float(e["dodgeT"])) * PI)
			var dsp := nf(r, "dodgeSpeed", speed * 2.6) * env * dt
			if e.get("dodgeDir") is Array:
				e["pos"][0] += e["dodgeDir"][0] * dsp
				e["pos"][1] += e["dodgeDir"][1] * dsp
			if not space and cols is Array:
				block(e, r, eye, world)
			var gd = ground_at(world, e["pos"]) if not space else null
			if gd != null:
				e["pos"][2] = float(gd) + eye
			e["locomotion"] = e["dodgeClip"] if Js.truthy(e.get("dodgeClip")) else "dodge_sideroll"
			e["moving"] = true
			e["invincible"] = not Js.truthy(e.get("dodgeSpent"))
			e["gaitPhase"] = 0.0
			var ang := minf(1.0, float(e["dodgeT"])) * nf(r, "dodgeTurns", 1.0) * TAU_
			var sg := float(e["dodgeSign"]) if Js.truthy(e.get("dodgeSign")) else 1.0
			e["tumble"] = {"axis": [f[0] * sg, f[1] * sg, 0.0], "angle": ang}
			return
	# the charge
	if e.get("tackleT") != null:
		e["tackleT"] = float(e["tackleT"]) + dt / nf(r, "tackleDur", 2.0)
		if float(e["tackleT"]) >= 1.0:
			e["tackleT"] = null
			e["tackleDir"] = null
			if e.get("cineT") == null:
				e["invincible"] = false
		else:
			var tsp := float(nn(r, "tackleSpeed", nn(r, "boostSpeed", speed * 3.5))) * dt
			if e.get("tackleDir") is Array:
				var td: Array = e["tackleDir"]
				e["pos"][0] += td[0] * tsp
				e["pos"][1] += td[1] * tsp
				if space and td.size() > 2 and Js.truthy(td[2]):
					e["pos"][2] += td[2] * tsp
			if not space and cols is Array:
				block(e, r, eye, world)
			if not space:
				stand_on_ground(e, r, eye, world)
			e["locomotion"] = "boost"
			e["moving"] = true
			e["invincible"] = true
			e["tumble"] = null
			e["gaitPhase"] = orf(e, "gaitPhase", 0.0) + tsp / stride_len
			e["boosting"] = true
			e["thrust"] = 1.0
			return
	# the swing
	if e.get("swingT") != null:
		e["swingT"] = float(e["swingT"]) + dt / orf(e, "swingDur", 0.9)
		e["locomotion"] = e["swingClip"] if Js.truthy(e.get("swingClip")) else "swing_neutral"
		e["moving"] = true
		e["gaitPhase"] = minf(1.0, float(e["swingT"]))
		e["aiFire"] = 0
		var lunge_to = world["byId"].get(e["lungeTo"]) if Js.truthy(e.get("lungeTo")) else null
		var sp = e.get("strikeParams")
		var lunge_room: bool = lunge_to == null or Js.hypot2(lunge_to["pos"][0] - e["pos"][0], lunge_to["pos"][1] - e["pos"][1]) > (float(sp["reach"]) if sp is Dictionary else 1.0) * 0.5
		if Js.truthy(e.get("swingLunge")) and sp is Dictionary and float(e["swingT"]) < float(sp["to"]) and lunge_room:
			var lf := Js.fwd_xy(float(e["heading"]))
			var ls := float(e["swingLunge"]) * dt
			e["pos"][0] += lf[0] * ls
			e["pos"][1] += lf[1] * ls
			if not space and cols is Array:
				block(e, r, eye, world)
		if not space:
			stand_on_ground(e, r, nf(r, "eye", 0.0), world)
		if float(e["swingT"]) >= 1.0:
			if Js.truthy(e.get("aiComboWant")) and not Js.truthy(e.get("swingCombo")) and e.get("aiComboCfg") is Dictionary:
				e["aiComboWant"] = false
				begin_swing_dir(e, e["aiComboCfg"], e["aiComboRule"] if e.get("aiComboRule") is Dictionary else r, "back", true, false)
			else:
				var was_combo := Js.truthy(e.get("swingCombo"))
				e["swingT"] = null
				e["locomotion"] = "forward"
				e["moving"] = false
				e["aiComboWant"] = false
				if was_combo:
					e["strikeCdT"] = float(nn(e, "aiComboCooldown", nn(e, "swingCd", 0)))
				else:
					e["strikeCdT"] = float(e["swingCd"]) if nf(e, "swingCd", 0.0) > 0.0 else orf(e, "strikeCdT", 0.0)
		return

	# IDLE: the world switch
	if world.get("aiEnabled") == false:
		e["moving"] = false
		e["reactionEnded"] = false
		return
	var motive = mind.get("motivation") if mind is Dictionary else null
	if motive == "flee":
		e["reactionEnded"] = false
		if Js.truthy(e.get("groupAlarm")) and e.get("groupSlot") is Array:
			var gs: Array = e["groupSlot"]
			walk_toward(e, r, atan2(gs[1] - e["pos"][1], gs[0] - e["pos"][0]), dt, world, nf(r, "fleeSpeed", speed * 1.6))
			return
		var threat = pick_target(e, world, r["target"]) if Js.truthy(r.get("target")) else threat_of(e, world)
		if threat == null or is_same(threat, e):
			if Js.truthy(e.get("groupId")) and e.get("groupSlot") is Array:
				idle(e, r, dt, world, motive)
			else:
				e["moving"] = false
			return
		var fx: float = e["pos"][0] - threat["pos"][0]
		var fy: float = e["pos"][1] - threat["pos"][1]
		if Js.hypot2(fx, fy) < nf(r, "fearRadius", 18.0):
			walk_toward(e, r, atan2(fy, fx), dt, world, nf(r, "fleeSpeed", speed * 1.6))
		elif Js.truthy(e.get("groupId")) and e.get("groupSlot") is Array:
			idle(e, r, dt, world, motive)
		else:
			e["moving"] = false
		return
	var live_ph = phases_of(mind)[e["mindPhase"]] if mind is Dictionary and e.get("mindPhase") != null else null
	var temper = null
	if mind is Dictionary:
		temper = live_ph["aggressiveness"] if live_ph is Dictionary and Js.truthy(live_ph.get("aggressiveness")) else mind.get("aggressiveness")
	if temper == "passive" or (temper == "defensive" and not (Js.finite(e.get("hpMax")) and float(e["hpMax"]) > 0.0 and Js.finite(e.get("hp")) and float(e["hp"]) < float(e["hpMax"]))):
		e["reactionEnded"] = false
		idle(e, r, dt, world, motive)
		return
	# SENTRY: a body that never moves
	if motive == "sentry":
		e["moving"] = false
		var best = null
		var w0 = e.get("weapon")
		var bd: float = nf(r, "range", float(w0["range"]) if w0 is Dictionary and Js.finite(w0.get("range")) and float(w0["range"]) < 400.0 else 16.0)
		for id in world["order"]:
			var o: Dictionary = world["byId"][id]
			if is_same(o, e) or Js.truthy(o.get("isCamera")) or Js.truthy(o.get("downed")) or Js.truthy(o.get("gone")) or not _hittable_body(o):
				continue
			if Js.truthy(r.get("foes")):
				if o.get("team") != r["foes"]:
					continue
			elif Js.truthy(e.get("team")) and o.get("team") == e["team"]:
				continue
			var d := Js.hypot2(o["pos"][0] - e["pos"][0], o["pos"][1] - e["pos"][1])
			if d < bd:
				bd = d
				best = o
		if best == null:
			e["aiFire"] = 0
			e["sentryPull"] = false
			return
		var q: Array = best["pos"]
		var rem0 := turn_toward(e, atan2(q[1] - e["pos"][1], q[0] - e["pos"][0]), r, dt)
		var tcz := _egg_cz(best) if (best.get("egg") is Dictionary) else (orf(best, "radius", 1.0))
		var weye: float = orf(w0, "eye", 0.0) if w0 is Dictionary else 0.0
		e["pitch"] = clampf(atan2((float(q[2]) + tcz) - (float(e["pos"][2]) + weye), bd if bd != 0.0 else 1e-6), -1.2, 1.2)
		var on_aim: bool = w0 is Dictionary and absf(rem0) <= (nf(r, "fireArc", 6.0) * PI) / 180.0
		e["sentryPull"] = on_aim and not Js.truthy(e.get("sentryPull"))
		e["aiFire"] = 1 if e["sentryPull"] else 0
		return
	# NOTICE
	var ward = ward_of(e, r, world) if motive == "escort" else null
	var policy = r.get("target")
	if policy == null and motive == "escort":
		policy = "enemy" if Js.truthy(e.get("team")) else "all"
	var target = frag_notice(e, r, world) if motive == "frag" else pick_target(e, world, policy, ward)
	if Js.truthy(r.get("cover")) and target != null and not is_same(target, e) and take_cover(e, r, dt, world, target):
		e["reactionEnded"] = false
		return
	var percept = mind.get("perception") if mind is Dictionary else null
	if Js.truthy(percept) and target != null and not is_same(target, e) and not perceive(e, r, target, world) and e.get("groupFocus") != target["id"]:
		target = null
		if percept == "memory" and motive != "frag" and recall(e, r, dt, world):
			e["reactionEnded"] = false
			return
	if target == null or is_same(target, e):
		e["reactionEnded"] = false
		idle(e, r, dt, world, motive)
		return
	# GUARD / ESCORT: a target farther than `guardRadius` from the post is not its business
	if motive == "guard" or motive == "escort":
		var pp := post_of(e, r, world)
		if Js.hypot2(target["pos"][0] - float(pp[0]), target["pos"][1] - float(pp[1])) > nf(r, "guardRadius", 20.0):
			e["reactionEnded"] = false
			e["aiClock"] = -float(dif["reactDelay"]) if dif is Dictionary and Js.truthy(dif.get("reactDelay")) else 0.0
			return_to_post(e, r, dt, world)
			return
	# TERRITORIAL: warned first, then attacked
	if motive == "territorial":
		var home := home_of(e, r)
		var q: Array = target["pos"]
		if Js.hypot2(q[0] - float(home[0]), q[1] - float(home[1])) > nf(r, "territory", 16.0):
			e["warnFor"] = null
			e["reactionEnded"] = false
			idle(e, r, dt, world, motive)
			return
		if e.get("warnFor") != target["id"]:
			e["warnFor"] = target["id"]
			e["warnT"] = 0.0
		if float(e["warnT"]) < nf(r, "warnTime", 1.2):
			e["warnT"] = float(e["warnT"]) + dt
			turn_toward(e, atan2(q[1] - e["pos"][1], q[0] - e["pos"][0]), r, dt)
			e["moving"] = false
			e["locomotion"] = "warn"
			e["aiFire"] = 0
			e["reactionEnded"] = false
			return
		if e.get("locomotion") == "warn":
			e["locomotion"] = "forward"
	if e.get("adapt") is Dictionary and e["adapt"]["foeId"] != target["id"]:
		e["adapt"]["foeId"] = target["id"]
		e["adapt"]["foeHp"] = float(target["hp"]) if Js.finite(target.get("hp")) else null
	# PATHING
	if nav_to(e, r, dt, world, target["pos"], speed):
		e["reactionEnded"] = false
		return
	var dx: float = target["pos"][0] - e["pos"][0]
	var dy: float = target["pos"][1] - e["pos"][1]
	var dist2d := Js.hypot2(dx, dy)
	if dist2d == 0.0:
		dist2d = 1e-6

	# PRESSED: just recovered from a stagger
	if Js.truthy(e.get("reactionEnded")):
		e["reactionEnded"] = false
		if r.get("dodge") != false and nf(e, "dodgeCdT", 0.0) <= 0.0:
			e["aiDodgeSide"] = -1 if int(nn(e, "aiDodgeSide", 0)) == 1 else 1
			var ux := dx / dist2d
			var uy := dy / dist2d
			var sd: int = e["aiDodgeSide"]
			roll_off(e, r, dif, [-uy * sd, ux * sd], rt)
			e["locomotion"] = "dodge_sideroll"
			e["invincible"] = true
			e["gaitPhase"] = 0.0
			e["moving"] = true
			return
	# blades crossed: roll back off the clash line
	if Js.truthy(e.get("clashRetreat")):
		e["clashRetreat"] = false
		if r.get("dodge") != false and nf(e, "dodgeCdT", 0.0) <= 0.0:
			e["aiDodgeSide"] = -1 if int(nn(e, "aiDodgeSide", 0)) == 1 else 1
			var ux := dx / dist2d
			var uy := dy / dist2d
			var sd: int = e["aiDodgeSide"]
			roll_off(e, r, dif, [(-ux - uy * sd) * 0.7071, (-uy + ux * sd) * 0.7071], rt)
			e["locomotion"] = "dodge_sideroll"
			e["invincible"] = true
			e["gaitPhase"] = 0.0
			e["moving"] = true
			return

	# STRIKE: the counter (the opportunist's tackleGuard)
	if dif is Dictionary and Js.truthy(dif.get("tackleGuard")) and nf(e, "tackleCdT", 0.0) <= 0.0 and not (nf(e, "aiBoostRestT", 0.0) > 0.0) \
			and target.get("swingT") != null and target.get("strikeParams") != null and target.get("staggerT") == null and not Js.truthy(target.get("downed")) \
			and (f[0] * dx + f[1] * dy) / dist2d >= cos(nf(r, "tackleGuardCone", 1.1)):
		var tspeed := float(nn(r, "tackleSpeed", nn(r, "boostSpeed", speed * 3.5)))
		var mdz0: float = target["pos"][2] - e["pos"][2]
		var tdist := Js.hypot3(dx, dy, mdz0) if space else dist2d
		if tdist < nf(r, "tackleReach", 8.0) + tspeed * nf(r, "tackleDur", 2.0) * 0.6:
			var ux := dx / dist2d
			var uy := dy / dist2d
			if space:
				var n3 := Js.hypot3(dx, dy, mdz0)
				if n3 == 0.0:
					n3 = 1e-6
				e["tackleDir"] = [dx / n3, dy / n3, mdz0 / n3]
			else:
				e["tackleDir"] = [ux, uy]
			e["heading"] = atan2(dy, dx)
			e["tackleT"] = 0.0
			e["tackleHits"] = {}
			e["tackleCount"] = int(nn(e, "tackleCount", 0)) + 1
			e["tackleCdT"] = nf(r, "aiTackleCooldown", 1.5)
			e["invincible"] = true
			e["tumble"] = null
			e["locomotion"] = "boost"
			e["moving"] = true
			e["gaitPhase"] = 0.0
			return
	var lo = null
	if e.get("pilotRule") is Dictionary and e["pilotRule"].get("loadout") is Array:
		lo = e["pilotRule"]["loadout"]
	elif r.get("loadout") is Array:
		lo = r["loadout"]
	# the blade commit, and the give-up
	if nf(e, "meleeGiveUpT", 0.0) > 0.0:
		e["meleeGiveUpT"] = maxf(0.0, float(e["meleeGiveUpT"]) - dt)
	var bench = e["adapt"]["benched"] if e.get("adapt") is Dictionary else null
	var melee_cfg = null
	if (Js.truthy(r.get("meleeSeek")) or bench == "ranged") and bench != "melee" and lo != null and nf(e, "strikeCdT", 0.0) <= 0.0 and not (nf(e, "meleeGiveUpT", 0.0) > 0.0):
		for c in lo:
			if c is Dictionary and c.get("strike") == "melee":
				melee_cfg = c
				break
	var melee_reach: float = float(nn(melee_cfg, "strikeReach", nn(r, "strikeReach", speed))) if melee_cfg != null else 0.0
	var target_reeling: bool = target.get("staggerT") != null and Js.truthy(target.get("staggerT")) and not Js.truthy(target.get("downed"))
	var melee_vreach := nf(r, "meleeVReach", nf(r, "collideHeight", 24.0) * 1.5)
	var mdz: float = target["pos"][2] - e["pos"][2]
	var target_high := not space and absf(mdz) > melee_vreach
	var melee_dist := Js.hypot3(dx, dy, mdz) if space else dist2d
	var target_safe := not (dif is Dictionary and Js.truthy(dif.get("tackleGuard"))) or target.get("dodgeT") != null or target_reeling
	var melee_commit: bool = melee_cfg != null and not Js.truthy(target.get("downed")) and not target_high and target_safe and (not Js.truthy(e.get("groupId")) or Js.truthy(e.get("groupToken"))) \
			and (melee_dist < melee_reach * 3.0 or (target_reeling and melee_dist < melee_reach * 9.0))
	if melee_commit:
		e["meleeCommitT"] = orf(e, "meleeCommitT", 0.0) + dt
		if float(e["meleeCommitT"]) >= nf(r, "meleeTimeout", 5.0):
			e["meleeGiveUpT"] = nf(r, "meleeGiveUp", 4.0)
			e["meleeCommitT"] = 0.0
	else:
		e["meleeCommitT"] = 0.0
	if melee_commit:
		var idx: int = (lo as Array).find(melee_cfg)
		if int(nn(e, "loadoutIdx", 0)) != idx:
			e["loadoutIdx"] = idx
			e["weapon"] = e["loadoutWeapons"][idx] if e.get("loadoutWeapons") is Array else null
			if Js.truthy(melee_cfg.get("figure")):
				e["figure"] = melee_cfg["figure"]
			arm_switch_ready(e, r, melee_cfg)
	elif e.get("loadoutWeapons") is Array and lo != null:
		var ranged: Array = []
		var lws: Array = e["loadoutWeapons"]
		for i in lws.size():
			if lws[i] != null and not Js.truthy(lo[i].get("throw")):
				ranged.append(i)
		if not ranged.is_empty():
			if e.get("aiRangedPick") == null:
				var cur := ranged.find(int(nn(e, "loadoutIdx", 0)))
				e["aiRangedPick"] = cur if cur >= 0 else 0
			if ranged.size() > 1:
				e["aiWeaponT"] = orf(e, "aiWeaponT", 0.0) + dt
				if float(e["aiWeaponT"]) >= nf(r, "weaponRotate", 6.0):
					e["aiWeaponT"] = 0.0
					e["aiRangedPick"] = (int(e["aiRangedPick"]) + 1) % ranged.size()
			var want: int = ranged[int(e["aiRangedPick"]) % ranged.size()]
			if not Js.truthy(e.get("weapon")) or int(nn(e, "loadoutIdx", 0)) != want:
				e["loadoutIdx"] = want
				e["weapon"] = lws[want]
				if Js.truthy(lo[want].get("figure")):
					e["figure"] = lo[want]["figure"]
				arm_switch_ready(e, r, lo[want])
	# aim: turn toward the target, pitch at its egg centre
	var rem := turn_toward(e, atan2(dy, dx), r, dt)
	var w = e.get("weapon")
	var tcz2 := _egg_cz(target)
	var weye2: float = orf(w, "eye", 0.0) if w is Dictionary else 0.0
	e["pitch"] = clampf(atan2((float(target["pos"][2]) + tcz2) - (float(e["pos"][2]) + weye2), dist2d), -1.2, 1.2)

	# ENGAGE: spacing
	var dz: float = target["pos"][2] - e["pos"][2]
	var dist3d := Js.hypot3(dx, dy, dz)
	if dist3d == 0.0:
		dist3d = 1e-6
	var range_d := dist3d if space else dist2d
	var a_slot = lo[int(nn(e, "loadoutIdx", 0))] if lo != null and int(nn(e, "loadoutIdx", 0)) < (lo as Array).size() else null
	var a_ov = null
	if a_slot is Dictionary and Js.truthy(a_slot.get("approach")):
		a_ov = a_slot["approach"]
	elif Js.truthy(r.get("approach")):
		a_ov = r["approach"]
	var a_prof: Array = SPACING.get(spacing_of(w, a_ov), [1.0, 0.7, 1.0])
	var blade_only: bool = not (w is Dictionary) and lo != null and not (lo as Array).is_empty()
	if blade_only:
		for c in lo:
			if c is Dictionary and c.get("strike") != "melee":
				blade_only = false
				break
	var blade_reach := 0.0
	if blade_only:
		var bc = null
		for c in lo:
			if c is Dictionary and c.get("strike") == "melee":
				bc = c
				break
		blade_reach = float(nn(bc if bc != null else {}, "strikeReach", nn(r, "strikeReach", speed)))
	var base_standoff: float
	if r.get("standoff") != null:
		base_standoff = float(r["standoff"])
	elif w is Dictionary:
		base_standoff = orf(w, "range", 400.0) * 0.42
	elif blade_only:
		base_standoff = blade_reach * 0.8
	else:
		base_standoff = speed * 8.0
	var standoff: float = (float(a_ov["standoff"]) if a_ov is Dictionary and Js.finite(a_ov.get("standoff")) else base_standoff * float(a_prof[0])) if w is Dictionary else base_standoff
	standoff *= float(dif["standoffMul"]) if dif is Dictionary else 1.0
	var close_bias: float = (float(a_ov["close"]) if a_ov is Dictionary and Js.finite(a_ov.get("close")) else float(a_prof[1])) * (float(dif["closeMul"]) if dif is Dictionary else 1.0)
	var weave_mul: float = float(a_ov["weave"]) if a_ov is Dictionary and Js.finite(a_ov.get("weave")) else float(a_prof[2])
	var f2 := Js.fwd_xy(float(e["heading"]))
	var rt2 := Js.right_xy(float(e["heading"]))
	var facing := absf(rem) < 1.1
	var boost_burst := false
	if Js.truthy(r.get("boost")) and not (nf(e, "aiBoostRestT", 0.0) > 0.0):
		var bb := nf(r, "boostBurst", 2.5) * (float(dif["boostBurstMul"]) if dif is Dictionary else 1.0)
		var brest := nf(r, "boostRest", 1.6) * (float(dif["boostRestMul"]) if dif is Dictionary else 1.0)
		var cyc := maxf(0.1, bb + brest)
		e["aiBoostClock"] = orf(e, "aiBoostClock", 0.0) + dt
		boost_burst = fmod(float(e["aiBoostClock"]), cyc) < bb
	var move_mag := 0.0
	var clip := "forward"
	if melee_commit:
		if melee_dist > melee_reach * 0.85:
			var can_boost: bool = (Js.truthy(r.get("boost")) or Js.truthy(r.get("boostSpeed"))) and not (nf(e, "aiBoostRestT", 0.0) > 0.0)
			var spd := (nf(r, "boostSpeed", speed * 3.5) if can_boost else speed) * dt
			if facing:
				if space:
					var ux := dx / melee_dist
					var uy := dy / melee_dist
					var uz := mdz / melee_dist
					e["pos"][0] += ux * spd
					e["pos"][1] += uy * spd
					e["pos"][2] += uz * spd
					move_mag = spd
					clip = "boost"
					if can_boost:
						e["boosting"] = true
						e["thrust"] = 1.0
					else:
						e["thrust"] = maxf(float(e["thrust"]), 0.5)
				else:
					e["pos"][0] += f2[0] * spd
					e["pos"][1] += f2[1] * spd
					move_mag = spd
					if can_boost:
						clip = "boost"
						e["boosting"] = true
						e["thrust"] = 1.0
					else:
						clip = "forward"
		elif facing and nf(e, "readyT", 0.0) <= 0.0:
			begin_swing(e, melee_cfg, r, dif)
			e["lungeTo"] = target["id"]
			e["meleeCommitT"] = 0.0
	elif Js.truthy(e.get("groupId")) and e.get("groupSlot") is Array and not space and not (Js.truthy(e.get("groupToken")) and blade_only):
		var gs: Array = e["groupSlot"]
		var gx: float = gs[0] - e["pos"][0]
		var gy: float = gs[1] - e["pos"][1]
		var gdist := Js.hypot2(gx, gy)
		var sp := nf(e, "groupSpacing", 3.0)
		var sx := 0.0
		var sy := 0.0
		for id in world["order"]:
			var o: Dictionary = world["byId"][id]
			if is_same(o, e) or o.get("groupId") != e["groupId"]:
				continue
			var ox: float = e["pos"][0] - o["pos"][0]
			var oy: float = e["pos"][1] - o["pos"][1]
			var od := Js.hypot2(ox, oy)
			if od > 1e-6 and od < sp:
				sx += (ox / od) * (sp - od) / sp
				sy += (oy / od) * (sp - od) / sp
		if gdist > 0.6 or sx != 0.0 or sy != 0.0:
			var mx := (gx / gdist if gdist > 0.6 else 0.0) + sx * 1.5
			var my := (gy / gdist if gdist > 0.6 else 0.0) + sy * 1.5
			var mn := Js.hypot2(mx, my)
			if mn == 0.0:
				mn = 1.0
			var stp := minf(speed * dt, gdist + 0.5)
			e["pos"][0] += (mx / mn) * stp
			e["pos"][1] += (my / mn) * stp
			move_mag = stp
			clip = "forward"
	elif space:
		var ux := dx / dist3d
		var uy := dy / dist3d
		var uz := dz / dist3d
		if boost_burst:
			var side := next_juke(e, r, dt)
			var bias := close_bias if dist3d > standoff else (-close_bias if dist3d < standoff * 0.55 else 0.0)
			var v_weave := sin(orf(e, "aiBoostClock", 0.0) * 2.4) * 0.5
			var mvx: float = rt2[0] * side * weave_mul + ux * bias
			var mvy: float = rt2[1] * side * weave_mul + uy * bias
			var mvz := v_weave + uz * bias
			var mn := Js.hypot3(mvx, mvy, mvz)
			if mn == 0.0:
				mn = 1.0
			mvx /= mn
			mvy /= mn
			mvz /= mn
			var bstep := nf(r, "boostSpeed", speed * 3.5) * dt
			e["pos"][0] += mvx * bstep
			e["pos"][1] += mvy * bstep
			e["pos"][2] += mvz * bstep
			move_mag = bstep
			clip = ("boost_right" if side > 0 else "boost_left") if absf(mvx * rt2[0] + mvy * rt2[1]) > 0.4 else "boost"
			e["boosting"] = true
			e["thrust"] = 1.0
		elif dist3d > standoff and facing:
			var stp := speed * dt
			e["pos"][0] += ux * stp
			e["pos"][1] += uy * stp
			e["pos"][2] += uz * stp
			move_mag = stp
			clip = "boost"
			e["thrust"] = maxf(float(e["thrust"]), 0.5)
	elif boost_burst:
		var side := next_juke(e, r, dt)
		var bias := close_bias if dist2d > standoff else (-close_bias if dist2d < standoff * 0.55 else 0.0)
		var mvx: float = rt2[0] * side * weave_mul + f2[0] * bias
		var mvy: float = rt2[1] * side * weave_mul + f2[1] * bias
		var mn := Js.hypot2(mvx, mvy)
		if mn == 0.0:
			mn = 1.0
		mvx /= mn
		mvy /= mn
		var bstep := nf(r, "boostSpeed", speed * 3.5) * dt
		e["pos"][0] += mvx * bstep
		e["pos"][1] += mvy * bstep
		move_mag = bstep
		clip = ("boost_right" if side > 0 else "boost_left") if absf(mvx * rt2[0] + mvy * rt2[1]) > 0.5 else "boost"
		e["boosting"] = true
		e["thrust"] = 1.0
	else:
		var move_f := 0.0
		if dist2d > standoff and facing:
			move_f = speed * dt
		if move_f != 0.0:
			e["pos"][0] += f2[0] * move_f
			e["pos"][1] += f2[1] * move_f
		move_mag = move_f
		# FRAG: it strafes as it shoots, side to side on its juke clock; not with a slot that `plant`s
		var planted: bool = a_slot is Dictionary and Js.truthy(a_slot.get("plant"))
		if motive == "frag" and facing and w is Dictionary and nf(r, "strafe", 0.6) > 0.0 and not planted:
			var side := float(next_juke(e, r, dt))
			var ss := speed * nf(r, "strafe", 0.6) * dt
			e["pos"][0] += rt2[0] * side * ss
			e["pos"][1] += rt2[1] * side * ss
			move_mag = maxf(move_mag, ss)
	if not space and cols is Array:
		block(e, r, eye, world)
	if not space:
		stand_on_ground(e, r, eye, world)
	if move_mag > 0.0:
		e["locomotion"] = clip
		e["gaitPhase"] = orf(e, "gaitPhase", 0.0) + move_mag / stride_len
		e["moving"] = true
	else:
		e["moving"] = false

	# STRIKE: the trigger
	var fire_arc := (nf(r, "fireArc", 6.0) * PI) / 180.0
	var origin := [e["pos"][0], e["pos"][1], float(e["pos"][2]) + weye2]
	var on_aim2: bool
	if space:
		var a3 := Js.fwd3(float(e["heading"]), orf(e, "pitch", 0.0))
		on_aim2 = (a3[0] * (dx / dist3d) + a3[1] * (dy / dist3d) + a3[2] * (dz / dist3d)) >= cos(fire_arc)
	else:
		on_aim2 = absf(rem) <= fire_arc
	var engaged: bool = w is Dictionary and on_aim2 and range_d <= orf(w, "range", 400.0) and not Js.sight_blocked(origin, target["pos"], cols)
	if engaged:
		var burst_on := nf(r, "burst", 1.1) * (float(dif["burstMul"]) if dif is Dictionary else 1.0)
		var cycle := burst_on + nf(r, "pause", 0.9) * (float(dif["pauseMul"]) if dif is Dictionary else 1.0)
		e["aiClock"] = orf(e, "aiClock", 0.0) + dt
		e["aiFire"] = 1 if float(e["aiClock"]) >= 0.0 and fmod(float(e["aiClock"]), cycle) <= burst_on else 0
	else:
		e["aiClock"] = -float(dif["reactDelay"]) if dif is Dictionary and Js.truthy(dif.get("reactDelay")) else 0.0
	# DETUNE: the tuning's accuracy, a sinusoidal wobble after every decision
	if dif is Dictionary and Js.truthy(dif.get("aimWobble")):
		e["aiWobT"] = orf(e, "aiWobT", 0.0) + dt
		var wob_y := sin(float(e["aiWobT"]) * float(dif["wobbleHz"]) * TAU_) * float(dif["aimWobble"])
		e["heading"] = float(e["heading"]) + wob_y - orf(e, "aiWobPrev", 0.0)
		e["aiWobPrev"] = wob_y
		e["pitch"] = clampf(orf(e, "pitch", 0.0) + sin(float(e["aiWobT"]) * float(dif["wobbleHz"]) * 0.77 * TAU_ + 1.3) * float(dif["aimWobble"]) * 0.6, -1.2, 1.2)


# maneuvers.js armSwitchReady: a mind pays the loadout switch's ready-time too
static func arm_switch_ready(e: Dictionary, r: Dictionary, sc) -> void:
	e["readyMax"] = float(sc["switchReady"]) if sc is Dictionary and Js.finite(sc.get("switchReady")) else nf(r, "switchReady", 1.0)
	e["readyT"] = e["readyMax"]
