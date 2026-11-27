/**
 * VEHICLE ENCOUNTERS — a vehicle boss is EVENT driven: what it does is its STATE's (a tank driving its route or
 * stranded; a gunship on a run or hovering to turn; a walker walking, limping or down on its knees), and it is won by
 * MECHANICS, never by pouring rounds into it: a mine under a track, a launcher round into a hover, plates stripped off a
 * leg until the joint behind shows. Its body is PARTS, each a box on it in its own frame (x ahead, y left, z up from its
 * belly), each saying what hits it takes (`takes`: a `round`, an `explosive` (a launcher's round, a grenade), a `mine`),
 * how many break it (`hits`), what it hides until then (a part `behind` another is not there to hit until that one is
 * broken), and whether it is a WEAK spot (`weak`: its hits come off the vehicle's health, `mult` times). A part `shown`
 * only in a state (a gunship's rotor hub while it hovers) is hit then alone. Its `dress` is how it looks, boxes in the
 * same frame (`{ box, fill, alpha? }`), apart from the parts a hit is judged on. A state moves on (`to`) when its parts are
 * broken (`broken: [parts]`, all of them or `any`), when its run is flown (`flown`), or after seconds (`after`).
 *
 * A vehicle of the MECHA SHELF (`frame`: its word, a siege walker, a brood walker) is drawn as itself and not as its dress:
 * its figure the artillery range's rig of it (gameworld/combat/frames.js, built by gameworld/combat/boss-figures.js), each
 * state saying what its body does (`form`: the frame's form it is in, 'tank' its wheels; `clip`: a clip of its own played
 * through the state, a reload or the fold), its walk and its drive at their own `stride` ({ walker, tank }); a part that
 * is shot off it hides its `bones`. A part may be `shown` in several states (a list), and reached only `from` where it
 * faces (`behind` the vehicle, or its own `side`, within `arc` degrees): a reloader on its back is hit from behind. A
 * state's way on after seconds may be `slower` for each of some parts broken (`slower: { parts, by }`: its seconds times
 * 1 + `by` for each): its reload, for each reloader shot down. A state that is its WINDOW (`window: true`: a reload, a
 * walk, a fold) is the fight's breath and lays no move. A CARRIER (`carrier`) fights through what it carries: gunners on
 * it, drones from its bays, a package a hacked drone carries home (worlds/controllable/boss.js).
 *
 * A part may fall in an ORDER (`order`: its place, 1 the first): struck while a part ahead of it stands, it counts nothing
 * and the vehicle RETORTS (`retort`: a move of its own, laid at once). A part `open` is struck only in its state's move's
 * opening. A state may be a part's TURN (`head`): once that part is broken, the turn is skipped. A `blow` is a blade's
 * hit (the melee's). A BEAST (`beast`: the hydra) is such a body of heads, each a part and each its turn.
 *
 *   VEHICLES                   the shelf (a new vehicle boss is a row)
 *   readVehicle(v)             → the vehicle checked (throws naming the fault)
 *   partHit(v, part, kind, state, broken, { open }) → what a hit of that kind on that part does: { part, counts, weak,
 *                                mult, wrong? } or null
 *   outOfOrder(v, part, broken), nextInOrder(v, broken), turnPast(v, to, broken)   the order and the turns
 *   vehicleLaws(v, { arms, mines }?) → [{ law, holds, says }]   winnable (a weak spot reached by the arms in hand) ·
 *                                moves-hold · every-state-moves (a state that attacks has moves, each holding; a window
 *                                and a carrier's states are not asked) · mines-enough (a vehicle won by mines is given them)
 *
 * Pure data and readers; the runtime is worlds/controllable/boss.js.
 */
import { PATTERNS } from './patterns.js';
import { patternLaws, BODY } from './laws.js';

const no = (msg) => { throw new Error(`vehicle boss: ${msg}`); };
const HIT_KINDS = ['round', 'explosive', 'mine', 'blow'];

// A TANK: it drives its route and its gun follows you. Its tracks break on mines laid in its path; stranded, its
// engine grille faces where it cannot turn to cover, and launcher rounds through it end it. (Kept by name: a body that
// becomes a tank is beaten as this one is, its states, its moves and its parts this row's: the siege walker's folded form)
const TANK = {
  tank: { name: 'The tank', title: 'mines under its tracks, then its grille', reads: 'a main battle tank driving a loop of the yard, its gun turning after you',
    size: [7.2, 3.6, 2.4], speed: 3, look: { tell: '#ffcf4a', hazard: '#ff8a3a' },
    dress: [{ box: [[-3.6, -1.25, 0.45], [3.6, 1.25, 1.55]], fill: '#4d5841' }, { box: [[-1.7, -1.3, 1.55], [1.3, 1.3, 2.35]], fill: '#56624a' }, { box: [[1.3, -0.14, 1.82], [5.4, 0.14, 2.1]], fill: '#3a4235' }, { box: [[-0.6, 0.3, 2.35], [0.2, 0.9, 2.6]], fill: '#454e3e' }],
    parts: {
      hull: { box: [[-3.6, -1.8, 0.4], [3.6, 1.8, 2.4]], takes: ['explosive'], hits: 0, weak: true, mult: 0.08, reads: 'armour: a launcher round scratches it' },
      'track-left': { box: [[-3.6, 1.2, 0], [3.6, 1.8, 1.1]], takes: ['mine'], hits: 1, reads: 'the left track: a mine under it breaks it' },
      'track-right': { box: [[-3.6, -1.8, 0], [3.6, -1.2, 1.1]], takes: ['mine'], hits: 1, reads: 'the right track' },
      grille: { box: [[-3.8, -1, 1.2], [-3.4, 1, 2.1]], takes: ['explosive', 'round'], hits: 0, weak: true, mult: 1, shown: 'stranded', reads: 'the engine grille, open to the rear once it cannot turn' },
    },
    states: {
      driving: { moves: { 'main-gun': 2, 'coax': 2 }, tempo: 2.4, route: true, to: { stranded: { broken: ['track-left', 'track-right'], says: 'both tracks broken' } }, reads: 'drives its loop, its gun after you' },
      stranded: { moves: { 'main-gun': 3, 'coax': 1 }, tempo: 2, route: false, reads: 'tracks gone: it turns its turret only, its rear open' },
    },
    moves: {
      'main-gun': { pattern: 'lock', says: 'the turret swings onto you and settles; the barrel fires down the line', tune: { harm: 0.35 } },
      'coax': { pattern: 'fan', says: 'the coaxial gun rakes the fan in front of the turret' },
    },
    wins: [{ by: 'mines', says: 'lay mines on its route: a mine under a track breaks it, and with both broken it is stranded' }, { by: 'weak', part: 'grille', says: 'stranded, its engine grille faces away from the gun: launcher rounds through it' }] },
}.tank;
const mirror = (box) => [[box[0][0], -box[1][1], box[0][2]], [box[1][0], -box[0][1], box[1][2]]];
const STANDING = ['firing', 'reloading', 'walking'], FOLDED = ['tank', 'stranded'];
const legsGone = { broken: ['leg-left', 'leg-right'], any: true, says: 'a leg broken: it cannot stand' };

export const VEHICLES = Object.freeze({
  tank: TANK,
  // A GUNSHIP: it flies attack runs down the arena and hovers at each end to turn; it is armoured on a run, and its
  // rotor hub is open while it hovers
  gunship: { name: 'The gunship', title: 'cover from its runs, its hub as it hovers', reads: 'an attack helicopter flying runs over the arena, hovering to turn at each end',
    size: [13, 2.6, 3.8], speed: 28, look: { tell: '#ffe066', hazard: '#ff6b3a' },
    dress: [{ box: [[-3.8, -1.1, 0.6], [3.2, 1.1, 2.9]], fill: '#4b5649' }, { box: [[3.2, -0.7, 0.9], [5.2, 0.7, 2.2]], fill: '#3d4a52' }, { box: [[-6.5, -0.28, 1.8], [-3.8, 0.28, 2.4]], fill: '#475245' }, { box: [[-6.6, -0.05, 2.2], [-5.8, 0.05, 3.6]], fill: '#3c463a' },
      { box: [[-6.5, -6.5, 4.15], [6.5, 6.5, 4.22]], fill: '#1f2326', alpha: 0.35 }, { box: [[-2.6, -1.3, 0], [2.6, -1.15, 0.25]], fill: '#2d3230' }, { box: [[-2.6, 1.15, 0], [2.6, 1.3, 0.25]], fill: '#2d3230' }, { box: [[-0.8, -2.2, 1.3], [0.8, -1.1, 1.7]], fill: '#3c463a' }, { box: [[-0.8, 1.1, 1.3], [0.8, 2.2, 1.7]], fill: '#3c463a' }],
    parts: {
      hull: { box: [[-6.5, -1.3, 0], [6.5, 1.3, 3.8]], takes: ['explosive'], hits: 0, weak: true, mult: 0.1, reads: 'armoured against rounds; a launcher round on a run barely tells' },
      'rotor-hub': { box: [[-0.9, -0.9, 3.2], [0.9, 0.9, 4.2]], takes: ['explosive'], hits: 0, weak: true, mult: 1, shown: 'hover', reads: 'the rotor hub, open while it hovers low to turn' },
    },
    states: {
      run: { moves: { 'rocket-run': 1 }, tempo: 1, altitude: 16, to: { hover: { flown: true, says: 'the run is flown' } }, reads: 'a run down the arena: rockets walked down a line, the cover on it is yours' },
      hover: { moves: { 'door-gun': 2 }, tempo: 2.2, altitude: 7, to: { run: { after: 6, says: 'six seconds hovering' } }, reads: 'hovering low at the end to turn: its door gun sweeps, its hub is open' },
    },
    moves: {
      'rocket-run': { pattern: 'strafe', says: 'it noses down onto its run; the rockets\' line is marked on the floor', tune: { harm: 0.3 } },
      'door-gun': { pattern: 'sweep', says: 'the door gunner swings onto you; the arc is marked', tune: { reach: 14 } },
    },
    wins: [{ by: 'cover', says: 'its runs walk rockets down a line: hard cover on the line, or off it' }, { by: 'weak', part: 'rotor-hub', says: 'launcher rounds into its rotor hub while it hovers' }] },
  // A WALKER: armour plates on its legs; launcher rounds strip a plate and bare the knee behind it; both knees broken,
  // it comes down on them and its cockpit is open
  walker: { name: 'The walker', title: 'strip its legs, break its knees', reads: 'a two-legged walker, plated legs, a cannon on its back', size: [4.2, 4.6, 7.5], speed: 1.6, look: { tell: '#9fe3a0', hazard: '#ffb347' },
    dress: [{ box: [[-1.4, -1.5, 4.0], [1.8, 1.5, 6.6]], fill: '#5a6152' }, { box: [[-2.6, -0.4, 6.4], [0.8, 0.4, 7.3]], fill: '#454b40' }, { box: [[1.8, -0.5, 4.6], [2.5, 0.5, 5.4]], fill: '#3a3f36' },
      { box: [[-0.35, 1.55, 3.5], [0.35, 2.15, 5.0]], fill: '#4c5246' }, { box: [[-0.35, -2.15, 3.5], [0.35, -1.55, 5.0]], fill: '#4c5246' }, { box: [[-0.45, 1.45, 0], [0.45, 2.25, 1.6]], fill: '#4c5246' }, { box: [[-0.45, -2.25, 0], [0.45, -1.45, 1.6]], fill: '#4c5246' },
      { box: [[-1, 1.3, 0], [1.4, 2.4, 0.3]], fill: '#3f443a' }, { box: [[-1, -2.4, 0], [1.4, -1.3, 0.3]], fill: '#3f443a' }],
    parts: {
      'plate-left': { box: [[-0.7, 1.4, 1.2], [0.7, 2.3, 3.6]], takes: ['explosive'], hits: 3, reads: 'the left leg\'s plating: three launcher rounds strip it' },
      'plate-right': { box: [[-0.7, -2.3, 1.2], [0.7, -1.4, 3.6]], takes: ['explosive'], hits: 3, reads: 'the right leg\'s plating' },
      'knee-left': { box: [[-0.5, 1.5, 1.6], [0.5, 2.2, 3.2]], takes: ['explosive', 'round'], hits: 6, behind: 'plate-left', reads: 'the left knee, bare once its plate is off' },
      'knee-right': { box: [[-0.5, -2.2, 1.6], [0.5, -1.5, 3.2]], takes: ['explosive', 'round'], hits: 6, behind: 'plate-right', reads: 'the right knee' },
      cockpit: { box: [[-1.2, -1.1, 4.4], [1.6, 1.1, 6.2]], takes: ['explosive', 'round'], hits: 0, weak: true, mult: 1, shown: 'kneeling', reads: 'the cockpit, in reach once it is down on its knees' },
    },
    states: {
      walking: { moves: { stomp: 2, cannon: 2 }, tempo: 2.4, route: true, to: { limping: { broken: ['knee-left', 'knee-right'], any: true, says: 'a knee broken' } }, reads: 'walks after you, stamping and shelling' },
      limping: { moves: { stomp: 1, cannon: 2, 'chin-gun': 2 }, tempo: 2, route: true, to: { kneeling: { broken: ['knee-left', 'knee-right'], says: 'both knees broken' } }, reads: 'a knee gone: slower, its chin gun out' },
      kneeling: { moves: { 'chin-gun': 2 }, tempo: 2.6, route: false, reads: 'down on its knees: its cockpit in reach' },
    },
    moves: {
      stomp: { pattern: 'ring', says: 'a leg lifts high; the floor round its foot cracks', tune: { harm: 0.25 } },
      cannon: { pattern: 'rain', says: 'the back cannon rises; each shell\'s landing is marked' },
      'chin-gun': { pattern: 'sweep', says: 'the chin gun swings across; the arc is marked', tune: { reach: 12 } },
    },
    wins: [{ by: 'plates', says: 'launcher rounds strip a leg\'s plating, three to a leg' }, { by: 'weak', part: 'knee-left', says: 'then the bare knee breaks under rounds; both broken, it kneels' }, { by: 'weak', part: 'cockpit', says: 'kneeling, its cockpit is in reach' }] },
  // THE SIEGE WALKER (the mecha shelf's: a howitzer and a missile launcher on its back, a scorpion's tail each side to
  // reload them, its legs collapsing onto six wheels). Standing, it lays a barrage on you (cover from the marks), reloads
  // with its tails and walks its round: mines on its round break its legs, its reloaders shot from behind slow its
  // reload. A leg gone, it folds onto its wheels and is a TANK, beaten as the tank is (its tracks by mines, its engine
  // from behind once stranded), and its folding opens its HIPS, bare between its folded legs, from its sides.
  // (Its parts' boxes read off its own bodies in each form: frames.js `places`, held by boss-figures.test.js.)
  'siege-walker': { name: 'The siege walker', title: 'mines under its feet, then the tank it folds into', reads: 'an eight-metre siege walker, a howitzer and missiles on its back, its tails reloading them; it folds onto six wheels',
    frame: 'siege walker', size: [8.5, 5, 8.1], speed: 3.4, turn: 0.6, stride: { walker: 7.42, tank: 3.14 }, look: { tell: '#ffd27a', hazard: '#ff5a3a' },
    parts: {
      hull: { box: [[-4, -2.4, 0.5], [3.6, 2.4, 6.6]], takes: ['explosive'], hits: 0, weak: true, mult: 0.05, reads: 'armour' },
      'tail-left': { box: [[-3, 0.1, 7], [-1.8, 1.2, 8.6]], takes: ['round', 'explosive'], hits: 4, from: 'behind', arc: 75, shown: STANDING, bones: ['tailBaseL', 'tailSeg1L', 'tailSeg2L', 'tailHeadL'], reads: 'the left reloader, its root on its back: shot from behind, it reloads slower' },
      'tail-right': { box: mirror([[-3, 0.1, 7], [-1.8, 1.2, 8.6]]), takes: ['round', 'explosive'], hits: 4, from: 'behind', arc: 75, shown: STANDING, bones: ['tailBaseR', 'tailSeg1R', 'tailSeg2R', 'tailHeadR'], reads: 'the right reloader' },
      'leg-left': { box: [[-1.6, 0.3, 0], [2.6, 2.4, 3.6]], takes: ['mine'], hits: 2, shown: STANDING, reads: 'its left leg: two mines under its foot break it' },
      'leg-right': { box: mirror([[-1.6, 0.3, 0], [2.6, 2.4, 3.6]]), takes: ['mine'], hits: 2, shown: STANDING, reads: 'its right leg' },
      'track-left': { box: [[-4, 1.6, 0], [3.2, 2.8, 1.2]], takes: ['mine'], hits: 1, shown: FOLDED, reads: 'its left wheels: a mine under them breaks them' },
      'track-right': { box: mirror([[-4, 1.6, 0], [3.2, 2.8, 1.2]]), takes: ['mine'], hits: 1, shown: FOLDED, reads: 'its right wheels' },
      'hip-left': { box: [[-0.5, 1.5, 1], [0.5, 2.1, 2]], takes: ['round', 'explosive'], hits: 0, weak: true, mult: 0.6, from: 'side', side: 'left', arc: 60, shown: FOLDED, reads: 'its left hip, bare between its folded legs: from its side' },
      'hip-right': { box: mirror([[-0.5, 1.5, 1], [0.5, 2.1, 2]]), takes: ['round', 'explosive'], hits: 0, weak: true, mult: 0.6, from: 'side', side: 'right', arc: 60, shown: FOLDED, reads: 'its right hip' },
      grille: { box: [[-3, -1, 1.2], [-2.4, 1, 2.6]], takes: ['explosive', 'round'], hits: 0, weak: true, mult: 1, shown: 'stranded', reads: 'its engine at the back of its pack, open once it cannot turn' },
    },
    states: {
      firing: { moves: { barrage: 1 }, tempo: 8, route: false, to: { folding: legsGone, reloading: { after: 7.5, says: 'the barrage is fired' } }, reads: 'stands and lays a barrage on you' },
      reloading: { window: true, route: false, clip: 'tails:reload', loops: 2, to: { folding: legsGone, walking: { after: 8, slower: { parts: ['tail-left', 'tail-right'], by: 0.8 }, says: 'reloaded' } }, reads: 'its tails reload it: the window' },
      walking: { window: true, route: true, to: { folding: legsGone, firing: { after: 7, says: 'it stops to fire' } }, reads: 'walks its round: where mines go' },
      folding: { window: true, route: false, clip: 'transform:tank', to: { tank: { after: 2.2, says: 'down on its wheels' } }, reads: 'its legs fold onto its wheels' },
      tank: { form: 'tank', moves: { ...Object.fromEntries(Object.entries(TANK.states.driving.moves)) }, tempo: TANK.states.driving.tempo, route: true, slow: 1.5, to: { stranded: { broken: ['track-left', 'track-right'], says: 'both its wheels broken' } }, reads: 'a tank: drives its round, its gun after you' },
      stranded: { form: 'tank', moves: { ...TANK.states.stranded.moves }, tempo: TANK.states.stranded.tempo, route: false, reads: 'stranded: its engine open behind it' },
    },
    moves: {
      barrage: { pattern: 'barrage', says: 'its howitzer and launcher rise; every landing is marked' },
      ...TANK.moves,
    },
    wins: [{ by: 'cover', says: 'its barrage is marked as it is fired: a wall between you and the gun' }, { by: 'mines', says: 'mines on its round, under its feet: a leg broken and it folds' }, { by: 'weak', part: 'hip-left', says: 'folded, its hips are bare: from its sides' }, { by: 'weak', part: 'grille', says: 'its wheels mined, it is stranded: its engine from behind' }] },
  // THE BROOD WALKER (the mecha shelf's: four legs, its feet the eggs its drones live in, its hull a hangar that repairs
  // them). It does not fire: its CREW do, gunners on its roof and in its hangar doors, and its DRONES do, endless. It is
  // beaten with them: its gunners put down, a courier drone hacked with the RF gun fetches a package and carries it home
  // "for repair", into a hangar door, where it goes off. From the second, its drones chase the hacked one. (The carrier's
  // workings: worlds/controllable/boss.js.)
  'brood-walker': { name: 'The brood walker', title: 'its gunners, then its own drones turned on it', reads: 'a four-legged drone carrier, its hull a hangar, gunners on its roof and in its doors',
    frame: 'brood walker', size: [7, 7.5, 9.1], speed: 1, turn: 0.2, stride: { walker: 2.56 }, look: { tell: '#9fd8ff', hazard: '#ff7a3a' },
    parts: {
      hangar: { box: [[-1.8, -1.6, 6.2], [0.6, 1.6, 8]], takes: ['explosive'], hits: 0, weak: true, mult: 1, reads: 'its hangar, through its doors: what goes off in there wrecks it' },
    },
    states: { brood: { route: false, turn: false, reads: 'stands over its yard, its drones out, its gunners watching' } },
    moves: {},
    carrier: {
      // (its gunners: on its roof facing ahead, in each hangar door facing out of its side; `face` degrees off its heading,
      // + to its left; its doors' middles; its drones' bays at its eggs' blunt ends)
      crew: [
        { id: 'roof', name: 'the roof gunner', at: [0.4, 0, 8.7], face: 0, arc: 85 },
        { id: 'door-right', name: 'the right door gunner', at: [-0.55, -0.9, 6.5], face: -90, arc: 75, door: 'right' },
        { id: 'door-left', name: 'the left door gunner', at: [-0.55, 0.9, 6.5], face: 90, arc: 75, door: 'left' },
      ],
      doors: { right: [-0.55, -1.4, 7.13], left: [-0.55, 1.4, 7.13] },
      bays: [[2.35, -3.6, 2.54], [2.35, 3.6, 2.54], [-2.35, -3.6, 2.54], [-2.35, 3.6, 2.54]],
      fire: { lay: 1.2, every: 3, burst: 4, harm: 0.1, range: 45 },
      drones: { count: 8, couriers: 2, reprint: 20, alt: 7, speed: 8, orbit: 20,
        hunter: { hp: 30, most: 2, see: 24, drop: { every: 9, r: 3, harm: 0.14, mark: 1.3 } },
        courier: { hp: 120, every: 12, stay: 40, speed: 6, orbit: 15 },
        chase: { after: 1, most: 2, every: 1.8, hurt: 20, range: 16 } },
      hack: { secs: 2, decay: 0.3, slip: 0.3 },
      delivery: { harm: 110, r: 4 }, restock: 8,
    },
    wins: [{ by: 'crew', says: 'its gunners first, from outside their arcs: a dart or rounds' }, { by: 'hack', says: 'a courier (its green light) held in the RF gun is yours: it fetches a package and takes it home into a door whose gunner is down' }, { by: 'escort', says: 'from the second, its drones chase the hacked one: shoot them off it' }] },
  // THE HYDRA (the first of the BIG BOSSES): a many-headed beast rooted in its lair, never walking, turning to face you.
  // Its five heads take TURNS round the ring (a state each, `head` its part: skipped once that head is severed): the
  // awake head's eyes light, it attacks in its element, then hangs low and gasping, its OPENING (`open`: struck only
  // then). The heads must fall in an ORDER (`order`) that is not the turn order, shown in its lair (seal stones in the
  // heads' colours) and on its bar: a head struck out of its order shrugs the cut off and the hydra RETORTS (`retort`,
  // every head rearing: a ring round its body). All five severed, it rears and its HEART shows: the last stand
  hydra: { name: 'The Hydra', title: 'its heads, in the order of the seals', reads: 'a many-headed serpent rooted in a flooded lair, five necks fanned round its breast, each head its own element',
    size: [5, 7, 4.6], speed: 0, turn: 0.9, beast: true, look: { tell: '#ffe08a', hazard: '#ff8a5a' },
    dress: [{ box: [[-2.2, -2, 0], [2.2, 2, 2.4]], fill: '#3c4a3a' }],
    parts: {
      'head-ember': { box: [[0.85, -3.38, 0.4], [2.25, -1.98, 2.1]], takes: ['blow', 'round', 'explosive'], hits: 4, order: 2, shown: 'ember', open: true, element: 'fire', colour: '#ff6a1a', reads: 'the ember head, hung low and gasping after it attacks' },
      'head-venom': { box: [[1.98, -2.25, 0.4], [3.38, -0.85, 2.1]], takes: ['blow', 'round', 'explosive'], hits: 4, order: 4, shown: 'venom', open: true, element: 'poison', colour: '#8fe03a', reads: 'the venom head, hung low and gasping after it attacks' },
      'head-rime': { box: [[2.4, -0.7, 0.4], [3.8, 0.7, 2.1]], takes: ['blow', 'round', 'explosive'], hits: 4, order: 1, shown: 'rime', open: true, element: 'ice', colour: '#9fe8ff', reads: 'the rime head, hung low and gasping after it attacks' },
      'head-storm': { box: [[1.98, 0.85, 0.4], [3.38, 2.25, 2.1]], takes: ['blow', 'round', 'explosive'], hits: 4, order: 5, shown: 'storm', open: true, element: 'thunder', colour: '#fff27a', reads: 'the storm head, hung low and gasping after it attacks' },
      'head-gloom': { box: [[0.85, 1.98, 0.4], [2.25, 3.38, 2.1]], takes: ['blow', 'round', 'explosive'], hits: 4, order: 3, shown: 'gloom', open: true, element: 'dark', colour: '#a86bff', reads: 'the gloom head, hung low and gasping after it attacks' },
      heart: { box: [[1.4, -0.9, 0.8], [2.6, 0.9, 2.4]], takes: ['blow', 'round', 'explosive'], hits: 0, weak: true, mult: 1, shown: 'heart', reads: 'its heart, bare in its breast once its last neck falls' },
    },
    retort: 'retort',
    states: {
      ember: { head: 'head-ember', moves: { 'ember': 1 }, tempo: 2.2, route: false, to: { venom: { after: 6.5 }, heart: { broken: ['head-ember', 'head-venom', 'head-rime', 'head-storm', 'head-gloom'] } }, reads: 'the ember head wakes, attacks, and hangs open' },
      venom: { head: 'head-venom', moves: { 'venom': 1 }, tempo: 2.2, route: false, to: { rime: { after: 6.5 }, heart: { broken: ['head-ember', 'head-venom', 'head-rime', 'head-storm', 'head-gloom'] } }, reads: 'the venom head wakes, attacks, and hangs open' },
      rime: { head: 'head-rime', moves: { 'rime': 1 }, tempo: 2.2, route: false, to: { storm: { after: 6.5 }, heart: { broken: ['head-ember', 'head-venom', 'head-rime', 'head-storm', 'head-gloom'] } }, reads: 'the rime head wakes, attacks, and hangs open' },
      storm: { head: 'head-storm', moves: { 'storm': 1 }, tempo: 2.2, route: false, to: { gloom: { after: 6.5 }, heart: { broken: ['head-ember', 'head-venom', 'head-rime', 'head-storm', 'head-gloom'] } }, reads: 'the storm head wakes, attacks, and hangs open' },
      gloom: { head: 'head-gloom', moves: { 'gloom': 1 }, tempo: 2.2, route: false, to: { ember: { after: 6.5 }, heart: { broken: ['head-ember', 'head-venom', 'head-rime', 'head-storm', 'head-gloom'] } }, reads: 'the gloom head wakes, attacks, and hangs open' },
      heart: { moves: { 'thrash': 2, 'retort': 1 }, tempo: 1.6, route: false, reads: 'headless, it rears and thrashes: its heart is bare' },
    },
    moves: {
      'ember': { pattern: 'sweep', says: 'rears back, its throat glowing; the arc it will breathe glows on the floor', tune: { reach: 8 } },
      'venom': { pattern: 'venom', says: 'its throat swells green; where its spit lands is marked' },
      'rime': { pattern: 'rain', says: 'rimes over and screams at the roof; where the hail falls is marked', tune: { harm: 0.12 } },
      'storm': { pattern: 'lock', says: 'sparks crawl over its crest; the line follows you, holds, and strikes', tune: { harm: 0.25 } },
      'gloom': { pattern: 'scythe', says: 'draws back low, its eyes gone dark; the arc glows at your chest' },
      'retort': { pattern: 'ring', says: 'every head rears at once, hissing; the water round it boils', tune: { harm: 0.2 } },
      'thrash': { pattern: 'quake', says: 'its stumps lash the floor; the ground round it heaves' },
    },
    wins: [{ by: 'order', says: 'strike each head in its opening, in the order its seals burn: a head out of order shrugs the cut off and the hydra lashes back' }, { by: 'weak', part: 'heart', says: 'with its last neck fallen, its heart is bare in its breast' }] },
});
export const VEHICLE_IDS = Object.keys(VEHICLES);

/** Read a vehicle boss (a row, or one of the same shape); → the vehicle (throws naming the fault). */
export function readVehicle(v, where = 'vehicle') {
  if (typeof v === 'string') { if (!VEHICLES[v]) no(`${where}: '${v}' is one of ${VEHICLE_IDS.join(', ')}`); v = VEHICLES[v]; }
  if (!v || typeof v !== 'object' || !v.parts || !v.states || !v.moves) no(`${where}: { name, size, speed, parts, states, moves, wins }`);
  const S = Object.keys(v.states);
  for (const [id, p] of Object.entries(v.parts)) {
    if (!Array.isArray(p.box) || p.box.length !== 2) no(`${where}.parts.${id}: box is [[x0, y0, z0], [x1, y1, z1]] in its own frame`);
    if (!Array.isArray(p.takes) || !p.takes.every((k) => HIT_KINDS.includes(k))) no(`${where}.parts.${id}: takes is a list of ${HIT_KINDS.join(', ')}`);
    if (p.behind !== undefined && !v.parts[p.behind]) no(`${where}.parts.${id}: behind names another part`);
    if (p.shown !== undefined && ![].concat(p.shown).every((x) => S.includes(x))) no(`${where}.parts.${id}: shown is one of its states, or a list of them (${S.join(', ')})`);
    if (p.from !== undefined && !['behind', 'side'].includes(p.from)) no(`${where}.parts.${id}: from is 'behind' or 'side'`);
    if (p.order !== undefined && !(Number.isInteger(p.order) && p.order >= 1)) no(`${where}.parts.${id}: order is its place in the sequence the parts fall in, 1 the first`);
    if (p.open !== undefined && typeof p.open !== 'boolean') no(`${where}.parts.${id}: open is true (struck only in its state's move's opening) or false`);
  }
  // (an ORDER is a sequence: 1 … n, each place once)
  const ord = Object.values(v.parts).filter((p) => p.order !== undefined).map((p) => p.order).sort((a, b) => a - b);
  if (ord.some((o, i) => o !== i + 1)) no(`${where}: the parts' orders are 1 … ${ord.length}, each once (have ${ord.join(', ')})`);
  if (v.retort !== undefined && !v.moves[v.retort]) no(`${where}.retort: one of its moves (what it does when a part is struck out of its order)`);
  for (const [id, s] of Object.entries(v.states)) {
    for (const m of Object.keys(s.moves || {})) if (!v.moves[m]) no(`${where}.states.${id}: '${m}' is not one of its moves`);
    if (s.head !== undefined && !v.parts[s.head]) no(`${where}.states.${id}.head: a part (the head whose turn it is: skipped once it is broken)`);
    for (const [t, c] of Object.entries(s.to || {})) {
      if (!S.includes(t)) no(`${where}.states.${id}.to: '${t}' is not a state`);
      if (!c || (c.broken === undefined && c.flown !== true && !(c.after > 0))) no(`${where}.states.${id}.to.${t}: { broken: [parts], any? } | { flown: true } | { after: seconds }`);
      for (const q of c.broken || []) if (!v.parts[q]) no(`${where}.states.${id}.to.${t}: '${q}' is not a part`);
    }
  }
  for (const [id, m] of Object.entries(v.moves)) if (!PATTERNS[m.pattern]) no(`${where}.moves.${id}: pattern is one of ${Object.keys(PATTERNS).join(', ')}`);
  return v;
}

/** What a hit of `kind` on `part` does in the vehicle's state (see the header), or null where it does nothing. `open`:
 * whether the state's move is in its opening (a part `open` is struck only then). A part in an ORDER struck before every
 * part ahead of it is broken is `wrong`: it counts nothing, and the vehicle retorts. */
export function partHit(v, part, kind, state, broken = {}, { open = true } = {}) {
  const p = v.parts[part];
  if (!p || broken[part] || !p.takes.includes(kind)) return null;
  if (p.behind && !broken[p.behind]) return null;
  if (p.shown && ![].concat(p.shown).includes(state)) return null;
  if (p.open && !open) return null;
  if (outOfOrder(v, part, broken)) return { part, counts: false, weak: false, mult: 0, wrong: true };
  return { part, counts: p.hits > 0, weak: !!p.weak, mult: p.mult ?? 1 };
}
/** Whether a part in an ORDER has a part ahead of it not yet broken (struck now, it is struck out of its order). */
export const outOfOrder = (v, part, broken = {}) => { const p = v.parts[part]; return p?.order !== undefined && Object.entries(v.parts).some(([q, x]) => x.order !== undefined && x.order < p.order && !broken[q]); };
/** The next part of an ORDER to break (its id), or null when none is left (the HUD's `next`). */
export const nextInOrder = (v, broken = {}) => Object.entries(v.parts).filter(([q, x]) => x.order !== undefined && !broken[q]).sort((a, b) => a[1].order - b[1].order)[0]?.[0] ?? null;
/** The state a vehicle moves to from `to`, past every state whose `head` is broken (its turn skipped), by each one's
 * own way on after seconds; `to` itself where its head stands (or it has none). */
export function turnPast(v, to, broken = {}) {
  let s = to;
  for (let k = 0; k < Object.keys(v.states).length && v.states[s]?.head && broken[v.states[s].head]; k++) {
    const after = Object.entries(v.states[s].to || {}).find(([, c]) => c.after);
    if (!after) break;
    s = after[0];
  }
  return s;
}

/** A vehicle boss's laws (see the header). `arms`: the hit kinds the level gives the body (round, explosive, mine). */
export function vehicleLaws(vehicle, { arms = ['round', 'explosive', 'mine'], mines = 4, body = BODY } = {}) {
  const v = readVehicle(vehicle), out = [];
  // WINNABLE: a weak spot that takes what is in hand, everything in front of it breakable by what is in hand
  const reach = (id, seen = new Set()) => { const p = v.parts[id]; if (!p || seen.has(id)) return false; seen.add(id); if (!p.takes.some((k) => arms.includes(k))) return false; return !p.behind || reach(p.behind, seen); };
  const weak = Object.entries(v.parts).filter(([, p]) => p.weak && (p.mult ?? 1) >= 0.5).map(([id]) => id), winners = weak.filter((id) => reach(id));
  // (and the state a shown weak spot waits for is reached: from the first state, by each way on whose parts are broken by
  // what is in hand, or by a run flown or seconds waited)
  const reached = new Set([Object.keys(v.states)[0]]);
  for (let grew = true; grew;) {
    grew = false;
    for (const s of [...reached]) for (const [t, c] of Object.entries(v.states[s].to || {})) {
      if (reached.has(t)) continue;
      const ok = !c.broken || (c.any ? c.broken.some((q) => reach(q)) : c.broken.every((q) => reach(q)));
      if (ok) { reached.add(t); grew = true; }
    }
  }
  const stateReached = (s) => [].concat(s).some((x) => reached.has(x));
  // (a carrier is won by what it carries home: its weak spot reached by its own drones, whatever is in hand)
  const won = v.carrier ? weak : winners.filter((id) => !v.parts[id].shown || stateReached(v.parts[id].shown));
  out.push({ law: 'winnable', holds: won.length > 0, says: won.length ? `won through ${won.join(', ')} with ${arms.join(', ')}` : `no weak spot is reached with ${arms.join(', ')}` });
  const bad = [];
  for (const [id, m] of Object.entries(v.moves)) {
    const P = PATTERNS[m.pattern], T = m.tune || {}, tuned = { ...P, ...(T.reach ? { reach: T.reach } : {}), hazards: P.hazards.map((h) => ({ ...h, ...(T.harm ? { harm: T.harm } : {}) })) };
    for (const l of patternLaws(tuned, body)) if (!l.holds) bad.push(`${id}: ${l.law}`);
  }
  // THE ORDER (a vehicle whose parts fall in one): each in its place reached in a turn (a state it is shown in, reached),
  // by what is in hand; with a retort for a part struck out of it
  const ordered = Object.entries(v.parts).filter(([, p]) => p.order !== undefined);
  if (ordered.length) {
    const lost = ordered.filter(([id, p]) => !p.takes.some((k) => arms.includes(k)) || (p.shown && !stateReached(p.shown))).map(([id]) => id);
    out.push({ law: 'order-reached', holds: !lost.length && !!v.retort, says: lost.length ? `out of reach in their turns: ${lost.join(', ')}` : !v.retort ? 'no retort for a part struck out of its order' : `${ordered.length} parts in an order, each in its turn, a retort for the wrong one` });
  }
  out.push({ law: 'moves-hold', holds: !bad.length, says: bad.length ? bad.join('; ') : 'every move told, escapable, survivable and opened after' });
  const idle = v.carrier ? [] : Object.entries(v.states).filter(([, s]) => !s.window && !Object.keys(s.moves || {}).length).map(([id]) => id);
  out.push({ law: 'every-state-moves', holds: !idle.length, says: idle.length ? `states with no move: ${idle.join(', ')}` : 'every state attacks' });
  const tracks = Object.values(v.parts).filter((p) => p.takes.includes('mine')).length;
  out.push({ law: 'mines-enough', holds: !tracks || mines >= tracks, says: tracks ? `${mines} mines for ${tracks} parts a mine breaks` : 'won without mines' });
  return out;
}
