/**
 * Scene forge resolver (scene-promotion.plan.md SP3) — turns a stored scene-motion
 * recipe into the enriched scene + asset providers `renderSceneFrames` needs, by
 * reading ACCEPTED renders from the store: the scene's own plate, and each cast
 * clip's accepted keyframe cels. Runs the completability gate (mcp-promotion Q1):
 * refuse to composite until the plate and every cast clip's body cels are accepted.
 *
 * The cast are keyframe-animation clips (separate sk_ sketches). A cast member's
 * cel for a frame comes from that clip's bound render for the target `key-N`
 * (body) or `key-N/face/<vocab>-<state>` (face variant, else fall back to base).
 * Accepted cels are painted with a plain bg → flood-keyed to transparent here.
 */
import sharp from 'sharp';
import { SketchRepository } from '../../db/repositories/sketches.js';
import { RenderRequestRepository } from '../../db/repositories/render-requests.js';
import { latestBoundRender, boundRenderMap } from './render-store.js';
import { renderTargets, normalizeImageOutcomesManifest, KIND_KEYFRAME_ANIMATION } from './manifest.js';
import { computeCanonical } from './keyframe-emit.js';
import { floodKey } from './parts-bank-spike/key.js';
import { subCelStates } from './pan-cel-spike/sub-cels.js';

/**
 * The face-variant targets a cast member's face tracks DEMAND of its clip —
 * one variant cel per key per non-base state of each active channel. Pure;
 * exported so the completability gate is testable without the store.
 *
 * This closes the silent-fallback hole the Codex talking-phone run rode: a
 * scene declaring blink/speech over a clip with no variant cels used to
 * degrade quietly to the body cel, leaving the declared schedule inert.
 */
export function requiredFaceTargets(face, keys) {
  const out = [];
  const channels = [];
  if (face?.blink) channels.push('blink');
  if (face?.speech?.spans?.length) channels.push('mouth');
  for (const vocab of channels) {
    for (const state of subCelStates(vocab).slice(1)) {
      for (let i = 0; i < keys; i += 1) out.push(`key-${i}/face/${vocab}-${state}`);
    }
  }
  return out;
}

function acceptedTargets(ref) {
  const s = new Set();
  for (const r of RenderRequestRepository.listByRef(ref)) if (r.status === 'accepted') s.add(r.target);
  return s;
}

/**
 * Clip forge resolver (mcp-promotion.plan.md A3) — the standalone-clip
 * counterpart of resolveSceneForge: read ONE keyframe-animation clip's
 * accepted cels from the store and hand back a cel provider for
 * compositeCels. Runs the same completability gate: every render target the
 * manifest declares (body cels + any face-variant cels its blink/speech
 * channels demand) must be accepted first — no silent fallback.
 *
 * Unlike the scene provider, cels are NOT flood-keyed: a bare clip plays on
 * its own painted background.
 *
 * @param clipRef the stored keyframe-animation sketch ref
 * @param km      the normalized manifest (may carry re-time overrides; pass
 *                null to normalize from the stored sketch)
 * @returns { km, cel: async(keyDir, celFile) => Buffer }
 */
export async function resolveClipForge(clipRef, km = null) {
  const sk = SketchRepository.getByRef(clipRef);
  if (!sk || sk.manifest?.kind !== KIND_KEYFRAME_ANIMATION) {
    throw new Error(`'${clipRef}' is not a keyframe-animation clip (mint one via create_sketch kind 'keyframe-animation').`);
  }
  const manifest = km || normalizeImageOutcomesManifest(sk.manifest);
  const targets = renderTargets(manifest);
  const accepted = acceptedTargets(clipRef);
  const missing = targets.filter((t) => !accepted.has(t));
  if (missing.length) {
    throw new Error(
      `clip '${clipRef}' has ${missing.length} unaccepted cel target(s) (${missing.slice(0, 3).join(', ')}${missing.length > 3 ? ', …' : ''}) `
      + '— drive them through the render handoff first: request_image_render → pull_image_render → submit_image_render → accept_image_render.',
    );
  }
  const paths = Object.fromEntries(
    Object.entries(boundRenderMap(clipRef, targets)).map(([t, v]) => [t, v.path]),
  );
  for (const t of targets) {
    if (!paths[t]) throw new Error(`clip '${clipRef}' target '${t}' accepted but no render on disk`);
  }

  const canvas = { width: manifest.canvas.width, height: manifest.canvas.height };
  const cache = new Map();
  const cel = async (keyDir, celFile) => {
    let target = keyDir;
    if (celFile && celFile !== 'cel.png') {
      target = `${keyDir}/face/${celFile.replace(/^face\//, '').replace(/\.png$/, '')}`;
    }
    const filePath = paths[target] || paths[keyDir];
    if (cache.has(filePath)) return cache.get(filePath);
    const buf = await sharp(filePath)
      .resize({ width: canvas.width, height: canvas.height, fit: 'fill' })
      .flatten({ background: '#add0eb' })
      .png()
      .toBuffer();
    cache.set(filePath, buf);
    return buf;
  };

  return { km: manifest, cel };
}

/**
 * @param scene   a normalized scene-motion manifest
 * @param sceneRef the stored scene sketch ref (the plate rides its render seam)
 * @returns { scene: enriched, plate: Buffer, cel: async(clipRef,keyDir,celFile)=>Buffer }
 */
export async function resolveSceneForge(scene, sceneRef) {
  if (!sceneRef) throw new Error('scene forge requires a stored scene_ref (the plate rides the render-handoff seam)');

  // ── plates (the scene's own accepted plate renders: the base 'plate' plus one
  // 'plate-shot-<i>' per cross-cut shot that carries its own stage) ──
  const sceneAccepted = acceptedTargets(sceneRef);
  const plateBufs = new Map();
  for (const target of renderTargets(scene)) {
    if (!sceneAccepted.has(target)) {
      throw new Error(`scene '${sceneRef}' target '${target}' is not accepted — request_image_render, submit the painted plate, and accept it first.`);
    }
    const bound = latestBoundRender(sceneRef, target);
    if (!bound) throw new Error(`scene '${sceneRef}' target '${target}' accepted but no render on disk`);
    const stage = target === 'plate' ? scene.stage : scene.shots[Number(target.slice('plate-shot-'.length))].stage;
    plateBufs.set(stage.plate.ref, await sharp(bound.path)
      .resize({ width: stage.plate.width, height: stage.plate.height, fit: 'fill' })
      .ensureAlpha().png().toBuffer());
  }
  const plate = async (plateRef) => plateBufs.get(plateRef) || null;

  // ── cast clips (accepted keyframe cels) ──
  const clipInfo = {};
  for (const c of scene.cast) {
    if (clipInfo[c.clipRef]) continue;
    const sk = SketchRepository.getByRef(c.clipRef);
    if (!sk || sk.manifest?.kind !== KIND_KEYFRAME_ANIMATION) {
      throw new Error(`scene cast '${c.id}' clipRef '${c.clipRef}' is not a keyframe-animation clip`);
    }
    const km = normalizeImageOutcomesManifest(sk.manifest);
    const targets = renderTargets(km);
    const accepted = acceptedTargets(c.clipRef);
    const bodyTargets = targets.filter((t) => /^key-\d+$/.test(t));
    const missing = bodyTargets.filter((t) => !accepted.has(t));
    if (missing.length) {
      throw new Error(`scene cast '${c.id}' clip '${c.clipRef}' has ${missing.length} unaccepted body cel(s) (${missing.slice(0, 3).join(', ')}…) — finish the clip first.`);
    }
    const canonical = await computeCanonical({ canvas: km.canvas });
    clipInfo[c.clipRef] = {
      km,
      accepted,
      paths: Object.fromEntries(Object.entries(boundRenderMap(c.clipRef, targets)).map(([t, v]) => [t, v.path])),
      clip: { width: km.canvas.width, height: km.canvas.height, cx: km.canvas.width / 2, groundY: canonical.ground, span: canonical.span },
    };
  }

  // ── face-variant completability (per cast member, not per clip) ──
  // A declared face track must be BACKED by accepted variant cels on its clip;
  // the schedule never silently falls back to the body cel.
  for (const c of scene.cast) {
    if (!c.face) continue;
    const info = clipInfo[c.clipRef];
    const required = requiredFaceTargets(c.face, info.km.keys);
    const missingFace = required.filter((t) => !info.accepted.has(t));
    if (missingFace.length) {
      throw new Error(
        `scene cast '${c.id}' declares a face track but clip '${c.clipRef}' is missing ${missingFace.length} accepted `
        + `face-variant cel(s) (${missingFace.slice(0, 3).join(', ')}…). Either finish those variants through the render `
        + 'handoff (the clip must be minted with blink/speech so the targets exist), or drop the face track from the cast entry.',
      );
    }
  }

  const enrichedCast = scene.cast.map((c) => ({ ...c, cels: clipInfo[c.clipRef].km.keys, clip: clipInfo[c.clipRef].clip }));

  // cel provider: flood-keyed accepted cel for (clipRef, key-N, cel.png | face/<v>-<s>.png)
  const keyed = new Map();
  const cel = async (clipRef, keyDir, celFile) => {
    const info = clipInfo[clipRef];
    let target = keyDir;
    if (celFile && celFile !== 'cel.png') {
      const variant = celFile.replace(/^face\//, '').replace(/\.png$/, '');
      const faceTarget = `${keyDir}/face/${variant}`;
      if (info.paths[faceTarget]) target = faceTarget;
    }
    const filePath = info.paths[target] || info.paths[keyDir];
    if (keyed.has(filePath)) return keyed.get(filePath);
    const canvas = { width: info.km.canvas.width, height: info.km.canvas.height };
    const raw = await sharp(filePath).resize({ width: canvas.width, height: canvas.height, fit: 'fill' }).ensureAlpha().raw().toBuffer();
    floodKey(raw, canvas);
    const buf = await sharp(raw, { raw: { width: canvas.width, height: canvas.height, channels: 4 } }).png().toBuffer();
    keyed.set(filePath, buf);
    return buf;
  };

  return { scene: { ...scene, cast: enrichedCast }, plate, cel };
}
