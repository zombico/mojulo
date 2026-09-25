# Dragon head, born layered

The [raccoon-layered](../raccoon-layered/README.md) experiment retrofitted named pins onto a
frozen mesh. This example starts from the other end: the primary form is a **station/slot loft**,
so every point has a name before it has a coordinate, and seven dials regenerate the whole head.
It is a reference for the grammar, not a registered Mojulo kind or a manji-tree card.

## Layers

| Layer | Here |
| --- | --- |
| L0 | `+z` up, `+y` front, mirror plane `x = 0`, 0.8 m per head unit, head centred at 2.05 m |
| L1 | `cranium` (8 slots: top, brow, side, lip, palate, mirrored) and `jaw` (6 slots: gum, gumR, jawR, bottom, mirrored), each a closed loft over six stations plus back and tip caps |
| L2 | horns, eyes, five teeth per side, three crest spikes: closed solids pinned to **named** L1 faces through `surface-pin.js`, geometry stored as local offsets |
| L3 | nostrils as open patches with declared boundaries; brow creases as feature edges on the cranium brow slot edges |
| L4 | groups (Skull, Snout, Lip, Palate, Jaw, Horns, Eyes, Teeth, Crest, Nostrils) |
| L5 | the shared wire renderer, framed once from the union of all casts |

Point identity is the address: `cranium/st2.browR`, `jaw/st4.gumL`, `hornR/tip`. Face identity is
the band and slot: `cranium/st1-st2.k0.a`. The right half is generated; the left half is its exact
mirror by name with reversed winding. A midline detail (a crest spike) uses a **symmetric pin**, the
average of a face frame and its mirror, so it stays on `x = 0` under every dial.

## Where the code lives

The grammar and the lowering are core capability: `control/lib/graph/polygonizer/station-loft.js`
and `station-loft-workbench.js`. `compile.mjs` and `lower-workbench.mjs` here are thin shims bound to
this recipe. Everything dragon-specific (the cranium/jaw slot rules, the horn/eye/tooth/crest
geometry, which stations each dial reaches) is in `seed-recipe.mjs`, and the recipe it writes is
declarative: explicit rings per station, pins with local offsets, dial ops with blends, loft
declarations. The same recipe mints natively as `mint_solid { kind: 'layered', spec: { recipe } }`,
where a dial is then an `update_sketch` patch on `/dials/<name>`.

## Dials

`skullWidth`, `snoutLength`, `browDrop` reshape the station table, so L1 regenerates and every pin
frame moves with it. `hornSweep`, `crestHeight`, `toothLength` stretch a detail along its own local
axis inside its pin frame. `jawOpen` is a rigid rotation of the jaw part about its rear gum slot;
the lower teeth ride it because their pins are on jaw faces, the upper teeth do not. Ranges are in
`compile.mjs` and out-of-range or unknown dials throw.

## Artifacts

Kept here: `recipe.json` (the station table, rules, parts with pins and offsets, creases;
authored once by `seed-recipe.mjs`, which reproduces it byte for byte), `casts.json`, the
compiler, the tests and `validation.json`. Everything rendered lands in the gitignored
`lite-template/integration/0924/spike-output/``dragon-layered/` (override with `MOJULO_SPIKE_OUT`):

- `<cast>.json`: compiled spatial sources in the wire-head schema plus point IDs, provenance, pins.
- `<cast>-{quarter,profile,front}.svg|png`, `baseline-construction.svg`: every SVG embeds its source
  and camera; every path carries its point IDs and spatial interval.
- `casts.png`, `casts.svg`: the sweep in `casts.json`, quarter and profile, one framing.
- `validation.json`: counts, per-cast audit, pin origins per cast.

## Mint it as a solid

`lower-workbench.mjs` lowers a compiled cast to a `mint_solid` kind `workbench` spec: every
part is one straight loft whose stations are its named rings. The cranium and jaw lower
exactly (their rings are perpendicular to their axes; the caps are pinched end stations, and an
opened jaw lowers on its rotated axis). Eyes, teeth and crest spikes lower exactly too; the
horns' mid ring is projected on its station plane, so `loweringError` reports a fraction of a
millimetre for them. Nostrils and brow creases have no workbench channel and are omitted.

```sh
node docs/examples/dragon-layered/lower-workbench.mjs '{"jawOpen":30}' roar <outdir>   # roar.workbench.json
cd control && node scripts/mcp-stdio.mjs call mint_solid --json @<outdir>/roar.mint.json
```

The minted sketch is an ordinary workbench solid: the World turntable, `measure_solid`,
`update_sketch` patches by part id, `export_model` to GLB or STL (`union: true` fuses the
overlapping parts through Manifold), and `scripts/export-wire-svg.mjs --ref` for wire views.
Dials are compile-time here: a cast is a mint. The `layered` kind carries the recipe and dials live;
it renders the compiled mesh directly (so parts of any shape count), and keeps this loft lowering as
a library form for a print workflow that wants monomers.

## Checks

Machine, in `test-layered.mjs`: every part meets its closure contract at baseline and at every dial
extreme; point and face ID sets are dial-invariant; every point is addressed by station/slot or by
its pin face; details keep their local offsets under every dial (stretch dials along their own axis
only); exact mirror symmetry by name; the jaw is rigid under `jawOpen` and hinges at its slot;
channels off emit nothing; a deleted pin face and a wrong-layer pin throw; determinism. The raccoon
renderer's own output is byte-identical after gaining `set_framing`.

Not certified: self-intersection, inter-part clearance, printability. The cranium and jaw overlap
at the gum line by design. No rig or weights.

Eyes: the agent looked at `casts.png` and `roar-front.png`. Human acceptance is separate.

## Reproduce

```sh
node --test docs/examples/dragon-layered/test-layered.mjs
node docs/examples/dragon-layered/seed-recipe.mjs        # recipe.json, byte-identical
python3 docs/examples/dragon-layered/render.py           # NumPy + Pillow, as the wire example
```
