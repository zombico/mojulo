import { describe, expect, it } from 'vitest';

import { resolveWorldScene } from '../worlds/world-scene.js';
import { emitThreeWorld } from '../scene/scene-three.js';

// ── G1: the `game:` manifest channel (game-metacontext.plan.md) ────────────────
// A level = world recipe + contract. The channel is additive (absent ⇒ byte-identical
// emit), contract faults fail the MINT (authoring error, not a player error), and the
// bridge stays present in capture runs so completability audits can read the envelope.

const sketch = (manifest) => ({ manifest, title: 'test' });

const CONTRACT = {
  levelRef: 'orbit-1',
  consumes: [{ slice: 'bag', pick: { max: 2 } }],
  produces: { events: [{ type: 'grant', slice: 'bag', max: 3 }] },
  presets: { default: { bag: { items: { potion: 1 } } } },
  on: { 'goal:*': { end: 'success' } },
};

describe('world-scene — game channel passthrough', () => {
  it('normalizes a valid contract onto payload.game', async () => {
    const out = await resolveWorldScene(sketch({ kind: 'orbit-view', scenario: 'circular', game: CONTRACT }));
    expect(out.payload.game.levelRef).toBe('orbit-1');
    expect(out.payload.game.produces.results).toEqual(['success', 'fail', 'abort']);   // normalized default
    expect(out.payload.game.presets.default).toBeTruthy();
  });

  it('leaves the payload untouched when no game channel is declared', async () => {
    const out = await resolveWorldScene(sketch({ kind: 'orbit-view', scenario: 'circular' }));
    expect(out.payload.game).toBeUndefined();
  });

  it('fails the mint loudly on a bad contract (teaching error, listing every fault)', async () => {
    await expect(resolveWorldScene(sketch({
      kind: 'orbit-view', scenario: 'circular',
      game: { produces: { events: [{ type: 'explode', slice: 'bag' }] } },
    }))).rejects.toThrow(/levelRef is required[\s\S]*not a typed event/);
  });
});

describe('emitThreeWorld — the __mojGame bridge', () => {
  const base = { faces: [{ pts: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], color: '#888' }], cameras: [] };

  it('emits the bridge with the contract inlined when game is present', () => {
    const html = emitThreeWorld({ ...base, game: CONTRACT });
    expect(html).toContain('window.__mojGame');
    expect(html).toContain('"levelRef":"orbit-1"');
    expect(html).toContain('game-outcome');
    expect(html).toContain('game-ready');
  });

  it('emits NO game BRIDGE when game is absent (byte-identical posture)', () => {
    const html = emitThreeWorld(base);
    // the capture probe carries a guarded `if (window.__mojGame)` read in every world (harmless,
    // inert without a bridge) — what must be absent is the bridge itself and its wire protocol.
    expect(html).not.toContain('game channel (level contract bridge');
    expect(html).not.toContain('game-ready');
    expect(html).not.toContain('game-outcome');
  });

  it('keeps the bridge in capture runs (unlike audio) so audits can read the envelope', () => {
    const html = emitThreeWorld({ ...base, game: CONTRACT, capture: true });
    expect(html).toContain('window.__mojGame');
    // audio is the contrast case: never emitted on capture
    const withAudio = emitThreeWorld({ ...base, capture: true, audio: { soundtrack: null, wind: true } });
    expect(withAudio).not.toContain('beats audio channel');
  });
});
