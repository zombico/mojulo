-- The Roblox side of the levelcast corpus (lib/graph/scene/level-conformance.js castCorpus), run under Lune: each level
-- built by kernel/level.luau from the bus.json its pack ships (its cast, fight, minds and scenes), its contract and
-- session, the ground triangles its minds stand on; then stepped frame by frame with the pilot FED (a Roblox Humanoid
-- is the pilot: the web recorded where its own step left it) and the frame's input, every other body run by the
-- kernel. Each frame's bus hash and every other ruled body's quantized pose written out, as the web's frameKey writes
-- them without the pilot. scripts/conformance.mjs --engine roblox --corpus levelcast copies this beside the kernel.
--
--   lune run conformance.luau <corpus.json> <out.json>

local fs = require("@lune/fs")
local process = require("@lune/process")

local K = {}
K.js = require("./kernel/js")
for _, name in { "json", "stats", "bus", "game", "rules", "nav", "mind", "group", "cast", "combat", "scenes", "quests", "level" } do
	K[name] = require("./kernel/" .. name)(K)
end
local js, json, bus, level = K.js, K.json, K.bus, K.level
local arr, obj, get = js.arr, js.obj, js.get

local TAU = math.pi * 2
local POS_Q, HEAD_Q = 0.05, 0.05
-- half up, as the web's Math.floor(v / k + 0.5); a heading wrapped as JS ((h % TAU) + TAU) % TAU
local function q(v, k)
	return string.format("%d", math.floor(v / k + 0.5))
end
local function qh(h)
	return q(math.fmod(math.fmod(h, TAU) + TAU, TAU), HEAD_Q)
end

local function key(L, ids, feet)
	local parts = { bus.hashState(L.bus) }
	for _, id in ipairs(ids) do
		local e = level.body(L, id)
		if e == nil then
			table.insert(parts, id .. ":none")
			continue
		end
		local up = js.finite(get(feet, id)) and feet[id] or 0
		table.insert(parts, string.format("%s:%s,%s,%s,%s", id, q(e.pos[1], POS_Q), q(e.pos[2], POS_Q), q(e.pos[3] - up, POS_Q), qh(e.heading or 0)))
	end
	return table.concat(parts, "|")
end

local corpus = json.decode(fs.readFile(process.args[1]))
local results = obj()
for _, sc in ipairs(corpus) do
	local L = level.fromBus(sc.bus, get(sc, "contract"), get(sc, "params"), { ground = sc.ground })
	local snaps = arr()
	for _, f in ipairs(sc.frames) do
		local p = f.pilot
		local walkers = arr({ obj({ id = p.id, transform = obj({ pos = arr({ p.pos[1], p.pos[2], p.pos[3] }) }), heading = p.heading, pitch = p.pitch, grounded = p.grounded }) })
		level.step(L, walkers, js.dup(js.isArr(get(f, "events")) and f.events or arr()), f.dt, js.dup(f.input))
		table.insert(snaps, key(L, sc.ids, sc.feet))
	end
	results[sc.id] = snaps
end
fs.writeFile(process.args[2], json.encode(results))
