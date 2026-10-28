---
{ "id": "house-concept", "name": "House concept — what it looks like, and how it sits", "summary": "the Concept outcome of a house: massing, facade and roof on a site, walkable, with stills, a turntable and a GLB; the questions to ask from zero and the fields that open the Cover, Site, Massing and Walk tabs", "when": "someone wants to see a house before they plan it: its look, its roof, its lot, a still or a turntable; or a mint_building `next` names outcome 'concept'", "tier": "render-primitive", "marks": [], "phase": "p1" }
---

**Concept** answers *what does it look like, and does it sit right*. The structure book's tabs:
Cover, Site, Massing, Walk.

## From zero, ask

1. **How big, and how many floors?** A cottage, a house or a villa (`tier`), one or two storeys
   (`storeys`). Left out, the mint draws both from the seed.
2. **What does it look like?** A style family (`style`: siding, brick, modern, tofu, mission, brownstone, terrace,
   canal, kyosho …; card `house-dwelling`) and a roof. A roof is a **style** (`bungalow`, `mission`, `pavilion`,
   `farmhouse`, `manor`, `modern-shed`, `standing-seam`, `cornice`, `terrace-slate`, `canal-gable`, `galvalume-shed` …;
   `ridge: 'short'` turns a gable's ridge across the long way; a home of `houseLook: 2` carries its facade up its
   gables, finished as the roof says: `verge: 'parapet' | 'coping'`, `stack`, `loft`) and may take a `form` (`gable`, `hip`,
   `shed`); `roof: 'gable'` alone is a form, and the mint reads it as the bungalow style in that form.
   A steeper or flatter roof is `pitch`, rise over run (`roof: { style: 'bungalow', form: 'gable',
   pitch: 1 }` is 45°; the bungalow's own is 0.5).
3. **Where does it sit?** `perimeter: true` adds the lot: setbacks, street, drive and garden, and
   the site plan C-101.

## The fields that open each tab

- **Massing** (A-201 elevations, A-301 section): any house; `roof` puts the roof on them.
- **Site** (C-101): `perimeter: true`.
- **Walk**: every house has a World (the Walk tab, `/api/sketches/<ref>/world`); its **walk**
  button walks it at eye height. `view: 'exterior'` (default) shows the shell.
- Stills, a turntable and a GLB: `forge_motion` and `export_model({ ref, format: 'glb' })`.

```json
{ "seed": 12, "tier": "house", "storeys": 2, "style": "brick", "roof": { "style": "manor" }, "perimeter": true }
```

## Laws

- A recipe is a starter: change it with `update_sketch`, re-mint only for a side-by-side option
  (`run_experiment_sweep` for several massings).
- The mint writes what it infers into the recipe with its reason in `notes.inferred`; the Cover
  lists them.

Next outcome: does it live well, `house-livability`.
