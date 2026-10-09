import { describe, it, expect } from 'vitest';
import { readGameworld, resolveLevel, resolveWorld, levelSeed, gameworldGraph, graphOutline, graphMermaid, styleGuide, civilizationCard, natureCard, colorKey, landOfKit, landFor, gameworldBibleHtml, MEADOWMARK, reviewParts, reviewState, approve, composeGameworld, readPrompt } from './index.js';
import { layLevel } from '../level/index.js';

const W = (more = {}) => ({ id: 'w', seed: 8, levels: { a: { walk: { nodes: { t: { trail: true } } } } }, ...more });

describe('gameworld', () => {
  it('reads a world: the style guide\'s defaults, the start, seeds derived from the world\'s and each level\'s id', () => {
    const G = readGameworld(W());
    expect(G).toMatchObject({ id: 'w', name: 'w', seed: 8, start: 'a', style: { kit: 'isekai-meadow', civilization: 'native' }, civIds: ['native'], links: [] });
    expect(G.civilizations.native).toMatchObject({ fort: 'crenellated' });
    expect(levelSeed(8, 'a')).toBe(levelSeed(8, 'a'));
    expect(levelSeed(8, 'a')).not.toBe(levelSeed(8, 'b'));
    expect(resolveLevel(G, 'a').seed).toBe(levelSeed(8, 'a'));
    expect(resolveLevel(W({ levels: { a: { seed: 3, walk: { nodes: { t: { trail: true } } } } } }), 'a').seed).toBe(3);
  });

  it('says what is wrong', () => {
    const bad = (w, re) => expect(() => resolveWorld(w)).toThrow(re);
    bad(W({ colour: 1 }), /'colour' is not a world setting/);
    bad(W({ characters: [{ name: 'hero' }] }), /characters are not on the ground/);
    bad(W({ style: { kit: 'gothic-stone' } }), /not an outdoor stage kit/);
    bad(W({ style: { trail: { beats: [] } } }), /trail.beats is not a trail setting a world hands down/);
    bad(W({ style: { weather: 'rain' } }), /not part of the style/);
    bad(W({ style: { anchor: 'shell' } }), /anchor belongs to a civilization/);
    bad(W({ civilizations: {} }), /at least one/);
    bad(W({ civilizations: { elves: { people: [] } } }), /its people are left open/);
    bad(W({ civilizations: { elves: { town: { dragons: 3 } } } }), /town.dragons is not a town setting/);
    bad(W({ style: { civilization: 'orcs' } }), /'orcs' is not a civilization/);
    bad(W({ levels: { a: { walk: { nodes: { t: { trail: true } } }, places: { town: { civilization: 'orcs' } } } } }), /places.town.civilization 'orcs'/);
    bad(W({ levels: { a: { walk: { kit: 'alien-night', nodes: { t: { trail: true } } } } } }), /a level's kit is its own/);
    bad(W({ links: [{ from: 'a', to: 'z' }] }), /'z' is not a level/);
    bad(W({ start: 'q' }), /start 'q' is not a level/);
    bad(W({ style: { trail: { heartbeat: 4 } } }), /trail/);
    bad(W({ levels: { a: { walk: { nodes: { t: { trail: true } } }, places: { inn: true } } } }), /not a place/);
  });

  it('a level inherits its world and is built by its civilizations, and keeps a ledger of what it overrides', () => {
    const civilizations = { framers: { anchor: 'timber-hall', town: { levels: 2 } }, shells: { anchor: 'shell', castle: { size: 44 } }, steps: { anchor: 'tiered', fort: 'battered' } };
    const w = W({ style: { trail: { heartbeat: 0.8, bumpiness: 0.6 } }, civilizations,
      levels: { a: { style: { kit: 'alien-night', civilization: 'shells' }, walk: { nodes: { t: { trail: true }, u: { trail: { heartbeat: 0.95 } } } }, places: { town: { levels: 1 }, castle: { size: 48 } } } } });
    const R = resolveLevel(w, 'a');
    expect(R.style).toMatchObject({ kit: 'alien-night', civilization: 'shells', trail: { heartbeat: 0.8, bumpiness: 0.6 } });
    expect(R.level.kit).toBe('alien-night');
    expect(R.level.nodes.t.trail).toEqual({ heartbeat: 0.8, bumpiness: 0.6 });
    expect(R.level.nodes.u.trail).toEqual({ heartbeat: 0.95, bumpiness: 0.6 });
    expect(R.built).toEqual({ town: 'shells', castle: 'shells' });
    expect(R.town).toEqual({ levels: 1, anchor: 'shell', castle: { fort: 'crenellated', size: 48 } });
    expect(R.ledger).toEqual([
      { scope: 'level', at: 'a', key: 'kit', world: 'isekai-meadow', local: 'alien-night' },
      { scope: 'level', at: 'a', key: 'civilization', world: 'framers', local: 'shells' },
      { scope: 'section', at: 'a/u', key: 'trail.heartbeat', world: 0.8, local: 0.95 },
      { scope: 'place', at: 'a/castle', key: 'castle.size', world: 44, local: 48 },
    ]);
    // N + x: a castle raised by another civilization over the town, in its own language and fortification
    const C = resolveLevel(W({ civilizations, levels: { a: { walk: { nodes: { t: { trail: true } } }, places: { town: true, castle: { civilization: 'steps' } } } } }), 'a');
    expect(C.built).toEqual({ town: 'framers', castle: 'steps' });
    expect(C.town).toEqual({ levels: 2, anchor: 'timber-hall', castle: { fort: 'battered', anchor: 'tiered' } });
    expect(C.ledger).toEqual([{ scope: 'place', at: 'a/castle', key: 'civilization', world: 'framers', local: 'steps' }]);
    // a level that follows its world in everything keeps an empty ledger
    expect(resolveLevel(W(), 'a').ledger).toEqual([]);
  });

  it('a resolved level lays out as the level a creator would write by hand', () => {
    const R = resolveLevel(MEADOWMARK, 'meadow-ascent');
    const hand = { kit: 'isekai-meadow', seed: 8, nodes: { trailhead: { trail: { heartbeat: 0.8, bumpiness: 0.6 } }, approach: { trail: { heartbeat: 0.95, bumpiness: 0.6 } }, lookout: { meru: { preset: 'mountain-lookout' } } } };
    expect(layLevel(R.level)).toEqual(layLevel(hand));
  });

  it('the graph: the world, its style guide, its levels, their sections and places, and how they bear on each other', () => {
    const g = gameworldGraph(MEADOWMARK);
    expect(gameworldGraph(MEADOWMARK)).toEqual(g);
    const kinds = (k) => g.nodes.filter((n) => n.kind === k).map((n) => n.id);
    expect(kinds('level')).toEqual(['level:meadow-ascent', 'level:shell-shore']);
    expect(kinds('section')).toEqual(['section:meadow-ascent/trailhead', 'section:meadow-ascent/approach', 'section:meadow-ascent/lookout', 'section:shell-shore/landing', 'section:shell-shore/terrace']);
    expect(kinds('kit')).toEqual(['kit:isekai-meadow', 'kit:alien-night']);
    const has = (e) => expect(g.edges).toContainEqual(expect.objectContaining(e));
    has({ from: 'level:meadow-ascent', to: 'level:shell-shore', kind: 'leads', via: 'gate' });
    has({ from: 'section:meadow-ascent/trailhead', to: 'section:meadow-ascent/approach', kind: 'seam' });
    expect(kinds('civilization')).toEqual(['civilization:framers', 'civilization:stepkeepers', 'civilization:shell-builders']);
    has({ from: 'place:shell-shore/town', to: 'civilization:shell-builders', kind: 'built-by' });
    has({ from: 'place:meadow-ascent/castle', to: 'civilization:stepkeepers', kind: 'built-by' });
    has({ from: 'civilization:shell-builders', to: 'language:shell', kind: 'speaks' });
    has({ from: 'civilization:stepkeepers', to: 'fort:battered', kind: 'raises' });
    has({ from: 'level:shell-shore', to: 'civilization:shell-builders', kind: 'settled-by' });
    has({ from: 'level:shell-shore', to: 'world', kind: 'overrides', key: 'kit', local: 'alien-night' });
    has({ from: 'section:meadow-ascent/approach', to: 'world', kind: 'overrides', key: 'trail.heartbeat' });
    for (const e of g.edges) for (const k of ['from', 'to']) expect(g.nodes.some((n) => n.id === e[k])).toBe(true);
    expect(graphOutline(g).split('\n')[0]).toBe('world · Meadowmark — styled → isekai-meadow; styled → The framers');
    expect(graphMermaid(g).startsWith('flowchart LR')).toBe(true);
  });

  it('the style guide: the kit\'s palette and principles; each civilization\'s language and what it makes of a castle', () => {
    const S = styleGuide(readGameworld(MEADOWMARK));
    expect(S.kit.ramps.map((r) => r.name)).toContain('grass');
    expect(S.kit.principles.length).toBeGreaterThan(3);
    expect(Object.keys(S.civilizations)).toEqual(['framers', 'stepkeepers', 'shell-builders']);
    expect(S.civilizations['shell-builders'].language.vocab.mass).toBe('shell');
    expect(S.civilizations['shell-builders'].fort.influence).toMatchObject({ trace: 'ellipse', crown: 'dome', keep: 'orbs' });
    expect(S.civilizations.framers.fort.influence.trace).toBe('rect');
    expect(civilizationCard({ name: 'x', fort: 'battered' }, 'isekai-meadow', 8).language.own).toBe(true);
  });

  it('the natural world: each kit\'s card and land read from its style card, a world\'s choices over it, its color key', () => {
    const day = natureCard('isekai-meadow'), night = natureCard('alien-night');
    expect(day.sky.time).toBe('day');
    expect(night.sky.read).toMatch(/moon/);
    expect(night.water.read).toMatch(/glows/);
    // the kit's land as it draws it: the meadow's cumulus, the night clear
    expect(landOfKit('isekai-meadow').cloud).toEqual({ variant: 'cumulus', many: 0.5 });
    expect(landOfKit('alien-night').cloud.many).toBe(0);
    const L = landFor('alien-night', { landmark: { variant: 'arch', many: 0.5 } });
    expect(L.landmark).toMatchObject({ variant: 'arch', many: 0.5, word: 'a group', own: true });
    expect(L.cloud).toMatchObject({ word: 'clear', own: false });
    const K = colorKey('isekai-meadow');
    expect(K.ramps.find((r) => r.name === 'rock').paints).toMatch(/cliffs/);
    expect(K.ramps.find((r) => r.name === 'stone')).toMatchObject({ part: 'made', shared: 'rock' });
  });

  it('the land in the style: a variant, a step or both, laid over the world\'s by a level and kept in its ledger', () => {
    const R = resolveLevel(MEADOWMARK, 'shell-shore');
    expect(R.style.land).toEqual({ landscape: { variant: 'hummocky', many: 0.5 }, rock: { variant: 'tor', many: 0.25 }, landmark: { variant: 'arch', many: 0.5 }, strata: { variant: 'folded' } });
    expect(R.ledger.filter((o) => o.key.startsWith('land.'))).toEqual([
      { scope: 'level', at: 'shell-shore', key: 'land.landscape.variant', world: 'downs', local: 'hummocky' },
      { scope: 'level', at: 'shell-shore', key: 'land.strata.variant', world: null, local: 'folded' },
      { scope: 'level', at: 'shell-shore', key: 'land.landmark.variant', world: 'monolith', local: 'arch' },
      { scope: 'level', at: 'shell-shore', key: 'land.landmark.many', world: 0.25, local: 0.5 },
    ]);
    const bad = (land, re) => expect(() => readGameworld(W({ style: { land } }))).toThrow(re);
    bad({ volcano: 'big' }, /not a land form/);
    bad({ cloud: 'mammatus' }, /'mammatus' is not a cloud/);
    bad({ cloud: { many: 2 } }, /from little \(0\) to many \(1\)/);
    bad({ cloud: { colour: 'grey' } }, /not a land setting/);
  });

  it('the gate: each part a print; an approval stands until its part changes; a note sends a part back', () => {
    const parts = reviewParts(MEADOWMARK);
    expect(parts.map((p) => p.id)).toEqual(['world', 'nature', 'civilizations', 'key', 'level:meadow-ascent', 'level:shell-shore']);
    expect(reviewParts(MEADOWMARK)).toEqual(parts);
    expect(reviewState(MEADOWMARK).map((x) => [x.id, x.status])).toEqual([['world', 'proposed'], ['nature', 'approved'], ['civilizations', 'approved'], ['key', 'proposed'], ['level:meadow-ascent', 'revise'], ['level:shell-shore', 'proposed']]);
    // approve the shore, then change it: the approval stands stale and the shore comes back for review
    const w1 = { ...MEADOWMARK, review: approve(MEADOWMARK, 'level:shell-shore') };
    expect(reviewState(w1).find((x) => x.id === 'level:shell-shore').status).toBe('approved');
    const w2 = { ...w1, levels: { ...w1.levels, 'shell-shore': { ...w1.levels['shell-shore'], seed: 9 } } };
    expect(reviewState(w2).find((x) => x.id === 'level:shell-shore').status).toBe('changed');
    // the review is the creator's: an approval needs its print, a status is one of three
    expect(() => reviewState({ ...MEADOWMARK, review: { nature: { status: 'approved' } } })).toThrow(/keeps the print/);
    expect(() => reviewState({ ...MEADOWMARK, review: { nature: { status: 'auto' } } })).toThrow(/proposed, approved, revise/);
    expect(() => reviewState({ ...MEADOWMARK, review: { sky: { status: 'revise' } } })).toThrow(/not a part/);
    // autonomous: an unreviewed part stands on its machine gate, never approved
    const A = { ...MEADOWMARK, mode: 'autonomous', review: {} };
    expect(reviewState(A, { machine: { 'level:shell-shore': ['lots-clear'] } }).map((x) => x.status)).toEqual(['auto', 'auto', 'auto', 'auto', 'auto', 'revise']);
  });

  it('autonomous mode: a world composed from a few words, every decision kept, checked by its machine gate', () => {
    const prompt = 'misty highland of basalt cliffs, stone domes and a temple fortress, stormy';
    const w = composeGameworld({ prompt, seed: 3 });
    expect(composeGameworld({ prompt, seed: 3 })).toEqual(w);
    expect(w.mode).toBe('autonomous');
    expect(w.brief.unread).toEqual(['stone']);
    // the first word to decide a thing decides it: misty before stormy, basalt before cliffs
    expect(w.style.land.cloud).toEqual({ variant: 'stratus', many: 0.75 });
    expect(w.style.land.face).toEqual({ variant: 'columnar', many: 0.75 });
    expect(w.style.meru.preset).toBe('temple-pyramid');
    expect(Object.values(w.civilizations).map((c) => [c.anchor, c.fort])).toEqual([['shell', 'battered'], ['tiered', 'battered']]);
    expect(Object.keys(w.levels)).toHaveLength(3);
    for (const id of Object.keys(w.levels)) expect(layLevel(resolveLevel(w, id).level).stages.length).toBeGreaterThan(0);
    for (const l of w.brief.levels) expect(l.laws).toEqual([]);
    expect(reviewState(w).every((x) => x.status === 'auto')).toBe(true);
    expect(Object.keys(composeGameworld({ prompt: 'a small night garden', seed: 1 }).levels)).toHaveLength(2);
    expect(readPrompt('glowing night arches').read.map((r) => r.word)).toEqual(['glowing', 'night', 'arches']);
    expect(() => composeGameworld({ prompt: ' ' })).toThrow(/needs a prompt/);
  }, 120000);

  it('the bible: the same world, the same page; a page for each level, every plate fenced', () => {
    const a = gameworldBibleHtml(MEADOWMARK), b = gameworldBibleHtml(MEADOWMARK);
    expect(a).toBe(b);
    for (const id of ['cover', 'gate', 'map', 'nature', 'nature-isekai-meadow', 'nature-alien-night', 'civilizations', 'civ-stepkeepers', 'key', 'key-alien-night', 'level-meadow-ascent', 'level-shell-shore', 'open']) expect(a).toContain(`id="${id}"`);
    expect((a.match(/<!--plate:/g) || []).length).toBe((a.match(/<!--\/plate-->/g) || []).length);
    expect(a).toContain('id="gameworld-graph"');
    expect(a).toContain('<span class="stamp st-revise"');
    expect(gameworldBibleHtml(composeGameworld({ prompt: 'desert canyon of arches', seed: 2 }))).toContain('The prompt it was composed from');
    // the land drawn, not shot: a plate a form, a strip a form with the chosen step marked
    expect(a).toContain('<!--plate:land-alien-night-landmark-->');
    expect((a.match(/<figure class="mark">/g) || []).length).toBe(12);
  }, 120000);
});
