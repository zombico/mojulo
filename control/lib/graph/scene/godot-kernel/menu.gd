extends Control
# mojulo-godot kernel — the menu. Builds the level list from the Game
# autoload's table (game.json); locked entries show their gate state (a map
# game's: found through an open exit). A run game shows its run title instead.


func _ready() -> void:
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	var music: AudioStreamPlayer = get_node_or_null("Music")
	var game := get_node("/root/Game")
	if music != null:
		if music.stream is AudioStreamWAV:
			var s: AudioStreamWAV = music.stream
			s.loop_mode = AudioStreamWAV.LOOP_FORWARD
			s.loop_end = int(s.get_length() * s.mix_rate)
		if AudioServer.get_bus_index("Music") >= 0:
			music.bus = "Music"
		# a level's stinger still sounding: the menu's music waits for it (0.20.0)
		var wait := int(game.stinger_until) - Time.get_ticks_msec()
		if wait > 0:
			_play_later(music, wait / 1000.0)
		else:
			music.play()
	var vbox := VBoxContainer.new()
	vbox.set_anchors_preset(Control.PRESET_CENTER)
	vbox.add_theme_constant_override("separation", 12)
	add_child(vbox)
	var heading := Label.new()
	heading.text = game.title
	heading.add_theme_font_size_override("font_size", 40)
	vbox.add_child(heading)
	# a RUN game (manifest.run): its length, the deepest run kept, and a new run (the web shell's run title)
	if game.run_cfg is Dictionary:
		var line := Label.new()
		line.text = "a run: %d of %d levels, drawn anew each time; fall, and it ends" % [int(game.run_cfg.get("length", game.levels.size())), game.levels.size()]
		vbox.add_child(line)
		if game.runs_so_far() > 0:
			var deep := Label.new()
			deep.text = "deepest: %d of %d · %d run%s" % [game.deepest(), int(game.run_cfg.get("length", game.levels.size())), game.runs_so_far(), "" if game.runs_so_far() == 1 else "s"]
			vbox.add_child(deep)
		var go := Button.new()
		go.text = "new run" if game.runs_so_far() > 0 else "start a run"
		go.pressed.connect(func() -> void: game.start_run())
		vbox.add_child(go)
		return
	for i in range(game.levels.size()):
		var lv: Dictionary = game.levels[i]
		var btn := Button.new()
		btn.text = String(lv["title"])
		if game.completed.has(lv["ref"]):
			btn.text += "  [done]"
		if not game.is_unlocked(i):
			btn.text += "  [locked]"
			btn.disabled = true
		var ref: String = lv["ref"]
		btn.pressed.connect(func() -> void: game.start_level(ref))
		vbox.add_child(btn)


func _play_later(music: AudioStreamPlayer, seconds: float) -> void:
	await get_tree().create_timer(seconds).timeout
	if is_instance_valid(music):
		music.play()
