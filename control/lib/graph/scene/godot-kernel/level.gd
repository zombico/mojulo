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
const WeatherScript := preload("res://kernel/weather.gd")
const BusScript := preload("res://kernel/bus.gd")
const CastScript := preload("res://kernel/cast.gd")
const CombatScript := preload("res://kernel/combat.gd")
const HudScript := preload("res://kernel/hud.gd")
const StatsScript := preload("res://kernel/stats.gd")
const SoundScript := preload("res://kernel/sound.gd")
const JsonExact := preload("res://kernel/json_exact.gd")
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

# the level's address (a room stage: score.rooms / score.anchors): rooms, doorways and doors as triggers
signal address_event(what: String, id: String)
var room_boxes: Array = []           # {id, box: AABB, inside}
var triggers: Array = []             # {id, kind, box: AABB, to, locked, inside}

var hud: Label = null
var banner_layer: CanvasLayer = null

# THE BUS (since 0.8.0): the world's behaviour from bus.json beside the score (engine-score.js extractBus), run by
# kernel/bus.gd, the port held equal to the web's reducer. Facts in: the walker's zones (in recipe units: the score is in
# metres, the bus is not) and the interact key at a usable place (E: use-<place>). Out: warps, the score's HUD banners,
# toasts and readouts, the reach prompt, and bus_event for every event, the seam a project's own scripts hook.
signal bus_event(type: String, event: Dictionary)
# the named seams (since 0.13.0) a project's own scripts take (game/hooks.gd is attached to every level):
signal chapter_turned(id: String, carried: bool)
signal cue_fired(id: String)
signal menu_opened(id: String)
signal menu_picked(id: String, n: int)
signal line_requested(who: String, text: String, menu: String, i: int)
signal character_event(type: String, id: String, event: Dictionary)
var bus = null
var bus_state: Dictionary = {}
var bus_units := 1.0
var bus_sources: Array = []
var bus_zone_prev = null
var bus_uses: Dictionary = {}        # zone → {id, prompt}: a cue's usable places
var bus_reach: Array = []            # the usable zones the walker stands in, the last entered on top
var bus_interact := false            # E since the last frame
var bus_seen := 0                    # log entries already announced
var hud_ui = null                    # kernel/hud.gd: the score's HUD widgets, gated by the parts' vars and the phase
var bus_clock := 0.0                 # the bus's own time (the HUD's ttls and toasts run on it)
var bus_incoming: Array = []         # the frame's incoming events (an event toast reads its fields)
var bus_prompt: Label = null
# THE CONTRACT (since 0.9.0): levels/<ref>/contract.json, the level's game contract as the web shell reads it. Its `on`
# maps bus events to typed store events (kept for the outcome) or ends the level; its `chapters` name the flags whose
# chapters are carried in from the store; a level ends with ONE envelope that Game applies atomically.
var contract: Dictionary = {}
var outcome_events: Array = []
var bus_pending: Array = []          # events for the bus's first frame (chapters carried in)
var bus_frag: Dictionary = {}
# MENUS (since 0.10.0): score.menus, the pages a world's play declares. The open one is the last whose bus var
# (ui-menu-<id>) is 1, as on the web; arrows or W / S move the focus, Enter / Space / E accept (a read turns its pages,
# a pick sends menu-pick:<menu>:<n>, else it closes), Esc or Backspace close (menu-close:<menu>). The walker waits.
var menu_open = null
var menu_focus := 0
var menu_page := 0
var menu_panel: PanelContainer = null
var menu_label: Label = null        # unused since 0.14.0 (the menu is a column of rows: menu_rows); kept for scripts that read it
var menu_rows: VBoxContainer = null
var menu_sig := ""
var menu_mouse := -1                 # the mouse mode a menu found, given back when it closes
# THE CAST (since 0.11.0): bus.json's cast rows, run by kernel/cast.gd (the web's character world, ported): the bus's
# ctrl ops in, the characters' happenings (down, gone, spawned, arrive, stuck, faded) out as facts; each character's
# node follows its row (shown or not, where it stands, its heading, lying when felled, its statuses worn as looks).
var cast = null
# THE FIGHT (since 0.17.0): bus.json's `combat`, run by kernel/combat.gd over the cast: the hero swings with the left
# mouse button (the held WASD picks the cut), its hits count on the bodies, and the cast tells the bus (hit:<id>).
var combat = null
var combat_doc = null
var combat_fire := false             # a held fire the probe sets (no mouse in a headless run)
# THE KEYS (since 0.18.0): bus.json's `inputs`, a key or a click bound to an event (a power's key, the status page)
var bus_inputs: Array = []
var combat_swings := 0               # the hero's swings drawn so far (a new one plays its clip)
var suit_idle_glb := ""              # the suit's idle as the GLB names it (<figure>:idle): its swings sit beside it
var suit_swinging := false           # a swing clip is playing: idle / walk wait for it
var cast_state: Dictionary = {}
var cast_rows: Array = []
var cast_nodes: Dictionary = {}      # id → {node, rot0, heading0, worn: {status: true}}
var shake_cam: Camera3D = null
# FORCED WEATHER (since 0.12.0): the newest weather-force:<cue> still set, handed to the weather node (the web's rule)
var wx_seen: Dictionary = {}
var wx_live: Dictionary = {}
var wx_order := 0

# rigs (walking-suit-backport G-L1..G-L5)
var suit: Node3D = null              # the player's figure wrapper, driven by the walker
var suit_player: AnimationPlayer = null
var suit_idle := ""
var suit_walk := ""
var suit_walk_speed := 0.0
var suit_base_basis := Basis.IDENTITY
var suit_base_yaw := 0.0
var suit_moving := false
var figure_players: Array = []       # [{node, player, anim}] — ambient idles, for the dump
var probe_frames := -1               # --mojulo-frames=N: dump at frame N and quit
var probe_frame := 0
var _marker_res: Dictionary = {}     # marker kind -> the one shared Mesh (material on it)
var sound = null                     # kernel/sound.gd when the score carries `audio` (0.20.0): action sounds, the fight score
var looks: Node3D = null             # kernel/looks.gd when the score carries looks: looks.wear(node, name) / lift / transit


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
	_build_weather()
	_hide_player_double()
	_mark_meshless_entities()
	_build_colliders()
	_build_address()
	_build_crystal_light()
	_build_cameras()
	_spawn_walker()
	_build_rigs()
	_build_looks()
	_build_mechanics()
	_build_contract()
	_build_bus()
	_start_music()
	_build_sound()
	_build_hud()
	_attach_hooks()
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


# Looks (playscape elements, kernel 0.6.0): score.looks carries the looks a world's cues put on its cast, score.transits
# the ways they come and go. The cues do not travel, so kernel/looks.gd waits for a script: $Level.looks.wear(node,
# "poisoned"), .lift(node), .transit(node, "hologram", "in"). The probe wears one from the command line:
# --mojulo-wear=<node name>:<look>. Absent both, no node.
func _build_looks() -> void:
	if not (score.has("looks") or score.has("transits")):
		return
	looks = load("res://kernel/looks.gd").new()
	looks.name = "looks"
	add_child(looks)
	looks.setup(score.get("looks", {}))
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--mojulo-wear="):
			var kv := a.trim_prefix("--mojulo-wear=").split(":")
			var hit := find_children(kv[0], "Node3D", true, false)
			if kv.size() == 2 and not hit.is_empty():
				looks.wear(hit[0], kv[1])


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


# The world's weather (score.weather, kernel/weather.gd): the fog, its colour, the background and the light follow the sky's
# schedule. Needs an Environment to carry the fog: the lit world's, a hand-authored one, or (an unlit pack, which must keep its
# web look and so gets no tonemapper) a fog-only one of its own.
func _build_weather() -> void:
	var w = score.get("weather")
	if not (w is Dictionary) or w.is_empty():
		return
	var env: Environment = get_viewport().world_3d.environment
	if env == null:
		env = Environment.new()
		env.background_mode = Environment.BG_COLOR
		env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
		env.ambient_light_color = Color(0.9, 0.9, 1.0)
		env.ambient_light_energy = 0.0
		var we := WorldEnvironment.new()
		we.name = "Environment"
		we.environment = env
		add_child(we)
	var node := WeatherScript.new()
	node.name = "MojuloWeather"
	add_child(node)
	node.setup(w, env, find_children("*", "Light3D", true, false))


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


# Entities that baked no mesh: a primitive body the score carries (a box or a sphere, since 0.15.0) is built at its
# size and colour, centred and turned by the entity's heading; anything else (a glyph) gets a gold placeholder marker
# so gameplay anchors aren't invisible.
func _mark_meshless_entities() -> void:
	var size := 0.7 * eye_scale
	var prims := {}
	for e in score.get("entities", []):
		if e is Dictionary and e.get("primitive") is Dictionary:
			prims[gd_name("entity:" + s_(e.get("id")))] = e
	for ent in find_children("entity_*", "Node3D", true, false):
		if ent.visible and ent.find_children("*", "MeshInstance3D", true, false).is_empty():
			if prims.has(String(ent.name)):
				_build_primitive(ent, prims[String(ent.name)])
				continue
			var marker := MeshInstance3D.new()
			marker.mesh = _marker_mesh("entity")
			marker.scale = Vector3(size, size, size)
			marker.position = Vector3(0, size / 2, 0)
			ent.add_child(marker)


func _build_primitive(ent: Node3D, row: Dictionary) -> void:
	var p: Dictionary = row["primitive"]
	var mm := StandardMaterial3D.new()
	mm.albedo_color = Color.html(p["color"]) if p.get("color") is String and Color.html_is_valid(p["color"]) else Color(0.7, 0.7, 0.7)
	var mi := MeshInstance3D.new()
	mi.name = "body"
	if p.get("shape") == "sphere":
		var sp := SphereMesh.new()
		sp.radius = float(p["radius"])
		sp.height = 2.0 * float(p["radius"])
		mi.mesh = sp
	else:
		var bx := BoxMesh.new()
		var sz: Array = p["size"]
		bx.size = Vector3(float(sz[0]), float(sz[2]), float(sz[1]))   # z-up [w, d, h] → y-up
		mi.mesh = bx
	mi.material_override = mm
	ent.add_child(mi)
	# the node carries the figure yaw offset; a body faces by the heading alone
	mi.global_basis = Basis(Vector3.UP, float(row.get("heading", 0.0)))
	_primitive_sun()


# a primitive body is shaded (a box reads as a box); an unlit export has no light, so the first one brings a soft sun
# (the unlit ground and baked surfaces ignore it)
func _primitive_sun() -> void:
	if get_node_or_null("PrimitiveSun") != null or not find_children("*", "DirectionalLight3D", true, false).is_empty():
		return
	var sun := DirectionalLight3D.new()
	sun.name = "PrimitiveSun"
	sun.rotation = Vector3(deg_to_rad(-50), deg_to_rad(35), 0)
	sun.light_energy = 0.9
	add_child(sun)


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
	suit_idle_glb = s_(loco.get("idle"))
	suit_walk = _anim_name(suit_player, s_(loco.get("walk")))
	suit_walk_speed = float(loco.get("walkSpeed", 0.0))
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
	var planar := Vector2(walker.velocity.x, walker.velocity.z).length()
	var moving := planar > 0.6 * eye_scale
	if suit_swinging:
		var me = cast_state["byId"].get(s_(score.get("player"))) if cast != null else null
		if me != null and me.get("swingT") != null:
			return
		suit_swinging = false
		suit_moving = not moving   # hand idle / walk back below
	# the walk at the walker's speed: its ground speed (walkSpeed) is where its planted feet stay put
	suit_player.speed_scale = clampf(planar / suit_walk_speed, 0.25, 3.0) if moving and suit_walk_speed > 0.0 else 1.0
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
	var wx := get_node_or_null("MojuloWeather")
	if wx != null:
		var wl: Dictionary = wx.last if not (wx.last as Dictionary).is_empty() else wx.look_at(wx.t)   # the sky applied
		print("[mojulo-weather] %s state=%s->%s mix=%.2f fog=%.4f dim=%.2f enabled=%s forced=%s" % [tag, wl["a"], wl["b"], wl["mix"], wl["density"], wl["dim"], str(wx.env.fog_enabled), wx.forced["n"] if wx.forced != null else ""])
	var w := walker.global_position
	var line := "[mojulo-dump] %s walker=(%.2f,%.2f,%.2f)" % [tag, w.x, w.y, w.z]
	if suit != null:
		var sp := suit.global_position
		var part := suit.get_child(0) if suit.get_child_count() > 0 else null
		# upright: a mojulo figure is z-up under the GLB's y-up root, so the
		# wrapper's local Z is its up — 1.0 when standing, ~0 face-down.
		line += " suit=%s(%.2f,%.2f,%.2f) upright=%.3f anim=%s moving=%s rate=%.2f" % [
			suit.name, sp.x, sp.y, sp.z, suit.global_transform.basis.z.y,
			suit_player.current_animation if suit_player != null else "", str(suit_moving),
			suit_player.speed_scale if suit_player != null else 1.0]
		if part is Node3D:
			var pp: Vector3 = (part as Node3D).global_position
			line += " part0=%s(%.2f,%.2f,%.2f)" % [part.name, pp.x, pp.y, pp.z]
	if combat != null:
		var me = cast_state["byId"].get(s_(score.get("player")))
		var hits := []
		for e in cast_state["entities"]:
			if e.has("hittable"):
				hits.append("%s:hits%d%s" % [e["id"], int(e.get("hits", 0)), ":hittable" if e["hittable"] else ""])
		print("[mojulo-combat] %s swings=%d dealt=%d swing=%s %s" % [tag, int(me.get("swingCount", 0)) if me != null else 0, int(me.get("meleeHitCount", 0)) if me != null else 0, str(me.get("swingT")) if me != null else "", " ".join(hits)])
	if cast != null:
		var rows := []
		for e in cast_state["entities"]:
			rows.append("%s:%s%s(%.2f,%.2f)%s" % [e["id"], "gone" if e["gone"] else "here", ":down" if e["downed"] else "", e["pos"][0], e["pos"][1], (":hp%d" % int(e["hp"])) if e.has("hp") else ""])
		print("[mojulo-cast] %s %s" % [tag, " ".join(rows)])
	if bus != null:
		print("[mojulo-bus] %s events=%d vars=%s menu=%s banner=%s" % [tag, bus_state["metrics"]["processed"], bus.ss(bus_state["vars"]), ("%s:%d" % [s_(menu_open["id"]), menu_focus]) if menu_open != null else "", hud_ui.banner_text() if hud_ui != null else ""])
		print("[mojulo-hud] %s %s" % [tag, hud_ui.dump() if hud_ui != null else ""])
		if menu_open != null:
			print("[mojulo-menu] %s %s" % [tag, menu_text()])
		if bus.stats != null:
			print("[mojulo-stats] %s pace=%.2f" % [tag, walker.speed])
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


# The level's ADDRESS: every anchor a Marker3D under Anchors, named by its id, its id / kind / room / node / form / of
# as metadata (group "moj_anchor"), so a script finds "coffin-2" or "doorway-nave-gallery" by name. Rooms, doorways
# and doors become triggers (printed and emitted as address_event); an item is a pickup whose GLB node hides when
# taken; a door locked by an item opens once the bag holds it. No rooms or anchors -> nothing.
func _yup_box(b: Dictionary) -> AABB:
	var a := to_yup(b["min"])
	var c := to_yup(b["max"])
	var lo := Vector3(minf(a.x, c.x), minf(a.y, c.y), minf(a.z, c.z))
	return AABB(lo, Vector3(maxf(a.x, c.x), maxf(a.y, c.y), maxf(a.z, c.z)) - lo)


# a GLB node by its exported name (the importer turns ':' and the like into '_')
func _glb_node(node_name: String) -> Node:
	return find_child(node_name.validate_node_name(), true, false)


func _build_address() -> void:
	var anchors: Array = score.get("anchors", [])
	for r in score.get("rooms", []):
		if r is Dictionary and r.get("box") is Dictionary:
			room_boxes.append({"id": s_(r.get("id")), "box": _yup_box(r["box"]), "inside": false})
	if anchors.is_empty():
		return
	var root := Node3D.new()
	root.name = "Anchors"
	add_child(root)
	for a in anchors:
		if not (a is Dictionary and a.get("at") is Array and a.get("id") is String):
			continue
		var m := Marker3D.new()
		m.name = String(a["id"]).validate_node_name()
		m.position = to_yup(a["at"])
		for k in ["id", "kind", "room", "node", "form", "of"]:
			if a.get(k) is String:
				m.set_meta("moj_" + k, a[k])
		m.add_to_group("moj_anchor")
		root.add_child(m)
		var kind := s_(a.get("kind"))
		if kind == "item":
			pickups.append({"item": String(a["id"]), "into": "bag", "pos": to_yup(a["at"]), "radius": float(a.get("r", 1.0)), "taken": false, "node": s_(a.get("node"))})
		elif (kind == "doorway" or kind == "door") and a.get("trigger") is Dictionary:
			triggers.append({"id": String(a["id"]), "kind": kind, "box": _yup_box(a["trigger"]), "to": a.get("to"), "locked": s_(a.get("locked")), "inside": false})
	print("moj: address %d rooms, %d anchors, %d triggers" % [room_boxes.size(), anchors.size(), triggers.size()])


func _step_address(pos: Vector3) -> void:
	for r in room_boxes:
		var inside: bool = r["box"].grow(0.05).has_point(pos)
		if inside and not r["inside"]:
			print("moj: entered room %s" % r["id"])
			address_event.emit("room", r["id"])
		r["inside"] = inside
	for t in triggers:
		var inside: bool = t["box"].grow(0.1).has_point(pos)
		if inside and not t["inside"]:
			if t["kind"] == "door":
				var key: String = t["locked"]
				if key != "" and int(bag.get(key, 0)) == 0:
					print("moj: door %s is locked (needs %s)" % [t["id"], key])
					address_event.emit("locked", t["id"])
				else:
					var to = t["to"]
					print("moj: door %s leads to %s" % [t["id"], JSON.stringify(to)])
					address_event.emit("door", t["id"])
			else:
				print("moj: through %s" % t["id"])
				address_event.emit("doorway", t["id"])
		t["inside"] = inside


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


# THE BEAT (score.beat: { every, lead }, since 0.22.0): the music's pulse said on the bus as the page says it from its
# AudioContext (beats/beat-clock.js beatsDue): at the music player's position plus lead, each beat not said yet, a
# period-stale one passed over, four at most. No music playing, no beat. The harness passes its own clock (`at`, the
# level's fixed step), the reading the web's level-sim takes too.
var beat_n := 0
func _beat_tick(at: float) -> void:
	var b = score.get("beat")
	if not (b is Dictionary) or bus == null or state != "playing":
		return
	var t := at
	if t < 0.0:
		var music: AudioStreamPlayer = get_node_or_null("Music")
		if music == null or not music.playing:
			return
		t = music.get_playback_position() + AudioServer.get_time_since_last_mix()
	t += float(b.get("lead", 0.0))
	var every := float(b.get("every", 0.0))
	if every <= 0.0:
		return
	var due := beats_due(beat_n, t, every)
	bus_pending.append_array(due[0])
	beat_n = int(due[1])


# beats/beat-clock.js beatsDue, line for line: [events, the next beat] at clock reading t
static func beats_due(n: int, t: float, every: float) -> Array:
	var out: Array = []
	var k := 0
	while n * every <= t and k < 4:
		k += 1
		if t - n * every < every:
			out.append({"type": "beat", "n": n})
		n += 1
	return [out, n]


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
	if AudioServer.get_bus_index("Music") >= 0:
		music.bus = "Music"
	add_child(music)
	if stream is AudioStreamWAV:
		stream.loop_mode = AudioStreamWAV.LOOP_FORWARD
		stream.loop_end = int(stream.get_length() * stream.mix_rate)
	music.play()


# the level's sound (score.json `audio`, since 0.20.0): kernel/sound.gd as the child "Sound", hearing the bus and the
# hero; absent ⇒ no node, the level as before
func _build_sound() -> void:
	if not score.get("audio") is Dictionary:
		return
	sound = SoundScript.new()
	sound.name = "Sound"
	add_child(sound)
	sound.setup(self, score["audio"], get_node_or_null("Music"))


func _sound_hero():
	if cast == null or not cast_state.get("byId") is Dictionary:
		return null
	var who := s_(score.get("player"))
	return cast_state["byId"].get(who if who != "" else "player")


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


# THE LEVEL-EQUIVALENCE HARNESS (scripts/godot-level-sim.gd; lib/graph/game/level-equivalence.js is its web twin): a
# recorded input played frame by frame at the harness's fixed step, the walker stepped AFTER the bus as the web's
# level-sim steps its world, and one canonical key printed a frame. Off (sim_frame -1) unless the harness starts it.
var sim_frames: Array = []
var sim_frame := -1
var sim_ids: Array = []          # the key's entities: the pilot (the walker) first, then every ruled entity, by id
var sim_feet: Dictionary = {}    # id -> how far above its feet its pos stands (the web walk rule's eye)


func sim_start(frames: Array, ids: Array, feet: Dictionary) -> void:
	sim_frames = frames
	sim_ids = ids
	sim_feet = feet
	sim_frame = 0
	if walker != null:
		walker.sim_input = {}
		walker.set_physics_process(false)


# positions in the recipe's z-up units, quantized to 5 cm, a heading to 0.05 rad (level-equivalence.js POS_Q, HEAD_Q);
# half up, as the web's Math.floor(x + 0.5)
static func _sim_q(v: float, k: float) -> int:
	return int(floor(v / k + 0.5))


func _sim_ent(id: String, pos: Array, heading: float) -> String:
	var up := float(sim_feet.get(id, 0.0))
	return "%s:%d,%d,%d,%d" % [id, _sim_q(float(pos[0]), 0.05), _sim_q(float(pos[1]), 0.05), _sim_q(float(pos[2]) - up, 0.05), _sim_q(fposmod(heading, TAU), 0.05)]


func sim_key() -> String:
	var parts: Array = [bus.hash_state(bus_state) if bus != null else BusScript.new().hash_state(BusScript.new().create_bus_state({}, []))]
	for i in sim_ids.size():
		var id := String(sim_ids[i])
		if i == 0 and walker != null:
			var bz := walker.global_transform.basis.z
			# the walker stands on its feet: its eye goes on, and _sim_ent takes it off again, as for every entity
			parts.append(_sim_ent(id, _sim_add_eye(id, _bus_pos(walker.global_position)), atan2(bz.z, -bz.x)))
			continue
		var ce = cast_state.get("byId", {}).get(id) if cast != null else null
		if ce is Dictionary:
			parts.append(_sim_ent(id, ce["pos"], float(ce.get("heading", 0.0))))
			continue
		var row := _entity(id)
		if row.is_empty():
			parts.append("%s:none" % id)
			continue
		var tr: Array = row.get("translation", [0, 0, 0])
		parts.append(_sim_ent(id, [float(tr[0]) / bus_units, float(tr[1]) / bus_units, float(tr[2]) / bus_units], float(row.get("heading", 0.0))))
	return "|".join(parts)


# the walker's feet, raised by the pilot's eye so _sim_ent takes it off again (its key is its feet)
func _sim_add_eye(id: String, p: Array) -> Array:
	return [p[0], p[1], float(p[2]) + float(sim_feet.get(id, 0.0))]


const SIM_DT := 1.0 / 30.0   # the harness's step, the web level-sim's exactly (the engine's fixed-fps delta is not)


func _process(delta: float) -> void:
	var sim := sim_frame >= 0 and sim_frame < sim_frames.size()
	if sim:
		delta = SIM_DT
	if sim and walker != null:
		walker.sim_input = sim_frames[sim_frame]
	if sim and sim_frames[sim_frame] is Dictionary:
		for k in (sim_frames[sim_frame] as Dictionary).get("keys", []):
			press_key(String(k))
		for ev in (sim_frames[sim_frame] as Dictionary).get("events", []):
			bus_pending.append((ev as Dictionary).duplicate(true))
	_beat_tick(float(sim_frame) * delta if sim else -1.0)
	_play(delta)
	if sim:
		if state == "playing" and walker != null:
			walker.sim_step(delta)
		print("[mojulo-sim] %d %s %s" % [sim_frame, state, sim_key()])
		sim_frame += 1


func _play(delta: float) -> void:
	_follow_suit()
	if sound != null:
		sound.step(delta, walker if state == "playing" else null, _sound_hero() if state == "playing" else null)
	if state != "playing" or walker == null:
		return
	var pos := walker.global_position
	_step_address(pos)
	_step_bus(delta, pos)
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
			if s_(p.get("node")) != "":
				var shown := _glb_node(p["node"])
				if shown is Node3D:
					shown.visible = false
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


func _build_bus() -> void:
	var p := score_path.get_base_dir().path_join("bus.json")
	if not FileAccess.file_exists(p):
		return
	var doc = JsonExact.parse(FileAccess.get_file_as_string(p))
	if not (doc is Dictionary) or doc.get("version") != "bus/1" or not (doc.get("fragment") is Dictionary):
		push_warning("moj: bus.json is not a bus/1 document; the world's behaviour does not run")
		return
	var frag: Dictionary = doc["fragment"]
	bus_frag = frag
	bus = BusScript.new()
	# the stats (kernel/stats.gd) run inside the bus's watch fixpoint, as the page's do
	if doc.get("stats") is Dictionary:
		bus.stats = StatsScript.new()
		bus.stats_cfg = doc["stats"]
	bus_units = float(doc.get("metersPerUnit", 1.0))
	bus_state = bus.create_bus_state(frag, frag.get("entities", []) if frag.get("entities") is Array else [])
	bus_sources = frag.get("sources", []) if frag.get("sources") is Array else []
	if doc.get("combat") is Dictionary:
		combat_doc = doc["combat"]
	if doc.get("inputs") is Array:
		bus_inputs = doc["inputs"]
	if doc.get("cast") is Array and not (doc["cast"] as Array).is_empty():
		cast_rows = doc["cast"]
		_build_cast()
	for src in bus_sources:
		if src is Dictionary and src.get("type") == "zone" and src.has("use"):
			bus_uses[src["zone"]] = {"id": s_(src["use"]), "prompt": s_(src.get("prompt", ""))}
	var layer := CanvasLayer.new()
	hud_ui = HudScript.new()
	hud_ui.build(layer, score.get("hud", []) if score.get("hud") is Array else [], score.get("hudStyle", {}) if score.get("hudStyle") is Dictionary else {}, bus)
	bus_prompt = Label.new()
	bus_prompt.grow_horizontal = Control.GROW_DIRECTION_BOTH
	bus_prompt.grow_vertical = Control.GROW_DIRECTION_BEGIN
	bus_prompt.set_anchors_and_offsets_preset(Control.PRESET_CENTER_BOTTOM, Control.PRESET_MODE_MINSIZE, 64)
	bus_prompt.add_theme_stylebox_override("normal", hud_ui.plate_style())
	bus_prompt.add_theme_font_size_override("font_size", 18)
	bus_prompt.add_theme_font_override("font", hud_ui.font(600))
	bus_prompt.add_theme_color_override("font_color", hud_ui.tok["ink"])
	bus_prompt.visible = false
	# the web's menu: centred over the HUD, 300 px wide, on the solid panel colour
	menu_panel = PanelContainer.new()
	menu_panel.custom_minimum_size = Vector2(300, 0)
	menu_panel.grow_horizontal = Control.GROW_DIRECTION_BOTH
	menu_panel.grow_vertical = Control.GROW_DIRECTION_BOTH
	menu_panel.set_anchors_and_offsets_preset(Control.PRESET_CENTER, Control.PRESET_MODE_MINSIZE)
	var solid: StyleBoxFlat = hud_ui.plate_style()
	solid.bg_color = hud_ui.tok["panel"]
	solid.content_margin_top = 12
	solid.content_margin_bottom = 12
	menu_panel.add_theme_stylebox_override("panel", solid)
	menu_panel.visible = false
	menu_label = Label.new()
	menu_rows = VBoxContainer.new()
	menu_rows.add_theme_constant_override("separation", 4)
	menu_panel.add_child(menu_rows)
	for n in [bus_prompt, menu_panel]:
		layer.add_child(n)
	add_child(layer)
	_start_bus()


func _start_bus() -> void:
	if bus_frag.get("initial") is Array and not (bus_frag["initial"] as Array).is_empty():
		bus.process_events(bus_state, bus_frag["initial"])
	# a chapter the store already holds is applied at once, with no presentation (the web's game channel does the same)
	var ch = contract.get("chapters")
	if ch is Dictionary and _game() != null:
		var slice = (_game().params_for(contract) as Dictionary).get(ch.get("slice"), {})
		var flags: Dictionary = slice.get("flags", {}) if slice is Dictionary else {}
		for c in ch.get("carried", []):
			if c is Dictionary and bus.truthy(flags.get(c.get("key"))):
				bus_pending.append({"type": c["event"]})
	_drain_bus(0.0)


func _build_contract() -> void:
	var p := score_path.get_base_dir().path_join("contract.json")
	if FileAccess.file_exists(p):
		var c = JsonExact.parse(FileAccess.get_file_as_string(p))
		if c is Dictionary:
			contract = c


# the walker in the bus's frame: y-up metres back to z-up recipe units
func _bus_pos(pos: Vector3) -> Array:
	return [pos.x / bus_units, -pos.z / bus_units, pos.y / bus_units]


func _step_bus(delta: float, pos: Vector3) -> void:
	if bus == null:
		return
	var who := s_(score.get("player"))
	var z: Dictionary = bus.derive_zone_events([{"id": who if who != "" else "player", "position": _bus_pos(pos)}], bus_zone_prev, bus_sources)
	bus_zone_prev = z["prev"]
	var incoming: Array = bus_pending + z["events"]
	bus_pending = []
	bus_incoming = incoming
	# a menu up freezes the world and its clock, as the page's (interact-channel.js __mojFreeze, since 0.22.0): the menu
	# the last frame left open stops this frame's bus timers and sagas, the cast and the fight
	if menu_open != null:
		delta = 0.0
	bus_clock += minf(delta, 0.05)
	if cast != null:
		var me = cast_state["byId"].get(who if who != "" else "player")
		if me != null:
			me["pos"] = _bus_pos(pos)
			if combat_doc is Dictionary:
				me["pos"][2] += float(combat_doc.get("eye", 0.0))   # where the web's platform rule stands its hero
			# the walker faces -Z: its heading in the bus's frame (x, -z)
			var bz := walker.global_transform.basis.z
			me["heading"] = atan2(bz.z, -bz.x)
			# a mouse-look rule aims with the look's pitch; a tank-turning one aims level
			if combat != null:
				me["pitch"] = walker.pitch_node.rotation.x if combat.look and walker.pitch_node != null else 0.0
		# the facts of the cast as the last frame's step left it (the page reads castFacts before the bus); the cast and
		# the fight step after the bus's ops (below), as the page's controllable step runs after its events (since 0.22.0)
		var facts: Array = cast.facts(cast_state)
		for ev in facts:
			character_event.emit(String(ev["type"]), String(ev["entity"]), ev)
		incoming.append_array(facts)
	for ev in z["events"]:
		if bus_uses.has(ev["zone"]):
			bus_reach.erase(ev["zone"])
			if ev["type"] == "enter":
				bus_reach.append(ev["zone"])
	var top = bus_uses[bus_reach[-1]] if not bus_reach.is_empty() else null
	if bus_interact and top != null and menu_open == null:
		incoming.append({"type": "use-" + String(top["id"])})
	bus_interact = false
	bus_prompt.visible = top != null and menu_open == null
	if top != null:
		bus_prompt.text = "[E] " + (String(top["prompt"]) if String(top["prompt"]) != "" else "use")
	bus.frame(bus_state, incoming, minf(delta, 0.05))
	if bus.stats != null:
		_stat_bodies()
	var ctrl: Dictionary = bus.take_ctrl(bus_state)
	if cast != null and not (ctrl["ops"] as Array).is_empty():
		cast.ops(cast_state, ctrl["ops"])
	var warp = ctrl["warps"].get(who)
	if warp is Array:
		walker.global_position = to_yup(warp) * bus_units
	if cast != null:
		var me2 = cast_state["byId"].get(who if who != "" else "player")
		cast.step(cast_state, minf(delta, 0.05))
		if combat != null and me2 != null:
			combat.step(cast_state, me2, _combat_input(), minf(delta, 0.05), walker.is_on_floor())
			_draw_swing(me2)
	_drain_bus(delta)
	_sync_menus()
	_draw_cast()
	_sync_markers()
	_sync_weather()


# THE BUS'S OWN ENTITIES as markers (since 0.22.0), as the page draws them (channels/events.js __ensureMarker,
# __syncBus): an unlit sphere each, its radius (0.4) and colour (#7ad1ff) unless the entity says, where the bus puts it,
# shown while it is on. The bus decides what is true; this shows it. A boulder pushed, a crop grown, a drop taken.
const MARKER_COLOR := Color("#7ad1ff")
var marker_nodes: Dictionary = {}    # bus entity id -> MeshInstance3D
func _sync_markers() -> void:
	if bus == null:
		return
	for e in bus_state["entities"]:
		var id := String(e["id"])
		var m: MeshInstance3D = marker_nodes.get(id)
		if m == null:
			m = MeshInstance3D.new()
			m.name = "Marker_" + id.validate_node_name()
			var sphere := SphereMesh.new()
			var r := float(e["radius"]) if Bus_finite(e.get("radius")) else 0.4
			sphere.radius = r * bus_units
			sphere.height = 2.0 * r * bus_units
			sphere.radial_segments = 18
			sphere.rings = 12
			var mat := StandardMaterial3D.new()
			mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
			mat.albedo_color = Color(String(e["color"])) if e.get("color") is String else MARKER_COLOR
			sphere.material = mat
			m.mesh = sphere
			m.set_meta("bus_id", id)
			m.set_meta("radius", r * bus_units)
			add_child(m)
			marker_nodes[id] = m
		var p: Array = e.get("position", [0, 0, 0])
		m.position = to_yup(p) * bus_units
		m.visible = not (e.get("on") is bool and e["on"] == false)


static func Bus_finite(v) -> bool:
	return (typeof(v) == TYPE_FLOAT or typeof(v) == TYPE_INT) and is_finite(float(v))


# the visible marker nearest along a ray (origin, unit dir), within reach: its bus id, or "" (a ray against each
# marker's sphere, as the page raycasts its marker meshes)
func marker_on_ray(origin: Vector3, dir: Vector3, reach: float = 1e9) -> String:
	var best := ""
	var best_t := reach
	for id in marker_nodes:
		var m: MeshInstance3D = marker_nodes[id]
		if not m.visible:
			continue
		var r := float(m.get_meta("radius"))
		var oc := origin - m.global_position
		var b := oc.dot(dir)
		var c := oc.dot(oc) - r * r
		var disc := b * b - c
		if disc < 0.0:
			continue
		var t := -b - sqrt(disc)
		if t < 0.0:
			t = -b + sqrt(disc)
		if t >= 0.0 and t < best_t:
			best_t = t
			best = String(id)
	return best


# THE AIM (since 0.22.0): a pick names the marker under the pointer, a shot the marker on the line of sight (the camera's,
# or a character's own: inputs on 'fire' with `from`), stamped into the input's event (`into`, 'target'); a miss is no
# deed. The ray meets the markers and the level's box colliders; the page's also meets the GLB's meshes (fact:aim partial).
func aim_input(on: String, screen = null) -> void:
	if bus == null:
		return
	var cam := get_viewport().get_camera_3d()
	for inp in bus_inputs:
		if not (inp is Dictionary) or inp.get("on") != on or not (inp.get("emit") is Dictionary):
			continue
		var origin: Vector3
		var dir: Vector3
		if on == "fire" and inp.get("from") is String and cast != null and cast_state["byId"].has(inp["from"]):
			var e = cast_state["byId"][inp["from"]]
			var h := float(e.get("heading", 0.0))
			var pit := 0.0 if BusScript.truthy(inp.get("level")) else float(e.get("pitch", 0.0))
			var eye := float(inp["eye"]) if Bus_finite(inp.get("eye")) else 1.4
			origin = to_yup([e["pos"][0], e["pos"][1], float(e["pos"][2]) + eye]) * bus_units
			dir = to_yup([cos(pit) * cos(h), cos(pit) * sin(h), sin(pit)]).normalized()
		elif cam != null:
			var at: Vector2 = screen if screen is Vector2 else get_viewport().get_visible_rect().size / 2.0
			if on == "fire":
				at = get_viewport().get_visible_rect().size / 2.0
			origin = cam.project_ray_origin(at)
			dir = cam.project_ray_normal(at)
		else:
			continue
		var start := origin + dir * (0.6 if on == "fire" else 0.0)
		var wall := _wall_on_ray(start, dir) if on == "fire" else 1e9
		var id := marker_on_ray(start, dir, wall)
		if id == "":
			continue
		var ev: Dictionary = (inp["emit"] as Dictionary).duplicate(true)
		ev[String(inp["into"]) if inp.get("into") is String else "target"] = id
		bus_pending.append(ev)


# the nearest of the level's box colliders along a ray (the slab test), or a long way off
func _wall_on_ray(origin: Vector3, dir: Vector3) -> float:
	var best := 1e9
	for c in score.get("colliders", []):
		if not (c is Dictionary and c.get("min") is Array and c.get("max") is Array):
			continue
		var box := _yup_box(c)
		var hit = box.intersects_ray(origin, dir)
		if hit is Vector3:
			best = minf(best, origin.distance_to(hit))
	return best


# the rounds in flight (kernel/combat.gd's lob projectiles), a small sphere each
var round_nodes: Array = []
func _draw_rounds() -> void:
	if combat == null:
		return
	while round_nodes.size() < combat.projectiles.size():
		var m := MeshInstance3D.new()
		var sp := SphereMesh.new()
		sp.radius = 0.12 * bus_units
		sp.height = 0.24 * bus_units
		m.mesh = sp
		add_child(m)
		round_nodes.append(m)
	for i in round_nodes.size():
		var on: bool = i < combat.projectiles.size()
		round_nodes[i].visible = on
		if on:
			round_nodes[i].global_position = to_yup(combat.projectiles[i]["pos"]) * bus_units


# the cast's moments, simpler than the page's: a beam is a bolt grown from the hand to where it lands and fading after;
# a puff or a blast a glowing ball swelling over its time and fading (a chain's blasts each in their place and turn).
# The colour is the spec's. What they do (the struck, the shake) is the cast's, equal to the web
var moment_nodes: Array = []
func _moment_node(i: int) -> MeshInstance3D:
	while moment_nodes.size() <= i:
		var m := MeshInstance3D.new()
		var mat := StandardMaterial3D.new()
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.material_override = mat
		add_child(m)
		moment_nodes.append(m)
	return moment_nodes[i]


static func _moment_color(m: Dictionary, fallback: Color) -> Color:
	var c = m.get("color")
	if not (c is Array) and m.get("spec") is Dictionary:
		c = m["spec"].get("color")
	if c is Array and c.size() >= 3:
		return Color(float(c[0]), float(c[1]), float(c[2]))
	if c is String and c.begins_with("#"):
		return Color.html(c)
	return fallback


func _draw_moments() -> void:
	var t: float = cast_state["time"]
	var n := 0
	for m in cast_state["moments"]:
		if m["is"] == "shake" or t < float(m["t0"]):
			continue
		var node := _moment_node(n)
		var mat: StandardMaterial3D = node.material_override
		if m["is"] == "beam":
			var hit := float(m["hit"])
			var grow := clampf((t - float(m["t0"])) / maxf(1e-3, hit - float(m["t0"])), 0.0, 1.0)
			var fade := 1.0 - clampf((t - hit) / 0.35, 0.0, 1.0)
			if fade <= 0.0:
				continue
			var a := to_yup(m["from"]) * bus_units
			var b := a.lerp(to_yup(m["to"]) * bus_units, grow)
			var len := a.distance_to(b)
			if len < 1e-3:
				continue
			var cyl := CylinderMesh.new()
			cyl.top_radius = 0.06 * bus_units
			cyl.bottom_radius = 0.06 * bus_units
			cyl.height = len
			node.mesh = cyl
			node.global_position = (a + b) / 2.0
			var dir := (b - a) / len
			node.global_transform.basis = Basis(Quaternion(Vector3.UP, dir)) if absf(dir.dot(Vector3.UP)) < 0.999 else Basis()
			var col := _moment_color(m, Color(0.45, 0.75, 1.0))
			mat.albedo_color = Color(col.r, col.g, col.b, fade)
		else:
			var dur := float(m["spec"].get("dur", 0.8)) if m.get("spec") is Dictionary else 0.6
			var age := (t - float(m["t0"])) / maxf(0.05, dur)
			if age >= 1.0:
				continue
			var sp := SphereMesh.new()
			var r := (0.3 + 1.2 * age) * float(m.get("scale", 1.0)) * bus_units
			sp.radius = r
			sp.height = 2.0 * r
			node.mesh = sp
			node.global_position = to_yup(m["at"]) * bus_units + Vector3(0, r * 0.5, 0)
			var col := _moment_color(m, Color(1.0, 0.55, 0.2) if m.get("spec") != null else Color(0.8, 0.8, 0.8))
			mat.albedo_color = Color(col.r, col.g, col.b, 0.85 * (1.0 - age))
		node.visible = true
		n += 1
	for i in range(n, moment_nodes.size()):
		moment_nodes[i].visible = false


# the hero's input in the web's words: fire (the left mouse button, or the probe's hold), forward (W / S) and strafe
# (D / A); a frozen walker (a menu is up) swings nothing
func _combat_input() -> Dictionary:
	if walker.frozen:
		return {"fire": false, "forward": 0.0, "strafe": 0.0, "turn": 0.0}
	var key := func(a: int, b: int) -> bool: return Input.is_physical_key_pressed(a) or Input.is_physical_key_pressed(b)
	var fwd := (1.0 if key.call(KEY_W, KEY_UP) else 0.0) - (1.0 if key.call(KEY_S, KEY_DOWN) else 0.0)
	var side := (1.0 if key.call(KEY_D, KEY_RIGHT) else 0.0) - (1.0 if key.call(KEY_A, KEY_LEFT) else 0.0)
	var fire := combat_fire or (Input.mouse_mode == Input.MOUSE_MODE_CAPTURED and Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT))
	return {"fire": fire, "forward": fwd, "strafe": side, "turn": 0.0}


# a new swing plays its clip on the suit when the figure carries it (swing_<dir>, beside its idle); the suit's
# idle / walk takes back over when it ends
func _draw_swing(me: Dictionary) -> void:
	var n := int(me.get("swingCount", 0))
	if n == combat_swings:
		return
	combat_swings = n
	if suit_player == null or suit_idle_glb == "" or not (me.get("swingClip") is String):
		return
	var at := suit_idle_glb.rfind(":")
	var clip := _anim_name(suit_player, suit_idle_glb.substr(0, at + 1) + String(me["swingClip"]))
	if clip != "":
		suit_player.speed_scale = 1.0
		suit_player.play(clip, 0.05)
		suit_swinging = true


# the bound stats that changed onto the bodies (the web's applyStatBodies): the cast's characters, and the walker's
# pace when the player is a holder (its hp is the mechanics', not the bus's)
func _stat_bodies() -> void:
	var q = bus_state.get("_statBodyOps")
	if not (q is Array) or q.is_empty():
		return
	var who := s_(score.get("player"))
	for o in q:
		if o.get("who") == who and bus.finite(o.get("speed")) and float(o["speed"]) > 0:
			walker.speed = float(o["speed"])
	if cast != null:
		StatsScript.apply_bodies(bus_state, cast_state)
	bus_state["_statBodyOps"] = []


# announce the new events, map them through the contract, and hand the HUD the frame (its banners and toasts fire on
# the log's new events; its readouts and gates read the vars)
func _drain_bus(_delta: float) -> void:
	var log: Array = bus_state["log"]
	var from := bus_seen
	var on: Dictionary = contract.get("on", {}) if contract.get("on") is Dictionary else {}
	var end_with := ""
	for i in range(bus_seen, log.size()):
		var e: Dictionary = log[i]
		if not e.has("type"):
			continue
		bus_event.emit(String(e["type"]), e)
		if sound != null:
			sound.hear(String(e["type"]))
		_announce(String(e["type"]), e)
		# the contract's on: the first pattern that matches maps the event (scene/channels/game.js, the same rule)
		for pat in on:
			if not bus.glob(e["type"], pat):
				continue
			var act = on[pat]
			if act is Dictionary and act.get("emit") is Dictionary:
				if state == "playing":
					outcome_events.append((act["emit"] as Dictionary).duplicate(true))
			elif act is Dictionary and act.has("end") and end_with == "":
				end_with = String(act["end"])
			break
	bus_seen = log.size()
	if end_with != "" and state == "playing":
		if end_with == "success":
			_complete()
		else:
			_fail(end_with)
	if hud_ui != null:
		hud_ui.sync(bus_state["vars"], log, from, bus_incoming, bus_clock)


func _build_cast() -> void:
	cast = CastScript.new()
	cast_state = cast.create(cast_rows)
	var who := s_(score.get("player"))
	for e in cast_state["entities"]:
		if e["id"] == who:
			continue
		var node := _entity_node(e["id"])
		if node == null:
			continue
		if cast_nodes.has(e["id"]):
			for k in cast_nodes[e["id"]]["worn"]:
				if looks != null:
					looks.lift(node, k)
			node.rotation = cast_nodes[e["id"]]["rot0"]
		cast_nodes[e["id"]] = {"node": node, "rot0": node.rotation, "heading0": e["heading"], "worn": {}}
	if combat_doc is Dictionary:
		combat = CombatScript.new()
		combat.arm(cast_state, combat_doc)
		combat_swings = 0
	cast.facts(cast_state)   # the first read seeds: nothing the world was minted with fires
	_draw_cast()


# each character's node follows its row: shown or sent away, where it stands, its heading, lying when felled
# how far a character leans over (0 upright, PI/2 lying): a fall lies down, a topple goes over through its fall, lies
# flat and rises through its getup, a stagger rocks (kernel/combat.gd's reaction, the web's clips as a lean)
static func _lean(e: Dictionary) -> float:
	if e["downed"]:
		return PI / 2
	var t = e.get("staggerT")
	if t == null:
		return 0.0
	match e.get("reactClip"):
		"topple":
			return PI / 2 * minf(1.0, float(t))
		"getup":
			return PI / 2 * (1.0 - minf(1.0, float(t)))
	return 0.3 * sin(PI * minf(1.0, float(t)))


func _draw_cast() -> void:
	if cast == null:
		return
	_draw_rounds()
	_draw_moments()
	for id in cast_nodes:
		var c: Dictionary = cast_nodes[id]
		var e: Dictionary = cast_state["byId"][id]
		var node: Node3D = c["node"]
		node.visible = not e["gone"]
		node.global_position = to_yup(e["pos"]) * bus_units
		var rot: Vector3 = c["rot0"] + Vector3(0, e["heading"] - c["heading0"], 0)
		rot.z += _lean(e)
		node.rotation = rot
		if looks != null:
			for k in e["statuses"]:
				if not c["worn"].has(k):
					looks.wear(node, k)
					c["worn"][k] = true
			for k in (c["worn"] as Dictionary).keys():
				if not (e["statuses"] as Dictionary).has(k):
					looks.lift(node, k)
					c["worn"].erase(k)
	# a shake: the camera trembles while one is on, k fading over its `for`
	var k := 0.0
	for m in cast_state["moments"]:
		if m["is"] == "shake":
			var age: float = cast_state["time"] - m["t0"]
			if age < m["for"]:
				k = maxf(k, m["k"] * (1.0 - age / m["for"]))
	var cam := get_viewport().get_camera_3d()
	if cam != null:
		cam.h_offset = randf_range(-1, 1) * 0.08 * k if k > 0 else 0.0
		cam.v_offset = randf_range(-1, 1) * 0.08 * k if k > 0 else 0.0


func _sync_weather() -> void:
	var wx := get_node_or_null("MojuloWeather")
	if wx == null:
		return
	var v: Dictionary = bus_state["vars"]
	if wx.clock_on:
		wx.clock(v.get("minute"), v.get("season"))
	var top = null
	for k in v:
		if not String(k).begins_with("weather-force"):
			continue
		var now := String(v[k]) if v[k] is String else ""
		if now != String(wx_seen.get(k, "")):
			wx_seen[k] = now
			if now != "":
				wx_order += 1
				wx_live[k] = {"n": now, "k": k, "at": wx_order, "bl": v.get("weather-blend" + String(k).substr(13))}
			else:
				wx_live.erase(k)
		if wx_live.has(k) and (top == null or wx_live[k]["at"] > top["at"]):
			top = wx_live[k]
	wx.force(top)


# game/hooks.gd, the developer's (it survives a re-mint): loaded beside the level, attach(level) called
func _attach_hooks() -> void:
	if not ResourceLoader.exists("res://game/hooks.gd"):
		return
	var h = load("res://game/hooks.gd").new()
	if h is Node:
		h.name = "GameHooks"
		add_child(h)
	if h.has_method("attach"):
		h.attach(self)


# a bus event, as the named seams: a cue fired, a chapter turned (live or carried in), a menu's pick (a character's
# happening is announced where the cast reports it: the bus's log keeps only an event's type)
func _announce(type: String, e: Dictionary) -> void:
	if type.begins_with("cue:"):
		cue_fired.emit(type.substr(4))
	elif type.begins_with("menu-pick:"):
		var parts := type.split(":")
		if parts.size() == 3:
			menu_picked.emit(parts[1], int(parts[2]))
	elif type.begins_with("chapter-"):
		var carried := type.ends_with("-carried")
		var id := type.substr(8, type.length() - 8 - (8 if carried else 0))
		if bus_state["vars"].has("chapter-%s-n" % id):
			chapter_turned.emit(id, carried)


func _sync_menus() -> void:
	var open = null
	for m in score.get("menus", []) if score.get("menus") is Array else []:
		if m is Dictionary and bus.strict_eq(bus_state["vars"].get(m.get("var")), 1):
			open = m
	if open != menu_open:
		menu_open = open
		menu_focus = 0
		menu_page = 0
		if open != null:
			menu_opened.emit(s_(open["id"]))
			if open.get("kind") == "talk":
				var lines: Array = open.get("lines", [])
				for i in lines.size():
					line_requested.emit(s_(lines[i].get("who")), s_(lines[i].get("say")), s_(open["id"]), i)
	walker.frozen = menu_open != null
	if menu_open != null and menu_mouse < 0:
		menu_mouse = Input.mouse_mode
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	elif menu_open == null and menu_mouse >= 0:
		Input.mouse_mode = menu_mouse
		menu_mouse = -1
	_draw_menu()


static func _menu_count(m: Dictionary) -> int:
	if m.get("picks") is Array:
		return (m["picks"] as Array).size()
	match String(m.get("kind", "")):
		"save": return mini(int(m.get("slots", 3)), 4)
		"shop": return (m.get("stock", []) as Array).size()
		"chest": return (m.get("holds", []) as Array).size()
		"list": return (m.get("rows", []) as Array).size()
	return 0


# a key's action on the open menu (the web's __menuDo): the events it sends reach the bus next frame
func menu_do(action: String) -> void:
	var m = menu_open
	if m == null:
		return
	var n := _menu_count(m)
	if action == "up" and n > 0:
		menu_focus = (menu_focus + n - 1) % n
	elif action == "down" and n > 0:
		menu_focus = (menu_focus + 1) % n
	elif action == "accept":
		if m.get("kind") == "read" and menu_page + 1 < (m.get("pages", []) as Array).size():
			menu_page += 1
		elif m.get("picks") is Array and not (m["picks"] as Array).is_empty():
			bus_pending.append({"type": "menu-pick:%s:%d" % [s_(m["id"]), menu_focus]})
		else:
			bus_pending.append({"type": "menu-close:" + s_(m["id"])})
	elif action == "back":
		bus_pending.append({"type": "menu-close:" + s_(m["id"])})
	_draw_menu()


# the open menu as a column on the HUD's plate: its words, then a row per choice (a click picks it, the pointer focuses
# it); its {var} words filled from the bus, as the web's menu does
func _menu_entries(m: Dictionary) -> Array:
	var out: Array = []   # [text, row index or -1]
	if s_(m.get("title")) != "":
		out.append([s_(m["title"]).to_upper(), -1])
	match String(m.get("kind", "")):
		"read":
			var pages: Array = m.get("pages", [])
			var p := mini(menu_page, pages.size() - 1)
			out.append([s_(pages[p]), -1])
			out.append(["%d / %d · %s" % [p + 1, pages.size(), "next ▸" if p + 1 < pages.size() else "close"] if pages.size() > 1 else "close", -1])
		"talk":
			for l in (m.get("lines", []) as Array).slice(0, 3):
				out.append([("%s: " % s_(l.get("who")) if s_(l.get("who")) != "" else "") + s_(l.get("say")), -1])
		"confirm":
			out.append([s_(m.get("ask")), -1])
		"shop":
			var stock: Array = m.get("stock", [])
			for i in stock.size():
				out.append(["%s  %s" % [s_(stock[i].get("item")), bus.js_string(stock[i].get("price"))], i])
			out.append([s_(m.get("currency")), -1])
		"chest":
			var holds: Array = m.get("holds", [])
			for i in holds.size():
				out.append(["%s  ×%s" % [s_(holds[i].get("item")), bus.js_string(holds[i].get("count", 1))], i])
		"save":
			for i in _menu_count(m):
				out.append(["Slot %d" % (i + 1), i])
		"list":
			var rows: Array = m.get("rows", [])
			for i in rows.size():
				var v = bus_state["vars"].get(rows[i].get("var"))
				out.append(["%s  %s" % [s_(rows[i].get("label")), bus.js_string(v) if v != null else "0"], i])
		"map":
			out.append(["(the map)", -1])
	if m.get("picks") is Array:
		var picks: Array = m["picks"]
		for i in picks.size():
			out.append([s_(picks[i]), i])
	var rx := RegEx.new()
	rx.compile("\\{([^}]+)\\}")
	for e in out:
		for hit in rx.search_all(e[0]):
			var v = bus_state["vars"].get(hit.get_string(1))
			e[0] = (e[0] as String).replace(hit.get_string(0), bus.js_string(v) if v != null else "0")
	return out


func _menu_row_style(on: bool) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	var a: Color = hud_ui.tok["accent"]
	sb.bg_color = Color(a.r, a.g, a.b, 0.22) if on else Color(0, 0, 0, 0)
	sb.border_color = a
	sb.border_width_left = 3 if on else 0
	sb.set_corner_radius_all(3)
	sb.content_margin_left = 10
	sb.content_margin_right = 10
	sb.content_margin_top = 3
	sb.content_margin_bottom = 3
	return sb


func _draw_menu() -> void:
	if menu_panel == null:
		return
	var m = menu_open
	menu_panel.visible = m != null
	if m == null:
		menu_sig = ""
		return
	var entries := _menu_entries(m)
	var sig := str(entries)
	if sig != menu_sig:
		menu_sig = sig
		for c in menu_rows.get_children():
			menu_rows.remove_child(c)
			c.queue_free()
		var ink: Color = hud_ui.tok["ink"]
		for e in entries:
			var i: int = e[1]
			if i < 0:
				var l := Label.new()
				l.text = e[0]
				l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
				l.add_theme_font_override("font", hud_ui.font(500))
				l.add_theme_font_size_override("font_size", 18)
				l.add_theme_color_override("font_color", ink)
				menu_rows.add_child(l)
				continue
			var b := Button.new()
			b.text = e[0]
			b.alignment = HORIZONTAL_ALIGNMENT_LEFT
			b.focus_mode = Control.FOCUS_NONE   # the level's keys and pad move the focus, not Godot's GUI focus
			b.add_theme_font_override("font", hud_ui.font(600))
			b.add_theme_font_size_override("font_size", 18)
			for c in ["font_color", "font_hover_color", "font_pressed_color"]:
				b.add_theme_color_override(c, ink)
			b.set_meta("row", i)
			b.mouse_entered.connect(_menu_hover.bind(i))
			b.pressed.connect(_menu_click.bind(i))
			menu_rows.add_child(b)
	for c in menu_rows.get_children():
		if c is Button:
			var on: bool = int(c.get_meta("row")) == menu_focus
			for k in ["normal", "hover", "pressed"]:
				c.add_theme_stylebox_override(k, _menu_row_style(on))


func _menu_hover(i: int) -> void:
	if menu_focus != i:
		menu_focus = i
		_draw_menu()


func _menu_click(i: int) -> void:
	menu_focus = i
	menu_do("accept")


# what the open menu shows, for the probes: its rows, the focused one marked
func menu_text() -> String:
	if menu_open == null:
		return ""
	var out := []
	for e in _menu_entries(menu_open):
		out.append(("▸ " if e[1] == menu_focus else "  ") + e[0] if e[1] >= 0 else e[0])
	return " / ".join(out)


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


# the level's one outcome: what its bus mapped (contract.on), with the result (level-contract.js, the envelope)
func outcome_envelope(result: String) -> Dictionary:
	return {"contractVersion": 1, "levelRef": s_(contract.get("levelRef", score.get("ref"))), "seed": 1, "result": result, "events": outcome_events.duplicate(true)}


func _complete() -> void:
	if state != "playing":
		return
	state = "complete"
	print("moj: level complete")
	if sound != null:
		sound.finish("victory")
	_banner("LEVEL COMPLETE", Color(1, 1, 1))
	var game := _game()
	if game != null:
		game.level_finish(outcome_envelope("success"), contract)


func _fail(result: String = "fail") -> void:
	if state != "playing":
		return
	state = "failed"
	print("moj: level failed")
	if sound != null:
		sound.finish("defeat")
	_banner("FAILED", Color(1, 0.35, 0.3))
	var game := _game()
	if game != null:
		game.level_finish(outcome_envelope(result), contract)
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
	outcome_events = []
	if bus != null:
		bus_state = bus.create_bus_state(bus_frag, bus_frag.get("entities", []) if bus_frag.get("entities") is Array else [])
		bus_seen = 0
		bus_zone_prev = null
		bus_reach = []
		if cast != null:
			_build_cast()
		_start_bus()
	_update_hud()


# a gamepad on an open menu: the d-pad or the left stick moves, A (or start) accepts, B (or back) closes
var menu_stick := 0
func _unhandled_input(event: InputEvent) -> void:
	if bus != null and event is InputEventMouseButton and event.pressed:
		for inp in bus_inputs:
			if inp.get("on") == "pointer":
				bus_pending.append((inp["emit"] as Dictionary).duplicate(true))
		aim_input("pick", event.position)
		if event.button_index == MOUSE_BUTTON_LEFT:
			aim_input("fire")
	if menu_open == null:
		return
	var act := ""
	if event is InputEventJoypadButton and event.pressed:
		match event.button_index:
			JOY_BUTTON_DPAD_UP, JOY_BUTTON_DPAD_LEFT: act = "up"
			JOY_BUTTON_DPAD_DOWN, JOY_BUTTON_DPAD_RIGHT: act = "down"
			JOY_BUTTON_A, JOY_BUTTON_START: act = "accept"
			JOY_BUTTON_B, JOY_BUTTON_BACK: act = "back"
	elif event is InputEventJoypadMotion and event.axis == JOY_AXIS_LEFT_Y:
		# the stick moves one row per push past half way
		var dir := 1 if event.axis_value > 0.5 else -1 if event.axis_value < -0.5 else 0
		if dir != 0 and dir != menu_stick:
			act = "down" if dir > 0 else "up"
		menu_stick = dir
	if act == "":
		return
	menu_do(act)
	get_viewport().set_input_as_handled()


# a key the way the page names it (KeyboardEvent.key): the character it types, else its name
const JS_KEYS := {KEY_ENTER: "Enter", KEY_KP_ENTER: "Enter", KEY_ESCAPE: "Escape", KEY_TAB: "Tab", KEY_BACKSPACE: "Backspace", KEY_DELETE: "Delete", KEY_UP: "ArrowUp", KEY_DOWN: "ArrowDown", KEY_LEFT: "ArrowLeft", KEY_RIGHT: "ArrowRight", KEY_SHIFT: "Shift", KEY_CTRL: "Control", KEY_ALT: "Alt", KEY_META: "Meta", KEY_HOME: "Home", KEY_END: "End", KEY_PAGEUP: "PageUp", KEY_PAGEDOWN: "PageDown"}
static func js_key(event: InputEventKey) -> String:
	if event.unicode > 0:
		return String.chr(event.unicode)
	if JS_KEYS.has(event.keycode):
		return JS_KEYS[event.keycode]
	return OS.get_keycode_string(event.keycode)


# a key pressed: every input bound to it (or to any key) queues its event for the bus's next frame
func press_key(key: String) -> void:
	for inp in bus_inputs:
		if inp.get("on") == "key" and (not (inp.get("key") is String) or inp["key"] == "" or inp["key"] == key):
			bus_pending.append((inp["emit"] as Dictionary).duplicate(true))


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
	if bus != null and not event.echo:
		press_key(js_key(event))
	if menu_open != null:
		match event.physical_keycode:
			KEY_UP, KEY_W, KEY_LEFT, KEY_A: menu_do("up")
			KEY_DOWN, KEY_S, KEY_RIGHT, KEY_D: menu_do("down")
			KEY_ENTER, KEY_KP_ENTER, KEY_SPACE, KEY_E: menu_do("accept")
			KEY_ESCAPE, KEY_BACKSPACE: menu_do("back")
		get_viewport().set_input_as_handled()
		return
	if event.physical_keycode == KEY_E and bus != null:
		bus_interact = true
