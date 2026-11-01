### The feature style, tuned: each animal's sizes and details by hand, and a seventh-generation detail tier

The feature style's animals (the mascot's `style: 'feature'`, docs/feature-style.md) take a `tune`: the operator's hand
on a model sheet, dialled by the style's own two halves, plus how much detail the model is made at. It rides the mascot
sheet, so every door that compiles a sheet carries it (`create_character({ as: 'mascot', spec: { tune } })`, a cast's
member, a quick game's hero). Code: `control/lib/graph/egocube/feature-tune.js`.

- **Structure.** `tune.structure` sizes the masses, each a multiplier on the species' designed size: `head`, `girth`,
  `legs`, `arms`, `hands`, `feet`, `tail`, `ears`, `muzzle`, `eyes`, `neck`.
  - The head grows about its own seat, its jaw kept on the neck. Its muzzle, its ears and its tufts grow with it.
  - The girth widens and deepens the trunk about its axis. The shoulders, the hips and the limbs' radii follow it.
  - The tail, the ears and the muzzle each grow as a module from their roots.
  - The function still holds. A quadruped's `legs` and `arms` are asks the all-fours fit honours as far as the floor
    allows. Where it keeps one longer, the mint says so (`mascot.tune.notes`).
- **Decoration.** `tune.decoration` sets the decoration dials (`tufts`, `crown`, `markings`, `horns`, `spines`, `mane`,
  `fins`): 0 to 3, where 1 is the designed amount and 0 leaves the structure bare. A dial never moves a mass.
- **Detail.** `tune.detail: 'gen7'` makes a hero model of the seventh console generation's HD era (`'game'` is the
  default game model):
  - a denser skin (about 21 to 27 thousand triangles, against 13 to 17 thousand; budget 34,000);
  - the fur's secondary clumps: a fuller cheek fan, a crown's two more locks, tufts at the shoulders, the elbows and
    the haunches, a ruff under a visible neck, a brush tail's fanned tip;
  - a wing's coverts, and a scaled back's second row of spines;
  - its light baked into its corners by the bake stack (`bake`, inline finishes): occlusion, a sky light, warm fur, wet
    eyes and nose, polished horns, hooves and beaks. Every lit export carries it as vertex colour.
- **Words.** A brief says the tune too: `big ears`, `big head`, `long legs`, `lanky`, `chubby`, `bushy tail`, `long
  snout`, `fluffy`, `shaggy`, `sleek`, `plain coat` and the rest of `TUNE_LEXICON`. Its tier is said with `7th gen`,
  `ps3`, `xbox 360`, `hd era` or `hero model`.
  - The words are read only in the feature style. A tier's word asks for the style; elsewhere a brief reads as it
    always has.
  - An explicit `tune` asks for the style too, and is refused under another named style.
- **The style's own words reach it.** `feature style`, `feature animation`, `stylized`, `stylised` and `cartoon
  realistic` now ask for the feature style. The brief reader did not know them before, though the style's first theme
  said it did.
- **Families' designed sizes.** `FAMILY_SIZES` sets five families' structure dials where the style's shared
  silhouettes misdrew them, multiplied under the operator's tune: a bear's head bigger, a canine's muzzle longer, a
  cat's shorter, a deer's and a horse's legs and necks longer.
- **Broader beaks.** Every bird's beak is broad at its root: side mandibles stand out from the middle of each mandible
  and converge on its tip. From the front it reads as a wedge, not a spike; in profile it keeps its species' shape (a
  hook, a needle, a deep beak). The breadth is capped by the beak's length, so an owl's short deep beak stays a beak. A
  bill is broadened too.
- **Wings that carry the profile.** A folded wing now reads as one bold shape on the bird's side:
  - it lies closer along the flank, and stands proud of it on thicker panels instead of sinking in;
  - its tone steps further from the body's (`WING_STEP`);
  - the hand turns at the wrist so its primaries lie back past the tail, in the hand panel's own plane. They no longer
    splay out sideways from the front, and no feather grazes the panel it springs from. That grazing tore the skin:
    on five birds measured, four carry fewer open edges in their skin (between 11 and 35% fewer), and the macaw 5% more.
    The open edges themselves are closed further down (Closed skins).
- **Birds rest bright, not droopy.** Every bird's default face read sad. Its eyes sit round the sides of its head, so
  the brow's outer end wrapped down over the eyeball, the upper lid sat heavy over the iris, and every bird's default
  sheet rolled `determined`. Now:
  - the bird plan has its own resting face (`BIRD_REST`): lids 12° more open, brows 12° higher off the lid, their outer
    ends lifted. It moves every expression alike, so the clips play the same and a blink still shuts;
  - a bird whose head is its own colour (an eagle's white, a mallard's green) wears that colour on its lids, instead of
    the body's dark bags under its eyes;
  - a feature bird whose face is not asked for rolls a bright one (`FEATURE_BIRD_LEAN`: mostly happy or grin); an asked
    face wins. Mammals roll as before.
- **Head tufts for every animal.** `tune.tuft` gives any feature-style animal a look for the top of its head, in place
  of its designed crown. That means furred, feathered, scaled and smooth animals alike: a crested pigeon, a spiky gecko, a
  frog with a topknot, a bear with a red mohawk.
  - The looks: `swept` (the designed fan), `cowlick`, `mohawk`, `spikes`, `crest`, `plume`, `fringe`, `mop`,
    `pompadour`, `none`.
  - Each look is a card of locks in `feature-tufts.js` (`HEAD_TUFTS`), placed on the skull by angle. It sits on any head
    and grows with a tuned head, and a new look is a card, not code.
  - Its colour is the coat's, pale, dark, the hair's, or any hex (a palette group `Tuft`); its `size` is a multiplier.
    The crown's decoration dial still rules it.
  - A brief says it too: `mohawk`, `cowlick`, `crested`, `topknot`, `bangs`, `pompadour`, `quiff`, `spiky hair`, `mop
    top`.
  - Untuned animals keep their designed crown.
- **Rounder, bottom-heavy animals.** Every silhouette is rounded (`FEATURE_ROUND` in `feature-silhouettes.js`):
  - the lower masses (the belly, a pear's front, the haunches, a snake's coils) are fuller across and deep, and the
    chest is a little slimmer;
  - a leg that shows is fuller at the thigh;
  - every mass is less pointed and blends softer;
  - the pale belly follows the body.
  It is applied before the all-fours fit, so the function still holds. A tuned girth now lets the legs rise as far as
  the arms grow.
- **The frog, redesigned.** The squat silhouette is now a sitter: a wide pear on folded hind legs, each thigh forward
  along the side and its shin back under it.
  - The head is wide and flat (a frog head shape), with big eyes bulging on domes on top of it.
  - A new frog muzzle draws the mouth's line right across the face, over a pale throat and two small nostrils.
  - The webbed feet now sit on the ankle, with three round-padded toes. Before, they were discs lying apart from the
    leg, a bug for any webbed-footed animal.
  - Its thin arms end in four padded fingers, planted on the floor in front.
  - Its sitting pose is its own all fours, so it is no longer fitted to drop face down onto them (the known "frog faces
    the floor" issue).
  - A frog rests open-eyed like a bird and rolls a bright face when none is asked for.
- **Closed skins.** The skin's net pinches wherever two sheets of the surface pass within a cell: a crease under the
  jaw, a wing on its flank, an arm against the body. The pinch was let go and its hole left open, the slits PR #30
  listed as known. Now the holes are fanned shut on the surface (`skin-net.js closeHoles`, as the realistic hero's
  skin already did). On nine animals measured, with their colour zones cut in, every skin is closed: 0 open edges,
  where the raccoon had 151.
- **The horse and the deer read as their animals.** They read as a bear and a fox: the horse's kit gave it a short
  round muzzle and a mane of a few stubby spikes, and the deer's horns were a single curl. Each family now has its own
  modules, reached through its tuning's kit (`FAMILY_TUNE` `kit`), so every animal of the family gets them:
  - the horses (`equine`): a long face sloping down to a soft round nose with dark nostrils, a longer and narrower
    head, a flowing mane falling to one side from the poll to the withers with a forelock over the brow (its own
    colour, the roster's mane), a long hair tail in the same colour, and a longer neck. The zebra and the donkey keep a
    short upright mane and a tufted tail (`SPECIES_KIT`);
  - the deer (`cervid`): antlers (a beam each side curving forward, with three tines), big ears set out to the sides,
    a narrow snout tapering to a black nose over a pale chin, and a longer neck. The elk, the reindeer and the moose
    wear them too;
  - no pale cheek discs on a hoofed face. The horns' and the mane's decoration dials still rule the antlers and the
    mane.
- **Everything is attached.** A new rule (`feature-attach.js`): every shape on a feature animal is attached to the body
  or to something attached to it.
  - Two shapes count as one where the gap between their surfaces is narrow enough for the skin's blend to bridge.
  - Once the build is laid out, a piece apart is moved, whole, to the nearest attached shape and set into it: its design
    kept, its place corrected. The plan records what moved (`mascot.attached`).
  - It caught 14 of 57 species sampled (one or two per family). Thin tails stood off the rump (a cougar's, a mouse's, a
    wombat's, a platypus's), and the reptiles' and dinosaurs' dorsal spines floated above their backs. Each moved 0.3
    to 4.5 cm.
  - Every family's shapes are now one piece, as designed and at the gen7 tier, and every plan's minted skin is a single
    connected piece.
- **The giraffe's neck and the zebra's stripes.**
  - The long neck is slim now. It was one fat mass as wide as the chest, so the giraffe read as a tall body. It rises
    further (`FEATURE_PROPORTION.longNeck`), tapers up to the head, and its base no wider than the shoulders.
  - A head raised well clear of its body on a neck (`FEATURE_NECK_PIVOT`: a giraffe's, a horse's) turns at the top of
    that neck: the rig's neck bone spans the neck (it was 2 cm at its base, so a nod swung the whole neck stiffly from
    the shoulders). Other mascots' rigs are as they were.
  - A `stripes` coat (the zebra's, the tiger's) was six thin strokes on the flanks: a few scratches on a white coat. It
    is now bold rings round the standing figure, from the feet up the neck to just under the head, never across the
    face (`FEATURE_STRIPES`). The widths fall in rhythm, each ring leans a little the other way from the last, and the
    edges are notched.
  - The stripes are cut into the skin as a zone along their exact edges, not laid over it as a layer. So a zebra stays
    within the game model's triangle budget: 17,434 triangles, where the layer would have taken it to 24,767.
- **Stripes as a body wears them, and the giraffe's patches.** The rings went all the way round. Real stripes start at
  the spine and end at the belly. Now:
  - each body stripe starts at the spine (on an animal standing up, the middle of its back) and runs round each flank,
    widest at the spine, holding its width and pinching late to a point at the belly (an `arc` on the coat's `band`);
  - a zebra's points meet under it in chevrons, and a cat's (the tiger's) stop short of its pale belly and are
    thinner (FAMILY_TUNE `stripes`);
  - over the legs a stripe stays a ring.
- **The giraffe's patches.** A new `reticulated` coat is a network of big rounded patches parted by thin lines of the
  coat (`FEATURE_NETWORK`, the coat's `cells`). The seeds sit on a jittered lattice from seeded dice, and the patches
  take the roster's own brown (`Spot`), over the body, legs and neck to under the head. It is cut into the skin as a
  zone, the patches sized to keep the giraffe within budget (17,831 triangles).
- **QA.** `scripts/spikes/feature-roster.mjs` takes `--tune` (every species minted with it) and `--tunes` (each species
  once per tune, side by side).
- **Stored mascots keep their look.** A minted mascot stores its compiled plan. An untuned sheet compiles as before,
  except for the five families above. A tuned mint records its tune in `plan.mascot.tune` and reads it back.

**Gates.**

- Machine: `feature-tune.test.js` holds these laws:
  - validation;
  - absent means nothing;
  - the words are read in the feature style alone;
  - no tuning phrase is a mascot lexicon phrase;
  - each structure dial moves its own mass;
  - on a tuned quadruped the paws still reach and the trunk still clears the floor;
  - decoration at 0 is bare;
  - the family sizes multiply;
  - gen7's clumps, coverts, denser skin within budget, and its bake (none on the game model);
  - and, in `feature-grammar.test.js`, a standing bird's wing panel out of its body, its primaries not splayed, its beak
    broader than deep; its default face rolled bright, its resting lids and brows higher, its brows' clips unchanged;
  - a frog sitting on its own all fours (hands planted, webbed feet on its ankles, eyes on domes, its own muzzle);
    every plan's minted skin closed and in one piece, and every family's shapes attached (`feature-body.test.js`);
  - a long neck slim under its raised head and turning at its top; a striped coat's stripes from the feet to under
    the jaw (rings on the legs, arcs from the spine to the belly above them, a cat's stopping short), and a giraffe's
    seeded network of patches in its own colour, both cut into the skin within the budget, the markings' dial still
    ruling them;
  - a horse's long face, flowing mane, forelock and hair tail, and a deer's antlers, side-set ears and pale chin, with
    the dials still ruling them;
  - a head tuft worn by every plan in place of the crown, each card's locks rooted in the skull and standing out of it,
    its size and colour, `none` and the crown's dial at 0 bare, and the brief's word.
- Eyes: not passed. Sheets were shot for the operator: game against gen7, and one species tuned several ways.

**Known.**

- The gen7 look is vertex-baked light and denser geometry. The fur has no normal map yet: the skin has no UVs.
- The moose wears the deer's branching antlers, not its own broad ones.
