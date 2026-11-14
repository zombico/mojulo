/**
 * THE SCORE BOOK — a game's cue sheet (cue-sheet.js), read and heard: the audio direction said once, then every request
 * for music, who asked, the mood that answers it and why, each with a button that plays the cue on the kernel the game
 * ships (beats-kernel.js). The sound book's sibling (`/api/sketches/<ref>/bible?book=score`), the music department's
 * page for the ears gate.
 *
 *   scoreBook(world, { ref? })      → { name, on, direction, rows: [{ id, by, for, mood, style, source, why, plays }],
 *                                     owed, unasked, cues: { <request id>: <a beats recipe> } }
 *   scoreBookHtml(world, { ref? })  → the page (self-contained: one kernel, the patches its cues use)
 *
 * `ref` is the gameworld's own: a level's cue is seeded by its level's ref, so with it the page plays the tune the made
 * level plays. A world with no `music` is shown the sheet it would have, said as a suggestion. No database, no clock.
 */
import { cueSheet, onScore } from './cue-sheet.js';
import { readGameworld } from './world.js';
import { childRef } from './runner.js';
import { seedOfRef, fieldCue, parseFieldSpec } from '../beats/field-cue.js';
import { expandBeatsManifest } from '../beats/beats-authoring.js';
import { emitBeatsKernel } from '../beats/beats-kernel.js';
import { audioFeatures, pagePatches } from '../beats/beats-features.js';
import { safeJson } from '../scene/emit-util.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const BY = Object.freeze({ flow: 'the flow', levels: 'the levels', foes: 'the foes', story: 'the story', build: 'the build' });

/** The book's data (see the header). */
export function scoreBook(world, { ref = 'game' } = {}) {
  const G = readGameworld(world), game = seedOfRef(childRef(ref, 'game'));
  const S = cueSheet(world, { game }), cues = {};
  const rows = S.requests.map((r) => {
    let plays = false;
    if (r.cue) {
      // (a level's and a fight's cue is seeded by its level's first stage, as the made level's is)
      const level = /^(level|fight|boss):(.+)$/.exec(r.id)?.[2], at = level ? childRef(ref, `level-${level}-0`) : childRef(ref, `cue-${r.id.replace(/[^a-z0-9]+/g, '-')}`);
      try { cues[r.id] = expandBeatsManifest(fieldCue(parseFieldSpec(r.cue), { fallbackSeed: seedOfRef(at) })); plays = true; } catch { plays = false; }
    }
    return { id: r.id, by: r.by, for: r.for, loop: r.loop, mood: r.mood, style: r.style, source: r.source, why: r.why, plays };
  });
  return { name: G.name ?? G.id ?? 'This game', on: onScore(G), direction: S.direction, rows, owed: S.owed, unasked: S.unasked, cues };
}

const CSS = `:root{--paper:#f6f4ee;--sheet:#fff;--ink:#1c1b19;--muted:#6b675f;--rule:#d9d4c7;--accent:#7a3b8f}
@media (prefers-color-scheme:dark){:root{--paper:#141412;--sheet:#1d1c1a;--ink:#ebe8e0;--muted:#9a958a;--rule:#34322d;--accent:#c79be0}}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.5 system-ui,sans-serif}
main{max-width:980px;margin:0 auto;padding:28px 16px 64px}h1{font-size:26px;margin:0 0 4px}h2{font-size:16px;margin:28px 0 8px;color:var(--accent);letter-spacing:.04em;text-transform:uppercase}
p.lede{color:var(--muted);margin:0 0 8px;max-width:70ch}.note{background:var(--sheet);border:1px solid var(--rule);border-left:3px solid var(--accent);padding:10px 12px;border-radius:6px;margin:12px 0}
.wrap{overflow-x:auto;background:var(--sheet);border:1px solid var(--rule);border-radius:8px}table{border-collapse:collapse;width:100%;min-width:560px}
td,th{text-align:left;padding:7px 10px;border-bottom:1px solid var(--rule);vertical-align:top}th{font-size:12px;color:var(--muted);font-weight:600}tr:last-child td{border-bottom:0}
td.why{color:var(--muted);font-size:13px}code{font:13px ui-monospace,monospace}.tag{font-size:11px;border:1px solid var(--rule);border-radius:999px;padding:0 7px;color:var(--muted);white-space:nowrap}
dl{display:grid;grid-template-columns:max-content 1fr;gap:4px 14px;margin:0;padding:12px;background:var(--sheet);border:1px solid var(--rule);border-radius:8px}dt{color:var(--muted)}dd{margin:0}
button.play{font:inherit;border:1px solid var(--rule);background:var(--paper);color:var(--ink);border-radius:999px;padding:2px 12px;cursor:pointer;min-width:64px}
button.play:hover{border-color:var(--accent)}button.play.on{background:var(--accent);color:var(--paper);border-color:var(--accent)}ul{margin:6px 0;padding-left:20px}`;

/** The page (see the header). */
export function scoreBookHtml(world, opts = {}) {
  const B = scoreBook(world, opts), D = B.direction, V = D.voice;
  const manifests = Object.values(B.cues);
  const features = [...new Set(manifests.flatMap((m) => audioFeatures({ soundtrack: m })))];
  const players = V ? Object.entries(V.players).map(([job, who]) => `${job}: ${Array.isArray(who) ? who.join(' and ') : who}`).join(' · ') : '';
  const row = (r) => `<tr><td>${esc(r.for)}<br><code>${esc(r.id)}</code></td><td>${esc(BY[r.by] ?? r.by)}</td><td>${r.mood ? `<code>${esc(r.mood)}</code> ${r.style === 'club' ? 'electronic' : 'orchestra'}${r.loop ? '' : ' · once'}` : '<em>silence</em>'} <span class="tag">${esc(r.source)}</span></td><td class="why">${esc(r.why)}</td><td>${r.plays ? `<button class="play" data-id="${esc(r.id)}">play</button>` : ''}</td></tr>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(B.name)}: score</title><style>${CSS}</style></head><body><main>
<h1>${esc(B.name)}: the score</h1>
<p class="lede">Every place this game asks for music, who asked, and the cue that answers it, all on one identity. Press a row to hear its cue; press it again to stop.</p>
${B.on ? '' : '<div class="note">This game has no <code>music</code> yet: its levels are built unscored. Writing one (even <code>music: {}</code>) scores every level it builds from this sheet.</div>'}
<h2>The audio direction</h2>
<dl><dt>style</dt><dd>${D.style === 'club' ? 'electronic' : 'the orchestra'} <span class="tag">${esc(D.why.style)}</span></dd>
${V ? `<dt>identity</dt><dd>in ${esc(V.key)}, ${esc(V.flavour)}${V.hall ? `, a hall of ${esc(V.hall)} s` : ''} <span class="tag">${esc(D.why.identity)}</span></dd><dt>players</dt><dd>${esc(players)}</dd>` : ''}
<dt>effects</dt><dd><code>${esc(D.sfx)}</code> <span class="tag">${esc(D.why.sfx)}</span></dd>
<dt>space</dt><dd>${D.space ? `<code>${esc(D.space)}</code>` : 'each level\'s own'} <span class="tag">${esc(D.why.space)}</span></dd>
<dt>interface</dt><dd><code>${esc(D.ui)}</code> <span class="tag">${esc(D.why.ui)}</span></dd></dl>
<h2>The cue sheet</h2><div class="wrap"><table><tr><th>where</th><th>asked by</th><th>the cue</th><th>why</th><th></th></tr>${B.rows.map(row).join('')}</table></div>
${B.owed.length ? `<h2>Owed</h2><ul>${B.owed.map((o) => `<li>${esc(o)}</li>`).join('')}</ul>` : ''}
${B.unasked.length ? `<h2>Named, and nothing asked for it</h2><ul>${B.unasked.map((o) => `<li><code>${esc(o)}</code></li>`).join('')}</ul>` : ''}
</main><script>
const K = (${emitBeatsKernel(features)})(), CUES = ${safeJson(B.cues)}, PATCHES = ${safeJson(pagePatches(...manifests))};
let ctx = null, eng = null, at = null;
const stop = () => { if (eng) { try { eng.stop(); } catch (e) {} eng = null; } if (at) { at.classList.remove('on'); at.textContent = 'play'; at = null; } };
for (const b of document.querySelectorAll('button.play')) b.addEventListener('click', () => {
  const was = at; stop();
  if (was === b) return;
  const m = CUES[b.dataset.id]; if (!m) return;
  if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; ctx = new C(); }
  if (ctx.state === 'suspended') ctx.resume();
  eng = K.createEngine(ctx);
  if (m.kind === 'beats-composition') eng.startComposition(m, PATCHES); else if (m.kind === 'beats-pattern') eng.startPattern(m, PATCHES); else eng.startAmbient(m, PATCHES);
  at = b; b.classList.add('on'); b.textContent = 'stop';
});
</script></body></html>`;
}
