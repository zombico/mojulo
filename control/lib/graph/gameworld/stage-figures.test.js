import { describe, it, expect } from 'vitest';
import { libraryFigure, fieldFigure, standRule, standing, stand, facing, composeExtras, PERSON_BODY } from './stage-figures.js';

describe('stage figures: one way to stand people on a stage', () => {
  it('a person on the library, its own moves over it; a body the library does not fit on its own clips', () => {
    const f = libraryFigure('gw-foe');
    expect(f).toMatchObject({ heroRef: 'gw-foe', library: 'quaternius-ual', clips: { forward: 'Walk_Loop' } });
    expect('moves' in f).toBe(false);
    expect(fieldFigure('gw-cast-a', { moves: { stagger: 'hitHigh' } })).toMatchObject({ library: 'quaternius-ual', moves: { stagger: 'hitHigh' } });
    expect(fieldFigure('gw-cast-wolf', { own: { idle: 'stand', forward: 'walk' } })).toEqual({ heroRef: 'gw-cast-wolf', walker: true, clips: { idle: 'stand', forward: 'walk' } });
  });

  it('one who stands: a static rule with a person\'s body after its own keys, its figure its id, facing a point', () => {
    expect(standRule({ speed: 2.2 })).toEqual({ type: 'static', speed: 2.2, ...PERSON_BODY });
    expect(Object.keys(standRule({ speed: 2.2 }))[1]).toBe('speed');
    const part = stand({ figures: {}, entities: [] }, 'keeper', libraryFigure('k'), [3, 4, 0], facing([3, 4], [0, 0]));
    expect(part.entities).toEqual([standing('keeper', [3, 4, 0], -2.214)]);
    expect(part.entities[0].body).toEqual({ type: 'figure-rig', figure: 'keeper' });
  });

  it('extras composed: none is null, one is itself, several merge in order', () => {
    expect(composeExtras(null, undefined)).toBeNull();
    const a = () => ({ figures: { a: 1 }, entities: [{ id: 'a' }], play: { cues: [{ id: 'x' }] }, mechanics: [{ kind: 'bag', slice: 'bag' }] });
    expect(composeExtras(null, a)).toBe(a);
    const b = () => ({ figures: { b: 1 }, entities: [{ id: 'b' }], play: { cues: [{ id: 'y' }] }, mechanics: [{ kind: 'bag', slice: 'bag' }, { kind: 'party', slice: 'party' }] });
    const m = composeExtras(a, b)({});
    expect(m.entities.map((e) => e.id)).toEqual(['a', 'b']);
    expect(m.play.cues.map((c) => c.id)).toEqual(['x', 'y']);
    expect(m.mechanics).toEqual([{ kind: 'bag', slice: 'bag' }, { kind: 'party', slice: 'party' }]);
  });
});
