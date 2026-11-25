---
{
  "id": "model",
  "name": "A model made elsewhere (bring your own file)",
  "family": "object",
  "entry": "mint_solid",
  "summary": "Bring in a 3D model mojulo did not make, from a file on this machine: a GLB, a VRM, a .gltf with its folder, an OBJ with its MTL, an STL, a 3MF, or a zip of one. It is read into one GLB, measured (its units, its height, what it is), and kept as a `model` row a world places and a game plays. An object comes in through mint_solid({ kind: 'model' }); a character through create_character({ from }), rigged onto the vajra as a body or a mascot.",
  "when": "Reach for this on 'use my own model / import this glb, obj, gltf, vrm, stl / I downloaded a model from Kenney, Quaternius, Poly Haven, Sketchfab, Mixamo, VRoid / put this asset in my game / rig this character / make this character playable / bring in my avatar'. A model to MAKE is every other kind; one already made is this."
}
---

A model made OUTSIDE mojulo, brought in from a file on THIS machine. In the desktop app it is a file in a folder the person chose; in a cloud session, a file they uploaded into it. Mojulo reads the path; it downloads nothing (a URL is refused: fetch the file onto the machine first, then give its path). A file pasted into a chat that only the chat holds is not on the machine: save it to a folder first.

## Two doors, one import

- **An object** (a prop, scenery, a thing to print): `mint_solid({ kind: 'model', spec: { from } })`. Placed as it stands, never rigged.
- **A character** (a person, a mascot): `create_character({ from })`. Rigged onto mojulo's skeleton, the vajra, so it plays the clip library's states in a game and exports skinned.

```
mint_solid({ kind: 'model', spec: { from, units?, up?, entry?, licence? }, title?, ref?, folder_ref? })
create_character({ from, as?: 'hero' | 'mascot', height?, units?, up?, entry?, rig?: 'auto', licence?, title?, ref?, folder_ref? })
```

- `from` (required): the file's path, or the folder holding it. Read: `.glb`, `.vrm`, `.gltf` (with its `.bin` and images beside it, or the folder), `.obj` (with its `.mtl` and textures beside it), `.stl`, `.3mf`, or a `.zip` of one. Its neighbours are read from beside it, never from above its folder.
- `entry`: in a zip or a folder holding several models, the one meant (the refusal lists them).
- `units`: the unit the file's numbers are in (`mm | cm | m | in | ft`). glTF says metres; an OBJ, an STL and a 3MF say nothing. Absent, a character whose height falls outside a figure's 0.3 to 12 m is read in the unit that makes it one, and the readout says so.
- `up`: the axis the file stands on when it is not its format's own (glTF and OBJ stand on y, STL and 3MF on z). A model lying on its back was written standing on z.
- `height` (a character): the metres it stands, over its own reading.
- `as` (a character): `'hero'` (a person's body) or `'mascot'` (head-heavy, cartoony), over what its proportions say.
- `rig: 'auto'` (a character): fit it onto the vajra even when its own skeleton reads (a broken rig made over).
- `licence`: the terms it came under, a word (`'CC0-1.0'`) or `{ name, url?, author? }`. A VRM's own licence block, and the author and licence a glTF exporter writes, are read from the file; a stated one lays over them. The licence travels with the row.

Not read, each refused with the line that gets it in: FBX, COLLADA (.dae), USD, .blend, PLY, 3DS (export a GLB from the tool that made it: Blender imports them all), Draco- or meshopt-compressed glTF (export without compression), a STEP or other CAD solid (export an STL or a 3MF).

## What a character becomes

What it IS is read from its shape, never its size: a mascot four metres tall is still a mascot.

- **A body**: a person's proportions, 4.5 heads tall or more. Rigged on the hero's bones.
- **A mascot**: its head a third of its height or more (3.25 heads or less). Rigged on the same bones, bending stiffer at its joints, like a toy. A mascot's size sets its capsule, camera and stride when it plays.
- Between 3.25 and 4.5 heads (a child, a chibi hero): a body, said in the readout; say `as` if it is the other.
- **A creature** (more than two legs, or a skeleton that is not a humanoid's) and **a prop** (no legs) are not characters: they come in as objects.

How it comes to move, in order:

1. **Its own skeleton, read as a humanoid**: by the file's own humanoid map (a VRM), by its joints' names (Mixamo, Unreal, Rigify, 3ds Max Biped, VRM names), or by its skeleton's shape when the names say nothing (numbered chains, no names at all). Its own weights are kept. A robot of rigid parts hung on its bones is read too.
2. **Fitted onto the vajra** when it has no skeleton that reads. Its landmarks are fitted from its shape (the hips over the crotch, the knees, the ankles, the toes forward along the soles; the chin where the neck pinches; each arm traced in from its fingertip), a humanoid skeleton is stood on them, and every vertex is weighted to the bones near it. A fit needs the figure **standing in a T or an A pose, its legs apart and its arms held away from its sides**; a figure with its arms at its sides, or in a robe, is refused, naming what a fit needs.

The readout's `gate` is the machine gate: the rig posed through the bends a character makes (arms raised and forward, elbows and knees at a right angle, a hip flexed, the head turned, the trunk bent) and the share of its triangles torn. It advises and never refuses. Whether it looks right moving is the eyes gate: the person's, never claimed.

## Using it

- In a world, an object stands as scenery: `figures: { stool: { meshRef: '<ref>', transform: { pos: [x, y, 0], rotZ?, scale? } } }`.
- A character plays as a body: `figures: { hero: { modelRef: '<ref>', height? } }`, the hero entity's body `{ type: 'figure-rig', figure: 'hero' }`. Its states are the clip library's, retargeted (its own clips in the file are not played yet).
- `export_model({ ref })` exports it (a character skinned, on the vajra's bones).

Returns `{ ok, ref, url, worldUrl, sceneUrl, import, next }`. `import` is the recipe as decided: the file, its format and hash, the files read beside it, its units (and how they were read), the axis it stands on, its height, what it is and why, how it moves, the gate, its licence, and `warnings` (what did not travel, a licence that limits use, a reading the agent should confirm).

Where the import's reach is measured against real open files (Khronos, three.js, three-vrm, Poly Haven): `docs/import-corpus.md`, written by `node scripts/import-corpus.mjs` in a source checkout.
