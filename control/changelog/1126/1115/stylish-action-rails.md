### Stylish action: fights settled in the room, laid into levels

In progress. Built so far, all in the practice door's game room
([docs/game-room.md](../../../../docs/game-room.md), "A fight"):

- **Built: the brief reads the kit** (`gameroom/needs.js` `kitAsks`). Each move asks something of the place and
  says why: a ring, headroom, a run-up, a perch, a gap, the lock. A kit without the move asks nothing.
- **Built: a fight composed** (`gameroom/fight.js`), in four kinds (a duel, a melee, a gallery, a boss fight), from
  new room pieces (a rift, a perch, an urn, a font, a dais), with its ways, rifts and ring named, and held to its
  own laws beside the room's (ring, headroom, run-up, seen, lock, put-back, asked).
- **Built: a fight played.** The room's menu has a Fight choice (`&fight=<kind>`, `&seed=<n>`). Waves are written
  by role or by a foe's id; the foes stand asleep at the rifts, on the perches and on the dais; the hero is armed
  with the kit. The fight begins when the hero steps into the ring, every way is sealed until the last wave is
  down, and a death begins it again.
- **The wave gauntlet takes two more settings**, each adding nothing where it is not said: an arena that waits to
  be walked into (`enter`) and other ways sealed beside the way out (`seals`).
- **Measured:** the scripted floor player wins a duel, a melee and a boss fight on the stand-in bestiary; one who
  does nothing wins none. It does not win the gallery (it has no answer to a shooter on a perch). Nobody has played
  them yet.
- **Built: a game's own fights.** `fights: { <name>: { kind, seed?, waves? } }` keeps a fight on the world by name;
  the room plays it by that name, and `design_game` says what is kept, the laws each loses and whether together
  they answer everything the kit asks. A world that keeps none is offered one of each kind, never laid unasked.
- **Built: the loadout's first part** (`gameworld/carried.js`). `loadout: { slots?: { melee }, start?: { melee,
  sidearm } }` says what the hero carries of the game's weapons: two melee weapons at once unsaid, in the order
  the weapon switch steps through them, and the sidearm or none. It is laid on every level's hero and in the game
  room's fights. A world that writes none carries its whole kit, as before. Choosing it at points in the game is
  not built yet.
- **Built: the switch cancel.** An arsenal says `switch: 'cancel'` (the stylish kit does): the weapon switch
  pressed mid-swing is held to the move's switch point (its cancel, or the end of its blow for a move with none, a
  finisher), the rest of the move is cut with no rest and no cooldown, the next weapon is in hand, a press that was
  waiting opens its string at once, and the string's count carries on. One weapon's string chains into the
  other's. An arsenal that does not say it switches between moves only, as before. Every page that embeds the
  runtime is re-pinned for the lines this adds.
- **Fixed: a swing trail from a weapon that is put away.** A hero that switches to the fist keeps its other figure,
  blade in hand, animated out of sight, and that hidden blade still left its trail. A body that is not drawn leaves
  none now. Every page that carries swing trails has that one line more.
- **Built: a building to fight through** (`era/programs.js` `citadel`). A pathed plan of four rooms in a chain, each
  sized for a fight of a kind as the stylish kit asks it: a gate court (a duel's), the great hall (a melee's), the
  long gallery (a gallery's), the sanctum (a boss fight's), with the route through its doorways. A new law, `fits`,
  says whether any room a level gives holds a fight (its ring, the way round it, the headroom a launch asks). It
  is built on the seventh-generation basis: the ashlar kit (`gothic-ashlar`), read in `gen-7`.
- **Built: a level's tasks** (`gameworld/tasks.js`). A building level says its fights in order,
  `goal: { tasks: [{ fight, at }] }`, each a fight the world keeps, laid in a room: composed on the square the room
  holds, turned to the doorway the hero comes in by, its pieces standing as the stage's props (new pieces: a pillar,
  a perch, an urn, a font, a dais), its foes asleep until their wave. A fight begins when the hero steps into its
  ring and seals its own room's doorways until its last wave is down; a death begins that fight again at its
  doorway; the last one down ends the level. The wave gauntlet takes an arena's own `seals` and `start` for it, and
  arms the next entered arena at the clear.
- **Built: the action game's first level** (`gameworld/action-first-level.js`): the citadel with a duel, a melee, a
  gallery fight and a boss, against zombies and armed skeletons (the slow dead, the armed skeleton, the archer, the
  armoured dead, the knight).
- **Measured:** the scripted floor player walks the citadel's rooms in order and wins all four fights; one who does
  nothing wins nothing. The scripted player now walks a level that ends on its fights point by point. Nobody has
  played it. Not yet: the task said on the HUD.
- **Made through `design_game`:** the first level as a whole game, Fallen Angel, with made figures: Lucien on the
  realistic body (long dark hair, a long dark coat), the five undead, the citadel, the game; the recipe and how
  to rebuild it are in [docs/examples/fallen-angel](../../../../docs/examples/fallen-angel/README.md). The door's
  own check played it: the floor player won, one who does nothing did not.
- **Built: a fourth sword art, `wild`** (`polygonizer/hero-swing-body.js`): a brawler with a blade. The anime
  sword's reach with none of its composure: the hips spun until the back is to the target, the weight and the off
  arm thrown furthest, a taller, looser, longer stance, the anticipation and the finish held least, the cut
  fastest. Held to the laws every art keeps (the legs reach, the blade clear of the head and the floor). Lucien's
  kit is Fallen Angel's swung in it.
- **Fallen Angel in the seventh generation:** its citadel is dressed by a gothic night cube read in `gen-7` on the
  ashlar bones, and Lucien's coat is pale so he reads against the dark.
- **Built: the style meter's runtime** (`worlds/controllable/style.js`, a game's `styleMeter`). How well the hero
  fights, read off the world each step: it rises on blows landed, more for a move not just used, a blow in the
  air, a launch, a switch mid-string, a parry and a foe felled; it falls with time once nothing lands and drops a
  whole tier on a hit taken. Tiers are letters (D to S) unless the game says its own words. `styleMeter: 'auto'`
  lays it on a game whose feel is the stylish template; a game that writes none carries none, and its pages keep
  every byte. The page says where it stands (`window.__mojStyle`), and the scripted player's readout says the tier
  it peaked at and its longest combo.
- **Built: the style meter on the HUD** (`game/hud-mana.js`, the page's HUD host). A level that carries the meter
  draws it at the right on the game UI runtime, in the game's look: the tier's name and, under it, the combo's count
  while there is one; it stands only while there is style to show. Such a level's own rows are drawn there with it,
  whether or not the world writes a `ui`. A level with no meter keeps every byte of its HUD.
- **A principle: a stylish action game's HUD draws no box.** What stands on the screen is letters and figures over
  the play, on no plate; what changes is said by effects and motion on them, never by a frame; and nothing is
  explained in words the play shows (a legend row is not drawn; a mark or an arrow says where to go). The level's
  HUD holds to it wherever the meter is carried: every region sits on no plate, the meter is its letter and its
  count alone. Seen on an action hero's page in a headless browser (the letter, the count rising blow by blow);
  nobody has played it.
- **Built: the meter's motion** (the HUD host, only on a page whose level carries the meter). The tier's letter fills
  from its foot as the tier is climbed; a tier gained slams it in, a tier lost shakes it; the top tier glows. The
  combo's count is struck by each blow and grows heavier as the combo runs. In the theme's colours and display face,
  and still for a player who asks for less motion. Seen in a headless browser at three tiers; nobody has played it.
- **Built: the rank on a level's results** (`game/rank.js`, a level's `game.rank`). A level of a game that carries
  the meter is ranked as it is won: one letter of the meter's own tiers, the mean of three marks (the time against a
  par, the highest tier reached, the hits taken). Its figures (the time, the style earned, the longest combo) join
  the level's kept numbers, so the results screen shows them and the play shell keeps each one's best. The par is
  counted on paper from the level's tasks (a fight's walk in, and each of its foes); a level with no tasks is
  ranked on style and how clean it was alone. A level that is not ranked keeps every byte. Seen on a page ended in a
  headless browser (its result carried the rank and the three figures). Not yet: the par a level writes itself,
  the best rank kept as a letter.
- **Built: the immersive UI on the game's screens** (`game/immersive-ui.js`, a game's `ui.immersive`). A game that
  carries the style meter has its title, pause and results drawn on the game UI runtime with no box, whether or
  not it writes a `ui`: a window, a banner and the legend sit on no plate and in no frame, no veil is laid over the
  play behind a screen, and what is chosen is marked by its arrow alone. The letters carry the look: a light rim
  and a light shadow in the theme's own accents (cut one way, lit the other), a soft glow of the same, then the
  dark that keeps them read. A rank is its letter, stamped large, with no caption. The HUD's meter and readouts wear
  the same letters. A game that does not say it keeps every byte. Seen in a headless browser: the results screen
  (the outcome, three figures, the rank's letter, the menu and its arrow, nothing framed) and the meter. Nobody has
  played it; the key chips in the legend still draw their own small frames.
- **Built: the way on, as an arrow** (a level's `manaHud.ways`, the HUD host). Between a level's fights an arrow,
  and no words, points to the next fight's ring: over the place while it is in view, at the screen's edge turned
  toward it while it is not; gone once the hero steps in. It reads the gauntlet's own word for the arena waiting to
  be walked into. A level without it keeps every byte. Seen in a headless browser at the screen's edge, turned to a
  place out of view; the arrow over a place in view was not caught there, and nobody has played it. Not yet: an
  arrow to a level's way out.
- **Lucien's coat redesigned** (Fallen Angel's recipe, `docs/examples/fallen-angel/world.json`). The coat's body to the
  hip and its long skirt as drape panels from the waist: two long tails at the back, a panel at each side, so a
  raised knee passes between them where it went through a skirt that was one tube round both legs. The dark top
  painted on the body (a second skin) under it, so there is no shell of it to come through, and the coat at its full
  wearing ease. Read in both canons; the advice left asks for a waist return, declined so the coat clears the body.
- **Lucien dressed over his seams.** Where the coat still shows its joins in play, it is dressed over them: a leather
  harness crossed on the back with small strapped shoulder caps over the shoulder blades, the coat's sleeves rolled
  to the elbow so no cloth crosses its bend, and flared leather gauntlets. Two words new to an outfit card for it:
  an outer layer's `cuff: 'rolled'` (the sleeve's end turned back on itself, a band of its cloth a layer out and a
  shade down) and `hands: '<a glove card>'` (gloves worn from the card, as a word list's glove word is: a game's
  hero, whose clothes are one card, wears gloves so). A card that says neither keeps every byte. Seen on the level in
  a headless browser: the shoulder blades and the elbows covered; the small of the back and the hip hem not yet.
- **Lucien's shoulders, again.** The crossed harness gave way to the coat's own shoulder straps (`epaulettes`) over the
  small caps, and a STOCKING under the coat (`outer.stocking: true`, a word new to an outfit card): a second skin of the
  coat's own colour on the upper arms and the yoke, so what a bent arm opens under the coat's shoulder shows the coat's
  pale and not the dark top. Measured on the body, the arm overhead: the dark top shown at the shoulders down by three
  quarters. Found on the level: the sawtooth left is the page's, not the cloth's. A hero is drawn there as rigid parts,
  each vertex carried by its one strongest bone, so at every joint the layers step past each other in teeth; the
  fauna are drawn as one skin where it holds, a hero not yet.
- **A realistic body keeps the realistic head.** A game in the western tradition drew its hero with the landmark head
  even on the realistic body, whose own head is the realistic one. Now a hero on the realistic form wears it,
  with a face (the world's seed unless the head page writes one, so the hair grows: the realistic head grows its
  hair from a face). The head page takes the face's `skin` too (its beard, the hair's colour on the brows). Lucien:
  the realistic head, a western face, clean-shaven, light-brown hair cut to the jaw (`angled`), the face clear.
- **Built: a hero drawn as one skin** (realistic laws 17, the realistic body's doc, "One skin on the page"). A realistic
  hero minted under them is drawn on the page as skinned parts on one skeleton, every corner carried by its own bones,
  keeping its paint, normals, face and light; the page's bank keeps its weights. The sawtooth where the cloth's layers
  met at a joint is gone from Lucien at rest and in a swing (seen in a headless browser on Fallen Angel's level). A
  hero minted before, and every page without such a hero, byte for byte as it was. Its page carries the weights, a byte
  each: Fallen Angel's export went from 39.6 MB to 48.6 MB.
- **Built: the transformation seen.** Transformed by the Halo Meter, the hero grows a pair of black angel's wings on
  his back behind the coat (feathers in rows along each arm, unfolding as it begins and beating slowly while it lasts),
  a golden halo stands tilted just over his head, his hair turns white and his skin dark grey. The hair and the skin
  are told apart by marks the level asks of the piloted hero's figure (`packLayeredRig` `marks`: each corner its
  triangle's class), and, where a realistic head's hair is painted into its skin, by the hair's own colour on the
  page. Only a game whose meter carries a halo; every other page as it was. Seen on Fallen Angel's level in a
  headless browser; nobody has played it.
- **Fixed: a coat's shoulders under a raised arm** (realistic laws 17, the realistic body's doc, "The correctives").
  The tailor's cloth now carries the skin's correctives: each of its points moves as the skin nearest it moves. A
  raised arm had pushed the shoulder's skin out through the coat (the marks on the shoulder blades, the deltoid
  showing). Measured: of what the coat covers at rest, an arm raised overhead now shows under half. A hero minted under
  laws 16 or before keeps its bytes. Left: the bare forearm at a bent elbow, a little.
- **Built: the Halo Meter** (`worlds/controllable/style.js`, a meter's `halo`). The power a stylish hero builds by
  fighting, in stocks: blows landed fill it (more in the air), a hit taken fills it a little; it does not fall
  while it is not spent. The stylish template's meter carries one (`styleMeter: 'auto'`); a meter that does not say
  it has none, and its pages keep every byte.
- **Built: the transformation the Halo Meter buys.** With the stocks it takes full (three unless said), the transform
  press (B, a pad's left stick) transforms the hero: its blows hit harder and it runs faster while the meter drains,
  its own health heals, and it ends when the meter runs dry or on a second press, everything given back. While it
  lasts the meter fills no further. It is seen: a ring of light over the hero's head and its light on the hero, a
  burst as it begins; the HUD says it without a word (the meter breathes when it is ready, the figure glows while
  it lasts). Measured on the runtime and seen on Fallen Angel's level in a headless browser (the meter full, B held,
  the ring over Lucien's head). Not yet: the level's own health (the fights' row on the bus) is not healed by it,
  and no new body, moves or sound come with it. Nobody has played it.
- **Built: the vitals** (the HUD host; a meter's `vitals: { look, hp, halo }`). The health and the Halo Meter
  drawn as one figure, no box: a crest at their root, each bar drawn at its share of the length it reaches by the
  game's end (the health twice its start unless said, ten stocks), so a short bar at the start reads as composed as
  a long one at the end; one end cap at any length and one rhythm of stocks however many. A hit's chip is held a
  moment, then drains. The sprint rides as a hairline over the health. Three looks for how the forms answer:
  `overlap` (one slant, the gauge riding over the health's lower edge, both under the crest), `contrast` (the
  health a thin pointed blade, the gauge heavy blocks, the crest round), `echo` (one form twice, the gauge a step in
  and down). Lit as the letters are. Seen in a headless browser at a game's start, mid-hit, late and fully grown,
  each look; nobody has played it.
- **Fallen Angel remade with all of it**, through `design_game`, and its level's own page seen in a headless
  browser: Lucien in the gate court with the health bar, the weapon's count and the meter (its letter and its
  count) standing over the play on no plate. What that showed, and what was put right: the wave's banner and the
  cleared toast are not drawn on an immersive HUD (passing words; the banner's figures were never filled in either),
  the page's own weapon panel loses its plate there, and the letters are light whatever ink the theme's plates
  were written in (the world's palette had made them dark on a dark hall). The door's check played it again: the
  floor player won in 122 s, all 18 foes down; one who does nothing did not. Nobody has played it.
- **A building level has its action hero.** A world played under the orbit camera with a hero that strikes now
  gets, in a building as on a trail, the orbit that locks on, movement in the camera's frame and its sheathed
  twin, so the fist is in its hands and the weapon switch has two weapons to switch between. Before, a building
  level's hero carried the blade alone.
- A prop's surface a kit does not carry is painted in the kit's nearest of its own (a pillar in a gothic hall is its
  pilasters' stone); a kit that carries the surface reads as it did.
- Not yet: urns that pay and fonts that heal in play, a fight approved on its own or edited piece by piece, and
  everything below.

What the theme will hold:

- **The room settles the fight.** The practice door's game room reads the hero's kit: a launcher asks for
  headroom, a pack of foes for open floor, a dashing thrust for a run-up, the pistols for a foe out of the blade's
  reach. New room pieces answer them (a place waves come in, a high perch, an urn that breaks and pays, a font
  that heals, a boss's dais), new kinds of fight are composed from them (a duel, a melee, a gallery, a boss
  fight), and the room laws check each. A fight is played there with its waves and its ways sealed, and one the
  creator approves is kept on the world by name.
- **The loadout.** What the hero carries is chosen from the game's weapons: melee weapons switched in play, a
  switch chaining one weapon's string into the other's, the choice made at points in the game (before a level, at a
  rest between fights, when a weapon is earned).
- **Levels stay the geocube's.** A level's fights are laid by the same rules into a building's rooms (a dungeon,
  sealed at its doorways) and onto a trail's ground, in order, the task said on the HUD, a boss in the goal room.
- **Style.** A meter in play that rewards varied strings, the air and a clean run, and a rank on a level's
  results, its best kept.
- **From a sentence.** A stylish action game asked for in a sentence gets its kit, its set-up and a first level:
  an approach that teaches the string on one foe, then a dungeon that tests it.
- **A bigger dungeon.** A walled-core dungeon's fights grow heavier with depth, and its gates are played.
- **Built: the transformation mends the level, and its ready moment.** A level that keeps its own health on the bus is
  mended while the hero is transformed (`halo:heal`, the whole points healed, added up to the level's starting health;
  `game/level-synth.js`), as his own body's health already was. The bus hears `halo:ready`, `halo:on` and `halo:off`,
  and the HUD marks the instant the gauge comes full once (a ring off the vitals' crest, the gauge struck white) before
  it breathes. A level without the Halo Meter, or with no health of its own, gains no rule.
- **Built: tenebrae, a room's shade asked.** A stage asks its `shade` (0.02 to 0.6, a geocube's `light.shade`): the
  share of the light a surface turned from every lamp keeps, asked of the form render's solve (`era/stage.js`,
  `form/room-light.js`, which now says the contrast its paint would take, `own`), so its shade falls to black and its
  lamps light pools. Its air is lit as its shade is (the fog and the void darkened with it), and its figures, drawn
  unlit, take the room's light where they stand (`scene/channels/form.js` `lightAt`, the controllable channel's room
  light): a body walks out of the torchlight into the dark. A grade word, `tenebrae`, joins the grades. Fallen Angel's
  citadel is lit so. A room that asks none, and every other page, as it was. Machine gate only: seen in headless
  shots, nobody has played it.
- **Built: the citadel raised.** Fallen Angel's citadel takes the height its seventh-generation kit was drawn for
  (`building.rooms`: the gate court 10 m, the gallery 14 m, the great hall 16 m, the sanctum 18 m, from 7 m and
  10.5 m). The law checks (`era/law-checks.js`) fold a building's faces for its crown and its darkest corner instead
  of spreading them into one call, which overflowed the stack on a stage this size.
- **Built: the chase sees a tall room.** The follow camera takes `tall: { rooms, from?, span?, back?, rise?, look? }`
  (`worlds/controllable/rules-basic.js`): standing in a room over `from` (7 m), it eases back and up and lifts its look,
  by how far the ceiling stands over it, never through the ceiling. A building level played with the action orbit
  asks for it (`tall: true`, `gameworld/levels.js`); the page fills in the stage's rooms over the threshold
  (`worlds/world-scene.js`), and a building with none so tall keeps its page as it was.
- **Built: the figures lit and shadowed by the room.** In a room that asks its shade, a body is no longer tinted by
  one number: each surface is lit as the room is (the ambient, the six lamps nearest the pilot each by its falloff and
  how the surface turns to it, a cold rim where it turns from the eye), on its own material, so a body has a lit side,
  a shade side and an edge against the dark. And each throws its shadows on the floor it stands on: from the two lamps
  that light it most, its silhouette laid flat away from each flame, as dark as that lamp's share of its light and
  fading with its length, and a dark at its feet; one plane each pixel darkens once (the floor never moves: the
  projection is the shadow). The form probe hands the lamps over (`__mojForm.lit`). Walls take no actor shadow yet.
- **Fallen Angel's citadel lifted.** With the figures lit and shadowed by its lamps, the room no longer has to be as
  dark to read: its shade keeps a little over a third of the torches' light (`shade: 0.38`, from 0.06), and its grade is
  `tenebrae` with the vignette eased and a quarter stop more exposure.
- **A body's shade kept deeper than the room's.** A body lit by the room takes a share of its fill (a third), not the
  whole: the room can be lit to be read and its cast still modelled hard by the lamps, a lit side against a dark one.
- **Built: a room's light designed.** A stage's `plot: { <room>: { torches?, fill?, key?, lead? } }` (a building's
  `plot`, carried to its stage) lights a room by design rather than by the kit's rhythm: how many of its wall torches it
  keeps, spread round it (the rest taken down, fixture and all); what each gives; the gain on what hangs over its floor
  (the candle rings: its key, a pool over the fight); and its way on, the doorway on the shortest way to the building's
  goal, framed by a brighter pair of torches. The form render's bake is solved against its median lamp, so a plot's
  contrast is its lamps' strengths against each other. Fallen Angel's great hall is lit so; its other rooms keep the
  rhythm. A room the plot names none of, and every stage without one, as it was.
- **Built: variety in a room's light.** A plot's room takes `vary` (each flame its own strength and colour, from an
  ember's low red to a bright one's, by where it hangs) and `cold` (a moonlit lancet high on the wall facing its way in,
  its slit drawn and its cold light falling into the room: a second colour with a cause). A toned room solved for a plot
  keeps its lamps' hues against its reference lamp (`form/room-light.js` `hued`: the median lamp neutral, so its ramps
  stand), so an ember and a moon read as such; every other toned room's lamps stay without hue. Fallen Angel's four
  rooms each take their own.
- **Built: a weapon held as its own item, and Fallen Angel's bo.** An arsenal's weapon takes `held` (an item's build
  words: a staff, a spear): the run mints a hero of its own for it (`hero-held-<weapon>`, the sheathed hero with the
  item in its right hand, the blade on the back), the level names it (`combat.held`), the runtime shows it in combat
  while that weapon is up and the sheathed hero out of it (the item manifested, never holstered), and its moves are baked
  on that hero. Fallen Angel's second weapon is a bo in the fist's place: two wide sweeps and a spin, a poke, and a string
  that ends on the heavy in a ground slam all round with a toppling knockback.
- **A coat's storm flap** (an outer layer's `stormFlap: true`): a layer of the coat's own cloth hung from the yoke over
  its upper back to below the shoulder blades, the trunk's alone so an arm swings clear, its hem free and standing proud
  of the coat behind it, toned a shade down (`Flap`) so its edge reads on the back. Lucien's coat is now one coat from
  the shoulders to the knee, the back the sides' length and flared evenly round the hips (`hem: 'knee'`, `cut: 'aline'`,
  the tails and panels gone), with the flap over its back.
- **The posed coat** (an open coat's `posed: true`, on the realistic body): the long open coat that fights, by the
  compromise action games made for it. Its skirt is split at the back from the hip into two halves meeting at the vent
  (`body-relational-jacket.js` `ventBack`), each hung on three hinges at the hip (front, side, back) carried by the
  pelvis, not the thighs; every clip sets them by its family (`polygonizer/coat-poses.js`): standing, at rest, the coat
  wrapped round the hips; walking, behind them, its fronts swept round to the sides so the legs stride through; in
  action (a strike, a guard), open at the back from the hip, the halves hung behind and beside the legs, their hems
  kicked out a little; in the air or a whirl (a jump, a spin, the slam), flared, each half swung out and up. A posed coat
  is worn wide open, and its hem's lining is hinged as the hem it is sewn to. The hinges ride the pose's `flow`, so a turn
  of the hips carries them and the page's blend between clips blends the coat. Absent, the coat, its rig and its clips
  as they were. Lucien's coat is posed, to mid-calf, and his build a V: shoulders broad, waist and hips narrow, legs
  long, lean and defined (the body's `tune` and `physique`).
