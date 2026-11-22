#!/usr/bin/env node
/**
 * The sound library's audition board: every card's takes side by side on one self-contained page (the takes inlined),
 * with what each was asked for, what it cost and how it measures, so the operator picks a take per card by ear.
 *
 *   node scripts/sound-library/board.mjs --cards spike --out <dir> [--page <file>]
 *
 * Reads <out>/takes and <out>/ledger.jsonl (written by generate.mjs); writes <out>/board.html unless --page says
 * otherwise. Measures (length, peak, mean, integrated loudness) come from ffmpeg when one is found ($MOJULO_FFMPEG, else
 * PATH); without it the board plays the takes and leaves the measures blank. The ears gate is the operator's: the board
 * advises, it picks nothing.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function args(argv) {
  const a = { cards: 'spike', out: null, page: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--cards') a.cards = argv[++i];
    else if (k === '--out') a.out = argv[++i];
    else if (k === '--page') a.page = argv[++i];
    else throw new Error(`board: unknown argument ${k}`);
  }
  if (!a.out) throw new Error('board: --out <dir> is required');
  if (!/^[a-z0-9-]+$/.test(a.cards)) throw new Error(`board: bad card set '${a.cards}'`);
  return a;
}

function ffmpegBin() {
  const env = process.env.MOJULO_FFMPEG;
  if (env && existsSync(env)) return env;
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return 'ffmpeg'; } catch { return null; }
}

/** { seconds, peakDb, meanDb, lufs } of an audio file, or null without ffmpeg */
function measure(ff, file) {
  if (!ff) return null;
  const err = String(spawnSync(ff, ['-hide_banner', '-nostats', '-i', file, '-af', 'volumedetect,ebur128', '-f', 'null', '-'], { encoding: 'utf8' }).stderr || '');
  const num = (re) => { const m = err.match(re); return m ? Number(m[1]) : null; };
  const dur = err.match(/Duration: (\d+):(\d+):([\d.]+)/);
  const lufsAll = [...err.matchAll(/\bI:\s+(-?[\d.]+) LUFS/g)];
  return {
    seconds: dur ? +(Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3])).toFixed(3) : null,
    peakDb: num(/max_volume: (-?[\d.]+) dB/),
    meanDb: num(/mean_volume: (-?[\d.]+) dB/),
    lufs: lufsAll.length ? Number(lufsAll[lufsAll.length - 1][1]) : null,
  };
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (v, unit = '') => (v == null ? '–' : `${v}${unit}`);

async function main() {
  const a = args(process.argv.slice(2));
  const { CARDS } = await import(path.join(HERE, 'cards', `${a.cards}.js`));
  const ledgerFile = path.join(a.out, 'ledger.jsonl');
  const ledger = existsSync(ledgerFile) ? readFileSync(ledgerFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  const costOf = (card, n) => ledger.find((e) => e.card === card && e.take === n)?.cost ?? null;
  const ff = ffmpegBin();
  let spent = 0, takes = 0;
  const rows = [];
  for (const c of CARDS) {
    const dir = path.join(a.out, 'takes', c.id);
    const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.mp3')).sort((x, y) => parseInt(x) - parseInt(y)) : [];
    if (!files.length) continue;
    const cells = files.map((f) => {
      const n = parseInt(f), file = path.join(dir, f), m = measure(ff, file), cost = costOf(c.id, n);
      spent += cost || 0; takes++;
      const b64 = readFileSync(file).toString('base64');
      return `<div class="take"><div class="tn">take ${n}</div><audio controls preload="none"${c.loop ? ' loop' : ''} src="data:audio/mpeg;base64,${b64}"></audio>`
        + `<div class="m">${fmt(m?.seconds, ' s')} · peak ${fmt(m?.peakDb, ' dB')} · ${fmt(m?.lufs, ' LUFS')} · ${fmt(cost)} cr</div></div>`;
    }).join('');
    const target = c.shelf ? `shelf <code>${esc(c.shelf)}</code>` : c.band ? `band <code>${esc(c.band)}</code>` : 'new bed';
    rows.push(`<section><h2>${esc(c.id)} <span class="role">${esc(c.role)}${c.loop ? ' · loop' : ''}</span></h2>`
      + `<p class="ask">“${esc(c.prompt)}” <span>${c.seconds} s · influence ${c.influence} · ${target}</span></p><div class="takes">${cells}</div></section>`);
  }
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sound Library Board</title><style>
:root{--bg:#f7f6f3;--fg:#1d1d1b;--mute:#6b6a66;--card:#fff;--line:#e3e1dc;--accent:#2f5d8a}
@media (prefers-color-scheme:dark){:root{--bg:#161615;--fg:#ecebe7;--mute:#9a9893;--card:#20201e;--line:#33322f;--accent:#8db6e0}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.45 system-ui,sans-serif;padding:24px 16px}
main{max-width:1100px;margin:0 auto}h1{font-size:22px;margin:0 0 4px}.sub{color:var(--mute);margin:0 0 24px}
section{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin:0 0 14px}
h2{font-size:16px;margin:0 0 4px}.role{font-weight:400;color:var(--mute);font-size:13px;margin-left:6px}
.ask{margin:0 0 10px;color:var(--fg)}.ask span{display:block;color:var(--mute);font-size:13px}code{color:var(--accent)}
.takes{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}.take{border-top:1px solid var(--line);padding-top:8px}
.tn{font-size:12px;color:var(--mute);margin-bottom:4px}audio{width:100%;height:36px}.m{font-size:12px;color:var(--mute);margin-top:4px;font-variant-numeric:tabular-nums}
</style></head><body><main><h1>Sound library board · ${esc(a.cards)}</h1>
<p class="sub">${takes} takes over ${rows.length} cards · ${spent} credits · ${ff ? 'measured with ffmpeg' : 'no ffmpeg: unmeasured'}. Pick one take per card by ear (say “card: take”).</p>
${rows.join('\n')}</main></body></html>`;
  const page = a.page || path.join(a.out, 'board.html');
  writeFileSync(page, html);
  console.log(`board: ${takes} takes, ${rows.length} cards, ${spent} credits → ${page} (${(html.length / 1048576).toFixed(1)} MB)`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
