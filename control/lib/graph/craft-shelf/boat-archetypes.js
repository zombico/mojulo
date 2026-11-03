/**
 * boat-archetypes — the boats the shelf's boat parts build (boat-odm.js), rows as every craft archetype is
 * (craft-archetypes.js's head says what a row holds), merged into CRAFT_ARCHETYPES. A boat is its hull at the origin, its
 * drive on the hull's transom (`hull.motor`), its gear on the hull's points.
 *
 * A boat's row also carries:
 *   payload    kilograms aboard beyond its parts (its crew and their gear): what it floats with (assembleCraft's
 *              readout `afloat`: the waterline its weight sets)
 *   livery     its stock livery in the form render (craft-form.js), when no livery or look is asked for
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
  runabout: { label: 'runabout', mission: 'a day on the water for a family or a fishing party: quick onto the plane, dry enough offshore', realms: ['water'] },
  raider: { label: 'raiding craft', mission: 'a small team in and out fast, armed and low on the water: a military RHIB', realms: ['water'] },
  patrol: { label: 'patrol boat', mission: 'keep a river, a coast or a harbour: armoured, armed, on station for hours', realms: ['water'] },
  landing: { label: 'landing craft', mission: 'put vehicles and troops ashore over a beach: a ramp at its bow, a well deck, a shallow draft', realms: ['water'] },
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
  ccRunabout: {
    realm: 'water', role: 'runabout', palette: 'ccWhite', class: 'centre console', label: '17 ft centre console', classOf: '17 ft centre console class (5.2 m, 90 hp remote, 20 in shaft in its motor well)',
    payload: 300,
    reference: { span: 2.13, length: 5.9, height: 2.0, mtow: 1041, draft: 0.28 },
    bom: { 'boat-hull': 1, 'boat-outboard': 1, 'boat-console': 1, 'boat-seat': 2 },
    layout: [
      { id: 'hull', sku: 'hull-cc-17' },
      { id: 'motor', sku: 'outboard-90-remote-20', at: 'hull.motor' },
      { id: 'console', sku: 'console-cc-17', at: 'hull.console' },
      { id: 'helmSeat', sku: 'seat-cooler-120', at: 'hull.helmSeat' },
      { id: 'frontSeat', sku: 'seat-cooler-120', at: 'hull.frontSeat' },
    ],
  },
  ccTTop: {
    realm: 'water', role: 'runabout', palette: 'ccWhite', class: 'centre console with a T-top', label: '17 ft centre console with a T-top', classOf: '17 ft centre console class (5.2 m, 90 hp remote, a T-top over its helm)',
    payload: 300,
    reference: { span: 2.13, length: 5.99, height: 3.91, mtow: 1085, draft: 0.3 },
    bom: { 'boat-hull': 1, 'boat-outboard': 1, 'boat-console': 1, 'boat-seat': 2, 'boat-top': 1 },
    layout: [
      { id: 'hull', sku: 'hull-cc-17-ttop' },
      { id: 'motor', sku: 'outboard-90-remote-20', at: 'hull.motor' },
      { id: 'console', sku: 'console-cc-17', at: 'hull.console' },
      { id: 'top', sku: 'top-t-cc-17', at: 'hull.console' },
      { id: 'helmSeat', sku: 'seat-cooler-120', at: 'hull.helmSeat' },
      { id: 'frontSeat', sku: 'seat-cooler-120', at: 'hull.frontSeat' },
    ],
  },
  cuddyCabin: {
    realm: 'water', role: 'runabout', palette: 'cuddyBlue', class: 'cuddy cabin', label: '19 ft cuddy cabin', classOf: '19 ft cuddy cabin class (5.8 m, 150 hp remote in its motor well)',
    payload: 420,
    reference: { span: 2.41, length: 6.7, height: 2.4, mtow: 1700, draft: 0.33 },
    bom: { 'boat-hull': 1, 'boat-outboard': 1, 'boat-console': 2, 'boat-seat': 2 },
    layout: [
      { id: 'hull', sku: 'hull-cuddy-19' },
      { id: 'motor', sku: 'outboard-150-remote-25', at: 'hull.motor' },
      { id: 'helm', sku: 'dash-helm-19', at: 'hull.helm' },
      { id: 'passenger', sku: 'dash-passenger-19', at: 'hull.passenger' },
      { id: 'helmSeat', sku: 'seat-bucket-pedestal', at: 'hull.helmSeat' },
      { id: 'passengerSeat', sku: 'seat-bucket-pedestal', at: 'hull.passengerSeat' },
    ],
  },
  combatRhib: {
    realm: 'water', role: 'raider', palette: 'rhibMilitary', class: 'combat RHIB', label: '7.5 m combat RHIB', classOf: '7.5 m combat RHIB class (twin 150 hp, its guns modelled, never fired)',
    payload: 800,
    reference: { span: 2.75, length: 8.2, height: 4.6, mtow: 2870, draft: 0.48 },
    bom: { 'boat-hull': 1, 'boat-outboard': 2, 'boat-console': 1, 'boat-seat': 4, 'boat-arch': 1, 'boat-mount': 2 },
    layout: [
      { id: 'hull', sku: 'hull-rhib-mil-75' },
      { id: 'motor', sku: 'outboard-150-remote-25', at: 'hull.motorPair', pair: true },
      { id: 'console', sku: 'console-rhib-mil', at: 'hull.console' },
      { id: 'jockeyF', sku: 'seat-jockey', at: 'hull.jockeyF' },
      { id: 'jockeyFP', sku: 'seat-jockey', at: 'hull.jockeyFP' },
      { id: 'jockeyA', sku: 'seat-jockey', at: 'hull.jockeyA' },
      { id: 'jockeyAP', sku: 'seat-jockey', at: 'hull.jockeyAP' },
      { id: 'arch', sku: 'arch-radar-rhib', at: 'hull.arch' },
      { id: 'gunAft', sku: 'mount-mg-pedestal', at: 'hull.gunAft', yaw: 180 },
      { id: 'gunBow', sku: 'mount-mg-deck', at: 'hull.gunBow' },
    ],
  },
  riverinePatrol: {
    realm: 'water', role: 'patrol', palette: 'riverineOlive', class: 'riverine patrol boat', label: '10 m riverine patrol boat', classOf: '10 m riverine patrol boat class (twin waterjets, its guns modelled, never fired)',
    payload: 1100,
    reference: { span: 3.2, length: 10.8, height: 5.1, mtow: 10710, draft: 0.72 },
    bom: { 'boat-hull': 1, 'boat-jet': 2, 'boat-cabin': 1, 'boat-mount': 3 },
    layout: [
      { id: 'hull', sku: 'hull-riverine-10' },
      { id: 'jet', sku: 'jet-waterjet-350', at: 'hull.jetPair', pair: true },
      { id: 'pilothouse', sku: 'pilothouse-riverine', at: 'hull.pilothouse' },
      { id: 'gunRoof', sku: 'mount-mg-ring', at: 'pilothouse.roofGun', yaw: 180 },
      { id: 'gunBow', sku: 'mount-mg-tub', at: 'hull.gunBow' },
      { id: 'gunAft', sku: 'mount-mg-tub', at: 'hull.gunAft', yaw: 180 },
    ],
  },
  landingCraft: {
    realm: 'water', role: 'landing', palette: 'landingGrey', class: 'landing craft', label: '22 m landing craft', classOf: '22 m mechanised landing craft class (twin screws, its guns modelled, never fired)',
    // (its crew and, in its well, a field vehicle's worth of load)
    payload: 16000,
    reference: { span: 6.6, length: 23.6, height: 7.2, mtow: 70000, draft: 0.75 },
    bom: { 'boat-hull': 1, 'boat-ramp': 1, 'boat-shaft': 2, 'boat-cabin': 1, 'boat-mount': 3 },
    layout: [
      { id: 'hull', sku: 'hull-landing-22' },
      { id: 'ramp', sku: 'ramp-landing-22', at: 'hull.ramp' },
      { id: 'shaft', sku: 'shaft-diesel-450', at: 'hull.shaftPair', pair: true },
      { id: 'pilothouse', sku: 'pilothouse-landing', at: 'hull.pilothouse' },
      { id: 'gunRoof', sku: 'mount-mg-ring', at: 'pilothouse.roofGun' },
      { id: 'gunAftR', sku: 'mount-mg-tub', at: 'hull.gunAftR' },
      { id: 'gunAftL', sku: 'mount-mg-tub', at: 'hull.gunAftL' },
    ],
  },
  navalPatrol: {
    // (its stock look the naval card's slots; its stock livery its number on its bows and its emblem amidships)
    realm: 'water', role: 'patrol', palette: 'navalHaze', look: 'naval', livery: { pattern: 'mono', marks: { style: 'military', emblem: 'bar', number: '512' } }, class: 'navy patrol boat', label: '25 m navy patrol boat', classOf: '25 m coastal patrol boat class (twin waterjets, its guns modelled, never fired)',
    // (its crew, its stores and its fuel)
    payload: 9400,
    // (its span across its wing guns, trained outboard over the side)
    reference: { span: 6.4, length: 26.4, height: 12.4, mtow: 83500, draft: 1.33 },
    bom: { 'boat-hull': 2, 'boat-jet': 2, 'boat-cabin': 1, 'boat-mount': 3, 'boat-arch': 1, 'boat-outboard': 1 },
    layout: [
      { id: 'hull', sku: 'hull-patrol-25' },
      { id: 'jet', sku: 'jet-waterjet-650', at: 'hull.jetPair', pair: true },
      { id: 'bridge', sku: 'bridge-patrol-25', at: 'hull.bridge' },
      { id: 'cannon', sku: 'mount-cannon-30', at: 'hull.cannon' },
      // (trained outboard: a layout's yaw + turns a part to port)
      { id: 'gunWingR', sku: 'mount-mg-ring', at: 'bridge.wingR', yaw: -90 },
      { id: 'gunWingL', sku: 'mount-mg-ring', at: 'bridge.wingL', yaw: 90 },
      // (its sea boat: the RIB tender, its hull and its outboard, on chocks on the after deck; the davit to lift it)
      { id: 'seaBoat', sku: 'hull-rib-31', at: 'hull.seaBoat' },
      { id: 'seaBoatMotor', sku: 'outboard-20-tiller', at: 'seaBoat.motor' },
      { id: 'davit', sku: 'davit-sea-boat', at: 'hull.davit', yaw: 180 },
    ],
  },
};
