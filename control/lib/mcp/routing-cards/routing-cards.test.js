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

  it('every card entry tool is reachable from the always-paid body (inline or via the hop)', () => {
    // The mini index names the high-traffic entry tools inline; the rest ride
    // behind the routing hop. Either way the tool must appear in the body or
    // in a card — a creative entry named in NEITHER layer is dark.
    const body = buildForwardContextBody({});
    const catalog = getRoutingCardCatalog();
    const dark = [...catalog.values()]
      .filter((c) => !body.includes(`\`${c.entry}\``))
      .map((c) => c.entry);
    // Cards exist precisely so the body doesn't need every tool inline — this
    // asserts the card itself carries the entry (loader guarantees `entry`),
    // and flags any card whose entry is ALSO absent from the body so the
    // author consciously decided which layer carries it.
    expect(dark).toEqual([]);
  });
});
