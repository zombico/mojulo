/**
 * craft-archetypes — the airframes the ODM inventory builds, as rows: which part kinds a craft
 * of this type needs at all (`bom`, the veh-* shelf's contract, audited by the same
 * `planAssemblyBom`), and the stock LAYOUT that fills it from the inventory.
 *
 * A layout entry: `{ id, sku, at?, pair?, flip? }`.
 *  - `at` names where the part's mount lands: `'<item>.<hardpoint>'` (the hull's stations, a
 *    wing's engine point, a pylon's carry end). The first entry is the hull, at the origin.
 *  - `pair: true` makes the part and its mirror: `<id>-r` where `at` says, `<id>-l` mirrored
 *    across the centreline under `flip: 'x'`. A part `at` a paired parent pairs with it.
 *  - `flip` mirrors the part in its own frame (`'z'`: a lower starfighter foil).
 *
 * `palette` is the stock livery (any craft or veh palette dresses it). `reference` is the class figure the assembled craft is held to (overall span, length,
 * height in metres; maximum take-off mass in kg). Earth rows quote the named class; space rows
 * quote the register as this shelf sizes it.
 */

export const CRAFT_ARCHETYPES = {
  // ===== earth =================================================================================
  lightSingle: {
    realm: 'earth', palette: 'trainerYellow', class: 'light aircraft', label: 'four-seat high-wing trainer', classOf: 'Cessna 172 class',
    reference: { span: 11.0, length: 8.28, height: 2.72, mtow: 1157 },
    bom: { 'craft-fuselage': 1, 'craft-wing': 2, 'craft-stabilizer': 2, 'craft-fin': 1, 'craft-engine': 1, 'craft-propeller': 1, 'craft-gear': 3 },
    layout: [
      { id: 'hull', sku: 'fus-light-single' },
      { id: 'engine', sku: 'eng-piston-flat4', at: 'hull.cowl' },
      { id: 'prop', sku: 'prop-2-fixed', at: 'engine.propHub' },
      { id: 'wing', sku: 'wing-light-high', at: 'hull.wingRoot', pair: true },
      { id: 'stab', sku: 'stab-light', at: 'hull.stabRoot', pair: true },
      { id: 'fin', sku: 'fin-light', at: 'hull.finRoot' },
      { id: 'main', sku: 'gear-spring-light', at: 'hull.mainGear', pair: true },
      { id: 'nose', sku: 'gear-nose-light', at: 'hull.noseGear' },
    ],
  },
  warbird: {
    realm: 'earth', palette: 'warbirdOlive', class: 'piston fighter', label: 'single-seat piston fighter', classOf: 'P-51D class',
    reference: { span: 11.28, length: 9.83, height: 4.08, mtow: 5490 },
    bom: { 'craft-fuselage': 1, 'craft-wing': 2, 'craft-stabilizer': 2, 'craft-fin': 1, 'craft-engine': 1, 'craft-propeller': 1, 'craft-canopy': 1, 'craft-gear': 3, 'craft-weapon': 2 },
    layout: [
      { id: 'hull', sku: 'fus-warbird' },
      { id: 'engine', sku: 'eng-piston-v12', at: 'hull.engine' },
      { id: 'prop', sku: 'prop-4-constant', at: 'engine.propHub' },
      { id: 'canopy', sku: 'canopy-bubble-warbird', at: 'hull.canopy' },
      { id: 'wing', sku: 'wing-warbird', at: 'hull.wingRoot', pair: true },
      { id: 'stab', sku: 'stab-warbird', at: 'hull.stabRoot', pair: true },
      { id: 'fin', sku: 'fin-warbird', at: 'hull.finRoot' },
      { id: 'main', sku: 'gear-main-warbird', at: 'wing.gear', pair: true },
      { id: 'tail', sku: 'gear-tail-warbird', at: 'hull.tailGear' },
      { id: 'gun', sku: 'gun-heavy-mg', at: 'wing.gun', pair: true },
    ],
  },
  jetFighter: {
    realm: 'earth', palette: 'navyGrey', class: 'jet fighter', label: 'single-engine multirole fighter', classOf: 'F-16 class',
    reference: { span: 9.96, length: 15.06, height: 5.09, mtow: 19187 },
    bom: { 'craft-fuselage': 1, 'craft-wing': 2, 'craft-stabilizer': 2, 'craft-fin': 1, 'craft-engine': 1, 'craft-canopy': 1, 'craft-gear': 3, 'craft-weapon': 3 },
    layout: [
      { id: 'hull', sku: 'fus-jet-fighter' },
      { id: 'engine', sku: 'eng-turbofan-afterburning', at: 'hull.engine' },
      { id: 'canopy', sku: 'canopy-bubble-fighter', at: 'hull.canopy' },
      { id: 'wing', sku: 'wing-fighter-delta', at: 'hull.wingRoot', pair: true },
      { id: 'stab', sku: 'stab-fighter', at: 'hull.stabRoot', pair: true },
      { id: 'fin', sku: 'fin-fighter', at: 'hull.finRoot' },
      { id: 'main', sku: 'gear-main-fighter', at: 'hull.mainGear', pair: true },
      { id: 'nose', sku: 'gear-nose-fighter', at: 'hull.noseGear' },
      { id: 'gun', sku: 'gun-rotary-20', at: 'hull.gun' },
      { id: 'missile', sku: 'missile-aam-short', at: 'wing.tip', pair: true },
    ],
  },
  bizjet: {
    realm: 'earth', palette: 'polishedAlu', class: 'business jet', label: 'twin aft-engine business jet', classOf: 'Learjet 45 class',
    reference: { span: 14.58, length: 17.81, height: 4.3, mtow: 9752 },
    bom: { 'craft-fuselage': 1, 'craft-wing': 2, 'craft-stabilizer': 2, 'craft-fin': 1, 'craft-pylon': 2, 'craft-engine': 2, 'craft-gear': 3 },
    layout: [
      { id: 'hull', sku: 'fus-bizjet' },
      { id: 'wing', sku: 'wing-bizjet', at: 'hull.wingRoot', pair: true },
      { id: 'fin', sku: 'fin-bizjet', at: 'hull.finRoot' },
      { id: 'stab', sku: 'stab-bizjet', at: 'fin.tip', pair: true },
      { id: 'stub', sku: 'pylon-aft-stub', at: 'hull.engineStub', pair: true },
      { id: 'engine', sku: 'eng-turbofan-small', at: 'stub.carry', pair: true },
      { id: 'main', sku: 'gear-main-bizjet', at: 'wing.gear', pair: true },
      { id: 'nose', sku: 'gear-nose-bizjet', at: 'hull.noseGear' },
    ],
  },
  regional: {
    realm: 'earth', palette: 'airlinerWhite', class: 'regional airliner', label: 'twin turboprop regional airliner', classOf: 'ATR 72 class',
    reference: { span: 27.05, length: 27.17, height: 7.65, mtow: 23000 },
    bom: { 'craft-fuselage': 1, 'craft-wing': 2, 'craft-stabilizer': 2, 'craft-fin': 1, 'craft-engine': 2, 'craft-propeller': 2, 'craft-gear': 3 },
    layout: [
      { id: 'hull', sku: 'fus-regional' },
      { id: 'wing', sku: 'wing-regional', at: 'hull.wingRoot', pair: true },
      { id: 'engine', sku: 'eng-turboprop', at: 'wing.engine', pair: true },
      { id: 'prop', sku: 'prop-6-composite', at: 'engine.propHub', pair: true },
      { id: 'fin', sku: 'fin-regional', at: 'hull.finRoot' },
      { id: 'stab', sku: 'stab-regional', at: 'fin.tip', pair: true },
      { id: 'main', sku: 'gear-main-regional', at: 'hull.mainGear', pair: true },
      { id: 'nose', sku: 'gear-nose-regional', at: 'hull.noseGear' },
    ],
  },
  narrowbody: {
    realm: 'earth', palette: 'airlinerWhite', class: 'airliner', label: 'single-aisle twinjet', classOf: 'A320 class',
    reference: { span: 35.8, length: 37.57, height: 11.76, mtow: 78000 },
    bom: { 'craft-fuselage': 1, 'craft-wing': 2, 'craft-stabilizer': 2, 'craft-fin': 1, 'craft-pylon': 2, 'craft-engine': 2, 'craft-gear': 3 },
    layout: [
      { id: 'hull', sku: 'fus-narrowbody' },
      { id: 'wing', sku: 'wing-narrowbody', at: 'hull.wingRoot', pair: true },
      { id: 'pylon', sku: 'pylon-underwing-narrowbody', at: 'wing.engine', pair: true },
      { id: 'engine', sku: 'eng-turbofan-narrow', at: 'pylon.carry', pair: true },
      { id: 'stab', sku: 'stab-narrowbody', at: 'hull.stabRoot', pair: true },
      { id: 'fin', sku: 'fin-narrowbody', at: 'hull.finRoot' },
      { id: 'main', sku: 'gear-main-narrowbody', at: 'wing.gear', pair: true },
      { id: 'nose', sku: 'gear-nose-narrowbody', at: 'hull.noseGear' },
    ],
  },
  widebody: {
    realm: 'earth', palette: 'airlinerWhite', class: 'airliner', label: 'twin-aisle long-haul twinjet', classOf: '777-200 class',
    reference: { span: 60.93, length: 63.73, height: 18.5, mtow: 247200 },
    bom: { 'craft-fuselage': 1, 'craft-wing': 2, 'craft-stabilizer': 2, 'craft-fin': 1, 'craft-pylon': 2, 'craft-engine': 2, 'craft-gear': 3 },
    layout: [
      { id: 'hull', sku: 'fus-widebody' },
      { id: 'wing', sku: 'wing-widebody', at: 'hull.wingRoot', pair: true },
      { id: 'pylon', sku: 'pylon-underwing-widebody', at: 'wing.engine', pair: true },
      { id: 'engine', sku: 'eng-turbofan-wide', at: 'pylon.carry', pair: true },
      { id: 'stab', sku: 'stab-widebody', at: 'hull.stabRoot', pair: true },
      { id: 'fin', sku: 'fin-widebody', at: 'hull.finRoot' },
      { id: 'main', sku: 'gear-bogie-widebody', at: 'wing.gear', pair: true },
      { id: 'nose', sku: 'gear-nose-widebody', at: 'hull.noseGear' },
    ],
  },

  // ===== space =================================================================================
  strikeFoil: {
    realm: 'space', palette: 'scoutIvory', class: 'space superiority fighter', label: 'four-foil snubfighter', classOf: 'strike-foil snubfighter register',
    reference: { span: 11.5, length: 12.4, height: 3.9, mtow: 10000 },
    bom: { 'craft-fuselage': 1, 'craft-canopy': 1, 'craft-wing': 4, 'craft-engine': 4, 'craft-weapon': 4, 'craft-gear': 3, 'craft-thruster': 1 },
    layout: [
      { id: 'hull', sku: 'hull-snub-wedge' },
      { id: 'canopy', sku: 'canopy-snub', at: 'hull.canopy' },
      { id: 'foilU', sku: 'foil-strike', at: 'hull.foilUpper', pair: true },
      { id: 'foilD', sku: 'foil-strike', at: 'hull.foilLower', pair: true, flip: 'z' },
      { id: 'driveU', sku: 'drive-pod-light', at: 'foilU.pod', pair: true },
      { id: 'driveD', sku: 'drive-pod-light', at: 'foilD.pod', pair: true },
      { id: 'gunU', sku: 'cannon-laser-long', at: 'foilU.tip', pair: true },
      { id: 'gunD', sku: 'cannon-laser-long', at: 'foilD.tip', pair: true },
      { id: 'nose', sku: 'strut-light-nose', at: 'hull.noseGear' },
      { id: 'main', sku: 'strut-light', at: 'hull.mainGear', pair: true },
      { id: 'rcs', sku: 'rcs-quad', at: 'hull.rcs' },
    ],
  },
  twinPanel: {
    realm: 'space', palette: 'interceptorSlate', class: 'interceptor', label: 'twin-panel interceptor', classOf: 'twin-panel interceptor register',
    reference: { span: 6.2, length: 6.25, height: 7.2, mtow: 4200 },
    bom: { 'craft-fuselage': 1, 'craft-canopy': 1, 'craft-pylon': 2, 'craft-wing': 2, 'craft-engine': 1, 'craft-weapon': 2 },
    layout: [
      { id: 'hull', sku: 'hull-ball-pod' },
      { id: 'window', sku: 'canopy-ball-window', at: 'hull.window' },
      { id: 'arm', sku: 'arm-panel', at: 'hull.arm', pair: true },
      { id: 'panel', sku: 'panel-hex', at: 'arm.carry', pair: true },
      { id: 'drive', sku: 'drive-ion-twin', at: 'hull.vents' },
      { id: 'chin', sku: 'cannon-chin-short', at: 'hull.chin', pair: true },
    ],
  },
  colonialDart: {
    realm: 'space', palette: 'colonialSteel', class: 'space superiority fighter', label: 'carrier-borne colonial dart', classOf: 'colonial viper register',
    reference: { span: 5.8, length: 9.9, height: 2.9, mtow: 6000 },
    bom: { 'craft-fuselage': 1, 'craft-canopy': 1, 'craft-wing': 2, 'craft-fin': 1, 'craft-engine': 3, 'craft-weapon': 2, 'craft-gear': 3 },
    layout: [
      { id: 'hull', sku: 'hull-colonial-dart' },
      { id: 'canopy', sku: 'canopy-dart', at: 'hull.canopy' },
      { id: 'wing', sku: 'wing-colonial-stub', at: 'hull.wingRoot', pair: true },
      { id: 'fin', sku: 'fin-colonial', at: 'hull.finRoot' },
      { id: 'driveTop', sku: 'drive-bell-main', at: 'hull.engineTop' },
      { id: 'driveLow', sku: 'drive-bell-main', at: 'hull.engineLow', pair: true },
      { id: 'gun', sku: 'cannon-kinetic', at: 'hull.gun', pair: true },
      { id: 'nose', sku: 'gear-carrier-light-nose', at: 'hull.noseGear' },
      { id: 'main', sku: 'gear-carrier-light', at: 'hull.mainGear', pair: true },
    ],
  },
  heavyFighter: {
    realm: 'space', palette: 'carrierBlue', class: 'heavy fighter', label: 'carrier heavy fighter', classOf: 'carrier heavy fighter register',
    reference: { span: 14.6, length: 20.3, height: 5.4, mtow: 26000 },
    bom: { 'craft-fuselage': 1, 'craft-canopy': 1, 'craft-wing': 2, 'craft-fin': 2, 'craft-engine': 2, 'craft-weapon': 4, 'craft-gear': 3, 'craft-thruster': 1 },
    layout: [
      { id: 'hull', sku: 'hull-heavy-fighter' },
      { id: 'canopy', sku: 'canopy-armored', at: 'hull.canopy' },
      { id: 'wing', sku: 'wing-heavy-fighter', at: 'hull.wingRoot', pair: true },
      { id: 'fin', sku: 'fin-heavy-fighter', at: 'hull.finRoot', pair: true },
      { id: 'drive', sku: 'drive-pod-heavy', at: 'hull.engine', pair: true },
      { id: 'gun', sku: 'cannon-heavy-laser', at: 'wing.gun', pair: true },
      { id: 'rack', sku: 'rack-missile-triple', at: 'wing.store', pair: true },
      { id: 'nose', sku: 'gear-carrier-heavy-nose', at: 'hull.noseGear' },
      { id: 'main', sku: 'gear-carrier-heavy', at: 'hull.mainGear', pair: true },
      { id: 'rcs', sku: 'rcs-quad', at: 'hull.rcs' },
    ],
  },
  podSpine: {
    realm: 'space', palette: 'scoutIvory', class: 'bomber', label: 'twin-nacelle assault bomber', classOf: 'twin-nacelle bomber register',
    reference: { span: 8.0, length: 16.2, height: 3.3, mtow: 18000 },
    bom: { 'craft-fuselage': 1, 'craft-canopy': 1, 'craft-pylon': 2, 'craft-engine': 2, 'craft-weapon': 2, 'craft-gear': 3 },
    layout: [
      { id: 'hull', sku: 'hull-pod-spine' },
      { id: 'canopy', sku: 'canopy-dart', at: 'hull.canopy' },
      { id: 'turret', sku: 'turret-ion-dorsal', at: 'hull.turret' },
      { id: 'launcher', sku: 'launcher-torpedo', at: 'hull.launcher' },
      { id: 'crossbar', sku: 'crossbar-nacelle', at: 'hull.crossbar', pair: true },
      { id: 'drive', sku: 'drive-nacelle-long', at: 'crossbar.carry', pair: true },
      { id: 'nose', sku: 'strut-heavy', at: 'hull.noseGear' },
      { id: 'main', sku: 'strut-light', at: 'hull.mainGear', pair: true },
    ],
  },
  utilityShuttle: {
    realm: 'space', palette: 'colonialSteel', class: 'utility shuttle', label: 'twin-pod utility shuttle', classOf: 'colonial raptor register',
    reference: { span: 6.0, length: 8.8, height: 3.6, mtow: 12000 },
    bom: { 'craft-fuselage': 1, 'craft-pylon': 2, 'craft-engine': 2, 'craft-gear': 4, 'craft-thruster': 1 },
    layout: [
      { id: 'hull', sku: 'hull-utility-shuttle' },
      { id: 'stub', sku: 'stub-shuttle', at: 'hull.stub', pair: true },
      { id: 'drive', sku: 'drive-pod-shuttle', at: 'stub.carry', pair: true },
      { id: 'skidF', sku: 'strut-heavy', at: 'hull.skidFront', pair: true },
      { id: 'skidR', sku: 'strut-heavy', at: 'hull.skidRear', pair: true },
      { id: 'rcs', sku: 'rcs-quad', at: 'hull.rcs' },
    ],
  },
};
