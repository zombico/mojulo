/**
 * Sketch → live CSS preserve-3d scene HTML (the shared dispatch).
 *
 * Two callers depend on this: the HTTP route at /api/sketches/[ref]/scene (the
 * operator-facing live viewer) and the PNG rasterizer at /api/sketches/[ref]/png
 * (which loads the same HTML in headless Chromium and screenshots it). Keeping the
 * kind → emitter dispatch in one place means the baked PNG is always the same
 * scene the live viewer shows — no second source of truth for camera/lighting.
 *
 * Returns the HTML string, or null when the manifest is not an eligible scene
 * kind (the caller decides whether that's a 422 eligibility note or a fall-back
 * to the baked /svg path).
 */

import { renderRoomManifestToHtml, renderPaintedLandscapeToHtml } from '@/lib/graph/scene-css3d';
import { renderFractalCityToHtml } from '@/lib/graph/fractal-city';
import { renderTransportationHubToHtml } from '@/lib/graph/transportation-hub';
import { renderSolidTurntableToHtml } from '@/lib/graph/solid-turntable';
import { renderSubwayStationToHtml } from '@/lib/graph/subway-station';

/**
 * @param {{ title?: string, manifest: object }} sketch — a stored sketch row
 * @returns {string|null} self-contained scene HTML, or null if not scene-eligible
 */
export function renderSceneHtml(sketch) {
  const manifest = sketch?.manifest;
  if (!manifest || typeof manifest !== 'object') return null;

  // declarative scene lighting: `time` ('day'|'night') + `sky` may be authored at the
  // manifest top level OR under `scene` — normalize so the city kind reads them too (the
  // room renderer reads them from the manifest itself via resolveSceneLighting).
  const scene = manifest.scene && typeof manifest.scene === 'object' ? manifest.scene : {};
  const time = manifest.time ?? scene.time;
  const sky = manifest.sky ?? scene.sky;
  const title = sketch.title || manifest.title;

  // kind 'fractal-city' / 'css3d-turntable': the manifest IS the recipe — expand it on render
  // (zero stored geometry). Otherwise fall through to the two-point room renderer.
  if (manifest.kind === 'fractal-city') {
    return renderFractalCityToHtml({ ...manifest, time, sky, title: title || 'mojulo city' });
  }
  if (manifest.kind === 'transportation-hub') {
    return renderTransportationHubToHtml({ ...manifest, time, sky, title: title || 'mojulo transportation hub' });
  }
  if (manifest.kind === 'css3d-turntable') {
    return renderSolidTurntableToHtml({ ...manifest, title: title || 'mojulo solid' });
  }
  if (manifest.kind === 'subway-station') {
    return renderSubwayStationToHtml({ ...manifest, title: title || 'mojulo subway station' });
  }
  if (manifest.kind === 'painted-landscape') {
    return renderPaintedLandscapeToHtml(manifest, { title: title || 'mojulo terrain' });
  }
  return renderRoomManifestToHtml(manifest, { title: title || 'mojulo scene' });
}
