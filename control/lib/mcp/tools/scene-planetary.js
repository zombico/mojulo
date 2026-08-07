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
