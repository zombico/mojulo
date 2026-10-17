// Compose decor-demo.gif from the work dir: session.json (the asks, the session's turns with their tool calls,
// replies, time, tokens and cost), floor-plan.png (the upload) and shots.json with clips/<name>/NNN.png (capture.mjs:
// forge_motion MP4s as frames).
//
//   node docs/images/src/decor-demo/compose.mjs <workDir>      # re-compose without re-filming
//
// The chat is a generic facsimile, not any one app: the asks as typed (the first with the plan attached), each tool
// call as a plain-language chip, and the agent's own reply, cut at a sentence when it runs long. Frames are 960×540 through stage.html, then
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
// the agent's film: this many of its frames, spread over its length
const FILM = 26;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ROOM = { lounge: 'Living room', living: 'Living room', bedroom: 'Bedroom', dining: 'Dining room', kitchen: 'Kitchen', office: 'Office' };
const roomName = (r) => ROOM[r] || (r ? r[0].toUpperCase() + r.slice(1) : 'Room');

/** A tool call in the words a homeowner would use. A call mojulo turned back (a guessed name, a colour it does not
 * know) is the agent trying again. */
function chip(t) {
  if (t.error) return 'Tried again';
  const room = roomName(t.room || t.input?.room).toLowerCase();
  const by = {
    design_interior: () => (t.input?.ref ? `Reworked the ${room}` : `Designed the ${room}`),
    mint_building: () => 'Built the house from your plan', update_sketch: () => 'Changed the house',
    stitch_motion: () => 'Cut the walkthrough together', get_motion_vocab: () => 'Read up on filming',
    get_sketch: () => 'Opened the house plan', list_sketches: () => 'Found your house', semantic_search: () => 'Looked through your things',
    list_stashes: () => 'Looked through your things', get_stash: () => 'Looked through your things',
    get_sketch_vocab: () => 'Read up on decorating', get_creative_toolset: () => 'Read up on decorating', get_substrate: () => 'Got its bearings',
    forward_context: () => 'Got its bearings', export_model: () => 'Made a 3D page', forge_motion: () => 'Filmed a room',
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
  const plain = (s) => s.replace(/(?:\bat\s+)?`?\/outcomes\/[\w-]+\/?(?:[\w.-]+)?`?(?:\s*\(`?[\w.-]+`?\))?/g, 'in your videos').replace(/\s*\(`?\/sketches\/[\w-]+`?\)/g, '').replace(/(?:\bat\s+)?`?\/sketches\/[\w-]+`?/g, 'in your sketches')
    .replace(/,?\s*`?sk_[\w-]+`?,?/g, '').replace(/\*\*|__|`/g, '').replace(/\s+/g, ' ').trim();
  const paras = text.replace(/```[\s\S]*?```/g, '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const lead = plain(paras.find((p) => !/^\s*[-*]\s+/.test(p)) || '');
  const split = (p) => p.split(/(?<=[.!?])\s+(?=[A-Z])/);
  const sentences = split(lead);
  const hasBullets = /^\s*[-*]\s+/m.test(text);
  let out = sentences[0].trim();
  if (sentences[1] && out.length + sentences[1].length < (hasBullets ? 170 : 260)) out += ` ${sentences[1].trim()}`;
  // a bullet's first sentence, or, when that is only its link ("House: in your sketches."), the label and the next one
  const first = (b) => { const [a, n] = split(b), m = a.match(/^(.{1,40}?): in your sketches\.$/); return m && n ? `${m[1]}: ${n}` : a; };
  const bullets = text.split('\n').filter((l) => /^\s*[-*]\s+/.test(l)).map((l) => first(plain(l.replace(/^\s*[-*]\s+/, ''))));
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
  const ff = (args) => { const r = spawnSync(FFMPEG, ['-loglevel', 'error', '-y', ...args], { stdio: 'inherit' }); if (r.status !== 0) throw new Error('ffmpeg failed'); };
  // the upload, framed into the pane on white, as a plan reads
  mkdirSync(path.join(work, 'clips', 'plan'), { recursive: true });
  ff(['-i', path.join(work, 'floor-plan.png'), '-vf', 'scale=520:480:force_original_aspect_ratio=decrease:flags=lanczos,pad=540:500:(ow-iw)/2:(oh-ih)/2:color=white', path.join(work, 'clips', 'plan', '001.png')]);
  const plan = clip('plan')[0], planThumb = pathToFileURL(path.join(work, 'floor-plan.png')).href;

  const F = [];
  const ease = (x) => 0.5 - 0.5 * Math.cos(Math.PI * x);
  const log = [];
  const logHtml = (extra = '') => log.join('') + extra;
  let view = { frames: [plan], tag: 'floor-plan.png <span>· from you</span>' }, vi = 0;
  // a clip plays at HOLD frames a recorded frame; a still holds
  const show = () => ({ a: at(view.frames, Math.floor(vi++ / HOLD)), tag: view.tag });
  const cut = (frames, tag, n) => {   // cross-fade into a clip, then play it for n frames
    const from = at(view.frames, Math.floor(Math.max(vi - 1, 0) / HOLD));
    for (let i = 1; i <= 6; i++) F.push({ log: logHtml(), a: from, b: frames[0], mix: ease(i / 6), tag });
    view = { frames, tag }; vi = 0;
    for (let i = 0; i < n; i++) F.push({ log: logHtml(), ...show() });
  };
  const rooms = new Map();   // tag → { name, last frames }
  let film = null;

  for (let i = 0; i < 10; i++) F.push({ log: '', ...show() });
  facts.turns.forEach((turn, ti) => {
    const ask = turn.prompt, attach = turn.image ? `<span class="att">${esc(turn.image)}</span>` : '';
    for (let i = 1; i <= 14; i++) F.push({ log: logHtml(), input: attach + esc(ask.slice(0, Math.round(ask.length * i / 14))), cursor: true, ...show() });
    log.push(`<div class="u">${turn.image ? `<img class="up" src="${planThumb}">` : ''}${esc(ask)}</div>`);
    // working: the chips land one by one and the clock runs up to the turn's real time; a room the ask changes holds
    // still as it stands
    const out = shots.turns[ti] || [];
    const changed = out.find((x) => x.kind === 'room' && x.before);
    if (changed) { view = { frames: [clip(changed.before)[0]], tag: `${roomName(changed.room)} <span>· so far</span>` }; vi = 0; }
    const cs = chips(turn.tools), WORK = 24;
    for (let i = 1; i <= WORK; i++) {
      const n = Math.ceil(cs.length * i / WORK);
      const body = `<div class="chips">${cs.slice(0, n).map((c, j) => `<span class="chip${j < n - 1 || i === WORK ? ' ok' : ''}">${esc(c)}</span>`).join('')}</div><div class="work">working · ${clock(turn.durationMs * i / WORK)}</div>`;
      F.push({ log: logHtml(`<div class="a"><div class="who">Agent</div>${body}</div>`), ...show() });
    }
    log.push(`<div class="a"><div class="who">Agent · ${clock(turn.durationMs)}</div><div class="chips">${cs.map((c) => `<span class="chip ok">${esc(c)}</span>`).join('')}</div><div class="said">${esc(reply(turn.reply))}</div></div>`);
    // what it made, in the order it made it
    const ideas = out.filter((x) => x.kind === 'room' && !x.before).length;
    for (const x of out) {
      if (x.kind === 'house') cut(clip(x.clip), 'Your house <span>· built from the plan</span>', 18);
      if (x.kind === 'room') {
        const frames = clip(x.after);
        cut(frames, `${roomName(x.room)} <span>· ${x.before ? 'after' : 'an idea'}</span>`, x.before ? 30 : ideas > 2 ? 18 : 24);
        rooms.set(x.tag, { name: roomName(x.room), last: frames.at(-1) });
      }
      if (x.kind === 'film') {
        // the agent's own video (its clips end to end when it could not stitch them), FILM frames picked evenly across
        // the whole of it, HOLD GIF frames each: every room it shows, at a little over its own speed
        const all = x.clips.flatMap((c) => clip(c));
        const frames = Array.from({ length: Math.min(FILM, all.length) }, (_, j) => all[Math.floor((j * all.length) / Math.min(FILM, all.length))]);
        film = frames;
        const tag = 'Walkthrough <span>· the agent made it</span>';
        for (let i = 1; i <= 6; i++) F.push({ log: logHtml(), a: at(view.frames, view.frames.length - 1), b: frames[0], mix: ease(i / 6), tag });
        for (let i = 0; i < frames.length * HOLD; i++) F.push({ log: logHtml(), a: frames[Math.floor(i / HOLD)], tag });
        view = { frames: [F.at(-1).a], tag }; vi = 0;
      }
    }
    if (!out.length) for (let i = 0; i < 24; i++) F.push({ log: logHtml(), ...show() });
    else for (let i = 0; i < 10; i++) F.push({ log: logHtml(), a: F.at(-1).a, tag: F.at(-1).tag });
  });

  // the bill
  const t = totals(facts.turns), made = [...rooms.values()];
  const end = `<h1>One floor plan, ${made.length} rooms${film ? ' and a walkthrough' : ''}</h1>
<div class="sub">The plan in, the house built from it, ideas for living in it, one change, and a video of it.</div>
<div id="grid"><div class="pair"><div class="ims"><img class="pl" src="${planThumb}"></div><div class="cap">your plan</div></div>${made.map((p) => `<div class="pair"><div class="ims"><img src="${p.last}"></div><div class="cap">${esc(p.name)}</div></div>`).join('')}</div>
<div id="stats">
<div class="st"><div class="k">Time</div><div class="v">${clock(t.ms)}</div><div class="n">the agent working, all ${facts.turns.length} asks</div></div>
<div class="st"><div class="k">Tokens</div><div class="v">${k(t.tokens)}</div><div class="n">${k(t.output)} written · ${Math.round(100 * t.cacheRead / t.tokens)}% re-read from cache</div></div>
<div class="st"><div class="k">API cost</div><div class="v">≈ $${t.cost.toFixed(2)}</div><div class="n">${MODEL_NAME[facts.model] || facts.model} at list price, in Claude Code</div></div>
</div>
<div id="foot"><b>MOJULO</b> &nbsp;· one real session, ${t.calls} tool calls, filmed with forge_motion</div>`;
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
  ff(['-framerate', '12', '-i', path.join(frames, '%04d.png'), '-vf', 'palettegen=max_colors=128:stats_mode=full', pal]);
  ff(['-framerate', '12', '-i', path.join(frames, '%04d.png'), '-i', pal, '-lavfi', '[0:v][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle', '-loop', '0', gif]);
  writeFileSync(path.join(work, 'totals.json'), JSON.stringify(t, null, 1));
  console.log(`${F.length} frames, ${(F.length / 12).toFixed(1)} s → ${gif}`);
  return gif;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await compose(path.resolve(process.argv[2] || '.'));
