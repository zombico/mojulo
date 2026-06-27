# FPV gait-camera — the camera rides a walking skull

Status: planned (2026-06-21). Sibling to [`figure-world.plan.md`](./figure-world.plan.md).
Adds the first **camera auto-effect** to the World tier: a first-person view
whose head-bob / sway / gaze-hold is **derived from the figure rig's own walk
cycle**, not a hand-tuned sine wave. Two payoffs in one: it proves the generic
"camera auto-effect" capability, and it ties that effect to something real —
the same `gait()` that animates the figure body.

## Framing decision (operator, 2026-06-21)

The point is NOT "make the camera wobble." A `Math.sin(t)` bob is an afternoon
and proves nothing — it's a cosmetic decoration uncoupled from the world. The
point is that mojulo already has a **kinematically walking body** (`gait()` →
`articulate()` → balance/vault), and that body's head moves through a real
trajectory every stride: the pelvis vaults (inverted pendulum), the spine sways
laterally, the head counter-yaws to hold gaze level. **That trajectory IS the
head-bob.** Bolting the camera to it makes the auto-effect a readout of the rig,
the same way vexar lighting is a baked readout of the geometry rather than a
runtime fake.

Consequence: the effect is **baked, not synthesized**. Server-side we sample the
rig once into a tiny per-cycle offset curve; the browser just indexes that curve
by distance walked. No figure geometry ships to the client for the camera to
work — same philosophy as the baked, camera-independent lighting model.

## The gap

The walk controller in [`scene-three.js`](../scene-three.js) (`walkModeScript`,
~L692–827) is deliberately **"pure control, no collision/gravity/wobble"** in
FLY and "gravity + walls" in WALK — but in both modes the eye is rigid. WALK
pins the camera to `ground + walkEye` and points it down `walkLookDir()`
(L809–826); there is no vertical bob, no lateral sway, no roll. There is also no
auto-effect layer anywhere in the renderer — preset cameras snap, the turntable
spins the *scene*, motion bakes camera per-frame server-side. A procedural
camera modulation has no home yet.

Meanwhile `gait()` ([`figure-posing.js`](./figure-posing.js) L296–371) produces
a full per-phase `dof`, and the figure path turns that into world-space joints
through `articulate()` + the vault in [`figure-balance.js`](./figure-balance.js).
That head trajectory is computed and then only ever used to draw a body. The
camera never sees it.

## The seam

The walk loop already owns a **base camera pose** each frame:

```
stepWalk(dt):                      // scene-three.js L792
  WALK mode → camera.position {x,y} from WASD, .z pinned to ground+walkEye
            → camera.lookAt(position + walkLookDir(yaw,pitch))
```

The gait-camera is an **offset applied on top of that base pose**, indexed by a
phase that advances with distance travelled (so the bob stops when you stop —
the defining feel of real head-bob):

```
basePos, baseYaw, basePitch  = (what stepWalk computes today)
phase += horizontalSpeed * dt / strideDistance        // distance-driven, not wall-clock
o = BOB[phaseToIndex(phase)]                           // baked per-cycle offset sample
camera.position += eyeUp*o.dz + eyeRight*o.dx          // vertical bob + lateral sway
camera.lookAt(... )  with  yaw+=o.yaw, pitch+=o.pitch  // gaze counter-hold + nod
camera roll = o.roll                                   // skull list (optional)
```

`BOB` is the **baked curve**: server-side, sample one stride of the rig and
record the head pose **relative to a stride-averaged datum**, so only the
*wobble signature* survives (the net forward locomotion already comes from the
WASD controller — `gait()` itself "stays in place," the planted foot treadmills
backward, so head XY barely translates; what's left is exactly bob+sway+yaw).

### Extracting the head trajectory (the one thing to confirm in the spike)

The vertical bob's dominant source is the **vault** (pelvis re-seats to keep the
planted foot on the floor), which lives in `figure-balance.js` (`groundVault`),
NOT in `articulate()` alone. So the curve must be sampled through the **same
balance pipeline the figure render uses** ([`figure-render.js`](./figure-render.js)
`buildPosedFigure`), or the camera bob won't match what the body would actually
do. Open question for the spike: does that pipeline expose head/pelvis **joint
positions** (ideal: read `headBase` = the atlas/eye pivot, and `pelvisHub` for
the datum), or do we recover the head pose from the head ring-stack centroid +
orientation? Confirm before building the emitter. Eye height should be
`headBase`-derived, not `headTop` (the apex sits above the eyes).

## Plan

### 1. Bake the curve — `gaitCameraCurve(params, samples = 32)`

New helper (sibling to `gait`, likely in `figure-posing.js` or a small
`gait-camera.js`). For `phase` in `[0,1)`:

- `dof = gait(params)(phase)`
- pose the rig through the **balance/vault** path; read `headBase` + `pelvisHub`
- accumulate, then subtract the per-cycle mean → relative `{dz, dx, yaw, pitch, roll}`

Returns a compact `Float32` table (32 × 5 ≈ 160 floats) + `strideDistance`
(`strideLength`, the WALK-unit ground travel per cycle) so the browser can
convert distance→phase. Tiny enough to inline as JSON. Expose intensity via the
gait dials that already exist — `hipSway`, `headLevel`, `pelvisRot`, `vault` —
plus a single `bobScale` multiplier on the whole curve for taste.

### 2. Wire the curve into `walkModeScript`

In [`scene-three.js`](../scene-three.js):

- accept `walk.bob = { curve, strideDistance, bobScale }` on the `emitThreeWorld`
  walk config (default **off** — no curve, identical to today's rigid eye).
- add a distance accumulator in `stepWalk` WALK branch: after `walkSlide`,
  advance `bobPhase` by `(horizontal distance moved this frame) / strideDistance`.
- after the floor-snap (L822–824) and before `camera.lookAt` (L825), sample the
  curve at `bobPhase` and apply the offset to position (vertical along world +Z,
  lateral along the `right` vector already computed at L811) and to `walkYaw` /
  `walkPitch`. Roll, if used, needs a `camera.up` tilt (the controller currently
  leaves `up = +Z`); gate roll behind a flag since it's the most nausea-prone.
- **decay to rest when stopped**: when `v.lengthSq() === 0`, ease `bobPhase`'s
  applied amplitude toward 0 so a standing camera settles (don't freeze
  mid-bob). A simple amplitude lerp on the sampled offset covers it.

This is a pure addition to the existing per-frame seam (`setAnimationLoop →
stepWalk(dt)`, L1248); orbit and fly are untouched.

### 3. Mint surface

The capability is two layers, ship them in order:

- **Layer 1 — generic auto-effect (proves the capability).** A `bob: true`
  (or `bob: { profile, scale }`) option on the World walk config, available to
  any walk-enabled World (room, house, city, hub, terrain). The bob curve is the
  rig's, but the rendered scene is whatever world you're traversing — the camera
  is a disembodied FPV walker. This alone is the "camera auto-effect capability"
  proof. Default off; opt-in per artifact.
- **Layer 2 — tie it to something real (the demo).** Once `figure-world.plan.md`
  step 3 lands (a figure rendered live in the World tier), drive **both** the
  rendered figure body AND the FPV camera from the *same* `gait(params)` call,
  and add a **1st/3rd-person toggle**: orbit the walking body, then jump inside
  its head and feel the exact same stride. Same params, two consumers — that is
  the coupling that makes the effect "real," not decorative.

Lean toward Layer 1 first (no dependency on the figure-world wire-up; it ships
the moment the curve + `stepWalk` patch land), then Layer 2 when the body is in
the viewport.

## Spike-first checkpoint

Before any wire-up, prove the curve is the dominant motivator of a believable
bob: bake `gaitCameraCurve(WALK_DEFAULTS)`, dump the 32-sample table, and sanity
-check the signature against the known gait — `dz` should be ~2× stride
frequency (the pelvis vaults once per step, twice per cycle), lateral `dx` and
`yaw` should be at the stride frequency and roughly antiphase (gaze counter-holds
the sway). If those relationships hold, the rig→camera readout is sound and steps
1–3 are productizing. If the head-position extraction needs the ring-stack
centroid fallback (see "Extracting the head trajectory"), that surfaces here.

WebGL can't be screenshotted from the agent harness (same constraint as
figure-world), so validate the *curve* numerically in the spike test and validate
the *applied feel* by hand in a browser on the generated page.

## Spike result (2026-06-21)

Built step 1 (`gait-camera.js` `gaitCameraCurve`) and validated via
`gait-camera.spike.test.js` (6 assertions, all pass — run on demand, it's a
`*.spike.test.js` excluded from the default vitest run; use an in-tree config
whose `exclude` drops the spike pattern, since the CLI `--exclude` only *appends*
to the config exclude and `--config ''` is broken in vitest 4).

**The open question is resolved: head joint positions ARE exposed.**
`articulate(dof)` → `groundVault(full, { plant: dof.plant })` is the exact balance
branch `buildPosedFigure` uses for a walk, and it returns `headBase` / `pelvisHub`
as `{x,y,z}` joints. No ring-stack centroid fallback needed. (Gaze *yaw* is the one
exception — it's an axial rotation invisible in the near-vertical headBase→headTop
segment, so it's read from the dof's `head.yaw` + `neck.yaw` gaze terms; bob/sway/
pitch/roll are all geometric.)

**The signature is textbook** (32-sample bake of `WALK_DEFAULTS`):
- `dz` (vertical bob) harmonics [k1,k2,k3] = `[0, 0.0112, 0]` — a *pure* 2nd
  harmonic: the pelvis vaults once per step → twice per stride. ✓
- `dx` (lateral sway) harmonics = `[0.0417, 0, 0.0126]` — dominant fundamental
  (lists toward one foot then the other, once per stride). ✓
- gaze `yaw` vs lateral `dx` correlation = **−0.957** — the head yaws opposite the
  sway to hold the gaze level (the counter-hold). ✓
- killing the rig's bob dials (`vault:false, hipSway:0, headLevel:0, pelvisRot:0…`)
  collapses the curve to ~0 — the effect is genuinely rig-driven, not a constant. ✓

**Finding that changes step 2 — the raw amplitudes are too large for a 1:1 camera
mount.** Peak-to-peak over one stride: lateral sway `dx` ≈ **0.223 STAND** (~24% of
the figure's ~0.91-STAND height — this is the body's *full* COM weight-shift over
each planted foot), vertical bob `dz` ≈ **0.046 STAND** (~5% of height, ~9cm on a
1.8m person), gaze `yaw` ≈ 14° (= 2×`headLevel`). Mounted 1:1 the camera reads as a
drunken stagger — a real head doesn't travel that far because the neck + vestibular
system damp it, which the rig (faithfully carrying the whole body) does not model.

So step 2 must apply **per-channel attenuation**, not one `bobScale`: separate
`swayScale` (heavily reduced — try ~0.15–0.3 of the raw lateral), `bobScale`
(~0.4–0.6), and a `yawScale`/`pitchScale`. Default the FPV "intensity" preset to a
damped blend, not the raw curve. This is required for comfort, not polish.

## Out of scope (revisit only if the goal changes)

- Footstep audio / screen-shake / motion-blur — the bob is a camera transform,
  not a post-effect stack.
- Per-surface gait switching (sand vs stairs vs run) — one walk curve first;
  `SPRINT_DEFAULTS` already exists and slots into the same `gaitCameraCurve`
  later for a run-cam.
- Collision-aware head dip (ducking under a low beam) — the WALK controller's
  wall rays could feed it, but that's a separate ergonomic feature.
- VR / stereo camera — orthogonal; the bob curve would compose with it unchanged.
