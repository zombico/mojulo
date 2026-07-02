process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { mintActionWorld } from './scene-action-world.js';
import { buildLaserRange } from '@/lib/graph/worlds/games/laser-range';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';

beforeEach(() => { closeDb(); });

// the laser-range idiom recipe, expressed as a create_action_world INPUT (declarative), in the same
// order buildLaserRange composes it — so the tool's lowered `events` must come out identical.
function laserRangeInput() {
  const ttl = 2.0, seconds = 30, R = 8;
  const spawnPts = [
    [-5.5, 5.5, 1.3], [5.5, 5.5, 1.5], [-5.5, -5.5, 1.1],
    [5.5, -5.5, 1.4], [0, 6.5, 1.6], [-2.5, 1.5, 1.2], [3.0, -2.0, 1.4],
  ];
  const periods = [1.3, 0.9, 1.6, 1.1, 1.4, 1.0, 1.2];
  const ids = spawnPts.map((_, i) => 'sphere-' + i);
  const entities = spawnPts.map((p, i) => ({ id: ids[i], on: false, color: '#ff5a4d', radius: 0.5, position: p }));
  return {
    title: 'laser range',
    entities,
    idioms: [
      { kind: 'scoreCounter', name: 'score', label: 'Score' },
      { kind: 'countdownClock', var: 'time', from: seconds, gate: 'over', onZero: 'game-over', label: 'Time' },
      { kind: 'spawnOnHeartbeat', targets: ids, periods, pop: 'pop', field: 'target', gate: 'over', rise: false },
      { kind: 'ephemeralTarget', on: 'pop', ttl, field: 'target' },
      { kind: 'hitConfirm', on: 'fire', emit: 'shot', score: 'score' },
      { kind: 'gameOverFreeze', signal: 'game-over', gate: 'over', clear: ids },
    ],
    faces: buildLaserRange().faces,
    worldFraming: { cameraPosition: [0, -R - 4, 5], lookAt: [0, 0, 1.2], horizontalFov: 70 },
  };
}

describe('create_action_world mint', () => {
  it('lowers an idiom recipe to the SAME events manifest as the hand-written builder', () => {
    const out = mintActionWorld(laserRangeInput());
    // the MCP surface reaches byte-identical lowered rules as buildLaserRange's compose() call.
    expect(out.recipe.events).toEqual(buildLaserRange().events);
  });

  it('stores a live, non-bakeable controllable+events recipe and returns the world URL', () => {
    const out = mintActionWorld(laserRangeInput());
    expect(out.ok).toBe(true);
    expect(out.recipe.kind).toBe('controllable');
    expect(out.recipe.walk).toBe(true);
    expect(out.worldUrl).toBe(`/api/sketches/${encodeURIComponent(out.ref)}/world`);
    expect(out.stats.entities).toBe(7);
    expect(out.stats.idioms).toEqual(['scoreCounter', 'countdownClock', 'spawnOnHeartbeat', 'ephemeralTarget', 'hitConfirm', 'gameOverFreeze']);
    expect(out.stats.hud).toEqual(expect.arrayContaining(['score', 'time']));
    expect(out.stats.nonBakeable).toBe(true);
  });

  it('round-trips through resolveWorldScene to a live events+walk payload', async () => {
    const out = mintActionWorld(laserRangeInput());
    const sketch = SketchRepository.getByRef(out.ref);
    const { payload } = await resolveWorldScene(sketch);
    expect(payload.events).toEqual(buildLaserRange().events);
    expect(payload.walk).toBe(true);
    expect(payload.nonBakeable).toBe(true);
    expect(Array.isArray(payload.faces) && payload.faces.length).toBeTruthy();
  });

  it('keeps the manifest a recipe — no baked geometry beyond the declared stage', () => {
    const out = mintActionWorld({ idioms: [{ kind: 'scoreCounter', name: 'score' }], entities: [{ id: 'a', on: false }] });
    expect(out.recipe.faces).toBeUndefined();   // default floor built on render, not stored
    expect(out.recipe.events.entities).toEqual([{ id: 'a', on: false }]);
  });

  it('defaults walk to true but honors walk:false', () => {
    expect(mintActionWorld({ idioms: [{ kind: 'scoreCounter' }] }).recipe.walk).toBe(true);
    expect(mintActionWorld({ idioms: [{ kind: 'scoreCounter' }], walk: false }).recipe.walk).toBeUndefined();
  });

  it('rejects a world with no rules, props, or events', () => {
    expect(() => mintActionWorld({})).toThrow(/requires/);
    expect(() => mintActionWorld({ idioms: [], entities: [] })).toThrow(/requires/);
  });

  it('rejects an unknown idiom kind', () => {
    expect(() => mintActionWorld({ idioms: [{ kind: 'teleport' }] })).toThrow(/unknown kind/);
  });

  it('surfaces a var collision (two idioms claiming the same var) as an authoring error', () => {
    expect(() => mintActionWorld({ idioms: [{ kind: 'scoreCounter', name: 'score' }, { kind: 'scoreCounter', name: 'score' }] }))
      .toThrow(/var "score"/);
  });

  it('merges a raw events fragment through compose alongside idioms', () => {
    const out = mintActionWorld({
      idioms: [{ kind: 'scoreCounter', name: 'score' }],
      events: { vars: { lives: 3 }, hud: [{ var: 'lives', label: 'Lives' }] },
    });
    expect(out.recipe.events.vars).toEqual({ score: 0, lives: 3 });
    expect(out.stats.vars).toEqual(expect.arrayContaining(['score', 'lives']));
  });
});
