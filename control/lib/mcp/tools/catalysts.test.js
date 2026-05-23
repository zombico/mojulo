import { describe, it, expect } from 'vitest';
import {
  CATALYST_CORE_PREAMBLE,
  CONSULTATION_POSTURE,
  CUSTOM_CATALYST_GUIDE,
  buildMaterializationBlock,
  customCatalystHandler,
  getCatalystHandler,
  listCatalystsHandler,
  recommendCatalystsHandler,
} from './catalysts.js';
import { rememberClientInfo, _resetClientBindingsForTests } from '@/lib/mcp/client-bindings';

describe('CATALYST_CORE_PREAMBLE — vocabulary disambiguation', () => {
  it('names all three overlapping concepts so the model can keep them distinct', () => {
    expect(CATALYST_CORE_PREAMBLE).toMatch(/Mojulo protocols/);
    expect(CATALYST_CORE_PREAMBLE).toMatch(/runnable artifact/i);
    expect(CATALYST_CORE_PREAMBLE).toMatch(/mojulo catalyst/i);
  });

  it('uses the bare term "catalyst" rather than "skill catalyst" to keep concepts distinct', () => {
    // The bare term is load-bearing — catalysts produce artifacts, they are not artifacts.
    expect(CATALYST_CORE_PREAMBLE).not.toMatch(/skill catalyst/i);
  });

  it('names the canonical protocols so requires.protocols values resolve', () => {
    for (const p of ['knowledge', 'formGathering', 'triage', 'appointments', 'opticalRead']) {
      expect(CATALYST_CORE_PREAMBLE).toContain(p);
    }
  });

  it('points the synthesizer at the host adapter for the artifact target — not directly at .claude/skills/', () => {
    // The core preamble stays host-neutral. Specific artifact paths
    // (.claude/skills/, automation_update, workflow.md) live in the bound
    // adapter body, composed in between this preamble and the catalyst body.
    expect(CATALYST_CORE_PREAMBLE).toMatch(/host adapter/i);
    expect(CATALYST_CORE_PREAMBLE).toMatch(/runnable artifact/i);
  });

  it('makes the catalyst metaphor literal — crystallize / nucleation', () => {
    expect(CATALYST_CORE_PREAMBLE).toMatch(/crystallize/i);
    expect(CATALYST_CORE_PREAMBLE).toMatch(/nucleation/i);
  });
});

describe('CATALYST_CORE_PREAMBLE — posture preamble', () => {
  it('frames the catalyst as a starting point, not a contract', () => {
    expect(CATALYST_CORE_PREAMBLE).toMatch(/starting point, not a contract/i);
  });

  it('flags the library as non-exhaustive', () => {
    expect(CATALYST_CORE_PREAMBLE).toMatch(/non-exhaustive/i);
  });

  it('explicitly authorizes adaptation and writing from scratch', () => {
    expect(CATALYST_CORE_PREAMBLE).toMatch(/Adapt freely/i);
    expect(CATALYST_CORE_PREAMBLE).toMatch(/Write from scratch/i);
  });

  it('preserves non-negotiable safety defaults — dryRun and mojulo trace', () => {
    expect(CATALYST_CORE_PREAMBLE).toMatch(/dryRun/);
    expect(CATALYST_CORE_PREAMBLE).toMatch(/mojulo trace/i);
  });

  it('places posture before vocabulary so the model reads it first', () => {
    const postureIdx = CATALYST_CORE_PREAMBLE.indexOf('How to read this catalyst');
    const vocabIdx = CATALYST_CORE_PREAMBLE.indexOf('Vocabulary');
    expect(postureIdx).toBeGreaterThanOrEqual(0);
    expect(vocabIdx).toBeGreaterThan(postureIdx);
  });
});

describe('getCatalystHandler — adapter composition', () => {
  it('prepends the core preamble to the body', async () => {
    const out = await getCatalystHandler({ id: 'qualify-lead-to-crm' });
    expect(out.body.startsWith(CATALYST_CORE_PREAMBLE)).toBe(true);
  });

  it('still returns metadata fields alongside the composed body', async () => {
    const out = await getCatalystHandler({ id: 'qualify-lead-to-crm' });
    expect(out.id).toBe('qualify-lead-to-crm');
    expect(out.name).toBeTypeOf('string');
    expect(out.summary).toBeTypeOf('string');
    expect(Array.isArray(out.parameters)).toBe(true);
  });

  it('includes a host adapter section in the composed body', async () => {
    const out = await getCatalystHandler({ id: 'qualify-lead-to-crm' });
    expect(out.body).toMatch(/# Host adapter/);
    expect(out.adapter).toBeTruthy();
    expect(out.adapter.id).toBeTruthy();
  });

  it('honors an explicit host parameter and composes that adapter', async () => {
    const claude = await getCatalystHandler({ id: 'qualify-lead-to-crm', host: 'claude-code' });
    expect(claude.adapter.id).toBe('claude-code');
    expect(claude.body).toMatch(/\.claude\/skills\//);

    const codex = await getCatalystHandler({ id: 'qualify-lead-to-crm', host: 'codex' });
    expect(codex.adapter.id).toBe('codex');
    expect(codex.body).toMatch(/Codex automation/);
  });

  it('falls back to the generic adapter when host is unknown and no clientInfo', async () => {
    _resetClientBindingsForTests();
    const out = await getCatalystHandler(
      { id: 'qualify-lead-to-crm', host: 'no-such-host' },
      { mcpSessionId: 'test-session-unknown-host' }
    );
    expect(out.adapter.id).toBe('generic');
  });

  it('auto-binds an adapter from this session\'s clientInfo when no host is passed', async () => {
    _resetClientBindingsForTests();
    rememberClientInfo('test-session-codex-1', { name: 'codex', version: '1.0' });
    const out = await getCatalystHandler(
      { id: 'qualify-lead-to-crm' },
      { mcpSessionId: 'test-session-codex-1' }
    );
    expect(out.adapter.id).toBe('codex');
  });

  it('explicit host always wins over clientInfo auto-binding', async () => {
    _resetClientBindingsForTests();
    rememberClientInfo('test-session-claude-1', { name: 'claude-code', version: '1.0' });
    const out = await getCatalystHandler(
      { id: 'qualify-lead-to-crm', host: 'codex' },
      { mcpSessionId: 'test-session-claude-1' }
    );
    expect(out.adapter.id).toBe('codex');
  });

  it('throws on missing id', async () => {
    await expect(getCatalystHandler({})).rejects.toThrow(/id is required/);
  });

  it('throws on unknown id', async () => {
    await expect(getCatalystHandler({ id: 'no-such-catalyst' })).rejects.toThrow(/not found/);
  });
});

describe('listCatalystsHandler', () => {
  it('returns the catalog wrapped with total', async () => {
    const out = await listCatalystsHandler({});
    expect(out.total).toBeGreaterThanOrEqual(6);
    expect(Array.isArray(out.catalysts)).toBe(true);
    expect(out.catalysts.length).toBe(out.total);
  });

  it('forwards the category filter', async () => {
    const out = await listCatalystsHandler({ category: 'crm-sync' });
    expect(out.total).toBeGreaterThan(0);
    expect(out.catalysts.every((c) => c.category === 'crm-sync')).toBe(true);
  });
});

describe('CONSULTATION_POSTURE — recommend_catalysts framing', () => {
  // recommend_catalysts returns this in every response so the agent re-reads
  // the posture at the moment of acting on it (mirror of CATALYST_CORE_PREAMBLE
  // for get_catalyst). If any of these guarantees drift, the consultation
  // mode collapses back into role-executor.
  it('explicitly names valueHook as the lead-with field', () => {
    expect(CONSULTATION_POSTURE).toMatch(/valueHook/);
    expect(CONSULTATION_POSTURE).toMatch(/Lead with/i);
  });

  it('forbids gatekeeping framing for uninstalled destinations', () => {
    expect(CONSULTATION_POSTURE).toMatch(/Never gatekeep/i);
    expect(CONSULTATION_POSTURE).toMatch(/opt-in upgrade/i);
  });

  it('distinguishes missing-MCP from missing-protocols', () => {
    expect(CONSULTATION_POSTURE).toMatch(/destinationExamples/);
    expect(CONSULTATION_POSTURE).toMatch(/missingProtocols/);
  });

  it('reminds the agent that mojulo cannot see what MCPs are installed', () => {
    expect(CONSULTATION_POSTURE).toMatch(/only you/i);
  });

  it('directs the agent at the materialization block and get_adapter before synthesizing', () => {
    // The posture now carries the adapter-binding handshake: the
    // recommend_catalysts response includes a materialization block, and
    // the agent must bind an adapter before materializing any artifact.
    // Without this section, agents drift back to whichever host shape they
    // think they know best.
    expect(CONSULTATION_POSTURE).toMatch(/materialization/i);
    expect(CONSULTATION_POSTURE).toMatch(/get_adapter/);
    expect(CONSULTATION_POSTURE).toMatch(/clientInfoHint/);
  });
});

describe('buildMaterializationBlock', () => {
  it('lists every shipped adapter with artifactTarget', () => {
    _resetClientBindingsForTests();
    const block = buildMaterializationBlock({});
    expect(Array.isArray(block.availableAdapters)).toBe(true);
    const ids = block.availableAdapters.map((a) => a.id);
    expect(ids).toContain('claude-code');
    expect(ids).toContain('codex');
    expect(ids).toContain('generic');
    for (const a of block.availableAdapters) {
      expect(typeof a.artifactTarget).toBe('string');
      expect(a.artifactTarget.length).toBeGreaterThan(0);
    }
  });

  it('points the agent at get_adapter as the next tool', () => {
    const block = buildMaterializationBlock({});
    expect(block.nextTool).toBe('get_adapter');
  });

  it('resolves recommendedForThisClient from captured clientInfo', () => {
    _resetClientBindingsForTests();
    rememberClientInfo('test-mat-block-codex', { name: 'codex' });
    const block = buildMaterializationBlock({ mcpSessionId: 'test-mat-block-codex' });
    expect(block.recommendedForThisClient).toBe('codex');
  });

  it('falls back to generic with a self-id nudge when no clientInfo matches', () => {
    _resetClientBindingsForTests();
    const block = buildMaterializationBlock({ mcpSessionId: 'test-mat-block-unknown' });
    expect(block.recommendedForThisClient).toBe('generic');
    expect(block.note).toMatch(/clientInfoHint/);
  });
});

describe('CUSTOM_CATALYST_GUIDE — author posture for remote contributors', () => {
  it('frames catalysts you author here as proposals to the library, not local artifacts', () => {
    expect(CUSTOM_CATALYST_GUIDE).toMatch(/proposal/i);
    expect(CUSTOM_CATALYST_GUIDE).toMatch(/library/i);
  });

  it('points the remote agent at the existing exemplars via get_catalyst', () => {
    // The body is self-contained but tells the agent to anchor on exemplars
    // (which it can pull through MCP) rather than inlining 500 lines of prose.
    expect(CUSTOM_CATALYST_GUIDE).toMatch(/get_catalyst\("qualify-lead-to-crm"\)/);
    expect(CUSTOM_CATALYST_GUIDE).toMatch(/list_catalysts/);
  });

  it('contains the posture-check rubric with worked bad-vs-good examples for the subtle rules', () => {
    // Rules 5 and 6 are the ones contributors most often rationalize past —
    // the worked examples are what make them self-enforcing.
    expect(CUSTOM_CATALYST_GUIDE).toMatch(/Bad mapping insight/i);
    expect(CUSTOM_CATALYST_GUIDE).toMatch(/Good mapping insight/i);
    expect(CUSTOM_CATALYST_GUIDE).toMatch(/Bad idempotency story/i);
    expect(CUSTOM_CATALYST_GUIDE).toMatch(/Good idempotency story/i);
  });

  it('includes a worked pushback exchange so the agent has a concrete template', () => {
    expect(CUSTOM_CATALYST_GUIDE).toMatch(/Example pushback exchange/i);
  });

  it('inlines the frontmatter spec so the remote agent does not need loader.js', () => {
    // The required string fields the loader enforces.
    for (const field of ['id', 'name', 'summary', 'valueHook']) {
      expect(CUSTOM_CATALYST_GUIDE).toContain(field);
    }
    // The destinationExamples coupling — easy to miss without the spec inline.
    expect(CUSTOM_CATALYST_GUIDE).toMatch(/destinationExamples/);
    expect(CUSTOM_CATALYST_GUIDE).toMatch(/destinationMcpCategory/);
  });

  it('names the six-section body template using host-neutral section names', () => {
    expect(CUSTOM_CATALYST_GUIDE).toMatch(/six-section/i);
    expect(CUSTOM_CATALYST_GUIDE).toMatch(/Materialization/);
    expect(CUSTOM_CATALYST_GUIDE).toMatch(/Mapping intent/);
    expect(CUSTOM_CATALYST_GUIDE).toMatch(/Idempotency/);
    expect(CUSTOM_CATALYST_GUIDE).toMatch(/Pitfalls/);
    expect(CUSTOM_CATALYST_GUIDE).toMatch(/Behavior contract/);
  });

  it('preserves the non-negotiable body principles', () => {
    expect(CUSTOM_CATALYST_GUIDE).toMatch(/dryRun: true/);
    expect(CUSTOM_CATALYST_GUIDE).toMatch(/mojulo trace/i);
    expect(CUSTOM_CATALYST_GUIDE).toMatch(/Don't write back to the bot/i);
  });

  it('ships a by-hand validation checklist since the remote agent cannot run vitest', () => {
    expect(CUSTOM_CATALYST_GUIDE).toMatch(/Self-validate/i);
    expect(CUSTOM_CATALYST_GUIDE).toMatch(/checklist/i);
  });

  it('points the hand-off at a PR against zombico/mojulo, not an in-repo edit', () => {
    expect(CUSTOM_CATALYST_GUIDE).toMatch(/github\.com\/zombico\/mojulo/);
    expect(CUSTOM_CATALYST_GUIDE).toMatch(/control\/lib\/mcp\/catalysts\//);
  });

  it('reminds the agent the body is a prompt, not documentation', () => {
    // This is the single most load-bearing framing from the in-repo skill —
    // worth asserting it survives every edit to the guide.
    expect(CUSTOM_CATALYST_GUIDE).toMatch(/prompt, not documentation/i);
  });
});

describe('customCatalystHandler', () => {
  it('returns the guide as plain text content', async () => {
    const out = await customCatalystHandler({});
    expect(out.content).toEqual([{ type: 'text', text: CUSTOM_CATALYST_GUIDE }]);
  });

  it('ignores any input — the guide is input-less and idempotent', async () => {
    const a = await customCatalystHandler({});
    const b = await customCatalystHandler({ foo: 'bar' });
    expect(a).toEqual(b);
  });
});

describe('recommendCatalystsHandler — input validation', () => {
  it('throws when neither deploymentId nor fleet scope is provided', async () => {
    await expect(recommendCatalystsHandler({})).rejects.toThrow(
      /deploymentId is required|fleet/i,
    );
  });

  it('throws on unknown deploymentId', async () => {
    await expect(
      recommendCatalystsHandler({ deploymentId: 'no-such-deployment-id-xyz' })
    ).rejects.toThrow(/not found/);
  });
});
