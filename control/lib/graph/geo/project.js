/**
 * Projection helpers — lon/lat -> viewBox pixel coords.
 *
 * Two projections ship in p0:
 *
 *   - `equirectangular-bbox` — fit the input bbox to the viewBox with a margin.
 *     Honest for a single named region (a country, a state). Lon and lat are
 *     mapped linearly with a single scale picked so the bbox fits the
 *     smaller viewBox dimension.
 *   - `web-mercator` — standard slippy-map projection. Honest for multi-region
 *     comparisons and world maps. The bbox is projected first, then fit to the
 *     viewBox the same way as equirectangular.
 *
 * Projection is declarative: the manifest records which one was used. A
 * replay against the same source + projection yields identical polygon marks.
 *
 * `pixelToleranceToDegrees` converts a target screen-pixel budget (default 0.5
 * px) into a degree tolerance that simplify.js applies in source space. We use
 * the bbox span as the conversion baseline so the tolerance tracks the actual
 * "how much degree-space is one pixel covering" for THIS specific render.
 */

export const PROJECTIONS = ['equirectangular-bbox', 'web-mercator'];

const MARGIN_FRACTION = 0.04;
const MERC_LIMIT = 85.05112878;

function clampLat(lat) {
  if (lat > MERC_LIMIT) return MERC_LIMIT;
  if (lat < -MERC_LIMIT) return -MERC_LIMIT;
  return lat;
}

export function lonLatToMercator(lon, lat) {
  const x = (lon * Math.PI) / 180;
  const clamped = clampLat(lat);
  const y = Math.log(Math.tan(Math.PI / 4 + (clamped * Math.PI) / 360));
  return [x, y];
}

export function computeBbox(rings) {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      if (lon < minLon) minLon = lon;
      if (lat < minLat) minLat = lat;
      if (lon > maxLon) maxLon = lon;
      if (lat > maxLat) maxLat = lat;
    }
  }
  if (!Number.isFinite(minLon) || !Number.isFinite(minLat)) {
    throw new Error('computeBbox: no finite coordinates in input rings');
  }
  return { minLon, minLat, maxLon, maxLat };
}

function viewBoxFit(viewBox, projWidth, projHeight) {
  const w = viewBox.width;
  const h = viewBox.height;
  const marginX = w * MARGIN_FRACTION;
  const marginY = h * MARGIN_FRACTION;
  const innerW = Math.max(1, w - 2 * marginX);
  const innerH = Math.max(1, h - 2 * marginY);
  const scale = Math.min(innerW / projWidth, innerH / projHeight);
  const drawnW = projWidth * scale;
  const drawnH = projHeight * scale;
  const offsetX = marginX + (innerW - drawnW) / 2;
  const offsetY = marginY + (innerH - drawnH) / 2;
  return { scale, offsetX, offsetY };
}

function projectEquirectangular(rings, bbox, viewBox) {
  const projWidth = bbox.maxLon - bbox.minLon;
  const projHeight = bbox.maxLat - bbox.minLat;
  if (!(projWidth > 0) || !(projHeight > 0)) {
    throw new Error('projectEquirectangular: bbox has zero extent — geometry is degenerate');
  }
  const { scale, offsetX, offsetY } = viewBoxFit(viewBox, projWidth, projHeight);
  return rings.map((ring) =>
    ring.map(([lon, lat]) => [
      offsetX + (lon - bbox.minLon) * scale,
      offsetY + (bbox.maxLat - lat) * scale,
    ]),
  );
}

function projectMercator(rings, bbox, viewBox) {
  const [minX, minY] = lonLatToMercator(bbox.minLon, bbox.minLat);
  const [maxX, maxY] = lonLatToMercator(bbox.maxLon, bbox.maxLat);
  const projWidth = maxX - minX;
  const projHeight = maxY - minY;
  if (!(projWidth > 0) || !(projHeight > 0)) {
    throw new Error('projectMercator: bbox has zero extent — geometry is degenerate');
  }
  const { scale, offsetX, offsetY } = viewBoxFit(viewBox, projWidth, projHeight);
  return rings.map((ring) =>
    ring.map(([lon, lat]) => {
      const [mx, my] = lonLatToMercator(lon, lat);
      return [offsetX + (mx - minX) * scale, offsetY + (maxY - my) * scale];
    }),
  );
}

export function projectRings(rings, { projection, viewBox, bbox }) {
  if (!Array.isArray(rings) || rings.length === 0) {
    throw new Error('projectRings: rings must be a non-empty array');
  }
  if (!viewBox || !(viewBox.width > 0) || !(viewBox.height > 0)) {
    throw new Error('projectRings: viewBox { width, height } required (positive numbers)');
  }
  const box = bbox || computeBbox(rings);
  switch (projection) {
    case 'equirectangular-bbox':
      return projectEquirectangular(rings, box, viewBox);
    case 'web-mercator':
      return projectMercator(rings, box, viewBox);
    default:
      throw new Error(
        `projectRings: unknown projection '${projection}' (expected one of: ${PROJECTIONS.join(', ')})`,
      );
  }
}

/**
 * Convert a screen-pixel budget into a degree tolerance that simplify.js can
 * apply pre-projection. The conversion uses the bbox span so simplification
 * tracks the actual pixels-per-degree of THIS render — a continent rendered
 * at 600px wide gets a different degree tolerance than a country rendered at
 * the same width.
 *
 * For equirectangular: 1 degree -> scale pixels. For mercator: the lon axis
 * is the same, so we use the lon span; this slightly under-simplifies in
 * lat (mercator stretches near the poles), which is the safe direction.
 */
export function pixelToleranceToDegrees({ pixelTolerance, bbox, viewBox }) {
  if (!(pixelTolerance > 0)) {
    throw new Error('pixelToleranceToDegrees: pixelTolerance must be positive');
  }
  const lonSpan = bbox.maxLon - bbox.minLon;
  const latSpan = bbox.maxLat - bbox.minLat;
  if (!(lonSpan > 0) || !(latSpan > 0)) return 0;
  const innerW = viewBox.width * (1 - 2 * MARGIN_FRACTION);
  const innerH = viewBox.height * (1 - 2 * MARGIN_FRACTION);
  const scale = Math.min(innerW / lonSpan, innerH / latSpan);
  return pixelTolerance / scale;
}
