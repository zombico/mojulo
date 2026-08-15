/**
 * figure-world — the `kind:'figure'` World/export form (interchange.plan.md I2).
 *
 * A stored create_figure sketch is a tiny recipe (pose/proto/garment/motion dials);
 * this assembles it into the standard World payload so `resolveWorldScene` — and
 * therefore the live /world route AND `export_model` — cover it. Two halves ride
 * one payload:
 *
 *   • `faces` — the POSED figure meshed statically (figureRigSamples' rest faces:
 *     the same buildPosedFigure + litFaces solve /svg renders, uncalled so the
 *     orbit camera can go behind it). Flesh AND garments/fluffs/hair all have 3D
 *     form here (they are ring-stacks like the flesh), so the export matches the
 *     depiction. This is what a STATIC export (.glb / .stl, no `clips`) captures.
 *   • `figures.figure` — the SAME body baked as a packed FK rig (bakeRigFigure over
 *     the balanced armature solve), carrying one `forward` clip from the manifest's
 *     motion vocabulary (walk / sprint / wave / emote / keyframes; no motion stored
 *     → the default walk). `export_model({ clips })` (I1) bakes it into glTF
 *     animations — the emoting/walking figure exports ANIMATED.
 *
 * The rig declares `embodies:'body'`: the static `body` face group depicts the same
 * flesh, so the animated export drops it (scene-gltf) instead of shipping a frozen
 * ghost inside the walking figure. Known fidelity limits, accepted at this art
 * style: rigid parts approximate the spine warp's smooth trunk bend (rig-bake.js
 * doctrine), and the /svg mirror convention (screen-x negated) cannot apply in 3D,
 * so left/right read un-mirrored in viewers.
 *
 * Deterministic: pure math over the manifest's dials — no dice, no clock.
 */

import { figureRigSamples, figureWorldCamera } from '../polygonizer/figure-render.js';
import { bakeRigFigure } from './rig-bake.js';
import { resolveFigureSetup } from '../../visual-language/themes.js';

// pose-curve keys per clip — the walkers-channel default (rig-bake bakeProtoformRig).
const FIGURE_RIG_KEYS = 8;

/**
 * assembleFigureScene(manifest, ctx) → World payload { faces, cameras, viewBox,
 * title, bg, figures } for a `kind:'figure'` manifest (WORLD_KINDS resolver).
 */
export function assembleFigureScene(manifest = {}, ctx = {}) {
  const { restFaces, restNodes, nodeFrames } = figureRigSamples(manifest, FIGURE_RIG_KEYS);
  const rig = bakeRigFigure({
    nodesAt: () => restNodes,            // rest solve — clip frames arrive pre-solved
    facesAt: () => restFaces,
    clips: { forward: { nodeFrames } },
    targetH: null,                       // figure-render output is already world-scaled
  });
  rig.embodies = 'body';                 // the static face group below IS this body at rest
  // backdrop follows the /svg setup resolution (renderFigureWorldFrames' convention:
  // a transparent still falls back to the dark world stage).
  const setupBg = manifest.background === false ? 'none' : (resolveFigureSetup(manifest.setup)?.bg ?? '#eef1f4');
  return {
    faces: restFaces.map((f) => ({ ...f, group: 'body' })),
    cameras: [figureWorldCamera(manifest.view)],
    viewBox: { width: 560, height: 760 },
    title: ctx.title || manifest.title || 'mojulo figure',
    bg: setupBg === 'none' ? '#0e1014' : setupBg,
    figures: { figure: rig },
  };
}
