---
{
  "id": "design-tech-family",
  "name": "Grow the technology solver: a dress, a variant, a row or a part",
  "summary": "Teach the world bible's technology crafter a new kind of machine, so every civilization that names it gets one designed for it. The cheapest entry wins: a DRESS (one mechanism restyled by what it is made of and driven by), a VARIANT of a body-plan row (data: a core and parts placed in metres), a new ROW for a form, and only then a new PART KIND or MECHANISM in code. Depict first on a shaded contact sheet, then hold it to the laws, sweep it across motifs, cameras and settings, and confirm it in a bible. When a law fights a good depiction, fix the principle, never the one machine.",
  "valueHook": "Describe a stagecoach, a tram or a motorcycle once and every world that says those words gets one: designed to read at the hero's scale, dressed for its setting, rigged and exportable, with no machine modelled by hand.",
  "version": 1,
  "category": "world-building",
  "requires": { "protocols": [] },
  "parameters": [
    { "name": "intent", "prompt": "What should the crafter learn to make? (e.g. 'a stagecoach', 'a maglev tram', 'a steam traction engine', 'a hand cart pulled by its owner')" },
    { "name": "setting", "prompt": "What is it made of and driven by, if it matters? (e.g. 'timber and rope, muscle', 'alloy and glass, field'), or 'any' to try it in every setting", "default": "any" }
  ],
  "mcpTools": { "mojulo": ["compose_world", "semantic_search"] },
  "outputContract": { "summary": "A new dress, variant, row or part in the technology solver, a contact sheet it was judged on, its sweeps holding, and a bible that shows it.", "fields": ["entryKind", "rowOrDress", "sheet", "sweep"] }
}
---

# Grow the technology solver

`design-vehicle-family` grows the old fleet libraries by adding a registry row a populator samples. This catalyst
does the same for the world bible's technology, one level up: the entry is an input to a SOLVER, not to a
sampler. A row says what a machine is made of in data; the solver fits it to the camera it is met at, hangs its
adornment, dresses its mechanisms for the setting, and holds it to laws that know nothing of the machine's name.
Add the entry and every civilization that says the words gets one.

## What exists (read before you add)

All under `control/lib/graph/gameworld/`:

| layer | file | what it holds |
|---|---|---|
| words → a thing | `tech-crafter.js` `CRAFT_TRAITS` | forms and variants (`X(form, variant, words, read)`), dials set by words (`M`) |
| how it is met | `tech-direction.js` `rankOf`, `useOf` | interest rank; watched, held or driven |
| what it is | `tech-bodyplan.js` `BODY_PLANS`, `PART_KINDS` | rows keyed `kind/form`, each a core and parts, or `variants` picked by `when` |
| what it runs on | `mech-kit.js` `MECHANISMS`, `MADE`, `DRIVEN` | wheel and track topologies; their dresses by setting; cage and detail |
| what it wears | `tech-adornment.js` `ADORNMENT_PIECES` | pieces hung on sockets by face and mass, each serving a function |
| how it reads | `tech-readout.js`, `tech-chassis.js` `chassisLaws` | facets or outline at the use's distance, budget by use, segments, one leads |
| how it looks | `tech-sheet.js`, `scripts/tech-sheet.mjs` | the shaded contact sheet |

Read the intent first: `craftTech(kind, intent)` says the form, the variant and the dials the words set. If the
words reach the wrong form, the first edit is a word in `CRAFT_TRAITS`, not a row.

## 1. Pick the cheapest entry that satisfies the intent

1. **A dress.** The thing exists, but its wheels or tracks are wrong for a setting. Add a dress to a mechanism in
   `mech-kit.js`: `{ read, made, driven, motifs, on?, lifts?, build }`. Its parts must keep the mechanism's
   topology (a hub on the axle, a rim at the contact; a sprocket, an idler, road wheels and a belt). It is picked
   by what it is made of first, then what drives it. A row never names a dress; it may `prefer` one, or say
   what drives its wheels (`driven: 'muscle'` for a cart or a bicycle).
2. **A variant.** The form has a row, and the thing is a kind of it (a coach of the drawn row, a tram of the rail
   row). Add `{ name, when, core, parts, lead? }` to the row's `variants`. `when` is the variant's name in
   `CRAFT_TRAITS` or a dial its words set. Parts are data, placed in metres at true size:
   - `mass`: a loft with a glass band; it can taper at both ends.
   - `drum`, `tube`, `tray`, `lamps`, `band`.
   - `wheels`: `at`/`x`, `inline`, `under`, `steer`, `steerWith`, `on: 'rail'`, `prefer`, `driven`.
   - `arches`, `rails`, `bogies`.

   x may count from the core's nose or tail (`{ front }`, `{ rear }`); z from the ground or the core's top
   (`{ top }`).
3. **A row.** The form has no row yet. Add `kind/form` to `BODY_PLANS` from the same parts. Its forms are reached by
   the crafter's words; a form without a row keeps its block.
4. **A part kind or mechanism (code).** Nothing in the vocabulary can say it: a rotor, a wing, a sail rig that
   turns. Add it to `PART_KINDS` (or `MECHANISMS`) generically: no form names. The solver, the kit and the
   adornment carry source guards that fail on a form's name.

## 2. Depict first

Draw it before you measure it:

```
node scripts/tech-sheet.mjs "vehicle|a stagecoach|ornate|third-person|iron-and-rivet|steam" "vehicle|a stagecoach|smooth|third-person|steel-and-rubber|combustion" --eye front
node scripts/tech-sheet.mjs "vehicle|a stagecoach" --eye side
```

The sheet is shaded as the engine shades it; the bible's plates paint each face flat. Look, from the front
three-quarter and from the side, for:
- **Silhouette and proportion.** Does it say what it is at a glance?
- **The mechanism shows.** Wheels on axles, a sprocket at the rear, a pole to its yoke.
- **What holds it up.** Wheels on the ground, rails under it, a glow under what lifts.
- **One body leads.**

Change the row until it reads in every setting you named, then go on. This is the eyes gate: say what you saw,
never that it passed.

## 3. Then the laws, and question them

Each sheet line says whether every law held. When one fails, ask which is wrong: the machine, or the law. These
principles came from laws that fought a good depiction:
- **Measure where it is read.** Facets are measured at the use's distance; the silhouette at the distance it is
  watched from.
- **Repetition groups.** A row of wheels is one band in the silhouette, not a segment each.
- **Ground is not the thing.** Rails and sleepers are drawn and counted, never its outline.
- **Push a proportion, never break it.** The solver grows a lead at most `LEAD_GROW`; a lead may be several pieces
  that read as one body.
- **Adorn what it is.**
  - A turret needs a deck that is large and deep, else its weapons are racked.
  - A thing pulled or pedalled has no machine face.
  - A thing with windows or lamps already has one.
- **Optional parts are the row's own 33.** The solver drops them, last first, when the thing says too much.

Fix a principle in the law or the solver, for every thing it touches, and write it down in the changelog. Never
special-case the one machine.

## 4. Sweep it

- Add its briefs to `tech-adornment.deep.test.js`. Every variant must be reached, and every brief × motif × camera
  holds.
- A new dress joins `mech-kit.deep.test.js` (every dress × body plan × motif × person camera).
- Run `npm run test:deep:changed`. A case that cannot hold must name its conflict and what would settle it, and
  the test says which cases those are and why.

## 5. Confirm it in a world

Give a civilization in a gameworld the words (`technology.vehicles: { coach: 'a stagecoach' }`), or compose one
(`compose_world` with a prompt that names it), and draw its bible:
`node scripts/out-sheet.mjs gameworld --example halden-reach`. The thing appears in its civilization's
technology, with its readout. A world without technology must still re-render byte-identical.

## Pitfalls
- **No form names below the rows.** The solver, the kit and the adornment are read by sockets, faces, masses,
  functions and roles. A rule that needs a machine's name belongs in a row.
- **Kernels are promises.** The workbench kernels' output is a compatibility promise over minted recipes. When one
  does not do what a part needs (the shell tray's rounded cavity), build the part from what does (four walls),
  never change the kernel.
- **The setting picks the dress.** A row that names a dress breaks the one-wheel-many-dresses rule. `prefer` and
  `driven` are the only ways a row leans on it.
- **Depiction before measurement.** A row tuned only to pass the laws gives the bloated tank and the giant boiler
  this loop was built to stop. Look first.
