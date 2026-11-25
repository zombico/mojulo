/**
 * BOSS AUDIO — a boss fight on the director heard, and a metroidvania's held gates (sfx-shelf/boss-sounds.js: the words),
 * inside the audio channel (scene/channels/audio.js: its engine, its cue, its distance gain). It joins what audio a level
 * already has, so a level on no sound sheet hears none of it.
 *
 *   bossAudio(payload, { own?, style?, flavor? }) → { director?, gates? }: a world's audio spec rows (beats-world.js
 *                         resolveWorldAudio checks them), each its gestures by the shelf's words (`own`: the game's
 *                         `sound.bosses`, boss-sounds.js bossSounds), or null: no boss on the director and no held gates
 *   bossAudioScript({ director, gates }) the page's block, each half only where its row is set
 *
 * THE DIRECTOR (`audio.director`: { moves: { <pattern>: { tell?, strike? } }, voices: { <class>: { roar?, hurt?, fall? } },
 * shed?, fall? }), read off each boss every frame (worlds/controllable/boss.js `bossS`): a move laid (`cur`, new) its
 * pattern's wind-up, its first strike landing (`cur.land`) its strike, both where the boss stands; its voice (its rule's
 * `boss.voice`, a class of animal-voices.js) roaring at its first move, at each phase turned and as its second form rises,
 * hurt when struck (held apart, HURT_GAP), dying as its last form falls; a form cut down into the next (`modeIdx` up) the
 * shed, a boss felled its fall (where the run channel says none: a run and gun's `boss` is its own).
 *
 * THE GATES (`audio.gates`: { shut?, open?, breaks: { <gate kind>: cue }, break?, secrets?: [<breakable id>] }), read off the world's held gates
 * (held-gates.js `heldGates`) and its breaks (`breaks`, seq-keyed): a boss's room shut as its fight begins and opened as
 * it ends, a gate's breaking by its kind (a secret wall, one of `secrets`, its own), any other wall broken its `break`.
 */

import { sfxSound } from '../../sfx-shelf/resolve.js';
import { bossSounds, BOSS_VOICE_EVENTS } from '../../sfx-shelf/boss-sounds.js';
import { animalSounds } from '../../sfx-shelf/animal-sounds.js';

export const HURT_GAP = 0.7;

const kept = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v));

/** The level's director and gates rows, or null. */
export function bossAudio(payload, { own = null, style = 'realistic', flavor = null } = {}) {
  const ents = Array.isArray(payload && payload.entities) ? payload.entities : [];
  const K = bossSounds(own), cue = (w) => (w ? sfxSound(w, { style, flavor })?.gestures ?? null : null);
  // (each boss's rule and its modes' rules: their patterns and their voices)
  const rules = ents.flatMap((e) => [e?.rule?.boss, ...((e?.body?.modes ?? []).map((m) => m?.rule?.boss))]).filter((b) => b && b.moves);
  const out = {};
  if (rules.length) {
    const pats = new Set(rules.flatMap((b) => Object.values(b.moves).map((m) => m && m.pattern).filter(Boolean)));
    const moves = {};
    for (const p of [...pats].sort()) { const W = K.patterns[p]; if (!W) continue; const M = kept({ tell: cue(W.tell), strike: cue(W.strike) }); if (Object.keys(M).length) moves[p] = M; }
    const voices = {};
    for (const v of [...new Set(rules.map((b) => b.voice).filter((x) => typeof x === 'string'))].sort()) {
      const A = animalSounds(v); if (!A) continue;
      const V = kept(Object.fromEntries(Object.entries(BOSS_VOICE_EVENTS).map(([ev, call]) => [ev, cue(A[call])])));
      if (Object.keys(V).length) voices[v] = V;
    }
    const D = kept({ shed: cue(K.shared.shed), fall: cue(K.shared.fall) });
    if (Object.keys(moves).length || Object.keys(voices).length || Object.keys(D).length) out.director = { moves, voices, ...D };
  }
  if (payload && payload.heldGates) {
    const kinds = new Set((payload.heldGates.gates ?? []).map((g) => g && g.kind).filter(Boolean));
    // (a SECRET wall: a breakable of the world that no held gate holds and no boss is, found by blows: metroidvania/scene.js)
    const held = new Set([...(payload.heldGates.gates ?? []), ...(payload.heldGates.bosses ?? [])].map((g) => g && g.id));
    const secrets = (Array.isArray(payload.breakables) ? payload.breakables : []).map((b) => b && b.id).filter((id) => typeof id === 'string' && !held.has(id)).sort();
    if (secrets.length) kinds.add('secret');
    const breaks = kept(Object.fromEntries([...kinds].sort().map((k) => [k, cue(K.gates[k])])));
    const G = kept({ shut: cue(K.gates.shut), open: cue(K.gates.open), break: cue(K.gates.break) });
    if (Object.keys(breaks).length || Object.keys(G).length) out.gates = { ...G, breaks, ...(secrets.length && breaks.secret ? { secrets } : {}) };
  }
  return Object.keys(out).length ? out : null;
}

export function bossAudioScript({ director = false, gates = false } = {}) {
  return `${director ? `
// A BOSS FIGHT HEARD (boss-audio.js): each move's wind-up and its strike, the boss's voice, its second form, its fall. Read-only.
(function () {
  const D = __AUDIO.director, HURT_GAP = ${HURT_GAP}, L = {};
  const play = (g, at) => { if (g) __beatsCue(g, at ? __proxGain(at) : null); };
  (function __beatsDirector() {
    requestAnimationFrame(__beatsDirector);
    if (!__beatsEng || __beatsMuted) return;
    const W = window.__mojCtrl && window.__mojCtrl.world;
    if (!W) return;
    const now = W.time || 0;
    for (const e of W.entities || []) {
      const B = e && e.rule && e.rule.boss, S = e && e.bossS;
      if (!B || !e.transform) continue;
      const at = e.transform.pos, V = (B.voice && D.voices[B.voice]) || null, hp = e.body && Number.isFinite(e.body.hp) ? e.body.hp : null;
      const l = L[e.id] || (L[e.id] = { t0: S && S.cur ? S.cur.t0 : null, struck: true, count: S ? S.count || 0 : 0, phase: S ? S.phase || 0 : 0, mode: e.modeIdx || 0, hp, down: !!e.downed, hurtT: -1e9 });
      const cur = S && S.cur;
      if (cur && cur.t0 !== l.t0) {
        l.t0 = cur.t0; l.struck = false;
        const M = cur.pattern && D.moves[cur.pattern];
        play(M && M.tell, at);
        if ((S.count || 0) === 1 && V) play(V.roar, at);
      }
      if (cur && !l.struck && now >= cur.land) { l.struck = true; const M = cur.pattern && D.moves[cur.pattern]; play(M && M.strike, at); }
      if (S && (S.phase || 0) > l.phase && V) play(V.roar, at);
      if ((e.modeIdx || 0) > l.mode) { play(D.shed, at); if (V) play(V.roar, at); }
      if (hp != null && l.hp != null && hp < l.hp && !e.downed && V && now - l.hurtT > HURT_GAP) { l.hurtT = now; play(V.hurt, at); }
      if (e.downed && !l.down) { if (V) play(V.fall, at); if (!(__AUDIO.run && __AUDIO.run.boss)) play(D.fall, at); }
      l.phase = S ? S.phase || 0 : 0; l.mode = e.modeIdx || 0; l.hp = hp; l.down = !!e.downed;
    }
  })();
})();
` : ''}${gates ? `
// THE HELD GATES HEARD (boss-audio.js): a boss's room shut and opened, a gate broken by its kind, a wall struck down. Read-only.
(function () {
  const G = __AUDIO.gates, B = G.breaks || {};
  let fight = undefined, seq = null, kind = null, bosses = null;
  (function __beatsGates() {
    requestAnimationFrame(__beatsGates);
    if (!__beatsEng) return;
    const W = window.__mojCtrl && window.__mojCtrl.world, H = W && W.heldGates;
    if (!W) return;
    if (H && !kind) { kind = {}; bosses = {}; for (const g of (H.spec && H.spec.gates) || []) kind[g.id] = g.kind; for (const b of (H.spec && H.spec.bosses) || []) bosses[b.id] = 1; for (const id of G.secrets || []) kind[id] = 'secret'; }
    const f = H ? H.fight || null : null;
    if (fight !== undefined && f !== fight && !__beatsMuted) __beatsCue(f ? G.shut : G.open);
    fight = f;
    const top = W.breaks && W.breaks.length ? W.breaks[W.breaks.length - 1].seq : -1;
    if (seq !== null && !__beatsMuted) for (const b of W.breaks || []) {
      if (b.seq <= seq || (bosses && bosses[b.id])) continue;
      const k = kind && kind[b.id];
      __beatsCue(k ? B[k] : G.break, __proxGain(b.at));
    }
    seq = Math.max(seq === null ? -1 : seq, top);
  })();
})();
` : ''}`;
}
