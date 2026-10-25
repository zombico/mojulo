extends RefCounted
# mojulo-godot kernel — THE LIVE VEHICLE AND ITS JUICE (since 0.31.0): what the page does to a racer's rig beyond its clip
# (scene/channels/controllable: __rigLive, __rigBone, __rjWhen, __rjStatus), ported. The pose: the drive clip sampled at
# the wheel's phase and crossfaded from the rest as the page's gait mix does, then the drive rule's facts exaggerated as
# bone overlays (the front wheels' steer, the steering wheel's turn, the body's lean, squat, dive and bounce about the
# wheelbase's middle, a mast's whip and spin). The juice: the facts its triggers read (the rule's, and what the page
# keeps: a slide's time, the corner's share of the grip, the speed's change, a bump), the compiled trigger trees, and
# the status rows' tints on the lamps and the body. Held equal to the page's own functions by the vehicle conformance
# corpus (lib/graph/scene/vehicle-conformance.js); kernel/juice.gd draws what they decide. Static functions only, the
# quaternions three's ([x, y, z, w], its multiply, slerp and rotation), in the figure's frame (z up, figure units).
#
#   const Vehicle := preload("res://kernel/vehicle.gd")
#   Vehicle.pose(V, S, e, dt, t)          → [[qx, qy, qz, qw, px, py, pz] a bone]   S = Vehicle.pose_state()
#   Vehicle.facts(R, e, js, d)            → { fact: number }                          js = Vehicle.juice_state()
#   Vehicle.when(tree, F)                 → number (a trigger is on when it is not 0)
#   Vehicle.status(J, js, F, d, t, nb, slots) → { u: [{ tint, mix, mixCol, add } a bone], halo: { row: opacity }, bubble }

const Js := preload("res://kernel/js.gd")


# ── three's quaternion and vector maths, as the page's runs them ─────────────────────────────────────────────────────
static func q_axis(ax: int, a: float) -> Array:
	var s := sin(a / 2.0)
	var q := [0.0, 0.0, 0.0, cos(a / 2.0)]
	q[ax] = s
	return q


static func q_mul(a: Array, b: Array) -> Array:
	var ax: float = a[0]
	var ay: float = a[1]
	var az: float = a[2]
	var aw: float = a[3]
	var bx: float = b[0]
	var by: float = b[1]
	var bz: float = b[2]
	var bw: float = b[3]
	return [ax * bw + aw * bx + ay * bz - az * by, ay * bw + aw * by + az * bx - ax * bz, az * bw + aw * bz + ax * by - ay * bx, aw * bw - ax * bx - ay * by - az * bz]


static func q_norm(q: Array) -> Array:
	var l := sqrt(float(q[0]) * float(q[0]) + float(q[1]) * float(q[1]) + float(q[2]) * float(q[2]) + float(q[3]) * float(q[3]))
	if l == 0.0:
		return [0.0, 0.0, 0.0, 1.0]
	l = 1.0 / l
	return [float(q[0]) * l, float(q[1]) * l, float(q[2]) * l, float(q[3]) * l]


static func q_slerp(a: Array, b: Array, t: float) -> Array:
	var bx: float = b[0]
	var by: float = b[1]
	var bz: float = b[2]
	var bw: float = b[3]
	var d := float(a[0]) * bx + float(a[1]) * by + float(a[2]) * bz + float(a[3]) * bw
	if d < 0.0:
		bx = -bx
		by = -by
		bz = -bz
		bw = -bw
		d = -d
	var o := 1.0 - t
	var e := t
	if d < 0.9995:
		var th := acos(d)
		var h := sin(th)
		o = sin(o * th) / h
		e = sin(e * th) / h
		return [float(a[0]) * o + bx * e, float(a[1]) * o + by * e, float(a[2]) * o + bz * e, float(a[3]) * o + bw * e]
	return q_norm([float(a[0]) * o + bx * e, float(a[1]) * o + by * e, float(a[2]) * o + bz * e, float(a[3]) * o + bw * e])


static func q_rot(q: Array, v: Array) -> Array:
	var x: float = v[0]
	var y: float = v[1]
	var z: float = v[2]
	var qx: float = q[0]
	var qy: float = q[1]
	var qz: float = q[2]
	var qw: float = q[3]
	var h := 2.0 * (qy * z - qz * y)
	var l := 2.0 * (qz * x - qx * z)
	var c := 2.0 * (qx * y - qy * x)
	return [x + qw * h + qy * c - qz * l, y + qw * l + qz * h - qx * c, z + qw * c + qx * l - qy * h]


static func _b(d: Dictionary, k: String) -> float:
	return 1.0 if Js.truthy(d.get(k)) else 0.0


static func _n(d: Dictionary, k: String) -> float:
	var v = d.get(k)
	return float(v) if Js.is_num(v) else 0.0


# ── the pose ─────────────────────────────────────────────────────────────────────────────────────────────────────────
static func pose_state() -> Dictionary:
	return {"mix": {}, "lv": {"lean": 0.0, "pitch": 0.0, "bz": 0.0, "vz": 0.0, "spin": 0.0, "whip": 0.0}}


# the gait crossfade (worlds/controllable/gait.js advanceGaitMix): the outgoing pose frozen at its last phase, faded out
static func gait_mix(mix: Dictionary, mode: String, phase: float, dt: float, blend_time: float) -> Dictionary:
	var bt := blend_time if blend_time > 0.0 else 0.18
	if not mix.has("mode"):
		mix["mode"] = mode
		mix["phase"] = phase
		mix["w"] = 1.0
		mix["prevMode"] = null
		return mix
	if mode != String(mix["mode"]):
		mix["prevMode"] = mix["mode"]
		mix["prevPhase"] = mix["phase"]
		mix["mode"] = mode
		mix["w"] = 0.0
	mix["phase"] = phase
	if float(mix["w"]) < 1.0:
		mix["w"] = minf(1.0, float(mix["w"]) + dt / bt)
		if float(mix["w"]) >= 1.0:
			mix["prevMode"] = null
	return mix


# a mode's clip (the page's __clipLookup, then forward, then the first)
static func clip_of(clips: Dictionary, name: String):
	if name != "":
		if clips.has(name):
			return clips[name]
		var alt = null
		if name == "boost_left" or name == "boost_right":
			alt = clips.get("boost_side")
		elif name.begins_with("swing_"):
			alt = clips.get("swing_neutral")
		else:
			for dir in ["_neutral", "_forward", "_left", "_right", "_back"]:
				if name.ends_with(dir):
					var base := name.substr(0, name.rfind("_"))
					alt = clips.get(base + "_neutral", clips.get("swing_neutral"))
					break
		if alt != null:
			return alt
	if clips.has("forward"):
		return clips["forward"]
	return clips.values()[0] if not clips.is_empty() else null


# one bone's [q, head] from a clip at a phase (the page's __rigBone): the rest when static or clipless
static func bone(V: Dictionary, clip_name: String, phase: float, statik: bool, bi: int) -> Array:
	var head: Array = V["bones"][bi]["head"]
	var clip = clip_of(V.get("clips", {}), clip_name)
	if statik or clip == null:
		return [[0.0, 0.0, 0.0, 1.0], [float(head[0]), float(head[1]), float(head[2])]]
	var nb: int = (V["bones"] as Array).size()
	var K := int(clip["k"])
	var B: Array = clip["b"]
	var i0 := 0
	var i1 := 0
	var t := 0.0
	if Js.truthy(clip.get("once")):
		var kf := minf(1.0, maxf(0.0, phase)) * float(K - 1)
		i0 = mini(K - 1, int(floor(kf)))
		i1 = mini(K - 1, i0 + 1)
		t = kf - float(i0)
	else:
		var kf := fposmod(phase, 1.0) * float(K)
		i0 = int(floor(kf)) % K
		i1 = (i0 + 1) % K
		t = kf - floor(kf)
	var o0 := (i0 * nb + bi) * 7
	var o1 := (i1 * nb + bi) * 7
	var s := -1.0 if (float(B[o0]) * float(B[o1]) + float(B[o0 + 1]) * float(B[o1 + 1]) + float(B[o0 + 2]) * float(B[o1 + 2]) + float(B[o0 + 3]) * float(B[o1 + 3])) < 0.0 else 1.0
	var q := q_norm([float(B[o0]) + (s * float(B[o1]) - float(B[o0])) * t, float(B[o0 + 1]) + (s * float(B[o1 + 1]) - float(B[o0 + 1])) * t,
		float(B[o0 + 2]) + (s * float(B[o1 + 2]) - float(B[o0 + 2])) * t, float(B[o0 + 3]) + (s * float(B[o1 + 3]) - float(B[o0 + 3])) * t])
	return [q, [float(B[o0 + 4]) + (float(B[o1 + 4]) - float(B[o0 + 4])) * t, float(B[o0 + 5]) + (float(B[o1 + 5]) - float(B[o0 + 5])) * t, float(B[o0 + 6]) + (float(B[o1 + 6]) - float(B[o0 + 6])) * t]]


# the springs (the page's __rigLive): the lean out of a turn, the squat and the dive, a landing's damped bounce, an
# engine's idle shiver, a mast's whip and a propeller's spin → the overlays' quaternions and the bounce
static func live(L: Dictionary, S: Dictionary, e: Dictionary, dt: float, time: float) -> Dictionary:
	var G: Dictionary = L["gains"]
	var d := minf(0.05, dt)
	var v := _n(e, "speed")
	var st := _n(e, "steerAngle")
	var thr := _n(e, "throttle")
	var braking := Js.truthy(e.get("braking"))
	var steer := maxf(-float(G["steerMax"]), minf(float(G["steerMax"]), st * float(G["steer"])))
	S["lean"] = float(S["lean"]) + (maxf(-float(G["leanMax"]), minf(float(G["leanMax"]), st * absf(v) * float(G["lean"]))) - float(S["lean"])) * minf(1.0, d * 6.0)
	S["pitch"] = float(S["pitch"]) + (thr * float(G["squat"]) * (1.0 if v >= 0.0 else -1.0) - (float(G["dive"]) if braking else 0.0) - float(S["pitch"])) * minf(1.0, d * 5.0)
	if Js.truthy(e.get("landed")):
		S["vz"] = float(S["vz"]) - float(G["bounce"]) * 4.0
	S["vz"] = float(S["vz"]) + (-140.0 * float(S["bz"]) - 11.0 * float(S["vz"])) * d
	S["bz"] = float(S["bz"]) + float(S["vz"]) * d
	S["spin"] = float(S["spin"]) + d * (5.0 + absf(v) * 1.6)
	S["whip"] = float(S["whip"]) + (minf(float(G["wobbleMax"]), absf(v) * float(G["wobble"])) + (-0.15 if braking else 0.0) - float(S["whip"])) * minf(1.0, d * 4.0)
	var shiver := 0.004 * sin(time * 52.0) if (thr > 0.05 or absf(v) < 0.5) else 0.0
	var mast := q_axis(0, float(S["whip"]) + 0.05 * sin(time * 9.0) * minf(1.0, absf(v) / 8.0))
	if Js.truthy(L.get("spin")):
		mast = q_mul(mast, q_axis(2, float(S["spin"])))
	return {"steer": q_axis(2, steer), "wheel": q_axis(1, -steer * 2.2), "body": q_mul(q_axis(1, float(S["lean"])), q_axis(0, float(S["pitch"]))), "mast": mast,
		"pivot": L["body"]["pivot"], "dz": maxf(-0.2, float(S["bz"])) + shiver}


# each bone's role in the overlay
static func roles(V: Dictionary) -> Array:
	var L = V.get("live")
	var out := []
	for b in V["bones"]:
		var id := String(b["id"])
		var r := ""
		if L is Dictionary:
			if (L["steer"] as Array).has(id):
				r = "steer"
			elif id == String(L.get("wheel", "")):
				r = "wheel"
			elif id == String(L.get("mast", "")):
				r = "mast"
			elif (L["body"]["bones"] as Array).has(id):
				r = "body"
		out.append(r)
	return out


# the figure's pose this frame: [qx, qy, qz, qw, px, py, pz] a bone, its head where the node stands (bone-local parts)
static func pose(V: Dictionary, S: Dictionary, e: Dictionary, dt: float, time: float) -> Array:
	var loco := String(e.get("locomotion")) if e.get("locomotion") is String else ""
	var mode := loco if Js.truthy(e.get("moving")) else "idle"
	var mix := gait_mix(S["mix"], mode, _n(e, "gaitPhase"), dt, float(V.get("blendTime", 0.0)) if Js.is_num(V.get("blendTime")) else 0.0)
	var w := 1.0
	if mix["prevMode"] != null:
		w = float(mix["w"]) * float(mix["w"]) * (3.0 - 2.0 * float(mix["w"]))
	var LV = live(V["live"], S["lv"], e, dt, time) if V.get("live") is Dictionary else null
	var role := roles(V)
	var has_idle: bool = (V.get("clips", {}) as Dictionary).has("idle")
	var out := []
	for bi in (V["bones"] as Array).size():
		var m := String(mix["mode"])
		var A := bone(V, ("idle" if has_idle else loco) if m == "idle" else m, float(mix["phase"]), m == "idle" and not has_idle, bi)
		var qa: Array = A[0]
		var pa: Array = A[1]
		if mix["prevMode"] != null:
			var pm := String(mix["prevMode"])
			var Bp := bone(V, ("idle" if has_idle else loco) if pm == "idle" else pm, float(mix["prevPhase"]), pm == "idle" and not has_idle, bi)
			qa = q_slerp(qa, Bp[0], 1.0 - w)
			var pb: Array = Bp[1]
			pa = [float(pa[0]) + (float(pb[0]) - float(pa[0])) * (1.0 - w), float(pa[1]) + (float(pb[1]) - float(pa[1])) * (1.0 - w), float(pa[2]) + (float(pb[2]) - float(pa[2])) * (1.0 - w)]
		if LV != null and role[bi] != "":
			if role[bi] == "steer":
				qa = q_mul(LV["steer"], qa)
			else:
				if role[bi] == "wheel":
					qa = q_mul(LV["wheel"], qa)
				elif role[bi] == "mast":
					qa = q_mul(LV["mast"], qa)
				var P: Array = LV["pivot"]
				var h := q_rot(LV["body"], [float(pa[0]) - float(P[0]), float(pa[1]) - float(P[1]), float(pa[2]) - float(P[2])])
				pa = [float(P[0]) + float(h[0]), float(P[1]) + float(h[1]), float(P[2]) + float(h[2]) + float(LV["dz"])]
				qa = q_mul(LV["body"], qa)
		out.append([qa[0], qa[1], qa[2], qa[3], pa[0], pa[1], pa[2]])
	return out


# ── the juice's facts and triggers ───────────────────────────────────────────────────────────────────────────────────
static func juice_state() -> Dictionary:
	return {"skidT": 0.0, "cornerT": 0.0, "prevV": 0.0, "accel": 0.0, "impactCD": 0.0, "wasBoost": false, "on": {}, "flashT": {}, "seed": 12345}


# what the triggers read this frame (the page's __updateRacerJuice): R the body's rule, d the frame's step (≤ 0.05)
static func facts(R: Dictionary, e: Dictionary, js: Dictionary, d: float) -> Dictionary:
	js["skidT"] = float(js["skidT"]) + d if Js.truthy(e.get("skidding")) else 0.0
	var vv := _n(e, "speed")
	var wb := _n(R, "wheelbase")
	var grip := _n(R, "grip")
	var corner := (vv * vv * absf(tan(_n(e, "steerAngle")))) / maxf(0.3, wb if wb != 0.0 else 1.0) / (maxf(0.2, grip if grip != 0.0 else 1.0) * 9.81)
	js["cornerT"] = float(js["cornerT"]) + d if corner > 0.6 else 0.0
	var hp := 1.0 - _n(e, "hp") / _n(e, "hpMax") if (e.get("hp") != null and _n(e, "hpMax") != 0.0) else _n(e, "damage")
	var acc := (absf(vv) - float(js["prevV"])) / d if d > 0.0 else 0.0
	js["prevV"] = absf(vv)
	js["accel"] = float(js["accel"]) + (acc - float(js["accel"])) * minf(1.0, d * 8.0)
	js["impactCD"] = maxf(0.0, float(js["impactCD"]) - d)
	var impact := 1.0 if (acc < -28.0 and float(js["impactCD"]) == 0.0) else 0.0
	if impact > 0.0:
		js["impactCD"] = 0.6
	var boosting := 1.0 if (Js.truthy(e.get("boosting")) or _n(e, "boostT") > 0.0) else 0.0
	var boost_start := 1.0 if (boosting > 0.0 and not js["wasBoost"]) else 0.0
	js["wasBoost"] = boosting > 0.0
	var top := _n(R, "topSpeed")
	var top_share := absf(vv) / maxf(6.0, top if top != 0.0 else 13.0)
	var surge := 1.0 if boosting > 0.0 else maxf(0.0, minf(1.0, (float(js["accel"]) - 4.0) / 6.0))
	return {"speed": absf(vv), "throttle": _n(e, "throttle"), "braking": _b(e, "braking"), "steer": _n(e, "steerAngle"), "skidding": _b(e, "skidding"),
		"skidTime": js["skidT"], "corner": corner, "cornerTime": js["cornerT"], "landed": _b(e, "landed"), "boosting": boosting, "boostStart": boost_start,
		"accel": js["accel"], "topShare": top_share, "surge": surge, "impact": impact, "hit": 1.0 if (Js.truthy(e.get("hit")) or Js.truthy(e.get("hitStart"))) else 0.0,
		"charge": _n(e, "boostCharge") if e.get("boostCharge") != null else _n(e, "charge"), "shield": _b(e, "shield"),
		"invulnerable": 1.0 if (Js.truthy(e.get("invulnerable")) or Js.truthy(e.get("star"))) else 0.0, "item": _b(e, "item"), "offroad": 0.0, "damage": hp}


# a compiled trigger tree (car-designer/juice.js compileWhen) read over the facts, as the page's __rjWhen reads it
static func when(n: Array, F: Dictionary) -> float:
	match String(n[0]):
		"or":
			var a := when(n[1], F)
			return a if a != 0.0 else when(n[2], F)
		"and":
			var a := when(n[1], F)
			return when(n[2], F) if a != 0.0 else a
		"not":
			return 1.0 if when(n[1], F) == 0.0 else 0.0
		"mul":
			return when(n[1], F) * when(n[2], F)
		"abs":
			return absf(when(n[1], F))
		"num":
			return float(n[1])
		"fact":
			var v = F.get(String(n[1]))
			return float(v) if Js.is_num(v) else 0.0
		"cmp":
			var a := when(n[2], F)
			var c := when(n[3], F)
			var op := String(n[1])
			var r := a < c if op == "<" else a > c if op == ">" else a <= c if op == "<=" else a >= c if op == ">=" else a == c if op == "==" else a != c
			return 1.0 if r else 0.0
	return 0.0


# the page's jitter (a seeded LCG, its __rjRnd), one stream a vehicle here
static func rnd(js: Dictionary) -> float:
	js["seed"] = Js.u32(Js.imul(int(js["seed"]), 1103515245) + 12345)
	return float(js["seed"]) / 4294967296.0


# a colour as three's Color.set takes a hex: its sRGB bytes into the linear working space
static func lin(hex: String) -> Array:
	var h := hex.trim_prefix("#")
	var out := []
	for i in 3:
		var c := float(h.substr(i * 2, 2).hex_to_int()) / 255.0
		out.append(c * 0.0773993808 if c < 0.04045 else pow(c * 0.9478672986 + 0.0521327014, 2.4))
	return out


# the status rows on the bones (the page's __rjStatus): each bone's tint (multiplied), mix toward a colour (the
# strongest wins) and glow (added); a lamp's halo with its glow; the shield's bubble. nb the bones, slots the bone
# indices a slot names ("all": every bone with a part).
static func status(J: Dictionary, js: Dictionary, F: Dictionary, d: float, t: float, nb: int, slots: Dictionary) -> Dictionary:
	# (a bone's mix colour is kept from frame to frame, as the page's uniform is: only the tint, mix and glow reset)
	if not js.has("mixCol"):
		js["mixCol"] = []
		for i in nb:
			js["mixCol"].append([1.0, 1.0, 1.0])
	var u := []
	for i in nb:
		u.append({"tint": [1.0, 1.0, 1.0], "mix": 0.0, "mixCol": js["mixCol"][i], "add": [0.0, 0.0, 0.0]})
	var halo := {}
	var bubble = null
	for row in J.get("status", []):
		var id := String(row["id"])
		var on := when(row["when"], F) != 0.0
		var was: bool = js["on"].get(id, false)
		js["on"][id] = on
		var look := String(row["look"])
		var dur := float(row["duration"]) if Js.is_num(row.get("duration")) and float(row["duration"]) != 0.0 else 0.12
		if look == "flash":
			if on and not was:
				js["flashT"][id] = dur
			js["flashT"][id] = maxf(0.0, float(js["flashT"].get(id, 0.0)) - d)
		var alive := float(js["flashT"].get(id, 0.0)) > 0.0 if look == "flash" else on
		var cols: Array = row["colours"]
		if look == "bubble":
			var amt := float(row["amount"]) if Js.is_num(row.get("amount")) and float(row["amount"]) != 0.0 else 0.8
			bubble = {"on": alive, "col": lin(String(cols[0])), "a": amt * (0.85 + 0.15 * sin(t * 6.0))}
			continue
		if row.get("halo") != null:
			halo[id] = 0.0
		if not alive:
			continue
		var by := (float(F.get(String(row["by"]), 0.0)) if row.get("by") != null else 1.0)
		var A := float(row["amount"]) if row.get("amount") != null else 1.0
		var mix := 0.0
		var glow := 0.0
		var tint = null
		var C := [1.0, 1.0, 1.0]
		if look == "glow":
			C = lin(String(cols[cols.size() - 1]))
			glow = A
		elif look == "fill":
			var full := by >= 0.999
			C = lin(String(cols[cols.size() - 1] if full else cols[0]))
			mix = 0.45 + 0.35 * sin(t * 14.0) if full else 0.6 * minf(1.0, by)
		elif look == "tier":
			var at: Array = row.get("tierAt", [0])
			var k := 0
			for x in at:
				if by >= float(x):
					k += 1
			C = lin(String(cols[mini(cols.size() - 1, maxi(0, k - 1))]))
			mix = A
			glow = A * 0.5
		elif look == "flash":
			C = lin(String(cols[0]))
			mix = A * (float(js["flashT"].get(id, 0.0)) / dur)
		elif look == "tint":
			if Js.truthy(row.get("flicker")) and rnd(js) < float(row["flicker"]) * 0.15:
				continue
			C = lin(String(cols[0]))
			tint = A * minf(1.0, by)
		elif look == "cycle":
			var rate := float(row["rate"]) if Js.is_num(row.get("rate")) and float(row["rate"]) != 0.0 else 8.0
			C = lin(String(cols[int(floor(t * rate)) % cols.size()]))
			mix = A
		elif look == "pulse":
			var rate := float(row["rate"]) if Js.is_num(row.get("rate")) and float(row["rate"]) != 0.0 else 2.0
			C = lin(String(cols[0]))
			mix = A * (0.5 + 0.5 * sin(t * rate * PI * 2.0))
		for sl in row["slots"]:
			for i in slots.get(String(sl), []):
				var b: Dictionary = u[int(i)]
				if tint != null:
					var tn: Array = b["tint"]
					b["tint"] = [float(tn[0]) * (1.0 - tint + tint * float(C[0])), float(tn[1]) * (1.0 - tint + tint * float(C[1])), float(tn[2]) * (1.0 - tint + tint * float(C[2]))]
				if mix > float(b["mix"]):
					b["mix"] = mix
					b["mixCol"] = C.duplicate()
					js["mixCol"][int(i)] = b["mixCol"]
				if glow != 0.0:
					var ad: Array = b["add"]
					b["add"] = [float(ad[0]) + float(C[0]) * glow * 0.5, float(ad[1]) + float(C[1]) * glow * 0.5, float(ad[2]) + float(C[2]) * glow * 0.5]
		if glow != 0.0 and row.get("halo") != null:
			halo[id] = minf(1.0, glow)
	return {"u": u, "halo": halo, "bubble": bubble}
