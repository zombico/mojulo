extends RefCounted
# mojulo-godot kernel — JS VALUE SEMANTICS, said once. Every kernel module is a port of the web runtime (the truth), held
# equal to it by conformance corpora that compare canonical strings frame by frame (scripts/conformance.mjs --engine
# godot), so every place the JS reads a value its own way is here and nowhere else: JS undefined beside null (a key the
# reducer never wrote reads as UNDEF), numbers compared as numbers and printed as JSON.stringify prints them, strings
# ordered and hashed by UTF-16 code units (Godot's String compares code points), JS truthiness, ToNumber, ===, the
# relational operators, the `*` glob a regex makes, and the small arithmetic the web leans on (Math.imul, Math.hypot,
# a heading's forward vector, a segment against a box). Static functions only; no module holds state here but the
# glob's compiled patterns.
#
#   const Js := preload("res://kernel/js.gd")
#   Js.truthy(v), Js.strict_eq(a, b), Js.rel(a, b, "<"), Js.to_number(v), Js.finite(v), Js.is_num(v), Js.is_undef(v)
#   Js.js_string(v)   JS String(v);   Js.num_str(x)   a number as JS prints it;   Js.js_quote(s)   JSON.stringify(s)
#   Js.ss(v)          the deterministic stringify (keys in JS sort order): the bus's sort key and state hash
#   Js.lt(a, b)       JS a < b for two strings (UTF-16 code units);   Js.sorted_keys(d)   Object.keys(d).sort()
#   Js.fnv(s)         FNV-1a over UTF-16 code units, base 36;   Js.glob(value, pat)   the bus's glob
#   Js.s32 / u32 / imul, Js.hypot2 / hypot3, Js.fwd_xy / right_xy / fwd3, Js.seg_aabb_t, Js.sight_blocked

const JsonExact := preload("res://kernel/json_exact.gd")
const UNDEF := "undef"   # a private-use mark no score spells

# ── JS values ────────────────────────────────────────────────────────────────────────────────────────────────────
static func is_num(v) -> bool:
	return typeof(v) == TYPE_INT or typeof(v) == TYPE_FLOAT

static func is_undef(v) -> bool:
	return typeof(v) == TYPE_STRING and v == UNDEF

static func finite(v) -> bool:
	return is_num(v) and not is_nan(float(v)) and not is_inf(float(v))

# JS ToNumber: undefined → NaN, null → 0, booleans → 0 / 1, strings parsed (blank → 0, junk → NaN)
static func to_number(v) -> float:
	if is_num(v):
		return float(v)
	if v == null:
		return 0.0
	if typeof(v) == TYPE_BOOL:
		return 1.0 if v else 0.0
	if typeof(v) == TYPE_STRING:
		if is_undef(v):
			return NAN
		var s: String = v.strip_edges()
		if s == "":
			return 0.0
		if s.is_valid_float() or s.is_valid_int():
			return s.to_float()
		return NAN
	return NAN

static func truthy(v) -> bool:
	if v == null or is_undef(v):
		return false
	match typeof(v):
		TYPE_BOOL: return v
		TYPE_INT, TYPE_FLOAT: return float(v) != 0.0 and not is_nan(float(v))
		TYPE_STRING, TYPE_STRING_NAME: return String(v) != ""
	return true

# JS ===: numbers by value, strings / booleans / null by value, arrays and objects by identity
static func strict_eq(a, b) -> bool:
	if is_undef(a) or is_undef(b):
		return is_undef(a) and is_undef(b)
	if is_num(a) and is_num(b):
		return float(a) == float(b)
	if typeof(a) != typeof(b):
		return false
	if typeof(a) == TYPE_ARRAY or typeof(a) == TYPE_DICTIONARY:
		return is_same(a, b)
	return a == b

# JS relational (<, <=, >, >=): two strings compare by UTF-16 code units; anything else as numbers (NaN compares false)
static func rel(a, b, op: String) -> bool:
	if typeof(a) == TYPE_STRING and typeof(b) == TYPE_STRING and not is_undef(a) and not is_undef(b):
		match op:
			"<": return lt(a, b)
			"<=": return not lt(b, a)
			">": return lt(b, a)
			">=": return not lt(a, b)
	var x := to_number(a)
	var y := to_number(b)
	if is_nan(x) or is_nan(y):
		return false
	match op:
		"<": return x < y
		"<=": return x <= y
		">": return x > y
		">=": return x >= y
	return false

# ── strings ──────────────────────────────────────────────────────────────────────────────────────────────────────
# a string Godot's own code point order sorts as JS would: no character beyond U+FFFF (code point order and UTF-16
# order part only where a supplementary character, two surrogate units, meets one at U+E000..U+FFFF)
static func _bmp(s: String) -> bool:
	for i in s.length():
		if s.unicode_at(i) > 0xFFFF:
			return false
	return true

# JS a < b for strings: by UTF-16 code units (a supplementary character's surrogates sort below U+E000..U+FFFF)
static func lt(a: String, b: String) -> bool:
	if _bmp(a) and _bmp(b):
		return a < b
	var x := a.to_utf16_buffer()
	var y := b.to_utf16_buffer()
	var n := mini(x.size(), y.size())
	var i := 0
	while i < n:
		var ux: int = x[i] | (x[i + 1] << 8)
		var uy: int = y[i] | (y[i + 1] << 8)
		if ux != uy:
			return ux < uy
		i += 2
	return x.size() < y.size()

# Object.keys(d).sort(): every key as a string, in JS's default sort order
static func sorted_keys(d: Dictionary) -> Array:
	var ks: Array = []
	var plain := true
	for k in d.keys():
		var s := str(k)
		ks.append(s)
		if plain and not _bmp(s):
			plain = false
	if plain:
		ks.sort()
	else:
		ks.sort_custom(func(a, b): return lt(a, b))
	return ks

# JS String(v)
static func js_string(v) -> String:
	if is_undef(v):
		return "undefined"
	if v == null:
		return "null"
	if typeof(v) == TYPE_BOOL:
		return "true" if v else "false"
	if is_num(v):
		return num_str(float(v), "NaN")
	if typeof(v) == TYPE_ARRAY:
		var parts := []
		for x in v:
			parts.append("" if x == null or is_undef(x) else js_string(x))
		return ",".join(parts)
	if typeof(v) == TYPE_DICTIONARY:
		return "[object Object]"
	return str(v)

# a number the way JS prints it: integers whole, the rest as the shortest decimal that names the double
static func num_str(x: float, nan_as: String = "null") -> String:
	if is_nan(x) or is_inf(x):
		return nan_as
	if x == floor(x) and absf(x) < 9007199254740992.0:
		return str(int(x))
	return JsonExact.js_number(x)

static func js_quote(s: String) -> String:
	var out := "\""
	for i in s.length():
		var c := s.unicode_at(i)
		match c:
			34: out += "\\\""
			92: out += "\\\\"
			8: out += "\\b"
			12: out += "\\f"
			10: out += "\\n"
			13: out += "\\r"
			9: out += "\\t"
			_:
				if c < 0x20:
					out += "\\u%04x" % c
				else:
					out += String.chr(c)
	return out + "\""

# the deterministic stringify (keys in JS sort order): the bus's sort key and the state hash
static func ss(v) -> String:
	if v == null or is_undef(v):
		return "null"
	match typeof(v):
		TYPE_BOOL: return "true" if v else "false"
		TYPE_INT, TYPE_FLOAT: return num_str(float(v))
		TYPE_STRING, TYPE_STRING_NAME: return js_quote(String(v))
		TYPE_ARRAY:
			var parts := []
			for x in v:
				parts.append(ss(x))
			return "[" + ",".join(parts) + "]"
		TYPE_DICTIONARY:
			var by := {}
			for k in v.keys():
				by[str(k)] = k
			var parts := []
			for s in sorted_keys(v):
				parts.append(js_quote(s) + ":" + ss(v[by[s]]))
			return "{" + ",".join(parts) + "}"
	return js_quote(str(v))

# FNV-1a over UTF-16 code units, base 36 (the content-derived spawn id)
static func fnv(s: String) -> String:
	var h := 0x811c9dc5
	for i in s.length():
		var c := s.unicode_at(i)
		var units := [c]
		if c > 0xFFFF:
			var u := c - 0x10000
			units = [0xD800 + (u >> 10), 0xDC00 + (u & 0x3FF)]
		for unit in units:
			h = h ^ unit
			h = (h * 0x01000193) & 0xFFFFFFFF
	var digits := "0123456789abcdefghijklmnopqrstuvwxyz"
	if h == 0:
		return "0"
	var out := ""
	while h > 0:
		out = digits[h % 36] + out
		h = h / 36
	return out

# ── the bus's glob: '*' a run of anything but a line terminator (a JS regex's `.`), the whole string matched ─────────
static var _rx_cache := {}

static func _rx_escape(s: String) -> String:
	var out := ""
	for ch in s:
		if ".*+?^${}()|[]\\/-".find(ch) >= 0:
			out += "\\" + ch
		else:
			out += ch
	return out

static func glob(value, pat) -> bool:
	if is_undef(pat) or (typeof(pat) == TYPE_STRING and pat == "*"):
		return true
	var p := js_string(pat)
	var sv := js_string(value)
	if p.find("*") < 0:
		return sv == p
	if not _rx_cache.has(p):
		var parts := []
		for piece in p.split("*"):
			parts.append(_rx_escape(piece))
		var rx := RegEx.new()
		# JS: `.` never matches \n \r U+2028 U+2029, and `$` is the end of the string only (PCRE's also matches before a
		# final newline)
		rx.compile("^" + "[^\\n\\r\\x{2028}\\x{2029}]*".join(parts) + "\\z")
		_rx_cache[p] = rx
	return (_rx_cache[p] as RegEx).search(sv) != null

# ── arithmetic the web leans on ──────────────────────────────────────────────────────────────────────────────────
static func u32(x: int) -> int:
	return x & 0xFFFFFFFF

static func s32(x: int) -> int:
	x &= 0xFFFFFFFF
	return x - 0x100000000 if x >= 0x80000000 else x

# Math.imul: the low 32 bits of a product, signed
static func imul(a: int, b: int) -> int:
	var ah := (a >> 16) & 0xFFFF
	var al := a & 0xFFFF
	var bh := (b >> 16) & 0xFFFF
	var bl := b & 0xFFFF
	return s32(al * bl + (((ah * bl + al * bh) << 16) & 0xFFFFFFFF))

# Math.round: half rounds toward +Infinity (floor(x + 0.5) is not it: 0.49999999999999994 + 0.5 rounds up to 1)
static func js_round(x: float) -> float:
	var r := floorf(x)
	return r + 1.0 if x - r >= 0.5 else r

# Math.hypot: the root of the summed squares
static func hypot2(a: float, b: float) -> float:
	return sqrt(a * a + b * b)

static func hypot3(a: float, b: float, c: float) -> float:
	return sqrt(a * a + b * b + c * c)

# a heading's forward and right vectors in the recipe's z-up frame (core.js fwd / right), and with a pitch
static func fwd_xy(h: float) -> Array:
	return [cos(h), sin(h), 0.0]

static func right_xy(h: float) -> Array:
	return [sin(h), -cos(h), 0.0]

static func fwd3(h: float, p: float) -> Array:
	return [cos(p) * cos(h), cos(p) * sin(h), sin(p)]

# core.js segAabbT: where a segment a → b first enters a box (0..1), or null when it misses
static func seg_aabb_t(a: Array, b: Array, mn: Array, mx: Array):
	var t0 := 0.0
	var t1 := 1.0
	for k in 3:
		var d: float = float(b[k]) - float(a[k])
		if absf(d) < 1e-9:
			if float(a[k]) < float(mn[k]) or float(a[k]) > float(mx[k]):
				return null
		else:
			var tn: float = (float(mn[k]) - float(a[k])) / d
			var tf: float = (float(mx[k]) - float(a[k])) / d
			if tn > tf:
				var s := tn
				tn = tf
				tf = s
			if tn > t0:
				t0 = tn
			if tf < t1:
				t1 = tf
			if t0 > t1:
				return null
	return t0

# core.js sightBlocked: a box strictly between a and b
static func sight_blocked(a: Array, b: Array, colliders) -> bool:
	if not (colliders is Array):
		return false
	for c in colliders:
		var t = seg_aabb_t(a, b, c["min"], c["max"])
		if t != null and t > 1e-3 and t < 1.0 - 1e-3:
			return true
	return false
