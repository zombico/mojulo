---
name: head-study
description: Render the protoform HUMAN head (male and/or female) as a skull-shape turntable — an azimuth sweep (front → ¾ → lateral → back) plus top-down and under views, cropped to the head, filled and as the blueprint ring-wave wireframe — so the head reads correctly from EVERY angle. Use before/after tuning the head field (figure-head.js), the sex pole (`DIMORPH.head`), a head knob (browRidge, jawWidth, chinPoint, noseSize, cheekbone, foreheadSlope, earSize, eyeSize, neckGirth), the `face` dials (jaw, mouth, brow), or a wig on the new skull. The human sibling of /skull-study. Invoke as `/head-study [male] [female] [--proto '{…}'] [--pose '{…}'] [--hair <wig>]`.
---

# head-study

The head is the part of a figure a single body study lies about most, and the part the
operator looks at first. This is the **eyes gate for the human head**: it renders the head from
all around so you can Read the turntable and catch what a front-only or lateral-only view hides
(a hollow crown that only shows from above, a stepped underside that only shows from below, a
jaw that reads square head-on but flat in profile).

## Use it

```bash
node .claude/skills/head-study/study.mjs [male] [female] [--proto '{…}'] [--pose '{…}'] \
     [--hair <wig>] [--no-wire] [--out dir]
```

Then **Read the printed sheet PNG** — that is the analysis. Default output `/tmp/head-study`:
`sheet.png` (every view of every sex on one contact sheet: a filled row and a wire row per sex),
plus per-view PNGs under `<out>/<sex>/png/`.

| view | reads |
|---|---|
| `1-front` | face plane — brow ridge, orbits, nose, cheek width, jaw corners, chin point |
| `2-front3q` · `3-threeqtr` | the recognizability angle — cheekbone, jaw line, chin, the sex read |
| `4-lateral` | profile — forehead slope, nasion dip, nose projection, lips, chin, occiput, nape |
| `5-rear3q` · `6-back` | cranium closure, **the ear in silhouette** (where it reads best), neck junction |
| `7-top` | dorsal skull, symmetry, **the crown is CLOSED** (no hole) |
| `8-under` | jaw + chin underside, the throat dome the neck enters, **no step, no hole** |

Options:
- `male` / `female` — which poles (default both).
- `--proto '{"jawWidth":1.2}'` — extra `proto` dials merged over the pole (headScale, browRidge,
  jawWidth, chinPoint, noseSize, cheekbone, foreheadSlope, neckGirth …).
- `--pose '{"face":{"jaw":20}}'` — a `pose` spec; `face` opens the jaw / mouth, `head`/`neck`
  DOF tilt and nod.
- `--hair bob` — seat a wig, to check the scalp reader on the skull (hats are not a figure-manifest
  channel; `hat.js` is exercised by `figure-head.test.js`).

Examples:
- `… study.mjs` — both poles, all eight views, filled + wire.
- `… study.mjs female --proto '{"browRidge":1.6,"chinPoint":0.7}'` — a squarer female head.
- `… study.mjs male --pose '{"face":{"jaw":25}}' --no-wire` — the open jaw, from all around.
- `… study.mjs female --hair longWave` — hair seating on the female skull.

## The dials it checks (map)

The head is `figure-head.js`: a signed-distance field of named anatomical primitives
(braincase, frontal, occiput, brow, subtracted orbits, zygomatics, maxilla, nasal, lips,
mandible + ramus + chin + floor = the JAW group, throat, the zygomatic arch + masseter, the ear
(its own blend group), the eye (globe + two C-wave lids, unioned after the orbit cut)) smooth-unioned into one skin and
surfaced by **latitude rings** from a centre inside the braincase — closed at both poles by
construction. Placement comes from `headLandmarks()`; the sex axis is `DIMORPH[sex].head`
(figure-rig.js); `proto` head knobs multiply the pole; `pose.face = { jaw, mouth, brow }`
rotates the jaw group about the condyle hinge and cuts the lip slot.

The renderer seam it drives: `renderFigureToSvg({ crop: 'head', elev })` — the head, the neck
and whatever sits on the head, through a pinhole orbit camera (a two-point projection spikes at
steep elevations). Absent both, the classic studio render is byte-identical.

**Invariants learned:** a feature at the face's 0.019*s blend melts into it — the nose, the ear and
the eye each need their OWN blend group and bounding gate. At the ear a ring is 2.9 mm and an
around-sample 14.2 mm; at the eye 5.9 and 10.6 — so structure that must read lives on the
up-down axis, and a thin near-horizontal line (the lip line, the palpebral fissure) is a SHADOW
STEP, never a cut. Close the underside IN THE FIELD (the throat mass), never by capping —
a step under the jaw twists the last latitudes into sliver quads that read as spikes from above.
A wig's dome radius is the skull radius averaged over HEIGHT (wig.js / hat.js `headFrame`);
latitude rings are tiny at the poles, so a per-ring mean would shrink every wig.
