/**
 * heli-archetypes — the helicopters the shelf's helicopter parts build (heli-odm.js), rows as every craft archetype is
 * (craft-archetypes.js's head says what a row holds), merged into CRAFT_ARCHETYPES. A helicopter's roles are the
 * shelf's own (a light civilian one a courier, a utility one a transport, an attack one strike), each already with its
 * starship craft. A helicopter's reference is its figures parked: its blades at rest where its rotor stops them, so its
 * span and length are the envelope they stand in, a little inside the disc it sweeps.
 */

export const HELI_ARCHETYPES = {
  lightHeli: {
    realm: 'earth', role: 'courier', palette: 'heliCivil', class: 'light helicopter', label: 'light single-engine helicopter', classOf: 'light single-engine helicopter class (1.4 t)',
    reference: { span: 9.35, length: 10.01, height: 3.72, mtow: 1400 },
    bom: { 'craft-fuselage': 1, 'craft-canopy': 1, 'craft-cockpit': 1, 'heli-cowl': 1, 'heli-rotor': 1, 'heli-tail': 1, 'craft-stabilizer': 2, 'craft-fin': 2, 'drone-gear': 2 },
    layout: [
      { id: 'hull', sku: 'fus-heli-light' },
      { id: 'canopy', sku: 'canopy-heli-bubble', at: 'hull.canopy' },
      { id: 'cockpit', sku: 'cockpit-heli-light', at: 'hull.cockpit' },
      { id: 'cowl', sku: 'cowl-heli-light', at: 'hull.cowl' },
      { id: 'rotor', sku: 'rotor-heli-light', at: 'cowl.mast' },
      { id: 'tailRotor', sku: 'tail-rotor-light', at: 'hull.tailRotor' },
      { id: 'stab', sku: 'stab-heli-light', at: 'hull.stabRoot', pair: true },
      { id: 'fin', sku: 'fin-heli-light', at: 'hull.finRoot' },
      { id: 'ventral', sku: 'fin-heli-ventral', at: 'hull.ventral', flip: 'z' },
      { id: 'skid', sku: 'skid-heli-light', at: 'hull.skid', pair: true },
    ],
  },
  utilityHeli: {
    realm: 'earth', role: 'transport', palette: 'heliMilitary', class: 'utility helicopter', label: 'medium twin utility helicopter', classOf: 'medium twin utility helicopter class (10 t)',
    reference: { span: 14.6, length: 20.2, height: 5.1, mtow: 10000 },
    bom: { 'craft-fuselage': 1, 'craft-canopy': 1, 'craft-cockpit': 1, 'heli-cowl': 1, 'heli-rotor': 1, 'heli-tail': 1, 'craft-stabilizer': 2, 'craft-fin': 1, 'craft-gear': 3 },
    layout: [
      { id: 'hull', sku: 'fus-heli-utility' },
      { id: 'canopy', sku: 'canopy-heli-utility', at: 'hull.canopy' },
      { id: 'cockpit', sku: 'cockpit-heli-utility', at: 'hull.cockpit' },
      { id: 'cowl', sku: 'cowl-heli-twin', at: 'hull.cowl' },
      { id: 'rotor', sku: 'rotor-heli-medium', at: 'cowl.mast' },
      { id: 'fin', sku: 'fin-heli-utility', at: 'hull.finRoot' },
      { id: 'tailRotor', sku: 'tail-rotor-medium', at: 'fin.rotor' },
      { id: 'stab', sku: 'stab-heli-utility', at: 'hull.stabRoot', pair: true },
      { id: 'mainGear', sku: 'gear-heli-utility-main', at: 'hull.mainGear', pair: true },
      { id: 'tailGear', sku: 'gear-heli-utility-tail', at: 'hull.tailGear' },
    ],
  },
  attackHeli: {
    realm: 'earth', role: 'strike', palette: 'heliMilitary', class: 'attack helicopter', label: 'tandem attack helicopter', classOf: 'tandem attack helicopter class (8 t)',
    reference: { span: 13.0, length: 18.4, height: 4.9, mtow: 8000 },
    bom: { 'craft-fuselage': 1, 'craft-canopy': 1, 'craft-cockpit': 1, 'drone-payload': 1, 'heli-kit': 5, 'heli-cowl': 1, 'heli-rotor': 1, 'heli-tail': 1, 'craft-wing': 2, 'craft-pylon': 4, 'craft-fin': 1, 'craft-stabilizer': 2, 'craft-gear': 3 },
    layout: [
      { id: 'hull', sku: 'fus-heli-attack' },
      { id: 'canopy', sku: 'canopy-heli-tandem', at: 'hull.canopy' },
      { id: 'cockpit', sku: 'cockpit-heli-tandem', at: 'hull.cockpit' },
      { id: 'sensor', sku: 'eoir-heli-nose', at: 'hull.sensor' },
      { id: 'gun', sku: 'gun-heli-chin', at: 'hull.gun' },
      { id: 'cowl', sku: 'cowl-heli-attack', at: 'hull.cowl' },
      { id: 'rotor', sku: 'rotor-heli-attack', at: 'cowl.mast' },
      { id: 'stub', sku: 'wing-heli-stub', at: 'hull.stubRoot', pair: true },
      { id: 'pylonIn', sku: 'pylon-heli-stub', at: 'stub.inboard', pair: true },
      { id: 'pylonOut', sku: 'pylon-heli-stub', at: 'stub.outboard', pair: true },
      { id: 'rockets', sku: 'rockets-heli-19', at: 'pylonIn.carry', pair: true },
      { id: 'missiles', sku: 'rack-heli-missiles', at: 'pylonOut.carry', pair: true },
      { id: 'fin', sku: 'fin-heli-attack', at: 'hull.finRoot' },
      { id: 'tailRotor', sku: 'tail-rotor-attack', at: 'fin.rotor' },
      { id: 'stab', sku: 'stab-heli-attack', at: 'hull.stabRoot', pair: true },
      { id: 'mainGear', sku: 'gear-heli-attack-main', at: 'hull.mainGear', pair: true },
      { id: 'tailGear', sku: 'gear-heli-attack-tail', at: 'hull.tailGear' },
    ],
  },
  tandemHeli: {
    realm: 'earth', role: 'transport', palette: 'heliMilitary', class: 'tandem-rotor helicopter', label: 'heavy tandem-rotor transport helicopter', classOf: 'heavy tandem-rotor transport class (22 t)',
    reference: { span: 16.3, length: 26.2, height: 5.9, mtow: 22700 },
    bom: { 'craft-fuselage': 3, 'craft-canopy': 1, 'craft-cockpit': 1, 'heli-cowl': 2, 'heli-rotor': 2, 'craft-gear': 4 },
    layout: [
      { id: 'hull', sku: 'fus-heli-tandem' },
      { id: 'canopy', sku: 'canopy-heli-deck', at: 'hull.canopy' },
      { id: 'cockpit', sku: 'cockpit-heli-deck', at: 'hull.cockpit' },
      { id: 'sponson', sku: 'sponson-heli-tandem', at: 'hull.sponson', pair: true },
      { id: 'frontGear', sku: 'gear-heli-tandem-front', at: 'sponson.front', pair: true },
      { id: 'rearGear', sku: 'gear-heli-tandem-rear', at: 'sponson.rear', pair: true },
      { id: 'frontPylon', sku: 'pylon-heli-tandem-front', at: 'hull.frontPylon' },
      // (the forward rotor turning anticlockwise seen from above, the aft one its mirror, clockwise: their torques cancel,
      // their blades meshing over the middle, the aft disc high on its pylon over the forward one)
      { id: 'frontRotor', sku: 'rotor-heli-tandem', at: 'frontPylon.mast' },
      { id: 'rearPylon', sku: 'pylon-heli-tandem-aft', at: 'hull.rearPylon' },
      { id: 'rearRotor', sku: 'rotor-heli-tandem', at: 'rearPylon.mast', flip: 'x' },
    ],
  },
};
