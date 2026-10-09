/**
 * THE STATS KERNEL — what a stat does at runtime: levels climb on xp, resources are spent, purchases are guarded and
 * atomic, epochs are reached, tech nodes rank up and open their subtrees, modifiers stack on stats, derived stats follow
 * the stats they are made of, and a phenomenon's number is read off a FORMULA.
 *
 * SINGLE SOURCE OF TRUTH, the bus's discipline: everything lives inside `buildStats()`, a closure referencing nothing
 * outside itself, so the page runs the same code by emitting `buildStats.toString()` (only when the world declares
 * play.stats: absent, zero bytes). Node imports the live instance below.
 *
 * The bus is untouched. Stat effects lower to `ctrl` intents whose op is a stat op; each pass of the page's watch loop
 * `step(cfg, busState)` takes the bus's queued intents in order: a stat op is applied to the bus vars and removed, a
 * cast op keeps its place with every formula on it resolved to a number (held to the field's range), a bound stat that
 * changed waits for `applyBodies(S, world)` (the page calls it beside syncToCtrl), and the events the transactions raise are returned for the bus to process. Pure: the
 * same vars and ops give the same vars and events.
 *
 *   cfg (built by stats.js readStats): { holders, starts: { holder: { stats?, resources? } }, stats: { id: { base, min?,
 *     max?, from? } }, order: [stat ids, a derived one after what it reads], resources: { id: { start, cap? } },
 *     level: { start, max, xp: [total xp to reach start + 1, …], each?, at? } | null, epochs: [{ id, level?, cost?,
 *     requires? }], nodes: { id: { parent?, opens, epoch?, requires?, cost, ranks, growth, gives? } }, offers: { id:
 *     { cost, gives, requires?, max? } }, bodies: { hpMax?, speed? } | null }
 *   vars: `<holder>.<stat>` the EFFECTIVE value (base + Σ add) × (1 + Σ pct) × Π mul, held to min / max;
 *     `<holder>.<stat>.base` what raises move (a derived stat has none: its formula is its base); `<holder>.<key>` a
 *     resource, level, xp, epoch (its id), a node's rank, an offer's count; `<holder>.<node>.open` 1 while buyable
 *   ops: raise { stat, by } · grant { res, by } · xp { by } · level { by? } · buy { id } · buff { id, mods: [{ stat,
 *     add?, pct?, mul? }] } · unbuff { id: an id, or a prefix ending '*' }   (each with of?: a holder)
 *   events: level-up { of, level } · epoch { of, epoch } · bought { of, id, rank } · denied { of, id, why: requires |
 *     cost | max | unknown } · opened { of, id }
 *   formula: n | { stat, of?, base?, per?, min?, max? } | { sum?, mul?, curve?, min?, max? }; of: a holder, 'self' (the
 *     op's holder) or 'target' (the op's who; a beam's to); curve: { mitigate: k } → k / (k + v), { soft: at, slope },
 *     'sqrt'
 */

export function buildStats() {
  const STAT_OPS = { raise: 1, grant: 1, xp: 1, level: 1, buy: 1, buff: 1, unbuff: 1 };
  // where a cast op may carry a formula, and the range the read number is held to
  const FIELDS = {
    hurt: { by: [0, 1e9] }, heal: { by: [0, 1e9] },
    puff: { scale: [0.1, 10], shake: [0, 1] }, status: { for: [0.05, 1e6] },
    shake: { k: [0, 1], for: [0.05, 3] }, walk: { speed: [0.1, 50] },
    raise: { by: [-1e9, 1e9] }, grant: { by: [-1e9, 1e9] }, xp: { by: [0, 1e9] }, level: { by: [0, 1e3] },
  };
  const clamp = (v, lo, hi) => (lo != null && v < lo ? lo : hi != null && v > hi ? hi : v);
  const isFormula = (v) => v && typeof v === 'object' && !Array.isArray(v) && (typeof v.stat === 'string' || Array.isArray(v.sum) || Array.isArray(v.mul));
  const holderOf = (cfg, op) => op.of || cfg.holders[0];
  const epochIx = (cfg, id) => { for (let i = 0; i < cfg.epochs.length; i++) if (cfg.epochs[i].id === id) return i; return -1; };

  function value(cfg, vars, h, key) {
    if (key === 'epoch') return Math.max(0, epochIx(cfg, vars[h + '.epoch']));
    const v = vars[h + '.' + key];
    return typeof v === 'number' ? v : 0;
  }

  /** A formula's number. ctx: { self, target } (holders' ids; a target that is no holder reads 0). */
  function evalF(cfg, vars, f, ctx) {
    if (typeof f === 'number') return f;
    if (!f || typeof f !== 'object') return 0;
    ctx = ctx || {};
    let v;
    if (typeof f.stat === 'string') {
      const h = f.of === 'target' ? ctx.target : f.of === 'self' || f.of == null ? ctx.self || cfg.holders[0] : f.of;
      v = (f.base != null ? f.base : 0) + (f.per != null ? f.per : 1) * (h ? value(cfg, vars, h, f.stat) : 0);
    } else {
      v = f.sum ? 0 : 1;
      if (f.sum) for (const x of f.sum) v += evalF(cfg, vars, x, ctx);
      if (f.mul) for (const x of f.mul) v *= evalF(cfg, vars, x, ctx);
    }
    const c = f.curve;
    if (c === 'sqrt') v = v < 0 ? -Math.sqrt(-v) : Math.sqrt(v);
    else if (c && c.mitigate != null) v = c.mitigate / (c.mitigate + Math.max(0, v));
    else if (c && c.soft != null && v > c.soft) v = c.soft + (v - c.soft) * (c.slope != null ? c.slope : 0.5);
    return clamp(v, f.min, f.max);
  }

  function requires(cfg, vars, h, r) {
    if (!r) return true;
    if (r.all) { for (const x of r.all) if (!requires(cfg, vars, h, x)) return false; return true; }
    if (r.any) { for (const x of r.any) if (requires(cfg, vars, h, x)) return true; return false; }
    if (r.level != null) return value(cfg, vars, h, 'level') >= r.level;
    if (r.epoch != null) return value(cfg, vars, h, 'epoch') >= epochIx(cfg, r.epoch);
    if (r.has != null) return value(cfg, vars, h, r.has) >= (r.rank != null ? r.rank : 1);
    if (r.stat != null) return value(cfg, vars, h, r.stat) >= (r.gte != null ? r.gte : 0);
    return false;
  }

  // a node can be bought or ranked: its parent at its opening rank, its epoch reached, its requirements met
  function nodeOpen(cfg, vars, h, id) {
    const n = cfg.nodes[id];
    if (n.parent && value(cfg, vars, h, n.parent) < n.opens) return false;
    if (n.epoch != null && value(cfg, vars, h, 'epoch') < epochIx(cfg, n.epoch)) return false;
    return requires(cfg, vars, h, n.requires);
  }

  const costAt = (cost, growth, rank) => {
    const out = {};
    for (const k in cost) out[k] = Math.ceil(cost[k] * Math.pow(growth, rank) - 1e-9);
    return out;
  };
  function affordable(vars, h, cost) { for (const k in cost) if (!((vars[h + '.' + k] || 0) >= cost[k])) return false; return true; }
  function pay(vars, h, cost) { for (const k in cost) vars[h + '.' + k] = (vars[h + '.' + k] || 0) - cost[k]; }

  // the effective values: each stat in order (a derived one after what it reads), its modifiers stacked on its base
  function settle(cfg, S, h) {
    const vars = S.vars, mods = (S._statMods && S._statMods[h]) || {};
    for (const id of cfg.order) {
      const d = cfg.stats[id];
      const base = d.from ? evalF(cfg, vars, d.from, { self: h }) : value(cfg, vars, h, id + '.base');
      let add = 0, pct = 0, mul = 1;
      for (const k in mods) for (const m of mods[k]) if (m.stat === id) { add += m.add || 0; pct += m.pct || 0; mul *= m.mul != null ? m.mul : 1; }
      vars[h + '.' + id] = clamp((base + add) * (1 + pct) * mul, d.min, d.max);
    }
  }

  function raise(cfg, vars, h, stat, by) {
    const d = cfg.stats[stat];
    if (!d || d.from) return;
    vars[h + '.' + stat + '.base'] = clamp(value(cfg, vars, h, stat + '.base') + by, d.min, d.max);
  }
  function grant(cfg, vars, h, res, by) {
    const d = cfg.resources[res];
    if (!d) return;
    vars[h + '.' + res] = clamp(value(cfg, vars, h, res) + by, 0, d.cap);
  }

  function give(cfg, S, h, g, out) {
    if (!g) return;
    if (g.raise) for (const k in g.raise) raise(cfg, S.vars, h, k, g.raise[k]);
    if (g.grant) for (const k in g.grant) grant(cfg, S.vars, h, k, g.grant[k]);
    if (g.raise) settle(cfg, S, h);
    if (g.xp) gainXp(cfg, S, h, g.xp, out);
  }

  // an epoch reached by level alone (one with a cost is bought: its level is then a requirement)
  function epochsByLevel(cfg, vars, h, out) {
    let cur = value(cfg, vars, h, 'epoch'), to = cur;
    for (let i = cur + 1; i < cfg.epochs.length; i++) {
      const e = cfg.epochs[i];
      if (e.cost || e.level == null) break;   // epochs are in order: a bought one stands in the way of the next
      if (value(cfg, vars, h, 'level') >= e.level && requires(cfg, vars, h, e.requires)) to = i; else break;
    }
    if (to !== cur) { vars[h + '.epoch'] = cfg.epochs[to].id; out.push({ type: 'epoch', of: h, epoch: cfg.epochs[to].id }); }
  }

  function levelUp(cfg, S, h, out) {
    const L = cfg.level, vars = S.vars;
    if (!L) return false;
    const lv = value(cfg, vars, h, 'level');
    if (L.max != null && lv >= L.max) return false;
    vars[h + '.level'] = lv + 1;
    settle(cfg, S, h);   // a derived stat may read the level
    give(cfg, S, h, L.each, out);
    give(cfg, S, h, L.at && L.at[lv + 1], out);
    out.push({ type: 'level-up', of: h, level: lv + 1 });
    if (cfg.epochs.length) epochsByLevel(cfg, vars, h, out);
    return true;
  }

  function gainXp(cfg, S, h, by, out) {
    const L = cfg.level, vars = S.vars;
    if (!L) return;
    vars[h + '.xp'] = value(cfg, vars, h, 'xp') + by;
    let guard = 0;
    while (guard++ < 1000) {
      const i = value(cfg, vars, h, 'level') - L.start;
      if (i >= L.xp.length || value(cfg, vars, h, 'xp') < L.xp[i]) break;
      if (!levelUp(cfg, S, h, out)) break;
    }
  }

  // ONE TRANSACTION: every check first; on any failure nothing changes and `denied` says why
  function buy(cfg, S, h, id, out) {
    const vars = S.vars, deny = (why) => out.push({ type: 'denied', of: h, id: id, why: why });
    const n = cfg.nodes[id], o = cfg.offers[id], ei = epochIx(cfg, id);
    if (n) {
      const rank = value(cfg, vars, h, id);
      if (rank >= n.ranks) return deny('max');
      if (!nodeOpen(cfg, vars, h, id)) return deny('requires');
      const cost = costAt(n.cost, n.growth, rank);
      if (!affordable(vars, h, cost)) return deny('cost');
      pay(vars, h, cost);
      vars[h + '.' + id] = rank + 1;
      settle(cfg, S, h);
      give(cfg, S, h, n.gives, out);
      return out.push({ type: 'bought', of: h, id: id, rank: rank + 1 });
    }
    if (o) {
      const count = value(cfg, vars, h, id);
      if (o.max != null && count >= o.max) return deny('max');
      if (!requires(cfg, vars, h, o.requires)) return deny('requires');
      if (!affordable(vars, h, o.cost)) return deny('cost');
      pay(vars, h, o.cost);
      vars[h + '.' + id] = count + 1;
      give(cfg, S, h, o.gives, out);
      return out.push({ type: 'bought', of: h, id: id, rank: count + 1 });
    }
    if (ei >= 0) {
      const cur = value(cfg, vars, h, 'epoch'), e = cfg.epochs[ei];
      if (ei <= cur) return deny('max');
      if (ei > cur + 1) return deny('requires');   // epochs are reached in order
      if (e.level != null && value(cfg, vars, h, 'level') < e.level) return deny('requires');
      if (!requires(cfg, vars, h, e.requires)) return deny('requires');
      const cost = e.cost || {};
      if (!affordable(vars, h, cost)) return deny('cost');
      pay(vars, h, cost);
      vars[h + '.epoch'] = e.id;
      settle(cfg, S, h);
      out.push({ type: 'bought', of: h, id: id, rank: 1 });
      return out.push({ type: 'epoch', of: h, epoch: e.id });
    }
    return deny('unknown');
  }

  // a buff's mods are read now (a formula in add / pct / mul reads the holder as it is) and replace any under its id
  function buff(cfg, S, h, op) {
    const mods = [];
    for (const m of op.mods || []) {
      if (!m || !cfg.stats[m.stat]) continue;
      const r = { stat: m.stat };
      for (const k of ['add', 'pct', 'mul']) if (m[k] != null) r[k] = evalF(cfg, S.vars, m[k], { self: h });
      mods.push(r);
    }
    const all = S._statMods || (S._statMods = {}), mine = all[h] || (all[h] = {});
    mine[op.id] = mods;
  }
  function unbuff(S, h, id) {
    const mine = S._statMods && S._statMods[h];
    if (!mine || typeof id !== 'string') return;
    if (id.charAt(id.length - 1) === '*') { const p = id.slice(0, -1); for (const k in mine) if (k.indexOf(p) === 0) delete mine[k]; }
    else delete mine[id];
  }

  // the open flags, and `opened` on each that turns on
  function refreshOpen(cfg, vars, out) {
    for (const h of cfg.holders) for (const id in cfg.nodes) {
      const key = h + '.' + id + '.open', now = nodeOpen(cfg, vars, h, id) && value(cfg, vars, h, id) < cfg.nodes[id].ranks ? 1 : 0;
      if (now && !vars[key]) out.push({ type: 'opened', of: h, id: id });
      vars[key] = now;
    }
  }

  // a bound stat that changed: a body change waiting for that holder's character (applyBodies hands it over)
  function bodies(cfg, S) {
    if (!cfg.bodies) return;
    const sent = S._statBody || (S._statBody = {}), q = S._statBodyOps || (S._statBodyOps = []);
    for (const h of cfg.holders) {
      const op = { who: h };
      let any = false;
      for (const field in cfg.bodies) {
        const v = value(cfg, S.vars, h, cfg.bodies[field]), key = h + '.' + field;
        if (sent[key] !== v) { sent[key] = v; op[field] = v; any = true; }
      }
      if (any) q.push(op);
    }
  }

  /**
   * The waiting body changes onto the character world's entities (after the tick, beside the cast's ops): hpMax (a rise
   * adds the difference to hp; a fallen body stays down), speed (its rule's pace). A holder with no character: nothing.
   */
  function applyBodies(S, world) {
    const q = S._statBodyOps;
    if (!q || !q.length) return;
    S._statBodyOps = [];
    for (const o of q) {
      const e = world && world.byId && world.byId[o.who];
      if (!e || e.isCamera) continue;
      if (Number.isFinite(o.hpMax) && o.hpMax > 0 && e.body) {
        const was = Number.isFinite(e.hpMax) ? e.hpMax : null;
        e.hpMax = o.hpMax;
        if (!Number.isFinite(e.body.hp)) e.body.hp = o.hpMax;
        else if (!e.downed) e.body.hp = Math.min(o.hpMax, e.body.hp + (was != null && o.hpMax > was ? o.hpMax - was : 0));
      }
      if (Number.isFinite(o.speed) && o.speed > 0 && e.rule) e.rule.speed = o.speed;
    }
  }

  /** The vars a holder starts with (the build puts them in events.vars). */
  function initVars(cfg) {
    const vars = {};
    for (const h of cfg.holders) {
      const st = (cfg.starts && cfg.starts[h]) || {};
      for (const k in cfg.stats) if (!cfg.stats[k].from) vars[h + '.' + k + '.base'] = st.stats && st.stats[k] != null ? st.stats[k] : cfg.stats[k].base;
      for (const k in cfg.resources) vars[h + '.' + k] = st.resources && st.resources[k] != null ? st.resources[k] : cfg.resources[k].start;
      if (cfg.level) { vars[h + '.level'] = cfg.level.start; vars[h + '.xp'] = 0; }
      if (cfg.epochs.length) vars[h + '.epoch'] = cfg.epochs[0].id;
      for (const k in cfg.nodes) vars[h + '.' + k] = 0;
      for (const k in cfg.offers) vars[h + '.' + k] = 0;
    }
    const S = { vars };
    for (const h of cfg.holders) settle(cfg, S, h);
    refreshOpen(cfg, vars, []);
    return vars;
  }

  // a cast op's (and a stat op's) formulas, read now, held to the field's range
  function resolveOp(cfg, vars, op) {
    const f = FIELDS[op.op] || {}, stat = op.op in STAT_OPS;
    const ctx = stat ? { self: holderOf(cfg, op) } : { self: op.op === 'beam' ? op.who : cfg.holders[0], target: op.op === 'beam' ? (typeof op.to === 'string' ? op.to : null) : op.who };
    for (const k in op) {
      if (k === 'mods' || !isFormula(op[k])) continue;
      const r = f[k] || [null, null];
      op[k] = clamp(evalF(cfg, vars, op[k], ctx), r[0], r[1]);
    }
    if (op.op === 'level' && op.by != null) op.by = Math.round(op.by);
  }

  function apply(cfg, S, op, out) {
    const h = holderOf(cfg, op), vars = S.vars;
    if (op.op === 'raise') { raise(cfg, vars, h, op.stat, op.by != null ? op.by : 1); settle(cfg, S, h); }
    else if (op.op === 'grant') { grant(cfg, vars, h, op.res, op.by != null ? op.by : 1); settle(cfg, S, h); }
    else if (op.op === 'xp') gainXp(cfg, S, h, op.by != null ? op.by : 1, out);
    else if (op.op === 'level') { const n = op.by != null ? op.by : 1; for (let i = 0; i < n; i++) if (!levelUp(cfg, S, h, out)) break; }
    else if (op.op === 'buy') buy(cfg, S, h, op.id, out);
    else if (op.op === 'buff') { buff(cfg, S, h, op); settle(cfg, S, h); }
    else if (op.op === 'unbuff') { unbuff(S, h, op.id); settle(cfg, S, h); }
  }

  /** One pass over the bus's queued intents: stat ops applied and taken off, formulas resolved, events returned. */
  function step(cfg, S) {
    const ops = S._ctrlOps || [];
    const first = !S._statInit;
    if (!ops.length && !first) return [];
    S._statInit = 1;
    const keep = [], out = [];
    let touched = first;
    for (const op of ops) {
      if (op.op in STAT_OPS) { resolveOp(cfg, S.vars, op); apply(cfg, S, op, out); touched = true; }
      else { resolveOp(cfg, S.vars, op); keep.push(op); }
    }
    if (touched) { refreshOpen(cfg, S.vars, out); bodies(cfg, S); }
    S._ctrlOps = keep;
    return out;
  }

  return { STAT_OPS, FIELDS, initVars, step, applyBodies, evalF, nodeOpen, requires, costAt };
}

const _stats = buildStats();
export const STAT_OPS = _stats.STAT_OPS;
export const STAT_FIELDS = _stats.FIELDS;
export const initStatVars = _stats.initVars;
export const stepStats = _stats.step;
export const applyStatBodies = _stats.applyBodies;
export const evalFormula = _stats.evalF;
/** A formula's number for the default holder (or the formula's own `of`). */
export const resolveScaling = (cfg, vars, f, self) => _stats.evalF(cfg, vars, f, { self });
export const nodeOpen = _stats.nodeOpen;
export const costAt = _stats.costAt;
