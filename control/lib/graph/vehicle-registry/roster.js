/**
 * vehicle-registry/roster — one row per vehicle, under the name people say: the one front door every vehicle a game,
 * a world or a preview names comes through.
 *
 * A vehicle used to live in up to seven tables under seven spellings, none sharing an id and none reading the game it
 * was in: the city's scenery nets (vehicles/vehicles-css3d.js, the swept and fuselage nets under them), the physics
 * classes (roads/vehicles.js), the highway fleet's true-dimension lofts (roads/fleet.js), the assembled builds
 * (vehicle-designer/assembly-bom.js) and the quick game's rides (gameworld/ride.js), the race machines (car-designer/:
 * the racer's parts grammar, the supercar library), the craft shelf's archetypes (craft-shelf/) and the fly goal's
 * aircraft (skyscape/eye.js), and a civilization's crafted technology (gameworld/tech-crafter.js). The roster is the one
 * place that says those are the same vehicle. It NAMES; the legacy tables still MEASURE (sizes, physics, parts, liveries
 * stay where their builders read them), so no stored recipe changes by a byte.
 *
 * The legacy tables are FROZEN behind it: roster.test.js holds every key of every one of them to exactly one row, so a
 * key added to one without a row fails, and a new vehicle is a row here first (its builds follow, one tier at a time).
 *
 * A row:
 *   label     what it is called in prose
 *   aliases   the words people say for it (search and the resolver), 3+ characters each
 *   realm     where it goes (REALMS): the level kinds it fits
 *   role      what a game asks for (ROLES); rows that share a role stand in for each other
 *   eras      the world ages it belongs to (ERAS, cast-setting.js ERA_OF_KIT's words)
 *   uses      how a game meets it (USES)
 *   handles   its keys into the tables that measure it (builds.js reads them; each claimed by exactly one row):
 *     scenery   vehicles-css3d.js VEHICLE_REGISTRY: the city and airfield's swept and fuselage nets
 *     net       an orphan net no scenery entry builds (vehicle-swept-net.js)
 *     physics   roads/vehicles.js VEHICLES: how it drives (one class or several)
 *     fleet     roads/fleet.js FLEET: its true-dimension loft
 *     assembly  vehicle-designer VEH_ARCHETYPES: its assembled build
 *     ride      gameworld/ride.js RIDES: the quick game's word for that build
 *     supercar  car-designer SUPERCAR_LIBRARY presets
 *     racer     true: the cartoon racer's parts grammar is its build
 *     craft     craft-shelf CRAFT_ARCHETYPES
 *     sky       skyscape/eye.js CRAFT: the fly goal's flight model
 *     rotor     skyscape/rotor.js ROTOR: a rotorcraft's envelope, the hover rule's
 *     cycle     cycle-shelf CYCLE_ARCHETYPES: a machine ridden astride, or a three-wheeler made of one and its add-ons
 *     car       car-shelf CAR_CARDS: a personal or family car composed (its class, body, language, trim, paint); the
 *               row's first card its realistic build
 *     construction  construction-shelf CON_ARCHETYPES: a site's machine, its carrier, its upper, its front and its tool
 *     mecha     mecha-shelf MECHA_ARCHETYPES: a legged frame a rider sits in, its legs posed by where its feet are
 *     tech      tech-crafter's vehicle trait: the concept it falls back to at every tier (many rows may share one)
 *
 * Pure data and pure functions: no clock, no dice.
 */

/** Where a vehicle goes. */
export const REALMS = Object.freeze({
  road: 'on a road or a street',
  offroad: 'off the road: dirt, sand, a trail',
  rail: 'on its rails',
  water: 'on the water',
  air: 'in the air',
  space: 'in the void',
});

/** What a game asks for. A slot (a hero's ride, the traffic, a foe's) names a role; any row of the role can fill it. */
export const ROLES = Object.freeze({
  commuter: 'a vehicle people get about in',
  hire: 'driven for someone else: a taxi, a limousine',
  sport: 'a car for the pleasure of driving it fast',
  racer: 'built to race',
  trail: 'a light machine for rough ground',
  hauler: 'it carries goods',
  transit: 'it carries many people on a route',
  service: 'it answers a call or tends to something',
  'ground-crew': 'it works an airfield beside the aircraft',
  patrol: 'it keeps the peace',
  scout: 'a light field vehicle: it scouts, patrols and carries a few',
  armour: 'armoured and armed: it fights',
  work: 'it works a field, a yard or a dock',
  construction: 'it builds, digs, hauls or lifts on a site',
  trainer: 'a craft to learn to fly in',
  courier: 'a small fast craft for a few people',
  liner: 'a craft that carries passengers far',
  transport: 'a craft that carries troops or cargo',
  superiority: 'a fighter that holds the sky',
  interceptor: 'a fighter that runs down what comes',
  strike: 'it attacks what is on the ground',
  carrier: 'flown from a carrier',
  stealth: 'it is not seen coming',
  survey: 'a drone that films, maps or watches from above',
});

/** The world ages a vehicle belongs to (gameworld/cast-setting.js ERA_OF_KIT's words). */
export const ERAS = Object.freeze({
  rustic: 'before engines: drawn, rowed, sailed, pedalled',
  myth: 'a legend\'s: chariots, galleys, wonders',
  modern: 'the engine age, today included',
  future: 'beyond today: hover, walkers, the void',
});

/** How a game meets a vehicle. */
export const USES = Object.freeze({
  driven: 'the player drives or flies it',
  traffic: 'it moves through a level on its own',
  parked: 'it stands in a level, set dressing',
  watched: 'it goes by: a set piece',
  crewed: 'a foe or a side fights from it',
});

const row = (label, aliases, realm, role, eras, uses, handles) => ({ label, aliases, realm, role, eras, uses, handles });
const M = ['modern'], F = ['future'];
const ROAD = ['driven', 'traffic', 'parked'];
const AIR = ['driven', 'parked', 'watched'];
const FIGHT = ['driven', 'crewed', 'watched'];
const HELI = ['driven', 'crewed', 'parked', 'watched'];

export const VEHICLES = {
  // ── cars ────────────────────────────────────────────────────────────────────
  // (a personal or family car's realistic build is the car shelf's card, car-shelf/car-library.js: the `car` handle,
  // its first card the row's own; the class's plain loft stays its build for the recipes minted before)
  sedan: row('sedan', ['saloon', 'family car', 'midsize car', 'midsize sedan', 'four door', 'automobile'], 'road', 'commuter', M, ROAD,
    { scenery: 'sedan', physics: 'midsize', fleet: 'midsize', assembly: 'sedan', ride: 'car', car: 'familySedan', tech: 'car' }),
  compact: row('compact car', ['hatchback', 'family hatchback', 'five door', 'compact hatchback'], 'road', 'commuter', M, ROAD,
    { physics: 'compact', fleet: 'compact', car: 'familyHatch', tech: 'car' }),
  coupe: row('coupe', ['two door', 'two-door coupe', 'sports coupe'], 'road', 'sport', M, ROAD,
    { assembly: 'coupe', ride: 'coupe', physics: 'coupe', car: 'sportsCoupe', tech: 'car' }),
  'station-wagon': row('station wagon', ['estate', 'estate car', 'family estate', 'estate wagon', 'follow-me car', 'ops wagon'], 'road', 'commuter', M, ROAD,
    { scenery: 'opsWagon', car: 'estate', tech: 'car' }),
  crossover: row('crossover', ['crossover suv', 'cuv', 'compact suv'], 'road', 'commuter', M, ROAD,
    { physics: 'crossover', fleet: 'crossover', car: 'crossover', tech: 'car' }),
  suv: row('suv', ['sport utility vehicle', 'family suv', 'three-row suv', 'midsize suv'], 'road', 'commuter', M, ROAD,
    { scenery: 'suv', assembly: 'suv', physics: 'midSuv', car: 'familySuv', tech: 'car' }),
  minivan: row('minivan', ['people carrier', 'mpv', 'family van', 'boxy van', 'people mover'], 'road', 'commuter', M, ROAD,
    { assembly: 'minivan', ride: 'van', physics: 'minivan', car: 'peopleCarrier', tech: 'truck' }),
  supermini: row('supermini', ['subcompact', 'small car', 'small hatchback', 'b-segment car'], 'road', 'commuter', M, ROAD,
    { physics: 'subcompact', car: ['supermini', 'ninetiesHatch'], tech: 'car' }),
  'city-car': row('city car', ['citycar', 'a-segment car', 'minicar', 'town car'], 'road', 'commuter', M, ROAD,
    { physics: 'cityCar', car: 'cityCar', tech: 'car' }),
  'kei-car': row('kei car', ['kei', 'kei wagon', 'tall wagon', 'kei jidosha'], 'road', 'commuter', M, ROAD,
    { physics: 'keiCar', car: 'keiWagon', tech: 'car' }),
  microcar: row('microcar', ['micro car', 'bubble car', 'two-seat city car', 'quadricycle'], 'road', 'commuter', M, ROAD,
    { physics: 'microcar', car: 'microcar', tech: 'car' }),
  'luxury-sedan': row('luxury sedan', ['luxury saloon', 'luxury car', 'executive car', 'full-size sedan', 'limousine sedan'], 'road', 'commuter', M, ROAD,
    { physics: 'fullsize', car: 'luxurySaloon', tech: 'car' }),
  'electric-car': row('electric car', ['electric vehicle', 'electric sedan', 'electric saloon', 'electric hatchback', 'electric crossover', 'battery car'], 'road', 'commuter', M, ROAD,
    { car: ['electricSaloon', 'electricHatch', 'electricCrossover'], tech: 'car' }),
  'hot-hatch': row('hot hatch', ['hot hatchback', 'pocket rocket', 'sport hatchback'], 'road', 'sport', M, ROAD,
    { car: 'hotHatch', tech: 'car' }),
  convertible: row('convertible', ['cabriolet', 'drop-top', 'droptop', 'soft top', 'open-top car'], 'road', 'sport', M, ROAD,
    { car: 'convertible', tech: 'car' }),
  roadster: row('roadster', ['two-seat roadster', 'open two-seater', 'spyder', 'spider'], 'road', 'sport', M, ROAD,
    { physics: 'roadster', car: 'roadster', tech: 'car' }),
  'muscle-car': row('muscle car', ['pony car', 'v8 coupe', 'american muscle'], 'road', 'sport', M, ROAD,
    { physics: 'muscle', car: 'muscleCar', tech: 'car' }),
  'large-suv': row('full-size suv', ['large suv', 'body-on-frame suv', 'big suv', 'full size suv'], 'road', 'commuter', M, ROAD,
    { physics: 'largeSuv', car: 'largeSuv', tech: 'car' }),
  'off-roader': row('off-roader', ['offroader', 'four by four', '4x4', 'off-road vehicle', 'boxy 4x4'], 'offroad', 'trail', M, ROAD,
    { physics: 'offroader', car: 'offroader', tech: 'car' }),
  'classic-car': row('classic car', ['fifties cruiser', 'chrome-age car', 'land yacht', 'old-timer', 'oldtimer', 'eighties sedan', 'retro sedan'], 'road', 'commuter', M, ROAD,
    { car: ['classicCruiser', 'eightiesSedan'], tech: 'car' }),
  'camper-van': row('camper van', ['campervan', 'camper', 'motorhome', 'caravan van', 'recreational vehicle'], 'road', 'commuter', M, ROAD,
    { assembly: 'caravanVan', tech: 'truck' }),
  taxi: row('taxi', ['cab', 'taxicab', 'yellow cab'], 'road', 'hire', M, ROAD,
    { scenery: 'taxi', tech: 'car' }),
  limousine: row('limousine', ['limo', 'stretch limo'], 'road', 'hire', M, ['traffic', 'parked'],
    { net: 'limo', tech: 'car' }),
  'sports-car': row('sports car', ['sportscar'], 'road', 'sport', M, ROAD,
    { physics: 'sports', tech: 'car' }),
  supercar: row('supercar', ['hypercar', 'exotic car', 'wedge', 'grand tourer', 'fastback', 'track special'], 'road', 'sport', M, ['driven', 'parked', 'watched'],
    { supercar: ['razor', 'strada', 'endurance', 'touring'], tech: 'car' }),
  'police-car': row('police car', ['cop car', 'squad car', 'patrol car', 'cruiser'], 'road', 'patrol', M, ROAD,
    { tech: 'car' }),
  // (the city's emergency vehicles, classes and not replicas, in no service's livery: a box ambulance on a van cab, a
  // high-roofed paramedic van, a pumper fire engine, a rear-mount aerial ladder truck; their realistic bodies the hull
  // kit's, road-civic.js)
  ambulance: row('ambulance', ['box ambulance', 'ems truck', 'rescue ambulance', 'emergency ambulance', 'ambulance truck'], 'road', 'service', M, ROAD,
    { physics: 'ambulance', tech: 'truck' }),
  'paramedic-van': row('paramedic van', ['paramedic', 'van ambulance', 'paramedic unit', 'medic unit', 'ems van', 'high roof ambulance', 'emergency van', 'response van'], 'road', 'service', M, ROAD,
    { physics: 'paramedicVan', tech: 'truck' }),
  'fire-engine': row('fire engine', ['fire truck', 'fire appliance', 'pumper', 'fire pumper', 'pump truck', 'fire tender', 'pumping appliance'], 'road', 'service', M, ROAD,
    { physics: 'fireEngine', tech: 'truck' }),
  'ladder-truck': row('ladder truck', ['aerial ladder', 'aerial ladder truck', 'turntable ladder', 'hook and ladder', 'fire ladder truck', 'ladder engine', 'aerial appliance', 'tower ladder'], 'road', 'service', M, ROAD,
    { physics: 'ladderTruck', tech: 'truck' }),
  // ── racers and trail machines ───────────────────────────────────────────────
  kart: row('kart', ['go-kart', 'go kart', 'cartoon racer', 'racer', 'kart racer'], 'road', 'racer', M, ['driven', 'watched'],
    { physics: 'kart', racer: true, tech: 'car' }),
  'rally-car': row('rally car', ['rally', 'rallye car'], 'offroad', 'racer', M, ['driven', 'watched'],
    { physics: 'rally', tech: 'car' }),
  'trophy-truck': row('trophy truck', ['baja truck', 'desert truck', 'prerunner'], 'offroad', 'racer', M, ['driven', 'watched'],
    { physics: 'trophyTruck', tech: 'truck' }),
  buggy: row('dune buggy', ['beach buggy', 'sand rail', 'desert buggy'], 'offroad', 'trail', M, ['driven', 'parked'],
    { physics: 'buggy', tech: 'car' }),
  atv: row('quad bike', ['atv', 'quad', 'four-wheeler', 'all-terrain vehicle'], 'offroad', 'trail', M, ['driven', 'parked'],
    { physics: 'atv', cycle: 'atv', tech: 'car' }),
  // ── ridden astride: two wheels in line, and the three-wheelers made of them (the cycle shelf builds them) ────
  // (a road bike is a bicycle's word, so the motorcycle is the standard road machine by its own words; 'chopper' is the
  // helicopter's and 'cruiser' the police car's, so the cruiser is said in full; 'rickshaw' alone is the cart's, pulled
  // on foot: the cycle and auto rickshaws are said in full)
  motorcycle: row('motorcycle', ['motorbike', 'road motorcycle', 'standard motorcycle', 'naked bike', 'street bike'], 'road', 'commuter', M, ROAD,
    { physics: 'streetBike', cycle: 'streetBike', tech: 'motorcycle' }),
  'dirt-bike': row('dirt bike', ['dirtbike', 'motocross bike', 'mx bike', 'enduro bike', 'trail bike', 'motocrosser'], 'offroad', 'trail', M, ROAD,
    { physics: 'dirtBike', cycle: 'dirtBike', tech: 'motorcycle' }),
  'sport-bike': row('sport bike', ['sportbike', 'superbike', 'sports motorcycle', 'supersport'], 'road', 'sport', M, ROAD,
    { physics: 'sportBike', cycle: 'sportBike', tech: 'motorcycle' }),
  'race-bike': row('race bike', ['racebike', 'racing motorcycle', 'grand prix bike', 'gp bike', 'prototype racer'], 'road', 'racer', M, ['driven', 'watched'],
    { physics: 'raceBike', cycle: 'raceBike', tech: 'motorcycle' }),
  'cruiser-bike': row('cruiser motorcycle', ['cruiser bike', 'v-twin', 'bobber', 'custom bike', 'chopper bike'], 'road', 'commuter', M, ROAD,
    { physics: 'cruiserBike', cycle: 'cruiserBike', tech: 'motorcycle' }),
  scooter: row('scooter', ['motor scooter', 'maxi scooter', 'step-through scooter'], 'road', 'commuter', M, ROAD,
    { physics: 'scooter', cycle: 'scooter', tech: 'motorcycle' }),
  moped: row('moped', ['underbone', 'step-through', 'motor bicycle'], 'road', 'commuter', M, ROAD,
    { physics: 'moped', cycle: 'moped', tech: 'motorcycle' }),
  'e-bike': row('e-bike', ['ebike', 'electric bike', 'electric bicycle', 'pedelec'], 'road', 'commuter', M, ROAD,
    { physics: 'eBike', cycle: 'eBike', tech: 'bicycle' }),
  bicycle: row('bicycle', ['bike', 'cyclist', 'pushbike', 'push bike'], 'road', 'commuter', ['rustic', 'modern'], ['driven', 'traffic', 'parked'],
    { scenery: 'cyclist', physics: 'bicycle', cycle: 'bicycle', tech: 'bicycle' }),
  'sidecar-outfit': row('sidecar outfit', ['sidecar', 'motorcycle and sidecar', 'motorcycle with sidecar', 'sidecar rig'], 'road', 'commuter', M, ROAD,
    { physics: 'sidecarOutfit', cycle: 'sidecarOutfit', tech: 'motorcycle' }),
  'motor-trike': row('motor trike', ['trike', 'motor tricycle', 'motorcycle trike', 'three-wheeled motorcycle'], 'road', 'commuter', M, ROAD,
    { physics: 'motorTrike', cycle: 'motorTrike', tech: 'motorcycle' }),
  'tuk-tuk': row('tuk-tuk', ['tuktuk', 'auto rickshaw', 'autorickshaw', 'three-wheeler taxi'], 'road', 'hire', M, ROAD,
    { physics: 'tukTuk', cycle: 'tukTuk', tech: 'motorcycle' }),
  'cycle-rickshaw': row('cycle rickshaw', ['pedicab', 'trishaw', 'bike taxi', 'pedal rickshaw'], 'road', 'hire', ['rustic', 'modern'], ROAD,
    { physics: 'cycleRickshaw', cycle: 'cycleRickshaw', tech: 'bicycle' }),
  tricycle: row('tricycle', ['cargo trike', 'box trike', 'cargo tricycle', 'adult tricycle', 'pedal trike'], 'road', 'hauler', ['rustic', 'modern'], ROAD,
    { physics: 'cargoTrike', cycle: 'cargoTrike', tech: 'bicycle' }),
  // ── haulers ─────────────────────────────────────────────────────────────────
  pickup: row('pickup truck', ['pickup', 'pick-up', 'ute', 'full-size pickup'], 'road', 'hauler', M, ROAD,
    { physics: 'pickup', fleet: 'pickup', tech: 'truck' }),
  'cargo-van': row('cargo van', ['van', 'panel van', 'delivery van', 'box van', 'work van'], 'road', 'hauler', M, ROAD,
    { scenery: 'boxVan', physics: 'van', fleet: 'van', tech: 'truck' }),
  'box-truck': row('box truck', ['straight truck', 'lorry', 'removal truck', 'moving truck'], 'road', 'hauler', M, ROAD,
    { scenery: 'boxTruck', physics: 'straightTruck', fleet: 'straightTruck', tech: 'truck' }),
  // (the city's delivery fleet, classes and not replicas, in no carrier's livery: the walk-in step van the delivery truck
  // is, a postal delivery van, a courier's high-roofed van, a light box truck with a tail lift, a kei truck; their
  // realistic bodies the hull kit's, road-civic.js)
  'delivery-truck': row('delivery truck', ['step van', 'parcel truck', 'walk-in van', 'walk in van', 'package truck', 'parcel delivery truck', 'multi-stop truck', 'bread van'], 'road', 'hauler', M, ROAD,
    { net: 'delivery-truck', physics: 'stepVan', tech: 'truck' }),
  'mail-truck': row('mail truck', ['mail van', 'postal truck', 'postal van', 'post van', 'mail delivery truck', 'postal vehicle', 'mail carrier truck', 'mailman truck', 'postie van', 'post office van'], 'road', 'hauler', M, ROAD,
    { physics: 'mailTruck', tech: 'truck' }),
  'courier-van': row('courier van', ['courier', 'courier truck', 'parcel van', 'package van', 'high roof van', 'express van', 'delivery driver van', 'last mile van', 'sprinter van'], 'road', 'hauler', M, ROAD,
    { physics: 'courierVan', tech: 'truck' }),
  'light-truck': row('light box truck', ['small box truck', 'small delivery truck', 'light truck', 'tail lift truck', 'luton van', 'refrigerated truck', 'reefer truck', 'cab-over box truck', 'small lorry', 'delivery lorry', 'box lorry'], 'road', 'hauler', M, ROAD,
    { physics: 'lightTruck', tech: 'truck' }),
  'kei-truck': row('kei truck', ['mini truck', 'micro truck', 'kei van', 'japanese mini truck', 'tiny truck', 'mini delivery truck', 'microtruck'], 'road', 'hauler', M, ROAD,
    { physics: 'keiTruck', tech: 'truck' }),
  'semi-truck': row('semi truck', ['semi', 'tractor trailer', 'tractor-trailer', 'eighteen wheeler', 'articulated lorry', 'big rig'], 'road', 'hauler', M, ROAD,
    { physics: ['tractorTrailer', 'tractorTrailerLoaded'], fleet: 'tractorTrailer', tech: 'truck' }),
  flatbed: row('flatbed truck', ['flatbed', 'flat deck'], 'road', 'hauler', M, ROAD,
    { assembly: 'flatbed', tech: 'truck' }),
  trailer: row('trailer', ['towed trailer', 'utility trailer'], 'road', 'hauler', M, ['parked'],
    { assembly: 'trailer', tech: 'cart' }),
  'tow-truck': row('tow truck', ['wrecker', 'breakdown truck', 'recovery truck'], 'road', 'service', M, ROAD,
    { assembly: 'towtruck', tech: 'truck' }),
  // (the city's works: a rear-loading refuse truck, a plough truck and gritter, a street sweeper; classes, not replicas,
  // their realistic bodies the hull kit's, road-civic.js)
  'refuse-truck': row('garbage truck', ['refuse truck', 'trash truck', 'bin lorry', 'dustcart', 'refuse lorry', 'rubbish truck', 'dustbin lorry', 'waste truck', 'bin truck', 'refuse collection vehicle', 'garbage lorry', 'rear loader'], 'road', 'service', M, ROAD,
    { physics: 'refuseTruck', tech: 'truck' }),
  // (the garbage truck's other models, each its own silhouette: forks on arms over the cab, a gripper arm on the right
  // side, a hook lift and its container, portal arms and a skip)
  'front-loader-truck': row('front loader garbage truck', ['front-loading garbage truck', 'front load truck', 'commercial garbage truck', 'dumpster truck', 'front loader refuse truck'], 'road', 'service', M, ROAD,
    { physics: 'frontLoader', tech: 'truck' }),
  'side-loader': row('side loader garbage truck', ['side loader', 'automated side loader', 'automated garbage truck', 'side-loading garbage truck', 'side load truck', 'side loader refuse truck', 'robot arm garbage truck'], 'road', 'service', M, ROAD,
    { physics: 'sideLoader', tech: 'truck' }),
  'roll-off-truck': row('roll-off truck', ['roll off truck', 'rolloff truck', 'hook lift truck', 'hooklift truck', 'hook loader', 'container truck', 'dumpster hauler', 'roll-off container truck', 'hook truck'], 'road', 'service', M, ROAD,
    { physics: 'rollOff', tech: 'truck' }),
  'skip-loader': row('skip loader', ['skip lorry', 'skip truck', 'skip wagon', 'skip hauler', 'portal skip loader', 'skip loader truck'], 'road', 'service', M, ROAD,
    { physics: 'skipLoader', tech: 'truck' }),
  snowplow: row('snowplow', ['snowplough', 'snow plow', 'snow plough', 'plow truck', 'plough truck', 'gritter', 'gritting lorry', 'salt truck', 'salt spreader', 'snow removal truck', 'winter service vehicle', 'snow truck'], 'road', 'service', M, ROAD,
    { physics: 'snowPlow', tech: 'truck' }),
  'street-sweeper': row('street sweeper', ['road sweeper', 'sweeper truck', 'street cleaner', 'road cleaner', 'street sweeping truck', 'mechanical sweeper', 'sweeper'], 'road', 'service', M, ROAD,
    { physics: 'streetSweeper', tech: 'truck' }),
  // (a utility's bucket truck: an aerial work platform on a service body)
  'bucket-truck': row('bucket truck', ['cherry picker', 'elevator truck', 'aerial lift truck', 'aerial work platform', 'utility bucket truck', 'lineman truck', 'boom lift truck', 'aerial device truck', 'man lift truck', 'bucket lift'], 'road', 'service', M, ROAD,
    { physics: 'bucketTruck', tech: 'truck' }),
  // ── transit ─────────────────────────────────────────────────────────────────
  bus: row('bus', ['city bus', 'coach bus', 'omnibus', 'transit bus'], 'road', 'transit', M, ROAD,
    { scenery: 'cityBus', physics: 'bus', fleet: 'bus', tech: 'bus' }),
  tram: row('tram', ['streetcar', 'trolley', 'light rail'], 'rail', 'transit', M, ['traffic', 'parked', 'watched'],
    { scenery: 'streetcar', tech: 'train' }),
  train: row('train', ['passenger train', 'railcar', 'metro', 'subway train', 'monorail'], 'rail', 'transit', M.concat(F), ['driven', 'traffic', 'watched'],
    { tech: 'train' }),
  locomotive: row('locomotive', ['steam engine', 'steam locomotive', 'loco', 'freight train'], 'rail', 'hauler', ['rustic', 'modern'], ['driven', 'traffic', 'watched'],
    { tech: 'locomotive' }),
  // ── the airfield's ground crew ───────────────────────────────────────────────
  'catering-truck': row('catering truck', ['hi-loader', 'galley truck'], 'road', 'ground-crew', M, ['driven', 'traffic', 'parked'],
    { scenery: 'cateringTruck', physics: 'cateringTruck', tech: 'truck' }),
  'belt-loader': row('belt loader', ['baggage belt', 'conveyor truck'], 'road', 'ground-crew', M, ['driven', 'parked'],
    { scenery: 'beltLoader', physics: 'beltLoader', tech: 'truck' }),
  'boarding-stairs': row('boarding stairs', ['air stairs', 'stair truck', 'passenger stairs'], 'road', 'ground-crew', M, ['driven', 'parked'],
    { scenery: 'boardingStairs', physics: 'stairTruck', tech: 'truck' }),
  // (the haulers: their realistic bodies only, road-airside-haul.js)
  'baggage-tug': row('baggage tug', ['tow tractor', 'baggage tractor', 'luggage tug', 'baggage train', 'tug tractor'], 'road', 'ground-crew', M, ['driven', 'parked'],
    { physics: 'baggageTug', tech: 'car' }),
  'baggage-cart': row('baggage cart', ['baggage dolly', 'baggage trolley', 'luggage cart', 'luggage trolley', 'baggage wagon'], 'road', 'ground-crew', M, ['parked'],
    { physics: 'baggageCart', tech: 'car' }),
  'pushback-tug': row('pushback tug', ['pushback tractor', 'aircraft tug', 'aircraft tractor', 'towbarless tug', 'aircraft tow tractor', 'pushback'], 'road', 'ground-crew', M, ['driven', 'parked'],
    { physics: 'pushbackTug', tech: 'truck' }),
  'fuel-truck': row('fuel truck', ['refueller', 'refueler', 'aviation fuel truck', 'jet fuel truck', 'fuel bowser', 'aircraft refueller'], 'road', 'ground-crew', M, ['driven', 'parked'],
    { physics: 'fuelTruck', tech: 'truck' }),
  // ── work and war on the ground ──────────────────────────────────────────────
  tractor: row('tractor', ['farm tractor'], 'offroad', 'work', M, ['driven', 'parked'],
    { tech: 'car' }),
  forklift: row('forklift', ['fork lift', 'lift truck', 'counterbalance forklift', 'fork truck'], 'road', 'work', M, ['driven', 'parked'],
    { physics: 'forklift', construction: 'forklift', tech: 'car' }),
  // ── the site's machines (the construction shelf's, construction-shelf/: each a carrier, an upper, a front and a tool;
  // a crawler and a skid steer drawn and parked until skid steer is built; the tower crane stands where it is put) ───
  excavator: row('excavator', ['digger', 'crawler excavator', 'tracked excavator', 'hydraulic excavator', 'trackhoe', 'power shovel'], 'offroad', 'construction', M, ['driven', 'parked', 'watched'],
    { physics: 'crawlerExcavator', construction: 'crawlerExcavator', tech: 'tracked' }),
  'mini-excavator': row('mini excavator', ['mini digger', 'compact excavator', 'micro excavator'], 'offroad', 'construction', M, ['driven', 'parked', 'watched'],
    { physics: 'miniExcavator', construction: 'miniExcavator', tech: 'tracked' }),
  'wheeled-excavator': row('wheeled excavator', ['wheel excavator', 'rubber tyred excavator', 'mobile excavator'], 'road', 'construction', M, ['driven', 'parked', 'watched'],
    { physics: 'wheeledExcavator', construction: 'wheeledExcavator', tech: 'truck' }),
  bulldozer: row('bulldozer', ['dozer', 'crawler dozer', 'crawler tractor', 'track dozer'], 'offroad', 'construction', M, ['driven', 'parked', 'watched'],
    { physics: 'crawlerDozer', construction: 'bulldozer', tech: 'tracked' }),
  'wheel-loader': row('wheel loader', ['front loader', 'front end loader', 'bucket loader', 'payloader', 'shovel loader'], 'offroad', 'construction', M, ['driven', 'parked', 'watched'],
    { physics: 'wheelLoader', construction: 'wheelLoader', tech: 'truck' }),
  'backhoe-loader': row('backhoe loader', ['backhoe', 'loader backhoe', 'digger loader'], 'offroad', 'construction', M, ['driven', 'parked', 'watched'],
    { physics: 'backhoeLoader', construction: 'backhoeLoader', tech: 'truck' }),
  'skid-steer': row('skid steer loader', ['skid steer', 'skidsteer', 'skid loader'], 'offroad', 'construction', M, ['driven', 'parked', 'watched'],
    { physics: 'skidSteer', construction: 'skidSteer', tech: 'car' }),
  'compact-track-loader': row('compact track loader', ['track loader', 'tracked skid steer', 'multi terrain loader'], 'offroad', 'construction', M, ['driven', 'parked', 'watched'],
    { physics: 'compactTrackLoader', construction: 'compactTrackLoader', tech: 'tracked' }),
  telehandler: row('telehandler', ['telescopic handler', 'telescopic forklift', 'reach forklift'], 'offroad', 'construction', M, ['driven', 'parked', 'watched'],
    { physics: 'telehandler', construction: 'telehandler', tech: 'truck' }),
  'tipper-truck': row('tipper truck', ['tipper', 'dump truck', 'dumper truck', 'tip truck', 'dump lorry', 'tipper lorry'], 'road', 'construction', M, ROAD.concat('watched'),
    { physics: 'tipperTruck', construction: 'tipperTruck', tech: 'truck' }),
  'mixer-truck': row('concrete mixer truck', ['mixer truck', 'cement truck', 'cement mixer', 'concrete mixer', 'transit mixer', 'concrete truck'], 'road', 'construction', M, ROAD.concat('watched'),
    { physics: 'mixerTruck', construction: 'mixerTruck', tech: 'truck' }),
  'articulated-dump-truck': row('articulated dump truck', ['articulated hauler', 'dumper', 'adt', 'site dumper'], 'offroad', 'construction', M, ['driven', 'parked', 'watched'],
    { physics: 'articulatedDumpTruck', construction: 'articulatedDumpTruck', tech: 'truck' }),
  'haul-truck': row('haul truck', ['mining truck', 'off highway truck', 'rigid dump truck', 'quarry truck'], 'offroad', 'construction', M, ['driven', 'parked', 'watched'],
    { physics: 'haulTruck', construction: 'haulTruck', tech: 'truck' }),
  'mobile-crane': row('mobile crane', ['all terrain crane', 'truck crane', 'crane truck', 'rough terrain crane', 'telescopic crane'], 'road', 'construction', M, ROAD.concat('watched'),
    { physics: 'mobileCrane', construction: 'mobileCrane', tech: 'truck' }),
  // (a tower crane never drives: its words and its uses are a site's centrepiece, its size the shelf's as built, to
  // the height under its hook it is built to; its concept, a truck, is the crafter's nearest)
  'tower-crane': row('tower crane', ['crane', 'building crane', 'construction crane', 'hammerhead crane', 'luffing crane', 'site crane'], 'road', 'construction', M, ['parked', 'watched'],
    { construction: 'towerCrane', tech: 'truck' }),
  'road-roller': row('road roller', ['roller', 'steamroller', 'compactor', 'tandem roller', 'asphalt roller', 'drum roller'], 'road', 'construction', M, ['driven', 'parked', 'watched'],
    { physics: 'roadRoller', construction: 'roadRoller', tech: 'truck' }),
  'motor-grader': row('motor grader', ['grader', 'road grader', 'blade grader'], 'road', 'construction', M, ['driven', 'parked', 'watched'],
    { physics: 'motorGrader', construction: 'motorGrader', tech: 'truck' }),
  // (the field's: a light utility 4x4, a canvas-topped cargo truck, an eight-wheeled carrier; their realistic bodies
  // are the military hull kit's, car-designer/road-military.js; "jeep" is said of any light military 4x4, so it is a
  // word here, the one maker's name the roster keeps)
  'utility-4x4': row('military utility vehicle', ['jeep', 'military jeep', 'army jeep', 'light utility vehicle', 'field car', 'command car', 'scout car', 'military four by four'], 'offroad', 'scout', M, FIGHT.concat('parked'),
    { physics: 'utility4x4', tech: 'car' }),
  // (the field's heavy utility 4x4, a buffed-up jeep, a class and not a replica; "humvee" is said of any such vehicle,
  // so it is a word here, as "jeep" is)
  'heavy-utility': row('heavy utility vehicle', ['humvee', 'heavy jeep', 'military humvee', 'high mobility vehicle', 'heavy utility truck', 'wide jeep', 'military suv', 'four door jeep'], 'offroad', 'transport', M, ['driven', 'crewed', 'parked', 'traffic'],
    { physics: 'heavy4x4', tech: 'car' }),
  'cargo-truck': row('military cargo truck', ['canvas truck', 'military truck', 'army truck', 'troop truck', 'troop carrier', 'covered truck', 'six by six', 'deuce and a half', 'supply truck'], 'offroad', 'transport', M, ['driven', 'crewed', 'parked', 'traffic'],
    { physics: 'cargo6x6', tech: 'truck' }),
  apc: row('armoured personnel carrier', ['apc', 'armoured car', 'armored car', 'personnel carrier', 'armored personnel carrier', 'wheeled apc', 'eight by eight', 'infantry carrier'], 'offroad', 'armour', M, FIGHT.concat('parked'),
    { physics: 'apc8x8', tech: 'apc' }),
  // (the field's missile launcher: an eight-wheeled transporter-erector and its ballistic missile, a class and not a
  // replica, modelled and never fired; "v2" is said of any such missile's launcher, so it is a word here)
  'missile-launcher': row('missile launcher truck', ['missile launcher', 'launcher truck', 'missile truck', 'rocket launcher truck', 'ballistic missile launcher', 'transporter erector launcher', 'mobile missile launcher', 'v2 launcher', 'v-2 launcher', 'mobile v2 launcher'], 'offroad', 'strike', M, FIGHT.concat('parked'),
    { physics: 'launcher8x8', tech: 'truck' }),
  // (the field's tracked: a light tank and a tracked carrier on the running gear, car-designer/mil-track.js; drawn and
  // parked, driven when skid steer is built; the tank row stays the main battle tank, a concept)
  'light-tank': row('light tank', ['scout tank', 'recon tank', 'airborne tank', 'light battle tank'], 'offroad', 'armour', M, FIGHT.concat('parked'),
    { physics: 'lightTank', tech: 'tracked' }),
  'tracked-carrier': row('tracked armoured carrier', ['tracked apc', 'tracked carrier', 'tracked personnel carrier', 'armoured carrier on tracks', 'armored tracked carrier'], 'offroad', 'armour', M, FIGHT.concat('parked'),
    { physics: 'trackedCarrier', tech: 'tracked' }),
  tank: row('tank', ['battle tank', 'main battle tank', 'tracked vehicle', 'halftrack'], 'offroad', 'armour', M, FIGHT,
    { tech: 'tracked' }),
  mech: row('mech', ['walker', 'battle mech', 'mecha', 'strider'], 'offroad', 'armour', F, FIGHT,
    { tech: 'walker' }),
  // (a ridden walker: the mecha shelf's first frame, mecha-shelf/, its rider astride as on a sport motorcycle, carried on
  // two six-joint legs; drawn on the studio grid at a stance, ridden when its gait is built)
  'all-terrain-walker': row('all-terrain walker', ['all terrain walker', 'riding walker', 'ridden walker', 'bipedal walker', 'legged walker', 'walking machine', 'walker frame', 'walking chair'], 'offroad', 'trail', F, ['driven', 'parked', 'watched'],
    { mecha: 'allTerrainWalker', tech: 'walker' }),
  // (the all-terrain walker hardened as a military all-terrain transport, unarmed: drawn larger for rough ground, its
  // beams guarded, its feet cleated, dressed in the field's look, car-designer's military styling)
  'field-walker': row('field walker', ['military walker', 'army walker', 'military all terrain walker', 'military all-terrain walker', 'patrol walker', 'scout walker', 'recon walker', 'walker transport'], 'offroad', 'scout', F, ['driven', 'parked', 'watched'],
    { mecha: 'fieldWalker', tech: 'walker' }),
  // (the field walker on four wheels, armed: it walks, or collapses its legs and rolls as a four-wheeler; its heavy
  // weapons backpack an autocannon, a rocket launcher and the service tail)
  'rover-walker': row('rover walker', ['wheeled walker', 'walker atv', 'atv walker', 'transforming walker', 'wheel walker', 'quad walker', 'roller walker', 'wheel leg walker'], 'offroad', 'armour', F, ['driven', 'parked', 'watched'],
    { mecha: 'roverWalker', tech: 'walker' }),
  // (the rover walker's principles at 2.5 times: six wheels collapsed, its cockpit out on a keel, a howitzer and a
  // missile launcher on its back served by twin scorpion tails)
  'siege-walker': row('siege walker', ['walking fortress', 'artillery walker', 'howitzer walker', 'siege mech', 'heavy rover walker', 'mobile fortress', 'six wheel walker', 'land cruiser walker'], 'offroad', 'armour', F, ['driven', 'parked', 'watched'],
    { mecha: 'siegeWalker', tech: 'walker' }),
  // (the siege walker's first pattern, kept beside it: its cockpit out on a keel under a radar mast, no hull between,
  // its weapons high on its backpack's tower, tall foot plates)
  'siege-walker-mk1': row('siege walker mk1', ['siege walker mk 1', 'first siege walker', 'original siege walker', 'tower siege walker', 'keel walker', 'radar mast walker'], 'offroad', 'armour', F, ['driven', 'parked', 'watched'],
    { mecha: 'siegeWalkerMk1', tech: 'walker' }),
  // (a big four-legged drone carrier: its hull a single hangar, its feet rounded bays on wheels, two drones in each; it
  // walks as an insect does, tall on its bays, or tucks them in along its hull and drives on them)
  'brood-walker': row('brood walker', ['bug mom', 'drone mother', 'drone carrier walker', 'drone walker', 'mothership walker', 'hangar walker', 'quad walker carrier', 'four legged drone carrier'], 'offroad', 'transport', F, ['driven', 'parked', 'watched'],
    { mecha: 'broodWalker', tech: 'walker' }),
  // (a general-purpose work frame on the same shelf: its operator seated in a torso frame, knee-forward legs, two arms
  // on rams for the lifting)
  'utility-walker': row('utility walker', ['work walker', 'walking work frame', 'power frame', 'work frame', 'lifting walker', 'cargo walker', 'loader walker', 'walking loader'], 'offroad', 'work', F, ['driven', 'parked', 'watched'],
    { mecha: 'utilityWalker', tech: 'walker' }),
  // (the utility walker drawn larger for heavy construction: its operator in a closed, guarded cab)
  'heavy-walker': row('heavy walker', ['heavy work walker', 'construction walker', 'site walker', 'heavy lifting walker', 'walking crane', 'demolition walker', 'heavy power frame'], 'offroad', 'work', F, ['driven', 'parked', 'watched'],
    { mecha: 'heavyWalker', tech: 'walker' }),
  // (the heavy walker's cab and arms on a more robust frame, a giant arm pack on its back: two giant arms over the cab)
  'giant-arm-walker': row('giant arm walker', ['giant arm pack walker', 'gap walker', 'gau walker', 'four arm walker', 'big arm walker', 'heavy lift walker', 'rescue walker'], 'offroad', 'work', F, ['driven', 'parked', 'watched'],
    { mecha: 'giantArmWalker', tech: 'walker' }),
  hovercraft: row('hovercraft', ['hoverbike', 'speeder', 'skimmer', 'grav car'], 'offroad', 'transport', M.concat(F), ['driven', 'traffic', 'watched'],
    { tech: 'hover' }),
  // ── drawn ───────────────────────────────────────────────────────────────────
  cart: row('cart', ['handcart', 'ox cart', 'rickshaw', 'barrow'], 'road', 'hauler', ['rustic', 'myth'], ['parked', 'watched'],
    { tech: 'cart' }),
  wagon: row('wagon', ['covered wagon', 'waggon', 'hay wagon'], 'road', 'hauler', ['rustic', 'myth'], ['parked', 'watched', 'driven'],
    { tech: 'wagon' }),
  coach: row('coach', ['carriage', 'stagecoach', 'horse carriage', 'royal coach'], 'road', 'transit', ['rustic', 'myth'], ['driven', 'watched'],
    { tech: 'coach' }),
  chariot: row('chariot', ['war chariot', 'racing chariot'], 'road', 'racer', ['myth'], ['driven', 'crewed', 'watched'],
    { tech: 'chariot' }),
  // ── on the water ────────────────────────────────────────────────────────────
  boat: row('boat', ['rowboat', 'rowing boat', 'dinghy', 'canoe', 'raft'], 'water', 'work', ['rustic', 'myth', 'modern'], ['driven', 'parked'],
    { tech: 'boat' }),
  // (the first of the craft shelf's boats, boat-archetypes.js: a hull from its lines, its outboard, floated by its weight)
  'motor-skiff': row('motor skiff', ['skiff', 'motorboat', 'motor boat', 'outboard boat', 'tiller boat', 'utility boat', 'aluminium boat', 'aluminum boat', 'tinny', 'fishing boat'], 'water', 'work', M, ['driven', 'parked', 'watched'],
    { craft: 'motorSkiff', tech: 'boat' }),
  'jon-boat': row('jon boat', ['john boat', 'jonboat', 'flat bottom boat', 'flat-bottomed boat', 'duck boat', 'punt boat'], 'water', 'work', M, ['driven', 'parked', 'watched'],
    { craft: 'jonBoat', tech: 'boat' }),
  'rib': row('rigid inflatable boat', ['rib', 'rib tender', 'rigid inflatable', 'inflatable boat', 'inflatable dinghy', 'rubber boat', 'yacht tender'], 'water', 'service', M, ['driven', 'parked', 'watched'],
    { craft: 'ribTender', tech: 'boat' }),
  'center-console': row('centre console', ['center console', 'center console boat', 'centre console boat', 'console boat', 'runabout', 'bay boat', 'sport fishing boat', 'cc boat'], 'water', 'commuter', M, ['driven', 'parked', 'watched'],
    { craft: 'ccRunabout', tech: 'boat' }),
  't-top-console': row('centre console with a T-top', ['t-top boat', 't-top console', 'center console with a t-top', 'hardtop console', 't-top center console'], 'water', 'commuter', M, ['driven', 'parked', 'watched'],
    { craft: 'ccTTop', tech: 'boat' }),
  'cuddy-cabin': row('cuddy cabin', ['cuddy', 'cuddy boat', 'cuddy cabin boat', 'cabin runabout', 'cabin cruiser', 'weekender'], 'water', 'commuter', M, ['driven', 'parked', 'watched'],
    { craft: 'cuddyCabin', tech: 'boat' }),
  // (the military boats: the field's roles on the water, crewed and fought from as the field's vehicles are)
  'combat-rhib': row('combat RHIB', ['military rhib', 'military rib', 'combat rib', 'assault boat', 'raiding craft', 'special forces boat', 'commando boat'], 'water', 'scout', M, FIGHT.concat('parked'),
    { craft: 'combatRhib', tech: 'boat' }),
  'riverine-patrol-boat': row('riverine patrol boat', ['patrol boat', 'river patrol boat', 'riverine boat', 'gunboat', 'river gunboat', 'armoured patrol boat', 'armored patrol boat'], 'water', 'patrol', M, FIGHT.concat('parked'),
    { craft: 'riverinePatrol', tech: 'boat' }),
  // (its well deck carries the field's vehicles: vehicle-registry/carry.js)
  'landing-craft': row('landing craft', ['lcm', 'mechanised landing craft', 'mechanized landing craft', 'ramp boat', 'assault landing craft', 'landing barge', 'vehicle landing craft'], 'water', 'transport', M, FIGHT.concat('parked'),
    { craft: 'landingCraft', tech: 'ship' }),
  'naval-patrol-boat': row('navy patrol boat', ['naval patrol boat', 'fast patrol boat', 'coastal patrol boat', 'patrol craft', 'coastal patrol vessel', 'patrol vessel', 'navy boat'], 'water', 'patrol', M, FIGHT.concat('parked'),
    { craft: 'navalPatrol', tech: 'ship' }),
  // (a surface combatant: 'warship' stays the ship's word, 'frigate' the sailing ship's)
  destroyer: row('destroyer', ['guided missile destroyer', 'missile destroyer', 'navy destroyer', 'naval destroyer', 'surface combatant', 'destroyer escort', 'fleet escort'], 'water', 'armour', M, FIGHT.concat('parked'),
    { craft: 'destroyer', tech: 'ship' }),
  // ('carrier' alone is the field's carrier-borne fighters' role, never this ship's word)
  'aircraft-carrier': row('aircraft carrier', ['supercarrier', 'flattop', 'fleet carrier', 'carrier ship', 'attack carrier', 'navy carrier'], 'water', 'armour', M, FIGHT.concat('parked'),
    { craft: 'aircraftCarrier', tech: 'ship' }),
  submarine: row('submarine', ['attack submarine', 'nuclear submarine', 'hunter-killer submarine', 'hunter killer', 'sub', 'fleet submarine'], 'water', 'armour', M, FIGHT.concat('parked'),
    { craft: 'attackSub', tech: 'ship' }),
  ship: row('ship', ['steamship', 'ferry', 'freighter', 'warship', 'galley', 'longship'], 'water', 'transport', ['myth', 'modern'], ['driven', 'watched', 'crewed'],
    { tech: 'ship' }),
  'sailing-ship': row('sailing ship', ['galleon', 'frigate', 'schooner', 'clipper', 'sloop', 'tall ship', 'junk', 'dhow'], 'water', 'transport', ['rustic', 'myth'], ['driven', 'watched', 'crewed'],
    { tech: 'ship' }),
  // ── in the air ──────────────────────────────────────────────────────────────
  glider: row('glider', ['sailplane', 'training glider'], 'air', 'trainer', M, AIR,
    { sky: 'glider', tech: 'winged' }),
  'light-plane': row('light plane', ['piston trainer', 'four-seat trainer', 'high wing trainer', 'bush plane'], 'air', 'trainer', M, AIR,
    { craft: 'lightSingle', sky: 'trainer', tech: 'winged' }),
  'jet-trainer': row('jet trainer', ['training jet'], 'air', 'trainer', M, AIR,
    { sky: 'jet', tech: 'winged' }),
  warbird: row('warbird', ['piston fighter', 'propeller fighter'], 'air', 'superiority', M, FIGHT,
    { craft: 'warbird', sky: 'warbird', tech: 'winged' }),
  'jet-fighter': row('jet fighter', ['fighter jet', 'multirole fighter'], 'air', 'superiority', M, FIGHT,
    { craft: 'jetFighter', sky: 'multirole', tech: 'winged' }),
  'delta-interceptor': row('delta interceptor', ['tailless delta', 'delta wing fighter'], 'air', 'interceptor', M, FIGHT,
    { craft: 'deltaInterceptor', sky: 'deltaInterceptor', tech: 'winged' }),
  'carrier-fighter': row('carrier strike fighter', ['naval jet', 'carrier jet'], 'air', 'carrier', M, FIGHT,
    { craft: 'carrierFighter', sky: 'carrierFighter', tech: 'winged' }),
  'naval-corsair': row('gull-wing carrier fighter', ['corsair', 'gull wing fighter'], 'air', 'carrier', M, FIGHT,
    { craft: 'navalCorsair', sky: 'navalWarbird', tech: 'winged' }),
  'attack-jet': row('attack jet', ['close support jet', 'ground attack jet'], 'air', 'strike', M, FIGHT,
    { craft: 'attackJet', sky: 'attack', tech: 'winged' }),
  'tactical-transport': row('tactical transport', ['cargo plane', 'military transport', 'airlifter'], 'air', 'transport', M, AIR,
    { craft: 'tacticalTransport', sky: 'transport', tech: 'winged' }),
  'stealth-strike': row('stealth strike jet', ['stealth jet', 'stealth bomber', 'stealth fighter'], 'air', 'stealth', M, FIGHT,
    { craft: 'stealthStrike', sky: 'stealth', tech: 'winged' }),
  bizjet: row('business jet', ['bizjet', 'private jet', 'executive jet'], 'air', 'courier', M, AIR,
    { scenery: 'bizjet', craft: 'bizjet', tech: 'winged' }),
  regional: row('regional airliner', ['regional', 'turboprop', 'commuter plane', 'regional jet'], 'air', 'liner', M, AIR,
    { scenery: 'regional', craft: 'regional', tech: 'winged' }),
  airliner: row('airliner', ['narrowbody', 'jetliner', 'passenger jet', 'single-aisle jet'], 'air', 'liner', M, AIR,
    { scenery: 'airliner', craft: 'narrowbody', tech: 'winged' }),
  widebody: row('widebody airliner', ['widebody', 'long-haul jet', 'twin-aisle jet', 'twin-engine widebody'], 'air', 'liner', M, AIR,
    { scenery: 'widebody', craft: 'widebody', tech: 'winged' }),
  // (the four-engined jumbo, an upper deck over its nose, a class and not a replica: the words "jumbo" are its)
  'jumbo-jet': row('jumbo jet', ['jumbo', 'four-engine airliner', 'four engine jet', 'quad jet', 'upper deck airliner', 'humped airliner'], 'air', 'liner', M, AIR,
    { craft: 'jumbo', tech: 'winged' }),
  'camera-drone': row('camera drone', ['quadcopter', 'camera quad', 'quad drone', 'consumer drone'], 'air', 'survey', M, AIR,
    { craft: 'cameraQuad', rotor: 'cameraQuad', tech: 'rotor' }),
  'racing-drone': row('racing drone', ['fpv drone', 'fpv quad', 'racing quad', 'freestyle quad'], 'air', 'racer', M, ['driven', 'watched'],
    { craft: 'fpvRacer', rotor: 'fpvRacer', tech: 'rotor' }),
  'inspection-drone': row('inspection drone', ['enterprise drone', 'survey quad', 'mapping quad'], 'air', 'survey', M, AIR,
    { craft: 'inspectionQuad', rotor: 'inspectionQuad', tech: 'rotor' }),
  'heavy-lift-drone': row('heavy-lift drone', ['hexacopter', 'cargo hexacopter', 'heavy lifter'], 'air', 'hauler', M, AIR,
    { craft: 'heavyHex', rotor: 'heavyHex', tech: 'rotor' }),
  'coaxial-drone': row('coaxial octocopter', ['x8 drone', 'octocopter', 'lidar drone', 'mapping drone'], 'air', 'survey', M, AIR,
    { craft: 'coaxX8', rotor: 'coaxX8', tech: 'rotor' }),
  'crop-sprayer': row('crop-spraying drone', ['spray drone', 'agricultural drone', 'ag drone', 'crop duster drone'], 'air', 'work', M, AIR,
    { craft: 'cropSprayer', rotor: 'cropSprayer', tech: 'rotor' }),
  'delivery-drone': row('delivery drone', ['parcel drone', 'package drone', 'courier drone'], 'air', 'hauler', M, AIR,
    { craft: 'deliveryQuad', rotor: 'deliveryQuad', tech: 'rotor' }),
  'hand-launched-drone': row('hand-launched drone', ['recon drone', 'small uav', 'hand launched uav'], 'air', 'patrol', M, AIR,
    { craft: 'handLaunch', tech: 'winged' }),
  'twin-boom-drone': row('twin-boom drone', ['tactical drone', 'tactical uav', 'catapult drone'], 'air', 'patrol', M, AIR,
    { craft: 'twinBoom', tech: 'winged' }),
  'long-endurance-drone': row('long-endurance drone', ['male drone', 'predator drone', 'reaper drone', 'armed drone', 'hunter-killer drone'], 'air', 'strike', M, FIGHT,
    { craft: 'maleRecon', sky: 'male', tech: 'winged' }),
  'flying-wing-drone': row('flying-wing drone', ['combat drone', 'ucav', 'stealth drone'], 'air', 'stealth', M, FIGHT,
    { craft: 'flyingWing', tech: 'winged' }),
  quadplane: row('quadplane', ['vtol drone', 'vtol mapper', 'hybrid drone'], 'air', 'survey', M, AIR,
    { craft: 'quadplane', tech: 'winged' }),
  'loitering-munition': row('loitering munition', ['kamikaze drone', 'suicide drone', 'loitering drone'], 'air', 'strike', M, ['crewed', 'watched'],
    { craft: 'loiterMunition', sky: 'loiter', tech: 'winged' }),
  'light-helicopter': row('light helicopter', ['news helicopter', 'police helicopter', 'private helicopter', 'light chopper'], 'air', 'courier', M, AIR,
    { craft: 'lightHeli', rotor: 'lightHeli', tech: 'rotor' }),
  // (the helicopter people mean when they say only the word: the medium utility machine, medevac or assault by its look)
  helicopter: row('helicopter', ['chopper', 'rotorcraft', 'copter', 'gyrocopter', 'utility helicopter', 'medevac helicopter', 'assault helicopter', 'troop helicopter', 'utility chopper'], 'air', 'transport', M, HELI,
    { craft: 'utilityHeli', rotor: 'utilityHeli', tech: 'rotor' }),
  'attack-helicopter': row('attack helicopter', ['gunship', 'helicopter gunship', 'attack chopper', 'tandem attack helicopter'], 'air', 'strike', M, HELI,
    { craft: 'attackHeli', rotor: 'attackHeli', tech: 'rotor' }),
  'tandem-helicopter': row('tandem-rotor helicopter', ['heavy lift helicopter', 'twin rotor helicopter', 'cargo helicopter', 'tandem rotor helicopter'], 'air', 'transport', M, HELI,
    { craft: 'tandemHeli', rotor: 'tandemHeli', tech: 'rotor' }),
  airship: row('airship', ['zeppelin', 'dirigible', 'blimp', 'balloon'], 'air', 'liner', ['myth', 'modern'], ['driven', 'watched'],
    { tech: 'airship' }),
  // ── in the void ─────────────────────────────────────────────────────────────
  'space-fighter': row('space fighter', ['starfighter', 'space plane'], 'space', 'superiority', F, FIGHT,
    { sky: 'fighter', tech: 'winged' }),
  'sentry-probe': row('sentry probe', ['survey probe', 'probe drone', 'hover probe'], 'space', 'survey', F, ['watched', 'parked', 'crewed'],
    { craft: 'sentryProbe', tech: 'hover' }),
  'dart-probe': row('dart probe', ['racing probe', 'race probe'], 'space', 'racer', F, ['driven', 'watched'],
    { craft: 'dartProbe', tech: 'hover' }),
  'cargo-probe': row('cargo probe', ['hauler probe', 'space cargo drone'], 'space', 'hauler', F, ['traffic', 'parked', 'watched'],
    { craft: 'cargoProbe', tech: 'hover' }),
  'watch-probe': row('watch probe', ['spy probe', 'scout probe'], 'space', 'patrol', F, ['watched', 'parked', 'crewed'],
    { craft: 'watchProbe', tech: 'hover' }),
  'seeker-probe': row('seeker probe', ['seeker drone', 'hunter probe'], 'space', 'strike', F, ['crewed', 'watched'],
    { craft: 'seekerProbe', tech: 'hover' }),
  'seeder-probe': row('seeder probe', ['terraforming drone', 'seed drone'], 'space', 'work', F, ['traffic', 'parked', 'watched'],
    { craft: 'seederProbe', tech: 'hover' }),
  'strike-foil': row('four-foil snubfighter', ['snubfighter', 'foil fighter'], 'space', 'superiority', F, FIGHT,
    { craft: 'strikeFoil', tech: 'winged' }),
  'twin-panel': row('twin-panel interceptor', ['panel fighter'], 'space', 'superiority', F, FIGHT,
    { craft: 'twinPanel', tech: 'winged' }),
  'advanced-panel': row('bent-panel command fighter', ['command fighter', 'bent panel fighter'], 'space', 'superiority', F, FIGHT,
    { craft: 'advancedPanel', tech: 'winged' }),
  'tri-panel-defender': row('tri-wing defender', ['defender', 'tri-wing fighter'], 'space', 'superiority', F, FIGHT,
    { craft: 'triPanelDefender', tech: 'winged' }),
  'colonial-dart': row('carrier-borne colonial dart', ['colonial dart'], 'space', 'carrier', F, FIGHT,
    { craft: 'colonialDart', tech: 'winged' }),
  'heavy-fighter': row('carrier heavy fighter', ['heavy fighter'], 'space', 'carrier', F, FIGHT,
    { craft: 'heavyFighter', tech: 'winged' }),
  'pod-spine': row('twin-nacelle assault bomber', ['assault bomber', 'nacelle bomber'], 'space', 'strike', F, FIGHT,
    { craft: 'podSpine', tech: 'winged' }),
  'twin-pod-bomber': row('twin-pod panel bomber', ['panel bomber', 'pod bomber'], 'space', 'strike', F, FIGHT,
    { craft: 'twinPodBomber', tech: 'winged' }),
  'arrow-interceptor': row('arrowhead interceptor', ['arrowhead'], 'space', 'interceptor', F, FIGHT,
    { craft: 'arrowInterceptor', tech: 'winged' }),
  'dagger-interceptor': row('dagger-panel interceptor', ['dagger interceptor', 'dagger fighter'], 'space', 'interceptor', F, FIGHT,
    { craft: 'daggerInterceptor', tech: 'winged' }),
  'facet-raider': row('faceted stealth raider', ['stealth raider', 'facet raider'], 'space', 'stealth', F, FIGHT,
    { craft: 'facetRaider', tech: 'winged' }),
  'utility-shuttle': row('twin-pod utility shuttle', ['utility shuttle', 'shuttle', 'dropship'], 'space', 'transport', F, AIR,
    { craft: 'utilityShuttle', tech: 'winged' }),
  'command-shuttle': row('tri-wing command shuttle', ['command shuttle'], 'space', 'courier', F, AIR,
    { craft: 'commandShuttle', tech: 'winged' }),
  starliner: row('starliner', ['star liner', 'passenger starship', 'space liner'], 'space', 'liner', F, AIR,
    { craft: 'starliner', tech: 'winged' }),
  'space-trainer': row('two-seat flight trainer', ['space trainer', 'flight trainer'], 'space', 'trainer', F, AIR,
    { craft: 'spaceTrainer', tech: 'winged' }),
};

/** The handle tables a row may name, and whether a key in one belongs to exactly one row (`claim: 'one'`) or a row
 *  only falls back to it (`claim: 'shared'`: the tech-crafter's concepts are drawn for many rows). */
export const HANDLE_TABLES = Object.freeze({
  scenery: { claim: 'one', table: 'vehicles/vehicles-css3d.js VEHICLE_REGISTRY' },
  net: { claim: 'one', table: 'polygonizer/vehicle-swept-net.js CAR_NETS, SMOOTH_BOX_NETS (an orphan net)' },
  physics: { claim: 'one', table: 'roads/vehicles.js VEHICLES' },
  fleet: { claim: 'one', table: 'roads/fleet.js FLEET' },
  assembly: { claim: 'one', table: 'vehicle-designer/assembly-bom.js VEH_ARCHETYPES' },
  ride: { claim: 'one', table: 'gameworld/ride.js RIDES' },
  supercar: { claim: 'one', table: 'car-designer/vehicle-library.js SUPERCAR_LIBRARY' },
  racer: { claim: 'one', table: 'car-designer racer grammar (racer.js)' },
  craft: { claim: 'one', table: 'craft-shelf/craft-archetypes.js CRAFT_ARCHETYPES' },
  sky: { claim: 'one', table: 'skyscape/eye.js CRAFT' },
  rotor: { claim: 'one', table: 'skyscape/rotor.js ROTOR' },
  cycle: { claim: 'one', table: 'cycle-shelf/cycle-archetypes.js CYCLE_ARCHETYPES' },
  car: { claim: 'one', table: 'car-shelf/car-library.js CAR_CARDS' },
  construction: { claim: 'one', table: 'construction-shelf/con-archetypes.js CON_ARCHETYPES' },
  mecha: { claim: 'one', table: 'mecha-shelf/mecha-archetypes.js MECHA_ARCHETYPES' },
  tech: { claim: 'shared', table: 'gameworld/tech-crafter.js CRAFT_TRAITS.vehicle (a form\'s variant)' },
});

// ── names ───────────────────────────────────────────────────────────────────
// The furnishings' rule (furnishings/roster.js): lowercase, articles dropped, hyphens and underscores read as spaces.
const ARTICLES = /^(a|an|the|some)\s+/;
export function normalizeName(word) {
  return String(word || '').toLowerCase().trim().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').replace(ARTICLES, '');
}
const words = (id) => id.replace(/-/g, ' ');

let NAME_INDEX = null;
/** Every word that names a vehicle → its id: the id as words, the label, the aliases. Throws on a collision: one
 *  word, one vehicle. */
export function vehicleNameIndex() {
  if (NAME_INDEX) return NAME_INDEX;
  const index = new Map();
  const claim = (word, id) => {
    const key = normalizeName(word);
    if (!key) return;
    const had = index.get(key);
    if (had && had !== id) throw new Error(`vehicle-registry: "${key}" names both ${had} and ${id}`);
    index.set(key, id);
  };
  for (const [id, r] of Object.entries(VEHICLES)) {
    claim(words(id), id);
    claim(r.label, id);
    for (const a of r.aliases) claim(a, id);
  }
  NAME_INDEX = index;
  return index;
}

/** A word people say → `{ id, row }`, or null. Tries the word, then its singular ('buses' → 'bus', 'tanks' → 'tank'). */
export function resolveVehicle(word) {
  const key = normalizeName(word);
  if (!key) return null;
  const index = vehicleNameIndex();
  const tries = [key];
  if (key.endsWith('ses') || key.endsWith('xes') || key.endsWith('ches') || key.endsWith('shes')) tries.push(key.slice(0, -2));
  if (key.endsWith('ies')) tries.push(`${key.slice(0, -3)}y`);
  if (key.endsWith('s')) tries.push(key.slice(0, -1));
  for (const t of tries) {
    const id = index.get(t);
    if (id) return { id, row: VEHICLES[id] };
  }
  return null;
}

// ── handles ─────────────────────────────────────────────────────────────────
const list = (v) => (v == null || v === false ? [] : v === true ? [true] : Array.isArray(v) ? v : [v]);

/** A row's keys, by table: `{ scenery: [...], physics: [...], … }` (only the tables it names). */
export function handlesOf(id) {
  const r = VEHICLES[id];
  if (!r) return null;
  return Object.fromEntries(Object.entries(r.handles).map(([t, v]) => [t, list(v)]).filter(([, v]) => v.length));
}

let BY_HANDLE = null;
/** The row a legacy table's key belongs to, or null (`rowOfHandle('ride', 'van')` → 'minivan'). For the tech table,
 *  the first row that falls back to the concept. */
export function rowOfHandle(table, key) {
  if (!BY_HANDLE) {
    BY_HANDLE = new Map();
    for (const id of Object.keys(VEHICLES)) {
      for (const [t, keys] of Object.entries(handlesOf(id))) for (const k of keys) if (!BY_HANDLE.has(`${t}:${k}`)) BY_HANDLE.set(`${t}:${k}`, id);
    }
  }
  return BY_HANDLE.get(`${table}:${key}`) ?? null;
}

/** The rows that can fill a role, in roster order. */
export function vehiclesForRole(role) {
  return Object.keys(VEHICLES).filter((id) => VEHICLES[id].role === role);
}

// ── search ──────────────────────────────────────────────────────────────────
const tokens = (s) => normalizeName(s).split(' ').filter((t) => t.length > 1);
const stem = (t) => (t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t);

/**
 * Search the roster: ranked rows `[{ id, row, score, why }]`. Words rank first (the id or an alias exactly, then the
 * share of the asked words found in the row's words); the facets filter (`realm`, `role`, `era`, `use`: a row that
 * does not have it is left out). With no words, every row that passes the facets, in roster order. Deterministic: ties
 * keep roster order.
 */
export function findVehicles({ words: asked, realm, role, era, use, limit = 12 } = {}) {
  const exact = asked ? resolveVehicle(asked) : null;
  const want = asked ? tokens(asked).map(stem) : [];
  const out = [];
  Object.entries(VEHICLES).forEach(([id, r], order) => {
    if (realm && r.realm !== realm) return;
    if (role && r.role !== role) return;
    if (era && !r.eras.includes(era)) return;
    if (use && !r.uses.includes(use)) return;
    let score = 0;
    const why = [];
    if (exact?.id === id) { score = 100; why.push('named exactly'); }
    else if (want.length) {
      const have = new Set([words(id), r.label, ...r.aliases, r.role, r.realm].flatMap(tokens).map(stem));
      const hit = want.filter((t) => have.has(t));
      if (!hit.length) return;
      score = Math.round((60 * hit.length) / want.length);
      why.push(`its words: ${hit.join(', ')}`);
    }
    out.push({ id, row: r, score, why, order });
  });
  out.sort((a, b) => b.score - a.score || a.order - b.order);
  return out.slice(0, limit).map(({ order, ...x }) => x);
}

/** A refusal's tail: the rows a word nearly names, for an error that points at the registry. */
export function suggestVehicles(word, filter = {}) {
  const found = findVehicles({ words: word, ...filter, limit: 5 });
  return found.length ? `the vehicle registry has ${found.map((f) => `'${f.id}' (${f.row.label})`).join(', ')}` : 'see the vehicle registry (get_solid_vocab { id: \'vehicle\' })';
}
