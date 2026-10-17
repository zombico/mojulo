// Compose decor-demo.gif from the work dir: session.json (the asks, the session's turns with their tool calls,
// replies, time, tokens and cost), shots.json and clips/<name>/NNN.png (capture.mjs: forge_motion MP4s as frames).
//
//   node docs/images/src/decor-demo/compose.mjs <workDir>      # re-compose without re-filming
//
// The chat is a generic facsimile, not any one app: the asks as typed, each tool call as a plain-language chip,
// and the agent's own reply, cut at a sentence when it runs long. Frames are 960×540 through stage.html, then
// ffmpeg: one 128-colour palette, bayer dither, 12 fps.
import { readFileSync, readdirSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch } from '../lib/browser.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
// A clip plays at a third of its rate: each recorded frame shows three times, which the GIF's frame diff makes
// almost free. A 3D frame is what the GIF's bytes go on.
const HOLD = 3;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ROOM = { lounge: 'Living room', living: 'Living room', bedroom: 'Bedroom', dining: 'Dining room', kitchen: 'Kitchen', office: 'Office' };
const roomName = (r) => ROOM[r] || (r ? r[0].toUpperCase() + r.slice(1) : 'Room');

/** A tool call in the words a homeowner would use. A call mojulo turned back (a guessed name, a colour it does not
 * know) is the agent trying again. */
function chip(t) {
  if (t.error) return 'Tried again';
  const room = roomName(t.room || t.input?.room).toLowerCase();
  const by = {
    design_interior: () => (t.input?.ref ? `Reworked the ${room}` : `Decorated the ${room}`),
    update_sketch: () => 'Changed the house',
    get_sketch: () => 'Opened the house plan', list_sketches: () => 'Found your house', semantic_search: () => 'Looked through your things',
    list_stashes: () => 'Looked through your things', get_stash: () => 'Looked through your things',
    get_sketch_vocab: () => 'Read up on decorating', get_creative_toolset: () => 'Read up on decorating', get_substrate: () => 'Got its bearings',
    forward_context: () => 'Got its bearings', export_model: () => 'Made a 3D page', forge_motion: () => 'Recorded a walk-through',
    measure_solid: () => 'Measured it', diff_sketches: () => 'Compared before and after', pick_palette: () => 'Picked colours',
  }[t.name];
  return by ? by() : 'Checked something';
}
/** One chip per kind of step, in the order it first came up, with how many times. */
function chips(tools) {
  const out = new Map();
  for (const t of tools) { const label = chip(t); out.set(label, (out.get(label) || 0) + 1); }
  return [...out].map(([label, n]) => `${label}${n > 1 ? ` ×${n}` : ''}`);
}
/** The agent's reply cut to fit the bubble: the opening of its first paragraph, then the first sentence of each of
 * its bullet points while they fit (they carry what was done). Markdown goes, and a sketch link reads as "in your sketches". */
function reply(text, max = 330) {
  const plain = (s) => s.replace(/\s*\(`?\/sketches\/[\w-]+`?\)/g, '').replace(/(?:\bat\s+)?`?\/sketches\/[\w-]+`?/g, 'in your sketches')
    .replace(/,?\s*`?sk_[\w-]+`?,?/g, '').replace(/\*\*|__|`/g, '').replace(/\s+/g, ' ').trim();
  const paras = text.replace(/```[\s\S]*?```/g, '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const lead = plain(paras.find((p) => !/^\s*[-*]\s+/.test(p)) || '');
  const split = (p) => p.split(/(?<=[.!?])\s+(?=[A-Z])/);
  const sentences = split(lead);
  let out = sentences[0].trim();
  if (sentences[1] && out.length + sentences[1].length < 170) out += ` ${sentences[1].trim()}`;
  const bullets = text.split('\n').filter((l) => /^\s*[-*]\s+/.test(l)).map((l) => split(plain(l.replace(/^\s*[-*]\s+/, '')))[0]);
  let n = out.length, shown = 0;
  for (const b of bullets) { if (n + b.length > max) break; out += `\n· ${b}`; n += b.length; shown++; }
  return out + (shown < bullets.length || sentences.length > 2 ? '\n…' : '');
}
const clock = (ms) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const k = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n));

/** The session's spend. Each print-mode run reports its own `usage` and `duration_ms`; its `total_cost_usd` runs on
 * across a --resume, so the session's cost is the last run's. */
export function totals(turns) {
  const t = { ms: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, calls: 0, cost: turns.at(-1).costUsdSoFar };
  for (const x of turns) {
    t.ms += x.durationMs; t.calls += x.tools.length;
    for (const key of ['input', 'output', 'cacheRead', 'cacheWrite']) t[key] += x.usage[key];
  }
  t.tokens = t.input + t.output + t.cacheRead + t.cacheWrite;
  return t;
}
const MODEL_NAME = { 'claude-sonnet-5-5': 'Sonnet 5.5', 'claude-opus-5-5': 'Opus 5.5', 'claude-haiku-5-5': 'Haiku 5.5', 'claude-fable-5-1': 'Fable 5.1' };

export async function compose(work) {
  const facts = JSON.parse(readFileSync(path.join(work, 'session.json'), 'utf8'));
  const shots = JSON.parse(readFileSync(path.join(work, 'shots.json'), 'utf8'));
  const clip = (name) => { const dir = path.join(work, 'clips', name); return readdirSync(dir).filter((f) => f.endsWith('.png')).sort().map((f) => pathToFileURL(path.join(dir, f)).href); };
  const at = (frames, i) => frames[Math.min(i, frames.length - 1)];

  const F = [];
  const ease = (x) => 0.5 - 0.5 * Math.cos(Math.PI * x);
  const log = [];
  const logHtml = (extra = '') => log.join('') + extra;

  // the house as handed over
  const house = clip(shots.house);
  for (let i = 0; i < 24; i++) F.push({ log: '', a: at(house, Math.floor(i / HOLD)), tag: 'Maple Street house <span>· as handed over</span>' });
  let view = { frames: house, tag: 'Maple Street house <span>· as handed over</span>' };

  const rooms = new Map();   // tag → { name, before: the house's frame, after: the latest frames }
  facts.turns.forEach((turn, ti) => {
    // the room this ask settled on, filmed before and after from one place (capture.mjs)
    const shot = shots.turns[ti];
    const tag = shot?.tag, name = roomName(shot?.room);
    const seen = tag && rooms.get(tag);
    const before = shot && clip(shot.before), after = shot && clip(shot.after);
    const tagB = `${name} <span>· ${seen ? 'so far' : 'before'}</span>`, tagA = `${name} <span>· after</span>`;
    const ask = turn.prompt;
    let vi = 0;
    const show = (fr) => ({ a: at(fr.frames, Math.floor(vi++ / HOLD)), tag: fr.tag });
    // typed
    for (let i = 1; i <= 18; i++) F.push({ log: logHtml(), input: esc(ask.slice(0, Math.round(ask.length * i / 18))), cursor: true, ...show(view) });
    log.push(`<div class="u">${esc(ask)}</div>`);
    // working: the chips land one by one and the clock runs up to the turn's real time
    const cs = chips(turn.tools);
    // the room as it was holds still on the walk-through's first frame, the after's own camera; only the after
    // moves, which keeps the GIF small
    if (before) { view = { frames: [before[0]], tag: tagB }; vi = 0; }
    const WORK = 30;
    for (let i = 1; i <= WORK; i++) {
      const n = Math.ceil(cs.length * i / WORK);
      const body = `<div class="chips">${cs.slice(0, n).map((c, j) => `<span class="chip${j < n - 1 || i === WORK ? ' ok' : ''}">${esc(c)}</span>`).join('')}</div><div class="work">working · ${clock(turn.durationMs * i / WORK)}</div>`;
      F.push({ log: logHtml(`<div class="a"><div class="who">Agent</div>${body}</div>`), ...show(view) });
    }
    const said = `<div class="a"><div class="who">Agent · ${clock(turn.durationMs)}</div><div class="chips">${cs.map((c) => `<span class="chip ok">${esc(c)}</span>`).join('')}</div><div class="said">${esc(reply(turn.reply))}</div></div>`;
    log.push(said);
    // the reply, and the room after
    if (after) {
      const from = view; vi = 0;
      for (let i = 1; i <= 6; i++) F.push({ log: logHtml(), a: at(from.frames, from.frames.length - 1), b: at(after, 0), mix: ease(i / 6), tag: tagA });
      view = { frames: after, tag: tagA };
      rooms.set(tag, { name, before: seen ? seen.before : at(before, before.length - 1), after });   // the grid: first before, last after
    }
    for (let i = 0; i < 40; i++) F.push({ log: logHtml(), ...show(view) });
  });

  // the bill
  const t = totals(facts.turns), pairs = [...rooms.values()];
  const end = `<h1>${facts.turns.length} asks, ${pairs.length} rooms redecorated</h1>
<div class="sub">The same house plan throughout: only the furniture, fabrics, colours and walls changed.</div>
<div id="grid">${pairs.map((p) => `<div class="pair"><div class="ims"><img src="${p.before}"><img src="${at(p.after, p.after.length - 1)}"></div><div class="cap">${esc(p.name)}: before · after</div></div>`).join('')}</div>
<div id="stats">
<div class="st"><div class="k">Time</div><div class="v">${clock(t.ms)}</div><div class="n">the agent working, all ${facts.turns.length} asks</div></div>
<div class="st"><div class="k">Tokens</div><div class="v">${k(t.tokens)}</div><div class="n">${k(t.output)} written · ${Math.round(100 * t.cacheRead / t.tokens)}% re-read from cache</div></div>
<div class="st"><div class="k">API cost</div><div class="v">≈ $${t.cost.toFixed(2)}</div><div class="n">${MODEL_NAME[facts.model] || facts.model} at list price, in Claude Code</div></div>
</div>
<div id="foot"><b>MOJULO</b> &nbsp;· one real session, ${t.calls} tool calls, recorded with forge_motion</div>`;
  const last = F.at(-1);
  for (let i = 1; i <= 8; i++) F.push({ ...last, end, endKey: 'end', endOp: ease(i / 8) });
  for (let i = 0; i < 54; i++) F.push({ ...last, end, endKey: 'end' });

  const frames = path.join(work, 'frames');
  rmSync(frames, { recursive: true, force: true }); mkdirSync(frames);
  const browser = await launch(false);
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 960, height: 540, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(path.join(here, 'stage.html')).href);
    for (let i = 0; i < F.length; i++) {
      await page.evaluate((f) => window.setFrame(f), F[i]);
      writeFileSync(path.join(frames, `${String(i).padStart(4, '0')}.png`), await page.screenshot({ type: 'png' }));
    }
  } finally { await browser.close(); }

  const pal = path.join(work, 'palette.png'), gif = path.join(work, 'decor-demo.gif');
  const ff = (args) => { const r = spawnSync(FFMPEG, ['-loglevel', 'error', '-y', ...args], { stdio: 'inherit' }); if (r.status !== 0) throw new Error('ffmpeg failed'); };
  ff(['-framerate', '12', '-i', path.join(frames, '%04d.png'), '-vf', 'palettegen=max_colors=128:stats_mode=full', pal]);
  ff(['-framerate', '12', '-i', path.join(frames, '%04d.png'), '-i', pal, '-lavfi', '[0:v][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle', '-loop', '0', gif]);
  writeFileSync(path.join(work, 'totals.json'), JSON.stringify(t, null, 1));
  console.log(`${F.length} frames, ${(F.length / 12).toFixed(1)} s → ${gif}`);
  return gif;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await compose(path.resolve(process.argv[2] || '.'));
