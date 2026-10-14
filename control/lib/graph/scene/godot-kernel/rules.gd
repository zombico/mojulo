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
# What the platform rule does that this port does not (godot-marks.js PLATFORM_LOST names each, all opt-in on the rule):
# the boost hover and inertia, space, the charged jump, the kneel, and the maneuver packs (dodge, tackle, a loadout). The
# melee swing's halt is the fight's (kernel/combat.gd): level.gd passes it in.

const TAU := PI * 2.0
const HALF_PI := PI / 2.0
const CELL := 4.0


# ── the ground: the page's raycast straight down, over the level's triangles (level-equivalence.js faceGround) ───────
static func make_ground(tris: Array) -> Dictionary:
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


static func camera_step(c: Dictionary, r: Dictionary, tgt: Dictionary, tgt_rule: Dictionary, dt: float, world: Dictionary) -> void:
	match String(r.get("type", "")):
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
