-- The Roblox side of the rules conformance corpus (lib/graph/scene/rules-conformance.js), run under Lune: each
-- scenario's pilot stepped by kernel/rules.luau over its triangles and colliders with its held input, one canonical
-- snapshot a frame (and its camera's, when the scenario has one), printed as the web's snapshot prints it.
-- scripts/conformance.mjs --engine roblox --corpus rules copies this beside the kernel in a scratch folder, runs it and
-- compares.
--
--   lune run conformance.luau <corpus.json> <out.json>

local fs = require("@lune/fs")
local process = require("@lune/process")

local K = {}
K.js = require("./kernel/js")
for _, name in { "json", "bus", "rules" } do
	K[name] = require("./kernel/" .. name)(K)
end
local js, json, rules = K.js, K.json, K.rules
local arr, obj, get, NULL = js.arr, js.obj, js.get, js.NULL

-- the pose to 1e-9 (rules-conformance.js nano)
local function nano(x)
	return math.floor(x * 1e9 + 0.5) / 1e9
end
local function nanos(v)
	local out = arr()
	for i, x in ipairs(v) do
		out[i] = nano(x)
	end
	return out
end
local function orNull(v)
	if v == nil then
		return NULL
	end
	return v
end

local function snapshot(e, r)
	local s = obj({ pos = nanos(e.pos), heading = nano(e.heading), pitch = nano(e.pitch or 0), vz = nano(e.vel[3]),
		gait = nano(e.gaitPhase or 0), moving = js.truthy(e.moving) })
	local t = r.type
	if t == "platform" then
		s.grounded = js.truthy(e.grounded)
		s.coyote = nano(e.coyote or 0)
		s.buf = nano(e.jumpBuf or 0)
		s.wind = nano(e.jumpWind or 0)
		s.air = e.airJumpsUsed or 0
		s.loco = orNull(e.locomotion)
		s.jumped = js.truthy(e.jumped)
		s.landed = js.truthy(e.landed)
		s.boosting = js.truthy(e.boosting)
		s.boost = e.boost == nil and NULL or nano(e.boost)
		s.lock = js.truthy(e.boostLock)
	end
	if t == "drive" or t == "racer" then
		s.speed = nano(e.speed or 0)
		s.steer = nano(e.steerAngle or 0)
		s.cvz = nano(e.vz or 0)
		s.airborne = js.truthy(e.airborne)
		s.wheel = nano(e.wheelPhase or 0)
		s.braking = js.truthy(e.braking)
		s.skidding = js.truthy(get(r, "lateralGrip")) and NULL or js.truthy(e.skidding)
		s.lean = e.lean == nil and NULL or nano(e.lean)
	end
	if t == "racer" then
		s.lineAt = orNull(e.lineAt)
		s.laps = e.laps or 0
		s.stuckT = nano(e.stuckT or 0)
		s.backT = nano(e.backT or 0)
	end
	if t == "fly" then
		s.airspeed = nano(e.airspeed or 0)
		s.bank = nano(e.bank or 0)
		s.airborne = js.truthy(e.airborne)
		s.stalled = js.truthy(e.stalled)
		s.takeoff = js.truthy(e.takeoff)
		s.touchdown = js.truthy(e.touchdown)
		s.climb = nano(e.climbRate or 0)
		s.loco = orNull(e.locomotion)
		s.lever = e.lever == nil and NULL or nano(e.lever)
		s.boostE = e.boostE == nil and NULL or nano(e.boostE)
		s.boosting = e.boosting == true
		s.rolling = e.rolling == true
		s.oob = e.outOfBounds == true
		s.roll = nano(type(e.tilt) == "table" and (e.tilt.roll or 0) or 0)
	end
	return s
end

local function camSnap(c)
	local d = obj({ pos = nanos(c.pos), heading = nano(c.heading), pitch = nano(c.pitch or 0), lookAt = c.lookAt and nanos(c.lookAt) or NULL })
	if c.roll ~= nil then
		d.roll = nano(c.roll)
	end
	return d
end

local corpus = json.decode(fs.readFile(process.args[1]))
local results = obj()
for _, sc in ipairs(corpus) do
	local r = sc.rule
	local e = rules.entity(sc.pos, sc.heading)
	local world = { ground = rules.makeGround(sc.tris), colliders = sc.colliders }
	local camRule = js.isObj(get(sc, "camera")) and sc.camera or nil
	local cam = camRule and rules.camera(sc.cameraAt, 0.0) or nil
	local snaps = arr()
	for _, inp in ipairs(sc.input) do
		rules.step(e, r, inp, sc.dt, world)
		local snap = js.ss(snapshot(e, r))
		if cam then
			rules.cameraStep(cam, camRule, e, r, sc.dt, world, { hero = { pos = e.pos, heading = e.heading } }, "hero")
			snap ..= "|" .. js.ss(camSnap(cam))
		end
		table.insert(snaps, snap)
	end
	results[sc.id] = snaps
end
fs.writeFile(process.args[2], json.encode(results))
