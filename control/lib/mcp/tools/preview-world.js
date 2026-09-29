import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { registerTool, invokeRegisteredTool } from '../server.js';
import { SketchRepository } from '../../db/repositories/sketches.js';
import { appsEnabled, PREVIEW_URI, MAX_PREVIEW_BYTES } from '../apps/preview.js';

export async function previewWorldHandler(input, context) {
  if (!appsEnabled()) throw new Error('MCP Apps preview is disabled; set MOJULO_MCP_APPS=1 on an npm/source server.');
  if (!input || typeof input.ref !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(input.ref)) throw new Error('A valid stored recipe ref is required.');
  // Re-enter the existing tool gates with the same caller. No alternate export or auth path.
  const exported = await invokeRegisteredTool('export_model', { ref: input.ref, format: 'glb' }, context);
  if (!exported.ok || !exported.path) throw new Error(exported.reason || 'This recipe has no mesh preview. Use its ordinary exports.');
  if (exported.bytes > MAX_PREVIEW_BYTES) throw new Error('Mesh exceeds the 8 MiB inline preview limit. Use export_model for a file handoff.');
  const bytes = await readFile(exported.path);
  const sketch = SketchRepository.getByRef(input.ref);
  return meshPreviewResult(input.ref, sketch?.title || input.ref, bytes);
}

export function meshPreviewResult(ref, title, bytes) {
  if (bytes.length > MAX_PREVIEW_BYTES) throw new Error('Mesh exceeds the 8 MiB inline preview limit. Use export_model for a file handoff.');
  const summary = { ref, title, revision: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length };
  return {
    content: [{ type: 'text', text: `Mesh preview for ${summary.title} (${summary.ref}). Edit this ref with existing Mojulo tools, then call preview_world again. Full world controls remain in the HTML export.` }],
    structuredContent: summary,
    _meta: { 'mojulo/preview': { ...summary, glb: bytes.toString('base64') } },
  };
}

export function registerPreviewWorldTool() {
  registerTool({
    name: 'preview_world', listed: false,
    description: 'Show an interactive mesh snapshot of a stored world or solid. Edit the same ref with existing tools, then preview again. Full world/game controls and downloads use export_model.',
    inputSchema: { type: 'object', properties: { ref: { type: 'string', pattern: '^[A-Za-z0-9_-]{1,64}$' } }, required: ['ref'], additionalProperties: false },
    outputSchema: { type: 'object', properties: { ref: { type: 'string' }, title: { type: 'string' }, revision: { type: 'string' }, bytes: { type: 'integer' } }, required: ['ref', 'title', 'revision', 'bytes'], additionalProperties: false },
    _meta: { ui: { resourceUri: PREVIEW_URI, visibility: ['model', 'app'] } },
    handler: previewWorldHandler,
  });
}
