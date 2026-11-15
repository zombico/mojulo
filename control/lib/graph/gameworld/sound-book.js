/**
 * THE SOUND BOOK — a game's sound sheet (sound-sheet.js), read and heard: every sound the game plays, the shelf word
 * that plays it, why, and a button that sounds it on the kernel the game ships (beats-kernel.js). The gameworld bible's
 * sibling (`/api/sketches/<ref>/bible?book=sound`), the play department's page for the ears gate: a person listens here
 * before (or beside) the game.
 *
 *   soundBook(world)      → { name, on, style, rows: [{ group, what, word, label, why, kind: 'cue' | 'held', id }],
 *                           levels: [{ level, step, bed }], owed, taste (audio-direction.js tasteNotes), cues: { <id>: [gesture…] }, held: { <id>: spec } }
 *   soundBookHtml(world)  → the page (self-contained: the kernel with only the features its sounds use)
 *
 * A world on no sheet (no `sound`, no quick `sfx: 'sheet'`) is shown the sheet it would have, said as a suggestion:
 * nothing is laid behind its back. Pure but for nothing: no database, no clock.
 */
import { soundSheet, sheetBed, onSheet, rideSound } from './sound-sheet.js';
import { quickGuns } from './quick.js';
import { tasteNotes } from './audio-direction.js';
import { readGameworld } from './world.js';
import { gameStages } from './levels.js';
import { sfxSound } from '../sfx-shelf/resolve.js';
import { SOUNDS, resolveSoundId } from '../sfx-shelf/roster.js';
import { BEDS } from '../sfx-shelf/beds.js';
import { MECHANIC_SFX } from '../beats/sfx-palettes.js';
import { emitBeatsKernel } from '../beats/beats-kernel.js';
import { audioFeatures } from '../beats/beats-features.js';
import { safeJson } from '../scene/emit-util.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SLOT_NAMES = Object.freeze({ step: 'a step', jump: 'a jump', land: 'a landing', dodge: 'a dodge', swing: 'a swing', strike: 'a blow landing' });
const MOVE_NAMES = Object.freeze({ block: 'a blow blocked', parry: 'a parry', break: 'the guard broken', draw: 'the bow drawn', loose: 'an arrow loosed', arrow: 'an arrow striking home', felled: 'a foe felled', cycle: 'the weapon changed', foeSwing: 'a foe\'s swing', hurt: 'a blow taken' });
const FOE_NAMES = Object.freeze({ attack: 'attacks', hurt: 'is struck', down: 'falls' });
const GUN_NAMES = Object.freeze({ shot: 'shot', reload: 'reload', hit: 'round landing', draw: 'draw' });
// every palette cue id a level's mechanics can play (sfx-palettes.js MECHANIC_SFX), once each: the game's events
const EVENT_CUES = Object.freeze([...new Set(Object.values(MECHANIC_SFX).flatMap((m) => Object.values(m)))]);

/** The book's data (see the header). */
export function soundBook(world) {
  const G = readGameworld(world), on = onSheet(G);
  let stages = [];
  try { stages = gameStages(world).filter((s) => !s.building?.ref); } catch { stages = []; }
  const first = stages[0]?.manifest ?? null;
  const S = soundSheet(G, { manifest: first });
  const rows = [], cues = {}, held = {};
  const add = (group, what, word, why, style = S.style) => {
    const rid = resolveSoundId(word), v = rid ? sfxSound(word, { style }) : null;
    if (!v) return;
    const id = `${style}:${rid}`, kind = v.sustain ? 'held' : 'cue';
    if (kind === 'held') held[id] = v.sustain; else if (v.gestures) cues[id] = v.gestures; else return;
    rows.push({ group, what, word: rid, label: SOUNDS[rid]?.label ?? rid, why: why ?? '', kind, id, voiced: SOUNDS[rid]?.voices?.[style] ? style : `${style} has none: its fallback` });
  };
  // the hero: the gait and the dodge; the two strike slots where the game has no arsenal
  for (const k of ['step', 'jump', 'land', 'dodge']) add('The hero', SLOT_NAMES[k], S.slots[k], S.why[k]);
  if (S.moves) {
    for (const [w, W] of Object.entries(S.moves.swing)) for (const [weight, word] of Object.entries(W)) if (weight !== 'finisher' || word !== W.heavy) add('The arsenal', `${w}: a ${weight} swing`, word, S.why[`weapon:${w}`]);
    for (const [w, W] of Object.entries(S.moves.hit)) for (const [weight, word] of Object.entries(W)) if (weight !== 'heavy' || word !== W.light) add('The arsenal', `${w}: a ${weight} blow`, word, S.why[`weapon:${w}`]);
    for (const [ev, name] of Object.entries(MOVE_NAMES)) if (S.moves[ev]) add('The arsenal', name, S.moves[ev], '');
  } else for (const k of ['swing', 'strike']) add('The hero', SLOT_NAMES[k], S.slots[k], S.why[k]);
  // its guns (a quick shooter's carried kit) and its ride, where the recipe says them without a run
  const Q = G.quick ?? null;
  if (Q) {
    // (a quick shooter's carried guns, each by what it is: quick.js quickGuns, as its levels carry them)
    const guns = quickGuns({ ...G, sound: G.sound ?? {} }, { ...Q, sfx: undefined });
    for (const [name, o] of Object.entries(guns?.sfx ?? {})) for (const [k, g] of Object.entries(o)) {
      const own = G.sound?.guns?.[name]?.[k], id = `gun:${name}:${k}`;
      cues[id] = g;
      rows.push({ group: 'The guns', what: `${name}: ${GUN_NAMES[k]}`, word: own ? resolveSoundId(own) : k === 'reload' ? 'mag out, mag in, rack' : 'by what it is', label: own ? SOUNDS[resolveSoundId(own)]?.label ?? '' : k === 'shot' ? 'its cartridge\'s shot' : k === 'reload' ? 'over the gun\'s own reload time' : k === 'hit' ? 'a round landing on a body' : 'the weapon drawn', why: own ? 'the game says so' : '', kind: 'cue', id, voiced: S.style });
    }
  }
  if (Q?.ride) { const R = rideSound({ ...G, sound: G.sound ?? {} }, { words: [Q.ride, Q.vehicle].filter(Boolean).join(' '), top: 1, quick: { ...Q, sfx: undefined } }); if (R) add('The ride', 'its engine, by its speed', R.engine.voice, R.why); }
  // its foes
  for (const [f, o] of Object.entries(S.foeSounds)) for (const [k, word] of Object.entries(o)) add('The foes', `${f} ${FOE_NAMES[k]}`, word, S.why[`foe:${f}:sounds`]);
  if (S.on.alarm) add('The foes', 'the hero is spotted', S.on.alarm, S.why.alarm);
  // the game's events: each cue a level's mechanics can play, by the sheet's word for it or the shelf's row of its id
  for (const c of EVENT_CUES) if (c !== 'alarm' || !S.on.alarm) add('The game\'s events', c, S.on[c] ?? c, S.why[c] ?? '');
  // each level's ground and bed
  const levels = stages.map((s) => {
    const L = soundSheet(G, { manifest: s.manifest ?? null }), bed = sheetBed(G, { manifest: s.manifest ?? null });
    return { level: `${s.level}${stages.filter((x) => x.level === s.level).length > 1 ? ` · ${s.index + 1}` : ''}`, step: L.slots.step, stepWhy: L.why.step, bed: bed ? { id: bed, label: BEDS[bed]?.label ?? bed } : null };
  });
  // (the ground where it differs from level to level: one row a ground, the levels that walk it; one ground a game is
  // the hero's step above)
  const grounds = [...new Set(levels.map((L) => L.step))];
  if (grounds.length > 1) for (const g of grounds) { const on = levels.filter((L) => L.step === g); add('The ground', `a step on ${on.map((L) => L.level).join(', ')}`, g, on[0].stepWhy); }
  const seen = new Set();
  return { name: G.name ?? G.id ?? 'This game', on, style: S.style, rows: rows.filter((r) => { const k = `${r.group}|${r.what}`; if (seen.has(k)) return false; seen.add(k); return true; }), levels, owed: S.owed, taste: tasteNotes(G, S), cues, held };
}

const CSS = `:root{--paper:#f6f4ee;--sheet:#fff;--ink:#1c1b19;--muted:#6b675f;--rule:#d9d4c7;--accent:#0f6b5c}
@media (prefers-color-scheme:dark){:root{--paper:#141412;--sheet:#1d1c1a;--ink:#ebe8e0;--muted:#9a958a;--rule:#34322d;--accent:#5fd0b8}}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.5 system-ui,sans-serif}
main{max-width:980px;margin:0 auto;padding:28px 16px 64px}h1{font-size:26px;margin:0 0 4px}h2{font-size:16px;margin:28px 0 8px;color:var(--accent);letter-spacing:.04em;text-transform:uppercase}
p.lede{color:var(--muted);margin:0 0 8px;max-width:70ch}.note{background:var(--sheet);border:1px solid var(--rule);border-left:3px solid var(--accent);padding:10px 12px;border-radius:6px;margin:12px 0}
.wrap{overflow-x:auto;background:var(--sheet);border:1px solid var(--rule);border-radius:8px}table{border-collapse:collapse;width:100%;min-width:560px}
td,th{text-align:left;padding:7px 10px;border-bottom:1px solid var(--rule);vertical-align:top}th{font-size:12px;color:var(--muted);font-weight:600}tr:last-child td{border-bottom:0}
td.why{color:var(--muted);font-size:13px}code{font:13px ui-monospace,monospace}
button.play{font:inherit;border:1px solid var(--rule);background:var(--paper);color:var(--ink);border-radius:999px;padding:2px 12px;cursor:pointer;min-width:64px}
button.play:hover{border-color:var(--accent)}button.play.on{background:var(--accent);color:var(--paper);border-color:var(--accent)}ul{margin:6px 0;padding-left:20px}`;

/** The page (see the header). */
export function soundBookHtml(world) {
  const B = soundBook(world);
  const groups = [...new Set(B.rows.map((r) => r.group))];
  const table = (g) => `<h2>${esc(g)}</h2><div class="wrap"><table><tr><th>when</th><th>the sound</th><th>why</th><th></th></tr>${B.rows.filter((r) => r.group === g).map((r) =>
    `<tr><td>${esc(r.what)}</td><td><code>${esc(r.word)}</code><br>${esc(r.label)}</td><td class="why">${esc(r.why)}${r.voiced === B.style || r.kind === 'held' ? '' : `${r.why ? ' · ' : ''}${esc(r.voiced)}`}</td><td><button class="play" data-kind="${r.kind}" data-id="${esc(r.id)}">${r.kind === 'held' ? 'rev' : 'play'}</button></td></tr>`).join('')}</table></div>`;
  const beds = B.levels.filter((L) => L.bed);
  const bedIds = [...new Set(beds.map((L) => L.bed.id))];
  const source = emitBeatsKernel(audioFeatures({ cues: B.cues, sustains: B.held, vary: true }));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(B.name)}: sound</title><style>${CSS}</style></head><body><main>
<h1>${esc(B.name)}: the sound</h1>
<p class="lede">Every sound this game plays, the word on the SFX shelf that plays it, and why. Style: <code>${esc(B.style)}</code> (a sound the style does not voice plays its fallback). Press a row to hear it as the game plays it.</p>
${B.on ? '' : '<div class="note">This game is on no sound sheet yet: its levels are built without these sounds. Writing a <code>sound</code> of its own (even <code>sound: {}</code>) lays this sheet on every level it builds.</div>'}
${groups.map(table).join('\n')}
${bedIds.length ? `<h2>The beds</h2><div class="wrap"><table><tr><th>under the score</th><th>levels</th></tr>${bedIds.map((id) => { const on = beds.filter((L) => L.bed.id === id); return `<tr><td><code>${esc(id)}</code><br>${esc(on[0].bed.label === id ? '' : on[0].bed.label)}</td><td class="why">${on.length === B.levels.length ? 'every level' : esc(on.map((L) => L.level).join(', '))}</td></tr>`; }).join('')}</table></div>` : ''}
${B.taste.length ? `<h2>The music department says</h2><p class="lede">Advice against the game's audio direction. Play decides.</p><ul>${B.taste.map((o) => `<li>${esc(o)}</li>`).join('')}</ul>` : ''}
${B.owed.length ? `<h2>Owed</h2><ul>${B.owed.map((o) => `<li>${esc(o)}</li>`).join('')}</ul>` : ''}
</main><script>
const K = (${source})(), CUES = ${safeJson(B.cues)}, HELD = ${safeJson(B.held)};
let ctx = null, eng = null, n = 0;
const engine = () => { if (!eng) { const C = window.AudioContext || window.webkitAudioContext; ctx = new C(); eng = K.createEngine(ctx); } if (ctx.state === 'suspended') ctx.resume(); return eng; };
for (const b of document.querySelectorAll('button.play')) b.addEventListener('click', () => {
  const E = engine(), id = b.dataset.id;
  if (b.dataset.kind === 'cue') { if (CUES[id]) E.playCue(CUES[id], undefined, undefined, undefined, n++); return; }
  // a held voice: revved from idle to flat out and back over three seconds
  if (b.classList.contains('on') || !HELD[id]) return;
  const h = E.sustain(Object.assign({}, HELD[id], { level: (HELD[id].level == null ? 1 : HELD[id].level) * 0.3 })), t0 = performance.now();
  b.classList.add('on');
  (function rev() { const t = (performance.now() - t0) / 3000; if (t >= 1) { h.stop(); b.classList.remove('on'); return; } h.set(0.1 + 0.9 * Math.sin(Math.PI * t)); requestAnimationFrame(rev); })();
});
</script></body></html>`;
}
