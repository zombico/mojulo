# Flame: a lit match (research spike)

Branch: `1004-flame-depiction`, off `1004-wind-element`. The goal is to depict fire in mojulo's 3D, using what wind taught about air and motion. The first form is a lit match. Nothing registers a kind, channel, MCP tool, recipe field or exporter. Production code is only read: `vegetation/wind.js` `windField` is the air.

## What carries over from wind

- **One air field moves everything.** The page passes `windField(...).at` (read at its 2 m reference, so the breeze slider is the air at the flame) plus a breath to the kernel as `air(x, y, z, t)`. The flame, its sparks and its smoke are consumers with a flaccidity φ, the share of the air's push they take. They are born at 1, and φ = 0 is still air exactly: the flame stands straight up whatever blows.
- **Seekable where it can be.** The flame is a streakline: the burning gas leaves its base and rises on its own buoyancy while the air carries it sideways. The flame at time t is where the gas let go over the last ~50 ms is now. The sideways part is one running integral of the air the base saw, and the rise is in closed form, so `flameAt(t)` stores nothing and can be asked in any order. A gust bends the base first and the tip after, and a flicker travels up the flame. The sparks are analytic too: linear drag in the air at launch.
- **Stepped only what has a history**, at a fixed 240 Hz tick: the burn (the char front, the flame's growth, going out) and the smoke (Lagrangian threads at 120 Hz), as wind's debris was stepped.

## The match

A safety-match splint (aspen, 2.1 mm square, 47 mm) with a 5.8 mm head, held in a clip. s runs along the stick from the tip of the head.

| stage | what happens | where it comes from |
|---|---|---|
| strike | the head deflagrates: a flame about 1.7× the steady size, whiter and rounder, sputtering, throwing a dozen or so sparks and a faint white puff (potassium chloride) | `stageOf` (the flare), `makeSparks`, smoke kind 0 |
| head | the sulfur and wax burn (bluer); the flame settles; the head chars through by 1.4 s | `stageOf` (blue), the front crosses the head |
| wood | a laminar diffusion flame on the wood pyrolysing behind the char front. The front creeps at a rate set by how much of the flame's heat reaches unburnt wood: about 4.8 mm/s held 60° head down, 1.2 level, starving head up (it goes out). Air toward the unburnt wood speeds it. The flame grows with the burning rate (Roper: flame height ∝ fuel flow). | `woodRate`, `S.L` |
| out | blown (the air at the base passes a blow-off speed that grows with the flame: about 3 m/s for the steady flame, more while the head's oxidiser burns), starved, or burnt (the front reaches the clip) | `blowOff`, `tick` |
| ember | the front glows for a moment (the splint's phosphate stops afterglow) and lets go a wisp | `emberAt`, smoke kind 2 |

**The flame's lean** follows from the streakline: a 0.5 m/s draught leans it about 40°, and 1.3 m/s about 78°. Along its own arc it stays about its still-air length: a bent flame is carried sideways, not stretched. **Flicker** comes from eddies of the flame's own size (3–16 Hz) whose strength is a third of the air speed at the base. A match in still air burns steady.

**The wisp** rises at 10–20 cm/s. For its first few centimetres it is a laminar thread. Then it snakes: each puff leaves with the phase of a 4–7 Hz sinuous wave, whose amplitude grows with height and whose direction turns slowly. Higher up, the room's eddies (two sizes, each two layers sliding different ways so the field changes along a puff's path) curl and spread it. A draught carries the whole thread downwind.

## Drawing (match.page.js)

- **The flame is light, not a surface.** A ray is marched (56 steps) through a box around the spine.
  - Glowing soot fills the upper flame, yellow-white at its hottest and orange toward the cooling tip.
  - A dark core sits low in the middle.
  - A thin blue reaction sheet lines the base.
  - The surface wrinkles with noise rising at the gas's speed.
  - The scene's depth stops the ray, so the stick hides what is behind it. The flame is marched at half resolution and upsampled.
- **The flame lights the scene** through one point light at its heart, with the falloff of an extended source, 1/(d² + r²) with r ≈ 3.5 cm. It throws the stick's and the stand's shadows. The balance follows a match's numbers: about a candela, the stick a centimetre off and the table twelve. The stick is lit nearly as bright as the flame's orange edge, the table a hundred times dimmer.
- **The stick** chars behind the front, shrinks and curls toward the flame, and is crazed into cells that glow near the front. Ahead of the front the wood browns. The head chars with the front.
- **Smoke** is drawn as ribbons through the kernel's threads, at least a pixel wide (fainter by as much). It is lit by the moon and the flame with forward scattering plus a multiply-scattered share. A thread torn apart by a breath is not stitched.
- **The frame:**
  - the hot plume above the flame shimmers;
  - HDR through bloom and ACES;
  - the eye adapts, opening up when the flame goes out so the ember and the wisp show by moonlight.

## Run from control/

```sh
node scripts/spikes/flame/verify.mjs
node scripts/spikes/flame/match.mjs /absolute/out.html [breeze m/s = 0.12] [angle deg = -10]
```

In the page:

- Drag to orbit and scroll to zoom.
- **Strike** (S) lights a fresh match. **Blow** (B) puffs from where you are looking.
- Slow the clock to ¼× or 1/16× to watch the flare and the flicker.
- Sliders: breeze, gusts, the direction it comes from, the stick's angle (head down to head up), and flame φ.
- `window.__match.advance(s)` pauses, steps s seconds of simulated time and draws one frame. `timing()` measures a frame.

## Verification

Machine gate: 16 checks pass.

- **Determinism and φ:**
  - The kernel is deterministic per seed and air.
  - φ = 0 is still air exactly for the flame, the front, the smoke and the sparks.
- **The flame's shape:**
  - In still air the flame is vertical at any stick angle.
  - It leans downwind, more as the air quickens: 18°, 40°, 62°, 78° at 0.2, 0.5, 0.9 and 1.3 m/s.
  - A step gust reaches the base first and the tip after.
- **The burn:**
  - Held 60° head down it burns at 4.8 mm/s; level 1.2; held 60° head up 0.08, and it starves out. A level match burns to the clip.
  - The strike flares to 45 mm; the steady flame is 26 mm. The sparks are gone within a second.
  - The front only moves toward the clip and stops there.
- **Going out:**
  - A 0.8 m/s draught keeps it lit.
  - A 4.5 m/s breeze blows it out (at 0.7 s, during the head).
  - A breath from 30 cm blows it out in 0.25 s.
- **The smoke:**
  - The wisp rises.
  - Near the ember it is a thread about 0.5 mm across, wavering to millimetres higher up.
  - A draught carries it downwind, well past its own meander.
- **Seeking:** the flame and the sparks can be asked for at any time, in any order.

Cost in Node: `flameAt` is about 0.1 ms, a burn tick 0.3–1 ms with the smoke alive. In the browser pane at 1358×1302: 4.8 ms a frame for the hero view and 6.7 ms close up. Most of that is the march.

Eyes gate: the agent looked at the page in the built-in browser and saw:

- It renders without console errors.
- The flame has a blue base, a yellow body and an orange tip.
- The strike flares and throws sparks.
- The char front creeps and glows, and the head chars.
- The flame lies down in a breeze.
- Head down, it climbs the stick; head up, it starves.
- Blown out, it leaves an ember and a wisp that snakes as it rises.

The operator's eyes gate is open.

## What this establishes and what it does not

It establishes that a flame can be one more consumer of the wind's air field. Its shape is a streakline that is seekable and cheap. The physics that matters to the eye — lean, flicker, blow-off, spread by angle, and the wisp's instability — comes from a few written laws rather than keyframes. It also establishes that a volume flame can be drawn as emission against scene depth, lighting its scene in the right balance.

It does not establish:

- **Combustion or CFD.** The flame's length and the spread rate are laws with constants chosen in the literature's ranges (Roper's height ∝ fuel flow; the blow-off speed rising with flame size), not solved chemistry. There is no two-way coupling: the flame does not stir the room's air, and its plume does not carry the smoke it sheds.
- **Measured inputs.** Rates, sizes, the blow-off law, the buoyant acceleration (28 m/s² effective) and the smoke's instability are estimates.
- **Radiative transfer.** The flame is optically thin emission. The smoke is single-scattered with a flat multiple-scatter share, and does not shadow.
- **Cross-host determinism.** `Math.sin`/`exp` are not routed through `dmath`, the same caveat as the wind spike.

## Fire in worlds (production: `lib/graph/fire/`, `scene/channels/fire.js`)

The match stays a spike. What carried into production is the flame as a streakline in the world's air, generalised from one laminar flame to a bed of flamelets. `fire` on any world opts in, and absent it is zero bytes.

- **Kinds:** candle (laminar, steady), torch, brazier, campfire. They differ by size: the bed D and the flame L (Heskestad's height law, read once into `FIRE_KINDS`). Past about 10 cm a fire is turbulent: it wanders on its own eddies and puffs at f ≈ 1.5/√D (Cetegen & Ahmed), about 5 Hz for a torch and 2 Hz for a campfire.
- **Seekable:** `fireKernel` keeps no state. Flamelets, embers and smoke puffs are all functions of time: embers and puffs are released on fixed schedules and follow analytic paths. World captures, which pin the clock, stay deterministic.
- **The air:** on a terrain with `wind`, fires take the terrain's own field and clock, so they lean in the gusts the grass bends in. Elsewhere the air is still.
- **Drawing:** a marched box per flamelet, depth-tested against the walls and tonemapped in its own shader (World pages have no HDR pass). Each fire also gets a halo, its props (torch, brazier, stone ring and logs, candle), glowing coals, ember streaks and smoke puffs.
- **Light:** every basic material on the page is patched, including terrain chunks as they stream in. A fire already in a world's bake (a dungeon's) flickers the light there. One that isn't (a campfire on a terrain) adds its light, at a share set by the world's daylight: a fire is a thousandth of the sun.
- **Dungeon:** `fire: true` turns the traced chamber fires into braziers and the tunnel lights into torches on the walls. The baked fixture blobs go; the baked light stays.
- **Terrain:** `fire.sources` with `[x, y]` are set on the ground there.

`node scripts/spikes/flame/world-pages.mjs /absolute/dir` writes `dungeon-fire.html` and `campfire.html` to walk, and `.capture.html` copies with the capture API (`__mojCapture.frame({ pos, target, t })`; a capture page draws only when asked, so it does not animate or respond to the mouse).

## Suggested next forms

- **A candle:** a steady wick flame, wax pool. The same kernel with a constant fuel rate and a wick that trims itself.
- **A campfire:** turbulent flames that puff at f ≈ 1.5/√D, embers on the field's gusts, and logs charring with the same front.
- **A torch.**
- **Fire spreading through grass in the terrain's wind:** a front driven by the same gusts the grass bends in.
