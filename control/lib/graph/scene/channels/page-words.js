/**
 * page-words — the words the World page's own code writes (the quest toast's "new quest", the skip hint, the shop's
 * "Sold out."), and how a page served in a language says them (game/game-languages.js pageLocale). Data words ride the
 * payload and are swapped there (game/level-words.js); these are code, so they are localized where the code is: each
 * SITE is an exact snippet of a channel's emitted code and `make`, which writes the snippet again from its words. A
 * page with a language has each site of each channel it emits rewritten with the language's words; a page without one
 * is never touched, so it is byte for byte as it was.
 *
 * `make(w)` with the words as written gives the snippet back exactly (held by page-words.test.js against each channel's
 * real output): a site can neither drift from its code nor escape its words differently from it. The words go through
 * the escaping their place needs: markup (innerHTML), a single-quoted string (with \u escapes where the code has them),
 * a template literal's text; a sentence with a number in it is a template whose {slot} stays live code.
 *
 *   PAGE_WORDS                          { <channel>: [word, …] } the words each channel writes, as the localizer sees them
 *   LEGEND_WORDS                        the controls legend's words a page sends the shell (the shell shows them)
 *   localizeChannel(channel, code, locale) → the channel's code in the locale ({ words, number }); `code` if it has none
 *   numberFormat(number)                → the expression source that draws a HUD number in the locale's separators
 */

const html = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// inside '…': the quote, the backslash and line breaks escaped; `u`: every non-ASCII character as \uXXXX (the code's own
// spelling where it writes ↑ as \u2191), else written as itself
const sq = (s, u = false) => {
  let out = String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/<\//g, '<\\/');
  if (u) out = out.replace(/[^\x20-\x7e]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
  return out;
};
// inside a template literal's text: the backtick, the backslash and an opening ${ escaped
const tpl = (s) => String(s).replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
// a sentence with slots, split into its text and its slots in order: 'Score {score}' → ['Score ', { slot: 'score' }, '']
const pieces = (s) => String(s).split(/(\{\w+\})/).map((p) => (/^\{\w+\}$/.test(p) ? { slot: p.slice(1, -1) } : p));
// a sentence as a JS expression of '…' pieces and its slots' code, joined with +: the pieces as the code writes them.
// `pre`: what the code's first string already holds before the sentence (markup), kept at its head
function joined(s, code, esc, pre = '') {
  const out = pieces(s).filter((p) => p !== '').map((p) => (typeof p === 'string' ? `'${esc(p)}'` : code[p.slot]));
  if (out.length && out[0].startsWith("'")) out[0] = `'${pre}` + out[0].slice(1);
  else out.unshift(`'${pre}'`);
  return out.join(' + ');
}
// a sentence in a template literal's text: its pieces as text, its slots as ${…}
const inTpl = (s, code) => pieces(s).map((p) => (typeof p === 'string' ? tpl(html(p)) : '${' + code[p.slot] + '}')).join('');

// each channel's sites: the exact snippet its emitted code carries, the words in it, and how the snippet is written from
// them. `w(word)` is the word in the page's language (the word as written when it has none)
export const SITES = {
  // the quest journal and toast (scene/channels/quest-channel.js)
  quest: [
    { words: ['journal'], code: "<h3>journal</h3>", make: (w) => `<h3>${sq(html(w('journal')))}</h3>` },
    { words: ['new quest', 'done', 'quest complete'], code: "const __qWord = { begun: 'new quest', step: 'done', done: 'quest complete' };",
      make: (w) => `const __qWord = { begun: '${sq(w('new quest'))}', step: '${sq(w('done'))}', done: '${sq(w('quest complete'))}' };` },
    { words: ['nothing yet'], code: "d.textContent = 'nothing yet';", make: (w) => `d.textContent = '${sq(w('nothing yet'))}';` },
    { words: ['J journal'], code: "j.textContent = 'J journal';", make: (w) => `j.textContent = '${sq(w('J journal'))}';` },
  ],
  // the scene's hint under the box (scene/channels/scene-channel.js)
  scene: [
    { words: ['hold Space or Esc to skip'], code: "'hold Space or Esc to skip'", count: 2, make: (w) => `'${sq(w('hold Space or Esc to skip'))}'` },
    { words: ['choose: ↑↓ or 1–{n}, then Space'], code: "'choose: \\u2191\\u2193 or 1\\u2013' + v.choice.options.length + ', then Space'",
      make: (w) => joined(w('choose: ↑↓ or 1–{n}, then Space'), { n: 'v.choice.options.length' }, (p) => sq(p, true)) },
  ],
  // the word beside the interact key when the place names none (scene/channels/interact-channel.js reachScript)
  reach: [
    { words: ['use'], code: "(top.prompt || 'use')", make: (w) => `(top.prompt || '${sq(w('use'))}')` },
  ],
  // the menus' own words (playscape/ui/menus.js menuHtml, shipped whole into the page): markup in template literals
  menu: [
    { words: ['next ▸', 'close'], code: "${p + 1 < n ? 'next ▸' : 'close'}` : 'close'}",
      make: (w) => `\${p + 1 < n ? '${sq(html(w('next ▸')))}' : '${sq(html(w('close')))}'}\` : '${sq(html(w('close')))}'}` },
    { words: ['Empty.', 'Sold out.', 'Nothing carried.'], count: 2, code: "${m.kind === 'chest' ? 'Empty.' : m.kind === 'shop' ? 'Sold out.' : 'Nothing carried.'}",
      make: (w) => `\${m.kind === 'chest' ? '${sq(html(w('Empty.')))}' : m.kind === 'shop' ? '${sq(html(w('Sold out.')))}' : '${sq(html(w('Nothing carried.')))}'}` },
    { words: ['worn · {slot}'], code: "worn · ${e(f.slot || '')}", make: (w) => inTpl(w('worn · {slot}'), { slot: "e(f.slot || '')" }) },
    { words: ['· {n} left'], code: " · ${vars[f.count] || 0} left", make: (w) => ' ' + inTpl(w('· {n} left'), { n: 'vars[f.count] || 0' }) },
    { words: ['· {n} left'], code: " · ${vars[r.count] || 0} left", make: (w) => ' ' + inTpl(w('· {n} left'), { n: 'vars[r.count] || 0' }) },
    { words: ['tabs'], code: "'<span><b>[ ]</b> tabs</span>'", make: (w) => `'<span><b>[ ]</b> ${sq(html(w('tabs')))}</span>'` },
    { words: ['close'], code: '<span><b>esc</b> close</span>', make: (w) => `<span><b>esc</b> ${inTpl(w('close'), {})}</span>` },
    { words: ['accept: {verb}'], code: '<span>accept: ${e(f.verb)}</span>', make: (w) => `<span>${inTpl(w('accept: {verb}'), { verb: 'e(f.verb)' })}</span>` },
    { words: ['back: close'], code: '<span>back: close</span>', make: (w) => `<span>${inTpl(w('back: close'), {})}</span>` },
    { words: ['Slot {n}'], code: '">Slot ${i + 1}</span>', make: (w) => `">${inTpl(w('Slot {n}'), { n: 'i + 1' })}</span>` },
  ],
  // the games inside the game (scene/channels/minigame-channel.js minigamePage, shipped whole into the page)
  minigame: [
    { words: ['Score'], code: "rows = [['Score', o.score]]", make: (w) => `rows = [['${sq(w('Score'))}', o.score]]` },
    { words: ['You win!', 'Better luck next time'], code: "(cur.won ? 'You win!' : 'Better luck next time')",
      make: (w) => `(cur.won ? '${sq(html(w('You win!')))}' : '${sq(html(w('Better luck next time')))}')` },
    { words: ['Score {score}', '(best)', '+{gold} gold'],
      code: "'</div><div>Score ' + esc(cur.s.score) + (cur.best ? ' (best)' : '') + (cur.pay ? ' · +' + cur.pay + ' gold' : '')",
      make: (w) => `${joined(w('Score {score}'), { score: 'esc(cur.s.score)' }, (p) => sq(html(p)), '</div><div>')} + (cur.best ? ' ${sq(html(w('(best)')))}' : '')`
        + ` + (cur.pay ? ${joined(w('+{gold} gold'), { gold: 'cur.pay' }, (p) => sq(html(p)), ' · ')} : '')` },
    { words: ['Space to go on'], code: '<div class="moj-mini-keys">Space to go on</div>', make: (w) => `<div class="moj-mini-keys">${sq(html(w('Space to go on')))}</div>` },
  ],
};

// the controls legend a page without a pilot sends the shell's pause panel (scene-three.js __controlRows): the shell
// shows it in the player's language (play-shell.js renderPause), its key letters as the player's keyboard has them
export const LEGEND_WORDS = Object.freeze(['W A S D / arrows', 'move', 'mouse drag', 'look', 'Space / Shift', 'fly up / down', 'orbit', 'scroll', 'zoom']);

/** The words each channel writes, once each, as a localizer sees them. */
export const PAGE_WORDS = Object.freeze(Object.fromEntries(Object.entries(SITES).map(([ch, sites]) => [ch, [...new Set(sites.flatMap((s) => s.words))]])));

/** A HUD number in the locale's separators, as the expression the readout draws (a group past four digits, as a HUD
 * reads; a lakh grouping for Hindi). Pure source: no Intl, the same characters on every host. */
export function numberFormat({ group, decimal, lakh = false }) {
  return `((v) => { if (typeof v !== 'number' || !isFinite(v)) return String(v); const s = String(Math.abs(v)).split('.'); let i = s[0];`
    + ` if (i.length > 4) { ${lakh ? "const t = i.slice(-3); i = i.slice(0, -3).replace(/\\B(?=(\\d{2})+(?!\\d))/g, '" + sq(group) + "') + '" + sq(group) + "' + t;" : "i = i.replace(/\\B(?=(\\d{3})+(?!\\d))/g, '" + sq(group) + "');"} }`
    + ` return (v < 0 ? '-' : '') + i + (s[1] ? '${sq(decimal)}' + s[1] : ''); })(n)`;
}
// the HUD readout's number: the one place the page draws a bound number as text (scene/channels/events.js hudScript)
const HUD_NUMBER = "h.w.as === 'clock' ? __hudClock(n) : String(n)";

/** The channel's code in the locale: every site of it rewritten in the locale's words (a word it lacks stays as written),
 * and the HUD's numbers in its separators. No locale: the code as it is. */
export function localizeChannel(channel, code, locale) {
  if (!locale) return code;
  const words = locale.words || {};
  const w = (s) => (typeof words[s] === 'string' && words[s].length ? words[s] : s);
  let out = code;
  for (const site of SITES[channel] || []) out = out.split(site.code).join(site.make(w));
  if (channel === 'hud' && locale.number) out = out.split(HUD_NUMBER).join(`h.w.as === 'clock' ? __hudClock(n) : ${numberFormat(locale.number)}`);
  return out;
}
export const HUD_NUMBER_SITE = HUD_NUMBER;
