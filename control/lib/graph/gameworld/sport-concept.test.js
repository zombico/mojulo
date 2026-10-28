// The sport concept: the player's idea read into the quick words around a sport's rules, under the creator's own. One
// case per kind of word (the sides about a "vs", colours, an animal, the venue's light and house, the drawing, the
// register, the broadcast), the rule words never read, and a concept's absence adding nothing.
import { describe, it, expect } from 'vitest';
import { readSportConcept, sportTeams, SPORT_COLOURS, CONCEPT_LEXICON } from './sport-concept.js';
import { readQuick, quickWorld, sportWords, sportConceptOf, sportArenas } from './quick.js';
import { runSteps } from './runner.js';

describe('reading a concept', () => {
  it('a "vs" names the sides, a colour word is a side\'s shirt, an animal makes its side that animal\'s mascots', () => {
    const R = readSportConcept('red robots vs the cats');
    expect(R.words.teams).toEqual([{ name: 'Robots', colour: SPORT_COLOURS.red }, { name: 'Cats', mascot: 'cat' }]);
    expect(R.read[0].decides).toEqual([`side a: Robots, ${SPORT_COLOURS.red}`, 'side b: Cats, cat mascots']);
    // colours outside a "vs" are the sides' in order; an animal outside one is every side's
    expect(readSportConcept('pink and black').words.teams).toEqual([{ colour: SPORT_COLOURS.pink }, { colour: SPORT_COLOURS.black }]);
    expect(readSportConcept('penguins on ice').words.teams).toEqual([{ mascot: 'penguin' }, { mascot: 'penguin' }]);
  });
  it('the venue\'s words nest into a venue, the drawing is a tradition, the register and the broadcast are theirs; a later word wins', () => {
    const R = readSportConcept('anime, under a neon dome, televised');
    expect(R.words.venue).toEqual({ look: 'anime', time: 'night', livery: 'night', bowl: { roof: 'dome' } });
    expect(R.tradition).toBe('anime');
    expect(R.words.broadcast).toEqual({ package: 'network' });
    expect(readSportConcept('wild').words.register).toBe('pinball');
    expect(readSportConcept('night day').words.venue.time).toBe('day');
  });
  it('the rules are the card\'s: a number or a rule word is never read and is said back; a word nothing reads is unread', () => {
    const R = readSportConcept('first to 21 points, chaotic zorbing');
    expect(R.rules).toEqual(['first', '21', 'points']);
    expect(R.unread).toEqual(['zorbing']);
    expect(R.words).toEqual({ register: 'pinball' });
  });
  it('refuses what is not a few words, teaching; every lexicon reading is a quick word or the tradition', () => {
    expect(() => readSportConcept('')).toThrow(/the player's idea in a few words/);
    expect(() => readSportConcept('x'.repeat(241))).toThrow(/up to 240 characters/);
    const keys = new Set(Object.values(CONCEPT_LEXICON).flatMap((r) => Object.keys(r)));
    for (const k of keys) expect(k === 'tradition' || ['venue', 'register', 'athletes', 'broadcast'].includes(k.split('.')[0]), k).toBe(true);
  });
});

describe('the teams', () => {
  it('two sides, each a name, a colour (a word or a hex) and a mascot brief; refused teaching', () => {
    expect(sportTeams({ teams: [{ name: 'Owls', colour: 'gold' }, { colour: '#112233', mascot: 'a grumpy bear' }] })).toEqual([{ name: 'Owls', colour: SPORT_COLOURS.gold }, { colour: '#112233', mascot: 'a grumpy bear' }]);
    expect(() => sportTeams({ teams: [{}] })).toThrow(/the two sides' own words/);
    expect(() => sportTeams({ teams: [{ colour: 'mauve' }, {}] })).toThrow(/a #rrggbb or a colour word/);
    expect(() => sportTeams({ teams: [{ badge: 1 }, {}] })).toThrow(/has no 'badge'/);
    expect(() => readQuick({ goal: 'contest', sport: 'golf', teams: [{}, {}] })).toThrow(/two-sided contest/);
    expect(() => readQuick({ goal: 'meet', event: 'sprint', teams: [{}, {}] })).toThrow(/a meet takes/);
    expect(() => readQuick({ goal: 'reach', concept: 'night' })).toThrow(/concept belongs to the meet and contest goals/);
  });
});

describe('the concept under the creator\'s words', () => {
  it('fills only what the creator left: their venue word over the concept\'s, their register, their side\'s name', () => {
    const W = sportWords({ goal: 'contest', sport: 'tennis', concept: 'cats vs dogs at night, wild', register: 'action', venue: { time: 'dusk' }, teams: [{ name: 'Tom' }, {}] });
    expect(W.register).toBe('action');
    expect(W.venue).toEqual({ time: 'dusk', preset: 'centre-court' });   // the sport's own house kept under the light
    expect(W.teams).toEqual([{ name: 'Tom', mascot: 'cat' }, { name: 'Dogs', mascot: 'dog' }]);
    expect(sportWords({ goal: 'contest', sport: 'tennis', concept: 'night', venue: false }).venue).toBe(false);
  });
  it('a course keeps its stage and its seats: the readout says what it left', () => {
    const Q = { goal: 'contest', sport: 'golf', concept: 'neon night, cats vs dogs' };
    expect(sportWords(Q).venue).toBeUndefined(); expect(sportWords(Q).teams).toBeUndefined();
    expect(sportConceptOf(Q).left).toEqual(['the venue\'s words: a course keeps its stage', 'the sides: a turn sport\'s seats are its players']);
  });
  it('the arena carries it: the teams\' names and colours on the broadcast, the venue\'s light; absent, the same arena as before', () => {
    const [court] = sportArenas({ goal: 'contest', sport: 'pingpong', concept: 'red vs blue sharks at dusk' });
    expect(court.manifest).toMatchObject({ kind: 'stadium', preset: 'centre-court', time: 'dusk' });
    expect(court.manifest.court.broadcast).toEqual({ sides: [SPORT_COLOURS.red, SPORT_COLOURS.blue] });
    const bare = { goal: 'contest', sport: 'pingpong' };
    expect(sportArenas(bare)).toEqual(sportArenas({ ...bare }));
    expect(JSON.stringify(sportArenas(bare))).not.toMatch(/concept|teams/);
  });
});

describe('the run: the cast, the arena and one style', () => {
  const run = (quick) => runSteps(quickWorld({ id: 'c', quick: { goal: 'contest', ...quick } }), { ref: 'gw' });
  it('a side named for an animal is rolled as its mascots, in its colour; the other side as people', () => {
    const st = run({ sport: 'volleyball', concept: 'blue sharks vs red' });
    const athletes = st.filter((s) => s.key.startsWith('athlete'));
    expect(athletes.filter((s) => s.order.mascot).map((s) => s.order.mascot.brief)).toEqual(['shark', 'shark']);
    expect(athletes.filter((s) => !s.order.mascot).every((s) => s.order.spec.kit.colours[0] === SPORT_COLOURS.red)).toBe(true);
  });
  it('the game\'s laws: a character in every slot, the arena in its stadium, one palette and one drawing; the shell themed from the sides', () => {
    const st = run({ sport: 'tennis', concept: 'anime, night' }), game = st.at(-1);
    const law = (c) => game.laws.find((l) => l.concern === c && l.law !== 'setting');
    expect(law('cast')).toMatchObject({ law: 'characters', holds: true }); expect(law('cast').says).toMatch(/2 slots played by 2 characters/);
    expect(law('arena')).toMatchObject({ law: 'venue', holds: true }); expect(law('arena').says).toMatch(/centre-court stadium at night/);
    expect(law('style')).toMatchObject({ law: 'one-look', holds: true }); expect(law('style').says).toMatch(/a low key, night.*drawn anime/);
    expect(game.order.theme).toMatchObject({ accent: expect.stringMatching(/^#/), bg: expect.stringMatching(/^#/) });
    const sticks = run({ sport: 'tennis', athletes: false }).at(-1).laws.find((l) => l.law === 'characters');
    expect(sticks.holds).toBe(false); expect(sticks.says).toMatch(/stick figures/);
    // a western cast in an anime stadium is two games: the style law says so
    const clash = run({ sport: 'tennis', concept: 'western', venue: { look: 'anime' } }).at(-1).laws.find((l) => l.concern === 'style');
    expect(clash.holds).toBe(false);
  });
  it('the same concept runs the same steps', () => {
    expect(run({ sport: 'basketball', concept: 'cats vs dogs at night' })).toEqual(run({ sport: 'basketball', concept: 'cats vs dogs at night' }));
  });
});
