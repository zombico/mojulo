/**
 * THE VEHICLE SHEET'S FACETS: one vehicle as its pole, class, silhouette, stance, cockpit, engine, era, motif, drive,
 * wear, livery and exaggeration. Each value reads as a line and writes NOTES (channel → lines) and DERIVES (channel →
 * dials, channels.js). Everything is a first reading, to be calibrated at the eyes gate, as the Egocube's are.
 *
 * The two poles read the same facets differently:
 *   realistic  the class decides the shape (CLASS_TRAITS: its silhouette, stance, cockpit, engine, motif and drive are
 *              given, not rolled); the roll chooses only what an owner would (era, wear, livery). Exaggeration is 0.
 *   racer      a character's machine at kart scale: every facet rolls (or, at V3, is read off the driver's Egocube);
 *              exaggeration is a dial in [0.4, 1].
 */

const v = (reads, notes, derives) => Object.freeze({ reads, notes, derives });

export const POLES = Object.freeze({
  realistic: v('realistic: true to its class, its numbers the world\'s', { frame: 'the class\'s own length, width and height, held' }, {}),
  racer: v('a racer\'s machine: built round who drives it', { frame: 'kart scale, sized to its driver', stance: 'the wheels big for the body' }, { stance: ['proportion.wheelScale +'], frame: ['bodyplan = car'] }),
});

/** The classes a sheet can name (roads/vehicles.js), with what a realistic sheet takes from each: its shape, stance,
 *  cockpit, engine, motif and drive, and the vehicle designer's chassis and body (or the tech body plan) that read as it. */
export const CLASS_TRAITS = Object.freeze({
  kart:          { silhouette: 'tub', stance: 'low', cockpit: 'open', engine: 'exposed', motif: 'smooth', drive: 'rear', derives: { frame: ['bodyplan = car'] } },
  compact:       { silhouette: 'bubble', stance: 'level', cockpit: 'closed', engine: 'hidden', motif: 'smooth', drive: 'front', derives: { frame: ['chassis = unibodyPan', 'body = wagonTwo'] } },
  midsize:       { silhouette: 'wedge', stance: 'level', cockpit: 'closed', engine: 'hidden', motif: 'smooth', drive: 'front', derives: { frame: ['chassis = unibodyPan', 'body = sedanThree'] } },
  crossover:     { silhouette: 'barrel', stance: 'raised', cockpit: 'closed', engine: 'hidden', motif: 'smooth', drive: 'all', derives: { frame: ['chassis = unibodyPan', 'body = crossoverTwo'] } },
  pickup:        { silhouette: 'brick', stance: 'raised', cockpit: 'closed', engine: 'hidden', motif: 'faceted', drive: 'rear', derives: { frame: ['chassis = ladderFrame', 'body = truckCab'] } },
  van:           { silhouette: 'brick', stance: 'level', cockpit: 'closed', engine: 'hidden', motif: 'smooth', drive: 'rear', derives: { frame: ['chassis = ladderFrame', 'body = vanOne'] } },
  sports:        { silhouette: 'wedge', stance: 'low', cockpit: 'closed', engine: 'hidden', motif: 'smooth', drive: 'rear', derives: { frame: ['chassis = sportPan', 'body = coupeThree'] } },
  rally:         { silhouette: 'wedge', stance: 'level', cockpit: 'closed', engine: 'hidden', motif: 'faceted', drive: 'all', derives: { frame: ['chassis = sportPan', 'body = coupeThree'] } },
  buggy:         { silhouette: 'tub', stance: 'raised', cockpit: 'open', engine: 'exposed', motif: 'riveted', drive: 'all', derives: { frame: ['bodyplan = car'] } },
  trophyTruck:   { silhouette: 'barrel', stance: 'raised', cockpit: 'closed', engine: 'hidden', motif: 'faceted', drive: 'rear', derives: { frame: ['chassis = ladderFrame', 'body = truckCab'] } },
  atv:           { silhouette: 'tub', stance: 'raised', cockpit: 'open', engine: 'exposed', motif: 'faceted', drive: 'rear', derives: { frame: ['bodyplan = car'] } },
  straightTruck: { silhouette: 'brick', stance: 'raised', cockpit: 'closed', engine: 'hidden', motif: 'riveted', drive: 'rear', derives: { frame: ['bodyplan = truck'] } },
  bus:           { silhouette: 'brick', stance: 'level', cockpit: 'closed', engine: 'hidden', motif: 'smooth', drive: 'rear', derives: { frame: ['bodyplan = bus'] } },
  tractorTrailer: { silhouette: 'brick', stance: 'raised', cockpit: 'closed', engine: 'hidden', motif: 'riveted', drive: 'rear', derives: { frame: ['bodyplan = truck'] } },
  tractorTrailerLoaded: { silhouette: 'brick', stance: 'raised', cockpit: 'closed', engine: 'hidden', motif: 'riveted', drive: 'rear', derives: { frame: ['bodyplan = truck'] } },
});
export const CLASS_IDS = Object.freeze(Object.keys(CLASS_TRAITS));
/** The heavy classes: a cab, never an open seat. */
export const HEAVY = Object.freeze(['straightTruck', 'bus', 'tractorTrailer', 'tractorTrailerLoaded']);

export const SILHOUETTES = Object.freeze({
  wedge:  v('a wedge: low at the nose, rising to the tail', { silhouette: 'the nose at the road, the line climbing back' }, { silhouette: ['proportion.height -', 'proportion.bonnet +'], handling: ['physics.CdA -'], frame: ['body = coupeThree'] }),
  bubble: v('a bubble: every surface rounded', { silhouette: 'no corner anywhere; the cabin a dome' }, { silhouette: ['proportion.cabinScale +'], surface: ['motif = smooth'], frame: ['body = fastbackEV'] }),
  brick:  v('a brick: square to the wind', { silhouette: 'upright faces, flat roof, corners kept' }, { silhouette: ['proportion.height +'], handling: ['physics.CdA +'], frame: ['body = vanOne'] }),
  needle: v('a needle: long and narrow', { silhouette: 'a long nose, a narrow track, everything pointing forward' }, { silhouette: ['proportion.length +', 'proportion.width -'], handling: ['physics.CdA -'], frame: ['body = sleekEV'] }),
  barrel: v('a barrel: round in the middle', { silhouette: 'the mass at the waist, the ends drawn in' }, { silhouette: ['proportion.width +'], frame: ['physics.mass +', 'body = crossoverTwo'] }),
  tub:    v('a tub: low and open, the sides up to the shoulders', { silhouette: 'a bathtub on wheels; the driver its top line' }, { silhouette: ['proportion.height -', 'proportion.cabinScale -'], cockpit: ['cabin = bucketsTwo'] }),
  bell:   v('a bell: tall and upright, flaring to the wheels', { silhouette: 'a tall cabin over a wide-set stance' }, { silhouette: ['proportion.height +', 'proportion.track +'], frame: ['body = sedanThree'] }),
});

export const STANCES = Object.freeze({
  low:    v('low: slammed to the road', { stance: 'the sills a hand off the road; the arches over the tyres' }, { stance: ['proportion.rideHeight -'], handling: ['physics.cgH -'], frame: ['chassis = sportPan'] }),
  level:  v('level: an ordinary ride height', { stance: 'nothing in the stance asks to be looked at' }, {}),
  raised: v('raised: lifted off the road', { stance: 'daylight under it; big tyres in open arches' }, { stance: ['proportion.rideHeight +', 'proportion.wheelScale +'], handling: ['physics.cgH +'], frame: ['chassis = ladderFrame'] }),
});

export const COCKPITS = Object.freeze({
  open:   v('open: the driver in the air', { cockpit: 'the driver seen to the shoulders, nothing over the head' }, { cockpit: ['cabin = bucketsTwo'], silhouette: ['proportion.cabinScale -'] }),
  closed: v('closed: the driver behind glass', { cockpit: 'a roof and glass all round' }, { cockpit: ['cabin = benchFront'] }),
  canopy: v('a canopy: a bubble of glass over the seat', { cockpit: 'the driver under a dome, seen through it' }, { cockpit: ['cabin = bucketsTwo'], ornament: ['adorn = visor'] }),
});

export const ENGINES = Object.freeze({
  hidden:    v('the engine hidden', { engine: 'under a smooth bonnet; its power read in the stance' }, { engine: ['engine = inlineFour'] }),
  exposed:   v('the engine exposed', { engine: 'the block in the open air, its stacks standing' }, { engine: ['engine = vintageStacks'], ornament: ['adorn = pipes'] }),
  oversized: v('the engine oversized', { engine: 'more engine than car: it pushes through the bonnet' }, { engine: ['engine = veeEight'], handling: ['physics.power +', 'physics.mass +'], silhouette: ['proportion.bonnet +'], ornament: ['adorn = pipes'] }),
});

export const ERAS = Object.freeze({
  vintage: v('vintage: before the war', { surface: 'running boards, separate wings', ornament: 'round lamps on stalks' }, { stance: ['wheel = wireVintage'], ornament: ['lights = roundDuo'], handling: ['physics.CdA +'] }),
  classic: v('classic: chrome and fins', { surface: 'chrome bumpers, a waistline', ornament: 'a whitewall, round lamps' }, { stance: ['wheel = steelie'], ornament: ['lights = roundDuo'] }),
  modern:  v('modern: the road today', { surface: 'flush glass, body-colour bumpers' }, { stance: ['wheel = fiveSpokeAlloy'], ornament: ['lights = rectDuo'] }),
  future:  v('future: sculpted and lit', { surface: 'one sculpted shell; a light bar for a face' }, { stance: ['wheel = fiveSpokeAlloy'], ornament: ['lights = barSingle'], frame: ['body = sleekEV'], handling: ['physics.CdA -'] }),
});

export const MOTIF_READS = Object.freeze({
  smooth:  v('smooth: rounded shells, clean seams', { surface: 'edges eased, panels flush' }, { surface: ['motif = smooth'], ornament: ['adorn = fins'] }),
  faceted: v('faceted: planes cut at hard angles', { surface: 'chamfered edges, flat panels meeting at creases' }, { surface: ['motif = faceted'], ornament: ['adorn = plate'] }),
  riveted: v('riveted: plates bolted on a frame', { surface: 'strapped and banded; rivet lines on every seam' }, { surface: ['motif = riveted'], ornament: ['adorn = rivets'] }),
  spiked:  v('spiked: points along every edge', { surface: 'studs and spikes on the arches and the nose' }, { surface: ['motif = spiked'], ornament: ['adorn = spikes'] }),
  organic: v('organic: grown, not built', { surface: 'swelling forms, ribs and sockets' }, { surface: ['motif = organic'], ornament: ['adorn = vents'] }),
  ornate:  v('ornate: made to be looked at', { surface: 'scrollwork, trim lines, a crest' }, { surface: ['motif = ornate'], ornament: ['adorn = bands'] }),
});

export const DRIVES = Object.freeze({
  front: v('front-driven', { handling: 'pulled from the front: steady, it pushes wide when hurried' }, { handling: ['drive = front'] }),
  rear:  v('rear-driven', { handling: 'pushed from the back: the launch loads the driven wheels' }, { handling: ['drive = rear'] }),
  all:   v('all-wheel driven', { handling: 'every wheel pulling: off the line, and off the road' }, { handling: ['drive = all', 'physics.share +'] }),
});

export const WEARS = Object.freeze({
  pristine: v('pristine: kept, polished', { wear: 'not a mark on it; the paint deep' }, { livery: ['livery.primary +'] }),
  used:     v('used: driven, cared for', { wear: 'dust in the arches, a stone chip on the nose' }, {}),
  battered: v('battered: run hard, patched', { wear: 'dents, a patched panel, one lamp out' }, { livery: ['livery.primary -'], ornament: ['adorn = panel'] }),
});

export const LIVERIES = Object.freeze({
  mono:       v('one colour', { livery: 'one colour; the trim its only break' }, { livery: ['livery.secondary -'] }),
  'two-tone': v('two-tone', { livery: 'a second colour on the roof or below the waist' }, { livery: ['livery.secondary +'] }),
  striped:    v('striped', { livery: 'stripes down the centre line' }, { livery: ['livery.accent +'], ornament: ['adorn = bands'] }),
  numbered:   v('numbered', { livery: 'a race number on the doors and the nose' }, { ornament: ['adorn = livery'] }),
});

/** The facets in sheet order, each with its values (exaggeration a number 0 … 1). */
export const FACET_TABLES = Object.freeze({
  pole: POLES, class: CLASS_TRAITS, silhouette: SILHOUETTES, stance: STANCES, cockpit: COCKPITS, engine: ENGINES,
  era: ERAS, motif: MOTIF_READS, drive: DRIVES, wear: WEARS, livery: LIVERIES,
});
export const FACETS = Object.freeze({
  pole: { asks: 'true to the world, or a racer\'s own machine?' },
  class: { asks: 'what kind of vehicle, by its numbers?' },
  silhouette: { asks: 'what shape at 64 px?' },
  stance: { asks: 'how does it sit on the road?' },
  cockpit: { asks: 'how much of the driver shows?' },
  engine: { asks: 'is its power seen?' },
  era: { asks: 'when was it built?' },
  motif: { asks: 'what is its body made in?' },
  drive: { asks: 'which wheels push?' },
  wear: { asks: 'what has the road done to it?' },
  livery: { asks: 'how is it painted?' },
  exaggeration: { asks: 'how far from true proportion? 0 true … 1 a cartoon' },
});
