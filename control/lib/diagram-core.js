/**
 * Diagram core — the KERNEL home of the box-and-arrow + dataviz vocabulary.
 *
 * Extracted verbatim from lib/graph/sketch/sketch-manifest.js so that a bare,
 * creative-absent mojulo can still validate + mint a flowchart/chart (the
 * "kernel is a diagram maker" floor-1). Pure and dependency-light: no imports,
 * no lib/graph render stack, no sharp. sketch-manifest.js (creative) BINDS to
 * this module — its validateSketchManifest delegates here for diagram kinds, so
 * there is one implementation, not a copy. Enforced by the binding test +
 * pack-boundary Check E. See lib/mcp/kernel-diagram-surface.plan.md.
 */

export const STATION_KINDS = ['input', 'mcp_tool', 'filesystem', 'db_row'];
const STATION_KIND_SET = new Set(STATION_KINDS);
export const EDGE_VIA_VALUES = ['right', 'left', 'top', 'bottom'];
const EDGE_VIA_SET = new Set(EDGE_VIA_VALUES);

// An edge can carry a live `pulse` — one or more tokens that travel along its
// path (the "A pings B" primitive). Rendered with native SVG <animateMotion>,
// so it plays in the /sketches viewer AND in the exported standalone .svg with
// no bake step and no JS. `dir` is the travel direction along from→to.
export const PULSE_DIRS = ['forward', 'reverse', 'pingpong'];
const PULSE_DIR_SET = new Set(PULSE_DIRS);
const PULSE_MAX_COUNT = 12;

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
  'mandalaArrangement',
  'horizontalStack',
  'mandalaField',
  'fluidField',
  'swirlField',
  'rBrush',
  'blobPla',
  'visionPane',
  'stickerField',
  'cubieLattice',
  'planePreset',
  'solidPreset',
  'object',
  'boxNet',
  'arabesque',
  'text',
];
const MARK_KIND_SET = new Set(MARK_KINDS);
const TEXT_ANCHORS = new Set(['start', 'middle', 'end']);

const CURVATURE_MIN = 0.2;
const CURVATURE_MAX = 3;

// adaptive-signage: a cross-backend annotation channel (manifest.signage[]) read
// by all three renderers (SVG diagram / CSS-3D scene / three.js world). Unlike a
// `marks` kind (SVG-only, geometry-only), a sign carries behavior — it is a
// sibling of the picks/tracers/motion channels. Three variants, each with built-in
// behavior baked into the emitted artifact: a hover/tap `tooltip`, a fixed-size
// `popup` that pages overflow via a down-button (never wheel-scrolls), and a
// timed `toast` that appears then fades (a Mario-coin score pop).
export const SIGNAGE_VARIANTS = ['tooltip', 'popup', 'toast'];
const SIGNAGE_VARIANT_SET = new Set(SIGNAGE_VARIANTS);
// Screen-relative anchor slots (camera-independent overlay positions). The
// default for a toast.
export const SIGNAGE_SLOTS = [
  'top-left', 'top', 'top-right', 'center', 'bottom-left', 'bottom', 'bottom-right',
];
const SIGNAGE_SLOT_SET = new Set(SIGNAGE_SLOTS);

// A sign anchors to exactly one of: a named target ({object} — a mesh group /
// face / station id), a world point ({world:[x,y,z]}), a screen slot ({slot}),
// or absolute viewBox coords ({xy:[x,y]} — the SVG fallback / toast screen pos).
function validateSignageAnchor(anchor, path, errors) {
  if (!anchor || typeof anchor !== 'object' || Array.isArray(anchor)) {
    errors.push(`${path}.anchor must be an object ({ object } | { world } | { slot } | { xy })`);
    return;
  }
  const forms = ['object', 'world', 'slot', 'xy'].filter((k) => anchor[k] !== undefined);
  if (forms.length !== 1) {
    errors.push(`${path}.anchor must declare exactly one of: object, world, slot, xy (got ${forms.length})`);
    return;
  }
  if (anchor.object !== undefined && (typeof anchor.object !== 'string' || !anchor.object)) {
    errors.push(`${path}.anchor.object must be a non-empty string`);
  }
  if (anchor.slot !== undefined && !SIGNAGE_SLOT_SET.has(anchor.slot)) {
    errors.push(`${path}.anchor.slot must be one of: ${SIGNAGE_SLOTS.join(', ')} (got '${anchor.slot}')`);
  }
  if (
    anchor.world !== undefined &&
    (!Array.isArray(anchor.world) || anchor.world.length !== 3 || anchor.world.some((n) => !isFiniteNumber(n)))
  ) {
    errors.push(`${path}.anchor.world must be an [x, y, z] number triple`);
  }
  if (
    anchor.xy !== undefined &&
    (!Array.isArray(anchor.xy) || anchor.xy.length !== 2 || anchor.xy.some((n) => !isFiniteNumber(n)))
  ) {
    errors.push(`${path}.anchor.xy must be an [x, y] number pair`);
  }
}

function validateSignageItem(sign, idx, errors) {
  const path = `signage[${idx}]`;
  if (!sign || typeof sign !== 'object' || Array.isArray(sign)) {
    errors.push(`${path} must be an object`);
    return;
  }
  if (!SIGNAGE_VARIANT_SET.has(sign.variant)) {
    errors.push(`${path}.variant must be one of: ${SIGNAGE_VARIANTS.join(', ')} (got '${sign.variant}')`);
  }
  // text is required, except a popup may instead carry `body` (paged content).
  const hasBody =
    typeof sign.body === 'string' ||
    (Array.isArray(sign.body) && sign.body.length > 0 && sign.body.every((p) => typeof p === 'string'));
  if (sign.body !== undefined && !hasBody) {
    errors.push(`${path}.body must be a non-empty string or array of strings if provided`);
  }
  if ((sign.text === undefined || typeof sign.text !== 'string' || !sign.text) && !(sign.variant === 'popup' && hasBody)) {
    errors.push(`${path}.text is required (non-empty string)`);
  } else if (sign.text !== undefined && typeof sign.text !== 'string') {
    errors.push(`${path}.text must be a string if provided`);
  }
  validateSignageAnchor(sign.anchor, path, errors);
  // toast timing (seconds) — ignored by tooltip/popup.
  for (const k of ['after', 'ttl']) {
    if (sign[k] !== undefined && (!isFiniteNumber(sign[k]) || sign[k] < 0)) {
      errors.push(`${path}.${k} must be a non-negative number (seconds) if provided`);
    }
  }
  if (sign.pageLines !== undefined && (!isFiniteNumber(sign.pageLines) || sign.pageLines < 1)) {
    errors.push(`${path}.pageLines must be a number >= 1 if provided`);
  }
  if (sign.size !== undefined && (!isFiniteNumber(sign.size) || sign.size <= 0)) {
    errors.push(`${path}.size must be a positive number if provided`);
  }
  validateOptionalString(sign, 'id', path, errors);
  if (sign.palette !== undefined && (!sign.palette || typeof sign.palette !== 'object' || Array.isArray(sign.palette))) {
    errors.push(`${path}.palette must be an object if provided`);
  }
}

// manifest.signage[] is an overlay channel — like `geo`, it does NOT by itself
// satisfy the "at least one drawable" rule (a manifest that is *only* signage has
// nothing to annotate). Validated when present, never required.
function validateSignage(signage, errors) {
  if (signage === undefined) return;
  if (!Array.isArray(signage)) {
    errors.push('manifest.signage must be an array if provided');
    return;
  }
  signage.forEach((s, i) => validateSignageItem(s, i, errors));
}

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
    case 'fluidField':
    case 'swirlField':
      ['count', 'unitScale', 'depthScale', 'z', 'strokeWidth', 'points'].forEach((key) =>
        validateOptionalNumber(mark, key, path, errors),
      );
      validateOptionalString(mark, 'medium', path, errors);
      validateOptionalString(mark, 'style', path, errors);
      if (mark.basis !== undefined && (!mark.basis || typeof mark.basis !== 'object' || Array.isArray(mark.basis))) {
        errors.push(`${path}.basis must be an object if provided`);
      }
      if (mark.population !== undefined && (!mark.population || typeof mark.population !== 'object' || Array.isArray(mark.population))) {
        errors.push(`${path}.population must be an object if provided`);
      }
      if (mark.glyph !== undefined && (!mark.glyph || typeof mark.glyph !== 'object' || Array.isArray(mark.glyph))) {
        errors.push(`${path}.glyph must be an object if provided`);
      }
      break;
    case 'arabesque':
      ['n', 'contactAngle', 'cols', 'rows', 'cx', 'cy', 'size', 'strokeWidth',
        'shoulder', 'pointWidth', 'gap', 'bandWidth', 'opacity', 'z'].forEach((key) =>
        validateOptionalNumber(mark, key, path, errors),
      );
      ['mode', 'pattern', 'stroke', 'starFill', 'petalFill', 'coreFill', 'bandColor', 'casingColor'].forEach((key) =>
        validateOptionalString(mark, key, path, errors),
      );
      ['fill', 'interlace'].forEach((key) => {
        if (mark[key] !== undefined && typeof mark[key] !== 'boolean') {
          errors.push(`${path}.${key} must be a boolean if provided`);
        }
      });
      if (mark.mode !== undefined && !['field', 'rosette', 'medallion'].includes(mark.mode)) {
        errors.push(`${path}.mode must be one of field|rosette|medallion`);
      }
      if (mark.pattern !== undefined && !['hex', 'square', 'khatam'].includes(mark.pattern)) {
        errors.push(`${path}.pattern must be one of hex|square|khatam`);
      }
      break;
    case 'rBrush':
      if (mark.matter !== undefined && (!mark.matter || typeof mark.matter !== 'object' || Array.isArray(mark.matter))) {
        errors.push(`${path}.matter must be an object if provided`);
      }
      if (mark.load !== undefined && !Array.isArray(mark.load)) {
        errors.push(`${path}.load must be an array if provided`);
      }
      if (mark.color !== undefined && (!mark.color || typeof mark.color !== 'object' || Array.isArray(mark.color))) {
        errors.push(`${path}.color must be an object if provided`);
      }
      if (mark.edge !== undefined && (!mark.edge || typeof mark.edge !== 'object' || Array.isArray(mark.edge))) {
        errors.push(`${path}.edge must be an object if provided`);
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
    case 'boxNet':
      // A furniture/object box-net placed by the room planner: requires a net
      // `type` (table/cabinet/chair/…); geometry (footprint, height, support
      // pins) is resolved from the planner + the scene's two-point camera.
      if (!mark.type || typeof mark.type !== 'string') {
        errors.push(`${path}.type is required (a furniture net type, e.g. 'table')`);
      }
      if (mark.anchor !== undefined && (!Array.isArray(mark.anchor) || mark.anchor.length !== 2)) {
        errors.push(`${path}.anchor must be a [u, v] pair if provided`);
      }
      break;
    default:
      break;
  }
}

// Optional traveling-token spec on an edge. All fields default in the renderer;
// the validator only type-checks and range-checks what is present.
function validatePulse(pulse, path, errors) {
  if (pulse === undefined) return;
  if (!pulse || typeof pulse !== 'object' || Array.isArray(pulse)) {
    errors.push(`${path}.pulse must be an object { count?, period?, size?, color?, dir? } if provided`);
    return;
  }
  if (
    pulse.count !== undefined &&
    (!isFiniteNumber(pulse.count) || pulse.count < 1 || pulse.count > PULSE_MAX_COUNT)
  ) {
    errors.push(`${path}.pulse.count must be a number between 1 and ${PULSE_MAX_COUNT} if provided`);
  }
  if (pulse.period !== undefined && (!isFiniteNumber(pulse.period) || pulse.period <= 0)) {
    errors.push(`${path}.pulse.period must be a positive number (seconds) if provided`);
  }
  if (pulse.size !== undefined && (!isFiniteNumber(pulse.size) || pulse.size <= 0)) {
    errors.push(`${path}.pulse.size must be a positive number if provided`);
  }
  if (pulse.color !== undefined && typeof pulse.color !== 'string') {
    errors.push(`${path}.pulse.color must be a string if provided`);
  }
  if (pulse.dir !== undefined && !PULSE_DIR_SET.has(pulse.dir)) {
    errors.push(`${path}.pulse.dir must be one of: ${PULSE_DIRS.join(', ')} (got '${pulse.dir}')`);
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
  validatePulse(edge.pulse, `edges[${idx}]`, errors);
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


// The diagram/chart validator — the default (non-image, non-world) branch of the
// former single validateSketchManifest. Kernel-owned; sketch-manifest.js and the
// kernel mint tool both call THIS, so the two can never drift.
export function validateDiagramManifest(manifest) {
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
  validateSignage(manifest.signage, errors);

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
