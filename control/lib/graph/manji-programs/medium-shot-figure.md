---
{
  "id": "medium-shot-figure",
  "label": "Medium-shot figure",
  "family": "camera-shot",
  "aliases": ["medium shot", "mid shot", "waist up shot", "half body shot", "figure mid shot", "cowboy shot", "two-thirds shot"],
  "intents": ["figure-staging", "midrange-focus", "dialogue-frame"],
  "topology": {
    "cameraVector": "eye-level-mid-distance",
    "staging": "figure-centered",
    "reach": "waist-up"
  },
  "reasoningUse": [
    "frame a single person from roughly the waist up",
    "show a figure clearly without committing to environmental context",
    "classic conversation or interview framing",
    "the default character-establishing shot once the wide has set the stage"
  ],
  "boundaryContract": {
    "slots": ["figure", "head-anchor", "waist-anchor", "background", "left-frame", "right-frame"],
    "collisionGroups": ["figure-volume", "frame-edges", "background-plane"],
    "depthBands": ["figure", "background"]
  },
  "manjiProgram": {
    "spine": {
      "bar1": { "axis": "N-S", "tails": { "N": "closed", "S": "closed" }, "lengthScale": 0.4 },
      "bar2": { "axis": "E-W", "tails": { "W": "closed", "E": "closed" }, "lengthScale": 0.3 },
      "bar3": { "axis": "Zenith-Nadir", "tails": { "Zenith": "open", "Nadir": "open" }, "lengthScale": 0.5 }
    },
    "slots": [
      { "id": "figure",       "position": { "x":  0, "y": -10, "z":  2   } },
      { "id": "head-anchor",  "position": { "x":  0, "y": -10, "z":  4   } },
      { "id": "waist-anchor", "position": { "x":  0, "y": -10, "z":  1   } },
      { "id": "background",   "position": { "x":  0, "y": -22, "z":  2   } },
      { "id": "left-frame",   "position": { "x": -8, "y": -10, "z":  2   } },
      { "id": "right-frame",  "position": { "x":  8, "y": -10, "z":  2   } }
    ]
  }
}
---

# Medium-shot figure

The **waist-up framing** — close enough to read a face and gesture,
wide enough to read posture and the upper body's relationship to its
surroundings. Single figure centered at midground, with a head anchor
and a waist anchor that bracket the upright body, plus a background
band and lateral frame edges. This is the most common figure-staging
shot in cinema, illustration, and reportage: it's what conversation,
interview, monologue, and "person doing a thing" reach for.

## Use when

Reach for `medium-shot-figure` when one person is the subject and the
intent is **read the figure**, not the environment or the expression
alone:

- **Dialogue / conversation** — when one figure is speaking or listening.
  The waist-up framing captures hand gestures along with face.
- **Action with the body** — pouring, writing, gesturing, working.
  Anything where the upper body's movement is meaningful.
- **Character introduction** — once the wide has set the place, this
  is the framing that introduces *who*. The viewer reads the person's
  presence in their full upper-body posture.
- **Portrait with context** — when a tighter close-up would lose the
  setting. The `background` slot keeps the environment present but
  defocused.

When emotion through expression matters more than gesture,
[[close-up-face]] frames tighter. When two figures are in conversation
and the relationship matters, [[over-the-shoulder-two-figure]] gets
the blocking. When the figure is meant to feel small against an
environment, [[wide-shot-landscape]] is the move.

## Slot semantics

- **figure** — the body anchor at the chest / sternum level (z=2). The
  primary mounting point for a figure card; drop
  [[standing-figure-canonical]] (or one of the Wave 2.3 posture cards)
  here and the rest of the framing organizes around it.
- **head-anchor** — top-of-head reference (z=4). Used to anchor a head-
  specific child (hat, halo, speech bubble, lighting accent) at the
  exact projected location of the head.
- **waist-anchor** — bottom-of-frame reference (z=1). The lower edge
  of what's visible. Anything placed here reads as "at the bottom of
  the shot" — useful for table edges, hands resting on objects,
  belt-level details.
- **background** — the receded plane behind the figure (y=-22). Use for
  environmental cue marks (a window, a wall pattern, a tree line) that
  give the scene a setting without distracting from the subject.
- **left-frame**, **right-frame** — lateral cue slots at the figure's
  shoulder height. Use for off-shoulder framing elements (a second
  figure's elbow just in frame, an architectural edge, a doorway).

## Composition example

### Portrait of a single figure

```json
{
  "programRef": "medium-shot-figure",
  "children": [
    { "slot": "figure", "node": { "programRef": "standing-figure-canonical" } }
  ]
}
```

The minimal binding — a canonical figure dropped into the framing slot.
The substrate's figure-as-silhouette rendering reads as a person from
the waist up; the empty background, frame edges, and head/waist anchors
are present but uncharged.

### Figure with environmental cue

```json
{
  "programRef": "medium-shot-figure",
  "children": [
    { "slot": "figure",     "node": { "programRef": "standing-figure-canonical" } },
    { "slot": "background", "node": { "inlineProgram": {
        "bar1": { "axis": "N-S", "tails": { "N": "closed", "S": "closed" }, "lengthScale": 0.6 },
        "bar2": { "axis": "E-W", "tails": { "W": "closed", "E": "closed" }, "lengthScale": 1.5 },
        "bar3": { "axis": "Zenith-Nadir", "tails": { "Zenith": "open", "Nadir": "closed" }, "lengthScale": 1.0 }
    } } }
  ]
}
```

A figure with a wide-low background mark — reads as a person standing in
front of a wall, a window-line, or a piece of furniture. The background
is present enough to set the scene but doesn't compete with the figure.

## Provenance and influences

The waist-up framing predates cinema (Renaissance and Baroque half-
length portraits — Holbein, Velázquez, Rembrandt's tronies) and got
codified by silent-era film as the practical compromise between full-
body and close-up. Cinematic terms:

- **Medium shot (MS)** — film vocabulary, waist-up.
- **Cowboy shot** — a variant cropping to mid-thigh (so the holster is
  visible); slightly wider than this card's framing but compositionally
  the same shape.
- **Half-length portrait** — the painting tradition's name. Same idea.

The slot vocabulary here (figure / head-anchor / waist-anchor) is
explicit about where on the body the framing lines fall, which is more
specific than the painting tradition's "from-here-to-here" approach.
This card is opinionated about an upright single figure; tilted, seated,
or paired-figure waist-up framings want their own cards.

## Stays bespoke when

- The figure is **seated** or **reclining** — the z-positions here
  assume an upright standing pose. Seated figures need a card with a
  lower head-anchor and a chair as part of the structure (forthcoming
  Wave 2.3 [[seated-figure-formal]]).
- Two figures share the frame at the same depth (a buddy two-shot). Use
  [[over-the-shoulder-two-figure]] for asymmetric pairs; for symmetric
  two-shots author a bespoke variant.
- The shot is **handheld / off-axis** — the slot positions assume
  level eye-line and centered framing. Tilted or off-center medium
  shots need bespoke staging.
- The background needs **its own depth structure** (a deep room behind
  the figure). Use [[cathedral-nave-deep-perspective]] or a similar
  architectural card and place the figure as a child of its
  central-nave or central slot instead.
