// Isolate to an in-memory SQLite — must run before any import that pulls in
// db/index.js. Same pattern as create-view.test.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { composeWorld } from './compose-world.js';
import { mintDungeon } from './scene-dungeon.js';
import { resolveWorldScene, WALK_KINDS } from '@/lib/graph/worlds/world-scene';
import { WORLD_KINDS } from '@/lib/graph/worlds/world-kinds';
import { classifyBucket, sketchRenderMode, WORLD_RENDER_KINDS } from '@/lib/graph/sketch/sketch-manifest';

beforeEach(() => {
  closeDb();
});

// A small dungeon: the spike's hub-and-spokes trimmed to two chambers + one corridor.
const OVERRIDES = {
  chambers: [
    { id: 'hub', at: [0, 0], elevation: 0, radius: 7, height: 9 },
    { id: 'west', at: [-17, 5], elevation: -2.5, radius: 6, height: 8 },
  ],
  tunnels: [{ from: 'hub', to: 'west', style: 'corridor' }],
  lighting: { ambient: 0.2, fireIntensity: 1.7, gain: 1.55 },
};

describe('dungeon — registry membership (mintable, walkable, exportable)', () => {
  it('is a WORLD_KINDS row with the walk capability, in WALK_KINDS, and world-bucketed', () => {
    expect(WORLD_KINDS.dungeon).toBeDefined();
    expect(WORLD_KINDS.dungeon.walk).toBe(true);
    expect(WALK_KINDS.has('dungeon')).toBe(true);
    // export_model eligibility IS registry membership: /model.glb resolves the same payload.
    expect(WORLD_RENDER_KINDS.includes('dungeon')).toBe(true);
    expect(classifyBucket({ kind: 'dungeon' })).toBe('world');
    expect(sketchRenderMode({ kind: 'dungeon' })).toBe('world');
  });
});

describe('dungeon — compose_world base (identity adapter)', () => {
  it('mints a small dungeon with overrides as the param channel', () => {
    const res = composeWorld({ base: 'dungeon', overrides: OVERRIDES, title: 'smoke dungeon' });
    expect(res.ok).toBe(true);
    expect(res.base).toBe('dungeon');
    expect(res.recipe.kind).toBe('dungeon');
    expect(res.recipe.chambers).toHaveLength(2);
    expect(res.stats.chambers).toBe(2);
    expect(res.stats.tunnels).toBe(1);
    expect(res.stats.faces).toBeGreaterThan(0);
    expect(res.worldUrl).toMatch(/\/world$/);
    // both chambers have an exit → the advisory flow check is clean (and never gates).
    expect(res.advisory.ok).toBe(true);
  });

  it('fails at mint, not render: empty chambers and a tunnel to an unknown chamber both throw', () => {
    expect(() => mintDungeon({ chambers: [] })).toThrow(/chambers/);
    expect(() => mintDungeon({
      chambers: [{ id: 'hub' }],
      tunnels: [{ from: 'hub', to: 'nowhere' }],
    })).toThrow(/unknown chamber/);
  });

  it('a sealed chamber is ADVISORY — minted anyway, flagged in the readout', () => {
    const res = mintDungeon({ chambers: [{ id: 'lone', at: [0, 0] }] });
    expect(res.ok).toBe(true);
    expect(res.advisory.ok).toBe(true);                       // preferential, not necessary
    expect(res.advisory.preferential.some((p) => p.rule === 'sealed-chamber')).toBe(true);
    expect(res.note).toMatch(/Minted anyway/);
  });
});

describe('dungeon — resolveWorldScene payload', () => {
  it('resolves a kind:dungeon manifest to a walkable World payload (faces + cameras + walk)', async () => {
    const { payload, kind } = await resolveWorldScene({
      ref: 'sk_dungeon_test', title: null,
      manifest: { kind: 'dungeon', ...OVERRIDES },
    });
    expect(kind).toBe('dungeon');
    expect(payload).toBeTruthy();
    expect(Array.isArray(payload.faces) && payload.faces.length > 0).toBe(true);
    // padTrianglesForWorld ran: the World mesh builder skips < 4-corner faces.
    expect(payload.faces.every((f) => f.corners.length >= 4)).toBe(true);
    expect(Array.isArray(payload.cameras) && payload.cameras.length > 0).toBe(true);
    expect(payload.walk && Array.isArray(payload.walk.spawn)).toBe(true);
    expect(payload.title).toBe('mojulo dungeon');
  });

  it('resolves deterministically (same recipe twice → identical face list)', async () => {
    const sketch = { ref: 'sk_dungeon_det', title: null, manifest: { kind: 'dungeon', ...OVERRIDES } };
    const a = await resolveWorldScene(sketch);
    const b = await resolveWorldScene(sketch);
    expect(JSON.stringify(a.payload.faces)).toBe(JSON.stringify(b.payload.faces));
  });
});
