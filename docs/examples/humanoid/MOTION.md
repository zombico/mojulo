# Designing a hero's motion

How to give a hero a walk, a jog and an idle that read as THIS character and travel the world without skating, and
how to judge them. The companion of [DESIGNING.md](DESIGNING.md), which does the same for the still character: same
loop, same critic and blind judge, read for motion instead of the card.

Motion is part of the recipe. Whatever is tuned here resolves to baked keys on the hero's own bones and ships in the
skinned glTF (and every engine leg built on it); nothing depends on one engine's animation features. The one thing an
engine does is play a locomotion clip at the rate its character moves, from the ground speed the clip carries.

## What good looks like

- **The feet hold the ground.** A planted foot does not slide: at the speed the character moves, the planted toe's
  speed in the world is near zero. A clip that walks in place (ground speed 0) skates at any speed.
- **The weight travels.** The pelvis carries the body over the planted foot: it rises over the stance leg and drops into
  the next contact, shifts toward the bearing side, and turns with the leading hip. A pelvis that stays at one height
  reads as a puppet.
- **The limbs counter.** The arm swings against its own side's leg; the shoulder line turns against the hip line; the
  arm swings back as far as it reaches forward.
- **Elbows down.** A raised, bent arm folds its forearm up with the elbow beneath it; a forearm folded sideways across
  the chest (the elbow pointing out) is never right. An arm raised past the shoulder's roll (about level with the head)
  stays near straight.
- **Arcs, not lines.** The swing foot clears the floor in an arc and reaches forward to land heel first; the hands
  trace arcs; the head stays level against the bob.
- **Timing says who it is.** The same stride read fast and light is eager, slow and planted is heavy. Holds and quick
  transitions (uneven spacing) read as deliberate and graphic; even spacing reads as floaty.
- **The rear three-quarter reads.** That is the camera the player sees most: the stride, the arm swing and the
  character's carriage must read from behind and above.
- **The gait follows the role and the temperament.** A hot-headed fighter leans in and drives; a composed bodyguard
  keeps a level head and a narrow line; an apprentice is light and quick. A walk with nothing of the character in it is
  generic, however clean.

## The motion card

`render-motion.mjs` (beside this file) takes a hero spec in the cast files' shape, mints it through the hero door's own
steps, and poses each clip frame by frame on the skinned mesh the rig pack bakes. Per clip it writes an animated card
(the stick figure from the side on a floor whose ticks slide at the clip's ground speed; the skinned figure from the
side, at the three-quarter and at the rear three-quarter 20° down; the FOOT TRACE under them: each foot's height and
speed over the cycle, planted spans as bars), an eight-phase strip of the same views, and `motion.json` with the
measures: per foot the stance share, the planted slide, the stride and the lift; the implied ground speed `v`; the
pelvis bob; the wrists' swing.

```
cd control
node ../docs/examples/humanoid/render-motion.mjs --spec ../docs/examples/humanoid/cast/lead.json --clips walk,idle
node ../docs/examples/humanoid/render-motion.mjs --spec <spec.json> --motion walk='{"walk":{"strideLength":0.4}}' --seconds walk=1.1
```

A clip is either the hero's own (by name) or a motion spec on the hero's core (`--motion <name>=<json>`): the vajra
gait's dials (`walk`), the run (`sprint`), keyframes in pose words, and the performance layer (`perform`). See the
script's header for the flags.

## The loop

0. **Thesis.** One line before the first render: who is moving (role, age, temperament), the one word for the gait
   (drives, strolls, marches, bounces, glides), and what the player should read from behind.
1. **Start near.** The hero's own clips, or the nearest studied character's motion.
2. **Render, then look.** Open the strip and the GIF and actually look. The rear three-quarter first (the gameplay
   camera), then the side (contact, the reach to heel strike, the bob), then the foot trace (planted spans flat, the
   swing an arc, the slide matching `v`).
3. **Change one idea per render.** Say what you expect before rendering; compare after. Order by degree of touch:

   | Degree | What it decides | Judged on |
   |---|---|---|
   | Big | the gait's word (walk, jog, run), the ground speed and stride, the carriage (lean, head), the timing | the rear three-quarter at a glance, the foot trace |
   | Middle | the counter-motion (arm swing, shoulder and hip turn), the bob and the weight shift, the swing's clearance | the side and three-quarter cells |
   | Small | the hands, the wrists' give, the toe roll, the head's hold against the sway | the strip, frame by frame |

   Don't touch a small thing while a big one is wrong.
4. **Stop** when the measures hold and the read is right, or after about eight renders. Record honestly what the dials
   could not reach.
5. **Critic, one fix pass, blind judge.** Hand the final card to an independent critic (below), take at most three of
   its fixes in at most three renders, and let a blind judge pick the version to keep. A tie keeps the version with
   fewer changes. The critic is strongest on a wrong read (the gait says another character, or another genre); small
   tuning fixes are where it is most often neutral or worse, which is why the judge decides.

## The critic and the blind judge

Hand each its brief as written; neither sees the designer's notes. Standard anatomy, animation and garment terms only;
never name a studio, game, franchise or artist.

### The motion critic

> You are the motion critic at the end of the hero motion loop. You judge a character's locomotion the way an animation
> director reviews a cycle, and you hand back what to fix. You did not watch the tuning; the card has to speak for
> itself, as it will to a player.
>
> You get the BRIEF, the BEFORE and AFTER motion cards (the GIF and the eight-phase strip per clip, with the foot trace
> and the measures in the header) and the AFTER spec. Open every one and look at every cell, playing the GIF.
>
> Judge in this order:
> 1. **The one-second read, before the brief.** Watch the AFTER walk at the rear three-quarter once and write who is
>    moving in one sentence (age, temperament, mood, what they are about to do). Only then read the brief. A mismatch is
>    the most important finding you can make.
> 2. **Brief match.** What reads, what reads wrongly, what is missing.
> 3. **Theme.** Does the gait belong to this character's role and temperament? Flag drift: a calm character bouncing, a
>    civilian moving like a soldier, a heavy body moving light.
> 4. **The principles.** The feet hold the ground (the planted span flat, the slide matching the ground speed); the
>    weight travels (bob, shift, the pelvis leading); counter-motion; arcs; timing and spacing; the rear three-quarter
>    reads.
> 5. **Before against after**, per criterion: better, same or worse, with the cell or the measure that shows it.
> 6. **Defects**, each with its cell and phase: a foot through the floor or floating, a knee snapping straight, a limb
>    through the body, a pop at the loop seam, a hand through the hip.
>
> Hand back, under 600 words:
>
> ```
> ## First read
> ## Verdict
> SHIP | ONE MORE PASS | REGRESSED   (one line of why)
> ## Before → after
> | Criterion | Before | After | Better / same / worse, and the cell or measure |
> (contact, weight, counter-motion, arcs, timing, rear three-quarter, theme, brief match)
> ## Fixes (at most 3, most important first)
> 1. What is wrong, where (cell, phase). The dial to move and which way, if you can name it. What the card should show after.
> ## Keep
> ## Defects
> ```
>
> Never ask for a fix the dials cannot make; name it as a limit instead.

### The blind judge

> Two motion cards of the same game character, X and Y, were made by different passes. You don't know which came first.
> Judge which better realises the BRIEF as a character a player would control. Play both GIFs and look at every cell;
> ignore the words printed in the headers.
>
> For each criterion say X, Y or tie, with the cell that decides it: brief match (the character the brief describes);
> theme (the gait belongs to the role and temperament); contact (the feet hold the ground); weight (the body travels
> over the feet); the rear three-quarter (it reads from the gameplay camera); cleanliness (no pops, no limbs through the
> body).
>
> ```
> OVERALL: X | Y | TIE    CONFIDENCE: low | medium | high
> WHY: <two sentences>
> OUT OF CHARACTER: <anything in either cycle that does not belong to this character, or "none">
> ```
>
> Under 300 words.
