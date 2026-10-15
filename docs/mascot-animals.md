# Animal mascots: a real species made a mascot

Code: [control/lib/graph/egocube/mascot-animals.js](../control/lib/graph/egocube/mascot-animals.js) (the crafted
cards, the family rules, the coat), drawn by `animalParts` in
[mascot-form.js](../control/lib/graph/egocube/mascot-form.js). The general mascot laws are in [mascot.md](mascot.md);
this page adds what changes when the mascot is a real animal, from the fauna roster
([control/lib/graph/fauna/](../control/lib/graph/fauna/), every species a ring plan built to its anatomy).

The method was to craft before writing rules. Eight species from different families were read as the roster draws them
(`scripts/fauna-lineup.mjs --measure`, and the contact sheets) and made into mascots one at a time. Each one's choices
were written down; the choices they shared became the rules; and the rules were written as one card per family, so that
every species in the roster has a mascot reading. The eight crafted cards remain, recording what a family's rule alone
would get wrong.

## Reading the real animal

The roster's measures and what a viewer names each animal by:

| Species | Trunk W/H | Legs/trunk | Head/trunk | What names it | What does not |
|---|---|---|---|---|---|
| fox | 0.73 | 1.42 | 0.48 | tall pointed ears, the white-tipped brush, the pointed snout, the orange | the long thin legs, the long back |
| giant panda | 0.84 | 1.31 | 0.45 | the black-and-white pattern: ears, eye patches, limbs | the shape, which is any bear's |
| rabbit | 0.90 | 1.10 | 0.37 | the tall ears, the cotton tail | the crouch, the long hind legs |
| frog | 1.49 | 1.96 | 0.48 | eyes on top, the wide mouth, the webbed feet, the green | the folded legs, the warts |
| emperor penguin | 0.54 | 0.57 | 0.62 | the tuxedo, the beak, the flippers | almost nothing: it is already upright and egg-shaped |
| elephant | 0.99 | 0.87 | 0.31 | the trunk, the fanned ears, the grey | the size, the column legs, the wrinkles, even the tusks |
| great horned owl | 0.78 | 0.86 | 0.52 | the huge forward eyes in a facial disc, the ear tufts, the beak | the feathers as cards |
| lion | 0.65 | 1.30 | 0.39 | the mane round the face, the tail's tuft, the gold | the long supple trunk, the slung belly |

Two things stand out. Every animal is named by **two or three** features, never more, and they are always the same
kinds: a **head appendage** (ears, a trunk, a beak, a mane, horns), a **pattern** (patches, a tuxedo, a mask, stripes),
a **rear appendage** (the tail), or a **mouth or nose form** (a frog's grin, a pig's disc). The other thing: the
measures that make a real animal (legs over trunk, head over trunk) are the ones a mascot throws away first.

## The crafts

| Species | Kept (the identifiers) | Let go | Promise (the folk reading) | Energy (its locomotion) | Form | The decision that was not obvious |
|---|---|---|---|---|---|---|
| fox | pointed ears, brush tail with a white tip, a pointed muzzle in the chest's pale; black socks | the long legs and back | mischief: the trickster | swaying | sprout | it is a canine, but the folk fox is not a loyal dog |
| giant panda | the pattern; round black ears | everything else | comfort | swaying | sprout | the shape says bear; only the pattern says panda, so the eyes shrink inside big patches |
| rabbit | tall ears, a cotton pom | the crouch (the hind legs become big feet) | cheer | bouncy | sprout | two identifiers are enough |
| frog | no outline identifier at all: eyes on top, a wide grin, webbed feet | the folded legs | cheer | bouncy | orb | a frog is already a mascot: one squat ball |
| emperor penguin | the tuxedo, the beak, flippers, orange feet | nothing | comfort | swaying (the waddle) | sprout | the face is white so the eyes read; the real penguin's head is black |
| elephant | the trunk, the fanned ears | the tusks, the size | comfort | sturdy | toon | the largest land animal becomes a round baby: size read as softness |
| great horned owl | disc eyes with a yellow iris, ear tufts, a small beak; wings as arms | the feathers as cards | wonder | sturdy | orb | the eyes break the usual eye rule because the eyes are the owl |
| lion | the ring mane, the tail's tuft | the long body; the muzzle (past the budget, it leaves its nose) | pride | sturdy | toon | the ears shrink and hide in the mane |

## The operational principles

These hold beside the ten mascot laws.

- **A1. Three identifiers, ranked.** A species keeps at most three features that change the outline: the strongest
  first, drawn big. Everything past the third is let go, however true. (`IDENTITY_BUDGET`, each card's `identity`.)
- **A2. Identifiers come in four kinds:** a head appendage, a pattern, a rear appendage, a mouth or nose form. A pattern
  and a mouth ride free of the budget, because they change the coat or the face, not the outline. A species named by its
  coat (the tiger's stripes, the zebra's, the raccoon's mask) carries that pattern whatever its family's rule says
  (`COAT_IDENTITY`).
- **A3. Stand it up.** Every four-legged animal becomes a biped. The forelegs become arms and the leg type becomes
  the foot: paws, hooves, webbed feet. Fins and wings become flippers and wing-arms (the `arms` and `feet` kit).
- **A4. Shorten the face.** A muzzle is at most a head's radius long: a fox's point, a bear's bulb, a pig's disc.
  A muzzle past the budget leaves its nose, so the face still has a centre. The exception is a muzzle that is the
  identifier: an elephant's trunk, a crocodile's long jaw.
- **A5. Bring the eyes forward and make them big.** Prey animals' side eyes become a forward pair. The exception is
  where the eyes are the identifier: the frog's on top, the owl's discs.
- **A6. The coat becomes flat zones.** The real markings are kept as two or three zones of flat colour: the coat, its
  pale front (the muzzle, chest and belly the animal really has), its dark marks (socks, ear tips, a mask). The real
  colours are pushed to a mascot's saturation, except a coat whose identity is light against dark (a panda, a zebra,
  a penguin), which keeps its values.
- **A7. Mass becomes attitude.** The animal's size does not carry over. A heavy animal's mascot is a soft, rounder
  one on thick limbs with a sturdy idle; a small one's tiny features are enlarged. Limb weight is per family
  (`LIMB_WEIGHT`).
- **A8. The promise is the folk animal.** It comes from what people say about the animal, not from its biology:
  the fox is a trickster, the owl is wise, the elephant never forgets, the lion is proud. A species overrides its
  family's reading when the folk story differs (a fox is not a dog).
- **A9. Locomotion becomes the idle:** a hopper bounces, a waddler sways, a swimmer floats, a heavy walker stands
  sturdy.
- **A10. A proportion that is the name is kept, against law 3.** A giraffe's neck stays long and its head rides up on
  it, because without it the animal would be a deer. This is the only time a mascot gives back height to the body.

## Using it

- `create_character({ as: 'mascot', spec: { brief: 'a fox mascot' } })`. Any species id (`greatHornedOwl`), its
  spoken name (`great horned owl`) or an everyday name (`panda`, `bunny`, `owl`, `dino`, `cat`) in the brief picks
  the animal. `facets: { animal: 'fox' }` does the same. The operator's other facets win over the card's.
- The sheet keeps the resolved card by value (`sheet.animal`), and its notes say what names the animal, what was let go
  and why.
- `node ../docs/examples/mascot/render-mascots.mjs 'fox|panda|owl'` draws them, and `--faces` draws their faces.
  `node scripts/fauna-lineup.mjs --one real fox giantPanda` draws the real animals to compare against.
