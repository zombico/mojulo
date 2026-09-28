import { describe, it, expect } from 'vitest';
import {
  BOT_FACTORY_MOVED,
  REMOVED_BOT_TOOLS,
  isRemovedBotTool,
  botToolMovedNotice,
  botToolMovedResult,
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
});
