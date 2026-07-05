/**
 * operator-world — the FIRST bridge from the main MCP's live state into a walkable world.
 *
 * mojulo's worlds have so far been self-contained recipes (a seed → a city). This primitive is the
 * opposite direction: it takes a PERSISTED REPRESENTATION OF THE OPERATOR'S STATE — the Connected
 * Services union view (skills + materialized mcp-orbit solutions, each with the MCP servers it calls
 * and the capabilities it still needs) — and lays it out as a place you can walk.
 *
 * Two layers, deliberately split so each stays testable and the substrate invariant holds (the stored
 * manifest is a tiny recipe; geometry is regenerated on render):
 *   1. projectOperatorWorld(services) — the WIRING. Live state → a semantic graph { nodes, edges }
 *      with 2D positions. This is what the `create_operator_world` tool bakes into the manifest; it is
 *      the moment the main MCP hands context to a world. Pure (takes the already-loaded service list).
 *   2. assembleOperatorWorldScene(manifest) — the GEOMETRY. The stored graph → ground + sky + blocks,
 *      in the same { faces, cameras, viewBox, bg } payload every other assemble*Scene returns. Pure.
 *
 * v1 vocabulary is deliberately basic (blocks on a checker floor — "ground and sky" from the original
 * world) so we can prove the data wires end-to-end before iterating on the look. See operator-world.plan.md.
 *
 * Node types:
 *   - service — a Connected Service (skill or mcp_solution). One block per service. Always "present".
 *   - mcp     — an MCP server a service calls, OR an unbound capability a service still `needs`. Present
 *               servers (wired in the operator's inventory) stand tall and lit; missing servers / needs
 *               are the visible WIRING GAPS — short and dim.
 * Edges are service → mcp calls: a lit ribbon when the call is wired, a dim one when it dangles.
 *
 * World convention (shared with controllable-world / fractal-city): z-up, ground at z=0.
 */

// ── layout constants ──
const STEP = 6;       // spacing between sibling blocks along a row
const ROW = 13;       // half-distance between the service row (y<0) and the mcp row (y>0)

// ── block + edge styling, keyed by node type/state (kept here so the manifest stays lean) ──
const STYLE = {
  service: { w: 2.4, d: 2.4, h: 2.6, top: '#3aa0ad', side: '#2b7681' },
  mcpOn: { w: 2.6, d: 2.6, h: 3.6, top: '#e0b352', side: '#b7893a' },
  mcpOff: { w: 2.2, d: 2.2, h: 1.2, top: '#4a4f5c', side: '#363b45' },
};
const EDGE_ON = '#57d6bf';
const EDGE_OFF = '#464b57';
const GROUND_A = '#20283a';
const GROUND_B = '#283148';

function styleFor(node) {
  if (node.type === 'service') return STYLE.service;
  return node.present ? STYLE.mcpOn : STYLE.mcpOff;
}

/**
 * projectOperatorWorld(services) → { nodes, edges }
 *
 * `services` is the Connected Services union list (loader.listConnectedServices().services): each
 * `{ ref, kind, name, calls:[{server, present}], needs:[{capability, label}] }`. Distinct MCP servers
 * (and unbound needs) are collected in first-seen order and laid out on a back row; services on a front
 * row. Deterministic given the same list, so re-minting is stable.
 */
export function projectOperatorWorld(services = []) {
  const svc = Array.isArray(services) ? services : [];

  // Collect the distinct MCP targets (real servers + `need` capability stubs) in stable first-seen order.
  const targetOrder = [];
  const targetMeta = new Map(); // key → { present, label }
  const seeTarget = (key, meta) => {
    if (!targetMeta.has(key)) {
      targetMeta.set(key, { present: !!meta.present, label: meta.label || key });
      targetOrder.push(key);
    } else if (meta.present) {
      targetMeta.get(key).present = true; // a server present in ANY call is present
    }
  };
  for (const s of svc) {
    for (const c of s.calls || []) {
      const server = String(c.server);
      seeTarget(`srv:${server}`, { present: c.present, label: server });
    }
    for (const n of s.needs || []) {
      const cap = n.capability || n.label;
      if (!cap) continue;
      seeTarget(`need:${cap}`, { present: false, label: n.label || cap });
    }
  }

  const nodes = [];

  // Service row (front, y = -ROW), centred on x = 0.
  svc.forEach((s, i) => {
    const x = (i - (svc.length - 1) / 2) * STEP;
    nodes.push({ id: `svc:${s.ref}`, type: 'service', label: s.name || s.ref, present: true, at: [x, -ROW] });
  });

  // MCP row (back, y = +ROW).
  targetOrder.forEach((key, i) => {
    const x = (i - (targetOrder.length - 1) / 2) * STEP;
    const meta = targetMeta.get(key);
    nodes.push({ id: `mcp:${key}`, type: 'mcp', label: meta.label, present: meta.present, at: [x, ROW] });
  });

  // Edges: every service→target call, plus service→need dangles.
  const edges = [];
  for (const s of svc) {
    for (const c of s.calls || []) {
      edges.push({ from: `svc:${s.ref}`, to: `mcp:srv:${String(c.server)}`, present: !!c.present });
    }
    for (const n of s.needs || []) {
      const cap = n.capability || n.label;
      if (!cap) continue;
      edges.push({ from: `svc:${s.ref}`, to: `mcp:need:${cap}`, present: false });
    }
  }

  return { nodes, edges };
}

// ── geometry helpers (z-up, ground at z=0) ──

// Six-ish quad faces for an axis-aligned block centred at (cx,cy), base on the ground. The bottom face
// is omitted (it sits on the floor, never seen); top gets the lighter `top` colour, the four walls the
// darker `side` colour, so the block reads as solid even before scene lighting.
function boxFaces(cx, cy, w, d, h, top, side) {
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - d / 2, y1 = cy + d / 2, z1 = h;
  return [
    { corners: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], fill: top, doubleSided: true },
    { corners: [[x0, y0, 0], [x1, y0, 0], [x1, y0, z1], [x0, y0, z1]], fill: side, doubleSided: true },
    { corners: [[x0, y1, 0], [x1, y1, 0], [x1, y1, z1], [x0, y1, z1]], fill: side, doubleSided: true },
    { corners: [[x0, y0, 0], [x0, y1, 0], [x0, y1, z1], [x0, y0, z1]], fill: side, doubleSided: true },
    { corners: [[x1, y0, 0], [x1, y1, 0], [x1, y1, z1], [x1, y0, z1]], fill: side, doubleSided: true },
  ];
}

// A thin flat ribbon on the ground from a→b (both [x,y]), a hair above z=0 to avoid z-fighting the floor.
function ribbonFace(a, b, halfW, z, color) {
  let dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  dx /= len; dy /= len;
  const px = -dy * halfW, py = dx * halfW;
  return {
    corners: [[a[0] + px, a[1] + py, z], [b[0] + px, b[1] + py, z], [b[0] - px, b[1] - py, z], [a[0] - px, a[1] - py, z]],
    fill: color,
    doubleSided: true,
  };
}

// Two-tone checker floor covering ±size/2 in x and y.
function groundFaces(size, cell, spec = {}) {
  const a = spec.colorA || GROUND_A, b = spec.colorB || GROUND_B;
  const n = Math.max(2, Math.round(size / cell));
  const faces = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const x = -size / 2 + i * cell, y = -size / 2 + j * cell;
      faces.push({ corners: [[x, y, 0], [x + cell, y, 0], [x + cell, y + cell, 0], [x, y + cell, 0]], fill: (i + j) % 2 ? a : b, doubleSided: true });
    }
  }
  return faces;
}

/**
 * assembleOperatorWorldScene(manifest, opts) → payload for emitThreeWorld.
 *
 * Pure geometry from the stored graph: a checker floor sized to the layout, edge ribbons, then a block
 * per node. Returns the same shape as assembleControllableScene ({ faces, cameras, viewBox, title, bg })
 * plus `walk:true` so it opens first-person. Renders fine when nodes is empty (bare floor).
 */
export function assembleOperatorWorldScene(manifest = {}, opts = {}) {
  const nodes = Array.isArray(manifest.nodes) ? manifest.nodes : [];
  const edges = Array.isArray(manifest.edges) ? manifest.edges : [];
  const posById = new Map(nodes.map((n) => [n.id, n.at]));

  let reach = 10;
  for (const n of nodes) {
    if (!Array.isArray(n.at)) continue;
    reach = Math.max(reach, Math.abs(n.at[0]), Math.abs(n.at[1]));
  }
  const size = Math.ceil((reach + 8) * 2 / 4) * 4;

  const faces = groundFaces(size, 4, manifest.ground || {});

  // Edges under the blocks (they sit on the floor).
  for (const e of edges) {
    const a = posById.get(e.from), b = posById.get(e.to);
    if (!a || !b) continue;
    faces.push(ribbonFace(a, b, 0.35, 0.03, e.present ? EDGE_ON : EDGE_OFF));
  }

  // Blocks.
  for (const n of nodes) {
    if (!Array.isArray(n.at)) continue;
    const st = styleFor(n);
    for (const f of boxFaces(n.at[0], n.at[1], st.w, st.d, st.h, st.top, st.side)) faces.push(f);
  }

  const framing = manifest.worldFraming || { cameraPosition: [0, -(reach + 20), 15], lookAt: [0, 0, 1.5], horizontalFov: 62 };
  return {
    faces,
    cameras: [{ worldFraming: framing }],
    viewBox: manifest.viewBox || { width: 1120, height: 780 },
    title: opts.title || manifest.title || 'operator world',
    bg: manifest.bg || '#0a0f1a',
    walk: true,
  };
}
