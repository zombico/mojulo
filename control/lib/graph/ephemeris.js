/**
 * ephemeris.js — low-precision geocentric Sun + Moon positions for a given instant.
 *
 * Pure + deterministic (a function of the UTC instant only): no RNG, no I/O. Used by the
 * planetary scene to GEO-LOCK the Sun, Earth and Moon to a real date/time — the lit hemisphere,
 * the Moon's direction and its phase all fall where they truly are, rather than on free knobs.
 *
 * Frame note: the scene only needs each body's geographic SUB-POINT (the lon/lat where it is
 * directly overhead) + the Moon's distance. Geography, Sun and Moon are then placed in the scene
 * sharing ONE rigid tilt, so their relative geometry (which continent is lit, where the Moon sits,
 * what phase it shows) is correct regardless of the scene's overall orientation in space.
 *
 * Accuracy: Sun ≈ 0.01°, Moon ≈ 0.1–0.3° / a few hundred km — abridged Meeus (Astronomical
 * Algorithms, ch. 25/47/48, principal periodic terms). Plenty for a visual; not an almanac.
 */

const DEG = Math.PI / 180;
const norm360 = (x) => ((x % 360) + 360) % 360;
const wrap180 = (x) => { const v = norm360(x); return v > 180 ? v - 360 : v; };

const EARTH_RADIUS_KM = 6371;   // mean radius — matches MOON_DIST_RATIO's denominator in the scene

// Julian Day from a JS Date (getTime() is ms since the UTC epoch).
export function julianDay(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

// Greenwich Mean Sidereal Time in degrees (Meeus 12.4).
function gmstDeg(jd) {
  const T = (jd - 2451545.0) / 36525;
  return norm360(280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - (T * T * T) / 38710000);
}

// Sun: apparent geocentric RA/Dec + apparent ecliptic longitude + apparent obliquity (Meeus 25).
function sunApparent(jd) {
  const T = (jd - 2451545.0) / 36525;
  const L0 = norm360(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
  const M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) * DEG;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M)
    + (0.019993 - 0.000101 * T) * Math.sin(2 * M)
    + 0.000289 * Math.sin(3 * M);
  const trueLong = L0 + C;
  const Omega = (125.04 - 1934.136 * T) * DEG;
  const lambda = (trueLong - 0.00569 - 0.00478 * Math.sin(Omega)) * DEG;        // apparent ecliptic lon
  const eps0 = 23.439291 - 0.0130042 * T - 1.64e-7 * T * T + 5.04e-7 * T * T * T;
  const eps = (eps0 + 0.00256 * Math.cos(Omega)) * DEG;                          // apparent obliquity
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  return { ra: norm360(ra / DEG), dec: dec / DEG, lambda: norm360(lambda / DEG), eps: eps / DEG };
}

// Moon: geocentric ecliptic lon/lat (deg) + distance (km) — abridged Meeus 47 (top periodic terms).
// Rows: [D, M, M', F, ΣL coef (1e-6 deg, ×sin), ΣR coef (1e-3 km, ×cos)]; M-terms scale by E.
const MOON_LR = [
  [0, 0, 1, 0, 6288774, -20905355], [2, 0, -1, 0, 1274027, -3699111],
  [2, 0, 0, 0, 658314, -2955968], [0, 0, 2, 0, 213618, -569925],
  [0, 1, 0, 0, -185116, 48888], [0, 0, 0, 2, -114332, -3149],
  [2, 0, -2, 0, 58793, 246158], [2, -1, -1, 0, 57066, -152138],
  [2, 0, 1, 0, 53322, -170733], [2, -1, 0, 0, 45758, -204586],
  [0, 1, -1, 0, -40923, -129620], [1, 0, 0, 0, -34720, 108743],
  [0, 1, 1, 0, -30383, 104755], [2, 0, 0, -2, 15327, 10321],
  [0, 0, 1, 2, -12528, 0], [0, 0, 1, -2, 10980, 79661],
  [4, 0, -1, 0, 10675, -34782], [0, 0, 3, 0, 10034, -23210],
  [4, 0, -2, 0, 8548, -21636], [2, 1, -1, 0, -7888, 24208],
  [2, 1, 0, 0, -6766, 30824], [1, 0, -1, 0, -5163, -8379],
  [1, 1, 0, 0, 4987, -16675], [2, -1, 1, 0, 4036, -12831],
  [2, 0, 2, 0, 3994, -10445], [4, 0, 0, 0, 3861, -11650],
  [2, 0, -3, 0, 3665, 14403], [0, 1, -2, 0, -2689, -7003],
  [2, 0, -1, 2, -2602, 0], [2, -1, -2, 0, 2390, 10056],
  [1, 0, 1, 0, -2348, 6322], [2, -2, 0, 0, 2236, -9884],
  [0, 1, 2, 0, -2120, 5751], [0, 2, 0, 0, -2069, 0],
  [2, -2, -1, 0, 2048, -4950],
];
// Rows: [D, M, M', F, ΣB coef (1e-6 deg, ×sin)] (Meeus 47.B top terms).
const MOON_B = [
  [0, 0, 0, 1, 5128122], [0, 0, 1, 1, 280602], [0, 0, 1, -1, 277693],
  [2, 0, 0, -1, 173237], [2, 0, -1, 1, 55413], [2, 0, -1, -1, 46271],
  [2, 0, 0, 1, 32573], [0, 0, 2, 1, 17198], [2, 0, 1, -1, 9266],
  [0, 0, 2, -1, 8822], [2, -1, 0, -1, 8216], [2, 0, -2, -1, 4324],
  [2, 0, 1, 1, 4200], [2, 1, 0, -1, -3359], [2, -1, -1, 1, 2463],
  [2, -1, 0, 1, 2211], [2, -1, -1, -1, 2065], [0, 1, -1, -1, -1870],
  [4, 0, -1, -1, 1828], [0, 1, 0, 1, -1794],
];

function moonEcliptic(jd) {
  const T = (jd - 2451545.0) / 36525;
  const Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T * T + (T * T * T) / 538841 - (T * T * T * T) / 65194000;
  const D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T * T + (T * T * T) / 545868 - (T * T * T * T) / 113065000;
  const M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T * T + (T * T * T) / 24490000;
  const Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T * T + (T * T * T) / 69699 - (T * T * T * T) / 14712000;
  const F = 93.272095 + 483202.0175233 * T - 0.0036539 * T * T - (T * T * T) / 3526000 + (T * T * T * T) / 863310000;
  const E = 1 - 0.002516 * T - 0.0000074 * T * T;
  const ee = (m) => (m === 0 ? 1 : Math.abs(m) === 1 ? E : E * E);
  let sumL = 0, sumR = 0, sumB = 0;
  for (const [d, m, mp, f, cl, cr] of MOON_LR) {
    const arg = (d * D + m * M + mp * Mp + f * F) * DEG, k = ee(m);
    sumL += cl * k * Math.sin(arg); sumR += cr * k * Math.cos(arg);
  }
  for (const [d, m, mp, f, cb] of MOON_B) {
    sumB += cb * ee(m) * Math.sin((d * D + m * M + mp * Mp + f * F) * DEG);
  }
  return { lon: norm360(Lp + sumL / 1e6), lat: sumB / 1e6, dist: 385000.56 + sumR / 1e3 };
}

// geocentric ecliptic (λ, β) → equatorial (RA, Dec) at obliquity ε (Meeus 13.3/13.4).
function eclToEq(lonDeg, latDeg, epsDeg) {
  const lon = lonDeg * DEG, lat = latDeg * DEG, eps = epsDeg * DEG;
  const ra = Math.atan2(Math.sin(lon) * Math.cos(eps) - Math.tan(lat) * Math.sin(eps), Math.cos(lon));
  const dec = Math.asin(Math.sin(lat) * Math.cos(eps) + Math.cos(lat) * Math.sin(eps) * Math.sin(lon));
  return { ra: norm360(ra / DEG), dec: dec / DEG };
}

function phaseName(dlon) {
  if (dlon < 22.5 || dlon >= 337.5) return 'new';
  if (dlon < 67.5) return 'waxing crescent';
  if (dlon < 112.5) return 'first quarter';
  if (dlon < 157.5) return 'waxing gibbous';
  if (dlon < 202.5) return 'full';
  if (dlon < 247.5) return 'waning gibbous';
  if (dlon < 292.5) return 'last quarter';
  return 'waning crescent';
}

/**
 * Geo-lock state for a UTC instant. Returns the geographic SUB-POINTS of the Sun and Moon (where
 * each is directly overhead — sub-point longitude = RA − GMST, latitude = declination), the Moon's
 * geocentric distance in Earth radii, and the illuminated fraction / named phase. The scene places
 * the bodies from these sub-points so the lit face, the Moon's direction and its phase are real.
 */
export function geoLockState(date) {
  const jd = julianDay(date);
  const gmst = gmstDeg(jd);
  const sun = sunApparent(jd);
  const m = moonEcliptic(jd);
  const moonEq = eclToEq(m.lon, m.lat, sun.eps);
  const subsolar = { lon: wrap180(sun.ra - gmst), lat: sun.dec };
  const sublunar = { lon: wrap180(moonEq.ra - gmst), lat: moonEq.dec };
  const elong = Math.acos(Math.cos(m.lat * DEG) * Math.cos((m.lon - sun.lambda) * DEG)) / DEG;
  const dlon = norm360(m.lon - sun.lambda);
  return {
    jd, gmstDeg: gmst,
    obliquity: sun.eps,
    subsolar, sublunar,
    moonDistEarthRadii: m.dist / EARTH_RADIUS_KM,
    moonDistKm: m.dist,
    illum: { fraction: (1 - Math.cos(elong * DEG)) / 2, waxing: dlon < 180, phase: phaseName(dlon) },
  };
}
