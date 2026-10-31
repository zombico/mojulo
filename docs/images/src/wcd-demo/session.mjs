// The live session behind the demo GIF: a game maker asks an agent, in their own words, for a multi-level military
// base for a stealth game, sees the plan and the looks, and approves them. A real agent does it; its record is kept
// (session.json): each ask, the calls it made, its reply, and the tokens and cost print mode reported.
//
//   node docs/images/src/wcd-demo/session.mjs [workDir]
//
// The agent is Claude Code in print mode with mojulo (this checkout's control/) as its only tool server and no built-in
// tools, so what it spends is the conversation and the mojulo calls. One process carries the whole conversation: each
// ask is written to its stdin as stream-json once the last one's result is in (no --resume). MODEL picks the model
// (default claude-sonnet-5-5). Needs `claude` signed in.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTROL } from '../lib/browser.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

const work = path.resolve(process.argv[2] || path.join(tmpdir(), 'mj-wcd-session'));
const MODEL = process.env.MODEL || 'claude-sonnet-5-5';
mkdirSync(work, { recursive: true });
const data = path.join(work, 'data');
mkdirSync(path.join(data, 'outcomes'), { recursive: true });

// The asks, in a game maker's words: no tool names, no mojulo words.
export const ASKS = [
  'I\'m making a stealth game. Build me a multi-level military base to infiltrate: you come in through the hangar, work through the barracks and a fortified armoury, and the reactor plant is the core at the very bottom. Each section should look different from the last. Show me the plan and the looks before you build anything.',
  'Looks good, approved. Build it.',
];
// Headless print mode cannot answer back mid-turn, so the agent decides what is its to decide and stops where the
// user asked to see something first.
const SYSTEM = 'Work through each request with the mojulo tools. Make sensible choices yourself instead of asking, except where the user asked to see something before you go on: show it, ask for approval, and stop. Reply in a short paragraph.';

const agentDir = path.join(work, 'agent');
mkdirSync(agentDir, { recursive: true });
const cfg = path.join(agentDir, 'mcp.json');
const mojuloEnv = { MOJULO_DATA_DIR: data, MOJULO_OUTCOMES_DIR: path.join(data, 'outcomes'), ...(process.env.MOJULO_CHROMIUM ? { MOJULO_CHROMIUM: process.env.MOJULO_CHROMIUM } : {}) };
writeFileSync(cfg, JSON.stringify({ mcpServers: { mojulo: { command: 'node', args: [path.join(CONTROL, 'scripts/mcp-stdio.mjs')], env: mojuloEnv } } }));

const cli = ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--model', MODEL,
  '--mcp-config', cfg, '--strict-mcp-config', '--setting-sources', 'project', '--tools', '',
  '--allowedTools', 'mcp__mojulo', '--append-system-prompt', SYSTEM];
const say = (child, text) => child.stdin.write(JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'text', text }] } }) + '\n');

/** One turn's record, from the events between two results. */
function turnOf(prompt, events, result, startedMs) {
  const results = new Map();
  for (const e of events) if (e.type === 'user') for (const c of e.message?.content || []) if (c.type === 'tool_result') results.set(c.tool_use_id, c);
  const tools = [], texts = [];
  for (const e of events) if (e.type === 'assistant') for (const c of e.message?.content || []) {
    if (c.type === 'text' && c.text.trim()) texts.push(c.text.trim());
    if (c.type === 'tool_use') {
      const r = results.get(c.id), body = [].concat(r?.content || []).map((x) => x.text || '').join('');
      let parsed = null; try { parsed = JSON.parse(body); } catch { /* not JSON */ }
      tools.push({ name: c.name.replace(/^mcp__mojulo__/, ''), error: !!r?.is_error || parsed?.ok === false, ...(parsed?.ref ? { ref: parsed.ref } : {}), input: c.input });
    }
  }
  return { prompt, wallMs: Date.now() - startedMs, durationMs: result.duration_ms, apiMs: result.duration_api_ms, numTurns: result.num_turns,
    costUsdSoFar: result.total_cost_usd, usage: result.usage, texts, reply: texts.at(-1) || '', tools };
}

const turns = await new Promise((resolve, reject) => {
  const child = spawn('claude', cli, { cwd: agentDir, stdio: ['pipe', 'pipe', 'inherit'] });
  const out = [];
  let buf = '', events = [], k = 0, started = Date.now();
  const timer = setTimeout(() => child.kill(), 60 * 60 * 1000);
  child.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      let e; try { e = JSON.parse(line); } catch { continue; }
      events.push(e);
      if (e.type !== 'result') continue;
      const t = turnOf(ASKS[k], events, e, started);
      out.push(t);
      // the world as the agent left it at this ask's end: its book, drawn before the next ask goes in
      const world = t.tools.filter((x) => x.name === 'design_game' && x.ref).at(-1)?.ref ?? out.at(-2)?.world;
      if (world) {
        t.world = world;
        spawnSync(process.execPath, [path.join(here, 'book.mjs'), work, world, `turn-${k + 1}`], { stdio: 'inherit', env: { ...process.env, ...mojuloEnv } });
      }
      console.log(`ask ${k + 1}: ${(t.wallMs / 1000).toFixed(0)} s, $${t.costUsdSoFar}, ${t.tools.map((x) => x.name + (x.error ? '!' : '')).join(' → ')}`);
      events = []; k++; started = Date.now();
      if (k < ASKS.length) say(child, ASKS[k]); else child.stdin.end();
    }
  });
  child.on('close', () => { clearTimeout(timer); out.length ? resolve(out) : reject(new Error('claude: no result')); });
  say(child, ASKS[0]);
});

// The record: what each ask cost and called, what the agent said.
const tok = (u) => ({ input: u.input_tokens, output: u.output_tokens, cacheRead: u.cache_read_input_tokens, cacheWrite: u.cache_creation_input_tokens });
const session = {
  note: 'The live session behind the walled-core-dungeon demo GIF, as session.mjs recorded it: each ask, the calls the agent made, its replies, and what print mode reported for each turn.',
  when: new Date().toISOString().slice(0, 10), model: MODEL,
  turns: turns.map((t) => ({ prompt: t.prompt, world: t.world, durationMs: t.durationMs, apiMs: t.apiMs, numTurns: t.numTurns, usage: tok(t.usage), costUsdSoFar: t.costUsdSoFar, texts: t.texts, reply: t.reply, tools: t.tools })),
};
const sum = (k) => session.turns.reduce((n, t) => n + (t.usage[k] ?? 0), 0);
session.total = { input: sum('input'), output: sum('output'), cacheRead: sum('cacheRead'), cacheWrite: sum('cacheWrite'), costUsd: session.turns.at(-1).costUsdSoFar, minutes: +(session.turns.reduce((n, t) => n + t.durationMs, 0) / 60000).toFixed(1) };
writeFileSync(path.join(work, 'session.json'), JSON.stringify(session, null, 1) + '\n');
console.log('total', JSON.stringify(session.total));

// what the session made, as stills (stills.mjs reads the levels off the world's own record)
const world = session.turns.at(-1).world;
if (world) {
  writeFileSync(path.join(work, 'made.json'), JSON.stringify({ world }, null, 1));
  spawnSync(process.execPath, [path.join(here, 'stills.mjs'), work], { stdio: 'inherit', env: { ...process.env, ...mojuloEnv } });
}
