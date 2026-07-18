// D1 regression — object-valued params (motion/animate/mint) can arrive
// JSON-stringified from some MCP clients because the inputSchema declared no
// object type. The handler now (a) declares a union type and (b) defensively
// parses a stringified object so the validators see the real shape. Without the
// fix, a `motion: {keyframes:[…]}` authored by an agent was serialized to a
// string and rejected as "not a valid motion", blocking custom figure motion.
process.env.SQLITE_PATH = ':memory:';

import { describe, it, expect } from 'vitest';
import { createFigureHandler, emoteFigureHandler } from './figure';
import { SketchRepository } from '@/lib/db/repositories/sketches';

describe('create_figure motion transport parse (D1)', () => {
  it('accepts a JSON-stringified keyframe motion object (the M3 blocker)', async () => {
    const out = await createFigureHandler({
      title: 'Think then point',
      ref: 'd1-keyframes',
      motion: '{"keyframes":[{"elbowR":20},{"elbowR":120,"spine":{"axial":0.2}}]}',
      animate: false,
    });
    expect(out.ok).toBe(true);
    const m = SketchRepository.getByRef('d1-keyframes').manifest.motion;
    expect(typeof m).toBe('object');
    expect(m.keyframes).toHaveLength(2);
  });

  it('accepts a JSON-stringified { emote } object', async () => {
    const out = await createFigureHandler({
      title: 'Nodder', ref: 'd1-emote', motion: '{"emote":"nod","intensity":1.2}', animate: false,
    });
    expect(out.ok).toBe(true);
    expect(SketchRepository.getByRef('d1-emote').manifest.motion).toEqual({ emote: 'nod', intensity: 1.2 });
  });

  it('still accepts a plain motion NAME string (not JSON)', async () => {
    const out = await createFigureHandler({ title: 'Walker', ref: 'd1-walk', motion: 'walk', animate: false });
    expect(out.ok).toBe(true);
    expect(SketchRepository.getByRef('d1-walk').manifest.motion).toBe('walk');
  });

  it('leaves a malformed JSON-looking string as a string → validator rejects it', async () => {
    await expect(createFigureHandler({ title: 'Broken', motion: '{keyframes:', animate: false }))
      .rejects.toThrow(/motion/);
  });

  it('emote_figure parses a stringified mint object', async () => {
    await createFigureHandler({ title: 'Base', ref: 'd1-mint-base', animate: false });
    const out = await emoteFigureHandler({
      ref: 'd1-mint-base', emote: 'point', mint: '{"ref":"d1-minted"}', animate: false,
    });
    expect(out.ok).toBe(true);
    expect(SketchRepository.getByRef('d1-minted')).toBeTruthy();
  });
});
