-- mojulo — the place's server: plays the game's levels in order, one player driving. The kernel (ReplicatedStorage.
-- MojuloKernel) is the web runtime's bus, stats, store and game channel ported to Luau and held equal to it by the
-- conformance corpora; this script is only the presenter: it reports where the player stands, applies the warps the
-- bus hands back, and finishes a level by its outcome. A Roblox Humanoid walks the player (the web's walk feel is not
-- ported), so a level is equal to the web in what it DOES with where the player stands, not in how the player moves.
--
-- Frames: the recipe is z-up in metres (its bus in recipe units, metersPerUnit apart); Roblox is y-up in studs.
--   Roblox (X, Y, Z) = (x, z, -y) × STUDS   (a proper rotation: +y north is -Z, Roblox's forward)
-- Only the first player to join drives; set Max Players to 1 in Game Settings (a script cannot).

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerStorage = game:GetService("ServerStorage")

local STUDS = 1 / 0.28          -- studs per metre (Roblox's own: a stud is 0.28 m)
local DT = 1 / 30               -- the web's fixed step: the bus's timers and sagas run on it
local MAX_STEPS = 4             -- a slow frame catches up at most this many steps, then lets the rest go

local KERNEL = ReplicatedStorage:WaitForChild("MojuloKernel")
local K = {}
K.js = require(KERNEL:WaitForChild("js"))
for _, name in { "json", "stats", "bus", "store", "game", "level", "hud" } do
	K[name] = require(KERNEL:WaitForChild(name))(K)
end
local js, json = K.js, K.json
local arr, obj, get, truthy = js.arr, js.obj, js.get, js.truthy

local DATA = ServerStorage:WaitForChild("Mojulo")
local MANIFEST = json.decode(require(DATA:WaitForChild("manifest")))
local LEVELS = DATA:WaitForChild("Levels")
local schema = js.isObj(get(MANIFEST, "store")) and js.isArr(get(MANIFEST.store, "slices")) and #MANIFEST.store.slices > 0 and MANIFEST.store or nil
local state = schema and K.store.createStore(schema) or nil

local remotes = Instance.new("Folder")
remotes.Name = "MojuloRemotes"
local keyRemote = Instance.new("RemoteEvent")
keyRemote.Name = "Key"
keyRemote.Parent = remotes
local sayRemote = Instance.new("RemoteEvent")
sayRemote.Name = "Say"
sayRemote.Parent = remotes
local hudRemote = Instance.new("RemoteEvent")
hudRemote.Name = "Hud"
hudRemote.Parent = remotes
remotes.Parent = ReplicatedStorage

-- ── the frames ───────────────────────────────────────────────────────────────────────────────────────────────────
local mpu = 1
local function toWorld(p): Vector3   -- recipe units → studs
	local m = mpu * STUDS
	return Vector3.new(p[1] * m, p[3] * m, -p[2] * m)
end
local function toRecipe(v: Vector3)  -- studs → recipe units
	local m = mpu * STUDS
	return arr({ v.X / m, -v.Z / m, v.Y / m })
end
local function forward(heading: number): Vector3
	return Vector3.new(math.cos(heading), 0, -math.sin(heading))
end

-- ── the level under way ──────────────────────────────────────────────────────────────────────────────────────────
local player: Player? = nil
local at = 0                    -- the level's place in the manifest's list
local spec, data, L = nil, nil, nil
local accum, pending, finished, doorSaid = 0, {}, false, false
local H, clock, shownHud = nil, 0, nil
local markers = {}               -- bus entity id → its Part

-- the bus's own entities drawn as the page draws them: a sphere of its radius and colour where the bus puts it, shown
-- while it is on (a pickup taken goes; a spawn appears)
local MARKER = Color3.fromRGB(255, 215, 0)
local function syncMarkers()
	local box = workspace:FindFirstChild("MojuloLevel")
	if not box then
		return
	end
	for _, e in ipairs(L.bus.entities) do
		local id = js.str(e.id)
		local m = markers[id]
		if not m then
			m = Instance.new("Part")
			m.Name = "marker-" .. id
			m.Shape = Enum.PartType.Ball
			m.Anchored = true
			m.CanCollide = false
			m.CanQuery = false
			m.Material = Enum.Material.Neon
			local r = js.finite(get(e, "radius")) and e.radius or 0.4
			m.Size = Vector3.one * (2 * r * mpu * STUDS)
			local ok, c = pcall(Color3.fromHex, type(get(e, "color")) == "string" and e.color or "")
			m.Color = ok and c or MARKER
			m.Parent = box
			markers[id] = m
		end
		m.Position = toWorld(e.position)
		m.Transparency = e.on == false and 1 or 0
	end
end

local function rule()
	return (data and js.isObj(get(data.level, "pilot")) and js.isObj(get(data.level.pilot, "rule"))) and data.level.pilot.rule or obj()
end
local function eye(): number
	local e = get(rule(), "eye")
	return js.finite(e) and e or 0
end

-- the character's feet, from its root part (an R15 root stands its hip height and half its own height above them)
local function feetOf(character: Model): Vector3?
	local hrp = character:FindFirstChild("HumanoidRootPart") :: BasePart?
	local hum = character:FindFirstChildOfClass("Humanoid")
	if not hrp or not hum then
		return nil
	end
	return hrp.Position - Vector3.new(0, hum.HipHeight + hrp.Size.Y / 2, 0)
end

-- stand the character with its feet at p (recipe units), facing heading
local function stand(character: Model, p, heading: number)
	local hrp = character:WaitForChild("HumanoidRootPart") :: BasePart
	local hum = character:WaitForChild("Humanoid") :: Humanoid
	local feet = toWorld(p) + Vector3.new(0, 0.05 * STUDS, 0)
	local root = feet + Vector3.new(0, hum.HipHeight + hrp.Size.Y / 2, 0)
	character:PivotTo(CFrame.lookAt(root, root + forward(heading)))
	hrp.AssemblyLinearVelocity = Vector3.zero
end

-- the pilot's rule as a Humanoid: its pace, its jump (a walk rule does not jump), the world's pull
local function fit(character: Model)
	local hum = character:WaitForChild("Humanoid") :: Humanoid
	local r = rule()
	local m = mpu * STUDS
	local speed = get(r, "speed")
	hum.WalkSpeed = (js.finite(speed) and speed or 6) * m
	hum.UseJumpPower = true
	local jump = get(r, "jumpSpeed")
	hum.JumpPower = get(r, "type") == "platform" and (js.finite(jump) and jump or 8.5) * m or 0
	local g = get(r, "gravity")
	workspace.Gravity = (js.finite(g) and g or 20) * m
	-- the page's eye camera, or a follow camera pulled in to the eye: first person
	local cam = get(data.level, "camera")
	local dist = js.isObj(cam) and get(cam, "dist") or nil
	local first = js.isObj(cam) and (cam.rule == "eye" or (cam.rule == "follow" and js.finite(dist) and dist < 1))
	if player then
		player.CameraMode = first and Enum.CameraMode.LockFirstPerson or Enum.CameraMode.Classic
	end
end

local function place(character: Model)
	if not data then
		return
	end
	fit(character)
	local pilot = data.level.pilot
	local entry = K.game.entry(L.channel)
	if entry then
		stand(character, entry.spawn, js.finite(get(entry, "heading")) and entry.heading or 0)
	elseif js.isObj(pilot) then
		stand(character, pilot.pos, js.finite(get(pilot, "heading")) and pilot.heading or 0)
	end
end

local function say(text: string)
	if player then
		sayRemote:FireClient(player, text)
	end
	print("mojulo: " .. text)
end

local function startLevel(i: number, params)
	at = i
	spec = MANIFEST.levels[i]
	local folder = LEVELS:WaitForChild(spec.ref)
	local raw = require(folder:WaitForChild("data"))
	data = {
		level = json.decode(raw.level),
		bus = raw.bus and json.decode(raw.bus) or nil,
		contract = raw.contract and json.decode(raw.contract) or obj(),
	}
	mpu = js.finite(get(data.level, "metersPerUnit")) and data.level.metersPerUnit or 1
	local old = workspace:FindFirstChild("MojuloLevel")
	if old then
		old:Destroy()
	end
	local box = folder:WaitForChild("Greybox"):Clone()
	box.Name = "MojuloLevel"
	box.Parent = workspace
	-- the session the level starts with: the slices its contract consumes, as the web shell hands them over
	local session = params or obj()
	if state then
		for _, s in ipairs(js.isArr(get(data.contract, "consumes")) and data.contract.consumes or {}) do
			session[s] = js.dup(state[s])
		end
	end
	L = K.level.fromBus(data.bus, data.contract, session)
	accum, pending, finished, doorSaid = 0, {}, false, false
	H, clock, shownHud = K.hud.create(get(data.level, "hud")), 0, nil
	markers = {}
	if player and player.Character then
		place(player.Character)
	end
	say(spec.title or spec.ref)
end

-- the first level after `from` whose gate is open (a level with no gate always is), or nil
local function nextLevel(from: number): number?
	for i = from + 1, #MANIFEST.levels do
		local g = get(MANIFEST.levels[i], "gate")
		if not truthy(g) or not schema or K.store.evalGate(schema, state, g) then
			return i
		end
	end
	return nil
end

-- the one write per level: the envelope against the level's contract, the level recorded beaten on success
local function finish(env)
	finished = true
	env.contractVersion = K.store.CONTRACT_VERSION
	env.levelRef = spec.ref
	env.seed = 1
	local success = env.result == "success"
	if schema then
		local r = K.store.applyOutcome(schema, state, data.contract, env)
		if not r.ok then
			warn("mojulo: outcome rejected (store untouched): " .. table.concat(r.errors, "; "))
		else
			state = r.state
			if success then
				for _, sl in ipairs(schema.slices) do
					if sl.kind == "progression" then
						local pr = K.store.applyEvents(schema, state, arr({ obj({ type = "promote", slice = sl.name, ref = spec.ref, result = "success" }) }))
						if pr.ok then
							state = pr.state
						end
						break
					end
				end
			end
		end
	end
	local kept = js.isObj(get(env, "stats")) and get(env.stats, "kept") or nil
	local line = success and "level complete" or ("level " .. js.str(env.result))
	for _, k in ipairs(js.isArr(kept) and kept or {}) do
		line ..= " · " .. js.str(k.label) .. " " .. js.str(k.value) .. (truthy(get(k, "unit")) and js.str(k.unit) or "")
	end
	say(line)
	task.delay(3, function()
		if not success then
			startLevel(at, nil)
			return
		end
		local n = nextLevel(at)
		if n then
			startLevel(n, nil)
		else
			say("game complete")
			task.delay(3, function()
				startLevel(1, nil)
			end)
		end
	end)
end

-- one step of the level: where the bodies stand → the kernel → the warps applied → the outcome heard
local function step()
	if not L or finished then
		return
	end
	local walkers = arr()
	local pilot = data.level.pilot
	local character = player and player.Character
	local feet = character and feetOf(character)
	if js.isObj(pilot) and feet then
		local p = toRecipe(feet)
		p[3] += eye()
		table.insert(walkers, obj({ id = pilot.id, transform = obj({ pos = p }) }))
	end
	-- the level's other bodies stand where the recipe put them (their own rules do not run here yet)
	for _, e in ipairs(js.isArr(get(data.level, "entities")) and data.level.entities or {}) do
		if not js.isObj(pilot) or e.id ~= pilot.id then
			table.insert(walkers, obj({ id = e.id, transform = obj({ pos = js.copy(e.pos) }) }))
		end
	end
	local extra = arr()
	for _, ev in ipairs(pending) do
		table.insert(extra, ev)
	end
	pending = {}
	local n0 = #L.bus.log
	local r = K.level.step(L, walkers, extra, DT)
	clock += DT
	syncMarkers()
	-- the HUD as words: the readouts when they change, each banner and toast as it fires
	if player then
		local lines = K.hud.lines(H, L.bus.vars, clock)
		local parts = {}
		for _, l in ipairs(lines) do
			table.insert(parts, l.slot .. "\0" .. l.text)
		end
		local key = table.concat(parts, "\1")
		if key ~= shownHud then
			shownHud = key
			hudRemote:FireClient(player, "lines", lines)
		end
		for _, mo in ipairs(K.hud.moments(H, L.bus.log, n0, L.bus.vars)) do
			hudRemote:FireClient(player, "moment", mo)
		end
	end
	if js.isObj(pilot) and character then
		local to = r.warps[pilot.id]
		if to then
			stand(character, arr({ to[1], to[2], to[3] }), js.finite(get(pilot, "heading")) and pilot.heading or 0)
		end
	end
	local door = K.game.door(L.channel)
	if door and not doorSaid then
		doorSaid = true
		say("the door '" .. js.str(door.door) .. "' leads to a level this place does not link yet")
	end
	local env = K.game.envelope(L.channel, L.bus.vars)
	if env then
		finish(env)
	end
end

RunService.Heartbeat:Connect(function(dt: number)
	accum += dt
	local n = 0
	while accum >= DT and n < MAX_STEPS do
		step()
		accum -= DT
		n += 1
	end
	if n == MAX_STEPS then
		accum = 0
	end
end)

keyRemote.OnServerEvent:Connect(function(who: Player, key)
	if who ~= player or type(key) ~= "string" or #key > 16 or not L then
		return
	end
	for _, ev in ipairs(K.level.keyEvents(L, key)) do
		table.insert(pending, ev)
	end
end)

local function joined(p: Player)
	if player then
		return   -- one player drives; the rest look on
	end
	player = p
	p.CharacterAdded:Connect(function(character)
		place(character)
	end)
	if p.Character then
		place(p.Character)
	end
end
Players.PlayerAdded:Connect(joined)
for _, p in ipairs(Players:GetPlayers()) do
	joined(p)
end
Players.PlayerRemoving:Connect(function(p)
	if p == player then
		player = nil
	end
end)

startLevel(1, nil)
