/**
 * Radial wrap-net - a floor-aware angular tape for cylindrical buildings.
 *
 * Sibling to facade-wrap-net. The horizontal coordinate is theta around a
 * closed circumference instead of face+bay over a polygonal perimeter.
 */

const DEFAULT_RHYTHM = ['glass'];

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function clampInt(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(finiteOr(value, min))));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finiteOr(value, min)));
}

function asArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function normalizeRhythm(rhythm, fallback = DEFAULT_RHYTHM) {
  const list = Array.isArray(rhythm) && rhythm.length ? rhythm : fallback;
  return list.map((item) => String(item || '').trim()).filter(Boolean);
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

function normalizeSegmentSet(value, segments) {
  if (Array.isArray(value)) {
    return new Set(value.map((item) => modulo(clampInt(item, 0, segments - 1), segments)));
  }
  if (Number.isFinite(value)) return new Set([modulo(clampInt(value, 0, segments - 1), segments)]);
  return null;
}

function normalizeThetaRange(range) {
  if (!Array.isArray(range)) return null;
  return [Number(range[0]) || 0, Number(range[1]) || 0];
}

function normalizeZones(zones, floors, rhythm) {
  return asArray(zones).map((zone, index) => ({
    id: String(zone.id || zone.role || `zone-${index + 1}`),
    floors: normalizeFloorRange(zone.floors ?? zone.floorRange, floors),
    rhythm: normalizeRhythm(zone.rhythm, rhythm),
    motif: zone.motif ? String(zone.motif) : null,
  }));
}

function normalizeOverrides(entries, floors, segments, kind) {
  return asArray(entries).map((entry, index) => ({
    id: String(entry.id || entry.role || `${kind}-${index + 1}`),
    segments: normalizeSegmentSet(entry.segments ?? entry.segment ?? entry.bays ?? entry.bay, segments),
    thetaRange: normalizeThetaRange(entry.thetaRange ?? entry.theta),
    floors: normalizeFloorRange(entry.floors ?? entry.floorRange, floors),
    motif: entry.motif ? String(entry.motif) : null,
    role: entry.role ? String(entry.role) : kind,
  }));
}

function normalizeRadiusProfile(profile) {
  const source = Array.isArray(profile) && profile.length
    ? profile
    : [{ floor: 1, radius: 1 }, { floor: 'top', radius: 1 }];
  return source.map((item) => ({
    floor: item.floor,
    t: Number.isFinite(item.t) ? item.t : null,
    radius: Math.max(0.05, finiteOr(item.radius, 1)),
  }));
}

function rhythmMotif(rhythm, key) {
  const list = normalizeRhythm(rhythm);
  return list[((key % list.length) + list.length) % list.length];
}

function findZone(zones, floor) {
  for (let i = zones.length - 1; i >= 0; i -= 1) {
    if (inRange(floor, zones[i].floors)) return zones[i];
  }
  return null;
}

function modulo(value, size) {
  return ((value % size) + size) % size;
}

function angleInRange(angleDeg, range) {
  if (!range) return false;
  const angle = modulo(angleDeg, 360);
  const start = modulo(range[0], 360);
  const end = modulo(range[1], 360);
  if (start <= end) return angle >= start && angle <= end;
  return angle >= start || angle <= end;
}

function overrideMatches(item, segment, thetaCenter, floor) {
  if (!inRange(floor, item.floors)) return false;
  if (item.segments && item.segments.has(segment)) return true;
  if (item.thetaRange && angleInRange(thetaCenter, item.thetaRange)) return true;
  return item.segments === null && item.thetaRange === null;
}

function findOverride(overrides, segment, thetaCenter, floor) {
  for (let i = overrides.length - 1; i >= 0; i -= 1) {
    if (overrideMatches(overrides[i], segment, thetaCenter, floor)) return overrides[i];
  }
  return null;
}

export function resolveRadialWrapNet(input = {}) {
  const floors = clampInt(input.floors ?? input.rows ?? input.levels, 1, 180);
  const segments = clampInt(input.segments ?? input.bays ?? input.thetaSegments, 3, 160);
  const phaseDeg = finiteOr(input.phaseDeg ?? input.phase, -90);
  const sweepDeg = clamp(input.sweepDeg ?? input.sweep ?? 360, 1, 360);
  const rhythm = normalizeRhythm(input.rhythm);
  const zones = normalizeZones(input.zones, floors, rhythm);
  const spines = normalizeOverrides(input.spines ?? input.cores, floors, segments, 'spine');
  const voids = normalizeOverrides(input.voids, floors, segments, 'void');
  return {
    kind: 'radialWrap',
    role: input.role || 'radial-wrap',
    target: input.target || null,
    floors,
    segments,
    phaseDeg,
    sweepDeg,
    rhythm,
    zones,
    spines,
    voids,
    crowns: asArray(input.crowns),
    radiusProfile: normalizeRadiusProfile(input.radiusProfile),
    motifs: input.motifs && typeof input.motifs === 'object' ? { ...input.motifs } : {},
    source: input,
  };
}

export function walkRadialWrapNet(netOrInput, options = {}) {
  const net = netOrInput?.kind === 'radialWrap'
    ? netOrInput
    : resolveRadialWrapNet(netOrInput);
  const { includeExcluded = false } = options;
  const cells = [];
  let index = 0;
  const step = net.sweepDeg / net.segments;

  for (let floor = 1; floor <= net.floors; floor += 1) {
    const row = net.floors - floor;
    const zone = findZone(net.zones, floor);
    for (let segment = 0; segment < net.segments; segment += 1) {
      const thetaStart = net.phaseDeg + step * segment;
      const thetaEnd = net.phaseDeg + step * (segment + 1);
      const thetaCenter = thetaStart + step * 0.5;
      const localRhythm = zone?.rhythm || net.rhythm;
      let motif = zone?.motif || rhythmMotif(localRhythm, segment);
      const spine = findOverride(net.spines, segment, thetaCenter, floor);
      const voidCell = findOverride(net.voids, segment, thetaCenter, floor);
      if (spine?.motif) motif = spine.motif;
      const excluded = Boolean(voidCell);
      const cell = {
        index,
        segment,
        wrapIndex: segment,
        floor,
        row,
        zone: zone?.id || null,
        motif,
        motifRef: net.motifs[motif] || motif,
        thetaStart,
        thetaEnd,
        thetaCenter,
        thetaBand: [thetaStart, thetaEnd],
        uBand: [segment / net.segments, (segment + 1) / net.segments],
        vBand: [(net.floors - floor) / net.floors, (net.floors - floor + 1) / net.floors],
        seamPrev: segment === 0 ? net.segments - 1 : null,
        seamNext: segment === net.segments - 1 ? 0 : null,
        spine: spine?.id || null,
        void: voidCell?.id || null,
        excluded,
        radiusScale: radiusScaleAtFloor(net, floor),
        provenance: {
          kind: 'radialWrap',
          role: net.role,
          segment,
          thetaCenter,
          floor,
          zone: zone?.id || null,
          motif,
        },
      };
      index += 1;
      if (!excluded || includeExcluded) cells.push(cell);
    }
  }
  return cells;
}

export function compileRadialWrapToRings(netOrInput, options = {}) {
  const net = netOrInput?.kind === 'radialWrap'
    ? netOrInput
    : resolveRadialWrapNet(netOrInput);
  const cells = walkRadialWrapNet(net, { includeExcluded: options.includeExcluded ?? true });
  const rings = [];
  for (let floor = 1; floor <= net.floors; floor += 1) {
    rings.push({
      floor,
      row: net.floors - floor,
      cells: cells.filter((cell) => cell.floor === floor),
    });
  }
  return {
    net,
    rings,
    diagnostics: radialWrapDiagnostics(net, cells),
  };
}

export function computeRadialWrapPlateLayout(netOrInput, {
  cellW = 16,
  cellH = 10,
  gap = 1.5,
  originX = 0,
  originY = 0,
  labelH = 22,
} = {}) {
  const net = netOrInput?.kind === 'radialWrap'
    ? netOrInput
    : resolveRadialWrapNet(netOrInput);
  return {
    bounds: {
      width: net.segments * cellW + Math.max(0, net.segments - 1) * gap,
      height: labelH + net.floors * cellH + Math.max(0, net.floors - 1) * gap,
    },
    tape: {
      x: originX,
      y: originY + labelH,
      w: net.segments * cellW + Math.max(0, net.segments - 1) * gap,
      h: net.floors * cellH + Math.max(0, net.floors - 1) * gap,
      segments: net.segments,
      floors: net.floors,
      cellW,
      cellH,
      gap,
    },
  };
}

export function radialWrapDiagnostics(net, cells = walkRadialWrapNet(net, { includeExcluded: true })) {
  return {
    cellsPlanned: net.segments * net.floors,
    cellsRendered: cells.filter((cell) => !cell.excluded).length,
    cellsCulled: cells.filter((cell) => cell.excluded).length,
    zones: (net.zones || []).map((zone) => zone.id),
    segments: net.segments,
    sweepDeg: net.sweepDeg,
    warnings: [],
  };
}

export function radiusScaleAtFloor(netOrInput, floor) {
  const net = netOrInput?.kind === 'radialWrap'
    ? netOrInput
    : resolveRadialWrapNet(netOrInput);
  const profile = net.radiusProfile.map((item) => ({
    t: item.t ?? floorToT(item.floor, net.floors),
    radius: item.radius,
  })).sort((a, b) => a.t - b.t);
  const t = (floor - 1) / Math.max(1, net.floors - 1);
  if (t <= profile[0].t) return profile[0].radius;
  if (t >= profile[profile.length - 1].t) return profile[profile.length - 1].radius;
  for (let i = 0; i + 1 < profile.length; i += 1) {
    const a = profile[i];
    const b = profile[i + 1];
    if (t >= a.t && t <= b.t) {
      const span = Math.max(1e-9, b.t - a.t);
      const u = (t - a.t) / span;
      return a.radius + (b.radius - a.radius) * u;
    }
  }
  return 1;
}

function floorToT(value, floors) {
  if (value === 'top') return 1;
  if (value === 'bottom') return 0;
  return (clampInt(value, 1, floors) - 1) / Math.max(1, floors - 1);
}
