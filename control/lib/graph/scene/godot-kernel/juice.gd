extends Node3D
# mojulo-godot kernel — A RACER'S RIG ALIVE AND ITS JUICE DRAWN (since 0.31.0): one node a vehicle (score.vehicles), made
# by kernel/level.gd for a body it drives (the pilot, a rival) and stepped after the world each frame. Its bones posed
# by kernel/vehicle.gd (the drive clip at the wheel's phase, the live overlay: the front wheels steering, the body
# leaning, squatting, diving and bouncing, a mast's whip and spin), the GLB's rigid part nodes set to it; then the juice
# the page draws (scene/channels/controllable __updateRacerJuice), its triggers read by vehicle.gd: flames on their
# anchors (additive cones), puffs, smoke, dust and sparks (pooled cards in the world, seeded jitter), a landing's ring,
# the status rows on the bones (a tint, a mix toward a colour and a glow, laid over each part as one premultiplied
# pass), a lamp's halo, the shield's bubble; the big effects (stars from a bump, stars round the head, motion lines at
# speed, a boost's shock, the pilot's speed lines on the screen); and a dark mood's own light: the headlamps' pool on
# the road ahead (kernel/beam.gdshader) and the tail lamps' ribbons. Positions and speeds in the recipe's frame (z up,
# recipe units) as the page's, drawn in Godot's (y up, metres: × mpu).

const Vehicle := preload("res://kernel/vehicle.gd")
const Js := preload("res://kernel/js.gd")
const BeamShader := preload("res://kernel/beam.gdshader")
const BubbleShader := preload("res://kernel/bubble.gdshader")
const StatusShader := preload("res://kernel/status.gdshader")

const POOL := 300          # a vehicle's cards in flight at most (the page pools 900 over every racer)

var V: Dictionary = {}
var rule: Dictionary = {}
var ent_of: Callable       # → the body's rule state (kernel/rules.gd's entity)
var wrap: Node3D = null    # the figure's wrapper (the machine's frame: the heading, not the body's lean)
var bones: Array = []      # the GLB's part node a bone, or null
var mpu := 1.0
var pilot := false         # the pilot's own (its speed lines are on the screen)
var S: Dictionary = {}
var js: Dictionary = {}
var J = null
var slots: Dictionary = {}
var anchors: Array = []    # [{ kind, loc: Node3D, dir: Vector3 (the anchor's frame) }]
var flames: Array = []
var parts: Array = []
var rings: Array = []
var stars: Array = []
var streaks: Array = []
var shocks: Array = []
var overlays: Array = []   # a ShaderMaterial a bone (the status pass), or null
var halos: Array = []
var bubble: MeshInstance3D = null
var beam: MeshInstance3D = null
var beam_row = null
var trails: Array = []
var lines: Control = null
var acc: Dictionary = {}
var alive: Dictionary = {}
var clock := 0.0
var _tex: GradientTexture2D = null
var _star: ImageTexture = null


static func gd_name(s: String) -> String:
	var out := s
	for ch in [".", ":", "@", "/", "\"", "%"]:
		out = out.replace(ch, "_")
	return out


# the recipe's frame ↔ Godot's
func _to_g(p: Array) -> Vector3:
	return Vector3(float(p[0]), float(p[2]), -float(p[1])) * mpu


func _to_r(g: Vector3) -> Array:
	return [g.x / mpu, -g.z / mpu, g.y / mpu]


static func _hex(c: String) -> Color:
	return Color.html(c)


func setup(row: Dictionary, wrapper: Node3D, rule_row: Dictionary, ent_fn: Callable, meters_per_unit: float, is_pilot: bool) -> void:
	V = row
	rule = rule_row
	ent_of = ent_fn
	wrap = wrapper
	mpu = meters_per_unit
	pilot = is_pilot
	top_level = true
	S = Vehicle.pose_state()
	js = Vehicle.juice_state()
	var fig := String(row["figure"])
	slots = {"all": []}
	for b in row["bones"]:
		var n = wrap.find_child(gd_name(fig + ":" + String(b["id"])), true, false) if b["part"] else null
		bones.append(n if n is Node3D else null)
	for i in bones.size():
		if bones[i] != null:
			slots["all"].append(i)
	J = row.get("juice")
	if not (J is Dictionary):
		return
	for k in (J.get("slots", {}) as Dictionary):
		var i := _bone_index(String(J["slots"][k]))
		if i >= 0 and bones[i] != null:
			slots[k] = [i]
	_build_juice()


func _bone_index(id: String) -> int:
	for i in (V["bones"] as Array).size():
		if String(V["bones"][i]["id"]) == id:
			return i
	return -1


# a node at a point of the machine: on its bone (it rides the body), else on the machine's frame
func _locator(bone_id, at: Array) -> Node3D:
	var loc := Node3D.new()
	loc.position = Vector3(float(at[0]), float(at[1]), float(at[2]))
	var i := _bone_index(String(bone_id)) if bone_id is String else -1
	var parent: Node3D = bones[i] if i >= 0 and bones[i] != null else wrap
	parent.add_child(loc)
	return loc


static func _match(at: String, kind: String) -> bool:
	return at == kind or (at.find(".") < 0 and kind.split(".")[0] == at)


# three's setFromUnitVectors: the turn taking +y to a direction (a half turn about z when it points straight down)
static func _up_to(d: Vector3) -> Quaternion:
	var r := d.y + 1.0
	if r < 1e-6:
		return Quaternion(0, 0, 1, 0)
	return Quaternion(d.z, 0.0, -d.x, r).normalized()


func _texture() -> GradientTexture2D:
	if _tex == null:
		var gr := Gradient.new()
		gr.offsets = PackedFloat32Array([0.0, 0.45, 1.0])
		gr.colors = PackedColorArray([Color(1, 1, 1, 1), Color(1, 1, 1, 0.75), Color(1, 1, 1, 0)])
		_tex = GradientTexture2D.new()
		_tex.gradient = gr
		_tex.fill = GradientTexture2D.FILL_RADIAL
		_tex.fill_from = Vector2(0.5, 0.5)
		_tex.fill_to = Vector2(1.0, 0.5)
	return _tex


# a five-pointed star, as the page draws its own on a canvas
func _star_texture() -> ImageTexture:
	if _star == null:
		var img := Image.create(64, 64, false, Image.FORMAT_RGBA8)
		var pts := PackedVector2Array()
		for i in 10:
			var r := 12.0 if i % 2 == 1 else 29.0
			var a := -PI / 2.0 + float(i) * PI / 5.0
			pts.append(Vector2(32.0 + r * cos(a), 32.0 + r * sin(a)))
		for y in 64:
			for x in 64:
				img.set_pixel(x, y, Color(1, 1, 1, 1) if Geometry2D.is_point_in_polygon(Vector2(x + 0.5, y + 0.5), pts) else Color(1, 1, 1, 0))
		_star = ImageTexture.create_from_image(img)
	return _star


func _mat(color: Color, additive: bool, tex: Texture2D, billboard: bool) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD if additive else BaseMaterial3D.BLEND_MODE_MIX
	m.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	if billboard:
		m.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	if tex != null:
		m.albedo_texture = tex
	m.albedo_color = color
	return m


static func _alpha(m: MeshInstance3D, a: float) -> void:
	var mat := m.material_override as StandardMaterial3D
	var c := mat.albedo_color
	c.a = a
	mat.albedo_color = c


static func _colour(m: MeshInstance3D, c: Color) -> void:
	(m.material_override as StandardMaterial3D).albedo_color = c


func _mesh(mesh: Mesh, mat: Material, parent: Node) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)
	return mi


func _quad() -> QuadMesh:
	var q := QuadMesh.new()
	q.size = Vector2(1, 1)
	return q


# a flat ring in the recipe's ground plane (three's RingGeometry), drawn in Godot's
static func _ring(inner: float, outer: float, segs: int) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in segs:
		var a0 := TAU * float(i) / float(segs)
		var a1 := TAU * float(i + 1) / float(segs)
		var p := [Vector3(cos(a0) * inner, 0, -sin(a0) * inner), Vector3(cos(a0) * outer, 0, -sin(a0) * outer), Vector3(cos(a1) * outer, 0, -sin(a1) * outer), Vector3(cos(a1) * inner, 0, -sin(a1) * inner)]
		for k in [0, 1, 2, 0, 2, 3]:
			st.add_vertex(p[k])
	return st.commit()


# a page-frame basis (z up) in Godot's frame
static func _basis_g(b: Basis) -> Basis:
	var C := Basis(Vector3(1, 0, 0), Vector3(0, 0, -1), Vector3(0, 1, 0))
	return C * b * C.inverse()


func _build_juice() -> void:
	var D := float(J["D"])
	for a in J.get("anchors", []):
		var dv: Array = a["dir"]
		anchors.append({"kind": String(a["kind"]), "loc": _locator(a.get("bone"), a["at"]), "dir": Vector3(float(dv[0]), float(dv[1]), float(dv[2])).normalized()})
	# the flames: two open cones a flame on its anchor (an outer of the last colour, a hot inner of the first)
	for row in J.get("rows", []):
		if String(row["look"]) != "flame":
			continue
		for a in anchors:
			if not _match(String(row["at"]), a["kind"]):
				continue
			var holder := Node3D.new()
			holder.quaternion = _up_to(a["dir"])
			holder.visible = false
			(a["loc"] as Node3D).add_child(holder)
			var len := float(row["size"]) * D * 1.6
			var rad := maxf(0.03, float(row["size"]) * D * 0.32)
			var cols: Array = row["colours"]
			var mk := func(r: float, l: float, col: String, o: float) -> MeshInstance3D:
				var c := CylinderMesh.new()
				c.top_radius = 0.0
				c.bottom_radius = r
				c.height = l
				c.radial_segments = 10
				c.rings = 1
				c.cap_top = false
				c.cap_bottom = false
				var m := _mesh(c, _mat(_hex(col), true, null, false), holder)
				m.position = Vector3(0, l / 2.0, 0)
				m.set_meta("o", o)
				return m
			flames.append({"row": row, "holder": holder, "outer": mk.call(rad, len, String(cols[cols.size() - 1]), 0.75), "inner": mk.call(rad * 0.55, len * 0.6, String(cols[0]), 0.95), "amt": 0.0, "id": flames.size()})
	# the status pass a bone: its tint, mix and glow laid over the part
	for i in bones.size():
		var n = bones[i]
		if n is GeometryInstance3D:
			var sm := ShaderMaterial.new()
			sm.shader = StatusShader
			(n as GeometryInstance3D).material_overlay = sm
			overlays.append(sm)
		else:
			overlays.append(null)
	for row in J.get("status", []):
		if row.get("halo") != null:
			for sl in row["slots"]:
				for a in anchors:
					if a["kind"] == String(sl):
						var cols: Array = row["colours"]
						var h := _mesh(_quad(), _mat(_hex(String(cols[cols.size() - 1])), true, _texture(), true), a["loc"])
						h.scale = Vector3.ONE * D * 0.55 * float(row["halo"])
						h.visible = false
						halos.append({"row": String(row["id"]), "m": h})
		if String(row["look"]) == "bubble" and bubble == null:
			var rad := D * 1.9
			var sp := SphereMesh.new()
			sp.radius = rad
			sp.height = rad * 2.0
			sp.radial_segments = 24
			sp.rings = 16
			var sm := ShaderMaterial.new()
			sm.shader = BubbleShader
			var body = null
			for a in anchors:
				if a["kind"] == "body":
					body = a["loc"]
					break
			bubble = _mesh(sp, sm, body if body != null else wrap)
			bubble.position = Vector3(0, 0, rad * 0.45)
			bubble.visible = false
	if J.get("beams") is Dictionary:
		_build_beam(J["beams"])
	if J.get("trails") is Dictionary:
		var T: Dictionary = J["trails"]
		for at in T["at"]:
			var mat := StandardMaterial3D.new()
			mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
			mat.vertex_color_use_as_albedo = true
			mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
			mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
			mat.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
			mat.cull_mode = BaseMaterial3D.CULL_DISABLED
			var im := ImmediateMesh.new()
			var mi := _mesh(im, mat, self)
			trails.append({"loc": _locator(T.get("bone"), at), "im": im, "m": mi, "pts": [], "c": Vehicle.lin(String(T["colour"]))})
	if pilot:
		for row in J.get("fx", []):
			if String(row["look"]) == "screen":
				lines = SpeedLines.new()
				lines.set_anchors_preset(Control.PRESET_FULL_RECT)
				lines.mouse_filter = Control.MOUSE_FILTER_IGNORE
				var layer := CanvasLayer.new()
				layer.layer = 5
				add_child(layer)
				layer.add_child(lines)
				break


# the headlamps' pool: a plane on the road ahead in the machine's frame (it follows the heading, not the lean)
func _build_beam(B: Dictionary) -> void:
	var w := float(B["width"])
	var l := float(B["len"])
	var y0 := float(B["from"])
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var corners := [[-w / 2.0, y0, 0.0, 0.0], [w / 2.0, y0, 1.0, 0.0], [w / 2.0, y0 + l, 1.0, 1.0], [-w / 2.0, y0 + l, 0.0, 1.0]]
	for k in [0, 1, 2, 0, 2, 3]:
		var c: Array = corners[k]
		st.set_uv(Vector2(float(c[2]), float(c[3])))
		st.add_vertex(Vector3(float(c[0]), float(c[1]), 0.06))
	var sm := ShaderMaterial.new()
	sm.shader = BeamShader
	var col := Vehicle.lin(String(B["colour"]))
	sm.set_shader_parameter("col", Vector3(float(col[0]), float(col[1]), float(col[2])))
	sm.set_shader_parameter("spread", float(B["spread"]))
	beam = _mesh(st.commit(), sm, wrap)
	beam_row = B


# ── each frame ──────────────────────────────────────────────────────────────────────────────────────────────────────
func step(dt: float) -> void:
	var e = ent_of.call()
	if not (e is Dictionary):
		return
	clock += dt
	var pose: Array = Vehicle.pose(V, S, e, dt, clock)
	for i in bones.size():
		var n = bones[i]
		if n == null:
			continue
		var b: Array = pose[i]
		(n as Node3D).quaternion = Quaternion(float(b[0]), float(b[1]), float(b[2]), float(b[3]))
		(n as Node3D).position = Vector3(float(b[4]), float(b[5]), float(b[6]))
	if not (J is Dictionary):
		return
	var d := minf(0.05, dt)
	var F: Dictionary = Vehicle.facts(rule, e, js, d)
	var D := float(J["D"])
	for row in J.get("rows", []):
		var look := String(row["look"])
		if look == "flame":
			continue
		var on := Vehicle.when(row["when"], F) != 0.0
		if look == "ring":
			if on:
				_ring_at(row, e, D)
			continue
		if not on:
			continue
		var tier := 0
		if row.get("tierBy") != null:
			for x in row["tierAt"]:
				if float(F.get(String(row["tierBy"]), 0.0)) >= float(x):
					tier += 1
			tier = maxi(0, tier - 1)
		for ai in anchors.size():
			var a: Dictionary = anchors[ai]
			if not _match(String(row["at"]), a["kind"]):
				continue
			var k := String(row["id"]) + "|" + str(ai)
			acc[k] = float(acc.get(k, 0.0)) + (30.0 if look == "trail" else (float(row["rate"]) if Js.truthy(row.get("rate")) else 10.0)) * d
			while float(acc[k]) >= 1.0:
				acc[k] = float(acc[k]) - 1.0
				_spawn(row, a, e, tier, D)
	for f in flames:
		var want := 1.0 if Vehicle.when(f["row"]["when"], F) != 0.0 else 0.0
		f["amt"] = float(f["amt"]) + (want - float(f["amt"])) * minf(1.0, d * 18.0)
		var holder: Node3D = f["holder"]
		if float(f["amt"]) < 0.02:
			holder.visible = false
			continue
		holder.visible = true
		var fk := float(f["row"]["flicker"]) if Js.truthy(f["row"].get("flicker")) else 0.2
		var fl := 1.0 - fk + fk * (0.5 + 0.5 * sin(clock * 47.0 + float(f["id"])))
		var amt := float(f["amt"])
		holder.scale = Vector3(0.6 + 0.4 * amt, amt * fl, 0.6 + 0.4 * amt)
		for side in ["outer", "inner"]:
			var m: MeshInstance3D = f[side]
			_alpha(m, float(m.get_meta("o")) * amt)
	_status(F, d)
	_fx(e, F, d, D)
	if beam != null:
		(beam.material_override as ShaderMaterial).set_shader_parameter("amount", float(beam_row["amount"]) * (0.85 + 0.15 * minf(1.0, float(F["speed"]) / 30.0)))
	if not trails.is_empty():
		_trails(F)
	_pools(d)


func _ent_ground(e: Dictionary) -> float:
	return float(e["pos"][2]) - (float(rule["eye"]) if Js.is_num(rule.get("eye")) else 0.0)


func _free(pool: Array, cap: int, maker: String):
	for p in pool:
		if not p["on"]:
			return p
	if pool.size() >= cap:
		return null
	var p: Dictionary = call(maker)
	pool.append(p)
	return p


func _new_part() -> Dictionary:
	return {"on": false, "m": _mesh(_quad(), _mat(Color.WHITE, false, _texture(), true), self)}


func _new_ring() -> Dictionary:
	return {"on": false, "m": _mesh(_ring(0.75, 1.0, 28), _mat(Color.WHITE, false, null, false), self)}


func _new_star() -> Dictionary:
	var mat := _mat(Color.WHITE, false, _star_texture(), true)
	mat.no_depth_test = true
	mat.render_priority = 10
	return {"on": false, "m": _mesh(_quad(), mat, self)}


# a page-frame XY plane (the streak's), drawn in Godot's frame
func _new_streak() -> Dictionary:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for q in [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]:
		st.add_vertex(Vector3(float(q[0]), 0.0, -float(q[1])))
	return {"on": false, "m": _mesh(st.commit(), _mat(Color.WHITE, true, null, false), self)}


func _new_shock() -> Dictionary:
	return {"on": false, "m": _mesh(_ring(0.86, 1.0, 40), _mat(Color.WHITE, true, null, false), self)}


func _spawn(row: Dictionary, a: Dictionary, e: Dictionary, tier: int, D: float) -> void:
	var key := String(row["id"])
	if int(alive.get(key, 0)) >= int(row["budget"]):
		return
	var p = _free(parts, POOL, "_new_part")
	if p == null:
		return
	var loc: Node3D = a["loc"]
	var at := _to_r(loc.global_position)
	var dg: Vector3 = loc.global_transform.basis.orthonormalized() * (a["dir"] as Vector3)
	var dr := [dg.x, -dg.z, dg.y]
	var look := String(row["look"])
	var spark := look == "spark" or look == "trail"
	var h := float(e["heading"])
	var fx := cos(h)
	var fy := sin(h)
	var v := float(e.get("speed", 0.0))
	p["on"] = true
	p["key"] = key
	p["age"] = 0.0
	p["life"] = (float(row["life"]) if Js.truthy(row.get("life")) else 0.6) * (0.8 + 0.4 * Vehicle.rnd(js))
	p["pos"] = [float(at[0]) + _r() * D * 0.1, float(at[1]) + _r() * D * 0.1, float(at[2]) + (0.0 if look == "puff" else 0.02)]
	p["grav"] = -9.0 if look == "spark" else 0.0
	if look == "puff":
		p["vel"] = [float(dr[0]) * 0.6 + _r() * 0.3 + fx * v, float(dr[1]) * 0.6 + _r() * 0.3 + fy * v, 0.5 + float(dr[2]) * 0.6]
	elif look == "smoke":
		p["vel"] = [_r() * 0.8 + fx * v * 0.3, _r() * 0.8 + fy * v * 0.3, 0.6 + Vehicle.rnd(js) * 0.5]
	elif look == "dust":
		p["vel"] = [_r() * 1.6 + fx * v * 0.2, _r() * 1.6 + fy * v * 0.2, 0.8 + Vehicle.rnd(js) * 0.8]
	elif look == "spark":
		p["vel"] = [_r() * 3.0 + fx * v * 0.4, _r() * 3.0 + fy * v * 0.4, 1.2 + Vehicle.rnd(js) * 2.4]
	else:
		p["vel"] = [0.0, 0.0, 0.0]
	var cols: Array = row["colours"]
	var c0 := String(cols[mini(cols.size() - 1, tier)])
	p["c0"] = _hex(c0).srgb_to_linear()
	p["c1"] = (_hex(c0) if row.get("tierBy") != null else _hex(String(cols[cols.size() - 1]))).srgb_to_linear()
	p["s0"] = float(row["size"]) * D * (1.0 if spark else 0.8)
	p["s1"] = float(p["s0"]) * 0.3 if spark else float(p["s0"]) * 2.6
	p["o0"] = 1.0 if spark else (0.75 if look == "puff" else 0.6)
	var mat := (p["m"] as MeshInstance3D).material_override as StandardMaterial3D
	mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD if spark else BaseMaterial3D.BLEND_MODE_MIX
	(p["m"] as MeshInstance3D).visible = true
	alive[key] = int(alive.get(key, 0)) + 1


func _r() -> float:
	return Vehicle.rnd(js) - 0.5


func _ring_at(row: Dictionary, e: Dictionary, D: float) -> void:
	var g = _free(rings, 8, "_new_ring")
	if g == null:
		return
	g["on"] = true
	g["age"] = 0.0
	g["life"] = float(row["life"]) if Js.truthy(row.get("life")) else 0.4
	g["size"] = float(row["size"]) * D
	var p: Array = e["pos"]
	(g["m"] as MeshInstance3D).position = _to_g([p[0], p[1], _ent_ground(e) + 0.03])
	_colour(g["m"], _hex(String(row["colours"][0])))
	(g["m"] as MeshInstance3D).visible = true


# the status rows (vehicle.gd) on each part's pass: what the page writes into its fragment, out = mix(base·tint, mix
# colour, mix) + glow, laid over as premultiplied light and a darkening (Godot's blend, not the page's sum in its sRGB)
func _status(F: Dictionary, d: float) -> void:
	var st: Dictionary = Vehicle.status(J, js, F, d, clock, bones.size(), slots)
	for i in overlays.size():
		var sm = overlays[i]
		if sm == null:
			continue
		var u: Dictionary = st["u"][i]
		var tn: Array = u["tint"]
		var mc: Array = u["mixCol"]
		var ad: Array = u["add"]
		(sm as ShaderMaterial).set_shader_parameter("tint", (float(tn[0]) + float(tn[1]) + float(tn[2])) / 3.0)
		(sm as ShaderMaterial).set_shader_parameter("mix_amount", float(u["mix"]))
		(sm as ShaderMaterial).set_shader_parameter("mix_col", Vector3(float(mc[0]), float(mc[1]), float(mc[2])))
		(sm as ShaderMaterial).set_shader_parameter("glow", Vector3(float(ad[0]), float(ad[1]), float(ad[2])))
	for h in halos:
		var o := float(st["halo"].get(h["row"], 0.0))
		var m: MeshInstance3D = h["m"]
		m.visible = o > 0.0
		_alpha(m, o)
	if bubble != null and st["bubble"] is Dictionary:
		var b: Dictionary = st["bubble"]
		bubble.visible = b["on"]
		var c: Array = b["col"]
		(bubble.material_override as ShaderMaterial).set_shader_parameter("col", Vector3(float(c[0]), float(c[1]), float(c[2])))
		(bubble.material_override as ShaderMaterial).set_shader_parameter("alpha", float(b["a"]))


# the big effects: a burst of stars, stars round the head, motion lines, a boost's shock, the pilot's speed lines
func _fx(e: Dictionary, F: Dictionary, d: float, D: float) -> void:
	for row in J.get("fx", []):
		var on := Vehicle.when(row["when"], F) != 0.0
		var key := "fx:" + String(row["id"])
		var was: bool = js["on"].get(key, false)
		js["on"][key] = on
		var look := String(row["look"])
		if look == "screen":
			if lines != null:
				(lines as SpeedLines).want((float(F.get(String(row["by"]), 0.0)) if row.get("by") != null else 1.0) if on else 0.0, row, js)
			continue
		if look == "streak":
			if not on or int(alive.get(String(row["id"]), 0)) >= int(row["budget"]):
				continue
			acc[key] = float(acc.get(key, 0.0)) + float(row["rate"]) * d
			while float(acc[key]) >= 1.0:
				acc[key] = float(acc[key]) - 1.0
				_streak(row, e, D)
			continue
		if not on or was:
			continue
		var at := String(row["at"])
		var a = null
		for x in anchors:
			if x["kind"] == at or String(x["kind"]).split(".")[0] == at:
				a = x
				break
		if a == null:
			continue
		if look == "shock":
			_shock(row, e, D, at)
			continue
		var c := _to_r((a["loc"] as Node3D).global_position)
		var n := int(row["count"]) if Js.truthy(row.get("count")) else 5
		for i in n:
			var cols: Array = row["colours"]
			var s = _free(stars, 40, "_new_star")
			if s == null:
				break
			s["on"] = true
			s["age"] = 0.0
			s["size"] = float(row["size"]) * D * (0.75 + Vehicle.rnd(js) * 0.5)
			s["life"] = float(row["life"]) * (0.85 + Vehicle.rnd(js) * 0.3)
			_colour(s["m"], _hex(String(cols[i % cols.size()])))
			(s["m"] as MeshInstance3D).visible = true
			if look == "orbit":
				s["orbit"] = {"loc": a["loc"], "ph": (float(i) / float(int(row["count"]) if Js.truthy(row.get("count")) else 4)) * TAU, "r": D * 0.55}
			else:
				var th := Vehicle.rnd(js) * TAU
				var sp := 2.2 + Vehicle.rnd(js) * 2.2
				s["orbit"] = null
				s["vel"] = [cos(th) * sp, sin(th) * sp, 1.5 + Vehicle.rnd(js) * 2.5]
				s["pos"] = c.duplicate()


# a streak beside or over the machine along its way: its basis and its place in the page's frame
func _streak(row: Dictionary, e: Dictionary, D: float) -> void:
	var k = _free(streaks, 60, "_new_streak")
	if k == null:
		return
	var h := float(e["heading"])
	var f := [cos(h), sin(h)]
	var sd := [-float(f[1]), float(f[0])]
	var side := -1.0 if Vehicle.rnd(js) < 0.5 else 1.0
	var top := Vehicle.rnd(js) < 0.3
	var off := (Vehicle.rnd(js) - 0.5) * D * 1.6 if top else side * D * (1.1 + Vehicle.rnd(js) * 1.2)
	var up := D * (1.6 + Vehicle.rnd(js) * 0.8) if top else D * (0.2 + Vehicle.rnd(js) * 1.4)
	var ahead := D * (Vehicle.rnd(js) * 2.0 - 0.6)
	var p: Array = e["pos"]
	k["at"] = [float(p[0]) + float(f[0]) * ahead + float(sd[0]) * off, float(p[1]) + float(f[1]) * ahead + float(sd[1]) * off, _ent_ground(e) + up]
	k["R"] = Basis(Vector3(0, 0, 1), h) * Basis(Vector3(1, 0, 0), 0.0 if top else PI / 2.0)
	k["len"] = float(row["size"]) * D * (0.6 + Vehicle.rnd(js) * 0.8)
	k["wid"] = D * 0.035
	_colour(k["m"], _hex(String(row["colours"][0])))
	k["on"] = true
	k["age"] = 0.0
	k["life"] = float(row["life"]) * (0.7 + Vehicle.rnd(js) * 0.6)
	k["key"] = String(row["id"])
	(k["m"] as MeshInstance3D).visible = true
	alive[k["key"]] = int(alive.get(k["key"], 0)) + 1


# one ring behind the machine at the middle of its anchors of a kind (two stacks throw one shock), thin and faint
func _shock(row: Dictionary, e: Dictionary, D: float, at: String) -> void:
	var as_ := anchors.filter(func(b): return b["kind"] == at)
	if as_.is_empty():
		return
	var k = _free(shocks, 4, "_new_shock")
	if k == null:
		return
	var c := Vector3.ZERO
	for b in as_:
		c += (b["loc"] as Node3D).global_position / float(as_.size())
	var r := _to_r(c)
	var h := float(e["heading"])
	k["at"] = [float(r[0]) - cos(h) * D * 0.3, float(r[1]) - sin(h) * D * 0.3, float(r[2])]
	# the ring stands up across the way (three's rotation (0, π/2, h) in its ZYX order)
	k["R"] = Basis(Vector3(0, 0, 1), h) * Basis(Vector3(0, 1, 0), PI / 2.0)
	_colour(k["m"], _hex(String(row["colours"][0])))
	k["on"] = true
	k["age"] = 0.0
	k["life"] = float(row["life"])
	k["size"] = float(row["size"]) * D
	(k["m"] as MeshInstance3D).visible = true


# the tail lamps' ribbons: world points, the newest at the lamp, each fading and narrowing as it ages, turned to the eye
func _trails(F: Dictionary) -> void:
	var T: Dictionary = J["trails"]
	var cam := get_viewport().get_camera_3d() if is_inside_tree() else null
	var eye: Array = _to_r(cam.global_position) if cam != null else [0.0, 0.0, 1e3]
	var N := int(T["points"])
	for tr in trails:
		var p := _to_r((tr["loc"] as Node3D).global_position)
		var pts: Array = tr["pts"]
		var last = pts[0] if not pts.is_empty() else null
		var dd := 1e9 if last == null else Vector3(float(p[0]), float(p[1]), float(p[2])).distance_squared_to(Vector3(float(last["p"][0]), float(last["p"][1]), float(last["p"][2])))
		if float(F["speed"]) > float(T["minSpeed"]) and dd > 0.04:
			pts.push_front({"p": p, "t": clock})
			if pts.size() > N:
				pts.pop_back()
		while not pts.is_empty() and clock - float(pts[pts.size() - 1]["t"]) > float(T["life"]):
			pts.pop_back()
		var im: ImmediateMesh = tr["im"]
		im.clear_surfaces()
		var n := pts.size()
		if n < 2:
			continue
		var A := float(T["amount"]) * (float(T["brake"]) if float(F["braking"]) != 0.0 else 1.0)
		var c: Array = tr["c"]
		var rows := []
		for i in n:
			var q: Vector3 = _vec(pts[i]["p"])
			var a: Vector3 = _vec(pts[maxi(0, i - 1)]["p"])
			var b: Vector3 = _vec(pts[mini(n - 1, i + 1)]["p"])
			var age := maxf(0.0, 1.0 - (clock - float(pts[i]["t"])) / float(T["life"]))
			var hw := (float(T["width"]) / 2.0) * (0.25 + 0.75 * age)
			var s := (b - a).cross(_vec(eye) - q)
			s = s * (hw / s.length()) if s.length() > 1e-6 else Vector3(0, 0, hw)
			var f := A * age * age
			rows.append([q + s, q - s, Color(float(c[0]) * f, float(c[1]) * f, float(c[2]) * f)])
		im.surface_begin(Mesh.PRIMITIVE_TRIANGLES)
		for i in n - 1:
			var r0: Array = rows[i]
			var r1: Array = rows[i + 1]
			for v in [[r0, 0], [r0, 1], [r1, 0], [r0, 1], [r1, 1], [r1, 0]]:
				im.surface_set_color(v[0][2])
				im.surface_add_vertex(_to_g([(v[0][v[1]] as Vector3).x, (v[0][v[1]] as Vector3).y, (v[0][v[1]] as Vector3).z]))
		im.surface_end()


static func _vec(p: Array) -> Vector3:
	return Vector3(float(p[0]), float(p[1]), float(p[2]))


# the pools age: the cards rise, drag and grow; the rings spread; the stars pop and fall or circle; the streaks stretch
func _pools(d: float) -> void:
	for p in parts:
		if not p["on"]:
			continue
		p["age"] = float(p["age"]) + d
		var u := float(p["age"]) / float(p["life"])
		var m: MeshInstance3D = p["m"]
		if u >= 1.0:
			p["on"] = false
			m.visible = false
			alive[p["key"]] = int(alive.get(p["key"], 1)) - 1
			continue
		var vel: Array = p["vel"]
		vel[2] = float(vel[2]) + float(p["grav"]) * d
		var drag := maxf(0.0, 1.0 - d * 2.2)
		vel[0] = float(vel[0]) * drag
		vel[1] = float(vel[1]) * drag
		var pos: Array = p["pos"]
		pos[0] = float(pos[0]) + float(vel[0]) * d
		pos[1] = float(pos[1]) + float(vel[1]) * d
		pos[2] = maxf(0.02, float(pos[2]) + float(vel[2]) * d)
		m.position = _to_g(pos)
		m.scale = Vector3.ONE * (float(p["s0"]) + (float(p["s1"]) - float(p["s0"])) * u) * mpu
		var col: Color = (p["c0"] as Color).lerp(p["c1"], u).linear_to_srgb()
		col.a = float(p["o0"]) * (1.0 - u) * (1.0 - u * 0.3)
		_colour(m, col)
	for g in rings:
		if not g["on"]:
			continue
		g["age"] = float(g["age"]) + d
		var u := float(g["age"]) / float(g["life"])
		var m: MeshInstance3D = g["m"]
		if u >= 1.0:
			g["on"] = false
			m.visible = false
			continue
		m.scale = Vector3.ONE * float(g["size"]) * (0.35 + 0.65 * sqrt(u)) * mpu
		_alpha(m, 0.85 * (1.0 - u))
	for s in stars:
		if not s["on"]:
			continue
		s["age"] = float(s["age"]) + d
		var u := float(s["age"]) / float(s["life"])
		var m: MeshInstance3D = s["m"]
		if u >= 1.0:
			s["on"] = false
			m.visible = false
			continue
		if s["orbit"] is Dictionary:
			var o: Dictionary = s["orbit"]
			var c := _to_r((o["loc"] as Node3D).global_position)
			var ph := float(o["ph"]) + float(s["age"]) * 7.0
			m.position = _to_g([float(c[0]) + cos(ph) * float(o["r"]), float(c[1]) + sin(ph) * float(o["r"]), float(c[2]) + float(o["r"]) * 0.6 + 0.06 * sin(ph * 2.0)])
		else:
			var vel: Array = s["vel"]
			var pos: Array = s["pos"]
			vel[2] = float(vel[2]) - 6.0 * d
			for i in 3:
				pos[i] = float(pos[i]) + float(vel[i]) * d
			m.position = _to_g(pos)
		var pop := u / 0.15 * 1.25 if u < 0.15 else 1.25 - 0.45 * (u - 0.15)
		m.scale = Vector3.ONE * float(s["size"]) * pop * mpu
		_alpha(m, (1.0 - u) / 0.3 if u > 0.7 else 1.0)
	for k in streaks:
		if not k["on"]:
			continue
		k["age"] = float(k["age"]) + d
		var u := float(k["age"]) / float(k["life"])
		var m: MeshInstance3D = k["m"]
		if u >= 1.0:
			k["on"] = false
			m.visible = false
			alive[k["key"]] = int(alive.get(k["key"], 1)) - 1
			continue
		var sc := Basis.from_scale(Vector3(float(k["len"]) * (0.4 + 0.6 * minf(1.0, u * 3.0)), float(k["wid"]), 1.0))
		m.transform = Transform3D(_basis_g((k["R"] as Basis) * sc) * mpu, _to_g(k["at"]))
		_alpha(m, 0.75 * (1.0 - u))
	for k in shocks:
		if not k["on"]:
			continue
		k["age"] = float(k["age"]) + d
		var u := float(k["age"]) / float(k["life"])
		var m: MeshInstance3D = k["m"]
		if u >= 1.0:
			k["on"] = false
			m.visible = false
			continue
		var s := float(k["size"]) * (0.2 + 0.8 * sqrt(u))
		m.transform = Transform3D(_basis_g((k["R"] as Basis) * Basis.from_scale(Vector3.ONE * s)) * mpu, _to_g(k["at"]))
		_alpha(m, 0.5 * (1.0 - u) * (1.0 - u))


# the pilot's speed lines: streaks from past the screen's edges toward its middle, thrown again each frame
class SpeedLines extends Control:
	const Veh := preload("res://kernel/vehicle.gd")
	var amt := 0.0
	var row = null
	var js = null

	func want(a: float, r, state) -> void:
		amt += (a - amt) * 0.25
		row = r
		js = state
		queue_redraw()

	func _draw() -> void:
		if amt < 0.03 or js == null:
			return
		var w := size.x
		var h := size.y
		var cx := w / 2.0
		var cy := h * 0.46
		var n := int(round((float(row["count"]) if row != null and row.get("count") != null else 40.0) * amt))
		var col := Color.html(String(row["colours"][0])) if row != null else Color.WHITE
		var R := sqrt(w * w + h * h) * 0.55
		for i in n:
			var t := Veh.rnd(js) * TAU
			var x0 := cx + cos(t) * R
			var y0 := cy + sin(t) * R * 0.8
			var k := 0.18 + Veh.rnd(js) * 0.32
			col.a = (0.25 + Veh.rnd(js) * 0.55) * amt
			draw_line(Vector2(x0, y0), Vector2(x0 + (cx - x0) * k, y0 + (cy - y0) * k), col, 1.0 + Veh.rnd(js) * 3.0)
