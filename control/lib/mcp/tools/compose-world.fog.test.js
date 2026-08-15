// Isolate to in-memory SQLite before any import that pulls db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect } from 'vitest';
import { composeWorld, composeWorldHandler } from './compose-world.js';
import { planSubwayStation } from '@/lib/graph/architecture/subway-station';

// Fog opt-in through the compose_world front door (0813 first-contact reports):
// absent ⇒ not stored ⇒ no fog (the renderer's contract); `true` or a tuning
// object ⇒ stored; invalid shapes (fog: 100) ⇒ dropped AND surfaced in the
// soft ignored-keys note instead of vanishing silently.

describe('compose_world fog/audio passthrough', () => {
  it('subway-station: fog defaults to absent (no fog)', () => {
    const r = composeWorld({ base: 'transport-hub', seed: 7, overrides: { mode: 'subway', atmosphere: true } });
    expect(r.recipe.fog).toBeUndefined();
    expect(r.recipe.audio).toBeUndefined();
    expect(r.note).toBeUndefined();
  });

  it('subway-station: fog:true and audio pass through to the stored recipe', () => {
    const r = composeWorld({
      base: 'transport-hub', seed: 7,
      overrides: { mode: 'subway', atmosphere: true, fog: true, audio: { wind: true } },
    });
    expect(r.recipe.fog).toBe(true);
    expect(r.recipe.audio).toEqual({ wind: true });
    expect(r.note).toBeUndefined();
  });

  it('subway-station: a fog tuning object passes through', () => {
    const r = composeWorld({
      base: 'transport-hub', seed: 7,
      overrides: { mode: 'subway', fog: { density: 0.8, height: 2 } },
    });
    expect(r.recipe.fog).toEqual({ density: 0.8, height: 2 });
  });

  it('subway-station: invalid fog (fog: 100) is dropped AND flagged in the note', () => {
    const r = composeWorld({
      base: 'transport-hub', seed: 7,
      overrides: { mode: 'subway', fog: 100 },
    });
    expect(r.recipe.fog).toBeUndefined();
    expect(r.note).toMatch(/fog/);
  });

  it('city: fog:true passes through (fractal-city already has a fogBoxes extractor)', () => {
    const r = composeWorld({ base: 'city', seed: 7, overrides: { fog: true } });
    expect(r.recipe.fog).toBe(true);
  });

  it('unknown override keys are flagged in the soft note', () => {
    const r = composeWorld({ base: 'city', seed: 7, overrides: { bogus_knob: 1 } });
    expect(r.note).toMatch(/bogus_knob/);
  });
});

// R3 (0813 persona sims): manifest.audio is kind-generic at render, but only the
// city/transport-hub mints whitelisted it — on every other base a documented
// overrides.audio vanished silently. The composeWorld seam now validates audio
// eagerly for all bases and stamps it onto the minted manifest when the base's
// own whitelist didn't carry it.
describe('compose_world audio door (all bases)', () => {
  const DUNGEON = {
    chambers: [
      { id: 'hub', at: [0, 0], elevation: 0, radius: 7, height: 9 },
      { id: 'west', at: [-17, 5], elevation: -2.5, radius: 6, height: 8 },
    ],
    tunnels: [{ from: 'hub', to: 'west', style: 'corridor' }],
  };

  it('dungeon (no in-mint audio whitelist): audio lands in the STORED manifest', async () => {
    const { SketchRepository } = await import('@/lib/db/repositories/sketches.js');
    const r = composeWorld({
      base: 'dungeon', seed: 3,
      overrides: { ...DUNGEON, audio: { wind: true, footsteps: true } },
    });
    expect(r.recipe.audio).toEqual({ wind: true, footsteps: true });
    expect(r.note).toBeUndefined();
    const stored = SketchRepository.getByRef(r.ref);
    expect(stored.manifest.audio).toEqual({ wind: true, footsteps: true });
  });

  it('non-object audio refuses the mint with a pointer to the vocabulary', () => {
    expect(() =>
      composeWorld({ base: 'dungeon', seed: 3, overrides: { ...DUNGEON, audio: 100 } }),
    ).toThrow(/overrides\.audio must be an object/);
  });

  it('an unknown beats ref refuses the mint instead of storing a 500-rendering world', () => {
    expect(() =>
      composeWorld({
        base: 'dungeon', seed: 3,
        overrides: { ...DUNGEON, audio: { soundtrack: { beatsRef: 'no-such-groove' } } },
      }),
    ).toThrow(/no-such-groove/);
  });

  it('transport-hub keeps its own in-mint audio door (no double-stamp)', () => {
    const r = composeWorld({
      base: 'transport-hub', seed: 7,
      overrides: { mode: 'subway', audio: { wind: true } },
    });
    expect(r.recipe.audio).toEqual({ wind: true });
  });
});

// R1 validator half (0813 persona sims): the recipe layer was permissive where the
// renderer is not — fog:{color:'#hex'} stored ok:true and the world link opened
// HTTP 500. The tools/call front door now resolves the stored sketch through the
// world registry before answering, and unmints on failure.
describe('compose_world render validation at mint (ok:true ⇒ the link opens)', () => {
  it("Maya's shape — fog:{color:'#hex'} — refuses the mint and keeps NOTHING", async () => {
    const { SketchRepository } = await import('@/lib/db/repositories/sketches.js');
    const before = new Set(SketchRepository.list().sketches?.map?.((s) => s.ref) ?? []);
    await expect(composeWorldHandler({
      base: 'transport-hub', seed: 7,
      overrides: { mode: 'subway', atmosphere: true, fog: { density: 0.6, color: '#9db4ff' } },
    })).rejects.toThrow(/failed render validation and was NOT kept/);
    const after = SketchRepository.list().sketches?.map?.((s) => s.ref) ?? [];
    for (const ref of after) expect(before.has(ref)).toBe(true); // nothing new survived
  });

  it('a valid mint still answers ok through the same door', async () => {
    const r = await composeWorldHandler({
      base: 'transport-hub', seed: 7,
      overrides: { mode: 'subway', atmosphere: true, fog: true },
    });
    expect(r.ref).toBeTruthy();
    expect(r.recipe.fog).toBe(true);
  });
});

describe('subway-station fog occluders', () => {
  it('planSubwayStation exposes occluder boxes for the fogBoxes extractor', () => {
    const { occluders, faces } = planSubwayStation({ seed: 7, density: 0.6 });
    expect(Array.isArray(occluders)).toBe(true);
    expect(occluders.length).toBeGreaterThan(0);
    for (const b of occluders.slice(0, 5)) {
      expect(b).toMatchObject({
        x: expect.any(Number), y: expect.any(Number),
        w: expect.any(Number), d: expect.any(Number),
        z0: expect.any(Number), z1: expect.any(Number),
      });
      expect(b.z1).toBeGreaterThanOrEqual(b.z0);
    }
    // determinism spot-check: occluder collection must not perturb the face stream
    const again = planSubwayStation({ seed: 7, density: 0.6 });
    expect(again.faces.length).toBe(faces.length);
    expect(again.occluders.length).toBe(occluders.length);
  });
});
