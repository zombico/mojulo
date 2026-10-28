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
| `body-relational-feet.js` | the feet: `feetFrame` (the ground, the handover level), `feetFields`, `footPart` (the sock, the toes, the ankle's bind) |
| `body-relational-correctives.js` | `correctiveRest`, `shoulderBlend` |
| `body-relational-envelope.js` | the envelope the segment dress is fitted to (each ring over its hull, hollows filled) |
| `body-relational-map.js` | `bodyPartMap`: each skin point's body part (`BODY_PARTS`) and the muscle most under it |
| `body-relational-vec.js` | the vector helpers |

The door: `control/lib/mcp/tools/layered.js` (`realisticRecipe`, `realisticBuild`, `realisticTune`, `realisticErrors`,
`REALISTIC_LAWS_VERSION`). The eyes lane: `/body-study --form norrin|shalla --physique <word|json>`; the door's own hero
with `--hero '{"form":"realistic", …}'`, coloured by body part with `--map`.

## The record

`hero.form: 'realistic'`, `hero.physique: { from?: 'athletic'|'skinny'|'heavyset'|'jacked', bulk?, tone?, weight?,
height?, laws }` (each dial −1 to 1; a word patched in by path reads as `{ from }`). Its head is the relational head unless `head` names another
(`'landmark'`, `'none'`). The build is the cast's pole's
(`cast: 'male'` → norrin, `'female'` → shalla). The plan is laid out with the hero's tune times the build's. Under
realistic laws 9 the man's hip sockets come in with his narrowed frame (`MALE_HIPS`, `withHipSpan` on the rig before the
slice reads it): the build narrows the shoulders, and on the heroic cast's hips every male physique had read a woman's
waist to hip from behind and in profile. The tune's `hips` widens the pelvis's girth only, never the sockets. The
kit and the cloth are made by the rules in [garment-principles.md](garment-principles.md#the-kit-as-pieces-the-cloth-as-it-folds-realistic-laws-8).

## The recipe

- **Re-sampled parts:** `torso`, `neck`, `pelvis`, `upperArmR/L`, `foreArmR/L`, `thighR/L`, `shankR/L`, `footR/L`,
  `toesR/L`. Each is a
  closed part with `slots = ringSlots(N)` (`'front'`, `s01R` … down the right, `'back'`, … `s01L`; N = 48 round the male
  torso, 64 the female, 32 the neck, 24 the arms and the shank (32 under realistic laws 4, as the thigh: the knee's
  ring is shared), 32 the thigh, 72 the foot, 64 the toes) and stations whose `u` keeps the authored
  address: an integer station is `st<k>`, a fractional one `st<a>_st<b>_<mmm>` (`mmm` the fraction in thousandths, three
  digits; the authored plan's own fractional ids are in hundredths, `st1_st2_50`). `slotT` is dropped. The left limb is
  the right's mirror, slot for slot (R ↔ L). The bind's blends are per slot (`<station>.<slot>`).
- **Removed parts:** `pectoralR/L`, `bustR/L` (the field carries their form). Their rig joints and bones stay.
- **The feet:** the foot a sock, its station ids `st0` (a level ring a little over the handover level, `0.25 W` over the
  ankle's joint, inside the shank's skin) … down the ankle, round the heel and on to past the toe base (inside the
  toes), its front slot the leg's front turning to the foot's top; the toes in planes along the toe line from inside
  the foot to the big toe's tip. The soles flat on the authored shoe's lowest point (the ground the gaits plant). The
  foot's points near the shank's skin or over the level carry the shank's own shares, the toe base a hinge band (the
  foot's bone and the toes', no fold). Their `group` is the shoe's (`Shoes`) still.
- **The hinges (realistic laws 4):** the knee and the elbow are stitched. The upper segment's last ring and the lower's
  first are one ring at the joint's plane, the same points, so the two shells are one surface and the shading welds
  across it (`formSlice` `stitch`). Before laws 4 the two overlapped across the plane, the upper's skin tucked inside
  past it.
- **Kept authored:** the head, the hands. Under a physique with bulk the hands and their joints are scaled
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

## The relief (realistic laws 5)

A hero minted under realistic laws 5 carries its head's relief to an engine. The one skin is its field netted and
quadric-simplified; the lit skinned GLB (`export_model { skinned: true, lit: true }`, and the engine packs under their
lit option) bakes the field's own normal into a tangent-space normal map on the skin's atlas (the base colour's UVs) and
writes it as the figure material's `normalTexture`, each vertex's `TANGENT` beside its `NORMAL`
(`epidermis/dermal-relief.js` over `polygonizer/normal-bake.js`). The field is rebuilt from the recipe: the head's own
(`headFit`), joined to the neck's column, whose rings above the seam the fit keeps (`headFit.column`, laws 5 only); each
ear its own. The map's size follows the skin's rung (512 texels across the head's page, 256 at L1, 128 at L0). Only
the head (`headSkin`, `earR`, `earL`) is baked: every other texel is flat, so the body, the hands and what the hero
wears shade by their vertex normals as before. A hero minted under laws 4 or earlier, an unlit export and the World
page carry none (the page's fills are unlit). Godot, Unity's glTFast and Blender read the map as they import the GLB;
the Unreal importer binds it to its lit master (`M_MojuloLitRelief`); a Unity world pack ships figures as rigid parts,
so the map stays behind there and its ledger says so.

## Not yet

The correctives ride the skinned GLB (`scene-gltf.js` `addSkinnedRigFigure`, when the export asks for blend shapes as
it does for the face): one sparse morph target per corrective after the face's, named by its id, its weight baked at
each clip key (`addCorrectiveWeights`), its driver (the joint, the bone, the angles) in `mesh.extras.correctives` for an
engine that would drive it. No engine drives them yet: a pose an engine makes itself (its own animation, IK) gets no
correctives, and Unity, Blender and USD carry no blend shapes of their own (Unity takes the GLB). The skin is a UV-mapped
atlas (`heroSkinPaint`, the body's page over the head's, TEXCOORD_0 under the base colour). It wears its dress (an outfit card, the words, a stylism, the loose words), armour, kits, paint, and
the footwear, handwear and plating libraries (docs/garment-principles.md, docs/plating.md). It carves as a statue (one
material, no skin, the realistic head's own parts going with a lost head, a bust without the arms' stumps). `detail`
is refused: it is the authored body's own clothing, fitted to its rings, and an outfit dresses this body. A panel, a cape and a hood are the authored kernel's, hung
over the tailor's cloth (their `over`). It depicts adults: a child or chibi cast asked of it is that cast's stylized
figure instead, its colours keyed the same.

The relational head (`head: 'relational'`, `hero-relational-head.js`) replaces the landmark head's parts with its own.
Under realistic laws 2 (a hero minted now) it is ONE SKIN (`hero-one-skin.js`): the head's field netted whole
(`skin-net.js`), globes and ears left out, joined to the neck and cut off on the neck's seam ring (every seam point a
point of its rim), simplified with the eyes, the nose and the mouth keeping more of the faces. It is one layer-1 mesh
part, `headSkin`, bound per point: the seam's blend easing up to the jaw's share. The lips are cut exactly on their
line, the upper lip the head's and the lower the jaw's, each turned in along the cut, with a closed `mouth` bag behind
them. Each globe is its own closed part (`globeR`, `globeL`: rings about its gaze, the pupil's and the iris's edges
rings of their own), and the ears are as below. The hair, the brows, the lashes, the beard and the piercings are pinned
to the skin's faces. Under laws 10 the scalp's hair is LOCKS in one colour over a solid shell
(`control/lib/graph/epidermis/hair-locks.js`): the groom's guides gathered and lofted as tapered, grooved tubes, the
face's `stylize` their register. Over the scalp each flow wraps round the head at its own height, the higher-rooted
flows the outer, so they shingle and never stand off as chords. A long lock's points below the head ride the neck and the
torso, and it falls outside the shoulders. The face's hair takes the same register (`lockStrands`): a beard is its coat
sculpted to where its hairs stand, a full beard's chin hangs as flows out of it, and each brow and each half of the
moustache is a band, one mass along it with the dial's strokes on it. Hair clipped under 4 mm (a fade's foot, a stubble)
is the skin's paint, the hair's colour by the share its length covers (`dermal-map.js` `CLIPPER`); where the face grows
a beard, the sideburn holds the beard's length up into the scalp. Under laws 10 the ear sits at the canon, its top at
the brow line and its lobule at the nose's base (`head-relational.js` `EAR_RAISE`). The overlap principle (`hair-score.js` `overlapHair`) holds the scalp hidden except in the splits. Its face rig moves the rest skin's own points per action (`oneSkinFollow`): the muscles' beads
carry the face, and the lids turn about the globe's centre as far as the eye rig's margins moved. Under laws 11 the
lids rest on the globes (`head-relational-eye.js` `SEAT`, the fit's `seat`): within a reach of the margins the skin is
cut back to the lid shell over the globe and rolls out of it into the cheek and up to the crease, so no tunnel stands
between a margin and the eye. Above the crease the fold rises to the brow as a pad, steep out of the crease and near
upright under the brow, so a light from above reaches it; the brow's arc and its ties hang lower; a deep-set eye (its
globe, lids and lashes) comes forward a share of the way toward the nose's tip, short of the glabella; the lower
lashes root on the margin's front, shorter. Everything that rebuilds the head from its fit (the bake, the hair, the
face rig) reads the same seated head. Under laws 1 the head
is in pieces, each sampled from the direction that sees it: `cranium` and `jaw` (rays from one centre inside the head, on the head's
bare field, three head slots to a neck slot, sharing the mouth's ring; the neck ends on their seam ring), let down
under the face; over them `visage` (rings about the mouth cast along the face's look: the lips, the cheeks, the chin,
the brow), `nose` and `eyeR/L` (rings following the nose's outline and each eye's opening: the wings' creases and the
lids' margins run along them; the eyes painted Sclera, Iris, Pupil), each sunk under the next where they hand over (the
eyes over the nose over the visage over the cranium), and `earR/L` (a tube up each ear on the ear's own field). The
rig's `jawHinge` and `jawTip` move to the head's condyles and gnathion. Every head part's stations carry `normals` (each
point's unit gradient of its field at rest), which the shading takes in place of the facets' (`authoredNormals`); the lower face (the jaw part, the visage under
the lips' line) is bound to the jaw. Its face rides an export as morph targets (`relational-face-rig.js`: a blink, one eye's, a smile, a brow raised and
lowered, its inner ends lifted (worried), the eyes wide and squinted, each the head rebuilt at its fit with one of its
own actions; what is pinned to the face carried by the skin under it, the brows' cards whole), weighed by the western
expression channels and their eye looks (`humanoid-head.js` `EYE_LOOKS`); the World page plays no face morphs yet.
In the one skin a lid's weight and turn are smoothed over the skin's own neighbours (`SKIN_FOLLOW.smooth`), so a
blink shuts the lid as one sheet. The lips stretch as the
jaw opens.
