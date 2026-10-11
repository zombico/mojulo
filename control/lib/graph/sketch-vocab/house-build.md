---
{ "id": "house-build", "name": "House build — the frame, trades and what it takes", "summary": "the Build outcome of a house: the frame by system, wiring and rainwater, the takeoff, cut list, sheet goods and panel, the checks, and IFC; the questions from zero and the fields that open the Structure, Services, Quantities and Checks tabs", "when": "someone asks whether a house can be built and what it takes: framing, a cut list, a takeoff, wiring, gutters, structural checks, or an IFC model; or a mint_building `next` names outcome 'build'", "tier": "render-primitive", "marks": [], "phase": "p1" }
---

**Build** answers *can it be built, and what does it take*. The structure book's tabs:
Structure, Services, Quantities, Checks.

## From zero, ask

1. **Built how?** A framing system: `platform` (stud walls), `masonry`, `post-and-beam`,
   `kigumi`, `steel` or `concrete` (card `house-construction`). The frame needs a stack: a
   single floor is `levels: [{ index: 0 }]`, which the mint writes when it is left out.
2. **To what stage?** `framing.stage`: `frame`, `rough-in`, `insulated`, `lined`.
3. **What sheds the rain?** `drainage: true` sizes gutters and downspouts to the roof; a
   tradition (`british`, `japanese` …) changes their kit.
4. **What covers the roof?** `roof.covering: true` (or a type: slate, asphalt-shingle, kawara …)
   lays it as courses and counts it.

## The fields that open each tab

- **Structure** (S-101 foundation, S-102… storey frames, the roof framing plan, the member
  schedule): `framing`.
- **Services** (E-10x electrical with the panel schedule; P-101 roof drainage): `framing`
  roughs the wiring in; `drainage: true`.
- **Quantities** (takeoff, cut list, sheet goods): `framing`.
- **Checks**: every house; framed, the catalog and wiring checks join them. Span checks are
  named NOT RUN: a house frame carries no bearing joints yet.
- **IFC**: `export_model({ ref, format: 'ifc' })` (card `house-bim`).

```json
{ "seed": 5, "storeys": 2, "windows": true, "roof": { "style": "bungalow", "covering": true }, "framing": { "system": "platform", "stage": "rough-in" }, "drainage": true }
```

## Laws

- The frame, wiring and rainwater are planned from the recipe on every read; an edit to the plan
  re-frames it.
- The quantities and checks are advisory, not an engineered design.
