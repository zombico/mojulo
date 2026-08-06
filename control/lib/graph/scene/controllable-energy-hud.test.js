import { describe, expect, it } from 'vitest';

import { emitThreeWorld } from './scene-three.js';

const floor = () => ({
  corners: [[-10, -10, 0], [10, -10, 0], [10, 10, 0], [-10, 10, 0]],
  fill: '#333333',
});

describe('controllable energy weapon HUD', () => {
  it('emits the energy charge ring path and reticle readiness ring for energy weapons', () => {
    const html = emitThreeWorld({
      faces: [floor()],
      entities: [{
        id: 'mk2',
        rule: { type: 'platform', eye: 0 },
        transform: { pos: [0, 0, 0], heading: 0 },
        weapon: {
          fireClass: 'sight', magazine: 99, cooldown: 2,
          energyMax: 100, energyCost: 45, energyRegen: 10, energyOverheatRegen: 10,
          chargeTime: 0.5,
        },
      }],
      audio: { weapon: { shot: { type: 'thump' }, charge: { type: 'sweep' }, chargedShot: { type: 'thump' } } },
      camera: { rule: 'follow', target: 'mk2' },
    });
    expect(html).toContain('W.energyMax > 0');
    expect(html).toContain('OVERHEAT');
    expect(html).toContain('W.energyLock');
    expect(html).toContain('id="__rstat"');
    expect(html).toContain('id="__rcharge"');
    expect(html).toContain('id="__rchgReady"');
    expect(html).toContain('function __retStatus');
    expect(html).toContain('function __retCharge');
    expect(html).toContain('W.cooldownT / __cdMax');
    expect(html).toContain('W.chargeReady');
    expect(html).toContain('chargeCount');
    expect(html).toContain('chargedShot');
  });
});
