// Isolate to in-memory SQLite so the operator-anchor tests below don't touch
// the real control-plane DB. The pre-existing tests in this file either don't
// hit the DB or only exercise the "unknown deploymentId → null → throw" path,
// so this change doesn't affect their behavior.
process.env.SQLITE_PATH = ':memory:';
// The mint_catalyst tests write through the *WithEmbedding repository paths —
// disable the semantic index so no ONNX model load fires under test (the
// embedding mirror itself is covered by local-catalysts-embedding.test.js).
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  CATALYST_CORE_PREAMBLE,
  CONSULTATION_POSTURE,
  CUSTOM_CATALYST_GUIDE,
  buildMaterializationBlock,
  buildOperatorAnchorBlock,
  customCatalystHandler,
  getCatalystHandler,
  listCatalystsHandler,
  mintCatalystHandler,
  recommendCatalystsHandler,
} from './catalysts.js';
import { rememberClientInfo, _resetClientBindingsForTests } from '@/lib/mcp/client-bindings';
import { closeDb, getDb } from '@/lib/db/index';
import {
  MetaEdgeRepository,
  MetaNodeRepository,
  MetaPrincipleRepository,
} from '@/lib/db/repositories/meta-context';
import { _resetCatalogForTests } from '@/lib/mcp/catalysts/loader';

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

  it('forwards the kind filter', async () => {
    const out = await listCatalystsHandler({ kind: 'workflow' });
    expect(out.total).toBeGreaterThan(0);
    expect(out.catalysts.every((c) => c.kind === 'workflow')).toBe(true);
  });
});

// Kind discriminator handling — exercised against an injected fixture catalog
// so the assertions don't depend on a real technique catalyst being shipped
// yet. The injected catalog combines one workflow + one technique so all three
// handlers (list/get/recommend) can be observed side by side.
describe('catalyst kind discriminator — workflow vs technique', () => {
  function makeFixtureCatalog() {
    return new Map([
      [
        'fixture-workflow',
        {
          id: 'fixture-workflow',
          name: 'Fixture Workflow',
          summary: 'Fixture for kind-discriminator tests.',
          valueHook: 'a stand-in workflow for testing.',
          kind: 'workflow',
          version: 1,
          category: 'misc',
          requires: {},
          parameters: [],
          mcpTools: {},
          outputContract: null,
          body: 'Workflow body — should be wrapped with preamble + adapter.',
        },
      ],
      [
        'fixture-technique',
        {
          id: 'fixture-technique',
          name: 'Fixture Technique',
          summary: 'Fixture technique for kind-discriminator tests.',
          valueHook: 'a stand-in technique for testing.',
          kind: 'technique',
          version: 1,
          category: 'runtime-primitive',
          requires: {},
          parameters: [],
          mcpTools: {},
          outputContract: null,
          body: 'Technique body — should be returned as-is, no preamble, no adapter.',
        },
      ],
    ]);
  }

  beforeEach(() => {
    closeDb();
    _resetCatalogForTests(makeFixtureCatalog());
  });

  // Reset back to the real catalog after these tests so the rest of the file
  // keeps seeing the shipped catalysts.
  afterEach(() => {
    _resetCatalogForTests(null);
  });

  it('get_catalyst returns a technique body without preamble or adapter', async () => {
    const out = await getCatalystHandler({ id: 'fixture-technique' });
    expect(out.kind).toBe('technique');
    expect(out.adapter).toBeNull();
    expect(out.body).toBe('Technique body — should be returned as-is, no preamble, no adapter.');
    expect(out.body.startsWith(CATALYST_CORE_PREAMBLE)).toBe(false);
  });

  it('get_catalyst still wraps workflow catalysts with preamble + adapter', async () => {
    const out = await getCatalystHandler({ id: 'fixture-workflow' });
    expect(out.kind).toBe('workflow');
    expect(out.adapter).not.toBeNull();
    expect(out.body.startsWith(CATALYST_CORE_PREAMBLE)).toBe(true);
    expect(out.body).toMatch(/# Host adapter/);
  });

  it('list_catalysts with kind=technique only returns technique catalysts', async () => {
    const out = await listCatalystsHandler({ kind: 'technique' });
    expect(out.total).toBe(1);
    expect(out.catalysts[0].id).toBe('fixture-technique');
  });

  it('recommend_catalysts skips technique catalysts in single-bot mode', async () => {
    seedDeployment();
    const out = await recommendCatalystsHandler({ deploymentId: 'dep-rec-test' });
    const all = [...out.applicable, ...out.requiresProtocolChange];
    expect(all.some((r) => r.id === 'fixture-workflow')).toBe(true);
    expect(all.some((r) => r.id === 'fixture-technique')).toBe(false);
  });

  it('recommend_catalysts skips technique catalysts in fleet mode', async () => {
    seedDeployment();
    const out = await recommendCatalystsHandler({ scope: 'fleet' });
    const all = [...out.applicable, ...out.requiresProtocolChange];
    expect(all.some((r) => r.id === 'fixture-workflow')).toBe(true);
    expect(all.some((r) => r.id === 'fixture-technique')).toBe(false);
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

  it('mint-first posture — mint_catalyst is the default endpoint, PR is graduation', () => {
    expect(CUSTOM_CATALYST_GUIDE).toMatch(/mint_catalyst/);
    expect(CUSTOM_CATALYST_GUIDE).toMatch(/local shelf \(default endpoint\)/i);
    expect(CUSTOM_CATALYST_GUIDE).toMatch(/graduation/i);
    // The bar framing survives the fork — local minting is not an excuse for
    // thin catalysts.
    expect(CUSTOM_CATALYST_GUIDE).toMatch(/curated bar even when minting locally/i);
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

// The local shelf (local-catalysts.plan.md) — mint_catalyst + merged catalog
// behavior across list/get/recommend.
describe('mintCatalystHandler — the local shelf', () => {
  beforeEach(() => {
    closeDb();
    getDb();
  });

  const mintInput = {
    id: 'evening-digest',
    name: 'Evening Digest',
    summary: 'Digest the day into a channel',
    valueHook: 'A nightly summary without asking for it',
    category: 'digest',
    body: '# Body\n\nMapping intent prose.',
  };

  it('mints at rev 1 and returns the graduation fileText', async () => {
    const out = await mintCatalystHandler(mintInput);
    expect(out.action).toBe('mint');
    expect(out.catalyst).toMatchObject({ id: 'evening-digest', rev: 1, version: 1, origin: 'local', status: 'active' });
    expect(out.revisions).toHaveLength(1);
    expect(out.fileText).toMatch(/^---\n/);
    expect(out.fileText).toContain('"id": "evening-digest"');
    expect(out.fileText).toContain('Mapping intent prose.');
    expect(out.graduation).toMatch(/control\/lib\/mcp\/catalysts\//);
  });

  it('a minted catalyst is live in list_catalysts and get_catalyst like a shipped one', async () => {
    await mintCatalystHandler(mintInput);

    const list = await listCatalystsHandler({});
    const mine = list.catalysts.find((c) => c.id === 'evening-digest');
    expect(mine).toMatchObject({ origin: 'local', rev: 1, kind: 'workflow' });
    // Curated entries are annotated too.
    expect(list.catalysts.find((c) => c.id === 'qualify-lead-to-crm').origin).toBe('curated');

    const got = await getCatalystHandler({ id: 'evening-digest', host: 'generic' });
    expect(got.origin).toBe('local');
    expect(got.body.startsWith(CATALYST_CORE_PREAMBLE)).toBe(true); // workflow composition applies
    expect(got.fileText).toContain('"id": "evening-digest"');
    expect(got.revisions).toHaveLength(1);
  });

  it('a minted catalyst participates in recommend_catalysts with origin local', async () => {
    seedDeployment();
    await mintCatalystHandler({ ...mintInput, requires: { protocols: ['knowledge'] } });
    const out = await recommendCatalystsHandler({ deploymentId: 'dep-rec-test' });
    const mine = [...out.applicable, ...out.requiresProtocolChange].find((r) => r.id === 'evening-digest');
    expect(mine).toBeTruthy();
    expect(mine.origin).toBe('local');
  });

  it('update requires a note, appends a revision, and rev reads history', async () => {
    await mintCatalystHandler(mintInput);
    await expect(mintCatalystHandler({ ...mintInput, summary: 'v2' })).rejects.toThrow(/requires 'note'/);

    const updated = await mintCatalystHandler({ ...mintInput, summary: 'v2', body: '# v2\n\nRevised.', note: 'tighten' });
    expect(updated.action).toBe('update');
    expect(updated.catalyst.rev).toBe(2);
    expect(updated.revisions.map((r) => r.rev)).toEqual([2, 1]);

    const head = await getCatalystHandler({ id: 'evening-digest', host: 'generic' });
    expect(head.summary).toBe('v2');
    const rev1 = await getCatalystHandler({ id: 'evening-digest', host: 'generic', rev: 1 });
    expect(rev1.summary).toBe('Digest the day into a channel');
    expect(rev1.headRev).toBe(2);
    await expect(getCatalystHandler({ id: 'evening-digest', rev: 9 })).rejects.toThrow(/no revision 9/);
  });

  it('rev is rejected for curated ids — their history lives in git', async () => {
    await expect(getCatalystHandler({ id: 'qualify-lead-to-crm', rev: 1 })).rejects.toThrow(/git/);
  });

  it('refuses curated ids in both directions', async () => {
    await expect(mintCatalystHandler({ ...mintInput, id: 'qualify-lead-to-crm' })).rejects.toThrow(
      /curated catalyst shipped with mojulo/,
    );
  });

  it('enforces the structural spec — destinationExamples pairing', async () => {
    await expect(
      mintCatalystHandler({ ...mintInput, requires: { destinationMcpCategory: 'crm-like' } }),
    ).rejects.toThrow(/destinationExamples/);
  });

  it('archive hides it from list/get with a revival hint; update revives', async () => {
    await mintCatalystHandler(mintInput);
    const archived = await mintCatalystHandler({ id: 'evening-digest', archive: true });
    expect(archived).toMatchObject({ action: 'archive', changed: true, status: 'archived' });

    const list = await listCatalystsHandler({});
    expect(list.catalysts.some((c) => c.id === 'evening-digest')).toBe(false);
    await expect(getCatalystHandler({ id: 'evening-digest' })).rejects.toThrow(/archived.*revives/s);

    const revived = await mintCatalystHandler({ ...mintInput, note: 'bring it back' });
    expect(revived.action).toBe('revive');
    expect(revived.catalyst).toMatchObject({ rev: 2, status: 'active' });
  });

  it('a curated catalyst shipped later eclipses the local id — curated wins, local flagged', async () => {
    await mintCatalystHandler({ ...mintInput, id: 'fixture-eclipse' });
    // Simulate a mojulo upgrade shipping a curated catalyst under the same id.
    _resetCatalogForTests(
      new Map([
        [
          'fixture-eclipse',
          {
            id: 'fixture-eclipse',
            name: 'Shipped Eclipse',
            summary: 'now curated',
            valueHook: 'v',
            kind: 'workflow',
            version: 1,
            category: 'misc',
            requires: {},
            parameters: [],
            mcpTools: {},
            outputContract: null,
            body: 'Curated body.',
            _file: 'fixture-eclipse.md',
          },
        ],
      ]),
    );
    try {
      const list = await listCatalystsHandler({});
      const entries = list.catalysts.filter((c) => c.id === 'fixture-eclipse');
      expect(entries).toHaveLength(2);
      expect(entries.find((c) => c.origin === 'curated').eclipsed).toBeUndefined();
      const eclipsed = entries.find((c) => c.origin === 'local');
      expect(eclipsed.eclipsed).toBe(true);
      expect(eclipsed.note).toMatch(/re-mint/i);

      // Bare id resolves to the curated one; the local row is preserved but unreachable.
      const got = await getCatalystHandler({ id: 'fixture-eclipse', host: 'generic' });
      expect(got.origin).toBe('curated');
      expect(got.name).toBe('Shipped Eclipse');

      // And the id can no longer be minted over.
      await expect(mintCatalystHandler({ ...mintInput, id: 'fixture-eclipse', note: 'n' })).rejects.toThrow(
        /curated catalyst shipped with mojulo/,
      );
    } finally {
      _resetCatalogForTests(null);
    }
  });

  it('minted technique catalysts skip preamble/adapter and recommendations', async () => {
    seedDeployment();
    await mintCatalystHandler({
      ...mintInput,
      id: 'technique-scratch-store',
      kind: 'technique',
      body: 'Technique body.',
    });
    const got = await getCatalystHandler({ id: 'technique-scratch-store' });
    expect(got.adapter).toBeNull();
    expect(got.body).toBe('Technique body.');

    const rec = await recommendCatalystsHandler({ deploymentId: 'dep-rec-test' });
    const all = [...rec.applicable, ...rec.requiresProtocolChange];
    expect(all.some((r) => r.id === 'technique-scratch-store')).toBe(false);
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

// Phase 2 — operator anchor / suggest_kyc surfacing in recommend_catalysts.
describe('buildOperatorAnchorBlock', () => {
  beforeEach(() => {
    closeDb();
  });

  it('returns suggest_kyc when the operator node is missing', () => {
    expect(buildOperatorAnchorBlock()).toEqual({ suggest_kyc: true });
  });

  it('returns operatorAnchor with role and the latest principle when present', () => {
    const node = MetaNodeRepository.upsert({
      kind: 'operator',
      ref: 'self',
      label: 'Agency owner',
    });
    MetaPrincipleRepository.insert({
      scope_kind: 'node',
      scope_id: node.id,
      body_md: '**Role:** Agency owner\n\n**Locked-in constraints:**\n- CRM is HubSpot',
      source_event: 'operator_kyc',
    });
    const out = buildOperatorAnchorBlock();
    expect(out.suggest_kyc).toBeUndefined();
    expect(out.operatorAnchor.role).toBe('Agency owner');
    expect(out.operatorAnchor.latestPrinciple.bodyMd).toMatch(/HubSpot/);
  });

  it('returns the MOST RECENT principle when multiple are stacked', () => {
    const node = MetaNodeRepository.upsert({
      kind: 'operator',
      ref: 'self',
      label: 'Op',
    });
    MetaPrincipleRepository.insert({
      scope_kind: 'node',
      scope_id: node.id,
      body_md: 'first',
      source_event: 'operator_kyc',
    });
    MetaPrincipleRepository.insert({
      scope_kind: 'node',
      scope_id: node.id,
      body_md: 'second',
      source_event: 'operator_kyc',
    });
    expect(buildOperatorAnchorBlock().operatorAnchor.latestPrinciple.bodyMd).toBe('second');
  });
});

// Test helper used by multiple describe blocks below. Pinned id (vs
// DeploymentRepository.create) so meta_context references can reference a
// stable bot_ref.
function seedDeployment({
  id = 'dep-rec-test',
  botName = 'Rec Bot',
  enabledProtocols = { knowledge: true, formGathering: true },
} = {}) {
  const db = getDb();
  const now = Date.now();
  db.prepare(
    `INSERT INTO deployments (id, bot_name, flow_type, status, config, api_key, document_ids, created_at, updated_at)
     VALUES (?, ?, 'modular', 'saved', ?, 'k', '[]', ?, ?)`,
  ).run(id, botName, JSON.stringify({ enabledProtocols }), now, now);
}

function seedMaterialization({
  catalystRef,
  botRef,
  botName,
  artifactRef,
  artifactLabel,
  adapterRef = 'claude-code',
  artifactPrincipleBody,
}) {
  const cat = MetaNodeRepository.upsert({
    kind: 'catalyst',
    ref: catalystRef,
    label: catalystRef,
  });
  const art = MetaNodeRepository.upsert({
    kind: 'artifact',
    ref: artifactRef,
    label: artifactLabel,
  });
  const bot = MetaNodeRepository.upsert({ kind: 'bot', ref: botRef, label: botName });
  const adp = MetaNodeRepository.upsert({
    kind: 'adapter',
    ref: adapterRef,
    label: adapterRef,
  });
  MetaEdgeRepository.upsert({ src_id: cat.id, dst_id: art.id, kind: 'seeded' });
  MetaEdgeRepository.upsert({ src_id: art.id, dst_id: bot.id, kind: 'runs_for' });
  MetaEdgeRepository.upsert({ src_id: art.id, dst_id: adp.id, kind: 'materialized_by' });
  if (artifactPrincipleBody) {
    MetaPrincipleRepository.insert({
      scope_kind: 'node',
      scope_id: art.id,
      body_md: artifactPrincipleBody,
      source_event: 'artifact_materialization',
    });
  }
}

describe('recommendCatalystsHandler — operator anchor surfacing', () => {
  beforeEach(() => {
    closeDb();
  });

  it('single-bot mode → suggest_kyc when operator node is missing', async () => {
    seedDeployment();
    const out = await recommendCatalystsHandler({ deploymentId: 'dep-rec-test' });
    expect(out.suggest_kyc).toBe(true);
    expect(out.operatorAnchor).toBeUndefined();
  });

  it('single-bot mode → operatorAnchor when the anchor exists', async () => {
    seedDeployment();
    const node = MetaNodeRepository.upsert({
      kind: 'operator',
      ref: 'self',
      label: 'Dental agency owner',
    });
    MetaPrincipleRepository.insert({
      scope_kind: 'node',
      scope_id: node.id,
      body_md: '**Locked-in constraints:**\n- CRM is HubSpot',
      source_event: 'operator_kyc',
    });
    const out = await recommendCatalystsHandler({ deploymentId: 'dep-rec-test' });
    expect(out.suggest_kyc).toBeUndefined();
    expect(out.operatorAnchor.role).toBe('Dental agency owner');
  });

  it('fleet mode → suggest_kyc when operator node is missing', async () => {
    seedDeployment();
    const out = await recommendCatalystsHandler({ scope: 'fleet' });
    expect(out.suggest_kyc).toBe(true);
  });

  it('fleet mode → operatorAnchor when the anchor exists', async () => {
    seedDeployment();
    MetaNodeRepository.upsert({ kind: 'operator', ref: 'self', label: 'Op' });
    const out = await recommendCatalystsHandler({ scope: 'fleet' });
    expect(out.suggest_kyc).toBeUndefined();
    expect(out.operatorAnchor.role).toBe('Op');
  });
});

// Ring 6 enrichment — recommend_catalysts surfaces priorMaterializations per
// recommendation so the agent can triage overlap (same bot), synergy (other
// bot, fleet pattern), or orthogonality (no priors) before materializing.
describe('recommendCatalystsHandler — priorMaterializations surfacing', () => {
  beforeEach(() => {
    closeDb();
  });

  it('every recommendation carries priorMaterializations — empty array when no priors exist', async () => {
    seedDeployment();
    const out = await recommendCatalystsHandler({ deploymentId: 'dep-rec-test' });
    for (const rec of out.applicable) {
      expect(Array.isArray(rec.priorMaterializations)).toBe(true);
      expect(rec.priorMaterializations).toEqual([]);
    }
    for (const rec of out.requiresProtocolChange) {
      expect(Array.isArray(rec.priorMaterializations)).toBe(true);
      expect(rec.priorMaterializations).toEqual([]);
    }
  });

  it('single-bot mode — prior on the SAME bot surfaces as a duplicate signal', async () => {
    seedDeployment({ id: 'dep-rec-test', botName: 'Front Desk' });
    seedMaterialization({
      catalystRef: 'qualify-lead-to-crm',
      botRef: 'dep-rec-test',
      botName: 'Front Desk',
      artifactRef: 'claude-code:/skills/qlc-front/SKILL.md',
      artifactLabel: 'Qualify Lead — Front Desk',
      artifactPrincipleBody: 'Route qualified leads to HubSpot.',
    });

    const out = await recommendCatalystsHandler({ deploymentId: 'dep-rec-test' });
    const qlc = [...out.applicable, ...out.requiresProtocolChange].find(
      (r) => r.id === 'qualify-lead-to-crm',
    );
    expect(qlc).toBeTruthy();
    expect(qlc.priorMaterializations).toHaveLength(1);
    expect(qlc.priorMaterializations[0]).toMatchObject({
      botRef: 'dep-rec-test',
      botName: 'Front Desk',
      artifactLabel: 'Qualify Lead — Front Desk',
      adapterId: 'claude-code',
    });
    expect(qlc.priorMaterializations[0].latestArtifactPrinciple.bodyMd).toMatch(/HubSpot/);
  });

  it('single-bot mode — prior on a DIFFERENT bot surfaces (fleet pattern signal)', async () => {
    seedDeployment({ id: 'dep-rec-test', botName: 'Bot A' });
    seedMaterialization({
      catalystRef: 'qualify-lead-to-crm',
      botRef: 'dep-other',
      botName: 'Bot B (other)',
      artifactRef: 'claude-code:/skills/qlc-b/SKILL.md',
      artifactLabel: 'QLC — Bot B',
      artifactPrincipleBody: 'Route to HubSpot (fleet convention).',
    });

    const out = await recommendCatalystsHandler({ deploymentId: 'dep-rec-test' });
    const qlc = [...out.applicable, ...out.requiresProtocolChange].find(
      (r) => r.id === 'qualify-lead-to-crm',
    );
    expect(qlc.priorMaterializations).toHaveLength(1);
    expect(qlc.priorMaterializations[0].botRef).toBe('dep-other');
    // The recommendation is for dep-rec-test, but the prior is on dep-other.
    // The agent reads this as "fleet pattern, align unless intentionally diverging."
    expect(qlc.priorMaterializations[0].botRef).not.toBe('dep-rec-test');
  });

  it('multiple priors across the fleet are all surfaced, most-recent-first', async () => {
    seedDeployment({ id: 'dep-rec-test', botName: 'Target' });
    seedMaterialization({
      catalystRef: 'qualify-lead-to-crm',
      botRef: 'dep-1',
      botName: 'Bot 1',
      artifactRef: 'claude-code:/a.md',
      artifactLabel: 'A',
    });
    seedMaterialization({
      catalystRef: 'qualify-lead-to-crm',
      botRef: 'dep-2',
      botName: 'Bot 2',
      artifactRef: 'codex:auto-2',
      artifactLabel: 'B',
      adapterRef: 'codex',
    });
    const out = await recommendCatalystsHandler({ deploymentId: 'dep-rec-test' });
    const qlc = [...out.applicable, ...out.requiresProtocolChange].find(
      (r) => r.id === 'qualify-lead-to-crm',
    );
    expect(qlc.priorMaterializations).toHaveLength(2);
    // Most recent (Bot 2 / codex) first.
    expect(qlc.priorMaterializations[0].botRef).toBe('dep-2');
    expect(qlc.priorMaterializations[0].adapterId).toBe('codex');
  });

  it('fleet mode — priorMaterializations attached per recommendation', async () => {
    seedDeployment({ id: 'dep-rec-test', botName: 'Bot' });
    seedMaterialization({
      catalystRef: 'qualify-lead-to-crm',
      botRef: 'dep-prev',
      botName: 'Prev Bot',
      artifactRef: 'claude-code:/skills/prev/SKILL.md',
      artifactLabel: 'Prev',
    });

    const out = await recommendCatalystsHandler({ scope: 'fleet' });
    const qlc = [...out.applicable, ...out.requiresProtocolChange].find(
      (r) => r.id === 'qualify-lead-to-crm',
    );
    expect(qlc.priorMaterializations).toHaveLength(1);
    expect(qlc.priorMaterializations[0].botRef).toBe('dep-prev');
  });

  it('priorMaterializations only surface the SAME catalyst (no cross-catalyst leakage)', async () => {
    seedDeployment({ id: 'dep-rec-test', botName: 'Bot' });
    seedMaterialization({
      catalystRef: 'appointment-to-calendar',
      botRef: 'dep-other',
      botName: 'Other',
      artifactRef: 'claude-code:/skills/cal/SKILL.md',
      artifactLabel: 'Cal',
    });

    const out = await recommendCatalystsHandler({ deploymentId: 'dep-rec-test' });
    const qlc = [...out.applicable, ...out.requiresProtocolChange].find(
      (r) => r.id === 'qualify-lead-to-crm',
    );
    const atc = [...out.applicable, ...out.requiresProtocolChange].find(
      (r) => r.id === 'appointment-to-calendar',
    );
    expect(qlc.priorMaterializations).toEqual([]);
    expect(atc.priorMaterializations).toHaveLength(1);
  });
});
