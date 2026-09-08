# godot-materials-probe.gd — the machine-gate MATERIALS probe (interchange-next.plan.md N5).
# Run by scripts/export-godot.mjs against an already-imported pack:
#   godot --headless --path <pack> --script <this file> [-- res://levels/a/model.glb ...]
# Loads each GLB (default res://model.glb) as Godot imported it and reports, per surface, whether the
# importer built an UNSHADED material (KHR_materials_unlit — the mojulo look) or a
# shaded one (real pbrMetallicRoughness — the lit handoff), plus the Light3D nodes
# KHR_lights_punctual became. Gate-only: nothing of this rides the pack. One line:
#   [mojulo-materials] surfaces=N unshaded=N shaded=N other=N lights=N
extends SceneTree

func _init() -> void:
	var paths: PackedStringArray = OS.get_cmdline_user_args()
	if paths.is_empty():
		paths = PackedStringArray(["res://model.glb"])
	var c := {"files": 0, "surfaces": 0, "unshaded": 0, "shaded": 0, "other": 0, "lights": 0}
	for p in paths:
		var packed := load(p)
		if packed == null or not (packed is PackedScene):
			print("[mojulo-materials] error=%s did not load as a PackedScene" % p)
			quit(1)
			return
		var root: Node = (packed as PackedScene).instantiate()
		c.files += 1
		_walk(root, c)
		root.free()
	print("[mojulo-materials] files=%d surfaces=%d unshaded=%d shaded=%d other=%d lights=%d" % [c.files, c.surfaces, c.unshaded, c.shaded, c.other, c.lights])
	quit(0)

func _walk(n: Node, c: Dictionary) -> void:
	if n is Light3D:
		c.lights += 1
	if n is MeshInstance3D:
		var mi := n as MeshInstance3D
		if mi.mesh != null:
			for i in range(mi.mesh.get_surface_count()):
				c.surfaces += 1
				var m: Material = mi.get_active_material(i)
				if m is BaseMaterial3D:
					if (m as BaseMaterial3D).shading_mode == BaseMaterial3D.SHADING_MODE_UNSHADED:
						c.unshaded += 1
					else:
						c.shaded += 1
				else:
					c.other += 1
	for ch in n.get_children():
		_walk(ch, c)
