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
import path from 'node:path';
import { assessPortability } from './engine-portability.js';
import { emitUnityProject, emitUnityGame, unityGuid, unityMeta, UNITY_LEG_VERSION } from './unity-project.js';
import { loadSketch, refusePixelizer, packHash, resolveLevel, worldGlbStats, gameLevels, packPosture, shellExtras, bedWriter, emitFolder } from './engines/pack.js';

const refuse = (sketch, ref) => refusePixelizer(sketch, ref, 'a 2D reducer is not a scene (export-unity.plan.md)');

/** Clean-emit the pack, then mint a .meta beside every file and folder. */
async function writePack({ outDir, binaries, emitted, portability, manifestHash }) {
  const { written, writeOut } = await emitFolder({ outDir, files: [
    ...binaries.map((b) => ({ rel: b.rel, data: b.bytes })),
    ...emitted.files.map((f) => ({ rel: f.file, data: f.text })),
    { rel: 'portability.json', data: JSON.stringify(portability, null, 2) },
  ] });
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
  const sketch = loadSketch(ref);
  const manifest = refuse(sketch, ref);
  if (manifest.kind === 'game') throw new Error(`'${ref}' is a game — game scope is the Y1 track (export-unity.plan.md)`);
  const { kind, exported, score, soundtrack } = await resolveLevel(sketch, { engine: 'unity', clips, posture, lit });
  log(`resolved '${ref}' (kind ${kind}) — GLB ${exported.byteLength} bytes, ${exported.animationCount ?? 0} animations`);
  const binaries = [
    { rel: 'model.glb', bytes: exported.bytes },
    { rel: 'score.json', bytes: JSON.stringify(score, null, 2) },
    { rel: `recipe/${ref}.json`, bytes: JSON.stringify(manifest, null, 2) },
  ];
  const audioFile = await bedWriter({ binaries, log }).put(score.soundtrack, null, { recipe: soundtrack?.recipe });
  const manifestHash = packHash(manifest);
  const portability = assessPortability({ manifest, levels: [{ ref, score }], engine: 'unity' });
  const emitted = emitUnityProject({
    ref, score, manifestHash, audioFile,
    remint: `node scripts/export-unity.mjs --ref ${ref}`,
  });
  const written = await writePack({ outDir, binaries, emitted, portability, manifestHash });
  return {
    scope: 'world', ref, dir: outDir, manifestHash, legVersion: UNITY_LEG_VERSION,
    glbStats: worldGlbStats(exported),
    written, ledger: emitted.ledger, portability,
  };
}

/** A game → menu + gated levels + music beds pack at outDir (Y1 scope).
 * `posture` (or the game manifest's own) stamps every level pack-wide. */
export async function buildUnityGamePack({ ref, outDir, clips = '_all', posture = null, lit = false, log = () => {} }) {
  const manifest = refuse(loadSketch(ref), ref);
  const levelSpecs = gameLevels(manifest, ref);
  const posturePack = packPosture(posture, manifest);

  const music = manifest.music ?? {};
  const battle = Array.isArray(music.battle) ? music.battle : [];
  const binaries = [];
  const beds = bedWriter({ binaries, log });

  const levels = [];
  const glbStats = { levels: {} };
  for (let i = 0; i < levelSpecs.length; i++) {
    const spec = levelSpecs[i];
    const lvSketch = loadSketch(spec.ref);
    const { exported, score, soundtrack } = await resolveLevel(lvSketch, { engine: 'unity', clips, posture: posturePack, lit });
    log(`level ${i + 1}/${levelSpecs.length} '${spec.ref}' — GLB ${exported.byteLength} bytes`);
    // The kernel plays each level's own soundtrack (score.soundtrack, wired
    // by the importer); absent one, fall back to the game's battle rotation
    // by stamping it into the level's sidecar copy.
    const fallback = battle.length ? battle[i % battle.length] : null;
    if (!score.soundtrack && fallback) score.soundtrack = fallback;
    await beds.put(score.soundtrack, null, { recipe: score.soundtrack === soundtrack?.id ? soundtrack.recipe : null });
    binaries.push({ rel: `levels/${spec.ref}/model.glb`, bytes: exported.bytes });
    binaries.push({ rel: `levels/${spec.ref}/score.json`, bytes: JSON.stringify(score, null, 2) });
    binaries.push({ rel: `recipe/${spec.ref}.json`, bytes: JSON.stringify(lvSketch.manifest, null, 2) });
    levels.push({ ref: spec.ref, title: spec.title ?? spec.ref, gate: spec.gate ?? null, score });
    glbStats.levels[spec.ref] = { bytes: exported.byteLength, triangles: exported.triangleCount, animations: exported.animationCount ?? 0 };
  }
  // Menu music lands at the fixed path the importer probes, even when a level already plays the same music.
  await beds.put(music.menu, 'audio/menu.wav');
  binaries.push({ rel: 'game.json', bytes: JSON.stringify(manifest, null, 2) });
  binaries.push({ rel: 'recipe/game.json', bytes: JSON.stringify(manifest, null, 2) });

  const manifestHash = packHash(manifest);
  const portability = assessPortability({ manifest, levels: levels.map((l) => ({ ref: l.ref, score: l.score })), engine: 'unity' });
  const emitted = emitUnityGame({
    ref, title: manifest.title ?? ref, manifestHash, levels,
    shellExtras: shellExtras(manifest),
    remint: `node scripts/export-unity.mjs --ref ${ref}`,
  });
  const written = await writePack({ outDir, binaries, emitted, portability, manifestHash });
  return {
    scope: 'game', ref, dir: outDir, manifestHash, legVersion: UNITY_LEG_VERSION,
    glbStats, written, ledger: emitted.ledger, portability,
  };
}
