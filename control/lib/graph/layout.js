/**
 * Slot-based layout for derived topologies → sketch-manifest shape.
 *
 * The deriver returns nodes tagged with `role`; this function maps each role
 * to a known geometry slot and computes the viewBox to fit. New entity kinds
 * (MCPs, bots, compositions) extend the SLOTS table; nothing else changes.
 * When/if topologies get too varied for fixed slots, swap this file for a
 * dagre pass — the deriver returns the same { nodes, edges } shape either way.
 *
 * Density posture: this layout favors horizontal spread over vertical
 * stacking so the renderer can run in compact font mode behind a
 * horizontally-scrollable viewport. Boxes are intentionally smaller than
 * the canonical /graph; the trade-off is that more entities fit per row at
 * the cost of more `via` edge routing for long-haul connections.
 */

const MARGIN = 20;

// Minimum horizontal gap between adjacent columns. Edge labels render as
// pills centered on the edge midpoint, so any horizontal pill needs at
// least its own width of clear space between the two boxes — otherwise the
// pill overlaps the source or destination station. Worst-case label in
// this deriver is "fires (Nx)" → ≈80px at compact font size; round up so
// future label changes have headroom without re-tuning the grid.
const H_GAP = 96;
// Vertical gap between row 1 and row 2 needs to clear the pill height
// (~20 at compact). 38 gives the pill room to breathe between rows.
const V_GAP = 38;

// Column grid — left to right. Bindings spread across the bottom row
// rather than stacking right-side, so adding a 5th binding later means
// "add another column slot", not "make the right column taller". Row 2
// reuses row 1 column x-positions for vertical alignment.
const COLS = {
  triggers:    { x: 20,                                 w: 150 },
  artifact:    { x: 20 + 150 + H_GAP,                   w: 180 },
  mcp_self:    { x: 20 + 150 + H_GAP + 180 + H_GAP,     w: 140 },
  tools:       { x: 20 + 150 + H_GAP*2 + 180 + 140 + H_GAP, w: 210 },
  runner:      { x: 20 + 150 + H_GAP,                   w: 180 }, // under artifact
  durability:  { x: 20 + 150 + H_GAP + 180 + H_GAP,     w: 140 }, // under mcp_self
  inference:   { x: 20 + 150 + H_GAP*2 + 180 + 140 + H_GAP, w: 210 }, // under tools
  inferences:  { x: 20 + 150 + H_GAP*3 + 180 + 140 + 210 + H_GAP, w: 140 }, // far right, row 2
};

const ROW_1_Y = 24;
const ROW_1_MAX_H = 78; // tallest box in row 1 (artifact)
const ROW_2_Y = ROW_1_Y + ROW_1_MAX_H + V_GAP;

// Per-role geometry. Roles that may have multiple instances (e.g.
// `trigger`) stack with `gap` below `y` inside their column.
const SLOTS = {
  artifact:            { col: 'artifact',   y: ROW_1_Y, h: 78 },
  'binding-mcp-self':  { col: 'mcp_self',   y: ROW_1_Y, h: 64 },
  tools:               { col: 'tools',      y: ROW_1_Y, h: 'auto' },
  trigger:             { col: 'triggers',   y: ROW_1_Y, h: 60, stack: true, gap: 10 },
  'binding-runner':    { col: 'runner',     y: ROW_2_Y, h: 64 },
  'binding-durability':{ col: 'durability', y: ROW_2_Y, h: 64 },
  'binding-inference': { col: 'inference',  y: ROW_2_Y, h: 64 },
  inferences:          { col: 'inferences', y: ROW_2_Y, h: 64 },
};

// Long-haul edges that would otherwise pierce intermediate stations. Keyed
// by `<fromRole>:<toRole>` so adding a new derived edge means one entry
// rather than per-shape geometry math. `via: 'bottom'` is the safest
// channel because the bindings row sits in the middle vertically and a
// bottom-routed edge clears it cleanly.
const EDGE_VIA = {
  'artifact:binding-inference': 'bottom',
  'artifact:inferences':        'bottom',
};

function autoHeight(node) {
  // Compact font preset (post-bump): label band 18 + sublabel band 14 +
  // first-item baseline pad lands the next bullet at +46 with a sublabel,
  // 13px per additional bullet, +6 bottom margin.
  const items = node.items?.length || 0;
  return 40 + items * 13 + 6;
}

function viaForEdge(fromRole, toRole) {
  return EDGE_VIA[`${fromRole}:${toRole}`];
}

export function layout(topology) {
  if (!topology) throw new Error('layout requires a topology');
  const { nodes, edges, title } = topology;

  const byRole = new Map();
  for (const n of nodes) {
    const list = byRole.get(n.role) || [];
    list.push(n);
    byRole.set(n.role, list);
  }

  // Build node lookup by id alongside positioning so we can resolve
  // role-pair via routing without a second pass.
  const positioned = [];
  const roleById = new Map();
  let maxBottom = 0;

  for (const [role, group] of byRole) {
    const slot = SLOTS[role];
    if (!slot) {
      throw new Error(`layout: no slot defined for role '${role}'`);
    }
    const col = COLS[slot.col];
    let cursorY = slot.y;
    for (const node of group) {
      const h = slot.h === 'auto' ? autoHeight(node) : slot.h;
      positioned.push({ ...node, x: col.x, y: cursorY, w: col.w, h });
      roleById.set(node.id, role);
      cursorY += h + (slot.stack ? slot.gap : 0);
      if (cursorY > maxBottom) maxBottom = cursorY;
    }
  }

  const enrichedEdges = edges.map((e) => {
    if (e.via) return e;
    const v = viaForEdge(roleById.get(e.from), roleById.get(e.to));
    return v ? { ...e, via: v } : e;
  });

  // Width pinned to the rightmost column; height grows with trigger stack
  // depth. Subtracting role from station shape so we don't leak deriver
  // internals into the manifest schema the validator checks.
  const rightCol = Object.values(COLS).reduce((acc, c) => Math.max(acc, c.x + c.w), 0);
  const viewBoxWidth = rightCol + MARGIN;
  const viewBoxHeight = Math.max(maxBottom + MARGIN, 220);

  return {
    title,
    viewBox: { width: viewBoxWidth, height: viewBoxHeight },
    stations: positioned.map(({ role, ...rest }) => rest),
    edges: enrichedEdges,
  };
}
