/**
 * deskwork skin — the shift as a browser: a strip of tabs (the inbox with its count, the invoices, the decisions, the TPS
 * reports, the policies), an address bar, the page under it, a status line (the clock, the quota, the rank), and a popup
 * over all of it when training comes up. Every control says what it does as `data-act` (JSON of a core action), so the
 * page that hosts it (scene/channels/minigame-channel.js) answers a click by stepping the reducer with it. Pure: state
 * → an HTML string; DESK_CSS its look, scoped under `.dw`.
 *
 *   renderHtml(state)      → the browser
 *   resolveOverlay(state)  → { title, score, served, quota, time, rank, status, message }
 *   DESK_CSS
 */
import { KINDS, STEPS, TABS, FOLDERS, SENDS, rankTitle } from './core.js';

const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const act = (a) => ` data-act="${esc(JSON.stringify(a))}"`;
const clock = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const dollars = (c) => `$${Math.floor(c / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${String(c % 100).padStart(2, '0')}`;
const LABEL = { inbox: 'Inbox', invoices: 'Invoices', decisions: 'Decisions', tps: 'TPS Reports', policies: 'Policies' };
const ADDR = { inbox: 'mail', invoices: 'ap/invoices', decisions: 'strategy/decisions', tps: 'ops/tps', policies: 'hr/policies/current-final-v2-FINAL' };

export const DESK_CSS = `
.dw{width:min(860px,calc(100vw - 40px));height:min(540px,calc(100vh - 120px));display:flex;flex-direction:column;background:#f4f5f7;color:#1d2430;font:13px/1.4 system-ui,sans-serif;border-radius:8px;overflow:hidden;position:relative;box-shadow:0 10px 40px rgba(0,0,0,.5)}
.dw-strip{display:flex;gap:2px;padding:6px 8px 0;background:#d9dce2}
.dw-tab{padding:6px 12px;border-radius:7px 7px 0 0;background:#c6cad2;color:#3a4250;cursor:pointer;white-space:nowrap;border:0;font:inherit}
.dw-tab.on{background:#f4f5f7;color:#111;font-weight:600}
.dw-tab b{display:inline-block;min-width:16px;margin-left:6px;padding:0 5px;border-radius:8px;background:#d6453d;color:#fff;font-size:11px;text-align:center}
.dw-addr{display:flex;align-items:center;gap:10px;padding:6px 10px;background:#f4f5f7;border-bottom:1px solid #d3d7de}
.dw-url{flex:1;padding:4px 10px;border-radius:12px;background:#fff;border:1px solid #d3d7de;color:#56607a;font-size:12px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.dw-stat{font-size:12px;color:#3a4250;white-space:nowrap;font-variant-numeric:tabular-nums}
.dw-page{flex:1;display:flex;min-height:0}
.dw-list{width:240px;border-right:1px solid #d3d7de;overflow:auto;background:#fff}
.dw-row{display:block;width:100%;text-align:left;padding:8px 10px;border:0;border-bottom:1px solid #eceef2;background:none;font:inherit;cursor:pointer;color:inherit}
.dw-row.on{background:#e7efff}
.dw-row small{display:block;color:#6a7385}
.dw-row .due{color:#c0392b}
.dw-body{flex:1;padding:14px 18px;overflow:auto}
.dw-body h3{margin:0 0 8px;font-size:15px}
.dw-doc{background:#fff;border:1px solid #d3d7de;border-radius:6px;padding:10px 12px;margin-bottom:12px}
.dw-doc table{border-collapse:collapse;width:100%}
.dw-doc td,.dw-doc th{padding:3px 6px;border-bottom:1px solid #eceef2;text-align:left}
.dw-doc .n{text-align:right;font-variant-numeric:tabular-nums}
.dw-q{margin:6px 0 8px;font-weight:600}
.dw-step{font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#6a7385}
.dw-ans{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.dw-ans button{padding:9px 10px;border:1px solid #b9c1d0;border-radius:6px;background:#fff;font:inherit;cursor:pointer;text-align:left}
.dw-ans button:hover{background:#eef3ff}
.dw-ans kbd{display:inline-block;min-width:16px;margin-right:6px;padding:0 4px;border:1px solid #b9c1d0;border-radius:3px;font-size:11px;text-align:center;color:#56607a}
.dw-mail{border-top:1px solid #eceef2;padding:7px 0}
.dw-mail b{display:block;font-size:12px}
.dw-ok{color:#1e8449;font-weight:600}.dw-no{color:#c0392b;font-weight:600}
.dw-empty{color:#6a7385;padding:16px}
.dw-pop{position:absolute;inset:0;background:rgba(20,24,34,.55);display:flex;align-items:center;justify-content:center}
.dw-pop div{width:360px;background:#fff;border-radius:8px;padding:16px 18px;box-shadow:0 8px 30px rgba(0,0,0,.4)}
.dw-pop button{margin-top:12px;padding:8px 14px;border:0;border-radius:6px;background:#2d6cdf;color:#fff;font:inherit;cursor:pointer}
.dw-pol li{margin-bottom:8px}
`;

const open = (s) => s.tickets.filter((x) => x.state === 'open');
const ticketRow = (s, x) => `<button class="dw-row${x.id === s.open ? ' on' : ''}"${act({ type: 'open', id: x.id })}>#${x.id} ${esc(KINDS[x.kind].name)}<small>${esc(STEPS[x.steps[x.on].step].title)} · <span class="due">due in ${Math.max(0, Math.ceil(x.due - s.t))}s</span></small></button>`;

function docOf(x) {
  const d = x.doc;
  if (x.kind === 'invoice') return `<div class="dw-doc"><b>${esc(d.vendor)}</b> · Invoice ${esc(d.no)} · ${esc(d.po)}<table><tr><th>Item</th><th class="n">Qty</th><th class="n">Unit</th><th class="n">Amount</th></tr>${d.lines.map((l) => `<tr><td>${esc(l.item)}</td><td class="n">${l.qty}</td><td class="n">${dollars(l.unit)}</td><td class="n">${dollars(l.qty * l.unit)}</td></tr>`).join('')}<tr><td colspan="3">Subtotal</td><td class="n">${dollars(d.sub)}</td></tr><tr><td colspan="3">Tax (${d.rate}%)</td><td class="n">${dollars(d.tax)}</td></tr></table><small>Total: see subtotal and tax. Please do the math. We believe in you.</small></div>`;
  if (x.kind === 'decision') return `<div class="dw-doc"><b>From: ${esc(d.asker)}</b><p>We need a vendor for ${esc(d.project)}. It must come in under ${esc(d.budget)}, be delivered within ${d.days} days, and Legal must have approved it. Please recommend one by end of day (end of day is now).</p><table><tr><th>Vendor</th><th class="n">Cost</th><th class="n">Days</th><th>Legal</th></tr>${d.rows.map((r) => `<tr><td>${esc(r.vendor)}</td><td class="n">${esc(r.cost)}</td><td class="n">${r.days}</td><td>${esc(r.legal)}</td></tr>`).join('')}</table></div>`;
  return `<div class="dw-doc"><b>TPS events, ${esc(d.period)}</b><table><tr>${d.week.map((w) => `<th class="n">${w.day}</th>`).join('')}</tr><tr>${d.week.map((w) => `<td class="n">${w.n}</td>`).join('')}</tr></table><small>Reminder: TPS reports now require a cover sheet. See the latest memo.</small></div>`;
}

function work(s, tab) {
  const mine = open(s).filter((x) => KINDS[x.kind].tab === tab), x = s.tickets.find((y) => y.id === s.open && y.state === 'open' && KINDS[y.kind].tab === tab);
  const list = `<div class="dw-list">${mine.length ? mine.map((y) => ticketRow(s, y)).join('') : '<div class="dw-empty">Nothing here. Enjoy it while it lasts.</div>'}</div>`;
  if (!x) return `${list}<div class="dw-body"><div class="dw-empty">${mine.length ? 'Pick a ticket on the left.' : 'Your queue is empty. Someone will notice.'}</div></div>`;
  const st = x.steps[x.on], last = s.last && s.last.id === x.id ? (s.last.ok ? '<span class="dw-ok">Done. Next step.</span>' : '<span class="dw-no">Quality Assurance has flagged that. Try again.</span>') : '';
  return `${list}<div class="dw-body"><h3>#${x.id} ${esc(KINDS[x.kind].name)}</h3>${docOf(x)}<div class="dw-step">Step ${x.on + 1} of ${x.steps.length} · ${esc(STEPS[st.step].title)} (${STEPS[st.step].verb === 'shovel' ? 'work it out' : 'sort it'})</div><div class="dw-q">${esc(st.ask)}</div><div class="dw-ans">${st.choices.map((c, k) => `<button${act({ type: 'answer', k })}><kbd>${k + 1}</kbd>${esc(c)}</button>`).join('')}</div><p>${last}</p></div>`;
}

function inbox(s) {
  const mine = open(s);
  const mail = s.mail.slice().reverse().map((m) => `<div class="dw-mail"><b>${esc(m.from)}</b>${esc(m.text)}</div>`).join('');
  return `<div class="dw-list">${mine.length ? mine.map((y) => ticketRow(s, y)).join('') : '<div class="dw-empty">Inbox zero. Suspicious.</div>'}</div><div class="dw-body"><h3>Messages</h3>${mail}</div>`;
}

function policies(s) {
  const P = s.policies;
  return `<div class="dw-body dw-pol"><h3>Policies (current, final, v2, FINAL)</h3><ol>
<li><b>Invoices.</b> An invoice over ${dollars(P.threshold)} goes to <i>${esc(FOLDERS[1])}</i>. An invoice from Synergetics Internal is an <i>${esc(FOLDERS[2])}</i>, whatever it says. Everything else: <i>${esc(FOLDERS[0])}</i>. Nothing goes to <i>${esc(FOLDERS[3])}</i> (see Policy 0).</li>
<li><b>TPS reports.</b> Per the memo of this morning, every TPS report carries <b>Cover sheet v${P.cover}</b>. Earlier versions are deprecated. Later versions are not yet approved and must not be used, or discussed.</li>
<li><b>Routing.</b> TPS reports go to <i>${esc(SENDS[P.send])}</i>. Do not Reply All. We know who you are.</li>
<li><b>Recommendations.</b> Recommend the vendor that meets every constraint in the request. If none does, form a committee. One always does.</li>
<li><b>Policy 0.</b> This policy supersedes itself.</li></ol></div>`;
}

/** Pure state → the browser. */
export function renderHtml(state) {
  const s = state, n = open(s).length, tabs = TABS.map((t) => `<button class="dw-tab${s.tab === t ? ' on' : ''}"${act({ type: 'tab', tab: t })}>${LABEL[t]}${t === 'inbox' && n ? `<b>${n}</b>` : t !== 'inbox' && t !== 'policies' && open(s).some((x) => KINDS[x.kind].tab === t) ? `<b>${open(s).filter((x) => KINDS[x.kind].tab === t).length}</b>` : ''}</button>`).join('');
  const page = s.tab === 'inbox' ? inbox(s) : s.tab === 'policies' ? policies(s) : work(s, s.tab);
  const pop = s.popup ? `<div class="dw-pop"><div><b>${esc(s.popup.title)}</b><p>${esc(s.popup.text)}</p><button${act({ type: 'ack' })}>${esc(s.popup.ok)}</button></div></div>` : '';
  return `<div class="dw"><div class="dw-strip">${tabs}</div><div class="dw-addr"><span class="dw-url">https://intranet.synergetics.corp/${ADDR[s.tab]}</span><span class="dw-stat">${clock(s.left)} · Quota ${s.served}/${s.quota} · ${esc(rankTitle(s.rank))}</span></div><div class="dw-page">${page}</div>${pop}</div>`;
}

/** The communication layer as a pure view-model. */
export function resolveOverlay(state) {
  return {
    title: 'DESKWORK', score: String(state.score).padStart(4, '0'), served: state.served, quota: state.quota, time: clock(state.left), rank: rankTitle(state.rank),
    status: state.over ? 'over' : 'playing',
    message: state.over ? (state.served >= state.quota ? 'Quota met. Your effort has been recognised by an automated system.' : 'Quota missed. A meeting about this has been scheduled.') : state.popup ? 'Mandatory training. The shift keeps running.' : '',
  };
}
