/**
 * The RPG channel: a world's party battles (playscape/rpg) on the page, riding the events channel (its bus state, its
 * log, its input queue). Emitted inside the events channel only when the events carry `rpg`, so a world without one
 * keeps every byte. The kernel is the node module's own code (buildRpg.toString()), the page below is one function
 * (rpgPage.toString()), so neither has a second copy.
 *
 *   THE BATTLE, in place over the field (the world holds still while it is up): the foes above, the message line, the
 *   command window and the party strip below. Each standing member picks (Attack, Skill, Item, Guard, Flee; a target
 *   with the arrows), then the round plays back beat by beat, a number rising off whoever it lands on. Accept skips
 *   ahead; back steps to the member before.
 *   THE PARTY MENU (P): the members on the left; Status, Class (switch), Skills (the class's tree: buy) on the right.
 *   RANDOM ENCOUNTERS: a roll every `every` metres the pilot walks, in the random zones (or anywhere).
 *
 * It reads the bus's log for `rpg-battle:<encounter>`, `rpg-rest`, `rpg-join:<member>`, `rpg-open:<class>`, and pushes
 * `rpg-won` / `rpg-fled` / `rpg-lost` (alone and `:<encounter>`) as a battle closes. With the party mechanic (the level
 * contract's game.party) the party is loaded from the store's slice as the level starts, and kept there as it changes.
 * Keys: the menu control scheme (arrows / WASD, Enter / Space / E accept, Escape / Backspace back, [ ] tabs; a pad in
 * its printed layout); P or the pad's select opens the party menu. window.__mojRpg drives it headless (a test, the audit).
 */
import { buildRpg } from '../../playscape/rpg/kernel.js';
import { menuControls, padLayoutSource } from './interact-channel.js';
import { DEVICES } from '../../controls/devices.js';

export const RPG_CSS = `
.moj-rpg{position:fixed;inset:0;pointer-events:none;z-index:31;font:14px/1.35 var(--moj-font,system-ui,sans-serif);color:var(--moj-ink,#eef2ff);display:none}
.moj-rpg.on{display:block}
:where(.moj-rpg) .moj-w{background:var(--moj-panel,rgba(14,22,58,.94));border:1px solid var(--moj-line,#c9d3ff);border-radius:8px;padding:8px 12px;pointer-events:auto;box-sizing:border-box}
.moj-rpg-foes{position:absolute;top:16px;left:50%;transform:translateX(-50%);display:flex;flex-wrap:wrap;gap:6px 14px;justify-content:center;max-width:calc(100vw - 32px)}
.moj-rpg-foe{position:relative;min-width:96px;padding:2px 4px 2px 16px;cursor:pointer}
.moj-rpg-foe.down{opacity:.3;text-decoration:line-through}
.moj-rpg-foe .bar,.moj-rpg-row .bar{height:4px;margin-top:3px;background:rgba(255,255,255,.15);border-radius:2px;overflow:hidden}
.moj-rpg-foe .bar i,.moj-rpg-row .bar i{display:block;height:100%;background:var(--moj-accent,#ffd76a)}
.moj-rpg-turns{display:flex;gap:4px;justify-content:center;width:100%;margin-top:4px;font-size:11px}.moj-rpg-turns span{padding:1px 6px;border-radius:3px;background:rgba(0,0,0,.35)}.moj-rpg-turns span:first-child{outline:1px solid var(--moj-accent,#ffd76a)}.moj-rpg-turns .f{opacity:.7}
.moj-rpg-msg{position:absolute;left:50%;bottom:184px;transform:translateX(-50%);width:min(560px,calc(100vw - 32px));min-height:38px}
.moj-rpg-bottom{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);display:flex;gap:10px;width:min(720px,calc(100vw - 32px));align-items:stretch}
.moj-rpg-cmd{width:200px;flex:none;min-height:150px}
.moj-rpg-party{flex:1;min-width:0}
.moj-rpg-cmd .t,.moj-rpg-field .t{font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.75;margin-bottom:4px}
.moj-rpg .opt{display:flex;justify-content:space-between;gap:10px;padding:1px 0 1px 16px;position:relative;cursor:pointer}
.moj-rpg .opt.off{opacity:.42}
.moj-rpg .on-f::before{content:"\\25B6";position:absolute;left:0;font-size:11px;top:3px;color:var(--moj-accent,#ffd76a)}
.moj-rpg-row{display:grid;grid-template-columns:minmax(70px,1.2fr) 1fr 1fr;gap:10px;padding:2px 4px 2px 16px;position:relative;align-items:center}
.moj-rpg-row.act{background:rgba(255,255,255,.08);border-radius:4px}
.moj-rpg-row.down{color:#ff8a8a}
.moj-rpg-row .n small,.moj-rpg-field small{opacity:.7;font-size:11px;margin-left:5px}
.moj-rpg-row .v{font-variant-numeric:tabular-nums;text-align:right}
.moj-rpg-pop{position:absolute;left:50%;top:-4px;transform:translateX(-50%);font-weight:800;font-size:18px;text-shadow:0 1px 2px #000,0 0 6px #000;pointer-events:none;animation:moj-rpg-pop .9s ease-out forwards}
.moj-rpg-pop.heal{color:#7dffa5}.moj-rpg-pop.miss{color:#c9c9c9;font-size:14px}
@keyframes moj-rpg-pop{0%{opacity:0;margin-top:6px}15%{opacity:1}100%{opacity:0;margin-top:-26px}}
.moj-rpg-field{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(680px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;display:flex;gap:12px}
.moj-rpg-field .mem{width:200px;flex:none}
.moj-rpg-field .pane{flex:1;min-width:0}
.moj-rpg-field .tabs{display:flex;gap:4px;margin-bottom:8px}
.moj-rpg-field .tab{padding:2px 10px;border:1px solid var(--moj-line,#c9d3ff);border-radius:999px;font-size:12px;opacity:.65;cursor:pointer}
.moj-rpg-field .tab.sel{opacity:1;background:var(--moj-accent,#ffd76a);color:var(--moj-panel,#0e163a);border-color:var(--moj-accent,#ffd76a)}
.moj-rpg-field table{border-collapse:collapse;font-size:13px}.moj-rpg-field td{padding:1px 10px 1px 0}
.moj-rpg-field .note{font-size:12px;opacity:.75;margin-top:6px}
@media (max-width:560px){.moj-rpg-bottom{flex-direction:column}.moj-rpg-cmd{width:auto;min-height:0}.moj-rpg-msg{bottom:auto;top:76px}.moj-rpg-field{flex-direction:column}.moj-rpg-field .mem{width:auto}}
`;

// (:where keeps the defaults below the world's UI guide: its register and border rules, .moj-hud .moj-w, win)

/**
 * The page: run in the events channel's scope (it reads __busState, __inputQueue). cfg: EVENTS.rpg; K: the kernel.
 * → { step(t), … } the frame's step, and the handles window.__mojRpg exposes.
 */
export function rpgPage(cfg, K, ctl) {
  const R = K.init(cfg), V = () => __busState.vars;
  K.mirror(cfg, R, V());
  const st = document.createElement('style'); st.textContent = RPG_CSS_TEXT; document.head.appendChild(st);
  const root = document.createElement('div'); root.className = 'moj-hud moj-rpg'; document.body.appendChild(root);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const CMD = { attack: 'Attack', skill: 'Skill', item: 'Item', guard: 'Guard', flee: 'Flee' };
  const WHY = { battle: 'Not during a fight.', rules: 'Classes are fixed here.', same: 'Already that class.', locked: 'That class is not open yet.', member: 'Not a class they can take.', sp: 'Not enough class points.', requires: 'Learn what it builds on first.', learned: 'Already learned.', class: 'Take that class first.', unknown: '' };
  const BEAT = 650;
  // mode: null | 'battle' | 'field'; the battle's own phase: intro | command | play | end
  let mode = null, phase = null, beats = [], bi = 0, bt = 0, shown = {}, msg = '', picks = {}, mi = 0, level = 'cmd', f = 0, pend = null, pops = [], dirty = true;
  let fm = 0, ftab = 0, flevel = 'members', ff = 0, fmsg = '', seen = 0, walked = 0, lastPos = null, rolls = 0, lastT = 0;
  const TABS = ['Status', 'Class', 'Equip', 'Skills'], SLOT = { weapon: 'Weapon', armor: 'Armor', accessory: 'Accessory' };
  let fslot = null;   // the Equip tab's slot being chosen for
  // CARRIED (the party mechanic: the level contract's game.party): the roster loaded as the level starts, and each
  // number that changed since put back as a setStat after a fight, a class switch, a skill bought, a rest
  const carry = { hooked: false, slice: null, sent: null };
  function hookCarry() {
    const G = window.__mojGame;
    if (carry.hooked || !G) return;
    carry.hooked = true;
    const P = G.contract && G.contract.party;
    if (!P || typeof P.slice !== 'string') return;
    carry.slice = P.slice;
    G.onStart(function (params) {
      const sl = params && params[P.slice];
      if (sl && sl.roster) K.load(cfg, R, sl.roster, V());
      carry.sent = K.save(cfg, R); dirty = true;
    });
  }
  function keep() {
    const G = window.__mojGame;
    if (!carry.slice || !G || !carry.sent) return;
    const now = K.save(cfg, R);
    for (const m in now) {
      for (const k in now[m]) if (!carry.sent[m] || carry.sent[m][k] !== now[m][k]) G.emit({ type: 'setStat', slice: carry.slice, id: m, stat: k, value: now[m][k] });
      // a number gone (an item taken off): 0, so the store forgets it
      for (const k in carry.sent[m] || {}) if (!(k in now[m]) && carry.sent[m][k] !== 0) G.emit({ type: 'setStat', slice: carry.slice, id: m, stat: k, value: 0 });
    }
    carry.sent = now;
  }
  // THE BAG: what the kernel moves in or out of it (a fight's spoils and items used, gear worn or taken off) said on the
  // bus as every bag transfer is (in:bag:<item>:<n> / out:…), so the bag mechanic carries it. Counted from just before.
  let bagSnap = null;
  const bagNow = () => { const v = V(), out = {}; for (const k in v) if (k.indexOf('held:bag:') === 0) out[k.slice(9)] = Number(v[k]) || 0; return out; };
  function bagFrom() { bagSnap = bagNow(); }
  function bagSay() {
    if (!bagSnap) return;
    const now = bagNow();
    for (const k of Object.keys(Object.assign({}, bagSnap, now))) { const d = (now[k] || 0) - (bagSnap[k] || 0); if (d) __inputQueue.push({ type: (d > 0 ? 'in' : 'out') + ':bag:' + k + ':' + Math.abs(d) }); }
    bagSnap = null;
  }

  const memberName = (id) => { for (const p of cfg.party) if (p.id === id) return p.name; return id; };
  // who picks now: every standing member in rounds; on the timeline, the one whose turn it is
  const commanders = () => (!R.b ? [] : R.b.turn !== undefined ? (R.b.turn != null ? [R.b.turn] : []) : R.b.ids.filter((m) => R.m[m].hp > 0 && !R.b.side[m].st.sleep));
  const busy = () => (window.__mojMenus && window.__mojMenus.open && window.__mojMenus.open()) || (window.__mojScenes && window.__mojScenes.on && window.__mojScenes.on());

  // ── the battle ──
  function startBattle(enc) {
    if (R.b || mode === 'battle') return false;
    if (mode === 'field') closeField();
    bagFrom();
    const out = K.start(cfg, R, enc, V());
    if (!out.length) return false;
    mode = 'battle'; phase = 'intro'; beats = out; bi = 0; bt = 0; shown = {}; picks = {}; mi = 0; level = 'cmd'; f = 0; pend = null;
    msg = out[0].text; dirty = true;
    return true;
  }
  function pickNow(pick) {
    const ids = commanders(), m = ids[mi];
    picks[m] = pick;
    if (pick.act === 'flee') return resolve();
    mi++; level = 'cmd'; f = 0; pend = null;
    if (mi >= ids.length) return resolve();
    dirty = true;
  }
  function resolve() {
    // the round is played back from where it began: each beat moves the numbers it names, nothing else jumps ahead
    const before = {};
    for (const x of R.b.foes) before[x.uid] = x.hp;
    for (const m of R.b.ids) { before[m] = R.m[m].hp; before[m + ':mp'] = R.m[m].mp; }
    const out = K.round(cfg, R, picks, V());
    picks = {}; mi = 0; level = 'cmd'; f = 0; pend = null;
    beats = out; bi = 0; bt = 0; phase = 'play'; shown = before;
    if (out.length) msg = out[0].text, pop(out[0]), note(out[0]);
    dirty = true;
  }
  function note(b) { if (b && b.target != null && b.hp != null) shown[b.target] = b.hp; if (b && b.who != null && b.mp != null) shown[b.who + ':mp'] = b.mp; }
  function pop(b) {
    if (!b || b.target == null) return;
    const txt = b.kind === 'miss' ? 'miss' : b.kind === 'hurt' ? String(b.amount) : b.kind === 'heal' && b.amount ? '+' + b.amount : '';
    if (txt) pops.push({ at: b.target, txt, cls: b.kind === 'heal' ? 'heal' : b.kind === 'miss' ? 'miss' : '' });
  }
  function advance() {
    if (phase === 'intro') { phase = 'command'; msg = ''; dirty = true; if (!commanders().length) resolve(); return; }
    if (phase === 'play') {
      bi++; bt = 0;
      if (bi < beats.length) { msg = beats[bi].text; pop(beats[bi]); note(beats[bi]); dirty = true; return; }
      shown = {};
      if (R.b.phase === 'command') { phase = 'command'; msg = ''; if (!commanders().length) return resolve(); }
      else phase = 'end';
      dirty = true; return;
    }
    if (phase === 'end') {
      const ev = K.close(cfg, R, V());
      keep(); bagSay();
      for (const e of ev) __inputQueue.push(e);
      mode = null; phase = null; root.classList.remove('on'); root.innerHTML = '';
      release(); dirty = true;
    }
  }
  function cmdList() {
    const ids = commanders(), m = ids[mi], o = K.options(cfg, R, m, V());
    if (level === 'cmd') return o.commands.map((c) => ({ label: CMD[c.id], ok: c.ok, go: () => {
      if (c.id === 'guard' || c.id === 'flee') return pickNow({ act: c.id });
      if (c.id === 'attack') return toTarget({ act: 'attack' });
      level = c.id; f = 0; dirty = true;
    } }));
    if (level === 'skill') return o.skills.map((s) => ({ label: s.name, right: s.mp ? s.mp + ' MP' : '', ok: s.ok, go: () => toTarget({ act: 'skill', skill: s.id }) }));
    if (level === 'item') return o.items.map((it) => ({ label: it.name, right: '×' + it.count, ok: true, go: () => toTarget({ act: 'item', item: it.id }) }));
    return K.targets(cfg, R, pend).map((t) => ({ label: t.name, ok: true, target: t.id, go: () => pickNow(Object.assign({}, pend, { target: t.id })) }));
  }
  function toTarget(pick) {
    const ts = K.targets(cfg, R, pick);
    if (!ts.length) { const aim = K.aimOf(cfg, pick); return pickNow(Object.assign({}, pick, { target: aim === 'self' ? commanders()[mi] : null })); }
    pend = pick; level = 'target'; f = 0; dirty = true;
  }
  function back() {
    if (level === 'target') { level = pend.act === 'attack' ? 'cmd' : pend.act; f = 0; pend = null; }
    else if (level !== 'cmd') { level = 'cmd'; f = 0; }
    else if (mi > 0) { mi--; delete picks[commanders()[mi]]; f = 0; }
    dirty = true;
  }

  function drawBattle() {
    const b = R.b, L = phase === 'command' ? cmdList() : [];
    if (phase === 'command') f = Math.max(0, Math.min(f, L.length - 1));
    const aimAt = phase === 'command' && level === 'target' && L[f] ? L[f].target : null, active = phase === 'command' ? commanders()[mi] : null;
    let h = '<div class="moj-w moj-rpg-foes">';
    if (b) b.foes.forEach((x) => {
      const hp = shown[x.uid] != null ? shown[x.uid] : x.hp;
      h += '<div class="moj-rpg-foe' + (hp <= 0 ? ' down' : '') + (aimAt === x.uid ? ' on-f' : '') + '" data-aim="' + x.uid + '">' + esc(x.name) + (cfg.rules.foeHp === 'bar' ? '<div class="bar"><i style="width:' + Math.round(100 * Math.max(0, hp) / x.max) + '%"></i></div>' : '') + popsFor(x.uid) + '</div>';
    });
    const next = K.preview(cfg, R, 6);
    if (next.length) h += '<div class="moj-rpg-turns">' + next.map((x) => '<span class="' + (x.party ? 'p' : 'f') + '">' + esc(x.name) + '</span>').join('') + '</div>';
    h += '</div>' + (msg ? '<div class="moj-w moj-rpg-msg">' + esc(msg) + '</div>' : '') + '<div class="moj-rpg-bottom"><div class="moj-w moj-rpg-cmd">';
    if (phase === 'command') {
      h += '<div class="t">' + esc(memberName(active)) + (level !== 'cmd' ? ' · ' + (level === 'target' ? 'target' : CMD[level]) : '') + '</div>';
      L.forEach((o, i) => { h += '<div class="opt' + (o.ok ? '' : ' off') + (i === f ? ' on-f' : '') + '" data-i="' + i + '"><span>' + esc(o.label) + '</span><span>' + esc(o.right || '') + '</span></div>'; });
      if (!L.length) h += '<div class="opt off">—</div>';
    } else h += '<div class="t">&nbsp;</div>';
    h += '</div><div class="moj-w moj-rpg-party">';
    if (b) for (const m of b.ids) {
      const M = R.m[m], S = K.statsOf(cfg, R, m), hp = shown[m] != null ? shown[m] : M.hp, mp = shown[m + ':mp'] != null ? shown[m + ':mp'] : M.mp;
      const s = b.side[m].st, tag = M.poison ? ' psn' : s.sleep ? ' slp' : s.silence ? ' sil' : '';
      h += '<div class="moj-rpg-row' + (m === active ? ' act' : '') + (hp <= 0 ? ' down' : '') + (aimAt === m ? ' on-f' : '') + '" data-aim="' + m + '"><span class="n">' + esc(memberName(m)) + '<small>' + esc(cfg.classes[M.cls].name) + tag + '</small></span><span class="v">' + hp + '/' + S.hp + ' HP</span><span class="v">' + mp + '/' + S.mp + ' MP</span>' + popsFor(m) + '</div>';
    }
    root.innerHTML = h + '</div></div>';
    pops = [];
  }
  function popsFor(id) { return pops.filter((p) => p.at === id).map((p) => '<span class="moj-rpg-pop ' + p.cls + '">' + esc(p.txt) + '</span>').join(''); }

  // ── the party menu ──
  function openField() {
    if (mode || busy()) return;
    mode = 'field'; flevel = 'members'; ff = 0; fmsg = ''; dirty = true;
  }
  function closeField() { mode = null; root.classList.remove('on'); root.innerHTML = ''; release(); }
  const members = () => K.partyOf(cfg, R, V());
  function fieldRows() {
    const id = members()[fm];
    if (!id) return [];
    if (TABS[ftab] === 'Class') return K.classesOf(cfg, R, id, V()).map((c) => ({ label: c.name, right: c.current ? 'current' : !c.open ? 'locked' : c.rank ? 'rank ' + c.rank : 'new', ok: c.open && !c.current, go: () => { bagFrom(); const why = K.switchClass(cfg, R, id, c.id, V()); bagSay(); fmsg = why ? WHY[why] || why : memberName(id) + ' is now a ' + c.name + '.'; if (!why) { keep(); __inputQueue.push({ type: 'rpg-class:' + id + ':' + c.id }); } } }));
    if (TABS[ftab] === 'Equip') {
      const G = K.gearOf(cfg, R, id, V());
      if (!fslot) return G.map((g) => ({ label: SLOT[g.slot], right: g.name || '—', ok: true, go: () => { fslot = g.slot; ff = 0; } }));
      const g = G.find((x) => x.slot === fslot);
      const wear = (fn) => () => { bagFrom(); const why = fn(); bagSay(); if (!why) keep(); fmsg = why ? WHY[why] || why : ''; fslot = null; ff = 0; };
      return [{ label: '—', right: '', ok: !!g.item, go: wear(() => K.unequip(cfg, R, id, fslot, V())) }, ...g.can.map((c) => ({ label: c.name, right: '×' + c.count, ok: true, go: wear(() => K.equip(cfg, R, id, c.item, V())) }))];
    }
    if (TABS[ftab] === 'Skills') return K.treeOf(cfg, R, id).map((e) => ({
      label: e.name, ok: e.state === 'buy', dim: e.state === 'locked' || e.state === 'later',
      right: e.state === 'learned' ? '✓' : e.state === 'buy' ? e.cost + ' CP' : e.state === 'later' ? 'rank ' + e.at : e.why === 'requires' ? 'needs ' + e.need.map((n) => cfg.skills[n].name).join(', ') : e.cost + ' CP',
      go: () => { const why = K.buy(cfg, R, id, e.skill); fmsg = why ? WHY[why] || why : memberName(id) + ' learned ' + e.name + '.'; if (!why) keep(); },
    }));
    return [];
  }
  function drawField() {
    const ids = members(), id = ids[fm], M = R.m[id];
    let h = '<div class="moj-w moj-rpg-field"><div class="mem"><div class="t">Party</div>';
    ids.forEach((m, i) => { const S = K.statsOf(cfg, R, m); h += '<div class="opt' + (i === fm && flevel === 'members' ? ' on-f' : '') + '" data-m="' + i + '"><span>' + esc(memberName(m)) + '<small>Lv ' + R.m[m].level + '</small></span><span>' + R.m[m].hp + '/' + S.hp + '</span></div>'; });
    h += '<div class="note">Gold ' + (V()[cfg.rules.gold] || 0) + '</div></div><div class="pane"><div class="tabs">';
    TABS.forEach((t, i) => { h += '<span class="tab' + (i === ftab ? ' sel' : '') + '" data-tab="' + i + '">' + t + '</span>'; });
    h += '</div>';
    if (M) {
      const S = K.statsOf(cfg, R, id), C = cfg.classes[M.cls], cl = M.cl[M.cls], next = M.level < cfg.rules.cap ? K.xpFor(cfg, M.level + 1) - M.xp : 0;
      if (TABS[ftab] === 'Status') {
        h += '<div class="t">' + esc(memberName(id)) + ' · ' + esc(C.name) + ' rank ' + cl.lv + '</div><table>';
        h += '<tr><td>Level</td><td>' + M.level + '</td><td>Next</td><td>' + next + ' XP</td></tr><tr><td>HP</td><td>' + M.hp + '/' + S.hp + '</td><td>MP</td><td>' + M.mp + '/' + S.mp + '</td></tr>';
        h += '<tr><td>Attack</td><td>' + S.atk + '</td><td>Defence</td><td>' + S.def + '</td></tr><tr><td>Magic</td><td>' + S.mag + '</td><td>Speed</td><td>' + S.spd + '</td></tr><tr><td>Class pts</td><td>' + cl.sp + '</td><td>' + (M.poison ? 'Poisoned' : '') + '</td><td></td></tr></table>';
        h += '<div class="note">' + (K.usable(cfg, R, id).map((s) => esc(cfg.skills[s].name)).join(', ') || '—') + '</div>';
        h += '<div class="note">' + (Object.values(M.gear).map((g) => esc(cfg.gear[g].name)).join(', ') || '—') + '</div>';
      } else {
        const rows = fieldRows();
        ff = Math.max(0, Math.min(ff, rows.length - 1));
        if (TABS[ftab] === 'Skills') h += '<div class="t">' + esc(C.name) + ' · ' + cl.sp + ' CP</div>';
        if (TABS[ftab] === 'Equip' && fslot) h += '<div class="t">' + SLOT[fslot] + '</div>';
        rows.forEach((o, i) => { h += '<div class="opt' + ((o.dim != null ? o.dim : !o.ok) ? ' off' : '') + (flevel === 'list' && i === ff ? ' on-f' : '') + '" data-i="' + i + '"><span>' + esc(o.label) + '</span><span>' + esc(o.right) + '</span></div>'; });
      }
    }
    h += (fmsg ? '<div class="note">' + esc(fmsg) + '</div>' : '') + '</div></div>';
    root.innerHTML = h;
  }

  // ── input ──
  // the menu control scheme (controls/schemes.js menu), the same keys and pad roles every menu answers to
  const KEYS = (ctl && ctl.keys) || {};
  function act(a) {
    if (a === 'tabNext' || a === 'tabPrev') { if (mode !== 'field') return; a = a === 'tabNext' ? 'right' : 'left'; }
    if (mode === 'battle') {
      if (phase !== 'command') { if (a === 'accept') advance(); return; }
      const L = cmdList(), n = L.length;
      if (a === 'up' && n) f = (f + n - 1) % n;
      else if (a === 'down' && n) f = (f + 1) % n;
      else if (a === 'accept' && L[f] && L[f].ok) L[f].go();
      else if (a === 'back') back();
      dirty = true; return;
    }
    if (mode === 'field') {
      const n = members().length, rows = fieldRows();
      if (flevel === 'members') {
        if (a === 'up' && n) fm = (fm + n - 1) % n;
        else if (a === 'down' && n) fm = (fm + 1) % n;
        else if (a === 'left') ftab = (ftab + TABS.length - 1) % TABS.length;
        else if (a === 'right') ftab = (ftab + 1) % TABS.length;
        else if (a === 'accept' && ftab > 0 && rows.length) { flevel = 'list'; ff = 0; fslot = null; }
        else if (a === 'back') return closeField();
      } else {
        if (a === 'up' && rows.length) ff = (ff + rows.length - 1) % rows.length;
        else if (a === 'down' && rows.length) ff = (ff + 1) % rows.length;
        else if (a === 'accept' && rows[ff]) { if (rows[ff].ok) rows[ff].go(); else fmsg = ''; }
        else if (fslot && (a === 'back' || a === 'left' || a === 'right')) { if (a === 'back') { fslot = null; ff = 0; } }
        else if (a === 'back' || a === 'left' || a === 'right') { flevel = 'members'; if (a !== 'back') ftab = (ftab + (a === 'right' ? 1 : TABS.length - 1)) % TABS.length; }
      }
      fmsg = a === 'accept' ? fmsg : '';
      dirty = true;
    }
  }
  window.addEventListener('keydown', (ev) => {
    if (ev.code === 'KeyP' && !ev.repeat) {
      if (mode === 'field') { ev.preventDefault(); ev.stopImmediatePropagation(); return closeField(); }
      if (!mode) { openField(); if (mode) { ev.preventDefault(); ev.stopImmediatePropagation(); } return; }
    }
    if (!mode) return;
    const a = KEYS[ev.code];
    ev.preventDefault(); ev.stopImmediatePropagation();
    if (a && !ev.repeat) act(a);
  }, true);
  root.addEventListener('click', (ev) => {
    if (!mode) return;
    const o = ev.target.closest('[data-i]'), t = ev.target.closest('[data-tab]'), m = ev.target.closest('[data-m]'), aim = ev.target.closest('[data-aim]');
    if (mode === 'battle') {
      if (phase !== 'command') return advance();
      if (o) { f = Number(o.getAttribute('data-i')); act('accept'); return; }
      if (aim && level === 'target') { const L = cmdList(), i = L.findIndex((x) => x.target === aim.getAttribute('data-aim')); if (i >= 0) { f = i; act('accept'); } }
      return;
    }
    if (t) { ftab = Number(t.getAttribute('data-tab')); flevel = 'members'; fslot = null; dirty = true; return; }
    if (m) { fm = Number(m.getAttribute('data-m')); flevel = 'members'; fslot = null; dirty = true; return; }
    if (o) { ff = Number(o.getAttribute('data-i')); flevel = 'list'; act('accept'); }
  });

  // the pad: the first connected one, read in its own printed layout; an action fires on the press edge, and its
  // select button opens and closes the party menu
  let padPrev = {};
  function padNow() {
    const ps = navigator.getGamepads ? navigator.getGamepads() : [], now = {};
    let g = null;
    for (let i = 0; i < ps.length; i++) if (ps[i] && ps[i].connected) { g = ps[i]; break; }
    if (!g || !ctl) return now;
    const P = ctl.pad[ctl.layout(g.id)] || ctl.pad.xbox || {};
    for (const i in P.b || {}) { const b = g.buttons[i]; if (b && (b.pressed || b.value > 0.5)) now[P.b[i]] = 1; }
    for (const [ax, sg, a] of P.a || []) if ((g.axes[ax] || 0) * sg > 0.6) now[a] = 1;
    const sb = g.buttons[ctl.select];
    if (sb && sb.pressed) now.party = 1;
    return now;
  }
  function pad() {
    const now = padNow();
    for (const a in now) if (!padPrev[a]) {
      if (a === 'party') { if (mode === 'field') closeField(); else if (!mode) openField(); }
      else if (mode) act(a);
    }
    padPrev = now;
  }

  function hold() { window.__mojFreeze = true; window.__mojMenuOpen = true; }
  function release() { window.__mojFreeze = false; window.__mojMenuOpen = false; }

  // ── the bus, and the walk ──
  // the bus's new events: joins, openings and rests first, then a battle (the bus sorts what arrives together, so a
  // cue's join and its fight may come in either order)
  function listen() {
    const log = __busState.log, fights = [];
    for (let i = seen; i < log.length; i++) {
      const ty = log[i] && log[i].type;
      if (typeof ty !== 'string' || ty.indexOf('rpg-') !== 0) continue;
      if (ty.indexOf('rpg-battle:') === 0) fights.push(ty.slice(11));
      else if (ty === 'rpg-rest') { K.rest(cfg, R, V()); keep(); }
      else if (ty.indexOf('rpg-join:') === 0) { R.joined[ty.slice(9)] = 1; keep(); }
      else if (ty.indexOf('rpg-open:') === 0) { R.opened[ty.slice(9)] = 1; keep(); }
    }
    seen = log.length;
    for (const enc of fights) startBattle(enc);
  }
  function walk() {
    const Rn = cfg.random, w = window.__mojCtrl && window.__mojCtrl.world;
    if (!Rn || !w || mode || window.__mojFreeze || busy()) { lastPos = null; return; }
    const e = (w.pilotId && w.byId[w.pilotId]) || w.entities[0];
    if (!e || !e.transform) return;
    const p = e.transform.pos;
    if (lastPos) {
      const d = Math.hypot(p[0] - lastPos[0], p[1] - lastPos[1]);
      const inZone = !Rn.in.length || Rn.in.some((z) => Math.hypot(p[0] - z.at[0], p[1] - z.at[1]) <= z.r);
      if (d < 5 && inZone) walked += d;
      if (walked >= Rn.after + Rn.every * (rolls + 1)) {
        rolls++;
        const dice = { r: (cfg.seed * 2654435761 + rolls * 40503) >>> 0 };
        const roll = K.roll(dice), set = Rn.sets[Math.floor(K.roll(dice) * Rn.sets.length)];
        if (roll < Rn.chance) { lastPos = null; startBattle({ id: 'random', foes: set }); return; }
      }
    }
    lastPos = [p[0], p[1]];
  }

  function step(t) {
    const now = typeof t === 'number' ? t : 0, dt = lastT ? Math.max(0, Math.min(now - lastT, 1000)) : 0;   // real time: a slow frame still moves the playback on
    lastT = now;
    hookCarry();
    listen();
    if (typeof navigator !== 'undefined') pad();
    walk();
    if (mode === 'battle' && (phase === 'intro' || phase === 'play')) { bt += dt; if (bt >= BEAT) advance(); }
    if (mode) { hold(); root.classList.add('on'); }
    if (mode && (dirty || pops.length)) { if (mode === 'battle') drawBattle(); else drawField(); dirty = false; }
  }
  const api = {
    step, R,
    state: () => ({ mode, phase, msg, level, member: mode === 'battle' && phase === 'command' ? commanders()[mi] : null, options: mode === 'battle' && phase === 'command' ? cmdList().map((o) => ({ label: o.label, ok: o.ok })) : [] }),
    start: startBattle, act, advance, open: openField, close: () => (mode === 'field' ? closeField() : null),
  };
  window.__mojRpg = api;
  return api;
}

/** The channel's script, inside the events channel: the kernel, the page, its step called each frame (`__stepRpg`). */
export function rpgScript() {
  const { keys, pad } = menuControls();
  return `
// RPG: party battles over the field, the party menu on P (playscape/rpg)
const RPG_CSS_TEXT = ${JSON.stringify(RPG_CSS)};
const __rpg = (${rpgPage.toString()})(EVENTS.rpg, (${buildRpg.toString()})(), { keys: ${JSON.stringify(keys)}, pad: ${JSON.stringify(pad)}, layout: ${padLayoutSource()}, select: ${DEVICES.gamepad.buttons.select} });
function __stepRpg(t) { __rpg.step(t); }`;
}
