/**
 * THE TABLE RPG KERNEL — a pen-and-paper game played in text: a party rolled from a rules card (table-rpg-systems.js),
 * a world of places and roads, dungeons of rooms, links, locks and keys, foes by rank, tables and an oracle, played by
 * typed commands, every die rolled in the open and said in the transcript. No picture is needed to play it; a page or
 * an engine draws over the same state later.
 *
 * SINGLE SOURCE OF TRUTH, the tabletop kernel's discipline (tabletop/tabletop-kernel.js): everything lives inside
 * `buildTableRpg()`, a closure referencing nothing outside itself, so a page can play the same code by emitting
 * `buildTableRpg.toString()`. Pure: no clock, no Math.random; the dice are mulberry32 on the state (`S.r`), so the same
 * module and the same commands are the same game to the byte. `apply` returns a new state and the lines it said.
 *
 *   module: {
 *     title?, seed?, system: <a card (table-rpg-systems.js systemOf)>,
 *     hook?: 'the scenario in a breath', goal: { item } | { room: '<dungeon>/<room>' } | { place } | { cleared: '<dungeon>/<room>' } | { flag },
 *     ending?: 'said when the goal is met',
 *     party: [{ id, name?, class? | role?, method?, assign?: [ability], scores?: { ability: n }, level?, persona? }]
 *       1 to 6; `role` the portable word (an egocube role: frontline, flanker, support, controller, caster, ranged,
 *       non-combatant), played as the system's first class that takes it
 *     world: { start, places: [{ id, name?, kind?: 'town' | 'wild' | 'dungeon' | 'landmark', text?, dungeon? }],
 *              routes?: [{ a, b, days?, danger?: <table id> }] }
 *     dungeons?: { <id>: { name?, entry, wander?: <table id>, rooms: [room], links: [link] } }
 *       room: { id, name?, text?, foes?: [foe id], items?: [item id | { item, hidden: true }],
 *               trap?: { faculty, difficulty?, harm: <rank 1–5> | <dice>, text? }, search?: <difficulty> }
 *       link: { a, b, kind?: 'open' | 'door' | 'stair' | 'locked' | 'secret', key?: <item id>, force?: <difficulty>,
 *               oneWay?: true, search?: <difficulty> }
 *     foes?: { <id>: { name?, rank: 1–5, text?, stats?: { hp, defence, attack, damage, xp }, faction?,
 *                     heeds?: [talk], scorns?: [talk] } }
 *     factions?: { <id>: { name?, text?, standing?: −2 … 2, allies?: [faction], rivals?: [faction] } }
 *     items?: { <id>: { name?, kind?: 'key' | 'treasure' | 'heal', heal?: 'some' | 'all' | <dice>, text? } }
 *     tables?: { <id>: { name?, die, rows: [{ on: n | [lo, hi], text, foes?: [foe id], item? }] } }
 *     beats?: [{ id, at: '<place>' | '<dungeon>/<room>', text, sets?: <flag>, milestone?: true }]
 *   }
 *   FACTIONS AND TALK. A fight is spoken to through its leader, the highest-ranked foe standing who belongs to a faction:
 *   on a member's turn it may parley (presence), threaten (might) or bribe with a treasure (presence), once a fight. The
 *   faction's standing sets the difficulty (hostile will not hear, wary hard, neutral medium, friendly easy; an allied
 *   faction's foes stand aside unasked), a step easier for a talk the leader heeds, a step harder for one it scorns.
 *   A success and they stand aside (the room is passed, the foes' experience earned): a parley or a bribe raises the
 *   standing, a threat lowers it; at a cost they stand aside and nothing changes (a threat: the leader strikes first);
 *   a failure and the fight goes on, a fumble lowering the standing too. Foes beaten lower their faction and its allies
 *   a step and raise its rivals one.
 *   Portable words (the system says them in its own numbers): a faculty (might, agility, grit, wits, insight, presence,
 *   stealth, or one of the system's own abilities), a difficulty (easy | medium | hard, or the system's own number: a DC,
 *   a shift, a rung, a percent), a foe's rank (and a trap's harm as the harm of a foe of that rank), a member's role, a
 *   heal of 'some' (half the hit points) or 'all'.
 *
 *   roll(S, '2d6+1') → { total, text, nat, faces }     notation: NdS, d%, dF, kh|kl|dh|dl n, ! (explode), + − n, terms
 *   sheet(system, member, seed) → the member's sheet  { id, name, class, level, xp, scores, mods, hp, maxHp, defence,
 *                                  weapon, method, rolls: [text] }   rolled on its own stream: one member's dice never
 *                                  move another's
 *   K = compile(module)          the module checked and indexed, its party rolled (throws, teaching)
 *   { S, lines } = start(K)      the opening: the hook and where the party stands
 *   legal(K, S) → [move]         move: { name, verb, … } — what may be typed now (a template's name says `<…>`)
 *   parse(K, S, text) → move | null
 *   { S, lines } = apply(K, S, move)
 *   act(K, S, text) → { S, lines }   parse then apply, or a line saying what can be typed
 *   describe(K, S) → lines        where the party is, what is there, the ways on
 *   tape(seed, die, n) → [n]      a dice tape: the rolls an agent referee reads in order, so a game it runs in prose is
 *                                 as fair and as repeatable as this one
 *   resolve(K, S, pc, faculty, difficulty) → { band, total, text }   band: crit | success | partial | fail | fumble
 *
 *   S: { r, at: { place, dungeon?, room? }, from, party: [{ id, hp, maxHp, level, xp, marks, scores, mods }], bag,
 *        flags, open, found, taken, cleared, searched, seen, sprung, beats, wounds, standing, day, fight, over, turn }
 *   over: null | { won: bool, reason }
 */

export function buildTableRpg() {
  const FACULTY = ['might', 'agility', 'grit', 'wits', 'insight', 'presence', 'stealth'];
  const DIFF = ['easy', 'medium', 'hard'];
  const BANDS = { crit: 'a critical', success: 'a success', partial: 'a success at a cost', fail: 'a failure', fumble: 'a fumble' };
  const GOOD = { crit: 1, success: 1, partial: 1 };
  const TALK = { parley: 'presence', threaten: 'might', bribe: 'presence' };
  const STANDING = ['hostile', 'wary', 'neutral', 'friendly', 'allied'];   // −2 … 2

  // ── dice ────────────────────────────────────────────────────────────────────────────────────────────────────────────
  function hash(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h | 0; }
  function rnd(S) {
    const a = (S.r + 0x6d2b79f5) | 0; S.r = a;
    let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const die = (S, n) => 1 + Math.floor(rnd(S) * n);

  const TERM = /^(\d*)d(\d+|%|f)(?:(kh|kl|dh|dl|k|d)(\d+))?(!)?$/;
  function parseDice(expr) {
    const src = String(expr).toLowerCase().replace(/\s+/g, '');
    if (!src || !/^[+-]?[0-9dfkhl%!]+([+-][0-9dfkhl%!]+)*$/.test(src)) throw new Error(`dice: '${expr}' is not dice (2d6+1, 4d6kh3, d20, d%, 4dF, 2d20kl1, 1d6!)`);
    const terms = [];
    for (const [, sign, body] of src.matchAll(/([+-]?)([^+-]+)/g)) {
      const s = sign === '-' ? -1 : 1;
      if (/^\d+$/.test(body)) { terms.push({ s, flat: +body }); continue; }
      const m = body.match(TERM);
      if (!m) throw new Error(`dice: '${body}' in '${expr}' is not a term (NdS, d%, dF, kh/kl/dh/dl n, !)`);
      const n = m[1] === '' ? 1 : +m[1], sides = m[2] === '%' ? 100 : m[2] === 'f' ? 'F' : +m[2];
      if (!(n >= 1 && n <= 100)) throw new Error(`dice: ${n} dice in '${body}' (1 to 100)`);
      if (sides !== 'F' && !(sides >= 2 && sides <= 1000)) throw new Error(`dice: a d${sides} in '${body}' (2 to 1000 sides)`);
      let keep = null;
      if (m[3]) {
        const k = +m[4], op = m[3] === 'k' ? 'kh' : m[3] === 'd' ? 'dl' : m[3];
        if (!(k >= 1 && k <= n)) throw new Error(`dice: '${body}' keeps or drops ${k} of ${n}`);
        keep = op === 'kh' ? { hi: k } : op === 'kl' ? { lo: k } : op === 'dl' ? { hi: n - k } : { lo: n - k };
        if ((keep.hi ?? keep.lo) < 1) throw new Error(`dice: '${body}' drops every die`);
      }
      if (m[5] && sides === 'F') throw new Error(`dice: fudge dice do not explode ('${body}')`);
      terms.push({ s, n, sides, keep, explode: !!m[5], src: body });
    }
    return terms;
  }

  function roll(S, expr) {
    const terms = parseDice(expr);
    let total = 0; const parts = [], faces = [];
    let nat = null;
    for (const t of terms) {
      if (t.flat !== undefined) { total += t.s * t.flat; parts.push((t.s < 0 ? '−' : '+') + t.flat); continue; }
      const got = [];
      for (let i = 0; i < t.n; i++) {
        if (t.sides === 'F') { got.push(die(S, 3) - 2); continue; }
        let v = die(S, t.sides), sum = v, boom = 0;
        while (t.explode && v === t.sides && boom < 20) { v = die(S, t.sides); sum += v; boom++; }
        got.push(sum);
      }
      let kept = got.map((v, i) => i);
      if (t.keep) {
        const order = got.map((v, i) => i).sort((a, b) => (t.keep.hi ? got[b] - got[a] : got[a] - got[b]) || a - b);
        const keep = new Set(order.slice(0, t.keep.hi ?? t.keep.lo));
        kept = kept.filter((i) => keep.has(i));
      }
      const keptSet = new Set(kept), sum = kept.reduce((a, i) => a + got[i], 0);
      total += t.s * sum;
      faces.push(...kept.map((i) => got[i]));
      if (nat === null && kept.length === 1 && t.sides !== 'F') nat = got[kept[0]];
      const shown = got.map((v, i) => (t.sides === 'F' ? (v > 0 ? '+' : v < 0 ? '−' : '0') : String(v)) + (keptSet.has(i) ? '' : '×')).join(' ');
      parts.push((t.s < 0 ? '−' : parts.length ? '+' : '') + `[${shown}]`);
    }
    return { total, nat, faces, text: `${String(expr).replace(/\s+/g, '')} → ${parts.join(' ')} = ${total < 0 ? `−${-total}` : total}` };
  }

  function tape(seed, sides, n) {
    const S = { r: hash(`${seed}|tape-v1|d${sides}`) };
    return Array.from({ length: n }, () => die(S, sides));
  }

  // ── words ───────────────────────────────────────────────────────────────────────────────────────────────────────────
  const no = (m) => { throw new Error(`table rpg: ${m}`); };
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const words = (s) => String(s).replace(/[-_]/g, ' ').replace(/^./, (c) => c.toUpperCase());
  const cap = (s) => String(s).replace(/^./, (c) => c.toUpperCase());
  const slug = (s) => String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const list = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
  const signed = (n) => (n < 0 ? `−${-n}` : `+${n}`);
  const num = (n) => (n < 0 ? `−${-n}` : String(n));
  const clone = (S) => JSON.parse(JSON.stringify(S));
  const ID = /^[a-z0-9][a-z0-9-]*$/;

  // ── the system ──────────────────────────────────────────────────────────────────────────────────────────────────────
  function modOf(sys, score) {
    const M = sys.modifier || { kind: 'none' };
    if (M.kind === 'step') return Math.floor((score - M.base) / M.per);
    if (M.kind === 'table') { for (const [upto, m] of M.bands) if (score <= upto) return m; return M.bands[M.bands.length - 1][1]; }
    return score;
  }
  const abilityOf = (sys, f) => (sys.abilities.includes(f) ? f : sys.faculties[f]);
  // the card's trained bonus at a level (none when the card has none)
  function trained(sys, level) { const T = sys.check.trained; return T ? T.base + Math.floor((Math.max(1, level) - 1) / T.every) : 0; }

  function checkSystem(sys) {
    const where = `system '${sys.name || '(written out)'}'`;
    if (!Array.isArray(sys.abilities) || !sys.abilities.length) no(`${where}: abilities are a list of ids`);
    for (const f of FACULTY) if (!sys.abilities.includes((sys.faculties || {})[f])) no(`${where}: faculty '${f}' names no ability`);
    if (!['target', 'under', 'bands', 'shifts', 'percent', 'challenge'].includes(sys.check?.kind)) no(`${where}: check.kind is target, under, bands, shifts, percent or challenge`);
    for (const d of DIFF) if (typeof sys.check.difficulty?.[d] !== 'number') no(`${where}: check.difficulty.${d} is a number`);
    if (!Array.isArray(sys.foes) || sys.foes.length !== 5) no(`${where}: foes are five ranks`);
    if (!isObj(sys.classes) || !Object.keys(sys.classes).length) no(`${where}: classes are { <id>: { priority, weapon } }`);
    for (const [id, c] of Object.entries(sys.classes)) {
      if (!Array.isArray(c.priority) || c.priority.length !== sys.abilities.length || !c.priority.every((a) => sys.abilities.includes(a))) no(`${where}: class '${id}' priority is every ability once, best first`);
      if (!isObj(c.weapon) || !FACULTY.includes(c.weapon.faculty)) no(`${where}: class '${id}' weapon is { name, dice | harm, faculty }`);
    }
    if (!isObj(sys.generate?.methods) || !sys.generate.methods[sys.generate.default]) no(`${where}: generate is { default, methods }`);
  }

  // ── a character sheet ───────────────────────────────────────────────────────────────────────────────────────────────
  function hpGain(sys, cls, scores, S, first) {
    const H = sys.hp;
    if (H.kind === 'die') {
      const m = modOf(sys, scores[H.ability]);
      if (first && !H.rolled) return { gain: Math.max(1, cls.hitDie + m), text: null };
      if (H.rolled) { const r = roll(S, `1d${cls.hitDie}`); return { gain: Math.max(1, r.total + m), text: `hit points ${r.text} ${signed(m)}` }; }
      return { gain: Math.max(1, Math.floor(cls.hitDie / 2) + 1 + m), text: null };
    }
    return { gain: 0, text: null };
  }
  function baseHp(sys, scores) {
    const H = sys.hp;
    if (H.kind === 'fixed') return H.value;
    if (H.kind === 'derived') return Math.max(1, Math.floor(H.of.reduce((a, k) => a + scores[k], 0) / H.div));
    return 0;
  }
  function defenceOf(sys, cls, scores) {
    if (sys.combat.defence !== 'armour') return 0;
    const A = cls.armour || { base: 10, dex: true };
    return A.base + (A.dex ? modOf(sys, scores[abilityOf(sys, 'agility')]) : 0);
  }

  function sheet(sys, p, seed) {
    const cls = sys.classes[p.class];
    if (!cls) no(`party member '${p.id}': no class '${p.class}' in ${sys.name} (${Object.keys(sys.classes).join(', ')})`);
    const method = p.method ?? sys.generate.default, M = sys.generate.methods[method];
    if (!M) no(`party member '${p.id}': no method '${method}' in ${sys.name} (${Object.keys(sys.generate.methods).join(', ')})`);
    const S = { r: hash(`${seed}|sheet-v1|${p.id}`) };
    const ab = sys.abilities, order = p.assign ?? cls.priority;
    if (p.assign !== undefined && (!Array.isArray(order) || order.length !== ab.length || !ab.every((a) => order.includes(a)))) no(`party member '${p.id}': assign lists every ability once, best first (${ab.join(', ')})`);
    const scores = {}, rolls = [];
    const short = (a) => (sys.names?.[a] ?? a).slice(0, 3);
    const place = (values) => {
      [...values].sort((a, b) => b - a).forEach((v, i) => { scores[order[i]] = v; });
      rolls.push(`placed best first: ${order.map((a) => `${short(a)} ${num(scores[a])}`).join(', ')}`);
    };
    if (M.dice) {
      const inOrder = M.order === 'in-order' && p.assign === undefined;
      const vals = ab.map((a, i) => { const r = roll(S, M.dice); rolls.push(`${inOrder ? short(a) : `#${i + 1}`} ${r.text}${M.scale ? ` × ${M.scale}` : ''}`); return r.total * (M.scale || 1); });
      if (inOrder) ab.forEach((a, i) => { scores[a] = vals[i]; }); else place(vals);
    } else if (M.values) {
      if (M.values.length !== ab.length) no(`${sys.name}: method '${method}' places ${M.values.length} values on ${ab.length} abilities`);
      place(M.values);
    } else if (M.budget !== undefined) {
      const want = p.scores ?? Object.fromEntries(order.map((a, i) => [a, Math.max(M.min, Math.min(M.max, [15, 14, 13, 12, 10, 8][i] ?? M.min))]));
      let spent = 0;
      for (const a of ab) {
        const v = want[a];
        if (!(Number.isInteger(v) && v >= M.min && v <= M.max)) no(`party member '${p.id}': ${a} is bought between ${M.min} and ${M.max}`);
        spent += M.cost[v]; scores[a] = v;
      }
      if (spent > M.budget) no(`party member '${p.id}': the scores cost ${spent} points, the budget is ${M.budget}`);
      rolls.push(`point buy: ${spent} of ${M.budget} points`);
    } else no(`${sys.name}: method '${method}' is dice, values or a budget`);
    const mods = Object.fromEntries(ab.map((a) => [a, modOf(sys, scores[a])]));
    const first = hpGain(sys, cls, scores, S, true);
    if (first.text) rolls.push(first.text);
    const out = {
      id: p.id, name: p.name ?? words(p.id), class: p.class, className: cls.name ?? words(p.class), level: 1, xp: 0, marks: 0,
      scores, mods, maxHp: baseHp(sys, scores) + first.gain, hp: 0, defence: defenceOf(sys, cls, scores), weapon: cls.weapon, method, rolls,
      ...(p.persona ? { persona: p.persona } : {}),
    };
    out.hp = out.maxHp;
    for (let l = 2; l <= (p.level ?? 1); l++) levelUp(sys, out, S, []);
    out.hp = out.maxHp;
    return out;
  }

  function levelUp(sys, pc, S, lines) {
    const cls = sys.classes[pc.class];
    pc.level += 1;
    const g = hpGain(sys, cls, pc.scores, S, false);
    let said;
    if (sys.hp.kind === 'die') { pc.maxHp += g.gain; pc.hp += g.gain; said = `${g.gain} more hit points${g.text ? ` (${g.text})` : ''}`; }
    else {
      const hi = (sys.range || [0, 99])[1], step = sys.check.kind === 'percent' ? 5 : 1;
      const a = cls.priority.find((x) => pc.scores[x] + step <= hi) ?? null;
      if (a) { pc.scores[a] += step; pc.mods[a] = modOf(sys, pc.scores[a]); said = `${sys.names?.[a] ?? a} rises to ${pc.scores[a]}`; }
      else said = 'every ability at its peak';
      if (sys.hp.kind === 'derived') { const was = pc.maxHp; pc.maxHp = baseHp(sys, pc.scores); pc.hp += pc.maxHp - was; }
    }
    lines.push(`${pc.name} reaches level ${pc.level}: ${said}.`);
  }

  // ── resolution ──────────────────────────────────────────────────────────────────────────────────────────────────────
  // difficulty: a word, or the system's own number (a DC, a shift, a rung, a percent)
  function diffOf(sys, d) {
    if (d === undefined || d === null) return { n: sys.check.difficulty.medium, word: 'medium' };
    if (typeof d === 'number') return { n: d, word: String(d) };
    if (!DIFF.includes(d)) no(`difficulty '${d}' is easy, medium or hard, or a number`);
    return { n: sys.check.difficulty[d], word: d };
  }
  // a check by a sheet: the faculty (or ability) the system rolls with, the difficulty, what the roll said
  function resolve(K, S, pc, faculty, difficulty, { vs } = {}) {
    const sys = K.sys, a = abilityOf(sys, faculty);
    if (!a) no(`'${faculty}' is a faculty (${FACULTY.join(', ')}) or an ability (${sys.abilities.join(', ')})`);
    const score = pc.scores[a], m = modOf(sys, score), D = diffOf(sys, difficulty), kind = sys.check.kind;
    const label = `${pc.name}, ${sys.names?.[a] ?? a}${FACULTY.includes(faculty) && faculty !== a ? ` (${faculty})` : ''}`;
    let band, total, text;
    if (kind === 'target') {
      const r = roll(S, '1d20');
      const prof = sys.classes[pc.class].priority.slice(0, 2).includes(a) ? trained(sys, pc.level) : 0;
      const dc = vs ?? D.n;
      total = r.total + m + prof;
      band = r.nat === 20 ? 'crit' : r.nat === 1 ? 'fumble' : total >= dc ? 'success' : 'fail';
      text = `${label}: ${r.text} ${signed(m)}${prof ? ` ${signed(prof)} trained` : ''} = ${num(total)} vs ${vs !== undefined ? 'defence' : 'target'} ${dc}`;
    } else if (kind === 'under') {
      const r = roll(S, '1d20'), target = score + (vs !== undefined ? 0 : D.n);
      total = r.total;
      band = r.nat === 1 ? 'crit' : r.nat === 20 ? 'fumble' : total <= target ? 'success' : 'fail';
      text = `${label}: ${r.text} under ${target}`;
    } else if (kind === 'bands') {
      const r = roll(S, '2d6');
      total = r.total + score + D.n;
      band = total >= 12 ? 'crit' : total >= 10 ? 'success' : total >= 7 ? 'partial' : 'fail';
      text = `${label}: ${r.text} ${signed(score)}${D.n ? ` ${signed(D.n)} ${D.word}` : ''} = ${num(total)}`;
    } else if (kind === 'shifts') {
      const r = roll(S, '4dF'), rung = vs ?? D.n;
      total = r.total + score;
      const shifts = total - rung;
      band = shifts >= 3 ? 'crit' : shifts > 0 ? 'success' : shifts === 0 ? 'partial' : 'fail';
      text = `${label}: ${r.text} ${signed(score)} = ${num(total)} vs ${rung} (${signed(shifts)} shifts)`;
      return { band, total, text: `${text}: ${BANDS[band]}.`, shifts };
    } else if (kind === 'percent') {
      const r = roll(S, '1d100'), want = typeof difficulty === 'number' ? difficulty : Math.max(1, Math.min(99, Math.floor(score * D.n)));
      total = r.total;
      band = total <= Math.max(1, Math.floor(want / 5)) ? 'crit' : total <= want ? 'success' : total >= (want < 50 ? 96 : 100) ? 'fumble' : 'fail';
      text = `${label}: ${r.text} under ${want}`;
    } else {   // challenge
      const a6 = roll(S, '1d6'), c = [die(S, 10), die(S, 10)];
      total = Math.min(10, a6.total + score + D.n);
      const beat = c.filter((x) => total > x).length, match = c[0] === c[1];
      band = beat === 2 ? (match ? 'crit' : 'success') : beat === 1 ? 'partial' : match ? 'fumble' : 'fail';
      text = `${label}: ${a6.text} ${signed(score)}${D.n ? ` ${signed(D.n)} ${D.word}` : ''} = ${num(total)} vs challenge [${c.join(' ')}]${match ? ' (a match)' : ''}`;
    }
    return { band, total, text: `${text}: ${BANDS[band]}.` };
  }

  // ── compile ─────────────────────────────────────────────────────────────────────────────────────────────────────────
  function compile(module) {
    if (!isObj(module)) no('a module is { system, party, world, dungeons?, foes?, items?, tables?, beats?, goal, hook? }');
    const sys = module.system;
    if (!isObj(sys)) no('system is a rules card (table-rpg-systems.js: a starter, or one written out)');
    checkSystem(sys);
    const seed = module.seed ?? 1;
    if (!Number.isInteger(seed) || seed < 0) no('seed is a whole number, 0 or more');
    const foes = module.foes ?? {}, items = module.items ?? {}, tables = module.tables ?? {}, dungeons = module.dungeons ?? {};
    const factions = module.factions ?? {};
    if (!isObj(factions)) no('factions is { <id>: { name?, text?, standing?: −2 … 2, allies?, rivals? } }');
    for (const [id, F] of Object.entries(factions)) {
      if (!ID.test(id)) no(`faction id '${id}' is lower case, digits and dashes`);
      if (F.standing !== undefined && !(Number.isInteger(F.standing) && F.standing >= -2 && F.standing <= 2)) no(`faction '${id}': standing is −2 (hostile) to 2 (allied)`);
      for (const k of ['allies', 'rivals']) for (const o of F[k] ?? []) if (!factions[o] || o === id) no(`faction '${id}': ${k} names '${o}', which is no other faction`);
    }
    for (const [id, f] of Object.entries(foes)) {
      if (!ID.test(id)) no(`foe id '${id}' is lower case, digits and dashes`);
      if (!(Number.isInteger(f.rank) && f.rank >= 1 && f.rank <= 5)) no(`foe '${id}': rank is 1 (a minion) to 5 (a boss)`);
      if (f.faction !== undefined && !factions[f.faction]) no(`foe '${id}' belongs to '${f.faction}', which is no faction`);
      for (const k of ['heeds', 'scorns']) for (const t of f[k] ?? []) if (!TALK[t]) no(`foe '${id}': ${k} is some of ${Object.keys(TALK).join(', ')}`);
    }
    for (const [id, I] of Object.entries(items)) {
      if (!ID.test(id)) no(`item id '${id}' is lower case, digits and dashes`);
      if (I.heal !== undefined && I.heal !== 'some' && I.heal !== 'all') parseDice(I.heal);
    }
    for (const [id, t] of Object.entries(tables)) {
      if (!Array.isArray(t.rows) || !t.rows.length) no(`table '${id}': rows are [{ on, text, foes?, item? }]`);
      parseDice(t.die ?? '1d6');
      for (const r of t.rows) {
        for (const f of r.foes ?? []) if (!foes[f]) no(`table '${id}' calls up '${f}', which is no foe`);
        if (r.item !== undefined && !items[r.item]) no(`table '${id}' gives '${r.item}', which is no item`);
      }
    }
    // the world
    const W = module.world;
    if (!isObj(W) || !Array.isArray(W.places) || !W.places.length) no('world is { start, places: [{ id, name?, kind?, text?, dungeon? }], routes? }');
    const places = {};
    for (const p of W.places) {
      if (!ID.test(p.id ?? '')) no(`a place's id '${p.id}' is lower case, digits and dashes`);
      if (places[p.id]) no(`two places are '${p.id}'`);
      if (p.dungeon !== undefined && !dungeons[p.dungeon]) no(`place '${p.id}' opens on dungeon '${p.dungeon}', which is none`);
      places[p.id] = { ...p, name: p.name ?? words(p.id), routes: [] };
    }
    if (!places[W.start]) no(`world.start '${W.start}' is no place`);
    for (const r of W.routes ?? []) {
      if (!places[r.a] || !places[r.b]) no(`a route runs ${r.a} to ${r.b}, and one of them is no place`);
      if (r.danger !== undefined && !tables[r.danger]) no(`the road ${r.a}–${r.b} rolls '${r.danger}', which is no table`);
      const days = r.days ?? 1;
      places[r.a].routes.push({ to: r.b, days, danger: r.danger }); places[r.b].routes.push({ to: r.a, days, danger: r.danger });
    }
    // the dungeons
    const D = {};
    for (const [did, d] of Object.entries(dungeons)) {
      if (!ID.test(did)) no(`dungeon id '${did}' is lower case, digits and dashes`);
      const rooms = {};
      for (const r of d.rooms ?? []) {
        if (!ID.test(r.id ?? '')) no(`dungeon '${did}': a room's id '${r.id}' is lower case, digits and dashes`);
        if (rooms[r.id]) no(`dungeon '${did}': two rooms are '${r.id}'`);
        for (const f of r.foes ?? []) if (!foes[f]) no(`room ${did}/${r.id} holds '${f}', which is no foe`);
        const its = (r.items ?? []).map((x) => (typeof x === 'string' ? { item: x } : x));
        for (const x of its) if (!items[x.item]) no(`room ${did}/${r.id} holds '${x.item}', which is no item`);
        if (r.trap) {
          if (!(r.trap.faculty && r.trap.harm !== undefined)) no(`room ${did}/${r.id}: a trap is { faculty, difficulty?, harm: <rank 1–5> | <dice>, text? }`);
          if (typeof r.trap.harm === 'number' ? !(Number.isInteger(r.trap.harm) && r.trap.harm >= 1 && r.trap.harm <= 5) : (parseDice(r.trap.harm), false)) no(`room ${did}/${r.id}: a trap's harm is a rank (1 to 5) or dice`);
        }
        rooms[r.id] = { ...r, name: r.name ?? words(r.id), items: its, exits: [] };
      }
      if (!rooms[d.entry]) no(`dungeon '${did}': entry '${d.entry}' is no room`);
      if (d.wander !== undefined && !tables[d.wander]) no(`dungeon '${did}' wanders on '${d.wander}', which is no table`);
      (d.links ?? []).forEach((l, i) => {
        if (!rooms[l.a] || !rooms[l.b]) no(`dungeon '${did}': link ${l.a}–${l.b} names a room that is none`);
        const kind = l.kind ?? 'open';
        if (!['open', 'door', 'stair', 'locked', 'secret'].includes(kind)) no(`dungeon '${did}': link ${l.a}–${l.b} is open, door, stair, locked or secret`);
        if (kind === 'locked' && l.key === undefined && l.force === undefined) no(`dungeon '${did}': locked link ${l.a}–${l.b} needs a key or a force (a difficulty), or both`);
        if (l.key !== undefined && !items[l.key]) no(`dungeon '${did}': link ${l.a}–${l.b} is locked by '${l.key}', which is no item`);
        const L = { ...l, kind, k: `${did}/${i}` };
        rooms[l.a].exits.push({ to: l.b, L });
        if (!l.oneWay) rooms[l.b].exits.push({ to: l.a, L });
      });
      D[did] = { ...d, id: did, name: d.name ?? words(did), rooms };
    }
    // the party
    if (!Array.isArray(module.party) || module.party.length < 1 || module.party.length > 6) no('party is 1 to 6 members: [{ id, name?, class, method? }]');
    const seen = new Set();
    const party = module.party.map((p) => {
      if (!ID.test(p.id ?? '')) no(`a party member's id '${p.id}' is lower case, digits and dashes`);
      if (seen.has(p.id)) no(`two party members are '${p.id}'`);
      seen.add(p.id);
      if (p.class === undefined) {
        const cls = Object.keys(sys.classes).find((c) => (sys.classes[c].roles || []).includes(p.role));
        if (!cls) no(`party member '${p.id}': give a class (${Object.keys(sys.classes).join(', ')}) or a role a class takes (${[...new Set(Object.values(sys.classes).flatMap((c) => c.roles || []))].join(', ')})`);
        return sheet(sys, { ...p, class: cls }, seed);
      }
      return sheet(sys, p, seed);
    });
    // the goal and the beats
    const G = module.goal;
    if (!isObj(G)) no('goal is { item } | { room: \'<dungeon>/<room>\' } | { place } | { cleared } | { flag }');
    const roomRef = (ref, what) => { const [d, r] = String(ref).split('/'); if (!D[d]?.rooms[r]) no(`${what} '${ref}' is no room (<dungeon>/<room>)`); };
    if (G.item !== undefined && !items[G.item]) no(`goal.item '${G.item}' is no item`);
    if (G.place !== undefined && !places[G.place]) no(`goal.place '${G.place}' is no place`);
    if (G.room !== undefined) roomRef(G.room, 'goal.room');
    if (G.cleared !== undefined) roomRef(G.cleared, 'goal.cleared');
    for (const b of module.beats ?? []) {
      if (!ID.test(b.id ?? '')) no(`a beat's id '${b.id}' is lower case, digits and dashes`);
      if (String(b.at).includes('/')) roomRef(b.at, `beat '${b.id}' at`); else if (!places[b.at]) no(`beat '${b.id}' is at '${b.at}', which is no place`);
    }
    const foeStats = (id) => { const f = foes[id]; return { ...sys.foes[f.rank - 1], ...(f.stats ?? {}) }; };
    const fac = Object.fromEntries(Object.entries(factions).map(([id, F]) => [id, { ...F, id, name: F.name ?? words(id), allies: F.allies ?? [], rivals: F.rivals ?? [] }]));
    return { M: module, sys, seed, foes, items, tables, places, D, party, foeStats, factions: fac, title: module.title ?? 'A table game' };
  }

  // ── the state ───────────────────────────────────────────────────────────────────────────────────────────────────────
  function start(K) {
    const S = {
      r: hash(`${K.seed}|session-v1`), at: { place: K.M.world.start }, from: null,
      party: K.party.map((p) => ({ id: p.id, hp: p.hp, maxHp: p.maxHp, level: p.level, xp: 0, marks: 0, scores: { ...p.scores }, mods: { ...p.mods } })),
      bag: {}, flags: {}, open: {}, found: {}, taken: {}, cleared: {}, searched: {}, seen: {}, sprung: {}, beats: {}, wounds: {},
      standing: Object.fromEntries(Object.values(K.factions).map((F) => [F.id, F.standing ?? 0])), day: 1, fight: null, over: null, turn: 0,
    };
    const lines = [`== ${K.title} ==`];
    if (K.M.hook) lines.push(K.M.hook);
    lines.push(`The party: ${list(K.party.map((p) => `${p.name} the ${p.className}`))}.`);
    arrive(K, S, lines);
    return { S, lines };
  }

  const pcOf = (K, S, id) => { const i = K.party.findIndex((p) => p.id === id); return { ...K.party[i], ...S.party[i], i }; };
  const standing = (K, S) => K.party.map((p, i) => ({ ...p, ...S.party[i], i })).filter((p) => p.hp > 0);
  const room = (K, S) => (S.at.dungeon ? K.D[S.at.dungeon].rooms[S.at.room] : null);
  const roomKey = (S) => `${S.at.dungeon}/${S.at.room}`;
  const itemName = (K, id) => K.items[id]?.name ?? words(id);
  // the party member who tries a thing: the best at it, standing
  function best(K, S, faculty) {
    const a = abilityOf(K.sys, faculty);
    return standing(K, S).sort((x, y) => y.scores[a] - x.scores[a] || x.i - y.i)[0];
  }
  // harm by a rank (what a foe of that rank deals, in the system's numbers) or by dice
  function harmOf(K, S, h) {
    const d = typeof h === 'number' ? K.sys.foes[h - 1].damage : h;
    return typeof d === 'number' ? { n: d, text: null } : (() => { const r = roll(S, d); return { n: Math.max(1, r.total), text: r.text }; })();
  }
  function hurt(K, S, pc, n, lines) {
    const P = S.party[pc.i];
    P.hp = Math.max(0, P.hp - n);
    lines.push(`${pc.name} takes ${n} (${P.hp}/${P.maxHp})${P.hp === 0 ? ' and falls.' : '.'}`);
  }
  function mark(K, S, pc, band, lines) {
    if (K.sys.progression.kind !== 'misses' || GOOD[band]) return;
    const P = S.party[pc.i], C = { ...K.party[pc.i], ...P };
    P.marks += 1;
    if (P.marks >= K.sys.progression.at) { P.marks = 0; levelUp(K.sys, C, S, lines); Object.assign(P, { level: C.level, scores: C.scores, mods: C.mods, maxHp: C.maxHp, hp: C.hp }); }
  }
  function gainXp(K, S, xp, lines) {
    const P = K.sys.progression;
    if (P.kind !== 'xp' || !xp) return;
    const up = standing(K, S), each = Math.floor(xp / Math.max(1, up.length));
    lines.push(`The party earns ${xp} experience (${each} each).`);
    for (const pc of up) {
      const s = S.party[pc.i], C = { ...K.party[pc.i], ...s };
      s.xp += each; C.xp = s.xp;
      while (C.level < P.thresholds.length && s.xp >= P.thresholds[C.level]) levelUp(K.sys, C, S, lines);
      Object.assign(s, { level: C.level, scores: C.scores, mods: C.mods, maxHp: C.maxHp, hp: C.hp });
    }
  }
  function milestone(K, S, lines) {
    if (K.sys.progression.kind !== 'milestone') return;
    for (const pc of standing(K, S)) {
      const s = S.party[pc.i], C = { ...K.party[pc.i], ...s };
      levelUp(K.sys, C, S, lines);
      Object.assign(s, { level: C.level, scores: C.scores, mods: C.mods, maxHp: C.maxHp, hp: C.hp });
    }
  }

  // ── what is here ────────────────────────────────────────────────────────────────────────────────────────────────────
  function exitWord(K, S, e) {
    const L = e.L, open = S.open[L.k];
    if (L.kind === 'locked' && !open) return `a locked way${L.key ? ` (${itemName(K, L.key)})` : ''}`;
    return { open: 'a way', door: 'a door', stair: 'a stair', locked: 'an unlocked door', secret: 'a hidden way' }[L.kind];
  }
  const passable = (S, e) => (e.L.kind === 'secret' ? !!S.found[e.L.k] : e.L.kind === 'locked' ? !!S.open[e.L.k] : true);
  const visible = (S, e) => e.L.kind !== 'secret' || !!S.found[e.L.k];

  function describe(K, S) {
    const lines = [];
    const R = room(K, S);
    if (!R) {
      const P = K.places[S.at.place];
      lines.push(`** ${P.name} ** (day ${S.day})`);
      if (P.text) lines.push(P.text);
      if (P.dungeon) lines.push(`Here is the way into ${K.D[P.dungeon].name} (enter).`);
      if (P.routes.length) lines.push(`Roads: ${list(P.routes.map((r) => `${K.places[r.to].name} (${r.days} day${r.days === 1 ? '' : 's'})`))}.`);
    } else {
      lines.push(`** ${R.name} ** (${K.D[S.at.dungeon].name})`);
      if (R.text) lines.push(R.text);
      if (S.fight) lines.push(`Foes: ${list(S.fight.foes.filter((f) => f.hp > 0).map((f) => `${f.name} (${f.hp}/${f.max})`))}.`);
      const its = R.items.filter((x, i) => !S.taken[`${roomKey(S)}/${i}`] && (!x.hidden || S.found[`${roomKey(S)}/${i}`]));
      if (its.length) lines.push(`Here: ${list(its.map((x) => itemName(K, x.item)))}.`);
      const ex = R.exits.filter((e) => visible(S, e));
      if (ex.length) lines.push(`Ways on: ${list(ex.map((e) => `${exitWord(K, S, e)} to ${K.D[S.at.dungeon].rooms[e.to].name} (${e.to})`))}.`);
      if (S.at.room === K.D[S.at.dungeon].entry) lines.push('The way out is here (leave).');
    }
    return lines;
  }

  function sheetLines(K, S) {
    const sys = K.sys;
    return K.party.map((p, i) => {
      const s = S.party[i];
      const ab = sys.abilities.map((a) => `${(sys.names?.[a] ?? a).slice(0, 3)} ${num(s.scores[a])}${sys.modifier.kind !== 'none' ? ` (${signed(s.mods[a])})` : ''}`).join(' · ');
      const w = p.weapon.dice ? `${p.weapon.name} ${p.weapon.dice}` : p.weapon.harm !== undefined ? `${p.weapon.name}, harm ${p.weapon.harm}` : p.weapon.name;
      const prog = sys.progression.kind === 'xp' ? ` · XP ${s.xp}` : sys.progression.kind === 'misses' ? ` · marks ${s.marks}/${sys.progression.at}` : '';
      return `${p.name}${p.persona?.epithet ? `, ${p.persona.epithet}` : ''} — ${p.className} ${s.level} · HP ${s.hp}/${s.maxHp}${sys.combat.defence === 'armour' ? ` · defence ${p.defence}` : ''} · ${ab} · ${w}${prog}`;
    });
  }

  function mapLines(K, S) {
    if (!S.at.dungeon) {
      return [`The world from ${K.places[S.at.place].name}:`, ...Object.values(K.places).map((P) => `  ${P.name}${P.id === S.at.place ? ' (here)' : ''}${P.dungeon ? ` [${K.D[P.dungeon].name}]` : ''} — ${P.routes.map((r) => `${K.places[r.to].name} ${r.days}d`).join(', ') || 'no roads'}`)];
    }
    const D = K.D[S.at.dungeon];
    const out = [`${D.name}, the rooms the party has seen:`];
    for (const R of Object.values(D.rooms)) {
      if (!S.seen[`${D.id}/${R.id}`]) continue;
      const ex = R.exits.filter((e) => visible(S, e)).map((e) => `${S.seen[`${D.id}/${e.to}`] ? D.rooms[e.to].name : '?'}${e.L.kind === 'locked' && !S.open[e.L.k] ? ' (locked)' : ''}`);
      out.push(`  ${R.name}${R.id === S.at.room ? ' (here)' : ''}${S.cleared[`${D.id}/${R.id}`] === 0 ? ' (foes)' : ''} — ${ex.join(', ') || 'no ways on'}`);
    }
    return out;
  }

  // ── arriving ────────────────────────────────────────────────────────────────────────────────────────────────────────
  function beatsAt(K, S, at, lines) {
    for (const b of K.M.beats ?? []) {
      if (b.at !== at || S.beats[b.id]) continue;
      S.beats[b.id] = 1;
      lines.push(b.text);
      if (b.sets) S.flags[b.sets] = 1;
      if (b.milestone) milestone(K, S, lines);
    }
  }
  function arrive(K, S, lines) {
    if (S.at.dungeon) {
      const key = roomKey(S), R = room(K, S), first = !S.seen[key];
      S.seen[key] = 1;
      lines.push(...describe(K, S));
      if (first) beatsAt(K, S, key, lines);
      if (R.trap && !S.sprung[key]) {
        S.sprung[key] = 1;
        const pc = best(K, S, R.trap.faculty);
        if (R.trap.text) lines.push(R.trap.text);
        const r = resolve(K, S, pc, R.trap.faculty, R.trap.difficulty);
        lines.push(r.text);
        mark(K, S, pc, r.band, lines);
        if (!GOOD[r.band] || r.band === 'partial') {
          const h = harmOf(K, S, R.trap.harm);
          if (h.text) lines.push(`Harm ${h.text}.`);
          hurt(K, S, pc, r.band === 'partial' ? Math.max(1, Math.floor(h.n / 2)) : h.n, lines);
        }
      }
      if (R.foes?.length && !S.cleared[key]) fight(K, S, R.foes, lines, key);
    } else {
      const P = K.places[S.at.place];
      lines.push(...describe(K, S));
      beatsAt(K, S, P.id, lines);
    }
    outcome(K, S, lines);
  }

  // ── fighting ────────────────────────────────────────────────────────────────────────────────────────────────────────
  function fight(K, S, foeIds, lines, where) {
    const count = {}, n = {};
    for (const f of foeIds) count[f] = (count[f] || 0) + 1;
    const foes = foeIds.map((f) => {
      n[f] = (n[f] || 0) + 1;
      const st = K.foeStats(f), F = K.foes[f], key = count[f] > 1 ? `${f}-${n[f]}` : f;
      const hp = where && S.wounds[where]?.[key] !== undefined ? S.wounds[where][key] : st.hp;
      return { key, id: f, name: `${F.name ?? words(f)}${count[f] > 1 ? ` ${n[f]}` : ''}`, rank: F.rank, hp, max: st.hp, st };
    });
    const C = K.sys.combat;
    const told = new Set();
    const lead = leaderOf(K, foes);
    if (lead && S.standing[lead.faction] >= 2) {
      lines.push(`${list(foes.map((f) => f.name))}: ${K.factions[lead.faction].name}, allied to you. They stand aside.`);
      if (where) S.cleared[where] = 1;
      return;
    }
    lines.push(`Foes! ${list(foes.map((f) => { const t = K.foes[f.id].text, say = t && !told.has(f.id) ? `${f.name} (${t})` : f.name; told.add(f.id); return say; }))}.`);
    let order;
    const pcs = standing(K, S).map((p) => ({ side: 'pc', id: p.id, i: p.i }));
    const fs = C.foesAct ? foes.map((f) => ({ side: 'foe', id: f.key })) : [];
    if (C.initiative === 'roll') {
      const rolled = [...pcs.map((p) => ({ ...p, n: roll(S, '1d20').total + S.party[p.i].mods[abilityOf(K.sys, 'agility')], t: 0 })), ...fs.map((f, j) => ({ ...f, n: roll(S, '1d20').total + Math.floor(foes[j].rank / 2), t: 1 }))];
      order = rolled.sort((a, b) => b.n - a.n || a.t - b.t);
      lines.push(`Initiative: ${order.map((o) => `${o.side === 'pc' ? K.party[o.i].name : foes.find((f) => f.key === o.id).name} ${o.n}`).join(', ')}.`);
    } else if (C.initiative === 'side') {
      const us = die(S, 6), them = die(S, 6);
      order = them > us ? [...fs, ...pcs] : [...pcs, ...fs];
      lines.push(`Initiative: the party ${us}, the foes ${them}: ${them > us ? 'the foes' : 'the party'} first.`);
    } else order = [...pcs, ...fs];
    S.fight = { where, foes, order: order.map((o) => ({ side: o.side, id: o.id })), turn: 0, round: 1 };
    if (where) S.cleared[where] = 0;
    run(K, S, lines);
  }

  const foeOf = (S, key) => S.fight.foes.find((f) => f.key === key);
  // the foes take their turns until a standing member's comes round, or the fight is over
  function run(K, S, lines) {
    const F = S.fight;
    for (let guard = 0; guard < 64 && S.fight && !S.over; guard++) {
      if (!F.foes.some((f) => f.hp > 0)) { won(K, S, lines); return; }
      if (!standing(K, S).length) { outcome(K, S, lines); return; }
      const o = F.order[F.turn];
      if (o.side === 'pc') { if (S.party[K.party.findIndex((p) => p.id === o.id)].hp > 0) return; }
      else { const f = foeOf(S, o.id); if (f.hp > 0) foeTurn(K, S, f, lines); }
      next(S);
    }
  }
  function next(S) {
    const F = S.fight;
    F.turn += 1;
    if (F.turn >= F.order.length) { F.turn = 0; F.round += 1; }
  }
  function foeTurn(K, S, f, lines) {
    const up = standing(K, S);
    if (!up.length) return;
    const target = up[die(S, up.length) - 1];
    const sys = K.sys;
    if (sys.combat.defence === 'armour') {
      const r = roll(S, '1d20'), total = r.total + f.st.attack;
      const hit = r.nat === 20 || (r.nat !== 1 && total >= target.defence);
      lines.push(`${f.name} strikes at ${target.name}: ${r.text} ${signed(f.st.attack)} = ${total} vs defence ${target.defence}: ${r.nat === 20 ? 'a critical hit' : hit ? 'a hit' : 'a miss'}.`);
      if (hit) { const d = roll(S, f.st.damage), extra = r.nat === 20 ? roll(S, f.st.damage.replace(/[+-]\d+$/, '')).total : 0; lines.push(`Damage ${d.text}${extra ? ` + ${extra} critical` : ''}.`); hurt(K, S, target, Math.max(1, d.total + extra), lines); }
    } else if (sys.check.kind === 'shifts') {
      const a = roll(S, '4dF'), d = roll(S, '4dF'), def = target.scores[abilityOf(sys, 'agility')];
      const shifts = a.total + f.st.attack - (d.total + def);
      lines.push(`${f.name} attacks ${target.name}: ${a.text} ${signed(f.st.attack)} = ${num(a.total + f.st.attack)} vs ${target.name}'s defence ${d.text} ${signed(def)} = ${num(d.total + def)}: ${shifts > 0 ? `${shifts} shift${shifts === 1 ? '' : 's'} of stress` : 'defended'}.`);
      if (shifts > 0) hurt(K, S, target, shifts, lines);
    } else {   // percent: the foe's chance out of a hundred
      const r = roll(S, '1d100'), hit = r.total <= f.st.attack;
      lines.push(`${f.name} attacks ${target.name}: ${r.text} under ${f.st.attack}: ${hit ? 'a hit' : 'a miss'}.`);
      if (hit) { const d = roll(S, f.st.damage); lines.push(`Damage ${d.text}.`); hurt(K, S, target, Math.max(1, d.total), lines); }
    }
  }
  // a member's blow: the system's attack, its damage, its cost when the players roll every die
  function attack(K, S, pc, f, lines) {
    const sys = K.sys, w = pc.weapon, C = sys.combat;
    let band, shifts = 0;
    if (C.defence === 'armour') {
      const a = abilityOf(sys, w.faculty), m = pc.mods[a];
      const prof = trained(sys, pc.level);
      const r = roll(S, '1d20'), total = r.total + m + prof;
      band = r.nat === 20 ? 'crit' : r.nat === 1 ? 'fail' : total >= f.st.defence ? 'success' : 'fail';
      lines.push(`${pc.name} attacks ${f.name} with the ${w.name}: ${r.text} ${signed(m)}${prof ? ` ${signed(prof)}` : ''} = ${total} vs defence ${f.st.defence}: ${band === 'crit' ? 'a critical hit' : band === 'success' ? 'a hit' : 'a miss'}.`);
    } else {
      const r = resolve(K, S, pc, w.faculty, sys.check.kind === 'shifts' ? undefined : 'medium', sys.check.kind === 'shifts' ? { vs: f.st.defence + roll(S, '4dF').total } : {});
      band = r.band; shifts = r.shifts ?? 0;
      lines.push(`${pc.name} attacks ${f.name} with the ${w.name}. ${r.text}`);
      mark(K, S, pc, band, lines);
    }
    if (GOOD[band]) {
      let n;
      if (C.damage === 'dice') {
        const a = abilityOf(sys, w.faculty), m = sys.modifier.kind === 'none' ? 0 : pc.mods[a];
        const d = roll(S, w.dice), extra = band === 'crit' ? roll(S, w.dice.replace(/[+-]\d+$/, '')).total : 0;
        n = Math.max(1, d.total + m + extra);
        lines.push(`Damage ${d.text}${m ? ` ${signed(m)}` : ''}${extra ? ` + ${extra} critical` : ''} = ${n}.`);
      } else if (C.damage === 'harm') n = (w.harm ?? 1) + (band === 'crit' ? 1 : 0);
      else n = band === 'partial' ? 0 : Math.max(1, shifts);
      if (n > 0) {
        f.hp = Math.max(0, f.hp - n);
        lines.push(`${f.name} takes ${n} (${f.hp}/${f.max})${f.hp === 0 ? ' and is down.' : '.'}`);
      } else lines.push(`${f.name} turns the blow aside: a tie, no harm.`);
    }
    // the players roll every die: a foe hurts on the bands the system says cost (a miss, and in some a hit at a cost)
    if (!C.foesAct && (C.costOn ?? ['partial', 'fail', 'fumble']).includes(band) && f.hp > 0) {
      lines.push(`${f.name} strikes back.`);
      hurt(K, S, pc, f.st.damage, lines);
    }
  }
  function won(K, S, lines) {
    const F = S.fight;
    const xp = F.foes.reduce((a, f) => a + (f.st.xp || 0), 0);
    lines.push(F.foes.length > 1 ? 'The foes are beaten.' : `${F.foes[0].name} is beaten.`);
    if (F.where) S.cleared[F.where] = 1;
    S.fight = null;
    // a faction's dead are remembered: by it and its allies against you, by its rivals for you
    const shift = {};
    for (const id of new Set(F.foes.map((f) => K.foes[f.id].faction).filter(Boolean))) {
      const Fa = K.factions[id];
      shift[id] = (shift[id] || 0) - 1;
      for (const a of Fa.allies) shift[a] = (shift[a] || 0) - 1;
      for (const r of Fa.rivals) shift[r] = (shift[r] || 0) + 1;
    }
    standingBy(K, S, shift, lines);
    gainXp(K, S, xp, lines);
    outcome(K, S, lines);
  }

  // ── factions and talk ───────────────────────────────────────────────────────────────────────────────────────────────
  // the one a fight is spoken to through: the highest-ranked foe standing who belongs to a faction
  function leaderOf(K, foes) {
    let L = null;
    for (const f of foes) { const fa = K.foes[f.id].faction; if (f.hp > 0 && fa && (!L || f.rank > L.rank)) L = { ...f, faction: fa }; }
    return L;
  }
  const standingWord = (n) => `${STANDING[n + 2]} (${n > 0 ? `+${n}` : num(n)})`;
  function standingBy(K, S, shift, lines) {
    const moved = [];
    for (const [id, d] of Object.entries(shift)) {
      const was = S.standing[id], now = Math.max(-2, Math.min(2, was + d));
      if (now !== was) { S.standing[id] = now; moved.push(`${K.factions[id].name} ${standingWord(now)}`); }
    }
    if (moved.length) lines.push(`Standing: ${list(moved)}.`);
  }
  // how hard a talk is with this leader: by its faction's standing, a step for what it heeds or scorns; null: not heard
  function talkDifficulty(K, S, lead, verb) {
    const F = K.foes[lead.id];
    const at = 1 - S.standing[lead.faction] + ((F.scorns ?? []).includes(verb) ? 1 : 0) - ((F.heeds ?? []).includes(verb) ? 1 : 0);
    return S.standing[lead.faction] <= -2 || at > 2 ? null : DIFF[Math.max(0, at)];
  }
  function talk(K, S, pc, verb, item, lines) {
    const F = S.fight, lead = leaderOf(K, F.foes), Fa = K.factions[lead.faction];
    F.talked = 1;
    const say = { parley: `${pc.name} calls for a parley with ${lead.name}`, threaten: `${pc.name} threatens ${lead.name}`, bribe: `${pc.name} offers ${lead.name} ${itemName(K, item)}` }[verb];
    const r = resolve(K, S, pc, TALK[verb], talkDifficulty(K, S, lead, verb));
    lines.push(`${say} (${Fa.name}, ${STANDING[S.standing[Fa.id] + 2]}). ${r.text}`);
    mark(K, S, pc, r.band, lines);
    if (GOOD[r.band]) {
      if (verb === 'bribe') { S.bag[item] -= 1; lines.push(`${cap(itemName(K, item))} changes hands.`); }
      if (verb === 'threaten' && r.band === 'partial') { lines.push(`${lead.name} strikes before giving way.`); hurt(K, S, pc, harmOf(K, S, lead.st.damage).n, lines); }
      lines.push(`${list(F.foes.filter((f) => f.hp > 0).map((f) => f.name))} stand${F.foes.filter((f) => f.hp > 0).length === 1 ? 's' : ''} aside.`);
      const xp = F.foes.reduce((a, f) => a + (f.st.xp || 0), 0);
      if (F.where) S.cleared[F.where] = 1;
      S.fight = null;
      if (r.band !== 'partial') standingBy(K, S, { [Fa.id]: verb === 'threaten' ? -1 : 1 }, lines);
      gainXp(K, S, xp, lines);
      outcome(K, S, lines);
      return;
    }
    lines.push(`${lead.name} will hear no more of it.`);
    if (r.band === 'fumble') standingBy(K, S, { [Fa.id]: -1 }, lines);
    next(S); run(K, S, lines);
  }
  function factionLines(K, S) {
    const out = ['The factions:'];
    for (const F of Object.values(K.factions)) {
      const rel = [F.allies.length ? `allied to ${list(F.allies.map((a) => K.factions[a].name))}` : null, F.rivals.length ? `rivals of ${list(F.rivals.map((a) => K.factions[a].name))}` : null].filter(Boolean);
      out.push(`  ${F.name}: ${standingWord(S.standing[F.id])}${rel.length ? `; ${rel.join('; ')}` : ''}`);
    }
    return out;
  }

  // ── the end ─────────────────────────────────────────────────────────────────────────────────────────────────────────
  function outcome(K, S, lines) {
    if (S.over) return;
    if (!standing(K, S).length) { S.over = { won: false, reason: 'the party falls' }; lines.push('The party falls. The tale ends here.'); return; }
    const G = K.M.goal;
    const met = (G.item !== undefined && S.bag[G.item] > 0) || (G.place !== undefined && !S.at.dungeon && S.at.place === G.place)
      || (G.room !== undefined && S.at.dungeon && roomKey(S) === G.room && !S.fight) || (G.cleared !== undefined && S.cleared[G.cleared] === 1)
      || (G.flag !== undefined && S.flags[G.flag]);
    if (met) { S.over = { won: true, reason: 'the goal is met' }; if (K.M.ending) lines.push(K.M.ending); lines.push('The tale is won.'); }
  }

  // ── the table: tables and the oracle ────────────────────────────────────────────────────────────────────────────────
  function rollTable(K, S, id, lines) {
    const T = K.tables[id], r = roll(S, T.die ?? '1d6');
    const row = T.rows.find((x) => (Array.isArray(x.on) ? r.total >= x.on[0] && r.total <= x.on[1] : x.on === r.total));
    lines.push(`${T.name ?? words(id)}: ${r.text}${row ? `: ${row.text}` : ': nothing.'}`);
    if (!row) return;
    if (row.item) { S.bag[row.item] = (S.bag[row.item] || 0) + 1; lines.push(`The party has ${itemName(K, row.item)}.`); outcome(K, S, lines); }
    if (row.foes?.length && !S.fight && !S.over) fight(K, S, row.foes, lines, null);
  }
  function oracle(S, odds, lines, q) {
    const p = { likely: 75, even: 50, unlikely: 25 }[odds], r = roll(S, '1d100');
    const yes = r.total <= p, edge = yes ? r.total <= Math.ceil(p / 5) : r.total > 100 - Math.ceil((100 - p) / 5);
    const near = Math.abs(r.total - p) <= 5;
    const said = yes ? (edge ? 'yes, and more' : near ? 'yes, but' : 'yes') : (edge ? 'no, and worse' : near ? 'no, but' : 'no');
    lines.push(`The oracle (${odds})${q ? `, asked "${q}"` : ''}: ${r.text} against ${p}: ${said}.`);
  }

  // ── the moves ───────────────────────────────────────────────────────────────────────────────────────────────────────
  function legal(K, S) {
    if (S.over) return [{ name: 'sheet', verb: 'sheet' }];
    const out = [{ name: 'look', verb: 'look' }, { name: 'map', verb: 'map' }, { name: 'sheet', verb: 'sheet' }];
    const heal = Object.keys(S.bag).filter((i) => S.bag[i] > 0 && K.items[i]?.heal);
    if (S.fight) {
      const o = S.fight.order[S.fight.turn], pc = pcOf(K, S, o.id);
      for (const f of S.fight.foes) if (f.hp > 0) out.push({ name: `attack ${f.key}`, verb: 'attack', foe: f.key, by: pc.id });
      for (const i of heal) out.push({ name: `use ${i}`, verb: 'use', item: i, by: pc.id });
      if (S.fight.where && (S.from || S.at.room === K.D[S.at.dungeon].entry)) out.push({ name: 'flee', verb: 'flee', by: pc.id });
      const lead = !S.fight.talked && leaderOf(K, S.fight.foes);
      if (lead) {
        if (talkDifficulty(K, S, lead, 'parley')) out.push({ name: 'parley', verb: 'parley', by: pc.id });
        if (talkDifficulty(K, S, lead, 'threaten')) out.push({ name: 'threaten', verb: 'threaten', by: pc.id });
        if (talkDifficulty(K, S, lead, 'bribe')) for (const i of Object.keys(S.bag)) if (S.bag[i] > 0 && K.items[i]?.kind === 'treasure' && i !== K.M.goal.item) out.push({ name: `bribe ${i}`, verb: 'bribe', item: i, by: pc.id });
      }
      if (Object.keys(K.factions).length) out.push({ name: 'factions', verb: 'factions' });
      return out;
    }
    const R = room(K, S);
    if (R) {
      for (const e of R.exits) {
        if (!visible(S, e)) continue;
        if (passable(S, e)) out.push({ name: `go ${e.to}`, verb: 'go', to: e.to });
        else {
          if (e.L.key && S.bag[e.L.key] > 0) out.push({ name: `unlock ${e.to}`, verb: 'unlock', to: e.to });
          if (e.L.force !== undefined) out.push({ name: `force ${e.to}`, verb: 'force', to: e.to });
        }
      }
      if (!S.searched[roomKey(S)]) out.push({ name: 'search', verb: 'search' });
      R.items.forEach((x, i) => { const k = `${roomKey(S)}/${i}`; if (!S.taken[k] && (!x.hidden || S.found[k])) out.push({ name: `take ${x.item}`, verb: 'take', item: x.item, slot: i }); });
      if (S.at.room === K.D[S.at.dungeon].entry) out.push({ name: 'leave', verb: 'leave' });
    } else {
      const P = K.places[S.at.place];
      for (const r of P.routes) out.push({ name: `travel ${r.to}`, verb: 'travel', to: r.to });
      if (P.dungeon) out.push({ name: 'enter', verb: 'enter' });
    }
    for (const i of heal) out.push({ name: `use ${i}`, verb: 'use', item: i });
    if (Object.keys(K.factions).length) out.push({ name: 'factions', verb: 'factions' });
    out.push({ name: 'rest', verb: 'rest' });
    out.push({ name: 'check <faculty> [easy|medium|hard|n] [by <member>]', verb: 'check', template: true });
    out.push({ name: 'roll <dice>', verb: 'roll', template: true });
    out.push({ name: 'ask <question> [likely|even|unlikely]', verb: 'ask', template: true });
    for (const t of Object.keys(K.tables)) out.push({ name: `table ${t}`, verb: 'table', table: t });
    return out;
  }

  function parse(K, S, text) {
    const t = String(text).trim().toLowerCase().replace(/\s+/g, ' ');
    if (!t) return null;
    const L = legal(K, S).filter((m) => !m.template);
    const exact = L.find((m) => m.name === t);
    if (exact) return exact;
    // a room, a place or a foe by its name as well as its id
    const [verb, ...rest] = t.split(' '), arg = slug(rest.join(' '));
    const named = L.find((m) => m.verb === verb && arg && (
      (m.to && (slug(S.at.dungeon ? K.D[S.at.dungeon].rooms[m.to].name : K.places[m.to].name) === arg || m.to === arg))
      || (m.foe && slug(foeOf(S, m.foe).name) === arg) || (m.item && slug(itemName(K, m.item)) === arg)));
    if (named) return named;
    if (S.over) return null;
    if (verb === 'check' && rest.length && !S.fight) {
      const by = rest.indexOf('by'), who = by >= 0 ? rest.slice(by + 1).join('-') : null, args = by >= 0 ? rest.slice(0, by) : rest;
      const [faculty, d] = args;
      if (!abilityOf(K.sys, faculty)) return null;
      const difficulty = d === undefined ? 'medium' : /^-?\d+(\.\d+)?$/.test(d) ? +d : DIFF.includes(d) ? d : null;
      if (difficulty === null) return null;
      if (who && !K.party.some((p) => p.id === who)) return null;
      return { name: t, verb: 'check', faculty, difficulty, by: who };
    }
    if (verb === 'roll' && rest.length) { try { parseDice(rest.join('')); return { name: t, verb: 'roll', dice: rest.join('') }; } catch { return null; } }
    if (verb === 'ask') {
      const odds = ['likely', 'even', 'unlikely'].includes(rest[rest.length - 1]) ? rest[rest.length - 1] : 'even';
      return { name: t, verb: 'ask', odds, question: (odds === rest[rest.length - 1] ? rest.slice(0, -1) : rest).join(' ') };
    }
    return null;
  }

  function apply(K, S0, mv) {
    const S = clone(S0), lines = [];
    S.turn += 1;
    const v = mv.verb;
    if (v === 'look') lines.push(...describe(K, S));
    else if (v === 'map') lines.push(...mapLines(K, S));
    else if (v === 'sheet') lines.push(...sheetLines(K, S));
    else if (v === 'factions') lines.push(...factionLines(K, S));
    else if (TALK[v]) talk(K, S, pcOf(K, S, mv.by), v, mv.item, lines);
    else if (v === 'roll') lines.push(roll(S, mv.dice).text);
    else if (v === 'ask') oracle(S, mv.odds, lines, mv.question);
    else if (v === 'table') rollTable(K, S, mv.table, lines);
    else if (v === 'check') {
      const pc = mv.by ? pcOf(K, S, mv.by) : best(K, S, mv.faculty);
      if (pc.hp <= 0) lines.push(`${pc.name} is down and cannot try.`);
      else {
        const r = resolve(K, S, pc, mv.faculty, mv.difficulty);
        lines.push(r.text + (r.band === 'partial' ? ' The cost is the referee\'s to name.' : ''));
        mark(K, S, pc, r.band, lines);
      }
    } else if (v === 'go') {
      S.from = S.at.room; S.at = { ...S.at, room: mv.to };
      arrive(K, S, lines);
    } else if (v === 'unlock') {
      const e = room(K, S).exits.find((x) => x.to === mv.to && x.L.kind === 'locked');
      S.open[e.L.k] = 1;
      lines.push(`${cap(itemName(K, e.L.key))} turns: the way to ${K.D[S.at.dungeon].rooms[mv.to].name} is open.`);
    } else if (v === 'force') {
      const e = room(K, S).exits.find((x) => x.to === mv.to && x.L.kind === 'locked');
      const pc = best(K, S, 'might'), r = resolve(K, S, pc, 'might', e.L.force);
      lines.push(`${pc.name} puts a shoulder to it. ${r.text}`);
      mark(K, S, pc, r.band, lines);
      if (GOOD[r.band]) { S.open[e.L.k] = 1; lines.push(`It gives: the way to ${K.D[S.at.dungeon].rooms[mv.to].name} is open.`); }
      if (r.band !== 'crit' && r.band !== 'success') { const w = K.D[S.at.dungeon].wander; lines.push('The noise carries.'); if (w) rollTable(K, S, w, lines); }
    } else if (v === 'search') {
      const R = room(K, S), key = roomKey(S);
      S.searched[key] = 1;
      const pc = best(K, S, 'insight'), r = resolve(K, S, pc, 'insight', R.search ?? 'medium');
      lines.push(`${pc.name} searches. ${r.text}`);
      mark(K, S, pc, r.band, lines);
      const got = [];
      if (GOOD[r.band]) {
        for (const e of R.exits) if (e.L.kind === 'secret' && !S.found[e.L.k]) {
          const need = e.L.search ?? R.search ?? 'medium';
          if (need === (R.search ?? 'medium') || r.band === 'crit') { S.found[e.L.k] = 1; got.push(`a hidden way to ${K.D[S.at.dungeon].rooms[e.to].name}`); }
        }
        R.items.forEach((x, i) => { const k = `${key}/${i}`; if (x.hidden && !S.found[k]) { S.found[k] = 1; got.push(itemName(K, x.item)); } });
      }
      lines.push(got.length ? `Found: ${list(got)}.` : 'Nothing more is found here.');
      // a search at a cost takes its time, and time in a dungeon is a roll on its wandering table
      if (r.band === 'partial' && K.D[S.at.dungeon].wander) { lines.push('It takes time.'); rollTable(K, S, K.D[S.at.dungeon].wander, lines); }
    } else if (v === 'take') {
      S.taken[`${roomKey(S)}/${mv.slot}`] = 1;
      S.bag[mv.item] = (S.bag[mv.item] || 0) + 1;
      lines.push(`Taken: ${itemName(K, mv.item)}.${K.items[mv.item]?.text ? ` ${K.items[mv.item].text}` : ''}`);
      outcome(K, S, lines);
    } else if (v === 'use') {
      // given to whoever is worst hurt, the fallen first
      const I = K.items[mv.item], by = mv.by ? pcOf(K, S, mv.by) : null;
      const pc = K.party.map((p, i) => ({ ...p, ...S.party[i], i })).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || a.i - b.i)[0];
      S.bag[mv.item] -= 1;
      const P = S.party[pc.i], was = P.hp;
      const r = I.heal === 'all' ? { total: P.maxHp, text: 'all' } : I.heal === 'some' ? { total: Math.ceil(P.maxHp / 2), text: 'half' } : roll(S, I.heal);
      P.hp = Math.min(P.maxHp, P.hp + r.total);
      lines.push(`${by && by.id !== pc.id ? `${by.name} gives ${pc.name}` : `${pc.name} takes`} ${itemName(K, mv.item)}: ${r.text}, ${P.hp - was} back (${P.hp}/${P.maxHp}).`);
      if (S.fight) { next(S); run(K, S, lines); }
    } else if (v === 'attack') {
      const pc = pcOf(K, S, mv.by), f = foeOf(S, mv.foe);
      attack(K, S, pc, f, lines);
      next(S); run(K, S, lines);
    } else if (v === 'flee') {
      const pc = pcOf(K, S, mv.by), r = resolve(K, S, pc, 'agility', 'medium');
      lines.push(`${pc.name} calls the retreat. ${r.text}`);
      mark(K, S, pc, r.band, lines);
      if (GOOD[r.band]) {
        if (r.band === 'partial') { const f = S.fight.foes.find((x) => x.hp > 0); lines.push(`${f.name} lands a blow on the way out.`); hurt(K, S, pc, harmOf(K, S, f.st.damage).n, lines); }
        // the foes keep their wounds and their room; from the way in, the party flees the dungeon
        const where = S.fight.where, back = S.from;
        S.wounds[where] = Object.fromEntries(S.fight.foes.map((f) => [f.key, f.hp]));
        S.fight = null; S.cleared[where] = 0;
        S.at = back ? { ...S.at, room: back } : { place: S.at.place }; S.from = null;
        lines.push('The party falls back.');
        arrive(K, S, lines);
      } else { next(S); run(K, S, lines); }
    } else if (v === 'enter') {
      const D = K.D[K.places[S.at.place].dungeon];
      S.at = { place: S.at.place, dungeon: D.id, room: D.entry }; S.from = null;
      lines.push(`Into ${D.name}.`);
      arrive(K, S, lines);
    } else if (v === 'leave') {
      S.at = { place: S.at.place }; S.from = null;
      arrive(K, S, lines);
    } else if (v === 'travel') {
      const P = K.places[S.at.place], r = P.routes.find((x) => x.to === mv.to);
      lines.push(`The party sets out for ${K.places[mv.to].name}: ${r.days} day${r.days === 1 ? '' : 's'} on the road.`);
      for (let d = 0; d < r.days && !S.fight && !S.over; d++) { S.day += 1; if (r.danger) rollTable(K, S, r.danger, lines); }
      if (!S.over) {
        S.at = { place: mv.to }; S.from = null;
        if (S.fight) lines.push(`On the road to ${K.places[mv.to].name}.`); else arrive(K, S, lines);
      }
    } else if (v === 'rest') {
      const w = S.at.dungeon ? K.D[S.at.dungeon].wander : null;
      lines.push(S.at.dungeon ? 'The party rests, watch by watch.' : 'The party rests.');
      if (w) rollTable(K, S, w, lines);
      // a rest brings the fallen round too
      if (!S.fight && !S.over) {
        for (const P of S.party) P.hp = P.maxHp;
        if (!S.at.dungeon) S.day += 1;
        lines.push(`Rested: ${list(standing(K, S).map((p) => `${p.name} ${S.party[p.i].hp}/${S.party[p.i].maxHp}`))}.`);
      }
    } else no(`'${v}' is not a move`);
    // a fight on the road ends on the road's far side
    if (!S.fight && !S.at.dungeon && v !== 'travel' && S0.fight && !S0.at.dungeon && !S.over) arrive(K, S, lines);
    return { S, lines };
  }

  function act(K, S, text) {
    const mv = parse(K, S, text);
    if (mv) return apply(K, S, mv);
    const can = legal(K, S).map((m) => m.name);
    return { S, lines: [`"${text}" is not a move now. ${S.fight ? `${pcOf(K, S, S.fight.order[S.fight.turn].id).name} acts. ` : ''}Moves: ${can.join(' · ')}.`] };
  }

  return { FACULTY, DIFF, STANDING, TALK, roll, parseDice, tape, sheet, modOf, resolve, compile, start, legal, parse, apply, act, describe, sheetLines, mapLines };
}

const _rpg = buildTableRpg();
export const TABLE_RPG_FACULTIES = _rpg.FACULTY;
export const TABLE_RPG_STANDING = _rpg.STANDING;
export const TABLE_RPG_TALK = _rpg.TALK;
export const tableRoll = _rpg.roll;
export const tableParseDice = _rpg.parseDice;
export const tableTape = _rpg.tape;
export const tableSheet = _rpg.sheet;
export const tableModOf = _rpg.modOf;
export const tableResolve = _rpg.resolve;
export const tableCompile = _rpg.compile;
export const tableStart = _rpg.start;
export const tableLegal = _rpg.legal;
export const tableParse = _rpg.parse;
export const tableApply = _rpg.apply;
export const tableAct = _rpg.act;
export const tableDescribe = _rpg.describe;
export const tableSheetLines = _rpg.sheetLines;
export const tableMapLines = _rpg.mapLines;
