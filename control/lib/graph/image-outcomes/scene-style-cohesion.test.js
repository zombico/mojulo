// Scene cohesion via a shared, MCP-authorable style source.
//   A — style is authorable three ways (preset / preset+overrides / custom inline)
//       and carries a stable styleId token.
//   B — keyframe clips declare a style that reaches the cel instructions.
//   C — the scene-motion plate is painted in the same style (explicit, or
//       inherited from the lead cast clip at mint).
process.env.SQLITE_PATH = ':memory:';

import { describe, it, expect } from 'vitest';
import { resolveStyleMaterial, computeStyleId } from './styles.js';
import {
  normalizeImageOutcomesManifest,
  KIND_KEYFRAME_ANIMATION,
  KIND_SCENE_MOTION,
} from './manifest.js';
import { keyframeInstructions, sceneStageInstructions } from './instructions.js';
import { createSketchHandler, getStyleVocabHandler } from '@/lib/mcp/tools/sketches';
import { SketchRepository } from '@/lib/db/repositories/sketches';

const DEFAULTS = { style: 'd', mood: 'd', lighting: 'd', negative: [] };

describe('A — authorable style + styleId', () => {
  it('preset → styleId from preset+dials, lock from the preset', () => {
    const m = resolveStyleMaterial({ preset: 'steamboat' }, DEFAULTS);
    expect(m.preset).toBe('steamboat');
    expect(m.styleId).toBe('steamboat');
    expect(m.lock.length).toBeGreaterThan(0);
  });

  it('preset + overrides forks the template (extra lock/negative, +ovr token)', () => {
    const m = resolveStyleMaterial(
      { preset: 'ukiyo-e', overrides: { lock: ['extra: gold leaf accents'], negative: ['no neon'] } },
      DEFAULTS,
    );
    expect(m.lock).toContain('extra: gold leaf accents');
    expect(m.negative).toContain('no neon');
    expect(m.styleId).toMatch(/^ukiyo-e.*\+ovr:/);
  });

  it('fully inline custom style (no preset) carries its own lock + custom:id token', () => {
    const m = resolveStyleMaterial(
      { id: 'my-watercolor', style: 'loose watercolor', lock: ['wet-on-wet washes'], negative: ['no hard outlines'] },
      DEFAULTS,
    );
    expect(m.preset).toBeUndefined();
    expect(m.styleId).toBe('custom:my-watercolor');
    expect(m.lock).toEqual(['wet-on-wet washes']);
    expect(m.style).toBe('loose watercolor');
  });

  it('custom without id → stable content-hash token; differs across material', () => {
    const a = resolveStyleMaterial({ style: 'gouache', lock: ['flat matte'] }, DEFAULTS);
    const b = resolveStyleMaterial({ style: 'gouache', lock: ['flat matte'] }, DEFAULTS);
    const c = resolveStyleMaterial({ style: 'gouache', lock: ['glossy'] }, DEFAULTS);
    expect(a.styleId).toMatch(/^custom#/);
    expect(a.styleId).toBe(b.styleId);
    expect(a.styleId).not.toBe(c.styleId);
  });

  it('re-resolving is idempotent (no lock doubling, stable token)', () => {
    const once = resolveStyleMaterial({ preset: 'gpen-shonen' }, DEFAULTS);
    const twice = resolveStyleMaterial(once, DEFAULTS);
    expect(twice.lock).toEqual(once.lock);
    expect(twice.styleId).toBe(once.styleId);
  });

  it('computeStyleId is freeform when nothing is declared', () => {
    expect(computeStyleId({})).toBe('freeform');
  });
});

describe('B — keyframe clips declare style', () => {
  const base = {
    kind: KIND_KEYFRAME_ANIMATION,
    title: 'courier walk',
    motion: 'walk',
    keys: 2,
    characters: [{ id: 'courier', description: 'lean courier, green cloak' }],
  };

  it('a declared preset reaches the cel Style Lock', () => {
    const m = { ...base, renderBrief: { preset: 'steamboat' } };
    const normalized = normalizeImageOutcomesManifest(m);
    expect(normalized.renderBrief.styleId).toBe('steamboat');
    const instr = keyframeInstructions(m, { target: 'key-0' });
    expect(instr).toContain('preset: steamboat');
    // compositing invariant survives in every style
    expect(instr).toContain('plain uniform pale field');
  });

  it('omitting style preserves the historical flat-cel default (no renderBrief)', () => {
    const normalized = normalizeImageOutcomesManifest(base);
    expect(normalized.renderBrief).toBeUndefined();
    const instr = keyframeInstructions(base, { target: 'key-0' });
    expect(instr).toContain('Flat cel animation style');
  });
});

describe('C — scene plate takes the cast style', () => {
  const sceneBase = (extra = {}) => ({
    kind: KIND_SCENE_MOTION,
    title: 'two on a rooftop',
    stage: { horizonY: 400, groundYRef: 700, plate: { width: 1536, height: 1024 } },
    cast: [{ id: 'a', clipRef: 'sk_missing_clip', markX: 0.5, depth: 1 }],
    shots: [{ span: [0, 2], cast: ['a'] }],
    ...extra,
  });

  it('an explicit scene renderBrief paints the plate in that style', () => {
    const m = sceneBase({ renderBrief: { preset: 'ukiyo-e' } });
    const normalized = normalizeImageOutcomesManifest(m);
    expect(normalized.renderBrief.styleId).toMatch(/^ukiyo-e/); // dial-suffixed token
    const plate = sceneStageInstructions(m, { target: 'plate' });
    expect(plate).toContain('## Style');
    expect(plate).toContain('preset: ukiyo-e');
  });

  it('no style + no resolvable cast clip → plate stays default (back-compat)', () => {
    const normalized = normalizeImageOutcomesManifest(sceneBase());
    expect(normalized.renderBrief).toBeUndefined();
    const plate = sceneStageInstructions(sceneBase(), { target: 'plate' });
    expect(plate).not.toContain('paint the background in THIS discipline');
  });
});

describe('C — inheritance at mint (handler)', () => {
  it('a scene with no style inherits the lead cast clip’s style', async () => {
    await createSketchHandler({
      title: 'watercolor courier',
      ref: 'kf_water',
      manifest: {
        kind: 'keyframe-animation',
        title: 'watercolor courier',
        motion: 'wave',
        keys: 2,
        characters: [{ id: 'courier', description: 'lean courier in a green cloak' }],
        renderBrief: { id: 'my-watercolor', style: 'loose watercolor', lock: ['wet-on-wet washes'], negative: ['no hard outlines'] },
      },
    });
    await createSketchHandler({
      title: 'rooftop scene',
      ref: 'scene_water',
      manifest: {
        kind: 'scene-motion',
        title: 'rooftop scene',
        stage: { horizonY: 400, groundYRef: 700, plate: { width: 1536, height: 1024 } },
        cast: [{ id: 'a', clipRef: 'kf_water', markX: 0.5, depth: 1 }],
        shots: [{ span: [0, 2], cast: ['a'] }],
      },
    });
    const scene = SketchRepository.getByRef('scene_water').manifest;
    expect(scene.plateStyleInheritedFrom).toBe('kf_water');
    expect(scene.renderBrief.styleId).toBe('custom:my-watercolor');
    expect(scene.renderBrief.style).toBe('loose watercolor');
  });
});

describe('get_style_vocab reader', () => {
  it('lists presets + the custom-authoring note when called with no id', async () => {
    const out = await getStyleVocabHandler({});
    expect(Array.isArray(out.presets)).toBe(true);
    expect(out.presets.find((p) => p.preset === 'photo-realism')).toBeTruthy();
    expect(out.note).toMatch(/custom style/i);
  });

  it('reads one preset in full with dial specs', async () => {
    const out = await getStyleVocabHandler({ id: 'louvrijks' });
    expect(out.preset).toBe('louvrijks');
    expect(out.lock.length).toBeGreaterThan(0);
    expect(out.dials).toHaveProperty('school');
  });

  it('rejects an unknown preset with the available list', async () => {
    await expect(getStyleVocabHandler({ id: 'nope' })).rejects.toThrow(/unknown card/);
  });
});
