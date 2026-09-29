# Vegetation: grown trees, palms and bamboo, and how to render many of them

Code: [control/lib/graph/vegetation/](../control/lib/graph/vegetation/). This page covers the science the code rests
on, the rendering rules it follows, and the known limits. Read it before changing a preset or a level of detail: most
numbers below were checked against the literature, and several first guesses turned out wrong.

## The chain, cell wall to canopy

1. **Lignin locks the helix.** Cellulose microfibrils wind round each cell at the microfibril angle (MFA). Lignin
   stiffens the matrix in shear, so the wall acts as a rod rather than a spring. The lock matters more the steeper the
   helix. `mechanics.js`: `wallModulus`, `twistCoupling`, `tissueModulus`. Wood E_L lands at 8–16 GPa at MFA 10° and
   density 500.
2. **A stem is a column.** Greenhill's self-buckling constant is computed from the first zero of J₋₁/₃ (qL³/EI =
   7.8373), not quoted (`greenhillConstant`). Stems vary along their height, so `palm.js` `ritzBuckling` solves
   Rayleigh–Ritz for E(z), ρ(z) and a crown load; it reproduces Greenhill for a uniform column.
3. **A branch is a cantilever, and one number sets its droop:** B = wL³/EI (`bendingNumber`, `elastica`). Holding B
   fixed across sizes is elastic similarity (L ∝ d^(2/3)). That is why an old tree is not a large twig: the leaf is
   the ruler, and the silhouette only looks similar (box dimension 1.51–1.60).
4. **Lignin and cambium are two dials, not one.** Lignin is how locked the wall is; the cambium is whether the stem
   thickens. Monocots (palms, bamboo, grasses) have lignin and no cambium. `grow.js` keeps them separate.
5. **Growth** (`grow.js`):
   - Light comes from a voxel shadow grid, and resources are shared by Borchert–Honda allocation (Palubicki et al.
     2009).
   - Architecture is Hallé–Oldeman's table of choices; the presets are Rauh, Massart, Troll, Leeuwenberg and Corner.
   - A species may keep its leaves longer than its architecture does (`leafLife`, in years). The evergreen
     `schefflera`, the umbrella tree of tropical mountains, keeps three years' leaves on Leeuwenberg's crown.
   - Wood follows the pipe model plus Pressler (ring area ∝ foliage above), so Leonardo's rule and taper are
     emergent.
   - Each year's extra load bends each internode, and reaction wood (∝ Δα·Δr/r², Fournier) pulls it back where there
     is wood to do it.
   - `stand` (0 by default, open-grown) grows the plant among neighbours like itself. Their crowns shade everything
     below the stand's top, which is in full sun, by Beer–Lambert through their leaf area. The low branches starve and
     are shed, so the crown lifts and narrows: a massart fir's crown starts at 0.16 of its height open-grown and 0.75
     in a stand at 0.5.
     - **Known limit:** the stand also cuts the foliage 10–20×, so stand-grown crowns read airier still.
6. **Wood is a field.** Formation time t(p) is the minimum over internodes of the first year whose radius reaches p.
   Rings, knots and board figures are its level sets (`wood.js`). Past a pixel, grain fades to its mean colour.
7. **Bark is fracture** (`bark.js`). A brittle skin on a growing cylinder takes hoop strain only:
   - dilatation keeps up with a share of it, fissures open to take the rest, and plates wider than k·(thickness)
     crack down the middle;
   - cracks run along the stem, leaning at the spiral-grain angle;
   - `persist` sheds old bark, or old cracks lean far more than the grain.

   The tile is doubly periodic, so it tiles.

## Palms: lignification without a cambium (`palm.js`)

- **No cambium, so no thickening.** Establishment growth sets the girth at the base first; after that the diameter is
  fixed and there are no rings.
- **Sustained lignification (Rich 1987) makes the trunk a stack by age.** Each internode keeps stiffening for decades,
  so a palm raises its ceiling by stiffening, not thickening.
  - Coconut periphery: 5.3 GPa at the top → 8.6 GPa at the base, green (González & Nguyen 2016).
  - Loads use wet density; young tissue is 90–95% water.
  - Result: E frozen at the young value buckles at 18 m; sustained, 27 m.
  - **Known limit:** real coconuts reach 35–40 m at 80 years, so the model is about 25% short. A stiff outer shell
    adds about 11–13% (two-zone section at the same mass), so it closes about half of that.
- **No reaction wood.** A leaning trunk keeps its lean and only the apex turns up, which is the curved coconut trunk.
  Coconut trunks carry some compression growth stress at the bend (Huang et al. 2002), but the mature trunk does not
  straighten.
- **The crown is a cohort.** Insertion angle by frond age, and an elastica rachis.
  - Coconut divergence is about 141° (140–144°), not the golden angle.
  - Handedness is 50:50 and not heritable (Davis 1963).
- **The trunk surface is the phyllotaxis.** Parastichies come in consecutive Fibonacci numbers (coconut 3/5, date and
  W. robusta 5/8), and they mirror with the hand.
- **Palm wood is bundle dots, not rings**, darker outward and downward.
- **Pool palms by age, not scale:** girth never changes, so a young palm is not a small old one.
- **A tree fern is Corner's model too.** `treefern` (Cyathea) grows as a palm:
  - a thin fibrous trunk that climbs about 14 cm a year;
  - arching pinnate fronds;
  - old stipe bases kept on the trunk;
  - dead fronds fall. A hanging skirt of fronds that wide reads as a palm's.

## Figs: what a fig adds is below its crown (`ficus.js`)

- **The crown is the engine's.** An evergreen Rauh or Troll row with a fig's leaf (F. benjamina is Troll's model,
  F. aurea Rauh's; the genus has no single model). No new growth code grows it.
- **Aerial roots are an opt-in step of the engine** (`arch.aerial` in `grow.js`). They drop from limbs within 30° of
  horizontal and hang as plumb lines 4–10 mm across. Landed, a root is a guy-cable first (it makes tension wood;
  Zimmermann, Wardrop & Tomlinson 1968) and then a pillar. The pillar joins the two sums the engine already keeps:
  - Pressler's: it takes `share` of the pipes of the foliage beyond its limb, so it thickens and the first trunk thins
    among the pillars;
  - the bending moment's: it carries `carry` of the load beyond it, so the limb behind it stops bending.
  In 20–30 grown years the props do not widen the crown. A fig's spread takes centuries of reiteration; the Great
  Banyan covers 1.89 ha on 3,772 pillars. A spreading crown comes from the architecture row, not the props.
- **The strangler's lattice** is roots grafted where they cross (inosculation) round a host that dies and rots (Putz &
  Holbrook 1989). It is drawn as two families of helices of opposite hand over a dark core, from the ground to the
  crown base. The crown is emergent on a clear bole, which a stand lifts (`stand`).
- **Buttresses** are plank fins giving about 60% of a shallow-rooted tree's anchorage. They work in tension windward
  and in compression leeward, and the biggest faces away from the crown's lean (Crook, Ennos & Banks 1997).
- **Economy by the tree's own rulers.** The fig parts cost under 2% of a banyan's crown at every level:
  - a hanging root is one straight segment, cut by the ladder's diameter rule like a twig;
  - past the cut, a curtain of hanging roots is one dark ribbon per foliage cell (Beer–Lambert, as leaves become
    blobs);
  - the lattice and the fins are drawn only at the near levels, and far off the column is a cylinder.
- **Species:** `banyan` (Ficus benghalensis), `strangler` (F. aurea) and `rubberfig` (F. elastica), all in beech's
  smooth grey bark. Large figs stand about one a hectare in lowland rainforest, so a terrain world's fig rows are
  sparse.

## Grass: the tuft as a primitive (`grass.js`)

- **A grass branches only at its base.** A tuft is tillers from one crown:
  - basal blades, each an elastica strip whose bending number sets how far it arches;
  - flowering culms standing above the blades, headed by a panicle, a plume, a spike or feathered awns.

  A kind (`GRASSES`) is a row of numbers over that one builder: blade count, length, width, stiffness, splay, culms,
  head, colours and a dry share. The reed tuft is the same idea from the culm builder. `over` retunes a kind in a recipe.
- **Habit is bamboo's split carried down**, as an analogy: a tussock (intravaginal tillers, packed) or a sward
  (rhizomes or stolons, spreading).
- **The leaf is the ruler, at its extreme.** A blade is 2–25 mm wide and falls below a pixel a few metres off, so the
  ladder is short:
  - L2 every blade;
  - L1 a third of them, wider;
  - L0 seven strips;
  - LF three triangles.

  Past the grass radius the ground's colour is the meadow.
- **A tuft is lit as one volume.** Normals are bent out from its heart and up (Fox Engine's rotated normals, Ghost of
  Tsushima's clump normals), and the base is darker, all baked into its vertex colours.
- **Placement is the trees' read the other way round** (`terrain/grass-kernel.js`):
  - grass stands on open ground and thins under the painter's wood; tree cover of LAI 1 halves grass cover (Pilon et
    al. 2021);
  - it comes in patches, and in clumps that share a height dome, a lean and a shade;
  - tussocks lean out of their knots.
- **Kinds by climate.** Tall C4 grass is placed up to about 2,700 m on a tropical mountain; on Mt Kenya the C3/C4
  crossover is at 2,800–3,200 m (Tieszen et al. 1979). Tussock grass goes toward and above the treeline.
- **The far field keeps its illusion by thinning, not detail** (`scene/channels/terrain-grass.js`):
  - thinning by size bands: a tuft's `near` grows with its height;
  - past `near`, a stable rank against (near/d)² decides which tufts stand, so a patch of screen holds about the same
    tufts;
  - survivors widen by up to 1.8×, grow and shrink over the last quarter of their threshold, and are drawn toward the
    ground's colour with distance.

  This is what MGSV's size-keyed bands and Ghost of Tsushima's far tiles (the same blade count over a larger area) do.
- **Known limits:**
  - no wind yet (a vertex sway within a near active distance would be the next opt-in);
  - no interaction;
  - a big plume (pampas) close up reads as paper, not feathers;
  - exports carry no grass.

## Bamboo: the stack as a lathe (`bamboo.js`)

- **The culm is a profile r(s) swept round a spine.** There is no bark, no rings and no spiral grain.
  - The spine is the large-deflection cantilever, relaxed under culm, branch and leaf weight.
  - An upright Moso barely bends, while Bambusa vulgaris grown leaning droops. That matches Flora of China
    ("apically drooping"); no source describes a nodding mature Moso tip.
- **Why no visible chirality.** It is not the wall: the normalized extension–twist coupling peaks near MFA 10°, and
  bamboo sits there. A tree's hand shows through spiral grain, which builds up over the cambium's layers, and through
  bark cracks opened by radial growth. A culm has neither.
- **Elongation (Chen et al. 2022).**
  - The shoot carries its nodes and diameter when it emerges (Wei et al. 2017).
  - More than 40 internodes elongate at once, each over 3–4 weeks (slow, then a burst of about 6 days), lower ones
    first. Peak 114.5 cm/day; full height in about 40 days.
  - The model reads a supply bell through a beta-shaped window per internode, and lays down wall volume, so length =
    V/(D·t).
  - With the node interval set to reproduce the peak, it predicts 35 days to 95% height.
  - **Known limit:** a constant-speed wave has 33 internodes elongating at the peak, not more than 40.
- **Form (Moso).** About 50 internodes; the longest is #18 at 35 ± 10 cm; the base ones are about 3 cm. Wall t/D is
  U-shaped: a thick butt, about 0.085 mid-culm, about 0.15 at the tip. H ∝ D^0.629 (Inoue 2013).
  - Use a taper with a finite tip. D ∝ (1−x)^p blows the last internode up under volume conservation.
- **Wall.**
  - Graded outer to inner: 25.6 vs 3.8 GPa (Jiang et al. 2024), fibre fraction 0.6 vs 0.1. That gives about 6% more
    EI than a uniform wall.
  - Hollow vs a solid rod of the same mass: the tube stands about 1.7× taller.
  - Moso's buckling safety factor is about 2.7. No published value exists; an estimate is 1.5–2.5.
- **Maturation is the palm's opposite.** Outer fibres finish by about 6 months (Huang et al. 2012), while dry density
  goes 0.26 → 0.63 g/cm³ over three years (Uchida et al. 2022).
  - The safety factor is lowest just after elongation (about 1.9) and about 2.7 by one year, then flat.
  - A palm's stack gains safety with age; a culm mostly gains weight.
- **Nodes.**
  - They add no measurable bending stiffness (Taylor et al. 2015). They are ring stiffeners (Schulgasser & Witztum
    1992), and sheaths brace the growing culm.
  - At Moso's mid-culm wall ratio the Brazier ovalization moment sits at the fibre-failure moment: 1.1× with hoop/axial
    stiffness 0.07, 0.94× at 0.05. So nodes matter at the margin.
- **Colour by age** (foresters' 'du' classes, Xu et al. 2022): year 1 emerald with a white wax ring below each node;
  years 2–3 light green; years 4–5 greenish-yellow with darkening nodes; then greyish-white. Leaves are kept two years
  at a time, so odd-aged culms yellow in spring (Mei et al. 2020).
- **Groves.**
  - Moso: 1,200–2,000 culms/ha intensively managed, about 4,000 managed, about 7,200 in Taiwan, about 11,000
    unmanaged. Rhizomes extend 1.27 ± 0.90 m/yr (Kawai et al. 2008).
  - Clumping B. vulgaris: 50–90 culms per clump, about 7 m across after 10 years (PROSEA).
- **Reed** (Phragmites) is the same builder at a hundredth of the mass: a leaf per node, blades turned downwind, a
  plume.

## Rendering rules

- **A species is a pool.** K grown variants × four levels of detail, placed through `repeats` (one template, N
  transforms). Never N meshes.
- **No yaw on instances.** Light is baked into the faces, so a rotated instance would carry its lit side with it.
  Variety comes from variants baked at their own yaw. A lean is a variant grown leaning that way; so is a lathe, even
  though its geometry is symmetric.
- **The level of detail is the pipe model.** An axis is drawn only while its diameter covers a pixel.
  - Foliage past the leaf size is a turbid medium: coverage-preserving Beer–Lambert clusters, shrunk by cover^0.35.
  - Pick the level per placement from the size it projects to, from the nearest of a scene's bookmarks, not only the
    first one.
  - Then spend a draw budget (`plantRepeats({ budget })`): the placements seen largest step up a level first, until the
    budget or the cap. A scene of a few dozen trees gets the cap everywhere. A forest keeps the ladder.
- **Split what has different rulers.** A bamboo culm picks its level by its diameter in pixels, its foliage by the
  leaf's length in pixels, as two templates.
  - The culm's node stack costs rings: 4 a node for the ridge, 2 for a colour band, drawn only where a band spans at
    least 3 px, and none past that.
  - Do not instance one internode: 50× the instances, a non-uniform scale and a full rotation the World transform
    lacks, and the same triangles drawn.
- **Tint what only changes colour.** A culm's age is a per-instance tint, so the pool is by size and lean only.
  - A tint multiplies, so it cannot turn white wax into a dark node: first-year culms get their own template.
- **Mid-distance bamboo foliage is one card per branch.** Blobs there read as pom-poms along the culm. The card's
  width is shrunk by Beer–Lambert coverage, and each card rolls and droops on its own.
- **Trunks wear their surface as a texture, in the near levels only** (`tiles.js`).
  - A tree's axes thicker than 6 cm are bark quads in L3 and L2, carrying the species' fracture tile (`barkTile`: one
    per bark preset, 0.6 m square, periodic, so it runs up and round with no seam). The tile's metres are the bark's
    metres. Far levels keep plain tubes, where a tile would shimmer.
  - A palm's trunk is not a repeating surface (a date palm keeps its leaf bases only near the crown), so each grown
    palm gets its own texture unrolled over its whole trunk (`palmTrunkTexture`), mapped once (v = s / length).
  - A textured face carries `fill` white-lit (the World page multiplies the texel by it) and `plainFill`, the tile's
    mean colour lit. The World page draws textured template faces as instanced meshes of their own. Exports cannot
    texture an instance yet, so glTF, USD and the print shells draw those faces in `plainFill`
    (`face-mesh.js plainFaces`).
  - Not yet: the culm's node tile on instances (v = node count), which would drop the near level from about 98 rings
    to 11.
- **Bamboo stands as a grove** (`groveItems`). Where a scene puts one bamboo, a clumping bamboo grows one clump
  (`clumpGrove`: tens of culms, the outer ones leaning out) and a running bamboo grows a patch (`runningGrove`, about
  6,500 culms/ha). Both are grown in metres and laid into the scene's units by the item's height. Each culm stands on
  the ground where it lands, and none in the water.
  - A clumping bamboo's pool adds culms grown leaning 14° and 24° at six azimuths. A culm picks the variant nearest its
    lean and way; a lean is a variant, never a yaw.
- **Tree crowns are the weak part.** Broadleaf and fir crowns are young and airy, and at L2/L1 their foliage is
  clusters that read as popcorn close up.
  - Spray cards (the bamboo finding, carried over) read as leaves close up but airier than the clusters at 50–60 m, and
    a fir's flat sprays go edge-on. They were tried and not adopted.
  - Fuller, older crowns are the open problem. Palms and bamboo do not have it: their foliage keeps its true shape at
    every level.

## References

- Rich 1987 (Bot. Gaz. 148:42; Am. J. Bot. 74:792).
- González & Nguyen 2016 (Front. Plant Sci. 7:1141).
- Killmann & Fink 1996.
- Fathi 2014.
- Davis 1962, 1963.
- Huang et al. 2002 (Tree Physiol. 22:261).
- Niklas 1994 (Am. J. Bot. 81:345), 1998 (Ann. Bot. 81:23).
- Palubicki et al. 2009.
- Hallé, Oldeman & Tomlinson 1978.
- Fournier et al. 2006.
- Hutchinson & Suo 1992; Bai, Pollard & Gao 2000.
- Säll 2002.
- Chen et al. 2022 (Plant Cell 34:3577).
- Inoue 2013 (J. For. Res. 24:525); Inoue et al. 2012, 2017, 2021.
- Wei et al. 2017 (New Phytol. 214:81).
- Uchida et al. 2022 (Front. For. Glob. Change 5:868732).
- Huang et al. 2012.
- Jiang et al. 2024 (Materials 17:2069).
- Amada et al. 1997 (Compos. B 28:13); Sato et al. 2017 (PLoS ONE 12:e0175029).
- Taylor et al. 2015 (Wood Sci. Technol. 49:345).
- Schulgasser & Witztum 1992 (J. Theor. Biol. 155:497).
- Kanahama & Sato 2023 (Sci. Rep. 13:18158).
- Xu et al. 2022 (Remote Sens. 14:2550).
- Mei et al. 2020 (Front. Plant Sci. 11:550).
- Kawai et al. 2008 (J. Jpn. For. Soc. 90:151).
- PROSEA (Dransfield & Widjaja 1995).
- Flora of China vol. 22.
- Zimmermann, Wardrop & Tomlinson 1968 (Wood Sci. Technol. 2:95); Mackinnon et al. 2019 (PLoS ONE 14:e0226845).
- Putz & Holbrook 1986, 1989; Ludwig et al. 2019 (Sci. Rep. 9:12459).
- Crook, Ennos & Banks 1997 (J. Exp. Bot. 48:1703).
- Tieszen et al. 1979 (Oecologia 37:337); Pilon et al. 2021 (J. Veg. Sci.); Wohllaib 2021 (GDC, "Procedural Grass in
  Ghost of Tsushima"); the Fox Engine's grass and brush classes (FoxTool, the MGSV Modding Wiki).
