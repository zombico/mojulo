// decor-demo.gif, end to end: a homeowner uploads their floor plan and asks, in their own words, for ideas for
// living in it, one change and a walkthrough. A real agent session does it and its record is kept (session.json);
// capture.mjs then films what it made with forge_motion, mojulo's Observe door, and compose.mjs sets it in a chat with
// the session's own time, tokens and cost on the last slide.
//
//   node docs/images/src/decor-demo/run.mjs [workDir]
//
// The agent is Claude Code in print mode (`claude -p`, then `--resume` for each later ask) with mojulo as its only
// tool server and no built-in tools, so what it spends is the conversation and the mojulo calls. The plan is a
// picture (plan.mjs: house.json drawn as its A-101 sheet), sent as an image in the first message; the agent reads it
// and builds the house itself. MODEL picks the model (default claude-sonnet-5-5). Each print-mode run reports its own
// `usage` and `duration_ms`; `total_cost_usd` runs on across a --resume, so the session's cost is the last ask's. The
// filming replays the session's calls afterwards, outside it, and is not counted. Needs `claude` signed in, a
// Chromium for forge_motion (MOJULO_CHROMIUM, or mojulo's own download), Chrome for the stills and the compose
// (CHROME_BIN) and ffmpeg (FFMPEG, else `ffmpeg` on PATH).
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CONTROL } from '../lib/browser.mjs';
import { drawPlan } from './plan.mjs';
import { capture, recipesOf } from './capture.mjs';
import { compose } from './compose.mjs';

const work = path.resolve(process.argv[2] || path.join(tmpdir(), 'mj-decor-demo'));
const MODEL = process.env.MODEL || 'claude-sonnet-5-5';
mkdirSync(work, { recursive: true });
const data = path.join(work, 'data');
mkdirSync(path.join(data, 'outcomes'), { recursive: true });

// The asks, in a homeowner's words: no style names, no tool names. The first carries the plan.
const ASKS = [
  { text: 'We just moved in, here\'s our floor plan! Can you put it into mojulo and come up with some ideas for how we could live in it? We like warm, natural and a bit cozy. Show us the living room, the dining room and the big bedroom.', image: 'floor-plan.png' },
  { text: 'We have people over a lot. Can the dining room seat eight?' },
  { text: 'Love it. Can you make us a walkthrough video of the three rooms?' },
];
// Headless print mode cannot answer a question back, so the agent is told to choose; and a chat reply is short.
const SYSTEM = 'Work through each request on your own with the mojulo tools: make sensible choices instead of asking the user, and stop when it is done. Reply in a short paragraph.';

await drawPlan(work);

// ── the session ────────────────────────────────────────────────────────────────────────────────────────────
const agentDir = path.join(work, 'agent');
mkdirSync(agentDir, { recursive: true });
const cfg = path.join(agentDir, 'mcp.json');
writeFileSync(cfg, JSON.stringify({ mcpServers: { mojulo: { command: 'node', args: [path.join(CONTROL, 'scripts/mcp-stdio.mjs')],
  env: { MOJULO_DATA_DIR: data, MOJULO_OUTCOMES_DIR: path.join(data, 'outcomes'), ...(process.env.MOJULO_CHROMIUM ? { MOJULO_CHROMIUM: process.env.MOJULO_CHROMIUM } : {}) } } } }));

// the result fields a later call or the filming needs: the row a call made, the motion it rendered
const OUT = ['ref', 'motion_ref', 'mp4_path', 'gif_path'];

/** One ask: the message (an image first when it carries one) on stdin as stream-json, the run's events back. */
function ask({ text, image }, sessionId) {
  const content = [...(image ? [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: readFileSync(path.join(work, image)).toString('base64') } }] : []), { type: 'text', text }];
  const cli = ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--model', MODEL,
    '--mcp-config', cfg, '--strict-mcp-config', '--setting-sources', 'project', '--tools', '',
    '--allowedTools', 'mcp__mojulo', '--append-system-prompt', SYSTEM, ...(sessionId ? ['--resume', sessionId] : [])];
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const child = spawn('claude', cli, { cwd: agentDir, stdio: ['pipe', 'pipe', 'inherit'] });
    let stdout = '';
    child.stdout.on('data', (d) => { stdout += d; });
    const timer = setTimeout(() => child.kill(), 30 * 60 * 1000);
    child.on('close', () => {
      clearTimeout(timer);
      const events = stdout.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
      const result = events.find((e) => e.type === 'result');
      if (!result) return reject(new Error('claude: no result'));
      const results = new Map();
      for (const e of events) if (e.type === 'user') for (const c of e.message?.content || []) if (c.type === 'tool_result') results.set(c.tool_use_id, c);
      const tools = [], texts = [];
      for (const e of events) if (e.type === 'assistant') for (const c of e.message?.content || []) {
        if (c.type === 'text' && c.text.trim()) texts.push(c.text.trim());
        if (c.type === 'tool_use') {
          const r = results.get(c.id), body = [].concat(r?.content || []).map((x) => x.text || '').join('');
          let parsed = null; try { parsed = JSON.parse(body); } catch { /* not JSON */ }
          const out = Object.fromEntries(OUT.filter((key) => parsed?.[key] != null).map((key) => [key, parsed[key]]));
          tools.push({ name: c.name.replace(/^mcp__mojulo__/, ''), error: !!r?.is_error || parsed?.ok === false, ...out,
            room: parsed?.interior?.room?.name ?? null, tag: parsed?.interior?.room?.tag ?? null, input: c.input });
        }
      }
      resolve({ prompt: text, image: image || null, sessionId: result.session_id, wallMs: Date.now() - started, durationMs: result.duration_ms,
        apiMs: result.duration_api_ms, numTurns: result.num_turns, costUsd: result.total_cost_usd, usage: result.usage, reply: texts.at(-1) || '', tools });
    });
    child.stdin.end(JSON.stringify({ type: 'user', message: { role: 'user', content } }) + '\n');
  });
}

const turns = [];
let sid = null;
for (const [i, a] of ASKS.entries()) {
  const t = await ask(a, sid);
  sid = t.sessionId;
  turns.push(t);
  console.log(`ask ${i + 1}: ${(t.wallMs / 1000).toFixed(0)} s, $${t.costUsd}, ${t.tools.map((x) => x.name + (x.error ? '!' : '')).join(' → ')}`);
}

// The record: what each ask cost and called, what the agent said, and the recipes it left, which the filming replays.
const refs = [...new Set(turns.flatMap((t) => t.tools.filter((x) => !x.error && x.ref).map((x) => x.ref)))];
const session = {
  note: 'The session behind docs/images/decor-demo.gif, as run.mjs recorded it: each ask, the calls the agent made, its reply, and what print mode reported. recipes are the rows it left; capture.mjs replays the calls and checks it gets them back.',
  when: new Date().toISOString().slice(0, 10), model: MODEL,
  turns: turns.map((x) => ({ prompt: x.prompt, image: x.image, durationMs: x.durationMs, apiMs: x.apiMs, numTurns: x.numTurns,
    usage: { input: x.usage.input_tokens, output: x.usage.output_tokens, cacheRead: x.usage.cache_read_input_tokens, cacheWrite: x.usage.cache_creation_input_tokens },
    costUsdSoFar: x.costUsd, tools: x.tools, reply: x.reply })),
  recipes: recipesOf(data, refs),
};
writeFileSync(path.join(work, 'session.json'), JSON.stringify(session, null, 1) + '\n');

await capture(work);
const gif = await compose(work);
console.log(existsSync(gif) ? gif : 'compose failed');
