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
node scripts/spikes/animation-games/collision-verify.mjs [cast=male]   # collision: walking or running into a wall or a body (below)
node scripts/spikes/animation-games/collision-preview.mjs /abs/out/dir [cast]   # collision.html + collision-<gait>-<target>.svg
node scripts/spikes/animation-games/weapon-verify.mjs [cast=male]  # weapons: a strike with a held weapon (below)
node scripts/spikes/animation-games/weapon-preview.mjs /abs/out/dir [cast]  # weapon.html + weapon-<verb>-<item>.svg
node scripts/spikes/animation-games/combo-verify.mjs [cast=male]   # combos and hitstun (below)
node scripts/spikes/animation-games/combo-preview.mjs /abs/out/dir [cast]   # combo.html (with timelines) + combo-<string>.svg (frame-data charts)
node scripts/spikes/animation-games/viewer.mjs /abs/out/dir [cast]  # every part on one review page: index.html + players + PNG strips
```

`viewer.mjs` runs every part's preview and verify, renders the filmstrips to PNG, and writes `index.html`, the page's
body for the artifact host. A new part is a row in its `PARTS`.

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
| **pinball** | τ 1.4 s to 20 m/s | outruns the ground, never under 4 frames a stride | shorter the faster (7 m/s ÷ speed) | 1.0 m on gravity ×1.6, flown as a tucked spin | keeps it all |

**The promise.** The body leaves the floor on the take-off frame and meets it on the landing frame, in every flavor. The
clip's ground contacts are the flight's ends; only the air between them is stretched to the flavor's arc. On the landing
frame the feet sit where the clip's own feet are at its landing, to within a centimetre (the deeper absorb and the
squash account for the difference).

**What the machine gate measured** (`motion-verify.mjs`; all 15 checks hold on male and female; nobody has looked yet):

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
| turns in the air | 0 | 0 | 0 | 3 (9.7 frames a turn) |

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
6. **Pinball's air is a tucked spin.** At 13.5 m/s the take-off contact is 0.1 s, and the leap's poses barely register.
   So pinball swaps the leap for Sonic's spin ball: the body folds into `rollForward`'s middle key (the shoulder's tilt
   left out so it spins square) and turns forward about its hips. It then opens back out into the leap's own landing
   pose, so the take-off and landing are still the clip's.
   - **How many turns.** Like a ball of the tuck rolling at the take-off speed: speed ÷ (π × the tuck's 0.45 m) turns a
     second, rounded to whole turns so it lands upright.
   - **Rolling and reading disagree.** Rolling would give 6.8 turns in the 0.72 s air (7.3 on the female cast). The floor
     of 8 frames a turn caps it at 3, so the body reads as a turning body rather than a strobing one. Does pinball want
     the honest roll, accepting the strobe, or a smear-ball with no visible body?

## Collision: walking or running into a wall or another body

`collision.mjs` approaches at the gait's own speed: the hero walk's 0.70 m/s or the sprint's 5.30 m/s, with planted
feet. The body hits a wall, or a standing body of the same mass facing it. The contact is the frame the trunk's front
(its joints plus 10 cm of chest) reaches the surface. The flavor decides what the impact does to each body: its speed
after, the change it takes, and the change it *shows*. One shared ladder of the library's responses turns the shown
change into a rung:

| rung | what plays |
|---|---|
| treadmill | the gait goes on in place against the surface (the other body, if any, is untouched: `still`) |
| bump | `hitHigh`, its peak scaled by the change |
| stagger | `stagger`: blown back, swaying until it recovers |
| down | `knockedOut` (hero-rise): the knees buckle, the body falls back about its feet as a rod under gravity |
| launch | thrown off the feet at 15°, the collapse in the air |
| bonk / boop | a fixed hop back, `hitHigh` |
| spin | pinball's tuck, rolling away in whole turns, then the stand |

| flavor | what an impact does | walk → wall | run → wall | run → body |
|---|---|---|---|---|
| **realistic** | momentum: a wall gives back 0.1; two bodies share it (restitution 0.2); flinch under 1 m/s of change, stagger under 3.5, down past it | flinch | down, 0.53 m/s back | both stagger (2.1 / 3.2 m/s on) |
| **action** | springier (a wall gives back 0.4), shown ×3; the charger takes its own change unscaled; a walk walks in place; a freeze of 4 + 0.4 f per m/s shown | walks in place | launched, 4.5 m back, 13 f freeze | the charger staggers, the other is launched 10 m |
| **platformer** | a walk walks in place; a run bonks off a wall (3 m/s back, 0.5 m hop, whatever the speed) or boops off a body (both apart at 3 m/s); squashed to 0.75 deep on contact | walks in place | bonk | boop, even |
| **pinball** | every surface is a bumper (restitution 1.3); past 2 m/s a body balls up and spins | bounces back at 0.91 m/s | spins 4 turns, 6.1 m back | a Newton's cradle: the runner all but stops, the other spins away at 6.1 m/s |

**The promise.** No trunk joint passes the wall or the other body's trunk, in any flavor, walking or running.

### The wall's property

A non-realistic wall says what it does to a body that meets it. Each flavor has a default (the table above), and any
flavor takes any of them by the caller's word: `collide(R, { flavor, gait, target: 'wall', wall })`. A realistic wall
is a wall: it refuses a property.

| property | dials | what plays |
|---|---|---|
| **bouncy** | `{ e }` restitution (past 1 it gives back more than it got), or `{ rebound, hop }` a fixed bounce; `minSpeed` | the ladder above, from the speed it hands back; slower than `minSpeed`, the body walks in place |
| **treadmill** | none | the gait goes on, the body pinned with its chest on the surface, the feet sliding under it at the gait's own speed |
| **sticky, walk** | none | the body turns 90° about the wall's foot over 0.3 s and walks up the face at its own speed, its planted feet on the wall |
| **sticky, climb** | `speed` (0.6 m/s) | hands and feet on the wall, moving contralaterally (a hand and the other foot together, the other two holding), the body rising steadily |

The climb is new: the library has no climbing clip. The game's `wall_crawl` falls back to a figure's own `climb` or
`leap`, and the hero has neither. So the spike builds one from what the rig already does. Each foot goes to a hold on
the wall through the rig's own leg solve (`feet`). Each hand goes to its hold through hero-stance's `reachArm`, posed
through `elbowsDown`, the space that solver answers in (posed without it, a wrist lands 20–40 cm off its goal). The hand
holds are set from the rig's shoulder height and arm length, so a short-armed body holds lower; fixed in metres, the
female cast's palms ended 16 cm off the wall.

**What the machine gate measured** (`collision-verify.mjs`; all 20 checks hold on male and female; nobody has looked yet).
Realistic momentum sums exactly in body-on-body collisions, and a wall gives back exactly a tenth. Action's freeze holds
both bodies still and is longer for the harder impact (13 frames off the wall, 8 off a body). Platformer's bonk is the
same at 3, 5.3 or 9 m/s. Pinball leaves every wall at 1.3× the speed it came in. Bouncy tunes: off e 0.3, 0.8 and 1.6
the runner leaves at 1.59, 4.24 and 8.48 m/s, and a fixed rebound of 2, 3 or 5 m/s is exactly that. On a treadmill the
feet slide at the gait's own speed (0.72 m/s walking, 5.66 running). Walking up, the body rises at the gait's own speed
(0.699 and 5.29 m/s) with its planted feet within 5 mm of the wall's plane, holding (0.02 m/s). Climbing, the holds drift
at most 4 mm a frame, the palms sit within 1.5 mm of the wall, and the body rises at exactly 0.6 m/s.

### Collision findings

1. **The rung comes from the change shown.** The four flavors pick from the same responses. What differs is the speed
   each body leaves with and the change the flavor shows: real, ×3, fixed, or more than came in. That number already
   existed for blows in the first part (the powerscale); collisions reuse it, and it chooses the rung. So "how hard does
   a wall hit" is one dial per flavor, not a new animation set.
2. **No clip braces a hand.** The trunk stops on the surface, but the forward hand passes 11 cm (walking) to 26 cm
   (running) through it. The walk and the sprint swing the hands ahead of the chest, and nothing in the library meets a
   surface with a hand: a brace, a forearm fold, palms on a wall. A game showing walls needs that clip, or a hand IK onto
   the surface for the frames around contact.
3. **The charge is a flavor rule, not physics.** Equal masses share a collision's momentum, so physics says the charger
   stops as hard as the body it hits. Action games show the charger driving through. The spike makes that explicit as
   `charge` (the incoming body's change is shown unscaled while the other's is ×3). It is the same asymmetry as the first
   part's striker and victim.
4. **Walking in place is the platformer's and the action game's walk.** Walking into a wall or a person does nothing in
   those games but keep the stride going. The spike makes that a threshold on the approach speed (`minSpeed` on a bouncy
   wall, `blockBelow` against a body, both 1.5 m/s), and it plays as the treadmill. A first version stopped the body
   and froze it 4 frames, which read as a hit.
5. **The hero walk is a stroll.** At 0.70 m/s, every walking collision here is gentle. A brisk walk (1.4 m/s) would put
   realistic's walk into a wall at 1.5 m/s of change, a stagger, which is closer to what walking into a glass door does.
6. **The treadmill is the one wall that has to slide feet.** It is what most games do, and what a player expects. It
   is also the only response here where planted feet visibly skate, at exactly the gait's speed. A game that wants the
   treadmill without the skate has two options: lock the feet and play the gait's upper body alone, or blend the cycle
   down to an idle push against the wall.
7. **The climb is the brace finding's answer.** Its palms meet the wall within 1.5 mm, where a bounce's forward hand
   passes 11–26 cm through it. The same two solvers (`feet` and `reachArm` through `elbowsDown`) would give a run into a
   wall its hands-up brace.

## Two views

Every player draws each pane twice. The side view is as before. The ¾ overhead view is the same camera swung 35° round
behind the body and raised 30°, like a third-person game camera, over a floor grid of metres (`views.mjs`, one snippet
all three players share). The strobes and filmstrips stay side views. The ¾ view shows what the side view hides: the
guard's stance width, the jab crossing the body, a stride's feet passing each other, and a climb's hands and feet spread
on the wall.

## Weapons: a strike with a held weapon

`weapon.mjs` takes the hero library's swings (`hero-swing.js`: chop, thrust, rising, and the two-handed cleave) at an
item's class, by the library's own law 8: a light item drops the coil, and a heavy one adds a held load. The swing's
keys are resolved by the rig's own clip player (`layeredClip`) and played the way that player plays them, each key
smoothstepped into the next. So the realistic register *is* the rig's swing, every joint within 0.5 mm of it.

The flavor lens (`flavor.mjs`) needed four hooks for this, so a take can bring its own pieces:

- `clip`: its own player
- `point`: its own contact point, the blade's tip rather than the wrist
- `effective`: its own striking mass, the weapon plus 1.5 kg of forearm (3 kg for two hands)
- `windHold`: its own wind-up hold, a charged heavy weapon's

Without the hooks, the swing played through the hero key timeline (which applies `elbowsDown`) put the wrist 15 cm off.

| register | how the weight shows (length = the sword's × (the class's ÷ the sword's)^spread) | charge | trail | the blow |
|---|---|---|---|---|
| **realistic** | as weighed: dagger 0.5 s, sword 0.75, greatsword 1.1 | none | none | the tip's speed × the weapon and arm: Δv 0.16 / 0.31 / 0.40 m/s, two hands 0.64 |
| **action** | spread 1.6: greatsword ÷ dagger 4.25× | normal 4 frames, heavy 18 | where the tip sweeps > 12 cm a frame | ×12; the freeze 5 / 6 / 7 frames, cleave 9 |
| **platformer** | spread 0.3: 1.23× (one snappy swing whatever the weight) | none | none | a boop |
| **pinball** | as weighed, at the body's speed | none | > 8 cm a frame | off the tip × 1.3 |

**The promise.** At contact the blade's tip is where the swing puts it, every swing in every register, to 0 mm. The
blade is drawn along the forearm from the wrist. Hero-gear mounts the real item; the grip's own angle is left out here.

**What the machine gate measured** (`weapon-verify.mjs`; all 11 checks hold on male and female; nobody has looked yet).
A heavier weapon hands on more though it swings slower (dagger < sword < greatsword < two-handed cleave). The tip's
speed into contact is the body's real swing in every register (dagger 6.3 m/s, sword 8.5, greatsword 7.3, cleave 8.9,
thrust 4.0). A register that slows the swing to show its weight does not weaken the blow.

### Weapon findings

1. **The swing's strike is reported at one phase and played at another.** `swingKeys` reports the strike at
   (keys − 3) ÷ (keys + 1), counting the loop's return to ready as a key. The rig's player spaces the keys over
   *keys* segments, so the strike key plays later:

   | class | reported | played |
   |---|---|---|
   | light | 0.333 | 0.400 |
   | normal | 0.429 | 0.500 |
   | heavy | 0.500 | 0.571 |

   The contact window a game reads is computed from the reported numbers. It still contains the played strike for every
   class, but the moment it calls the impact is about 7 % of the cycle early. This is a library bug; the spike reports it
   and does not fix it.
2. **The force is the body's, not the register's.** A first pass computed the tip's speed on the register's own clock.
   Action's slowed greatsword then handed on *less* than its sword, the opposite of what slowing it was for. The blow now
   reads the realistic swing's speed (`bodySeconds`) whatever the register shows. The same rule was already true of the
   fist, whose take did not change length between registers.
3. **Weight is a register dial.** One number (`spread`) says how much an item's mass shows in the swing's time. 1.6
   reads as heavy, and 0.3 reads as a platformer's weapon, where the greatsword and the dagger are nearly the same
   button. The charge (the hold at the cock) is the second dial, and only action uses it.
4. **The trail is the action game's weapon depiction.** The tip's sweep per frame decides whether a trail shows. Action's
   threshold leaves a trail through the drive into contact, and pinball's catches more of the swing. Realistic and
   platformer never draw one. Like the fist's smears, a trail is a mark for a renderer to draw, measured from the
   motion, never authored.
5. **There is no pinball weapon.** A standing swing has no travel to scale its rate by, so pinball's swing plays at its
   default speed and ricochets off the tip. A racing or Sonic-like game with a weapon would want the swing tied to the
   body's speed, like the spin. That is untested here.

## Combos and hitstun

`combo.mjs` strings 3 or 5 of the library's moves together and plays them against a simulated victim:

| string | moves |
|---|---|
| fists, 3 hits | jab, jab, cross |
| fists, 5 hits | jab, jab, cross, jab, cross |
| sword, 3 hits | chop, rising, thrust |
| sword, 5 hits | chop, rising, chop, rising, and a cleave finisher |

Each move is rendered by its register and *cancelled* into the next. It is cut at the register's cancel point and
cross-faded into the next move, which *enters* part way into its wind-up, the way an action string flows from one
blow's follow-through into the next. The cross-fade ends before the next contact, so every move's striking point still
lands where the move puts it (0 mm, chained and cancelled).

**Hitstun** is how long a hit leaves the victim unable to act. A hit *links* when it lands inside the stun the last hit
left. Once the stun runs out the victim is free, and a free victim that has seen a hit coming blocks it. So a string is a
*true combo* exactly as far as each gap between hits fits inside the stun before it. The **advantage** is the frames of
stun left when the next hit lands: it is ≥ 0 for every hit that linked and < 0 for every one that was blocked (checked
across every string and register).

| register | where the stun comes from | cancel / entry | each hit pushes | the end |
|---|---|---|---|---|
| **realistic** | the body: 0.22 s of reaction + a flinch of up to 0.4 s, scaled by the blow | half way back to guard / half the wind-up | the blow's real momentum | — |
| **action** | the game's combo rule (`combat-hit.js`): max(0.12, 0.5 × 0.85^(n−1)) s | at the follow-through / the whole wind-up | 0.6 m/s | a finisher: the full blow, a launch |
| **platformer** | none: after a hit, 1 s of mercy invincibility | plays each move out / none | a boop | — |
| **pinball** | none: the hit is a ricochet | at the follow-through / the whole wind-up | the ricochet | — |

The victim's reaction is the library's (`hitHigh` for a jab or a chop, `hitBody` for a cross or a rising cut), scaled
by the blow, and the finisher's launch is the `knockedOut` collapse in the air. A hit is a **hit**, **blocked**,
**immune** (inside mercy invincibility) or a **whiff** (the striking point more than 3 cm short of the chest).

**What the machine gate measured** (`combo-verify.mjs`; all 12 checks hold on male and female; nobody has looked yet):

| string | realistic | action | platformer | pinball |
|---|---|---|---|---|
| fists, 5 | 5/5, advantage +3 0 0 0 (male); 2/5, +2 −1 (female) | 5/5, +19 +14 +10 +6, launched 2.7 m | hit, immune ×3, hit (after the 1 s) | 1, then whiffs (16 m away) |
| sword, 5 | 1, then blocked ×4 (−12) | 4/5, +11 +7 +3 −1: the cleave finisher blocked | hit, whiff, immune, hit, immune | 1, then whiffs |

### Combo findings

1. **Hitstun is one law under four sources.** Every register keeps the same rule: the next hit links if it lands
   inside the last stun. What differs is where the stun comes from: the body's reaction, an authored number, nothing
   (with invincibility instead), or a ricochet that takes the victim away. The timelines (`combo-<string>.svg`) draw
   exactly that: a bar per stun and a tick per hit.
2. **A realistic jab string sits on the reaction time.** Its advantages are within a frame or two of zero, so it lands
   or drops by the body. The male cast's 1-1-2-1-2 lands whole. The female cast's blows are lighter, so her victim's
   flinch is shorter, and her cross comes 1 frame late. That is the honest reading of a real combination: punches beat a
   reaction or they don't. A realistic sword string is blocked after the first cut, because a sword is slower than a
   reaction.
3. **The decay that keeps a string honest is tuned to the string.** Action's stun decays 0.85 a hit, so by the 5th hit
   it is 0.26 s. The fist string's gaps (0.32 s) fit until then; the sword's (0.42 s) do not, and the sword's finisher
   is blocked by one frame. With a stun that doesn't decay the same string lands whole. A weapon set needs its own base
   or decay, or stun scaled by the move's weight, as the fighter's strengths are (L/M/H: +4/+4/+2 on hit).
4. **A string needs footwork.** The cross reaches shorter than the jab (the rear hand) and the rising cut shorter than
   the chop. Without a step they whiff. The library's strikes have no step-in, so the spike slides the attacker toward
   the victim through each wind-up (at most half a step; 0.05–0.16 m over a string, by register and cast). A game shows the step; the
   library needs one, as the thrust's lunge already is.
5. **Platformers trade hitstun for invincibility.** There, a hit makes the victim *safe* rather than helpless: the
   hits inside the second after it pass through. So a platformer's combo is the wrong question; its string is one hit
   and a pause.
6. **The game's melee caps a string at two.** `combat-melee.js` allows the opener and one follow-up. The 3- and
   5-hit strings here are the next step, and the combo rule they need (hitstun, decay, finisher) already exists in
   `combat-hit.js`.
