/**
 * The import corpus: open 3D files people actually bring, pinned by hash, each labelled with what it is and what it
 * tests, so the import's reach is MEASURED against real files rather than claimed. scripts/import-corpus.mjs fetches
 * them into a cache on the machine (never into the repository: they are other people's work, under their own terms)
 * and sweeps each through the import; docs/import-corpus.md is the table it writes.
 *
 * One file per distinct procedure, not a catalogue: a naming convention, a unit, a container, a class. A new row is
 * a file that exercises a path no row does yet.
 *
 *   CORPUS   [{ id, source, files: { <name>: { url, sha256 } }, entry, licence, expect: { class, rig }, tests }]
 *     entry    the file the import is pointed at (the others sit beside it)
 *     licence  the terms its source states (`url` where they are written); a row whose terms forbid redistribution is
 *              still fine to test on this machine, and is never committed
 *     expect   class  body | mascot | creature | prop          what it is
 *              rig    name | shape | file | auto | none         how it should come to move: by its joints' names, by its
 *                                                             skeleton's shape, by the file's own humanoid map (VRM),
 *                                                             auto-rigged onto the vajra, or not at all
 *     tests    the procedure it is here for, in a line
 *
 * Fetched with plain HTTPS from hosts a cloud box reaches (raw.githubusercontent.com, dl.polyhaven.org). The sites that
 * turn an automated client away (kenney.nl, poly.pizza, thingiverse.com, 3d.si.edu) are added by hand from a desktop:
 * `scripts/import-corpus.mjs --add <folder>` sweeps a folder of files beside the pinned ones.
 */
const KHRONOS = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models';
const THREE = 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models';
const VRM = 'https://raw.githubusercontent.com/pixiv/three-vrm/dev/packages/three-vrm/examples/models';
const PH = 'https://dl.polyhaven.org/file/ph-assets/Models';
const CC0 = Object.freeze({ name: 'CC0-1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' });
const CCBY = Object.freeze({ name: 'CC-BY-4.0', url: 'https://creativecommons.org/licenses/by/4.0/' });
const MIXAMO = Object.freeze({ name: 'Mixamo terms (Adobe): use in a project, not redistributed as a raw file', url: 'https://www.mixamo.com' });
const kh = (m, f, sha256) => ({ url: `${KHRONOS}/${m}/glTF-Binary/${f}`, sha256 });

const row = (r) => Object.freeze({ ...r, files: Object.freeze(r.files), expect: Object.freeze(r.expect) });

export const CORPUS = Object.freeze([
  // ── rigged humanoids: by name ──
  row({ id: 'soldier', source: 'three.js examples (Mixamo Vanguard)', entry: 'Soldier.glb', files: { 'Soldier.glb': { url: `${THREE}/gltf/Soldier.glb`, sha256: 'dfb230fc1f942f259dd00281a1186953ad602fc5d69067ce63e24b2aa439736b' } }, licence: MIXAMO, expect: { class: 'body', rig: 'name' }, tests: 'mixamorig names, an armature scaled 0.01 and turned a quarter, two skins on one skeleton' }),
  row({ id: 'xbot', source: 'three.js examples (Mixamo X Bot)', entry: 'Xbot.glb', files: { 'Xbot.glb': { url: `${THREE}/gltf/Xbot.glb`, sha256: '002f8d269de68e5dce3d25195caf390d1aa359bbfaae3fcf4c8dc78ec36c3ba5' } }, licence: MIXAMO, expect: { class: 'body', rig: 'name' }, tests: 'mixamorig with fingers and eyes, untextured' }),
  row({ id: 'michelle', source: 'three.js examples (Mixamo Michelle)', entry: 'Michelle.glb', files: { 'Michelle.glb': { url: `${THREE}/gltf/Michelle.glb`, sha256: '7a87e15a99ccbc5e5877be66e1e4ecae0a581adcafa0cce1a5569f49909e968e' } }, licence: MIXAMO, expect: { class: 'body', rig: 'name' }, tests: 'a woman, PBR extensions (ior, specular) that do not travel' }),
  // ── rigged humanoids: by the file's own map ──
  row({ id: 'vrm1', source: 'pixiv three-vrm examples', entry: 'VRM1_Constraint_Twist_Sample.vrm', files: { 'VRM1_Constraint_Twist_Sample.vrm': { url: `${VRM}/VRM1_Constraint_Twist_Sample.vrm`, sha256: '12c2b97e95e700783a6a550dc0eee2d7880aeedccef9ae67bc4c5a2f0f2631a2' } }, licence: Object.freeze({ name: 'stated in the file (VRMC_vrm.meta)', url: 'https://github.com/pixiv/three-vrm' }), expect: { class: 'body', rig: 'file' }, tests: 'VRM 1.0: the humanoid map and licence in the file, secondary and twist bones, 57 morphs' }),
  // ── rigged humanoids: names fail, the shape reads ──
  row({ id: 'cesium-man', source: 'Khronos glTF sample assets', entry: 'CesiumMan.glb', files: { 'CesiumMan.glb': kh('CesiumMan', 'CesiumMan.glb', 'b7001eaeea8254bd44773bcd247e78696d94169388fbb2a1800fc69434e777d9') }, licence: CCBY, expect: { class: 'body', rig: 'shape' }, tests: 'numbered joint chains (leg_joint_L_1..5): no humanoid word but a side' }),
  row({ id: 'rigged-figure', source: 'Khronos glTF sample assets', entry: 'RiggedFigure.glb', files: { 'RiggedFigure.glb': kh('RiggedFigure', 'RiggedFigure.glb', 'd6be85417d3e256861ee733eea6916093a7af7c79c16366181fd8abcaeb38cf5') }, licence: CCBY, expect: { class: 'body', rig: 'shape' }, tests: 'the same numbered chains on a 256-triangle figure' }),
  row({ id: 'robot-expressive', source: 'three.js examples (Quaternius, Tomás Laulhé)', entry: 'RobotExpressive.glb', files: { 'RobotExpressive.glb': { url: `${THREE}/gltf/RobotExpressive/RobotExpressive.glb`, sha256: '047f5e5fb3bb6d378bd1df16ca6137f2a596c99b3a1b5690b4020c05aaf6f319' } }, licence: CC0, expect: { class: 'mascot', rig: 'name' }, tests: 'a big-headed mascot: hands named Palm (no wrist joint), an armature scaled 100, 14 clips, 3 face morphs' }),
  // ── rigged, not a humanoid ──
  row({ id: 'fox', source: 'Khronos glTF sample assets', entry: 'Fox.glb', files: { 'Fox.glb': kh('Fox', 'Fox.glb', 'd97044e701822bac5a62696459b27d7b375aada5de8574ed4362edbba94771f7') }, licence: Object.freeze({ name: 'CC0-1.0 (model, PixelMannen) + CC-BY-4.0 (rig, tomkranis)', url: `${KHRONOS}/Fox/README.md` }), expect: { class: 'creature', rig: 'none' }, tests: 'a quadruped in centimetres with its own clips: placed, never a pilot' }),
  row({ id: 'brain-stem', source: 'Khronos glTF sample assets', entry: 'BrainStem.glb', files: { 'BrainStem.glb': kh('BrainStem', 'BrainStem.glb', 'ddda3a53b5c9771f992463034a430340ba2bac571e5869c723f7cba4976e9174') }, licence: Object.freeze({ name: 'Poser EULA (Smith Micro)', url: `${KHRONOS}/BrainStem/README.md` }), expect: { class: 'body', rig: 'auto' }, tests: 'a robot biped of 59 rigid parts on unnamed joints whose arms do not mirror: re-rigged onto the vajra' }),
  // ── unrigged figures: auto-rigged onto the vajra ──
  row({ id: 'male02', source: 'three.js examples (Reallusion iClone via 3D Warehouse)', entry: 'male02.obj', files: { 'male02.obj': { url: `${THREE}/obj/male02/male02.obj`, sha256: '6e521dceb9cf5b0d9b375c607364f23c7a9db7d56a135f2a74c2da698b7671b3' }, 'male02.mtl': { url: `${THREE}/obj/male02/male02.mtl`, sha256: 'a1d2f6df681197208221b74e6c32d74207a38fb84119ed55452998ed24b0e8ce' }, '01_-_Default1noCulling.JPG': { url: `${THREE}/obj/male02/01_-_Default1noCulling.JPG`, sha256: '3259a89133a08c2063a565b3eaaa442ba9b9521117ffdddc88d4ae7079b05803' }, 'male-02-1noCulling.JPG': { url: `${THREE}/obj/male02/male-02-1noCulling.JPG`, sha256: '672bbeb356bbe8a1e30790412573e6794fd2adf69ebc38bbdf090ab811141ab3' }, 'orig_02_-_Defaul1noCulling.JPG': { url: `${THREE}/obj/male02/orig_02_-_Defaul1noCulling.JPG`, sha256: '303095f93c5f72c65a744e4ab47fe967332a69ea4b4206b8cefcae13cf5a2291' } }, licence: Object.freeze({ name: 'unclear (3D Warehouse terms): test on this machine only', url: `${THREE}/obj/male02/readme.txt` }), expect: { class: 'body', rig: 'auto' }, tests: 'an OBJ man in centimetres with an MTL and three JPEGs, no skeleton' }),
  // ── props: never rigged ──
  row({ id: 'duck', source: 'Khronos glTF sample assets', entry: 'Duck.glb', files: { 'Duck.glb': kh('Duck', 'Duck.glb', '65bf938f54d6073e619e76e007820bbf980cdc3dc0daec0d94830ffc4ae54ab5') }, licence: Object.freeze({ name: 'SCEA Shared Source License 1.0', url: `${KHRONOS}/Duck/README.md` }), expect: { class: 'prop', rig: 'none' }, tests: 'a textured toy with no skeleton' }),
  row({ id: 'damaged-helmet', source: 'Khronos glTF sample assets', entry: 'DamagedHelmet.glb', files: { 'DamagedHelmet.glb': kh('DamagedHelmet', 'DamagedHelmet.glb', 'a1e3b04de97b11de564ce6e53b95f02954a297f0008183ac63a4f5974f6b32d8') }, licence: Object.freeze({ name: 'CC-BY-NC-4.0 (model) + CC-BY-4.0 (conversion)', url: `${KHRONOS}/DamagedHelmet/README.md` }), expect: { class: 'prop', rig: 'none' }, tests: 'five PBR maps, only the albedo travels' }),
  row({ id: 'toy-car', source: 'Khronos glTF sample assets', entry: 'ToyCar.glb', files: { 'ToyCar.glb': kh('ToyCar', 'ToyCar.glb', '01a60862de55cd4b9f3acfab0b0def86451800f9c42467fcd61052c16cb9838c') }, licence: CC0, expect: { class: 'prop', rig: 'none' }, tests: 'a car seven centimetres long, clearcoat, sheen and transmission' }),
  row({ id: 'wooden-stool', source: 'Poly Haven (Kuutti Siitonen)', entry: 'wooden_stool_01_1k.gltf', files: { 'wooden_stool_01_1k.gltf': { url: `${PH}/gltf/1k/wooden_stool_01/wooden_stool_01_1k.gltf`, sha256: 'f28566454af27175839c10645a37a2a16b373e4be8aecddd0d8a3d704cfc0330' }, 'wooden_stool_01.bin': { url: `${PH}/gltf/1k/wooden_stool_01/wooden_stool_01.bin`, sha256: 'a9b21b8c75719057db549dfee5b8c1cc76edc2727367790fb9fc49963e34ae7a' }, 'textures/wooden_stool_01_diff_1k.jpg': { url: `${PH}/jpg/1k/wooden_stool_01/wooden_stool_01_diff_1k.jpg`, sha256: 'cb5c7ec2e27f5ad2ced7791da5e2cc9f1d03ab2c6ffbb63df8256dc271869206' }, 'textures/wooden_stool_01_nor_gl_1k.jpg': { url: `${PH}/jpg/1k/wooden_stool_01/wooden_stool_01_nor_gl_1k.jpg`, sha256: '10b587d76b74e752f15d03d2c4725cddb439b174dcddae2444e1534de61d77dc' }, 'textures/wooden_stool_01_rough_1k.jpg': { url: `${PH}/jpg/1k/wooden_stool_01/wooden_stool_01_rough_1k.jpg`, sha256: '23b43e05961731de864e4902a14c614b33d804fd91821c284fa90a8d2ca23fe1' } }, licence: CC0, expect: { class: 'prop', rig: 'none' }, tests: 'a .gltf with its .bin and JPEGs in a textures folder (how Poly Haven ships)' }),
  row({ id: 'slotted-disk', source: 'three.js examples', entry: 'slotted_disk.stl', files: { 'slotted_disk.stl': { url: `${THREE}/stl/ascii/slotted_disk.stl`, sha256: '5c0d95ca55352ccf5cca12197a5f9fa17eb2e905d1bb3a45c8ba51c9a22699a4' } }, licence: Object.freeze({ name: 'three.js examples (MIT repository)', url: 'https://github.com/mrdoob/three.js' }), expect: { class: 'prop', rig: 'none' }, tests: 'an ASCII STL' }),
  // ── refused, with the line that gets them in ──
  row({ id: 'samba-fbx', source: 'three.js examples (Mixamo)', entry: 'Samba Dancing.fbx', files: { 'Samba Dancing.fbx': { url: `${THREE}/fbx/Samba%20Dancing.fbx`, sha256: 'b9003ee562c87bf03051c3a502411b0808d3513f1d74a2011f7530d9f067069f' } }, licence: MIXAMO, expect: { class: 'body', rig: 'refused' }, tests: 'FBX: refused, naming the GLB export' }),
]);

export const CORPUS_CLASSES = Object.freeze(['body', 'mascot', 'creature', 'prop']);
