--!nonstrict
-- mojulo-roblox kernel — the QUEST JOURNAL: a level's quests (quests.js questProgram, carried in bus.json `quests`) over
-- the bus's flags (the vars flag-<name>), a literal port of quests.js questView and questNews (the code the page ships),
-- laid out as the Godot kernel's quests.gd is. Held equal by the scenes conformance corpus, run under Lune.
--
-- JS semantics are the js module's. Pure Luau, no host API.
--
--   view(program, vars)  → [{ id, name, state: 'on' | 'done', steps: [{ text, done }] }]  the begun quests; a step shows
--                          once those before it are done
--   news(program, flags) → [{ kind: 'begun' | 'step' | 'done', name, text? }]           for flags set just now

return function(K)
local js = K.js
local arr, obj, get, truthy = js.arr, js.obj, js.get, js.truthy

local quests = {}

-- a JS array's items (a non-array reads as [])
local function items(v)
	return js.isArr(v) and v or {}
end

function quests.view(program, vars)
	local function on(f)
		return js.isObj(vars) and truthy(get(vars, "flag-" .. js.str(f)))
	end
	local out = arr()
	for _, q in ipairs(truthy(program) and items(program) or {}) do
		if truthy(get(q, "starts")) and not on(q.starts) then
			continue
		end
		local steps = arr()
		for _, s in ipairs(items(get(q, "steps"))) do
			local d = on(get(s, "flag"))
			table.insert(steps, obj({ text = get(s, "text"), done = d }))
			if not d then
				break
			end
		end
		local all = true
		for _, s in ipairs(steps) do
			all = all and s.done
		end
		local state = (all and #steps == #items(get(q, "steps"))) and "done" or "on"
		table.insert(out, obj({ id = get(q, "id"), name = get(q, "name"), state = state, steps = steps }))
	end
	return out
end

function quests.news(program, flags)
	local out = arr()
	for _, f in ipairs(truthy(flags) and items(flags) or {}) do
		for _, q in ipairs(truthy(program) and items(program) or {}) do
			if js.strictEq(get(q, "starts"), f) then
				table.insert(out, obj({ kind = "begun", name = get(q, "name") }))
			end
			local steps = items(get(q, "steps"))
			local j = -1
			for k, s in ipairs(steps) do
				if js.strictEq(get(s, "flag"), f) then
					j = k - 1
					break
				end
			end
			if j >= 0 then
				if j == #steps - 1 then
					table.insert(out, obj({ kind = "done", name = get(q, "name") }))
				else
					table.insert(out, obj({ kind = "step", name = get(q, "name"), text = get(steps[j + 1], "text") }))
				end
			end
		end
	end
	return out
end

return quests
end
