// THE RACER'S LIGHT IN GODOT, held to the page's in the real browser (the e2e tier): kernel/wet_road.gdshader's film()
// and kernel/beam.gdshader's pool (since 0.31.0) and the page's own fragments (channels/wet-road.js, the controllable
// channel's __rlBeamF) draw the same points in WebGL2 into float targets and agree to a float's last bits: the film seen
// down the road, across it and from above, its lamps' streaks and the sky's sheen; the pool's two lobes down its length.
// A film that mirrors its lamps over the eye's height instead, or a pool opened the other way, disagrees. Every kernel
// shader the racer adds compiles as GLSL ES 3.00 under a spatial wrap (Godot's built-ins as globals and uniforms).
// Without a browser it says so and passes.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { wetRoadScript } from './channels/wet-road.js';
import { controllableChannelScript } from './channels/controllable/index.js';
import { supercarFigure } from '../car-designer/supercar-figure.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from './chromium.js';

const KERNEL = path.join(process.cwd(), 'lib/graph/scene/godot-kernel');
const read = (f) => fs.readFileSync(path.join(KERNEL, f), 'utf8');

// a spatial shader as GLSL ES 3.00: its built-ins as globals and uniforms, its varyings plain globals, its hints and
// defaults dropped, fragment() run by main
const BUILTINS = 'vec3 VERTEX; mat4 MODEL_MATRIX = mat4(1.0); uniform vec3 CAMERA_POSITION_WORLD; uniform float TIME; vec2 UV; vec3 NORMAL = vec3(0.0, 0.0, 1.0); vec3 VIEW = vec3(0.0, 0.0, 1.0); vec3 ALBEDO; float ALPHA = 1.0;\n';
export const spatialAsGlsl = (src, main = 'void main() { fragment(); outColor = vec4(ALBEDO, ALPHA); }') => '#version 300 es\nprecision highp float;\nprecision highp int;\nout vec4 outColor;\n' + BUILTINS
  + src.replace(/^shader_type spatial;/m, '').replace(/^render_mode [^;]*;/m, '').replace(/ : source_color/g, '').replace(/^varying /gm, '')
    .replace(/^uniform (\w+) (\w+) = [^;]+;/gm, 'uniform $1 $2;') + '\n' + main;

// the page's three-flavoured fragment as GLSL ES 3.00 (its log-depth chunks dropped, its varying a global set per pixel)
const pageAsGlsl = (src, setup, varying) => '#version 300 es\nprecision highp float;\nprecision highp int;\nout vec4 outColor;\n#define gl_FragColor outColor\nuniform vec3 cameraPosition;\nuniform vec2 uRes;\n'
  + src.replace(/#include <logdepthbuf_pars_fragment>/g, '').replace(/#include <logdepthbuf_fragment>/g, '').replace(`varying ${varying};`, `${varying};`)
    .replace(/void main\(\) \{/, `void main() {\n${setup}`);

// the points both draw: a pixel's place on a 60 m stretch of road, z at the film
const ROAD_P = 'vec3(-30.0 + 60.0 * gl_FragCoord.x / uRes.x, -30.0 + 60.0 * gl_FragCoord.y / uRes.y, 0.02)';

function wetPrograms() {
  const pageSrc = wetRoadScript({ quads: [[[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]]], lamps: [], zenith: [40, 60, 90], horizon: [120, 110, 100] });
  const frag = pageSrc.slice(pageSrc.indexOf('fragmentShader: `') + 17, pageSrc.indexOf('`,', pageSrc.indexOf('fragmentShader: `')));
  const web = pageAsGlsl(frag, `  vW = ${ROAD_P};`, 'vec3 vW');
  const port = (src) => spatialAsGlsl(src.replace('ALBEDO = srgb_lin(film(vw, cam, TIME));', 'ALBEDO = film(vw, cam, TIME);'),
    `uniform vec2 uRes;\nvoid main() { vw = ${ROAD_P}; fragment(); outColor = vec4(ALBEDO, 1.0); }`);
  return { web, port };
}

function beamPrograms() {
  const fig = supercarFigure({ mood: 'night-rain' });
  const src = controllableChannelScript([{ id: 'car', pilotable: true, rule: { type: 'drive' }, transform: { pos: [0, 0, 0], heading: 0 }, body: { type: 'figure', figure: 'car' } }], null, { car: fig });
  const line = src.slice(src.indexOf('const __rlBeamF = '), src.indexOf('\n', src.indexOf('const __rlBeamF = ')));
  // eslint-disable-next-line no-new-func
  const frag = new Function(`return ${line.slice('const __rlBeamF = '.length).replace(/;$/, '')}`)();
  const web = pageAsGlsl(frag, '  vUv = gl_FragCoord.xy / uRes;', 'vec2 vUv');
  const port = (s) => spatialAsGlsl(s.replace('ALBEDO = srgb_lin(col * k * amount);', 'ALBEDO = col * k * amount;'), 'uniform vec2 uRes;\nvoid main() { UV = gl_FragCoord.xy / uRes; fragment(); outColor = vec4(ALBEDO, 1.0); }');
  return { web, port, beams: fig.juice.beams };
}

// in the page: compile both, draw each set of uniforms, the worst difference in any channel and how much was lit
async function compare(page, port, web, sets) {
  return page.evaluate(({ port, web, sets }) => {
    const cv = document.createElement('canvas'); cv.width = 96; cv.height = 96;
    const gl = cv.getContext('webgl2'); gl.getExtension('EXT_color_buffer_float');
    const prog = (src) => {
      const p = gl.createProgram();
      for (const [t, s] of [[gl.VERTEX_SHADER, '#version 300 es\nin vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }'], [gl.FRAGMENT_SHADER, src]]) { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) return { error: gl.getShaderInfoLog(sh) }; gl.attachShader(p, sh); }
      gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p); return gl.getProgramParameter(p, gl.LINK_STATUS) ? { p } : { error: gl.getProgramInfoLog(p) };
    };
    const P = prog(port), W = prog(web);
    if (P.error || W.error) return { error: P.error || W.error };
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, cv.width, cv.height, 0, gl.RGBA, gl.FLOAT, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, gl.createFramebuffer()); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.viewport(0, 0, cv.width, cv.height);
    const draw = (p, U) => {
      gl.useProgram(p);
      for (const [n, [fn, v]] of Object.entries(U)) { const l = gl.getUniformLocation(p, n); if (l) gl[fn](l, ...(Array.isArray(v) && fn.endsWith('v') ? [v] : Array.isArray(v) ? v : [v])); }
      const l = gl.getUniformLocation(p, 'uRes'); if (l) gl.uniform2f(l, cv.width, cv.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      const px = new Float32Array(cv.width * cv.height * 4); gl.readPixels(0, 0, cv.width, cv.height, gl.RGBA, gl.FLOAT, px); return px;
    };
    return { out: sets.map((s) => {
      const a = draw(P.p, s.port), b = draw(W.p, s.web);
      let worst = 0, lit = 0, bad = 0;
      for (let i = 0; i < a.length; i++) { if (i % 4 === 3) continue; if (!Number.isFinite(b[i])) { bad++; continue; } worst = Math.max(worst, Math.abs(a[i] - b[i])); if (b[i] > 0.01) lit++; }
      return { name: s.name, worst, lit, bad };
    }) };
  }, { port, web, sets });
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

describe('the racer\'s light in Godot, held to the page\'s in Chrome', () => {
  it('every shader the racer adds compiles as GLSL under the spatial wrap', async () => {
    if (!page) return;
    for (const f of ['wet_road.gdshader', 'beam.gdshader', 'bubble.gdshader', 'status.gdshader']) expect(await compiles(page, spatialAsGlsl(read(f))), f).toBe(true);
  }, 120000);

  // three lamps by the road (a street lamp's warm, a sign's red, a cold one far off), the sky's two colours lifted as the page lifts them
  const lin = (c) => c.map((v) => (v / 255) ** 2.2);
  const LAMPS = [[[4, 6, 5.5], [255, 200, 140], 1.4], [[-8, -3, 3], [255, 60, 40], 1], [[20, 18, 7], [150, 190, 255], 2]];
  const L4 = LAMPS.flatMap(([at, , k]) => [...at, k]), LC = LAMPS.flatMap(([, rgb]) => lin(rgb));
  const pad = (a, n, w) => [...a, ...Array(n * w - a.length).fill(0)];
  // a camera in the recipe's frame → Godot's (y up), mpu 1
  const g = ([x, y, z]) => [x, z, -y];
  const wetSet = (name, cam, t) => ({ name,
    web: { cameraPosition: ['uniform3f', cam], uZen: ['uniform3f', lin([40, 60, 90])], uHor: ['uniform3f', lin([120, 110, 100])], uT: ['uniform1f', t], uN: ['uniform1i', LAMPS.length], uL: ['uniform4fv', pad(L4, 24, 4)], uC: ['uniform3fv', pad(LC, 24, 3)] },
    port: { CAMERA_POSITION_WORLD: ['uniform3f', g(cam)], mpu: ['uniform1f', 1], zen: ['uniform3f', lin([40, 60, 90])], hor: ['uniform3f', lin([120, 110, 100])], TIME: ['uniform1f', t], count: ['uniform1i', LAMPS.length], lamps: ['uniform4fv', pad(L4, 24, 4)], lamp_cols: ['uniform3fv', pad(LC, 24, 3)] } });
  const WET = [wetSet('down the road, low', [0, -28, 1.2], 0), wetSet('across it', [-26, 2, 1.6], 12.5), wetSet('from above', [3, 1, 30], 40.25)];

  it('film() lays the page\'s film, point for point; one mirroring its lamps over the eye does not', async () => {
    if (!page) return;
    const { web, port } = wetPrograms(), src = read('wet_road.gdshader');
    const good = await compare(page, port(src), web, WET);
    expect(good.error).toBeUndefined();
    for (const r of good.out) { expect(r.worst, r.name).toBeLessThan(1e-5); expect(r.bad, r.name).toBe(0); }
    expect(good.out.filter((r) => r.lit > 500).length).toBeGreaterThanOrEqual(2);   // the film is seen, sheen and streaks
    const bad = await compare(page, port(src.replace('vec3 M = vec3(L.xy, 2.0 * p.z - L.z);', 'vec3 M = vec3(L.xy, 2.0 * cam.z - L.z);')), web, WET);
    expect(Math.max(...bad.out.map((r) => r.worst))).toBeGreaterThan(1e-3);
  }, 120000);

  it('the pool lies as the page\'s does, its lobes down its length; one opened the other way does not', async () => {
    if (!page) return;
    const { web, port, beams } = beamPrograms(), src = read('beam.gdshader');
    const col = (() => { const h = beams.colour.slice(1), c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); return c.map((x) => (x < 0.04045 ? x * 0.0773993808 : (x * 0.9478672986 + 0.0521327014) ** 2.4)); })();
    const set = (name, amount) => ({ name, web: { uCol: ['uniform3f', col], uA: ['uniform1f', amount], uSp: ['uniform1f', beams.spread] }, port: { col: ['uniform3f', col], amount: ['uniform1f', amount], spread: ['uniform1f', beams.spread] } });
    const sets = [set('at rest', beams.amount * 0.85), set('flat out', beams.amount)];
    const good = await compare(page, port(src), web, sets);
    expect(good.error).toBeUndefined();
    // (Chrome reads the page's pow() of a negative offset as its square, which the port writes out: GLSL leaves it undefined)
    for (const r of good.out) expect(r.worst, r.name).toBeLessThan(1e-5);
    expect(good.out.every((r) => r.lit > 500)).toBe(true);
    const bad = await compare(page, port(src.replace('float c = spread * (1.0 - v);', 'float c = spread * v;')), web, sets);
    expect(Math.max(...bad.out.map((r) => r.worst))).toBeGreaterThan(1e-3);
  }, 120000);
});
