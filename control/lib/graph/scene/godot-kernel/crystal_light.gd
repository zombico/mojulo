extends Node3D
# mojulo-godot kernel — the crystal light rig (crystal-rig R5): lamps whose beams pass through the level's crystals,
# each gem an operator, performed live from score.crystalLight. A port of lib/graph/scene/crystal-rig.js rigKernel:
# the same operators and constants, the same solver, run in the score's own frame (z-up, metres) so the web and the
# engine choose the same beams; points convert to Godot's y-up only to raycast and to draw. Beams stop at the level's
# meshes: a trimesh collision per non-crystal mesh on a layer of its own that the walker never touches. Movers do not
# travel, so the stones stand at rest; the ruby still pulses on its clock and targets still light.
#
# Headless probe: prints "[mojulo-crystal] …" (segments, pools, glows, lit targets, a hash check) on frame 2.

const LIGHT_LAYER := 1 << 19          # collision layer 20: the light's own world
const CMF := [[0.001368, 0.000039, 0.00645], [0.004243, 0.00012, 0.02005], [0.01431, 0.000396, 0.06785], [0.04351, 0.00121, 0.2074], [0.13438, 0.004, 0.6456], [0.2839, 0.0116, 1.3856], [0.34828, 0.023, 1.74706], [0.3362, 0.038, 1.77211], [0.2908, 0.06, 1.6692], [0.19536, 0.09098, 1.28764], [0.09564, 0.13902, 0.81295], [0.03201, 0.20802, 0.46518], [0.0049, 0.323, 0.272], [0.0093, 0.503, 0.1582], [0.06327, 0.71, 0.07825], [0.1655, 0.862, 0.04216], [0.2904, 0.954, 0.0203], [0.43345, 0.99495, 0.00875], [0.5945, 0.995, 0.0039], [0.7621, 0.952, 0.0021], [0.9163, 0.87, 0.00165], [1.0263, 0.757, 0.0011], [1.0622, 0.631, 0.0008], [1.0026, 0.503, 0.00034], [0.85445, 0.381, 0.00019], [0.6424, 0.265, 0.00005], [0.4479, 0.175, 0.00002], [0.2835, 0.107, 0], [0.1649, 0.061, 0], [0.0874, 0.032, 0], [0.04677, 0.017, 0], [0.0227, 0.00821, 0], [0.011359, 0.004102, 0]]
const FAN_BANDS := [640.0, 590.0, 540.0, 490.0, 445.0]
const GATE_TINT := Vector3(0.3, 1.0, 0.22)

var stones: Array = []
var lamps: Array = []
var targets: Array = []
var budget: Dictionary = {}
var gain := 1.0
var clock := 0.0
var frame := 0
var lit: Dictionary = {}
var last: Dictionary = {}
var beams: MeshInstance3D
var beam_mesh: ImmediateMesh
var glows: MultiMeshInstance3D
var pools: MultiMeshInstance3D


static func yup(v: Vector3) -> Vector3:
	return Vector3(v.x, v.z, -v.y)


static func zup(v: Vector3) -> Vector3:
	return Vector3(v.x, -v.z, v.y)


static func v3(a) -> Vector3:
	return Vector3(float(a[0]), float(a[1]), float(a[2]))


func setup(rig: Dictionary, level: Node) -> void:
	for s in rig.get("stones", []):
		var st := { "at": v3(s["at"]), "axis": v3(s["axis"]).normalized(), "x": v3(s.get("x", [1, 0, 0])), "r": float(s["r"]),
			"op": s["op"] if s.get("op") is String else "", "seed": int(s.get("seed", 0)), "mm": float(s.get("mm", 0.0)),
			"spread": s.get("spread"), "bend": s.get("bend"), "tint": v3(s["tint"]) if s.get("tint") is Array else null }
		stones.append(st)
	for l in rig.get("lamps", []):
		lamps.append({ "o": v3(l["o"]), "d": v3(l["d"]).normalized(), "color": v3(l.get("color", [1, 1, 1])), "power": float(l.get("power", 1.0)), "width": float(l.get("width", 0.01)) })
	for g in rig.get("targets", []):
		targets.append({ "id": String(g["id"]), "at": v3(g["at"]), "r": float(g["r"]), "want": g.get("want", {}) })
	budget = rig.get("budget", {})
	gain = float(rig.get("gain", 1.0))
	_light_world(level)
	_build_draw()


# the light's world: every drawn, non-crystal mesh as trimesh collision on LIGHT_LAYER; the GLB's frozen frame hidden
func _light_world(level: Node) -> void:
	for mi in level.find_children("*", "MeshInstance3D", true, false):
		var names := String(mi.name)
		if mi.mesh != null:
			for s in range(mi.mesh.get_surface_count()):
				var m: Material = mi.get_active_material(s)
				names += "," + (m.resource_name if m != null else "")
		if "crystal-light" in names or "crystal_light" in names:
			mi.visible = false
			continue
		if ":crystal" in names or mi.mesh == null or not mi.is_visible_in_tree():
			continue
		mi.create_trimesh_collision()
		for c in mi.get_children():
			if c is StaticBody3D:
				(c as StaticBody3D).collision_layer = LIGHT_LAYER
				(c as StaticBody3D).collision_mask = 0
	for l in level.find_children("*", "Light3D", true, false):
		if "crystal-light" in String(l.name) or "crystal_light" in String(l.name):
			l.visible = false


func _build_draw() -> void:
	beam_mesh = ImmediateMesh.new()
	beams = MeshInstance3D.new()
	beams.mesh = beam_mesh
	beams.material_override = _additive(null, false)
	beams.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(beams)
	var radial := GradientTexture2D.new()
	var gr := Gradient.new()
	gr.offsets = PackedFloat32Array([0.0, 0.2, 0.55, 1.0])
	gr.colors = PackedColorArray([Color(1, 1, 1, 1), Color(1, 1, 1, 0.6), Color(1, 1, 1, 0.14), Color(1, 1, 1, 0)])
	radial.gradient = gr
	radial.fill = GradientTexture2D.FILL_RADIAL
	radial.fill_from = Vector2(0.5, 0.5)
	radial.fill_to = Vector2(1.0, 0.5)
	glows = _multi(QuadMesh.new(), _additive(radial, true))
	pools = _multi(PlaneMesh.new(), _additive(radial, false))
	for l in lamps:
		var m := MeshInstance3D.new()
		var sm := SphereMesh.new()
		sm.radius = l["width"] * 2.2
		sm.height = l["width"] * 4.4
		m.mesh = sm
		var mat := StandardMaterial3D.new()
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		mat.albedo_color = Color(l["color"].x, l["color"].y, l["color"].z)
		m.material_override = mat
		m.position = yup(l["o"])
		add_child(m)


func _additive(tex: Texture2D, billboard: bool) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	m.vertex_color_use_as_albedo = true
	if tex != null:
		m.albedo_texture = tex
	if billboard:
		m.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	return m


func _multi(mesh: Mesh, mat: Material) -> MultiMeshInstance3D:
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.mesh = mesh
	mm.instance_count = int(budget.get("beams", 96)) * 4 + 8
	mm.visible_instance_count = 0
	var node := MultiMeshInstance3D.new()
	node.multimesh = mm
	node.material_override = mat
	node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(node)
	return node


# ── the operators (crystal-rig.js rigKernel, ported) ──────────────────────────────────────────────────────────

static func hash01(n: int) -> float:
	var x := (n ^ 0x9e3779b9) & 0xFFFFFFFF
	x = ((x ^ (x >> 16)) * 0x85ebca6b) & 0xFFFFFFFF
	x = ((x ^ (x >> 13)) * 0xc2b2ae35) & 0xFFFFFFFF
	return float((x ^ (x >> 16)) & 0xFFFFFFFF) / 4294967296.0


static func lambda_color(nm: float) -> Vector3:
	var x := clampf((nm - 380.0) / 10.0, 0.0, 31.999)
	var i := int(floor(x))
	var f := x - i
	var c := Vector3()
	for k in 3:
		c[k] = CMF[i][k] + (CMF[i + 1][k] - CMF[i][k]) * f
	var L := Vector3(maxf(0, 3.2406 * c.x - 1.5372 * c.y - 0.4986 * c.z), maxf(0, -0.9689 * c.x + 1.8758 * c.y + 0.0415 * c.z), maxf(0, 0.0557 * c.x - 0.204 * c.y + 1.057 * c.z))
	var m := maxf(L.x, maxf(L.y, L.z))
	return L / (m if m > 0 else 1.0)


static func whiteness(c: Vector3) -> float:
	var mx := maxf(c.x, maxf(c.y, c.z))
	return minf(c.x, minf(c.y, c.z)) / mx if mx > 0 else 0.0


static func color_name(c: Vector3, lam: float) -> String:
	if lam > 0:
		return "violet" if lam < 450 else "blue" if lam < 490 else "cyan" if lam < 520 else "green" if lam < 565 else "yellow" if lam < 590 else "orange" if lam < 625 else "red"
	if whiteness(c) > 0.6:
		return "white"
	var s := Color(c.x, c.y, c.z).linear_to_srgb()
	var h := s.h * 360.0
	return "red" if (h < 15 or h >= 330) else "orange" if h < 40 else "yellow" if h < 70 else "green" if h < 160 else "cyan" if h < 200 else "blue" if h < 255 else "violet"


static func perp(v: Vector3) -> Vector3:
	return v.cross(Vector3(1, 0, 0) if absf(v.x) < 0.9 else Vector3(0, 1, 0)).normalized()


static func pulse_at(p, t: float) -> float:
	if p == null:
		return 1.0
	var x := fposmod(t / float(p["period"]) + float(p["phase"]), 1.0)
	return sin(PI * x / float(p["duty"])) if x < float(p["duty"]) else 0.0


func _out(b: Dictionary, o: Vector3, d: Vector3, extra: Dictionary) -> Dictionary:
	var nb := { "o": o, "d": d.normalized(), "color": b["color"], "power": b["power"], "E": b["E"], "lambda": b["lambda"], "width": b["width"], "gen": int(b["gen"]) + 1, "pulse": null, "key": "" }
	nb.merge(extra, true)
	return nb


func _operate(b: Dictionary, s: Dictionary, entry: float) -> Dictionary:
	var beams_out: Array = []
	var glows_out: Array = []
	var ax: Vector3 = s["axis"]
	var d_in: Vector3 = b["d"]
	var col: Vector3 = b["color"]
	var r: float = s["r"]
	var exitp: Vector3 = b["o"] + d_in * (entry + 2.0 * r)
	match s["op"]:
		"relay":
			var d := ax if ax.dot(d_in) >= 0 else -ax
			var twist := deg_to_rad(21.7 * (s["mm"] if s["mm"] > 0 else 2.0 * r * 10.0))
			var E = null
			if b["E"] != null:
				E = (b["E"] - d * b["E"].dot(d)).normalized().rotated(d, twist)
			var tint: Vector3 = s["tint"] if s["tint"] != null else Vector3.ONE
			var c := col * tint
			var m := maxf(c.x, maxf(c.y, c.z))
			if m <= 0:
				m = 1.0
			beams_out.append(_out(b, s["at"] + d * r * 1.1, d, { "power": b["power"] * 0.95 * m, "color": c / m, "E": E, "lambda": 0.0 if s["tint"] != null else b["lambda"] }))
			glows_out.append({ "p": s["at"], "color": c / m, "power": b["power"] * 0.08 })
		"fan":
			var spread: float = 26.0 if s["spread"] == null else float(s["spread"])
			var bend: float = 14.0 if s["bend"] == null else float(s["bend"])
			var pd := d_in - ax * d_in.dot(ax)
			var fwd := perp(ax) if pd.length() < 1e-6 else pd.normalized()
			var o: Vector3 = s["at"] + fwd * r * 1.1
			if whiteness(col) < 0.6 and b["lambda"] > 0:
				var k: float = (b["lambda"] - 445.0) / (640.0 - 445.0)
				beams_out.append(_out(b, o, fwd.rotated(ax, deg_to_rad(bend + spread * (0.5 - k))), { "power": b["power"] * 0.92 }))
				glows_out.append({ "p": s["at"], "color": col, "power": b["power"] * 0.1 })
			else:
				for i in FAN_BANDS.size():
					var a := deg_to_rad(bend + spread * (float(i) / (FAN_BANDS.size() - 1) - 0.5))
					beams_out.append(_out(b, o, fwd.rotated(ax, a), { "color": lambda_color(FAN_BANDS[i]), "lambda": FAN_BANDS[i], "power": b["power"] * 0.92 / FAN_BANDS.size(), "E": null, "width": b["width"] * 0.7 }))
				glows_out.append({ "p": s["at"], "color": Vector3.ONE, "power": b["power"] * 0.15 })
				for i in 6:
					var sd: int = s["seed"]
					var g := Vector3(hash01(sd * 31 + i) - 0.5, hash01(sd * 17 + i) - 0.5, hash01(sd * 7 + i) - 0.3).normalized()
					glows_out.append({ "p": s["at"] + g * r, "color": lambda_color(445.0 + 39.0 * i), "power": b["power"] * 0.04 })
		"twin":
			var cp := ax - d_in * ax.dot(d_in)
			var u := perp(d_in) if cp.length() < 1e-6 else cp.normalized()
			var Eo := d_in.cross(u).normalized()
			var Ee := u
			var po := 0.5 if b["E"] == null else pow(b["E"].dot(Eo), 2)
			var pe := 0.5 if b["E"] == null else pow(b["E"].dot(Ee), 2)
			var off := u * (2.0 * r * tan(deg_to_rad(6.24)) * 5.0)
			if po > 0.02:
				beams_out.append(_out(b, exitp, d_in, { "power": b["power"] * po, "E": Eo, "key": "o" }))
			if pe > 0.02:
				beams_out.append(_out(b, exitp + off, d_in, { "power": b["power"] * pe, "E": Ee, "key": "e" }))
			glows_out.append({ "p": s["at"], "color": col, "power": b["power"] * 0.05 })
		"gate":
			var cp := ax - d_in * ax.dot(d_in)
			var pass_dir = null if cp.length() < 1e-6 else cp.normalized()
			var share := 0.0025
			if pass_dir != null:
				share = 0.5 if b["E"] == null else maxf(0.0025, pow(b["E"].dot(pass_dir), 2))
			var c := col * GATE_TINT
			var m := maxf(c.x, maxf(c.y, c.z))
			if m <= 0:
				m = 1.0
			if share > 0.01:
				beams_out.append(_out(b, exitp, d_in, { "power": b["power"] * share * m, "color": c / m, "E": pass_dir, "lambda": 535.0 }))
			glows_out.append({ "p": s["at"], "color": Vector3(0.3, 1, 0.3), "power": b["power"] * (1.0 - share) * 0.12 })
		"charge":
			var sum := col.x + col.y + col.z
			if sum <= 0:
				sum = 1.0
			var red_share := 0.0
			if b["lambda"] > 0:
				red_share = 1.0 if b["lambda"] > 640 else 0.0
			else:
				red_share = col.x / sum * (0.35 if whiteness(col) > 0.6 else 1.0)
			var passp: float = b["power"] * red_share * 0.9
			var absorbed: float = b["power"] * (1.0 - red_share) * 0.7
			var red := lambda_color(694.0)
			var period := clampf(0.25 / maxf(absorbed, 1e-3), 0.35, 2.4)
			var phase := hash01(s["seed"])
			if passp > 0.01:
				beams_out.append(_out(b, exitp, d_in, { "power": passp, "color": red, "lambda": 694.0 }))
			if absorbed > 0.01:
				beams_out.append(_out(b, s["at"] + ax * r * 1.1, ax, { "power": absorbed / 0.2, "color": red, "lambda": 694.0, "E": null, "width": b["width"] * 0.45, "pulse": { "period": period, "duty": 0.2, "phase": phase } }))
			glows_out.append({ "p": s["at"], "color": red, "power": absorbed * 0.8 + passp * 0.1, "pulse": { "period": period, "duty": 0.6, "phase": phase } if absorbed > 0.01 else null })
		"iris":
			var sx: Vector3 = s["x"] - ax * s["x"].dot(ax)
			var x := sx.normalized() if sx.length() > 1e-6 else perp(ax)
			var y := ax.cross(x)
			var sd: int = s["seed"]
			for j in 9:
				var gl := Vector3(hash01(sd * 101 + j) - 0.5, hash01(sd * 211 + j) - 0.5, hash01(sd * 307 + j) - 0.5).normalized()
				var g := x * gl.x + y * gl.y + ax * gl.z
				if g.dot(d_in) > 0:
					g = -g
				var cosv := -d_in.dot(g)
				var D := 200.0 + 130.0 * hash01(sd * 401 + j)
				var lam := 2.0 * D * sqrt(2.0 / 3.0) * 1.42 * cosv
				if lam < 405 or lam > 690:
					continue
				var d := d_in - g * 2.0 * d_in.dot(g)
				beams_out.append(_out(b, s["at"] + g * r, d, { "color": lambda_color(lam), "lambda": lam, "power": b["power"] * 0.55 / 9.0 * 1.6, "E": null, "width": b["width"] * 0.55 }))
				glows_out.append({ "p": s["at"] + g * r * 0.7, "color": lambda_color(lam), "power": b["power"] * 0.05 })
	return { "beams": beams_out, "glows": glows_out }


static func hit_sphere(o: Vector3, d: Vector3, c: Vector3, r: float) -> float:
	var oc := o - c
	var bq := oc.dot(d)
	var disc := bq * bq - (oc.dot(oc) - r * r)
	if disc < 0:
		return -1.0
	var t := -bq - sqrt(disc)
	return t if t > 1e-9 else -1.0


func _wall(o: Vector3, d: Vector3, tmax: float):
	var space := get_world_3d().direct_space_state
	var og := yup(o)
	var q := PhysicsRayQueryParameters3D.create(og, og + yup(d) * tmax, LIGHT_LAYER)
	q.hit_back_faces = true
	var h := space.intersect_ray(q)
	if h.is_empty():
		return null
	var n := zup(h["normal"])
	if n.dot(d) > 0:
		n = -n
	return { "t": (h["position"] - og).length(), "n": n }


func solve(t: float) -> Dictionary:
	var max_len := float(budget.get("maxLen", 10.0))
	var depth := int(budget.get("depth", 6))
	var cap := int(budget.get("beams", 96))
	var min_power := float(budget.get("minPower", 0.02))
	var segs: Array = []
	var pls: Array = []
	var gls: Array = []
	var caught: Dictionary = {}
	var queue: Array = []
	for l in lamps:
		queue.append({ "o": l["o"], "d": l["d"], "color": l["color"], "power": l["power"], "E": null, "lambda": 0.0, "width": l["width"], "gen": 0, "from": -1, "pulse": null, "key": "" })
	var n := 0
	while queue.size() > 0 and n < cap:
		var b: Dictionary = queue.pop_front()
		n += 1
		var best_t := -1.0
		var best_i := -1
		var best_g := -1
		for i in stones.size():
			if i == b["from"]:
				continue
			var te := hit_sphere(b["o"], b["d"], stones[i]["at"], stones[i]["r"])
			if te > 0 and te < max_len and (best_t < 0 or te < best_t):
				best_t = te
				best_i = i
		for gi in targets.size():
			var te := hit_sphere(b["o"], b["d"], targets[gi]["at"], targets[gi]["r"])
			if te > 0 and te < max_len and (best_t < 0 or te < best_t):
				best_t = te
				best_g = gi
				best_i = -1
		var w = _wall(b["o"], b["d"], best_t if best_t > 0 else max_len)
		var seg := { "a": b["o"], "color": b["color"], "power": b["power"], "width": b["width"], "pulse": b["pulse"] }
		if w != null and (best_t < 0 or w["t"] < best_t):
			seg["b"] = b["o"] + b["d"] * w["t"]
			pls.append({ "p": seg["b"], "n": w["n"], "color": b["color"], "power": b["power"], "width": b["width"], "pulse": b["pulse"] })
		elif best_g >= 0:
			seg["b"] = b["o"] + b["d"] * best_t
			var id: String = targets[best_g]["id"]
			var L: Dictionary = caught.get(id, { "power": 0.0, "colors": {} })
			var nm := color_name(b["color"], b["lambda"])
			L["power"] += b["power"]
			L["colors"][nm] = L["colors"].get(nm, 0.0) + b["power"]
			caught[id] = L
			gls.append({ "p": targets[best_g]["at"], "color": b["color"], "power": b["power"] * 0.6, "pulse": b["pulse"], "size": targets[best_g]["r"] })
		elif best_i >= 0 and (stones[best_i]["op"] == "" or int(b["gen"]) >= depth):
			seg["b"] = b["o"] + b["d"] * best_t
			var st: Dictionary = stones[best_i]
			gls.append({ "p": st["at"], "color": b["color"], "power": b["power"] * 0.5, "pulse": b["pulse"], "size": st["r"] })
			pls.append({ "p": seg["b"], "n": (seg["b"] - st["at"]).normalized(), "color": b["color"], "power": b["power"] * 0.6, "width": b["width"], "pulse": b["pulse"] })
		elif best_i >= 0:
			seg["b"] = b["o"] + b["d"] * best_t
			var res := _operate(b, stones[best_i], best_t)
			for g in res["glows"]:
				g["size"] = stones[best_i]["r"]
				gls.append(g)
			for nb in res["beams"]:
				if nb["power"] >= min_power:
					nb["from"] = best_i
					if nb["pulse"] == null:
						nb["pulse"] = b["pulse"]
					queue.append(nb)
		else:
			seg["b"] = b["o"] + b["d"] * max_len
		segs.append(seg)
	return { "segments": segs, "pools": pls, "glows": gls, "lit": caught, "beams": n }


static func satisfied(c, want) -> bool:
	if c == null:
		return false
	var mn := float(want.get("min", 0.05)) if want is Dictionary else 0.05
	if not (want is Dictionary) or not want.has("color"):
		return c["power"] >= mn
	return float(c["colors"].get(want["color"], 0.0)) >= mn


func _physics_process(delta: float) -> void:
	clock += delta
	frame += 1
	var res := solve(clock)
	_draw(res)
	for g in targets:
		var on := satisfied(res["lit"].get(g["id"]), g["want"])
		if on != bool(lit.get(g["id"], false)):
			lit[g["id"]] = on
			print("[mojulo-crystal] target '%s' %s" % [g["id"], "lit" if on else "dark"])
	if frame == 2:
		var sum := 0.0
		for sg in res["segments"]:
			sum += sg["b"].x + sg["b"].y + sg["b"].z
		print("[mojulo-crystal] segments=%d pools=%d glows=%d beams=%d lit=%s endsum=%.3f hash=%.9f" % [res["segments"].size(), res["pools"].size(), res["glows"].size(), res["beams"], JSON.stringify(lit), sum, hash01(12345)])


func _draw(res: Dictionary) -> void:
	beam_mesh.clear_surfaces()
	var any := false
	for s in res["segments"]:
		var k := pulse_at(s["pulse"], clock)
		var br: float = (0.22 + 0.95 * s["power"]) * k * gain
		if br < 0.003:
			continue
		if not any:
			beam_mesh.surface_begin(Mesh.PRIMITIVE_TRIANGLES)
			any = true
		var a := yup(s["a"])
		var b := yup(s["b"])
		var u := (b - a).normalized()
		var p1 := perp(u)
		var p2 := u.cross(p1)
		var w: float = s["width"] * (0.55 + 0.8 * sqrt(s["power"]))
		var c := Color(s["color"].x * br, s["color"].y * br, s["color"].z * br, 1.0)
		var c0 := Color(c.r, c.g, c.b, 0.0)
		for side in [p1, p2]:
			for h in [-1.0, 1.0]:
				var e: Vector3 = side * w * h
				for v in [[a, c], [b, c], [b + e, c0], [a, c], [b + e, c0], [a + e, c0]]:
					beam_mesh.surface_set_color(v[1])
					beam_mesh.surface_add_vertex(v[0])
	if any:
		beam_mesh.surface_end()
	var cam := get_viewport().get_camera_3d()
	var gm := glows.multimesh
	var ng := 0
	for g in res["glows"]:
		var k := pulse_at(g.get("pulse"), clock)
		if k < 0.01 or ng >= gm.instance_count:
			continue
		var size: float = float(g.get("size", 0.05)) * (0.6 + 2.5 * sqrt(g["power"])) * 2.0
		var p := yup(g["p"])
		if cam != null:
			var to := cam.global_position - p
			p += to.normalized() * minf(size * 0.6, to.length() * 0.5)
		gm.set_instance_transform(ng, Transform3D(Basis().scaled(Vector3(size, size, size)), p))
		var br := minf(1.5, 0.3 + 2.0 * g["power"]) * k * gain
		gm.set_instance_color(ng, Color(g["color"].x * br, g["color"].y * br, g["color"].z * br, 1.0))
		ng += 1
	gm.visible_instance_count = ng
	var pm := pools.multimesh
	var np := 0
	for p in res["pools"]:
		var k := pulse_at(p["pulse"], clock)
		if k < 0.01 or np >= pm.instance_count:
			continue
		var r: float = p["width"] * 3.0 * (0.6 + sqrt(p["power"])) * 2.2
		var n := yup(p["n"])
		var basis := Basis(Quaternion(Vector3.UP, n)).scaled(Vector3(r, r, r))
		pm.set_instance_transform(np, Transform3D(basis, yup(p["p"]) + n * r * 0.02))
		var br: float = (0.35 + 1.1 * p["power"]) * k * gain
		pm.set_instance_color(np, Color(p["color"].x * br, p["color"].y * br, p["color"].z * br, 1.0))
		np += 1
	pm.visible_instance_count = np
