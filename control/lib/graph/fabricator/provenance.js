// fabricator/provenance — what the fabricator may do with a part, decided by who owns its shape.
//
// Every inventory row carries one tier. The tier gates the ROUTE a strategy takes with that row:
//   buy    the part is bought off the shelf;
//   fit    a standard interface is cut into the operator's own part to take a bought one (a bearing seat, a hole
//          pattern);
//   print  the part itself is made, from mojulo's mechanical library;
// and `mint` (designed from scratch) never touches a row, so it is always open.
//
// The line we hold: a dimension in a published standard is a fact anyone may build to; a part sold under a generic
// name by many makers is the supply chain's common stock; an openly licensed system is ours to build with its licence
// kept; one owner's product is something we may BUY, or FIT using the interface its owner publishes, and NAME only to
// say what fits (nominatively), but never reproduce, and never take its mark for one of ours. This is the
// engineering rule mojulo applies, not legal advice: a row added in doubt goes in as `reference`.
export const PROVENANCE = Object.freeze({
  standard: {
    line: 'a published standard (ISO, DIN, IEC, NEMA, VESA): its dimensions are facts anyone may build to; cite the number, never copy its text',
    buy: true, fit: true, print: true,
  },
  commodity: {
    line: 'a generic part sold under a generic name by many makers worldwide and owned by none: the supply chain\'s common stock',
    buy: true, fit: true, print: true,
  },
  open: {
    line: 'an openly licensed system: build to it, and keep its licence and attribution with whatever is made',
    buy: true, fit: true, print: true,
  },
  own: {
    line: 'mojulo\'s own parametric design, in its mechanical library',
    buy: false, fit: true, print: true,
  },
  reference: {
    line: 'one owner\'s product or system: buy it, or fit it by the interface its owner publishes, naming it only to say what fits; never reproduce it, never use its name as ours',
    buy: true, fit: 'published', print: false,
  },
});

export const ROUTES = Object.freeze({
  buy: 'bought off the shelf',
  fit: 'a standard interface cut into your own part, to take a bought part',
  print: 'the standard part itself, made from mojulo\'s mechanical library',
  mint: 'designed from scratch',
});

/** May `route` be taken with inventory `row`? → { ok, why }. */
export function permits(row, route) {
  const tier = PROVENANCE[row.provenance];
  if (!tier) return { ok: false, why: `${row.id}: unknown provenance '${row.provenance}'` };
  const rule = tier[route];
  if (rule === true) return { ok: true, why: null };
  if (rule === 'published') {
    return row.interface === 'published'
      ? { ok: true, why: null }
      : { ok: false, why: `${row.id} is reference-only and its owner's interface drawing is not vendored: measure the host, or buy an adapter` };
  }
  if (route === 'print' && row.provenance === 'reference') return { ok: false, why: `${row.id} is reference-only: it may be bought or fitted, never reproduced` };
  return { ok: false, why: `${row.id} (${row.provenance}) cannot be ${route === 'buy' ? 'bought' : route === 'fit' ? 'fitted' : 'printed'}` };
}

/** The notices a row carries into a resolution: attribution for open work, the nominative line for a reference. */
export function noticesOf(row) {
  const out = [];
  if (row.licence) out.push(`${row.label}: ${row.licence}`);
  if (row.notice) out.push(row.notice);
  return out;
}
