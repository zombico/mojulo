### Figure grades: one to pose, one to play

- **A character at two grades.** A character is made once and baked twice from the same recipe: the PLAY grade a
  game walks and the POSE grade the cinematics act with, the same skeleton and bone ids, the same clips, palette and
  height (`figures/figure-grades.js`: the two words, a grade's triangle budget by role, its advice when a figure is over,
  never a refusal, and `crossGradeErrors`, what keeps two bakes from being one character). The play grade
  (`heroFigure(…, { grade: 'play' })`, a figure's own `grade` over its world's `figureGrade`) lowers what a play camera
  cannot see: the body's rounding split (the one that quartered every body triangle), the anime head's coarse sampling
  and game lenses, its hair's rings and sides (a spike four-sided, half as many rings) and its cap's grid. Chapter 1's
  hero goes from 171k triangles to 32k, a party member from 72k to 35k, a townsperson from 55–76k to 20–26k; the town's
  people from 1.45M to 0.53M. A game's levels (`design_game`'s) play the play grade; every other page keeps its figures
  as they were. A hero on another head (the landmark, the realistic) keeps its head's sampling at both grades for now.
- **The pose grade cut in for a close shot.** A play-grade world bakes the figures its close shots reach again at the
  pose grade (`poseCast`: its party, its battles' foes, the figures its scenes frame close or set talking), `<name>@pose`
  in the bank when the two bakes are one character. On the page (merged-figure.js `__poseFrame`) a figure a close shot
  is on shows its pose twin, a second skinned mesh on the same bones built the first time it is wanted, so the clips never
  change hands: a scene's close, over-the-shoulder or two-shot, and a battle's film (rpg-channel.js: the actor close as a
  skill begins, behind it at its target, the target landing); off the shot, its play grade. A world without twins
  carries none of it.
- **A party RPG's chase pulled back.** A world that fights in party battles plays its hero from `PARTY_CHASE`
  (hero-chase.js `chaseFor`, the hero's own chase built the same way): the eye about twice as far and higher, the hero a
  tenth of the frame across instead of a fifth, the road and the town round it read; every other world's chase as it was.
- **The party walks again, and the chase comes in a little.** A party RPG's party walks the map behind the hero (the
  world's `battles.followers`, the default): each member finds its way round walls by the navmesh, never fights on the
  map (the arena holds the fights), and stops at its own distance, so the party trails in a file; the bodies pass through
  each other. A member walks in the hero's FOOTSTEPS (mind.js `rule.trail`): the hero leaves a crumb every 30 cm, and the
  member's goal is the point its distance back along them, ground the hero has just walked, so no wall stands between
  them however the hero turned; one woken or left more than 8 m from its point is set down on it. The party walks in a
  FORMATION (levels.js `PARTY_FORMATION`), not a file: each member its slot, so far back along the steps and so far
  across them (`rule.flank`), the hero a corner of a slanted parallelogram the next three stand at the other corners of. The party's chase is pulled in to 7.5 m behind and 4.4 m up, the hero an eighth of the frame across.
- **The grass is laid round what the camera frames.** A follow camera's eye stands back from its subject, and the live
  field measured every distance from the eye: on a chase 12 m back the hero's own ground was already past the field's
  near and thinned, and the field ended a few metres ahead of it. The field, the far grass and the static cards now
  measure past the chase's stand-off (its eye to its look point), the contact bed lies round the subject, and the field
  is laid again every 40 cm, not 75, so a tuft at a share's edge grows a step at a time. A walker's eye stands off
  nothing: first person reads as it did.
