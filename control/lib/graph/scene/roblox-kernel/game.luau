--!strict
-- mojulo-roblox kernel — the LEVEL'S GAME CHANNEL, the page's (scene/channels/game.js) ported: the contract's `on` read
-- over the bus log's delta, each frame. The first pattern that matches an event maps it: an emit is gathered for the
-- outcome (its '{event}' values named by the event), an end ends the level (with its exit, when it names one), a door
-- leaves the level by it, once; nothing is gathered once the level has ended. At start, the session's carried
-- chapters and the level it arrived from are the first frame's events. Held equal by the level corpus
-- (lib/graph/scene/level-conformance.js).
--
-- Pure Luau, no host API. A kernel module: the loader hands it the kernel (K.js).
--
--   game.create(contract, params)   → ch
--   game.start(ch)                  → [event]   the chapters carried in, the arrival
--   game.entry(ch)                  → the door the level was entered by ({ id, at, spawn, heading }), or nil
--   game.hear(ch, log, from)        the log's events after index `from` (a count: 0 hears it all)
--   game.envelope(ch, vars)         → { result, events, exit?, stats? } once ended, else nil (stats.kept off the vars)
--   game.door(ch)                   → { door, events } once a door was taken, else nil
--   game.ended(ch)                  → the result, or nil

return function(K)
local js = K.js
local arr, obj, get, truthy = js.arr, js.obj, js.get, js.truthy

local game = {}

function game.create(contract: any, params: any): any
	return {
		contract = js.isObj(contract) and contract or obj(),
		params = js.isObj(params) and params or obj(),
		events = arr(), ended = false, leaving = false, result = nil, exit = nil, doorTaken = nil,
	}
end

function game.start(ch: any): { any }
	local c, p = ch.contract, ch.params
	local out = arr()
	local chapters = get(c, "chapters")
	if truthy(chapters) and js.isObj(chapters) then
		local s = get(p, js.str(get(chapters, "slice")))
		local flags = (truthy(s) and js.isObj(s) and truthy(get(s, "flags"))) and s.flags or obj()
		local carried = get(chapters, "carried")
		for _, x in ipairs(js.isArr(carried) and carried or {}) do
			if js.isObj(x) and truthy(get(flags, js.str(get(x, "key")))) then
				table.insert(out, obj({ type = get(x, "event") }))
			end
		end
	end
	local arrive = get(p, "arrive")
	if type(arrive) == "string" and js.isArr(get(c, "arrive")) and table.find(c.arrive, arrive) then
		table.insert(out, obj({ type = "arrive:" .. arrive }))
	end
	return out
end

function game.entry(ch: any): any
	local e = get(ch.params, "__entry")
	if not truthy(e) or not js.isObj(e) then
		return nil
	end
	for _, d in ipairs(js.isArr(get(ch.contract, "doors")) and ch.contract.doors or {}) do
		if js.isObj(d) and js.strictEq(get(d, "id"), get(e, "door")) then
			return d
		end
	end
	return nil
end

function game.hear(ch: any, log: { any }, from: number)
	local on = get(ch.contract, "on")
	if not js.isObj(on) then
		return
	end
	local pats = js.keys(on)
	for i = from + 1, #log do
		local ev = log[i]
		if not js.isObj(ev) or not truthy(get(ev, "type")) then
			continue   -- the cap and noop markers carry no type
		end
		for _, pat in ipairs(pats) do
			if not js.glob(ev.type, pat) then
				continue
			end
			local act = on[pat]
			if js.isObj(act) and truthy(get(act, "emit")) then
				if not ch.ended then
					local o = js.dup(act.emit)
					if type(o) == "table" then
						for k, v in pairs(o) do
							if v == "{event}" then
								o[k] = ev.type
							end
						end
					end
					table.insert(ch.events, o)
				end
			elseif js.isObj(act) and truthy(get(act, "end")) then
				if not ch.ended then
					ch.ended = true
					ch.result = act["end"]
					local x = get(act, "exit")
					if type(x) == "string" and x ~= "" then
						ch.exit = x
					end
				end
			elseif js.isObj(act) and truthy(get(act, "door")) then
				if not ch.ended and not ch.leaving then
					ch.leaving = true
					ch.doorTaken = act.door
				end
			end
			break
		end
	end
end

function game.ended(ch: any): any
	return ch.result
end

function game.envelope(ch: any, vars: any): any
	if not truthy(ch.result) then
		return nil
	end
	local env = obj({ result = ch.result, events = js.copy(ch.events) })
	if ch.exit then
		env.exit = ch.exit
	end
	local keep = get(ch.contract, "keep")
	if js.isArr(keep) and #keep > 0 then
		local kept = arr()
		for _, k in ipairs(keep) do
			local n = js.toNumber(get(vars, js.str(get(k, "var"))))
			if n ~= n or n == 0 then
				n = 0
			end
			local scale = get(k, "scale")
			local s = truthy(scale) and js.toNumber(scale) or 1
			local row = obj({ label = get(k, "label"), value = js.round(n * s * 1000) / 1000, best = get(k, "best") })
			if truthy(get(k, "unit")) then
				row.unit = k.unit
			end
			table.insert(kept, row)
		end
		env.stats = obj({ kept = kept })
	end
	return env
end

function game.door(ch: any): any
	if not truthy(ch.doorTaken) then
		return nil
	end
	return obj({ door = ch.doorTaken, events = js.copy(ch.events) })
end

return game
end
