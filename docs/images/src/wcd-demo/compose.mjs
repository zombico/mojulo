// Compose wcd-demo.gif from a session work dir (session.mjs): session.json (the asks, each turn's calls, reply, time,
// tokens and cost), turn-1-dungeon.png (the book's dungeon page as the agent had it when it asked for approval) and
// the stills of what it built (stills.mjs).
//
//   node docs/images/src/wcd-demo/compose.mjs <workDir>      # re-compose without re-running the session
//
// The GIF is the work and the design: the ask, the agent at work, the plan it shows, the approval, the build. What it
// built is shown below it in the README, larger. The chat is the decor demo's generic facsimile (stage.html). Frames are
// 960×540, then ffmpeg: one 128-colour palette, bayer dither, 12 fps.
import { readFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch, runJson } from '../lib/browser.mjs';
import { totals } from '../decor-demo/compose.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ease = (x) => 0.5 - 0.5 * Math.cos(Math.PI * x);
const clock = (ms) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const k = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n));
const MODEL_NAME = { 'claude-sonnet-5-5': 'Sonnet 5.5', 'claude-opus-5-5': 'Opus 5.5', 'claude-haiku-5-5': 'Haiku 5.5', 'claude-fable-5-1': 'Fable 5.1' };

/** A tool call in a game maker's words; a call mojulo turned back is the agent trying again. */
function chip(t) {
  if (t.error) return 'Tried again';
  const i = t.input ?? {};
  const by = {
    design_game: () => (i.run ? 'Built the levels' : i.approve ? 'Approved the parts' : i.patch ? 'Revised the plan' : i.world || i.compose ? 'Drew up the base' : 'Read the plan back'),
    pick_palette: () => 'Picked colours', get_game_vocab: () => 'Read up on level design', forward_context: () => 'Got its bearings', get_substrate: () => 'Got its bearings',
    get_tool_index: () => 'Got its bearings', semantic_search: () => 'Looked something up', update_sketch: () => 'Changed a level',
    create_game: () => 'Put the game together', export_game: () => 'Made it playable', get_worked_example: () => 'Read an example',
    recommend_kind: () => 'Got its bearings', get_sketch_vocab: () => 'Read up on level design', get_view_vocab: () => 'Read up on level design',
  }[t.name];
  return by ? by() : 'Checked something';
}
/** One chip per kind of step, in the order it first came up, with how many times. */
function chips(tools) {
  const out = new Map();
  for (const t of tools) { const label = chip(t); out.set(label, (out.get(label) || 0) + 1); }
  return [...out].map(([label, n]) => `${label}${n > 1 ? ` ×${n}` : ''}`);
}
/** The reply cut to fit the bubble: its opening sentence, each bullet's label and the start of what it says while they
 * fit, and the sentence it ends on (the question it puts back). Markdown and refs go. */
function reply(text, max = 470) {
  const plain = (s) => s.replace(/\b(?:is )?at `?\/api\/sketches\/[\w-]+\/bible`?/g, 'is ready to read').replace(/`?\/api\/sketches\/[\w-]+\/bible`?/g, 'the book').replace(/`?\/(?:sketches|api\/sketches)\/[\w/-]+`?/g, 'a link').replace(/\s*\(?`?sk_[\w-]+`?\)?/g, '').replace(/\*\*|__|`|^#+\s*/gm, '').replace(/\s+/g, ' ').trim();
  const sentences = (s) => s.split(/(?<=[.!?])\s+(?=[A-Z])/);
  const paras = text.replace(/```[\s\S]*?```/g, '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const prose = paras.filter((p) => !/^([-*]|\d+\.)\s+/.test(p) && !/^\|/.test(p));
  // (the opening two sentences, the second cut short: what was done, and what to know about it)
  const [s1 = '', s2 = ''] = sentences(plain(prose[0] ?? '')), cut2 = s2.length > 110 ? `${s2.slice(0, 108).replace(/[\s,:;]+\S*$/, '')}…` : s2;
  const lead = [s1, cut2].filter(Boolean).join(' '), end = prose.length > 1 ? sentences(plain(prose.at(-1))).at(-1) : '';
  // a table's rows read as items: the first cell, then the start of the next
  const rows = text.split('\n').filter((l) => /^\s*\|/.test(l) && !/^\s*\|[\s|:-]+\|\s*$/.test(l)).map((l) => l.split('|').slice(1, -1).map((c) => c.trim())).slice(1)
    .map(([a, b = '']) => `- ${a}: ${b}`);
  const bullets = [...rows, ...text.split('\n')].filter((l) => /^\s*([-*]|\d+\.)\s+/.test(l)).map((l) => {
    const b = plain(l.replace(/^\s*([-*]|\d+\.)\s+/, '')), m = b.match(/^(.{1,24}?):\s+(.*)$/), body = sentences(m ? m[2] : b)[0];
    const cut = body.length > 56 ? `${body.slice(0, 54).replace(/[\s,]+\S*$/, '')}…` : body;
    return m ? `${m[1]}: ${cut}` : cut;
  }).filter((b) => !/:\s*(a link|the book)\.?$/.test(b));
  let out = lead, n = lead.length + end.length, shown = 0;
  for (const b of bullets) { if (n + b.length > max) break; out += `\n· ${b}`; n += b.length; shown++; }
  if (shown < bullets.length) out += '\n…';
  return end ? `${out}\n${end}` : out;
}

/** The looks the agent showed with pick_palette, as it saw them: its own calls, seeded, replayed into its data dir. */
function looksCard(work, turn) {
  const env = { ...process.env, MOJULO_DATA_DIR: path.join(work, 'data'), MOJULO_OUTCOMES_DIR: path.join(work, 'data', 'outcomes') };
  const picks = turn.tools.filter((t) => t.name === 'pick_palette' && !t.error);
  if (!picks.length) return null;
  const ramp = (stops) => `<div class="ramp">${stops.map((h) => `<i style="background:${h}"></i>`).join('')}</div>`;
  return `<div class="looks">${picks.map((t) => {
    const P = runJson(env, ['scripts/mcp-stdio.mjs', 'call', 'pick_palette', '--json', JSON.stringify(t.input)]).palettes[0].roles;
    const [name, said = ''] = String(t.input.intent).split(/:\s*/);
    return `<div class="look"><b>${esc(name[0].toUpperCase() + name.slice(1))}</b><p>${esc(said)}</p>${['made', 'rock', 'ground', 'accent'].map((r) => `<div class="r"><span>${r === 'made' ? 'walls' : r}</span>${ramp(P[r])}</div>`).join('')}</div>`;
  }).join('')}</div>`;
}

export async function compose(work) {
  const S = JSON.parse(readFileSync(path.join(work, 'session.json'), 'utf8'));
  const img = (n) => (existsSync(path.join(work, `${n}.png`)) ? pathToFileURL(path.join(work, `${n}.png`)).href : null);
  const made = JSON.parse(readFileSync(path.join(work, 'made.json'), 'utf8')), built = Object.keys(made.levels ?? {}), names = made.names ?? {};
  // what the agent showed for approval: its book's plan when it drafted one (draft-*.png: book.mjs --draft, the book
  // redrawn from the stored world without its run's record, in a skin set after the session; else turn-1-dungeon.png as
  // the session drew it) and a level's finishes, else the looks it picked
  const drafted = !!img('draft-dungeon'), plan = img('draft-dungeon') ?? img('turn-1-dungeon'), looks = plan ? null : looksCard(work, S.turns[0]);
  if (!plan && !looks) throw new Error('compose: the first ask showed neither a plan nor looks');
  const finLevel = built.find((l) => img(`draft-${l}-finishes`)), fin = finLevel ? img(`draft-${finLevel}-finishes`) : null;
  const after = drafted ? ', its skin set after the session' : '';
  // the book once built, when no plan was shown before it: in a skin set after the session, else as it was
  const book = plan ? null : img('skinned-dungeon') ? [img('skinned-dungeon'), 'The book <span>· its skin set after the session</span>'] : img('turn-2-dungeon') ? [img('turn-2-dungeon'), 'The book <span>· to the core</span>'] : null;
  const shots = built.flatMap((l) => ['room', 'corridor'].map((s) => [img(`${l}-${s}`), `${names[l] ?? l} <span>· ${s === 'room' ? 'built' : 'its corridor'}</span>`])).filter(([u]) => u);

  const F = [], log = [];
  const logHtml = (extra = '') => log.join('') + extra;
  let view = null;
  const hold = (n, extra = {}) => { for (let i = 0; i < n; i++) F.push({ log: logHtml(), ...view, ...extra }); };
  const fadeTo = (next, n = 6) => { for (let i = 1; i <= n; i++) F.push({ log: logHtml(), a: view?.a, posA: view?.posA, fitA: view?.fitA, b: next.a, posB: next.posA, fitB: next.fitA, mix: ease(i / n), tag: next.tag }); view = next; };

  for (let i = 0; i < 6; i++) F.push({ log: '' });
  S.turns.forEach((turn, ti) => {
    const ask = turn.prompt, typing = ti === 0 ? 34 : 10;
    for (let i = 1; i <= typing; i++) F.push({ log: logHtml(), input: esc(ask.slice(0, Math.round(ask.length * i / typing))), cursor: true, ...view });
    log.push(`<div class="u">${esc(ask)}</div>`);
    const cs = chips(turn.tools), WORK = 30;
    for (let i = 1; i <= WORK; i++) {
      const n = Math.ceil(cs.length * i / WORK);
      F.push({ log: logHtml(`<div class="a"><div class="who">Agent</div><div class="chips">${cs.slice(0, n).map((c, j) => `<span class="chip${j < n - 1 || i === WORK ? ' ok' : ''}">${esc(c)}</span>`).join('')}</div><div class="work">working · ${clock(turn.durationMs * i / WORK)}</div></div>`), ...view });
    }
    log.push(`<div class="a"><div class="who">Agent · ${clock(turn.durationMs)}</div><div class="chips">${cs.map((c) => `<span class="chip ok">${esc(c)}</span>`).join('')}</div><div class="said">${esc(reply(turn.reply))}</div></div>`);
    // the book's dungeon page, the rings first, then across to the layers, their looks and the laws
    const pan = (u, tag) => {
      fadeTo({ a: u, posA: '0% 50%', tag }, 8); hold(24);
      for (let i = 1; i <= 30; i++) F.push({ log: logHtml(), a: u, posA: `${(100 * ease(i / 30)).toFixed(1)}% 50%`, tag });
      view = { ...view, posA: '100% 50%' }; hold(30);
    };
    if (ti === 0 && plan) {
      pan(plan, `The plan <span>· its book, for your approval${after}</span>`);
      // and what a level will wear: its finishes, along the board
      if (fin) {
        const tag = `${esc(names[finLevel] ?? finLevel)} <span>· its finishes${after}</span>`;
        // (the whole board, fitted)
        fadeTo({ a: fin, fitA: 'contain', tag }, 8); hold(48);
      }
    }
    else if (ti === 0) {
      // the looks it picked, for approval
      const tag = 'The looks <span>· for your approval</span>';
      for (let i = 1; i <= 8; i++) F.push({ log: logHtml(), panel: looks, panelOp: ease(i / 8), tag });
      for (let i = 0; i < 60; i++) F.push({ log: logHtml(), panel: looks, tag });
      view = null;
    } else {
      if (book) pan(...book);
      // what it built, each level as it stands, one after another
      for (const [u, tag] of shots) { fadeTo({ a: u, tag }); hold(10); }
    }
  });

  const t = totals(S.turns);
  const end = `<h1>A ${built.length}-level base, planned, approved, built</h1>
<div class="sub">One ask in a game maker's words, one look at the ${plan ? 'plan and its finishes' : 'colours'}, one yes.</div>
<div id="stats">
<div class="st"><div class="k">Time</div><div class="v">${clock(t.ms)}</div><div class="n">the agent working, both asks</div></div>
<div class="st"><div class="k">Tokens</div><div class="v">≈ ${k(t.tokens)}</div><div class="n">${k(t.output)} written · ${Math.round(100 * t.cacheRead / t.tokens)}% re-read from cache</div></div>
<div class="st"><div class="k">API cost</div><div class="v">≈ $${t.cost.toFixed(2)}</div><div class="n">${MODEL_NAME[S.model] || S.model} at list price, in Claude Code</div></div>
</div>
<div id="foot"><b>MOJULO</b> &nbsp;· one real session, ${t.calls} tool calls</div>`;
  const last = F.at(-1);
  for (let i = 1; i <= 8; i++) F.push({ ...last, end, endKey: 'end', endOp: ease(i / 8) });
  for (let i = 0; i < 48; i++) F.push({ ...last, end, endKey: 'end' });

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
  const ff = (args) => { const r = spawnSync(FFMPEG, ['-loglevel', 'error', '-y', ...args], { stdio: 'inherit' }); if (r.status !== 0) throw new Error('ffmpeg failed'); };
  const pal = path.join(work, 'palette.png'), gif = path.join(work, 'wcd-demo.gif');
  ff(['-framerate', '12', '-i', path.join(frames, '%04d.png'), '-vf', 'palettegen=max_colors=128:stats_mode=full', pal]);
  ff(['-framerate', '12', '-i', path.join(frames, '%04d.png'), '-i', pal, '-lavfi', '[0:v][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle', '-loop', '0', gif]);
  writeFileSync(path.join(work, 'totals.json'), JSON.stringify(t, null, 1));
  console.log(`${F.length} frames, ${(F.length / 12).toFixed(1)} s → ${gif}`);
  return gif;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await compose(path.resolve(process.argv[2] || '.'));
