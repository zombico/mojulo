# Animal cartoon pass — composition-first follow-up (1031)

This branch builds on the already implemented animal mascot principles in [mascot-animals.md](../../../docs/mascot-animals.md).
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

## What the first implementation adds
`egocube/mascot-composition.js` is a deterministic, advisory composition audit over any resolved `animalCard`.
It exposes focal owner, outline load, priorities, and specific suggestions. It neither changes the species nor
creates hidden procedural decoration, and is safe for review tooling to call.

## Next integration step
Feed the audit into character-sheet notes and a preview/contact-sheet generator (not auto-removal of kit parts).
A later numeric quality pass should measure silhouette separation, centre-of-mass projection, eye clearance,
value clustering, colour-area shares, and ornament occupancy using actual generated geometry. Evaluate side,
front and 3/4 views before changing the rules globally.

**Testing note:** the accompanying Vitest tests cover representative card expectations. No geometry renders or
full project tests were executed in the current connector-only environment.
