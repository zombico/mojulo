// The gait mint tables reach the recipes through the tools that author them: a figure minted with a walk, a walk given
// to a figure by update_sketch, and a hero door motion are stored by value (motion-stamp.js); an edit that leaves the
// motion alone keeps it as stored.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { createFigureHandler } from './figure.js';
import { updateSketchHandler } from './sketches.js';
import { mintSolidHandler } from './mint-solid.js';
import { WALK_MINT, WAVE_MINT, EMOTE_MINT } from '@/lib/graph/polygonizer/figure-posing.js';
import { MOTION_GAITS } from '@/lib/graph/polygonizer/hero-motion.js';
import { HERO_WALK } from '@/lib/graph/polygonizer/hero-gaits.js';

beforeEach(() => { closeDb(); });

describe('gaits are stored by value where they are authored', () => {
  it('create_figure stores a walk with every dial of the mint table', async () => {
    await createFigureHandler({ title: 'Walker', ref: 'ms-walk', motion: { walk: { lean: 0.1 } }, animate: false });
    expect(SketchRepository.getByRef('ms-walk').manifest.motion).toEqual({ walk: { ...WALK_MINT, lean: 0.1 } });
  });

  it('create_figure stores the wave and the bow with their loop in seconds', async () => {
    await createFigureHandler({ title: 'Waver', ref: 'ms-wave', motion: 'wave', animate: false });
    expect(SketchRepository.getByRef('ms-wave').manifest.motion).toEqual({ wave: { ...WAVE_MINT } });
    await createFigureHandler({ title: 'Bower', ref: 'ms-bow', motion: 'bow', animate: false });
    expect(SketchRepository.getByRef('ms-bow').manifest.motion).toEqual({ emote: 'bow', ...EMOTE_MINT.bow });
  });

  it('update_sketch stamps a walk an edit gives a figure, and leaves a walk an edit did not touch as stored', async () => {
    await createFigureHandler({ title: 'Stander', ref: 'ms-edit', animate: false });
    await updateSketchHandler({ ref: 'ms-edit', patch: [{ op: 'set', path: '/motion', value: 'walk' }] });
    expect(SketchRepository.getByRef('ms-edit').manifest.motion).toEqual({ walk: { ...WALK_MINT } });

    // a row stored before the mint tables (a bare 'walk'), edited elsewhere: its walk stays the word it was
    SketchRepository.update({ ref: 'ms-edit', title: 'Stander', manifest: { ...SketchRepository.getByRef('ms-edit').manifest, motion: 'walk' } });
    await updateSketchHandler({ ref: 'ms-edit', patch: [{ op: 'set', path: '/view', value: 'lateral' }] });
    const after = SketchRepository.getByRef('ms-edit').manifest;
    expect(after.view).toBe('lateral');
    expect(after.motion).toBe('walk');
  }, 120_000);

  it('the hero door gives a new hero the calibrated walk when it brings none, stored by value', async () => {
    expect((await mintSolidHandler({ kind: 'layered', via: 'hero', ref: 'ms-hero-bare', spec: { cast: 'female' } })).ok).toBe(true);
    const stored = SketchRepository.getByRef('ms-hero-bare').manifest;
    expect(stored.hero.motion.walk).toEqual({ ...WALK_MINT, ...HERO_WALK, seconds: MOTION_GAITS.walk.seconds, tilt: MOTION_GAITS.walk.tilt });
    expect(stored.recipe.locomotion.walk.spec.walk).toMatchObject({ stepWidth: WALK_MINT.stepWidth, ...HERO_WALK });
  }, 120_000);

  it('the hero door stores its gaits with the mint table, the gait base, seconds and tilt', async () => {
    const out = await mintSolidHandler({ kind: 'layered', via: 'hero', ref: 'ms-hero', spec: { cast: 'male', motion: { walk: true, jog: { tilt: 12 } } } });
    expect(out.ok).toBe(true);
    const motion = SketchRepository.getByRef('ms-hero').manifest.hero.motion;
    expect(motion.walk).toEqual({ ...WALK_MINT, ...HERO_WALK, seconds: MOTION_GAITS.walk.seconds, tilt: MOTION_GAITS.walk.tilt });
    expect(motion.jog).toMatchObject({ ...MOTION_GAITS.jog.base, tilt: 12, seconds: MOTION_GAITS.jog.seconds });
  }, 120_000);
});
