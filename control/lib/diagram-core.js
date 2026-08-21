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

// Typed endpoint notation (P0 — diagram-patterns-spike.plan.md). An edge, or a
// `line`/`polyline` mark, may carry a `head` (the to-end) and/or `tail` (the
// from-end) marker. `arrow` is the default flow head; the rest cover the
// standard UML/ERD notations several patterns depend on. The renderer lowers
// each distinct (kind, color) to an SVG <marker>; `none` draws nothing. Absent
// on an edge ⇒ the legacy single filled-arrow head (byte-identical to before).
export const EDGE_HEADS = [
  'arrow',
  'triangle-open',   // UML inheritance / generalization
  'diamond',         // UML aggregation (hollow)
  'diamond-filled',  // UML composition (filled)
  'crowsfoot-one',   // ERD cardinality: one
  'crowsfoot-many',  // ERD cardinality: many
  'dot',             // state-machine pseudostate / bullet
  'none',
];
const EDGE_HEAD_SET = new Set(EDGE_HEADS);

// Shared head/tail validation for the head-capable marks (line/polyline) and
// edges. Type-checked + enum-checked when present; never required.
function validateHeads(node, path, errors) {
  for (const k of ['head', 'tail']) {
    if (node[k] !== undefined && !EDGE_HEAD_SET.has(node[k])) {
      errors.push(`${path}.${k} must be one of: ${EDGE_HEADS.join(', ')} (got '${node[k]}')`);
    }
  }
}

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

// Exported because sketch-manifest.js imports it by name. Webpack/vitest tolerate
// the missing export via namespace interop; strict Node ESM (the mcp-stdio CLI)
// does not — without this the CLI front door fails to register the tool surface.
export function isFiniteNumber(v) {
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
  // Entity-box rule under the title (ERD/UML — P3). Advisory boolean; the
  // renderer draws a divider line below the label when set.
  if (station.divider !== undefined && typeof station.divider !== 'boolean') {
    errors.push(`${path}.divider must be a boolean if provided`);
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
      validateHeads(mark, path, errors);
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
      validateHeads(mark, path, errors);
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
  validateHeads(edge, `edges[${idx}]`, errors);
  if (edge.dashed !== undefined && typeof edge.dashed !== 'boolean') {
    errors.push(`edges[${idx}].dashed must be a boolean if provided`);
  }
  // Endpoint labels (ERD/UML multiplicities — P3): a short string pinned near
  // the from-/to-end of the edge, distinct from the centered `label`.
  if (edge.fromLabel !== undefined && typeof edge.fromLabel !== 'string') {
    errors.push(`edges[${idx}].fromLabel must be a string if provided`);
  }
  if (edge.toLabel !== undefined && typeof edge.toLabel !== 'string') {
    errors.push(`edges[${idx}].toLabel must be a string if provided`);
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


// ── Sequence lowering (P1 — diagram-patterns-spike.plan.md) ──────────────────
//
// A `kind:'sequence'` manifest is a compact { actors, messages } spec; this
// lowers it to a plain diagram (viewBox + line/rect/text marks with P0 heads)
// BEFORE validate + store, exactly like expandGridLayout. The renderer never
// learns about sequences — it just draws the emitted marks. Deterministic: same
// spec → byte-identical marks. No-op for every other kind.
//
// Auto-layout is the whole value: actors are evenly spaced across the top (a
// header box + a dashed lifeline each); messages stack top→down by array order;
// a message with `activate` opens an activation bar on its receiver that closes
// at the receiver's next outgoing message; a self-message (from===to) draws a
// loopback. The palette uses the same CSS vars the diagram renderer resolves, so
// a lowered sequence themes + exports like any other diagram.
const SEQUENCE_MSG_KINDS = new Set(['sync', 'async', 'return']);

function validateSequenceSpec(manifest) {
  const errors = [];
  const actors = manifest.actors;
  if (!Array.isArray(actors) || actors.length === 0) {
    errors.push('sequence.actors must be a non-empty array of { id, label }');
  } else {
    const seen = new Set();
    actors.forEach((a, i) => {
      if (!a || typeof a !== 'object') { errors.push(`actors[${i}] must be an object`); return; }
      if (!a.id || typeof a.id !== 'string') errors.push(`actors[${i}].id is required (string)`);
      if (!a.label || typeof a.label !== 'string') errors.push(`actors[${i}].label is required (string)`);
      if (typeof a.id === 'string') {
        if (seen.has(a.id)) errors.push(`actors[${i}].id='${a.id}' is duplicated; ids must be unique`);
        seen.add(a.id);
      }
    });
  }
  const ids = new Set(Array.isArray(actors) ? actors.map((a) => a?.id).filter((x) => typeof x === 'string') : []);
  const messages = manifest.messages;
  if (messages !== undefined && !Array.isArray(messages)) {
    errors.push('sequence.messages must be an array if provided');
  } else if (Array.isArray(messages)) {
    messages.forEach((m, i) => {
      if (!m || typeof m !== 'object') { errors.push(`messages[${i}] must be an object`); return; }
      for (const k of ['from', 'to']) {
        if (!m[k] || typeof m[k] !== 'string') errors.push(`messages[${i}].${k} is required (string)`);
        else if (!ids.has(m[k])) errors.push(`messages[${i}].${k}='${m[k]}' does not match any actor id`);
      }
      if (m.label !== undefined && typeof m.label !== 'string') errors.push(`messages[${i}].label must be a string if provided`);
      if (m.kind !== undefined && !SEQUENCE_MSG_KINDS.has(m.kind)) {
        errors.push(`messages[${i}].kind must be one of: sync, async, return (got '${m.kind}')`);
      }
      if (m.activate !== undefined && typeof m.activate !== 'boolean') errors.push(`messages[${i}].activate must be a boolean if provided`);
    });
  }
  return errors;
}

export function expandSequence(manifest) {
  if (!manifest || typeof manifest !== 'object' || manifest.kind !== 'sequence') return manifest;

  const errors = validateSequenceSpec(manifest);
  if (errors.length) {
    throw new Error(`Invalid sequence manifest:\n - ${errors.join('\n - ')}`);
  }

  const actors = manifest.actors;
  const messages = Array.isArray(manifest.messages) ? manifest.messages : [];

  // Layout metrics (px).
  const marginX = 60, colStep = 170, headerW = 130, headerH = 30;
  const top = 30, gapAfterHeader = 12, rowH = 42, bottomPad = 34;
  const colX = actors.map((_, i) => marginX + headerW / 2 + i * colStep);
  const idx = new Map(actors.map((a, i) => [a.id, i]));
  const lifeTop = top + headerH;
  const msgTop = lifeTop + gapAfterHeader + rowH;
  const msgY = messages.map((_, k) => msgTop + k * rowH);
  const lifeBottom = (messages.length ? msgY[msgY.length - 1] : msgTop) + Math.round(rowH * 0.6);
  const width = (colX.length ? colX[colX.length - 1] : marginX) + headerW / 2 + marginX;
  const height = lifeBottom + bottomPad;

  const INK = 'var(--text-primary)';
  const MUTED = 'var(--text-muted)';
  const ACCENT = 'var(--brand-teal)';

  const lifelines = [];
  const headers = [];
  actors.forEach((a, i) => {
    lifelines.push({ kind: 'line', x1: colX[i], y1: lifeTop, x2: colX[i], y2: lifeBottom, stroke: MUTED, strokeWidth: 1, dash: '3 4' });
    headers.push({ kind: 'rect', x: colX[i] - headerW / 2, y: top, w: headerW, h: headerH, rx: 6, fill: 'rgba(20,184,166,0.08)', stroke: ACCENT, strokeWidth: 1.3 });
    headers.push({ kind: 'text', x: colX[i], y: top + 20, value: a.label, size: 12, anchor: 'middle', weight: 600, color: ACCENT });
  });

  // Activation bars: a message with `activate` opens a bar on its receiver that
  // closes at that receiver's next OUTGOING message (its response), else at the
  // lifeline bottom.
  const activations = [];
  messages.forEach((m, k) => {
    if (!m.activate) return;
    const actor = m.to;
    let endY = lifeBottom;
    for (let j = k + 1; j < messages.length; j++) {
      if (messages[j].from === actor) { endY = msgY[j]; break; }
    }
    const i = idx.get(actor);
    activations.push({ kind: 'rect', x: colX[i] - 5, y: msgY[k], w: 10, h: Math.max(6, endY - msgY[k]), fill: 'rgba(20,184,166,0.18)', stroke: ACCENT, strokeWidth: 0.8 });
  });

  const lines = [];
  const labels = [];
  messages.forEach((m, k) => {
    const fi = idx.get(m.from), ti = idx.get(m.to);
    const y = msgY[k];
    const dashed = m.kind === 'return';
    if (m.from === m.to) {
      // Self-message: a loopback to the right of the lifeline.
      const x = colX[fi];
      lines.push({ kind: 'polyline', points: [[x, y - 6], [x + 34, y - 6], [x + 34, y + 12], [x, y + 12]], stroke: INK, strokeWidth: 1.4, head: 'arrow', ...(dashed ? { dash: '5 4' } : {}) });
      if (m.label) labels.push({ kind: 'text', x: x + 40, y: y - 2, value: m.label, size: 11, anchor: 'start', color: INK });
    } else {
      lines.push({ kind: 'line', x1: colX[fi], y1: y, x2: colX[ti], y2: y, stroke: INK, strokeWidth: 1.4, head: 'arrow', ...(dashed ? { dash: '5 4' } : {}) });
      if (m.label) labels.push({ kind: 'text', x: (colX[fi] + colX[ti]) / 2, y: y - 6, value: m.label, size: 11, anchor: 'middle', color: INK });
    }
  });

  // Paint order: lifelines (back) → activation bars → message lines → headers →
  // labels (front). Any author-supplied marks ride on top.
  const lowered = [...lifelines, ...activations, ...lines, ...headers, ...labels];
  const existing = Array.isArray(manifest.marks) ? manifest.marks : [];
  return { ...manifest, viewBox: { width, height }, marks: [...lowered, ...existing] };
}


// ── Gantt lowering (P5 — diagram-patterns-spike.plan.md) ─────────────────────
//
// A `kind:'gantt'` manifest is a { scale, tasks } spec on a NUMERIC domain
// (weeks/days/sprints — the author maps real dates to numbers; date-string
// parsing is a documented follow-up). Lowered to rect bars on a hand-computed
// value→x scale + a tick axis, all plain marks. No-op for every other kind.
function validateGanttSpec(manifest) {
  const errors = [];
  const scale = manifest.scale;
  if (!scale || typeof scale !== 'object' || Array.isArray(scale)) {
    errors.push('gantt.scale must be an object { start, end, unit? }');
  } else {
    if (!isFiniteNumber(scale.start)) errors.push('gantt.scale.start must be a finite number');
    if (!isFiniteNumber(scale.end)) errors.push('gantt.scale.end must be a finite number');
    if (isFiniteNumber(scale.start) && isFiniteNumber(scale.end) && scale.end <= scale.start) {
      errors.push('gantt.scale.end must be greater than scale.start');
    }
    if (scale.unit !== undefined && typeof scale.unit !== 'string') errors.push('gantt.scale.unit must be a string if provided');
  }
  const tasks = manifest.tasks;
  if (!Array.isArray(tasks) || tasks.length === 0) {
    errors.push('gantt.tasks must be a non-empty array of { label, start, end }');
  } else {
    tasks.forEach((t, i) => {
      if (!t || typeof t !== 'object') { errors.push(`tasks[${i}] must be an object`); return; }
      if (!t.label || typeof t.label !== 'string') errors.push(`tasks[${i}].label is required (string)`);
      if (!isFiniteNumber(t.start)) errors.push(`tasks[${i}].start must be a finite number`);
      if (!isFiniteNumber(t.end)) errors.push(`tasks[${i}].end must be a finite number`);
      if (isFiniteNumber(t.start) && isFiniteNumber(t.end) && t.end < t.start) errors.push(`tasks[${i}].end must be >= start`);
      if (t.lane !== undefined && typeof t.lane !== 'string') errors.push(`tasks[${i}].lane must be a string if provided`);
    });
  }
  return errors;
}

export function expandGantt(manifest) {
  if (!manifest || typeof manifest !== 'object' || manifest.kind !== 'gantt') return manifest;
  const errors = validateGanttSpec(manifest);
  if (errors.length) throw new Error(`Invalid gantt manifest:\n - ${errors.join('\n - ')}`);

  const tasks = manifest.tasks;
  const { start, end, unit } = manifest.scale;
  const labelW = 170, gutter = 20, chartW = 560;
  const x0 = labelW + gutter, x1 = x0 + chartW;
  const top = 60, rowH = 40, barH = 22, barPad = (rowH - barH) / 2;
  const width = x1 + 30;
  const height = top + tasks.length * rowH + 24;
  const wx = (v) => x0 + ((v - start) / (end - start)) * (x1 - x0);

  const MUTED = 'var(--text-muted)';
  const INK = 'var(--text-primary)';
  const ACCENT = 'var(--brand-teal)';

  // Axis: integer-ish ticks across the domain (coarser as the span grows).
  const span = end - start;
  const step = span <= 12 ? 1 : Math.ceil(span / 10);
  const grid = [];
  const axisBottom = top + tasks.length * rowH;
  for (let t = Math.ceil(start); t <= end + 1e-9; t += step) {
    grid.push({ kind: 'line', x1: wx(t), y1: top - 8, x2: wx(t), y2: axisBottom, stroke: MUTED, strokeWidth: 1, opacity: 0.3 });
    grid.push({ kind: 'text', x: wx(t), y: top - 14, value: `${unit || ''}${t}`, size: 10, anchor: 'middle', color: MUTED });
  }

  const bars = [];
  tasks.forEach((t, i) => {
    const y = top + i * rowH;
    bars.push({ kind: 'text', x: 24, y: y + barPad + 15, value: t.label, size: 12, anchor: 'start', color: INK });
    bars.push({ kind: 'rect', x: wx(t.start), y: y + barPad, w: Math.max(2, wx(t.end) - wx(t.start)), h: barH, rx: 5, fill: ACCENT, opacity: 0.6, stroke: ACCENT, strokeWidth: 1 });
  });

  const existing = Array.isArray(manifest.marks) ? manifest.marks : [];
  return { ...manifest, viewBox: { width, height }, marks: [...grid, ...bars, ...existing] };
}


// ── Swimlane lowering (P2 — diagram-patterns-spike.plan.md) ──────────────────
//
// A MODIFIER (not a kind): a diagram carrying `lanes:[{id,label}]` + `station.lane`
// (+ optional `station.col`) is partitioned into labeled actor lanes. The lowering
// emits a band rect per lane (behind, via z:-1) and PINS each laned station's
// coordinates — cross-axis to its lane, along-axis by `col` — so the author never
// hand-places boxes. Edges are left to the existing router. No-op with no lanes[].
function validateSwimlaneSpec(manifest) {
  const errors = [];
  const lanes = manifest.lanes;
  if (!Array.isArray(lanes) || lanes.length === 0) {
    errors.push('lanes must be a non-empty array of { id, label }');
    return { errors, laneIndex: new Map() };
  }
  const laneIndex = new Map();
  lanes.forEach((l, i) => {
    if (!l || typeof l !== 'object') { errors.push(`lanes[${i}] must be an object`); return; }
    if (!l.id || typeof l.id !== 'string') errors.push(`lanes[${i}].id is required (string)`);
    if (!l.label || typeof l.label !== 'string') errors.push(`lanes[${i}].label is required (string)`);
    if (typeof l.id === 'string') {
      if (laneIndex.has(l.id)) errors.push(`lanes[${i}].id='${l.id}' is duplicated; ids must be unique`);
      laneIndex.set(l.id, i);
    }
  });
  const stations = Array.isArray(manifest.stations) ? manifest.stations : [];
  stations.forEach((s, i) => {
    if (s && s.lane !== undefined) {
      if (typeof s.lane !== 'string' || !laneIndex.has(s.lane)) errors.push(`stations[${i}].lane='${s?.lane}' does not match any lane id`);
      if (s.col !== undefined && !isFiniteNumber(s.col)) errors.push(`stations[${i}].col must be a finite number if provided`);
    } else if (s && !isFiniteNumber(s.x)) {
      errors.push(`stations[${i}] must carry a lane (or explicit x/y) in a swimlane diagram`);
    }
  });
  return { errors, laneIndex };
}

export function expandSwimlanes(manifest) {
  if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.lanes) || manifest.lanes.length === 0) {
    return manifest;
  }
  const { errors, laneIndex } = validateSwimlaneSpec(manifest);
  if (errors.length) throw new Error(`Invalid swimlane manifest:\n - ${errors.join('\n - ')}`);

  const lanes = manifest.lanes;
  const stations = Array.isArray(manifest.stations) ? manifest.stations : [];
  const marginX = 130, colStep = 180, stationW = 130, stationH = 52;
  const laneTop = 50, laneH = 110;
  const cols = stations.map((s) => (isFiniteNumber(s.col) ? Math.floor(s.col) : 0));
  const maxCol = cols.length ? Math.max(...cols) : 0;
  const width = marginX + maxCol * colStep + stationW + 40;
  const height = laneTop + lanes.length * laneH + 20;

  const MUTED = 'var(--text-muted)';
  const INK = 'var(--text-primary)';

  const bands = [];
  lanes.forEach((l, i) => {
    const y = laneTop + i * laneH;
    bands.push({ kind: 'rect', x: 0, y, w: width, h: laneH, z: -1, fill: i % 2 ? 'rgba(99,102,120,0.10)' : 'rgba(99,102,120,0.04)', stroke: 'rgba(99,102,120,0.35)', strokeWidth: 1 });
    bands.push({ kind: 'text', x: 12, y: y + 20, value: l.label, size: 12, anchor: 'start', weight: 600, color: INK, z: -1 });
  });

  const nextStations = stations.map((s, i) => {
    if (s.lane === undefined) return s;
    const li = laneIndex.get(s.lane);
    const col = isFiniteNumber(s.col) ? Math.floor(s.col) : 0;
    const { lane, col: _c, ...rest } = s;
    return {
      ...rest,
      x: isFiniteNumber(s.x) ? s.x : marginX + col * colStep,
      y: isFiniteNumber(s.y) ? s.y : laneTop + li * laneH + (laneH - stationH) / 2,
      w: isFiniteNumber(s.w) ? s.w : stationW,
      h: isFiniteNumber(s.h) ? s.h : stationH,
    };
  });

  const existing = Array.isArray(manifest.marks) ? manifest.marks : [];
  return { ...manifest, viewBox: { width, height }, stations: nextStations, marks: [...bands, ...existing] };
}


// The single diagram-kind lowering pass both mint paths run before grid
// expansion. Each step no-ops unless its trigger is present, so ordering is
// free; kept in ONE place so mint_diagram and create_sketch can't drift.
export function lowerDiagramKinds(manifest) {
  return expandSwimlanes(expandGantt(expandSequence(manifest)));
}


// ── Boundary lowering (P4 containment / C4 — diagram-patterns-spike.plan.md) ──
//
// A diagram carrying `boundaries:[{label?, contains:[stationIds], style?}]` gets
// a labeled dashed box drawn BEHIND each group, auto-sized to wrap its members +
// padding. Unlike the other lowerings this runs AFTER grid/swimlane expansion —
// it reads the members' RESOLVED x/y/w/h to compute the bbox. No-op with no
// boundaries[]. It only APPENDS marks (never moves a station), so it composes
// with every other kind. Edge routing is unchanged — obstacle-avoiding routing
// that respects a boundary is a separate, general router follow-up.
export function expandBoundaries(manifest) {
  if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.boundaries) || manifest.boundaries.length === 0) {
    return manifest;
  }
  const stations = Array.isArray(manifest.stations) ? manifest.stations : [];
  const byId = new Map(stations.map((s) => [s.id, s]));
  const errors = [];
  const boundaries = manifest.boundaries;
  boundaries.forEach((b, i) => {
    if (!b || typeof b !== 'object' || Array.isArray(b)) { errors.push(`boundaries[${i}] must be an object`); return; }
    if (b.label !== undefined && typeof b.label !== 'string') errors.push(`boundaries[${i}].label must be a string if provided`);
    if (!Array.isArray(b.contains) || b.contains.length === 0) {
      errors.push(`boundaries[${i}].contains must be a non-empty array of station ids`);
    } else {
      b.contains.forEach((id) => {
        const s = byId.get(id);
        if (!s) errors.push(`boundaries[${i}].contains id '${id}' does not match any station`);
        else if (![s.x, s.y, s.w, s.h].every(isFiniteNumber)) errors.push(`boundaries[${i}] member '${id}' has no resolved coordinates (place it, or give it a lane/cell)`);
      });
    }
    if (b.style !== undefined && (!b.style || typeof b.style !== 'object' || Array.isArray(b.style))) {
      errors.push(`boundaries[${i}].style must be an object if provided`);
    }
  });
  if (errors.length) throw new Error(`Invalid boundaries:\n - ${errors.join('\n - ')}`);

  const PAD = 16, LABEL_H = 22;
  const bands = [];
  boundaries.forEach((b) => {
    const members = b.contains.map((id) => byId.get(id));
    const minX = Math.min(...members.map((s) => s.x));
    const minY = Math.min(...members.map((s) => s.y));
    const maxX = Math.max(...members.map((s) => s.x + s.w));
    const maxY = Math.max(...members.map((s) => s.y + s.h));
    const style = b.style || {};
    const labelH = b.label ? LABEL_H : 0;
    const x = minX - PAD, y = minY - PAD - labelH;
    const w = maxX - minX + 2 * PAD, h = maxY - minY + 2 * PAD + labelH;
    // z:-2 sits behind swimlane bands (z:-1) and stations (0). Translucent so an
    // edge (painted below all drawables) still reads through the fill.
    bands.push({ kind: 'rect', x, y, w, h, rx: 12, z: -2, fill: style.fill || 'rgba(99,102,120,0.05)', stroke: style.stroke || 'var(--text-muted)', strokeWidth: 1.4, dash: style.dash || '7 5' });
    if (b.label) bands.push({ kind: 'text', x: x + 12, y: y + 16, value: b.label, size: 12, anchor: 'start', weight: 600, color: 'var(--text-secondary)', z: -2 });
  });
  const existing = Array.isArray(manifest.marks) ? manifest.marks : [];
  return { ...manifest, marks: [...bands, ...existing] };
}
