/**
 * unreal-pack.js — the Unreal pack assembly engine (export-unreal.plan.md
 * rev 2, U0).
 *
 * U0 front door is the CLI only (scripts/export-unreal.mjs) — the MCP
 * `export_game { target: 'unreal' }` branch lands with game scope in U1,
 * exactly the Unity sequencing (the tool description sits at ceiling).
 *
 * A pack is DATA (score.json / model.glb / WAV / recipe) plus the emitter's
 * text (unreal-project.js: import_mojulo.py, T-numbered guide, README). No
 * .meta sidecars — UE idempotency rides deterministic asset paths + the
 * import script rebuilding in place. Deterministic: same rows → same pack
 * bytes; the folder is wholly derived and clean-emitted on every build.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { facesToGlb } from '@/lib/graph/scene/scene-gltf';
import { extractEngineScore } from './engine-score.js';
import { assessPortability } from './engine-portability.js';
import { emitUnrealProject, emitUnrealGame, UNREAL_LEG_VERSION } from './unreal-project.js';

const hashOf = (m) => createHash('sha256').update(JSON.stringify(m)).digest('hex').slice(0, 16);

function refuse(sketch, ref) {
  const manifest = sketch?.manifest ?? {};
  if (manifest.engine === 'pixelizer' || manifest.kind === 'pixelizer') {
    throw new Error(`refused: '${ref}' is a pixelizer game — a 2D reducer is not a scene (export-unreal.plan.md)`);
  }
  return manifest;
}

// Same seam as the Godot and Unity legs: resolveWorldScene → facesToGlb →
// engine score. One realizer — no parallel exporter math.
async function resolveLevel(levelSketch, { clips, posture = null }) {
  const { payload, kind } = await resolveWorldScene(levelSketch);
  if (!payload) {
    throw new Error(`'${levelSketch.ref}': kind '${levelSketch.manifest?.kind ?? kind ?? '?'}' resolves to no traversable scene`);
  }
  const exported = facesToGlb(payload, { generator: `mojulo ${levelSketch.ref}`, ...(clips ? { clips } : {}) });
  const score = extractEngineScore(levelSketch, payload, { posture });
  return { kind, exported, score };
}

async function writePack({ outDir, binaries, emitted, portability }) {
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
  return written;
}

/** A standalone world → Unreal pack at outDir (U0 scope). `posture` is the
 * per-handoff greybox/final declaration (engine-score.js); absent, the
 * world manifest's own `posture` still applies as the durable default. */
export async function buildUnrealWorldPack({ ref, outDir, clips = '_all', posture = null, log = () => {} }) {
  const sketch = SketchRepository.getByRef(ref);
  if (!sketch) throw new Error(`sketch '${ref}' not found`);
  const manifest = refuse(sketch, ref);
  if (manifest.kind === 'game') throw new Error(`'${ref}' is a game — game scope is the U1 track (export-unreal.plan.md)`);
  const { kind, exported, score } = await resolveLevel(sketch, { clips, posture });
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
  const emitted = emitUnrealProject({
    ref, score, manifestHash, audioFile,
    remint: `node scripts/export-unreal.mjs --ref ${ref}`,
  });
  const written = await writePack({ outDir, binaries, emitted, portability });
  return {
    scope: 'world', ref, dir: outDir, manifestHash, legVersion: UNREAL_LEG_VERSION,
    glbStats: {
      bytes: exported.byteLength, nodes: exported.nodeCount, triangles: exported.triangleCount,
      animations: exported.animationCount ?? 0, cameras: exported.cameraCount ?? 0, entities: exported.entityCount ?? 0,
    },
    written, ledger: emitted.ledger, portability,
  };
}

/** A game → Unreal pack at outDir (U1 scope): game.json + per-level
 * levels/<ref>/{model.glb,score.json} + audio beds + the MojuloKernel C++
 * plugin. Mirrors buildUnityGamePack — with one fix the Unity leg pinned:
 * beds dedupe by beatsRef, but `audio/menu.wav` must ALWAYS exist when the
 * game declares menu music (Unity's dedupe silently dropped it when the menu
 * bed was already some level's soundtrack). */
export async function buildUnrealGamePack({ ref, outDir, clips = '_all', posture = null, log = () => {} }) {
  const sketch = SketchRepository.getByRef(ref);
  if (!sketch) throw new Error(`sketch '${ref}' not found`);
  const manifest = refuse(sketch, ref);
  if (manifest.kind !== 'game') throw new Error(`'${ref}' is kind '${manifest.kind ?? '?'}' — world scope is buildUnrealWorldPack`);
  const packPosture = posture ?? manifest.posture ?? null;

  const music = manifest.music ?? {};
  const battle = Array.isArray(music.battle) ? music.battle : [];
  const beds = new Map(); // beatsRef -> wav bytes (rendered once, written per rel)
  const binaries = [];
  const bed = async (beatsRef, rel) => {
    if (!beds.has(beatsRef)) beds.set(beatsRef, await renderBeats(beatsRef, log));
    if (!binaries.some((b) => b.rel === rel)) binaries.push({ rel, bytes: beds.get(beatsRef) });
  };

  const levels = [];
  const glbStats = { levels: {} };
  const specs = Array.isArray(manifest.levels) ? manifest.levels : [];
  if (!specs.length) throw new Error(`game '${ref}' declares no levels`);
  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    const lvSketch = SketchRepository.getByRef(spec.ref);
    if (!lvSketch) throw new Error(`game '${ref}' level '${spec.ref}' not found`);
    const { exported, score } = await resolveLevel(lvSketch, { clips, posture: packPosture });
    // The battle rotation, stamped into DATA (the shipped Unity/Godot
    // behavior): a level without its own soundtrack gets the game's rotation
    // pick baked into its sidecar copy — the kernel never knows a rotation.
    if (!score.soundtrack && battle.length) score.soundtrack = battle[i % battle.length];
    if (score.soundtrack) await bed(score.soundtrack, `audio/${score.soundtrack}.wav`);
    binaries.push({ rel: `levels/${spec.ref}/model.glb`, bytes: exported.bytes });
    binaries.push({ rel: `levels/${spec.ref}/score.json`, bytes: JSON.stringify(score, null, 2) });
    binaries.push({ rel: `recipe/${spec.ref}.json`, bytes: JSON.stringify(lvSketch.manifest, null, 2) });
    glbStats.levels[spec.ref] = {
      bytes: exported.byteLength, triangles: exported.triangleCount, animations: exported.animationCount ?? 0,
    };
    levels.push({ ref: spec.ref, title: spec.title, gate: spec.gate, score });
    log(`level '${spec.ref}' resolved — GLB ${exported.byteLength} bytes${score.soundtrack ? `, bed ${score.soundtrack}` : ''}`);
  }
  if (music.menu) await bed(music.menu, 'audio/menu.wav');

  binaries.push({ rel: 'game.json', bytes: JSON.stringify(manifest, null, 2) });
  binaries.push({ rel: 'recipe/game.json', bytes: JSON.stringify(manifest, null, 2) });

  const manifestHash = hashOf(manifest);
  const portability = assessPortability({ manifest, levels });
  const emitted = emitUnrealGame({
    ref, manifest, levels, manifestHash,
    remint: `node scripts/export-unreal.mjs --ref ${ref}`,
  });
  const written = await writePack({ outDir, binaries, emitted, portability });
  return {
    scope: 'game', ref, dir: outDir, manifestHash, legVersion: UNREAL_LEG_VERSION,
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
