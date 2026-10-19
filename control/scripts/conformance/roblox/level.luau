-- The Roblox side of the level corpus (lib/graph/scene/level-conformance.js), run under Lune: each level built by
-- kernel/level.luau from its bus config, contract and session, stepped over the track the web recorded (where every
-- body stands as a frame begins), each frame's bus hash, the warps and intents it handed back, and the game channel's
-- door and envelope written out. scripts/conformance.mjs --engine roblox --corpus level copies this beside the kernel.
--
--   lune run conformance.luau <corpus.json> <out.json>

local fs = require("@lune/fs")
local process = require("@lune/process")

local K = {}
K.js = require("./kernel/js")
for _, name in { "json", "stats", "bus", "game", "level" } do
	K[name] = require("./kernel/" .. name)(K)
end
local js, json, bus, game, level = K.js, K.json, K.bus, K.game, K.level
local arr, obj, get = js.arr, js.obj, js.get

local corpus = json.decode(fs.readFile(process.args[1]))
local results = obj()
for _, sc in ipairs(corpus) do
	local config = js.isObj(get(sc, "config")) and sc.config or obj()
	-- the scenario's entities ride its config as bus.json carries them
	local L = level.create(config, get(sc, "contract"), get(sc, "params"))
	local snaps = arr()
	for _, f in ipairs(sc.frames) do
		local r = level.step(L, js.dup(js.isArr(get(f, "walkers")) and f.walkers or arr()), js.dup(js.isArr(get(f, "events")) and f.events or arr()), js.truthy(get(f, "dt")) and f.dt or 0)
		local ctrl = obj({ ops = r.ops, warps = r.warps })
		local channel = obj({ door = game.door(L.channel) or js.NULL, envelope = game.envelope(L.channel, L.bus.vars) or js.NULL })
		table.insert(snaps, bus.hashState(L.bus) .. "|" .. js.json(ctrl) .. "|" .. js.json(channel))
	end
	results[sc.id] = snaps
end
fs.writeFile(process.args[2], json.encode(results))
