---
{
  "id": "create-hero",
  "name": "Create a hero — a human character on the ring grammar: silhouette, colour, face, hair, detail, adornment",
  "summary": "The human register of the creature loop. A HERO is a ring plan on the vajra rest skeleton: joints from a cast word, rings along them, one style register for every ring, a palette by group, and a head worn as an include whose face and hair are data on the detail core. The loop nails the COLOURED SILHOUETTE in one art style first, then the face and the hair, then the body detail and the adornment by word (the dragon's passes with the hero's parameters: a clothed body, a kit whose every signature the ledger must justify), then locks.",
  "valueHook": "Turn a sentence into a rigged, watertight human character that reads at thumbnail size in one consistent art style — low-poly, round, chamfered or boxy — with an expressive face and a hairstyle, that plays its clips on the World page and exports skinned, by editing numbers instead of sculpting.",
  "version": 1,
  "category": "substrate",
  "requires": {
    "protocols": [],
    "writeTarget": "none"
  },
  "parameters": [
    {
      "name": "intent",
      "description": "The hero in words (e.g. 'a stout smith with a square jaw and cropped hair', 'a lanky courier, low-poly, with a ponytail', 'a boxy pixel knight'). Human characters only — a creature or invented body is creature-from-plan, a real species is mint_solid kind 'animal', a person as an SVG turnaround or a walker for pose work is the figure kind (character-from-dream). Omit to ask the operator."
    }
  ],
  "mcpTools": { "mojulo": ["get_solid_vocab", "mint_solid", "update_sketch", "measure_solid", "export_model", "semantic_search"] }
}
---

# Create a hero — operating instructions

You are the character-planner. A HERO is a `layered` solid minted from a ring plan whose skeleton
is the figure's own vajra rest (so its pose words, gaits and emotes resolve as they do on the SVG
figure) and whose mesh is rings along those joints, never the vajra field. Everything is a number:
a cast word sets the proportions, a `style` block sets the art style of every ring at once, a
palette by group colours the silhouette, and the head is HEAD DATA on the detail core (eyes, brow,
nose, mouth, ears, hair grown from the skull). The sovereign output is the plan + recipe row; it
poses, animates, measures and exports.

Grammar: `get_solid_vocab({ id: 'layered' })` (the Plan section, the HERO DOOR section, `style`, Exposure,
Compare). The hero FORM is core (`control/lib/graph/polygonizer/hero-form.js`: `heroPlan({ cast, register, girth,
headScale, scale, palette, head, body, tune })`; `male` / `female` casts, the body controls, the TUNE), minted
through `mint_solid({ kind: 'layered', via: 'hero', spec: { cast, register, tune } })`; its canonical JSON is
`docs/examples/ring-plans/hero.plan.json`. The STARTER that wears the landmark head is `docs/examples/humanoid/`
(`humanoidPlan({ preset, tune, body, face, register, hair, expression })`); the detail head is
`docs/examples/hero-head/` (`bakeHero()`).

## The invariants — read first

- **The silhouette before anything.** A hero reads at 64 px or it does not read. Get the coloured
  silhouette right in the six named views before a single face dial moves. Colour is part of the
  silhouette: the groups (Skin, Top, Bottom, Shoes, Hair) must separate at thumbnail size.
- **One register for the whole figure.** `style: { slots, limbSlots, e }` is the art style. Pick it
  once (`lowpoly` ring6 e 2 · `round` ring8 e 2 · `chamfer` ring8 e 6 · `box` ring8 e 12) and let
  every ring take it; a segment overrides only for a reason you can say (a boxier head on a round
  body). Never mix registers by accident.
- **The skeleton is the vajra rest; the mesh is not the vajra field.** Joints come from a cast word
  (`canonical` / `heroic` / `brute` / `lithe` / `stout` / `child` / `chibi`) through `castArmature`.
  Tune proportion by radii, station heights and `e`; never hand-place a joint off the skeleton.
- **The face is data on the head core, never hand-placed faces.** Eye size and spacing, the brow's
  height and taper, the lip bands, the expression: numbers in the head data. Hair is a library style
  following the skull by address (or, on the anime head, the studio's clumps), never a floating mesh.
- **Every fix is a number.** Patch `/hero/tune/<control>` (a percentage of the cast), `/hero/face/<control>` (a
  percentage of the fitted head), `/plan/...` or `/dials/<name>`, re-read. Never re-mint for a change.
- **Detail and adornment come LAST, by word, and each one earns its place.** They are the dragon's passes
  with the hero's parameters (`detail: 'clothed'`, `adorn: 'ranger'`, or their data), never hand-placed
  panels, buckles or patches. None before the silhouette, the face and the hair read; an adornment whose
  signature the ledger calls `reads, but small` or `unjustified` is made bolder or removed, not shipped.
- **Human characters only.** A creature is `creature-from-plan`; a real species is kind `animal`; a
  person for a turnaround picture or pose study is the figure kind (`character-from-dream`).

## Capability ladder — resolve ONCE

1. Your own reasoning: the FAST path (`plan_audit.source: 'agent'`). The form is complete; you edit numbers.
2. A text worker: hand it the request template below; it prints the plan JSON (`source: 'text:<model>'`).
3. An image reference at a named view: the COMPARE step only, never for reading numbers.

## The loop

```
0. THESIS   One line: role · silhouette word (needle / bell / barrel / column) · register ·
            palette (four colours, named by group) · hair hook · face read (one adjective).
            Restate it every pass.

1. CAST     Pick the cast word and the register, then TUNE in percentages of that cast: the
            thirteen controls (stature; torso / neck / legs; shoulders / waist / hips / depth;
            head; upperArm / forearm / thigh / calf) and the moves (`athletic`, `long-legs`,
            `full-limbs`), composed in a list. mint_solid({ kind: 'layered', via: 'hero', spec:
            { cast, register, tune, palette } }). Read the readout's `hero.measures` (metres)
            and say them back; a range warning is advice, the read is the operator's.

2. SILHOUETTE  Look at the six views (scripts/export-wire-svg.mjs --ref <ref> --views 180,150,90,0).
            Fix proportion ONE word at a time: update_sketch patching `/hero/tune/<control>`
            ("broader" is shoulders × 1.05 on what is there). A move the tune has no word for
            is a `/plan/...` patch (a ring radius, a station z, a segment's `e`); the next
            `/hero` edit regenerates the plan and says it replaced that hand edit. A hand-written
            plan goes through via: 'plan' with `plan_audit`.
            The thigh tops sit inside the pelvis; the arm caps do not stand up as epaulettes;
            the crown is domed, not pinched.

3. COLOUR   Read the figure at 64 px (the World page zoomed out, or a thumbnail of the wire
            with the palette). The groups must separate; a Top and Bottom that merge are one
            colour too close. Change the palette, not the geometry. The anime hero is lit by its
            CHARACTER LIGHT (manifest `toon.light`: the key in its own frame, a threshold, a shade
            swatch per group; on the hair a third tone, its highlight: a ring on the female, a
            fringe streak on the male): judge each group's tones, and set `toon.light.shade`,
            `toon.light.highlight` or the palette (`Hair`, `HairHighlight`), never the mesh;
            `toon: { light: false }` shows the plain lit (Lambert) bake. On the World page the
            brows and lids show through the fringe and the hair's outline stops where two locks
            meet (its draw layers, a stencil the page asks for itself): judge them there, not on a
            still. The rear three-quarter view (the gameplay camera) should keep the crown lit.

4. FACE     The hero wears the LANDMARK head by default (core `humanoid-head.js`: one designed
            surface resampled from a head fitted to reference images, the jaw hinged by the ear so
            the chin drops under the cheeks). Its FACE is the face lab's words as percentages of
            the fit: `skull` (skullWidth, faceWidth, faceLength), `brow` (browHeight, browRidge,
            foreheadSlope), `eyes` (eyeSpacing, eyeSize), `cheeks` (cheekbone, cheek), `nose`
            (noseWidth, noseSize, noseDroop), `mouth` (mouthWidth), `jaw` (jawWidth, chinProjection,
            chinPoint), `ears`; moves `broad-jaw`, `large-eyes`. Pick the expression to bake
            (neutral / smile / determined / surprised). Change ONE word: update_sketch patching
            `/hero/face/<control>`; read `hero.faceMeasures` back; look at the face view. The
            DETAIL head (docs/examples/hero-head `bakeHero({ hair, eye, palette })`) is worn as a
            baked include through `head:` when its live expression controls are the point.
            For an ANIME character wear `head: 'anime'` (core `anime-head.js`: the Anime Form Studio's
            head, ported bit for bit): `headPreset` is its design base (female / male), `face` the
            studio's controls as percentages of the base (skull, brow, cheeks, jawline, chinShape, eyes;
            lower, nose, spacing, iris, headPitch; `tilt` an offset: + lifts the outer eye, − droops
            it), `expression` a pose (neutral / blink / smile / open) or { blink, smile, open, brow }.
            It has no jaw dial: the mouth opens as an aperture. Read `hero.faceMeasures` (eye_m is
            the opening) and look at the face view. Start from a LOOK when the operator names a
            character: `look: ['rival', 'tareme']` (archetypes heroine / lead / rival / princess /
            mentor / kid / stoic; face and hair traits; poses), then add or peel ONE word with
            `set /hero/look`, and fine-tune on top with `/hero/face/<control>`.
            The anime head wears its GRAPHIC FACE by default (`sculpt`: the eye level, the nose tip
            and a nose line on its shade side, the lip line, the fissure's shape, the upper-lid band,
            the lid covering the iris, one catchlight, the brow as a block, the ear spanning the eye
            level to the nose tip). Shape it by word:
            `set /hero/sculpt` to `{ lidWeight: 1.2, browThick: 1.3, fissureShape: 'tri' }` (ratios
            of the base; eyeLevel, earLevel, pronasale, stomion, browAngle, lidAngle offsets) or a move
            (heavy-lid / brow-block / sharp-eyes / low-nose), then `/hero/sculpt/<word>`; read
            `hero.faceMeasures.features` (the feature spacing, advised against the base's bands).
            `sculpt: false` is the studio's own face.

5. HAIR     A LIBRARY word on the landmark head (male: animeShort, buzz, crew, taper, undercut, crop,
            quiff, swept, curtains; female: animeBob, pixie, bob, angled, layers, long, wavy, ponytail,
            bun, braid; either head wears any; `none`), each a closed mass following the skull by
            address, with controls as percentages of the style's preset: the cap (volume, fringe,
            part, fade), the fall (length, graduation, wave), the tails (tail, tie, braid), the anime
            locks (lockWidth, taper, bend, asymmetry), the barber's form on male caps (corners,
            sideBulk, topSlope, lineup) and `definition`, which exaggerates the style's signature.
            One word: `/hero/hair/style`; one number: `/hero/hair/length`; read `hero.hairMeasures`
            back (top, hem below the chin, reach behind the occiput). A control the style ignores is
            advice in `warnings`. The detail head grows a list of `cap`, `bangs`, `tail` tiles instead.
            The ANIME head wears the studio's families (bob, short, long) and `hime`, or none, with its
            controls (volume, length, fringe, clump, thickness, taper; sweep, part and ahoge offsets:
            an ahoge is one upright curl at the crown) and LOCKS: one
            clump directed by its studio name (fringe-1…7, left-/right-temple-0…2, back-1…11, crown
            clumps on short), `/hero/hair/locks/fringe-3` → { ty: -0.05 } moves its tip, root held.
            The hair seats on the head (cap lifted off the skull, clumps hung outside it); read
            `hero.hairCoverage` (the scalp's share showing per view) and look from behind and above.
            On bob, long and hime the clumps are consolidated into SECTIONS (a few forms, each one
            point): judge the masses first; `strands: 1` only when separate strands are the point.
            The anime hero wears its HAIR BASE by default: a form under every family (the mass
            LIFTED off the skull by region, thicker ridge-section locks, no crown accents) and, while
            no family is named, a cut (`swept-back` on the male, `side-parted` on the female; both
            are hair words). Shape the form by word: `/hero/hair/lift` → { crown, temple, fringe,
            nape } (keep volume at 1 beside it), `section`, `ridge`, `flute`, `crownAccents`, and the
            cut's `sweepBack`, `hairline`, `sweepSides`, `fringeGroups`, `backNotch`, `fringeNotch`,
            `flip`, `spikes`, `sideTail`, `shapes` (one family per design: carrots, bananas or chili
            peppers — mass first), `sideburns`; `false` is the studio's construction, `null` the base's.
            Ready cuts: `flipped-long`, `blunt-bob`, `side-tail`; characters `broku`, `jinto`, `jingo`, `kairo`, the heroine `bidel`. Read `hero.hairCut`
            and `hairMeasures.top_m`.
            The anime head wears ANIME PROPORTIONS (about 6.5 / 7 heads tall, longer legs, slimmer
            limbs, smaller hands and feet); `proportions: 'hero'` keeps the realistic body.
            Hair is a mass before it is tufts. Hair colour is the palette.

6. DETAIL   The body's structure, one word: `/hero/detail` → `clothed` (density at the elbows and
            knees, the jerkin's masses, soft sleeve folds, a quilted jerkin with a bare placket and a
            toggle row, knee patches, cuffs, leg wraps), or BODY DATA in the plan's `body` block
            (get_solid_vocab layered: the passes). Read `hero.dress.legibility`: the character height
            each family reads from; at your viewing size, remove what only shimmers or make it bolder
            (a fold that reads as stitches is a fold not wanted), and set the eyes for that size.

7. ADORN    The equipment, one word: `/hero/adorn` → `ranger` (belt, baldric, an archer's bracer on
            one arm, ONE pauldron on the other shoulder — the focal accent), or a KIT in the plan's
            `adorn` block. Read `hero.dress.adornments`: every signature `justified`, else make it
            bolder or drop the adornment; and `hero.dress.clearance`: nothing sinks into the body at
            a dial extreme you will use. One accent colour; asymmetry tells the story.

8. LOOK     measure_solid({ ref }) → closure per part, size, the EXPOSURE ledger: both eyes must
            `reads` from the frontal and a three-quarter view, the hair from the back; anything
            `buried` is moved, not shipped.

9. COMPARE  With a reference at a known view: export-wire-svg.mjs --ref <ref> --compare
            frontal=ref.png[,lateral=side.png]; read `iou`, `aspect`, `centroid`. The numbers are
            the record; the picture is discarded.

10. RIG     Free: the plan carries the rig, `gesture` first when the hero stands, then `idle` / `walk`
            / `wave`. Play `walk` and `wave` on the World page; the feet stay planted, the pauldron
            stays on the torso while the arm moves beneath it, the bracer rides its forearm.
            export_model({ ref, format: 'glb', skinned: true, clips: '_all' }) ships it.
            STAND: `/hero/gesture` → `relaxed` (the anime hero's default), `hand-on-hip`, `guard`,
            pose words or a list; `rest` for none. Read `hero.gesture` before accepting: the
            hand clearance and the free sole within a few millimetres; judge the silhouette at
            256 px ¾, not the numbers alone.

11. LOCK    Report the ref, the thesis, the register, the palette, the compare numbers at the
            views you had, the exposure flags for the eyes and hair, the adornment ledger, and the
            HERO LEDGER.
```

## The hero ledger

Report it at LOCK, and whenever you stop early:

| Segment | silhouette | colour | detail | | Head | face | hair |
| --- | --- | --- | --- | --- | --- | --- | --- |
| torso, pelvis, arms, legs, hands, feet | done / pending | done / pending | done / pending / not wanted (say why) | | head | done / pending | done / pending / none |

Adornments are their own rows: id × signature × verdict (`justified` / `reads, but small` / `unjustified`)
× kept / bolder / dropped. A pass not wanted says why (a human has no spurs or spines; knee folds piled
into the patch).

## The request template (a text worker)

> You are filling a RING PLAN for a 3D character compiler. Frame: metres, +z up, +y is the front,
> x = 0 the mirror plane, soles on z = 0. The joints are given (a human rest skeleton); keep them.
> Replace every ring radius, station z and `e` to make THIS human: <the thesis>. `rA` / `rB` are a
> segment's ring radii at its joints, a number or `[across, front-to-back]`; a trunk lists stations
> `{ z, r: [across, front-to-back], yc? }`. Keep `style` and the names exactly. Give `palette`
> as four hex colours for Skin, Top, Bottom, Shoes. Return the JSON only.

Paste `hero.plan.json` after it. The worker's answer is the plan; mint it with `plan_audit`.

## Art direction — the read the numbers serve

1. **Primary masses first.** Three head/body ratios and shoulder widths in silhouette, front / profile /
   three-quarter, before a face dial moves. Long intentional planes come from the register and `e`, not from
   fewer vertices. The shoulder → neck → collarbone transition is the junction the eye checks first.
2. **A hierarchy.** About 60 % quiet form, 30 % structure, 10 % focal accents, as a composition exercise.
   Contrast lives at the eyes, the mouth and ONE equipment signature (the ranger's bronze boss).
3. **The face is a designed system.** Brow → lid → cheek clear; the pupil/iris aperture set at the real viewing
   distance; one readable mouth corner. Check neutral, smile and surprised at small size.
4. **Hair is a mass before it is tufts.** The cap's window is the hairline; its lean is the direction; only
   then does the tile break-up matter. A fringe or tail is one clear shape at 128 px.
5. **Lighting is a separate comparison** (same mesh, same camera); never fix unclear form with surface noise.
6. **Protect the read at 128, 256 and 512 px and in motion.** Play `walk` and `wave` before calling the hero
   done; movement exposes the construction.

## What you DON'T do

- You don't move a face dial before the silhouette reads at 64 px.
- You don't mix registers; one `style` for the figure.
- You don't hand-place a joint, a face, or a hair mesh — a cast word, head data, grown hair.
- You don't add detail or adornment before the silhouette, face and hair read, or hand-place either:
  a word or the passes' data, and every adornment's signature justified.
- You don't ship an eye the exposure ledger calls `faint` or `buried`.
- You don't add contrast everywhere: the eyes, the mouth, one accent.
- You don't force a creature, a real animal, or an SVG figure study through this loop.
- You don't sign a `plan_audit` for a worker that did not run.
