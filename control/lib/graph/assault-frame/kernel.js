/**
 * THE FRAME KERNEL — the assault frame's modules as ONE page-runnable source, so a level can stand any build the player
 * chose in its garage (the hangar, the frame levels' `hangar` slice) without the server: the parts (parts.js), the
 * assembly (assemble.js), the body (body.js), its clips (clips.js), its entity (pilot.js) and its figure (figure.js,
 * packed by vehicle-rig.js's own packVehicleFigure and packFormMesh), each module's source in a closure of its own (its
 * helpers private, as in its file), its exports lifted for the modules after it.
 *
 * SINGLE SOURCE OF TRUTH: the page runs the modules' own text, read beside this file, its imports dropped (each is a
 * module earlier in the list, or the dice's two functions and the rig's packers, cut from their files); nothing is
 * re-written for the page. The figure's light is the one thing a page has and the kernel has not: the world's sky
 * (form-light.js), handed to it (`light`), the level's own pilot's.
 *
 *   frameKernelSource()     → the source: an expression whose value is
 *                             { PARTS, SLOTS, WEAPON_SLOTS, STOCK, readBuild, assembleFrame, frameEntity, frameMounts,
 *                               frameFigure(spec, light) }
 *   buildFrameKernel()      → that object, made here (`new Function` over the same source): what the tests hold to the
 *                             modules, byte for byte
 *
 * The tripwire (kernel.test.js): a figure and an entity from the kernel equal the modules' for a build that is no stock
 * frame's. A module that comes to import something the kernel does not carry fails it.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// (in the order they import each other: each module's imports are the lifted exports of those before it)
const MODULES = Object.freeze(['parts.js', 'assemble.js', 'body.js', 'clips.js', 'pilot.js', 'figure.js']);
// (what a module imports from outside the frame's folder, and what stands for it in the kernel)
const OUTSIDE = Object.freeze({
  '../city/plan/dice.js': ['mulberry32', 'strHash'],
  '../vehicle-designer/vehicle-rig.js': ['packVehicleFigure'],
  '../car-designer/form-light.js': ['formLight', 'skyMood'],
});

/** One top-level declaration's text out of a file beside the frame's (`export function name…` or `export const name = …`),
 *  its braces matched: a helper the kernel carries as its file has it (a function's toString would carry a bundler's
 *  rewritten imports). */
function declared(rel, name) {
  const src = readFileSync(path.join(HERE, rel), 'utf8');
  const m = new RegExp(`^export\\s+(function\\s+${name}\\b|const\\s+${name}\\s*=)`, 'm').exec(src);
  if (!m) throw new Error(`frame kernel: ${rel} declares no ${name}`);
  // (a function's body opens after its parameters close: a destructured parameter has braces of its own)
  let i = m.index;
  if (m[1].startsWith('function')) { let p = 0; i = src.indexOf('(', i); for (; i < src.length; i++) { if (src[i] === '(') p++; else if (src[i] === ')' && --p === 0) break; } }
  i = src.indexOf('{', i);
  let depth = 0;
  for (; i < src.length; i++) { const c = src[i]; if (c === '{') depth++; else if (c === '}' && --depth === 0) break; }
  let end = i + 1;
  if (src[end] === ';') end++;
  return src.slice(m.index, end).replace(/^export\s+/, '');
}

/** A module's text with its imports dropped and its `export`s made plain; its exported names. */
function spliced(file) {
  const src = readFileSync(path.join(HERE, file), 'utf8');
  const names = [];
  const body = src
    .replace(/^import\s+\{([^}]*)\}\s+from\s+'([^']+)';\s*$/gm, (m, list, from) => {
      if (!from.startsWith('./') && !OUTSIDE[from]) throw new Error(`frame kernel: ${file} imports from '${from}', which the kernel does not carry`);
      for (const n of list.split(',').map((s) => s.trim()).filter(Boolean)) if (OUTSIDE[from] && !OUTSIDE[from].includes(n)) throw new Error(`frame kernel: ${file} imports ${n} from '${from}', which the kernel does not carry`);
      return '';
    })
    .replace(/^export\s+\{[^}]*\};?\s*$/gm, '')
    .replace(/^export\s+(function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm, (m, kw, name) => { names.push(name); return `${kw} ${name}`; });
  if (/^\s*(import|export)\b/m.test(body)) throw new Error(`frame kernel: ${file} has an import or export the kernel cannot splice`);
  return { body, names };
}

export function frameKernelSource() {
  const parts = MODULES.map((m) => ({ m, ...spliced(m) }));
  const lift = (p) => `const { ${p.names.join(', ')} } = (() => {\n${p.body}\nreturn { ${p.names.join(', ')} };\n})();`;
  return `(() => {
// (the base64 the rig's packers write: a page has no Buffer)
const Buffer = { from(ab) { const u = new Uint8Array(ab); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return { toString() { return btoa(s); } }; } };
${declared('../city/plan/dice.js', 'mulberry32')}
${declared('../city/plan/dice.js', 'strHash')}
// (the rig's packers, as vehicle-rig.js has them; a frame's every bone is in the form render, so only the form packer runs)
const { packVehicleFigure } = (() => {
  const r4 = (n) => Math.round(n * 1e4) / 1e4 + 0;
  ${declared('../figures/rig-bake.js', 'b64u8')}
  const faceListToMesh = () => { throw new Error('frame kernel: a baked bone'); }, packRigMesh = faceListToMesh, b64f32 = faceListToMesh;
  ${declared('../vehicle-designer/vehicle-rig.js', 'packFormMesh')}
  ${declared('../vehicle-designer/vehicle-rig.js', 'packVehicleFigure')}
  return { packVehicleFigure };
})();
// (the world's light, the page's own pilot's: handed to frameFigure)
let __light = null;
const skyMood = () => null, formLight = () => __light;
${parts.map(lift).join('\n')}
const frameFigureLit = (spec, light) => { __light = light; try { return frameFigure(spec); } finally { __light = null; } };
return { PARTS, SLOTS, WEAPON_SLOTS, STOCK, readBuild, assembleFrame, frameEntity, frameMounts, frameFigure: frameFigureLit };
})()`;
}

let KERNEL = null;
/** The kernel made here, from the same source the page runs. */
export function buildFrameKernel() {
  return (KERNEL ??= new Function(`return ${frameKernelSource()};`)());
}
