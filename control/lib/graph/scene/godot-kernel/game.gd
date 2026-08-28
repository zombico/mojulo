extends Node
# mojulo-godot kernel — the game shell (autoload "Game"). Reads game.json at
# startup: level table + completion gates. Progression persists to
# user://progress.cfg. Store slices beyond completion do not travel (see the
# pack README ledger).

const SAVE := "user://progress.cfg"

var title := "mojulo game"
var levels: Array = []  # [{ref, title, gate}] — gate = ref that must be completed, or ""
var completed := {}
var current := ""


func _ready() -> void:
	var txt := FileAccess.get_file_as_string("res://game.json")
	var parsed = JSON.parse_string(txt)
	if parsed is Dictionary:
		title = String(parsed.get("title", title))
		for l in parsed.get("levels", []):
			if not l is Dictionary:
				continue
			var gate := ""
			if l.get("gate") is Dictionary:
				gate = String((l["gate"] as Dictionary).get("completed", ""))
			levels.append({
				"ref": String(l.get("ref", "")),
				"title": String(l.get("title", l.get("ref", ""))),
				"gate": gate,
			})
	var cfg := ConfigFile.new()
	if cfg.load(SAVE) == OK:
		for ref in cfg.get_value("progress", "completed", []):
			completed[ref] = true


func is_unlocked(i: int) -> bool:
	var gate: String = levels[i]["gate"]
	return gate == "" or completed.has(gate)


func start_level(ref: String) -> void:
	current = ref
	get_tree().change_scene_to_file("res://levels/%s/level.tscn" % ref)


func level_complete() -> void:
	if current != "":
		completed[current] = true
		_save()
	await get_tree().create_timer(1.5).timeout
	to_menu()


func level_failed() -> void:
	await get_tree().create_timer(1.5).timeout
	to_menu()


func to_menu() -> void:
	current = ""
	get_tree().change_scene_to_file("res://menu.tscn")


func _save() -> void:
	var cfg := ConfigFile.new()
	cfg.set_value("progress", "completed", completed.keys())
	cfg.save(SAVE)
