import { describe, it, expect } from 'vitest';
import { runSteps, readGameworld, MEADOWMARK_HERO, characterParts, approveCharacter } from './index.js';
import { scaleOfWords, castingOf, laidCasting, classOf, castingIds } from './casting.js';
import { battleParty } from './battles.js';
import { CAST_PART } from './characters.js';

const W = (casting, more = {}) => ({ ...MEADOWMARK_HERO, characters: { ...MEADOWMARK_HERO.characters, casting }, battles: {}, ...more });
const levels = (S) => S.filter((s) => s.key.startsWith('level-'));

describe('the casting page: the people rolled for the game, as many as it asks for', () => {
  it('reads how complete a game the words ask for', () => {
    expect(scaleOfWords('a jrpg saga with a party of four and a cute familiar')).toMatchObject({ scale: 'journey', n: 3, familiar: true, bodies: { mascot: 4 } });
    expect(scaleOfWords('a hero and three companions')).toMatchObject({ scale: 'party', n: 3 });
    expect(scaleOfWords('a lone wanderer, and a rival')).toMatchObject({ scale: 'rival' });
    expect(scaleOfWords('a misty valley').scale).toBeUndefined();
  });

  it('a party: the cast rolled as one row in the game\'s setting, each member made from it by path, in the battle party in its class', () => {
    const world = W({ scale: 'party', n: 2 });
    const S = runSteps(world, { ref: 'gw' });
    const sheet = S.find((s) => s.key === 'casting');
    expect(sheet.order.manifest).toMatchObject({ kind: 'egocube', cast: { cast: { party: { relation: 'party', n: 2 } }, setting: { tradition: 'anime', genre: 'battle' } } });
    const members = S.filter((s) => s.order?.egocube === 'gw-casting');
    expect(members.map((s) => [s.key, s.ready, s.order.member])).toEqual([['cast-party-1', true, 'hero/party-1'], ['cast-party-2', true, 'hero/party-2']]);
    const C = castingOf(readGameworld(world));
    const party = levels(S)[0].order.manifest.play.rpg.party;
    expect(party.map((p) => [p.id, p.class])).toEqual([['hero', C.anchor.cls], ...C.members.map((M) => [M.id, M.cls])]);
    // in from the start: no joins flag, so no field follower waits on one
    expect(party.every((p) => p.joins === undefined)).toBe(true);
    expect(classOf(C.sheet.members['hero/party-1'])).toBe(C.members[0].cls);
  });

  it('a familiar of the hero fights beside it in the battle party, picking for itself, and takes no place of its own', () => {
    const world = W({ scale: 'party', n: 3, cast: { familiar: { relation: 'familiar', body: 'mascot' } } });
    const party = levels(runSteps(world, { ref: 'gw' }))[0].order.manifest.play.rpg.party;
    expect(party.map((p) => p.id)).toEqual(['hero', 'party-1', 'party-2', 'party-3', 'familiar']);
    expect(party.at(-1).auto).toEqual({ keeper: 'hero' });
  });

  it('on the level map each member plays its own moves and the first party follows from the start, a beast on its own gaits', () => {
    const world = W({ scale: 'party', n: 2, cast: { party: { relation: 'party', n: 2, body: 'person' }, red: { relation: 'party', body: 'beast', species: 'wolf' } } });
    const L = levels(runSteps(world, { ref: 'gw' }))[0].order.manifest, C = castingOf(readGameworld(world));
    const P1 = C.members.find((M) => M.id === 'party-1');
    expect(L.figures['party-1']).toMatchObject({ heroRef: 'gw-cast-party-1', clips: { forward: 'Walk_Loop' }, moves: P1.field.moves });
    expect(L.figures['party-1'].moves).toMatchObject({ stagger: 'stagger', topple: 'knockedOutDown', getup: 'knockedOutUp' });
    expect(L.play.party).toEqual(expect.arrayContaining([{ who: 'party-1' }, { who: 'party-2' }]));
    expect(L.play.carry).toBeUndefined();   // no joins flag to carry between levels
    // the wolf walks beside them on its own trot and walk, no library (a walker: it follows, it never pilots)
    expect(L.figures.red).toEqual({ heroRef: 'gw-cast-red', walker: true, clips: { forward: 'trot', turn: 'walk', strafe: 'trot' }, moves: { stagger: 'flinch', topple: 'fall', getup: 'rise' } });
    expect(L.play.party).toContainEqual({ who: 'red' });
    // the hero's own figure is as it was
    expect(levels(runSteps(W({ scale: 'hero' }), { ref: 'gw' }))[0].order.manifest.play.party).toBeUndefined();
  });

  it('a journey cast waits on its page: the members are made once characters:cast is approved', () => {
    const world = { ...W({ scale: 'journey', n: 1 }), mode: 'gated' };
    const wait = runSteps(world, { ref: 'gw' }).filter((s) => s.order?.egocube);
    expect(wait.length).toBeGreaterThan(4);
    expect(wait.every((s) => !s.ready && s.waiting.some((x) => x.id === CAST_PART))).toBe(true);
    const approved = { ...world, review: approveCharacter(world, CAST_PART) };
    expect(runSteps(approved, { ref: 'gw' }).filter((s) => s.order?.egocube).every((s) => s.ready)).toBe(true);
  });

  it('the page is a review part only where a book has one; it shows each member\'s reading and class', () => {
    expect(characterParts(MEADOWMARK_HERO).map((p) => p.id)).not.toContain(CAST_PART);
    const part = characterParts(W({ scale: 'party', n: 2 })).find((p) => p.id === CAST_PART);
    expect(part.content.members.length).toBe(3);
    expect(Object.keys(part.content.classes)).toEqual(['hero', 'party-1', 'party-2']);
  });

  it('no scale: the world\'s prompt decides, else a party for a world that fights turn by turn', () => {
    const told = { ...W({}), brief: { prompt: 'a saga in the meadows' } };
    expect(castingOf(readGameworld(told))).toMatchObject({ scale: 'journey', from: expect.stringMatching(/saga/) });
    expect(castingOf(readGameworld(W({}))).scale).toBe('party');
    expect(castingOf(readGameworld({ ...W({}), battles: undefined })).scale).toBe('hero');
  });

  it('laid into the book\'s cast for the story and the field, without moving a roll', () => {
    const G = readGameworld(W({ scale: 'rival', cast: { rival: { relation: 'rival', name: 'Kael', joins: 'kael-joins' } } }));
    const L = laidCasting(G);
    expect(L.characters.cast.rival).toEqual({ name: 'Kael', joins: 'kael-joins' });
    expect(castingOf(L).members).toEqual(castingOf(G).members);
    expect(battleParty(L).map((p) => p.id)).toEqual(['hero']);   // a rival is not first party
    expect(castingIds({ scale: 'party', n: 2 })).toEqual([{ id: 'party-1', key: 'party', bond: 'party' }, { id: 'party-2', key: 'party', bond: 'party' }]);
  });

  it('refuses what it cannot read, by name', () => {
    expect(() => readGameworld(W({ size: 3 }))).toThrow(/casting\.size is not part of the casting page/);
    expect(() => readGameworld(W({ cast: { x: { relation: 'nemesis' } } }))).toThrow(/relation is one of/);
    expect(() => readGameworld({ ...W({ scale: 'rival' }), characters: { ...W({ scale: 'rival' }).characters, cast: { rival: { name: 'Old Rival' } } } })).toThrow(/'rival' is a written cast member's id too/);
  });
});
