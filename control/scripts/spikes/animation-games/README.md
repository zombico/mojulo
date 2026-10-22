# Animation games: one take, rendered for the kind of game it plays in

Spike `1021-animation-games`, on `1018-consolidated`. It asks whether a game's genre can choose how
its animation *plays* without choosing different poses: "ragdoll-powerscaling". Nothing registers a kind, channel, MCP
tool, recipe field or exporter. The production code is only read: the hero library's `keyedClip` (hero-jump.js),
`heroStrike`, `JUMPS`, `REACTS`, `rigNodesAt`, and the cosmos `GENRES` (gameworld/intent.js).

```sh
# from control/
node scripts/spikes/animation-games/verify.mjs [cast=male]          # the machine gate, PASS/FAIL per concept
node scripts/spikes/animation-games/preview.mjs /abs/out/dir [cast] # animation-games.html (a player) + filmstrip-<take>.svg
node scripts/spikes/animation-games/motion-verify.mjs [cast=male]   # motion: running, then jumping (below)
node scripts/spikes/animation-games/motion-preview.mjs /abs/out/dir [cast]   # motion.html (follow cameras) + motion-strobe.svg
```

## The idea in one paragraph

A **flavor** is a lens over a take the hero library already solves. It keeps the poses the take must hit (the hand on its
target at contact, the feet leaving and meeting the floor) and changes four other things. It changes **time**: how long each
part of the action lasts, and whether it holds. It changes the **wings**: how far the wind-up and the follow-through travel
from ready. It changes the **body**: squash and stretch, and smears on the fastest frames. It changes the **force**: what a
blow hands on, measured as a *powerscale*, the victim's change of speed against what a body on earth would give it. So the
same jab can be a boxer's jab, a brawler's haymaker, Mario's boop or a pinball bumper. The selection is shared; the
rendering is not.

| flavor | time | wings | holds | body | force (jab into a 75 kg victim) |
|---|---|---|---|---|---|
| **realistic** | the take's own | 1 | none | none | momentum: Δv 0.38 m/s, ×1, the victim barely flinches (reaction at 32%) |
| **action** | wind-up ×1.5, drive ×0.45, follow ×1.4 | wind-up ×1.8, follow ×1.5 | wind-up 4 f; hitstop 4 + 0.6/(m/s), cap 14, both bodies | squash 0.06, smears | momentum ×12, lifted 18°: Δv 4.6 m/s, thrown 2.5 m |
| **platformer** | wind-up ×0.55, drive ×0.7, recovery ×0.6 | ×1.25 / ×1.2 | hitstop 2 f | squash 0.22 at take-off and landing | boop: pushed 2.5 m/s and squashed, the striker bounced 3 m/s |
| **pinball** | the whole take ×(speed / 4 m/s), at most ×5 | 1 | none | squash 0.1, smears | ricochet: the body's own travel × 1.3 (10 → 13 m/s) |

`flavorFor({ flavor?, genre?, says?, words? })` picks one. The operator's own word wins. Otherwise the genre id decides
(`GENRE_FLAVOR` places every cosmos genre exactly once). Otherwise the genre whose words the ask names. Otherwise realistic,
the default that never lies about a body.

## What the machine gate measured (nobody has looked yet)

`verify.mjs` renders one take for each procedure: a strike (`jab`), a jump (`jump`), and a reaction (`hitHigh`, driven by
the strike's blow). All four flavors run on both casts. Every check holds on male and female:

- **The promise.** The jab's hand lands on its contact point in every flavor, to 0 mm. The jump's toes leave and meet the
  floor where the take puts them, to 0 mm. Each beat is rounded onto a frame, so the promised pose is shown exactly, not
  just near it.
- **Realistic is the take.** No key grows. Every frame is the solver's own pose. There are no holds, no squash and no
  smears, and the length is kept to half a frame.
- **Action freezes both bodies.** The striker and the victim are held for the same 7 frames, the victim one frame behind
  the striker. The hitstop grows with the blow (5, 6, 9, 14 frames at Δv 1, 4, 8, 16 m/s). The wind-up goes 1.9× as deep,
  contact comes in 3 moving frames against 6, and the victim reacts 4× as far.
- **Platformer.** The body stretches to 1.22 at take-off and squashes to 0.78 at landing, keeping its volume. It takes off
  on frame 16 against 26.
- **Pinball.** At 4, 10 and 20 m/s the take lasts 1.1, 0.43 and 0.22 s. A new pose shows every frame, and each frame moves
  the most of any flavor.
- **Every render is byte-identical run to run.** No `Math.random`, no `Date`.

## Findings

1. **The flavor is time, wings and force. It is never the pose.** Gains act on a key's distance from ready and are 1 at
   every promised beat. That is enough to make the same keys read as four different games while contact stays exact. The
   operator's ask ("the same poses may be selected, but they render differently") holds as stated.
2. **Two flavors are already baked into the library.** `hero-react`'s hit snaps in a tenth of the clip and holds to two
   fifths: that is an action-game hitstop written into the poses. Versus carries its own frame data (hitstop L8/M10/H12),
   and RPG juice has `hold`. A flavor layer is where these would meet. A realistic game should not inherit a fighting
   game's freeze from the reaction clip. The spike shows the fix: the reaction's depth comes from the blow (`reactGain`).
   The authored hold is still in `REACTS`.
3. **Packing is the integration's real cost.** `packLayeredRig` bakes every clip at 12 evenly spaced keys (by default),
   and the web runtime and glTF both play them linearly. A 7-frame hitstop, a 3-frame snap and a contact on its frame would
   be smeared away. A flavor has to apply before packing, and the packer then needs keys on the beats and on each hold's
   edges, not only more keys.
4. **Half of a flavor cannot be baked.** Hitstop in a game freezes the *simulation*, both entities, for frames that depend
   on the blow. Knockback depends on who was hit. Pinball's rate depends on live speed. The clip half (retiming, wings,
   squash, smear marks) belongs in the clip. The live half (hitstop, knockback, rate by speed) belongs in the controllable
   world's rules. Today those rules have no hitstop at all, and their knockback is poise chip, not displacement.
5. **The hooks are there to reuse.** `hero-vibe.js` says its `snap` axis "is not built; it needs the clip sampling". This
   spike's time layer is that sampler. Vibe would then be the character's temperament and flavor the game's physics of
   depiction, and they compose. `performance()` (figure-posing.js) already has anticipation, follow-through and
   exaggeration for figure motions and emotes. A flavor should drive those dials, not reimplement them.
6. **Pinball means rate, not cutting.** The first try cut the take key to key, with no easing, as limited animation does.
   It showed *fewer* poses per second, the opposite of "a lot of change of frames in a fast sequence". What reads as
   pinball (or Sonic) is the take's content passing faster as the body goes faster, a new pose every frame, smeared. The
   cut is gone.
7. **There is no ragdoll.** No ragdoll exists anywhere in the repo. The spike's knockback is analytic: a flight on earth's
   gravity, then a slide at friction 0.8. A ragdoll would be the next step for realistic and action topples, and it is out
   of scope here.
8. **Measures worth an eye.**
   - The realistic jab drives the hand into contact at 10 m/s, an elite punch.
   - The stock standing jump swings its hands at 16 m/s at the push, which may be fast for a jump's arm swing.
   - The monotone cubic flattens the elbow at contact, so the hand's speed in the last 1.7 ms reads half its speed over
     the last frame. A "fastest at contact" check on angle keys has to read over a frame.
   - One effective-mass share serves every strike, so the cross is not heavier than the jab here (9.5 vs 10.0 m/s into
     contact). Real heft needs the mass the weight transfer carries.

## Open questions for the operator

- Is pinball's rate the meaning you intended? Or did you mean a spin-ball body replacing the figure at speed, or limited
  animation (posing on twos)?
- The genre table is a judgment. Arena shooter → action? JRPG → action (its battle juice) or realistic (its walking)?
  Should a genre be allowed two flavors, one for traversal and one for combat?
- Should the victim's freeze start on the striker's frame exactly? Fighting games show the hit pose at once; here the
  reaction's snap spends one frame.
- Is the powerscale worth exposing as its own dial ("×12 force"), apart from the flavor?

## Suggested boundary if it lands

- A `flavor` word on the world, defaulting from the genre (a cube setting beside `soul.vibe`), with dials over the preset,
  as vibe does.
- The clip half applied before `packLayeredRig`, with beat-aligned keys.
- The live half as rules in the controllable world (`hitstop`, `knockback`, `rateBySpeed`), mirrored in the Godot kernel
  and held equal by `conformance.mjs`.
- `REACTS`' authored hold moved out of the clip and into the action flavor.
- A characterization pin on the packed `b` arrays for each flavor, with realistic byte-identical to today's clips.

## Motion: running, then jumping

`motion.mjs` applies the same idea to locomotion. A run-up from a jog over 12 m blends the jog cycle into the sprint
as speed builds. The `runningJump` starts on the first frame after the run-up whose cycle phase is nearest the jump's
first pose. Then come the flight, the landing and 0.8 s of run-out, which picks the cycle up at the phase nearest the
jump's last pose. Hand-offs cross-fade joint positions over 4 frames. The root now travels: the clips are in place, and
the flavor flies them.

| flavor | speed | the stride | take-off contact | the arc | landing |
|---|---|---|---|---|---|
| **realistic** | builds over τ 1 s to 7 m/s | the ground's rate: a planted foot holds still | the clip's own (0.2 s) | the clip's own air (0.40 s) on earth's gravity: 0.19 m | keeps 90 % of the speed |
| **action** | τ 0.45 s to 9 m/s | the ground's rate | the clip's, gather ×1.7 deep | 1.2 m, a 0.1 s hang at the top | holds 3 frames, squash |
| **platformer** | τ 0.08 s to 6 m/s (the platform rule's) | the ground's rate | ×0.6 | the platform rule's: 8.5 m/s up on gravity 20, down on 34 | keeps it all, squash 0.25 |
| **pinball** | τ 1.4 s to 20 m/s | outruns the ground, never under 4 frames a stride | shorter the faster (7 m/s ÷ speed) | 1.0 m on gravity ×1.6 | keeps it all |

**The promise.** The body leaves the floor on the take-off frame and meets it on the landing frame, in every flavor. The
clip's ground contacts are the flight's ends; only the air between them is stretched to the flavor's arc. On the landing
frame the feet sit where the clip's own feet are at its landing, to within a centimetre (the deeper absorb and the
squash account for the difference).

**What the machine gate measured** (`motion-verify.mjs`; all 13 checks hold on male and female; nobody has looked yet):

| | realistic | action | platformer | pinball |
|---|---|---|---|---|
| 90 % of top speed after | 1.9 s | 0.9 s | 0.15 s | not reached in the run-up |
| take-off speed | 6.6 m/s | 8.9 m/s | 6.0 m/s | 13.5 m/s |
| frames a stride at take-off | 26.7 | 19.7 | 29.2 | 5.8 |
| stride outruns the ground by | 0 | 0 | 0 | 16.5 m/s |
| planted foot's slide on one gait | 0.012 m/s | 0.06 m/s | 0.012 m/s | (a wheel) |
| hips' lowest in the gather | 0.80 m | 0.74 m | 0.72 m | 0.78 m |
| air, height, length | 0.40 s, 0.19 m, 2.6 m | 1.08 s, 1.2 m, 9.6 m | 0.75 s, 1.81 m, 4.5 m | 0.72 s, 1.0 m, 9.7 m |
| rise ÷ fall time | 1 | 1 | 1.30 | 1 |

### Motion findings

1. **The stride rate is the ground's, or it is a choice.** A cycle played at speed ÷ stride length keeps a planted foot
   still in the world: 1 cm/s at most here, with no foot IK. That is the realistic, action and platformer rule. Pinball
   breaks it on purpose: past the sprint's own speed, the cycle spins faster than the ground goes by. That is Sonic's
   wheel of legs, the "lot of change of frames in a fast sequence", and it is capped at 4 frames a stride so it never
   aliases. A pinball game's feet *should* slide; a realistic game's must not. That choice is a flavor dial, not a bug.
2. **The jog → sprint blend skates, and fast acceleration makes it worse.** Blending the two cycles by joint position at
   the same phase slides a planted foot by 0.18 m/s for realistic (over 59 frames) and 1.28 m/s for platformer (over 7
   frames). The cycles' stance windows do not line up (the jog's left foot lands at phase 0.117, the sprint's at 0.154).
   A platformer's instant top speed squeezes the whole blend into a few frames. Integrating would need phase-aligned
   gaits (stance windows normalized before the blend) or a foot lock. The engines' own blend trees will show the same
   thing.
3. **The air is the flavor's; the contacts are the clip's.** Keeping the take-off and landing contacts and stretching only
   the air is enough to fly any arc: 0.4 s or 1.08 s, symmetric or falling faster. The clip already carries `air` (take-off,
   landing, apex), so an engine can do this itself today. It needs the flavor's gravity, not a new clip.
4. **The platform rule has no acceleration on the ground.** `rules-platform.js` moves the body at `speed × dt` directly (only
   its space mode accelerates). It already advances the gait phase at speed ÷ stride length, so its stride is the
   realistic rule. The flavor's τ 0.08 s is a stand-in for "at once". Realistic and pinball both need an acceleration
   curve in the live rules to be depicted honestly.
5. **The library has no start from standstill.** The run-up starts from a jog, because the library has no drive phase:
   no short, quick, low first steps. Blending the sprint cycle down to zero speed would look like slow motion. A real
   standing start is a clip of its own.
6. **The pinball contact gets short.** At 13.5 m/s the take-off contact is 0.1 s, and the push's poses pass in 6 frames.
   A pinball game may want the jump's poses swapped for a tuck (the `rollForward` clip already exists), which is the
   open question from the first section.
