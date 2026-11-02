/**
 * heli-archetypes — the helicopters the shelf's helicopter parts build (heli-odm.js), rows as every craft archetype is
 * (craft-archetypes.js's head says what a row holds), merged into CRAFT_ARCHETYPES. A helicopter's roles are the
 * shelf's own (a light civilian one a courier, a utility one a transport, an attack one strike), each already with its
 * starship craft.
 */

export const HELI_ARCHETYPES = {
  lightHeli: {
    realm: 'earth', role: 'courier', palette: 'heliCivil', class: 'light helicopter', label: 'light single-engine helicopter', classOf: 'light single-engine helicopter class (1.4 t)',
    reference: { span: 9.35, length: 10.01, height: 3.72, mtow: 1400 },
    bom: { 'craft-fuselage': 1, 'craft-canopy': 1, 'heli-cowl': 1, 'heli-rotor': 1, 'heli-tail': 1, 'craft-stabilizer': 2, 'craft-fin': 2, 'drone-gear': 2 },
    layout: [
      { id: 'hull', sku: 'fus-heli-light' },
      { id: 'canopy', sku: 'canopy-heli-bubble', at: 'hull.canopy' },
      { id: 'cowl', sku: 'cowl-heli-light', at: 'hull.cowl' },
      { id: 'rotor', sku: 'rotor-heli-light', at: 'cowl.mast' },
      { id: 'tailRotor', sku: 'tail-rotor-light', at: 'hull.tailRotor' },
      { id: 'stab', sku: 'stab-heli-light', at: 'hull.stabRoot', pair: true },
      { id: 'fin', sku: 'fin-heli-light', at: 'hull.finRoot' },
      { id: 'ventral', sku: 'fin-heli-ventral', at: 'hull.ventral', flip: 'z' },
      { id: 'skid', sku: 'skid-heli-light', at: 'hull.skid', pair: true },
    ],
  },
};
