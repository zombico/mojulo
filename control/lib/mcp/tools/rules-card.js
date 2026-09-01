/**
 * Rules card — the compact fallback for output-capped hosts.
 *
 * Some hosts cap MCP tool results (Grok: ~20k). `get_tool_index` is ~48k, so on
 * those hosts the full index is a truncated read — the agent loses the tail and
 * doesn't know what it lost. This builds a sub-budget substitute: the standing
 * rules, then one terse line per installed tool.
 *
 * Posture (docs/responsibility-model.md): mitigate, disclose, never block. The
 * card is served INSTEAD of an over-budget index and says so in its first lines,
 * with the escape hatch named — `get_tool_index({ full: true })` always returns
 * the real thing, truncation and all. Mojulo does not refuse a call because the
 * result might not fit, and does not silently reshape one either. Whatever the
 * card drops, it names in the footer; there are no silent caps.
 *
 * Fitting is by degradation, not truncation: clause length steps down
 * (72 → 48 → 32 → names only) until the body fits the budget, and the footer
 * reports which step it landed on.
 */

import { getRegisteredTool } from '@/lib/mcp/server';
import { PACKS, SPINE, installedPacks, isToolInstalled } from '@/lib/mcp/packs';

export const DEFAULT_RULES_BUDGET = 20_000;
const CLAUSE_STEPS = [72, 48, 32, 0]; // 0 = names only

/** The invariants an agent must not get wrong, one line each. Terse on purpose:
 * this is the surface a host reads when it cannot afford the manual. */
const RULES = [
  'Recipes, not renders — an artifact is seeded params that re-render; a PNG/WAV/STL is a derived file bound to it.',
  '`forward_context` first, then one drawer at a time. `semantic_search` when you have an intent but no ref.',
  'Never read `.env` — use `inspect_bot_env`. No path may log raw secrets, including error paths.',
  'Dry-run before live writes. The operator flips it, not you.',
  'Seal with `meta_context_commit` AFTER the artifact exists, never to declare intent.',
  'Loopback only — mojulo binds to localhost and has no auth layer. No tunnels, no public exposure.',
  'Packs can be absent from an install. A refusal names the install command; execution is walled, knowledge is not.',
  'Ask before destructive or outward-facing acts. Approval in one context does not carry to the next.',
  'Capability and intent judgments are the operator\'s. Do not gate on use case.',
  'Your adapter card (`get_adapter`) is guidance for your substrate, not a constraint on it.',
];

/** Strip markdown, drop a leading ALL-CAPS family tag, cut to one clause. */
function clause(description, max) {
  if (!description || !max) return '';
  let t = String(description)
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[A-Z][A-Z0-9 /&+,.-]{3,40}—\s*/, '');
  const stop = t.indexOf('. ');
  if (stop > 12 && stop < max * 2) t = t.slice(0, stop);
  if (t.length > max) t = t.slice(0, max - 1).replace(/[ ,;:—-]+$/, '') + '…';
  return t;
}

function groups(env) {
  const out = [{ title: 'spine (always listed)', members: SPINE }];
  const installed = new Set(installedPacks(env).map((p) => p.id));
  for (const pack of PACKS) {
    if (!installed.has(pack.id)) continue;
    out.push({ title: pack.title || pack.id, members: pack.members || [] });
  }
  return out;
}

function renderBody({ env, maxClause, notice, omitted }) {
  const lines = ['# mojulo — rules card (compact)', ''];
  if (notice) lines.push(notice, '');
  lines.push('## Rules', ...RULES.map((r) => `- ${r}`), '');
  lines.push('## Tools');
  let listed = 0;
  for (const group of groups(env)) {
    const rows = [];
    for (const name of group.members) {
      if (!isToolInstalled(name, env)) continue;
      const tool = getRegisteredTool(name);
      const text = maxClause ? clause(tool?.description, maxClause) : '';
      rows.push(text ? `- ${name} — ${text}` : `- ${name}`);
      listed += 1;
    }
    if (!rows.length) continue;
    lines.push(`### ${group.title}`, ...rows);
  }
  lines.push('');
  lines.push('## What this leaves out');
  lines.push(
    `- ${listed} tools listed${maxClause ? ` with descriptions trimmed to ~${maxClause} chars` : ', names only (no descriptions — the budget was too small for them)'}. Full text: \`get_tool_index({ full: true })\`, one pack at a time via its dispatcher, or \`semantic_search\`.`
  );
  if (omitted.length) {
    lines.push(
      `- Not installed on this host, so not listed: ${omitted.map((p) => p.id).join(', ')} — add with \`mojulo install <group>\`.`
    );
  }
  lines.push('- Per-form creative tools stay behind `get_creative_toolset({ form })`.');
  return lines.join('\n');
}

/**
 * Build a rules card that fits `budgetBytes`.
 * @returns {{ text: string, bytes: number, maxClause: number, fits: boolean }}
 */
export function buildRulesCard({ budgetBytes = DEFAULT_RULES_BUDGET, notice = '', env = process.env } = {}) {
  const installed = new Set(installedPacks(env).map((p) => p.id));
  const omitted = PACKS.filter((p) => !installed.has(p.id));
  let last = null;
  for (const maxClause of CLAUSE_STEPS) {
    const text = renderBody({ env, maxClause, notice, omitted });
    const bytes = Buffer.byteLength(text, 'utf8');
    last = { text, bytes, maxClause, fits: bytes <= budgetBytes };
    if (last.fits) return last;
  }
  // Names-only still over budget: return it anyway and let the caller/operator
  // see an honest over-budget body rather than a silently amputated one.
  return last;
}

/** Notice line for the automatic fallback, stating both sizes and the escape. */
export function overBudgetNotice({ fullBytes, budgetBytes, host }) {
  const k = (n) => `${(n / 1000).toFixed(1)}k`;
  return `*Compact form.* The full tool index is ${k(fullBytes)} against ${host ? `${host}'s` : 'your'} declared ${k(budgetBytes)} cap, so this is the rules card instead — nothing was refused and nothing was silently cut. \`get_tool_index({ full: true })\` returns the whole index regardless (expect your host to truncate it); \`semantic_search\` finds one tool without the index.`;
}
