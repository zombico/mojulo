/**
 * THE ROBLOX PACK: a game → a Rojo project (roblox-project.js) at outDir, built on the pack pipeline (engines/pack.js).
 * Each level resolves through the seam every engine shares; the place gets its greybox and its look (roblox-look.js: the
 * floors in their faces' colours and materials, the rest of the level voxelized), its data and the Roblox kernel
 * (copied verbatim from lib/graph/scene/roblox-kernel, the modules the conformance corpora hold equal), and the folder
 * gets the level's GLB and score beside the project for reference and Studio's 3D Importer. Deterministic: same rows →
 * same bytes.
 *
 *   KERNEL_MODULES                       the kernel modules a place loads, in load order
 *   writeRobloxPlace({ outDir, binaries, emitted, portability }) → written   the folder, clean-emitted
 *   buildRobloxGamePack({ ref, outDir, posture?, log? }) → { scope, ref, dir, manifestHash, written, ledger, portability, levels,
 *     payloads }   payloads: { [level ref]: the resolved payload } (the export's gate plays them; never serialized)
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { loadSketch, refusePixelizer, packHash, resolveLevel, gameLevels, packPosture, emitFolder, levelContract } from './engines/pack.js';
import { assessPortability } from './engine-portability.js';
import { emitRobloxGame, greyboxModel, levelData } from './roblox-project.js';
import { lookModel } from './roblox-look.js';

export const KERNEL_MODULES = ['js', 'json', 'stats', 'bus', 'store', 'game', 'rules', 'nav', 'mind', 'group', 'cast', 'combat', 'scenes', 'quests', 'level', 'hud'];
const kernelDir = () => path.join(process.cwd(), 'lib', 'graph', 'scene', 'roblox-kernel');
const placeDir = () => path.join(process.cwd(), 'lib', 'graph', 'scene', 'roblox-place');
const PLACE_SCRIPTS = [['MojuloServer.server.luau', 'src/server'], ['MojuloClient.client.luau', 'src/client']];

/** The folder: the pack's binaries, the project's text, the kernel and the place scripts copied verbatim, the report. */
export async function writeRobloxPlace({ outDir, binaries = [], emitted, portability = null }) {
  const code = [];
  for (const m of KERNEL_MODULES) code.push({ rel: `src/kernel/${m}.luau`, data: await fs.readFile(path.join(kernelDir(), `${m}.luau`)) });
  for (const [f, dir] of PLACE_SCRIPTS) code.push({ rel: `${dir}/${f}`, data: await fs.readFile(path.join(placeDir(), f)) });
  const { written, writeOut } = await emitFolder({ outDir, files: [
    ...binaries.map((b) => ({ rel: b.rel, data: b.bytes })),
    ...emitted.files.map((f) => ({ rel: f.file, data: f.text })),
    ...code,
  ] });
  if (portability) await writeOut('portability.json', JSON.stringify(portability, null, 2));
  return written;
}

export async function buildRobloxGamePack({ ref, outDir, posture = null, log = () => {} }) {
  const sketch = loadSketch(ref);
  const manifest = refusePixelizer(sketch, ref, 'a 2D reducer is not a place');
  const levelSpecs = gameLevels(manifest, ref);
  const posturePack = packPosture(posture, manifest);
  const binaries = [];
  const levels = [];
  const payloads = {};
  for (let i = 0; i < levelSpecs.length; i++) {
    const spec = levelSpecs[i];
    const lvSketch = loadSketch(spec.ref);
    const { payload, exported, score, bus } = await resolveLevel(lvSketch, { engine: 'roblox', posture: posturePack });
    const mpu = Number(payload.metersPerUnit) > 0 ? Number(payload.metersPerUnit) : 1;
    const look = lookModel(payload.faces || [], { mpu, textures: payload.textures || {}, repeats: payload.repeats || [] });
    const greybox = greyboxModel({ faces: payload.faces || [], colliders: score.colliders || [], mpu, lookOf: look.lookOf, look });
    log(`level ${i + 1}/${levelSpecs.length} '${spec.ref}': ${greybox.floors} floor slabs, ${greybox.walls} walls, ${greybox.look} look boxes (${greybox.voxel} m voxels)`);
    binaries.push({ rel: `levels/${spec.ref}/model.glb`, bytes: exported.bytes });
    binaries.push({ rel: `levels/${spec.ref}/score.json`, bytes: JSON.stringify(score, null, 2) });
    binaries.push({ rel: `recipe/${spec.ref}.json`, bytes: JSON.stringify(lvSketch.manifest, null, 2) });
    payloads[spec.ref] = payload;
    levels.push({ ref: spec.ref, title: spec.title ?? spec.ref, gate: spec.gate ?? null, score, data: levelData(score), bus, contract: levelContract(lvSketch.manifest), greybox });
  }
  binaries.push({ rel: 'recipe/game.json', bytes: JSON.stringify(manifest, null, 2) });
  const portability = assessPortability({ manifest, levels: levels.map((l) => ({ ref: l.ref, score: l.score })), engine: 'roblox' });
  const remint = `node scripts/export-roblox.mjs --ref ${ref}`;
  const emitted = emitRobloxGame({ ref, title: manifest.title ?? ref, manifest, levels, portability, remint });
  const written = await writeRobloxPlace({ outDir, binaries, emitted, portability });
  return {
    scope: 'game', ref, dir: outDir, manifestHash: packHash(manifest), written,
    ledger: Object.fromEntries(levels.map((l) => [l.ref, l.score.ledger])), portability,
    levels: levels.map((l) => ({ ref: l.ref, floors: l.greybox.floors, walls: l.greybox.walls, cell: l.greybox.cell, look: l.greybox.look, voxel: l.greybox.voxel, ...(l.greybox.repeatVoxel ? { repeatVoxel: l.greybox.repeatVoxel } : {}) })),
    payloads,
  };
}
