/**
 * THE VEHICLE SHEET'S LEXICON: the words people use for vehicles, each a partial sheet. A brief is read longest phrase
 * first; a later word wins a facet an earlier one set. Words not here come back unread. What no word decides, the
 * class (realistic) or the seed does (sheet.js). A kind word is a reading, not a rule: a `muscle car` is a rear-driven
 * sports class with an oversized engine, because that is what people mean by it; an explicit facet overrides it.
 */

export const LEXICON = Object.freeze({
  // the pole
  'realistic':     { pole: 'realistic' },
  'real':          { pole: 'realistic' },
  'true to life':  { pole: 'realistic' },
  'cartoon':       { pole: 'racer' },
  'racer':         { pole: 'racer' },
  'toy':           { pole: 'racer' },
  // kinds of vehicle
  'kart':          { class: 'kart' },
  'go-kart':       { class: 'kart' },
  'compact':       { class: 'compact' },
  'hatchback':     { class: 'compact' },
  'sedan':         { class: 'midsize' },
  'saloon':        { class: 'midsize' },
  'suv':           { class: 'crossover' },
  'crossover':     { class: 'crossover' },
  'pickup':        { class: 'pickup' },
  'pickup truck':  { class: 'pickup' },
  'van':           { class: 'van' },
  'sports car':    { class: 'sports' },
  'supercar':      { class: 'sports', silhouette: 'wedge', stance: 'low', era: 'future' },
  'muscle car':    { class: 'sports', engine: 'oversized', era: 'classic', drive: 'rear' },
  'hot rod':       { class: 'sports', engine: 'exposed', era: 'vintage', silhouette: 'tub', stance: 'low' },
  'rally car':     { class: 'rally' },
  'buggy':         { class: 'buggy' },
  'dune buggy':    { class: 'buggy' },
  'trophy truck':  { class: 'trophyTruck' },
  'quad':          { class: 'atv' },
  'atv':           { class: 'atv' },
  'box truck':     { class: 'straightTruck' },
  'bus':           { class: 'bus' },
  'semi':          { class: 'tractorTrailer' },
  'big rig':       { class: 'tractorTrailer' },
  'tractor-trailer': { class: 'tractorTrailer' },
  // shape and stance
  'sleek':         { silhouette: 'needle' },
  'boxy':          { silhouette: 'brick' },
  'chunky':        { silhouette: 'barrel' },
  'bubbly':        { silhouette: 'bubble' },
  'round':         { silhouette: 'bubble' },
  'wedge':         { silhouette: 'wedge' },
  'lifted':        { stance: 'raised' },
  'lowered':       { stance: 'low' },
  'slammed':       { stance: 'low' },
  // cockpit and engine
  'open-top':      { cockpit: 'open' },
  'convertible':   { cockpit: 'open' },
  'bubble-top':    { cockpit: 'canopy' },
  'canopy':        { cockpit: 'canopy' },
  'big engine':    { engine: 'oversized' },
  'blown':         { engine: 'oversized' },
  // era, motif, wear, livery
  'vintage':       { era: 'vintage' },
  'retro':         { era: 'classic' },
  'classic':       { era: 'classic' },
  'modern':        { era: 'modern' },
  'futuristic':    { era: 'future', motif: 'smooth' },
  'spiky':         { motif: 'spiked' },
  'armoured':      { motif: 'riveted' },
  'armored':       { motif: 'riveted' },
  'industrial':    { motif: 'riveted' },
  'angular':       { motif: 'faceted' },
  'ornate':        { motif: 'ornate' },
  'organic':       { motif: 'organic' },
  'shiny':         { wear: 'pristine' },
  'showroom':      { wear: 'pristine' },
  'rusty':         { wear: 'battered' },
  'beat-up':       { wear: 'battered' },
  'racing stripes': { livery: 'striped' },
  'two-tone':      { livery: 'two-tone' },
  'all-wheel drive': { drive: 'all' },
  'awd':           { drive: 'all' },
  '4x4':           { drive: 'all' },
});

const PHRASES = Object.keys(LEXICON).sort((a, b) => b.length - a.length || (a < b ? -1 : 1));

/** A brief → { facets, unread: [words] }: phrases longest first, a later word winning a facet an earlier one set. */
export function readBrief(brief = '') {
  if (typeof brief !== 'string') throw new Error('car-designer: a brief is a string of words');
  let text = ` ${brief.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim()} `;
  const hits = [];
  for (const p of PHRASES) {
    let i = text.indexOf(` ${p} `);
    while (i >= 0) { hits.push({ at: i, p }); text = `${text.slice(0, i + 1)}${'#'.repeat(p.length)}${text.slice(i + 1 + p.length)}`; i = text.indexOf(` ${p} `); }
  }
  hits.sort((a, b) => a.at - b.at);
  const facets = {};
  for (const h of hits) Object.assign(facets, LEXICON[h.p]);
  const unread = text.split(' ').filter((w) => w && !/^#+$/.test(w));
  return { facets, unread };
}
