extends Node3D
# looks.gd — the LOOKS a world's cues put on its cast (playscape elements), kernel 0.6.0: the Godot lowering of the
# World page's status channel. level.gd makes one when score.looks or score.transits is present and keeps it as
# `looks`. Cues do not travel, so nothing here runs until a script calls it:
#
#   looks.wear(node, "poisoned")          the look called poisoned, on node and every mesh under it, from now
#   looks.wear(node, "burning", [1, .4, .1])   in another colour
#   looks.lift(node, "poisoned")          it comes off, fading over 1.2 s (no name: every look on node)
#   looks.transit(node, "hologram", "in") node comes in (or goes, "out") as a transit; a clip of the AnimationLibrary
#                                         `transits` (smoke, hologram, scan, transporter, galvatron) drives it
#
# Drawn: the COAT as each mesh's material_overlay (kernel/look_coat.gdshader), its strength by the coat's shape;
# WAVES (motes) and DRIFT (sprays) as billboards on a MultiMesh, placed each frame by the same closed forms the web
# page runs (wavePoints / sprayPoints, ported line for line, in mojulo's z-up frame round the body's feet). Glyphs
# draw as soft dots: the glowing ones (dot, streak, spark) added, the rest laid over. Bolts, fire on a body, ice,
# water and steam are the web page's alone (the score's ledger names them).

const TAU_ := 6.283185307179586
const FADE_OUT := 1.2
const TRANSIT_DUR := {"smoke": 1.1, "hologram": 1.4, "scan": 1.3, "transporter": 1.6, "galvatron": 2.0}
const TRANSIT_COL := {"hologram": Color(0.4, 0.9, 1.0), "scan": Color(1.0, 0.45, 0.15), "transporter": Color(0.6, 0.85, 1.0), "galvatron": Color(0.72, 0.45, 1.0), "smoke": Color(0.86, 0.86, 0.88)}
const GLOWS := ["dot", "streak", "spark"]

var table: Dictionary = {}          # name -> look (score.looks)
var clock := 0.0
var worn: Dictionary = {}           # "<node id>|<name>" -> wearing
var runs: Array = []                # transits playing
var transits := AnimationLibrary.new()
var _coat: Shader = null
var _tex_glow: Texture2D = null
var _tex_soft: Texture2D = null
var _orig: Dictionary = {}          # mesh instance id -> the overlay it had before any look


# a transit's clip drives this one number from 0 to 1 over the transit's time
class TransitRun extends Node:
	var u := 0.0


func setup(looks: Dictionary) -> void:
	table = looks
	_coat = load("res://kernel/look_coat.gdshader")
	_tex_glow = _radial([[0.0, 1.0], [0.25, 0.5], [0.6, 0.12], [1.0, 0.0]])
	_tex_soft = _radial([[0.0, 0.9], [0.45, 0.4], [1.0, 0.0]])
	for k in TRANSIT_DUR.keys():
		var a := Animation.new()
		a.length = TRANSIT_DUR[k]
		var tr := a.add_track(Animation.TYPE_VALUE)
		a.track_set_path(tr, NodePath(".:u"))
		a.track_set_interpolation_type(tr, Animation.INTERPOLATION_LINEAR)
		a.track_insert_key(tr, 0.0, 0.0)
		a.track_insert_key(tr, TRANSIT_DUR[k], 1.0)
		transits.add_animation(k, a)


static func _radial(stops: Array) -> Texture2D:
	var g := Gradient.new()
	g.offsets = PackedFloat32Array(stops.map(func(s): return float(s[0])))
	g.colors = PackedColorArray(stops.map(func(s): return Color(1, 1, 1, float(s[1]))))
	var t := GradientTexture2D.new()
	t.gradient = g
	t.fill = GradientTexture2D.FILL_RADIAL
	t.fill_from = Vector2(0.5, 0.5)
	t.fill_to = Vector2(1.0, 0.5)
	t.width = 64
	t.height = 64
	return t


static func _rgb(c, fallback: Color) -> Color:
	if c is Array and c.size() >= 3:
		return Color(float(c[0]), float(c[1]), float(c[2]))
	return fallback


static func _meshes(node: Node) -> Array:
	var out: Array = []
	if node is MeshInstance3D:
		out.append(node)
	for m in node.find_children("*", "MeshInstance3D", true, false):
		out.append(m)
	return out


# the body's feet in its own frame: the bottom middle of its meshes' bounds
static func _feet(node: Node3D, meshes: Array) -> Vector3:
	var inv := node.global_transform.affine_inverse()
	var box := AABB()
	var first := true
	for mi in meshes:
		var b: AABB = (inv * mi.global_transform) * mi.get_aabb()
		box = b if first else box.merge(b)
		first = false
	if first:
		return Vector3.ZERO
	return Vector3(box.get_center().x, box.position.y, box.get_center().z)


func is_wearing(node: Node, name := "") -> bool:
	for key in worn.keys():
		var w: Dictionary = worn[key]
		if w.node == node and w.dying < 0.0 and (name == "" or w.name == name):
			return true
	return false


func wear(node: Node3D, name: String, color = null) -> void:
	if not table.has(name) or node == null:
		return
	if not node.is_inside_tree():
		wear.call_deferred(node, name, color)
		return
	var key := "%d|%s" % [node.get_instance_id(), name]
	if worn.has(key):
		_drop(worn[key])
	var L: Dictionary = table[name]
	var base := _rgb(color, _rgb(L.get("color"), Color(1, 1, 1)))
	var meshes := _meshes(node)
	var w := {"node": node, "name": name, "look": L, "t0": clock, "dying": -1.0, "meshes": meshes, "feet": _feet(node, meshes), "mat": null, "sprays": []}
	var C = L.get("coat")
	if C is Dictionary and _coat != null:
		var m := ShaderMaterial.new()
		m.shader = _coat
		m.set_shader_parameter("coat_color", _rgb(C.get("color") if color == null else null, base))
		m.set_shader_parameter("power", float(C.get("p", 2.0)))
		m.set_shader_parameter("dark", 1.0 if C.get("dark", false) else 0.0)
		w.mat = m
	for W in L.get("motes", []):
		w.sprays.append(_pool("wave", W, _rgb(W.get("color") if color == null else null, base), true, _wave(W, [0.0, 0.0, 0.0], 0.0).size()))
	for S in L.get("drift", []):
		w.sprays.append(_pool("spray", S, _rgb(S.get("color") if color == null else null, base), GLOWS.has(String(S.get("glyph", "dot"))), int(S.get("count", 12)) * int(S.get("trail", 1))))
	worn[key] = w
	for mi in meshes:
		_restack(mi)


func lift(node: Node, name := "") -> void:
	for key in worn.keys():
		var w: Dictionary = worn[key]
		if w.node == node and w.dying < 0.0 and (name == "" or w.name == name):
			w.dying = clock


# a pool of billboards for one wave or spray, in world space
func _pool(kind: String, spec: Dictionary, col: Color, glow: bool, n: int) -> Dictionary:
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	mat.billboard_keep_scale = true
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD if glow else BaseMaterial3D.BLEND_MODE_MIX
	mat.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
	mat.vertex_color_use_as_albedo = true
	mat.albedo_texture = _tex_glow if glow else _tex_soft
	var quad := QuadMesh.new()
	quad.size = Vector2(1, 1)
	quad.material = mat
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.mesh = quad
	mm.instance_count = n
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.top_level = true
	mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mmi)
	return {"kind": kind, "spec": spec, "col": col, "mmi": mmi}


func _drop(w: Dictionary) -> void:
	for p in w.sprays:
		p.mmi.queue_free()
	worn.erase("%d|%s" % [w.node.get_instance_id(), w.name])
	for mi in w.meshes:
		_restack(mi)


# a mesh's overlay: a transit playing on it, else the newest look it wears with a coat, else what it had before
func _restack(mi) -> void:
	if not is_instance_valid(mi):
		return
	var id: int = mi.get_instance_id()
	if not _orig.has(id):
		_orig[id] = mi.material_overlay
	var top = null
	var t0 := -INF
	for w in worn.values():
		if w.mat != null and w.meshes.has(mi) and float(w.t0) >= t0:
			top = w.mat
			t0 = float(w.t0)
	for r in runs:
		if r.meshes.has(mi):
			top = r.mat
	mi.material_overlay = top if top != null else _orig[id]
	if top == null:
		_orig.erase(id)


func _process(delta: float) -> void:
	clock += delta
	for key in worn.keys():
		var w: Dictionary = worn[key]
		if not is_instance_valid(w.node):
			worn.erase(key)
			continue
		var age: float = clock - float(w.t0)
		var fade := minf(1.0, age / 0.15)
		if w.dying >= 0.0:
			var u: float = (clock - float(w.dying)) / FADE_OUT
			if u >= 1.0:
				_drop(w)
				continue
			fade *= 1.0 - u
		_draw(w, age, fade, (w.node as Node3D).is_visible_in_tree())
	_step_transits()


func _draw(w: Dictionary, age: float, fade: float, show: bool) -> void:
	var C = w.look.get("coat")
	if w.mat != null:
		var k := float(C.get("k", 0.6)) * fade
		var hz := float(C.get("hz", 0.6))
		match String(C.get("shape", "breathe")):
			"grow": k *= minf(1.0, 0.25 + age / 2.0) * ((0.8 + 0.2 * sin(age * hz * TAU_)) if hz > 0.0 else 1.0)
			"flash": k *= exp(-age / 0.25)
			"flicker": k *= 0.65 + 0.35 * (float(int(floor(age * 8.0) * 7919.0) % 13) / 12.0)
			"hold": pass
			_: k *= 0.7 + 0.3 * sin(age * hz * TAU_)
		w.mat.set_shader_parameter("k", k if show else 0.0)
	# the feet in mojulo's frame (z-up): x, -z, y of Godot's
	var f: Vector3 = (w.node as Node3D).global_transform * w.feet
	var cc := [f.x, -f.z, f.y]
	for p in w.sprays:
		var mm: MultiMesh = p.mmi.multimesh
		var pts: Array = _wave(p.spec, cc, age) if p.kind == "wave" else _spray(p.spec, cc, age, true)
		var n := mini(pts.size(), mm.instance_count)
		var base := float(p.spec.get("size", 0.6 if p.kind == "wave" else 0.12))
		for i in range(mm.instance_count):
			if i >= n or not show:
				mm.set_instance_transform(i, Transform3D(Basis().scaled(Vector3.ZERO), Vector3.ZERO))
				continue
			var q: Dictionary = pts[i]
			var wt: float = q.w * fade
			var s: float = (base * (0.35 + 0.65 * minf(1.0, q.w))) if p.kind == "wave" else float(q.s)
			if wt < 0.02:
				s = 0.0
			var at: Array = q.p
			mm.set_instance_transform(i, Transform3D(Basis().scaled(Vector3(s, s, s)), Vector3(at[0], at[2], -at[1])))
			mm.set_instance_color(i, Color(p.col.r, p.col.g, p.col.b, minf(1.0, wt)))


static func _fr(x: float) -> float:
	return x - floor(x)


static func _pair(v, d: float) -> Array:
	if v is Array and v.size() >= 2:
		return [float(v[0]), float(v[1])]
	if v is float or v is int:
		return [float(v), float(v)]
	return [d, d]


# wavePoints (playscape/elements/elements.js), line for line: [{ p, w }]
static func _wave(W: Dictionary, cc: Array, t: float) -> Array:
	var out: Array = []
	var count := int(W.get("count", 2))
	var trail := int(W.get("trail", 6))
	var lag := float(W.get("lag", 0.05))
	var cycle := float(W.get("cycle", 3.0))
	var turn := float(W.get("turn", 1.0))
	var r := _pair(W.get("r"), 0.8)
	var z := _pair(W.get("z"), 0.7)
	var arc := float(W.get("arc", 0.0))
	var wob := _pair(W.get("wobble"), 0.0)
	var tail := float(W.get("tail", 0.4))
	var pulse := float(W.get("pulse", 0.0))
	var env_kind := String(W.get("env", "steady"))
	var rnd := String(W.get("spread", "even")) == "random"
	var tilt := float(W.get("tilt", 0.0)) * PI / 180.0
	var ct := cos(tilt)
	var st := sin(tilt)
	var breathe := 1.0 - pulse * (0.5 - 0.5 * sin(TAU_ * t / cycle))
	var sc = W.get("scatter")
	for j in range(count):
		if sc is Array:
			var q := [float(cc[0]) + (_hs(j, 3.1) - 0.5) * float(sc[0]), float(cc[1]) + (_hs(j, 11.3) - 0.5) * float(sc[1]), float(cc[2]) + z[0] + (_hs(j, 5.7) - 0.5) * float(sc[2])]
			out.append({"p": q, "w": pow(maxf(sin(PI * _fr(t / cycle + _hs(j, 1.0))), 0.0), float(W.get("twinkle", 8.0))) * breathe})
			continue
		var j0: float = _hs(j, 2.7) if rnd else float(j) / count
		var a0: float = (_hs(j, 6.3) if rnd else float(j) / count) * TAU_
		for k in range(trail):
			var u := _fr(t / cycle + j0 - k * lag)
			var A := a0 + turn * TAU_ * u
			var R: float = r[0] + (r[1] - r[0]) * u
			var Z: float = z[0] + (z[1] - z[0]) * u + arc * 4.0 * u * (1.0 - u) + wob[0] * sin(wob[1] * A)
			var x := R * cos(A)
			var y := R * sin(A)
			var e := 1.0
			match env_kind:
				"ends": e = sin(PI * u)
				"in": e = u * u
				"out": e = (1.0 - u) * (1.0 - u)
			out.append({"p": [float(cc[0]) + x, float(cc[1]) + y * ct, float(cc[2]) + Z + y * st], "w": e * exp(-tail * k) * breathe})
	return out


static func _hs(a: float, b: float) -> float:
	return _fr(sin(a * 12.9898 + b * 78.233) * 43758.5453)


static func _hs4(a: float, b: float) -> float:
	return _fr(sin(a * 12.9898 + b * 78.233 + 4.1) * 43758.5453)


# sprayPoints (playscape/elements/elements.js), line for line: [{ p, v, w, s, rot, ring }]
static func _spray(S: Dictionary, cc: Array, t: float, loop: bool) -> Array:
	var out: Array = []
	var el := _pair(S.get("el"), 0.0)
	if not (S.get("el") is Array):
		el = [-90.0, 90.0]
	var sl0 := sin(el[0] * PI / 180.0)
	var sl1 := sin(el[1] * PI / 180.0)
	var z := _pair(S.get("z"), 0.9)
	var go: Array = S.get("go", [0, 0, 0])
	var g := float(S.get("gravity", 0.0))
	var sw_ := float(S.get("swirl", 0.0))
	var from := String(S.get("from", "shell"))
	var rr := float(S.get("r", 0.6))
	var life0 := float(S.get("life", 1.5))
	var trail := int(S.get("trail", 1))
	var lag := float(S.get("lag", 0.04))
	var env_kind := String(S.get("env", "out"))
	var none := {"p": [cc[0], cc[1], cc[2]], "v": [0, 0, 0], "w": 0.0, "s": 0.0, "rot": 0.0, "ring": -1.0}
	for i in range(int(S.get("count", 12))):
		var life := life0 * ((0.75 + 0.5 * _hs4(i, 1)) if loop else (0.85 + 0.3 * _hs4(i, 1)))
		var tau0: float = _fr(t / life + _hs4(i, 2)) * life if loop else t - float(S.get("delay", 0.0)) - float(S.get("stagger", 0.0)) * _hs4(i, 2)
		var a := _hs4(i, 3) * TAU_
		var d := sqrt(_hs4(i, 4)) * rr
		var zz: float = z[0] + (z[1] - z[0]) * _hs4(i, 10)
		var x0 := 0.0
		var y0 := 0.0
		if from == "shell":
			x0 = rr * cos(a)
			y0 = rr * sin(a)
		elif from != "point":
			x0 = d * cos(a)
			y0 = d * sin(a)
		var sp := float(S.get("v", 0.0)) * (0.6 + 0.8 * _hs4(i, 5))
		var se := sl0 + (sl1 - sl0) * _hs4(i, 6)
		var ce := sqrt(maxf(0.0, 1.0 - se * se))
		var az: float = (a + (_hs4(i, 7) - 0.5) * 0.6) if from == "shell" else _hs4(i, 7) * TAU_
		var vx := sp * ce * cos(az) + float(go[0])
		var vy := sp * ce * sin(az) + float(go[1])
		var vz := sp * se + float(go[2])
		var land := INF
		if g > 0.0:
			land = (vz + sqrt(vz * vz + 2.0 * g * zz)) / g
		elif vz < 0.0:
			land = zz / -vz
		for k in range(trail):
			var tau := tau0 - k * lag
			if tau < 0.0 or tau > life or (k > 0 and tau > land):
				out.append(none)
				continue
			var tt := minf(tau, land)
			if tau > land:
				out.append(none)   # a landed drop's ring is the web page's
				continue
			var x := x0 + vx * tt
			var y := y0 + vy * tt
			var zt: float = zz + vz * tt - 0.5 * g * tt * tt
			var swa := sw_ * TAU_ * tt
			var rx := x * cos(swa) - y * sin(swa)
			var ry := x * sin(swa) + y * cos(swa)
			var u := tau / life
			var e := minf(1.0, u * 12.0) * minf(1.0, (1.0 - u) * 6.0)
			match env_kind:
				"ends": e = sin(PI * u)
				"in": e = u * u
				"out": e = minf(1.0, u * 12.0) * (1.0 - u) * (1.0 - u)
			var s := float(S.get("size", 0.12)) * (0.7 + 0.6 * _hs4(i, 8)) * (1.0 + float(S.get("grow", 0.0)) * u) * (1.0 - (0.6 * k) / trail)
			out.append({"p": [float(cc[0]) + rx, float(cc[1]) + ry, float(cc[2]) + zt], "v": [vx, vy, vz - g * tt], "w": e * pow(0.7, k), "s": s, "rot": 0.0, "ring": -1.0})
	return out


# ── transits: a clip from `transits` drives u; u drives the body's fade and its overlay ──────────────────────────────
func transit(node: Node3D, kind: String, dir := "in") -> void:
	if node == null or not TRANSIT_DUR.has(kind):
		return
	if not node.is_inside_tree():
		transit.call_deferred(node, kind, dir)
		return
	var run := TransitRun.new()
	add_child(run)
	var ap := AnimationPlayer.new()
	run.add_child(ap)
	ap.root_node = NodePath("..")
	ap.add_animation_library("transits", transits)
	var meshes := _meshes(node)
	var m := ShaderMaterial.new()
	m.shader = _coat
	m.set_shader_parameter("coat_color", TRANSIT_COL.get(kind, Color(1, 1, 1)))
	m.set_shader_parameter("power", 1.5)
	var box := AABB()
	var first := true
	for mi in meshes:
		var b: AABB = mi.global_transform * mi.get_aabb()
		box = b if first else box.merge(b)
		first = false
	var fx: CPUParticles3D = null
	if kind == "smoke" or kind == "transporter" or kind == "galvatron":
		fx = _burst(kind, dir, box)
		add_child(fx)
		fx.emitting = true
	node.visible = true
	runs.append({"run": run, "node": node, "kind": kind, "dir": dir, "meshes": meshes, "mat": m, "box": box, "fx": fx})
	for mi in meshes:
		_restack(mi)
	ap.play("transits/" + kind)


# puffs or sparks for a transit: a one-shot burst round the body's bounds
func _burst(kind: String, dir: String, box: AABB) -> CPUParticles3D:
	var p := CPUParticles3D.new()
	p.one_shot = true
	p.explosiveness = 0.9
	p.lifetime = TRANSIT_DUR[kind] * 0.9
	p.position = box.get_center()
	var quad := QuadMesh.new()
	quad.size = Vector2(1, 1)
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.vertex_color_use_as_albedo = true
	mat.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
	quad.material = mat
	p.mesh = quad
	var ramp := Gradient.new()
	var col: Color = TRANSIT_COL.get(kind, Color(1, 1, 1))
	ramp.colors = PackedColorArray([Color(col.r, col.g, col.b, 0.9), Color(col.r, col.g, col.b, 0.0)])
	p.color_ramp = ramp
	if kind == "smoke":
		mat.albedo_texture = _tex_soft
		p.amount = 18
		p.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
		p.emission_sphere_radius = maxf(0.25, box.size.length() * 0.2)
		p.direction = Vector3(0, 1, 0)
		p.spread = 70.0
		p.initial_velocity_min = 0.8
		p.initial_velocity_max = 1.6
		p.gravity = Vector3(0, 0.5, 0)
		p.scale_amount_min = 0.5
		p.scale_amount_max = 1.2
		var grow := Curve.new()
		grow.add_point(Vector2(0, 0.5))
		grow.add_point(Vector2(1, 1.6))
		p.scale_amount_curve = grow
	else:
		mat.albedo_texture = _tex_glow
		mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
		p.amount = 48 if kind == "transporter" else 72
		p.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
		p.emission_sphere_radius = maxf(0.3, box.size.length() * 0.6)
		p.gravity = Vector3.ZERO
		# coming, the sparks gather onto the body; going, they leave it
		p.radial_accel_min = -6.0 if dir == "in" else 4.0
		p.radial_accel_max = -4.0 if dir == "in" else 6.0
		p.scale_amount_min = 0.08
		p.scale_amount_max = 0.14
	return p


static func _sm(x: float) -> float:
	x = clampf(x, 0.0, 1.0)
	return x * x * (3.0 - 2.0 * x)


func _step_transits() -> void:
	for r in runs.duplicate():
		var u: float = r.run.u
		var v: float = u if r.dir == "in" else 1.0 - u
		var skin := 1.0
		var stripes := 0.0
		var band := 0.0
		match String(r.kind):
			"smoke": skin = (0.0 if u < 0.3 else 1.0) if r.dir == "in" else (1.0 if u < 0.22 else 0.0)
			"hologram":
				stripes = _sm(v / 0.45) if v < 0.45 else 1.0 - _sm((v - 0.8) / 0.2)
				skin = _sm((v - 0.45) / 0.45)
			"scan":
				band = sin(PI * minf(1.0, u * 1.05))
				skin = _sm(v * 1.2 - 0.1)
				r.mat.set_shader_parameter("band_y", r.box.position.y + (r.box.size.y + 0.1) * v)
			"transporter": skin = _sm((v - 0.55) / 0.4)
			"galvatron":
				if r.dir == "out":
					skin = 1.0 - _sm(u / 0.25)
					stripes = _sm(u / 0.2) * (1.0 - _sm((u - 0.3) / 0.15))
				else:
					skin = _sm((u - 0.7) / 0.25)
					stripes = _sm((u - 0.5) / 0.2) * (1.0 - _sm((u - 0.85) / 0.15))
		r.mat.set_shader_parameter("stripes", stripes)
		r.mat.set_shader_parameter("band", band)
		r.mat.set_shader_parameter("k", 0.8 * stripes)
		for mi in r.meshes:
			if is_instance_valid(mi):
				mi.transparency = 1.0 - skin
		var ap: AnimationPlayer = r.run.get_child(0)
		if u >= 1.0 or not ap.is_playing():
			runs.erase(r)
			for mi in r.meshes:
				if is_instance_valid(mi):
					mi.transparency = 0.0
					_restack(mi)
			if r.dir == "out" and is_instance_valid(r.node):
				r.node.visible = false
			if r.fx != null:
				r.fx.queue_free()
			r.run.queue_free()
