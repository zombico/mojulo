/**
 * Rules card — the compact fallback served to output-capped hosts.
 *
 * Two properties matter: it FITS (that is the whole point), and it never
 * silently substitutes for the thing the agent asked for.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { buildRulesCard, DEFAULT_RULES_BUDGET } from './rules-card.js';
import { toolIndexHandler } from './context.js';
import { ensureToolsRegistered } from '../server.js';
import { listHostProfiles } from '../hosts/registry.js';
import { rememberClientInfo, _resetClientBindingsForTests } from '../client-bindings.js';

// Simulate the production path: initialize captures clientInfo, later calls
// resolve the host (and its cap) from the session — no hint parameter needed.
function cappedCtx(name) {
  const mcpSessionId = `test-${name}`;
  rememberClientInfo(mcpSessionId, { name });
  return { mcpSessionId };
}

const bytes = (s) => Buffer.byteLength(s, 'utf8');
const text = (res) => res.content.map((c) => c.text).join('\n');

beforeAll(async () => {
  await ensureToolsRegistered();
  _resetClientBindingsForTests();
});

describe('rules card fits its budget', () => {
  it('fits the default 20k budget with descriptions intact', () => {
    const card = buildRulesCard({});
    expect(card.fits).toBe(true);
    expect(card.bytes).toBeLessThanOrEqual(DEFAULT_RULES_BUDGET);
    expect(card.maxClause).toBeGreaterThan(0); // didn't have to fall back to names
  });

  it('fits every cap any shipped host profile declares', () => {
    const capped = listHostProfiles().filter((p) => p.capabilities.maxOutputBytes);
    expect(capped.length).toBeGreaterThan(0); // grok, at minimum
    for (const profile of capped) {
      const cap = profile.capabilities.maxOutputBytes;
      const card = buildRulesCard({ budgetBytes: cap });
      expect(card.fits, `${profile.id} cap ${cap} → ${card.bytes}`).toBe(true);
    }
  });

  it('degrades to names-only rather than truncating, and says which step it took', () => {
    const card = buildRulesCard({ budgetBytes: 6000 });
    expect(card.fits).toBe(true);
    expect(card.maxClause).toBe(0);
    expect(card.text).toContain('names only');
  });

  it('names what it left out — no silent caps', () => {
    const card = buildRulesCard({});
    expect(card.text).toContain('What this leaves out');
    expect(card.text).toMatch(/tools listed/);
    expect(card.text).toContain('get_tool_index({ full: true })');
  });
});

describe('get_tool_index routing', () => {
  it('an uncapped host still gets the full index — unchanged behavior', async () => {
    const body = text(await toolIndexHandler({}, {}));
    expect(bytes(body)).toBeGreaterThan(DEFAULT_RULES_BUDGET);
    expect(body).not.toContain('rules card (compact)');
  });

  it('a capped host gets the card automatically, and is told why', async () => {
    const body = text(await toolIndexHandler({}, cappedCtx('grok-shell-mojulo')));
    expect(body).toContain('rules card (compact)');
    expect(bytes(body)).toBeLessThanOrEqual(20_000);
    expect(body).toContain('nothing was refused');
  });

  it('never blocks: full:true returns the whole index even on a capped host', async () => {
    const capped = text(await toolIndexHandler({}, cappedCtx('grok-shell-mojulo')));
    const forced = text(await toolIndexHandler({ full: true }, cappedCtx('grok-shell-mojulo')));
    const uncapped = text(await toolIndexHandler({}, {}));
    expect(forced).toBe(uncapped);
    expect(bytes(forced)).toBeGreaterThan(bytes(capped));
  });

  it('any host can ask for the card explicitly', async () => {
    const body = text(await toolIndexHandler({ budget_bytes: 20000 }, {}));
    expect(body).toContain('rules card (compact)');
  });
});
