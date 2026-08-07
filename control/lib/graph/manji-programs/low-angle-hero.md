---
{
  "id": "low-angle-hero",
  "label": "Low-angle hero shot",
  "family": "camera-shot",
  "aliases": ["low angle shot", "hero shot", "heroic framing", "low-angle", "dramatic upward shot", "looking up at the hero", "upward-looking shot", "worm's-eye-ish", "imposing subject framing"],
  "intents": ["power-staging", "monumentality", "heroic-elevation"],
  "topology": {
    "cameraVector": "low-up-angle",
    "staging": "hero-foreground-sky-back",
    "reach": "ground-to-sky"
  },
  "reasoningUse": [
    "frame a subject from below so they read as powerful, monumental, or imposing",
    "a hero, monument, statue, or building seen from a low vantage with sky behind",
    "dramatic upward perspective that elevates the subject above the viewer's eye-line",
    "the cinematic 'hero shot' — camera at the ground, subject towering against open sky"
  ],
  "boundaryContract": {
    "slots": ["hero-feet", "hero-torso", "hero-head", "sky-vault", "left-flank", "right-flank", "low-anchor"],
    "collisionGroups": ["hero-volume", "sky-band", "flank-frame"],
    "depthBands": ["near-ground", "hero-band", "sky-back"]
  },
  "manjiProgram": {
    "spine": {
      "bar1": { "axis": "N-S", "tails": { "N": "closed", "S": "closed" }, "lengthScale": 0.3 },
      "bar2": { "axis": "E-W", "tails": { "W": "closed", "E": "closed" }, "lengthScale": 0.4 },
      "bar3": { "axis": "Zenith-Nadir", "tails": { "Zenith": "open", "Nadir": "closed" }, "lengthScale": 0.7 }
    },
    "slots": [
      { "id": "hero-feet",   "position": { "x":  0, "y":  -5, "z":  0   } },
      { "id": "hero-torso",  "position": { "x":  0, "y":  -5, "z":  2   } },
      { "id": "hero-head",   "position": { "x":  0, "y":  -5, "z":  4   } },
      { "id": "sky-vault",   "position": { "x":  0, "y":  -8, "z":  7   } },
      { "id": "left-flank",  "position": { "x": -6, "y":  -5, "z":  3   } },
      { "id": "right-flank", "position": { "x":  6, "y":  -5, "z":  3   } },
      { "id": "low-anchor",  "position": { "x":  0, "y":  -1, "z":  0   } }
    ]
  }
}
---

# Low-angle hero shot

The **hero shot**. Camera at ground level, subject towering against open
sky above. The geometry stacks three subject anchors vertically
(`hero-feet` / `hero-torso` / `hero-head`) so the projected silhouette
runs from the very bottom of the frame to near the top, with `sky-vault`
above the head occupying the remaining frame. Open-tail `Zenith` lets
the upper sky "breathe" instead of closing into a ceiling.

This framing is the substrate's bias toward **power**. The same subject
filmed at eye-level reads as ordinary; from this vantage they read as
monumental — a hero, a statue, a tower, an authority. Use it
deliberately; overusing it numbs the effect.

## Use when

Reach for `low-angle-hero` when the subject's **standing in the world**
is the carrying meaning:

- **Heroic introduction** — the first reveal of a hero, champion, or
  protagonist. The framing tells the viewer "this person matters"
  before they speak.
- **Monumentality** — a statue, monument, tall building, or sacred
  object that needs to feel large against open sky. The
  foreshortening makes vertical structures read as towering.
- **Power asymmetry** — a figure standing over the viewer's notional
  position. The viewer is the kneeling supplicant, the seated witness,
  the looking-up-from-below child.
- **Awe / reverence** — religious figures, leaders, ancestors. The
  upward gaze is borrowed from devotional art and serves the same
  affect.

When the subject should feel **vulnerable** or **equal**, flatten to
[[medium-shot-figure]]'s eye-level framing. When the environment matters
more than the subject's stature, use [[wide-shot-landscape]]. When the
power dynamic is **between two figures** rather than between subject
and viewer, [[over-the-shoulder-two-figure]] carries that relationship
better.

## Slot semantics

- **hero-feet** — base of the subject, at ground level (z=0, y=-5).
  Drop the figure card's base here; the substrate's projection will
  read the feet as near-bottom-of-frame.
- **hero-torso** — body anchor at z=2. The figure's chest / center of
  mass. The natural mounting point if you're dropping a
  [[standing-figure-canonical]] — its origin aligns here.
- **hero-head** — head anchor at z=4. Pin head-specific child elements
  (a crown, a halo, a helmet, a lighting hit). The projected position
  is high in the frame.
- **sky-vault** — the open sky terminus above and slightly back (y=-8,
  z=7). The "what's behind the hero" anchor. Leave empty for clear-sky
  read; place a sun, a banner, a flag, an architectural element here
  for a charged background.
- **left-flank**, **right-flank** — lateral mid-height marks at ±6 x,
  z=3. Use for **flanking architectural elements** — pillars, banners,
  supporting figures kneeling, a doorframe. These give the hero a
  symmetric backdrop without committing to a specific environment.
- **low-anchor** — the near-ground reference at y=-1 (closer to camera
  than the hero's feet), z=0. Use for foreground ground elements that
  punctuate the camera's low vantage — a kneeling supplicant's back, a
  pedestal step, a fallen weapon, water-edge ripple. Reads as "the
  ground rushing up to meet the camera."

## Composition example

### Single hero against sky

```json
{
  "programRef": "low-angle-hero",
  "children": [
    { "slot": "hero-torso", "node": { "programRef": "standing-figure-canonical" } }
  ]
}
```

A canonical figure dropped at the torso slot. The substrate's silhouette
rendering reads as a person; the empty sky-vault and flanks let the
upward foreshortening do all the work. This is the minimal "hero stands
alone" composition.

### Monument with kneeling supplicant

```json
{
  "programRef": "low-angle-hero",
  "children": [
    { "slot": "hero-torso", "node": { "programRef": "standing-figure-canonical" } },
    { "slot": "low-anchor", "node": { "inlineProgram": {
        "bar1": { "axis": "N-S", "tails": { "N": "closed", "S": "closed" }, "lengthScale": 0.6 },
        "bar2": { "axis": "E-W", "tails": { "W": "closed", "E": "closed" }, "lengthScale": 0.5 },
        "bar3": { "axis": "Zenith-Nadir", "tails": { "Zenith": "closed", "Nadir": "closed" }, "lengthScale": 0.4 }
    } } }
  ]
}
```

A standing figure with a small kneeling mass at the low-anchor slot —
reads as a hero with someone kneeling before them. The size disparity
amplifies the power asymmetry that the low-angle already encodes.

### Towering colonnade with central figure

```json
{
  "programRef": "low-angle-hero",
  "children": [
    { "slot": "hero-torso",  "node": { "programRef": "standing-figure-canonical" } },
    { "slot": "left-flank",  "node": { "inlineProgram": {
        "bar1": { "axis": "N-S", "tails": { "N": "closed", "S": "closed" }, "lengthScale": 0.4 },
        "bar2": { "axis": "E-W", "tails": { "W": "closed", "E": "closed" }, "lengthScale": 0.3 },
        "bar3": { "axis": "Zenith-Nadir", "tails": { "Zenith": "open", "Nadir": "closed" }, "lengthScale": 1.4 }
    } } },
    { "slot": "right-flank", "node": { "inlineProgram": {
        "bar1": { "axis": "N-S", "tails": { "N": "closed", "S": "closed" }, "lengthScale": 0.4 },
        "bar2": { "axis": "E-W", "tails": { "W": "closed", "E": "closed" }, "lengthScale": 0.3 },
        "bar3": { "axis": "Zenith-Nadir", "tails": { "Zenith": "open", "Nadir": "closed" }, "lengthScale": 1.4 }
    } } }
  ]
}
```

A figure flanked by tall pillars — classical hero between columns of a
temple. The flank marks read as towering vertical structures from this
vantage, framing the hero in an architectural embrace.

## Provenance and influences

The low-angle is the **monument's vantage** — borrowed from how the
human eye actually reads a colossus from below. Specific traditions:

- **Roman triumphal arches and columns** — Trajan's Column, the Arch
  of Constantine. Designed to be read from the ground.
- **Renaissance sculpture in situ** — Michelangelo's *David*
  originally sat on a high pedestal in Florence; the intended viewing
  angle was sharply upward.
- **Soviet socialist realism** — heroic worker / leader portraits
  systematically use low-angle framing to lend power.
- **Classical Hollywood "hero entrance"** — John Ford's John Wayne
  reveals, Sergio Leone's standoffs. The vocabulary of authority.

The **power coding** of the low-angle is culturally near-universal but
not innate — it relies on the viewer reading "looking up at" as a
deference signal. The framing is at its strongest when paired with a
subject already coded as worth deferring to (a hero, a leader, a
monument); applied to a neutral subject it can read as arbitrary
aggrandizement.

## Stays bespoke when

- The angle is **straight up** (a "worm's-eye view" looking at the
  zenith). The two-point camera projection here doesn't handle the
  degenerate straight-up axis cleanly. For ceiling-staring shots,
  author a bespoke camera or use a one-point-perspective primitive.
- The subject is **not human-shaped** (an aerial vehicle, a tower
  from very far). The slot vocabulary (`hero-feet` / `hero-head`) is
  figure-coded; for non-figure monumental subjects author a sibling
  card with appropriate slot names.
- The hero is **lying down** or **horizontal** at this vantage. The
  card hard-codes a vertical subject; a fallen-hero or reclining-
  monument composition needs its own card.
- The viewer is supposed to feel **closer to or above** the subject
  (intimate emotion, child's-eye view of a parent leaning down). The
  low-angle's power coding will fight that intent.
