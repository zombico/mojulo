/**
 * heli-looks — a helicopter's look as a card, never a second airframe: the same cabin, rotors and tail read civilian or
 * military by the card they wear (the drones' cards, drone-looks.js, are the other family; `lookCard` reads a card
 * against its craft's family). A card says what a drone's does (palette, slots, lights, payloads, livery) and two more:
 *   kit    what it hangs, by family, at which of the airframe's stations: [{ station, family, size? }] (a station is a
 *          named point on the hull, its row's `kitAt`; where the hull names none, that kit is not hung). The kit's part is the row of that
 *          family nearest `size` (its height, else its diameter, else its length), from the airframe's realm
 *   arms   false strips the airframe's own weapons (its rocket pods, missile racks, chin gun, door guns), never their
 *          pylons; true or absent keeps them
 *   armour false leaves a made hull's armour plates off (a civilian card's); true or absent keeps them
 *
 *   HELI_LOOKS, HELI_LOOK_IDS, HELI_ARMS, HELI_STATIONS
 *   lookFamily(archetypeRow, odm)        → 'heli' | 'liner' | 'drone'
 *   dressRow(archetypeRow, card, odm)    → the archetype as the card dresses it: its layout with its kit hung and its
 *                                          weapons stripped, its bill of materials counting both (the audit's)
 *
 * A civilian card's livery is its registration and a stripe of its trim; a military card's a low-visibility number and
 * emblem (the marks: air-surface.js). Pure.
 */

export const HELI_ARMS = Object.freeze(['rockets', 'rack', 'chin', 'doorGun']);

// how a station hangs its kit: a pair each side, the lower wire cutter turned down
export const HELI_STATIONS = Object.freeze({
  searchlight: {}, hoist: {}, camera: {}, cutterTop: {}, cutterLow: { flip: 'z' },
  doorGun: { pair: true }, flares: { pair: true }, floats: { pair: true },
});

export const HELI_LOOKS = Object.freeze({
  civil: Object.freeze({
    reads: 'a civilian helicopter: gloss white and its trim, its lights lit, a searchlight under it, no weapons',
    palette: 'heliCivil', slots: { airPaint: 'paint', airTrim: 'paint' }, lights: 'nav', payloads: {}, arms: false, armour: false,
    kit: [{ station: 'searchlight', family: 'searchlight' }],
    livery: { pattern: 'mono', marks: { style: 'civil', stripe: true } },
  }),
  medevac: Object.freeze({
    reads: 'an air ambulance: gloss red over white, a searchlight, a rescue hoist over its door, floats on its skids',
    palette: 'heliMedevac', slots: { airPaint: 'paint', airTrim: 'paint' }, lights: 'nav', payloads: {}, arms: false, armour: false,
    kit: [{ station: 'searchlight', family: 'searchlight' }, { station: 'hoist', family: 'hoist' }, { station: 'floats', family: 'floats' }],
    livery: { pattern: 'mono', marks: { style: 'civil', stripe: true } },
  }),
  police: Object.freeze({
    reads: 'a police helicopter: gloss dark blue and white, a camera ball under its nose, a searchlight',
    palette: 'heliPolice', slots: { airPaint: 'paint', airTrim: 'paint' }, lights: 'nav', payloads: {}, arms: false, armour: false,
    kit: [{ station: 'camera', family: 'eoir', size: 0.44 }, { station: 'searchlight', family: 'searchlight' }],
    livery: { pattern: 'mono', marks: { style: 'civil', stripe: true } },
  }),
  military: Object.freeze({
    reads: 'a military helicopter: matte drab (a camo cuts into it), its lights dark, door guns, wire cutters, flares, a low-visibility number',
    palette: 'heliMilitary', slots: {}, lights: 'covert', payloads: {}, arms: true, armour: true,
    kit: [{ station: 'doorGun', family: 'doorGun' }, { station: 'cutterTop', family: 'cutter' }, { station: 'cutterLow', family: 'cutter' }, { station: 'flares', family: 'flares' }],
    livery: { pattern: 'mono', marks: { style: 'military', emblem: 'bar', warnings: false } },
  }),
});
export const HELI_LOOK_IDS = Object.freeze(Object.keys(HELI_LOOKS));

/** A craft's look family: a helicopter's (it carries a main rotor), an airliner's (a liner's or a courier's fixed wing:
 *  liner-looks.js) or a drone's. */
export function lookFamily(row, odm) {
  if (row.layout.some((e) => odm[e.sku]?.kind === 'heli-rotor')) return 'heli';
  return ['liner', 'courier'].includes(row.role) && row.realm === 'earth' ? 'liner' : 'drone';
}

// the row of a family nearest a size, from a realm
function kitPart(family, size, realm, odm) {
  const of = (r) => r.dims.height ?? r.dims.diameter ?? r.dims.length ?? 0;
  const rows = Object.entries(odm).filter(([, r]) => ['heli-kit', 'drone-payload'].includes(r.kind) && r.build.family === family && r.realm === realm);
  if (!rows.length) return null;
  if (size !== undefined) rows.sort(([a, p], [b, q]) => Math.abs(of(p) - size) - Math.abs(of(q) - size) || (a < b ? -1 : 1));
  return rows[0][0];
}

/** The archetype as a card dresses it: its kit hung at the hull's stations, its weapons stripped (arms: false), its
 *  bill of materials counting both. A card with neither leaves the row as it is. */
export function dressRow(row, card, odm) {
  if (!card.kit?.length && card.arms !== false) return row;
  const hull = row.layout.find((e) => odm[e.sku]?.kind === 'craft-fuselage');
  const points = (hull && odm[hull.sku].build.kitAt) || {};
  const strip = card.arms === false ? row.layout.filter((e) => odm[e.sku]?.kind === 'heli-kit' && HELI_ARMS.includes(odm[e.sku].build.family)) : [];
  const add = [];
  for (const k of card.kit || []) {
    if (!hull || !points[k.station]) continue;
    const sku = kitPart(k.family, k.size, row.realm, odm);
    if (!sku) continue;
    const how = HELI_STATIONS[k.station] || {};
    add.push({ id: `kit_${k.station}`, sku, at: `${hull.id}.${k.station}`, ...(how.pair ? { pair: true } : {}), ...(how.flip ? { flip: how.flip } : {}) });
  }
  const gone = new Set(strip.map((e) => e.id)), bom = { ...row.bom };
  for (const e of strip) { const kd = odm[e.sku].kind; bom[kd] -= e.pair ? 2 : 1; if (!bom[kd]) delete bom[kd]; }
  for (const e of add) { const kd = odm[e.sku].kind; bom[kd] = (bom[kd] || 0) + (e.pair ? 2 : 1); }
  return { ...row, layout: [...row.layout.filter((e) => !gone.has(e.id)), ...add], bom };
}
