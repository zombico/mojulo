extends RefCounted
# mojulo-godot kernel — THE SPRITE SFX (since 0.31.0): a world's game sfx (spriteSfx: a sparkle over a pickup, an aura on
# a power, a beacon on a goal) as the web draws them, one additive camera-facing card per emission BEAD moved along its
# verb's path. A port of the web's verb shelf (lib/graph/game/glyph-sfx-sprites.js SPRITE_VERBS), held equal to it by
# the sprites conformance corpus (lib/graph/scene/sprites-conformance.js); kernel/level.gd draws the cards. Static
# functions only, in the recipe's frame (z up, recipe units).
#
#   const Sfx := preload("res://kernel/sfx.gd")
#   Sfx.beads(verb, cc, ph, params)   → [{ p: [x, y, z], w }]   ph = the clock (s) × the layer's rate
#   Sfx.card(b, size)                 → { p, size, opacity } a drawn bead, or null when it is too faint to draw

const DEFAULTS := {
	"enchant": {"orbitR": 0.85, "cz": 0.62},
	"heal": {"cz": 0.12, "height": 1.5},
	"charge": {"cz": 0.65},
	"hit": {"cz": 0.75},
	"accumulate": {"reach": 2.1, "cz": 0.65},
	"ward": {"ringR": 0.95, "cz": 0.72},
	"sparkle": {"spread": [1.7, 1.1, 1.3], "cz": 0.75},
	"drain": {"cz": 1.5},
	"aura": {"base": 0.55, "pulse": 0.35, "cz": 0.65},
	"beacon": {"height": 4.2, "cz": 0.05, "count": 9},
}


static func _frac(x: float) -> float:
	return x - floor(x)


# the shelf's scatter hash (its own, not a GLSL one)
static func _hsh(a: float, b: float) -> float:
	return _frac(sin(a * 12.9898 + b * 78.233) * 43758.5453)


static func _bead(x: float, y: float, z: float, w: float) -> Dictionary:
	return {"p": [x, y, z], "w": w}


static func beads(verb: String, cc: Array, ph: float, params: Dictionary) -> Array:
	if not DEFAULTS.has(verb) or cc.size() != 3:
		return []
	var p: Dictionary = (DEFAULTS[verb] as Dictionary).duplicate()
	p.merge(params, true)
	var x := float(cc[0])
	var y := float(cc[1])
	var z := float(cc[2])
	var cz := float(p["cz"])
	var o: Array = []
	match verb:
		"enchant":
			var orbit := float(p["orbitR"])
			for w in 2:
				for k in 8:
					var a := ph + float(w) * PI - float(k) * 0.35
					o.append(_bead(x + orbit * cos(a), y + orbit * sin(a), z + cz + 0.22 * sin(2.0 * a + float(w) * 1.57), exp(-0.5 * float(k))))
		"heal":
			for w in 2:
				for k in 8:
					var s := _frac(ph / TAU + float(w) * 0.5 - float(k) * 0.045)
					var a := s * 12.566 + float(w) * PI
					var r := 0.5 * (1.0 - 0.3 * s)
					o.append(_bead(x + r * cos(a), y + r * sin(a), z + cz + float(p["height"]) * s, sin(PI * s) * exp(-0.3 * float(k))))
		"charge":
			for w in 2:
				for k in 8:
					var s := 1.0 - _frac(ph / TAU + float(w) * 0.5 - float(k) * 0.05)
					var a := s * 9.42478 + float(w) * PI
					var r := 0.15 + 1.3 * s
					o.append(_bead(x + r * cos(a), y + r * sin(a), z + cz + 0.55 * s, (0.15 + 0.85 * (1.0 - s) * (1.0 - s)) * sin(PI * s)))
		"hit":
			var s0 := _frac(ph / TAU)
			for j in 6:
				for k in 4:
					var s := maxf(s0 - float(k) * 0.05, 0.0)
					var a := float(j) * 1.0472 + 0.35
					var e := 1.0 - (1.0 - s) * (1.0 - s)
					var r := 0.25 + 1.35 * e
					o.append(_bead(x + r * cos(a), y + r * sin(a), z + cz + 0.8 * s - 0.85 * s * s, (1.0 - s) * (1.0 - s) * exp(-0.6 * float(k))))
		"accumulate":
			for w in 3:
				for k in 10:
					var s := _frac(ph / TAU + float(w) * 0.3333 - float(k) * 0.03)
					var a := s * 18.85 + float(w) * 2.094
					var r := 0.18 + float(p["reach"]) * s
					o.append(_bead(x + r * cos(a), y + r * sin(a), z + cz + 1.1 * s * s, minf(pow(1.0 - s, 1.6), 0.55) * exp(-0.25 * float(k)) + 0.02))
		"ward":
			var ring := float(p["ringR"])
			for w in 3:
				for k in 6:
					var a := ph + float(w) * 2.094 - float(k) * 0.22
					o.append(_bead(x + ring * cos(a), y + 0.22 * sin(a * 3.0), z + cz + 0.85 * sin(a), exp(-0.45 * float(k))))
		"sparkle":
			var sp: Array = p["spread"]
			for k in 12:
				var tw := _frac(ph / TAU + _hsh(float(k), 1.0))
				o.append(_bead(x + (_hsh(float(k), 3.1) - 0.5) * float(sp[0]), y + (_hsh(float(k), 11.3) - 0.5) * float(sp[1]), z + cz + (_hsh(float(k), 5.7) - 0.5) * float(sp[2]), pow(maxf(sin(PI * tw), 0.0), 8.0)))
		"drain":
			for w in 2:
				for k in 8:
					var s := _frac(ph / TAU + float(w) * 0.5 - float(k) * 0.04)
					var a := -s * 9.42478 + float(w) * PI
					var r := 0.25 + 1.1 * s
					o.append(_bead(x + r * cos(a), y + r * sin(a), z + cz - 1.45 * s, pow(1.0 - s, 1.5) * sin(PI * s) * exp(-0.3 * float(k))))
		"aura":
			o.append(_bead(x, y, z + cz, float(p["base"]) + float(p["pulse"]) * (0.5 + 0.5 * sin(ph))))
		"beacon":
			o.append(_bead(x, y, z + cz, 0.9))
			var n := int(p["count"])
			for k in n:
				var u := float(k) / float(n - 1)
				o.append(_bead(x, y, z + 0.3 + float(p["height"]) * u, (0.55 + 0.35 * sin(ph * 1.5 - u * 3.0)) * (1.0 - 0.4 * u)))
	return o


# the page's card for a bead (channels/sprite-sfx.js): hidden under 0.05, else sized and lit by its brightness
static func card(b, size: float):
	if not (b is Dictionary) or float(b["w"]) < 0.05:
		return null
	var w := float(b["w"])
	return {"p": b["p"], "size": size * (0.35 + 0.65 * minf(1.0, w)), "opacity": minf(1.0, 0.35 + 0.65 * w)}
