import { describe, expect, it } from 'vitest';

import { decorateMechanics, mergeDecorFx, formForItem } from './mechanic-decor.js';

describe('formForItem — item → glyph form heuristic', () => {
  it('maps by keyword, defaults to gem', () => {
    expect(formForItem('coin')).toBe('coin');
    expect(formForItem('gold-bar')).toBe('coin');
    expect(formForItem('ruby')).toBe('gem');
    expect(formForItem('rune-key')).toBe('key');
    expect(formForItem('health-potion')).toBe('heart');
    expect(formForItem('power-star')).toBe('star');
    expect(formForItem('mana')).toBe('orb');
    expect(formForItem('widget')).toBe('gem');      // unknown → gem
    expect(formForItem(undefined)).toBe('gem');
  });
});

describe('decorateMechanics (game-ui-language U5)', () => {
  it('decorates collect: glyph pickups + float + sparkle + burst-on-zone + marker suppression', () => {
    const d = decorateMechanics([
      { kind: 'collect', pickups: [{ item: 'coin', at: [0, 0, 0] }, { item: 'gem', at: [3, 3, 0] }] },
    ]);
    // one glyph entity per pickup, form by item, static clock rule
    expect(d.entities).toHaveLength(2);
    expect(d.entities[0]).toMatchObject({ id: 'dec_pk_0_0', body: { type: 'glyph', form: 'coin' }, rule: { type: 'clock', rate: 0 } });
    expect(d.entities[1].body.form).toBe('gem');
    // float states + burst bindings keyed by the collect ZONE id (matched via ev.source)
    expect(d.fx.states).toEqual({ dec_pk_0_0: 'float', dec_pk_0_1: 'float' });
    expect(d.fx.on.pk_0_0).toEqual({ gesture: 'burst', target: 'dec_pk_0_0' });
    expect(d.fx.on.pk_0_1).toEqual({ gesture: 'burst', target: 'dec_pk_0_1' });
    // a sparkle per pickup + the box markers to suppress
    expect(d.sfx.filter((s) => s.verb === 'sparkle')).toHaveLength(2);
    expect(d.suppress).toEqual(['pk_0_0', 'pk_0_1']);
  });

  it('decorates reach-exit with a flag + green beacon aura', () => {
    const d = decorateMechanics([{ kind: 'reach-exit', at: [6, 0, 0] }]);
    expect(d.entities[0]).toMatchObject({ id: 'dec_exit_0', body: { type: 'glyph', form: 'flag' } });
    const aura = d.sfx.find((s) => s.verb === 'aura');
    expect(aura.at).toEqual([6, 0, 0]);
    expect(aura.color[1]).toBeGreaterThan(aura.color[0]);   // green-dominant
  });

  it('decorates hazard-damage with a red aura per hazard, no entity', () => {
    const d = decorateMechanics([{ kind: 'hazard-damage', hazards: [{ at: [0, 4, 0] }, { at: [2, 2, 0] }] }]);
    expect(d.entities).toHaveLength(0);
    const reds = d.sfx.filter((s) => s.verb === 'aura');
    expect(reds).toHaveLength(2);
    expect(reds[0].color[0]).toBeGreaterThan(reds[0].color[1]);   // red-dominant
  });

  it('ignores stateful mechanics (survive / fail-on-death) — no spatial decoration', () => {
    const d = decorateMechanics([{ kind: 'survive', seconds: 30 }, { kind: 'fail-on-death' }]);
    expect(d.entities).toHaveLength(0);
    expect(d.sfx).toHaveLength(0);
    expect(Object.keys(d.fx.states)).toHaveLength(0);
  });
});

describe('mergeDecorFx — hand fx wins over decoration', () => {
  it('unions states + on with hand keys overriding', () => {
    const merged = mergeDecorFx(
      { states: { dec_pk_0_0: 'shimmer' }, on: { pk_0_0: 'ghost' } },   // hand
      { states: { dec_pk_0_0: 'float', dec_pk_0_1: 'float' }, on: { pk_0_0: { gesture: 'burst', target: 'x' }, pk_0_1: { gesture: 'burst', target: 'y' } } },  // decor
    );
    expect(merged.states.dec_pk_0_0).toBe('shimmer');   // hand wins
    expect(merged.states.dec_pk_0_1).toBe('float');     // decor kept
    expect(merged.on.pk_0_0).toBe('ghost');             // hand wins
    expect(merged.on.pk_0_1).toEqual({ gesture: 'burst', target: 'y' });
  });
  it('returns null when both empty', () => {
    expect(mergeDecorFx(null, { states: {}, on: {} })).toBeNull();
  });
});
