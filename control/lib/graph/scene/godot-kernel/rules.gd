extends RefCounted
# mojulo-godot kernel — the motion rules, ported from the web's controllable engine (worlds/controllable/rules-basic.js
# walk, rules-platform.js platform, core.js resolveBlocking and laneNear) and held equal to it frame by frame by the
# rules conformance corpus (lib/graph/scene/rules-conformance.js). Everything here is in the RECIPE's own frame: z up,
# recipe units, a heading counter-clockwise from +x seen from above, a position at the eye (the rule's `eye` above the
# feet). kernel/walker.gd turns it into the node's transform; nothing here touches a node.
#
# An entity is a Dictionary: pos [x, y, z], heading, pitch, vel [x, y, z], and the rule's own state (grounded, coyote,
# jumpBuf, jumpWind, airJumpsUsed, gaitPhase, moving, locomotion, jumped, landed). An input is the web rule's axes
# (forward, strafe, turn, lookDX, lookDY, jump, jumpHeld). A world is { ground: <make_ground>, colliders: [{min, max}] }.
#
# The vehicles (since 0.23.0, rules-drive.js drive and racer, rules-fly.js fly): a kinematic car (its power curve,
# brakes, drag, the slewed bicycle steer, the ground followed down at a fall rate, walls; flight off a ramp's lip or a
# crest with `air`), a driver no one pilots following its line, and fixed-wing flight. A car's ground surface (`surfaceGrip`
# over the world's driveSurface) is the web's (godot-marks.js names it).
#
# What the platform rule does that this port does not (godot-marks.js PLATFORM_LOST names each, all opt-in on the rule):
# the boost hover and inertia, space, the charged jump, the kneel, and the maneuver packs (dodge, tackle, a loadout). The
# melee swing's halt is the fight's (kernel/combat.gd): level.gd passes it in.

const TAU := PI * 2.0
const HALF_PI := PI / 2.0
const CELL := 4.0


# ── the ground: the page's raycast straight down, over the level's triangles (level-equivalence.js faceGround) ───────
# a level with no faces at all stands on the score's implicit plane (`flat`: its height), as level-sim.js's default
static func make_ground(tris: Array, flat = null) -> Dictionary:
	if tris.is_empty() and flat != null:
		return {"flat": float(flat), "grid": {}, "tris": []}
	var grid := {}
	var kept := []
	for t in tris:
		if not (t is Array and t.size() == 3):
			continue
		var k := kept.size()
		kept.append(t)
		var x0 := int(floor(minf(minf(t[0][0], t[1][0]), t[2][0]) / CELL))
		var x1 := int(floor(maxf(maxf(t[0][0], t[1][0]), t[2][0]) / CELL))
		var y0 := int(floor(minf(minf(t[0][1], t[1][1]), t[2][1]) / CELL))
		var y1 := int(floor(maxf(maxf(t[0][1], t[1][1]), t[2][1]) / CELL))
		for x in range(x0, x1 + 1):
			for y in range(y0, y1 + 1):
				var key := "%d,%d" % [x, y]
				if not grid.has(key):
					grid[key] = []
				grid[key].append(k)
	return {"grid": grid, "tris": kept}


# the height of triangle t over (x, y), or NAN when (x, y) is outside it (barycentric, edges included)
static func _height_in(t: Array, x: float, y: float) -> float:
	var a: Array = t[0]
	var b: Array = t[1]
	var c: Array = t[2]
	var d: float = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
	if absf(d) < 1e-12:
		return NAN
	var u: float = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / d
	var v: float = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / d
	var w: float = 1.0 - u - v
	if u < -1e-9 or v < -1e-9 or w < -1e-9:
		return NAN
	return u * a[2] + v * b[2] + w * c[2]


# the nearest surface at or below pos + 0.05, straight down; NAN when there is none (the web's null)
static func ground_at(g, pos: Array) -> float:
	if not (g is Dictionary):
		return NAN
	if g.has("flat"):
		return g["flat"] if g["flat"] <= float(pos[2]) + 0.05 else NAN
	var x := float(pos[0])
	var y := float(pos[1])
	var top := float(pos[2]) + 0.05
	var list = g["grid"].get("%d,%d" % [int(floor(x / CELL)), int(floor(y / CELL))])
	if list == null:
		return NAN
	var best := NAN
	for k in list:
		var z := _height_in(g["tris"][k], x, y)
		if not is_nan(z) and z <= top and (is_nan(best) or z > best):
			best = z
	return best


# ── the helpers the rules share (core.js) ────────────────────────────────────────────────────────────────────────────
static func _num(d: Dictionary, k: String, dflt: float) -> float:
	var v = d.get(k)
	return float(v) if (v is float or v is int) else dflt


static func _in(input: Dictionary, k: String) -> float:
	var v = input.get(k, 0.0)
	if v is bool:
		return 1.0 if v else 0.0
	return float(v) if (v is float or v is int) else 0.0


static func fwd_xy(h: float) -> Array:
	return [cos(h), sin(h)]


static func right_xy(h: float) -> Array:
	return [sin(h), -cos(h)]


# `d.k || 0` for a number
static func _num0(d: Dictionary, k: String) -> float:
	var v = d.get(k)
	return float(v) if (v is float or v is int) and not is_nan(float(v)) else 0.0


static func _hypot(a: float, b: float) -> float:
	return sqrt(a * a + b * b)


# core.js laneNear: the nearest point of a polyline lane and the lane's direction there
static func lane_near(lane: Array, x: float, y: float, bias: float = 0.0) -> Dictionary:
	var best := INF
	var px := float(lane[0][0])
	var py := float(lane[0][1])
	var tx := 1.0
	var ty := 0.0
	for i in range(1, lane.size()):
		var ax := float(lane[i - 1][0])
		var ay := float(lane[i - 1][1])
		var dx := float(lane[i][0]) - ax
		var dy := float(lane[i][1]) - ay
		var l2 := dx * dx + dy * dy
		if l2 < 1e-12:
			continue
		var u := maxf(0.0, minf(1.0, ((x - ax) * dx + (y - ay) * dy) / l2))
		var qx := ax + dx * u
		var qy := ay + dy * u
		var d2 := (x - qx) * (x - qx) + (y - qy) * (y - qy)
		if d2 < best - 1e-12 or (bias > 0.0 and d2 <= best + 1e-12):
			var L := sqrt(l2)
			best = d2
			px = qx
			py = qy
			tx = dx / L
			ty = dy / L
	return {"px": px, "py": py, "tx": tx, "ty": ty}


# core.js resolveBlocking: the footprint circle pushed out of every box whose z-band the body overlaps
static func resolve_blocking(pos: Array, foot_z: float, height: float, cr: float, colliders: Array, step: float) -> void:
	if colliders.is_empty() or not (cr > 0.0):
		return
	for c in colliders:
		if not (c is Dictionary and c.get("min") is Array and c.get("max") is Array):
			continue
		var mn: Array = c["min"]
		var mx: Array = c["max"]
		if foot_z >= float(mx[2]) - step:
			continue
		if foot_z + height <= float(mn[2]):
			continue
		var px := float(pos[0])
		var py := float(pos[1])
		var inside_x: bool = px > mn[0] and px < mx[0]
		var inside_y: bool = py > mn[1] and py < mx[1]
		if inside_x and inside_y:
			var dl: float = px - mn[0]
			var dr: float = mx[0] - px
			var dd: float = py - mn[1]
			var du: float = mx[1] - py
			var m := minf(minf(dl, dr), minf(dd, du))
			if m == dl:
				pos[0] = float(mn[0]) - cr
			elif m == dr:
				pos[0] = float(mx[0]) + cr
			elif m == dd:
				pos[1] = float(mn[1]) - cr
			else:
				pos[1] = float(mx[1]) + cr
		else:
			var nx: float = mn[0] if px < mn[0] else (mx[0] if px > mx[0] else px)
			var ny: float = mn[1] if py < mn[1] else (mx[1] if py > mx[1] else py)
			var dx := px - nx
			var dy := py - ny
			var d2 := dx * dx + dy * dy
			if d2 < cr * cr and d2 > 1e-9:
				var d := sqrt(d2)
				pos[0] = nx + (dx / d) * cr
				pos[1] = ny + (dy / d) * cr


# a fresh entity's rule state, as core.js normalizeEntity starts it
static func entity(pos: Array, heading: float) -> Dictionary:
	return {"pos": [float(pos[0]), float(pos[1]), float(pos[2])], "heading": heading, "pitch": 0.0, "vel": [0.0, 0.0, 0.0],
		"gaitPhase": 0.0, "moving": false, "locomotion": "forward"}


static func step(e: Dictionary, r: Dictionary, input: Dictionary, dt: float, world: Dictionary, halt: float = 1.0) -> void:
	match String(r.get("type", "")):
		"walk":
			walk(e, r, input, dt, world)
		"platform":
			platform(e, r, input, dt, world, halt)
		"drive":
			drive(e, r, input, dt, world)
		"racer":
			racer(e, r, dt, world)
		"fly":
			fly(e, r, input, dt, world)


# ── walk — ground-locked: a tank turn (or a look), forward and strafe, the feet on the ground under the eye ──────────
static func walk(e: Dictionary, r: Dictionary, input: Dictionary, dt: float, world: Dictionary) -> void:
	var speed := _num(r, "speed", 6.0)
	var turn := _num(r, "turn", 2.2)
	var stride := _num(r, "stride", 2.4)
	var strafe := _num(r, "strafe", 0.0)
	var eye := _num(r, "eye", 0.0)
	var tank := String(r.get("turnMode", "tank")) == "tank"
	var sens := _num(r, "lookSens", 0.0025)
	if tank:
		e["heading"] = fmod(float(e["heading"]) - _in(input, "turn") * turn * dt, TAU)
	else:
		e["heading"] = fmod(float(e["heading"]) + _in(input, "lookDX") * sens, TAU)
		if r.get("keyTurn"):
			e["heading"] = fmod(float(e["heading"]) - _in(input, "turn") * turn * dt, TAU)
	if r.get("lookPitch") and not tank:
		e["pitch"] = clampf(float(e.get("pitch", 0.0)) + _in(input, "lookDY") * sens, -HALF_PI + 0.05, HALF_PI - 0.05)
	var f := fwd_xy(float(e["heading"]))
	var rt := right_xy(float(e["heading"]))
	var move_f := _in(input, "forward") * speed * dt
	var move_s := _in(input, "strafe") * strafe * speed * dt
	var p: Array = e["pos"]
	p[0] = float(p[0]) + (f[0] * move_f + rt[0] * move_s)
	p[1] = float(p[1]) + (f[1] * move_f + rt[1] * move_s)
	var cr := _num(r, "collideRadius", 0.0)
	if cr > 0.0 and world.get("colliders") is Array:
		resolve_blocking(p, float(p[2]) - eye, _num(r, "collideHeight", _num(r, "eye", 1.7)), cr, world["colliders"], _num(r, "step", 0.35))
	var probe := _num(r, "probe", 0.0)
	var gz := ground_at(world.get("ground"), [p[0], p[1], float(p[2]) - eye + probe] if probe > 0.0 else p)
	if not is_nan(gz):
		p[2] = gz + eye
	var dist := _hypot(move_f, move_s)
	e["gaitPhase"] = float(e.get("gaitPhase", 0.0)) + (-dist if move_f < 0.0 else dist) / stride
	e["moving"] = absf(_in(input, "forward")) + absf(_in(input, "strafe")) > 1e-3


# ── platform — the ground half of the platform rule: turn (tank, look, world, lane), run, jump, fall and land ─────────
static func platform(e: Dictionary, r: Dictionary, input: Dictionary, dt: float, world: Dictionary, halt: float = 1.0) -> void:
	var speed := _num(r, "speed", 6.0)
	var turn_rate := _num(r, "turn", 2.4)
	var strafe := _num(r, "strafe", 1.0)
	var eye := _num(r, "eye", 0.0)
	var rise_g := _num(r, "gravity", 20.0)
	var fall_g := _num(r, "fallGravity", rise_g * 1.7)
	var jump_v := _num(r, "jumpSpeed", 8.5)
	var max_fall := _num(r, "maxFall", 26.0)
	var snap := _num(r, "snap", 0.15)
	var step_up := _num(r, "step", 0.35)
	var coyote_t := _num(r, "coyote", 0.1)
	var buffer_t := _num(r, "buffer", 0.1)
	var cut_v := _num(r, "jumpCut", 0.0)
	var air := _num(r, "airControl", 0.7)
	var boost_speed := _num(r, "boostSpeed", speed * 3.5)
	var boost_max := _num(r, "boostMax", 0.0)
	var has_gauge := boost_max > 0.0
	if has_gauge and e.get("boost") == null:
		e["boost"] = boost_max
	var p: Array = e["pos"]
	var vel: Array = e["vel"]
	var g = world.get("ground")
	var look_mode := String(r.get("turnMode", "tank")) != "tank"
	var sens := _num(r, "lookSens", 0.0025)
	var lane = r.get("lane")
	var lane_move: bool = r.get("move") == "lane" and lane is Array and lane.size() >= 2
	var world_move: bool = r.get("move") == "world" or lane_move
	var turn_amt := 0.0
	var wm_x := 0.0
	var wm_y := 0.0
	var wm_mag := 0.0
	if world_move:
		var side := clampf(_in(input, "strafe") + _in(input, "turn"), -1.0, 1.0)
		if lane_move:
			var L := lane_near(lane, p[0], p[1], side)
			wm_x = L["tx"] * side
			wm_y = L["ty"] * side
		else:
			var my := _num(r, "moveYaw", HALF_PI)
			var wf := fwd_xy(my)
			var wr := right_xy(my)
			wm_x = wf[0] * _in(input, "forward") + wr[0] * side
			wm_y = wf[1] * _in(input, "forward") + wr[1] * side
		wm_mag = minf(1.0, _hypot(wm_x, wm_y))
		if wm_mag > 1e-3:
			var d := fmod(fmod(atan2(wm_y, wm_x) - float(e["heading"]) + PI, TAU) + TAU, TAU) - PI
			var mx := _num(r, "faceRate", 12.0) * dt
			turn_amt = clampf(d, -mx, mx)
			e["heading"] = fmod(float(e["heading"]) + turn_amt, TAU)
	elif look_mode:
		turn_amt = _in(input, "lookDX") * sens
		e["heading"] = fmod(float(e["heading"]) + turn_amt, TAU)
		e["pitch"] = clampf(float(e.get("pitch", 0.0)) + _in(input, "lookDY") * sens, -HALF_PI + 0.05, HALF_PI - 0.05)
	else:
		turn_amt = -_in(input, "turn") * turn_rate * dt
		e["heading"] = fmod(float(e["heading"]) + turn_amt, TAU)

	var foot_z := float(p[2]) - eye
	var gz0 := ground_at(g, [p[0], p[1], foot_z + step_up])
	var was_grounded: bool = e.get("grounded") == true
	var fall_speed := 0.0 if was_grounded else maxf(0.0, -float(vel[2]))
	e["grounded"] = not is_nan(gz0) and float(vel[2]) <= 1e-4 and absf(foot_z - gz0) <= snap
	var landed_edge: bool = e["grounded"] and not was_grounded
	if landed_edge:
		e["landVel"] = fall_speed
	e["coyote"] = 0.0 if e["grounded"] else minf(float(e.get("coyote", coyote_t)) + dt, 1.0)
	e["jumpBuf"] = buffer_t if _in(input, "jump") != 0.0 else maxf(0.0, float(e.get("jumpBuf", 0.0)) - dt)

	var fwd_in := wm_mag if world_move else _in(input, "forward")
	var side_in := 0.0 if world_move else clampf(_in(input, "strafe") + (_in(input, "turn") if look_mode else 0.0), -1.0, 1.0)
	var h := atan2(wm_y, wm_x) if (world_move and wm_mag > 1e-3) else float(e["heading"])
	var f := fwd_xy(h)
	var rt := right_xy(h)
	var ctl := 1.0 if e["grounded"] else air

	var windup := _num(r, "jumpWindup", 0.0)
	var jumped := false
	var wind := float(e.get("jumpWind", 0.0))
	if (_in(input, "jump") != 0.0 or float(e["jumpBuf"]) > 0.0) and (e["grounded"] or float(e["coyote"]) < coyote_t) and not (wind > 0.0):
		if windup > 0.0:
			e["jumpWind"] = windup
			e["jumpBuf"] = 0.0
		else:
			vel[2] = jump_v
			e["grounded"] = false
			e["coyote"] = coyote_t
			e["jumpBuf"] = 0.0
			jumped = true
	if float(e.get("jumpWind", 0.0)) > 0.0:
		e["jumpWind"] = float(e["jumpWind"]) - dt
		e["gaitPhase"] = (1.0 - maxf(0.0, float(e["jumpWind"])) / windup) * 0.9
		if float(e["jumpWind"]) <= 0.0:
			e["jumpWind"] = 0.0
			vel[2] = jump_v
			e["grounded"] = false
			e["coyote"] = coyote_t
			jumped = true
	var air_jumps := _num(r, "airJumps", 0.0)
	if air_jumps > 0.0:
		if e["grounded"]:
			e["airJumpsUsed"] = 0.0
		elif _in(input, "jump") != 0.0 and not jumped and not (float(e.get("jumpWind", 0.0)) > 0.0) and float(e["coyote"]) >= coyote_t and float(e.get("airJumpsUsed", 0.0)) < air_jumps:
			vel[2] = jump_v * _num(r, "airJumpMult", 0.9)
			e["airJumpsUsed"] = float(e.get("airJumpsUsed", 0.0)) + 1.0
			e["jumpBuf"] = 0.0
			jumped = true
	if float(vel[2]) > 0.0 and _in(input, "jumpHeld") == 0.0 and not e.get("launchedBy"):
		vel[2] = minf(float(vel[2]), cut_v)
	if jumped:
		e["jumpPower"] = 0.2

	# boost (F held): the dash at boostSpeed along the held direction (plain F: forward), while its gauge lasts
	var boost_available: bool = not has_gauge or (float(e["boost"]) > 1e-6 and not e.get("boostLock", false))
	if _in(input, "boost") == 0.0:
		e["boostCut"] = false
	var boosting: bool = _in(input, "boost") != 0.0 and boost_available and not e.get("boostCut", false)
	e["boosting"] = boosting
	var bf := fwd_in if boosting else 0.0
	var bs := side_in if boosting else 0.0
	if boosting and absf(bf) + absf(bs) < 1e-3:
		bf = 1.0
	var bn := _hypot(bf, bs)
	if bn == 0.0:
		bn = 1.0
	var fwd_move := ((bf / bn) * boost_speed * ctl * dt if boosting else fwd_in * speed * ctl * dt) * halt
	var side_move := ((bs / bn) * boost_speed * ctl * dt if boosting else side_in * strafe * speed * ctl * dt) * halt
	p[0] = float(p[0]) + (f[0] * fwd_move + rt[0] * side_move)
	p[1] = float(p[1]) + (f[1] * fwd_move + rt[1] * side_move)

	if world.get("colliders") is Array:
		resolve_blocking(p, foot_z, _num(r, "collideHeight", eye if eye != 0.0 else 24.0), _num(r, "collideRadius", 0.0), world["colliders"], step_up)
	if lane_move:
		var L := lane_near(lane, p[0], p[1])
		p[0] = L["px"]
		p[1] = L["py"]

	e["hovering"] = false
	var foot_z0 := float(p[2]) - eye
	var glide := _num(r, "glideFall", 0.0)
	var fall_cap := minf(max_fall, glide) if (glide > 0.0 and _in(input, "jumpHeld") != 0.0 and float(vel[2]) <= 0.0) else max_fall
	vel[2] = maxf(-fall_cap, float(vel[2]) - (rise_g if float(vel[2]) > 0.0 else fall_g) * dt)
	p[2] = float(p[2]) + float(vel[2]) * dt
	var gz1 := ground_at(g, [p[0], p[1], maxf(foot_z0, float(p[2]) - eye) + step_up])
	if not is_nan(gz1) and float(vel[2]) <= 0.0 and float(p[2]) - eye <= gz1 + 1e-4:
		p[2] = gz1 + eye
		vel[2] = 0.0
		e["coyote"] = 0.0
		e["grounded"] = true
		if float(e["jumpBuf"]) > 0.0:
			vel[2] = jump_v
			e["grounded"] = false
			e["jumpBuf"] = 0.0
	elif float(vel[2]) <= 0.0 and not e["grounded"] and g is Dictionary:
		var foot_now := float(p[2]) - eye
		var climb_up := _num(r, "collideHeight", eye if eye != 0.0 else 24.0)
		var head := ground_at(g, [p[0], p[1], foot_now + climb_up])
		if not is_nan(head) and head > foot_now + 1e-4 and head <= foot_now + climb_up + 1e-4:
			p[2] = head + eye
			vel[2] = 0.0
			e["grounded"] = true
	e["hoverGrace"] = maxf(0.0, float(e.get("hoverGrace", 0.0)) - dt)

	e["jumped"] = jumped
	e["landed"] = landed_edge
	var stride_len := _num(r, "stride", 2.4)
	var boost_clip := ("boost_right" if bs > 0.0 else "boost_left") if absf(bs) > absf(bf) else ("boost_back" if bf < 0.0 else "boost")
	var boost_phase := (side_move if absf(side_move) > absf(fwd_move) else fwd_move) / stride_len
	if not e["grounded"]:
		if boosting:
			e["locomotion"] = boost_clip
			e["gaitPhase"] = float(e.get("gaitPhase", 0.0)) + boost_phase
		elif fwd_in > 0.0:
			e["locomotion"] = "boost"
			e["gaitPhase"] = float(e.get("gaitPhase", 0.0)) + fwd_move / stride_len
		else:
			e["locomotion"] = "leap"
		e["moving"] = true
	elif float(e.get("jumpWind", 0.0)) > 0.0:
		e["locomotion"] = "squat"
		e["moving"] = true
	elif boosting:
		e["locomotion"] = boost_clip
		e["gaitPhase"] = float(e.get("gaitPhase", 0.0)) + boost_phase
		e["moving"] = true
	elif absf(fwd_move) + absf(side_move) < 1e-6 and absf(turn_amt) > _num(r, "turnStepMin", 0.0025):
		e["locomotion"] = "turn"
		e["gaitPhase"] = float(e.get("gaitPhase", 0.0)) + turn_amt / _num(r, "turnStride", 0.6)
		e["moving"] = true
	elif absf(side_move) > absf(fwd_move):
		e["locomotion"] = "strafe"
		e["gaitPhase"] = float(e.get("gaitPhase", 0.0)) + side_move / stride_len
		e["moving"] = absf(fwd_move) + absf(side_move) > 1e-6
	else:
		e["locomotion"] = "forward"
		e["gaitPhase"] = float(e.get("gaitPhase", 0.0)) + fwd_move / stride_len
		e["moving"] = absf(fwd_move) + absf(side_move) > 1e-6

	# the gauge: a jump bites, the thrust drains a unit a second, a flip of the dash's direction bites; cold, it refills
	if has_gauge:
		if jumped:
			e["boost"] = maxf(0.0, float(e["boost"]) - _num(r, "jumpBoostCost", 0.8))
		if boosting:
			e["boost"] = maxf(0.0, float(e["boost"]) - dt)
			var turn_cost := _num(r, "boostTurnCost", 0.75)
			if turn_cost > 0.0 and e.get("boostDir") != null and e["boostDir"] != boost_clip:
				e["boost"] = maxf(0.0, float(e["boost"]) - turn_cost)
			e["boostDir"] = boost_clip
		else:
			e["boostDir"] = null
			var rr := _num(r, "overheatRegen", boost_max / 7.5) if e.get("boostLock", false) else _num(r, "boostRegen", boost_max / 5.0)
			e["boost"] = minf(boost_max, float(e["boost"]) + rr * dt)
		if float(e["boost"]) <= 1e-6:
			e["boostLock"] = true
		elif e.get("boostLock", false) and float(e["boost"]) >= boost_max * _num(r, "boostUnlockFrac", 1.0):
			e["boostLock"] = false


# ── the camera rules (rules-basic.js follow, eye, overhead, side, fixed), stepped after the pilot as the web's world
# steps its camera last. A camera is a Dictionary: pos, heading, pitch, lookAt (an [x, y, z] or null: aim along heading
# and pitch), and its rule's state. `tgt` is the target entity (the pilot); `tgt_rule` its rule (a side camera reads its
# lane). A follow camera's cinematic and lock tracking are the web's (godot-marks.js CAMERA_LOST).
static func smooth(rate: float, dt: float) -> float:
	return 1.0 - exp(-maxf(0.0, rate) * dt)


static func camera(pos: Array, heading: float) -> Dictionary:
	return {"pos": [float(pos[0]), float(pos[1]), float(pos[2])], "heading": heading, "pitch": 0.0, "lookAt": null}


# `by_id`: the level's characters ({ pos, heading, gone }) by id, the pilot among them, for a directing shot; `pilot` its id
static func camera_step(c: Dictionary, r: Dictionary, tgt: Dictionary, tgt_rule: Dictionary, dt: float, world: Dictionary, by_id := {}, pilot := "") -> void:
	match String(r.get("type", "")):
		"shot":
			_shot(c, r, dt, world, by_id, pilot)
		"follow":
			_follow(c, r, tgt, dt)
		"eye":
			var p: Array = tgt["pos"]
			c["pos"] = [p[0], p[1], float(p[2]) + _num(r, "height", 0.0)]
			c["heading"] = tgt["heading"]
			c["pitch"] = float(tgt.get("pitch", 0.0))
			c["lookAt"] = null
		"overhead":
			_overhead(c, r, tgt, dt)
		"side":
			_side(c, r, tgt, tgt_rule, dt)
		"fixed":
			_fixed(c, r, tgt)


static func _ease_to(c: Dictionary, want: Array, k: float) -> void:
	var p: Array = c["pos"]
	c["pos"] = [float(p[0]) + (want[0] - float(p[0])) * k, float(p[1]) + (want[1] - float(p[1])) * k, float(p[2]) + (want[2] - float(p[2])) * k]


static func _follow(c: Dictionary, r: Dictionary, tgt: Dictionary, dt: float) -> void:
	var dist := _num(r, "dist", 6.0)
	var height := _num(r, "height", 3.0)
	var shoulder := _num(r, "shoulder", 0.0)
	var lead := _num(r, "lead", 4.0)
	var look_h := _num(r, "lookH", 1.5)
	var want_flip := 1.0 if r.get("reverse") else 0.0
	if c.get("flipMix") == null:
		c["flipMix"] = want_flip
	c["flipMix"] = float(c["flipMix"]) + (want_flip - float(c["flipMix"])) * smooth(_num(r, "flipRate", 3.0), dt)
	var h := float(tgt["heading"]) + PI * float(c["flipMix"])
	var f := fwd_xy(h)
	var rt := right_xy(h)
	var pf := _num(r, "pitchFollow", 1.0)
	var pp := float(tgt.get("pitch", 0.0)) * pf * (-1.0 if float(c["flipMix"]) > 0.5 else 1.0)
	var cp := cos(pp)
	var sp := sin(pp)
	var tp: Array = tgt["pos"]
	var want := [float(tp[0]) - f[0] * dist * cp + rt[0] * shoulder, float(tp[1]) - f[1] * dist * cp + rt[1] * shoulder, float(tp[2]) + height - dist * sp]
	_ease_to(c, want, smooth(_num(r, "lerp", 8.0), dt))
	c["lookAt"] = [float(tp[0]) + f[0] * lead * cp, float(tp[1]) + f[1] * lead * cp, float(tp[2]) + look_h + lead * sp]


static func _overhead(c: Dictionary, r: Dictionary, tgt: Dictionary, dt: float) -> void:
	var yaw := _num(r, "yaw", HALF_PI)
	var tilt := clampf(_num(r, "tilt", PI / 3.0), 0.2, 1.45)
	var dist := _num(r, "dist", 14.0)
	var look_h := _num(r, "lookH", 1.0)
	var f := fwd_xy(yaw)
	var co := cos(tilt)
	var si := sin(tilt)
	var p: Array = tgt["pos"]
	_ease_to(c, [float(p[0]) - f[0] * dist * co, float(p[1]) - f[1] * dist * co, float(p[2]) + look_h + dist * si], smooth(_num(r, "lerp", 8.0), dt))
	c["heading"] = yaw
	c["lookAt"] = [p[0], p[1], float(p[2]) + look_h]


static func _side(c: Dictionary, r: Dictionary, tgt: Dictionary, tgt_rule: Dictionary, dt: float) -> void:
	var p: Array = tgt["pos"]
	var lane = tgt_rule.get("lane")
	var want := _num(r, "yaw", HALF_PI)
	if lane is Array and lane.size() >= 2:
		var L := lane_near(lane, p[0], p[1])
		want = atan2(L["ty"], L["tx"]) + HALF_PI
	if c.get("_sideYaw") == null:
		c["_sideYaw"] = want
	var d := fmod(fmod(want - float(c["_sideYaw"]) + PI, TAU) + TAU, TAU) - PI
	c["_sideYaw"] = float(c["_sideYaw"]) + d * smooth(_num(r, "turnLerp", 2.5), dt)
	var yaw := float(c["_sideYaw"])
	var tilt := clampf(_num(r, "tilt", 0.2), 0.0, 1.2)
	var dist := _num(r, "dist", 11.0)
	var look_h := _num(r, "lookH", 1.2)
	var f := fwd_xy(yaw)
	var co := cos(tilt)
	var si := sin(tilt)
	_ease_to(c, [float(p[0]) - f[0] * dist * co, float(p[1]) - f[1] * dist * co, float(p[2]) + look_h + dist * si], smooth(_num(r, "lerp", 8.0), dt))
	c["heading"] = yaw
	c["lookAt"] = [p[0], p[1], float(p[2]) + look_h]


static func _fixed(c: Dictionary, r: Dictionary, tgt: Dictionary) -> void:
	var S = r.get("stations")
	if not (S is Array) or S.is_empty():
		return
	var p: Array = tgt["pos"]
	var d := func(s) -> float: return _hypot(float(s["focus"][0]) - float(p[0]), float(s["focus"][1]) - float(p[1]))
	var at = c.get("_fixedAt")
	var k: int = int(at) if (at != null and int(at) < S.size()) else 0
	for i in S.size():
		if d.call(S[i]) < d.call(S[k]) - (0.0 if i == k else _num(r, "hold", 1.5)):
			k = i
	if at == null:
		k = 0
		for i in range(1, S.size()):
			if d.call(S[i]) < d.call(S[k]):
				k = i
	c["_fixedAt"] = k
	var st: Dictionary = S[k]
	var u := _num(r, "track", 0.6)
	var look_h := _num(r, "lookH", 1.0)
	var fo: Array = st["focus"]
	var fz: float = float(fo[2]) if (fo.size() > 2 and (fo[2] is float or fo[2] is int)) else float(p[2])
	c["lookAt"] = [float(fo[0]) + (float(p[0]) - float(fo[0])) * u, float(fo[1]) + (float(p[1]) - float(fo[1])) * u, fz + (float(p[2]) - fz) * u + look_h]
	c["pos"] = (st["at"] as Array).map(func(v): return float(v))
	c["heading"] = atan2(float(c["lookAt"][1]) - float(st["at"][1]), float(c["lookAt"][0]) - float(st["at"][0]))



# the nearest of the land's triangles along a ray from `from` (direction `dir`, unit) within `far`; `far` when none (the
# page's chase camera pull-in casts its ray at the level's meshes, as this casts it at the faces the ground stands on)
static func ray_land(g, from: Array, dir: Array, far: float) -> float:
	if not (g is Dictionary) or far <= 0.0:
		return far
	var seen := {}
	var best := far
	var o := Vector3(float(from[0]), float(from[1]), float(from[2]))
	var dv := Vector3(float(dir[0]), float(dir[1]), float(dir[2]))
	var steps := int(ceil(far / (CELL * 0.5))) + 1
	for s in steps + 1:
		var q := o + dv * minf(far, s * CELL * 0.5)
		var list = g["grid"].get("%d,%d" % [int(floor(q.x / CELL)), int(floor(q.y / CELL))])
		if list == null:
			continue
		for k in list:
			if seen.has(k):
				continue
			seen[k] = true
			var t: Array = g["tris"][k]
			var a := Vector3(t[0][0], t[0][1], t[0][2])
			var hit = Geometry3D.ray_intersects_triangle(o, dv, a, Vector3(t[1][0], t[1][1], t[1][2]), Vector3(t[2][0], t[2][1], t[2][2]))
			if hit is Vector3:
				best = minf(best, o.distance_to(hit))
	return best



# ── shot — the DIRECTING camera (the scene layer, rules-basic.js shot): it frames the characters `on` and the places
# `at` by a word (`frame`), opening until they fill a `fov`, never under the ground; `move` holds, tracks, pushes or
# orbits; a new shot cuts (the cast op `shot` resets its state: kernel/walker.gd set_shot). Its clear-view search
# samples the land along the line to the subjects, as the page's.
const FRAMES := {"wide": [5.0, 2.2, 0.0], "low": [1.6, -0.8, 0.0], "profile": [1.2, 0.2, 1.0], "corner": [3.0, 3.5, 0.5], "overhead": [2.5, 0.0, 0.0], "two": [0.8, 0.35, 0.0], "close": [0.35, 0.1, 0.25]}


static func _top(world: Dictionary, x: float, y: float) -> float:
	return ground_at(world.get("ground"), [x, y, 1e4])


static func _shot(c: Dictionary, r: Dictionary, dt: float, world: Dictionary, by_id: Dictionary, pilot: String) -> void:
	var subs := []
	for id in (r.get("on") if r.get("on") is Array else []):
		var s = by_id.get(String(id))
		if s is Dictionary and not s.get("gone", false):
			subs.append({"pos": s["pos"], "heading": s.get("heading"), "place": false})
	for p in (r.get("at") if r.get("at") is Array else []):
		var z = p[2] if p.size() > 2 and p[2] != null else null
		if z == null:
			var g := _top(world, float(p[0]), float(p[1]))
			z = 0.0 if is_nan(g) else g
		subs.append({"pos": [float(p[0]), float(p[1]), float(z)], "heading": null, "place": true})
	if subs.is_empty():
		return
	var cx := 0.0
	var cy := 0.0
	var cz := 0.0
	for s in subs:
		cx += float(s["pos"][0])
		cy += float(s["pos"][1])
		cz += float(s["pos"][2])
	cx /= subs.size()
	cy /= subs.size()
	cz = cz / subs.size() + _num(r, "lookH", 1.4)
	var spread := 0.0
	for s in subs:
		spread = maxf(spread, _hypot(float(s["pos"][0]) - cx, float(s["pos"][1]) - cy))
	c["_shotT"] = float(c.get("_shotT", 0.0)) + dt
	var lerp := _num(r, "lerp", 3.0)
	if r.get("frame") == "over" and subs.size() >= 2:
		var A: Array = subs[0]["pos"]
		var B: Array = subs[1]["pos"]
		var side := _num(r, "side", 1.0)
		var lh := _num(r, "lookH", 1.4)
		var yaw := atan2(float(B[1]) - float(A[1]), float(B[0]) - float(A[0]))
		var f := fwd_xy(yaw)
		var rt := right_xy(yaw)
		var at := [float(B[0]) + f[0] * 1.1 + rt[0] * 0.45 * side, float(B[1]) + f[1] * 1.1 + rt[1] * 0.45 * side, float(B[2]) + lh + 0.15]
		_shot_place(c, at, lerp, dt)
		c["_shotAt"] = at
		c["heading"] = yaw + PI
		c["lookAt"] = [A[0], A[1], float(A[2]) + lh]
		return
	var fr: Array = FRAMES.get(String(r.get("frame", "")), FRAMES["wide"])
	var room: float = fr[0]
	var rise: float = fr[1]
	var off: float = fr[2]
	if r.get("side") == null and c.get("_shotSide") == null and subs.size() >= 2:
		var a: Array = subs[0]["pos"]
		var b: Array = subs[1]["pos"]
		var u := atan2(float(b[1]) - float(a[1]), float(b[0]) - float(a[0])) - HALF_PI
		var to_cam := (float(c["pos"][0]) - cx) * cos(u) + (float(c["pos"][1]) - cy) * sin(u)
		c["_shotSide"] = 1.0 if to_cam >= 0.0 else -1.0
	var side: float = _num(r, "side", float(c["_shotSide"]) if c.get("_shotSide") != null else 1.0)
	var face := 0.0
	if subs.size() >= 2:
		var a: Array = subs[0]["pos"]
		var b: Array = subs[1]["pos"]
		face = atan2(float(b[1]) - float(a[1]), float(b[0]) - float(a[0])) - HALF_PI * side
	elif subs[0]["place"]:
		# a lone place: the pilot's view of it, from just behind and above the pilot
		var P = by_id.get(pilot)
		if P is Dictionary and r.get("frame") != "overhead":
			var p: Array = P["pos"]
			var a: Array = subs[0]["pos"]
			var yaw := atan2(float(a[1]) - float(p[1]), float(a[0]) - float(p[0]))
			var f := fwd_xy(yaw)
			var at := [float(p[0]) - f[0] * 3.0, float(p[1]) - f[1] * 3.0, float(p[2]) + 2.4]
			_shot_place(c, at, lerp, dt)
			c["_shotAt"] = at
			c["heading"] = yaw
			c["lookAt"] = [a[0], a[1], float(a[2]) + _num(r, "lookH", 1.4)]
			return
		face = 0.0
	else:
		var h = subs[0]["heading"]
		face = float(h) if (h is float or h is int) else 0.0
	var yaw := _num(r, "yaw", face) + off * HALF_PI * side
	if r.get("move") == "orbit":
		yaw += _num(r, "rate", 0.25) * float(c["_shotT"])
	var dist := maxf(1.2, (spread + room) / tan((_num(r, "fov", 50.0) * PI) / 360.0))
	if r.get("move") == "push":
		dist *= 1.0 + 0.35 * (1.0 - minf(1.0, float(c["_shotT"]) / _num(r, "for", 3.0)))
	var overhead: bool = r.get("frame") == "overhead"
	var place := func(y: float, lift: float) -> Array:
		var f := fwd_xy(y)
		var at := [cx + f[0] * dist * 0.3, cy + f[1] * dist * 0.3, cz + dist] if overhead else [cx + f[0] * dist, cy + f[1] * dist, cz + rise + lift]
		var g := _top(world, at[0], at[1])
		if not is_nan(g) and at[2] < g + 0.8:
			at[2] = g + 0.8
		return at
	if c.get("_shotTry") == null:
		c["_shotTry"] = [0.0, 0.0]
		if world.get("ground") is Dictionary:
			var found := false
			for lift in [0.0, 1.5, 3.5]:
				for dy in [0.0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2]:
					var at: Array = place.call(yaw + dy, lift)
					var clear := true
					for k in range(1, 8):
						var u := k / 8.0
						var x: float = at[0] + (cx - at[0]) * u
						var y: float = at[1] + (cy - at[1]) * u
						var z: float = at[2] + (cz - at[2]) * u
						var g := _top(world, x, y)
						if not is_nan(g) and g > z - 0.3:
							clear = false
							break
					if clear:
						c["_shotTry"] = [dy, lift]
						found = true
						break
				if found:
					break
	var at: Array = place.call(yaw + float(c["_shotTry"][0]), float(c["_shotTry"][1]))
	if c.get("_shotAt") == null or (_truthy(r.get("move")) and r.get("move") != "hold"):
		c["_shotAt"] = at
	if c.get("_shotCut", false):
		c["pos"] = (c["_shotAt"] as Array).duplicate()
		c["_shotCut"] = false
	else:
		_ease_to(c, c["_shotAt"], smooth(lerp, dt))
	c["heading"] = atan2(cy - float(c["pos"][1]), cx - float(c["pos"][0]))
	c["lookAt"] = [cx, cy, cz]


static func _truthy(v) -> bool:
	if v == null:
		return false
	if v is bool:
		return v
	if v is String:
		return v != ""
	if v is float:
		return v != 0.0 and not is_nan(v)
	if v is int:
		return v != 0
	return true


# a cut lands at once; else the camera eases in at `lerp` (the over and lone-place shots set their own _shotAt after)
static func _shot_place(c: Dictionary, at: Array, lerp: float, dt: float) -> void:
	if c.get("_shotCut", false) or c.get("_shotAt") == null:
		c["pos"] = at.duplicate()
		c["_shotCut"] = false
	else:
		_ease_to(c, at, smooth(lerp, dt))


# the cast op `shot`: the camera's rule held aside for a directing shot (its state reset; a cut unless `cut: false`);
# `unshot` hands the held rule back. → the rule now in force
static func set_shot(c: Dictionary, current: Dictionary, shot) -> Dictionary:
	if not c.has("heldRule") or c["heldRule"] == null:
		c["heldRule"] = current
	c["_shotT"] = 0.0
	c["_shotAt"] = null
	c["_shotSide"] = null
	c["_shotTry"] = null
	c["_shotCut"] = not (shot is Dictionary and shot.get("cut") == false)
	var r: Dictionary = (shot as Dictionary).duplicate(true)
	r["type"] = "shot"
	return r


static func unshot(c: Dictionary, current: Dictionary) -> Dictionary:
	var held = c.get("heldRule")
	if held is Dictionary:
		c["heldRule"] = null
		return held
	return current



# ── drive — a designed vehicle you board and drive (rules-drive.js) ─────────────────────────────────────────────────
const G := 9.81


static func _pos_num(r: Dictionary, k: String, dflt: float) -> float:
	var v = r.get(k)
	return float(v) if (v is float or v is int) and float(v) > 0.0 else dflt


static func drive(e: Dictionary, r: Dictionary, input: Dictionary, dt: float, world: Dictionary) -> void:
	var p: Array = e["pos"]
	var mass := _pos_num(r, "mass", 1400.0)
	var power_n := _pos_num(r, "horsepower", 130.0) * 745.7
	var S = world["surface"].call(p) if (_truthy(r.get("surfaceGrip")) and world.get("surface") is Callable) else null
	var soft := _pos_num(r, "surfaceSoft", 1.0)
	var grip := _pos_num(r, "grip", 1.0) * ((1.0 - (1.0 - float(S["mu"])) * soft) if S != null else 1.0) * _pos_num(r, "muScale", 1.0)
	var traction_cap := grip * mass * G * _pos_num(r, "drivenShare", 1.0)
	var brake0 := _pos_num(r, "brakeForce", mass * G * 0.8)
	var brake_force := minf(brake0, grip * mass * G * float(r["brakeEff"])) if _pos_num(r, "brakeEff", 0.0) > 0.0 else brake0
	var drag_k := _num(r, "drag", 0.42)
	var roll_force := _num(r, "rollResist", 0.015) * mass * G * ((1.0 + (float(S["roll"]) - 1.0) * soft) if S != null else 1.0)
	var airborne: bool = _truthy(r.get("air")) and _truthy(e.get("airborne"))
	var wheelbase := _pos_num(r, "wheelbase", 2.8)
	var wheel_r := _pos_num(r, "wheelRadius", 0.33)
	var reverse_speed := _pos_num(r, "reverseSpeed", 6.0)
	var steer_max := _num(r, "steerMax", 0.55)
	var steer_speed := _num(r, "steerSpeed", 2.5)
	var v_floor := _pos_num(r, "vFloor", 2.0)
	var eye := _num(r, "eye", 0.0)
	var v := float(e.get("speed", 0.0))
	var throttle := clampf(_in(input, "forward"), 0.0, 1.0)
	var brake_in := clampf(-_in(input, "forward"), 0.0, 1.0)
	var F := 0.0
	var braking := false
	if airborne:
		pass
	elif throttle > 0.0:
		if v >= -1e-3:
			F = minf(power_n / maxf(absf(v), v_floor), traction_cap) * throttle
		else:
			F = brake_force * throttle
			braking = true
	elif brake_in > 0.0:
		if v > 1e-3:
			F = -brake_force * brake_in
			braking = true
		else:
			F = -minf(power_n / maxf(absf(v), v_floor), traction_cap) * brake_in
	var resist := drag_k * v * absf(v) + (roll_force * signf(v) if (not airborne and absf(v) > 1e-3) else 0.0)
	var v0 := v
	v += ((F - resist) / mass) * dt
	if F == 0.0 and v0 != 0.0 and signf(v) != signf(v0):
		v = 0.0
	if F == 0.0 and absf(v) < 0.15:
		v = 0.0
	v = clampf(v, -reverse_speed, _pos_num(r, "topSpeed", INF))
	var eff_max := steer_max / (1.0 + absf(v) * _num(r, "steerTighten", 0.03))
	if _truthy(r.get("lateralGrip")) and absf(v) > 1.0:
		eff_max = minf(eff_max, atan((grip * G * wheelbase) / (v * v)))
	var steer_target := clampf(-_in(input, "turn"), -1.0, 1.0) * eff_max
	var sa := float(e.get("steerAngle", 0.0))
	e["steerAngle"] = sa + clampf(steer_target - sa, -steer_speed * dt, steer_speed * dt)
	if not airborne:
		e["heading"] = fmod(float(e["heading"]) + (v / wheelbase) * tan(float(e["steerAngle"])) * dt, TAU)
	var f := fwd_xy(float(e["heading"]))
	p[0] = float(p[0]) + f[0] * v * dt
	p[1] = float(p[1]) + f[1] * v * dt
	if world.get("colliders") is Array:
		resolve_blocking(p, float(p[2]) - eye, _num(r, "collideHeight", 3.0), _num(r, "collideRadius", 0.0), world["colliders"], _num(r, "step", 0.3))
	var gz := ground_at(world.get("ground"), [p[0], p[1], (float(p[2]) - eye) + _num(r, "collideHeight", 3.0)])
	if not is_nan(gz) and _truthy(r.get("air")):
		v = _drive_fly(e, r, gz + eye, v, f, dt, world)
	elif not is_nan(gz):
		var want := gz + eye
		if want < float(p[2]):
			p[2] = maxf(want, float(p[2]) - _num(r, "fallRate", 25.0) * dt)
		else:
			p[2] = want
	e["speed"] = v
	e["wheelPhase"] = float(e.get("wheelPhase", 0.0)) + v * dt / (TAU * wheel_r)
	e["wheelSpin"] = v / (TAU * wheel_r)
	e["throttle"] = throttle
	e["brakeStart"] = braking and not _truthy(e.get("braking"))
	e["braking"] = braking
	var lat := (v * v * absf(tan(float(e["steerAngle"])))) / wheelbase
	var skid := lat > grip * G
	e["skidStart"] = skid and not _truthy(e.get("skidding"))
	e["skidding"] = skid
	e["boarded"] = not _truthy(e.get("_driven"))
	e["_driven"] = true
	e["locomotion"] = "drive"
	e["gaitPhase"] = e["wheelPhase"]
	e["moving"] = absf(v) > 1e-3
	if r.get("wheels") == 2 or r.get("wheels") == 2.0:
		e["lean"] = atan((v * v * tan(float(e["steerAngle"]))) / (wheelbase * G))


# FLIGHT (opt-in `air`): off a ramp's lip or a crest the ground falls away faster than gravity takes the car; it flies
# ballistic and lands keeping the speed along the landing. → the speed after
static func _drive_fly(e: Dictionary, r: Dictionary, want: float, v: float, f: Array, dt: float, world: Dictionary) -> float:
	var p: Array = e["pos"]
	var z0 := float(p[2])
	var vz := float(e.get("vz", 0.0))
	var ballistic := z0 + vz * dt - 0.5 * G * dt * dt
	var eye := _num(r, "eye", 0.0)
	var top := want - eye + _num(r, "collideHeight", 3.0)
	var dir := -1.0 if v < 0.0 else 1.0
	var sp := absf(v)
	var g = world.get("ground")
	var g_at := func(d: float) -> float:
		var z := ground_at(g, [float(p[0]) + f[0] * d * dir, float(p[1]) + f[1] * d * dir, top])
		return NAN if is_nan(z) else z + eye
	e["landed"] = false
	if _truthy(e.get("airborne")):
		e["vz"] = vz - G * dt
		e["airT"] = float(e.get("airT", 0.0)) + dt
		if ballistic > want:
			p[2] = ballistic
			return v
		var ahead: float = g_at.call(1.0)
		var slope := 0.0 if is_nan(ahead) else ahead - want
		var keep := maxf(cos(atan2(vz, sp) - atan(slope)), _pos_num(r, "landKeep", 0.0))
		p[2] = want
		e["airborne"] = false
		e["landed"] = true
		e["airTime"] = e["airT"]
		e["landLoss"] = 1.0 - keep
		e["vz"] = sp * keep * slope
		e["vzs"] = e["vz"]
		return v * keep
	var b2: float = g_at.call(-0.2)
	var b1: float = g_at.call(-1.0)
	var vz_lip := sp * (want - b2) / 0.2 if not is_nan(b2) else (want - z0) / dt
	var vz_s := sp * (want - b1) if not is_nan(b1) else vz_lip
	var az := 0.0 if e.get("vzs") == null else (vz_s - float(e["vzs"])) / dt
	if want < ballistic - 0.003 and sp > 1.0:
		var on_ramp := func(d: float) -> bool:
			var a: float = g_at.call(d)
			var b: float = g_at.call(d - 0.05)
			return not is_nan(a) and not is_nan(b) and a - b > -0.02
		var lo := -sp * dt - 0.05
		var hi := 0.0
		if on_ramp.call(lo):
			for k in 10:
				var m := (lo + hi) / 2.0
				if on_ramp.call(m):
					lo = m
				else:
					hi = m
			var za: float = g_at.call(lo - 0.03)
			var zb: float = g_at.call(lo - 0.23)
			var slope := (za - zb) / 0.2 if (not is_nan(za) and not is_nan(zb)) else vz / sp
			var zl := (want if is_nan(za) else za) + slope * 0.03
			var vzl := clampf(sp * slope, -50.0, sp * 0.8)
			var tau := -lo / sp
			p[2] = maxf(zl + vzl * tau - 0.5 * G * tau * tau, want)
			e["vz"] = vzl - G * tau
		else:
			p[2] = maxf(ballistic, want)
			e["vz"] = vz - G * dt
		e["airborne"] = true
		e["airT"] = 0.0
		e["vzs"] = null
		return v
	if az < -G:
		p[2] = maxf(ballistic, want)
		e["airborne"] = true
		e["airT"] = 0.0
		e["vz"] = vz - G * dt
		e["vzs"] = null
		return v
	e["vz"] = clampf(vz_lip, -50.0, sp * 0.8)
	e["vzs"] = vz_s
	p[2] = want
	return v


# ── racer — a driver no one pilots: the same drive, its stick moved by the road ahead (rules-drive.js racer) ─────────
static func _line_at(L: Array, closed: bool, i: int) -> Array:
	var n := L.size()
	return L[((i % n) + n) % n] if closed else L[mini(i, n - 1)]


static func racer(e: Dictionary, r: Dictionary, dt: float, world: Dictionary) -> void:
	var L: Array = r.get("line") if r.get("line") is Array else []
	var n := L.size()
	if n == 0 or world.get("aiEnabled", true) == false:
		drive(e, r, {"forward": 0.0, "turn": 0.0}, dt, world)
		return
	var closed := _truthy(r.get("closed"))
	var p: Array = e["pos"]
	if e.get("lineAt") == null:
		var best := 0
		var bd := INF
		for i in n:
			var d := _hypot(float(L[i][0]) - float(p[0]), float(L[i][1]) - float(p[1]))
			if d < bd:
				bd = d
				best = i
		var f := fwd_xy(float(e["heading"]))
		var q: Array = L[best]
		e["lineAt"] = best + 1 if (float(q[0]) - float(p[0])) * f[0] + (float(q[1]) - float(p[1])) * f[1] < 0.0 else best
		e["laps"] = 0
		e["stuckT"] = 0.0
		e["backT"] = 0.0
	var reach := _pos_num(r, "reach", 4.0)
	for k in n:
		var pt := _line_at(L, closed, int(e["lineAt"]))
		var nx := _line_at(L, closed, int(e["lineAt"]) + 1)
		var d := _hypot(float(pt[0]) - float(p[0]), float(pt[1]) - float(p[1]))
		var passed := (float(p[0]) - float(pt[0])) * (float(nx[0]) - float(pt[0])) + (float(p[1]) - float(pt[1])) * (float(nx[1]) - float(pt[1])) > 0.0
		if not (d < reach or (passed and d < reach * 3.0)):
			break
		if not closed and int(e["lineAt"]) >= n - 1:
			break
		e["lineAt"] = int(e["lineAt"]) + 1
		if closed and int(e["lineAt"]) % n == 0:
			e["laps"] = int(e["laps"]) + 1
	var look := int(_pos_num(r, "look", 3.0))
	var a := _line_at(L, closed, int(e["lineAt"]) + look - 1)
	var b := _line_at(L, closed, int(e["lineAt"]) + look)
	var dl := _hypot(float(b[0]) - float(a[0]), float(b[1]) - float(a[1]))
	if dl == 0.0:
		dl = 1.0
	var lane := _num(r, "lane", 0.0)
	var aim := [float(b[0]) - ((float(b[1]) - float(a[1])) / dl) * lane, float(b[1]) + ((float(b[0]) - float(a[0])) / dl) * lane]
	var err := atan2(aim[1] - float(p[1]), aim[0] - float(p[0])) - float(e["heading"])
	err = fmod(fmod(err + PI, TAU) + TAU, TAU) - PI
	var c := _line_at(L, closed, int(e["lineAt"]) + look * 2)
	var h1 := atan2(float(b[1]) - float(a[1]), float(b[0]) - float(a[0]))
	var h2 := atan2(float(c[1]) - float(b[1]), float(c[0]) - float(b[0]))
	var bend := absf(fmod(fmod(h2 - h1 + PI, TAU) + TAU, TAU) - PI)
	var v := float(e.get("speed", 0.0))
	var pace := _pos_num(r, "pace", 1.0)
	var corner := _pos_num(r, "corner", 9.0)
	var forward := pace
	if bend > 0.25 and v > corner / bend:
		forward = -0.6
	elif absf(err) > 0.6 and v > corner:
		forward = 0.0
	if _truthy(r.get("lateralGrip")):
		var Sg = world["surface"].call(p) if (_truthy(r.get("surfaceGrip")) and world.get("surface") is Callable) else null
		var mu := _pos_num(r, "grip", 1.0) * _pos_num(r, "muScale", 1.0) * (float(Sg["mu"]) if Sg != null else 1.0) * 0.9
		var aB := mu * G * _pos_num(r, "brakeEff", 0.8)
		var want := INF
		var p_now := _line_at(L, closed, int(e["lineAt"]))
		var d := _hypot(float(p_now[0]) - float(p[0]), float(p_now[1]) - float(p[1]))
		var k := 0
		while k < 60 and d < (v * v) / (2.0 * aB) + 30.0:
			var p0 := _line_at(L, closed, int(e["lineAt"]) + k - 2)
			var p1 := _line_at(L, closed, int(e["lineAt"]) + k)
			var p2 := _line_at(L, closed, int(e["lineAt"]) + k + 2)
			var ab := _hypot(float(p1[0]) - float(p0[0]), float(p1[1]) - float(p0[1]))
			var bc := _hypot(float(p2[0]) - float(p1[0]), float(p2[1]) - float(p1[1]))
			var ac := _hypot(float(p2[0]) - float(p0[0]), float(p2[1]) - float(p0[1]))
			var kap := absf(2.0 * ((float(p1[0]) - float(p0[0])) * (float(p2[1]) - float(p1[1])) - (float(p1[1]) - float(p0[1])) * (float(p2[0]) - float(p1[0])))) / (ab * bc * ac) if (ab != 0.0 and bc != 0.0 and ac != 0.0) else 0.0
			if kap > 1e-4:
				want = minf(want, sqrt((mu * G) / kap + 2.0 * aB * d))
			var q := _line_at(L, closed, int(e["lineAt"]) + k + 1)
			d += _hypot(float(q[0]) - float(p1[0]), float(q[1]) - float(p1[1]))
			k += 1
		var to_aim := _hypot(aim[0] - float(p[0]), aim[1] - float(p[1]))
		if absf(err) > 0.35:
			want = minf(want, sqrt((mu * G * to_aim) / (2.0 * sin(minf(absf(err), PI / 2.0)))))
		forward = -1.0 if v > want else (0.0 if v > want * 0.97 else pace)
	if r.get("ramps") is Array:
		for q in r["ramps"]:
			var dx := float(q["at"][0]) - float(p[0])
			var dy := float(q["at"][1]) - float(p[1])
			var fw := fwd_xy(float(e["heading"]))
			var aim_v: float = (float(q["lo"]) + float(q["hi"])) / 2.0 if q.get("lo") != null else float(q["hi"])
			var reach_b := (v * v - aim_v * aim_v) / (2.0 * 6.0) + 15.0
			if dx * fw[0] + dy * fw[1] > 0.0 and _hypot(dx, dy) < maxf(15.0, reach_b) and v > aim_v:
				forward = minf(forward, -1.0 if v > aim_v + 0.4 else 0.0)
	if float(e["backT"]) > 0.0:
		e["backT"] = float(e["backT"]) - dt
		drive(e, r, {"forward": -1.0, "turn": clampf(err * 2.0, -1.0, 1.0)}, dt, world)
		return
	e["stuckT"] = float(e["stuckT"]) + dt if (forward > 0.0 and absf(v) < 0.5) else 0.0
	if float(e["stuckT"]) > 1.0:
		e["stuckT"] = 0.0
		e["backT"] = 1.0
	drive(e, r, {"forward": forward, "turn": clampf(-err * 2.5, -1.0, 1.0)}, dt, world)


# ── fly — fixed-wing flight (rules-fly.js) ──────────────────────────────────────────────────────────────────────────
static func fly(e: Dictionary, r: Dictionary, input: Dictionary, dt: float, world: Dictionary) -> void:
	var p: Array = e["pos"]
	var mass := _pos_num(r, "mass", 1200.0)
	# the flight dials (since 0.27.0, the web's skyscape: one flight model under every flight game); each absent, as it was
	var max_thrust := 0.0 if r.get("engine") == false else _pos_num(r, "thrust", mass * 6.0)
	var grav: bool = r.get("gravity") != false
	var lifts: bool = r.get("lift") != false
	var drag_k := _num(r, "drag", 0.6)
	var v_stall := _pos_num(r, "stallSpeed", 18.0)
	var v_takeoff := _pos_num(r, "takeoffSpeed", float(roundi(v_stall * 1.25)))
	var v_max := _pos_num(r, "maxSpeed", 80.0)
	var bank_max := _num(r, "bankMax", 1.0)
	var bank_rate := _num(r, "bankRate", 1.8)
	var level_rate := _num(r, "levelRate", 0.9)
	var pitch_max := _num(r, "pitchMax", 0.6)
	var pitch_rate := _num(r, "pitchRate", 1.1)
	var look_sens := _num(r, "lookSens", 0.0025)
	var eye := _num(r, "eye", 0.0)
	# launchSpeed: a craft that starts flying (a glider aloft)
	var v: float = float(e["airspeed"]) if e.get("airspeed") != null else (float(r["launchSpeed"]) if _truthy(r.get("launchSpeed")) else 0.0)
	var throttle := clampf(_in(input, "forward"), 0.0, 1.0)
	var brake_in := clampf(-_in(input, "forward"), 0.0, 1.0)
	if _truthy(r.get("lever")):
		# the lever: W / S move it and it stays; S held at idle is the brakes (on the ground, the wheels)
		var was: float = float(e["lever"]) if e.get("lever") != null else (float(r["leverStart"]) if _truthy(r.get("leverStart")) else 0.0)
		e["lever"] = clampf(was + _in(input, "forward") * _num(r, "leverRate", 0.6) * dt, 0.0, 1.0)
		throttle = float(e["lever"])
		brake_in = clampf(-_in(input, "forward"), 0.0, 1.0) if was <= 0.0 and _in(input, "forward") < 0.0 else 0.0
	var gz := ground_at(world.get("ground"), [p[0], p[1], (float(p[2]) - eye) + _num(r, "collideHeight", 3.0)]) if (grav or _truthy(r.get("space"))) else NAN
	var on_ground := not is_nan(gz) and float(p[2]) - eye <= gz + 0.05
	var was_airborne := _truthy(e.get("airborne"))
	# the boost (opt-in): input.boost held multiplies thrust while its charge lasts, refilled when let go
	var boost_mul := 1.0
	if _truthy(r.get("boost")):
		var B: Dictionary = r["boost"] if r["boost"] is Dictionary else {}
		var full := _num(B, "time", 3.0)
		if e.get("boostE") == null:
			e["boostE"] = full
		e["boosting"] = _truthy(input.get("boost")) and float(e["boostE"]) > 0.0 and max_thrust > 0.0
		if e["boosting"]:
			boost_mul = _num(B, "thrust", 2.0)
			e["boostE"] = maxf(0.0, float(e["boostE"]) - dt)
		else:
			e["boostE"] = minf(full, float(e["boostE"]) + _num(B, "recharge", 0.5) * dt)
	var force := max_thrust * throttle * boost_mul - drag_k * v * v
	if brake_in > 0.0:
		force -= (_num(r, "brakeDrag", drag_k * 5.0) * v * v + (_num(r, "wheelBrake", mass * G * 0.5) if on_ground else 0.0)) * brake_in
	var a := force / mass
	if not on_ground and grav:
		a -= G * sin(float(e.get("pitch", 0.0)))
	v = clampf(v + a * dt, 0.0, v_max)
	if on_ground and throttle == 0.0 and brake_in == 0.0 and v < 0.4:
		v = 0.0
	var bank_in := clampf(_in(input, "turn"), -1.0, 1.0)
	var lift_in := _in(input, "lift")
	# the bound: warned outside the map's reach, then turned back toward its centre
	if r.get("bound") is Dictionary:
		var Bd: Dictionary = r["bound"]
		var cx := _num0(Bd, "cx")
		var cy := _num0(Bd, "cy")
		var cz := _num0(Bd, "cz")
		var hz := _num0(Bd, "hz")
		var out: bool = absf(float(p[0]) - cx) > float(Bd["hx"]) or absf(float(p[1]) - cy) > float(Bd["hy"]) or (hz > 0.0 and absf(float(p[2]) - cz) > hz)
		e["boundT"] = (float(e.get("boundT", 0.0)) if _truthy(e.get("boundT")) else 0.0) + dt if out else 0.0
		e["outOfBounds"] = out
		if out and float(e["boundT"]) > _num(Bd, "warn", 5.0):
			var d := atan2(cy - float(p[1]), cx - float(p[0])) - float(e["heading"])
			d = fmod(fmod(d, TAU) + TAU + PI, TAU) - PI
			bank_in = clampf(-2.0 * d, -1.0, 1.0)
			var toward := clampf(atan2(cz - float(p[2]), _hypot(cx - float(p[0]), cy - float(p[1]))), -pitch_max, pitch_max) if hz > 0.0 else 0.0
			lift_in = clampf(3.0 * (toward - float(e.get("pitch", 0.0))), -1.0, 1.0)
	# the assist: slow, an arcade craft's nose will not come up (it is eased down below, and it never stalls)
	var assist = r.get("assist") if r.get("assist") == "arcade" or r.get("assist") == "sim" else null
	var guarded: bool = assist == "arcade" and not on_ground and lifts and grav and v < v_stall * 1.2
	if guarded and lift_in > 0.0:
		lift_in = 0.0
	var stalled := false
	if on_ground and v < v_takeoff:
		e["heading"] = fmod(float(e["heading"]) - bank_in * _num(r, "taxiTurn", 1.1) * minf(1.0, v / v_takeoff) * dt, TAU)
		var bk := float(e.get("bank", 0.0))
		e["bank"] = bk - clampf(bk, -level_rate * 2.0 * dt, level_rate * 2.0 * dt)
		var pt := float(e.get("pitch", 0.0))
		e["pitch"] = pt - clampf(pt, -pitch_rate * dt, pitch_rate * dt)
	else:
		e["bank"] = clampf(float(e.get("bank", 0.0)) + bank_in * bank_rate * dt, -bank_max, bank_max)
		if bank_in == 0.0 and assist != "sim":
			var lr := level_rate * (2.0 if assist == "arcade" else 1.0)
			e["bank"] = float(e["bank"]) - clampf(float(e["bank"]), -lr * dt, lr * dt)
		var turn: float = (G / maxf(v, v_stall)) * tan(float(e["bank"])) if lifts else _num(r, "turnRate", 1.2) * float(e["bank"]) / bank_max
		e["heading"] = fmod(float(e["heading"]) - turn * dt, TAU)
		var warned: bool = r.get("bound") is Dictionary and float(e.get("boundT", 0.0)) > _num(r["bound"], "warn", 5.0)
		e["pitch"] = clampf(float(e.get("pitch", 0.0)) + (0.0 if warned else _in(input, "lookDY") * look_sens) + lift_in * pitch_rate * dt, -pitch_max, pitch_max)
		if guarded and float(e["pitch"]) > -0.05:
			e["pitch"] = float(e["pitch"]) - minf(0.5 * pitch_rate * dt, float(e["pitch"]) + 0.05)
		if not on_ground and lifts and grav and v < v_stall and assist != "arcade":
			stalled = true
			e["pitch"] = maxf(-pitch_max, float(e["pitch"]) - _num(r, "stallDrop", 0.8) * dt)
	var path_pitch := 0.0 if (on_ground and v < v_takeoff) else float(e.get("pitch", 0.0))
	var dir := [cos(path_pitch) * cos(float(e["heading"])), cos(path_pitch) * sin(float(e["heading"])), sin(path_pitch)]
	p[0] = float(p[0]) + dir[0] * v * dt
	p[1] = float(p[1]) + dir[1] * v * dt
	var vz: float = 0.0 if (on_ground and path_pitch <= 0.0) else dir[2] * v
	if not on_ground and stalled and grav:
		vz -= _num(r, "sinkRate", 6.0) * (1.0 - v / v_stall)
	p[2] = float(p[2]) + vz * dt
	var airborne: bool
	if not is_nan(gz):
		var surf := gz + eye
		if float(p[2]) <= surf + 0.05:
			p[2] = surf
			airborne = false
		else:
			airborne = true if float(p[2]) > surf + 0.1 else was_airborne
	else:
		airborne = true
	e["takeoff"] = airborne and not was_airborne
	e["touchdown"] = not airborne and was_airborne
	e["airborne"] = airborne
	e["airspeed"] = v
	e["throttle"] = throttle
	e["climbRate"] = vz if airborne else 0.0
	e["stallStart"] = stalled and not _truthy(e.get("stalled"))
	e["stalled"] = stalled
	# the barrel roll (opt-in): a strafe press rolls the craft a full turn over `time` s, carrying it `side` m that way,
	# untouchable while it rolls
	var spin := 0.0
	if _truthy(r.get("roll")) and airborne:
		var R: Dictionary = r["roll"] if r["roll"] is Dictionary else {}
		var T := _num(R, "time", 0.7)
		var s_in := signf(_in(input, "strafe"))
		if float(e.get("rollCd", 0.0)) > 0.0:
			e["rollCd"] = maxf(0.0, float(e["rollCd"]) - dt)
		if not (float(e.get("rollT", 0.0)) > 0.0) and s_in != 0.0 and not _truthy(e.get("strafePrev")) and not (float(e.get("rollCd", 0.0)) > 0.0):
			e["rollT"] = T
			e["rollDir"] = s_in
			e["rollCd"] = _num(R, "cooldown", 1.5)
		if float(e.get("rollT", 0.0)) > 0.0:
			var stp := minf(dt, float(e["rollT"]))
			var side := _num(R, "side", 30.0) / T
			p[0] = float(p[0]) + sin(float(e["heading"])) * float(e["rollDir"]) * side * stp
			p[1] = float(p[1]) - cos(float(e["heading"])) * float(e["rollDir"]) * side * stp
			e["rollT"] = float(e["rollT"]) - stp
			spin = float(e["rollDir"]) * 2.0 * PI * (1.0 - maxf(0.0, float(e["rollT"])) / T)
		e["rolling"] = float(e.get("rollT", 0.0)) > 0.0
		e["invincible"] = e["rolling"]
		e["strafePrev"] = s_in != 0.0
	e["tilt"] = {"pitch": float(e.get("pitch", 0.0)) if airborne else 0.0, "roll": float(e.get("bank", 0.0)) + spin}
	e["locomotion"] = "fly" if airborne else "taxi"
	e["gaitPhase"] = float(e.get("gaitPhase", 0.0)) + (0.2 + throttle) * _num(r, "propRate", 3.0) * dt
	e["moving"] = v > 1e-3
