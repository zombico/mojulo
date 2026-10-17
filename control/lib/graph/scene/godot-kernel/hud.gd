extends RefCounted
# mojulo-godot kernel — THE HUD: the web page's widget layer (scene/channels/events.js hudScript over game/hud-widgets.js)
# drawn in Godot controls. A column per slot (the corners, the top and bottom edges, the centre), a widget per score.json
# `hud` row: a readout as text, a counter, a bar against its max or a clock; a banner (replaces) and a toast (stacks,
# rises, fades) on a bus event or a var's change; a legend that may fade after its ttl. Skinned by score.json
# `hudStyle` (the guide's tokens, its font and the register's frame and plate dials). A row with a part's `id` stands
# while the bus has not hidden it (ui-<id> = 0, or ui-<id>-state = 0) and is drawn in its state (disabled, alert,
# focus, active); a row with `when` stands in those phases only (the bus var `phase`). A hidden banner or toast does
# not fire, as on the web. What stays the web's: the register's motion, sound, cursor and light dials, and a
# stylized border's art.
#
#   var H = preload("res://kernel/hud.gd").new()
#   H.build(layer, rows, hud_style, bus)     rows: score.json hud; hud_style: score.json hudStyle (or {}); bus: the level's
#   H.sync(vars, log, from, incoming, t)     each frame: the bus's vars, its log and the index it was read to, the
#                                            frame's incoming events (an event toast reads its fields), the clock
#   H.banner_text() · H.dump()               the newest standing banner; the drawn widgets, for the probes

const Bus := preload("res://kernel/bus.gd")
const Js := preload("res://kernel/js.gd")
const SLOTS := ["top-left", "top", "top-right", "center", "bottom-left", "bottom", "bottom-right"]
const UI_STATES := ["hidden", "shown", "focus", "active", "disabled", "alert"]
const SEMANTIC := {"harm": "#ff5a4d", "value": "#ffd700", "goal": "#3ff56f"}
const DEFAULTS := {"accent": "#5fb0ff", "accent2": "#e8b96a", "ink": "#ffffff", "bg": "#0b1220", "panel": "#0c101a", "line": "#2a3b58"}
const FONT_NAMES := {
	"system": ["Helvetica Neue", "Segoe UI", "Roboto", "sans-serif"],
	"mono": ["SF Mono", "Menlo", "Consolas", "monospace"],
	"serif": ["Georgia", "Times New Roman", "serif"],
	"display": ["Impact", "Arial Black", "Helvetica Neue", "sans-serif"],
}
# the register's frame and plate (playscape/ui/register.js FRAME_CSS, PLATE_LAYER): border width, corner radius;
# the plate's alpha over the panel colour
const FRAME := {"none": [0, 8], "hairline": [1, 6], "rule": [2, 3], "bevel": [2, 0], "material": [4, 0]}
const PLATE := {"clear": 0.0, "flat": 0.72, "solid": 1.0, "textured": 1.0}
const TOAST_CAP := 8
const TOAST_RISE := 28.0

var root: Control
var cols := {}
var tok := {}
var font_id := "system"
var frame: Array = FRAME["hairline"]
var plate := 0.72
var items: Array = []        # { w, el, val?, fill?, until?, timed? }
var toasts: Array = []       # { w, prev, n }
var live: Array = []         # { tw, el, born, until }
var t0 := -1.0
var last_banner = null
var bus = null               # the level's bus (its glob, the game.on rule)


static func _hex(s, fallback: String) -> Color:
	var h := String(s) if s is String else ""
	return Color.html(h) if h.begins_with("#") and Color.html_is_valid(h) else Color.html(fallback)


# a widget's colour: a hex passes, a semantic or token name reads its token; else the fallback
func color_of(v, fallback: Color) -> Color:
	if v is String and v.begins_with("#") and Color.html_is_valid(v):
		return Color.html(v)
	if v is String and SEMANTIC.has(v):
		return Color.html(SEMANTIC[v])
	if v == "accent" or v == "accent2":
		return tok[v]
	return fallback


func font(weight: int) -> Font:
	var f := SystemFont.new()
	f.font_names = PackedStringArray(FONT_NAMES.get(font_id, FONT_NAMES["system"]))
	f.font_weight = weight
	return f


# the plate a widget, a menu or a prompt sits on: the panel colour at the plate's alpha, framed in the line colour
func plate_style(border: Color = Color(0, 0, 0, 0)) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	var p: Color = tok["panel"]
	sb.bg_color = Color(p.r, p.g, p.b, plate)
	sb.border_color = border if border.a > 0 else tok["line"]
	sb.set_border_width_all(int(frame[0]))
	sb.set_corner_radius_all(int(frame[1]))
	sb.content_margin_left = 12
	sb.content_margin_right = 12
	sb.content_margin_top = 6
	sb.content_margin_bottom = 6
	return sb


func _label(text: String, size: int, weight: int, color: Color) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_override("font", font(weight))
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l


func _col(slot: String) -> VBoxContainer:
	if not cols.has(slot):
		var c := VBoxContainer.new()
		c.add_theme_constant_override("separation", 8)
		c.mouse_filter = Control.MOUSE_FILTER_IGNORE
		root.add_child(c)
		cols[slot] = c
	return cols[slot]


static func _align(slot: String) -> int:
	if slot.ends_with("right"):
		return Control.SIZE_SHRINK_END
	if slot.ends_with("left"):
		return Control.SIZE_SHRINK_BEGIN
	return Control.SIZE_SHRINK_CENTER


func build(layer: CanvasLayer, rows: Array, style: Dictionary, the_bus) -> void:
	bus = the_bus
	for k in DEFAULTS:
		tok[k] = _hex(style.get(k), DEFAULTS[k])
	font_id = String(style.get("font")) if FONT_NAMES.has(style.get("font")) else "system"
	var reg: Dictionary = style.get("register", {}) if style.get("register") is Dictionary else {}
	frame = FRAME.get(reg.get("frame"), FRAME["hairline"])
	plate = PLATE.get(reg.get("plate"), 0.72)
	root = Control.new()
	root.name = "MojuloHud"
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(root)
	var ink: Color = tok["ink"]
	for w in rows:
		if not (w is Dictionary):
			continue
		var slot := String(w.get("slot")) if SLOTS.has(w.get("slot")) else "top-left"
		var kind := String(w.get("kind", ""))
		if kind == "toast":
			_col(slot)
			toasts.append({"w": w, "prev": null, "n": 0})
			continue
		var accent: bool = kind == "banner" or (kind == "readout" and w.get("as") == "bar")
		var c: Color = color_of(w.get("color"), tok["accent"] if accent else ink)
		var el := PanelContainer.new()
		el.mouse_filter = Control.MOUSE_FILTER_IGNORE
		el.size_flags_horizontal = _align(slot)
		el.add_theme_stylebox_override("panel", plate_style())
		var it := {"w": w, "el": el, "color": c}
		if kind == "readout":
			var as_ := String(w.get("as", "text"))
			var lbl := String(w.get("label", w.get("var", "")))
			if as_ == "counter":
				var box := VBoxContainer.new()
				box.alignment = BoxContainer.ALIGNMENT_CENTER
				box.add_theme_constant_override("separation", 0)
				it["val"] = _label("0", 30, 700, c)
				it["val"].horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
				box.add_child(it["val"])
				var l := _label(lbl.to_upper(), 10, 500, Color(c, 0.7))
				l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
				box.add_child(l)
				el.add_child(box)
			elif as_ == "bar":
				var row := HBoxContainer.new()
				row.add_theme_constant_override("separation", 8)
				row.add_child(_label(lbl.to_upper(), 12, 600, ink))
				var bar := ProgressBar.new()
				bar.show_percentage = false
				bar.custom_minimum_size = Vector2(120, 8)
				bar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
				bar.min_value = 0.0
				bar.max_value = 1.0
				var track := StyleBoxFlat.new()
				track.bg_color = Color(1, 1, 1, 0.15)
				track.set_corner_radius_all(4)
				var fill := StyleBoxFlat.new()
				fill.bg_color = c
				fill.set_corner_radius_all(4)
				bar.add_theme_stylebox_override("background", track)
				bar.add_theme_stylebox_override("fill", fill)
				row.add_child(bar)
				it["fill"] = bar
				it["val"] = _label("0/0", 12, 600, Color(ink, 0.8))
				row.add_child(it["val"])
				el.add_child(row)
			else:
				var row := HBoxContainer.new()
				row.add_theme_constant_override("separation", 8)
				if lbl != "":
					row.add_child(_label(lbl, 16, 600, Color(c, 0.75)))
				it["val"] = _label("0", 16, 600, c)
				row.add_child(it["val"])
				el.add_child(row)
		elif kind == "banner":
			var b := _label(String(w.get("text", "")), 34, 800, c)
			b.uppercase = true
			el.add_child(b)
			el.visible = false
			it["text"] = b
			it["until"] = 0.0
		else:
			el.add_child(_label(String(w.get("text", "")), 12, 500, Color(c, 0.85)))
			if Js.finite(w.get("ttl")):
				it["timed"] = float(w["ttl"])
		_col(slot).add_child(el)
		items.append(it)


# the gate: a part the bus hid, or a row out of its phase
func on(w: Dictionary, vars: Dictionary) -> bool:
	if w.get("id") is String:
		var id: String = w["id"]
		if Js.strict_eq(vars.get("ui-" + id), 0) or Js.strict_eq(vars.get("ui-" + id + "-state"), 0):
			return false
	if w.get("when") is Array:
		var p = vars.get("phase")
		var ph := int(p) if Js.is_num(p) else 0
		var hit := false
		for k in w["when"]:
			if int(k) == ph:
				hit = true
		if not hit:
			return false
	return true


static func _clock(n: float) -> String:
	var s := int(maxf(0.0, ceil(n)))
	return "%d:%02d" % [s / 60, s % 60]


static func _fmt_delta(n: float) -> String:
	var r := roundf(n * 100.0) / 100.0
	return ("+" if r > 0 else "") + Js.num_str(r)


# hud-widgets.js hudSubst: {name} reads a var (unknown: the braces stay), {event.<field>} the firing event,
# {delta} / {value} a var toast's change ('' when absent)
static func subst(text: String, vars: Dictionary, ctx: Dictionary = {}) -> String:
	var out := ""
	var i := 0
	while i < text.length():
		var a := text.find("{", i)
		if a < 0:
			out += text.substr(i)
			break
		var b := text.find("}", a)
		if b < 0:
			out += text.substr(i)
			break
		var key := text.substr(a + 1, b - a - 1)
		var v = null
		if key.begins_with("event."):
			v = (ctx.get("event", {}) as Dictionary).get(key.substr(6))
			out += text.substr(i, a - i) + (Js.js_string(v) if v != null else "")
		elif key == "delta" or key == "value":
			v = ctx.get(key)
			out += text.substr(i, a - i) + (Js.js_string(v) if v != null else "")
		else:
			v = vars.get(key)
			out += text.substr(i, a - i) + (Js.js_string(v) if v != null and not Js.strict_eq(v, Js.UNDEF) else text.substr(a, b - a + 1))
		i = b + 1
	return out


func _toast(tw: Dictionary, text: String, t: float, sign: int) -> void:
	var w: Dictionary = tw["w"]
	var c: Color = color_of(w.get("color"), Color.html(SEMANTIC["harm"]) if sign < 0 else Color.html(SEMANTIC["goal"]) if sign > 0 else tok["accent"])
	# a holder the column lays out, the words inside it free to rise
	var label := _label(text, 22, 800, c)
	var el := Control.new()
	el.mouse_filter = Control.MOUSE_FILTER_IGNORE
	el.custom_minimum_size = label.get_combined_minimum_size()
	el.size_flags_horizontal = _align(String(w.get("slot", "center")))
	el.add_child(label)
	cols[String(w.get("slot", "center"))].add_child(el)
	tw["n"] += 1
	if tw["n"] > TOAST_CAP:
		for k in live.size():
			if is_same(live[k]["tw"], tw):
				live[k]["el"].queue_free()
				live.remove_at(k)
				tw["n"] -= 1
				break
	live.append({"tw": tw, "el": el, "born": t, "until": t + float(w.get("ttl", 0.8))})


func sync(vars: Dictionary, log: Array, from: int, incoming: Array, t: float) -> void:
	if root == null:
		return
	if t0 < 0.0:
		t0 = t
	var ink: Color = tok["ink"]
	for it in items:
		var w: Dictionary = it["w"]
		var el: PanelContainer = it["el"]
		var stands := on(w, vars)
		# a legend past its ttl, and a banner between firings, stay down whatever the gate says
		if it.has("timed") and t - t0 >= it["timed"]:
			stands = false
		if it.has("until") and it["until"] <= t:
			stands = false
		el.visible = stands
		var st = UI_STATES[int(vars.get("ui-%s-state" % w["id"]))] if w.get("id") is String and Js.is_num(vars.get("ui-%s-state" % w["id"])) and int(vars.get("ui-%s-state" % w["id"])) < UI_STATES.size() else null
		el.modulate = Color(1, 1, 1, 0.4) if st == "disabled" else Color(1, 1, 1, 1)
		var border: Color = Color.html(SEMANTIC["harm"]) if st == "alert" else tok["accent"] if st == "focus" or st == "active" else Color(0, 0, 0, 0)
		if it.get("st") != st:
			it["st"] = st
			el.add_theme_stylebox_override("panel", plate_style(border))
		if it.has("val"):
			var raw = vars.get(w.get("var"))
			var n = raw if raw != null and not Js.strict_eq(raw, Js.UNDEF) else 0
			var text := ""
			if it.has("fill"):
				var mx = vars.get(w["max"], 0) if w.get("max") is String else w.get("max", 0)
				var mxf := float(mx) if Js.is_num(mx) else 0.0
				var nf := float(n) if Js.is_num(n) else 0.0
				(it["fill"] as ProgressBar).value = clampf(nf / mxf, 0.0, 1.0) if mxf > 0 else 0.0
				text = "%d/%d" % [int(ceil(nf)), int(ceil(mxf))]
			elif w.get("as") == "clock":
				text = _clock(float(n) if Js.is_num(n) else 0.0)
			else:
				text = Js.js_string(n)
			if it["val"].text != text:
				it["val"].text = text
	# the log since the last frame: banners fire (replace), event toasts spawn
	for i in range(from, log.size()):
		var ev = log[i]
		if not (ev is Dictionary) or not ev.has("type"):
			continue
		for it in items:
			var w: Dictionary = it["w"]
			if w.get("kind") == "banner" and Js.glob(ev["type"], w.get("on")) and on(w, vars):
				it["text"].text = subst(String(w.get("text", "")), vars)
				it["until"] = t + float(w.get("ttl", 2.0))
				it["el"].visible = true
				last_banner = it
		for tw in toasts:
			var w: Dictionary = tw["w"]
			if w.get("on") is String and Js.glob(ev["type"], w["on"]) and on(w, vars):
				var src := {}
				for k in range(incoming.size() - 1, -1, -1):
					if incoming[k] is Dictionary and incoming[k].get("type") == ev["type"]:
						src = incoming[k]
						break
				_toast(tw, subst(String(w.get("text", "")), vars, {"event": src}), t, 0)
	# var toasts: fire on a change, the first frame seeds silently
	for tw in toasts:
		var w: Dictionary = tw["w"]
		if not (w.get("var") is String):
			continue
		var raw = vars.get(w["var"])
		var v := float(raw) if Js.is_num(raw) else 0.0
		if tw["prev"] == null:
			tw["prev"] = v
		elif v != tw["prev"]:
			var d: float = v - tw["prev"]
			tw["prev"] = v
			if on(w, vars):
				_toast(tw, subst(String(w.get("text", "{delta}")), vars, {"delta": _fmt_delta(d), "value": v}), t, -1 if d < 0 else 1)
	for k in range(live.size() - 1, -1, -1):
		var l: Dictionary = live[k]
		var p := minf(1.0, (t - l["born"]) / maxf(0.0001, l["until"] - l["born"]))
		if p >= 1.0:
			l["el"].queue_free()
			l["tw"]["n"] -= 1
			live.remove_at(k)
			continue
		var words := l["el"].get_child(0) as Label
		l["el"].custom_minimum_size = words.get_combined_minimum_size()   # measured once it is in the tree
		l["el"].modulate.a = 1.0 - p * p
		words.position = Vector2(0, -TOAST_RISE * p)
	_layout()


# each column at its slot, from its children's sizes (the CSS columns' anchors, 12 px in from the edges)
func _layout() -> void:
	var vp := root.get_viewport_rect().size if root.is_inside_tree() else Vector2(1152, 648)
	for slot in cols:
		var c: VBoxContainer = cols[slot]
		var sz := c.get_combined_minimum_size()
		var x := 12.0 if slot.ends_with("left") else vp.x - sz.x - 12.0 if slot.ends_with("right") else (vp.x - sz.x) / 2.0
		var y := 12.0 if slot.begins_with("top") else vp.y - sz.y - 12.0 if slot.begins_with("bottom") else (vp.y - sz.y) / 2.0
		c.position = Vector2(x, y)
		c.size = sz


func banner_text() -> String:
	if last_banner != null and last_banner["el"].visible:
		return String(last_banner["text"].text)
	return ""


# what stands on screen, slot by slot, for the probes: kind[#id]:text (a readout: label=value; a part's state after @)
func dump() -> String:
	var rows := []
	for it in items:
		if not it["el"].visible:
			continue
		var w: Dictionary = it["w"]
		var tag: String = String(w.get("kind")) + ("#" + w["id"] if w.get("id") is String else "")
		var text := ""
		if it.has("val"):
			text = "%s=%s" % [String(w.get("label", w.get("var"))), it["val"].text]
		elif it.has("text"):
			text = it["text"].text
		else:
			text = String(w.get("text", ""))
		rows.append("%s:%s:%s%s" % [w.get("slot", "top-left"), tag, text, ("@" + it["st"]) if it.get("st") != null and it["st"] != "shown" else ""])
	for l in live:
		rows.append("%s:toast:%s" % [l["tw"]["w"].get("slot", "center"), (l["el"].get_child(0) as Label).text])
	return " | ".join(rows)
