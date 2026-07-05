/**
 * koenigsberg — the first playable theorem (math-worlds.plan.md, Phase 2): the Seven Bridges of
 * Königsberg as a walkable bridge world whose rule (a crossed bridge RETRACTS, from
 * math-rules-kernel.js) makes the parity theorem the shape of your frustration. Four landmasses,
 * seven bridges, all four shores of odd degree → no walk crosses every bridge exactly once, and
 * the world proves it by stranding you. The Euler variant next door drops one bridge to leave
 * exactly two odd shores, and there the walk completes.
 *
 * Two faces of the same graph:
 *   - GEOMETRY: planKoenigsberg → boxes/grounds/ribbons → assembleBoxCityScene, a walkable world.
 *   - PROOF: eulerTrailStatus (the parity argument) and searchAllTrails (exhaustive consumable-edge
 *     DFS) agree — the theorem and the brute force reach the same verdict, deterministically. A
 *     stranded attempt IS a counterexample certificate.
 */

import { assembleBoxCityScene } from '@/lib/graph/scene/scene-css3d';
import { roadRibbons, straightPath } from '@/lib/graph/city/roads';
import { buildMathRules } from '@/lib/graph/structures/math-rules-kernel';

// Four shores. C is the Kneiphof island (centre); A/B the north/south banks; D the eastern land.
const NODES = {
  A: { pos: [0, 13], label: 'north bank', tint: '#8a9a6a' },
  B: { pos: [0, -13], label: 'south bank', tint: '#8a9a6a' },
  C: { pos: [0, 0], label: 'Kneiphof island', tint: '#b7a878' },
  D: { pos: [15, 0], label: 'east land', tint: '#8a9a6a' },
};

// The historic seven bridges (multi-edges between the same pair are distinct bridges).
const HISTORIC_BRIDGES = [
  { id: 'ac1', a: 'A', b: 'C' }, { id: 'ac2', a: 'A', b: 'C' },   // two north-bank bridges to the island
  { id: 'bc1', a: 'B', b: 'C' }, { id: 'bc2', a: 'B', b: 'C' },   // two south-bank bridges to the island
  { id: 'ad', a: 'A', b: 'D' },
  { id: 'bd', a: 'B', b: 'D' },
  { id: 'cd', a: 'C', b: 'D' },
];

// Euler variant: drop the island→east bridge. Degrees become A3 B3 C4 D2 → exactly two odd shores
// (A, B) → an Eulerian TRAIL exists (start at one odd shore, end at the other).
const EULER_BRIDGES = HISTORIC_BRIDGES.filter((b) => b.id !== 'cd');

export const KOENIGSBERG_VARIANTS = {
  historic: { bridges: HISTORIC_BRIDGES, title: 'Seven Bridges of Königsberg' },
  euler: { bridges: EULER_BRIDGES, title: 'Königsberg — Euler variant (6 bridges)' },
};

function variantOf(manifestOrName) {
  const name = typeof manifestOrName === 'string' ? manifestOrName : (manifestOrName?.structure?.variant || manifestOrName?.variant);
  return KOENIGSBERG_VARIANTS[name] ? name : 'historic';
}

// ── the theorem (parity argument) ──────────────────────────────────────────────────────────────
export function eulerTrailStatus(bridges) {
  const deg = {};
  for (const b of bridges) { deg[b.a] = (deg[b.a] || 0) + 1; deg[b.b] = (deg[b.b] || 0) + 1; }
  const odd = Object.keys(deg).filter((n) => deg[n] % 2 === 1).sort();
  const exists = odd.length === 0 || odd.length === 2;
  return {
    degrees: deg,
    oddNodes: odd,
    oddCount: odd.length,
    exists,
    startNodes: odd.length === 2 ? odd : Object.keys(deg).sort(),   // where a trail could begin
    reason: exists
      ? (odd.length === 0 ? 'every shore has even degree → an Eulerian circuit exists' : 'exactly two odd shores → an Eulerian trail exists between them')
      : `${odd.length} shores have odd degree (need 0 or 2) → no Eulerian trail can exist`,
  };
}

// ── the brute force (exhaustive consumable-edge DFS via the kernel) ──────────────────────────────
// Returns whether ANY trail crosses every bridge once, the best (longest) trail found, and — when
// none completes — a counterexample certificate: a maximal walk that strands with bridges left.
export function searchAllTrails(bridges) {
  const K = buildMathRules();
  const nodes = [...new Set(bridges.flatMap((b) => [b.a, b.b]))].sort();
  let best = { crossings: [], strandedAt: null };
  let completes = false;
  let completingTrail = null;
  let deadEnds = 0;

  const dfs = (trail) => {
    if (completes) return;                                   // first completion is enough for the verdict
    const open = K.openEdgesFrom(bridges, trail.at, trail);
    if (open.length === 0) {
      if (K.complete(bridges, trail)) { completes = true; completingTrail = [...trail.crossings]; return; }
      deadEnds++;
      if (trail.crossings.length > best.crossings.length) best = { crossings: [...trail.crossings], strandedAt: trail.at };
      return;
    }
    for (const e of open) {
      const snapshot = { at: trail.at, used: { ...trail.used }, crossings: [...trail.crossings] };
      K.cross(bridges, trail, e.id);
      dfs(trail);
      trail.at = snapshot.at; trail.used = snapshot.used; trail.crossings = snapshot.crossings;   // backtrack
      if (completes) return;
    }
  };

  for (const start of nodes) { dfs(K.makeTrail(start)); if (completes) break; }

  return {
    bridgeCount: bridges.length,
    completes,
    completingTrail,
    deadEnds,
    maxCrossings: completes ? bridges.length : best.crossings.length,
    // the certificate: a longest stranded walk (only meaningful when nothing completes)
    certificate: completes ? null : {
      kind: 'euler-trail-counterexample',
      crossed: best.crossings,
      strandedAt: best.strandedAt,
      bridgesLeft: bridges.length - best.crossings.length,
      claim: 'no walk crosses all bridges exactly once',
    },
  };
}

// ── geometry ─────────────────────────────────────────────────────────────────────────────────
export function planKoenigsberg(manifestOrName = 'historic') {
  const variant = variantOf(manifestOrName);
  const { bridges, title } = KOENIGSBERG_VARIANTS[variant];

  const boxes = [];
  const grounds = [];
  // water first (a wide blue plane), then a land pad + a short retaining kerb per shore.
  const R = 26;
  grounds.push({ x: -R, y: -R, w: 2 * R, d: 2 * R, z: 0, fill: '#33566b' });          // the Pregel
  const landW = 7, landD = 7;
  for (const [id, n] of Object.entries(NODES)) {
    const [x, y] = n.pos;
    grounds.push({ x: x - landW / 2, y: y - landD / 2, w: landW, d: landD, z: 0.06, fill: n.tint });
    boxes.push({ x: x - landW / 2, y: y - landD / 2, w: landW, d: 0.4, z0: 0, z1: 0.5, tint: '#6f6a58' });   // kerb, +/- edges
    boxes.push({ x: x - landW / 2, y: y + landD / 2 - 0.4, w: landW, d: 0.4, z0: 0, z1: 0.5, tint: '#6f6a58' });
  }

  // bridges: a raised deck between the two shores; multi-bridges to the same pair are offset
  // perpendicular so they read as distinct crossings.
  const ribbons = [];
  const bridgeGeom = {};
  const pairIndex = {};
  const pairCount = {};
  for (const b of bridges) { const k = [b.a, b.b].sort().join(''); pairCount[k] = (pairCount[k] || 0) + 1; }
  for (const b of bridges) {
    const A = NODES[b.a].pos, B = NODES[b.b].pos;
    const k = [b.a, b.b].sort().join('');
    pairIndex[k] = (pairIndex[k] || 0);
    const n = pairCount[k];
    const slot = pairIndex[k]++;
    const off = n > 1 ? (slot - (n - 1) / 2) * 2.6 : 0;      // spread parallel bridges
    // perpendicular offset direction
    const dx = B[0] - A[0], dy = B[1] - A[1];
    const len = Math.hypot(dx, dy) || 1;
    const px = -dy / len, py = dx / len;
    // pull endpoints to the shore edges (inset by half the land pad)
    const inset = landW / 2 - 0.3;
    const a2 = [A[0] + (dx / len) * inset + px * off, A[1] + (dy / len) * inset + py * off];
    const b2 = [B[0] - (dx / len) * inset + px * off, B[1] - (dy / len) * inset + py * off];
    const deck = roadRibbons({ path: straightPath(a2, b2, 6), width: 1.8, lift: 0.7, deck: 0.35, laneLine: false, asphalt: '#7a6a52', pillars: true, pillarEvery: 2 });
    ribbons.push(...deck.ribbons);
    for (const bx of deck.boxes) boxes.push(bx);
    bridgeGeom[b.id] = { a: b.a, b: b.b, from: a2, to: b2, mid: [(a2[0] + b2[0]) / 2, (a2[1] + b2[1]) / 2] };
  }

  const walkStart = [NODES.C.pos[0], NODES.C.pos[1], 1.4];
  return { variant, title, bridges, boxes, grounds, ribbons, bridgeGeom, nodes: NODES, extent: R, walkStart };
}

function koenigsbergCameras(extent) {
  const d = extent * 1.3;
  return [
    { name: 'bridges hero', worldFraming: { cameraPosition: [-d * 0.4, d * 0.9, d * 0.8], lookAt: [4, 0, 0.5], horizontalFov: 54, pictureCenter: [560, 410] } },
    { name: 'top', worldFraming: { cameraPosition: [2, 2, d * 1.3], lookAt: [4, 0, 0], horizontalFov: 52, pictureCenter: [560, 400] } },
  ];
}

export function assembleKoenigsbergScene(manifest = {}, { title } = {}) {
  const built = planKoenigsberg(manifest);
  const scene = assembleBoxCityScene({
    boxes: built.boxes,
    grounds: built.grounds,
    ribbons: built.ribbons,
    cameras: koenigsbergCameras(built.extent),
    sky: { preset: 'day' },
    viewBox: { width: 1120, height: 780 },
    unitScale: manifest.unitScale || 18,
    title: title || `mojulo — ${built.title}`,
  });

  const status = eulerTrailStatus(built.bridges);
  const search = searchAllTrails(built.bridges);
  if (!Array.isArray(manifest.entities) || !manifest.entities.length) {
    scene.walk = { enabled: true, speed: 3.4, eyeHeight: 1.4, start: built.walkStart, yaw: 0 };
  }
  scene.koenigsbergPlan = {
    variant: built.variant,
    title: built.title,
    nodes: Object.fromEntries(Object.entries(built.nodes).map(([id, n]) => [id, { label: n.label, pos: n.pos }])),
    bridges: built.bridges.map((b) => ({ id: b.id, a: b.a, b: b.b, mid: built.bridgeGeom[b.id].mid })),
    theorem: status,
    search: { completes: search.completes, maxCrossings: search.maxCrossings, completingTrail: search.completingTrail, certificate: search.certificate },
  };
  return scene;
}
