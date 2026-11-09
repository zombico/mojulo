/**
 * versus move list — a compiled fighter's moves as a player reads them: by kind (its normals and command normals, its
 * specials, its super, its throw), each its name, its input IN THE PLAYER'S SCHEME (the classic's motions, the modern's
 * special button and a direction, the simple's one button), what it is for (the library's own line), and its frame data
 * (startup, active, recovery, on hit, on block, damage, how it is guarded). Pure; a page module (inlined, so the arena
 * builds the list from the fighter it fights with, for the scheme its player picked).
 *
 *   moveList(F, scheme)  → [{ label: { word }, moves: [{ id, name, input, about, data: [{ what: { word }, value }] }] }]
 *                          the shape mana-ui's command-list idiom reads (idioms-fight.js); its labels and its frame
 *                          data's words are the runtime's (WORDS), so a move list is said in the game's language
 *   motionText(motion)   → a motion as arrows ('236' → '↓↘→', '[4]6' → '[←] →': back held, then forward)
 *
 * A move's name is the library's (a family's, a special's: data, as a fighter's name is).
 */
import { NORMAL_SLOTS, COMMAND_SLOTS, NORMAL_FAMILIES, SPECIALS, SUPERS, THROW } from './versus-library.js';

const MOVE_ARROWS = { 1: '↙', 2: '↓', 3: '↘', 4: '←', 6: '→', 7: '↖', 8: '↑', 9: '↗' };
export function motionText(motion) {
  const m = String(motion ?? '');
  if (m[0] === '[') return `[${MOVE_ARROWS[m[1]] ?? m[1]}] ${MOVE_ARROWS[m[3]] ?? m[3]}`;
  return m.split('').map((d) => MOVE_ARROWS[d] ?? d).join('');
}
// the buttons: L M H the attacks (any of them: L·M·H), S the special button (modern, simple), T the throw
const ANY_ATTACK = 'L·M·H';
const SPECIAL_NAMES = { fireball: 'Fireball', rising: 'Rising strike', rush: 'Rush', spin: 'Spinning kick', leap: 'Leaping overhead', slide: 'Slide', roll: 'Roll', blink: 'Blink', hop: 'Hop', boom: 'Charged shot', flash: 'Flip kick', rekka: 'Rekka', grab: 'Command grab' };
const moveTitle = (id) => String(id ?? '').split(/[-_ ]/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
const STAGE_SUFFIX = ['', '', ' II', ' III', ' IV'];
const signedFrames = (n) => (n === null || n === undefined ? '—' : n > 0 ? `+${n}` : `${n}`);
const GUARD_WORDS = { high: 'guardHigh', mid: 'guardMid', low: 'guardLow', overhead: 'guardOverhead', throw: 'guardThrow', none: 'unblockable' };

/** A move's frame data as rows of { what, value } (its words the runtime's). */
function moveFrameData(m) {
  const w = (word) => ({ word });
  const rows = [{ what: w('startup'), value: m.startup }, { what: w('activeFrames'), value: m.active }];
  rows.push(m.airborne ? { what: w('landing'), value: m.landing ?? '—' } : { what: w('recovery'), value: m.recovery });
  const onHit = m.nohit ? w('noHit') : m.knock === 'down' ? w('knockdown') : m.knock === 'launch' ? w('launch') : signedFrames(m.adv?.hit);
  rows.push({ what: w('onHit'), value: onHit }, { what: w('onBlock'), value: m.nohit || m.throw ? '—' : signedFrames(m.adv?.block) });
  // (its total: a shot's per hit times its hits, a super's as compiled, any other's per hit times its hits)
  const total = m.projectile ? m.projectile.damage * (m.projectile.hits ?? 1) : m.kind === 'super' ? m.damage : (m.damage ?? 0) * (m.hits ?? 1);
  rows.push({ what: w('damage'), value: m.nohit ? '—' : Math.round(total) });
  rows.push({ what: w('guard'), value: w(m.nohit ? 'noHit' : m.throw ? 'guardThrow' : GUARD_WORDS[m.guard] ?? 'guardMid') });
  return rows;
}

// a normal's input: the stick's stance and its button (forward + a button a command normal)
function normalInput(slot) {
  const [stance, st] = slot.split('.');
  return stance === 'crouch' ? `↓ + ${st}` : stance === 'air' ? `↑ … ${st}` : stance === 'forward' ? `→ + ${st}` : st;
}
// a special's input in a scheme: the classic's motion and any attack (a rekka its motion again for each stage); the
// modern's and the simple's special button and the slot's direction
const SPECIAL_DIR_ARROW = { neutral: '', forward: ' + →', back: ' + ←', down: ' + ↓' };
function specialInput(m, slot, scheme, stage) {
  const dir = slot.split('.')[1].split('~')[0];
  const once = scheme === 'classic' ? `${motionText(m.motion)} + ${ANY_ATTACK}` : `S${SPECIAL_DIR_ARROW[dir]}`;
  return stage ? `… ${once}` : once;
}

/** The move list for a compiled fighter in a scheme (classic, modern, simple; the limbs scheme reads as the classic). */
export function moveList(F, scheme = 'modern') {
  const sch = scheme === 'limbs' ? 'classic' : scheme;
  const row = (id, name, input, about, m) => ({ id, name, input, about: about ?? '', data: moveFrameData(m) });
  const normals = NORMAL_SLOTS.filter((k) => F.moves[k]).map((k) => {
    const m = F.moves[k];
    return row(k, moveTitle(m.id), sch === 'simple' ? (k.endsWith('.M') ? normalInput(k.replace('.M', '.L')) : null) : normalInput(k), NORMAL_FAMILIES[m.id]?.says, m);
  }).filter((r) => r.input !== null);
  const commands = COMMAND_SLOTS.filter((k) => F.moves[k]).map((k) => row(k, moveTitle(F.moves[k].id), normalInput(k), NORMAL_FAMILIES[F.moves[k].id]?.says, F.moves[k]));
  // (a special at its medium: its strengths share their input; a rekka's later stages under it)
  const specials = Object.keys(F.moves).filter((k) => /^special\.[a-z]+\.M(~\d+)?$/.test(k)).map((k) => {
    const m = F.moves[k], stage = m.stage ?? 0, base = SPECIALS[m.id];
    const about = stage ? base?.stages?.[stage - 1]?.says ?? base?.says : base?.says;
    return row(k, `${SPECIAL_NAMES[m.id] ?? moveTitle(m.id)}${STAGE_SUFFIX[stage] ?? ''}`, specialInput(m, k, sch, stage), about, m);
  });
  const sup = F.moves.super;
  const supers = sup ? [row('super', moveTitle(sup.id), sch === 'classic' ? `${motionText('236236')} + ${ANY_ATTACK}` : sch === 'simple' ? 'S + L' : 'S + H', SUPERS[sup.id]?.says, sup)] : [];
  const thr = F.moves.throw;
  const throws = thr ? [row('throw', 'Throw', sch === 'simple' ? 'T' : 'T  /  L + M', THROW.says, thr)] : [];
  return [
    { label: { word: 'normals' }, moves: normals },
    ...(commands.length ? [{ label: { word: 'commandNormals' }, moves: commands }] : []),
    ...(specials.length ? [{ label: { word: 'specials' }, moves: specials }] : []),
    ...(supers.length ? [{ label: { word: 'supers' }, moves: supers }] : []),
    { label: { word: 'throws' }, moves: throws },
  ];
}
