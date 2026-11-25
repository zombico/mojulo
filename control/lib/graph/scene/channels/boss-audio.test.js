// A boss fight on the director heard, and a metroidvania's held gates: every pattern the director lays has its wind-up
// and its strike on the shelf; a boss is heard by its voice, read from what it is; a level's rows carry only the patterns,
// voices and gate kinds it has, and none where it has no boss and no gates; the page's blocks are emitted only for a level
// that has them, and parse. A game's own words over the kit's; its menus and its flavor its own.
import { describe, expect, it } from 'vitest';
import { bossAudio, bossAudioScript } from './boss-audio.js';
import { BOSS_PATTERN_SOUNDS, BOSS_PATTERN_IDS, BOSS_ROWS, GATE_SOUNDS, bossVoice, bossSounds } from '../../sfx-shelf/boss-sounds.js';
import { PATTERNS } from '../../boss/patterns.js';
import { SOUNDS, resolveSoundId } from '../../sfx-shelf/roster.js';
import { ANIMAL_CLASSES } from '../../sfx-shelf/animal-voices.js';
import { PEOPLE_VOICE, animalSounds } from '../../sfx-shelf/animal-sounds.js';
import { CASTLE_BOSSES } from '../../gameworld/metroidvania/bosses.js';
import { resolveWorldAudio } from '../../beats/beats-world.js';
import { audioChannelScript } from './audio.js';
import { soundSheet, readSound } from '../../gameworld/sound-sheet.js';
import { menuSoundSet } from '../../playscape/ui/interface-look.js';
import { vampireSonataGame } from '../../gameworld/metroidvania/vampire-sonata.js';

// a boss of two patterns chosen in code, and a level of held gates of two kinds
const [P1, P2] = Object.keys(PATTERNS);
const boss = (voice) => ({ id: 'boss-1', transform: { pos: [0, 0, 0] }, rule: { boss: { voice, moves: { a: { pattern: P1 }, b: { pattern: P2 } } } } });
// (a secret wall a breakable no gate holds)
const gated = { entities: [], breakables: [{ id: 'g2' }, { id: 'hidden' }], heldGates: { gates: [{ id: 'g2', kind: 'key' }] } };

describe('a boss fight by its patterns', () => {
  it('every pattern the director lays has a wind-up and a strike, every word a row of the shelf', () => {
    expect(Object.keys(PATTERNS).filter((p) => !BOSS_PATTERN_IDS.includes(p))).toEqual([]);
    const words = [...Object.values(BOSS_PATTERN_SOUNDS).flatMap((S) => [S.tell, S.strike]), ...Object.values(GATE_SOUNDS)];
    expect(words.filter((w) => !resolveSoundId(w))).toEqual([]);
    expect(BOSS_ROWS.every((r) => SOUNDS[r.id]?.recorded === true)).toBe(true);
  });

  it('a boss is heard by what it is: its own voice, its people\'s, its species\', a winged second form a dragon\'s', () => {
    const people = Object.keys(PEOPLE_VOICE)[0];
    expect(bossVoice({ skin: { people } })).toBe(PEOPLE_VOICE[people]);
    expect(bossVoice({ skin: { species: 'wolf' } })).toBe('canine');
    expect(bossVoice({ skin: { people }, voice: 'corvid' })).toBe('corvid');
    expect(bossVoice({ second: true })).toBe('dragon');
    // (a class named by its own id is that class: a people's voice is looked up by it)
    for (const v of Object.values(PEOPLE_VOICE)) expect(animalSounds(v)?.voice).toBe(v);
    // (every castle boss heard by a class the shelf has)
    expect(Object.entries(CASTLE_BOSSES).filter(([, R]) => !ANIMAL_CLASSES[bossVoice(R)]).map(([id]) => id)).toEqual([]);
  });

  it('a game\'s own words over the kit\'s, false silencing a gate\'s', () => {
    const K = bossSounds({ patterns: { [P1]: { strike: 'explosion' } }, gates: { secret: false } });
    expect(K.patterns[P1].strike).toBe('explosion');
    expect(K.patterns[P1].tell).toBe(BOSS_PATTERN_SOUNDS[P1].tell);
    expect(K.gates.secret).toBeUndefined();
  });
});

describe('the level\'s rows and the page', () => {
  it('a level carries only the patterns, voices and gate kinds it has; none with no boss and no gates', () => {
    expect(bossAudio({ entities: [{ id: 'x', rule: {} }] })).toBeNull();
    const A = bossAudio({ entities: [boss('canine')] });
    expect(Object.keys(A.director.moves).sort()).toEqual([P1, P2].filter((p) => BOSS_PATTERN_SOUNDS[p]).sort());
    // (its voice where the library records its class: a voice class has no stand-in, so without it the boss is not heard
    // as anything else)
    expect(Object.keys(A.director.voices).every((v) => v === 'canine')).toBe(true);
    expect(A.gates).toBeUndefined();
    const Gt = bossAudio(gated).gates;
    expect(Object.keys(Gt.breaks).sort()).toEqual(['key', 'secret']);
    expect(Gt.secrets).toEqual(['hidden']);
    expect(Gt.shut && Gt.open).toBeTruthy();
  });

  it('the rows resolve, the blocks parse, and a level without them emits not a byte of them', () => {
    const R = resolveWorldAudio({ ...bossAudio({ ...gated, entities: [boss('undead')] }), sfx: { cues: {} } }, { time: 12, ref: 't' });
    expect(R.director && R.gates).toBeTruthy();
    const js = audioChannelScript(R);
    expect(js).toContain('A BOSS FIGHT HEARD');
    expect(js).toContain('THE HELD GATES HEARD');
    expect(() => new Function(js)).not.toThrow();
    const { director: _d, gates: _g, ...rest } = R;
    expect(audioChannelScript(rest)).not.toContain('boss-audio.js');
    expect(bossAudioScript()).toBe('');
  });
});

describe('a game\'s own sound', () => {
  it('a game\'s flavor and menus are its own, over its rail\'s', () => {
    expect(() => readSound({ flavor: 'Not A Name' })).toThrow(/flavor/);
    expect(() => readSound({ menus: 'nowhere' })).toThrow(/menus/);
    const G = vampireSonataGame();
    expect(menuSoundSet(G)).toBe(G.sound.menus);
    expect(menuSoundSet({ ...G, sound: undefined })).not.toBe(G.sound.menus);
  });

  it('a foe of a people with a voice of its own is never heard as a person; a beast never braces with a machine', () => {
    const S = soundSheet(vampireSonataGame());
    const people = Object.entries(vampireSonataGame().foes).filter(([, F]) => F.skin?.people && PEOPLE_VOICE[F.skin.people]).map(([id]) => id);
    expect(people.length).toBeGreaterThan(0);
    for (const id of people) expect(S.foeSounds[id]?.attack).not.toBe('attack-shout');
    for (const M of Object.values(S.run?.foes ?? {})) expect(M.brace).not.toBe('motor-rev');
  });
});
