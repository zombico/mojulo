// emote_figure handler: validation + the mint path (derive a figure sketch
// carrying the emote as its motion). Same in-memory isolation as
// tool-descriptions.test.js — env must be set before any db import.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect } from 'vitest';

import { createFigureHandler, emoteFigureHandler } from './figure';
import { SketchRepository } from '@/lib/db/repositories/sketches';

describe('emote_figure', () => {
  it('validates ref, kind, and emote name', async () => {
    await expect(emoteFigureHandler({ ref: 'nope', emote: 'bow' })).rejects.toThrow(/not found/);
    const fig = await createFigureHandler({ title: 'Subject', ref: 'emote-subject', animate: false });
    await expect(emoteFigureHandler({ ref: fig.ref, emote: 'moonwalk' })).rejects.toThrow(/emote/);
    await expect(emoteFigureHandler({ ref: fig.ref, emote: 'bow', intensity: 9 })).rejects.toThrow(/intensity/);
  });

  it('mint derives a figure sketch carrying the emote as motion', async () => {
    const out = await emoteFigureHandler({
      ref: 'emote-subject', emote: 'bow', intensity: 1.2,
      mint: { ref: 'emote-subject-bow' }, animate: false,
    });
    expect(out.ok).toBe(true);
    const minted = SketchRepository.getByRef('emote-subject-bow');
    expect(minted.manifest.kind).toBe('figure');
    expect(minted.manifest.motion).toEqual({ emote: 'bow', intensity: 1.2 });
  });

  it('a world figures-map entry resolves a stored figure via figureRef', async () => {
    const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene');
    const sketch = (manifest) => ({ manifest, title: 'test' });
    const out = await resolveWorldScene(sketch({
      kind: 'orbit-view', scenario: 'circular',
      entities: [{ id: 'hero', rule: { type: 'walk' }, body: { type: 'figure-frames', figure: 'star' } }],
      figures: { star: { figureRef: 'emote-subject-bow', frames: 2 } },   // inherits the minted emote
    }));
    expect(out.payload.figures.star.length).toBe(2);
    expect(Array.isArray(out.payload.figures.star[0].faces)).toBe(true);
    await expect(resolveWorldScene(sketch({
      kind: 'orbit-view', scenario: 'circular',
      entities: [{ id: 'hero', rule: { type: 'walk' }, body: { type: 'figure-frames', figure: 'star' } }],
      figures: { star: { figureRef: 'no-such-figure' } },
    }))).rejects.toThrow(/figureRef/);
  });

  it('create_figure accepts emote names as motion', async () => {
    const out = await createFigureHandler({ title: 'Nodder', ref: 'emote-nodder', motion: 'nod', animate: false });
    expect(out.ok).toBe(true);
    expect(SketchRepository.getByRef('emote-nodder').manifest.motion).toBe('nod');
  });
}, 120_000);
