#!/usr/bin/env node
// End-to-end routing tasks: a real agent session (headless `claude -p`, the operator's own CLI) against a real mojulo
// server (this checkout's stdio entry, or another checkout's with --server) on a throwaway data dir, one task per
// session. Routing evals score the first tool named; this scores what the folds could cost: whether the task got
// done, in how many calls, and how many calls the server refused on their arguments. Read from the server's own
// ledger (mcp_tool_calls) in the throwaway database, with values captured (MOJULO_MCP_TELEMETRY_CAPTURE=full). Billed and slow: run by hand, never in CI.
//
//   node scripts/routing-e2e.mjs [--server <control dir>] [--tasks camera,revise,...] [--model sonnet] [--out <file.json>]
//
// The session runs from an empty temp dir with no user or project settings (no CLAUDE.md, no plugins), only this
// server connected, and Bash / file writes refused.
import { execFile } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const SERVER = path.resolve(opt('server', process.cwd()));
const MODEL = opt('model', 'sonnet');
const OUT = opt('out', null);
const TIMEOUT_MS = Number(opt('timeout-min', 12)) * 60_000;

const input = (c) => { try { return JSON.parse(c.input_json || '{}'); } catch { return {}; } };
const ok = (c) => c.status === 'ok';
const shootWrite = (c) => (c.tool === 'create_shoot_plan' && ok(c) && input(c).plan) || (c.tool === 'forge_motion' && ok(c) && input(c).shoot?.plan);
const shootEdit = (c) => (c.tool === 'update_shoot_plan' && ok(c)) || (c.tool === 'forge_motion' && ok(c) && input(c).shoot?.ops);
// a revision on the same ref, and no second character minted for it
const revised = (calls) => calls.some((c) => c.tool === 'update_character' && ok(c)) && calls.filter((c) => c.tool === 'create_character' && ok(c)).length === 1;

export const TASKS = {
  camera: {
    prompt: 'Make a small walkable town square, then put a camera in it that slowly pushes in toward the middle of the square over 4 seconds with a 35mm lens, and give me the shot list. No need to render a video.',
    done: (calls) => calls.some(shootWrite),
  },
  'camera-edit': {
    prompt: 'Make a small walkable park, set up one camera with two keyframes over 3 seconds looking across it, then change the second keyframe to an 85mm lens with easy ease. No need to render a video.',
    done: (calls) => calls.some(shootWrite) && calls.some(shootEdit),
  },
  revise: {
    prompt: 'Make a knight hero for my game. When he is done, make him look older and give him a beard: the same character, not a new one.',
    done: revised,
  },
  hair: {
    prompt: 'Make an anime heroine with long straight hair. Then change her hair to two braids.',
    done: revised,
  },
  ground: {
    prompt: 'Make me a quick platformer level where you reach the exit. Then give that level some real hills and a cliff along one side.',
    done: (calls) => calls.some((c) => c.tool === 'design_game' && ok(c)) && calls.some((c) => (c.tool === 'tune_ground' && ok(c)) || (c.tool === 'design_game' && ok(c) && input(c).ground)),
  },
  race: {
    prompt: 'Make me a quick kart race game against 3 rivals.',
    done: (calls) => calls.some((c) => c.tool === 'design_game' && ok(c) && input(c).quick?.goal === 'race'),
  },
};

const SYSTEM = 'Work through the request on your own with the mojulo tools: make sensible choices instead of asking the user, and stop when it is done.';

function runTask(id) {
  const task = TASKS[id];
  const dir = mkdtempSync(path.join(tmpdir(), `mojulo-e2e-${id}-`));
  const cfg = path.join(dir, 'mcp.json');
  writeFileSync(cfg, JSON.stringify({
    mcpServers: { mojulo: { command: 'node', args: [path.join(SERVER, 'scripts/mcp-stdio.mjs')], env: { MOJULO_DATA_DIR: path.join(dir, 'data'), MOJULO_OUTCOMES_DIR: path.join(dir, 'data', 'outcomes'), MOJULO_MCP_TELEMETRY_CAPTURE: 'full' } } },
  }));
  const cli = [
    '-p', task.prompt, '--model', MODEL, '--output-format', 'stream-json', '--verbose',
    '--mcp-config', cfg, '--strict-mcp-config', '--setting-sources', 'project',
    '--allowedTools', 'mcp__mojulo', '--disallowedTools', 'Bash', 'Write', 'Edit', 'NotebookEdit', 'WebFetch', 'WebSearch',
    '--append-system-prompt', SYSTEM,
  ];
  const started = Date.now();
  return new Promise((resolve) => {
    execFile('claude', cli, { cwd: dir, timeout: TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 }, (err, stdout) => {
      const events = String(stdout || '').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
      const result = events.find((e) => e.type === 'result') || {};
      let calls = [];
      try {
        const db = new Database(path.join(dir, 'data', 'mojulo-lite.db'), { readonly: true, fileMustExist: true });
        calls = db.prepare('SELECT tool, status, error_message, input_json FROM mcp_tool_calls ORDER BY started_at').all();
        db.close();
      } catch { /* the server never wrote: no calls */ }
      const errors = calls.filter((c) => !ok(c));
      resolve({
        task: id, server: SERVER, done: task.done(calls), calls: calls.length, errors: errors.length,
        tools: calls.map((c) => (ok(c) ? c.tool : `${c.tool}!`)),
        errorMessages: errors.map((c) => `${c.tool}: ${String(c.error_message || '').slice(0, 160)}`),
        turns: result.num_turns ?? null, costUsd: result.total_cost_usd ?? null, seconds: Math.round((Date.now() - started) / 1000),
        ...(err && !result.type ? { failed: String(err.message).slice(0, 200) } : {}),
      });
    });
  });
}

const ids = (opt('tasks', Object.keys(TASKS).join(','))).split(',');
const results = [];
for (const id of ids) {
  const r = await runTask(id);
  results.push(r);
  console.log(`${r.done ? 'DONE' : 'MISS'} ${id}: ${r.calls} calls, ${r.errors} refused, ${r.seconds}s, $${r.costUsd ?? '?'}  ${r.tools.join(' → ')}`);
}
if (OUT) writeFileSync(OUT, JSON.stringify({ when: new Date().toISOString(), model: MODEL, server: SERVER, results }, null, 2));
