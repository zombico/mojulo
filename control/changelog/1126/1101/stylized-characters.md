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
  cat's shorter, a deer's and a horse's legs, necks and faces longer.
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
    The open edges themselves (non-manifold pieces dropped from the net) remain a known defect.
- **Birds rest bright, not droopy.** Every bird's default face read sad. Its eyes sit round the sides of its head, so
  the brow's outer end wrapped down over the eyeball, the upper lid sat heavy over the iris, and every bird's default
  sheet rolled `determined`. Now:
  - the bird plan has its own resting face (`BIRD_REST`): lids 12° more open, brows 12° higher off the lid, their outer
    ends lifted. It moves every expression alike, so the clips play the same and a blink still shuts;
  - a bird whose head is its own colour (an eagle's white, a mallard's green) wears that colour on its lids, instead of
    the body's dark bags under its eyes;
  - a feature bird whose face is not asked for rolls a bright one (`FEATURE_BIRD_LEAN`: mostly happy or grin); an asked
    face wins. Mammals roll as before.
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
    broader than deep; its default face rolled bright, its resting lids and brows higher, its brows' clips unchanged.
- Eyes: not passed. Sheets were shot for the operator: game against gen7, and one species tuned several ways.

**Known.**

- The gen7 look is vertex-baked light and denser geometry. The fur has no normal map yet: the skin has no UVs.
- The horse and the deer still read as standers with long faces, not as their animals.
