// The cast material (channels/cast-rig.js): the rig laid on a body's own shader. Held against three's own shaders (the
// vendored build the page inlines), one case per material the kit makes and per surface it is drawn over.
import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildCastKit, castKitSource, castRigInput, CAST_ANCHORS } from './cast-rig.js';
import { castRig } from '../../color-theorist/cast-rig.js';
import { readGeocube } from '../../era/geocube.js';

let THREE, kit;
const RIG = castRig(readGeocube('island-noon')), CEL = castRig(readGeocube('island-noon'), { register: 'anime' });
beforeAll(async () => {
  THREE = await import(pathToFileURL(path.resolve('public/vendor/three/three.module.min.js')).href);
  kit = buildCastKit(THREE);
});
// a material's program as three would compile it: its library shader through its onBeforeCompile
const compiled = (m) => {
  const lib = THREE.ShaderLib[m.isMeshToonMaterial ? 'toon' : m.isMeshPhysicalMaterial ? 'physical' : 'standard'];
  const sh = { uniforms: {}, vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader };
  m.onBeforeCompile(sh, null);
  return sh;
};

describe('the cast material', () => {
  it('a page carries the rig\'s numbers only, and the kit as source', () => {
    const I = castRigInput(RIG);
    expect(I.key).toEqual({ toLight: RIG.key.toLight, linear: RIG.key.linear, gain: RIG.key.gain });
    expect(I.reads).toBeUndefined();
    expect(I.why).toBeUndefined();
    expect(castRigInput(CEL).bands).toEqual(CEL.bands);
    expect(JSON.parse(JSON.stringify(I))).toEqual(I);
    // (the source builds the same kit in a scope with THREE)
    const again = new Function('THREE', `return ${castKitSource()};`)(THREE);
    expect(Object.keys(again)).toEqual(Object.keys(kit));
  });

  it('lays the hemisphere, the key\'s gain and the rim in three\'s own shaders, lit or cel, and the body\'s tone over paint alone', () => {
    for (const fs of [THREE.ShaderLib.standard.fragmentShader, THREE.ShaderLib.toon.fragmentShader]) for (const a of CAST_ANCHORS) expect(fs.includes(a), a).toBe(true);
    const lit = kit.material(castRigInput(RIG), { surface: 'form' }), sh = compiled(lit);
    expect(lit.isMeshStandardMaterial).toBe(true);
    expect(sh.fragmentShader).toContain('irradiance = PI * uCastFill * mix( uCastGround, uCastSky');
    expect(sh.fragmentShader).toContain('reflectedLight.directDiffuse *= uCastKey');
    expect(sh.fragmentShader).toContain('totalEmissiveRadiance += uCastRim');
    // (the hemisphere after three has read the page's ambient, the rim after the emissive map)
    expect(sh.fragmentShader.indexOf('irradiance = PI')).toBeGreaterThan(sh.fragmentShader.indexOf('#include <lights_fragment_begin>'));
    // (over form the renderer tones it with the land; over paint the body tones itself)
    expect(sh.fragmentShader).not.toContain('castNeutral');
    const own = compiled(kit.material(castRigInput(RIG), { surface: 'paint' }));
    expect(own.fragmentShader.indexOf('castNeutral( gl_FragColor.rgb')).toBeLessThan(own.fragmentShader.indexOf('#include <tonemapping_fragment>'));
    // (the curve's shoulder alone over paint: no toe taking 0.04 off a body the untoned paint beside it keeps)
    const curve = own.fragmentShader.slice(own.fragmentShader.indexOf('vec3 castNeutral('), own.fragmentShader.indexOf('}', own.fragmentShader.indexOf('vec3 castNeutral(')));
    expect(curve).toContain('newPeak');
    expect(curve).not.toContain('offset');
    expect(own.uniforms.uCastSky.value.toArray()).toEqual(RIG.hemi.sky);
    expect(own.uniforms.uCastKey.value).toBe(RIG.key.gain);
    // (the cel: three's toon material over the rig's ramp, its rim stepped)
    const cel = kit.material(castRigInput(CEL), { surface: 'paint' });
    expect(cel.isMeshToonMaterial).toBe(true);
    expect(cel.gradientMap.image.width).toBe(CEL.bands.ramp.length);
    expect(compiled(cel).fragmentShader).toContain('castF = step( 0.42, castF )');
    // (each its own program)
    expect(new Set([lit, kit.material(castRigInput(RIG), { surface: 'paint' }), cel].map((m) => m.customProgramCacheKey())).size).toBe(3);
  });

  it('lays itself after a material\'s own patch, and names a shader it cannot find its place in', () => {
    const m = new THREE.MeshStandardMaterial();
    m.onBeforeCompile = (sh) => { sh.uniforms.uMine = { value: 1 }; };
    m.customProgramCacheKey = () => 'mine';
    const sh = compiled(kit.patch(m, kit.uniforms(castRigInput(RIG)), { register: 'western', surface: 'form' }));
    expect(sh.uniforms.uMine).toBeDefined();
    expect(sh.uniforms.uCastRim).toBeDefined();
    expect(m.customProgramCacheKey()).toBe('mine+cast-lit-form');
    const bare = kit.patch(new THREE.MeshStandardMaterial(), kit.uniforms(castRigInput(RIG)), { register: 'western', surface: 'form' });
    expect(() => bare.onBeforeCompile({ uniforms: {}, vertexShader: '', fragmentShader: 'void main() {}' })).toThrow(/cast material/);
  });

  it('one key a page: a form page\'s sun as it is; over paint the page\'s caster takes the key and every other is put out', () => {
    const I = castRigInput(RIG), level = Math.PI * Math.max(...RIG.key.linear);
    // (a form page: the land's sun, untouched)
    const sun = new THREE.DirectionalLight(0xffffff, 2), form = new THREE.Scene(); form.add(sun);
    expect(kit.key(form, I, { sun })).toBe(sun);
    expect(sun.intensity).toBe(2);
    // (a painted page with the live light's two casters: one takes the key, the other lights nothing)
    const a = new THREE.DirectionalLight(0xffffff, 1), b = new THREE.DirectionalLight(0xffffff, 1), paint = new THREE.Scene();
    a.castShadow = true; b.castShadow = true; paint.add(a, b);
    const k = kit.key(paint, I);
    expect(k).toBe(a);
    expect(a.intensity).toBeCloseTo(level, 6);
    expect(b.intensity).toBe(0);
    // (a page with no light: a key of its own along the rig's)
    const bare = new THREE.Scene(), own = kit.key(bare, I);
    expect(own.isDirectionalLight).toBe(true);
    expect(own.position.clone().normalize().toArray().map((v) => +v.toFixed(3))).toEqual(RIG.key.toLight.map((v) => +v.toFixed(3)));
    expect(bare.children.filter((o) => o.isDirectionalLight).length).toBe(1);
  });
});
