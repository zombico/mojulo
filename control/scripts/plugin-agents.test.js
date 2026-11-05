import { describe, it, expect } from 'vitest';
import { generated, staleFiles, toolsOf, runnerAgent, makerAgent, authorAgent, criticAgent, assistantAgent, skillBlock } from './plugin-agents.mjs';
import { LENSES, POSTURES, JOB_AGENTS } from '../lib/graph/gameworld/job-words.js';
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

  it('give a req\'s job agents design_game alone: their view and their report', () => {
    for (const agent of [authorAgent(), criticAgent(), assistantAgent()]) {
      expect(agent).toMatch(/^tools: ToolSearch, mcp__plugin_mojulo_mojulo__design_game$/m);
      expect(agent).toMatch(/^model: sonnet$/m);
      expect(agent).toContain('`as`');
    }
    for (const lens of Object.keys(LENSES)) expect(criticAgent()).toContain(lens);
    for (const q of Object.values(POSTURES)) expect(assistantAgent()).toContain(q);
    // every agent a brief names is one the plugin ships, and the skill hands it its jobs
    for (const name of new Set(Object.values(JOB_AGENTS))) {
      expect(Object.keys(generated()).some((p) => p.endsWith(`agents/${name}.md`)), name).toBe(true);
      expect(skillBlock()).toContain(`\`${name}\``);
    }
  });
});
