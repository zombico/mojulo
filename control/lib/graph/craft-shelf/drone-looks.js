/**
 * drone-looks — a drone's look as a card, never a second airframe: the same parts read civilian or military by the
 * card they wear. A card says:
 *   palette   the colours its parts take (a craft palette, craft-common.js)
 *   slots     the material slots its painted parts are drawn in (craft-form.js): a moulded drone's `plastic`, a racer's
 *             `carbon`, a military drone's matte paint (`airPaint`, which a camo cuts into)
 *   lights    'nav' (its arms' LEDs lit, green right and red left) | 'covert' (dark: its LEDs read as IR emitters)
 *   payloads  what its payloads become, by family: a military drone's gimbal camera an EO/IR ball, the nearest in size
 *   livery    the livery it wears when it is asked for (air-surface.js): a civilian's registration, serial plate and
 *             high-visibility arm tips; a military drone's low-visibility number
 *
 *   DRONE_LOOKS, DRONE_LOOK_IDS
 *   lookCard(look)                          → the card, or throws naming the looks
 *   lookSwap(archetypeRow, card, odm)       → the layout's swaps the card makes ({ <layout id>: sku })
 *
 * An archetype names its stock look (`look`); a craft asked for another look takes that card's palette, payloads and
 * lights, and its livery unless one is named. A look never changes a drone's frame, arms, motors or rotors. Pure.
 */

export const DRONE_LOOKS = Object.freeze({
  consumer: Object.freeze({
    reads: 'a consumer drone: light moulded plastics, its LEDs lit, a camera gimbal, a registration and a serial plate',
    palette: 'droneConsumer', slots: { airPaint: 'plastic', airTrim: 'plastic' }, lights: 'nav', payloads: {},
    livery: { pattern: 'mono', marks: { style: 'civil' } },
  }),
  enterprise: Object.freeze({
    reads: 'an enterprise drone: dark moulded plastics, ruggedised, high-visibility arm tips, its registration',
    palette: 'droneEnterprise', slots: { airPaint: 'plastic' }, lights: 'nav', payloads: {},
    livery: { pattern: 'mono', marks: { style: 'civil', hiVis: true } },
  }),
  racer: Object.freeze({
    reads: 'a racer: bare carbon, aluminium, bright props, no marks',
    palette: 'fpvCarbon', slots: { airPaint: 'carbon', airTrim: 'carbon' }, lights: 'nav', payloads: {},
    livery: { pattern: 'mono', marks: false },
  }),
  military: Object.freeze({
    reads: 'a military drone: matte paint (a camo cuts into it), its lights dark, an EO/IR ball, a low-visibility number',
    palette: 'droneMilitary', slots: {}, lights: 'covert', payloads: { gimbal3: 'eoir' },
    livery: { pattern: 'mono', marks: { style: 'military', emblem: 'bar', warnings: false } },
  }),
});
export const DRONE_LOOK_IDS = Object.freeze(Object.keys(DRONE_LOOKS));

/** The card a look names, or throws naming them. */
export function lookCard(look) {
  const card = DRONE_LOOKS[look];
  if (!card) throw new Error(`drone look: '${look}' is no look (a look is one of ${DRONE_LOOK_IDS.join(' | ')})`);
  return card;
}

/** The layout's swaps a card makes: each payload whose family the card turns into another, the part of that family
 *  nearest it in size (its height), from the same realm. */
export function lookSwap(row, card, odm) {
  const swap = {};
  for (const e of row.layout) {
    const part = odm[e.sku], to = part && card.payloads[part.build.family];
    if (!to || part.kind !== 'drone-payload') continue;
    const h = part.dims.height, options = Object.entries(odm).filter(([, r]) => r.kind === 'drone-payload' && r.build.family === to && r.realm === part.realm);
    if (!options.length) continue;
    options.sort(([, a], [, b]) => Math.abs(a.dims.height - h) - Math.abs(b.dims.height - h));
    swap[e.id] = options[0][0];
  }
  return swap;
}
