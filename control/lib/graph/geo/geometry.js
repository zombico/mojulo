/**
 * Normalize a GeoJSON geometry to a flat list of polygon rings, each tagged
 * with whether it is an outer ring or a hole.
 *
 * Input: a GeoJSON `Polygon` or `MultiPolygon` (the two shapes we get back
 * from Natural Earth + Nominatim). Output: `[{ ring: [[lon, lat], ...], role: 'outer' | 'hole', polygonIndex }]`.
 *
 * The map pipeline turns each entry into a single `polygon` mark. The renderer
 * does not understand multi-polygons with holes natively — we paint holes by
 * stacking them above their parent outer ring with a background fill, sorted
 * by z. Each ring carries `polygonIndex` so the orchestrator can pair holes
 * with their parent outer for stable z assignment.
 */

export function normalizeGeometry(geometry) {
  if (!geometry || typeof geometry !== 'object') {
    throw new Error('normalizeGeometry: input must be a GeoJSON geometry object');
  }
  const { type, coordinates } = geometry;
  if (type === 'Polygon') {
    return ringsFromPolygon(coordinates, 0);
  }
  if (type === 'MultiPolygon') {
    const out = [];
    coordinates.forEach((poly, i) => {
      for (const r of ringsFromPolygon(poly, i)) out.push(r);
    });
    return out;
  }
  throw new Error(
    `normalizeGeometry: unsupported geometry type '${type}' (expected Polygon or MultiPolygon)`,
  );
}

function ringsFromPolygon(poly, polygonIndex) {
  if (!Array.isArray(poly) || poly.length === 0) {
    throw new Error('ringsFromPolygon: polygon coordinates must be a non-empty array of rings');
  }
  return poly.map((ring, idx) => {
    if (!Array.isArray(ring) || ring.length < 4) {
      throw new Error(
        `ringsFromPolygon: ring at polygon ${polygonIndex}/${idx} has fewer than 4 vertices`,
      );
    }
    return {
      ring: ring.map(([lon, lat]) => [Number(lon), Number(lat)]),
      role: idx === 0 ? 'outer' : 'hole',
      polygonIndex,
    };
  });
}
