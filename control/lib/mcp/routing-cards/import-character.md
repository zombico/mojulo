---
{
  "id": "import-character",
  "name": "Make a character made elsewhere playable (a rigged or unrigged model file onto the vajra)",
  "summary": "A character's GLB, VRM, glTF folder, OBJ or zip from a path on this machine, rigged onto mojulo's skeleton (its own by name or shape, else fitted from its shape) as a body or a mascot by its proportions, gated, and played in a game.",
  "when": "\"make my VRoid avatar playable\", \"rig this obj character\", \"here is a Mixamo character, can it be my hero\", \"use this Quaternius guy as the player\", \"auto-rig my model\"",
  "entry": "create_character",
  "form": "character"
}
---
→ `create_character({ from: '<path>', as?: 'hero' | 'mascot', height?, units?, up?, rig?: 'auto', licence? })`. What it is comes from its proportions, never its size (a head a third of it or more: a mascot). It moves by its own skeleton (a VRM's map, Mixamo or Unreal names, or the shape of a numbered one), else it is fitted onto the vajra: a fit needs a T or an A pose, legs apart. The readout's gate is the machine gate; the eyes gate is the person's. Play it with `figures: { hero: { modelRef: '<ref>' } }`. `from` is a file ON THIS MACHINE (a URL is refused). A character from a PICTURE is `reference_protocol`. Manual: `get_solid_vocab({ id: 'model' })`. Full family → `get_creative_toolset({ form: 'character' })`.
