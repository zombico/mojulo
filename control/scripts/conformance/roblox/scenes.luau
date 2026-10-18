-- The Roblox side of the scenes conformance corpus (lib/graph/scene/scenes-conformance.js), run under Lune: each
-- scenario's frames through kernel/scenes.luau, each journal's flags through kernel/quests.luau, one canonical snapshot
-- a step (as scripts/conformance/godot/scenes.gd writes them). scripts/conformance.mjs --engine roblox --corpus scenes
-- copies this beside the kernel.
--
--   lune run conformance.luau <corpus.json> <out.json>

local fs = require("@lune/fs")
local process = require("@lune/process")

local K = {}
K.js = require("./kernel/js")
for _, name in { "json", "scenes", "quests" } do
	K[name] = require("./kernel/" .. name)(K)
end
local js, json, R, Q = K.js, K.json, K.scenes, K.quests
local arr, obj, get, truthy = js.arr, js.obj, js.get, js.truthy

local DT = 1 / 30
local function nano(x)
	return math.floor(x * 1e9 + 0.5) / 1e9
end

local corpus = json.decode(fs.readFile(process.args[1]))
local results = obj()
for _, sc in ipairs(corpus.scenes) do
	local S = R.create(js.dup(corpus.program))
	local vars = obj()
	local snaps = arr()
	for _, f in ipairs(sc.frames) do
		local fv = get(f, "vars")
		if truthy(fv) then
			for k, v in pairs(fv) do
				vars[k] = v
			end
		end
		local heard = get(f, "heard")
		R.hear(S, truthy(heard) and heard or arr())
		local fc = get(f, "ctl")
		local ctl = truthy(fc) and js.copy(fc) or obj()
		ctl.vars = vars
		local out = R.step(S, DT, ctl)
		local v = R.view(S)
		v.bars = nano(v.bars)
		table.insert(snaps, js.ss(obj({ out = out, view = v })))
	end
	results[sc.id] = snaps
end
for _, j in ipairs(corpus.journal) do
	local vars = obj()
	local snaps = arr()
	for _, set in ipairs(j.flags) do
		for _, f in ipairs(set) do
			vars["flag-" .. js.str(f)] = 1
		end
		table.insert(snaps, js.ss(obj({ view = Q.view(corpus.quests, vars), news = Q.news(corpus.quests, set) })))
	end
	results[j.id] = snaps
end
fs.writeFile(process.args[2], json.encode(results))
