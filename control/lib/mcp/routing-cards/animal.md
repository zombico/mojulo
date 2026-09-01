---
{
  "id": "animal",
  "name": "Build an animal (a wolf, a horse, a deer — four-legged or bipedal)",
  "summary": "A real animal with a real skeleton's proportions — the figure system's animal realm: the human protoform's armature with the spine reoriented horizontal, minted as a bare archetype body or a dressed species recipe.",
  "when": "\"a wolf\", \"a horse\", \"make me a dog\", \"a deer with antlers\", \"a lion / a fox / a bear / a rhino\", \"an animal I can 3D print\", \"a four-legged creature\", \"a quadruped standing in profile\", \"a T. rex\", \"a dinosaur\", \"a bird\", \"show me a cat from the side\", \"a horse's head close up\"",
  "entry": "mint_solid",
  "form": "illustration"
}
---
→ `mint_solid({ kind: 'animal', spec })`. Two doors, both taking `opts` on top: `species` (a dressed recipe — wolf / fox / camel / kangaroo / redPanda / deer / buck / gazelle / lion / cougar / hippo / rhino / horse / ram / bull / wombat — on the welded single-skin hero path) or `archetype` (a bare body: rodent / canine / feline / stumpy / equine / gazelle / sauropod / theropod / raptor / avian / ursine / raccoon). A named real animal wants `species`; an unnamed shape wants `archetype`. Read the manual first via `get_solid_vocab({ id: 'animal' })` — archetype table + knob families (armatureCfg / skullCfg / footCfg / coat / face / tail). `view` frames it (`lateral` reads the silhouette truest; `crop:'head'` is a face study). Iterate the stored recipe in place via `update_sketch`, never by re-minting. For an INVENTED, non-anatomical creature use `kind:'manji-tree'` instead. Print lane: the mesh is render-only, so an STL closure audit flags it — advisory, never a refusal. Full family → `get_creative_toolset({ form: 'illustration' })`.
