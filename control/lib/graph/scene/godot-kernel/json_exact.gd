extends RefCounted
# mojulo-godot kernel — a JSON reader whose numbers are EXACT. Godot's own parser rounds some decimals to a
# neighbouring double (0.016666666666666666, a 60 Hz step, arrives one unit off; 5e-324 arrives as 0), so a score's
# timers and thresholds could land on the other side of a comparison than they do on the web. mojulo writes JSON
# with JSON.stringify, which prints every number as the SHORTEST decimal that names its double; Godot's
# String.num_scientific prints the same shortest form. So a number token is read approximately, then the doubles
# around it are tried until one prints back as the token: that double is the one the web held. A token that is not
# a shortest form (hand-written "0.10") keeps the approximate read.
#
#   var data = preload("res://kernel/json_exact.gd").parse(text)   → the value, or null on a syntax error

static func parse(text: String):
	var r := _Reader.new(text)
	r.ws()
	var v = r.value()
	r.ws()
	if r.failed or r.i != text.length():
		push_error("json_exact: bad JSON near character %d" % r.i)
		return null
	return v

# the double the token names: Godot's read, corrected to the neighbour that prints back as the token
static func exact_float(tok: String) -> float:
	return _Reader.exact_float(tok)


class _Reader:
	var s: String
	var i := 0
	var failed := false

	func _init(text: String) -> void:
		s = text

	# the double the token names: Godot's read, corrected to the neighbour that prints back as the token
	static func exact_float(tok: String) -> float:
		var x := tok.to_float()
		if is_nan(x) or is_inf(x):
			return x
		var want := _canonical(tok)
		if String.num_scientific(x) == want:
			return x
		var b := PackedByteArray()
		b.resize(8)
		b.encode_double(0, x)
		var bits := b.decode_s64(0)
		for k in [1, -1, 2, -2, 3, -3, 4, -4]:
			var c := PackedByteArray()
			c.resize(8)
			c.encode_s64(0, bits + k)
			var y := c.decode_double(0)
			if String.num_scientific(y) == want:
				return y
		return x

	# the token in num_scientific's spelling: a JS exponent (1e+21, 5e-324) carries two exponent digits there
	static func _canonical(tok: String) -> String:
		var e := tok.findn("e")
		if e < 0:
			return tok
		var mant := tok.substr(0, e)
		var ex := tok.substr(e + 1)
		var sign := "+"
		if ex.begins_with("-") or ex.begins_with("+"):
			sign = ex[0]
			ex = ex.substr(1)
		while ex.length() < 2:
			ex = "0" + ex
		return mant + "e" + sign + ex

	func ws() -> void:
		while i < s.length() and " \t\n\r".find(s[i]) >= 0:
			i += 1

	func value():
		if i >= s.length():
			failed = true
			return null
		var c := s[i]
		if c == "{":
			return obj()
		if c == "[":
			return arr()
		if c == "\"":
			return string()
		if s.substr(i, 4) == "true":
			i += 4
			return true
		if s.substr(i, 5) == "false":
			i += 5
			return false
		if s.substr(i, 4) == "null":
			i += 4
			return null
		return number()

	func obj() -> Dictionary:
		var out := {}
		i += 1
		ws()
		if i < s.length() and s[i] == "}":
			i += 1
			return out
		while not failed:
			ws()
			if i >= s.length() or s[i] != "\"":
				failed = true
				break
			var k := string()
			ws()
			if i >= s.length() or s[i] != ":":
				failed = true
				break
			i += 1
			ws()
			out[k] = value()
			ws()
			if i < s.length() and s[i] == ",":
				i += 1
				continue
			if i < s.length() and s[i] == "}":
				i += 1
				break
			failed = true
		return out

	func arr() -> Array:
		var out := []
		i += 1
		ws()
		if i < s.length() and s[i] == "]":
			i += 1
			return out
		while not failed:
			ws()
			out.append(value())
			ws()
			if i < s.length() and s[i] == ",":
				i += 1
				continue
			if i < s.length() and s[i] == "]":
				i += 1
				break
			failed = true
		return out

	func string() -> String:
		i += 1
		var out := ""
		while i < s.length():
			var c := s[i]
			if c == "\"":
				i += 1
				return out
			if c == "\\":
				i += 1
				var e := s[i]
				match e:
					"n": out += "\n"
					"t": out += "\t"
					"r": out += "\r"
					"b": out += "\b"
					"f": out += "\f"
					"u":
						var cp := s.substr(i + 1, 4).hex_to_int()
						i += 4
						# a surrogate pair joins into one code point
						if cp >= 0xD800 and cp < 0xDC00 and s.substr(i + 1, 2) == "\\u":
							var lo := s.substr(i + 3, 4).hex_to_int()
							if lo >= 0xDC00 and lo < 0xE000:
								cp = 0x10000 + ((cp - 0xD800) << 10) + (lo - 0xDC00)
								i += 6
						out += String.chr(cp)
					_: out += e
				i += 1
				continue
			out += c
			i += 1
		failed = true
		return out

	func number():
		var start := i
		while i < s.length() and "+-0123456789.eE".find(s[i]) >= 0:
			i += 1
		var tok := s.substr(start, i - start)
		if tok == "" or not (tok.is_valid_float() or tok.is_valid_int()):
			failed = true
			return null
		return exact_float(tok)
