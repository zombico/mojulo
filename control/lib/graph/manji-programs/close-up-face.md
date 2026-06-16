---
{
  "id": "close-up-face",
  "label": "Close-up face",
  "family": "camera-shot",
  "aliases": ["close up", "closeup", "tight portrait", "face shot", "face close up", "head shot", "intimate close up", "tight on the face"],
  "intents": ["emotional-emphasis", "detail-focus", "intimacy"],
  "topology": {
    "cameraVector": "intimate-eye-level",
    "staging": "face-fills-frame",
    "reach": "face-only"
  },
  "reasoningUse": [
    "fill the frame with a face to show emotion through expression",
    "eliminate environmental noise and focus on one subject",
    "intimate emphasis when feeling matters more than context",
    "the punctuation shot — what the wider framings have been building toward"
  ],
  "boundaryContract": {
    "slots": ["face", "eye-line-anchor", "forehead", "chin-anchor", "left-background", "right-background"],
    "collisionGroups": ["face-volume", "soft-background"],
    "depthBands": ["face", "background-blur"]
  },
  "manjiProgram": {
    "spine": {
      "bar1": { "axis": "N-S", "tails": { "N": "closed", "S": "closed" }, "lengthScale": 0.4 },
      "bar2": { "axis": "E-W", "tails": { "W": "closed", "E": "closed" }, "lengthScale": 0.3 },
      "bar3": { "axis": "Zenith-Nadir", "tails": { "Zenith": "open", "Nadir": "open" }, "lengthScale": 0.4 }
    },
    "slots": [
      { "id": "face",             "position": { "x":  0, "y":   0, "z":  3   } },
      { "id": "eye-line-anchor",  "position": { "x":  0, "y":   0, "z":  3.2 } },
      { "id": "forehead",         "position": { "x":  0, "y":   0, "z":  3.6 } },
      { "id": "chin-anchor",      "position": { "x":  0, "y":   0, "z":  2.6 } },
      { "id": "left-background",  "position": { "x": -3, "y": -10, "z":  3   } },
      { "id": "right-background", "position": { "x":  3, "y": -10, "z":  3   } }
    ]
  }
}
---

# Close-up face

The **tight portrait**. The face fills the frame, the world recedes
into a soft far-back band, and the eye-line / forehead / chin anchors
bracket the head so a child element (a tear, a wisp of hair, a halo,
a thought balloon) can pin to the exact projected location it needs.
This is the shot that pays off everything the wider framings have set
up — the moment where the viewer reads what the figure is *feeling*,
not what they're doing or where they are.

## Use when

Reach for `close-up-face` when the **inner state** is the subject:

- **Emotional climax** — the moment the scene's tension resolves. A
  tear, a smile, a flash of recognition. The tight frame removes
  competing visual information so the face carries everything.
- **Reaction shot** — what the figure's face does *in response to*
  something off-screen. The two-background slots can hint at the
  off-screen direction without showing it.
- **Interior monologue / thought** — the camera "listens" to the
  figure's interiority. Pair with [[medium-shot-figure]] in a sequence
  so the close-up is the cut-in.
- **Identity / portraiture** — when the *who* of the figure matters
  more than what they're doing. Renaissance portraiture, Velázquez,
  modern photographic portraits — all share this framing's logic.

When gesture matters, [[medium-shot-figure]] gives the body room. When
two figures are interacting at this intensity, use
[[over-the-shoulder-two-figure]] so the camera carries the
relationship.

## Slot semantics

- **face** — the head's center-of-mass anchor at eye-level height
  (z=3). The primary mount; drop a face-shaped child here (a head card,
  a simple sphere, or a textured mask).
- **eye-line-anchor** — exact eye-level (z=3.2). Use this for elements
  the eyes interact with — a held object the figure is looking at, a
  spotlight directed at the eyes, a gaze-line vector.
- **forehead** — top-of-head (z=3.6). Pin elements that sit above the
  brow — a hat brim, a halo, a bandage, a thought-bubble tail.
- **chin-anchor** — bottom-of-head (z=2.6). For elements at the throat
  or just below — a necklace, a held cup at the lower lip, a turned
  collar.
- **left-background**, **right-background** — soft far-back anchors at
  ±3 x, deep y (-10). Use for **out-of-focus** environmental cues — a
  blurred window, a distant figure, a light source. The geometry pushes
  these far back so they read as defocused.

## Composition example

### Solo close-up with no background

```json
{
  "programRef": "close-up-face",
  "children": [
    { "slot": "face", "node": { "inlineProgram": {
        "bar1": { "axis": "N-S", "tails": { "N": "closed", "S": "closed" }, "lengthScale": 0.5 },
        "bar2": { "axis": "E-W", "tails": { "W": "closed", "E": "closed" }, "lengthScale": 0.5 },
        "bar3": { "axis": "Zenith-Nadir", "tails": { "Zenith": "closed", "Nadir": "closed" }, "lengthScale": 0.5 }
    } } }
  ]
}
```

A pure cube at the face slot — the simplest possible binding. Reads as
"a head fills the frame against nothing." The empty background slots
let the projection treat the rear plane as void.

### Close-up with a defocused background cue

```json
{
  "programRef": "close-up-face",
  "children": [
    { "slot": "face", "node": { "programRef": "standing-figure-canonical" } },
    { "slot": "left-background", "node": { "inlineProgram": {
        "bar1": { "axis": "N-S", "tails": { "N": "open", "S": "open" }, "lengthScale": 0.4 },
        "bar2": { "axis": "E-W", "tails": { "W": "closed", "E": "closed" }, "lengthScale": 0.3 },
        "bar3": { "axis": "Zenith-Nadir", "tails": { "Zenith": "open", "Nadir": "open" }, "lengthScale": 0.6 }
    } } }
  ]
}
```

The face dominates; a tall thin background mark in the left rear reads
as a defocused window or doorway — "this person is in a room" without
the room competing for attention.

## Provenance and influences

The close-up emerged with early cinema (D.W. Griffith credited with
popularizing it as a narrative device) but the framing predates film by
centuries in portraiture:

- **Renaissance portraits** — Holbein's tronies, Vermeer's *Girl with a
  Pearl Earring*. Face-fills-frame with a soft dark backdrop.
- **Baroque chiaroscuro portraits** — Caravaggio, Rembrandt. Face lit
  out of an enveloping darkness; the two-background slots in this card
  echo that compositional logic.
- **Film close-up** — Bergman's *Persona*, Dreyer's *Passion of Joan of
  Arc* (which is essentially a feature-length close-up). The card's
  slot vocabulary is film-derived; the geometry serves either tradition.

The close-up is the **highest-cost framing** in a sequence — too many
close-ups in a row and the viewer loses spatial orientation. Use as
punctuation, not as the default.

## Stays bespoke when

- **Eye-line off-camera** is the point (a profile, a three-quarter
  view). The card hard-codes a frontal eye-line; non-frontal head
  positions need bespoke geometry or a sibling card
  (`close-up-three-quarter`, `close-up-profile`).
- The face is **lit from a non-standard direction** that's part of the
  composition. Lighting lives on top of the manji structure; the card
  doesn't specify it. For Caravaggio-style chiaroscuro, layer lighting
  marks on the face slot's children.
- The "close-up" is on a **non-face** subject — a hand, an object, a
  detail. The card's slot vocabulary (eye-line / forehead / chin) is
  face-specific. For detail close-ups use a bespoke or sibling card.
- The face is **distorted by a lens** (fisheye, wide-angle close).
  The two-point camera projection here is rectilinear; lens distortion
  is a separate rendering layer.
