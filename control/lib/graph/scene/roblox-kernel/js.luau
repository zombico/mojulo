--!strict
-- mojulo-roblox kernel — JS VALUE SEMANTICS, made explicit. The kernel's modules are ports of the web runtime (the
-- truth), held equal to it by conformance corpora that compare canonical strings frame by frame, so every place the
-- JS reads a value its own way is said here once: JSON null and JS undefined (Lua has only nil, and nil cannot sit in
-- a table), an empty array and an empty object (Lua has one table), numbers printed the way JSON.stringify prints
-- them, strings hashed and ordered by UTF-16 code units, JS truthiness, ToNumber, ===, the relational operators, and
-- the `*` glob the bus matches with.
--
-- Pure Luau, no host API: the same module runs under Lune (the conformance gate) and in a Roblox place.
--
--   js.NULL, js.UNDEF          the two sentinels a table can hold (a missing key reads as nil, which is UNDEF)
--   js.arr(t?), js.obj(t?)     tag a table as a JS array / object;  js.isArr(v), js.isObj(v)
--   js.get(o, k)               o[k], or UNDEF when absent (the bus's get_or_undef)
--   js.ss(v)                   the deterministic stringify (sorted keys): the bus's sort key and state hash
--   js.json(v)                 JSON.stringify of a key-sorted value (integer-like keys first, as a JS object holds them)
--   js.numStr(x, nanAs?)       a number as JS prints it
--   js.fnv(s)                  FNV-1a over UTF-16 code units, base 36
--   js.glob(value, pat)        the bus's glob: '*' a run of anything but a line terminator
--   js.truthy, js.toNumber, js.strictEq, js.rel, js.str, js.finite, js.isNum, js.lt (UTF-16 string order), js.dup

local js = {}

local NULL = setmetatable({}, { __tostring = function() return "null" end })
local UNDEF = setmetatable({}, { __tostring = function() return "undefined" end })
js.NULL = NULL
js.UNDEF = UNDEF

local ARR = { __js = "array" }
local OBJ = { __js = "object" }
js.ARR = ARR
js.OBJ = OBJ

function js.arr(t: { any }?): { any }
	return setmetatable(t or {}, ARR) :: any
end
function js.obj(t: { [any]: any }?): { [any]: any }
	return setmetatable(t or {}, OBJ) :: any
end

function js.isArr(v: any): boolean
	if type(v) ~= "table" or v == NULL or v == UNDEF then
		return false
	end
	local mt = getmetatable(v)
	if mt == ARR then
		return true
	end
	if mt == OBJ then
		return false
	end
	-- untagged: an array when it holds [1] and nothing but a sequence
	if v[1] == nil then
		return false
	end
	local n = #v
	for k in pairs(v) do
		if type(k) ~= "number" or k < 1 or k > n or k % 1 ~= 0 then
			return false
		end
	end
	return true
end

function js.isObj(v: any): boolean
	return type(v) == "table" and v ~= NULL and v ~= UNDEF and not js.isArr(v)
end

function js.isUndef(v: any): boolean
	return v == nil or v == UNDEF
end

function js.isNull(v: any): boolean
	return v == NULL
end

-- null or undefined (JS `v == null`)
function js.isNullish(v: any): boolean
	return v == nil or v == UNDEF or v == NULL
end

function js.get(o: any, k: any): any
	if type(o) ~= "table" or o == NULL or o == UNDEF then
		return UNDEF
	end
	local v = o[k]
	if v == nil then
		return UNDEF
	end
	return v
end

-- JS `o.k !== undefined`
function js.defined(o: any, k: any): boolean
	return type(o) == "table" and o[k] ~= nil and o[k] ~= UNDEF
end

function js.has(o: any, k: any): boolean
	return type(o) == "table" and o ~= NULL and o ~= UNDEF and o[k] ~= nil
end

function js.isNum(v: any): boolean
	return type(v) == "number"
end

function js.finite(v: any): boolean
	return type(v) == "number" and v == v and v ~= math.huge and v ~= -math.huge
end

-- a deep copy that keeps the array / object tags (JSON.parse(JSON.stringify(x)) without its losses)
function js.dup(v: any): any
	if type(v) ~= "table" or v == NULL or v == UNDEF then
		return v
	end
	local out = {}
	for k, x in pairs(v) do
		out[k] = js.dup(x)
	end
	return setmetatable(out, getmetatable(v))
end

-- a shallow copy (Object.assign({}, o) / arr.slice())
function js.copy(v: any): any
	if type(v) ~= "table" or v == NULL or v == UNDEF then
		return v
	end
	local out = {}
	for k, x in pairs(v) do
		out[k] = x
	end
	return setmetatable(out, getmetatable(v))
end

-- ── numbers ─────────────────────────────────────────────────────────────────────────────────────────────────────
-- the shortest decimal digits that name the double (the significand as a string, and the decimal exponent n with
-- value = 0.d1d2… × 10^n), found by asking printf for 1..17 significant digits and keeping the first that round-trips
local function shortest(x: number): (string, number)
	for p = 1, 17 do
		local s = string.format("%." .. (p - 1) .. "e", x)
		if tonumber(s) == x then
			local mant, exp = string.match(s, "^(%d[%.%d]*)e([-+]%d+)$")
			local digits = string.gsub(mant :: string, "%.", "")
			digits = string.gsub(digits, "0+$", "")
			if digits == "" then
				digits = "0"
			end
			return digits, (tonumber(exp) :: number) + 1
		end
	end
	error("js: no round-trip for " .. tostring(x))
end

-- Number::toString(10) (ECMA-262 6.1.6.1.20), which JSON.stringify prints for a finite number
function js.numStr(x: number, nanAs: string?): string
	if x ~= x or x == math.huge or x == -math.huge then
		return nanAs or "null"
	end
	if x == 0 then
		return "0"   -- -0 prints as 0
	end
	if x < 0 then
		return "-" .. js.numStr(-x, nanAs)
	end
	if x % 1 == 0 and x < 2 ^ 53 then
		return string.format("%d", x)
	end
	local d, n = shortest(x)
	local k = #d
	if k <= n and n <= 21 then
		return d .. string.rep("0", n - k)
	end
	if 0 < n and n <= 21 then
		return string.sub(d, 1, n) .. "." .. string.sub(d, n + 1)
	end
	if -6 < n and n <= 0 then
		return "0." .. string.rep("0", -n) .. d
	end
	local e = n - 1
	local es = (e >= 0 and "+" or "-") .. tostring(math.abs(e))
	if k == 1 then
		return d .. "e" .. es
	end
	return string.sub(d, 1, 1) .. "." .. string.sub(d, 2) .. "e" .. es
end

-- JS ToNumber: undefined → NaN, null → 0, booleans → 0 / 1, strings parsed (blank → 0, junk → NaN)
function js.toNumber(v: any): number
	if type(v) == "number" then
		return v
	end
	if v == NULL then
		return 0
	end
	if v == nil or v == UNDEF then
		return 0 / 0
	end
	if type(v) == "boolean" then
		return v and 1 or 0
	end
	if type(v) == "string" then
		local s = string.match(v, "^%s*(.-)%s*$") :: string
		if s == "" then
			return 0
		end
		if s == "Infinity" or s == "+Infinity" then
			return math.huge
		end
		if s == "-Infinity" then
			return -math.huge
		end
		if string.match(s, "^0[xX]%x+$") then
			return tonumber(string.sub(s, 3), 16) :: number
		end
		if string.match(s, "^[+-]?%d+%.?%d*[eE][+-]?%d+$") or string.match(s, "^[+-]?%.%d+[eE][+-]?%d+$")
			or string.match(s, "^[+-]?%d+%.?%d*$") or string.match(s, "^[+-]?%.%d+$") then
			return tonumber(s) :: number
		end
		return 0 / 0
	end
	-- an array is its String() read as a number; an object is NaN
	if js.isArr(v) then
		return js.toNumber(js.str(v))
	end
	return 0 / 0
end

function js.truthy(v: any): boolean
	if v == nil or v == UNDEF or v == NULL or v == false then
		return false
	end
	if type(v) == "number" then
		return v ~= 0 and v == v
	end
	if type(v) == "string" then
		return v ~= ""
	end
	return true
end

-- JS ===: numbers by value (NaN unequal to itself), strings / booleans / null by value, tables by identity
function js.strictEq(a: any, b: any): boolean
	if a == nil then
		a = UNDEF
	end
	if b == nil then
		b = UNDEF
	end
	if type(a) == "number" and type(b) == "number" then
		return a == b
	end
	return rawequal(a, b)
end

-- ── strings ─────────────────────────────────────────────────────────────────────────────────────────────────────
-- the UTF-16 code units of a UTF-8 string
local function units(s: string): { number }
	local out = {}
	for _, c in utf8.codes(s) do
		if c > 0xFFFF then
			local u = c - 0x10000
			table.insert(out, 0xD800 + bit32.rshift(u, 10))
			table.insert(out, 0xDC00 + bit32.band(u, 0x3FF))
		else
			table.insert(out, c)
		end
	end
	return out
end
js.units = units

-- JS string `<`: UTF-16 code unit order. UTF-8 byte order is code point order, which differs only between a
-- supplementary character and U+E000..U+FFFF, so the byte compare stands unless a byte ≥ 0xEE is about.
function js.lt(a: string, b: string): boolean
	if not (string.find(a, "[\238-\244]") or string.find(b, "[\238-\244]")) then
		return a < b
	end
	local x, y = units(a), units(b)
	for i = 1, math.min(#x, #y) do
		if x[i] ~= y[i] then
			return x[i] < y[i]
		end
	end
	return #x < #y
end

-- JSON.stringify of a string
function js.quote(s: string): string
	local out = string.gsub(s, '[%c"\\]', function(c: string): string
		local b = string.byte(c)
		if c == '"' then return '\\"' end
		if c == "\\" then return "\\\\" end
		if b == 8 then return "\\b" end
		if b == 12 then return "\\f" end
		if b == 10 then return "\\n" end
		if b == 13 then return "\\r" end
		if b == 9 then return "\\t" end
		if b < 0x20 then return string.format("\\u%04x", b) end
		return c   -- DEL (0x7f) is printed as itself
	end)
	return '"' .. out .. '"'
end

-- JS String(v)
function js.str(v: any): string
	if v == nil or v == UNDEF then
		return "undefined"
	end
	if v == NULL then
		return "null"
	end
	if type(v) == "boolean" then
		return v and "true" or "false"
	end
	if type(v) == "number" then
		return js.numStr(v, "NaN")
	end
	if type(v) == "string" then
		return v
	end
	if js.isArr(v) then
		local parts = {}
		for i = 1, #v do
			local x = v[i]
			parts[i] = (x == NULL or x == UNDEF) and "" or js.str(x)
		end
		return table.concat(parts, ",")
	end
	return "[object Object]"
end

-- the keys of an object, sorted as Object.keys(v).sort() sorts them (strings, UTF-16 order)
local function sortedKeys(v: { [any]: any }): { string }
	local ks = {}
	for k in pairs(v) do
		table.insert(ks, tostring(k))
	end
	table.sort(ks, js.lt)
	return ks
end
js.sortedKeys = sortedKeys

-- the deterministic stringify (sorted keys): the bus's sort key and the state hash
function js.ss(v: any): string
	if v == nil or v == UNDEF or v == NULL then
		return "null"
	end
	local t = type(v)
	if t == "boolean" then
		return v and "true" or "false"
	end
	if t == "number" then
		return js.numStr(v)
	end
	if t == "string" then
		return js.quote(v)
	end
	if js.isArr(v) then
		local parts = {}
		for i = 1, #v do
			parts[i] = js.ss(v[i])
		end
		return "[" .. table.concat(parts, ",") .. "]"
	end
	local parts = {}
	for _, k in ipairs(sortedKeys(v)) do
		table.insert(parts, js.quote(k) .. ":" .. js.ss(v[k]))
	end
	return "{" .. table.concat(parts, ",") .. "}"
end

-- an array index as a JS object holds it first (a canonical integer string below 2^32 - 1)
local function indexKey(k: string): number?
	if k == "0" or string.match(k, "^[1-9]%d*$") then
		local n = tonumber(k) :: number
		if n < 4294967295 then
			return n
		end
	end
	return nil
end

-- JSON.stringify of a value whose objects were built with their keys sorted (the conformance tails): a JS object
-- holds its integer-like keys first, ascending, then the rest in the (sorted) order they were added
function js.json(v: any): string
	if v == nil or v == UNDEF or v == NULL then
		return "null"
	end
	local t = type(v)
	if t ~= "table" then
		return js.ss(v)
	end
	if js.isArr(v) then
		local parts = {}
		for i = 1, #v do
			parts[i] = js.json(v[i])
		end
		return "[" .. table.concat(parts, ",") .. "]"
	end
	local ints, rest = {}, {}
	for _, k in ipairs(sortedKeys(v)) do
		if indexKey(k) then table.insert(ints, k) else table.insert(rest, k) end
	end
	table.sort(ints, function(a, b) return (indexKey(a) :: number) < (indexKey(b) :: number) end)
	local parts = {}
	for _, k in ipairs(ints) do table.insert(parts, js.quote(k) .. ":" .. js.json(v[k])) end
	for _, k in ipairs(rest) do table.insert(parts, js.quote(k) .. ":" .. js.json(v[k])) end
	return "{" .. table.concat(parts, ",") .. "}"
end

-- ── an object whose iteration order matters (a JS object enumerates integer-like keys ascending, then the rest in
-- the order they were added; a Lua table keeps no order). Use it where the port's output depends on that order, as a
-- floating-point sum over a JS object's values does.
local OMap = {}
OMap.__index = OMap
function js.omap(): any
	return setmetatable({ _keys = {}, _vals = {} }, OMap)
end
function OMap:get(k: string): any
	return self._vals[k]
end
function OMap:set(k: string, v: any)
	if self._vals[k] == nil then
		table.insert(self._keys, k)
	end
	self._vals[k] = v
end
function OMap:delete(k: string)
	if self._vals[k] == nil then
		return
	end
	self._vals[k] = nil
	for i, x in ipairs(self._keys) do
		if x == k then
			table.remove(self._keys, i)
			break
		end
	end
end
-- the keys in JS enumeration order
function OMap:keys(): { string }
	local ints, rest = {}, {}
	for _, k in ipairs(self._keys) do
		if indexKey(k) then table.insert(ints, k) else table.insert(rest, k) end
	end
	table.sort(ints, function(a, b) return (indexKey(a) :: number) < (indexKey(b) :: number) end)
	for _, k in ipairs(rest) do
		table.insert(ints, k)
	end
	return ints
end

-- JS Math.round: half rounds toward +Infinity
function js.round(x: number): number
	local r = math.floor(x)
	if x - r >= 0.5 then
		r += 1
	end
	return r
end

-- ── hashing ─────────────────────────────────────────────────────────────────────────────────────────────────────
-- Math.imul: the low 32 bits of a product, in halves so no partial product leaves the double's exact range
local function imul32(a: number, b: number): number
	local bl, bh = bit32.band(b, 0xFFFF), bit32.rshift(b, 16)
	local lo = a * bl
	local hi = bit32.band(a * bh, 0xFFFF) * 65536
	return (lo + hi) % 4294967296
end

local DIGITS36 = "0123456789abcdefghijklmnopqrstuvwxyz"

-- FNV-1a over UTF-16 code units, base 36 (the content-derived spawn id)
function js.fnv(s: string): string
	local h = 0x811c9dc5
	for _, u in ipairs(units(s)) do
		h = imul32(bit32.bxor(h, u), 0x01000193)
	end
	if h == 0 then
		return "0"
	end
	local out = ""
	while h > 0 do
		local d = h % 36
		out = string.sub(DIGITS36, d + 1, d + 1) .. out
		h = (h - d) / 36
	end
	return out
end

-- ── the bus's glob ──────────────────────────────────────────────────────────────────────────────────────────────
-- the code points of a string
local function points(s: string): { number }
	local out = {}
	for _, c in utf8.codes(s) do
		table.insert(out, c)
	end
	return out
end
local function terminator(c: number): boolean
	return c == 10 or c == 13 or c == 0x2028 or c == 0x2029
end

-- '*' anywhere is a wildcard: ^piece.*piece…$ as JS compiles it, `.` matching anything but a line terminator
function js.glob(value: any, pat: any): boolean
	if pat == nil or pat == UNDEF or pat == "*" then
		return true
	end
	local p, sv = js.str(pat), js.str(value)
	if not string.find(p, "*", 1, true) then
		return sv == p
	end
	local P, S = points(p), points(sv)
	-- backtracking wildcard match: on a mismatch, a star retries one character further, but never past a terminator
	local pi, si, star, mark = 1, 1, 0, 0
	while si <= #S do
		if pi <= #P and P[pi] ~= 42 and P[pi] == S[si] then
			pi += 1
			si += 1
		elseif pi <= #P and P[pi] == 42 then
			star, mark = pi, si
			pi += 1
		elseif star > 0 and not terminator(S[mark]) then
			mark += 1
			si = mark
			pi = star + 1
		else
			return false
		end
	end
	while pi <= #P and P[pi] == 42 do
		pi += 1
	end
	return pi > #P
end

-- JS relational (<, <=, >, >=): two strings compare as strings; anything else as numbers (NaN compares false)
function js.rel(a: any, b: any, op: string): boolean
	if type(a) == "string" and type(b) == "string" then
		if op == "<" then return js.lt(a, b) end
		if op == "<=" then return not js.lt(b, a) end
		if op == ">" then return js.lt(b, a) end
		return not js.lt(a, b)
	end
	local x, y = js.toNumber(a), js.toNumber(b)
	if x ~= x or y ~= y then
		return false
	end
	if op == "<" then return x < y end
	if op == "<=" then return x <= y end
	if op == ">" then return x > y end
	return x >= y
end

return js
