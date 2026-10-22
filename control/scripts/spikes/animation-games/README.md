# Animation games: one take, rendered for the kind of game it plays in

Spike `1021-animation-games`, on `1018-consolidated`. It asks whether a game's genre can choose how
its animation *plays* without choosing different poses: "ragdoll-powerscaling". Nothing registers a kind, channel, MCP
tool, recipe field or exporter. The production code is only read: the hero library's `keyedClip` (hero-jump.js),
`heroStrike`, `JUMPS`, `REACTS`, `rigNodesAt`, and the cosmos `GENRES` (gameworld/intent.js).

```sh
# from control/
node scripts/spikes/animation-games/verify.mjs [cast=male]          # the machine gate, PASS/FAIL per concept
node scripts/spikes/animation-games/preview.mjs /abs/out/dir [cast] # animation-games.html (a player) + filmstrip-<take>.svg
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
