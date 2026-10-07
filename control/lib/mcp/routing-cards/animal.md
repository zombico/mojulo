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
→ `mint_solid({ kind: 'animal', spec })`. Two doors: `species` (a built real animal, by id or the name people say — 'cat', 'grizzly'; the roster is `get_solid_vocab({ id: 'animals' })`, each species' card `animal/<id>`) or `archetype` (a bare body: rodent / canine / feline / stumpy / equine / gazelle / sauropod / theropod / raptor / avian / ursine / raccoon). A named real animal wants `species`; an unnamed shape wants `archetype`. Manual: `get_solid_vocab({ id: 'animal' })`. A species tunes in place with `update_sketch` on `/plan/...`; an archetype takes `opts` and `view`. Never re-mint to change a knob. For an INVENTED creature (a dragon, a monster, a body to rig and animate) use `kind:'layered'` (card `creature`) instead. Print lane: a species is watertight; a bare archetype is render-only (advisory, never a refusal). Full family → `get_creative_toolset({ form: 'illustration' })`.
