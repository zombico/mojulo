import { describe, it, expect } from 'vitest';
import { DESCRIPTION_BUDGET, STARTS, describe as describeStart, readCard, startSkill, startsBlock } from './plugin-skills.mjs';
import { TOOL_TIERS } from '../lib/mcp/tool-tiers.js';
import { hiddenInPluginProfile } from '../lib/mcp/plugin-profile.js';

// The plugin's start skills are generated from the routing cards (plugin-agents.test.js holds them current with the
// files); these hold what each one promises.
describe('the Claude plugin start skills', () => {
  it('route to a listed tool the plugin build shows, the entry of their first card', () => {
    for (const start of STARTS) {
      const { entry } = readCard(start.cards[0]);
      expect(TOOL_TIERS, `${start.name}: ${entry}`).toHaveProperty(entry);
      expect(hiddenInPluginProfile(entry, { MOJULO_DISTRIBUTION: 'claude-plugin' })).toBe(false);
      expect(startSkill(start)).toContain(`select:mcp__plugin_mojulo_mojulo__${entry}`);
    }
  });

  it('describe themselves in the person\'s words, the use case first, inside the budget', () => {
    for (const start of STARTS) {
      const d = describeStart(start);
      expect(d.startsWith(start.lead)).toBe(true);
      expect(d.length).toBeLessThanOrEqual(DESCRIPTION_BUDGET);
      expect(d).toContain(`"${[...readCard(start.cards[0]).when.matchAll(/"([^"]+)"/g)][0][1]}"`);
    }
  });

  it('carry each card they route to, as the card says it', () => {
    const start = STARTS.find((s) => s.cards.length > 1);
    const skill = startSkill(start);
    for (const id of start.cards) expect(skill).toContain(readCard(id).body);
  });

  it('are each named in the main skill', () => {
    for (const start of STARTS) expect(startsBlock()).toContain(`\`${start.name}\``);
  });
});
