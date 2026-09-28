import { describe, it, expect } from 'vitest';
import {
  BOT_FACTORY_MOVED,
  REMOVED_BOT_TOOLS,
  isRemovedBotTool,
  botToolMovedNotice,
  botToolMovedResult,
  removedPackRedirect,
} from './bot-factory-moved.js';

describe('the chatbot factory moved notice', () => {
  it('says what left, since when, where it is until it ships, and that deployed bots keep running', () => {
    expect(BOT_FACTORY_MOVED).toMatch(/no longer part of mojulo as of 3\.0\.0/);
    expect(BOT_FACTORY_MOVED).toMatch(/its own project/);
    expect(BOT_FACTORY_MOVED).toContain('npx -y mojulo@2');
    expect(BOT_FACTORY_MOVED).toMatch(/keep running/);
  });

  it('lists each removed name once, including the three pack dispatchers', () => {
    expect(new Set(REMOVED_BOT_TOOLS).size).toBe(REMOVED_BOT_TOOLS.length);
    for (const name of ['save_modular_bot', 'inspect_bot_env', 'verify_fleet_chains', 'request_chat_decision', 'pack_bot_build', 'pack_fleet']) {
      expect(isRemovedBotTool(name), name).toBe(true);
    }
  });

  it('keeps the retained tools that sat in the bot packs until 3.0 off the list', () => {
    for (const name of ['list_running', 'list_env', 'set_env', 'delete_env', 'recommend_kind', 'pull_agent_task', 'submit_envelope_inference', 'cancel_agent_task']) {
      expect(isRemovedBotTool(name), name).toBe(false);
    }
    expect(isRemovedBotTool(undefined)).toBe(false);
  });

  it('answers a removed name with an in-band tool error naming it', () => {
    const result = botToolMovedResult('poll_job');
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: 'text', text: botToolMovedNotice('poll_job') }]);
    expect(result.content[0].text).toMatch(/^'poll_job' was part of the chatbot factory\. /);
    expect(result.content[0].text).toContain(BOT_FACTORY_MOVED);
  });

  // 2.x listed list_running, the env tools and recommend_kind in the bot packs; 3.0 kept them
  // under other homes, so a cached call through the old dispatcher is re-routed, not told to leave.
  it('re-routes a removed pack dispatcher that names a tool 3.0 kept, and only then', () => {
    const homes = { list_running: 'pack_runtime', recommend_kind: 'pack_stash' };
    const lookups = { homeOf: (n) => homes[n] ?? null, isSpine: (n) => n === 'forward_context' };
    expect(removedPackRedirect('pack_bot_operate', 'list_running', lookups)).toBe(
      "'list_running' is not in pack_bot_operate — it is homed in pack_runtime. Dispatch it there: pack_runtime({ tool: 'list_running', args: { … } }).",
    );
    expect(removedPackRedirect('pack_bot_build', 'recommend_kind', lookups)).toMatch(/homed in pack_stash/);
    expect(removedPackRedirect('pack_fleet', 'forward_context', lookups)).toMatch(/spine tool — call it directly/);
    // A bare call, a removed member, an unknown member or a live dispatcher: no redirect.
    expect(removedPackRedirect('pack_bot_operate', undefined, lookups)).toBeNull();
    expect(removedPackRedirect('pack_bot_operate', 'get_deployment', { homeOf: () => 'pack_x' })).toBeNull();
    expect(removedPackRedirect('pack_bot_operate', 'no_such_tool', lookups)).toBeNull();
    expect(removedPackRedirect('save_modular_bot', 'list_running', lookups)).toBeNull();
  });
});
