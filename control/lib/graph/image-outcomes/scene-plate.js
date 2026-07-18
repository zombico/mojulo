/**
 * Scene-motion PLATE — the sharp-backed seam helpers (scene-promotion.plan.md
 * SP2), the analog of keyframe's guide-emit + `meruAuditCelPng`:
 *  - `emitStageGuidePng` — the STAGE GUIDE the render packet serves as the plate
 *    target's scaffold (the declared ground plane the worker paints over).
 *  - `auditStagePlatePng` — the submit-seam MACHINE gate (dims / magenta removed /
 *    sky≠ground). The register/scale READ stays the accepting agent's eyes over
 *    the overlay; this is only the machine half.
 * The pure geometry + audit predicates live in keyframe-spike/stage-guide.js.
 */
import sharp from 'sharp';
import { buildStageGuide, stageGuideSvg, auditStagePlate } from './keyframe-spike/stage-guide.js';
import { parseSceneTarget } from './manifest.js';

// A plate target names its stage: the base 'plate' → manifest.stage; a
// cross-cut 'plate-shot-<i>' → that shot's own stage.
function stageForTarget(manifest, target) {
  return parseSceneTarget(manifest, target ?? 'plate').stage || manifest.stage;
}

/** The plate target's scaffold: the declared-ground-plane guide PNG. */
export async function emitStageGuidePng(manifest, { depthTicks, target } = {}) {
  const guide = buildStageGuide(stageForTarget(manifest, target), { frame: manifest.frame, ...(depthTicks ? { depthTicks } : {}) });
  return sharp(Buffer.from(stageGuideSvg(guide))).png().toBuffer();
}

/** Submit-seam machine gate for a submitted plate PNG. @param manifest normalized scene-motion. */
export async function auditStagePlatePng(bytes, manifest, { target } = {}) {
  const guide = buildStageGuide(stageForTarget(manifest, target), { frame: manifest.frame });
  const img = sharp(bytes).ensureAlpha();
  const { width, height } = await img.metadata();
  const raw = await img.raw().toBuffer();
  const audit = auditStagePlate(raw, width, height, guide);
  const retry = audit.pass ? null
    : `plate audit failed — ${audit.dims ? '' : `dimensions must be ${guide.width}×${guide.height}; `}`
      + `${audit.linesRemoved ? '' : `magenta guide marks NOT removed (leak ${audit.leakFrac})`}`.trim();
  return { audit, retry };
}
