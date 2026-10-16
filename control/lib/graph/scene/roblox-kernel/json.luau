--!strict
-- mojulo-roblox kernel — JSON, read the way JSON.parse reads it. A score, a bus fragment, a corpus arrive as JSON
-- text; the reader keeps what a Lua table would lose: null stays js.NULL (a table cannot hold nil), arrays and
-- objects keep their tags (an empty one stays what it was), and a number is the double its digits name (tonumber is
-- correctly rounded; Roblox's HttpService:JSONDecode and Lune's serde both drop nulls), and an object's keys keep the
-- order they were written in (js.keys reads it).
--
-- Pure Luau, no host API. A kernel module: the loader hands it the kernel (K.js).
--
--   json.decode(text) → value        json.encode(value) → JSON.stringify(value) (key-sorted; js.json)

return function(K)
local js = K.js

local json = {}

local function fail(at: number, why: string): never
	error(string.format("json: %s at byte %d", why, at))
end

local ESC = { ['"'] = '"', ["\\"] = "\\", ["/"] = "/", b = "\b", f = "\f", n = "\n", r = "\r", t = "\t" }

function json.decode(text: string): any
	local i = 1
	local n = #text

	local function ws()
		i = string.find(text, "[^ \t\r\n]", i) or n + 1
	end

	local value: () -> any

	local function str(): string
		local out = {}
		i += 1   -- the opening quote
		while true do
			local j = string.find(text, '["\\]', i)
			if not j then
				fail(i, "unterminated string")
			end
			table.insert(out, string.sub(text, i, (j :: number) - 1))
			local c = string.sub(text, j :: number, j :: number)
			if c == '"' then
				i = (j :: number) + 1
				return table.concat(out)
			end
			local e = string.sub(text, (j :: number) + 1, (j :: number) + 1)
			if e == "u" then
				local cp = tonumber(string.sub(text, (j :: number) + 2, (j :: number) + 5), 16)
				if not cp then
					fail(j :: number, "bad \\u escape")
				end
				i = (j :: number) + 6
				-- a surrogate pair is one code point
				if cp >= 0xD800 and cp <= 0xDBFF and string.sub(text, i, i + 1) == "\\u" then
					local lo = tonumber(string.sub(text, i + 2, i + 5), 16)
					if lo and lo >= 0xDC00 and lo <= 0xDFFF then
						cp = 0x10000 + (cp - 0xD800) * 0x400 + (lo - 0xDC00)
						i += 6
					end
				end
				table.insert(out, utf8.char(cp :: number))
			else
				local r = ESC[e]
				if not r then
					fail(j :: number, "bad escape")
				end
				table.insert(out, r)
				i = (j :: number) + 2
			end
		end
	end

	function value(): any
		ws()
		local c = string.sub(text, i, i)
		if c == "{" then
			local o = js.obj()
			local order = {}
			js.setKeyOrder(o, order)
			i += 1
			ws()
			if string.sub(text, i, i) == "}" then
				i += 1
				return o
			end
			while true do
				ws()
				if string.sub(text, i, i) ~= '"' then
					fail(i, "expected a key")
				end
				local k = str()
				ws()
				if string.sub(text, i, i) ~= ":" then
					fail(i, "expected ':'")
				end
				i += 1
				if o[k] == nil then
					table.insert(order, k)
				end
				o[k] = value()
				ws()
				local d = string.sub(text, i, i)
				i += 1
				if d == "}" then
					return o
				end
				if d ~= "," then
					fail(i - 1, "expected ',' or '}'")
				end
			end
		elseif c == "[" then
			local a = js.arr()
			i += 1
			ws()
			if string.sub(text, i, i) == "]" then
				i += 1
				return a
			end
			while true do
				table.insert(a, value())
				ws()
				local d = string.sub(text, i, i)
				i += 1
				if d == "]" then
					return a
				end
				if d ~= "," then
					fail(i - 1, "expected ',' or ']'")
				end
			end
		elseif c == '"' then
			return str()
		elseif string.sub(text, i, i + 3) == "true" then
			i += 4
			return true
		elseif string.sub(text, i, i + 4) == "false" then
			i += 5
			return false
		elseif string.sub(text, i, i + 3) == "null" then
			i += 4
			return js.NULL
		end
		local s, e = string.find(text, "^-?%d+%.?%d*[eE]?[-+]?%d*", i)
		if not s then
			fail(i, "unexpected '" .. c .. "'")
		end
		local num = tonumber(string.sub(text, s :: number, e :: number))
		if num == nil then
			fail(i, "bad number")
		end
		i = (e :: number) + 1
		return num
	end

	local v = value()
	ws()
	if i <= n then
		fail(i, "trailing text")
	end
	return v
end

function json.encode(v: any): string
	return js.json(v)
end

return json
end
