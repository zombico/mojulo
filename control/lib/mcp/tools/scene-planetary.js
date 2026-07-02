/**
 * create_planetary — mint a space-accurate body hung in a full celestial sphere.
 *
 * Same fractal-generation philosophy as create_fractal_city / create_solid_turntable: the
 * operator passes a tiny RECIPE (a subject + a few knobs); the substrate stores ONLY that
 * recipe as a sketch manifest (`kind: 'planetary'`) — no geometry. The body, its graticule
 * MANDALA and its polar AXIS MUNDI are regenerated on demand and served as a live, traversable
 * three.js World at `/api/sketches/<ref>/world` (the rotatable-starmap basis: orbiting the
 * camera pans across a world-fixed, full-sphere starfield).
 *
 * Orbit-only — there is no CSS-3D `/scene` form (the body in a celestial sphere only reads
 * under a free-orbit camera), so this returns a `worldUrl`, not a `sceneUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planPlanetaryScene, PLANETARY_SUBJECTS } from '@/lib/graph/scene/scene-planetary';

export function mintPlanetary({ title, subject, seed, stars, sunU, sunH, sun, sunSize, sunGlow, obliquity, mandala, continents, blanket, relief, reliefScale, atmosphere, clouds, moon, moonAngle, moonScale, nightFill, datetime, live, viewBox, ref, folderRef } = {}) {
  const subjectKey = PLANETARY_SUBJECTS.includes(subject) ? subject : 'earth';
  // geo-lock: a FIXED real instant pins the Sun + Moon to their true positions. Resolve it to a
  // concrete ISO string so the stored manifest is deterministic — never persist 'now' here (it
  // would freeze to mint time). An unparseable datetime is dropped, not an error.
  const lockISO = (() => {
    if (!datetime || String(datetime).trim().toLowerCase() === 'now') return null;
    const d = new Date(datetime);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  })();
  // OPINIONATED 'mojulo earth': live geo-lock (Sun/Earth/Moon tracked to the CURRENT instant on
  // every render) is the DEFAULT for earth — unless the caller froze a `datetime` or is driving the
  // sun manually (sunU/sunH), or explicitly passed live:false. `datetime:'now'` also means live.
  const wantsLive = typeof live === 'boolean'
    ? live
    : (subjectKey === 'earth' && !lockISO && !Number.isFinite(+sunU) && !Number.isFinite(+sunH))
      || String(datetime || '').trim().toLowerCase() === 'now';
  const isLive = wantsLive && !lockISO;
  const manifest = {
    kind: 'planetary',
    subject: subjectKey,
    ...(Number.isFinite(+seed) ? { seed: +seed >>> 0 } : {}),
    ...(Number.isFinite(+stars) ? { stars: Math.max(0, +stars) } : {}),
    ...(Number.isFinite(+sunU) ? { sunU: +sunU } : {}),
    ...(Number.isFinite(+sunH) ? { sunH: +sunH } : {}),
    ...(typeof sun === 'boolean' ? { sun } : {}),
    ...(Number.isFinite(+sunSize) ? { sunSize: Math.max(0, +sunSize) } : {}),
    ...(Number.isFinite(+sunGlow) ? { sunGlow: Math.max(0, +sunGlow) } : {}),
    ...(Number.isFinite(+obliquity) ? { obliquity: +obliquity } : {}),
    ...(typeof mandala === 'boolean' ? { mandala } : {}),
    ...(typeof continents === 'boolean' ? { continents } : {}),
    ...(typeof blanket === 'boolean' ? { blanket } : {}),
    ...(typeof relief === 'boolean' ? { relief } : {}),
    ...(Number.isFinite(+reliefScale) ? { reliefScale: Math.max(0, +reliefScale) } : {}),
    ...(typeof atmosphere === 'boolean' ? { atmosphere } : {}),
    ...(typeof clouds === 'boolean' ? { clouds } : {}),
    ...(typeof moon === 'boolean' ? { moon } : {}),
    ...(Number.isFinite(+moonAngle) ? { moonAngle: +moonAngle } : {}),
    ...(Number.isFinite(+moonScale) ? { moonScale: Math.max(0, +moonScale) } : {}),
    ...(Number.isFinite(+nightFill) ? { nightFill: Math.max(0, Math.min(0.6, +nightFill)) } : {}),
    ...(lockISO ? { datetime: lockISO } : {}),
    ...(isLive ? { live: true } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(title ? { title } : {}),
  };

  // Resolve once to validate the recipe is renderable + return a face-count readout (no geometry is
  // persisted — only the recipe above is stored). For a LIVE manifest, resolve against the current
  // instant so the response's geoLock previews what the next render will show (the stored recipe has
  // no datetime — it re-resolves to 'now' on every /world load).
  const plan = planPlanetaryScene(isLive ? { ...manifest, datetime: new Date().toISOString() } : manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${plan.label} · planetary`,
      manifest, ref, folderRef: folderRef ?? null,
    });
  } catch (err) {
    if (err && /UNIQUE constraint failed/.test(err.message || '')) {
      throw new Error(`A sketch with ref '${ref}' already exists`);
    }
    throw err;
  }

  return {
    ok: true,
    ref: sketch.ref,
    worldUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/world`,
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    recipe: manifest,
    stats: { subject: plan.subject, faces: plan.faces.length, obliquity: plan.obliquity, live: isLive },
    // geo-lock readout: for a LIVE view this previews the CURRENT sky; every /world load re-resolves
    // to 'now', so the Sun/terminator/Moon keep tracking real time. Null only for manual (knob) mode.
    geoLock: plan.geoLock,
  };
}

export async function createPlanetaryHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_planetary requires a recipe object');
  }
  const { title, subject, seed, stars, sun_u: sunU, sun_h: sunH, sun, sun_size: sunSize, sun_glow: sunGlow, obliquity, mandala, continents, blanket, relief, relief_scale: reliefScale, atmosphere, clouds, moon, moon_angle: moonAngle, moon_scale: moonScale, night_fill: nightFill, datetime, live, viewBox, ref, folder_ref: folderRef } = input;
  return mintPlanetary({ title, subject, seed, stars, sunU, sunH, sun, sunSize, sunGlow, obliquity, mandala, continents, blanket, relief, reliefScale, atmosphere, clouds, moon, moonAngle, moonScale, nightFill, datetime, live, viewBox, ref, folderRef });
}

export function registerPlanetaryTools() {
  registerTool({
    name: 'create_planetary',
    description:
      "Mint a SPACE-ACCURATE planetary body hung in a full celestial sphere — Earth as it reads "
      + "from orbit: a sun-lit marble (day/night terminator, soft atmospheric limb), real coastlines traced "
      + "as a green wireframe (geography, NOT political borders), relative land ELEVATION shown as a "
      + "height-coloured hypsometric BLANKET draped over the continents (or as golden-angle radial spikes), "
      + "no horizon, stars in every direction. Built on the rotatable-starmap basis: a live, traversable "
      + "three.js World served at `/api/sketches/<ref>/world` (drag to ORBIT — the world-fixed starfield pans "
      + "as you go). You pass a tiny recipe (a SUBJECT + a few knobs); the substrate stores ONLY the recipe "
      + "(`manifest.kind === 'planetary'`, no geometry) and regenerates the body on render. The subject fixes "
      + "two things from its CORE: the AXIS MUNDI (the body's tilted polar axis, a pole-to-pole needle) and the "
      + "MANDALA (the radial graticule cage — equator + latitude rings + meridians). Currently the only subject "
      + "is 'earth' (a future 'sun'/'solar-system' subject would put the Sun at the core with an orbit-ring "
      + "ecliptic mandala). By DEFAULT an earth is the opinionated 'mojulo earth' view: LIVE geo-locked — the "
      + "Sun, day/night terminator and Moon are placed at their TRUE positions for the CURRENT instant and "
      + "re-resolve on every load (reload to advance), and the World ships Earth / Sun / Moon camera bookmarks. "
      + "Pass `datetime` to FREEZE a specific moment instead, or sun_u/sun_h to drive the sun by hand. "
      + "ORBIT-ONLY — there is no preset-shot CSS-3D `/scene` form; open the worldUrl. Reach for this on framing "
      + "like 'put Earth in space / a space-accurate globe / a live mojulo earth / Earth, Moon and Sun right now'.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        subject: { type: 'string', enum: [...PLANETARY_SUBJECTS], description: "The centre body (default 'earth') — fixes the axis mundi (its polar axis) and the mandala (its graticule)." },
        seed: { type: 'number', description: 'Star-field RNG seed (default 1) — same seed → same sky.' },
        stars: { type: 'number', description: 'Star density multiplier (default 1; 0 = empty void).' },
        sun_u: { type: 'number', description: 'Sun azimuth 0..1 around the body — drives where the day/night terminator falls (default 0.25).' },
        sun_h: { type: 'number', description: 'Sun elevation 0..1 relative to the equator (default 0.5 = on the equatorial plane).' },
        sun: { type: 'boolean', description: 'Pin the SUN itself as a bright luminary disc on the star sphere, at the real light direction (the lit hemisphere faces it). Default true; set false for a sun-lit body with no visible sun.' },
        sun_size: { type: 'number', description: 'Sun disc size multiplier (default 1).' },
        sun_glow: { type: 'number', description: 'Sun glow-halo brightness multiplier (default 1.3 — brighter than a horizon sun since it carries the scene against the void).' },
        obliquity: { type: 'number', description: 'Axial tilt of the axis mundi in degrees (default 23.4, Earth\'s obliquity).' },
        mandala: { type: 'boolean', description: 'Draw the graticule mandala + polar axis-mundi needle (default true).' },
        continents: { type: 'boolean', description: 'Trace real coastlines (Natural Earth 110m) as a green wireframe on the surface — geography, not borders (default true).' },
        blanket: { type: 'boolean', description: 'Drape a filled land surface over the continents, displaced by elevation and coloured DETERMINISTICALLY by height (hypsometric ramp, green→amber→snow); default true.' },
        relief: { type: 'boolean', description: 'Show relative land elevation as golden-angle (Fibonacci-sphere) radial spikes, hypsometric-coloured; peak ≈ 5px proud. Default false (the blanket supersedes it; set true for the bare spike field).' },
        relief_scale: { type: 'number', description: 'Multiplier on the relief spike height (default 1; e.g. 6 exaggerates mountains for a demo).' },
        atmosphere: { type: 'boolean', description: 'Draw the translucent atmospheric limb shell (default true).' },
        clouds: { type: 'boolean', description: 'Draw the wispy translucent cloud veils swirled by the general circulation (default true).' },
        moon: { type: 'boolean', description: 'Hang the MOON in the scene — a real companion body at TRUE scale (0.27 Earth radii) and TRUE mean distance (60.3 Earth radii), sun-lit so its phase is correct. As in reality it reads as a small, far disc. Default true.' },
        moon_angle: { type: 'number', description: "The Moon's orbital position in degrees from the sub-solar point — 0 new → 90 first/last-quarter → 180 full (default 90, a half-lit quarter moon just off Earth's limb in the opening frame). Higher/lower angles swing it toward gibbous/crescent and out of the default frame." },
        moon_scale: { type: 'number', description: 'Multiplier on the Moon radius (default 1 = true scale; raise it to exaggerate the disc for a demo).' },
        night_fill: { type: 'number', description: 'Night-side floor 0..0.6 — how far the dark (night) hemisphere is lifted out of pure black so it stays visible against the void with a readable day/night terminator (default 0.16 = a deep-navy night globe; 0 = photoreal near-black; 0.3+ = strongly visible night side). The Moon keeps its own low floor so its crescent phase still reads.' },
        datetime: { type: 'string', description: "FREEZE the scene to a fixed real instant (ISO 8601, e.g. '2026-06-17T22:30:00-04:00'). The Sun + Moon are placed at their TRUE positions for that time — real sub-solar point (day/night terminator over the right longitude), real sub-lunar direction, true lunar distance and real phase. Overrides sun_u / sun_h / moon_angle / obliquity and turns OFF live mode (a frozen snapshot, byte-identical on every re-render). Pass 'now' instead to mean live." },
        live: { type: 'boolean', description: "LIVE geo-lock: the Sun, day/night terminator and Moon track the CURRENT instant, re-resolved on every /world render (reload to advance). This is the DEFAULT for the 'earth' subject (the opinionated 'mojulo earth' view) unless you froze a `datetime` or are driving the sun by hand (sun_u/sun_h). Set false for a static knob-driven globe." },
        viewBox: { type: 'object', description: 'Optional render size { width, height } (default 1120×780).' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createPlanetaryHandler,
  });
}
