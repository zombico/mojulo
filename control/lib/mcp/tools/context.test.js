// Isolate this test file to an in-memory SQLite — must run before any import
// that pulls in db/index.js. Same pattern as meta-context.test.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { commitOperatorKyc } from './meta-context.js';
import { getRegisteredTool } from '@/lib/mcp/server';
import {
  PARADIGMS,
  FORWARD_CONTEXT_MODES,
  DEFAULT_FORWARD_CONTEXT_MODE,
  registerContextTools,
  buildForwardContextBody,
  FORWARD_CONTEXT_BODY,
  forwardContextHandler,
  buildRegisterKitBody,
  registerKitHandler,
  toolIndexHandler,
  creativeToolsetHandler,
  CREATIVE_FORMS,
  FORM_TOOLSETS,
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
        // Checked per WING: no-mode is the studio read (the 2.0 default), and
        // the office read is the explicit one. Both must stay thin.
        for (const [mode, indexHeading, drawerHeading] of [
          [undefined, 'Studio routing index', 'Studio drawers'],
          ['office', 'Routing index', 'Drawers'],
        ]) {
        const body = buildForwardContextBody({ register, disclosure, mode });
        // The routing index and drawer directory are the spine.
        expect(body).toContain(indexHeading);
        expect(body).toContain(drawerHeading);
        // Drawer pointers, including the new substrate drawer.
        expect(body).toContain('`get_tool_index`');
        expect(body).toContain('`get_register_kit`');
        expect(body).toContain('`get_substrate`');
        expect(body).toContain('`get_adapter`');
        // The full one-line-per-tool index no longer lives inline.
        expect(body).not.toContain('the primitive-binding composer for MCP-to-MCP workflows');
        // The concept glossary moved to get_register_kit — its section header
        // and the "don't surface" plain-register marker are both gone.
        expect(body).not.toContain('## Concepts');
        // The substrate philosophy moved to get_substrate.
        expect(body).not.toContain('PLAYful Cloud — what mojulo is at the substrate');
        }
      }
    }
  });

  it('opener is register-invariant: same opener in every register, in both wings', () => {
    // One register-invariant opener per wing — no per-register ramp prose, no
    // "don't surface" plain marker (that machinery lives in get_register_kit).
    for (const [mode, marker] of [
      [undefined, 'The studio **call grammar**'],
      ['office', 'This is the office **routing index**'],
    ]) {
      for (const register of ['plain', 'mojulo']) {
        const body = buildForwardContextBody({ register, disclosure: 'reflective', mode });
        expect(body).toContain(marker);
        expect(body).toContain('routing index');
        expect(body).not.toMatch(/Don't surface to the user/i);
      }
    }
  });

  it('opener is tool-shaped: identity/doctrine prose stays behind get_substrate', () => {
    // The reader is already connected to the substrate — the opener routes,
    // it does not explain what mojulo is. The identity sentence and the
    // craft-floor doctrine live in get_substrate only.
    for (const mode of ['office', 'studio']) {
      const body = buildForwardContextBody({ mode });
      expect(body).not.toContain("the agent's workshop");
      expect(body).not.toContain('prove themselves before promotion');
      expect(body).toContain('`get_substrate`');
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
      'Media',
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

  it('mode selects the wing: STUDIO is the default, office is opt-in, invalid mode rejected', async () => {
    // The 2.0 reposition: an agent arriving with no mode is told about the 3D
    // factory, not the office. Phase 1f.
    const byDefault = await forwardContextHandler({});
    expect(byDefault.content[0].text).toContain('# Mojulo, oriented');
    expect(byDefault.content[0].text).toContain('## Studio routing index');
    expect(byDefault._telemetrySignal.mode).toBe('studio');
    const explicitStudio = await forwardContextHandler({ mode: 'studio' });
    expect(explicitStudio.content[0].text).toBe(byDefault.content[0].text);
    const office = await forwardContextHandler({ mode: 'office' });
    expect(office.content[0].text).toContain('# Mojulo office, oriented');
    expect(office.content[0].text).not.toContain('## Studio routing index');
    await expect(forwardContextHandler({ mode: 'atelier' })).rejects.toThrow(/mode/);
  });

  // The BEHAVIOUR default (studio) was pinned by the test above; its
  // SELF-DESCRIPTION was not — and drifted. Long after 2.0 made studio the
  // default read, the `forward_context` tool description, its `mode` parameter,
  // and the get_tool_index row all still taught `mode:'office'` as the default.
  // Those strings ARE the routing surface (tools/list is read at every connect,
  // before any handler runs), so a stale one mis-routes every fresh session.
  // Pin the prose to the constant so the two cannot disagree again.
  it('self-description agrees with the code default: every surface names STUDIO, none teaches office as default', async () => {
    expect(DEFAULT_FORWARD_CONTEXT_MODE).toBe('studio');
    registerContextTools();
    const tool = getRegisteredTool('forward_context');
    const indexBody = (await toolIndexHandler({})).content[0].text;
    const indexRow = indexBody
      .split('\n')
      .find((line) => line.startsWith('- `forward_context`'));
    expect(indexRow, 'get_tool_index no longer carries a forward_context row').toBeTruthy();

    const surfaces = [
      ['tools/list description', tool.description],
      ['mode parameter description', tool.inputSchema.properties.mode.description],
      ['get_tool_index row', indexRow],
    ];
    // "default … office" in either order is the drift class this catches.
    const teachesOfficeDefault = /default[^.]{0,60}office|office[^.]{0,25}\(\s*default/i;
    const teachesStudioDefault = /default[^.]{0,90}studio|studio[^.]{0,90}default/i;
    for (const [label, text] of surfaces) {
      expect(text, `${label} still teaches office as the default`).not.toMatch(teachesOfficeDefault);
      expect(text, `${label} does not name ${DEFAULT_FORWARD_CONTEXT_MODE} as the default`)
        .toMatch(teachesStudioDefault);
    }
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

  it('carries the substrate facts — posture answers derive from invariants, not guesses', async () => {
    // 0816 post-install persona sims: agents routed build questions cleanly but
    // had no in-substrate source for "does it phone home?", "how do I
    // uninstall?", "do I have to pay?" — semantic_search returned vendor tools.
    // The facts block closes that: a dozen falsifiable architecture invariants
    // the agent derives meta-answers from, with the repo as the depth layer.
    const { content } = await substrateHandler({});
    const text = content[0].text;
    expect(text).toMatch(/## Substrate facts/);
    expect(text).toMatch(/No telemetry, no phone-home/);
    expect(text).toMatch(/AES-256-GCM/);
    expect(text).toMatch(/Apache-2\.0/);
    expect(text).toMatch(/\*\*Removal\.\*\*/);
    expect(text).toMatch(/tamper-evident, not tamper-proof/);
    // The verification layer underneath: the public repo, read at the installed tag.
    expect(text).toMatch(/github\.com\/zombico\/mojulo/);
    // Facts stay behind the drawer — never in the always-paid routing body.
    const body = buildForwardContextBody({ register: 'mixed', disclosure: 'reflective' });
    expect(body).not.toContain('## Substrate facts');
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
    // Creative-mint tools (Ring 10) moved behind get_creative_toolset, so the
    // sweep walks the UNION of the base index + every form drawer. A tool named
    // in any of those surfaces counts as covered.
    const { content } = await toolIndexHandler({});
    let corpus = content[0].text;
    for (const form of CREATIVE_FORMS) {
      corpus += (await creativeToolsetHandler({ form })).content[0].text;
    }
    // The sweep is about the flat CONNECT surface — every listed tool must be
    // discoverable in the orientation corpus. Force flat so packs mode (now the
    // default) doesn't shrink the surface to spine + pack dispatchers.
    const prevPacks = process.env.MOJULO_TOOL_PACKS;
    process.env.MOJULO_TOOL_PACKS = 'off';
    const listed = listTools().map((t) => t.name);
    if (prevPacks === undefined) delete process.env.MOJULO_TOOL_PACKS;
    else process.env.MOJULO_TOOL_PACKS = prevPacks;
    const missing = listed.filter((name) => !corpus.includes(`\`${name}\``));
    expect(missing).toEqual([]);
  });
});

describe('creative toolsets (Ring 10 re-cut by FORM) — the partition + reader', () => {
  const RING10_TOOLS = [
    'create_sketch', 'update_sketch', 'get_sketch_vocab', 'get_style_vocab', 'diff_sketches',
    'sketch_what_possible', 'create_cover',
    'mint_solid', 'edit_solid', 'get_solid_vocab',
    // measure_solid (continuous-guardrails.plan.md G2) — the object drawer's read-back sibling
    'measure_solid',
    'reference_protocol', 'capture_reference',
    'get_image_render_packet', 'bind_character_sheet', 'bind_image_render', 'request_image_render',
    'pull_image_render', 'submit_image_render', 'accept_image_render', 'reject_image_render',
    // the mesh sibling (interchange-seams.plan.md seam 5) — same drawer, same table
    'request_mesh_render', 'pull_mesh_render', 'submit_mesh_render', 'accept_mesh_render', 'reject_mesh_render',
    'verify_machina',
    'compose_world', 'list_world_themes', 'export_model', 'bind_mesh_render', 'translate_modeler_lingo',
    'create_view', 'get_view_vocab', 'measure_view', 'save_recipe',
    'forge_motion', 'stitch_motion', 'get_motion_vocab',
    'create_beats', 'get_beats_vocab', 'get_beats', 'update_beats', 'annotate_beats', 'diff_beats', 'export_beats',
    'create_voice', 'get_voice', 'bind_voice_sample', 'get_voice_vocab',
    'create_game', 'get_game_vocab', 'create_pixelizer_game', 'create_sprite_sheet', 'bake_sprite_sheet', 'export_game',
    // game projects (game-developer.plan.md GP1) — the project layer's tools
    // live in the game form drawer beside the mint.
    'create_game_project', 'get_game_project', 'update_game_project', 'bind_to_game_project', 'list_game_projects',
  ];

  it('FORM_TOOLSETS keys are the shared CREATIVE_FORMS enum, in order (single source of truth)', () => {
    expect(Object.keys(FORM_TOOLSETS)).toEqual(CREATIVE_FORMS);
  });

  it('every Ring 10 tool lives in exactly one form drawer (clean partition)', () => {
    const homes = new Map();
    for (const form of CREATIVE_FORMS) {
      for (const m of FORM_TOOLSETS[form].body.matchAll(/^- `([a-z_]+)`/gm)) {
        const name = m[1];
        homes.set(name, [...(homes.get(name) || []), form]);
      }
    }
    const duped = [...homes].filter(([, forms]) => forms.length > 1).map(([n, f]) => `${n}: ${f.join(', ')}`);
    expect(duped, 'tools appearing in more than one form drawer').toEqual([]);
    expect([...homes.keys()].sort()).toEqual([...RING10_TOOLS].sort());
  });

  it('no-arg returns the form map naming all 12 forms', async () => {
    const { content } = await creativeToolsetHandler({});
    for (const form of CREATIVE_FORMS) {
      expect(content[0].text, `form map names ${form}`).toContain(`\`${form}\``);
    }
    expect(CREATIVE_FORMS.length).toBe(12);
  });

  it('a valid form returns its title + body; an unknown form throws', async () => {
    const { content } = await creativeToolsetHandler({ form: 'audio' });
    expect(content[0].text).toContain('create_beats');
    expect(content[0].text).toContain(FORM_TOOLSETS.audio.title);
    await expect(creativeToolsetHandler({ form: 'nope' })).rejects.toThrow(/unknown form/);
  });

  it('the form map stays cheap to pull (< 2500 chars)', async () => {
    const { content } = await creativeToolsetHandler({});
    expect(content[0].text.length).toBeLessThan(2500);
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

  it('promotion discipline survives in the body as the actionable dry-run rule, not doctrine', () => {
    // The craft-floor *sentence* drawerized into get_substrate; what every
    // session still pays is the operational form: dry-run → inspect → promote
    // (the Synthesize ≠ certify one-liner).
    for (const register of VOCABULARY_REGISTERS) {
      const body = buildForwardContextBody({ register });
      expect(body).toContain('only then promote');
      expect(body).not.toContain('prove themselves before promotion');
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
      'lean opener (office forward_context body)': buildForwardContextBody({}),
      'studio forward_context body': buildForwardContextBody({ mode: 'studio' }),
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

  it(`no routing bullet exceeds ${ROUTING_ROW_CEILING} chars (both wings)`, () => {
    const sections = {
      office: buildForwardContextBody({ mode: 'office' })
        .split('## Routing index')[1]
        .split('## Drawers')[0],
      studio: buildForwardContextBody({ mode: 'studio' })
        .split('## Studio routing index')[1]
        .split('## Studio drawers')[0],
    };
    for (const [wing, section] of Object.entries(sections)) {
      const offenders = section
        .split('\n')
        .filter((l) => l.startsWith('- ') && l.length > ROUTING_ROW_CEILING)
        .map((l) => `${wing}: ${l.length} chars: ${l.slice(0, 80)}…`);
      expect(offenders).toEqual([]);
    }
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
  // Re-pinned 2026-07-13 (was 11_000): Mojulo Voice is a new FORM, which is
  // the one case that legitimately adds a segmented-index row (+ the two
  // form-list mentions) to the always-paid body.
  // Re-pinned 2026-07-17 (was 11_200; widest cell plain+pedagogical measured
  // 11_623): the BUILDING segmented-index row (create_edifice + the
  // dream-edifice catalyst pointer) — a new Create-things artifact category
  // no existing row's phrasing reaches, the same segmented-index-row case as
  // Voice.
  // Split 2026-08-06 (orientation-containment C1, was one BODY_CEILING at
  // 11_700): the FORM recognizer rows relocated into the studio body behind
  // forward_context({mode:'studio'}); the office body carries one STUDIO hook
  // row. A new creative FORM now grows the STUDIO ceiling, never the office
  // ceiling — the office pin only moves for new OPERATE capability.
  // Pinned 2026-08-06 at the split: office measured 9_435 (was 11_623 as the
  // single body), studio measured 7_169 (both at mojulo+pedagogical).
  // Grown 2026-08-08: the motion-comic FORM row (its own routing row per the
  // operator's call, motion-comic.plan.md) — studio measured 7_691.
  //
  // FLIPPED 2026-08-29 (mojulo-2.0-pure-creative.plan.md, Phase 1f): the STUDIO
  // body is now the DEFAULT read, so it — not office — is the always-paid one,
  // and the pulse line moved onto it with the default. Two consequences:
  //   1. This pin previously measured a PULSELESS body, which was fine while the
  //      pulse rode a body with ~750 chars of headroom. On the studio body that
  //      under-measures the real always-paid cost, so the cells below now
  //      include a representative pulse line.
  //   2. Re-pinned studio 7_750 → 8_050 to cover the reposition opener (the 3D
  //      factory framing + the two-pipelines sentence) plus that pulse line.
  //      Measured widest cell 7_649 pulseless / ~7_780 with a typical pulse.
  // The office pin is unchanged and now has slack, being the opt-in read.
  // A new creative FORM still grows the STUDIO ceiling — and that budget is
  // tighter than it was, because studio is what every session pays.
  // Re-pinned 2026-09-01 (forward-context-grammar phase 1): the studio body is
  // now the call grammar, at cost-parity with the FORM rows it replaced — the
  // budget moved into verb/outcome/guard machinery, not savings. Iteration
  // history is the warning label: the v3 draft's tight compression measured
  // 7_382 but FAILED gate 2b (18/33 vs baseline 27/33 — recognizer quotes are
  // load-bearing); v4–v6 restored the proven recognizers + two precision
  // clauses and CLEARED the gate (28/33, behavioral 5/5) at 7_943 widest cell
  // with pulse. Grown 2026-09-01: get_substrate promoted to its own studio
  // drawer bullet with the meta-question trigger ("what is this really?" /
  // phone home / pay / uninstall) — the office wing carried that trigger, the
  // default read did not; measured 8_154. Do not re-compress recognizers to
  // win chars back — score any body edit against gate 2b
  // (body-routing-eval.integration.test.js) first.
  const MODE_CEILINGS = { office: 9_600, studio: 8_250 };

  // A representative pulse: a workshop with something in every bucket. The
  // empty-workshop variant is shorter, so this is the honest worst case.
  const SAMPLE_PULSE = {
    bots: 12, sketches: 340, stashes: 6, cooks: 4, unseenPlans: 3, triggers: 2,
    lastActivityMs: Date.now() - 3 * 86_400_000,
  };

  it('every mode × register × disclosure cell stays under its ceiling', () => {
    for (const [mode, ceiling] of Object.entries(MODE_CEILINGS)) {
      for (const register of VOCABULARY_REGISTERS) {
        for (const disclosure of PROCEDURAL_DISCLOSURES) {
          // pulse included: the default (studio) read carries it in the handler
          const body = buildForwardContextBody({ mode, register, disclosure, pulse: SAMPLE_PULSE });
          expect(
            body.length,
            `cell ${mode}+${register}+${disclosure} is ${body.length} chars (> ${ceiling})`,
          ).toBeLessThan(ceiling);
        }
      }
    }
  });
});

describe('studio containment (orientation-containment C1) — office pays no creative orientation', () => {
  // The office body's only creative content is the STUDIO hook row (+ the
  // opener's wing sentence). Entry tools for creative mints must not leak
  // back — a new creative capability is a studio row + routing card, never
  // an office-body mention. (`create_sketch` can appear via the live pulse
  // line's first-win hint, so containment is asserted on the pulseless body.)
  const STUDIO_ENTRY_TOOLS = [
    'create_sketch',
    'sketch_what_possible',
    'mint_solid',
    'edit_solid',
    'reference_protocol',
    'compose_world',
    'create_view',
    'forge_motion',
    'stitch_motion',
    'create_beats',
    'create_voice',
    'forge_publications',
  ];

  it('office body names no creative entry tool, but carries the studio hook row', () => {
    const office = buildForwardContextBody({ mode: 'office' });
    for (const tool of STUDIO_ENTRY_TOOLS) {
      expect(office, `office body leaks creative entry tool \`${tool}\``).not.toContain(tool);
    }
    // The studio is the DEFAULT read now, so the office hook points at the
    // no-mode call rather than at an explicit mode.
    expect(office).toContain('forward_context()');
    expect(office).toContain('get_creative_toolset');
  });

  it('the office wing states that bots are an optional pack', () => {
    // Routing honesty for the demoted chatbot factory (Phase 1f): an agent must
    // not promise a bot on a host where the pack is not installed.
    expect(buildForwardContextBody({ mode: 'office' })).toMatch(/optional capability pack/i);
  });

  it('studio body is standalone: spine (floor + safety) present in every cell', () => {
    for (const register of VOCABULARY_REGISTERS) {
      for (const disclosure of PROCEDURAL_DISCLOSURES) {
        const body = buildForwardContextBody({ mode: 'studio', register, disclosure });
        for (const phrase of FLOOR_PHRASES) {
          expect(body, `studio cell ${register}+${disclosure} missing "${phrase}"`).toContain(
            phrase,
          );
        }
        expect(body).toContain('## Standing safety rules');
        // Pointer across to the office wing (now the explicit-mode one).
        expect(body).toContain("forward_context({mode:'office'})");
      }
    }
  });

  it('studio completeness: every CREATIVE_FORM named, every entry tool present and registered', async () => {
    const studio = buildForwardContextBody({ mode: 'studio' });
    for (const form of CREATIVE_FORMS) {
      expect(studio, `studio body does not name form "${form}"`).toContain(form);
    }
    const entryTools = [...STUDIO_ENTRY_TOOLS, 'create_game', 'mint_stash', 'cook'];
    const { ensureToolsRegistered, listRegisteredToolNames } = await import('@/lib/mcp/server');
    await ensureToolsRegistered();
    // Registration, not the connect surface: entry tools are packed members
    // under packs mode (now the default) yet still registered and callable.
    const registered = new Set(listRegisteredToolNames());
    for (const tool of entryTools) {
      expect(studio, `studio body does not name entry tool \`${tool}\``).toContain(tool);
      expect(registered.has(tool), `studio body names unregistered tool \`${tool}\``).toBe(true);
    }
  });
});

describe('grammar reachability sweep (forward-context-grammar.plan.md, audit #1)', () => {
  // The grammar must not lie: every tool-shaped name in the studio body must
  // resolve to a REGISTERED tool (a verb drifting into a tool position, or a
  // typo'd dispatch target, fails here — the proxy pilot caught a model
  // answering the verb `recall` as if it were callable). Non-tool underscore
  // tokens (semantic_search kinds) are whitelisted explicitly.
  const NON_TOOL_TOKENS = new Set([
    'game_kit', 'sketch_vocab', 'view_vocab', 'beats_vocab', 'game_vocab',
    'game_mechanic', 'manji_program', 'solid_vocab',
    // communication-settings notice field names (ride the body ahead of the grammar)
    'vocabulary_register', 'procedural_disclosure',
  ]);

  it('every tool-shaped token in the studio body is a registered tool', async () => {
    const { ensureToolsRegistered, listRegisteredToolNames } = await import('@/lib/mcp/server');
    await ensureToolsRegistered();
    const registered = new Set(listRegisteredToolNames());
    // Scan the studio-authored sections only (opener → drawers); the shared
    // spine is covered by its own tests.
    const body = buildForwardContextBody({ mode: 'studio' }).split(
      '## Commitment-level vocabulary',
    )[0];
    const tokens = [...new Set(body.match(/[a-z][a-z0-9]*(?:_[a-z0-9]+)+/g) || [])];
    const phantoms = tokens.filter((t) => !registered.has(t) && !NON_TOOL_TOKENS.has(t));
    expect(phantoms, `tool-shaped tokens with no registered tool: ${phantoms.join(', ')}`).toEqual(
      [],
    );
  });

  it('form-enum integrity: the drawer line advertises exactly the get_creative_toolset forms, in order', () => {
    // The dispatch FORM labels (GAME / PICTURE / OBJECT / …) are recognizers,
    // deliberately NOT the argument enum. The drawer line must carry the real
    // enum verbatim so an agent riding the grammar never guesses
    // { form: 'picture' } — and this pin keeps it from drifting when
    // CREATIVE_FORMS grows.
    const studio = buildForwardContextBody({ mode: 'studio' });
    expect(studio).toContain(`form ∈ ${CREATIVE_FORMS.join(' · ')}`);
  });

  it('every creative tool is reachable from the grammar in ≤2 hops', () => {
    // Hop 1: the body names the two universal drawers. Hop 2: the clean
    // FORM_TOOLSETS partition (pinned by its own test above) makes every
    // Ring 10 tool reachable through get_creative_toolset({ form }) — so the
    // sweep reduces to: hops present + every form drawer non-empty. `render`
    // is deliberately toolless (a verb resolving to a URL, not a call).
    const studio = buildForwardContextBody({ mode: 'studio' });
    expect(studio).toContain('get_creative_toolset');
    expect(studio).toContain('semantic_search');
    for (const form of CREATIVE_FORMS) {
      // Each drawer body is a bullet list of backticked tools — one backtick
      // pair minimum means the drawer actually dispenses a tool.
      expect(
        FORM_TOOLSETS[form]?.body ?? '',
        `form drawer '${form}' is empty — a dispatch row routes to a dead drawer`,
      ).toMatch(/`[a-z][a-z0-9_]+`/);
    }
  });
});
