/**
 * Derived visual diff for two sketch manifests.
 *
 * This stays deliberately pure: no DB, no MCP, no renderer dependency. The
 * MCP tool reads two sketches, calls this, then persists the returned manifest
 * through the normal sketchbook path.
 */

const HEADER_H = 64;
const GUTTER_W = 96;
const PAD = 4;

const COLORS = {
  added: '#22c55e',
  removed: '#ef4444',
  changed: '#f59e0b',
  moved: '#38bdf8',
  unchanged: '#64748b',
  pane: '#334155',
  text: '#e2e8f0',
  muted: '#94a3b8',
};

function finite(v, fallback = 0) {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function normalizeText(v) {
  return String(v || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function tokens(v) {
  const n = normalizeText(v);
  return n ? n.split(' ') : [];
}

function tokenSimilarity(a, b) {
  const aa = new Set(tokens(a));
  const bb = new Set(tokens(b));
  if (aa.size === 0 && bb.size === 0) return 1;
  if (aa.size === 0 || bb.size === 0) return 0;
  let inter = 0;
  for (const t of aa) if (bb.has(t)) inter += 1;
  return inter / (aa.size + bb.size - inter);
}

function centerBox(box) {
  return {
    x: finite(box.x) + finite(box.w) / 2,
    y: finite(box.y) + finite(box.h) / 2,
  };
}

function layoutSimilarity(a, b, leftViewBox, rightViewBox) {
  const ac = centerBox(a);
  const bc = centerBox(b);
  const ax = ac.x / Math.max(finite(leftViewBox.width, 1), 1);
  const ay = ac.y / Math.max(finite(leftViewBox.height, 1), 1);
  const bx = bc.x / Math.max(finite(rightViewBox.width, 1), 1);
  const by = bc.y / Math.max(finite(rightViewBox.height, 1), 1);
  const dist = Math.hypot(ax - bx, ay - by);
  return Math.max(0, 1 - dist / 0.75);
}

function stationScore(left, right, leftViewBox, rightViewBox) {
  if (!left || !right) return 0;
  const idScore = left.id && right.id && left.id === right.id ? 1 : 0;
  const kindScore = left.kind === right.kind ? 1 : 0.25;
  const labelScore = tokenSimilarity(left.label, right.label);
  const sublabelScore = tokenSimilarity(left.sublabel, right.sublabel);
  const positionScore = layoutSimilarity(left, right, leftViewBox, rightViewBox);
  return idScore * 0.45 + kindScore * 0.12 + labelScore * 0.28 + sublabelScore * 0.05 + positionScore * 0.1;
}

function markSignature(mark) {
  if (!mark || typeof mark !== 'object') return '';
  if (mark.kind === 'text') return `text:${normalizeText(mark.value)}`;
  return `${mark.kind}:${normalizeText(mark.fill)}:${normalizeText(mark.stroke)}`;
}

function markBox(mark) {
  if (!mark || typeof mark !== 'object') return null;
  switch (mark.kind) {
    case 'rect':
      return { x: finite(mark.x), y: finite(mark.y), w: finite(mark.w), h: finite(mark.h) };
    case 'circle':
      return {
        x: finite(mark.cx) - finite(mark.r),
        y: finite(mark.cy) - finite(mark.r),
        w: finite(mark.r) * 2,
        h: finite(mark.r) * 2,
      };
    case 'wedge':
      return {
        x: finite(mark.cx) - finite(mark.r),
        y: finite(mark.cy) - finite(mark.r),
        w: finite(mark.r) * 2,
        h: finite(mark.r) * 2,
      };
    case 'line': {
      const x1 = finite(mark.x1);
      const y1 = finite(mark.y1);
      const x2 = finite(mark.x2);
      const y2 = finite(mark.y2);
      return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
    }
    case 'polyline': {
      if (!Array.isArray(mark.points) || mark.points.length === 0) return null;
      const xs = mark.points.map((p) => finite(p?.[0]));
      const ys = mark.points.map((p) => finite(p?.[1]));
      return {
        x: Math.min(...xs),
        y: Math.min(...ys),
        w: Math.max(...xs) - Math.min(...xs),
        h: Math.max(...ys) - Math.min(...ys),
      };
    }
    case 'text':
      return {
        x: finite(mark.x) - 4,
        y: finite(mark.y) - finite(mark.size, 13),
        w: Math.max(32, String(mark.value || '').length * finite(mark.size, 13) * 0.62),
        h: finite(mark.size, 13) + 8,
      };
    default:
      return null;
  }
}

function markScore(left, right, leftViewBox, rightViewBox) {
  if (!left || !right || left.kind !== right.kind) return 0;
  const sig = markSignature(left) === markSignature(right) ? 0.45 : 0;
  const lb = markBox(left);
  const rb = markBox(right);
  const pos = lb && rb ? layoutSimilarity(lb, rb, leftViewBox, rightViewBox) * 0.25 : 0;
  const body = JSON.stringify({ ...left, z: undefined }) === JSON.stringify({ ...right, z: undefined }) ? 0.3 : 0;
  return sig + pos + body;
}

function greedyMatch(leftItems, rightItems, scoreFn, minScore) {
  const pairs = [];
  const usedRight = new Set();

  for (let li = 0; li < leftItems.length; li += 1) {
    const left = leftItems[li];
    let best = null;
    for (let ri = 0; ri < rightItems.length; ri += 1) {
      if (usedRight.has(ri)) continue;
      const score = scoreFn(left, rightItems[ri]);
      if (score >= minScore && (!best || score > best.score)) {
        best = { li, ri, score };
      }
    }
    if (best) {
      usedRight.add(best.ri);
      pairs.push(best);
    }
  }

  const matchedLeft = new Set(pairs.map((p) => p.li));
  return {
    pairs,
    removed: leftItems.map((_, i) => i).filter((i) => !matchedLeft.has(i)),
    added: rightItems.map((_, i) => i).filter((i) => !usedRight.has(i)),
  };
}

function sameArray(a, b) {
  return JSON.stringify(a || []) === JSON.stringify(b || []);
}

function stationChangeKinds(left, right) {
  const changes = [];
  if (left.kind !== right.kind) changes.push('kind');
  if ((left.label || '') !== (right.label || '')) changes.push('label');
  if ((left.sublabel || '') !== (right.sublabel || '')) changes.push('sublabel');
  if (!sameArray(left.items, right.items)) changes.push('items');
  if (
    finite(left.x) !== finite(right.x) ||
    finite(left.y) !== finite(right.y) ||
    finite(left.w) !== finite(right.w) ||
    finite(left.h) !== finite(right.h)
  ) {
    changes.push('geometry');
  }
  return changes;
}

function edgeKey(edge, stationMap) {
  const from = stationMap.get(edge.from) ?? edge.from;
  const to = stationMap.get(edge.to) ?? edge.to;
  return `${from}->${to}:${normalizeText(edge.label)}:${edge.via || ''}`;
}

function compareEdges(leftEdges, rightEdges, leftPairs) {
  const leftToRight = new Map();
  for (const p of leftPairs) leftToRight.set(p.left.id, p.right.id);
  const rightIdentity = new Map((rightEdges || []).flatMap((e) => [[e.from, e.from], [e.to, e.to]]));
  const leftKeys = new Map();
  const rightKeys = new Map();
  for (const e of leftEdges || []) leftKeys.set(edgeKey(e, leftToRight), e);
  for (const e of rightEdges || []) rightKeys.set(edgeKey(e, rightIdentity), e);
  const removed = [...leftKeys.keys()].filter((k) => !rightKeys.has(k));
  const added = [...rightKeys.keys()].filter((k) => !leftKeys.has(k));
  return { added, removed };
}

function transformStation(station, prefix, dx, dy) {
  return {
    ...station,
    id: `${prefix}${station.id}`,
    x: finite(station.x) + dx,
    y: finite(station.y) + dy,
  };
}

function transformEdge(edge, prefix) {
  return {
    ...edge,
    from: `${prefix}${edge.from}`,
    to: `${prefix}${edge.to}`,
  };
}

function transformMark(mark, dx, dy) {
  const next = { ...mark };
  if ('x' in next) next.x = finite(next.x) + dx;
  if ('y' in next) next.y = finite(next.y) + dy;
  if ('cx' in next) next.cx = finite(next.cx) + dx;
  if ('cy' in next) next.cy = finite(next.cy) + dy;
  if ('x1' in next) next.x1 = finite(next.x1) + dx;
  if ('x2' in next) next.x2 = finite(next.x2) + dx;
  if ('y1' in next) next.y1 = finite(next.y1) + dy;
  if ('y2' in next) next.y2 = finite(next.y2) + dy;
  if (Array.isArray(next.points)) {
    next.points = next.points.map((p) => [finite(p?.[0]) + dx, finite(p?.[1]) + dy]);
  }
  return next;
}

function highlightBox(box, dx, dy, stroke, label, dash) {
  return [
    {
      kind: 'rect',
      x: finite(box.x) + dx - PAD,
      y: finite(box.y) + dy - PAD,
      w: Math.max(1, finite(box.w)) + PAD * 2,
      h: Math.max(1, finite(box.h)) + PAD * 2,
      rx: 12,
      fill: stroke,
      opacity: 0.08,
      stroke,
      strokeWidth: 3,
      dash,
      z: 100,
    },
    ...(label
      ? [
          {
            kind: 'text',
            x: finite(box.x) + dx,
            y: Math.max(16, finite(box.y) + dy - 10),
            value: label,
            size: 11,
            weight: 700,
            color: stroke,
            z: 101,
          },
        ]
      : []),
  ];
}

function summaryText(summary) {
  const parts = [
    `${summary.changedStations} changed`,
    `${summary.addedStations + summary.addedMarks + summary.addedEdges} added`,
    `${summary.removedStations + summary.removedMarks + summary.removedEdges} removed`,
  ];
  if (summary.movedStations) parts.push(`${summary.movedStations} moved/resized`);
  return parts.join(' | ');
}

export function deriveSketchDiffManifest({
  left,
  right,
  leftRef,
  rightRef,
  title,
  minSimilarity = 0.25,
  force = false,
} = {}) {
  if (!left?.manifest || !right?.manifest) {
    throw new Error('deriveSketchDiffManifest requires two sketch rows with manifests');
  }
  const leftManifest = left.manifest;
  const rightManifest = right.manifest;
  const leftViewBox = leftManifest.viewBox || {};
  const rightViewBox = rightManifest.viewBox || {};
  const leftW = finite(leftViewBox.width, 900);
  const rightW = finite(rightViewBox.width, 900);
  const height = Math.max(finite(leftViewBox.height, 600), finite(rightViewBox.height, 600)) + HEADER_H;
  const rightDx = leftW + GUTTER_W;

  const leftStations = Array.isArray(leftManifest.stations) ? leftManifest.stations : [];
  const rightStations = Array.isArray(rightManifest.stations) ? rightManifest.stations : [];
  const stationMatch = greedyMatch(
    leftStations,
    rightStations,
    (a, b) => stationScore(a, b, leftViewBox, rightViewBox),
    0.56,
  );
  const stationPairs = stationMatch.pairs.map((p) => ({
    left: leftStations[p.li],
    right: rightStations[p.ri],
    score: p.score,
  }));

  const leftMarks = Array.isArray(leftManifest.marks) ? leftManifest.marks : [];
  const rightMarks = Array.isArray(rightManifest.marks) ? rightManifest.marks : [];
  const markMatch = greedyMatch(
    leftMarks,
    rightMarks,
    (a, b) => markScore(a, b, leftViewBox, rightViewBox),
    0.48,
  );

  const denom = Math.max(1, leftStations.length + rightStations.length + leftMarks.length + rightMarks.length);
  const similarity = ((stationMatch.pairs.length + markMatch.pairs.length) * 2) / denom;
  const comparable = similarity >= minSimilarity || force;

  const pairedChanges = stationPairs.map((p) => ({ ...p, changes: stationChangeKinds(p.left, p.right) }));
  const edgeDiff = compareEdges(leftManifest.edges, rightManifest.edges, stationPairs);
  const movedStations = pairedChanges.filter((p) => p.changes.includes('geometry')).length;
  const changedStations = pairedChanges.filter((p) => p.changes.length > 0).length;
  const changedMarks = markMatch.pairs.filter(
    (p) => JSON.stringify(leftMarks[p.li]) !== JSON.stringify(rightMarks[p.ri]),
  ).length;

  const summary = {
    similarity: Math.round(similarity * 100) / 100,
    comparable,
    matchedStations: stationPairs.length,
    changedStations,
    movedStations,
    addedStations: stationMatch.added.length,
    removedStations: stationMatch.removed.length,
    matchedMarks: markMatch.pairs.length,
    changedMarks,
    addedMarks: markMatch.added.length,
    removedMarks: markMatch.removed.length,
    addedEdges: edgeDiff.added.length,
    removedEdges: edgeDiff.removed.length,
  };

  if (!comparable) {
    return { comparable: false, similarity: summary.similarity, summary, manifest: null };
  }

  const stations = [
    ...leftStations.map((s) => transformStation(s, 'left__', 0, HEADER_H)),
    ...rightStations.map((s) => transformStation(s, 'right__', rightDx, HEADER_H)),
  ];
  const edges = [
    ...(Array.isArray(leftManifest.edges) ? leftManifest.edges.map((e) => transformEdge(e, 'left__')) : []),
    ...(Array.isArray(rightManifest.edges) ? rightManifest.edges.map((e) => transformEdge(e, 'right__')) : []),
  ];
  const marks = [
    {
      kind: 'rect',
      x: 0,
      y: 0,
      w: leftW,
      h: height,
      fill: 'rgba(15,23,42,0.20)',
      stroke: COLORS.pane,
      strokeWidth: 1,
      z: -10,
    },
    {
      kind: 'rect',
      x: rightDx,
      y: 0,
      w: rightW,
      h: height,
      fill: 'rgba(15,23,42,0.20)',
      stroke: COLORS.pane,
      strokeWidth: 1,
      z: -10,
    },
    {
      kind: 'line',
      x1: leftW + GUTTER_W / 2,
      y1: 8,
      x2: leftW + GUTTER_W / 2,
      y2: height - 8,
      stroke: COLORS.pane,
      strokeWidth: 1,
      dash: '6 6',
      z: -5,
    },
    { kind: 'text', x: 24, y: 28, value: `Before: ${leftRef || left.ref}`, size: 15, weight: 700, color: COLORS.text, z: 110 },
    { kind: 'text', x: rightDx + 24, y: 28, value: `After: ${rightRef || right.ref}`, size: 15, weight: 700, color: COLORS.text, z: 110 },
    { kind: 'text', x: 24, y: 50, value: summaryText(summary), size: 12, color: COLORS.muted, z: 110 },
    { kind: 'text', x: rightDx + 24, y: 50, value: `similarity ${summary.similarity}`, size: 12, color: COLORS.muted, z: 110 },
    ...leftMarks.map((m) => transformMark(m, 0, HEADER_H)),
    ...rightMarks.map((m) => transformMark(m, rightDx, HEADER_H)),
  ];

  for (const p of pairedChanges) {
    if (p.changes.length === 0) continue;
    const color = p.changes.length === 1 && p.changes[0] === 'geometry' ? COLORS.moved : COLORS.changed;
    const label = p.changes.includes('geometry') ? p.changes.join('+') : p.changes.slice(0, 2).join('+');
    marks.push(...highlightBox(p.left, 0, HEADER_H, color, label));
    marks.push(...highlightBox(p.right, rightDx, HEADER_H, color, label));
  }
  for (const i of stationMatch.removed) {
    marks.push(...highlightBox(leftStations[i], 0, HEADER_H, COLORS.removed, 'removed', '7 5'));
  }
  for (const i of stationMatch.added) {
    marks.push(...highlightBox(rightStations[i], rightDx, HEADER_H, COLORS.added, 'added', '7 5'));
  }
  for (const p of markMatch.pairs) {
    const leftMark = leftMarks[p.li];
    const rightMark = rightMarks[p.ri];
    if (JSON.stringify(leftMark) === JSON.stringify(rightMark)) continue;
    const lb = markBox(leftMark);
    const rb = markBox(rightMark);
    if (lb) marks.push(...highlightBox(lb, 0, HEADER_H, COLORS.changed, 'changed mark'));
    if (rb) marks.push(...highlightBox(rb, rightDx, HEADER_H, COLORS.changed, 'changed mark'));
  }
  for (const i of markMatch.removed) {
    const box = markBox(leftMarks[i]);
    if (box) marks.push(...highlightBox(box, 0, HEADER_H, COLORS.removed, 'removed mark', '7 5'));
  }
  for (const i of markMatch.added) {
    const box = markBox(rightMarks[i]);
    if (box) marks.push(...highlightBox(box, rightDx, HEADER_H, COLORS.added, 'added mark', '7 5'));
  }

  if (edgeDiff.removed.length || edgeDiff.added.length) {
    marks.push({
      kind: 'text',
      x: leftW + GUTTER_W / 2,
      y: 32,
      value: `edges -${edgeDiff.removed.length} +${edgeDiff.added.length}`,
      size: 12,
      weight: 700,
      anchor: 'middle',
      color: edgeDiff.added.length && edgeDiff.removed.length ? COLORS.changed : edgeDiff.added.length ? COLORS.added : COLORS.removed,
      z: 111,
    });
  }

  return {
    comparable: true,
    similarity: summary.similarity,
    summary,
    manifest: {
      title: title || `Sketch diff: ${leftRef || left.ref} -> ${rightRef || right.ref}`,
      viewBox: { width: leftW + GUTTER_W + rightW, height },
      stations,
      edges,
      marks,
    },
  };
}
