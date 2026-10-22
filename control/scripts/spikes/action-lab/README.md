# Action lab: one feel for the button, the body and the clip

A lab on `1021-action-game-unification`, after the animation-games spike (`../animation-games/`). Nothing registers a
kind, channel, MCP tool, recipe field or exporter; production code is only read.

```sh
# from control/
node scripts/spikes/action-lab/verify.mjs [cast=male]          # the machine gate: the laws, PASS/FAIL, every feel
node scripts/spikes/action-lab/lab.mjs /abs/out/dir [--cached]  # action-lab.html: the playable page (both casts baked)
```

## The question

The spike showed that the kind of game can choose how a take *plays* without choosing its poses. It answered on the
take's own clock. A game runs on the player's: **the press is the beat**. Measured on the spike's registers, the press
waits for the clip:

| register | jab: press → contact | jump: press → take-off |
|---|---|---|
| realistic | 11 f | 26 f |
| action | 14 f | 30 f |
| platformer | 7 f | 16 f |
| pinball | 4 f | 10 f |

The action register is the slowest button, because its deep wind-up and wind hold read as a telegraph. That suits an
enemy's swing or a heavy, but not the player's light. Every jump waits 10–30 frames for the clip's gather, where the
genres it names leave in 0–3. The clip cannot own the time of a player's action.

## The design

- **`feel.mjs`, the kernel.** One FEEL card per feel (`realistic`, `action`, `platformer`, `pinball`) and one pure
  `step(state, pad)` at 60 Hz. The card says what each button does:
  - ground: accel, decel, turn, steer
  - jump: commit, height, rise and fall gravity, cut, hang, coyote, buffer, air control, heavy landing
  - dodge: kind, frames, invincible frames, cancel
  - moves: a string of startup, snap, active and recovery; cancel, buffer, lunge, finisher
  - hit: hitstop, hitstun (by the body, by `combat-hit.js`'s rule, or none), force (momentum, boop or ricochet), mercy
  - wall: stop, bonk or bounce
  - look: squash, smear

  The kernel has no imports. The page inlines its text, so the gate and the eyes run the same code. It reads as the
  spec a Godot port would be held to.
- **The body is the character's half.** `newState(card, body)` reads the character's own numbers per take: its
  reach, its real blow (the spike's momentum Δv), its strides and its mass. The female cast reaches 0.74 m where the
  male reaches 0.82 m in the same card, and the female's cross lands lighter. This is the character creator's link in
  miniature.
- **`takes.mjs`, the clips fitted to the card.** A move is the spike's strike take, rendered through its `render`. Each
  span's time is solved so the beats land on the card's frames:
  - the wind-up takes `startup − snap` frames
  - the snap takes `snap` frames
  - contact lands on `startup`
  - the follow-through and the settle share `active + recovery`

  The card's wings deepen the wind-up inside the startup, never before it. Realistic's card *is* the take's own time
  (11 / 2 / 12), so its fitted jab is the take frame for frame. The jump's gather is fitted to the commit. Its air is
  read by vertical speed, because the kernel flies it and a cut jump's air time isn't known at take-off. The landing,
  the roll and the reactions are fitted the same way.
- **One card, three readers.** The kernel steps the card, the takes are fitted to it, and `frameData(card, body)` prints
  its move list (startup, active, recovery, cancel, hitstop, stun, link, on block). The gate checks that a chained
  hit's measured advantage is the printed link, to the frame.
- **Every press is accounted for.** Each press edge ends one of three ways: acted on, buffered and then acted on, or
  dropped with its reason ("the move's cancel is not open yet", "buffer ran out (6 f): in the air"). During a hitstop,
  presses wait in the buffer, and their buffer doesn't age while the body is frozen.
- **Hitstop freezes both bodies for the same frames** (the spike's open question, answered the fighting-game way). The
  tick that struck still shows the contact frame. The frozen frames change nothing, and the move resumes on the next
  frame. A hit's total delay is exactly the hitstop.

## Jumping on a body

What coming down on a body does is the card's `land`. Bodies never pass into each other: walking into the dummy
stops at its side, and coming down on its top (the feet within a quarter metre of it, or above it at the frame's
start, not rising) is the card's call:

| feel | coming down on a body |
|---|---|
| **realistic** | slides off its top at 2 m/s into open space; nobody stands on a head |
| **action** | slides off at 3 m/s, plus the **enemy step**: a jump pressed in the air while touching a body (beside it or on it) is a fresh jump on the press, once every 12 frames (Devil May Cry, Bayonetta, Ninja Gaiden) |
| **platformer** | a **stomp**: the body is squashed (flattened for its 90-frame stun) and the stomper bounces 0.6 m, or the full 1.81 m with the jump held; a body in its mercy is bounced off without effect |
| **pinball** | a spinning body **bounces off** like a bumper (at least as fast as it fell, never under 1 m) and the body ricochets at 1.3× (at least 7.8 m/s); falling unspun, it slides off |

The standing dummy (1.7 m) is taller than every jump but the platformer's, so the page's **Critter** (H) swaps in a
short one (0.8 m) that every feel can land on.

## The air jump and the wall (Mega Man X)

The card's `air` and `cling`, on the three non-realistic feels:

| feel | air jump | wall slide | wall jump | one wall climbed? |
|---|---|---|---|---|
| **realistic** | none | none | none | no |
| **action** | 1, 0.8× the jump's height | 2.5 m/s | up 0.9×, away 4 m/s, a 6 f kick | yes, about +1.0 m a kick |
| **platformer** | 1, 0.9× | 2 m/s | up 1×, away 5 m/s, an 8 f kick | yes, about +1.5 m a kick |
| **pinball** | 1, 0.7× | 4 m/s (slippery) | up 0.8×, away 8 m/s, a 6 f kick | no: its kick outruns its air control, momentum is the feel |

- **The slide.** Falling against a wall with the stick into it (at least 0.3 of the stick's push) slides down it at a
  constant speed, facing out as X does. Letting go of the stick lets the body fall free. The tall **tower** in the
  arena's corner is there to climb.
- **The kick.** A jump on the wall kicks off it, up and away. The kick's horizontal speed is fixed for its frames
  (the stick is locked out); after that, holding back toward the wall carries the body back to it. A held jump each
  time it clings climbs one wall; a tapped jump is cut short and loses height (the variable jump applies to kicks too).
- **The wall's coyote time.** A jump pressed up to 4–5 frames after leaving the wall still kicks off it, counted
  from the frame after leaving, as the ground's coyote time is.
- **What a jump in the air does,** in order: a coyote jump, a wall jump, the enemy step, an air jump, else it waits in
  the buffer for the landing. Landing and touching a wall give the air jumps back.
- **Pinball's walls** are bumpers above 3 m/s; slower than that in the air they are plain walls, so a body can come to
  rest on one and slide.

## Guard and parry: the attack's arc and its zones

The card's `guard`, on realistic and action; the platformer and pinball do not guard (pinball's boost is its defence).
**GUARD** (U, gamepad RT; sprint moves to LT) held blocks a hit from the front: no hitstun, a short blockstun and a push
back. A hit from behind still lands.

**Every enemy attack swings across an arc**, drawn on the floor through its telegraph: red, with an orange segment.
A sweep crosses its arc over its active frames and meets a body on the frame it reaches the body's angle; a thrust is
live across its whole arc. A hit met in **orange** by a guard pressed in time is **parried**: the attacker staggers open
for a riposte and the guard is free at once. Met in **red**, it is only blocked. Some attacks are all orange; some are
all red and **unblockable** (a perilous attack: dodge it). The sparring dummy (T) cycles three:

| attack | telegraph | arc | zones |
|---|---|---|---|
| **jab** | 30 f | a thrust, ±10° | all orange |
| **hook** | 36 f | a sweep, ±70° over 10 f | orange in the middle 30 %, red at the edges |
| **perilous blow** | 48 f | a thrust, ±30° | red, unblockable: a `!` over the dummy |

| feel | guarding | the press for a parry (in orange) | block | more |
|---|---|---|---|---|
| **realistic** | walks at 0.35× | within 6 f of the hit (strict) | push 1.2 m/s, 14 f blockstun | stamina 100, 40 a block; empty breaks the guard into a stagger |
| **action** | rooted | within 12 f (lenient) | push 2 m/s, 10 f blockstun | the **perfect dodge**: a roll or dash meeting a hit in its first 6 f slows the attacker to half speed for 2 s (Witch Time) |

The press window keeps a timing skill in the parry. With `parry: null` on a card, guarding in orange is enough.

## Hold and release: the charge

The card's `charge`, on every feel. The attack's press still acts at once: **the tap is the card's light and is
never delayed**, whether the button is let go or held. Holding on charges, counted from the press (frozen frames do not
count). **The release is the beat** of the charged attack: it fires on the release frame at the level the hold reached.
Let go short of the first level and a charge that was showing fizzles; let go sooner than that and it was only a tap.
A hit taken loses the charge, unless the card keeps it (`hurt.charge`: the platformer does).

| feel | what it charges | levels (held from the press) | while charging |
|---|---|---|---|
| **realistic** | the heavy, a haymaker: 14 f startup from the release, Δv ×1.8 | 40 f | a stance once the jab ends: walks at 0.3×, no jump; a roll or a guard lets it go |
| **action** | the heavy (40 f), then the launcher (70 f, a finisher thrown up at 42°) | 30 / 70 f | the stance, at 0.4× |
| **platformer** | Mega Man X's buster: a charge shot, then the full charge (bigger, faster, pushes harder) | 24 / 66 f | no stance: run, jump and dash with it held, and fire from anywhere |
| **pinball** | Sonic's spin dash: 14 m/s, then 20 m/s, invincible through the boost's frames | 20 / 50 f | rooted and curled, the stick aims it |

The heavy's rows join the frame data (startup counted from the release). A ring on the hero shows the charge once it
has shown (`show`), coloured by the level reached; the shots fly as balls.

## Offense armor: what it takes to interrupt an attack

Every hit carries **tags**: light or heavy, and its kind (`shot`, `stomp`, `launcher`). Every attack may carry
**armor**, live through its startup and active frames unless it names its own window:

- **none**: any hit interrupts it.
- **`by: [tags]`**: only a hit carrying one of those tags interrupts it. That is "heavy attacks only", or a
  **trigger**, a certain kind of attack (the hook breaks to a heavy or to a shot, even the platformer's light shot).
- **`hits: n`**: the nth hit interrupts it whatever its tags (poise: it shrugs off the ones before).
- **`by: []`**: hyper armor, nothing interrupts it.

A hit the armor holds against lands as a **clank**: no stun, no push, half the hit's freeze on both bodies, and the
attack goes on. The page draws a halo on an armored body while its armor is live (steel: something breaks it; pale:
hyper armor), and the frame data has an armor column.

| attack | armor | interrupted by |
|---|---|---|
| the dummy's **jab** | none | any hit |
| the dummy's **hook** | `by: ['heavy', 'shot']` | a heavy, or a shot (a trigger) |
| the dummy's **perilous blow** | `by: []` | nothing: dodge it |
| realistic's **haymaker** (the charged heavy) | `by: ['heavy'], hits: 2` | a heavy, or a second hit |
| action's **heavy** | `by: ['heavy']` | a heavy |
| action's **launcher** | `by: []` | nothing |

Stomps go through the armor too: a stomp is tagged light (the ground pound heavy), so an armored attack bounces the
stomper off without being squashed.

## The heavy-robot rules, and the mech

mobile-suit-arena's movement (mojulo's controllable `rules-platform.js` and `maneuvers.js`), split into rules that
overlap: each is a card field any feel may carry alone or with the others, not one character's movement.

| rule | what it does (MSA's) |
|---|---|
| `boost` | DASH held: an instant thrust at `speed`, draining a gauge (`gauge` s), refilled when the thrusters are cold (`regen` s to full, `overheatRegen` after running dry), overheat-locked when emptied until full again; a jump bites `jumpCost`, a turn of the thrust past 45° `turnCost`; released, an inertia skid; `dodgeOverheat`: the dodge dumps the gauge |
| `hover` | the cushion under a boost: held `height` over the floor, lifted at `rise`; it skims and catches a fall, never landing |
| `quickBoost` | Armored Core's: a press of DASH bursts `frames` at `speed` for `cost` s of gauge, then cools |
| `chargeJump` | stop-and-charge: held, rooted in a squat; the release launches at 0.6 to `mult` of the jump's speed; a full charge leaps along the stick |
| `gait` | the heavy gait: a step of `stride` m, the speed dipping by `lurch` at each footfall, a footfall event a step (the camera shakes) |
| `landing` | lag by the fall, `per` frames a m/s up to `max`, with a crouch |
| `size` | the body grown (a mech reads heavy: thick limbs, a boxed head) |

Boost armor is the maneuver armor's `boost` way. **The mech** is one composition of them: `mechCard(card, weight)`, or
newState's `mount`, laid over any feel's card. The card keeps its combat (moves, hits, guard, the loadout, what a hit
does) and its movement becomes the mech's, so a mech is its own game or the thing a body rides in another. **M** rides
one over the current feel; its one knob, **weight**, blends MSA's **heavy** suit (1: walk 3.36 m/s, boost 7.4 m/s on a
9 s gauge, a 2 s charge jump to 2.2×, landings that lag, the dodge an overheat, stun halved boosting) into a **swift**
Armored Core frame (0: walk 6, boost 15 on a 4 s quick gauge, a quick boost of 26 m/s, light landings). The glider and
the jetpack ride along as gear. The animation is the lab's, past MSA's clips: the gait's dip and footfalls, the crouch
by the fall, the squat deepening with the charge, the body leaning into the thrust and its flame.

## The loadout: mobile-suit-arena's weapons

The card's `loadout`, lifted from mobile-suit-arena, whose weapons are mojulo's own controllable rules
(`lib/graph/worlds/controllable/combat-ranged.js`: `initWeapon`, `tickWeapon`, `stepWeapon`; `maneuvers.js`:
`armSwitchReady`). The fields keep MSA's names and meanings and its seconds; distances are in metres (MSA's units ÷ 10).
**F** is the trigger (held: an auto weapon streams, a charge weapon charges), **Z** switches.

- **Ready time** (`switchReady`): every switch arms the incoming weapon, the slot's own value over the loadout's, re-armed
  in full on each switch. A pull inside it is dropped.
- **Cooldown**: an `auto` weapon fires at `rof` while held; a semi weapon opens a pull of `burst` rounds at `burstRof`
  (the burst commits) and waits its `cooldown`.
- **Ammo or charge**: a `magazine`; or an energy pool (`energyMax`, `energyCost`, `energyRegen`) that overheat-locks when
  emptied, until refilled to `energyUnlockFrac`; and `chargeTime`, held to charge, released to fire one charged bolt
  (`chargedAmmoCost`, `chargedImpact`).
- **Reload**: an empty magazine auto-reloads over `reload`, and every carried weapon's timers tick while stowed (MSA's
  autoloader).
- **Fire classes**: `sight` (hitscan, through the body only), `area` (hitscan with the assist ring: auto-aim), `lob` (a
  travelling round under `projectileGravity`, bursting with `splashRadius`, its proximity fuze, `armTime`, `fuse`).

| feel | loadout |
|---|---|
| **realistic** | MSA's MACHINE GUN (area, auto), LONG RIFLE (sight, 4 s cooldown), GRENADE (lob, its own 1.33 s ready time) |
| **action** | a mobile suit's: the BEAM RIFLE (3-round burst, charge for a 3-round bolt), the HYPER BAZOOKA (lob, proximity fuze), the HEAD VULCAN (area, 16 rounds a second), the V78 BEAM RIFLE (energy, overheat) |
| **platformer** | in MSA's terms: the BUSTER (a straight travelling round, a deep magazine, no ready time), a special weapon on energy that does not come back |
| **pinball** | none |

Shooting does not end a flight: the jetpack stays lit (`boostFire`, the lab's default for every weapon; MSA's holds
lob and semi beams while boosting). Left out because they would rework the lab rather than add to it: the targeting
cones and the hit egg, the crosshair, spread, recoil and falloff, dual wield, teams, damage and poise, charge through
boost, and melee loadout slots (attack stays the card's melee).

## The glider and the jetpack

E cycles the gear: none, the glider, the jetpack (the card's `glide` and `jet`). Either takes the jump button in the air
once there is no coyote jump, wall jump, enemy step or air jump to take it: **held on past the apex**, or **pressed in
the air**. With no gear nothing changes.

| feel | the glider | the jetpack |
|---|---|---|
| **realistic** | BotW's **paraglider**: opened by a press from 1.2 m up, sinks at 1.5 m/s, flies on at 6 m/s, turns 90°/s; a press folds it; its stamina folds it after 10 s | a **thrust** of 15 m/s² against 9.81: a slow climb (3 m/s at most) on a 2 s tank, refilled half a second after landing |
| **action** | Spyro's **glide**, held: sinks at 2 m/s, settles on 8 m/s, turns 180°/s | a **hover**: the climb eased to 0.5 m/s, 1.5 s of fuel |
| **platformer** | Peach's **float**, held: the height kept for a second, once a jump | a strong short **thrust**: 50 m/s² against 34, 1 s of fuel, refilled at once on landing |
| **pinball** | Knuckles' **glide**, held: from 4 m/s building to 12, sinking at 1 m/s, turning 120°/s; a glide into a wall **grabs** it | Tails' **flight**: once the air jump is spent each press flaps up at 3.5 m/s, the fall slowed to 1.5 m/s between; after 8 s it tires |

A hit, a move, a dash or a wall ends a flight. A gauge under the life shows the fuel, the stamina or the flight's time,
and the page draws the canopy, the wing, the flame or the rotor; the camera rises with a high flight.

## Ranged attacks: the enemy's patterns, by genre

Y turns the dummy into a shooter (again: the card's next set; T sparring and the shooter take turns). It telegraphs
(the aim drawn as a line, a laser for a sight) and fires the patterns its genre uses, one a volley:

| feel | the genre | patterns | how a body avoids them |
|---|---|---|---|
| **realistic** | the FPS | **rifle** (a 3-round burst), **marksman** (one heavy shot) | not by reaction: they are **hitscan**, no flight to see. Break the line (cover: a block between), or keep moving across the aim: the rifle's aim trails the target by a reaction (10 f), the marksman's locks 12 f before the shot (the glint, drawn as a flash) |
| **action: arena** | the character-action arena | **orb**, **fan** (5 across 60°), **ring** (12 all round, low), **homing** (turns 100°/s) | the roll's invincible frames (a perfect dodge on its first frames starts Witch Time), stepping off the line, jumping the low ring, out-turning the homing orb |
| **action: brawler** | the beat 'em up | **knife** (low and slow), **gun** (a long aim, then fast; it knocks down) | step off the knife's line or jump it; the gun's long aim is the warning |
| **platformer** | the run-and-gun platformer | **pellet** (3 slow, 50° spread), **aimed** (one at the hero), **lob** (a grenade at where the hero stood, bursting on the floor), **wave** (weaving 0.8 m) | they are slow and cross the room at their own speeds: a sidestep as it leaves clears an aimed shot; move off a lob's landing |
| **pinball** | the speed platformer | **buzz** (one slow shot), **burst** (8 slow, all round), **bouncer** (a ball that bounces on) | slow; outrun them, or run through them on maneuver armor |

A guard from the front stops a blockable shot (hitscan is not blockable).

## What a hit does: stun, knock, mercy, life, and maneuver armor

The card's `hurt`, `life` and `maneuver`:

| feel | a hit | mercy (invincible after) | life | maneuver armor |
|---|---|---|---|---|
| **realistic** | a **flinch**: control kept, the run slowed to ×0.5 for 24 f | none: a burst lands every round | 100 health | none |
| **action** | stopped: knocked back 3 m/s, stunned 24 f (the gun knocks down for 60 f); out of a charge | 40 f | 100 health | dashing or sprinting: no stun (hyper armor while moving), a quarter of the knock |
| **platformer** | stopped: knocked back 2 m/s and up, stunned 20 f; the charge kept (the card's call) | 90 f, the body blinking | 28 health | dashing: half the stun, half the knock |
| **pinball** | stopped: knocked back 4 m/s and up, stunned 30 f | 120 f | **rings**: a hit scatters all 10 and is survived; a hit with none is the end | running past 9 m/s: no stun, no knock, the speed kept (the rings still scatter) |

Out of life the body is down for 90 f, then up again full. **O** (`life.oneHit`) makes any hit the end, the one-hit
games. Maneuver armor cuts a hit's stun and knock while the body moves in the card's ways, but never its damage; melee
hits on the hero read it too, and the dummy's melee blows now carry damage (jab 8, hook 15, perilous 40).

## Lock-on

The card's `lock`, on realistic and action (a Souls game and a character action game target; a platformer and a pinball
game do not, and the press says so). **LOCK** (Q, gamepad LB) takes the dummy as the target when it is in range, a
second press lets it go, and walking out past the range plus 3 m loses it.

| feel | range | turning to face it | the strafe |
|---|---|---|---|
| **realistic** | 12 m | 540°/s | 0.5× the run |
| **action** | 14 m | 1440°/s | 0.85× the run |

- **Locked, the body faces the target** after every frame's move, so the stick strafes and an attack goes at the target
  whatever the stick says.
- **The rolls circle it.** A locked roll is split into its part along the line to the target and its part around it,
  and each is taken against where the body is now, every frame. A side roll traces an arc at its distance, a roll
  forward closes along the line, a roll back opens, and a diagonal spirals. Unlocked, the same side roll goes straight
  and drifts away.
- **The page's camera** swings close behind the hero to look at the target, and the stick is read against it, so up
  the screen is toward the target and a held stick left or right keeps circling (three held side rolls in action drift
  out only from 3.0 to 3.3 m while sweeping 2.4 rad round).

## Two getaways: the directional roll and the dash

Two buttons. **DODGE** (K, gamepad B) is the **directional roll**, the card's `dodge`: it goes the way the stick points
while the body keeps its facing, so it reads as a roll forward, a roll to the left or the right, or a hop back (the hero
library's roll forward, side roll and its mirror, and hop back, each fitted to the roll's frames). With the stick at
rest it is a **backstep**, shorter, as in Dark Souls and Devil May Cry. **DASH** (L, gamepad RB) is the dash, the card's
`dash`, with Mega Man X's moves on the three non-realistic feels.

| feel | the roll | invincible | back (and the backstep) | the dash | air dash | dash jump | X's held dash | dash wall jump |
|---|---|---|---|---|---|---|---|---|
| **realistic** | a step, 3.2 m/s, 22 f | no | 0.7× the speed, 0.8× the frames | none (it sprints) | none | none | no | no |
| **action** | a roll, 8.5 m/s, 24 f | 2–15 | 0.7×, 0.75× | a quick dash, 12 m/s, 14 f | 1, 9 m/s, 14 f | yes | no | yes, 12 m/s |
| **platformer** | a roll, 8 m/s, 20 f (Mario Odyssey's) | no | 0.7×, 0.75× | X's dash, 9 m/s | 1, 9 m/s, 24 f at most | yes | yes: 30 f at most, 6 at least | yes, 9 m/s |
| **pinball** | a roll, 10 m/s, 16 f | 0–8 | 0.7×, 0.75× | the boost (invincible 0–20) | 1, a boost in the air | yes, at the boost's speed | no | yes, at the run's 12 m/s |

No feel rolls in the air; the press is dropped with its reason.

- **The air dash** switches gravity off for its frames and goes at the air dash's speed, once an airtime. Landing and
  a wall give it back, and out of it the air keeps its speed.
- **The dash jump** is a jump pressed inside a ground dash. It leaves on the press (action's 3-frame gather is
  skipped) and the air keeps the dash's speed until landing. A plain running jump's air tops out at the run.
- **X's held dash** lasts while the button is held, up to its frames, and a tap gives the minimum.
- **The dash wall jump** is a wall jump with the dash held. It kicks at the dash's speed and the air keeps it. A dash
  pressed while on the wall is held for the kick, not spent as an air dash.

## The stomp attack

The card's `pound` is an attack in the air turned downward. It drops in a straight line (no gravity's curve), after
an optional hang:

| feel | the press | the drop | on a body | on the floor |
|---|---|---|---|---|
| **realistic** | none: an attack in the air is dropped with its reason | | | |
| **action** | back + attack (attack alone stays the air jab): the **plunge** (Devil May Cry's Helm Breaker) | 4 f hang, 22 m/s | a launching blow (the finisher's ×12, lifted 35°), then it slides off | a shockwave hits a body within 1.2 m; 14 f of lag |
| **platformer** | attack: Mario's **ground pound** | a 12 f flip in place, then 20 m/s | a harder stomp (stunned 150 f) and always the high bounce, the jump not held | 10 f of lag; a jump in it is the **ground-pound jump**, 1.35× the jump's height (Mario Odyssey) |
| **pinball** | attack: the **bounce attack** (Sonic Adventure 2's bounce bracelet) | no hang, 25 m/s, balled up | bounces off 1.6 m, the body ricochets | bounces back up 1.6 m |

The Mario bounce has two layers. A plain stomp bounces low, or high with the jump held, so the player chooses. A
ground pound always bounces high: the commitment the flip cost buys the height.

## The feels

| | ground | jump | the light | hit | dodge | wall |
|---|---|---|---|---|---|---|
| **realistic** | run 3.5 m/s, accel 6 | commit 12 f (the gather), 0.45 m, no cut, coyote 3 | the take's 11 / 2 / 12, plants the feet | no hitstop, the body's own flinch (0.35 s) | a sidestep, no invincibility | stops; a stagger above 3.5 m/s |
| **action** | run 6.5, accel 45 | commit 3, 1.3 m, cut ×0.45, hang 5 f | 6 / 3 / 14, a 3-move string cancelled at active + 2 | hitstop 4 + 0.6/(m/s); combat-hit's stun 0.5 s × 0.85ⁿ; the finisher ×12 and lifted | a roll, invincible frames 2–15 | stops |
| **platformer** | run 6, accel 75 | commit 0, the platform rule's 8.5 m/s on g 20 / 34, cut ×0.5, coyote and buffer 6 | 4 / 4 / 10, keeps the run | a boop (2.5 m/s, a hop), then 1 s of mercy | an air dash | a bonk above 4.5 m/s |
| **pinball** | run 12, sprint 20, accel 7, decel 2.5, steering 200°/s | commit 0, 1.0 m, a tucked spin | 3 / 3 / 6 | a ricochet at 1.3× the speed | a boost that can't be hurt | a bumper: 1.3× back, capped at 20 |

## What the machine gate measures (nobody has played it)

`verify.mjs` runs every law on every feel. All 322 checks hold on the male and the female casts:

- **Ground.** 90 % of the run comes on the card's acceleration to the frame, and the run is never passed on the ground.
  Letting go stops the body on the card's deceleration.
- **Jump.**
  - A ground jump leaves on press + commit: 12, 3, 0 and 0 frames.
  - The full hold's apex is the card's height to the millimetre. Gravity is integrated exactly and split at the apex.
  - The buffer and the coyote windows are tested on their own, with the air jump and the wall set aside (an air jump
    takes a press that would otherwise wait for the landing).
  - A longer hold never rises less. A tap reaches 0.37 / 0.56 / 0.42 m in action / platformer / pinball, against
    1.3 / 1.81 / 1.0 m for the full hold.
- **Buffer and coyote, to the frame.** A press `buffer` frames before landing jumps on the landing; one frame earlier
  is dropped and says so. A press `coyote` frames after walking off an edge jumps from the air; one frame later does
  not.
- **The move.** Contact lands on press + startup. The fitted clip's contact frame is the startup, and its fist lands on
  the take's contact point (0 mm).
- **Hitstop.** Both bodies are frozen for the card's frames (4 in action, 2 in platformer, 0 in the others), then both
  move on.
- **The string.** A chained hit's advantage is `frameData`'s link to the frame. Action mashed lands all three hits,
  the last a finisher. Platformer never lands a second hit inside mercy.
- **The dodge.** A telegraphed hit (the sparring dummy's 30-frame jab) that lands inside the invincible frames is
  evaded. Without them (realistic, platformer), standing still, the telegraph lands.
- **The wall.** It answers as the card says: a stop, a bonk, or a bounce at exactly 1.3× capped.
- **Jumping on.** Dropped onto the critter, realistic and action slide off into open space, ending on the floor
  beside it with it untouched. Platformer stomps, squashing and stunning it, with the bounce's apex 0.6 m or (the
  jump held) 1.806 m to the millimetre. Pinball's spinning body bounces off no slower than it fell, the critter
  ricochets at 7.8 m/s, and unspun it slides. Action's enemy step jumps on the press beside the standing dummy; no
  other feel jumps there.
- **The laws over every run.**
  - No body passes a wall or a block at any speed, and the hero never enters the dummy. The floor plane is
    substepped at 8 cm.
  - Every press is accounted for.
  - An idle pad moves nothing.
  - The same pad gives the same trace, byte for byte, and the four feels play it four different ways.
  - Realistic's fitted jab is the take.
- **The air jump and the wall.**
  - Each non-realistic feel air-jumps once, rising its share of the jump to the millimetre; a further press waits,
    saying the air jumps are spent.
  - Against a wall with the stick into it, the body drops exactly the slide's speed each frame, facing out. Let go,
    it falls free.
  - A jump on the wall kicks off it at the kick's speed, fixed for every frame of its lock with the stick still into
    the wall, rising its share of the jump. A jump inside the wall's coyote time still kicks.
  - Action and platformer climb one wall by held kicks (each kick higher than the last); pinball does not. Touching a
    wall gives the air jump back. Realistic has none of it.
- **Guard and parry.**
  - A held guard blocks the jab from the front: no stun, the card's blockstun, pushed back. An attack pressed in the
    blockstun waits.
  - A guard pressed inside the window parries it; a frame earlier it only blocks. The parried dummy staggers for the
    riposte frames and the riposte lands linked.
  - The hook's arc: standing in its orange middle, a timed guard parries it on the frame the sweep reaches the
    middle. Standing in its red edge, the same guard only blocks, on the frame the sweep reaches the edge. Outside the
    arc it whiffs.
  - The perilous blow goes through a guard, and a roll's invincible frames evade it.
  - A hit from behind lands through a guard. Realistic blocks twice and the third breaks the guard; action never
    breaks, and its push back carries it out of the later jabs' reach.
  - Action's roll meeting a hit in its first 6 frames is a perfect dodge (the dummy's clock runs at half: 10 of its
    frames in 20); a later roll only evades.
  - The platformer and pinball refuse the press, and nobody guards in the air.
- **Hold and release.**
  - Holding the attack never delays the tap: the opener plays the same frames held or tapped, and a tap shows no
    charge.
  - The release is the beat: let go on the first level's frame count and level 1 fires on that frame; a frame sooner
    it fizzles and nothing fires. Each level fires at its own hold.
  - The heavy lands its startup after the release, on frame data's numbers, harder each level than the last and
    than the tap.
  - The stance drops a jump (charging), walks at the card's share (pinball's not at all), and a roll lets the charge go.
  - Pinball's stick aims the spin dash, which leaves along the aim at the level's speed. The platformer keeps the charge
    through a dash and a jump and fires in the air; each shot lands on the frame its speed says, with its level's push,
    and a wall stops one.
  - A hit taken loses the charge; the platformer's card keeps it and the release still fires.
- **The heavy-robot rules and the mech.**
  - The weight knob blends the presets (halfway at 0.5). Ridden in another game the card keeps its combat and walks as
    the mech. Each rule works alone on an ordinary card (the gait, the charge jump, the boost, the landing).
  - For heavy and swift: the walk builds on its acceleration; the gait dips at each footfall to the frame's share, a
    footfall every step; the boost is instant on its hover cushion, never landing, draining a frame a frame, skidding
    out on release; run dry it overheat-locks, refuses, and unlocks when full; a turn of the thrust costs its share;
    the gauge refills cold; a fall while boosting is caught on the cushion; a landing lags by the fall; boost armor
    keeps its share of the stun; the dodge overheats the heavy gauge and leaves the swift's alone.
  - The heavy charge jump: rooted in its squat, a tap at 0.36 of the height, the full charge at 4.84 and a leap. The
    swift quick boost: a burst at its speed for its cost, refused while cooling. The jetpack and the glider ride along.
- **The loadout.**
  - Ready time: a switch arms the next weapon's frames; a pull a frame sooner is dropped, on the frame it acts; a second
    switch re-arms it; a slot's own value wins (the grenade's).
  - Cooldown: a semi weapon's next pull a frame early is dropped, on the frame it fires; an auto weapon streams at its
    rate; a burst fires its rounds at its rate, commits, then waits its cooldown.
  - The magazine empties and auto-reloads over its time, refusing the trigger meanwhile, and reloads while stowed.
  - A charge weapon held its time fires one charged bolt on release, for its cost. An energy weapon overheat-locks when
    emptied and unlocks when full again (the special weapon never comes back).
  - A lob bursts where it lands and its splash takes a body beside the burst; the bazooka's proximity fuze bursts beside
    a near miss, which sails past without it; a straight round meets a body when its speed says.
  - Hitscan: the sight weapon lands only through the body, the area weapon also inside its assist ring; cover stops both.
  - Rounds leave while the jetpack stays lit; the trigger is refused in a roll.
- **The glider and the jetpack.**
  - With no gear a held jump does nothing in the air.
  - The paraglider opens on a press from a height, sinks and flies at the card's speeds, a press folds it, its stamina
    folds it on the frame, and too low the press is the air's as ever. The float keeps the height exactly for its
    frames, once a jump. The glides sink at their rate, settle on their speed, turn no faster than their rate, end on
    letting go; Knuckles' grabs a wall; a hit ends a glide.
  - The jetpacks lift above the jump's height, climbing no faster than their cap, burn out on the fuel's frame and
    refill on the card's schedule after landing; a press in the air lights one, letting go puts it out. Tails' flight
    flaps on each press, sinks slowly between and tires after its time, the presses then refused.
- **Ranged attacks.**
  - The rifle and the marksman are hitscan: a still body is hit on the fire frame, every round of the burst. A body
    running across is missed (the rifle's aim trails it, the marksman's locks early). Cover stops them.
  - A travelling shot reaches a still body when its speed says, and a sidestep started as it leaves clears it.
  - The spreads fan evenly (or all round), one shot at the hero. A jump clears the low ring and knife. The homing orb
    turns after a body walking aside and meets it. The lob lands where the hero stood (standing is hit, moving off is
    not). The bouncer bounces on. The wave weaves its amplitude either side. The gun knocks down for the card's frames.
- **What a hit does.**
  - Realistic's hit is a flinch (control kept, the run slowed); the others knock back (and up) and stun for the card's
    frames.
  - Mercy: a shot inside it passes through, one after it hurts (realistic: every shot hurts).
  - Maneuver armor: action dashing or sprinting takes no stun and goes on; the platformer's dash halves the stun;
    pinball running past 9 m/s takes no stun and keeps its speed. Life is still taken.
  - Out of life: down for the card's frames, then up again full; one-hit makes any hit the end; pinball's rings
    scatter on the first hit and the next is the end.
- **Offense armor.**
  - The dummy's jab stops at the tap and never lands; the hook and the perilous blow clank off it (no stun, no push)
    and land.
  - A heavy breaks the hook; nothing breaks the perilous blow, not even the top charge. The platformer's light shot
    breaks the hook (a trigger) where its light tap only clanks.
  - Realistic's haymaker shrugs off the first light hit and breaks at the second. Action's heavy shrugs off a light hit
    and lands, a heavy hit interrupts it, and the launcher's hyper armor shrugs off the heavy hook and lands.
- **Lock-on.** Realistic and action take the target and face it to a millionth of a radian while strafing at
  their strafe's share of the run. A locked side roll keeps its distance to the target to a millionth of a metre while
  sweeping round it (0.58 rad in action's roll), and faces it at the end; unlocked, the same roll drifts out. A locked
  roll forward closes and one back opens, exactly along the line. A target past range is refused, a second press lets
  go, walking out loses it, and a locked attack goes at the target against the stick. The platformer and pinball
  refuse the press.
- **The directional roll.** Each feel's roll goes along the stick, forward, right, back and left, with the facing
  unchanged to the bit, and each reads its way. The stick at rest is a backstep exactly as long as a roll back, and
  shorter than a roll forward (action: 1.21 m against 2.30). A roll pressed in the air is dropped. A telegraphed hit
  inside the roll's invincible frames is evaded, rolling forward into it.
- **The dashes.**
  - Each non-realistic feel's air dash holds its height exactly for its frames at its speed. A second in the same
    airtime is refused, saying it is spent, and landing gives it back.
  - The dash jump leaves on the press and every air frame keeps the dash's speed: 12 m/s against a plain jump's 6.5
    in action, 9 against 6 in platformer, 18.8 against 3.1 in pinball.
  - The platformer's dash ends at 6 frames when tapped and at 30 held.
  - The dash wall jump kicks at the dash's speed and still has it after the kick.
  - Realistic has none of it.
- **The stomp attack.**
  - Realistic has none, and the dropped press says why.
  - Each other feel's air attack holds still for its hang to the frame, then drops at exactly its speed.
  - The plunge and the pound land into their lag to the frame. The ground-pound jump reaches 1.35× the jump
    (2.438 m) to the millimetre.
  - The pound on a body stuns it 150 frames and bounces the full 1.806 m without the jump held.
  - The bounce attack rebounds 1.6 m off the floor and off a body, which ricochets.
  - The plunge launches a body it lands on and hits one beside it with its shockwave on the landing frame. Action's
    attack alone in the air stays the air jab.
- **Fixtures.** Each `fixtures/*.json` (the page's recorder writes them) is replayed in the page's arena on its own
  cast, with its expected events.

## The page

`lab.mjs` writes `action-lab.html`, one file of about 1.3 MB that embeds both casts' baked frames and runs offline.

- **Controls.** Keyboard: WASD move, Shift sprint, Space jump (hold for higher), J attack (hold to charge, release to
  fire; in the air, the stomp attack, action's is S + J, back and attack), K dodge roll, L dash, Q lock-on, U guard, F shoot, Z switch weapon, E the gear, M ride a mech, Y the shooter, O one-hit. Gamepad: A jump, X attack, B roll,
  RB dash, LB lock-on, RT guard, LT sprint. A standard
  gamepad works too (A jump, X attack, B dodge, a shoulder or trigger to sprint), and so do touch controls on a phone.
  A key tapped between two ticks still lands.
- **Feel and settings.** 1–4 switch the feel; C switches the cast (the same card on the other body). T toggles a
  sparring dummy that telegraphs a jab, G toggles its guard, and H swaps in the short critter to jump on.
- **Training-mode controls.** P pauses, `.` steps one frame, and V switches between the ¾ view and the side view.
- **Readouts.**
  - The last press, as frames and milliseconds from the press to its effect.
  - A frame bar: two seconds of the hero and the dummy, in startup, active, recovery, hitstop, stun, gather, air,
    invincible, guard and mercy, with the presses marked.
  - The event log.
  - The frame data, read off the live card.
- **Dials.** They edit the live card. The clips were fitted to the defaults, so a moved startup warps the clip about
  its contact frame (contact stays on contact).
- **Recorder.** A recorded run copies out as a fixture for `fixtures/`.

## Findings

1. **The clip cannot own a player's time; the card can own both.** Inverting the spike made contact and take-off land
   exactly where the card puts them. Nothing else in the spike had to change: `render` already maps beats onto frames,
   and the lab feeds it the card's frames instead of a register's multipliers.
2. **Anticipation the player pays for is latency.** Action's wind-up is deeper than realistic's (1.6×) inside a startup
   half as long. That pairing reads as a snap, not as a wait. The spike's slow, deep wind-up belongs to a telegraph,
   which is a separate dial. The sparring dummy carries it, at 30 frames.
3. **Realistic is honest and slow, by design.** Its jump waits 12 frames for the gather, and its string drops the
   third hit: the second jab links at −2, so the guard takes the cross. That is the spike's "a realistic string sits on
   the reaction time", now as frame data. A realistic *game* will want a dial between honest and snappy (the operator's
   call).
4. **Air read by vertical speed, not time.** Variable height (cut, hang) means the air time isn't known at take-off.
   Reading the clip's air by vertical speed (rising → apex → falling) plays any arc and any fall off a ledge. Engines'
   blend trees do the same, so it ports.
5. **The live rules have most of the jump already.** `rules-platform.js` already carries coyote, buffer, cut, rise and
   fall gravity and air control, and now ground acceleration (opt-in `accel` / `decel`, the card's `ground.accel` and
   `ground.decel`; before it, velocity was instant). It lacks hitstop, a generic knockback, and
   attack and dodge buttons (melee shares `fire`, dodge is a double-tap of boost). It has no frame-data timing either:
   the strike is `strikeDur` 0.9 s with a fractional contact window. Those are the integration's first pieces.
6. **Two combat stacks, one card.** `versus/` already has frame-exact hitstop, stun and a 4-frame buffer. The
   controllable world has poise and an opt-in combo rule. The card's `moves` and `hit` are the shape both could read.
7. **"Register" is taken.** It already names the body's form (`form: 'realistic'`, `/body-study --register`). The lab
   says *feel*.
8. **Measures worth an eye.**
   - The hero walk cycle is 0.70 m/s, a stroll, so the realistic card's 1.4 m/s walk plays the cycle faster than its
     own pace.
   - Pinball coasts 29 m after letting go at 12 m/s. That reads as rolling, but a level needs brakes.
   - Crossing the jog → sprint blend skates (the spike's finding), and the page shows it.

## Open questions for the operator

- Is *feel* the word? Should a genre carry two feels, one for traversal and one for combat? The card splits cleanly
  into ground and jump on one side, moves and hit on the other.
- Realistic's commit: an honest gather (12 f) or a brief one?
- Pinball's attack: the body itself (spin into things) or a strike at speed?
- Should the dodge be buffered too? Today it is dropped with its reason when it can't act.
