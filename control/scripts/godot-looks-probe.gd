# godot-looks-probe.gd — the machine-gate LOOKS probe (kernel 0.6.0, kernel/looks.gd). Gate-only: nothing of it rides a
# pack. Run against a folder holding kernel/ and a project.godot (the test makes one):
#   godot --headless --fixed-fps 60 --path <dir> --script <this file> -- <looks.json>
# Wears every look in looks.json (score.looks) on a box, brings a ball in by hologram and sends four more out (smoke,
# scan, transporter, galvatron), lifts the looks at frame 30 and reports at frames 30 and 150, one line each:
#   [mojulo-looks] frame=N worn=N overlays=N lit=N billboards=N runs=N fade=F visible=B gone=N
extends SceneTree

var looks: Node3D
var body: MeshInstance3D
var ball: MeshInstance3D
var frames := 0
var leaving: Array = []


func _initialize() -> void:
	var table = JSON.parse_string(FileAccess.get_file_as_string(OS.get_cmdline_user_args()[0]))
	var cam := Camera3D.new()
	cam.position = Vector3(0, 1, 4)
	root.add_child(cam)
	looks = load("res://kernel/looks.gd").new()
	root.add_child(looks)
	looks.setup(table)
	body = MeshInstance3D.new()
	body.mesh = BoxMesh.new()
	body.position = Vector3(0, 0.5, 0)
	root.add_child(body)
	ball = MeshInstance3D.new()
	ball.mesh = SphereMesh.new()
	ball.position = Vector3(2, 0.5, 0)
	root.add_child(ball)
	# not in the tree until _initialize returns: looks.gd waits a frame for it
	for name in table.keys():
		looks.wear(body, name)
	looks.transit(ball, "hologram", "in")
	for i in range(4):
		var b := MeshInstance3D.new()
		b.mesh = SphereMesh.new()
		b.position = Vector3(-2 - i, 0.5, 0)
		root.add_child(b)
		leaving.append(b)
		looks.transit(b, ["smoke", "scan", "transporter", "galvatron"][i], "out")


func _report() -> void:
	var lit := 0
	var mms := 0
	for c in looks.get_children():
		if c is MultiMeshInstance3D:
			for i in range(c.multimesh.instance_count):
				if c.multimesh.get_instance_transform(i).basis.get_scale().x > 0.0:
					mms += 1
	var ov := 1 if body.material_overlay != null else 0
	if ov and body.material_overlay is ShaderMaterial and float(body.material_overlay.get_shader_parameter("k")) > 0.0:
		lit = 1
	var gone := leaving.filter(func(b): return not b.visible).size()
	print("[mojulo-looks] frame=%d worn=%d overlays=%d lit=%d billboards=%d runs=%d fade=%.2f visible=%s gone=%d" % [frames, looks.worn.size(), ov, lit, mms, looks.runs.size(), ball.transparency, str(ball.visible), gone])


func _process(_delta: float) -> bool:
	frames += 1
	if frames == 30:
		_report()
		looks.lift(body)
	if frames == 150:
		_report()
		return true
	return false
