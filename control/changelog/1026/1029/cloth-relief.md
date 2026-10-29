### Cloth relief: the realistic wardrobe as PBR material

Operator: "for 7th gen and higher resolution, can we add textures on clothing via parallax? creases on leather, cloth like
PBR for anything that uses that kind of lighting". The realistic hero's clothes carried no surface of their own to an
engine: no UVs (every garment corner on the atlas's one white texel), a colour per face, and one material for the whole
figure (roughness 0.85, no metal), so a leather jacket, a wool suit and a brass buckle shone alike and the creases were
geometry only.

- **The clothes' relief on the lit engine export (realistic laws 12; `epidermis/cloth-relief.js`).** On the lit skinned
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
  is laws 11's: a hero minted before, an unlit export and the World page carry none, byte for byte.
- Unreal: the lit master is `M_MojuloLitCloth`, the relief's master with an `OrmTex` input (its red the ambient
  occlusion, its green times Roughness, its blue times Metal, which is 0 where a figure carries no ORM); a project's
  `M_MojuloLitRelief` from an import before is left as it was. Godot binds the ORM as its glTF import does, said in its
  ledger.
- `/hero-live`: a shot's `relief` sets the normal map's strength on the figure (0 off, more to read it).
