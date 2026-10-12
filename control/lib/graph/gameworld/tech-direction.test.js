import { describe, it, expect } from 'vitest';
import { readTechDirection, resolveTechDirection, teamColour, rankOf, useOf, techCamera, motifOf, MOTIFS, MOTIF_IDS, TEAM_COLOURS, USES_BY_LIST } from './tech-direction.js';
import { readGameworld, resolveWorld, HALDEN_REACH, MEADOWMARK, composeGameworld } from './index.js';
import { reviewParts } from './review.js';
import { gameworldGraph } from './graph.js';
import { gameworldBibleHtml } from './bible-html.js';

const W = (technology, more = {}) => ({ id: 'w', civilizations: { folk: { technology }, others: {} }, levels: { a: { walk: { nodes: { t: { trail: true } } } } }, ...more });

describe('the technology direction: reading the page', () => {
  it('reads a style, a motif by its words, elements, a tone and a team colour; refuses what is not one', () => {
    expect(readTechDirection({ motif: 'bolted iron', elements: ['fire', 'storm'], tone: 'noir', team: '#AABBCC' })).toEqual({ motif: { id: 'riveted', said: 'bolted iron' }, elements: { primary: 'fire', secondary: 'storm' }, tone: 'noir', team: '#aabbcc' });
    expect(readTechDirection({ elements: 'ice' })).toEqual({ elements: { primary: 'ice' } });
    expect(() => readTechDirection({ motif: 'wobbly' })).toThrow(/motif is a word naming a motif/);
    expect(() => readTechDirection({ elements: { primary: 'plasma' } })).toThrow(/not an element word/);
    expect(() => readTechDirection({ team: 'red' })).toThrow(/'#rrggbb'/);
    expect(() => readTechDirection({ style: 'n64' })).toThrow(/not a style/);
    expect(() => readTechDirection({ colour: '#ffffff' })).toThrow(/not part of a technology direction/);
    for (const id of MOTIF_IDS) expect(motifOf(MOTIFS[id].words[0])).toBe(id);
  });

  it('a crafted thing may carry its rank; a machine stays words', () => {
    const G = readGameworld(W({ vehicles: { walker: { intent: 'a walker mech', rank: 'focus' } } }));
    expect(G.civilizations.folk.technology.vehicles.walker).toMatchObject({ intent: 'a walker mech', rank: 'focus', form: 'walker' });
    expect(() => readGameworld(W({ vehicles: { walker: { intent: 'a walker', rank: 'hero' } } }))).toThrow(/not an interest rank/);
    expect(() => readGameworld(W({ things: { hauler: { intent: 'a hauler', rank: 'focus' } } }))).toThrow(/rank is not an intent setting/);
  });
});

describe('the technology direction: resolved, every default saying where it came from', () => {
  it('nothing crafted and nothing said: no page', () => {
    const G = readGameworld(W({ things: { hauler: 'a tracked hauler' } }));
    expect(resolveTechDirection(G, 'folk')).toBeNull();
    expect(reviewParts(MEADOWMARK).some((p) => p.id.startsWith('tech:'))).toBe(false);
  });

  it('defaults: wc3, the world\'s camera, a motif from its finish, no elements, the kit\'s tone, its place\'s team colour', () => {
    const D = resolveTechDirection(readGameworld(W({ finish: 'iron-and-timber', vehicles: { cart: 'a cart' } })), 'folk');
    expect(D).toMatchObject({ style: 'wc3', camera: 'first-person', motif: 'riveted', elements: {}, tone: null, team: TEAM_COLOURS[0], ledger: [] });
    expect(D.from).toMatchObject({ style: 'default', motif: 'its finish (iron-and-timber)', team: 'the civilization\'s place (1 of 2)' });
    expect(D.ranks['vehicles/cart']).toEqual({ rank: 'prop', why: 'a cart: it is drawn, not ridden', use: 'watched', useWhy: 'a cart: drawn, not driven' });
    // with a hero, the world is met third person
    expect(techCamera({ characters: {} })).toBe('third-person');
    expect(techCamera({ camera: 'top-down' })).toBe('top-down');
  });

  it('what it builds names its motif; what it says is ledgered over the default', () => {
    const G = readGameworld({ ...W({ direction: { motif: 'spiked', team: '#112233' }, weapons: { blade: 'a sword' }, structures: { gate: 'a gate' } }), civilizations: { folk: { builds: 'a modular sci-fi habitat', technology: { direction: { motif: 'spiked', team: '#112233' }, weapons: { blade: 'a sword' }, structures: { gate: 'a gate' } } } } });
    const D = resolveTechDirection(G, 'folk');
    expect(D.motif).toBe('spiked');
    expect(D.ledger).toEqual([
      { scope: 'civilization', at: 'folk/technology', key: 'motif', world: 'smooth', local: 'spiked' },
      { scope: 'civilization', at: 'folk/technology', key: 'team', world: TEAM_COLOURS[0], local: '#112233' },
    ]);
    expect(D.ranks).toEqual({ 'structures/gate': { rank: 'focus', why: 'a gate: the level is read by it', use: 'watched', useWhy: 'a gate: the level shows it' }, 'weapons/blade': { rank: 'interactable', why: 'a weapon in the hand: it is used', use: 'held', useWhy: 'a weapon in the hand' } });
  });

  it('a team colour is a marker a placement may pass; the civilization\'s is the default', () => {
    const D = { team: '#c8322b' };
    expect(teamColour(D)).toBe('#c8322b');
    expect(teamColour(D, '#00FF00')).toBe('#00ff00');
    expect(() => teamColour(D, 'blue')).toThrow(/'#rrggbb'/);
  });

  it('ranks by what a thing does and how big it is', () => {
    const t = (form, variant, tier, functions) => ({ form, variant, block: { tier, functions } });
    expect(rankOf('vehicles', t('tracked', 'tracked', 'machine', ['move', 'guard', 'strike'])).rank).toBe('focus');
    expect(rankOf('vehicles', t('wheeled', 'car', 'vessel', ['move'])).rank).toBe('focus');
    expect(rankOf('vehicles', t('hover', 'hover', 'machine', ['move'])).rank).toBe('interactable');
    expect(rankOf('structures', t('tower', 'tower', 'landmark', ['signal'])).rank).toBe('focus');
    expect(rankOf('structures', t('bridge', 'bridge', 'landmark', ['pass'])).rank).toBe('interactable');
    expect(rankOf('things', t('x', 'x', 'machine', ['make'])).rank).toBe('prop');
  });

  it('a thing is watched, held or driven, by what it is; a world may say otherwise, within what its list allows', () => {
    const t = (form, variant, tier, functions) => ({ form, variant, block: { tier, functions } });
    expect(useOf('weapons', t('blade', 'sword', 'held', ['strike'])).use).toBe('held');
    expect(useOf('weapons', t('cannon', 'cannon', 'machine', ['strike'])).use).toBe('watched');
    expect(useOf('vehicles', t('walker', 'walker', 'machine', ['move'])).use).toBe('driven');
    expect(useOf('vehicles', t('drawn', 'cart', 'machine', ['move', 'carry'])).use).toBe('watched');
    expect(useOf('structures', t('tower', 'tower', 'landmark', ['signal'])).use).toBe('watched');
    expect(USES_BY_LIST.structures).toEqual(['watched']);
    const D = resolveTechDirection(readGameworld(W({ vehicles: { v: { intent: 'an armoured walker', use: 'watched' } } })), 'folk');
    expect(D.ranks['vehicles/v']).toMatchObject({ use: 'watched', useWhy: 'said' });
    expect(D.ledger).toContainEqual({ scope: 'thing', at: 'folk/technology/vehicles/v', key: 'use', world: 'driven', local: 'watched' });
    expect(() => readGameworld(W({ vehicles: { v: { intent: 'an armoured walker', use: 'held' } } }))).toThrow(/not a use for its vehicles \(driven, watched\)/);
  });
});

describe('the technology direction in the world', () => {
  it('Halden Reach: each civilization\'s page is a review part; the graph carries ranks; the bible draws the page', () => {
    const { world: G } = resolveWorld(HALDEN_REACH);
    const S = resolveTechDirection(G, 'survey-corps'), D = resolveTechDirection(G, 'dome-growers');
    expect(S).toMatchObject({ motif: 'smooth', elements: { primary: 'lightning' }, team: TEAM_COLOURS[0] });
    expect(S.from.motif).toMatch(/^its builds/);
    expect(S.ranks['vehicles/walker']).toEqual({ rank: 'focus', why: 'said', use: 'driven', useWhy: 'it can be ridden' });
    expect(D.team).toBe(TEAM_COLOURS[1]);
    expect(reviewParts(HALDEN_REACH).filter((p) => p.id.startsWith('tech:')).map((p) => p.id)).toEqual(['tech:survey-corps', 'tech:dome-growers']);
    expect(gameworldGraph(HALDEN_REACH).nodes.find((n) => n.id === 'vehicle:survey-corps/walker')).toMatchObject({ rank: 'focus', use: 'driven', form: 'walker' });
    const a = gameworldBibleHtml(HALDEN_REACH);
    expect(a).toContain('id="tech-survey-corps"');
    expect(a).toContain('Its technology: the direction');
    expect(a).toContain('href="#tech-dome-growers"');
  }, 120000);

  it('autonomous: the prompt\'s motif and elements become the direction of what it crafts', () => {
    const W2 = composeGameworld({ prompt: 'a riveted steampunk frontier under a storm sky: steam trains, iron truss bridges, rifles and field cannon', seed: 3 });
    expect(Object.values(W2.civilizations)[0].technology.direction).toEqual({ motif: 'riveted', elements: { primary: 'storm', secondary: 'iron' } });
    expect(W2.brief.tunnels.direction).toEqual(['motif', 'elements']);
  }, 60000);
});
