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
import { registerTool } from '@/lib/mcp/server';
import { planTransportationHub, HUB_MODES, AIRPORT_GLYPHS, AIRPORT_PRIMARIES } from '@/lib/graph/architecture/transportation-hub';
import { planSubwayStation, SUBWAY_LINES } from '@/lib/graph/architecture/subway-station';
import { stackSubway, planSubwayInterchange } from '@/lib/graph/architecture/subway-building';
import { warmScenePng } from '@/lib/graph/scene/scene-png-warm';

// The hub tool's user-facing modes: the exterior apron modes plus the INTERIOR
// subway station (a distinct render path — it persists as a `subway-station` scene
// kind, not `transportation-hub`, so it routes through the CSS-3D /scene + PNG path
// instead of the three.js /world path).
const TRANSPORT_MODES = [...HUB_MODES, 'subway'];

// Shared persist + return for both subway shapes.
function persistSubway(manifest, { title, ref, folderRef, fallbackTitle }) {
  let sketch;
  try {
    sketch = SketchRepository.create({ title: title || fallbackTitle, manifest, ref, folderRef: folderRef ?? null });
  } catch (err) {
    if (err && /UNIQUE constraint failed/.test(err.message || '')) throw new Error(`A sketch with ref '${ref}' already exists`);
    throw err;
  }
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
function mintSubwayStation({ title, seed, density, line, atmosphere, viewBox, ref, folderRef } = {}) {
  const manifest = {
    kind: 'subway-station',
    seed: Number.isFinite(+seed) ? Math.trunc(+seed) : 1,
    density: Number.isFinite(+density) ? Math.max(0.2, Math.min(1, +density)) : 0.6,
    ...(SUBWAY_LINES.includes(line) ? { line } : {}),
    ...(atmosphere ? { atmosphere: true } : {}),
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
function mintSubwayBuilding({ title, seed, density, line, lineB, gates, atmosphere, layout, viewBox, ref, folderRef } = {}) {
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
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(title ? { title } : {}),
  };
  // validate + stat readout via the layout's own builder (no geometry stored — recipe only)
  const { stats } = interchange ? planSubwayInterchange(manifest) : stackSubway(manifest);
  return { ...persistSubway(manifest, { title, ref, folderRef, fallbackTitle: `subway ${interchange ? 'interchange' : 'building'} ${manifest.seed}` }), stats };
}

export function mintTransportationHub({ title, mode, seed, density, depth, glyph, primary, asymmetry, chirality, line, lineB, building, layout, atmosphere, gates, region, viewBox, time, ref, folderRef } = {}) {
  // The interior subway is a distinct render path — delegate early. `building` mints the
  // 2-level station+concourse (a /world `subway-building`); `layout:'interchange'` makes it a
  // perpendicular two-line interchange; otherwise the single hall.
  if (mode === 'subway') {
    return (building || layout === 'interchange')
      ? mintSubwayBuilding({ title, seed, density, line, lineB, gates, atmosphere, layout, viewBox, ref, folderRef })
      : mintSubwayStation({ title, seed, density, line, atmosphere, viewBox, ref, folderRef });
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

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${manifest.mode} ${manifest.seed}`,
      manifest, ref, folderRef: folderRef ?? null,
    });
  } catch (err) {
    if (err && /UNIQUE constraint failed/.test(err.message || '')) {
      throw new Error(`A sketch with ref '${ref}' already exists`);
    }
    throw err;
  }

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
    throw new Error('create_transportation_hub requires a recipe object');
  }
  const { title, mode, seed, density, depth, glyph, primary, asymmetry, chirality, line, line_b: lineB, building, layout, atmosphere, gates, region, viewBox, time, ref, folder_ref: folderRef } = input;
  return mintTransportationHub({ title, mode, seed, density, depth, glyph, primary, asymmetry, chirality, line, lineB, building, layout, atmosphere, gates, region, viewBox, time, ref, folderRef });
}

export function registerSceneTransportHubTools() {
  registerTool({
    name: 'create_transportation_hub',
    description:
      "Mint a 3D TRANSPORTATION HUB from a tiny RECIPE — the fractal-generation path, a sibling of "
      + "create_fractal_city tuned to transit. You pass a `mode` plus a seed; the substrate stores ONLY the "
      + "recipe (no geometry) and regenerates the whole hub deterministically on render, so it costs almost no "
      + "tokens and the same seed always rebuilds the same hub. The result is a live, dependency-free CSS "
      + "preserve-3d HTML scene served at `/api/sketches/<ref>/scene` (open it / embed it in an <iframe>); same "
      + "artifact system as the other illustration mints (persists with `manifest.kind === 'transportation-hub'`). "
      + "Unlike the uniform building-block grid of a city, a hub is organized around an anchor terminal that "
      + "sprouts concourse FINGERS, each fractally filled with its mode's repeated unit. Three modes: "
      + "`airport` (glass terminal + control tower + concourse piers with jet-bridge gates + parked aircraft + "
      + "apron + taxiway + runways), `train-station` (head-house + parallel platforms with canopies + rail "
      + "tracks + multi-car trains + a footbridge), `bus-terminal` (concourse + a sawtooth row of angled bus "
      + "bays + parked buses + drive lanes). Floodlight masts light the apron at night. A fourth mode, "
      + "`subway`, is the INTERIOR sibling: instead of an exterior top-down apron, it renders the inside of a "
      + "wide enclosed island-platform hall — central platform with a track trough on each side, columns marching "
      + "down the platform, tiled walls + a station-name frieze, a glowing ceiling-fixture strip, tunnel portals, "
      + "and a multi-car train parked broadside (accurate cars with a laid-out interior — bench seats + poles + "
      + "glass) — framed as a three-quarter establishing shot looking across the hall. Pass `building: true` for the "
      + "2-LEVEL version: that hall stacked under a mezzanine CONCOURSE (a full-width fare line of turnstiles + an "
      + "operator booth + ticket machines + a wall map) joined by stair / escalator / elevator through a void — a "
      + "traversable `subway-building` /world kind with tiled pillars, brick-bond walls and a marble floor. Either "
      + "shape takes `atmosphere: true` for a moody traced-light relight (dark base + ceiling-fixture light pools + "
      + "cast shadows) on its /world view. (The single hall persists as a `subway-station` scene kind with a baked "
      + "/scene + PNG; the building persists as `subway-building`, /world.) Reach for this on framing like 'make an "
      + "airport / train station / bus terminal / subway station / a transit hub'.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        mode: { type: 'string', enum: TRANSPORT_MODES, description: "Hub mode (default 'airport'): 'airport' | 'train-station' | 'bus-terminal' | 'subway' (interior station hall)." },
        line: { type: 'string', enum: SUBWAY_LINES, description: "Subway only: line colour theme for the train band / frieze / roundels ('blue' | 'red' | 'green' | 'orange'). Omit to pick by seed." },
        building: { type: 'boolean', description: 'Subway only: mint the 2-LEVEL building — the platform hall under a mezzanine concourse (fare line + turnstiles + operator booth + ticket machines + wall map) joined by stair/escalator/elevator through a void. A traversable `subway-building` /world kind (vs the single-hall `subway-station`). Default false.' },
        layout: { type: 'string', enum: ['standard', 'interchange'], description: "Subway building only: 'standard' (platform under a mezzanine, default) or 'interchange' — a perpendicular TWO-LINE crossing where a N-S platform sits below an E-W platform, joined by escalators through a punched crossing void (Toronto's Bloor-Yonge / St George). Implies the building." },
        line_b: { type: 'string', enum: SUBWAY_LINES, description: "Interchange only: line colour for the SECOND (upper, E-W) platform ('blue' | 'red' | 'green' | 'orange'). Omit to auto-pick a contrasting line." },
        atmosphere: { type: 'boolean', description: 'Subway only: render with the atmospheric traced-diffusion relight — a dark low-ambient base with warm light pools at the ceiling fixtures + cast shadows (the moody chiaroscuro look), instead of the bright even lighting. Shows on the /world view. Default false.' },
        gates: { type: 'integer', minimum: 2, maximum: 8, description: 'Subway building only: number of turnstile lanes on the fare line (2–8, default 5).' },
        seed: { type: 'integer', description: 'Deterministic seed — the whole hub is a pure function of it. Same seed → same hub.' },
        density: { type: 'number', minimum: 0.2, maximum: 1, description: 'How full the gates/platforms/bays are with parked vehicles, 0.2–1 (default 0.6).' },
        depth: { type: 'integer', minimum: 1, maximum: 3, description: 'Airport only: boarding-corridor branch depth (default 2). Higher → concourses manji-hook further from the central terminal.' },
        glyph: { type: 'string', enum: AIRPORT_GLYPHS, description: "Airport only: coarse terminal topology — 'radial' (central polygon mandala + radiating concourses) or 'linear' (a long spine with perpendicular finger bays). Omit to derive from `primary`/seed." },
        primary: { type: 'string', enum: AIRPORT_PRIMARIES, description: "Airport only: the DOMINANT shape — 'core' (big central headhouse + radiating arms), 'spine' (a long dominant concourse spine), or 'hammerhead' (a primary pier ending in a perpendicular cross-bar). Omit to pick by seed." },
        asymmetry: { type: 'number', minimum: 0, maximum: 1, description: 'Airport only: how far the layout breaks from regular symmetry, 0–1 (default 0.6). Higher → more varied arm lengths/angles and more stub arms.' },
        chirality: { type: 'integer', enum: [1, -1], description: 'Airport only: the rotational sense of the manji hooks (the pinwheel). 1 or -1; omit to pick by seed.' },
        time: { type: 'string', enum: ['day', 'night'], description: "Optional daylight model: 'day' (sun + cast shadows + day sky) or 'night' (flood-mast light pools + moonlight + stars)." },
        region: { type: 'object', description: 'Optional world footprint { x, y, w, d } (default a 40×34 apron).' },
        viewBox: { type: 'object', description: 'Optional render viewBox { width, height }.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createTransportationHubHandler,
  });
}
