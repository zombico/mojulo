/**
 * brawl yard read — the yard's readouts as its HUD reads them (brawl-yard.js's spec): the page's half of the yard's
 * screen, inlined on the page as it is (no imports).
 *
 *   yardHud(read, F, project, inputs?)   → the `brawl.practice` state (brawl-yard.js says what each part is)
 *   inputRun(runs, buttons)              → the input strip's runs after a frame's buttons
 *
 * Pure: no clock, no dice.
 */
const cap = (w) => w[0].toUpperCase() + w.slice(1);
const PRESS = { attack: 'A', strong: 'St', jump: 'J', special: 'S', 'attack + jump': 'A+J', 'attack + special': 'A+S', 'jump + special': 'J+S', 'attack + strong': 'A+St', 'strong + jump': 'St+J', 'strong + special': 'St+S' };
const nameOf = (slot) => (slot === 'desperate' ? 'Desperation' : slot.split('.').map(cap).join(' '));
// the strong blows by what they do (the blow's own name beside it)
const STRONG_WORDS = { strong: 'Strong', 'strong.break': 'Breaker', 'strong.out': 'Blowout', 'strong.air': 'Stomp', 'strong.dive': 'Dive kick', 'run.attack': 'Running' };
const ENDS = { finisher: 'Finisher', breaker: 'Breaker', blowout: 'Blowout' };
/** the chain's blows by name, from its style (brawl-moves.js keeps each blow's source on the move's own `id`) */
const blowName = (slot, F) => {
  const m = F.moves[slot];
  if (m && (slot.startsWith('chain.') || slot.startsWith('air.'))) return cap(String(m.id ?? 'blow').replace(/-/g, ' '));
  if (m && STRONG_WORDS[slot]) return `${STRONG_WORDS[slot]}: ${cap(String(m.id ?? 'blow').replace(/-/g, ' '))}`;
  return nameOf(slot);
};

/** The `brawl.practice` state the yard's HUD reads, from the room's readouts (yardRead), the player's fighter and the
 * page's camera. */
export function yardHud(read, F, project, inputs = []) {
  const n = read.chain.of, landed = read.chain.now.length ? read.chain.now : read.chain.last?.steps ?? [];
  const marks = read.line.filter((d) => !d.ko).map((d) => {
    const [x, y] = project(d.at[0], d.at[1], 0);
    return { id: `d${d.id}`, x, y, text: d.lined ? (d.inReach ? 'LINED' : 'LINED · CLOSER') : `${d.dz > 0 ? '+' : '−'}${Math.round(Math.abs(d.dz) / 10)} CM`, kind: d.lined ? 'heal' : 'miss' };
  });
  const heads = read.line.filter((d) => d.token && !d.ko).map((d) => { const [x, y] = project(d.at[0], d.at[1], 2100); return { id: `t${d.id}`, x, y }; });
  const last = read.chain.last;
  const ended = read.chain.now.length ? '' : !last ? '' : ENDS[last.end] ? `${last.open ? 'Strong opener, ' : ''}${ENDS[last.end]}` : `Dropped: ${last.why}`;
  const presses = read.log.slice(-6).map((e) => ({
    press: PRESS[e.words] ?? e.words,
    // (taken: the move, and how many frames the press waited for the body, held through a hitstop or a recovery)
    verdict: e.verdict === 'taken' ? `${e.what ? blowName(e.what, F) : 'taken'}${e.late ? ` (+${e.late}f)` : ''}${e.note ? `: ${e.note}` : ''}` : `Dropped: ${e.why}`,
    kind: e.verdict === 'taken' ? 'heal' : 'miss',
  }));
  const c = read.clinch;
  return {
    marks, heads,
    beats: Array.from({ length: n }, (_, k) => ({ value: String(k + 1), variant: landed.includes(k + 1) ? 'strong' : 'muted' })),
    ended, presses, inputs,
    clinch: c ? { left: c.left, of: c.of, knees: c.knees, behind: c.back ? 'Suplex' : '', holding: true } : { left: 0, of: 1, knees: 0, behind: '', holding: false },
  };
}

const ARROW = { '-1,-1': '↙', '0,-1': '↓', '1,-1': '↘', '-1,0': '←', '0,0': '•', '1,0': '→', '-1,1': '↖', '0,1': '↑', '1,1': '↗' };
/** The input strip after a frame: a run a direction and its buttons, extended while they stay the same. */
export function inputRun(runs, { x = 0, z = 0, a, h, j, s } = {}) {
  const dir = ARROW[`${Math.sign(x)},${Math.sign(z)}`], btn = [a && 'A', h && 'St', j && 'J', s && 'S'].filter(Boolean).join('+');
  const key = `${dir}${btn}`, last = runs[runs.length - 1];
  if (last && last.key === key) return [...runs.slice(0, -1), { ...last, n: last.n + 1, text: `${dir}${btn ? ` + ${btn}` : ''} (${last.n + 1}f)` }];
  if (key === '•' && !btn && last && last.key === '•') return runs;
  return [...runs, { key, n: 1, text: `${dir}${btn ? ` + ${btn}` : ''}` }].slice(-10);
}
