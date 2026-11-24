/**
 * prompt.js — THE QUICK-TIME PROMPT: a beat a body cannot do on the stick alone (the grab at the far edge, the climb as
 * the bridge tips, the struggle), asked of the player as one button in a window, and what a miss costs.
 *
 *   spec.prompts: [{ id, kind?, button?, says?, lead?, window?, count?, hold?, dir?, slow?, miss?, back?, hurt? }]
 *     says     the word under the button (Grab, Climb): what the press does, as the screen says it (24 letters)
 *     kind     'press' (one press inside the window, the default) | 'mash' (`count` presses inside it) | 'hold' (held
 *              `hold` seconds without letting go, inside it) | 'aim' (the stick pushed toward `dir`: up | down | left |
 *              right, the screen's)
 *     button   the input it asks for (PROMPT_BUTTONS; 'act' the default); while the prompt is up the button does only this
 *     lead     seconds it is shown before its window opens (0.5): told, never sprung
 *     window   seconds it is open (0.8)
 *     slow     the world's speed while it is up (0 … 1): the world crawls, the prompt's clock is the screen's
 *     miss     'checkpoint' (the default: the hero put back at `back`, or where it stood as the prompt came up, and a
 *              chase line holding it let go to take it again) | 'hurt' (`hurt` hp taken) | 'on' (nothing: play goes on)
 *
 *   promptFire(state, id)   brings a prompt up (true when it did); a cue's effect does it on the bus ({ op: 'prompt',
 *                           id }, castOps wrapped)
 *   state.prompt: { up: { id, kind, button, t, opens, closes, n, held, dir? } | null, results: { id: 'hit' | 'miss' } }
 *                 `t` is the screen's seconds since it came up: the page draws it from this (the ring closing)
 *
 * The bus hears `prompt:<id>:up`, `prompt:<id>:hit`, `prompt:<id>:miss` (castFacts, wrapped). Its clock is the screen's,
 * so under a slowed world the window is as long as it says. A press before the window opens counts for nothing, and
 * a press after it is a miss already said. One prompt is up at a time; one fired while another is up waits for nothing:
 * it is refused.
 *
 *   readPrompts(raw)  → the spec, read and held to the prompt's laws (throws naming the law), outside the builder:
 *     told         lead ≥ 0.35 s
 *     fair         window ≥ 0.4 s; a mash no faster than 8 presses a second; a hold shorter than its window by 0.15 s
 *     one thing    one button
 *     recoverable  a miss says what it costs (checkpoint, hurt or on)
 *
 * Wraps stepWorld, castOps and castFacts. Import-free inside the builder (the page runs its source via toString(),
 * compose.js); emitted only into a page whose world has prompts, so every other page keeps every byte. Pure state.
 */
export const PROMPT_BUTTONS = Object.freeze(['act', 'jump', 'fire', 'melee', 'dive', 'boost']);
export const PROMPT_KINDS = Object.freeze(['press', 'mash', 'hold', 'aim']);
export const PROMPT_LAWS = Object.freeze({ lead: 0.35, window: 0.4, mashRate: 8, holdSpare: 0.15 });
export const PROMPT_REST = Object.freeze({ lead: 0.5, window: 0.8, count: 5, hold: 0.5 });
const DIRS = ['up', 'down', 'left', 'right'];
const MISSES = ['checkpoint', 'hurt', 'on'];
const num = (v) => typeof v === 'number' && Number.isFinite(v);

/** A world's prompts, read and held to the prompt's laws (see the header). */
export function readPrompts(raw) {
  if (raw === undefined || raw === null || raw === false) return null;
  const list = Array.isArray(raw) ? raw : null;
  if (!list || !list.length) throw new Error('prompts: [{ id, kind?, button?, lead?, window?, … }]');
  const ids = new Set();
  return list.map((P, i) => {
    const at = `prompts[${i}]`;
    if (!P || typeof P.id !== 'string' || !P.id) throw new Error(`${at}: an id`);
    if (ids.has(P.id)) throw new Error(`${at}: '${P.id}' twice`);
    ids.add(P.id);
    const kind = P.kind ?? 'press', button = P.button ?? 'act';
    if (!PROMPT_KINDS.includes(kind)) throw new Error(`${at}: kind is ${PROMPT_KINDS.join(' | ')}`);
    if (Array.isArray(button)) throw new Error(`${at}: one thing: a prompt asks for one button`);
    if (kind !== 'aim' && !PROMPT_BUTTONS.includes(button)) throw new Error(`${at}: button is ${PROMPT_BUTTONS.join(' | ')}`);
    const lead = P.lead ?? PROMPT_REST.lead, window = P.window ?? PROMPT_REST.window;
    if (!num(lead) || lead < PROMPT_LAWS.lead) throw new Error(`${at}: told: shown at least ${PROMPT_LAWS.lead} s before it opens (lead)`);
    if (!num(window) || window < PROMPT_LAWS.window) throw new Error(`${at}: fair: open at least ${PROMPT_LAWS.window} s (window)`);
    if (P.says != null && (typeof P.says !== 'string' || P.says.length > 24)) throw new Error(`${at}: says is a word or two (24 letters)`);
    const out = { id: P.id, kind, ...(kind !== 'aim' ? { button } : {}), ...(P.says ? { says: P.says } : {}), lead, window };
    if (kind === 'mash') {
      const count = P.count ?? PROMPT_REST.count;
      if (!Number.isInteger(count) || count < 2) throw new Error(`${at}: a mash counts 2 or more presses`);
      if (count / window > PROMPT_LAWS.mashRate) throw new Error(`${at}: fair: a mash no faster than ${PROMPT_LAWS.mashRate} presses a second (${count} in ${window} s)`);
      out.count = count;
    }
    if (kind === 'hold') {
      const hold = P.hold ?? PROMPT_REST.hold;
      if (!num(hold) || hold <= 0 || hold > window - PROMPT_LAWS.holdSpare) throw new Error(`${at}: fair: a hold shorter than its window by ${PROMPT_LAWS.holdSpare} s`);
      out.hold = hold;
    }
    if (kind === 'aim') {
      if (!DIRS.includes(P.dir)) throw new Error(`${at}: an aim's dir is ${DIRS.join(' | ')}`);
      out.dir = P.dir;
    }
    if (P.slow != null) { if (!num(P.slow) || P.slow < 0 || P.slow > 1) throw new Error(`${at}: slow is the world's speed 0 … 1`); out.slow = P.slow; }
    const miss = P.miss ?? 'checkpoint';
    if (!MISSES.includes(miss)) throw new Error(`${at}: recoverable: a miss is ${MISSES.join(' | ')}`);
    out.miss = miss;
    if (miss === 'checkpoint' && P.back != null) {
      if (!Array.isArray(P.back) || P.back.length !== 3 || !P.back.every(num)) throw new Error(`${at}: back is a place [x, y, z]`);
      out.back = P.back.slice();
    }
    if (miss === 'hurt') { const hurt = P.hurt ?? 25; if (!num(hurt) || hurt <= 0) throw new Error(`${at}: hurt is hp taken`); out.hurt = hurt; }
    return out;
  });
}

export function buildPrompt(E) {
  E.registerStateInit((state, spec) => {
    const L = spec && Array.isArray(spec.prompts) ? spec.prompts.filter((P) => P && P.id) : [];
    if (!L.length) return;
    state.prompt = { list: L, up: null, results: {}, ev: [] };
  });
  const said = (S, type) => { S.ev.push(type); if (S.ev.length > 16) S.ev.shift(); };

  function fire(state, id) {
    const S = state.prompt, P = S && S.list.find((x) => x.id === id), p = state.pilotId && state.byId[state.pilotId];
    if (!P || S.up) return false;
    S.up = { id: P.id, kind: P.kind, ...(P.button ? { button: P.button } : {}), ...(P.dir ? { dir: P.dir } : {}), t: 0, opens: P.lead, closes: P.lead + P.window, n: 0, held: 0, was: true,
      at: p ? p.transform.pos.slice() : null, P };
    said(S, 'prompt:' + P.id + ':up');
    if (P.slow != null && state.tempo && E.tempoMoment) E.tempoMoment(state, 'prompt:' + P.id);
    return true;
  }
  function settle(state, hit) {
    const S = state.prompt, U = S.up, P = U.P, p = state.pilotId && state.byId[state.pilotId];
    S.up = null;
    S.results[P.id] = hit ? 'hit' : 'miss';
    said(S, 'prompt:' + P.id + ':' + (hit ? 'hit' : 'miss'));
    if (P.slow != null && state.tempo && E.tempoEnd) E.tempoEnd(state, 'prompt:' + P.id);
    if (hit || !p) return;
    if (P.miss === 'hurt') { if (p.body && typeof p.body.hp === 'number') { p.body.hp = Math.max(0, p.body.hp - P.hurt); if (p.body.hp <= 0) p.downed = true; } }   // (emptied, downed as a blow downs)
    else if (P.miss === 'checkpoint') {
      const to = P.back || U.at;
      if (to) { p.transform.pos[0] = to[0]; p.transform.pos[1] = to[1]; p.transform.pos[2] = to[2]; }
      if (p.vel) { p.vel[0] = 0; p.vel[1] = 0; p.vel[2] = 0; }
      // (a chase line holding the hero lets it go, to take it again from the checkpoint)
      if (E.chaseReset) E.chaseReset(state);
    }
  }
  E.promptFire = (state, id) => fire(state, id);

  // the prompt's own press: the button's edge, the stick's push for an aim
  const pushed = (input, dir) => {
    const f = input.forward || 0, s = input.strafe || 0;
    return dir === 'up' ? f > 0.6 : dir === 'down' ? f < -0.6 : dir === 'right' ? s > 0.6 : s < -0.6;
  };

  const step = E.stepWorld;
  E.stepWorld = function stepWithPrompt(state, input, dt, hooks) {
    const S = state.prompt;
    if (!S || !S.up) return step(state, input, dt, hooks);
    const U = S.up, P = U.P;
    // the screen's clock: the world's step undone by the world clock's scale where it has one
    const sc = state.tempo && typeof state.tempo.scale === 'number' ? Math.max(1e-6, state.tempo.scale) : 1;
    U.t += (dt || 0) / sc;
    const down = P.kind === 'aim' ? pushed(input || {}, P.dir) : !!(input && input[P.button]);
    const edge = down && !U.was;
    U.was = down;
    const open = U.t >= U.opens && U.t < U.closes;
    if (open) {
      if (P.kind === 'press' && edge) settle(state, true);
      else if (P.kind === 'aim' && down) settle(state, true);
      else if (P.kind === 'mash' && edge && ++U.n >= P.count) settle(state, true);
      else if (P.kind === 'hold') { U.held = down ? U.held + (dt || 0) / sc : 0; if (U.held >= P.hold) settle(state, true); }
    } else if (U.t >= U.closes) settle(state, false);
    // while it is up its button does only this
    const own = P.button && input ? { ...input, [P.button]: 0 } : input;
    return step(state, own, dt, hooks);
  };

  const baseOps = E.castOps;
  E.castOps = function castOps(state, ops) {
    const rest = [];
    for (const o of ops || []) { if (o && o.op === 'prompt' && typeof o.id === 'string') fire(state, o.id); else rest.push(o); }
    return baseOps(state, rest);
  };

  const baseFacts = E.castFacts;
  E.castFacts = function castFacts(state, prev) {
    const out = baseFacts(state, prev), S = state.prompt;
    if (!S || !S.ev.length) return out;
    for (const type of S.ev) out.events.push({ type, entity: state.pilotId });
    S.ev.length = 0;
    return out;
  };
}
