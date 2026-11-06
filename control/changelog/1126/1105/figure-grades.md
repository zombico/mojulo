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
