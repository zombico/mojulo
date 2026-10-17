// decor-demo.gif, end to end: mint the Maple Street house as it is handed over, let a real agent session
// redecorate it from three plain-language asks and keep its record (session.json), then film each room before and
// after with forge_motion, mojulo's Observe door (capture.mjs), and compose the GIF with the session's own time,
// tokens and cost on the last slide (compose.mjs).
//
//   node docs/images/src/decor-demo/run.mjs [workDir]
//
// The agent is Claude Code in print mode (`claude -p`, then `--resume` for each later ask) with mojulo as its
// only tool server and no built-in tools, so what it spends is the conversation and the mojulo calls. MODEL picks
// the model (default claude-sonnet-5-5). The filming replays the session's calls afterwards, outside it, and is
// not counted.
// Each print-mode run reports its own `usage` and `duration_ms`; `total_cost_usd` and `modelUsage` run on across a
// --resume, so the session's cost is the last ask's.
// Without MOJULO_DATA_DIR it mints into a fresh data dir under the work dir. Needs `claude` signed in, a Chromium
// for forge_motion (MOJULO_CHROMIUM, or mojulo's own download), Chrome for the compose (CHROME_BIN) and ffmpeg
// (FFMPEG, else `ffmpeg` on PATH).
import { execFile } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTROL, runJson } from '../lib/browser.mjs';
import { capture, recipesOf } from './capture.mjs';
import { compose } from './compose.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const work = path.resolve(process.argv[2] || path.join(tmpdir(), 'mj-decor-demo'));
const MODEL = process.env.MODEL || 'claude-sonnet-5-5';
mkdirSync(work, { recursive: true });
const env = { ...process.env };
env.MOJULO_DATA_DIR ||= path.join(work, 'data');
env.MOJULO_OUTCOMES_DIR ||= path.join(env.MOJULO_DATA_DIR, 'outcomes');
mkdirSync(env.MOJULO_OUTCOMES_DIR, { recursive: true });

const call = (tool, args) => {
  const res = runJson(env, ['scripts/mcp-stdio.mjs', 'call', tool, '--json', JSON.stringify(args)]);
  if (res.ok === false || res.code) throw Object.assign(new Error(`${tool}: ${res.error || res.reason}`), { code: res.code });
  return res;
};

// The asks, in a homeowner's words: no style names, no tool names.
const ASKS = [
  'We just moved into the Maple Street house, it\'s already in mojulo. The living room feels cold and empty. Can you make it warm and cozy, like a cabin? Lots of wood, soft fabrics, warm colours, somewhere to curl up with a book.',
  'That\'s so much better. Now the bigger bedroom: calm and light, like a nice hotel.',
  'Last thing: paint one wall of the living room a deep forest green, and make the sofa velvet.',
];
// Headless print mode cannot answer a question back, so the agent is told to choose; and a chat reply is short.
const SYSTEM = 'Work through each request on your own with the mojulo tools: make sensible choices instead of asking the user, and stop when it is done. Reply in a short paragraph.';

// ── the house as it is handed over ─────────────────────────────────────────────────────────────────────────
const HOUSE = JSON.parse(readFileSync(path.join(here, 'house.json'), 'utf8'));
try { call('mint_building', HOUSE); } catch (e) { if (e.code !== 'REF_EXISTS') throw e; }   // a re-run over the same data dir

// ── the session ────────────────────────────────────────────────────────────────────────────────────────────
const agentDir = path.join(work, 'agent');
mkdirSync(agentDir, { recursive: true });
const cfg = path.join(agentDir, 'mcp.json');
writeFileSync(cfg, JSON.stringify({ mcpServers: { mojulo: { command: 'node', args: [path.join(CONTROL, 'scripts/mcp-stdio.mjs')],
  env: { MOJULO_DATA_DIR: env.MOJULO_DATA_DIR, MOJULO_OUTCOMES_DIR: env.MOJULO_OUTCOMES_DIR, ...(env.MOJULO_CHROMIUM ? { MOJULO_CHROMIUM: env.MOJULO_CHROMIUM } : {}) } } } }));

function ask(prompt, sessionId) {
  const cli = ['-p', prompt, '--model', MODEL, '--output-format', 'stream-json', '--verbose',
    '--mcp-config', cfg, '--strict-mcp-config', '--setting-sources', 'project', '--tools', '',
    '--allowedTools', 'mcp__mojulo', '--append-system-prompt', SYSTEM, ...(sessionId ? ['--resume', sessionId] : [])];
  const started = Date.now();
  return new Promise((resolve, reject) => execFile('claude', cli, { cwd: agentDir, timeout: 20 * 60 * 1000, maxBuffer: 256 * 1024 * 1024 }, (err, stdout) => {
    const events = String(stdout || '').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const result = events.find((e) => e.type === 'result');
    if (!result) return reject(new Error(`claude: ${err?.message || 'no result'}`));
    const results = new Map();
    for (const e of events) if (e.type === 'user') for (const c of e.message?.content || []) if (c.type === 'tool_result') results.set(c.tool_use_id, c);
    const tools = [], texts = [];
    for (const e of events) if (e.type === 'assistant') for (const c of e.message?.content || []) {
      if (c.type === 'text' && c.text.trim()) texts.push(c.text.trim());
      if (c.type === 'tool_use') {
        const r = results.get(c.id), body = [].concat(r?.content || []).map((x) => x.text || '').join('');
        let parsed = null; try { parsed = JSON.parse(body); } catch { /* not JSON */ }
        tools.push({ name: c.name.replace(/^mcp__mojulo__/, ''), input: c.input, error: !!r?.is_error || parsed?.ok === false, ref: parsed?.ref ?? null, room: parsed?.interior?.room?.name ?? null, tag: parsed?.interior?.room?.tag ?? null });
      }
    }
    resolve({ prompt, sessionId: result.session_id, wallMs: Date.now() - started, durationMs: result.duration_ms, apiMs: result.duration_api_ms,
      costUsd: result.total_cost_usd, usage: result.usage, modelUsage: result.modelUsage, numTurns: result.num_turns, reply: texts.at(-1) || '', texts, tools });
  }));
}

const turns = [];
let sid = null;
for (const [i, prompt] of ASKS.entries()) {
  const t = await ask(prompt, sid);
  sid = t.sessionId;
  turns.push(t);
  console.log(`ask ${i + 1}: ${(t.wallMs / 1000).toFixed(0)} s, $${t.costUsd}, ${t.tools.map((x) => x.name + (x.error ? '!' : '')).join(' → ')}`);
}

// The record: what each ask cost and called, what the agent said, and the recipes it left, which the filming replays.
const refs = [...new Set(turns.flatMap((t) => t.tools.filter((x) => !x.error && x.ref).map((x) => x.ref)))];
const session = {
  note: 'The session behind docs/images/decor-demo.gif, as run.mjs recorded it: each ask, the calls the agent made, its reply, and what print mode reported. recipes are the rows it left; capture.mjs replays the calls and checks it gets them back.',
  when: new Date().toISOString().slice(0, 10), model: MODEL, house: HOUSE.ref,
  turns: turns.map((x) => ({ prompt: x.prompt, durationMs: x.durationMs, apiMs: x.apiMs, numTurns: x.numTurns,
    usage: { input: x.usage.input_tokens, output: x.usage.output_tokens, cacheRead: x.usage.cache_read_input_tokens, cacheWrite: x.usage.cache_creation_input_tokens },
    costUsdSoFar: x.costUsd, tools: x.tools.map(({ name, error, ref, room, tag, input }) => ({ name, error, ref, room, tag, input })), reply: x.reply })),
  recipes: recipesOf(env.MOJULO_DATA_DIR, refs),
};
writeFileSync(path.join(work, 'session.json'), JSON.stringify(session, null, 1) + '\n');

await capture(work);
const gif = await compose(work);
console.log(existsSync(gif) ? gif : 'compose failed');
