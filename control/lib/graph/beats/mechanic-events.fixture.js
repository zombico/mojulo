// The events a mechanic surfaces, from the real thing (shared by the game-audio law tests; not a test itself).
import { MECHANIC_KINDS, composeMechanics } from '../game/mechanics.js';
import { getMechanicVocabCatalog } from '../game/mechanic-cards/loader.js';

// ── a mechanic's events, from the real thing: each mechanic card's own example, composed into a winnable level ───
// (a reach-exit beside it; the producers a mechanic needs; the parameter that turns a race's rivals on). A mechanic
// whose card carries no example uses FIXTURE until it gains one.
export const FIXTURE = { push: { kind: 'push', origin: [0, 0, 0], cols: 4, rows: 4, blocks: [[1, 1]], plates: [[2, 2]] } };
export const EXAMPLES = (() => {
  const out = { ...FIXTURE };
  for (const c of getMechanicVocabCatalog().values()) {
    const m = /```json\n([\s\S]*?)```/.exec(c.body);
    if (!m) continue;
    let parsed; try { parsed = JSON.parse(m[1]); } catch { continue; }
    for (const x of Array.isArray(parsed) ? parsed : [parsed]) if (x && MECHANIC_KINDS.includes(x.kind)) out[x.kind] = x;
  }
  return out;
})();
const WITH = { crops: ['clock'], 'defeat-all': ['hp-pool'] };
const TURN_ON = { laps: { rivals: ['rival-1'] } };
// what a level with this mechanic can hear: the events it emits (reactions, watches, timers, sequences), the events
// its reactions listen for (facts such as hit:<id>), and the outcomes its contract ends on
export function surfaced(kind) {
  const exit = { kind: 'reach-exit', at: [30, 0, 0] };
  const list = [{ ...EXAMPLES[kind], ...(TURN_ON[kind] || {}) }, ...(WITH[kind] || []).map((k) => EXAMPLES[k]), ...(kind === 'reach-exit' ? [] : [exit])];
  const r = composeMechanics(list);
  const out = new Set(Object.keys(r.on || {}));
  const walk = (o, key) => {
    if (Array.isArray(o)) return o.forEach((x) => walk(x, key));
    if (!o || typeof o !== 'object' || key === 'sources' || key === 'hud' || key === 'entities') return;
    if (typeof o.type === 'string' && (o.do === 'emit' || key === 'watches' || key === 'timers' || key === 'sequences')) out.add(o.type);
    if (typeof o.on === 'string' && key === 'reactions') out.add(o.on);
    for (const [k, v] of Object.entries(o)) walk(v, k);
  };
  walk(r.events, 'events');
  return { events: [...out].filter((t) => !t.startsWith('__')), outcomes: Object.keys(r.on || {}) };
}
export const globMatch = (pat, t) => (pat === '*' ? true : pat.includes('*') ? new RegExp(`^${pat.split('*').map((x) => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`).test(t) : pat === t);
