import { describe, it, expect } from 'vitest';
import { blockFires, NEVER, FIRE_MAX_SOURCES, resolveFire } from './fire.js';
import { fireChannelScript } from '../scene/channels/fire.js';
import { firePageChannel } from './fire.js';
import { blockMatter, MATTER_IDS, MATTER, isCombustible } from '../rupa/matter.js';
import { rupaPhysics } from '../rupa/index.js';

const burner = MATTER_IDS.find((k) => isCombustible(MATTER[k]));
const blk = (id, min, max, spec = burner) => ({ id, min, max, ...blockMatter({ min, max }, spec) });

describe('a block\'s fire: the flame library on what burns', () => {
  it('its flame stands by Heskestad\'s law from the heat its burning gives, the runtime\'s own', () => {
    const b = blk('log', [0, 0, 0], [1, 0.6, 0.4]), [f] = blockFires([b]);
    const want = rupaPhysics.flameOf(b.burnRate, rupaPhysics.footD(b)).L;
    expect(f.L).toBeCloseTo(want, 3);
    expect(f).toMatchObject({ kind: 'block', rupa: 'log', smoke: 0, at: [0.5, 0.3, 0.4] });
    // a campfire's numbers: 60 kW on half a metre stands about as tall as the library's campfire
    expect(rupaPhysics.flameOf(6e4, 0.55).L).toBeCloseTo(resolveFire({ sources: [{ kind: 'campfire', at: [0, 0] }] }).sources[0].L, 0);
  });

  it('it is off until its block catches; a block that cannot burn has none', () => {
    const [f, ...rest] = blockFires([blk('log', [0, 0, 0], [1, 0.6, 0.4]), blk('wall', [2, 0, 0], [3, 1, 1], 'brick')]);
    expect(f.life.start).toBe(NEVER);
    expect(rest).toEqual([]);
    expect(blockFires(Array.from({ length: 100 }, (_, i) => blk(`c${i}`, [i, 0, 0], [i + 0.5, 0.5, 0.5])), { from: 10 })).toHaveLength(FIRE_MAX_SOURCES - 10);
  });

  it('a bigger fire stands taller and lights farther, its light held short of whiting out what stands by it', () => {
    const [small, big] = blockFires([blk('a', [0, 0, 0], [0.3, 0.3, 0.3]), blk('b', [0, 0, 0], [2, 2, 2])]);
    expect(big.L).toBeGreaterThan(small.L);
    expect(big.light).toBeGreaterThanOrEqual(small.light);
    expect(big.light).toBeLessThanOrEqual(30);
  });

  it('the page lights a block\'s fire from the runtime only where there is one; other fire pages keep their bytes', () => {
    const torch = firePageChannel(resolveFire({ sources: [{ kind: 'torch', at: [0, 0, 1] }] }));
    const plain = fireChannelScript(torch);
    expect(plain).not.toContain('BLOCK FIRES');
    expect(plain).not.toContain('__fireRupaAir');
    const withBlock = fireChannelScript({ ...torch, sources: [...torch.sources, ...blockFires([blk('log', [0, 0, 0], [1, 0.6, 0.4])], { from: 1 })] });
    expect(withBlock).toContain('BLOCK FIRES');
    expect(withBlock).toContain('__fireRupaAir');
  });
});
