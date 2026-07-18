/**
 * Scaffold renderer — the deterministic derived render of an
 * image-outcomes manifest. Same manifest → same SVG bytes.
 *
 * The scaffold is what conditions generation (fed to the image model as an
 * image input) and what the /sketches page shows before a render is bound.
 * Color language: strict forms amber, guided purple/blue/green by depth
 * band, protected zones red, overlay zones teal, bubbles dashed white.
 *
 * `renderScaffoldSvg(manifest, { panelId })` crops a sequential-art
 * scaffold to one panel's bounds — the per-panel pull payload (plan I3).
 *
 * `{ control: true }` renders the ControlNet variant: geometry only — no
 * text labels, no dashed bubble/zone boxes, no vanishing-point dot. The
 * default scaffold is written for an LLM worker (labels teach it); a
 * structural conditioner traces every mark literally, so labels become
 * pseudo-text and dashes become painted dashes (the first local render's
 * failure mode — local-render-worker.plan.md).
 */

import {
  KIND_IMAGE_OUTCOME,
  KIND_SEQUENTIAL_ART,
  KIND_CHARACTER_SHEET,
  normalizeImageOutcomesManifest,
} from './manifest.js';
import { poseFigure } from './poses.js';
import { renderFigureToSvg, sampleMotionPose } from '../polygonizer/figure-render.js';

// A rig figure renders through the protoform mesher (create_figure's
// renderer) with a transparent background and nests into the scene as an
// inline <svg>, anchored to the SAME geometry as a stick figure: (x, y) is
// mid-torso, the figure spans y − 96s (head top) to y + 104s (feet), so a
// stick pose can be upgraded to a rig without re-staging the panel.
function rigFigureSvg(figure) {
  const { x, y, scale = 1, rig } = figure;
  // Pose resolution: sample the authored motion vocabulary at the given
  // phase (the same choreographies create_figure animates), then let
  // explicit per-joint pose keys override the sample.
  const sampled = rig.motion != null ? sampleMotionPose(rig.motion, rig.phase ?? 0) : null;
  const pose = sampled ? { ...sampled, ...(rig.pose || {}) } : rig.pose;
  const doc = renderFigureToSvg({
    fluffs: rig.fluffs,
    pose,
    proto: rig.proto,
    garment: rig.garment ?? null,
    view: rig.view,
    setup: rig.setup,
    background: false,
  });
  const match = doc.match(/<svg[^>]*viewBox="([^"]+)"[^>]*>([\s\S]*)<\/svg>/);
  if (!match) throw new Error(`figure ${figure.id}: protoform render returned no <svg viewBox>`);
  const [, viewBox, inner] = match;
  const [, , vbW, vbH] = viewBox.split(/\s+/).map(Number);
  const h = 200 * scale;
  const w = h * (vbW / vbH);
  return `<svg x="${x - w / 2}" y="${y - 96 * scale}" width="${w}" height="${h}" viewBox="${viewBox}" preserveAspectRatio="xMidYMax meet">${inner}</svg>`;
}

function figureSvg(figure) {
  return figure.rig ? rigFigureSvg(figure) : poseFigure(figure);
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function polygonPoints(points) {
  return points.map((p) => `${p[0]},${p[1]}`).join(' ');
}

function formColor(form) {
  if (form.preserve === 'strict') return '#f59e0b';
  if (form.depthBand === 'foreground') return '#22c55e';
  if (form.depthBand === 'background') return '#60a5fa';
  return '#a78bfa';
}

// In the control variant, only STRICT forms render at all — their outline
// is real scene geometry the conditioner should hold. Guided/loose polygons
// are region hints, not object silhouettes; ANY visible mark (stroke or
// fill — a fill is still a luminance step) gets traced into the art as a
// literal floating shape (local-render-worker.plan.md, first live run:
// a rectangular skyline band became a painted rectangle at every strength).
// Guided/loose content is prompt territory for a structural conditioner.
function formPolygon(form, { control } = {}) {
  if (control && form.preserve !== 'strict') return '';
  return `<polygon points="${polygonPoints(form.polygon)}" fill="${formColor(form)}" fill-opacity="${form.preserve === 'strict' ? 0.38 : 0.22}" stroke="${formColor(form)}" stroke-width="${form.preserve === 'strict' ? 5 : 3}"/>`;
}

function bubble(zone) {
  return `<rect x="${zone.x}" y="${zone.y}" width="${zone.w}" height="${zone.h}" rx="${Math.min(42, zone.h / 2)}" fill="#f8fafc" fill-opacity="0.08" stroke="#f8fafc" stroke-width="4" stroke-dasharray="10 8"/>`;
}

function svgDocument({ viewBox, defs = '', body }) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${viewBox.split(' ')[2]}" height="${viewBox.split(' ')[3]}">
${defs ? `  <defs>${defs}</defs>\n` : ''}${body}
</svg>
`;
}

function renderImageOutcomeSvg(manifest, { control } = {}) {
  const { width, height } = manifest.viewBox;
  const [vx, vy] = manifest.vanishingPoint;
  const zoneMarks = [
    ...manifest.protectedZones.map((z) => ({ ...z, kind: 'protected', color: '#ef4444' })),
    ...manifest.overlayZones.map((z) => ({ ...z, kind: 'overlay', color: '#14b8a6' })),
  ];
  const body = [
    `  <rect width="${width}" height="${height}" fill="#10151f"/>`,
    `  <rect y="${manifest.horizonY}" width="${width}" height="${height - manifest.horizonY}" fill="#151b26"/>`,
    `  <line x1="0" y1="${manifest.horizonY}" x2="${width}" y2="${manifest.horizonY}" stroke="#94a3b8" stroke-width="3"${control ? '' : ' stroke-dasharray="12 12"'} opacity="0.7"/>`,
    ...(control ? [] : [
      `  <circle cx="${vx}" cy="${vy}" r="8" fill="#f8fafc"/>`,
      `  <text x="24" y="42" fill="#f8fafc" font-size="28" font-family="Inter, system-ui, sans-serif" font-weight="700">${esc(manifest.title)}</text>`,
      `  <text x="24" y="76" fill="#cbd5e1" font-size="17" font-family="Inter, system-ui, sans-serif">${esc(manifest.mode)} scaffold; strict = amber, guided = purple/blue/green</text>`,
    ]),
    ...manifest.forms.map((form) => [
      `  ${formPolygon(form, { control })}`,
      ...(control ? [] : [
        `  <text x="${form.bbox.x + 8}" y="${form.bbox.y + 24}" fill="#f8fafc" font-size="18" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">${esc(form.id)}</text>`,
      ]),
    ].join('\n')),
    ...manifest.figures.map((f) => `  ${figureSvg(f)}`),
    ...(control ? [] : zoneMarks.map((zone) => [
      `  <rect x="${zone.x}" y="${zone.y}" width="${zone.w}" height="${zone.h}" fill="none" stroke="${zone.color}" stroke-width="4" stroke-dasharray="10 8"/>`,
      `  <text x="${zone.x + 8}" y="${zone.y + 24}" fill="${zone.color}" font-size="18" font-family="Inter, system-ui, sans-serif">${esc(zone.label || zone.kind)}</text>`,
    ].join('\n'))),
  ].join('\n');
  return svgDocument({ viewBox: `0 0 ${width} ${height}`, body });
}

function renderPanel(panel, { control } = {}) {
  const b = panel.bounds;
  const bg = `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="#111827"/>`;
  const forms = panel.forms.map((f) => formPolygon(f, { control })).join('');
  const figures = panel.figures.map(figureSvg).join('');
  const bubbles = control ? '' : panel.bubbleZones.map(bubble).join('');
  const label = control
    ? ''
    : `<text x="${b.x + 18}" y="${b.y + b.h - 24}" fill="#cbd5e1" font-size="22" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">${esc(panel.id)} ${esc(panel.camera.kind)}</text>`;
  return {
    def: `<clipPath id="clip-${esc(panel.id)}"><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}"/></clipPath>`,
    body: [
      `  <g clip-path="url(#clip-${esc(panel.id)})">${bg}${forms}${figures}${bubbles}${label}</g>`,
      `  <rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="none" stroke="#f8fafc" stroke-width="8"/>`,
    ].join('\n'),
  };
}

function renderSequentialArtSvg(manifest, { panelId, control } = {}) {
  const { width, height } = manifest.viewBox;
  let panels = manifest.panels;
  let viewBox = `0 0 ${width} ${height}`;
  let header = control ? '' : [
    `  <text x="80" y="54" fill="#f8fafc" font-size="34" font-family="Inter, system-ui, sans-serif" font-weight="800">${esc(manifest.title)}</text>`,
    `  <text x="820" y="54" fill="#94a3b8" font-size="20" font-family="Inter, system-ui, sans-serif">${esc(manifest.pageRecipe)} / ${esc(manifest.readingFlow)}</text>`,
  ].join('\n');
  if (panelId) {
    const panel = manifest.panels.find((p) => p.id === panelId);
    if (!panel) throw new Error(`unknown panel id: ${panelId}`);
    panels = [panel];
    const b = panel.bounds;
    viewBox = `${b.x} ${b.y} ${b.w} ${b.h}`;
    header = ''; // a panel crop is pure shot, no page chrome
  }
  const rendered = panels.map((p) => renderPanel(p, { control }));
  const body = [
    `  <rect x="${panelId ? panels[0].bounds.x : 0}" y="${panelId ? panels[0].bounds.y : 0}" width="${panelId ? panels[0].bounds.w : width}" height="${panelId ? panels[0].bounds.h : height}" fill="#0b0f19"/>`,
    header,
    ...rendered.map((r) => r.body),
  ].filter(Boolean).join('\n');
  return svgDocument({
    viewBox,
    defs: rendered.map((r) => r.def).join(''),
    body,
  });
}

// Character-sheet scaffold: the model-sheet strip layout itself — four view
// columns (front / three-quarter / side / back) on a common ground line, one
// row per outfit. The layout IS the instruction (the pan-cel plan's
// model-sheet-strip decision): stick placeholders mark where each view
// stands, labels name the columns/rows in the control layer only.
const SHEET_VIEWS = ['front', 'three-quarter', 'side', 'back'];
// Each turnaround column is a REAL camera of the one tuned body (not four
// repeats of the same view) — the geometric identity lock. Maps the sheet's
// column label to a figure-render camera (FIGURE_VIEWS / VIEW_AZ).
export const SHEET_VIEW_CAMERA = { front: 'frontal', 'three-quarter': 'three-quarter', side: 'lateral', back: 'back' };
// The per-outfit body dials (character-from-dream C1 wardrobe channel) merged
// OVER the shared rig body so each row wears its own outfit on the same body.
const OUTFIT_DIAL_KEYS = ['garment', 'pose', 'motion', 'phase', 'proto'];
const outfitDialsOf = (outfit) => {
  const o = {};
  for (const k of OUTFIT_DIAL_KEYS) if (outfit[k] !== undefined) o[k] = outfit[k];
  return o;
};

function renderCharacterSheetSvg(manifest, { control } = {}) {
  const { width, height } = manifest.viewBox;
  const ch = manifest.character;
  const outfits = ch.outfits.length ? ch.outfits : [{ id: 'default' }];
  const rowH = height / outfits.length;
  const colW = width / SHEET_VIEWS.length;
  const rows = outfits.map((outfit, r) => {
    const groundY = rowH * r + rowH * 0.82;
    const cells = SHEET_VIEWS.map((view, c) => {
      const cx = colW * c + colW / 2;
      const scale = (rowH * 0.62) / 200;
      const figure = ch.rig
        ? { id: `${outfit.id}-${view}`, x: cx, y: groundY - 104 * scale, scale, rig: { ...ch.rig, ...outfitDialsOf(outfit), view: SHEET_VIEW_CAMERA[view] } }
        : { id: `${outfit.id}-${view}`, x: cx, y: groundY - 104 * scale, scale, pose: 'stand' };
      return [
        `  ${figureSvg(figure)}`,
        ...(control ? [] : [
          `  <text x="${cx}" y="${rowH * r + 40}" fill="#94a3b8" font-size="22" text-anchor="middle" font-family="Inter, system-ui, sans-serif">${esc(view)}</text>`,
        ]),
      ].join('\n');
    });
    return [
      `  <line x1="0" y1="${groundY}" x2="${width}" y2="${groundY}" stroke="#94a3b8" stroke-width="3"${control ? '' : ' stroke-dasharray="12 12"'} opacity="0.6"/>`,
      ...(control ? [] : [
        `  <text x="24" y="${rowH * r + rowH - 24}" fill="#f8fafc" font-size="24" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">outfit: ${esc(outfit.id)}</text>`,
      ]),
      ...(r > 0 ? [`  <line x1="0" y1="${rowH * r}" x2="${width}" y2="${rowH * r}" stroke="#f8fafc" stroke-width="4" opacity="0.5"/>`] : []),
      ...cells,
    ].join('\n');
  });
  const body = [
    `  <rect width="${width}" height="${height}" fill="#0b0f19"/>`,
    ...(control ? [] : [
      `  <text x="24" y="46" fill="#f8fafc" font-size="30" font-family="Inter, system-ui, sans-serif" font-weight="800">${esc(manifest.title)}</text>`,
    ]),
    ...rows,
  ].join('\n');
  return svgDocument({ viewBox: `0 0 ${width} ${height}`, body });
}

export function renderScaffoldSvg(manifest, options = {}) {
  const normalized = normalizeImageOutcomesManifest(manifest);
  if (normalized.kind === KIND_IMAGE_OUTCOME) return renderImageOutcomeSvg(normalized, options);
  if (normalized.kind === KIND_SEQUENTIAL_ART) return renderSequentialArtSvg(normalized, options);
  if (normalized.kind === KIND_CHARACTER_SHEET) return renderCharacterSheetSvg(normalized, options);
  throw new Error(`unknown image-outcomes kind: ${normalized.kind}`);
}
