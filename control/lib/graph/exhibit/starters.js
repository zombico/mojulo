/**
 * THE STARTERS: two exhibits made the way a museum's would be, from an expert's brief, each a list of create_exhibit
 * calls. They show the whole studio loop on two different grounds. The worked example walks through them, and the
 * orientation gallery tours the first.
 *
 *   pompeii   history/pompeii as it stood in 79 CE, its parts named so a stop can light them, its people in that year's
 *             dress; a tour of stops told for everyone and for young visitors; every claim taken from the town's own
 *             record (historic/record/pompeii.js), citing only the sources the record marks as read, graded by how
 *             far the record checks them.
 *   hydro     earth/hydro as a wing: its five arcs, each toured, and a states room of three heads, joined as one
 *             gallery. Every number a caption says is the energy chain's own (physics/hydro.js), computed here, so a
 *             caption cannot drift from the page. It needs nothing the Pompeii exhibit did not.
 *
 * A step's input is create_exhibit's, as an agent would write it. A gallery's room named '@<as>' is the ref an earlier
 * step made. The expert's sign-off is never written here: the accuracy gate belongs to the person who answers for the
 * claims. Pure data; makeStarter runs it through a door.
 */
import { POMPEII_RECORD } from '../historic/record/pompeii.js';
import { planHydroChain } from '../physics/hydro.js';

const ENTRY = new Map(POMPEII_RECORD.map((e) => [e.id, e]));

// a record entry's sources as a claim's cites: the ones read, never a search snippet
function citesOf(entry) {
  return entry.sources.filter((s) => !/snippet/.test(s.via || '')).slice(0, 3)
    .map((s) => `${s.author}, ${s.title} (${s.year})`.slice(0, 240));
}

// How sure a claim is, from how far the record checks its entry: read in a source is attested; known only through a
// secondary page, or a standard account no source in hand confirms, is reconstructed.
const GRADE_OF = { read: 'attested', secondary: 'reconstructed', unverified: 'reconstructed' };

/** A claim taken from the record: its words are the exhibit's, its sources and its grade the entry's. */
export function recordClaim(id, text) {
  const e = ENTRY.get(id);
  if (!e) throw new Error(`starters: the Pompeii record has no entry '${id}'`);
  return { id, text, cite: citesOf(e), grade: GRADE_OF[e.confidence] };
}

const POMPEII_CLAIMS = [
  recordClaim('walled-town', 'Some 64 to 67 hectares lay inside the walls, and seven of the town\'s gates were in use.'),
  recordClaim('lava-spur', 'The town stood on a spur of old lava about 40 m above the sea.'),
  recordClaim('vesuvius-before', 'Before 79 Vesuvius, about 8 km from the town, was one broad mountain, its slopes in vines.'),
  recordClaim('walls-quadratum', 'The walls ran about 3.2 km round and were 2 to 3 m thick; by the first century CE they were more relic than defence.'),
  recordClaim('forum-square', 'The forum was a square of about 143 by 38 m; its statues were not set up again after the earthquake of 62.'),
  recordClaim('capitolium', 'The temple of Jupiter at the forum\'s head was much destroyed in 62 and still awaited its restoration in 79.'),
  recordClaim('basilica', 'The basilica, the town\'s hall of business and law, measured about 55 by 24 m, with 28 columns round its nave.'),
  recordClaim('post-quake-repairs', 'In 79 the town was still a building site: scaffolding and piles of material stood where the earthquake\'s damage was being made good.'),
  recordClaim('hot-mixing', 'At a site under work in 79, builders mixed quicklime dry with volcanic ash before adding water.'),
  recordClaim('large-theatre', 'The large theatre seated about 5,000; its stage was rebuilt completely after 62.'),
  recordClaim('atrium-house', 'A house opened from the street into an atrium, its roof open over a basin that caught the rain; shops opened onto the street from its front rooms.'),
  recordClaim('taberna', 'The town had nearly a hundred counters selling hot food and drink.'),
  recordClaim('bakery', 'At least 31 bakeries worked in the town.'),
  recordClaim('aqueduct-supply', 'An aqueduct brought water to a tank at the Vesuvius gate, where it was split three ways into the town.'),
  recordClaim('election-notices', 'More than 2,600 election notices are known, painted in red or black on whitewashed walls, most from the town\'s last seventeen years.'),
  recordClaim('eruption', 'Vesuvius erupted late in 79; a charcoal note dated 17 October, found in a house under repair, favours the autumn.'),
];

const POMPEII_STOPS = [
  { id: 'town', title: 'A town on a spur of lava', camera: 'aerial', claims: ['walled-town', 'lava-spur', 'vesuvius-before'],
    caption: 'Pompeii in 79 CE: a walled town of some 65 hectares on a spur of old lava, about 40 m above the sea. Vesuvius rose about 8 km away, then one broad mountain green with vines.',
    captions: { child: 'This is Pompeii, a Roman town, almost two thousand years ago. It sits on a hill made of old, cooled lava.' } },
  { id: 'walls', title: 'Walls that no longer had to hold', camera: { frame: 'asset:pp-wall', from: 'threeQuarter' }, highlight: ['asset:pp-wall', 'asset:pp-tower', 'asset:pp-gate'], claims: ['walls-quadratum', 'walled-town'],
    caption: 'The walls ran about 3.2 km round and stood 2 to 3 m thick. By now Rome kept the peace, and they were more relic than defence; seven gates let the roads in.',
    captions: { child: 'Thick stone walls go all the way round the town. By this time there were no enemies nearby, so the gates stood open.' } },
  { id: 'forum', title: 'The forum', camera: { frame: ['monument:capitolium', 'asset:pp-portico'], from: 'threeQuarter' }, highlight: ['monument:capitolium', 'asset:pp-portico', 'asset:pp-arch', 'asset:pp-equestrian'], claims: ['forum-square', 'capitolium'],
    caption: 'The forum, about 143 by 38 m, was the town\'s centre. At its head the temple of Jupiter, wrecked by the earthquake of 62, was still waiting to be restored.',
    captions: { child: 'This big open square was where people met, shopped and voted. The temple at the end was broken in an earthquake and not yet mended.' } },
  { id: 'repairs', title: 'Seventeen years of repairs', camera: { frame: 'asset:pp-hall', from: 'threeQuarter' }, highlight: ['asset:pp-hall'], claims: ['basilica', 'post-quake-repairs', 'hot-mixing'],
    caption: 'The halls round the forum, the basilica among them, served business and the law. In 79 the town was still a building site, its builders mixing quicklime with volcanic ash.',
    captions: { child: 'Builders were still fixing the town after the earthquake. They made a strong cement by mixing lime with volcanic ash.' } },
  { id: 'theatre', title: 'The large theatre', camera: { frame: 'asset:pp-theatre', from: 'top' }, highlight: ['asset:pp-theatre'], claims: ['large-theatre'],
    caption: 'The large theatre seated about 5,000. Its stage had been rebuilt from the ground after the earthquake.',
    captions: { child: 'About five thousand people could sit here to watch a play.' } },
  { id: 'houses', title: 'Houses and shops', camera: { frame: ['asset:pp-house', 'asset:pp-shop-house'], from: 'top' }, highlight: ['asset:pp-house', 'asset:pp-shop-house'], claims: ['atrium-house', 'taberna', 'bakery'],
    caption: 'Houses turned inward to an atrium open to the sky. Their front rooms were shops on the street: nearly a hundred hot-food counters and at least 31 bakeries.',
    captions: { child: 'Families lived round a room with a hole in the roof to let the rain in. At the front were shops, cafés and bakeries.' } },
  { id: 'water', title: 'Water in every street', camera: { frame: 'asset:pp-fountain', from: 'top' }, highlight: ['asset:pp-fountain'], claims: ['aqueduct-supply'],
    caption: 'An aqueduct fed a tank at the Vesuvius gate, the town\'s highest point, which split the water three ways, out to the street fountains among others.',
    captions: { child: 'Water came from far away through a long channel and flowed to fountains on the street corners.' } },
  { id: 'notices', title: 'Painted words', camera: 'aerial', highlight: ['asset:pp-shop-house'], claims: ['election-notices'],
    caption: 'The walls spoke. More than 2,600 election notices survive, painted in red or black on whitewash, most from the town\'s last seventeen years.',
    captions: { child: 'People painted messages on the walls asking you to vote for their friend.' } },
  { id: 'after', title: 'Before the mountain woke', camera: 'approach', claims: ['eruption'],
    caption: 'This is the town just before the end. Late in 79 Vesuvius erupted and buried it; a charcoal note dated 17 October points to the autumn.',
    captions: { child: 'Soon after this, the volcano erupted and covered the town in ash. That is why we can still see it today.' } },
];

const POMPEII = Object.freeze({
  id: 'pompeii',
  title: 'Pompeii, 79 CE',
  says: 'A Roman town as it stood before the eruption: its walls, forum, theatre, houses and water, from the town\'s own record.',
  steps: [{ as: 'town', input: {
    id: 'history/pompeii', title: 'Pompeii, 79 CE',
    params: { parts: true, people: { year: 79 } },
    curation: {
      aims: ['A Roman town was a working place of shops, water, notices and repairs, not only temples.',
        'In 79 Pompeii was still being rebuilt after an earthquake when Vesuvius erupted.'],
      audiences: ['general', 'child'],
      claims: POMPEII_CLAIMS,
    },
    tour: { title: 'A walk through Pompeii, 79 CE', stops: POMPEII_STOPS },
  } }],
});

// ── hydro: the energy chain's own numbers, said as a visitor reads them ──
// a whole number with its thousands marked by commas, by hand: no Intl in a recipe's words
export const thousands = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const one = (n) => (Math.round(n * 10) / 10).toString();
const mw = (w) => one(w / 1e6);

/** The hydro wing at a head (the chain's default when none), its captions computed from the chain. */
export function hydroWing(head = undefined) {
  const c = planHydroChain(head === undefined ? {} : { head }), H = c.spec.head, Q = c.spec.flow;
  const at = (h) => planHydroChain({ head: h });
  const sim = 'simulated';
  const room = (as, scenario, title, aim, stops) => ({ as, input: { id: 'earth/hydro', title, params: { scenario }, curation: { aims: [aim] }, tour: { title, stops } } });
  const heads = [Math.round(H / 2), H, H * 2];
  return Object.freeze({
    id: 'hydro',
    title: 'Hydroelectric power: from water to wire',
    says: 'Five rooms follow water from a reservoir to the grid, every number computed from the same energy chain, and a room where the head is yours to change.',
    chain: c,
    steps: [
      room('dam', 'dam', 'The dam: water stored high', 'Water held high is energy stored: the deeper it is, the harder it pushes.', [
        { id: 'store', title: 'Height is stored energy', camera: '3/4', highlight: ['reservoir'], grade: sim,
          caption: `The reservoir holds water ${H} m above the turbines. That height, the head, is the energy the plant will spend.` },
        { id: 'pressure', title: 'Pressure grows with depth', camera: 'side', highlight: ['dam'], grade: sim, shape: 'quantity',
          caption: `Pressure on the dam's face grows with depth (P = ρgh): at its foot it is ${thousands(c.pressure.base / 1000)} kPa, about ${Math.round(c.pressure.base / 101325)} times the air's.` },
        { id: 'jet', title: 'The outlet\'s jet', camera: { frame: 'outlet', from: 'side' }, highlight: ['outlet'], grade: sim,
          caption: `Let out at the bottom, the water leaves at v = √(2gh): ${one(c.jet.v)} m/s, over ${Math.round(c.jet.v * 3.6)} km/h.` },
      ]),
      room('penstock', 'penstock', 'The penstock: falling water', 'Falling, the water trades its height for speed.', [
        { id: 'intake', title: 'The intake', camera: { frame: 'intake', from: 'threeQuarter' }, highlight: ['intake'], grade: sim,
          caption: `${Q} cubic metres of water a second enter the pipe at the intake.` },
        { id: 'fall', title: 'Height becomes speed', camera: 'side', highlight: ['penstock'], grade: sim, shape: 'process',
          caption: `Down the penstock, height turns into speed and pressure (Bernoulli). Friction takes ${Math.round((1 - c.eta.penstock) * 100)}%, leaving ${one(c.headEff)} m of the ${H} m to use.` },
        { id: 'nozzle', title: 'The nozzle', camera: { frame: 'nozzle', from: 'side' }, highlight: ['nozzle'], grade: sim,
          caption: `The nozzle trades the pressure for speed: a jet at ${one(c.jet.v)} m/s.` },
      ]),
      room('turbine', 'turbine', 'The turbine: a push becomes a spin', 'A jet pushing on buckets at a distance from an axle makes the runner turn.', [
        { id: 'buckets', title: 'Buckets turn the jet', camera: 'front', highlight: ['runner'], grade: sim, shape: 'structure',
          caption: `The jet strikes the runner's buckets and is turned back, pushing with ${mw(c.runner.jetForce)} MN.` },
        { id: 'torque', title: 'Push at a radius is a twist', camera: 'side', highlight: ['runner', 'nozzle'], grade: sim,
          caption: `That push ${one(c.runner.radius)} m from the axle is a torque of ${one(c.runner.torque / 1e6)} MN·m: the runner turns at ${Math.round(c.runner.rpm)} turns a minute.` },
      ]),
      room('generator', 'generator', 'The generator: a spin becomes current', 'Magnets moving past coils make a current, at the grid\'s own beat.', [
        { id: 'poles', title: 'Magnets sweep past coils', camera: 'front', highlight: ['rotor', 'stator'], grade: sim, shape: 'structure',
          caption: `The rotor carries ${c.generator.poles} magnet poles past the coils of the stator. A changing field through a coil drives a current (Faraday).` },
        { id: 'grid', title: 'In step with the grid', camera: 'side', highlight: ['rotor'], grade: sim,
          caption: `${c.generator.polePairs} pairs of poles at ${Math.round(c.runner.rpm)} turns a minute make ${one(c.generator.f)} Hz, in step with a ${c.spec.gridHz} Hz grid.` },
      ]),
      room('plant', 'plant', 'The plant: the whole chain', 'One chain of machines turns falling water into electricity, losing a little at each step.', [
        { id: 'whole', title: 'Water to wire', camera: 'aerial', highlight: ['reservoir', 'penstock', 'powerhouse', 'pylon'], grade: sim, shape: 'process',
          caption: `Reservoir, penstock, turbine, generator, wires: the falling water carries ${mw(c.power.hydraulic)} MW, and ${mw(c.power.elec)} MW reaches the line.` },
        { id: 'losses', title: 'Where the rest goes', camera: { frame: ['runner', 'rotor'], from: 'side' }, highlight: ['runner', 'rotor'], grade: sim, shape: 'quantity',
          caption: `Each stage loses a little: the pipe ${Math.round((1 - c.eta.penstock) * 100)}%, the turbine ${Math.round((1 - c.eta.turbine) * 100)}%, the generator ${Math.round((1 - c.eta.generator) * 100)}%. About ${Math.round((c.power.elec / c.power.hydraulic) * 100)}% of the water's power arrives as electricity.` },
        { id: 'homes', title: 'What it powers', camera: { frame: 'pylon', from: 'threeQuarter' }, highlight: ['pylon'], grade: 'explained',
          caption: `That is enough for roughly ${thousands(Math.round(c.homes / 100) * 100)} homes, each drawing about 1.2 kW on average.` },
      ]),
      { as: 'head', input: { id: 'earth/hydro', title: 'Try the head', params: { scenario: 'plant' }, states: { label: 'Head', of: heads.map((h) => ({
        label: `${h} m`, params: { head: h }, caption: `At ${h} m of head the same flow carries ${mw(at(h).power.elec)} MW to the line.` })) } } },
      { as: 'wing', input: {
        title: 'Hydroelectric power: from water to wire',
        rooms: ['@dam', '@penstock', '@turbine', '@generator', '@plant', '@head'],
        params: { intro: 'Follow water from a reservoir to the grid, then change the head yourself.', curation: {
          aims: ['Electricity from water is height spent: the higher the water, the more power the same flow carries.',
            'Each machine turns one kind of energy into the next, and each loses a little.'] } },
      } },
    ],
  });
}

export const EXHIBIT_STARTERS = Object.freeze({ pompeii: POMPEII, hydro: hydroWing() });

/**
 * Make a starter through a door (create_exhibit's handler, or any function taking its input): each step in order, a
 * gallery's '@<as>' rooms the refs made before it. Returns { [as]: the door's answer }.
 */
export async function makeStarter(name, door) {
  const S = EXHIBIT_STARTERS[name];
  if (!S) throw new Error(`starters: no starter '${name}' (one of ${Object.keys(EXHIBIT_STARTERS).join(', ')})`);
  const made = {};
  for (const { as, input } of S.steps) {
    const rooms = input.rooms?.map((r) => (typeof r === 'string' && r.startsWith('@') ? made[r.slice(1)]?.ref : r));
    made[as] = await door(rooms ? { ...input, rooms } : input);
  }
  return made;
}
