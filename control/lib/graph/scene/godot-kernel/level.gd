extends Node3D
# mojulo-godot kernel — the level interpreter (godot-handoff.plan.md G6).
# Hand-authored and versioned (kernel/VERSION); packs ship DATA, this script
# performs it. Reads the engine-agnostic score.json (z-up frame) and realizes
# it with stock Godot nodes: ground + AABB colliders, cameras, the walker,
# the declarative mechanics vocabulary (reach-exit / collect /
# hazard-damage / survive / fail-on-death), and the locomotion rows
# (walking-suit-backport.md): first-claimant figures play their idle, the
# player's figure follows the walker as a third-person suit. One score, two
# instruments — game-shell.js is the web kernel, this is the Godot one.
#
# Headless probe (G-P), run by the export driver — no window needed:
#   godot --headless --path <pack> <level.tscn> -- --mojulo-autowalk --mojulo-frames=120
# prints a [mojulo-dump] ledger (walker, suit, figures) at frame 1 and at
# --mojulo-frames, plus a [mojulo-perf] line (CPU-side monitors), then quits.

@export_file("*.json") var score_path: String = ""
@export var music_path: String = ""
@export var music_db: float = 0.0

const WalkerScript := preload("res://kernel/walker.gd")
const HAZARD_COOLDOWN := 0.8

var score: Dictionary = {}
var eye := 1.7
var eye_scale := 1.0
var walker: CharacterBody3D = null
var state := "playing"  # playing | complete | failed

# mechanics state
var exit_zones: Array = []      # {pos, radius?, half?, planar}
var pickups: Array = []         # {item, into, pos, radius, taken}
var hazards: Array = []         # {pos, radius, damage, cool}
var survive_left := -1.0
var fail_on_death := false
var hp := -1.0
var start_hp := 100.0
var bag: Dictionary = {}

var hud: Label = null
var banner_layer: CanvasLayer = null

# rigs (walking-suit-backport G-L1..G-L5)
var suit: Node3D = null              # the player's figure wrapper, driven by the walker
var suit_player: AnimationPlayer = null
var suit_idle := ""
var suit_walk := ""
var suit_base_basis := Basis.IDENTITY
var suit_base_yaw := 0.0
var suit_moving := false
var figure_players: Array = []       # [{node, player, anim}] — ambient idles, for the dump
var probe_frames := -1               # --mojulo-frames=N: dump at frame N and quit
var probe_frame := 0
var _marker_res: Dictionary = {}     # marker kind -> the one shared Mesh (material on it)


static func to_yup(v: Array) -> Vector3:
	return Vector3(float(v[0]), float(v[2]), -float(v[1]))


# Score strings that may be JSON null (an entity with no figure, a level
# with no player): String(null) is a GDScript error, so read through this.
static func s_(v) -> String:
	return String(v) if (v is String or v is StringName) else ""


func _ready() -> void:
	var txt := FileAccess.get_file_as_string(score_path)
	var parsed = JSON.parse_string(txt)
	if parsed is Dictionary:
		score = parsed
	eye = float(score.get("eye", 1.7))
	eye_scale = maxf(0.5, eye / 1.7)
	_fix_materials()
	_fix_crystals()
	_fix_water()
	_apply_rim()
	if _fix_lights() > 0:
		_build_environment()
	_hide_player_double()
	_mark_meshless_entities()
	_build_colliders()
	_build_crystal_light()
	_build_cameras()
	_spawn_walker()
	_build_rigs()
	_build_mechanics()
	_start_music()
	_build_hud()
	_read_probe_args()


# G0 material contract (Finding 1): Godot's glTF import does not set
# vertex_color_use_as_albedo — without this every vertex-coloured face
# renders white. COLOR_0 is linear: is_srgb stays false.
#
# Texture contract (skin-over-mesh phase 3): a textured surface arrives from
# the GLB with albedo_texture already set (TEXCOORD_0 + embedded PNG). Setting
# vertex_color_use_as_albedo on it MULTIPLIES texture x vertex colour — which
# is exactly the web renderer's texel x baked-light contract for `textureLit`
# groups; unlit stickers carry no COLOR_0 (vertex colour defaults to white),
# so the texture shows as-is under KHR_materials_unlit's unshaded mode.
# Nothing texture-specific to do here — the fixup composes correctly.
func _fix_materials() -> void:
	for mi in find_children("*", "MeshInstance3D", true, false):
		var mesh: Mesh = mi.mesh
		if mesh == null:
			continue
		for s in range(mesh.get_surface_count()):
			var mat: Material = mi.get_active_material(s)
			if mat is StandardMaterial3D:
				mat.vertex_color_use_as_albedo = true
				mat.vertex_color_is_srgb = false


# Crystals (crystal-rig R5): Godot's glTF import drops KHR_materials_transmission / ior / volume, so a clear stone
# arrives opaque white. score.crystals carries each `<group>:crystal` material's optics; its surfaces get a
# refraction material of their own: the body colour (white light after 1 cm), more opaque the more coloured, screen-space
# refraction scaled by the index, a specular from the index's Fresnel F0, glow as emission. An opal is a dark
# body under a clearcoat. Absent score.crystals, nothing changes.
func _fix_crystals() -> void:
	var table: Dictionary = score.get("crystals", {})
	if table.is_empty():
		return
	for mi in find_children("*", "MeshInstance3D", true, false):
		var mesh: Mesh = mi.mesh
		if mesh == null:
			continue
		for s in range(mesh.get_surface_count()):
			var mat: Material = mi.get_active_material(s)
			if mat == null or not table.has(mat.resource_name):
				continue
			var c: Dictionary = table[mat.resource_name]
			var m := StandardMaterial3D.new()
			m.resource_name = mat.resource_name
			var nd := float(c.get("nD", 1.5))
			var f0 := pow((nd - 1.0) / (nd + 1.0), 2)
			if c.get("opal", false):
				m.albedo_color = Color(0.012, 0.013, 0.018).linear_to_srgb()
				m.roughness = 0.1
				m.clearcoat_enabled = true
				m.clearcoat = 1.0
				m.clearcoat_roughness = 0.03
			else:
				var body: Array = c.get("body", [1, 1, 1])
				var col := Color(float(body[0]), float(body[1]), float(body[2])).linear_to_srgb()
				# a clear stone mostly refracts; a coloured one shows its colour: alpha rises with the body's saturation
				var hi := maxf(col.r, maxf(col.g, col.b))
				col.a = 0.3 + 0.55 * (1.0 - minf(col.r, minf(col.g, col.b)) / maxf(hi, 1e-3))
				m.albedo_color = col
				m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_DEPTH_PRE_PASS
				m.roughness = 0.02
				m.metallic_specular = clampf(f0 / 0.08, 0.0, 1.0)
				m.refraction_enabled = true
				m.refraction_scale = clampf((nd - 1.0) * 0.08, 0.0, 0.2)
				m.rim_enabled = true
				m.rim = 0.2
				m.rim_tint = 0.5
				# the level is unlit (baked); a lit crystal in an unlit room reads grey, so its colour also glows faintly
				m.emission_enabled = true
				m.emission = Color(float(body[0]), float(body[1]), float(body[2])).linear_to_srgb() * (col.a - 0.25)
			var glow = c.get("glow")
			if glow is Array:
				m.emission_enabled = true
				m.emission = Color(float(glow[0]), float(glow[1]), float(glow[2]))
				m.emission_energy_multiplier = 1.5
			mi.set_surface_override_material(s, m)


# Water (aqua rendering, kernel 0.4.0): Godot's glTF import drops KHR_materials_transmission / ior / volume, so a
# `water:<kind>` node arrives as an opaque lit sheet. score.water carries each node's look (in metres, mojulo's z-up
# vectors); its surfaces get kernel/water.gdshader — depth absorption over the refracted screen, shore foam, Fresnel
# sky, sun glint, drifting ripples. Animated seas arrive as one frozen frame; their ripples move here, the waves do not.
# Absent score.water, nothing changes.
func _fix_water() -> void:
	var table: Dictionary = score.get("water", {})
	if table.is_empty():
		return
	var shader: Shader = load("res://kernel/water.gdshader")
	if shader == null:
		return
	for mi in find_children("*", "MeshInstance3D", true, false):
		var mesh: Mesh = mi.mesh
		if mesh == null:
			continue
		for s in range(mesh.get_surface_count()):
			var mat: Material = mi.get_active_material(s)
			if mat == null or not table.has(mat.resource_name):
				continue
			var w: Dictionary = table[mat.resource_name]
			var rip: Dictionary = w.get("ripple", {})
			var sm := ShaderMaterial.new()
			sm.resource_name = mat.resource_name
			sm.shader = shader
			sm.set_shader_parameter("sigma", _vec3(w.get("sigma", [0.45, 0.09, 0.06])))
			sm.set_shader_parameter("tint", _vec3(w.get("tint", [0.03, 0.27, 0.32])))
			sm.set_shader_parameter("zenith", _vec3(w.get("zenith", [0.16, 0.3, 0.52])))
			sm.set_shader_parameter("horizon", _vec3(w.get("horizon", [0.62, 0.7, 0.78])))
			sm.set_shader_parameter("foam_color", _vec3(w.get("foam", [0.86, 0.92, 0.96])))
			if w.has("sun"):
				sm.set_shader_parameter("sun_dir", to_yup(w["sun"]).normalized())
			sm.set_shader_parameter("roughness", float(w.get("roughness", 0.06)))
			sm.set_shader_parameter("reflectivity", float(w.get("reflect", 1.0)))
			sm.set_shader_parameter("ripple_scale", float(rip.get("scale", 0.3)))
			sm.set_shader_parameter("ripple_slope", float(rip.get("slope", 0.2)))
			sm.set_shader_parameter("ripple_speed", float(rip.get("speed", 0.5)))
			var fl: Array = w.get("flow", [0.6, 0.8])
			sm.set_shader_parameter("flow", Vector2(float(fl[0]), float(fl[1])))
			# a river streams along its flow; still water lets its ripple layers cross
			sm.set_shader_parameter("still", 0.0 if w.get("river", false) else 1.0)
			sm.set_shader_parameter("shore", float(w.get("shore", 1.0)))
			sm.set_shader_parameter("lit", 1.0 if w.get("frozen", false) else 0.0)
			mi.set_surface_override_material(s, sm)


static func _vec3(a: Array) -> Vector3:
	return Vector3(float(a[0]), float(a[1]), float(a[2]))


# The crystal light rig (crystal-rig R5): performed by kernel/crystal_light.gd from score.crystalLight.
func _build_crystal_light() -> void:
	if not score.has("crystalLight"):
		return
	var node: Node3D = load("res://kernel/crystal_light.gd").new()
	node.name = "crystal_light"
	add_child(node)
	node.setup(score["crystalLight"], self)


# Look contract (shader-look phase 4, kernel 0.2.3): score.look.figures carries
# a figure's rim [r, g, b, strength, power] — the one runtime look term the
# bake cannot carry (hull shading, toon bands and the ink outline arrive baked
# in the GLB). Realized as a NEXT_PASS rim.gdshader on every surface of the
# named figure's meshes, so the base vertex-colour material stays untouched.
# The figure node is the exporter's wrapper (its name is the figures-map key);
# the skinned body hangs under it as "<name>:body". Absent look ⇒ no-op.
func _apply_rim() -> void:
	var figs: Dictionary = score.get("look", {}).get("figures", {})
	if figs.is_empty():
		return
	var shader: Shader = load("res://kernel/rim.gdshader")
	if shader == null:
		return
	for fname in figs.keys():
		var rim = figs[fname].get("rim", [])
		if not (rim is Array) or rim.size() < 5:
			continue
		# The figure's WRAPPER and the static solid's group mesh can share a name (the layered
		# kind's `body`): prefer the non-mesh match — the exporter's wrapper node — so the rim
		# lands on the FIGURE, not doubled onto the overlapping static solid.
		var matches := find_children(String(fname), "", true, false)
		if matches.is_empty():
			continue
		var fig_root: Node = matches[0]
		for m in matches:
			if not (m is MeshInstance3D):
				fig_root = m
				break
		for mi in ([fig_root] + fig_root.find_children("*", "MeshInstance3D", true, false)):
			if not (mi is MeshInstance3D) or mi.mesh == null:
				continue
			for s in range(mi.mesh.get_surface_count()):
				var mat: Material = mi.get_active_material(s)
				if mat == null or mat.next_pass != null:
					continue
				# never rim the baked ink shell (toon.bake): its winding is flipped, so an
				# additive pass on it reads as a whole-figure wash, not an edge
				if String(mat.resource_name).contains("ink"):
					continue
				var sm := ShaderMaterial.new()
				sm.shader = shader
				sm.set_shader_parameter("rim_color", Color(rim[0], rim[1], rim[2], rim[3]))
				sm.set_shader_parameter("rim_power", float(rim[4]))
				mat.next_pass = sm


# Light contract (the Godot leg of the lit handoff, kernel 0.2.1): the GLB
# carries KHR_lights_punctual spots in CANDELA. Unreal reads candela through
# its exposure and Blender converts to watts, but Godot's importer copies the
# number straight into Light3D.light_energy — a unitless multiplier where 1.0
# is a household lamp — and leaves range at its 4096 m default. A 400 cd
# downlight therefore lands at 400x and the room clips to white (the lounge
# sk_lkypzdim4y, eyes gate 2026-09-08). CANDELA_PER_ENERGY is the
# calibration, read against the Cycles frame of the same room; the range
# cap only replaces the importer's default, an authored range is kept.
# DirectionalLight3D carries lux, not candela, and is left alone.
const CANDELA_PER_ENERGY := 50.0
const LIGHT_RANGE_M := 12.0


func _fix_lights() -> int:
	var n := 0
	for l in find_children("*", "Light3D", true, false):
		if l is DirectionalLight3D:
			continue
		n += 1
		l.light_energy = l.light_energy / CANDELA_PER_ENERGY
		if l is SpotLight3D and l.spot_range > 1000.0:
			l.spot_range = LIGHT_RANGE_M
		elif l is OmniLight3D and l.omni_range > 1000.0:
			l.omni_range = LIGHT_RANGE_M
	return n


# The ledger's `sky_approximated` promise, kept for LIT worlds: the pack drops
# the sky mesh and the engine supplies one. With no WorldEnvironment Godot
# draws linear light with no tonemapper over a flat grey clear colour, so the
# candela-driven pools clip. Only built when the world carries lights — a
# tonemapper also remaps UNSHADED surfaces, and an unlit pack's reference
# look is the web build, which it must keep matching. A hand-authored
# environment in the scene wins.
func _build_environment() -> void:
	if get_viewport().world_3d.environment != null:
		return
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.55, 0.62, 0.72)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.9, 0.9, 1.0)
	env.ambient_light_energy = 0.25
	env.tonemap_mode = Environment.TONE_MAPPER_AGX
	var we := WorldEnvironment.new()
	we.name = "Environment"
	we.environment = env
	add_child(we)


# Godot's glTF importer rewrites the characters a node/animation name may not
# carry (":" among them) to "_", case preserved: "g_multi:forward" imports as
# "g_multi_forward". Score names are compared in that space; nothing here
# lowercases (the verifier's coarser _norm would alias boostR / boost_r).
static func gd_name(s: String) -> String:
	var out := s
	for ch in [":", ".", "@", "/", "\"", "%"]:
		out = out.replace(ch, "_")
	return out


# An entity's node in the imported world, FIGURE-first (walking-suit-backport
# §2 rule 8): a baked rig's wrapper node is named after the figure key — it
# is the placement of the figure's FIRST claiming entity — and only
# non-first claimants and static bodies get an "entity:<id>" node.
func _entity_node(id: String) -> Node3D:
	for ent in score.get("entities", []):
		if ent is Dictionary and s_(ent.get("id")) == id:
			var fig := s_(ent.get("figure"))
			if fig != "":
				var by_fig := find_child(gd_name(fig), true, false)
				if by_fig is Node3D:
					return by_fig
			break
	var by_id := find_child(gd_name("entity:" + id), true, false)
	return by_id if by_id is Node3D else null


# The operator IS the walker — hide the player entity's exported body double.
# The seat is usually a baked rig, so the node to hide is the figure wrapper,
# not "entity_<id>" (the G-L0 bug: the double stayed visible at spawn).
# `visible = false` on the wrapper propagates to the whole subtree.
func _hide_player_double() -> void:
	var player := s_(score.get("player"))
	if player == "":
		return
	var double := _entity_node(player)
	if double != null:
		double.visible = false


# Entities that baked no mesh (glyph/primitive bodies — export-side gap) get
# a gold placeholder marker so gameplay anchors aren't invisible.
func _mark_meshless_entities() -> void:
	var size := 0.7 * eye_scale
	for ent in find_children("entity_*", "Node3D", true, false):
		if ent.visible and ent.find_children("*", "MeshInstance3D", true, false).is_empty():
			var marker := MeshInstance3D.new()
			marker.mesh = _marker_mesh("entity")
			marker.scale = Vector3(size, size, size)
			marker.position = Vector3(0, size / 2, 0)
			ent.add_child(marker)


# One unit mesh + one material per marker KIND, built on first use and shared
# by every instance — the instance's scale carries the size. Markers used to
# allocate their own mesh and material each, one draw state per marker for
# no visible gain (kernel 0.2.2).
func _marker_mesh(kind: String) -> Mesh:
	if _marker_res.has(kind):
		return _marker_res[kind]
	var mm := StandardMaterial3D.new()
	mm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	var mesh: Mesh
	if kind == "hazard":
		var sphere := SphereMesh.new()
		sphere.radius = 0.5
		sphere.height = 1.0
		mm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		mm.albedo_color = Color(0.95, 0.25, 0.2, 0.35)
		mesh = sphere
	else:
		var box := BoxMesh.new()
		box.size = Vector3.ONE
		mm.albedo_color = Color(0.92, 0.76, 0.3)
		mesh = box
	mesh.material = mm
	_marker_res[kind] = mesh
	return mesh


func _entity(id: String) -> Dictionary:
	for ent in score.get("entities", []):
		if ent is Dictionary and s_(ent.get("id")) == id:
			return ent
	return {}


# The importer lands every clip on ONE AnimationPlayer under the imported
# scene root, names sanitized (gd_name). Its track paths are relative to
# that root — the path-rooting landmine (§3): a player that performs them
# must resolve the SAME root.
func _imported_player() -> AnimationPlayer:
	var world := get_node_or_null("World")
	var scope: Node = world if world != null else self
	for p in scope.find_children("*", "AnimationPlayer", true, false):
		return p
	return null


# One AnimationPlayer per figure that needs a clip (G-L1): a sibling of the
# imported player sharing its libraries and its root. Players don't fight —
# each figure's tracks live on disjoint paths. AnimationTree deliberately
# not used.
func _new_player(imported: AnimationPlayer, label: String) -> AnimationPlayer:
	var p := AnimationPlayer.new()
	p.name = "Rig_" + label
	imported.get_parent().add_child(p)
	p.root_node = p.get_path_to(imported.get_node(imported.root_node))
	for lib_name in imported.get_animation_library_list():
		p.add_animation_library(lib_name, imported.get_animation_library(lib_name))
	return p


# A score clip name (`<figure>:<clip>`, the GLB's) → the imported animation
# name (G-L2): sanitized like Godot does, looked up with has_animation, case
# preserved; "" when the level's GLB carries no such clip.
func _anim_name(p: AnimationPlayer, glb_name: String) -> String:
	if glb_name == "":
		return ""
	var want := gd_name(glb_name)
	if p.has_animation(want):
		return want
	for lib_name in p.get_animation_library_list():
		if lib_name != "" and p.has_animation(lib_name + "/" + want):
			return lib_name + "/" + want
	return ""


# Imported loops default to none; mojulo clips carry the wrap key, so
# LOOP_LINEAR is exact. Set once on the shared animation (both cycles of
# the suit — a walk left at loop none ends after one cycle and the player
# goes idle-with-no-animation, the probe's first catch).
func _loop(p: AnimationPlayer, anim: String) -> void:
	if anim == "":
		return
	var a := p.get_animation(anim)
	if a != null:
		a.loop_mode = Animation.LOOP_LINEAR


func _play_loop(p: AnimationPlayer, anim: String) -> void:
	_loop(p, anim)
	p.play(anim)


# G-L3 + G-L4: claim by figure (one baked body per figure ⇒ FIRST claimant
# idles only), the player's figure pre-claimed so a ring entity sharing the
# suit can't play a competing idle on the one body; then the suit itself.
func _build_rigs() -> void:
	var imported := _imported_player()
	if imported == null:
		return
	var claimed := {}
	var player_id := s_(score.get("player"))
	var player_ent := _entity(player_id)
	var player_fig := s_(player_ent.get("figure"))
	if player_fig != "":
		claimed[player_fig] = true
	if player_ent.get("locomotion") is Dictionary:
		_spawn_suit(imported, player_ent)
	for ent in score.get("entities", []):
		if not (ent is Dictionary and ent.get("locomotion") is Dictionary):
			continue
		var fig := s_(ent.get("figure"))
		if fig == "" or claimed.has(fig):
			continue
		claimed[fig] = true
		var node := find_child(gd_name(fig), true, false)
		if not node is Node3D:
			continue
		var idle := _anim_name(imported, s_((ent["locomotion"] as Dictionary).get("idle")))
		if idle == "":
			continue
		var p := _new_player(imported, gd_name(fig))
		_play_loop(p, idle)
		figure_players.append({"node": node, "player": p, "anim": idle})


# The walking suit (G-L4 + G-L5). The suit is a cosmetic follower (rule 3):
# the import generates no collision for it, blocking is the score
# colliders' job. The seat was hidden as the first-person double — shown
# again here. One player, idle ↔ walk handed over with a short blend
# (pose continuity for free — Godot's play() blends; no pause needed).
func _spawn_suit(imported: AnimationPlayer, ent: Dictionary) -> void:
	var seat := _entity_node(s_(ent.get("id")))
	if seat == null:
		return
	var loco: Dictionary = ent["locomotion"]
	seat.visible = true
	suit = seat
	suit_base_basis = seat.global_transform.basis
	suit_base_yaw = walker.rotation.y
	suit_player = _new_player(imported, "suit")
	suit_idle = _anim_name(suit_player, s_(loco.get("idle")))
	suit_walk = _anim_name(suit_player, s_(loco.get("walk")))
	_loop(suit_player, suit_idle)
	_loop(suit_player, suit_walk)
	if suit_idle != "":
		_play_loop(suit_player, suit_idle)
	elif suit_walk != "":
		_play_loop(suit_player, suit_walk)
	# Rule 7: frame the SUIT — union of the wrapper subtree's AABBs in global
	# space; pivot at the chest line, boom ~2 suit-heights back.
	var h := _subtree_height(seat)
	if h > 0.0:
		walker.set_camera_rig(maxf(3.5 * eye, 2.0 * h), 0.55 * h)
	print("moj: suit '%s' follows the walker (height %.1f m, idle '%s', walk '%s')" % [seat.name, h, suit_idle, suit_walk])


func _subtree_height(root: Node3D) -> float:
	var any := false
	var box := AABB()
	for mi in root.find_children("*", "VisualInstance3D", true, false):
		var b: AABB = (mi as VisualInstance3D).global_transform * (mi as VisualInstance3D).get_aabb()
		box = b if not any else box.merge(b)
		any = true
	return box.size.y if any else 0.0


# Rule 1: placement = the wrapper's transform. Feet follow the walker origin
# (the capsule is offset up by height/2, so the origin IS the feet); yaw is
# a delta composed ON the imported base basis — never a raw yaw, which
# strips the frame correction (suit face-down). Rule 6: idle ↔ walk by
# planar velocity.
func _follow_suit() -> void:
	if suit == null or walker == null:
		return
	suit.global_position = walker.global_position
	suit.global_transform.basis = Basis(Vector3.UP, walker.rotation.y - suit_base_yaw) * suit_base_basis
	if suit_idle == "" or suit_walk == "":
		return
	var moving := Vector2(walker.velocity.x, walker.velocity.z).length() > 0.6 * eye_scale
	if moving == suit_moving:
		return
	suit_moving = moving
	suit_player.play(suit_walk if moving else suit_idle, 0.15)


# G-P: the headless locomotion probe. `--mojulo-autowalk` holds the walker's
# forward input; `--mojulo-frames=N` dumps at physics frame 1 and N, then
# quits. The dump is the Unreal [mojulo-dump] ledger: it separates "the
# mechanism is broken" from "the capsule is wedged" without a window.
func _read_probe_args() -> void:
	for arg in OS.get_cmdline_user_args():
		var a := String(arg)
		if a == "--mojulo-autowalk" and walker != null:
			walker.auto_walk = true
		elif a.begins_with("--mojulo-frames="):
			probe_frames = int(a.substr("--mojulo-frames=".length()))
	if probe_frames > 0:
		print("[mojulo-dump] level '%s' player '%s' suit=%s autowalk=%s frames=%d" % [
			s_(score.get("title")), s_(score.get("player")),
			suit.name if suit != null else "none", str(walker.auto_walk if walker != null else false), probe_frames])


func _dump(tag: String) -> void:
	var w := walker.global_position
	var line := "[mojulo-dump] %s walker=(%.2f,%.2f,%.2f)" % [tag, w.x, w.y, w.z]
	if suit != null:
		var sp := suit.global_position
		var part := suit.get_child(0) if suit.get_child_count() > 0 else null
		# upright: a mojulo figure is z-up under the GLB's y-up root, so the
		# wrapper's local Z is its up — 1.0 when standing, ~0 face-down.
		line += " suit=%s(%.2f,%.2f,%.2f) upright=%.3f anim=%s moving=%s" % [
			suit.name, sp.x, sp.y, sp.z, suit.global_transform.basis.z.y,
			suit_player.current_animation if suit_player != null else "", str(suit_moving)]
		if part is Node3D:
			var pp: Vector3 = (part as Node3D).global_position
			line += " part0=%s(%.2f,%.2f,%.2f)" % [part.name, pp.x, pp.y, pp.z]
	for fp in figure_players:
		var n: Node3D = fp["node"]
		var np := n.global_position
		line += " figure=%s(%.2f,%.2f,%.2f):%s" % [n.name, np.x, np.y, np.z, (fp["player"] as AnimationPlayer).current_animation]
	print(line)


func _physics_process(_delta: float) -> void:
	if probe_frames <= 0 or walker == null:
		return
	probe_frame += 1
	if probe_frame == 1:
		_dump("t=1")
	elif probe_frame >= probe_frames:
		_dump("t=%d" % probe_frame)
		print(perf_line())
		probe_frames = -1
		get_tree().quit()


# CPU-side numbers at the probe's last frame, stamped advisory by the driver.
# Headless has no renderer, so no render time is claimed.
static func perf_line() -> String:
	return "[mojulo-perf] process_ms=%.3f physics_ms=%.3f nodes=%d objects=%d static_kb=%d" % [
		Performance.get_monitor(Performance.TIME_PROCESS) * 1000.0,
		Performance.get_monitor(Performance.TIME_PHYSICS_PROCESS) * 1000.0,
		int(Performance.get_monitor(Performance.OBJECT_NODE_COUNT)),
		int(Performance.get_monitor(Performance.OBJECT_COUNT)),
		int(Performance.get_monitor(Performance.MEMORY_STATIC) / 1024.0)]


# Implicit ground plane (z=0 unless the score says otherwise) + AABB obstacle
# hulls. The collider list is never the floor (G1 finding).
func _build_colliders() -> void:
	var body := StaticBody3D.new()
	body.name = "Colliders"
	add_child(body)
	var ground = score.get("ground")
	if ground != null:
		var gshape := CollisionShape3D.new()
		gshape.shape = WorldBoundaryShape3D.new()
		gshape.position = Vector3(0, float(ground), 0)
		body.add_child(gshape)
	for c in score.get("colliders", []):
		if not (c is Dictionary and c.get("min") is Array and c.get("max") is Array):
			continue
		var mn: Array = c["min"]
		var mx: Array = c["max"]
		var shape := CollisionShape3D.new()
		var box := BoxShape3D.new()
		box.size = Vector3(float(mx[0]) - float(mn[0]), float(mx[2]) - float(mn[2]), float(mx[1]) - float(mn[1]))
		shape.shape = box
		shape.position = to_yup([(float(mn[0]) + float(mx[0])) / 2, (float(mn[1]) + float(mx[1])) / 2, (float(mn[2]) + float(mx[2])) / 2])
		body.add_child(shape)


# Authored framings become real cameras (key 0 toggles). The score's camera
# rotation quat is z-up; conjugate by the same -90°-about-X the GLB root bakes.
func _build_cameras() -> void:
	var r := Quaternion(-sqrt(0.5), 0, 0, sqrt(0.5))
	var cams: Array = score.get("cameras", [])
	for i in range(cams.size()):
		var cam: Dictionary = cams[i]
		var node := Camera3D.new()
		node.name = "View%d" % i
		var t: Array = cam.get("translation", [0, 0, 0])
		node.position = to_yup(t)
		var q: Array = cam.get("rotation", [0, 0, 0, 1])
		node.quaternion = r * Quaternion(float(q[0]), float(q[1]), float(q[2]), float(q[3]))
		node.fov = rad_to_deg(float(cam.get("yfov", 1.0)))
		node.near = 0.1
		node.far = 8000.0
		add_child(node)


func _spawn_walker() -> void:
	walker = WalkerScript.new()
	walker.name = "Walker"
	var spawn := to_yup(score.get("spawn", [0, 0, 2]))
	spawn.y += 0.3 * eye_scale
	walker.spawn = spawn
	walker.position = spawn
	walker.speed = 6.0 * eye_scale
	walker.jump = 4.5 * eye_scale
	walker.gravity = 9.8 * eye_scale
	var kill_y := spawn.y - 300.0
	var colliders: Array = score.get("colliders", [])
	if colliders.size() > 0:
		var min_z := 1e18
		for c in colliders:
			if c is Dictionary and c.get("min") is Array:
				min_z = minf(min_z, float(c["min"][2]))
		kill_y = min_z - 100.0
	walker.kill_y = kill_y
	add_child(walker)
	walker.build_body(eye, eye_scale)


func _build_mechanics() -> void:
	for m in score.get("mechanics", []):
		if not m is Dictionary:
			continue
		match String(m.get("kind", "")):
			"reach-exit":
				exit_zones.append({
					"pos": to_yup(m.get("at", [0, 0, 0])),
					"half": m.get("half"),
					"radius": float(m.get("radius", 2.0)),
					"planar": bool(m.get("planar", true)),
				})
			"collect":
				for p in m.get("pickups", []):
					if p is Dictionary:
						pickups.append({
							"item": String(p.get("item", "item")),
							"into": String(m.get("into", "bag")),
							"pos": to_yup(p.get("at", [0, 0, 0])),
							"radius": float(p.get("radius", 1.4)),
							"taken": false,
						})
			"hazard-damage":
				start_hp = float(m.get("startHp", 100))
				hp = start_hp
				for h in m.get("hazards", []):
					if h is Dictionary:
						var hpos := to_yup(h.get("at", [0, 0, 0]))
						var hrad := float(h.get("radius", 1.5))
						hazards.append({
							"pos": hpos,
							"radius": hrad,
							"damage": float(h.get("damage", 20)),
							"cool": 0.0,
						})
						_hazard_marker(hpos, hrad)
			"fail-on-death":
				fail_on_death = true
				if hp < 0:
					start_hp = float(m.get("startHp", 100))
					hp = start_hp
			"survive":
				survive_left = float(m.get("seconds", 30))


# Hazards export no visual at all (they are score data, not entities) — a
# translucent danger sphere keeps the gameplay anchor visible, same doctrine
# as the gold entity markers; the web build is the reference look.
func _hazard_marker(pos: Vector3, radius: float) -> void:
	var marker := MeshInstance3D.new()
	marker.mesh = _marker_mesh("hazard")
	marker.scale = Vector3.ONE * (radius * 2.0)
	marker.position = pos
	add_child(marker)


# Distance from a point to the walker's BODY (the feet→head segment), not the
# feet point — a hazard floating at chest height must still connect.
func _body_distance(target: Vector3) -> float:
	var feet := walker.global_position
	var y := clampf(target.y, feet.y, feet.y + eye)
	return target.distance_to(Vector3(feet.x, y, feet.z))


func _start_music() -> void:
	if music_path == "":
		return
	var stream = load(music_path)
	if stream == null:
		return
	var music := AudioStreamPlayer.new()
	music.name = "Music"
	music.stream = stream
	music.volume_db = music_db
	add_child(music)
	if stream is AudioStreamWAV:
		stream.loop_mode = AudioStreamWAV.LOOP_FORWARD
		stream.loop_end = int(stream.get_length() * stream.mix_rate)
	music.play()


func _build_hud() -> void:
	if hp < 0 and survive_left < 0 and pickups.is_empty():
		return
	var layer := CanvasLayer.new()
	hud = Label.new()
	hud.position = Vector2(16, 12)
	hud.add_theme_font_size_override("font_size", 20)
	layer.add_child(hud)
	add_child(layer)
	_update_hud()


func _update_hud() -> void:
	if hud == null:
		return
	var parts: Array = []
	if hp >= 0:
		parts.append("HP %d" % int(ceil(hp)))
	if survive_left >= 0:
		parts.append("SURVIVE %d" % int(ceil(survive_left)))
	for item in bag:
		parts.append("%s ×%d" % [String(item).to_upper(), int(bag[item])])
	# assigned only on change: Label.text triggers a relayout even when equal
	var text := "   ".join(parts)
	if hud.text != text:
		hud.text = text


func _zone_hit(zone: Dictionary, pos: Vector3) -> bool:
	var zp: Vector3 = zone["pos"]
	if zone.get("half") is Array:
		var h: Array = zone["half"]
		if absf(pos.x - zp.x) > float(h[0]) or absf(pos.z - zp.z) > float(h[1]):
			return false
		return bool(zone.get("planar", true)) or absf(pos.y - zp.y) <= float(h[2])
	var r := float(zone.get("radius", 2.0))
	if bool(zone.get("planar", true)):
		return Vector2(pos.x - zp.x, pos.z - zp.z).length() <= r
	return pos.distance_to(zp) <= r


func _process(delta: float) -> void:
	_follow_suit()
	if state != "playing" or walker == null:
		return
	var pos := walker.global_position
	for z in exit_zones:
		if _zone_hit(z, pos):
			_complete()
			return
	if survive_left >= 0:
		survive_left = maxf(0.0, survive_left - delta)
		if survive_left == 0.0:
			_complete()
			return
	for p in pickups:
		if not p["taken"] and _body_distance(p["pos"]) <= float(p["radius"]) + 0.4 * eye_scale:
			p["taken"] = true
			bag[p["item"]] = int(bag.get(p["item"], 0)) + 1
			print("moj: picked up %s" % p["item"])
	for h in hazards:
		h["cool"] = maxf(0.0, float(h["cool"]) - delta)
		if float(h["cool"]) == 0.0 and _body_distance(h["pos"]) <= float(h["radius"]) + 0.4 * eye_scale:
			h["cool"] = HAZARD_COOLDOWN
			hp = maxf(0.0, hp - float(h["damage"]))
			print("moj: hazard hit, hp %d" % int(hp))
			if fail_on_death and hp <= 0.0:
				_fail()
				return
	_update_hud()


func _banner(text: String, color: Color) -> void:
	banner_layer = CanvasLayer.new()
	var label := Label.new()
	label.text = text
	label.set_anchors_preset(Control.PRESET_CENTER)
	label.add_theme_font_size_override("font_size", 48)
	label.add_theme_color_override("font_color", color)
	banner_layer.add_child(label)
	add_child(banner_layer)


func _game() -> Node:
	return get_node_or_null("/root/Game")


func _complete() -> void:
	state = "complete"
	print("moj: level complete")
	_banner("LEVEL COMPLETE", Color(1, 1, 1))
	var game := _game()
	if game != null:
		game.level_complete()


func _fail() -> void:
	state = "failed"
	print("moj: level failed")
	_banner("FAILED", Color(1, 0.35, 0.3))
	var game := _game()
	if game != null:
		game.level_failed()
	else:
		await get_tree().create_timer(1.5).timeout
		_reset()


func _reset() -> void:
	if banner_layer != null:
		banner_layer.queue_free()
		banner_layer = null
	hp = start_hp if (hp >= 0 or fail_on_death) else -1.0
	for p in pickups:
		p["taken"] = false
	bag = {}
	for m in score.get("mechanics", []):
		if m is Dictionary and String(m.get("kind", "")) == "survive":
			survive_left = float(m.get("seconds", 30))
	walker.global_position = walker.spawn
	walker.velocity = Vector3.ZERO
	state = "playing"
	_update_hud()


func _unhandled_key_input(event: InputEvent) -> void:
	if not (event is InputEventKey and event.pressed):
		return
	if event.physical_keycode == KEY_0 and score.get("cameras", []).size() > 0:
		var view: Camera3D = get_node_or_null("View0")
		var head: Camera3D = walker.head if walker != null else null
		if view != null and head != null:
			if view.current:
				head.make_current()
			else:
				view.make_current()
	if event.physical_keycode == KEY_M and _game() != null:
		_game().to_menu()
