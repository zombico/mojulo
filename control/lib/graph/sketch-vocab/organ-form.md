---
{ "id": "organ-form", "name": "organ form — iconic depiction-grade organ stocks", "summary": "iconic 3D organ forms (heart, lung, kidney, liver, stomach, brain, eye) for general display — compositions of lathe + harmonic + optional blob/curve, not medical illustration", "when": "depiction-grade organ forms for stat tiles, summary panels, surface art — anywhere a recognizable iconic organ shape is wanted, NOT medical reference or anatomical illustration", "tier": "render-primitive", "marks": ["lathe"], "phase": "p1" }
---

For depiction-grade organ shapes (stat tiles, summary panels, surface
art), compose the organ as a **lathe with harmonics** (and optional
blobs/curves), oriented in 3D so the same form can be re-viewed from
any angle in the surrounding constellation.

This card is for **iconic recognizability at a glance**, not medical
accuracy. The bar is "reads as a heart," not "passes anatomy class."
For posed figures with internal anatomy, compose this with
[[figure-vajra]]. For vessels emerging from an organ, see
[[vessel-network]]. For skeletal silhouettes, see [[skeleton-form]].

## Parameterization vocabulary

These terms are the shared language across all organ stocks. Talk about
an organ in these terms; the substrate composition follows.

- **poles** — named singularities where curvature concentrates. Anchor
  points for orientation and for composition with other forms
  (apex of heart, hilum of kidney, foramen magnum on skull).
- **lobeCount** — N-fold harmonic lobing on the cross-section. n=2
  produces a cleft (heart's atrial cleft); n=3 produces a trefoil;
  n=0 is a smooth sac.
- **lobePhase** — angular rotation of the lobe pattern around the
  lathe axis. Lets the same form present cleft-toward-viewer vs.
  cleft-away-from-viewer for different views.
- **lobeDepth** — harmonic amplitude. Negative carves inward (cleft);
  positive bulges outward.
- **axisTilt** — direction of the lathe axis in world space. A heart
  tilts apex-down-left; a kidney tilts long-axis-vertical.
- **sacVsTube** — closed-end profile (sac, e.g. heart, stomach) vs.
  open-end profile (tube, e.g. intestine). Sac forms taper to zero at
  the apex; tube forms hold a finite radius at both ends.

## Stocks (v1 ships only `heart`)

- `heart` — tilted sac, 2-fold cleft, apex pole. **v1: shipped below.**
- `lung` — pair of elongated lathes with 2–3 fold lobing per side. (v2)
- `kidney` — bean lathe with hilum pole (lobeCount=1 asymmetric). (v2)
- `liver` — wedge lathe with shallow lobing on the right side. (v2)
- `stomach` — sac lathe with strong axis bend (waits for curved-axis
  lathe; see [[anatomical-form-vocab]] open questions). (v2)
- `brain` — sphere lathe + field-displaced surface for gyri. Waits on
  field-displacement coupling with lathes. (v2)
- `eye` — sphere lathe + flat concavity for cornea / iris disc. (v2)

## Heart stock

The iconic heart is a **three-part assembly**, all expressed as lathes
along a shared tilted axis:

1. **Cardiac sac** (ventricular mass) — large tilted lathe with a deep
   2-fold cleft (the *inter-ventricular sulcus*) running from the
   atrial end all the way down to the apex. This cleft is what makes
   the silhouette read as bilobed *into* the apex, not just an indent
   at the top.
2. **Atrial dome** — smaller lathe stacked above the cardiac sac along
   the same axis direction, with an *auricular bulge* in the middle of
   its profile (the atrial appendage "ears") and a shallower 2-fold
   cleft aligned with the sac's cleft (LA + RA separation).
3. **Great-vessel stubs** — two thin straight lathes emerging from the
   atrial top: the **aorta** (heading back-right toward the future
   aortic arch) and the **pulmonary trunk** (heading up-forward-left).
   Stubs only — full arcing vessels are [[vessel-network]]'s job.

### Sizing and orientation guidance

- **Axis length ≈ max profile diameter.** The heart is approximately as
  wide as it is tall, not elongated. With cardiac-sac axis length 2.0,
  use peak profile radius ≈ 1.2.
- **Apex tilt.** Apex points down-and-toward the viewer (`axisTilt` ≠
  vertical). Tilting both endpoints by ≈ ±0.5 in the apex-axis
  direction is a good default.
- **Cleft depth.** Use ≈ `-0.30` amplitude on the sac's 2-fold harmonic
  for clearly bilobed reads; ≈ `-0.18` on the atrial dome (atria are
  less deeply cleft than ventricles in the iconic silhouette).
- **`lobePhase`** rotates the cleft. The same phase should be used on
  both sac and atrial dome so their clefts stay aligned. For the three
  canonical views the phase tracks the view rotation: `0` (frontal),
  `π/2` (lateral), `π/4` (three-quarter).

### Example composition (frontal view, full assembly)

```js
// 1. Cardiac sac
{
  kind: 'lathe',
  axisFrom: { x:  0.5, y: 0, z: 2.0 },   // atrial-end pole
  axisTo:   { x: -0.5, y: 0, z: 0.0 },   // apex pole
  profile: [
    { t: 0.00, radius: 0.75 },   // atrial-end seat
    { t: 0.10, radius: 0.95 },
    { t: 0.35, radius: 1.20 },   // ventricular mass — peak bulge
    { t: 0.55, radius: 1.15 },
    { t: 0.75, radius: 0.80 },
    { t: 0.92, radius: 0.30 },
    { t: 1.00, radius: 0.00 },   // apex pole (sac closes)
  ],
  harmonics: [
    { n: 2, amplitude: -0.30, phase: 0 },  // inter-ventricular cleft
  ],
  crossSections: 22, samples: 48,
  style: { stroke: '#a23838', width: 0.5 },
},
// 2. Atrial dome — continues along the sac's axis direction
{
  kind: 'lathe',
  axisFrom: { x: 0.67, y: 0, z: 2.68 },   // atrial top (vessel seat)
  axisTo:   { x: 0.50, y: 0, z: 2.00 },   // matches sac.axisFrom
  profile: [
    { t: 0.00, radius: 0.35 },   // narrow top — vessel seat
    { t: 0.30, radius: 0.55 },   // auricular bulge ("ears")
    { t: 1.00, radius: 0.75 },   // matches sac top width
  ],
  harmonics: [{ n: 2, amplitude: -0.18, phase: 0 }],
  crossSections: 14, samples: 40,
  style: { stroke: '#8a2a2a', width: 0.5 },
},
// 3. Great-vessel stubs — straight thin lathes from the atrial top
{
  kind: 'lathe',
  axisFrom: { x: 0.72, y: -0.05, z: 2.68 },   // aorta — back-right
  axisTo:   { x: 0.99, y: -0.28, z: 3.28 },
  profile: [{ t: 0, radius: 0.12 }, { t: 1, radius: 0.10 }],
  crossSections: 6, samples: 24,
  style: { stroke: '#7a3a3a', width: 0.5 },
},
{
  kind: 'lathe',
  axisFrom: { x: 0.57, y:  0.08, z: 2.68 },   // pulmonary trunk — up-forward-left
  axisTo:   { x: 0.61, y:  0.32, z: 3.33 },
  profile: [{ t: 0, radius: 0.10 }, { t: 1, radius: 0.085 }],
  crossSections: 6, samples: 24,
  style: { stroke: '#7a3a3a', width: 0.5 },
}
```

### Tuning levers (what to vary, what each should do)

| Lever                          | What you should see                          |
|--------------------------------|----------------------------------------------|
| `harmonics[0].amplitude` more negative | Deeper atrial cleft                  |
| `harmonics[0].amplitude` → 0   | Smooth sac — reads as stomach/bladder        |
| `harmonics[0].n = 3`           | Trefoil cleft — reads as kidney-bean-ish     |
| `harmonics[0].phase` → π/2     | Cleft rotated 90° — lateral view             |
| Axis straight vertical         | Reads as a generic sac, not a heart          |
| Profile not tapering to 0      | Reads as a vase, not a heart                 |

The first two rows of that table are the parameterization-validity
test: if `lobeCount` and `lobeDepth` actually behave as named, the
vocabulary is doing real work; if not, the card needs to evolve.

## Non-goals

- Medical accuracy or anatomical correctness.
- Riggable internal structure (chambers, valves, ventricular wall
  thickness). Use [[figure-vajra]] for posed bodies.
- Baked geometry data, traced contours, or licensed reference assets.
- New renderer marks — organs lower to existing lathe / curve / blob /
  field.

## Composes with

- [[figure-vajra]] for anatomy-in-figure compositions.
- [[vessel-network]] for vessels rooted at an organ pole.
- the **lathe** primitive directly when the form is actually
  hollow/vessel-shaped, not organ-shaped (don't reach for organ-form
  for a beaker).
