/**
 * The actors' shadows on a form page (cast-shadows.js liveShadowScript with `formLand`): there the land's sun is the one
 * light and the actors' own light lights nothing, so its map darkened nothing three lights. Each lit surface that
 * receives takes the actors' light's own shadow (three's getShadow) on every directional light's colour. Only a page
 * with actors on a form land carries it.
 */
import { describe, expect, it } from 'vitest';

import { liveShadowScript } from './cast-shadows.js';

const cfg = (o) => ({ mapSize: 1024, toLight: [-0.9, 0, 0.3], alpha: 0.5, span: 16, ...o });

describe('the actors\' shadows on a form page', () => {
  it('is emitted only where actors cast on a form land', () => {
    expect(liveShadowScript(cfg({ actors: true, hour: true, formLand: true }))).toContain('__csFormPatch');
    expect(liveShadowScript(cfg({ actors: true, hour: true }))).not.toContain('__csForm');
    expect(liveShadowScript(cfg({ hour: true, formLand: true }))).not.toContain('__csForm');
    expect(liveShadowScript(cfg({ actors: true, hour: true, landSun: true }))).not.toContain('__csForm');   // (a built place's land sun is another word)
  });
  it('takes the actors\' light\'s own shadow (three\'s getShadow, its index among the casting lights) onto each directional light', () => {
    const src = liveShadowScript(cfg({ actors: true, hour: true, formLand: true }));
    const chunk = '#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )\n\tfor ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {\n\t\tdirectionalLight = directionalLights[ i ];\n\t\tgetDirectionalLightInfo( directionalLight, directLight );\n\t\tRE_Direct( directLight );\n\t}\n#endif';
    const start = src.indexOf('__csL.shadow.normalBias'), end = src.indexOf('// (a sweep a few times a second');
    const __csL = { shadow: { normalBias: 0 } };
    const run = new Function('THREE', '__csL', '__CS', 'scene', `${src.slice(start, end)}; return { patch: __csFormPatch, index: __csActorIndex };`);
    const lights = [{ isDirectionalLight: true, castShadow: false }, { isDirectionalLight: true, castShadow: true }, __csL, { isDirectionalLight: true, castShadow: true }];
    __csL.isDirectionalLight = true; __csL.castShadow = true;
    const K = run({ ShaderChunk: { lights_fragment_begin: chunk } }, __csL, { unit: 1 }, { traverseVisible: (f) => lights.forEach(f) });
    expect(K.index()).toBe(1);                                  // (its place among the lights that cast, in the scene's order)
    expect(__csL.shadow.normalBias).toBeCloseTo(0.04, 6);
    const mat = { isMeshStandardMaterial: true, userData: {} };
    K.patch({ material: mat }, 1);
    expect(mat.defines.CS_ACTOR_I).toBe(1);
    const sh = { fragmentShader: '#include <lights_fragment_begin>' };
    mat.onBeforeCompile(sh);
    expect(sh.fragmentShader).toContain('csActor = getShadow( directionalShadowMap[ CS_ACTOR_I ]');
    expect(sh.fragmentShader.indexOf('float csActor')).toBeLessThan(sh.fragmentShader.indexOf('#if ( NUM_DIR_LIGHTS > 0 )'));   // (once, before the loop)
    // (laid out already by a patch before it, the cast rig's: the same splice into the same text)
    const laid = { fragmentShader: chunk + '\n// after' }; mat.onBeforeCompile(laid);
    expect(laid.fragmentShader).toContain('directLight.color *= csActor;');
    expect(sh.fragmentShader).toContain('getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color *= csActor;');
    expect(mat.customProgramCacheKey()).toBe('mojulo-actors-on-form-1');
    // (a material three does not light, the painted world's, is left as it was)
    const basic = { isMeshBasicMaterial: true, userData: {} }; K.patch({ material: basic }, 1);
    expect(basic.onBeforeCompile).toBeUndefined();
  });
});
