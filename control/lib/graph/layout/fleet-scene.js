/**
 * layoutFleetScene — purpose-built layout for the fleet scene.
 *
 * The app `lib/graph/layout.js` SLOTS table is app-specific (fixed roles) and
 * won't fit unbounded N servers / M services / K apps+bots, so this is its own
 * pass. It lays one horizontal row per node category, stacked top→bottom:
 *
 *   servers    ← air block (lifted; renderer keys elevation off `layer`)
 *   services   ←
 *      · · · · · · band gap · · · · · ·
 *   apps       ← ground block (flat)
 *   bots       ←
 *
 * Each row is centered, so a row with fewer items reads as indented under a
 * wider one. Empty categories are skipped (no blank row). Edges connect across
 * rows as needed: `exposes` (app → its sidecar server), `calls` (service →
 * server). Air rows carry `layer:'air'` so the renderer lifts them.
 *
 * Output is the sketch-manifest shape {title, viewBox, stations, edges} —
 * `validateSketchManifest` tolerates the extra `layer`/`href` station fields.
 * A cross-row edge can pass over an intervening row in dense fleets; that's a
 * deliberate v1 simplification. See
 * lite-template/integration/app-system/0528/fleet-scene/FLEET_SCENE_PLAN.md.
 */

const MARGIN = 24;
const COL_W = 156;
const H_GAP = 56;
const PITCH = COL_W + H_GAP;
const ROW_GAP = 56; // between rows within the same plane
const BAND_GAP = 88; // between the air block and the ground block
// Cap a row's width so the scene fits a typical screen without horizontal
// scroll most of the time; a category with more nodes than fit wraps onto
// additional sub-rows of the same kind.
const MAX_ROW_WIDTH = 1120;

// Top→bottom row order. Air categories lead, ground categories trail; anything
// the deriver emits outside this set is appended at the end so no node is lost.
const ROW_ORDER = ['server', 'service', 'app', 'bot'];

function nodeHeight(node) {
  // Compact font preset: label + sublabel band ≈ 40; each bullet 13; +6 pad.
  const items = node.items?.length || 0;
  if (items === 0) return 48;
  return 40 + items * 13 + 6;
}

function rowWidth(count) {
  return count > 0 ? (count - 1) * PITCH + COL_W : 0;
}

// Largest column count whose row still fits within MAX_ROW_WIDTH (at least 1).
function maxColsForWidth() {
  let n = 1;
  while (rowWidth(n + 1) <= MAX_ROW_WIDTH) n += 1;
  return n;
}

export function layoutFleetScene(topology) {
  if (!topology) throw new Error('layoutFleetScene requires a topology');
  const { title, nodes, edges = [] } = topology;
  if (!Array.isArray(nodes) || nodes.length === 0) {
    throw new Error('layoutFleetScene requires at least one node');
  }

  const byRole = new Map();
  for (const n of nodes) {
    if (!byRole.has(n.role)) byRole.set(n.role, []);
    byRole.get(n.role).push(n);
  }
  const orderedRoles = [
    ...ROW_ORDER.filter((r) => byRole.get(r)?.length),
    ...[...byRole.keys()].filter((r) => !ROW_ORDER.includes(r)),
  ];
  // Expand each category into one or more capped lines (wrap when it overflows
  // the screen-width budget). Each line keeps its role + layer so gap + lift
  // logic still apply per plane.
  const maxCols = maxColsForWidth();
  const lines = [];
  for (const role of orderedRoles) {
    const group = byRole.get(role);
    for (let i = 0; i < group.length; i += maxCols) {
      lines.push({ layer: group[i].layer, nodes: group.slice(i, i + maxCols) });
    }
  }

  const contentWidth = Math.max(...lines.map((line) => rowWidth(line.nodes.length)));

  const positioned = [];
  let cursorY = MARGIN;
  lines.forEach((line, idx) => {
    const w = rowWidth(line.nodes.length);
    const startX = MARGIN + (contentWidth - w) / 2;
    const rowH = Math.max(...line.nodes.map(nodeHeight));
    line.nodes.forEach((node, i) => {
      positioned.push(station(node, startX + i * PITCH, cursorY, nodeHeight(node)));
    });

    const next = lines[idx + 1];
    if (next) {
      // Bigger gap when crossing the air↔ground boundary; tight rows within a plane.
      const crossing = line.layer !== next.layer;
      cursorY += rowH + (crossing ? BAND_GAP : ROW_GAP);
    } else {
      cursorY += rowH;
    }
  });

  const rightEdge = positioned.reduce((acc, s) => Math.max(acc, s.x + s.w), 0);
  const bottomEdge = positioned.reduce((acc, s) => Math.max(acc, s.y + s.h), 0);

  return {
    title: title || 'Fleet',
    viewBox: { width: rightEdge + MARGIN, height: bottomEdge + MARGIN },
    stations: positioned,
    edges,
  };
}

function station(node, x, y, h) {
  const s = {
    id: node.id,
    kind: node.kind,
    label: node.label,
    x,
    y,
    w: COL_W,
    h,
    layer: node.layer,
  };
  if (node.sublabel) s.sublabel = node.sublabel;
  if (node.items && node.items.length) s.items = node.items;
  if (node.href) s.href = node.href;
  return s;
}
