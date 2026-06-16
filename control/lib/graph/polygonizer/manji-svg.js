/**
 * Manji-svg — server-side SVG renderer for manji-tree manifests.
 *
 * Renders a manji-tree manifest (the format `create_manji_tree` mints
 * and stores in SketchRepository) to a self-contained SVG string. Used
 * by `/api/sketches/[ref]/svg/route.js` when it detects
 * `manifest.kind === 'manji-tree'`.
 *
 * Manifest shape:
 *   {
 *     kind: 'manji-tree',
 *     dimensions: '2d' | '3d',          // walker dispatch
 *     tree: ManjiTreeNode,              // see manji-program.js
 *     viewBox?: { width, height },      // optional explicit viewport
 *     camera?: cameraPrimitive,         // 3D only
 *     roomBasis?: roomBasis,            // 3D only
 *     title?: string,                   // optional title text
 *     showSlotMarkers?: boolean,        // optional slot dots overlay
 *     connections?: [{ from, to, sag?, wavelengths?, plane?, samples?, style? }],
 *                                       // 3D only — sine/cosine curves
 *                                       // between two named manji points.
 *                                       // See line-between.js.
 *     physics?: { gravity, gravityStrength, defaultSagFactor },
 *                                       // 3D only — scene-global field
 *                                       // used to derive connection sag
 *                                       // when not explicitly specified.
 *   }
 *
 * No external IO. Pure function over the manifest. Validation is
 * assumed to have happened at mint time via `validateManjiTree` /
 * `validateManjiTree3D` (for the tree) and `validateConnections` (for
 * connection endpoint paths) — the renderer trusts the manifest it stored.
 */

import {
  walkManjiTree,
  walkManjiTree3D,
  projectManjiTree,
  collectMergedFields,
} from './manji-program.js';
import { bboxOf } from './manji.js';
import { resolveManjiProgramRef, resolveManjiProgramCard } from './mandala-patterns.js';
import {
  buildEndpointResolver,
  defaultPhysics,
  sampleLineBetween,
  sampleLineBetweenVolumized,
} from './line-between.js';
import { sampleWaveField } from './wave-field.js';
import { printWaveManji } from './wave-manji.js';
import { sampleLathe } from './lathe.js';
import { sampleVajra } from './vajra.js';
import { sampleTaiji, taijiFibers } from './taiji.js';
import { makeLight, shadeHex, newellNormal, orientOutward, centroid } from './vexar.js';
import { buildFieldResolver } from './fields.js';
import { projectTwoPoint } from './pure-mandala.js';
import { resolveSkinColor } from './skin-palette.js';

const DEFAULT_VIEWPORT = { width: 1200, height: 600 };
const PAD = 32;

export function renderManjiTreeToSvg(manifest, options = {}) {
  if (!manifest || manifest.kind !== 'manji-tree') {
    throw new Error('renderManjiTreeToSvg: manifest.kind must be "manji-tree"');
  }
  const dimensions = manifest.dimensions === '3d' ? '3d' : '2d';
  if (dimensions === '3d') return renderTree3D(manifest, options);
  return renderTree2D(manifest);
}

// ----- 2D path --------------------------------------------------------

function renderTree2D(manifest) {
  const emitted = walkManjiTree(manifest.tree || {}, resolveManjiProgramRef);
  const points = collect2DPoints(emitted);
  const fit = viewportFit2D(points, manifest.viewBox);
  const body = [];

  for (const node of emitted) {
    if (!node.spineManji) continue;
    const isRoot = node.depth === 0;
    body.push(...renderManji2D(node.spineManji, fit, {
      stroke: isRoot ? '#222' : '#555',
      strokeWidth: isRoot ? 0.7 : 0.5,
      dotFill: isRoot ? '#222' : '#555',
      dotR: isRoot ? 1.0 : 0.7,
    }));
  }
  if (manifest.showSlotMarkers !== false) {
    const root = emitted.find((n) => n.depth === 0);
    if (root && Array.isArray(root.slots)) {
      for (const slot of root.slots) {
        const p = fit.toView(slot.worldPosition);
        body.push(circle(p.x, p.y, 1.4, '#a05', 0.45));
      }
    }
  }

  return wrapSvg(fit, body, manifest.title);
}

function collect2DPoints(emitted) {
  const points = [];
  for (const node of emitted) {
    if (node.spineManji) {
      for (const bar of node.spineManji.bars) {
        for (const p of Object.values(bar.points)) points.push(p);
      }
    }
    if (Array.isArray(node.slots)) {
      for (const s of node.slots) points.push(s.worldPosition);
    }
  }
  return points;
}

function viewportFit2D(points, explicitViewBox) {
  const viewport = explicitViewBox
    ? { width: Number(explicitViewBox.width) || DEFAULT_VIEWPORT.width,
        height: Number(explicitViewBox.height) || DEFAULT_VIEWPORT.height }
    : DEFAULT_VIEWPORT;
  if (!points.length) {
    return identityFit(viewport);
  }
  const bbox = bboxOf(points);
  const w = bbox.max.x - bbox.min.x;
  const h = bbox.max.y - bbox.min.y;
  const extent = Math.max(w, h, 1e-6);
  const innerW = viewport.width - 2 * PAD;
  const innerH = viewport.height - 2 * PAD;
  const s = Math.min(innerW, innerH) / extent;
  const cx = (bbox.min.x + bbox.max.x) / 2;
  const cy = (bbox.min.y + bbox.max.y) / 2;
  return {
    viewport,
    toView: (p) => ({
      x: viewport.width / 2 + s * (p.x - cx),
      y: viewport.height / 2 - s * (p.y - cy),
    }),
  };
}

function renderManji2D(manji, fit, style) {
  const lines = [];
  for (const bar of manji.bars) {
    for (const seg of bar.segments) {
      const a = fit.toView(seg.from);
      const b = fit.toView(seg.to);
      lines.push(line(a.x, a.y, b.x, b.y, style.stroke, style.strokeWidth));
    }
  }
  const dots = [
    manji.center,
    manji.bars[0].points.leftEnd,
    manji.bars[0].points.rightEnd,
    manji.bars[1].points.leftEnd,
    manji.bars[1].points.rightEnd,
  ];
  for (const d of dots) {
    const p = fit.toView(d);
    lines.push(circle(p.x, p.y, style.dotR, style.dotFill, 1));
  }
  return lines;
}

// ----- 3D path --------------------------------------------------------

function renderTree3D(manifest, options = {}) {
  const resolver = options.resolveProgramRef || resolveManjiProgramRef;
  const composedResolve = options.resolveProgramRef
    ? (ref) => options.resolveProgramRef(ref) || resolveManjiProgramRef(ref)
    : resolver;
  const emitted = walkManjiTree3D(manifest.tree || {}, composedResolve, {
    fields: manifest.fields || null,
  });
  const camera = manifest.camera || {};
  const roomBasis = manifest.roomBasis || {};
  const projected = projectManjiTree(emitted, camera, roomBasis);

  // ── Connections: sample each curve in 3D world space, then project
  // every sample point through the same perspective camera the manjis
  // use. Sampling happens once; the result feeds both the viewport fit
  // (so the viewBox grows to contain the curves) and the render pass.
  const projectedConnections = projectConnections(manifest, emitted, camera, roomBasis);

  // ── Surface fills: a polygon over a host quad's projected corners,
  // painted with a flat color or a light-direction-aligned gradient.
  // Sits BEHIND wave-fields in depth order so wave-field strokes paint
  // as texture on top of the surface wash.
  const projectedSurfaceFills = projectSurfaceFills(manifest, emitted, camera, roomBasis);

  // ── Wave fields: 2D height fields over 4-corner quads, sampled as a
  // grid of crest polylines. Zero waves = flat quad, the "flat floor"
  // default. Same projection path as everything else.
  const projectedWaveFields = projectWaveFields(manifest, emitted, camera, roomBasis);

  // ── Wave manji: closed-loop printer scripts winding around a singularity.
  // Each spec produces a stream of polylines (ouroboros = 1, mandala = N,
  // cloud = density-target). Same projection path as everything else.
  const projectedWaveManji = projectWaveManji(manifest, emitted, camera, roomBasis);

  // ── Lathes: 2D-closed surfaces of revolution. Each spec emits a stream
  // of cross-section polylines along the axis (one per height level),
  // optionally chiseled by N-fold angular harmonics.
  // Vexar (Lambert) light for opt-in lit/solid lathes (style.fill === 'vexar').
  // Default direction is a soft over-the-shoulder key; override via manifest.light.
  const latheLight = makeLight(manifest.light || {});
  const projectedLathes = projectLathes(manifest, emitted, camera, roomBasis, latheLight);

  // ── Vajras: 3-point relational volumes. Each emits a golden-ring stack
  // (iso-surface cross-sections of the smooth-union field). A vajra has
  // no world-space surface of its own — it paints its wave-space rings.
  const projectedVajras = projectVajras(manifest, emitted, camera, roomBasis);

  // ── Taijis: the chiral dual of the vajra. Each emits a rotating-S
  // partition stack (a helicoid) + two pole-strands (a double helix) +
  // an optional outer envelope. Like the vajra it paints only its
  // wave-space face; the handedness lives in the partition and strands.
  const projectedTaijis = projectTaijis(manifest, emitted, camera, roomBasis);

  const points = collect3DProjectedPoints(projected, projectedConnections, projectedWaveFields, projectedWaveManji, projectedLathes, projectedSurfaceFills, projectedVajras, projectedTaijis);
  const fit = viewportFit3D(points, manifest.viewBox);
  const body = [];
  const defs = [];

  // Surface fills paint FIRST — they're the underpainted wash that
  // sits beneath wave-field texture. Each fill is a polygon following
  // the host quad's projected corners, painted with either a flat
  // role-resolved color or a gradient whose axis is anchored to
  // scene.light.direction so the lit side aligns with where the
  // light is coming from.
  if (projectedSurfaceFills.length) {
    const sceneTone = manifest.scene?.light?.tone;
    const lightDir = manifest.scene?.light?.direction;
    let fillCounter = 0;
    for (const fill of projectedSurfaceFills) {
      const corners = fill.projectedCorners.map((c) => fit.toView(c));
      const pts = corners.map((c) => `${c.x.toFixed(2)},${c.y.toFixed(2)}`).join(' ');
      const fillSpec = fill.fill;
      let fillAttr;
      let opacityAttr = '';
      if (fillSpec?.gradient && typeof fillSpec.gradient === 'object') {
        const g = fillSpec.gradient;
        const fromColor = resolveSkinColor(g.fromRole, g.flavor, sceneTone);
        const toColor = resolveSkinColor(g.toRole || g.fromRole, g.flavor, sceneTone);
        const id = `surface-fill-${fillCounter++}`;
        const { x1, y1, x2, y2 } = gradientAxisForCorners(corners, lightDir, g.direction);
        defs.push(`    <linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"><stop offset="0" stop-color="${fromColor}" /><stop offset="1" stop-color="${toColor}" /></linearGradient>`);
        fillAttr = `url(#${id})`;
      } else if (typeof fillSpec?.role === 'string' && typeof fillSpec?.flavor === 'string') {
        fillAttr = resolveSkinColor(fillSpec.role, fillSpec.flavor, sceneTone);
      } else {
        fillAttr = fillSpec?.color || '#888';
      }
      if (Number.isFinite(fillSpec?.opacity)) opacityAttr = ` opacity="${fillSpec.opacity}"`;
      body.push(`  <polygon points="${pts}" fill="${fillAttr}"${opacityAttr} />`);
    }
  }

  // Wave fields paint SECOND — they're the floor / water surface, sitting
  // on top of surface fills (when present) and behind everything else
  // in the scene. Each field's iso-u + iso-v polylines combine into
  // one back-to-front-sorted segment stream so crests stack predictably
  // with depth.
  if (projectedWaveFields.length) {
    const sceneTone = manifest.scene?.light?.tone;
    let gradCounter = 0;
    for (const field of projectedWaveFields) {
      const sw = Number.isFinite(field.style?.width) ? field.style.width : 0.5;
      const opacity = Number.isFinite(field.style?.opacity) ? field.style.opacity : undefined;
      const dasharray = typeof field.style?.dasharray === 'string' ? field.style.dasharray : undefined;
      const segs = [];
      let bMinX = Infinity, bMinY = Infinity, bMaxX = -Infinity, bMaxY = -Infinity;
      for (const poly of field.polylines) {
        for (let i = 0; i + 1 < poly.length; i += 1) {
          const av = fit.toView(poly[i]);
          const bv = fit.toView(poly[i + 1]);
          segs.push({ a: av, b: bv, depthT: (poly[i].depthT + poly[i + 1].depthT) / 2 });
          if (av.x < bMinX) bMinX = av.x; if (av.x > bMaxX) bMaxX = av.x;
          if (av.y < bMinY) bMinY = av.y; if (av.y > bMaxY) bMaxY = av.y;
          if (bv.x < bMinX) bMinX = bv.x; if (bv.x > bMaxX) bMaxX = bv.x;
          if (bv.y < bMinY) bMinY = bv.y; if (bv.y > bMaxY) bMaxY = bv.y;
        }
      }
      segs.sort((a, b) => b.depthT - a.depthT);
      const resolved = resolveWaveFieldStroke(field.style, sceneTone);
      let stroke;
      if (resolved.kind === 'gradient') {
        const id = `wf-grad-${gradCounter++}`;
        defs.push(linearGradientDef(id, { minX: bMinX, minY: bMinY, maxX: bMaxX, maxY: bMaxY }, resolved.gradient));
        stroke = `url(#${id})`;
      } else {
        stroke = resolved.value;
      }
      for (const { a, b } of segs) {
        body.push(line(a.x, a.y, b.x, b.y, stroke, sw, opacity, dasharray));
      }
    }
  }

  // Back-to-front node order by root-center depthT.
  const sorted = [...projected].sort((a, b) => {
    const aD = a.projectedSpine?.bars?.[0]?.points?.center?.depthT ?? 0;
    const bD = b.projectedSpine?.bars?.[0]?.points?.center?.depthT ?? 0;
    return bD - aD;
  });

  for (const node of sorted) {
    if (!node.projectedSpine) continue;
    const isRoot = node.depth === 0;
    const role = nodeRole(node);

    // Role overlay UNDER the structural bars — silhouettes for figures,
    // weighted columns for pillars, filled boxes for detail/cube nodes.
    // Architecture-spine and default roles emit no overlay (the bars
    // ARE the visual presence). The structural bars then paint on top,
    // faded when there's an overlay so the silhouette/column reads.
    if (role === 'figure') body.push(...renderFigureSilhouette(node, fit));
    else if (role === 'pillar') body.push(...renderPillarColumn(node, fit));
    else if (role === 'detail') body.push(...renderDetailBox(node, fit));
    const hasOverlay = role === 'figure' || role === 'pillar' || role === 'detail';

    // Per-bar segment-level depth sort within each manji too.
    const allSegments = [];
    for (const bar of node.projectedSpine.bars) {
      for (const seg of bar.segments) {
        const depthT = (seg.from.depthT + seg.to.depthT) / 2;
        allSegments.push({ seg, depthT });
      }
    }
    allSegments.sort((a, b) => b.depthT - a.depthT);
    const stroke = isRoot
      ? '#222'
      : hasOverlay ? '#3d3325' : '#555';
    const sw = isRoot
      ? 1.4
      : hasOverlay ? 0.4 : 1.0;
    for (const { seg } of allSegments) {
      const a = fit.toView(seg.from);
      const b = fit.toView(seg.to);
      body.push(line(a.x, a.y, b.x, b.y, stroke, sw));
    }
    for (const bar of node.projectedSpine.bars) {
      for (const p of [bar.points.center, bar.points.negEnd, bar.points.posEnd]) {
        const v = fit.toView(p);
        body.push(circle(
          v.x, v.y,
          isRoot ? 2.4 : hasOverlay ? 0.8 : 1.8,
          isRoot ? '#222' : hasOverlay ? '#3d3325' : '#555',
          1,
        ));
      }
    }
  }

  // Lathes paint between manji structure and wave-manji — they're
  // structural/object surfaces (bowls, columns, balusters) that the
  // wave-manji circulations often live around. Each lathe's cross-
  // section polylines are depth-sorted at the segment level for
  // predictable stacking.
  if (projectedLathes.length) {
    // Lit (vexar) lathes emit shaded quad faces; they ACCUMULATE across all
    // lathes so the filled surfaces depth-sort against each other (a rod behind
    // a sphere is correctly occluded). Wireframe lathes paint inline as before
    // (1px rings never occlude), then the lit faces paint over them.
    const litFaces = [];
    for (const la of projectedLathes) {
      if (la.lit && la.faces) {
        litFaces.push(...la.faces);
        continue;
      }
      const stroke = la.style?.stroke || '#777';
      const sw = Number.isFinite(la.style?.width) ? la.style.width : 0.5;
      const opacity = Number.isFinite(la.style?.opacity) ? la.style.opacity : undefined;
      const dasharray = typeof la.style?.dasharray === 'string' ? la.style.dasharray : undefined;
      const segs = [];
      for (const poly of la.polylines) {
        for (let i = 0; i + 1 < poly.length; i += 1) {
          const a = poly[i];
          const b = poly[i + 1];
          segs.push({ a, b, depthT: (a.depthT + b.depthT) / 2 });
        }
      }
      segs.sort((a, b) => b.depthT - a.depthT);
      for (const { a, b } of segs) {
        const av = fit.toView(a);
        const bv = fit.toView(b);
        body.push(line(av.x, av.y, bv.x, bv.y, stroke, sw, opacity, dasharray));
      }
    }
    if (litFaces.length) {
      litFaces.sort((a, b) => b.depthT - a.depthT);
      for (const f of litFaces) {
        const pts = f.pts.map((p) => { const v = fit.toView(p); return `${v.x.toFixed(1)},${v.y.toFixed(1)}`; }).join(' ');
        // Thin same-color stroke closes the hairline seams between adjacent quads.
        body.push(`<polygon points="${pts}" fill="${f.fill}" stroke="${f.fill}" stroke-width="0.6" stroke-linejoin="round"/>`);
      }
    }
  }

  // Vajras paint their golden-ring stacks here — the wave-space face.
  // No fill, gold stroke, depth-sorted so the form reads as concentric
  // rings rather than a solid. This is the volume a later skin drapes on.
  if (projectedVajras.length) {
    for (const vj of projectedVajras) {
      const stroke = vj.style?.stroke || '#c9a23a';
      const sw = Number.isFinite(vj.style?.width) ? vj.style.width : 0.5;
      const opacity = Number.isFinite(vj.style?.opacity) ? vj.style.opacity : 0.7;
      const segs = [];
      for (const poly of vj.polylines) {
        for (let i = 0; i + 1 < poly.length; i += 1) {
          const a = poly[i];
          const b = poly[i + 1];
          segs.push({ a, b, depthT: (a.depthT + b.depthT) / 2 });
        }
      }
      segs.sort((a, b) => b.depthT - a.depthT);
      for (const { a, b } of segs) {
        const av = fit.toView(a);
        const bv = fit.toView(b);
        body.push(line(av.x, av.y, bv.x, bv.y, stroke, sw, opacity));
      }
    }
  }

  // Taijis paint their wave-space face here, beside the vajra rings. The
  // silver partition + optional envelope (the helicoid mesh) paint first,
  // depth-sorted; the two pole-strands paint on top, two-toned (yin teal /
  // yang gold) so the winding sense — the chirality — reads at a glance.
  if (projectedTaijis.length) {
    // Matter forms (silhouette / fiber print) accumulate across taijis so the
    // FILLED shapes depth-sort against each other (occlusion). Wireframe
    // taijis paint inline as before (1px lines never occlude).
    const matterOps = [];
    for (const tj of projectedTaijis) {
      const m = tj.matter;
      // Brush: render the form as thin strand strokes — a brushy needle, not a
      // filled leaf. Cheap (2 polylines) and reads as fine bristles en masse.
      if (m && m.fill === 'brush') {
        for (const strand of [tj.strandYin, tj.strandYang]) {
          if (!strand || strand.length < 2) continue;
          let d = 0; for (const p of strand) d += (p.depthT || 0); d /= strand.length;
          matterOps.push({ kind: 'poly', poly: strand, stroke: m.brushColor, width: m.brushWidth, opacity: m.opacity, depthT: d });
        }
        continue;
      }
      if (m && tj.silhouette && tj.silhouette.poly.length >= 3) {
        matterOps.push({
          kind: 'fill', poly: tj.silhouette.poly, fill: m.fillColor,
          stroke: m.fill === 'fibers' ? 'none' : m.edgeColor, width: 0.6,
          opacity: m.opacity, depthT: tj.silhouette.depthT,
        });
        if (m.fill === 'fibers' && Array.isArray(tj.fibers)) {
          for (const f of tj.fibers) {
            if (f.length < 2) continue;
            let d = 0; for (const p of f) d += (p.depthT || 0); d /= f.length;
            matterOps.push({ kind: 'poly', poly: f, stroke: m.fiberColor, width: m.fiberWidth, opacity: m.fiberOpacity, depthT: d });
          }
        }
        continue; // matter replaces the wireframe read for this form
      }
      const partStroke = tj.style?.partitionStroke || '#9aa0bd';
      const envStroke = tj.style?.envelopeStroke || '#5a6079';
      const yinStroke = tj.style?.yinStroke || '#4cc9c0';
      const yangStroke = tj.style?.yangStroke || '#e9c46a';
      const sw = Number.isFinite(tj.style?.width) ? tj.style.width : 0.7;
      const strandW = Number.isFinite(tj.style?.strandWidth) ? tj.style.strandWidth : 1.8;
      const meshSegs = [];
      const addSegs = (polys, segStroke, opacity) => {
        for (const poly of polys) {
          for (let i = 0; i + 1 < poly.length; i += 1) {
            const a = poly[i];
            const b = poly[i + 1];
            meshSegs.push({ a, b, depthT: (a.depthT + b.depthT) / 2, stroke: segStroke, opacity });
          }
        }
      };
      addSegs(tj.envelope, envStroke, 0.5);
      addSegs(tj.partition, partStroke, 0.85);
      meshSegs.sort((a, b) => b.depthT - a.depthT);
      for (const s of meshSegs) {
        const av = fit.toView(s.a);
        const bv = fit.toView(s.b);
        body.push(line(av.x, av.y, bv.x, bv.y, s.stroke, sw, s.opacity));
      }
      for (const [poly, stroke] of [[tj.strandYin, yinStroke], [tj.strandYang, yangStroke]]) {
        const segs = [];
        for (let i = 0; i + 1 < poly.length; i += 1) {
          const a = poly[i];
          const b = poly[i + 1];
          segs.push({ a, b, depthT: (a.depthT + b.depthT) / 2 });
        }
        segs.sort((a, b) => b.depthT - a.depthT);
        for (const { a, b } of segs) {
          const av = fit.toView(a);
          const bv = fit.toView(b);
          body.push(line(av.x, av.y, bv.x, bv.y, stroke, strandW, 0.95));
        }
      }
    }
    // Paint the matter forms back-to-front: filled silhouettes occlude, fiber
    // polylines lay on top of their belly. One <polygon>/<polyline> per form —
    // fewer DOM nodes than the wireframe mesh it replaces.
    matterOps.sort((a, b) => b.depthT - a.depthT);
    for (const op of matterOps) {
      const pts = op.poly.map((p) => { const v = fit.toView(p); return `${v.x.toFixed(2)},${v.y.toFixed(2)}`; }).join(' ');
      if (op.kind === 'fill') {
        const strokeAttr = op.stroke && op.stroke !== 'none' ? ` stroke="${op.stroke}" stroke-width="${op.width}"` : '';
        body.push(`  <polygon points="${pts}" fill="${op.fill}" fill-opacity="${op.opacity}"${strokeAttr} stroke-linejoin="round" />`);
      } else {
        body.push(`  <polyline points="${pts}" fill="none" stroke="${op.stroke}" stroke-width="${op.width}" stroke-opacity="${op.opacity}" stroke-linejoin="round" stroke-linecap="round" />`);
      }
    }
  }

  // Wave manji paint between manjis and connections — they are
  // singularity-anchored circulations that the connections often weave
  // around. Each spec's polylines are depth-sorted at the segment level
  // so coplanar passes stack predictably.
  if (projectedWaveManji.length) {
    for (const wm of projectedWaveManji) {
      const stroke = wm.style?.stroke || '#222';
      const sw = Number.isFinite(wm.style?.width) ? wm.style.width : 1.0;
      const opacity = Number.isFinite(wm.style?.opacity) ? wm.style.opacity : undefined;
      const dasharray = typeof wm.style?.dasharray === 'string' ? wm.style.dasharray : undefined;
      const segs = [];
      for (const poly of wm.polylines) {
        for (let i = 0; i + 1 < poly.length; i += 1) {
          const a = poly[i];
          const b = poly[i + 1];
          segs.push({ a, b, depthT: (a.depthT + b.depthT) / 2 });
        }
      }
      segs.sort((a, b) => b.depthT - a.depthT);
      for (const { a, b } of segs) {
        const av = fit.toView(a);
        const bv = fit.toView(b);
        body.push(line(av.x, av.y, bv.x, bv.y, stroke, sw, opacity, dasharray));
      }
    }
  }

  // Connections paint after the manjis — they are typically what the
  // viewer's eye follows, and the structural frame is supposed to read
  // as the carrier of the relations. Connections themselves are
  // depth-sorted back-to-front by average depthT so coplanar overlays
  // stack predictably. Volumetric connections (crossSection: 'lateral')
  // paint as a filled polygon between leftPoly and rightPoly first,
  // then the centerline stroke on top for outline emphasis.
  if (projectedConnections.length) {
    const ordered = [...projectedConnections].sort((a, b) => b.avgDepthT - a.avgDepthT);
    for (const conn of ordered) {
      const stroke = conn.style?.stroke || '#222';
      const sw = Number.isFinite(conn.style?.width) ? conn.style.width : 1.2;
      const fill = conn.style?.fill || '#d7c7a4';
      const opacity = Number.isFinite(conn.style?.opacity) ? conn.style.opacity : undefined;
      const dasharray = typeof conn.style?.dasharray === 'string' ? conn.style.dasharray : undefined;
      if (conn.leftPoly && conn.rightPoly) {
        const ring = [];
        for (const p of conn.leftPoly) ring.push(fit.toView(p));
        for (let i = conn.rightPoly.length - 1; i >= 0; i -= 1) ring.push(fit.toView(conn.rightPoly[i]));
        body.push(polygon(ring, fill, stroke, sw));
      } else {
        for (let i = 0; i + 1 < conn.polyline.length; i += 1) {
          const a = fit.toView(conn.polyline[i]);
          const b = fit.toView(conn.polyline[i + 1]);
          body.push(line(a.x, a.y, b.x, b.y, stroke, sw, opacity, dasharray));
        }
      }
    }
  }

  if (manifest.showSlotMarkers !== false) {
    const root = projected.find((n) => n.depth === 0);
    if (root && Array.isArray(root.projectedSlots)) {
      for (const slot of root.projectedSlots) {
        const v = fit.toView(slot.projected);
        body.push(circle(v.x, v.y, 3, '#a05', 0.5));
      }
    }
  }

  return wrapSvg(fit, body, manifest.title, defs);
}

// ----- Role-aware overlays -------------------------------------------
//
// The structural manji rendering above is faithful but reads as a
// wireframe diagram, not a scene. These helpers add a per-role visual
// layer underneath the bars: silhouettes for figure cards, filled
// columns for vertical-dominant inline nodes (pillars), small boxes
// for cube-shaped inline nodes (detail). Role is inferred from
// `programRef → card.family` first, then from the inline node's
// structural shape if no programRef is present.
//
// The overlays paint UNDER the structural bars so the bars remain a
// debug surface — visible but de-emphasized when an overlay carries
// the visual role.

const KNOWN_ROLES = new Set(['figure', 'pillar', 'detail', 'arch-spine', 'default']);

function nodeRole(emittedNode) {
  // Explicit role on the tree IR wins — authors who want a specific
  // overlay (e.g. an inline node that should read as a pillar regardless
  // of bar ratios) set `role: 'pillar'` on the tree node and bypass both
  // the card-family lookup and the bar-length heuristic.
  const explicit = emittedNode?.role;
  if (explicit && KNOWN_ROLES.has(explicit)) return explicit;

  const ref = emittedNode?.programRef;
  if (ref) {
    const card = resolveManjiProgramCard(ref);
    const family = card?.family || '';
    if (family === 'figure-posture') return 'figure';
    if (family === 'still-life-arrangement') return 'detail';
    if (family.endsWith('-shot-glyph')) return 'arch-spine';
    if (family === 'classical-composition') return 'arch-spine';
    if (family === 'camera-shot') return 'arch-spine';
  }
  // Inline nodes: heuristic on world-space bar lengths.
  const bars = emittedNode?.spineManji?.bars;
  if (Array.isArray(bars)) {
    const lenFor = (axis) => {
      const bar = bars.find((b) => b.axis === axis);
      if (!bar) return 0;
      const a = bar.points.center;
      const b = bar.points.posEnd;
      return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    };
    const zLen = lenFor('Zenith-Nadir');
    const horMax = Math.max(lenFor('N-S'), lenFor('E-W'));
    if (zLen > 0 && zLen > 1.8 * Math.max(0.001, horMax)) return 'pillar';
    if (zLen > 0 && horMax > 0 && Math.abs(zLen - horMax) < 0.3 * zLen && zLen < 1.5) return 'detail';
  }
  return 'default';
}

function renderFigureSilhouette(node, fit) {
  const zBar = node.projectedSpine?.bars?.find((b) => b.axis === 'Zenith-Nadir');
  const xBar = node.projectedSpine?.bars?.find((b) => b.axis === 'N-S');
  if (!zBar) return [];
  const head = fit.toView(zBar.points.posTip);
  const foot = fit.toView(zBar.points.negTip);
  if (!finite2(head) || !finite2(foot)) return [];
  let halfW;
  if (xBar) {
    const a = fit.toView(xBar.points.negEnd);
    const b = fit.toView(xBar.points.posEnd);
    halfW = Math.max(2.5, Math.hypot(a.x - b.x, a.y - b.y) * 0.45);
  } else {
    halfW = Math.max(2.5, Math.hypot(head.x - foot.x, head.y - foot.y) * 0.08);
  }
  const headHW = halfW * 0.62;
  const pts = [
    `${(foot.x - halfW).toFixed(2)},${foot.y.toFixed(2)}`,
    `${(foot.x + halfW).toFixed(2)},${foot.y.toFixed(2)}`,
    `${(head.x + headHW).toFixed(2)},${head.y.toFixed(2)}`,
    `${(head.x - headHW).toFixed(2)},${head.y.toFixed(2)}`,
  ];
  // Head circle on top so the figure reads as person, not as ingot.
  const headR = Math.max(2.2, halfW * 0.55);
  return [
    `  <polygon points="${pts.join(' ')}" fill="#867260" stroke="#3d3325" stroke-width="0.7" />`,
    `  <circle cx="${head.x.toFixed(2)}" cy="${(head.y - headR * 0.55).toFixed(2)}" r="${headR.toFixed(2)}" fill="#a89381" stroke="#3d3325" stroke-width="0.6" />`,
  ];
}

function renderPillarColumn(node, fit) {
  const zBar = node.projectedSpine?.bars?.find((b) => b.axis === 'Zenith-Nadir');
  if (!zBar) return [];
  const top = fit.toView(zBar.points.posTip);
  const bottom = fit.toView(zBar.points.negTip);
  if (!finite2(top) || !finite2(bottom)) return [];
  const dx = top.x - bottom.x;
  const dy = top.y - bottom.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return [];
  const px = -dy / len;
  const py = dx / len;
  const halfW = Math.max(2.5, len * 0.04);
  const tlx = top.x - px * halfW;
  const tly = top.y - py * halfW;
  const trx = top.x + px * halfW;
  const try_ = top.y + py * halfW;
  const blx = bottom.x - px * halfW;
  const bly = bottom.y - py * halfW;
  const brx = bottom.x + px * halfW;
  const bry = bottom.y + py * halfW;
  return [
    `  <polygon points="${tlx.toFixed(2)},${tly.toFixed(2)} ${trx.toFixed(2)},${try_.toFixed(2)} ${brx.toFixed(2)},${bry.toFixed(2)} ${blx.toFixed(2)},${bly.toFixed(2)}" fill="#c8a978" stroke="#5a4d3d" stroke-width="0.7" />`,
  ];
}

function renderDetailBox(node, fit) {
  if (!node.projectedSpine) return [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const bar of node.projectedSpine.bars) {
    for (const p of Object.values(bar.points)) {
      const v = fit.toView(p);
      if (!finite2(v)) continue;
      if (v.x < minX) minX = v.x;
      if (v.x > maxX) maxX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.y > maxY) maxY = v.y;
    }
  }
  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || maxX - minX < 1) return [];
  return [
    `  <rect x="${minX.toFixed(2)}" y="${minY.toFixed(2)}" width="${(maxX - minX).toFixed(2)}" height="${(maxY - minY).toFixed(2)}" fill="#a09080" stroke="#564a3a" stroke-width="0.6" />`,
  ];
}

function finite2(p) {
  return p && Number.isFinite(p.x) && Number.isFinite(p.y);
}

// Extract a screen-space silhouette from K-sample rings projected through
// the camera. At each station: take the screen-space tangent from the
// projected centerline, find its perpendicular, dot every projected ring
// point against that perpendicular, and pick the min/max as the left/right
// silhouette samples. Falls back to vertical extremes when the tangent
// degenerates (a station near zero screen-velocity, e.g. the limb's
// endpoints in some camera angles).
function tubeSilhouetteFromProjectedRings(projectedRings, projectedCenterline) {
  const leftPoly = [];
  const rightPoly = [];
  const n = projectedRings.length;
  for (let i = 0; i < n; i++) {
    const a = projectedCenterline[Math.max(0, i - 1)];
    const b = projectedCenterline[Math.min(n - 1, i + 1)];
    let tx = b.x - a.x;
    let ty = b.y - a.y;
    const tlen = Math.hypot(tx, ty);
    if (tlen < 1e-6) { tx = 1; ty = 0; }
    else { tx /= tlen; ty /= tlen; }
    const px = -ty;
    const py = tx;
    let minDot = Infinity;
    let maxDot = -Infinity;
    let minP = projectedRings[i][0];
    let maxP = projectedRings[i][0];
    for (const rp of projectedRings[i]) {
      const d = rp.x * px + rp.y * py;
      if (d < minDot) { minDot = d; minP = rp; }
      if (d > maxDot) { maxDot = d; maxP = rp; }
    }
    leftPoly.push(minP);
    rightPoly.push(maxP);
  }
  return { leftPoly, rightPoly };
}

function projectOneConnection(spec, selfId, resolveEndpoint, physics, camera, roomBasis) {
  const from = resolveEndpoint(spec.from, selfId);
  const to = resolveEndpoint(spec.to, selfId);
  // Pass spread comes first; resolved 3D endpoints override the string
  // paths. The renderer must never let `spec.from` / `spec.to` strings
  // reach `sampleLineBetween`.
  const resolved = { ...spec, from, to };
  const project = (p) => {
    const [x, y, depthT] = projectTwoPoint(p, camera, roomBasis);
    return { x, y, depthT };
  };
  const wantsVolume = spec.crossSection && spec.crossSection !== 'none';
  if (wantsVolume) {
    const sample = sampleLineBetweenVolumized(resolved, physics);
    const polyline = sample.centerline.map(project);
    let leftPoly;
    let rightPoly;
    if (sample.kind === 'lateral') {
      leftPoly = sample.leftEdge.map(project);
      rightPoly = sample.rightEdge.map(project);
    } else {
      const projectedRings = sample.rings.map((ring) => ring.map(project));
      ({ leftPoly, rightPoly } = tubeSilhouetteFromProjectedRings(projectedRings, polyline));
    }
    const avgDepthT = polyline.reduce((sum, p) => sum + (p.depthT || 0), 0) /
      Math.max(polyline.length, 1);
    return { spec, polyline, leftPoly, rightPoly, style: spec.style || null, avgDepthT };
  }
  const samples = sampleLineBetween(resolved, physics);
  const polyline = samples.map(project);
  const avgDepthT = polyline.reduce((sum, p) => sum + (p.depthT || 0), 0) /
    Math.max(polyline.length, 1);
  return { spec, polyline, style: spec.style || null, avgDepthT };
}

function projectOneWaveField(spec, selfId, resolveEndpoint, physics, camera, roomBasis, fieldResolver = null) {
  // Corners accept endpoint paths OR inline {x,y,z} — same convention
  // wave-surface fields use. Pass-through inline points; resolve
  // strings via the endpoint resolver.
  const resolvedCorners = (spec.corners || []).map((p) => {
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)) {
      return p;
    }
    return resolveEndpoint(p, selfId);
  });
  // heightField (when present) replaces inline waves. The field's value
  // at each base point becomes the displacement scalar — same semantic
  // as the inline wave-height, so wave-surface fields with z=0 corners
  // produce the same visible surface.
  let heightFn = null;
  if (typeof spec.heightField === 'string' && fieldResolver) {
    const evaluator = fieldResolver(spec.heightField);
    heightFn = (basePoint) => evaluator(basePoint);
  }
  const { isoUPolylines, isoVPolylines } = sampleWaveField(spec, physics, resolvedCorners, heightFn);
  const projectPoly = (poly) => poly.map((p) => {
    const [x, y, depthT] = projectTwoPoint(p, camera, roomBasis);
    return { x, y, depthT };
  });
  const polylines = [
    ...isoUPolylines.map(projectPoly),
    ...isoVPolylines.map(projectPoly),
  ];
  return { spec, polylines, style: spec.style || null };
}

// Project the union of top-level `connections[]` and in-tree
// `kind: 'connection'` leaf marks emitted by the walker. Order:
// top-level array specs first (author order), then in-tree leaf marks
// (walker emit order, i.e. tree order). This gives a stable, predictable
// paint sequence whether scenes mix the two authoring forms or not.
function projectConnections(manifest, emittedNodes, camera, roomBasis) {
  const arraySpecs = Array.isArray(manifest.connections) ? manifest.connections : [];
  const leafNodes = emittedNodes.filter((n) => n?.leafMark?.kind === 'connection');
  if (arraySpecs.length === 0 && leafNodes.length === 0) return [];
  const resolveEndpoint = buildEndpointResolver(emittedNodes);
  const physics = { ...defaultPhysics(), ...(manifest.physics || {}) };
  const out = [];
  for (const spec of arraySpecs) {
    out.push(projectOneConnection(spec, undefined, resolveEndpoint, physics, camera, roomBasis));
  }
  for (const node of leafNodes) {
    const { spec, selfId } = node.leafMark;
    out.push(projectOneConnection(spec, selfId, resolveEndpoint, physics, camera, roomBasis));
  }
  return out;
}

function projectOneWaveManji(spec, selfId, resolveEndpoint, physics, camera, roomBasis, fieldResolver) {
  const singularity = typeof spec.singularity === 'string'
    ? resolveEndpoint(spec.singularity, selfId)
    : spec.singularity;
  const { polylines } = printWaveManji({ ...spec, singularity }, physics, fieldResolver);
  const projected = polylines.map((poly) => poly.map((p) => {
    const [x, y, depthT] = projectTwoPoint(p, camera, roomBasis);
    return { x, y, depthT };
  }));
  return { spec, polylines: projected, style: spec.style || null };
}

// Build the merged-and-compiled field resolver for a manifest. Mirrors
// projectWaveManji's local construction so wave-fields can read fields
// the same way. Returns null when nothing references fields (no
// allocation cost in the common case).
function buildManifestFieldResolver(manifest, emittedNodes) {
  const { merged: mergedFields } = collectMergedFields(emittedNodes, manifest.fields);
  if (!mergedFields || Object.keys(mergedFields).length === 0) return null;
  return buildFieldResolver(mergedFields, emittedNodes);
}

// Surface fills — a polygon over the host quad's projected corners,
// painted with a single color or a gradient. Sits behind wave-fields
// in the depth order so wave-field strokes paint as texture on top of
// the surface wash. Gradient axis is anchored to scene.light.direction
// when present, so the lit side of the surface naturally aligns with
// where the light is coming from.
function projectSurfaceFills(manifest, emittedNodes, camera, roomBasis) {
  const arraySpecs = Array.isArray(manifest.surfaceFills) ? manifest.surfaceFills : [];
  if (arraySpecs.length === 0) return [];
  const resolveEndpoint = buildEndpointResolver(emittedNodes);
  const out = [];
  for (const spec of arraySpecs) {
    if (!Array.isArray(spec?.corners) || spec.corners.length !== 4) continue;
    const projectedCorners = spec.corners.map((corner) => {
      const p = (corner && Number.isFinite(corner.x))
        ? corner
        : resolveEndpoint(corner);
      const [x, y, depthT] = projectTwoPoint(p, camera, roomBasis);
      return { x, y, depthT };
    });
    out.push({ spec, projectedCorners, fill: spec.fill || null });
  }
  return out;
}

// Same pattern for wave-fields.
function projectWaveFields(manifest, emittedNodes, camera, roomBasis) {
  const arraySpecs = Array.isArray(manifest.waveFields) ? manifest.waveFields : [];
  const leafNodes = emittedNodes.filter((n) => n?.leafMark?.kind === 'wave-field');
  if (arraySpecs.length === 0 && leafNodes.length === 0) return [];
  const resolveEndpoint = buildEndpointResolver(emittedNodes);
  const physics = { ...defaultPhysics(), ...(manifest.physics || {}) };
  const fieldResolver = buildManifestFieldResolver(manifest, emittedNodes);
  const out = [];
  for (const spec of arraySpecs) {
    out.push(projectOneWaveField(spec, undefined, resolveEndpoint, physics, camera, roomBasis, fieldResolver));
  }
  for (const node of leafNodes) {
    const { spec, selfId } = node.leafMark;
    out.push(projectOneWaveField(spec, selfId, resolveEndpoint, physics, camera, roomBasis, fieldResolver));
  }
  return out;
}

function latheIsLit(spec) {
  return spec?.style?.fill === 'vexar' || spec?.lit === true;
}

// Build vexar-shaded quad faces from a lathe's world-space ring grid. The grid
// is index-aligned (cross-sections × samples), so a quad is four adjacent grid
// points; the outward normal is oriented away from the axis (radial), which is
// the true surface normal for the convex solids ball-and-stick wants. Painter's
// depth-sort handles occlusion (back faces paint first), so no back-face cull or
// camera position is needed.
function litLatheFaces(polylines, axisFrom, axisTo, baseColor, light, camera, roomBasis) {
  const rows = polylines.length;
  const faces = [];
  const ax = (t) => [
    axisFrom.x + t * (axisTo.x - axisFrom.x),
    axisFrom.y + t * (axisTo.y - axisFrom.y),
    axisFrom.z + t * (axisTo.z - axisFrom.z),
  ];
  for (let i = 0; i + 1 < rows; i += 1) {
    const a = polylines[i];
    const b = polylines[i + 1];
    const cols = Math.min(a.length, b.length);
    const axisMid = ax((i + 0.5) / (rows - 1));
    for (let j = 0; j + 1 < cols; j += 1) {
      const world = [a[j], b[j], b[j + 1], a[j + 1]].map((p) => [p.x, p.y, p.z]);
      const cen = centroid(world);
      const n = orientOutward(newellNormal(world), cen, axisMid);
      const fill = shadeHex(baseColor, n, light);
      let depth = 0;
      const pts = world.map((w) => {
        const [x, y, depthT] = projectTwoPoint({ x: w[0], y: w[1], z: w[2] }, camera, roomBasis);
        depth += depthT;
        return { x, y, depthT };
      });
      faces.push({ pts, fill, depthT: depth / 4 });
    }
  }
  return faces;
}

function projectOneLathe(spec, selfId, resolveEndpoint, camera, roomBasis, light) {
  const axisFrom = typeof spec.axisFrom === 'string'
    ? resolveEndpoint(spec.axisFrom, selfId)
    : spec.axisFrom;
  const axisTo = typeof spec.axisTo === 'string'
    ? resolveEndpoint(spec.axisTo, selfId)
    : spec.axisTo;
  const { polylines } = sampleLathe({ ...spec, axisFrom, axisTo });
  if (latheIsLit(spec)) {
    const baseColor = spec.style?.fillColor || spec.style?.color || spec.style?.stroke || '#9aa3b2';
    const faces = litLatheFaces(polylines, axisFrom, axisTo, baseColor, light, camera, roomBasis);
    return { spec, lit: true, faces, style: spec.style || null };
  }
  const projected = polylines.map((poly) => poly.map((p) => {
    const [x, y, depthT] = projectTwoPoint(p, camera, roomBasis);
    return { x, y, depthT };
  }));
  return { spec, polylines: projected, style: spec.style || null };
}

function projectLathes(manifest, emittedNodes, camera, roomBasis, light) {
  const arraySpecs = Array.isArray(manifest.lathes) ? manifest.lathes : [];
  const leafNodes = emittedNodes.filter((n) => n?.leafMark?.kind === 'lathe');
  if (arraySpecs.length === 0 && leafNodes.length === 0) return [];
  const resolveEndpoint = buildEndpointResolver(emittedNodes);
  const out = [];
  for (const spec of arraySpecs) {
    out.push(projectOneLathe(spec, undefined, resolveEndpoint, camera, roomBasis, light));
  }
  for (const node of leafNodes) {
    const { spec, selfId } = node.leafMark;
    out.push(projectOneLathe(spec, selfId, resolveEndpoint, camera, roomBasis, light));
  }
  return out;
}

function projectOneVajra(spec, selfId, resolveEndpoint, camera, roomBasis) {
  const resolvePoint = (v) => (typeof v === 'string' ? resolveEndpoint(v, selfId) : v);
  const resolved = {
    ...spec,
    proximal: resolvePoint(spec.proximal),
    center: resolvePoint(spec.center),
    distal: resolvePoint(spec.distal),
  };
  const { rings } = sampleVajra(resolved);
  const projected = rings.map((ring) => ring.polyline.map((p) => {
    const [x, y, depthT] = projectTwoPoint(p, camera, roomBasis);
    return { x, y, depthT };
  }));
  return { spec, polylines: projected, style: spec.style || null };
}

function projectVajras(manifest, emittedNodes, camera, roomBasis) {
  const arraySpecs = Array.isArray(manifest.vajras) ? manifest.vajras : [];
  const leafNodes = emittedNodes.filter((n) => n?.leafMark?.kind === 'vajra');
  if (arraySpecs.length === 0 && leafNodes.length === 0) return [];
  const resolveEndpoint = buildEndpointResolver(emittedNodes);
  const out = [];
  for (const spec of arraySpecs) {
    out.push(projectOneVajra(spec, undefined, resolveEndpoint, camera, roomBasis));
  }
  for (const node of leafNodes) {
    const { spec, selfId } = node.leafMark;
    out.push(projectOneVajra(spec, selfId, resolveEndpoint, camera, roomBasis));
  }
  return out;
}

function projectOneTaiji(spec, selfId, resolveEndpoint, camera, roomBasis) {
  const resolvePoint = (v) => (typeof v === 'string' ? resolveEndpoint(v, selfId) : v);
  const matter = normalizeTaijiMatter(spec);
  // Silhouette / fiber matter needs the envelope; brush only needs the strands.
  const needEnvelope = matter && (matter.fill === 'silhouette' || matter.fill === 'fibers');
  const resolved = {
    ...spec,
    yin: resolvePoint(spec.yin),
    yang: resolvePoint(spec.yang),
    center: resolvePoint(spec.center),
    showEnvelope: spec.showEnvelope || needEnvelope,
  };
  const { rings, strands, envelope } = sampleTaiji(resolved);
  const projPt = (p) => { const [x, y, depthT] = projectTwoPoint(p, camera, roomBasis); return { x, y, depthT }; };
  const projPoly = (poly) => poly.map(projPt);

  // Wave→world print: a taiji carrying `matter` lowers to a filled silhouette
  // (+ optional fibers), or — for `brush` — to thin strand strokes (a brushy
  // needle, not a leaf). See wave-to-world-paint.plan.md.
  let silhouette = null;
  let fibers = null;
  let resolvedMatter = matter && matter.fill === 'brush' ? matter : null;
  if (needEnvelope && Array.isArray(envelope) && envelope.length >= 2) {
    silhouette = taijiSilhouetteRibbon(envelope.map((r) => ({ c: projPt(r.center), pts: projPoly(r.polyline) })));
    if (silhouette) {
      resolvedMatter = matter;
      if (matter.fill === 'fibers') {
        fibers = taijiFibers(resolved, {
          count: matter.density, shells: matter.shells, alignment: matter.alignment,
          wobble: matter.wobble, seed: matter.seed,
        }).map(projPoly);
      }
    }
  }

  return {
    spec,
    matter: resolvedMatter,
    silhouette,
    fibers,
    partition: rings.map((r) => projPoly(r.polyline)),
    envelope: envelope ? envelope.map((r) => projPoly(r.polyline)) : [],
    strandYin: projPoly(strands.yin),
    strandYang: projPoly(strands.yang),
    style: spec.style || null,
  };
}

// Normalize an optional taiji `matter` spec for the print pass. Returns null
// for the default wireframe read; otherwise a resolved descriptor whose colors
// fall back to the taiji's own style palette.
function normalizeTaijiMatter(spec) {
  const m = spec?.matter;
  if (!m || typeof m !== 'object' || Array.isArray(m)) return null;
  if (m.fill !== 'silhouette' && m.fill !== 'fibers' && m.fill !== 'brush') return null; // 'none'/absent → wireframe
  const style = spec.style || {};
  return {
    fill: m.fill,
    opacity: Number.isFinite(m.opacity) ? m.opacity : (m.fill === 'fibers' ? 0.55 : (m.fill === 'brush' ? 0.8 : 0.85)),
    fillColor: m.fillColor || style.partitionStroke || '#4a7c3a',
    edgeColor: m.edgeColor || style.yangStroke || '#33691e',
    fiberColor: m.fiberColor || style.yangStroke || '#1b5e20',
    brushColor: m.brushColor || style.partitionStroke || style.yangStroke || '#33691e',
    brushWidth: Number.isFinite(m.brushWidth) ? m.brushWidth : 0.7,
    fiberWidth: Number.isFinite(m.fiberWidth) ? m.fiberWidth : 0.5,
    fiberOpacity: Number.isFinite(m.fiberOpacity) ? m.fiberOpacity : 0.5,
    density: Number.isInteger(m.density) ? m.density : 10,
    shells: Number.isInteger(m.shells) ? m.shells : 1,
    alignment: Number.isFinite(m.alignment) ? m.alignment : 0.85,
    wobble: Number.isFinite(m.wobble) ? m.wobble : 0.2,
    seed: Number.isInteger(m.seed) ? m.seed : 7,
  };
}

// The swept-envelope silhouette as a closed ribbon, in screen space. Per
// cross-section we take the two projected envelope extremes ⟂ to the local
// screen axis; the left edge runs up and the right edge runs back, so it
// follows a bent (Bézier) axis. Returns { poly: [{x,y,depthT}], depthT }.
function taijiSilhouetteRibbon(projRings) {
  if (!Array.isArray(projRings) || projRings.length < 2) return null;
  const left = [];
  const right = [];
  for (let i = 0; i < projRings.length; i += 1) {
    const c = projRings[i].c;
    const nxt = projRings[Math.min(i + 1, projRings.length - 1)].c;
    const prv = projRings[Math.max(i - 1, 0)].c;
    let dx = nxt.x - prv.x;
    let dy = nxt.y - prv.y;
    const dl = Math.hypot(dx, dy) || 1;
    dx /= dl; dy /= dl;
    const nx = -dy;
    const ny = dx;
    let maxS = 0;
    let minS = 0;
    let pPos = c;
    let pNeg = c;
    for (const p of projRings[i].pts) {
      const s = (p.x - c.x) * nx + (p.y - c.y) * ny;
      if (s > maxS) { maxS = s; pPos = p; }
      if (s < minS) { minS = s; pNeg = p; }
    }
    left.push(pNeg);
    right.push(pPos);
  }
  const poly = left.concat(right.reverse());
  const depthT = projRings.reduce((a, r) => a + (r.c.depthT || 0), 0) / projRings.length;
  return { poly, depthT };
}

function projectTaijis(manifest, emittedNodes, camera, roomBasis) {
  const arraySpecs = Array.isArray(manifest.taijis) ? manifest.taijis : [];
  const leafNodes = emittedNodes.filter((n) => n?.leafMark?.kind === 'taiji');
  if (arraySpecs.length === 0 && leafNodes.length === 0) return [];
  const resolveEndpoint = buildEndpointResolver(emittedNodes);
  const out = [];
  for (const spec of arraySpecs) {
    out.push(projectOneTaiji(spec, undefined, resolveEndpoint, camera, roomBasis));
  }
  for (const node of leafNodes) {
    const { spec, selfId } = node.leafMark;
    out.push(projectOneTaiji(spec, selfId, resolveEndpoint, camera, roomBasis));
  }
  return out;
}

function projectWaveManji(manifest, emittedNodes, camera, roomBasis) {
  const arraySpecs = Array.isArray(manifest.waveManji) ? manifest.waveManji : [];
  const leafNodes = emittedNodes.filter((n) => n?.leafMark?.kind === 'wave-manji');
  if (arraySpecs.length === 0 && leafNodes.length === 0) return [];
  const resolveEndpoint = buildEndpointResolver(emittedNodes);
  const physics = { ...defaultPhysics(), ...(manifest.physics || {}) };
  // Merge card-declared fields (walker-emitted side-channel records)
  // with host manifest.fields before building the resolver. Host wins
  // on collisions; inter-card collisions are caught at mint time and
  // never reach the renderer.
  const { merged: mergedFields } = collectMergedFields(emittedNodes, manifest.fields);
  const fieldResolver = buildFieldResolver(mergedFields, emittedNodes);
  const out = [];
  for (const spec of arraySpecs) {
    out.push(projectOneWaveManji(spec, undefined, resolveEndpoint, physics, camera, roomBasis, fieldResolver));
  }
  for (const node of leafNodes) {
    const { spec, selfId } = node.leafMark;
    out.push(projectOneWaveManji(spec, selfId, resolveEndpoint, physics, camera, roomBasis, fieldResolver));
  }
  return out;
}

function collect3DProjectedPoints(projected, projectedConnections = [], projectedWaveFields = [], projectedWaveManji = [], projectedLathes = [], projectedSurfaceFills = [], projectedVajras = [], projectedTaijis = []) {
  const out = [];
  for (const node of projected) {
    if (node.projectedSpine) {
      for (const bar of node.projectedSpine.bars) {
        for (const p of Object.values(bar.points)) out.push(p);
      }
    }
    if (Array.isArray(node.projectedSlots)) {
      for (const s of node.projectedSlots) out.push(s.projected);
    }
  }
  for (const conn of projectedConnections) {
    for (const p of conn.polyline) out.push(p);
  }
  for (const field of projectedWaveFields) {
    for (const poly of field.polylines) {
      for (const p of poly) out.push(p);
    }
  }
  for (const wm of projectedWaveManji) {
    for (const poly of wm.polylines) {
      for (const p of poly) out.push(p);
    }
  }
  for (const la of projectedLathes) {
    if (la.lit && la.faces) {
      for (const f of la.faces) for (const p of f.pts) out.push(p);
    } else if (la.polylines) {
      for (const poly of la.polylines) for (const p of poly) out.push(p);
    }
  }
  for (const fill of projectedSurfaceFills) {
    for (const p of fill.projectedCorners) out.push(p);
  }
  for (const vj of projectedVajras) {
    for (const poly of vj.polylines) {
      for (const p of poly) out.push(p);
    }
  }
  for (const tj of projectedTaijis) {
    for (const poly of [...tj.partition, ...tj.envelope, tj.strandYin, tj.strandYang]) {
      for (const p of poly) out.push(p);
    }
  }
  return out;
}

function viewportFit3D(points, explicitViewBox) {
  // Projected points are already in drawing-space coords; we just need
  // to compute a viewBox that contains them with padding.
  if (!points.length) {
    return identityFit(explicitViewBox || DEFAULT_VIEWPORT);
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  if (!Number.isFinite(minX)) return identityFit(DEFAULT_VIEWPORT);
  const viewport = {
    width: maxX - minX + 2 * PAD,
    height: maxY - minY + 2 * PAD,
    minX: minX - PAD,
    minY: minY - PAD,
  };
  return {
    viewport,
    toView: (p) => ({ x: p.x, y: p.y }),
  };
}

// ----- shared SVG helpers ---------------------------------------------

function identityFit(viewport) {
  return {
    viewport,
    toView: (p) => ({ x: viewport.width / 2 + (p.x || 0), y: viewport.height / 2 + (p.y || 0) }),
  };
}

function line(x1, y1, x2, y2, stroke, sw, opacity, dasharray) {
  const opAttr = opacity !== undefined && opacity !== 1 ? ` opacity="${opacity}"` : '';
  const dashAttr = dasharray ? ` stroke-dasharray="${dasharray}"` : '';
  return `  <line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"${opAttr}${dashAttr} />`;
}

function circle(cx, cy, r, fill, opacity) {
  const opAttr = opacity !== undefined && opacity !== 1 ? ` opacity="${opacity}"` : '';
  return `  <circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r}" fill="${fill}"${opAttr} />`;
}

function polygon(points, fill, stroke, sw) {
  const pts = points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
  return `  <polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" />`;
}

function wrapSvg(fit, body, title, defs = []) {
  const vp = fit.viewport;
  const minX = vp.minX ?? 0;
  const minY = vp.minY ?? 0;
  const titleNode = title
    ? `  <text x="${(minX + 12).toFixed(2)}" y="${(minY + vp.height - 12).toFixed(2)}" font-family="monospace" font-size="${(vp.height / 32).toFixed(1)}" fill="#666">${escapeXml(title)}</text>`
    : '';
  const defsBlock = Array.isArray(defs) && defs.length > 0
    ? `  <defs>\n${defs.join('\n')}\n  </defs>\n`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX.toFixed(0)} ${minY.toFixed(0)} ${vp.width.toFixed(0)} ${vp.height.toFixed(0)}" width="900" height="${(900 * vp.height / vp.width).toFixed(0)}">
${defsBlock}  <rect x="${minX.toFixed(2)}" y="${minY.toFixed(2)}" width="${vp.width.toFixed(2)}" height="${vp.height.toFixed(2)}" fill="#fafaf6" stroke="#aaa" stroke-width="0.6" />
${body.join('\n')}
${titleNode}
</svg>
`;
}

/**
 * Resolve a wave-field layer's stroke spec into either a literal color
 * or a gradient descriptor. Three forms in priority order:
 *   1. style.gradient = { from?, to?, direction?, fromRole, toRole?, flavor }
 *      → returns { kind: 'gradient', gradient: { fromColor, toColor, direction } }
 *      direction is 'horizontal' | 'vertical' | 'diagonal-nw-se' | 'diagonal-ne-sw'
 *      and anchors to the layer's projected screen bbox (camera-space).
 *      toRole defaults to fromRole when omitted (then it's a single-color
 *      gradient — useful for value-only fades via opacity).
 *   2. style.role + style.flavor → flat fill from palette.
 *   3. style.stroke literal hex → unchanged from before.
 *   4. Fallback '#888' if nothing matched.
 */
function resolveWaveFieldStroke(style, sceneTone) {
  if (style?.gradient && typeof style.gradient === 'object') {
    const g = style.gradient;
    const flavor = g.flavor;
    const fromRole = g.fromRole;
    const toRole = g.toRole || g.fromRole;
    if (typeof flavor === 'string' && typeof fromRole === 'string') {
      const fromColor = resolveSkinColor(fromRole, flavor, sceneTone);
      const toColor = resolveSkinColor(toRole, flavor, sceneTone);
      const direction = typeof g.direction === 'string' ? g.direction : 'horizontal';
      return { kind: 'gradient', gradient: { fromColor, toColor, direction } };
    }
  }
  if (typeof style?.role === 'string' && typeof style?.flavor === 'string') {
    return { kind: 'literal', value: resolveSkinColor(style.role, style.flavor, sceneTone) };
  }
  return { kind: 'literal', value: style?.stroke || '#888' };
}

/**
 * Compute gradient endpoints for a surface-fill polygon. When the scene
 * declares `light.direction` (a 2D unit vector pointing toward the
 * light source), the gradient axis aligns to it: the highlight (stop
 * offset 1) lands on the side of the polygon facing the light, and the
 * shadow (stop offset 0) lands opposite. Move the light, the gradient
 * rotates with it.
 *
 * If light direction is absent or `authoredDirection` is provided
 * explicitly, fall back to a bbox-aligned direction ('horizontal',
 * 'vertical', 'diagonal-nw-se', 'diagonal-ne-sw').
 */
function gradientAxisForCorners(corners, lightDir, authoredDirection) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of corners) {
    if (c.x < minX) minX = c.x; if (c.x > maxX) maxX = c.x;
    if (c.y < minY) minY = c.y; if (c.y > maxY) maxY = c.y;
  }
  if (Array.isArray(lightDir) && lightDir.length >= 2 && !authoredDirection) {
    const lx = Number(lightDir[0]);
    const ly = Number(lightDir[1]);
    const mag = Math.hypot(lx, ly);
    if (mag > 1e-9) {
      const ux = lx / mag;
      const uy = ly / mag;
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const halfDiag = 0.5 * Math.hypot(maxX - minX, maxY - minY);
      // Shadow at the end light TRAVELS toward (away from source),
      // highlight at the end light COMES FROM. scene.light.direction
      // points TOWARD the source, so highlight = centroid + lightDir,
      // shadow = centroid - lightDir.
      return {
        x1: cx - ux * halfDiag,
        y1: cy - uy * halfDiag,
        x2: cx + ux * halfDiag,
        y2: cy + uy * halfDiag,
      };
    }
  }
  switch (authoredDirection) {
    case 'vertical':       return { x1: minX, y1: minY, x2: minX, y2: maxY };
    case 'diagonal-nw-se': return { x1: minX, y1: minY, x2: maxX, y2: maxY };
    case 'diagonal-ne-sw': return { x1: maxX, y1: minY, x2: minX, y2: maxY };
    case 'horizontal':
    default:               return { x1: minX, y1: minY, x2: maxX, y2: minY };
  }
}

/**
 * Build an SVG <linearGradient> defs entry anchored to a viewport-space
 * bbox. `direction` maps to gradient endpoints:
 *   horizontal      → left to right
 *   vertical        → top to bottom
 *   diagonal-nw-se  → top-left to bottom-right
 *   diagonal-ne-sw  → top-right to bottom-left
 */
function linearGradientDef(id, bbox, gradient) {
  const { minX, minY, maxX, maxY } = bbox;
  let x1, y1, x2, y2;
  switch (gradient.direction) {
    case 'vertical':       x1 = minX; y1 = minY; x2 = minX; y2 = maxY; break;
    case 'diagonal-nw-se': x1 = minX; y1 = minY; x2 = maxX; y2 = maxY; break;
    case 'diagonal-ne-sw': x1 = maxX; y1 = minY; x2 = minX; y2 = maxY; break;
    case 'horizontal':
    default:               x1 = minX; y1 = minY; x2 = maxX; y2 = minY; break;
  }
  return `    <linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"><stop offset="0" stop-color="${gradient.fromColor}" /><stop offset="1" stop-color="${gradient.toColor}" /></linearGradient>`;
}

function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, (ch) => {
    switch (ch) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
      default: return ch;
    }
  });
}
