/**
 * Orientation host-neutrality fence.
 *
 * The surfaces EVERY connected host reads — forward_context, the register kit,
 * the tool index, the deliberation overview — must not teach one host's world
 * to all of them. Two failure modes, both observed in the wild:
 *
 *   1. A CLOSED ROSTER. Shared prose that enumerates the shipped adapters goes
 *      stale the moment a card is added, and it is worse than stale: a host
 *      whose card exists but isn't in the sentence reads itself as `generic`
 *      and materializes the wrong artifact form.
 *   2. A BORROWED IDIOM. `/loop` is a Claude Code slash command. Presented to
 *      every host as THE way to fulfill work, it instructs a Codex or Grok
 *      session to run something that does not exist in its harness.
 *
 * The rule is not "never name a host" — naming one as a worked EXAMPLE is
 * useful. The rule is that shared prose must point at the live registry
 * (`list_adapters` / `get_adapter`) rather than substituting for it, and must
 * not present a host-specific affordance as the only path. Per-host guidance
 * belongs in that host's adapter card, which only that host is served.
 */

import { describe, it, expect } from 'vitest';
import {
  buildForwardContextBody,
  buildRegisterKitBody,
  toolIndexHandler,
  deliberationOverviewHandler,
  substrateHandler,
  FORWARD_CONTEXT_MODES,
} from './context.js';
import { VOCABULARY_REGISTERS } from './meta-context.js';
import { listAdapters } from '../adapters/loader.js';

const text = (res) => res.content.map((c) => c.text).join('\n');

// Every body a host can read WITHOUT asking for anything host-specific. Cover
// each vocabulary register: the glossary is written three times over, and a
// roster that drifts in one variant is invisible if only the default is tested
// (this fence shipped with exactly that hole).
async function sharedBodies() {
  const bodies = {};
  for (const register of VOCABULARY_REGISTERS) {
    bodies[`registerKit:${register}`] = buildRegisterKitBody({ register });
  }
  for (const mode of FORWARD_CONTEXT_MODES) {
    bodies[`forwardContext:${mode}`] = buildForwardContextBody({ mode });
  }
  bodies.toolIndex = text(await toolIndexHandler({}, {}));
  // The compact fallback is a shared surface too — a capped host may never read
  // anything else, so it has to hold the same neutrality bar.
  bodies.rulesCard = text(await toolIndexHandler({ budget_bytes: 20000 }, {}));
  bodies.deliberationOverview = text(await deliberationOverviewHandler({}, {}));
  bodies.substrate = text(await substrateHandler({}, {}));
  return bodies;
}

describe('orientation surfaces stay host-neutral', () => {
  it('forward_context — the default read — names no specific host', () => {
    for (const mode of FORWARD_CONTEXT_MODES) {
      const body = buildForwardContextBody({ mode });
      expect(body).not.toMatch(/claude[- ]code|\.claude\/skills|codex|grok|hermes/i);
    }
  });

  // Only ADAPTER enumerations are the hazard. Other closed sets are fine and
  // correct to enumerate — bot protocols really are fixed at five, and adding
  // one is a code change to mojulo, not a card dropped in a directory. So the
  // check is deliberately narrow: a counted noun that IS "adapter", or a
  // count-of-ships on a line that lists two or more adapter ids.
  // "one" is excluded on purpose: "the full body of one adapter" is ordinary
  // phrasing, not a roster claim. The hazard starts at two.
  const COUNT = '(?:two|three|four|five|six|seven|eight|nine|ten|\\d+)';
  const countedAdapters = new RegExp(`\\b${COUNT}\\s+(?:host\\s+)?adapters?\\b`, 'i');
  const countedShips = new RegExp(`\\b${COUNT}\\s+ship\\b`, 'i');

  function enumeratesRoster(line, ids) {
    if (countedAdapters.test(line)) return true;
    const named = ids.filter((id) => line.includes(`\`${id}\``));
    return named.length >= 2 && countedShips.test(line);
  }

  it('no shared surface enumerates the adapter roster as a closed set', async () => {
    // e.g. "Three ship today: `claude-code`, `codex`, `generic`" — true until it
    // isn't, and silently wrong for whichever host got left out.
    const ids = listAdapters().map((a) => a.id);
    for (const [name, body] of Object.entries(await sharedBodies())) {
      for (const line of body.split('\n')) {
        expect(
          enumeratesRoster(line, ids),
          `${name} enumerates the adapter roster: ${line.slice(0, 120)}`
        ).toBe(false);
      }
    }
  });

  it('a shared surface that names adapters points at the live registry', async () => {
    const ids = listAdapters().map((a) => a.id);
    for (const [name, body] of Object.entries(await sharedBodies())) {
      const named = ids.filter((id) => body.includes(`\`${id}\``));
      if (named.length < 2) continue; // one worked example is fine
      expect(
        /list_adapters|get_adapter/.test(body),
        `${name} names ${named.join(', ')} without pointing at list_adapters/get_adapter`
      ).toBe(true);
    }
  });

  it('fails when a closed roster is reintroduced (the fence has teeth)', () => {
    const ids = listAdapters().map((a) => a.id);
    // The exact line that shipped before this pass.
    expect(
      enumeratesRoster(
        '- **Host adapter** — catalyst → runnable bridge. Three ship today: `claude-code`, `codex`, `generic`.',
        ids
      )
    ).toBe(true);
    // And the phrasings that are NOT the hazard.
    expect(enumeratesRoster('- **Protocol** — a capability a bot can have turned on. Five ship today:', ids)).toBe(false);
    expect(enumeratesRoster('Runner-managed (one shipping runner: `local`). … synthesized into the host adapter.', ids)).toBe(false);
    expect(enumeratesRoster('- `get_adapter` — full body of one adapter: artifact target, parameter collection.', ids)).toBe(false);
  });

  it('never presents a host-specific affordance as the only path', async () => {
    // `/loop` may appear as an example, but not as an unqualified instruction.
    for (const [name, body] of Object.entries(await sharedBodies())) {
      for (const match of body.matchAll(/`\/loop[^`]*`/g)) {
        const window = body.slice(Math.max(0, match.index - 260), match.index + 160);
        expect(
          /your host|in Claude Code|Claude Code that's|affordance/i.test(window),
          `${name} presents ${match[0]} without naming it as this host's affordance`
        ).toBe(true);
      }
    }
  });
});
