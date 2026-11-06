// THE WEBGPU SPIKE, the swap: today's World page with its renderer swapped for three's WebGPURenderer and nothing else
// ported. `three` resolves to a shim over r184's `three.webgpu` build (the same release, the same core bytes as the
// vendored tree), whose `WebGLRenderer` is a WebGPURenderer taking the same options, and the page awaits its init after
// constructing it. The classic materials are converted by three's node library as they are drawn; every GLSL hook is
// what does not carry over: `onBeforeCompile` is ignored, and a `ShaderMaterial` (`level`):
//   'stub'  drawn as a plain node material (the shim's), so the page runs and the image shows what the gap costs
//   'raw'   left as it is, so the page reports what fails
// It is a measuring tool, not a port: the gap it shows is the work the node twins would do.

export const GPU_VENDOR = '/vendor-gpu/';

/** the shim module `three` resolves to on the swapped page */
export function shimSource({ shader = 'stub' } = {}) {
  return `export * from 'three-webgpu';
import * as T from 'three-webgpu';
// the renderer: WebGPU, the options the page passes it carried over (canvas, antialias, log depth, alpha, stencil)
export class WebGLRenderer extends T.WebGPURenderer {
  constructor(p = {}) {
    super({ canvas: p.canvas, antialias: !!p.antialias, alpha: !!p.alpha, stencil: !!p.stencil, logarithmicDepthBuffer: !!p.logarithmicDepthBuffer });
    window.__mojRenderer = { drew: 'webgpu', why: 'spike' };
    // the live light's budget (channels/cast-shadows.js) wraps the classic shadow map's render() to count its passes; the
    // node renderer draws its shadows inside render() and has no such method: a no-op so the wrap binds (its count reads 0)
    if (this.shadowMap && typeof this.shadowMap.render !== 'function') this.shadowMap.render = () => {};
  }
}
${shader === 'stub' ? `// a GLSL ShaderMaterial does not run on the node renderer: drawn as a plain material, counted, so the image shows the gap
window.__mojGaps = { shaderMaterial: 0, onBeforeCompile: 0 };
export class ShaderMaterial extends T.MeshBasicNodeMaterial {
  constructor(p = {}) {
    super({ color: 0xff00ff, ...(p.side === undefined ? {} : { side: p.side }), transparent: !!p.transparent, depthWrite: p.depthWrite !== false, depthTest: p.depthTest !== false });
    this.uniforms = p.uniforms || {}; this.vertexShader = p.vertexShader || ''; this.fragmentShader = p.fragmentShader || ''; this.defines = p.defines || {};
    this.glslVersion = p.glslVersion || null; this.isShaderMaterial = true;
    window.__mojGaps.shaderMaterial++;
  }
}
export const RawShaderMaterial = ShaderMaterial;` : ''}
`;
}

// ONE HOOK PORTED BY HAND (`ports: ['sea']`): the form render's sea (channels/form-land.js), its alpha faded by the
// seabed's depth map, as GLSL patched in by onBeforeCompile, and the same as a TSL opacity node. The GLSL text the
// page carries is matched whole, so a page whose sea changed fails loud rather than drawing a stale port.
const SEA_GLSL = /m\.onBeforeCompile = \(sh\) => \{\n\s*Object\.assign\(sh\.uniforms, \{ tDepth: \{ value: dm \}, uDO: \{ value: (new THREE\.Vector2\([^)]*\)) \}, uDM: \{ value: (new THREE\.Vector2\(w, h\)) \}, uDMax: \{ value: Q\.max \} \}\);\n[^\n]*\n[^\n]*\n\s*\};\n/;
const SEA_TSL = (uDO, uDM) => `{ const T = TSL, uDO = T.uniform(${uDO}), uDM = T.uniform(${uDM}), uDMax = T.uniform(Q.max);
      // (the TSL twin of the GLSL above: the sea's alpha faded by the seabed's depth inside the depth map, whole outside it)
      const du = T.positionWorld.xy.sub(uDO).div(uDM);
      const inside = du.x.greaterThanEqual(0).and(du.y.greaterThanEqual(0)).and(du.x.lessThanEqual(1)).and(du.y.lessThanEqual(1));
      m.opacityNode = T.float(m.opacity).mul(T.select(inside, T.smoothstep(0, uDMax, T.texture(dm, du).r.mul(uDMax)), T.float(1)));
      window.__mojPorted = (window.__mojPorted || []).concat('sea'); }
`;
const PORTS = {
  sea: (html) => {
    const m = html.match(SEA_GLSL);
    if (!m) throw new Error('the sea\'s GLSL is not on the page as the port knows it');
    // the sea's material as a node material, so its opacity takes a node
    const at = html.indexOf(m[0]), head = html.lastIndexOf('const m = new THREE.MeshStandardMaterial(', at);
    const swapped = html.slice(0, head) + 'const m = new THREE.MeshStandardNodeMaterial(' + html.slice(head + 'const m = new THREE.MeshStandardMaterial('.length, at) + SEA_TSL(m[1], m[2]) + html.slice(at + m[0].length);
    return swapped;
  },
};

/** today's page → the swapped page */
export function toWebgpu(html, { shader = 'stub', ports = [] } = {}) {
  for (const p of ports) { if (!PORTS[p]) throw new Error(`no port named ${p} (${Object.keys(PORTS).join(', ')})`); html = PORTS[p](html); }
  if (ports.length) html = html.replace("import * as THREE from 'three';\n", "import * as THREE from 'three';\nimport * as TSL from 'three/tsl';\n");
  const im = html.match(/<script type="importmap">([\s\S]*?)<\/script>/);
  if (!im) throw new Error('no importmap on the page');
  const map = JSON.parse(im[1]);
  if (!map.imports || !map.imports.three || !map.imports.three.startsWith('/vendor/')) throw new Error('the spike swaps the vendor-served page only (not cdn, not inline)');
  const imports = { ...map.imports, three: `${GPU_VENDOR}shim.js`, 'three-webgpu': `${GPU_VENDOR}three.webgpu.min.js`, 'three/webgpu': `${GPU_VENDOR}three.webgpu.min.js`, 'three/tsl': `${GPU_VENDOR}three.tsl.min.js` };
  let out = html.replace(im[0], `<script type="importmap">${JSON.stringify({ imports })}</script>`);
  const ctor = out.match(/const renderer = new THREE\.WebGLRenderer\([^\n]*\);\n/);
  if (!ctor) throw new Error('no renderer line on the page');
  out = out.replace(ctor[0], `${ctor[0]}await renderer.init(); window.__mojDevice = renderer.backend && renderer.backend.device;   // (the spike: the node renderer starts asynchronously)\n`);
  // count the patches the node renderer will ignore, as the page runs them
  out = out.replace(/(\b[\w.]+)\.onBeforeCompile = /g, (m, who) => `(window.__mojGaps && window.__mojGaps.onBeforeCompile++), ${who}.onBeforeCompile = `);
  if (shader !== 'stub' && shader !== 'raw') throw new Error(`shader is stub or raw, not ${shader}`);
  return out;
}
