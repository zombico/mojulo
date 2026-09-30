process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
process.env.MOJULO_DISABLE_SCENE_WARM = '1';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { dispatchMcpRequest, ensureToolsRegistered, listTools, invokeRegisteredTool } from '../server.js';
import { meshPreviewResult } from '../tools/preview-world.js';
import { previewResource, PREVIEW_URI, MAX_PREVIEW_BYTES } from './preview.js';
import { composeWorld } from '../tools/compose-world.js';
import { updateSketchHandler } from '../tools/sketch-mint.js';
const rpc = (method, params = {}, context = {}) => dispatchMcpRequest({ jsonrpc: '2.0', id: 1, method, params }, context);
let output;
beforeAll(async () => { output = mkdtempSync(path.join(tmpdir(), 'mojulo-preview-')); await ensureToolsRegistered(); });
afterEach(() => vi.unstubAllEnvs());
afterAll(() => rmSync(output, { recursive: true, force: true }));
function enable() { vi.stubEnv('MOJULO_MCP_APPS', '1'); vi.stubEnv('MOJULO_OUTCOMES_DIR', output); }
describe('MCP Apps preview', () => {
  it('is absent by default and rejects direct calls', async () => {
    vi.stubEnv('MOJULO_MCP_APPS', '');
    expect(listTools().some(t => t.name === 'preview_world')).toBe(false);
    expect((await rpc('initialize')).result.capabilities.resources).toBeUndefined();
    expect((await rpc('resources/list')).error.code).toBe(-32601);
    await expect(invokeRegisteredTool('preview_world', { ref: 'anything' })).rejects.toThrow(/disabled/);
  });
  it('lists a standalone render tool in both modes with a readable resource', async () => {
    enable();
    for (const mode of ['on', 'off']) {
      vi.stubEnv('MOJULO_TOOL_PACKS', mode);
      const tool = listTools().find(t => t.name === 'preview_world');
      expect(tool._meta.ui.resourceUri).toBe(PREVIEW_URI);
      expect(tool.annotations.readOnlyHint).toBe(false);
      expect(tool.outputSchema.required).toContain('revision');
    }
    expect((await rpc('initialize')).result.capabilities.resources).toBeDefined();
    expect((await rpc('resources/list')).result.resources[0].uri).toBe(PREVIEW_URI);
    const resource = (await rpc('resources/read', { uri: PREVIEW_URI })).result.contents[0];
    expect(resource.mimeType).toBe('text/html;profile=mcp-app');
    expect(resource._meta.ui.csp.connectDomains).toEqual([]);
    expect(resource.text).toContain('ui/initialize');
    expect(resource.text).not.toContain('<iframe');
    expect((await rpc('resources/read', { uri: 'file:///etc/passwd' })).error.code).toBe(-32002);
  });
  it('keeps the Claude plugin surface unchanged even when opted in', async () => {
    enable(); vi.stubEnv('MOJULO_DISTRIBUTION', 'claude-plugin');
    expect(listTools().some(t => t.name === 'preview_world')).toBe(false);
    expect((await rpc('resources/list')).error.code).toBe(-32601);
    const called = await rpc('tools/call', { name: 'preview_world', arguments: { ref: 'anything' } });
    const said = called.result?.content?.[0]?.text ?? called.error?.message ?? '';
    expect(said).toContain("'preview_world' is not part of the Claude plugin build of mojulo.");
    expect(said).not.toMatch(/MOJULO_MCP_APPS|npm|source server/);
  });
  it('does not expose preview to a delegated role', async () => {
    enable(); vi.stubEnv('MOJULO_ROLES', 'enabled');
    const context = { userRole: 'PRIVILEGED', userId: 'preview-delegate', userGrants: [] };
    expect(listTools({ context }).some(t => t.name === 'preview_world')).toBe(false);
    expect((await rpc('tools/call', { name: 'preview_world', arguments: { ref: 'anything' } }, context)).error).toBeDefined();
  });
  it('keeps geometry out of model text and refreshes the same recipe ref', async () => {
    enable();
    composeWorld({ base: 'city', seed: 91, title: 'Preview city', ref: 'apps_city', overrides: { context: { depth: 2 }, region: { x: 0, y: 0, w: 16, d: 16 } } });
    const a = (await rpc('tools/call', { name: 'preview_world', arguments: { ref: 'apps_city' } })).result;
    expect(a.isError).not.toBe(true);
    const glb = Buffer.from(a._meta['mojulo/preview'].glb, 'base64');
    expect(glb.subarray(0, 4).toString()).toBe('glTF');
    expect(JSON.stringify(a.structuredContent)).not.toContain('glb');
    expect(JSON.stringify(a.content)).not.toContain(a._meta['mojulo/preview'].glb);
    await updateSketchHandler({ ref: 'apps_city', patch: [{ op: 'set', path: '/seed', value: 92 }] });
    const b = await invokeRegisteredTool('preview_world', { ref: 'apps_city' });
    expect(b.structuredContent.ref).toBe(a.structuredContent.ref);
    expect(b.structuredContent.revision).not.toBe(a.structuredContent.revision);
    if (process.env.MOJULO_APPS_SMOKE_DIR) {
      writeFileSync(path.join(process.env.MOJULO_APPS_SMOKE_DIR, 'preview.html'), previewResource().text);
      writeFileSync(path.join(process.env.MOJULO_APPS_SMOKE_DIR, 'results.json'), JSON.stringify([a, b]));
    }
  });
  it('refuses oversized inline payloads before base64 serialization', () => {
    expect(() => meshPreviewResult('big', 'Big', Buffer.alloc(MAX_PREVIEW_BYTES + 1))).toThrow(/8 MiB/);
  });
  it('returns an in-band failure for missing or invalid refs', async () => {
    enable();
    for (const ref of ['../bad', 'missing_apps_ref']) {
      const r = (await rpc('tools/call', { name: 'preview_world', arguments: { ref } })).result;
      expect(r.isError).toBe(true); expect(r._meta).toBeUndefined();
    }
  });
});
