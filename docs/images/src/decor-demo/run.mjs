// decor-demo.gif, end to end: mint the Maple Street house as it is handed over, let a real agent session
// redecorate it from three plain-language asks, record each room before and after with forge_motion (mojulo's
// Observe door), then compose the GIF with the session's own time, tokens and cost on the last slide.
//
//   node docs/images/src/decor-demo/run.mjs [workDir]
//
// The agent is Claude Code in print mode (`claude -p`, then `--resume` for each later ask) with mojulo as its
// only tool server and no built-in tools, so what it spends is the conversation and the mojulo calls. MODEL picks
// the model (default claude-sonnet-5-5). The captures run between asks, outside the session, and are not counted.
// Each print-mode run reports its own `usage` and `duration_ms`; `total_cost_usd` and `modelUsage` run on across a
// --resume, so the session's cost is the last ask's.
// Without MOJULO_DATA_DIR it mints into a fresh data dir under the work dir. Needs `claude` signed in, a Chromium
// for forge_motion (MOJULO_CHROMIUM, or mojulo's own download) and ffmpeg (FFMPEG, else `ffmpeg` on PATH).
import { execFile } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTROL, runJson } from '../lib/browser.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const work = path.resolve(process.argv[2] || path.join(tmpdir(), 'mj-decor-demo'));
const MODEL = process.env.MODEL || 'claude-sonnet-5-5';
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
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

// ── capture: forge_motion over a world ref, MP4 frames out as PNGs ─────────────────────────────────────────
const W = 1080, H = 1000, FRAMES = 36, EYE = 6.4;   // the walk-in's eye height, in the World page's feet
async function forge(worldRef, name, shot) {
  const res = call('forge_motion', { title: `decor demo · ${name}`, subject: { world_ref: worldRef }, shot: { ...shot, fps: 12 }, export: 'mp4' });
  const mp4 = path.join(env.MOJULO_OUTCOMES_DIR, res.mp4_path.replace(/^\/outcomes\//, ''));
  const dir = path.join(work, 'clips', name);
  mkdirSync(dir, { recursive: true });
  const r = await runFf(['-i', mp4, '-vf', 'scale=540:500:flags=lanczos', path.join(dir, '%03d.png')]);
  if (!r) throw new Error(`ffmpeg failed on ${mp4}`);
  return { name, motion: res.motion_ref, frames: res.frames };
}
const runFf = (args) => new Promise((resolve) => execFile(FFMPEG, ['-loglevel', 'error', '-y', ...args], (e) => resolve(!e)));

/** A room's own cameras, read from its exported World page: its two corners on one wall, looking across at the far
 * wall. The walk-in slides from one to the other at a standing eye height. */
function roomShots(ref) {
  call('export_model', { ref, format: 'html' });
  const src = readFileSync(path.join(env.MOJULO_OUTCOMES_DIR, ref, 'world.html'), 'utf8');
  const shot = (name) => {
    const m = src.match(new RegExp(`"name":"${name}","pos":(\\[[^\\]]*\\]),"target":(\\[[^\\]]*\\]),"vfov":([\\d.]+)`));
    return m && { pos: JSON.parse(m[1]), target: JSON.parse(m[2]), fov: +m[3] };
  };
  const a = shot('corner-2'), b = shot('corner');
  if (!a || !b) throw new Error(`${ref}: no corner shots`);
  const eye = (p) => [p[0], p[1], EYE];
  return [{ pos: eye(a.pos), lookAt: [b.target[0], b.target[1], 2.6], fov: 62 }, { pos: eye(b.pos), lookAt: [b.target[0], b.target[1], 2.6], fov: 62 }];
}
const fly = (keyframes) => ({ motion: 'flythrough', params: { width: W, height: H, keyframes }, frames: FRAMES });

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

const turns = [], clips = {};
// The house before anything: a slow quarter orbit from its aerial view.
clips.house = await forge(HOUSE.ref, 'house', { motion: 'orbit', params: { from: -12, to: 12, width: W, height: H }, frames: FRAMES });
let sid = null;
const roomRefs = {};
for (const [i, prompt] of ASKS.entries()) {
  const t = await ask(prompt, sid);
  sid = t.sessionId;
  turns.push(t);
  console.log(`ask ${i + 1}: ${(t.wallMs / 1000).toFixed(0)} s, $${t.costUsd}, ${t.tools.map((x) => x.name + (x.error ? '!' : '')).join(' → ')}`);
  // What this ask designed: every interior it minted or revised, by room tag (two bedrooms share a name).
  for (const x of t.tools) if (x.name === 'design_interior' && !x.error && x.ref) {
    const first = !roomRefs[x.tag];
    roomRefs[x.tag] = x.ref;
    const keys = roomShots(x.ref);
    if (first) clips[`${x.tag}-before`] = await forge(HOUSE.ref, `${x.tag}-before`, fly(keys));
    clips[`${x.tag}-${i + 1}`] = await forge(x.ref, `${x.tag}-${i + 1}`, fly(keys));
  }
  writeFileSync(path.join(work, 'facts.json'), JSON.stringify({ model: MODEL, house: HOUSE.ref, asks: ASKS, turns, clips, roomRefs }, null, 1));
}

const { compose } = await import('./compose.mjs');
const gif = await compose(work);
console.log(existsSync(gif) ? gif : 'compose failed');
