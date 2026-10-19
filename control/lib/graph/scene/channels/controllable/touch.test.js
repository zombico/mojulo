import { describe, it, expect } from 'vitest';
import { touchLayout, touchScript } from './touch.js';
import { controllableChannelScript } from './index.js';
import { DEVICES } from '../../../controls/devices.js';
import { SCHEMES } from '../../../controls/schemes.js';

const hero = (rule) => [{ id: 'hero', pilotable: true, rule, body: { type: 'none' }, transform: { pos: [0, 0, 0], heading: 0 } }];

describe('touch: a virtual pad laid out for the pilot and its camera, never for a genre', () => {
  it('reads the layout off the rule and the camera', () => {
    expect(touchLayout(hero({ type: 'platform', jumpSpeed: 6 }), { rule: 'follow' })).toEqual({ look: false, lane: false, jump: true, fire: false, lift: false });
    expect(touchLayout(hero({ type: 'platform', move: 'lane' }), { rule: 'side' }).lane).toBe(true);
    expect(touchLayout(hero({ type: 'walk' }), { rule: 'eye', mouseLook: true })).toMatchObject({ look: true, jump: false });
    expect(touchLayout(hero({ type: 'fly' }), { rule: 'follow' })).toMatchObject({ look: true, lift: true, jump: false });
    expect(touchLayout([...hero({ type: 'platform' }), { id: 'gun', weapon: { kind: 'ray' } }], { rule: 'follow' }).fire).toBe(true);
    expect(touchLayout([], null)).toEqual({ look: false, lane: false, jump: false, fire: false, lift: false });
  });

  it('its buttons sit at the pad\'s own positions, so the pilot scheme\'s gamepad bindings read them', () => {
    const bound = (id) => SCHEMES.pilot.actions.find((a) => a.id === id).bind.gamepad;
    expect(bound('jump')).toContain('south');
    expect(bound('kneel')).toContain('east');
    expect(bound('interact')).toContain('west');
    expect(bound('fire')).toContain('rt');
    const B = DEVICES.gamepad.buttons, s = touchScript({ look: true, lane: false, jump: true, fire: true, lift: false });
    expect(s).toContain(`__tButton('jump', ${B.south},`);
    expect(s).toContain(`__tButton('fire', ${B.rt},`);
    expect(s).toContain(`__tButton('use', ${B.west},`);
    expect(DEVICES.touch).toMatchObject({ driver: 'touch-virtual-pad', drives: 'gamepad' });
  });

  it('only a game made for a screen draws it: absent, the channel is as it was', () => {
    const ents = hero({ type: 'platform', jumpSpeed: 6 }), cam = { rule: 'follow', target: 'hero' };
    const plain = controllableChannelScript(ents, cam, {});
    const touch = controllableChannelScript(ents, cam, {}, { touch: true });
    expect(plain).not.toContain('__touchPad');
    expect(touch).toContain('function __touchPad()');
    expect(touch).toContain('const __virt = g === __tp;');
    expect(controllableChannelScript(ents, cam, {}, { touch: false })).toBe(plain);
  });
});
