extends Node2D
# mojulo-godot arcade kernel — the shell for a pixelizer reducer game.
# Hand-authored and versioned (kernel/VERSION); the pack ships DATA
# (game.json, skin.json, probe/replay.json, audio/) and this script performs
# it. It is the Godot twin of brickster-shell.js: the same key map, gravity
# timer, start gate, HUD facts and SFX cues; the reducer itself is
# kernel/<reducer>.gd. One reducer, two instruments — the web build is the
# reference performance.
#
# Drawing discipline (the reason this file looks the way it does): every bank
# tile becomes ONE ImageTexture at _ready; the well is drawn in _draw() from
# the current state and queue_redraw() runs only when the reducer returned a
# NEW state; HUD labels are assigned only when their text changes. Nothing is
# allocated per frame.
#
# Headless probe, run by the export driver — no window needed:
#   godot --headless --path <pack> -- --mojulo-replay=res://probe/replay.json
# replays the fixture's seed + actions through the reducer, prints a
# [mojulo-replay] digest and a [mojulo-perf] line, then quits.

@export_file("*.json") var game_path: String = "res://game.json"
@export_file("*.json") var skin_path: String = "res://skin.json"
@export var music_path: String = ""
@export var sfx_dir: String = ""

const SCALE := 4
const TILE := 8
const WORLD_X := 16
const WORLD_Y := 12
const PANEL_W := 200
const BG := Color("#14141f")
const TITLE_COLOR := Color("#e8b040")
const LABEL_COLOR := Color("#7e8698")
const VALUE_COLOR := Color("#f2f4f8")
const HINT_COLOR := Color("#565e70")

var game: Dictionary = {}
var skin: Dictionary = {}
var Reducer: GDScript = null
var state: Dictionary = {}
var started := false
var since_tick_ms := 0.0

var cols := 12
var rows := 22
var well_bg := Color("#0c0c14")
var tex: Dictionary = {}          # legend char -> ImageTexture
var world_rows: Array = []        # the raster, rebuilt only when state changes

var labels: Dictionary = {}       # name -> Label, assigned on change
var card: PanelContainer = null
var card_label: Label = null
var music: AudioStreamPlayer = null
var music_started := false
var sfx: Dictionary = {}          # cue id -> AudioStreamPlayer


func _ready() -> void:
	game = _read_json(game_path)
	skin = _read_json(skin_path)
	var reducer := String(game.get("reducer", "brickster"))
	Reducer = load("res://kernel/%s.gd" % reducer)
	cols = Reducer.WELL_W + 2
	rows = Reducer.WELL_H - Reducer.HIDDEN + 2
	if skin.has("background") and skin["background"] != null:
		well_bg = Color(String(skin["background"]))
	_build_textures()
	_build_hud()
	_build_audio()
	state = Reducer.new_game(int(Time.get_unix_time_from_system()) & 0xFFFFFFFF)
	_render()
	_read_probe_args()


func _read_json(path: String) -> Dictionary:
	var txt := FileAccess.get_file_as_string(path)
	var parsed = JSON.parse_string(txt)
	return parsed if parsed is Dictionary else {}


# One texture per bank tile, built once. Cell chars are 1-based hex palette
# indices ('1' -> palette[0]); '.' is transparent — pixelizer.js's rule.
func _build_textures() -> void:
	var bank: Dictionary = skin.get("bank", {})
	var legend: Dictionary = skin.get("legend", {})
	for ch in legend.keys():
		var tile: Dictionary = bank.get(legend[ch], {})
		var cells: Array = tile.get("cells", [])
		var palette: Array = tile.get("palette", [])
		var img := Image.create(TILE, TILE, false, Image.FORMAT_RGBA8)
		img.fill(Color(0, 0, 0, 0))
		for y in range(mini(TILE, cells.size())):
			var row := String(cells[y])
			for x in range(mini(TILE, row.length())):
				var c := row[x]
				if c == ".":
					continue
				var idx := c.hex_to_int() - 1
				if idx >= 0 and idx < palette.size():
					img.set_pixel(x, y, Color(String(palette[idx])))
		tex[ch] = ImageTexture.create_from_image(img)


func _label(name: String, text: String, x: int, y: int, size: int, color: Color) -> Label:
	var l := Label.new()
	l.name = name
	l.text = text
	l.position = Vector2(x, y)
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	add_child(l)
	labels[name] = l
	return l


func _build_hud() -> void:
	var px := WORLD_X + cols * TILE * SCALE + 28
	var h := rows * TILE * SCALE + 48   # the well strip + a 24 px key line under it
	_label("title", String(game.get("title", "BRICKSTER")).to_upper(), px, 24, 15, TITLE_COLOR)
	_label("next_l", "NEXT", px, 66, 11, LABEL_COLOR)
	_label("score_l", "SCORE", px, 166, 11, LABEL_COLOR)
	_label("score", "000000", px, 182, 24, VALUE_COLOR)
	_label("lines_l", "LINES", px, 232, 11, LABEL_COLOR)
	_label("lines", "0000", px, 248, 24, VALUE_COLOR)
	_label("level_l", "LEVEL", px, 298, 11, LABEL_COLOR)
	_label("level", "00", px, 314, 24, VALUE_COLOR)
	_label("hold_l", "HOLD", px, h - 152, 11, LABEL_COLOR)
	var hint := _label("hint", String(game.get("menu", {}).get("tagline", "clear the lines")), px, h - 84, 11, HINT_COLOR)
	hint.custom_minimum_size.x = PANEL_W - 28
	hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	hint.max_lines_visible = 3
	hint.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	_label("keys", "arrows move / soft drop  ·  space hard drop  ·  z / x / up rotate  ·  c hold  ·  enter restart", WORLD_X, h - 22, 10, HINT_COLOR)
	card = PanelContainer.new()
	card.name = "Card"
	var box := StyleBoxFlat.new()
	box.bg_color = Color(0.047, 0.047, 0.086, 0.94)
	box.border_color = Color("#3a4258")
	box.set_border_width_all(1)
	box.set_corner_radius_all(8)
	box.content_margin_left = 24
	box.content_margin_right = 24
	box.content_margin_top = 14
	box.content_margin_bottom = 14
	card.add_theme_stylebox_override("panel", box)
	card_label = Label.new()
	card_label.add_theme_font_size_override("font_size", 15)
	card_label.add_theme_color_override("font_color", VALUE_COLOR)
	card_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	card.add_child(card_label)
	add_child(card)


func _build_audio() -> void:
	if music_path != "":
		var stream = load(music_path)
		if stream != null:
			music = AudioStreamPlayer.new()
			music.name = "Music"
			music.stream = stream
			if stream is AudioStreamWAV:
				stream.loop_mode = AudioStreamWAV.LOOP_FORWARD
				stream.loop_end = int(stream.get_length() * stream.mix_rate)
			add_child(music)
	if sfx_dir != "" and DirAccess.dir_exists_absolute(sfx_dir):
		for f in DirAccess.get_files_at(sfx_dir):
			if not f.ends_with(".wav"):
				continue
			var stream = load(sfx_dir.path_join(f))
			if stream == null:
				continue
			var p := AudioStreamPlayer.new()
			p.name = "sfx_" + f.get_basename()
			p.stream = stream
			add_child(p)
			sfx[f.get_basename()] = p


func _start_music() -> void:
	if music != null and not music_started:
		music_started = true
		music.play()


func _play_sfx(id: String) -> void:
	var p: AudioStreamPlayer = sfx.get(id)
	if p != null:
		p.play()


# brickster-shell.js gameSfx, verbatim in priority order.
func _game_sfx(before: Dictionary, after: Dictionary, action: String) -> void:
	if sfx.is_empty():
		return
	if not bool(before["over"]) and bool(after["over"]):
		_play_sfx("gameover")
		return
	var cleared: int = int(after["lines"]) - int(before["lines"])
	if cleared >= 4:
		_play_sfx("tetris")
		return
	if cleared > 0:
		_play_sfx("levelup" if Reducer.level_of(after) > Reducer.level_of(before) else "lineclear")
		return
	if action == "hold":
		_play_sfx("hold")
	elif action == "cw" or action == "ccw":
		_play_sfx("rotate")
	elif action == "hardDrop":
		_play_sfx("harddrop")
	elif not is_same(after["board"], before["board"]):
		_play_sfx("lock")


# ---- state -> picture ----------------------------------------------------

func _set_text(name: String, text: String) -> void:
	var l: Label = labels.get(name)
	if l != null and l.text != text:
		l.text = text


static func _pad(n: int, w: int) -> String:
	var s := str(n)
	while s.length() < w:
		s = "0" + s
	return s.right(w)


# brickster-skin.js buildWorldRecipe: the well and nothing else — walls, the
# settled stack, the ghost, the active piece (active overrides its ghost).
func _world_rows_of(st: Dictionary) -> Array:
	var hidden: int = Reducer.HIDDEN
	var well: Array = []
	for y in range(hidden, Reducer.WELL_H):
		well.append(_chars(String(st["board"][y])))
	if st["active"] != null:
		var a: Dictionary = st["active"]
		for c in Reducer.cells_of(a["type"], a["rot"], a["x"], a["y"] + Reducer.drop_distance(st)):
			if c[1] >= hidden and well[c[1] - hidden][c[0]] == ".":
				well[c[1] - hidden][c[0]] = "g"
		for c in Reducer.cells_of(a["type"], a["rot"], a["x"], a["y"]):
			if c[1] >= hidden:
				well[c[1] - hidden][c[0]] = String(a["type"]).to_lower()
	var out: Array = ["#".repeat(cols)]
	for row in well:
		out.append("#" + "".join(PackedStringArray(row)) + "#")
	out.append("#".repeat(cols))
	return out


static func _chars(s: String) -> Array:
	var out: Array = []
	for i in range(s.length()):
		out.append(s[i])
	return out


# rot-0 cells normalized to a 4x2 grid — the hold/next preview.
func _preview_rows(type) -> Array:
	if type == null:
		return ["....", "...."]
	var cells: Array = Reducer.rotations()[type][0]
	var min_x := 99
	var min_y := 99
	for c in cells:
		min_x = mini(min_x, c[0])
		min_y = mini(min_y, c[1])
	var grid: Array = [[".", ".", ".", "."], [".", ".", ".", "."]]
	for c in cells:
		grid[c[1] - min_y][c[0] - min_x] = String(type).to_lower()
	return ["".join(PackedStringArray(grid[0])), "".join(PackedStringArray(grid[1]))]


func _render() -> void:
	world_rows = _world_rows_of(state)
	_set_text("score", _pad(int(state["score"]), 6))
	_set_text("lines", _pad(int(state["lines"]), 4))
	_set_text("level", _pad(Reducer.level_of(state), 2))
	var over := bool(state["over"])
	var msg := ""
	if not started:
		msg = "%s — press enter to start" % String(game.get("title", "BRICKSTER")).to_upper()
	elif over:
		msg = "GAME OVER — enter to restart"
	if card != null:
		if card_label.text != msg:
			card_label.text = msg
		card.visible = msg != ""
		if card.visible:
			var ww := cols * TILE * SCALE
			var wh := rows * TILE * SCALE
			card.reset_size()
			card.position = Vector2(WORLD_X + ww / 2.0 - card.size.x / 2.0, WORLD_Y + wh / 2.0 - card.size.y / 2.0)
	queue_redraw()


func _draw() -> void:
	var ww := cols * TILE * SCALE
	var wh := rows * TILE * SCALE
	draw_rect(Rect2(0, 0, WORLD_X * 2 + ww + PANEL_W, wh + 48), BG)
	draw_rect(Rect2(WORLD_X, WORLD_Y, ww, wh), well_bg)
	var cell := TILE * SCALE
	for y in range(world_rows.size()):
		var row := String(world_rows[y])
		for x in range(row.length()):
			var t: ImageTexture = tex.get(row[x])
			if t != null:
				draw_texture_rect(t, Rect2(WORLD_X + x * cell, WORLD_Y + y * cell, cell, cell), false)
	var px := WORLD_X + ww + 28
	var pcell := TILE * maxi(2, int(round(SCALE * 0.6)))
	_draw_preview(state["queue"][0] if state["queue"].size() > 0 else null, px, 84, pcell)
	_draw_preview(state["hold"], px, wh + 48 - 134, pcell)


func _draw_preview(type, px: int, py: int, pcell: int) -> void:
	var prows := _preview_rows(type)
	for y in range(prows.size()):
		var row := String(prows[y])
		for x in range(row.length()):
			var t: ImageTexture = tex.get(row[x])
			if t != null:
				draw_texture_rect(t, Rect2(px + x * pcell, py + y * pcell, pcell, pcell), false)


# ---- input + clock -------------------------------------------------------

func _begin() -> void:
	started = true
	since_tick_ms = 0.0
	_render()


func _dispatch(action: String) -> void:
	var before := state
	state = Reducer.step(state, action)
	if action == "hardDrop" or action == "restart":
		since_tick_ms = 0.0
	if not is_same(state, before):
		_game_sfx(before, state, action)
		_render()


func _unhandled_input(event: InputEvent) -> void:
	if not (event is InputEventKey) or not event.pressed or event.echo:
		return
	var action := ""
	match event.keycode:
		KEY_LEFT: action = "left"
		KEY_RIGHT: action = "right"
		KEY_DOWN: action = "softDrop"
		KEY_UP, KEY_X: action = "cw"
		KEY_Z: action = "ccw"
		KEY_SPACE: action = "hardDrop"
		KEY_C, KEY_SHIFT: action = "hold"
		KEY_ENTER, KEY_KP_ENTER: action = "restart"
	if action == "":
		return
	get_viewport().set_input_as_handled()
	_start_music()
	if not started:
		_begin()  # first key lifts the start gate, doesn't act
		return
	_dispatch(action)


func _process(delta: float) -> void:
	if not started or bool(state["over"]):
		return
	since_tick_ms += delta * 1000.0
	if since_tick_ms >= Reducer.gravity_ms(state):
		since_tick_ms = 0.0
		state = Reducer.step(state, "tick")
		_render()


# ---- the headless replay probe -------------------------------------------

# --mojulo-replay=<json> replays the fixture and quits. --mojulo-shot=<png>
# additionally saves the viewport after the replay is drawn — only with a
# real window (headless has nothing to grab); it is the eyes gate's picture,
# taken by a machine so a human can look without launching the editor.
func _read_probe_args() -> void:
	var replay := ""
	var shot := ""
	for arg in OS.get_cmdline_user_args():
		var a := String(arg)
		if a.begins_with("--mojulo-replay="):
			replay = a.substr("--mojulo-replay=".length())
		elif a.begins_with("--mojulo-shot="):
			shot = a.substr("--mojulo-shot=".length())
	if replay != "":
		_run_replay(replay, shot)


func _run_replay(path: String, shot: String) -> void:
	var fixture := _read_json(path)
	var seed := int(fixture.get("seed", 1))
	var actions: Array = fixture.get("actions", [])
	var t0 := Time.get_ticks_usec()
	var st: Dictionary = Reducer.new_game(seed)
	for act in actions:
		st = Reducer.step(st, String(act))
	var replay_us := Time.get_ticks_usec() - t0
	started = true
	state = st
	_render()
	await get_tree().process_frame
	await get_tree().process_frame
	var d: Dictionary = Reducer.digest(st)
	print("[mojulo-replay] seed=%d steps=%d board=%s score=%d lines=%d hold=%s queue=%s active=%s over=%s" % [
		seed, actions.size(), d["board"], d["score"], d["lines"], d["hold"], d["queue"], d["active"], d["over"]])
	print(perf_line() + " replay_ms=%.3f" % (replay_us / 1000.0))
	if shot != "" and DisplayServer.get_name() != "headless":
		await RenderingServer.frame_post_draw
		var img := get_viewport().get_texture().get_image()
		var err := img.save_png(shot)
		print("[mojulo-shot] %s %s" % [shot, "saved" if err == OK else "error %d" % err])
	get_tree().quit()


# CPU-side numbers only: headless has no renderer, so no render time is
# claimed. process/physics are the last frame's step times; the replay adds
# its own wall time for the whole action script (the reducer port's cost).
static func perf_line() -> String:
	return "[mojulo-perf] process_ms=%.3f physics_ms=%.3f nodes=%d objects=%d static_kb=%d" % [
		Performance.get_monitor(Performance.TIME_PROCESS) * 1000.0,
		Performance.get_monitor(Performance.TIME_PHYSICS_PROCESS) * 1000.0,
		int(Performance.get_monitor(Performance.OBJECT_NODE_COUNT)),
		int(Performance.get_monitor(Performance.OBJECT_COUNT)),
		int(Performance.get_monitor(Performance.MEMORY_STATIC) / 1024.0)]
