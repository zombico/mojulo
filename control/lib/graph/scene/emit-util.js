/**
 * emit-util — shared string-safety helpers for the HTML-page emitters
 * (scene-three.js, scene-css3d.js).
 *
 * safeJson — JSON.stringify for values that land inside a <script> block. The HTML
 * parser ends a script element at the first `</script>` REGARDLESS of JS string
 * context, so a manifest string carrying operator prose (a sign's text, a pick
 * label, a game name) that contains `</script>` would truncate the page script and
 * kill the World. Escaping every `<` as the backslash-u003c escape closes the whole
 * class: it is valid in both JSON and JS string literals, so the parsed runtime value is
 * unchanged — only the page source bytes differ, and only for payloads containing
 * `<`. (String() wrap: JSON.stringify(undefined) is undefined; interpolation of
 * either form renders "undefined", so behaviour is preserved for absent values.)
 *
 * escapeHtml — for raw string interpolation into markup (the <title> line).
 */

export const safeJson = (x) => String(JSON.stringify(x)).replace(/</g, '\\u003c');

export const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// typed array → base64 for the geometry/colour buffers spliced into pages (decodeF32 inverts).
export function b64(typedArray) {
  return Buffer.from(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength).toString('base64');
}

// ── three.js delivery modes (moved from scene-three.js) ──
// default → the control server's /vendor; cdn:true → jsdelivr pinned to the vendored
// revision; inline → the vendored modules embedded as data: URLs (self-contained page).

import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const VENDOR_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../public/vendor/three');

// Server-served importmap (default): three loads from the control plane's /vendor.
const VENDOR_IMPORTMAP = JSON.stringify({
  imports: {
    three: '/vendor/three/three.module.min.js',
    'three/addons/': '/vendor/three/addons/',
  },
});

// CDN importmap (cdn:true): three loads from jsdelivr as real ES modules. Pin the
// SAME revision (r184) the page is vendored against so behaviour matches /vendor.
// three.module.min.js imports './three.core.min.js' relatively — that resolves on
// the CDN's own origin, so we only map the two bare specifiers the page imports.
const CDN_THREE_VERSION = '0.184.0'; // npm version == three r184
const CDN_IMPORTMAP = JSON.stringify({
  imports: {
    three: `https://cdn.jsdelivr.net/npm/three@${CDN_THREE_VERSION}/build/three.module.min.js`,
    'three/addons/': `https://cdn.jsdelivr.net/npm/three@${CDN_THREE_VERSION}/examples/jsm/`,
  },
});

const dataModule = (src) => `data:text/javascript;base64,${Buffer.from(src, 'utf8').toString('base64')}`;

// Self-contained importmap: read the vendored three off disk and embed each module
// as a data: URL. three.module.min.js imports './three.core.min.js' relatively — we
// rewrite that to a bare specifier the map also resolves, so the whole module graph
// (three → three-core, OrbitControls → three) lives entirely in data: URLs and runs
// with no server / no file:// CORS fetch.
function inlineImportmap() {
  const core = readFileSync(path.join(VENDOR_DIR, 'three.core.min.js'), 'utf8');
  const mod = readFileSync(path.join(VENDOR_DIR, 'three.module.min.js'), 'utf8')
    .split('./three.core.min.js').join('three-core');
  const orbit = readFileSync(path.join(VENDOR_DIR, 'addons/controls/OrbitControls.js'), 'utf8');
  return JSON.stringify({
    imports: {
      'three-core': dataModule(core),
      three: dataModule(mod),
      'three/addons/controls/OrbitControls.js': dataModule(orbit),
    },
  });
}

export { VENDOR_IMPORTMAP, CDN_IMPORTMAP, inlineImportmap };
