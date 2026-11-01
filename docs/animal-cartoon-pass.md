# Animal cartoon pass — composition-first follow-up (1031)

This branch builds on the already implemented animal mascot principles in [mascot-animals.md](mascot-animals.md).
**Do not replace the species roster with per-animal sculptures.** Continue to derive the form from the species card, then evaluate the *relationships* of its resulting features.

## Findings from the existing architecture
- The upright mascot path (`egocube/mascot-form.js`) and original-stance mascot ooze (`mutagen/mascot.js`) are different transformations; preserve that distinction.
- The ranked three-feature identity budget is good for recognition, but three large features can still crowd each other (e.g. horns + mane + tail).
- Patterns such as the panda's patches and raccoon's mask are visually primary even though they do not count against the silhouette budget.
- The current head/body ratio and eyes are largely determined by form families; the *relationship* between large eyes, snout, forehead, and ear negative space needs a second visual-quality gate.
- Layered material effects and ornaments should be subordinate to species recognition, not compete with it.

## Proposed reusable order of operations
1. **Species contract:** lock two or three identifiers, and their shape/colour function.
2. **Stance contract:** explicitly choose upright mascot or anatomy-preserving ooze; preserve plausible support and COM.
3. **Primary masses:** create large head/torso/tail silhouettes; check front, 3/4 and side.
4. **Focal hierarchy:** assign ONE owner of strongest contrast (eye disc, coat mask, mane/ears silhouette, or muzzle).
5. **Secondary masses:** choose broad/medium/fine proportions; reduce secondary contours near the focal region.
6. **Coat and palette:** ensure value order and controlled saturation before adding decorative accents.
7. **Effects and accessories:** cap high-contrast focal competition; put rim/fur/glints in the tertiary register.
8. **Review:** compare thumbnails and detail renders, rerun across representatives, and record regressions.

## Representative review set (visual tests remain pending)
| Animal | Focus | Risk | A/B design experiment |
| --- | --- | --- | --- |
| Fox | tall ears / brush tail | two pointed masses compete | widen tail silhouette, simplify muzzle, offset directions |
| Giant panda | black/white coat | accessory steals face contrast | freeze patches; compare subdued versus bright accessory |
| Great horned owl | forward eye discs | cheek, tufts and brows crowd eyes | reduce secondary contours around discs |
| Lion | mane framing the face | too many radial features | one coherent mane volume, smaller ears |
| Elephant | trunk and fan ears | face hidden by oversized pieces | trunk curve / ear negative-space sweep |
| Rabbit | tall ears | ear-heavy top versus tiny feet | vary ear spread and grounded oversized hind feet |

## What it does now
[`egocube/mascot-composition.js`](../control/lib/graph/egocube/mascot-composition.js) reads any resolved `animalCard`:
`auditAnimalComposition(card)` is the advisory audit (the focal owner, the outline load, priorities, suggestions), and
`compositionMoves(card)` the few moves it can act on without touching the identity. A move quiets what competes with
the focus. It never removes an identifier or adds decoration:

| Move | When | What the body draws |
| --- | --- | --- |
| `piece: 'quiet'` | the focus is at the face: a coat pattern, the eyes, a ring mane, a trunk or a long jaw | the signature piece in the coat's own colour, greyed and deepened, its shine dulled toward it (step 7) |
| `tail: 'broad'` | a brush tail under pointed ears | the brush broader and swept back, a soft mass with a direction distinct from the ears' |
| `beak: 'small'` | eye discs or eyes on top, with a beak | a smaller beak, so the discs keep their negative space (step 5) |

Of the representative set, the panda, the owl, the lion and the elephant wear a quiet piece; the fox keeps its loud
scarf (its focus, the ears, is not at the face) and gets the broad brush; the owl gets the small beak; the rabbit is
unchanged.

**A new sheet carries its moves; an old one draws as it always did.** `rollMascot` stamps the moves on the card the
sheet keeps by value (`sheet.animal.composition`), and `mascotPlan` acts only on that stamp. A sheet rolled before the
pass has no stamp, so an egocube row minted before it regenerates byte for byte. The feature style composes its own
body and takes no stamp.

The sheet says what was done. The silhouette notes name the focal owner and the shaping moves, and the palette notes
carry the quiet piece when one is worn. The model sheet carries `composition: { focus, moves }`.

## Gates
- Machine: `mascot-composition.test.js` (one case per move, the stamp kept by value, an unstamped sheet unchanged, the
  feature style untouched).
- Eyes: `animal-cartoon-previews/` holds the baseline and the composition pass, front, three-quarter and side
  (`comparison-labeled.png`), and `composed-from-code.png` is the committed code's own render of the six:
  `node ../docs/examples/mascot/render-mascots.mjs 'a fox mascot|a panda mascot|an owl mascot|a lion mascot|an elephant mascot|a rabbit mascot'`.
  The eyes gate is the operator's.

## Next
- The lion's "smaller ears" and the elephant's "trunk curve / ear negative-space sweep" are still suggestions, not moves.
- A numeric pass over the generated geometry: silhouette separation, centre-of-mass projection, eye clearance, value
  clustering, colour-area shares and ornament occupancy, read front, side and three-quarter before a rule changes
  globally.
- The mascot ooze (`mutagen/mascot.js`) does not read the moves yet; its signature piece is still loud.
