-- The Roblox export's place gate, run under Lune (scripts/export-roblox.mjs). Opens the place Rojo built, checks its
-- tree (the kernel's modules, the server and client scripts, each level's data and greybox), compiles every script,
-- and plays each level FROM THE PLACE: its kernel loaded from the ModuleScripts' own source, its bus.json and
-- contract.json decoded from its data module, stepped over the track the web recorded for that level. Writes what it
-- found; the web side compares the frames.
--
--   lune run place-check.luau <place.rbxl> <tracks.json> <out.json>
--   tracks.json: { [level ref]: { frames: [{ walkers, events?, dt }], params? } }
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
local MODULES = { "js", "json", "stats", "bus", "store", "game", "level", "hud" }
local kernelFolder = child(place:GetService("ReplicatedStorage"), { "MojuloKernel" })
local sources = {}
if not kernelFolder then
	problem("ReplicatedStorage.MojuloKernel is missing")
else
	for _, m in MODULES do
		local s = kernelFolder:FindFirstChild(m)
		if not s or s.ClassName ~= "ModuleScript" then
			problem("MojuloKernel." .. m .. " is not a ModuleScript")
		else
			sources[m] = s.Source
		end
	end
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
		loaded = false
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
		local L = K.level.fromBus(raw.bus and json.decode(raw.bus) or nil, raw.contract and json.decode(raw.contract) or js.obj(), js.isObj(js.get(track, "params")) and track.params or js.obj())
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
