import { describe, it, expect } from 'vitest';
import { readGameworld, resolveLevel, resolveWorld, levelSeed, gameworldGraph, graphOutline, graphMermaid, styleGuide, gameworldBibleHtml, MEADOWMARK } from './index.js';
import { layLevel } from '../level/index.js';

const W = (more = {}) => ({ id: 'w', seed: 8, levels: { a: { walk: { nodes: { t: { trail: true } } } } }, ...more });

describe('gameworld', () => {
  it('reads a world: the style guide\'s defaults, the start, seeds derived from the world\'s and each level\'s id', () => {
    const G = readGameworld(W());
    expect(G).toMatchObject({ id: 'w', name: 'w', seed: 8, start: 'a', style: { kit: 'isekai-meadow', fort: 'crenellated' }, links: [] });
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
    bad(W({ style: { weather: 'rain' } }), /not part of the style guide/);
    bad(W({ levels: { a: { walk: { kit: 'alien-night', nodes: { t: { trail: true } } } } } }), /a level's kit is its own/);
    bad(W({ links: [{ from: 'a', to: 'z' }] }), /'z' is not a level/);
    bad(W({ start: 'q' }), /start 'q' is not a level/);
    bad(W({ style: { trail: { heartbeat: 4 } } }), /trail/);
    bad(W({ levels: { a: { walk: { nodes: { t: { trail: true } } }, places: { inn: true } } } }), /not a place/);
  });

  it('a level inherits its world, and keeps a ledger of what it overrides', () => {
    const w = W({ style: { anchor: 'timber-hall', trail: { heartbeat: 0.8, bumpiness: 0.6 }, town: { levels: 2 } },
      levels: { a: { style: { kit: 'alien-night', anchor: 'shell' }, walk: { nodes: { t: { trail: true }, u: { trail: { heartbeat: 0.95 } } } }, places: { town: { levels: 1 }, castle: { size: 48 } } } } });
    const R = resolveLevel(w, 'a');
    expect(R.style).toMatchObject({ kit: 'alien-night', anchor: 'shell', fort: 'crenellated', trail: { heartbeat: 0.8, bumpiness: 0.6 } });
    expect(R.level.kit).toBe('alien-night');
    expect(R.level.nodes.t.trail).toEqual({ heartbeat: 0.8, bumpiness: 0.6 });
    expect(R.level.nodes.u.trail).toEqual({ heartbeat: 0.95, bumpiness: 0.6 });
    expect(R.town).toEqual({ levels: 1, anchor: 'shell', castle: { fort: 'crenellated', size: 48 } });
    expect(R.ledger).toEqual([
      { scope: 'level', at: 'a', key: 'kit', world: 'isekai-meadow', local: 'alien-night' },
      { scope: 'level', at: 'a', key: 'anchor', world: 'timber-hall', local: 'shell' },
      { scope: 'section', at: 'a/u', key: 'trail.heartbeat', world: 0.8, local: 0.95 },
      { scope: 'place', at: 'a/town', key: 'town.levels', world: 2, local: 1 },
    ]);
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
    has({ from: 'place:shell-shore/town', to: 'language:shell', kind: 'speaks' });
    has({ from: 'place:shell-shore/castle', to: 'fort:crenellated', kind: 'raises' });
    has({ from: 'level:shell-shore', to: 'world', kind: 'overrides', key: 'kit', local: 'alien-night' });
    has({ from: 'section:meadow-ascent/approach', to: 'world', kind: 'overrides', key: 'trail.heartbeat' });
    for (const e of g.edges) for (const k of ['from', 'to']) expect(g.nodes.some((n) => n.id === e[k])).toBe(true);
    expect(graphOutline(g).split('\n')[0]).toBe('world · Meadowmark — styled → isekai-meadow; styled → timber-hall; styled → crenellated');
    expect(graphMermaid(g).startsWith('flowchart LR')).toBe(true);
  });

  it('the style guide: the kit\'s palette and principles, the language\'s elements, what the language makes of the castle', () => {
    const S = styleGuide({ kit: 'isekai-meadow', anchor: 'shell', fort: 'crenellated' }, 8);
    expect(S.kit.ramps.map((r) => r.name)).toContain('grass');
    expect(S.kit.principles.length).toBeGreaterThan(3);
    expect(S.language.vocab.mass).toBe('shell');
    expect(S.fort.influence).toMatchObject({ trace: 'ellipse', crown: 'dome', keep: 'orbs' });
    expect(styleGuide({ kit: 'isekai-meadow', anchor: 'timber-hall', fort: 'crenellated' }, 8).fort.influence.trace).toBe('rect');
  });

  it('the bible: the same world, the same page; a page for each level, every plate fenced', () => {
    const a = gameworldBibleHtml(MEADOWMARK), b = gameworldBibleHtml(MEADOWMARK);
    expect(a).toBe(b);
    for (const id of ['cover', 'map', 'guide', 'level-meadow-ascent', 'level-shell-shore', 'open']) expect(a).toContain(`id="${id}"`);
    expect((a.match(/<!--plate:/g) || []).length).toBe((a.match(/<!--\/plate-->/g) || []).length);
    expect(a).toContain('id="gameworld-graph"');
  }, 120000);
});
