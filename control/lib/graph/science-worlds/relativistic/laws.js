/**
 * The relativistic law table: spacetime curved by one non-rotating mass (Schwarzschild), and what moves in it. A
 * relativistic world is one SYSTEM, and each row but the spacetime belongs to one:
 *
 *   light   what an observer sees: light bent round the mass, the shadow, a thin disk's lensed and shifted glow.
 *           Drawn by a shader that traces each pixel's light back (science-worlds/shader.js), held to JS.
 *   orbit   test bodies on geodesics: the orbit's slow turn (perihelion advance), and the plunge inside 3 Rs.
 *   clocks  clocks held at radii, and one let fall: gravitational time dilation against a far clock.
 *
 * Inside, lengths are in Schwarzschild radii (Rs = 2GM/c²) and times in Rs/c; the page and the readout give SI.
 * The stance is the quantum scale's: the mathematics of each row is exact (the geodesic equations, the closed
 * forms), what is drawn of it is a picture. Every row carries its sources and the date it was last reviewed.
 *
 *   row = { id, system ('*' for every system), words, summary, assumption, params, example, sources, reviewed }
 */

export const G = 6.67430e-11;         // m³/(kg·s²) (CODATA 2018)
export const C = 299792458;           // m/s (exact)
export const M_SUN = 1.98840987e30;   // kg (IAU 2015 nominal GM☉ / CODATA 2018 G)
export const rsOf = (mass) => (2 * G * mass) / (C * C);

const REVIEWED = '2026-10-19';
const MTW = 'Misner, Thorne & Wheeler, Gravitation (1973), ch. 25';
const CARROLL = 'Carroll, Spacetime and Geometry (2004), §5.4–5.6';
const HARTLE = 'Hartle, Gravity: An Introduction to Einstein\'s General Relativity (2003), ch. 9–11';
const CODATA = 'CODATA 2018 recommended values (NIST); IAU 2015 Resolution B3 (nominal solar values)';

export const RELATIVISTIC_LAWS = [
  {
    id: 'schwarzschild',
    system: '*',
    words: ['black hole', 'spacetime', 'curved spacetime', 'general relativity', 'gravity well', 'event horizon'],
    params: { mass: { dim: 'mass', required: true } },
    summary: 'The spacetime round one non-rotating, uncharged `mass` (Schwarzschild). Its horizon is at Rs = 2GM/c²; light circles it at 1.5 Rs; nothing orbits stably inside 3 Rs.',
    assumption: 'The mass does not spin and carries no charge; nothing else bends spacetime (the bodies and the disk are test matter).',
    example: { system: 'clocks', laws: [{ law: 'schwarzschild', mass: '10 M☉' }, { law: 'clock', at: '1000 km' }, { law: 'clock', at: '100 km' }, { law: 'clock', at: '300 km', falls: true }], duration: '8 ms' },
    sources: [MTW, CARROLL, CODATA], reviewed: REVIEWED,
  },
  {
    id: 'observer',
    system: 'light',
    words: ['observer', 'camera', 'view', 'inclination', 'distance'],
    params: { distance: { dim: 'length', required: true, rs: true }, inclination: { dim: 'scalar', default: 1.2 } },
    summary: 'Where the light ends: an observer held still at `distance` (a length, or `\'20 Rs\'`), looking at the mass from `inclination` (from the disk\'s axis; 0 is face-on).',
    assumption: 'The observer is held still (static); light\'s travel time to the eye is not shown.',
    example: { system: 'light', laws: [{ law: 'schwarzschild', mass: '10 M☉' }, { law: 'observer', distance: '30 Rs', inclination: '75°' }, { law: 'disk', outer: '12 Rs' }] },
    sources: [HARTLE, 'Synge, MNRAS 131, 463 (1966)'], reviewed: REVIEWED,
  },
  {
    id: 'disk',
    system: 'light',
    words: ['accretion disk', 'disk', 'disc', 'accretion', 'quasar', 'doppler beaming', 'gravitational redshift'],
    params: { inner: { dim: 'length', default: 3, rs: true }, outer: { dim: 'length', required: true, rs: true } },
    summary: 'A thin disk of gas circling in the equatorial plane from `inner` (default the innermost stable orbit, 3 Rs) to `outer`. Each ring glows at a temperature ∝ r^(−3/4)·(1 − √(inner/r))^(1/4), and the light reaching the eye is shifted by g, the Doppler and gravitational factors together: the side coming toward you brighter and bluer, the inner edge dimmed and reddened.',
    assumption: 'The disk is infinitely thin and opaque only where light crosses it; its gas follows circular geodesic orbits; its glow is the thin-disk profile, not a simulated flow.',
    example: { system: 'light', laws: [{ law: 'schwarzschild', mass: '4.3e6 M☉' }, { law: 'observer', distance: '40 Rs', inclination: '80°' }, { law: 'disk', outer: '15 Rs' }] },
    sources: ['Shakura & Sunyaev, A&A 24, 337 (1973)', 'Page & Thorne, ApJ 191, 499 (1974)', 'Luminet, A&A 75, 228 (1979)', 'Cunningham, ApJ 202, 788 (1975)'], reviewed: REVIEWED,
  },
  {
    id: 'body',
    system: 'orbit',
    words: ['orbit', 'perihelion', 'precession', 'mercury', 'star orbiting a black hole', 'plunge', 'geodesic'],
    params: { id: { dim: 'id', required: true }, at: { dim: 'length', vector: true, required: true, rs: true }, v: { dim: 'velocity', vector: true, required: true } },
    summary: 'A test body (`id`) released at `at` with velocity `v`, as a still observer there measures it (so below c). It follows a geodesic: an orbit that turns a little each lap (the perihelion advance), or a plunge when it comes too close.',
    assumption: 'The body is a test mass: it bends nothing and loses nothing to gravitational waves.',
    example: { system: 'orbit', laws: [{ law: 'schwarzschild', mass: '1 M☉' }, { law: 'body', id: 'star', at: ['20 Rs', 0, 0], v: [0, '0.2 c', 0] }], duration: '100 ms' },
    sources: [MTW, CARROLL, 'Einstein, Sitzungsber. Preuss. Akad. Wiss. 831 (1915)'], reviewed: REVIEWED,
  },
  {
    id: 'clock',
    system: 'clocks',
    words: ['time dilation', 'gravitational time dilation', 'clock', 'gps', 'twin', 'redshift', 'time slows'],
    params: { at: { dim: 'length', required: true, rs: true }, falls: { dim: 'flag', default: false } },
    summary: 'A clock at distance `at` from the centre, held there (ticking √(1 − Rs/r) as fast as a far clock), or let fall from rest (`falls: true`), its own time running out as it nears the horizon, which a far clock never sees it cross.',
    assumption: 'Each clock is held still (or falls straight in); clocks at one place agree; light\'s travel time to a far reader is not shown.',
    example: { system: 'clocks', laws: [{ law: 'schwarzschild', mass: '5.972e24 kg' }, { law: 'clock', at: '6371 km' }, { law: 'clock', at: '26560 km' }], duration: '1 d' },
    sources: [HARTLE + ' (§9.3; GPS: §6.4)', 'Ashby, Living Rev. Relativ. 6, 1 (2003)'], reviewed: REVIEWED,
  },
];

export const RELATIVISTIC_LAW = Object.fromEntries(RELATIVISTIC_LAWS.map((r) => [r.id, r]));
export const SYSTEMS = ['light', 'orbit', 'clocks'];
