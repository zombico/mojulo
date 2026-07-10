// Isolate this test file to an in-memory SQLite — must run before any import
// that pulls in db/index.js. Same pattern as meta-context.test.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { commitOperatorKyc } from './meta-context.js';
import {
  PARADIGMS,
  buildForwardContextBody,
  FORWARD_CONTEXT_BODY,
  forwardContextHandler,
  buildRegisterKitBody,
  registerKitHandler,
  toolIndexHandler,
  deliberationOverviewHandler,
  uiMapHandler,
  substrateHandler,
} from './context.js';
import {
  VOCABULARY_REGISTERS,
  PROCEDURAL_DISCLOSURES,
  DEFAULT_VOCABULARY_REGISTER,
  DEFAULT_PROCEDURAL_DISCLOSURE,
} from './meta-context.js';

beforeEach(() => {
  closeDb();
});

// Phrases that must appear in every register × disclosure cell — they're
// the four-gate floor rule and the dual-purpose preamble. If any cell drops
// these, the design contract is broken.
const FLOOR_PHRASES = [
  'proposed',
  'materialized',
  'dry-run',
  'promoted',
  'watched',
  'read-once',
  'audit trail',
];

describe('buildForwardContextBody — variant composition', () => {
  it('renders every register × disclosure cell without throwing', () => {
    for (const register of VOCABULARY_REGISTERS) {
      for (const disclosure of PROCEDURAL_DISCLOSURES) {
        const body = buildForwardContextBody({ register, disclosure });
        expect(typeof body).toBe('string');
        expect(body.length).toBeGreaterThan(500);
      }
    }
  });

  it('floor rule (four gates) survives in every register × disclosure cell', () => {
    for (const register of VOCABULARY_REGISTERS) {
      for (const disclosure of PROCEDURAL_DISCLOSURES) {
        const body = buildForwardContextBody({ register, disclosure });
        for (const phrase of FLOOR_PHRASES) {
          expect(body, `cell ${register}+${disclosure} missing "${phrase}"`).toContain(phrase);
        }
      }
    }
  });

  it('is a thin routing index, not a manual: routing rows + drawer directory, heavy prose drawerized', () => {
    for (const register of VOCABULARY_REGISTERS) {
      for (const disclosure of PROCEDURAL_DISCLOSURES) {
        const body = buildForwardContextBody({ register, disclosure });
        // The routing index and drawer directory are the spine.
        expect(body).toContain('Routing index');
        expect(body).toContain('Drawers');
        // Drawer pointers, including the new substrate drawer.
        expect(body).toContain('`get_tool_index`');
        expect(body).toContain('`get_register_kit`');
        expect(body).toContain('`get_substrate`');
        // The full one-line-per-tool index no longer lives inline.
        expect(body).not.toContain('the primitive-binding composer for MCP-to-MCP workflows');
        // The concept glossary moved to get_register_kit — its section header
        // and the "don't surface" plain-register marker are both gone.
        expect(body).not.toContain('## Concepts');
        // The substrate philosophy moved to get_substrate.
        expect(body).not.toContain('PLAYful Cloud — what mojulo is at the substrate');
      }
    }
  });

  it('opener is register-invariant: same lean opener in every register', () => {
    const plain = buildForwardContextBody({ register: 'plain', disclosure: 'reflective' });
    const mojulo = buildForwardContextBody({ register: 'mojulo', disclosure: 'reflective' });
    // One register-invariant opener — no per-register ramp prose, no "don't
    // surface" plain marker (that machinery lives in get_register_kit now).
    for (const body of [plain, mojulo]) {
      expect(body).toMatch(/the agent's workshop — a local, stateful substrate that turns conversations into things that keep existing/);
      expect(body).toContain('routing index');
      expect(body).not.toMatch(/Don't surface to the user/i);
    }
  });

  it('concept glossary is NOT in the forward_context body — it lives in get_register_kit', () => {
    for (const register of VOCABULARY_REGISTERS) {
      const body = buildForwardContextBody({ register, disclosure: 'reflective' });
      expect(body).not.toContain('## Concepts');
      expect(body).not.toMatch(/Don't surface the bold terms to the user/);
      // The body points the agent at where the vocabulary actually lives.
      expect(body).toContain('`get_register_kit`');
      // get_register_kit still carries the glossary for the same register.
      const kit = buildRegisterKitBody({ register, disclosure: 'reflective' });
      expect(kit).toContain('## Concepts');
    }
  });

  it('disclosure directive branches: terse / reflective / pedagogical each insert their own paragraph', () => {
    const terse = buildForwardContextBody({ register: 'mixed', disclosure: 'terse' });
    const reflective = buildForwardContextBody({ register: 'mixed', disclosure: 'reflective' });
    const pedagogical = buildForwardContextBody({ register: 'mixed', disclosure: 'pedagogical' });
    expect(terse).toMatch(/Procedural disclosure: terse/);
    expect(reflective).toMatch(/Procedural disclosure: reflective/);
    expect(pedagogical).toMatch(/Procedural disclosure: pedagogical/);
    // Only one disclosure paragraph per body.
    expect(terse).not.toMatch(/Procedural disclosure: reflective/);
    expect(reflective).not.toMatch(/Procedural disclosure: terse/);
  });

  it('communication settings notice reports the active register + disclosure cell', () => {
    const body = buildForwardContextBody({
      register: 'plain',
      disclosure: 'pedagogical',
      source: 'operator_anchor',
    });
    expect(body).toMatch(/vocabulary_register: plain/);
    expect(body).toMatch(/procedural_disclosure: pedagogical/);
    expect(body).toMatch(/read from the operator anchor/);
  });

  it('concept names are invariant — same identifiers in every register variant of the register kit', () => {
    // The glossary moved out of forward_context into get_register_kit; concept
    // names stay invariant across registers (the agent uses them to call tools).
    // The list includes the game paradigm + creative-arm nouns (orientation-diet
    // thread C) — paradigm parity means the glossary covers every arm, not just
    // the bot/service/app one.
    const names = [
      'Bot',
      'Deployment',
      'Protocol',
      'Chain',
      'Catalyst',
      'Host adapter',
      'Connected Service',
      'Game',
      'Stash / Gather / Cook',
      'Recipe artifact',
    ];
    for (const register of VOCABULARY_REGISTERS) {
      const kit = buildRegisterKitBody({ register, disclosure: 'reflective' });
      for (const n of names) {
        expect(kit, `cell ${register} missing concept name "${n}"`).toContain(`**${n}**`);
      }
    }
  });

  it('full tool index is promoted to get_tool_index and is register-invariant', async () => {
    // The full one-line-per-tool index moved out of forward_context into its
    // own tool. Pick a representative tool one-liner that should appear there.
    const marker = '`bind_primitives` — **the primitive-binding composer';
    const { content } = await toolIndexHandler({});
    const indexText = content[0].text;
    expect(indexText).toContain(marker);
    // It's a single-source body — no register branching on the index tool.
    const { content: again } = await toolIndexHandler({ register: 'plain' });
    expect(again[0].text).toBe(indexText);
  });

  it('falls back to defaults when register / disclosure are invalid', () => {
    const body = buildForwardContextBody({ register: 'nope', disclosure: 'whatever' });
    expect(body).toMatch(new RegExp(`vocabulary_register: ${DEFAULT_VOCABULARY_REGISTER}`));
    expect(body).toMatch(new RegExp(`procedural_disclosure: ${DEFAULT_PROCEDURAL_DISCLOSURE}`));
  });
});

describe('forwardContextHandler — register resolution', () => {
  it('uses defaults when no operator anchor exists', async () => {
    const { content } = await forwardContextHandler({});
    const text = content[0].text;
    expect(text).toMatch(new RegExp(`vocabulary_register: ${DEFAULT_VOCABULARY_REGISTER}`));
    expect(text).toMatch(new RegExp(`procedural_disclosure: ${DEFAULT_PROCEDURAL_DISCLOSURE}`));
    expect(text).toMatch(/defaults — no operator anchor/);
  });

  it('reads register + disclosure from the operator anchor when no override is passed', async () => {
    await commitOperatorKyc({
      type: 'operator_kyc',
      role: 'r',
      constraints: ['c1'],
      vocabulary_register: 'plain',
      procedural_disclosure: 'pedagogical',
    });
    const { content } = await forwardContextHandler({});
    const text = content[0].text;
    expect(text).toMatch(/vocabulary_register: plain/);
    expect(text).toMatch(/procedural_disclosure: pedagogical/);
    expect(text).toMatch(/read from the operator anchor/);
    // The notice points the agent at get_register_kit for the register glossary.
    expect(text).toContain('`get_register_kit`');
    // pedagogical disclosure should appear (disclosure still branches inline).
    expect(text).toMatch(/Procedural disclosure: pedagogical/);
  });

  it('per-call override beats the operator anchor', async () => {
    await commitOperatorKyc({
      type: 'operator_kyc',
      role: 'r',
      constraints: ['c1'],
      vocabulary_register: 'plain',
      procedural_disclosure: 'reflective',
    });
    const { content } = await forwardContextHandler({
      register: 'mojulo',
      disclosure: 'terse',
    });
    const text = content[0].text;
    expect(text).toMatch(/vocabulary_register: mojulo/);
    expect(text).toMatch(/procedural_disclosure: terse/);
    expect(text).toMatch(/set via this call/);
  });

  it('per-call override composes per-axis with the anchor — one axis overridden, the other read from anchor', async () => {
    await commitOperatorKyc({
      type: 'operator_kyc',
      role: 'r',
      constraints: ['c1'],
      vocabulary_register: 'plain',
      procedural_disclosure: 'reflective',
    });
    const { content } = await forwardContextHandler({ disclosure: 'pedagogical' });
    const text = content[0].text;
    // Anchor's register survives.
    expect(text).toMatch(/vocabulary_register: plain/);
    // Override's disclosure wins.
    expect(text).toMatch(/procedural_disclosure: pedagogical/);
  });

  it('rejects invalid register override', async () => {
    await expect(forwardContextHandler({ register: 'casual' })).rejects.toThrow(/register/);
  });

  it('rejects invalid disclosure override', async () => {
    await expect(forwardContextHandler({ disclosure: 'verbose' })).rejects.toThrow(/disclosure/);
  });

  it('handler output still contains the floor rule', async () => {
    await commitOperatorKyc({
      type: 'operator_kyc',
      role: 'r',
      constraints: ['c1'],
      vocabulary_register: 'plain',
      procedural_disclosure: 'terse',
    });
    const { content } = await forwardContextHandler({});
    const text = content[0].text;
    for (const phrase of FLOOR_PHRASES) {
      expect(text, `handler output missing "${phrase}"`).toContain(phrase);
    }
  });
});

describe('get_register_kit — isolated register surface', () => {
  it('carries the active-cell glossary, disclosure directive, and the floor in every cell', () => {
    for (const register of VOCABULARY_REGISTERS) {
      for (const disclosure of PROCEDURAL_DISCLOSURES) {
        const body = buildRegisterKitBody({ register, disclosure });
        for (const phrase of FLOOR_PHRASES) {
          expect(body, `register-kit ${register}+${disclosure} missing "${phrase}"`).toContain(phrase);
        }
        expect(body).toMatch(/## Concepts/);
        expect(body).toMatch(new RegExp(`Procedural disclosure: ${disclosure}`));
        expect(body).toMatch(new RegExp(`vocabulary_register: ${register}`));
      }
    }
  });

  it('resolves register/disclosure from the operator anchor when no override is passed', async () => {
    await commitOperatorKyc({
      type: 'operator_kyc',
      role: 'r',
      constraints: ['c1'],
      vocabulary_register: 'plain',
      procedural_disclosure: 'pedagogical',
    });
    const { content } = await registerKitHandler({});
    const text = content[0].text;
    expect(text).toMatch(/vocabulary_register: plain/);
    expect(text).toMatch(/procedural_disclosure: pedagogical/);
    expect(text).toMatch(/read from the operator anchor/);
  });

  it('per-call override beats the anchor and rejects invalid values', async () => {
    const { content } = await registerKitHandler({ register: 'mojulo', disclosure: 'terse' });
    expect(content[0].text).toMatch(/vocabulary_register: mojulo/);
    expect(content[0].text).toMatch(/procedural_disclosure: terse/);
    await expect(registerKitHandler({ register: 'casual' })).rejects.toThrow(/register/);
  });
});

describe('get_deliberation_overview — Ring 6 deep block', () => {
  it('explains the deliberation surfaces and the daemon runtime gating', async () => {
    const { content } = await deliberationOverviewHandler({});
    const text = content[0].text;
    expect(text).toMatch(/Deliberation surfaces \(Ring 6\)/);
    expect(text).toContain('meta_context_declare_inventory');
    expect(text).toContain('MOJULO_TRIGGER_RUNTIME');
    expect(text).toContain('MOJULO_APP_RUNTIME');
  });
});

describe('get_ui_map — dashboard page map', () => {
  it('maps the current dashboard pages and stays out of the always-paid body', async () => {
    const { content } = await uiMapHandler({});
    const text = content[0].text;
    for (const page of ['/bots', '/apps', '/data', '/map', '/graph', '/plan', '/research', '/sketches', '/settings']) {
      expect(text, `ui map missing page ${page}`).toContain(`\`${page}\``);
    }
    // Hints at the breadth of UI localization without enumerating every locale.
    expect(text).toMatch(/internationaliz|languages|locales|right-to-left/i);
    // The full page map is reached on demand, not folded into forward_context.
    const body = buildForwardContextBody({ register: 'mixed', disclosure: 'reflective' });
    expect(body).not.toContain('App Creation Map: how an app comes together');
    expect(body).toContain('`get_ui_map`');
  });
});

describe('get_substrate — PLAYful Cloud positioning', () => {
  it('returns the substrate framing and stays out of the always-paid body', async () => {
    const { content } = await substrateHandler({});
    const text = content[0].text;
    expect(text).toMatch(/PLAYful Cloud/);
    expect(text).toMatch(/Persistent/);
    expect(text).toMatch(/Agent-Yoked/);
    // The cloud shape-mapping survived the move out of quick-orientation rules.
    expect(text).toMatch(/Temporal/);
    // The substrate philosophy is reached on demand, not in forward_context.
    const body = buildForwardContextBody({ register: 'mixed', disclosure: 'reflective' });
    expect(body).not.toContain('PLAYful Cloud — what mojulo is at the substrate');
    expect(body).toContain('`get_substrate`');
  });
});

describe('TOOL_INDEX registry sweep — the golden-rule enforcer', () => {
  it('every LISTED tool name appears in the tool index (unlisted aliases exempt)', async () => {
    // The routing/tool index in this file must stay in sync with the live
    // registry — a missing entry leaves the connecting agent flying blind
    // (the view family flew dark for months exactly this way; see
    // tool-list-drawerization.plan.md). Unlisted deprecated aliases are
    // exempt by construction: they resolve in tools/call but are not part
    // of the surfaced tool list.
    const { ensureToolsRegistered, listTools } = await import('@/lib/mcp/server');
    await ensureToolsRegistered();
    const { content } = await toolIndexHandler({});
    const text = content[0].text;
    const missing = listTools()
      .map((t) => t.name)
      .filter((name) => !text.includes(`\`${name}\``));
    expect(missing).toEqual([]);
  });
});

describe('workshop pulse (orientation-ramp R1) + craft floor (R5)', () => {
  it('pulse line renders counts, omitting zero segments', () => {
    const body = buildForwardContextBody({
      pulse: {
        bots: 3,
        sketches: 12,
        stashes: 0,
        cooks: 1,
        unseenPlans: 4,
        triggers: 0,
        lastActivityMs: Date.now() - 2 * 86_400_000,
      },
    });
    expect(body).toContain('Workshop pulse: 3 bots · 12 sketches · 1 open cook · 4 unseen plans');
    expect(body).toContain('last activity 2d ago');
    const pulseLine = body.split('\n').find((l) => l.includes('Workshop pulse'));
    expect(pulseLine).not.toContain('stash'); // zero-count segments are omitted
  });

  it('empty workshop renders the first-win variant instead of counts', () => {
    const body = buildForwardContextBody({
      pulse: { bots: 0, sketches: 0, stashes: 0, cooks: 0, unseenPlans: 0, triggers: 0, lastActivityMs: 0 },
    });
    expect(body).toContain('Workshop pulse: empty');
    expect(body).toContain('`create_sketch`');
  });

  it('no pulse (fail-soft null) → body renders without the line; module-load constant stays pulseless', () => {
    const body = buildForwardContextBody({});
    expect(body).not.toContain('Workshop pulse');
    expect(FORWARD_CONTEXT_BODY).not.toContain('Workshop pulse');
  });

  it('handler resolves the pulse from the live DB (empty in-memory DB → empty variant)', async () => {
    const { content } = await forwardContextHandler({});
    expect(content[0].text).toContain('Workshop pulse: empty');
  });

  it('craft-floor sentence is in the opener in every register', () => {
    for (const register of VOCABULARY_REGISTERS) {
      const body = buildForwardContextBody({ register });
      expect(body).toContain('artifacts prove themselves before promotion');
    }
  });
});

describe('refusal legend (orientation-ramp R3b)', () => {
  it('register kit carries the legend in every register × disclosure cell', () => {
    for (const register of VOCABULARY_REGISTERS) {
      for (const disclosure of PROCEDURAL_DISCLOSURES) {
        const kit = buildRegisterKitBody({ register, disclosure });
        expect(kit).toContain('When mojulo says no');
        expect(kit).toContain('Promotion gate');
        expect(kit).toContain('allow_unaudited');
      }
    }
  });

  it('the legend stays OUT of the always-paid forward_context body', () => {
    const body = buildForwardContextBody({});
    expect(body).not.toContain('When mojulo says no');
  });
});

describe('paradigm coverage sweep (orientation-diet thread E) — the "three vs four artifacts" drift class', () => {
  it('every PARADIGMS member is named on every orientation surface', async () => {
    const { SERVER_INSTRUCTIONS, ensureToolsRegistered, listTools } = await import(
      '@/lib/mcp/server'
    );
    await ensureToolsRegistered();
    const surfaces = {
      'initialize preamble (SERVER_INSTRUCTIONS)': SERVER_INSTRUCTIONS,
      'lean opener (forward_context body)': buildForwardContextBody({}),
      'get_substrate description': listTools().find((t) => t.name === 'get_substrate').description,
      'get_substrate body': (await substrateHandler({})).content[0].text,
    };
    for (const register of VOCABULARY_REGISTERS) {
      surfaces[`register-kit glossary (${register})`] = buildRegisterKitBody({
        register,
        disclosure: 'reflective',
      });
    }
    for (const [surface, text] of Object.entries(surfaces)) {
      const lower = text.toLowerCase();
      for (const paradigm of PARADIGMS) {
        expect(lower, `${surface} does not name paradigm "${paradigm}"`).toContain(
          paradigm.toLowerCase(),
        );
      }
    }
  });
});

describe('routing index row lint (orientation-diet thread B) — "index, not glossary" as a test', () => {
  // A routing row is a recognizer + an entry tool + one card pointer. A row
  // that outgrows this ceiling is a drawer wearing an index's clothing — move
  // the detail into the tool description, a vocab card, or get_tool_index.
  const ROUTING_ROW_CEILING = 1000;

  it(`no routing bullet exceeds ${ROUTING_ROW_CEILING} chars`, () => {
    const body = buildForwardContextBody({});
    const section = body.split('## Routing index')[1].split('## Drawers')[0];
    const offenders = section
      .split('\n')
      .filter((l) => l.startsWith('- ') && l.length > ROUTING_ROW_CEILING)
      .map((l) => `${l.length} chars: ${l.slice(0, 80)}…`);
    expect(offenders).toEqual([]);
  });
});

describe('forward_context body ceiling (orientation-diet, routing-card move) — the aggregate pin', () => {
  // The row lint above pins each row; this pins the WHOLE always-paid body.
  // Row-size ratchets alone leak through row COUNT (each new capability ships
  // a fresh near-ceiling row and the per-row lint passes while the index
  // grows) — that is exactly how the pre-diet body reached ~18.5K chars. The
  // mini segmented Create-things index + routing cards brought it to ~10.4K;
  // this ceiling makes regrowth a conscious, test-failing decision. Shrink
  // freely; to grow deliberately, raise the number in the same commit that
  // justifies it. New creative capability = a routing card, not a body row.
  const BODY_CEILING = 11_000;

  it(`every register × disclosure cell stays under ${BODY_CEILING} chars`, () => {
    for (const register of VOCABULARY_REGISTERS) {
      for (const disclosure of PROCEDURAL_DISCLOSURES) {
        const body = buildForwardContextBody({ register, disclosure });
        expect(
          body.length,
          `cell ${register}+${disclosure} is ${body.length} chars (> ${BODY_CEILING})`,
        ).toBeLessThan(BODY_CEILING);
      }
    }
  });
});

describe('enumerated counts stay true (orientation-diet thread E)', () => {
  it('the "N kinds" claim for create_view matches the live kind registry on both index surfaces', async () => {
    const { VIEW_KINDS } = await import('./create-view.js');
    const claim = `${Object.keys(VIEW_KINDS).length} kinds`;
    const { content } = await toolIndexHandler({});
    expect(content[0].text, `TOOL_INDEX create_view row must say "${claim}"`).toContain(claim);
    expect(
      buildForwardContextBody({}),
      `routing index create_view row must say "${claim}"`,
    ).toContain(claim);
  });
});
