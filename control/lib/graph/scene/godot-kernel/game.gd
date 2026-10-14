extends Node
# mojulo-godot kernel — the game shell (autoload "Game"). Reads game.json at startup: the level table, each level's
# gate, and the store schema. Since 0.9.0 the STORE travels (kernel/store.gd, the web's store ported and held equal):
# a level ends with one outcome envelope, applied atomically against that level's contract (levels/<ref>/contract.json);
# beating a level records it in the progression slice, as the web shell does; gates on a flag or a completion open
# the list; and a level starts with the slices its contract consumes (so a chapter turned earlier is carried in). The
# store persists to user://store.json as the web's save ({ contractVersion, storeState, runLog }). A game with no
# store schema keeps completion only (user://progress.cfg), as before.
#
# TRAVEL (since 0.23.0, the web shell's play-shell.js): a MAP game (levels with `exits`) opens the levels found through
# open exits and goes straight on through the exit a level was won by, telling the next where it came from
# (params.arrive); a DOOR (a building whose scene changes at its door: manifest.links) applies what the session
# gathered (a 'transit' envelope) and loads the level it opens into, entered by its own door (params.__entry); a RUN
# (manifest.run) draws `length` levels in an order rolled from its number (the web's own roll), goes on through each
# clear and ends at a fall, the deepest kept in user://runs.cfg; a level's KEPT numbers (game.keep, sent as
# stats.kept) are remembered beside the best this save has seen, in user://bests.json.

const SAVE := "user://progress.cfg"
const RUNS := "user://runs.cfg"
const BESTS := "user://bests.json"
const STORE_SAVE := "user://store.json"
const StoreScript := preload("res://kernel/store.gd")
const JsonExact := preload("res://kernel/json_exact.gd")
const Bus := preload("res://kernel/bus.gd")

var title := "mojulo game"
var levels: Array = []  # [{ref, title, gate, exits?}]: gate is the manifest's gate object, or null
var links := {}         # door links: { ref: { door: { ref, door } } }, both ways (manifest.links)
var run_cfg = null      # manifest.run: { length }, or null
var run = null          # the run under way: { n, order: [ref], at }
var session: Dictionary = {}   # the level under way: { ref, params, seed }
var pending = null      # a level's params set by the travel that launched it (arrive, a door's carry), read once
var completed := {}
var current := ""
var store = null
var schema: Dictionary = {}
var state: Dictionary = {}
var run_log: Array = []
var stinger: AudioStreamPlayer = null   # since 0.20.0: audio/stinger-<victory|defeat>.wav, played once as a level ends
var stinger_until := 0                  # when it ends (msec): the menu's music waits for it


func _ready() -> void:
	var parsed = JsonExact.parse(FileAccess.get_file_as_string("res://game.json"))
	if parsed is Dictionary:
		title = String(parsed.get("title", title))
		for l in parsed.get("levels", []):
			if not l is Dictionary:
				continue
			var row := {
				"ref": String(l.get("ref", "")),
				"title": String(l.get("title", l.get("ref", ""))),
				"gate": l.get("gate") if l.get("gate") is Dictionary else null,
			}
			if l.get("exits") is Array:
				row["exits"] = l["exits"]
			levels.append(row)
		for lk in (parsed.get("links") if parsed.get("links") is Array else []):
			if lk is Dictionary and lk.get("from") is Dictionary and lk.get("to") is Dictionary:
				if not links.has(lk["from"]["ref"]):
					links[lk["from"]["ref"]] = {}
				links[lk["from"]["ref"]][lk["from"]["door"]] = lk["to"]
				if not links.has(lk["to"]["ref"]):
					links[lk["to"]["ref"]] = {}
				links[lk["to"]["ref"]][lk["to"]["door"]] = lk["from"]
		if parsed.get("run") is Dictionary:
			run_cfg = parsed["run"]
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
		# a map opens what is found through open exits (store.gd reachable), a list reads each gate
		return bool(store.reachable(schema, state, levels).get(levels[i]["ref"], false)) if store.is_map(levels) else store.eval_gate(schema, state, gate)
	# no store: a completion gate reads the progress file; any other gate is approximated as open
	if gate is Dictionary and gate.has("completed"):
		return completed.has(String(gate["completed"]))
	return true


# `arrive`: the level a map game's travel came from; `carry`: the params a door brings in, in place of the level's own
func start_level(ref: String, arrive := "", carry = null) -> void:
	current = ref
	pending = carry.duplicate(true) if carry is Dictionary else null
	if arrive != "":
		if pending == null:
			pending = {}
		pending["arrive"] = arrive
	# the session's seed, as the web shell numbers it: a run's level by its number and place, else the launches so far
	session = {"ref": ref, "seed": run["n"] * 100 + run["at"] + 1 if run is Dictionary else run_log.size() + 1}
	get_tree().change_scene_to_file("res://levels/%s/level.tscn" % ref)


# the params the level under way starts with: what its travel brought (a door's carry, the arrive), else its consumed
# slices with the arrive beside them
func session_params(contract: Dictionary) -> Dictionary:
	var p: Dictionary
	if pending is Dictionary and pending.has("__entry"):
		p = pending
	else:
		p = params_for(contract)
		if pending is Dictionary and pending.has("arrive"):
			p["arrive"] = pending["arrive"]
	pending = null
	session["params"] = p
	return p


func session_seed() -> int:
	return int(session.get("seed", 1))


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


# the one write per level: the envelope against the level's contract, then completion recorded on success; then where
# the game goes: a run's next level or its end, a map's next level through the exit won by, else the menu
func level_finish(envelope: Dictionary, contract: Dictionary) -> void:
	var success: bool = envelope.get("result") == "success"
	var applied := store == null
	if store != null:
		var r: Dictionary = store.apply_outcome(schema, state, contract, envelope)
		if not r["ok"]:
			push_warning("moj: outcome rejected (store untouched): " + "; ".join(r["errors"]))
		else:
			applied = true
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
	var from := current
	if run is Dictionary:
		await get_tree().create_timer(1.4).timeout
		_run_outcome(envelope)
		return
	# TRAVEL: a success through an open exit goes straight on to the level it leads to
	var to = store.travel(schema, state, levels, from, String(envelope["exit"])) if (store != null and applied and success and envelope.get("exit") is String) else null
	if to != null:
		print("moj: %s -> %s" % [from, to])
		start_level(String(to), from)
		return
	play_stinger("victory" if success else "defeat" if envelope.get("result") == "fail" else "")
	if envelope.get("stats") is Dictionary and envelope["stats"].get("kept") is Array:
		keep_bests(from, envelope)
	await get_tree().create_timer(2.4 if envelope.get("stats") is Dictionary else 1.6).timeout
	to_menu()


# a DOOR crossed: what the session gathered (result 'transit') applies, and the level the door opens into loads, entered
# by its own door. Refused (the envelope, a link to nowhere, a locked level): false, and nothing changed.
func level_transit(door: String, envelope: Dictionary, contract: Dictionary) -> bool:
	if store != null:
		var r: Dictionary = store.apply_transit(schema, state, contract, envelope)
		if not r["ok"]:
			push_warning("moj: the door could not be taken; nothing changed: " + "; ".join(r["errors"]))
			return false
		state = r["state"]
		if not (envelope.get("events", []) as Array).is_empty():
			run_log.append(envelope)
		_save_store()
	var to = links.get(current, {}).get(door)
	var lv = null
	for l in levels:
		if to is Dictionary and l["ref"] == to.get("ref"):
			lv = l
	if lv == null:
		push_warning("moj: that door leads nowhere")
		return false
	if store != null and lv["gate"] != null and not store.eval_gate(schema, state, lv["gate"]):
		push_warning("moj: %s is locked" % lv["title"])
		return false
	var carry: Dictionary = (session.get("params", {}) as Dictionary).duplicate(true)
	carry["__entry"] = {"door": to["door"], "from": current}
	print("moj: door %s -> %s" % [door, lv["ref"]])
	start_level(lv["ref"], "", carry)
	return true


# ── runs ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
func _num(key: String) -> int:
	var cfg := ConfigFile.new()
	return int(cfg.get_value("runs", key, 0)) if cfg.load(RUNS) == OK else 0


func _keep(key: String, v: int) -> void:
	var cfg := ConfigFile.new()
	cfg.load(RUNS)
	cfg.set_value("runs", key, v)
	cfg.save(RUNS)


func runs_so_far() -> int:
	return _num("runs")


func deepest() -> int:
	return _num("deepest")


func start_run() -> void:
	var n := _num("runs") + 1
	_keep("runs", n)
	run = {"n": n, "order": roll(n), "at": 0}
	start_level(run["order"][0])


# a level of the run ended: on to the next, or the run's end (the deepest kept)
func _run_outcome(envelope: Dictionary) -> void:
	if envelope.get("result") == "success":
		run["at"] += 1
	var deep := _num("deepest")
	var won: bool = run["at"] >= (run["order"] as Array).size()
	if run["at"] > deep:
		_keep("deepest", run["at"])
	if envelope.get("result") == "success" and not won:
		print("moj: cleared %d of %d" % [run["at"], (run["order"] as Array).size()])
		start_level(run["order"][run["at"]])
		return
	print("moj: run %d %s: %d of %d" % [run["n"], "complete" if won else "over", run["at"], (run["order"] as Array).size()])
	if envelope.get("stats") is Dictionary and envelope["stats"].get("kept") is Array:
		keep_bests(run["order"][mini(run["at"], (run["order"] as Array).size() - 1)], envelope)
	run = null
	to_menu()


# the run's order, rolled from its number: the web shell's roll (a mulberry32 over n * 2654435761), its 32-bit
# arithmetic held exactly in 64-bit ints
static func _u32(x: int) -> int:
	return x & 0xFFFFFFFF


static func _s32(x: int) -> int:
	x &= 0xFFFFFFFF
	return x - 0x100000000 if x >= 0x80000000 else x


static func _imul(a: int, b: int) -> int:
	var ah := (a >> 16) & 0xFFFF
	var al := a & 0xFFFF
	var bh := (b >> 16) & 0xFFFF
	var bl := b & 0xFFFF
	return _s32(al * bl + (((ah * bl + al * bh) << 16) & 0xFFFFFFFF))


func roll(n: int) -> Array:
	var a := _u32(n * 2654435761)
	var pool: Array = levels.map(func(l): return l["ref"])
	for i in range(pool.size() - 1, 0, -1):
		a = _s32(a + 0x6d2b79f5)
		var t := _imul(_u32(a) ^ (_u32(a) >> 15), 1 | _u32(a))
		t = _s32(t + _imul(_u32(t) ^ (_u32(t) >> 7), 61 | _u32(t))) ^ t
		var r := float(_u32(_u32(t) ^ (_u32(t) >> 14))) / 4294967296.0
		var j := int(floor(r * (i + 1)))
		var x = pool[i]
		pool[i] = pool[j]
		pool[j] = x
	return pool.slice(0, int(run_cfg.get("length", pool.size())) if run_cfg is Dictionary else pool.size())


# ── kept bests ───────────────────────────────────────────────────────────────────────────────────────────────────────
# each kept number beside the best this save has seen, and a new best remembered: a low best (a time) counts only a
# cleared run, a high one (a score) any run. → [{ label, value, best, prior, better }]
func keep_bests(ref: String, envelope: Dictionary) -> Array:
	var bests = JsonExact.parse(FileAccess.get_file_as_string(BESTS)) if FileAccess.file_exists(BESTS) else {}
	if not (bests is Dictionary):
		bests = {}
	var out := []
	for k in envelope["stats"]["kept"]:
		if not (k is Dictionary):
			continue
		var key := "%s:%s" % [ref, String(k.get("label", ""))]
		var v = k.get("value")
		var prior = bests.get(key)
		var counts: bool = (v is float or v is int) and is_finite(float(v)) and (k.get("best") == "high" or envelope.get("result") == "success")
		var better: bool = counts and (prior == null or (float(v) > float(prior) if k.get("best") == "high" else float(v) < float(prior)))
		if better:
			bests[key] = v
		out.append({"label": k.get("label"), "value": v, "best": k.get("best"), "prior": prior, "better": better})
		print("moj: kept %s %s%s" % [k.get("label"), str(v), (" · new best!" if prior != null else "") if better else (" · best %s" % str(prior) if prior != null else "")])
	var f := FileAccess.open(BESTS, FileAccess.WRITE)
	if f != null:
		f.store_string(Bus.ss(bests))
		f.close()
	return out


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
