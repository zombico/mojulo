// Isolate to in-memory SQLite before any import that pulls db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect } from 'vitest';
import { composeWorld, composeWorldHandler } from './compose-world.js';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { emitThreeWorld } from '@/lib/graph/scene/scene-three';

// Weather is kind-generic (world-scene.js resolves manifest.weather for every kind), so the front door takes it on any
// base: read eagerly (a bad climate refuses the mint, teaching), stamped when the base's whitelist drops it, and the
// stored world opens with the channel on the page.
describe('compose_world weather passthrough', () => {
  const base = { base: 'transport-hub', seed: 7 };
  it('absent ⇒ not stored, no note', () => {
    const r = composeWorld({ ...base, overrides: { mode: 'subway' } });
    expect(r.recipe.weather).toBeUndefined();
    expect(r.note).toBeUndefined();
  });

  it('a climate, or a tuned one, is stored on the recipe and in the sketch row, and is not flagged as ignored', () => {
    const w = { climate: 'monsoon', surface: 'tin', air: { cast: 0.5 } };
    const r = composeWorld({ ...base, overrides: { mode: 'subway', weather: w, audio: { weather: true } } });
    expect(r.recipe.weather).toEqual(w);
    expect(r.recipe.audio).toEqual({ weather: true });
    expect(r.note).toBeUndefined();
    expect(SketchRepository.getByRef(r.ref).manifest.weather).toEqual(w);
  });

  it('a weather it cannot read refuses the mint and says what the climates are', () => {
    expect(() => composeWorld({ ...base, overrides: { mode: 'subway', weather: 'sleet' } })).toThrow(/neither a climate.*get_view_vocab\(\{ id: 'weather' \}\)/s);
    expect(() => composeWorld({ ...base, overrides: { mode: 'subway', weather: { climate: { hail: 1 } } } })).toThrow(/not a state/);
  });

  it('the minted world opens: the stored sketch resolves and its page carries the sky', async () => {
    const r = await composeWorldHandler({ ...base, overrides: { mode: 'subway', weather: 'storm-coast' } });
    const { payload } = await resolveWorldScene(SketchRepository.getByRef(r.ref));
    expect(payload.weather.weather.climate).toMatchObject({ fog: 2, thunderstorm: 1.5 });
    expect(emitThreeWorld(payload)).toContain('window.__mojWeather');
  });
});
