extends Control
# mojulo-godot kernel — the menu. Builds the level list from the Game
# autoload's table (game.json); locked entries show their gate state.


func _ready() -> void:
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	var music: AudioStreamPlayer = get_node_or_null("Music")
	if music != null:
		if music.stream is AudioStreamWAV:
			var s: AudioStreamWAV = music.stream
			s.loop_mode = AudioStreamWAV.LOOP_FORWARD
			s.loop_end = int(s.get_length() * s.mix_rate)
		music.play()
	var game := get_node("/root/Game")
	var vbox := VBoxContainer.new()
	vbox.set_anchors_preset(Control.PRESET_CENTER)
	vbox.add_theme_constant_override("separation", 12)
	add_child(vbox)
	var heading := Label.new()
	heading.text = game.title
	heading.add_theme_font_size_override("font_size", 40)
	vbox.add_child(heading)
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
