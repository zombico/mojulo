/**
 * Agent-work tiers — how much judgment a piece of agent work needs.
 *
 *   ride    deterministic; the server does the work, the agent only picks the call
 *   fill    map a clear request onto params (an enum plus a vocab card)
 *   judge   author or revise a recipe; the eyes gate
 *   design  multi-step composition (a plan, a game, a thesis)
 *
 * Host-neutral on purpose: the core names tiers and never a model. Each runtime
 * adapter maps a tier onto its own models and effort (see
 * ../runtime-adapters/claude-code.js); a host with no mapping ignores the tier.
 */

export const TIERS = Object.freeze(['ride', 'fill', 'judge', 'design']);

const TIER_SET = new Set(TIERS);

/** A known tier name, or null for anything else (absent, mistyped, wrong type). */
export function normalizeTier(value) {
  if (typeof value !== 'string') return null;
  const tier = value.trim().toLowerCase();
  return TIER_SET.has(tier) ? tier : null;
}
