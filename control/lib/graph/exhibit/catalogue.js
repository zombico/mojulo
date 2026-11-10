/**
 * THE CATALOGUE: an exhibit's book, the way a museum prints the labels and the sources of a wing. What a visitor should
 * leave understanding, whom it is told for, each room's stops (every caption, how sure it is, where it comes from), every
 * claim with its sources, and the accuracy gate's record: the expert's sign-off as it stands against the claims now. It
 * records the sign-off; it never establishes it (whether a claim is true is the expert's). Served at
 * /api/sketches/<ref>/bible?book=exhibit (a gallery's book by default); one self-contained page, printable.
 * Pure: the rooms are handed in.
 */
import { AUDIENCE_WORDS, accuracyOf } from './brief.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const list = (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);

export const GRADE_WORDS = Object.freeze({
  attested: 'read in a source of the time, or seen in what survives',
  reconstructed: 'worked out from parallels and what survives nearby',
  conjectural: 'a plausible guess where the record is silent',
  simulated: 'computed from the laws, and checked',
  depicted: 'drawn as it is described, not computed',
  explained: 'a model to understand by, not a measurement',
});

function claimState(acc, id) {
  if (acc.state === 'unsigned' || acc.state === 'no-claims') return 'not signed';
  if (acc.changed?.includes(id)) return 'changed since it was signed';
  if (acc.unsigned?.includes(id)) return 'added since the sign-off';
  return 'signed';
}

/**
 * The catalogue page. `rooms`: [{ title, label?, tour, brief }] (one for a single exhibit), their recipes' tours and
 * briefs as stored; `brief`: the whole's (a gallery's, or the one exhibit's). Returns one HTML document.
 */
export function catalogueHtml({ title, intro, brief = null, rooms = [] }) {
  const aims = brief?.aims || (rooms.length === 1 ? rooms[0].brief?.aims : null) || [];
  const audiences = [...new Set(['general', ...rooms.flatMap((r) => r.brief?.audiences || []), ...(brief?.audiences || [])])];
  const grades = new Set();
  const sections = rooms.map((r, ri) => {
    const claimOf = new Map((r.brief?.claims || []).map((c) => [c.id, c]));
    const stops = (r.tour?.stops || []).map((s, i) => {
      const stated = list(s.claims).map((id) => claimOf.get(id)).filter(Boolean);
      const grade = s.grade || stated.find((c) => c.grade)?.grade;
      const cite = list(s.cite).length ? list(s.cite) : [...new Set(stated.flatMap((c) => list(c.cite)))];
      if (grade) grades.add(grade);
      const caps = [['general', s.caption], ['child', s.captions?.child], ['specialist', s.captions?.specialist]].filter(([, t]) => t);
      return `<li class="stop"><div class="sh"><span class="n">${i + 1}</span><span class="st">${esc(s.title || '')}</span>${grade ? `<span class="g g-${esc(grade)}">${esc(grade)}</span>` : ''}</div>
${caps.map(([a, t]) => `<p class="cap"${caps.length > 1 ? ` data-a="${esc(AUDIENCE_WORDS[a])}"` : ''}>${esc(t)}</p>`).join('\n')}
${stated.length ? `<p class="cl">States: ${stated.map((c) => `<a href="#c-${ri}-${esc(c.id)}">${esc(c.id)}</a>`).join(', ')}</p>` : ''}${cite.length ? `<p class="src">${cite.map(esc).join(' · ')}</p>` : ''}</li>`;
    }).join('\n');
    const acc = accuracyOf(r.brief ?? null);
    const claims = (r.brief?.claims || []).map((c) => {
      if (c.grade) grades.add(c.grade);
      return `<tr id="c-${ri}-${esc(c.id)}"><td class="id">${esc(c.id)}</td><td>${esc(c.text)}</td><td>${c.grade ? `<span class="g g-${esc(c.grade)}">${esc(c.grade)}</span>` : '<span class="none">ungraded</span>'}</td><td>${list(c.cite).length ? list(c.cite).map(esc).join('<br>') : '<span class="none">no source</span>'}</td><td class="so">${esc(claimState(acc, c.id))}</td></tr>`;
    }).join('\n');
    const expert = r.brief?.expert;
    return `<section class="room">
<h2>${rooms.length > 1 ? `<span class="rn">Room ${ri + 1}</span>` : ''}${esc(r.title)}${r.label ? ` <span class="hall">${esc(r.label)}</span>` : ''}</h2>
${r.tour?.stops?.length ? `<ol class="stops">\n${stops}\n</ol>` : '<p class="none">No tour: a visitor explores this room freely.</p>'}
${claims ? `<h3>Claims and their sources</h3>
<table class="claims"><thead><tr><th>Claim</th><th>What it states</th><th>How sure</th><th>Sources</th><th>Sign-off</th></tr></thead><tbody>
${claims}
</tbody></table>
<p class="acc acc-${esc(acc.state)}"><strong>Accuracy.</strong> ${esc(acc.says.charAt(0).toUpperCase() + acc.says.slice(1))}${expert ? `. The expert who answers for these claims: ${esc(expert.name)}${expert.role ? `, ${esc(expert.role)}` : ''}` : ''}.</p>` : ''}
</section>`;
  }).join('\n');
  const legend = [...grades].map((g) => `<li><span class="g g-${esc(g)}">${esc(g)}</span> ${esc(GRADE_WORDS[g] || '')}</li>`).join('\n');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title || 'Exhibit')}: the catalogue</title>
<style>
  :root{color-scheme:light;--ink:#1c1b19;--mute:#6b665d;--line:#d9d3c7;--paper:#faf7f0}
  html,body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.55 Georgia,'Times New Roman',serif}
  main{max-width:780px;margin:0 auto;padding:48px 20px 64px}
  .kick{font:600 11px/1 system-ui,sans-serif;letter-spacing:2px;text-transform:uppercase;color:var(--mute)}
  h1{font-size:clamp(30px,5vw,42px);line-height:1.12;margin:10px 0 8px}
  .intro{color:var(--mute);margin:0 0 24px}
  h2{font-size:24px;margin:40px 0 12px;padding-top:20px;border-top:1px solid var(--line)}
  h2 .rn{display:block;font:600 11px/1 system-ui,sans-serif;letter-spacing:2px;text-transform:uppercase;color:var(--mute);margin-bottom:6px}
  h2 .hall{font:600 12px/1 system-ui,sans-serif;letter-spacing:1.4px;text-transform:uppercase;color:#3a5f8f;vertical-align:middle}
  h3{font:600 13px/1.3 system-ui,sans-serif;letter-spacing:1px;text-transform:uppercase;color:var(--mute);margin:28px 0 8px}
  .aims li{margin:4px 0}
  .stops{list-style:none;padding:0;margin:0}
  .stop{padding:12px 0;border-bottom:1px dotted var(--line)}
  .sh{display:flex;align-items:baseline;gap:10px}.n{font:600 12px/1 ui-monospace,Menlo,monospace;color:var(--mute);min-width:20px}.st{font-weight:600}
  .cap{margin:6px 0 0 30px}.cap[data-a]::before{content:attr(data-a) ': ';font:600 11px/1 system-ui,sans-serif;letter-spacing:1px;text-transform:uppercase;color:var(--mute)}
  .cl,.src{margin:6px 0 0 30px;font:13px/1.4 system-ui,sans-serif;color:var(--mute)}.cl a{color:#3a5f8f}
  .g{display:inline-block;font:600 11px/1 system-ui,sans-serif;letter-spacing:.6px;padding:3px 8px;border-radius:999px;background:#ece6da;margin-left:auto}
  .g-attested{background:#dcefe2}.g-reconstructed{background:#f6ecd0}.g-conjectural{background:#f8e0d6}.g-simulated{background:#dde8fa}.g-depicted{background:#ece2fa}.g-explained{background:#dcf1ee}
  table{width:100%;border-collapse:collapse;font:14px/1.4 system-ui,sans-serif}th,td{border-bottom:1px solid var(--line);padding:8px 6px;text-align:left;vertical-align:top}
  th{font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--mute)}td.id{font-family:ui-monospace,Menlo,monospace;font-size:12px}
  .none{color:#a0543a}.so{white-space:nowrap}
  .acc{margin-top:14px;padding:12px 14px;border:1px solid var(--line);border-radius:8px;font:14px/1.5 system-ui,sans-serif;background:#fff}
  .acc-signed{border-color:#9bc7a8}.acc-changed,.acc-unsigned{border-color:#e0b48f}
  .legend{list-style:none;padding:0;font:14px/1.5 system-ui,sans-serif}.legend li{margin:6px 0}.legend .g{margin:0 8px 0 0}
  .note{font:13px/1.5 system-ui,sans-serif;color:var(--mute);margin-top:32px}
  @media print{body{background:#fff}main{padding:0}h2{break-before:auto;break-after:avoid}.stop,tr{break-inside:avoid}}
</style></head><body><main>
<div class="kick">The catalogue</div>
<h1>${esc(title || 'Exhibit')}</h1>
${intro ? `<p class="intro">${esc(intro)}</p>` : ''}
${aims.length ? `<h3>What a visitor should leave understanding</h3>\n<ul class="aims">${aims.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
${audiences.length > 1 ? `<h3>Told for</h3>\n<p>${audiences.map((a) => esc(AUDIENCE_WORDS[a])).join(' · ')}</p>` : ''}
${sections}
${legend ? `<h3>How sure: the grades</h3>\n<ul class="legend">${legend}</ul>` : ''}
<p class="note">Drawn from the exhibit's recipe as it stands. The catalogue records the expert's sign-off; it does not establish it: whether a claim is true is the expert's to say.</p>
</main></body></html>
`;
}
