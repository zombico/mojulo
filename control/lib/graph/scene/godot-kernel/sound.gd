extends Node
# mojulo-godot kernel — the level's sound (since 0.19.0): its action sounds and the music that follows play. Reads
# score.json's `audio` (engine-sound.js): one-shot sounds rendered to audio/sfx/<id>_<n>.wav (n under `variants`), the
# bus events that fire them (`on`: the first matching glob, one sound at most every 60 ms, the page's rule), the hero's
# own moves (footsteps, weapon, strike, dodge: the same sim edges the page reads), and a fight score (`combat`) that
# the tension brings in on the bar line. The meter and the change are the page's (adaptive-music.js buildAdaptive),
# ported here and held equal to it by scripts/godot-sound-conformance.mjs. Presentation only: it reads the bus log,
# the walker and the hero, and never writes back.

const COOLDOWN := 0.06       # seconds of game time between two plays of one sound
const STRIDE := 2.2          # metres walked per footstep (the page's first-person walk)
const LAND_AIR := 0.15       # seconds in the air before touching down is a landing

signal music_changed(to: String)
signal played(id: String)

var level = null
var audio: Dictionary = {}
var players: Dictionary = {}     # sound id -> AudioStreamPlayer over an AudioStreamRandomizer of its takes
var last_at: Dictionary = {}     # sound id -> when it last played, on the level's clock
var clock := 0.0                 # game time (paused with the tree, as fast as a fixed-fps probe)
var explore: AudioStreamPlayer = null
var fight: AudioStreamPlayer = null
var music_db := 0.0
var cfg: Dictionary = {}
var tension := 0.0
var music := {"active": "explore", "below": 0.0}
var switching := false
var walked := 0.0
var last_pos = null
var air := 0.0
var was_floor := true
var hero_last: Dictionary = {}


# THE METER AND THE CHANGE: adaptive-music.js buildAdaptive, rule for rule (glob, raise, leak, nextBar, decide)
static func glob(pat: String, t: String) -> bool:
	if pat == "*":
		return true
	if pat.find("*") < 0:
		return pat == t
	var parts := pat.split("*")
	if not t.begins_with(parts[0]):
		return false
	var at := parts[0].length()
	for i in range(1, parts.size() - 1):
		if parts[i] == "":
			continue
		var k := t.find(parts[i], at)
		if k < 0:
			return false
		at = k + parts[i].length()
	var last: String = parts[parts.size() - 1]
	return t.length() - last.length() >= at and t.ends_with(last)


static func raise(t: float, type: String, on: Dictionary) -> float:
	for pat in on:
		if glob(String(pat), type):
			return minf(1.0, t + float(on[pat]))
	return t


static func leak(t: float, dt: float, decay: float) -> float:
	return t * exp(-dt / decay) if dt > 0.0 else t


static func next_bar(earliest: float, t0: float, bar: float) -> float:
	return t0 + maxf(0.0, ceil((earliest - t0) / bar - 1e-9)) * bar


static func decide(st: Dictionary, t: float, dt: float, c: Dictionary, combat_bar: float) -> Dictionary:
	if String(st["active"]) == "explore":
		return {"active": "combat", "below": 0.0, "to": "combat"} if t >= float(c["enter"]) else {"active": "explore", "below": 0.0}
	var below := float(st["below"]) + dt if t <= float(c["exit"]) else 0.0
	return {"active": "explore", "below": 0.0, "to": "explore"} if below >= float(c["hold"]) * combat_bar else {"active": "combat", "below": below}


func setup(lv, a: Dictionary, music_player: AudioStreamPlayer) -> void:
	level = lv
	audio = a
	explore = music_player
	var has_buses := AudioServer.get_bus_index("SFX") >= 0
	var takes := int(audio.get("variants", 1))
	for id in audio.get("sounds", []):
		var r := AudioStreamRandomizer.new()
		r.playback_mode = AudioStreamRandomizer.PLAYBACK_RANDOM_NO_REPEATS if takes > 2 else AudioStreamRandomizer.PLAYBACK_RANDOM
		r.random_pitch = 1.0
		r.random_volume_offset_db = 0.0
		for n in range(takes):
			var s = load("res://audio/sfx/%s_%d.wav" % [id, n])
			if s != null:
				r.add_stream(-1, s)
		if r.streams_count == 0:
			continue
		var p := AudioStreamPlayer.new()
		p.name = "sfx_" + String(id)
		p.stream = r
		p.max_polyphony = 4
		if has_buses:
			p.bus = "SFX"
		add_child(p)
		players[String(id)] = p
	if explore != null:
		music_db = explore.volume_db
		if AudioServer.get_bus_index("Music") >= 0:
			explore.bus = "Music"
	if audio.get("combat") is String and explore != null:
		var cs = load("res://audio/%s.wav" % audio["combat"])
		if cs != null:
			if cs is AudioStreamWAV:
				cs.loop_mode = AudioStreamWAV.LOOP_FORWARD
				cs.loop_end = int(cs.get_length() * cs.mix_rate)
			fight = AudioStreamPlayer.new()
			fight.name = "Combat"
			fight.stream = cs
			fight.volume_db = -80.0
			fight.bus = explore.bus
			add_child(fight)
			cfg = audio.get("tension", {}) if audio.get("tension") is Dictionary else {}
			for k in ["enter", "exit", "hold", "decay"]:
				if not cfg.has(k):
					cfg[k] = {"enter": 0.6, "exit": 0.25, "hold": 2.0, "decay": 6.0}[k]
			if not cfg.get("on") is Dictionary:
				cfg["on"] = {}


func play(id) -> void:
	if not id is String or not players.has(id):
		return
	if last_at.has(id) and clock - float(last_at[id]) < COOLDOWN:
		return
	last_at[id] = clock
	players[id].play()
	played.emit(id)


# one event off the bus (level.gd _drain_bus): its sound, and the tension it raises
func hear(type: String) -> void:
	var on = audio.get("on")
	if on is Dictionary:
		for pat in on:
			if glob(String(pat), type):
				play(on[pat])
				break
	if fight != null:
		tension = raise(tension, type, cfg["on"])


func step(delta: float, walker, hero) -> void:
	clock += delta
	_moves(delta, walker, hero)
	if fight == null:
		return
	var dt := minf(0.25, delta)
	tension = leak(tension, dt, float(cfg["decay"]))
	if switching:
		return
	var next := decide(music, tension, dt, cfg, float(audio["bar"]["combat"]))
	if next.has("to"):
		_switch(String(next["to"]))
	else:
		music = next


# the hero's own moves, by their edges (the page's footsteps, weapon, strike and dodge layers)
func _moves(delta: float, walker, hero) -> void:
	var fs = audio.get("footsteps")
	if fs is Dictionary and walker != null:
		var on_floor: bool = walker.is_on_floor()
		var pos: Vector3 = walker.global_position
		if on_floor and last_pos != null:
			walked += Vector2(pos.x - last_pos.x, pos.z - last_pos.z).length()
			if walked >= STRIDE:
				walked = 0.0
				play(fs.get("step"))
		if was_floor and not on_floor and walker.velocity.y > 0.0:
			play(fs.get("jump"))
		if on_floor and not was_floor and air >= LAND_AIR:
			play(fs.get("land"))
		air = 0.0 if on_floor else air + delta
		was_floor = on_floor
		last_pos = pos
	if not hero is Dictionary:
		return
	var w = hero.get("weapon")
	var shots := int(w.get("shots", 0)) if w is Dictionary else 0
	var reloading := bool(w.get("reloading", false)) if w is Dictionary else false
	var counts := {"shots": shots, "swing": int(hero.get("swingCount", 0)), "melee": int(hero.get("meleeHitCount", 0)), "dodge": int(hero.get("dodgeCount", 0)), "reloading": reloading}
	if not hero_last.is_empty():
		var wp = audio.get("weapon")
		if wp is Dictionary:
			if counts["shots"] > int(hero_last["shots"]):
				play(wp.get("shot"))
			if reloading and not bool(hero_last["reloading"]):
				play(wp.get("reload"))
		var sk = audio.get("strike")
		if sk is Dictionary:
			if counts["swing"] > int(hero_last["swing"]):
				play(sk.get("swing"))
			if counts["melee"] > int(hero_last["melee"]):
				play(sk.get("hit"))
		if counts["dodge"] > int(hero_last["dodge"]):
			play(audio.get("dodge"))
	hero_last = counts


# the change on the bar line: the incoming piece starts from its top on the playing piece's next bar line (a quarter
# second out at least) and the two crossfade over one bar of the incoming piece; the outgoing stops after it
func _switch(to: String) -> void:
	switching = true
	var out_p: AudioStreamPlayer = explore if to == "combat" else fight
	var in_p: AudioStreamPlayer = fight if to == "combat" else explore
	var bar_out := float(audio["bar"]["explore" if to == "combat" else "combat"])
	var bar_in := float(audio["bar"][to])
	var pos := out_p.get_playback_position() + AudioServer.get_time_since_last_mix() if out_p.playing else 0.0
	var at := next_bar(pos + 0.25, 0.0, bar_out)
	await get_tree().create_timer(at - pos).timeout
	if not is_inside_tree():
		return
	var full := db_to_linear(music_db)
	in_p.volume_db = -80.0
	in_p.play(0.0)
	var tw := create_tween().set_parallel()
	tw.tween_property(in_p, "volume_linear", full, bar_in)
	tw.tween_property(out_p, "volume_linear", 0.0, bar_in)
	music = {"active": to, "below": 0.0}
	music_changed.emit(to)
	await get_tree().create_timer(bar_in + 0.2).timeout
	if not is_inside_tree():
		return
	out_p.stop()
	switching = false


# the level ended: when the game plays a stinger, the music makes room for it
func finish(result: String) -> void:
	var game = get_node_or_null("/root/Game")
	if game == null or not game.has_method("has_stinger") or not game.has_stinger(result):
		return
	for p in [explore, fight]:
		if p != null and p.playing:
			create_tween().tween_property(p, "volume_linear", 0.0, 0.4)
