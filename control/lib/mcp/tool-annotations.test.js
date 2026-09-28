// Isolate to in-memory SQLite — must run before any import that pulls in
// db/index.js. Same pattern as packs.test.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeAll } from 'vitest';

// ---------------------------------------------------------------------------
// Tool annotations (Anthropic directory policy 5.E): every tool a client can
// list carries a title plus readOnlyHint / destructiveHint / idempotentHint /
// openWorldHint. The table lives in lib/mcp/tool-annotations.js. A new tool
// fails here until it has a row there (or an `aliasOf` target that does).
// ---------------------------------------------------------------------------

import { TOOL_ANNOTATIONS, toolAnnotations, packAnnotations } from '@/lib/mcp/tool-annotations';
import { PACKS } from '@/lib/mcp/packs';
import { getAdapterCatalog } from '@/lib/mcp/adapters/loader';
import { listHostProfiles } from '@/lib/mcp/hosts/registry';

const HINTS = ['readOnlyHint', 'destructiveHint', 'idempotentHint', 'openWorldHint'];

let server;

beforeAll(async () => {
  server = await import('@/lib/mcp/server');
  await server.ensureToolsRegistered();
});

async function withEnv(vars, fn) {
  const prev = {};
  for (const [key, value] of Object.entries(vars)) {
    prev[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

// Every clientInfo.name a shipped profile is reached by: each adapter's hints,
// each host profile id, the Claude clients the directory reaches, and one name
// nothing recognizes (the generic fallback).
function clientNames() {
  const names = new Set(['claude-code', 'claude-ai', 'Claude Desktop', 'an-unknown-host']);
  for (const adapter of getAdapterCatalog().values()) {
    for (const hint of adapter.supportsClientInfoHint) names.add(hint);
  }
  for (const profile of listHostProfiles()) names.add(profile.id);
  return [...names];
}

// Every tools/list a client can receive: per client name under the host
// default, both forced modes, and the roles-admin surface (which adds the
// listed:false roles tools).
async function everySurface() {
  const surfaces = [];
  for (const packs of [undefined, 'on', 'off']) {
    for (const roles of [undefined, 'enabled']) {
      await withEnv({ MOJULO_TOOL_PACKS: packs, MOJULO_ROLES: roles }, async () => {
        for (const name of clientNames()) {
          surfaces.push({
            label: `${name} packs=${packs ?? 'default'} roles=${roles ?? 'off'}`,
            tools: server.listTools({ clientInfo: { name }, context: { mcpSessionId: 'annotations-test' } }),
          });
        }
      });
    }
  }
  return surfaces;
}

describe('every listed tool carries a title and all four hints', () => {
  it('on every client profile surface (claude-code flat, generic packs, each shipped host)', async () => {
    const surfaces = await everySurface();
    expect(surfaces.some((s) => s.tools.some((t) => t.name.startsWith('pack_')))).toBe(true);
    expect(surfaces.some((s) => s.tools.some((t) => t.name === 'create_beats'))).toBe(true);
    expect(surfaces.some((s) => s.tools.some((t) => t.name === 'mint_role_key'))).toBe(true);
    const bad = [];
    for (const { label, tools } of surfaces) {
      for (const t of tools) {
        const problems = [];
        if (typeof t.title !== 'string' || !t.title.trim()) problems.push('title');
        if (!t.annotations || typeof t.annotations !== 'object') problems.push('annotations');
        else {
          if (t.annotations.title !== t.title) problems.push('annotations.title');
          for (const hint of HINTS) {
            if (typeof t.annotations[hint] !== 'boolean') problems.push(hint);
          }
          if (t.annotations.readOnlyHint && t.annotations.destructiveHint) problems.push('read-only and destructive');
        }
        if (problems.length) bad.push(`${t.name} (${label}): ${problems.join(', ')}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('annotating changes no name, description or schema on the listed surface', async () => {
    await withEnv({ MOJULO_TOOL_PACKS: 'off' }, () => {
      const listed = server.listTools();
      const expected = server
        .listRegisteredToolNames()
        .filter((name) => server.isToolListed(name))
        .map((name) => server.getRegisteredTool(name));
      expect(listed.map((t) => t.name)).toEqual(expected.map((t) => t.name));
      for (const [i, t] of listed.entries()) {
        expect(t.description).toBe(expected[i].description || '');
        expect(t.inputSchema).toEqual(expected[i].inputSchema || { type: 'object', properties: {} });
        expect(Object.keys(t)).toEqual(['name', 'title', 'description', 'inputSchema', 'annotations']);
      }
    });
  });
});

describe('the annotation table', () => {
  it('classifies every registered tool (listed or not, aliases, pack dispatchers)', () => {
    const missing = server
      .listRegisteredToolNames()
      .filter((name) => !toolAnnotations(name, server.getRegisteredTool(name).aliasOf));
    expect(missing).toEqual([]);
  });

  it('has no row for a tool that is not registered', () => {
    const stale = Object.keys(TOOL_ANNOTATIONS).filter((name) => !server.hasRegisteredTool(name));
    expect(stale).toEqual([]);
  });

  it('gives a deprecated alias exactly its target\'s metadata', () => {
    const aliases = server
      .listRegisteredToolNames()
      .map((name) => server.getRegisteredTool(name))
      .filter((t) => t.aliasOf);
    expect(aliases.length).toBeGreaterThan(0);
    for (const alias of aliases) {
      expect(TOOL_ANNOTATIONS[alias.aliasOf], `${alias.name} → ${alias.aliasOf}`).toBeTruthy();
      expect(toolAnnotations(alias.name, alias.aliasOf)).toEqual(toolAnnotations(alias.aliasOf));
    }
  });

  // Cheap guard against a row copied from its neighbour: the verb in a name
  // should agree with the hint.
  it('agrees with the verb in the tool name', () => {
    const readPrefixes = ['get_', 'list_', 'diff_', 'measure_', 'status_', 'query_', 'verify_', 'inspect_'];
    const destructivePrefixes = ['delete_', 'archive_', 'unbind_', 'revoke_', 'stop_', 'reject_', 'rename_'];
    const wrong = [];
    for (const [name, [, h]] of Object.entries(TOOL_ANNOTATIONS)) {
      if (readPrefixes.some((p) => name.startsWith(p)) && !h.readOnlyHint) {
        wrong.push(`${name} reads by name but is not readOnly`);
      }
      if (destructivePrefixes.some((p) => name.startsWith(p)) && !h.destructiveHint) {
        wrong.push(`${name} removes by name but is not destructive`);
      }
    }
    expect(wrong).toEqual([]);
  });
});

describe('pack dispatchers take the union of their members', () => {
  it('is read-only only when every dispatch target is', () => {
    for (const pack of PACKS) {
      const { annotations } = packAnnotations(pack);
      const targets = [...pack.members, ...(pack.shared || [])].map((name) => TOOL_ANNOTATIONS[name][1]);
      expect(annotations.readOnlyHint, pack.id).toBe(targets.every((h) => h.readOnlyHint));
      expect(annotations.destructiveHint, pack.id).toBe(!annotations.readOnlyHint && targets.some((h) => h.destructiveHint));
      expect(annotations.openWorldHint, pack.id).toBe(targets.some((h) => h.openWorldHint));
      expect(annotations.title).toBe(pack.title);
    }
  });

  it('marks the dispatchers that front a destructive or open-world member', () => {
    expect(toolAnnotations('pack_stash').annotations.destructiveHint).toBe(true); // archive_item
    expect(toolAnnotations('pack_runtime').annotations.openWorldHint).toBe(true); // start_app
    // A pack whose every target reads is read-only. No shipped pack is today (pack_fleet was,
    // until the chatbot factory left in 3.0.0), so the rule is checked on a pack of readers.
    const readers = { id: 'pack_readers', title: 'Readers', members: ['list_cooks', 'get_cook'] };
    expect(packAnnotations(readers).annotations.readOnlyHint).toBe(true);
  });

  it('treats a member with no row as unclassified, never as safe', () => {
    const fake = { id: 'pack_readers', title: 'Readers', members: ['list_cooks', 'not_a_real_tool'] };
    expect(packAnnotations(fake).annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true, openWorldHint: true });
  });
});
