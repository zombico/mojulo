/**
 * Late medieval dress in the German towns, c. 1450–1530 (Rothenburg's record). Kind `dress` (../record.js,
 * ../dress.js). What the miniature can draw: a doublet or jerkin to the hip or knee over hose, a gown to the ankle, an
 * apron, a coif or a veil, a cloak. Every entry is 'unverified': the standard account, no page read for this pass.
 * A look's `weight` is a judgement on how common, not a count.
 */
const W = (title) => ({ author: 'Wikipedia', title, year: 2026, url: `https://en.wikipedia.org/wiki/${title.replace(/ /g, '_')}`, via: 'not read this pass' });
const S = { fashion1500: W('1500–1550 in European fashion'), fashion1400: W('1400–1500 in European fashion'), hose: W('Hose (clothing)') };
const dress = (id, name, wearer, cut, attested, looks, notes) => ({ id, name, kind: 'dress', wearer, cut, attested, looks, confidence: 'unverified', sources: [S.fashion1500, S.fashion1400], notes });

export const FRANCONIAN_DRESS = [
  dress('fr-burgher', 'A burgher\'s coat over doublet and hose', 'man', 'knee', { from: 1450, to: 1550, approx: true },
    [{ shirt: '#5a3a2e', legs: '#3e3a36', shoe: '#2a2220' }, { shirt: '#3e4a5a', legs: '#5a2e28', shoe: '#2a2220' }, { shirt: '#6a5a3a', legs: '#4a4038', shoe: '#2a2220', headwear: 'cap', headHex: '#2e2a28' }],
    'The townsman\'s pleated coat to the knee, the hose showing below; a flat cap or a hat. Dark dyed wool for the council\'s families, brighter for the young.'),
  dress('fr-gown', 'A gown to the ground, a linen coif or veil', 'woman', 'ankle', { from: 1450, to: 1550, approx: true },
    [{ shirt: '#6a2e2a', sleeve: true, shoe: '#2a2220', headwear: 'veil', headHex: '#ece6d8' }, { shirt: '#4a5462', sleeve: true, shoe: '#2a2220', headwear: 'veil', headHex: '#e8e2d2' }, { shirt: '#7a6a4a', sleeve: true, shoe: '#2a2220', headwear: 'cap', headHex: '#ece6d8' }],
    'The long gown with close sleeves, a married woman\'s head covered in white linen out of doors.'),
  dress('fr-work', 'A work smock or jerkin over hose', 'hand', 'knee', { from: 1400, to: 1600, approx: true },
    [{ shirt: '#8a7a5a', legs: '#5a5040', shoe: '#3a3028' }, { shirt: '#6e6248', legs: '#4a4234', shoe: '#3a3028' }, { shirt: '#a09070', legs: '#6a5e48' }],
    'Undyed or russet wool, belted, to the knee; hose or bare shins in the summer\'s work.'),
];
