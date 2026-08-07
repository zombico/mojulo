/**
 * Facade wrap-net - a floor-aware perimeter tape for building facades.
 *
 * The planner is intentionally renderer-neutral. It resolves a compact
 * descriptor into stable `(face, bay, floor)` cells whose horizontal rhythm
 * can continue around corners, then groups those cells back by face for a
 * renderer or review plate to consume.
 */

const DEFAULT_PERIMETER = [
  { face: 'front', bays: 6 },
  { face: 'right', bays: 3 },
  { face: 'back', bays: 6 },
  { face: 'left', bays: 3 },
];

const DEFAULT_RHYTHM = ['window'];

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function clampInt(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(finiteOr(value, min))));
}

function asArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function normalizeFloorRange(range, floors, fallback = [1, floors]) {
  const raw = Array.isArray(range) ? range : fallback;
  const lo = clampInt(raw[0], 1, floors);
  const hi = clampInt(raw[1] ?? raw[0], 1, floors);
  return lo <= hi ? [lo, hi] : [hi, lo];
}

function inRange(value, range) {
  return value >= range[0] && value <= range[1];
}

function normalizeRhythm(rhythm, fallback = DEFAULT_RHYTHM) {
  const list = Array.isArray(rhythm) && rhythm.length ? rhythm : fallback;
  return list.map((item) => String(item || '').trim()).filter(Boolean);
}

function normalizeBays(value, fallback = 1) {
  if (Array.isArray(value)) {
    const set = new Set();
    for (const item of value) set.add(clampInt(item, 0, 200));
    return set;
  }
  return new Set([clampInt(value, 0, 200)]);
}

function derivePerimeter(inputPerimeter, targetSolid) {
  const source = Array.isArray(inputPerimeter) && inputPerimeter.length
    ? inputPerimeter
    : DEFAULT_PERIMETER;
  const width = Math.max(finiteOr(targetSolid?.width ?? targetSolid?.w, 0), 0);
  const depth = Math.max(finiteOr(targetSolid?.depth ?? targetSolid?.d, 0), 0);
  const unit = Math.max(Math.min(width || 1, depth || 1) / 3, 1);
  let offset = 0;
  return source.map((segment, index) => {
    const face = String(segment.face || segment.side || `face-${index}`).trim();
    const derived = face === 'front' || face === 'back'
      ? Math.round(width / unit)
      : Math.round(depth / unit);
    const bays = clampInt(segment.bays ?? segment.cols ?? derived, 1, 64);
    const normalized = {
      face,
      faceIndex: index,
      bays,
      offset,
      label: segment.label || face,
    };
    offset += bays;
    return normalized;
  });
}

function normalizeZones(zones, floors, baseRhythm) {
  return asArray(zones).map((zone, index) => ({
    id: String(zone.id || zone.role || `zone-${index + 1}`),
    floors: normalizeFloorRange(zone.floors ?? zone.floorRange, floors),
    rhythm: normalizeRhythm(zone.rhythm, baseRhythm),
    motif: zone.motif ? String(zone.motif) : null,
  }));
}

function normalizeOverrides(entries, floors, kind) {
  return asArray(entries).map((entry, index) => ({
    id: String(entry.id || entry.role || `${kind}-${index + 1}`),
    face: entry.face ? String(entry.face) : null,
    bays: normalizeBays(entry.bays ?? entry.bay ?? entry.cols ?? entry.col, 0),
    floors: normalizeFloorRange(entry.floors ?? entry.floorRange, floors),
    motif: entry.motif ? String(entry.motif) : null,
    role: entry.role ? String(entry.role) : kind,
  }));
}

function rhythmMotif(rhythm, key) {
  const list = normalizeRhythm(rhythm);
  return list[((key % list.length) + list.length) % list.length];
}

function findZone(zones, floor) {
  // Later zones win so local overrides can be appended without reshuffling.
  for (let i = zones.length - 1; i >= 0; i -= 1) {
    if (inRange(floor, zones[i].floors)) return zones[i];
  }
  return null;
}

function findOverride(overrides, face, bayOnFace, floor) {
  for (let i = overrides.length - 1; i >= 0; i -= 1) {
    const item = overrides[i];
    if (item.face && item.face !== face) continue;
    if (!item.bays.has(bayOnFace)) continue;
    if (!inRange(floor, item.floors)) continue;
    return item;
  }
  return null;
}

export function resolveFacadeWrapNet(input = {}, targetSolid = null) {
  const floors = clampInt(input.floors ?? input.rows ?? input.levels, 1, 160);
  const perimeter = derivePerimeter(input.perimeter, targetSolid);
  const rhythm = normalizeRhythm(input.rhythm);
  const zones = normalizeZones(input.zones, floors, rhythm);
  const cores = normalizeOverrides(input.cores, floors, 'core');
  const voids = normalizeOverrides(input.voids, floors, 'void');
  const totalBays = perimeter.reduce((sum, segment) => sum + segment.bays, 0);

  return {
    kind: 'facadeWrap',
    role: input.role || 'facade-wrap',
    target: input.target || null,
    floors,
    perimeter,
    totalBays,
    rhythm,
    zones,
    cores,
    voids,
    setbacks: asArray(input.setbacks),
    motifs: input.motifs && typeof input.motifs === 'object' ? { ...input.motifs } : {},
    source: input,
  };
}

export function walkFacadeWrapNet(netOrInput, options = {}) {
  const net = netOrInput?.kind === 'facadeWrap' && Array.isArray(netOrInput.perimeter)
    ? netOrInput
    : resolveFacadeWrapNet(netOrInput);
  const { includeExcluded = false } = options;
  const cells = [];
  let index = 0;

  for (let floor = 1; floor <= net.floors; floor += 1) {
    const row = net.floors - floor;
    const zone = findZone(net.zones, floor);
    for (const segment of net.perimeter) {
      for (let bayOnFace = 0; bayOnFace < segment.bays; bayOnFace += 1) {
        const wrapIndex = segment.offset + bayOnFace;
        const localRhythm = zone?.rhythm || net.rhythm;
        let motif = zone?.motif || rhythmMotif(localRhythm, wrapIndex);
        const core = findOverride(net.cores, segment.face, bayOnFace, floor);
        const voidCell = findOverride(net.voids, segment.face, bayOnFace, floor);
        if (core?.motif) motif = core.motif;
        const excluded = Boolean(voidCell);
        const cell = {
          index,
          wrapIndex,
          face: segment.face,
          faceIndex: segment.faceIndex,
          bay: wrapIndex,
          bayOnFace,
          floor,
          row,
          zone: zone?.id || null,
          motif,
          motifRef: net.motifs[motif] || motif,
          uBand: [bayOnFace / segment.bays, (bayOnFace + 1) / segment.bays],
          vBand: [(net.floors - floor) / net.floors, (net.floors - floor + 1) / net.floors],
          cornerPrev: bayOnFace === 0 ? previousFace(net.perimeter, segment.faceIndex) : null,
          cornerNext: bayOnFace === segment.bays - 1 ? nextFace(net.perimeter, segment.faceIndex) : null,
          core: core?.id || null,
          void: voidCell?.id || null,
          excluded,
          provenance: {
            kind: 'facadeWrap',
            role: net.role,
            face: segment.face,
            faceIndex: segment.faceIndex,
            bayOnFace,
            wrapIndex,
            floor,
            zone: zone?.id || null,
            motif,
          },
        };
        index += 1;
        if (!excluded || includeExcluded) cells.push(cell);
      }
    }
  }

  return cells;
}

export function compileFacadeWrapToFacePatterns(netOrInput, options = {}) {
  const net = netOrInput?.kind === 'facadeWrap' && Array.isArray(netOrInput.perimeter)
    ? netOrInput
    : resolveFacadeWrapNet(netOrInput);
  const cells = walkFacadeWrapNet(net, { includeExcluded: options.includeExcluded ?? true });
  const byFace = new Map();
  for (const segment of net.perimeter) {
    byFace.set(segment.face, {
      face: segment.face,
      faceIndex: segment.faceIndex,
      cols: segment.bays,
      rows: net.floors,
      cells: [],
    });
  }
  for (const cell of cells) {
    byFace.get(cell.face)?.cells.push(cell);
  }
  return {
    net,
    faces: [...byFace.values()],
    diagnostics: facadeWrapDiagnostics(net, cells),
  };
}

export function computeFacadeWrapPlateLayout(netOrInput, {
  cellW = 18,
  cellH = 10,
  gap = 2,
  faceGap = 10,
  originX = 0,
  originY = 0,
  labelH = 22,
} = {}) {
  const net = netOrInput?.kind === 'facadeWrap' && Array.isArray(netOrInput.perimeter)
    ? netOrInput
    : resolveFacadeWrapNet(netOrInput);
  const faces = [];
  let x = originX;
  for (const segment of net.perimeter) {
    const width = segment.bays * cellW + Math.max(0, segment.bays - 1) * gap;
    faces.push({
      face: segment.face,
      faceIndex: segment.faceIndex,
      x,
      y: originY + labelH,
      w: width,
      h: net.floors * cellH + Math.max(0, net.floors - 1) * gap,
      bays: segment.bays,
      floors: net.floors,
      cellW,
      cellH,
      gap,
    });
    x += width + faceGap;
  }
  const height = labelH + net.floors * cellH + Math.max(0, net.floors - 1) * gap;
  return {
    bounds: { width: Math.max(0, x - originX - faceGap), height },
    faces,
  };
}

export function facadeWrapDiagnostics(net, cells = walkFacadeWrapNet(net, { includeExcluded: true })) {
  const hidden = new Set();
  const warnings = [];
  for (const zone of net.zones || []) {
    if (zone.floors[1] > net.floors) warnings.push(`zone '${zone.id}' floor range exceeds floors`);
  }
  const faceNames = new Set((net.perimeter || []).map((segment) => segment.face));
  for (const item of [...(net.cores || []), ...(net.voids || [])]) {
    if (item.face && !faceNames.has(item.face)) warnings.push(`${item.id} references unknown face '${item.face}'`);
  }
  return {
    cellsPlanned: net.totalBays * net.floors,
    cellsRendered: cells.filter((cell) => !cell.excluded && !hidden.has(cell.face)).length,
    cellsCulled: cells.filter((cell) => cell.excluded || hidden.has(cell.face)).length,
    zones: (net.zones || []).map((zone) => zone.id),
    perimeterBays: Object.fromEntries((net.perimeter || []).map((segment) => [segment.face, segment.bays])),
    hiddenFaces: [...hidden],
    warnings,
  };
}

function previousFace(perimeter, faceIndex) {
  if (!perimeter.length) return null;
  return perimeter[(faceIndex - 1 + perimeter.length) % perimeter.length]?.face || null;
}

function nextFace(perimeter, faceIndex) {
  if (!perimeter.length) return null;
  return perimeter[(faceIndex + 1) % perimeter.length]?.face || null;
}
