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

import { renderRoomManifestToHtml, renderPaintedLandscapeToHtml, resolveSceneLighting } from '@/lib/graph/scene/scene-css3d';
import { resolveWorldAudio, emitSceneSoundtrackScript } from '@/lib/graph/beats/beats-world';
import { resolveSignage } from '@/lib/graph/scene/signage-chrome';
import { renderFractalCityToHtml } from '@/lib/graph/city/fractal-city';
import { renderTransportationHubToHtml } from '@/lib/graph/architecture/transportation-hub';
import { renderSolidTurntableToHtml } from '@/lib/graph/worlds/solid-turntable';
import { renderSubwayStationToHtml } from '@/lib/graph/architecture/subway-station';
import { renderWorkbenchToHtml } from '@/lib/graph/worlds/workbench';
import { renderFloorplanToHtml } from '@/lib/graph/polygonizer/floorplan-structure';
import { renderRestaurantToHtml } from '@/lib/graph/polygonizer/floorplan-restaurant';
import { renderAssemblerToHtml } from '@/lib/graph/worlds/workbench-assembler';

/**
 * @param {{ title?: string, manifest: object }} sketch — a stored sketch row
 * @returns {string|null} self-contained scene HTML, or null if not scene-eligible
 */
export function renderSceneHtml(sketch, sceneOpts = {}) {
  const manifest = sketch?.manifest;
  if (!manifest || typeof manifest !== 'object') return null;
  return withSceneSoundtrack(dispatchSceneHtml(sketch, sceneOpts), manifest, sceneOpts);
}

// beats soundtrack on the CSS3D path (B4): a manifest `audio` block gets its
// soundtrack + wind injected as a self-contained <script> before </body> — the
// preserve-3d pages have no bus or gait, so no SFX. Never on capture runs (the
// PNG rasterizer passes capture:true), so bakes stay byte-identical to a
// soundtrack-less page; a manifest without `audio` is untouched either way.
function withSceneSoundtrack(html, manifest, sceneOpts) {
  if (!html || sceneOpts.capture === true) return html;
  if (!manifest.audio || typeof manifest.audio !== 'object') return html;
  const scene = manifest.scene && typeof manifest.scene === 'object' ? manifest.scene : {};
  const resolved = resolveWorldAudio(manifest.audio, { time: manifest.time ?? scene.time });
  const script = emitSceneSoundtrackScript(resolved);
  if (!script) return html;
  const at = html.lastIndexOf('</body>');
  if (at < 0) return html + script;
  return `${html.slice(0, at)}${script}\n${html.slice(at)}`;
}

function dispatchSceneHtml(sketch, sceneOpts = {}) {
  const manifest = sketch.manifest;

  // declarative scene lighting: `time` ('day'|'night') + `sky` may be authored at the
  // manifest top level OR under `scene` — normalize so the city kind reads them too (the
  // room renderer reads them from the manifest itself via resolveSceneLighting).
  const scene = manifest.scene && typeof manifest.scene === 'object' ? manifest.scene : {};
  const time = manifest.time ?? scene.time;
  const sky = manifest.sky ?? scene.sky;
  const title = sketch.title || manifest.title;

  // adaptive-signage: resolve the cross-backend annotation channel ONCE here and
  // thread `signs` into whichever scene renderer is dispatched (each forwards it
  // into emitPreserve3dScene). Chrome is derived from the scene's palette so a
  // night-city note glows like the city, a painted landscape note reads as paper.
  // No CSS-3D face access at this dispatch layer, so { object } anchors aren't
  // resolved to a world centroid here (they degrade to a screen slot); the
  // three.js /world path resolves object anchors at runtime via mesh userData.
  const { lighting } = resolveSceneLighting(manifest);
  const signs = resolveSignage(manifest.signage, {
    palette: {
      bg: manifest.bg,
      sky: sky ?? lighting?.sky,
      tint: lighting?.tint,
      ambient: lighting?.vexar?.ambient,
      lamps: lighting?.lamps,
      mood: time === 'night' ? 'night' : undefined,
    },
  });

  // kind 'fractal-city' / 'css3d-turntable': the manifest IS the recipe — expand it on render
  // (zero stored geometry). Otherwise fall through to the two-point room renderer.
  if (manifest.kind === 'fractal-city') {
    return renderFractalCityToHtml({ ...manifest, time, sky, signs, title: title || 'mojulo city' });
  }
  if (manifest.kind === 'transportation-hub') {
    return renderTransportationHubToHtml({ ...manifest, time, sky, signs, title: title || 'mojulo transportation hub' });
  }
  if (manifest.kind === 'workbench') {
    return renderWorkbenchToHtml({ ...manifest, signs, title: title || 'mojulo workbench' });
  }
  if (manifest.kind === 'assembler') {
    return renderAssemblerToHtml({ ...manifest, signs, title: title || 'mojulo assembler' });
  }
  if (manifest.kind === 'css3d-turntable') {
    return renderSolidTurntableToHtml({ ...manifest, signs, title: title || 'mojulo solid' });
  }
  if (manifest.kind === 'subway-station') {
    return renderSubwayStationToHtml({ ...manifest, signs, title: title || 'mojulo subway station' });
  }
  if (manifest.kind === 'painted-landscape') {
    return renderPaintedLandscapeToHtml(manifest, { title: title || 'mojulo terrain', signs });
  }
  if (manifest.kind === 'floorplan') {
    return renderFloorplanToHtml(manifest, { ...manifest, view: sceneOpts.view ?? manifest.view, signs, title: title || 'mojulo house' });
  }
  if (manifest.kind === 'restaurant') {
    return renderRestaurantToHtml(manifest, { ...manifest, view: sceneOpts.view ?? manifest.view, signs, title: title || 'mojulo restaurant' });
  }
  return renderRoomManifestToHtml(manifest, { title: title || 'mojulo scene', signs });
}
