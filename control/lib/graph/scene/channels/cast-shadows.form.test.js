/**
 * The actors' shadows on a form page (cast-shadows.js liveShadowScript with `formLand`): there the land's sun is the one
 * light and the actors' own light lights nothing, so its map darkened nothing three lights. Each lit surface that
 * receives takes the actors' map on every directional light's colour; a body reads it a few centimetres deeper. Only a
 * page with actors on a form land carries it.
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
  it('multiplies each directional light\'s colour by the actors\' map, in three\'s own loop; a body reads it deeper', () => {
    const src = liveShadowScript(cfg({ actors: true, hour: true, formLand: true }));
    // (the page's patch, run against a stand-in of three's chunk and a mesh: its shader text read back)
    const chunk = 'for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {\n\t\tdirectionalLight = directionalLights[ i ];\n\t\tgetDirectionalLightInfo( directionalLight, directLight );\n\t\tRE_Direct( directLight );\n\t}';
    const start = src.indexOf('const __csFormFS'), end = src.indexOf('// (a sweep a few times a second');
    const run = new Function('THREE', '__csMatU', '__csMapU', '__csBiasU', '__csTexelU', `${src.slice(start, end)}; return __csFormPatch;`);
    const patch = run({ ShaderChunk: { lights_fragment_begin: chunk } }, {}, {}, {}, {});
    const shaderOf = (castShadow) => {
      const mat = { isMeshStandardMaterial: true, userData: {} }, o = { castShadow, material: mat };
      patch(o);
      const sh = { uniforms: {}, vertexShader: '#include <project_vertex>', fragmentShader: '#include <lights_fragment_begin>' };
      mat.onBeforeCompile(sh);
      return { sh, mat };
    };
    const land = shaderOf(false), body = shaderOf(true);
    expect(land.sh.fragmentShader).toContain('getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color *= csActor;');
    expect(land.sh.fragmentShader).toContain('float csActor = csFormLit( vCsCoord, csBias );');
    expect(body.sh.fragmentShader).toContain('float csActor = csFormLit( vCsCoord, csBias * 10.0 );');
    expect(land.sh.vertexShader).toContain('vCsCoord = csMat * ( modelMatrix * vec4( transformed, 1.0 ) );');
    expect(Object.keys(land.sh.uniforms).sort()).toEqual(['csBias', 'csMap', 'csMat', 'csTexel']);
    expect(land.mat.customProgramCacheKey()).not.toBe(body.mat.customProgramCacheKey());
    // (a material three does not light, the painted world's, is left as it was)
    const basic = { isMeshBasicMaterial: true, userData: {} }; patch({ castShadow: false, material: basic });
    expect(basic.onBeforeCompile).toBeUndefined();
  });
});
