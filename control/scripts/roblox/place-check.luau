-- The Roblox export's place gate, run under Lune (scripts/export-roblox.mjs). Opens the place Rojo built, checks its
-- tree (the kernel's modules, the server and client scripts, each level's data and greybox, its look decoration only),
-- compiles every script, and plays each level FROM THE PLACE: its kernel loaded from the ModuleScripts' own source,
-- its bus.json and contract.json decoded from its data module, stepped over the track the web recorded for that level.
-- Writes what it found; the web side compares the frames.
--
-- A level whose track is `cast` (its bus.json carries a cast) is played whole: the pilot's pose fed each frame, the
-- cast, the fight, the minds and the scenes run by the place's kernel, each frame's line the bus's hash and every other
-- ruled body's quantized pose (the levelcast corpus's, level-conformance.js).
--
--   lune run place-check.luau <place.rbxl> <tracks.json> <out.json>
--   tracks.json: { [level ref]: { frames: [{ walkers, events?, dt }], params? }
--                             | { cast: true, frames: [{ pilot, input, events?, dt }], ids, feet, ground, params? } }
--   out.json:    { problems: [string], kernel: { [module]: source }, levels: { [ref]: [frame line] } }

local fs = require("@lune/fs")
local process = require("@lune/process")
local roblox = require("@lune/roblox")
local luau = require("@lune/luau")

local placePath, tracksPath, outPath = process.args[1], process.args[2], process.args[3]
local place = roblox.deserializePlace(fs.readFile(placePath))
local problems = {}
local function problem(s: string)
	table.insert(problems, s)
end

local function child(parent, path: { string })
	local at = parent
	for _, name in path do
		if at == nil then
			return nil
		end
		at = at:FindFirstChild(name)
	end
	return at
end

-- ── the tree ─────────────────────────────────────────────────────────────────────────────────────────────────────
-- the whole level's modules (the cast, the fight and the minds, the scenes and the journal) load when the place ships
-- them, in load order; a level with a cast needs them all
local MODULES = { "js", "json", "stats", "bus", "store", "game", "rules", "nav", "mind", "group", "cast", "combat", "scenes", "quests", "level", "hud" }
local WHOLE = { rules = true, nav = true, mind = true, group = true, cast = true, combat = true, scenes = true, quests = true }
local kernelFolder = child(place:GetService("ReplicatedStorage"), { "MojuloKernel" })
local sources = {}
if not kernelFolder then
	problem("ReplicatedStorage.MojuloKernel is missing")
else
	for _, m in MODULES do
		local s = kernelFolder:FindFirstChild(m)
		if not s or s.ClassName ~= "ModuleScript" then
			if not WHOLE[m] then
				problem("MojuloKernel." .. m .. " is not a ModuleScript")
			end
		else
			sources[m] = s.Source
		end
	end
end
local whole = true
for m in WHOLE do
	whole = whole and sources[m] ~= nil
end
local server = child(place:GetService("ServerScriptService"), { "MojuloServer" })
if not server or server.ClassName ~= "Script" then
	problem("ServerScriptService.MojuloServer is not a Script")
end
local client = child(place:GetService("StarterPlayer"), { "StarterPlayerScripts", "MojuloClient" })
if not client or client.ClassName ~= "LocalScript" then
	problem("StarterPlayer.StarterPlayerScripts.MojuloClient is not a LocalScript")
end
local data = child(place:GetService("ServerStorage"), { "Mojulo" })
local manifestScript = data and data:FindFirstChild("manifest")
if not manifestScript or manifestScript.ClassName ~= "ModuleScript" then
	problem("ServerStorage.Mojulo.manifest is not a ModuleScript")
end

-- every script compiles
for name, s in { server = server, client = client, manifest = manifestScript } do
	if s then
		local ok, err = pcall(luau.compile, s.Source)
		if not ok then
			problem(name .. " does not compile: " .. tostring(err))
		end
	end
end

-- ── the kernel, loaded from the place's own source ───────────────────────────────────────────────────────────────
local K = {}
local loaded = kernelFolder ~= nil
for _, m in MODULES do
	if not sources[m] then
		if not WHOLE[m] then
			loaded = false
		end
		continue
	end
	local ok, chunk = pcall(luau.load, sources[m], { debugName = "MojuloKernel." .. m })
	if not ok then
		problem("MojuloKernel." .. m .. " does not load: " .. tostring(chunk))
		loaded = false
		continue
	end
	K[m] = m == "js" and chunk() or chunk()(K)
end

-- a whole level's frame: the bus's hash, then each other ruled body's pose in quanta (level-equivalence.js frameKey:
-- 5 cm, 0.05 rad, half up; its feet; a heading wrapped as JS wraps it)
local TAU = math.pi * 2
local function q(v, k)
	return string.format("%d", math.floor(v / k + 0.5))
end
local function castKey(L, ids, feet)
	local js = K.js
	local parts = { K.bus.hashState(L.bus) }
	for _, id in ipairs(ids) do
		local e = K.level.body(L, id)
		if e == nil then
			table.insert(parts, id .. ":none")
			continue
		end
		local up = js.finite(js.get(feet, id)) and feet[id] or 0
		table.insert(parts, string.format("%s:%s,%s,%s,%s", id, q(e.pos[1], 0.05), q(e.pos[2], 0.05), q(e.pos[3] - up, 0.05), q(math.fmod(math.fmod(e.heading or 0, TAU) + TAU, TAU), 0.05)))
	end
	return table.concat(parts, "|")
end

local levels = {}
if loaded and manifestScript then
	local js, json = K.js, K.json
	local manifest = json.decode(luau.load(manifestScript.Source)())
	local tracks = json.decode(fs.readFile(tracksPath))
	local folder = data:FindFirstChild("Levels")
	for _, spec in ipairs(manifest.levels) do
		local lv = folder and folder:FindFirstChild(spec.ref)
		local mod = lv and lv:FindFirstChild("data")
		local box = lv and lv:FindFirstChild("Greybox")
		if not mod or mod.ClassName ~= "ModuleScript" then
			problem("Levels." .. spec.ref .. ".data is not a ModuleScript")
			continue
		end
		if not box or box.ClassName ~= "Model" then
			problem("Levels." .. spec.ref .. ".Greybox is not a Model")
		else
			local parts = 0
			for _, p in box:GetChildren() do
				if p.ClassName == "Part" and p.Anchored then
					parts += 1
				end
			end
			if parts == 0 then
				problem("Levels." .. spec.ref .. ".Greybox has no anchored Part")
			end
			-- the look is decoration: nothing collides with it, no ray meets it, nothing touches it, so it cannot move where
			-- anyone stands (roblox-look.js)
			local look = box:FindFirstChild("Look")
			if look then
				local felt = 0
				for _, p in look:GetChildren() do
					if p.ClassName ~= "Part" or not p.Anchored or p.CanCollide or p.CanQuery or p.CanTouch then
						felt += 1
					end
				end
				if felt > 0 then
					problem("Levels." .. spec.ref .. ".Greybox.Look has " .. felt .. " part(s) a body or a ray can meet")
				end
			end
		end
		local raw = luau.load(mod.Source)()
		local level = json.decode(raw.level)
		if not js.isObj(js.get(level, "pilot")) then
			problem("Levels." .. spec.ref .. " has no pilot: nothing walks it")
		end
		local track = tracks[spec.ref]
		if not track then
			continue
		end
		local bus = raw.bus and json.decode(raw.bus) or nil
		local params = js.isObj(js.get(track, "params")) and track.params or js.obj()
		if js.truthy(js.get(track, "cast")) then
			if not whole then
				problem("Levels." .. spec.ref .. " has a cast, and the place's kernel does not ship the whole level (cast, combat, mind, nav, group, rules, scenes, quests)")
				continue
			end
			local L = K.level.fromBus(bus, raw.contract and json.decode(raw.contract) or js.obj(), params, { ground = track.ground })
			local lines = js.arr()
			for _, f in ipairs(track.frames) do
				local p = f.pilot
				local walkers = js.arr({ js.obj({ id = p.id, transform = js.obj({ pos = js.arr({ p.pos[1], p.pos[2], p.pos[3] }) }), heading = p.heading, pitch = p.pitch, grounded = p.grounded }) })
				K.level.step(L, walkers, js.dup(js.isArr(js.get(f, "events")) and f.events or js.arr()), f.dt, js.dup(f.input))
				table.insert(lines, castKey(L, track.ids, track.feet))
			end
			levels[spec.ref] = lines
			continue
		end
		local L = K.level.fromBus(bus, raw.contract and json.decode(raw.contract) or js.obj(), params)
		local lines = js.arr()
		for _, f in ipairs(track.frames) do
			local r = K.level.step(L, js.dup(f.walkers), js.dup(js.isArr(js.get(f, "events")) and f.events or js.arr()), js.truthy(js.get(f, "dt")) and f.dt or 0)
			local ctrl = js.obj({ ops = r.ops, warps = r.warps })
			local channel = js.obj({ door = K.game.door(L.channel) or js.NULL, envelope = K.game.envelope(L.channel, L.bus.vars) or js.NULL })
			table.insert(lines, K.bus.hashState(L.bus) .. "|" .. js.json(ctrl) .. "|" .. js.json(channel))
		end
		levels[spec.ref] = lines
	end
end

if K.json then
	local js, json = K.js, K.json
	local o = js.obj({ problems = js.arr(problems), kernel = js.obj(sources), levels = js.obj(levels) })
	fs.writeFile(outPath, json.encode(o))
else
	fs.writeFile(outPath, '{"problems":["the kernel did not load"],"kernel":{},"levels":{}}')
end
