export const PANEL_DEPICTION_RECIPES = [
  'sunday-comic',
  'manga-high-eye-control',
  'american-comic-widescreen-panels',
  'natgeo',
  'monoculous',
  'cover-mode',
  'time-magazine-cover',
];

export function lowerDepictionLayout(depiction, viewBox = {}) {
  const normalized = normalizeDepiction(depiction, viewBox);
  return {
    depiction: normalized,
    marks: [
      ...pagePaperMarks(normalized),
      ...coverFurnitureMarks(normalized),
      ...panelBackgroundMarks(normalized),
      ...panelFrameMarks(normalized),
      ...letteringMarks(normalized),
    ],
  };
}

export function applyDepictionOverlay(manifest, options = {}) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest) || !manifest.depiction) {
    return manifest;
  }
  const sourceDisplay = manifest.depiction.display && typeof manifest.depiction.display === 'object' && !Array.isArray(manifest.depiction.display)
    ? manifest.depiction.display
    : {};
  const overlayDepiction = {
    ...manifest.depiction,
    display: {
      ...sourceDisplay,
      overlay: options.forceOverlay === false ? sourceDisplay.overlay : sourceDisplay.overlay ?? true,
    },
  };
  const { depiction, marks } = lowerDepictionLayout(overlayDepiction, manifest.viewBox || {});
  return {
    ...manifest,
    depiction,
    marks: [
      ...(Array.isArray(manifest.marks) ? manifest.marks : []),
      ...marks.map((mark) => ({
        ...mark,
        depictionOverlay: true,
      })),
    ],
  };
}

export function normalizeDepiction(depiction, viewBox = {}) {
  if (!depiction || typeof depiction !== 'object' || Array.isArray(depiction)) {
    return null;
  }
  const display = depiction.display && typeof depiction.display === 'object' && !Array.isArray(depiction.display)
    ? depiction.display
    : {};
  const requestedKind = depiction.recipe || depiction.panelRecipe || display.recipe || display.kind;
  const preset = panelDepictionPreset(requestedKind);
  const presetDisplay = preset.display || {};
  const mergedDisplay = {
    ...presetDisplay,
    ...display,
    kind: normalizePanelDepictionKind(preset.recipe ? presetDisplay.kind : display.kind || requestedKind || presetDisplay.kind),
  };
  const presetBlocking = preset.panelBlocking || {};
  const panelCount = Math.max(1, Math.floor(display.panelCount || depiction.panels?.length || 1));
  const resolvedPanelCount = Math.max(1, Math.floor(mergedDisplay.panelCount || depiction.panels?.length || panelCount));
  const panels = normalizePanels(depiction.panels, resolvedPanelCount, preset.panels);
  const bounds = layoutPanelBounds(mergedDisplay, viewBox, resolvedPanelCount);
  return {
    ...depiction,
    paradigm: 'depiction',
    recipe: preset.recipe || depiction.recipe || depiction.panelRecipe,
    panelRecipe: preset.recipe || depiction.panelRecipe || depiction.recipe,
    display: {
      ...mergedDisplay,
      comicPanel: Boolean(mergedDisplay.comicPanel || isComicPanelDisplay(mergedDisplay.kind)),
      panelCount: resolvedPanelCount,
      borderWidth: finiteOr(mergedDisplay.borderWidth, 1),
      canvas: {
        width: Math.max(finiteOr(viewBox.width, 720), 1),
        height: Math.max(finiteOr(viewBox.height, 520), 1),
      },
    },
    panelBlocking: {
      ...presetBlocking,
      ...(depiction.panelBlocking || {}),
    },
    panels: panels.map((panel, index) => ({
      ...panel,
      bounds: resolvePanelBounds(panel, bounds[index]),
      comicPanel: panel.comicPanel !== undefined ? Boolean(panel.comicPanel) : Boolean(mergedDisplay.comicPanel || isComicPanelDisplay(mergedDisplay.kind)),
      foregroundReality: panel.foregroundReality || mergedDisplay.foregroundReality || (isComicPanelDisplay(mergedDisplay.kind) ? 'form-lighting' : undefined),
    })),
    lettering: normalizeLettering(depiction.lettering),
  };
}

function normalizeLettering(lettering) {
  if (!lettering || typeof lettering !== 'object' || Array.isArray(lettering)) {
    return { paradigm: 'lettering', carriers: [] };
  }
  const carriers = Array.isArray(lettering.carriers) ? lettering.carriers : [];
  return {
    ...lettering,
    paradigm: 'lettering',
    carriers: carriers
      .filter((carrier) => carrier && typeof carrier === 'object' && !Array.isArray(carrier))
      .map((carrier, index) => ({
        id: carrier.id || `lettering-${index + 1}`,
        kind: carrier.kind || 'speech',
        textCase: carrier.textCase || 'regular',
        effect: carrier.effect || 'regular',
        ...carrier,
      })),
  };
}

export function normalizePanelDepictionKind(kind) {
  const value = String(kind || '').trim().toLowerCase().replace(/[_\s]+/g, '-');
  const aliases = {
    'sunday': 'sunday-comic',
    'sunday-comic': 'sunday-comic',
    'manga': 'manga-high-eye-control',
    'manga-high-eye': 'manga-high-eye-control',
    'manga-high-eye-control': 'manga-high-eye-control',
    'american-comic': 'american-comic-widescreen-panels',
    'american-widescreen': 'american-comic-widescreen-panels',
    'american-comic-widescreen': 'american-comic-widescreen-panels',
    'american-comic-widescreen-panels': 'american-comic-widescreen-panels',
    'natgeo': 'natgeo',
    'national-geographic': 'natgeo',
    'monocle': 'monoculous',
    'monoculous': 'monoculous',
    'cover': 'cover-mode',
    'cover-mode': 'cover-mode',
    'magazine-cover': 'cover-mode',
    'comic-cover': 'cover-mode',
    'time': 'time-magazine-cover',
    'time-cover': 'time-magazine-cover',
    'time-magazine': 'time-magazine-cover',
    'time-magazine-cover': 'time-magazine-cover',
    'news-magazine-cover': 'time-magazine-cover',
  };
  return aliases[value] || value;
}

function panelDepictionPreset(kind) {
  const normalized = normalizePanelDepictionKind(kind);
  const presets = {
    'sunday-comic': {
      recipe: 'sunday-comic',
      display: { kind: 'sunday-comic', panelCount: 6, borderWidth: 2, pad: 22, gap: 10, paperFill: '#ffffff', panelFill: '#ffffff', borderColor: '#181512' },
      panelBlocking: { paradigm: 'sunday-comic', eyeLine: 'large opening beat, three middle beats, wide punchline footer' },
      panels: ['opening-scene', 'beat-1', 'beat-2', 'beat-3', 'beat-4', 'punchline'],
    },
    'manga-high-eye-control': {
      recipe: 'manga-high-eye-control',
      display: { kind: 'manga-high-eye-control', panelCount: 5, borderWidth: 1, pad: 18, gap: 7, paperFill: '#ffffff', panelFill: '#ffffff', borderColor: '#111111' },
      panelBlocking: { paradigm: 'manga-high-eye-control', eyeLine: 'high vertical read with narrow reaction cuts and a large emotional landing panel' },
      panels: ['high-establishing', 'reaction-cut', 'detail-cut', 'speed-cut', 'emotional-landing'],
    },
    'american-comic-widescreen-panels': {
      recipe: 'american-comic-widescreen-panels',
      display: { kind: 'american-comic-widescreen-panels', panelCount: 3, borderWidth: 2, pad: 24, gap: 12, paperFill: '#ffffff', panelFill: '#ffffff', borderColor: '#111827' },
      panelBlocking: { paradigm: 'american-comic-widescreen-panels', eyeLine: 'three cinematic horizontal beats stacked top to bottom' },
      panels: ['wide-establishing', 'wide-action', 'wide-resolution'],
    },
    natgeo: {
      recipe: 'natgeo',
      display: { kind: 'natgeo', panelCount: 3, borderWidth: 1, pad: 24, gap: 12, panelFill: '#f6f1df', borderColor: '#f7c948' },
      panelBlocking: { paradigm: 'natgeo', eyeLine: 'dominant documentary image, supporting map/detail, caption block' },
      panels: ['documentary-hero', 'map-or-detail', 'caption-field'],
    },
    monoculous: {
      recipe: 'monoculous',
      display: { kind: 'monoculous', panelCount: 4, borderWidth: 1, pad: 32, gap: 14, panelFill: '#f7f2e8', borderColor: '#262626' },
      panelBlocking: { paradigm: 'monoculous', eyeLine: 'capital-D editorial asymmetry: restrained feature panel, object vignette, caption rail, index tile' },
      panels: ['feature', 'vignette', 'caption-rail', 'index-tile'],
    },
    'cover-mode': {
      recipe: 'cover-mode',
      display: { kind: 'cover-mode', panelCount: 3, borderWidth: 0, pad: 18, gap: 8, panelFill: 'transparent', borderColor: 'transparent', overlay: true, transparentPanels: true },
      panelBlocking: { paradigm: 'cover-mode', eyeLine: 'masthead first, central hero image, cover-line deck' },
      panels: ['masthead-zone', 'cover-hero', 'cover-lines'],
    },
    'time-magazine-cover': {
      recipe: 'time-magazine-cover',
      display: {
        kind: 'time-magazine-cover',
        panelCount: 3,
        borderWidth: 0,
        pad: 22,
        gap: 8,
        panelFill: 'transparent',
        borderColor: 'transparent',
        overlay: true,
        transparentPanels: true,
        draggablePanels: true,
        selectionRole: 'cover-layout-zone',
        masthead: 'TIME',
        issueLabel: 'SPECIAL REPORT',
        coverLines: ['THE NEW MACHINE AGE', 'POWER, WORK, AND TRUST', 'WHAT COMES NEXT'],
        coverAccent: '#b11226',
      },
      panelBlocking: { paradigm: 'time-magazine-cover', eyeLine: 'red frame, masthead authority, central portrait, lower cover-line deck' },
      panels: [
        { id: 'masthead-zone', concern: 'masthead-lettering', constellation: 'does-not-apply' },
        { id: 'cover-hero', concern: 'central-portrait-scene', constellation: 'applies' },
        { id: 'cover-lines', concern: 'cover-line-lettering', constellation: 'does-not-apply' },
      ],
    },
  };
  return presets[normalized] || {};
}

function normalizePanels(panels, panelCount, presetPanelIds = []) {
  const source = Array.isArray(panels) ? panels : [];
  return Array.from({ length: panelCount }, (_, index) => {
    const panel = source[index] && typeof source[index] === 'object' && !Array.isArray(source[index])
      ? source[index]
      : {};
    const preset = presetPanelIds[index];
    const presetPanel = preset && typeof preset === 'object' && !Array.isArray(preset) ? preset : {};
    const presetId = typeof preset === 'string' ? preset : presetPanel.id;
    return {
      id: panel.id || presetId || `panel-${index + 1}`,
      concern: panel.concern || presetPanel.concern || (index === 0 ? 'scene' : 'detail'),
      constellation: panel.constellation || presetPanel.constellation || (index === 0 ? 'applies' : 'does-not-apply'),
      ...presetPanel,
      ...panel,
    };
  });
}

function resolvePanelBounds(panel, fallback) {
  const source = panel.bounds && typeof panel.bounds === 'object' && !Array.isArray(panel.bounds)
    ? panel.bounds
    : panel;
  const x = finiteOr(source.x, fallback.x);
  const y = finiteOr(source.y, fallback.y);
  const w = finiteOr(source.w ?? source.width, fallback.w);
  const h = finiteOr(source.h ?? source.height, fallback.h);
  return roundBox({ x, y, w, h });
}

// Exported: the sequential-art comic kind (image-outcomes family) reuses
// this exact panel-blocking math for its pageRecipe auto-layout, so the
// deterministic and AI-painted comic paths share one source of truth for
// how a named paradigm carves a page.
export function layoutPanelBounds(display, viewBox, panelCount) {
  const width = Math.max(finiteOr(viewBox.width, 720), 1);
  const height = Math.max(finiteOr(viewBox.height, 520), 1);
  const pad = finiteOr(display.pad, 24);
  const gap = finiteOr(display.gap, 8);
  const kind = String(display.kind || '').toLowerCase();
  if (kind === 'sunday-comic') return sundayComicBounds({ width, height, pad, gap, panelCount });
  if (kind === 'manga-high-eye-control') return mangaHighEyeBounds({ width, height, pad, gap, panelCount });
  if (kind === 'american-comic-widescreen-panels') return widescreenBounds({ width, height, pad, gap, panelCount });
  if (kind === 'natgeo') return natgeoBounds({ width, height, pad, gap, panelCount });
  if (kind === 'monoculous') return monoculousBounds({ width, height, pad, gap, panelCount });
  if (kind === 'cover-mode') return coverModeBounds({ width, height, pad, gap, panelCount });
  if (kind === 'time-magazine-cover') return coverModeBounds({ width, height, pad, gap, panelCount });
  if (kind.includes('comic')) return comicPageBounds({ width, height, pad, gap, panelCount });
  if (kind.includes('strip')) return stripBounds({ width, height, pad, gap, panelCount });
  if (kind.includes('single')) return [{ x: pad, y: pad, w: width - pad * 2, h: height - pad * 2 }];
  return equalGridBounds({ width, height, pad, gap, panelCount });
}

function sundayComicBounds({ width, height, pad, gap, panelCount }) {
  if (panelCount !== 6) return comicPageBounds({ width, height, pad, gap, panelCount });
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const topH = Math.round(innerH * 0.42);
  const middleH = Math.round(innerH * 0.26);
  const bottomH = innerH - topH - middleH - gap * 2;
  const thirdW = (innerW - gap * 2) / 3;
  const halfW = (innerW - gap) / 2;
  return [
    { x: pad, y: pad, w: halfW, h: topH },
    { x: pad + halfW + gap, y: pad, w: halfW, h: topH },
    { x: pad, y: pad + topH + gap, w: thirdW, h: middleH },
    { x: pad + thirdW + gap, y: pad + topH + gap, w: thirdW, h: middleH },
    { x: pad + (thirdW + gap) * 2, y: pad + topH + gap, w: thirdW, h: middleH },
    { x: pad, y: pad + topH + middleH + gap * 2, w: innerW, h: bottomH },
  ].map(roundBox);
}

function mangaHighEyeBounds({ width, height, pad, gap, panelCount }) {
  if (panelCount !== 5) return comicPageBounds({ width, height, pad, gap, panelCount });
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const leftW = Math.round(innerW * 0.38);
  const rightW = innerW - leftW - gap;
  const topH = Math.round(innerH * 0.2);
  const cutH = Math.round(innerH * 0.16);
  const landH = innerH - topH - cutH * 2 - gap * 3;
  return [
    { x: pad, y: pad, w: innerW, h: topH },
    { x: pad, y: pad + topH + gap, w: leftW, h: cutH },
    { x: pad, y: pad + topH + cutH + gap * 2, w: leftW, h: cutH },
    { x: pad + leftW + gap, y: pad + topH + gap, w: rightW, h: cutH * 2 + gap },
    { x: pad, y: pad + topH + cutH * 2 + gap * 3, w: innerW, h: landH },
  ].map(roundBox);
}

function widescreenBounds({ width, height, pad, gap, panelCount }) {
  const innerW = width - pad * 2;
  const cellH = (height - pad * 2 - gap * (panelCount - 1)) / panelCount;
  return Array.from({ length: panelCount }, (_, index) => roundBox({
    x: pad,
    y: pad + index * (cellH + gap),
    w: innerW,
    h: cellH,
  }));
}

function natgeoBounds({ width, height, pad, gap, panelCount }) {
  if (panelCount !== 3) return comicPageBounds({ width, height, pad, gap, panelCount });
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const sideW = Math.round(innerW * 0.28);
  const heroW = innerW - sideW - gap;
  const topSideH = Math.round(innerH * 0.52);
  return [
    { x: pad, y: pad, w: heroW, h: innerH },
    { x: pad + heroW + gap, y: pad, w: sideW, h: topSideH },
    { x: pad + heroW + gap, y: pad + topSideH + gap, w: sideW, h: innerH - topSideH - gap },
  ].map(roundBox);
}

function monoculousBounds({ width, height, pad, gap, panelCount }) {
  if (panelCount !== 4) return comicPageBounds({ width, height, pad, gap, panelCount });
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const featureW = Math.round(innerW * 0.58);
  const rightW = innerW - featureW - gap;
  const railH = Math.round(innerH * 0.34);
  return [
    { x: pad, y: pad, w: featureW, h: innerH },
    { x: pad + featureW + gap, y: pad, w: rightW, h: Math.round(innerH * 0.38) },
    { x: pad + featureW + gap, y: pad + Math.round(innerH * 0.38) + gap, w: rightW, h: railH },
    { x: pad + featureW + gap, y: pad + Math.round(innerH * 0.38) + railH + gap * 2, w: rightW, h: innerH - Math.round(innerH * 0.38) - railH - gap * 2 },
  ].map(roundBox);
}

function coverModeBounds({ width, height, pad, gap, panelCount }) {
  if (panelCount !== 3) return comicPageBounds({ width, height, pad, gap, panelCount });
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const mastheadH = Math.round(innerH * 0.16);
  const coverLineH = Math.round(innerH * 0.2);
  return [
    { x: pad, y: pad, w: innerW, h: mastheadH },
    { x: pad, y: pad + mastheadH + gap, w: innerW, h: innerH - mastheadH - coverLineH - gap * 2 },
    { x: pad, y: height - pad - coverLineH, w: innerW, h: coverLineH },
  ].map(roundBox);
}

function equalGridBounds({ width, height, pad, gap, panelCount }) {
  const cols = Math.ceil(Math.sqrt(panelCount));
  const rows = Math.ceil(panelCount / cols);
  const cellW = (width - pad * 2 - gap * (cols - 1)) / cols;
  const cellH = (height - pad * 2 - gap * (rows - 1)) / rows;
  return Array.from({ length: panelCount }, (_, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    return {
      x: round(pad + col * (cellW + gap)),
      y: round(pad + row * (cellH + gap)),
      w: round(cellW),
      h: round(cellH),
    };
  });
}

function stripBounds({ width, height, pad, gap, panelCount }) {
  const cellW = (width - pad * 2 - gap * (panelCount - 1)) / panelCount;
  const h = height - pad * 2;
  return Array.from({ length: panelCount }, (_, index) => ({
    x: round(pad + index * (cellW + gap)),
    y: pad,
    w: round(cellW),
    h: round(h),
  }));
}

function comicPageBounds({ width, height, pad, gap, panelCount }) {
  if (panelCount <= 1) return [{ x: pad, y: pad, w: width - pad * 2, h: height - pad * 2 }];
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const topH = Math.round(innerH * 0.48);
  const midH = Math.round(innerH * 0.25);
  const bottomH = innerH - topH - midH - gap * 2;
  const halfW = (innerW - gap) / 2;

  const templates = [
    { x: pad, y: pad, w: innerW, h: topH },
    { x: pad, y: pad + topH + gap, w: halfW, h: midH },
    { x: pad + halfW + gap, y: pad + topH + gap, w: halfW, h: midH },
    { x: pad, y: pad + topH + midH + gap * 2, w: innerW, h: bottomH },
  ];
  if (panelCount >= 5) {
    templates[0] = { x: pad, y: pad, w: innerW * 0.62 - gap / 2, h: topH };
    templates.splice(1, 0, {
      x: pad + innerW * 0.62 + gap / 2,
      y: pad,
      w: innerW * 0.38 - gap / 2,
      h: topH,
    });
  }

  if (panelCount <= templates.length) {
    return templates.slice(0, panelCount).map(roundBox);
  }
  return equalGridBounds({ width, height, pad, gap, panelCount });
}

function coverFurnitureMarks(depiction) {
  if (!depiction || depiction.display?.kind !== 'time-magazine-cover') return [];
  const display = depiction.display || {};
  const canvas = display.canvas || {};
  const width = finiteOr(canvas.width, 720);
  const height = finiteOr(canvas.height, 520);
  const accent = display.coverAccent || '#b11226';
  const mastheadPanel = panelById(depiction, 'masthead-zone') || depiction.panels?.[0];
  const coverLinesPanel = panelById(depiction, 'cover-lines') || depiction.panels?.[2];
  const masthead = String(display.masthead || 'TIME');
  const issueLabel = String(display.issueLabel || 'SPECIAL REPORT');
  const coverLines = Array.isArray(display.coverLines) && display.coverLines.length
    ? display.coverLines
    : ['THE NEW MACHINE AGE', 'POWER, WORK, AND TRUST', 'WHAT COMES NEXT'];

  const marks = [];
  if (!isDepictionOverlay(depiction)) {
    marks.push({
      kind: 'rect',
      role: 'time-cover-paper',
      x: 0,
      y: 0,
      w: width,
      h: height,
      fill: display.paperFill || '#f7f3e8',
      stroke: 'none',
      z: 0,
      depictionFurniture: true,
    });
  }
  marks.push({
    kind: 'rect',
    role: 'time-cover-red-frame',
    x: 10,
    y: 10,
    w: width - 20,
    h: height - 20,
    fill: 'transparent',
    stroke: accent,
    strokeWidth: finiteOr(display.frameWidth, 10),
    z: 80,
    depictionFurniture: true,
  });

  if (mastheadPanel?.bounds) {
    marks.push({
      kind: 'text',
      role: 'time-cover-masthead',
      x: round(mastheadPanel.bounds.x + mastheadPanel.bounds.w / 2),
      y: round(mastheadPanel.bounds.y + mastheadPanel.bounds.h * 0.72),
      value: masthead,
      size: finiteOr(display.mastheadSize, mastheadPanel.bounds.h * 0.88),
      weight: '800',
      anchor: 'middle',
      color: accent,
      family: 'serif',
      z: 82,
      depictionFurniture: true,
    });
    marks.push({
      kind: 'text',
      role: 'time-cover-issue-label',
      x: round(mastheadPanel.bounds.x + mastheadPanel.bounds.w / 2),
      y: round(mastheadPanel.bounds.y + mastheadPanel.bounds.h + 18),
      value: issueLabel,
      size: finiteOr(display.issueLabelSize, 13),
      weight: '700',
      anchor: 'middle',
      color: display.issueLabelColor || '#111111',
      family: 'sans-serif',
      z: 83,
      depictionFurniture: true,
    });
  }

  if (coverLinesPanel?.bounds) {
    const size = finiteOr(display.coverLineSize, 18);
    const lineHeight = finiteOr(display.coverLineHeight, size * 1.45);
    coverLines.forEach((line, index) => {
      marks.push({
        kind: 'text',
        role: `time-cover-line-${index + 1}`,
        x: round(coverLinesPanel.bounds.x + coverLinesPanel.bounds.w / 2),
        y: round(coverLinesPanel.bounds.y + 24 + index * lineHeight),
        value: String(line).toUpperCase(),
        size,
        weight: index === 0 ? '800' : '650',
        anchor: 'middle',
        color: display.coverLineColor || '#111111',
        family: 'sans-serif',
        z: 84 + index * 0.01,
        depictionFurniture: true,
      });
    });
  }

  return marks;
}

function pagePaperMarks(depiction) {
  if (!depiction) return [];
  if (isDepictionOverlay(depiction)) return [];
  const display = depiction.display || {};
  if (!display.comicPanel && !display.paperFill) return [];
  const paperFill = display.paperFill || '#ffffff';
  if (paperFill === 'transparent' || paperFill === 'none') return [];
  const canvas = display.canvas || {};
  return [{
    kind: 'rect',
    role: 'depiction-page-paper',
    x: 0,
    y: 0,
    w: finiteOr(canvas.width, 720),
    h: finiteOr(canvas.height, 520),
    fill: paperFill,
    stroke: 'none',
    z: finiteOr(display.paperZ, 0),
    depictionFurniture: true,
    comicPanelPaper: Boolean(display.comicPanel),
  }];
}

function panelById(depiction, id) {
  return (depiction.panels || []).find((panel) => panel.id === id);
}

function panelBackgroundMarks(depiction) {
  if (!depiction) return [];
  if (isDepictionOverlay(depiction)) return [];
  const display = depiction.display || {};
  return (depiction.panels || []).flatMap((panel, index) => {
    if (panelIsTransparent(panel, display)) return [];
    const background = panelStaticBackground(panel, display);
    if (!background || background.mode === 'none') return [];
    const bounds = panel.bounds || {};
    const z = finiteOr(background.z, finiteOr(display.backgroundZ, 1 + index * 0.01));
    const base = {
      depictionPanelBackground: true,
      staticPanelBackground: true,
      panelId: panel.id,
      comicPanel: Boolean(panel.comicPanel || display.comicPanel),
      panelBackgroundMode: background.mode,
      foregroundReality: panel.foregroundReality || display.foregroundReality || 'form-lighting',
    };
    if (background.mode === 'static-speed-lines' || background.mode === 'speed-lines') {
      return speedLineBackgroundMarks(bounds, background, z, base);
    }
    if (background.mode === 'static-gradient' || background.mode === 'gradient') {
      return gradientBandBackgroundMarks(bounds, background, z, base);
    }
    return [{
      kind: 'rect',
      role: `depiction-panel-${panel.id || index + 1}-static-background`,
      ...bounds,
      fill: background.fill || background.color || 'transparent',
      stroke: 'none',
      opacity: finiteOr(background.opacity, 1),
      z,
      ...base,
    }];
  });
}

function panelFrameMarks(depiction) {
  if (!depiction) return [];
  const display = depiction.display || {};
  return (depiction.panels || []).map((panel, index) => {
    const style = panelFrameStyle(panel, display);
    const common = {
      role: `depiction-panel-${panel.id || index + 1}`,
      z: finiteOr(display.z, 2),
      depictionPanel: true,
      depictionPanelTransparent: panelIsTransparent(panel, display),
      draggable: panel.draggable !== undefined ? Boolean(panel.draggable) : Boolean(display.draggablePanels),
      movableElement: panel.movableElement !== undefined ? Boolean(panel.movableElement) : Boolean(display.movablePanels || display.draggablePanels),
      selectionRole: panel.selectionRole || display.selectionRole || 'panel-container',
      panelConcern: panel.concern,
      constellationApplies: panel.constellation === 'applies',
      comicPanel: Boolean(panel.comicPanel || display.comicPanel),
      panelBackgroundMode: panelStaticBackground(panel, display)?.mode || 'panel-fill',
      foregroundReality: panel.foregroundReality || display.foregroundReality,
    };
    const outlineNoise = panelOutlineNoise(panel, display);
    if (outlineNoise > 0 && !panelIsTransparent(panel, display)) {
      return {
        kind: 'polygon',
        points: noisyPanelOutlinePoints(panel.bounds, outlineNoise, panel.id || index),
        ...style,
        fill: style.fill || 'transparent',
        ...common,
        panelOutlineNoise: outlineNoise,
        polygonLock: {
          kind: 'panel-outline-polygon-lock',
          source: 'comicPanel',
          locked: true,
          seed: hashString(`panel-outline:${panel.id || index}:${outlineNoise}`),
          straightSegmentContract: true,
        },
      };
    }
    return {
      kind: 'rect',
      ...panel.bounds,
      ...style,
      ...common,
    };
  });
}

function panelFrameStyle(panel, display) {
  if (panelIsTransparent(panel, display)) {
    return {
      fill: 'transparent',
      stroke: 'transparent',
      strokeWidth: 0,
      opacity: finiteOr(panel.opacity, finiteOr(display.transparentPanelOpacity, 0)),
    };
  }
  return {
    fill: panel.fill || display.panelFill || 'transparent',
    stroke: panel.stroke || display.borderColor || '#d7dee8',
    strokeWidth: finiteOr(panel.strokeWidth, finiteOr(display.borderWidth, 1)),
    opacity: finiteOr(panel.opacity, finiteOr(display.opacity, 1)),
  };
}

function panelIsTransparent(panel, display) {
  return Boolean(
    panel.transparent ||
    panel.frameVisible === false ||
    panel.visible === false ||
    display.transparentPanels ||
    display.frameVisible === false ||
    display.panelFrame === 'transparent'
  );
}

function isDepictionOverlay(depiction) {
  const display = depiction?.display || {};
  return Boolean(
    depiction?.overlay ||
    display.overlay ||
    display.transparentOverlay ||
    display.backgroundMode === 'transparent-overlay' ||
    display.background === 'transparent-overlay'
  );
}

function isComicPanelDisplay(kind) {
  const value = String(kind || '').toLowerCase();
  return value.includes('comic') || value.includes('manga') || value.includes('strip');
}

function panelOutlineNoise(panel, display) {
  return Math.max(0, finiteOr(panel.outlineNoise, finiteOr(panel.panelOutlineNoise, finiteOr(display.outlineNoise, finiteOr(display.panelOutlineNoise, 0)))));
}

function panelStaticBackground(panel, display) {
  const source = panel.background && typeof panel.background === 'object' && !Array.isArray(panel.background)
    ? panel.background
    : display.panelBackground && typeof display.panelBackground === 'object' && !Array.isArray(display.panelBackground)
      ? display.panelBackground
      : null;
  const mode = panel.backgroundMode || panel.staticBackground || source?.mode || display.backgroundMode || display.staticBackground;
  if (!mode) return null;
  return {
    ...(source || {}),
    mode: String(mode).replace(/[_\s]+/g, '-'),
  };
}

function noisyPanelOutlinePoints(bounds, amount, seedKey) {
  const noise = Math.min(Math.max(amount, 0), 0.2);
  const inset = noise <= 1 ? Math.max(1, Math.min(bounds.w, bounds.h) * noise) : noise;
  const seed = hashString(`panel-outline:${seedKey}:${bounds.x}:${bounds.y}:${bounds.w}:${bounds.h}:${amount}`);
  const corners = [
    [bounds.x, bounds.y],
    [bounds.x + bounds.w, bounds.y],
    [bounds.x + bounds.w, bounds.y + bounds.h],
    [bounds.x, bounds.y + bounds.h],
  ];
  return corners.map(([x, y], index) => [
    round(x + seededRange(seed, index * 2, -inset, inset)),
    round(y + seededRange(seed, index * 2 + 1, -inset, inset)),
  ]);
}

function speedLineBackgroundMarks(bounds, background, z, common) {
  const count = Math.max(4, Math.floor(finiteOr(background.count, 9)));
  const color = background.stroke || background.color || '#111111';
  const opacity = finiteOr(background.opacity, 0.18);
  const cx = finiteOr(background.focus?.[0], bounds.x + bounds.w * 0.72);
  const cy = finiteOr(background.focus?.[1], bounds.y + bounds.h * 0.38);
  return Array.from({ length: count }, (_, index) => {
    const t = (index + 0.5) / count;
    const sideY = bounds.y + bounds.h * t;
    const endY = cy + (sideY - cy) * 0.22;
    return {
      kind: 'line',
      role: `depiction-panel-${common.panelId || 'unknown'}-speed-line-${index + 1}`,
      x1: round(bounds.x + bounds.w * 0.05),
      y1: round(sideY),
      x2: round(cx),
      y2: round(endY),
      stroke: color,
      strokeWidth: finiteOr(background.strokeWidth, 1),
      opacity,
      z: z + index * 0.001,
      ...common,
    };
  });
}

function gradientBandBackgroundMarks(bounds, background, z, common) {
  const count = Math.max(2, Math.floor(finiteOr(background.bands, 5)));
  const from = background.from || background.fill || '#ffffff';
  const to = background.to || background.color || '#dbeafe';
  return Array.from({ length: count }, (_, index) => {
    const h = bounds.h / count;
    return {
      kind: 'rect',
      role: `depiction-panel-${common.panelId || 'unknown'}-gradient-band-${index + 1}`,
      x: bounds.x,
      y: round(bounds.y + h * index),
      w: bounds.w,
      h: round(h + 0.5),
      fill: index % 2 === 0 ? from : to,
      stroke: 'none',
      opacity: finiteOr(background.opacity, 0.22 + index * 0.06),
      z: z + index * 0.001,
      ...common,
    };
  });
}

function letteringMarks(depiction) {
  if (!depiction?.lettering?.carriers?.length) return [];
  const panels = new Map((depiction.panels || []).map((panel) => [panel.id, panel]));
  return depiction.lettering.carriers.flatMap((carrier, index) => {
    const panel = panels.get(carrier.panel || carrier.panelId) || depiction.panels?.[0] || null;
    const box = carrierBox(carrier, panel, index);
    const z = finiteOr(carrier.z, 70 + index * 0.1);
    const shape = String(carrier.kind || 'speech').toLowerCase();
    const fill = carrier.fill || '#ffffff';
    const stroke = carrier.stroke || '#111111';
    const strokeWidth = finiteOr(carrier.strokeWidth, 2);
    const outlineNoise = letteringOutlineNoise(carrier, shape);
    const common = {
      depictionLettering: true,
      letteringCarrier: carrier.id,
      letteringKind: shape,
      panelId: panel?.id,
    };
    if (isBubbleLetterCarrier(shape, carrier)) {
      return handwrittenBubbleLetterMarks(carrier, box, z, common);
    }
    const textMarks = letteringTextMarks(carrier, box, z + 0.2, common);
    if (shape === 'narration') {
      return [
        { kind: 'rect', role: `lettering-${carrier.id}-box`, ...box, fill, stroke, strokeWidth, z, ...common },
        ...textMarks,
      ];
    }
    if (shape === 'shout') {
      return [
        {
          kind: 'polygon',
          role: `lettering-${carrier.id}-shout-box`,
          points: jaggedBoxPoints(box, outlineNoise, carrier.id),
          fill,
          stroke,
          strokeWidth,
          z,
          ...common,
          letteringOutlineNoise: outlineNoise,
        },
        ...tailMarks(carrier, box, z + 0.05, common, { fill, stroke, strokeWidth }),
        ...textMarks,
      ];
    }
    if (shape === 'thought') {
      return [
        {
          kind: 'polygon',
          role: `lettering-${carrier.id}-thought-body`,
          points: balloonEllipsePoints(box, outlineNoise, carrier.id),
          fill,
          stroke,
          strokeWidth,
          z,
          ...common,
          letteringOutlineNoise: outlineNoise,
          balloonShape: 'elliptical',
        },
        ...thoughtTailMarks(carrier, box, z + 0.05, common, { fill, stroke, strokeWidth }),
        ...textMarks,
      ];
    }
    return [
      {
        kind: 'polygon',
        role: `lettering-${carrier.id}-bubble`,
        points: balloonEllipsePoints(box, outlineNoise, carrier.id),
        fill,
        stroke,
        strokeWidth,
        z,
        ...common,
        letteringOutlineNoise: outlineNoise,
        balloonShape: 'elliptical',
      },
      ...tailMarks(carrier, box, z + 0.05, common, { fill, stroke, strokeWidth }),
      ...textMarks,
    ];
  });
}

function isBubbleLetterCarrier(shape, carrier) {
  const recipe = String(carrier.recipe || carrier.glyphRecipe || carrier.effect || '').toLowerCase();
  return /bubble[-_ ]?letters?/.test(shape) || /handwritten[-_ ]?bubble[-_ ]?letters?/.test(recipe);
}

function handwrittenBubbleLetterMarks(carrier, box, z, common) {
  const glyphs = Array.from(String(carrier.text || carrier.value || 'BUBBLE').replace(/\s+/g, ' ').trim() || 'BUBBLE');
  const nonSpaceGlyphs = glyphs.filter((glyph) => glyph !== ' ');
  const gap = finiteOr(carrier.gap, Math.max(4, box.w * 0.018));
  const spaceW = finiteOr(carrier.spaceWidth, Math.max(12, box.w * 0.08));
  const glyphW = finiteOr(carrier.glyphWidth, (box.w - gap * Math.max(nonSpaceGlyphs.length - 1, 0)) / Math.max(nonSpaceGlyphs.length, 1));
  const baselineTilt = finiteOr(carrier.baselineTilt, -0.05);
  const bodyFill = carrier.fill || '#ffffff';
  const bodyStroke = carrier.stroke || '#111111';
  const strokeWidth = finiteOr(carrier.strokeWidth, 2.5);
  const shadowFill = carrier.shadowFill || carrier.extrudeFill || '#f4c542';
  const extrude = carrier.effect === '3d' || carrier.effect === 'xmen-90s' || carrier.extrude;
  const depth = finiteOr(carrier.depth, carrier.effect === 'xmen-90s' ? 14 : 9);
  const marks = [];
  let cursor = box.x;
  let glyphIndex = 0;

  for (const glyph of glyphs) {
    if (glyph === ' ') {
      cursor += spaceW;
      continue;
    }
    const t = glyphIndex / Math.max(nonSpaceGlyphs.length - 1, 1);
    const variation = glyphVariation(carrier, glyph, glyphIndex);
    const glyphBox = {
      x: round(cursor),
      y: round(box.y + variation.y + baselineTilt * box.h * (t - 0.5)),
      w: round(glyphW * variation.w),
      h: round(box.h * variation.h),
    };
    const points = glyphPolygonPoints(glyph, glyphBox, variation);
    const lock = polygonLock({
      carrier,
      glyph,
      glyphIndex,
      variation,
      role: 'glyph-body',
    });
    if (extrude) {
      marks.push({
        kind: 'polygon',
        role: `lettering-${carrier.id}-glyph-${glyphIndex + 1}-extrude`,
        points: points.map(([x, y]) => [round(x + depth), round(y + depth)]),
        fill: shadowFill,
        stroke: bodyStroke,
        strokeWidth,
        z: z - 0.08,
        ...common,
        letteringBubbleLetter: true,
        glyph,
        glyphIndex,
        glyphEffect: '3d-extrude',
        polygonLock: { ...lock, role: 'glyph-extrude', offset: [depth, depth] },
      });
    }
    marks.push({
      kind: 'polygon',
      role: `lettering-${carrier.id}-glyph-${glyphIndex + 1}`,
      points,
      fill: bodyFill,
      stroke: bodyStroke,
      strokeWidth,
      z: z + glyphIndex * 0.01,
      ...common,
      letteringBubbleLetter: true,
      glyph,
      glyphIndex,
      glyphLanguage: carrier.language || 'und',
      glyphEffect: carrier.effect || 'handwritten-bubble',
      angleCurvatureProfile: variation.profile,
      polygonLock: lock,
    });
    cursor += glyphBox.w + gap;
    glyphIndex += 1;
  }
  return marks;
}

function glyphVariation(carrier, glyph, glyphIndex) {
  const seed = hashString(`${carrier.id || 'bubble'}:${glyph}:${glyphIndex}:${carrier.text || carrier.value || ''}`);
  const wobble = finiteOr(carrier.wobble, 0.08);
  const angleProfile = angleCurvatureProfile(carrier.style || carrier.effect || 'handwritten');
  return {
    seed,
    w: round(1 + seededRange(seed, 0, -wobble, wobble)),
    h: round(1 + seededRange(seed, 1, -wobble * 0.6, wobble * 0.6)),
    y: round(seededRange(seed, 2, -6, 6)),
    slant: round(seededRange(seed, 3, angleProfile.slant[0], angleProfile.slant[1])),
    corner: round(seededRange(seed, 4, angleProfile.corner[0], angleProfile.corner[1])),
    waist: round(seededRange(seed, 5, angleProfile.waist[0], angleProfile.waist[1])),
    profile: angleProfile.name,
  };
}

function angleCurvatureProfile(style) {
  const key = String(style || '').toLowerCase();
  if (key.includes('xmen') || key.includes('3d')) {
    return { name: 'comic-hero-3d-straight', slant: [-0.16, -0.04], corner: [0.1, 0.18], waist: [0.4, 0.52] };
  }
  if (key.includes('graffiti')) {
    return { name: 'wide-graffiti-bubble-straight', slant: [-0.12, 0.12], corner: [0.16, 0.28], waist: [0.36, 0.58] };
  }
  return { name: 'handwritten-bubble-straight', slant: [-0.08, 0.08], corner: [0.12, 0.22], waist: [0.42, 0.56] };
}

function glyphPolygonPoints(glyph, box, variation) {
  const upper = glyph.toLocaleUpperCase();
  const template = GLYPH_TEMPLATES[upper] || GLYPH_TEMPLATES.default;
  return template(box, variation).map(([x, y]) => [round(x), round(y)]);
}

const GLYPH_TEMPLATES = {
  X: (b, v) => {
    const c = v.corner;
    const waist = v.waist;
    return pts(b, v, [
      [c, 0], [0.42, 0], [0.52, 0.34], [0.68, 0], [1 - c, 0],
      [0.68, waist], [1, 1], [0.62, 1], [0.5, 0.66], [0.32, 1],
      [0, 1], [0.32, waist],
    ]);
  },
  M: (b, v) => {
    const c = v.corner;
    return pts(b, v, [
      [0, 1], [c, 0], [0.34, 0], [0.5, 0.42], [0.66, 0], [1 - c, 0],
      [1, 1], [0.72, 1], [0.68, 0.42], [0.56, 0.78], [0.44, 0.78], [0.32, 0.42], [0.28, 1],
    ]);
  },
  E: (b, v) => {
    const c = v.corner;
    return pts(b, v, [
      [0, 0], [1, 0], [0.94, 0.22], [0.3, 0.2], [0.28, 0.4], [0.82, 0.4],
      [0.78, 0.6], [0.28, 0.58], [0.3, 0.8], [0.98, 0.8], [1, 1], [c, 1], [0, 0.9],
    ]);
  },
  N: (b, v) => {
    const c = v.corner;
    return pts(b, v, [
      [0, 1], [0, 0], [0.26, 0], [0.7, 0.58], [0.68, 0], [1 - c, 0],
      [1, 1], [0.74, 1], [0.3, 0.42], [0.32, 1],
    ]);
  },
  O: (b, v) => {
    const c = v.corner;
    return pts(b, v, [
      [0.18, 0], [0.82, 0], [1, 0.2], [1, 0.8], [0.82, 1], [0.18, 1],
      [0, 0.8], [0, 0.2], [0.18, 0], [0.34, c], [0.26, 0.28],
      [0.26, 0.72], [0.38, 0.82], [0.66, 0.82], [0.76, 0.68], [0.76, 0.32], [0.66, 0.18], [0.34, c],
    ]);
  },
  default: (b, v) => {
    const c = v.corner;
    return pts(b, v, [
      [c, 0], [1 - c, 0], [1, c], [0.94, 1 - c], [1 - c, 1], [c, 1], [0, 1 - c], [0.06, c],
    ]);
  },
};

function pts(box, variation, points) {
  const slant = variation.slant || 0;
  return points.map(([px, py]) => [
    box.x + box.w * px + box.w * slant * (1 - py),
    box.y + box.h * py,
  ]);
}

function polygonLock({ carrier, glyph, glyphIndex, variation, role }) {
  return {
    kind: 'lettering-glyph-polygon-lock',
    role,
    locked: true,
    source: 'handwrittenBubbleLetters',
    carrierId: carrier.id,
    glyph,
    glyphIndex,
    language: carrier.language || 'und',
    seed: variation.seed,
    angleCurvatureProfile: variation.profile,
    straightSegmentContract: true,
  };
}

function carrierBox(carrier, panel, index) {
  if (carrier.box && typeof carrier.box === 'object') {
    return roundBox({
      x: finiteOr(carrier.box.x, 40),
      y: finiteOr(carrier.box.y, 40),
      w: finiteOr(carrier.box.w ?? carrier.box.width, 180),
      h: finiteOr(carrier.box.h ?? carrier.box.height, 72),
    });
  }
  const bounds = panel?.bounds || { x: 24, y: 24, w: 672, h: 472 };
  const w = finiteOr(carrier.w ?? carrier.width, Math.min(220, bounds.w * 0.42));
  const h = finiteOr(carrier.h ?? carrier.height, 72);
  const x = finiteOr(carrier.x, bounds.x + 18 + (index % 2) * Math.max(0, bounds.w - w - 36));
  const y = finiteOr(carrier.y, bounds.y + 18 + Math.floor(index / 2) * (h + 12));
  return roundBox({ x, y, w, h });
}

function tailMarks(carrier, box, z, common, style) {
  const mouth = mouthAnchorPoint(carrier);
  if (!mouth) return [];
  const from = nearestPointOnEllipse(box, mouth);
  const dx = mouth[0] - from[0];
  const dy = mouth[1] - from[1];
  const len = Math.max(Math.hypot(dx, dy), 1);
  const baseWidth = finiteOr(carrier.tailWidth, Math.max(5, Math.min(9, Math.min(box.w, box.h) * 0.09)));
  const curve = finiteOr(carrier.tailCurve, 0.18);
  const nx = (-dy / len) * baseWidth;
  const ny = (dx / len) * baseWidth;
  const bend = seededRange(hashString(`${carrier.id || common.letteringCarrier}:tail`), 1, -baseWidth, baseWidth);
  const midA = 0.45;
  const midB = 0.72;
  return [{
    kind: 'polygon',
    role: `lettering-${common.letteringCarrier}-tail`,
    points: [
      [round(from[0] + nx), round(from[1] + ny)],
      [round(from[0] + dx * midA - nx * curve + bend), round(from[1] + dy * midA - ny * curve)],
      [round(mouth[0]), round(mouth[1])],
      [round(from[0] + dx * midB + nx * curve - bend * 0.35), round(from[1] + dy * midB + ny * curve)],
      [round(from[0] - nx), round(from[1] - ny)],
    ],
    fill: style.fill,
    stroke: style.stroke,
    strokeWidth: style.strokeWidth,
    z,
    ...common,
    letteringTail: true,
    tailCurve: true,
    tailTarget: 'mouth',
    shortestToMouth: true,
    mouthAnchor: [round(mouth[0]), round(mouth[1])],
  }];
}

function thoughtTailMarks(carrier, box, z, common, style) {
  const tailTo = mouthAnchorPoint(carrier);
  if (!tailTo) return [];
  const start = [box.x + box.w / 2, box.y + box.h / 2];
  return [0.42, 0.66, 0.86].map((t, index) => ({
    kind: 'circle',
    role: `lettering-${common.letteringCarrier}-thought-tail-${index + 1}`,
    cx: round(start[0] + (tailTo[0] - start[0]) * t),
    cy: round(start[1] + (tailTo[1] - start[1]) * t),
    r: round(10 - index * 2),
    fill: style.fill,
    stroke: style.stroke,
    strokeWidth: style.strokeWidth,
    z: z + index * 0.01,
    ...common,
    letteringTail: true,
    tailTarget: 'mouth',
    shortestToMouth: true,
  }));
}

function letteringTextMarks(carrier, box, z, common) {
  const lines = carrierLines(carrier);
  const size = finiteOr(carrier.size, carrier.effect === 'shout' ? 16 : 14);
  const lineHeight = finiteOr(carrier.lineHeight, size * 1.25);
  const color = carrier.color || '#111111';
  const family = carrier.family || (carrier.effect === 'mechanical' ? 'monospace' : 'sans-serif');
  const startY = box.y + box.h / 2 - ((lines.length - 1) * lineHeight) / 2 + size * 0.35;
  return lines.map((line, index) => ({
    kind: 'text',
    role: `lettering-${carrier.id}-text-${index + 1}`,
    x: round(box.x + box.w / 2),
    y: round(startY + index * lineHeight),
    value: line,
    size,
    weight: carrier.effect === 'shout' || carrier.textCase === 'caps' ? '700' : carrier.weight,
    anchor: 'middle',
    color,
    family,
    z: z + index * 0.01,
    ...common,
    letteringText: true,
    letteringEffect: carrier.effect || 'regular',
  }));
}

function carrierLines(carrier) {
  const source = Array.isArray(carrier.lines) && carrier.lines.length
    ? carrier.lines
    : wrapText(String(carrier.text || carrier.value || ''), finiteOr(carrier.maxCharsPerLine, 18));
  const lines = source.map((line) => applyTextCase(String(line), carrier.textCase)).filter(Boolean);
  return lines.length ? lines : ['...'];
}

function wrapText(value, maxChars) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function applyTextCase(value, textCase) {
  if (textCase === 'caps') return value.toUpperCase();
  if (textCase === 'lower') return value.toLowerCase();
  return value;
}

function mouthAnchorPoint(carrier) {
  const mouth = validPoint(carrier.mouthAnchor || carrier.mouth);
  if (mouth) return mouth;
  const head = validPoint(carrier.headAnchor);
  if (head) {
    const offset = validPoint(carrier.mouthOffset) || [0, finiteOr(carrier.mouthYOffset, 12)];
    return [head[0] + offset[0], head[1] + offset[1]];
  }
  return validPoint(carrier.tailTo || carrier.pointsTo);
}

function nearestPointOnEllipse(box, target) {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const rx = Math.max(box.w / 2, 1);
  const ry = Math.max(box.h / 2, 1);
  const dx = target[0] - cx;
  const dy = target[1] - cy;
  const scale = 1 / Math.max(Math.hypot(dx / rx, dy / ry), 1e-6);
  return [cx + dx * scale, cy + dy * scale];
}

function letteringOutlineNoise(carrier, shape) {
  const fallback = shape === 'narration' ? 0 : shape === 'shout' ? 0.01 : 0.018;
  return Math.max(0, finiteOr(carrier.outlineNoise, finiteOr(carrier.lineNoise, fallback)));
}

function balloonEllipsePoints(box, noise, seedKey) {
  const count = 20;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const rx = box.w / 2;
  const ry = box.h / 2;
  const seed = hashString(`lettering-balloon:${seedKey}:${box.x}:${box.y}:${box.w}:${box.h}`);
  const amount = Math.min(Math.max(noise, 0), 0.12) * Math.min(box.w, box.h);
  return Array.from({ length: count }, (_, index) => {
    const theta = (Math.PI * 2 * index) / count;
    const jitter = seededRange(seed, index, -amount, amount);
    return [
      round(cx + Math.cos(theta) * (rx + jitter)),
      round(cy + Math.sin(theta) * (ry + jitter * 0.65)),
    ];
  });
}

function jaggedBoxPoints(box, noise = 0, seedKey = 'shout') {
  const { x, y, w, h } = box;
  const points = [
    [x + w * 0.08, y + h * 0.08],
    [x + w * 0.26, y],
    [x + w * 0.42, y + h * 0.08],
    [x + w * 0.62, y],
    [x + w * 0.78, y + h * 0.1],
    [x + w, y + h * 0.22],
    [x + w * 0.9, y + h * 0.48],
    [x + w, y + h * 0.76],
    [x + w * 0.76, y + h],
    [x + w * 0.58, y + h * 0.9],
    [x + w * 0.35, y + h],
    [x + w * 0.2, y + h * 0.9],
    [x, y + h * 0.74],
    [x + w * 0.08, y + h * 0.48],
    [x, y + h * 0.22],
  ];
  return noisyPoints(points, noise, seedKey).map(([px, py]) => [round(px), round(py)]);
}

function noisyPoints(points, noise, seedKey) {
  const amount = Math.min(Math.max(noise, 0), 0.12) * 80;
  if (amount === 0) return points;
  const seed = hashString(`noisy-points:${seedKey}:${points.length}`);
  return points.map(([x, y], index) => [
    x + seededRange(seed, index * 2, -amount, amount),
    y + seededRange(seed, index * 2 + 1, -amount, amount),
  ]);
}

function validPoint(point) {
  return Array.isArray(point) && point.length === 2 && Number.isFinite(point[0]) && Number.isFinite(point[1])
    ? point
    : null;
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < String(value).length; i += 1) {
    hash ^= String(value).charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRange(seed, salt, min, max) {
  const next = hashString(`${seed}:${salt}`);
  const t = (next % 10000) / 9999;
  return min + (max - min) * t;
}

function finiteOr(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function roundBox(box) {
  return {
    x: round(box.x),
    y: round(box.y),
    w: round(box.w),
    h: round(box.h),
  };
}

function round(value) {
  return Math.round(value * 100) / 100;
}
