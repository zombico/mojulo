/**
 * THE SCRIPT BOOK — the game's spoken lines read whole (`/bible?book=script`): level by level in the game's order, each
 * line its id, who says it, its moment in words and its text. For whoever voices the game: every line is found by its id
 * (a recording named for it is the line's voice), and the page carries the same as data (`script.json`, a script tag the
 * page holds) so another agent reads it without reading the page.
 *
 *   gameScript(G)        → { levels: [{ id, name, speakers, lines: [{ id, who, name, when, text }] }] } (a level with no
 *                          script left out)
 *   scriptBookHtml(G)    → the page
 *
 * Read from each level's script where it is written: a frame operation's (`goal.operation.script`). Pure.
 */
import { readScript } from './script.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const titled = (w) => w.replace(/(^|-)(\w)/g, (m, d, c) => (d ? ' ' : '') + c.toUpperCase());

/** A moment in words, as the level numbers its tasks. */
export function momentWords(on, after) {
  const at = on === 'start' ? 'as the level begins' : on === 'win' ? 'as it is won' : on === 'lost' ? 'as it is lost'
    : on.begin ? `as task ${on.begin} begins` : on.done ? `as task ${on.done} is met` : on.found ? `as task ${on.found}'s scan finds` : on.wave ? `as wave ${on.wave} comes` : `as ${on.down} goes down`;
  return after ? `${after} s after, ${at}` : at;
}

export function gameScript(G) {
  const ids = G.ids ?? Object.keys(G.levels ?? {});
  const levels = [];
  for (const id of ids) {
    const L = G.levels[id], raw = L?.goal?.operation?.script;
    if (!raw) continue;
    const tasks = L.goal.operation.tasks?.length ?? 0, S = readScript(raw, { tasks, at: `levels.${id}.goal.operation.script` });
    for (const a of L.goal.operation.allies ?? []) S.speakers[a.id] ??= { name: a.name };
    levels.push({ id, name: L.name ?? titled(id), speakers: S.speakers, lines: S.lines.map((l) => ({ id: l.id, who: l.who, name: S.speakers[l.who]?.name ?? titled(l.who), when: momentWords(l.on, l.after), text: l.text })) });
  }
  return { levels };
}

export function scriptBookHtml(G) {
  const S = gameScript(G), title = G.name ?? 'The game';
  const n = S.levels.reduce((a, l) => a + l.lines.length, 0);
  const body = S.levels.length ? S.levels.map((l) => `<section><h2>${esc(l.name)}</h2><table><thead><tr><th>Line</th><th>Who</th><th>When</th><th>Words</th></tr></thead><tbody>${l.lines.map((x) => `<tr><td class="id">${esc(x.id)}</td><td>${esc(x.name)}</td><td class="when">${esc(x.when)}</td><td>${esc(x.text)}</td></tr>`).join('')}</tbody></table></section>`).join('')
    : '<p class="none">No level has a script yet. A frame operation writes one as <code>goal.operation.script</code>.</p>';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}: the script</title><style>
body{margin:0;background:#f6f3ec;color:#1b1a17;font:15px/1.5 Georgia,serif}main{max-width:980px;margin:0 auto;padding:32px 20px 64px}
h1{font-size:28px;margin:0 0 4px}.sub{color:#6b665c;margin:0 0 28px}h2{font-size:19px;margin:32px 0 8px;border-bottom:1px solid #cfc8b8;padding-bottom:4px}
table{width:100%;border-collapse:collapse}th{text-align:left;font:600 11px/1.2 ui-monospace,Menlo,monospace;letter-spacing:1px;text-transform:uppercase;color:#6b665c;padding:6px 8px;border-bottom:1px solid #cfc8b8}
td{padding:7px 8px;vertical-align:top;border-bottom:1px solid #e4ded0}td.id{font:12px/1.4 ui-monospace,Menlo,monospace;color:#6b665c;white-space:nowrap}td.when{color:#6b665c;font-size:13px;width:22%}.none{color:#6b665c}
@media (max-width:640px){td.when{display:none}th:nth-child(3){display:none}}
</style></head><body><main><h1>${esc(title)}: the script</h1><p class="sub">${n} line${n === 1 ? '' : 's'} over ${S.levels.length} level${S.levels.length === 1 ? '' : 's'}. Each line's voice is found by its id.</p>${body}</main>
<script type="application/json" id="script.json">${JSON.stringify(S).replace(/</g, '\\u003c')}</script></body></html>`;
}
