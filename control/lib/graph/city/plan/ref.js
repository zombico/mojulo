// A city segment's level reads its city by ref: `{ kind: 'city', city: <ref>, level: { segment }, title? }` is the
// city's recipe with the level's own keys over it, so an edit to the city moves every level cut from it. The merge
// keeps the city's ref (`cityRef`) for its neighbours' level refs. `getManifest(ref)` is the store's read.
export function withCityRef(m, getManifest) {
  if (!m || m.kind !== 'city' || typeof m.city !== 'string') return m;
  const base = getManifest(m.city);
  if (!base || base.kind !== 'city') throw new Error(`city: '${m.city}' is not a stored city plan (mint it with compose_world { base: 'city', overrides: { plan } })`);
  if (typeof base.city === 'string') throw new Error(`city: '${m.city}' is itself a segment level: a level reads the city it was cut from`);
  const { title: _t, notes: _n, level: _l, game: _g, ...plan } = base;
  const { city, ...own } = m;
  return { ...plan, ...own, cityRef: city };
}
