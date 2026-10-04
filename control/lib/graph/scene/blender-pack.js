/**
 * blender-pack.js — the Blender DESTINATION pack assembler (export-blender.plan.md rev 3,
 * B0). Front doors: scripts/export-blender.mjs (CLI, + the machine gate) and, at B5,
 * `export_model({ target: 'blender' })`.
 *
 * One realizer: resolveWorldScene → facesToGlb — the same seam every export shares
 * (D1: the default base is `lit: true` over the UNSHADED payload; `unlit` and `shaded`
 * are the taste dials). The pack GLB is the object's printable set (water, shadow / ink
 * decals and studio furniture stay out — an art pass surfaces the object, not mojulo's
 * runtime fakery; the ledger counts what stayed home).
 *
 * pack.json is the slim manifest the two Blender scripts and the gate read: ref, manifest
 * hash, units + meters_per_unit, the node inventory (glbNodeInventory — what mojulo
 * DECLARED, in z-up world bounds), the collections map (node → part), the frame landmark.
 * NOT score.json: no mechanics, no runtime — no fields without a consumer.
 *
 * Written IN PLACE (overwrite, never rm -rf): the operator's `<ref>.blend`, their
 * `return-<n>.glb` and the gate stamp live beside the pack and survive a re-mint.
 * Deterministic: same rows + same options → same pack bytes; no clock, no dice.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { facesToGlb } from '@/lib/graph/scene/scene-gltf';
import { isPrintableFace } from '@/lib/graph/scene/scene-stl';
import { resolvePosture } from './engine-score.js';
import { glbNodeInventory, pickLandmark } from './blender-gate.js';
import { emitBlenderPack, BLENDER_LEG_VERSION } from './blender-project.js';
import { metersPerUnitFor, unitsLabel } from './world-units.js';
import { fireShot, fireShotTime, fireShotFaces, fireAirFor, fireWorldFor } from '../fire/fire-shot.js';

export const BLENDER_BASES = ['lit', 'unlit', 'shaded'];

const hashOf = (m) => createHash('sha256').update(JSON.stringify(m)).digest('hex').slice(0, 16);
const r4 = (v) => Math.round(v * 10000) / 10000;

// Declared-unit label → metres per unit: ONE table, world-units.js (world-contract-tiers D1).
// Re-exported so the pack's callers keep their import.
export { metersPerUnitFor };

function refuse(sketch, ref) {
  const manifest = sketch?.manifest ?? {};
  if (manifest.engine === 'pixelizer' || manifest.kind === 'pixelizer') {
    throw new Error(`refused: '${ref}' is a pixelizer game — a 2D reducer has no mesh realization (export-blender.plan.md)`);
  }
  return manifest;
}

// Faces that are NOT the object: water, shadow / ink decals, studio furniture. Counted, not hidden.
function splitPrintable(faces) {
  const dropped = { water: 0, shadow: 0, ink: 0, studio: 0 };
  const kept = [];
  for (const f of Array.isArray(faces) ? faces : []) {
    if (isPrintableFace(f)) { kept.push(f); continue; }
    if (f?.water) dropped.water++;
    else if (f?.decal === 'shadow') dropped.shadow++;
    else if (f?.decal === 'ink') dropped.ink++;
    else if (f?.studio) dropped.studio++;
  }
  return { kept, dropped, droppedTotal: dropped.water + dropped.shadow + dropped.ink + dropped.studio };
}

// node → collection: a node named after a face group is that part; a `<group>:<key>` split
// node (texture / pbr) joins its group; anything else (repeats) is its own part.
function collectionsFor(inventory, groups) {
  const out = {};
  const sorted = [...groups].sort((a, b) => b.length - a.length); // longest prefix wins
  for (const n of inventory.nodes) {
    const base = n.name.replace(/\.\d{3}$/, '');
    const coll = groups.has(base) ? base : (sorted.find((g) => base.startsWith(`${g}:`)) ?? base);
    (out[coll] ??= []).push(n.name);
  }
  return Object.fromEntries(Object.keys(out).sort().map((k) => [k, out[k]]));
}

// The world's fire at one instant (fire/fire-shot.js), as the pack's `fire/` folder: fire.json (lights, props, embers,
// cameras, and each volume's box) beside one binary per volume — its glowing voxels' x-major indices (uint32 LE) then
// their values (float32 LE: rgb for a flame, density for smoke). import_mojulo.py writes them to OpenVDB. The fires
// are read as the live page reads them (an unshaded resolve keeps none: a dungeon's torches stand on its walls only
// when it is lit), at `fireT` seconds, else at the time the fire reads best.
async function packFire({ sketch, manifest, payload, shaded, fireT, fireDetail, outDir, writeOut }) {
  let live = payload;
  if (!shaded) ({ payload: live } = await resolveWorldScene(sketch, {}));
  if (!live || !live.fire) return null;
  const { air, wind } = fireAirFor(manifest, live);
  const world = live.fire.spread ? fireWorldFor(live) : null;
  const t = Number.isFinite(fireT) ? fireT : fireShotTime(live.fire);
  const cameras = (Array.isArray(live.cameras) ? live.cameras : []).filter((c) => c && c.worldFraming && Array.isArray(c.worldFraming.cameraPosition))
    .map((c) => ({ name: c.name || 'camera', at: c.worldFraming.cameraPosition, look: c.worldFraming.lookAt, fov: c.worldFraming.horizontalFov || 70 }));
  const shot = fireShot(live.fire, t, { air, wind, world, detail: Number.isFinite(fireDetail) && fireDetail > 0 ? fireDetail : 1, cameras });
  await fs.mkdir(path.join(outDir, 'fire'), { recursive: true });
  let n = 0, voxels = 0;
  const bin = async (g, comps) => {
    const file = `fire/g${String(n++).padStart(3, '0')}.bin`, k = g.idx.length, buf = Buffer.alloc(4 * k * (1 + comps));
    for (let i = 0; i < k; i++) buf.writeUInt32LE(g.idx[i], 4 * i);
    for (let i = 0; i < k * comps; i++) buf.writeFloatLE(g.val[i], 4 * k + 4 * i);
    await writeOut(file, buf); voxels += k;
    const { idx, val, ...box } = g; return { ...box, file, n: k };
  };
  const fires = [];
  for (const f of shot.fires) {
    const flames = []; for (const g of f.flames) flames.push(await bin(g, 3));
    fires.push({ ...f, flames, smoke: f.smoke && f.smoke.idx.length ? await bin(f.smoke, 1) : null });
  }
  const src = live.fire.sources.concat(Array.from({ length: Math.max(0, fires.length - live.fire.sources.length) }, () => null));
  const out = { t: shot.t, fires: fires.map((f, i) => ({ ...f, L: src[i] ? src[i].L : null, D: src[i] ? src[i].D : null })), embers: shot.embers, prop_colors: shot.prop_colors, cameras: shot.cameras, day: live.fire.day || 0 };
  // the solid parts (props, coals, embers) are geometry: mojulo's, as a GLB beside the model's
  const solid = facesToGlb({ faces: fireShotFaces(shot) }, { generator: `mojulo ${sketch.ref || ''} (blender pack, fire)`, lit: true });
  if (solid) await writeOut('fire/props.glb', solid.bytes);
  await writeOut('fire/fire.json', `${JSON.stringify({ ...out, props_glb: solid ? 'fire/props.glb' : null })}\n`);
  return { t: shot.t, fires: fires.length, flamelets: fires.reduce((a, f) => a + f.flames.length, 0), voxels, embers: shot.embers.length / 9, grass: (live.fire.spread || []).length };
}

/**
 * buildBlenderPack({ ref, outDir, base, posture, fireT, fireDetail, log }) → { ref, dir, manifestHash, legVersion,
 *   pack, glbStats, written, ledger }
 */
export async function buildBlenderPack({ ref, outDir, base = 'lit', posture = null, fireT = null, fireDetail = 1, log = () => {} }) {
  if (!BLENDER_BASES.includes(base)) throw new Error(`\`base\` must be one of ${BLENDER_BASES.join(' | ')} (got '${base}')`);
  const sketch = SketchRepository.getByRef(ref);
  if (!sketch) throw new Error(`sketch '${ref}' not found`);
  const manifest = refuse(sketch, ref);
  const declaredPosture = resolvePosture(posture, manifest);

  const { payload: resolved, kind } = await resolveWorldScene(sketch, base === 'shaded' ? {} : { unshaded: true });
  if (!resolved) {
    throw new Error(`'${ref}': kind '${manifest.kind ?? kind ?? '?'}' resolves to no traversable scene — the Blender pack covers the object / figure / world kinds export_model covers`);
  }
  const { kept, dropped, droppedTotal } = splitPrintable(resolved.faces);
  const payload = { ...resolved, faces: kept };
  const exported = facesToGlb(payload, { generator: `mojulo ${ref} (blender pack, ${base})`, ...(base === 'lit' ? { lit: true } : {}) });
  if (!exported) throw new Error(`'${ref}': no mesh realization to pack (the printable set is empty)`);
  log(`resolved '${ref}' (kind ${kind}) — GLB ${exported.byteLength} bytes, ${exported.triangleCount} triangles, base ${base}`);

  const inventory = glbNodeInventory(exported.bytes);
  const groups = new Set();
  for (const f of kept) groups.add(typeof f.group === 'string' ? f.group : 'static');
  for (const r of Array.isArray(payload.repeats) ? payload.repeats : []) if (typeof r?.name === 'string') groups.add(r.name);
  const collections = collectionsFor(inventory, groups);
  const landmark = pickLandmark(inventory);
  const units = unitsLabel(manifest);   // the manifest's own label, else the kind family's authoring unit (world-units.js)
  const metersPerUnit = metersPerUnitFor(units);
  const longest = Math.max(...inventory.bounds.size, 1e-9);
  const textures = payload.textures && typeof payload.textures === 'object' ? Object.keys(payload.textures).length : 0;
  const rigFigures = payload.figures && typeof payload.figures === 'object'
    ? Object.entries(payload.figures).filter(([, f]) => f && f.rig === true).map(([k]) => k) : [];
  const manifestHash = hashOf(manifest);
  const title = sketch.title || manifest.title || ref;

  const pack = {
    leg: 'blender', version: BLENDER_LEG_VERSION,
    ref, title, kind: kind ?? manifest.kind ?? null, manifestHash,
    base, posture: declaredPosture,
    units, meters_per_unit: metersPerUnit,
    frame: 'z-up; the GLB carries the y-up root rotation (Blender lands z-up, coordinates verbatim)',
    epsilon: r4(Math.max(0.01 / metersPerUnit, longest * 1e-3)),
    glb: { bytes: exported.byteLength, nodes: exported.nodeCount, mesh_nodes: inventory.meshNodes, triangles: inventory.triangles, vertices: exported.vertexCount, textures, lit: !!exported.lit },
    bounds: inventory.bounds,
    landmark,
    collections,
    nodes: inventory.nodes,
  };

  const ledger = {
    [`base_${base}`]: { note: base === 'lit'
      ? 'real PBR materials over the raw albedo — mojulo\'s shade / contrast / material passes are OFF so Blender\'s light is the only light; surfaces that leaned on those passes read softer than the runtime look'
      : base === 'unlit'
        ? 'raw albedo on unlit materials (the bake worker\'s base) — Blender shows the vertex colours flat; add lights and materials yourself'
        : 'mojulo\'s own shading baked into the vertex colours — vivid, but any light you add lands twice' },
    ...(droppedTotal ? { dropped_runtime_faces: { count: droppedTotal, note: `not the object, not packed — water ${dropped.water}, shadow decals ${dropped.shadow}, ink decals ${dropped.ink}, studio furniture ${dropped.studio}` } } : {}),
    ...(textures ? { textures_carried: { count: textures, note: 'embedded PNGs on TEXCOORD_0 — carried OUT; a painted texture comes HOME only once the reader learns textures (interchange-seams seam 6b)' } } : {}),
    ...(rigFigures.length ? { rig_static: { count: rigFigures.length, kinds: rigFigures, note: 'rig figures packed at REST with no clips — the pass returns as a statue (meshRef); a walking recolour is the prelit door (W2)' } } : {}),
    ...(resolved.unshadedWarning ? { unshaded_partial: { note: String(resolved.unshadedWarning) } } : {}),
    ...(Object.keys(collections).length === 1 && inventory.meshNodes >= 1 ? { single_collection: { count: inventory.meshNodes, note: `the export carries ONE render group ('${Object.keys(collections)[0]}') — every part lands in one collection; per-part collections need per-part \`group\` tags upstream (assembler units and their parts ship as one mesh today), so select by face / island inside Blender` } } : {}),
    ...(declaredPosture === 'greybox' ? { greybox_declared: { note: 'operator-declared greybox handoff — surfacing losses are deferred, not defects' } } : {}),
    hand_work: { note: 'the art pass is NOT regenerable: when the recipe re-mints past this manifest hash the bound variant is stale — re-mint → re-pack → re-pass' },
  };

  const remint = `node scripts/export-blender.mjs --ref ${ref}${base !== 'lit' ? ` --base ${base}` : ''}${manifest.fire && Number.isFinite(fireT) ? ` --fire-t ${fireT}` : ''}`;

  await fs.mkdir(path.join(outDir, 'recipe'), { recursive: true });
  const written = [];
  const writeOut = async (rel, data) => {
    const abs = path.join(outDir, rel);
    await fs.writeFile(abs, data);
    written.push({ file: rel, bytes: Buffer.byteLength(data) });
  };
  await writeOut('model.glb', exported.bytes);
  // fire (fire/fire-shot.js): only a recipe with `fire` carries a fire/ folder. A re-pack clears the pack's own fire
  // files first (a fire gone from the recipe must not linger); fire/vdb/ is the importer's, which a saved .blend reads
  for (const f of await fs.readdir(path.join(outDir, 'fire')).catch(() => [])) {
    if (/^(g\d+\.bin|fire\.json|props\.glb)$/.test(f)) await fs.rm(path.join(outDir, 'fire', f), { force: true });
  }
  const fire = manifest.fire ? await packFire({ sketch, manifest, payload: resolved, shaded: base === 'shaded', fireT, fireDetail, outDir, writeOut }) : null;
  if (fire) {
    pack.fire = fire;
    ledger.fire = { note: `the fire at t = ${fire.t} s, as the World page draws it then: ${fire.fires} fire${fire.fires === 1 ? '' : 's'} as ${fire.flamelets} emission volume${fire.flamelets === 1 ? '' : 's'} (OpenVDB, written by import_mojulo.py), smoke volumes, ${fire.embers} ember streaks, a light each, their props — all in the \`mojulo-fire\` collection, which the gate and the return leave out. A still: re-pack with \`--fire-t <s>\` for another instant${fire.grass ? '; a grass fire\'s burnt ground is the page\'s, not packed' : ''}` };
  }
  const emitted = emitBlenderPack({ ref, title, kind: pack.kind, pack, ledger, remint });
  await writeOut('pack.json', `${JSON.stringify(pack, null, 2)}\n`);
  await writeOut(`recipe/${ref}.json`, `${JSON.stringify(manifest, null, 2)}\n`);
  for (const f of emitted.files) await writeOut(f.file, f.text);

  return {
    ref, dir: outDir, manifestHash, legVersion: BLENDER_LEG_VERSION, base, pack,
    glbStats: { bytes: exported.byteLength, nodes: exported.nodeCount, triangles: inventory.triangles, textures },
    written, ledger,
  };
}
