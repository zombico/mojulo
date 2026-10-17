-- mojulo — the place's server: plays the game's levels in order, one player driving. The kernel (ReplicatedStorage.
-- MojuloKernel) is the web runtime's bus, stats, store and game channel ported to Luau and held equal to it by the
-- conformance corpora; this script is only the presenter: it reports where the player stands, applies the warps the
-- bus hands back, draws the level's characters where the kernel's cast puts them, and finishes a level by its outcome.
-- A Roblox Humanoid walks the player (the web's walk feel is not ported), so a level is equal to the web in what it
-- DOES with where the player stands, not in how the player moves: the pilot is the kernel's input (the levelcast
-- corpus feeds it the same way), and the cast, the fight, the minds and the scenes run in the kernel.
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
-- the whole level's modules (the cast, the fight and the minds, the scenes, the journal) when the place ships them; a
-- place without them plays its levels' bus alone
local WHOLE = { rules = true, nav = true, mind = true, group = true, cast = true, combat = true, scenes = true, quests = true }
for _, name in { "json", "stats", "bus", "store", "game", "rules", "nav", "mind", "group", "cast", "combat", "scenes", "quests", "level", "hud" } do
	local m
	if WHOLE[name] then
		m = KERNEL:FindFirstChild(name)
	else
		m = KERNEL:WaitForChild(name)
	end
	if m then
		K[name] = require(m)(K)
	end
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
local fireRemote = Instance.new("RemoteEvent")   -- the left mouse button held (true) or let go (false): the fight's fire
fireRemote.Name = "Fire"
fireRemote.Parent = remotes
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
local bodies = {}                -- cast body id → its Part
local fireHeld = false           -- the client's left mouse button
local aiToggle = false           -- G pressed since the last step: the world switch (the minds stand down or wake)
local sceneCtl = {}              -- the frame's presses to a scene playing (Space / Enter / E, Esc, the arrows, 1-4)
local shownLine = nil            -- the scene's line last sent

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

-- the level's characters as the kernel's cast puts them: an anchored box each, sized from its body (bus.json's
-- combat egg or radius, the cast row's feet), else about 1.7 m tall; hidden when sent away, tinted and laid down when
-- felled. The pilot is the player's own character.
local DOWNED = Color3.fromRGB(120, 60, 60)
local function bodySize(id: string): (number, number)
	local cb = data and data.bus and get(data.bus, "combat")
	local b = js.isObj(cb) and js.isObj(get(cb, "bodies")) and get(cb.bodies, id) or nil
	local egg = js.isObj(b) and get(b, "egg") or nil
	if js.isObj(egg) and js.finite(get(egg, "a")) and js.finite(get(egg, "c")) then
		return 2 * egg.a, 2 * egg.c
	end
	local e = K.level.body(L, id)
	local foot = e and js.finite(e.foot) and e.foot or 0
	local r = js.isObj(b) and js.finite(get(b, "radius")) and b.radius or 0.3
	return 2 * r, foot > 0.3 and 2 * foot or 1.7
end
local function syncCast(list)
	local box = workspace:FindFirstChild("MojuloLevel")
	if not box or not list then
		return
	end
	local pilot = data and get(data.level, "pilot")
	local m = mpu * STUDS
	for _, e in ipairs(list) do
		if js.isObj(pilot) and e.id == pilot.id then
			continue
		end
		local part = bodies[e.id]
		local w, h = bodySize(e.id)
		if not part then
			part = Instance.new("Part")
			part.Name = "cast-" .. e.id
			part.Anchored = true
			part.CanCollide = false
			part.CanQuery = false
			part.Material = Enum.Material.SmoothPlastic
			part.Size = Vector3.new(w * m, h * m, w * m)
			part.Color = Color3.fromRGB(214, 140, 64)
			part:SetAttribute("color", part.Color)
			part.Parent = box
			bodies[e.id] = part
		end
		local foot = js.finite(e.foot) and e.foot or 0
		local feet = toWorld({ e.pos[1], e.pos[2], e.pos[3] - foot })
		if e.downed then
			-- felled: lying along its heading, its middle a half-width off the ground
			local c = feet + Vector3.new(0, w * m / 2, 0)
			part.CFrame = CFrame.lookAt(c, c + forward(e.heading or 0)) * CFrame.Angles(math.pi / 2, 0, 0)
			part.Color = DOWNED
		else
			local c = feet + Vector3.new(0, h * m / 2, 0)
			part.CFrame = CFrame.lookAt(c, c + forward(e.heading or 0))
			part.Color = part:GetAttribute("color") or part.Color
		end
		part.Transparency = e.gone and 1 or 0
	end
end

-- the land a mind stands on: the nearest surface straight down from pos + 5 cm (recipe units), the level's own parts
-- only (the player and the cast are not ground)
local function groundAt(p)
	local box = workspace:FindFirstChild("MojuloLevel")
	if not box then
		return nil
	end
	local params = RaycastParams.new()
	params.FilterType = Enum.RaycastFilterType.Exclude
	local skip = {}
	for _, part in bodies do
		table.insert(skip, part)
	end
	for _, part in markers do
		table.insert(skip, part)
	end
	if player and player.Character then
		table.insert(skip, player.Character)
	end
	params.FilterDescendantsInstances = skip
	local from = toWorld({ p[1], p[2], p[3] + 0.05 })
	local hit = workspace:Raycast(from, Vector3.new(0, -4096, 0), params)
	if not hit then
		return nil
	end
	return hit.Position.Y / (mpu * STUDS)
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
	local pilotId = js.isObj(get(data.level, "pilot")) and data.level.pilot.id or nil
	L = K.level.fromBus(data.bus, data.contract, session, { ground = groundAt, pilot = pilotId })
	accum, pending, finished, doorSaid = 0, {}, false, false
	H, clock, shownHud = K.hud.create(get(data.level, "hud")), 0, nil
	markers, bodies, sceneCtl, shownLine = {}, {}, {}, nil
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
	local hrp = character and character:FindFirstChild("HumanoidRootPart") :: BasePart?
	local hum = character and character:FindFirstChildOfClass("Humanoid")
	local heading = 0
	local input = obj()
	if js.isObj(pilot) and feet and hrp and hum then
		local p = toRecipe(feet)
		p[3] += eye()
		-- Roblox forward (cos h, 0, -sin h): the heading back in the recipe's frame
		local look = hrp.CFrame.LookVector
		heading = math.atan2(-look.Z, look.X)
		table.insert(walkers, obj({ id = pilot.id, transform = obj({ pos = p }), heading = heading, pitch = 0, grounded = hum.FloorMaterial ~= Enum.Material.Air }))
		-- the fight's input as the page's keys give it: the move along and across the facing, the mouse's fire
		local mv = hum.MoveDirection
		input = obj({ forward = mv:Dot(forward(heading)), strafe = mv:Dot(Vector3.new(math.sin(heading), 0, math.cos(heading))), turn = 0, fire = fireHeld })
	end
	input.scene = sceneCtl
	input.aiToggle = aiToggle
	sceneCtl, aiToggle = {}, false
	-- a level without a cast: its other bodies stand where the recipe put them (the cast's own are the kernel's)
	if not L.cast then
		for _, e in ipairs(js.isArr(get(data.level, "entities")) and data.level.entities or {}) do
			if not js.isObj(pilot) or e.id ~= pilot.id then
				table.insert(walkers, obj({ id = e.id, transform = obj({ pos = js.copy(e.pos) }) }))
			end
		end
	end
	local extra = arr()
	for _, ev in ipairs(pending) do
		table.insert(extra, ev)
	end
	pending = {}
	local n0 = #L.bus.log
	local r = K.level.step(L, walkers, extra, DT, input)
	clock += DT
	syncMarkers()
	syncCast(r.cast)
	-- a swing roots the body, as the web's platform rule halts its drive while one runs
	local me = js.isObj(pilot) and K.level.body(L, pilot.id) or nil
	if hum and me then
		hum.WalkSpeed = me.swingT ~= nil and 0 or (js.finite(get(rule(), "speed")) and rule().speed or 6) * mpu * STUDS
	end
	-- the scene's text box, a line at a time (its speaker's name, the line as it types on); the journal's words
	if player and r.scene then
		local ln = get(r.scene, "line")
		local text = js.isObj(ln) and ((truthy(get(ln, "name")) and js.str(ln.name) .. ": " or "") .. js.str(get(ln, "text"))) or ""
		local ch = get(r.scene, "choice")
		if js.isObj(ch) then
			local opts = {}
			for i, o in ipairs(js.isArr(get(ch, "options")) and ch.options or {}) do
				table.insert(opts, (i - 1 == ch.sel and "> " or "") .. i .. " " .. js.str(o))
			end
			text ..= "   " .. table.concat(opts, "   ")
		end
		if text ~= shownLine then
			shownLine = text
			hudRemote:FireClient(player, "scene", text)
		end
	end
	for _, n in ipairs(r.quests or {}) do
		say((n.kind == "begun" and "new quest: " or n.kind == "done" and "quest complete: " or "done: ") .. js.str(n.name) .. (n.kind == "step" and truthy(get(n, "text")) and (" · " .. js.str(n.text)) or ""))
	end
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
	-- G flips the world switch, as the page's does: every mind stands down, or wakes
	if key == "g" then
		aiToggle = true
	end
	-- a scene's presses, as the page reads them: Space, Enter or E go on, Esc skips, the arrows (or W / S) move a
	-- choice, 1-4 pick one
	if L.scenes then
		if key == " " or key == "Enter" or key == "e" then
			sceneCtl.next = true
		elseif key == "Escape" then
			sceneCtl.skip = true
		elseif key == "ArrowUp" or key == "w" then
			sceneCtl.move = -1
		elseif key == "ArrowDown" or key == "s" then
			sceneCtl.move = 1
		elseif #key == 1 and key >= "1" and key <= "4" then
			sceneCtl.pick = tonumber(key) - 1
		end
	end
end)

fireRemote.OnServerEvent:Connect(function(who: Player, down)
	if who == player and type(down) == "boolean" then
		fireHeld = down
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
