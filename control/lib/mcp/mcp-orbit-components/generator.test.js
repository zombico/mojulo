import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { generateProviderArtifact, _internals } from './generator.js';

const {
  parsePrimitiveFile,
  buildManifest,
  fillConditionals,
  fillSubstitutions,
  indexToolsByName,
  formatUnboundList,
} = _internals;

// Capability snapshots that approximate two real document-store MCPs the agent
// might see, with deliberately divergent tool names so the generator can't
// pass by guessing — it has to honor the bindings the caller passes in.
//
// These are fixtures, NOT verified introspections. The generator's contract is
// "given THIS snapshot and THESE bindings, render correctly." Whether the
// snapshot itself matches reality is the agent's responsibility, not the
// generator's.
const DRIVE_SNAPSHOT = {
  server: 'claude_ai_Google_Drive',
  introspected_at: '2026-05-24T18:00:00Z',
  introspection_confidence: 'tools_list_full',
  tools: [
    {
      name: 'search_files',
      description: 'Search files by name or full-text.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          folder_id: { type: 'string' },
        },
        required: ['query'],
      },
    },
    {
      name: 'read_file_content',
      inputSchema: {
        type: 'object',
        properties: { file_id: { type: 'string' } },
        required: ['file_id'],
      },
    },
    {
      name: 'list_recent_files',
      inputSchema: {
        type: 'object',
        properties: {
          folder_id: { type: 'string' },
          modified_after: { type: 'string', format: 'date-time' },
        },
      },
    },
    {
      name: 'get_file_metadata',
      inputSchema: {
        type: 'object',
        properties: { file_id: { type: 'string' } },
        required: ['file_id'],
      },
    },
    {
      name: 'create_file',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          mime_type: { type: 'string' },
          parents: { type: 'array', items: { type: 'string' } },
          content: { type: 'string' },
        },
        required: ['name', 'mime_type'],
      },
    },
    {
      name: 'copy_file',
      inputSchema: {
        type: 'object',
        properties: { file_id: { type: 'string' }, destination_folder: { type: 'string' } },
      },
    },
  ],
};

// A deliberately thinner snapshot: tool names that are different from Drive's,
// no append-to-existing, no move-to-folder, names-only confidence to exercise
// the lower-confidence path.
const NOTION_SNAPSHOT = {
  server: 'claude_ai_Notion',
  introspected_at: '2026-05-24T18:05:00Z',
  introspection_confidence: 'names_only',
  tools: [
    { name: 'searchPages', inputSchema: null },
    { name: 'readPageContent', inputSchema: null },
    { name: 'listRecentPages', inputSchema: null },
    { name: 'createPage', inputSchema: null },
  ],
};

const DRIVE_SOURCE_BINDINGS = {
  'find-by-key-in-scope': { tool: 'search_files', confidence: 'agent-inferred' },
  'read-content': { tool: 'read_file_content', confidence: 'agent-inferred' },
  'list-recent': { tool: 'list_recent_files', confidence: 'operator-confirmed' },
  'get-metadata': { tool: 'get_file_metadata', confidence: 'agent-inferred' },
  // subscribe-to-changes intentionally unbound — Drive doesn't expose push.
};

const DRIVE_DESTINATION_BINDINGS = {
  'create-with-mime': { tool: 'create_file', confidence: 'operator-confirmed' },
  'find-by-key-in-scope': { tool: 'search_files', confidence: 'agent-inferred' },
  // append-to-existing intentionally unbound — Drive's MCP has no append shape here.
  'move-to-folder': { tool: 'copy_file', confidence: 'agent-inferred' },
};

const NOTION_SOURCE_BINDINGS = {
  'find-by-key-in-scope': { tool: 'searchPages', confidence: 'agent-inferred' },
  'read-content': { tool: 'readPageContent', confidence: 'agent-inferred' },
  'list-recent': { tool: 'listRecentPages', confidence: 'agent-inferred' },
  // get-metadata, subscribe-to-changes unbound
};

describe('parsePrimitiveFile', () => {
  it('parses a well-formed primitive with affordances', () => {
    const raw =
      '---\n' +
      JSON.stringify({
        ref: 'document-store',
        version: '0.1.0',
        summary: 's',
        affordances: {
          source: [{ name: 'list-recent', support: 'expected' }],
          destination: [{ name: 'create-with-mime', support: 'expected' }],
        },
      }) +
      '\n---\n\nbody';
    const meta = parsePrimitiveFile('document-store.md', raw);
    expect(meta.ref).toBe('document-store');
    expect(meta.affordances.source).toHaveLength(1);
    expect(meta.affordances.destination).toHaveLength(1);
  });

  it('throws when frontmatter fences are missing', () => {
    expect(() => parsePrimitiveFile('x.md', '# body')).toThrow(/missing JSON frontmatter/);
  });

  it('throws when affordances is missing', () => {
    const raw =
      '---\n' +
      JSON.stringify({ ref: 'x', version: '0.1.0', summary: 's' }) +
      '\n---\n\nbody';
    expect(() => parsePrimitiveFile('x.md', raw)).toThrow(/missing required 'affordances'/);
  });

  it('throws on malformed JSON', () => {
    expect(() => parsePrimitiveFile('x.md', '---\n{ not valid }\n---\n\nbody')).toThrow(
      /invalid JSON frontmatter/,
    );
  });
});

describe('indexToolsByName', () => {
  it('builds a name→tool map and skips malformed entries', () => {
    const idx = indexToolsByName({
      tools: [
        { name: 'a' },
        { name: 'b', inputSchema: { type: 'object' } },
        null,
        { description: 'no name' },
      ],
    });
    expect(idx.size).toBe(2);
    expect(idx.get('a')).toEqual({ name: 'a' });
    expect(idx.get('b').inputSchema).toEqual({ type: 'object' });
  });

  it('returns empty map for missing tools list', () => {
    expect(indexToolsByName({}).size).toBe(0);
    expect(indexToolsByName(null).size).toBe(0);
  });
});

describe('buildManifest', () => {
  const primitiveMeta = {
    affordances: {
      source: [
        { name: 'list-recent', support: 'expected' },
        { name: 'subscribe-to-changes', support: 'rare' },
      ],
    },
  };

  it('classifies declared affordances as bound vs unbound', () => {
    const toolsByName = indexToolsByName({
      tools: [{ name: 'list_recent_files', inputSchema: { type: 'object' } }],
    });
    const manifest = buildManifest({
      role: 'source',
      primitiveMeta,
      bindings: {
        'list-recent': { tool: 'list_recent_files', confidence: 'operator-confirmed' },
      },
      toolsByName,
    });
    expect(manifest.bound).toHaveLength(1);
    expect(manifest.bound[0]).toMatchObject({
      affordance: 'list-recent',
      tool: 'list_recent_files',
      confidence: 'operator-confirmed',
    });
    expect(manifest.bound[0].schema).toEqual({ type: 'object' });
    expect(manifest.unbound).toHaveLength(1);
    expect(manifest.unbound[0].affordance).toBe('subscribe-to-changes');
    expect(manifest.declaredCount).toBe(2);
  });

  it('treats a binding pointing to a missing tool as unbound, with a reason', () => {
    const toolsByName = indexToolsByName({ tools: [] });
    const manifest = buildManifest({
      role: 'source',
      primitiveMeta,
      bindings: { 'list-recent': { tool: 'nonexistent_tool' } },
      toolsByName,
    });
    expect(manifest.bound).toHaveLength(0);
    expect(manifest.unbound).toHaveLength(2);
    const listRecent = manifest.unbound.find((u) => u.affordance === 'list-recent');
    expect(listRecent.reason).toMatch(/not in the snapshot/);
  });

  it('defaults confidence to agent-inferred when binding omits it', () => {
    const toolsByName = indexToolsByName({
      tools: [{ name: 'list_recent_files' }],
    });
    const manifest = buildManifest({
      role: 'source',
      primitiveMeta,
      bindings: { 'list-recent': { tool: 'list_recent_files' } },
      toolsByName,
    });
    expect(manifest.bound[0].confidence).toBe('agent-inferred');
  });
});

describe('fillConditionals', () => {
  it('keeps if-bound block content when affordance is bound, removes otherwise', () => {
    const tpl =
      '{{if-bound:list-recent}}YES{{/if-bound:list-recent}}|{{if-bound:absent}}NO{{/if-bound:absent}}';
    const out = fillConditionals(tpl, {
      bound: [{ affordance: 'list-recent' }],
      unbound: [],
    });
    expect(out).toBe('YES|');
  });

  it('keeps if-unbound block content when affordance is unbound, removes otherwise', () => {
    const tpl =
      '{{if-unbound:list-recent}}A{{/if-unbound:list-recent}}|{{if-unbound:absent}}B{{/if-unbound:absent}}';
    const out = fillConditionals(tpl, {
      bound: [{ affordance: 'list-recent' }],
      unbound: [],
    });
    expect(out).toBe('|B');
  });

  it('handles multi-line conditional blocks', () => {
    const tpl =
      'before\n{{if-bound:x}}\nline-1\nline-2\n{{/if-bound:x}}\nafter';
    const kept = fillConditionals(tpl, { bound: [{ affordance: 'x' }], unbound: [] });
    expect(kept).toContain('line-1');
    expect(kept).toContain('line-2');
    const removed = fillConditionals(tpl, { bound: [], unbound: [{ affordance: 'x' }] });
    expect(removed).not.toContain('line-1');
    expect(removed).toContain('before');
    expect(removed).toContain('after');
  });
});

describe('formatUnboundList', () => {
  it('returns a placeholder when nothing is unbound', () => {
    expect(formatUnboundList([])).toMatch(/none — all declared affordances are bound/);
  });

  it('renders each unbound affordance with its support hint', () => {
    const out = formatUnboundList([
      { affordance: 'a', support: 'rare' },
      { affordance: 'b', support: 'likely', reason: 'bound to missing tool' },
    ]);
    expect(out).toContain('`a` (support: rare)');
    expect(out).toContain('`b` (support: likely; bound to missing tool)');
  });
});

describe('fillSubstitutions', () => {
  it('fills server / introspection slots and per-affordance slots', () => {
    const tpl =
      'server={{server}} ts={{introspected_at}} conf={{snapshot_confidence}}\n' +
      'tool={{tool:list-recent}} confidence={{confidence:list-recent}}\n' +
      'schema=\n```json\n{{schema:list-recent}}\n```\n' +
      'unbound: {{unbound_affordances}}';
    const out = fillSubstitutions(tpl, {
      snapshot: {
        server: 'srv',
        introspected_at: 'T',
        introspection_confidence: 'tools_list_full',
      },
      manifest: {
        bound: [
          {
            affordance: 'list-recent',
            tool: 'list_recent_files',
            confidence: 'operator-confirmed',
            schema: { type: 'object' },
          },
        ],
        unbound: [{ affordance: 'sub', support: 'rare' }],
      },
    });
    expect(out).toContain('server=srv');
    expect(out).toContain('ts=T');
    expect(out).toContain('conf=tools_list_full');
    expect(out).toContain('tool=list_recent_files');
    expect(out).toContain('confidence=operator-confirmed');
    expect(out).toContain('"type": "object"');
    expect(out).toContain('`sub` (support: rare)');
  });

  it('uses placeholders for unbound slots', () => {
    const tpl = '{{tool:absent}} {{confidence:absent}} {{schema:absent}}';
    const out = fillSubstitutions(tpl, {
      snapshot: { server: 's', introspected_at: 't' },
      manifest: { bound: [], unbound: [{ affordance: 'absent' }] },
    });
    expect(out).toContain('<UNBOUND>');
    expect(out).toContain('—');
    expect(out).toContain('(no schema available)');
  });
});

describe('generateProviderArtifact — end to end against shipped primitive', () => {
  it('generates a Drive source-role artifact with bound + unbound affordances', () => {
    const result = generateProviderArtifact({
      primitive: 'document-store',
      role: 'source',
      snapshot: DRIVE_SNAPSHOT,
      bindings: DRIVE_SOURCE_BINDINGS,
    });
    expect(result.primitive).toBe('document-store@0.1.0');
    expect(result.role).toBe('source');
    expect(result.server).toBe('claude_ai_Google_Drive');
    expect(result.snapshotConfidence).toBe('tools_list_full');

    // Server / timestamp slots filled
    expect(result.body).toContain('claude_ai_Google_Drive');
    expect(result.body).toContain('2026-05-24T18:00:00Z');

    // Bound tool names render in the body
    expect(result.body).toContain('search_files');
    expect(result.body).toContain('read_file_content');
    expect(result.body).toContain('list_recent_files');
    expect(result.body).toContain('get_file_metadata');

    // Unbound subscribe-to-changes renders as placeholder + unbound list
    expect(result.body).toContain('<UNBOUND>');
    expect(result.body).toContain('`subscribe-to-changes`');

    // The if-unbound:subscribe-to-changes block should be present (push not available)
    expect(result.body).toContain('signal-polled');
    // The if-bound:subscribe-to-changes block should NOT be present
    expect(result.body).not.toContain('signal-push');

    // Schema slot rendered for a bound tool
    expect(result.body).toContain('"folder_id"');
    expect(result.body).toContain('"modified_after"');

    // No unfilled slots in the body
    expect(result.body).not.toMatch(/\{\{[^}]+\}\}/);

    // Manifest matches body assertions
    expect(result.manifest.declaredCount).toBe(5);
    expect(result.manifest.bound).toHaveLength(4);
    expect(result.manifest.unbound).toHaveLength(1);
    expect(result.manifest.unbound[0].affordance).toBe('subscribe-to-changes');

    // Confidence per binding is preserved
    const listRecentBound = result.manifest.bound.find((b) => b.affordance === 'list-recent');
    expect(listRecentBound.confidence).toBe('operator-confirmed');
  });

  it('generates a Drive destination-role artifact with bound + unbound affordances', () => {
    const result = generateProviderArtifact({
      primitive: 'document-store',
      role: 'destination',
      snapshot: DRIVE_SNAPSHOT,
      bindings: DRIVE_DESTINATION_BINDINGS,
    });
    expect(result.role).toBe('destination');

    expect(result.body).toContain('create_file');
    expect(result.body).toContain('search_files');
    expect(result.body).toContain('copy_file');

    // append-to-existing is unbound on Drive in this fixture
    expect(result.body).toContain('`append-to-existing`');
    expect(result.body).toContain('one document per period');
    // The if-bound:append-to-existing block (mentioning rolling-document) should NOT render
    expect(result.body).not.toMatch(/`doc_strategy` knob to the operator at composition time\./);

    // move-to-folder IS bound, so the bound conditional renders
    expect(result.body).toContain('promotion via "draft folder');

    expect(result.manifest.declaredCount).toBe(4);
    expect(result.manifest.bound).toHaveLength(3);
    expect(result.manifest.unbound).toHaveLength(1);
    expect(result.manifest.unbound[0].affordance).toBe('append-to-existing');

    expect(result.body).not.toMatch(/\{\{[^}]+\}\}/);
  });

  it('generates a Notion source-role artifact from a names-only snapshot', () => {
    const result = generateProviderArtifact({
      primitive: 'document-store',
      role: 'source',
      snapshot: NOTION_SNAPSHOT,
      bindings: NOTION_SOURCE_BINDINGS,
    });
    expect(result.server).toBe('claude_ai_Notion');
    expect(result.snapshotConfidence).toBe('names_only');

    // The body picks up Notion's actual tool names from the bindings
    expect(result.body).toContain('searchPages');
    expect(result.body).toContain('readPageContent');
    expect(result.body).toContain('listRecentPages');

    // Schema slots render the "no schema available" placeholder because the
    // snapshot is names-only.
    expect(result.body).toContain('(no schema available)');

    // get-metadata and subscribe-to-changes are unbound for Notion in this fixture
    expect(result.manifest.unbound.map((u) => u.affordance).sort()).toEqual([
      'get-metadata',
      'subscribe-to-changes',
    ]);

    expect(result.body).not.toMatch(/\{\{[^}]+\}\}/);
  });

  it('rejects unknown roles', () => {
    expect(() =>
      generateProviderArtifact({
        primitive: 'document-store',
        role: 'sideways',
        snapshot: DRIVE_SNAPSHOT,
      }),
    ).toThrow(/role must be one of/);
  });

  it('rejects calls missing the snapshot', () => {
    expect(() =>
      generateProviderArtifact({ primitive: 'document-store', role: 'source' }),
    ).toThrow(/snapshot/);
  });

  it('rejects unknown primitives', () => {
    expect(() =>
      generateProviderArtifact({
        primitive: 'no-such-primitive',
        role: 'source',
        snapshot: DRIVE_SNAPSHOT,
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// issue-tracker primitive — second-primitive validation
//
// The point of this block is NOT to repeat the unit tests above with a
// different fixture — it's to validate that the slot vocabulary + generator
// hold up against a primitive whose affordance contract is genuinely
// different from document-store's. The vocabulary deliberately diverges:
//
//   - document-store: find-by-key-in-scope, create-with-mime, append-to-existing, move-to-folder
//   - issue-tracker:  find-by-filter,       create-issue,     comment-on-issue,   transition-status, update-issue-fields
//
// Shared across both primitives (where the shape genuinely transfers):
//   read-content, list-recent, get-metadata, subscribe-to-changes.
//
// If these tests pass, the generator + slot vocabulary survive a second
// primitive without changes. That's the validation gate before plumbing a
// tool surface around the architecture.
// ---------------------------------------------------------------------------

const LINEAR_SNAPSHOT = {
  server: 'claude_ai_Linear',
  introspected_at: '2026-05-24T19:00:00Z',
  introspection_confidence: 'tools_list_full',
  tools: [
    {
      name: 'list_issues',
      description: 'List issues in a team, paginated, with cursor on updatedAt.',
      inputSchema: {
        type: 'object',
        properties: {
          team_id: { type: 'string' },
          updated_after: { type: 'string', format: 'date-time' },
          limit: { type: 'number' },
        },
      },
    },
    {
      name: 'search_issues',
      inputSchema: {
        type: 'object',
        properties: {
          team_id: { type: 'string' },
          state: { type: 'string', enum: ['backlog', 'unstarted', 'started', 'completed', 'cancelled'] },
          label_ids: { type: 'array', items: { type: 'string' } },
          assignee_id: { type: 'string' },
        },
      },
    },
    {
      name: 'get_issue',
      inputSchema: {
        type: 'object',
        properties: { issue_id: { type: 'string' } },
        required: ['issue_id'],
      },
    },
    {
      name: 'get_issue_metadata',
      inputSchema: {
        type: 'object',
        properties: { issue_id: { type: 'string' } },
      },
    },
    {
      name: 'create_issue',
      inputSchema: {
        type: 'object',
        properties: {
          team_id: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          label_ids: { type: 'array', items: { type: 'string' } },
          assignee_id: { type: 'string' },
        },
        required: ['team_id', 'title'],
      },
    },
    {
      name: 'add_comment',
      inputSchema: {
        type: 'object',
        properties: {
          issue_id: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['issue_id', 'body'],
      },
    },
    {
      name: 'transition_issue',
      inputSchema: {
        type: 'object',
        properties: {
          issue_id: { type: 'string' },
          state_id: { type: 'string' },
        },
      },
    },
    {
      name: 'update_issue',
      inputSchema: {
        type: 'object',
        properties: {
          issue_id: { type: 'string' },
          label_ids: { type: 'array', items: { type: 'string' } },
          assignee_id: { type: 'string' },
          priority: { type: 'number' },
        },
      },
    },
  ],
};

// GitHub's MCP folds transitions into update_issue (no separate state-transition
// tool) and uses a different comment shape — exercises the same primitive
// against a tracker with genuinely different surface.
const GITHUB_SNAPSHOT = {
  server: 'claude_ai_GitHub',
  introspected_at: '2026-05-24T19:05:00Z',
  introspection_confidence: 'tools_list_full',
  tools: [
    {
      name: 'list_repo_issues',
      inputSchema: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
          since: { type: 'string', format: 'date-time' },
          state: { type: 'string', enum: ['open', 'closed', 'all'] },
        },
        required: ['owner', 'repo'],
      },
    },
    {
      name: 'get_issue',
      inputSchema: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
          issue_number: { type: 'number' },
        },
        required: ['owner', 'repo', 'issue_number'],
      },
    },
    {
      name: 'create_issue',
      inputSchema: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
          title: { type: 'string' },
          body: { type: 'string' },
          labels: { type: 'array', items: { type: 'string' } },
        },
        required: ['owner', 'repo', 'title'],
      },
    },
    {
      name: 'create_issue_comment',
      inputSchema: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
          issue_number: { type: 'number' },
          body: { type: 'string' },
        },
        required: ['owner', 'repo', 'issue_number', 'body'],
      },
    },
    {
      name: 'update_issue',
      // GitHub's update_issue takes state + labels + assignees together —
      // this is the surface that has to satisfy BOTH transition-status and
      // update-issue-fields, OR one of those stays unbound.
      inputSchema: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
          issue_number: { type: 'number' },
          state: { type: 'string', enum: ['open', 'closed'] },
          labels: { type: 'array', items: { type: 'string' } },
          assignees: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  ],
};

const LINEAR_SOURCE_BINDINGS = {
  'find-by-filter': { tool: 'search_issues', confidence: 'agent-inferred' },
  'read-content': { tool: 'get_issue', confidence: 'agent-inferred' },
  'list-recent': { tool: 'list_issues', confidence: 'operator-confirmed' },
  'get-metadata': { tool: 'get_issue_metadata', confidence: 'agent-inferred' },
  // subscribe-to-changes intentionally unbound — Linear's MCP doesn't expose webhook config here
};

const LINEAR_DESTINATION_BINDINGS = {
  'create-issue': { tool: 'create_issue', confidence: 'operator-confirmed' },
  'find-by-filter': { tool: 'search_issues', confidence: 'agent-inferred' },
  'comment-on-issue': { tool: 'add_comment', confidence: 'agent-inferred' },
  'transition-status': { tool: 'transition_issue', confidence: 'agent-inferred' },
  'update-issue-fields': { tool: 'update_issue', confidence: 'agent-inferred' },
};

// On GitHub, transition-status and update-issue-fields both map to the same
// update_issue tool. That's a legitimate v0 binding — the agent picks the
// best available tool for each affordance, and overlap is OK. (Whether the
// agent SHOULD double-bind a single tool to two affordances is a composition
// posture decision; the generator just renders what the bindings say.)
const GITHUB_DESTINATION_BINDINGS = {
  'create-issue': { tool: 'create_issue', confidence: 'operator-confirmed' },
  'find-by-filter': { tool: 'list_repo_issues', confidence: 'agent-inferred' },
  'comment-on-issue': { tool: 'create_issue_comment', confidence: 'agent-inferred' },
  'transition-status': { tool: 'update_issue', confidence: 'agent-inferred' },
  // update-issue-fields intentionally unbound — left to the agent to decide
  // whether GitHub's update_issue should double as the field-update path or
  // whether composing fields into transition-status calls is enough.
};

describe('generateProviderArtifact — issue-tracker primitive validation', () => {
  it('generates a Linear source-role artifact', () => {
    const result = generateProviderArtifact({
      primitive: 'issue-tracker',
      role: 'source',
      snapshot: LINEAR_SNAPSHOT,
      bindings: LINEAR_SOURCE_BINDINGS,
    });
    expect(result.primitive).toBe('issue-tracker@0.1.0');
    expect(result.role).toBe('source');
    expect(result.server).toBe('claude_ai_Linear');

    // Issue-tracker-specific affordance names render (NOT document-store names)
    expect(result.body).toContain('`find-by-filter`');
    expect(result.body).not.toContain('find-by-key-in-scope');

    // Bound tool names from the Linear snapshot
    expect(result.body).toContain('search_issues');
    expect(result.body).toContain('get_issue');
    expect(result.body).toContain('list_issues');
    expect(result.body).toContain('get_issue_metadata');

    // subscribe-to-changes is unbound — if-unbound block fires
    expect(result.body).toContain('`subscribe-to-changes`');
    expect(result.body).toContain('signal-polled');

    // Schema from the snapshot rendered for find-by-filter
    expect(result.body).toContain('"label_ids"');
    expect(result.body).toContain('"assignee_id"');

    // No unfilled slots
    expect(result.body).not.toMatch(/\{\{[^}]+\}\}/);

    expect(result.manifest.declaredCount).toBe(5);
    expect(result.manifest.bound).toHaveLength(4);
    expect(result.manifest.unbound).toHaveLength(1);
    expect(result.manifest.unbound[0].affordance).toBe('subscribe-to-changes');
  });

  it('generates a Linear destination-role artifact with full transition-status coverage', () => {
    const result = generateProviderArtifact({
      primitive: 'issue-tracker',
      role: 'destination',
      snapshot: LINEAR_SNAPSHOT,
      bindings: LINEAR_DESTINATION_BINDINGS,
    });
    expect(result.role).toBe('destination');

    // All 5 declared affordances bound on Linear in this fixture
    expect(result.body).toContain('create_issue');
    expect(result.body).toContain('search_issues');
    expect(result.body).toContain('add_comment');
    expect(result.body).toContain('transition_issue');
    expect(result.body).toContain('update_issue');

    // Issue-tracker-specific guidance renders
    expect(result.body).toContain('issue lifecycle transitions are available');
    expect(result.body).toContain('separately from `transition-status`');

    // No unfilled slots; no unbound affordances
    expect(result.body).not.toMatch(/\{\{[^}]+\}\}/);
    expect(result.manifest.unbound).toHaveLength(0);
    expect(result.manifest.bound).toHaveLength(5);
  });

  it('generates a GitHub destination-role artifact with update-issue-fields unbound', () => {
    const result = generateProviderArtifact({
      primitive: 'issue-tracker',
      role: 'destination',
      snapshot: GITHUB_SNAPSHOT,
      bindings: GITHUB_DESTINATION_BINDINGS,
    });
    expect(result.server).toBe('claude_ai_GitHub');

    // Same primitive, different tracker, different tool names
    expect(result.body).toContain('create_issue');
    expect(result.body).toContain('create_issue_comment');
    expect(result.body).toContain('list_repo_issues');
    expect(result.body).toContain('update_issue');

    // transition-status IS bound (to update_issue) — bound block fires
    expect(result.body).toContain('issue lifecycle transitions are available');

    // update-issue-fields is unbound — unbound block fires with the fallback guidance
    expect(result.body).toContain('`update-issue-fields`');
    expect(result.body).toContain('does **not** expose `update-issue-fields`');
    // The bound-only block about discovering updatable fields should NOT render
    expect(result.body).not.toContain('Discover the updatable field set from the schema below.');

    // GitHub-specific tool schema rendered correctly
    expect(result.body).toContain('"issue_number"');
    expect(result.body).toContain('"labels"');

    expect(result.body).not.toMatch(/\{\{[^}]+\}\}/);
    expect(result.manifest.bound).toHaveLength(4);
    expect(result.manifest.unbound).toHaveLength(1);
    expect(result.manifest.unbound[0].affordance).toBe('update-issue-fields');
  });

  it('renders primitive-shaped affordance names, not document-store names', () => {
    // Belt-and-suspenders: a generator bug that fell back to document-store's
    // affordance vocabulary would silently produce bodies referencing
    // 'find-by-key-in-scope' / 'create-with-mime' / 'append-to-existing' /
    // 'move-to-folder' instead. Assert none of those leak into an
    // issue-tracker artifact.
    const result = generateProviderArtifact({
      primitive: 'issue-tracker',
      role: 'destination',
      snapshot: LINEAR_SNAPSHOT,
      bindings: LINEAR_DESTINATION_BINDINGS,
    });
    const documentStoreAffordances = [
      'find-by-key-in-scope',
      'create-with-mime',
      'append-to-existing',
      'move-to-folder',
    ];
    for (const aff of documentStoreAffordances) {
      expect(result.body).not.toContain(aff);
    }
  });
});

describe('generateProviderArtifact — with an isolated tmp primitive directory', () => {
  let tmpRoot;
  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'mcp-orbit-generator-test-'));
  });
  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('renders a minimal primitive + template end to end', () => {
    writeFileSync(
      join(tmpRoot, 'tiny.md'),
      '---\n' +
        JSON.stringify({
          ref: 'tiny',
          version: '0.0.1',
          summary: 's',
          affordances: {
            source: [
              { name: 'read', support: 'expected' },
              { name: 'subscribe', support: 'rare' },
            ],
          },
        }) +
        '\n---\n\nbody',
    );
    writeFileSync(
      join(tmpRoot, 'tiny.source.template.md'),
      'srv={{server}} read={{tool:read}} subscribed={{tool:subscribe}}\n' +
        '{{if-unbound:subscribe}}fall back to poll{{/if-unbound:subscribe}}\n' +
        'unbound: {{unbound_affordances}}',
    );
    const result = generateProviderArtifact({
      primitive: 'tiny',
      role: 'source',
      snapshot: {
        server: 'mock_mcp',
        introspected_at: '2026-01-01T00:00:00Z',
        introspection_confidence: 'tools_list_full',
        tools: [{ name: 'r1', inputSchema: { type: 'object' } }],
      },
      bindings: { read: { tool: 'r1' } },
      rootDir: tmpRoot,
    });
    expect(result.body).toContain('srv=mock_mcp');
    expect(result.body).toContain('read=r1');
    expect(result.body).toContain('subscribed=<UNBOUND>');
    expect(result.body).toContain('fall back to poll');
    expect(result.body).toContain('`subscribe`');
    expect(result.manifest.bound).toHaveLength(1);
    expect(result.manifest.unbound).toHaveLength(1);
  });

  it('throws when the role has no declared affordances on the primitive', () => {
    writeFileSync(
      join(tmpRoot, 'src-only.md'),
      '---\n' +
        JSON.stringify({
          ref: 'src-only',
          version: '0.0.1',
          summary: 's',
          affordances: { source: [{ name: 'a', support: 'expected' }] },
        }) +
        '\n---\n\nbody',
    );
    expect(() =>
      generateProviderArtifact({
        primitive: 'src-only',
        role: 'destination',
        snapshot: { server: 's', introspected_at: 't', tools: [] },
        rootDir: tmpRoot,
      }),
    ).toThrow(/does not declare affordances for role 'destination'/);
  });
});
