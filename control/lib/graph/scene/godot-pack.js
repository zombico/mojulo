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
import { createHash } from 'node:crypto';
import { manifestIdentity } from './engine-score.js';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { facesToGlb } from '@/lib/graph/scene/scene-gltf';
import { extractEngineScore } from './engine-score.js';
import { emitGodotProject, emitGodotGame } from './godot-project.js';
import { assessPortability } from './engine-portability.js';

// cwd-anchored (the control process and the CLI both run from control/) —
// lib files may be bundled, so import.meta-relative paths are not reliable.
const kernelDir = () => path.join(process.cwd(), 'lib', 'graph', 'scene', 'godot-kernel');

const hashOf = (m) => createHash('sha256').update(JSON.stringify(manifestIdentity(m))).digest('hex').slice(0, 16);
const toDb = (v) => (Number.isFinite(v) && v > 0 ? 20 * Math.log10(v) : null);

function refuse(sketch, ref) {
  const manifest = sketch?.manifest ?? {};
  if (manifest.engine === 'pixelizer' || manifest.kind === 'pixelizer') {
    throw new Error(`refused: '${ref}' is a pixelizer game — a 2D reducer is not a scene; it takes the arcade leg (export_game { target: 'godot' } on the game row)`);
  }
  return manifest;
}

/** A world's rigged LAYERED figure (station-loft-rig packLayeredRig: `layered: true`) as [name, figure], else null. */
export const layeredFigure = (payload) => Object.entries(payload?.figures || {}).find(([, f]) => f?.rig === true && f.layered === true) ?? null;

/** The clips of a figure the pack's GLB carries: every one under '_all', those a list names, none otherwise. */
const figureClipNames = (clips, f) => (clips === '_all' ? Object.keys(f?.clips || {}) : Array.isArray(clips) ? clips.filter((c) => f?.clips?.[c]) : []);

/** The clip a figure's scene plays: `idle` when it has one, else the first clip with more than one key, else the first
 * (a one-key stand holds). */
export function figureClip(recipeClips = {}, names = Object.keys(recipeClips || {})) {
  if (names.includes('idle')) return 'idle';
  return names.find((c) => Array.isArray(recipeClips?.[c]) && recipeClips[c].length > 1) ?? names[0] ?? null;
}

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

async function resolveLevel(levelSketch, { clips, posture = null, lit = false, figure = false }) {
  // `lit` (lit-handoff.plan.md): the UNSHADED payload + real PBR materials, so the engine lights it
  const { payload, kind } = await resolveWorldScene(levelSketch, { ...(lit ? { unshaded: true } : {}), ...(figure && clips ? { face: true } : {}) });
  if (!payload) {
    throw new Error(`'${levelSketch.ref}': kind '${levelSketch.manifest?.kind ?? kind ?? '?'}' resolves to no traversable scene`);
  }
  // a standalone world whose figure is a rigged layered solid ships it SKINNED (one mesh, its clips: the bytes export_model
  // { clips, skinned: true } writes) instead of rigid per-bone parts, when the GLB carries at least one of its clips;
  // every other payload as before
  const found = figure ? layeredFigure(payload) : null;
  const fig = found && figureClipNames(clips, found[1]).length ? found : null;
  const exported = facesToGlb(payload, { generator: `mojulo ${levelSketch.ref}`, ...(clips ? { clips } : {}), ...(fig ? { skinned: true } : {}), ...(lit ? { lit: true } : {}) });
  const score = extractEngineScore(levelSketch, payload, { posture });
  return { kind, exported, score, fig };
}

/** Clean-emit a pack folder: binaries + emitted text + (optional) portability
 * + a kernel dir copied verbatim. Shared with the arcade leg (godot-arcade.js),
 * which brings its own kernel and no engine-score portability. */
export async function writePack({ outDir, binaries, emitted, portability = null, kernelSrc = kernelDir() }) {
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
  if (portability) await writeOut('portability.json', JSON.stringify(portability, null, 2));
  const src = kernelSrc;
  await fs.cp(src, path.join(outDir, 'kernel'), { recursive: true });
  for (const k of await fs.readdir(src)) {
    written.push({ file: `kernel/${k}`, bytes: (await fs.stat(path.join(src, k))).size });
  }
  return written;
}

export async function kernelVersion() {
  return (await fs.readFile(path.join(kernelDir(), 'VERSION'), 'utf8')).trim();
}

/** A standalone world → data + kernel pack at outDir. `posture` is the
 * per-handoff greybox/final declaration (engine-score.js); absent, the
 * world manifest's own `posture` still applies as the durable default. */
export async function buildGodotWorldPack({ ref, outDir, clips = '_all', posture = null, lit = false, log = () => {} }) {
  const sketch = SketchRepository.getByRef(ref);
  if (!sketch) throw new Error(`sketch '${ref}' not found`);
  const manifest = refuse(sketch, ref);
  if (manifest.kind === 'game') throw new Error(`'${ref}' is a game — use buildGodotGamePack`);
  const version = await kernelVersion();
  const { kind, exported, score, fig } = await resolveLevel(sketch, { clips, posture, lit, figure: true });
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
      // `ambientOver`: the exported clips the face-only ambient blink layers over (the GLB's names; scene-gltf writes the same)
      ...(anime ? { anime: true, seconds: Object.fromEntries(clipNames.map((c) => [c, f.clips[c].s ?? 1])), face: !!f.face, ambientOver: f.face?.ambient ? clipNames.filter((c) => f.face.ambientOver?.includes(c)).map((c) => `${name}:${c}`) : [] } : {}),
    };
  })() : null;
  log(`resolved '${ref}' (kind ${kind}) — GLB ${exported.byteLength} bytes, ${exported.animationCount ?? 0} animations${figure ? `, the figure '${figure.name}' skinned (${figure.joints} joints, plays ${figure.clip})` : ''}`);
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
  const portability = assessPortability({ manifest, levels: [{ ref, score }] });
  const emitted = emitGodotProject({
    ref, score, manifestHash: hashOf(manifest), glbFile: 'model.glb', audioFile,
    kernelVersion: version, remint: `node scripts/export-godot.mjs --ref ${ref}`, figure,
  });
  const written = await writePack({ outDir, binaries, emitted, portability });
  return {
    scope: 'world', ref, dir: outDir, manifestHash: hashOf(manifest), kernelVersion: version,
    glbStats: {
      bytes: exported.byteLength, nodes: exported.nodeCount, triangles: exported.triangleCount,
      animations: exported.animationCount ?? 0, cameras: exported.cameraCount ?? 0, entities: exported.entityCount ?? 0,
    },
    written, ledger: emitted.ledger, portability, sceneChecks: [], ...(figure ? { figure } : {}),
  };
}

/** A game → menu + gated levels + music beds pack at outDir. `posture`
 * (or the game manifest's own) stamps every level pack-wide. */
export async function buildGodotGamePack({ ref, outDir, clips = '_all', posture = null, lit = false, log = () => {} }) {
  const sketch = SketchRepository.getByRef(ref);
  if (!sketch) throw new Error(`sketch '${ref}' not found`);
  // A pixelizer game is a reducer, not a scene: it takes the arcade leg
  // (its own kernel, no GLB, a replay probe instead of the scene gates).
  if (sketch.manifest?.engine === 'pixelizer' && sketch.manifest?.kind === 'game') {
    const { buildGodotArcadePack } = await import('./godot-arcade.js');
    return buildGodotArcadePack({ ref, outDir, log });
  }
  const manifest = refuse(sketch, ref);
  if (manifest.kind !== 'game') throw new Error(`'${ref}' is not a game (kind '${manifest.kind ?? 'none'}')`);
  const levelSpecs = Array.isArray(manifest.levels) ? manifest.levels : [];
  if (!levelSpecs.length) throw new Error(`game '${ref}' declares no levels`);
  // pack-wide declaration: explicit wins, else the GAME manifest's durable
  // default; a level manifest's own posture still applies absent both.
  const packPosture = posture ?? manifest.posture ?? null;
  const version = await kernelVersion();

  const music = manifest.music ?? {};
  const battle = Array.isArray(music.battle) ? music.battle : [];
  const battleDb = toDb(music.battleVolume);
  const binaries = [];
  const beds = new Map();
  const bed = async (beatsRef) => {
    if (!beatsRef) return null;
    if (!beds.has(beatsRef)) {
      binaries.push({ rel: `audio/${beatsRef}.wav`, bytes: await renderBeats(beatsRef, log) });
      beds.set(beatsRef, `audio/${beatsRef}.wav`);
    }
    return beds.get(beatsRef);
  };

  const levels = [];
  const glbStats = { levels: {} };
  const sceneChecks = [];
  for (let i = 0; i < levelSpecs.length; i++) {
    const spec = levelSpecs[i];
    const lvSketch = SketchRepository.getByRef(spec.ref);
    if (!lvSketch) throw new Error(`level '${spec.ref}' not found`);
    const { exported, score } = await resolveLevel(lvSketch, { clips, posture: packPosture, lit });
    log(`level ${i + 1}/${levelSpecs.length} '${spec.ref}' — GLB ${exported.byteLength} bytes`);
    const own = score.soundtrack;
    const audioFile = await bed(own ?? battle[i % Math.max(battle.length, 1)]);
    binaries.push({ rel: `levels/${spec.ref}/model.glb`, bytes: exported.bytes });
    binaries.push({ rel: `levels/${spec.ref}/score.json`, bytes: JSON.stringify(score, null, 2) });
    binaries.push({ rel: `recipe/${spec.ref}.json`, bytes: JSON.stringify(lvSketch.manifest, null, 2) });
    levels.push({ ref: spec.ref, title: spec.title ?? spec.ref, gate: spec.gate ?? null, score, audioFile, audioDb: own ? null : battleDb });
    glbStats.levels[spec.ref] = { bytes: exported.byteLength, triangles: exported.triangleCount, animations: exported.animationCount ?? 0 };
    sceneChecks.push(`res://levels/${spec.ref}/level.tscn`);
  }
  const menuFile = await bed(music.menu);
  binaries.push({ rel: 'game.json', bytes: JSON.stringify(manifest, null, 2) });
  binaries.push({ rel: 'recipe/game.json', bytes: JSON.stringify(manifest, null, 2) });

  const portability = assessPortability({ manifest, levels: levels.map((l) => ({ ref: l.ref, score: l.score })) });
  const emitted = emitGodotGame({
    ref, title: manifest.title ?? ref, manifestHash: hashOf(manifest), levels,
    music: { menuFile, menuDb: toDb(music.menuVolume) },
    shellExtras: ['menu', 'setup', 'difficulty', 'theme'].filter((k) => manifest[k] != null),
    kernelVersion: version, remint: `node scripts/export-godot.mjs --ref ${ref}`,
  });
  const written = await writePack({ outDir, binaries, emitted, portability });
  return {
    scope: 'game', ref, dir: outDir, manifestHash: hashOf(manifest), kernelVersion: version,
    glbStats, written, ledger: emitted.ledger, portability, sceneChecks,
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
