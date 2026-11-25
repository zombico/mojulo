### The metroidvania map: a spiralling box, greybox first

- **In progress.** A metroidvania's map laid as one box entered from the left, its way spiralling inward ring by ring
  to a core: along the floor, up the far side, back along the top, down the near side, then a gated step into the ring
  inside. Each ring is a region of its own; the core holds the last boss. Every ring lies against the one outside it,
  so a power found deep in the box opens shortcuts back out and pockets in rooms already walked.
- The gates are rows: a grate passed in a small form, a sill reached on a double jump, a cracked wall broken by a
  special strike, a locked door and its key, a boss's seal. Each has its own shape in the greybox.
- Vampire Sonata is its template: a storm-the-castle metroidvania with no stomp and no wall kick, the outer wall, the
  halls and the inner ward walked to the keep.
- The greybox is measured (the box filled, the spiral turning one way inward, both axes travelled, every gate opened
  by what was found before it, the way back shorter than the way in) and drawn as an elevation
  (`node scripts/metroidvania.mjs`).
- The box plays. A world's level can be a metroidvania box: it is built for the hero's height and measured jump, and
  played on the side-scroller's runtime with a camera that holds each room as the walk reaches it. Gates hold until the
  hero has what opens them. A key opens its lock as she reaches it, a boss's fall breaks its seal, a cracked wall falls
  to her blows once the special strike is hers, and an opened hatch is fallen through. Picking up the second leap gives
  her the double jump. Bosses are stand-in blocks until the foes join.
- Erina, Vampire Sonata's hero: a monster hunter drawn as a grown woman in the traditional anime register. She fights
  with Zero Boy's three-cut saber string, with no wall kick, no stomp and no buster. Her sword is a hunter's longsword, a
  new look on the equipment shelf: a silver blade under a winged guard, with nothing on it lit. A saber hero can now play
  the string with a steel sword (`blade: { steel: true }`): no light over the blade, and its slash in steel.
- The castle theme: a box can be dressed ring by ring. Vampire Sonata's castle stands under a moonlit night. Its ramparts
  are open to the sky, with merlons and torches. The great halls have arched windows, candles and a crimson runner. The
  inner ward is cold and mossy under pale lamps, and the keep has gold-trimmed stone, banners and braziers. Its stone is
  coursed and its light is baked from its lamps; the gates keep their colours so they still read.
- The castle is closer on its hero: Erina stands a fifth larger on screen than a side-scroller's hero, and the box is laid
  round her at that scale. She is drawn in mojulo's own anime look (her own face, shading and light), not the
  side-scroller's cel bands and outline.
- The castle plays as an action RPG, with no lives. Erina has health and MP, shown as bars. Walking into a save room
  refills both and makes it where she wakes. When her health runs out she wakes in the last save room she visited, full,
  keeping everything she has found and opened.
- Each castle room is dressed by principles of its own, the craft a dungeon's walls have in 3D carried to a side view's
  back wall. The wall is ashlar, block by block, with a plinth or wainscot, pillars, and a vault or beams under the
  ceiling. Every glance at the wall finds some detail, and the band behind the play stays calmer than the wall above it.
  Bays alternate by the wall's rhythm, and each room has one focal piece: the lord's portrait, a broken statue, the
  house's arms, a gargoyle. Columns and chains stand between the lane and the wall. The mood is dark: light falls in
  pools from candles, braziers and cold lamps whose flames glow, and dust hangs in their light. Each principle is
  measured.
- A box can take other shapes besides the spiral. A **serpentine** is climbed row by row, each row run back the other way.
  Its regions are bands of rows, and a chute down its middle drops back to the bottom: a bell tower walked through from
  its foot to its spire. A **hub** is a centre column reached up an approach. Its wings are walked out from it and back,
  each wing's prize opening the next, and a wing's boss sealing its way back: a courtyard. Each region is given its save
  rooms, key, boss and pockets the same way whatever its shape. Both are held to the box's laws, each to its own form, and
  Vampire Sonata has a bell tower and a courtyard drawn and played beside its spiral castle.
- The castle's rooms are drawn to Erina's scale. Books, swords, shields, candles, ladders and the wall's stones keep their
  true size against her, statues and portraits are life-size to heroic, and furniture stands on its floor. A tall hall is
  filled with more things at their size rather than the same things blown up. The library is now a case twice her height
  with a gallery and a second tier above it and a ladder between, in place of a shelf of metre-tall books. Each piece's
  size is measured against hers.
- The castle's walls are drawn with depth. They are laid stone rather than a grid of blocks, each course its own height
  and each block its own length. Piers stand at every bay with a base and a capital that the vault's ribs spring from. In
  the vaulted halls, slender shafts rise from carved corbels over the hero's head to the ribs, and the columns in front
  of the lane are round. The light is baked smoothly across every surface and shows the relief: columns are lit round on
  the side of their lamp, each stone is lit domed, and what stands out of the wall casts a shadow across it from each
  candle, torch and brazier, with the dark gathering around it and under the ceiling.
- A castle of boxes. Several boxes can be joined into one level through their ports. Every box is entered on its left. A
  climbed tower is left where its top row runs to, and a courtyard at its top right. A keep wound to its core is where the
  castle ends. The boxes are joined by connectors: a bridge open to the night, or a gatehouse with a save room and a gate,
  its own boss standing in it. Powers are found once across the castle and open things in the boxes after them. Each box
  is checked against its own shape, and the castle as one walk through all of it. Vampire Sonata's castle climbs its bell
  tower, crosses the bell bridge to an open courtyard, and passes the Gatekeeper into the keep. It is drawn as one
  elevation and played as one level.
- A game can have trees: a skill tree on how its hero moves and a tech tree on its spells and attacks. Movement skills
  turn the hero's own numbers: a second and a third jump, a higher jump, a glide, a faster run, a longer dash, an air
  dash more. Techs add to the hero's own strings: a lunging thrust, a cleave forked off its string, a launcher, a
  plunge from the air. Spells cost MP: a burst all round, a dashing cut, a spiral. A node is bought with points that
  bosses and prizes give, after the nodes it builds on, or is given when a power is found. Pressing T opens both trees as
  one screen to learn them in play. Erina's trees hold more than the castle's points buy, so she grows one way or
  another.
- The castle has an explored map, a tile for every screen, revealed tile by tile as Erina walks it. A map room's lectern
  shows its region's tiles before she has walked them. The map marks save rooms, map rooms and bosses (crossed out once
  felled), along with what is left to pick up. It draws an unexplored doorway as an opening into the dark. A gate shows
  in its own colour, ringed once she holds what opens it, so a power found tells her where to go back. The map also
  shows how much of the castle and each region she has walked. A minimap stays at the top right, and M opens the
  whole map.
- The castle is haunted. Each region names its foes from the game's bestiary: rats and crows on the walls, ghouls in the
  halls, wolves in the ward, undead armour in the keep. Walkers spread along corridor floors and flyers hold the shafts.
  The fight thickens toward the core, and the rooms where she rests, reads a map or meets a boss stay empty. Felled foes
  give souls, and souls become points to spend on her trees. Until their figures are made, the foes stand as blocks of
  their size and class. The castle checks that the foes stand clear of doorways and holes, and that between two save
  rooms she meets no more than her health can bear.
- The castle's bosses stand as real foes once its foes have joined. Each boss is read by name from a shelf of the
  castle's bosses: the Gate Warden, the Bellkeeper, the Great Bell, the Crypt Lord, the Lord of the Keep and the rest,
  each a foe class at the boss's rank, taller than Erina by its tier, its health a count of her blows. It stands in its
  room facing the way in and never follows her out. Its name and health show as a long bar across the bottom while she
  is in its room. Cut down, it gives what its room gives: its seal breaks and its power is hers. Until its figure is
  made, it stands as a tall block. The castle checks that every boss is on the shelf, has room to fight, and that the
  bosses never get easier going in.
- A boss's room shuts behind Erina once she is inside: an iron portcullis drops across each doorway and a grate covers
  each hole, until the boss falls. If she dies in the fight, she wakes at her last save, the room opens, and the boss is
  back where it stood at full health, so the fight starts over when she returns.
- The castle's bosses fight with telegraphed attacks. Each boss has three or four moves in its own words (the Gate
  Warden's halberd cleave, haft slam and thrust; the Bellkeeper's cracked bells; the Crypt Lord's pounce and howl; the
  Lord of the Keep's bat swarm and blood wave), in phases that come quicker as its health falls. Each attack is marked
  before it lands, and a pause follows it. Seen from the side, an attack is drawn upright along the floor as high as it
  reaches. A low one, like a front rolling along the floor or a low spring, can be jumped; a tall swing must be backed
  away from. A boss attacks only while Erina is in its room. The castle checks that every boss's attacks can be seen
  coming, escaped along the floor or jumped, survived and answered, measured with Erina's own run and jump.
- The boss pattern shelf learns the side view: a hazard can say how high it reaches, a jump clears it, and the pattern
  laws measure a body that can move only along a lane, with a jump among its escapes.
- The castle's bosses have their own figures, made through the character door like Erina: the Gate Warden as a death
  knight with a halberd, the Gatekeeper in crimson plate under a horned skull helm, the Bell Ringer and the Bellkeeper
  as dead monks, the Warden as a horned, tailed devil in a crimson robe, and the Lord of the Keep as a pale, silver-haired
  vampire noble. The Crypt Lord is a great shadow wolf from the animal door. Each stands in its room, grown taller than
  Erina. The Great Bell stays a block until a bell can be made.
- Their attacks have their own looks: a glint on the blade and a crimson crescent for a swing, glowing cracks and rolling
  dust walls for a slam, rings of shimmering air and a wall of ripples for a toll, a falling bell or a swarm of bats for
  a throw, and speed streaks for a lunge.
- The castle's bosses wind up with their bodies. Before a swing, a boss draws its weapon back over its shoulder; before
  a slam, it raises both hands high; before a throw, it draws its arm back low; before a toll, it spreads its arms and
  throws its head back; before a lunge, it sinks low on bent knees. As the attack lands it strikes through, then eases
  back to its stand. The great wolf does not wind up yet.
- The Great Bell is a bell now: bronze gone green at its waist with a gilded lip, hung from a timber yoke on chains. It
  swings back before it tolls and swings through as the toll rolls out, its clapper lagging behind.
- The Crypt Lord winds up like a wolf: it crouches with its head down before it pounces or mauls, then springs, and
  drops low with its head thrown up before it howls.
- The two knights lose the extra shoulder cape that sat over their armour like a roof, and carry heavier weapons.
- The castle's bosses trade their big shoulder plates for capes and grim details. The Gate Warden wears a black cloak to
  the floor lined in dried blood, a standing collar, a chain and a skull at its hip. The Gatekeeper's ragged cloak hangs
  with bone charms and skulls. The bell ringers carry bells and chains, and the Lord of the Keep wears a high collar and a
  floor-length cloak lined in crimson.
- Armour can leave pieces off: `adorn: { type: 'armor', without: ['pauldron'] }` wears a plate suit with its shoulders
  bare, so a cape can hang from them.
- The knights' cloaks are torn at the hem into ragged tongues, and rags hang off their plate at the hips and the
  shoulders: grave-cloth grey on the Gate Warden, rust red on the Gatekeeper. The Lord of the Keep's cape is lightly torn.
- A cloak can be torn (`{ kind: 'cloak', torn, tongues }`): its hem cut into tongues, the gaps torn up, the same cloak
  torn the same way every time. A new outfit piece, `rags`, hangs torn strips from the hips and the shoulders, draped over
  whatever is worn there.
- The Lord of the Keep is a woman now, androgynous: a slim body squared at the shoulder, a sharp, cool face and short
  swept-back silver hair, in the same crimson coat, high collar and torn crimson-lined cape.
- The Lord of the Keep has a second form. Cut down, she does not fall: she becomes the Lord Unbound, a black dragon on two
  legs, 2.5 times Erina's height, horned and spined, with crimson wings on bone swept back along it and gold at its throat
  and arms. Its health bar fills again under its own name, and it fights with its own moves: it rears with its wings
  flung wide, charges low, beats its wings into a storm of bats, and roars. Only its fall opens her seal; lose to it and she is back in her first form when Erina returns.
- A boss can be built with a second form (`second` on its row): a foe mode of its own figure, health, fight and size; a
  mode may stand at a height of its own (`body.fit` on the mode).
- Characters can wear wings: an outfit piece, `wings`, a pair of membrane wings on bone off the back, spread out or swept
  back along the body (`sweep`) so a side view sees them whole.
- The Lord Unbound's wings beat as it attacks, up and down through every wind-up and down with every blow, and it takes
  to the air: it dives out of the room's height to rake the floor (jump it), or rises over Erina and drops onto her (get
  out from under its shadow, then jump the shockwave). It flies only as high as keeps its head on the screen.
- Wings flap: each wing rides a bone of its own, beaten by its own clip word (`wingR`, `wingL`), which a character's clips
  can key.
- A boss's attack can fly (`flies` on a pattern: a path of keys through the move), lowered under its room's ceiling and
  the air the screen gives it (`sky`); two new attack patterns, `swoop` and `dive`.
- Four more boss fights in the castle: the Carrion Abbess in the belfry (a crow-nun who fights from the air on beating
  wings and throws her quills into the floor), the Siege Ogre in the lower keep (it rolls a boulder the length of the room:
  jump it), the Armiger in the armoury (an empty suit of gilded plate that bursts lances out of the floor under marks)
  and the Serpent Countess in the upper keep (a lamia whose tail sweeps the floor and whose venom burns where it lands).
- Five new boss attacks: `volley`, `lances`, `coil`, `venom` and `boulder`, and a hazard that rolls (`roll`), harming
  only where it is as it passes.
- A boss kept to its room stands on its floor: a tall boss no longer climbs a room's ledges between its moves.
- The new bosses' looks: the Siege Ogre is an oni (red skin, ivory horns, a loincloth of ochre and black), the Carrion
  Abbess a crow tengu (a mountain monk's whites, a red sash, a ringed staff), the Armiger's helm has a wing swept back
  off each ear, and the Serpent Countess has a crimson coil, a gold circlet and a black corset laced up her back with
  skulls down it.
- Characters can wear a corset (an outfit piece, `corset`), laced up the back with skulls set down the lacing
  (`skulls`); and a winged helm, the `wingedTVisor` headgear (its `earWings` ornament).
- The castle's HUD draws each thing once: one map (the corner map with how much is explored) and the boss's bar across the
  bottom of the screen; a boss's name shows alone as Erina enters its room, then fades.
- No map over the play: the map is on the pause screen and in the map rooms.
- Boss chambers are plain rooms fought in on their floor: no ladders, stairs or shafts. A boss whose room climbed moved to
  the nearest plain room of its region, and the Siege Ogre moved from the barbican (all shafts) to the lower keep.
