---
{ "id": "motion-comic-tricks", "name": "motion-comic tricks — the directing protocol (animation cheats, transposed to the click)", "summary": "the closed protocol of zero-generation motion tricks for motion-comic scenes: move-based camera cheats (shrink = depth/falling, grow = coming in fast), swap-based action cuts (bend-knee → speed-lines, impact frames, expression swaps), and how to author the variant panels — adopted from the keyframe animation cheat shelf", "when": "make the panel feel like it moves, action tricks for my motion comic, impact frame, speed lines between clicks, character coming at the camera, falling away, change the facial expression on click, animation cheats for comics, direct the action in a panel, depth without 3D, quick cut action", "tier": "recipe" }
---

The motion-comic directing protocol: **zero-generation motion tricks**,
adopted from the keyframe-animation **cheat shelf**
(lite-template/integration/plan-archive/animation-cheats.plan.md §3) and
transposed from the clock to the CLICK. The shelf's structural move carries
over whole: **shot design becomes vocabulary selection** — and its
economics ("what this makes free") survive because a motion comic is even
cheaper than limited animation: there are no in-betweens at all. The
reader's mind interpolates between clicks (closure); every trick below
works BECAUSE everything else holds still.

This protocol is the **Turbomedia** grammar (Balak, "about DIGITAL
COMICS" 2009; Marvel Infinite Comics) merged with the animation cheat
shelf. Pacing constant from the Turbomedia community: **one turbomedia
≈ 80 clicks ≙ one 24-page comic** (~3.3 clicks per print-page
equivalent) — CLICK DENSITY is the pacing dial: many small deltas read
fast and tense; one big delta lands a beat.

One principle governs all of them: **one camera frame per scene.** The
trick changes what's in the frame (swap) or how big/where it sits (move) —
never the camera's point of view. When the view itself must change, that
is a new scene (the next panel).

## Camera tricks — `move` (transforms on existing pixels)

The `move` delta reposition/resizes a placement IN PLACE:
`{ move: { of, to: {x,y,w,h} }, enter: 'ease' (default) | 'cut' }`.

- **`approach`** (the shelf's `zoom-approach`) — the subject comes AT you:
  grow the rect over one or more clicks, keeping the center fixed. What it
  makes free: the genuinely-hard-to-draw foreshortened advance. Boundary:
  resolution boil — start from a panel rendered large enough (crops of a
  2048-tall page hold up to roughly a full phone screen).
- **`recede` / `fall-away`** — shrink the rect: depth, dropping, the world
  pulling back after an impact. The inverse economics of approach.
- **`drift` / `reframe`** — translate at constant size: a glide, a
  knockback, hover (the shelf's `cel-slide`). Legitimate exactly where
  there is no stride to contradict it. With `enter: 'cut'` it is a
  jump-cut reframe instead — two compositions of the same panel.
- **`splash-reveal`** — a scene on `layout: 'splash'` (the 80% showcase):
  hold the panel small via an authored `at`, then `move` it up to the
  splash rect on the money click. The panel *arrives*.

## Action tricks — `swap` (cuts within the frame)

The `swap` delta replaces a placement's art in place:
`{ swap: { of, to: {pageRef, panel} }, enter: 'cut' (default) | 'fade' }`.
The variants are **same-camera panels** authored on an action page (below).

- **`quick-cut beat`** — the user's canonical example: beat A "knee bends"
  → click → beat B "speed lines from having jumped." Two stills; the leap
  itself is never drawn — the gutter draws it.
- **`impact frame`** — a high-contrast/effects variant held for exactly
  one click (the anime convention). Pairs with a `say` shout on the NEXT
  click so the hit lands before the words.
- **`expression swap`** — same picture, new face (the VN technique, and
  the shelf's sub-cel lesson: eyes and mouths are where tiny changes read
  loudest). Variant panels differ ONLY in expression; everything else
  byte-identical art keeps the cut subliminal.
- **`held flurry`** (the shelf's `lightning-blows`) — 2–3 fist/strike
  variants swapped across consecutive clicks over a held body: the flurry
  is depicted, not animated. Three stills read as twenty punches.
- **`waist-up hold`** — an authoring precondition, not a delta: frame the
  panel waist-up by design so gesture variants never have to redraw legs.
  The shelf's rule transposed: the framing IS the budget.

## Effect tricks — `letter` overlays + effects in the art

- **`sfx-slam`** — the `letter` delta: onomatopoeia ("CRASH!", "KRAKOOM!")
  as a Z-INDEX OVERLAY, glyphs constructed deterministically by mojulo
  (handwritten-bubble kernel, seeded wobble, `3d`/`xmen-90s` extrude) and
  slammed in on the click (`enter: 'slam-in'`). The image worker never
  letters — placement, rotation, and treatment are the COMPOSER's job, so
  the same painted panel serves any language, any re-time, any re-word.
  Anchor with `of` and the lettering rides the panel's moves. Pair with an
  impact-frame swap on the SAME click: the cut and the word land together.
- Speed lines, impact bursts, and smears live IN the variant panel's art
  (the deterministic pipeline draws them natively —
  `speedLineBackgroundMarks`, sparkField comic-impact, seeded mulberry32 —
  and a painted page simply paints them). The M1 `fx` delta (`speed-lines`
  / `impact-frame` / `shake` as player overlays) will make these zone-free
  too; until then the variant is the effect layer.

## Reading tricks — the Balak grammar (`hold`, `focus`, tails, and recipes)

- **`held beat`** — the `hold` delta: an AUTHORED empty click. The
  identical frame repeated is suspended time; the wait is the beat.
  Comic timing's strongest tool, and free.
- **`rack focus`** — the `focus` delta (`{ focus: { on: 'panel' } }` /
  `{ focus: false }`): attention pulled between elements of one
  persistent image — everything else dims, no camera move. The Infinite
  Comics signature. Release before the next beat needs the whole frame.
- **`foreshadow tail`** — `say.tail` (8 directions): the balloon points —
  often at something OFF-frame or not yet revealed; the next click shows
  what it was aiming at. The print page-turn's surprise, at click grain.
- **`build-and-collapse`** — `show` panels one per click into the box's
  negative space (panel delivery), then `hide` all but one and `move` it
  large: the collapse to close-up. Accelerate by adding, hold by
  subtracting.
- **`black-frame beat`** — `clear` IS the black frame: a beat of pure
  matte between scenes or before a reveal.
- **`match cut`** — `swap` between panels of DIFFERENT pages whose
  compositions rhyme: the graphic-match transition, one click.
- **`evolving light`** — same-camera variants that change only the
  lighting state (day → dusk → torchlight): time passing with zero new
  compositions.

## Authoring the variant panels (the action page)

Mint ONE sequential-art page per action beat-set: panels `beat-a`,
`beat-b`, … with the SAME `camera` kind, the SAME bounds aspect, and the
pose changed — stick `pose` vocabulary for blocking, or `rig`
(`motion` + `phase`) for exact articulated silhouettes sampled from the
same motions `create_figure` animates. Recurring characters bind sheets
(`bind_character_sheet`) so identity holds across variants when painted.
Then in the motion comic: `base` places `beat-a`, each click `swap`s the
next beat. Zone says always read the ACTIVE variant's bubbleZones.

## Density restraint (the meta-trick)

One trick per click. The cut reads as motion only against stillness;
stacking approach + swap + balloon on one click spends the closure the
next click needed. When a beat feels crowded, split it — clicks are free.
