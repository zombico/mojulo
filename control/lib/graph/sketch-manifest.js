/**
 * Sketch manifest shape — what create_sketch accepts and what
 * /sketches/<ref> renders.
 *
 * Reuses the existing CreationMap renderer's vocab so we don't fork the
 * SVG layer:
 *   - Station kinds:  input | mcp_tool | filesystem | db_row
 *   - Edge `via`:     'right' (route around the right channel)
 *
 * The agent positions stations with explicit x/y/w/h — same burden the
 * curated app-creation map already carries. Auto-layout is a deferred
 * stretch; if the agent's manifests start looking brittle, that's the
 * first thing to add.
 */

export const STATION_KINDS = ['input', 'mcp_tool', 'filesystem', 'db_row'];
const STATION_KIND_SET = new Set(STATION_KINDS);
export const EDGE_VIA_VALUES = ['right', 'left', 'top', 'bottom'];
const EDGE_VIA_SET = new Set(EDGE_VIA_VALUES);

// Curvature clamps the cubic Bezier's control-point offset on the dominant
// axis. 1 is the original S-curve; > 1 makes the arc swoop wider (useful
// when an edge would otherwise read as a near-straight line through
// another station's territory); < 1 flattens it (useful for short hops
// where a tight S looks awkward).
const CURVATURE_MIN = 0.2;
const CURVATURE_MAX = 3;

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function validateStation(station, idx, errors) {
  if (!station || typeof station !== 'object') {
    errors.push(`stations[${idx}] must be an object`);
    return;
  }
  if (!station.id || typeof station.id !== 'string') {
    errors.push(`stations[${idx}].id is required (string)`);
  }
  if (!STATION_KIND_SET.has(station.kind)) {
    errors.push(
      `stations[${idx}].kind must be one of: ${STATION_KINDS.join(', ')} (got '${station.kind}')`,
    );
  }
  if (!station.label || typeof station.label !== 'string') {
    errors.push(`stations[${idx}].label is required (string)`);
  }
  for (const k of ['x', 'y', 'w', 'h']) {
    if (!isFiniteNumber(station[k])) {
      errors.push(`stations[${idx}].${k} must be a finite number`);
    }
  }
  if (station.items !== undefined) {
    if (!Array.isArray(station.items) || station.items.some((it) => typeof it !== 'string')) {
      errors.push(`stations[${idx}].items must be an array of strings if provided`);
    }
  }
  if (station.sublabel !== undefined && typeof station.sublabel !== 'string') {
    errors.push(`stations[${idx}].sublabel must be a string if provided`);
  }
}

function validateEdge(edge, idx, stationIds, errors) {
  if (!edge || typeof edge !== 'object') {
    errors.push(`edges[${idx}] must be an object`);
    return;
  }
  if (!edge.from || typeof edge.from !== 'string') {
    errors.push(`edges[${idx}].from is required (string)`);
  } else if (!stationIds.has(edge.from)) {
    errors.push(`edges[${idx}].from='${edge.from}' does not match any station id`);
  }
  if (!edge.to || typeof edge.to !== 'string') {
    errors.push(`edges[${idx}].to is required (string)`);
  } else if (!stationIds.has(edge.to)) {
    errors.push(`edges[${idx}].to='${edge.to}' does not match any station id`);
  }
  if (edge.label !== undefined && typeof edge.label !== 'string') {
    errors.push(`edges[${idx}].label must be a string if provided`);
  }
  if (edge.via !== undefined && !EDGE_VIA_SET.has(edge.via)) {
    errors.push(
      `edges[${idx}].via must be one of: ${EDGE_VIA_VALUES.join(', ')} (got '${edge.via}')`,
    );
  }
  if (edge.curvature !== undefined) {
    if (!isFiniteNumber(edge.curvature)) {
      errors.push(`edges[${idx}].curvature must be a finite number if provided`);
    } else if (edge.curvature < CURVATURE_MIN || edge.curvature > CURVATURE_MAX) {
      errors.push(
        `edges[${idx}].curvature must be between ${CURVATURE_MIN} and ${CURVATURE_MAX} (got ${edge.curvature})`,
      );
    }
  }
}

export function validateSketchManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object') {
    return { ok: false, errors: ['manifest must be an object'] };
  }
  if (!manifest.title || typeof manifest.title !== 'string') {
    errors.push('manifest.title is required (string)');
  }
  if (!manifest.viewBox || typeof manifest.viewBox !== 'object') {
    errors.push('manifest.viewBox is required ({ width, height })');
  } else {
    if (!isFiniteNumber(manifest.viewBox.width) || manifest.viewBox.width <= 0) {
      errors.push('manifest.viewBox.width must be a positive number');
    }
    if (!isFiniteNumber(manifest.viewBox.height) || manifest.viewBox.height <= 0) {
      errors.push('manifest.viewBox.height must be a positive number');
    }
  }
  if (!Array.isArray(manifest.stations) || manifest.stations.length === 0) {
    errors.push('manifest.stations must be a non-empty array');
  } else {
    manifest.stations.forEach((s, i) => validateStation(s, i, errors));
    const ids = manifest.stations.map((s) => s?.id).filter((id) => typeof id === 'string');
    const seen = new Set();
    for (const id of ids) {
      if (seen.has(id)) errors.push(`stations[].id='${id}' is duplicated; ids must be unique`);
      seen.add(id);
    }
  }
  const stationIds = new Set(
    Array.isArray(manifest.stations)
      ? manifest.stations.map((s) => s?.id).filter((id) => typeof id === 'string')
      : [],
  );
  if (manifest.edges !== undefined) {
    if (!Array.isArray(manifest.edges)) {
      errors.push('manifest.edges must be an array if provided');
    } else {
      manifest.edges.forEach((e, i) => validateEdge(e, i, stationIds, errors));
    }
  }
  return { ok: errors.length === 0, errors };
}
