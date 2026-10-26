// Shared routing-eval fixture — user phrasings → the entry tool the route
// must land on. Consumed by BOTH routing gates:
//   - routing-eval.integration.test.js (gate 2a): the RETRIEVAL hop — phrasing
//     → embedding search over routing cards → entry tool in top-K.
//   - ../tools/body-routing-eval.integration.test.js (gate 2b): the IN-CONTEXT
//     hop — phrasing + the forward_context studio body → the model names the
//     entry tool. (forward-context-grammar.plan.md, re-scoped audit #2.)
//
// Keep phrasings colloquial and OFF-card (verbatim card quotes prove nothing).
// A row may carry a third element, the MODE the tool must be called in (design_game's `compose`): the tool name
// alone is not the answer when one door has several ways in. routing-cards.test.js checks the tool's card teaches
// the mode; gate 2a checks the retrieved card does; gate 2b asks the model for it.
// When adding a creative capability, add 1–2 rows here — both gates pick them
// up automatically.

export const FIXTURE = [
  ['can you sketch our deployment pipeline as boxes and arrows', 'create_sketch'],
  ['bar chart of last month signups by week', 'create_sketch'],
  // a landscape is a scene: the geocube's land, walkable (card scene), not the old painted landscape
  ['paint a moody mountain valley at dusk', 'create_sketch'],
  // an illustration of a thing (a portrait, a picture for a story) stays an illustration
  ['an illustration of an old lighthouse for the cover of my story, moody and atmospheric', 'sketch_what_possible'],
  ['I want a picture of a woman mid-stride', 'mint_solid'],
  ['recreate the camera angle from this photo I am showing you', 'reference_protocol'],
  ['our company logo in shiny 3D chrome', 'mint_solid'],
  ['model a wine glass true to size', 'mint_solid'],
  ['write me a bracket with four bolt holes in openscad', 'mint_solid'],
  ['I have some .scad code for an enclosure, can you bring it in and show it', 'mint_solid'],
  ['put the wheels and the chassis together into one model', 'mint_solid'],
  ['what bearings and screws should my printed spool holder use, list what I need to buy', 'fabricate_solid'],
  // solid-powerscale: a fitted part by words, and furniture (no card until then)
  ['a little knob that screws onto an M6 bolt', 'mint_solid'],
  ['a green linen loveseat on hairpin legs for my den', 'mint_solid'],
  ['design this lamp so it can be built from hardware store parts', 'fabricate_solid'],
  ['I need a glowing crystal staff for my forest mage', 'mint_solid'],
  ['give my paladin a shield with a sun on it and make it chunky and stylized', 'mint_solid'],
  ['turn this concept art of an espresso machine into a 3d model piece by piece', 'mint_solid'],
  ['rebuild my drawing of a bicycle as a real 3d model one segment at a time', 'mint_solid'],
  ['build me a little town I can wander around in', 'compose_world'],
  ['turn my mountain painting into a world I can walk and fly over', 'compose_world'],
  ['a continent with a huge river running to the sea that I can fly over', 'compose_world'],
  // geocube: a level's look forged first, its room and island checked, then the level built on it
  ['I want a moody castle level where the halls and the grounds outside feel like the same game', 'create_sketch'],
  ['before we build the level, lock down its lighting and colours so the inside and outside match', 'create_sketch'],
  // a scene: a place to walk with nobody in it and nothing to play, the geocube's path
  ['Create a walkable scene of a colorful grassy field in the daytime', 'create_sketch', 'path'],
  ['just a quiet forest trail I can wander down, no game, nobody else there', 'create_sketch', 'path'],
  // game buildings: a building's rooms laid from its use, in a cube's look
  ['a spooky tavern for my game where you have to find your way down to the cellar', 'create_sketch'],
  ['help my kid understand black holes with something animated', 'create_view'],
  // science worlds: a demo composed from laws, the kind carried as the mode
  ['make a demo for my physics class of a weight on a spring bobbing in thick oil', 'create_view', 'classical'],
  ['simulate two moons going around a planet so my students can watch the orbits', 'create_view', 'classical'],
  ['show my biology class how a drop of dye spreads out through water, molecule by molecule', 'create_view', 'microscopic'],
  ['show my chemistry students what the 2p and 3d orbitals of hydrogen actually look like', 'create_view', 'quantum'],
  ['a demo of an electron getting through a wall it does not have the energy to climb', 'create_view', 'quantum'],
  ['show my class why the clocks on GPS satellites tick faster than ours on the ground', 'create_view', 'relativistic'],
  ['background music for the forest level', 'create_beats'],
  ['a live-sounding drum kit and grand piano for my band demo', 'create_beats'],
  ['an orchestral cue with pizzicato strings and a timpani roll', 'create_beats'],
  ['a squelchy acid bassline with the pad pumping to the kick', 'create_beats'],
  ['a slow blues with a crying guitar solo over a walking bass', 'create_beats'],
  ['a honky-tonk tune with pedal steel and a fiddle break', 'create_beats'],
  ['a flamenco guitar piece with rasgueado and palmas', 'create_beats'],
  ['give me a spinning view of that molecule', 'forge_motion'],
  ['present these three charts one after another with build-in steps', 'forge_motion'],
  ['record the hero clearing the chasm and show me the clip', 'forge_motion'],
  ['check the player can actually get from the door to the goal', 'forge_motion'],
  ['merge those short clips into a single movie file', 'stitch_motion'],
  ['set up a 35mm camera that dollies down the street and show me its path', 'forge_motion'],
  ['put easy ease on the second camera keyframe and make the lens 85', 'forge_motion'],
  ['a roguelike where my gear persists across floors', 'create_game'],
  // a board game against the computer: create_game's tabletop, not its levels
  ['I want to play chess against the computer', 'create_game', 'tabletop'],
  ['a board game where I build roads and towns from dice and resources, against bots', 'create_game', 'tabletop'],
  // mobile genres: the match-3 saga is a reducer game, not a world game
  ['a candy crush kind of game with a level map and stars', 'create_pixelizer_game'],
  // level ground: a gameworld level's land shaped on its grid, apart from its look
  ['put a cliff along the east side of my first level and a gorge across the middle', 'tune_ground'],
  ['the walk in my level is too flat, make the climbs bigger', 'tune_ground'],
  ['my games all look the same, give this one colours of its own', 'pick_palette'],
  ['what colours should a cold, quiet drowned town at dusk be', 'pick_palette'],
  ['make the colours go from day to night as the levels go on', 'pick_palette'],
  ['colours for a space sim out in the asteroid belt', 'pick_palette'],
  ['turn my notes into a picture book for kids', 'mint_stash'],
  ['lay out a comic page of my hero fighting the dragon', 'create_sketch'],
  ['an AI-painted portrait I will render with an image model', 'create_sketch'],
  ['make my anime character actually talk and blink', 'create_sketch'],
  ['stage the two drawn characters in one scene and cut between their rooms', 'create_sketch'],
  ['make a pixel-art cutscene of my hero character', 'get_catalyst'],
  ['design me a two-storey house with a porch', 'mint_building'],
  // interior designer: a room of a house decorated, styled, its pieces placed
  ['decorate the lounge in my house in a warm japandi look', 'design_interior'],
  ['where should the couch and armchairs go in my 14 by 18 living room with one window', 'design_interior'],
  ['show my bedroom as quiet luxury and then as coastal so I can compare', 'design_interior'],
  ['a furnished apartment I can walk through', 'mint_building'],
  ['frame the house and give me an IFC model for Revit', 'mint_building'],
  // the structure book's outcomes: drawings and a build, asked for without the word "house" leading
  ['draw me the floor plans, elevations and a section of a two-bedroom cottage', 'mint_building'],
  ['a cut list and lumber takeoff for framing my bungalow', 'mint_building'],
  // a commercial program on the same rail: its drawing set and its fit-out schedule
  ['floor plans and an FF&E schedule for a corner café', 'mint_building'],
  ['a two-level shopping mall with an atrium I can walk through', 'mint_building'],
  // a building as a game level: designed as a building, played as a level
  ['a game level that is a three storey office building you climb to the top floor', 'mint_building'],
  ['pixelize this portrait into a 32-bit sprite', 'get_catalyst'],
  // Orientation-containment C1: the FORM recognizer rows moved into the studio
  // body (forward_context mode:'studio'); these rows pin that an agent that
  // skips the studio read and goes straight to semantic_search still lands on
  // the right card. Voice previously had no fixture coverage.
  ['I want my comic to reveal one speech bubble per tap on my phone', 'create_sketch'],
  ['present the graphic novel like a slideshow I click through', 'create_sketch'],
  ['I want the narrator to sound deeper and more sure of herself', 'create_voice'],
  ['give my app a japanese female announcer voice', 'create_voice'],
  // 3.1.0: the animal, creature, hero and armour rows below enter on create_character, the Characters
  // ring's door (the same recipes mint_solid makes).
  // The animal realm of the figure system (figure-inception-quality.plan.md
  // phase 4). The CHARACTER row routes a creature and an animal here, so
  // these pin that a NAMED real animal lands on the solid family rather than
  // drifting to the painted-picture or part-graph neighbours.
  ['a wolf I can 3D print', 'create_character'],
  ['a deer with antlers standing in profile', 'create_character'],
  // creature (layered): an invented body with a rig, kept editable by dials
  ['a hulking dragon with a detailed head that I can rig and animate', 'create_character'],
  ['invent a swamp monster whose jaw and tail I can keep tweaking', 'create_character'],
  // stroke (layered): a drawn outline / line / brush on an existing creature or hero becomes a recipe op
  ['I sketched the outline I want for the dragon head, make it match my drawing', 'update_sketch'],
  ['let me draw a ridge along the brow instead of guessing station numbers', 'update_sketch'],
  // egocube: a character's design rolled once and kept, then made in any game at any age (create_character { egocube })
  ['I want to design a character once and use her in two different games, a farm girl who grows up to be a knight', 'create_sketch'],
  ['make my egocube character as she is at twenty six', 'create_character'],
  // cast: the people around a hero rolled as one cast (egocube/cast.js), each then made by its path
  ['roll the other characters for my story: a rival, a mentor, and a villain with his lieutenant', 'create_sketch'],
  ['make the rival from my cast sheet', 'create_character'],
  // mascot: a cartoony, head-heavy character rolled from a promise (create_character { as: 'mascot' })
  ['I need a speedy blue cartoon guy with spikes for my platformer', 'create_character'],
  ['a round pink blob mascot with big eyes that floats around', 'create_character'],
  // hero (layered): a human character as a rigged mesh in one art-style register
  ['a low-poly hero for my game with a face and a ponytail I can rig', 'create_character'],
  ['a boxy pixel knight that walks and exports skinned', 'create_character'],
  // hero tune: proportion by word and percentage on an existing hero (hero-tune). Revising a character you have is
  // update_character's (the studio body's CHARACTER row, the hero card's "iterate by word"); a new one is create_character's
  ['make her shoulders broader and her legs a bit longer', 'update_character'],
  ['a stockier version of the same hero, fuller arms and thighs', 'create_character'],
  ['tune my character\'s body proportions by percent, smaller head', 'update_character'],
  // face tune: the face proportion lab's words on the hero's fitted head (face-tune)
  ['give my hero a broader jaw and larger eyes', 'update_character'],
  ['a longer face with a smaller nose and a bob haircut on the same character', 'update_character'],
  // hair library: a hairstyle by word and its controls (hair-library)
  ['give my hero an undercut, then try a ponytail with a longer tail', 'update_character'],
  // hero detail: the dragon's detail and adornment passes on the hero, by word (hero-detail)
  ['dress my hero in a quilted jerkin with a belt, a baldric and one pauldron', 'update_character'],
  // anime form: the Anime Form Studio's head worn by the hero (`head: 'anime'`), its clumps directed by name
  ['an anime heroine with a long layered cut and one bang swept over her eye', 'create_character'],
  // anime looks: presets composed by word (`look: ['rival', 'tareme']`)
  ['start from the rival look, then give him droopy eyes and messy hair', 'create_character'],
  // armor (layered hero adorn build): worn armour from a style and dials (armor)
  ['suit my character up like a samurai general, black lacquer and a gold moon on the helmet', 'update_character'],
  ['only armour the shoulders and chest for now, full plate later', 'update_character'],
  // character fidelity (1011): a hero drawn for its target screen and in its level's light, revised by update_character
  ['my hero looks faceted on a 4k screen, give him the polygons it needs', 'update_character'],
  ['light my knight the way the gothic night level is lit so he fits in', 'update_character'],
  // world weather: a climate for any world's sky (weather)
  ['make it rain in my world and let a thunderstorm roll in now and then', 'compose_world'],
  ['a snowy pass where a blizzard starts when I walk in, with a dust storm world elsewhere', 'compose_world'],
  // one door per intent (tool consolidation): revising a character lands on update_character whatever
  // part of it changes; a camera plan is one door however the ask is put
  ['the knight I made last week, give him a beard and a scar across the cheek', 'update_character'],
  ['make my hero look a bit older and heavier set', 'update_character'],
  ['change her hair to a short bob and keep everything else', 'update_character'],
  ['the opening shot is too slow, speed the camera up as it goes through the gate', 'forge_motion'],
  ['add another camera looking down from the bell tower and cut to it at the end', 'forge_motion'],
  // ...the game's ground and colours asked as "my game" (which door owns them is measured, not assumed)
  ['the second level of my game is too flat, give it some real hills', 'tune_ground'],
  ['my platformer feels drab, can it have warmer colours', 'pick_palette'],
  // asset receipts: asked in plain words
  // share a finished game (desktop export): the completion offer's options all enter on export_game
  ['the game is done, how do I get it to my friends', 'export_game'],
  ['wrap my finished racer as a program I can double-click on my laptop', 'export_game'],
  ['stamp my exported model so people can tell I made it', 'sign_asset'],
  ['is this glb really the one I exported, or has someone changed it', 'verify_asset'],
  // (historic places left the routing eval in 1015: deemphasized, a historical view rather than an ask the surface
  // offers directly, so "walk me through Thebes" is not a route to hold)
];

// Rows the routing gets wrong today and that stay on purpose: the report lists them apart from new misses, and the
// score still counts them. A row leaves this set when its route is fixed. A row for an ask mojulo no longer offers
// leaves the fixture instead (the historic rows, 1015).
export const KNOWN_MISSES = new Set([]);

// Adjacency collisions: pairs of cards that share heavy surface vocabulary
// ("walk", "dungeon", "world", "animated") where a loose membership gate lets
// the WRONG neighbour sit at rank 0. Gate 2a pins rank-0 + margin on these;
// gate 2b includes them as plain routing rows (they are the hard cases).
export const COLLISION_FIXTURE = [
  // a playable artifact vs the walkability audit — both are "walk in a world"
  // a dungeon crawler is a world of levels from a sentence: design_game's compose, not create_game's hand assembly
  ['a playable dungeon crawler I can actually walk around in', 'design_game', 'compose'],
  ['I want to make a game where my character unlocks new powers as she explores', 'design_game'],
  ['set up my hero with a sword, a level-up system and a health bar', 'design_game'],
  // the strategy board: a tactics campaign is the book's (battles on boards), a maze defence and a skirmish the quick path's
  ['a tactics RPG where my party fights turn by turn on a grid of squares, like Final Fantasy Tactics', 'design_game'],
  ['a tower defence where the towers I build bend the path the enemies walk', 'design_game'],
  ['a real-time strategy game where I select units, order them around and train an army to take the enemy base', 'design_game'],
  ['a quick one-level game where I collect coins and reach the exit', 'design_game'],
  ['an endless runner for my phone where you swipe to dodge', 'design_game'],
  ['make me a game world from this sentence: a sunny island coast with a timber village', 'design_game', 'compose'],
  ['a full game with 3 levels: a haunted forest, a ruined castle and a mountain peak', 'design_game', 'compose'],
  ['when I click the lever in my crypt the gate should swing open', 'get_play_vocab'],
  ['put a health bar and a countdown on screen in my level', 'get_play_vocab'],
  // ...while the audit itself must still win its own turf (the control)
  ['walk to the exit and check the level is beatable', 'forge_motion'],
  // an animated explainer vs a camera flythrough — margin was ~0.004
  ['show my kid how a black hole bends light, animated', 'create_view'],
];
