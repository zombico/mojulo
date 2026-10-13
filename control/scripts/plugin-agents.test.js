import { describe, it, expect } from 'vitest';
import { staleFiles, toolsOf, runnerAgent, makerAgent, skillBlock } from './plugin-agents.mjs';
import { TOOL_TIERS } from '../lib/mcp/tool-tiers.js';

// The plugin's subagents and its skill's tiers block are generated from lib/mcp/tool-tiers.js. A tier change that is
// not regenerated fails here: `node scripts/plugin-agents.mjs`, then commit the plugin files with the change.
describe('the Claude plugin subagents', () => {
  it('are current with the tier table', () => {
    expect(staleFiles(), 'stale: node scripts/plugin-agents.mjs').toEqual([]);
  });

  it('never hand a subagent a tool above its tier', () => {
    const design = Object.keys(TOOL_TIERS).filter((n) => TOOL_TIERS[n] === 'design');
    const judge = Object.keys(TOOL_TIERS).filter((n) => TOOL_TIERS[n] === 'judge');
    const runner = runnerAgent();
    const maker = makerAgent();
    for (const n of design) {
      expect(runner).not.toContain(`mcp__plugin_mojulo_mojulo__${n},`);
      expect(maker).not.toContain(`mcp__plugin_mojulo_mojulo__${n},`);
    }
    for (const n of judge) expect(runner).not.toContain(`__${n}`);
  });

  it('pin the model and effort per subagent', () => {
    expect(runnerAgent()).toMatch(/^model: haiku$/m);
    expect(runnerAgent()).toMatch(/^effort: low$/m);
    expect(makerAgent()).toMatch(/^model: sonnet$/m);
    expect(makerAgent()).toMatch(/^effort: medium$/m);
  });

  it('can load their deferred MCP tools (ToolSearch rides every tools list)', () => {
    for (const agent of [runnerAgent(), makerAgent()]) expect(agent).toMatch(/^tools: ToolSearch, mcp__plugin_mojulo_mojulo__/m);
  });

  it('leave out tools the plugin build hides', () => {
    expect(toolsOf(['ride', 'fill', 'judge', 'design'])).not.toContain('get_image_render_packet');
  });

  it('keep the design tools with the main session', () => {
    for (const n of toolsOf(['design'])) expect(skillBlock()).toContain(`\`${n}\``);
  });
});
