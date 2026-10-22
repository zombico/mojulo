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

## The feels

| | ground | jump | the light | hit | dodge | wall |
|---|---|---|---|---|---|---|
| **realistic** | run 3.5 m/s, accel 6 | commit 12 f (the gather), 0.45 m, no cut, coyote 3 | the take's 11 / 2 / 12, plants the feet | no hitstop, the body's own flinch (0.35 s) | a sidestep, no invincibility | stops; a stagger above 3.5 m/s |
| **action** | run 6.5, accel 45 | commit 3, 1.3 m, cut ×0.45, hang 5 f | 6 / 3 / 14, a 3-move string cancelled at active + 2 | hitstop 4 + 0.6/(m/s); combat-hit's stun 0.5 s × 0.85ⁿ; the finisher ×12 and lifted | a roll, invincible frames 2–15 | stops |
| **platformer** | run 6, accel 75 | commit 0, the platform rule's 8.5 m/s on g 20 / 34, cut ×0.5, coyote and buffer 6 | 4 / 4 / 10, keeps the run | a boop (2.5 m/s, a hop), then 1 s of mercy | an air dash | a bonk above 4.5 m/s |
| **pinball** | run 12, sprint 20, accel 7, decel 2.5, steering 200°/s | commit 0, 1.0 m, a tucked spin | 3 / 3 / 6 | a ricochet at 1.3× the speed | a boost that can't be hurt | a bumper: 1.3× back, capped at 20 |

## What the machine gate measures (nobody has played it)

`verify.mjs` runs every law on every feel. All 70 checks hold on the male and the female casts:

- **Ground.** 90 % of the run comes on the card's acceleration to the frame, and the run is never passed on the ground.
  Letting go stops the body on the card's deceleration.
- **Jump.**
  - A ground jump leaves on press + commit: 12, 3, 0 and 0 frames.
  - The full hold's apex is the card's height to the millimetre. Gravity is integrated exactly and split at the apex.
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
- **The laws over every run.**
  - No body passes a wall or a block at any speed. The floor plane is substepped at 8 cm.
  - Every press is accounted for.
  - An idle pad moves nothing.
  - The same pad gives the same trace, byte for byte, and the four feels play it four different ways.
  - Realistic's fitted jab is the take.
- **Fixtures.** Each `fixtures/*.json` (the page's recorder writes them) is replayed in the page's arena on its own
  cast, with its expected events.

## The page

`lab.mjs` writes `action-lab.html`, one file of about 1.3 MB that embeds both casts' baked frames and runs offline.

- **Controls.** Keyboard: WASD move, Shift sprint, Space jump (hold for higher), J attack, K dodge. A standard
  gamepad works too (A jump, X attack, B dodge, a shoulder or trigger to sprint), and so do touch controls on a phone.
  A key tapped between two ticks still lands.
- **Feel and settings.** 1–4 switch the feel; C switches the cast (the same card on the other body). T toggles a
  sparring dummy that telegraphs a jab, and G toggles its guard.
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
   fall gravity and air control. It lacks ground acceleration (velocity is instant), hitstop, a generic knockback, and
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
