### Cloth relief: the realistic wardrobe as PBR material

Operator: "for 7th gen and higher resolution, can we add textures on clothing via parallax? creases on leather, cloth like
PBR for anything that uses that kind of lighting". The realistic hero's clothes carried no surface of their own to an
engine: no UVs (every garment corner on the atlas's one white texel), a colour per face, and one material for the whole
figure (roughness 0.85, no metal), so a leather jacket, a wool suit and a brass buckle shone alike and the creases were
geometry only.

- **The clothes' relief on the lit engine export (realistic laws 13; `epidermis/cloth-relief.js`).** On the lit skinned
  GLB (and so Godot, Unreal, Blender and Unity's glTFast) each garment's tube is unrolled onto a cloth page of the skin's
  atlas, under the strands: around by its rings' own arc from its back (the wrap out of sight), along by its middles'
  path, in metres, so the map's tangent space is the tube's own. A height is baked there and read into the figure's
  normal map beside the head's: creases where the body bends (an elbow's crook, behind the knee, the hip's lap, the
  armpit, the cloth stacked at a wrist and broken at an ankle, each joint creasing only the tubes that cross it), seams
  (a limb's inner seam and a leg's outseam, a trunk's side seams, an outer layer's centre back, placed between slots by
  angle and eased along the tube), hems, leather's wear (short creases everywhere it is worn), the cloth's grain and a
  knit's rib. Every feature is at least a texel and a half wide at the skin's rung (2 mm at L2, 4 at L1, 8 at L0).
- **Each cloth's roughness and metalness** (`CLOTHS`): the cloth the outer names, else read off the outfit's language
  by its layer (a knit top jersey, a woven one cotton, trousers twill, a skirt and a tailored jacket wool), else its
  group's (leather shoes and belts, rubber soles, steel buckles, brass, horn buttons, a silk tie). An ORM map beside the
  normal map, written as the material's `metallicRoughnessTexture` and `occlusionTexture`, its roughness factor so the
  skin's texels are the export's own roughness: leather satin and polished on its crests, wool dull, a buckle metal,
  the creases' valleys occluded. The hard goods too small to chart lie on their cloth's swatch.
- `dermal-hero.js` `heroSkinPaint` takes the chart (`cloth`) and lays the cloth faces' corners on its page (`clothUV`);
  `dermal-relief.js` `heroRelief` bakes the page into the map, the cloth faces' tangents from their own UVs, and returns
  the ORM; the rig pack carries it (`ormTex`); `outfit/expand.js` `outfitLanguage` reads a build's language. The recipe
  is laws 12's: a hero minted before, an unlit export and the World page carry none, byte for byte.
- Unreal: the lit master is `M_MojuloLitCloth`, the relief's master with an `OrmTex` input (its red the ambient
  occlusion, its green times Roughness, its blue times Metal, which is 0 where a figure carries no ORM); a project's
  `M_MojuloLitRelief` from an import before is left as it was. Godot binds the ORM as its glTF import does, said in its
  ledger.
- `/hero-live`: a shot's `relief` sets the normal map's strength on the figure (0 off, more to read it).
- **The clothes in depth: parallax** (operator: "go ahead with the parallax"). The cloth relief's depth map (white the
  surface, black 1 cm under it, every texel no cloth's white so the skin never shifts; in the finest island's texels so
  one metre's UVs march every island) rides the GLB as a texture the figure material's extras name (`mojulo.relief`: its
  index, its depth, the UVs a metre spans across and along the atlas). Godot's kernel (0.31.0) marches it:
  `level.gd` `_fix_parallax` puts `figure_parallax.gdshader` on the figure's material, its textures carried across, the
  map written beside the GLB as `figure_depth.png` and named in `score.figure_parallax` (Godot's own heightmap takes one
  scale for both axes, and the atlas is not square). Unreal's master `M_MojuloLitCloth` marches it in a custom
  `ParallaxUV` node (`HeightTex`, `ParallaxDepth` 0 by default, `ParallaxPerM`), the importer importing the map beside the
  GLB. `/hero-live`'s viewer marches it too (a shot's `parallax` its strength). Advisory where the engines are absent.
- **Knits: a sweater's lines and its yarn** (operator: "sweater lines and yarn"). `cloth: 'knit'`, stockinette: its
  stitches in columns down the garment, each a V of two legs of round yarn with a ply's twist, under the surface so the
  parallax marches into the gaps; `cloth: 'cable'`, ropes of two strands crossing down it between purl channels; a rib's
  purl sunk between its columns. A knit's island is baked at half the page's texel, so a stitch reads at every rung.
- **Patterns** (operator: "use this principle to create wool patterns, herringbone, into coats hats pants, and other
  related things that can be applied patterns to"). `pattern` on the top, the bottom, the outer and the waistcoat (a name,
  or `{ kind, scale, contrast }`): herringbone, houndstooth, plaid, gingham, pinstripe, chalkstripe, corduroy, quilted,
  waffle, tweed. Each its relief (into the normal map and the depth) and its colour, a grey the base colour's cloth page
  multiplies the cloth's own by (a motif darkens its ground; the ground is the palette's); a colour weave made as it is
  woven, warp and weft coloured by their order and the 2/2 twill showing one or the other; a stripe drawn by its share
  of a pixel. The language takes `cloth` on every layer (`CLOTH_WORDS`: the outer's words and twill, jersey, knit,
  cable, silk) and `pattern` (`PATTERN_WORDS`), and refuses an unknown one. Lapels, ties and belts are charted as
  ribbons (their cloth and their pattern, no seams); a waistcoat takes its own words, else the outer's.
- The tube is unrolled from each ring's point facing straight back, in the ring's own plane (a foot's, straight down),
  found between slots, kept continuous down the tube (an opened front passes the back twice), and each slot's share of
  the turn eased along it: the tailor's folds, written into the rings, had slid every slot past them and kinked a stripe
  at each.
- Not yet: a hat (the outfit has no word for one), a garment painted on the skin (`fit: 'skin'`), a second colour in a
  motif (a pattern darkens its ground), the weave finer than a stitch.
