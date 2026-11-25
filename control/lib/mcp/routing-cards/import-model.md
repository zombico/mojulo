---
{
  "id": "import-model",
  "name": "Bring in a 3D object made elsewhere (a prop or scenery, from a file)",
  "summary": "A GLB, glTF folder, OBJ, STL, 3MF or a zip of one, read from a path on this machine into one model a world places, prints and exports, its units and licence said.",
  "when": "\"use this glb I downloaded\", \"import my own model\", \"I got some free assets from kenney / poly haven, put them in my level\", \"bring this stl in\", \"here is a gltf folder of a chair\"",
  "entry": "mint_solid",
  "form": "object"
}
---
→ `mint_solid({ kind: 'model', spec: { from: '<path>', units?, up?, entry?, licence? } })`: the file made one GLB and kept as a `model` row; place it with `figures: { <n>: { meshRef: '<ref>', transform } }`. `from` is a file or folder ON THIS MACHINE: a URL is refused (download it there first); a file only the chat holds is saved to a folder first. FBX, DAE, USD, .blend and PLY are refused with the line that gets them in (export a GLB). Say its licence. A CHARACTER from a file is card `import-character`. Manual: `get_solid_vocab({ id: 'model' })`. Full family → `get_creative_toolset({ form: 'object' })`.
