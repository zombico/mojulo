// The page's light, one record (page-light.js): one case per place a sun is read from, the shadow's own rule, and the
// machine check that one page has one sun: on an emitted page, a shading channel and the live shadows agree.
import { describe, it, expect } from 'vitest';
import { pageLight, shadowToLight, lightAgrees, SHADOW_SUN, readFinish, skyEnv, envAt, SKY_ENV } from './page-light.js';
import { specularChannelScript } from './channels/specular.js';
import { emitThreeWorld } from './scene-three.js';
import { DEFAULT_LIGHT } from '../polygonizer/vexar.js';
import { shallowsChannelScript } from './channels/shallows.js';
import { seawayChannelScript } from './channels/seaway.js';

const SUN = [-0.3747, -0.3747, 0.848], BAKED = [0.2, 0.3, 0.9327];
const far = (d) => ({ at: d.map((v) => v * 1e6), key: [0.6, 0.55, 0.42], radius: 1e9, live: true });

describe('the page\'s light', () => {
  it('is read from the first that holds: the form land, a town, a stage under a sun, the baked light, the default', () => {
    const land = { land: { sun: SUN, light: { sun: [0.6, 0.55, 0.42], ambient: [0.2, 0.35, 0.58] }, sky: { zenith: [1, 2, 3], horizon: [4, 5, 6] } } };
    expect(pageLight({ light: { toLight: BAKED }, form: land })).toMatchObject({ from: 'land', toLight: SUN, sun: [0.6, 0.55, 0.42], sky: { zenith: [1, 2, 3] }, indoor: false });
    const town = pageLight({ light: { toLight: BAKED }, form: { town: { lights: [far(SUN)], ambient: [0.2, 0.3, 0.5] } } });
    expect(town.from).toBe('town');
    expect(lightAgrees([town.toLight, SUN])).toBe(true);
    const lamp = { at: [0, 0, 2], key: [1, 1, 1], radius: 6, live: true };
    expect(pageLight({ form: { room: { lights: [lamp, far(SUN)], sun: { ground: [0.1, 0.1, 0.1] }, ambient: [0.1, 0.1, 0.1] } } }).from).toBe('stage');
    // (a room under no sun: its lamps are its light; the direction falls to the baked one, and the record says indoor)
    expect(pageLight({ light: { toLight: BAKED }, form: { room: { lights: [lamp], ambient: [0.1, 0.1, 0.1] } } })).toMatchObject({ from: 'baked', toLight: BAKED, indoor: true });
    expect(pageLight({ light: { toLight: BAKED } })).toMatchObject({ from: 'baked', toLight: BAKED });
    expect(pageLight({})).toMatchObject({ from: 'default', toLight: DEFAULT_LIGHT.toLight });
    expect(JSON.stringify(pageLight({ form: land }))).toBe(JSON.stringify(pageLight({ form: land })));
  });

  it('a shadow is cast along the record\'s sun, the world\'s own where it names one, and the shadow\'s default under a low sun or no light', () => {
    const rec = pageLight({ light: { toLight: BAKED } });
    expect(shadowToLight(rec)).toEqual(BAKED);
    expect(shadowToLight(rec, { toLight: SUN })).toEqual(SUN);
    expect(shadowToLight(pageLight({ light: { toLight: [0.8, 0.6, 0.01] } }))).toEqual([...SHADOW_SUN]);
    // (a page with no light of its own keeps the shadows it was minted with)
    expect(shadowToLight(pageLight({}))).toEqual([...SHADOW_SUN]);
  });

  it('one page, one sun: on a form page a shading channel and the live shadows are drawn along the land\'s sun, and the probe says it', () => {
    const face = (extra) => ({ corners: [[0, 0, 0], [4, 0, 0], [4, 4, 0], [0, 4, 0]], fill: '#888888', ...extra });
    const payload = { faces: [face({ sunShare: [0.5, 0.5, 0.5, 0.5] }), face({ spec: [0.8, 24] })], light: { toLight: BAKED }, shadows: { hour: true }, inline: true };
    const read = (html) => ({ spec: JSON.parse(/const SPEC_L = (\[[^\]]*\]);/.exec(html)[1]), shadow: JSON.parse(/"toLight":(\[[^\]]*\])/.exec(/const __CS = (\{.*?\});/s.exec(html)[1])[1]) });
    // (with only its baked light: both along it, and no probe: the page as it was)
    const plain = emitThreeWorld(payload), P = read(plain);
    expect(lightAgrees([P.spec, P.shadow, BAKED])).toBe(true);
    expect(plain).not.toContain('__mojSun');
    // (with a town's baked buildings: both along its sun, whatever the baked light says)
    const formed = emitThreeWorld({ ...payload, form: { town: { lights: [far(SUN)], ambient: [0.2, 0.3, 0.5], fall: 2, sun: { ground: [0.3, 0.3, 0.3] }, maps: {} } } }), F = read(formed);
    expect(lightAgrees([F.spec, F.shadow, SUN])).toBe(true);
    expect(lightAgrees([F.spec, BAKED])).toBe(false);
    const probe = JSON.parse(/window\.__mojSun = (\{.*?\});/.exec(formed)[1]);
    expect(probe.from).toBe('town');
    expect(lightAgrees([probe.toLight, SUN])).toBe(true);
  });

  it('on a page the land lights, live water brings no light of its own: the land\'s sun and sky are the page\'s', () => {
    const own = shallowsChannelScript({ bodies: [] }), lit = shallowsChannelScript({ bodies: [], pageLit: true });
    expect(own).toContain('THREE.HemisphereLight');
    expect(lit).not.toContain('THREE.HemisphereLight');
    expect(lit).not.toContain('THREE.DirectionalLight');
    const sea = { boat: {}, water: {}, wake: {}, course: {} };
    expect(seawayChannelScript(sea)).toContain('THREE.HemisphereLight');
    expect(seawayChannelScript({ ...sea, pageLit: true })).not.toContain('THREE.HemisphereLight');
  });

  it('the finish is asked for: absent it is nothing, a word or true the default, an unknown word teaches', () => {
    expect(readFinish(null)).toBeNull();
    expect(readFinish({ tier: 'full' })).toBeNull();
    expect(readFinish({ finish: true })).toEqual({ curve: 'neutral', reflect: true });
    expect(readFinish({ finish: 'neutral' })).toEqual({ curve: 'neutral', reflect: true });
    expect(readFinish({ finish: { reflect: false } })).toEqual({ curve: 'neutral', reflect: false });
    expect(() => readFinish({ finish: 'glossy' })).toThrow(/curve 'glossy' is not one of/);
    expect(() => readFinish({ finish: { bloom: 1 } })).toThrow(/'bloom' is not a part of it/);
  });

  it('under the finish a spec face reflects the painted sky, by the law the record states; without it the channel is as it was', () => {
    const env = skyEnv({ zenith: [60, 110, 200], horizon: [200, 215, 235] });
    // (the law: the zenith overhead, the horizon level, the ground below, continuous enough at the horizon to read as one sky)
    envAt(1, env).forEach((v, k) => expect(v).toBeCloseTo(env.zenith[k], 6));
    envAt(1e-9, env).forEach((v, k) => expect(v).toBeCloseTo(env.horizon[k], 3));
    envAt(-1, env).forEach((v, k) => expect(v).toBeCloseTo(env.ground[k], 2));
    expect(env.ground[0]).toBeCloseTo(env.horizon[0] * SKY_ENV.ground, 3);
    // (the shader runs that law with the record's numbers)
    const plain = specularChannelScript(SUN), lit = specularChannelScript(SUN, env);
    expect(plain).not.toContain('sE');
    expect(lit).toContain(`pow(sR.z, ${SKY_ENV.rise.toFixed(4)})`);
    expect(lit).toContain(`vec3(${env.zenith.map((v) => v.toFixed(4)).join(', ')})`);
    expect(lit.replace(/      'vec3 sR[\s\S]*?sF \* sE;\\n' \+\n/, '')).toBe(plain);
    // (the page: only a world that asks, under a painted sky, and never a room under no sun)
    const face = (extra) => ({ corners: [[0, 0, 0], [4, 0, 0], [4, 4, 0], [0, 4, 0]], fill: '#888888', ...extra });
    const P = { faces: [face(), face({ spec: [0.8, 24] })], light: { toLight: BAKED }, sky: { zenith: [60, 110, 200], horizon: [200, 215, 235] }, inline: true };
    expect(emitThreeWorld(P)).not.toContain('sF * sE');
    expect(emitThreeWorld({ ...P, finish: readFinish({ finish: true }) })).toContain('sF * sE');
    expect(emitThreeWorld({ ...P, finish: readFinish({ finish: { reflect: false } }) })).not.toContain('sF * sE');
    expect(emitThreeWorld({ ...P, sky: null, finish: readFinish({ finish: true }) })).not.toContain('sF * sE');
  });
});
