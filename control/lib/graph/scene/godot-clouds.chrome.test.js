// THE CLOUD DECK IN GODOT, held to the page's in the real browser (the e2e tier): kernel/clouds_sky.gdshader's deck()
// (since 0.31.0) and the page's own fragment (effects/effects-clouds.js, undershot) render the same rays in WebGL2 into
// float targets and agree to a float's last bits, below the deck, at its horizon and above it; a deck() that drifts the
// other way disagrees. Both kernel sky shaders compile as GLSL ES 3.00 under their sky wrap (the syntax and types
// Godot's shading language shares with GLSL). Without a browser it says so and passes.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { composeCloudDeck } from '../effects/effects-clouds.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from './chromium.js';

const KERNEL = path.join(process.cwd(), 'lib/graph/scene/godot-kernel');
const read = (f) => fs.readFileSync(path.join(KERNEL, f), 'utf8');

// a sky shader as GLSL ES 3.00: its built-ins as uniforms, its hints and defaults dropped, sky() as main
export const skyAsGlsl = (src) => '#version 300 es\nprecision highp float;\nuniform vec3 EYEDIR; uniform vec3 POSITION; uniform float TIME;\nout vec4 outColor;\n'
  + src.replace(/^shader_type sky;/m, '').replace(/ : source_color/g, '').replace(/^uniform (\w+) (\w+) = [^;]+;/gm, 'uniform $1 $2;')
    .replace(/void sky\(\)/, 'void main()').replace(/COLOR = ([^;]+);/, 'outColor = vec4($1, 1.0);');

// the port's deck() on the page's rays (its camera basis, its field of view)
function portFrag(src) {
  const unis = [...src.matchAll(/^uniform (\w+) (\w+)\b[^;]*;/gm)].map((m) => `uniform ${m[1]} ${m[2]};`).join('\n');
  const fns = src.slice(src.indexOf('const float SV_PI'), src.indexOf('void sky()')).replace(/^float hash\(vec3 p\) \{[\s\S]*?\n\}\n/m, '');
  return `#version 300 es
precision highp float;
${unis}
uniform vec3 uCamPos; uniform mat3 uCamBasis; uniform vec2 uRes; uniform float uTime; uniform float uFov;
out vec4 outColor;
${fns}
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / (0.5 * uRes.y);
  float tanf = tan(uFov * 0.5);
  outColor = deck(uCamPos, normalize(uCamBasis * vec3(uv.x * tanf, uv.y * tanf, 1.0)), uTime);
}`;
}

// in the page: compile, then draw both programs per camera and clock reading, and the worst difference in any channel
async function compare(page, port, web, D, cams) {
  return page.evaluate(({ port, web, D, cams }) => {
    const cv = document.createElement('canvas'); cv.width = 96; cv.height = 64;
    const gl = cv.getContext('webgl2'); gl.getExtension('EXT_color_buffer_float');
    const vs = (es3) => (es3 ? '#version 300 es\nin vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }' : 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }');
    const prog = (src, es3) => {
      const p = gl.createProgram();
      for (const [t, s] of [[gl.VERTEX_SHADER, vs(es3)], [gl.FRAGMENT_SHADER, src]]) { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) return { error: gl.getShaderInfoLog(sh) }; gl.attachShader(p, sh); }
      gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p); return gl.getProgramParameter(p, gl.LINK_STATUS) ? { p } : { error: gl.getProgramInfoLog(p) };
    };
    const P = prog(port, true), W = prog(web, false);
    if (P.error || W.error) return { error: P.error || W.error };
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, cv.width, cv.height, 0, gl.RGBA, gl.FLOAT, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, gl.createFramebuffer()); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    // the page's scene depth, empty (nothing in front of the deck: its clip cuts nothing)
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, gl.createTexture()); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
    gl.viewport(0, 0, cv.width, cv.height);
    const basis = (yaw, pitch) => { const f = [Math.cos(pitch) * Math.cos(yaw), Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch)], r = [Math.sin(yaw), -Math.cos(yaw), 0]; return [...r, r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0], ...f]; };
    const set = (p, n, fn, ...v) => { const l = gl.getUniformLocation(p, n); if (l) gl[fn](l, ...v); };
    const draw = (p, cam, t) => {
      gl.useProgram(p);
      set(p, 'uCamPos', 'uniform3f', ...cam.pos); gl.uniformMatrix3fv(gl.getUniformLocation(p, 'uCamBasis'), false, basis(cam.yaw, cam.pitch));
      set(p, 'uRes', 'uniform2f', cv.width, cv.height); set(p, 'uTime', 'uniform1f', t); set(p, 'uFov', 'uniform1f', 1.1);
      set(p, 'uMaxDist', 'uniform1f', D.maxDist); set(p, 'uFade', 'uniform1f', D.fade); set(p, 'uDepth', 'uniform1i', 1); set(p, 'uNear', 'uniform1f', 0.1); set(p, 'uFar', 'uniform1f', 8000);
      for (const k of ['base', 'top', 'thick', 'density', 'scale', 'worley', 'lo', 'hi', 'reach']) set(p, k, 'uniform1f', D[k]);
      set(p, 'phase_cap', 'uniform1f', D.phaseCap); set(p, 'max_dist', 'uniform1f', D.maxDist); set(p, 'fade', 'uniform1f', D.fade);
      set(p, 'albedo', 'uniform3f', ...D.albedo); set(p, 'deck_sun', 'uniform3f', ...D.sun); set(p, 'sun_col', 'uniform3f', ...D.sunCol); set(p, 'sky_col', 'uniform3f', ...D.skyCol); set(p, 'gnd_col', 'uniform3f', ...D.gndCol); set(p, 'drift', 'uniform2f', ...D.drift);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      const px = new Float32Array(cv.width * cv.height * 4); gl.readPixels(0, 0, cv.width, cv.height, gl.RGBA, gl.FLOAT, px); return px;
    };
    const out = [];
    for (const cam of cams) for (const t of [0, 37.5]) {
      const a = draw(P.p, cam, t), b = draw(W.p, cam, t);
      let worst = 0, lit = 0;
      for (let i = 0; i < a.length; i++) { worst = Math.max(worst, Math.abs(a[i] - b[i])); if (i % 4 === 3 && b[i] > 0.01) lit++; }
      out.push({ cam: cam.name, t, worst, lit });
    }
    return { out };
  }, { port, web, D, cams });
}

async function compiles(page, src) {
  return page.evaluate((s) => { const gl = document.createElement('canvas').getContext('webgl2'); const sh = gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(sh, s); gl.compileShader(sh); return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? true : gl.getShaderInfoLog(sh); }, src);
}

let browser = null, page = null;
beforeAll(async () => {
  let exe = null;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
  page = await browser.newPage();
}, 120000);
afterAll(async () => { if (browser) await browser.close(); });

describe('the cloud deck in Godot, held to the page\'s in Chrome', () => {
  const eff = composeCloudDeck([], { up: 'z', sun: [0.4, 0.75, 0.6], coverage: 0.4, density: 0.4, color: [1.12, 1.1, 1.06], scale: 0.0095, drift: 0.7, base: 72, top: 100, maxDist: 900, fade: 700, depthClip: true });
  const D = eff.deck;
  const cams = [
    { name: 'below, up at 30°', pos: [0, 0, 1.7], yaw: 0.3, pitch: 0.52 },
    { name: 'below, steep', pos: [40, -20, 5], yaw: 2, pitch: 1.2 },
    { name: 'below, at the horizon', pos: [0, 0, 1.7], yaw: -1, pitch: 0.12 },
    { name: 'above, down', pos: [10, 10, 140], yaw: 0.8, pitch: -0.7 },
    { name: 'inside the band', pos: [0, 0, 86], yaw: 0, pitch: 0.3 },
  ];

  it('the deck carries its numbers as the fragment spells them', () => {
    expect(D).toMatchObject({ base: 72, top: 100, thick: 28, density: 0.4, scale: 0.0095, worley: 0.0209, lo: 0.56, hi: 0.84, phaseCap: 2, maxDist: 900, fade: 700 });
    for (const [k, v] of [['SV_DENS', D.density], ['SV_THICK', D.thick]]) expect(eff.frag).toContain(`const float ${k} = ${v.toFixed(4)}`);
    expect(eff.frag).toContain(`smoothstep(${D.lo.toFixed(4)}, ${D.hi.toFixed(4)},`);
  });

  it('both kernel sky shaders compile as GLSL under the sky wrap', async () => {
    if (!page) return;
    expect(await compiles(page, skyAsGlsl(read('sky.gdshader')))).toBe(true);
    expect(await compiles(page, skyAsGlsl(read('clouds_sky.gdshader')))).toBe(true);
  }, 120000);

  it('deck() draws the page\'s deck, ray for ray; one drifting the other way does not', async () => {
    if (!page) return;
    const src = read('clouds_sky.gdshader');
    const good = await compare(page, portFrag(src), eff.frag, D, cams);
    expect(good.error).toBeUndefined();
    for (const r of good.out) expect(r.worst, `${r.cam} at ${r.t}`).toBeLessThan(1e-5);
    expect(good.out.filter((r) => r.lit > 500).length).toBeGreaterThanOrEqual(6);   // the deck is seen, from below and above
    const bad = await compare(page, portFrag(src.replace('vec3(t_clock * drift.x, t_clock * drift.y, 0.0)', 'vec3(-t_clock * drift.x, t_clock * drift.y, 0.0)')), eff.frag, D, cams);
    expect(Math.max(...bad.out.map((r) => r.worst))).toBeGreaterThan(1e-3);
  }, 120000);
});
