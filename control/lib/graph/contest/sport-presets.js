/**
 * THE SPORTS, NATIVE — each book sport's own presentations: what makes a tennis match read as Wimbledon, Roland Garros
 * or a night session, a football match as a league game, a derby or a final. A preset is a starting set of the arena's
 * own words (its venue, how its surface plays, its broadcast and the stats its coverage leans on, its register, its
 * rules' length): lowered under the words given, so any word over it moves that part and keeps the rest.
 *
 *   SPORT_PRESETS                 { <sport>: { <preset>: { reads, words } } }; `meet` for the athletics events
 *   presetWords(sport, name)      → the preset's arena words; throws, teaching, on a name the sport has not
 *   presetsOf(sport)              → the sport's preset names (none for a sport written out: it has no traditions yet)
 *
 * The words are the arenas' (contest/*-arena.js): venue (stadium/venue.js), surface (a court's: match-arena.js
 * COURT_SURFACES), broadcast (broadcast-package.js, `stats` its coverage's lean), register, sets, periods, seconds.
 * Pure data.
 */

const P = (reads, words) => Object.freeze({ reads, words: Object.freeze(words) });

export const SPORT_PRESETS = Object.freeze({
  tennis: Object.freeze({
    grass: P('a grass major: the lawn skids and keeps the ball low, the serve rules; whites in a green bowl, a summer day',
      { surface: 'grass', sets: 2, venue: { preset: 'centre-court', surface: 'grass', time: 'day' }, broadcast: { package: 'network', stats: { strap: ['aces', 'serve'], panel: ['points', 'aces', 'serve', 'firstIn', 'winners', 'errors'] } } }),
    clay: P('the clay: the ball grips and sits up, the rallies run long; a terracotta court in a stone amphitheatre, the late sun',
      { surface: 'clay', sets: 2, venue: { preset: 'colosseum', surface: 'clay', time: 'golden' }, broadcast: { package: 'network', stats: { strap: ['rally', 'winners'], panel: ['points', 'rally', 'winners', 'errors', 'firstIn', 'aces'] } } }),
    hard: P('a hard court under lights: a true bounce, a big-hitting night session, the stadium graphics',
      { surface: 'hard', venue: { preset: 'centre-court', surface: 'hard', time: 'night', livery: 'club', masts: 4 }, broadcast: { package: 'stadium', stats: { strap: ['serve', 'winners'] } } }),
    indoor: P('indoors: a fast hard court under a dome, no weather, no wind',
      { surface: 'hard', venue: { preset: 'patron-dome', surface: 'hard', time: 'dusk' }, broadcast: { package: 'stadium' } }),
    arcade: P('the cartoon court: the arcade register\'s growing rally, candy stands, the cartoon graphics',
      { register: 'action', surface: 'hard', venue: { preset: 'arcade', surface: 'hard' }, broadcast: { package: 'arcade' } }),
  }),
  soccer: Object.freeze({
    league: P('a league match: the home ground on a golden afternoon, the network\'s coverage',
      { venue: { preset: 'football', time: 'golden' }, broadcast: { package: 'network' } }),
    derby: P('a derby under the floodlights: a full house, the night, the big-screen graphics',
      { venue: { preset: 'football', time: 'night', masts: 4, bowl: { crowd: 1 } }, broadcast: { package: 'stadium', stats: { strap: ['shots', 'onTarget'], panel: ['possession', 'shots', 'onTarget', 'fouls', 'corners', 'saves'] } } }),
    final: P('a cup final: the national stadium at dusk, two full halves, the gold of the network\'s accent',
      { periods: 2, venue: { preset: 'olympic', time: 'dusk', bowl: { crowd: 1 } }, broadcast: { package: 'network', accent: 'gold' } }),
    'five-a-side': P('five-a-side: the town ground, short halves, the cartoon graphics',
      { periods: 2, seconds: 150, venue: { preset: 'municipal' }, broadcast: { package: 'arcade' } }),
  }),
  hockey: Object.freeze({
    arena: P('an arena game: the rink under a dome after dark, the big-screen graphics',
      { venue: { preset: 'patron-dome', surface: 'ice', time: 'night' }, broadcast: { package: 'stadium', stats: { panel: ['shots', 'onTarget', 'saves', 'possession', 'fouls'] } } }),
    pond: P('pond hockey: an open rink at the town ground at dusk, the plain graphics',
      { venue: { preset: 'municipal', surface: 'ice', time: 'dusk' }, broadcast: { package: 'clean' } }),
  }),
  golf: Object.freeze({
    tour: P('a tour event: the network\'s coverage, the card and the putts',
      { broadcast: { package: 'network', stats: { panel: ['toPar', 'putts', 'greens', 'fairways', 'penalties'], strap: ['putts'] } } }),
    arcade: P('arcade golf: the cartoon register\'s floaty ball, the cartoon graphics',
      { register: 'platformer', broadcast: { package: 'arcade' } }),
  }),
  bowling: Object.freeze({
    'league-night': P('league night: the big-screen graphics, every strike called',
      { broadcast: { package: 'stadium', stats: { strap: ['strikes', 'spares'], panel: ['pinfall', 'strikes', 'spares', 'opens'] } } }),
    'tv-final': P('a televised final: the network\'s coverage, the ball\'s speed on the panel',
      { broadcast: { package: 'network', stats: { panel: ['pinfall', 'strikes', 'spares', 'opens', 'speed'] } } }),
  }),
  meet: Object.freeze({
    'olympic-final': P('an Olympic final: the national stadium under lights, the network\'s coverage',
      { venue: { preset: 'olympic', time: 'night' }, broadcast: { package: 'network' } }),
    indoor: P('an indoor meeting: the dome, the big-screen graphics',
      { venue: { preset: 'patron-dome', surface: 'track' }, broadcast: { package: 'stadium' } }),
    'school-sports': P('school sports day: the town ground in the morning sun, the cartoon graphics',
      { venue: { preset: 'municipal', time: 'day' }, broadcast: { package: 'arcade' } }),
  }),
});

/** A sport's preset names. */
export const presetsOf = (sport) => Object.keys(SPORT_PRESETS[sport] ?? {});

/** The preset's arena words; throws, teaching. */
export function presetWords(sport, name) {
  const book = SPORT_PRESETS[sport];
  if (!book) throw new Error(`sport presets: '${sport}' has no presets (a sport written out has none yet; the book's: ${Object.keys(SPORT_PRESETS).join(', ')})`);
  const p = book[name];
  if (!p) throw new Error(`sport presets: ${sport} has no preset '${name}' (${presetsOf(sport).join(', ')})`);
  return p.words;
}
