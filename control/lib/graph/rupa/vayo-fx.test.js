// THE EFFECTS ON THE FLOW (rupa/vayo-fx.js): a blast's parts each given the flow it has in the world, a power-up's aura
// turned into the air round its body; a composed effect style without `flow` keeps every byte.
import { describe, it, expect } from 'vitest';
import { flowExplosion, flowLook, roleOf } from './vayo-fx.js';
import { EXPLOSIONS } from '../playscape/elements/explosions.js';
import { LOOKS } from '../playscape/elements/elements.js';
import { styleExplosion, styleEvents } from '../scene/effect-style.js';
import { juiceFloor } from '../scene/juice-style.js';
import { momentScript } from '../scene/channels/moment-channel.js';
import { statusScript } from '../scene/channels/status-channel.js';
import { eventsChannelScript } from '../scene/channels/events.js';
import { controllableChannelScript } from '../scene/channels/controllable/index.js';

const roles = (X) => X.parts.map(roleOf);

describe('an explosion on the flow', () => {
  it('reads each part for what it is', () => {
    expect(roles(EXPLOSIONS.blast)).toEqual(['fire', 'glow', 'smoke', 'debris', 'sparks']);
    expect(roles(EXPLOSIONS.mushroom)[0]).toBe('stem');
    expect(roles(EXPLOSIONS.implode)[0]).toBe('implode');
  });

  it('a blast: a bold core and its hot heart, a plume, debris, a third of the sparks as cooling embers, and the ground ring as a dust skirt', () => {
    const X = EXPLOSIONS.blast, Y = flowExplosion(X), fire = X.parts[0];
    expect(Y.flow).toEqual({ size: 1.5 });                                // the fireball's reach (the preset's 1.5 m: its body was three quarters of it)
    expect(Y.parts.map((p) => p.flow)).toEqual(['core', 'core', 'smoke', 'debris', 'embers', 'skirt']);
    expect(Y.parts[0].count).toBeLessThan(fire.count);                    // fewer puffs,
    expect(Y.parts[0].size).toBeGreaterThan(fire.size);                   // larger: a bold shape
    expect(Y.parts[4].count).toBe(Math.max(4, Math.round(X.parts[4].count / 3)));
    expect(Y.parts[4].ramp[0]).toEqual([1, 1, 0.9]);                      // white-hot, cooling
    expect(Y.parts[5].reach * Y.flow.size).toBeCloseTo(4, 2);            // the skirt as far as the ring ran
    expect(Y.rings.every((r) => r.air)).toBe(true);                       // no ring meshes on the ground: the haze stays
    expect(Y.key).toEqual([0, 1]);                                        // a cue's colour still paints the fire
    expect(Y.dur).toBeGreaterThanOrEqual(Math.max(...Y.parts.map((p) => (p.delay || 0) + p.life)));
  });

  it('a mushroom needs no stem: the core lifts and rolls harder; an implosion draws in', () => {
    const M = flowExplosion(EXPLOSIONS.mushroom);
    expect(roles(M)).not.toContain('stem');
    expect(M.parts.find((p) => p.flow === 'core').rise).toBeGreaterThan(1);
    expect(flowExplosion(EXPLOSIONS.implode).parts[0].flow).toBe('inflow');
  });

  it('only a composed style that asks for the flow draws on it; every other keeps its bytes', () => {
    const plain = juiceFloor({}), flow = juiceFloor({ flow: true });
    expect('flow' in plain).toBe(false);
    expect(JSON.stringify({ ...flow, flow: undefined })).toBe(JSON.stringify(plain));
    expect(styleExplosion(EXPLOSIONS.blast, 'b', plain).flow).toBeUndefined();
    expect(styleExplosion(EXPLOSIONS.blast, 'b', flow).flow).toBeDefined();
    // a cel look's fire is its core on the flow, not spirit onions
    const cel = styleExplosion(EXPLOSIONS.blast, 'b', juiceFloor({ look: 'cel', flow: true }));
    expect(cel.aura).toBeUndefined();
    expect(cel.parts.some((p) => p.flow === 'core')).toBe(true);
  });
});

describe('a power-up on the flow', () => {
  it('its aura becomes the flame column, motes drawn in, pebbles lifting and a gust; its coat stays', () => {
    const L = flowLook(LOOKS['power-up']);
    expect(L.aura).toBeUndefined();
    expect(L.coat).toEqual(LOOKS['power-up'].coat);
    expect([...new Set(L.drift.map((s) => s.flow).filter(Boolean))]).toEqual(['column', 'inflow', 'motes', 'gust']);
    expect(flowLook(LOOKS.burn ?? { drift: [] })).toEqual(LOOKS.burn ?? { drift: [] });   // a look with no aura as it was
  });

  it('styleEvents turns a world\'s looks on the flow', () => {
    const ev = { reactions: [], looks: { 'power-up': LOOKS['power-up'] } };
    expect(styleEvents(ev, juiceFloor({ flow: true })).looks['power-up'].aura).toBeUndefined();
    expect(styleEvents(ev, juiceFloor({})).looks['power-up'].aura).toBeDefined();
  });
});

describe('on the page', () => {
  const ev = (fxStyle) => ({ reactions: [{ do: 'ctrl', op: 'puff', is: 'blast', spec: EXPLOSIONS.blast, on: 'x' }], cast: true, fxStyle });
  it('the moment channel carries the flow only when asked, and takes the world\'s bursts on it', () => {
    expect(momentScript(['explosion'])).not.toContain('__moVayo');
    const on = momentScript(['explosion'], { flow: { wind: [3, 0], blast: flowExplosion(EXPLOSIONS.blast) } });
    expect(on).toContain('const __moVayo = ');
    expect(on).toContain('window.__mojFlowBursts = !!__moBlast;');
    expect(eventsChannelScript(ev({ flow: true }))).toContain('__mojFlowBursts');
    expect(eventsChannelScript(ev({}))).not.toContain('__mojFlowBursts');
  });

  it('the status channel draws a power-up\'s flow only when a look asks for it', () => {
    expect(statusScript({ 'power-up': LOOKS['power-up'] })).not.toContain('__elVayo');
    expect(statusScript({ 'power-up': flowLook(LOOKS['power-up']) }, [], { flow: { wind: [0, 0] } })).toContain('const __elVayo = ');
  });

  it('the controllable page leaves its bursts to the flow and draws a hit as soft sprites, only on the flow', () => {
    const hero = [{ id: 'hero', transform: { pos: [0, 0, 1], heading: 0 }, rule: {}, body: {} }];
    const off = controllableChannelScript(hero, null, {}, {}), on = controllableChannelScript(hero, null, {}, { flow: true });
    expect(off).not.toContain('__mojFlowBursts');
    expect(on).toContain('if (window.__mojFlowBursts) continue;');
    expect(on).toContain('const __fxSoftTex');
  });
});
