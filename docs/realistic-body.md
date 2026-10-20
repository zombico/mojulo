# The realistic body: the sliced recipe's contract

The hero door's `form: 'realistic'` re-samples the hero's body onto the FORM FIELD (bone and muscle masses placed from
the rig's joints, summed into one skin) once its plan is a recipe. This page is what the slice produces, so work on
the export, the head, the skin or the dress can be written against it without reading the slice. The contract tests
are in `control/lib/graph/polygonizer/hero-realistic.test.js`; the slice's own in `body-relational.test.js`.

## Where it lives

| Module (`control/lib/graph/polygonizer/`) | What it holds |
|---|---|
| `body-relational.js` | `formSlice(recipe, R, build)`, the orchestration; re-exports the rest |
| `body-relational-builds.js` | `BODY_BUILDS` (norrin, shalla: data), `PHYSIQUES`, `PHYSIQUE_DIALS`, `physique()` |
| `body-relational-field.js` | the distances (`sdEgg`, `sdCone`, `lse`), `bodyFrame`, `bodyField`, `limbField`, `crossing`, `project` |
| `body-relational-resample.js` | `resamplePart`, `ringSlots`, the bind's share mixing, `mirrorPart` |
| `body-relational-correctives.js` | `correctiveRest`, `shoulderBlend` |
| `body-relational-envelope.js` | the envelope the segment dress is fitted to (each ring over its hull, hollows filled) |
| `body-relational-map.js` | `bodyPartMap`: each skin point's body part (`BODY_PARTS`) and the muscle most under it |
| `body-relational-vec.js` | the vector helpers |

The door: `control/lib/mcp/tools/layered.js` (`realisticRecipe`, `realisticBuild`, `realisticTune`, `realisticErrors`,
`REALISTIC_LAWS_VERSION`). The eyes lane: `/body-study --form norrin|shalla --physique <word|json>`; the door's own hero
with `--hero '{"form":"realistic", …}'`, coloured by body part with `--map`.

## The record

`hero.form: 'realistic'`, `hero.physique: { from?: 'athletic'|'skinny'|'heavyset'|'jacked', bulk?, tone?, weight?,
height?, laws }` (each dial −1 to 1; a word patched in by path reads as `{ from }`). The build is the cast's pole's
(`cast: 'male'` → norrin, `'female'` → shalla). The plan is laid out with the hero's tune times the build's.

## The recipe

- **Re-sampled parts:** `torso`, `neck`, `pelvis`, `upperArmR/L`, `foreArmR/L`, `thighR/L`, `shankR/L`. Each is a
  closed part with `slots = ringSlots(N)` (`'front'`, `s01R` … down the right, `'back'`, … `s01L`; N = 48 round the male
  torso, 64 the female, 32 the neck, 24 the arms and the shank, 32 the thigh) and stations whose `u` keeps the authored
  address: an integer station is `st<k>`, a fractional one `st<a>_st<b>_<mmm>` (`mmm` the fraction in thousandths, three
  digits; the authored plan's own fractional ids are in hundredths, `st1_st2_50`). `slotT` is dropped. The left limb is
  the right's mirror, slot for slot (R ↔ L). The bind's blends are per slot (`<station>.<slot>`).
- **Removed parts:** `pectoralR/L`, `bustR/L` (the field carries their form). Their rig joints and bones stay.
- **Kept authored:** the head, the hands, the feet. Under a physique with bulk the hands and their joints are scaled
  about the wrist (`build.hands`).
- **Rig additions:** joints `scapulaAcr<S>`, `scapulaSup<S>`, `scapulaInf<S>`, bone `scapula<S>`; the folds
  `shoulderFold<S>`, `kneeCrease<S>`, `elbowCrease<S>` with their bones; `foreArm<S>` gains `parent: 'upperArm<S>'`.
  At most four influences a vertex, as everywhere.
- **Dials:** the authored dials' station blends extended to the new stations by `u`.

## The correctives

`recipe.correctives`: a list of `{ id, driver: { joint, to, from, full }, d }`.

- `d` maps a point id (`<part>/<station>.<slot>`, the compiled mesh's `pointIds`) to an offset `[dx, dy, dz]` in metres
  at REST, at full weight.
- The weight is a smoothstep of the driver bone's raise (`joint` → `to`, the angle from the trunk's down, `navel` from
  `neckHub`) between `from` and `full` degrees.
- They are summed onto the rest before skinning: `correctiveRest(mesh, recipe, nodes)`. That is an engine's morph
  target (a blend shape) driven by the raise.
- Today, per side: `pauldronBag`, `pauldronCap`, `pauldronDeltoid` (torso and upper arm), `shoulderLevel`,
  `shoulderOverhead` (torso).

## Not yet

Posing outside the body study and the stretch audit does not apply the correctives, and no exporter carries them. The
dress, armour, kits, paint and details are refused on the realistic body. The relational head is not in the door. The
body has no UVs.
