/**
 * godot-pack.js — the Godot pack assembly engine (godot-handoff.plan.md G6),
 * shared by the two front doors so they cannot drift:
 * - scripts/export-godot.mjs (CLI: assembles, then runs the machine gate)
 * - export_game { target: 'godot' } (MCP: assembles; the gate note rides the
 *   result — running an engine binary inside a tool call is not a thing).
 *
 * A pack is DATA (score.json / game.json / GLBs / WAVs / recipes) plus the
 * hand-authored versioned kernel (godot-kernel/, copied verbatim) plus the
 * emitter's text stubs (godot-project.js). Deterministic: same rows → same
 * pack bytes; the folder is wholly derived and clean-emitted on every build.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { renderBed, renderSound } from './engine-audio.js';
import { emitGodotProject, emitGodotGame } from './godot-project.js';
import { assessPortability } from './engine-portability.js';
import { bakeFps, bakeImport } from './godot-bake.js';
import { isHumanoidRig } from '../polygonizer/figure-humanoid-map.js';
import { loadSketch, refusePixelizer, packHash, resolveLevel, worldGlbStats, gameLevels, packPosture, shellExtras, bedWriter, emitFolder, figureClipNames, figureClip, figureSkeleton, layeredFigure, levelContract } from './engines/pack.js';

export { figureClip, layeredFigure, levelContract };

// cwd-anchored (the control process and the CLI both run from control/) —
// lib files may be bundled, so import.meta-relative paths are not reliable.
const kernelDir = () => path.join(process.cwd(), 'lib', 'graph', 'scene', 'godot-kernel');

const toDb = (v) => (Number.isFinite(v) && v > 0 ? 20 * Math.log10(v) : null);

const refuse = (sketch, ref) => refusePixelizer(sketch, ref, "a 2D reducer is not a scene; it takes the arcade leg (export_game { target: 'godot' } on the game row)");

// a quaternion [x, y, z, w] applied to a vector
const rotate = ([x, y, z, w], [vx, vy, vz]) => {
  const tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx);
  return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)];
};

/** The figure's EXTENT over its clips (z-up, the pack's frame): each bone part's rest bounding box, padded by 3% of the
 * figure's height, its eight corners carried by that bone's frame (head' + q·(v − restHead)) at rest and at every packed
 * key of every clip named → { min, max, corners } (the carried corners and their bounding box); null when no part
 * carries positions. */
export function figureExtent(f, clipNames = []) {
  const bones = f?.bones || [], nb = bones.length;
  const boxes = bones.map((bone, bi) => {
    const part = f.parts?.[bi];
    if (!part?.pos) return null;
    const b = Buffer.from(part.pos, 'base64'), p = new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < p.length; i++) { const c = i % 3; if (p[i] < lo[c]) lo[c] = p[i]; if (p[i] > hi[c]) hi[c] = p[i]; }
    return { lo, hi, head: bone.head };
  });
  const poses = [{}];   // the rest pose, then every packed key
  for (const name of clipNames) { const clip = f.clips?.[name]; if (clip?.k && Array.isArray(clip.b)) for (let k = 0; k < clip.k; k++) poses.push({ B: clip.b, o: k * nb }); }
  const carried = (pad) => {
    const pts = [];
    for (const pose of poses) boxes.forEach((box, bi) => {
      if (!box) return;
      const o = pose.B ? (pose.o + bi) * 7 : -1, q = pose.B ? [pose.B[o], pose.B[o + 1], pose.B[o + 2], pose.B[o + 3]] : [0, 0, 0, 1], head = pose.B ? [pose.B[o + 4], pose.B[o + 5], pose.B[o + 6]] : box.head;
      for (let k = 0; k < 8; k++) {
        const v = [0, 1, 2].map((c) => (k & (1 << c) ? box.hi[c] + pad : box.lo[c] - pad) - box.head[c]), r = rotate(q, v);
        pts.push([head[0] + r[0], head[1] + r[1], head[2] + r[2]]);
      }
    });
    return pts;
  };
  const bounds = (pts) => pts.reduce((m, p) => { for (let c = 0; c < 3; c++) { m.min[c] = Math.min(m.min[c], p[c]); m.max[c] = Math.max(m.max[c], p[c]); } return m; }, { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
  const bare = bounds(carried(0));
  if (!Number.isFinite(bare.min[0])) return null;
  const corners = carried(0.03 * (bare.max[2] - bare.min[2]));
  return { ...bounds(corners), corners };
}

/** An authored camera re-placed to FRAME THE FIGURE over its clips (figureExtent): its rotation and yfov kept, its axis
 * through the centre of the extent's box, backed off to the nearest distance at which every corner of the extent lies
 * inside the frustum with a tenth to spare (tan(yfov/2) / 1.1 up and down, times its aspectRatio across). `mpu` scales
 * the extent into the score's metres. The camera as it was when the figure has no extent. */
export function frameFigure(cam, f, clipNames = [], mpu = 1) {
  const ext = figureExtent(f, clipNames);
  if (!ext || !Array.isArray(cam?.rotation)) return cam;
  const q = cam.rotation, R = rotate(q, [1, 0, 0]), U = rotate(q, [0, 1, 0]), B = rotate(q, [0, 0, 1]);
  const ty = Math.tan((cam.yfov ?? 1) / 2) / 1.1, tx = ty * (cam.aspectRatio ?? 1);
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const C = [0, 1, 2].map((c) => ((ext.min[c] + ext.max[c]) / 2) * mpu);
  let d = 0;
  for (const p of ext.corners) {
    const w = [p[0] * mpu - C[0], p[1] * mpu - C[1], p[2] * mpu - C[2]], back = dot(w, B);
    d = Math.max(d, back + Math.abs(dot(w, U)) / ty, back + Math.abs(dot(w, R)) / tx, back + (cam.znear ?? 0.1) * 1.5);
  }
  return { ...cam, translation: [0, 1, 2].map((c) => C[c] + d * B[c]) };
}

/** A level's sound into the pack (engine-sound.js): every take of every one-shot to audio/sfx/<id>_<n>.wav and the fight
 * score to audio/<ref>-combat.wav, each rendered once per pack (`seen`: levels of one game share a cue's file). */
async function packSound(sound, { binaries, seen, log }) {
  if (!sound) return;
  let fresh = 0;
  for (const s of sound.sounds) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    (await renderSound(s, sound.score.variants)).forEach((wav, n) => binaries.push({ rel: `audio/sfx/${s.id}_${n}.wav`, bytes: wav }));
    fresh++;
  }
  if (fresh) log(`${fresh} sounds rendered (${sound.score.variants} take${sound.score.variants > 1 ? 's' : ''} each)`);
  if (sound.combat && !seen.has(sound.combat.id)) {
    seen.add(sound.combat.id);
    binaries.push({ rel: `audio/${sound.combat.id}.wav`, bytes: await renderBed(sound.combat.id, { recipe: sound.combat.recipe, log }) });
  }
}


export const OWNED_DIR = 'game';


/** Clean-emit a pack folder: binaries + emitted text + (optional) portability
 * + a kernel dir copied verbatim. Shared with the arcade leg (godot-arcade.js),
 * which brings its own kernel and no engine-score portability. */
export async function writePack({ outDir, binaries, emitted, portability = null, kernelSrc = kernelDir() }) {
  // every GLB whose clips' keys fall between Godot's default samples imports at its own bake rate (bakeFps)
  const files = emitted.files.slice();
  for (const b of binaries) {
    if (!b.rel.endsWith('.glb')) continue;
    const fps = bakeFps(b.bytes);
    if (fps == null) continue;
    const at = files.findIndex((f) => f.file === `${b.rel}.import`);
    if (at >= 0) files[at] = { ...files[at], text: files[at].text.replace('\n[params]\n\n', `\n[params]\n\nanimation/fps=${fps}\n`) };
    else files.push({ file: `${b.rel}.import`, text: bakeImport(fps) });
  }
  // `game/` is the developer's (OWNED_DIR): a re-mint keeps it whole, and writes its seed files only where missing
  const { written, writeOut } = await emitFolder({ outDir, keep: OWNED_DIR, files: [
    ...binaries.map((b) => ({ rel: b.rel, data: b.bytes })),
    ...files.map((f) => ({ rel: f.file, data: f.text, ...(f.seed ? { seed: true } : {}) })),
  ] });
  if (portability) await writeOut('portability.json', JSON.stringify(portability, null, 2));
  await fs.cp(kernelSrc, path.join(outDir, 'kernel'), { recursive: true });
  for (const k of await fs.readdir(kernelSrc)) {
    written.push({ file: `kernel/${k}`, bytes: (await fs.stat(path.join(kernelSrc, k))).size });
  }
  return written;
}

export async function kernelVersion() {
  return (await fs.readFile(path.join(kernelDir(), 'VERSION'), 'utf8')).trim();
}

/** A standalone world → data + kernel pack at outDir. `posture` is the
 * per-handoff greybox/final declaration (engine-score.js); absent, the
 * world manifest's own `posture` still applies as the durable default. */
export async function buildGodotWorldPack({ ref, outDir, clips = '_all', posture = null, lit = false, humanoid = false, log = () => {} }) {
  const sketch = loadSketch(ref);
  const manifest = refuse(sketch, ref);
  if (manifest.kind === 'game') throw new Error(`'${ref}' is a game — use buildGodotGamePack`);
  const version = await kernelVersion();
  const { kind, exported, score, fig, engine, bus, soundtrack, sound } = await resolveLevel(sketch, { engine: 'godot', clips, posture, lit, figure: true, humanoid });
  // the figure's scene (godot-project.js FIGURE_VIEW_GD): the clip it plays and the authored view that frames it (the
  // score's 'three-quarter' camera, else its first). The ANIME hero's figure adds its clips' designed durations (`s` on
  // the packed clip; hero-gesture heroClipSeconds) and whether its mesh carries the face (anime-face-rig.js; its scene is
  // then FIGURE_FACE_GD), and its view is re-placed to frame the figure over every exported clip (frameFigure; a raised
  // fist stays in frame) before score.json and the emitter read it; every other figure as before.
  const figure = fig ? (() => {
    const [name, f] = fig;
    const clipNames = figureClipNames(clips, f);
    const view = Math.max(0, (score.cameras || []).findIndex((c) => c?.name === 'three-quarter'));
    const anime = manifest.hero?.head === 'anime';
    if (anime && score.cameras?.[view]) score.cameras = score.cameras.map((c, i) => (i === view ? frameFigure(c, f, clipNames, score.metersPerUnit ?? 1) : c));
    return {
      name, clip: figureClip(manifest.recipe?.clips, clipNames), clips: clipNames, view, viewName: score.cameras?.[view]?.name ?? `view ${view}`, joints: f.bones.length,
      // the humanoid's engine skeleton: its joints (the profile's inserted ones and the weightless wrist and ankle leaves
      // among them) and the VRM names its BoneMap maps Godot's humanoid profile onto
      ...(!engine && Array.isArray(f.bones) && isHumanoidRig(f.bones) ? { humanoidRig: true } : {}),
      ...(engine ? figureSkeleton(f, engine) : {}),
      // `ambientOver`: the exported clips the face-only ambient blink layers over (the GLB's names; scene-gltf writes the same)
      ...(anime ? { anime: true, seconds: Object.fromEntries(clipNames.map((c) => [c, f.clips[c].s ?? 1])), face: !!f.face, ambientOver: f.face?.ambient ? clipNames.filter((c) => f.face.ambientOver?.includes(c)).map((c) => `${name}:${c}`) : [] } : {}),
      // the LANDMARK hero's face (western-face-rig.js): the same face scene (figure_face.gd: the authored face on ready, the
      // ambient blink layered); its clips keep their one second and its view as before
      ...(!anime && f.face ? { face: true, ambientOver: f.face.ambient ? clipNames.filter((c) => f.face.ambientOver?.includes(c)).map((c) => `${name}:${c}`) : [] } : {}),
    };
  })() : null;
  log(`resolved '${ref}' (kind ${kind}) — GLB ${exported.byteLength} bytes, ${exported.animationCount ?? 0} animations${figure ? `, the figure '${figure.name}' skinned (${figure.joints} joints, plays ${figure.clip})` : ''}`);
  const binaries = [
    { rel: 'model.glb', bytes: exported.bytes },
    { rel: 'score.json', bytes: JSON.stringify(score, null, 2) },
    // the world's behaviour, beside its score (engine-score.js extractBus): absent behaviour ⇒ no file
    ...(bus ? [{ rel: 'bus.json', bytes: JSON.stringify(bus) }] : []),
    { rel: `recipe/${ref}.json`, bytes: JSON.stringify(manifest, null, 2) },
  ];
  const audioFile = await bedWriter({ binaries, log }).put(score.soundtrack, null, { recipe: soundtrack?.recipe });
  await packSound(sound, { binaries, seen: new Set(), log });
  const portability = assessPortability({ manifest, levels: [{ ref, score }], engine: 'godot' });
  const emitted = emitGodotProject({
    ref, score, manifestHash: packHash(manifest), glbFile: 'model.glb', audioFile,
    kernelVersion: version, remint: `node scripts/export-godot.mjs --ref ${ref}`, figure, portability,
  });
  const written = await writePack({ outDir, binaries, emitted, portability });
  return {
    scope: 'world', ref, dir: outDir, manifestHash: packHash(manifest), kernelVersion: version,
    glbStats: worldGlbStats(exported),
    written, ledger: emitted.ledger, portability, sceneChecks: [], ...(figure ? { figure } : {}),
  };
}

/** A game → menu + gated levels + music beds pack at outDir. `posture`
 * (or the game manifest's own) stamps every level pack-wide. */
export async function buildGodotGamePack({ ref, outDir, clips = '_all', posture = null, lit = false, log = () => {} }) {
  const sketch = loadSketch(ref);
  // A pixelizer game is a reducer, not a scene: it takes the arcade leg
  // (its own kernel, no GLB, a replay probe instead of the scene gates).
  if (sketch.manifest?.engine === 'pixelizer' && sketch.manifest?.kind === 'game') {
    const { buildGodotArcadePack } = await import('./godot-arcade.js');
    return buildGodotArcadePack({ ref, outDir, log });
  }
  const manifest = refuse(sketch, ref);
  const levelSpecs = gameLevels(manifest, ref);
  const posturePack = packPosture(posture, manifest);
  const version = await kernelVersion();

  const music = manifest.music ?? {};
  const battle = Array.isArray(music.battle) ? music.battle : [];
  const battleDb = toDb(music.battleVolume);
  const binaries = [];
  const beds = bedWriter({ binaries, log });

  const seen = new Set();
  const levels = [];
  const glbStats = { levels: {} };
  const sceneChecks = [];
  for (let i = 0; i < levelSpecs.length; i++) {
    const spec = levelSpecs[i];
    const lvSketch = loadSketch(spec.ref);
    const { exported, score, bus, soundtrack, sound } = await resolveLevel(lvSketch, { engine: 'godot', clips, posture: posturePack, lit, figure: true });
    log(`level ${i + 1}/${levelSpecs.length} '${spec.ref}' — GLB ${exported.byteLength} bytes`);
    const own = score.soundtrack;
    const audioFile = own ? await beds.put(own, null, { recipe: soundtrack?.recipe }) : await beds.put(battle[i % Math.max(battle.length, 1)]);
    await packSound(sound, { binaries, seen, log });
    binaries.push({ rel: `levels/${spec.ref}/model.glb`, bytes: exported.bytes });
    binaries.push({ rel: `levels/${spec.ref}/score.json`, bytes: JSON.stringify(score, null, 2) });
    if (bus) binaries.push({ rel: `levels/${spec.ref}/bus.json`, bytes: JSON.stringify(bus) });
    // the level's contract as the web shell reads it (synthesized from mechanics, with its chapters' rows): Game
    // applies the level's outcome against it, and the level maps its bus through its `on` (kernel 0.9.0)
    const contract = levelContract(lvSketch.manifest);
    if (contract) binaries.push({ rel: `levels/${spec.ref}/contract.json`, bytes: JSON.stringify(contract) });
    binaries.push({ rel: `recipe/${spec.ref}.json`, bytes: JSON.stringify(lvSketch.manifest, null, 2) });
    levels.push({ ref: spec.ref, title: spec.title ?? spec.ref, gate: spec.gate ?? null, score, audioFile, audioDb: own ? null : battleDb });
    // a level's rigged figures ship SKINNED (one mesh each, its clips, its face and ink) as a world pack's figure does (since
    // 0.23.0: game packs drew every figure as rigid parts)
    glbStats.levels[spec.ref] = { bytes: exported.byteLength, triangles: exported.triangleCount, animations: exported.animationCount ?? 0, ...(exported.skinnedFigures ? { skinned: exported.skinnedFigures } : {}) };
    sceneChecks.push(`res://levels/${spec.ref}/level.tscn`);
  }
  const menuFile = await beds.put(music.menu);
  // the stingers (game music.victory / music.defeat): one pass each, played by kernel/game.gd when a level ends
  const stingers = [];
  for (const k of ['victory', 'defeat']) {
    if (await beds.put(music[k], `audio/stinger-${k}.wav`, { loop: false })) stingers.push(k);
  }
  binaries.push({ rel: 'game.json', bytes: JSON.stringify(manifest, null, 2) });
  binaries.push({ rel: 'recipe/game.json', bytes: JSON.stringify(manifest, null, 2) });

  const portability = assessPortability({ manifest, levels: levels.map((l) => ({ ref: l.ref, score: l.score })), engine: 'godot' });
  const emitted = emitGodotGame({
    ref, title: manifest.title ?? ref, manifestHash: packHash(manifest), levels,
    store: Array.isArray(manifest.store?.slices) && manifest.store.slices.length > 0,
    music: { menuFile, menuDb: toDb(music.menuVolume), stingers },
    shellExtras: shellExtras(manifest),
    kernelVersion: version, remint: `node scripts/export-godot.mjs --ref ${ref}`, portability,
    ...(manifest.screen != null ? { screen: manifest.screen } : {}),
  });
  const written = await writePack({ outDir, binaries, emitted, portability });
  return {
    scope: 'game', ref, dir: outDir, manifestHash: packHash(manifest), kernelVersion: version,
    glbStats, written, ledger: emitted.ledger, portability, sceneChecks,
  };
}
