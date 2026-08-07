/**
 * Slot layout for one Connected Service graph. Mirrors the app graph posture:
 * small deterministic topology, compact renderer, derived fresh on read.
 */

const MARGIN = 24;
const COL_W = 180;
const H_GAP = 88;
const V_GAP = 18;

const COLS = {
  left: MARGIN,
  center: MARGIN + COL_W + H_GAP,
  right: MARGIN + (COL_W + H_GAP) * 2,
};

const SLOTS = {
  need: { col: 'left', y: 34, stack: true },
  catalyst: { col: 'left', y: 34, stack: true },
  component: { col: 'left', y: 34, stack: true },
  host: { col: 'center', y: 34, stack: true },
  composition: { col: 'center', y: 34, stack: true },
  service: { col: 'center', y: 134, stack: false },
  call: { col: 'right', y: 34, stack: true },
};

const ROLE_ORDER = ['host', 'composition', 'service', 'need', 'catalyst', 'component', 'call'];

const EDGE_VIA = {
  'service:call': 'right',
  'need:service': 'left',
  'catalyst:service': 'left',
  'component:composition': 'left',
};

function nodeHeight(node) {
  const items = node.items?.length || 0;
  return Math.max(56, 40 + items * 13 + 8);
}

function slotFor(role) {
  return SLOTS[role] || { col: 'center', y: 240, stack: true };
}

function viaFor(fromRole, toRole) {
  return EDGE_VIA[`${fromRole}:${toRole}`];
}

export function layoutConnectedService(topology) {
  if (!topology) throw new Error('layoutConnectedService requires a topology');
  const { title, nodes = [], edges = [] } = topology;
  if (nodes.length === 0) throw new Error('layoutConnectedService requires nodes');

  const grouped = new Map();
  for (const n of nodes) {
    const list = grouped.get(n.role) || [];
    list.push(n);
    grouped.set(n.role, list);
  }

  const positioned = [];
  const roleById = new Map();
  let bottom = 0;

  const roles = [
    ...ROLE_ORDER.filter((role) => grouped.has(role)),
    ...[...grouped.keys()].filter((role) => !ROLE_ORDER.includes(role)),
  ];
  const cursorByColumn = new Map();

  for (const role of roles) {
    const list = grouped.get(role) || [];
    const slot = slotFor(role);
    const cursorKey = slot.col;
    let y = slot.stack ? (cursorByColumn.get(cursorKey) ?? slot.y) : slot.y;
    for (const node of list) {
      const h = nodeHeight(node);
      positioned.push({ ...node, x: COLS[slot.col], y, w: COL_W, h });
      roleById.set(node.id, role);
      bottom = Math.max(bottom, y + h);
      y += h + V_GAP;
      if (!slot.stack) break;
    }
    if (slot.stack) cursorByColumn.set(cursorKey, y);
  }

  const enrichedEdges = edges.map((e) => {
    if (e.via) return e;
    const via = viaFor(roleById.get(e.from), roleById.get(e.to));
    return via ? { ...e, via } : e;
  });

  return {
    title,
    viewBox: {
      width: COLS.right + COL_W + MARGIN,
      height: Math.max(260, bottom + MARGIN),
    },
    stations: positioned.map(({ role, ...rest }) => rest),
    edges: enrichedEdges,
  };
}
