/**
 * GUNS — what a shooter's HUD shows the gun in hand as: a WIREFRAME of its side, the muzzle to the right (the outline
 * of its stock, receiver, grip, magazine, barrel and sights, and the few inner lines that tell one gun from another: a
 * port, a rail's teeth, a pump's ribs, a scope's turret), so a rifle, a shotgun and a pistol are told apart at a glance
 * before a word is read. And the ROUNDS it feeds, drawn one by one in the magazine's belt: a rifle's bottle-necked
 * cartridge, a pistol's short round-nosed one, a shotgun's shell, a rocket. A spent round is its empty outline.
 *
 * Like the pictograms (icons.js), nothing is loaded and nothing is coloured here: each is a MASK in the sheet (an SVG
 * in a data URL), cut out of the current ink, so it takes the theme's colour, its harm when low. The runtime only names
 * them: a magazine's `gun` (else its `name`) is written as `data-gun` (lower case, words joined by a dash), its
 * `round` as `data-round`; a name with no wireframe draws none, and its rounds are the rifle's.
 *
 *   GUNS          { <id>: [shape, …] }   on a 64 × 20 grid: ['r', x, y, w, h] a box, ['p', 'x,y …'] a closed outline,
 *                                        ['l', 'x,y …'] an inner line
 *   GUN_IDS · GUN_ALIASES ({ <word>: <id> }: the other words a game says for one: handgun, pdw, breacher, dmr)
 *   ROUNDS        { <id>: { box: [w, h], d } }   a round standing, its tip up (fill-rule evenodd)
 *   ROUND_OF      { <gun id>: <round id> }   the round a gun feeds when the magazine names none (the rifle's otherwise)
 *   gunOf(name)   the wireframe a name draws (its id, an alias's), or null
 *   gunSvg(id) · roundSvg(id, spent?)   each as a whole <svg> (a board's, a doc's)
 *   gunCss(scope) the sheet's rules: every wireframe and every round, on the names that draw them (a magazine's or a
 *                 wheel slot's data-gun)
 *
 * Pure data and strings: imports nothing.
 */
export const GUNS = Object.freeze({
  // an assault rifle: a fixed stock, a holographic sight on its rail, a curved magazine, a long handguard, a flash hider
  rifle: [
    ['p', '2,6.5 14,7.4 14,11.6 2,13.6'], ['l', '3.6,6.7 3.6,13.3'],
    ['p', '14,6 34,6 34,11 25.5,11 14,11.6'], ['r', 24, 7.3, 6, 1.5],
    ['l', '15.5,6 15.5,5 32.5,5 32.5,6'], ['l', '18,5 18,6'], ['l', '20.5,5 20.5,6'], ['l', '31,5 31,6'],
    ['p', '21,5 21,2 28.6,2 30,3.3 30,5'], ['l', '22.4,3.4 28,3.4'],
    ['p', '18.5,11.6 22,11.4 20.6,17.6 17,17.6'], ['l', '22,11.4 22.6,13.6 25.6,13.6 25.6,11'],
    ['p', '26,11 30.5,11 32.6,17.4 28.7,18.6'],
    ['p', '34,6.5 48,6.5 48,10.5 34,10.5'], ['l', '36.5,7.9 39,7.9'], ['l', '40.5,7.9 43,7.9'], ['l', '36.5,9.2 39,9.2'], ['l', '40.5,9.2 43,9.2'],
    ['p', '45.8,6.5 46.4,4 47.4,4 48,6.5'],
    ['r', 48, 7.8, 9, 1.4], ['r', 57, 7.2, 4.6, 2.6], ['l', '58.6,7.2 58.6,9.8'], ['l', '60,7.2 60,9.8'],
  ],
  // a carbine: the rifle cut short, a skeleton stock on its buffer tube, a red dot
  carbine: [
    ['p', '5,6.8 13,7.3 13,11 5,12.7'], ['l', '6.4,9.8 12,9.4'], ['l', '13,8.3 15,8.3'],
    ['p', '15,6 32,6 32,11 24.5,11 15,11.6'], ['r', 23.5, 7.3, 5.5, 1.5],
    ['l', '16.5,6 16.5,5 30.5,5 30.5,6'],
    ['p', '21.5,5 22.4,3 26.6,3 27.5,5'],
    ['p', '18.5,11.6 22,11.4 20.6,17.4 17,17.4'], ['l', '22,11.4 22.6,13.4 25,13.4 25,11'],
    ['p', '25.5,11 29.6,11 31.5,17 27.8,18.1'],
    ['p', '32,6.5 42,6.5 42,10.5 32,10.5'], ['l', '34,8.5 40,8.5'],
    ['p', '40,6.5 40.5,4.3 41.4,4.3 42,6.5'],
    ['r', 42, 7.8, 6.5, 1.4], ['r', 48.5, 7.2, 3.6, 2.6], ['l', '50,7.2 50,9.8'],
  ],
  // a bullpup: the magazine behind the grip, a carry rail over a short body, a long barrel for its length
  bullpup: [
    ['p', '3,6.6 31,6.6 31,11.2 24.6,11.2 22.6,13.2 3,13.2'], ['l', '4.4,6.8 4.4,13'], ['r', 17, 8, 6, 1.5],
    ['p', '9,6.6 10.4,3.4 26,3.4 27.4,6.6'], ['l', '12,5 24.6,5'],
    ['p', '24.6,11.2 28,11.2 26.6,17.4 23.2,17.4'], ['l', '28,11.2 28.4,13.2 31,13.2 31,11.2'],
    ['p', '11.6,13.2 15.8,13.2 16.6,18.2 12.6,18.6'],
    ['p', '31,7 41,7 41,10.8 31,10.8'], ['l', '33,8.9 39,8.9'],
    ['r', 41, 8.1, 7.5, 1.4], ['r', 48.5, 7.4, 3.6, 2.6],
  ],
  // a submachine gun: a folding wire stock, a short receiver, a straight box magazine, a foregrip, a shrouded barrel
  smg: [
    ['p', '4,7 13,7.5 13,10.6 4,12.2'], ['p', '6,8.4 12,8.7 12,9.8 6,10.8'],
    ['p', '13,6.4 31,6.4 31,11 13,11'], ['r', 21, 7.6, 5, 1.4], ['l', '15,6.4 15,5.4 29,5.4 29,6.4'],
    ['p', '21.5,5.4 22.3,3.6 26,3.6 26.8,5.4'],
    ['p', '15.5,11 19,11 17.8,16.8 14.4,16.8'], ['l', '19,11 19.5,13 21.6,13 21.6,11'],
    ['p', '22.6,11 25.8,11 25.8,18.6 22.6,18.6'], ['l', '22.6,16.6 25.8,16.6'],
    ['p', '28,11 30.2,11 30.2,15.4 28,15.4'],
    ['r', 31, 7, 6, 3], ['l', '32.5,7 32.5,10'], ['l', '34,7 34,10'], ['l', '35.5,7 35.5,10'], ['r', 37, 7.7, 3, 1.6],
  ],
  // a pump shotgun: a full stock, a short receiver, the barrel over its tube magazine, the pump's ribbed forend, a bead
  shotgun: [
    ['p', '2,7 15,8 15,11.6 2,13.8'], ['l', '3.6,7.2 3.6,13.5'],
    ['p', '15,6.8 27,6.8 27,11.2 15,11.6'], ['l', '18,8.4 24,8.4'],
    ['l', '18,11.5 18.8,13.6 22.2,13.6 22.2,11.3'],
    ['r', 27, 6.8, 33, 1.8], ['r', 27, 9, 26, 1.7],
    ['p', '33,8.3 44,8.3 44,11.8 33,11.8'], ['l', '35.2,8.3 35.2,11.8'], ['l', '37.4,8.3 37.4,11.8'], ['l', '39.6,8.3 39.6,11.8'], ['l', '41.8,8.3 41.8,11.8'],
    ['l', '59,6.8 59,5.8'],
  ],
  // a marksman rifle: a cheek rest, a long scope on two rings, a box magazine, a bipod folded down, a brake
  marksman: [
    ['p', '2,6 7,6 9,7.4 16,7.6 16,11.6 4,14 2,14'], ['l', '3.6,6.2 3.6,13.8'],
    ['p', '16,6.4 36,6.4 36,11 16,11.6'], ['r', 27, 7.6, 6, 1.4],
    ['r', 20, 2.6, 18, 2], ['p', '38,2 42,1.4 42,5.2 38,4.6'], ['p', '16.6,2.2 20,2.6 20,4.6 16.6,5'], ['r', 27.4, 1.2, 2, 1.4],
    ['l', '23,4.6 23,6.4'], ['l', '33,4.6 33,6.4'],
    ['p', '20,11.4 23.4,11.2 22,17 18.6,17'], ['l', '23.4,11.2 24,13.2 26.4,13.2 26.4,11'],
    ['p', '27,11 31,11 31,16.2 27,16.2'],
    ['p', '36,6.8 50,6.8 50,10.4 36,10.4'], ['l', '38,8.6 48,8.6'],
    ['r', 50, 7.9, 10, 1.2], ['r', 60, 7.2, 3, 2.6], ['l', '61.5,7.2 61.5,9.8'],
    ['l', '47,10.4 44.4,17.6'], ['l', '47.8,10.4 50.4,17.6'],
  ],
  // a sniper rifle: a thumbhole stock, the bolt's handle and knob, a long scope with a wide bell, the longest barrel
  sniper: [
    ['p', '1,6.4 6,6.4 8,7.8 17,8 17,11.4 5,14.4 1,14.4'], ['p', '9,9.6 13.6,9.6 13.6,11 9.6,12'], ['l', '2.4,6.6 2.4,14.2'],
    ['p', '17,6.6 32,6.6 32,10.6 17,11.4'], ['l', '26.5,10.6 28,13'], ['r', 27.4, 12.4, 1.8, 1.8],
    ['r', 19, 2.4, 20, 2.2], ['p', '39,1.8 44,1 44,5.6 39,4.8'], ['p', '15.6,1.9 19,2.4 19,4.6 15.6,5.1'], ['r', 28, 1, 2.2, 1.4],
    ['l', '22,4.6 22,6.6'], ['l', '35,4.6 35,6.6'],
    ['p', '21.6,10.8 25.4,10.6 25.4,14 21.6,14'],
    ['r', 32, 7.9, 26, 1.3], ['r', 58, 7.1, 4, 2.8], ['l', '59.4,7.1 59.4,9.9'], ['l', '60.8,7.1 60.8,9.9'],
    ['l', '40,9.2 37.2,17.6'], ['l', '40.8,9.2 43.6,17.6'],
  ],
  // a pistol: its slide and serrations, the frame under it, a trigger guard, a raked grip
  pistol: [
    ['p', '21,6 43,6 43,9.6 21,9.6'], ['l', '23,6.6 23,9'], ['l', '24.3,6.6 24.3,9'], ['l', '25.6,6.6 25.6,9'], ['r', 31, 6.9, 5, 1.2],
    ['p', '28.6,9.6 43,9.6 43,10.8 34.4,10.8 33.6,12.8 29,12.8'],
    ['l', '29,12.8 29.6,13.6 33,13.6 34.4,10.8'],
    ['p', '21.4,9.6 28.6,9.6 27.4,18 21.6,18 21,16'], ['l', '22.4,16 27,16'],
    ['l', '41.6,6 41.6,5.2'],
  ],
  // a revolver: the barrel and its rib, the frame, a fluted cylinder, the hammer, a curved grip
  revolver: [
    ['r', 34, 6.2, 13, 2.2], ['l', '34,5.6 47,5.6'], ['l', '46,5.6 46,4.8'],
    ['p', '24,5.4 34,5.4 34,10 30,10 28.4,11.2 24,10.4'],
    ['r', 25.6, 6.2, 7, 4], ['l', '25.6,7.5 32.6,7.5'], ['l', '25.6,8.9 32.6,8.9'],
    ['p', '22.4,5.6 24,5.4 24,7.2 21.4,6.6'],
    ['l', '28.4,11.2 28.8,13 31.6,13 32.2,10'],
    ['p', '24,10.4 28.4,11.2 26.4,17.6 21,17.6 21.6,13.4 22.6,10.6'], ['l', '22.4,15.6 26.4,15.6'],
  ],
  // a rocket launcher: the tube between its flares, banded, a sight on top, a grip and a foregrip under
  launcher: [
    ['r', 6, 6, 50, 6], ['p', '56,5.4 60.4,4.4 60.4,12.6 56,12.6'], ['p', '6,6 2.6,4.8 2.6,13.2 6,12'],
    ['l', '14,6 14,12'], ['l', '46,6 46,12'], ['l', '15,9 45,9'],
    ['p', '28,6 28.6,3.2 33,3.2 34,6'], ['l', '29.4,4.6 32.6,4.6'],
    ['p', '21,12 24.4,12 23.4,17.4 20,17.4'], ['l', '24.4,12 24.8,13.8 26.6,13.8 26.6,12'],
    ['p', '36,12 38.8,12 38.8,16.4 36,16.4'],
  ],
  // a run and gun's guns, drawn as an arcade draws them: the heavy machine gun (a carry handle, a vented shroud, a box of
  // belted rounds), the spread gun (three barrels fanning from a short body) and the flamethrower (a tank under a long
  // nozzle ringed with its shroud, a pilot light at its tip)
  'machine-gun': [
    ['p', '3,7 12,7.5 12,11.5 3,13'], ['l', '4.4,7.2 4.4,12.8'],
    ['p', '12,6 32,6 32,12 12,12.5'], ['r', 21, 7.4, 6, 1.4], ['l', '17,6 18,3.4 28,3.4 29,6'],
    ['p', '16,12.4 19.6,12.2 18.4,17.6 15,17.6'], ['l', '19.6,12.2 20.2,14 23,14 23,12'],
    ['p', '24,12 31,12 31,17.4 24,17.4'], ['l', '24,14.6 31,14.6'], ['l', '26.4,12 26.4,14.6'], ['l', '28.8,12 28.8,14.6'],
    ['r', 32, 6.8, 18, 4.4], ['l', '34.5,9 36,9'], ['l', '38,9 39.5,9'], ['l', '41.5,9 43,9'], ['l', '45,9 46.5,9'],
    ['r', 50, 8.2, 9, 1.6], ['r', 59, 7.6, 3, 2.8],
  ],
  spread: [
    ['p', '4,7.5 13,8 13,11.5 4,12.6'], ['l', '5.4,7.7 5.4,12.4'],
    ['p', '13,6.5 33,6.5 35,8 35,11.4 13,12'], ['r', 20, 7.8, 6, 1.4],
    ['p', '17,12 20.6,11.8 19.4,17.4 16,17.4'], ['l', '20.6,11.8 21.2,13.8 24,13.8 24,11.6'],
    ['p', '26,11.6 33,11.6 33,14 26,14'], ['l', '28.4,11.6 28.4,14'], ['l', '30.8,11.6 30.8,14'],
    ['p', '35,7.6 52,4 52.6,5.4 35,8.8'], ['p', '35,9 53,8.8 53,10.2 35,10'], ['p', '35,10.6 52.6,13.6 52,15 35,11.6'],
    ['r', 52, 3, 3, 3.2], ['r', 53, 8, 3, 3], ['r', 52, 12.8, 3, 3.2],
  ],
  flame: [
    ['p', '6,7 24,7 24,11 6,11'], ['l', '9,8.4 20,8.4'],
    ['p', '10,11 13.4,11 12.4,16 9,16'],
    ['r', 16, 12, 13, 4.8], ['l', '16,14.4 29,14.4'], ['l', '18,12 18,16.8'], ['l', '27,12 27,16.8'],
    ['l', '29,14 32,13 33,11'],
    ['p', '31,10.8 34,10.8 34,15.6 31,15.6'],
    ['r', 24, 7.6, 26, 2.6], ['l', '30,7.6 30,10.2'], ['l', '36,7.6 36,10.2'], ['l', '42,7.6 42,10.2'],
    ['p', '50,7 55.4,6 55.4,11.2 50,10.2'], ['r', 51.6, 4.2, 2.2, 1.6], ['l', '52.7,5.8 52.7,7'],
  ],
  // a combat knife: its clip-point blade and fuller, the cross guard, a ridged handle
  knife: [
    ['p', '21,8 40,8 47,9.5 40,11.2 21,11.2'], ['l', '23,9.4 38,9.4'],
    ['r', 19.4, 5.8, 1.6, 7.6],
    ['p', '7,8.2 19.4,8.2 19.4,11 7,11.4 5.6,9.8'], ['l', '10,8.2 10,11.2'], ['l', '13,8.2 13,11.2'], ['l', '16,8.2 16,11.1'],
  ],
});
export const GUN_IDS = Object.freeze(Object.keys(GUNS));
export const GUN_ALIASES = Object.freeze({
  assault: 'rifle', 'assault-rifle': 'rifle', ar: 'rifle', 'battle-rifle': 'rifle', caseless: 'bullpup',
  pdw: 'smg', 'submachine-gun': 'smg', breacher: 'shotgun', 'combat-shotgun': 'shotgun',
  dmr: 'marksman', coilgun: 'marksman', 'marksman-rifle': 'marksman', 'sniper-rifle': 'sniper', bolt: 'sniper',
  handgun: 'pistol', sidearm: 'pistol', 'heavy-machine-gun': 'machine-gun', hmg: 'machine-gun', lmg: 'machine-gun', mg: 'machine-gun',
  'spread-gun': 'spread', flamethrower: 'flame', 'flame-thrower': 'flame', magnum: 'revolver', rocket: 'launcher', 'rocket-launcher': 'launcher', rpg: 'launcher', bazooka: 'launcher',
  blade: 'knife', 'combat-knife': 'knife',
});

/** The rounds, standing, tip up: a bullet seated in its case, a groove and a rim under it (a gap between each part, so
 *  the parts read even as a silhouette). */
export const ROUNDS = Object.freeze({
  rifle: { box: [10, 32], d: 'M5 0C6.4 2.5 7 5.5 7 9.5V11H3V9.5C3 5.5 3.6 2.5 5 0zM3.3 11.8H6.7V13.6L8 15.2V28.6H2V15.2L3.3 13.6zM2.6 29.2H7.4V29.9H8.2V32H1.8V29.9H2.6z' },
  pistol: { box: [10, 20], d: 'M5 0C7.6 0 8.4 3 8.4 6.5V8H1.6V6.5C1.6 3 2.4 0 5 0zM1.6 8.8H8.4V17.4H1.6zM1.4 18H8.6V20H1.4z' },
  shell: { box: [10, 26], d: 'M1.5 1.5Q5 0 8.5 1.5V18H1.5zM1 18.8H9V24H1zM0.4 24.6H9.6V26H0.4z' },
  rocket: { box: [10, 32], d: 'M5 0C7 3 7.5 6 7.5 9V24L9.5 28V32H0.5V28L2.5 24V9C2.5 6 3 3 5 0z' },
});
export const ROUND_IDS = Object.freeze(Object.keys(ROUNDS));
export const ROUND_OF = Object.freeze({ pistol: 'pistol', revolver: 'pistol', smg: 'pistol', shotgun: 'shell', spread: 'shell', launcher: 'rocket' });

const slug = (s) => String(s ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
export function gunOf(name) { const k = slug(name); return GUNS[k] ? k : GUN_ALIASES[k] ?? null; }

const pathOf = (shapes) => shapes.map((s) => {
  if (s[0] === 'r') { const [, x, y, w, h] = s; return `M${x} ${y}h${w}v${h}h${-w}z`; }
  const pts = s[1].split(' ').map((p) => p.replace(',', ' '));
  return `M${pts.join('L')}${s[0] === 'p' ? 'z' : ''}`;
});
/** A wireframe as a whole SVG: its outlines over a faint fill of themselves (so it has mass), its inner lines thinner. */
export function gunSvg(id) {
  const k = gunOf(id);
  if (!k) throw new Error(`a gun is one of: ${GUN_IDS.join(', ')}`);
  const shapes = GUNS[k], outline = pathOf(shapes.filter((s) => s[0] !== 'l')).join(''), inner = pathOf(shapes.filter((s) => s[0] === 'l')).join('');
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 20'><path d='${outline}' fill='black' fill-opacity='.16' stroke='black' stroke-width='.9' stroke-linejoin='round'/>${inner ? `<path d='${inner}' fill='none' stroke='black' stroke-width='.55' stroke-linecap='round' stroke-linejoin='round'/>` : ''}</svg>`;
}
/** A round as a whole SVG: filled, or spent (its empty outline). */
export function roundSvg(id, spent = false) {
  const R = ROUNDS[id];
  if (!R) throw new Error(`a round is one of: ${ROUND_IDS.join(', ')}`);
  const [w, h] = R.box;
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='-.5 -.5 ${w + 1} ${h + 1}'><path d='${R.d}' ${spent ? "fill='none' stroke='black' stroke-width='.8'" : "fill-rule='evenodd'"}/></svg>`;
}
const urlOf = (svg) => `url("data:image/svg+xml,${svg.replace(/</g, '%3C').replace(/>/g, '%3E').replace(/#/g, '%23').replace(/"/g, '%22')}")`;
const names = (id) => [id, ...Object.keys(GUN_ALIASES).filter((a) => GUN_ALIASES[a] === id)];
const on = (id) => names(id).map((n) => `[data-gun=${n}]`).join(',');

/** The sheet's rules: a magazine's wireframe on the names that draw one (none on any other), and its belt's rounds:
 *  the round its gun feeds, or the one it names. A round's height follows its shape, so a belt of shells is shorter
 *  and wider-set than a rifle's. */
export function gunCss(scope = '.mana-root') {
  const s = scope, every = GUN_IDS.map(on).join(','), u = (n) => `calc(${n} * var(--mana-du))`;
  const H = { rifle: 34, pistol: 23, shell: 29, rocket: 40 };
  const round = (id) => `--mana-round:${urlOf(roundSvg(id))};--mana-round-spent:${urlOf(roundSvg(id, true))};height:${u(H[id])}`;
  return [
    `${s} .mana-sil{display:none;width:${u(200)};height:${u(62)};background:currentColor;-webkit-mask:var(--mana-gun) right center/contain no-repeat;mask:var(--mana-gun) right center/contain no-repeat}`,
    `${s} :is(.mana-magazine,.mana-wslot):is(${every}) .mana-sil{display:block}`,
    ...GUN_IDS.map((id) => `${s} :is(.mana-magazine,.mana-wslot):is(${on(id)}) .mana-sil{--mana-gun:${urlOf(gunSvg(id))}}`),
    `${s} .mana-belt{${round('rifle')}}`,
    ...Object.entries(ROUND_OF).map(([g, r]) => `${s} .mana-magazine:is(${on(g)}) .mana-belt{${round(r)}}`),
    ...ROUND_IDS.map((r) => `${s} .mana-magazine .mana-belt[data-round=${r}]{${round(r)}}`),
  ].join('\n');
}
