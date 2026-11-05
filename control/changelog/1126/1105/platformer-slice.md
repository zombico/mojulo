### A platformer's first level, made from its hero's tuned motion

- **The hero plays its own jumps.** A feel written with `takes: true` (`feel: { pole: 'jumping-giuseppe', takes: true }`)
  plays the hero's own jumps on the feel card's flight, in place of the animation library's held leap: its standing jump
  from a stand or a walk, its jump forward out of the run, and its double jump's second push for an air jump. Each clip
  plays its gather over the card's wind-up, its air over the flight (the rise to the apex its first half, the fall its
  second, read off the body's vertical speed, so a jump cut short carries its clip on and never skips), and its landing
  over the card's landing frames; walking off an edge plays the standing jump's fall. The run picks its stride cycle up
  where it left it. The jumps are compiled onto the hero's rig at play, beside its clips, so a hero made by a run and one
  made with `create_character` both play them; the library's run and walk stay.
- **Squash and stretch on a rigged hero.** The card's `look.squash` (Jumping Giuseppe 0.28, Galaxy Boy 0.22) scales the
  hero about its feet with its volume kept: sunk into the gather, stretched by the flight's speed (none at the apex),
  squashed on landing and sprung back over the landing's frames. The readout says the look is partly carried (the
  smears are not).
- **Absent `takes`, nothing moves.** A feel without it lowers to the rule it did, and the page's renderer carries the
  squash only when a rule asks for it; the platform rule's source in the page gained the takes' branch (re-pinned).
- **Planned.** A platformer world's first level is trail segments joined at seams: the basic movement, the first
  encounter, the advanced movement, and a gauntlet of foes on platforming ground. Each is sized by what its feel's card
  can cross. It plays from the side (the camera and the movement locked to the trail's line) or in full 3D, on the same
  level lit and dressed as every game's.
- **A boss when the creator asks** (planned). The level's requisition adds the boss and its fight, and the win is written
  as one of three kinds: a jobber (thrown away), a rival or a boss (each a story hook). The kind changes nothing in the
  fight; the next level's build reads it, and the log keeps how the story accrues.
