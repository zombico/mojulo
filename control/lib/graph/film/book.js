/**
 * book — a FILM's book: the studio's page for it, where the person reads the film and approves each scene's board. The
 * departments and their states, what to do next, and each scene in the film's order: where it is set, who is in it,
 * its board's panels (from the last storyboard run), its script, its advice and whether its board is approved; then the
 * cast and every piece of advice by department. The same page is the storyboard run's front page.
 *
 *   filmBookHtml({ film, readout, boards? }) → one self-contained page (no script; images by URL)
 *     boards  { <scene id>: { page, panels: [<url>] } }: the last storyboard run's
 *
 * Pure.
 */
import { DEPARTMENTS } from './departments.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const STATE = { open: 'open', written: 'written', advised: 'advised', settled: 'settled' };

export function filmBookHtml({ film, readout, boards = {} }) {
  const R = readout, seconds = R.scenes.reduce((a, s) => a + (s.seconds ?? 0), 0);
  const adviceOf = (pred) => R.advice.filter(pred).map((a) => `<li><b>${esc(a.id)}</b> ${esc(a.says)}${a.try ? ` <i>Try:</i> ${esc(a.try)}` : ''}</li>`).join('');
  const scene = (s) => {
    const S = film.scenes.find((x) => x.id === s.id), B = boards[s.id];
    const parts = Object.keys(S.cast).map((w) => w.toUpperCase()).join(', ');
    return `<section class="scene" id="scene-${esc(s.id)}">
<h3>${esc(s.id)} <span class="badge ${esc(s.board)}">${s.board === 'approved' ? 'board approved' : s.board === 'stale' ? 'changed since approved' : 'board not approved'}</span></h3>
<p class="meta">${s.error ? 'does not play' : `${s.seconds.toFixed(1)} s · ${s.shots} shot${s.shots === 1 ? '' : 's'} · ${s.lines} line${s.lines === 1 ? '' : 's'}${s.recorded ? ` (${s.recorded} recorded)` : ''}${s.dubs ? ` · dubbed: ${s.dubs.join(', ')}` : ''}`} · ${esc(parts)}${s.place ? ` · on ${esc(s.place.title ?? s.place.world)}` : S.set ? ` · set ${esc(S.set)}` : ''}</p>
${B ? `<div class="strip">${B.panels.map((u, k) => `<a href="${esc(B.page)}"><img src="${esc(u)}" alt="panel ${k + 1}" loading="lazy"></a>`).join('')}</div><p class="meta"><a href="${esc(B.page)}">the board</a></p>` : '<p class="meta">No board yet.</p>'}
<pre>${esc(S.script)}</pre>
${R.advice.some((a) => a.scene === s.id) ? `<ul class="advice">${adviceOf((a) => a.scene === s.id)}</ul>` : ''}
</section>`;
  };
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(film.title ?? 'Film')} — the film's book</title>
<style>
:root{--bg:#f3f1ec;--card:#fffdf8;--ink:#1f1d1a;--dim:#6b665e;--rule:#d6d1c6;--accent:#a4522f;--ok:#3f7a4a;--warn:#a8742a}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#1b1a18;--card:#252320;--ink:#ece9e3;--dim:#a39d93;--rule:#3d3a35;--accent:#e08a62;--ok:#7fbf8a;--warn:#e0b060}}
:root[data-theme=dark]{--bg:#1b1a18;--card:#252320;--ink:#ece9e3;--dim:#a39d93;--rule:#3d3a35;--accent:#e08a62;--ok:#7fbf8a;--warn:#e0b060}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 system-ui,-apple-system,sans-serif;padding:16px}
main{max-width:1100px;margin:0 auto}h1{font-size:24px;margin:0 0 4px}h2{font-size:17px;margin:24px 0 8px}h3{font-size:15px;margin:0 0 4px}
.meta{color:var(--dim);font-size:12.5px;margin:2px 0 8px}
table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--rule);border-radius:6px;font-size:13px}
th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--rule);vertical-align:top}th{color:var(--dim);font-weight:600}
.state{font-weight:600}.state.settled{color:var(--ok)}.state.advised{color:var(--warn)}.state.open{color:var(--dim)}
.scene{background:var(--card);border:1px solid var(--rule);border-radius:6px;padding:12px;margin:0 0 12px}
.badge{font-size:11px;font-weight:600;border-radius:3px;padding:1px 6px;margin-left:6px;border:1px solid var(--dim);color:var(--dim)}
.badge.approved{border-color:var(--ok);color:var(--ok)}.badge.stale{border-color:var(--warn);color:var(--warn)}
.strip{display:flex;gap:6px;overflow-x:auto;padding:2px 0}.strip img{height:96px;width:auto;border:1px solid var(--ink);display:block}
pre{white-space:pre-wrap;font:12.5px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--bg);padding:8px;border-radius:4px;margin:8px 0}
ul{margin:4px 0 0;padding-left:18px}.advice li{margin:2px 0}a{color:var(--accent)}
.table-wrap{overflow-x:auto}
</style></head><body><main>
<h1>${esc(film.title ?? 'Film')}</h1>
<p class="meta">${R.scenes.length} scene${R.scenes.length === 1 ? '' : 's'} · ${seconds.toFixed(1)} s · ${R.approved ? 'every board approved' : `${R.scenes.filter((s) => s.board === 'approved').length} of ${R.scenes.length} boards approved`}${film.look ? ` · the ${esc(film.look)} look` : ''}</p>
<h2>The departments</h2>
<div class="table-wrap"><table><thead><tr><th>Department</th><th>State</th><th>Advice</th><th>Owns</th></tr></thead><tbody>
${R.departments.map((D) => `<tr><td>${esc(D.name)}${D.owner === 'main' ? ' <span class="meta">(the main agent\'s)</span>' : ''}</td><td class="state ${esc(D.state)}">${esc(STATE[D.state] ?? D.state)}</td><td>${D.advice || ''}</td><td>${esc(D.does)}</td></tr>`).join('\n')}
</tbody></table></div>
<p class="meta">Made in waves: ${R.waves.map((w) => w.map((id) => DEPARTMENTS.find((D) => D.id === id).name).join(' and ')).join(', then ')}.</p>
${R.next.length ? `<h2>Next</h2><ul>${R.next.map((n) => `<li>${esc(n.says)} <i>Try:</i> ${esc(n.try)}</li>`).join('')}</ul>` : ''}
<h2>The scenes</h2>
${R.scenes.map(scene).join('\n')}
<h2>The cast</h2>
<ul>${Object.entries(film.cast).map(([w, C]) => `<li><b>${esc(w.toUpperCase())}</b> ${C.persona ? `persona ${esc(C.persona)}` : typeof C.hero === 'string' ? `hero ${esc(C.hero)}` : C.hero ? 'a hero spec' : 'the default hero'}${C.style ? ` · ${esc(C.style)}` : ''}${C.register ? ` · ${esc(typeof C.register === 'string' ? C.register : C.register.from ?? 'a tuned register')}` : ''}</li>`).join('')}</ul>
${film.sets ? `<h2>The sets</h2><ul>${Object.entries(film.sets).map(([id, ref]) => `<li><b>${esc(id)}</b> ${esc(ref)}</li>`).join('')}</ul>` : ''}
${R.advice.length ? `<h2>All advice, by department</h2>${DEPARTMENTS.filter((D) => R.advice.some((a) => a.department === D.id)).map((D) => `<h3>${esc(D.name)}</h3><ul class="advice">${adviceOf((a) => a.department === D.id)}</ul>`).join('')}` : ''}
<p class="meta">Advice suggests and never refuses. Whether a board reads as the film is the person's call: approve it per scene.</p>
</main></body></html>
`;
}
