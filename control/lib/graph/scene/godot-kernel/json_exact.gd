extends RefCounted
# mojulo-godot kernel — a JSON reader whose numbers are EXACT. Godot's own parser rounds some decimals to a
# neighbouring double (0.016666666666666666, a 60 Hz step, arrives one unit off; 5e-324 arrives as 0), so a score's
# timers and thresholds could land on the other side of a comparison than they do on the web. mojulo writes JSON
# with JSON.stringify, which prints every number as the SHORTEST decimal that names its double. So a number token is
# read approximately, then the doubles around it are tried until one prints back as the token: that double is the one
# the web held. A token that is not a shortest form (hand-written "0.10") keeps the approximate read.
#
# js_number(x) prints a double as JS does (Number.prototype.toString): the fewest digits that name it, the nearest of
# them on a tie, in decimal from 1e-6 to 1e21 and in exponent form outside. Godot's String.num_scientific is not that:
# for some doubles it prints more digits than name it, or the farther of two on a tie, so it is only a first guess: one
# of 15 digits or fewer that reads back exactly stands, and any other is decided exactly (the double's decimal
# expansion against the bounds of its rounding interval, in small integer arithmetic). String.to_float drops a small
# number's late digits, so a token is first read from its own digits.
#
#   var data = preload("res://kernel/json_exact.gd").parse(text)   → the value, or null on a syntax error
#   preload("res://kernel/json_exact.gd").js_number(x)            → the JS spelling of x

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


# the JS spelling of a double (the printer lives in _Reader, which reads with it)
static func js_number(x: float) -> String:
	return _Reader.js_number(x)


class _Reader:
	var s: String
	var i := 0
	var failed := false

	func _init(text: String) -> void:
		s = text

	# ── the JS spelling of a double ──────────────────────────────────────────────────────────────────────────────────
	const _BASE := 10000000   # big integers: little-endian limbs of seven decimal digits

	static func js_number(x: float) -> String:
		if is_nan(x):
			return "NaN"
		if is_inf(x):
			return "Infinity" if x > 0 else "-Infinity"
		if x == 0.0:
			return "0"
		if x < 0.0:
			return "-" + js_number(-x)
		var dn := _shortest(x)
		return _js_format(dn[0], dn[1])


	# [digits, n]: x = 0.digits × 10^n, digits the fewest that name x (no trailing zero)
	static func _shortest(x: float) -> Array:
		var guess := _sci_digits(String.num_scientific(x))
		# a guess of 15 digits or fewer that reads back exactly is the shortest: no other decimal that short lies
		# within the double's rounding interval
		if (guess[0] as String).length() <= 15 and _fast_read(guess[0], guess[1]) == x:
			return guess
		var b := PackedByteArray()
		b.resize(8)
		b.encode_double(0, x)
		var bits := b.decode_s64(0)
		var be := (bits >> 52) & 0x7FF
		var m := bits & 0xFFFFFFFFFFFFF
		var e2 := -1074
		if be != 0:
			m += 1 << 52
			e2 = be - 1075
		# the exact decimal expansion of x = m × 2^e2: S × 10^q
		var S: Array = _big(m)
		var q := 0
		if e2 >= 0:
			S = _mul_pow(S, 2, e2)
		else:
			S = _mul_pow(S, 5, -e2)
			q = e2
		var sd := _big_str(S)
		# the rounding interval's bounds: (2m ∓ 1) × 2^(e2-1), the lower one closer at a power of two
		var lo_n: int = 2 * m - 1
		var lo_g := e2 - 1
		if m == (1 << 52) and be > 1:
			lo_n = 4 * m - 1
			lo_g = e2 - 2
		var hi_n: int = 2 * m + 1
		var hi_g := e2 - 1
		var closed := m % 2 == 0
		# a shorter decimal that names x is its 15-digit rounding with trailing zeros, so 15 digits is the first to try
		# (a subnormal holds fewer digits than that: from one)
		for p in range(15 if be != 0 else 1, 18):
			if sd.length() <= p:
				return _trim(sd, q + sd.length())
			var k := q + sd.length() - p
			var fl := sd.substr(0, p)
			var ce := _inc_str(fl)
			var in_f := _inside(fl, k, lo_n, lo_g, hi_n, hi_g, closed)
			var in_c := _inside(ce, k, lo_n, lo_g, hi_n, hi_g, closed)
			if not in_f and not in_c:
				continue
			var pick := fl if in_f else ce
			if in_f and in_c:
				# the nearer of the two: 2x against floor + ceil = (2·floor + 1) × 10^k, both over 10^q
				var two_x := _mul_small(S, 2)
				var mid := _mul_pow(_add_small(_mul_small(_big_parse(fl), 2), 1), 10, k - q)
				var c := _cmp(two_x, mid)
				pick = ce if c > 0 or (c == 0 and int(ce.right(1)) % 2 == 0) else fl
			return _trim(pick, k + pick.length())
		return guess


	# digits × 10^(n - len) read with one rounding (a whole number under 2^53 by an exact power of ten), or NaN
	static func _fast_read(digits: String, n: int) -> float:
		var k := n - digits.length()
		if absi(k) > 22:
			return NAN
		var d := float(int(digits))
		return d * pow(10.0, k) if k >= 0 else d / pow(10.0, -k)

	static func _inside(digits: String, k: int, lo_n: int, lo_g: int, hi_n: int, hi_g: int, closed: bool) -> bool:
		var a := _vs(digits, k, lo_n, lo_g)
		var z := _vs(digits, k, hi_n, hi_g)
		return (a > 0 or (closed and a == 0)) and (z < 0 or (closed and z == 0))


	# compare digits × 10^k with n × 2^g, both brought to whole numbers
	static func _vs(digits: String, k: int, n: int, g: int) -> int:
		var lhs := _mul_pow(_mul_pow(_big_parse(digits), 10, maxi(k, 0)), 2, maxi(-g, 0))
		var rhs := _mul_pow(_mul_pow(_big(n), 2, maxi(g, 0)), 10, maxi(-k, 0))
		return _cmp(lhs, rhs)


	static func _trim(digits: String, n: int) -> Array:
		var d := digits
		while d.length() > 1 and d.ends_with("0"):
			d = d.substr(0, d.length() - 1)
		return [d, n]


	# num_scientific's spelling read back as [digits, n]
	static func _sci_digits(t: String) -> Array:
		var e := t.findn("e")
		var mant := t if e < 0 else t.substr(0, e)
		var ex := 0 if e < 0 else int(t.substr(e + 1))
		var dot := mant.find(".")
		var int_part := mant if dot < 0 else mant.substr(0, dot)
		var frac := "" if dot < 0 else mant.substr(dot + 1)
		var all := int_part + frac
		var n := int_part.length() + ex
		var i := 0
		while i < all.length() - 1 and all[i] == "0":
			i += 1
			n -= 1
		return _trim(all.substr(i), n)


	# Number.prototype.toString's layout for x = 0.digits × 10^n
	static func _js_format(d: String, n: int) -> String:
		var k := d.length()
		if k <= n and n <= 21:
			return d + "0".repeat(n - k)
		if 0 < n and n <= 21:
			return d.substr(0, n) + "." + d.substr(n)
		if -6 < n and n <= 0:
			return "0." + "0".repeat(-n) + d
		var ex := n - 1
		var es := ("+" if ex >= 0 else "-") + str(absi(ex))
		return (d if k == 1 else d[0] + "." + d.substr(1)) + "e" + es


	static func _inc_str(d: String) -> String:
		var out := d.to_utf8_buffer()
		var i := out.size() - 1
		while i >= 0:
			if out[i] == 57:
				out[i] = 48
				i -= 1
			else:
				out[i] += 1
				return out.get_string_from_utf8()
		return "1" + out.get_string_from_utf8()


	static func _big(n: int) -> Array:
		var a := []
		while n > 0:
			a.append(n % _BASE)
			n /= _BASE
		return a


	static func _big_parse(d: String) -> Array:
		var a := []
		var i := d.length()
		while i > 0:
			var j := maxi(0, i - 7)
			a.append(int(d.substr(j, i - j)))
			i = j
		while a.size() > 0 and a[-1] == 0:
			a.pop_back()
		return a


	static func _big_str(a: Array) -> String:
		if a.is_empty():
			return "0"
		var s := str(a[-1])
		for i in range(a.size() - 2, -1, -1):
			s += "%07d" % a[i]
		return s


	static func _mul_small(a: Array, k: int) -> Array:
		var out := []
		var carry := 0
		for limb in a:
			var v: int = limb * k + carry
			out.append(v % _BASE)
			carry = v / _BASE
		while carry > 0:
			out.append(carry % _BASE)
			carry /= _BASE
		return out


	static func _add_small(a: Array, k: int) -> Array:
		var out := a.duplicate()
		var i := 0
		var carry := k
		while carry > 0:
			if i == out.size():
				out.append(0)
			var v: int = out[i] + carry
			out[i] = v % _BASE
			carry = v / _BASE
			i += 1
		return out


	# a × base^n, in chunks that keep a limb's product inside 64 bits
	static func _mul_pow(a: Array, base: int, n: int) -> Array:
		var chunk := {2: 30, 5: 13, 10: 9}[base] as int
		var out := a
		var left := n
		while left > 0:
			var c := mini(left, chunk)
			out = _mul_small(out, int(pow(base, c)))
			left -= c
		return out


	static func _cmp(a: Array, b: Array) -> int:
		if a.size() != b.size():
			return 1 if a.size() > b.size() else -1
		for i in range(a.size() - 1, -1, -1):
			if a[i] != b[i]:
				return 1 if a[i] > b[i] else -1
		return 0


	# a first read within a few units of the double: the token's digits (at most 18) as a whole number over a power of
	# ten (String.to_float drops a small number's digits past the seventeenth decimal place)
	static func _approx(tok: String) -> float:
		var t := tok
		var neg := t.begins_with("-")
		if neg or t.begins_with("+"):
			t = t.substr(1)
		var e := t.findn("e")
		var ex := 0 if e < 0 else int(t.substr(e + 1))
		var mant := t if e < 0 else t.substr(0, e)
		var dot := mant.find(".")
		var digits := mant.replace(".", "")
		if dot >= 0:
			ex -= mant.length() - dot - 1
		var i := 0
		while i < digits.length() - 1 and digits[i] == "0":
			i += 1
		digits = digits.substr(i)
		if digits.length() > 18:
			ex += digits.length() - 18
			digits = digits.substr(0, 18)
		if not digits.is_valid_int():
			return tok.to_float()
		var x := float(int(digits))
		while ex > 22:
			x *= 1e22
			ex -= 22
		while ex < -22:
			x /= 1e22
			ex += 22
		x = x * pow(10.0, ex) if ex >= 0 else x / pow(10.0, -ex)
		return -x if neg else x

	# the double the token names: a first read, corrected to the neighbour that prints back as the token
	static func exact_float(tok: String) -> float:
		var x := _approx(tok)
		if is_nan(x) or is_inf(x):
			return x
		var want := tok
		if js_number(x) == want:
			return x
		var b := PackedByteArray()
		b.resize(8)
		b.encode_double(0, x)
		var bits := b.decode_s64(0)
		for k in [1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 7, -7, 8, -8]:
			var c := PackedByteArray()
			c.resize(8)
			c.encode_s64(0, bits + k)
			var y := c.decode_double(0)
			if js_number(y) == want:
				return y
		return x

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
