---
{
  "id": "over-the-shoulder-two-figure",
  "label": "Over-the-shoulder two-figure",
  "family": "camera-shot",
  "aliases": ["OTS", "OTS shot", "over the shoulder", "over shoulder", "shoulder shot", "conversation shot", "dialogue framing", "reverse shot setup"],
  "intents": ["dialogue", "two-figure-relationship", "power-blocking"],
  "topology": {
    "cameraVector": "over-shoulder-diagonal",
    "staging": "two-figure-paired",
    "reach": "foreground-shoulder-to-background-subject"
  },
  "reasoningUse": [
    "frame a conversation from behind one figure looking at the other",
    "show power dynamic or attention between two characters",
    "classic dialogue blocking when two figures are speaking",
    "the canonical 'over the shoulder' framing that pairs with its reverse"
  ],
  "boundaryContract": {
    "slots": ["foreground-shoulder", "background-subject", "shoulder-anchor", "subject-eye-anchor", "midground"],
    "collisionGroups": ["foreground-figure", "background-figure", "midground-gap"],
    "depthBands": ["foreground-shoulder", "midground", "subject"]
  },
  "manjiProgram": {
    "spine": {
      "bar1": { "axis": "N-S", "tails": { "N": "closed", "S": "closed" }, "lengthScale": 0.4 },
      "bar2": { "axis": "E-W", "tails": { "W": "open", "E": "open" }, "lengthScale": 0.5 },
      "bar3": { "axis": "Zenith-Nadir", "tails": { "Zenith": "closed", "Nadir": "closed" }, "lengthScale": 0.4 }
    },
    "slots": [
      { "id": "foreground-shoulder", "position": { "x": -5, "y":   3, "z":  2   } },
      { "id": "background-subject",  "position": { "x":  3, "y": -14, "z":  2   } },
      { "id": "shoulder-anchor",     "position": { "x": -5, "y":   3, "z":  2.5 } },
      { "id": "subject-eye-anchor",  "position": { "x":  3, "y": -14, "z":  2.8 } },
      { "id": "midground",           "position": { "x":  0, "y":  -6, "z":  1   } }
    ]
  }
}
---

# Over-the-shoulder two-figure

The **OTS** — the camera looks past one figure's shoulder at the figure
they're addressing. Foreground figure is large, partially in frame, and
out-of-focus by convention; background figure is the subject of the
shot, smaller in the projected frame but compositionally weighted by
the foreground figure's gaze. This is **the dialogue framing** in
cinema and the standard relationship blocking in graphic narrative.

A paired OTS in the reverse direction (camera behind the other figure)
is the canonical "shot / reverse-shot" pair that carries an entire
conversation. This card is one half of that pair.

## Use when

Reach for `over-the-shoulder-two-figure` when **two figures are in
relation** and the relationship is the subject:

- **Conversation** — A is speaking, the camera is behind B looking at
  A. The viewer sees A's full reaction while B's shoulder anchors
  spatial orientation.
- **Confrontation / power** — the foreground figure dominates the
  frame (their shoulder fills a third of it), the background figure
  reads as the one being addressed-at. Use to stage power asymmetry.
- **Examination / attention** — one figure looking at another (a
  doctor and patient, an interrogator and witness). The foreground
  figure's gaze direction is the carrying axis.
- **Pair-shot blocking** — when you need a pair to be visibly *in
  relation* but a symmetric two-shot would flatten the dynamic. The
  diagonal of the OTS gives the pair direction.

When the figures should appear at the **same depth** (a buddy two-shot,
a symmetric framing), this card's diagonal will fight you — author a
bespoke symmetric two-shot instead. When the conversation is between
more than two figures, [[triangular-figure-stack]] handles three; for
four or more, author a group composition.

## Slot semantics

- **foreground-shoulder** — the large, near-camera figure's mounting
  point at z=2. The shoulder visible in frame. Drop a figure card here
  (or just a cube for an abstract shoulder mass) — the substrate's
  projection will read it as a body-volume occluding the lower-left of
  the frame.
- **shoulder-anchor** — top-of-shoulder reference (z=2.5). Pin a
  shoulder-specific detail here — an epaulet, a strap, a hand on a
  shoulder.
- **background-subject** — the smaller, deeper figure at (3, -14). The
  *subject* of the shot in dramatic terms, even though they're smaller
  in the projected frame. Drop the subject figure here.
- **subject-eye-anchor** — eye-level of the background subject at
  z=2.8. Use this for eye-line elements (the foreground figure's gaze
  vector terminates here; a beam of light hits here).
- **midground** — the gap between the two figures at (0, -6, 1). Use
  for elements that exist between them — a table, a document, a hand
  reaching across. Empty by default, which reads as conversational
  space.

The asymmetric x-offset (foreground at x=-5, background at x=3) is the
diagonal that gives the OTS its name. Mirroring the card (negate the
x-values) gives the **reverse shot**.

## Composition example

### Two-figure dialogue

```json
{
  "programRef": "over-the-shoulder-two-figure",
  "children": [
    { "slot": "foreground-shoulder", "node": { "programRef": "standing-figure-canonical" } },
    { "slot": "background-subject",  "node": { "programRef": "standing-figure-canonical" } }
  ]
}
```

The minimal binding — two canonical figures at the diagonal positions.
The foreground figure's silhouette occludes the lower-left; the
background figure reads as the addressee. This is the shot you cut to
when person B starts speaking; the reverse plays when A responds.

### Confrontation with an object between

```json
{
  "programRef": "over-the-shoulder-two-figure",
  "children": [
    { "slot": "foreground-shoulder", "node": { "programRef": "standing-figure-canonical" } },
    { "slot": "background-subject",  "node": { "programRef": "standing-figure-canonical" } },
    { "slot": "midground",           "node": { "inlineProgram": {
        "bar1": { "axis": "N-S", "tails": { "N": "closed", "S": "closed" }, "lengthScale": 0.6 },
        "bar2": { "axis": "E-W", "tails": { "W": "closed", "E": "closed" }, "lengthScale": 1.0 },
        "bar3": { "axis": "Zenith-Nadir", "tails": { "Zenith": "closed", "Nadir": "closed" }, "lengthScale": 0.5 }
    } } }
  ]
}
```

Two figures with a table between them — interrogation, negotiation, a
shared meal. The midground occupant reads as the contested or shared
object the figures are oriented around.

## Provenance and influences

The OTS is **film vocabulary**, not a painting tradition — it requires
the camera's ability to occlude the foreground figure with a body
the viewer's eye can still see *past*. Specific lineage:

- **Classical Hollywood continuity editing** (1930s–) — the OTS / reverse-
  OTS pair as the standard dialogue grammar. *Casablanca*'s café
  scenes are the canonical examples.
- **Comic-book panel grammar** — graphic narrative borrowed the OTS
  from cinema. Will Eisner, Hergé, manga's gutter conventions all use
  this framing.
- **Renaissance "saint and supplicant" compositions** — paintings of a
  kneeling supplicant before a standing saint sometimes carry an OTS-
  like diagonal even though both figures face the viewer. The card's
  diagonal isn't from this tradition, but the *relationship* logic
  echoes it.

The OTS depends on the foreground figure being **read but not focal**
— like a corner of a door frame or a piece of furniture, but with a
body's expressive weight. Render the foreground figure as a silhouette
(no facial detail) and the background figure with full expression for
the cleanest read.

## Stays bespoke when

- The two figures need to be at **equal visual weight** — a buddy
  two-shot, a love duet, a confrontation between equals. The OTS's
  diagonal hard-codes asymmetry; symmetric pairs want their own
  framing.
- The shot needs to **establish where they both are** — for that, use
  [[wide-shot-landscape]] (or an architecture card) and let the OTS
  cut in once the geography is set.
- The conversation involves **more than two figures** — three-figure
  conversations are different blocking. Use [[triangular-figure-stack]]
  if the three sit pyramidally, or author a bespoke triadic
  arrangement.
- The "OTS" is really **POV** (camera looking from inside the
  foreground figure's eyes, with no shoulder visible). POV needs to
  remove the foreground figure entirely; just use
  [[medium-shot-figure]] on the subject and let context cue that it's
  a POV.
