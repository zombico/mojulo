extends Node
# mojulo-godot kernel — the game shell (autoload "Game"). Reads game.json at startup: the level table, each level's
# gate, and the store schema. Since 0.9.0 the STORE travels (kernel/store.gd, the web's store ported and held equal):
# a level ends with one outcome envelope, applied atomically against that level's contract (levels/<ref>/contract.json);
# beating a level records it in the progression slice, as the web shell does; gates on a flag or a completion open
# the list; and a level starts with the slices its contract consumes (so a chapter turned earlier is carried in). The
# store persists to user://store.json as the web's save ({ contractVersion, storeState, runLog }). A game with no
# store schema keeps completion only (user://progress.cfg), as before.

const SAVE := "user://progress.cfg"
const STORE_SAVE := "user://store.json"
const StoreScript := preload("res://kernel/store.gd")
const JsonExact := preload("res://kernel/json_exact.gd")
const Bus := preload("res://kernel/bus.gd")

var title := "mojulo game"
var levels: Array = []  # [{ref, title, gate}]: gate is the manifest's gate object, or null
var completed := {}
var current := ""
var store = null
var schema: Dictionary = {}
var state: Dictionary = {}
var run_log: Array = []
var stinger: AudioStreamPlayer = null   # since 0.19.0: audio/stinger-<victory|defeat>.wav, played once as a level ends
var stinger_until := 0                  # when it ends (msec): the menu's music waits for it


func _ready() -> void:
	var parsed = JsonExact.parse(FileAccess.get_file_as_string("res://game.json"))
	if parsed is Dictionary:
		title = String(parsed.get("title", title))
		for l in parsed.get("levels", []):
			if not l is Dictionary:
				continue
			levels.append({
				"ref": String(l.get("ref", "")),
				"title": String(l.get("title", l.get("ref", ""))),
				"gate": l.get("gate") if l.get("gate") is Dictionary else null,
			})
		var st = parsed.get("store")
		if st is Dictionary and st.get("slices") is Array and not (st["slices"] as Array).is_empty():
			schema = st
			store = StoreScript.new()
			state = store.create_store(schema)
	var cfg := ConfigFile.new()
	if cfg.load(SAVE) == OK:
		for ref in cfg.get_value("progress", "completed", []):
			completed[ref] = true
	if store != null and FileAccess.file_exists(STORE_SAVE):
		var save = JsonExact.parse(FileAccess.get_file_as_string(STORE_SAVE))
		if save is Dictionary and Bus.strict_eq(save.get("contractVersion"), StoreScript.CONTRACT_VERSION) and save.get("storeState") is Dictionary:
			state = save["storeState"]
			run_log = save.get("runLog", []) if save.get("runLog") is Array else []


func is_unlocked(i: int) -> bool:
	var gate = levels[i]["gate"]
	if store != null:
		return store.eval_gate(schema, state, gate)
	# no store: a completion gate reads the progress file; any other gate is approximated as open
	if gate is Dictionary and gate.has("completed"):
		return completed.has(String(gate["completed"]))
	return true


func start_level(ref: String) -> void:
	current = ref
	get_tree().change_scene_to_file("res://levels/%s/level.tscn" % ref)


# the slices a level's contract consumes, as the web shell hands them in game-init (no setup picks: those stay web)
func params_for(contract: Dictionary) -> Dictionary:
	var params := {}
	if store == null:
		return params
	for c in contract.get("consumes", []):
		if c is Dictionary and state.has(c.get("slice")):
			params[c["slice"]] = (state[c["slice"]] as Dictionary).duplicate(true)
	return params


func _stinger_path(result: String) -> String:
	return "res://audio/stinger-%s.wav" % result


func has_stinger(result: String) -> bool:
	return ResourceLoader.exists(_stinger_path(result))


# the game's stinger for how a level ended, on the Music bus; it outlives the level's scene (the autoload holds it)
func play_stinger(result: String) -> void:
	if not has_stinger(result):
		return
	var s = load(_stinger_path(result))
	if s == null:
		return
	if stinger == null:
		stinger = AudioStreamPlayer.new()
		stinger.name = "Stinger"
		add_child(stinger)
	if AudioServer.get_bus_index("Music") >= 0:
		stinger.bus = "Music"
	stinger.stream = s
	stinger.play()
	stinger_until = Time.get_ticks_msec() + int(s.get_length() * 1000.0)


# the one write per level: the envelope against the level's contract, then completion recorded on success
func level_finish(envelope: Dictionary, contract: Dictionary) -> void:
	var success: bool = envelope.get("result") == "success"
	play_stinger("victory" if success else "defeat")
	if store != null:
		var r: Dictionary = store.apply_outcome(schema, state, contract, envelope)
		if not r["ok"]:
			push_warning("moj: outcome rejected (store untouched): " + "; ".join(r["errors"]))
		else:
			state = r["state"]
			if success:
				var prog = StoreScript.first_slice_of_kind(schema, "progression")
				if prog != null and not (state[prog]["completed"] as Dictionary).has(current):
					var pr: Dictionary = store.apply_events(schema, state, [{"type": "promote", "slice": prog, "ref": current, "result": "success"}])
					if pr["ok"]:
						state = pr["state"]
			run_log.append(envelope)
			_save_store()
	if success and current != "":
		completed[current] = true
		_save()
	await get_tree().create_timer(1.5).timeout
	to_menu()


# kept for scripts written against 0.8 and before
func level_complete() -> void:
	level_finish({"contractVersion": StoreScript.CONTRACT_VERSION, "levelRef": current, "seed": 1, "result": "success", "events": []}, {})


func level_failed() -> void:
	level_finish({"contractVersion": StoreScript.CONTRACT_VERSION, "levelRef": current, "seed": 1, "result": "fail", "events": []}, {})


func to_menu() -> void:
	current = ""
	get_tree().change_scene_to_file("res://menu.tscn")


func _save() -> void:
	var cfg := ConfigFile.new()
	cfg.set_value("progress", "completed", completed.keys())
	cfg.save(SAVE)


func _save_store() -> void:
	var f := FileAccess.open(STORE_SAVE, FileAccess.WRITE)
	if f == null:
		return
	f.store_string(Bus.ss({"contractVersion": StoreScript.CONTRACT_VERSION, "storeState": state, "runLog": run_log}))
	f.close()
