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

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { figureRigSamples, figureWorldCamera, animalWorldFaces, animalWorldCamera } from '../polygonizer/figure-render.js';
import { atlasLayout, remapFacesToAtlas } from '../polygonizer/skin-atlas.js';
import { facesToSplats } from '../polygonizer/field-splats.js';
import { skinDir } from '../polygonizer/skin-store.js';
import { bakeRigFigure } from './rig-bake.js';
import { resolveFigureSetup } from '../../visual-language/themes.js';

// pose-curve keys per clip — the walkers-channel default (rig-bake bakeProtoformRig).
const FIGURE_RIG_KEYS = 8;

/**
 * assembleFigureScene(manifest, ctx) → World payload { faces, cameras, viewBox,
 * title, bg, figures } for a `kind:'figure'` manifest (WORLD_KINDS resolver).
 */
// A bound ATLAS page (skin-over-mesh.plan.md phase 2b): `manifest.skin.atlas`
// names an append-only `atlas-<n>.png` in the sketch's outcome folder. The
// layout is a pure function of the faces, so it re-derives here and the faces
// remap into atlas space; the page rides payload.textures. Degrades cleanly:
// file missing → the phase-1 skin (or plain flesh) renders unchanged.
function bindAtlas(manifest, ref, restFaces) {
  const bind = manifest.skin && manifest.skin.atlas;
  if (!bind || !Number.isInteger(bind.n) || !ref) return null;
  const file = path.join(skinDir(ref), `atlas-${bind.n}.png`);
  if (!existsSync(file)) return null;
  const layout = atlasLayout(restFaces, { page: bind.page || 1024, gutter: bind.gutter ?? 8 });
  return {
    faces: remapFacesToAtlas(restFaces, layout, { texture: 'skin-atlas', lit: !!bind.lit }),
    textures: { 'skin-atlas': `data:image/png;base64,${readFileSync(file).toString('base64')}` },
  };
}

// atlas mode needs uv+island tags even when the recipe never opted into a
// phase-1 tile — synthesize the default key (mirrors the tool-side rule).
// Exported for the animal World form (animal-world.js), which shares the
// whole wearing seam.
export function atlasAwareManifest(manifest) {
  if (!(manifest.skin && manifest.skin.atlas) || typeof manifest.skin.texture === 'string') return manifest;
  return { ...manifest, skin: { ...manifest.skin, texture: 'skin-atlas' } };
}

/** Bind + degrade in one move: the bound page's remapped faces + textures, or
 * the input faces with dangling synthesized-atlas tags stripped. */
export function wearAtlas(manifest, ref, faces) {
  const atlas = bindAtlas(manifest, ref, faces);
  if (atlas) return atlas;
  if (manifest.skin && manifest.skin.texture === 'skin-atlas') {
    return { faces: faces.map(({ texture, uv, textureLit, island, ...rest }) => rest), textures: null };
  }
  return { faces, textures: null };
}

export function assembleFigureScene(manifest = {}, ctx = {}) {
  manifest = atlasAwareManifest(manifest);
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
  const worn = wearAtlas(manifest, ctx.ref, restFaces);
  return {
    faces: worn.faces.map((f) => ({ ...f, group: 'body' })),
    cameras: [figureWorldCamera(manifest.view)],
    viewBox: { width: 560, height: 760 },
    title: ctx.title || manifest.title || 'mojulo figure',
    bg: setupBg === 'none' ? '#0e1014' : setupBg,
    figures: { figure: rig },
    ...(worn.textures ? { textures: worn.textures } : {}),
  };
}

/**
 * assembleAnimalScene — the `kind:'animal'` World/export form (the
 * skin-over-mesh phase-1 open item, closed): the same buildAnimal recipe the
 * SVG study renders, meshed un-culled into a traversable World payload — so
 * /world, export_model (.glb/.stl), the engine packs, `manifest.skin`
 * surface textures, and the atlas wrap loop all cover animals with zero new
 * transport. No rig half yet: animals pose statically (the gait track is the
 * animal sibling of renderer-ladder rung 2, not this seam).
 */
export function assembleAnimalScene(manifest = {}, ctx = {}) {
  manifest = atlasAwareManifest(manifest);
  const { faces } = animalWorldFaces(manifest);
  const worn = wearAtlas(manifest, ctx.ref, faces);
  const bodyFaces = worn.faces.map((f) => ({ ...f, group: 'body' }));
  return {
    faces: bodyFaces,
    ...(resolveCoatSplats(manifest, bodyFaces) || {}),
    cameras: [animalWorldCamera(faces, manifest.view)],
    viewBox: { width: 560, height: 760 },
    title: ctx.title || manifest.title || 'mojulo animal',
    bg: manifest.background === false ? '#0e1014' : '#eef1f4',
    ...(worn.textures ? { textures: worn.textures } : {}),
  };
}

/**
 * FUR (field-splats.plan.md phase 3): `opts.coat.fur` grows a gaussian coat off the
 * animal's own body faces. Those faces came from the skin FIELD via the surface net
 * (figure-animal-skin.js animalSkinWatertight), so their centroids are a uniform
 * sampling of the iso-surface and their `outNormal` is the field gradient — the coat
 * is field-derived even though it is grown here, downstream of planting and lighting.
 * Growing it here rather than at the field is what lets it inherit the body's FINAL
 * colour, which is load-bearing: a coat over a body painted a different colour reads as
 * a halo, because the opaque body eats the dense inner shells and only the silhouette
 * accumulation survives. The body IS the innermost shell.
 *
 * Absent `coat.fur`, this contributes nothing — no `splats` key, and the payload is the
 * one every existing animal already resolved to.
 */
function resolveCoatSplats(manifest, bodyFaces) {
  const coat = manifest && manifest.opts && manifest.opts.coat;
  const fur = coat && coat !== true && coat.fur;
  if (!fur) return null;
  const spec = fur === true ? {} : fur;
  const splats = facesToSplats(bodyFaces, {
    // the coat's own colour defaults to the paint coat's, so `fur: true` is a
    // one-word ask that still lands in the right family — and the same colour
    // marks WHERE the fur grows, so paw pads, nose and eyes stay bare
    ...(typeof coat.color === 'string' ? { color: coat.color, likeColor: coat.color } : {}),
    ...spec,
  });
  return splats.length ? { splats } : null;
}
