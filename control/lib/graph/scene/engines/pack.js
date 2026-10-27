/**
 * THE PACK PIPELINE, engine-neutral: the pieces every engine pack is built from, so the legs compose them instead of
 * each carrying its own copy. A pack is DATA (a GLB, score.json, the recipes, WAV beds) plus the engine's own text
 * (its emitter) plus, for a runtime engine, its kernel. Deterministic: same rows → same pack bytes.
 *
 *   loadSketch(ref)                       the stored row, or a thrown 'not found'
 *   refusePixelizer(sketch, ref, why)     a pixelizer game is a 2D reducer, not a scene: refused, with the leg's reason
 *   packHash(manifest)                    the recipe's identity (engine-score.js manifestIdentity), 16 hex
 *   resolveLevel(sketch, opts)            resolveWorldScene → facesToGlb → the engine's score, the bus, the level's sound
 *   worldGlbStats(exported)               a world pack's GLB readout
 *   gameLevels(manifest, ref)             a game's level list, or a thrown reason
 *   levelContract(manifest)               a level's game contract as the web shell reads it, or null
 *   packPosture(posture, manifest)        explicit wins, else the game's own; a level's own posture applies absent both
 *   shellExtras(manifest)                 the shell keys a game carries that a pack's ledger names
 *   bedWriter({ binaries, log })          WAV beds rendered once per music (and loop), written at every path asked for
 *   emitFolder({ outDir, files, keep })   clean-emit a pack folder (`keep`: a folder the developer owns survives)
 *
 * The legs (godot-pack.js, unity-pack.js; the Blender art pass and the Unreal asset pack take its front) keep what is
 * theirs: their layout, their sidecars, their music policy and their emitter.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { facesToGlb } from '@/lib/graph/scene/scene-gltf';
import { manifestIdentity, extractEngineScore, extractBus, levelSoundtrack } from '../engine-score.js';
import { levelSound } from '../engine-sound.js';
import { renderBed } from '../engine-audio.js';
import { isHumanoidRig, humanoidBonesFor } from '../../polygonizer/figure-humanoid-map.js';
import { tposeRig, withProfileJoints } from '../../figures/rig-tpose.js';
import { synthesizeLevel } from '../../game/level-synth.js';
import { normalizeLevelContract } from '../../game/level-contract.js';

export function loadSketch(ref) {
  const sketch = SketchRepository.getByRef(ref);
  if (!sketch) throw new Error(`sketch '${ref}' not found`);
  return sketch;
}

/** The manifest, unless the row is a pixelizer game (a 2D reducer has no scene); `why` is the leg's own reason. */
export function refusePixelizer(sketch, ref, why) {
  const manifest = sketch?.manifest ?? {};
  if (manifest.engine === 'pixelizer' || manifest.kind === 'pixelizer') throw new Error(`refused: '${ref}' is a pixelizer game — ${why}`);
  return manifest;
}

export const packHash = (manifest) => createHash('sha256').update(JSON.stringify(manifestIdentity(manifest))).digest('hex').slice(0, 16);

/** A world's rigged LAYERED figure (station-loft-rig packLayeredRig: `layered: true`) as [name, figure], else null. */
export const layeredFigure = (payload) => Object.entries(payload?.figures || {}).find(([, f]) => f?.rig === true && f.layered === true) ?? null;

/** The clip a figure plays when nothing drives it (Godot's figure scene, an Unreal asset's preview): `idle` when it
 * has one, else the first clip with more than one key, else the first (a one-key stand holds). */
export function figureClip(recipeClips = {}, names = Object.keys(recipeClips || {})) {
  if (names.includes('idle')) return 'idle';
  return names.find((c) => Array.isArray(recipeClips?.[c]) && recipeClips[c].length > 1) ?? names[0] ?? null;
}

/** A skinned figure's skeleton as its GLB carries it: its joint count; for the engine skeleton (`engine`, the T-pose
 * figure resolveLevel re-rested) the profile's inserted joints and the weightless wrist and ankle leaves among them, and
 * the VRM names a humanoid profile maps onto. */
export function figureSkeleton(f, engine = null) {
  if (!engine) return { joints: f.bones.length };
  const bones = withProfileJoints(engine).bones, { names, leaves } = humanoidBonesFor(bones);
  return { joints: bones.length + leaves.length, humanoid: [...names.values(), ...leaves.map((l) => l.vrm)] };
}

/** The clips of a figure a pack's GLB carries: every one under '_all', those a list names, none otherwise. */
export const figureClipNames = (clips, f) => (clips === '_all' ? Object.keys(f?.clips || {}) : Array.isArray(clips) ? clips.filter((c) => f?.clips?.[c]) : []);

/**
 * A body in two forms (worlds/controllable/forms.js) as an engine takes it: its STARTING form. The page picks an
 * entity's rule from its `forms` when it starts (the named `form` when it is one of them, else the first form with a
 * rule) and changes between them on the transform beat; no engine kernel has forms, so an entity that carries `forms`
 * and no rule of its own enters every engine with its starting form's rule, and the export names the rest as the page's
 * (FIGURE_MARKS.forms). A payload with no such entity is returned as it is, the same object.
 */
export function startingForms(payload) {
  const ents = Array.isArray(payload?.entities) ? payload.entities : null;
  if (!ents || !ents.some((e) => e && e.forms && typeof e.forms === 'object' && !e.rule)) return payload;
  return {
    ...payload,
    entities: ents.map((e) => {
      if (!e || !e.forms || typeof e.forms !== 'object' || e.rule) return e;
      const names = Object.keys(e.forms).filter((k) => e.forms[k] && e.forms[k].rule && e.forms[k].rule.type);
      if (names.length < 2) return e;
      const form = names.includes(e.form) ? e.form : names[0];
      return { ...e, form, rule: { ...e.forms[form].rule } };
    }),
  };
}

/**
 * One level through the seam every engine shares: resolveWorldScene → facesToGlb → the engine's score.
 *   engine    the engine the score's ledger reads the level for (engines/registry.js)
 *   lit       the UNSHADED payload and real PBR materials, so the engine lights it
 *   figure    a rigged layered figure ships SKINNED (one mesh, its clips) when the GLB carries one of its clips
 *   humanoid  that figure ships the engine skeleton (re-rested in the VRM T-pose, its joints VRM-named and nested)
 * → { kind, payload, exported, score, fig, engine: the engine-skeleton figure, bus, soundtrack, sound }
 */
export async function resolveLevel(levelSketch, { engine, clips, posture = null, lit = false, figure = false, humanoid = false }) {
  const { payload: resolved, kind } = await resolveWorldScene(levelSketch, { paint: true, ...(lit ? { unshaded: true } : {}), ...(figure && clips ? { face: true } : {}) });
  const payload = startingForms(resolved);
  if (!payload) {
    throw new Error(`'${levelSketch.ref}': kind '${levelSketch.manifest?.kind ?? kind ?? '?'}' resolves to no traversable scene`);
  }
  const found = figure ? layeredFigure(payload) : null;
  const fig = found && figureClipNames(clips, found[1]).length ? found : null;
  const rest = fig && humanoid && Array.isArray(fig[1].bones) && isHumanoidRig(fig[1].bones) ? (fig[1].tpose ? fig[1] : tposeRig(fig[1])) : null;
  const glbPayload = rest ? { ...payload, figures: { ...payload.figures, [fig[0]]: rest } } : payload;
  const exported = facesToGlb(glbPayload, { generator: `mojulo ${levelSketch.ref}`, ...(clips ? { clips } : {}), ...(fig ? { skinned: true } : {}), ...(rest ? { humanoid: true } : {}), ...(lit ? { lit: true } : {}) });
  const score = extractEngineScore(levelSketch, payload, { posture, engine });
  return { kind, payload, exported, score, fig, engine: rest, bus: extractBus(payload), soundtrack: levelSoundtrack(levelSketch, payload), sound: levelSound(payload.audio, levelSketch.ref) };
}

export const worldGlbStats = (exported) => ({
  bytes: exported.byteLength, nodes: exported.nodeCount, triangles: exported.triangleCount,
  animations: exported.animationCount ?? 0, cameras: exported.cameraCount ?? 0, entities: exported.entityCount ?? 0,
});

/** A game's level list; throws when the row is no game or names no level. */
export function gameLevels(manifest, ref) {
  if (manifest.kind !== 'game') throw new Error(`'${ref}' is not a game (kind '${manifest.kind ?? 'none'}')`);
  const levels = Array.isArray(manifest.levels) ? manifest.levels : [];
  if (!levels.length) throw new Error(`game '${ref}' declares no levels`);
  return levels;
}

/** A level's game contract, as game-resolve.js reads it: synthesized from its mechanics (and its chapters' carry rows),
 * normalized; null when the level carries no `game` channel. */
export function levelContract(manifest) {
  const { game } = synthesizeLevel(manifest || {});
  return game && typeof game === 'object' ? normalizeLevelContract(game) : null;
}

/** The pack-wide posture: explicit wins, else the game manifest's durable default; a level's own applies absent both. */
export const packPosture = (posture, manifest) => posture ?? manifest.posture ?? null;

const SHELL_EXTRAS = ['menu', 'setup', 'difficulty', 'theme', 'front'];
export const shellExtras = (manifest) => SHELL_EXTRAS.filter((k) => manifest[k] != null);

/**
 * WAV beds into a pack's binaries: each music rendered once (per loop setting), written at every path asked for (a
 * game's menu bed is written as menu.wav even when a level already plays the same music).
 *   put(beatsRef, rel?, { recipe?, loop? }) → rel (default audio/<beatsRef>.wav), or null for no music
 */
export function bedWriter({ binaries, log = () => {} }) {
  const rendered = new Map();
  return {
    async put(beatsRef, rel = null, { recipe = null, loop } = {}) {
      if (!beatsRef) return null;
      const at = rel ?? `audio/${beatsRef}.wav`, key = `${beatsRef}\u0000${loop === false ? 'once' : 'loop'}`;
      if (!rendered.has(key)) rendered.set(key, await renderBed(beatsRef, { recipe, log, ...(loop === false ? { loop: false } : {}) }));
      if (!binaries.some((b) => b.rel === at)) binaries.push({ rel: at, bytes: rendered.get(key) });
      return at;
    },
  };
}

/**
 * Clean-emit a pack folder: everything removed and written again, but `keep` (a folder inside the pack the developer
 * owns) survives whole. `files`: [{ rel, data, seed? }] in order; a `seed` file is written only where missing (the
 * developer's copy wins). → [{ file, bytes }] in write order, and the writer for anything the leg adds after.
 */
export async function emitFolder({ outDir, files, keep = null }) {
  const owned = keep ? path.join(outDir, keep) : null, kept = keep ? `${outDir}.${keep}-${process.pid}` : null;
  const hasOwned = owned ? await fs.stat(owned).then((st) => st.isDirectory(), () => false) : false;
  if (hasOwned) { await fs.rm(kept, { recursive: true, force: true }); await fs.rename(owned, kept); }
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });
  if (hasOwned) await fs.rename(kept, owned);
  const written = [];
  const writeOut = async (rel, data) => {
    const abs = path.join(outDir, rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, data);
    written.push({ file: rel, bytes: Buffer.byteLength(data) });
  };
  for (const f of files) {
    if (f.seed && await fs.stat(path.join(outDir, f.rel)).then(() => true, () => false)) continue;
    await writeOut(f.rel, f.data);
  }
  return { written, writeOut };
}
