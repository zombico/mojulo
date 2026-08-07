/**
 * Deterministic sketch-manifest derivation — the "posterity" auto-mint seam.
 *
 * Pure functions: a plan or research book in, a sketch manifest out (the same
 * shape validateSketchManifest accepts and /sketches/<ref> renders). No DB, no
 * LLM — the layout is computed from structure alone, so a plan's compiled
 * manifest and a research book's items always produce the same diagram.
 *
 * Coupling stays one-way: plan-mode / research-mode import this + the sketch
 * persister; sketches never import plan or research. Mirrors the research→plan
 * asymmetry already in the codebase.
 */

function truncate(str, max) {
  if (typeof str !== 'string') return undefined;
  const s = str.trim();
  if (!s) return undefined;
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function firstLine(str) {
  if (typeof str !== 'string') return undefined;
  const line = str.split('\n').map((l) => l.trim()).find((l) => l.length > 0);
  return line;
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Plan → left→right pipeline. The goal is an `input` station; each compiled
 * manifest call is an `mcp_tool` station, chained in order. Drawn from the
 * manifest, so it always reflects the spike that compiled.
 */
export function planToSketchManifest(plan) {
  const calls = Array.isArray(plan?.manifest) ? plan.manifest : [];
  const W = 210;
  const H = 96;
  const GAP = 64;
  const PADX = 40;
  const TOP = 48;

  const stations = [
    {
      id: 'goal',
      kind: 'input',
      label: 'Goal',
      ...(truncate(firstLine(plan?.goalMd) || plan?.title, 64)
        ? { sublabel: truncate(firstLine(plan?.goalMd) || plan?.title, 64) }
        : {}),
      x: PADX,
      y: TOP,
      w: W,
      h: H,
    },
  ];
  const edges = [];
  let prev = 'goal';
  calls.forEach((call, i) => {
    const id = `s${i}`;
    const note = truncate(call?.note, 64);
    stations.push({
      id,
      kind: 'mcp_tool',
      label: truncate(call?.tool, 40) || `step ${i + 1}`,
      ...(note ? { sublabel: note } : {}),
      x: PADX + (i + 1) * (W + GAP),
      y: TOP,
      w: W,
      h: H,
    });
    edges.push({ from: prev, to: id });
    prev = id;
  });

  const count = stations.length;
  const width = PADX * 2 + count * W + (count - 1) * GAP;
  const height = TOP * 2 + H;
  return {
    title: `Plan: ${plan?.title || plan?.planRef || 'untitled'}`,
    viewBox: { width, height },
    stations,
    edges,
  };
}

function itemStationKind(kind) {
  if (kind === 'screencap') return 'filesystem';
  if (kind === 'summary' || kind === 'note') return 'db_row';
  if (kind === 'sketch') return 'mcp_tool';
  return 'input';
}

const ITEM_CAP = 24;

/**
 * Research book → hub-spoke. The synthesized thesis is a central `db_row`
 * station; each bound item is a spoke on the left that feeds into it. Drawn at
 * synthesis time so each append-only abstract snapshot gets its own diagram.
 *
 * @param {object} book   - { session, items } (abstracts not needed here)
 * @param {string} thesis - the abstract text being synthesized (the hub label)
 */
export function researchToSketchManifest(book, thesis) {
  const session = book?.session || {};
  const allItems = Array.isArray(book?.items) ? book.items : [];
  const items = allItems.slice(-ITEM_CAP); // most recent if the book is large
  const more = allItems.length - items.length;

  const IW = 230;
  const IH = 64;
  const IGAP = 20;
  const PADX = 40;
  const TOP = 40;
  const GUTTER = 170;
  const HUBW = 240;
  const HUBH = 120;

  const stations = [];
  const edges = [];
  items.forEach((it, i) => {
    const id = `i${i}`;
    const body = truncate(firstLine(it?.body), 60);
    stations.push({
      id,
      kind: itemStationKind(it?.kind),
      label: truncate(it?.title, 40) || capitalize(it?.kind || 'item'),
      ...(body ? { sublabel: body } : {}),
      x: PADX,
      y: TOP + i * (IH + IGAP),
      w: IW,
      h: IH,
    });
    edges.push({ from: id, to: 'thesis' });
  });

  const colHeight = items.length ? items.length * (IH + IGAP) - IGAP : IH;
  const hubX = PADX + IW + GUTTER;
  const hubY = TOP + Math.max(0, (colHeight - HUBH) / 2);
  stations.push({
    id: 'thesis',
    kind: 'db_row',
    label: 'Thesis',
    ...(truncate(firstLine(thesis), 64) ? { sublabel: truncate(firstLine(thesis), 64) } : {}),
    ...(more > 0 ? { items: [`+${more} earlier item${more === 1 ? '' : 's'}`] } : {}),
    x: hubX,
    y: hubY,
    w: HUBW,
    h: HUBH,
  });

  const width = hubX + HUBW + PADX;
  const height = TOP * 2 + Math.max(colHeight, HUBH);
  return {
    title: `Research: ${session.title || session.researchRef || 'untitled'}`,
    viewBox: { width, height },
    stations,
    edges,
  };
}

// compact numeric label: enough digits to distinguish sweep points, no float noise.
function numLabel(v) {
  if (!Number.isFinite(v)) return '';
  const a = Math.abs(v);
  if (a >= 1000) return String(Math.round(v));
  if (a >= 10) return String(+v.toFixed(1));
  return String(+v.toFixed(3));
}

/**
 * Experiment sweep → param-vs-outcome chart, from primitive marks (axes as `line`s, the
 * curve as a `polyline`, points as `circle`s, labels as `text`). Pure and deterministic —
 * the auto-plot seam for run_experiment_sweep, posture-sibling of the hub-spoke derives
 * above: structure in, manifest out, no DB, no LLM.
 *
 * @param {object} spec - { title, param, outcome, unitX?, unitY?, points: [{ x, y }] }
 */
export function experimentsToChartManifest({ title, param, outcome, unitX, unitY, points } = {}) {
  const pts = (Array.isArray(points) ? points : [])
    .filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))
    .slice()
    .sort((a, b) => a.x - b.x);
  if (pts.length < 2) {
    throw new Error('experimentsToChartManifest requires >= 2 { x, y } points');
  }

  const W = 760, H = 480;
  const mL = 96, mR = 44, mT = 68, mB = 78;
  const AXIS = '#94a3b8', CURVE = '#5b8fd6', POINT = '#f59e0b', TEXT = '#cbd5e1';

  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(0, ...ys), yMax = Math.max(...ys);   // physical outcomes: keep the zero baseline
  const spanX = xMax - xMin || 1, spanY = yMax - yMin || 1;
  const px = (x) => +(mL + ((x - xMin) / spanX) * (W - mL - mR)).toFixed(1);
  const py = (y) => +(H - mB - ((y - yMin) / spanY) * (H - mT - mB)).toFixed(1);

  const marks = [
    { kind: 'text', x: mL, y: 34, value: truncate(title, 72) || `${outcome} vs ${param}`, size: 17, color: TEXT },
    // axes
    { kind: 'line', x1: mL, y1: py(yMin), x2: W - mR, y2: py(yMin), stroke: AXIS },
    { kind: 'line', x1: mL, y1: py(yMin), x2: mL, y2: mT, stroke: AXIS },
    // axis labels
    { kind: 'text', x: mL + (W - mL - mR) / 2 - 40, y: H - 18, value: `${param}${unitX ? ` (${unitX})` : ''}`, size: 13, color: TEXT },
    { kind: 'text', x: 16, y: mT - 16, value: `${outcome}${unitY ? ` (${unitY})` : ''}`, size: 13, color: TEXT },
    // y extents
    { kind: 'text', x: 16, y: py(yMax) + 4, value: numLabel(yMax), size: 11, color: AXIS },
    { kind: 'text', x: 16, y: py(yMin) + 4, value: numLabel(yMin), size: 11, color: AXIS },
    // the curve
    { kind: 'polyline', points: pts.map((p) => [px(p.x), py(p.y)]), stroke: CURVE },
  ];
  for (const p of pts) {
    marks.push({ kind: 'circle', cx: px(p.x), cy: py(p.y), r: 5, fill: POINT });
    marks.push({ kind: 'text', x: px(p.x) - 12, y: H - mB + 22, value: numLabel(p.x), size: 11, color: AXIS });
  }

  return { title: title || `${outcome} vs ${param}`, viewBox: { width: W, height: H }, marks };
}

// Test seam.
export const _internals = { truncate, firstLine, itemStationKind, ITEM_CAP, numLabel };
