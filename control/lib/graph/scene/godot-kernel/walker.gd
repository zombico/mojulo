extends CharacterBody3D
# mojulo-godot kernel — the walker. Constructed by level.gd from the score's
# eye height (1 mojulo unit = 1 meter at eye 1.7). WASD/arrows + mouse look,
# Space jumps, Esc frees the mouse (click to recapture). First person by
# default (the Head camera at eye height); when the player's figure is a
# rigged body, level.gd calls set_camera_rig() and the Head hangs off a
# SpringArm3D behind a chest-line pivot instead (walking-suit-backport.md
# rule 7 — frame the SUIT, not the pilot eye). auto_walk is the headless
# locomotion probe (G-P): a persistent forward input, no keys needed.
#
# RULE MODE (since 0.23.0): a level whose pilot runs the web's walk or platform rule (score.pilot) is walked by
# kernel/rules.gd, the port held equal to the web's (the rules conformance corpus), in the recipe's own frame: its
# speed, turn, eye, jump, coyote and buffer, world and lane movement, the colliders it slides along, and the ground
# under it found on the level's own faces (level.gd hands it the GLB's triangles). The node only shows the pose.

const MOUSE_SENS := 0.002
const RulesScript := preload("res://kernel/rules.gd")

var speed := 6.0
var jump := 4.5
var gravity := 9.8
var kill_y := -100.0
var spawn := Vector3.ZERO
var auto_walk := false
var frozen := false  # a menu is up: the figure waits (level.gd), falling still but taking no steps
var sim_input = null  # the level-equivalence harness's held input (scripts/godot-level-sim.gd): its axes in place of the keys
var sim_turn := 2.2   # the tank turn the harness steers by (rad/s), the web walk rule's default
var head: Camera3D = null
var rule = null          # the pilot's rule (score.pilot.rule) in rule mode, else null: the stock walker
var ent: Dictionary = {}  # its state in the recipe's frame (kernel/rules.gd entity)
var world: Dictionary = {} # { ground, colliders } in recipe units
var units := 1.0          # metres per recipe unit (score.metersPerUnit; the bus's)
var halt := 1.0           # 0 while the fight roots the body (a melee swing), as the web's platform rule halts its drive
var cam_rule = null       # the page's camera rule (score.camera, since 0.23.0), stepped after the pilot; null: the Head
var cam: Dictionary = {}  # its state in the recipe's frame (kernel/rules.gd camera)
var cam_node: Camera3D = null
var _cam_cd := 1.0        # a chase camera's pull-in before a wall, as a fraction of its distance (the page's __camCd)
var pitch_node: Node3D = null  # Head itself (first person) or the boom pivot (suit)


func build_body(eye: float, eye_scale: float) -> void:
	var shape := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.3 * eye_scale
	cap.height = maxf(1.8 * eye_scale, 2.2 * cap.radius)
	shape.shape = cap
	shape.position = Vector3(0, cap.height / 2, 0)
	add_child(shape)
	head = Camera3D.new()
	head.name = "Head"
	head.position = Vector3(0, eye, 0)
	head.far = 8000.0
	add_child(head)
	pitch_node = head
	head.make_current()


# Third-person boom: pivot at `pivot_height` (the suit's chest line), a
# SpringArm3D `distance` long pointing backwards (its local +Z), the Head at
# its end looking at the pivot. The arm retracts against the score colliders
# so walls don't clip; the walker's own body is excluded. Mouse pitch orbits
# the pivot from here on.
func set_camera_rig(distance: float, pivot_height: float) -> void:
	if head == null:
		return
	var pivot := Node3D.new()
	pivot.name = "Pivot"
	pivot.position = Vector3(0, pivot_height, 0)
	add_child(pivot)
	var arm := SpringArm3D.new()
	arm.name = "Boom"
	arm.spring_length = distance
	arm.margin = 0.2
	arm.add_excluded_object(get_rid())
	pivot.add_child(arm)
	head.get_parent().remove_child(head)
	arm.add_child(head)
	head.position = Vector3.ZERO
	head.rotation = Vector3.ZERO
	head.near = maxf(0.05, distance * 0.002)
	pitch_node = pivot
	head.make_current()


var _harness := false   # the level-equivalence harness steps a ruled pilot itself (sim_step); the live tick stands by


func _ready() -> void:
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--mojulo-sim="):
			_harness = true


func _unhandled_input(event: InputEvent) -> void:
	if rule != null and event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		# the page's mouse: a look rule turns on its x and pitches on its y (heading+ is a left turn: the x goes in negated)
		_look += Vector2(-event.relative.x, -event.relative.y)
		return
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED and not frozen:
		rotate_y(-event.relative.x * MOUSE_SENS)
		if pitch_node != null:
			pitch_node.rotate_x(-event.relative.y * MOUSE_SENS)
			pitch_node.rotation.x = clampf(pitch_node.rotation.x, -1.5, 1.5)
	elif event is InputEventMouseButton and event.pressed and not frozen:   # a click on an open menu is the menu's
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	elif event.is_action_pressed("ui_cancel"):
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE


func _physics_process(delta: float) -> void:
	if rule != null:
		if sim_input == null and not _harness:
			# a menu up: the page reads no input at all (controllable index.js), and the world stands at no time
			var i := _key_input()
			rule_step({} if frozen else i, delta)
		return
	if not is_on_floor():
		velocity.y -= gravity * delta
	elif Input.is_physical_key_pressed(KEY_SPACE):
		velocity.y = jump
	var dir := Vector3.ZERO
	if auto_walk or Input.is_physical_key_pressed(KEY_W) or Input.is_physical_key_pressed(KEY_UP):
		dir -= transform.basis.z
	if Input.is_physical_key_pressed(KEY_S) or Input.is_physical_key_pressed(KEY_DOWN):
		dir += transform.basis.z
	if Input.is_physical_key_pressed(KEY_A) or Input.is_physical_key_pressed(KEY_LEFT):
		dir -= transform.basis.x
	if Input.is_physical_key_pressed(KEY_D) or Input.is_physical_key_pressed(KEY_RIGHT):
		dir += transform.basis.x
	if frozen:
		dir = Vector3.ZERO
	dir = dir.normalized()
	velocity.x = dir.x * speed
	velocity.z = dir.z * speed
	move_and_slide()
	if global_position.y < kill_y:
		global_position = spawn
		velocity = Vector3.ZERO


# The harness's step (level.gd calls it after the bus, as the web's level-sim steps its world): the recorded input's
# axes (the web rule's: forward, strafe, turn, lookDX, jump) in place of the keys and the mouse, at the frame's delta.
# A heading change is the web's (heading+ is a left turn): a tank turn of turn × sim_turn, a look of lookDX × 0.0025.
func sim_step(delta: float) -> void:
	if rule != null:
		rule_step(sim_input if sim_input is Dictionary else {}, delta)
		return
	var i: Dictionary = sim_input if sim_input is Dictionary else {}
	rotate_y(-float(i.get("turn", 0.0)) * sim_turn * delta + float(i.get("lookDX", 0.0)) * 0.0025)
	if not is_on_floor():
		velocity.y -= gravity * delta
	elif float(i.get("jump", 0.0)) > 0.0:
		velocity.y = jump
	var dir := -transform.basis.z * float(i.get("forward", 0.0)) + transform.basis.x * float(i.get("strafe", 0.0))
	if dir.length() > 1.0:
		dir = dir.normalized()
	if frozen:
		dir = Vector3.ZERO
	velocity.x = dir.x * speed
	velocity.z = dir.z * speed
	move_and_slide()
	if global_position.y < kill_y:
		global_position = spawn
		velocity = Vector3.ZERO


# ── rule mode ────────────────────────────────────────────────────────────────────────────────────────────────────────
func use_rule(r: Dictionary, pos: Array, heading: float, w: Dictionary, metres_per_unit: float) -> void:
	rule = r
	ent = RulesScript.entity(pos, heading)
	world = w
	units = metres_per_unit
	_show_pose(Vector3.ZERO, 0.0)


# one step of the pilot's rule (a menu up steps it at no time, as the page's frozen world: a look still turns it)
func rule_step(input: Dictionary, delta: float) -> void:
	_adopt()
	var before := position
	var dt := 0.0 if frozen else delta
	RulesScript.step(ent, rule, input, dt, world, halt)
	_show_pose(before, delta)
	if cam_rule != null:
		RulesScript.camera_step(cam, cam_rule, ent, rule, dt, world)
		_show_camera(dt)


# the page's camera (score.camera): its own Camera3D, current, driven by kernel/rules.gd as the page's __driveCamera
# drives its own: at the rule's pose, looking at its look point (else down its heading and pitch); a chase camera
# pulled in before the land between it and what it frames, at once, and eased back out
func use_camera(r: Dictionary) -> void:
	cam_rule = r
	var at = r.get("transform", {}).get("pos") if r.get("transform") is Dictionary else null
	cam = RulesScript.camera(at if at is Array else [0, 0, 0], 0.0)
	cam_node = Camera3D.new()
	cam_node.name = "RuleCamera"
	cam_node.near = 0.1
	cam_node.far = 8000.0
	get_parent().add_child(cam_node)
	cam_node.make_current()
	_show_camera(0.0, false)   # placed, not yet driven: the page drives its camera first on its first frame


func _show_camera(dt: float, drive := true) -> void:
	if cam_node == null or not cam_node.is_inside_tree():
		return
	var p: Array = cam["pos"]
	var look = cam["lookAt"]
	if not (look is Array):
		var h := float(cam["heading"])
		var pi := float(cam.get("pitch", 0.0))
		look = [float(p[0]) + cos(pi) * cos(h), float(p[1]) + cos(pi) * sin(h), float(p[2]) + sin(pi)]
	var eye_at := [float(p[0]), float(p[1]), float(p[2])]
	if drive and cam_rule.get("type") == "follow":
		var d := Vector3(eye_at[0] - look[0], eye_at[1] - look[1], eye_at[2] - look[2])
		var full := d.length()
		if full > 1e-3:
			var u := d / full
			var hit := RulesScript.ray_land(world.get("ground"), look, [u.x, u.y, u.z], full)
			var target := maxf(0.15, minf(1.0, (hit - 3.0) / full))
			if target < _cam_cd:
				_cam_cd = target
			else:
				_cam_cd += (target - _cam_cd) * (1.0 - exp(-6.0 * dt))
			eye_at = [look[0] + u.x * full * _cam_cd, look[1] + u.y * full * _cam_cd, look[2] + u.z * full * _cam_cd]
	var from := Vector3(eye_at[0], eye_at[2], -eye_at[1]) * units
	var to := Vector3(float(look[0]), float(look[2]), -float(look[1])) * units
	cam_node.global_position = from
	if from.distance_to(to) > 1e-6:
		var up := Vector3.UP if absf((to - from).normalized().dot(Vector3.UP)) < 0.999 else Vector3.FORWARD
		cam_node.look_at(to, up)


var _shown := Vector3.INF   # where the pose last put the node: a node moved since (a script, a probe) moves the pose
var _shown_yaw := INF       # and how it last turned it: a node turned since turns the pose


func _adopt() -> void:
	if _shown != Vector3.INF and position.distance_to(_shown) > 1e-6:
		var eye := float(rule.get("eye", 0.0))
		ent["pos"] = [position.x / units, -position.z / units, position.y / units + eye]
		_shown = position
	if _shown_yaw != INF and absf(rotation.y - _shown_yaw) > 1e-9:
		ent["heading"] = rotation.y + PI / 2.0
		_shown_yaw = rotation.y


func _show_pose(before: Vector3, delta: float) -> void:
	var p: Array = ent["pos"]
	var eye := float(rule.get("eye", 0.0)) if rule is Dictionary else 0.0
	position = Vector3(float(p[0]), float(p[2]) - eye, -float(p[1])) * units
	_shown = position
	rotation.y = float(ent["heading"]) - PI / 2.0
	_shown_yaw = rotation.y
	if pitch_node != null and String(rule.get("turnMode", "tank")) != "tank":
		pitch_node.rotation.x = float(ent.get("pitch", 0.0))
	velocity = (position - before) / delta if delta > 0.0 else Vector3.ZERO


# the keys as the page's pilot scheme reads them: W/S forward, A/D turn (a strafe under a look), Q/E strafe, Space jumps
var _was_jump := false
var _look := Vector2.ZERO
func _key_input() -> Dictionary:
	var k := func(a: int, b: int) -> float: return 1.0 if (Input.is_physical_key_pressed(a) or Input.is_physical_key_pressed(b)) else 0.0
	var space := Input.is_physical_key_pressed(KEY_SPACE)
	var i := {
		"forward": (1.0 if auto_walk else k.call(KEY_W, KEY_UP)) - k.call(KEY_S, KEY_DOWN),
		"turn": k.call(KEY_D, KEY_RIGHT) - k.call(KEY_A, KEY_LEFT),
		"strafe": k.call(KEY_E, KEY_E) - k.call(KEY_Q, KEY_Q),
		"lookDX": _look.x, "lookDY": _look.y,
		"jump": 1.0 if (space and not _was_jump) else 0.0, "jumpHeld": 1.0 if space else 0.0,
	}
	_was_jump = space
	_look = Vector2.ZERO
	return i


# the pose in the recipe's frame, for the level's bus and the harness's key
func recipe_pos() -> Array:
	_adopt()
	return (ent["pos"] as Array).duplicate()


func recipe_heading() -> float:
	return float(ent["heading"])


func warp_to(p: Array) -> void:
	ent["pos"] = [float(p[0]), float(p[1]), float(p[2])]
	_show_pose(position, 0.0)
