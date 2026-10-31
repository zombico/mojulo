### Hostile non-human body: the beast-kin on the seventh generation

A beast-type humanoid foe (a bestiary skin `{ people: lupine | ursine | feline | draconic | avian | insectoid }` rolled
below the hero door) was built on the creature biped: the Pale Warden's ring plan, with a library head swapped onto its
neck stub. The undead left that body for the tiered hero; the beast-kin did not. Measured with the hero's own stretch
audit (walk, jog and sprint on the creature's vajra rig):
- the biped's knees pinch to 0.28–0.32 of their rest section in the sprint and twist up to 42°, where the tiered
  hero's knee bridge holds 0.76;
- its arm tubes push out of a box trunk that has no shoulders;
- fur and scale cards are half its triangles;
- the opt-in bridges (`style.drawn`) fold five faces at the forearm. They are the tiered body's bridges without its
  fold bones, hinge zones or sockets.

This theme freezes the biped as the sixth generation, and stands the beast-kin on the tiered body.

- **The sixth generation, held** (`egocube/creature-gen6.char.test.js`). The biped and its library heads stay as they
  are for every row minted on them. One sheet per procedure the biped runs is pinned byte for byte, its plan, its
  recipe and its mesh: digitigrade legs with a tail (designed and in its kit), plantigrade legs, wings on the arms, and a
  second pair of arms. Each sheet is found in code from the lineages' rolls, dressed as the cube dresses it. The
  creature-door undead's skull and gaunt face (`creature-heads/derive.js`) are named sixth-generation; the undead stand
  on the tiered body with their own.
- **A refined station's weights sum to one** (`station-loft-body.js` `extendBinds`). A station refined between two
  uneven neighbours blended its weights by u and rounded them without settling, missing 1 by a millionth. The bind
  then refused it, so a species bound to its skeleton and given `style.drawn` (a tail loft's stations) could not be
  rigged. The blend now settles whenever its rounding misses 1. A blend that already summed to 1 is untouched.
- **The stretch audit reads the body the door mints** (`scripts/hero-stretch.mjs`). The script built `heroRecord({ cast })`
  without the mint's default form, so it audited the deprecated classic body. It now stamps the tiered body;
  `--body classic` audits the other. The form slice (`--form`) reads its build as before. On the tiered body the knee's
  and the elbow's regions now count every ring of their bridge (`hero-stretch.js` `STRETCH_REGIONS`), where the limbs'
  own end rings stay rigid and read 1. A classic body has no bridges and reads as it did.
- **The beast card on the tiered body** (`lib/graph/beast/`). A hero takes `beast: { kin, legs?, fingers?, toes?, claws?,
  tail?, wings?, arms?, head?, cover?, expression? }`.
  The kin is a card (`beast/cards.js`) of words, never geometry:
  - `reads`: what the kin reads as;
  - `fingers`: 3 or 4, the thumb among them; `toes`: 3, 4 or 5; `tail`: the tail it carries;
  - `claws`: none, blunt or long, and their tone;
  - `mass`: each part family's girth against a person's, and the waist on top of the trunk (over 1 a barrel, under 1
    a wasp's waist);
  - `rest`: the hunch, the knees and the arms' hang.

  The door records the card's words under the spec's own, as the undead's are, so an edit reaches them (`beastWords`):
  - bald, the body bare in one coat (its lineage's first swatch unless the palette names a skin), the feet bare;
  - the rest as the hero's gesture, the idle breathing in it, the walk tilted by the hunch.

  The girths go on the hero's plan before the tiered passes (`beastFlesh`), so the bridges, the shoulder's ball, web
  and cone are built on the body as it now is. The waist's swell is centred on the torso's narrowest section, fading up
  the chest and to nothing by the hip joint. A barrel's depth goes forward (its back held), so the seat still stands
  behind the lower back; a pinch draws in all round. After the tiered passes (`beastHands`):
  - the hand keeps the card's fingers. The outer ones go from the skin and the dials, and the rig stays whole, so every
    clip plays.
  - a hooked claw comes out of each kept digit's tip and each toe's. It is a four-station loft that curls toward the
    palm or the floor, riding the digit's last bone.

  The legs are the hero's word, not the kin's (a lineage stands digitigrade by how far from a person its sheet rolled).
  Refused: an unknown kin or word, a beast off the tiered body, and a beast that is undead too. A hero without `beast`
  is unchanged.

  Machine gate (`beast/tiered.test.js`):
  - the words recorded, the operator's own over them;
  - a barrel's waist swelling past its chest, its back held and its centre forward; a wasp's waist pinching inside it;
  - the forearm at the card's girth, and the shoulder's ball on the thicker arm;
  - three fingers kept with the rig whole and the dials pruned;
  - a claw past each digit's tip on its last bone, long ones longer than blunt, none on a clawless kin;
  - the bind and the rig audit clean;
  - refusals;
  - the stretch audit through walk, jog and sprint. The barrel kin on the brute build pinches above 0.7 and no worse
    than the brute hero, and folds no more.

  The audit over each kin (8 phases a gait), against the creature biped's sprint knee of 0.28–0.32:
  - bear-kin on the brute: 0.81;
  - insect-kin on the lithe: 0.72;
  - wolf-kin: 0.76;
  - dragon-kin on the heroic: 0.80.

  Minted through `create_character`, the male kin draw no core advisory. A female barrel kin is told its waist is as
  wide as its hips, which is the barrel's read. Eyes: front, side and the gaits, cropped to the hand and the foot.
  Eyes gate: the operator's to judge.
- **Digitigrade legs on the tiered body** (`beast/legs.js`, `beast.legs: 'digitigrade'`). The rig's leg is already a
  digitigrade chain (hip, knee, hock, toes; a person's hock is the ankle on the floor), so a digitigrade kin is the same
  chain with its joints moved and the parts below the knee made for them:
  - the joints are shares of the hip's height, taken from the creature biped's digitigrade template: the knee forward,
    the hock raised and back, the toes' base on the floor ahead of it;
  - the thigh is turned and stretched about the hip onto its new line, each station's offset from the line kept, and
    the hip's socket fold follows it;
  - the foot is a metatarsus from the hock to the toes' base, with a pad under the ball and the card's toes splayed
    ahead (the middle ones: no big toe), each with its claw on the toes' bone;
  - the hock is bridged as the knee is (`tiered-form.js` `TIERED_HOCK`): the shank and the metatarsus stop short of
    it, a bridge spans it, and its rings ride a fold pushed to the heel's side (the knee's goes to its front, since the
    two bend opposite ways). A chain splits as one unit with its hock (`bridgedChains`); a person's ankle names no hock
    bridge and is untouched.

  A plantigrade kin keeps a person's foot, with the card's toes (the big toe among them, the outer ones gone from the
  skin and the dials). A digitigrade kin's knee rests bent some 75°, so a person's stance bend and swing fold, added to
  it, folded the knee's bridge shut: a jog's 115° swing tuck left its ring at 0.12 of its rest. A digitigrade kin's
  gaits draw them in (`DIGITIGRADE_GAIT`: the walk's lift 26°, a run's tuck 50°, no stance bend), on every walk and run
  it carries, with the operator's own dials over them. A paw on a raised hock takes nothing cut for a person's foot: a
  footwear word (a shoe was drawn over the metatarsus) and an armour build (its sabatons refused the paw's missing toes
  by a part's name) are refused on a digitigrade kin, saying so.

  Machine gate (`beast/legs.test.js`):
  - the joints, the turned thigh and its socket's line;
  - the hock's bridge on its fold to the heel's side, its bone in the rig;
  - the metatarsus, the pad and the kept toes with their claws, the dials naming them;
  - a plantigrade foot with the card's toes;
  - footwear and an armour build refused on a paw, allowed on a plantigrade foot;
  - the gait dials, the operator's over them;
  - the rig audit, with the planted toes where they stand;
  - the stretch audit through the kin's own walk, jog and sprint: worst pinch above 0.7, no more folds than a person's,
    twist under 30°;
  - a person's jog on the same knee pinching under 0.4, the case the gait dials are for.

  Measured: the wolf-kin walks, jogs and sprints at a worst pinch of 0.87 (its knee 0.97), where the plain hero's own
  sprint pinches its unbridged ankle to 0.45. The wolf-kin, the bird-kin and the dragon-kin mint through
  `create_character` with no core advisory. Eyes: front, side and the gaits. Eyes gate: the operator's to judge.
- **The generic socket** (`beast/socket.js` `rootWeb`). Where a limb leaves a trunk that has no ring of its own to meet,
  a fillet of skin runs from inside the trunk's section to the limb's own ring and ends on that ring point for point, so
  the two weld into one surface. It is the shoulder web's principle with nothing of the human in it: the trunk, the
  limb, the ring and the bones are named by the caller.
  - The base ring is the limb's ring, spread wide and sunk back along the limb's axis, each point held inside the
    trunk's section at its height (`tiered-form.js` `torsoSection`, which now takes the trunk's name).
  - The rings between are eased in and swelled a little.
  - Its skin hands the trunk's bone to the limb's over its length, never at once.

  The hero's shoulder keeps its own web, ball and cone, byte for byte.
- **What the frame adds** (`beast/topology.js`): the egocube's topology, carried from the creature biped onto the
  hero's own body.
  - **The tail** (`beast.tail`: thin, thick, brush or stub, the biped's `TAILS`; its default is the kin's card's: the
    wolf-kin's brush, the cat-kin's thin, the dragon-kin's thick, the bear-kin's stub). It is a loft from the back of
    the pelvis at the hip's height, its joints the carriage's scaled to the hero. Each station is half and half between
    the tail's bones at its joint. The bones ride the pelvis: no clip poses a tail yet, so every clip plays.
  - **The tail's socket** ends on the tail's first ring. The tail swells past that ring, so a socket ending further out
    ran under the swell and showed it through as a slit.
  - **The arm-wings** (`beast.wings: 'arms'`): the biped's five flight feathers, flat vanes trailing down and back from
    the hand and the forearm, set on the hero's own elbow and knuckles and riding those bones, toned a shade either side
    of the coat.
  - **The second arms** (`beast.arms: 4`): a smaller pair under the first, folded forward. Each has an upper arm on the
    torso's side, a forearm and a mitten hand. The elbow and the wrist are bridged as the hero's are, with no fold since
    their bend is held, and the shoulder is welded to the torso by the generic socket. Their joints ride the torso.

  Machine gate (`beast/topology.test.js`):
  - the tail behind the hips at their height, its bones on the pelvis;
  - its socket ending on its first ring point for point, its base held inside the pelvis, its skin handing over
    monotonically;
  - the tail word over the card's;
  - five vanes a side on the forearm and the hand;
  - the second arms below the first and folded forward, bridged and welded, their joints on the torso, in the dials;
  - with all three, the bind and the rig audit clean, and the walk's worst pinch and folds those of the same body
    without them;
  - refusals.

  Eyes: the wolf-kin's tail before and after the socket's fix, the bird-kin's wings and the insect-kin's four arms
  through the gaits, cropped to each socket. Eyes gate: the operator's to judge.
- **The beast head on the tiered neck** (`beast/head.js`, `beast.head`). A beast-kin wears its kin's library head by
  default (`creature-heads`: the bear's, the wolf's, the felid, the dragon's, the beaked, the mandibled). The head is
  dressed for its coat by the creature door's own steps, now one shared helper (`egocube/plan.js` `libraryHead`: the
  skin's tones, the people's eye accent, scaled to the body); the sixth-generation pins hold through the move.
  - It is seated by its nape on the hero's head base. Its skull rides the head bone; its jaw is a bone of its own,
    hinged at the head's pivot and opened by the rig's jaw chain (a clip key's `jaw`). The rig's head top sits on the
    skull's crown, and the blank trunk's head is taken off.
  - The record's head is `none` (no hair or face words). `beast.head` names another library head, or `person` to keep
    a person's (bald) head. A beast's head under a person's head word is refused.
  - **The neck leans forward under it** (`NECK_LEAN`, 26°, its length kept). The library heads are drawn for the
    creature biped's neck, which runs 27° forward into the back of the skull. On a person's upright neck the skull sat
    forward of it, and its back rim crossed the neck's back as a saw-toothed edge.
  - **The nape** is a fillet from the neck's middle ring, point for point, flaring past the head's base into the skull,
    its top ring buried there. Each ring is the neck's own top ring scaled, so its slots never twist, and its skin hands
    the neck to the head over its length. The plan's own seam still seals the neck's end inside the head.

  Machine gate (`beast/head.test.js`):
  - the library head on the head base, its bones and the jaw chain, the blank head off;
  - the neck's lean and length;
  - the nape welded to the neck's ring, its top ring inside the compiled skull, its skin handing over;
  - the bind and the rig audit clean, and the jaw opened by the chain;
  - another library head, a person's head, and the refusals.

  All six kin mint through `create_character` with no core advisory. Eyes: the six heads through the gaits, the nape
  from the side and behind before and after the lean. The library head's own back rows still show a little of their
  low-poly rim from behind. Eyes gate: the operator's to judge.
- **Cover as form, not cards** (`beast/cover.js`, `beast.cover`: none, fur, scales, chitin or feathers; its default the
  kin's: fur for the bear-, wolf- and cat-kin, scales for the dragon-kin, feathers for the bird-kin, chitin for the
  insect-kin). The sixth generation built a coat as cards, half the biped's triangles. The seventh carries it as a
  material an engine lights.
  - **The tile.** Each kind is a tileable relief: a height field in metres on a 128-texel square, deterministic on its
    kind. Fur is strands lying down the body; scales and feathers are shingles in offset rows, each over the row above,
    a feather's vane narrowing to its tip; chitin is plates with grooves at their joints.
  - **The maps.** The form render's material reads the relief (`form/relief-material.js`) into glTF's maps: a base grey
    the vertex colour multiplies (the coat, darker in its hollows), the tangent-space normal, occlusion and roughness in
    one ORM image, and the height.
  - **The flat patch.** A flat patch at the tile's origin is level, white and unoccluded. A face the cover does not
    reach (the head, the claws, the eyes) samples it, so one material serves the whole figure.
  - **The mapping** (`coverMap`). The coat (a beast is bare, so its skin and the groups its clothes would be, its head
    excepted) is mapped by each part's own rings. The tile's u is a slot's place round them, a whole number of tiles so
    the wrap is seamless; its v is a station's arc length along their centres, so a curved tail, a flaring socket and the
    shoulder's funnel map as they run. A first mapping about one straight axis per part swung the tile round them. A cap's
    point takes its face's way round, and each corner's tangent is built the MikkTSpace way.
  - **The export.** It rides the lit skinned GLB (`export_model { skinned: true, lit: true }`). A beast-kin is now lit by
    the engine as the realistic body is: its corners carry their shading normals and no baked shade
    (`world-kinds.js`). The rig pack carries the cover only when asked (`packLayeredRig` `cover`): each corner's place
    on the tile and its tangent, and the maps (`coverTex`). The writer (`scene-gltf.js` `coverMaterial`) makes the
    figure's material from them: the base and the normal, the ORM image as occlusion and metallic-roughness (roughness
    factor 1, metal 0), the height in the material's extras (`mojulo.height`, with the tile and the depth) for an engine
    that reads parallax or displacement. glTF's default sampler repeats the tile. Absent, every pack and every file is
    byte for byte as before.
  - **The head's tufts.** Under a cover, the library head's details are spent by what reads at the hero's target, the
    drawn creature's rule (`creature-drawn.js` `headAtTier`, its eyes as drawn): a tuft too short to break the outline is
    the material's, not a card.
  - **The page.** The World page draws the cover as paint, the coat's colour (its fills are unlit), until it lights a
    figure live.

  Machine gate (`beast/cover.test.js`; `export-model.beast.test.js`, on the E2E list):
  - each tile seamless at its edges, within its depth, deterministic, its flat patch level and white;
  - a hollow occluded more than a crest;
  - the coat mapped by its rings: the head and the claws on the flat patch, every tangent unit and square to its
    normal, no face taken the long way round the wrap;
  - the pack byte for byte without a cover, and no cover carried unlit;
  - the kin's cover, the operator's word over it, and fewer head tufts under it;
  - minted and exported, the GLB's skinned mesh carrying TEXCOORD_0, NORMAL and TANGENT, and a material with the four
    maps, a zero metal factor, the extras and the walk;
  - with `cover: 'none'`, none of them.

  Eyes: the four tiles' maps side by side, and the wolf-kin with its fur and without, lit by three.js in the hero-live
  viewer (`/hero-live`, the same GLB an engine gets). The fur's relief reads on the body, and the head drops its tuft
  cards (8,812 triangles to 7,096). Eyes gate: the operator's to judge.
- **The route: new beast-kin mint on the seventh generation** (`egocube/plan.js` `beastOnTiered`, `planFromSheet`). A
  sheet below the hero door of a kin the beast cards know is now the hero door's call, `create { as: 'hero' }`, with
  the beast's words read from the sheet:
  - the kin is its ancestry; the legs are digitigrade when the sheet derives them;
  - the fingers, claws, tail and cover come from its lineage's cues as its humanity gates them, and feathers for the
    bird-kin;
  - the frame's wings ride the arms and its second pair of arms is the beast's;
  - the library head is its people's, and the face's derives become its expression (`beast.expression`: each control
    in −1 … 1, read by the library head);
  - its build is the hero's tune and its height its stature, within the tune's range.

  A designed sheet person enough to wear the cut (`CLOTHED_H`) wears it as the hero's outfit. One below it goes bare:
  its adornment is not worn on the tiered body yet, and the ledger says so, as it says where every other note landed or
  what is pending. A people of the operator's own with no card, a sheet with its own form, and any call that asks for
  `gen: 6` stay on the creature biped. Rows already minted are stored as minted, so they keep their body.

  The bestiary follows. A foe skinned `{ people: lupine }` and a cast's beast-kin play a person's moves from the
  library on the field (`gameworld/casting.js` `fieldOf`), not the creature loop's walk and jog. The fight game's
  roster fields a beast-kin, where it refused one below the hero door (`gameworld/runner.js`).

  Machine gate (`beast/route.test.js`):
  - each kin's sheet routed with its words, a valid hero spec, and a ledger row at or pending for every note;
  - both leg procedures reached;
  - the wings and the second arms carried, and the ledger saying where;
  - `gen: 6` and a lineage with no card on the biped;
  - clothed and bare by `CLOTHED_H`, the ledger naming the bare one's adornment;
  - the call compiling, deterministic;
  - the expression reaching the library head, and a control outside −1 … 1 refused.

  The egocube's own tests read the sixth generation through `gen: 6`, and its pins hold byte for byte. The foes' and the
  fight game's tests read the new field.

- **A silhouette per kin, not six slim swimmers** (`beast/cards.js`, `beast/tiered.js`). On the tiered body every kin
  read as one lean figure in six coats, where the creature biped's had read hulking. Three things kept it lean:
  - the route stood a kin on the canonical frame under a person's light build tune;
  - the cards' mass was girth alone, and timid;
  - nothing gave the upper back or the chest's front a mass of its own.

  Now:
  - **The build is the tiered body's own.** The route passes the sheet's build as the cast's build form
    (`cast: { pole, build }`, HERO_BUILDS), so a brute bear-kin stands on the brute's chest and arms; a child keeps the
    pole's cast. The rolled build varies a kin within its type.
  - **A frame per kin.** Each card names its proportions as tune words (`frame`: shoulders, depth, legs, neck, waist,
    hips), recorded under the operator's own tune (`beastWords`). A tune given as a move or a list stands as given.
  - **Three masses of the trunk's own.** `hump` (the back under the neck swelling out behind, its front held), `keel`
    (the chest's front swelling forward, from the throat to the belly, its back held) and `mass.hips` (the pelvis and
    the belly over it). The hump sits at the neck's root: one at the shoulder blades folded the back in a sprint, the
    swinging arm's cone driven into it.
  - **Bolder girths.** The digitigrade metatarsus is heavier (`legs.js` `META`), so a raised foot no longer reads as
    a stilt.

  Each kin is now its own silhouette: the bear the heavyweight (a barrel, a hump, short legs), the dragon the hulking
  V (broad and deep, thick haunches), the wolf the brawler (an inverted triangle), the cat the athlete (the one lean
  kin, strong haunches), the bird top-heavy on its keel, the insect segmented (a broad thorax, a wasp's waist, full
  hips).

  The nape fillet's crown is now sized to the skull whatever the neck's girth (`beast/head.js`). A neck thicker than
  1.5 of a person's stood its crown out through the back of the skull.

  Machine gate (`beast/tiered.test.js`, `route.test.js`):
  - the frame recorded under the operator's tune;
  - the hump, the keel and the hips each moving its own side and holding the other;
  - the route's build in the cast;
  - the stretch audit as before: worst pinch 0.86–0.88 on the digitigrade kin's own gaits. The plantigrade kin read
    0.52–0.55 at the unbridged ankle, as they did before this.

  Eyes: the six kin on two builds each, front and side mid-stride. Eyes gate: the operator's to judge.

- **Detail as form** (`beast/detail.js`; `beast.ridge`, `beast.ruff`, `beast.abdomen`). The silhouette's breakers are
  real parts again. The creature biped drew them as cards, and the cover material cannot break an outline.
  - **The ridge** (`ridge: 'spines'`, the dragon-kin's by default). A crest of flat spines, thin across and wide
    along. It runs up the neck's back, down the back's centre from the neck's root to the hips, and down the tail's
    top. The spines are tallest over the shoulders, each raked toward the tail and riding the bone it stands on (the
    neck, the torso, the lumbar, the pelvis, the tail's own). A small spine stays a blade: its thickness is at most a
    third of its width.
  - **The ruff** (`ruff: 'ruff'`). Two staggered rows of heavy tufts round the back and the sides of the neck's root,
    hanging out and down, mirrored, riding the torso. The route sets it where the sheet's fur cue names a ruff: the
    wolf-kin's, and the bear-kin's long shoulder fur.
  - **The abdomen** (`abdomen: 'gaster'`, the insect-kin's by default). A full ovoid out of the back of the pelvis,
    carried back and down, a shape of the tail's on its bones and socket. A kin carries a tail or an abdomen, never
    both: the door refuses the two together.
  - **The coverts.** A shorter row of feathers laid over the arm-wings' flights. The wing still reads as a comb of
    flights rather than one feathered surface; a broad vane is not built yet.

  The route reads the dragon's silhouette pick: the crest gives spines; a frill or folded wings gives none, and
  those stay pending in the ledger. The ledger names `spec.beast.ridge` and `spec.beast.ruff` where they land.

  Machine gate (`beast/detail.test.js`, `route.test.js`):
  - the spines on the midline, flat, raked, in order down the back, each on the bone at its height;
  - the tufts at the neck's root, round the back and the sides, hanging, mirrored;
  - the abdomen full in its middle and behind, and the tail-and-abdomen refusal;
  - `none` taking each away, an unknown word refused;
  - the rig whole with every detail on;
  - the route's ruff and crest from the sheet.

  Eyes: the dragon, the wolf, the bear, the insect and the bird, walking and sprinting. Eyes gate: the operator's to
  judge.

- **The snake-kin: a lamia on a serpent's coil** (`beast/serpent.js`, `beast.legs: 'serpent'`, the `serpentine` kin
  and lineage). A person's torso, arms and head on the tiered body, carried upright on a serpent's coil in place of the
  legs.
  - **One surface.** The legs' parts go (the thigh, the shank, the foot, the toes, the knee's bridge); their bones and
    joints stay, so every clip still plays, moving nothing seen. The pelvis is cut at the hip ring, and the coil grows
    out of that ring point for point, as the nape grows out of the neck: no crossing to crease. It runs down and a
    little forward to the ground under the hips, then along the ground behind in an S, tapering to a point. Its rings
    are the hip ring's slots carried down the path by a frame that never twists, rounded through every bend, each at
    its half width and height, so on the ground its underside lies on the floor.
  - **Planted.** Its first joint rides the pelvis; the rest are planted (`rig.planted`, new: joints that ride nothing
    and stand where they rest in every pose). The length on the ground lies there whatever the hips do. A rig without
    them is unchanged.
  - **The slither.** Each link on the ground is a chain about the vertical, turning every joint after it. The rig
    carries the wave they make (`rig.wave`, new: its chains, its amplitude, its wavelength in links). Every gait's clip
    plays it at its phase, travelling toward the tail (`hero-motion.js` `locomotionClips`, `station-loft-rig.js`
    `waveAt`). A rig without one plays its clips as before.
  - **Its gaits** (`SERPENT_GAIT`). A person's run lowered and drove the hips (its knee's bend, its flight, its lean,
    a long stride's vault), which squeezed the coil's upright length into a kink. A coil's gaits hold the hips at
    their height, and its run's stride is half a sprinter's.
  - **The kin** (`beast/cards.js` `serpentine`). Five fingers, no claws, a person's head with its hair kept (a card's
    `hair`). Its coat colours its own groups only (a card's `coat`: the coil and the hips over it); the torso keeps a
    person's skin, bare as every kin is. Its cover is scales on those groups alone (`cover.js` `beastCoatOf`, a
    `coverMap` group list).
  - **The door.** It refuses what is cut for legs: trousers, footwear, an armour build.
  - **The lineage** (`egocube/ancestry.js` `serpentine`, its derive `legs = serpent`). A sheet of it routes to the
    tiered body with the coil, five fingers and scales. A blind roll picks only a human ancestry, so no stored sheet
    moves. The bestiary's people skins take it: a foe `{ people: 'serpentine' }`. The ledger is honest about the face:
    the cheek and spine scales, the slit pupils and the stare are pending on a person's head. A person-headed kin's
    sheet sets no expression it would not read.

  Machine gate (`beast/serpent.test.js`, `route.test.js`):
  - the coil's first ring the pelvis's hip ring, point for point; the legs' parts gone and their bones kept;
  - its underside on the floor, and every planted joint at its height through the walk and the sprint;
  - the wave's peak travelling one link a wavelength toward the tail;
  - a hero without a coil carrying no wave and no planted joint, and the rig refusing an unknown chain or a planted
    core joint;
  - the bind and the rig audit clean;
  - the stretch audit through its own walk and sprint (worst pinch 0.82–0.86, no more folds than a person's);
  - the scales on the coil and the hips only, the top bare;
  - the door's refusals;
  - the route's coil from the derive.

  Eyes: the lamia front, side and from above, at two phases of the walk and mid-sprint; the S on the ground swings
  between them. Eyes gate: the operator's to judge. Not yet: a snake's head, slit pupils and scaled cheeks on a
  person's head, a constrictor's grapple, swimming.

- **Each sheet its own beast: the creature-from-sheet flow on the seventh generation** (`creature-heads/derive.js`,
  `beast/head.js`, `egocube/plan.js`). The catalyst that made the first non-human peoples (`creature-from-sheet`: a
  head derived from the nearest library skull, masses designed before detail, "design, never copy") had no landing on
  the tiered body. Every kin wore its library head and its card's masses, and two wolf-kin were the same wolf. Its
  steps are reviewed against the seventh generation, and these are adapted:
  - **The serpent skull** (`HEAD_DERIVATIONS.serpent`). Drawn from the wolf by row moves: a flat crown, wide at the
    jaw's hinge, a short wedge drawn in toward the mouth line so the mouth stays shut, lidless slit-pupilled eyes up on
    the skull's edge, the forked tongue, no ears and no teeth. It serves the snake-kin, so the lamia is the
    snake-headed lady. The dragon, the nearer skull, is drawn in metres where it sits: the row moves scale heights
    about the origin, so they pulled its crown down from two metres while its snout stayed up.
  - **A designed head** (`beast.head: { from, moves?, eye?, regions?, ornaments?, palette? }`). A head drawn from a
    library skull by the catalyst's method is the beast's head word. It is derived before it is scaled to the body
    (`egocube/plan.js` `libraryHead` `derive`), and the door refuses a skull the library does not hold, a word it does
    not know, a move it cannot make, or a head that does not stand.
  - **Each sheet's head** (`sheetHead`). The route draws the kin's skull again for every sheet. The sheet's structure
    notes bias it: a long muzzle longer, a short or blunt one shorter, a broad or heavy head wider, a narrow or slender
    one narrower. A variation seeded from the sheet moves the skull's length and width, its crown's height, the
    muzzle's length and width and the eye's size, each within a band (`SHEET_HEAD`) that keeps the kin's read. A skull
    drawn in place (the dragon's) keeps its crown's height. One sheet always draws the same head.
  - **Designed masses** (`beast.mass` over the card's, `beast.hump`, `beast.keel`). The route draws them per sheet
    (`sheetMass`): the kin's girths leaned by the sheet's silhouette word (the catalyst's THESIS: a needle lean, a bell
    full at the hips, a barrel round with a hump, a column straight) and varied within a band (`SHEET_MASS`).
  - **A coil is dressed above its hips.** A clothed snake-kin wears the top hemmed at the waist and its upper pieces.
    It wears no bottom (every cut hangs from the thighs), no coat (its tail hangs below the hip ring the coil
    replaces), no feet and no piece seated on a leg. The ledger says the lower dress is pending.
  - **A charm seats on its cord** (`station-loft-adorn.js` `facePoint`). A grid two rows deep has no interior, and
    the seat search walked only interiors, so a designed outfit's charms on the tiered body threw for a person as for a
    beast-kin. Such a grid is now searched whole; every other grid is searched as before.

  - **The catalyst says so** (`catalysts/creature-from-sheet.md`, "On the seventh generation"): where each of its steps
    lands on the tiered body, the designer's words (`beast.head` as a derivation, `beast.mass`, `hump`, `keel`), and
    that a people with no card, or a sheet asked with `gen: 6`, stays on the ring plan it teaches.

  Not adapted yet: the catalyst's DRESS for a beast below the clothed line (its adornments are still pending on the
  tiered body) and its COLOUR's paler underside.

  Machine gate (`beast/sheet.test.js`):
  - the serpent skull standing whole, flatter than its source, its pupils slit, no ears or teeth;
  - a designed head worn with its own rows, and the door's refusals;
  - two sheets' heads apart and one sheet's deterministic, within the bands, the dragon's crown kept;
  - the masses within their band over the silhouette's lean, the door's bounds, a heavier trunk a wider one;
  - the coil's dress;
  - the charms seated on a person and on a beast-kin.

  Eyes: the four trial peoples remade from new sheets, two seeds each: the cat-kin, the corvid, the bug scavenger (a
  flanking insectoid explorer) and the snake-headed lady, each dressed by its sheet. Eyes gate: the operator's to
  judge.
- **The people composer: principles of creation, not races** (`beast/cards.js`, `beast/tiered.js`, `beast/lexicon.js`,
  `egocube/plan.js`). Seven hand-set kin cards made seven peoples, and a lineage of the operator's own fell back to the
  sixth generation. A beast is now COMPOSED: every part of its body is a word with a principle behind it, over a neutral
  base that is a person's body (`BEAST_BASE`):
  - the lower body (`legs`), the feet (`toes`), the hands (`fingers`, `claws`, and the new `clawTone`);
  - the limbs (`arms`, `wings`) and the appendages (`tail`, `abdomen`);
  - the masses (`mass`, `hump`, `keel`) and the stance (the new `hunch`, degrees, 0 … 35);
  - the head (a library skull, a designed one, or `person`);
  - the integument (`cover`; the new `coat`: whole, or lower, below the waist only; the new `hair`: a person's kept);
  - the ornaments (`ridge`, `ruff`).

  `kin` is optional: a preset whose words sit under the hero's (the seven cards, each now naming its cover and where
  its coat lies). A beast with no kin is built from its words alone, and wears a person's head until it names one. The
  door refuses each new word by name. The presets' records and plans are held byte for byte
  (`beast/composer.char.test.js`, pinned before the change: one kin per procedure the cards run, chosen in code).
- **The cue lexicon** (`beast/lexicon.js` `readAnatomy`). A table from a sheet's notes to anatomy words: plain-word rows
  (a coil, digitigrade legs, a thick or bushy tail, an abdomen, a second pair of arms, wings on the arms, three
  fingers, talons, fur, scales, chitin, feathers, a crest of spikes, a ruff or a mane, hunched, and the masses: hulking,
  barrel, slender, thin limbs, broad shoulders, a wasp's waist, a thick neck, strong haunches, a keel), the nearest
  library skull by a people's family words (its own reads first: a lizard's to the dragon's, an owl's to the beak, a
  muzzle the library has no skull for to the wolf's, provisionally), and the parts the composer lacks (hooves, a taur's
  body, wings at the back, horns, antennae, tusks, a frill, fins, a shell, quills). The route now lowers ANY people
  below the hero door with no form of its own onto the tiered body (`beastOnTiered`): a kin the presets know from its
  preset, exactly as before; a lineage of the operator's own composed from its notes, the structured derives and plan
  hints over the lexicon's words, its head and masses drawn per sheet as a preset's are. The lexicon reads only the
  people's own lines (a note from its ancestry); the build's, the age's and the archetype's are carried by the cast, as
  for a preset. A nearest skull keeps its species' own ornaments (the dragon's horns, the insect's antennae) only where
  the people's lines ask for them. Its ledger says where each line landed, and names what the lexicon could not place
  or the composer lacks as pending. `gen: 6` keeps the creature
  biped; a fighter roster takes such a people too.

  Machine gate: the presets' pin; a kin-less beast validates, mints, binds and rigs whole; a kin's words spelled out
  without the kin build its parts; a word over its preset's; each new word refused (`beast/composer.char.test.js`); the
  lexicon's laws (`beast/lexicon.test.js`); an operator's lineage (a gecko-kin) composed and minted with its ledger, a
  people with no known family word on a person's head, its structure pending (`beast/route.test.js`). Eyes gate: an
  operator's lineage beside a preset kin, the operator's to judge.
