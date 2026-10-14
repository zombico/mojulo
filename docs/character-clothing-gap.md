# Character clothing: the gap to Genshin / BotW

An analysis of how `create_character` dresses a hero today, measured on the minted rings, against the
practice behind Genshin Impact, Breath of the Wild and VTuber avatars. It answers four questions: why
clothing bulks up, why the waist goes boxy, why trousers read as baggy, and whether the svgile-row tailor
can take skintight measurements. The research sources are listed at the end. Claims that are industry
practice without a primary source are marked as such.

Gate: machine only. The numbers below are measured from the recipe rings. No one has looked at a render
for this note, so the eyes gate has not run.

## 1. Two tailors on two bodies

There are two clothing systems, and each one dresses a different body.

| | svgile-row (`figure-garments.js`, `body-chart.js`, `pattern-garment.js`, `pattern-slopers.js`) | hero outfit (`outfit/expand.js` → `body-garment.js`, `body-paint.js`, `hero-flow.js`) |
|---|---|---|
| Body | the protoform ring-stack figure (`mint_solid` kind `figure`, the vexar renderer) | the station-loft hero (`create_character` as `hero`, the anime head included) |
| Measures | yes: `body-chart.js` charts every region and reports girths in cm; slopers are drafted from them | none: ease is metres along the ring's radial, with no girth anywhere |
| Cut and sew | yes: flat pieces in cm, seams, strain and seam-ease report | no |
| Hanging sheets | `wave-drape` capes, cloaks and tabards (`drapeSheet`) | the skirt hull and the coat skirt |
| Motion | `cloth-flow.js`, a phase-driven wave (spike) | `hero-flow.js` control strings, Verlet and deterministic (the VRM spring-bone analogue) |

**Answer to "can we pass skintight measurements to the svgile-row tailor?"** It already measures. The
gap is that it measures the wrong body: nothing a `create_character` hero wears goes through it. The
hero's rings carry everything a chart needs, since every L1 part is stations × slots, which is a tube
chart's rows. The spike below computed hero girths from them in about twenty lines. So the port runs the
other way: give the hero a `body-chart` reader over its L1 parts, then let hero garments be specified by
**girth targets per landmark**. Negative ease would give compression.

## 2. What the hero's tailor does, measured

The spike minted three heroes and compared each garment ring with the body ring it was copied from: an
anime female in `casual`, the same with `fit: 'fitted'` on top and bottom, and an anime male in
`adventurer`. Girths are ring perimeters. Stand-off is how far the cloth sits out from the skin.

**The waist (torso st1, the narrowest torso ring):**

| outfit | body girth | cloth girth | added |
|---|---|---|---|
| female `casual` | 61 cm | 85 cm | **+23 cm** |
| female `casual`, `fit: 'fitted'` | 61 cm | 73 cm | +11 cm |
| male `adventurer` | 81 cm | 118 cm | **+37 cm** |
| male `adventurer` hip, topTail over bottomSeat | 84 cm | 126 cm | **+42 cm** |

(The body girth at the torso ring excludes the navel and chest layers lying over it, so a few cm of the
added girth is real clearance. The rest is not.)

For scale, a real fitted tee carries about 5–10 cm of ease at the waist, and an anime design usually shows
the waist at body girth.

**The leg (`casual` trousers, anime female):** the stand-off is a constant 11 mm from hip to knee,
growing to 16 mm at the ankle (law 2's hang). The boot shaft then sits another 28 mm over that.

| ring | body | cloth | cloth/body |
|---|---|---|---|
| thigh st0 | 49.2 | 56.0 | 1.14 |
| knee (thigh st4) | 26.1 | 32.9 | 1.26 |
| calf (shank st1) | 29.0 | 37.8 | 1.30 |
| above ankle | 20.8 | 30.6 | **1.47** |

Body ankle/calf taper is 0.72. Cloth ankle/calf taper is 0.81. With the boot shaft (45.8 → 38.3 cm) the
taper goes almost straight.

## 3. Root causes, by symptom

### Bulk, and "no mugen 0 on clothing"
- **The constant-offset rule removes definition.** `body-garment.js` carries every ring point out by the
  same `ease` in metres. A constant offset adds a constant girth (2π·ease ≈ 7 cm at 11 mm), which is
  14% on a thigh, 26% on a knee and 47% at the ankle. Definition is the contrast between thick and thin
  (calf against ankle, thigh against knee, ribs against waist), and a constant offset flattens exactly that
  contrast. This is the "baggy gen-z pants" read, and it happens even at 1 cm of ease.
- **Law 2 (cloth falls away toward a free hem)** adds flare at every hem by default
  (`outfitProportion.hang`). That is right for realism and wrong for the anime and Genshin silhouette, which
  tapers to the hem unless a piece is *designed* to flare.
- **Skintight exists, but the agent cannot see it.** `language.top/bottom.fit: 'skin' | 'fitted' | 'eased'
  | 'loose'` (`styles.js`, `expand.js` 2b) and the `paint` words (`leggings`, `tights`, `catsuit`,
  `longSleeve` …) give a zero-thickness second skin. But:
  - the `layered` card's OUTFIT BUILD section lists `top { family, sleeve, hem, collar }, bottom { family, leg }`
    with no `fit`, `outer` or `dress`;
  - the `hero` routing card's dress line offers only `detail: 'clothed'` and `adorn: 'ranger'`, not
    `outfit` or `paint`.

  So the agent reaches for `detail: 'clothed'`, which *adds* volume. `clothedBody` puts +12 mm on the
  seat, +7 mm on the quadriceps, +8 mm on the calf and +8 mm on the chest, and adds quilting and knee
  patches. That gives "definition" by adding mass, which is the opposite of how the target styles get it.
- **Coarse rings.** In the `round` register the shank, upper arm and forearm are `limb6`, six points
  per ring and about three stations per bone, and the garment copies that density. Under a toon shader
  the outline draws the silhouette's polygon, so a six-sided trouser leg reads as a box. The stitcher
  does not need a new algorithm to round out a form. It needs more samples on the cloth than the body
  supplies: resample each garment ring to at least 16 points with a periodic spline, and keep stations
  about 5–8 cm apart.

### The boxy waist
1. **The top's drape.** A top falls from the bust and may come back in only `drape` (≈ 0.23) per metre
   of fall (`expand.js`: `0.35 / law.hang`). From bust to waist is about 15 cm, so the cloth can come in
   about 3.5 cm, less than the bust's projection. The waist ring is held out at the bust's radius, and
   the torso becomes a cylinder from bust to hip. Only `fit: 'eased'` (×4) or `'fitted'` (no drape) brings
   it in, and neither is in the manual.
2. **The hull lift dilates along the stack.** The lift over the layers beneath is a max over a five-point
   neighbourhood (j±1 along the stack), then a mean. That is a morphological dilation, and it fills
   concavities, so the waist (a concavity along the body's length) takes the lift of the rings either
   side of it.
3. **The layers stack at the waist.** Four layers meet there: `bottomSeat` (+11 mm), then `topTail` over it
   (+35–69 mm with tuck and flare), then the belt band over both, then the buckle. Each layer's ease is
   added to the hull of all the layers beneath it. The tailor puts every edge (waistband, hem, belt,
   focal) at the waist because principles law 5/6 spend the ornament budget there.

### Baggy legs
This comes from the constant offset plus law 2's flare plus the boot shaft over the trouser, as measured
above. There is no rule that preserves taper.

## 4. What the reference practice says, and what is missing

Each principle carries a source tag: **[spec]** means the primary document was read; **[snippet]** means
the source was seen only in search results (most hosts were unreachable from the research box);
**[practice]** means no primary developer source was found. **miHoYo has published nothing we could
find on Genshin outfit layering**, so the three-layer model below is a strong convention consistent with
the sourced VRoid and VRM practice. It is not a documented miHoYo rule.

1. **Tight clothing is the body, re-coloured.** VRoid's inner tops, bottoms, socks and bodysuits are
   layers painted on the body's skin texture. Only outer garments carry their own geometry
   [snippet: VRoid creator docs on BOOTH and itch.io]. mojulo has this (`paint`, `fit: 'skin'`), but it is
   not the default and the agent never sees it.
2. **The body is masked under loose cloth instead of being wrapped by it.** VRoid's Skin Mask hides the
   body under a garment, so nothing pokes through and no thickness doubles up [snippet]. mojulo stacks
   hulls over hulls instead, which is the waist's +23–42 cm.
3. **Garments live in the body's bone frames, and dressing tightens them.** VRoid 2.0 fits clothes by
   bone adjustment, and creators shrink the waist bones when dressing [snippet]. The hero's ring copy
   already does the first half; the second half (pulling in to the body at the waist) is missing.
4. **The drape is a separate chain of spring bones colliding with body capsules.** The VRMC_springBone
   spec covers "hair and costumes": per-joint stiffness, gravity and drag, with sphere and capsule
   colliders on body nodes [spec]. `hero-flow.js` is already this, with rigidity words and capsules.
   It is used for skirts and hair only.
5. **The silhouette comes from a few deliberate pieces, and the body line stays tight.** In BotW, art
   director Takizawa described a style that "makes it easy to lie" while keeping a feeling of reality, and
   Link's hat was cut for not reading well [snippet: GDC 2017 coverage]. Putting the silhouette in
   panels, coattails, capes and sleeves is [practice] (Genshin fan rips show skirt bones and coattail
   bones, but those are not developer statements).
6. **Taper survives, the waist is marked rather than padded, and a belt is a thin band on the body's
   waist** [practice].
7. **Lines are authored data.** Arc System Works uses an inverted hull with per-vertex width and colour,
   and lines can be switched off [snippet: ASW Academy slides; Motomura, GDC 2015]. UTS2 has a line-width
   map, and MToon has a width-mask texture [spec]. Hems and seams on a second skin can be painted lines.
   They need no geometric step. You have already observed that thin, palette-tinted lines work.
8. **Shadow is designed, not simulated.** UTS2 has shade steps, a fixed-shadow position map, and a
   shading-grade map that makes shadow fall along folds [spec]. MToon has a shading shift [spec]. Honkai 3rd
   uses ramp maps and vertex-colour face masks [snippet: He Jia, Unite 2017]. Genshin faces use a
   threshold or SDF face-shadow map [community recreations]. So folds and muscle on a tight layer can
   be a shadow-bias channel instead of added volume, which is the reverse of `detail: 'clothed'`.
9. **Faces are shaded from a smoothed proxy's normals.** Guilty Gear Xrd edited normals for clean light
   and shadow shapes [snippet]. An SDF kernel can shade from a blurred field's gradient.

## 5. Recommendation: three garment layers on rings

Keep the ring paradigm: garments as rings around the body's stations, skinned station by station, are
already the right base. Change three things and add one.

**L0, second skin (default for anything "fitted").** Paint on the body's faces, with zero thickness. Make
the outfit build's knit pieces, leggings, tights, stockings, gloves and the bodice default to it in the
anime register. Surface `fit` in the card and the routing card. A belt over a second skin already seats
on the body (`expand.js` `seat`). Make that the norm: a belt's mugen is 0 and it lies on the body's
waist ring, never on the hull of a tail.

**L1, shaped shell (a girth-targeted tailor).** Replace the scalar `ease` with an **ease profile in
girth terms**, read from a hero body chart:
- `ease` as a *share of the girth* (proportional), so taper ratios survive. Optionally pin the girth at
  named landmarks (`waist: 0`, `knee: +2cm`, `ankle: 0`), with negative values for compression.
- Make law 2 opt-in per piece (`hang`), off by default in the anime register.
- Make the drape a waist-seeking curve. Cloth falls from the bust, then returns to the waist girth the
  piece names, instead of the monotone `drape` that never comes back in.
- Make the hull lift dilate around the ring only, never along the stack.
- Resample the cloth to at least 16 points per ring (a periodic spline over the body's slots), with
  stations about every 6 cm. This is what will round out the stitcher's forms.

**L2, drape panels (the Genshin silhouette layer).** Open single-sided sheets hung from a ring on the
body (the waist, the shoulders, a cuff), on `hero-flow` curtains: coattails, tassets, skirt fans,
capes, sleeve flaps, sashes and ribbons. `drapeSheet` (wave-field.js) is the form-agnostic kernel. It
already dresses the protoform and needs a hero anchor. The skirt hull stays for skirts. Panels give the
"drape and flow" without inflating the body's tubes.

**A machine gate for the dressed silhouette (new).** `hero-style-critic.js` measures the bare body only.
Add silhouette measures of the dressed figure:
- waist-over-hip and waist-over-chest girth ratios;
- knee-over-thigh and ankle-over-calf taper ratios;
- the cloth's girth gain at each landmark.

Read them against anime and western bands, as advice. It would have flagged every number in section 2.

**Small, card-only fixes that help today, with no kernel change:**
- add `fit`, `outer` and `dress` to the `layered` card's OUTFIT BUILD section;
- add `paint` and `outfit` to the `hero` routing card's dress line;
- say there that "fitted" or "tight" means `paint` or `fit: 'skin'`, and that `detail: 'clothed'`
  adds bulk.

Kernel changes (proportional ease, waist-seeking drape, resampling) move the bytes of already-minted
outfits. They go under a new `OUTFIT_LAWS_VERSION`, with `expandOutfit` keeping v1 for rows minted under it.

## 6. Sources

- VRMC_springBone 1.0 spec: https://github.com/vrm-c/vrm-specification/blob/master/specification/VRMC_springBone-1.0/README.md
- VRMC_materials_mtoon 1.0 spec: https://github.com/vrm-c/vrm-specification/blob/master/specification/VRMC_materials_mtoon-1.0/README.md
- UnityChan Toon Shader 2 manual: https://github.com/unity3d-jp/UnityChanToonShaderVer2_Project/blob/release/legacy/2.0/Manual/UTS2_Manual_en.md
- Junya Motomura, "GuiltyGearXrd's Art Style: The X Factor Between 2D and 3D", GDC 2015: https://gdcvault.com/play/1022031/GuiltyGearXrd-s-Art-Style-The
- ASW Academy, "Guilty Gear Toon Line Control Techniques": https://docswell.com/s/ASW_Academy/5LVY67-GG-Toonline-Eng
- VRoid Studio v2.0.0 dress-up and bone adjustment: https://vroid.com/en/news/26gn98sTuPJQ53LxDQRyFg
- VRoid layered skin textures, creator docs: https://booth.pm/en/items/5054073, https://kitekki.itch.io/vroid-coral-fish-swimwear
- He Jia, Honkai Impact 3rd toon rendering, Unite 2017 (transcript): https://www.gameres.com/807345.html
- Cai Haoyu, "Genshin Impact: Crafting an Anime Style Open World", GDC 2021: https://www.gdconf.com/news/learn-about-making-genshin-impacts-open-world-gdc-2021
- Satoru Takizawa, BotW art direction, GDC 2017 coverage: https://www.thumbsticks.com/gdc17-designing-zelda-breath-of-the-wild/
- Genshin-style face shadow, community recreation: https://github.com/NoiRC256/URPSimpleGenshinShaders

Only the GitHub-hosted specs and READMEs were read in full. The rest were seen through search results;
read the Xrd handout and the He Jia transcripts before relying on their details.
