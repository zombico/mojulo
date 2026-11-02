/**
 * boat-archetypes — the boats the shelf's boat parts build (boat-odm.js), rows as every craft archetype is
 * (craft-archetypes.js's head says what a row holds), merged into CRAFT_ARCHETYPES. A boat is its hull at the origin, its
 * drive on the hull's transom (`hull.motor`), its gear on the hull's points.
 *
 * A boat's row also carries:
 *   payload    kilograms aboard beyond its parts (its crew and their gear): what it floats with (assembleCraft's
 *              readout `afloat`: the waterline its weight sets)
 *   reference  its class's figures: length overall with its drive down, beam (`span`), height from its drive's skeg to the
 *              top of its cowl, `mtow` its loaded mass (its parts and its payload), `draft` the waterline's height above
 *              the keel loaded
 *
 * The water's roles are its own: a flying role holds an earth craft and its starship (the shelf's swap of the sky for the
 * void); a boat's role holds boats (`realms: ['water']`).
 */

// the boats' jobs (merged into CRAFT_ROLES)
export const BOAT_ROLES = {
  utility: { label: 'utility boat', mission: 'a few people and their gear across a lake, a river or a harbour: fish, ferry, tend', realms: ['water'] },
  tender: { label: 'tender', mission: 'crew and stores between a boat at anchor and the shore: light, stable, hard to sink', realms: ['water'] },
};

export const BOAT_ARCHETYPES = {
  motorSkiff: {
    realm: 'water', role: 'utility', palette: 'skiffGreen', class: 'motor skiff', label: '14 ft motor skiff', classOf: '14 ft aluminium utility skiff class (4.3 m, 20 hp tiller)',
    payload: 180,
    reference: { span: 1.66, length: 4.85, height: 1.18, mtow: 380, draft: 0.15 },
    bom: { 'boat-hull': 1, 'boat-outboard': 1, 'boat-tank': 1 },
    layout: [
      { id: 'hull', sku: 'hull-skiff-v14' },
      { id: 'motor', sku: 'outboard-20-tiller', at: 'hull.motor' },
      { id: 'tank', sku: 'tank-portable-45l', at: 'hull.tank' },
    ],
  },
  jonBoat: {
    realm: 'water', role: 'utility', palette: 'jonTan', class: 'jon boat', label: '12 ft jon boat', classOf: '12 ft aluminium jon boat class (3.7 m, 9.9 hp tiller)',
    payload: 160,
    reference: { span: 1.45, length: 4.2, height: 1.07, mtow: 296, draft: 0.09 },
    bom: { 'boat-hull': 1, 'boat-outboard': 1, 'boat-tank': 1 },
    layout: [
      { id: 'hull', sku: 'hull-jon-12' },
      { id: 'motor', sku: 'outboard-10-tiller', at: 'hull.motor' },
      { id: 'tank', sku: 'tank-portable-45l', at: 'hull.tank' },
    ],
  },
  ribTender: {
    realm: 'water', role: 'tender', palette: 'ribGrey', class: 'RIB tender', label: '3.1 m rigid inflatable tender', classOf: '3.1 m RIB tender class (20 hp tiller)',
    payload: 160,
    reference: { span: 1.56, length: 3.5, height: 1.18, mtow: 319, draft: 0.2 },
    bom: { 'boat-hull': 1, 'boat-outboard': 1, 'boat-tank': 1 },
    layout: [
      { id: 'hull', sku: 'hull-rib-31' },
      { id: 'motor', sku: 'outboard-20-tiller', at: 'hull.motor' },
      { id: 'tank', sku: 'tank-portable-25l', at: 'hull.tank' },
    ],
  },
};
