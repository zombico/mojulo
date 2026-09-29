import { readFileSync } from 'node:fs';
import path from 'node:path';
import { moduleDir } from '../../module-dir.js';
import { inlineImportmap, safeJson } from '../../graph/scene/emit-util.js';
import { pluginProfileActive } from '../plugin-profile.js';

export const PREVIEW_URI = 'ui://mojulo/mesh-preview/v1.html';
export const PREVIEW_MIME = 'text/html;profile=mcp-app';
export const MAX_PREVIEW_BYTES = 8 * 1024 * 1024;
export const appsEnabled = (env = process.env) => env.MOJULO_MCP_APPS === '1' && !pluginProfileActive(env);
const dir = moduleDir(import.meta.url, 'lib/mcp/apps');

export function previewResource() {
  const imports = JSON.parse(inlineImportmap()).imports;
  const vendor = path.resolve(dir, '../../../public/vendor/three/addons');
  for (const name of ['utils/BufferGeometryUtils.js', 'utils/SkeletonUtils.js', 'loaders/GLTFLoader.js']) {
    const source = readFileSync(path.join(vendor, name), 'utf8')
      .replaceAll('../utils/BufferGeometryUtils.js', 'three/addons/utils/BufferGeometryUtils.js')
      .replaceAll('../utils/SkeletonUtils.js', 'three/addons/utils/SkeletonUtils.js');
    imports['three/addons/' + name] = 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
  }
  const script = readFileSync(path.join(dir, 'preview-ui.js'), 'utf8');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mojulo preview</title><style>
*{box-sizing:border-box}body{margin:0;background:#111820;color:#edf3f8;font:14px system-ui}header{display:flex;align-items:center;gap:12px;padding:12px 16px}#label{flex:1;overflow-wrap:anywhere}button{padding:8px 12px;border:1px solid #64748b;border-radius:8px;background:#253448;color:inherit;cursor:pointer}button:disabled{opacity:.5}#view{height:420px;max-height:70vh;min-height:240px}canvas{display:block;width:100%;height:100%;touch-action:none}#status{padding:0 16px 12px;color:#bdcbd9}button:focus-visible{outline:2px solid #9bceff}
</style><script type="importmap">${safeJson({ imports })}</script></head><body>
<header><strong id="label">Mojulo mesh preview</strong><button id="refresh" disabled>Refresh</button><button id="reset" disabled>Reset view</button></header>
<div id="view" aria-label="Interactive 3D model"></div><p id="status" role="status">Connecting to preview…</p>
<script type="module">${script}</script></body></html>`;
  return { uri: PREVIEW_URI, mimeType: PREVIEW_MIME, text: html, _meta: { ui: {
    prefersBorder: true, csp: { connectDomains: [], resourceDomains: [], frameDomains: [] },
  } } };
}
