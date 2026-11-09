### Mojulo Fighter: a fight on any level, by its lane

A fight's arena is now any level that can say where its fight lane is. The lane (`versus/versus-lane.js`) is
`{ at, heading, half, floor, back? }`: where the lane's centre stands, the way it runs, its walls, its floor and the open
room on the camera's side. The fight level loader (`versus/versus-levels.js`) turns each kind of level's own words into
a world recipe and its lane, one row a kind: `stage` (the arena as it was, its recipe unchanged) and `greybox`. The
runtime draws the whole fight in the lane's frame (bodies, the ring, the fighters' lights, the camera and the overlay),
so a lane turned and off the level's centre plays as the old one did; a stored arena reads as a lane at heading 0 and
keeps its place.

- **The greybox world kind** (`level/greybox-scene.js`): `{ kind: 'greybox', blocks: [{ at, size, turn?, tone? }] }`,
  boxes shaded by value under one sun (floor, wall, prop, edge), no kit's look. A level of boxes, for blocking out.
- **Greybox fight levels**: presets that stress the lane (`flat`; `alley`, walled behind with little room for the
  camera; `rooftop`, on a raised floor; `turned`, off centre at 35°), each overridable by words.
- **A quick fight's arena may name a level**: `arenas: [{ id, level: { kind: 'greybox', preset: 'turned' } }]`; an arena
  without one is the stage as before.
- **The anime register in the fight**: a character drawn in the character light (the anime head's) is played in it.
  Its tones are the light's own (each group's shade swatch, the eyes unlit as drawn), baked twice, every group lit and
  every group in shade, and the arena steps between them by its own key as the body turns, so both fighters are lit
  from the camera's side whichever way they face. No outline is drawn on them. Every other body is lit as before.
- **The training ground** (`greybox` preset `training`): a fight's graybox stage, its middle the focus. Between its
  walls the floor is the light tone, ruled a line every metre (every fifth lighter), the centre a bold band on the floor
  and up the back wall; past the walls the floor falls dark and unruled. A wall stands at each of the lane's ends, a
  body's width past the sim's, banded light up its front edge, along its foot and on the floor where it stands, so
  where it is reads from the camera. The camera is near. A fight made now is fought there, stamped at mint
  (`arenas: [{ id: 'training', level: { kind: 'greybox', preset: 'training' } }]`) when it names no arenas; a fight
  minted before keeps the ring, the plaza and the nave.
- **A level's view**: a greybox level's `view` (`genre` | `near`, its preset's by default) says how near the camera
  frames the fight; `near` is the ring's framing (a fighter near two thirds of the picture), now any level's.
- **Attack priority** (`versus-library.js` PRIORITY): two strikes landing on the same frame, the higher level's lands and
  the other's does not (a `priority` event, PRIORITY on the overlay); equal levels trade as before. It scales with
  strength (light 1, medium 2, heavy 3, punches and kicks alike), a special's is its own (a rush 2 · 3 · 4 by strength, a
  spinning kick 2 · 2 · 3, an overhead 3, a fireball 1), a super's 4, and a reversal's (the DP, `rps: 'reversal'`, and
  the rising super) 0: its invincibility is how it wins. Any move takes `tune: { priority }` (0 to 5). Two laws keep it
  a balance: `priority-pays` (no grounded normal outranks one that starts no slower than it) and `reversal-yields` (a
  DP's priority is 0).
- **Joint limits**: a pose is held within the bends a body makes as it becomes joints (`versus-rig.js` RIG_LIMITS: a knee
  one way and not past 155°, the ankle from a pointed toe to the foot drawn up, the head 55° off the trunk, an arm no
  further than 45° behind the back), and the body in the round within its own (`versus-figure.js` FIG_LIMITS: no elbow
  past 150°, no knee past 155°, the spine twisted no further than 60°, the hips turned with the chest; a foot never folded
  up into the shin as it is drawn). A knee bends toward its own thigh's front (up when the thigh is raised),
  never sideways.
- **The body keeps out of itself** (`versus-figure.js` FIG_BULK, from the body's own skeleton): a hand, a forearm or an
  elbow that would pass into the trunk, the head, a thigh or the other arm is moved across the plane (the hand's depth,
  the elbow turned out), or the chest turned until the arm clears it (a rear straight squares the shoulders); a leg into
  the other is moved out. All in depth, so the side view, and the boxes, stay the sim's. `scripts/spikes/fighter/
  joints.mjs` reads every pose of every fighter against the limits and the bulk.
- **One look a game: the fight's register** (`register: anime | western`, stamped at mint from the setting's drawing
  tradition, western when it names none): every fighter is rolled in it and drawn its one way, under one light, on every
  arena of the game. `western` lit as an engine lights it (its albedo, relief and roughness), the shadows soft; `anime`
  cel, three tones stepped from the same light, the shadows stepped and the shade cool. The rig: a warm key from the
  camera's side and above that casts, onto the floor (a shadow catcher over the lane) and across the body itself; on a
  greybox it is the level's own sun (`GREYBOX_SUN`), so the room and the bodies share one light; a low cool fill so the
  shadows stay deep; a rim from behind; a sky over a dark ground. The key follows the fight, its shadow's box tight round
  the fighters. Every body is baked as the lit export under a register (the stick figure lit the same way). A fight minted
  before carries none and draws each body as it always did. `styles.mjs --register` bakes a matchup in either look.
- **The fight's effects** (`versus-fx.js`, drawn by `versus-fx.client.js` in the arena under a register): what happens
  told apart at a glance, kept to a fighting game's impact (not a spell's), one library for every art style. Each event
  has its card, parts the register skins its way (anime cel, hard bands round the white core and on twos; western
  material, a soft falloff and a glow standing in for bloom): a hit's small white-hot core, shock ring and rays; a
  counter's gold double ring and a faint blink; a block's striped shield arc bowed toward the blow; a parry's ring
  snapping in; a clash's starburst; a guard crushed in shards; a KO's bloom. A heavier blow is a little bigger, brighter
  and longer. All in shaders (the page has no bloom pass), timed by the fight's own clock, so hitstop holds an effect and
  slow motion slows it; a brief real light at the contact lights the fighters by the rig they stand in. The overlay keeps
  its words; its 2D sparks stand down under a register.
- **The figure coated, not drawn over** (`bodyCoat` in the arena): every fighter's material carries a fresnel coat, light
  on its own surface over the whole figure or a portion of it. A blow coats the one it lands on, round where it landed
  (a block rims the guard blue, a counter gold) or whole (a parry, a crush, a KO), fading with the moment.
- **A blow says what it was**: hit, counter and block events carry where they landed (`at`, the hitbox's overlap with
  the hurtbox), how heavy (`w`, light … super), what struck (`limb`: fist, foot, knee, elbow, head, blade, shot) and the
  move's kind.
- **The spark** (system `spark`): a counter hit struck on the strike's very first active frame, the blow and the
  opening met in one frame. Half again the damage, the moment held (`rules.sparkStop`), meter (`rules.sparkMeter`);
  drawn as a black spark: the picture turned negative for two frames and held, black currents with a red edge crackling
  out of the contact, the one struck darkened with a red rim, a red light, then it lets go.
- **Elements on the limbs** (`element: 'fire' | 'lightning' | 'frost' | 'void' | { kind, on: fists | feet | limbs |
  weapon }`, on a recipe or a roster entry), as a coat of light gathered round the limbs that carry them: fire a warm
  licking rim (flaming fists), lightning a fast white-blue flicker, frost a slow cold breath, void a darkening with a red
  rim; flaring as the limb strikes, and a blow struck with it coats the one struck in the element. Drawn only: the sim
  never reads it, and the same fight is the same fight. `styles.mjs --elements --systems spark` bakes them.
- **The fight's language in mana-ui** (`idioms-fight.js`, shelf `fight`; `docs/mana-ui.md`, "The fight's language"):
  a fighting game's own UI, quiet and side against side, grown from the shared templates and held to ten principles
  (two sides and one centre, health the frame, the fight never covered, a callout a word, the round's ritual, meters in
  stocks, the hit-stop holding it, quiet, the bars lit and moving, picked by their look). In the fight: `fight-health` (the bars meeting at the clock, read by length,
  a guard line under each, each side's tag on its own line over its bar), `fight-meters`, `fight-combo`, `fight-callouts`, `fight-announcer`, and training's
  `input-display`, `frame-meter`, `training-stats`; around it: `versus-splash`, `fighter-select` (each seat's fighter
  at its own edge, the roster between them), `fight-pause`, `command-list`, `training-settings`, `fight-results`. Its
  words are the runtime's (`WORDS`: the round's ritual, the callouts, the meters, the frame data), so a fight ships in
  every language its game does. The elements do their talking: the frame says no word but the names, training's
  readouts carry no headings; the versus screens give each fighter its art at full height (`portrait` `size: xl`,
  `caption: false`), and the select shows style and figures only with `stats: true`, so a fighter is picked by their
  look. The bars are lit and move with what happened: over the round the track sinks and each fill is glossed with a
  bright leading edge; a hit drops the fill and flashes the slice it took once (a new mark on the track, `mana-moved`,
  keyed by the change), the chip holds what the combo took and drains after a beat (drawn from the start under the
  fill, so it drains rather than vanishing), a gain glows, a super with a stock ready runs a sheen (`data-ready`), its
  stocks a whole numeral; less motion, less flash and a hit-stop each have their say. The second side is the first's reflection, part for part (held by `fight.test.js`): a row set at its end
  runs from that end, and over the round a row's parts are centred across and figures take even widths. A bar takes `size: large | thin` and `figures: false`; a region takes `variant: bare`
  (no plate, its parts their own frame); a filling row whose children say `fill` shares its width among them alone.
  Its looks are new theme cards of the family `fight`: `fight-clean` (the default), `fight-cel` (anime) and
  `fight-lit` (western), none leaning, stacking or slamming. The board draws a fight HUD, a training HUD and every
  fight screen. A table's column labelled by a word now reads as the word (it printed the object).
- **CI**: `design-game.vary.test.js` pins its order's roll (it drew one at random each run, and about one roll in
  four hundred lifts most of a late tier's ornaments past their 0–3 scale, the gate leaving two variants of three).
