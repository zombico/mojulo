/**
 * Aircraft fuselage wrap-net - a longitudinal, periodic surface tape for
 * cylindrical/tapered aircraft bodies.
 *
 * Vehicle face-nets address finite box panels. Facade wrap-nets address a
 * building perimeter by face. This planner addresses a fuselage by station
 * along the body and angular band around the circumference, keeping the seam
 * periodic so cockpit glass, window rows, doors, livery, cargo hatches, and
 * tail markings can share one normalized surface grammar.
 */

const DEFAULT_BANDS = [
  { id: 'top', sectors: 2, label: 'top crown' },
  { id: 'starboard', sectors: 3, label: 'starboard side' },
  { id: 'belly', sectors: 2, label: 'belly seam' },
  { id: 'port', sectors: 3, label: 'port side' },
];

const DEFAULT_PROFILE = [
  { t: 0, radius: 0.08 },
  { t: 0.12, radius: 1 },
  { t: 0.82, radius: 1 },
  { t: 1, radius: 0.18 },
];

const DEFAULT_RHYTHM = ['skin'];

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finiteOr(value, min)));
}

function clampInt(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(finiteOr(value, min))));
}

function asArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function normalizeRhythm(rhythm, fallback = DEFAULT_RHYTHM) {
  const list = Array.isArray(rhythm) && rhythm.length ? rhythm : fallback;
  return list.map((item) => String(item || '').trim()).filter(Boolean);
}

function normalizeProfile(profile) {
  const source = Array.isArray(profile) && profile.length ? profile : DEFAULT_PROFILE;
  const points = source
    .map((point) => ({
      t: clamp(Number(point.t ?? point.station ?? 0), 0, 1),
      radius: Math.max(0, finiteOr(Number(point.radius ?? point.r), 0)),
    }))
    .sort((a, b) => a.t - b.t);
  if (!points.length) return [...DEFAULT_PROFILE];
  if (points[0].t > 0) points.unshift({ t: 0, radius: points[0].radius });
  if (points[points.length - 1].t < 1) points.push({ t: 1, radius: points[points.length - 1].radius });
  return points;
}

function normalizeStationRange(range, stations, fallback = [0, stations - 1], fractional = false) {
  const raw = Array.isArray(range) ? range : fallback;
  const loRaw = finiteOr(Number(raw[0]), fallback[0]);
  const hiRaw = finiteOr(Number(raw[1] ?? raw[0]), loRaw);
  const toIndex = (value, rounder) => {
    if (fractional) return clampInt(rounder(clamp(value, 0, 1) * (stations - 1)), 0, stations - 1);
    return clampInt(value, 0, stations - 1);
  };
  const lo = toIndex(Math.min(loRaw, hiRaw), Math.floor);
  const hi = toIndex(Math.max(loRaw, hiRaw), Math.ceil);
  return lo <= hi ? [lo, hi] : [hi, lo];
}

function normalizeSectors(value, fallback = 0) {
  if (Array.isArray(value)) {
    const set = new Set();
    for (const item of value) set.add(clampInt(item, 0, 512));
    return set;
  }
  return new Set([clampInt(value, 0, 512)]);
}

function deriveBands(inputBands) {
  const source = Array.isArray(inputBands) && inputBands.length ? inputBands : DEFAULT_BANDS;
  let offset = 0;
  return source.map((band, index) => {
    const id = String(band.id || band.band || band.role || `band-${index}`).trim();
    const sectors = clampInt(band.sectors ?? band.count ?? band.bays, 1, 64);
    const normalized = {
      id,
      band: id,
      bandIndex: index,
      sectors,
      offset,
      label: band.label || id,
    };
    offset += sectors;
    return normalized;
  });
}

function normalizeZones(zones, stations, baseRhythm) {
  return asArray(zones).map((zone, index) => {
    const fractional = zone.tRange != null || zone.stationT != null || zone.t != null;
    return {
      id: String(zone.id || zone.role || `zone-${index + 1}`),
      stations: normalizeStationRange(zone.tRange ?? zone.stationT ?? zone.t ?? zone.stations ?? zone.stationRange ?? zone.range, stations, [0, stations - 1], fractional),
      rhythm: normalizeRhythm(zone.rhythm, baseRhythm),
      motif: zone.motif ? String(zone.motif) : null,
    };
  });
}

function normalizeOverrides(entries, stations, kind) {
  return asArray(entries).map((entry, index) => {
    const fractional = entry.tRange != null || entry.stationT != null || entry.t != null;
    return {
      id: String(entry.id || entry.role || `${kind}-${index + 1}`),
      band: entry.band ? String(entry.band) : null,
      sectors: normalizeSectors(entry.sectors ?? entry.sector ?? entry.bays ?? entry.bay, 0),
      stations: normalizeStationRange(entry.tRange ?? entry.stationT ?? entry.t ?? entry.stations ?? entry.stationRange ?? entry.range, stations, [0, stations - 1], fractional),
      motif: entry.motif ? String(entry.motif) : null,
      role: entry.role ? String(entry.role) : kind,
    };
  });
}

function inRange(value, range) {
  return value >= range[0] && value <= range[1];
}

function rhythmMotif(rhythm, key) {
  const list = normalizeRhythm(rhythm);
  return list[((key % list.length) + list.length) % list.length];
}

function findZone(zones, station) {
  for (let i = zones.length - 1; i >= 0; i -= 1) {
    if (inRange(station, zones[i].stations)) return zones[i];
  }
  return null;
}

function findOverride(overrides, band, sectorOnBand, station) {
  for (let i = overrides.length - 1; i >= 0; i -= 1) {
    const item = overrides[i];
    if (item.band && item.band !== band) continue;
    if (!item.sectors.has(sectorOnBand)) continue;
    if (!inRange(station, item.stations)) continue;
    return item;
  }
  return null;
}

export function profileRadiusAt(profile, t) {
  const points = normalizeProfile(profile);
  const x = clamp(t, 0, 1);
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    if (x <= b.t) {
      const span = Math.max(1e-9, b.t - a.t);
      const local = (x - a.t) / span;
      return a.radius + (b.radius - a.radius) * local;
    }
  }
  return points[points.length - 1].radius;
}

export function resolveAircraftFuselageWrapNet(input = {}) {
  const stations = clampInt(input.stations ?? input.cols ?? input.lengthStations, 3, 240);
  const bands = deriveBands(input.bands ?? input.angularBands ?? input.perimeter);
  const totalSectors = bands.reduce((sum, band) => sum + band.sectors, 0);
  const rhythm = normalizeRhythm(input.rhythm);
  const zones = normalizeZones(input.zones, stations, rhythm);
  const markings = normalizeOverrides(input.markings ?? input.doors ?? input.overrides, stations, 'marking');
  const voids = normalizeOverrides(input.voids, stations, 'void');

  return {
    kind: 'aircraftFuselageWrap',
    role: input.role || 'fuselage-wrap',
    target: input.target || null,
    stations,
    bands,
    totalSectors,
    seam: input.seam || 'belly',
    profile: normalizeProfile(input.profile),
    rhythm,
    zones,
    markings,
    voids,
    appendages: input.appendages && typeof input.appendages === 'object' ? { ...input.appendages } : {},
    motifs: input.motifs && typeof input.motifs === 'object' ? { ...input.motifs } : {},
    source: input,
  };
}

export function walkAircraftFuselageWrapNet(netOrInput, options = {}) {
  const net = netOrInput?.kind === 'aircraftFuselageWrap' && Array.isArray(netOrInput.bands)
    ? netOrInput
    : resolveAircraftFuselageWrapNet(netOrInput);
  const { includeExcluded = false } = options;
  const cells = [];
  let index = 0;

  for (let station = 0; station < net.stations; station += 1) {
    const stationBand = [station / net.stations, (station + 1) / net.stations];
    const stationT = (station + 0.5) / net.stations;
    const zone = findZone(net.zones, station);
    for (const band of net.bands) {
      for (let sectorOnBand = 0; sectorOnBand < band.sectors; sectorOnBand += 1) {
        const sector = band.offset + sectorOnBand;
        const thetaBand = [sector / net.totalSectors, (sector + 1) / net.totalSectors];
        const localRhythm = zone?.rhythm || net.rhythm;
        let motif = zone?.motif || rhythmMotif(localRhythm, station);
        const marking = findOverride(net.markings, band.id, sectorOnBand, station);
        const voidCell = findOverride(net.voids, band.id, sectorOnBand, station);
        if (marking?.motif) motif = marking.motif;
        const excluded = Boolean(voidCell);
        const cell = {
          index,
          station,
          stationT,
          stationBand,
          radius: profileRadiusAt(net.profile, stationT),
          band: band.id,
          bandIndex: band.bandIndex,
          sector,
          sectorOnBand,
          thetaBand,
          angleDegBand: thetaBand.map((t) => t * 360),
          motif,
          motifRef: net.motifs[motif] || motif,
          zone: zone?.id || null,
          marking: marking?.id || null,
          void: voidCell?.id || null,
          excluded,
          seamPrev: sectorOnBand === 0 ? previousBand(net.bands, band.bandIndex) : null,
          seamNext: sectorOnBand === band.sectors - 1 ? nextBand(net.bands, band.bandIndex) : null,
          provenance: {
            kind: 'aircraftFuselageWrap',
            role: net.role,
            station,
            stationT,
            band: band.id,
            bandIndex: band.bandIndex,
            sectorOnBand,
            sector,
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

export function compileAircraftFuselageToSurfaceBands(netOrInput, options = {}) {
  const net = netOrInput?.kind === 'aircraftFuselageWrap' && Array.isArray(netOrInput.bands)
    ? netOrInput
    : resolveAircraftFuselageWrapNet(netOrInput);
  const cells = walkAircraftFuselageWrapNet(net, { includeExcluded: options.includeExcluded ?? true });
  const byBand = new Map();
  for (const band of net.bands) {
    byBand.set(band.id, {
      band: band.id,
      bandIndex: band.bandIndex,
      cols: net.stations,
      rows: band.sectors,
      cells: [],
    });
  }
  for (const cell of cells) {
    byBand.get(cell.band)?.cells.push(cell);
  }
  return {
    net,
    bands: [...byBand.values()],
    diagnostics: aircraftFuselageDiagnostics(net, cells),
  };
}

export function computeAircraftFuselagePlateLayout(netOrInput, {
  cellW = 16,
  cellH = 10,
  gap = 2,
  bandGap = 6,
  originX = 0,
  originY = 0,
  labelW = 72,
} = {}) {
  const net = netOrInput?.kind === 'aircraftFuselageWrap' && Array.isArray(netOrInput.bands)
    ? netOrInput
    : resolveAircraftFuselageWrapNet(netOrInput);
  const width = net.stations * cellW + Math.max(0, net.stations - 1) * gap;
  const bands = [];
  let y = originY;
  for (const band of net.bands) {
    const height = band.sectors * cellH + Math.max(0, band.sectors - 1) * gap;
    bands.push({
      band: band.id,
      bandIndex: band.bandIndex,
      x: originX + labelW,
      y,
      w: width,
      h: height,
      stations: net.stations,
      sectors: band.sectors,
      cellW,
      cellH,
      gap,
    });
    y += height + bandGap;
  }
  return {
    bounds: { width: labelW + width, height: Math.max(0, y - originY - bandGap) },
    bands,
  };
}

export function aircraftFuselageDiagnostics(net, cells = walkAircraftFuselageWrapNet(net, { includeExcluded: true })) {
  const warnings = [];
  const bandNames = new Set((net.bands || []).map((band) => band.id));
  for (const item of [...(net.markings || []), ...(net.voids || [])]) {
    if (item.band && !bandNames.has(item.band)) warnings.push(`${item.id} references unknown band '${item.band}'`);
  }
  return {
    cellsPlanned: net.stations * net.totalSectors,
    cellsRendered: cells.filter((cell) => !cell.excluded).length,
    cellsCulled: cells.filter((cell) => cell.excluded).length,
    zones: (net.zones || []).map((zone) => zone.id),
    bandSectors: Object.fromEntries((net.bands || []).map((band) => [band.id, band.sectors])),
    seam: net.seam,
    warnings,
  };
}

function previousBand(bands, bandIndex) {
  if (!bands.length) return null;
  return bands[(bandIndex - 1 + bands.length) % bands.length]?.id || null;
}

function nextBand(bands, bandIndex) {
  if (!bands.length) return null;
  return bands[(bandIndex + 1) % bands.length]?.id || null;
}
