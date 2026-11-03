/**
 * create_transportation_hub — an autogenerative TRANSIT-HUB mint, sibling to
 * create_fractal_city.
 *
 * Fractal-generation philosophy, end to end: the operator passes a tiny RECIPE
 * (mode + seed + a couple of knobs). The substrate stores ONLY that recipe as a
 * sketch manifest (`kind: 'transportation-hub'`) — no geometry. The full hub
 * (terminal, concourse fingers, gates/platforms/bays, apron, runways/rails/lanes,
 * parked aircraft/trains/buses) is regenerated DETERMINISTICALLY on render by
 * `/api/sketches/<ref>/scene`. Same seed always rebuilds the same hub; near-zero
 * tokens stored or transmitted.
 *
 * The scene is a self-contained, dependency-free CSS preserve-3d HTML page, riding
 * the sketch artifact system exactly like the other illustration mints (the
 * discriminator is `manifest.kind`).
 *
 * Stored manifest (the whole recipe):
 *   { kind:'transportation-hub', mode, seed, density, primary?, asymmetry?, chirality?, region?, viewBox?, time?, title? }
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planTransportationHub, HUB_MODES, AIRPORT_GLYPHS, AIRPORT_PRIMARIES } from '@/lib/graph/architecture/transportation-hub';
import { planSubwayStation, SUBWAY_LINES } from '@/lib/graph/architecture/subway-station';
import { planAirport, AIRPORT_GLYPHS as AIRPORT_PLAN_GLYPHS } from '@/lib/graph/airport/plan';
import { MINIATURE_SCALES, AIRPORT_SHOWS } from '@/lib/graph/airport/miniature';
import { WING_SHOWS } from '@/lib/graph/airport/wing';
import { stackSubway, planSubwayInterchange } from '@/lib/graph/architecture/subway-building';
import { warmScenePng } from '@/lib/graph/scene/scene-png-warm';

// The hub tool's user-facing modes: the exterior apron modes plus the INTERIOR
// subway station (a distinct render path — it persists as a `subway-station` scene
// kind, not `transportation-hub`, so it routes through the CSS-3D /scene + PNG path
// instead of the three.js /world path).
const TRANSPORT_MODES = [...HUB_MODES, 'subway'];

// Shared persist + return for both subway shapes.
function persistSubway(manifest, { title, ref, folderRef, fallbackTitle }) {
  const sketch = SketchRepository.create({ title: title || fallbackTitle, manifest, ref, folderRef: folderRef ?? null });
  warmScenePng(sketch);   // background pre-bake of the gallery preview PNG
  return {
    ok: true,
    ref: sketch.ref,
    worldUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/world`,   // traversable fly-through
    sceneUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/scene`,
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    recipe: manifest,
  };
}

// Mint the interior subway station: a single island-platform hall, three-quarter
// establishing view, train parked at the platform. Persists ONLY the recipe.
function mintSubwayStation({ title, seed, density, line, atmosphere, fog, audio, viewBox, ref, folderRef } = {}) {
  const manifest = {
    kind: 'subway-station',
    seed: Number.isFinite(+seed) ? Math.trunc(+seed) : 1,
    density: Number.isFinite(+density) ? Math.max(0.2, Math.min(1, +density)) : 0.6,
    ...(SUBWAY_LINES.includes(line) ? { line } : {}),
    ...(atmosphere ? { atmosphere: true } : {}),
    // opt-in volumetric fog (effects-layer P3.5) — `true` or a tuning object;
    // absent/invalid ⇒ not stored ⇒ no fog. Clips against the plan's occluders
    // via the world-kinds fogBoxes extractor; renders on the live /world path only.
    ...(fog === true || (fog && typeof fog === 'object' && !Array.isArray(fog)) ? { fog } : {}),
    // opt-in audio channel (beats.plan.md) — soundtrack / wind / sfx cues; /world only.
    ...(audio && typeof audio === 'object' && !Array.isArray(audio) ? { audio } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(title ? { title } : {}),
  };
  const { stats } = planSubwayStation(manifest);   // validate + stat readout (no geometry stored)
  return { ...persistSubway(manifest, { title, ref, folderRef, fallbackTitle: `subway ${manifest.seed}` }), stats };
}

// Mint the 2-LEVEL subway BUILDING: the platform hall stacked under a mezzanine concourse
// (fare line + turnstiles + operator booth + ticket machines) joined by stair/escalator/
// elevator through a void. A `subway-building` /world kind — tiling, marble, glass and the
// optional atmospheric relight all render here. Persists ONLY the recipe.
function mintSubwayBuilding({ title, seed, density, line, lineB, gates, atmosphere, audio, layout, viewBox, ref, folderRef } = {}) {
  const interchange = layout === 'interchange';
  const manifest = {
    kind: 'subway-building',
    seed: Number.isFinite(+seed) ? Math.trunc(+seed) : 1,
    density: Number.isFinite(+density) ? Math.max(0.2, Math.min(1, +density)) : 0.6,
    ...(SUBWAY_LINES.includes(line) ? { line } : {}),
    // INTERCHANGE variation: a second perpendicular platform stacked above (Bloor-Yonge / St George).
    ...(interchange ? { layout: 'interchange' } : {}),
    ...(interchange && SUBWAY_LINES.includes(lineB) ? { lineB } : {}),
    ...(Number.isFinite(+gates) ? { mezzanine: { gates: Math.max(2, Math.min(8, Math.trunc(+gates))) } } : {}),
    ...(atmosphere ? { atmosphere: true } : {}),
    // opt-in audio channel — the generic /world audio path (beats.plan.md). NOTE: no `fog`
    // here yet — subway-building declares no fogBoxes extractor, and storing a key the
    // renderer ignores is exactly the silent-gap this pass is closing.
    ...(audio && typeof audio === 'object' && !Array.isArray(audio) ? { audio } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(title ? { title } : {}),
  };
  // validate + stat readout via the layout's own builder (no geometry stored — recipe only)
  const { stats } = interchange ? planSubwayInterchange(manifest) : stackSubway(manifest);
  return { ...persistSubway(manifest, { title, ref, folderRef, fallbackTitle: `subway ${interchange ? 'interchange' : 'building'} ${manifest.seed}` }), stats };
}

// Mint the AIRPORT at its real figures (airport/plan.js), drawn whole as a miniature on a plinth: a /world `airport`.
// Persists only the recipe; the plan is laid once to validate it and read its stats.
function mintAirport({ title, seed, glyph, chirality, asymmetry, stands, show, scale, wing, crews, viewBox, ref, folderRef } = {}) {
  const manifest = {
    kind: 'airport',
    seed: Number.isFinite(+seed) ? Math.trunc(+seed) : 1,
    show: show ?? 'miniature',
    ...(AIRPORT_PLAN_GLYPHS.includes(glyph) ? { glyph } : {}),
    ...(+chirality === 1 || +chirality === -1 ? { chirality: +chirality } : {}),
    ...(Number.isFinite(+asymmetry) ? { asymmetry: Math.max(0, Math.min(1, +asymmetry)) } : {}),
    ...(Number.isFinite(+stands) ? { stands: Math.max(1, Math.min(40, Math.trunc(+stands))) } : {}),
    ...(Number.isFinite(+scale) ? { scale: Math.max(MINIATURE_SCALES[0], Math.min(MINIATURE_SCALES[1], +scale)) } : {}),
    ...(typeof wing === 'string' ? { wing } : {}),
    ...(WING_SHOWS.includes(crews) ? { crews } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(title ? { title } : {}),
  };
  if (!AIRPORT_SHOWS.includes(manifest.show)) throw new Error(`compose_world transport-hub: an airport's show is ${AIRPORT_SHOWS.join(' | ')} (the whole plan as a model, or one wing at full scale)`);
  const plan = planAirport(manifest), { stats } = plan;
  if (manifest.wing && !plan.wings[manifest.wing]) throw new Error(`compose_world transport-hub: '${manifest.wing}' is no wing of this airport (${Object.keys(plan.wings).join(', ')})`);
  return { ...persistSubway(manifest, { title, ref, folderRef, fallbackTitle: `airport ${manifest.seed}` }), stats };
}

export function mintTransportationHub({ title, mode, seed, density, depth, glyph, primary, asymmetry, chirality, line, lineB, building, layout, atmosphere, fog, audio, gates, region, viewBox, time, ref, folderRef, show, stands, scale, wing, crews } = {}) {
  // (an airport asked to be shown as a model, at its real figures: the airport kind, not the CSS diorama)
  if ((mode === undefined || mode === 'airport') && show !== undefined) return mintAirport({ title, seed, glyph, chirality, asymmetry, stands, show, scale, wing, crews, viewBox, ref, folderRef });
  // The interior subway is a distinct render path — delegate early. `building` mints the
  // 2-level station+concourse (a /world `subway-building`); `layout:'interchange'` makes it a
  // perpendicular two-line interchange; otherwise the single hall.
  if (mode === 'subway') {
    return (building || layout === 'interchange')
      ? mintSubwayBuilding({ title, seed, density, line, lineB, gates, atmosphere, audio, layout, viewBox, ref, folderRef })
      : mintSubwayStation({ title, seed, density, line, atmosphere, fog, audio, viewBox, ref, folderRef });
  }
  const manifest = {
    kind: 'transportation-hub',
    mode: HUB_MODES.includes(mode) ? mode : 'airport',
    seed: Number.isFinite(+seed) ? Math.trunc(+seed) : 1,
    density: Number.isFinite(+density) ? Math.max(0.2, Math.min(1, +density)) : 0.6,
    ...(Number.isFinite(+depth) ? { depth: Math.max(1, Math.min(3, Math.trunc(+depth))) } : {}),
    ...(AIRPORT_GLYPHS.includes(glyph) ? { glyph } : {}),
    ...(AIRPORT_PRIMARIES.includes(primary) ? { primary } : {}),
    ...(Number.isFinite(+asymmetry) ? { asymmetry: Math.max(0, Math.min(1, +asymmetry)) } : {}),
    ...(+chirality === 1 || +chirality === -1 ? { chirality: +chirality } : {}),
    ...(time === 'day' || time === 'night' ? { time } : {}),
    ...(region && typeof region === 'object' ? { region } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(title ? { title } : {}),
  };

  // Expand once to validate the recipe is renderable + return a stat readout (no
  // geometry is persisted — only the recipe above is stored).
  const { stats } = planTransportationHub(manifest);

  const sketch = SketchRepository.create({
      title: title || `${manifest.mode} ${manifest.seed}`,
      manifest, ref, folderRef: folderRef ?? null,
    });

  warmScenePng(sketch);   // background pre-bake of the gallery preview PNG

  return {
    ok: true,
    ref: sketch.ref,
    worldUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/world`,
    sceneUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/scene`,
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    recipe: manifest,
    stats,
  };
}

export async function createTransportationHubHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('compose_world({ base: "transport-hub" }) requires a recipe object');
  }
  const { title, mode, seed, density, depth, glyph, primary, asymmetry, chirality, line, line_b: lineB, building, layout, atmosphere, fog, audio, gates, region, viewBox, time, ref, folder_ref: folderRef, show, stands, scale, wing, crews } = input;
  return mintTransportationHub({ title, mode, seed, density, depth, glyph, primary, asymmetry, chirality, line, lineB, building, layout, atmosphere, fog, audio, gates, region, viewBox, time, ref, folderRef, show, stands, scale, wing, crews });
}
