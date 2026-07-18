# Level-from-dream — dreaming a level's style bible into buildable 3D-world dials

Status: SPIKE LANDED (L0, 2026-07-15) — the constrained-dream → buildability →
verify-one loop proven end-to-end by hand, no new substrate. Proof +
retrospective: `lite-template/integration/0715/spike-output/level-from-dream/`.
The **environment/level register** of the dream loop — sibling to the FIGURE
register (`character-from-dream.plan.md`) and the OBJECT register
(`reconstruct-from-dream`). Aim: give the game's **level designer** a way to
dream the *overall style of a level* — the walkable 3D world view, its assets,
and the style bible that makes it — so a level's LOOK stops being "inherited
world theme + a mechanic→glyph default map" and becomes a **deterministic style
recipe** a room/cave shell derives from. **Inhabitants (rules/mechanics/entities)
are out of scope here** (operator call 2026-07-15): this register owns the
environment's *form + surface + light*, not what moves in it.

## The parallel (why this mirrors character-from-dream)

Same skeleton: an image worker is the model's EYES; the model reconstructs what
it SAW into closed-vocabulary substrate dials; two gates (a dream attestation the
agent signs + an operator approval); the dream is a reasoning aid, the recipe is
the sovereign artifact.

| character-from-dream | level-from-dream |
|---|---|
| Body = ~20 monotone dials (DIMORPH pole + proto) or `fluffs` | **Geometry register:** `room` (angular — `architecture/suite-layout.js`) vs `cave` (organic — `architecture/dungeon-designer.js`) + the chamber/volume graph + dimensions |
| Wardrobe = instrument × mugen score × cuts/panels | **Surface treatment** = per-role material (the 18-finish shelf `polygonizer/materials.js`) × palette × texture tile |
| Skin = paint identity over the scaffold | Material atlas / set-dressing over surfaces (later) |
| DREAM = flat front + ¾ character sheet | DREAM = a renderer-constrained mood board **+ an exploded level-asset trim sheet** |
| COMPARE = silhouette + read from one still | COMPARE = **walkthrough** — several camera frames along the path (a level reads in motion) |
| `dream_audit` → operator approval → build (`figure-specs.js`) | same three gates, same shape (`level-style-specs`, to build) |
| Sovereign artifact = `create_figure` recipe | Sovereign artifact = `compose_world` / dungeon-spec recipe carrying a **style bible** |

## The one honest difference: character was ~90% there, this is ~40%

For character, C1/C2 were mostly an *unlocking* — every body/wardrobe dial
already existed. For levels, the substrate audit (2026-07-15) found the opposite:
**the tuning surface that exists today is GEOMETRY + LIGHT, not LOOK.**

- **Palette is a hardcoded module constant** (`SURFACE_PALETTE`, scene-css3d.js)
  baked into BOTH the room and cave shell builders. No manifest→palette plumbing.
- **No texture/material dial is wired into the room/cave shells.** The machinery
  all exists — the `surfaceTexture` path, and the 18-finish Blinn-Phong material
  shelf with a loud closed-vocab gate (`materials.js` `MATERIALS` +
  `validateMaterialRef`) — but it only runs on the *per-object* workbench/
  polygomer path, never on walkable-world surfaces (proven: a porthole minted via
  `create_workbench` wore `gunmetal`/`glass`/`neon`; a room shell cannot).
- Each primitive exposes only **2 style enums per surface** (cave/flat,
  wave/flat, dome/flat).
- The world theme `material`/`palette`/`style` slots exist but are **dead** — the
  city adapter ignores them, and for the `action` base (games) the `style` slot
  is dropped entirely (`compose-world.js`).
- **`body:{type:'asset', ref}` is designed-but-not-built** (game-assets.plan.md),
  so a dreamed asset cannot yet be composed INTO a room/cave world.

So the load-bearing move here is a real substrate build (L1), not an unlock.

## The pipeline (the refined loop — feasibility moved upstream)

The operator's refinement (2026-07-15): don't dream freely then discover gaps —
**dream constrained, prove buildability, verify one, approve, THEN 3D.**

```
0. CONSTRAIN  Author/read the renderer-constraint brief: what the 3D renderer
              CAN build (two enclosed interior registers; the 18-material shelf;
              displacement-not-ornament; per-role palette; time/sky/fog/vexar/
              fire lighting) and CANNOT (murals/decals/text, prop clutter,
              vistas, mirrors/refraction, photoreal grime). This SHAPES the
              mood-board prompt AND is the buildability rubric.
1. DREAM      A renderer-CONSTRAINED mood board (image worker) — a few flat,
              legible frames + let the model hand back an exploded level-asset
              trim sheet (it natively does — the character loop's wire-sheet
              analogue). Look; do NOT bind.
2. ANALYZE    Score every dreamed element against the brief: ✅ BUILDABLE (name
              the dial) · ⚠️ APPROXIMABLE (coarse) · ❌ GAP (vocabulary to NAME,
              not geometry to invent — the character-loop doctrine).
3. VERIFY-1   Reconstruct ONE ✅ asset live in the substrate and render it —
              cheapest proof the vocabulary reaches the look before any world
              build.
4. APPROVE    OPERATOR gate. Surface the board + analysis + verify render; STOP;
              build only on explicit sign-off. The agent must NOT self-approve.
5. BUILD 3D   Reconstruct the level as a walkable lit /world carrying the style
              bible; render a walkthrough; compare; single-dial fixes; discard
              the dream on lock (only the audit survives).
```

## The style-bible schema (what the dream-reader emits)

```jsonc
levelStyle = {
  register: 'room' | 'cave',                          // angular vs organic   [EXISTS]
  graph:    { chambers|volumes, tunnels|halls, dims }, // the geometry graph   [EXISTS]
  surfaces: {                                          // ← THE L1 CHANNEL     [BUILD]
    floor:   { material: <18-shelf>, palette: <hex>, texture?: <tile> },
    wall:    { material, palette, texture },
    ceiling: { material, palette, texture },
  },
  atmosphere: { time: day|dawn|dusk|night, sky: <preset>, fog?: {...} },  // [EXISTS, strong]
  lighting:   { vexar, tint, fire|lamps, diffusion },                    // [EXISTS, strong]
}
```

## Increments

1. **L0 — hand-spike the loop, no new substrate.** ✅ LANDED (2026-07-15).
   Dreamed a cold derelict steel station (room register) mood board constrained
   by the brief; analyzed buildability (every load-bearing element ✅/⚠️, only
   fine props ❌); reconstructed one asset (a `gunmetal`+`glass`+`neon` porthole)
   via `create_workbench` and rendered it (studio `/png` + lit three.js `/world`).
   Findings below drive L1. Proof dir: `.../0715/spike-output/level-from-dream/`.
2. **L1 — the substrate build (load-bearing).** Wire a per-surface `material` +
   `palette` channel into `buildRoomShellFaces` / `buildRoundRoomShellFaces` +
   the dungeon chamber/tube shells, routing facets through the existing
   `surfaceTexture` path + `materials.js` shelf (with `validateMaterialRef` as the
   closed-vocab gate). This IS "tune the two primitives in library." Revives the
   dead theme `material`/`palette`/`style` slots. Sub-item: `body:{type:'asset',
   ref}` so a dreamed workbench/carved-solid asset can be placed IN the world
   (game-assets.plan.md dependency).
   - **L1 · dungeon-designer half ✅ LANDED (2026-07-15).** `dungeon-designer.js`
     grew an L1 **style bible**: a spec-level `style: { palette:{floor,wall,ceiling},
     material:{floor,wall,ceiling}, tunnel:{base,material} }` (per-chamber/tunnel
     overrides too). `buildRoundRoomShellFaces` already accepted a `palette` param —
     the dungeon now MERGES a complete palette over the historic-brown default
     (`DUNGEON_PALETTE`, matching `SURFACE_PALETTE` exactly ⇒ un-styled = byte-
     identical) and passes it. Material is tagged onto the baked shell faces by
     group (`shell:floor/ceiling/wall`) via `tagFacesWithMaterial(resolveMaterial())`
     — Blinn-Phong spec in `/world` + PBR in `.glb`, closed-vocab gated by
     `validateMaterialRef` at plan time. Tunnels thread `base`+`material` too. Proof:
     the SAME `{chambers,tunnels}` graph renders cold steel (styled) vs warm cave
     (default) — `.../0715/spike-output/level-from-dream/dungeon-l1-styled.png` vs
     `dungeon-default.png`; walkable (hub camera + walk/fly). Spike gen test green,
     no regression. **Follow-ups:** the tunnel/chamber GLOW light color is still
     hardcoded warm (`[1,0.62,0.3]` in `buildDungeonFaces`) → thread into `style`
     so cold rooms get cold glows; texture-tile skinning (dungeon plan.md roadmap
     #1); then the suite-layout/`room` half of L1 for the angular register.
   - **Level elements · fixtures ✅ (2026-07-15).** The asset kit drops into a
     styled dungeon as set-dressing via `renderDungeonWorld({ extraFaces })` + the
     `workbenchAssetFaces(manifest, {translate, scale, light})` world-asset bridge —
     a FURNISHED, styled, walkable level (`dungeon-furnished.png`: amber light
     strip + teal console + porthole mounted on a cold-steel chamber wall). Caveat:
     the bridge does uniform scale + translate only (NO rotation), so assets (which
     face -y) mount cleanly on the +y wall but need real rotation for arbitrary
     walls — a bridge gap to close. Next tier: a FUNCTIONAL element wearing a styled
     asset (blast door = `reach-exit` goal) via `body:{type:'asset'}` or baking the
     asset faces at the entity position.
3. **L2 — the level-style vocab card.** A new `world_style` `sketch_vocab` kind
   (retrievable via `semantic_search`), mirroring `wardrobe-construction.md` +
   the `STYLE_VOCAB` row shape (`{name, mood, lighting, lock[], negative[],
   dials{}}`), carrying pairing facts (which material/time/fog combos compose).
4. **L3 — the gated spec tools.** `draft_level_style_spec` /
   `resolve_level_style_spec` / `build_level_style_spec` — a near-copy of
   `figure-specs.js`: Gate 1 reuses `dream-audit.js` verbatim; Gate 2 operator
   approval; build mints the world. Preview = a **multi-frame walkthrough contact
   sheet**, not one still (a level reads in motion).
5. **L4 — thread into game levels.** The dropped `action`-base `style` slot
   becomes a reference to a built level-style; a game level derives its look from
   the style bible. Deliberately LAST — style proven inhabitants-free first.
6. **The `level-from-dream` catalyst** — operating instructions, sibling to
   `character-from-dream.md` / `reconstruct-from-dream.md`.

## Findings from L0 (the gap list that grounds L1)

- **The material shelf reproduces dream surfaces — on the workbench path only.**
  A porthole wore `gunmetal`/`glass`/`neon` and rendered lit. The identical
  vocabulary is NOT reachable from a room/cave shell. → L1 is a *port*, not an
  invention.
- **The verify surface for a level must be the lit `/world`, not the studio
  `/png`.** Translucent `glass` and emissive `neon` do not read in the measured
  studio render (neutral light, form-accuracy); they only read in the lit
  three.js world. The compare step (5) must screenshot `/world`.
- **The image worker natively returns a level-asset trim sheet** (frame 3 of the
  spike self-organized into exploded light-strips / porthole / console / vent) —
  so the "assets" half of the pipeline has a clean dream target, exactly as the
  character loop's wire-sheet came back as cut-and-sew panels.
- **Two composition blockers, both named, both L1:** room palette hardcoded;
  `body:{type:'asset'}` not wired (a dreamed asset can't enter a world yet).
- **Render plumbing works:** local ComfyUI (`local:comfyui@127.0.0.1:8188`) for
  the dream; system Chrome + puppeteer-core (`scene/chromium.js` WebGL args) for
  lit `/world` screenshots. Neither is a blocker.
- **The asset-composition path builds a styled room TODAY** (2026-07-15) — an
  8-piece kit of `create_workbench` assets in one style guide, then composed into
  ONE workbench mega-assembly (`levdream_room_v1`, 43 monomers, open-front
  diorama). It **sidesteps BOTH L1 blockers** (hardcoded shell palette AND
  `body:{type:'asset'}`) because the room is a single recipe, not a shell + placed
  assets. Tradeoff: an orbit object-study, NOT a walkable first-person world.
  This is a viable parallel track to L1 — **L1-alt: compose levels from styled
  asset modules** — and the fastest way to validate a style bible visually.
- **The composed room IS walkable + lit TODAY** (2026-07-15). `?walk=1`
  force-enables the generic WALK camera in ANY world (the room's own faces become
  walk-collidable solids), so `levdream_room_v1/world?walk=1` is a first-person
  WASD level with gravity + walls right now. For proper LIGHTING, re-bake the
  faces with an interior key (`lowerObjectFaces(manifest, makeLight({...ambient
  0.6...}))`) and emit a standalone walkable HTML (`room-v1-walkable.html`) — the
  gunmetal walls read, the emissive accents glow. So the L1-alt path reaches an
  actual lit, walkable first-person level with NO substrate change. The ONE thing
  L1-alt can't do that L1 would: a well-lit SERVED walk room (the served workbench
  route hardcodes the neutral `WORKBENCH_LIGHT` — lighting must come from a
  world-kind that reads manifest lighting, or from L1's styled walk shell).
  Spike: `.../0715/spike-output/level-from-dream/` (kit `asset-*-studio.png`, room
  `room-v1-studio.png` + `room-v1-walk-inside.png`, `room-v1-walkable.html`).

## Open-sky / outdoor register (SPIKED 2026-07-15)

The exterior sibling of the interior shell. Where the dungeon's invariant is
"ceiling + floor," the open-sky level **inverts** it: **ground + sky, no ceiling.**
Explicitly out of `dungeon-designer`'s scope (its plan says "not an open
landscape/sky"), so it's its own register. **Doctrine: compose from mojulo drawing
primitives (the capability set), NOT from `painted-landscape`'s pre-baked
heartbeat/splatch cards** — the same "dream → reconstruct elements from primitives
→ place in world" discipline the interior used. `painted-landscape` is ONE
pre-tuned option, not the only surface the dream can touch.

**The shell = ground (a dream-driven primitive choice) + sky:**
- **Ground:** flat plane · **wave-field** elevation (`sampleWaveField({ waves:[{amplitude,cycles,phase}], displacement, samples }, physics, corners)` — amplitude/cycles are continuous dials the dream reads off the concept art; set `displacement:+z` to lift crests up) · carved platforms (workbench extrudes/carved-solids at heights). Output faces → walkable ground.
- **Sky:** `emitThreeWorld({ sky })` → `skyDomeScript` (sky-css). Presets `day|dusk|dawn|night|midnight` + `sunElev`/`azimuth`/haze/clouds. The "no ceiling."
- **Decoration:** reconstruct the concept's elements as workbench/manji/carved primitives, seat them at sampled terrain heights via `workbenchAssetFaces` → `extraFaces` (the same bridge the dungeon fixtures used).
- **Palette/material:** shade the ground faces with a dreamed height-gradient palette (+ Lambert against a sun dir); the L1 pattern, applied to the ground.
- **Boundaries:** terrain edge drop-off · a `waterMesh` plane · haze horizon · an invisible bound.

**Spike proof (`terrain-spike.html`, `terrain-spike.png`, `terrain-walk-inside.png`):**
a 88×88 wave-field of rolling dusk hills (height-gradient shaded) + 6 stone
boulders (lathe + harmonics, `stone` material) seated on it + a `dusk` sky, all
**walkable first-person** — the player stands on the undulating surface, gravity
follows it. Confirms the register is **compose-not-build**: ground + sky +
decoration + walk are all reachable from existing primitives today.

**Findings:** (a) **terrain-following walk works** — arbitrary ground faces are
walk-collidable, gravity settles on the surface. (b) **The walk spawn `z` MUST
clear the terrain** — the default (world-center height) drops the player THROUGH
the hilltops; pass `spawn:[x,y, heightAt(x,y)+margin]`. (c) Low-poly faceted
terrain reads clean and game-ready.

**Full outdoor dream loop ✅ LANDED (2026-07-16)** — `.../0716/spike-output/
level-from-dream-outdoor/`. Dreamed an alien dusk basin (ComfyUI), read the dials
(warm-amber ground, purple faceted monoliths, dusk sky, central lake), and
reconstructed a **walkable open-sky level** matching the board — all from
primitives: a `heightFn` basin (radial rim −3 centre → +6 rim = natural bound) in
`sampleWaveField`, `water:true` lake quads, purple `stone` monoliths via
`workbenchAssetFaces`, `sky:'dusk'`. Proves the register is compose-not-build AND
that **bounds live in the ground itself** (rising rim + lake, no walls). Polish
open: water alpha/shoreline feathering (blocky where the flat plane meets the
undulating floor), carved-platform ground variant, monolith silhouette variety.

## Doctrine holds (inherited from the dream loop)

- Recipes not renders: the level IS `{register, graph, surfaces, atmosphere,
  lighting}`; walkthroughs/skins are bound derived renders with provenance.
- The dream is discarded on lock; only the `dream_audit` survives.
- Two gates: deterministic (material `validateMaterialRef`, geometry validity)
  vs the operator's eyes (does the walkthrough read as the dreamed level).
- Closed vocabularies only — a shape/material the dials don't reach is a
  **vocabulary gap to NAME, not geometry to invent.**

## Out of scope

- Inhabitants: rules, mechanics, entities, NPCs (the game rules layer —
  event-bus / game-idioms / mechanics; this register is environment-only).
- New shell GEOMETRY beyond the two primitives' existing surface styles (castle
  stonework, groin vaults, non-round chambers live in dungeon-designer.plan.md).
- Free-painted murals / decals / signage (a later skin-over-scaffold step, if at
  all — the character-loop skin move applied to world surfaces).
- Photoreal micro-detail (grime/rust/normal maps) — material finish +
  displacement + baked light is the ceiling.
