import {
  bbox,
  bottomPoint,
  centroid,
  clipBand,
  clipHalfPlane,
  dot,
  normalize,
} from './geometry.js';
import { annotateMarksWithConstellation, constellationDebugMarks } from '../polygonizer/constellation.js';
import { expandArabesque } from '../polygonizer/arabesque.js';
import { runAuthorshipPreview } from '../rendrant/authorship-preview.js';
import { deriveMaterialContracts, summarizeMaterialContracts } from '../rendrant/material-contracts.js';
import { findMandalaBlock, projectMandalaBlock, projectMandalaPoint, projectTwoPoint, withGeneratedElementMandala, withResolvedWorldCamera } from '../polygonizer/pure-mandala.js';
import { resolveShotGlyph } from '../polygonizer/mandala-patterns.js';
import { resolveRoomSceneElementPlan, projectRoomHeightManjis } from '../polygonizer/room-scene-elements.js';
import { buildFurnitureNet, normalizeFurnitureStyle } from '../polygonizer/furniture-net.js';
import { cardinalManji3D, evaluateManji3D, inscribedCuboid } from '../polygonizer/manji.js';

const PALETTES = {
  'warm-low-key': {
    base: '#c8a978',
    shadow: '#372819',
    core: '#21170f',
    deepest: '#120c08',
    cast: '#24190f',
    highlight: '#fff3ce',
  },
};

export function expandNeoRembrandt(manifest, { includeHighlights = true } = {}) {
  if (!manifest || typeof manifest !== 'object') return manifest;
  const meruResolvedManifest = resolveMeruAlias(manifest);
  const shotGlyphResolvedManifest = resolveShotGlyphs(meruResolvedManifest);
  const cameraResolvedManifest = withGeneratedElementMandala(ensureFormConstellation(resolveTwoPointCameraPrimitive(withResolvedWorldCamera(shotGlyphResolvedManifest))));
  const lightResolvedManifest = resolveMetamandalaLightScene(cameraResolvedManifest);
  const sourceMarks = Array.isArray(lightResolvedManifest.marks) ? lightResolvedManifest.marks : null;
  if (!sourceMarks) return lightResolvedManifest;

  // PR-C: refuse expansion early when authorship preview blocks under
  // materializationGate === 'planning-valid'. All 7 gating checks are
  // manifest-only, so this short-circuits before any expensive mark work.
  const authorshipPreview = runAuthorshipPreview(lightResolvedManifest);
  if (authorshipPreview.verdict === 'blocked' && authorshipPreview.gateActive) {
    return refuseExpansionWithDiagnostics(lightResolvedManifest, authorshipPreview, includeHighlights);
  }

  const scene = lightResolvedManifest.scene || {};
  const palette = PALETTES[scene.palette] || PALETTES['warm-low-key'];
  const skeletonResolvedSourceMarks = synthesizeDynamicSkeletonMarks(sourceMarks, lightResolvedManifest.gesture, scene);
  const constructionResolvedMarks = resolveConstructionMarks(skeletonResolvedSourceMarks, scene, lightResolvedManifest);
  const gestureResolvedMarks = resolveGestureMarks(constructionResolvedMarks, lightResolvedManifest.gesture);
  const preFacePatternSourceMarks = assignViewDepthZ(
    gestureResolvedMarks.flatMap((mark, index) => expandCompactSourceMarks(mark, index, scene, lightResolvedManifest)),
    scene,
  );
  const expandedSourceMarks = resolveFacePatternMarks(preFacePatternSourceMarks, scene);
  const marks = [];

  for (const mark of expandedSourceMarks) {
    marks.push(materializeSourceMark(mark, palette));
    if (isShadowAlgorithm(mark?.shade?.algorithm)) {
      marks.push(...convexValueStack(mark, scene, palette));
    }
  }

  marks.push(...interBlobCastShadows(expandedSourceMarks, scene, palette));

  if (includeHighlights) {
    for (const mark of expandedSourceMarks) {
      if (isHighlightAlgorithm(mark?.highlights?.algorithm)) {
        marks.push(...simpleHighlight(mark, scene, palette));
      }
    }
  }
  const annotatedMarks = annotateMarksWithConstellation(marks, lightResolvedManifest.polygonizer?.constellation);
  const debugMarks = constellationDebugMarks(lightResolvedManifest.polygonizer?.constellation);
  const mandalaCameraWindow = resolveMandalaCameraWindow(lightResolvedManifest);
  const metamandalaLighting = resolveMetamandalaLighting(lightResolvedManifest);
  const depthOrderedMarks = applyConstellationBackToFrontPaintOrder(
    annotatedMarks.concat(debugMarks, mandalaCameraWindow.debugMarks, metamandalaLighting.debugMarks),
    lightResolvedManifest,
  );
  const finalMarks = applyGridRenderStyleContract(
    depthOrderedMarks,
    lightResolvedManifest,
  );
  const preDiffusionContactMarks = annotateContactRegions(finalMarks);
  const diffusion = applyMetamandalaLightDiffusion(preDiffusionContactMarks, lightResolvedManifest);
  const contactAnnotatedMarks = diffusion.applied
    ? annotateContactRegions(diffusion.marks)
    : preDiffusionContactMarks;
  const metamandala = resolveMetamandalaSurfaces(contactAnnotatedMarks, lightResolvedManifest);
  const relaxation = applyMetamandalaRelaxation(contactAnnotatedMarks, metamandala.surfaces, lightResolvedManifest);
  const relaxedContactMarks = relaxation.applied
    ? annotateContactRegions(relaxation.marks)
    : contactAnnotatedMarks;
  const relaxedMetamandala = relaxation.applied
    ? resolveMetamandalaSurfaces(relaxedContactMarks, lightResolvedManifest)
    : metamandala;
  const marksWithMetamandala = relaxedContactMarks.concat(relaxedMetamandala.debugMarks);
  const contactReport = validateContactChecks(marksWithMetamandala, lightResolvedManifest, relaxedMetamandala.surfaces);
  const shotContract = freezeShotContract(lightResolvedManifest);
  const spatialPlan = deriveSpatialPlan(lightResolvedManifest, {
    cameraWindow: mandalaCameraWindow.window,
    lighting: metamandalaLighting.lighting,
    diffusion,
    surfaces: relaxedMetamandala.surfaces,
    relaxation,
    contactReport,
    marks: relaxedContactMarks,
    shotContract,
  });
  const plannedMarks = applySpatialPlanMaterialization(marksWithMetamandala, spatialPlan);
  const abstractConstellation = deriveAbstractConstellation(lightResolvedManifest);
  const physicalHitboxes = derivePhysicalHitboxes({
    spatialPlan,
    contactReport,
    manifest: lightResolvedManifest,
  });
  const materialContracts = deriveMaterialContracts({ marks: plannedMarks });
  const materialContractsSummary = summarizeMaterialContracts(materialContracts);
  const consensusChain = deriveConsensusChainMetadata({
    manifest: lightResolvedManifest,
    spatialPlan,
    relaxation,
    expandedSourceMarks,
    constructionResolvedMarks,
    abstractConstellation,
    physicalHitboxes,
    shotContract,
    shotContractFit: spatialPlan?.shotContractFit || null,
    authorshipPreview,
    materialContracts,
    materialContractsSummary,
  });

  return {
    ...lightResolvedManifest,
    marks: plannedMarks.sort((a, b) => (a.z ?? 0) - (b.z ?? 0)),
    neoRembrandt: {
      expanded: true,
      includeHighlights,
      sourceMarkCount: sourceMarks.length,
      dynamicSkeletonGenerated: skeletonResolvedSourceMarks.length !== sourceMarks.length,
      dynamicSkeletonMarkCount: skeletonResolvedSourceMarks.filter((mark) => mark?.dynamicSkeleton).length,
      constructionMarkCount: sourceMarks.filter((mark) => isConstructionMark(mark)).length,
      constructionResolvedMarkCount: constructionResolvedMarks.length,
      polygonizerSubject: lightResolvedManifest.polygonizer?.subject,
      gestureResolved: gestureResolvedMarks.some((mark) => mark?.gestureResolved),
      expandedSourceMarkCount: expandedSourceMarks.length,
      expandedMarkCount: plannedMarks.length,
      constellationAnnotatedMarkCount: annotatedMarks.filter((mark) => mark?.constellationRole).length,
      constellationDebugMarkCount: debugMarks.length,
      spatialPlan,
      spatialPlanValid: spatialPlan.validation.ok,
      spatialPlanStageCount: spatialPlan.stages.length,
      spatialPlanMaterializationGate: spatialPlan.materializationGate,
      chain: consensusChain.chain,
      authorshipPreview: consensusChain.authorshipPreview,
      preflight: consensusChain.preflight,
      reconciliation: consensusChain.reconciliation,
      materialContracts,
      materialContractsSummary,
      abstractConstellation,
      physicalHitboxes,
      shotContract,
      shotContractFit: spatialPlan?.shotContractFit || null,
      mandalaCameraWindow: mandalaCameraWindow.window,
      mandalaCameraWindowDebugMarkCount: mandalaCameraWindow.debugMarks.length,
      metamandalaLighting: metamandalaLighting.lighting,
      metamandalaLightDebugMarkCount: metamandalaLighting.debugMarks.length,
      metamandalaLightDiffusion: diffusion.report,
      metamandalaLightDiffusionApplied: diffusion.applied,
      metamandalaLightDiffusionHitCount: diffusion.report?.hitCount || 0,
      metamandalaLightDiffusionRayCount: diffusion.report?.rayCount || 0,
      metamandalaSurfaceCount: relaxedMetamandala.surfaces.length,
      metamandalaSurfaces: relaxedMetamandala.surfaces,
      metamandalaDebugMarkCount: relaxedMetamandala.debugMarks.length,
      metamandalaRelaxationApplied: relaxation.applied,
      metamandalaRelaxationAdjustments: relaxation.adjustments,
      contactCheckCount: contactReport.checks.length,
      contactCheckPassedCount: contactReport.checks.filter((check) => check.ok).length,
      contactChecks: contactReport.checks,
      formConstellationAuthored: Boolean(lightResolvedManifest.polygonizer?.formConstellationAuthored),
      formConstellationNodeCount: lightResolvedManifest.polygonizer?.formConstellationNodeCount || 0,
      elementMandalaGenerated: Boolean(lightResolvedManifest.polygonizer?.elementMandala?.generated),
      elementMandalaCount: lightResolvedManifest.polygonizer?.elementMandala?.elements?.length || 0,
    },
  };
}

function deriveConsensusChainMetadata({
  manifest,
  spatialPlan,
  relaxation,
  expandedSourceMarks,
  constructionResolvedMarks,
  abstractConstellation,
  physicalHitboxes,
  shotContract,
  shotContractFit,
  authorshipPreview,
  materialContracts,
  materialContractsSummary,
}) {
  const polygonizer = manifest?.polygonizer || {};
  const hasMeru = Boolean(polygonizer?.meru);
  const constructionResolvedCount = Array.isArray(constructionResolvedMarks) ? constructionResolvedMarks.length : 0;
  const visibleMarkCount = Array.isArray(expandedSourceMarks) ? expandedSourceMarks.length : 0;
  const verdictPassed = spatialPlan?.validation?.ok === true;
  const verdictBlocked = spatialPlan?.materializationGate?.status === 'blocked';
  const preflightVerdict = verdictBlocked ? 'blocked' : verdictPassed ? 'passed' : 'not-evaluated';
  const reconciliationApplied = Boolean(relaxation?.applied);

  const abstractNodeCount = abstractConstellation?.nodeCount || 0;
  const hasAbstract = Boolean(abstractConstellation && (abstractNodeCount > 0 || abstractConstellation.formConstellationAuthored));
  const hitboxPresence = (physicalHitboxes?.declaredHitboxCount || 0)
    + (physicalHitboxes?.supportCount || 0)
    + (physicalHitboxes?.collisionBodyCount || 0)
    + (physicalHitboxes?.contactRegionCount || 0);
  const hasPhysical = hitboxPresence > 0;

  const shotContractStatus = shotContract?.frozen ? 'frozen' : 'not-declared';
  const overflow = shotContractFit?.overflow || null;

  const authorshipPreviewStatus = authorshipPreview
    ? (authorshipPreview.verdict === 'blocked' ? 'blocked' : 'passed')
    : 'not-yet-implemented';

  const stages = [
    { id: 'intent', status: 'input' },
    {
      id: 'authorship-preview',
      status: authorshipPreviewStatus,
      gateActive: authorshipPreview?.gateActive ?? false,
      blockingCount: authorshipPreview?.blockingCount ?? 0,
      advisoryCount: authorshipPreview?.advisoryCount ?? 0,
    },
    { id: 'abstract-constellation', status: hasAbstract ? 'resolved' : 'not-declared', count: abstractNodeCount },
    {
      id: 'shot-contract',
      status: shotContractStatus,
      viewBox: shotContract?.viewBox || null,
      glyphCount: polygonizer?.shotGlyphs?.length || 0,
    },
    { id: 'meru-basis', status: hasMeru ? 'resolved' : 'not-declared' },
    {
      id: 'physical-hitboxes',
      status: hasPhysical ? 'resolved' : 'not-declared',
      declaredHitboxCount: physicalHitboxes?.declaredHitboxCount || 0,
      supportCount: physicalHitboxes?.supportCount || 0,
      collisionBodyCount: physicalHitboxes?.collisionBodyCount || 0,
      contactRegionCount: physicalHitboxes?.contactRegionCount || 0,
    },
    {
      id: 'material-contracts',
      status: (materialContractsSummary?.count || 0) > 0 ? 'resolved' : 'not-declared',
      count: materialContractsSummary?.count || 0,
      families: materialContractsSummary?.families || [],
      phases: materialContractsSummary?.phases || [],
    },
    { id: 'construction-adapters', status: constructionResolvedCount > 0 ? 'resolved' : 'not-declared', count: constructionResolvedCount },
    { id: 'visible-skin', status: visibleMarkCount > 0 ? 'materialized' : 'not-materialized', count: visibleMarkCount },
    { id: 'preflight-verdict', status: preflightVerdict },
    { id: 'budget', status: 'not-yet-implemented' },
    { id: 'reconciliation', status: reconciliationApplied ? 'verified' : 'not-declared' },
  ];

  const authorshipPreviewSummary = authorshipPreview
    ? {
        immutable: true,
        verdict: authorshipPreview.verdict,
        phase: 'pre-expansion',
        gateActive: authorshipPreview.gateActive,
        materializationGate: authorshipPreview.materializationGate,
      }
    : { immutable: true, verdict: 'not-yet-implemented', phase: 'pre-expansion' };
  const preflightSummary = { immutable: true, verdict: preflightVerdict, phase: 'post-expansion' };
  const reconciliationSummary = { invalidatesPreflight: false, invalidatesAuthorshipPreview: false };

  return {
    chain: {
      stages,
      authorshipPreview: authorshipPreviewSummary,
      preflight: preflightSummary,
      reconciliation: reconciliationSummary,
    },
    authorshipPreview: authorshipPreview
      ? {
          ...authorshipPreviewSummary,
          checks: authorshipPreview.checks || [],
          blockingCount: authorshipPreview.blockingCount,
          advisoryCount: authorshipPreview.advisoryCount,
        }
      : {
          ...authorshipPreviewSummary,
          checks: [],
        },
    preflight: {
      ...preflightSummary,
      validation: spatialPlan?.validation || null,
      materializationGate: spatialPlan?.materializationGate || null,
      shotContract: shotContract || null,
      shotContractFit: shotContractFit || null,
    },
    reconciliation: {
      ...reconciliationSummary,
      applied: reconciliationApplied,
      shotContractMutated: false,
      shotContractOverflow: overflow,
    },
  };
}

function deriveAbstractConstellation(manifest) {
  const polygonizer = manifest?.polygonizer || {};
  const raw = polygonizer.constellation;
  const formAuthored = Boolean(polygonizer.formConstellationAuthored);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    if (!formAuthored) return null;
    return {
      kind: 'cca-constellation-grid',
      source: 'form-authored',
      formConstellationAuthored: true,
      nodes: [],
      nodeCount: 0,
      elementMandalaCount: polygonizer?.elementMandala?.elements?.length || 0,
    };
  }
  const nodes = Array.isArray(raw.nodes) ? raw.nodes : [];
  const elements = Array.isArray(polygonizer?.elementMandala?.elements)
    ? polygonizer.elementMandala.elements
    : [];
  return {
    kind: raw.kind || 'cca-constellation-grid',
    source: raw.source || (formAuthored ? 'form-authored' : 'declared'),
    flatEyeLevel: Boolean(raw.flatEyeLevel),
    axisMundi: raw.axisMundi || null,
    horizonY: Number.isFinite(Number(raw.horizonY)) ? Number(raw.horizonY) : null,
    vanishingPoint: Array.isArray(raw.vanishingPoint) ? raw.vanishingPoint.slice() : null,
    baselineY: Number.isFinite(Number(raw.baselineY)) ? Number(raw.baselineY) : null,
    depthBands: raw.depthBands || null,
    formConstellationAuthored: formAuthored,
    nodeCount: nodes.length,
    elementMandalaCount: elements.length,
    nodes: nodes.map((node) => ({
      role: node?.role,
      renderOrder: node?.renderOrder,
      parent: node?.parent ?? null,
      depthBand: node?.depthBand,
      anchor: node?.anchor,
      bounds: node?.bounds,
      cca: node?.cca,
      scale: node?.scale,
      childRegion: node?.childRegion,
      elementMandala: node?.elementMandala,
      formConstellation: Boolean(node?.formConstellation),
      formConstellationMode: node?.formConstellationMode,
      hitboxCount: Array.isArray(node?.hitboxes) ? node.hitboxes.length : 0,
    })),
  };
}

function derivePhysicalHitboxes({ spatialPlan, contactReport, manifest }) {
  const declaredHitboxes = Array.isArray(spatialPlan?.hitboxes) ? spatialPlan.hitboxes : [];
  const supports = Array.isArray(spatialPlan?.supports) ? spatialPlan.supports : [];
  const gravity = manifest?.polygonizer?.metamandala?.gravity;
  const declaredBodies = Array.isArray(gravity?.bodies) ? gravity.bodies : [];
  const collisionBodies = declaredBodies.map((body) => ({
    role: body.targetRole || body.role || body.bodyRole,
    supportRole: body.surfaceRole || body.supportRole || body.on || body.onRole,
    targetRegion: body.targetRegion || body.region || 'baseContact',
    includeRoles: Array.isArray(body.includeRoles) ? body.includeRoles.slice() : [],
    shadowRoles: Array.isArray(body.shadowRoles) ? body.shadowRoles.slice() : [],
  }));
  const checks = Array.isArray(contactReport?.checks) ? contactReport.checks : [];
  const contactRegions = checks.map((check) => ({
    role: check.role,
    fromRole: check.fromRole,
    fromRegion: check.fromRegion,
    toSurfaceRole: check.toSurfaceRole,
    mode: check.mode,
    ok: check.ok === true,
  }));
  return {
    declaredHitboxes,
    supports,
    collisionBodies,
    contactRegions,
    declaredHitboxCount: declaredHitboxes.length,
    supportCount: supports.length,
    collisionBodyCount: collisionBodies.length,
    contactRegionCount: contactRegions.length,
  };
}

function freezeShotContract(manifest) {
  const viewBox = manifest?.viewBox || {};
  const width = finiteOr(viewBox.width, 0);
  const height = finiteOr(viewBox.height, 0);
  const cameraPrimitive = manifest?.cameraPrimitive || manifest?.scene?.cameraPrimitive || {};
  const layer = manifest?.polygonizer?.mandalaPatternLayer || {};
  const shotGlyph = layer.shotGlyph || manifest?.polygonizer?.shotGlyph || null;
  const twoPointCamera = manifest?.polygonizer?.twoPointCamera || {};
  const cropApplied = Boolean(twoPointCamera.cropApplied && twoPointCamera.cropBox);
  const cropBox = cropApplied ? twoPointCamera.cropBox : null;

  const normalizedViewBox = {
    x: Number.isFinite(Number(viewBox.x)) ? Number(viewBox.x) : 0,
    y: Number.isFinite(Number(viewBox.y)) ? Number(viewBox.y) : 0,
    width,
    height,
  };

  const padding = readShotMetric(
    cameraPrimitive.padding,
    shotGlyph?.padding,
    manifest?.scene?.shotPadding,
    0,
  );
  const bleed = readShotMetric(
    cameraPrimitive.bleed,
    shotGlyph?.bleed,
    manifest?.scene?.shotBleed,
    0,
  );
  const cropPolicy = cameraPrimitive.cropPolicy
    || shotGlyph?.cropPolicy
    || (cropApplied ? 'crop-to-camera-window' : 'no-crop');
  const focusAnchor = cameraPrimitive.focusAnchor
    || shotGlyph?.focusAnchor
    || (Array.isArray(cameraPrimitive.cameraPoint?.point) ? cameraPrimitive.cameraPoint.point.slice() : null)
    || cameraPrimitive.anchor
    || null;
  const scaleToFit = Boolean(cameraPrimitive.scaleToFit ?? shotGlyph?.scaleToFit ?? false);
  const preserveAspectRatio = cameraPrimitive.preserveAspectRatio
    || shotGlyph?.preserveAspectRatio
    || manifest?.preserveAspectRatio
    || 'xMidYMid meet';

  const source = cropApplied
    ? 'two-point-camera-crop'
    : (shotGlyph ? 'shot-glyph' : 'manifest');

  const viewport = Object.freeze({ width, height });
  const frozenViewBox = Object.freeze(normalizedViewBox);
  if (cropBox) {
    Object.freeze({ x: cropBox.x, y: cropBox.y, width: cropBox.width, height: cropBox.height });
  }
  return Object.freeze({
    viewport,
    viewBox: frozenViewBox,
    padding,
    bleed,
    cropPolicy,
    focusAnchor,
    scaleToFit,
    preserveAspectRatio,
    frozen: true,
    source,
    cropApplied,
    cropBox: cropApplied
      ? Object.freeze({ x: cropBox.x, y: cropBox.y, width: cropBox.width, height: cropBox.height })
      : null,
  });
}

function readShotMetric(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return 0;
}

function evaluateShotContractFit(shotContract, marks) {
  if (!shotContract) return null;
  const vb = shotContract.viewBox;
  if (!vb || !Number.isFinite(vb.width) || vb.width <= 0 || !Number.isFinite(vb.height) || vb.height <= 0) {
    return { ok: true, marksWithinFrame: true, envelope: null, overflow: null };
  }
  const envelope = combinedMarkBounds(marks);
  if (!envelope) {
    return { ok: true, marksWithinFrame: true, envelope: null, overflow: null };
  }
  const right = vb.x + vb.width;
  const bottom = vb.y + vb.height;
  const overflowLeft = Math.max(0, vb.x - envelope.minX);
  const overflowTop = Math.max(0, vb.y - envelope.minY);
  const overflowRight = Math.max(0, envelope.maxX - right);
  const overflowBottom = Math.max(0, envelope.maxY - bottom);
  const overflows = overflowLeft > 0 || overflowTop > 0 || overflowRight > 0 || overflowBottom > 0;
  return {
    ok: !overflows,
    marksWithinFrame: !overflows,
    envelope: roundBox(envelope),
    overflow: overflows ? {
      left: round(overflowLeft),
      top: round(overflowTop),
      right: round(overflowRight),
      bottom: round(overflowBottom),
    } : null,
  };
}

function ensureFormConstellation(manifest) {
  const marks = Array.isArray(manifest?.marks) ? manifest.marks : [];
  const forms = marks
    .map((mark, index) => ({ mark, index }))
    .filter(({ mark }) => mark?.kind === 'form');
  if (!forms.length) return manifest;

  const viewBox = manifest.viewBox || {};
  const width = Math.max(finiteOr(viewBox.width, 800), 1);
  const height = Math.max(finiteOr(viewBox.height, 520), 1);
  const existing = manifest.polygonizer?.constellation;
  const base = existing && typeof existing === 'object' && !Array.isArray(existing)
    ? existing
    : flatEyeLevelConstellation(width, height);
  const nodes = Array.isArray(base.nodes) ? [...base.nodes] : [];
  const roles = new Set(nodes.map((node) => node?.role).filter(Boolean));
  const vp = validPoint(base.vanishingPoint) ||
    validPoint(manifest.scene?.perspective?.vanishingPoint) ||
    [width / 2, height * 0.5];
  let added = 0;

  forms.forEach(({ mark, index }) => {
    const role = formConstellationRole(mark, index);
    if (roles.has(role)) return;
    const node = formConstellationNode({
      mark,
      index,
      role,
      width,
      height,
      vanishingPoint: vp,
      renderOrder: formRenderOrder(nodes, index),
      mode: existing ? 'world-grid' : 'flat-eye-level',
    });
    nodes.push(node);
    roles.add(role);
    added += 1;
  });

  if (!added) return manifest;
  return {
    ...manifest,
    polygonizer: {
      ...(manifest.polygonizer || {}),
      constellation: {
        ...base,
        kind: 'cca-constellation-grid',
        generated: base.generated !== false,
        source: existing ? base.source || 'supplied-plus-form-authorship' : 'form-flat-eye-level',
        formConstellationAuthored: true,
        flatEyeLevel: existing ? Boolean(base.flatEyeLevel) : true,
        nodes,
      },
      formConstellationAuthored: true,
      formConstellationNodeCount: nodes.filter((node) => node?.formConstellation).length,
    },
  };
}

function resolveShotGlyphs(manifest) {
  const layer = manifest?.polygonizer?.mandalaPatternLayer || {};
  const rawGlyphs = [
    ...normalizeArray(layer.shotGlyphs),
    ...normalizeArray(layer.shotGlyph),
    ...normalizeArray(layer.standardShot),
    ...normalizeArray(manifest?.polygonizer?.shotGlyph),
  ];
  const resolved = rawGlyphs
    .map((glyph) => normalizeResolvedShotGlyph(glyph))
    .filter(Boolean);
  if (!resolved.length) return manifest;

  const primary = resolved[0];
  const polygonizer = manifest.polygonizer || {};
  const nextLayer = {
    ...layer,
    shotGlyph: primary,
    shotGlyphs: resolved,
    cameraWindow: deepMergeNeo(primary.cameraWindow, layer.cameraWindow),
    hallMandala: deepMergeNeo(primary.hallMandala, layer.hallMandala),
  };
  const glyphMeru = deepMergeNeo(primary.meru, primary.metamandala);
  const nextMetamandala = {
    ...(glyphMeru || {}),
    ...(polygonizer.metamandala || {}),
    lightSources: [
      ...normalizeArray(glyphMeru?.lightSources),
      ...normalizeArray(primary.lightSources),
      ...normalizeArray(polygonizer.metamandala?.lightSources),
    ],
  };

  return {
    ...manifest,
    cameraPrimitive: deepMergeNeo(primary.cameraPrimitive, manifest.cameraPrimitive || manifest.scene?.cameraPrimitive),
    scene: deepMergeNeo(deepMergeNeo(primary.scene, manifest.scene), {
      cameraPrimitive: manifest.scene?.cameraPrimitive,
    }),
    polygonizer: {
      ...polygonizer,
      mandalaPatternLayer: nextLayer,
      roomConcept: deepMergeNeo(primary.roomConcept, polygonizer.roomConcept),
      meru: deepMergeNeo(glyphMeru, polygonizer.meru),
      metamandala: nextMetamandala,
      shotGlyphs: resolved.map((glyph) => ({
        id: glyph.id,
        label: glyph.label,
        family: glyph.family,
        source: glyph.source,
        topology: glyph.topology,
        hallMandala: glyph.hallMandala,
        boundaryContract: glyph.boundaryContract,
      })),
    },
  };
}

function resolveMeruAlias(manifest) {
  const polygonizer = manifest?.polygonizer;
  if (!polygonizer?.meru) return manifest;
  const meru = polygonizer.meru;
  return {
    ...manifest,
    polygonizer: {
      ...polygonizer,
      metamandala: deepMergeNeo(meru, polygonizer.metamandala),
    },
  };
}

function normalizeResolvedShotGlyph(glyph) {
  if (!glyph) return null;
  const raw = typeof glyph === 'string' ? { id: glyph } : glyph;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const base = resolveShotGlyph(raw.extends || raw.seed || raw.id || raw.kind || raw.ref);
  const resolved = base ? deepMergeNeo(base, raw) : raw;
  if (!resolved?.id && !resolved?.cameraWindow && !resolved?.cameraPrimitive && !resolved?.lightSources) return null;
  return {
    ...resolved,
    id: base ? (raw.id && raw.extends ? raw.id : base.id) : resolved.id || 'derived-shot-glyph',
    label: resolved.label || resolved.id || 'Derived shot glyph',
    family: resolved.family || 'derived-shot-glyph',
    source: base ? 'shot-glyph-library' : 'declared-shot-glyph',
  };
}

function normalizeArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function deepMergeNeo(base, override) {
  if (override === undefined || override === null) return clonePlain(base);
  if (base === undefined || base === null) return clonePlain(override);
  if (Array.isArray(base) || Array.isArray(override) || typeof base !== 'object' || typeof override !== 'object') {
    return clonePlain(override);
  }
  const out = clonePlain(base);
  for (const [key, value] of Object.entries(override)) {
    out[key] = deepMergeNeo(out[key], value);
  }
  return out;
}

function clonePlain(value) {
  if (value === undefined) return undefined;
  return structuredClone(value);
}

function flatEyeLevelConstellation(width, height) {
  const horizonY = roundPoint(height * 0.5);
  const anchor = [roundPoint(width / 2), horizonY];
  return {
    kind: 'cca-constellation-grid',
    generated: true,
    source: 'form-flat-eye-level',
    flatEyeLevel: true,
    axisMundi: {
      anchor,
      vertical: [[anchor[0], roundPoint(height * 0.1)], [anchor[0], roundPoint(height * 0.9)]],
      horizontal: [[roundPoint(width * 0.1), anchor[1]], [roundPoint(width * 0.9), anchor[1]]],
    },
    horizonY,
    vanishingPoint: anchor,
    baselineY: roundPoint(height * 0.82),
    depthBands: {
      foreground: [roundPoint(height * 0.62), roundPoint(height * 0.92)],
      midground: [roundPoint(height * 0.18), roundPoint(height * 0.82)],
      background: [roundPoint(height * 0.08), roundPoint(height * 0.32)],
    },
    nodes: [],
  };
}

function formConstellationRole(mark, index) {
  return String(mark.constellationRole || mark.gridRole || mark.role || `form-${index + 1}`);
}

function formRenderOrder(nodes, index) {
  const max = nodes.reduce((best, node) => Math.max(best, finiteOr(node?.renderOrder, 0)), 0);
  return max + 10 + index;
}

function formConstellationNode({ mark, index, role, width, height, vanishingPoint, renderOrder, mode }) {
  const bounds = formAuthoringBounds(mark, { width, height });
  const center = [bounds.x + bounds.width / 2, bounds.y + bounds.height / 2];
  return {
    role,
    renderOrder,
    parent: mark.constellationParent || null,
    depthBand: mark.depthBand || 'midground',
    anchor: roundPointTuple(validPoint(mark.anchor) || center),
    bounds,
    cca: {
      center: roundPointTuple(center),
      lengthAxis: [
        [bounds.x, roundPoint(center[1])],
        [roundPoint(bounds.x + bounds.width), roundPoint(center[1])],
      ],
      heightAxis: [
        [roundPoint(center[0]), roundPoint(bounds.y + bounds.height)],
        [roundPoint(center[0]), bounds.y],
      ],
      depthAxis: {
        toward: roundPointTuple(vanishingPoint),
        mode,
      },
    },
    scale: {
      pictureShare: round((bounds.width * bounds.height) / 1000000),
      childBudget: 0.62,
    },
    childRegion: insetLocalBounds(bounds, 0.12, 0.12),
    formConstellation: true,
    formConstellationStock: mark.stock || mark.bodyStock || 'abstract-combo',
    formConstellationMode: mode,
    authoredFrom: 'form',
    sourceMarkIndex: index,
  };
}

function formAuthoringBounds(mark, viewBox) {
  if (mark.bounds && typeof mark.bounds === 'object' && !Array.isArray(mark.bounds)) {
    return clampLocalBounds(normalizeLocalBounds(mark.bounds), viewBox);
  }
  if (Number.isFinite(Number(mark.x)) && Number.isFinite(Number(mark.y))) {
    return clampLocalBounds(normalizeLocalBounds({
      x: mark.x,
      y: mark.y,
      width: mark.width ?? mark.w ?? 160,
      height: mark.height ?? mark.h ?? 200,
    }), viewBox);
  }
  const gestureBounds = formGestureBounds(mark);
  if (gestureBounds) return clampLocalBounds(gestureBounds, viewBox);

  const anchor = validPoint(mark.anchor) || [finiteOr(mark.cx, viewBox.width / 2), finiteOr(mark.cy, viewBox.height / 2)];
  const scale = Math.max(finiteOr(mark.scale, 1), 0.1);
  const stock = String(mark.stock || mark.bodyStock || '').toLowerCase();
  let w = 160 * scale;
  let h = 220 * scale;
  if (isLowerBodyDummyStock(stock)) {
    w = Math.max((finiteOr(mark.hipSpread, 34 * scale) * 2) + 72 * scale, 110 * scale);
    h = finiteOr(mark.upperLegLength, 74 * scale) + finiteOr(mark.lowerLegLength, 78 * scale) + 80 * scale;
  } else if (isFullBodyDummyStock(stock) || stock === 'bipedal') {
    w = Math.max((finiteOr(mark.shoulderSpread, 42 * scale) * 2) + 96 * scale, 150 * scale);
    h = finiteOr(mark.upperLegLength, 68 * scale) + finiteOr(mark.lowerLegLength, 72 * scale) + 280 * scale;
  } else if (stock === 'plane-object') {
    w = finiteOr(mark.width, finiteOr(mark.w, 150 * scale));
    h = finiteOr(mark.height, finiteOr(mark.h, 92 * scale));
  }
  return clampLocalBounds({
    x: anchor[0] - w / 2,
    y: anchor[1] - h / 2,
    width: w,
    height: h,
  }, viewBox);
}

function formGestureBounds(mark) {
  const points = [];
  collectGesturePoints(mark.gesture, points);
  collectGesturePoints(mark.leftArmGesture, points);
  collectGesturePoints(mark.rightArmGesture, points);
  if (!points.length) return null;
  const scale = Math.max(finiteOr(mark.scale, 1), 0.1);
  const pad = 80 * scale;
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const minX = Math.min(...xs) - pad;
  const maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad;
  const maxY = Math.max(...ys) + pad + finiteOr(mark.upperLegLength, 68 * scale) + finiteOr(mark.lowerLegLength, 72 * scale) * 0.5;
  return {
    x: minX,
    y: minY,
    width: Math.max(maxX - minX, 1),
    height: Math.max(maxY - minY, 1),
  };
}

function collectGesturePoints(gesture, out) {
  if (!gesture || typeof gesture !== 'object' || Array.isArray(gesture)) return;
  if (Array.isArray(gesture.points)) {
    out.push(...gesture.points.filter((point) => validPoint(point)));
  }
  collectGesturePoints(gesture.crossGesture || gesture.cross, out);
  collectGesturePoints(gesture.leftArm, out);
  collectGesturePoints(gesture.rightArm, out);
}

function normalizeLocalBounds(bounds) {
  return {
    x: finiteOr(bounds.x, 0),
    y: finiteOr(bounds.y, 0),
    width: Math.max(finiteOr(bounds.width ?? bounds.w, 1), 1),
    height: Math.max(finiteOr(bounds.height ?? bounds.h, 1), 1),
  };
}

function clampLocalBounds(bounds, viewBox) {
  const x = Math.min(Math.max(bounds.x, 0), Math.max(viewBox.width - 1, 0));
  const y = Math.min(Math.max(bounds.y, 0), Math.max(viewBox.height - 1, 0));
  return {
    x: roundPoint(x),
    y: roundPoint(y),
    width: roundPoint(Math.max(Math.min(bounds.width, viewBox.width - x), 1)),
    height: roundPoint(Math.max(Math.min(bounds.height, viewBox.height - y), 1)),
  };
}

function insetLocalBounds(bounds, xRatio, yRatio) {
  const dx = bounds.width * xRatio;
  const dy = bounds.height * yRatio;
  return {
    x: roundPoint(bounds.x + dx),
    y: roundPoint(bounds.y + dy),
    width: roundPoint(Math.max(bounds.width - dx * 2, 1)),
    height: roundPoint(Math.max(bounds.height - dy * 2, 1)),
  };
}

function roundPointTuple(point) {
  return [roundPoint(point[0]), roundPoint(point[1])];
}

function resolveTwoPointCameraPrimitive(manifest) {
  const cameraPrimitive = manifest.cameraPrimitive || manifest.scene?.cameraPrimitive;
  const pureMandala = manifest.polygonizer?.pureMandala || manifest.pureMandala;
  if (cameraPrimitive?.kind !== 'two-point' || !pureMandala?.room) return manifest;

  const generated = generateTwoPointRoomMarks(pureMandala, cameraPrimitive);
  const crop = cameraPrimitive.showFullMandala === false && cameraPrimitive.cropBox
    ? cameraPrimitive.cropBox
    : null;
  // Furnish the room: declared roomConcept.elements become boxNet marks bound to
  // the room frame's own roomBasis, expanded downstream by expandBoxNetMark.
  const furnitureMarks = synthesizeRoomFurnitureMarks(manifest.polygonizer?.roomConcept, generated.roomBasis);
  const marks = [
    ...generated.marks,
    ...(Array.isArray(manifest.marks) ? manifest.marks : []),
    ...furnitureMarks,
  ];

  return {
    ...manifest,
    viewBox: crop
      ? { width: crop.width, height: crop.height }
      : manifest.viewBox || generated.viewBox,
    // boxNet marks project to screen later (in expandBoxNetMark), so offsetMark
    // can't shift them here — stamp the crop offset and apply it post-projection.
    marks: crop
      ? marks.map((mark) => (mark?.kind === 'boxNet'
        ? { ...mark, cropOffset: [-crop.x, -crop.y] }
        : offsetMark(mark, -crop.x, -crop.y)))
      : marks,
    scene: {
      ...(manifest.scene || {}),
      perspective: {
        ...(manifest.scene?.perspective || {}),
        mode: 'two-point',
        horizonY: cameraPrimitive.horizonY,
        vanishingPoints: cameraPrimitive.vanishingPoints,
      },
    },
    polygonizer: {
      ...(manifest.polygonizer || {}),
      twoPointCamera: {
        generated: true,
        floorGridCount: generated.floorGridCount,
        ceilingGridCount: generated.ceilingGridCount,
        projectedPins: generated.projectedPins,
        cameraGrammar: generated.cameraGrammar,
        cropApplied: Boolean(crop),
        cropBox: crop || undefined,
      },
    },
  };
}

function applyGridRenderStyleContract(marks, manifest) {
  if (!Array.isArray(marks) || !usesGridRenderStyle(manifest)) return marks;
  return marks.map((mark) => {
    if (!mark || typeof mark !== 'object') return mark;
    if (isWireframeOrGridMark(mark)) {
      return {
        ...mark,
        strokeWidth: 1,
      };
    }
    if (isBorderSuppressedElement(mark)) {
      return {
        ...mark,
        stroke: 'none',
        strokeWidth: 0,
      };
    }
    return mark;
  });
}

function applyConstellationBackToFrontPaintOrder(marks, manifest) {
  if (!Array.isArray(marks)) return marks;
  const constellation = manifest?.polygonizer?.constellation;
  const mode = constellation?.paintOrder || constellation?.depthPaintOrder || manifest?.scene?.constellationPaintOrder;
  if (mode !== 'back-to-front' && mode !== 'depth-back-to-front') return marks;
  const nodes = Array.isArray(constellation?.nodes) ? constellation.nodes : [];
  if (!nodes.length) return marks;
  const ranked = [...nodes]
    .filter((node) => node?.role)
    .sort((a, b) => depthBandRank(a.depthBand) - depthBandRank(b.depthBand) ||
      finiteOr(a.anchor?.[1], a.bounds?.y ?? 0) - finiteOr(b.anchor?.[1], b.bounds?.y ?? 0) ||
      finiteOr(a.renderOrder, 0) - finiteOr(b.renderOrder, 0));
  const rankByRole = new Map(ranked.map((node, index) => [node.role, index]));
  return marks.map((mark) => {
    if (!mark || mark.constellationDebug || !rankByRole.has(mark.constellationRole)) return mark;
    const rank = rankByRole.get(mark.constellationRole);
    const originalZ = finiteOr(mark.z, 0);
    const localBias = originalZ - Math.floor(originalZ);
    return {
      ...mark,
      z: round(100 + rank * 10 + localBias),
      constellationPaintOrder: 'back-to-front',
      constellationPaintRank: rank,
    };
  });
}

function resolveMandalaCameraWindow(manifest) {
  const cameraWindow = manifest?.polygonizer?.mandalaPatternLayer?.cameraWindow;
  if (!cameraWindow || typeof cameraWindow !== 'object' || Array.isArray(cameraWindow)) {
    return { window: null, debugMarks: [] };
  }
  const terminators = cameraWindow.terminatorVectors || {};
  const left = validVector2(terminators.left) || [-1, -1];
  const right = validVector2(terminators.right) || [1, -1];
  const origin = validVector2(cameraWindow.origin) || [0, 0];
  const viewBox = manifest?.viewBox || {};
  const screenOrigin = validPoint(cameraWindow.screenOrigin) || [
    finiteOr(viewBox.width, 800) / 2,
    finiteOr(manifest?.polygonizer?.draftingTable?.baselineY, finiteOr(viewBox.height, 520) * 0.78),
  ];
  const scale = Math.max(finiteOr(cameraWindow.unitScale, 170), 1);
  const depthSteps = Math.max(2, Math.min(12, Math.round(finiteOr(cameraWindow.depthSteps, 5))));
  const laneSteps = Math.max(2, Math.min(12, Math.round(finiteOr(cameraWindow.laneSteps, 5))));
  const length = Math.max(finiteOr(cameraWindow.length, 1), 0.01);
  const window = {
    kind: cameraWindow.kind || 'shot-terminator-wedge',
    origin,
    terminatorVectors: { left, right },
    screenOrigin: roundPointTuple(screenOrigin),
    unitScale: scale,
    depthSteps,
    laneSteps,
    fitRule: cameraWindow.fitRule || 'visible mandala content must fit between the two terminator vectors for the shot',
    grid: buildMandalaCameraWindowGrid({ origin, left, right, length, depthSteps, laneSteps }),
  };
  const debug = cameraWindow.debug === true || cameraWindow.showDebug === true || cameraWindow.renderDebug === true;
  return {
    window,
    debugMarks: debug ? mandalaCameraWindowDebugMarks(window, cameraWindow) : [],
  };
}

function deriveSpatialPlan(manifest, context = {}) {
  const contract = resolveSpatialPlanningContract(manifest);
  const shotGlyphs = spatialPlanShotGlyphs(manifest);
  const hallMandala = spatialPlanHallMandala(manifest);
  const meru = spatialPlanMeru(manifest);
  const roomConcept = resolveRoomConcept(manifest, context);
  const hitboxes = collectConstellationHitboxes(manifest);
  const supports = Array.isArray(context.surfaces)
    ? context.surfaces.map((surface) => spatialPlanSupport(surface)).filter(Boolean)
    : [];
  const gravityEdges = spatialPlanGravityEdges(manifest, context.relaxation);
  const zAdjacency = spatialPlanZAdjacency(context.relaxation);
  const shadowReceivers = spatialPlanShadowReceivers(manifest, gravityEdges, context.marks);
  const horizontalStacks = spatialPlanHorizontalStacks(context.marks);
  const mandalaArrangements = spatialPlanMandalaArrangements(context.marks);
  const shotContract = context.shotContract || null;
  const shotContractFit = evaluateShotContractFit(shotContract, context.marks);
  const validation = validateSpatialPlan({
    contract,
    hitboxes,
    supports,
    shotGlyphs,
    hallMandala,
    meru,
    roomConcept,
    gravityEdges,
    zAdjacency,
    horizontalStacks,
    mandalaArrangements,
    contactReport: context.contactReport,
    marks: context.marks,
    shotContract,
  });
  const stages = [
    { id: 'shot-glyphs', status: shotGlyphs.length ? 'resolved' : 'not-declared', count: shotGlyphs.length },
    { id: 'hall-mandala', status: hallMandala ? 'resolved' : 'not-declared' },
    { id: 'meru', status: meru ? 'resolved' : 'not-declared' },
    { id: 'room-concept', status: roomConcept ? 'resolved' : 'not-declared' },
    { id: 'camera-window', status: context.cameraWindow ? 'resolved' : 'not-declared' },
    { id: 'metamandala-light', status: context.lighting ? 'resolved' : 'not-declared' },
    { id: 'metamandala-light-diffusion', status: context.diffusion?.applied ? 'resolved' : 'not-declared', count: context.diffusion?.report?.hitCount || 0 },
    { id: 'constellation-hitboxes', status: hitboxes.length ? 'resolved' : 'not-declared', count: hitboxes.length },
    { id: 'support-surfaces', status: supports.length ? 'resolved' : 'not-declared', count: supports.length },
    { id: 'gravity', status: gravityEdges.length ? 'resolved' : 'not-declared', count: gravityEdges.length },
    { id: 'mandala-arrangements', status: mandalaArrangements.length ? 'resolved' : 'not-declared', count: mandalaArrangements.length },
    { id: 'horizontal-stacks', status: horizontalStacks.length ? 'resolved' : 'not-declared', count: horizontalStacks.length },
    { id: 'shadow-receivers', status: shadowReceivers.length ? 'resolved' : 'not-declared', count: shadowReceivers.length },
    { id: 'z-adjacency', status: zAdjacency.length ? 'resolved' : 'not-declared', count: zAdjacency.length },
    { id: 'validation', status: validation.ok ? 'passed' : 'failed', count: validation.checks.length },
  ];
  return {
    kind: 'rendrant-spatial-plan',
    contract,
    materializationGate: {
      mode: contract.materializationGate,
      status: validation.ok ? 'open' : 'blocked',
      rule: 'visible assets are final skins over resolved spatial facts',
    },
    stages,
    cameraWindow: context.cameraWindow || null,
    lighting: context.lighting || null,
    lightDiffusion: context.diffusion?.report || null,
    shotGlyphs,
    hallMandala,
    meru,
    roomConcept,
    hitboxes,
    supports,
    gravityEdges,
    mandalaArrangements,
    horizontalStacks,
    shadowReceivers,
    zAdjacency,
    shotContract,
    shotContractFit,
    validation,
  };
}

function resolveRoomConcept(manifest, context = {}) {
  const raw = manifest?.polygonizer?.roomConcept || manifest?.polygonizer?.roomPlanning || null;
  const cameraPrimitive = manifest?.cameraPrimitive || manifest?.scene?.cameraPrimitive || {};
  const pureMandala = manifest?.polygonizer?.pureMandala || manifest?.pureMandala || {};
  const twoPointCamera = manifest?.polygonizer?.twoPointCamera || null;
  const hasRoomCamera = cameraPrimitive?.kind === 'two-point' && Boolean(pureMandala?.room);
  if (!raw && !hasRoomCamera) return null;

  const marks = Array.isArray(context.marks) ? context.marks : [];
  const planeRoles = {
    floor: 'room:floor-plane',
    ceiling: 'room:ceiling-plane',
    leftWall: 'room:left-wall-plane',
    rightWall: 'room:right-wall-plane',
    backWall: 'room:back-wall-plane',
  };
  const planeMarks = Object.values(planeRoles)
    .map((role) => marks.find((mark) => mark?.role === role))
    .filter(Boolean);
  const envelope = combinedMarkBounds(planeMarks);
  const viewBox = manifest?.viewBox || {};
  const viewBounds = {
    minX: 0,
    minY: 0,
    maxX: finiteOr(viewBox.width, 0),
    maxY: finiteOr(viewBox.height, 0),
    w: finiteOr(viewBox.width, 0),
    h: finiteOr(viewBox.height, 0),
  };
  const projectedPins = Array.isArray(twoPointCamera?.projectedPins) ? twoPointCamera.projectedPins : [];
  const requiredRoles = Array.isArray(raw?.requiredRoles)
    ? raw.requiredRoles
    : Array.isArray(raw?.fullFrameRoles)
      ? raw.fullFrameRoles
      : [];
  const subjectFraming = raw?.camera?.subjectFraming || raw?.subjectFraming || cameraPrimitive.subjectFraming || 'room-envelope';
  const fullFrame = subjectFraming === 'full-frame-room' || raw?.fullFrame === true;

  return {
    kind: raw?.kind || 'interior-room',
    source: raw ? 'declared' : 'two-point-camera-primitive',
    localSpace: raw?.localSpace || 'cca-local-space',
    normalization: raw?.normalization || 'project-after-planning',
    camera: {
      mode: raw?.camera?.mode || (hasRoomCamera ? 'two-point-camera-primitive' : 'declared-room-camera'),
      primitive: raw?.camera?.primitive || cameraPrimitive.canonicalAngle || cameraPrimitive.constraint || cameraPrimitive.kind,
      predeterminedVector: raw?.camera?.predeterminedVector || cameraPrimitive.cameraPoint?.kind || cameraPrimitive.anchor,
      subjectFraming,
    },
    frame: {
      floorPlane: Boolean(marks.find((mark) => mark?.role === planeRoles.floor)),
      ceilingPlane: Boolean(marks.find((mark) => mark?.role === planeRoles.ceiling)),
      leftWall: Boolean(marks.find((mark) => mark?.role === planeRoles.leftWall)),
      rightWall: Boolean(marks.find((mark) => mark?.role === planeRoles.rightWall)),
      backWall: Boolean(marks.find((mark) => mark?.role === planeRoles.backWall)),
      envelope: envelope ? roundBox(envelope) : null,
      viewBounds: roundBox(viewBounds),
      coverage: envelope ? {
        width: viewBounds.w > 0 ? round(envelope.w / viewBounds.w) : 0,
        height: viewBounds.h > 0 ? round(envelope.h / viewBounds.h) : 0,
        leftInset: round(Math.max(0, envelope.minX)),
        rightInset: round(Math.max(0, viewBounds.maxX - envelope.maxX)),
        topInset: round(Math.max(0, envelope.minY)),
        bottomInset: round(Math.max(0, viewBounds.maxY - envelope.maxY)),
      } : null,
    },
    placementSpace: {
      gravityAxis: raw?.placementSpace?.gravityAxis || 'camera-floor-depth',
      supportPlane: raw?.placementSpace?.supportPlane || 'room:floor-plane',
      fullFrameBounds: raw?.placementSpace?.fullFrameBounds || 'room-envelope',
    },
    pinnedElements: projectedPins.map((pin) => ({
      role: pin.role,
      screen: Array.isArray(pin.screen) ? pin.screen.map(roundPoint) : undefined,
      worldXYZ: Array.isArray(pin.worldXYZ) ? pin.worldXYZ.map(round) : undefined,
      spawnDirection: pin.spawnDirection,
    })),
    requiredRoles,
    fullFrame,
    twoPointCameraGenerated: Boolean(twoPointCamera?.generated),
  };
}

function resolveSpatialPlanningContract(manifest) {
  const raw = manifest?.polygonizer?.spatialPlanning || manifest?.polygonizer?.rendrantPipeline || {};
  const gravityEnabled = manifest?.polygonizer?.metamandala?.gravity?.enabled === true;
  const mode = raw.mode || raw.spatialMode || (gravityEnabled ? 'plan-before-skin' : 'legacy-inline');
  const enabled = raw.enabled ?? raw.planBeforeSkin ?? mode === 'plan-before-skin';
  return {
    mode,
    enabled: Boolean(enabled),
    materializationGate: raw.materializationGate || (enabled ? 'planning-valid' : 'legacy-open'),
    stages: Array.isArray(raw.planningStages)
      ? raw.planningStages
      : [
          'shot-glyphs',
          'camera-window',
          'cca-local-spaces',
          'hitboxes',
          'gravity',
          'shadow-receivers',
          'z-adjacency',
        ],
    principle: raw.principle || 'planning resolves space; rendering skins resolved space',
  };
}

function collectConstellationHitboxes(manifest) {
  const nodes = Array.isArray(manifest?.polygonizer?.constellation?.nodes)
    ? manifest.polygonizer.constellation.nodes
    : [];
  const out = [];
  for (const node of nodes) {
    const hitboxes = Array.isArray(node?.hitboxes) ? node.hitboxes : [];
    for (const hitbox of hitboxes) {
      const bounds = normalizeHitboxBounds(hitbox, node);
      if (!bounds) continue;
      out.push({
        role: hitbox.role || `hitbox-${out.length + 1}`,
        kind: hitbox.kind || 'bounds',
        nodeRole: node.role,
        bounds: roundMandalaBounds(bounds),
        supportRail: hitbox.supportRail || hitbox.rail,
        space: hitbox.space || (hitbox.relative || hitbox.units === 'node' ? 'node' : 'screen-projected'),
        source: 'constellation',
      });
    }
  }
  return out;
}

function spatialPlanSupport(surface) {
  if (!surface?.role) return null;
  return {
    role: surface.role,
    kind: surface.kind,
    source: surface.source,
    nodeRole: surface.nodeRole,
    hitboxRole: surface.hitboxRole,
    fromRole: surface.fromRole,
    fromRegion: surface.fromRegion,
    supportRail: surface.supportRail,
    supportBounds: surface.supportBounds,
    z: surface.z,
  };
}

function spatialPlanShotGlyphs(manifest) {
  const glyphs = Array.isArray(manifest?.polygonizer?.shotGlyphs)
    ? manifest.polygonizer.shotGlyphs
    : [];
  return glyphs.map((glyph) => ({
    id: glyph.id,
    label: glyph.label,
    family: glyph.family,
    source: glyph.source,
    cameraVector: glyph.topology?.cameraVector,
    lightEntry: glyph.topology?.lightEntry,
    support: glyph.topology?.support,
    vanishingHub: glyph.topology?.vanishingHub,
    staging: glyph.topology?.staging,
    hallMandala: glyph.hallMandala ? {
      kind: glyph.hallMandala.kind,
      vanishingHub: glyph.hallMandala.vanishingHub,
      slots: glyph.hallMandala.slots,
      depthBands: glyph.hallMandala.depthBands,
    } : undefined,
    boundaryContract: glyph.boundaryContract,
  }));
}

function spatialPlanHallMandala(manifest) {
  const hall = manifest?.polygonizer?.mandalaPatternLayer?.hallMandala || manifest?.polygonizer?.hallMandala;
  if (!hall || typeof hall !== 'object' || Array.isArray(hall)) return null;
  return {
    kind: hall.kind || 'central-hall-mandala',
    vanishingHub: Array.isArray(hall.vanishingHub) ? hall.vanishingHub.map(roundPoint) : undefined,
    horizonY: Number.isFinite(Number(hall.horizonY)) ? round(Number(hall.horizonY)) : undefined,
    axisMundi: hall.axisMundi,
    slots: Array.isArray(hall.slots) ? hall.slots : [],
    depthBands: Array.isArray(hall.depthBands) ? hall.depthBands : [],
    symmetry: hall.symmetry,
    architecture: Array.isArray(hall.architecture) ? hall.architecture : [],
  };
}

function spatialPlanMeru(manifest) {
  const meru = manifest?.polygonizer?.meru;
  if (!meru || typeof meru !== 'object' || Array.isArray(meru)) return null;
  return {
    basis: meru.basis || 'meru',
    aliasFor: meru.aliasFor || 'metamandala',
    surfaceCount: Array.isArray(meru.surfaces) ? meru.surfaces.length : 0,
    lightSourceCount: Array.isArray(meru.lightSources) ? meru.lightSources.length : 0,
    rule: 'Meru is the local support/light/depth basis normalized into metamandala machinery',
  };
}

function spatialPlanGravityEdges(manifest, relaxation = {}) {
  const gravity = manifest?.polygonizer?.metamandala?.gravity;
  const bodies = [
    ...(Array.isArray(gravity?.bodies) ? gravity.bodies : []),
    ...horizontalStackGravityBodies(manifest),
  ];
  if (!gravity?.enabled && !bodies.length) return [];
  return bodies
    .map((body) => {
      const targetRole = body.targetRole || body.role || body.bodyRole;
      const supportRole = body.surfaceRole || body.supportRole || body.on || body.onRole;
      if (!targetRole || !supportRole) return null;
      const ruleRole = body.ruleRole || body.gravityRole || `${targetRole}-gravity-on-${supportRole}`;
      const adjustment = relaxation?.adjustments?.find((item) => item.role === ruleRole);
      const shadowRoles = Array.isArray(body.shadowRoles)
        ? body.shadowRoles
        : Array.isArray(body.includeRoles)
          ? body.includeRoles.filter((role) => isShadowRole(role, body))
          : [];
      return {
        role: ruleRole,
        bodyRole: targetRole,
        supportRole,
        targetRegion: body.targetRegion || body.region || 'baseContact',
        includeRoles: Array.isArray(body.includeRoles)
          ? body.includeRoles.filter((role) => !isShadowRole(role, body))
          : [],
        shadowRoles,
        resolved: Boolean(adjustment),
        delta: adjustment?.delta,
        paintZ: adjustment?.paintZ,
      };
    })
    .filter(Boolean);
}

function spatialPlanZAdjacency(relaxation = {}) {
  const adjustments = Array.isArray(relaxation?.adjustments) ? relaxation.adjustments : [];
  return adjustments
    .filter((adjustment) => adjustment.paintZ !== null && adjustment.paintZ !== undefined)
    .map((adjustment) => ({
      role: adjustment.role,
      topRole: adjustment.targetRole,
      bottomRole: adjustment.surfaceRole,
      paintZ: adjustment.paintZ,
      reason: adjustment.reason,
      rule: 'there is only one bottom',
    }));
}

function spatialPlanShadowReceivers(manifest, gravityEdges, marks = []) {
  const declared = manifest?.polygonizer?.metamandala?.shadowReceivers;
  const fromDeclared = Array.isArray(declared)
    ? declared.map((receiver) => ({
        role: receiver.role,
        receiverRole: receiver.receiverRole || receiver.surfaceRole || receiver.supportRole,
        shadowRole: receiver.shadowRole,
        source: 'declared',
      }))
    : [];
  const fromGravity = gravityEdges.flatMap((edge) => edge.shadowRoles.map((shadowRole) => ({
    role: `${shadowRole}-receiver`,
    shadowRole,
    receiverRole: edge.supportRole,
    source: 'gravity-shadow-exclusion',
  })));
  const markRoles = new Set((Array.isArray(marks) ? marks : []).map((mark) => mark?.role).filter(Boolean));
  return [...fromDeclared, ...fromGravity]
    .filter((item) => item.shadowRole || item.receiverRole)
    .map((item) => ({
      ...item,
      shadowPresent: item.shadowRole ? markRoles.has(item.shadowRole) : undefined,
      receiverPresent: item.receiverRole ? markRoles.has(item.receiverRole) : undefined,
    }));
}

function spatialPlanHorizontalStacks(marks = []) {
  const stacks = new Map();
  for (const mark of Array.isArray(marks) ? marks : []) {
    const role = mark?.horizontalStackRole;
    if (!role) continue;
    const stack = stacks.get(role) || {
      role,
      mode: mark.horizontalStackMode || 'gravity',
      axis: mark.horizontalStackAxis || 'x',
      activeRay: mark.horizontalStackActiveRay || mark.mandalaArrangementActiveRay || 'east-west',
      basisKind: mark.mandalaArrangementBasisKind,
      localSpace: mark.mandalaArrangementLocalSpace,
      memberCollision: mark.horizontalStackMemberCollision || 'avoid',
      supportRole: mark.horizontalStackSupportRole,
      skinPolicy: mark.horizontalStackSkinPolicy || 'separate',
      members: new Set(),
      memberCount: 0,
      hasJoinedSkin: false,
    };
    if (mark.horizontalStackJoinedSkin) {
      stack.hasJoinedSkin = true;
      stack.joinedSkinRole = mark.role;
    } else if (mark.horizontalStackMemberRole) {
      stack.members.add(mark.horizontalStackMemberRole);
      stack.memberCount = stack.members.size;
    }
    stacks.set(role, stack);
  }
  return [...stacks.values()].map((stack) => ({
    ...stack,
    members: [...stack.members],
  }));
}

function spatialPlanMandalaArrangements(marks = []) {
  const arrangements = new Map();
  for (const mark of Array.isArray(marks) ? marks : []) {
    const role = mark?.mandalaArrangementRole;
    if (!role) continue;
    const arrangement = arrangements.get(role) || {
      role,
      profile: mark.mandalaArrangementProfile || 'horizontal-stack',
      activeRay: mark.mandalaArrangementActiveRay || mark.horizontalStackActiveRay || 'east-west',
      basisKind: mark.mandalaArrangementBasisKind || 'local-lateral-support',
      localSpace: mark.mandalaArrangementLocalSpace || 'cca-local',
      basis: mark.mandalaArrangementBasis,
      rayVector: mark.mandalaArrangementRayVector,
      members: new Set(),
      memberDetails: [],
      memberCount: 0,
      hasJoinedSkin: false,
    };
    if (mark.horizontalStackJoinedSkin) {
      arrangement.hasJoinedSkin = true;
      arrangement.joinedSkinRole = mark.role;
    } else if (mark.horizontalStackMemberRole) {
      arrangement.members.add(mark.horizontalStackMemberRole);
      arrangement.memberCount = arrangement.members.size;
      if (!arrangement.memberDetails.some((item) => item.role === mark.horizontalStackMemberRole)) {
        arrangement.memberDetails.push({
          role: mark.horizontalStackMemberRole,
          index: mark.horizontalStackMemberIndex,
          interval: Array.isArray(mark.mandalaRayInterval) ? mark.mandalaRayInterval : null,
          intervalBefore: Array.isArray(mark.mandalaRayIntervalBefore) ? mark.mandalaRayIntervalBefore : null,
          displacement: mark.mandalaRayDisplacement,
          resolved: Boolean(mark.mandalaRayResolved),
          contactPolicy: mark.mandalaRayContactPolicy,
          collisionPolicy: mark.mandalaRayCollisionPolicy,
          floater: Boolean(mark.mandalaFloater),
          floaterPolicy: mark.mandalaFloaterPolicy,
        });
      }
    }
    arrangements.set(role, arrangement);
  }
  return [...arrangements.values()].map((arrangement) => ({
    ...arrangement,
    members: [...arrangement.members],
    memberDetails: arrangement.memberDetails.sort((a, b) => finiteOr(a.index, 0) - finiteOr(b.index, 0)),
    rayOverlaps: mandalaArrangementRayOverlaps(arrangement.memberDetails),
  }));
}

function mandalaArrangementRayOverlaps(memberDetails = []) {
  const details = Array.isArray(memberDetails) ? memberDetails : [];
  const out = [];
  for (let i = 0; i < details.length; i++) {
    for (let j = i + 1; j < details.length; j++) {
      const a = details[i];
      const b = details[j];
      const aBefore = Array.isArray(a.intervalBefore) ? a.intervalBefore : a.interval;
      const bBefore = Array.isArray(b.intervalBefore) ? b.intervalBefore : b.interval;
      if (!Array.isArray(a.interval) || !Array.isArray(b.interval) || !Array.isArray(aBefore) || !Array.isArray(bBefore)) continue;
      const overlapBefore = intervalOverlap(aBefore, bBefore);
      if (overlapBefore <= 0) continue;
      const rawOverlap = intervalOverlap(a.interval, b.interval);
      const overlap = Math.max(0, rawOverlap);
      const floater = Boolean(a.floater || b.floater);
      const gravityContact = !floater &&
        [a.contactPolicy, b.contactPolicy, a.collisionPolicy, b.collisionPolicy]
          .some((policy) => String(policy || '').includes('repel'));
      out.push({
        roles: [a.role, b.role],
        overlapBefore: round(overlapBefore),
        overlap: round(overlap),
        policy: floater ? 'floater-policy' : gravityContact ? 'repel-until-contact' : 'allow-superposition',
        floater,
        resolved: gravityContact ? rawOverlap <= 0 : false,
        displacements: [finiteOr(a.displacement, 0), finiteOr(b.displacement, 0)].map(round),
      });
    }
  }
  return out;
}

function intervalOverlap(a, b) {
  return Math.min(finiteOr(a?.[1], 0), finiteOr(b?.[1], 0)) -
    Math.max(finiteOr(a?.[0], 0), finiteOr(b?.[0], 0));
}

function validateSpatialPlan({ contract, hitboxes, supports, shotGlyphs, hallMandala, meru, roomConcept, gravityEdges, zAdjacency, horizontalStacks = [], mandalaArrangements = [], contactReport, marks, shotContract }) {
  const checks = [];
  if (contract.enabled && shotContract) {
    checks.push({
      role: 'shot-contract-frozen',
      ok: shotContract.frozen === true,
      viewBox: shotContract.viewBox,
      source: shotContract.source,
    });
  }
  const contactChecks = Array.isArray(contactReport?.checks) ? contactReport.checks : [];
  if (contactChecks.length) {
    checks.push({
      role: 'declared-contact-checks-pass',
      ok: contactChecks.every((check) => check.ok),
      count: contactChecks.length,
    });
  }
  for (const edge of gravityEdges) {
    checks.push({
      role: `${edge.role}:gravity-resolved`,
      ok: edge.resolved,
      bodyRole: edge.bodyRole,
      supportRole: edge.supportRole,
    });
    checks.push({
      role: `${edge.role}:z-adjacency`,
      ok: zAdjacency.some((item) => item.role === edge.role),
      bodyRole: edge.bodyRole,
      supportRole: edge.supportRole,
    });
  }
  const relaxedShadowRoles = new Set((Array.isArray(marks) ? marks : [])
    .filter((mark) => mark?.metamandalaRelaxed && isShadowRole(mark.role))
    .map((mark) => mark.role));
  for (const edge of gravityEdges) {
    for (const shadowRole of edge.shadowRoles) {
      checks.push({
        role: `${shadowRole}:shadow-stays-receiver-owned`,
        ok: !relaxedShadowRoles.has(shadowRole),
        shadowRole,
        receiverRole: edge.supportRole,
      });
    }
  }
  for (const stack of horizontalStacks) {
    checks.push({
      role: `${stack.role}:horizontal-stack-members-resolved`,
      ok: stack.memberCount > 0,
      mode: stack.mode,
      memberCollision: stack.memberCollision,
      reason: stack.memberCount > 0
        ? 'horizontal stack lowered into member marks'
        : 'horizontal stack has no lowered member marks',
    });
    if (stack.mode === 'gravity') {
      const hasGravityEdge = gravityEdges.some((edge) => edge.bodyRole === stack.role || edge.bodyRole === stack.role.replace(/:$/, ''));
      checks.push({
        role: `${stack.role}:gravity-stack-has-support-role`,
        ok: Boolean(stack.supportRole || hasGravityEdge),
        reason: stack.supportRole || hasGravityEdge
          ? 'gravity horizontal stack is tied to a support role'
          : 'gravity horizontal stack needs supportRole or an explicit gravity body',
      });
    }
    if (stack.mode === 'superposition') {
      checks.push({
        role: `${stack.role}:superposition-stack-allows-overlap`,
        ok: stack.memberCollision === 'allow',
        reason: stack.memberCollision === 'allow'
          ? 'superposition stack treats overlap as authorship'
          : 'superposition stack should allow member/member overlap',
      });
      if (stack.skinPolicy === 'join') {
        checks.push({
          role: `${stack.role}:superposition-stack-has-joined-skin`,
          ok: stack.hasJoinedSkin,
          reason: stack.hasJoinedSkin
            ? 'superposition stack emitted a compound skin'
            : 'superposition stack requested joined skin but none was emitted',
        });
      }
    }
  }
  for (const arrangement of mandalaArrangements) {
    checks.push({
      role: `${arrangement.role}:mandala-arrangement-has-basis`,
      ok: Boolean(arrangement.basisKind && arrangement.localSpace),
      profile: arrangement.profile,
      basisKind: arrangement.basisKind,
      localSpace: arrangement.localSpace,
      reason: arrangement.basisKind && arrangement.localSpace
        ? 'arrangement lowered through a local mandala basis'
        : 'arrangement is missing local mandala basis metadata',
    });
    checks.push({
      role: `${arrangement.role}:mandala-arrangement-has-active-ray`,
      ok: ['east-west', 'north-south', 'zenith-nadir'].includes(arrangement.activeRay),
      profile: arrangement.profile,
      activeRay: arrangement.activeRay,
      reason: ['east-west', 'north-south', 'zenith-nadir'].includes(arrangement.activeRay)
        ? 'arrangement declares a mandala contact ray'
        : 'arrangement is missing a normalized active ray',
    });
    for (const overlap of arrangement.rayOverlaps || []) {
      checks.push({
        role: `${arrangement.role}:${overlap.roles.join('+')}:ray-overlap-policy`,
        ok: overlap.floater || overlap.policy === 'repel-until-contact' || overlap.policy === 'allow-superposition',
        activeRay: arrangement.activeRay,
        overlap: overlap.overlap,
        policy: overlap.policy,
        floater: overlap.floater,
      });
    }
  }
  for (const glyph of shotGlyphs || []) {
    checks.push({
      role: `${glyph.id}:shot-glyph-has-camera-vector`,
      ok: Boolean(glyph.cameraVector),
      glyphId: glyph.id,
    });
    checks.push({
      role: `${glyph.id}:shot-glyph-has-light-entry`,
      ok: Boolean(glyph.lightEntry),
      glyphId: glyph.id,
    });
    checks.push({
      role: `${glyph.id}:shot-glyph-has-support`,
      ok: Boolean(glyph.support),
      glyphId: glyph.id,
    });
    if (glyph.vanishingHub) {
      checks.push({
        role: `${glyph.id}:shot-glyph-has-vanishing-hub`,
        ok: Boolean(hallMandala?.vanishingHub),
        glyphId: glyph.id,
      });
    }
  }
  if (hallMandala) {
    checks.push({
      role: 'hall-mandala-has-axis-mundi',
      ok: Boolean(hallMandala.vanishingHub && hallMandala.axisMundi),
      vanishingHub: hallMandala.vanishingHub,
    });
    checks.push({
      role: 'hall-mandala-has-staging-slots',
      ok: hallMandala.slots.length >= 3 && hallMandala.depthBands.length >= 2,
      slots: hallMandala.slots,
      depthBands: hallMandala.depthBands,
    });
  }
  if (meru) {
    checks.push({
      role: 'meru-normalized-to-metamandala',
      ok: meru.surfaceCount > 0 || meru.lightSourceCount > 0,
      surfaceCount: meru.surfaceCount,
      lightSourceCount: meru.lightSourceCount,
    });
  }
  if (roomConcept) {
    checks.push({
      role: 'room-concept-camera-generated',
      ok: roomConcept.twoPointCameraGenerated,
      cameraMode: roomConcept.camera?.mode,
      primitive: roomConcept.camera?.primitive,
    });
    checks.push({
      role: 'room-concept-has-floor-and-walls',
      ok: Boolean(roomConcept.frame?.floorPlane && roomConcept.frame?.leftWall && roomConcept.frame?.rightWall && roomConcept.frame?.backWall),
    });
    for (const role of roomConcept.requiredRoles || []) {
      checks.push({
        role: `${role}:room-pin-projected`,
        ok: roomConcept.pinnedElements.some((pin) => pin.role === role),
        requiredRole: role,
      });
    }
    if (roomConcept.fullFrame) {
      const coverage = roomConcept.frame?.coverage;
      const ok = Boolean(coverage && coverage.width >= 0.92 && coverage.height >= 0.9);
      checks.push({
        role: 'room-full-frame-envelope',
        ok,
        coverage,
        rule: 'full-frame room shots validate the projected room envelope, not individual skins',
      });
    }
  }
  if (contract.enabled && gravityEdges.length && !supports.length) {
    checks.push({
      role: 'gravity-has-support-surface',
      ok: false,
      reason: 'gravity declared bodies but no support surfaces resolved',
    });
  }
  if (contract.enabled && supports.some((support) => support.source === 'constellation-hitbox') && !hitboxes.length) {
    checks.push({
      role: 'hitbox-supports-have-hitboxes',
      ok: false,
      reason: 'support surface resolved from hitbox but hitbox registry is empty',
    });
  }
  return {
    ok: checks.every((check) => check.ok !== false),
    checks,
  };
}

function combinedMarkBounds(marks) {
  const boxes = (Array.isArray(marks) ? marks : [])
    .map((mark) => markScreenBounds(mark))
    .filter(Boolean);
  if (!boxes.length) return null;
  const minX = Math.min(...boxes.map((box) => box.minX));
  const minY = Math.min(...boxes.map((box) => box.minY));
  const maxX = Math.max(...boxes.map((box) => box.maxX));
  const maxY = Math.max(...boxes.map((box) => box.maxY));
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

function markScreenBounds(mark) {
  const points = markScreenPoints(mark);
  if (!points.length) return null;
  return bbox(points);
}

function markScreenPoints(mark) {
  if (!mark || typeof mark !== 'object') return [];
  if (Array.isArray(mark.points)) {
    return mark.points.filter((point) => validPoint(point)).map((point) => [Number(point[0]), Number(point[1])]);
  }
  if (Number.isFinite(Number(mark.x1)) && Number.isFinite(Number(mark.y1)) &&
    Number.isFinite(Number(mark.x2)) && Number.isFinite(Number(mark.y2))) {
    return [[Number(mark.x1), Number(mark.y1)], [Number(mark.x2), Number(mark.y2)]];
  }
  if (Number.isFinite(Number(mark.x)) && Number.isFinite(Number(mark.y)) &&
    Number.isFinite(Number(mark.w ?? mark.width)) && Number.isFinite(Number(mark.h ?? mark.height))) {
    const w = Number(mark.w ?? mark.width);
    const h = Number(mark.h ?? mark.height);
    return [[Number(mark.x), Number(mark.y)], [Number(mark.x) + w, Number(mark.y)], [Number(mark.x) + w, Number(mark.y) + h], [Number(mark.x), Number(mark.y) + h]];
  }
  if (Number.isFinite(Number(mark.cx)) && Number.isFinite(Number(mark.cy)) && Number.isFinite(Number(mark.r))) {
    return [[mark.cx - mark.r, mark.cy - mark.r], [mark.cx + mark.r, mark.cy + mark.r]];
  }
  if (Number.isFinite(Number(mark.anchor?.[0])) && Number.isFinite(Number(mark.anchor?.[1]))) {
    const rx = finiteOr(mark.rx, finiteOr(mark.r, 0));
    const ry = finiteOr(mark.ry, finiteOr(mark.r, 0));
    return [[mark.anchor[0] - rx, mark.anchor[1] - ry], [mark.anchor[0] + rx, mark.anchor[1] + ry]];
  }
  return [];
}

function roundBox(box) {
  if (!box) return null;
  return {
    minX: round(box.minX),
    minY: round(box.minY),
    maxX: round(box.maxX),
    maxY: round(box.maxY),
    w: round(box.w),
    h: round(box.h),
  };
}

function applySpatialPlanMaterialization(marks, spatialPlan) {
  if (!spatialPlan?.contract?.enabled) return marks;
  if (spatialPlan.materializationGate.status === 'blocked' &&
    spatialPlan.materializationGate.mode === 'planning-valid') {
    return spatialPlanDiagnosticMarks(spatialPlan);
  }
  return marks.map((mark) => {
    if (!isSpatialPlanMaterializedMark(mark)) return mark;
    return {
      ...mark,
      spatialPlanMaterialized: true,
      spatialPlanMode: spatialPlan.contract.mode,
      materializationGate: spatialPlan.materializationGate.status,
    };
  });
}

function isSpatialPlanMaterializedMark(mark) {
  if (!mark || typeof mark !== 'object') return false;
  if (mark.constellationDebug || mark.metamandalaDebug || mark.metamandalaLightDebug || mark.mandalaCameraWindowDebug) {
    return false;
  }
  return ['polygon', 'polyline', 'line', 'rect', 'circle', 'ellipse', 'text'].includes(mark.kind);
}

function refuseExpansionWithDiagnostics(manifest, authorshipPreview, includeHighlights) {
  const blocking = (authorshipPreview.checks || []).filter((check) => check.ok === false && check.gating === true);
  const advisory = (authorshipPreview.checks || []).filter((check) => check.ok === false && check.gating !== true);
  const refusalMarks = authorshipPreviewDiagnosticMarks(authorshipPreview, blocking);

  const stages = [
    { id: 'intent', status: 'input' },
    {
      id: 'authorship-preview',
      status: 'blocked',
      gateActive: true,
      blockingCount: authorshipPreview.blockingCount ?? blocking.length,
      advisoryCount: authorshipPreview.advisoryCount ?? advisory.length,
    },
    { id: 'abstract-constellation', status: 'not-evaluated' },
    { id: 'shot-contract', status: 'not-evaluated' },
    { id: 'meru-basis', status: 'not-evaluated' },
    { id: 'physical-hitboxes', status: 'not-evaluated' },
    { id: 'material-contracts', status: 'not-evaluated' },
    { id: 'construction-adapters', status: 'not-evaluated' },
    { id: 'visible-skin', status: 'not-evaluated' },
    { id: 'preflight-verdict', status: 'not-evaluated' },
    { id: 'budget', status: 'not-evaluated' },
    { id: 'reconciliation', status: 'not-evaluated' },
  ];

  const authorshipPreviewSummary = {
    immutable: true,
    verdict: 'blocked',
    phase: 'pre-expansion',
    gateActive: true,
    materializationGate: authorshipPreview.materializationGate,
  };
  const preflightSummary = { immutable: true, verdict: 'not-evaluated', phase: 'post-expansion' };
  const reconciliationSummary = { invalidatesPreflight: false, invalidatesAuthorshipPreview: false };

  return {
    ...manifest,
    marks: refusalMarks,
    neoRembrandt: {
      expanded: false,
      expansionRefused: true,
      refusalReason: 'authorship-preview-blocked',
      includeHighlights,
      authorshipPreview: {
        ...authorshipPreviewSummary,
        checks: authorshipPreview.checks || [],
        blockingCount: authorshipPreview.blockingCount ?? blocking.length,
        advisoryCount: authorshipPreview.advisoryCount ?? advisory.length,
      },
      preflight: {
        ...preflightSummary,
        validation: null,
        materializationGate: null,
        shotContract: null,
        shotContractFit: null,
      },
      reconciliation: {
        ...reconciliationSummary,
        applied: false,
        shotContractMutated: false,
        shotContractOverflow: null,
      },
      chain: {
        stages,
        authorshipPreview: authorshipPreviewSummary,
        preflight: preflightSummary,
        reconciliation: reconciliationSummary,
      },
    },
  };
}

function authorshipPreviewDiagnosticMarks(authorshipPreview, blocking) {
  const rows = blocking.length ? blocking : [{
    role: 'authorship-preview-blocked',
    reason: 'authorship preview blocked materialization',
  }];
  const rowHeight = 24;
  const width = 580;
  const height = 58 + rows.length * rowHeight;
  const marks = [
    {
      kind: 'rect',
      role: 'authorship-preview:blocked-panel',
      x: 24,
      y: 24,
      w: width,
      h: height,
      fill: '#2a1a17',
      stroke: '#d4885d',
      strokeWidth: 1.4,
      z: 980,
      authorshipPreviewDiagnostic: true,
      materializationGate: authorshipPreview.materializationGate,
    },
    {
      kind: 'text',
      role: 'authorship-preview:blocked-title',
      x: 42,
      y: 52,
      value: 'Authorship preview blocked expansion',
      size: 16,
      weight: 700,
      color: '#ffe0b6',
      z: 981,
      authorshipPreviewDiagnostic: true,
      materializationGate: authorshipPreview.materializationGate,
    },
  ];
  rows.forEach((check, index) => {
    marks.push({
      kind: 'text',
      role: `authorship-preview:blocked-check-${index + 1}`,
      x: 42,
      y: 84 + index * rowHeight,
      value: `${check.role || 'check'}${check.reason ? `: ${check.reason}` : ''}`,
      size: 12,
      color: '#ffc7a8',
      z: 981 + index * 0.01,
      authorshipPreviewDiagnostic: true,
      materializationGate: authorshipPreview.materializationGate,
      authorshipPreviewCheckRole: check.role,
    });
  });
  return marks;
}

function spatialPlanDiagnosticMarks(spatialPlan) {
  const failed = spatialPlan.validation.checks.filter((check) => check.ok === false);
  const rows = failed.length ? failed : [{
    role: 'spatial-plan-blocked',
    reason: 'spatial plan blocked materialization',
  }];
  const rowHeight = 24;
  const width = 560;
  const height = 58 + rows.length * rowHeight;
  const marks = [
    {
      kind: 'rect',
      role: 'spatial-plan:blocked-panel',
      x: 24,
      y: 24,
      w: width,
      h: height,
      fill: '#2a1717',
      stroke: '#d45d5d',
      strokeWidth: 1.4,
      z: 980,
      spatialPlanDiagnostic: true,
      materializationGate: 'blocked',
    },
    {
      kind: 'text',
      role: 'spatial-plan:blocked-title',
      x: 42,
      y: 52,
      value: 'Spatial plan blocked materialization',
      size: 16,
      weight: 700,
      color: '#ffd2d2',
      z: 981,
      spatialPlanDiagnostic: true,
      materializationGate: 'blocked',
    },
  ];
  rows.forEach((check, index) => {
    marks.push({
      kind: 'text',
      role: `spatial-plan:blocked-check-${index + 1}`,
      x: 42,
      y: 84 + index * rowHeight,
      value: `${check.role || 'check'}${check.reason ? `: ${check.reason}` : ''}`,
      size: 12,
      color: '#ffb4a8',
      z: 981 + index * 0.01,
      spatialPlanDiagnostic: true,
      materializationGate: 'blocked',
      spatialPlanCheckRole: check.role,
    });
  });
  return marks;
}

function resolveMetamandalaLightScene(manifest) {
  const sources = normalizedMetamandalaLightSources(manifest);
  if (!sources.length) return manifest;
  const primary = sources.find((source) => source.primary !== false) || sources[0];
  const direction = primary.direction || directionFromDegrees(primary.angleDegrees);
  return {
    ...manifest,
    scene: {
      ...(manifest.scene || {}),
      light: {
        ...(manifest.scene?.light || {}),
        direction,
        z: finiteOr(primary.z, finiteOr(manifest.scene?.light?.z, 0.72)),
        kind: primary.kind,
        role: primary.role,
        source: 'metamandala-light',
      },
    },
    polygonizer: {
      ...(manifest.polygonizer || {}),
      metamandala: {
        ...(manifest.polygonizer?.metamandala || {}),
        resolvedLightSource: {
          role: primary.role,
          kind: primary.kind,
          angleDegrees: primary.angleDegrees,
          direction,
        },
      },
    },
  };
}

function resolveMetamandalaLighting(manifest) {
  const sources = normalizedMetamandalaLightSources(manifest);
  if (!sources.length) return { lighting: null, debugMarks: [] };
  const lighting = {
    kind: 'metamandala-lighting',
    coordinateSpace: 'shot-mandala-vector-space',
    sources: sources.map((source) => ({
      role: source.role,
      kind: source.kind,
      origin: source.origin,
      angleDegrees: source.angleDegrees,
      spreadDegrees: source.spreadDegrees,
      direction: source.direction || directionFromDegrees(source.angleDegrees),
      intensity: source.intensity,
      color: source.color,
      z: source.z,
    })),
    rule: 'light rays are deterministic vectors in metamandala space before shading/highlight passes',
  };
  return {
    lighting,
    debugMarks: sources.flatMap((source, index) => source.debug ? metamandalaLightDebugMarks(source, manifest, index) : []),
  };
}

function normalizedMetamandalaLightSources(manifest) {
  const meta = manifest?.polygonizer?.metamandala || {};
  const layer = manifest?.polygonizer?.mandalaPatternLayer || {};
  const raw = Array.isArray(meta.lightSources)
    ? meta.lightSources
    : Array.isArray(meta.lights)
      ? meta.lights
      : Array.isArray(layer.lightSources)
        ? layer.lightSources
        : [];
  return raw
    .map((source, index) => normalizeMetamandalaLightSource(source, manifest, index))
    .filter(Boolean);
}

function normalizeMetamandalaLightSource(source, manifest, index) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
  const direction = validVector2(source.direction) || null;
  const angleDegrees = Number.isFinite(source.angleDegrees)
    ? source.angleDegrees
    : direction ? degreesFromDirection(direction) : -126;
  return {
    role: source.role || `metamandala-light-${index + 1}`,
    kind: source.kind || source.type || 'directional',
    origin: validVector2(source.origin) || validVector2(source.point) || [0, 0],
    screenOrigin: validPoint(source.screenOrigin) || lightDefaultScreenOrigin(manifest),
    angleDegrees: round(angleDegrees),
    spreadDegrees: clamp(finiteOr(source.spreadDegrees, finiteOr(source.coneDegrees, 0)), 0, 180),
    direction: direction ? normalize(direction) : null,
    intensity: clamp(finiteOr(source.intensity, 1), 0, 4),
    color: source.color || '#fff3ce',
    z: finiteOr(source.z, finiteOr(manifest?.scene?.light?.z, 0.72)),
    length: Math.max(finiteOr(source.length, 1), 0.01),
    unitScale: Math.max(finiteOr(source.unitScale, 170), 1),
    diffusion: normalizeMetamandalaLightDiffusion(source.diffusion),
    debug: source.debug === true || source.showDebug === true || source.renderDebug === true,
    primary: source.primary,
    stroke: source.stroke,
    opacity: source.opacity,
    label: source.label,
  };
}

function normalizeMetamandalaLightDiffusion(diffusion) {
  if (!diffusion || typeof diffusion !== 'object' || Array.isArray(diffusion)) return null;
  return {
    ...diffusion,
    enabled: diffusion.enabled === true || diffusion.mode === 'pure-vector' || Boolean(diffusion.beam || diffusion.preset),
  };
}

const LIGHT_DIFFUSION_BEAM_PRESETS = {
  slice: {
    rays: 16,
    bounces: 0,
    falloff: 0.55,
    minPower: 0.04,
    effects: ['tone'],
  },
  'soft-window': {
    rays: 24,
    bounces: 1,
    falloff: 0.45,
    minPower: 0.035,
    spreadDegrees: 18,
    originSpread: 160,
    effects: ['tone', 'rim', 'aura'],
  },
  'wide-ambient': {
    rays: 36,
    bounces: 1,
    falloff: 0.35,
    minPower: 0.03,
    spreadDegrees: 70,
    originSpread: 240,
    intensityScale: 0.68,
    effects: ['tone', 'aura'],
  },
  'grazing-rake': {
    rays: 18,
    bounces: 2,
    falloff: 0.58,
    minPower: 0.035,
    spreadDegrees: 8,
    originSpread: 220,
    effects: ['tone', 'rim'],
  },
};

function resolveLightDiffusionConfig(source) {
  const raw = source?.diffusion || {};
  const beamSpec = raw.beam && typeof raw.beam === 'object' && !Array.isArray(raw.beam) ? raw.beam : {};
  const beam = typeof raw.beam === 'string' ? raw.beam : (raw.preset || beamSpec.mode || 'slice');
  const preset = LIGHT_DIFFUSION_BEAM_PRESETS[beam] || LIGHT_DIFFUSION_BEAM_PRESETS.slice;
  const effects = normalizeLightDiffusionEffects(raw.effects ?? raw.activationEffects ?? preset.effects);
  const beamWidthPx = Math.max(
    finiteOr(raw.beamWidthPx ?? raw.widthPx ?? beamSpec.widthPx ?? beamSpec.width, preset.beamWidthPx ?? 1),
    0.001,
  );
  return {
    ...preset,
    ...raw,
    beam,
    beamMode: beamSpec.mode || raw.mode || beam,
    beamProfile: raw.profile || beamSpec.profile || preset.beamProfile || 'laser',
    beamWidthPx,
    sampleBudget: Math.max(1, Math.round(finiteOr(raw.sampleBudget ?? beamSpec.sampleBudget, raw.rays ?? preset.rays ?? 1))),
    enabled: raw.enabled === true || raw.mode === 'pure-vector' || Boolean(raw.beam || raw.preset),
    effects,
    toneStrength: clamp(finiteOr(raw.toneStrength, preset.toneStrength ?? 0.18), 0, 1),
    rimOpacity: clamp(finiteOr(raw.rimOpacity, raw.rim?.opacity ?? preset.rimOpacity ?? 0.42), 0, 1),
    auraOpacity: clamp(finiteOr(raw.auraOpacity, raw.aura?.opacity ?? preset.auraOpacity ?? 0.16), 0, 1),
    auraScale: Math.max(finiteOr(raw.auraScale, raw.aura?.scale ?? preset.auraScale ?? 1), 0.1),
  };
}

function sceneAmbientLightIntensity(manifest) {
  const raw = manifest?.scene?.ambientLight
    ?? manifest?.scene?.ambient
    ?? manifest?.polygonizer?.metamandala?.ambientLight;
  if (typeof raw === 'number') return clamp(finiteOr(raw, 0), 0, 4);
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return clamp(finiteOr(raw.intensity ?? raw.brightness ?? raw.value, 0), 0, 4);
  }
  return 0;
}

function normalizeLightDiffusionEffects(effects) {
  const list = Array.isArray(effects)
    ? effects
    : typeof effects === 'string'
      ? effects.split(/[,\s]+/)
      : ['tone'];
  const allowed = new Set(['tone', 'rim', 'edge', 'aura']);
  const normalized = list
    .map((effect) => String(effect || '').trim().toLowerCase())
    .map((effect) => (effect === 'edge' ? 'rim' : effect))
    .filter((effect) => allowed.has(effect));
  return [...new Set(normalized.length ? normalized : ['tone'])];
}

function lightDefaultScreenOrigin(manifest) {
  const window = manifest?.polygonizer?.mandalaPatternLayer?.cameraWindow;
  if (window && typeof window === 'object' && !Array.isArray(window)) {
    const origin = validPoint(window.screenOrigin);
    if (origin) return origin;
  }
  const viewBox = manifest?.viewBox || {};
  return [
    finiteOr(viewBox.width, 800) / 2,
    finiteOr(manifest?.polygonizer?.draftingTable?.baselineY, finiteOr(viewBox.height, 520) * 0.78),
  ];
}

function directionFromDegrees(degrees) {
  const radians = (finiteOr(degrees, -126) * Math.PI) / 180;
  return roundPointTuple(normalize([Math.cos(radians), Math.sin(radians)]));
}

function degreesFromDirection(direction) {
  const normalized = normalize(direction);
  return (Math.atan2(normalized[1], normalized[0]) * 180) / Math.PI;
}

function metamandalaLightDebugMarks(source, manifest, index) {
  const direction = source.direction || directionFromDegrees(source.angleDegrees);
  const origin = source.screenOrigin;
  const length = source.length * source.unitScale;
  const end = [
    roundPoint(origin[0] + direction[0] * length),
    roundPoint(origin[1] + direction[1] * length),
  ];
  const stroke = source.stroke || source.color || '#fff3ce';
  const opacity = clamp(finiteOr(source.opacity, 0.68), 0, 1);
  const z = 935 + index * 0.1;
  const marks = [
    {
      kind: 'line',
      role: `metamandala-light:${source.role}:ray`,
      x1: roundPoint(origin[0]),
      y1: roundPoint(origin[1]),
      x2: end[0],
      y2: end[1],
      stroke,
      strokeWidth: 2,
      opacity,
      z,
      metamandalaLightDebug: true,
      metamandalaLightRole: source.role,
      metamandalaLightKind: source.kind,
      metamandalaLightAngleDegrees: source.angleDegrees,
    },
    {
      kind: 'circle',
      role: `metamandala-light:${source.role}:origin`,
      cx: roundPoint(origin[0]),
      cy: roundPoint(origin[1]),
      r: 4,
      fill: stroke,
      stroke: '#2f241f',
      strokeWidth: 1,
      opacity: Math.min(opacity + 0.18, 1),
      z: z + 0.01,
      metamandalaLightDebug: true,
      metamandalaLightRole: source.role,
    },
  ];
  if (source.spreadDegrees > 0) {
    const left = directionFromDegrees(source.angleDegrees - source.spreadDegrees / 2);
    const right = directionFromDegrees(source.angleDegrees + source.spreadDegrees / 2);
    for (const [side, vector] of [['left', left], ['right', right]]) {
      marks.push({
        kind: 'line',
        role: `metamandala-light:${source.role}:cone-${side}`,
        x1: roundPoint(origin[0]),
        y1: roundPoint(origin[1]),
        x2: roundPoint(origin[0] + vector[0] * length * 0.9),
        y2: roundPoint(origin[1] + vector[1] * length * 0.9),
        stroke,
        strokeWidth: 1,
        opacity: opacity * 0.58,
        dash: '4 6',
        z: z + 0.02,
        metamandalaLightDebug: true,
        metamandalaLightRole: source.role,
        metamandalaLightCone: side,
      });
    }
  }
  marks.push({
    kind: 'text',
    role: `metamandala-light:${source.role}:label`,
    x: roundPoint(origin[0] + 8),
    y: roundPoint(origin[1] - 8),
    value: source.label || `${source.kind} ${source.angleDegrees}deg`,
    size: 11,
    color: stroke,
    opacity,
    z: z + 0.04,
    metamandalaLightDebug: true,
    metamandalaLightRole: source.role,
  });
  return marks;
}

function applyMetamandalaLightDiffusion(marks, manifest) {
  const sources = normalizedMetamandalaLightSources(manifest).filter((source) => source.diffusion?.enabled);
  if (!sources.length || !Array.isArray(marks)) {
    return { marks, applied: false, report: null, debugMarks: [] };
  }
  const faceCandidates = lightDiffusionFaceCandidates(marks);
  if (!faceCandidates.length) {
    return {
      marks,
      applied: false,
      report: { kind: 'metamandala-light-diffusion', sourceCount: sources.length, rayCount: 0, hitCount: 0, faceCount: 0 },
      debugMarks: [],
    };
  }

  const activations = new Map();
  const debugMarks = [];
  let rayCount = 0;
  let hitCount = 0;
  const beams = new Set();
  const beamWidths = new Set();
  const effects = new Set();
  const ambientIntensity = sceneAmbientLightIntensity(manifest);
  sources.forEach((source, sourceIndex) => {
    const diffusion = resolveLightDiffusionConfig(source);
    beams.add(diffusion.beam);
    beamWidths.add(round(diffusion.beamWidthPx));
    diffusion.effects.forEach((effect) => effects.add(effect));
    const rays = Math.max(1, Math.min(240, Math.round(finiteOr(diffusion.rays, diffusion.rayCount ?? 16))));
    const bounces = Math.max(0, Math.min(8, Math.round(finiteOr(diffusion.bounces, diffusion.bounceCount ?? 0))));
    const falloff = clamp(finiteOr(diffusion.falloff, 0.55), 0, 1);
    const minPower = clamp(finiteOr(diffusion.minPower, 0.04), 0, 1);
    const length = Math.max(finiteOr(diffusion.length, source.length * source.unitScale), 1);
    const baseDirection = source.direction || directionFromDegrees(source.angleDegrees);
    const spread = finiteOr(diffusion.spreadDegrees, source.spreadDegrees);
    const origins = lightDiffusionRayOrigins(source, manifest, rays);
    for (let i = 0; i < rays; i++) {
      rayCount += 1;
      const t = rays === 1 ? 0.5 : i / (rays - 1);
      const angle = source.angleDegrees + (spread ? lerp(-spread / 2, spread / 2, t) : 0);
      const direction = spread ? directionFromDegrees(angle) : baseDirection;
      const origin = origins[i] || source.screenOrigin;
      const trace = traceLightDiffusionRay({
        source,
        sourceIndex,
        rayIndex: i,
        origin,
        direction,
        power: clamp(finiteOr(source.intensity, 1) * finiteOr(diffusion.intensityScale, 1), 0, 4),
        length,
        bounces,
        falloff,
        minPower,
        diffusion,
        faceCandidates,
        activations,
        ambientIntensity,
        debug: diffusion.debug === true || source.debugDiffusion === true,
      });
      hitCount += trace.hitCount;
      debugMarks.push(...trace.debugMarks);
    }
  });

  if (!activations.size && !debugMarks.length) {
    return {
      marks,
      applied: false,
      report: { kind: 'metamandala-light-diffusion', sourceCount: sources.length, rayCount, hitCount: 0, faceCount: 0 },
      debugMarks: [],
    };
  }

  const activatedMarks = marks.map((mark, index) => {
    const activation = activations.get(index);
    if (!activation) return mark;
    const factor = 1 + clamp(activation.energy, 0, 1.25) * activation.toneStrength;
    return {
      ...mark,
      fill: activation.applyTone && mark.fill ? shadeHex(mark.fill, factor) : mark.fill,
      lightActivation: round(activation.energy),
      lightHits: activation.hits,
      lightBounceDepth: activation.maxBounce,
      lightSourceRoles: [...activation.sources],
      lightActivationEffects: [...activation.effects],
      lightActivationBeam: [...activation.beams][0],
      lightRayBrightness: round(activation.rayBrightness),
      lightImpactBrightness: round(activation.impactBrightness),
      lightFluence: round(activation.fluence),
      lightAmbientIntensity: round(activation.ambientIntensity),
      lightBeamWidthPx: round(activation.beamWidthPx),
      lightBeamProfile: activation.beamProfile,
      lightSkinTransparency: activation.skinTransparency,
      lightTransmissionMode: activation.transmissionMode || 'opaque',
      lightDiffusionActivated: true,
      lightDiffusionMode: 'pure-vector',
    };
  });
  const effectMarks = lightDiffusionActivationEffectMarks(faceCandidates, activations);
  const report = {
    kind: 'metamandala-light-diffusion',
    mode: 'pure-vector',
    beams: [...beams],
    beamWidths: [...beamWidths],
    ambientIntensity: round(ambientIntensity),
    effects: [...effects],
    sourceCount: sources.length,
    rayCount,
    hitCount,
    faceCount: activations.size,
    effectMarkCount: effectMarks.length,
    debugRayCount: debugMarks.length,
  };
  return {
    marks: activatedMarks.concat(effectMarks, debugMarks),
    applied: activations.size > 0,
    report,
    debugMarks,
  };
}

function lightDiffusionFaceCandidates(marks) {
  return marks
    .map((mark, index) => ({ mark, index }))
    .filter(({ mark }) => (
      mark?.kind === 'polygon' &&
      Array.isArray(mark.points) &&
      mark.points.length >= 3 &&
      !mark.metamandalaLightDebug &&
      !mark.constellationDebug &&
      !mark.mandalaCameraWindowDebug &&
      !mark.spatialPlanDiagnostic
    ))
    .map(({ mark, index }) => ({
      mark,
      index,
      polygon: mark.points.filter(validPoint),
      bounds: bbox(mark.points.filter(validPoint)),
      center: centroid(mark.points.filter(validPoint)),
      normal2: lightDiffusionFaceNormal2(mark),
      reflectivity: clamp(finiteOr(mark.reflectivity, finiteOr(mark.lightReflectivity, 0.35)), 0, 1),
      skinTransparency: lightDiffusionSkinTransparency(mark),
      applyTone: mark.lightDiffusionTone !== false,
    }))
    .filter((item) => item.polygon.length >= 3);
}

function lightDiffusionSkinTransparency(mark = {}) {
  return clamp(finiteOr(
    mark.skinTransparency,
    finiteOr(
      mark.mandalaSkinTransparency,
      finiteOr(mark.lightTransparency, finiteOr(mark.lightTransmission, 0)),
    ),
  ), -1, 1);
}

function lightDiffusionFaceNormal2(mark) {
  if (Array.isArray(mark.faceNormal) && mark.faceNormal.length >= 2) {
    const n = normalize([finiteOr(mark.faceNormal[0], 0), finiteOr(mark.faceNormal[1], 0)]);
    if (Math.hypot(n[0], n[1]) > 0.0001) return n;
  }
  const points = Array.isArray(mark.points) ? mark.points.filter(validPoint) : [];
  if (points.length >= 2) {
    const top = polygonEdgeAtY(points, Math.min, bbox(points).minY);
    const edge = normalize([top[1][0] - top[0][0], top[1][1] - top[0][1]]);
    const normal = normalize([-edge[1], edge[0]]);
    return normal[1] > 0 ? [-normal[0], -normal[1]] : normal;
  }
  return [0, -1];
}

function lightDiffusionRayOrigins(source, manifest, rays) {
  if (Array.isArray(source.diffusion?.origins)) {
    return source.diffusion.origins.filter(validPoint);
  }
  const origin = validPoint(source.diffusion?.screenOrigin) || source.screenOrigin;
  const spreadWidth = finiteOr(source.diffusion?.originSpread, 0);
  if (!spreadWidth || rays === 1) return Array.from({ length: rays }, () => origin);
  const dir = source.direction || directionFromDegrees(source.angleDegrees);
  const perp = normalize([-dir[1], dir[0]]);
  return Array.from({ length: rays }, (_, index) => {
    const t = rays === 1 ? 0 : index / (rays - 1) - 0.5;
    return [
      roundPoint(origin[0] + perp[0] * spreadWidth * t),
      roundPoint(origin[1] + perp[1] * spreadWidth * t),
    ];
  });
}

function lightDiffusionActivationEffectMarks(faceCandidates, activations) {
  const marks = [];
  const byIndex = new Map(faceCandidates.map((face) => [face.index, face]));
  for (const [index, activation] of activations.entries()) {
    const face = byIndex.get(index);
    if (!face) continue;
    const color = [...activation.colors][0] || '#fff3ce';
    const effects = activation.effects || new Set();
    const energy = clamp(activation.energy, 0, 1.8);
    const sourceRoles = [...activation.sources];
    const beam = [...activation.beams][0] || 'slice';
    const baseZ = finiteOr(face.mark.z, 0) + 0.065;
    if (effects.has('aura')) {
      const rx = Math.max(face.bounds.w * 0.52 * activation.auraScale, 8);
      const ry = Math.max(face.bounds.h * 0.52 * activation.auraScale, 6);
      marks.push({
        kind: 'polygon',
        role: `${face.mark.role || `face-${index}`}:light-aura`,
        points: ellipsePoints(face.center[0], face.center[1], rx, ry, 18),
        fill: color,
        stroke: 'none',
        opacity: round(clamp(activation.auraOpacity * Math.min(energy, 1), 0.025, 0.28)),
        z: baseZ,
        lightActivationEffect: 'aura',
        lightActivation: round(activation.energy),
        lightSourceRoles: sourceRoles,
        lightActivationBeam: beam,
        lightDiffusionMode: 'pure-vector',
      });
    }
    if (effects.has('rim')) {
      const edge = lightDiffusionBrightEdge(face);
      marks.push({
        kind: 'line',
        role: `${face.mark.role || `face-${index}`}:light-rim`,
        x1: edge[0][0],
        y1: edge[0][1],
        x2: edge[1][0],
        y2: edge[1][1],
        stroke: color,
        strokeWidth: round(clamp(1.1 + energy * 1.4, 1.1, 3.4)),
        opacity: round(clamp(activation.rimOpacity * Math.min(energy, 1.15), 0.1, 0.72)),
        z: baseZ + 0.01,
        lightActivationEffect: 'rim',
        lightActivation: round(activation.energy),
        lightSourceRoles: sourceRoles,
        lightActivationBeam: beam,
        lightDiffusionMode: 'pure-vector',
      });
    }
  }
  return marks;
}

function lightDiffusionBrightEdge(face) {
  const points = face.polygon;
  const normal = face.normal2 || [0, -1];
  if (Math.abs(normal[0]) > Math.abs(normal[1])) {
    return polygonEdgeAtX(points, normal[0] < 0 ? Math.min : Math.max, normal[0] < 0 ? face.bounds.minX : face.bounds.maxX);
  }
  return polygonEdgeAtY(points, normal[1] < 0 ? Math.min : Math.max, normal[1] < 0 ? face.bounds.minY : face.bounds.maxY);
}

function traceLightDiffusionRay({ source, sourceIndex, rayIndex, origin, direction, power, length, bounces, falloff, minPower, diffusion, faceCandidates, activations, ambientIntensity = 0, debug }) {
  let currentOrigin = origin;
  let currentDirection = normalize(direction);
  let currentPower = power;
  let hitCount = 0;
  const debugMarks = [];
  const visited = new Set();
  const beamWidthPx = Math.max(finiteOr(diffusion.beamWidthPx, diffusion.widthPx ?? 1), 0.001);
  const beamProfile = diffusion.beamProfile || diffusion.profile || 'laser';
  for (let bounce = 0; bounce <= bounces && currentPower >= minPower; bounce++) {
    const hit = firstRayFaceHit(currentOrigin, currentDirection, length, faceCandidates, visited);
    const end = hit
      ? hit.point
      : [currentOrigin[0] + currentDirection[0] * length, currentOrigin[1] + currentDirection[1] * length];
    if (debug) {
      debugMarks.push(lightDiffusionDebugRayMark({
        source,
        sourceIndex,
        rayIndex,
        bounce,
        from: currentOrigin,
        to: end,
        power: currentPower,
        beamWidthPx,
        beamProfile,
        ambientIntensity,
        hitRole: hit?.face.mark.role,
        hitTransmissionMode: hit?.face.skinTransparency < 0 ? 'reflect' : hit?.face.skinTransparency >= 1 ? 'transmit' : hit ? 'opaque' : undefined,
      }));
    }
    if (!hit) break;
    hitCount += 1;
    visited.add(hit.face.index);
    const angleFactor = clamp(dot([-currentDirection[0], -currentDirection[1]], hit.face.normal2), 0, 1);
    const rayBrightness = currentPower;
    const energy = currentPower * Math.max(angleFactor, 0.08) * finiteOr(source.intensity, 1);
    const fluence = energy * beamWidthPx;
    const activation = activations.get(hit.face.index) || {
      energy: 0,
      hits: 0,
      maxBounce: 0,
      rayBrightness: 0,
      impactBrightness: ambientIntensity,
      fluence: 0,
      ambientIntensity,
      beamWidthPx,
      beamProfile,
      sources: new Set(),
      colors: new Set(),
      beams: new Set(),
      effects: new Set(),
      hitPoints: [],
      applyTone: hit.face.applyTone,
      skinTransparency: hit.face.skinTransparency,
      transmissionMode: hit.face.skinTransparency < 0 ? 'reflect' : hit.face.skinTransparency >= 1 ? 'transmit' : 'opaque',
      toneStrength: diffusion.effects.includes('tone') ? diffusion.toneStrength : 0,
      rimOpacity: diffusion.rimOpacity,
      auraOpacity: diffusion.auraOpacity,
      auraScale: diffusion.auraScale,
    };
    activation.energy += energy;
    activation.hits += 1;
    activation.maxBounce = Math.max(activation.maxBounce, bounce);
    activation.rayBrightness = Math.max(activation.rayBrightness, rayBrightness);
    activation.impactBrightness = Math.max(activation.impactBrightness, ambientIntensity + activation.energy);
    activation.fluence += fluence;
    activation.ambientIntensity = Math.max(activation.ambientIntensity, ambientIntensity);
    activation.beamWidthPx = Math.max(activation.beamWidthPx, beamWidthPx);
    activation.beamProfile = activation.beamProfile || beamProfile;
    activation.sources.add(source.role);
    activation.colors.add(source.color || source.stroke || '#fff3ce');
    activation.beams.add(diffusion.beam);
    diffusion.effects.forEach((effect) => activation.effects.add(effect));
    if (activation.hitPoints.length < 12) activation.hitPoints.push(hit.point);
    activation.applyTone = activation.applyTone && hit.face.applyTone && diffusion.effects.includes('tone');
    activation.skinTransparency = Math.min(finiteOr(activation.skinTransparency, 0), hit.face.skinTransparency);
    if (hit.face.skinTransparency < 0) activation.transmissionMode = 'reflect';
    activation.toneStrength = Math.max(activation.toneStrength, diffusion.effects.includes('tone') ? diffusion.toneStrength : 0);
    activation.rimOpacity = Math.max(activation.rimOpacity, diffusion.rimOpacity);
    activation.auraOpacity = Math.max(activation.auraOpacity, diffusion.auraOpacity);
    activation.auraScale = Math.max(activation.auraScale, diffusion.auraScale);
    activations.set(hit.face.index, activation);
    currentDirection = reflectVector(currentDirection, hit.face.normal2);
    currentOrigin = [
      roundPoint(hit.point[0] + currentDirection[0] * 0.5),
      roundPoint(hit.point[1] + currentDirection[1] * 0.5),
    ];
    const reflectivity = hit.face.skinTransparency < 0 ? Math.abs(hit.face.skinTransparency) : hit.face.reflectivity;
    currentPower *= falloff * reflectivity;
  }
  return { hitCount, debugMarks };
}

function firstRayFaceHit(origin, direction, length, faceCandidates, visited) {
  const end = [origin[0] + direction[0] * length, origin[1] + direction[1] * length];
  let best = null;
  for (const face of faceCandidates) {
    if (visited?.has(face.index)) continue;
    if (face.skinTransparency >= 1) continue;
    if (!rayMayHitBounds(origin, end, face.bounds)) continue;
    const hit = rayPolygonIntersection(origin, direction, face.polygon, length);
    if (!hit) continue;
    if (!best || hit.t < best.t) best = { ...hit, face };
  }
  return best;
}

function rayMayHitBounds(a, b, bounds) {
  if (!bounds) return true;
  const minX = Math.min(a[0], b[0]);
  const maxX = Math.max(a[0], b[0]);
  const minY = Math.min(a[1], b[1]);
  const maxY = Math.max(a[1], b[1]);
  return maxX >= bounds.minX && minX <= bounds.maxX && maxY >= bounds.minY && minY <= bounds.maxY;
}

function rayPolygonIntersection(origin, direction, polygon, maxLength) {
  let best = null;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const hit = raySegmentIntersection(origin, direction, a, b);
    if (!hit || hit.t < 0.001 || hit.t > maxLength) continue;
    if (!best || hit.t < best.t) best = hit;
  }
  return best;
}

function raySegmentIntersection(origin, direction, a, b) {
  const v1 = [origin[0] - a[0], origin[1] - a[1]];
  const v2 = [b[0] - a[0], b[1] - a[1]];
  const cross = direction[0] * v2[1] - direction[1] * v2[0];
  if (Math.abs(cross) < 1e-9) return null;
  const t = (v2[0] * v1[1] - v2[1] * v1[0]) / cross;
  const u = (direction[0] * v1[1] - direction[1] * v1[0]) / cross;
  if (t < 0 || u < 0 || u > 1) return null;
  return {
    t,
    u,
    point: [roundPoint(origin[0] + direction[0] * t), roundPoint(origin[1] + direction[1] * t)],
  };
}

function reflectVector(vector, normal) {
  const n = normalize(normal);
  const d = dot(vector, n);
  return normalize([vector[0] - 2 * d * n[0], vector[1] - 2 * d * n[1]]);
}

function lightDiffusionDebugRayMark({ source, sourceIndex, rayIndex, bounce, from, to, power, beamWidthPx, beamProfile, ambientIntensity, hitRole, hitTransmissionMode }) {
  return {
    kind: 'line',
    role: `metamandala-light:${source.role}:diffusion-${rayIndex + 1}-bounce-${bounce}`,
    x1: roundPoint(from[0]),
    y1: roundPoint(from[1]),
    x2: roundPoint(to[0]),
    y2: roundPoint(to[1]),
    stroke: source.diffusion?.stroke || source.stroke || source.color || '#fff3ce',
    strokeWidth: Math.max(0.5, 1.2 - bounce * 0.18),
    opacity: clamp(finiteOr(source.diffusion?.opacity, 0.48) * Math.min(power, 1), 0.08, 0.72),
    z: 940 + sourceIndex * 0.2 + rayIndex * 0.001 + bounce * 0.0001,
    metamandalaLightDebug: true,
    metamandalaLightDiffusionDebug: true,
    metamandalaLightRole: source.role,
    metamandalaLightRayIndex: rayIndex,
    metamandalaLightBounce: bounce,
    metamandalaLightPower: round(power),
    metamandalaLightBeamWidthPx: round(beamWidthPx),
    metamandalaLightBeamProfile: beamProfile,
    metamandalaLightAmbientIntensity: round(ambientIntensity),
    metamandalaLightHitRole: hitRole,
    metamandalaLightHitTransmissionMode: hitTransmissionMode,
  };
}

function buildMandalaCameraWindowGrid({ origin, left, right, length, depthSteps, laneSteps }) {
  const rows = [];
  for (let i = 1; i <= depthSteps; i++) {
    const t = i / depthSteps;
    rows.push({
      t: round(t),
      left: roundPointTuple([origin[0] + left[0] * length * t, origin[1] + left[1] * length * t]),
      right: roundPointTuple([origin[0] + right[0] * length * t, origin[1] + right[1] * length * t]),
    });
  }
  const lanes = [];
  for (let i = 0; i <= laneSteps; i++) {
    const t = i / laneSteps;
    lanes.push({
      t: round(t),
      vector: roundPointTuple([lerp(left[0], right[0], t), lerp(left[1], right[1], t)]),
    });
  }
  return { rows, lanes };
}

function mandalaCameraWindowDebugMarks(window, cameraWindow) {
  const stroke = cameraWindow.stroke || '#e8d49a';
  const laneStroke = cameraWindow.laneStroke || stroke;
  const opacity = clamp(finiteOr(cameraWindow.opacity, 0.52), 0, 1);
  const z = finiteOr(cameraWindow.z, 930);
  const project = ([x, y]) => [
    roundPoint(window.screenOrigin[0] + x * window.unitScale),
    roundPoint(window.screenOrigin[1] + y * window.unitScale),
  ];
  const origin = project(window.origin);
  const endLeft = project(window.grid.rows[window.grid.rows.length - 1]?.left || window.origin);
  const endRight = project(window.grid.rows[window.grid.rows.length - 1]?.right || window.origin);
  const marks = [
    {
      kind: 'line',
      role: 'mandala-camera-window:left-terminator',
      x1: origin[0],
      y1: origin[1],
      x2: endLeft[0],
      y2: endLeft[1],
      stroke,
      strokeWidth: finiteOr(cameraWindow.strokeWidth, 2),
      opacity,
      z,
      mandalaCameraWindowDebug: true,
    },
    {
      kind: 'line',
      role: 'mandala-camera-window:right-terminator',
      x1: origin[0],
      y1: origin[1],
      x2: endRight[0],
      y2: endRight[1],
      stroke,
      strokeWidth: finiteOr(cameraWindow.strokeWidth, 2),
      opacity,
      z,
      mandalaCameraWindowDebug: true,
    },
  ];
  window.grid.rows.forEach((row, index) => {
    const left = project(row.left);
    const right = project(row.right);
    marks.push({
      kind: 'line',
      role: `mandala-camera-window:depth-row-${index + 1}`,
      x1: left[0],
      y1: left[1],
      x2: right[0],
      y2: right[1],
      stroke: laneStroke,
      strokeWidth: finiteOr(cameraWindow.gridStrokeWidth, 1),
      opacity: opacity * 0.72,
      z: z + 0.01 + index * 0.001,
      dash: cameraWindow.dash || '5 5',
      mandalaCameraWindowDebug: true,
      mandalaCameraWindowT: row.t,
    });
  });
  window.grid.lanes.slice(1, -1).forEach((lane, index) => {
    const end = project([
      window.origin[0] + lane.vector[0],
      window.origin[1] + lane.vector[1],
    ]);
    marks.push({
      kind: 'line',
      role: `mandala-camera-window:lane-${index + 1}`,
      x1: origin[0],
      y1: origin[1],
      x2: end[0],
      y2: end[1],
      stroke: laneStroke,
      strokeWidth: finiteOr(cameraWindow.gridStrokeWidth, 1),
      opacity: opacity * 0.5,
      z: z + 0.03 + index * 0.001,
      dash: cameraWindow.dash || '5 5',
      mandalaCameraWindowDebug: true,
      mandalaCameraWindowT: lane.t,
    });
  });
  marks.push({
    kind: 'text',
    role: 'mandala-camera-window:label',
    x: origin[0],
    y: origin[1] + 18,
    value: cameraWindow.label || 'shot terminator wedge',
    size: finiteOr(cameraWindow.labelSize, 11),
    color: cameraWindow.labelColor || stroke,
    opacity: Math.min(opacity + 0.18, 1),
    z: z + 0.06,
    mandalaCameraWindowDebug: true,
  });
  return marks;
}

function validVector2(vector) {
  if (!Array.isArray(vector) || vector.length < 2) return null;
  const x = vector[0];
  const y = vector[1];
  return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
}

function depthBandRank(value) {
  const lower = String(value || '').toLowerCase();
  if (lower.includes('background')) return 0;
  if (lower.includes('foreground')) return 2;
  return 1;
}

function usesGridRenderStyle(manifest) {
  const polygonizer = manifest?.polygonizer || {};
  const cameraPrimitive = polygonizer.cameraPrimitive || manifest?.cameraPrimitive || manifest?.scene?.cameraPrimitive;
  const renderMode = polygonizer.renderMode || manifest?.scene?.renderMode || manifest?.renderMode;
  return Boolean(
    renderMode === 'grid' ||
      renderMode === 'grid-render' ||
      polygonizer.pureMandala ||
      polygonizer.constellation ||
      polygonizer.twoPointCamera ||
      cameraPrimitive,
  );
}

function isWireframeOrGridMark(mark) {
  const tokens = [
    mark.role,
    mark.constellationRole,
    mark.constructionKind,
    mark.sourceShape,
    mark.objectRef,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return /\b(grid|wireframe|mandala|constellation|debug)\b/.test(tokens);
}

function isBorderSuppressedElement(mark) {
  if (!['polygon', 'circle', 'oval', 'egg', 'blob', 'sphere', 'wedge'].includes(mark.kind)) return false;
  if (mark.algorithmic || mark.algorithm === 'pastamaker' || mark.pastamaker || mark.stickerFieldRole) return false;
  if (mark.pass === 'shadow' || mark.pass === 'highlight' || mark.pass === 'sticker-field') return false;
  if (isWireframeOrGridMark(mark)) return false;
  return mark.fill !== 'none';
}

function generateTwoPointRoomMarks(pureMandala, cameraPrimitive) {
  if (
    cameraPrimitive.cameraPoint?.kind === 'doorway-straight-eye' ||
    cameraPrimitive.canonicalAngle === 'doorway-straight-room'
  ) {
    return generateStraightDoorwayRoomMarks(pureMandala, cameraPrimitive);
  }

  const room = pureMandala.room || {};
  const floor = room.floor || {};
  const xRange = orderedRange(floor.x || [room.walls?.leftX ?? -18, room.walls?.rightX ?? 18]);
  const yRange = orderedRange(floor.y || [-28, 8]);
  const frontY = Math.max(yRange[0], yRange[1]);
  const backY = Math.min(yRange[0], yRange[1]);
  const ceilingZ = finiteOr(room.ceilingZ, 11);
  const roomBasis = {
    xRange,
    yRange,
    frontY,
    backY,
    ...(cameraPrimitive.roomBasis || {}),
  };
  const project = (xyz) => projectTwoPoint(xyz, cameraPrimitive, roomBasis);
  const point = (xyz) => {
    const p = project(xyz);
    return [p[0], p[1]];
  };
  const vpLeft = validPoint(cameraPrimitive.vanishingPoints?.left) || [-220, 245];
  const vpRight = validPoint(cameraPrimitive.vanishingPoints?.right) || [1180, 245];
  const ceilingXPoint = (x, y) => {
    const floorStart = point([xRange[0], y, 0]);
    const floorTarget = point([x, y, 0]);
    const ceilingStart = point([xRange[0], y, ceilingZ]);
    return lerpPoint(ceilingStart, vpRight, lineParameter(floorStart, vpRight, floorTarget));
  };
  const ceilingYPoint = (x, y) => {
    const floorStart = point([x, frontY, 0]);
    const floorTarget = point([x, y, 0]);
    const ceilingStart = point([x, frontY, ceilingZ]);
    return lerpPoint(ceilingStart, vpLeft, lineParameter(floorStart, vpLeft, floorTarget));
  };
  const zBase = finiteOr(cameraPrimitive.zBase, 8);
  const marks = [];
  const cameraGrammar = buildTwoPointCameraGrammar({
    cameraPrimitive,
    pureMandala,
    roomBasis,
    ceilingZ,
    project: point,
  });
  const floorCorners = {
    frontLeft: point([xRange[0], frontY, 0]),
    frontRight: point([xRange[1], frontY, 0]),
    backRight: point([xRange[1], backY, 0]),
    backLeft: point([xRange[0], backY, 0]),
  };
  const ceilingCorners = {
    frontLeft: ceilingXPoint(xRange[0], frontY),
    frontRight: ceilingXPoint(xRange[1], frontY),
    backRight: ceilingXPoint(xRange[1], backY),
    backLeft: ceilingXPoint(xRange[0], backY),
  };

  marks.push(
    polygonMark('room:floor-plane', [floorCorners.frontLeft, floorCorners.frontRight, floorCorners.backRight, floorCorners.backLeft], '#7f684b', '#3c2b1d', 0.34, zBase),
    polygonMark('room:ceiling-plane', [ceilingCorners.frontLeft, ceilingCorners.frontRight, ceilingCorners.backRight, ceilingCorners.backLeft], '#4d4033', '#8a7357', 0.24, zBase + 0.2),
    polygonMark('room:left-wall-plane', [floorCorners.frontLeft, floorCorners.backLeft, ceilingCorners.backLeft, ceilingCorners.frontLeft], '#6d5841', '#302319', 0.34, zBase + 0.4),
    polygonMark('room:right-wall-plane', [floorCorners.frontRight, floorCorners.backRight, ceilingCorners.backRight, ceilingCorners.frontRight], '#725f48', '#302319', 0.32, zBase + 0.42),
    polygonMark('room:back-wall-plane', [floorCorners.backLeft, floorCorners.backRight, ceilingCorners.backRight, ceilingCorners.backLeft], '#5e4e3d', '#302319', 0.38, zBase + 0.36),
  );

  const xSteps = rangeSteps(xRange[0], xRange[1], finiteOr(cameraPrimitive.gridStepX, 6));
  const ySteps = rangeSteps(backY, frontY, finiteOr(cameraPrimitive.gridStepY, 6));
  for (const y of ySteps) {
    marks.push(lineMark(`floor:grid-x-y${round(y)}`, point([xRange[0], y, 0]), point([xRange[1], y, 0]), '#d0b98d', 0.28, 0.8, zBase + 1));
    marks.push(lineMark(`ceiling:grid-x-y${round(y)}`, ceilingXPoint(xRange[0], y), ceilingXPoint(xRange[1], y), '#d8c79d', 0.2, 0.75, zBase + 1.1));
  }
  for (const x of xSteps) {
    marks.push(lineMark(`floor:grid-y-x${round(x)}`, point([x, frontY, 0]), point([x, backY, 0]), '#d0b98d', 0.28, 0.8, zBase + 1.01));
    marks.push(lineMark(`ceiling:grid-y-x${round(x)}`, ceilingYPoint(x, frontY), ceilingYPoint(x, backY), '#d8c79d', 0.2, 0.75, zBase + 1.11));
  }

  const pins = [];
  for (const el of pureMandala.pinnedElements || []) {
    const elementRole = el.id || el.role;
    if ((el.role === 'door' || el.role === 'hallway') && el.wall === 'back') {
      const xs = orderedRange(el.x || [5, 10]);
      const zs = orderedRange(el.z || [0, el.role === 'hallway' ? ceilingZ : 7]);
      const opening = [
        point([xs[0], backY, zs[0]]),
        point([xs[1], backY, zs[0]]),
        point([xs[1], backY, zs[1]]),
        point([xs[0], backY, zs[1]]),
      ];
      const openingRole = el.role === 'hallway'
        ? el.id ? `room:${elementRole}-opening` : 'room:back-hallway-opening'
        : 'room:back-door';
      marks.push(polygonMark(openingRole, opening, '#211811', '#c9985c', 0.84, zBase + 3));
      if (el.role === 'hallway') {
        marks.push(...hallwayMarks({
          role: elementRole,
          xs,
          y0: backY,
          y1: finiteOr(el.toY, backY - 16),
          ceilingZ,
          project: point,
          z: zBase + 2.8,
        }));
      }
      pins.push({ role: elementRole, screen: opening[0], wall: 'back', spawnDirection: spawnDirectionForElement(el) });
      continue;
    }
    if (el.role === 'hallway' && (el.wall === 'left' || el.wall === 'right')) {
      const ys = orderedRange(el.y || [backY + 6, backY + 13]);
      const zs = orderedRange(el.z || [0, ceilingZ]);
      const x = el.wall === 'left' ? xRange[0] : xRange[1];
      const direction = el.wall === 'left' ? -1 : 1;
      const toX = finiteOr(el.toX, x + direction * 14);
      const opening = [
        point([x, ys[1], zs[0]]),
        point([x, ys[0], zs[0]]),
        point([x, ys[0], zs[1]]),
        point([x, ys[1], zs[1]]),
      ];
      marks.push(polygonMark(`room:${elementRole}-opening`, opening, '#211811', '#c9985c', 0.84, zBase + 3));
      marks.push(...sideHallwayMarks({
        role: elementRole,
        wallX: x,
        toX,
        ys,
        ceilingZ,
        project: point,
        z: zBase + 2.8,
      }));
      pins.push({ role: elementRole, screen: opening[0], wall: el.wall, spawnDirection: spawnDirectionForElement(el) });
      continue;
    }
    const world = Array.isArray(el.worldXYZ) ? el.worldXYZ : [0, 0, 0];
    const screen = point(world);
    pins.push({ role: elementRole, screen, worldXYZ: world, spawnDirection: spawnDirectionForElement(el) });
    if (el.role === 'ceiling-light' || el.role === 'ceiling-fan') {
      const hang = point([world[0], world[1], Math.max(world[2] - 1.1, 0)]);
      marks.push(lineMark(`${el.role}:hanger`, screen, hang, '#e8dcc0', 0.72, 1.1, zBase + 5));
      marks.push({ kind: 'circle', role: el.role, cx: hang[0], cy: hang[1], r: 10, fill: '#f1d28b', stroke: '#5d4428', strokeWidth: 1, opacity: 0.9, z: zBase + 5.1 });
      continue;
    }
    if (el.role === 'figure') {
      if (el.visible === false || el.camera === true || el.cameraAnchor === true) {
        continue;
      }
      marks.push(...figureMarks({ role: elementRole, base: screen, top: point([world[0], world[1], finiteOr(el.height, 6.2)]), z: zBase + 6 }));
      continue;
    }
    if (isRoomCuboidRole(el.role)) {
      marks.push(...roomCuboidMarks({
        role: elementRole,
        center: world,
        size: Array.isArray(el.sizeXYZ) ? el.sizeXYZ : defaultRoomObjectSize(el.role),
        project: point,
        fill: el.fill,
        stroke: el.stroke,
        z: zBase + finiteOr(el.zOrder, roomObjectDefaultZ(el.role)),
      }));
    }
  }

  if (cameraPrimitive.debugDots !== false) {
    for (const y of ySteps) {
      for (const x of xSteps) {
        const p = point([x, y, 0]);
        marks.push({ kind: 'circle', role: `debug:floor-dot:${round(x)}:${round(y)}`, cx: p[0], cy: p[1], r: 1.8, fill: '#f6e7bd', opacity: 0.25, z: zBase + 2 });
      }
    }
  }

  return {
    viewBox: { width: 980, height: 620 },
    marks,
    roomBasis,
    floorGridCount: xSteps.length + ySteps.length,
    ceilingGridCount: xSteps.length + ySteps.length,
    projectedPins: pins,
    cameraGrammar,
  };
}

// Synthesize a boxNet mark per declared room furniture element. Each carries
// the room frame's own roomBasis so expandBoxNetMark places it in the same
// world the walls/floor were built from. Depth-biased z paints near furniture
// over far furniture (floor v=1 is nearest the camera).
function synthesizeRoomFurnitureMarks(roomConcept, roomBasis) {
  const elements = Array.isArray(roomConcept?.elements) ? roomConcept.elements : [];
  return elements
    .filter((el) => el && typeof el === 'object' && el.type)
    .map((el, i) => {
      const anchor = Array.isArray(el.anchor) ? el.anchor : [0.5, 0.5];
      const depthV = (el.surface || 'floor') === 'floor' ? finiteOr(anchor[1], 0.5) : 0.5;
      return {
        kind: 'boxNet',
        role: el.role || `${el.type}-${i + 1}`,
        type: el.type,
        surface: el.surface || 'floor',
        anchor,
        ...(Number.isFinite(el.w) ? { w: el.w } : {}),
        ...(Number.isFinite(el.h) ? { h: el.h } : {}),
        ...(Number.isFinite(el.heightWorld) ? { heightWorld: el.heightWorld } : {}),
        ...(el.supportPattern ? { supportPattern: el.supportPattern } : {}),
        ...(Number.isFinite(el.supportRadius) ? { supportRadius: el.supportRadius } : {}),
        ...(el.style ? { style: el.style } : {}),
        // Producer-intent default: a two-point room is a depictive scene, so its
        // furniture defaults to vexar matte. Sits BELOW explicit scene/element
        // overrides in the cascade (an architectural producer would stamp
        // 'wireframe' instead). See expandBoxNetMark.
        defaultStyle: 'shaded',
        roomBasis,
        z: 30 + depthV * 12,
      };
    });
}

function buildTwoPointCameraGrammar({ cameraPrimitive, pureMandala, roomBasis, ceilingZ, project }) {
  const crop = cameraPrimitive.cropBox;
  const frameCenter = crop
    ? [roundPoint(crop.x + crop.width / 2), roundPoint(crop.y + crop.height / 2)]
    : validPoint(cameraPrimitive.axisMundi?.screen) || [490, 310];
  const cameraPoint = cameraPrimitive.cameraPoint && typeof cameraPrimitive.cameraPoint === 'object'
    ? cameraPrimitive.cameraPoint
    : null;
  const lookAt = Array.isArray(cameraPoint?.lookAt)
    ? cameraPoint.lookAt
    : [
        (roomBasis.xRange[0] + roomBasis.xRange[1]) / 2,
        (roomBasis.frontY + roomBasis.backY) / 2,
        ceilingZ * 0.42,
      ];
  const axisWorld = [
    finiteOr(cameraPrimitive.axisMundi?.worldXYZ?.[0], finiteOr(lookAt[0], 0)),
    finiteOr(cameraPrimitive.axisMundi?.worldXYZ?.[1], finiteOr(lookAt[1], (roomBasis.frontY + roomBasis.backY) / 2)),
    finiteOr(cameraPrimitive.axisMundi?.worldXYZ?.[2], finiteOr(lookAt[2], ceilingZ * 0.42)),
  ];
  const axisScreen = validPoint(cameraPrimitive.axisMundi?.screen) || project(axisWorld);
  const eye = Array.isArray(cameraPrimitive.eyeWorldXYZ)
    ? cameraPrimitive.eyeWorldXYZ
    : Array.isArray(cameraPoint?.doorCenter)
      ? cameraPoint.doorCenter
      : [axisWorld[0], roomBasis.frontY, ceilingZ * 0.56];
  const eyeHeight = finiteOr(eye[2], ceilingZ * 0.56);
  const bottomT = clamp(eyeHeight / Math.max(ceilingZ, 0.001), 0, 1);
  const topVisibilityT = clamp((ceilingZ - eyeHeight) / Math.max(ceilingZ, 0.001), 0, 1);
  const floorAxis = project([axisWorld[0], axisWorld[1], 0]);
  const ceilingAxis = project([axisWorld[0], axisWorld[1], ceilingZ]);

  return {
    kind: 'axis-mundi-eye-line',
    source: 'camera-point-before-mandala',
    frameCenter,
    axisMundi: {
      worldXYZ: axisWorld.map(round),
      screen: axisScreen.map(roundPoint),
      directEyeLine: true,
    },
    cameraPoint: cameraPoint
      ? {
          kind: cameraPoint.kind,
          doorWall: cameraPoint.doorWall,
          doorCenter: Array.isArray(cameraPoint.doorCenter) ? cameraPoint.doorCenter.map(round) : undefined,
          lookAt: Array.isArray(cameraPoint.lookAt) ? cameraPoint.lookAt.map(round) : undefined,
        }
      : undefined,
    topPlane: {
      spawnDirection: 'ceiling-down',
      basis: 'ceiling-visible-from-eye',
      axisPoint: ceilingAxis.map(roundPoint),
      visibleFractionFromEye: round(topVisibilityT),
      inwardRays: [
        ['top-left', frameCenter],
        ['top-right', frameCenter],
      ],
    },
    bottomPlane: {
      spawnDirection: 'floor-up',
      basis: 'floor-arced-by-eye-height',
      axisPoint: floorAxis.map(roundPoint),
      eyeHeightFraction: round(bottomT),
      arcTension: round(0.18 + bottomT * 0.42),
      inwardRays: [
        ['bottom-left', frameCenter],
        ['bottom-right', frameCenter],
      ],
    },
    mandalaFlow: [
      'establish shot from prompt',
      'choose frame center as axis mundi / direct eye line',
      'derive top and bottom planes at that axis point',
      'map room and objects in 2d pure mandala',
      'spawn floor objects upward and ceiling/sky objects downward',
      'render through camera projection and crop',
    ],
    spawnRules: {
      default: 'floor-up',
      ceilingRoles: ['ceiling-light', 'ceiling-fan', 'sky', 'cloud', 'sun', 'moon', 'hanging-light'],
      ceilingAndSky: 'ceiling-down',
    },
  };
}

function spawnDirectionForElement(el) {
  if (typeof el.spawnDirection === 'string') return el.spawnDirection;
  if (el.fromCeiling === true || el.ceilingMounted === true) return 'ceiling-down';
  const role = String(el.role || '').toLowerCase();
  if (role.includes('ceiling') || role.includes('sky') || role.includes('cloud') || role.includes('sun') || role.includes('moon')) {
    return 'ceiling-down';
  }
  return 'floor-up';
}

function generateStraightDoorwayRoomMarks(pureMandala, cameraPrimitive) {
  const room = pureMandala.room || {};
  const floor = room.floor || {};
  const xRange = orderedRange(floor.x || [room.walls?.leftX ?? -16, room.walls?.rightX ?? 16]);
  const yRange = orderedRange(floor.y || [-24, 8]);
  const frontY = Math.max(yRange[0], yRange[1]);
  const backY = Math.min(yRange[0], yRange[1]);
  const ceilingZ = finiteOr(room.ceilingZ, 10);
  const frame = cameraPrimitive.straightFrame || {};
  const backWall = {
    left: finiteOr(frame.backWall?.left, 360),
    right: finiteOr(frame.backWall?.right, 620),
    top: finiteOr(frame.backWall?.top, 180),
    bottom: finiteOr(frame.backWall?.bottom, 360),
  };
  const floorFront = {
    left: validPoint(frame.floorFront?.left) || [160, 585],
    right: validPoint(frame.floorFront?.right) || [820, 585],
  };
  const ceilingFront = {
    left: validPoint(frame.ceilingFront?.left) || [220, 90],
    right: validPoint(frame.ceilingFront?.right) || [760, 90],
  };
  const roomBasis = {
    xRange,
    yRange,
    frontY,
    backY,
    ...(cameraPrimitive.roomBasis || {}),
  };
  const project = ([xRaw, yRaw, zRaw]) => {
    const x = finiteOr(xRaw, 0);
    const y = finiteOr(yRaw, 0);
    const z = finiteOr(zRaw, 0);
    const depthT = clamp((frontY - y) / Math.max(frontY - backY, 0.001), 0, 1);
    const widthT = clamp((x - xRange[0]) / Math.max(xRange[1] - xRange[0], 0.001), -0.4, 1.4);
    const floorLeft = lerpPoint(floorFront.left, [backWall.left, backWall.bottom], depthT);
    const floorRight = lerpPoint(floorFront.right, [backWall.right, backWall.bottom], depthT);
    const ceilingLeft = lerpPoint(ceilingFront.left, [backWall.left, backWall.top], depthT);
    const ceilingRight = lerpPoint(ceilingFront.right, [backWall.right, backWall.top], depthT);
    const floorPoint = lerpPoint(floorLeft, floorRight, widthT);
    const ceilingPoint = lerpPoint(ceilingLeft, ceilingRight, widthT);
    return lerpPoint(floorPoint, ceilingPoint, clamp(z / Math.max(ceilingZ, 0.001), -0.2, 1.2)).map(roundPoint);
  };

  const zBase = finiteOr(cameraPrimitive.zBase, 8);
  const marks = [
    polygonMark('room:floor-plane', [floorFront.left, floorFront.right, [backWall.right, backWall.bottom], [backWall.left, backWall.bottom]], '#7f684b', '#3c2b1d', 0.38, zBase),
    polygonMark('room:ceiling-plane', [ceilingFront.left, ceilingFront.right, [backWall.right, backWall.top], [backWall.left, backWall.top]], '#4d4033', '#8a7357', 0.26, zBase + 0.2),
    polygonMark('room:left-wall-plane', [floorFront.left, [backWall.left, backWall.bottom], [backWall.left, backWall.top], ceilingFront.left], '#6d5841', '#302319', 0.36, zBase + 0.4),
    polygonMark('room:right-wall-plane', [floorFront.right, [backWall.right, backWall.bottom], [backWall.right, backWall.top], ceilingFront.right], '#725f48', '#302319', 0.34, zBase + 0.42),
    polygonMark('room:back-wall-plane', [[backWall.left, backWall.bottom], [backWall.right, backWall.bottom], [backWall.right, backWall.top], [backWall.left, backWall.top]], '#5e4e3d', '#302319', 0.42, zBase + 0.36),
  ];

  const xSteps = rangeSteps(xRange[0], xRange[1], finiteOr(cameraPrimitive.gridStepX, 8));
  const ySteps = rangeSteps(backY, frontY, finiteOr(cameraPrimitive.gridStepY, 8));
  for (const y of ySteps) {
    marks.push(lineMark(`floor:grid-x-y${round(y)}`, project([xRange[0], y, 0]), project([xRange[1], y, 0]), '#d0b98d', 0.22, 0.8, zBase + 1));
    marks.push(lineMark(`ceiling:grid-x-y${round(y)}`, project([xRange[0], y, ceilingZ]), project([xRange[1], y, ceilingZ]), '#d8c79d', 0.16, 0.75, zBase + 1.1));
  }
  for (const x of xSteps) {
    marks.push(lineMark(`floor:grid-y-x${round(x)}`, project([x, frontY, 0]), project([x, backY, 0]), '#d0b98d', 0.22, 0.8, zBase + 1.01));
    marks.push(lineMark(`ceiling:grid-y-x${round(x)}`, project([x, frontY, ceilingZ]), project([x, backY, ceilingZ]), '#d8c79d', 0.16, 0.75, zBase + 1.11));
  }

  const projectedPins = [];
  for (const el of pureMandala.pinnedElements || []) {
    const elementRole = el.id || el.role;
    const world = Array.isArray(el.worldXYZ) ? el.worldXYZ : [0, 0, 0];
    const screen = project(world);
    projectedPins.push({ role: elementRole, screen, worldXYZ: world, spawnDirection: spawnDirectionForElement(el) });
    if (el.role === 'figure' && (el.visible === false || el.camera === true || el.cameraAnchor === true)) continue;
    if (el.role === 'figure') {
      marks.push(...figureMarks({
        role: elementRole,
        base: screen,
        top: project([world[0], world[1], finiteOr(el.height, 6.2)]),
        z: zBase + finiteOr(el.zOrder, 6),
      }));
      continue;
    }
    if (el.role === 'rug') {
      marks.push(rugMark(el, project, zBase + 2.2));
      continue;
    }
    if (el.role === 'ceiling-light' || el.role === 'ceiling-fan') {
      const hang = project([world[0], world[1], Math.max(world[2] - finiteOr(el.drop, 1.1), 0)]);
      marks.push(lineMark(`${elementRole}:hanger`, screen, hang, '#e8dcc0', 0.72, 1.1, zBase + 5));
      marks.push({ kind: 'circle', role: elementRole, cx: hang[0], cy: hang[1], r: 10, fill: '#f1d28b', stroke: '#5d4428', strokeWidth: 1, opacity: 0.9, z: zBase + 5.1 });
      continue;
    }
    if (isRoomCuboidRole(el.role)) {
      marks.push(...roomCuboidMarks({
        role: elementRole,
        center: world,
        size: Array.isArray(el.sizeXYZ) ? el.sizeXYZ : defaultRoomObjectSize(el.role),
        project,
        fill: el.fill,
        stroke: el.stroke,
        z: zBase + finiteOr(el.zOrder, roomObjectDefaultZ(el.role)),
      }));
    }
  }

  return {
    viewBox: { width: 980, height: 620 },
    marks,
    floorGridCount: xSteps.length + ySteps.length,
    ceilingGridCount: xSteps.length + ySteps.length,
    projectedPins,
    cameraGrammar: buildTwoPointCameraGrammar({
      cameraPrimitive,
      pureMandala,
      roomBasis,
      ceilingZ,
      project,
    }),
  };
}

function rugMark(el, project, z) {
  const world = Array.isArray(el.worldXYZ) ? el.worldXYZ : [0, 0, 0];
  const size = Array.isArray(el.sizeXYZ) ? el.sizeXYZ : [7, 5, 0];
  const sx = Math.max(finiteOr(size[0], 7), 0.2);
  const sy = Math.max(finiteOr(size[1], 5), 0.2);
  const cx = finiteOr(world[0], 0);
  const cy = finiteOr(world[1], 0);
  const points = [
    project([cx - sx / 2, cy + sy / 2, 0.02]),
    project([cx + sx / 2, cy + sy / 2, 0.02]),
    project([cx + sx / 2, cy - sy / 2, 0.02]),
    project([cx - sx / 2, cy - sy / 2, 0.02]),
  ];
  return polygonMark(el.id || 'rug', points, el.fill || '#855f4a', el.stroke || '#2e2117', 0.72, z);
}

function hallwayMarks({ role, xs, y0, y1, ceilingZ, project, z }) {
  const nearLeftFloor = project([xs[0], y0, 0]);
  const nearRightFloor = project([xs[1], y0, 0]);
  const farLeftFloor = project([xs[0], y1, 0]);
  const farRightFloor = project([xs[1], y1, 0]);
  const nearLeftCeiling = project([xs[0], y0, ceilingZ]);
  const nearRightCeiling = project([xs[1], y0, ceilingZ]);
  const farLeftCeiling = project([xs[0], y1, ceilingZ]);
  const farRightCeiling = project([xs[1], y1, ceilingZ]);
  return [
    polygonMark(`${role}:floor-run`, [nearLeftFloor, nearRightFloor, farRightFloor, farLeftFloor], '#473728', '#211811', 0.44, z),
    polygonMark(`${role}:ceiling-run`, [nearLeftCeiling, nearRightCeiling, farRightCeiling, farLeftCeiling], '#30251d', '#6f5b42', 0.42, z + 0.05),
    lineMark(`${role}:left-edge`, nearLeftFloor, farLeftFloor, '#d0b98d', 0.5, 1.2, z + 0.2),
    lineMark(`${role}:right-edge`, nearRightFloor, farRightFloor, '#d0b98d', 0.5, 1.2, z + 0.21),
    lineMark(`${role}:left-ceiling-edge`, nearLeftCeiling, farLeftCeiling, '#d8c79d', 0.38, 1, z + 0.22),
    lineMark(`${role}:right-ceiling-edge`, nearRightCeiling, farRightCeiling, '#d8c79d', 0.38, 1, z + 0.23),
  ];
}

function sideHallwayMarks({ role, wallX, toX, ys, ceilingZ, project, z }) {
  const nearA = project([wallX, ys[0], 0]);
  const nearB = project([wallX, ys[1], 0]);
  const farA = project([toX, ys[0], 0]);
  const farB = project([toX, ys[1], 0]);
  const nearACeiling = project([wallX, ys[0], ceilingZ]);
  const nearBCeiling = project([wallX, ys[1], ceilingZ]);
  const farACeiling = project([toX, ys[0], ceilingZ]);
  const farBCeiling = project([toX, ys[1], ceilingZ]);
  return [
    polygonMark(`${role}:floor-run`, [nearA, nearB, farB, farA], '#473728', '#211811', 0.44, z),
    polygonMark(`${role}:ceiling-run`, [nearACeiling, nearBCeiling, farBCeiling, farACeiling], '#30251d', '#6f5b42', 0.42, z + 0.05),
    lineMark(`${role}:near-edge`, nearA, nearB, '#d0b98d', 0.44, 1.2, z + 0.18),
    lineMark(`${role}:far-edge`, farA, farB, '#d0b98d', 0.36, 1, z + 0.19),
    lineMark(`${role}:left-run-edge`, nearA, farA, '#d0b98d', 0.5, 1.2, z + 0.2),
    lineMark(`${role}:right-run-edge`, nearB, farB, '#d0b98d', 0.5, 1.2, z + 0.21),
    lineMark(`${role}:left-ceiling-edge`, nearACeiling, farACeiling, '#d8c79d', 0.38, 1, z + 0.22),
    lineMark(`${role}:right-ceiling-edge`, nearBCeiling, farBCeiling, '#d8c79d', 0.38, 1, z + 0.23),
  ];
}

function roomCuboidMarks({ role, center, size, project, fill, stroke, z }) {
  const sx = Math.max(finiteOr(size?.[0], 4), 0.2);
  const sy = Math.max(finiteOr(size?.[1], 3), 0.2);
  const sz = Math.max(finiteOr(size?.[2], 3), 0.2);
  const cx = finiteOr(center?.[0], 0);
  const cy = finiteOr(center?.[1], 0);
  const z0 = finiteOr(center?.[2], 0);
  const x0 = cx - sx / 2;
  const x1 = cx + sx / 2;
  const y0 = cy - sy / 2;
  const y1 = cy + sy / 2;
  const bottom = {
    fl: project([x0, y1, z0]),
    fr: project([x1, y1, z0]),
    br: project([x1, y0, z0]),
    bl: project([x0, y0, z0]),
  };
  const top = {
    fl: project([x0, y1, z0 + sz]),
    fr: project([x1, y1, z0 + sz]),
    br: project([x1, y0, z0 + sz]),
    bl: project([x0, y0, z0 + sz]),
  };
  const baseFill = fill || roomObjectDefaultFill(role);
  const line = stroke || '#2e2117';
  const marks = [
    polygonMark(`${role}:front-face`, [bottom.fl, bottom.fr, top.fr, top.fl], shadeHex(baseFill, 0.92), line, 0.88, z + 0.2),
    polygonMark(`${role}:right-face`, [bottom.fr, bottom.br, top.br, top.fr], shadeHex(baseFill, 0.74), line, 0.82, z + 0.1),
    polygonMark(`${role}:top-face`, [top.fl, top.fr, top.br, top.bl], shadeHex(baseFill, 1.1), line, 0.82, z + 0.3),
    lineMark(`${role}:floor-contact`, bottom.fl, bottom.fr, '#e8dcc0', 0.32, 1.2, z + 0.35),
  ];

  if (role === 'shelf' || role === 'shelves' || role === 'bookcase') {
    for (let i = 1; i <= 3; i++) {
      const t = i / 4;
      const a = lerpPoint(bottom.fl, top.fl, t);
      const b = lerpPoint(bottom.fr, top.fr, t);
      marks.push(lineMark(`${role}:shelf-line-${i}`, a, b, '#d9b37b', 0.68, 1.4, z + 0.45 + i * 0.01));
    }
  }

  return marks;
}

function defaultRoomObjectSize(role) {
  if (role === 'shelf' || role === 'shelves' || role === 'bookcase') return [3.2, 9, 7.2];
  if (role === 'bar' || role === 'counter') return [9, 3.4, 3.3];
  if (role === 'sofa') return [8.5, 3.2, 2.6];
  if (role === 'bed') return [7.2, 6.2, 2.2];
  if (role === 'closet' || role === 'wardrobe') return [5.8, 1.6, 7.6];
  if (role === 'coffee-table') return [4.8, 2.6, 1.35];
  if (role === 'media-console' || role === 'tv-console') return [7.2, 1.6, 2.1];
  if (role === 'side-table' || role === 'ottoman') return [2.2, 2.2, 1.8];
  if (role === 'table') return [5.8, 3.8, 2.7];
  return [4, 3, 3];
}

function isRoomCuboidRole(role) {
  return [
    'shelf',
    'shelves',
    'bookcase',
    'table',
    'bar',
    'counter',
    'cabinet',
    'closet',
    'wardrobe',
    'bed',
    'sofa',
    'coffee-table',
    'media-console',
    'tv-console',
    'side-table',
    'ottoman',
  ].includes(role);
}

function roomObjectDefaultFill(role) {
  if (role === 'shelf' || role === 'shelves' || role === 'bookcase' || role === 'media-console' || role === 'tv-console') {
    return '#8b6642';
  }
  if (role === 'closet' || role === 'wardrobe') return '#7c654f';
  if (role === 'bed') return '#7b7183';
  if (role === 'sofa' || role === 'ottoman') return '#6d6f59';
  if (role === 'coffee-table' || role === 'side-table') return '#7a5538';
  return '#6f4d32';
}

function roomObjectDefaultZ(role) {
  if (role === 'sofa' || role === 'bed' || role === 'coffee-table' || role === 'side-table' || role === 'ottoman') return 4.8;
  if (role === 'table' || role === 'bar' || role === 'counter') return 4.4;
  return 3.6;
}

function figureMarks({ role, base, top, z }) {
  const height = Math.max(base[1] - top[1], 60);
  const midY = top[1] + height * 0.54;
  const headR = clamp(height * 0.085, 8, 16);
  const shoulder = height * 0.14;
  const hip = height * 0.09;
  return [
    { kind: 'oval', role: `${role}:torso`, anchor: [base[0] - height * 0.02, midY], rx: shoulder, ry: height * 0.23, rotation: -0.05, fill: '#9f704e', stroke: '#3e2a1d', strokeWidth: 1, z },
    { kind: 'circle', role: `${role}:head`, cx: top[0], cy: top[1] + headR * 1.1, r: headR, fill: '#c3956d', stroke: '#3e2a1d', strokeWidth: 1, z: z + 0.2 },
    lineMark(`${role}:left-leg`, [base[0] - hip, midY + height * 0.2], [base[0] - hip * 1.45, base[1]], '#3e2a1d', 0.9, 4, z + 0.1),
    lineMark(`${role}:right-leg`, [base[0] + hip, midY + height * 0.2], [base[0] + hip * 1.2, base[1]], '#3e2a1d', 0.9, 4, z + 0.11),
    lineMark(`${role}:floor-pin`, [base[0] - hip * 1.8, base[1]], [base[0] + hip * 1.6, base[1]], '#e8dcc0', 0.55, 2, z + 0.12),
  ];
}

function polygonMark(role, points, fill, stroke, opacity, z) {
  return { kind: 'polygon', role, points, fill, stroke, strokeWidth: 1, opacity, z, closed: true };
}

function lineMark(role, a, b, stroke, opacity, strokeWidth, z) {
  return { kind: 'line', role, x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke, opacity, strokeWidth, z };
}

function lineParameter(a, b, p) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const denom = dx * dx + dy * dy;
  if (denom < 1e-9) return 0;
  return clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / denom, -0.2, 1.2);
}

function rangeSteps(min, max, step) {
  const out = [];
  const s = Math.max(Math.abs(step), 0.001);
  for (let v = min; v <= max + s * 0.25; v += s) out.push(round(v));
  if (!out.some((v) => Math.abs(v - max) < 1e-6)) out.push(round(max));
  return out;
}

function orderedRange(range) {
  const a = finiteOr(range?.[0], 0);
  const b = finiteOr(range?.[1], 1);
  return a <= b ? [a, b] : [b, a];
}

function average(values) {
  const clean = values.map((value) => Number(value)).filter(Number.isFinite);
  if (!clean.length) return 0;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function offsetMark(mark, dx, dy) {
  if (!mark || typeof mark !== 'object') return mark;
  if (mark.kind === 'line') return { ...mark, x1: mark.x1 + dx, y1: mark.y1 + dy, x2: mark.x2 + dx, y2: mark.y2 + dy };
  if (mark.kind === 'polygon' || mark.kind === 'polyline') {
    return { ...mark, points: mark.points.map((p) => [roundPoint(p[0] + dx), roundPoint(p[1] + dy)]) };
  }
  if (mark.kind === 'rect') return { ...mark, x: mark.x + dx, y: mark.y + dy };
  if (mark.kind === 'circle' || mark.kind === 'wedge') return { ...mark, cx: mark.cx + dx, cy: mark.cy + dy };
  if (mark.kind === 'oval' || mark.kind === 'egg' || mark.kind === 'blob' || mark.kind === 'sphere' || mark.kind === 'volume') {
    return Array.isArray(mark.anchor)
      ? { ...mark, anchor: [roundPoint(mark.anchor[0] + dx), roundPoint(mark.anchor[1] + dy)] }
      : { ...mark, cx: mark.cx + dx, cy: mark.cy + dy };
  }
  if (mark.kind === 'text') return { ...mark, x: mark.x + dx, y: mark.y + dy };
  return mark;
}

function isConstructionMark(mark) {
  return mark?.kind === 'partition' ||
    mark?.kind === 'array' ||
    mark?.kind === 'mandalaField' ||
    mark?.kind === 'fluidField' ||
    mark?.kind === 'swirlField' ||
    mark?.kind === 'rBrush' ||
    mark?.kind === 'blobPla' ||
    mark?.kind === 'sparkField' ||
    mark?.kind === 'showerField' ||
    mark?.kind === 'wispField' ||
    mark?.kind === 'visionPane' ||
    mark?.kind === 'horizontalStack' ||
    mark?.kind === 'mandalaArrangement' ||
    mark?.kind === 'stickerField' ||
    mark?.kind === 'cubieLattice' ||
    mark?.kind === 'arabesque' ||
    mark?.kind === 'form';
}

function resolveConstructionMarks(marks, scene = {}, manifest = {}) {
  if (!Array.isArray(marks) || !marks.some(isConstructionMark)) return marks;
  const resolved = [];
  const byRole = new Map();
  for (let sourceIndex = 0; sourceIndex < marks.length; sourceIndex++) {
    const mark = marks[sourceIndex];
    try {
      if (mark?.kind === 'partition') {
        const next = expandPartitionMark(mark, byRole);
        resolved.push(...next);
        next.forEach((item) => rememberRole(item, byRole));
        continue;
      }
      if (mark?.kind === 'array') {
        const next = expandArrayMark(mark);
        resolved.push(...next);
        next.forEach((item) => rememberRole(item, byRole));
        continue;
      }
      if (mark?.kind === 'mandalaField') {
        const next = expandMandalaFieldMark(mark, manifest);
        resolved.push(...next);
        next.forEach((item) => rememberRole(item, byRole));
        continue;
      }
      if (mark?.kind === 'fluidField' || mark?.kind === 'swirlField') {
        const next = expandSwirlFieldMark(mark, manifest);
        resolved.push(...next);
        next.forEach((item) => rememberRole(item, byRole));
        continue;
      }
      if (mark?.kind === 'rBrush') {
        const next = expandRBrushMark(mark, manifest);
        resolved.push(...next);
        next.forEach((item) => rememberRole(item, byRole));
        continue;
      }
      if (mark?.kind === 'blobPla') {
        const next = expandBlobPlaMark(mark, byRole);
        resolved.push(...next);
        next.forEach((item) => rememberRole(item, byRole));
        continue;
      }
      if (mark?.kind === 'sparkField' || mark?.kind === 'showerField') {
        const next = expandSparkFieldMark(mark, manifest);
        resolved.push(...next);
        next.forEach((item) => rememberRole(item, byRole));
        continue;
      }
      if (mark?.kind === 'wispField') {
        const next = expandWispFieldMark(mark, manifest);
        resolved.push(...next);
        next.forEach((item) => rememberRole(item, byRole));
        continue;
      }
      if (mark?.kind === 'visionPane') {
        const next = expandVisionPaneMark(mark, manifest);
        resolved.push(...next);
        next.forEach((item) => rememberRole(item, byRole));
        continue;
      }
      if (mark?.kind === 'horizontalStack') {
        const next = expandHorizontalStackMark(mark);
        resolved.push(...next);
        next.forEach((item) => rememberRole(item, byRole));
        continue;
      }
      if (mark?.kind === 'mandalaArrangement') {
        const next = expandMandalaArrangementMark(mark);
        resolved.push(...next);
        next.forEach((item) => rememberRole(item, byRole));
        continue;
      }
      if (mark?.kind === 'stickerField') {
        const next = expandStickerFieldMark(mark, byRole, scene);
        resolved.push(...next);
        next.forEach((item) => rememberRole(item, byRole));
        continue;
      }
      if (mark?.kind === 'cubieLattice') {
        const next = expandCubieLatticeMark(mark, scene, manifest);
        resolved.push(...next);
        next.forEach((item) => rememberRole(item, byRole));
        continue;
      }
      if (mark?.kind === 'form') {
        const next = expandFormMark(mark);
        resolved.push(...next);
        next.forEach((item) => rememberRole(item, byRole));
        continue;
      }
      if (mark?.kind === 'arabesque') {
        const next = expandArabesque(mark, manifest);
        resolved.push(...next);
        next.forEach((item) => rememberRole(item, byRole));
        continue;
      }
      resolved.push(mark);
      rememberRole(mark, byRole);
    } catch (err) {
      // Surface "expanded up to mark N, failed at mark N+1 because …" so the
      // polygonizer's repair prompt can show what survived and where the model
      // went off-script. See lite-template/integration/0603/polygonizer_optimization.md
      // (Phase 3 — Richer repair feedback).
      if (!err.expansionContext) {
        err.expansionContext = {
          sourceIndex,
          kind: mark?.kind,
          role: mark?.role,
          expandedSoFar: resolved.length,
          availableRoles: Array.from(byRole.keys()),
        };
      }
      throw err;
    }
  }
  return resolved;
}

function expandFormMark(mark) {
  const mode = mark.mode || 'abstract';
  const stock = mark.stock || mark.bodyStock || 'abstract-combo';
  if (mode === 'animated' && stock === 'bipedal') return expandAnimatedBipedForm(mark);
  if (isLowerBodyDummyStock(stock)) return expandLowerBodyDummyForm(mark);
  if (isFullBodyDummyStock(stock)) return expandFullBodyDummyForm(mark);
  if (stock === 'plane-object') return expandPlaneObjectForm(mark);
  throw new Error(`form '${mark.role || '(anonymous)'}' unsupported mode/stock '${mode}/${stock}'`);
}

function expandBlobPlaMark(mark, byRole = new Map()) {
  const source = resolveBlobPlaEndpoint(mark.source || mark.sourceRole, byRole) ||
    validPoint(mark.sourcePoint) ||
    validPoint(mark.from);
  const receiver = resolveBlobPlaEndpoint(mark.receiver || mark.receiverRole, byRole) ||
    validPoint(mark.receiverPoint) ||
    validPoint(mark.to);
  const anchor = validPoint(mark.anchor) || [
    finiteOr(mark.cx, 240),
    finiteOr(mark.cy, 220),
  ];
  const sourcePoint = source || [anchor[0], anchor[1] - finiteOr(mark.length, 48) / 2];
  const receiverPoint = receiver || [anchor[0], anchor[1] + finiteOr(mark.length, 48) / 2];
  const joint = mark.joint && typeof mark.joint === 'object' ? mark.joint : {};
  const socket = mark.socket && typeof mark.socket === 'object' ? mark.socket : mark.pelvisSocket && typeof mark.pelvisSocket === 'object' ? mark.pelvisSocket : {};
  const stem = mark.stem && typeof mark.stem === 'object' ? mark.stem : mark.cylinder && typeof mark.cylinder === 'object' ? mark.cylinder : {};
  const t = clamp(finiteOr(joint.t ?? mark.jointT, 0.5), 0, 1);
  const jointCenter = validPoint(joint.center) || validPoint(mark.jointCenter) || [
    lerp(sourcePoint[0], receiverPoint[0], t),
    lerp(sourcePoint[1], receiverPoint[1], t),
  ];
  const socketCenter = validPoint(socket.center) || validPoint(mark.socketCenter) || receiverPoint;
  const jointRadius = Math.max(0.5, finiteOr(joint.radius ?? mark.jointRadius, 14));
  const socketRadius = Math.max(0.5, finiteOr(socket.radius ?? mark.socketRadius, jointRadius * 1.18));
  const stemEnabled = stem.enabled !== false && mark.stem !== false && mark.cylinder !== false;
  const baseZ = finiteOr(mark.z, 30);
  const role = mark.role || 'blobpla';
  const common = {
    algorithmic: true,
    algorithm: 'blobPla',
    blobPlaAdapter: true,
    blobPlaRole: role,
    sourceRole: typeof mark.sourceRole === 'string' ? mark.sourceRole : undefined,
    receiverRole: typeof mark.receiverRole === 'string' ? mark.receiverRole : undefined,
    supportBehavior: mark.gravity?.lowerUnit ? 'lower-unit' : mark.supportBehavior || 'adapter-preserves-masses',
  };
  const out = [];

  if (stemEnabled) {
    out.push({
      kind: 'line',
      role: stem.role || mark.cylinderRole || `${role}:stem`,
      x1: roundPoint(jointCenter[0]),
      y1: roundPoint(jointCenter[1]),
      x2: roundPoint(socketCenter[0]),
      y2: roundPoint(socketCenter[1]),
      stroke: stem.stroke || mark.stroke || '#46515a',
      strokeWidth: Math.max(0.2, finiteOr(stem.radius ?? stem.strokeWidth ?? mark.stemRadius, jointRadius * 0.56) * 2),
      strokeLinecap: 'round',
      opacity: finiteOr(stem.opacity, finiteOr(mark.opacity, 0.92)),
      z: baseZ,
      blobPlaPart: 'stem',
      blobPlaConnector: true,
      ...common,
    });
  }

  out.push({
    kind: 'circle',
    role: socket.role || mark.socketRole || `${role}:socket`,
    cx: roundPoint(socketCenter[0]),
    cy: roundPoint(socketCenter[1]),
    r: roundPoint(socketRadius),
    fill: socket.fill || mark.socketFill || 'none',
    stroke: socket.stroke || mark.socketStroke || mark.stroke || '#20282d',
    strokeWidth: finiteOr(socket.strokeWidth, finiteOr(mark.strokeWidth, 1.2)),
    opacity: finiteOr(socket.opacity, finiteOr(mark.opacity, 0.86)),
    z: baseZ + 0.01,
    blobPlaPart: 'socket',
    blobPlaSocket: true,
    ...common,
  });
  out.push({
    kind: 'sphere',
    role: joint.role || mark.jointRole || `${role}:joint`,
    anchor: [roundPoint(jointCenter[0]), roundPoint(jointCenter[1])],
    r: roundPoint(jointRadius),
    fill: joint.fill || mark.fill || '#d7c7a4',
    stroke: joint.stroke || mark.stroke || '#2c241c',
    strokeWidth: finiteOr(joint.strokeWidth, finiteOr(mark.strokeWidth, 0.8)),
    opacity: finiteOr(joint.opacity, finiteOr(mark.opacity, 0.96)),
    z: baseZ + 0.02,
    blobPlaPart: 'joint',
    blobPlaJoint: true,
    ...common,
  });

  return out;
}

function resolveBlobPlaEndpoint(input, byRole) {
  if (validPoint(input)) return input;
  const role = typeof input === 'string' ? input : typeof input?.role === 'string' ? input.role : null;
  if (!role) return null;
  return centerOfMark(byRole.get(role));
}

function centerOfMark(mark) {
  if (!mark || typeof mark !== 'object') return null;
  if (validPoint(mark.anchor)) return mark.anchor;
  if (Number.isFinite(mark.cx) && Number.isFinite(mark.cy)) return [mark.cx, mark.cy];
  if (Number.isFinite(mark.x) && Number.isFinite(mark.y) && Number.isFinite(mark.w) && Number.isFinite(mark.h)) {
    return [mark.x + mark.w / 2, mark.y + mark.h / 2];
  }
  if (Number.isFinite(mark.x) && Number.isFinite(mark.y) && Number.isFinite(mark.width) && Number.isFinite(mark.height)) {
    return [mark.x + mark.width / 2, mark.y + mark.height / 2];
  }
  if (Array.isArray(mark.points) && mark.points.length) {
    const points = mark.points.filter(validPoint);
    if (!points.length) return null;
    const box = bbox(points);
    return [(box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2];
  }
  return null;
}

function expandAnimatedBipedForm(mark) {
  const role = mark.role || 'figure';
  const anchor = validPoint(mark.anchor) || [finiteOr(mark.cx, 220), finiteOr(mark.cy, 250)];
  const scale = Math.max(finiteOr(mark.scale, 1), 0.1);
  const mass = formMassProfile(mark.massTuning);
  const fill = mark.fill || '#b1845e';
  const stroke = mark.stroke || '#4f3928';
  const z = finiteOr(mark.z, 20);
  const common = formPrimitiveCommon(mark, role, 'animated', 'bipedal');
  const cx = anchor[0];
  const cy = anchor[1];
  const torsoHeight = 118 * scale;
  const torsoWidth = mass.torsoWidth * scale;
  const hipWidth = mass.hipWidth * scale;
  const headRy = 25 * scale;
  const headRx = 22 * scale * mass.headScale;
  const shoulderY = cy - 52 * scale;
  const hipY = cy + 42 * scale;
  const headY = cy - 104 * scale;

  return [
    {
      ...common,
      kind: 'volume',
      primitive: 'cup',
      role: `${role}:torso`,
      anchor: [roundPoint(cx), roundPoint(cy - 4 * scale)],
      height: torsoHeight,
      rimWidth: torsoWidth,
      footWidth: hipWidth,
      wallThickness: Math.max(5 * scale, 1),
      rings: Math.round(finiteOr(mark.rings, 10)),
      openTop: false,
      fill,
      stroke,
      z,
      formPart: 'torso',
    },
    {
      ...common,
      kind: 'egg',
      role: `${role}:head`,
      anchor: [roundPoint(cx), roundPoint(headY)],
      rx: headRx,
      ry: headRy,
      fill: mark.headFill || fill,
      stroke,
      z: z + 0.7,
      formPart: 'head',
    },
    formLimbBlob(common, `${role}:left-arm`, cx - torsoWidth * 0.54, shoulderY + 30 * scale, 13 * scale, 50 * scale, -0.35, fill, stroke, z + 0.2, 'limb'),
    formLimbBlob(common, `${role}:right-arm`, cx + torsoWidth * 0.54, shoulderY + 30 * scale, 13 * scale, 50 * scale, 0.35, fill, stroke, z + 0.21, 'limb'),
    formLimbBlob(common, `${role}:left-leg`, cx - hipWidth * 0.22, hipY + 44 * scale, 15 * scale, 58 * scale, 0.08, fill, stroke, z + 0.1, 'limb'),
    formLimbBlob(common, `${role}:right-leg`, cx + hipWidth * 0.22, hipY + 44 * scale, 15 * scale, 58 * scale, -0.08, fill, stroke, z + 0.11, 'limb'),
    formJointSphere(common, `${role}:neck-joint`, cx, cy - 70 * scale, 12 * scale, fill, stroke, z + 0.62),
    formJointSphere(common, `${role}:left-shoulder-joint`, cx - torsoWidth * 0.5, shoulderY, 13 * scale, fill, stroke, z + 0.5),
    formJointSphere(common, `${role}:right-shoulder-joint`, cx + torsoWidth * 0.5, shoulderY, 13 * scale, fill, stroke, z + 0.51),
    formJointSphere(common, `${role}:left-hip-joint`, cx - hipWidth * 0.24, hipY, 13 * scale, fill, stroke, z + 0.42),
    formJointSphere(common, `${role}:right-hip-joint`, cx + hipWidth * 0.24, hipY, 13 * scale, fill, stroke, z + 0.43),
  ];
}

function expandPlaneObjectForm(mark) {
  const role = mark.role || 'plane-object';
  const anchor = validPoint(mark.anchor) || [finiteOr(mark.cx, 240), finiteOr(mark.cy, 180)];
  const scale = Math.max(finiteOr(mark.scale, 1), 0.1);
  const width = Math.max(finiteOr(mark.width, finiteOr(mark.w, 150 * scale)), 10);
  const height = Math.max(finiteOr(mark.height, finiteOr(mark.h, 92 * scale)), 10);
  const depth = Math.max(finiteOr(mark.depth, 16 * scale), 1);
  const x = roundPoint(anchor[0] - width / 2);
  const y = roundPoint(anchor[1] - height / 2);
  const fill = mark.fill || '#b1845e';
  const stroke = mark.stroke || '#4f3928';
  const common = formPrimitiveCommon(mark, role, mark.mode || 'animated', 'plane-object');

  return [
    {
      ...common,
      kind: 'solid',
      role: `${role}:cca-body`,
      x,
      y,
      width,
      height,
      depth,
      fill,
      stroke,
      z: finiteOr(mark.z, 14),
      formPart: 'cca-body',
    },
    {
      ...common,
      kind: 'plane',
      role: `${role}:front-plane`,
      anchor,
      length: width * 0.82,
      width: height * 0.72,
      axis: [1, 0],
      fill: mark.planeFill || shadeHex(fill, 1.06),
      stroke,
      z: finiteOr(mark.z, 14) + 0.5,
      formPart: 'front-plane',
    },
  ];
}

function isLowerBodyDummyStock(stock) {
  return ['lower-body-dummy', 'pelvis-leg-dummy', 'pelvis-legs-dummy', 'form-dummy-lower-body'].includes(String(stock || '').toLowerCase());
}

function isFullBodyDummyStock(stock) {
  return ['full-body-dummy', 'figure-dummy', 'form-dummy-full-body', 'mannequin-dummy'].includes(String(stock || '').toLowerCase());
}

function expandLowerBodyDummyForm(mark) {
  const role = mark.role || 'lower-body-dummy';
  const anchor = validPoint(mark.anchor) || [finiteOr(mark.cx, 220), finiteOr(mark.cy, 280)];
  const scale = Math.max(finiteOr(mark.scale, 1), 0.1);
  const fill = mark.fill || '#b1845e';
  const stroke = mark.stroke || '#4f3928';
  const z = finiteOr(mark.z, 20);
  const common = {
    ...formPrimitiveCommon(mark, role, mark.mode || 'dummy', mark.stock || 'lower-body-dummy'),
    formDummyPrimitive: true,
    constructionBasis: 'cca-joint-chain',
  };
  const cx = anchor[0];
  const pelvisY = anchor[1];
  const hipSpread = finiteOr(mark.hipSpread, 34 * scale);
  const kneeSpread = finiteOr(mark.kneeSpread, 28 * scale);
  const ankleSpread = finiteOr(mark.ankleSpread, 25 * scale);
  const kneeY = pelvisY + finiteOr(mark.upperLegLength, 74 * scale);
  const ankleY = kneeY + finiteOr(mark.lowerLegLength, 78 * scale);
  const footY = ankleY + finiteOr(mark.footDrop, 15 * scale);
  const footOut = finiteOr(mark.footOut, 18 * scale);
  const pelvis = [cx, pelvisY];
  const leftHip = [cx - hipSpread, pelvisY + 9 * scale];
  const rightHip = [cx + hipSpread, pelvisY + 9 * scale];
  const leftKnee = [cx - kneeSpread, kneeY];
  const rightKnee = [cx + kneeSpread, kneeY];
  const leftAnkle = [cx - ankleSpread, ankleY];
  const rightAnkle = [cx + ankleSpread, ankleY];
  const leftFoot = [leftAnkle[0] - footOut, footY];
  const rightFoot = [rightAnkle[0] + footOut, footY];
  const points = { pelvis, leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle, leftFoot, rightFoot };
  return [
    formDummyCore(common, `${role}:pelvis`, pelvis, 42 * scale, 30 * scale, -0.04, fill, stroke, z + 0.2, 'pelvis'),
    formDummyJoint(common, `${role}:left-hip-joint`, leftHip, 12 * scale, fill, stroke, z + 0.42, ['pelvis', 'left-upper-leg']),
    formDummyJoint(common, `${role}:right-hip-joint`, rightHip, 12 * scale, fill, stroke, z + 0.43, ['pelvis', 'right-upper-leg']),
    formDummyLimb(common, `${role}:left-upper-leg`, leftHip, leftKnee, 14 * scale, fill, stroke, z + 0.24),
    formDummyLimb(common, `${role}:right-upper-leg`, rightHip, rightKnee, 14 * scale, fill, stroke, z + 0.25),
    formDummyJoint(common, `${role}:left-knee-joint`, leftKnee, 11 * scale, fill, stroke, z + 0.5, ['left-upper-leg', 'left-lower-leg']),
    formDummyJoint(common, `${role}:right-knee-joint`, rightKnee, 11 * scale, fill, stroke, z + 0.51, ['right-upper-leg', 'right-lower-leg']),
    formDummyLimb(common, `${role}:left-lower-leg`, leftKnee, leftAnkle, 12 * scale, fill, stroke, z + 0.2),
    formDummyLimb(common, `${role}:right-lower-leg`, rightKnee, rightAnkle, 12 * scale, fill, stroke, z + 0.21),
    formDummyJoint(common, `${role}:left-ankle-joint`, leftAnkle, 9 * scale, fill, stroke, z + 0.55, ['left-lower-leg', 'left-foot']),
    formDummyJoint(common, `${role}:right-ankle-joint`, rightAnkle, 9 * scale, fill, stroke, z + 0.56, ['right-lower-leg', 'right-foot']),
    formDummyLimb(common, `${role}:left-foot`, leftAnkle, leftFoot, 9 * scale, fill, stroke, z + 0.18, 'foot'),
    formDummyLimb(common, `${role}:right-foot`, rightAnkle, rightFoot, 9 * scale, fill, stroke, z + 0.19, 'foot'),
  ].map((item) => ({
    ...item,
    formDummyJointsStick: true,
    formDummyAnchorMap: Object.fromEntries(Object.entries(points).map(([key, point]) => [key, [roundPoint(point[0]), roundPoint(point[1])]])),
  }));
}

function expandFullBodyDummyForm(mark) {
  const role = mark.role || 'full-body-dummy';
  const scale = Math.max(finiteOr(mark.scale, 1), 0.1);
  const fill = mark.fill || '#b1845e';
  const stroke = mark.stroke || '#4f3928';
  const z = finiteOr(mark.z, 20);
  const common = {
    ...formPrimitiveCommon(mark, role, mark.mode || 'dummy', mark.stock || 'full-body-dummy'),
    formDummyPrimitive: true,
    constructionBasis: mark.gesture ? 'gesture-cca-joint-chain' : 'cca-joint-chain',
  };
  const points = fullBodyDummyPoints(mark, scale);
  return [
    formDummyHead(common, `${role}:head`, points.head, 21 * scale, 26 * scale, fill, stroke, z + 0.78),
    formDummyJoint(common, `${role}:neck-joint`, points.neck, 10 * scale, fill, stroke, z + 0.7, ['head', 'torso']),
    formDummyCore(common, `${role}:torso`, points.torso, 36 * scale, 52 * scale, dummyRotation(points.neck, points.pelvis), fill, stroke, z + 0.38, 'torso'),
    formDummyCore(common, `${role}:pelvis`, points.pelvis, 38 * scale, 28 * scale, dummyRotation(points.leftHip, points.rightHip) + Math.PI / 2, fill, stroke, z + 0.24, 'pelvis'),
    formDummyLimb(common, `${role}:torso-carry`, points.torso, points.pelvis, 20 * scale, fill, stroke, z + 0.28, 'core-span'),
    formDummyJoint(common, `${role}:left-shoulder-joint`, points.leftShoulder, 11 * scale, fill, stroke, z + 0.56, ['torso', 'left-upper-arm']),
    formDummyJoint(common, `${role}:right-shoulder-joint`, points.rightShoulder, 11 * scale, fill, stroke, z + 0.57, ['torso', 'right-upper-arm']),
    formDummyLimb(common, `${role}:left-upper-arm`, points.leftShoulder, points.leftElbow, 10 * scale, fill, stroke, z + 0.32),
    formDummyLimb(common, `${role}:right-upper-arm`, points.rightShoulder, points.rightElbow, 10 * scale, fill, stroke, z + 0.33),
    formDummyJoint(common, `${role}:left-elbow-joint`, points.leftElbow, 9 * scale, fill, stroke, z + 0.58, ['left-upper-arm', 'left-forearm']),
    formDummyJoint(common, `${role}:right-elbow-joint`, points.rightElbow, 9 * scale, fill, stroke, z + 0.59, ['right-upper-arm', 'right-forearm']),
    formDummyLimb(common, `${role}:left-forearm`, points.leftElbow, points.leftWrist, 9 * scale, fill, stroke, z + 0.34),
    formDummyLimb(common, `${role}:right-forearm`, points.rightElbow, points.rightWrist, 9 * scale, fill, stroke, z + 0.35),
    formDummyJoint(common, `${role}:left-wrist-joint`, points.leftWrist, 7 * scale, fill, stroke, z + 0.6, ['left-forearm']),
    formDummyJoint(common, `${role}:right-wrist-joint`, points.rightWrist, 7 * scale, fill, stroke, z + 0.61, ['right-forearm']),
    formDummyJoint(common, `${role}:left-hip-joint`, points.leftHip, 12 * scale, fill, stroke, z + 0.42, ['pelvis', 'left-upper-leg']),
    formDummyJoint(common, `${role}:right-hip-joint`, points.rightHip, 12 * scale, fill, stroke, z + 0.43, ['pelvis', 'right-upper-leg']),
    formDummyLimb(common, `${role}:left-upper-leg`, points.leftHip, points.leftKnee, 13 * scale, fill, stroke, z + 0.24),
    formDummyLimb(common, `${role}:right-upper-leg`, points.rightHip, points.rightKnee, 13 * scale, fill, stroke, z + 0.25),
    formDummyJoint(common, `${role}:left-knee-joint`, points.leftKnee, 10 * scale, fill, stroke, z + 0.5, ['left-upper-leg', 'left-lower-leg']),
    formDummyJoint(common, `${role}:right-knee-joint`, points.rightKnee, 10 * scale, fill, stroke, z + 0.51, ['right-upper-leg', 'right-lower-leg']),
    formDummyLimb(common, `${role}:left-lower-leg`, points.leftKnee, points.leftAnkle, 11 * scale, fill, stroke, z + 0.2),
    formDummyLimb(common, `${role}:right-lower-leg`, points.rightKnee, points.rightAnkle, 11 * scale, fill, stroke, z + 0.21),
    formDummyJoint(common, `${role}:left-ankle-joint`, points.leftAnkle, 8 * scale, fill, stroke, z + 0.55, ['left-lower-leg', 'left-foot']),
    formDummyJoint(common, `${role}:right-ankle-joint`, points.rightAnkle, 8 * scale, fill, stroke, z + 0.56, ['right-lower-leg', 'right-foot']),
    formDummyLimb(common, `${role}:left-foot`, points.leftAnkle, points.leftFoot, 8 * scale, fill, stroke, z + 0.18, 'foot'),
    formDummyLimb(common, `${role}:right-foot`, points.rightAnkle, points.rightFoot, 8 * scale, fill, stroke, z + 0.19, 'foot'),
  ].map((item) => ({
    ...item,
    formDummyJointsStick: true,
    gestureBasedDummy: Boolean(mark.gesture),
    formDummyAnchorMap: Object.fromEntries(Object.entries(points).map(([key, point]) => [key, [roundPoint(point[0]), roundPoint(point[1])]])),
  }));
}

function fullBodyDummyPoints(mark, scale) {
  const gesture = mark.gesture && typeof mark.gesture === 'object' && !Array.isArray(mark.gesture)
    ? mark.gesture
    : null;
  if (gesture && Array.isArray(gesture.points) && gesture.points.length >= 2) {
    return gestureFullBodyDummyPoints(mark, gesture, scale);
  }
  const anchor = validPoint(mark.anchor) || [finiteOr(mark.cx, 220), finiteOr(mark.cy, 250)];
  const cx = anchor[0];
  const cy = anchor[1];
  const shoulderSpread = finiteOr(mark.shoulderSpread, 42 * scale);
  const hipSpread = finiteOr(mark.hipSpread, 30 * scale);
  const kneeSpread = finiteOr(mark.kneeSpread, 24 * scale);
  const ankleSpread = finiteOr(mark.ankleSpread, 22 * scale);
  const shoulderY = cy - 54 * scale;
  const pelvisY = cy + 44 * scale;
  const elbowY = cy - 8 * scale;
  const wristY = cy + 38 * scale;
  const kneeY = pelvisY + finiteOr(mark.upperLegLength, 68 * scale);
  const ankleY = kneeY + finiteOr(mark.lowerLegLength, 72 * scale);
  const footDrop = finiteOr(mark.footDrop, 13 * scale);
  const footOut = finiteOr(mark.footOut, 17 * scale);
  return {
    head: [cx, cy - 106 * scale],
    neck: [cx, cy - 74 * scale],
    torso: [cx, cy - 20 * scale],
    pelvis: [cx, pelvisY],
    leftShoulder: [cx - shoulderSpread, shoulderY],
    rightShoulder: [cx + shoulderSpread, shoulderY],
    leftElbow: [cx - shoulderSpread - 18 * scale, elbowY],
    rightElbow: [cx + shoulderSpread + 18 * scale, elbowY],
    leftWrist: [cx - shoulderSpread - 8 * scale, wristY],
    rightWrist: [cx + shoulderSpread + 8 * scale, wristY],
    leftHip: [cx - hipSpread, pelvisY + 8 * scale],
    rightHip: [cx + hipSpread, pelvisY + 8 * scale],
    leftKnee: [cx - kneeSpread, kneeY],
    rightKnee: [cx + kneeSpread, kneeY],
    leftAnkle: [cx - ankleSpread, ankleY],
    rightAnkle: [cx + ankleSpread, ankleY],
    leftFoot: [cx - ankleSpread - footOut, ankleY + footDrop],
    rightFoot: [cx + ankleSpread + footOut, ankleY + footDrop],
  };
}

function gestureFullBodyDummyPoints(mark, gesture, scale) {
  const side = String(gesture.activeSide || mark.activeSide || 'right').toLowerCase();
  const shoulderSpread = finiteOr(mark.shoulderSpread, 38 * scale);
  const hipSpread = finiteOr(mark.hipSpread, 28 * scale);
  const kneeSpread = finiteOr(mark.kneeSpread, 22 * scale);
  const ankleSpread = finiteOr(mark.ankleSpread, 20 * scale);
  const upperLegLength = finiteOr(mark.upperLegLength, 68 * scale);
  const lowerLegLength = finiteOr(mark.lowerLegLength, 72 * scale);
  const footDrop = finiteOr(mark.footDrop, 12 * scale);
  const footOut = finiteOr(mark.footOut, 15 * scale);
  const body = (t, offset = [0, 0]) => offsetGestureSample(sampleGesture(gesture.points, t), { offset }).point;
  const pelvisSample = sampleGesture(gesture.points, 0.74);
  const legTangent = normalize(pelvisSample.tangent || [0, 1]);
  const legNormal = [-legTangent[1], legTangent[0]];
  const legPoint = (along, lateral) => [
    pelvisSample.point[0] + legTangent[0] * along + legNormal[0] * lateral,
    pelvisSample.point[1] + legTangent[1] * along + legNormal[1] * lateral,
  ];
  const points = {
    head: body(0.04),
    neck: body(0.18),
    torso: body(0.42),
    pelvis: body(0.72),
    leftShoulder: body(0.31, [-shoulderSpread, 0]),
    rightShoulder: body(0.31, [shoulderSpread, 0]),
    leftHip: legPoint(4 * scale, -hipSpread),
    rightHip: legPoint(4 * scale, hipSpread),
    leftKnee: legPoint(upperLegLength, -kneeSpread),
    rightKnee: legPoint(upperLegLength, kneeSpread),
    leftAnkle: legPoint(upperLegLength + lowerLegLength, -ankleSpread),
    rightAnkle: legPoint(upperLegLength + lowerLegLength, ankleSpread),
    leftFoot: legPoint(upperLegLength + lowerLegLength + footDrop, -ankleSpread - footOut),
    rightFoot: legPoint(upperLegLength + lowerLegLength + footDrop, ankleSpread + footOut),
  };
  const leftAxis = mark.leftArmGesture || gesture.leftArm || (side === 'left' ? gesture.crossGesture || gesture.cross : null);
  const rightAxis = mark.rightArmGesture || gesture.rightArm || (side !== 'left' ? gesture.crossGesture || gesture.cross : null);
  assignArmGesturePoints(points, 'left', leftAxis, points.leftShoulder, scale, -1);
  assignArmGesturePoints(points, 'right', rightAxis, points.rightShoulder, scale, 1);
  return points;
}

function assignArmGesturePoints(points, side, axis, shoulder, scale, direction) {
  const elbowKey = `${side}Elbow`;
  const wristKey = `${side}Wrist`;
  if (axis && Array.isArray(axis.points) && axis.points.length >= 2) {
    if (axis.attachShoulder === true) {
      points[`${side}Shoulder`] = sampleGesture(axis.points, 0.05).point;
    }
    points[elbowKey] = sampleGesture(axis.points, 0.52).point;
    points[wristKey] = sampleGesture(axis.points, 0.94).point;
    return;
  }
  points[elbowKey] = [shoulder[0] + direction * 18 * scale, shoulder[1] + 48 * scale];
  points[wristKey] = [shoulder[0] + direction * 10 * scale, shoulder[1] + 94 * scale];
}

function dummyRotation(from, to) {
  return rotationFromTangent(normalize([to[0] - from[0], to[1] - from[1]]));
}

function formDummyHead(common, role, point, rx, ry, fill, stroke, z) {
  return {
    ...common,
    kind: 'egg',
    role,
    anchor: [roundPoint(point[0]), roundPoint(point[1])],
    rx,
    ry,
    fill,
    stroke,
    z,
    formPart: 'head',
  };
}

function formDummyCore(common, role, point, rx, ry, rotation, fill, stroke, z, part) {
  return {
    ...common,
    kind: 'blob',
    role,
    anchor: [roundPoint(point[0]), roundPoint(point[1])],
    rx,
    ry,
    rotation,
    fill,
    stroke,
    z,
    formPart: part || 'core',
  };
}

function formDummyJoint(common, role, point, r, fill, stroke, z, connects) {
  return {
    ...common,
    kind: 'sphere',
    role,
    anchor: [roundPoint(point[0]), roundPoint(point[1])],
    r,
    fill: shadeHex(fill, 1.04),
    stroke,
    z,
    formPart: 'joint',
    jointVisible: true,
    jointPlacement: 'between-segments',
    terminatesIntoJoints: true,
    jointMediated: true,
    jointConnects: connects,
  };
}

function formDummyLimb(common, role, from, to, thickness, fill, stroke, z, part = 'limb') {
  const midpoint = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  const length = Math.max(Math.hypot(to[0] - from[0], to[1] - from[1]), 1);
  const tangent = normalize([to[0] - from[0], to[1] - from[1]]);
  return {
    ...common,
    kind: 'blob',
    role,
    anchor: [roundPoint(midpoint[0]), roundPoint(midpoint[1])],
    rx: thickness,
    ry: length / 2,
    rotation: rotationFromTangent(tangent),
    fill,
    stroke,
    z,
    formPart: part,
    terminatesIntoJoints: true,
    jointMediated: true,
  };
}

function formPrimitiveCommon(mark, role, mode, stock) {
  return {
    constructionKind: 'form',
    constructionRole: role,
    formPrimitiveRole: role,
    formPrimitiveMode: mode,
    formPrimitiveStock: stock,
    formMassTuning: mark.massTuning,
    speciesStock: mark.speciesStock,
  };
}

function formMassProfile(value) {
  const key = String(value || 'fit').toLowerCase();
  const profiles = {
    lean: { torsoWidth: 54, hipWidth: 42, headScale: 0.95 },
    fit: { torsoWidth: 66, hipWidth: 50, headScale: 1 },
    stocky: { torsoWidth: 82, hipWidth: 66, headScale: 1.04 },
    soft: { torsoWidth: 88, hipWidth: 74, headScale: 1.05 },
    'slightly-obese': { torsoWidth: 98, hipWidth: 86, headScale: 1.06 },
  };
  return profiles[key] || profiles.fit;
}

function formLimbBlob(common, role, cx, cy, rx, ry, rotation, fill, stroke, z, part) {
  return {
    ...common,
    kind: 'blob',
    role,
    anchor: [roundPoint(cx), roundPoint(cy)],
    rx,
    ry,
    rotation,
    fill,
    stroke,
    z,
    formPart: part,
  };
}

function formJointSphere(common, role, cx, cy, r, fill, stroke, z) {
  return {
    ...common,
    kind: 'sphere',
    role,
    anchor: [roundPoint(cx), roundPoint(cy)],
    r,
    fill: shadeHex(fill, 1.04),
    stroke,
    z,
    formPart: 'joint',
    jointVisible: true,
  };
}

function expandCubieLatticeMark(mark, scene = {}, manifest = {}) {
  const cols = Math.max(1, Math.min(9, Math.round(finiteOr(mark.cols, 3))));
  const rows = Math.max(1, Math.min(9, Math.round(finiteOr(mark.rows, 3))));
  const layers = Math.max(1, Math.min(9, Math.round(finiteOr(mark.layers, finiteOr(mark.depthCount, 3)))));
  const cellSize = Math.max(finiteOr(mark.cellSize, finiteOr(mark.size, 48)), 2);
  const gap = Math.max(finiteOr(mark.gap, cellSize * 0.18), 0);
  const role = mark.role || 'cubie-lattice';
  const mandala = manifest?.polygonizer?.pureMandala;
  const mandalaBlock = findMandalaBlock(mandala, mark.mandalaRole || mark.role);
  const projectedBlock = mandalaBlock ? projectMandalaBlock(mandala, mandalaBlock) : null;
  const anchor = projectedBlock?.anchor || validPoint(mark.anchor) || [finiteOr(mark.x, 0), finiteOr(mark.y, 0)];
  const step = cellSize + gap;
  const depthStep = Math.max(finiteOr(mark.depthStep, step * 0.62), 1);
  const pureMandalaMode = Boolean(projectedBlock);
  const floorMode = mark.depthMode === 'floor-plane' || pureMandalaMode;
  const layerLift = finiteOr(mark.layerLift, -step * 0.42);
  const layerShift = finiteOr(mark.layerShift, step * 0.56);
  const startX = anchor[0] - ((cols - 1) * step) / 2;
  const startY = anchor[1] - ((rows - 1) * step) / 2;
  const count = cols * rows * layers;
  const palette = Array.isArray(mark.palette) && mark.palette.length ? mark.palette : null;
  const out = [];
  let index = 0;

  for (let layer = layers - 1; layer >= 0; layer--) {
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        index += 1;
        const basis = pureMandalaMode
          ? pureMandalaCubieBasis({ mark, mandala, mandalaBlock, col, row, layer, cols, rows, layers, cellSize, gap })
          : floorMode
          ? floorCubieBasis({ mark, scene, anchor, layer, layers, step, cellSize })
          : {
              layerOffsetX: layerShift * layer,
              layerOffsetY: layerLift * layer,
              scale: 1,
              floorT: layers <= 1 ? 0 : layer / (layers - 1),
            };
        const scaledCell = Math.max(cellSize * basis.scale, 1);
        const x = pureMandalaMode ? basis.x : startX + col * step * basis.scale + basis.layerOffsetX;
        const y = pureMandalaMode ? basis.y : startY + row * step * basis.scale + basis.layerOffsetY;
        const depth = Math.max(finiteOr(mark.depth, cellSize * 0.78) * basis.scale, 1);
        const cubieRole = `${role}-cubie-c${col + 1}r${row + 1}l${layer + 1}`;
        out.push({
          kind: 'solid',
          role: cubieRole,
          x: roundPoint(x),
          y: roundPoint(y),
          width: scaledCell,
          height: scaledCell,
          depth,
          fill: palette ? palette[(col + row + layer) % palette.length] : mark.fill || '#b1845e',
          stroke: mark.stroke || '#4f3928',
          strokeWidth: finiteOr(mark.strokeWidth, 0.8),
          z: finiteOr(mark.z, 20) + layer * 0.7 + row * 0.08 + col * 0.02,
          constructionKind: 'cubieLattice',
          constructionRole: role,
          cubieLatticeRole: role,
          cubieIndex: index - 1,
          cubieCol: col,
          cubieRow: row,
          cubieLayer: layer,
          cubieCount: count,
          cubieCols: cols,
          cubieRows: rows,
          cubieLayers: layers,
          cubieGap: gap,
          cubieCellSize: scaledCell,
          cubieDepthMode: pureMandalaMode ? 'pure-mandala' : floorMode ? 'floor-plane' : 'offset',
          cubieFloorT: round(basis.floorT),
          cubiePerspectiveScale: round(basis.scale),
          cubieWorldXYZ: basis.worldXYZ,
        });
      }
    }
  }
  return out;
}

function pureMandalaCubieBasis({ mark, mandala, mandalaBlock, col, row, layer, cols, rows, layers, cellSize, gap }) {
  const worldXY = validPoint(mandalaBlock.worldXY) || [0, 0];
  const altitude = finiteOr(mandalaBlock.altitude, 0);
  const unitCellSize = Math.max(finiteOr(mark.unitCellSize, 1), 0.001);
  const unitGap = Math.max(finiteOr(mark.unitGap, 0), 0);
  const worldPitch = unitCellSize + unitGap;
  const worldStepX = finiteOr(mark.unitStepX, worldPitch);
  const worldStepY = finiteOr(mark.unitStepY, worldPitch);
  const worldStepZ = finiteOr(mark.unitStepZ, worldPitch);
  const x = worldXY[0] + (col - (cols - 1) / 2) * worldStepX;
  const y = worldXY[1] + ((rows - 1) / 2 - row) * worldStepY;
  const z = altitude + unitCellSize / 2 + layer * worldStepZ;
  const screen = projectMandalaPoint(mandala, { x, y, altitude: z });
  const floorT = layers <= 1 ? 0 : layer / (layers - 1);
  const depthScale = clamp(finiteOr(mandala.camera?.depthScale, 0.84), 0.2, 1);
  const scale = Math.pow(depthScale, Math.max(0, -y));
  return {
    x: screen[0] - (cellSize * scale) / 2,
    y: screen[1] - (cellSize * scale) / 2,
    scale,
    floorT,
    worldXYZ: [round(x), round(y), round(z)],
  };
}

function floorCubieBasis({ mark, scene, anchor, layer, layers, step, cellSize }) {
  const vp = validPoint(mark.vanishingPoint) ||
    validPoint(scene.perspective?.vanishingPoint) ||
    [anchor[0], finiteOr(scene.perspective?.horizonY, anchor[1] - step * 3)];
  const floorT = layers <= 1 ? 0 : layer / (layers - 1);
  const maxDepth = finiteOr(mark.floorDepth, step * 2.35);
  const toVp = normalize([vp[0] - anchor[0], vp[1] - anchor[1]]);
  const distance = maxDepth * floorT;
  const perspectiveDepth = Math.max(finiteOr(scene.perspective?.depthScale, 260), 1);
  const scale = perspectiveDepth / (perspectiveDepth + distance * 0.8);
  const lateralCompensation = ((1 - scale) * (cellSize + step)) / 2;
  return {
    layerOffsetX: toVp[0] * distance + lateralCompensation,
    layerOffsetY: toVp[1] * distance,
    scale,
    floorT,
  };
}

function rememberRole(mark, byRole) {
  if (mark && typeof mark.role === 'string' && mark.role) {
    byRole.set(mark.role, mark);
  }
}

function expandPartitionMark(mark, byRole) {
  const target = byRole.get(mark.target);
  if (!target) {
    throw new Error(`partition '${mark.role || '(anonymous)'}' target '${mark.target || '(missing)'}' was not found`);
  }
  if (mark.axis !== undefined && mark.axis !== 'y') {
    throw new Error(`partition '${mark.role || '(anonymous)'}' only supports axis:'y' in this spike`);
  }
  const count = Math.max(1, Math.min(12, Math.round(finiteOr(mark.count, 1))));
  const x = finiteOr(target.x, finiteOr(target.anchor?.[0], 0));
  const y = finiteOr(target.y, finiteOr(target.anchor?.[1], 0));
  const width = Math.max(finiteOr(target.width, finiteOr(target.w, 80)), 1);
  const height = Math.max(finiteOr(target.height, finiteOr(target.h, 80)), 1);
  const depth = Math.max(finiteOr(target.depth, finiteOr(target.d, 40)), 1);
  const thickness = Math.max(finiteOr(mark.thickness, finiteOr(target.boardThickness, height * 0.045)), 3);
  const role = mark.role || 'partition';
  const fill = mark.fill || target.partitionFill || target.fill || '#b1845e';
  const stroke = mark.stroke || target.stroke || '#4f3928';
  const out = [];

  for (let i = 0; i <= count; i++) {
    const rawY = y + (height * i) / count;
    const boardY = i === count ? rawY - thickness : rawY;
    out.push({
      kind: 'solid',
      role: `${role}-board-${i + 1}`,
      x,
      y: boardY,
      width,
      height: thickness,
      depth,
      fill,
      stroke,
      strokeWidth: mark.strokeWidth ?? target.strokeWidth,
      z: finiteOr(mark.z, finiteOr(target.z, 10) + 0.04 + i * 0.01),
      constructionKind: 'partition',
      constructionRole: role,
      partitionTarget: mark.target,
      partitionAxis: 'y',
      partitionCount: count,
      partitionBoardIndex: i,
      partitionBoundary: i === 0 ? 'start' : i === count ? 'end' : 'internal',
    });
  }
  return out;
}

function expandArrayMark(mark) {
  const from = validPoint(mark.from);
  const to = validPoint(mark.to);
  if (!from || !to) {
    throw new Error(`array '${mark.role || '(anonymous)'}' requires from:[x,y] and to:[x,y]`);
  }
  const item = mark.item && typeof mark.item === 'object' ? mark.item : {};
  const count = Math.max(1, Math.min(120, Math.round(finiteOr(mark.count, 1))));
  const role = mark.role || 'array';
  const out = [];
  const upperFrom = validPoint(mark.upperFrom || item.upperFrom);
  const upperTo = validPoint(mark.upperTo || item.upperTo);

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const p = lerpPoint(from, to, t);
    const scale = lerp(
      finiteOr(mark.scaleFrom, finiteOr(item.scaleFrom, 1)),
      finiteOr(mark.scaleTo, finiteOr(item.scaleTo, 1)),
      t,
    );
    if (item.kind === 'solid') {
      out.push({
        ...item,
        kind: 'solid',
        role: `${role}-${i + 1}`,
        x: roundPoint(p[0] - finiteOr(item.width, finiteOr(item.w, 12)) / 2),
        y: roundPoint(p[1] - finiteOr(item.height, finiteOr(item.h, 40))),
        width: Math.max(finiteOr(item.width, finiteOr(item.w, 12)) * scale, 1),
        height: Math.max(finiteOr(item.height, finiteOr(item.h, 40)) * scale, 1),
        depth: Math.max(finiteOr(item.depth, finiteOr(item.d, 10)) * scale, 1),
        constructionKind: 'array',
        constructionRole: role,
        arrayIndex: i,
        arrayCount: count,
      });
      continue;
    }

    const q = upperFrom && upperTo
      ? lerpPoint(upperFrom, upperTo, t)
      : [p[0], p[1] - Math.max(finiteOr(item.length, 40) * scale, 1)];
    out.push({
      ...item,
      kind: 'line',
      role: `${role}-${i + 1}`,
      x1: roundPoint(q[0]),
      y1: roundPoint(q[1]),
      x2: roundPoint(p[0]),
      y2: roundPoint(p[1]),
      stroke: item.stroke || mark.stroke || '#d46f42',
      strokeWidth: finiteOr(item.strokeWidth, finiteOr(mark.strokeWidth, 2)),
      opacity: item.opacity ?? mark.opacity,
      z: finiteOr(item.z, finiteOr(mark.z, 20) + i * 0.001),
      constructionKind: 'array',
      constructionRole: role,
      arrayIndex: i,
      arrayCount: count,
      arrayT: round(t),
    });
  }
  return out;
}

function expandHorizontalStackMark(mark) {
  return expandMandalaArrangementMark(horizontalStackToMandalaArrangement(mark));
}

function horizontalStackToMandalaArrangement(mark) {
  const role = mark.role || 'horizontal-stack';
  const mode = normalizeHorizontalStackMode(mark.mode || mark.stackMode);
  const activeRay = normalizeMandalaArrangementActiveRay(mark.activeRay || mark.ray || mark.axis);
  const start = validPoint(mark.from) ||
    validPoint(mark.anchor) ||
    [finiteOr(mark.x, 0), finiteOr(mark.y, 0)];
  const baselineY = finiteOr(mark.baselineY, finiteOr(mark.y, start[1]));
  return {
    ...mark,
    kind: 'mandalaArrangement',
    role,
    profile: 'horizontal-stack',
    mode,
    activeRay,
    basis: {
      kind: 'local-lateral-support',
      ...(mark.basis && typeof mark.basis === 'object' && !Array.isArray(mark.basis) ? mark.basis : {}),
      origin: validPoint(mark.basis?.origin) || [start[0], baselineY],
      xAxis: validPoint(mark.basis?.xAxis) || validPoint(mark.xAxis) || [1, 0],
      supportAxis: validPoint(mark.basis?.supportAxis) || validPoint(mark.supportAxis) || [0, -1],
      localSpace: mark.basis?.localSpace || mark.localSpace || 'cca-local',
    },
    policy: {
      collision: mark.policy?.collision || mark.memberCollision || (mode === 'superposition' ? 'allow-superposition' : 'avoid'),
      support: mark.policy?.support || (mode === 'gravity' ? 'gravity' : 'none'),
      skin: mark.policy?.skin || mark.skinPolicy || (mark.skinJoin === true || mode === 'superposition' ? 'join' : 'separate'),
    },
  };
}

function expandMandalaArrangementMark(mark) {
  const role = mark.role || 'mandala-arrangement';
  const profile = mark.profile || mark.arrangementProfile || 'horizontal-stack';
  if (!['horizontal-stack', 'ray-contact-stack'].includes(profile)) {
    throw new Error(`mandalaArrangement '${role}' unsupported profile '${profile}'`);
  }
  const mode = normalizeHorizontalStackMode(mark.mode || mark.stackMode || mark.policy?.support || mark.policy?.collision);
  const axis = mark.axis || 'x';
  const activeRay = normalizeMandalaArrangementActiveRay(mark.activeRay || mark.ray || axis);
  const members = Array.isArray(mark.members) ? mark.members : [];
  if (!members.length) {
    throw new Error(`mandalaArrangement '${role}' requires members[]`);
  }
  const basis = resolveMandalaArrangementBasis(mark);
  const spacing = finiteOr(mark.spacing, mode === 'superposition' ? 0 : 8);
  const overlap = clamp(finiteOr(mark.overlap, mode === 'superposition' ? 0.32 : 0), 0, 0.95);
  const memberCollision = normalizeMandalaArrangementCollision(mark.policy?.collision || mark.memberCollision, mode);
  const skinPolicy = normalizeMandalaArrangementSkin(mark.policy?.skin || mark.skinPolicy, mode, mark.skinJoin);
  const out = [];
  const footprints = [];
  let cursor = finiteOr(mark.start, finiteOr(mark.localStart, 0));
  let contactCursorEnd = null;

  members.forEach((member, index) => {
    const item = member && typeof member === 'object' && !Array.isArray(member) ? member : {};
    const size = horizontalStackMemberSize(item);
    const memberRole = item.role || `${role}-${index + 1}`;
    const extent = mandalaArrangementMemberRayExtent(size, activeRay);
    const floater = mandalaArrangementMemberFloater(item);
    const rayContactPolicy = mandalaArrangementCollisionPolicy({
      mode,
      memberCollision,
      collisionPolicy: mark.collisionPolicy || mark.policy?.collision,
      floater,
    });
    const authoredCursor = Array.isArray(item.local) && item.local.length >= 1
      ? finiteOr(item.local[0], cursor)
      : cursor;
    let resolvedCursor = authoredCursor;
    if (!floater && rayContactPolicy === 'repel-until-contact' && contactCursorEnd !== null && resolvedCursor < contactCursorEnd) {
      resolvedCursor = contactCursorEnd;
    }
    const slot = mandalaArrangementSlot({
      basis,
      cursor: resolvedCursor,
      authoredCursor,
      size,
      item,
      activeRay,
      extent,
      resolved: resolvedCursor !== authoredCursor,
    });
    const placed = placeHorizontalStackMember({
      item,
      role: memberRole,
      x: slot.x,
      baselineY: slot.baselineY,
      z: finiteOr(item.z, finiteOr(mark.z, 18) + index * 0.01),
      stackRole: role,
      mode,
      axis,
      activeRay,
      memberCollision,
      skinPolicy,
      supportRole: mark.supportRole,
      collisionPolicy: mark.collisionPolicy || mark.policy?.collision,
      floaterPolicy: mark.floaterPolicy || mark.policy?.floater,
      floater,
      rayContactPolicy,
      arrangementProfile: profile,
      basis,
      slot,
      index,
      count: members.length,
    });
    out.push(placed);
    footprints.push(horizontalStackMemberBounds(placed, size));
    if (!floater && rayContactPolicy === 'repel-until-contact') {
      contactCursorEnd = Math.max(finiteOr(contactCursorEnd, resolvedCursor), resolvedCursor + extent);
    }
    cursor += Math.max(extent * (1 - overlap) + spacing, 1);
  });

  if (mode === 'superposition' && skinPolicy === 'join' && footprints.length) {
    out.push(horizontalStackJoinedSkinMark({
      role,
      footprints,
      mark,
      mode,
      axis,
      activeRay,
      memberCollision,
      skinPolicy,
      basis,
      profile,
    }));
  }

  return out;
}

function resolveMandalaArrangementBasis(mark = {}) {
  const raw = mark.basis && typeof mark.basis === 'object' && !Array.isArray(mark.basis) ? mark.basis : {};
  const origin = validPoint(raw.origin) ||
    validPoint(mark.anchor) ||
    [finiteOr(mark.x, 0), finiteOr(mark.baselineY, finiteOr(mark.y, 0))];
  const xAxis = normalize(validPoint(raw.xAxis) || validPoint(mark.xAxis) || validPoint(raw.rays?.east) || [1, 0]);
  const supportAxis = normalize(validPoint(raw.supportAxis) || validPoint(mark.supportAxis) || validPoint(raw.rays?.zenith) || [0, -1]);
  const depthAxis = normalize(validPoint(raw.depthAxis) || validPoint(mark.depthAxis) || validPoint(raw.rays?.north) || [0.55, -0.72]);
  return {
    kind: raw.kind || mark.basisKind || 'local-lateral-support',
    localSpace: raw.localSpace || mark.localSpace || 'cca-local',
    origin: roundPointTuple(origin),
    xAxis,
    supportAxis,
    depthAxis,
    rays: {
      east: xAxis,
      west: [-xAxis[0], -xAxis[1]],
      north: depthAxis,
      south: [-depthAxis[0], -depthAxis[1]],
      zenith: supportAxis,
      nadir: [-supportAxis[0], -supportAxis[1]],
      ...(raw.rays && typeof raw.rays === 'object' && !Array.isArray(raw.rays) ? raw.rays : {}),
    },
  };
}

function mandalaArrangementSlot({ basis, cursor, authoredCursor, item, activeRay, extent, resolved = false }) {
  const localY = Array.isArray(item.local) && item.local.length >= 2
    ? finiteOr(item.local[1], 0)
    : finiteOr(item.localY, 0);
  const local = [cursor, localY];
  const authoredLocalX = finiteOr(authoredCursor, local[0]);
  const rayVector = mandalaArrangementRayVector(basis, activeRay);
  const baseline = [
    basis.origin[0] + rayVector[0] * local[0] + basis.supportAxis[0] * local[1],
    basis.origin[1] + rayVector[1] * local[0] + basis.supportAxis[1] * local[1],
  ];
  const interval = [roundPoint(local[0]), roundPoint(local[0] + finiteOr(extent, 0))];
  const intervalBefore = [roundPoint(authoredLocalX), roundPoint(authoredLocalX + finiteOr(extent, 0))];
  return {
    local: local.map(roundPoint),
    localBefore: [roundPoint(authoredLocalX), roundPoint(local[1])],
    x: roundPoint(baseline[0]),
    baselineY: roundPoint(baseline[1]),
    interval,
    intervalBefore,
    resolved,
    displacement: roundPoint(local[0] - authoredLocalX),
    rayVector: rayVector.map(round),
    basisKind: basis.kind,
  };
}

function normalizeMandalaArrangementActiveRay(value) {
  const text = String(value || '').toLowerCase().replace(/_/g, '-');
  if (text.includes('north') || text.includes('south') || text.includes('depth') || text.includes('floor') || text === 'z') return 'north-south';
  if (text.includes('zenith') || text.includes('nadir') || text.includes('vertical') || text.includes('altitude') || text === 'y') return 'zenith-nadir';
  return 'east-west';
}

function mandalaArrangementRayVector(basis = {}, activeRay = 'east-west') {
  if (activeRay === 'north-south') return normalize(validPoint(basis.rays?.north) || validPoint(basis.depthAxis) || [0.55, -0.72]);
  if (activeRay === 'zenith-nadir') return normalize(validPoint(basis.rays?.zenith) || validPoint(basis.supportAxis) || [0, -1]);
  return normalize(validPoint(basis.rays?.east) || validPoint(basis.xAxis) || [1, 0]);
}

function mandalaArrangementMemberRayExtent(size = {}, activeRay = 'east-west') {
  if (activeRay === 'north-south') return Math.max(finiteOr(size.depth, finiteOr(size.width, 1)), 1);
  if (activeRay === 'zenith-nadir') return Math.max(finiteOr(size.height, 1), 1);
  return Math.max(finiteOr(size.width, 1), 1);
}

function normalizeMandalaFloaterPolicy(value) {
  const text = String(value || '').toLowerCase();
  if (text.includes('drift')) return 'decorative-drift';
  if (text.includes('z')) return 'z-adjacency-bias';
  return 'allow-superposition';
}

function mandalaArrangementMemberFloater(item = {}) {
  return item.gravity === false || item.nonGravity === true || item.floater === true || item.float === true;
}

function mandalaArrangementCollisionPolicy({ mode, memberCollision, collisionPolicy, floater }) {
  if (floater) return 'floater';
  const text = String(collisionPolicy || memberCollision || '').toLowerCase();
  if (text.includes('repel') || text.includes('contact')) return 'repel-until-contact';
  if (text.includes('allow') || text.includes('super')) return 'allow-superposition';
  return mode === 'gravity' ? 'repel-until-contact' : 'allow-superposition';
}

function normalizeMandalaArrangementCollision(value, mode) {
  const text = String(value || '').toLowerCase();
  if (text.includes('allow') || text.includes('super')) return 'allow';
  if (text.includes('avoid') || text.includes('clear')) return 'avoid';
  return mode === 'superposition' ? 'allow' : 'avoid';
}

function normalizeMandalaArrangementSkin(value, mode, skinJoin) {
  const text = String(value || '').toLowerCase();
  if (text.includes('join') || skinJoin === true) return 'join';
  if (text.includes('separate')) return 'separate';
  return mode === 'superposition' ? 'join' : 'separate';
}

function normalizeHorizontalStackMode(mode) {
  const text = String(mode || 'gravity').toLowerCase();
  if (text.includes('super') || text.includes('compound') || text.includes('merge')) return 'superposition';
  return 'gravity';
}

function horizontalStackMemberSize(item = {}) {
  const kind = item.kind || 'solid';
  if (kind === 'sphere') {
    const r = Math.max(finiteOr(item.r, finiteOr(item.radius, 20)), 1);
    return { width: r * 2, height: r * 2, depth: r * 2 };
  }
  if (kind === 'oval' || kind === 'egg' || kind === 'blob') {
    return {
      width: Math.max(finiteOr(item.rx, finiteOr(item.width, 24)) * 2, 1),
      height: Math.max(finiteOr(item.ry, finiteOr(item.height, 24)) * 2, 1),
      depth: Math.max(finiteOr(item.depth, finiteOr(item.d, finiteOr(item.rx, finiteOr(item.width, 24)) * 2)), 1),
    };
  }
  if (kind === 'polygon' && Array.isArray(item.points) && item.points.length) {
    const bounds = bbox(item.points.filter(validPoint));
    return { width: Math.max(bounds?.w || 1, 1), height: Math.max(bounds?.h || 1, 1), depth: Math.max(finiteOr(item.depth, finiteOr(item.d, bounds?.w || 1)), 1) };
  }
  return {
    width: Math.max(finiteOr(item.width, finiteOr(item.w, Array.isArray(item.size) ? item.size[0] : 40)), 1),
    height: Math.max(finiteOr(item.height, finiteOr(item.h, Array.isArray(item.size) ? item.size[1] : 40)), 1),
    depth: Math.max(finiteOr(item.depth, finiteOr(item.d, Array.isArray(item.size) ? item.size[2] : 24)), 1),
  };
}

function placeHorizontalStackMember({ item, role, x, baselineY, z, stackRole, mode, axis, activeRay, memberCollision, skinPolicy, supportRole, collisionPolicy, floaterPolicy, floater, rayContactPolicy, arrangementProfile, basis, slot, index, count }) {
  const kind = item.kind || 'solid';
  const size = horizontalStackMemberSize(item);
  const normalizedFloater = floater ?? mandalaArrangementMemberFloater(item);
  const normalizedRayContactPolicy = rayContactPolicy || mandalaArrangementCollisionPolicy({ mode, memberCollision, collisionPolicy, floater: normalizedFloater });
  const normalizedFloaterPolicy = normalizeMandalaFloaterPolicy(item.floaterPolicy || floaterPolicy);
  const serializedBasis = basis ? {
    kind: basis.kind,
    localSpace: basis.localSpace,
    origin: basis.origin,
    xAxis: basis.xAxis.map(round),
    supportAxis: basis.supportAxis.map(round),
    depthAxis: basis.depthAxis?.map(round),
    rays: basis.rays ? Object.fromEntries(Object.entries(basis.rays)
      .filter(([, value]) => validPoint(value))
      .map(([key, value]) => [key, value.map(round)])) : undefined,
  } : undefined;
  const common = {
    constructionKind: 'horizontalStack',
    constructionRole: stackRole,
    horizontalStackRole: stackRole,
    horizontalStackMode: mode,
    horizontalStackAxis: axis,
    horizontalStackActiveRay: activeRay,
    horizontalStackMemberRole: role,
    horizontalStackMemberIndex: index,
    horizontalStackMemberCount: count,
    horizontalStackMemberCollision: memberCollision,
    horizontalStackSkinPolicy: skinPolicy,
    horizontalStackSupportRole: supportRole,
    mandalaArrangementRole: stackRole,
    mandalaArrangementProfile: arrangementProfile || 'horizontal-stack',
    mandalaArrangementBasisKind: basis?.kind,
    mandalaArrangementLocalSpace: basis?.localSpace,
    mandalaArrangementBasis: serializedBasis,
    mandalaArrangementSlot: slot,
    mandalaArrangementActiveRay: activeRay,
    mandalaArrangementRayVector: slot.rayVector,
    mandalaRayInterval: slot.interval,
    mandalaRayIntervalBefore: slot.intervalBefore,
    mandalaRayDisplacement: slot.displacement,
    mandalaRayResolved: Boolean(slot.resolved),
    mandalaRayContactPolicy: normalizedRayContactPolicy,
    mandalaRayCollisionPolicy: normalizedRayContactPolicy,
    mandalaFloater: normalizedFloater,
    mandalaFloaterPolicy: normalizedFloaterPolicy,
  };
  if (kind === 'sphere') {
    const r = Math.max(finiteOr(item.r, finiteOr(item.radius, size.width / 2)), 1);
    return {
      ...item,
      ...common,
      kind,
      role,
      anchor: [roundPoint(x + size.width / 2), roundPoint(baselineY - r)],
      r,
      z,
    };
  }
  if (kind === 'oval' || kind === 'egg' || kind === 'blob') {
    const rx = Math.max(finiteOr(item.rx, size.width / 2), 1);
    const ry = Math.max(finiteOr(item.ry, size.height / 2), 1);
    return {
      ...item,
      ...common,
      kind,
      role,
      anchor: [roundPoint(x + rx), roundPoint(baselineY - ry)],
      rx,
      ry,
      z,
    };
  }
  if (kind === 'polygon' && Array.isArray(item.points)) {
    const points = item.points.filter(validPoint);
    const bounds = bbox(points);
    const dx = x - finiteOr(bounds?.minX, 0);
    const dy = baselineY - finiteOr(bounds?.maxY, 0);
    return {
      ...item,
      ...common,
      kind,
      role,
      points: points.map((point) => [roundPoint(point[0] + dx), roundPoint(point[1] + dy)]),
      z,
    };
  }
  return {
    ...item,
    ...common,
    kind: 'solid',
    role,
    x: roundPoint(x),
    y: roundPoint(baselineY - size.height),
    width: size.width,
    height: size.height,
    depth: Math.max(finiteOr(item.depth, finiteOr(item.d, 24)), 1),
    faceCull: item.faceCull || item.cullFace || item.solidFaceCull || (mode === 'gravity' ? 'hide-back-bottom' : undefined),
    z,
  };
}

function horizontalStackMemberBounds(mark, fallbackSize) {
  if (mark.kind === 'solid') {
    return {
      minX: finiteOr(mark.x, 0),
      minY: finiteOr(mark.y, 0),
      maxX: finiteOr(mark.x, 0) + finiteOr(mark.width, fallbackSize.width),
      maxY: finiteOr(mark.y, 0) + finiteOr(mark.height, fallbackSize.height),
    };
  }
  const anchor = validPoint(mark.anchor) || [finiteOr(mark.cx, 0), finiteOr(mark.cy, 0)];
  if (['sphere', 'oval', 'egg', 'blob'].includes(mark.kind)) {
    const rx = finiteOr(mark.r, finiteOr(mark.rx, fallbackSize.width / 2));
    const ry = finiteOr(mark.r, finiteOr(mark.ry, fallbackSize.height / 2));
    return { minX: anchor[0] - rx, minY: anchor[1] - ry, maxX: anchor[0] + rx, maxY: anchor[1] + ry };
  }
  if (Array.isArray(mark.points)) {
    const bounds = bbox(mark.points.filter(validPoint));
    return {
      minX: finiteOr(bounds?.minX, 0),
      minY: finiteOr(bounds?.minY, 0),
      maxX: finiteOr(bounds?.maxX, 0),
      maxY: finiteOr(bounds?.maxY, 0),
    };
  }
  return {
    minX: 0,
    minY: 0,
    maxX: fallbackSize.width,
    maxY: fallbackSize.height,
  };
}

function horizontalStackJoinedSkinMark({ role, footprints, mark, mode, axis, activeRay, memberCollision, skinPolicy, basis, profile }) {
  const minX = Math.min(...footprints.map((box) => box.minX));
  const minY = Math.min(...footprints.map((box) => box.minY));
  const maxX = Math.max(...footprints.map((box) => box.maxX));
  const maxY = Math.max(...footprints.map((box) => box.maxY));
  const waistY = lerp(minY, maxY, 0.52);
  return {
    kind: 'polygon',
    role: `${role}:joined-skin`,
    points: [
      [roundPoint(minX), roundPoint(waistY)],
      [roundPoint(lerp(minX, maxX, 0.18)), roundPoint(minY)],
      [roundPoint(lerp(minX, maxX, 0.82)), roundPoint(minY)],
      [roundPoint(maxX), roundPoint(waistY)],
      [roundPoint(lerp(minX, maxX, 0.82)), roundPoint(maxY)],
      [roundPoint(lerp(minX, maxX, 0.18)), roundPoint(maxY)],
    ],
    fill: mark.joinedFill || mark.fill || '#8d7a5b',
    stroke: mark.joinedStroke || mark.stroke || '#3f3326',
    strokeWidth: finiteOr(mark.joinedStrokeWidth, finiteOr(mark.strokeWidth, 1)),
    opacity: mark.joinedOpacity ?? 0.42,
    z: finiteOr(mark.joinedZ, finiteOr(mark.z, 18) + 0.5),
    constructionKind: 'horizontalStack',
    constructionRole: role,
    horizontalStackRole: role,
    horizontalStackMode: mode,
    horizontalStackAxis: axis,
    horizontalStackActiveRay: activeRay,
    horizontalStackMemberCollision: memberCollision,
    horizontalStackSkinPolicy: skinPolicy,
    horizontalStackJoinedSkin: true,
    mandalaArrangementRole: role,
    mandalaArrangementProfile: profile || 'horizontal-stack',
    mandalaArrangementBasisKind: basis?.kind,
    mandalaArrangementLocalSpace: basis?.localSpace,
    mandalaArrangementBasis: basis ? {
      kind: basis.kind,
      localSpace: basis.localSpace,
      origin: basis.origin,
      xAxis: basis.xAxis.map(round),
      supportAxis: basis.supportAxis.map(round),
      depthAxis: basis.depthAxis?.map(round),
      rays: basis.rays ? Object.fromEntries(Object.entries(basis.rays)
        .filter(([, value]) => validPoint(value))
        .map(([key, value]) => [key, value.map(round)])) : undefined,
    } : undefined,
    mandalaArrangementActiveRay: activeRay,
    mandalaArrangementRayVector: mandalaArrangementRayVector(basis, activeRay).map(round),
    skinMapJoin: true,
    compoundSkin: true,
    sourceShape: 'horizontal-stack-joined-skin',
  };
}

function expandVisionPaneMark(mark, manifest = {}) {
  const role = mark.role || 'vision-pane';
  const nearLeft = validPoint(mark.nearEdge?.left || mark.nearLeft || mark.fromLeft);
  const nearRight = validPoint(mark.nearEdge?.right || mark.nearRight || mark.fromRight);
  if (!nearLeft || !nearRight) {
    throw new Error(`visionPane '${role}' requires nearEdge.left and nearEdge.right points`);
  }
  const vanishingPoint = validPoint(mark.vanishingPoint) ||
    validPoint(manifest?.scene?.perspective?.vanishingPoint) ||
    validPoint(manifest?.polygonizer?.draftingTable?.vanishingPoint);
  const hasFarBoundary = hasVisionPaneFarBoundary(mark);
  if (!vanishingPoint && !hasFarBoundary) {
    throw new Error(`visionPane '${role}' requires vanishingPoint, farEdge, or horizonBoundary`);
  }

  const farT = clamp(finiteOr(mark.farT, hasFarBoundary ? 1 : 0.94), 0.05, hasFarBoundary ? 1 : 0.995);
  const features = mark.features && typeof mark.features === 'object' && !Array.isArray(mark.features) ? mark.features : {};
  const z = finiteOr(mark.z, 4);
  const boundary = resolveVisionPaneFarBoundary(mark, manifest, nearLeft, nearRight, vanishingPoint, farT);
  const leftFar = boundary.left;
  const rightFar = boundary.right;
  const nearMid = midpoint(nearLeft, nearRight);
  const farMid = midpoint(leftFar, rightFar);
  const mode = mark.mode || 'road';
  const profile = visionPaneModeProfile(mode);
  const basePane = {
      kind: 'polygon',
      role,
      points: [
        roundPointTuple(nearLeft),
        roundPointTuple(nearRight),
        roundPointTuple(rightFar),
        roundPointTuple(leftFar),
      ],
      fill: mark.fill || '#4c5151',
      stroke: mark.stroke || '#232a2a',
      strokeWidth: finiteOr(mark.strokeWidth, 1),
      opacity: mark.opacity,
      z,
      constructionKind: 'visionPane',
      constructionRole: role,
      visionPaneMode: mode,
      visionPaneVisualFamily: profile.visualFamily,
      visionPaneProjectionMode: boundary.mode,
      visionPaneVanishingPoint: vanishingPoint ? roundPointTuple(vanishingPoint) : undefined,
      visionPaneFarEdge: { left: roundPointTuple(leftFar), right: roundPointTuple(rightFar) },
      visionPaneFarT: round(farT),
  };
  const surfaceVisible = mark.surfaceVisible ?? mark.baseVisible ?? features.surfaceVisible ?? features.baseVisible ?? profile.surfaceVisible;
  const out = surfaceVisible ? [basePane] : [];

  if ((features.curbs ?? profile.curbs) === true) {
    const curbStroke = features.curbStroke || mark.curbStroke || '#ded3bd';
    out.push(
      visionPaneLine({
        role: `${role}:left-curb`,
        from: nearLeft,
        to: leftFar,
        stroke: curbStroke,
        strokeWidth: finiteOr(features.curbWidth, 3),
        z: z + 0.1,
        mark,
        t: farT,
      }),
      visionPaneLine({
        role: `${role}:right-curb`,
        from: nearRight,
        to: rightFar,
        stroke: curbStroke,
        strokeWidth: finiteOr(features.curbWidth, 3),
        z: z + 0.11,
        mark,
        t: farT,
      }),
    );
  }

  if ((features.centerline ?? profile.centerline) === true) {
    out.push(visionPaneLine({
      role: `${role}:centerline`,
      from: nearMid,
      to: farMid,
      stroke: features.centerlineStroke || mark.centerlineStroke || '#e9dec2',
      strokeWidth: finiteOr(features.centerlineWidth, 2),
      z: z + 0.12,
      dash: features.centerlineDash || '14 14',
      mark,
      t: farT,
    }));
  }

  const depthRows = Math.max(0, Math.min(24, Math.round(finiteOr(features.depthRows, finiteOr(mark.depthRows, 0)))));
  for (let i = 1; i <= depthRows; i++) {
    const t = (i / (depthRows + 1)) * farT;
    out.push(visionPaneRow({
      role: `${role}:depth-row-${i}`,
      nearLeft,
      nearRight,
      farLeft: leftFar,
      farRight: rightFar,
      t,
      interpolationT: boundary.mode === 'vanishing-point' ? t / farT : t,
      stroke: features.depthRowStroke || mark.depthRowStroke || '#e8d49a',
      strokeWidth: finiteOr(features.depthRowWidth, 1),
      opacity: features.depthRowOpacity ?? 0.3,
      z: z + 0.2 + i * 0.001,
      dash: features.depthRowDash || '5 5',
      mark,
    }));
  }

  const crosswalk = features.crosswalk && typeof features.crosswalk === 'object' && !Array.isArray(features.crosswalk)
    ? features.crosswalk
    : features.crosswalk ? {} : null;
  if (crosswalk && profile.crosswalks !== false) {
    const rows = Math.max(1, Math.min(20, Math.round(finiteOr(crosswalk.rows, 5))));
    const at = clamp(finiteOr(crosswalk.at, 0.28), 0.02, farT);
    const span = Math.max(finiteOr(crosswalk.span, 0.16), 0.001);
    const start = clamp(at - span / 2, 0.02, farT);
    const end = clamp(at + span / 2, start, farT);
    for (let i = 0; i < rows; i++) {
      const t = rows === 1 ? (start + end) / 2 : lerp(start, end, i / (rows - 1));
      out.push(visionPaneRow({
        role: `${role}:crosswalk-${i + 1}`,
        nearLeft,
        nearRight,
        farLeft: leftFar,
        farRight: rightFar,
        t,
        interpolationT: boundary.mode === 'vanishing-point' ? t / farT : t,
        stroke: crosswalk.stroke || '#f2efe3',
        strokeWidth: finiteOr(crosswalk.strokeWidth, Math.max(2, 9 * (1 - t * 0.45))),
        opacity: crosswalk.opacity ?? 0.9,
        z: z + 0.35 + i * 0.001,
        mark,
        crosswalk: true,
      }));
    }
  }

  if (mark.debug) {
    out.push({
      kind: 'text',
      role: `${role}:debug-label`,
      x: nearMid[0],
      y: nearMid[1] + 18,
      value: mark.label || `${role} visionPane`,
      size: 11,
      color: mark.debugColor || '#e8d49a',
      z: z + 0.5,
      constructionKind: 'visionPane',
      constructionRole: role,
      visionPaneDebug: true,
    });
  }

  return out;
}

function visionPaneModeProfile(mode) {
  const normalized = String(mode || 'road').toLowerCase();
  if (normalized.includes('road') || normalized.includes('street') || normalized.includes('lane') || normalized.includes('vehicle')) {
    return { visualFamily: 'road-pane', surfaceVisible: true, curbs: true, centerline: false, crosswalks: true };
  }
  if (normalized.includes('terrain') || normalized.includes('landscape')) {
    return { visualFamily: 'terrain-pane', surfaceVisible: false, curbs: false, centerline: false, crosswalks: false };
  }
  if (normalized.includes('hall') || normalized.includes('room') || normalized.includes('floor') || normalized.includes('plaza')) {
    return { visualFamily: 'floor-pane', surfaceVisible: true, curbs: false, centerline: false, crosswalks: false };
  }
  return { visualFamily: 'generic-depth-pane', surfaceVisible: false, curbs: false, centerline: false, crosswalks: false };
}

function hasVisionPaneFarBoundary(mark) {
  return Boolean(
    validPoint(mark.farEdge?.left || mark.farLeft) &&
      validPoint(mark.farEdge?.right || mark.farRight),
  ) || Boolean(mark.horizonBoundary && typeof mark.horizonBoundary === 'object' && !Array.isArray(mark.horizonBoundary));
}

function resolveVisionPaneFarBoundary(mark, manifest, nearLeft, nearRight, vanishingPoint, farT) {
  const explicitLeft = validPoint(mark.farEdge?.left || mark.farLeft);
  const explicitRight = validPoint(mark.farEdge?.right || mark.farRight);
  if (explicitLeft && explicitRight) {
    return { mode: 'far-edge', left: explicitLeft, right: explicitRight };
  }

  const horizon = mark.horizonBoundary && typeof mark.horizonBoundary === 'object' && !Array.isArray(mark.horizonBoundary)
    ? mark.horizonBoundary
    : null;
  if (horizon) {
    const y = finiteOr(horizon.y, finiteOr(mark.horizonY, finiteOr(manifest?.scene?.perspective?.horizonY, vanishingPoint?.[1])));
    if (Number.isFinite(y)) {
      const centerX = finiteOr(horizon.centerX, finiteOr(vanishingPoint?.[0], midpoint(nearLeft, nearRight)[0]));
      const nearWidth = Math.abs(nearRight[0] - nearLeft[0]);
      const width = Math.max(finiteOr(horizon.width, nearWidth * 0.18), 1);
      const leftX = finiteOr(horizon.leftX, centerX - width / 2);
      const rightX = finiteOr(horizon.rightX, centerX + width / 2);
      return {
        mode: 'horizon-boundary',
        left: [leftX, y],
        right: [rightX, y],
      };
    }
  }

  return {
    mode: 'vanishing-point',
    left: visionPanePointAt(nearLeft, vanishingPoint, farT),
    right: visionPanePointAt(nearRight, vanishingPoint, farT),
  };
}

function visionPanePointAt(near, far, t) {
  return lerpPoint(near, far, clamp(t, 0, 1));
}

function visionPaneRow({ role, nearLeft, nearRight, farLeft, farRight, t, interpolationT = t, stroke, strokeWidth, opacity, z, dash, mark, crosswalk = false }) {
  return visionPaneLine({
    role,
    from: visionPanePointAt(nearLeft, farLeft, interpolationT),
    to: visionPanePointAt(nearRight, farRight, interpolationT),
    stroke,
    strokeWidth,
    opacity,
    z,
    dash,
    mark,
    t,
    crosswalk,
  });
}

function visionPaneLine({ role, from, to, stroke, strokeWidth, opacity, z, dash, mark, t, crosswalk = false }) {
  const mode = mark.mode || 'road';
  const profile = visionPaneModeProfile(mode);
  return {
    kind: 'line',
    role,
    x1: roundPoint(from[0]),
    y1: roundPoint(from[1]),
    x2: roundPoint(to[0]),
    y2: roundPoint(to[1]),
    stroke,
    strokeWidth,
    opacity,
    z,
    dash,
    constructionKind: 'visionPane',
    constructionRole: mark.role || 'vision-pane',
    visionPaneMode: mode,
    visionPaneVisualFamily: profile.visualFamily,
    visionPaneT: round(t),
    visionPaneFeature: crosswalk ? 'crosswalk' : role.split(':').pop(),
  };
}

function expandSwirlFieldMark(mark, manifest = {}) {
  const constructionKind = mark.kind === 'fluidField' ? 'fluidField' : 'swirlField';
  const medium = mark.medium || mark.style || mark.fluid || (constructionKind === 'swirlField' ? 'smoke' : 'free-space-swirl');
  const role = mark.role || `${medium}-field`;
  const viewBox = mark.viewBox && typeof mark.viewBox === 'object'
    ? mark.viewBox
    : manifest.viewBox && typeof manifest.viewBox === 'object' ? manifest.viewBox : {};
  const basis = mark.basis && typeof mark.basis === 'object' && !Array.isArray(mark.basis) ? mark.basis : {};
  const population = mark.population && typeof mark.population === 'object' && !Array.isArray(mark.population)
    ? mark.population
    : {};
  const glyph = mark.glyph && typeof mark.glyph === 'object' && !Array.isArray(mark.glyph) ? mark.glyph : {};
  const count = Math.max(1, Math.min(160, Math.round(finiteOr(population.count ?? mark.count, 18))));
  const seedText = String(population.seed || mark.seed || role);
  const flow = normalize3(validVector3(basis.flow) || [0.18, -1, 0.32]);
  const lift = normalize3(validVector3(basis.lift) || [0, 0, 1]);
  const fallbackCross = normalize3([
    flow[1] * lift[2] - flow[2] * lift[1],
    flow[2] * lift[0] - flow[0] * lift[2],
    flow[0] * lift[1] - flow[1] * lift[0],
  ]);
  const cross = normalize3(validVector3(basis.cross) || fallbackCross);
  const origin = validVector3(basis.origin || mark.origin) || [0, 0, 0];
  const fieldLength = finiteOr(basis.length ?? population.length ?? mark.length, 8);
  const fieldSpread = finiteOr(basis.spread ?? population.spread ?? mark.spread, 2.6);
  const liftAmount = finiteOr(basis.liftAmount ?? population.liftAmount ?? mark.liftAmount, 3.4);
  const camera = {
    screenOrigin: validPoint(basis.screenOrigin || mark.screenOrigin) || [
      finiteOr(viewBox.width, 800) / 2,
      finiteOr(viewBox.height, 520) * 0.72,
    ],
    east: validPoint(basis.east || mark.east) || [1, 0],
    north: validPoint(basis.north || mark.north) || [0.5, -0.72],
    zenith: validPoint(basis.zenith || mark.zenith) || [0, -1],
    unitScale: finiteOr(basis.unitScale ?? mark.unitScale, 28),
    depthScale: clamp(finiteOr(basis.depthScale ?? mark.depthScale, 0.9), 0.2, 1),
  };
  const perspectiveSizing = resolveFluidPerspectiveSizing(mark, basis, population);
  const out = [];
  const flameSources = isFireFluidGlyph(medium, glyph) ? normalizeFlameSources(mark, origin) : [];
  const instances = flameSources.length
    ? flameSources.flatMap((source, sourceIndex) => {
      const lickCount = flameSourceLickCount(source, seedText, sourceIndex);
      return Array.from({ length: lickCount }, (_, lickIndex) => ({
        index: 0,
        count: 0,
        source,
        sourceIndex,
        lickIndex,
        lickCount,
      }));
    }).map((instance, index, all) => ({ ...instance, index, count: all.length }))
    : Array.from({ length: count }, (_, index) => ({ index, count, source: null, sourceIndex: null, lickIndex: null, lickCount: null }));
  for (const instance of instances) {
    const { index, source, sourceIndex, lickIndex, lickCount } = instance;
    const t = instance.count === 1 ? 0.5 : index / (instance.count - 1);
    const localSeed = hashString(source ? `${seedText}:source:${sourceIndex}:lick:${lickIndex}` : `${seedText}:${index}`);
    const sourceSpread = finiteOr(source?.spread, fieldSpread);
    const lateral = (seededUnit(localSeed, 1) - 0.5) * sourceSpread * (1 - t * 0.22);
    const along = source
      ? (seededUnit(localSeed, 2) - 0.5) * finiteOr(source.alongJitter, 0.22)
      : (t - 0.08 + (seededUnit(localSeed, 2) - 0.5) * 0.16) * fieldLength;
    const liftOffset = source
      ? (seededUnit(localSeed, 3) - 0.5) * finiteOr(source.liftJitter, 0.18)
      : (t * liftAmount) + (seededUnit(localSeed, 3) - 0.5) * liftAmount * 0.28;
    const sourceOrigin = source?.origin || origin;
    const sourceRadius = finiteOr(source?.radius, 0);
    const opposedRadius = source?.radiusMode !== 'random' && sourceRadius > 0 && lickCount > 1;
    const sourceAngle = opposedRadius
      ? seededUnit(hashString(`${seedText}:source:${sourceIndex}:radius-phase`), 41) * Math.PI * 2 +
        (lickIndex / lickCount) * Math.PI * 2 +
        (seededUnit(localSeed, 41) - 0.5) * Math.PI * 0.28 * finiteOr(source?.radiusJitter, 0.16)
      : seededUnit(localSeed, 41) * Math.PI * 2;
    const sourceR = sourceRadius * (opposedRadius
      ? lerp(0.72, 1, seededUnit(localSeed, 42))
      : Math.sqrt(seededUnit(localSeed, 42)));
    const sourceOffset = add3(scale3(cross, Math.cos(sourceAngle) * sourceR), scale3(flow, Math.sin(sourceAngle) * sourceR * 0.32));
    const center = add3(sourceOrigin, add3(sourceOffset, add3(scale3(flow, along), add3(scale3(cross, lateral), scale3(lift, liftOffset)))));
    const scaleRange = numericRange(population.scale || mark.scale, 0.55, 1.25);
    const opacityRange = numericRange(population.opacity || mark.opacityRange, 0.14, 0.48);
    const perspectiveScale = fluidPerspectiveScaleAt(camera, center, perspectiveSizing);
    const baseScale = lerp(scaleRange[0], scaleRange[1], seededUnit(localSeed, 4));
    const scaleT = baseScale * perspectiveScale;
    const opacityDepth = lerp(1, perspectiveScale, perspectiveSizing.opacityCoupling);
    const opacity = round(clamp(lerp(opacityRange[0], opacityRange[1], seededUnit(localSeed, 5)) * opacityDepth, 0.02, 1));
    out.push(...swirlGlyphMarks({
      mark,
      role,
      constructionKind,
      medium,
      index,
      count,
      seedText,
      localSeed,
      center,
      flow,
      cross,
      lift,
      camera,
      scale: scaleT,
      baseScale,
      perspectiveScale,
      opacity,
      handedness: resolveSwirlHandedness(population.handedness || glyph.handedness || mark.handedness, index, localSeed),
      glyph,
      t,
      flameSource: source,
      flameSourceIndex: sourceIndex,
      flameLickIndex: lickIndex,
      flameLickCount: lickCount,
    }));
  }
  return out;
}

function normalizeFlameSources(mark, fallbackOrigin) {
  const raw = [
    ...normalizeArray(mark.flameSources),
    ...normalizeArray(mark.flameSource),
    ...normalizeArray(mark.sources),
  ];
  return raw
    .map((source, index) => normalizeFlameSource(source, index, fallbackOrigin))
    .filter(Boolean);
}

function normalizeFlameSource(source, index, fallbackOrigin) {
  if (!source) return null;
  const raw = typeof source === 'string' ? { role: source } : source;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return {
    ...raw,
    role: raw.role || raw.sourceRole || `flame-source-${index + 1}`,
    origin: validVector3(raw.origin || raw.center || raw.point) || fallbackOrigin,
    lickCount: raw.lickCount ?? raw.count ?? [2, 4],
    spread: finiteOr(raw.spread, 0.42),
    radius: Math.max(finiteOr(raw.radius ?? raw.sourceRadius ?? raw.r, 0), 0),
    radiusMode: raw.radiusMode || raw.radialMode || raw.sourceRadiusMode || 'seeded-opposed',
    radiusJitter: clamp(finiteOr(raw.radiusJitter ?? raw.radialJitter, 0.16), 0, 1),
    coverageScale: Math.max(finiteOr(raw.coverageScale ?? raw.combustionCoverageScale, 2.15), 0),
  };
}

function flameSourceLickCount(source, seedText, sourceIndex) {
  const range = numericRange(source.lickCount, 2, 4);
  const min = Math.max(1, Math.min(24, Math.round(Math.min(range[0], range[1]))));
  const max = Math.max(min, Math.min(24, Math.round(Math.max(range[0], range[1]))));
  if (min === max) return min;
  return min + Math.floor(seededUnit(hashString(`${seedText}:flame-source:${sourceIndex}`), 1) * (max - min + 1));
}

function resolveFluidPerspectiveSizing(mark, basis = {}, population = {}) {
  const raw = mark.perspectiveSizing || basis.perspectiveSizing || population.perspectiveSizing;
  const config = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const enabled = raw === false || mark.perspectiveSizing === false || basis.perspectiveSizing === false
    ? false
    : config.enabled !== false;
  return {
    enabled,
    mode: config.mode || 'camera-depth',
    minScale: clamp(finiteOr(config.minScale, 0.42), 0.05, 2),
    maxScale: clamp(finiteOr(config.maxScale, 1.08), 0.05, 3),
    opacityCoupling: clamp(finiteOr(config.opacityCoupling, 0.45), 0, 1),
  };
}

function fluidPerspectiveScaleAt(camera, center, perspectiveSizing) {
  if (!perspectiveSizing?.enabled) return 1;
  const scale = mandalaPerspectiveScale(camera, center);
  return clamp(scale, perspectiveSizing.minScale, perspectiveSizing.maxScale);
}

function isRBrush2DInkMode(mark, matter, envelope, phase) {
  const mode = matter.mode || mark.mode;
  const profile = envelope.profile || matter.profile || mark.profile;
  return mode === '2d' ||
    phase === 'ink' ||
    phase === 'ink-pen' ||
    profile === 'ink-pen' ||
    profile === 'lateral-stroke' ||
    profile === 'brush-pen' ||
    profile === 'dry-brush' ||
    profile === 'marker' ||
    profile === 'calligraphy';
}

function expandRBrush2DInkMark(mark, matter = {}, envelope = {}, manifest = {}) {
  const role = mark.role || 'rbrush-ink-stroke';
  const viewBox = manifest.viewBox && typeof manifest.viewBox === 'object' ? manifest.viewBox : {};
  const seedText = String(mark.seed || matter.seed || role);
  const seed = hashString(`${seedText}:rbrush:ink-2d`);
  const points = rBrush2DStrokePoints(mark, matter, viewBox);
  if (points.length < 2) return [];
  const print = mark.print && typeof mark.print === 'object' && !Array.isArray(mark.print)
    ? mark.print
    : matter.print && typeof matter.print === 'object' && !Array.isArray(matter.print) ? matter.print : {};
  const profile = envelope.profile || matter.profile || mark.profile || 'ink-pen';
  const profileConfig = rBrush2DProfileConfig(profile);
  const width = Math.max(finiteOr(envelope.width ?? matter.width ?? mark.width ?? mark.strokeWidth, profileConfig.width), 0.4);
  const samples = Math.max(6, Math.min(96, Math.round(finiteOr(envelope.points, profileConfig.points))));
  const noise = clamp(finiteOr(envelope.noise ?? matter.noise ?? mark.noise, profileConfig.noise), 0, 1.5);
  const taper = clamp(finiteOr(envelope.taper ?? matter.taper ?? mark.taper, profileConfig.taper), 0, 1);
  const pressure = normalizeRange(envelope.pressure ?? matter.pressure ?? mark.pressure, profileConfig.pressure[0], profileConfig.pressure[1]);
  const color = mark.color && typeof mark.color === 'object' && !Array.isArray(mark.color) ? mark.color : {};
  const ink = color.ink || color.body || mark.fill || mark.stroke || profileConfig.ink;
  const common = {
    constructionKind: 'rBrush',
    constructionRole: role,
    sourceShape: 'rBrush',
    rBrushMatter: true,
    rBrushRole: role,
    rBrushPhase: 'ink',
    rBrushMode: '2d',
    rBrushSeed: seedText,
    rBrushEnvelopeProfile: profile,
    rBrushStrokeWidth: round(width),
    rBrushBrushProfile: profile,
    vectorMatter: true,
  };
  if (print.mode === 'stamp' || print.mergeMode === 'stamp' || print.stamp === true) {
    return rBrush2DStampMarks({ mark, matter, print, common, points, ink, width, seed, z: finiteOr(mark.z, 12) });
  }
  const outline = rBrush2DStrokeEnvelope({
    points,
    width,
    samples,
    noise,
    taper,
    pressure,
    seed,
    chiselAngle: finiteOr(envelope.chiselAngle ?? matter.chiselAngle, profileConfig.chiselAngle),
    chiselStrength: finiteOr(envelope.chiselStrength ?? matter.chiselStrength, profileConfig.chiselStrength),
  });
  const mergedTrace = rBrush2DPrintTrace({ print, outline, points, width, seed });
  const z = finiteOr(mark.z, 12);
  return [
    {
      ...common,
      kind: 'polygon',
      role: `${role}:${mergedTrace ? 'merged-trace' : 'ink-body'}`,
      points: mergedTrace?.points || outline.points,
      fill: ink,
      stroke: 'none',
      opacity: round(clamp(finiteOr(mark.opacity ?? matter.opacity, profileConfig.opacity), 0.02, 1)),
      blur: finiteOr(envelope.blur, profileConfig.blur),
      z,
      rBrushInkBody: true,
      rBrushPrintTrace: Boolean(mergedTrace),
      rBrushMergeMode: mergedTrace?.mergeMode,
      rBrushTemporaryDabCount: mergedTrace?.temporaryDabCount,
      rBrushTracePolicy: mergedTrace?.tracePolicy,
    },
    ...rBrush2DInkLoadMarks({ mark, matter, common, points, ink, width, z, seed, profileConfig }),
  ];
}

function rBrush2DStrokePoints(mark, matter = {}, viewBox = {}) {
  const raw = mark.points || matter.points || mark.path || matter.path;
  const points = Array.isArray(raw) ? raw.filter(validPoint) : [];
  if (points.length >= 2) return points.map((point) => point.map(Number));
  const from = validPoint(mark.from || matter.from) || [
    finiteOr(viewBox.width, 520) * 0.22,
    finiteOr(viewBox.height, 320) * 0.58,
  ];
  const to = validPoint(mark.to || matter.to) || [
    finiteOr(viewBox.width, 520) * 0.78,
    finiteOr(viewBox.height, 320) * 0.42,
  ];
  return [from, to];
}

function rBrush2DProfileConfig(profile) {
  const configs = {
    'ink-pen': {
      width: 9,
      points: 28,
      noise: 0.16,
      taper: 0.35,
      pressure: [0.86, 1.08],
      opacity: 0.92,
      blur: 0.18,
      ink: '#19140f',
      loadCount: 5,
      loadJitter: 0.18,
      loadAlignment: 0.9,
      loadOpacity: 0.22,
      loadStrokeScale: 0.11,
      chiselAngle: 0,
      chiselStrength: 0,
    },
    'brush-pen': {
      width: 16,
      points: 38,
      noise: 0.28,
      taper: 0.55,
      pressure: [0.72, 1.28],
      opacity: 0.88,
      blur: 0.28,
      ink: '#1c130f',
      loadCount: 10,
      loadJitter: 0.28,
      loadAlignment: 0.84,
      loadOpacity: 0.26,
      loadStrokeScale: 0.09,
      chiselAngle: 0,
      chiselStrength: 0,
    },
    'dry-brush': {
      width: 18,
      points: 44,
      noise: 0.72,
      taper: 0.48,
      pressure: [0.46, 1.18],
      opacity: 0.62,
      blur: 0.08,
      ink: '#2a1d15',
      loadCount: 18,
      loadJitter: 0.42,
      loadAlignment: 0.76,
      loadOpacity: 0.36,
      loadStrokeScale: 0.08,
      chiselAngle: 0,
      chiselStrength: 0,
    },
    marker: {
      width: 20,
      points: 30,
      noise: 0.06,
      taper: 0.12,
      pressure: [0.94, 1.04],
      opacity: 0.52,
      blur: 0.22,
      ink: '#314f7a',
      loadCount: 3,
      loadJitter: 0.1,
      loadAlignment: 0.96,
      loadOpacity: 0.12,
      loadStrokeScale: 0.08,
      chiselAngle: 0,
      chiselStrength: 0,
    },
    calligraphy: {
      width: 18,
      points: 36,
      noise: 0.1,
      taper: 0.32,
      pressure: [0.78, 1.12],
      opacity: 0.9,
      blur: 0.1,
      ink: '#211711',
      loadCount: 4,
      loadJitter: 0.12,
      loadAlignment: 0.95,
      loadOpacity: 0.16,
      loadStrokeScale: 0.08,
      chiselAngle: -0.72,
      chiselStrength: 0.55,
    },
  };
  return configs[profile] || configs['ink-pen'];
}

function rBrush2DStrokeEnvelope({ points, width, samples, noise, taper, pressure, seed, chiselAngle = 0, chiselStrength = 0 }) {
  const left = [];
  const right = [];
  const nib = [Math.cos(chiselAngle), Math.sin(chiselAngle)];
  for (let i = 0; i < samples; i++) {
    const u = samples === 1 ? 0.5 : i / (samples - 1);
    const sample = sampleGesture(points, u);
    if (!sample) continue;
    const normal = normalize([-sample.tangent[1], sample.tangent[0]]);
    const endTaper = lerp(1 - taper, 1, Math.sin(u * Math.PI));
    const pressureT = lerp(pressure[0], pressure[1], 0.5 + 0.5 * deterministicWave(seed, 15, u * Math.PI * 2));
    const chiselT = chiselStrength
      ? lerp(1 - chiselStrength * 0.45, 1 + chiselStrength * 0.5, Math.abs(dot(sample.tangent, nib)))
      : 1;
    const edgeNoise = deterministicWave(seed, i + 31, u * Math.PI * 4) * width * noise * 0.18;
    const half = Math.max((width * 0.5 * endTaper * pressureT * chiselT) + edgeNoise, 0.2);
    left.push([roundPoint(sample.point[0] + normal[0] * half), roundPoint(sample.point[1] + normal[1] * half)]);
    right.push([roundPoint(sample.point[0] - normal[0] * half), roundPoint(sample.point[1] - normal[1] * half)]);
  }
  return { points: [...left, ...right.reverse()], left, right };
}

function rBrush2DPrintTrace({ print = {}, outline, points, width, seed }) {
  if (print.mergeMode !== 'trace' && print.mode !== 'trace' && print.trace !== true) return null;
  const budget = print.renderBudget && typeof print.renderBudget === 'object' && !Array.isArray(print.renderBudget)
    ? print.renderBudget
    : {};
  const maxDabs = Math.max(3, Math.min(240, Math.round(finiteOr(print.maxDabs ?? budget.maxDabs, 80))));
  const spacing = Math.max(finiteOr(print.spacing, 0.42), 0.05);
  const dabCount = Math.max(3, Math.min(maxDabs, Math.round(maxDabs * clamp(1 / (spacing * 3), 0.18, 1))));
  const scatter = Math.max(finiteOr(print.scatter, width * 0.18), 0);
  const scaleRange = normalizeRange(print.scale, 0.75, 1.25);
  const coverage = [...(outline?.points || [])];
  for (let i = 0; i < dabCount; i++) {
    const t = dabCount === 1 ? 0.5 : i / (dabCount - 1);
    const sample = sampleGesture(points, t);
    if (!sample) continue;
    const dabSeed = hashString(`${seed}:print-dab:${i}`);
    const normal = normalize([-sample.tangent[1], sample.tangent[0]]);
    const tangent = sample.tangent;
    const lateral = (seededUnit(dabSeed, 1) - 0.5) * scatter * 2;
    const along = (seededUnit(dabSeed, 2) - 0.5) * scatter * 0.65;
    const center = [
      sample.point[0] + normal[0] * lateral + tangent[0] * along,
      sample.point[1] + normal[1] * lateral + tangent[1] * along,
    ];
    const scale = lerp(scaleRange[0], scaleRange[1], seededUnit(dabSeed, 3));
    const radius = Math.max(width * 0.42 * scale, 0.8);
    coverage.push(
      [roundPoint(center[0] + normal[0] * radius), roundPoint(center[1] + normal[1] * radius)],
      [roundPoint(center[0] - normal[0] * radius), roundPoint(center[1] - normal[1] * radius)],
      [roundPoint(center[0] + tangent[0] * radius * 0.72), roundPoint(center[1] + tangent[1] * radius * 0.72)],
      [roundPoint(center[0] - tangent[0] * radius * 0.72), roundPoint(center[1] - tangent[1] * radius * 0.72)],
    );
  }
  const maxTracePoints = Math.max(8, Math.min(240, Math.round(finiteOr(print.maxTracePoints ?? budget.maxTracePoints, 96))));
  const trace = stringClusterEnvelope(coverage, {
    envelope: print.tracePolicy || print.envelope || 'stripHull',
    padding: finiteOr(print.padding, width * 0.35),
    smoothing: finiteOr(print.smoothing, 0.38),
    maxPoints: maxTracePoints,
    bins: finiteOr(print.bins, 18),
  });
  if (trace.length < 3) return null;
  return {
    points: trace,
    mergeMode: 'trace',
    tracePolicy: print.tracePolicy || print.envelope || 'stripHull',
    temporaryDabCount: dabCount,
  };
}

function rBrush2DStampMarks({ mark, matter, print = {}, common, points, ink, width, seed, z }) {
  const die = print.die && typeof print.die === 'object' && !Array.isArray(print.die) ? print.die : {};
  const family = die.family || die.kind || 'doubleDot';
  if (family !== 'doubleDot' && family !== 'double-dot') return [];
  const budget = print.renderBudget && typeof print.renderBudget === 'object' && !Array.isArray(print.renderBudget)
    ? print.renderBudget
    : {};
  const radius = Math.max(finiteOr(die.radius ?? print.radius, Math.max(width * 0.42, 3)), 0.4);
  const gap = Math.max(finiteOr(die.gap ?? print.gap ?? print.gapPx, 2), 0);
  const spacingPx = Math.max(
    finiteOr(print.spacingPx ?? print.spacing, radius * finiteOr(print.frequencyFactor, 0.72)),
    0.75,
  );
  const pathLength = rBrushPathLength(points);
  const maxStamps = Math.max(2, Math.min(640, Math.round(finiteOr(print.maxStamps ?? budget.maxStamps, 180))));
  const stampCount = Math.max(2, Math.min(maxStamps, Math.ceil(pathLength / spacingPx) + 1));
  const strokeId = String(print.strokeId || print.linkId || common.rBrushRole);
  const opacityRange = normalizeRange(print.opacity ?? die.opacity ?? mark.opacity ?? matter.opacity, 0.78, 0.9);
  const jitter = Math.max(finiteOr(print.jitter, 0.24), 0);
  const separation = radius * 2 + gap;
  const laneCoverage = { a: [], b: [] };
  const stampRecords = [];
  for (let i = 0; i < stampCount; i++) {
    const t = stampCount === 1 ? 0.5 : i / (stampCount - 1);
    const sample = sampleGesture(points, t);
    if (!sample) continue;
    const stampSeed = hashString(`${seed}:stamp:${i}`);
    const normal = normalize([-sample.tangent[1], sample.tangent[0]]);
    const alongJitter = (seededUnit(stampSeed, 1) - 0.5) * jitter * radius;
    const normalJitter = (seededUnit(stampSeed, 2) - 0.5) * jitter * radius * 0.42;
    const scale = lerpRange(print.scale ?? die.scale, 0.96, 1.04, seededUnit(stampSeed, 3));
    const r = Math.max(radius * scale, 0.3);
    const opacity = round(clamp(lerp(opacityRange[0], opacityRange[1], seededUnit(stampSeed, 4)), 0.02, 1));
    for (const lane of [-1, 1]) {
      const cx = sample.point[0] +
        normal[0] * lane * separation * 0.5 +
        sample.tangent[0] * alongJitter +
        normal[0] * normalJitter;
      const cy = sample.point[1] +
        normal[1] * lane * separation * 0.5 +
        sample.tangent[1] * alongJitter +
        normal[1] * normalJitter;
      const stamp = {
        ...common,
        kind: 'circle',
        role: `${common.rBrushRole}:stamp-${String(i + 1).padStart(3, '0')}:${lane < 0 ? 'lane-a' : 'lane-b'}`,
        cx: roundPoint(cx),
        cy: roundPoint(cy),
        r: roundPoint(r),
        fill: ink,
        stroke: 'none',
        opacity,
        blur: finiteOr(print.blur ?? die.blur, 0.06),
        z: z + i * 0.0001 + (lane > 0 ? 0.00001 : 0),
        rBrushStampBrush: true,
        rBrushStampDie: 'doubleDot',
        rBrushStampIndex: i,
        rBrushStampCount: stampCount,
        rBrushStampLane: lane < 0 ? 'a' : 'b',
        rBrushStampDotRadius: round(radius),
        rBrushStampGapPx: round(gap),
        rBrushStampSpacingPx: round(spacingPx),
        rBrushStrokeId: strokeId,
        rBrushLinkedStroke: true,
        rBrushLinkage: print.linkage || 'stroke-object',
      };
      stampRecords.push(stamp);
      const coverage = lane < 0 ? laneCoverage.a : laneCoverage.b;
      coverage.push(
        [roundPoint(cx + normal[0] * r), roundPoint(cy + normal[1] * r)],
        [roundPoint(cx - normal[0] * r), roundPoint(cy - normal[1] * r)],
        [roundPoint(cx + sample.tangent[0] * r), roundPoint(cy + sample.tangent[1] * r)],
        [roundPoint(cx - sample.tangent[0] * r), roundPoint(cy - sample.tangent[1] * r)],
      );
    }
  }
  if (
    print.mergeMode === 'component-trace' ||
    print.mergeMode === 'lane-trace' ||
    print.componentTrace === true ||
    print.laneTrace === true
  ) {
    return rBrush2DStampComponentTraceMarks({
      common,
      print,
      laneCoverage,
      ink,
      z,
      stampCount,
      radius,
      gap,
      spacingPx,
      strokeId,
    });
  }
  return stampRecords;
}

function rBrush2DStampComponentTraceMarks({ common, print, laneCoverage, ink, z, stampCount, radius, gap, spacingPx, strokeId }) {
  const budget = print.renderBudget && typeof print.renderBudget === 'object' && !Array.isArray(print.renderBudget)
    ? print.renderBudget
    : {};
  const maxTracePoints = Math.max(8, Math.min(240, Math.round(finiteOr(print.maxTracePoints ?? budget.maxTracePoints, 96))));
  return [
    ['a', laneCoverage.a],
    ['b', laneCoverage.b],
  ].map(([lane, coverage], index) => {
    const trace = stringClusterEnvelope(coverage, {
      envelope: print.tracePolicy || print.envelope || 'stripHull',
      padding: finiteOr(print.padding, radius * 0.28),
      smoothing: finiteOr(print.smoothing, 0.36),
      maxPoints: maxTracePoints,
      bins: finiteOr(print.bins, 24),
    });
    if (trace.length < 3) return null;
    return {
      ...common,
      kind: 'polygon',
      role: `${common.rBrushRole}:component-trace:${lane === 'a' ? 'lane-a' : 'lane-b'}`,
      points: trace,
      fill: ink,
      stroke: 'none',
      opacity: round(clamp(finiteOr(print.opacity, 0.86), 0.02, 1)),
      blur: finiteOr(print.blur, 0.05),
      z: z + index * 0.0001,
      rBrushStampBrush: true,
      rBrushStampDie: 'doubleDot',
      rBrushStampLane: lane,
      rBrushStampCount: stampCount,
      rBrushStampDotRadius: round(radius),
      rBrushStampGapPx: round(gap),
      rBrushStampSpacingPx: round(spacingPx),
      rBrushStrokeId: strokeId,
      rBrushLinkedStroke: true,
      rBrushLinkage: print.linkage || 'stroke-object',
      rBrushComponentTrace: true,
      rBrushMergeMode: 'component-trace',
      rBrushTemporaryStampCount: stampCount,
      rBrushTracePolicy: print.tracePolicy || print.envelope || 'stripHull',
    };
  }).filter(Boolean);
}

function rBrushPathLength(points) {
  let length = 0;
  const clean = Array.isArray(points) ? points.filter(validPoint) : [];
  for (let i = 1; i < clean.length; i++) {
    length += Math.hypot(clean[i][0] - clean[i - 1][0], clean[i][1] - clean[i - 1][1]);
  }
  return length;
}

function rBrush2DInkLoadMarks({ mark, matter, common, points, ink, width, z, seed, profileConfig }) {
  const loads = normalizeArray(mark.load || matter.load).filter((load) => load && typeof load === 'object');
  const sourceLoads = loads.length ? loads : [
    {
      role: 'ink-fiber-lines',
      die: { family: 'noisySpaghetti', stroke: ink, strokeWidth: Math.max(width * profileConfig.loadStrokeScale, 0.45) },
      field: {
        kind: 'insideStroke',
        count: profileConfig.loadCount,
        length: 0.96,
        lateralJitter: width * profileConfig.loadJitter,
        alignment: profileConfig.loadAlignment,
        samples: 18,
        fractalOctaves: 1,
        fractalSplit: 0,
      },
      valueBudget: { targetOpacity: profileConfig.loadOpacity, expectedOverlapCount: Math.max(3, profileConfig.loadCount), mode: 'inverse-count' },
    },
  ];
  const out = [];
  sourceLoads.forEach((load, loadIndex) => {
    const die = load.die && typeof load.die === 'object' && !Array.isArray(load.die) ? load.die : {};
    if ((die.family || load.family || load.kind) !== 'noisySpaghetti') return;
    const field = load.field && typeof load.field === 'object' && !Array.isArray(load.field) ? load.field : {};
    const jitter = Math.min(Math.abs(finiteOr(field.lateralJitter, width * 0.18)), width * 0.45);
    const density = Math.max(1, Math.min(36, Math.round(finiteOr(field.count ?? field.density ?? load.count, 5))));
    const effect = {
      ...load,
      role: load.role || `ink-load-${loadIndex + 1}`,
      die: { ...die, stroke: die.stroke || load.stroke || ink, strokeWidth: die.strokeWidth || load.strokeWidth || Math.max(width * 0.1, 0.5) },
      field: {
        ...field,
        count: density,
        density,
        lateralJitter: [-jitter, jitter],
        alignment: clamp(finiteOr(field.alignment, 0.9), 0.72, 1),
        samples: Math.max(4, Math.min(64, Math.round(finiteOr(field.samples, 18)))),
        fractalSplit: Math.max(0, Math.min(3, Math.round(finiteOr(field.fractalSplit, 0)))),
      },
      valueBudget: load.valueBudget || { targetOpacity: 0.22, expectedOverlapCount: Math.max(2, density), mode: 'inverse-count' },
    };
    const loadCommon = {
      ...common,
      fluidGlyphRole: `${common.rBrushRole}:load-${loadIndex + 1}`,
      swirlGlyphSeed: `${common.rBrushSeed}:rbrush-ink-load:${loadIndex}:${seed}`,
      swirlGlyphScale: 1,
      swirlGlyphOpacity: 1,
    };
    fluidPastamakerNoisySpaghettiMarks({
      effect,
      effectIndex: loadIndex,
      common: loadCommon,
      linePoints: points,
      zBase: z,
      t: 0,
      index: loadIndex,
      vectorFlag: { vectorMatter: true },
      constructionKind: 'rBrush',
    }).forEach((item) => {
      out.push({
        ...item,
        ...common,
        role: `${common.rBrushRole}:${effect.role}:${item.stickerFieldIndex + 1}`,
        rBrushLoadRole: effect.role,
        rBrushLoadIndex: loadIndex,
        rBrushInkString: true,
        vectorMatter: true,
        pastamaker: item.pastamaker,
      });
    });
  });
  return out;
}

function expandRBrushMark(mark, manifest = {}) {
  const role = mark.role || 'rbrush-matter';
  const matter = mark.matter && typeof mark.matter === 'object' && !Array.isArray(mark.matter) ? mark.matter : {};
  const phase = matter.phase || mark.phase || 'fire';
  const envelope = matter.envelope && typeof matter.envelope === 'object' && !Array.isArray(matter.envelope) ? matter.envelope : {};
  if (isRBrush2DInkMode(mark, matter, envelope, phase)) return expandRBrush2DInkMark(mark, matter, envelope, manifest);
  if (phase !== 'fire') return [];
  const basis = matter.basis && typeof matter.basis === 'object' && !Array.isArray(matter.basis) ? matter.basis : {};
  const viewBox = manifest.viewBox && typeof manifest.viewBox === 'object' ? manifest.viewBox : {};
  const seedText = String(mark.seed || matter.seed || role);
  const seed = hashString(`${seedText}:rbrush:${phase}`);
  const origin = validVector3(basis.origin || mark.origin) || [0, 0, 0];
  const flow = normalize3(validVector3(basis.flow) || [0.05, -0.18, 0.04]);
  const lift = normalize3(validVector3(basis.lift) || [0, 0, 1]);
  const fallbackCross = normalize3([
    flow[1] * lift[2] - flow[2] * lift[1],
    flow[2] * lift[0] - flow[0] * lift[2],
    flow[0] * lift[1] - flow[1] * lift[0],
  ]);
  const cross = normalize3(validVector3(basis.cross) || fallbackCross);
  const camera = {
    screenOrigin: validPoint(basis.screenOrigin || mark.screenOrigin) || [
      finiteOr(viewBox.width, 800) / 2,
      finiteOr(viewBox.height, 520) * 0.68,
    ],
    east: validPoint(basis.east || mark.east) || [1, 0],
    north: validPoint(basis.north || mark.north) || [0.42, -0.62],
    zenith: validPoint(basis.zenith || mark.zenith) || [0, -1],
    unitScale: finiteOr(basis.unitScale ?? mark.unitScale, 43),
    depthScale: clamp(finiteOr(basis.depthScale ?? mark.depthScale, 0.82), 0.2, 1),
  };
  const sourceRadius = Math.max(finiteOr(envelope.sourceRadius ?? matter.sourceRadius ?? mark.sourceRadius, 0), 0);
  let height = Math.max(lerpRange(envelope.height, 1.85, 2.15, seededUnit(seed, 1)), 0.1);
  let width = Math.max(lerpRange(envelope.width ?? envelope.radius, 0.55, 0.72, seededUnit(seed, 2)), 0.05);
  const coverageWidth = sourceRadius * finiteOr(envelope.coverageScale ?? matter.coverageScale, 2.15);
  if (coverageWidth > width) {
    const boost = coverageWidth / width;
    width = coverageWidth;
    height *= boost;
  }
  const pointiness = clamp(finiteOr(envelope.pointiness, 0.82), 0, 1.8);
  const wobble = clamp(finiteOr(envelope.wobble, 0.12), 0, 1);
  const points = Math.max(10, Math.min(96, Math.round(finiteOr(envelope.points, 28))));
  const curve = finiteOr(envelope.curve, 0.12) * (seededUnit(seed, 3) > 0.5 ? 1 : -1);
  const swirlAmount = finiteOr(envelope.swirlAmount ?? matter.swirlAmount, 0.28);
  const swirlTurns = finiteOr(envelope.swirlTurns ?? matter.swirlTurns, 1.42);
  const spineWorld = [];
  const linePoints = [];
  for (let i = 0; i < points; i++) {
    const u = points === 1 ? 0.5 : i / (points - 1);
    const taperedU = Math.pow(u, lerp(1, 0.82, pointiness));
    const world = flameGlyphWorldPoint({
      center: origin,
      flow,
      cross,
      lift,
      u: taperedU,
      height,
      curve,
      wobble,
      swirlAmount,
      swirlTurns,
      seed,
    });
    spineWorld.push(world);
    linePoints.push(projectMandalaScreen(camera, [world[0], world[1]], world[2]));
  }
  const widthPx = width * camera.unitScale;
  const outerEnvelope = flameEnvelopeParts(linePoints, widthPx, seed, false);
  const innerEnvelope = flameEnvelopeParts(linePoints, widthPx * 0.58, seed, true);
  const sourcePoint = linePoints[0];
  const head = linePoints[linePoints.length - 1];
  const coreCenter = linePoints[Math.max(0, Math.min(linePoints.length - 1, Math.round((linePoints.length - 1) * 0.28)))];
  const z = finiteOr(mark.z, 12);
  const color = mark.color && typeof mark.color === 'object' && !Array.isArray(mark.color) ? mark.color : {};
  const edge = mark.edge && typeof mark.edge === 'object' && !Array.isArray(mark.edge) ? mark.edge : {};
  const palette = rBrushFirePalette(color);
  const common = {
    constructionKind: 'rBrush',
    constructionRole: role,
    sourceShape: 'rBrush',
    rBrushMatter: true,
    rBrushRole: role,
    rBrushPhase: phase,
    rBrushSeed: seedText,
    rBrushEnvelopeProfile: envelope.profile || 'fat-lick',
    rBrushSourceRadius: round(sourceRadius),
    rBrushEnvelopeWidth: round(width),
    rBrushEnvelopeHeight: round(height),
    rBrushBasisOrigin: origin.map(round),
    vectorMatter: true,
  };
  const marks = [];
  if (edge.atmosphere !== false && edge.atmosphere !== 'none') {
    const glowRadius = Math.max(widthPx * 2.2, 36);
    marks.push({
      ...common,
      kind: 'circle',
      role: `${role}:same-color-outer-glow`,
      cx: roundPoint(coreCenter[0]),
      cy: roundPoint(coreCenter[1]),
      r: roundPoint(glowRadius),
      fill: palette.body,
      stroke: 'none',
      opacity: round(clamp(finiteOr(edge.opacity, 0.12), 0, 0.6)),
      blur: finiteOr(edge.blur, 22),
      z: z - 1,
      fillGradient: rBrushGradient({
        role: 'same-color-outer-glow',
        center: coreCenter,
        from: sourcePoint,
        to: head,
        stops: [
          { offset: 0, color: palette.body, opacity: 0.22 },
          { offset: 0.62, color: palette.body, opacity: 0.08 },
          { offset: 1, color: palette.dark, opacity: 0 },
        ],
        independentLighting: color.independentLighting !== false,
      }),
    });
  }
  marks.push({
    ...common,
    kind: 'polygon',
    role: `${role}:soft-fat-lick-body`,
    points: outerEnvelope.points,
    fill: palette.body,
    stroke: edge.outline === true ? palette.edge : 'none',
    strokeWidth: edge.outline === true ? finiteOr(edge.strokeWidth, 0.8) : 0,
    opacity: round(clamp(finiteOr(mark.opacity ?? matter.opacity, 0.46), 0.02, 1)),
    blur: finiteOr(envelope.blur, 2.4),
    z,
    fillGradient: rBrushGradient({
      role: 'fire-body-gradient',
      center: coreCenter,
      from: sourcePoint,
      to: head,
      stops: [
        { offset: 0, color: palette.white, opacity: 0.72 },
        { offset: 0.32, color: palette.yellow, opacity: 0.52 },
        { offset: 0.68, color: palette.body, opacity: 0.34 },
        { offset: 1, color: palette.red, opacity: 0.1 },
      ],
      independentLighting: color.independentLighting !== false,
    }),
  });
  marks.push({
    ...common,
    kind: 'polygon',
    role: `${role}:yellow-inner-breath`,
    points: innerEnvelope.points,
    fill: palette.yellow,
    stroke: 'none',
    opacity: round(clamp(finiteOr(color.innerOpacity, 0.48), 0.02, 1)),
    blur: finiteOr(color.innerBlur, 2.6),
    z: z + 0.1,
    fillGradient: rBrushGradient({
      role: 'fire-inner-gradient',
      center: coreCenter,
      from: sourcePoint,
      to: head,
      stops: [
        { offset: 0, color: palette.white, opacity: 0.84 },
        { offset: 0.52, color: palette.yellow, opacity: 0.48 },
        { offset: 1, color: palette.body, opacity: 0.08 },
      ],
      independentLighting: color.independentLighting !== false,
    }),
  });
  marks.push(...rBrushHeatRisenMarks({ common, linePoints, widthPx, palette, seed, z }));
  marks.push(...rBrushLoadMarks({ mark, matter, common, linePoints, palette, z, seed }));
  return marks;
}

function rBrushFirePalette(color = {}) {
  const stops = Array.isArray(color.stops) ? color.stops : [];
  const byRole = new Map(stops.map((stop) => [stop?.role, stop?.color]).filter((item) => item[0] && item[1]));
  return {
    white: color.white || byRole.get('source-white') || '#fff8cc',
    yellow: color.yellow || byRole.get('hot-yellow') || '#ffd36a',
    body: color.body || color.orange || byRole.get('body-orange') || '#ff8a1f',
    red: color.red || byRole.get('cool-red') || '#d71920',
    edge: color.edge || '#ff9a24',
    dark: color.dark || '#050508',
  };
}

function rBrushGradient({ role, center, from, to, stops, independentLighting = true }) {
  return {
    kind: 'radial',
    role,
    center,
    from,
    to,
    independentLighting,
    stops: stops.map((stop) => ({
      offset: round(clamp(finiteOr(stop.offset, 0), 0, 1)),
      color: stop.color,
      opacity: round(clamp(finiteOr(stop.opacity, 1), 0, 1)),
    })),
  };
}

function rBrushHeatRisenMarks({ common, linePoints, widthPx, palette, seed, z }) {
  const specs = [
    { role: 'source-pocket', centerT: 0.13, height: 0.26, width: 0.28, opacity: 0.5, blur: 2.2 },
    { role: 'left-thread', centerT: 0.34, height: 0.38, width: 0.18, side: -0.34, opacity: 0.28, blur: 2.4 },
    { role: 'right-thread', centerT: 0.42, height: 0.36, width: 0.2, side: 0.36, opacity: 0.22, blur: 2.8 },
    { role: 'upper-thread', centerT: 0.62, height: 0.42, width: 0.16, side: 0.08, opacity: 0.18, blur: 3.1 },
  ];
  return specs.map((spec, index) => {
    const polygon = rBrushThreadPolygon(linePoints, widthPx, spec, hashString(`${seed}:heat:${index}`));
    return {
      ...common,
      kind: 'polygon',
      role: `${common.rBrushRole}:white-heat-risen-${spec.role}`,
      points: polygon,
      fill: index === 0 ? palette.white : palette.yellow,
      stroke: 'none',
      opacity: spec.opacity,
      blur: spec.blur,
      z: z + 0.2 + index * 0.01,
      rBrushHeatRisen: true,
    };
  }).filter((mark) => mark.points.length >= 3);
}

function rBrushThreadPolygon(linePoints, widthPx, spec, seed) {
  const centerT = clamp(spec.centerT + (seededUnit(seed, 1) - 0.5) * 0.04, 0.05, 0.9);
  const span = clamp(spec.height, 0.08, 0.8);
  const startT = clamp(centerT - span * 0.42, 0, 1);
  const endT = clamp(centerT + span * 0.58, 0, 1);
  const samples = 7;
  const left = [];
  const right = [];
  for (let i = 0; i < samples; i++) {
    const t = lerp(startT, endT, i / (samples - 1));
    const sample = sampleGesture(linePoints, t);
    if (!sample) continue;
    const normal = normalize([-sample.tangent[1], sample.tangent[0]]);
    const bulb = Math.sin((i / (samples - 1)) * Math.PI);
    const taper = 1 - i / (samples - 1);
    const side = finiteOr(spec.side, 0) * widthPx * bulb;
    const w = Math.max(widthPx * spec.width * (0.18 + bulb * 0.82) * taper, 0.6);
    const center = [
      sample.point[0] + normal[0] * side,
      sample.point[1] + normal[1] * side,
    ];
    left.push([roundPoint(center[0] + normal[0] * w), roundPoint(center[1] + normal[1] * w)]);
    right.push([roundPoint(center[0] - normal[0] * w), roundPoint(center[1] - normal[1] * w)]);
  }
  return [...left, ...right.reverse()];
}

function rBrushLoadMarks({ mark, matter, common, linePoints, palette, z, seed }) {
  const loads = normalizeArray(mark.load || matter.load).filter((load) => load && typeof load === 'object');
  const sourceLoads = loads.length ? loads : [
    {
      role: 'body-strings',
      die: { family: 'noisySpaghetti', stroke: palette.yellow, strokeWidth: [0.35, 0.9], opacity: [0.1, 0.22] },
      field: { kind: 'insideEnvelope', count: 28, lanes: 4, length: 0.9, lateralJitter: 11, alignment: 0.78, fractalOctaves: 2 },
    },
  ];
  const vectorFlag = { vectorMatter: true };
  const out = [];
  sourceLoads.forEach((load, loadIndex) => {
    const die = load.die && typeof load.die === 'object' && !Array.isArray(load.die) ? load.die : {};
    if ((die.family || load.family || load.kind) !== 'noisySpaghetti') return;
    const field = load.field && typeof load.field === 'object' && !Array.isArray(load.field) ? load.field : {};
    const widthBox = bbox(linePoints);
    const jitter = Math.min(Math.abs(finiteOr(field.lateralJitter, 11)), Math.max(widthBox.w * 0.24, 4));
    const effect = {
      ...load,
      role: load.role || `load-${loadIndex + 1}`,
      die: {
        ...die,
        stroke: die.stroke || load.stroke || palette.yellow,
        strokeWidth: die.strokeWidth || load.strokeWidth || 0.7,
      },
      field: {
        ...field,
        count: Math.max(1, Math.min(64, Math.round(finiteOr(field.count ?? field.density ?? load.count, 28)))),
        density: Math.max(1, Math.min(64, Math.round(finiteOr(field.density ?? field.count ?? load.count, 28)))),
        lateralJitter: [-jitter, jitter],
        alignment: clamp(finiteOr(field.alignment, 0.72), 0.58, 1),
        samples: Math.max(4, Math.min(80, Math.round(finiteOr(field.samples, 18)))),
      },
      valueBudget: load.valueBudget || { targetOpacity: 0.36, expectedOverlapCount: 10, mode: 'inverse-count' },
    };
    const loadCommon = {
      ...common,
      fluidGlyphRole: `${common.rBrushRole}:load-${loadIndex + 1}`,
      swirlGlyphSeed: `${common.rBrushSeed}:rbrush-load:${loadIndex}`,
      swirlGlyphScale: 1,
      swirlGlyphOpacity: 1,
    };
    const marks = fluidPastamakerNoisySpaghettiMarks({
      effect,
      effectIndex: loadIndex,
      common: loadCommon,
      linePoints,
      zBase: z,
      t: 0,
      index: loadIndex,
      vectorFlag,
      constructionKind: 'rBrush',
    });
    marks.forEach((item) => {
      out.push({
        ...item,
        ...common,
        role: `${common.rBrushRole}:${effect.role}:${item.stickerFieldIndex + 1}`,
        rBrushLoadRole: effect.role,
        rBrushLoadIndex: loadIndex,
        vectorMatter: true,
        vectorFluid: item.vectorFluid,
        fluidEffectRole: item.fluidEffectRole,
        pastamaker: item.pastamaker,
      });
    });
  });
  return out;
}

function swirlGlyphMarks({ mark, role, constructionKind, medium, index, count, seedText, localSeed, center, flow, cross, lift, camera, scale, baseScale, perspectiveScale, opacity, handedness, glyph, t, flameSource, flameSourceIndex, flameLickIndex, flameLickCount }) {
  if (isFireFluidGlyph(medium, glyph)) {
    return flameGlyphMarks({
      mark,
      role,
      constructionKind,
      medium,
      index,
      count,
      seedText,
      localSeed,
      center,
      flow,
      cross,
      lift,
      camera,
      scale,
      opacity,
      handedness,
      glyph,
      t,
      flameSource,
      flameSourceIndex,
      flameLickIndex,
      flameLickCount,
    });
  }
  const stroke = mark.stroke || glyph.stroke || '#d8d2c3';
  const fill = mark.fill || glyph.fill || '#d8d2c3';
  const lowering = mark.lowering && typeof mark.lowering === 'object' && !Array.isArray(mark.lowering) ? mark.lowering : {};
  const softMass = lowering.softMass ?? glyph.softMass ?? (medium === 'wallpaper-swirl' || medium === 'ribbon' ? false : 'blob');
  const vectorFlag = medium === 'smoke' || medium === 'vapor' ? { vectorSmoke: true } : {};
  const zBase = finiteOr(mark.z, 28);
  const turns = lerpRange(glyph.turns, 0.68, 1.28, seededUnit(localSeed, 6));
  const radius = Math.max(lerpRange(glyph.radius || mark.radius, 0.34, 0.92, seededUnit(localSeed, 7)) * scale, 0.03);
  const tailLength = Math.max(lerpRange(glyph.tailLength, 0.75, 1.75, seededUnit(localSeed, 8)) * scale, 0.03);
  const points = Math.max(10, Math.min(80, Math.round(finiteOr(glyph.points ?? mark.points, 28))));
  const startAngle = finiteOr(glyph.startAngle, -Math.PI * 0.35) + seededUnit(localSeed, 9) * Math.PI * 0.7;
  const strokeWidth = Math.max(finiteOr(mark.strokeWidth ?? glyph.strokeWidth, 4.2) * scale, 0.6);
  const swirlRole = `${role}:swirl-${index + 1}`;
  const linePoints = [];
  for (let i = 0; i < points; i++) {
    const u = i / (points - 1);
    const world = swirlGlyphWorldPoint({ center, flow, cross, lift, u, radius, tailLength, turns, startAngle, handedness, seed: localSeed });
    linePoints.push(projectMandalaScreen(camera, [world[0], world[1]], world[2]));
  }
  const headWorld = swirlGlyphWorldPoint({ center, flow, cross, lift, u: 0.72, radius: radius * 0.92, tailLength, turns, startAngle, handedness, seed: localSeed });
  const head = projectMandalaScreen(camera, [headWorld[0], headWorld[1]], headWorld[2]);
  const common = {
    constructionKind,
    constructionRole: role,
    fluidFieldRole: role,
    fluidMedium: medium,
    fluidGlyphRole: swirlRole,
    swirlFieldRole: role,
    swirlGlyphRole: swirlRole,
    swirlGlyphIndex: index,
    swirlGlyphCount: count,
    swirlGlyphSeed: `${seedText}:${index}`,
    swirlGlyphHandedness: handedness > 0 ? 'counterclockwise' : 'clockwise',
    swirlGlyphCenterXYZ: center.map(round),
    swirlGlyphScale: round(scale),
    swirlGlyphBaseScale: round(baseScale),
    swirlGlyphPerspectiveScale: round(perspectiveScale),
    swirlGlyphOpacity: opacity,
    swirlGlyphT: round(t),
  };
  const line = {
    ...common,
    kind: 'polyline',
    role: `${swirlRole}:motion-line`,
    points: linePoints,
    fill: 'none',
    stroke,
    strokeWidth: roundPoint(strokeWidth),
    opacity,
    dash: mark.dash || glyph.dash,
    z: zBase + t * 12 + 0.01,
    vectorFluid: true,
    ...vectorFlag,
    sourceShape: constructionKind,
  };
  const extras = fluidPastamakerEffectMarks({
    mark,
    glyph,
    common,
    linePoints,
    head,
    base: linePoints[0],
    radius,
    camera,
    zBase,
    t,
    index,
    vectorFlag,
    constructionKind,
  });
  if (softMass === false || softMass === 'none') return [line, ...extras];
  return [
    line,
    {
      ...common,
      kind: 'blob',
      role: `${swirlRole}:soft-mass`,
      anchor: head,
      rx: Math.max(roundPoint(radius * camera.unitScale * 0.72), 2),
      ry: Math.max(roundPoint(radius * camera.unitScale * 0.42), 2),
      rotation: finiteOr(glyph.rotation, handedness * 0.35),
      wobble: finiteOr(glyph.wobble, 0.08),
      fill,
      stroke: 'none',
      opacity: round(opacity * 0.46),
      z: zBase + t * 12,
      vectorFluid: true,
      ...vectorFlag,
      sourceShape: constructionKind,
    },
    ...extras,
  ];
}

function isFireFluidGlyph(medium, glyph = {}) {
  return medium === 'fire' || glyph.id === 'bulb-seaweed-flame' || glyph.id === 'flare-waist-flame-glyph';
}

function flameGlyphMarks({ mark, role, constructionKind, medium, index, count, seedText, localSeed, center, flow, cross, lift, camera, scale, opacity, handedness, glyph, t, flameSource, flameSourceIndex, flameLickIndex, flameLickCount }) {
  const lowering = mark.lowering && typeof mark.lowering === 'object' && !Array.isArray(mark.lowering) ? mark.lowering : {};
  const zBase = finiteOr(mark.z, 28);
  const points = Math.max(8, Math.min(80, Math.round(finiteOr(glyph.points ?? mark.points, 22))));
  let height = Math.max(lerpRange(glyph.height || glyph.tailLength, 1.45, 2.85, seededUnit(localSeed, 6)) * scale, 0.08);
  let width = Math.max(lerpRange(glyph.radius || glyph.width, 0.34, 0.72, seededUnit(localSeed, 7)) * scale, 0.03);
  const sourceCoverageWidth = flameSource
    ? finiteOr(flameSource.radius, 0) * finiteOr(glyph.sourceCoverageScale ?? flameSource.coverageScale, 2.15)
    : 0;
  if (sourceCoverageWidth > width) {
    const aspectBoost = sourceCoverageWidth / width;
    width = sourceCoverageWidth;
    height *= aspectBoost;
  }
  const curve = lerpRange(glyph.curveAmount ?? glyph.curve, -0.34, 0.34, seededUnit(localSeed, 8)) * handedness * scale;
  const wobble = clamp(finiteOr(glyph.wobble, 0.16), 0, 1.5);
  const swirlAmount = clamp(finiteOr(glyph.swirlAmount ?? glyph.upwardSwirl, 0), 0, 2);
  const swirlTurns = finiteOr(glyph.swirlTurns, 1.35);
  const flameRole = `${role}:flame-${index + 1}`;
  const spineWorld = [];
  const linePoints = [];
  for (let i = 0; i < points; i++) {
    const u = points === 1 ? 0.5 : i / (points - 1);
    const world = flameGlyphWorldPoint({ center, flow, cross, lift, u, height, curve, wobble, swirlAmount, swirlTurns, seed: localSeed });
    spineWorld.push(world);
    linePoints.push(projectMandalaScreen(camera, [world[0], world[1]], world[2]));
  }
  const outerEnvelope = flameEnvelopeParts(linePoints, width * camera.unitScale, localSeed, false);
  const coreEnvelope = flameEnvelopeParts(linePoints, width * camera.unitScale * 0.46, localSeed, true);
  const outerPoints = outerEnvelope.points;
  const corePoints = coreEnvelope.points;
  const base = linePoints[0];
  const head = linePoints[Math.max(0, linePoints.length - 1)];
  const coreCenter = linePoints[Math.max(0, Math.min(linePoints.length - 1, Math.round((linePoints.length - 1) * 0.42)))];
  const radius = Math.max(width, height * 0.22);
  const vectorFlag = { vectorFire: true };
  const common = {
    constructionKind,
    constructionRole: role,
    fluidFieldRole: role,
    fluidMedium: medium,
    fluidGlyphRole: flameRole,
    swirlFieldRole: role,
    swirlGlyphRole: flameRole,
    swirlGlyphIndex: index,
    swirlGlyphCount: count,
    swirlGlyphSeed: `${seedText}:${index}`,
    swirlGlyphHandedness: handedness > 0 ? 'counterclockwise' : 'clockwise',
    swirlGlyphCenterXYZ: center.map(round),
    swirlGlyphScale: round(scale),
    swirlGlyphOpacity: opacity,
    swirlGlyphT: round(t),
    flameGlyph: true,
    flameGlyphProfile: glyph.profile || 'flare-source-waist-point-bulb',
    flameGlyphCoreCenter: coreCenter,
    flameSourceRole: flameSource?.role,
    flameSourceIndex,
    flameSourceLickIndex: flameLickIndex,
    flameSourceLickCount: flameLickCount,
    flameSourceSeed: flameSource ? `${seedText}:source:${flameSourceIndex}` : undefined,
    flameSourceRadius: flameSource ? round(finiteOr(flameSource.radius, 0)) : undefined,
    flameSourceCoverageScale: flameSource ? round(finiteOr(glyph.sourceCoverageScale ?? flameSource.coverageScale, 2.15)) : undefined,
  };
  const outerFill = mark.fill || glyph.fill || '#ff8a1f';
  const outerGradient = flameFillGradient({ glyph, fallbackFill: outerFill, fallbackKind: 'radial', base, head, coreCenter, role: 'outer-body' });
  const outlineOff = glyph.outline === false || lowering.outline === false || glyph.edgeSkin?.outline === false;
  const outerStroke = outlineOff ? 'none' : (mark.stroke || glyph.stroke || '#9c1f10');
  const coreFill = glyph.coreFill || lowering.coreFill || '#d71920';
  const coreGradient = flameFillGradient({ glyph, fallbackFill: coreFill, fallbackKind: 'linear', base, head, coreCenter, role: 'red-core', path: 'coreFillGradient' });
  const z = zBase + t * 12;
  const extras = fluidPastamakerEffectMarks({
    mark,
    glyph,
    common,
    linePoints,
    head,
    base,
    radius,
    camera,
    zBase,
    t,
    index,
    vectorFlag,
    constructionKind,
  });
  const edgeSkin = flameLickEdgeSkinMarks({
    common,
    glyph,
    outerEnvelope,
    coreEnvelope,
    handedness,
    opacity,
    z,
    localSeed,
    constructionKind,
    vectorFlag,
  });
  const volumeFill = flameLickVolumeFillMarks({
    common,
    glyph,
    outerEnvelope,
    coreEnvelope,
    opacity,
    z,
    constructionKind,
    vectorFlag,
  });
  return [
    {
      ...common,
      kind: 'polygon',
      role: `${flameRole}:outer-body`,
      points: outerPoints,
      fill: outerFill,
      fillGradient: outerGradient,
      stroke: outerStroke,
      strokeWidth: finiteOr(mark.strokeWidth ?? glyph.strokeWidth, 1),
      opacity,
      z,
      vectorFluid: true,
      ...vectorFlag,
      sourceShape: constructionKind,
    },
    ...volumeFill,
    {
      ...common,
      kind: 'polygon',
      role: `${flameRole}:red-core`,
      points: corePoints,
      fill: coreFill,
      fillGradient: coreGradient,
      stroke: 'none',
      opacity: round(clamp(opacity * 0.82, 0.02, 1)),
      z: z + 0.08,
      vectorFluid: true,
      ...vectorFlag,
      sourceShape: constructionKind,
    },
    ...edgeSkin,
    ...extras,
  ];
}

function flameGlyphWorldPoint({ center, flow, cross, lift, u, height, curve, wobble, swirlAmount, swirlTurns, seed }) {
  const liftStep = height * u;
  const heatPull = height * 0.16 * u;
  const swirlPhase = seededUnit(seed, 51) * Math.PI * 2;
  const side = Math.sin(u * Math.PI) * curve +
    deterministicWave(seed, 11, u * Math.PI * 2) * wobble * height * 0.045 * (1 - u * 0.35) +
    Math.sin(u * Math.PI * 2 * swirlTurns + swirlPhase) * swirlAmount * height * Math.sin(u * Math.PI) * 0.18;
  return add3(center, add3(scale3(lift, liftStep), add3(scale3(flow, heatPull), scale3(cross, side))));
}

function flameFillGradient({ glyph, fallbackFill, fallbackKind, base, head, coreCenter, role, path = 'fillGradient' }) {
  const raw = glyph[path] || glyph.gradientFill || glyph.gradient;
  const gradient = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  if (gradient.enabled === false) return undefined;
  if (!gradient.enabled && !glyph.gradientFill && !glyph.gradient && !glyph[path]) return undefined;
  const kind = gradient.kind || gradient.type || fallbackKind || 'radial';
  const stops = Array.isArray(gradient.stops) && gradient.stops.length
    ? gradient.stops
    : [
      { offset: 0, color: gradient.hot || gradient.center || '#fff6c7', opacity: finiteOr(gradient.hotOpacity, 0.94) },
      { offset: 0.34, color: gradient.warm || fallbackFill || '#ff8a1f', opacity: finiteOr(gradient.warmOpacity, 0.72) },
      { offset: 1, color: gradient.cool || gradient.edge || '#d71920', opacity: finiteOr(gradient.edgeOpacity, 0.22) },
    ];
  return {
    kind,
    role,
    from: validPoint(gradient.from) || base,
    to: validPoint(gradient.to) || head,
    center: validPoint(gradient.centerPoint) || coreCenter,
    radius: finiteOr(gradient.radius, 1),
    independentLighting: gradient.independentLighting !== false,
    stops: stops
      .map((stop, index) => {
        const rawStop = stop && typeof stop === 'object' && !Array.isArray(stop)
          ? stop
          : { offset: index / Math.max(stops.length - 1, 1), color: stop };
        return {
          offset: round(clamp(finiteOr(rawStop.offset, index / Math.max(stops.length - 1, 1)), 0, 1)),
          color: rawStop.color || fallbackFill,
          opacity: round(clamp(finiteOr(rawStop.opacity, 1), 0, 1)),
        };
      })
      .sort((a, b) => a.offset - b.offset),
  };
}

function flameEnvelopeParts(spine, widthPx, seed, core = false) {
  const start = core ? 0.08 : 0;
  const end = core ? 0.86 : 1;
  const samples = spine
    .map((point, index) => ({ point, u: spine.length === 1 ? 0.5 : index / (spine.length - 1), index }))
    .filter((sample) => sample.u >= start && sample.u <= end);
  if (samples.length < 2) return { points: spine, left: spine, right: spine };
  const left = [];
  const right = [];
  for (const sample of samples) {
    const prev = spine[Math.max(0, sample.index - 1)];
    const next = spine[Math.min(spine.length - 1, sample.index + 1)];
    const tangent = normalize([next[0] - prev[0], next[1] - prev[1]]);
    const normal = [-tangent[1], tangent[0]];
    const jitter = deterministicWave(seed, core ? 21 : 19, sample.u * Math.PI * 2) * widthPx * (core ? 0.025 : 0.055);
    const w = Math.max(flameWidthProfile(sample.u) * widthPx + jitter, core ? 0.8 : 0);
    left.push([roundPoint(sample.point[0] + normal[0] * w), roundPoint(sample.point[1] + normal[1] * w)]);
    right.push([roundPoint(sample.point[0] - normal[0] * w), roundPoint(sample.point[1] - normal[1] * w)]);
  }
  return { points: [...left, ...right.slice().reverse()], left, right };
}

function flameLickEdgeSkinMarks({ common, glyph, outerEnvelope, coreEnvelope, handedness, opacity, z, localSeed, constructionKind, vectorFlag }) {
  const edge = glyph.edgeSkin && typeof glyph.edgeSkin === 'object' && !Array.isArray(glyph.edgeSkin)
    ? glyph.edgeSkin
    : {};
  if (edge.enabled === false) return [];
  const outside = handedness > 0 ? outerEnvelope.right : outerEnvelope.left;
  const inside = handedness > 0 ? coreEnvelope.left : coreEnvelope.right;
  const outsidePath = flameEdgeSegment(outside, edge.edgeT || edge.outsideT || [0.08, 0.94]);
  const insidePath = flameEdgeSegment(inside, edge.insideT || [0.12, 0.82]);
  const budget = resolveValueBudget(edge.valueBudget, {
    targetOpacity: finiteOr(edge.targetOpacity, 0.72),
    expectedOverlapCount: finiteOr(edge.expectedOverlapCount, 3),
    mode: 'inverse-count',
  });
  const hardOpacity = round(clamp(opacityForBudget(budget.targetOpacity, budget.expectedOverlapCount, budget.mode) * lerp(0.82, 1.18, seededUnit(localSeed, 31)), 0.04, 1));
  const fuzzyOpacity = round(clamp(finiteOr(edge.insideOpacity, 0.28) * opacity, 0.02, 0.8));
  return [
    {
      ...common,
      kind: 'polyline',
      role: `${common.fluidGlyphRole}:hard-lit-outer-edge`,
      points: outsidePath,
      fill: 'none',
      stroke: edge.stroke || edge.outsideStroke || '#ffe7a3',
      strokeWidth: roundPoint(finiteOr(edge.strokeWidth, 1.35) * Math.max(common.swirlGlyphScale || 1, 0.35)),
      opacity: hardOpacity,
      z: z + 0.16,
      vectorFluid: true,
      ...vectorFlag,
      sourceShape: constructionKind,
      flameEdgeSkin: true,
      flameEdgeSide: 'outside-lit',
      flameValueBudget: budget,
    },
    {
      ...common,
      kind: 'polyline',
      role: `${common.fluidGlyphRole}:inner-fuzzy-heat-edge`,
      points: insidePath,
      fill: 'none',
      stroke: edge.insideStroke || '#ff5b24',
      strokeWidth: roundPoint(finiteOr(edge.insideStrokeWidth, 3.2) * Math.max(common.swirlGlyphScale || 1, 0.35)),
      opacity: fuzzyOpacity,
      blur: finiteOr(edge.insideBlur, 1.2),
      z: z + 0.11,
      vectorFluid: true,
      ...vectorFlag,
      sourceShape: constructionKind,
      flameEdgeSkin: true,
      flameEdgeSide: 'inside-fuzzy',
      flameValueBudget: budget,
    },
  ].filter((mark) => mark.points.length >= 2);
}

function flameLickVolumeFillMarks({ common, glyph, outerEnvelope, coreEnvelope, opacity, z, constructionKind, vectorFlag }) {
  const volume = glyph.volumetricFill && typeof glyph.volumetricFill === 'object' && !Array.isArray(glyph.volumetricFill)
    ? glyph.volumetricFill
    : {};
  if (volume.enabled === false) return [];
  if (!volume.enabled && !glyph.sourceScopedVolume) return [];
  const left = flameVolumeSidePolygon(outerEnvelope.left, coreEnvelope.left);
  const right = flameVolumeSidePolygon(outerEnvelope.right, coreEnvelope.right);
  const sideOpacity = round(clamp(finiteOr(volume.opacity, 0.18) * opacity, 0.02, 0.7));
  return [
    {
      ...common,
      kind: 'polygon',
      role: `${common.fluidGlyphRole}:volume-left-fill`,
      points: left,
      fill: volume.leftFill || volume.fill || '#ffd36a',
      stroke: 'none',
      opacity: sideOpacity,
      blur: finiteOr(volume.blur, 0.6),
      z: z + 0.05,
      vectorFluid: true,
      ...vectorFlag,
      sourceShape: constructionKind,
      flameVolumeFill: true,
      flameVolumeSide: 'left',
    },
    {
      ...common,
      kind: 'polygon',
      role: `${common.fluidGlyphRole}:volume-right-fill`,
      points: right,
      fill: volume.rightFill || volume.fill || '#ff6b24',
      stroke: 'none',
      opacity: sideOpacity,
      blur: finiteOr(volume.blur, 0.6),
      z: z + 0.055,
      vectorFluid: true,
      ...vectorFlag,
      sourceShape: constructionKind,
      flameVolumeFill: true,
      flameVolumeSide: 'right',
    },
  ].filter((mark) => mark.points.length >= 3);
}

function flameVolumeSidePolygon(outer, inner) {
  const outerClean = Array.isArray(outer) ? outer.filter(validPoint) : [];
  const innerClean = Array.isArray(inner) ? inner.filter(validPoint) : [];
  if (outerClean.length < 2 || innerClean.length < 2) return [];
  const count = Math.min(outerClean.length, innerClean.length);
  const outerSide = [];
  const innerSide = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const outerSample = sampleGesture(outerClean, t)?.point;
    const innerSample = sampleGesture(innerClean, t)?.point;
    if (outerSample) outerSide.push(outerSample.map(roundPoint));
    if (innerSample) innerSide.push(innerSample.map(roundPoint));
  }
  return [...outerSide, ...innerSide.reverse()];
}

function flameEdgeSegment(points, rangeValue) {
  const clean = Array.isArray(points) ? points.filter(validPoint) : [];
  if (clean.length < 2) return clean;
  const range = normalizeRange(rangeValue, 0, 1);
  const startT = clamp(Math.min(range[0], range[1]), 0, 1);
  const endT = clamp(Math.max(range[0], range[1]), 0, 1);
  const sampleCount = Math.max(3, Math.min(clean.length, Math.ceil(clean.length * Math.max(endT - startT, 0.08))));
  const out = [];
  for (let i = 0; i < sampleCount; i++) {
    const t = sampleCount === 1 ? (startT + endT) / 2 : lerp(startT, endT, i / (sampleCount - 1));
    const sample = sampleGesture(clean, t);
    if (sample?.point) out.push(sample.point.map(roundPoint));
  }
  return out;
}

function flameWidthProfile(u) {
  const stops = [
    [0, 0.52],
    [0.16, 0.9],
    [0.42, 0.26],
    [0.68, 0.58],
    [0.9, 0.2],
    [1, 0],
  ];
  for (let i = 1; i < stops.length; i++) {
    if (u <= stops[i][0]) {
      const prev = stops[i - 1];
      const next = stops[i];
      const t = clamp((u - prev[0]) / Math.max(next[0] - prev[0], 0.001), 0, 1);
      const eased = t * t * (3 - 2 * t);
      return lerp(prev[1], next[1], eased);
    }
  }
  return 0;
}

const SPARK_GLYPH_LIBRARY = {
  'rain-streak': { kind: 'line', stroke: '#b9d8ee', strokeWidth: 1.3, length: [18, 42], opacity: [0.32, 0.72], direction: [0.18, 1, 0] },
  'spark-streak': { kind: 'line', stroke: '#ffd36a', strokeWidth: 1.8, length: [10, 36], opacity: [0.55, 0.95], direction: [1, -0.35, 0] },
  'leaf-dash': { kind: 'leaf', stroke: '#4f5b2f', fill: '#7c8f3b', strokeWidth: 0.8, length: [7, 18], opacity: [0.45, 0.9], direction: [0.12, 1, 0] },
  'comic-impact': { kind: 'line', stroke: '#fff2aa', strokeWidth: 2.4, length: [22, 58], opacity: [0.62, 1], direction: [1, -0.12, 0] },
  'ember-dot': { kind: 'leaf', stroke: '#f9f3b5', fill: '#f9f3b5', strokeWidth: 0.4, length: [3, 8], opacity: [0.42, 0.86], direction: [0.2, -0.3, 0] },
};

function expandSparkFieldMark(mark, manifest = {}) {
  const constructionKind = mark.kind === 'showerField' ? 'showerField' : 'sparkField';
  const mode = mark.mode || mark.emission || mark.profile || 'falling';
  const medium = mark.medium || sparkMediumFromMode(mode);
  const glyph = sparkGlyphConfig(mark, medium);
  const role = mark.role || `${medium}-${mode}-field`;
  const viewBox = mark.viewBox && typeof mark.viewBox === 'object'
    ? mark.viewBox
    : manifest.viewBox && typeof manifest.viewBox === 'object' ? manifest.viewBox : {};
  const basis = mark.basis && typeof mark.basis === 'object' && !Array.isArray(mark.basis) ? mark.basis : {};
  const population = mark.population && typeof mark.population === 'object' && !Array.isArray(mark.population) ? mark.population : {};
  const emitter = mark.emitter && typeof mark.emitter === 'object' && !Array.isArray(mark.emitter) ? mark.emitter : {};
  const count = Math.max(1, Math.min(500, Math.round(finiteOr(population.count ?? mark.count, 36))));
  const seedText = String(population.seed || mark.seed || role);
  const camera = {
    screenOrigin: validPoint(basis.screenOrigin || mark.screenOrigin) || [finiteOr(viewBox.width, 800) / 2, finiteOr(viewBox.height, 520) * 0.5],
    east: validPoint(basis.east || mark.east) || [1, 0],
    north: validPoint(basis.north || mark.north) || [0, -1],
    zenith: validPoint(basis.zenith || mark.zenith) || [0, -1],
    unitScale: finiteOr(basis.unitScale ?? mark.unitScale, 28),
    depthScale: clamp(finiteOr(basis.depthScale ?? mark.depthScale, 0.94), 0.2, 1),
  };
  const origin = validVector3(basis.origin || emitter.origin || mark.origin) || [0, 0, 0];
  const flow = normalize3(validVector3(basis.flow || glyph.direction || mark.flow) || [0, 1, 0]);
  const cross = normalize3(validVector3(basis.cross || mark.cross) || [1, 0, 0]);
  const lift = normalize3(validVector3(basis.lift || mark.lift) || [0, 0, 1]);
  const width = finiteOr(emitter.width ?? basis.width ?? mark.width, 8);
  const height = finiteOr(emitter.height ?? basis.height ?? mark.height, 8);
  const spreadDegrees = finiteOr(emitter.spreadDegrees ?? mark.spreadDegrees, mode === 'from-center' ? 70 : 18);
  const lengthRange = numericRange(population.length || mark.length || glyph.length, 10, 28);
  const opacityRange = numericRange(population.opacity || mark.opacityRange || glyph.opacity, 0.35, 0.85);
  const scaleRange = numericRange(population.scale || mark.scale, 0.75, 1.25);
  const gravity = validVector3(mark.gravity || emitter.gravity) || [0, 1, 0];
  const surface = sparkEmitterSurface(emitter, origin, cross, width);
  const out = [];
  if (String(mode || '').toLowerCase() === 'radial-fractal' || String(mode || '').toLowerCase() === 'firework-burst') {
    const fractal = mark.fractal && typeof mark.fractal === 'object' && !Array.isArray(mark.fractal) ? mark.fractal : {};
    for (let index = 0; index < count; index++) {
      const localSeed = hashString(`${seedText}:${index}`);
      const t = count === 1 ? 0.5 : index / (count - 1);
      const branches = sparkFractalParticles({
        origin,
        flow,
        cross,
        lift,
        spreadDegrees,
        lengthRange,
        scaleRange,
        localSeed,
        fractal,
      });
      branches.forEach((particle, branchIndex) => {
        const perspectiveScale = mandalaPerspectiveScale(camera, particle.start);
        const scale = particle.scale * perspectiveScale;
        const opacity = round(clamp(lerp(opacityRange[0], opacityRange[1], seededUnit(localSeed, 6 + branchIndex)) * particle.opacityScale * lerp(1, perspectiveScale, 0.35), 0.02, 1));
        out.push(sparkGlyphMark({
          mark,
          glyph,
          common: {
            constructionKind,
            constructionRole: role,
            sparkFieldRole: role,
            showerFieldRole: role,
            sparkMode: mode,
            sparkMedium: medium,
            sparkGlyphId: glyph.id,
            sparkIndex: index,
            sparkBranchIndex: branchIndex,
            sparkGeneration: particle.generation,
            sparkCount: count,
            sparkSeed: `${seedText}:${index}:${branchIndex}`,
            sparkWorldStart: particle.start.map(round),
            sparkPerspectiveScale: round(perspectiveScale),
            sparkScale: round(scale),
            opacity,
            z: finiteOr(mark.z, 30) + particle.generation * 0.2 + t * finiteOr(mark.zSpread, 8) + index * 0.0001 + branchIndex * 0.00001,
          },
          particle,
          camera,
          scale,
          localSeed: hashString(`${localSeed}:${branchIndex}`),
        }));
      });
    }
    return out;
  }
  for (let index = 0; index < count; index++) {
    const localSeed = hashString(`${seedText}:${index}`);
    const t = count === 1 ? 0.5 : index / (count - 1);
    const particle = sparkParticleGeometry({ mode, origin, flow, cross, lift, surface, width, height, spreadDegrees, gravity, lengthRange, scaleRange, localSeed });
    const perspectiveScale = mandalaPerspectiveScale(camera, particle.start);
    const scale = particle.scale * perspectiveScale;
    const opacity = round(clamp(lerp(opacityRange[0], opacityRange[1], seededUnit(localSeed, 6)) * lerp(1, perspectiveScale, 0.35), 0.02, 1));
    out.push(sparkGlyphMark({
      mark,
      glyph,
      common: {
        constructionKind,
        constructionRole: role,
        sparkFieldRole: role,
        showerFieldRole: role,
        sparkMode: mode,
        sparkMedium: medium,
        sparkGlyphId: glyph.id,
        sparkIndex: index,
        sparkCount: count,
        sparkSeed: `${seedText}:${index}`,
        sparkWorldStart: particle.start.map(round),
        sparkPerspectiveScale: round(perspectiveScale),
        sparkScale: round(scale),
        opacity,
        z: finiteOr(mark.z, 30) + t * finiteOr(mark.zSpread, 8) + index * 0.0001,
      },
      particle,
      camera,
      scale,
      localSeed,
    }));
  }
  return out;
}

function sparkFractalParticles({ origin, flow, cross, lift, spreadDegrees, lengthRange, scaleRange, localSeed, fractal }) {
  const generations = Math.max(1, Math.min(5, Math.round(finiteOr(fractal.generations, 3))));
  const branchingRange = numericRange(fractal.branching, 2, 3);
  const lengthFalloff = clamp(finiteOr(fractal.lengthFalloff, 0.52), 0.1, 0.95);
  const opacityFalloff = clamp(finiteOr(fractal.opacityFalloff, 0.68), 0.1, 0.98);
  const angleJitter = finiteOr(fractal.angleJitter, 18);
  const splitRange = numericRange(fractal.splitAt, 0.55, 0.9);
  const baseAngle = ((seededUnit(localSeed, 1) - 0.5) * spreadDegrees * Math.PI) / 180;
  const baseScale = lerp(scaleRange[0], scaleRange[1], seededUnit(localSeed, 5));
  const baseLength = lerp(lengthRange[0], lengthRange[1], seededUnit(localSeed, 4)) * baseScale;
  const out = [];
  const queue = [{
    start: origin,
    angle: baseAngle,
    length: baseLength,
    scale: baseScale,
    generation: 0,
    opacityScale: 1,
    seed: localSeed,
  }];
  while (queue.length) {
    const item = queue.shift();
    const dir = sparkRadialDirection(flow, cross, item.angle);
    const liftOffset = scale3(lift, finiteOr(fractal.liftPerGeneration, 0.08) * item.generation * item.length);
    const end = add3(add3(item.start, scale3(dir, item.length)), liftOffset);
    out.push({ start: item.start, end, scale: item.scale, generation: item.generation, opacityScale: item.opacityScale });
    if (item.generation >= generations - 1) continue;
    const branches = Math.max(1, Math.min(8, Math.round(lerp(branchingRange[0], branchingRange[1], seededUnit(item.seed, 17 + item.generation)))));
    for (let i = 0; i < branches; i++) {
      const childSeed = hashString(`${item.seed}:${item.generation}:${i}`);
      const splitT = lerp(splitRange[0], splitRange[1], seededUnit(childSeed, 2));
      const splitStart = lerpPoint3(item.start, end, splitT);
      const jitter = ((seededUnit(childSeed, 3) - 0.5) * angleJitter * Math.PI) / 180;
      const fan = branches === 1 ? 0 : ((i / (branches - 1)) - 0.5) * angleJitter * Math.PI / 180;
      queue.push({
        start: splitStart,
        angle: item.angle + jitter + fan,
        length: item.length * lengthFalloff * lerp(0.82, 1.18, seededUnit(childSeed, 4)),
        scale: item.scale * lengthFalloff,
        generation: item.generation + 1,
        opacityScale: item.opacityScale * opacityFalloff,
        seed: childSeed,
      });
    }
  }
  return out;
}

function sparkRadialDirection(flow, cross, angle) {
  return normalize3(add3(scale3(flow, Math.cos(angle)), scale3(cross, Math.sin(angle))));
}

function sparkMediumFromMode(mode) {
  const lower = String(mode || '').toLowerCase();
  if (lower.includes('fall')) return 'rain';
  if (lower.includes('center') || lower.includes('collision') || lower.includes('bounce')) return 'spark';
  return 'shower';
}

function sparkGlyphConfig(mark, medium) {
  const raw = mark.glyph && typeof mark.glyph === 'object' && !Array.isArray(mark.glyph) ? mark.glyph : {};
  const id = raw.id || mark.glyphId || (
    medium === 'rain' ? 'rain-streak' :
      medium === 'leaf' || medium === 'leaves' ? 'leaf-dash' :
        medium === 'comic' || medium === 'action' ? 'comic-impact' :
          'spark-streak'
  );
  return { ...(SPARK_GLYPH_LIBRARY[id] || SPARK_GLYPH_LIBRARY['spark-streak']), ...raw, id };
}

function sparkEmitterSurface(emitter, origin, cross, width) {
  return {
    from: validVector3(emitter.from) || add3(origin, scale3(cross, -width / 2)),
    to: validVector3(emitter.to) || add3(origin, scale3(cross, width / 2)),
  };
}

function sparkParticleGeometry({ mode, origin, flow, cross, lift, surface, width, height, spreadDegrees, gravity, lengthRange, scaleRange, localSeed }) {
  const scale = lerp(scaleRange[0], scaleRange[1], seededUnit(localSeed, 5));
  const length = lerp(lengthRange[0], lengthRange[1], seededUnit(localSeed, 4)) * scale;
  const lower = String(mode || '').toLowerCase();
  if (lower === 'from-center' || lower === 'center' || lower === 'radial') {
    const angle = ((seededUnit(localSeed, 1) - 0.5) * spreadDegrees * Math.PI) / 180;
    const dir = normalize3(add3(flow, scale3(cross, Math.sin(angle))));
    const start = add3(origin, add3(scale3(cross, (seededUnit(localSeed, 2) - 0.5) * width * 0.18), scale3(lift, (seededUnit(localSeed, 3) - 0.5) * height * 0.12)));
    return { start, end: add3(start, scale3(dir, length)), scale };
  }
  if (lower === 'surface-collision' || lower === 'collision') {
    const start = lerpPoint3(surface.from, surface.to, seededUnit(localSeed, 1));
    const dir = normalize3(add3(flow, add3(scale3(cross, (seededUnit(localSeed, 3) - 0.5) * Math.tan((spreadDegrees * Math.PI) / 360)), scale3(lift, (seededUnit(localSeed, 2) - 0.5) * 0.32))));
    return { start, end: add3(start, scale3(dir, length)), scale };
  }
  if (lower === 'bounce-then-drop' || lower === 'bounce') {
    const start = lerpPoint3(surface.from, surface.to, seededUnit(localSeed, 1));
    const bounceDir = normalize3(add3(flow, add3(scale3(cross, (seededUnit(localSeed, 2) - 0.5) * 0.9), scale3(lift, 0.45))));
    const bounce = add3(start, scale3(bounceDir, length * 0.58));
    const drop = add3(bounce, scale3(normalize3(gravity), length * 0.74));
    return { start, points: [start, bounce, drop], scale };
  }
  const lateral = (seededUnit(localSeed, 1) - 0.5) * width;
  const along = (seededUnit(localSeed, 2) - 0.5) * height;
  const start = add3(origin, add3(scale3(cross, lateral), scale3(flow, along)));
  const slant = normalize3(add3(flow, scale3(cross, (seededUnit(localSeed, 3) - 0.5) * Math.tan((spreadDegrees * Math.PI) / 360))));
  return { start, end: add3(start, scale3(slant, length)), scale };
}

function sparkGlyphMark({ mark, glyph, common, particle, camera, scale, localSeed }) {
  const stroke = mark.stroke || glyph.stroke || '#ffd36a';
  const fill = mark.fill || glyph.fill || stroke;
  if (glyph.kind === 'leaf') {
    const center = projectMandalaScreen(camera, [particle.start[0], particle.start[1]], particle.start[2]);
    const start = seededUnit(localSeed, 7) * Math.PI;
    return {
      ...common,
      kind: 'polygon',
      role: `${common.sparkFieldRole}:spark-${common.sparkIndex + 1}`,
      points: ellipsePoints(center[0], center[1], Math.max(finiteOr(glyph.rx, finiteOr(glyph.width, 5)) * scale, 1), Math.max(finiteOr(glyph.ry, finiteOr(glyph.height, 9)) * scale, 1), 8, start, start + Math.PI * 2),
      fill,
      stroke,
      strokeWidth: finiteOr(glyph.strokeWidth, 0.8),
      sourceShape: common.constructionKind,
    };
  }
  if (Array.isArray(particle.points)) {
    return {
      ...common,
      kind: 'polyline',
      role: `${common.sparkFieldRole}:spark-${common.sparkIndex + 1}`,
      points: particle.points.map((point) => projectMandalaScreen(camera, [point[0], point[1]], point[2])),
      fill: 'none',
      stroke,
      strokeWidth: roundPoint(Math.max(finiteOr(mark.strokeWidth ?? glyph.strokeWidth, 1.4) * scale, 0.35)),
      sourceShape: common.constructionKind,
    };
  }
  const a = projectMandalaScreen(camera, [particle.start[0], particle.start[1]], particle.start[2]);
  const b = projectMandalaScreen(camera, [particle.end[0], particle.end[1]], particle.end[2]);
  return {
    ...common,
    kind: 'line',
    role: `${common.sparkFieldRole}:spark-${common.sparkIndex + 1}`,
    x1: a[0],
    y1: a[1],
    x2: b[0],
    y2: b[1],
    stroke,
    strokeWidth: roundPoint(Math.max(finiteOr(mark.strokeWidth ?? glyph.strokeWidth, 1.4) * scale, 0.35)),
    sourceShape: common.constructionKind,
  };
}

function lerpPoint3(a, b, t) {
  return [
    lerp(finiteOr(a?.[0], 0), finiteOr(b?.[0], 0), t),
    lerp(finiteOr(a?.[1], 0), finiteOr(b?.[1], 0), t),
    lerp(finiteOr(a?.[2], 0), finiteOr(b?.[2], 0), t),
  ];
}

function expandWispFieldMark(mark, manifest = {}) {
  const role = mark.role || 'will-o-wisp';
  const body = mark.body && typeof mark.body === 'object' && !Array.isArray(mark.body) ? mark.body : {};
  const motes = mark.motes && typeof mark.motes === 'object' && !Array.isArray(mark.motes) ? mark.motes : {};
  const drift = mark.drift && typeof mark.drift === 'object' && !Array.isArray(mark.drift) ? mark.drift : {};
  const basis = mark.basis && typeof mark.basis === 'object' && !Array.isArray(mark.basis) ? mark.basis : {};
  const color = mark.color || body.color || '#78e6ff';
  const glow = mark.glow || body.glow || '#d9fbff';
  const seed = mark.seed || role;
  const bodyField = {
    kind: 'fluidField',
    role: `${role}:aura-body`,
    medium: body.medium || 'aura',
    stroke: body.stroke || color,
    fill: body.fill || color,
    z: finiteOr(mark.z, 32),
    basis: {
      ...basis,
      flow: validVector3(drift.flow) || validVector3(basis.flow) || [0.2, -0.4, 0.12],
      lift: validVector3(basis.lift) || [0, 0, 1],
      cross: validVector3(basis.cross) || [1, 0.2, 0],
      length: finiteOr(basis.length, finiteOr(body.length, 2.4)),
      spread: finiteOr(basis.spread, finiteOr(body.spread, 1.2)),
      liftAmount: finiteOr(basis.liftAmount, finiteOr(body.liftAmount, 0.9)),
    },
    population: {
      count: Math.max(1, Math.min(40, Math.round(finiteOr(body.count, 5)))),
      seed: `${seed}:body`,
      scale: body.scale || [0.55, 1.35],
      opacity: body.opacity || [0.14, 0.4],
      handedness: body.handedness || 'alternate-biased',
    },
    glyph: {
      id: body.glyphId || 'hook-cloud-swirl',
      turns: body.turns || [0.35, 0.9],
      radius: body.radius || [0.45, 1.1],
      tailLength: body.tailLength || [0.35, 1.05],
      points: finiteOr(body.points, 26),
      strokeWidth: finiteOr(body.strokeWidth, 2.2),
      softMass: body.softMass ?? 'blob',
      wobble: finiteOr(body.wobble, 0.14),
    },
  };
  const moteField = {
    kind: 'sparkField',
    role: `${role}:motes`,
    mode: motes.mode || 'from-center',
    medium: motes.medium || 'spark',
    stroke: motes.stroke || glow,
    fill: motes.fill || glow,
    z: finiteOr(mark.z, 32) + 4,
    basis: {
      ...basis,
      flow: validVector3(motes.flow) || validVector3(drift.flow) || validVector3(basis.flow) || [0.2, -0.1, 0],
      cross: validVector3(basis.cross) || [1, 0, 0],
      lift: validVector3(basis.lift) || [0, 0, 1],
    },
    emitter: {
      spreadDegrees: finiteOr(motes.spreadDegrees, 360),
      width: finiteOr(motes.width, 2.2),
      height: finiteOr(motes.height, 1.2),
    },
    population: {
      count: Math.max(0, Math.min(160, Math.round(finiteOr(motes.count, 18)))),
      seed: `${seed}:motes`,
      length: motes.length || [0.12, 0.55],
      scale: motes.scale || [0.35, 0.85],
      opacity: motes.opacity || [0.25, 0.78],
    },
    glyph: {
      id: motes.glyphId || 'ember-dot',
      stroke: motes.stroke || glow,
      fill: motes.fill || glow,
      strokeWidth: finiteOr(motes.strokeWidth, 0.8),
    },
  };
  return [
    ...expandSwirlFieldMark(bodyField, manifest).map((item) => ({
      ...item,
      wispFieldRole: role,
      wispComponent: 'body',
      sourceShape: 'wispField',
    })),
    ...expandSparkFieldMark(moteField, manifest).map((item) => ({
      ...item,
      wispFieldRole: role,
      wispComponent: 'motes',
      sourceShape: 'wispField',
    })),
  ];
}

function fluidPastamakerEffectMarks({ mark, glyph, common, linePoints, head, base, radius, camera, zBase, t, index, vectorFlag, constructionKind }) {
  const effects = fluidPastamakerEffects(mark, glyph);
  if (!effects.length) return [];
  const out = [];
  effects.forEach((effect, effectIndex) => {
    if (isNoisySpaghettiEffect(effect)) {
      out.push(...fluidPastamakerNoisySpaghettiMarks({
        effect,
        effectIndex,
        common,
        linePoints,
        zBase,
        t,
        index,
        vectorFlag,
        constructionKind,
      }));
      return;
    }
    const sticker = fluidPastamakerStickerField({
      effect,
      effectIndex,
      common,
      linePoints,
      head,
      base,
      radius,
      camera,
      zBase,
      t,
      index,
    });
    if (!sticker) return;
    const expanded = expandStickerFieldMark(sticker, new Map());
    expanded.forEach((item) => {
      out.push({
        ...item,
        ...common,
        role: `${common.fluidGlyphRole}:${effect.role || `pastamaker-${effectIndex + 1}`}:${item.stickerFieldIndex + 1}`,
        vectorFluid: true,
        ...vectorFlag,
        sourceShape: constructionKind,
        fluidEffectRole: effect.role || `pastamaker-${effectIndex + 1}`,
        fluidEffectKind: 'pastamaker',
        stickerFieldRole: sticker.role,
      });
    });
  });
  return out;
}

function isNoisySpaghettiEffect(effect) {
  const family = effect?.die?.family || effect?.family || effect?.kind || effect?.preset;
  return family === 'noisySpaghetti' || family === 'spaghetti' || family === 'strandCluster';
}

function fluidPastamakerNoisySpaghettiMarks({ effect, effectIndex, common, linePoints, zBase, t, index, vectorFlag, constructionKind }) {
  const clean = linePoints.filter(validPoint);
  if (clean.length < 2) return [];
  const field = effect.field && typeof effect.field === 'object' && !Array.isArray(effect.field)
    ? effect.field
    : {};
  const die = effect.die && typeof effect.die === 'object' && !Array.isArray(effect.die)
    ? effect.die
    : {};
  const density = Math.max(1, Math.min(80, Math.round(finiteOr(field.density ?? effect.density ?? field.count ?? effect.count, 8))));
  const lengthRange = normalizeRange(field.length ?? effect.length ?? die.length, 0.72, 1);
  const lateralRange = normalizeRange(field.lateralJitter ?? effect.lateralJitter ?? die.lateralJitter, -8, 8);
  const alignment = clamp(finiteOr(field.alignment ?? effect.alignment ?? die.alignment, 0.78), 0, 1);
  const octaves = Math.max(1, Math.min(6, Math.round(finiteOr(field.fractalOctaves ?? effect.fractalOctaves ?? die.fractalOctaves, 3))));
  const samples = Math.max(4, Math.min(80, Math.round(finiteOr(field.samples ?? effect.samples ?? die.samples, 18))));
  const wobble = clamp(finiteOr(field.wobble ?? effect.wobble ?? die.wobble, 0.55), 0, 2);
  const split = Math.max(0, Math.min(4, Math.round(finiteOr(field.fractalSplit ?? effect.fractalSplit ?? die.fractalSplit, 1))));
  const avoid = normalizeNoisySpaghettiAvoidance(field.avoid ?? effect.avoid ?? die.avoid);
  const seed = hashString(`${common.swirlGlyphSeed}:${effect.role || effectIndex}:noisySpaghetti:${density}`);
  const budget = resolveValueBudget(effect.valueBudget, {
    targetOpacity: finiteOr(effect.opacity, 0.46),
    expectedOverlapCount: Math.max(1, Math.min(density, Math.round(density / 2))),
    mode: 'inverse-count',
  });
  const opacity = opacityForBudget(budget.targetOpacity, budget.expectedOverlapCount, budget.mode);
  const roleBase = `${common.fluidGlyphRole}:${effect.role || `noisy-spaghetti-${effectIndex + 1}`}`;
  const out = [];

  for (let strandIndex = 0; strandIndex < density; strandIndex++) {
    const strandSeed = hashString(`${seed}:${strandIndex}`);
    const lengthT = clamp(lerp(lengthRange[0], lengthRange[1], seededUnit(strandSeed, 1)), 0.04, 1);
    const maxStart = Math.max(0, 1 - lengthT);
    const baseStart = maxStart <= 0 ? 0 : seededUnit(strandSeed, 2) * maxStart;
    const baseEnd = Math.min(1, baseStart + lengthT);
    const lateral = lerp(lateralRange[0], lateralRange[1], seededUnit(strandSeed, 3));
    const phase = seededUnit(strandSeed, 4) * Math.PI * 2;
    const strandPoints = noisySpaghettiPolyline({
      points: clean,
      startT: baseStart,
      endT: baseEnd,
      samples,
      lateral,
      alignment,
      octaves,
      wobble,
      phase,
      seed: strandSeed,
      avoid,
    });
    out.push({
      ...common,
      kind: 'polyline',
      role: `${roleBase}:strand-${String(strandIndex + 1).padStart(2, '0')}`,
      points: strandPoints,
      fill: 'none',
      stroke: choosePaletteValue(effect.style?.palette || field.palette || die.palette, strandIndex) ||
        effect.stroke ||
        die.stroke ||
        '#91d0c0',
      strokeWidth: finiteOr(effect.strokeWidth, finiteOr(die.strokeWidth, 1.5)),
      opacity,
      dash: effect.dash || die.dash,
      z: zBase + t * 12 + finiteOr(effect.zOffset, 0.28 + effectIndex * 0.04) + strandIndex * 0.001,
      algorithmic: true,
      algorithm: 'pastamaker',
      pass: effect.pass || 'fluid-noisy-spaghetti',
      vectorFluid: true,
      ...vectorFlag,
      sourceShape: constructionKind,
      fluidEffectRole: effect.role || `noisy-spaghetti-${effectIndex + 1}`,
      fluidEffectKind: 'pastamaker',
      stickerFieldRole: roleBase,
      stickerFieldIndex: strandIndex,
      stickerFieldCount: density,
      stickerFieldT: round(density === 1 ? 0.5 : strandIndex / (density - 1)),
      pastamaker: {
        dieFamily: 'noisySpaghetti',
        fieldKind: field.kind || 'alongFluidGlyph',
        budgetMode: budget.mode,
        targetOpacity: budget.targetOpacity,
        expectedOverlapCount: budget.expectedOverlapCount,
        density,
        length: round(lengthT),
        alignment: round(alignment),
        fractalOctaves: octaves,
        fractalSplit: split,
        collisionPolicy: avoid.length ? 'deterministic-avoidance' : undefined,
        obstacleCount: avoid.length || undefined,
      },
    });

    for (let child = 0; child < split; child++) {
      const childSeed = hashString(`${strandSeed}:child:${child}`);
      const childStart = clamp(lerp(baseStart, baseEnd, seededUnit(childSeed, 1) * 0.72), baseStart, baseEnd);
      const childLength = (baseEnd - childStart) * lerp(0.28, 0.58, seededUnit(childSeed, 2));
      const childEnd = Math.min(baseEnd, childStart + childLength);
      if (childEnd - childStart < 0.035) continue;
      const childLateral = lateral + lerp(-6, 6, seededUnit(childSeed, 3));
      out.push({
        ...common,
        kind: 'polyline',
        role: `${roleBase}:strand-${String(strandIndex + 1).padStart(2, '0')}:split-${child + 1}`,
        points: noisySpaghettiPolyline({
          points: clean,
          startT: childStart,
          endT: childEnd,
          samples: Math.max(4, Math.round(samples * 0.58)),
          lateral: childLateral,
          alignment: clamp(alignment * 0.86, 0, 1),
          octaves,
          wobble: wobble * 0.82,
          phase: phase + child * 1.7,
          seed: childSeed,
          avoid,
        }),
        fill: 'none',
        stroke: choosePaletteValue(effect.style?.splitPalette || effect.style?.palette || field.palette || die.palette, strandIndex + child + 1) ||
          effect.splitStroke ||
          effect.stroke ||
          die.stroke ||
          '#91d0c0',
        strokeWidth: Math.max(finiteOr(effect.strokeWidth, finiteOr(die.strokeWidth, 1.5)) * 0.72, 0.4),
        opacity: round(opacity * 0.72),
        dash: effect.splitDash || effect.dash || die.dash,
        z: zBase + t * 12 + finiteOr(effect.zOffset, 0.28 + effectIndex * 0.04) + strandIndex * 0.001 + (child + 1) * 0.0001,
        algorithmic: true,
        algorithm: 'pastamaker',
        pass: effect.pass || 'fluid-noisy-spaghetti',
        vectorFluid: true,
        ...vectorFlag,
        sourceShape: constructionKind,
        fluidEffectRole: effect.role || `noisy-spaghetti-${effectIndex + 1}`,
        fluidEffectKind: 'pastamaker',
        stickerFieldRole: roleBase,
        stickerFieldIndex: strandIndex,
        stickerFieldCount: density,
        stickerFieldT: round(density === 1 ? 0.5 : strandIndex / (density - 1)),
        pastamaker: {
          dieFamily: 'noisySpaghetti',
          fieldKind: field.kind || 'alongFluidGlyph',
          budgetMode: budget.mode,
          targetOpacity: budget.targetOpacity,
          expectedOverlapCount: budget.expectedOverlapCount,
          density,
          length: round(childEnd - childStart),
          alignment: round(alignment),
          fractalOctaves: octaves,
          fractalSplit: split,
          splitOf: strandIndex,
          collisionPolicy: avoid.length ? 'deterministic-avoidance' : undefined,
          obstacleCount: avoid.length || undefined,
        },
      });
    }
  }

  return out;
}

function noisySpaghettiPolyline({ points, startT, endT, samples, lateral, alignment, octaves, wobble, phase, seed, avoid = [] }) {
  const out = [];
  const span = Math.max(endT - startT, 0.001);
  for (let i = 0; i < samples; i++) {
    const u = samples === 1 ? 0.5 : i / (samples - 1);
    const sample = sampleGesture(points, startT + span * u);
    if (!sample) continue;
    const tangent = sample.tangent;
    const normal = normalize([-tangent[1], tangent[0]]);
    let noise = 0;
    let amp = 1;
    let ampTotal = 0;
    for (let octave = 0; octave < octaves; octave++) {
      const freq = 1 + octave * 1.85;
      noise += Math.sin((u * Math.PI * 2 * freq) + phase + deterministicWave(seed, octave, u) * Math.PI) * amp;
      ampTotal += amp;
      amp *= 0.52;
    }
    const normalizedNoise = ampTotal > 0 ? noise / ampTotal : 0;
    const drift = Math.sin((u + phase) * Math.PI * 2) * (1 - alignment) * 4;
    const offset = lateral + normalizedNoise * wobble * 9 + drift;
    const basePoint = [
      sample.point[0] + normal[0] * offset,
      sample.point[1] + normal[1] * offset,
    ];
    const resolvedPoint = avoid.length ? applyNoisySpaghettiAvoidance(basePoint, avoid) : basePoint;
    out.push([roundPoint(resolvedPoint[0]), roundPoint(resolvedPoint[1])]);
  }
  return out;
}

function normalizeNoisySpaghettiAvoidance(input) {
  if (!input) return [];
  const raw = Array.isArray(input) ? input : [input];
  return raw.map((obstacle, index) => {
    if (!obstacle || typeof obstacle !== 'object') return null;
    const kind = obstacle.kind || obstacle.shape || (validPoint(obstacle.center || obstacle.anchor) ? 'circle' : 'rect');
    const padding = Math.max(finiteOr(obstacle.padding, 0), 0);
    const strength = clamp(finiteOr(obstacle.strength, 1), 0, 4);
    const falloff = Math.max(finiteOr(obstacle.falloff, 18), 0);
    if (kind === 'circle' || kind === 'sphere') {
      const center = validPoint(obstacle.center || obstacle.anchor);
      if (!center) return null;
      return {
        kind: 'circle',
        role: obstacle.role || `avoid-${index + 1}`,
        center,
        radius: Math.max(finiteOr(obstacle.radius ?? obstacle.r, 24), 0) + padding,
        strength,
        falloff,
      };
    }
    const x = finiteOr(obstacle.x, finiteOr(obstacle.bounds?.x, NaN));
    const y = finiteOr(obstacle.y, finiteOr(obstacle.bounds?.y, NaN));
    const width = finiteOr(obstacle.width ?? obstacle.w, finiteOr(obstacle.bounds?.width ?? obstacle.bounds?.w, NaN));
    const height = finiteOr(obstacle.height ?? obstacle.h, finiteOr(obstacle.bounds?.height ?? obstacle.bounds?.h, NaN));
    if (![x, y, width, height].every(Number.isFinite)) return null;
    return {
      kind: 'rect',
      role: obstacle.role || `avoid-${index + 1}`,
      x: x - padding,
      y: y - padding,
      width: Math.max(width + padding * 2, 0),
      height: Math.max(height + padding * 2, 0),
      strength,
      falloff,
    };
  }).filter(Boolean);
}

function applyNoisySpaghettiAvoidance(point, obstacles) {
  let x = point[0];
  let y = point[1];
  for (const obstacle of obstacles) {
    const push = obstacle.kind === 'circle'
      ? circleAvoidanceVector([x, y], obstacle)
      : rectAvoidanceVector([x, y], obstacle);
    x += push[0];
    y += push[1];
  }
  return [x, y];
}

function circleAvoidanceVector(point, obstacle) {
  const dx = point[0] - obstacle.center[0];
  const dy = point[1] - obstacle.center[1];
  const dist = Math.hypot(dx, dy);
  const influence = obstacle.radius + obstacle.falloff;
  if (influence <= 0 || dist >= influence) return [0, 0];
  const dir = dist > 1e-6 ? [dx / dist, dy / dist] : [1, 0];
  const target = dist < obstacle.radius
    ? obstacle.radius - dist
    : (influence - dist) * 0.28;
  const amount = target * obstacle.strength;
  return [dir[0] * amount, dir[1] * amount];
}

function rectAvoidanceVector(point, obstacle) {
  const minX = obstacle.x;
  const minY = obstacle.y;
  const maxX = obstacle.x + obstacle.width;
  const maxY = obstacle.y + obstacle.height;
  const cx = clamp(point[0], minX, maxX);
  const cy = clamp(point[1], minY, maxY);
  const dx = point[0] - cx;
  const dy = point[1] - cy;
  const dist = Math.hypot(dx, dy);
  const inside = point[0] >= minX && point[0] <= maxX && point[1] >= minY && point[1] <= maxY;
  if (!inside && dist >= obstacle.falloff) return [0, 0];
  if (inside) {
    const nearest = [
      { vector: [-1, 0], amount: point[0] - minX },
      { vector: [1, 0], amount: maxX - point[0] },
      { vector: [0, -1], amount: point[1] - minY },
      { vector: [0, 1], amount: maxY - point[1] },
    ].sort((a, b) => a.amount - b.amount)[0];
    const amount = (nearest.amount + Math.max(obstacle.falloff * 0.18, 1)) * obstacle.strength;
    return [nearest.vector[0] * amount, nearest.vector[1] * amount];
  }
  if (dist <= 1e-6) return [0, 0];
  const amount = (obstacle.falloff - dist) * 0.28 * obstacle.strength;
  return [(dx / dist) * amount, (dy / dist) * amount];
}

function fluidPastamakerEffects(mark, glyph) {
  const direct = mark.effects?.pastamaker ?? mark.pastamakerEffects ?? glyph.effects?.pastamaker;
  if (!direct) return [];
  return Array.isArray(direct) ? direct.filter((effect) => effect && typeof effect === 'object') : [direct];
}

function fluidPastamakerStickerField({ effect, effectIndex, common, linePoints, head, base, radius, camera, zBase, t, index }) {
  const die = effect.die && typeof effect.die === 'object' && !Array.isArray(effect.die)
    ? effect.die
    : { family: effect.family || 'line' };
  const field = effect.field && typeof effect.field === 'object' && !Array.isArray(effect.field)
    ? effect.field
    : {};
  const family = die.family || die.kind || 'line';
  const role = `${common.fluidGlyphRole}:${effect.role || `pastamaker-${effectIndex + 1}`}`;
  const stickerBase = {
    kind: 'stickerField',
    role,
    z: zBase + t * 12 + finiteOr(effect.zOffset, 0.18 + effectIndex * 0.04),
    die,
    valueBudget: effect.valueBudget,
    opacity: effect.opacity,
    fill: effect.fill,
    stroke: effect.stroke,
    strokeWidth: effect.strokeWidth,
    blur: effect.blur,
    pass: effect.pass || `fluid-${family}`,
    style: effect.style,
  };
  if (
    field.kind === 'aroundGlyphHead' ||
    field.kind === 'aroundGlyphBase' ||
    field.kind === 'insideFluidEnvelope' ||
    field.kind === 'aroundRing' ||
    (field.kind !== 'alongPath' && field.kind !== 'alongFluidGlyph' && family !== 'line')
  ) {
    const envelopeT = clamp(finiteOr(field.t ?? field.envelopeT, common.flameGlyph ? 0.42 : 0.62), 0, 1);
    const envelopeSample = sampleGesture(linePoints, envelopeT)?.point;
    const center =
      validPoint(field.center) ||
      (field.kind === 'aroundGlyphBase' ? base : null) ||
      (field.kind === 'insideFluidEnvelope' ? envelopeSample : null) ||
      head;
    const ringRadius = field.radius || [
      Math.max(roundPoint(radius * camera.unitScale * 0.2), 2),
      Math.max(roundPoint(radius * camera.unitScale * 1.15), 4),
    ];
    return {
      ...stickerBase,
      field: {
        ...field,
        kind: 'aroundRing',
        center,
        radius: ringRadius,
        count: Math.max(1, Math.min(120, Math.round(finiteOr(field.count ?? effect.count, family === 'line' ? 4 : 6)))),
      },
    };
  }
  return {
    ...stickerBase,
    die: {
      ...die,
      family: family === 'line' ? 'line' : family,
    },
    field: {
      ...field,
      kind: 'alongPath',
      points: linePoints,
      count: Math.max(1, Math.min(120, Math.round(finiteOr(field.count ?? effect.count, 4)))),
      lateralJitter: field.lateralJitter || effect.lateralJitter || [-4, 4],
      alongJitter: field.alongJitter ?? effect.alongJitter ?? 0.08,
    },
  };
}

function swirlGlyphWorldPoint({ center, flow, cross, lift, u, radius, tailLength, turns, startAngle, handedness, seed }) {
  const wave = deterministicWave(seed, 0, u * Math.PI * 2) * radius * 0.08;
  if (u < 0.28) {
    const q = u / 0.28;
    const tail = -tailLength * (1 - q);
    const side = Math.sin(q * Math.PI) * radius * 0.18 * handedness + wave;
    return add3(center, add3(scale3(flow, tail), scale3(cross, side)));
  }
  const q = (u - 0.28) / 0.72;
  const angle = startAngle + handedness * turns * Math.PI * 2 * q;
  const r = radius * (1 - q * 0.66);
  const x = Math.cos(angle) * r + wave;
  const y = Math.sin(angle) * r * 0.78;
  const curlLift = Math.sin(q * Math.PI) * radius * 0.16;
  return add3(center, add3(scale3(cross, x), add3(scale3(flow, y), scale3(lift, curlLift))));
}

function resolveSwirlHandedness(mode, index, seed) {
  if (mode === 'clockwise') return -1;
  if (mode === 'counterclockwise') return 1;
  if (mode === 'random' || mode === 'seeded') return seededUnit(seed, 10) > 0.5 ? 1 : -1;
  return index % 2 === 0 ? 1 : -1;
}

function numericRange(value, fallbackA, fallbackB) {
  if (Array.isArray(value) && value.length >= 2) {
    return [finiteOr(value[0], fallbackA), finiteOr(value[1], fallbackB)];
  }
  if (Number.isFinite(Number(value))) return [Number(value), Number(value)];
  return [fallbackA, fallbackB];
}

function lerpRange(value, fallbackA, fallbackB, t) {
  const range = numericRange(value, fallbackA, fallbackB);
  return lerp(range[0], range[1], t);
}

function seededUnit(seed, salt = 0) {
  const next = hashString(`${seed}:${salt}`);
  return (next % 1000003) / 1000003;
}

function validVector3(point) {
  return Array.isArray(point) && point.length >= 3 &&
    Number.isFinite(Number(point[0])) &&
    Number.isFinite(Number(point[1])) &&
    Number.isFinite(Number(point[2]))
    ? [Number(point[0]), Number(point[1]), Number(point[2])]
    : null;
}

function add3(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale3(v, scalar) {
  return [v[0] * scalar, v[1] * scalar, v[2] * scalar];
}

function midpoint(a, b) {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function expandMandalaFieldMark(mark, manifest = {}) {
  const field = mark.field && typeof mark.field === 'object' && !Array.isArray(mark.field)
    ? mark.field
    : mark;
  const paths = Array.isArray(field.paths)
    ? field.paths
    : Array.isArray(mark.paths) ? mark.paths : [];
  if (!paths.length) {
    throw new Error(`mandalaField '${mark.role || '(anonymous)'}' requires paths`);
  }
  const role = mark.role || 'mandala-field';
  const viewBox = mark.viewBox && typeof mark.viewBox === 'object'
    ? mark.viewBox
    : manifest.viewBox && typeof manifest.viewBox === 'object' ? manifest.viewBox : {};
  const camera = {
    screenOrigin: validPoint(field.screenOrigin || mark.screenOrigin) || [finiteOr(viewBox.width, 800) / 2, finiteOr(viewBox.height, 520) * 0.74],
    east: validPoint(field.east || mark.east) || [1, 0],
    north: validPoint(field.north || mark.north) || [0, -1],
    zenith: validPoint(field.zenith || mark.zenith) || [0, -1],
    unitScale: finiteOr(field.unitScale ?? mark.unitScale, 24),
    depthScale: clamp(finiteOr(field.depthScale ?? mark.depthScale, 0.94), 0.2, 1),
  };
  const out = [];
  paths.forEach((path, pathIndex) => {
    const samples = mandalaPathSamples(path, pathIndex, manifest, mark);
    out.push(...mandalaDebugInsetMarks({ mark, field, path, pathIndex, role, samples }));
    samples.forEach((sample, sampleIndex) => {
      out.push(...mandalaSpawnMarks({
        mark,
        path,
        role,
        pathIndex,
        sample,
        sampleIndex,
        camera,
        manifest,
      }));
    });
  });
  return out;
}

function mandalaDebugInsetMarks({ mark, field, path, pathIndex, role, samples }) {
  const inset = path.debugInset || field.debugInset || mark.debugInset;
  if (!inset || inset.visible === false || !Array.isArray(samples) || samples.length === 0) return [];
  const origin = validPoint(inset.origin) || [70, 64 + pathIndex * 74];
  const scale = finiteOr(inset.scale, 5);
  const stroke = inset.stroke || '#6d5945';
  const fill = inset.fill || '#c94f32';
  const opacity = inset.opacity ?? 0.72;
  const z = finiteOr(inset.z, 940 + pathIndex * 0.1);
  const points = samples.map((sample) => [
    roundPoint(origin[0] + finiteOr(sample.point?.[0], 0) * scale),
    roundPoint(origin[1] + finiteOr(sample.point?.[1], 0) * scale),
  ]);
  const out = [{
    kind: 'polyline',
    role: `mandala-debug:${role}:${path.role || pathIndex + 1}:path`,
    points,
    stroke,
    strokeWidth: finiteOr(inset.strokeWidth, 1),
    fill: 'none',
    opacity,
    z,
    constructionKind: 'mandalaField',
    constructionRole: role,
    mandalaDebugInset: true,
    mandalaFieldRole: role,
    mandalaPathRole: path.role || `path-${pathIndex + 1}`,
  }];
  samples.forEach((sample, index) => {
    out.push({
      kind: 'circle',
      role: `mandala-debug:${role}:${path.role || pathIndex + 1}:sample-${index + 1}`,
      cx: points[index][0],
      cy: points[index][1],
      r: finiteOr(inset.r, 2.5),
      fill,
      stroke: inset.pointStroke || '#ffffff',
      strokeWidth: 0.5,
      opacity,
      z: z + 0.01 + index * 0.001,
      constructionKind: 'mandalaField',
      constructionRole: role,
      mandalaDebugInset: true,
      mandalaFieldRole: role,
      mandalaPathRole: path.role || `path-${pathIndex + 1}`,
      mandalaSampleIndex: index,
      mandalaWorldXY: sample.point.map(roundPoint),
    });
  });
  if (inset.label !== false) {
    out.push({
      kind: 'text',
      role: `mandala-debug:${role}:${path.role || pathIndex + 1}:label`,
      x: origin[0],
      y: origin[1] - 9,
      value: inset.label || `${path.role || role} z=0`,
      size: finiteOr(inset.labelSize, 10),
      anchor: 'start',
      color: inset.labelColor || '#4a3d31',
      opacity: inset.labelOpacity ?? 0.82,
      z: z + 0.04,
      mandalaDebugInset: true,
      mandalaFieldRole: role,
      mandalaPathRole: path.role || `path-${pathIndex + 1}`,
    });
  }
  return out;
}

function mandalaPathSamples(path = {}, pathIndex = 0, manifest = {}, mark = {}) {
  const basis = path.basis || path.kind || 'ray';
  const pinTargets = mandalaPinTargets(path, manifest, mark);
  const count = Math.max(1, Math.min(240, Math.round(finiteOr(path.samples ?? path.count, pinTargets.length || 8))));
  if (basis === 'lattice' || basis === 'grid') return mandalaLatticeSamples(path, count);
  const out = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    let point;
    let tangent;
    if (basis === 'arc') {
      const center = validPoint(path.center) || [0, 0];
      const radius = Math.max(finiteOr(path.radius, 5), 0.001);
      const start = finiteOr(path.startAngle, finiteOr(path.start, 0));
      const end = finiteOr(path.endAngle, finiteOr(path.end, Math.PI));
      const a = start + (end - start) * t;
      point = [center[0] + Math.cos(a) * radius, center[1] + Math.sin(a) * radius];
      tangent = normalize([-Math.sin(a), Math.cos(a)]);
    } else if (basis === 'spiral') {
      const center = validPoint(path.center) || [0, 0];
      const turns = finiteOr(path.turns, 1.5);
      const radius0 = finiteOr(path.radiusStart ?? path.innerRadius, 1);
      const radius1 = finiteOr(path.radiusEnd ?? path.outerRadius, 8);
      const a = finiteOr(path.startAngle, 0) + turns * Math.PI * 2 * t;
      const r = lerp(radius0, radius1, t);
      point = [center[0] + Math.cos(a) * r, center[1] + Math.sin(a) * r];
      tangent = normalize([-Math.sin(a), Math.cos(a)]);
    } else {
      const from = validPoint(path.from) || [0, 0];
      const to = validPoint(path.to) || [0, -8];
      point = lerpPoint(from, to, t);
      tangent = normalize([to[0] - from[0], to[1] - from[1]]);
    }
    const normal = [-tangent[1], tangent[0]];
    out.push(mandalaSampleWithSpread({ path, point, tangent, normal, t, index: i, count, pathIndex, pinTarget: pinTargets[i] }));
  }
  return out;
}

function mandalaLatticeSamples(path, countFallback) {
  const cols = Math.max(1, Math.min(40, Math.round(finiteOr(path.cols ?? path.columns, Math.sqrt(countFallback)))));
  const rows = Math.max(1, Math.min(40, Math.round(finiteOr(path.rows, Math.ceil(countFallback / cols)))));
  const origin = validPoint(path.origin || path.from) || [0, 0];
  const step = validPoint(path.step) || [finiteOr(path.stepX, 2), finiteOr(path.stepY, -2)];
  const rowStep = validPoint(path.rowStep) || [finiteOr(path.rowStepX, 0), finiteOr(path.rowStepY, -2)];
  const out = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      const point = [
        origin[0] + step[0] * col + rowStep[0] * row,
        origin[1] + step[1] * col + rowStep[1] * row,
      ];
      const t = rows <= 1 ? 0.5 : row / (rows - 1);
      out.push({
        point,
        tangent: normalize(step),
        normal: normalize([-step[1], step[0]]),
        t,
        index,
        count: cols * rows,
        col,
        row,
        scale: mandalaScaleAt(path, t, index),
        variation: mandalaVariation(path, t, index),
      });
    }
  }
  return out;
}

function mandalaSampleWithSpread({ path, point, tangent, normal, t, index, count, pathIndex, pinTarget = null }) {
  let next = point;
  const spread = path.spread;
  if (spread && typeof spread === 'object' && !Array.isArray(spread)) {
    const span = Array.isArray(spread.x) ? spread.x : [-finiteOr(spread.amount, 0), finiteOr(spread.amount, 0)];
    const lanes = Math.max(1, Math.round(finiteOr(spread.lanes, count)));
    const laneT = lanes <= 1 ? 0.5 : (index % lanes) / (lanes - 1);
    const offset = spread.mode === 'paired'
      ? (index % 2 === 0 ? finiteOr(span[0], 0) : finiteOr(span[1], 0))
      : lerp(finiteOr(span[0], 0), finiteOr(span[1], 0), laneT);
    next = [point[0] + normal[0] * offset, point[1] + normal[1] * offset];
  }
  return {
    point: next,
    tangent,
    normal,
    t,
    index,
    count,
    pinTarget,
    scale: mandalaScaleAt(path, t, index),
    variation: mandalaVariation(path, t, index + pathIndex * 97),
  };
}

function mandalaScaleAt(path, t, index) {
  const from = finiteOr(path.scaleFrom, finiteOr(path.scale, 1));
  const to = finiteOr(path.scaleTo, from);
  const base = lerp(from, to, t);
  const wobble = finiteOr(path.scaleWobble, 0);
  return Math.max(base + Math.sin(index * 2.399) * wobble, 0.05);
}

function mandalaVariation(path, t, index) {
  const heightRange = Array.isArray(path.heightRange) ? path.heightRange : null;
  const widthRange = Array.isArray(path.widthRange) ? path.widthRange : null;
  const depthRange = Array.isArray(path.depthRange) ? path.depthRange : null;
  return {
    height: heightRange ? lerp(finiteOr(heightRange[0], 1), finiteOr(heightRange[1], 1), pseudoWave(t, index)) : undefined,
    width: widthRange ? lerp(finiteOr(widthRange[0], 1), finiteOr(widthRange[1], 1), pseudoWave(t, index + 11)) : undefined,
    depth: depthRange ? lerp(finiteOr(depthRange[0], 1), finiteOr(depthRange[1], 1), pseudoWave(t, index + 23)) : undefined,
  };
}

function pseudoWave(t, index) {
  return clamp(0.5 + Math.sin(t * Math.PI * 2 + index * 1.618) * 0.5, 0, 1);
}

function mandalaSpawnMarks({ mark, path, role, pathIndex, sample, sampleIndex, camera, manifest = {} }) {
  const template = path.spawn || mark.spawn || {};
  const kind = template.kind || 'solid';
  const pin = resolveMandalaPin({ mark, path, sample, sampleIndex, manifest });
  const screen = pin?.screen || projectMandalaScreen(camera, sample.point, finiteOr(template.altitude ?? template.z, 0));
  const scale = sample.scale;
  const spawnRole = `${path.role || `${role}-path-${pathIndex + 1}`}-${sampleIndex + 1}`;
  const common = {
    ...template,
    role: template.role ? `${template.role}-${sampleIndex + 1}` : spawnRole,
    mandalaFieldRole: role,
    mandalaPathRole: path.role || `path-${pathIndex + 1}`,
    mandalaSampleIndex: sampleIndex,
    mandalaSampleCount: sample.count,
    mandalaWorldXY: sample.point.map(roundPoint),
    mandalaT: round(sample.t),
    mandalaScale: round(scale),
    mandalaPinned: Boolean(pin),
    mandalaPinRole: pin?.role,
    mandalaPinBounds: pin?.bounds,
    mandalaPinAnchor: pin?.anchor,
    mandalaPinMode: pin?.mode,
    z: finiteOr(template.z, finiteOr(mark.z, 20) + pathIndex + sampleIndex * 0.01),
  };
  if (kind === 'solid') {
    const boundSize = mandalaPinnedSolidSize(pin, template);
    const w = finiteOr(boundSize?.width, finiteOr(sample.variation.width, finiteOr(template.width ?? template.w, 18)) * scale);
    const h = finiteOr(boundSize?.height, finiteOr(sample.variation.height, finiteOr(template.height ?? template.h, 52)) * scale);
    const d = finiteOr(boundSize?.depth, finiteOr(sample.variation.depth, finiteOr(template.depth ?? template.d, 18)) * scale);
    return [{
      ...common,
      kind: 'solid',
      x: roundPoint(screen[0] - w / 2),
      y: roundPoint(screen[1] - h),
      width: Math.max(roundPoint(w), 1),
      height: Math.max(roundPoint(h), 1),
      depth: Math.max(roundPoint(d), 1),
      constructionKind: 'mandalaField',
      constructionRole: role,
    }];
  }
  if (kind === 'blob' || kind === 'sphere' || kind === 'oval') {
    return [{
      ...common,
      kind,
      anchor: screen.map(roundPoint),
      rx: Math.max(finiteOr(template.rx, finiteOr(template.r, 14)) * scale, 1),
      ry: Math.max(finiteOr(template.ry, finiteOr(template.r, 14)) * scale, 1),
      constructionKind: 'mandalaField',
      constructionRole: role,
    }];
  }
  if (kind === 'line') {
    const length = finiteOr(template.length, 40) * scale;
    const tangent = sample.tangent || [0, -1];
    return [{
      ...common,
      kind: 'line',
      x1: roundPoint(screen[0] - tangent[0] * length / 2),
      y1: roundPoint(screen[1] - tangent[1] * length / 2),
      x2: roundPoint(screen[0] + tangent[0] * length / 2),
      y2: roundPoint(screen[1] + tangent[1] * length / 2),
      constructionKind: 'mandalaField',
      constructionRole: role,
    }];
  }
  throw new Error(`mandalaField '${role}' unsupported spawn kind '${kind}'`);
}

function mandalaPinTargets(path = {}, manifest = {}, mark = {}) {
  const pin = path.pinTo || path.bindTo || mark.pinTo || mark.bindTo;
  if (!pin || typeof pin !== 'object' || Array.isArray(pin)) return [];
  const constellation = manifest?.polygonizer?.constellation;
  const nodes = Array.isArray(constellation?.nodes) ? constellation.nodes : [];
  if (!nodes.length) return [];
  const roles = Array.isArray(pin.roles) ? pin.roles.map(String) : [];
  if (roles.length) {
    const byRole = new Map(nodes.map((node) => [node?.role, node]));
    return roles.map((role) => byRole.get(role)).filter(Boolean);
  }
  const prefix = typeof pin.rolePrefix === 'string' ? pin.rolePrefix : null;
  const pattern = typeof pin.rolePattern === 'string' ? new RegExp(pin.rolePattern) : null;
  const depthBands = Array.isArray(pin.depthBands) ? new Set(pin.depthBands.map(String)) : null;
  return nodes.filter((node) => {
    if (!node?.role) return false;
    if (prefix && !String(node.role).startsWith(prefix)) return false;
    if (pattern && !pattern.test(String(node.role))) return false;
    if (depthBands && !depthBands.has(String(node.depthBand))) return false;
    return prefix || pattern || depthBands;
  });
}

function resolveMandalaPin({ mark, path, sample, sampleIndex, manifest }) {
  const pin = path.pinTo || path.bindTo || mark.pinTo || mark.bindTo;
  if (!pin || typeof pin !== 'object' || Array.isArray(pin)) return null;
  const targets = sample.pinTarget ? [sample.pinTarget] : mandalaPinTargets(path, manifest, mark);
  const node = targets[sample.pinTarget ? 0 : sampleIndex % Math.max(targets.length, 1)];
  if (!node) return null;
  const bounds = node.bounds && typeof node.bounds === 'object' ? node.bounds : null;
  const anchor = mandalaNodePinAnchor(node, pin.anchor || pin.anchorMode || 'bottom-center');
  if (!anchor) return null;
  return {
    role: node.role,
    bounds: bounds ? roundMandalaBounds(bounds) : undefined,
    anchor: anchor.map(roundPoint),
    screen: anchor.map(roundPoint),
    mode: pin.kind || pin.mode || 'constellation-node',
    node,
    pin,
  };
}

function mandalaNodePinAnchor(node, mode) {
  const bounds = node?.bounds;
  if (!bounds || !Number.isFinite(Number(bounds.x)) || !Number.isFinite(Number(bounds.y))) {
    return validPoint(node?.anchor) || validPoint(node?.cca?.center);
  }
  const x = finiteOr(bounds.x, 0);
  const y = finiteOr(bounds.y, 0);
  const w = finiteOr(bounds.width, 0);
  const h = finiteOr(bounds.height, 0);
  if (mode === 'center') return [x + w / 2, y + h / 2];
  if (mode === 'top-center') return [x + w / 2, y];
  if (mode === 'anchor') return validPoint(node.anchor) || [x + w / 2, y + h];
  return [x + w / 2, y + h];
}

function roundMandalaBounds(bounds) {
  return {
    x: roundPoint(bounds.x),
    y: roundPoint(bounds.y),
    width: roundPoint(bounds.width),
    height: roundPoint(bounds.height),
  };
}

function mandalaPinnedSolidSize(pin, template) {
  const bounds = pin?.bounds;
  const mode = pin?.pin?.fit || pin?.pin?.sizeMode || template.fit || template.sizeMode;
  if (!bounds || (mode !== 'bounds' && mode !== 'constellation-bounds' && mode !== 'cell')) return null;
  const widthRatio = finiteOr(template.widthRatio ?? pin.pin?.widthRatio, 0.72);
  const heightRatio = finiteOr(template.heightRatio ?? pin.pin?.heightRatio, 0.78);
  const depthRatio = finiteOr(template.depthRatio ?? pin.pin?.depthRatio, 0.34);
  return {
    width: Math.max(roundPoint(bounds.width * widthRatio), 1),
    height: Math.max(roundPoint(bounds.height * heightRatio), 1),
    depth: Math.max(roundPoint(Math.min(bounds.width, bounds.height) * depthRatio), 1),
  };
}

function projectMandalaScreen(camera, point, altitude = 0) {
  const east = normalize(validPoint(camera.east) || [1, 0]);
  const north = normalize(validPoint(camera.north) || [0, -1]);
  const zenith = normalize(validPoint(camera.zenith) || [0, -1]);
  const unitScale = finiteOr(camera.unitScale, 24);
  const x = finiteOr(point?.[0], 0);
  const y = finiteOr(point?.[1], 0);
  const compression = mandalaPerspectiveScale(camera, point);
  return [
    roundPoint(camera.screenOrigin[0] + east[0] * x * unitScale + north[0] * y * unitScale * compression + zenith[0] * altitude * unitScale),
    roundPoint(camera.screenOrigin[1] + east[1] * x * unitScale + north[1] * y * unitScale * compression + zenith[1] * altitude * unitScale),
  ];
}

function mandalaPerspectiveScale(camera, point) {
  const depthScale = clamp(finiteOr(camera.depthScale, 0.94), 0.2, 1);
  const y = finiteOr(point?.[1], 0);
  return Math.pow(depthScale, Math.max(0, -y));
}

function expandStickerFieldMark(mark, byRole, scene = {}) {
  const field = mark.field && typeof mark.field === 'object' ? mark.field : {};
  const die = mark.die && typeof mark.die === 'object' ? mark.die : {};
  const family = die.family || die.kind;
  const bubbling = isBubblingFamily(family);
  const iguana = isIguanaFamily(family);
  const stringSpawn = isStringSpawnFamily(family);
  if (
    (field.kind !== 'aroundRing' || (family !== 'arcPatch' && family !== 'line' && family !== 'spikeBanana' && family !== 'fuzzyPeach')) &&
    (field.kind !== 'alongPath' || (family !== 'line' && !bubbling && !stringSpawn)) &&
    ((field.kind !== 'fillBox' && field.kind !== 'insideRect' && field.kind !== 'box' && field.kind !== 'outwardFill' && field.kind !== 'constellationFill') || (!bubbling && !iguana))
  ) {
    throw new Error(
      `stickerField '${mark.role || '(anonymous)'}' only supports aroundRing/arcPatch, aroundRing/line, aroundRing/spikeBanana, aroundRing/fuzzyPeach, alongPath/line, alongPath/bubbling, alongPath/stringSpawn, or fillBox/bubbling in this spike`,
    );
  }
  if (stringSpawn) return expandAlongPathStringSpawnField(mark, field, die, scene);
  if (bubbling) {
    if (field.kind === 'alongPath') return expandAlongPathBubblingField(mark, field, die);
    if (field.kind === 'outwardFill' || field.kind === 'constellationFill') return expandOutwardBubblingField(mark, field, die);
    return expandFillBoxBubblingField(mark, field, die);
  }
  if (iguana) {
    return expandIguanaField(mark, field, die);
  }
  if (field.kind === 'alongPath') {
    return expandAlongPathLineField(mark, field, die);
  }
  if (family === 'fuzzyPeach') {
    return expandAroundRingFuzzyPeachField(mark, field, die, byRole);
  }
  if (family === 'spikeBanana') {
    return expandAroundRingSpikeBananaField(mark, field, die, byRole);
  }
  return family === 'line'
    ? expandAroundRingLineField(mark, field, die, byRole)
    : expandAroundRingArcPatchField(mark, field, die, byRole);
}

function isBubblingFamily(family) {
  return family === 'bubbling' || family === 'bubble' || family === 'kingKrispies' || family === 'king-krispies';
}

function isKingKrispiesFamily(family) {
  return family === 'kingKrispies' || family === 'king-krispies';
}

function isIguanaFamily(family) {
  return family === 'iguana' || family === 'iguanaBubbles' || family === 'iguana-bubbles';
}

function isStringSpawnFamily(family) {
  return family === 'stringSpawn' || family === 'string-spawn' || family === 'stringsWithGlyphs';
}

function expandAroundRingArcPatchField(mark, field, die, byRole) {
  const basis = aroundRingBasis(mark, field, byRole);
  const { center, innerRadius, outerRadius, count } = basis;
  const arcRange = normalizeRange(die.arc, 0.03, 0.1);
  const thicknessRange = normalizeRange(die.thickness, 6, Math.max(8, (outerRadius - innerRadius) * 0.45));
  const wobble = clamp(finiteOr(die.wobble, 0), 0, 0.8);
  const pointCount = Math.max(3, Math.min(18, Math.round(finiteOr(die.points, 6))));
  const budget = resolveValueBudget(mark.valueBudget, {
    targetOpacity: finiteOr(mark.opacity, 0.72),
    expectedOverlapCount: Math.max(1, Math.min(count, Math.round(count / 6))),
    mode: 'inverse-count',
  });
  const opacity = opacityForBudget(budget.targetOpacity, budget.expectedOverlapCount, budget.mode);
  const seed = hashString(`${mark.role || 'stickerField'}:${count}:${center.join(',')}`);
  const out = [];

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : (i + 0.5) / count;
    const wave = deterministicWave(seed, i, t);
    const angleFraction = wrap01(t + wave * wobble * 0.018);
    const angle = -Math.PI / 2 + angleFraction * Math.PI * 2;
    const bias = fieldBiasAt(field.bias, angleFraction);
    const arcFraction = lerp(arcRange[0], arcRange[1], wrap01(t * 1.618 + wave * 0.07));
    const arc = arcFraction * Math.PI * 2 * lerp(0.85, 1.15, bias.strength);
    const thickness = Math.min(
      outerRadius - innerRadius,
      lerp(thicknessRange[0], thicknessRange[1], wrap01(t * 2.414 - wave * 0.05)) * lerp(1, 1.28, bias.strength),
    );
    const midRadius = clamp(
      lerp(innerRadius + thickness / 2, outerRadius - thickness / 2, wrap01(t * 1.31 + wave * 0.11)),
      innerRadius + thickness / 2,
      outerRadius - thickness / 2,
    );
    const patchInner = Math.max(innerRadius, midRadius - thickness / 2);
    const patchOuter = Math.min(outerRadius, midRadius + thickness / 2);
    const start = angle - arc / 2;
    const end = angle + arc / 2;
    const fill = choosePaletteValue(mark.style?.palette || field.palette || die.palette, i) ||
      mark.fill ||
      die.fill ||
      '#f49a34';
    out.push({
      kind: 'polygon',
      closed: true,
      role: `${mark.role || 'sticker-field'}:${String(i + 1).padStart(2, '0')}`,
      points: annularPatchPoints(center, patchInner, patchOuter, start, end, pointCount),
      fill,
      stroke: mark.stroke || die.stroke || 'none',
      strokeWidth: finiteOr(mark.strokeWidth, finiteOr(die.strokeWidth, 0)),
      opacity,
      z: finiteOr(mark.z, 20) + i * 0.002,
      algorithmic: true,
      algorithm: 'pastamaker',
      pass: mark.pass || 'sticker-field',
      pastamaker: {
        dieFamily: 'arcPatch',
        fieldKind: 'aroundRing',
        budgetMode: budget.mode,
        targetOpacity: budget.targetOpacity,
        expectedOverlapCount: budget.expectedOverlapCount,
      },
      stickerFieldRole: mark.role,
      stickerFieldIndex: i,
      stickerFieldCount: count,
      stickerFieldT: round(t),
    });
  }

  return out;
}

function expandAroundRingLineField(mark, field, die, byRole) {
  const basis = aroundRingBasis(mark, field, byRole);
  const { center, innerRadius, outerRadius, count } = basis;
  const lengthRange = normalizeRange(die.length, 14, 44);
  const radialJitter = clamp(finiteOr(die.radialJitter, 0.18), 0, 1);
  const wobble = clamp(finiteOr(die.wobble, 0), 0, 0.8);
  const budget = resolveValueBudget(mark.valueBudget, {
    targetOpacity: finiteOr(mark.opacity, 0.58),
    expectedOverlapCount: Math.max(1, Math.min(count, Math.round(count / 10))),
    mode: 'inverse-count',
  });
  const opacity = opacityForBudget(budget.targetOpacity, budget.expectedOverlapCount, budget.mode);
  const seed = hashString(`${mark.role || 'stickerField'}:line:${count}:${center.join(',')}`);
  const out = [];

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : (i + 0.5) / count;
    const wave = deterministicWave(seed, i, t);
    const angleFraction = wrap01(t + wave * wobble * 0.018);
    const angle = -Math.PI / 2 + angleFraction * Math.PI * 2;
    const bias = fieldBiasAt(field.bias, angleFraction);
    const radiusT = wrap01(t * 1.79 + wave * radialJitter * 0.1);
    const radius = lerp(innerRadius, outerRadius, radiusT);
    const length = lerp(lengthRange[0], lengthRange[1], wrap01(t * 2.07 + wave * 0.05)) *
      lerp(1, 1.22, bias.strength);
    const tangent = normalize([-Math.sin(angle), Math.cos(angle)]);
    const radial = normalize([Math.cos(angle), Math.sin(angle)]);
    const mode = die.orientation || field.rotation || 'tangent';
    const dir = mode === 'radial' ? radial : tangent;
    const cx = center[0] + Math.cos(angle) * radius;
    const cy = center[1] + Math.sin(angle) * radius;
    out.push({
      kind: 'line',
      role: `${mark.role || 'sticker-field'}:${String(i + 1).padStart(2, '0')}`,
      x1: roundPoint(cx - dir[0] * length / 2),
      y1: roundPoint(cy - dir[1] * length / 2),
      x2: roundPoint(cx + dir[0] * length / 2),
      y2: roundPoint(cy + dir[1] * length / 2),
      stroke: choosePaletteValue(mark.style?.palette || field.palette || die.palette, i) ||
        mark.stroke ||
        die.stroke ||
        '#ffe3b8',
      strokeWidth: finiteOr(mark.strokeWidth, finiteOr(die.strokeWidth, 2)),
      opacity,
      z: finiteOr(mark.z, 40) + i * 0.002,
      algorithmic: true,
      algorithm: 'pastamaker',
      pass: mark.pass || 'highlight-stroke',
      pastamaker: {
        dieFamily: 'line',
        fieldKind: 'aroundRing',
        budgetMode: budget.mode,
        targetOpacity: budget.targetOpacity,
        expectedOverlapCount: budget.expectedOverlapCount,
      },
      stickerFieldRole: mark.role,
      stickerFieldIndex: i,
      stickerFieldCount: count,
      stickerFieldT: round(t),
    });
  }

  return out;
}

function expandAroundRingSpikeBananaField(mark, field, die, byRole) {
  const basis = aroundRingBasis(mark, field, byRole);
  const { center, innerRadius, outerRadius, count } = basis;
  const arcRange = normalizeRange(die.arc, 0.018, 0.08);
  const thicknessRange = normalizeRange(die.thickness, 8, Math.max(10, (outerRadius - innerRadius) * 0.36));
  const wobble = clamp(finiteOr(die.wobble, 0.2), 0, 0.8);
  const spike = clamp(finiteOr(die.spike, 0.22), 0, 0.9);
  const spikeJitter = clamp(finiteOr(die.spikeJitter, 0.28), 0, 1);
  const rotationJitter = clamp(finiteOr(die.rotationJitter, finiteOr(field.rotationJitter, 0)), 0, Math.PI);
  const taper = die.taper || 'even';
  const pointCount = Math.max(4, Math.min(24, Math.round(finiteOr(die.points, 8))));
  const budget = resolveValueBudget(mark.valueBudget, {
    targetOpacity: finiteOr(mark.opacity, 0.62),
    expectedOverlapCount: Math.max(1, Math.min(count, Math.round(count / 8))),
    mode: 'inverse-count',
  });
  const opacity = opacityForBudget(budget.targetOpacity, budget.expectedOverlapCount, budget.mode);
  const seed = hashString(`${mark.role || 'stickerField'}:spikeBanana:${count}:${center.join(',')}`);
  const out = [];

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : (i + 0.5) / count;
    const wave = deterministicWave(seed, i, t);
    const angleFraction = wrap01(t + wave * wobble * 0.018);
    const angle = -Math.PI / 2 + angleFraction * Math.PI * 2 + wave * rotationJitter;
    const bias = fieldBiasAt(field.bias, angleFraction);
    const spikeForSticker = clamp(spike * lerp(1 - spikeJitter * 0.45, 1 + spikeJitter * 0.55, wrap01(t * 1.91 + wave * 0.13)), 0, 0.95);
    const arcFraction = lerp(arcRange[0], arcRange[1], wrap01(t * 1.47 + wave * 0.07));
    const arc = arcFraction * Math.PI * 2 * lerp(0.9, 1.22, bias.strength);
    const thickness = Math.min(
      outerRadius - innerRadius,
      lerp(thicknessRange[0], thicknessRange[1], wrap01(t * 2.21 - wave * 0.06)) * lerp(1, 1.25, bias.strength),
    );
    const midRadius = clamp(
      lerp(innerRadius + thickness / 2, outerRadius - thickness / 2, wrap01(t * 1.23 + wave * 0.1)),
      innerRadius + thickness / 2,
      outerRadius - thickness / 2,
    );
    const start = angle - arc / 2;
    const end = angle + arc / 2;
    const fill = choosePaletteValue(mark.style?.palette || field.palette || die.palette, i) ||
      mark.fill ||
      die.fill ||
      '#ff9f39';
    out.push({
      kind: 'polygon',
      closed: true,
      role: `${mark.role || 'sticker-field'}:${String(i + 1).padStart(2, '0')}`,
      points: spikeBananaPoints({
        center,
        radius: midRadius,
        thickness,
        start,
        end,
        pointCount,
        spike: spikeForSticker,
        taper,
        seed,
        index: i,
      }),
      fill,
      stroke: mark.stroke || die.stroke || 'none',
      strokeWidth: finiteOr(mark.strokeWidth, finiteOr(die.strokeWidth, 0)),
      blur: die.blur ?? mark.blur,
      opacity,
      z: finiteOr(mark.z, 20) + i * 0.002,
      algorithmic: true,
      algorithm: 'pastamaker',
      pass: mark.pass || 'sticker-field',
      pastamaker: {
        dieFamily: 'spikeBanana',
        fieldKind: 'aroundRing',
        budgetMode: budget.mode,
        targetOpacity: budget.targetOpacity,
        expectedOverlapCount: budget.expectedOverlapCount,
      },
      stickerFieldRole: mark.role,
      stickerFieldIndex: i,
      stickerFieldCount: count,
      stickerFieldT: round(t),
    });
  }

  return out;
}

function expandAroundRingFuzzyPeachField(mark, field, die, byRole) {
  const basis = aroundRingBasis(mark, field, byRole);
  const { center, innerRadius, outerRadius, count } = basis;
  const radiusRange = normalizeRange(die.radius, 5, 18);
  const aspectRange = normalizeRange(die.aspect, 0.78, 1.22);
  const fuzz = clamp(finiteOr(die.fuzz, 0.18), 0, 0.8);
  const radialJitter = clamp(finiteOr(die.radialJitter, 0.18), 0, 1);
  const rotationJitter = clamp(finiteOr(die.rotationJitter, finiteOr(field.rotationJitter, 0.35)), 0, Math.PI);
  const pointCount = Math.max(10, Math.min(48, Math.round(finiteOr(die.points, 20))));
  const budget = resolveValueBudget(mark.valueBudget, {
    targetOpacity: finiteOr(mark.opacity, 0.44),
    expectedOverlapCount: Math.max(1, Math.min(count, Math.round(count / 10))),
    mode: 'inverse-count',
  });
  const opacity = opacityForBudget(budget.targetOpacity, budget.expectedOverlapCount, budget.mode);
  const seed = hashString(`${mark.role || 'stickerField'}:fuzzyPeach:${count}:${center.join(',')}`);
  const out = [];

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : (i + 0.5) / count;
    const wave = deterministicWave(seed, i, t);
    const angleFraction = wrap01(t + wave * fuzz * 0.018);
    const angle = -Math.PI / 2 + angleFraction * Math.PI * 2;
    const bias = fieldBiasAt(field.bias, angleFraction);
    const radiusT = wrap01(t * 1.53 + wave * radialJitter * 0.1);
    const bandRadius = lerp(innerRadius, outerRadius, radiusT);
    const peachR = lerp(radiusRange[0], radiusRange[1], wrap01(t * 2.11 + wave * 0.06)) *
      lerp(1, 1.2, bias.strength);
    const aspect = lerp(aspectRange[0], aspectRange[1], wrap01(t * 1.37 - wave * 0.08));
    const anchor = [
      center[0] + Math.cos(angle) * bandRadius,
      center[1] + Math.sin(angle) * bandRadius,
    ];
    const rotation = angle + Math.PI / 2 + wave * rotationJitter;
    const fill = choosePaletteValue(mark.style?.palette || field.palette || die.palette, i) ||
      mark.fill ||
      die.fill ||
      '#ffd071';
    out.push({
      kind: 'polygon',
      closed: true,
      role: `${mark.role || 'sticker-field'}:${String(i + 1).padStart(2, '0')}`,
      points: fuzzyPeachPoints({
        anchor,
        rx: peachR * aspect,
        ry: peachR / Math.max(aspect, 0.001),
        rotation,
        fuzz,
        pointCount,
        seed,
        index: i,
      }),
      fill,
      stroke: mark.stroke || die.stroke || 'none',
      strokeWidth: finiteOr(mark.strokeWidth, finiteOr(die.strokeWidth, 0)),
      blur: die.blur ?? mark.blur,
      opacity,
      z: finiteOr(mark.z, 20) + i * 0.002,
      algorithmic: true,
      algorithm: 'pastamaker',
      pass: mark.pass || 'sticker-field',
      pastamaker: {
        dieFamily: 'fuzzyPeach',
        fieldKind: 'aroundRing',
        budgetMode: budget.mode,
        targetOpacity: budget.targetOpacity,
        expectedOverlapCount: budget.expectedOverlapCount,
      },
      stickerFieldRole: mark.role,
      stickerFieldIndex: i,
      stickerFieldCount: count,
      stickerFieldT: round(t),
    });
  }

  return out;
}

function fuzzyPeachPoints({ anchor, rx, ry, rotation, fuzz, pointCount, seed, index }) {
  const cosR = Math.cos(rotation);
  const sinR = Math.sin(rotation);
  const out = [];
  for (let i = 0; i < pointCount; i++) {
    const t = i / pointCount;
    const a = t * Math.PI * 2;
    const noise = deterministicWave(seed + index * 173, i, t) * fuzz;
    const localRx = Math.max(1, rx * (1 + noise * 0.3));
    const localRy = Math.max(1, ry * (1 + noise * 0.22));
    const x = Math.cos(a) * localRx;
    const y = Math.sin(a) * localRy;
    out.push([
      roundPoint(anchor[0] + x * cosR - y * sinR),
      roundPoint(anchor[1] + x * sinR + y * cosR),
    ]);
  }
  return out;
}

function spikeBananaPoints({ center, radius, thickness, start, end, pointCount, spike, taper, seed, index }) {
  const outer = [];
  const inner = [];
  for (let i = 0; i <= pointCount; i++) {
    const t = i / pointCount;
    const a = start + (end - start) * t;
    const width = spikeBananaWidth(t, thickness, taper);
    const noise = deterministicWave(seed + index * 131, i, t) * spike * thickness * 0.42;
    const outerR = Math.max(1, radius + width / 2 + Math.max(0, noise));
    outer.push([roundPoint(center[0] + Math.cos(a) * outerR), roundPoint(center[1] + Math.sin(a) * outerR)]);
  }
  for (let i = pointCount; i >= 0; i--) {
    const t = i / pointCount;
    const a = start + (end - start) * t;
    const width = spikeBananaWidth(t, thickness, taper);
    const noise = deterministicWave(seed + index * 197, i, t) * spike * thickness * 0.16;
    const innerR = Math.max(1, radius - width / 2 + Math.min(0, noise));
    inner.push([roundPoint(center[0] + Math.cos(a) * innerR), roundPoint(center[1] + Math.sin(a) * innerR)]);
  }
  return outer.concat(inner);
}

function spikeBananaWidth(t, thickness, taper) {
  const endTaper = Math.sin(Math.PI * clamp(t, 0, 1));
  if (taper === 'fat-head-tail' || taper === 'fatHeadTail') {
    const headBias = 1 - Math.pow(clamp(t, 0, 1), 1.35) * 0.42;
    return Math.max(thickness * 0.12, thickness * (0.22 + 0.58 * endTaper) * headBias);
  }
  return Math.max(thickness * 0.16, thickness * (0.34 + 0.54 * endTaper));
}

function expandAlongPathLineField(mark, field, die) {
  const points = pathPointsFor(field);
  if (points.length < 2) {
    throw new Error(`stickerField '${mark.role || '(anonymous)'}' field.points must contain at least two [x,y] points`);
  }
  const count = Math.max(1, Math.min(220, Math.round(finiteOr(field.count, 24))));
  const lengthRange = normalizeRange(die.length, 12, 42);
  const lateralRange = normalizeRange(field.lateralJitter, 0, 0);
  const alongJitter = clamp(finiteOr(field.alongJitter, 0.12), 0, 1);
  const wobble = clamp(finiteOr(die.wobble, 0), 0, 0.8);
  const budget = resolveValueBudget(mark.valueBudget, {
    targetOpacity: finiteOr(mark.opacity, 0.46),
    expectedOverlapCount: Math.max(1, Math.min(count, Math.round(count / 10))),
    mode: 'inverse-count',
  });
  const opacity = opacityForBudget(budget.targetOpacity, budget.expectedOverlapCount, budget.mode);
  const seed = hashString(`${mark.role || 'stickerField'}:path:${count}:${points.map((p) => p.join(',')).join('|')}`);
  const out = [];

  for (let i = 0; i < count; i++) {
    const baseT = count === 1 ? 0.5 : (i + 0.5) / count;
    const wave = deterministicWave(seed, i, baseT);
    const sample = sampleGesture(points, wrap01(baseT + wave * alongJitter * 0.035));
    if (!sample) continue;
    const tangent = sample.tangent;
    const normal = normalize([-tangent[1], tangent[0]]);
    const lateral = lerp(lateralRange[0], lateralRange[1], wrap01(baseT * 1.73 + wave * wobble * 0.11));
    const length = lerp(lengthRange[0], lengthRange[1], wrap01(baseT * 2.19 - wave * 0.04));
    const mode = die.orientation || field.rotation || 'tangent';
    const dir = mode === 'normal' ? normal : tangent;
    const cx = sample.point[0] + normal[0] * lateral;
    const cy = sample.point[1] + normal[1] * lateral;
    out.push({
      kind: 'line',
      role: `${mark.role || 'sticker-field'}:${String(i + 1).padStart(2, '0')}`,
      x1: roundPoint(cx - dir[0] * length / 2),
      y1: roundPoint(cy - dir[1] * length / 2),
      x2: roundPoint(cx + dir[0] * length / 2),
      y2: roundPoint(cy + dir[1] * length / 2),
      stroke: choosePaletteValue(mark.style?.palette || field.palette || die.palette, i) ||
        mark.stroke ||
        die.stroke ||
        '#cfa586',
      strokeWidth: finiteOr(mark.strokeWidth, finiteOr(die.strokeWidth, 1.8)),
      opacity,
      z: finiteOr(mark.z, 30) + i * 0.002,
      algorithmic: true,
      algorithm: 'pastamaker',
      pass: mark.pass || 'path-stroke',
      pastamaker: {
        dieFamily: 'line',
        fieldKind: 'alongPath',
        budgetMode: budget.mode,
        targetOpacity: budget.targetOpacity,
        expectedOverlapCount: budget.expectedOverlapCount,
      },
      stickerFieldRole: mark.role,
      stickerFieldIndex: i,
      stickerFieldCount: count,
      stickerFieldT: round(baseT),
    });
  }

  return out;
}

function expandAlongPathStringSpawnField(mark, field, die, scene = {}) {
  const points = pathPointsFor(field);
  if (points.length < 2) {
    throw new Error(`stickerField '${mark.role || '(anonymous)'}' field.points must contain at least two [x,y] points`);
  }
  const preset = resolveStringSpawnPreset(die);
  const stringCount = Math.max(1, Math.min(120, Math.round(finiteOr(field.stringCount ?? field.count, 7))));
  const glyph = preset.glyph;
  const glyphCount = Math.max(0, Math.min(80, Math.round(finiteOr(glyph.count ?? field.glyphCount, 4))));
  const lateralRange = normalizeRange(field.lateralJitter ?? die.lateralJitter, -10, 10);
  const lengthRange = normalizeRange(field.length ?? die.length, 0.64, 1);
  const samples = Math.max(4, Math.min(96, Math.round(finiteOr(field.samples ?? die.samples, 24))));
  const wobble = clamp(finiteOr(field.wobble ?? die.wobble, preset.wobble), 0, 2);
  const octaves = Math.max(1, Math.min(6, Math.round(finiteOr(field.fractalOctaves ?? die.fractalOctaves, preset.fractalOctaves))));
  const budget = resolveValueBudget(mark.valueBudget, {
    targetOpacity: finiteOr(mark.opacity, 0.5),
    expectedOverlapCount: Math.max(1, Math.min(stringCount, Math.round(stringCount / 2))),
    mode: 'inverse-count',
  });
  const opacity = opacityForBudget(budget.targetOpacity, budget.expectedOverlapCount, budget.mode);
  const seed = hashString(`${mark.role || 'stickerField'}:stringSpawn:${stringCount}:${points.map((p) => p.join(',')).join('|')}`);
  const out = [];
  const clusterPoints = [];

  for (let stringIndex = 0; stringIndex < stringCount; stringIndex++) {
    const stringSeed = hashString(`${seed}:${stringIndex}`);
    const t = stringCount === 1 ? 0.5 : stringIndex / (stringCount - 1);
    const lengthT = clamp(lerp(lengthRange[0], lengthRange[1], seededUnit(stringSeed, 1)), 0.04, 1);
    const maxStart = Math.max(0, 1 - lengthT);
    const startT = maxStart <= 0 ? 0 : seededUnit(stringSeed, 2) * maxStart;
    const endT = Math.min(1, startT + lengthT);
    const lateral = lerp(lateralRange[0], lateralRange[1], seededUnit(stringSeed, 3));
    const phase = seededUnit(stringSeed, 4) * Math.PI * 2;
    const baseStringPoints = noisySpaghettiPolyline({
      points,
      startT,
      endT,
      samples,
      lateral,
      alignment: clamp(finiteOr(field.alignment ?? die.alignment, preset.alignment), 0, 1),
      octaves,
      wobble,
      phase,
      seed: stringSeed,
      avoid: normalizeNoisySpaghettiAvoidance(field.avoid ?? die.avoid),
    });
    const stringPoints = applyStringSpawnSpiralPreset(baseStringPoints, {
      preset,
      seed: stringSeed,
      index: stringIndex,
      pathLength: Math.max(Math.abs(lateralRange[1] - lateralRange[0]), 1),
    });
    clusterPoints.push(...stringPoints);
    const roleBase = `${mark.role || 'sticker-field'}:string-${String(stringIndex + 1).padStart(2, '0')}`;
    out.push({
      kind: 'polyline',
      role: `${roleBase}:path`,
      points: stringPoints,
      fill: 'none',
      stroke: choosePaletteValue(mark.style?.palette || field.palette || die.palette, stringIndex) ||
        mark.stroke ||
        die.stroke ||
        '#d7caa7',
      strokeWidth: finiteOr(mark.strokeWidth, finiteOr(die.strokeWidth, 1.2)),
      opacity,
      z: finiteOr(mark.z, 30) + stringIndex * 0.002,
      algorithmic: true,
      algorithm: 'pastamaker',
      pass: mark.pass || 'string-spawn',
      pastamaker: {
        dieFamily: 'stringSpawn',
        fieldKind: 'alongPath',
        stringSpawnPreset: preset.name,
        spiralEnabled: Boolean(preset.spiral?.enabled),
        budgetMode: budget.mode,
        targetOpacity: budget.targetOpacity,
        expectedOverlapCount: budget.expectedOverlapCount,
        stringIndex,
        glyphCount,
      },
      stickerFieldRole: mark.role,
      stickerFieldIndex: stringIndex,
      stickerFieldCount: stringCount,
      stickerFieldT: round(t),
      stringSpawnRole: mark.role,
      stringSpawnIndex: stringIndex,
      stringSpawnKind: 'string',
    });

    for (let glyphIndex = 0; glyphIndex < glyphCount; glyphIndex++) {
      const glyphSeed = hashString(`${stringSeed}:glyph:${glyphIndex}`);
      const glyphT = glyphCount === 1 ? 0.5 : (glyphIndex + 0.5) / glyphCount;
      const sample = sampleGesture(stringPoints, clamp(glyphT + (seededUnit(glyphSeed, 1) - 0.5) * finiteOr(glyph.alongJitter, 0.08), 0, 1));
      if (!sample) continue;
      const glyphMark = stringSpawnGlyphMark({
        mark,
        die,
        glyph,
        point: sample.point,
        tangent: sample.tangent,
        seed: glyphSeed,
        stringIndex,
        glyphIndex,
        glyphCount,
        roleBase,
        budget,
      });
      clusterPoints.push(...markGeometryPoints(glyphMark));
      out.push(glyphMark);
    }
  }

  if (preset.cohere.enabled) {
    const skinMarks = stringSpawnSkinMarks({ mark, die, cohere: preset.cohere, points: clusterPoints, budget, scene });
    if (skinMarks.length) out.unshift(...skinMarks);
  }

  return out;
}

function resolveStringSpawnPreset(die) {
  const presetName = die.preset || die.naturalPreset || die.spiralPreset;
  const baseGlyph = die.glyph && typeof die.glyph === 'object' && !Array.isArray(die.glyph) ? die.glyph : {};
  const spiral = die.spiral && typeof die.spiral === 'object' && !Array.isArray(die.spiral) ? die.spiral : {};
  const cohere = die.cohere && typeof die.cohere === 'object' && !Array.isArray(die.cohere)
    ? { ...die.cohere, enabled: die.cohere.enabled !== false }
    : { enabled: die.cohere === true };
  if (presetName === 'fernCurl') {
    return {
      name: 'fernCurl',
      alignment: 0.7,
      wobble: 0.72,
      fractalOctaves: 4,
      spiral: {
        enabled: true,
        handedness: spiral.handedness || 'alternate',
        turns: spiral.turns ?? [0.35, 1.25],
        decay: finiteOr(spiral.decay, 0.74),
        amplitude: spiral.amplitude,
      },
      glyph: {
        id: 'leaf',
        count: 3,
        size: [3, 9],
        ...baseGlyph,
      },
      cohere,
    };
  }
  return {
    name: presetName || null,
    alignment: 0.82,
    wobble: 0.55,
    fractalOctaves: 3,
    spiral: {
      enabled: Boolean(spiral.enabled || spiral.turns || spiral.handedness),
      handedness: spiral.handedness || 'alternate',
      turns: spiral.turns ?? [0.2, 0.7],
      decay: finiteOr(spiral.decay, 0.82),
      amplitude: spiral.amplitude,
    },
    glyph: baseGlyph,
    cohere,
  };
}

function applyStringSpawnSpiralPreset(points, { preset, seed, index, pathLength }) {
  if (!preset?.spiral?.enabled || !Array.isArray(points) || points.length < 3) return points;
  const turns = lerpRange(preset.spiral.turns, 0.2, 0.7, seededUnit(seed, 7));
  const handedness = stringSpawnPresetHandedness(preset.spiral.handedness, seed, index);
  const decay = clamp(finiteOr(preset.spiral.decay, 0.78), 0.05, 1.2);
  const amplitude = finiteOr(preset.spiral.amplitude, Math.max(3.5, pathLength * 0.42));
  return points.map((point, pointIndex) => {
    const t = points.length === 1 ? 0.5 : pointIndex / (points.length - 1);
    const prev = points[Math.max(0, pointIndex - 1)];
    const next = points[Math.min(points.length - 1, pointIndex + 1)];
    const tangent = normalize([next[0] - prev[0], next[1] - prev[1]]);
    const normal = normalize([-tangent[1], tangent[0]]);
    const envelope = Math.sin(Math.PI * t) * Math.pow(Math.max(0, 1 - t * 0.58), decay);
    const curl = Math.sin((t * turns * Math.PI * 2) + seededUnit(seed, 8) * Math.PI * 2);
    const offset = curl * amplitude * envelope * handedness;
    return [
      roundPoint(point[0] + normal[0] * offset),
      roundPoint(point[1] + normal[1] * offset),
    ];
  });
}

function stringSpawnPresetHandedness(value, seed, index) {
  if (value === 'clockwise' || value === 'right') return 1;
  if (value === 'counterclockwise' || value === 'left') return -1;
  if (value === 'random') return seededUnit(seed, 9) > 0.5 ? 1 : -1;
  return index % 2 === 0 ? 1 : -1;
}

function stringSpawnSkinMarks({ mark, die, cohere, points, budget, scene = {} }) {
  const envelope = stringClusterEnvelope(points, cohere);
  if (envelope.length < 3) return [];
  const skin = cohere.skin && typeof cohere.skin === 'object' && !Array.isArray(cohere.skin) ? cohere.skin : {};
  const mode = cohere.mode || 'skin';
  const opacity = round(clamp(finiteOr(skin.opacity, finiteOr(cohere.opacity, 0.34)), 0.02, 1));
  const role = `${mark.role || 'sticker-field'}:cohered-skin`;
  const skinMark = {
    kind: 'polygon',
    role,
    points: envelope,
    closed: true,
    fill: skin.fill || cohere.fill || mark.skinFill || die.skinFill || '#7b5842',
    stroke: skin.stroke || cohere.stroke || mark.skinStroke || die.skinStroke || 'none',
    strokeWidth: finiteOr(skin.strokeWidth, finiteOr(cohere.strokeWidth, 0.8)),
    opacity,
    z: finiteOr(mark.z, 30) - 0.04,
    algorithmic: true,
    algorithm: 'pastamaker',
    pass: mark.pass || 'string-spawn-skin',
    pastamaker: {
      dieFamily: 'stringSpawn',
      fieldKind: 'alongPath',
      skin: true,
      stringSpawnPreset: mark.die?.preset || mark.die?.naturalPreset || mark.die?.spiralPreset || null,
      budgetMode: budget.mode,
      targetOpacity: budget.targetOpacity,
      expectedOverlapCount: budget.expectedOverlapCount,
    },
    stringSpawnRole: mark.role,
    stringSpawnKind: 'skin',
    stringSpawnSkin: true,
    stringSpawnSkinRole: mark.role,
    stringSpawnSkinMode: mode,
    stringSpawnSkinEnvelope: cohere.envelope || 'convexHull',
    volumeRole: `${mark.role || 'sticker-field'}:skin`,
    volumeSurface: 'cohered-string-skin',
  };
  const fabricMarks = fabricCreaseMarks({ mark, die, cohere, envelope, scene, skinMark });
  const patternMarks = fabricPatternMarks({ mark, die, cohere, envelope, skinMark, fabricMarks });
  const armorMarks = fabricArmorMarks({ mark, die, cohere, envelope, skinMark, scene });
  return [skinMark, ...fabricMarks, ...patternMarks, ...armorMarks];
}

function fabricCreaseMarks({ mark, die, cohere, envelope, scene = {}, skinMark }) {
  const fabric = cohere.fabric && typeof cohere.fabric === 'object' && !Array.isArray(cohere.fabric)
    ? cohere.fabric
    : { enabled: cohere.fabric === true };
  if (!fabric.enabled) return [];
  const center = centroid(envelope);
  const basis = principalPointBasis(envelope, center);
  const projected = envelope.map((point) => {
    const rel = [point[0] - center[0], point[1] - center[1]];
    return { s: dot(rel, basis.axis), n: dot(rel, basis.normal) };
  });
  const minS = Math.min(...projected.map((p) => p.s));
  const maxS = Math.max(...projected.map((p) => p.s));
  const minN = Math.min(...projected.map((p) => p.n));
  const maxN = Math.max(...projected.map((p) => p.n));
  const spanS = Math.max(maxS - minS, 1);
  const spanN = Math.max(maxN - minN, 1);
  const pleats = fabric.pleats && typeof fabric.pleats === 'object' && !Array.isArray(fabric.pleats) ? fabric.pleats : {};
  const pressure = normalizePressureProfile(pleats.pressure ?? fabric.pressure);
  const count = Math.max(1, Math.min(48, Math.round(finiteOr(pleats.count ?? fabric.count, 7))));
  const stiffness = clamp(finiteOr(fabric.stiffness, 0.42), 0, 1);
  const gravity = normalize(validPoint(fabric.gravity) || [0, 1]);
  const light = normalize(validPoint(scene?.light?.direction) || validPoint(fabric.lightDirection) || [-0.6, -0.8]);
  const amplitude = Math.max(0, finiteOr(pleats.amplitude, 0.32)) * spanS * 0.12 * (1 - stiffness);
  const strokeBase = finiteOr(fabric.strokeWidth, finiteOr(die.strokeWidth, finiteOr(mark.strokeWidth, 1.1)));
  const opacityBase = clamp(finiteOr(fabric.opacity, 0.46), 0.02, 1);
  const zBase = finiteOr(mark.z, 30);
  const avoid = normalizeNoisySpaghettiAvoidance(fabric.avoid ?? cohere.avoid);
  const seed = hashString(`${mark.role || 'stickerField'}:fabric:${count}:${envelope.map((p) => p.join(',')).join('|')}`);
  const marks = [];

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : (i + 0.5) / count;
    const localSeed = hashString(`${seed}:${i}`);
    const s = lerp(minS + spanS * 0.08, maxS - spanS * 0.08, t);
    const ridgeSign = i % 2 === 0 ? 1 : -1;
    const roleKind = ridgeSign > 0 ? 'ridge' : 'valley';
    const crease = [];
    const samples = Math.max(4, Math.min(18, Math.round(finiteOr(fabric.samples, 7))));
    for (let j = 0; j < samples; j++) {
      const u = samples === 1 ? 0.5 : j / (samples - 1);
      const centeredU = u - 0.5;
      const n = lerp(minN + spanN * 0.12, maxN - spanN * 0.12, u);
      const sag = Math.sin(Math.PI * u) * amplitude * (0.45 + Math.abs(t - 0.5));
      const ripple = deterministicWave(localSeed, j, u) * amplitude * 0.28;
      const principalPoint = pointFromPrincipal(
        center,
        basis,
        s + gravity[0] * sag + basis.axis[0] * ripple * 0.12,
        n + gravity[1] * sag + centeredU * amplitude * 0.12 * ridgeSign,
      );
      const avoided = avoid.length ? applyNoisySpaghettiAvoidance(principalPoint, avoid) : principalPoint;
      crease.push(nudgePointInsidePolygon(avoided, envelope, center));
    }
    const mid = crease[Math.floor(crease.length / 2)] || center;
    const depthT = clamp((dot([mid[0] - center[0], mid[1] - center[1]], basis.axis) - minS) / spanS, 0, 1);
    const perspectiveScale = fabricPerspectiveScale(fabric, mark, depthT);
    const lightDot = dot(normalize([basis.normal[0] * ridgeSign, basis.normal[1] * ridgeSign]), normalize([-light[0], -light[1]]));
    const isLitRidge = ridgeSign > 0 && lightDot >= -0.15;
    const stroke = roleKind === 'ridge'
      ? (isLitRidge
        ? fabric.highlightStroke || fabric.ridgeStroke || '#f4dcc0'
        : fabric.ridgeStroke || '#c7a785')
      : fabric.valleyStroke || fabric.shadowStroke || '#3e2b22';
    const opacity = round(clamp(opacityBase * (roleKind === 'ridge' ? 0.78 : 0.9) * lerp(0.72, 1, perspectiveScale), 0.02, 1));
    const common = {
      kind: 'polyline',
      role: `${mark.role || 'sticker-field'}:fabric-${roleKind}-${String(i + 1).padStart(2, '0')}`,
      points: crease,
      fill: 'none',
      stroke,
      strokeWidth: roundPoint(Math.max(0.35, strokeBase * perspectiveScale * (roleKind === 'ridge' ? 0.9 : 1.08))),
      opacity,
      z: roundPoint(zBase + (roleKind === 'ridge' ? 0.028 : 0.018) + i * 0.0004),
      algorithmic: true,
      algorithm: 'fabric-physics',
      pass: fabric.pass || 'fabric-crease',
      fabricPhysics: true,
      fabricMode: fabric.mode || 'drape',
      fabricEnvelope: skinMark.stringSpawnSkinEnvelope,
      fabricRole: roleKind,
      fabricStress: round(clamp((1 - stiffness) * 0.55 + Math.abs(t - 0.5) * 0.5 + avoid.length * 0.08, 0, 1)),
      fabricDepthT: round(depthT),
      fabricPerspectiveScale: round(perspectiveScale),
      fabricNormalHint: [round(basis.normal[0] * ridgeSign), round(basis.normal[1] * ridgeSign), round(0.72)],
      fabricRidgeSign: ridgeSign,
      fabricLightDot: round(lightDot),
      lightResponse: roleKind === 'ridge' ? 'highlight' : 'shadow',
      stringSpawnRole: mark.role,
      stringSpawnKind: 'fabric-crease',
      stringSpawnSkinRole: skinMark.stringSpawnSkinRole,
      volumeSurface: 'cohered-string-skin',
      volumeRole: `${mark.role || 'sticker-field'}:fabric-${roleKind}`,
      pastamaker: {
        dieFamily: 'stringSpawn',
        fieldKind: 'alongPath',
        fabricPhysics: true,
        fabricMode: fabric.mode || 'drape',
        fabricEnvelope: skinMark.stringSpawnSkinEnvelope,
        stiffness: round(stiffness),
        obstacleCount: avoid.length || undefined,
      },
    };
    if (pressure.enabled) {
      marks.push(...pressureSegmentMarks({
        common,
        points: crease,
        baseStrokeWidth: strokeBase * perspectiveScale * (roleKind === 'ridge' ? 0.9 : 1.08),
        baseOpacity: opacity,
        pressure,
        seed: localSeed,
        rolePrefix: common.role,
        extra: {
          fabricPressure: true,
          fabricPressureProfile: pressure.profile,
        },
      }));
    } else {
      marks.push({
        ...common,
        strokeWidth: roundPoint(Math.max(0.35, strokeBase * perspectiveScale * (roleKind === 'ridge' ? 0.9 : 1.08))),
      });
    }
  }

  return marks;
}

function normalizePressureProfile(input) {
  if (!input) return { enabled: false, profile: 'constant', min: 1, max: 1, noise: 0 };
  const raw = typeof input === 'object' && !Array.isArray(input)
    ? input
    : Array.isArray(input)
      ? { enabled: true, min: input[0], max: input[1] }
      : { enabled: input === true };
  const enabled = raw.enabled !== false;
  const profile = normalizePressureProfileName(raw.profile || raw.kind || raw.mode || 'bell');
  return {
    enabled,
    profile,
    min: clamp(finiteOr(raw.min, 0.42), 0.02, 4),
    max: clamp(finiteOr(raw.max, 1.18), 0.02, 4),
    noise: clamp(finiteOr(raw.noise, 0), 0, 1),
    opacityCoupling: clamp(finiteOr(raw.opacityCoupling, 0.24), 0, 1),
  };
}

function normalizePressureProfileName(value) {
  const text = String(value || 'bell').toLowerCase().replace(/[_\s-]+/g, '');
  if (text === 'linear' || text === 'ramp') return 'linear';
  if (text === 'frontheavy' || text === 'headheavy') return 'front-heavy';
  if (text === 'backheavy' || text === 'tailheavy') return 'back-heavy';
  if (text === 'calligraphic' || text === 'chisel') return 'calligraphic';
  if (text === 'constant' || text === 'flat') return 'constant';
  return 'bell';
}

function pressureAt(t, pressure, seed = 0, index = 0) {
  if (!pressure?.enabled) return 1;
  const u = clamp(t, 0, 1);
  let shaped = 1;
  if (pressure.profile === 'linear') shaped = u;
  else if (pressure.profile === 'front-heavy') shaped = 1 - Math.pow(u, 1.55);
  else if (pressure.profile === 'back-heavy') shaped = Math.pow(u, 1.55);
  else if (pressure.profile === 'calligraphic') shaped = 0.5 + 0.5 * Math.sin(u * Math.PI * 2);
  else if (pressure.profile === 'constant') shaped = 1;
  else shaped = Math.sin(u * Math.PI);
  const noisy = clamp(shaped + deterministicWave(seed, index, u) * pressure.noise, 0, 1);
  return lerp(pressure.min, pressure.max, noisy);
}

function pressureSegmentMarks({ common, points, baseStrokeWidth, baseOpacity, pressure, seed, rolePrefix, extra = {} }) {
  if (!Array.isArray(points) || points.length < 2) return [];
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const t = (i + 0.5) / Math.max(points.length - 1, 1);
    const p = pressureAt(t, pressure, seed, i);
    out.push({
      ...common,
      ...extra,
      kind: 'polyline',
      role: `${rolePrefix}:pressure-${String(i + 1).padStart(2, '0')}`,
      points: [points[i], points[i + 1]],
      strokeWidth: roundPoint(Math.max(0.25, baseStrokeWidth * p)),
      opacity: round(clamp(baseOpacity * lerp(1, p, pressure.opacityCoupling), 0.02, 1)),
      fabricPressureT: round(t),
      fabricPressureValue: round(p),
      z: roundPoint(finiteOr(common.z, 0) + i * 0.00003),
    });
  }
  return out;
}

function fabricPatternMarks({ mark, die, cohere, envelope, skinMark, fabricMarks = [] }) {
  const fabric = cohere.fabric && typeof cohere.fabric === 'object' && !Array.isArray(cohere.fabric)
    ? cohere.fabric
    : { enabled: cohere.fabric === true };
  const pattern = fabric.pattern && typeof fabric.pattern === 'object' && !Array.isArray(fabric.pattern)
    ? fabric.pattern
    : { enabled: fabric.pattern === true };
  if (!fabric.enabled || !pattern.enabled) return [];
  const center = centroid(envelope);
  const basis = principalPointBasis(envelope, center);
  const projected = envelope.map((point) => {
    const rel = [point[0] - center[0], point[1] - center[1]];
    return { s: dot(rel, basis.axis), n: dot(rel, basis.normal) };
  });
  const minS = Math.min(...projected.map((p) => p.s));
  const maxS = Math.max(...projected.map((p) => p.s));
  const minN = Math.min(...projected.map((p) => p.n));
  const maxN = Math.max(...projected.map((p) => p.n));
  const spanS = Math.max(maxS - minS, 1);
  const spanN = Math.max(maxN - minN, 1);
  const kind = normalizeFabricPatternKind(pattern.kind || pattern.type);
  const density = clamp(finiteOr(pattern.density, 0.62), 0.05, 2);
  const count = Math.max(1, Math.min(80, Math.round(finiteOr(pattern.count, kind === 'dot' ? 18 : 8) * density)));
  const color = pattern.stroke || pattern.color || pattern.fill || '#f0d9b5';
  const fill = pattern.fill || pattern.color || color;
  const opacity = round(clamp(finiteOr(pattern.opacity, 0.62), 0.02, 1));
  const zBase = finiteOr(mark.z, 30) + finiteOr(pattern.zOffset, 0.034);
  const seed = hashString(`${mark.role || 'stickerField'}:fabric-pattern:${kind}:${count}:${envelope.map((p) => p.join(',')).join('|')}`);
  if (kind === 'dot') {
    return fabricDotPatternMarks({
      mark,
      pattern,
      skinMark,
      fabricMarks,
      center,
      basis,
      minS,
      maxS,
      minN,
      maxN,
      spanS,
      spanN,
      count,
      fill,
      color,
      opacity,
      zBase,
      seed,
      envelope,
    });
  }
  return fabricStripePatternMarks({
    mark,
    pattern,
    skinMark,
    fabricMarks,
    center,
    basis,
    minS,
    maxS,
    minN,
    maxN,
    spanS,
    spanN,
    count,
    color,
    opacity,
    zBase,
    seed,
    envelope,
    kind,
  });
}

function normalizeFabricPatternKind(value) {
  const text = String(value || 'stripe').toLowerCase().replace(/[_\s-]+/g, '');
  if (text === 'dot' || text === 'dots' || text === 'polkadot' || text === 'polkadots') return 'dot';
  if (text === 'tartan' || text === 'plaid' || text === 'tartanlite') return 'tartan-lite';
  return 'stripe';
}

function fabricStripePatternMarks({
  mark,
  pattern,
  skinMark,
  fabricMarks,
  center,
  basis,
  minS,
  maxS,
  minN,
  maxN,
  spanS,
  spanN,
  count,
  color,
  opacity,
  zBase,
  seed,
  envelope,
  kind,
}) {
  const marks = [];
  const cross = pattern.flow === 'crossGrain' || pattern.flow === 'cross-grain';
  const stripeCount = kind === 'tartan-lite' ? Math.max(2, Math.round(count * 0.7)) : count;
  const pressure = normalizePressureProfile(pattern.pressure);
  const stripeMarks = (orientation, localCount, zShift) => {
    for (let i = 0; i < localCount; i++) {
      const t = localCount === 1 ? 0.5 : (i + 0.5) / localCount;
      const localSeed = hashString(`${seed}:${orientation}:${i}`);
      const points = [];
      const samples = Math.max(4, Math.min(20, Math.round(finiteOr(pattern.samples, 9))));
      for (let j = 0; j < samples; j++) {
        const u = samples === 1 ? 0.5 : j / (samples - 1);
        const s = orientation === 'cross'
          ? lerp(minS + spanS * 0.08, maxS - spanS * 0.08, u)
          : lerp(minS + spanS * 0.08, maxS - spanS * 0.08, t);
        const n = orientation === 'cross'
          ? lerp(minN + spanN * 0.1, maxN - spanN * 0.1, t)
          : lerp(minN + spanN * 0.1, maxN - spanN * 0.1, u);
        const stressPoint = pointFromPrincipal(center, basis, s, n);
        const stress = nearestFabricCreaseStress(stressPoint, fabricMarks);
        const distortion = finiteOr(pattern.distortion, 0.34);
        const wave = deterministicWave(localSeed, j, u) * distortion * 5;
        const shifted = pointFromPrincipal(
          center,
          basis,
          s + (orientation === 'cross' ? stress * distortion * 7 : wave),
          n + (orientation === 'cross' ? wave : stress * distortion * 7),
        );
        points.push(nudgePointInsidePolygon(shifted, envelope, center));
      }
      const mid = points[Math.floor(points.length / 2)] || center;
      const stress = nearestFabricCreaseStress(mid, fabricMarks);
      const common = {
        kind: 'polyline',
        role: `${mark.role || 'sticker-field'}:fabric-pattern-${orientation}-${String(i + 1).padStart(2, '0')}`,
        points,
        fill: 'none',
        stroke: color,
        strokeWidth: Math.max(finiteOr(pattern.strokeWidth, 0.85), 0.25),
        opacity: round(clamp(opacity * lerp(0.76, 1.08, stress), 0.02, 1)),
        z: roundPoint(zBase + zShift + i * 0.0003),
        algorithmic: true,
        algorithm: 'fabric-pattern',
        pass: pattern.pass || 'fabric-pattern',
        fabricPattern: true,
        fabricPatternKind: kind,
        fabricPatternFlow: orientation === 'cross' ? 'crossGrain' : 'grain',
        fabricPatternStress: round(stress),
        fabricFlowT: round(i / Math.max(localCount - 1, 1)),
        fabricPhysics: true,
        fabricEnvelope: skinMark.stringSpawnSkinEnvelope,
        fabricRole: 'pattern',
        stringSpawnRole: mark.role,
        stringSpawnKind: 'fabric-pattern',
        stringSpawnSkinRole: skinMark.stringSpawnSkinRole,
        volumeSurface: 'cohered-string-skin',
      };
      if (pressure.enabled) {
        marks.push(...pressureSegmentMarks({
          common,
          points,
          baseStrokeWidth: Math.max(finiteOr(pattern.strokeWidth, 0.85), 0.25),
          baseOpacity: common.opacity,
          pressure,
          seed: localSeed,
          rolePrefix: common.role,
          extra: {
            fabricPatternPressure: true,
            fabricPressureProfile: pressure.profile,
          },
        }));
      } else {
        marks.push(common);
      }
    }
  };
  stripeMarks(cross ? 'cross' : 'grain', stripeCount, 0);
  if (kind === 'tartan-lite') stripeMarks(cross ? 'grain' : 'cross', stripeCount, 0.006);
  return marks;
}

function fabricDotPatternMarks({
  mark,
  pattern,
  skinMark,
  fabricMarks,
  center,
  basis,
  minS,
  maxS,
  minN,
  maxN,
  spanS,
  spanN,
  count,
  fill,
  color,
  opacity,
  zBase,
  seed,
  envelope,
}) {
  const marks = [];
  const columns = Math.max(2, Math.min(16, Math.round(Math.sqrt(count * Math.max(spanS / Math.max(spanN, 1), 0.35)))));
  const rows = Math.max(2, Math.ceil(count / columns));
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const index = row * columns + col;
      if (index >= count) break;
      const localSeed = hashString(`${seed}:${row}:${col}`);
      const sT = (col + 0.5) / columns;
      const nT = (row + 0.5) / rows;
      const s = lerp(minS + spanS * 0.1, maxS - spanS * 0.1, sT);
      const n = lerp(minN + spanN * 0.12, maxN - spanN * 0.12, nT);
      const base = pointFromPrincipal(center, basis, s, n);
      const stress = nearestFabricCreaseStress(base, fabricMarks);
      const distortion = finiteOr(pattern.distortion, 0.34);
      const jitterS = (seededUnit(localSeed, 1) - 0.5) * spanS * 0.035 * distortion;
      const jitterN = (seededUnit(localSeed, 2) - 0.5) * spanN * 0.045 * distortion + stress * distortion * 4;
      const point = nudgePointInsidePolygon(pointFromPrincipal(center, basis, s + jitterS, n + jitterN), envelope, center);
      const radius = Math.max(0.8, finiteOr(pattern.radius ?? pattern.r, 2.4) * lerp(0.8, 1.28, stress));
      marks.push({
        kind: 'circle',
        role: `${mark.role || 'sticker-field'}:fabric-pattern-dot-${String(index + 1).padStart(2, '0')}`,
        cx: point[0],
        cy: point[1],
        r: roundPoint(radius),
        fill,
        stroke: pattern.stroke || color,
        strokeWidth: finiteOr(pattern.strokeWidth, 0),
        opacity: round(clamp(opacity * lerp(0.72, 1.06, stress), 0.02, 1)),
        z: roundPoint(zBase + index * 0.0002),
        algorithmic: true,
        algorithm: 'fabric-pattern',
        pass: pattern.pass || 'fabric-pattern',
        fabricPattern: true,
        fabricPatternKind: 'dot',
        fabricPatternFlow: 'uv-grid',
        fabricPatternStress: round(stress),
        fabricFlowT: round(sT),
        fabricFlowN: round(nT),
        fabricPhysics: true,
        fabricEnvelope: skinMark.stringSpawnSkinEnvelope,
        fabricRole: 'pattern',
        stringSpawnRole: mark.role,
        stringSpawnKind: 'fabric-pattern',
        stringSpawnSkinRole: skinMark.stringSpawnSkinRole,
        volumeSurface: 'cohered-string-skin',
      });
    }
  }
  return marks;
}

function nearestFabricCreaseStress(point, creases = []) {
  let best = Infinity;
  let baseStress = 0;
  for (const crease of creases) {
    if (!Array.isArray(crease.points)) continue;
    for (const p of crease.points) {
      const d = Math.hypot(point[0] - p[0], point[1] - p[1]);
      if (d < best) {
        best = d;
        baseStress = finiteOr(crease.fabricStress, 0.35);
      }
    }
  }
  if (!Number.isFinite(best)) return 0;
  return round(clamp((1 - best / 42) * 0.72 + baseStress * 0.28, 0, 1));
}

function fabricArmorMarks({ mark, die, cohere, envelope, skinMark, scene = {} }) {
  const fabric = cohere.fabric && typeof cohere.fabric === 'object' && !Array.isArray(cohere.fabric)
    ? cohere.fabric
    : { enabled: cohere.fabric === true };
  const armor = fabric.armor && typeof fabric.armor === 'object' && !Array.isArray(fabric.armor)
    ? fabric.armor
    : { enabled: fabric.armor === true };
  if (!fabric.enabled || !armor.enabled) return [];

  const center = centroid(envelope);
  const basis = principalPointBasis(envelope, center);
  const projected = envelope.map((point) => {
    const rel = [point[0] - center[0], point[1] - center[1]];
    return { s: dot(rel, basis.axis), n: dot(rel, basis.normal) };
  });
  const minS = Math.min(...projected.map((p) => p.s));
  const maxS = Math.max(...projected.map((p) => p.s));
  const minN = Math.min(...projected.map((p) => p.n));
  const maxN = Math.max(...projected.map((p) => p.n));
  const spanS = Math.max(maxS - minS, 1);
  const spanN = Math.max(maxN - minN, 1);
  const fit = normalizeFabricArmorFit(armor.fit);
  const type = normalizeFabricArmorType(armor.type || armor.kind);
  const common = {
    algorithmic: true,
    algorithm: 'fabric-armor',
    pass: armor.pass || 'fabric-armor',
    fabricArmor: true,
    fabricArmorFit: fit,
    fabricArmorType: type,
    fabricArmorMaterial: armor.material || (fit === 'blobpla' ? 'hero-shell' : 'plate'),
    fabricPhysics: true,
    fabricEnvelope: skinMark.stringSpawnSkinEnvelope,
    fabricRole: 'armor',
    stringSpawnRole: mark.role,
    stringSpawnKind: 'fabric-armor',
    stringSpawnSkinRole: skinMark.stringSpawnSkinRole,
    volumeSurface: 'cohered-string-skin',
    volumeRole: `${mark.role || 'sticker-field'}:fabric-armor`,
    pastamaker: {
      dieFamily: 'stringSpawn',
      fieldKind: 'alongPath',
      fabricArmor: true,
      fabricArmorFit: fit,
      fabricArmorType: type,
      fabricEnvelope: skinMark.stringSpawnSkinEnvelope,
    },
  };

  if (fit === 'blobpla') {
    return fabricBlobPlaArmorMarks({
      mark,
      armor,
      envelope,
      center,
      basis,
      minS,
      maxS,
      minN,
      maxN,
      spanS,
      spanN,
      common,
      scene,
    });
  }

  return fabricCastArmorMarks({
    mark,
    armor,
    envelope,
    center,
    basis,
    minS,
    maxS,
    minN,
    maxN,
    spanS,
    spanN,
    common,
    scene,
  });
}

function normalizeFabricArmorFit(value) {
  const text = String(value || 'volumizer-cast').toLowerCase().replace(/[_\s]+/g, '-');
  if (text === 'blobpla' || text === 'blob-pla' || text === 'blob') return 'blobpla';
  if (text === 'cast' || text === 'exact-fit' || text === 'volumizer' || text === 'volumizercast') return 'volumizer-cast';
  return 'volumizer-cast';
}

function normalizeFabricArmorType(value) {
  const text = String(value || 'breastplate').toLowerCase().replace(/[_\s]+/g, '-');
  if (text === 'shoulder' || text === 'shoulders' || text === 'shoulderpads') return 'shoulder-pads';
  if (text === 'boot' || text === 'boots') return 'boots';
  if (text === 'helm' || text === 'helmet') return 'helmet';
  if (text === 'hero' || text === 'hero-shell' || text === 'irion-man' || text === 'iron-man') return 'hero-shell';
  if (text === 'medieval' || text === 'plate' || text === 'breastplate') return 'breastplate';
  return text;
}

function fabricCastArmorMarks({
  mark,
  armor,
  envelope,
  center,
  basis,
  minS,
  maxS,
  minN,
  maxN,
  spanS,
  spanN,
  common,
  scene = {},
}) {
  const panels = Math.max(1, Math.min(18, Math.round(finiteOr(armor.panels ?? armor.count, 5))));
  const insetN = clamp(finiteOr(armor.inset, 0.16), 0, 0.42);
  const gap = clamp(finiteOr(armor.gap, 0.06), 0, 0.28);
  const bevel = clamp(finiteOr(armor.bevel, 0.22), 0, 0.46);
  const zBase = finiteOr(mark.z, 30) + finiteOr(armor.zOffset, 0.072);
  const fill = armor.fill || '#6f7887';
  const stroke = armor.stroke || '#d8e1ef';
  const strokeWidth = Math.max(0.25, finiteOr(armor.strokeWidth, 1));
  const opacity = round(clamp(finiteOr(armor.opacity, 0.72), 0.02, 1));
  const marks = [];

  for (let i = 0; i < panels; i++) {
    const startT = i / panels;
    const endT = (i + 1) / panels;
    const midT = (startT + endT) / 2;
    const s0 = lerp(minS + spanS * 0.08, maxS - spanS * 0.08, startT + gap / panels);
    const s1 = lerp(minS + spanS * 0.08, maxS - spanS * 0.08, endT - gap / panels);
    const n0 = lerp(minN, maxN, insetN + Math.abs(midT - 0.5) * 0.08);
    const n1 = lerp(minN, maxN, 1 - insetN - Math.abs(midT - 0.5) * 0.08);
    const midS = (s0 + s1) / 2;
    const midN = (n0 + n1) / 2;
    const points = fabricArmorLocalPlate({
      center,
      basis,
      envelope,
      envelopeCenter: center,
      localS: midS,
      localN: midN,
      halfS: Math.max((s1 - s0) / 2, spanS * 0.025),
      halfN: Math.max((n1 - n0) / 2, spanN * 0.12),
      bevel,
    });
    const plateMark = {
      kind: 'polygon',
      role: `${mark.role || 'sticker-field'}:armor-cast-panel-${String(i + 1).padStart(2, '0')}`,
      points,
      closed: true,
      fill,
      stroke,
      strokeWidth,
      opacity,
      z: roundPoint(zBase + i * 0.001),
      ...common,
      fabricArmorPanelIndex: i,
      fabricArmorPanelCount: panels,
      fabricArmorCastT: round(midT),
      armorCastSource: 'cohered-string-skin',
      volumizerReattribution: 'cohered-envelope-fit',
    };
    applyFabricArmorMetalBase({ plateMark, armor, scene });
    marks.push(plateMark);
    marks.push(...fabricArmorMetalSurfaceMarks({ armor, plateMark, panelIndex: i, panelCount: panels, scene, common }));
    marks.push(...fabricArmorTextureMarks({ armor, plateMark, panelIndex: i, panelCount: panels, common }));
  }

  return marks;
}

function fabricBlobPlaArmorMarks({
  mark,
  armor,
  envelope,
  center,
  basis,
  minS,
  maxS,
  minN,
  maxN,
  spanS,
  spanN,
  common,
  scene = {},
}) {
  const type = common.fabricArmorType;
  const zBase = finiteOr(mark.z, 30) + finiteOr(armor.zOffset, 0.088);
  const fill = armor.fill || (type === 'boots' ? '#3a3230' : '#8a96aa');
  const stroke = armor.stroke || '#edf2ff';
  const strokeWidth = Math.max(0.25, finiteOr(armor.strokeWidth, 1.1));
  const opacity = round(clamp(finiteOr(armor.opacity, 0.78), 0.02, 1));
  const bevel = clamp(finiteOr(armor.bevel, 0.38), 0, 0.48);
  const count = Math.max(1, Math.min(8, Math.round(finiteOr(armor.count, type === 'hero-shell' ? 3 : 2))));
  const marks = [];
  const padDefs = [];

  if (type === 'boots') {
    padDefs.push(
      { part: 'boot-left', s: minS + spanS * 0.24, n: maxN - spanN * 0.16, halfS: spanS * 0.12, halfN: spanN * 0.16 },
      { part: 'boot-right', s: maxS - spanS * 0.24, n: maxN - spanN * 0.16, halfS: spanS * 0.12, halfN: spanN * 0.16 },
    );
  } else if (type === 'helmet') {
    padDefs.push({ part: 'helmet-dome', s: (minS + maxS) / 2, n: minN + spanN * 0.2, halfS: spanS * 0.18, halfN: spanN * 0.2 });
  } else {
    padDefs.push(
      { part: 'shoulder-left', s: minS + spanS * 0.12, n: minN + spanN * 0.22, halfS: spanS * 0.14, halfN: spanN * 0.18 },
      { part: 'shoulder-right', s: maxS - spanS * 0.12, n: minN + spanN * 0.22, halfS: spanS * 0.14, halfN: spanN * 0.18 },
    );
    if (type === 'hero-shell' || count > 2) {
      padDefs.push({ part: 'chest-core', s: (minS + maxS) / 2, n: (minN + maxN) / 2, halfS: spanS * 0.16, halfN: spanN * 0.22 });
    }
  }

  for (let i = 0; i < Math.min(count, padDefs.length); i++) {
    const pad = padDefs[i];
    const points = fabricArmorLocalPlate({
      center,
      basis,
      envelope,
      envelopeCenter: center,
      localS: pad.s,
      localN: pad.n,
      halfS: Math.max(pad.halfS, 2),
      halfN: Math.max(pad.halfN, 2),
      bevel,
    });
    const plateMark = {
      kind: 'polygon',
      role: `${mark.role || 'sticker-field'}:blobpla-armor-${pad.part}`,
      points,
      closed: true,
      fill,
      stroke,
      strokeWidth,
      opacity,
      z: roundPoint(zBase + i * 0.001),
      ...common,
      blobPlaAdapter: true,
      blobPlaPart: `armor-${pad.part}`,
      fabricArmorPanelIndex: i,
      fabricArmorPanelCount: Math.min(count, padDefs.length),
      fabricArmorCastT: round(i / Math.max(Math.min(count, padDefs.length) - 1, 1)),
      armorCastSource: 'blobpla-layer-interface',
      volumizerReattribution: 'blobpla-pad-seat',
    };
    applyFabricArmorMetalBase({ plateMark, armor, scene });
    marks.push(plateMark);
    marks.push(...fabricArmorMetalSurfaceMarks({
      armor,
      plateMark,
      panelIndex: i,
      panelCount: Math.min(count, padDefs.length),
      scene,
      common,
    }));
    marks.push(...fabricArmorTextureMarks({
      armor,
      plateMark,
      panelIndex: i,
      panelCount: Math.min(count, padDefs.length),
      common,
    }));
  }

  return marks;
}

function fabricArmorLocalPlate({
  center,
  basis,
  envelope,
  envelopeCenter,
  localS,
  localN,
  halfS,
  halfN,
  bevel,
}) {
  const bS = halfS * bevel;
  const bN = halfN * bevel;
  const coords = [
    [-halfS + bS, -halfN],
    [halfS - bS, -halfN],
    [halfS, -halfN + bN],
    [halfS, halfN - bN],
    [halfS - bS, halfN],
    [-halfS + bS, halfN],
    [-halfS, halfN - bN],
    [-halfS, -halfN + bN],
  ];
  return coords.map(([ds, dn]) => nudgePointInsidePolygon(
    pointFromPrincipal(center, basis, localS + ds, localN + dn),
    envelope,
    envelopeCenter,
  ));
}

function applyFabricArmorMetalBase({ plateMark, armor, scene = {} }) {
  const surface = normalizeFabricArmorSurface(armor);
  if (!surface.enabled) return;
  const center = centroid(plateMark.points);
  const basis = principalPointBasis(plateMark.points, center);
  const box = bbox(plateMark.points);
  const light = normalize(scene.light?.direction || [-0.6, -0.8]);
  const from = [
    roundPoint(center[0] + light[0] * Math.max(box.w, box.h) * 0.42),
    roundPoint(center[1] + light[1] * Math.max(box.w, box.h) * 0.42),
  ];
  const to = [
    roundPoint(center[0] - light[0] * Math.max(box.w, box.h) * 0.42),
    roundPoint(center[1] - light[1] * Math.max(box.w, box.h) * 0.42),
  ];
  plateMark.metalSurface = true;
  plateMark.metalMaterial = surface.material;
  plateMark.metalCurvature = surface.curvature;
  plateMark.metalReflectivity = round(surface.reflectivity);
  plateMark.metalRoughness = round(surface.roughness);
  plateMark.metalSurfaceBasis = {
    axis: basis.axis.map(round),
    normal: basis.normal.map(round),
  };
  plateMark.fillGradient = {
    kind: surface.curvature === 'radial' ? 'radial' : 'linear',
    role: 'armor-metal-base-gradient',
    center: center.map(roundPoint),
    from,
    to,
    independentLighting: false,
    stops: [
      { offset: 0, color: surface.shadowColor, opacity: round(0.56 + surface.roughness * 0.24) },
      { offset: 0.42, color: plateMark.fill, opacity: 0.88 },
      { offset: 0.62, color: surface.midColor, opacity: 0.92 },
      { offset: 1, color: surface.highlightColor, opacity: round(0.36 + surface.reflectivity * 0.28) },
    ],
  };
}

function fabricArmorMetalSurfaceMarks({ armor, plateMark, panelIndex, panelCount, scene = {}, common }) {
  const surface = normalizeFabricArmorSurface(armor);
  if (!surface.enabled || !Array.isArray(plateMark.points) || plateMark.points.length < 3) return [];
  const center = centroid(plateMark.points);
  const basis = principalPointBasis(plateMark.points, center);
  const projected = plateMark.points.map((point) => {
    const rel = [point[0] - center[0], point[1] - center[1]];
    return { s: dot(rel, basis.axis), n: dot(rel, basis.normal) };
  });
  const minS = Math.min(...projected.map((p) => p.s));
  const maxS = Math.max(...projected.map((p) => p.s));
  const minN = Math.min(...projected.map((p) => p.n));
  const maxN = Math.max(...projected.map((p) => p.n));
  const spanS = Math.max(maxS - minS, 1);
  const spanN = Math.max(maxN - minN, 1);
  const light = normalize(scene.light?.direction || [-0.6, -0.8]);
  const lightFacing = normalize([-light[0], -light[1]]);
  const normalLightDot = dot(basis.normal, lightFacing);
  const axisLightDot = dot(basis.axis, lightFacing);
  const lightN = clamp(normalLightDot, -1, 1) * spanN * 0.22;
  const curveAmount = surface.curvature === 'flat'
    ? 0
    : surface.curvature === 'radial'
      ? 0.42
      : 0.28;
  const bandHalfN = spanN * lerp(0.055, 0.16, surface.roughness);
  const bandHalfS = spanS * (surface.curvature === 'radial' ? 0.28 : 0.43);
  const highlight = armorMetalBandPolygon({
    center,
    basis,
    polygon: plateMark.points,
    localN: lightN,
    halfS: bandHalfS,
    halfN: bandHalfN,
    curveAmount,
    curveSign: normalLightDot >= 0 ? 1 : -1,
  });
  const shadow = armorMetalBandPolygon({
    center,
    basis,
    polygon: plateMark.points,
    localN: -lightN - Math.sign(normalLightDot || 1) * spanN * 0.26,
    halfS: spanS * 0.46,
    halfN: spanN * 0.12,
    curveAmount: curveAmount * 0.55,
    curveSign: normalLightDot >= 0 ? -1 : 1,
  });
  const glintCenter = nudgePointInsidePolygon(pointFromPrincipal(
    center,
    basis,
    axisLightDot * spanS * 0.18,
    lightN + Math.sign(normalLightDot || 1) * spanN * 0.11,
  ), plateMark.points, center);
  const zBase = finiteOr(plateMark.z, 30);
  const commonSurface = {
    ...common,
    fabricArmorSurface: true,
    metalSurface: true,
    metalMaterial: surface.material,
    metalCurvature: surface.curvature,
    metalReflectivity: round(surface.reflectivity),
    metalRoughness: round(surface.roughness),
    metalLightDot: round(normalLightDot),
    metalAxisLightDot: round(axisLightDot),
    fabricArmorPanelIndex: panelIndex,
    fabricArmorPanelCount: panelCount,
    fabricRole: 'armor-metal-surface',
    stringSpawnKind: 'fabric-armor-metal',
    volumeSurface: 'cohered-string-skin',
  };
  const marks = [
    {
      ...commonSurface,
      kind: 'polygon',
      role: `${plateMark.role}:metal-specular-band`,
      points: highlight,
      closed: true,
      fill: surface.highlightColor,
      stroke: 'none',
      opacity: round(clamp(surface.reflectivity * (1 - surface.roughness * 0.62), 0.08, 0.72)),
      blur: roundPoint(lerp(0.4, 2.6, surface.roughness)),
      z: roundPoint(zBase + 0.018),
      metalHighlightRole: 'specular-band',
      fillGradient: {
        kind: 'linear',
        role: 'armor-metal-specular-gradient',
        center: center.map(roundPoint),
        from: highlight[0],
        to: highlight[Math.floor(highlight.length / 2)] || highlight[0],
        independentLighting: false,
        stops: [
          { offset: 0, color: surface.highlightColor, opacity: 0 },
          { offset: 0.48, color: surface.glintColor, opacity: 0.92 },
          { offset: 1, color: surface.highlightColor, opacity: 0 },
        ],
      },
    },
    {
      ...commonSurface,
      kind: 'polygon',
      role: `${plateMark.role}:metal-shadow-rim`,
      points: shadow,
      closed: true,
      fill: surface.shadowColor,
      stroke: 'none',
      opacity: round(clamp(0.18 + surface.reflectivity * 0.18, 0.06, 0.46)),
      blur: roundPoint(lerp(0.2, 1.5, surface.roughness)),
      z: roundPoint(zBase + 0.012),
      metalHighlightRole: 'shadow-rim',
    },
  ];
  if (surface.glints > 0) {
    marks.push({
      ...commonSurface,
      kind: 'circle',
      role: `${plateMark.role}:metal-glint`,
      cx: glintCenter[0],
      cy: glintCenter[1],
      r: roundPoint(Math.max(1.2, Math.min(spanS, spanN) * 0.055 * surface.reflectivity)),
      fill: surface.glintColor,
      stroke: surface.highlightColor,
      strokeWidth: 0.35,
      opacity: round(clamp(surface.reflectivity * 0.72, 0.08, 0.86)),
      blur: roundPoint(0.15 + surface.roughness * 0.6),
      z: roundPoint(zBase + 0.026),
      metalHighlightRole: 'glint',
    });
  }
  return marks;
}

function normalizeFabricArmorSurface(armor = {}) {
  const surface = armor.surface && typeof armor.surface === 'object' && !Array.isArray(armor.surface)
    ? armor.surface
    : { enabled: armor.surface === true };
  const material = String(surface.material || armor.material || '').toLowerCase().replace(/[_\s-]+/g, '-');
  const enabled = surface.enabled === true || ['metal', 'shiny-metal', 'chrome', 'silver', 'steel', 'gold'].includes(material);
  if (!enabled) return { enabled: false };
  const normalizedMaterial = material || 'shiny-metal';
  const curvature = normalizeArmorCurvature(surface.curvature || surface.profile || (armor.fabricArmorFit === 'blobpla' ? 'radial' : 'convex'));
  const reflectivity = clamp(finiteOr(surface.reflectivity, normalizedMaterial === 'chrome' ? 0.92 : 0.72), 0, 1);
  const roughness = clamp(finiteOr(surface.roughness, normalizedMaterial === 'chrome' ? 0.12 : 0.26), 0, 1);
  return {
    enabled: true,
    material: normalizedMaterial,
    curvature,
    reflectivity,
    roughness,
    glints: Math.max(0, Math.min(4, Math.round(finiteOr(surface.glints, reflectivity > 0.55 ? 1 : 0)))),
    highlightColor: surface.highlightColor || (normalizedMaterial === 'gold' ? '#fff0a6' : '#f8fbff'),
    glintColor: surface.glintColor || '#ffffff',
    midColor: surface.midColor || (normalizedMaterial === 'gold' ? '#caa14a' : '#aeb8c6'),
    shadowColor: surface.shadowColor || (normalizedMaterial === 'gold' ? '#5b431b' : '#26313d'),
  };
}

function normalizeArmorCurvature(value) {
  const text = String(value || 'convex').toLowerCase().replace(/[_\s-]+/g, '');
  if (text === 'flat' || text === 'plane') return 'flat';
  if (text === 'radial' || text === 'dome' || text === 'spherical') return 'radial';
  return 'convex';
}

function armorMetalBandPolygon({ center, basis, polygon, localN, halfS, halfN, curveAmount, curveSign }) {
  const samples = 5;
  const upper = [];
  const lower = [];
  for (let i = 0; i < samples; i++) {
    const u = samples === 1 ? 0.5 : i / (samples - 1);
    const s = lerp(-halfS, halfS, u);
    const bow = Math.sin(u * Math.PI) * halfN * curveAmount * curveSign;
    upper.push(nudgePointInsidePolygon(
      pointFromPrincipal(center, basis, s, localN + halfN + bow),
      polygon,
      center,
    ));
    lower.push(nudgePointInsidePolygon(
      pointFromPrincipal(center, basis, s, localN - halfN + bow),
      polygon,
      center,
    ));
  }
  return [...upper, ...lower.reverse()];
}

function fabricArmorTextureMarks({ armor, plateMark, panelIndex, panelCount, common }) {
  const texture = armor.texture && typeof armor.texture === 'object' && !Array.isArray(armor.texture)
    ? armor.texture
    : { enabled: armor.texture === true };
  if (!texture.enabled || !Array.isArray(plateMark.points) || plateMark.points.length < 3) return [];
  const kind = normalizeArmorTextureKind(texture.kind || texture.type);
  const plateCenter = centroid(plateMark.points);
  const box = bbox(plateMark.points);
  const bounds = {
    x: box.minX,
    y: box.minY,
    width: box.w,
    height: box.h,
  };
  const baseR = Math.max(finiteOr(texture.r ?? texture.radius, kind === 'basketball' || kind === 'iguana' ? 2.8 : 3.4), 0.5);
  const rNoise = clamp(finiteOr(texture.rNoise ?? texture.radiusNoise, 0.18), 0, 0.9);
  const spacing = Math.max(finiteOr(texture.spacing, kind === 'basketball' || kind === 'iguana' ? 0.1 : 0.42), 0);
  const countInput = texture.count;
  const defaultCount = kind === 'crosshatch' || kind === 'hatch' ? 7 : kind === 'grass' ? 16 : 10;
  const countLimit = Math.max(1, Math.min(120, Math.round(finiteOr(countInput, defaultCount))));
  const seed = hashString(`${plateMark.role}:armor-texture:${kind}:${panelIndex}:${countLimit}:${baseR}`);
  const cells = armorTexturePackCells({
    polygon: plateMark.points,
    bounds,
    baseR,
    rNoise,
    spacing,
    corner: texture.corner || 'top-left',
    seed,
    countLimit,
  });
  const out = [];
  const stroke = texture.stroke || armor.textureStroke || plateMark.stroke || '#f2f6ff';
  const fill = texture.fill || armor.textureFill || plateMark.fill || '#dfe7f3';
  const opacity = round(clamp(finiteOr(texture.opacity, kind === 'basketball' || kind === 'iguana' ? 0.54 : 0.7), 0.02, 1));
  const strokeWidth = Math.max(0.2, finiteOr(texture.strokeWidth, kind === 'basketball' || kind === 'iguana' ? 0.55 : 0.75));
  const height = Math.max(1, finiteOr(texture.height ?? texture.length, kind === 'grass' ? 10 : kind === 'thorn' ? 7 : 8));
  const lowering = normalizeArmorTextureLowering(texture.lowering || texture.mode);
  const surfaceCellHeight = round(clamp(finiteOr(texture.surfaceCellHeight ?? texture.height, 0.35), 0, 4));
  const angle = finiteOr(texture.angle, kind === 'hatch' ? -0.58 : 0.58);
  const secondAngle = finiteOr(texture.crossAngle, angle + Math.PI / 2);
  cells.forEach((cell, textureIndex) => {
    const groupIndex = Math.floor(textureIndex / 3);
    const base = {
      ...common,
      fabricArmorTexture: true,
      fabricArmorTextureKind: kind,
      fabricArmorTextureRole: plateMark.role,
      fabricArmorTextureIndex: textureIndex,
      fabricArmorTextureCount: cells.length,
      fabricArmorTextureGroupIndex: groupIndex,
      fabricArmorTextureGroupMember: textureIndex % 3,
      fabricArmorTextureLowering: lowering,
      fabricArmorPanelIndex: panelIndex,
      fabricArmorPanelCount: panelCount,
      fabricRole: 'armor-texture',
      stringSpawnKind: 'fabric-armor-texture',
      role: `${plateMark.role}:texture-${kind}-${String(textureIndex + 1).padStart(3, '0')}`,
      opacity,
      z: armorTextureCellZ({ plateMark, texture, cell, textureIndex, baseZ: finiteOr(plateMark.z, 30), bounds }),
      pastamaker: {
        ...common.pastamaker,
        fabricArmorTexture: true,
        textureKind: kind,
        packingMode: 'iguana-surface-grouping',
        glyphRule: kind === 'basketball' || kind === 'iguana' ? 'three-circle-tangent' : 'packed-surface-emitter',
        textureLowering: lowering,
        glyphIndex: groupIndex,
        glyphCircleIndex: textureIndex % 3,
        r: roundPoint(cell.r),
        rNoise,
        spacing,
      },
    };
    if (kind === 'basketball' || kind === 'iguana') {
      if (lowering === 'sphere') {
        out.push({
          ...base,
          kind: 'sphere',
          cx: roundPoint(cell.center[0]),
          cy: roundPoint(cell.center[1]),
          anchor: [roundPoint(cell.center[0]), roundPoint(cell.center[1])],
          r: roundPoint(cell.r),
          fill: texture.surfaceLighting === false ? fill : shadeHex(fill, armorTextureLightFactor(cell, plateCenter)),
          stroke: texture.border === true || texture.outline === true ? stroke : 'none',
          strokeWidth: texture.border === true || texture.outline === true ? strokeWidth : 0,
          surfaceCell: true,
          surfaceCellHeight,
          surfaceCellZPolicy: 'lower-paints-over-upper',
          surfaceCellLowering: 'sphere',
          raisedSurfaceTexture: true,
          shade: texture.surfaceLighting === false ? undefined : { algorithm: 'form-light-stack', intensity: 0.22 + surfaceCellHeight * 0.12 },
          highlights: texture.surfaceLighting === false ? undefined : { algorithm: 'form-light-stack', intensity: 0.18 + surfaceCellHeight * 0.08 },
          fillGradient: texture.surfaceLighting === false ? undefined : {
            kind: 'radial',
            role: 'armor-texture-sphere-gradient',
            center: [roundPoint(cell.center[0] - cell.r * 0.28), roundPoint(cell.center[1] - cell.r * 0.32)],
            stops: [
              { offset: 0, color: texture.highlightColor || '#ffffff', opacity: round(clamp(0.42 + surfaceCellHeight * 0.12, 0.08, 0.92)) },
              { offset: 0.58, color: fill, opacity: 0.86 },
              { offset: 1, color: texture.shadowColor || '#1c2430', opacity: round(clamp(0.18 + surfaceCellHeight * 0.08, 0.04, 0.5)) },
            ],
          },
        });
        return;
      }
      out.push({
        ...base,
        kind: 'circle',
        cx: roundPoint(cell.center[0]),
        cy: roundPoint(cell.center[1]),
        r: roundPoint(cell.r),
        fill,
        stroke,
        strokeWidth,
      });
      return;
    }
    if (kind === 'thorn' || kind === 'grass') {
      const away = normalize([cell.center[0] - plateCenter[0], cell.center[1] - plateCenter[1]]);
      const wobble = deterministicWave(seed, textureIndex, textureIndex / Math.max(cells.length - 1, 1));
      const side = normalize([-away[1], away[0]]);
      const tip = [
        cell.center[0] + away[0] * height + side[0] * wobble * height * 0.28,
        cell.center[1] + away[1] * height + side[1] * wobble * height * 0.28,
      ];
      const mid = [
        cell.center[0] + away[0] * height * 0.46 + side[0] * wobble * height * 0.18,
        cell.center[1] + away[1] * height * 0.46 + side[1] * wobble * height * 0.18,
      ];
      out.push({
        ...base,
        kind: 'polyline',
        points: [
          [roundPoint(cell.center[0]), roundPoint(cell.center[1])],
          [roundPoint(mid[0]), roundPoint(mid[1])],
          [roundPoint(tip[0]), roundPoint(tip[1])],
        ],
        fill: 'none',
        stroke,
        strokeWidth: roundPoint(strokeWidth * (kind === 'grass' ? 0.72 : 1)),
        armorTextureEmanatesOut: true,
      });
      return;
    }
    const lineMarks = kind === 'crosshatch'
      ? [
        armorTextureLineMark({ base, cell, plateMark, angle, length: height, stroke, strokeWidth, indexSuffix: 'a' }),
        armorTextureLineMark({ base, cell, plateMark, angle: secondAngle, length: height, stroke, strokeWidth, indexSuffix: 'b' }),
      ]
      : [armorTextureLineMark({ base, cell, plateMark, angle, length: height, stroke, strokeWidth, indexSuffix: 'a' })];
    out.push(...lineMarks);
  });
  return out;
}

function normalizeArmorTextureKind(value) {
  const text = String(value || 'basketball').toLowerCase().replace(/[_\s-]+/g, '');
  if (text === 'iguana' || text === 'scale' || text === 'scales' || text === 'basketball') return text === 'basketball' ? 'basketball' : 'iguana';
  if (text === 'thorn' || text === 'thorns' || text === 'spike' || text === 'spikes') return 'thorn';
  if (text === 'crosshatch' || text === 'crosshatching') return 'crosshatch';
  if (text === 'hatch' || text === 'hatching') return 'hatch';
  if (text === 'grass' || text === 'fur' || text === 'bristle' || text === 'bristles') return 'grass';
  return 'basketball';
}

function normalizeArmorTextureLowering(value) {
  const text = String(value || 'circle').toLowerCase().replace(/[_\s-]+/g, '');
  if (text === 'sphere' || text === 'raised' || text === 'raisedsphere' || text === 'bump') return 'sphere';
  return 'circle';
}

function armorTextureCellZ({ plateMark, texture, cell, textureIndex, baseZ, bounds }) {
  if (texture.zPolicy === 'emission-order') return roundPoint(baseZ + 0.014 + textureIndex * 0.00005);
  const tY = bounds.height <= 1e-9 ? 0.5 : clamp((cell.center[1] - bounds.y) / bounds.height, 0, 1);
  const zRange = Math.max(0.001, finiteOr(texture.zRange, 1));
  return roundPoint(baseZ + 0.014 + tY * zRange + textureIndex * 0.00001);
}

function armorTextureLightFactor(cell, plateCenter) {
  const dir = normalize([cell.center[0] - plateCenter[0], cell.center[1] - plateCenter[1]]);
  const upLight = normalize([-0.55, -0.72]);
  return lerp(0.88, 1.16, clamp((dot(dir, upLight) + 1) / 2, 0, 1));
}

function armorTexturePackCells({ polygon, bounds, baseR, rNoise, spacing, corner, seed, countLimit }) {
  const centers = iguanaPackCenters({ bounds, baseR, rNoise, spacing, corner, seed, countLimit: countLimit * 4 });
  const accepted = [];
  for (const candidate of centers) {
    if (accepted.length >= countLimit) break;
    if (!pointInPolygon(candidate.center, polygon)) continue;
    accepted.push(candidate);
  }
  return accepted;
}

function armorTextureLineMark({ base, cell, plateMark, angle, length, stroke, strokeWidth, indexSuffix }) {
  const axis = [Math.cos(angle), Math.sin(angle)];
  const half = Math.max(length * 0.5, cell.r);
  const center = centroid(plateMark.points);
  const a = nudgePointInsidePolygon([
    cell.center[0] - axis[0] * half,
    cell.center[1] - axis[1] * half,
  ], plateMark.points, center);
  const b = nudgePointInsidePolygon([
    cell.center[0] + axis[0] * half,
    cell.center[1] + axis[1] * half,
  ], plateMark.points, center);
  return {
    ...base,
    kind: 'polyline',
    role: `${base.role}-${indexSuffix}`,
    points: [a, b],
    fill: 'none',
    stroke,
    strokeWidth,
  };
}

function fabricPerspectiveScale(fabric, mark, depthT) {
  const depthScale = clamp(finiteOr(fabric.depthScale ?? mark.depthScale, 0.94), 0.2, 1);
  if (fabric.perspectiveSizing === false) return 1;
  return clamp(Math.pow(depthScale, depthT * 6), 0.35, 1.2);
}

function nudgePointInsidePolygon(point, polygon, center) {
  if (pointInPolygon(point, polygon)) return [roundPoint(point[0]), roundPoint(point[1])];
  const steps = 10;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const next = [
      lerp(point[0], center[0], t),
      lerp(point[1], center[1], t),
    ];
    if (pointInPolygon(next, polygon)) return [roundPoint(next[0]), roundPoint(next[1])];
  }
  return [roundPoint(center[0]), roundPoint(center[1])];
}

function stringClusterEnvelope(points, cohere = {}) {
  const clean = uniquePointSet(points)
    .filter((point) => Array.isArray(point) && point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]));
  if (clean.length < 3) return [];
  const kind = normalizeStringEnvelopeKind(cohere.envelope);
  const hull = kind === 'stripHull'
    ? stripHullPoints(clean, cohere)
    : kind === 'alphaHull'
      ? alphaHullPoints(clean, cohere)
      : convexHullPoints(clean);
  if (hull.length < 3) return [];
  const padded = kind === 'stripHull'
    ? hull
    : padPolygonFromCentroid(hull, finiteOr(cohere.padding, 8));
  const smoothing = clamp(finiteOr(cohere.smoothing, 0), 0, 0.75);
  const smoothed = smoothing > 0 ? smoothClosedPolygon(padded, Math.max(1, Math.min(3, Math.round(smoothing * 4)))) : padded;
  const maxPoints = Math.max(3, Math.min(80, Math.round(finiteOr(cohere.maxPoints, 48))));
  return decimateClosedPolygon(smoothed, maxPoints);
}

function normalizeStringEnvelopeKind(value) {
  const text = String(value || 'convexHull');
  if (text === 'strip' || text === 'stripHull' || text === 'ribbon') return 'stripHull';
  if (text === 'alpha' || text === 'alphaHull' || text === 'concave') return 'alphaHull';
  return 'convexHull';
}

function uniquePointSet(points) {
  const seen = new Set();
  const out = [];
  for (const point of points || []) {
    if (!Array.isArray(point) || point.length < 2) continue;
    const x = roundPoint(point[0]);
    const y = roundPoint(point[1]);
    const key = `${x},${y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push([x, y]);
  }
  return out;
}

function convexHullPoints(points) {
  const sorted = points.slice().sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
  if (sorted.length <= 3) return sorted;
  const lower = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross2(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop();
    lower.push(point);
  }
  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const point = sorted[i];
    while (upper.length >= 2 && cross2(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop();
    upper.push(point);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

function stripHullPoints(points, cohere = {}) {
  const center = averagePoint2(points);
  const basis = principalPointBasis(points, center);
  const padding = finiteOr(cohere.padding, 8);
  const binCount = Math.max(4, Math.min(32, Math.round(finiteOr(cohere.bins, 14))));
  const projections = points.map((point) => {
    const rel = [point[0] - center[0], point[1] - center[1]];
    return {
      s: dot(rel, basis.axis),
      n: dot(rel, basis.normal),
    };
  });
  const minS = Math.min(...projections.map((p) => p.s));
  const maxS = Math.max(...projections.map((p) => p.s));
  const span = Math.max(maxS - minS, 1e-6);
  const bins = Array.from({ length: binCount }, (_, index) => ({
    index,
    minN: Infinity,
    maxN: -Infinity,
    sumS: 0,
    count: 0,
  }));
  for (const projected of projections) {
    const binIndex = clamp(Math.floor(((projected.s - minS) / span) * binCount), 0, binCount - 1);
    const bin = bins[binIndex];
    bin.minN = Math.min(bin.minN, projected.n);
    bin.maxN = Math.max(bin.maxN, projected.n);
    bin.sumS += projected.s;
    bin.count += 1;
  }
  const occupied = bins
    .filter((bin) => bin.count > 0)
    .map((bin) => ({
      s: bin.sumS / bin.count,
      minN: bin.minN - padding,
      maxN: bin.maxN + padding,
    }));
  if (occupied.length < 2) return convexHullPoints(points);
  const endPad = padding * 0.65;
  occupied[0].s -= endPad;
  occupied[occupied.length - 1].s += endPad;
  const upper = occupied.map((bin) => pointFromPrincipal(center, basis, bin.s, bin.maxN));
  const lower = occupied.slice().reverse().map((bin) => pointFromPrincipal(center, basis, bin.s, bin.minN));
  return upper.concat(lower);
}

function alphaHullPoints(points, cohere = {}) {
  const center = averagePoint2(points);
  const sectors = Math.max(8, Math.min(48, Math.round(finiteOr(cohere.sectors, finiteOr(cohere.bins, 20)))));
  const padding = finiteOr(cohere.padding, 8);
  const alpha = clamp(finiteOr(cohere.alpha, 0.72), 0.05, 1);
  const bins = Array.from({ length: sectors }, (_, index) => ({ index, radius: -Infinity, point: null }));
  for (const point of points) {
    const dx = point[0] - center[0];
    const dy = point[1] - center[1];
    const angle = Math.atan2(dy, dx);
    const wrapped = angle < 0 ? angle + Math.PI * 2 : angle;
    const binIndex = clamp(Math.floor((wrapped / (Math.PI * 2)) * sectors), 0, sectors - 1);
    const radius = Math.hypot(dx, dy);
    const current = bins[binIndex];
    if (radius > current.radius) {
      current.radius = radius;
      current.point = point;
    }
  }
  const occupied = bins.filter((bin) => bin.point);
  if (occupied.length < 3) return convexHullPoints(points);
  const meanRadius = occupied.reduce((sum, bin) => sum + bin.radius, 0) / occupied.length;
  return occupied.map((bin) => {
    const angle = ((bin.index + 0.5) / sectors) * Math.PI * 2;
    const radius = lerp(meanRadius, bin.radius, alpha) + padding;
    return [
      roundPoint(center[0] + Math.cos(angle) * radius),
      roundPoint(center[1] + Math.sin(angle) * radius),
    ];
  });
}

function principalPointBasis(points, center) {
  let xx = 0;
  let yy = 0;
  let xy = 0;
  for (const point of points) {
    const dx = point[0] - center[0];
    const dy = point[1] - center[1];
    xx += dx * dx;
    yy += dy * dy;
    xy += dx * dy;
  }
  const angle = Math.abs(xy) < 1e-9 && Math.abs(xx - yy) < 1e-9
    ? 0
    : 0.5 * Math.atan2(2 * xy, xx - yy);
  const axis = normalize([Math.cos(angle), Math.sin(angle)]);
  return {
    axis,
    normal: normalize([-axis[1], axis[0]]),
  };
}

function pointFromPrincipal(center, basis, s, n) {
  return [
    roundPoint(center[0] + basis.axis[0] * s + basis.normal[0] * n),
    roundPoint(center[1] + basis.axis[1] * s + basis.normal[1] * n),
  ];
}

function cross2(origin, a, b) {
  return (a[0] - origin[0]) * (b[1] - origin[1]) - (a[1] - origin[1]) * (b[0] - origin[0]);
}

function padPolygonFromCentroid(points, padding) {
  const center = averagePoint2(points);
  return points.map((point) => {
    const dir = normalize([point[0] - center[0], point[1] - center[1]]);
    return [
      roundPoint(point[0] + dir[0] * padding),
      roundPoint(point[1] + dir[1] * padding),
    ];
  });
}

function averagePoint2(points) {
  const sum = points.reduce((acc, point) => [acc[0] + point[0], acc[1] + point[1]], [0, 0]);
  return [sum[0] / points.length, sum[1] / points.length];
}

function smoothClosedPolygon(points, iterations) {
  let current = points;
  for (let iteration = 0; iteration < iterations; iteration++) {
    const next = [];
    for (let i = 0; i < current.length; i++) {
      const a = current[i];
      const b = current[(i + 1) % current.length];
      next.push([roundPoint(lerp(a[0], b[0], 0.25)), roundPoint(lerp(a[1], b[1], 0.25))]);
      next.push([roundPoint(lerp(a[0], b[0], 0.75)), roundPoint(lerp(a[1], b[1], 0.75))]);
    }
    current = next;
  }
  return current;
}

function decimateClosedPolygon(points, maxPoints) {
  if (points.length <= maxPoints) return points;
  const out = [];
  for (let i = 0; i < maxPoints; i++) {
    out.push(points[Math.floor((i * points.length) / maxPoints)]);
  }
  return out;
}

function markGeometryPoints(mark) {
  if (!mark || typeof mark !== 'object') return [];
  if (Array.isArray(mark.points)) return mark.points;
  if (mark.kind === 'circle' && Number.isFinite(mark.cx) && Number.isFinite(mark.cy)) {
    const r = finiteOr(mark.r, 0);
    return [
      [mark.cx - r, mark.cy],
      [mark.cx, mark.cy - r],
      [mark.cx + r, mark.cy],
      [mark.cx, mark.cy + r],
    ];
  }
  if (mark.kind === 'line') {
    return [
      [mark.x1, mark.y1],
      [mark.x2, mark.y2],
    ].filter((point) => point.every(Number.isFinite));
  }
  return [];
}

function stringSpawnGlyphMark({ mark, die, glyph, point, tangent, seed, stringIndex, glyphIndex, glyphCount, roleBase, budget }) {
  const id = glyph.id || glyph.family || glyph.kind || 'bead';
  const normal = normalize([-tangent[1], tangent[0]]);
  const sizeRange = normalizeRange(glyph.size ?? glyph.radius ?? glyph.r, 3, 8);
  const size = lerp(sizeRange[0], sizeRange[1], seededUnit(seed, 2));
  const offset = finiteOr(glyph.offset, 0) + (seededUnit(seed, 3) - 0.5) * finiteOr(glyph.offsetJitter, 0);
  const center = [roundPoint(point[0] + normal[0] * offset), roundPoint(point[1] + normal[1] * offset)];
  const opacity = round(clamp(finiteOr(glyph.opacity, finiteOr(mark.glyphOpacity, 0.78)), 0.02, 1));
  const common = {
    role: `${roleBase}:glyph-${String(glyphIndex + 1).padStart(2, '0')}`,
    opacity,
    z: finiteOr(mark.z, 30) + stringIndex * 0.002 + 0.01 + glyphIndex * 0.0001,
    algorithmic: true,
    algorithm: 'pastamaker',
    pass: mark.pass || 'string-spawn-glyph',
    pastamaker: {
      dieFamily: 'stringSpawn',
      fieldKind: 'alongPath',
      glyphId: id,
      budgetMode: budget.mode,
      targetOpacity: budget.targetOpacity,
      expectedOverlapCount: budget.expectedOverlapCount,
      stringIndex,
      glyphIndex,
    },
    stickerFieldRole: mark.role,
    stickerFieldIndex: stringIndex,
    stickerFieldCount: glyphCount,
    stickerFieldT: round(glyphCount === 1 ? 0.5 : glyphIndex / (glyphCount - 1)),
    stringSpawnRole: mark.role,
    stringSpawnIndex: stringIndex,
    stringSpawnGlyphIndex: glyphIndex,
    stringSpawnKind: 'glyph',
  };
  const stroke = glyph.stroke || mark.glyphStroke || die.glyphStroke || mark.stroke || die.stroke || '#f5e6b8';
  const fill = glyph.fill || mark.glyphFill || die.glyphFill || mark.fill || die.fill || stroke;
  if (id === 'spark' || id === 'dash' || id === 'thorn') {
    const length = finiteOr(glyph.length, size * 2.4);
    const dir = id === 'thorn' ? normal : tangent;
    return {
      ...common,
      kind: 'line',
      x1: roundPoint(center[0] - dir[0] * length / 2),
      y1: roundPoint(center[1] - dir[1] * length / 2),
      x2: roundPoint(center[0] + dir[0] * length / 2),
      y2: roundPoint(center[1] + dir[1] * length / 2),
      stroke,
      strokeWidth: finiteOr(glyph.strokeWidth, 1),
    };
  }
  if (id === 'leaf') {
    const angle = Math.atan2(tangent[1], tangent[0]) + (seededUnit(seed, 4) - 0.5) * 0.8;
    return {
      ...common,
      kind: 'polygon',
      points: rotatedEllipsePoints(center[0], center[1], size * 0.62, size, 8, angle),
      fill,
      stroke,
      strokeWidth: finiteOr(glyph.strokeWidth, 0.7),
    };
  }
  return {
    ...common,
    kind: 'circle',
    cx: center[0],
    cy: center[1],
    r: roundPoint(size),
    fill,
    stroke,
    strokeWidth: finiteOr(glyph.strokeWidth, 0.7),
  };
}

function expandAlongPathBubblingField(mark, field, die) {
  const points = pathPointsFor(field);
  if (points.length < 2) {
    throw new Error(`stickerField '${mark.role || '(anonymous)'}' field.points must contain at least two [x,y] points`);
  }
  if (isKingKrispiesFamily(die.family || die.kind) && (Array.isArray(field.anchors) || Number.isFinite(Number(field.anchorCount)))) {
    return expandKingKrispiesAnchorField(mark, field, die, points);
  }
  const generations = Math.max(1, Math.min(9, Math.round(finiteOr(field.generations ?? die.generations, 5))));
  const targetCount = Math.max(2, Math.min(420, Math.round(finiteOr(field.count, (2 ** generations) + 1))));
  const lateralRange = normalizeRange(field.lateralJitter ?? die.lateralJitter, 0, 0);
  const tValues = bubblingTValues(generations).slice(0, targetCount);
  const seed = hashString(`${mark.role || 'stickerField'}:bubbling:path:${targetCount}:${points.map((p) => p.join(',')).join('|')}`);
  const budget = resolveValueBudget(mark.valueBudget, {
    targetOpacity: finiteOr(mark.opacity, 0.5),
    expectedOverlapCount: Math.max(1, Math.min(targetCount, Math.round(targetCount / 8))),
    mode: 'inverse-count',
  });
  const opacity = opacityForBudget(budget.targetOpacity, budget.expectedOverlapCount, budget.mode);

  return tValues.map(({ t, generation }, i) => {
    const sample = sampleGesture(points, t);
    const tangent = sample?.tangent || [1, 0];
    const normal = normalize([-tangent[1], tangent[0]]);
    const noise = deterministicWave(seed, i, t);
    const lateral = lerp(lateralRange[0], lateralRange[1], wrap01(t * 1.91 + noise * 0.09));
    const center = sample
      ? [sample.point[0] + normal[0] * lateral, sample.point[1] + normal[1] * lateral]
      : [0, 0];
    return bubblingCircleMark({
      mark,
      die,
      field,
      index: i,
      count: tValues.length,
      generation,
      center,
      opacity,
      budget,
      seed,
      family: 'kingKrispies',
    });
  });
}

function expandKingKrispiesAnchorField(mark, field, die, points) {
  const generations = Math.max(1, Math.min(9, Math.round(finiteOr(field.generations ?? die.generations, 5))));
  const targetCount = Math.max(2, Math.min(420, Math.round(finiteOr(field.count, (2 ** generations) + 1))));
  const anchorCount = Math.max(2, Math.min(12, Math.round(finiteOr(field.anchorCount ?? die.anchorCount, 4))));
  const anchorScale = normalizeRange(field.anchorScale ?? die.anchorScale, 1.65, 3.2);
  const separation = normalizeRange(field.anchorSeparation ?? die.anchorSeparation, 0.12, 0.34);
  const lateralRange = normalizeRange(field.lateralJitter ?? die.lateralJitter, -18, 18);
  const seed = hashString(`${mark.role || 'stickerField'}:kingKrispies:anchors:${targetCount}:${points.map((p) => p.join(',')).join('|')}`);
  const budget = resolveValueBudget(mark.valueBudget, {
    targetOpacity: finiteOr(mark.opacity, 0.62),
    expectedOverlapCount: Math.max(1, Math.min(targetCount, Math.round(targetCount / 8))),
    mode: 'inverse-count',
  });
  const opacity = opacityForBudget(budget.targetOpacity, budget.expectedOverlapCount, budget.mode);
  const anchors = kingKrispiesAnchors(field, points, anchorCount, lateralRange, separation, seed);
  const out = [];

  anchors.forEach((anchor, i) => {
    out.push(bubblingCircleMark({
      mark,
      die,
      field,
      index: out.length,
      count: targetCount,
      generation: generations,
      center: anchor.center,
      opacity,
      budget,
      seed,
      family: 'kingKrispies',
      radiusMultiplier: lerp(anchorScale[0], anchorScale[1], seededUnit(seed, i + 71)),
      anchorRole: 'large-anchor',
    }));
  });

  const tValues = bubblingTValues(generations);
  let cursor = 0;
  while (out.length < targetCount) {
    const item = tValues[cursor % tValues.length];
    const anchorA = anchors[cursor % anchors.length];
    const anchorB = anchors[(cursor + 1 + Math.floor(cursor / Math.max(anchors.length, 1))) % anchors.length];
    const mix = item.t;
    const wave = deterministicWave(seed, cursor, mix);
    const cx = lerp(anchorA.center[0], anchorB.center[0], mix) + wave * finiteOr(field.noise, 20);
    const cy = lerp(anchorA.center[1], anchorB.center[1], mix) + deterministicWave(seed, cursor + 11, mix) * finiteOr(field.noise, 20);
    out.push(bubblingCircleMark({
      mark,
      die,
      field,
      index: out.length,
      count: targetCount,
      generation: Math.max(item.generation, 1),
      center: [cx, cy],
      opacity,
      budget,
      seed,
      family: 'kingKrispies',
      radiusMultiplier: lerp(0.72, 1.28, seededUnit(seed, cursor + 101)),
      anchorRole: 'satellite',
    }));
    cursor += 1;
  }
  return out;
}

function kingKrispiesAnchors(field, points, anchorCount, lateralRange, separation, seed) {
  if (Array.isArray(field.anchors)) {
    const anchors = field.anchors.map((anchor, index) => {
      const center = validPoint(anchor.center || anchor.anchor || anchor);
      return center ? { center, index } : null;
    }).filter(Boolean);
    if (anchors.length >= 2) return anchors.slice(0, anchorCount);
  }
  const anchors = [];
  for (let i = 0; i < anchorCount; i++) {
    const baseT = anchorCount === 1 ? 0.5 : i / (anchorCount - 1);
    const sep = lerp(separation[0], separation[1], seededUnit(seed, i + 17));
    const t = clamp(baseT + (seededUnit(seed, i + 23) - 0.5) * sep, 0, 1);
    const sample = sampleGesture(points, t);
    const tangent = sample?.tangent || [1, 0];
    const normal = normalize([-tangent[1], tangent[0]]);
    const lateral = lerp(lateralRange[0], lateralRange[1], seededUnit(seed, i + 31));
    const center = sample
      ? [sample.point[0] + normal[0] * lateral, sample.point[1] + normal[1] * lateral]
      : [0, 0];
    anchors.push({ center, index: i });
  }
  return anchors;
}

function expandFillBoxBubblingField(mark, field, die) {
  const bounds = bubblingBounds(field);
  if (!bounds) {
    throw new Error(`stickerField '${mark.role || '(anonymous)'}' fillBox field requires bounds or x/y/width/height`);
  }
  const generations = Math.max(1, Math.min(8, Math.round(finiteOr(field.generations ?? die.generations, 5))));
  const lanes = Math.max(1, Math.min(18, Math.round(finiteOr(field.lanes ?? die.lanes, 5))));
  const targetCount = Math.max(2, Math.min(520, Math.round(finiteOr(field.count, lanes * ((2 ** generations) + 1)))));
  const seed = hashString(`${mark.role || 'stickerField'}:bubbling:box:${targetCount}:${bounds.x},${bounds.y},${bounds.width},${bounds.height}`);
  const budget = resolveValueBudget(mark.valueBudget, {
    targetOpacity: finiteOr(mark.opacity, 0.5),
    expectedOverlapCount: Math.max(1, Math.min(targetCount, Math.round(targetCount / 10))),
    mode: 'inverse-count',
  });
  const opacity = opacityForBudget(budget.targetOpacity, budget.expectedOverlapCount, budget.mode);
  const out = [];
  const perLane = bubblingTValues(generations);

  for (let lane = 0; lane < lanes && out.length < targetCount; lane++) {
    const laneT = lanes === 1 ? 0.5 : lane / (lanes - 1);
    const laneWave = deterministicWave(seed, lane, laneT);
    for (const item of perLane) {
      if (out.length >= targetCount) break;
      const index = out.length;
      const wobble = deterministicWave(seed, index, item.t);
      const x = bounds.x + bounds.width * item.t + wobble * finiteOr(field.noise, 10);
      const yBase = bounds.y + bounds.height * laneT;
      const y = yBase + laneWave * finiteOr(field.laneNoise, 12) + deterministicWave(seed, index + 7, laneT) * finiteOr(field.noise, 10);
      out.push(bubblingCircleMark({
        mark,
        die,
        field,
        index,
        count: targetCount,
        generation: item.generation,
        center: [
          clamp(x, bounds.x, bounds.x + bounds.width),
          clamp(y, bounds.y, bounds.y + bounds.height),
        ],
        opacity,
        budget,
        seed,
        family: 'bubbling',
      }));
    }
  }
  return out;
}

function expandOutwardBubblingField(mark, field, die) {
  const bounds = bubblingBounds(field);
  if (!bounds) {
    throw new Error(`stickerField '${mark.role || '(anonymous)'}' outwardFill field requires bounds or x/y/width/height`);
  }
  const generations = Math.max(1, Math.min(9, Math.round(finiteOr(field.generations ?? die.generations, 6))));
  const targetCount = Math.max(2, Math.min(620, Math.round(finiteOr(field.count, (2 ** generations) + 1))));
  const seed = hashString(`${mark.role || 'stickerField'}:bubbling:outward:${targetCount}:${bounds.x},${bounds.y},${bounds.width},${bounds.height}`);
  const budget = resolveValueBudget(mark.valueBudget, {
    targetOpacity: finiteOr(mark.opacity, 0.54),
    expectedOverlapCount: Math.max(1, Math.min(targetCount, Math.round(targetCount / 10))),
    mode: 'inverse-count',
  });
  const opacity = opacityForBudget(budget.targetOpacity, budget.expectedOverlapCount, budget.mode);
  const seeds = outwardBubblingSeeds(field, bounds);
  const centers = seeds.map((center, index) => ({ center, generation: 0, parentPair: index }));
  let intervals = [{ a: 0, b: 1, generation: 1, side: 1 }];
  const outward = clamp(finiteOr(field.outwardness ?? die.outwardness, 0.72), 0, 2);
  const noise = finiteOr(field.noise, 14);

  while (centers.length < targetCount && intervals.length) {
    const next = [];
    for (const interval of intervals) {
      if (centers.length >= targetCount) break;
      const a = centers[interval.a].center;
      const b = centers[interval.b].center;
      const mid = midpoint(a, b);
      const dir = normalize([b[0] - a[0], b[1] - a[1]]);
      const normal = [-dir[1], dir[0]];
      const generationT = clamp(interval.generation / Math.max(generations, 1), 0, 1);
      const amplitudeBase = Math.min(bounds.width, bounds.height) * 0.58 * outward * Math.pow(0.82, interval.generation - 1);
      const wave = deterministicWave(seed, centers.length, generationT);
      const side = interval.side * (seededUnit(seed, centers.length + 7) > 0.5 ? 1 : -1);
      const spread = amplitudeBase * side + wave * noise;
      const center = [
        clamp(mid[0] + normal[0] * spread + deterministicWave(seed, centers.length + 11, generationT) * noise, bounds.x, bounds.x + bounds.width),
        clamp(mid[1] + normal[1] * spread + deterministicWave(seed, centers.length + 17, generationT) * noise, bounds.y, bounds.y + bounds.height),
      ];
      const newIndex = centers.length;
      centers.push({ center, generation: interval.generation, parentPair: interval.a });
      next.push(
        { a: interval.a, b: newIndex, generation: interval.generation + 1, side: -side },
        { a: newIndex, b: interval.b, generation: interval.generation + 1, side },
      );
    }
    intervals = next;
  }

  return centers.slice(0, targetCount).map((item, index) =>
    bubblingCircleMark({
      mark,
      die,
      field,
      index,
      count: targetCount,
      generation: item.generation,
      center: item.center,
      opacity,
      budget,
      seed,
      family: 'bubbling',
      anchorRole: index < seeds.length ? 'seed' : 'outward-midpoint',
    }),
  );
}

function outwardBubblingSeeds(field, bounds) {
  if (Array.isArray(field.seeds)) {
    const seeds = field.seeds.map((seed) => validPoint(seed.center || seed.anchor || seed)).filter(Boolean);
    if (seeds.length >= 2) return seeds.slice(0, 2);
  }
  const y = bounds.y + bounds.height * 0.5;
  return [
    [bounds.x + bounds.width * 0.18, y],
    [bounds.x + bounds.width * 0.82, y],
  ];
}

function expandIguanaField(mark, field, die) {
  const bounds = bubblingBounds(field);
  if (!bounds) {
    throw new Error(`stickerField '${mark.role || '(anonymous)'}' iguana field requires bounds or x/y/width/height`);
  }
  const countInput = field.count ?? die.count;
  const countLimit = Number.isFinite(Number(countInput))
    ? Math.max(1, Math.round(Number(countInput)))
    : Number.POSITIVE_INFINITY;
  const baseR = Math.max(finiteOr(field.r ?? field.radius ?? die.r ?? die.radius, 8), 0.5);
  const rNoise = clamp(finiteOr(field.rNoise ?? field.radiusNoise ?? die.rNoise ?? die.radiusNoise, 0), 0, 0.9);
  const spacing = Math.max(finiteOr(field.spacing ?? die.spacing, 0.08), 0);
  const corner = String(field.corner || die.corner || 'top-left');
  const seed = hashString(`${mark.role || 'stickerField'}:iguana:${Number.isFinite(countLimit) ? countLimit : 'fill'}:${bounds.x},${bounds.y},${bounds.width},${bounds.height}:${baseR}`);
  const budget = resolveValueBudget(mark.valueBudget, {
    targetOpacity: finiteOr(mark.opacity, 0.72),
    expectedOverlapCount: 1,
    mode: 'inverse-count',
  });
  const opacity = opacityForBudget(budget.targetOpacity, budget.expectedOverlapCount, budget.mode);
  const centers = iguanaPackCenters({ bounds, baseR, rNoise, spacing, corner, seed, countLimit });
  const out = [];
  centers.forEach((cell, circleIndex) => {
    const glyphIndex = Math.floor(circleIndex / 3);
    out.push({
      kind: 'circle',
      role: `${mark.role || 'iguana'}:circle-${String(circleIndex + 1).padStart(3, '0')}`,
      cx: roundPoint(cell.center[0]),
      cy: roundPoint(cell.center[1]),
      r: roundPoint(cell.r),
      fill: choosePaletteValue(mark.style?.palette || field.palette || die.palette, circleIndex) ||
        mark.fill ||
        die.fill ||
        '#d6f2c2',
      stroke: mark.stroke || die.stroke || '#0f1a12',
      strokeWidth: finiteOr(mark.strokeWidth, finiteOr(die.strokeWidth, 0.8)),
      opacity,
      z: finiteOr(mark.z, 30) + circleIndex * 0.001,
      algorithmic: true,
      algorithm: 'pastamaker',
      pass: mark.pass || 'iguana',
      pastamaker: {
        dieFamily: 'iguana',
        fieldKind: field.kind || 'fillBox',
        packingMode: 'continuous-tangent-field',
        glyphRule: 'three-circle-tangent',
        glyphIndex,
        glyphCircleIndex: circleIndex % 3,
        glyphCircleCount: 3,
        collisionIndex: cell.collisionIndex || 'spatial-grid',
        budgetMode: budget.mode,
        targetOpacity: budget.targetOpacity,
        expectedOverlapCount: budget.expectedOverlapCount,
        r: roundPoint(cell.r),
        rNoise,
        spacing,
        corner,
      },
      stickerFieldRole: mark.role,
      stickerFieldIndex: circleIndex,
      stickerFieldCount: centers.length,
      stickerFieldT: round(centers.length <= 1 ? 0.5 : circleIndex / (centers.length - 1)),
    });
  });
  return out;
}

function iguanaPackCenters({ bounds, baseR, rNoise, spacing, corner, seed, countLimit }) {
  const stepX = baseR * 2 * (1 + spacing);
  const stepY = baseR * Math.sqrt(3) * (1 + spacing);
  const cols = Math.max(1, Math.ceil(bounds.width / Math.max(stepX, 1)) + 2);
  const rows = Math.max(1, Math.ceil(bounds.height / Math.max(stepY, 1)) + 2);
  const maxR = baseR * (1 + rNoise);
  const padding = Math.max(baseR * spacing * 0.5, 0);
  const cellSize = Math.max(1, (maxR * 2) + padding);
  const candidates = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const t = candidates.length;
      const r = Math.max(0.5, baseR * (1 + (seededUnit(seed, t + 5) - 0.5) * 2 * rNoise));
      const x = bounds.x + r + col * stepX + (row % 2) * stepX * 0.5;
      const y = bounds.y + r + row * stepY;
      const point = orientIguanaPoint({ x, y, bounds, corner });
      candidates.push({
        center: [point.x, point.y],
        r,
      });
    }
  }
  candidates.sort((a, b) => iguanaCornerDistance(a.center, bounds, corner) - iguanaCornerDistance(b.center, bounds, corner));
  const accepted = [];
  const spatial = new Map();
  for (const candidate of candidates) {
    if (accepted.length >= countLimit) break;
    if (!iguanaCircleFits(candidate, bounds)) continue;
    if (!iguanaSpatialOverlaps(candidate, spatial, cellSize, maxR, padding)) {
      const cell = { ...candidate, collisionIndex: 'spatial-grid' };
      accepted.push(cell);
      iguanaSpatialInsert(cell, spatial, cellSize);
    }
  }
  return accepted;
}

function iguanaSpatialKey(ix, iy) {
  return `${ix},${iy}`;
}

function iguanaSpatialCell(point, cellSize) {
  return [
    Math.floor(point[0] / cellSize),
    Math.floor(point[1] / cellSize),
  ];
}

function iguanaSpatialInsert(item, spatial, cellSize) {
  const [ix, iy] = iguanaSpatialCell(item.center, cellSize);
  const key = iguanaSpatialKey(ix, iy);
  const bucket = spatial.get(key);
  if (bucket) bucket.push(item);
  else spatial.set(key, [item]);
}

function iguanaSpatialOverlaps(candidate, spatial, cellSize, maxR, padding) {
  const [ix, iy] = iguanaSpatialCell(candidate.center, cellSize);
  const range = Math.max(1, Math.ceil((candidate.r + maxR + padding) / cellSize));
  for (let y = iy - range; y <= iy + range; y++) {
    for (let x = ix - range; x <= ix + range; x++) {
      const bucket = spatial.get(iguanaSpatialKey(x, y));
      if (!bucket) continue;
      for (const item of bucket) {
        if (
          Math.hypot(item.center[0] - candidate.center[0], item.center[1] - candidate.center[1]) <
            item.r + candidate.r + padding
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

function orientIguanaPoint({ x, y, bounds, corner }) {
  const right = corner.includes('right');
  const bottom = corner.includes('bottom');
  return {
    x: right ? bounds.x + bounds.width - (x - bounds.x) : x,
    y: bottom ? bounds.y + bounds.height - (y - bounds.y) : y,
  };
}

function iguanaCornerDistance(point, bounds, corner) {
  const x = corner.includes('right') ? bounds.x + bounds.width : bounds.x;
  const y = corner.includes('bottom') ? bounds.y + bounds.height : bounds.y;
  return Math.hypot(point[0] - x, point[1] - y);
}

function iguanaCircleFits(candidate, bounds) {
  return candidate.center[0] - candidate.r >= bounds.x &&
    candidate.center[0] + candidate.r <= bounds.x + bounds.width &&
    candidate.center[1] - candidate.r >= bounds.y &&
    candidate.center[1] + candidate.r <= bounds.y + bounds.height;
}

function bubblingTValues(generations) {
  const out = [
    { t: 0, generation: 0 },
    { t: 1, generation: 0 },
  ];
  let intervals = [[0, 1]];
  for (let generation = 1; generation <= generations; generation++) {
    const next = [];
    for (const [a, b] of intervals) {
      const mid = (a + b) / 2;
      out.push({ t: mid, generation });
      next.push([a, mid], [mid, b]);
    }
    intervals = next;
  }
  return out.sort((a, b) => a.t - b.t || a.generation - b.generation);
}

function bubblingCircleMark({ mark, die, field, index, count, generation, center, opacity, budget, seed, family, radiusMultiplier = 1, anchorRole }) {
  const radiusRange = normalizeRange(die.radius ?? field.radius, 2, 14);
  const rampRange = normalizeRange(field.sizingScaleRamp ?? die.sizingScaleRamp ?? field.scaleRamp ?? die.scaleRamp, 0.78, 1.35);
  const consistency = clamp(finiteOr(field.consistencySize ?? die.consistencySize ?? field.consistency ?? die.consistency, 0.62), 0, 1);
  const generationT = generation <= 0 ? 0 : clamp(generation / Math.max(finiteOr(field.generations ?? die.generations, generation), 1), 0, 1);
  const baseRadius = lerp(radiusRange[0], radiusRange[1], generationT);
  const ramp = lerp(rampRange[0], rampRange[1], generationT);
  const noisy = 0.55 + seededUnit(seed, index + 13) * 0.9;
  const noiseScale = lerp(noisy, 1, consistency);
  const radius = Math.max(0.5, baseRadius * ramp * noiseScale * radiusMultiplier);
  return {
    kind: 'circle',
    role: `${mark.role || 'sticker-field'}:${String(index + 1).padStart(3, '0')}`,
    cx: roundPoint(center[0]),
    cy: roundPoint(center[1]),
    r: roundPoint(radius),
    fill: mark.fill || die.fill || field.fill || '#f4f0d8',
    stroke: mark.stroke || die.stroke || field.stroke || '#1c1c24',
    strokeWidth: finiteOr(mark.strokeWidth, finiteOr(die.strokeWidth, 1)),
    opacity,
    z: finiteOr(mark.z, 30) + index * 0.002,
    algorithmic: true,
    algorithm: 'pastamaker',
    pass: mark.pass || family,
    pastamaker: {
      dieFamily: family,
      fieldKind: field.kind || 'fillBox',
      budgetMode: budget.mode,
      targetOpacity: budget.targetOpacity,
      expectedOverlapCount: budget.expectedOverlapCount,
      generation,
      anchorRole,
      sizingScaleRamp: rampRange,
      consistencySize: consistency,
    },
    stickerFieldRole: mark.role,
    stickerFieldIndex: index,
    stickerFieldCount: count,
    stickerFieldT: round(count === 1 ? 0.5 : index / (count - 1)),
  };
}

function bubblingBounds(field) {
  const raw = field.bounds && typeof field.bounds === 'object' && !Array.isArray(field.bounds)
    ? field.bounds
    : field;
  const x = finiteOr(raw.x, NaN);
  const y = finiteOr(raw.y, NaN);
  const width = finiteOr(raw.width ?? raw.w, NaN);
  const height = finiteOr(raw.height ?? raw.h, NaN);
  return [x, y, width, height].every(Number.isFinite)
    ? { x, y, width: Math.max(width, 1), height: Math.max(height, 1) }
    : null;
}

function pathPointsFor(field) {
  if (Array.isArray(field.points)) {
    return field.points.filter(validPoint);
  }
  const from = validPoint(field.from);
  const to = validPoint(field.to);
  return from && to ? [from, to] : [];
}

function aroundRingBasis(mark, field, byRole) {
  const center = validPoint(field.center);
  if (!center) {
    throw new Error(`stickerField '${mark.role || '(anonymous)'}' field.center must be [x,y]`);
  }
  const radius = normalizeRange(field.radius, 40, 120);
  let innerRadius = Math.max(1, radius[0]);
  const outerRadius = Math.max(innerRadius + 1, radius[1]);
  const occluder = mark.constraints?.occludeBy ? byRole.get(mark.constraints.occludeBy) : null;
  if (mark.constraints?.preserveVoid && occluder?.kind === 'circle') {
    innerRadius = Math.max(innerRadius, finiteOr(occluder.r, 0) + 2);
  }
  const count = Math.max(1, Math.min(220, Math.round(finiteOr(field.count, 24))));
  return { center, innerRadius, outerRadius, count };
}

function annularPatchPoints(center, innerRadius, outerRadius, start, end, pointCount) {
  const outer = ellipseArcPoints(center[0], center[1], outerRadius, outerRadius, pointCount, start, end);
  const inner = ellipseArcPoints(center[0], center[1], innerRadius, innerRadius, pointCount, end, start);
  return outer.concat(inner);
}

function normalizeRange(value, fallbackMin, fallbackMax) {
  if (Array.isArray(value) && value.length >= 2) {
    const a = finiteOr(value[0], fallbackMin);
    const b = finiteOr(value[1], fallbackMax);
    return [Math.min(a, b), Math.max(a, b)];
  }
  if (Number.isFinite(value)) return [value, value];
  return [fallbackMin, fallbackMax];
}

function fieldBiasAt(biases, angleFraction) {
  if (!Array.isArray(biases)) return { strength: 0 };
  let strength = 0;
  for (const bias of biases) {
    if (!bias || typeof bias !== 'object') continue;
    const from = wrap01(finiteOr(bias.from, 0));
    const to = wrap01(finiteOr(bias.to, 1));
    const inside = from <= to
      ? angleFraction >= from && angleFraction <= to
      : angleFraction >= from || angleFraction <= to;
    if (inside) {
      strength = Math.max(strength, clamp((finiteOr(bias.weight, 1) - 1) / 4, 0, 1));
    }
  }
  return { strength };
}

function choosePaletteValue(palette, index) {
  if (!Array.isArray(palette) || palette.length === 0) return null;
  return palette[index % palette.length];
}

function wrap01(value) {
  const n = value % 1;
  return n < 0 ? n + 1 : n;
}

function validPoint(point) {
  return Array.isArray(point) && point.length === 2 && Number.isFinite(point[0]) && Number.isFinite(point[1])
    ? point
    : null;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpPoint(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
}

function isShadowAlgorithm(value) {
  return value === 'convex-value-stack' || value === 'form-light-stack';
}

function isHighlightAlgorithm(value) {
  return value === 'simple-highlight' || value === 'form-light-stack';
}

function hasFormLighting(mark) {
  return isShadowAlgorithm(mark?.shade?.algorithm) || isHighlightAlgorithm(mark?.highlights?.algorithm);
}

function resolveGestureMarks(marks, gesture) {
  if (!gesture || typeof gesture !== 'object' || !Array.isArray(gesture.points) || gesture.points.length < 2) {
    return marks;
  }
  return marks.map((mark) => resolveGestureMark(mark, gesture));
}

function synthesizeDynamicSkeletonMarks(marks, gesture, scene = {}) {
  const skeleton = gesture?.dynamicSkeleton;
  const crossGesture = gesture?.crossGesture || gesture?.cross || skeleton?.crossGesture;
  if (!skeleton || typeof skeleton !== 'object' || !Array.isArray(gesture?.points) || gesture.points.length < 2) {
    return marks;
  }
  const axes = {
    main: gesture,
    body: gesture,
    gesture,
    cross: crossGesture,
    crossGesture,
    activeArm: crossGesture,
  };
  const anchors = dynamicSkeletonAnchors(skeleton);
  const sampled = [];
  for (const spec of anchors) {
    const axis = axes[spec.axis || spec.gesture || 'main'];
    const sample = axis?.points ? sampleGesture(axis.points, finiteOr(spec.gestureT, spec.t ?? 0.5)) : null;
    if (!sample) continue;
    sampled.push({ ...spec, sample: offsetGestureSample(sample, spec), axisKind: axis.kind || spec.axis || 'gesture' });
  }
  if (!sampled.length) return marks;
  const byRole = new Map(sampled.map((item) => [item.role, item]));
  const generated = [
    ...sampled.map((item, index) => dynamicSkeletonAnchorMark(item, index, skeleton, scene)),
    ...dynamicSkeletonConnectionMarks(dynamicSkeletonConnections(skeleton), byRole, skeleton, scene),
  ];
  return [...marks, ...generated];
}

function dynamicSkeletonAnchors(skeleton) {
  if (Array.isArray(skeleton.anchors) && skeleton.anchors.length) return skeleton.anchors;
  return [
    { role: 'head', axis: 'main', gestureT: 0.08, kind: 'core', radius: 22, zRole: 'head' },
    { role: 'torso-center', axis: 'main', gestureT: 0.42, kind: 'core', rx: 38, ry: 54, zRole: 'torso' },
    { role: 'pelvis', axis: 'main', gestureT: 0.72, kind: 'core', rx: 34, ry: 40, zRole: 'pelvis' },
    { role: 'left-hip', axis: 'main', gestureT: 0.74, offset: [-24, 0], kind: 'joint', radius: 12, zRole: 'hip', connects: ['pelvis', 'left-knee'] },
    { role: 'right-hip', axis: 'main', gestureT: 0.74, offset: [24, 0], kind: 'joint', radius: 12, zRole: 'hip', connects: ['pelvis', 'right-knee'] },
    { role: 'left-knee', axis: 'main', gestureT: 0.86, offset: [-20, 6], kind: 'joint', radius: 11, zRole: 'knee', connects: ['left-hip', 'left-ankle'] },
    { role: 'right-knee', axis: 'main', gestureT: 0.86, offset: [20, 6], kind: 'joint', radius: 11, zRole: 'knee', connects: ['right-hip', 'right-ankle'] },
    { role: 'left-ankle', axis: 'main', gestureT: 0.98, offset: [-18, 4], kind: 'joint', radius: 9, zRole: 'foot', connects: ['left-knee', 'left-foot'] },
    { role: 'right-ankle', axis: 'main', gestureT: 0.98, offset: [18, 4], kind: 'joint', radius: 9, zRole: 'foot', connects: ['right-knee', 'right-foot'] },
    { role: 'left-foot', axis: 'main', gestureT: 1, offset: [-32, 8], kind: 'joint', radius: 9, zRole: 'foot', connects: ['left-ankle'] },
    { role: 'right-foot', axis: 'main', gestureT: 1, offset: [32, 8], kind: 'joint', radius: 9, zRole: 'foot', connects: ['right-ankle'] },
    { role: 'active-shoulder', axis: 'cross', gestureT: 0.12, kind: 'joint', radius: 13, zRole: 'shoulder' },
    { role: 'active-elbow', axis: 'cross', gestureT: 0.55, kind: 'joint', radius: 12, zRole: 'elbow' },
    { role: 'active-hand', axis: 'cross', gestureT: 0.92, kind: 'joint', radius: 11, zRole: 'hand' },
  ];
}

function dynamicSkeletonConnections(skeleton) {
  if (Array.isArray(skeleton.connections) && skeleton.connections.length) return skeleton.connections;
  return [
    { from: 'active-shoulder', to: 'active-elbow', role: 'active-upper-arm', kind: 'limb' },
    { from: 'active-elbow', to: 'active-hand', role: 'active-forearm', kind: 'limb' },
    { from: 'torso-center', to: 'pelvis', role: 'torso-carry', kind: 'core-span' },
    { from: 'pelvis', to: 'left-hip', role: 'left-hip-carry', kind: 'joint-span', thickness: 10 },
    { from: 'pelvis', to: 'right-hip', role: 'right-hip-carry', kind: 'joint-span', thickness: 10 },
    { from: 'left-hip', to: 'left-knee', role: 'left-upper-leg', kind: 'limb' },
    { from: 'right-hip', to: 'right-knee', role: 'right-upper-leg', kind: 'limb' },
    { from: 'left-knee', to: 'left-ankle', role: 'left-lower-leg', kind: 'limb' },
    { from: 'right-knee', to: 'right-ankle', role: 'right-lower-leg', kind: 'limb' },
    { from: 'left-ankle', to: 'left-foot', role: 'left-foot-carry', kind: 'foot', thickness: 9 },
    { from: 'right-ankle', to: 'right-foot', role: 'right-foot-carry', kind: 'foot', thickness: 9 },
  ];
}

function offsetGestureSample(sample, spec) {
  const offset = Array.isArray(spec.offset) ? spec.offset : null;
  if (!offset || (!Number.isFinite(offset[0]) && !Number.isFinite(offset[1]))) return sample;
  const tangent = normalize(sample.tangent || [0, 1]);
  const normal = [-tangent[1], tangent[0]];
  const lateral = finiteOr(offset[0], 0);
  const along = finiteOr(offset[1], 0);
  return {
    ...sample,
    point: [
      sample.point[0] + normal[0] * lateral + tangent[0] * along,
      sample.point[1] + normal[1] * lateral + tangent[1] * along,
    ],
  };
}

function dynamicSkeletonAnchorMark(item, index, skeleton, scene) {
  const point = item.sample.point;
  const tangent = item.sample.tangent;
  const fill = item.fill || skeleton.fill || '#b1845e';
  const stroke = item.stroke || skeleton.stroke || '#4f3928';
  const role = item.role || `dynamic-skeleton-anchor-${index + 1}`;
  const z = dynamicSkeletonZ(item, skeleton, scene, index);
  const common = {
    role,
    anchor: [roundPoint(point[0]), roundPoint(point[1])],
    fill,
    stroke,
    z,
    dynamicSkeleton: true,
    dynamicSkeletonRole: role,
    dynamicSkeletonPart: item.kind || 'joint',
    dynamicSkeletonAxis: item.axis || item.gesture || 'main',
    dynamicSkeletonAxisKind: item.axisKind,
    dynamicSkeletonGestureT: finiteOr(item.gestureT, item.t ?? 0.5),
    dynamicSkeletonTangent: [roundPoint(tangent[0]), roundPoint(tangent[1])],
    jointConnects: item.connects,
    jointPlacement: item.placement || skeleton.jointPlacement || 'between-segments',
    eyeRelation: item.eyeRelation || skeleton.eyeRelation || 'top-closer',
  };
  if ((item.kind || '').includes('core') && role !== 'head') {
    return {
      ...common,
      kind: 'blob',
      rx: Math.max(finiteOr(item.rx, finiteOr(item.radius, 24)), 1),
      ry: Math.max(finiteOr(item.ry, finiteOr(item.radius, 34)), 1),
      rotation: Number.isFinite(item.rotation) ? item.rotation : rotationFromTangent(tangent),
      formPart: item.formPart || 'core',
    };
  }
  if (role === 'head') {
    return {
      ...common,
      kind: 'egg',
      rx: Math.max(finiteOr(item.rx, finiteOr(item.radius, 20)), 1),
      ry: Math.max(finiteOr(item.ry, finiteOr(item.radius, 24)), 1),
      rotation: Number.isFinite(item.rotation) ? item.rotation : rotationFromTangent(tangent),
      formPart: 'head',
    };
  }
  return {
    ...common,
    kind: 'sphere',
    r: Math.max(finiteOr(item.r, finiteOr(item.radius, 12)), 1),
    formPart: 'joint',
    jointVisible: item.visible !== false,
  };
}

function dynamicSkeletonConnectionMarks(connections, byRole, skeleton, scene) {
  return connections.flatMap((connection, index) => {
    const from = byRole.get(connection.from);
    const to = byRole.get(connection.to);
    if (!from || !to) return [];
    const a = from.sample.point;
    const b = to.sample.point;
    const midpoint = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const length = Math.max(Math.hypot(b[0] - a[0], b[1] - a[1]), 1);
    const tangent = normalize([b[0] - a[0], b[1] - a[1]]);
    const role = connection.role || `${connection.from}-to-${connection.to}`;
    return [{
      kind: 'blob',
      role,
      anchor: [roundPoint(midpoint[0]), roundPoint(midpoint[1])],
      rx: Math.max(finiteOr(connection.thickness, skeleton.limbThickness ?? 13), 1),
      ry: Math.max(finiteOr(connection.length, length / 2), 1),
      rotation: rotationFromTangent(tangent),
      fill: connection.fill || skeleton.fill || '#b1845e',
      stroke: connection.stroke || skeleton.stroke || '#4f3928',
      z: dynamicSkeletonConnectionZ(from, to, skeleton, scene, index),
      dynamicSkeleton: true,
      dynamicSkeletonRole: role,
      dynamicSkeletonPart: connection.kind || 'limb',
      dynamicSkeletonConnection: true,
      connects: [connection.from, connection.to],
      terminatesIntoJoints: true,
      jointMediated: true,
      formPart: connection.kind || 'limb',
    }];
  });
}

function dynamicSkeletonZ(item, skeleton, scene, index) {
  const base = finiteOr(skeleton.z, finiteOr(scene.view?.baseZ, 18));
  const rank = {
    pelvis: 0.1,
    torso: 0.3,
    shoulder: 0.55,
    elbow: 0.75,
    hand: 1,
    head: 0.9,
  }[item.zRole || item.role] ?? index * 0.04;
  const activeBoost = (item.axis || item.gesture) === 'cross' || (item.axis || item.gesture) === 'activeArm' ? 0.5 : 0;
  return round(base + rank + activeBoost);
}

function dynamicSkeletonConnectionZ(from, to, skeleton, scene, index) {
  const fromZ = dynamicSkeletonZ(from, skeleton, scene, index);
  const toZ = dynamicSkeletonZ(to, skeleton, scene, index + 1);
  return round((fromZ + toZ) / 2 - 0.03);
}

function resolveGestureMark(mark, gesture) {
  if (!mark || typeof mark !== 'object' || !Number.isFinite(mark.gestureT)) return mark;
  const sample = sampleGesture(gesture.points, mark.gestureT);
  if (!sample) return mark;

  const tangent = sample.tangent;
  const normal = normalize([-tangent[1], tangent[0]]);
  const offset = Array.isArray(mark.offset) ? mark.offset : [0, 0];
  const lateral = finiteOr(offset[0], 0);
  const along = finiteOr(offset[1], 0);
  const anchor = [
    roundPoint(sample.point[0] + normal[0] * lateral + tangent[0] * along),
    roundPoint(sample.point[1] + normal[1] * lateral + tangent[1] * along),
  ];
  const hasExplicitRotation = Number.isFinite(mark.rotation);
  const gestureRotation = rotationFromTangent(tangent);

  return {
    ...mark,
    anchor,
    rotation: hasExplicitRotation ? mark.rotation : gestureRotation,
    gestureResolved: true,
    gestureKind: gesture.kind || 'polyline',
    gesturePoint: [roundPoint(sample.point[0]), roundPoint(sample.point[1])],
    gestureTangent: [roundPoint(tangent[0]), roundPoint(tangent[1])],
    gestureRotation: round(gestureRotation),
    gestureRotationSource: hasExplicitRotation ? 'explicit' : 'tangent',
  };
}

function sampleGesture(points, t) {
  const clean = points.filter(
    (p) => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]),
  );
  if (clean.length < 2) return null;
  const clampedT = clamp(t, 0, 1);
  const segments = [];
  let total = 0;
  for (let i = 0; i < clean.length - 1; i++) {
    const a = clean[i];
    const b = clean[i + 1];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length <= 1e-9) continue;
    segments.push({ a, b, length });
    total += length;
  }
  if (!segments.length) return null;

  let remaining = clampedT * total;
  for (const segment of segments) {
    if (remaining > segment.length) {
      remaining -= segment.length;
      continue;
    }
    const localT = segment.length <= 1e-9 ? 0 : remaining / segment.length;
    return {
      point: [
        segment.a[0] + (segment.b[0] - segment.a[0]) * localT,
        segment.a[1] + (segment.b[1] - segment.a[1]) * localT,
      ],
      tangent: normalize([segment.b[0] - segment.a[0], segment.b[1] - segment.a[1]]),
    };
  }

  const last = segments[segments.length - 1];
  return {
    point: last.b,
    tangent: normalize([last.b[0] - last.a[0], last.b[1] - last.a[1]]),
  };
}

function rotationFromTangent(tangent) {
  return round(Math.atan2(tangent[1], tangent[0]) - Math.PI / 2);
}

function expandCompactSourceMarks(mark, index, scene, manifest = {}) {
  if (!mark || typeof mark !== 'object') return [mark];
  if (mark.kind === 'facePattern') {
    return [{ ...mark, sourceIndex: mark.sourceIndex ?? index }];
  }
  if (mark.kind === 'solidPreset') {
    return expandSolidPresetMark(mark, index, scene);
  }
  if (mark.kind === 'solid') {
    return expandSolidMark(mark, index, scene, manifest);
  }
  if (mark.kind === 'cylinder') {
    return expandCylinderMark(mark, index, scene);
  }
  if (mark.kind === 'volume') {
    return expandVolumeMark(mark, index, scene);
  }
  if (mark.kind === 'planePreset') {
    return expandPlanePresetMark(mark, index, scene);
  }
  if (mark.kind === 'plane') {
    return [expandPlaneMark(mark, index, scene)];
  }
  if (mark.kind === 'object') {
    return expandLibraryObjectMark(mark, index, scene);
  }
  if (mark.kind === 'boxNet') {
    return expandBoxNetMark(mark, index, scene, manifest);
  }
  if (mark.kind === 'sphere' || mark.kind === 'oval') {
    return [expandRoundPrimitiveMark(mark, index)];
  }
  if (mark.kind === 'egg') {
    return [expandEggMark(mark, index)];
  }
  if (mark.kind === 'blob' || mark.kind === 'ellipse') {
    return [expandBlobMark(mark, index)];
  }
  return [{ ...mark, sourceIndex: mark.sourceIndex ?? index }];
}

// Expand an authored `boxNet` mark into a furniture box-net's polygon/line
// marks: place the element through the room planner (footprint, support pins,
// meru height), then embed its data face-cards onto the box faces via the
// shared surface-quad embed. The result is ordinary screen-space polygon/line
// marks that flow through the rest of the pipeline like any base mark.
function expandBoxNetMark(mark, index, scene, manifest = {}) {
  const cameraPrimitive =
    manifest.cameraPrimitive ||
    scene.cameraPrimitive ||
    manifest.polygonizer?.cameraPrimitive ||
    manifest.scene?.cameraPrimitive;
  const roomBasis =
    mark.roomBasis ||
    cameraPrimitive?.roomBasis ||
    manifest.polygonizer?.roomBasis ||
    (manifest.polygonizer?.metamandala?.roomExtent
      ? { worldExtent: manifest.polygonizer.metamandala.roomExtent }
      : null);
  // Without a two-point camera + room basis there is nothing to place the
  // box-net into; pass the mark through unchanged rather than drop it silently.
  if (!cameraPrimitive || !roomBasis) {
    return [{ ...mark, sourceIndex: mark.sourceIndex ?? index }];
  }

  const element = {
    type: mark.type,
    surface: mark.surface || 'floor',
    anchor: Array.isArray(mark.anchor) ? mark.anchor : [0.5, 0.5],
    ...(Number.isFinite(mark.w) ? { w: mark.w } : {}),
    ...(Number.isFinite(mark.h) ? { h: mark.h } : {}),
    ...(Number.isFinite(mark.heightWorld) ? { heightWorld: mark.heightWorld } : {}),
    ...(mark.supportPattern ? { supportPattern: mark.supportPattern } : {}),
    ...(Number.isFinite(mark.supportRadius) ? { supportRadius: mark.supportRadius } : {}),
  };
  const plan = resolveRoomSceneElementPlan({ elements: [element], roomBasis }, roomBasis);
  const manji = projectRoomHeightManjis(plan, cameraPrimitive, roomBasis)[0];
  if (!manji) return [{ ...mark, sourceIndex: mark.sourceIndex ?? index }];

  const project = (world) => {
    const p = projectTwoPoint(world, cameraPrimitive, roomBasis);
    return { x: p[0], y: p[1] };
  };
  // Cylinder back-face culling needs a world camera position. A pinhole camera
  // declares one; a lerp-blend two-point camera doesn't, so estimate it from the
  // room basis (out in front of the near edge, at eye height) — good enough to
  // pick the camera-facing semicircle so legs don't render their back halves.
  const cameraPosition = cameraPrimitive.worldFraming?.cameraPosition || estimateCameraPosition(roomBasis);
  // Cascade: explicit per-element (mark.style) > per-scene (scene.renderStyle) >
  // per-manifest (polygonizer.renderStyle) > producer intent (mark.defaultStyle)
  // > hard fallback. Normalized so a value in either the furniture vocabulary
  // ('shaded'/'flat'/'wireframe') or the shared renderStyle vocabulary
  // ('painterly'/'topographic'/'wireframe') resolves to a builder mode.
  const style = normalizeFurnitureStyle(
    mark.style || scene.renderStyle || manifest.polygonizer?.renderStyle || mark.defaultStyle || 'shaded',
  );
  const built = buildFurnitureNet({ type: mark.type, manji, project, cameraPosition, style });
  if (!built.length) return [{ ...mark, sourceIndex: mark.sourceIndex ?? index }];

  // Far → near becomes ascending z, so the downstream paint-order sort draws
  // near faces last. Strip the internal `dist`, prefix roles, carry provenance.
  // When the camera is pinned (cropBox), shift the projected geometry by the
  // crop offset so furniture lands in the same window as the room frame.
  const [ox, oy] = Array.isArray(mark.cropOffset) ? mark.cropOffset : [0, 0];
  const sorted = [...built].sort((a, b) => b.dist - a.dist);
  const baseZ = finiteOr(mark.z, 40);
  return sorted.map((built_mark, i) => {
    const { dist, role, ...rest } = built_mark;
    const shifted = (ox || oy) ? shiftMarkXY(rest, ox, oy) : rest;
    return {
      ...shifted,
      z: baseZ + i * 0.001,
      role: role ? `${mark.role || 'boxNet'}:${role}` : (mark.role || 'boxNet'),
      boxNetType: mark.type,
      sourceIndex: index,
    };
  });
}

// Shift a screen-space polygon/line mark by (ox, oy).
function shiftMarkXY(m, ox, oy) {
  if (m.kind === 'line') return { ...m, x1: m.x1 + ox, y1: m.y1 + oy, x2: m.x2 + ox, y2: m.y2 + oy };
  if (Array.isArray(m.points)) return { ...m, points: m.points.map(([x, y]) => [x + ox, y + oy]) };
  return m;
}

// Estimate a world camera position for a lerp-blend room (which carries no
// explicit camera point): out beyond the near edge, centered, at eye height.
// Used only to orient cylinder back-face culling.
function estimateCameraPosition(roomBasis = {}) {
  const xr = Array.isArray(roomBasis.xRange) ? roomBasis.xRange : [-18, 18];
  const yr = Array.isArray(roomBasis.yRange) ? roomBasis.yRange : [8, -28];
  const cx = (finiteOr(xr[0], -18) + finiteOr(xr[1], 18)) / 2;
  const frontY = finiteOr(roomBasis.frontY, Math.max(yr[0], yr[1]));
  const backY = finiteOr(roomBasis.backY, Math.min(yr[0], yr[1]));
  const depth = Math.abs(frontY - backY) || 30;
  const z = finiteOr(roomBasis.worldExtent?.height, 11) * 0.45;
  return [cx, frontY + depth * 1.5, z];
}

function resolveFacePatternMarks(marks, scene = {}) {
  if (!Array.isArray(marks) || !marks.some((mark) => mark?.kind === 'facePattern')) return marks;
  const sourceFaces = marks.filter((mark) => mark?.kind !== 'facePattern');
  const out = [...sourceFaces];
  for (const pattern of marks.filter((mark) => mark?.kind === 'facePattern')) {
    out.push(...expandFacePatternMark(pattern, sourceFaces, scene));
  }
  return out;
}

function expandFacePatternMark(mark, sourceFaces, scene = {}) {
  const target = mark.target && typeof mark.target === 'object' && !Array.isArray(mark.target) ? mark.target : {};
  const solidRole = target.solidRole || target.role || mark.targetSolidRole || mark.solidRole;
  const faceName = target.face || mark.targetFace || mark.face || 'front';
  const face = sourceFaces.find((candidate) => (
    candidate?.sourceShape === 'plane' &&
    candidate?.solidRole === solidRole &&
    candidate?.face === faceName &&
    Array.isArray(candidate.points) &&
    candidate.points.length >= 4
  ));
  if (!face) return [];

  const boxes = facadeBayPatternBoxes(mark.pattern);
  const motifs = mark.motifs && typeof mark.motifs === 'object' && !Array.isArray(mark.motifs) ? mark.motifs : {};
  const fill = mark.fill || '#d8c3a2';
  const stroke = mark.stroke || '#2f241b';
  const accent = mark.accent || '#f2dfb8';
  const shadow = mark.shadow || '#473322';
  const baseZ = finiteOr(mark.z, finiteOr(face.z, finiteOr(scene.view?.baseZ, 10)) + 0.34);
  const common = {
    sourceIndex: mark.sourceIndex,
    sourceShape: 'face-detail',
    formFamily: 'vector',
    vectorKind: 'face-detail',
    facePatternRole: mark.role,
    facePatternBasis: mark.pattern?.basis || mark.pattern?.kind || 'facade-bays',
    manjiPatternRef: boxes.meta?.ref,
    manjiPatternKind: boxes.meta?.kind,
    manjiXRepeat: boxes.meta?.xRepeat,
    manjiYStacks: boxes.meta?.yStacks,
    manjiFrame: boxes.meta?.frame,
    architecturalMiniature: mark.language || 'architectural-miniature',
  };
  const out = [];

  boxes.cells.forEach((box, index) => {
    const motif = motifForCell(motifs.cell, box, index);
    if (!motif || motif === 'none') return;
    out.push(...miniatureMotifMarks({
      motif,
      box,
      face,
      role: `${face.solidRole}:${face.face}:${motif}-${box.row + 1}-${box.col + 1}`,
      fill,
      stroke,
      accent,
      shadow,
      baseZ: baseZ + index * 0.002,
      common,
    }));
  });

  if (motifs.lowerBand && boxes.lowerBand) {
    out.push(...miniatureMotifMarks({
      motif: motifs.lowerBand,
      box: boxes.lowerBand,
      face,
      role: `${face.solidRole}:${face.face}:${motifs.lowerBand}-band`,
      fill,
      stroke,
      accent,
      shadow,
      baseZ: baseZ + 0.12,
      common,
    }));
  }
  if (motifs.topBand && boxes.topBand) {
    out.push(...miniatureMotifMarks({
      motif: motifs.topBand,
      box: boxes.topBand,
      face,
      role: `${face.solidRole}:${face.face}:${motifs.topBand}`,
      fill,
      stroke,
      accent,
      shadow,
      baseZ: baseZ + 0.14,
      common,
    }));
  }
  if (motifs.verticalAccent && boxes.verticalAccent) {
    out.push(...miniatureMotifMarks({
      motif: motifs.verticalAccent,
      box: boxes.verticalAccent,
      face,
      role: `${face.solidRole}:${face.face}:${motifs.verticalAccent}`,
      fill,
      stroke,
      accent,
      shadow,
      baseZ: baseZ + 0.18,
      common,
    }));
  }

  return out;
}

function facadeBayPatternBoxes(pattern = {}) {
  if (pattern?.kind === 'manjiLevelRepeater') return manjiLevelRepeaterPatternBoxes(pattern);
  if (pattern?.kind === 'manjiFill') return manjiFillPatternBoxes(pattern);

  const subdivide = pattern.subdivide && typeof pattern.subdivide === 'object' && !Array.isArray(pattern.subdivide)
    ? pattern.subdivide
    : {};
  const cols = clamp(Math.round(finiteOr(subdivide.cols ?? pattern.cols, 5)), 1, 16);
  const rows = clamp(Math.round(finiteOr(subdivide.rows ?? pattern.rows, 6)), 1, 20);
  const margin = clamp(finiteOr(pattern.margin, 0.08), 0, 0.28);
  const gap = clamp(finiteOr(pattern.gap, 0.025), 0, 0.14);
  const topBandHeight = clamp(finiteOr(pattern.topBandHeight, 0.08), 0.02, 0.22);
  const lowerBandHeight = clamp(finiteOr(pattern.lowerBandHeight, 0.12), 0.04, 0.28);
  const usableU = 1 - margin * 2;
  const usableV = Math.max(0.1, 1 - margin * 2 - topBandHeight - lowerBandHeight);
  const cellW = (usableU - gap * (cols - 1)) / cols;
  const cellH = (usableV - gap * (rows - 1)) / rows;
  const skip = new Set((Array.isArray(pattern.skip) ? pattern.skip : [])
    .map((item) => `${Math.floor(finiteOr(item.col, -1))}:${Math.floor(finiteOr(item.row, -1))}`));
  const voids = Array.isArray(pattern.voids) ? pattern.voids : [];
  for (const item of voids) {
    skip.add(`${Math.floor(finiteOr(item.col, -1))}:${Math.floor(finiteOr(item.row, -1))}`);
  }
  const cells = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (skip.has(`${col}:${row}`)) continue;
      cells.push({
        role: 'cell',
        col,
        row,
        cols,
        rows,
        u: margin + col * (cellW + gap),
        v: margin + topBandHeight + row * (cellH + gap),
        w: Math.max(cellW, 0.001),
        h: Math.max(cellH, 0.001),
      });
    }
  }
  const verticalAccent = pattern.verticalAccent && typeof pattern.verticalAccent === 'object' && !Array.isArray(pattern.verticalAccent)
    ? pattern.verticalAccent
    : null;
  const accentCol = verticalAccent ? clamp(Math.floor(finiteOr(verticalAccent.col, cols - 1)), 0, cols - 1) : cols - 1;
  return {
    cells,
    meta: {
      kind: pattern.kind || 'facade-bays',
      ref: pattern.ref,
    },
    topBand: {
      role: 'topBand',
      u: margin,
      v: margin * 0.52,
      w: usableU,
      h: topBandHeight * 0.58,
    },
    lowerBand: {
      role: 'lowerBand',
      u: margin,
      v: 1 - margin - lowerBandHeight * 0.72,
      w: usableU,
      h: lowerBandHeight * 0.42,
    },
    verticalAccent: {
      role: verticalAccent?.role || 'verticalAccent',
      u: margin + accentCol * (cellW + gap),
      v: margin + topBandHeight,
      w: Math.max(cellW, 0.001),
      h: usableV,
      col: accentCol,
    },
  };
}

function manjiFillPatternBoxes(pattern = {}) {
  const boxes = facadeBayPatternBoxes({
    ...pattern,
    kind: 'mandalaFractal',
    basis: pattern.basis || 'manji-fill',
  });
  const cols = boxes.cells[0]?.cols || 1;
  const rows = boxes.cells[0]?.rows || 1;
  const frame = facadeManjiFrame({ cols, rows, ref: pattern.ref || 'manji-fill', kind: 'manjiFill' });
  return {
    ...boxes,
    cells: boxes.cells.map((cell) => ({
      ...cell,
      manjiPatternRef: pattern.ref || 'manji-fill',
      manjiPatternKind: 'manjiFill',
    })),
    meta: {
      ...(boxes.meta || {}),
      kind: 'manjiFill',
      ref: pattern.ref || boxes.meta?.ref,
      xRepeat: cols,
      yStacks: rows,
      frame,
    },
  };
}

function manjiLevelRepeaterPatternBoxes(pattern = {}) {
  const sequence = normalizeMotifSequence(pattern.sequence || pattern.level || pattern.motifs);
  const xRepeat = clamp(Math.round(finiteOr(pattern.xRepeat, pattern.repeatX ?? 1)), 1, 16);
  const yStacks = resolveManjiYStacks(pattern.yStacks ?? pattern.stacks ?? pattern.rows, 1);
  const cols = clamp(sequence.length * xRepeat, 1, 48);
  const rows = clamp(yStacks, 1, 40);
  const margin = clamp(finiteOr(pattern.margin, 0.08), 0, 0.28);
  const gap = clamp(finiteOr(pattern.gap, 0.025), 0, 0.14);
  const usableU = 1 - margin * 2;
  const usableV = 1 - margin * 2;
  const cellW = (usableU - gap * (cols - 1)) / cols;
  const cellH = (usableV - gap * (rows - 1)) / rows;
  const skip = new Set((Array.isArray(pattern.skip) ? pattern.skip : [])
    .map((item) => `${Math.floor(finiteOr(item.col, -1))}:${Math.floor(finiteOr(item.row, -1))}`));
  const cells = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (skip.has(`${col}:${row}`)) continue;
      const motif = sequence[col % sequence.length];
      cells.push({
        role: 'levelCell',
        col,
        row,
        cols,
        rows,
        motif,
        sequenceIndex: col % sequence.length,
        repeatIndex: Math.floor(col / sequence.length),
        manjiLevel: rows - row,
        manjiPatternRef: pattern.ref || 'level-repeater',
        manjiPatternKind: 'manjiLevelRepeater',
        u: margin + col * (cellW + gap),
        v: margin + row * (cellH + gap),
        w: Math.max(cellW, 0.001),
        h: Math.max(cellH, 0.001),
      });
    }
  }
  return {
    cells,
    meta: {
      kind: 'manjiLevelRepeater',
      ref: pattern.ref || 'level-repeater',
      sequence,
      xRepeat,
      yStacks: rows,
      frame: facadeManjiFrame({
        cols,
        rows,
        ref: pattern.ref || 'level-repeater',
        kind: 'manjiLevelRepeater',
      }),
    },
  };
}

function normalizeMotifSequence(sequence) {
  const raw = Array.isArray(sequence) ? sequence : ['french-window'];
  const normalized = raw
    .map((item) => (typeof item === 'string' ? item : item?.kind || item?.motif || null))
    .filter(Boolean);
  return normalized.length ? normalized : ['french-window'];
}

function resolveManjiYStacks(value, fallback = 1) {
  if (Number.isFinite(value)) return clamp(Math.round(value), 1, 40);
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of ['count', 'value', 'stacks', 'levels', 'fallback']) {
      if (Number.isFinite(value[key])) return clamp(Math.round(value[key]), 1, 40);
    }
  }
  return clamp(Math.round(finiteOr(fallback, 1)), 1, 40);
}

function facadeManjiFrame({ cols, rows, ref, kind }) {
  const program = cardinalManji3D({
    bar1: { axis: 'N-S', lengthScale: Math.max(cols / 4, 0.25) },
    bar2: { axis: 'E-W', lengthScale: 0.25 },
    bar3: { axis: 'Zenith-Nadir', lengthScale: Math.max(rows / 4, 0.25) },
  });
  const manji = evaluateManji3D(program);
  const cuboid = inscribedCuboid(manji);
  return {
    kind,
    ref,
    axes: program.bars.map((bar) => bar.axis),
    cuboid: {
      min: {
        x: round(cuboid.min.x),
        y: round(cuboid.min.y),
        z: round(cuboid.min.z),
      },
      max: {
        x: round(cuboid.max.x),
        y: round(cuboid.max.y),
        z: round(cuboid.max.z),
      },
    },
  };
}

function motifForCell(motif, box, index) {
  if (box?.motif) return box.motif;
  if (Array.isArray(motif)) return motif[index % motif.length];
  if (motif && typeof motif === 'object') {
    if (motif.fromPattern) return box?.motif || 'none';
    if (Array.isArray(motif.alternate)) return motif.alternate[index % motif.alternate.length];
    if (motif.kind) return motif.kind;
  }
  return motif || (box.role === 'cell' ? 'french-window' : null);
}

function miniatureMotifMarks({ motif, box, face, role, fill, stroke, accent, shadow, baseZ, common }) {
  const normalized = String(motif || '').trim().toLowerCase().replace(/[_\s]+/g, '-');
  if (normalized === 'french-window' || normalized === 'window' || normalized === 'frenchwindow') {
    return frenchWindowMarks({ box, face, role, fill, stroke, accent, shadow, baseZ, common });
  }
  if (normalized === 'balcony' || normalized === 'balcony-band') {
    return balconyMarks({ box, face, role, fill, stroke, accent, shadow, baseZ, common });
  }
  if (normalized === 'stairwell' || normalized === 'stairwell-strip') {
    return stairwellMarks({ box, face, role, fill, stroke, accent, shadow, baseZ, common });
  }
  if (normalized === 'cornice' || normalized === 'cap-band') {
    return corniceMarks({ box, face, role, fill, stroke, accent, shadow, baseZ, common });
  }
  return [];
}

function frenchWindowMarks({ box, face, role, fill, stroke, accent, shadow, baseZ, common }) {
  const frame = insetUvBox(box, 0.12, 0.1);
  const leftMid = faceUvPoint(face.points, frame.u + frame.w * 0.5, frame.v);
  const rightMid = faceUvPoint(face.points, frame.u + frame.w * 0.5, frame.v + frame.h);
  const horizA = faceUvPoint(face.points, frame.u, frame.v + frame.h * 0.48);
  const horizB = faceUvPoint(face.points, frame.u + frame.w, frame.v + frame.h * 0.48);
  return [
    facePolygonMark(`${role}:dark-glass`, face, frame, shadow, 'none', 0.58, baseZ, common, 'french-window'),
    facePolylineMark(`${role}:frame`, face, closedUvBoxPolyline(frame), stroke, 0.92, 1.15, baseZ + 0.01, common, 'french-window'),
    faceLineMark(`${role}:center-mullion`, leftMid, rightMid, accent, 0.82, 0.85, baseZ + 0.02, common, face, frame, 'french-window'),
    faceLineMark(`${role}:cross-mullion`, horizA, horizB, accent, 0.72, 0.75, baseZ + 0.021, common, face, frame, 'french-window'),
  ];
}

function balconyMarks({ box, face, role, fill, stroke, accent, shadow, baseZ, common }) {
  const slab = {
    u: box.u + box.w * 0.08,
    v: box.v + box.h * 0.64,
    w: box.w * 0.84,
    h: box.h * 0.14,
  };
  const railY = slab.v + slab.h * 0.25;
  const railA = faceUvPoint(face.points, slab.u, railY);
  const railB = faceUvPoint(face.points, slab.u + slab.w, railY);
  const out = [
    facePolygonMark(`${role}:slab`, face, slab, shadeHex(fill, 0.86), stroke, 0.82, baseZ, common, 'balcony', { projectsFromFace: true }),
    faceLineMark(`${role}:rail`, railA, railB, accent, 0.94, 1.15, baseZ + 0.02, common, face, slab, 'balcony'),
  ];
  const posts = Math.max(3, Math.round(finiteOr(box.cols, 5)));
  for (let i = 0; i < posts; i++) {
    const t = posts === 1 ? 0.5 : i / (posts - 1);
    const u = slab.u + slab.w * t;
    out.push(faceLineMark(
      `${role}:baluster-${i + 1}`,
      faceUvPoint(face.points, u, railY),
      faceUvPoint(face.points, u, slab.v + slab.h),
      stroke,
      0.72,
      0.55,
      baseZ + 0.025 + i * 0.001,
      common,
      face,
      slab,
      'balcony',
    ));
  }
  return out;
}

function stairwellMarks({ box, face, role, fill, stroke, accent, shadow, baseZ, common }) {
  const strip = insetUvBox(box, 0.18, 0.02);
  const out = [
    facePolygonMark(`${role}:strip`, face, strip, shadeHex(fill, 0.72), stroke, 0.42, baseZ, common, 'stairwell'),
  ];
  const steps = Math.max(4, Math.min(18, Math.round(finiteOr(box.rows, 8))));
  for (let i = 0; i < steps; i++) {
    const v0 = strip.v + (strip.h * i) / steps;
    const v1 = strip.v + (strip.h * (i + 0.72)) / steps;
    const flip = i % 2 === 1;
    const a = faceUvPoint(face.points, flip ? strip.u + strip.w : strip.u, v0);
    const b = faceUvPoint(face.points, flip ? strip.u : strip.u + strip.w, v1);
    out.push(faceLineMark(`${role}:switchback-${i + 1}`, a, b, accent, 0.78, 0.75, baseZ + 0.02 + i * 0.002, common, face, strip, 'stairwell'));
  }
  return out;
}

function corniceMarks({ box, face, role, fill, stroke, accent, shadow, baseZ, common }) {
  const band = insetUvBox(box, 0, 0.08);
  const shadowLineY = band.v + band.h;
  return [
    facePolygonMark(`${role}:cap`, face, band, shadeHex(fill, 1.12), stroke, 0.86, baseZ, common, 'cornice'),
    faceLineMark(
      `${role}:undershadow`,
      faceUvPoint(face.points, band.u, shadowLineY),
      faceUvPoint(face.points, band.u + band.w, shadowLineY),
      shadow,
      0.72,
      1.05,
      baseZ + 0.018,
      common,
      face,
      band,
      'cornice',
    ),
  ];
}

function facePolygonMark(role, face, uvBox, fill, stroke, opacity, z, common, motif, extra = {}) {
  return {
    ...common,
    ...extra,
    kind: 'polygon',
    role,
    points: faceUvQuad(face.points, uvBox),
    fill,
    stroke,
    strokeWidth: stroke === 'none' ? 0 : 0.75,
    opacity,
    z,
    faceAttachment: faceAttachment(face, uvBox, motif, common.facePatternRole),
  };
}

function facePolylineMark(role, face, uvPoints, stroke, opacity, strokeWidth, z, common, motif) {
  return {
    ...common,
    kind: 'polyline',
    role,
    points: uvPoints.map(([u, v]) => faceUvPoint(face.points, u, v)),
    stroke,
    strokeWidth,
    opacity,
    z,
    faceAttachment: faceAttachment(face, uvBounds(uvPoints), motif, common.facePatternRole),
  };
}

function faceLineMark(role, a, b, stroke, opacity, strokeWidth, z, common, face, uvBox, motif) {
  return {
    ...common,
    kind: 'line',
    role,
    x1: roundPoint(a[0]),
    y1: roundPoint(a[1]),
    x2: roundPoint(b[0]),
    y2: roundPoint(b[1]),
    stroke,
    strokeWidth,
    opacity,
    z,
    faceAttachment: faceAttachment(face, uvBox, motif, common.facePatternRole),
  };
}

function faceAttachment(face, uvBox, motif, patternRole) {
  return {
    solidRole: face.solidRole,
    face: face.face,
    patternRole,
    motif,
    uvBox: {
      u: round(clamp(finiteOr(uvBox.u, 0), 0, 1)),
      v: round(clamp(finiteOr(uvBox.v, 0), 0, 1)),
      w: round(clamp(finiteOr(uvBox.w, 0), 0, 1)),
      h: round(clamp(finiteOr(uvBox.h, 0), 0, 1)),
    },
  };
}

function faceUvQuad(points, box) {
  return [
    faceUvPoint(points, box.u, box.v),
    faceUvPoint(points, box.u + box.w, box.v),
    faceUvPoint(points, box.u + box.w, box.v + box.h),
    faceUvPoint(points, box.u, box.v + box.h),
  ];
}

function faceUvPoint(points, uRaw, vRaw) {
  const { topLeft, topRight, bottomRight, bottomLeft } = faceCorners(points);
  const u = clamp(finiteOr(uRaw, 0), -0.5, 1.5);
  const v = clamp(finiteOr(vRaw, 0), -0.5, 1.5);
  const top = lerpPoint(topLeft, topRight, u);
  const bottom = lerpPoint(bottomLeft, bottomRight, u);
  return lerpPoint(top, bottom, v).map(roundPoint);
}

function faceCorners(points) {
  const valid = Array.isArray(points) ? points.filter(validPoint) : [];
  if (valid.length < 4) {
    const fallback = valid[0] || [0, 0];
    return { topLeft: fallback, topRight: fallback, bottomRight: fallback, bottomLeft: fallback };
  }
  const sorted = [...valid].sort((a, b) => a[1] - b[1]);
  const top = sorted.slice(0, 2).sort((a, b) => a[0] - b[0]);
  const bottom = sorted.slice(-2).sort((a, b) => a[0] - b[0]);
  return {
    topLeft: top[0],
    topRight: top[1],
    bottomRight: bottom[1],
    bottomLeft: bottom[0],
  };
}

function insetUvBox(box, insetX = 0, insetY = insetX) {
  return {
    ...box,
    u: box.u + box.w * insetX,
    v: box.v + box.h * insetY,
    w: Math.max(box.w * (1 - insetX * 2), 0.001),
    h: Math.max(box.h * (1 - insetY * 2), 0.001),
  };
}

function closedUvBoxPolyline(box) {
  return [
    [box.u, box.v],
    [box.u + box.w, box.v],
    [box.u + box.w, box.v + box.h],
    [box.u, box.v + box.h],
    [box.u, box.v],
  ];
}

function uvBounds(points) {
  const xs = points.map((point) => finiteOr(point[0], 0));
  const ys = points.map((point) => finiteOr(point[1], 0));
  const minU = Math.min(...xs);
  const minV = Math.min(...ys);
  return {
    u: minU,
    v: minV,
    w: Math.max(...xs) - minU,
    h: Math.max(...ys) - minV,
  };
}

function expandSolidPresetMark(mark, index, scene) {
  const ref = mark.ref || mark.preset;
  if (ref === 'bookshelf') {
    return expandBookshelfSolidPreset(mark, index, scene);
  }
  throw new Error(`unknown solid preset '${ref || '(missing ref)'}'`);
}

function expandSolidMark(mark, index, scene, manifest = {}) {
  const ccaBox = resolveCcaSolidBox(mark, manifest);
  const origin = ccaBox?.origin || [
    finiteOr(mark.x, finiteOr(mark.anchor?.[0], 0)),
    finiteOr(mark.y, finiteOr(mark.anchor?.[1], 0)),
  ];
  const w = Math.max(finiteOr(ccaBox?.w, finiteOr(mark.width, finiteOr(mark.w, Array.isArray(mark.size) ? mark.size[0] : 80))), 1);
  const h = Math.max(finiteOr(ccaBox?.h, finiteOr(mark.height, finiteOr(mark.h, Array.isArray(mark.size) ? mark.size[1] : 80))), 1);
  const d = Math.max(finiteOr(ccaBox?.d, finiteOr(mark.depth, finiteOr(mark.d, Array.isArray(mark.size) ? mark.size[2] : 40))), 1);
  const z = finiteOr(mark.depthOffset, finiteOr(mark.z3, 0));
  const faceFilter = Array.isArray(mark.faces) ? new Set(mark.faces) : undefined;
  const facePolicy = resolveSolidFacePolicy(mark, faceFilter);
  if (ccaBox?.cornerProjection) {
    return expandCcaCornerCuboidPlanes({
      role: mark.role || `solid-${index + 1}`,
      projection: ccaBox.cornerProjection,
      fill: mark.fill || '#b1845e',
      stroke: mark.stroke || '#4f3928',
      strokeWidth: finiteOr(mark.strokeWidth, 0.9),
      sourceIndex: mark.sourceIndex ?? index,
      baseZ: finiteOr(mark.z, finiteOr(scene.view?.baseZ, 10)),
      vectorRole: mark.vectorRole || mark.role || `solid-${index + 1}`,
      faceFilter: facePolicy.filter,
    }).map((plane) => ({
      ...plane,
      ...facePolicyMetadata(facePolicy),
      ...solidOrientationMetadata(mark),
      constructionKind: mark.constructionKind,
      constructionRole: mark.constructionRole,
      formPrimitiveRole: mark.formPrimitiveRole,
      formPrimitiveMode: mark.formPrimitiveMode,
      formPrimitiveStock: mark.formPrimitiveStock,
      formMassTuning: mark.formMassTuning,
      speciesStock: mark.speciesStock,
      formPart: mark.formPart,
      partitionTarget: mark.partitionTarget,
      partitionAxis: mark.partitionAxis,
      partitionCount: mark.partitionCount,
      partitionBoardIndex: mark.partitionBoardIndex,
      partitionBoundary: mark.partitionBoundary,
      arrayIndex: mark.arrayIndex,
      arrayCount: mark.arrayCount,
      horizontalStackRole: mark.horizontalStackRole,
      horizontalStackMode: mark.horizontalStackMode,
      horizontalStackAxis: mark.horizontalStackAxis,
      horizontalStackActiveRay: mark.horizontalStackActiveRay,
      horizontalStackMemberRole: mark.horizontalStackMemberRole,
      horizontalStackMemberIndex: mark.horizontalStackMemberIndex,
      horizontalStackMemberCount: mark.horizontalStackMemberCount,
      horizontalStackMemberCollision: mark.horizontalStackMemberCollision,
      horizontalStackSkinPolicy: mark.horizontalStackSkinPolicy,
      horizontalStackSupportRole: mark.horizontalStackSupportRole,
      mandalaArrangementRole: mark.mandalaArrangementRole,
      mandalaArrangementProfile: mark.mandalaArrangementProfile,
      mandalaArrangementBasisKind: mark.mandalaArrangementBasisKind,
      mandalaArrangementLocalSpace: mark.mandalaArrangementLocalSpace,
      mandalaArrangementBasis: mark.mandalaArrangementBasis,
      mandalaArrangementSlot: mark.mandalaArrangementSlot,
      mandalaArrangementActiveRay: mark.mandalaArrangementActiveRay,
      mandalaArrangementRayVector: mark.mandalaArrangementRayVector,
      mandalaRayInterval: mark.mandalaRayInterval,
      mandalaRayIntervalBefore: mark.mandalaRayIntervalBefore,
      mandalaRayDisplacement: mark.mandalaRayDisplacement,
      mandalaRayResolved: mark.mandalaRayResolved,
      mandalaRayContactPolicy: mark.mandalaRayContactPolicy,
      mandalaRayCollisionPolicy: mark.mandalaRayCollisionPolicy,
      mandalaFloater: mark.mandalaFloater,
      mandalaFloaterPolicy: mark.mandalaFloaterPolicy,
      cubieLatticeRole: mark.cubieLatticeRole,
      cubieIndex: mark.cubieIndex,
      cubieCol: mark.cubieCol,
      cubieRow: mark.cubieRow,
      cubieLayer: mark.cubieLayer,
      cubieCount: mark.cubieCount,
      cubieCols: mark.cubieCols,
      cubieRows: mark.cubieRows,
      cubieLayers: mark.cubieLayers,
      cubieGap: mark.cubieGap,
      cubieCellSize: mark.cubieCellSize,
      cubieDepthMode: mark.cubieDepthMode,
      cubieFloorT: mark.cubieFloorT,
      cubiePerspectiveScale: mark.cubiePerspectiveScale,
      cubieWorldXYZ: mark.cubieWorldXYZ,
      mandalaFieldRole: mark.mandalaFieldRole,
      mandalaPathRole: mark.mandalaPathRole,
      mandalaSampleIndex: mark.mandalaSampleIndex,
      mandalaSampleCount: mark.mandalaSampleCount,
      mandalaWorldXY: mark.mandalaWorldXY,
      mandalaT: mark.mandalaT,
      mandalaScale: mark.mandalaScale,
      mandalaPinned: mark.mandalaPinned,
      mandalaPinRole: mark.mandalaPinRole,
      mandalaPinBounds: mark.mandalaPinBounds,
      mandalaPinAnchor: mark.mandalaPinAnchor,
      mandalaPinMode: mark.mandalaPinMode,
      solidKind: 'solid',
      ccaBlock: mark.ccaBlock || ccaBox?.ccaBlock,
      ccaSkinDefault: mark.ccaSkinDefault ?? Boolean(ccaBox),
      ccaSkinSource: ccaBox?.source,
      ccaWorldXYZ: ccaBox?.worldXYZ,
      ccaSizeXYZ: ccaBox?.sizeXYZ,
      solidDepthAnchor: ccaBox?.solidDepthAnchor,
      solidDepthProjection: ccaBox?.solidDepthProjection,
      solidProjectionMode: ccaBox?.solidProjectionMode,
      elementMandalaRole: ccaBox?.elementMandalaRole,
      elementMandalaPerspectiveScale: ccaBox?.elementMandalaPerspectiveScale,
      elementMandalaProjected: Boolean(ccaBox),
    }));
  }
  const camera = solidCamera(scene, Math.max(d + z, d), origin, {
    ...mark,
    solidDepthProjection: ccaBox?.solidDepthProjection || mark.solidDepthProjection,
  });
  const planes = expandCuboidPlanes({
    role: mark.role || `solid-${index + 1}`,
    box: {
      x: 0,
      y: 0,
      z,
      w,
      h,
      d,
      shearX: finiteOr(mark.shearX, 0),
    },
    fill: mark.fill || '#b1845e',
    stroke: mark.stroke || '#4f3928',
    strokeWidth: finiteOr(mark.strokeWidth, 0.9),
    sourceIndex: mark.sourceIndex ?? index,
    baseZ: finiteOr(mark.z, finiteOr(scene.view?.baseZ, 10)),
    camera,
    solidPresetRef: undefined,
    solidPresetRole: undefined,
    vectorRole: mark.vectorRole || mark.role || `solid-${index + 1}`,
    faceFilter: facePolicy.filter,
  });

  return planes.map((plane) => ({
    ...plane,
    ...facePolicyMetadata(facePolicy),
    ...solidOrientationMetadata(mark),
    constructionKind: mark.constructionKind,
    constructionRole: mark.constructionRole,
    formPrimitiveRole: mark.formPrimitiveRole,
    formPrimitiveMode: mark.formPrimitiveMode,
    formPrimitiveStock: mark.formPrimitiveStock,
    formMassTuning: mark.formMassTuning,
    speciesStock: mark.speciesStock,
    formPart: mark.formPart,
    partitionTarget: mark.partitionTarget,
    partitionAxis: mark.partitionAxis,
    partitionCount: mark.partitionCount,
    partitionBoardIndex: mark.partitionBoardIndex,
    partitionBoundary: mark.partitionBoundary,
    arrayIndex: mark.arrayIndex,
    arrayCount: mark.arrayCount,
    horizontalStackRole: mark.horizontalStackRole,
    horizontalStackMode: mark.horizontalStackMode,
    horizontalStackAxis: mark.horizontalStackAxis,
    horizontalStackActiveRay: mark.horizontalStackActiveRay,
    horizontalStackMemberRole: mark.horizontalStackMemberRole,
    horizontalStackMemberIndex: mark.horizontalStackMemberIndex,
    horizontalStackMemberCount: mark.horizontalStackMemberCount,
    horizontalStackMemberCollision: mark.horizontalStackMemberCollision,
    horizontalStackSkinPolicy: mark.horizontalStackSkinPolicy,
    horizontalStackSupportRole: mark.horizontalStackSupportRole,
    mandalaArrangementRole: mark.mandalaArrangementRole,
    mandalaArrangementProfile: mark.mandalaArrangementProfile,
    mandalaArrangementBasisKind: mark.mandalaArrangementBasisKind,
    mandalaArrangementLocalSpace: mark.mandalaArrangementLocalSpace,
    mandalaArrangementBasis: mark.mandalaArrangementBasis,
    mandalaArrangementSlot: mark.mandalaArrangementSlot,
    mandalaArrangementActiveRay: mark.mandalaArrangementActiveRay,
    mandalaArrangementRayVector: mark.mandalaArrangementRayVector,
    mandalaRayInterval: mark.mandalaRayInterval,
    mandalaRayIntervalBefore: mark.mandalaRayIntervalBefore,
    mandalaRayDisplacement: mark.mandalaRayDisplacement,
    mandalaRayResolved: mark.mandalaRayResolved,
    mandalaRayContactPolicy: mark.mandalaRayContactPolicy,
    mandalaRayCollisionPolicy: mark.mandalaRayCollisionPolicy,
    mandalaFloater: mark.mandalaFloater,
    mandalaFloaterPolicy: mark.mandalaFloaterPolicy,
    cubieLatticeRole: mark.cubieLatticeRole,
    cubieIndex: mark.cubieIndex,
    cubieCol: mark.cubieCol,
    cubieRow: mark.cubieRow,
    cubieLayer: mark.cubieLayer,
    cubieCount: mark.cubieCount,
    cubieCols: mark.cubieCols,
    cubieRows: mark.cubieRows,
    cubieLayers: mark.cubieLayers,
    cubieGap: mark.cubieGap,
    cubieCellSize: mark.cubieCellSize,
    cubieDepthMode: mark.cubieDepthMode,
    cubieFloorT: mark.cubieFloorT,
    cubiePerspectiveScale: mark.cubiePerspectiveScale,
    cubieWorldXYZ: mark.cubieWorldXYZ,
    mandalaFieldRole: mark.mandalaFieldRole,
    mandalaPathRole: mark.mandalaPathRole,
    mandalaSampleIndex: mark.mandalaSampleIndex,
    mandalaSampleCount: mark.mandalaSampleCount,
    mandalaWorldXY: mark.mandalaWorldXY,
    mandalaT: mark.mandalaT,
    mandalaScale: mark.mandalaScale,
    mandalaPinned: mark.mandalaPinned,
    mandalaPinRole: mark.mandalaPinRole,
    mandalaPinBounds: mark.mandalaPinBounds,
    mandalaPinAnchor: mark.mandalaPinAnchor,
    mandalaPinMode: mark.mandalaPinMode,
    solidKind: 'solid',
    points: plane.points.map(([px, py]) => [roundPoint(px + origin[0]), roundPoint(py + origin[1])]),
    depthAnchor: [roundPoint(plane.depthAnchor[0] + origin[0]), roundPoint(plane.depthAnchor[1] + origin[1])],
    vanishingPoint: Array.isArray(plane.vanishingPoint)
      ? [roundPoint(plane.vanishingPoint[0] + origin[0]), roundPoint(plane.vanishingPoint[1] + origin[1])]
      : plane.vanishingPoint,
    ccaBlock: mark.ccaBlock || ccaBox?.ccaBlock,
    ccaSkinDefault: mark.ccaSkinDefault ?? Boolean(ccaBox),
    ccaSkinSource: ccaBox?.source,
    ccaWorldXYZ: ccaBox?.worldXYZ,
    ccaSizeXYZ: ccaBox?.sizeXYZ,
    solidDepthAnchor: ccaBox?.solidDepthAnchor,
    solidDepthProjection: ccaBox?.solidDepthProjection,
    elementMandalaRole: ccaBox?.elementMandalaRole,
    elementMandalaPerspectiveScale: ccaBox?.elementMandalaPerspectiveScale,
    elementMandalaProjected: Boolean(ccaBox),
  }));
}

function resolveSolidFacePolicy(mark, explicitFilter) {
  if (explicitFilter) {
    return { filter: explicitFilter, mode: 'explicit-faces', hiddenFaces: hiddenCuboidFaces(explicitFilter) };
  }
  const cullMode = resolveSolidFaceCull(mark);
  if (cullMode === 'vanishing-facing' || cullMode === 'hide-vanishing-face' || cullMode === 'hide-back') {
    const filter = new Set(['front', 'left', 'right', 'top', 'bottom']);
    return { filter, mode: 'hide-back', hiddenFaces: ['back'] };
  }
  if (cullMode === 'hide-back-bottom' || cullMode === 'surface-object' || cullMode === 'hide-construction-bottom') {
    const filter = new Set(['front', 'left', 'right', 'top']);
    return { filter, mode: 'hide-back-bottom', hiddenFaces: ['back', 'bottom'] };
  }
  return { filter: undefined, mode: null, hiddenFaces: [] };
}

function resolveSolidFaceCull(mark) {
  const explicit = mark.faceCull || mark.cullFace || mark.hiddenFaceMode || mark.solidFaceCull;
  if (explicit) return explicit;
  return isNadirAnchoredSolid(mark) ? 'hide-back-bottom' : undefined;
}

function isNadirAnchoredSolid(mark) {
  if (mark?.standing === true || mark?.grounded === true || mark?.nadirAnchored === true) return true;
  const bottom = String(mark?.orientation?.bottom || mark?.orientation?.bottomFace || '').toLowerCase();
  if (bottom === 'nadir') return true;
  const role = `${mark?.role || ''} ${mark?.vectorRole || ''} ${mark?.solidRole || ''}`.toLowerCase();
  return /(^|[-_\s:])(tower|building|facade|house-body|apartment-block)([-_\s:]|$)/.test(role);
}

function solidOrientationMetadata(mark) {
  if (!isNadirAnchoredSolid(mark)) return {};
  return {
    solidOrientationFrame: 'nadir-zenith',
    solidBottomFaceOrientation: 'nadir',
    solidTopFaceOrientation: 'zenith',
  };
}

function facePolicyMetadata(policy) {
  if (!policy?.mode) return {};
  return {
    vectorFacePolicy: 'solve-complete-render-visible',
    faceCull: policy.mode,
    hiddenConstructionFaces: policy.hiddenFaces,
  };
}

function annotateContactRegions(marks) {
  if (!Array.isArray(marks)) return marks;
  return marks.map((mark) => {
    if (mark?.kind !== 'polygon' || !Array.isArray(mark.points) || mark.points.length < 3) return mark;
    return {
      ...mark,
      contactRegions: polygonContactRegions(mark.points),
    };
  });
}

function polygonContactRegions(points) {
  const bounds = bbox(points);
  const bottom = polygonEdgeAtY(points, Math.max, bounds.maxY);
  const top = polygonEdgeAtY(points, Math.min, bounds.minY);
  const left = polygonEdgeAtX(points, Math.min, bounds.minX);
  const right = polygonEdgeAtX(points, Math.max, bounds.maxX);
  return {
    bounds: {
      x: roundPoint(bounds.minX),
      y: roundPoint(bounds.minY),
      width: roundPoint(bounds.w),
      height: roundPoint(bounds.h),
    },
    polygon: points.map((point) => point.map(roundPoint)),
    baseContact: bottom,
    bottomContact: bottom,
    topContact: top,
    leftContact: left,
    rightContact: right,
    center: [roundPoint(bounds.minX + bounds.w / 2), roundPoint(bounds.minY + bounds.h / 2)],
  };
}

function polygonEdgeAtY(points, reducer, fallbackY) {
  const y = points.map((point) => point[1]).reduce(reducer);
  const candidates = points.filter((point) => Math.abs(point[1] - y) < 0.01);
  const edge = candidates.length >= 2
    ? candidates.sort((a, b) => a[0] - b[0]).slice(0, 2)
    : [
        [Math.min(...points.map((point) => point[0])), fallbackY],
        [Math.max(...points.map((point) => point[0])), fallbackY],
      ];
  return edge.map((point) => point.map(roundPoint));
}

function polygonEdgeAtX(points, reducer, fallbackX) {
  const x = points.map((point) => point[0]).reduce(reducer);
  const candidates = points.filter((point) => Math.abs(point[0] - x) < 0.01);
  const edge = candidates.length >= 2
    ? candidates.sort((a, b) => a[1] - b[1]).slice(0, 2)
    : [
        [fallbackX, Math.min(...points.map((point) => point[1]))],
        [fallbackX, Math.max(...points.map((point) => point[1]))],
      ];
  return edge.map((point) => point.map(roundPoint));
}

function validateContactChecks(marks, manifest, surfaces = []) {
  const raw = manifest?.polygonizer?.contactChecks || manifest?.scene?.contactChecks || [];
  const checks = Array.isArray(raw) ? raw : [];
  return {
    checks: checks.map((check, index) => validateContactCheck(check, index, marks, surfaces)),
  };
}

function resolveMetamandalaSurfaces(marks, manifest) {
  const meta = manifest?.polygonizer?.metamandala
    ? { ...manifest.polygonizer.metamandala, constellation: manifest.polygonizer?.constellation }
    : null;
  const raw = [
    ...(Array.isArray(meta?.surfaces) ? meta.surfaces : []),
    ...metamandalaGravitySurfaces(meta),
  ];
  if (!raw.length) return { surfaces: [], debugMarks: [] };
  const surfaces = raw
    .map((surface, index) => resolveMetamandalaSurface(surface, index, marks, meta))
    .filter(Boolean);
  const debugMarks = (meta.debugVisible || surfaces.some((surface) => surface.debugLaser))
    ? surfaces.flatMap((surface) => metamandalaDebugMarks(surface, meta))
    : [];
  return { surfaces, debugMarks };
}

function resolveMetamandalaSurface(surface, index, marks, meta = {}) {
  const role = surface?.role || `metamandala-surface-${index + 1}`;
  if (surface?.kind === 'fromHitbox' || surface?.hitboxRole) {
    const hitbox = findConstellationHitbox(surface, meta);
    if (!hitbox) return null;
    const bounds = hitbox.bounds;
    const rail = resolveHitboxSupportRail(surface, hitbox);
    const y = finiteOr(surface.y, rail.y);
    const pad = finiteOr(surface.pad, 0);
    const x1 = finiteOr(surface.x1, rail.x1 - pad);
    const x2 = finiteOr(surface.x2, rail.x2 + pad);
    const origin = validPoint(surface.origin) || [x1, y];
    const yTop = finiteOr(surface.yTop, y - Math.max(finiteOr(surface.height, 70), 20));
    return {
      role,
      kind: 'fromHitbox',
      source: 'constellation-hitbox',
      nodeRole: hitbox.nodeRole,
      hitboxRole: hitbox.role,
      origin: origin.map(roundPoint),
      xAxis: [[roundPoint(x1), roundPoint(y)], [roundPoint(x2), roundPoint(y)]],
      yAxis: [[roundPoint(origin[0]), roundPoint(y)], [roundPoint(origin[0]), roundPoint(yTop)]],
      supportBounds: roundMandalaBounds(bounds),
      supportRail: {
        mode: rail.mode,
        t: round(rail.t),
        y: roundPoint(y),
      },
      z: finiteOr(surface.z, finiteOr(hitbox.z, 0)),
      debugLaser: surface.debugLaser ?? meta.debugVisible ?? false,
      sampleCount: 1,
    };
  }
  if (surface?.kind === 'fromContact' || surface?.fromRole) {
    const contacts = contactCandidates(marks, surface.fromRole, surface.fromRegion || 'topContact')
      .filter((item) => !surface.face || item.mark.face === surface.face);
    const points = contacts.flatMap((item) => regionPoints(item.region));
    if (!points.length) return null;
    const b = bbox(points);
    const y = surface.y !== undefined ? finiteOr(surface.y, (b.minY + b.maxY) / 2) : (b.minY + b.maxY) / 2;
    const pad = finiteOr(surface.pad, 18);
    const x1 = finiteOr(surface.x1, b.minX - pad);
    const x2 = finiteOr(surface.x2, b.maxX + pad);
    const origin = validPoint(surface.origin) || [x1, y];
    const yTop = finiteOr(surface.yTop, y - Math.max(finiteOr(surface.height, 70), 20));
    return {
      role,
      kind: 'fromContact',
      source: 'contact-region',
      fromRole: surface.fromRole,
      fromRegion: surface.fromRegion || 'topContact',
      origin: origin.map(roundPoint),
      xAxis: [[roundPoint(x1), roundPoint(y)], [roundPoint(x2), roundPoint(y)]],
      yAxis: [[roundPoint(origin[0]), roundPoint(y)], [roundPoint(origin[0]), roundPoint(yTop)]],
      z: finiteOr(surface.z, 0),
      debugLaser: surface.debugLaser ?? meta.debugVisible ?? false,
      sampleCount: contacts.length,
    };
  }
  const origin = validPoint(surface?.origin) || [0, 0];
  const xAxis = validLine(surface?.xAxis) || [[origin[0] - 40, origin[1]], [origin[0] + 120, origin[1]]];
  const yAxis = validLine(surface?.yAxis) || [[origin[0], origin[1]], [origin[0], origin[1] - 80]];
  return {
    role,
    kind: surface?.kind || 'explicit',
    source: 'explicit',
    origin: origin.map(roundPoint),
    xAxis: xAxis.map((point) => point.map(roundPoint)),
    yAxis: yAxis.map((point) => point.map(roundPoint)),
    z: finiteOr(surface?.z, 0),
    debugLaser: surface?.debugLaser ?? meta.debugVisible ?? false,
  };
}

function findConstellationHitbox(surface, meta = {}) {
  const nodes = Array.isArray(meta?.constellation?.nodes) ? meta.constellation.nodes : [];
  const nodeRole = surface.nodeRole || surface.fromNodeRole;
  const hitboxRole = surface.hitboxRole || surface.fromHitboxRole || surface.role;
  for (const node of nodes) {
    if (nodeRole && node?.role !== nodeRole) continue;
    const hitboxes = Array.isArray(node?.hitboxes) ? node.hitboxes : [];
    for (const hitbox of hitboxes) {
      if (hitboxRole && hitbox?.role !== hitboxRole) continue;
      const bounds = normalizeHitboxBounds(hitbox, node);
      if (!bounds) continue;
      return {
        ...hitbox,
        bounds,
        nodeRole: node.role,
      };
    }
  }
  return null;
}

function resolveHitboxSupportRail(surface, hitbox) {
  const bounds = hitbox.bounds;
  const mode = surface.rail || surface.supportRail || hitbox.rail || hitbox.supportRail || 'back';
  const explicitT = surface.railT ?? surface.supportT ?? hitbox.railT ?? hitbox.supportT;
  let t;
  if (explicitT !== undefined) {
    t = finiteOr(explicitT, 0);
  } else if (mode === 'front' || mode === 'front-safe' || mode === 'near') {
    t = 1;
  } else if (mode === 'center' || mode === 'middle') {
    t = 0.5;
  } else if (mode === 'safe' || mode === 'standing' || mode === 'safe-standing') {
    t = 0.72;
  } else {
    t = 0;
  }
  t = clamp(t, 0, 1);
  return {
    mode,
    t,
    x1: bounds.x,
    x2: bounds.x + bounds.width,
    y: bounds.y + bounds.height * t,
  };
}

function normalizeHitboxBounds(hitbox, node) {
  const raw = hitbox?.bounds || hitbox;
  if (!raw || typeof raw !== 'object') return null;
  const nodeBounds = node?.bounds;
  const relative = hitbox.relative === true || hitbox.units === 'node' || hitbox.space === 'node';
  const baseX = relative ? finiteOr(nodeBounds?.x, 0) : 0;
  const baseY = relative ? finiteOr(nodeBounds?.y, 0) : 0;
  const baseW = relative ? finiteOr(nodeBounds?.width, 1) : 1;
  const baseH = relative ? finiteOr(nodeBounds?.height, 1) : 1;
  const x = relative ? baseX + finiteOr(raw.x, 0) * baseW : finiteOr(raw.x, 0);
  const y = relative ? baseY + finiteOr(raw.y, 0) * baseH : finiteOr(raw.y, 0);
  const width = Math.max(relative ? finiteOr(raw.width, 1) * baseW : finiteOr(raw.width, 0), 0.001);
  const height = Math.max(relative ? finiteOr(raw.height, 1) * baseH : finiteOr(raw.height, 0), 0.001);
  return { x, y, width, height };
}

function metamandalaGravitySurfaces(meta = {}) {
  if (!meta?.gravity?.enabled) return [];
  const supports = Array.isArray(meta.gravity.supports) ? meta.gravity.supports : [];
  return supports
    .map((support, index) => {
      if (!support || typeof support !== 'object' || Array.isArray(support)) return null;
      const role = support.role || support.surfaceRole || `gravity-support-${index + 1}`;
      return {
        ...support,
        role,
        gravitySupport: true,
        reason: support.reason || 'gravity-support-plane',
      };
    })
    .filter(Boolean);
}

function metamandalaGravityRules(gravity = {}) {
  if (!gravity?.enabled) return [];
  const bodies = Array.isArray(gravity.bodies) ? gravity.bodies : [];
  return gravityBodiesToRules(bodies, gravity);
}

function horizontalStackGravityBodies(manifest = {}) {
  const marks = Array.isArray(manifest?.marks) ? manifest.marks : [];
  return marks
    .filter((mark) => (
      (mark?.kind === 'horizontalStack' || mark?.kind === 'mandalaArrangement') &&
      (mark.profile || mark.arrangementProfile || 'horizontal-stack') === 'horizontal-stack' &&
      normalizeHorizontalStackMode(mark.mode || mark.stackMode || mark.policy?.support || mark.policy?.collision) === 'gravity'
    ))
    .filter((mark) => mark.supportRole || mark.surfaceRole)
    .map((mark) => ({
      role: mark.role || 'horizontal-stack',
      supportRole: mark.supportRole || mark.surfaceRole,
      targetRegion: mark.targetRegion || 'baseContact',
      clearance: mark.clearance,
      maxDelta: mark.maxDelta,
      maxDeltaX: mark.maxDeltaX,
      align: mark.align,
      alignX: mark.alignX,
      dx: mark.dx,
      requireMandalaOverlap: mark.requireMandalaOverlap,
      allowPullForward: mark.allowPullForward,
      paintByAdjacency: mark.paintByAdjacency,
      paintOffset: mark.paintOffset,
      reason: mark.reason || 'horizontal-stack-gravity-push-lock',
      generatedBy: 'horizontalStack',
    }));
}

function horizontalStackGravityRules(manifest = {}, gravity = {}) {
  return gravityBodiesToRules(horizontalStackGravityBodies(manifest), gravity);
}

function gravityBodiesToRules(bodies, gravity = {}) {
  return (Array.isArray(bodies) ? bodies : [])
    .map((body, index) => {
      if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
      const targetRole = body.targetRole || body.role || body.bodyRole;
      const surfaceRole = body.surfaceRole || body.supportRole || body.on || body.onRole;
      if (!targetRole || !surfaceRole) return null;
      const includeRoles = Array.isArray(body.includeRoles)
        ? body.includeRoles.filter((role) => !isShadowRole(role, body))
        : [];
      const excludeRoles = gravityExcludedRoles(body);
      return {
        role: body.ruleRole || body.gravityRole || `${targetRole}-gravity-on-${surfaceRole}`,
        targetRole,
        surfaceRole,
        targetRegion: body.targetRegion || body.region || 'baseContact',
        includeRoles,
        excludeRoles,
        clearance: body.clearance ?? gravity.clearance,
        maxDelta: body.maxDelta ?? gravity.maxDelta,
        maxDeltaX: body.maxDeltaX ?? gravity.maxDeltaX,
        align: body.align,
        alignX: body.alignX,
        dx: body.dx,
        requireMandalaOverlap: body.requireMandalaOverlap ?? gravity.requireMandalaOverlap ?? true,
        allowPullForward: body.allowPullForward ?? gravity.allowPullForward ?? true,
        paintByAdjacency: body.paintByAdjacency ?? gravity.paintByAdjacency ?? true,
        paintOffset: body.paintOffset ?? gravity.paintOffset ?? 1,
        reason: body.reason || 'gravity-support-adjacency',
        gravityRule: true,
      };
    })
    .filter(Boolean);
}

function gravityExcludedRoles(body = {}) {
  const roles = new Set();
  if (Array.isArray(body.shadowRoles)) {
    body.shadowRoles.forEach((role) => roles.add(String(role)));
  }
  if (Array.isArray(body.includeRoles)) {
    body.includeRoles.filter((role) => isShadowRole(role, body)).forEach((role) => roles.add(String(role)));
  }
  if (Array.isArray(body.excludeRoles)) {
    body.excludeRoles.forEach((role) => roles.add(String(role)));
  }
  return [...roles];
}

function isShadowRole(role, owner = {}) {
  if (!role) return false;
  const text = String(role).toLowerCase();
  if (text.includes('shadow')) return true;
  const shadowRoles = Array.isArray(owner.shadowRoles) ? owner.shadowRoles : [];
  return shadowRoles.some((shadowRole) => String(shadowRole) === String(role));
}

function applyMetamandalaRelaxation(marks, surfaces, manifest) {
  const config = manifest?.polygonizer?.metamandala?.relaxation || {};
  const gravity = manifest?.polygonizer?.metamandala?.gravity;
  const explicitRules = Array.isArray(config?.rules) ? config.rules : [];
  const rules = [
    ...explicitRules,
    ...metamandalaGravityRules(gravity),
    ...horizontalStackGravityRules(manifest, gravity),
  ];
  const enabled = config?.enabled || gravity?.enabled || horizontalStackGravityBodies(manifest).length > 0;
  if (!enabled || !rules.length || !Array.isArray(marks)) {
    return { marks, applied: false, adjustments: [] };
  }
  let current = marks;
  const adjustments = [];
  for (const rule of rules) {
    const surface = surfaces.find((item) => item.role === rule.surfaceRole);
    if (!surface?.xAxis) continue;
    const targetRole = rule.targetRole || rule.fromRole || rule.role;
    if (!targetRole) continue;
    const targetRegion = rule.region || rule.targetRegion || 'baseContact';
    const excludedRoles = Array.isArray(rule.excludeRoles) ? rule.excludeRoles : [];
    const candidates = contactCandidates(current, targetRole, targetRegion)
      .filter((item) => !excludedRoles.some((role) => markMatchesContactRole(item.mark, role)));
    const candidatePoints = candidates.flatMap((item) => regionPoints(item.region));
    if (!candidatePoints.length) continue;
    const candidateBounds = bbox(candidatePoints);
    const currentY = Math.max(...candidatePoints.map((point) => point[1]));
    const surfaceY = average(surface.xAxis.flatMap((point) => [point[1]]));
    if (!shouldApplyMetamandalaRelaxation(rule, config, candidateBounds, currentY, surface, surfaceY)) continue;
    const clearance = finiteOr(rule.clearance, finiteOr(config.clearance, 0));
    const desiredY = surfaceY - clearance;
    const maxDelta = Math.abs(finiteOr(rule.maxDelta, finiteOr(config.maxDelta, 120)));
    const dy = roundPoint(clamp(desiredY - currentY, -maxDelta, maxDelta));
    const alignX = rule.alignX || rule.align === 'center' || rule.align === 'center-on-surface';
    const surfaceCenterX = surface.supportBounds
      ? surface.supportBounds.x + surface.supportBounds.width / 2
      : average(surface.xAxis.map((point) => point[0]));
    const currentCenterX = candidateBounds.minX + candidateBounds.w / 2;
    const dxRaw = alignX ? surfaceCenterX - currentCenterX : finiteOr(rule.dx, 0);
    const maxDeltaX = Math.abs(finiteOr(rule.maxDeltaX, finiteOr(rule.maxDelta, finiteOr(config.maxDelta, 120))));
    const dx = roundPoint(clamp(dxRaw, -maxDeltaX, maxDeltaX));
    const roles = [targetRole, ...(Array.isArray(rule.includeRoles) ? rule.includeRoles : [])];
    const paintZ = resolveRelaxedPaintZ(current, rule, surface);
    if (Math.abs(dy) < 0.01 && Math.abs(dx) < 0.01 && paintZ === null) continue;
    current = current.map((mark) => {
      if (excludedRoles.some((role) => markMatchesContactRole(mark, role))) return mark;
      if (!roles.some((role) => markMatchesContactRole(mark, role))) return mark;
      const nextZ = paintZ === null ? mark.z : paintZ;
      return {
        ...offsetMark(mark, dx, dy),
        z: nextZ,
        metamandalaRelaxed: true,
        metamandalaRelaxationRole: rule.role || targetRole,
        metamandalaRelaxationSurface: surface.role,
        metamandalaRelaxationDelta: [dx, dy],
      };
    });
    current = annotateContactRegions(current);
    adjustments.push({
      role: rule.role || targetRole,
      targetRole,
      surfaceRole: surface.role,
      reason: rule.reason || 'support-clearance',
      delta: [dx, dy],
      currentY: roundPoint(currentY),
      desiredY: roundPoint(desiredY),
      currentCenterX: roundPoint(currentCenterX),
      desiredCenterX: roundPoint(surfaceCenterX),
      paintZ,
    });
  }
  return { marks: current, applied: adjustments.length > 0, adjustments };
}

function shouldApplyMetamandalaRelaxation(rule, config = {}, candidateBounds, currentY, surface, surfaceY) {
  if (rule.force === true || rule.forceRelaxation === true) return true;
  const requireOverlap = rule.requireMandalaOverlap ?? config.requireMandalaOverlap ?? true;
  if (requireOverlap && !boundsOverlapMetamandalaSupport(candidateBounds, surface)) return false;
  const clearance = finiteOr(rule.clearance, finiteOr(config.clearance, 0));
  const targetAlreadyBehindRail = currentY < surfaceY - clearance - 0.01;
  if (targetAlreadyBehindRail && rule.allowPullForward !== true && config.allowPullForward !== true) {
    return false;
  }
  return true;
}

function boundsOverlapMetamandalaSupport(bounds, surface) {
  if (!bounds || !surface?.xAxis) return true;
  const supportBounds = surface.supportBounds;
  const supportMinX = supportBounds
    ? supportBounds.x
    : Math.min(...surface.xAxis.map((point) => point[0]));
  const supportMaxX = supportBounds
    ? supportBounds.x + supportBounds.width
    : Math.max(...surface.xAxis.map((point) => point[0]));
  return rangesOverlap(bounds.minX, bounds.maxX, supportMinX, supportMaxX);
}

function rangesOverlap(aMin, aMax, bMin, bMax) {
  return aMin <= bMax && aMax >= bMin;
}

function resolveRelaxedPaintZ(marks, rule, surface) {
  if (rule.paintZ !== undefined) return finiteOr(rule.paintZ, null);
  const supportRole = rule.paintAboveRole || rule.supportRole || surface.fromRole || surface.nodeRole || surface.hitboxRole;
  const supportMarks = supportRole
    ? marks.filter((mark) => markMatchesContactRole(mark, supportRole))
    : [];
  const paintByAdjacency = rule.paintByAdjacency !== false &&
    (rule.paintAboveSupport || rule.paintAboveRole || rule.surfaceRole || surface.role);
  if (!paintByAdjacency && !rule.paintAboveSupport && !rule.paintAboveRole) return null;
  const supportMax = supportMarks.length
    ? Math.max(...supportMarks.map((mark) => finiteOr(mark.z, 0)))
    : finiteOr(surface.z, 0);
  const offset = rule.paintOffset !== undefined
    ? finiteOr(rule.paintOffset, 1)
    : rule.paintAboveSupport || rule.paintAboveRole ? 0.25 : 1;
  return roundPoint(supportMax + offset);
}

function metamandalaDebugMarks(surface, meta = {}) {
  const color = surface.color || meta.color || '#45d6ff';
  const origin = surface.origin;
  const z = finiteOr(meta.z, 960) + finiteOr(surface.z, 0) * 0.001;
  return [
    {
      kind: 'polyline',
      role: `metamandala:${surface.role}:x-laser`,
      points: surface.xAxis,
      stroke: color,
      strokeWidth: finiteOr(meta.strokeWidth, 1.2),
      fill: 'none',
      opacity: meta.opacity ?? 0.62,
      dash: meta.dash || '5 5',
      z,
      source: true,
      metamandalaDebug: true,
      metamandalaSurfaceRole: surface.role,
      constructionKind: 'metamandala',
    },
    {
      kind: 'polyline',
      role: `metamandala:${surface.role}:y-laser`,
      points: surface.yAxis,
      stroke: surface.yColor || meta.yColor || '#ffcf5a',
      strokeWidth: finiteOr(meta.strokeWidth, 1.2),
      fill: 'none',
      opacity: meta.opacity ?? 0.56,
      dash: meta.dash || '4 4',
      z: z + 0.01,
      source: true,
      metamandalaDebug: true,
      metamandalaSurfaceRole: surface.role,
      constructionKind: 'metamandala',
    },
    {
      kind: 'circle',
      role: `metamandala:${surface.role}:origin`,
      cx: roundPoint(origin[0]),
      cy: roundPoint(origin[1]),
      r: finiteOr(meta.originRadius, 3.2),
      fill: color,
      stroke: '#ffffff',
      strokeWidth: 0.6,
      opacity: meta.opacity ?? 0.7,
      z: z + 0.02,
      source: true,
      metamandalaDebug: true,
      metamandalaSurfaceRole: surface.role,
      constructionKind: 'metamandala',
    },
    {
      kind: 'text',
      role: `metamandala:${surface.role}:label`,
      x: roundPoint(origin[0] + 6),
      y: roundPoint(origin[1] - 6),
      value: surface.label || surface.role,
      size: finiteOr(meta.labelSize, 10),
      anchor: 'start',
      color,
      opacity: meta.labelOpacity ?? 0.82,
      z: z + 0.03,
      source: true,
      metamandalaDebug: true,
      metamandalaSurfaceRole: surface.role,
      constructionKind: 'metamandala',
    },
  ];
}

function validateContactCheck(check, index, marks, surfaces = []) {
  const tolerance = Math.max(finiteOr(check?.tolerance, 3), 0);
  const from = check?.fromSurfaceRole
    ? surfaceContactCandidates(surfaces, check.fromSurfaceRole)
    : contactCandidates(marks, check?.fromRole, check?.fromRegion || 'baseContact');
  const to = check?.toSurfaceRole
    ? surfaceContactCandidates(surfaces, check.toSurfaceRole)
    : contactCandidates(marks, check?.toRole, check?.toRegion || 'polygon');
  const mode = check?.mode || 'touches';
  let ok = false;
  for (const a of from) {
    for (const b of to) {
      if (contactRegionsMatch(a.region, b.region, mode, tolerance)) ok = true;
    }
  }
  return {
    role: check?.role || `contact-${index + 1}`,
    mode,
    fromRole: check?.fromRole,
    fromSurfaceRole: check?.fromSurfaceRole,
    fromRegion: check?.fromRegion || 'baseContact',
    toRole: check?.toRole,
    toSurfaceRole: check?.toSurfaceRole,
    toRegion: check?.toRegion || 'polygon',
    tolerance,
    ok,
    fromCandidates: from.length,
    toCandidates: to.length,
  };
}

function surfaceContactCandidates(surfaces, role) {
  const surface = surfaces.find((item) => item.role === role);
  if (!surface?.xAxis) return [];
  return [{
    surface,
    region: surface.xAxis,
  }];
}

function contactCandidates(marks, role, regionName) {
  if (!role) return [];
  return marks
    .filter((mark) => mark?.contactRegions && markMatchesContactRole(mark, role))
    .map((mark) => ({ mark, region: mark.contactRegions?.[regionName] }))
    .filter((item) => item.region);
}

function markMatchesContactRole(mark, role) {
  const target = String(role);
  return [mark.role, mark.solidRole, mark.vectorRole, mark.horizontalStackRole, mark.horizontalStackMemberRole]
    .filter(Boolean)
    .some((value) => {
      const text = String(value);
      return text === target || text.startsWith(`${target}-`) || text.startsWith(`${target}:`);
    });
}

function contactRegionsMatch(a, b, mode, tolerance) {
  if (mode === 'inside') return regionInsidePolygon(a, b, tolerance);
  if (mode === 'intersects') return regionsIntersect(a, b, tolerance);
  return regionDistance(a, b) <= tolerance;
}

function regionsIntersect(a, b, tolerance = 0) {
  const ab = regionBounds(a);
  const bb = regionBounds(b);
  if (!ab || !bb) return false;
  return ab.minX <= bb.maxX + tolerance &&
    ab.maxX + tolerance >= bb.minX &&
    ab.minY <= bb.maxY + tolerance &&
    ab.maxY + tolerance >= bb.minY;
}

function regionInsidePolygon(region, polygon, tolerance = 0) {
  const points = regionPoints(region);
  const poly = regionPoints(polygon);
  if (!points.length || poly.length < 3) return false;
  return points.every((point) => pointInPolygon(point, poly) || distancePointToRegion(point, poly) <= tolerance);
}

function regionDistance(a, b) {
  const ap = regionPoints(a);
  const bp = regionPoints(b);
  if (!ap.length || !bp.length) return Infinity;
  let best = Infinity;
  for (const p of ap) {
    best = Math.min(best, distancePointToRegion(p, bp));
  }
  for (const p of bp) {
    best = Math.min(best, distancePointToRegion(p, ap));
  }
  return best;
}

function distancePointToRegion(point, regionPoints) {
  if (!regionPoints.length) return Infinity;
  let best = Infinity;
  for (let i = 0; i < regionPoints.length; i++) {
    const a = regionPoints[i];
    const b = regionPoints[(i + 1) % regionPoints.length];
    best = Math.min(best, distancePointToSegment(point, a, b));
  }
  return best;
}

function distancePointToSegment(p, a, b) {
  const ab = [b[0] - a[0], b[1] - a[1]];
  const denom = dot(ab, ab);
  if (denom <= 1e-9) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = clamp(dot([p[0] - a[0], p[1] - a[1]], ab) / denom, 0, 1);
  return Math.hypot(p[0] - (a[0] + ab[0] * t), p[1] - (a[1] + ab[1] * t));
}

function regionBounds(region) {
  const points = regionPoints(region);
  if (!points.length) return null;
  return bbox(points);
}

function regionPoints(region) {
  if (!region) return [];
  if (Array.isArray(region) && region.length === 2 && Number.isFinite(Number(region[0])) && Number.isFinite(Number(region[1]))) {
    return [[Number(region[0]), Number(region[1])]];
  }
  if (Array.isArray(region)) {
    return region.filter((point) => validPoint(point)).map((point) => [Number(point[0]), Number(point[1])]);
  }
  if (region && typeof region === 'object' && Number.isFinite(Number(region.x))) {
    return [
      [region.x, region.y],
      [region.x + region.width, region.y],
      [region.x + region.width, region.y + region.height],
      [region.x, region.y + region.height],
    ];
  }
  return [];
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    const intersects = ((yi > point[1]) !== (yj > point[1])) &&
      (point[0] < ((xj - xi) * (point[1] - yi)) / ((yj - yi) || 1e-9) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function hiddenCuboidFaces(filter) {
  return ['back', 'front', 'left', 'right', 'top', 'bottom'].filter((face) => !filter.has(face));
}

function resolveCcaSolidBox(mark, manifest) {
  const xyz = validXYZ(mark.xyz || mark.worldXYZ || mark.localXYZ);
  const sizeXYZ = validXYZ(mark.sizeXYZ || mark.unitsXYZ || mark.unitSize || mark.sizeU);
  if (!xyz || !sizeXYZ) return null;
  const role = mark.mandalaRole || mark.elementMandalaRole || mark.elementRole || mark.role;
  const elementSpace = findElementMandalaSpace(manifest, role);
  if (!elementSpace?.topDown?.camera) return null;
  const unitScale = Math.max(finiteOr(elementSpace.topDown.camera.unitScale, 1), 1);
  const bottom = projectMandalaPoint({ camera: elementSpace.topDown.camera }, { x: xyz[0], y: xyz[1], z: xyz[2] });
  const depthScale = clamp(finiteOr(elementSpace.topDown.camera.depthScale, 1), 0.2, 1);
  const perspectiveScale = Math.pow(depthScale, Math.max(0, -xyz[1]));
  const faceWidth = Math.max(sizeXYZ[0] * unitScale * perspectiveScale, 1);
  const depthLength = Math.max(sizeXYZ[1] * unitScale * perspectiveScale, 1);
  const h = Math.max(sizeXYZ[2] * unitScale * perspectiveScale, 1);
  const widthMode = mark.solidFaceWidthMode || mark.faceWidthMode || mark.ccaFaceWidthMode;
  const w = Math.max((widthMode === 'length' ? depthLength : faceWidth), 1);
  const d = Math.max((widthMode === 'length' ? faceWidth : depthLength) * 0.48, 1);
  const depthProjection = resolveSolidDepthProjection(mark, elementSpace);
  const depthAnchorMode = mark.solidDepthAnchor || mark.depthAnchorMode || (mark.frontAnchored ? 'front' : 'back');
  const depthAnchorOffset =
    depthAnchorMode === 'front' && depthProjection
      ? [depthProjection[0] * d, depthProjection[1] * d]
      : [0, 0];
  return {
    origin: [
      roundPoint(bottom[0] - w / 2 - depthAnchorOffset[0]),
      roundPoint(bottom[1] - h - depthAnchorOffset[1]),
    ],
    w,
    h,
    d,
    worldXYZ: xyz.map(round),
    sizeXYZ: sizeXYZ.map(round),
    elementMandalaRole: elementSpace.role,
    elementMandalaPerspectiveScale: round(perspectiveScale),
    source: 'xyz-element-mandala',
    ccaBlock: true,
    solidDepthAnchor: depthAnchorMode,
    solidDepthProjection: depthProjection?.map(roundClean),
    solidProjectionMode: mark.solidProjectionMode || mark.ccaProjectionMode || mark.projectionMode,
    cornerProjection: shouldUseCcaCornerProjection(mark)
      ? buildCcaCornerProjection({
          anchor: bottom,
          w,
          h,
          d,
          depthProjection,
          camera: elementSpace.topDown.camera,
          elementSpace,
          mark,
          depthAnchorMode,
          projectionMode: mark.solidProjectionMode || mark.ccaProjectionMode || mark.projectionMode,
          perspectiveStrength: finiteOr(mark.solidPerspectiveStrength ?? mark.perspectiveStrength, 0.16),
        })
      : null,
  };
}

function findElementMandalaSpace(manifest, role) {
  const spaces = manifest?.polygonizer?.elementMandala?.elements;
  if (!Array.isArray(spaces) || !role) return null;
  return spaces.find((space) => space?.role === role) || null;
}

function resolveSolidDepthProjection(mark, elementSpace) {
  const requested = mark.solidDepthProjection || mark.depthProjection || mark.genesisDepthProjection;
  const explicit = validPoint(requested);
  if (explicit) return explicit;
  if (requested === 'constellation-guide-line' || requested === 'structural-guide-line' || requested === 'guide-line') {
    return constellationStructuralGuideProjection(elementSpace);
  }
  if (requested === 'constellation-grid-line' || requested === 'constellationGenesisLine' || requested === 'grid-line') {
    return constellationGridLineProjection(elementSpace);
  }
  return null;
}

function shouldUseCcaCornerProjection(mark) {
  const mode = mark.solidProjectionMode || mark.ccaProjectionMode || mark.projectionMode;
  return mode === 'corner' ||
    mode === 'projected-corners' ||
    mode === 'room-cuboid' ||
    mode === 'perspective-corner' ||
    mode === 'constellation-hit-cuboid';
}

function buildCcaCornerProjection({ anchor, w, h, d, depthProjection, camera, elementSpace, mark, depthAnchorMode, projectionMode, perspectiveStrength }) {
  const widthAxis = [1, 0];
  const depthAxis = normalize(depthProjection || validPoint(camera?.north) || [0, 1]);
  const heightAxis = normalize(validPoint(camera?.zenith) || [0, -1]);
  const guideLine = resolveStructuralGuideLine(elementSpace);
  const guideEdge = mark.solidGuideEdge || mark.guideEdge || elementSpace?.boundTo?.cca?.guideEdge || null;
  const upperGuideLine = resolveUpperStructuralGuideLine({ elementSpace, guideLine, heightAxis, height: h, guideEdge });
  const verticalMode = mark.solidVerticalMode ||
    mark.verticalMode ||
    mark.ccaVerticalMode ||
    elementSpace?.boundTo?.cca?.verticalMode ||
    elementSpace?.boundTo?.cca?.solidVerticalMode ||
    null;
  return {
    anchor: anchor.map(roundPoint),
    widthAxis: widthAxis.map(roundClean),
    depthAxis: depthAxis.map(roundClean),
    heightAxis: heightAxis.map(roundClean),
    width: round(w),
    depth: round(d),
    height: round(h),
    depthAnchorMode,
    perspective: projectionMode === 'perspective-corner',
    hitPointMode: projectionMode === 'constellation-hit-cuboid',
    perspectiveStrength: clamp(finiteOr(perspectiveStrength, 0.16), 0, 0.45),
    guideLine,
    upperGuideLine,
    guideEdge,
    verticalMode,
  };
}

function constellationGridLineProjection(elementSpace) {
  const cca = elementSpace?.boundTo?.cca || {};
  const axis =
    validLine(cca.genesisAxis) ||
    validLine(cca.generationAxis) ||
    validLine(cca.gridLine) ||
    validLine(cca.lengthAxis) ||
    validLine(cca.depthAxis?.line);
  if (!axis) return null;
  const mode = cca.genesisAxisMode || cca.generationAxisMode || 'front-to-back';
  const direction = normalize([
    axis[1][0] - axis[0][0],
    axis[1][1] - axis[0][1],
  ]);
  if (mode === 'back-to-front' || mode === 'toward-camera' || mode === 'projection') return direction;
  return [-direction[0], -direction[1]];
}

function constellationStructuralGuideProjection(elementSpace) {
  const cca = elementSpace?.boundTo?.cca || {};
  const axis = resolveStructuralGuideLine(elementSpace);
  if (!axis) return constellationGridLineProjection(elementSpace);
  const mode = cca.guideLineMode || cca.structuralGuideLineMode || 'projection';
  const direction = normalize([
    axis[1][0] - axis[0][0],
    axis[1][1] - axis[0][1],
  ]);
  if (mode === 'back-to-front' || mode === 'toward-camera' || mode === 'projection') return direction;
  return [-direction[0], -direction[1]];
}

function resolveStructuralGuideLine(elementSpace) {
  const cca = elementSpace?.boundTo?.cca || {};
  return validLine(cca.guideLine) ||
    validLine(cca.structuralGuideLine) ||
    validLine(cca.aisleGuideLine) ||
    validLine(cca.roadGuideLine) ||
    validLine(cca.depthAxis?.guideLine);
}

function resolveUpperStructuralGuideLine({ elementSpace, guideLine, heightAxis, height, guideEdge }) {
  const cca = elementSpace?.boundTo?.cca || {};
  const explicit =
    validLine(cca.upperGuideLine) ||
    validLine(cca.wallGuideLine) ||
    validLine(cca.ceilingGuideLine) ||
    validLine(cca.heightGuideLine);
  if (explicit) return explicit;
  const line = validLine(guideLine);
  if (!line) return null;
  const mode = cca.upperGuideMode || cca.guideUpperMode || cca.heightGuideMode;
  if (mode !== 'height-layer') return null;
  const direction = structuralGuideDirection({ cca, line });
  const length = finiteOr(cca.upperGuideLength ?? cca.guideUpperLength, Math.hypot(line[1][0] - line[0][0], line[1][1] - line[0][1]));
  const start = [
    line[0][0] + heightAxis[0] * height,
    line[0][1] + heightAxis[1] * height,
  ];
  return [
    [roundPoint(start[0]), roundPoint(start[1])],
    [roundPoint(start[0] + direction[0] * length), roundPoint(start[1] + direction[1] * length)],
  ];
}

function structuralGuideDirection({ cca, line }) {
  const direction = normalize([
    line[1][0] - line[0][0],
    line[1][1] - line[0][1],
  ]);
  const mode = cca.guideLineMode || cca.structuralGuideLineMode || 'projection';
  if (mode === 'front-to-back' || mode === 'away-from-camera') return [-direction[0], -direction[1]];
  return direction;
}

function validLine(value) {
  if (!Array.isArray(value) || value.length < 2) return null;
  const a = validPoint(value[0]);
  const b = validPoint(value[1]);
  return a && b ? [a, b] : null;
}

function roundClean(value) {
  const rounded = round(value);
  return Object.is(rounded, -0) ? 0 : rounded;
}

function validXYZ(value) {
  if (Array.isArray(value) && value.length >= 3 && value.slice(0, 3).every((item) => Number.isFinite(Number(item)))) {
    return value.slice(0, 3).map(Number);
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const x = value.x ?? value.width;
    const y = value.y ?? value.length ?? value.depth;
    const z = value.z ?? value.height ?? value.altitude;
    if ([x, y, z].every((item) => Number.isFinite(Number(item)))) return [Number(x), Number(y), Number(z)];
  }
  return null;
}

function expandCylinderMark(mark, index, scene) {
  const anchor = Array.isArray(mark.anchor) ? mark.anchor : [mark.cx, mark.cy];
  const cx = finiteOr(anchor[0], finiteOr(mark.x, 0) + finiteOr(mark.width, finiteOr(mark.w, 64)) / 2);
  const cy = finiteOr(anchor[1], finiteOr(mark.y, 0) + finiteOr(mark.height, finiteOr(mark.h, 120)) / 2);
  const rx = Math.max(finiteOr(mark.rx, finiteOr(mark.r, finiteOr(mark.width, finiteOr(mark.w, 64)) / 2)), 1);
  const height = Math.max(finiteOr(mark.height, finiteOr(mark.h, 120)), 1);
  const capRy = Math.max(finiteOr(mark.ry, finiteOr(mark.depth, rx * 0.34)), 1);
  const topCy = cy - height / 2;
  const bottomCy = cy + height / 2;
  const pointCount = Math.max(12, Math.min(96, Math.round(finiteOr(mark.points, 32))));
  const role = mark.role || `cylinder-${index + 1}`;
  const baseZ = finiteOr(mark.z, finiteOr(scene.view?.baseZ, 10));
  const fill = mark.fill || '#b1845e';
  const stroke = mark.stroke || '#4f3928';
  const strokeWidth = finiteOr(mark.strokeWidth, 0.9);
  const topPoints = ellipsePoints(cx, topCy, rx, capRy, pointCount);
  const bodyPoints = cylinderSidePoints(cx, topCy, bottomCy, rx, capRy, pointCount);
  const common = {
    sourceIndex: mark.sourceIndex ?? index,
    sourceShape: 'cylinder',
    formFamily: 'vector',
    vectorKind: 'curved-solid',
    cylinderRole: role,
    cylinderTopClosed: mark.openTop === true ? false : true,
  };
  const body = {
    ...markWithoutGeometry(mark),
    ...common,
    kind: 'polygon',
    closed: true,
    role: `${role}:body`,
    points: bodyPoints,
    fill: shadeHex(fill, 0.78),
    stroke,
    strokeWidth,
    z: baseZ,
    depthAnchor: [roundPoint(cx), roundPoint(cy)],
    cylinderPart: 'body',
  };
  if (mark.openTop === true) return [body];

  return [
    body,
    {
      ...markWithoutGeometry(mark),
      ...common,
      kind: 'polygon',
      closed: true,
      role: `${role}:top-cap`,
      points: topPoints,
      fill: shadeHex(fill, 0.98),
      stroke,
      strokeWidth,
      z: baseZ + 0.22,
      depthAnchor: [roundPoint(cx), roundPoint(topCy)],
      cylinderPart: 'top-cap',
      coherenceRole: 'top-closure',
    },
  ];
}

function expandVolumeMark(mark, index, scene) {
  const primitive = mark.primitive || 'cup';
  if (primitive !== 'cup') {
    throw new Error(`unknown volume primitive '${primitive}'`);
  }
  return expandCupVolumeMark(mark, index, scene);
}

function expandCupVolumeMark(mark, index, scene) {
  const anchor = validPoint(mark.anchor) || [mark.cx, mark.cy];
  const cx = finiteOr(anchor[0], finiteOr(mark.x, 0) + finiteOr(mark.rimWidth, finiteOr(mark.width, 120)) / 2);
  const cy = finiteOr(anchor[1], finiteOr(mark.y, 0) + finiteOr(mark.height, 160) / 2);
  const height = Math.max(finiteOr(mark.height, finiteOr(mark.h, 160)), 12);
  const rimWidth = Math.max(finiteOr(mark.rimWidth, finiteOr(mark.width, finiteOr(mark.w, 124))), 4);
  const footWidth = Math.max(finiteOr(mark.footWidth, rimWidth * 0.56), 4);
  const wallThickness = Math.max(finiteOr(mark.wallThickness, rimWidth * 0.075), 1);
  const ringCount = Math.max(2, Math.min(80, Math.round(finiteOr(mark.rings, 12))));
  const role = mark.role || `volume-${index + 1}`;
  const topY = cy - height / 2;
  const bottomY = cy + height / 2;
  const fill = mark.fill || '#b1845e';
  const stroke = mark.stroke || '#4f3928';
  const baseZ = finiteOr(mark.z, finiteOr(scene.view?.baseZ, 10));
  const pointCount = Math.max(12, Math.min(96, Math.round(finiteOr(mark.points, 32))));
  const out = [];

  for (let i = 0; i < ringCount; i++) {
    const t = ringCount === 1 ? 0 : i / (ringCount - 1);
    const eased = cupProfileEase(t);
    const outerRx = lerp(rimWidth / 2, footWidth / 2, eased);
    const innerRx = Math.max(outerRx - wallThickness, 1);
    const y = lerp(topY, bottomY, t);
    const ry = Math.max(outerRx * lerp(0.16, 0.09, t), 2);
    const opacity = round(lerp(0.68, 0.26, t));
    const ringMeta = {
      center: [roundPoint(cx), roundPoint(y)],
      outerRx: roundPoint(outerRx),
      innerRx: roundPoint(innerRx),
      ry: roundPoint(ry),
      wallThickness: roundPoint(outerRx - innerRx),
    };
    out.push({
      ...volumeCommon(mark, index, role, ringCount, i, t, ringMeta),
      kind: 'polyline',
      role: `${role}:ring-${String(i + 1).padStart(2, '0')}:outer`,
      points: ellipseArcPoints(cx, y, outerRx, ry, pointCount, 0, Math.PI),
      stroke: shadeHex(stroke, lerp(1.12, 0.82, t)),
      strokeWidth: finiteOr(mark.strokeWidth, 1.4),
      fill: 'none',
      opacity,
      z: baseZ + t * 0.08,
      volumeSurface: 'outer-ring',
    });
    if (mark.openTop !== false) {
      out.push({
        ...volumeCommon(mark, index, role, ringCount, i, t, ringMeta),
        kind: 'polyline',
        role: `${role}:ring-${String(i + 1).padStart(2, '0')}:inner`,
        points: ellipseArcPoints(cx, y, innerRx, ry * 0.72, pointCount, 0, Math.PI),
        stroke: shadeHex(stroke, lerp(0.72, 0.54, t)),
        strokeWidth: Math.max(finiteOr(mark.strokeWidth, 1.4) * 0.72, 0.6),
        fill: 'none',
        opacity: round(opacity * lerp(0.7, 0.28, t)),
        z: baseZ + 0.04 + t * 0.08,
        volumeSurface: 'inner-ring',
      });
    }
  }

  const rimOuterRx = rimWidth / 2;
  const rimInnerRx = Math.max(rimOuterRx - wallThickness, 1);
  const rimRy = Math.max(rimOuterRx * 0.16, 2);
  const footRx = footWidth / 2;
  const footRy = Math.max(footRx * 0.09, 2);
  out.push({
    ...volumeCommon(mark, index, role, ringCount, 0, 0, {
      center: [roundPoint(cx), roundPoint(topY)],
      outerRx: roundPoint(rimOuterRx),
      innerRx: roundPoint(rimInnerRx),
      ry: roundPoint(rimRy),
      wallThickness: roundPoint(rimOuterRx - rimInnerRx),
    }),
    kind: 'polyline',
    role: `${role}:rim-band`,
    points: ellipseArcPoints(cx, topY, rimOuterRx, rimRy, pointCount, 0, Math.PI * 2),
    stroke: shadeHex(fill, 1.08),
    strokeWidth: Math.max(wallThickness * 0.28, 2),
    fill: 'none',
    opacity: 0.88,
    z: baseZ + 0.32,
    volumeSurface: 'rim',
  });
  out.push({
    ...volumeCommon(mark, index, role, ringCount, ringCount - 1, 1, {
      center: [roundPoint(cx), roundPoint(bottomY)],
      outerRx: roundPoint(footRx),
      innerRx: 0,
      ry: roundPoint(footRy),
      wallThickness: roundPoint(wallThickness),
    }),
    kind: 'polyline',
    role: `${role}:foot-band`,
    points: ellipseArcPoints(cx, bottomY, footRx, footRy, pointCount, 0, Math.PI),
    stroke: shadeHex(stroke, 0.86),
    strokeWidth: Math.max(finiteOr(mark.strokeWidth, 1.4) * 1.15, 1),
    fill: 'none',
    opacity: 0.72,
    z: baseZ + 0.18,
    volumeSurface: 'foot',
  });
  out.push(
    cupContourLine(mark, index, role, ringCount, cx - rimOuterRx, topY, cx - footRx, bottomY, 'left', stroke, baseZ),
    cupContourLine(mark, index, role, ringCount, cx + rimOuterRx, topY, cx + footRx, bottomY, 'right', stroke, baseZ),
  );
  return out;
}

function volumeCommon(mark, index, role, ringCount, ringIndex, t, ring) {
  return {
    sourceIndex: mark.sourceIndex ?? index,
    sourceShape: 'volume',
    formFamily: 'volume',
    volumeRole: role,
    volumePrimitive: 'cup',
    volumeRingIndex: ringIndex,
    volumeRingCount: ringCount,
    volumeT: round(t),
    ring,
  };
}

function cupContourLine(mark, index, role, ringCount, x1, y1, x2, y2, side, stroke, baseZ) {
  return {
    sourceIndex: mark.sourceIndex ?? index,
    sourceShape: 'volume',
    formFamily: 'volume',
    kind: 'line',
    role: `${role}:${side}-contour`,
    x1: roundPoint(x1),
    y1: roundPoint(y1),
    x2: roundPoint(x2),
    y2: roundPoint(y2),
    stroke: shadeHex(stroke, side === 'left' ? 0.86 : 1.04),
    strokeWidth: Math.max(finiteOr(mark.strokeWidth, 1.4), 1),
    opacity: 0.82,
    z: baseZ + 0.24,
    volumeRole: role,
    volumePrimitive: 'cup',
    volumeRingIndex: side === 'left' ? 0 : ringCount - 1,
    volumeRingCount: ringCount,
    volumeT: side === 'left' ? 0 : 1,
    volumeSurface: 'contour',
  };
}

function cupProfileEase(t) {
  return Math.pow(clamp(t, 0, 1), 0.82);
}

function ellipseArcPoints(cx, cy, rx, ry, pointCount, start, end) {
  const count = Math.max(2, pointCount);
  const points = [];
  for (let i = 0; i <= count; i++) {
    const a = start + ((end - start) * i) / count;
    points.push([roundPoint(cx + Math.cos(a) * rx), roundPoint(cy + Math.sin(a) * ry)]);
  }
  return points;
}

function expandRoundPrimitiveMark(mark, index) {
  const kind = mark.kind === 'sphere' ? 'sphere' : 'oval';
  const r = finiteOr(mark.r, 28);
  const expanded = expandBlobMark({
    ...mark,
    kind: mark.kind === 'sphere' ? 'ellipse' : 'ellipse',
    rx: finiteOr(mark.rx, r),
    ry: finiteOr(mark.ry, mark.kind === 'sphere' ? finiteOr(mark.rx, r) : r * 0.72),
    wobble: 0,
  }, index);
  return {
    ...expanded,
    sourceShape: kind,
    formPrimitive: kind,
    formFamily: 'organic',
  };
}

function expandEggMark(mark, index) {
  const hasAnchor =
    Array.isArray(mark.anchor) &&
    mark.anchor.length === 2 &&
    Number.isFinite(mark.anchor[0]) &&
    Number.isFinite(mark.anchor[1]);
  const anchor = hasAnchor ? mark.anchor : [mark.cx, mark.cy];
  const cx = finiteOr(anchor[0], 0);
  const cy = finiteOr(anchor[1], 0);
  const rx = Math.max(finiteOr(mark.rx, finiteOr(mark.r, 32)), 1);
  const ry = Math.max(finiteOr(mark.ry, finiteOr(mark.r, 46)), 1);
  const rotation = finiteOr(mark.rotation, 0);
  const pointCount = Math.max(12, Math.min(96, Math.round(finiteOr(mark.points, 36))));
  const cosR = Math.cos(rotation);
  const sinR = Math.sin(rotation);
  const points = [];
  for (let i = 0; i < pointCount; i++) {
    const t = (i / pointCount) * Math.PI * 2;
    const yUnit = Math.sin(t);
    const topNarrowing = yUnit < 0 ? 1 + yUnit * 0.18 : 1 + yUnit * 0.08;
    const localX = Math.cos(t) * rx * topNarrowing;
    const localY = yUnit * ry;
    points.push([
      roundPoint(cx + localX * cosR - localY * sinR),
      roundPoint(cy + localX * sinR + localY * cosR),
    ]);
  }
  return {
    ...markWithoutGeometry(mark),
    kind: 'polygon',
    closed: true,
    role: mark.role || `egg-${index + 1}`,
    points,
    sourceShape: 'egg',
    formPrimitive: 'egg',
    formFamily: 'organic',
    sourceIndex: mark.sourceIndex ?? index,
    blobIndex: mark.blobIndex ?? index,
    blobRole: mark.blobRole || mark.role,
    depthAnchor: mark.depthAnchor || [cx, cy],
  };
}

function expandBookshelfSolidPreset(mark, index, scene) {
  const x = finiteOr(mark.x, finiteOr(mark.anchor?.[0], 260) - finiteOr(mark.width, mark.w ?? 280) / 2);
  const y = finiteOr(mark.y, finiteOr(mark.anchor?.[1], 220) - finiteOr(mark.height, mark.h ?? 330) / 2);
  const w = Math.max(finiteOr(mark.width, finiteOr(mark.w, 280)), 40);
  const h = Math.max(finiteOr(mark.height, finiteOr(mark.h, 330)), 60);
  const depth = Math.max(finiteOr(mark.depth, Math.min(w, h) * 0.2), 10);
  const shelves = Math.max(1, Math.min(8, Math.round(finiteOr(mark.shelves, 4))));
  const role = mark.role || 'bookshelf';
  const board = Math.max(finiteOr(mark.boardThickness, h * 0.045), 5);
  const sideWidth = Math.max(finiteOr(mark.sideWidth, w * 0.07), 7);
  const backThickness = Math.max(finiteOr(mark.backThickness, board * 0.45), 2);
  const baseZ = finiteOr(mark.z, finiteOr(scene.view?.baseZ, 10));
  const stroke = mark.stroke || '#4f3928';
  const strokeWidth = finiteOr(mark.strokeWidth, 0.9);
  const woodFill = mark.fill || '#b1845e';
  const backFill = mark.backFill || '#7c5a42';
  const bookPalette = mark.bookPalette || ['#8f5f45', '#b1845e', '#6d7c74', '#7a5b80', '#c8a978'];
  const camera = solidCamera(scene, depth, [x, y]);
  const planes = [];

  const addCuboid = (name, box, options = {}) => {
    planes.push(...expandCuboidPlanes({
      role: `${role}:${name}`,
      box,
      fill: options.fill || woodFill,
      stroke,
      strokeWidth: options.strokeWidth ?? strokeWidth,
      sourceIndex: mark.sourceIndex ?? index,
      baseZ: baseZ + finiteOr(options.zOffset, 0),
      camera,
      solidPresetRef: 'bookshelf',
      solidPresetRole: role,
      vectorRole: options.vectorRole || name,
      faceFilter: options.faceFilter,
    }));
  };

  addCuboid('back-panel', { x: 0, y: 0, z: 0, w, h, d: backThickness }, {
    fill: backFill,
    zOffset: -1.2,
    vectorRole: 'panel',
    faceFilter: new Set(['front', 'left', 'right', 'top', 'bottom']),
  });
  addCuboid('left-wall', { x: 0, y: 0, z: 0, w: sideWidth, h, d: depth }, { vectorRole: 'wall' });
  addCuboid('right-wall', { x: w - sideWidth, y: 0, z: 0, w: sideWidth, h, d: depth }, { vectorRole: 'wall' });

  for (let i = 0; i <= shelves; i++) {
    const sy = i === shelves ? h - board : Math.max(0, (h * i) / shelves);
    addCuboid(`shelf-${i + 1}`, { x: 0, y: sy, z: 0, w, h: board, d: depth }, {
      vectorRole: 'shelf',
      zOffset: i * 0.03,
    });
  }

  const bookRows = Math.min(shelves, 5);
  for (let row = 0; row < bookRows; row++) {
    const cellTop = (h * row) / shelves + board * 1.25;
    const cellBottom = (h * (row + 1)) / shelves - board * 0.45;
    let cursor = sideWidth + w * 0.025;
    const rightLimit = w - sideWidth - w * 0.025;
    for (let b = 0; b < 9; b++) {
      const bw = w * (0.035 + ((b + row) % 4) * 0.009);
      if (cursor + bw > rightLimit) break;
      const bookHeight = Math.max(cellBottom - cellTop - ((b + row) % 4) * h * 0.01, board * 1.8);
      const lean = (((b + row) % 5) - 2) * 0.018;
      const bookDepth = depth * (0.45 + ((b + 2 * row) % 4) * 0.055);
      addCuboid(`book-${row + 1}-${b + 1}`, {
        x: cursor,
        y: cellBottom - bookHeight,
        z: depth - bookDepth - depth * 0.06,
        w: bw,
        h: bookHeight,
        d: bookDepth,
        shearX: lean * bookHeight,
      }, {
        fill: mark.bookFill || bookPalette[(b + row) % bookPalette.length],
        strokeWidth: Math.max(0.45, strokeWidth * 0.65),
        vectorRole: 'book',
        faceFilter: new Set(['front', 'right', 'top']),
        zOffset: 0.8 + row * 0.04 + b * 0.004,
      });
      cursor += bw + w * 0.012;
    }
  }

  return planes.map((plane) => ({
    ...plane,
    points: plane.points.map(([px, py]) => [roundPoint(px + x), roundPoint(py + y)]),
    depthAnchor: [roundPoint(plane.depthAnchor[0] + x), roundPoint(plane.depthAnchor[1] + y)],
    vanishingPoint: Array.isArray(plane.vanishingPoint)
      ? [roundPoint(plane.vanishingPoint[0] + x), roundPoint(plane.vanishingPoint[1] + y)]
      : plane.vanishingPoint,
  }));
}

function solidCamera(scene, maxDepth = 1, origin = [0, 0], mark = {}) {
  const view2d = normalize(scene.view?.direction || [-0.45, -0.35]);
  const depthVector = normalize([-view2d[0], -view2d[1]]);
  const depthProjection = validPoint(mark.solidDepthProjection || mark.depthProjection || mark.genesisDepthProjection);
  const light2d = normalize(scene.light?.direction || [-0.58, -0.82]);
  const perspective = scene.perspective || {};
  const rawVp = Array.isArray(perspective.vanishingPoint)
    ? perspective.vanishingPoint
    : perspective.vanishingPoints?.center;
  const vanishingPoint =
    perspective.mode === 'one-point' &&
    Array.isArray(rawVp) &&
    Number.isFinite(rawVp[0]) &&
    Number.isFinite(rawVp[1])
      ? [rawVp[0] - finiteOr(origin[0], 0), rawVp[1] - finiteOr(origin[1], 0)]
      : null;
  return {
    view2d,
    depthVector,
    depthProjection,
    light3d: normalize3([light2d[0], light2d[1], finiteOr(scene.light?.z, 0.72)]),
    zScale: finiteOr(scene.view?.solidZScale, 0.045),
    eyeScale: finiteOr(scene.view?.solidEyeScale, 0.006),
    perspectiveMode: vanishingPoint ? 'one-point' : 'parallel',
    vanishingPoint,
    horizonY: Number.isFinite(Number(perspective.horizonY))
      ? Number(perspective.horizonY) - finiteOr(origin[1], 0)
      : null,
    solidOrientationFrame: isNadirAnchoredSolid(mark) ? 'nadir-zenith' : null,
    solidCapVisibility: mark.solidCapVisibility || scene.view?.solidCapVisibility || (vanishingPoint ? 'eye-relative' : 'zenith-visible'),
    maxDepth: Math.max(finiteOr(maxDepth, 1), 1),
    perspectiveDepth: Math.max(finiteOr(perspective.depthScale, 240), 1),
  };
}

function expandCuboidPlanes({ role, box, fill, stroke, strokeWidth, sourceIndex, baseZ, camera, solidPresetRef, solidPresetRole, vectorRole, faceFilter }) {
  return orientedCuboidFaces(box, camera)
    .filter((face) => !faceFilter || faceFilter.has(face.name))
    .map((face) => {
      const projected = face.points.map((point) => projectSolidPoint(point, camera));
      return { face, projected };
    })
    .filter(({ face, projected }) => !hiddenStandingCapFace(face, projected, camera))
    .map(({ face, projected }) => {
      const c2 = centroid(projected);
      const c3 = averagePoint3(face.points);
      const lightAmount = clamp(dot3(face.normal, camera.light3d), -1, 1);
      const faceTone = 0.72 + Math.max(lightAmount, 0) * 0.24 + Math.min(lightAmount, 0) * 0.22;
      const capPaintBias = standingFacePaintBias(face, camera);
      return expandPlanePolygon({
        role: `${role}:${face.name}`,
        points: projected,
        fill: shadeHex(fill, faceTone),
        stroke: shadeHex(stroke, face.name === 'front' ? 1.08 : 0.84),
        strokeWidth,
        sourceIndex,
        sourceShape: 'plane',
        formFamily: 'vector',
        vectorKind: 'solid-face',
        vectorRole,
        solidPresetRef,
        solidPresetRole,
        solidRole: role,
        face: face.name,
        faceNormal: face.normal.map(round),
        faceLight: round(lightAmount),
        perspectiveMode: camera.perspectiveMode,
        vanishingPoint: camera.vanishingPoint
          ? [roundPoint(camera.vanishingPoint[0]), roundPoint(camera.vanishingPoint[1])]
          : undefined,
        planeDepth: round(c3[2]),
        depthAnchor: [roundPoint(c2[0]), roundPoint(c2[1])],
        solidCapVisibility: camera.solidOrientationFrame ? camera.solidCapVisibility : undefined,
        solidHorizonY: Number.isFinite(camera.horizonY) ? roundPoint(camera.horizonY) : undefined,
        z: round(baseZ + c3[2] * camera.zScale - dot(camera.view2d, c2) * camera.eyeScale + face.zBias + capPaintBias),
      });
    });
}

function orientedCuboidFaces(box, camera) {
  const faces = cuboidFaces(box);
  if (camera.solidOrientationFrame !== 'nadir-zenith') return faces;
  return faces.map((face) => {
    if (face.name === 'back') {
      return { ...face, name: 'front', normal: [0, 0, 1], zBias: 0.22, sourceCuboidFace: 'near-depth' };
    }
    if (face.name === 'front') {
      return { ...face, name: 'back', normal: [0, 0, -1], zBias: -0.04, sourceCuboidFace: 'far-depth' };
    }
    return face;
  });
}

function hiddenStandingCapFace(face, projected, camera) {
  if (camera.solidOrientationFrame !== 'nadir-zenith') return false;
  if (!['top', 'bottom'].includes(face.name)) return false;
  if (camera.solidCapVisibility !== 'eye-relative') return false;
  if (!Number.isFinite(camera.horizonY)) return false;
  const centerY = centroid(projected)[1];
  if (face.name === 'top') return centerY < camera.horizonY;
  return centerY > camera.horizonY;
}

function standingFacePaintBias(face, camera) {
  if (camera.solidOrientationFrame !== 'nadir-zenith') return 0;
  if (face.name === 'front') return 3;
  if (face.name === 'top') return 2.2;
  if (face.name === 'bottom' || face.name === 'back') return -0.18;
  return 0;
}

function expandCcaCornerCuboidPlanes({ role, projection, fill, stroke, strokeWidth, sourceIndex, baseZ, vectorRole, faceFilter }) {
  const hitPoints = resolveCcaCuboidHitPoints(projection);
  const { bottom, top } = hitPoints;
  const depth = Math.max(finiteOr(projection?.depth, 1), 1);
  const perspectiveStrength = projection?.perspective ? clamp(finiteOr(projection.perspectiveStrength, 0.16), 0, 0.45) : 0;
  const faces = [
    { name: 'back', points: [bottom.bl, bottom.br, top.br, top.bl], tone: 0.72, zBias: -0.04 },
    { name: 'front', points: [bottom.fl, bottom.fr, top.fr, top.fl], tone: 0.92, zBias: 0.22 },
    { name: 'left', points: [bottom.bl, bottom.fl, top.fl, top.bl], tone: 0.76, zBias: 0.08 },
    { name: 'right', points: [bottom.br, bottom.fr, top.fr, top.br], tone: 0.78, zBias: 0.1 },
    { name: 'top', points: [top.bl, top.br, top.fr, top.fl], tone: 1.08, zBias: 0.16 },
    { name: 'bottom', points: [bottom.bl, bottom.br, bottom.fr, bottom.fl], tone: 0.66, zBias: 0.02 },
  ];
  return faces
    .filter((face) => !faceFilter || faceFilter.has(face.name))
    .map((face) => expandPlanePolygon({
      role: `${role}:${face.name}`,
      points: face.points,
      fill: shadeHex(fill, face.tone),
      stroke: shadeHex(stroke, face.name === 'front' ? 1.08 : 0.84),
      strokeWidth,
      sourceIndex,
      sourceShape: 'plane',
      formFamily: 'vector',
      vectorKind: 'solid-face',
      vectorRole,
      solidRole: role,
      face: face.name,
      solidGuideEdge: projection?.guideEdge || undefined,
      solidGuideLine: projection?.guideLine || undefined,
      solidUpperGuideLine: projection?.upperGuideLine || undefined,
      ccaHitPointMode: projection?.hitPointMode || undefined,
      ccaHitPoints: projection?.hitPointMode ? flattenCcaHitPoints(hitPoints) : undefined,
      perspectiveMode: projection?.hitPointMode
        ? 'constellation-hit-cuboid'
        : projection?.perspective ? 'perspective-corner-projection' : 'corner-projection',
      cornerPerspectiveStrength: perspectiveStrength,
      planeDepth: face.name === 'front' ? depth : 0,
      depthAnchor: centroid(face.points).map(roundPoint),
      z: round(baseZ + face.zBias),
    }));
}

function resolveCcaCuboidHitPoints(projection) {
  const anchor = validPoint(projection?.anchor) || [0, 0];
  const widthAxis = normalize(validPoint(projection?.widthAxis) || [1, 0]);
  const depthAxis = normalize(validPoint(projection?.depthAxis) || [0, 1]);
  const heightAxis = normalize(validPoint(projection?.heightAxis) || [0, -1]);
  const halfW = Math.max(finiteOr(projection?.width, 1), 1) / 2;
  const depth = Math.max(finiteOr(projection?.depth, 1), 1);
  const height = Math.max(finiteOr(projection?.height, 1), 1);
  const perspectiveStrength = projection?.perspective ? clamp(finiteOr(projection.perspectiveStrength, 0.16), 0, 0.45) : 0;
  const center = projection?.depthAnchorMode === 'front'
    ? [anchor[0] - depthAxis[0] * depth, anchor[1] - depthAxis[1] * depth]
    : anchor;
  const add3 = (w, d, z) => {
    const depthT = clamp(d / Math.max(depth, 0.001), 0, 1);
    const scale = 1 + depthT * perspectiveStrength;
    return [
      center[0] + widthAxis[0] * w * scale + depthAxis[0] * d + heightAxis[0] * z,
      center[1] + widthAxis[1] * w * scale + depthAxis[1] * d + heightAxis[1] * z,
    ];
  };
  const bottom = {
    fl: add3(-halfW, depth, 0),
    fr: add3(halfW, depth, 0),
    br: add3(halfW, 0, 0),
    bl: add3(-halfW, 0, 0),
  };
  const top = {
    fl: add3(-halfW, depth, height),
    fr: add3(halfW, depth, height),
    br: add3(halfW, 0, height),
    bl: add3(-halfW, 0, height),
  };
  applyGuideEdgeConstraint({
    bottom,
    top,
    guideLine: projection?.guideLine,
    upperGuideLine: projection?.upperGuideLine,
    guideEdge: projection?.guideEdge,
  });
  if (projection?.verticalMode === 'absolute-90' || projection?.verticalMode === 'screen-vertical') {
    enforceAbsoluteVerticalHitPoints({ bottom, top });
  }
  if (projection?.verticalMode === 'absolute-90-top-guide' || projection?.verticalMode === 'screen-vertical-top-guide') {
    enforceAbsoluteVerticalHitPoints({ bottom, top });
    alignVerticalHitPointsToUpperGuide({
      bottom,
      top,
      upperGuideLine: projection?.upperGuideLine,
      guideEdge: projection?.guideEdge,
    });
  }
  return { bottom, top };
}

function enforceAbsoluteVerticalHitPoints({ bottom, top }) {
  for (const key of ['fl', 'fr', 'br', 'bl']) {
    if (!bottom[key] || !top[key]) continue;
    top[key] = [roundPoint(bottom[key][0]), top[key][1]];
  }
}

function alignVerticalHitPointsToUpperGuide({ bottom, top, upperGuideLine, guideEdge }) {
  const topLine = validLine(upperGuideLine);
  if (!topLine || (guideEdge !== 'left' && guideEdge !== 'right')) return;
  const pairs = guideEdge === 'right'
    ? [['br', 'bl'], ['fr', 'fl']]
    : [['bl', 'br'], ['fl', 'fr']];
  for (const [guideKey, oppositeKey] of pairs) {
    const y = lineYAtX(topLine, top[guideKey]?.[0]);
    if (!Number.isFinite(y)) continue;
    const dy = roundPoint(y - top[guideKey][1]);
    top[guideKey] = [top[guideKey][0], roundPoint(top[guideKey][1] + dy)];
    top[oppositeKey] = [top[oppositeKey][0], roundPoint(top[oppositeKey][1] + dy)];
  }
}

function flattenCcaHitPoints({ bottom, top }) {
  return {
    floorBackLeft: bottom.bl.map(roundPoint),
    floorBackRight: bottom.br.map(roundPoint),
    floorFrontLeft: bottom.fl.map(roundPoint),
    floorFrontRight: bottom.fr.map(roundPoint),
    topBackLeft: top.bl.map(roundPoint),
    topBackRight: top.br.map(roundPoint),
    topFrontLeft: top.fl.map(roundPoint),
    topFrontRight: top.fr.map(roundPoint),
  };
}

function applyGuideEdgeConstraint({ bottom, top, guideLine, upperGuideLine, guideEdge }) {
  const line = validLine(guideLine);
  if (!line || (guideEdge !== 'left' && guideEdge !== 'right')) return;
  const topLine = validLine(upperGuideLine) || null;
  const pairs = guideEdge === 'right'
    ? [['br', 'bl', 'br', 'bl'], ['fr', 'fl', 'fr', 'fl']]
    : [['bl', 'br', 'bl', 'br'], ['fl', 'fr', 'fl', 'fr']];
  for (const [bottomKey, oppositeBottomKey, topKey, oppositeTopKey] of pairs) {
    const point = bottom[bottomKey];
    const x = lineXAtY(line, point?.[1]);
    if (!Number.isFinite(x)) continue;
    const dx = roundPoint(x - point[0]);
    bottom[bottomKey] = [roundPoint(point[0] + dx), point[1]];
    bottom[oppositeBottomKey] = [
      roundPoint(bottom[oppositeBottomKey][0] + dx),
      bottom[oppositeBottomKey][1],
    ];
    const topX = topLine ? lineXAtY(topLine, top[topKey]?.[1]) : NaN;
    const originalTopX = top[topKey][0];
    const nextTopX = roundPoint(Number.isFinite(topX) ? topX : top[topKey][0] + dx);
    top[topKey] = [
      nextTopX,
      top[topKey][1],
    ];
    const topDx = roundPoint(nextTopX - originalTopX);
    top[oppositeTopKey] = [
      roundPoint(top[oppositeTopKey][0] + topDx),
      top[oppositeTopKey][1],
    ];
  }
}

function lineXAtY(line, yRaw) {
  const y = finiteOr(yRaw, NaN);
  if (!Number.isFinite(y)) return NaN;
  const [a, b] = line;
  const dy = b[1] - a[1];
  if (Math.abs(dy) < 1e-9) return a[0];
  const t = (y - a[1]) / dy;
  return a[0] + (b[0] - a[0]) * t;
}

function lineYAtX(line, xRaw) {
  const x = finiteOr(xRaw, NaN);
  if (!Number.isFinite(x)) return NaN;
  const [a, b] = line;
  const dx = b[0] - a[0];
  if (Math.abs(dx) < 1e-9) return a[1];
  const t = (x - a[0]) / dx;
  return a[1] + (b[1] - a[1]) * t;
}

function cuboidFaces(box) {
  const x0 = box.x;
  const x1 = box.x + box.w;
  const y0 = box.y;
  const y1 = box.y + box.h;
  const z0 = box.z;
  const z1 = box.z + box.d;
  const s = finiteOr(box.shearX, 0);
  const p = (xPoint, yPoint, zPoint) => [
    xPoint + (yPoint - y0) * (s / Math.max(box.h, 1)),
    yPoint,
    zPoint,
  ];
  return [
    { name: 'back', normal: [0, 0, -1], zBias: -0.04, points: [p(x0, y0, z0), p(x1, y0, z0), p(x1, y1, z0), p(x0, y1, z0)] },
    { name: 'front', normal: [0, 0, 1], zBias: 0.22, points: [p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1)] },
    { name: 'left', normal: [-1, 0, 0], zBias: 0.08, points: [p(x0, y0, z0), p(x0, y0, z1), p(x0, y1, z1), p(x0, y1, z0)] },
    { name: 'right', normal: [1, 0, 0], zBias: 0.1, points: [p(x1, y0, z0), p(x1, y0, z1), p(x1, y1, z1), p(x1, y1, z0)] },
    { name: 'top', normal: [0, -1, 0], zBias: 0.16, points: [p(x0, y0, z0), p(x1, y0, z0), p(x1, y0, z1), p(x0, y0, z1)] },
    { name: 'bottom', normal: [0, 1, 0], zBias: 0.02, points: [p(x0, y1, z0), p(x1, y1, z0), p(x1, y1, z1), p(x0, y1, z1)] },
  ];
}

function projectSolidPoint([x, y, z], camera) {
  if (camera.perspectiveMode === 'one-point' && camera.vanishingPoint) {
    const recede = Math.max(camera.maxDepth - z, 0);
    const scale = camera.perspectiveDepth / (camera.perspectiveDepth + recede);
    return [
      camera.vanishingPoint[0] + (x - camera.vanishingPoint[0]) * scale,
      camera.vanishingPoint[1] + (y - camera.vanishingPoint[1]) * scale,
    ];
  }
  return [
    x + (camera.depthProjection?.[0] ?? -camera.depthVector[0]) * z,
    y + (camera.depthProjection?.[1] ?? -camera.depthVector[1]) * z,
  ];
}

function averagePoint3(points) {
  const sum = points.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0]);
  return [sum[0] / points.length, sum[1] / points.length, sum[2] / points.length];
}

function ellipsePoints(cx, cy, rx, ry, pointCount, start = 0, end = Math.PI * 2) {
  const points = [];
  for (let i = 0; i < pointCount; i++) {
    const t = start + ((end - start) * i) / pointCount;
    points.push([roundPoint(cx + Math.cos(t) * rx), roundPoint(cy + Math.sin(t) * ry)]);
  }
  return points;
}

function rotatedEllipsePoints(cx, cy, rx, ry, pointCount, rotation = 0) {
  const points = [];
  const cosR = Math.cos(rotation);
  const sinR = Math.sin(rotation);
  for (let i = 0; i < pointCount; i++) {
    const t = (Math.PI * 2 * i) / pointCount;
    const x = Math.cos(t) * rx;
    const y = Math.sin(t) * ry;
    points.push([
      roundPoint(cx + x * cosR - y * sinR),
      roundPoint(cy + x * sinR + y * cosR),
    ]);
  }
  return points;
}

function cylinderSidePoints(cx, topCy, bottomCy, rx, ry, pointCount) {
  const half = Math.max(6, Math.round(pointCount / 2));
  const topFront = [];
  const bottomFront = [];
  for (let i = 0; i <= half; i++) {
    const t = Math.PI + (Math.PI * i) / half;
    topFront.push([roundPoint(cx + Math.cos(t) * rx), roundPoint(topCy + Math.sin(t) * ry)]);
  }
  for (let i = half; i >= 0; i--) {
    const t = Math.PI + (Math.PI * i) / half;
    bottomFront.push([roundPoint(cx + Math.cos(t) * rx), roundPoint(bottomCy + Math.sin(t) * ry)]);
  }
  return topFront.concat(bottomFront);
}

function markWithoutGeometry(mark) {
  const {
    anchor: _anchor,
    cx: _cx,
    cy: _cy,
    x: _x,
    y: _y,
    width: _width,
    height: _height,
    w: _w,
    h: _h,
    depth: _depth,
    rx: _rx,
    ry: _ry,
    r: _r,
    rotation: _rotation,
    wobble: _wobble,
    points: _points,
    kind: _kind,
    openTop: _openTop,
    ...rest
  } = mark;
  return rest;
}

function expandPlanePresetMark(mark, index, scene) {
  const ref = mark.ref || mark.preset;
  if (ref === 'bookshelf') {
    return expandBookshelfPlanePreset(mark, index, scene);
  }
  throw new Error(`unknown plane preset '${ref || '(missing ref)'}'`);
}

function expandBookshelfPlanePreset(mark, index, scene) {
  const x = finiteOr(mark.x, finiteOr(mark.anchor?.[0], 260) - finiteOr(mark.width, mark.w ?? 280) / 2);
  const y = finiteOr(mark.y, finiteOr(mark.anchor?.[1], 220) - finiteOr(mark.height, mark.h ?? 330) / 2);
  const w = Math.max(finiteOr(mark.width, finiteOr(mark.w, 280)), 20);
  const h = Math.max(finiteOr(mark.height, finiteOr(mark.h, 330)), 20);
  const depth = Math.max(finiteOr(mark.depth, Math.min(w, h) * 0.14), 1);
  const shelves = Math.max(1, Math.min(8, Math.round(finiteOr(mark.shelves, 5))));
  const role = mark.role || 'bookshelf';
  const baseZ = finiteOr(mark.z, finiteOr(scene.view?.baseZ, 10));
  const board = Math.max(finiteOr(mark.boardThickness, h * 0.045), 4);
  const sideWidth = Math.max(finiteOr(mark.sideWidth, w * 0.07), 6);
  const stroke = mark.stroke || '#4f3928';
  const strokeWidth = finiteOr(mark.strokeWidth, 1.25);
  const planeFill = mark.fill || '#b1845e';
  const sideFill = mark.sideFill || '#966b4e';
  const topFill = mark.topFill || '#c8a978';
  const frontFill = mark.frontFill || '#a97852';
  const backFill = mark.backFill || '#7c5a42';
  const bookPalette = mark.bookPalette || ['#8f5f45', '#b1845e', '#6d7c74', '#7a5b80', '#c8a978'];
  const view = normalize(scene.view?.direction || [-0.45, -0.35]);
  const depthVector = normalize([-view[0], -view[1]]);
  const dx = roundPoint(depthVector[0] * depth);
  const dy = roundPoint(depthVector[1] * depth);
  const planes = [];
  const addPlane = (name, points, extra = {}) => {
    planes.push(expandPlanePolygon({
      role: `${role}:${name}`,
      points,
      fill: planeFill,
      stroke,
      strokeWidth,
      sourceIndex: mark.sourceIndex ?? index,
      planePresetRef: 'bookshelf',
      planePresetRole: role,
      z: baseZ + finiteOr(extra.planeDepth, 0),
      ...extra,
    }));
  };

  addPlane('back-plane', [[x + dx, y + dy], [x + w + dx, y + dy], [x + w + dx, y + h + dy], [x + dx, y + h + dy]], {
    fill: backFill,
    planeDepth: -1,
  });
  addPlane('left-wall-front', [[x, y], [x + sideWidth, y], [x + sideWidth, y + h], [x, y + h]], {
    fill: sideFill,
    planeDepth: 2.2,
  });
  addPlane('left-wall-depth', [[x, y], [x + dx, y + dy], [x + dx, y + h + dy], [x, y + h]], {
    fill: sideFill,
    planeDepth: 1.6,
  });
  addPlane('right-wall-front', [[x + w - sideWidth, y], [x + w, y], [x + w, y + h], [x + w - sideWidth, y + h]], {
    fill: sideFill,
    planeDepth: 2.2,
  });
  addPlane('right-wall-depth', [[x + w, y], [x + w + dx, y + dy], [x + w + dx, y + h + dy], [x + w, y + h]], {
    fill: sideFill,
    planeDepth: 1.6,
  });

  for (let i = 0; i <= shelves; i++) {
    const sy = y + (h * i) / shelves;
    addPlane(`shelf-${i + 1}-top`, [[x, sy], [x + w, sy], [x + w + dx, sy + dy], [x + dx, sy + dy]], {
      fill: topFill,
      planeDepth: 1.2 + i * 0.02,
    });
    addPlane(`shelf-${i + 1}-front`, [[x, sy], [x + w, sy], [x + w, sy + board], [x, sy + board]], {
      fill: frontFill,
      planeDepth: 2.4 + i * 0.02,
    });
  }

  const bookRows = Math.min(shelves, 5);
  for (let row = 0; row < bookRows; row++) {
    const rowTop = y + (h * row) / shelves + board * 1.25;
    const rowBottom = y + (h * (row + 1)) / shelves - board * 0.35;
    let cursor = x + sideWidth + w * 0.025;
    const rightLimit = x + w - sideWidth - w * 0.025;
    for (let b = 0; b < 9; b++) {
      const bw = w * (0.035 + ((b + row) % 4) * 0.009);
      if (cursor + bw > rightLimit) break;
      const lean = ((b + row) % 5) - 2;
      addPlane(`book-${row + 1}-${b + 1}-spine`, [
        [cursor + lean * 0.7, rowTop + Math.max(0, lean) * 1.5],
        [cursor + bw + lean * 0.7, rowTop],
        [cursor + bw - lean * 0.4, rowBottom],
        [cursor - lean * 0.35, rowBottom],
      ], {
        fill: mark.bookFill || bookPalette[(b + row) % bookPalette.length],
        strokeWidth: Math.max(0.6, strokeWidth * 0.55),
        planeDepth: 2.8 + row * 0.04 + b * 0.002,
      });
      cursor += bw + w * 0.012;
    }
  }

  return planes;
}

function expandPlaneMark(mark, index) {
  if (Array.isArray(mark.points) && mark.points.length >= 3) {
    return expandPlanePolygon({ ...mark, sourceIndex: mark.sourceIndex ?? index });
  }
  const anchor = Array.isArray(mark.anchor) ? mark.anchor : [mark.cx, mark.cy];
  const cx = finiteOr(anchor[0], 0);
  const cy = finiteOr(anchor[1], 0);
  const length = Math.max(finiteOr(mark.length, finiteOr(mark.h, 80)), 1);
  const width = Math.max(finiteOr(mark.width, finiteOr(mark.w, 20)), 1);
  const axis = normalize(mark.axis || [0, 1]);
  const normal = normalize([-axis[1], axis[0]]);
  const halfL = length / 2;
  const halfW = width / 2;
  return expandPlanePolygon({
    ...mark,
    points: [
      [cx - axis[0] * halfL - normal[0] * halfW, cy - axis[1] * halfL - normal[1] * halfW],
      [cx + axis[0] * halfL - normal[0] * halfW, cy + axis[1] * halfL - normal[1] * halfW],
      [cx + axis[0] * halfL + normal[0] * halfW, cy + axis[1] * halfL + normal[1] * halfW],
      [cx - axis[0] * halfL + normal[0] * halfW, cy - axis[1] * halfL + normal[1] * halfW],
    ],
    sourceIndex: mark.sourceIndex ?? index,
  });
}

function expandPlanePolygon(mark) {
  const points = (mark.points || []).map(([x, y]) => [roundPoint(x), roundPoint(y)]);
  const c = centroid(points);
  const {
    kind: _kind,
    anchor: _anchor,
    cx: _cx,
    cy: _cy,
    length: _length,
    width: _width,
    axis: _axis,
    ...rest
  } = mark;
  return {
    ...rest,
    kind: 'polygon',
    closed: true,
    role: mark.role || 'plane',
    points,
    fill: mark.fill || '#b1845e',
    stroke: mark.stroke || '#4f3928',
    strokeWidth: mark.strokeWidth ?? 1,
    sourceShape: mark.sourceShape || 'plane',
    formFamily: mark.formFamily || 'vector',
    planeRole: mark.planeRole || mark.role,
    planeDepth: finiteOr(mark.planeDepth, 0),
    depthAnchor: mark.depthAnchor || [roundPoint(c[0]), roundPoint(c[1])],
  };
}

function expandLibraryObjectMark(mark, index, scene) {
  const ref = mark.ref || mark.asset || mark.object;
  if (ref === 'bookshelf-wireframe' || ref === 'bookshelf') {
    return expandBookshelfWireframe(mark, index, scene);
  }
  throw new Error(`unknown vector object asset '${ref || '(missing ref)'}'`);
}

function expandBookshelfWireframe(mark, index, scene) {
  const x = finiteOr(mark.x, 80);
  const y = finiteOr(mark.y, 80);
  const w = Math.max(finiteOr(mark.w, 240), 20);
  const h = Math.max(finiteOr(mark.h, 320), 20);
  const depth = Math.max(finiteOr(mark.depth, Math.min(w, h) * 0.14), 0);
  const shelves = Math.max(1, Math.min(8, Math.round(finiteOr(mark.shelves, 4))));
  const columns = Math.max(1, Math.min(6, Math.round(finiteOr(mark.columns, 2))));
  const baseZ = finiteOr(mark.z, 10);
  const role = mark.role || 'bookshelf';
  const stroke = mark.stroke || '#5f4632';
  const faintStroke = mark.faintStroke || '#8a6b4e';
  const strokeWidth = finiteOr(mark.strokeWidth, 2);
  const perspective = normalize(mark.perspective || scene.view?.direction || [-0.45, -0.35]);
  const dx = roundPoint(-perspective[0] * depth);
  const dy = roundPoint(-perspective[1] * depth);
  const p = {
    flt: [x, y],
    frt: [x + w, y],
    flb: [x, y + h],
    frb: [x + w, y + h],
    blt: [x + dx, y + dy],
    brt: [x + w + dx, y + dy],
    blb: [x + dx, y + h + dy],
    brb: [x + w + dx, y + h + dy],
  };
  const common = {
    source: true,
    sourceShape: 'object',
    objectRef: 'bookshelf-wireframe',
    objectRole: role,
    sourceIndex: mark.sourceIndex ?? index,
  };
  const marks = [];
  const addLine = (name, a, b, extra = {}) => {
    marks.push({
      kind: 'line',
      role: `${role}:${name}`,
      x1: roundPoint(a[0]),
      y1: roundPoint(a[1]),
      x2: roundPoint(b[0]),
      y2: roundPoint(b[1]),
      stroke,
      strokeWidth,
      z: baseZ + 0.02,
      ...common,
      ...extra,
    });
  };
  const addPoly = (name, points, extra = {}) => {
    marks.push({
      kind: 'polygon',
      role: `${role}:${name}`,
      points: points.map(([px, py]) => [roundPoint(px), roundPoint(py)]),
      fill: 'none',
      stroke,
      strokeWidth,
      z: baseZ,
      ...common,
      ...extra,
    });
  };

  addPoly('front-frame', [p.flt, p.frt, p.frb, p.flb], { z: baseZ + 0.1 });
  addPoly('back-frame', [p.blt, p.brt, p.brb, p.blb], {
    stroke: faintStroke,
    strokeWidth: Math.max(1, strokeWidth * 0.75),
    z: baseZ - 0.1,
  });
  addLine('depth-top-left', p.flt, p.blt, { stroke: faintStroke, z: baseZ - 0.05 });
  addLine('depth-top-right', p.frt, p.brt, { stroke: faintStroke, z: baseZ - 0.05 });
  addLine('depth-bottom-left', p.flb, p.blb, { stroke: faintStroke, z: baseZ - 0.05 });
  addLine('depth-bottom-right', p.frb, p.brb, { stroke: faintStroke, z: baseZ - 0.05 });

  for (let i = 1; i < shelves; i++) {
    const t = i / shelves;
    const left = [x, y + h * t];
    const right = [x + w, y + h * t];
    const backLeft = [left[0] + dx, left[1] + dy];
    const backRight = [right[0] + dx, right[1] + dy];
    addLine(`shelf-front-${i}`, left, right, { z: baseZ + 0.12 });
    addLine(`shelf-depth-left-${i}`, left, backLeft, { stroke: faintStroke, z: baseZ - 0.02 });
    addLine(`shelf-depth-right-${i}`, right, backRight, { stroke: faintStroke, z: baseZ - 0.02 });
    addLine(`shelf-back-${i}`, backLeft, backRight, { stroke: faintStroke, z: baseZ - 0.08 });
  }

  for (let i = 1; i < columns; i++) {
    const t = i / columns;
    const top = [x + w * t, y];
    const bottom = [x + w * t, y + h];
    addLine(`divider-${i}`, top, bottom, { z: baseZ + 0.11 });
  }

  const bookRows = Math.min(shelves, 4);
  const palette = mark.bookPalette || ['#8f5f45', '#b1845e', '#6d7c74', '#7a5b80', '#c8a978'];
  for (let row = 0; row < bookRows; row++) {
    const rowTop = y + (h * row) / shelves + h * 0.035;
    const rowHeight = h / shelves - h * 0.075;
    const rowBottom = rowTop + rowHeight;
    const bookCount = Math.max(3, columns * 3 + (row % 2));
    let cursor = x + w * 0.045;
    for (let b = 0; b < bookCount; b++) {
      const bw = w * (0.045 + ((b + row) % 3) * 0.012);
      if (cursor + bw > x + w * 0.94) break;
      const inset = ((b + row) % 4) * h * 0.012;
      marks.push({
        kind: 'polygon',
        role: `${role}:book-${row + 1}-${b + 1}`,
        points: [
          [roundPoint(cursor), roundPoint(rowTop + inset)],
          [roundPoint(cursor + bw), roundPoint(rowTop + inset * 0.45)],
          [roundPoint(cursor + bw), roundPoint(rowBottom)],
          [roundPoint(cursor), roundPoint(rowBottom)],
        ],
        fill: mark.bookFill || palette[(b + row) % palette.length],
        stroke,
        strokeWidth: Math.max(0.75, strokeWidth * 0.45),
        z: baseZ + 0.2 + row * 0.01 + b * 0.001,
        ...common,
      });
      cursor += bw + w * 0.016;
    }
  }

  return marks;
}

function expandBlobMark(mark, index) {
  const hasAnchor =
    Array.isArray(mark.anchor) &&
    mark.anchor.length === 2 &&
    Number.isFinite(mark.anchor[0]) &&
    Number.isFinite(mark.anchor[1]);
  const hasCenter = Number.isFinite(mark.cx) && Number.isFinite(mark.cy);
  if (!hasAnchor && !hasCenter) {
    throw new Error(
      `blob '${mark.role || index}' requires anchor [x,y], cx/cy, or a valid top-level gesture with gestureT`,
    );
  }
  const anchor = hasAnchor ? mark.anchor : [mark.cx, mark.cy];
  const cx = finiteOr(anchor[0], 0);
  const cy = finiteOr(anchor[1], 0);
  const rx = Math.max(finiteOr(mark.rx, finiteOr(mark.r, 24)), 1);
  const ry = Math.max(finiteOr(mark.ry, finiteOr(mark.r, rx)), 1);
  const rotation = finiteOr(mark.rotation, 0);
  const pointCount = Math.max(8, Math.min(96, Math.round(finiteOr(mark.points, 32))));
  const wobble = mark.kind === 'ellipse' ? 0 : clamp(finiteOr(mark.wobble, 0.04), 0, 0.22);
  const seed = hashString(`${mark.role || mark.id || 'blob'}:${index}`);
  const cosR = Math.cos(rotation);
  const sinR = Math.sin(rotation);
  const points = [];

  for (let i = 0; i < pointCount; i++) {
    const t = (i / pointCount) * Math.PI * 2;
    const radial = 1 + wobble * deterministicWave(seed, i, t);
    const localX = Math.cos(t) * rx * radial;
    const localY = Math.sin(t) * ry * radial;
    points.push([
      roundPoint(cx + localX * cosR - localY * sinR),
      roundPoint(cy + localX * sinR + localY * cosR),
    ]);
  }

  const {
    anchor: _anchor,
    cx: _cx,
    cy: _cy,
    rx: _rx,
    ry: _ry,
    r: _r,
    rotation: _rotation,
    wobble: _wobble,
    points: _points,
    kind: _kind,
    ...rest
  } = mark;

  return {
    ...rest,
    kind: 'polygon',
    closed: true,
    role: mark.role || `${mark.kind}-${index + 1}`,
    points,
    sourceShape: mark.kind,
    sourceIndex: mark.sourceIndex ?? index,
    blobIndex: mark.blobIndex ?? index,
    blobRole: mark.blobRole || mark.role,
    depthAnchor: mark.depthAnchor || [cx, cy],
  };
}

function assignViewDepthZ(marks, scene) {
  const viewDirection = normalize(scene.view?.direction || [0, 1]);
  const baseZ = finiteOr(scene.view?.baseZ, 10);
  const step = finiteOr(scene.view?.blobZStep, 1);
  const forms = marks
    .map((mark, index) => ({ mark, index }))
    .filter(({ mark }) => mark?.z === undefined && mark?.kind === 'polygon' && hasFormLighting(mark));

  forms.sort((a, b) => {
    const depthA = blobDepthFor(a.mark, viewDirection);
    const depthB = blobDepthFor(b.mark, viewDirection);
    return depthA - depthB || a.index - b.index;
  });

  const zByIndex = new Map();
  for (let rank = 0; rank < forms.length; rank++) {
    zByIndex.set(forms[rank].index, round(baseZ + rank * step));
  }

  return marks.map((mark, index) => {
    if (!zByIndex.has(index)) return mark;
    return { ...mark, z: zByIndex.get(index), autoZ: true };
  });
}

function blobDepthFor(mark, viewDirection) {
  return dot(viewDirection, depthPointFor(mark));
}

function depthPointFor(mark) {
  if (Array.isArray(mark.depthAnchor) && mark.depthAnchor.length === 2) {
    return mark.depthAnchor;
  }
  if (Array.isArray(mark.anchor) && mark.anchor.length === 2) {
    return mark.anchor;
  }
  if (Array.isArray(mark.points) && mark.points.length >= 3) {
    return centroid(mark.points);
  }
  return [0, 0];
}

function materializeSourceMark(mark, palette) {
  if (mark.kind === 'polygon') {
    const shaded = hasFormLighting(mark);
    return {
      ...mark,
      fill: mark.fill || palette.base,
      stroke: shaded ? 'none' : mark.stroke || 'none',
      strokeWidth: shaded ? 0 : mark.strokeWidth ?? 0,
      opacity: mark.opacity ?? 1,
      source: true,
    };
  }
  return { ...mark, source: true };
}

function convexValueStack(shape, scene, palette) {
  if (shape.kind !== 'polygon' || !Array.isArray(shape.points) || shape.points.length < 3) {
    return [];
  }
  const points = shape.points;
  const light = normalize(scene.light?.direction || [-0.6, -0.8]);
  const intensity = clamp(shape.shade?.intensity ?? 1, 0, 1);
  const bb = bbox(points);
  const baseZ = shape.z ?? 0;
  const stickers = [];
  const projection = projectionRange(points, light);
  const defaultExpectedOverlap = 6;
  const bands = [
    { reach: 0.98, opacity: 0.026, fill: palette.shadow },
    { reach: 0.84, opacity: 0.046, fill: palette.shadow },
    { reach: 0.68, opacity: 0.076, fill: palette.shadow },
    { reach: 0.5, opacity: 0.118, fill: palette.core },
    { reach: 0.32, opacity: 0.18, fill: palette.core },
    { reach: 0.17, opacity: 0.275, fill: palette.deepest },
  ];
  const budget = resolveValueBudget(shape.shade?.valueBudget, {
    targetOpacity: bands.reduce((sum, band) => sum + band.opacity, 0),
    expectedOverlapCount: defaultExpectedOverlap,
    mode: 'legacy-band',
  });

  for (let i = 0; i < bands.length; i++) {
    const band = bands[i];
    const shadowCap = contourCap(points, light, projection, band.reach);
    if (shadowCap.length >= 3) {
      const opacity = budget.mode === 'legacy-band'
        ? band.opacity
        : opacityForBudget(budget.targetOpacity, budget.expectedOverlapCount, budget.mode);
      stickers.push({
        kind: 'polygon',
        role: `${shape.role || 'shape'}:edge-shadow-${i + 1}`,
        points: shadowCap,
        fill: band.fill,
        opacity: round(opacity * intensity),
        z: baseZ + 0.08 + i * 0.012,
        algorithmic: true,
        algorithm: 'convex-value-stack',
        pass: 'shadow',
        pastamaker: {
          dieFamily: 'softPatch',
          fieldKind: 'formContour',
          budgetMode: budget.mode,
          targetOpacity: round(budget.targetOpacity),
          expectedOverlapCount: budget.expectedOverlapCount,
        },
        blobIndex: shape.blobIndex,
        blobRole: shape.blobRole || shape.role,
      });
    }
  }

  const groundY = scene.ground?.y;
  if (Number.isFinite(groundY)) {
    const contact = bottomPoint(points);
    const width = Math.max(bb.w * 0.86, 1);
    const dx = -light[0] * bb.h * 0.55;
    stickers.push({
      kind: 'polygon',
      role: `${shape.role || 'shape'}:cast-shadow`,
      points: [
        [contact[0] - width * 0.45, groundY - 4],
        [contact[0] + width * 0.45, groundY - 4],
        [contact[0] + width * 0.62 + dx, groundY + bb.h * 0.12],
        [contact[0] - width * 0.48 + dx, groundY + bb.h * 0.1],
      ],
      fill: palette.cast,
      opacity: round(0.22 * intensity),
      z: baseZ - 0.6,
      algorithmic: true,
      algorithm: 'convex-value-stack',
      pass: 'cast-shadow',
      pastamaker: {
        dieFamily: 'softPatch',
        fieldKind: 'groundCast',
        budgetMode: 'single-layer',
        targetOpacity: round(0.22 * intensity),
        expectedOverlapCount: 1,
      },
      blobIndex: shape.blobIndex,
      blobRole: shape.blobRole || shape.role,
    });
  }

  return stickers;
}

function interBlobCastShadows(sourceMarks, scene, palette) {
  if (scene.interBlobShadows === false) return [];
  const forms = sourceMarks.filter(
    (mark) => mark?.kind === 'polygon' && Array.isArray(mark.points) && mark.points.length >= 3 && hasFormLighting(mark),
  );
  if (forms.length < 2) return [];

  const light = normalize(scene.light?.direction || [-0.6, -0.8]);
  const baseOpacity = clamp(finiteOr(scene.interBlobShadows?.opacity, 0.12), 0, 0.5);
  const reach = clamp(finiteOr(scene.interBlobShadows?.reach, 0.54), 0.1, 0.9);
  const maxGapScale = clamp(finiteOr(scene.interBlobShadows?.maxGapScale, 0.42), 0.05, 1.5);
  const candidatesByReceiver = new Map();

  for (const caster of forms) {
    const casterCenter = depthPointFor(caster);
    const casterBox = bbox(caster.points);
    const casterLightDepth = dot(light, casterCenter);
    const casterZ = caster.z ?? 0;

    for (const receiver of forms) {
      if (receiver === caster) continue;
      const receiverZ = receiver.z ?? 0;
      if (casterZ <= receiverZ) continue;

      const receiverCenter = depthPointFor(receiver);
      if (casterLightDepth <= dot(light, receiverCenter)) continue;

      const receiverBox = bbox(receiver.points);
      const gap = bboxGap(casterBox, receiverBox);
      const adjacencyLimit = Math.max(casterBox.w, casterBox.h, receiverBox.w, receiverBox.h) * maxGapScale;
      if (gap > adjacencyLimit) continue;

      const patch = interBlobShadowPatch({
        receiver,
        receiverCenter,
        receiverBox,
        casterCenter,
        casterBox,
        light,
        reach,
      });
      if (patch.length < 3) continue;

      const adjacency = 1 - clamp(gap / Math.max(adjacencyLimit, 1), 0, 1);
      const lightSeparation = clamp((casterLightDepth - dot(light, receiverCenter)) / 160, 0.35, 1);
      const opacity = round(baseOpacity * adjacency * lightSeparation);
      if (opacity < 0.035) continue;

      const zGap = Math.max(casterZ - receiverZ, 0.1);
      const score = (adjacency * lightSeparation) / zGap;
      const candidate = {
        kind: 'polygon',
        role: `${caster.role || 'shape'}:casts-on:${receiver.role || 'shape'}`,
        points: patch,
        fill: palette.core,
        opacity,
        z: receiverZ + 0.29,
        algorithmic: true,
        algorithm: 'inter-blob-cast-shadow',
        pass: 'inter-blob-shadow',
        casterBlobIndex: caster.blobIndex,
        casterBlobRole: caster.blobRole || caster.role,
        receiverBlobIndex: receiver.blobIndex,
        receiverBlobRole: receiver.blobRole || receiver.role,
        interBlobScore: round(score),
      };
      const key = receiver.sourceIndex ?? receiver.blobIndex ?? receiver.role;
      const previous = candidatesByReceiver.get(key);
      if (!previous || candidate.interBlobScore > previous.interBlobScore) {
        candidatesByReceiver.set(key, candidate);
      }
    }
  }

  return Array.from(candidatesByReceiver.values());
}

function interBlobShadowPatch({ receiver, receiverCenter, receiverBox, casterCenter, casterBox, light, reach }) {
  const shadowDir = normalize([-light[0], -light[1]]);
  const stripNormal = normalize([-shadowDir[1], shadowDir[0]]);
  const towardCaster = normalize([
    casterCenter[0] - receiverCenter[0],
    casterCenter[1] - receiverCenter[1],
  ]);
  const contactCenter = [
    receiverCenter[0] + (casterCenter[0] - receiverCenter[0]) * 0.32,
    receiverCenter[1] + (casterCenter[1] - receiverCenter[1]) * 0.32,
  ];
  const halfWidth = Math.max(
    4,
    Math.min(Math.max(casterBox.w, casterBox.h) * 0.34, Math.max(receiverBox.w, receiverBox.h) * 0.42),
  );
  const strip = clipBand(receiver.points, stripNormal, contactCenter, halfWidth);
  if (strip.length < 3) return [];

  const projection = projectionRange(receiver.points, towardCaster);
  const threshold = projection.max - Math.max(projection.max - projection.min, 1) * reach;
  return clipHalfPlane(strip, towardCaster, threshold, true);
}

function bboxGap(a, b) {
  const dx = Math.max(0, Math.max(a.minX - b.maxX, b.minX - a.maxX));
  const dy = Math.max(0, Math.max(a.minY - b.maxY, b.minY - a.maxY));
  return Math.hypot(dx, dy);
}

function simpleHighlight(shape, scene, palette) {
  if (shape.kind !== 'polygon' || !Array.isArray(shape.points) || shape.points.length < 3) {
    return [];
  }
  const points = shape.points;
  const c = centroid(points);
  const light = normalize(scene.light?.direction || [-0.6, -0.8]);
  const intensity = clamp(shape.highlights?.intensity ?? 0.35, 0, 1);
  const rimHold = clamp(finiteOr(shape.highlights?.rimHold, 0.08), 0, 0.35);
  const baseZ = shape.z ?? 0;
  const projection = projectionRange(points, light);
  const stickers = [];
  const defaultExpectedOverlap = 4;
  const bands = [
    { reach: 0.32, sag: 0.22, pinch: 0.42, opacity: 0.16, rimHold },
    { reach: 0.23, sag: 0.18, pinch: 0.34, opacity: 0.24, rimHold: rimHold * 0.82 },
    { reach: 0.15, sag: 0.14, pinch: 0.27, opacity: 0.34, rimHold: rimHold * 0.68 },
    { reach: 0.09, sag: 0.1, pinch: 0.2, opacity: 0.46, rimHold: rimHold * 0.52 },
  ];
  const budget = resolveValueBudget(shape.highlights?.valueBudget, {
    targetOpacity: bands.reduce((sum, band) => sum + band.opacity, 0),
    expectedOverlapCount: defaultExpectedOverlap,
    mode: 'legacy-band',
  });

  for (let i = 0; i < bands.length; i++) {
    const band = bands[i];
    const litPatch = highlightPatch(points, c, light, projection, band);
    if (litPatch.length >= 3) {
      const opacity = budget.mode === 'legacy-band'
        ? band.opacity
        : opacityForBudget(budget.targetOpacity, budget.expectedOverlapCount, budget.mode);
      stickers.push({
        kind: 'polygon',
        role: `${shape.role || 'shape'}:highlight-stack-${i + 1}`,
        points: litPatch,
        fill: palette.highlight,
        opacity: round(opacity * intensity),
        z: baseZ + 0.38 + i * 0.015,
        algorithmic: true,
        algorithm: 'simple-highlight',
        pass: 'highlight',
        pastamaker: {
          dieFamily: 'softPatch',
          fieldKind: 'formContour',
          budgetMode: budget.mode,
          targetOpacity: round(budget.targetOpacity),
          expectedOverlapCount: budget.expectedOverlapCount,
        },
        blobIndex: shape.blobIndex,
        blobRole: shape.blobRole || shape.role,
      });
    }
  }

  return stickers;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function resolveValueBudget(input, defaults = {}) {
  const budget = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const targetOpacity = clamp(
    finiteOr(budget.targetOpacity, finiteOr(defaults.targetOpacity, 0.75)),
    0,
    1,
  );
  const expectedOverlapCount = Math.max(
    1,
    Math.min(500, Math.round(finiteOr(budget.expectedOverlapCount, finiteOr(defaults.expectedOverlapCount, 1)))),
  );
  const mode = typeof budget.mode === 'string' ? budget.mode : defaults.mode || 'inverse-count';
  return { targetOpacity, expectedOverlapCount, mode };
}

function opacityForBudget(targetOpacity, expectedOverlapCount, mode = 'inverse-count') {
  const target = clamp(finiteOr(targetOpacity, 0.75), 0, 1);
  const count = Math.max(1, Math.round(finiteOr(expectedOverlapCount, 1)));
  if (mode === 'composited') {
    return round(clamp(1 - Math.pow(1 - target, 1 / count), 0, 1));
  }
  return round(clamp(target / count, 0, 1));
}

function finiteOr(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalize3([x, y, z]) {
  const len = Math.hypot(x, y, z);
  if (len < 1e-9) return [0, 0, 1];
  return [x / len, y / len, z / len];
}

function dot3([ax, ay, az], [bx, by, bz]) {
  return ax * bx + ay * by + az * bz;
}

function shadeHex(hex, factor) {
  const parsed = parseHexColor(hex);
  if (!parsed) return hex;
  const channels = parsed.map((channel) => clamp(Math.round(channel * factor), 0, 255));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function parseHexColor(hex) {
  if (typeof hex !== 'string') return null;
  const clean = hex.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    return clean.split('').map((c) => parseInt(`${c}${c}`, 16));
  }
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16));
  }
  return null;
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function deterministicWave(seed, index, t) {
  const a = ((seed % 17) + 3) * 0.017;
  const b = ((seed % 29) + 5) * 0.013;
  const c = ((seed % 37) + 7) * 0.011;
  return (
    Math.sin(t * 3 + seed * a + index * 0.13) * 0.48 +
    Math.sin(t * 5 + seed * b) * 0.32 +
    Math.cos(t * 2 + seed * c) * 0.2
  );
}

function roundPoint(n) {
  return Math.round(n * 100) / 100;
}

function projectionRange(points, axis) {
  let min = Infinity;
  let max = -Infinity;
  for (const p of points) {
    const v = dot(axis, p);
    min = Math.min(min, v);
    max = Math.max(max, v);
  }
  return { min, max };
}

function contourCap(points, axis, projection, reach) {
  const span = Math.max(projection.max - projection.min, 1);
  const tOf = (p) => (dot(axis, p) - projection.min) / span;
  let minIdx = 0;
  let minT = Infinity;
  for (let i = 0; i < points.length; i++) {
    const t = tOf(points[i]);
    if (t < minT) {
      minT = t;
      minIdx = i;
    }
  }

  const forward = walkContourToThreshold(points, tOf, minIdx, 1, reach);
  const backward = walkContourToThreshold(points, tOf, minIdx, -1, reach);
  const outerArc = backward.slice().reverse().concat(forward.slice(1));
  if (outerArc.length < 2) return [];

  const innerArc = outerArc.map(([x, y]) => {
    const localDepth = clamp(reach - tOf([x, y]), 0, reach);
    const inset = span * localDepth * 0.24;
    return [x + axis[0] * inset, y + axis[1] * inset];
  });
  return outerArc.concat(innerArc.reverse());
}

function highlightPatch(points, center, axis, projection, band) {
  const span = Math.max(projection.max - projection.min, 1);
  const tOf = (p) => (dot(axis, p) - projection.min) / span;
  let maxIdx = 0;
  let maxT = -Infinity;
  for (let i = 0; i < points.length; i++) {
    const t = tOf(points[i]);
    if (t > maxT) {
      maxT = t;
      maxIdx = i;
    }
  }

  const threshold = 1 - band.reach;
  const forward = walkContourToThresholdHigh(points, tOf, maxIdx, 1, threshold);
  const backward = walkContourToThresholdHigh(points, tOf, maxIdx, -1, threshold);
  const contourArc = backward.slice().reverse().concat(forward.slice(1));
  if (contourArc.length < 2) return [];
  const rimInset = span * clamp(band.rimHold ?? 0, 0, 0.35);
  const topArc = contourArc.map((p) => [
    p[0] - axis[0] * rimInset + (center[0] - p[0]) * 0.018,
    p[1] - axis[1] * rimInset + (center[1] - p[1]) * 0.018,
  ]);

  const left = topArc[0];
  const right = topArc[topArc.length - 1];
  const normal = normalize([-axis[1], axis[0]]);
  const bottom = [];
  const steps = Math.max(4, Math.min(10, topArc.length));
  for (let i = 0; i < steps; i++) {
    const u = i / (steps - 1);
    const edgeMix = [
      right[0] + (left[0] - right[0]) * u,
      right[1] + (left[1] - right[1]) * u,
    ];
    const bulge = Math.sin(Math.PI * u);
    const towardCenter = [
      edgeMix[0] + (center[0] - edgeMix[0]) * band.pinch,
      edgeMix[1] + (center[1] - edgeMix[1]) * band.pinch,
    ];
    const sag = span * band.sag * bulge;
    const candidate = [
      towardCenter[0] - axis[0] * sag + normal[0] * sag * 0.12 * (u - 0.5),
      towardCenter[1] - axis[1] * sag + normal[1] * sag * 0.12 * (u - 0.5),
    ];
    bottom.push(candidate);
  }

  return topArc.concat(bottom);
}

function walkContourToThresholdHigh(points, tOf, startIdx, dir, threshold) {
  const n = points.length;
  const out = [points[startIdx]];
  let idx = startIdx;
  for (let guard = 0; guard < n; guard++) {
    const nextIdx = (idx + dir + n) % n;
    const current = points[idx];
    const next = points[nextIdx];
    const currentT = tOf(current);
    const nextT = tOf(next);
    if (nextT >= threshold) {
      out.push(next);
      idx = nextIdx;
      continue;
    }
    const denom = nextT - currentT;
    const f = Math.abs(denom) < 1e-9 ? 0 : (threshold - currentT) / denom;
    out.push([
      current[0] + (next[0] - current[0]) * clamp(f, 0, 1),
      current[1] + (next[1] - current[1]) * clamp(f, 0, 1),
    ]);
    break;
  }
  return out;
}

function walkContourToThreshold(points, tOf, startIdx, dir, reach) {
  const n = points.length;
  const out = [points[startIdx]];
  let idx = startIdx;
  for (let guard = 0; guard < n; guard++) {
    const nextIdx = (idx + dir + n) % n;
    const current = points[idx];
    const next = points[nextIdx];
    const currentT = tOf(current);
    const nextT = tOf(next);
    if (nextT <= reach) {
      out.push(next);
      idx = nextIdx;
      continue;
    }
    const denom = nextT - currentT;
    const f = Math.abs(denom) < 1e-9 ? 0 : (reach - currentT) / denom;
    out.push([
      current[0] + (next[0] - current[0]) * clamp(f, 0, 1),
      current[1] + (next[1] - current[1]) * clamp(f, 0, 1),
    ]);
    break;
  }
  return out;
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}
