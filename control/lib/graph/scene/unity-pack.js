/**
 * unity-pack.js — the Unity pack assembly engine (export-unity.plan.md Y0).
 *
 * Y0 front door is the CLI only (scripts/export-unity.mjs) — the MCP
 * `export_game { target: 'unity' }` branch lands with game scope in Y1, so
 * the tool-description payload stays untouched for now (it sits at ceiling).
 *
 * A pack is DATA (score.json / model.glb / WAV / recipe) plus the emitter's
 * text (unity-project.js: importer C#, T-numbered guide, README) plus a
 * deterministic `.meta` file beside EVERY file and folder — GUIDs minted from
 * sha256(manifestHash + path), so a re-minted pack is byte-identical and a
 * fresh Unity import keeps stable asset identities (the Godot uid decision,
 * transplanted). Deterministic: same rows → same pack bytes; the folder is
 * wholly derived and clean-emitted on every build.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { manifestIdentity } from './engine-score.js';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { facesToGlb } from '@/lib/graph/scene/scene-gltf';
import { extractEngineScore } from './engine-score.js';
import { assessPortability } from './engine-portability.js';
import { emitUnityProject, emitUnityGame, unityGuid, unityMeta, UNITY_LEG_VERSION } from './unity-project.js';

const hashOf = (m) => createHash('sha256').update(JSON.stringify(manifestIdentity(m))).digest('hex').slice(0, 16);

function refuse(sketch, ref) {
  const manifest = sketch?.manifest ?? {};
  if (manifest.engine === 'pixelizer' || manifest.kind === 'pixelizer') {
    throw new Error(`refused: '${ref}' is a pixelizer game — a 2D reducer is not a scene (export-unity.plan.md)`);
  }
  return manifest;
}

// Same seam as the Godot leg: resolveWorldScene → facesToGlb → engine score.
// One realizer — no parallel exporter math.
async function resolveLevel(levelSketch, { clips, posture = null, lit = false }) {
  // `lit` (lit-handoff.plan.md): the UNSHADED payload + real PBR materials, so the engine lights it
  const { payload, kind } = await resolveWorldScene(levelSketch, lit ? { unshaded: true } : {});
  if (!payload) {
    throw new Error(`'${levelSketch.ref}': kind '${levelSketch.manifest?.kind ?? kind ?? '?'}' resolves to no traversable scene`);
  }
  const exported = facesToGlb(payload, { generator: `mojulo ${levelSketch.ref}`, ...(clips ? { clips } : {}), ...(lit ? { lit: true } : {}) });
  const score = extractEngineScore(levelSketch, payload, { posture });
  return { kind, exported, score };
}

/** Write pack files, then mint a .meta beside every file and folder. */
async function writePack({ outDir, binaries, emitted, portability, manifestHash }) {
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });
  const written = [];
  const writeOut = async (rel, data) => {
    const abs = path.join(outDir, rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, data);
    written.push({ file: rel, bytes: Buffer.byteLength(data) });
  };
  for (const b of binaries) await writeOut(b.rel, b.bytes);
  for (const f of emitted.files) await writeOut(f.file, f.text);
  await writeOut('portability.json', JSON.stringify(portability, null, 2));

  // .meta minting: files first, then every ancestor folder (sorted for
  // stable ordering). Minimal metas — Unity keeps the guid and backfills
  // importer config in its own workspace copy.
  const folders = new Set();
  for (const { file } of [...written]) {
    let dir = path.dirname(file);
    while (dir && dir !== '.') { folders.add(dir); dir = path.dirname(dir); }
  }
  for (const { file } of [...written]) {
    await writeOut(`${file}.meta`, unityMeta(unityGuid(manifestHash, file)));
  }
  for (const dir of [...folders].sort()) {
    await writeOut(`${dir}.meta`, unityMeta(unityGuid(manifestHash, dir), { folder: true }));
  }
  return written;
}

/** A standalone world → Unity pack at outDir (Y0 scope). `posture` is the
 * per-handoff greybox/final declaration (engine-score.js); absent, the
 * world manifest's own `posture` still applies as the durable default. */
export async function buildUnityWorldPack({ ref, outDir, clips = '_all', posture = null, lit = false, log = () => {} }) {
  const sketch = SketchRepository.getByRef(ref);
  if (!sketch) throw new Error(`sketch '${ref}' not found`);
  const manifest = refuse(sketch, ref);
  if (manifest.kind === 'game') throw new Error(`'${ref}' is a game — game scope is the Y1 track (export-unity.plan.md)`);
  const { kind, exported, score } = await resolveLevel(sketch, { clips, posture, lit });
  log(`resolved '${ref}' (kind ${kind}) — GLB ${exported.byteLength} bytes, ${exported.animationCount ?? 0} animations`);
  const binaries = [
    { rel: 'model.glb', bytes: exported.bytes },
    { rel: 'score.json', bytes: JSON.stringify(score, null, 2) },
    { rel: `recipe/${ref}.json`, bytes: JSON.stringify(manifest, null, 2) },
  ];
  let audioFile = null;
  if (score.soundtrack) {
    binaries.push({ rel: `audio/${score.soundtrack}.wav`, bytes: await renderBeats(score.soundtrack, log) });
    audioFile = `audio/${score.soundtrack}.wav`;
  }
  const manifestHash = hashOf(manifest);
  const portability = assessPortability({ manifest, levels: [{ ref, score }] });
  const emitted = emitUnityProject({
    ref, score, manifestHash, audioFile,
    remint: `node scripts/export-unity.mjs --ref ${ref}`,
  });
  const written = await writePack({ outDir, binaries, emitted, portability, manifestHash });
  return {
    scope: 'world', ref, dir: outDir, manifestHash, legVersion: UNITY_LEG_VERSION,
    glbStats: {
      bytes: exported.byteLength, nodes: exported.nodeCount, triangles: exported.triangleCount,
      animations: exported.animationCount ?? 0, cameras: exported.cameraCount ?? 0, entities: exported.entityCount ?? 0,
    },
    written, ledger: emitted.ledger, portability,
  };
}

/** A game → menu + gated levels + music beds pack at outDir (Y1 scope).
 * `posture` (or the game manifest's own) stamps every level pack-wide. */
export async function buildUnityGamePack({ ref, outDir, clips = '_all', posture = null, lit = false, log = () => {} }) {
  const sketch = SketchRepository.getByRef(ref);
  if (!sketch) throw new Error(`sketch '${ref}' not found`);
  const manifest = refuse(sketch, ref);
  if (manifest.kind !== 'game') throw new Error(`'${ref}' is not a game (kind '${manifest.kind ?? 'none'}')`);
  const levelSpecs = Array.isArray(manifest.levels) ? manifest.levels : [];
  if (!levelSpecs.length) throw new Error(`game '${ref}' declares no levels`);
  const packPosture = posture ?? manifest.posture ?? null;

  const music = manifest.music ?? {};
  const battle = Array.isArray(music.battle) ? music.battle : [];
  const binaries = [];
  const beds = new Map();
  const bed = async (beatsRef, rel = null) => {
    if (!beatsRef) return null;
    if (!beds.has(beatsRef)) {
      binaries.push({ rel: rel ?? `audio/${beatsRef}.wav`, bytes: await renderBeats(beatsRef, log) });
      beds.set(beatsRef, rel ?? `audio/${beatsRef}.wav`);
    }
    return beds.get(beatsRef);
  };

  const levels = [];
  const glbStats = { levels: {} };
  for (let i = 0; i < levelSpecs.length; i++) {
    const spec = levelSpecs[i];
    const lvSketch = SketchRepository.getByRef(spec.ref);
    if (!lvSketch) throw new Error(`level '${spec.ref}' not found`);
    const { exported, score } = await resolveLevel(lvSketch, { clips, posture: packPosture, lit });
    log(`level ${i + 1}/${levelSpecs.length} '${spec.ref}' — GLB ${exported.byteLength} bytes`);
    // The kernel plays each level's own soundtrack (score.soundtrack, wired
    // by the importer); absent one, fall back to the game's battle rotation
    // by stamping it into the level's sidecar copy.
    const fallback = battle.length ? battle[i % battle.length] : null;
    if (!score.soundtrack && fallback) score.soundtrack = fallback;
    if (score.soundtrack) await bed(score.soundtrack);
    binaries.push({ rel: `levels/${spec.ref}/model.glb`, bytes: exported.bytes });
    binaries.push({ rel: `levels/${spec.ref}/score.json`, bytes: JSON.stringify(score, null, 2) });
    binaries.push({ rel: `recipe/${spec.ref}.json`, bytes: JSON.stringify(lvSketch.manifest, null, 2) });
    levels.push({ ref: spec.ref, title: spec.title ?? spec.ref, gate: spec.gate ?? null, score });
    glbStats.levels[spec.ref] = { bytes: exported.byteLength, triangles: exported.triangleCount, animations: exported.animationCount ?? 0 };
  }
  // Menu music lands at the fixed path the importer probes.
  if (music.menu) await bed(music.menu, 'audio/menu.wav');
  binaries.push({ rel: 'game.json', bytes: JSON.stringify(manifest, null, 2) });
  binaries.push({ rel: 'recipe/game.json', bytes: JSON.stringify(manifest, null, 2) });

  const manifestHash = hashOf(manifest);
  const portability = assessPortability({ manifest, levels: levels.map((l) => ({ ref: l.ref, score: l.score })) });
  const emitted = emitUnityGame({
    ref, title: manifest.title ?? ref, manifestHash, levels,
    shellExtras: ['menu', 'setup', 'difficulty', 'theme'].filter((k) => manifest[k] != null),
    remint: `node scripts/export-unity.mjs --ref ${ref}`,
  });
  const written = await writePack({ outDir, binaries, emitted, portability, manifestHash });
  return {
    scope: 'game', ref, dir: outDir, manifestHash, legVersion: UNITY_LEG_VERSION,
    glbStats, written, ledger: emitted.ledger, portability,
  };
}

let beatsRender = null;
async function renderBeats(beatsRef, log) {
  const beats = SketchRepository.getByRef(beatsRef);
  if (!beats) throw new Error(`beats ref '${beatsRef}' not found`);
  if (!beatsRender) ({ renderBeatsOffline: beatsRender } = await import('@/lib/graph/beats/beats-render'));
  const rendered = await beatsRender(beats.manifest, {});
  log(`beats '${beatsRef}' rendered — ${rendered.wav.length} bytes`);
  return rendered.wav;
}
