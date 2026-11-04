/**
 * kelvin — the steady wake of a source moving over deep water, by stationary phase: the field the World page's seaway
 * channel lays along a boat's track (scene/channels/seaway.js inlines this function as written, so the page and the
 * tests run the same arithmetic). A point ξ behind the source along its track and η across it, at an angle β off the
 * track inside Kelvin's wedge (tan β < tan 19.47°), is reached by two wave systems whose directions θ are the roots of
 * tan β = tan θ / (1 + 2 tan² θ): the transverse (the smaller) and the divergent (the larger). Each has the wavenumber
 * k = g / (U² cos² θ) and the phase k·(ξ cos θ + |η| sin θ); its height falls as the square root of the distance past a
 * wavelength and rises toward the cusp, where the two systems meet; nothing outside the wedge. A fast (lifted) boat's
 * divergent waves are seen most along its narrower apparent angle. Waves too short for the sheet that draws them
 * (`cell`) fade out rather than alias. Pure, no closures: it reads only its arguments.
 *
 *   P: { k0 = g/U², a0 the first crest's height, reach, lw the waterline's length, lifted, app (the apparent angle,
 *        radians), cell (the sheet's cell, 0 for none) }
 */
export function kelvinField(xi, eta, P) {
  if (!(xi > 0) || xi > P.reach) return 0;
  const TK = 0.35355339059327373, ae = Math.abs(eta), tb = ae / xi;
  if (tb >= TK) return 0;
  const lam = (2 * Math.PI) / P.k0, r = Math.hypot(xi, ae), D = 1 - 8 * tb * tb, sq = Math.sqrt(Math.max(0, D));
  const decay = Math.sqrt(lam / Math.max(r, lam)) * (1 - Math.exp(-xi / (0.3 * P.lw))) * Math.min(1, (P.reach - xi) / (0.2 * P.reach));
  const cusp = Math.min(2.2, 0.7 / (Math.pow(D, 0.25) + 0.3)), edge = 1 - Math.pow(tb / TK, 24), base = P.a0 * decay * cusp * edge;
  const fade = (k) => (P.cell > 0 ? Math.max(0, 1 - ((k * P.cell) / Math.PI) ** 2) : 1);
  let h = 0;
  {
    const t = (2 * tb) / (1 + sq), c = 1 / Math.sqrt(1 + t * t), s = t * c, k = P.k0 / (c * c);
    h += base * (P.lifted ? 0.25 : 1) * Math.cos(k * (xi * c + ae * s)) * fade(k);
  }
  if (tb > 1e-4) {
    const t = (1 + sq) / (4 * tb), c = 1 / Math.sqrt(1 + t * t), s = t * c, k = P.k0 / (c * c), b = Math.atan(tb);
    const w = P.lifted ? 0.25 + 1.6 * Math.exp(-(((b - P.app) / (0.45 * P.app)) ** 2)) : 0.8;
    h += base * w * Math.cos(k * (xi * c + ae * s)) * fade(k);
  }
  return h;
}
