// A city segment's level reads its city by ref: `{ kind: 'city', city: <ref>, level: { segment }, title? }` is the
// city's recipe with the level's own keys over it, so an edit to the city moves every level cut from it. The merge
// keeps the city's ref (`cityRef`) for its neighbours' level refs. `getManifest(ref)` is the store's read.
//
// The same read lays in what the city's sites stand by ref: each `from` an edifice (mint_solid({ kind: 'edifice' })),
// its recipe under `edifices` by ref, so the plan (which reads no store) stands it at its true size.
export function withCityRef(m, getManifest) {
  if (!m || m.kind !== 'city') return m;
  let out = m;
  if (typeof m.city === 'string') {
    const base = getManifest(m.city);
    if (!base || base.kind !== 'city') throw new Error(`city: '${m.city}' is not a stored city plan (mint it with compose_world { base: 'city', overrides: { plan } })`);
    if (typeof base.city === 'string') throw new Error(`city: '${m.city}' is itself a segment level: a level reads the city it was cut from`);
    const { title: _t, notes: _n, level: _l, game: _g, ...plan } = base;
    const { city, ...own } = m;
    out = { ...plan, ...own, cityRef: city };
  }
  return withSiteEdifices(out, getManifest);
}

/** A city recipe with its sites' edifices laid in by ref (`edifices: { <ref>: <edifice recipe> }`); unchanged with none. */
export function withSiteEdifices(m, getManifest) {
  const refs = [...new Set((Array.isArray(m.sites) ? m.sites : []).map((s) => s && s.from).filter((r) => typeof r === 'string'))];
  if (!refs.length) return m;
  const edifices = {};
  for (const ref of refs) {
    const e = getManifest(ref);
    if (!e) throw new Error(`city: a site stands '${ref}', and there is no sketch with that ref`);
    if (e.kind !== 'edifice') throw new Error(`city: a site stands '${ref}', a '${e.kind}': a site stands an edifice (mint it with mint_solid({ kind: 'edifice' }))`);
    edifices[ref] = e;
  }
  return { ...m, edifices };
}
