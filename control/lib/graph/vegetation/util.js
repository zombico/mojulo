// vegetation — small shared helpers.
/** Linear mix of two RGB triples (0–255), t in [0, 1]. */
export const mix = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
