// A LEVEL WALKED SIDEWAYS in a composed world (sideways.js): the side-scroll map as a level's own, the world's hero and
// party its players, its bestiary's cast the crowd. The concepts: read, staged, laid, turned; a world with none is as
// it was.
import { describe, it, expect } from 'vitest';
import { readSideways, sidewaysFoes, sidewaysStage, sidewaysLevelOrder, sidewaysTurn, SIDEWAYS_KEYS } from './sideways.js';
import { readGameworld } from './world.js';
import { runSteps } from './runner.js';
import { fieldedIds } from './foes.js';
import { MEADOWMARK_HERO } from './examples.js';
import { FOE_CLASSES } from '../foes/index.js';
import { GRUNT_STYLE_IDS } from '../cosmos/packs/comic-hero/grunts.js';
import { readFlow, defaultFlow } from '../game/flow.js';

const CLASS = Object.keys(FOE_CLASSES)[0], CREW = GRUNT_STYLE_IDS[0];
const GROUND = { kind: 'greybox', preset: 'street' };
const world = (levels, more = {}) => ({ id: 'dockside', name: 'Dockside', mode: 'autonomous', style: MEADOWMARK_HERO.style, civilizations: MEADOWMARK_HERO.civilizations, characters: MEADOWMARK_HERO.characters,
  foes: { punk: { class: CLASS, skin: { people: 'human', dress: { faction: CREW } } }, chief: { class: CLASS, skin: { people: 'human', dress: { faction: CREW } } } }, levels, ...more });
const ONE = { dock: { name: 'Dock Road', sideways: { ground: GROUND, cast: { '*': 'punk', boss: 'chief' } } } };

describe('read', () => {
  it('true is the town\'s street; its words are a brawl level\'s, a bestiary\'s and a street\'s, each fault said', () => {
    expect(readSideways(true).ground).toEqual({ kind: 'town' });
    expect(Object.keys(readSideways({ ground: GROUND, cast: { '*': 'punk' } }, { foes: { punk: {} } }))).toEqual(['ground', 'cast']);
    expect(() => readSideways({ place: 'x' })).toThrow(/not a sideways level's word/);
    expect(() => readSideways({ ground: { kind: 'moon' } })).toThrow(/kind is one of/);
    expect(() => readSideways({ cast: { '*': 'nobody' } }, { foes: { punk: {} } })).toThrow(/not in the world's bestiary/);
    expect(() => readSideways({ cast: { wizard: 'punk' } }, { foes: { punk: {} } })).toThrow(/a crowd type/);
    expect(() => readSideways({ ground: GROUND, waves: [{ screen: 9, crowd: [{ type: 'thug', n: 1 }] }] })).toThrow(/screen of the belt/);
    expect(readSideways({ ground: GROUND, play: 'gun' }).play).toBe('gun');
    expect(() => readSideways({ ground: GROUND, play: 'kart' })).toThrow(/play is/);
    expect(SIDEWAYS_KEYS).toContain('scenes');
  });
  it('a world reads it as a level of its own kind: alone on its level, its cast in the bestiary', () => {
    expect(() => readGameworld(world(ONE))).not.toThrow();
    expect(() => readGameworld(world({ dock: { ...ONE.dock, walk: { nodes: { a: { trail: true } } } } }))).toThrow(/its map alone/);
    expect(() => readGameworld(world({ dock: { sideways: { cast: { '*': 'ghost' } } } }))).toThrow(/bestiary/);
  });
  it('its cast\'s foes are fielded: the run makes each a figure; a world with no sideways level fields none for it', () => {
    const G = readGameworld(world(ONE));
    expect(sidewaysFoes(G)).toEqual(['punk', 'chief']);
    expect(fieldedIds(G)).toEqual(['punk', 'chief']);
    expect(sidewaysFoes(readGameworld(MEADOWMARK_HERO))).toEqual([]);
  });
});

describe('laid', () => {
  const G = readGameworld(world(ONE)), stage = { level: 'dock', node: 'street', section: 'sideways', index: 0, manifest: sidewaysStage(readSideways(ONE.dock.sideways)) };
  const L = sidewaysLevelOrder(G, stage, { ref: 'lv', hero: 'hero-ref', heroName: 'Ada', party: [{ id: 'mate', name: 'Mate', ref: 'mate-ref' }], foeRefs: { punk: 'punk-ref', chief: 'chief-ref' }, register: 'western' });
  const street = L.args.manifest.brawl.street;
  it('the hero and the party are its players, the first plays; its cast\'s foes follow them, drawn where the cast says', () => {
    expect(street.roster.map((r) => [r.id, r.hero.ref])).toEqual([['hero', 'hero-ref'], ['mate', 'mate-ref'], ['foe-punk', 'punk-ref'], ['foe-chief', 'chief-ref']]);
    expect(street.players).toEqual([0]);
    expect(street.cast).toEqual({ '*': [2], boss: [3] });
    expect(L.playable).toEqual([{ id: 'hero', name: 'Ada' }, { id: 'mate', name: 'Mate' }]);
  });
  it('it is a level the shell hosts: the place and its belt, the street on it, the level\'s contract, the world\'s register', () => {
    const M = L.args.manifest;
    expect(M.kind).toBe(stage.manifest.kind);
    expect(M.brawl.belt).toEqual(stage.manifest.brawl.belt);
    expect(M.brawl.register).toBe('western');
    expect(M.game).toMatchObject({ produces: { results: ['success', 'fail'] } });
    expect(street.waves.length).toBeGreaterThan(0); expect(street.things.length).toBeGreaterThan(0);
    expect(Object.keys(street.scenes)).toEqual(['arrive', 'leave']);
    expect(street.scenes.arrive.find((b) => b.title).title).toBe('Dock Road');
  });
  it('its turn asks the set-up (who plays, when more than one can) and calls its scenes; one to play asks no fighter', () => {
    const flow = defaultFlow({ title: 'x', levels: [{ ref: 'lv', title: 'Dock' }] });
    const two = sidewaysTurn(flow, { playable: L.playable, staged: true }), lv = Object.values(two.steps).find((s) => s.kind === 'level');
    expect(readFlow(two, { levels: ['lv'] })).toEqual([]);
    expect(lv.picks.map((p) => p.id)).toEqual(['difficulty', 'fighter']);
    expect(lv.start.scene).toBe('arrive'); expect(lv.end).toEqual({ scene: 'leave', when: 'won' });
    const one = Object.values(sidewaysTurn(flow, { playable: [L.playable[0]] }).steps).find((s) => s.kind === 'level');
    expect(one.picks.map((p) => p.id)).toEqual(['difficulty']); expect(one.start).toBeUndefined();
  });
});

describe('the run', () => {
  it('a composed world makes a brawler: its hero, its crew, each level a street, the game on the turn', () => {
    const steps = runSteps(readGameworld(world({ ...ONE, yard: { name: 'The Yard', sideways: { ground: GROUND, cast: { '*': 'punk' } } } }, { links: [{ from: 'dock', to: 'yard', kind: 'gate' }] })), { ref: 'gw' });
    const keys = steps.map((s) => s.key);
    for (const k of ['hero', 'foes-punk', 'foes-chief', 'level-dock-0', 'level-yard-0', 'game']) expect(keys, k).toContain(k);
    const street = steps.find((s) => s.key === 'level-dock-0').order.manifest.brawl.street;
    expect(street.roster[0].id).toBe('hero');
    expect(street.roster.find((r) => r.id === 'foe-punk').hero.ref).toBe(steps.find((s) => s.key === 'foes-punk').ref);
    const game = steps.find((s) => s.key === 'game').order, lv = Object.values(game.flow.steps).filter((s) => s.kind === 'level');
    expect(game.levels).toHaveLength(2);
    expect(lv.length).toBeGreaterThan(0);
    for (const L of lv) { expect(L.picks.map((p) => p.id)).toEqual(['difficulty']); expect(L.start.scene).toBe('arrive'); }
  });
  it('a world with no sideways level is made as it was', () => {
    const keys = runSteps(readGameworld({ ...MEADOWMARK_HERO, mode: 'autonomous' }), { ref: 'gw' }).map((s) => s.key);
    expect(keys.some((k) => /^level-/.test(k))).toBe(true);
    expect(keys.some((k) => /street/.test(k))).toBe(false);
  });
});
