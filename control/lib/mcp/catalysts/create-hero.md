---
{
  "id": "create-hero",
  "name": "Create a hero — a human character on the ring grammar: silhouette, colour, face, hair",
  "summary": "The human register of the creature loop. A HERO is a ring plan on the vajra rest skeleton: joints from a cast word, rings along them, one style register for every ring, a palette by group, and a head worn as an include whose face and hair are data on the detail core. The loop nails the COLOURED SILHOUETTE in one art style first, then the face and the hair, then locks. Adornments (garment panels, bands, buckles, digits, patches) are a later loop; this one stops at the hero.",
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

Grammar: `get_solid_vocab({ id: 'layered' })` (the Plan section, `style`, Exposure, Compare). The
hero FORM is `docs/examples/ring-plans/hero.plan.json`, written by `hero.plan.mjs` (`heroPlan({ cast,
register, girth, headScale, palette, head, body })`; `male` / `female` casts, the body controls); the STARTER
that puts it together is `docs/examples/humanoid/` (`humanoidPlan({ preset, body, face, register, hair,
expression })` with the landmark head); the detail head is `docs/examples/hero-head/` (`bakeHero()`).

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
  height and taper, the lip bands, the expression: numbers in the head data. Hair is grown from the
  skull (`cap` tiles, `bangs` tiles, a `tail` sweep), never a floating mesh.
- **Every fix is a number.** Patch `/plan/...` or `/dials/<name>`, re-read. Never re-mint for a change.
- **Adornments are NOT this loop.** Garment panels, belts, cuffs, buckles, digits, patches,
  correctives: name them in the ledger as "next loop" and stop. A hero with a clean silhouette, a face
  and hair is done here.
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

1. CAST     Pick the cast word and the register. Start from the form (hero.plan.json is the
            canonical cast in `round`). Set `style`, `palette`, and the cast's joints.

2. SILHOUETTE  mint_solid({ kind: 'layered', via: 'plan', spec: { plan, title, plan_audit? } }).
            Look at the six views (scripts/export-wire-svg.mjs --ref <ref> --views 180,150,90,0).
            Fix proportion ONE number at a time: a ring radius, a station z, a segment's `e`.
            The thigh tops sit inside the pelvis; the arm caps do not stand up as epaulettes;
            the crown is domed, not pinched.

3. COLOUR   Read the figure at 64 px (the World page zoomed out, or a thumbnail of the wire
            with the palette). The groups must separate; a Top and Bottom that merge are one
            colour too close. Change the palette, not the geometry.

4. FACE     Wear a head. The LANDMARK head (docs/examples/humanoid `humanoidHead({ preset, shape,
            register, hair, expression })`): one designed surface on the figure's own skull landmarks,
            the jaw hinged by the ear so the chin drops under the cheeks, the face knobs (`browRidge`,
            `jawWidth`, `chinPoint`, `noseSize`, `cheekbone`, `eyeSize`) the appeal dials; or the
            DETAIL head (docs/examples/hero-head `bakeHero({ hair, eye, palette })`, live expression
            controls on the detail core). Pick the expression to bake (neutral / smile / determined /
            surprised). Change one knob, re-bake, look at the face view.

5. HAIR     A style word (landmark head: `crop`, `swept`, `bob`, `none`, one continuous mass whose
            perimeter follows the skull; detail head: a list of `cap`, `bangs`, `tail`, grown tiles).
            Hair is a mass before it is tufts. Hair colour is the palette.

6. LOOK     measure_solid({ ref }) → closure per part, size, the EXPOSURE ledger: both eyes must
            `reads` from the frontal and a three-quarter view, the hair from the back; anything
            `buried` is moved, not shipped.

7. COMPARE  With a reference at a known view: export-wire-svg.mjs --ref <ref> --compare
            frontal=ref.png[,lateral=side.png]; read `iou`, `aspect`, `centroid`. The numbers are
            the record; the picture is discarded.

8. RIG      Free: the plan carries the rig and `idle` / `walk` / `wave`. Play `walk` on the World
            page; the feet stay planted. export_model({ ref, format: 'glb', skinned: true,
            clips: '_all' }) ships it.

9. LOCK     Report the ref, the thesis, the register, the palette, the compare numbers at the
            views you had, the exposure flags for the eyes and hair, and the HERO LEDGER.
```

## The hero ledger

Report it at LOCK, and whenever you stop early:

| Segment | silhouette | colour | | Head | face | hair |
| --- | --- | --- | --- | --- | --- | --- |
| torso, pelvis, arms, legs, hands, feet | done / pending | done / pending | | head | done / pending | done / pending / none |

Adornments are a separate row that always reads "next loop" here.

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
   Contrast lives at the eyes, the mouth and (later, in the adornment loop) one equipment signature.
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
- You don't add adornments here — name them "next loop" in the ledger and stop.
- You don't ship an eye the exposure ledger calls `faint` or `buried`.
- You don't add contrast everywhere: the eyes, the mouth, one accent.
- You don't force a creature, a real animal, or an SVG figure study through this loop.
- You don't sign a `plan_audit` for a worker that did not run.
