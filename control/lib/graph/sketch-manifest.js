/**
 * Sketch manifest shape — what create_sketch accepts and what
 * /sketches/<ref> renders.
 *
 * Two drawable vocabularies share one manifest:
 *
 *   - stations[] + edges[] — the original flow vocabulary (boxes + arrows).
 *       Station kinds:  input | mcp_tool | filesystem | db_row
 *       Edge `via`:     'right' | 'left' | 'top' | 'bottom'
 *   - marks[]              — the low-level chart vocabulary added for the
 *       chart-concept expansion. Mark kinds include rect | circle | wedge |
 *       line | polyline | polygon | blob | solid | volume | partition | array | mandalaField | cubieLattice | text.
 *       Charts (stacked bar, donut, KPI tile, ...) are
 *       *recipes* composed from these marks — see the sketch_vocab cards in
 *       lib/graph/sketch-vocab/, retrieved via semantic_search by /sketch.
 *
 * A manifest is valid with stations, marks, or both (at least one non-empty).
 * Both old (stations-only) and new (marks/grid/z) manifests validate, so the
 * curated /graph map and existing scratch sketches stay pixel-identical.
 *
 * Positioning: nodes carry explicit x/y/w/h. The optional `grid` + per-node
 * `cell` is sugar — expandGridLayout() resolves a cell to x/y/w/h *before*
 * validation + storage, so the renderer never sees a cell. `z` (optional
 * number) is the paint-order key (ascending; generalizes the legacy
 * layer:'air' rank). See lib/graph/sketch-vocab/grid-layout.md +
 * z-layering.md and app-system/0528/sketch-chart-vocab/PLAN.md.
 */

export const STATION_KINDS = ['input', 'mcp_tool', 'filesystem', 'db_row'];
const STATION_KIND_SET = new Set(STATION_KINDS);
export const EDGE_VIA_VALUES = ['right', 'left', 'top', 'bottom'];
const EDGE_VIA_SET = new Set(EDGE_VIA_VALUES);

export const MARK_KINDS = [
  'rect',
  'circle',
  'wedge',
  'line',
  'polyline',
  'polygon',
  'blob',
  'sphere',
  'oval',
  'egg',
  'cylinder',
  'volume',
  'plane',
  'solid',
  'partition',
  'array',
  'mandalaField',
  'stickerField',
  'cubieLattice',
  'planePreset',
  'solidPreset',
  'object',
  'text',
];
const MARK_KIND_SET = new Set(MARK_KINDS);
const TEXT_ANCHORS = new Set(['start', 'middle', 'end']);

const CURVATURE_MIN = 0.2;
const CURVATURE_MAX = 3;

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function hasCell(node) {
  return node && typeof node === 'object' && node.cell !== undefined && node.cell !== null;
}

// A box-shaped node is positioned by x/y/w/h OR by a `cell` (resolved later by
// expandGridLayout). Accepting either keeps the validator honest whether or
// not grid expansion has run.
function validateBoxPosition(node, path, errors) {
  if (hasCell(node)) {
    if (typeof node.cell !== 'object') {
      errors.push(`${path}.cell must be an object { col, row, colSpan?, rowSpan? }`);
    }
    return;
  }
  for (const k of ['x', 'y', 'w', 'h']) {
    if (!isFiniteNumber(node[k])) {
      errors.push(`${path}.${k} must be a finite number (or supply a \`cell\` with a \`grid\`)`);
    }
  }
}

function validateOptionalNumber(node, key, path, errors) {
  if (node[key] !== undefined && !isFiniteNumber(node[key])) {
    errors.push(`${path}.${key} must be a finite number if provided`);
  }
}

function validateOptionalString(node, key, path, errors) {
  if (node[key] !== undefined && typeof node[key] !== 'string') {
    errors.push(`${path}.${key} must be a string if provided`);
  }
}

function validateStation(station, idx, errors) {
  const path = `stations[${idx}]`;
  if (!station || typeof station !== 'object') {
    errors.push(`${path} must be an object`);
    return;
  }
  if (!station.id || typeof station.id !== 'string') {
    errors.push(`${path}.id is required (string)`);
  }
  if (!STATION_KIND_SET.has(station.kind)) {
    errors.push(
      `${path}.kind must be one of: ${STATION_KINDS.join(', ')} (got '${station.kind}')`,
    );
  }
  if (!station.label || typeof station.label !== 'string') {
    errors.push(`${path}.label is required (string)`);
  }
  validateBoxPosition(station, path, errors);
  validateOptionalNumber(station, 'z', path, errors);
  if (station.items !== undefined) {
    if (!Array.isArray(station.items) || station.items.some((it) => typeof it !== 'string')) {
      errors.push(`${path}.items must be an array of strings if provided`);
    }
  }
  if (station.sublabel !== undefined && typeof station.sublabel !== 'string') {
    errors.push(`${path}.sublabel must be a string if provided`);
  }
}

// Style fields shared across mark kinds. Validated loosely — type-checked when
// present, never required.
function validateMarkStyle(mark, path, errors) {
  validateOptionalString(mark, 'fill', path, errors);
  validateOptionalString(mark, 'stroke', path, errors);
  validateOptionalString(mark, 'color', path, errors);
  validateOptionalString(mark, 'dash', path, errors);
  validateOptionalString(mark, 'blend', path, errors);
  validateOptionalString(mark, 'family', path, errors);
  validateOptionalNumber(mark, 'strokeWidth', path, errors);
  validateOptionalNumber(mark, 'opacity', path, errors);
  validateOptionalNumber(mark, 'blur', path, errors);
  validateOptionalNumber(mark, 'z', path, errors);
  validateOptionalNumber(mark, 'weightRank', path, errors);
  validateOptionalString(mark, 'role', path, errors);
  validateOptionalString(mark, 'algorithm', path, errors);
  if (mark.closed !== undefined && typeof mark.closed !== 'boolean') {
    errors.push(`${path}.closed must be a boolean if provided`);
  }
  if (mark.algorithmic !== undefined && typeof mark.algorithmic !== 'boolean') {
    errors.push(`${path}.algorithmic must be a boolean if provided`);
  }
  if (mark.shade !== undefined && (!mark.shade || typeof mark.shade !== 'object' || Array.isArray(mark.shade))) {
    errors.push(`${path}.shade must be an object if provided`);
  }
  if (
    mark.highlights !== undefined &&
    (!mark.highlights || typeof mark.highlights !== 'object' || Array.isArray(mark.highlights))
  ) {
    errors.push(`${path}.highlights must be an object if provided`);
  }
  if (mark.elevate !== undefined && typeof mark.elevate !== 'boolean') {
    errors.push(`${path}.elevate must be a boolean if provided`);
  }
}

function validateMark(mark, idx, errors) {
  const path = `marks[${idx}]`;
  if (!mark || typeof mark !== 'object') {
    errors.push(`${path} must be an object`);
    return;
  }
  if (!MARK_KIND_SET.has(mark.kind)) {
    errors.push(`${path}.kind must be one of: ${MARK_KINDS.join(', ')} (got '${mark.kind}')`);
    return;
  }
  validateMarkStyle(mark, path, errors);

  switch (mark.kind) {
    case 'rect':
      validateBoxPosition(mark, path, errors);
      validateOptionalNumber(mark, 'rx', path, errors);
      break;
    case 'circle':
      for (const k of ['cx', 'cy', 'r']) {
        if (!isFiniteNumber(mark[k])) errors.push(`${path}.${k} must be a finite number`);
      }
      break;
    case 'wedge':
      for (const k of ['cx', 'cy', 'r', 'start', 'end']) {
        if (!isFiniteNumber(mark[k])) errors.push(`${path}.${k} must be a finite number`);
      }
      validateOptionalNumber(mark, 'rInner', path, errors);
      if (isFiniteNumber(mark.start) && isFiniteNumber(mark.end) && mark.end < mark.start) {
        errors.push(`${path}.end must be >= start (fractions of the circle, 0–1)`);
      }
      break;
    case 'line':
      for (const k of ['x1', 'y1', 'x2', 'y2']) {
        if (!isFiniteNumber(mark[k])) errors.push(`${path}.${k} must be a finite number`);
      }
      break;
    case 'polyline':
      if (
        !Array.isArray(mark.points) ||
        mark.points.length < 2 ||
        mark.points.some(
          (p) => !Array.isArray(p) || p.length !== 2 || !isFiniteNumber(p[0]) || !isFiniteNumber(p[1]),
        )
      ) {
        errors.push(`${path}.points must be an array of >= 2 [x, y] number pairs`);
      }
      validateOptionalNumber(mark, 'curvature', path, errors);
      break;
    case 'polygon':
      if (
        !Array.isArray(mark.points) ||
        mark.points.length < 3 ||
        mark.points.some(
          (p) => !Array.isArray(p) || p.length !== 2 || !isFiniteNumber(p[0]) || !isFiniteNumber(p[1]),
        )
      ) {
        errors.push(`${path}.points must be an array of >= 3 [x, y] number pairs`);
      }
      break;
    case 'blob':
      if (
        !Array.isArray(mark.anchor) ||
        mark.anchor.length !== 2 ||
        !isFiniteNumber(mark.anchor[0]) ||
        !isFiniteNumber(mark.anchor[1])
      ) {
        errors.push(`${path}.anchor must be an [x, y] number pair`);
      }
      for (const k of ['rx', 'ry']) {
        if (!isFiniteNumber(mark[k])) errors.push(`${path}.${k} must be a finite number`);
      }
      validateOptionalNumber(mark, 'rotation', path, errors);
      validateOptionalNumber(mark, 'wobble', path, errors);
      validateOptionalNumber(mark, 'points', path, errors);
      break;
    case 'volume':
      if (mark.primitive !== undefined && typeof mark.primitive !== 'string') {
        errors.push(`${path}.primitive must be a string if provided`);
      }
      if (
        mark.anchor !== undefined &&
        (!Array.isArray(mark.anchor) ||
          mark.anchor.length !== 2 ||
          !isFiniteNumber(mark.anchor[0]) ||
          !isFiniteNumber(mark.anchor[1]))
      ) {
        errors.push(`${path}.anchor must be an [x, y] number pair if provided`);
      }
      ['height', 'rimWidth', 'footWidth', 'wallThickness', 'rings'].forEach((key) =>
        validateOptionalNumber(mark, key, path, errors),
      );
      if (mark.openTop !== undefined && typeof mark.openTop !== 'boolean') {
        errors.push(`${path}.openTop must be a boolean if provided`);
      }
      break;
    case 'cubieLattice':
      ['cols', 'rows', 'layers', 'cellSize', 'gap', 'floorDepth', 'baselineY', 'unitCellSize', 'unitGap', 'unitStepX', 'unitStepY', 'unitStepZ'].forEach((key) =>
        validateOptionalNumber(mark, key, path, errors),
      );
      validateOptionalString(mark, 'depthMode', path, errors);
      if (
        mark.anchor !== undefined &&
        (!Array.isArray(mark.anchor) ||
          mark.anchor.length !== 2 ||
          !isFiniteNumber(mark.anchor[0]) ||
          !isFiniteNumber(mark.anchor[1]))
      ) {
        errors.push(`${path}.anchor must be an [x, y] number pair if provided`);
      }
      break;
    case 'stickerField':
      if (!mark.die || typeof mark.die !== 'object' || Array.isArray(mark.die)) {
        errors.push(`${path}.die must be an object`);
      }
      if (!mark.field || typeof mark.field !== 'object' || Array.isArray(mark.field)) {
        errors.push(`${path}.field must be an object`);
      }
      if (
        mark.valueBudget !== undefined &&
        (!mark.valueBudget || typeof mark.valueBudget !== 'object' || Array.isArray(mark.valueBudget))
      ) {
        errors.push(`${path}.valueBudget must be an object if provided`);
      }
      if (
        mark.constraints !== undefined &&
        (!mark.constraints || typeof mark.constraints !== 'object' || Array.isArray(mark.constraints))
      ) {
        errors.push(`${path}.constraints must be an object if provided`);
      }
      break;
    case 'text':
      for (const k of ['x', 'y']) {
        if (!isFiniteNumber(mark[k])) errors.push(`${path}.${k} must be a finite number`);
      }
      if (!mark.value || typeof mark.value !== 'string') {
        errors.push(`${path}.value is required (non-empty string)`);
      }
      validateOptionalNumber(mark, 'size', path, errors);
      if (mark.weight !== undefined && !isFiniteNumber(mark.weight) && typeof mark.weight !== 'string') {
        errors.push(`${path}.weight must be a number or string if provided`);
      }
      if (mark.anchor !== undefined && !TEXT_ANCHORS.has(mark.anchor)) {
        errors.push(`${path}.anchor must be one of: start, middle, end (got '${mark.anchor}')`);
      }
      break;
    default:
      break;
  }
}

function validateEdge(edge, idx, stationIds, errors) {
  if (!edge || typeof edge !== 'object') {
    errors.push(`edges[${idx}] must be an object`);
    return;
  }
  if (!edge.from || typeof edge.from !== 'string') {
    errors.push(`edges[${idx}].from is required (string)`);
  } else if (!stationIds.has(edge.from)) {
    errors.push(`edges[${idx}].from='${edge.from}' does not match any station id`);
  }
  if (!edge.to || typeof edge.to !== 'string') {
    errors.push(`edges[${idx}].to is required (string)`);
  } else if (!stationIds.has(edge.to)) {
    errors.push(`edges[${idx}].to='${edge.to}' does not match any station id`);
  }
  if (edge.label !== undefined && typeof edge.label !== 'string') {
    errors.push(`edges[${idx}].label must be a string if provided`);
  }
  if (edge.via !== undefined && !EDGE_VIA_SET.has(edge.via)) {
    errors.push(
      `edges[${idx}].via must be one of: ${EDGE_VIA_VALUES.join(', ')} (got '${edge.via}')`,
    );
  }
  if (edge.curvature !== undefined) {
    if (!isFiniteNumber(edge.curvature)) {
      errors.push(`edges[${idx}].curvature must be a finite number if provided`);
    } else if (edge.curvature < CURVATURE_MIN || edge.curvature > CURVATURE_MAX) {
      errors.push(
        `edges[${idx}].curvature must be between ${CURVATURE_MIN} and ${CURVATURE_MAX} (got ${edge.curvature})`,
      );
    }
  }
}

// Optional informational block carried by map-illustrator sketches. Records
// the source, query, and projection used to derive the polygon marks so a
// replay is auditable. The renderer ignores it; the validator only
// type-checks. See lib/graph/geo/index.js + the map-boundary sketch_vocab card.
function validateGeo(geo, errors) {
  if (geo === undefined) return;
  if (!geo || typeof geo !== 'object' || Array.isArray(geo)) {
    errors.push('manifest.geo must be an object if provided');
    return;
  }
  const stringFields = ['source', 'query', 'projection', 'theme', 'level', 'regionId', 'sourceUrl', 'fetchedAt'];
  for (const f of stringFields) {
    if (geo[f] !== undefined && typeof geo[f] !== 'string') {
      errors.push(`manifest.geo.${f} must be a string if provided`);
    }
  }
  if (geo.tolerancePx !== undefined && !isFiniteNumber(geo.tolerancePx)) {
    errors.push('manifest.geo.tolerancePx must be a finite number if provided');
  }
}

function validateGrid(grid, errors) {
  if (grid === undefined) return;
  if (!grid || typeof grid !== 'object') {
    errors.push('manifest.grid must be an object { cols, rows, gap?, pad? } if provided');
    return;
  }
  if (!isFiniteNumber(grid.cols) || grid.cols <= 0) {
    errors.push('manifest.grid.cols must be a positive number');
  }
  if (!isFiniteNumber(grid.rows) || grid.rows <= 0) {
    errors.push('manifest.grid.rows must be a positive number');
  }
  if (grid.gap !== undefined && (!isFiniteNumber(grid.gap) || grid.gap < 0)) {
    errors.push('manifest.grid.gap must be a non-negative number if provided');
  }
  if (grid.pad !== undefined && (!isFiniteNumber(grid.pad) || grid.pad < 0)) {
    errors.push('manifest.grid.pad must be a non-negative number if provided');
  }
}

export function validateSketchManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object') {
    return { ok: false, errors: ['manifest must be an object'] };
  }
  if (!manifest.title || typeof manifest.title !== 'string') {
    errors.push('manifest.title is required (string)');
  }
  if (!manifest.viewBox || typeof manifest.viewBox !== 'object') {
    errors.push('manifest.viewBox is required ({ width, height })');
  } else {
    if (!isFiniteNumber(manifest.viewBox.width) || manifest.viewBox.width <= 0) {
      errors.push('manifest.viewBox.width must be a positive number');
    }
    if (!isFiniteNumber(manifest.viewBox.height) || manifest.viewBox.height <= 0) {
      errors.push('manifest.viewBox.height must be a positive number');
    }
  }

  validateGrid(manifest.grid, errors);
  validateGeo(manifest.geo, errors);

  const hasStations = Array.isArray(manifest.stations) && manifest.stations.length > 0;
  const hasMarks = Array.isArray(manifest.marks) && manifest.marks.length > 0;
  if (!hasStations && !hasMarks) {
    errors.push('manifest must have a non-empty stations[] or marks[] (at least one drawable)');
  }

  if (manifest.stations !== undefined) {
    if (!Array.isArray(manifest.stations)) {
      errors.push('manifest.stations must be an array if provided');
    } else {
      manifest.stations.forEach((s, i) => validateStation(s, i, errors));
      const ids = manifest.stations.map((s) => s?.id).filter((id) => typeof id === 'string');
      const seen = new Set();
      for (const id of ids) {
        if (seen.has(id)) errors.push(`stations[].id='${id}' is duplicated; ids must be unique`);
        seen.add(id);
      }
    }
  }

  if (manifest.marks !== undefined) {
    if (!Array.isArray(manifest.marks)) {
      errors.push('manifest.marks must be an array if provided');
    } else {
      manifest.marks.forEach((m, i) => validateMark(m, i, errors));
    }
  }

  const stationIds = new Set(
    Array.isArray(manifest.stations)
      ? manifest.stations.map((s) => s?.id).filter((id) => typeof id === 'string')
      : [],
  );
  if (manifest.edges !== undefined) {
    if (!Array.isArray(manifest.edges)) {
      errors.push('manifest.edges must be an array if provided');
    } else {
      manifest.edges.forEach((e, i) => validateEdge(e, i, stationIds, errors));
    }
  }
  return { ok: errors.length === 0, errors };
}

// ── Grid expansion ─────────────────────────────────────────────────────────
//
// Resolve every `cell` on a box-shaped node (rect mark or station) into
// x/y/w/h using the manifest's `grid` + `viewBox`. Runs in mintSketch BEFORE
// validation + storage, so the renderer only ever sees concrete coords and the
// stored manifest is self-contained. Raw x/y/w/h WIN when both are present
// (cell is a fallback). Non-box marks (circle/wedge/line/polyline/text) must
// use absolute coords — a `cell` on one is a clear error.
function resolveCell(node, allowed, label, metrics) {
  if (!hasCell(node)) return node;
  if (!allowed) {
    throw new Error(`cell is only supported on rect marks and stations (got ${label}); use absolute coords`);
  }
  const c = node.cell;
  if (!c || typeof c !== 'object' || !isFiniteNumber(c.col) || !isFiniteNumber(c.row)) {
    throw new Error(`${label} cell must be an object with finite col and row`);
  }
  const { pad, gap, cellW, cellH } = metrics;
  const col = Math.floor(c.col);
  const row = Math.floor(c.row);
  const colSpan = isFiniteNumber(c.colSpan) && c.colSpan >= 1 ? Math.floor(c.colSpan) : 1;
  const rowSpan = isFiniteNumber(c.rowSpan) && c.rowSpan >= 1 ? Math.floor(c.rowSpan) : 1;
  const gx = pad + col * (cellW + gap);
  const gy = pad + row * (cellH + gap);
  const gw = colSpan * cellW + (colSpan - 1) * gap;
  const gh = rowSpan * cellH + (rowSpan - 1) * gap;
  const { cell, ...rest } = node;
  return {
    ...rest,
    x: isFiniteNumber(node.x) ? node.x : gx,
    y: isFiniteNumber(node.y) ? node.y : gy,
    w: isFiniteNumber(node.w) ? node.w : gw,
    h: isFiniteNumber(node.h) ? node.h : gh,
  };
}

export function expandGridLayout(manifest) {
  if (!manifest || typeof manifest !== 'object') return manifest;
  const stations = Array.isArray(manifest.stations) ? manifest.stations : null;
  const marks = Array.isArray(manifest.marks) ? manifest.marks : null;
  const anyCell =
    (stations && stations.some(hasCell)) || (marks && marks.some(hasCell));
  if (!anyCell) return manifest;

  const grid = manifest.grid;
  if (!grid || !isFiniteNumber(grid.cols) || !isFiniteNumber(grid.rows) || grid.cols <= 0 || grid.rows <= 0) {
    throw new Error('manifest uses `cell` but has no valid `grid` { cols, rows }');
  }
  const vb = manifest.viewBox || {};
  if (!isFiniteNumber(vb.width) || !isFiniteNumber(vb.height)) {
    throw new Error('grid expansion requires a numeric viewBox { width, height }');
  }
  const pad = isFiniteNumber(grid.pad) ? grid.pad : 40;
  const gap = isFiniteNumber(grid.gap) ? grid.gap : 16;
  const cols = Math.floor(grid.cols);
  const rows = Math.floor(grid.rows);
  const cellW = (vb.width - 2 * pad - (cols - 1) * gap) / cols;
  const cellH = (vb.height - 2 * pad - (rows - 1) * gap) / rows;
  if (!(cellW > 0) || !(cellH > 0)) {
    throw new Error('grid cells compute to a non-positive size; reduce cols/rows/gap/pad or grow the viewBox');
  }
  const metrics = { pad, gap, cellW, cellH };

  const nextStations = stations
    ? stations.map((s) => resolveCell(s, true, 'station', metrics))
    : manifest.stations;
  const nextMarks = marks
    ? marks.map((m) => resolveCell(m, m && m.kind === 'rect', `mark kind '${m && m.kind}'`, metrics))
    : manifest.marks;

  return { ...manifest, stations: nextStations, marks: nextMarks };
}
