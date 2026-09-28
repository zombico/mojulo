import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BOT_FACTORY_MOVED,
  REMOVED_BOT_TOOLS,
  isRemovedBotTool,
  botToolMovedNotice,
  botToolMovedResult,
  removedPackRedirect,
} from './bot-factory-moved.js';

describe('the chatbot factory moved notice', () => {
  // The operator's approved wording, verbatim. It names no install of 2.x: that line is
  // unmaintained and has known security issues (SECURITY.md), so nothing points at it.
  it('is the approved wording: what left, since when, where it is going, and that 2.x is unmaintained', () => {
    expect(BOT_FACTORY_MOVED).toBe(
      'The chatbot factory is no longer part of mojulo as of 3.0 and is moving to its own project. '
      + 'Earlier 2.x versions that include it are unmaintained and have known security issues.',
    );
    expect(BOT_FACTORY_MOVED).not.toMatch(/mojulo@|npx|MOJULO_HOME|\.mojulo-\d/);
    expect(BOT_FACTORY_MOVED).not.toMatch(/[`*_]/); // plain text: an in-band answer and a CLI line
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
      "pack_bot_operate left mojulo with the chatbot factory in 3.0, but 'list_running' stayed: it is homed in pack_runtime. Dispatch it there: pack_runtime({ tool: 'list_running', args: { … } }).",
    );
    expect(removedPackRedirect('pack_bot_build', 'recommend_kind', lookups)).toMatch(/^pack_bot_build left mojulo with the chatbot factory in 3\.0, .*homed in pack_stash/);
    expect(removedPackRedirect('pack_fleet', 'forward_context', lookups)).toMatch(/^pack_fleet left mojulo with the chatbot factory in 3\.0, .*spine tool — call it directly/);
    // A bare call, a removed member, an unknown member or a live dispatcher: no redirect.
    expect(removedPackRedirect('pack_bot_operate', undefined, lookups)).toBeNull();
    expect(removedPackRedirect('pack_bot_operate', 'get_deployment', { homeOf: () => 'pack_x' })).toBeNull();
    expect(removedPackRedirect('pack_bot_operate', 'no_such_tool', lookups)).toBeNull();
    expect(removedPackRedirect('save_modular_bot', 'list_running', lookups)).toBeNull();
  });
});

// `mojulo install chatbot` on 3.x: the notice, "nothing was installed", exit 0, and a leftover 2.x
// marker named as ignored and left in place (deleting it is the operator's choice, never advice
// tied to running 2.x).
describe('mojulo install chatbot', () => {
  const script = fileURLToPath(new URL('../../scripts/mcp-install.mjs', import.meta.url));
  const install = (home, pack = 'chatbot') => spawnSync(process.execPath, [script, 'install', pack], {
    env: { ...process.env, MOJULO_HOME: home, MOJULO_DISTRIBUTION: 'npm' },
    encoding: 'utf8',
  });

  it('prints the notice, installs nothing and exits 0, with or without a 2.x marker', () => {
    const home = mkdtempSync(path.join(os.tmpdir(), 'mojulo-moved-'));
    try {
      for (const pack of ['chatbot', 'ops']) {
        const bare = install(home, pack);
        expect(bare.status, pack).toBe(0);
        expect(bare.stdout, pack).toBe(`${BOT_FACTORY_MOVED}\nNothing was installed.\n`);
      }
      const marker = path.join(home, 'packs', 'chatbot');
      mkdirSync(path.dirname(marker), { recursive: true });
      writeFileSync(marker, '');
      const withMarker = install(home);
      expect(withMarker.status).toBe(0);
      expect(withMarker.stdout).toContain(`${BOT_FACTORY_MOVED}\nNothing was installed.\n`);
      expect(withMarker.stdout).toContain(`${marker} is ignored by 3.0; you may delete it.`);
      expect(withMarker.stdout).not.toMatch(/mojulo@\d|2\.x (needs|reads|uses)/);
      expect(existsSync(marker)).toBe(true);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
