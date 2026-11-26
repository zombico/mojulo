/**
 * deskwork core — a pure reducer for a shift of office work done in a browser of tabs: TICKETS arrive in the inbox on a
 * schedule (a shovels & buckets card's arrivals, deskwork/card.js), each a few steps to do before it is due. A SHOVEL
 * step is a question to work out (the invoice's total, the vendor a memo's constraints allow, the week's TPS count); a
 * BUCKET step is a quick sort (which folder, which cover sheet, who it goes to), answered by the shift's POLICIES (the
 * Policies tab: the threshold over which an invoice waits for approval, the cover sheet the latest memo names, who a TPS
 * report goes to). Each question has its answer among four choices, generated from the ticket's own numbers on seeded
 * dice, so every one is answerable from what the tabs show. A right answer moves the ticket on; the last step serves it;
 * a wrong one is a mistake (it costs, and Quality Assurance writes). A ticket past its due is escalated. The shift ends
 * on the clock; met quota is a won shift. Half of it is Kafka (the memo about the memo, training on the policy you were
 * not given), half a joke.
 *
 * RANK (the commendations a player holds, two a promotion) is who plays: a higher one gets more tickets on less
 * patience (the schedule's), a training popup that must be clicked through, and more pay a ticket.
 *
 *   newGame(seed, { rank?, schedule?, time? })  → state
 *     schedule  [{ at, kind, patience }] seconds into the shift (deskwork/card.js); a steady default where absent
 *   step(state, action)  actions: { type: 'tick', dt } (ms) · { type: 'tab', tab } · { type: 'open', id } ·
 *                        { type: 'answer', k } · { type: 'ack' } (the popup) · 'restart'
 *   wonOf(state)   whether the quota is met
 *   KINDS, TABS, RANKS, PER_RANK, rankTitle(rank)
 *
 * Pure and deterministic: mulberry32 over the seed, a ticket's own stream from its number.
 */

export const TIME = 180;            // seconds a shift
export const PER_RANK = 2;          // commendations a promotion
export const QUOTA = 0.6;           // the share of a shift's tickets that meets it
export const POINTS = 100;          // a ticket served
export const SLIP = 20;             // a mistake
export const RANKS = Object.freeze(['Temp', 'Probationary Associate', 'Associate', 'Senior Associate', 'Associate Senior Associate', 'Vice President of Associates']);
export const rankTitle = (rank) => RANKS[Math.max(0, Math.min(RANKS.length - 1, rank | 0))];

/** The kinds of ticket: the tab it is worked in, its steps (each a shovel's question or a bucket's sort). */
export const KINDS = Object.freeze({
  invoice: { name: 'Invoice', tab: 'invoices', steps: ['extract', 'file'] },
  decision: { name: 'Recommendation request', tab: 'decisions', steps: ['recommend'] },
  tps: { name: 'TPS report', tab: 'tps', steps: ['tally', 'cover', 'send'] },
});
export const STEPS = Object.freeze({
  extract: { verb: 'shovel', title: 'Extract invoice data' },
  file: { verb: 'bucket', title: 'File the invoice' },
  recommend: { verb: 'shovel', title: 'Choose recommendation' },
  tally: { verb: 'shovel', title: 'Prepare TPS report' },
  cover: { verb: 'bucket', title: 'Attach the cover sheet' },
  send: { verb: 'bucket', title: 'Send the TPS report' },
});
export const TABS = Object.freeze(['inbox', 'invoices', 'decisions', 'tps', 'policies']);

/** mulberry32 over a carried state: → [value in [0, 1), next state]. */
export function rngNext(s) {
  const n = (s + 0x6d2b79f5) >>> 0;
  let t = n;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, n];
}
// a little stream: draw(n) an integer below n, pick(list) one of them, shuffle(list) a copy in a new order
function dice(seed) {
  let s = seed >>> 0;
  const u = () => { const [v, n] = rngNext(s); s = n; return v; };
  const draw = (n) => Math.floor(u() * n);
  return { u, draw, pick: (l) => l[draw(l.length)], shuffle: (l) => { const a = l.slice(); for (let i = a.length - 1; i > 0; i--) { const j = draw(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; } };
}
const money = (c) => `$${Math.floor(c / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${String(c % 100).padStart(2, '0')}`;
// (four choices, the right one among them at a place of the dice's, none twice)
function choices(D, right, wrongs) {
  const seen = new Set([right]), rest = [];
  for (const w of wrongs) if (!seen.has(w)) { seen.add(w); rest.push(w); }
  const four = D.shuffle([right, ...rest.slice(0, 3)]);
  return { choices: four, answer: four.indexOf(right) };
}
const swap2 = (s) => { const t = String(s); const i = t.length - 3; return i < 1 ? t + '0' : t.slice(0, i) + t[i + 1] + t[i] + t.slice(i + 2); };

const VENDORS = ['Paperclip Dynamics', 'Synergy Solutions LLC', 'Acme Toner & Regret', 'Lumbar Support Partners', 'Global Staples Holdings', 'Ergonomic Despair Inc.', 'Synergetics Internal', 'Quarterly Beverages Ltd.'];
const GOODS = ['Toner cartridge', 'Ergonomic chair', 'Stapler (red)', 'Motivational poster', 'Printer paper (ream)', 'Lanyard', 'Whiteboard marker', 'Standing desk converter', 'Coffee pods (decaf)', 'Cable organiser'];
const PROJECTS = ['the Synergy Initiative', 'Project Paradigm', 'the Q3 Realignment', 'Operation Leverage', 'the Mission Statement Refresh', 'the Breakroom Modernisation'];
const ASKERS = ['Darla (your manager)', 'Bill from Accounts', 'The Office of the Deputy VP', 'Kevin (no relation)', 'Legal (automated)'];
export const FOLDERS = Object.freeze(['Accounts Payable', 'Approvals Pending (Do Not Open)', 'Inter-Department Chargebacks', 'The Shredder']);
export const SENDS = Object.freeze(['Your manager', 'Your manager\'s manager, cc your manager', 'Reply All to the company', 'Nobody (save as draft)']);

/** The shift's policies, on the seed: they decide the buckets and the Policies tab says them. */
export function policiesOf(seed) {
  const D = dice(seed ^ 0x9e3779b9);
  return { threshold: D.pick([50000, 100000, 250000]), cover: 4 + D.draw(5), send: 1 };
}

/** A ticket's steps, its questions worked out from its own numbers. */
function ticketOf(seed, k, kind, P) {
  const D = dice((seed + Math.imul(k + 1, 2654435761)) >>> 0), t = { kind };
  if (kind === 'invoice') {
    const vendor = D.pick(VENDORS), lines = D.shuffle(GOODS).slice(0, 2 + D.draw(2)).map((item) => ({ item, qty: 1 + D.draw(12), unit: 500 + D.draw(40) * 250 }));
    const sub = lines.reduce((a, l) => a + l.qty * l.unit, 0), rate = D.pick([5, 8, 10]), tax = Math.round((sub * rate) / 100), total = sub + tax, po = `PO-${10000 + D.draw(89999)}`, no = `INV-${1000 + D.draw(8999)}`;
    t.doc = { vendor, lines, rate, sub, tax, total, po, no };
    const ask = D.draw(2) === 0
      ? { ask: 'What is the invoice total, tax included?', ...choices(D, money(total), [money(sub), money(sub + 2 * tax), money(Number(swap2(total))), money(total + 100 * (1 + D.draw(9)))]) }
      : { ask: 'Which purchase order does it bill?', ...choices(D, po, [`PO-${swap2(po.slice(3))}`, no, `PO-${10000 + D.draw(89999)}`]) };
    // (where it is filed: the policies say; an internal one is a chargeback, a big one waits for approval)
    const folder = vendor === 'Synergetics Internal' ? 2 : total > P.threshold ? 1 : 0;
    t.steps = [{ step: 'extract', ...ask }, { step: 'file', ask: 'File it where the policies say.', choices: FOLDERS.slice(), answer: folder }];
  } else if (kind === 'decision') {
    // (three vendors and a committee; the memo's constraints allow exactly one)
    const budget = (20 + D.draw(30)) * 100000, days = 5 + D.draw(10), project = D.pick(PROJECTS), asker = D.pick(ASKERS);
    const names = D.shuffle(VENDORS.filter((v) => v !== 'Synergetics Internal')).slice(0, 3);
    const fits = { cost: budget - (1 + D.draw(8)) * 50000, days: days - 1 - D.draw(3), legal: 'Approved' };
    const over = { cost: budget + (1 + D.draw(8)) * 50000, days: days - 1 - D.draw(3), legal: 'Approved' };
    const late = { cost: budget - (1 + D.draw(8)) * 50000, days: days + 1 + D.draw(4), legal: 'Approved' };
    const pend = { cost: budget - (1 + D.draw(8)) * 50000, days: days - 1 - D.draw(3), legal: D.pick(['Pending', 'Lost in the mail', 'Under review since 2019']) };
    const rows = D.shuffle([fits, ...D.shuffle([over, late, pend]).slice(0, 2)]).map((r, i) => ({ vendor: names[i], cost: money(r.cost), days: r.days, legal: r.legal, ok: r === fits }));
    const right = rows.find((r) => r.ok).vendor;
    t.doc = { project, asker, budget: money(budget), days, rows };
    const committee = 'Form a committee to study it';
    const four = D.shuffle([...rows.map((r) => r.vendor), committee]);
    t.steps = [{ step: 'recommend', ask: `Which vendor do you recommend for ${project}?`, choices: four, answer: four.indexOf(right) }];
  } else {
    // (the week's TPS events, a day each; the report's count is their sum)
    const week = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d) => ({ day: d, n: 3 + D.draw(25) })), sum = week.reduce((a, x) => a + x.n, 0);
    t.doc = { week, period: `Week ${1 + D.draw(52)}` };
    const covers = [`Cover sheet v${P.cover - 1}`, `Cover sheet v${P.cover}`, `Cover sheet v${P.cover + 1} (draft)`, 'No cover sheet'];
    t.steps = [
      { step: 'tally', ask: `How many TPS events in ${t.doc.period}?`, ...choices(D, String(sum), [String(sum - week[4].n), String(sum + 1), String(Math.round(sum / 5)), String(sum - week[0].n)]) },
      { step: 'cover', ask: 'Attach the cover sheet the latest memo asks for.', ...(() => { const c = D.shuffle(covers); return { choices: c, answer: c.indexOf(`Cover sheet v${P.cover}`) }; })() },
      { step: 'send', ask: 'Send it where the policies say.', choices: SENDS.slice(), answer: P.send },
    ];
  }
  return t;
}

/** A steady shift where no schedule is given: a ticket every 18 s, the kinds in turn, each due a minute on. */
export function steadySchedule(time = TIME) {
  const kinds = ['invoice', 'decision', 'tps'], out = [];
  for (let at = 2, k = 0; at < time - 20; at += 18, k++) out.push({ at, kind: kinds[k % 3], patience: 60 });
  return out;
}

export function newGame(seed, { rank = 0, schedule = null, time = TIME } = {}) {
  const S = (schedule && schedule.length ? schedule : steadySchedule(time)).filter((x) => KINDS[x.kind] && x.at < time), P = policiesOf(seed >>> 0);
  const tickets = S.map((x, k) => ({ id: k + 1, at: x.at, due: x.at + x.patience, kind: x.kind, ...ticketOf(seed >>> 0, k, x.kind, P), on: 0, state: 'later' }));
  // (training: past the first rank, a mandatory course comes up mid-shift and holds the screen till it is acknowledged)
  const D = dice((seed ^ 0x5bd1e995) >>> 0), training = rank >= 1 ? [Math.round(time * (0.3 + 0.3 * D.u()))] : [];
  return { seed: seed >>> 0, rank: rank | 0, time, t: 0, left: time * 1000, policies: P, tickets, tab: 'inbox', open: null, served: 0, missed: 0, mistakes: 0, score: 0,
    quota: Math.max(1, Math.ceil(tickets.length * QUOTA)), training, popup: null, mail: [{ at: 0, from: 'Darla (your manager)', text: `Welcome aboard, ${rankTitle(rank)}! Tickets come to your inbox. The Policies tab has everything you need, probably.` }], last: null, over: false };
}

const pts = (s) => Math.round(POINTS * (1 + 0.25 * s.rank));
const mail = (s, from, text) => ({ ...s, mail: [...s.mail, { at: Math.round(s.t), from, text }] });

function tick(state, ms) {
  if (state.over) return state;
  const left = Math.max(0, state.left - ms), t = (state.time * 1000 - left) / 1000;
  let s = { ...state, left, t };
  // (arrived; escalated past their due)
  let changed = false;
  const tickets = s.tickets.map((x) => {
    // (one that came and fell due inside a long frame is escalated all the same)
    if (x.state === 'later' && t >= x.at) { changed = true; return { ...x, state: t >= x.due ? 'missed' : 'open' }; }
    if (x.state === 'open' && t >= x.due) { changed = true; return { ...x, state: 'missed' }; }
    return x;
  });
  if (changed) {
    const lost = tickets.filter((x, i) => x.state === 'missed' && s.tickets[i].state !== 'missed');
    s = { ...s, tickets, missed: s.missed + lost.length };
    for (const x of lost) s = mail(s, 'Escalations Bot', `Ticket #${x.id} (${KINDS[x.kind].name}) has been escalated to a committee. The committee has been escalated to a subcommittee.`);
    if (lost.some((x) => x.id === s.open)) s = { ...s, open: null };
  }
  // (the training comes up on its time, the shift still running behind it)
  if (s.training.length && t >= s.training[0] && !s.popup) s = { ...s, training: s.training.slice(1), popup: { title: 'Mandatory Training', text: 'Module 7: Understanding the Policies You Have Not Been Given. Please confirm you have read and understood the policy (attached separately, not attached).', ok: 'I have read and understood' } };
  if (left <= 0) s = { ...s, over: true, open: null, popup: null };
  return s;
}

function answer(state, k) {
  if (state.over || state.popup) return state;
  const x = state.tickets.find((y) => y.id === state.open && y.state === 'open');
  if (!x) return state;
  const st = x.steps[x.on];
  if (k !== st.answer) {
    const s = { ...state, mistakes: state.mistakes + 1, score: Math.max(0, state.score - SLIP), last: { id: x.id, ok: false } };
    return mail(s, 'Quality Assurance', `Re: ticket #${x.id}, "${STEPS[st.step].title}": per policy 4.2.1(b), this is incorrect. Please re-do it correctly the first time.`);
  }
  const on = x.on + 1, done = on >= x.steps.length;
  const tickets = state.tickets.map((y) => (y.id === x.id ? { ...y, on, state: done ? 'done' : 'open' } : y));
  let s = { ...state, tickets, last: { id: x.id, ok: true } };
  if (done) {
    s = { ...s, served: s.served + 1, score: s.score + pts(s), open: null };
    if (s.served === s.quota) s = mail(s, 'Darla (your manager)', 'You hit quota! This has been noted in your file. Your file has been noted in another file.');
  }
  return s;
}

export function step(state, action) {
  const type = typeof action === 'string' ? action : action?.type;
  if (type === 'restart') return newGame((state.seed + 1) >>> 0, { rank: state.rank, schedule: state.tickets.map((x) => ({ at: x.at, kind: x.kind, patience: x.due - x.at })), time: state.time });
  if (type === 'tick') return tick(state, action.dt || 0);
  if (state.over) return state;
  if (type === 'ack') return state.popup ? { ...state, popup: null } : state;
  if (state.popup) return state;
  if (type === 'tab') return TABS.includes(action.tab) ? { ...state, tab: action.tab } : state;
  if (type === 'open') { const x = state.tickets.find((y) => y.id === action.id && y.state === 'open'); return x ? { ...state, open: x.id, tab: KINDS[x.kind].tab } : state; }
  if (type === 'answer') return answer(state, action.k);
  return state;
}

export const wonOf = (state) => state.served >= state.quota;
