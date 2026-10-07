import { describe, it, expect } from 'vitest';
import { layLevel, readLevel } from './index.js';
import { assembleStageScene } from '../era/stage.js';

// the level graph (graph.js) laid out as one walk (sequential.js): the same pages the hand-written `after` chains build
const built = new Map();
const page = (m) => { const k = JSON.stringify(m); return built.get(k) || built.set(k, JSON.stringify(assembleStageScene(m))).get(k); };

const MEADOW = { heartbeat: 0.8, bumpiness: 0.6 };
const FORD = { run: 16, heartbeat: 0.85, bumpiness: 0.7, beats: ['pinch', 'landmark', 'crossing', 'pocket', 'pit', 'reveal'] };

describe('level graph', () => {
  it('reads a graph: node 0 is the root, the first node unless named; spawn is the root\'s entry unless it says', () => {
    const G = readLevel({ seed: 8, nodes: { meadow: { trail: MEADOW }, ford: { trail: FORD, seed: 33 } } });
    expect(G).toMatchObject({ layout: 'sequential', root: 'meadow', spawn: { node: 'meadow', at: 'entry' }, edges: [{ from: 'meadow', to: 'ford', kind: 'seam' }] });
    expect(G.nodes.ford).toMatchObject({ section: 'trail', kit: 'isekai-meadow', seed: 33 });
    expect(G.nodes.meadow.seed).toBe(8);
    // the root apart from the first listed, the spawn apart from the root
    const H = readLevel({ root: 'b', nodes: { a: { trail: true }, b: { trail: true } }, spawn: { node: 'a' } });
    expect(H.edges).toEqual([{ from: 'b', to: 'a', kind: 'seam' }]);
    expect(H.spawn).toEqual({ node: 'a', at: 'entry' });
  });

  it('says what is wrong', () => {
    const bad = (L, re) => expect(() => layLevel(L)).toThrow(re);
    bad({ nodes: {} }, /at least one/);
    bad({ nodes: { a: { trail: true } }, layout: 'spiral' }, /not a layout/);
    bad({ nodes: { a: { trail: true, meru: true } } }, /one section.*names trail and meru/);
    bad({ nodes: { a: { trail: { id: 'x' } } } }, /the graph owns it/);
    bad({ nodes: { a: { trail: { after: {} } } } }, /the graph owns it/);
    bad({ nodes: { A: { trail: true } } }, /short lower-case name/);
    bad({ nodes: { a: { trail: true } }, root: 'z' }, /root 'z' is not a node/);
    bad({ nodes: { a: { trail: true }, b: { trail: true } }, edges: [{ from: 'a', to: 'b', kind: 'zipline' }] }, /not an edge kind/);
    bad({ nodes: { a: { trail: true } }, spawn: { node: 'q' } }, /spawn.node 'q'/);
    bad({ nodes: { a: { trail: true }, b: { trail: true }, c: { trail: true } }, edges: [{ from: 'a', to: 'b' }, { from: 'a', to: 'c' }] }, /leads on to both/);
    bad({ nodes: { a: { trail: true }, b: { trail: true }, c: { trail: true } }, edges: [{ from: 'a', to: 'b' }] }, /'c' is not on the walk/);
    bad({ nodes: { a: { trail: true }, b: { trail: true } }, edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }] }, /the root 'a' follows 'b'/);
    bad({ nodes: { m: { meru: true }, t: { trail: true } } }, /nothing follows a meru yet/);
    bad({ nodes: { a: { trail: true }, b: { trail: true, kit: 'isekai-sakura' } } }, /a seam between looks is not drawn yet/);
  });

  it('a sequential level compiles to the `after` chain: meadow → ford → climb, as the trail test writes it', () => {
    const L = layLevel({ nodes: { meadow: { trail: MEADOW, seed: 8 }, ford: { trail: FORD, seed: 33 }, climb: { trail: true, seed: 5 } } });
    expect(L.order).toEqual(['meadow', 'ford', 'climb']);
    expect(L.stages.map((s) => s.manifest)).toEqual([
      { kind: 'stage', kit: 'isekai-meadow', seed: 8, trail: { id: 'meadow', ...MEADOW } },
      { kind: 'stage', kit: 'isekai-meadow', seed: 33, trail: { id: 'ford', ...FORD, after: { id: 'meadow', ...MEADOW, seed: 8 } } },
      { kind: 'stage', kit: 'isekai-meadow', seed: 5, trail: { id: 'climb', after: { id: 'ford', ...FORD, seed: 33, after: { id: 'meadow', ...MEADOW, seed: 8 } } } },
    ]);
  });

  it('a trail then a meru builds the pages a hand-written chain builds, byte for byte', () => {
    const L = layLevel({ seed: 8, nodes: { trail: { trail: true }, meru: { meru: true } } });
    const [trail, meru] = L.stages.map((s) => s.manifest);
    expect(page(trail)).toBe(page({ kind: 'stage', kit: 'isekai-meadow', seed: 8, trail: true }));
    expect(page(meru)).toBe(page({ kind: 'stage', kit: 'isekai-meadow', seed: 8, meru: { after: { trail: true } } }));
  }, 120000);

  it('a meru on another kit still follows the trail in the trail\'s own look', () => {
    const L = layLevel({ seed: 8, nodes: { path: { trail: true }, top: { meru: { preset: 'temple-pyramid' }, kit: 'isekai-garden' } } });
    expect(L.stages[1].manifest.meru.after).toEqual({ trail: { id: 'path' }, kit: 'isekai-meadow', seed: 8 });
    const top = JSON.parse(page(L.stages[1].manifest));
    expect(top.faces.length).toBeGreaterThan(0);
    expect(JSON.stringify(top)).toContain('out-trail:path');
  }, 120000);
});
