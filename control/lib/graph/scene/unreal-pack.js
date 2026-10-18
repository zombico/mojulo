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
import { assessPortability } from './engine-portability.js';
import { emitUnrealProject, emitUnrealGame, UNREAL_LEG_VERSION } from './unreal-project.js';
import { loadSketch, refusePixelizer, packHash, resolveLevel, worldGlbStats, gameLevels, packPosture, bedWriter, emitFolder } from './engines/pack.js';

const refuse = (sketch, ref) => refusePixelizer(sketch, ref, 'a 2D reducer is not a scene (export-unreal.plan.md)');

async function writePack({ outDir, binaries, emitted, portability }) {
  const { written } = await emitFolder({ outDir, files: [
    ...binaries.map((b) => ({ rel: b.rel, data: b.bytes })),
    ...emitted.files.map((f) => ({ rel: f.file, data: f.text })),
    { rel: 'portability.json', data: JSON.stringify(portability, null, 2) },
  ] });
  return written;
}

/** A standalone world → Unreal pack at outDir (U0 scope). `posture` is the
 * per-handoff greybox/final declaration (engine-score.js); absent, the
 * world manifest's own `posture` still applies as the durable default. */
export async function buildUnrealWorldPack({ ref, outDir, clips = '_all', posture = null, lit = false, log = () => {} }) {
  const sketch = loadSketch(ref);
  const manifest = refuse(sketch, ref);
  if (manifest.kind === 'game') throw new Error(`'${ref}' is a game — game scope is the U1 track (export-unreal.plan.md)`);
  const { kind, exported, score, soundtrack } = await resolveLevel(sketch, { engine: 'unreal', clips, posture, lit });
  log(`resolved '${ref}' (kind ${kind}) — GLB ${exported.byteLength} bytes, ${exported.animationCount ?? 0} animations`);
  const binaries = [
    { rel: 'model.glb', bytes: exported.bytes },
    { rel: 'score.json', bytes: JSON.stringify(score, null, 2) },
    { rel: `recipe/${ref}.json`, bytes: JSON.stringify(manifest, null, 2) },
  ];
  const audioFile = await bedWriter({ binaries, log }).put(score.soundtrack, null, { recipe: soundtrack?.recipe });
  const manifestHash = packHash(manifest);
  const portability = assessPortability({ manifest, levels: [{ ref, score }], engine: 'unreal' });
  const emitted = emitUnrealProject({
    ref, score, manifestHash, audioFile, lit,
    remint: `node scripts/export-unreal.mjs --ref ${ref}${lit ? ' --lit' : ''}`,
  });
  const written = await writePack({ outDir, binaries, emitted, portability });
  return {
    scope: 'world', ref, dir: outDir, manifestHash, legVersion: UNREAL_LEG_VERSION,
    glbStats: worldGlbStats(exported),
    written, ledger: emitted.ledger, portability,
  };
}

/** A game → Unreal pack at outDir (U1 scope): game.json + per-level
 * levels/<ref>/{model.glb,score.json} + audio beds + the MojuloKernel C++
 * plugin. Mirrors buildUnityGamePack — with one fix the Unity leg pinned:
 * beds dedupe by beatsRef, but `audio/menu.wav` must ALWAYS exist when the
 * game declares menu music (Unity's dedupe silently dropped it when the menu
 * bed was already some level's soundtrack). */
export async function buildUnrealGamePack({ ref, outDir, clips = '_all', posture = null, lit = false, log = () => {} }) {
  const manifest = refuse(loadSketch(ref), ref);
  const specs = gameLevels(manifest, ref);
  const posturePack = packPosture(posture, manifest);

  const music = manifest.music ?? {};
  const battle = Array.isArray(music.battle) ? music.battle : [];
  const binaries = [];
  const beds = bedWriter({ binaries, log });

  const levels = [];
  const glbStats = { levels: {} };
  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    const lvSketch = loadSketch(spec.ref);
    const { exported, score, soundtrack } = await resolveLevel(lvSketch, { engine: 'unreal', clips, posture: posturePack, lit });
    // The battle rotation, stamped into DATA (the shipped Unity/Godot
    // behavior): a level without its own soundtrack gets the game's rotation
    // pick baked into its sidecar copy — the kernel never knows a rotation.
    if (!score.soundtrack && battle.length) score.soundtrack = battle[i % battle.length];
    await beds.put(score.soundtrack, null, { recipe: score.soundtrack === soundtrack?.id ? soundtrack.recipe : null });
    binaries.push({ rel: `levels/${spec.ref}/model.glb`, bytes: exported.bytes });
    binaries.push({ rel: `levels/${spec.ref}/score.json`, bytes: JSON.stringify(score, null, 2) });
    binaries.push({ rel: `recipe/${spec.ref}.json`, bytes: JSON.stringify(lvSketch.manifest, null, 2) });
    glbStats.levels[spec.ref] = {
      bytes: exported.byteLength, triangles: exported.triangleCount, animations: exported.animationCount ?? 0,
    };
    levels.push({ ref: spec.ref, title: spec.title, gate: spec.gate, score });
    log(`level '${spec.ref}' resolved — GLB ${exported.byteLength} bytes${score.soundtrack ? `, bed ${score.soundtrack}` : ''}`);
  }
  await beds.put(music.menu, 'audio/menu.wav');

  binaries.push({ rel: 'game.json', bytes: JSON.stringify(manifest, null, 2) });
  binaries.push({ rel: 'recipe/game.json', bytes: JSON.stringify(manifest, null, 2) });

  const manifestHash = packHash(manifest);
  const portability = assessPortability({ manifest, levels, engine: 'unreal' });
  const emitted = emitUnrealGame({ lit,
    ref, manifest, levels, manifestHash,
    remint: `node scripts/export-unreal.mjs --ref ${ref}`,
  });
  const written = await writePack({ outDir, binaries, emitted, portability });
  return {
    scope: 'game', ref, dir: outDir, manifestHash, legVersion: UNREAL_LEG_VERSION,
    glbStats, written, ledger: emitted.ledger, portability,
  };
}
