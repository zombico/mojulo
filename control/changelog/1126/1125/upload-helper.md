### Bring your own 3D model: a file from this machine read in, a character rigged onto the vajra as a body or a mascot

A model made outside mojulo comes in from a path on the machine mojulo runs on: a folder the person chose in the desktop
app, or a file uploaded into a cloud session. Two doors, one import: `mint_solid({ kind: 'model', spec: { from } })`
for an object, `create_character({ from })` for a character. Mojulo reads the file; it downloads nothing.

- **One door format.** `lib/graph/import/to-glb.js` turns each file into the GLB the bound-mesh slot stores:
  - a GLB or a VRM, checked as it is;
  - a `.gltf` with its `.bin` and images, from a folder or a zip (how Poly Haven and Sketchfab ship);
  - an OBJ with its MTL, colours and textures;
  - an STL or a 3MF, as before.
  - The same file gives the same bytes. What did not travel is named. A neighbour is never read from above the folder
    the model was found in (`read-path.js`), and a URL is refused.
  - A format not read yet (FBX, DAE, USD, .blend, PLY, Draco- or meshopt-compressed glTF) is refused with the line that
    gets it in: export a GLB.
- **What a model holds, read once** (`inspect.js`):
  - its geometry, materials, textures, skins, clips and morphs;
  - a VRM's licence block, and the author and licence a glTF exporter writes;
  - its rest in the native frame, skinned where it is skinned (a Mixamo export's 0.01 armature no longer reads as a
    two-centimetre figure);
  - its units: a figure whose height falls outside 0.3 to 12 m is read in the unit that makes it one, and the readout
    says so.
- **What it is, from its shape, never its size** (`classify.js`). A body is 4.5 heads tall or more. A mascot's head is a
  third of it or more (3.25 heads or less: the mascot law). Between the two it is read as a stylized body, and the
  readout says it could be said otherwise.
  - The legs are followed down from the trunk to where they fork.
  - The neck is the narrow run under the head, above the shoulders.
  - A rigged humanoid's chin is its skeleton's.
  - More than two legs: furniture with no skeleton, a creature with one. No legs: a prop.
- **A character's own skeleton, read wider** (`scene/rig-import.js`):
  - by its shape when its names say nothing: the hips are the joint that sends a mirrored pair of chains down and the
    spine up, the chest the one that sends a pair across (CesiumMan's numbered chains);
  - a palm as the hand on a side with no hand;
  - a rigid part hung under a joint moves with that joint (a robot of parts).
  - `ledger.how` says `file`, `name` or `shape`.
- **Fitted onto the vajra when it has none** (`autorig.js`). The figure's landmarks are fitted from its shape:
  - hips over the crotch, knees, ankles, toes forward along the soles (which also say which way it faces);
  - the chin;
  - each arm traced in from its fingertip.
  - A humanoid skeleton is stood on them, each vertex weighted to the bones of its region by inverse distance and
    smoothed over the mesh's own edges (a mascot's sharper), and the whole is written as a skinned GLB with VRM joint
    names, which rig-import reads like any rigged file.
  - A fit needs a T or an A pose with the legs apart; a figure with its arms at its sides is refused, naming the pose.
- **The machine gate** (`rig-gate.js`). A rig either way is posed through the bends a character makes: arms raised and
  forward, elbows and knees at a right angle, a hip flexed, the head turned, the trunk bent. The readout gives the
  share of triangles torn. It advises and never refuses; the eyes gate is the person's.
- **The `model` kind** (`worlds/model.js`). Its recipe is what the import decided: the file and its hash, the files
  read beside it, its units, its up axis, its height, its class, its rig and its licence. Its geometry is the bound
  file, drawn at rest on the measured studio.
  - A world places an object with `figures.<n>.meshRef` and plays a character with `figures.<n>.modelRef` (the
    character's decided height carried when the world says none).
  - Both work under the Claude plugin profile, since nothing is bound through the hidden handoff tools.
- **Measured against open files.** `lib/graph/import/corpus.js` pins open files by hash: Khronos samples, three.js
  examples, three-vrm and Poly Haven. `node scripts/import-corpus.mjs --fetch` fetches them into a cache on the machine
  (never the repository) and writes `docs/import-corpus.md`.
  - The page shows each file's read, class, rig and gate.
  - Its strip-and-score table takes each artist-rigged humanoid's skeleton away, fits it onto the vajra, and measures
    the fitted joints against the artist's and both rigs through the gate.
- **Around it:**
  - the producer's intake takes a 3D model file (`INTAKE_KINDS.model`);
  - the routing cards are `import-model` and `import-character`;
  - the manual is `get_solid_vocab({ id: 'model' })`;
  - `pack-data` names the sketches whose bound meshes must be carried beside the database.
