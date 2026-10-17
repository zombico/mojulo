--!nonstrict
-- mojulo-roblox kernel — the SCENE RUNNER: a level's scenes (scenes.js sceneProgram, carried in bus.json `scenes`)
-- played over the bus and the camera, a literal port of playscape/ui/scene-runner.js (the code the page ships), laid
-- out as the Godot kernel's scenes.gd is. Held equal to the web step by step by the scenes conformance corpus
-- (lib/graph/scene/scenes-conformance.js), run under Lune.
--
-- JS semantics are the js module's (truthiness, ===, the relational operators, UTF-16 string lengths). Pure Luau, no
-- host API.
--
--   local R = K.scenes; local S = R.create(program)
--   R.hear(S, types)        the bus event types since the last step (a scene starts on `scene:<id>`)
--   R.step(S, dt, ctl)      → { fire: [type], ops: [cast op], started: [id], ended: [id] }
--                           ctl: { next, held, skip, vars, move, pick }
--   R.view(S)               → { on, bars, line: { who, name, text, full, expression? } | null, choice: { options, sel } | null }
--
-- A line types on at RATE characters a second; a press shows it whole, the next goes on; holding the advance key HOLD
-- seconds, or Esc, skips to the end (or to a choice, which stays the player's).

return function(K)
local js = K.js
local NULL, UNDEF = js.NULL, js.UNDEF
local arr, obj, get, truthy = js.arr, js.obj, js.get, js.truthy

local scenes = {}

local RATE, HOLD, BARS = 40, 0.6, 4
scenes.RATE = RATE
scenes.HOLD = HOLD

-- a value as an array holds it: undefined stays UNDEF (a table cannot hold nil); ss prints it null
local function push(list, v)
	if v == nil then
		v = UNDEF
	end
	table.insert(list, v)
end

-- a JS array's items (a non-array reads as [])
local function items(v)
	return js.isArr(v) and v or {}
end

function scenes.create(program)
	local byId = {}
	for _, sc in ipairs(items(program)) do
		byId[js.str(get(sc, "id"))] = sc
	end
	return { byId = byId, active = nil, heard = {}, bars = 0, played = {} }
end

local CMP = {
	gte = function(a, b) return js.rel(a, b, ">=") end,
	gt = function(a, b) return js.rel(a, b, ">") end,
	lte = function(a, b) return js.rel(a, b, "<=") end,
	lt = function(a, b) return js.rel(a, b, "<") end,
	eq = function(a, b) return js.strictEq(a, b) end,
	ne = function(a, b) return not js.strictEq(a, b) end,
}

local function holds(sc, vars)
	local cond = get(sc, "if")
	for _, c in ipairs(truthy(cond) and items(cond) or {}) do
		local x = js.isObj(vars) and get(vars, js.str(get(c, "var"))) or UNDEF
		local v = js.isNullish(x) and 0 or x
		local cmp = CMP[js.str(get(c, "op"))]
		if not cmp then
			error("scenes: no comparison '" .. js.str(get(c, "op")) .. "'")
		end
		if not cmp(v, get(c, "n")) then
			return false
		end
	end
	return true
end

function scenes.hear(S, types)
	for _, t in ipairs(truthy(types) and items(types) or {}) do
		if type(t) == "string" then
			table.insert(S.heard, t)
		end
	end
end

local function finish(S, out)
	local A = S.active
	table.insert(out.ops, obj({ op = "unshot" }))
	table.insert(out.fire, "scene-end:" .. js.str(get(A.sc, "id")))
	push(out.ended, get(A.sc, "id"))
	S.active = nil
end

-- the length of a line's text, in the page's units (UTF-16 code units: String.prototype.length)
local function len(s)
	if type(s) ~= "string" then
		return 0
	end
	return #js.units(s)
end
scenes.len = len

-- a line's first n characters (String.prototype.slice(0, n)); a cut inside a surrogate pair keeps the whole pair back
-- (the page draws half a character there for a frame)
local function slice(s, n)
	s = js.str(s)
	local used = 0
	for p, c in utf8.codes(s) do
		local w = c > 0xFFFF and 2 or 1
		if used + w > n then
			return string.sub(s, 1, p - 1)
		end
		used += w
	end
	return s
end
scenes.slice = slice

-- a choice: its question stays as the line (its own, or the last said), the answer waits
local function choose(A, b)
	local ask = get(b, "ask")
	A.line = truthy(ask) and ask or (A.said ~= nil and A.said or nil)
	A.typed = A.line ~= nil and len(get(A.line, "text")) or 0
	A.choice = b
	A.sel = 0
	A.wait = { choice = true }
end

-- run beats until one waits (a timer, an event, a click) or the scene ends
local function advance(S, out)
	local A = S.active
	while true do
		if A.line ~= nil then
			A.said = A.line
		end
		A.i += 1
		A.wait = nil
		A.line = nil
		A.t = 0
		local b = items(get(A.sc, "beats"))[A.i + 1]
		if not truthy(b) then
			finish(S, out)
			return
		end
		local kind = get(b, "kind")
		if kind == "shot" then
			table.insert(out.ops, obj({ op = "shot", shot = get(b, "shot") }))
			if truthy(get(b, "for")) then
				A.wait = { time = get(b, "for") }
				return
			end
		elseif kind == "fire" then
			push(out.fire, get(b, "event"))
		elseif kind == "until" then
			A.wait = { event = get(b, "event") }
			return
		elseif kind == "wait" then
			A.wait = { time = get(b, "wait") }
			return
		elseif kind == "line" then
			A.line = b
			A.typed = 0
			A.wait = { click = true }
			return
		elseif kind == "choose" then
			choose(A, b)
			return
		elseif kind == "jump" then
			A.i = js.toNumber(get(b, "to")) - 1
		end
	end
end

local function answer(S, out, k)
	local A = S.active
	local o = items(get(A.choice, "options"))[k + 1]
	for _, t in ipairs(items(get(o, "fire"))) do
		push(out.fire, t)
	end
	A.choice = nil
	A.i = js.toNumber(get(o, "to")) - 1
	advance(S, out)
end

-- a skip: what is left fires at once, the walks land, the camera comes back; up to a choice, which stays the player's
local function skip(S, out)
	local A = S.active
	if A.choice ~= nil then
		return
	end
	local shot = nil
	local beats = items(get(A.sc, "beats"))
	local j = A.i + 1
	while j < #beats do
		local b = beats[j + 1]
		local kind = get(b, "kind")
		if kind == "fire" then
			push(out.fire, get(b, "event"))
		elseif kind == "shot" then
			shot = get(b, "shot")
		elseif kind == "line" then
			A.said = b
		elseif kind == "jump" then
			j = js.toNumber(get(b, "to")) - 1
		elseif kind == "choose" then
			table.insert(out.ops, obj({ op = "finish" }))
			if truthy(shot) then
				table.insert(out.ops, obj({ op = "shot", shot = shot }))
			end
			A.i = j
			A.t = 0
			A.holdT = 0
			choose(A, b)
			return
		end
		j += 1
	end
	table.insert(out.ops, obj({ op = "finish" }))
	finish(S, out)
end

local function isInteger(v)
	return js.finite(v) and math.floor(v) == v
end

function scenes.step(S, dt, ctl)
	local out = obj({ fire = arr(), ops = arr(), started = arr(), ended = arr() })
	local c = truthy(ctl) and ctl or obj()
	local heard = S.heard
	S.heard = {}
	if S.active == nil then
		for _, t in ipairs(heard) do
			if string.sub(t, 1, 6) ~= "scene:" then
				continue
			end
			local sc = S.byId[string.sub(t, 7)]
			if not truthy(sc) then
				continue
			end
			local id = js.str(get(sc, "id"))
			if (not js.strictEq(get(sc, "once"), false) and truthy(S.played[id])) or not holds(sc, get(c, "vars")) then
				continue
			end
			S.played[id] = (truthy(S.played[id]) and S.played[id] or 0) + 1
			S.active = { sc = sc, i = -1, wait = nil, line = nil, t = 0, typed = 0, holdT = 0, said = nil, choice = nil, sel = 0 }
			push(out.started, get(sc, "id"))
			advance(S, out)
			break
		end
	else
		local A = S.active
		-- a choice waits for its answer: no skipping past it
		A.holdT = (truthy(get(c, "held")) and A.choice == nil) and A.holdT + dt or 0
		if A.choice == nil and (truthy(get(c, "skip")) or A.holdT >= HOLD) then
			skip(S, out)
		else
			local w = A.wait
			local go = w == nil
			if w ~= nil and not js.isNullish(w.time) then
				A.t += dt
				go = js.rel(A.t, w.time, ">=")
			elseif w ~= nil and truthy(w.event) then
				go = false
				for _, h in ipairs(heard) do
					if js.strictEq(h, w.event) then
						go = true
						break
					end
				end
			elseif w ~= nil and truthy(w.choice) then
				local n = #items(get(A.choice, "options"))
				local mv = get(c, "move")
				if truthy(mv) then
					A.sel = (A.sel + (js.rel(mv, 0, ">") and 1 or -1) + n) % n
				end
				local pk = get(c, "pick")
				local k = -1
				if isInteger(pk) and pk >= 0 and pk < n then
					k = pk
				elseif truthy(get(c, "next")) then
					k = A.sel
				end
				if k >= 0 then
					answer(S, out, k)
				end
			elseif w ~= nil and truthy(w.click) then
				A.typed += dt * RATE
				if truthy(get(c, "next")) then
					local n = len(get(A.line, "text"))
					if A.typed < n then
						A.typed = n
					else
						go = true
					end
				end
			end
			if go then
				advance(S, out)
			end
		end
	end
	local want = S.active ~= nil and 1 or 0
	S.bars += math.max(-dt * BARS, math.min(dt * BARS, want - S.bars))
	return out
end

function scenes.view(S)
	local A = S.active
	local L = A ~= nil and A.line or nil
	local line = NULL
	if L ~= nil then
		local text = get(L, "text")
		line = obj({ who = get(L, "who"), name = get(L, "name"), text = slice(text, math.floor(A.typed)), full = A.typed >= len(text) })
		if truthy(get(L, "expression")) then
			line.expression = get(L, "expression")
		end
	end
	local choice = NULL
	if A ~= nil and A.choice ~= nil then
		local options = arr()
		for _, o in ipairs(items(get(A.choice, "options"))) do
			push(options, get(o, "text"))
		end
		choice = obj({ options = options, sel = A.sel })
	end
	return obj({ on = A ~= nil, bars = S.bars, line = line, choice = choice })
end

return scenes
end
