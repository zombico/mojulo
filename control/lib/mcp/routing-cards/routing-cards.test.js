// Routing-card shelf — structural guards for the orientation-diet routing-card
// move: forward_context's Create-things section names FORMS + entry tools;
// the full per-family routing rows live here as retrievable cards.
//
// Guards:
//   1. The catalog loads and every card carries the required fields.
//   2. Card lint — a card body that outgrows the ceiling is a vocab card
//      wearing a routing card's clothing (mirror of the routing-row lint).
//   3. Entry-tool sweep — every card's `entry` must be a LISTED tool in the
//      live registry; a card pointing at a renamed/retired tool leaves the
//      connecting agent routed into a wall.
//   4. The mini index actually points at the retrieval hop, and every card's
//      entry tool is still reachable from the always-paid body (named inline
//      OR carried by a card — no creative entry tool may silently vanish
//      from both layers).

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect } from 'vitest';
import {
  getRoutingCardCatalog,
  ROUTING_CARD_BODY_CEILING,
} from './loader.js';
import { buildForwardContextBody } from '@/lib/mcp/tools/context.js';
import { CREATIVE_FORMS } from '@/lib/mcp/creative-forms';
import { TOOL_LINES } from '@/lib/mcp/tool-lines.js';
import { FIXTURE, COLLISION_FIXTURE, KNOWN_MISSES } from './routing-eval.fixture.js';
import { HOLDOUT } from './routing-eval.holdout.js';
import { createHash } from 'node:crypto';

describe('routing-card shelf — loader + lint', () => {
  it('loads the catalog with required fields on every card', () => {
    const catalog = getRoutingCardCatalog();
    expect(catalog.size).toBeGreaterThanOrEqual(16);
    for (const card of catalog.values()) {
      for (const field of ['id', 'name', 'summary', 'when', 'entry', 'body']) {
        expect(card[field], `card ${card.id} missing ${field}`).toBeTruthy();
      }
      // Recognizer quotes are the retrieval signal — a card without quoted
      // user phrasings in `when` can't win the recognition race.
      expect(card.when, `card ${card.id} has no recognizer quotes`).toMatch(/"/);
    }
  });

  it(`every card body fits the ceiling (${ROUTING_CARD_BODY_CEILING} chars)`, () => {
    const offenders = [...getRoutingCardCatalog().values()]
      .filter((c) => c.body.length > ROUTING_CARD_BODY_CEILING)
      .map((c) => `${c.id}: ${c.body.length}`);
    expect(offenders).toEqual([]);
  });
});

describe('routing-card shelf — registry + body sweeps', () => {
  it('every card entry tool is a LISTED tool in the live registry', async () => {
    const { ensureToolsRegistered, isToolListed } = await import('@/lib/mcp/server');
    await ensureToolsRegistered();
    const missing = [...getRoutingCardCatalog().values()]
      .filter((c) => !isToolListed(c.entry))
      .map((c) => `${c.id} → ${c.entry}`);
    expect(missing).toEqual([]);
  });

  it('the mini Create-things index names the retrieval hop', () => {
    const body = buildForwardContextBody({});
    expect(body).toContain("semantic_search({kinds:['routing']");
  });

  it('every creative FORM is covered by at least one routing card (intent → form is reachable)', () => {
    // The retrieval bridge: semantic_search(routing) surfaces a card whose
    // `form` links to get_creative_toolset({ form }). A form with no card is
    // unreachable by intent — the same "no capability flies dark" pin as the
    // tool-index registry sweep, applied to the fuzzy hop. See
    // creative-toolset-retrieval.plan.md.
    const carded = new Set([...getRoutingCardCatalog().values()].map((c) => c.form).filter(Boolean));
    const uncovered = CREATIVE_FORMS.filter((f) => !carded.has(f));
    expect(uncovered, 'creative forms with no routing card').toEqual([]);
  });

  it('every card `form` (when present) names a real creative form; formless cards route off-Ring-10', () => {
    // The loader already throws on an invalid form at load time; this documents
    // the contract and flags a card that dropped its form linkage. A formless
    // card (e.g. publication-cook → mint_stash) is legitimate — it just isn't a
    // creative-mint entry.
    for (const card of getRoutingCardCatalog().values()) {
      if (card.form != null) {
        expect(CREATIVE_FORMS, `card ${card.id} form '${card.form}'`).toContain(card.form);
        expect(card.body, `card ${card.id} should point at its toolset drawer`).toContain(
          `get_creative_toolset({ form: '${card.form}' })`,
        );
      }
    }
  });

  it('every card entry tool is reachable from the orientation body', () => {
    // One body since 3.1.0 (the office wing left the tool surface).
    const bodies = buildForwardContextBody({});
    const catalog = getRoutingCardCatalog();
    const dark = [...catalog.values()]
      .filter((c) => !bodies.includes(`\`${c.entry}\``))
      .map((c) => c.entry);
    // Cards exist precisely so the body doesn't need every tool inline — this
    // asserts the card itself carries the entry (loader guarantees `entry`),
    // and flags any card whose entry is ALSO absent from the body so the
    // author consciously decided which layer carries it.
    expect(dark).toEqual([]);
  });
});

// One door per intent: a listed tool that makes or composes a thing is a door, and a door is an intent a user voices,
// so some fixture row says it in a user's words (CLAUDE.md, the MCP tool surface). The doors below had no row when
// the rule landed: shrink-only, so a new door brings its row instead of a name here.
const DOORS_WITHOUT_A_ROW = [
  'capture_reference', 'cook', 'create_cover', 'create_pixelizer_game', 'create_sprite_sheet', 'design_game',
  'execute_plan', 'forge_plan', 'forge_publications', 'mint_diagram', 'run_experiment_sweep', 'start_research',
  'synthesize_abstract',
];

describe('routing eval fixture — one door per intent', () => {
  it('every listed create / compose tool is some row\'s answer, or on the shrink-only list', async () => {
    const { ensureToolsRegistered, isToolListed } = await import('@/lib/mcp/server');
    await ensureToolsRegistered();
    const answers = new Set(FIXTURE.map(([, tool]) => tool));
    const doors = Object.entries(TOOL_LINES)
      .filter(([name, l]) => ['create', 'compose'].includes(l.verb) && isToolListed(name))
      .map(([name]) => name);
    expect(doors.filter((d) => !answers.has(d) && !DOORS_WITHOUT_A_ROW.includes(d)), 'a door with no fixture row').toEqual([]);
    // a name earns its way off the list by getting a row (or stops being a listed door): take it off
    expect(DOORS_WITHOUT_A_ROW.filter((d) => answers.has(d) || !doors.includes(d)), 'off the list now').toEqual([]);
  });

  it('every row\'s answer is a listed tool: a fold rewrites the rows that named the folded door', async () => {
    const { ensureToolsRegistered, isToolListed } = await import('@/lib/mcp/server');
    await ensureToolsRegistered();
    const stale = [...FIXTURE, ...COLLISION_FIXTURE].filter(([, tool]) => !isToolListed(tool)).map(([p, tool]) => `${tool} ← "${p}"`);
    expect(stale).toEqual([]);
  });

  it('a known miss is a row in the fixture', () => {
    const phrasings = new Set(FIXTURE.map(([p]) => p));
    expect([...KNOWN_MISSES].filter((p) => !phrasings.has(p))).toEqual([]);
  });
});

describe('routing eval held-out set — frozen', () => {
  it('is unchanged: re-pin only for a fold that adds a door to accept sets, never to fit a run', () => {
    // routing-eval.holdout.js says why. Pinned 2026-10-15 (64 requests written blind, 63 kept).
    const hash = createHash('sha256').update(JSON.stringify(HOLDOUT)).digest('hex').slice(0, 16);
    expect(hash).toBe('802ed8e4bae0485b');
  });

  it('every accept set names tools that exist, listed or folded', async () => {
    const { ensureToolsRegistered, hasRegisteredTool } = await import('@/lib/mcp/server');
    await ensureToolsRegistered();
    expect(HOLDOUT.flatMap(([, ts]) => ts).filter((t) => !hasRegisteredTool(t))).toEqual([]);
    expect(new Set(HOLDOUT.map(([p]) => p)).size).toBe(HOLDOUT.length);
  });
});

describe('fixture rows with a mode', () => {
  it('each names a tool whose routing card teaches that mode (the tool name alone passed any call of it)', async () => {
    const { getRoutingCardCatalog } = await import('./loader.js');
    const cards = [...getRoutingCardCatalog().values()];
    const rows = [...FIXTURE, ...COLLISION_FIXTURE].filter((r) => r[2]);
    expect(rows.length).toBeGreaterThan(0);
    for (const [phrasing, tool, mode] of rows) {
      const teaches = cards.some((c) => c.entry === tool && new RegExp(`\\b${mode}\\b`).test(c.body));
      expect(teaches, `"${phrasing}": no ${tool} card teaches ${mode}`).toBe(true);
    }
  });
});
