// handwear/styles — HANDWEAR CARDS: pure data, read by expand.js under principles.js. A card is the GLOVE (the
// protoglove: the hand's own close leather, its cuff up the forearm as a share of it, its thickness, its fingers whole,
// cut at the middle joint or at the knuckles; false: worn on the bare hand) and the ADORNMENT laid over it. A new glove
// is a card; a variety extends its kin (`from`) and changes a few keys; any card wears a colourway (`skin`).
export const HANDWEAR = {
  gloves: { family: 'glove', glove: { cuff: 0.06, thick: 0.0018 } },
  // the undersuit's glove, close and thin, at the wrist (a plated suit's hands: plating/ `hands`)
  suitGloves: { family: 'glove', glove: { cuff: 0, thick: 0.0012 } },
  fingerless: { from: 'gloves', glove: { fingers: 'half' } },
  mitts: { from: 'gloves', glove: { fingers: 'none', cuff: 0.12 } },
};
for (const c of Object.values(HANDWEAR)) Object.freeze(c);
/** COLOURWAYS over any card, by role */
export const SKINS = Object.freeze({});
/** the colours of the groups a card lays, for a palette that names none */
export const HANDWEAR_TONES = Object.freeze({ Gloves: '#3b2a20' });
