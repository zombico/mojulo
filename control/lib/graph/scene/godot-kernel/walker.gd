extends CharacterBody3D
# mojulo-godot kernel — the walker. Constructed by level.gd from the score's
# eye height (1 mojulo unit = 1 meter at eye 1.7). WASD/arrows + mouse look,
# Space jumps, Esc frees the mouse (click to recapture). First person by
# default (the Head camera at eye height); when the player's figure is a
# rigged body, level.gd calls set_camera_rig() and the Head hangs off a
# SpringArm3D behind a chest-line pivot instead (walking-suit-backport.md
# rule 7 — frame the SUIT, not the pilot eye). auto_walk is the headless
# locomotion probe (G-P): a persistent forward input, no keys needed.

const MOUSE_SENS := 0.002

var speed := 6.0
var jump := 4.5
var gravity := 9.8
var kill_y := -100.0
var spawn := Vector3.ZERO
var auto_walk := false
var head: Camera3D = null
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


func _ready() -> void:
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		rotate_y(-event.relative.x * MOUSE_SENS)
		if pitch_node != null:
			pitch_node.rotate_x(-event.relative.y * MOUSE_SENS)
			pitch_node.rotation.x = clampf(pitch_node.rotation.x, -1.5, 1.5)
	elif event is InputEventMouseButton and event.pressed:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	elif event.is_action_pressed("ui_cancel"):
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE


func _physics_process(delta: float) -> void:
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
	dir = dir.normalized()
	velocity.x = dir.x * speed
	velocity.z = dir.z * speed
	move_and_slide()
	if global_position.y < kill_y:
		global_position = spawn
		velocity = Vector3.ZERO
