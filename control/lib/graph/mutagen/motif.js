// MOTIFS: the one shape family a creature's ornaments are made in (the stylism tuner's law: one motif, echoed). A motif
// is what a horn, a spur, a spike or a band IS on this creature: its colour, whether it glows, its material, and how a
// horn grows (curl: 0 straight … 1 swept down at the tip). The oozes name theirs (the last one named wins); `horn` is the
// animal's own.
export const MOTIFS = Object.freeze({
  horn: { color: '#3a332b', glow: false, curl: 0.55, reads: 'dark horn' },
  bone: { color: '#e4dac2', glow: false, curl: 0.35, reads: 'ivory bone' },
  ice: { color: '#bfefff', glow: true, curl: 0, material: 'glass', reads: 'glowing ice' },
  crystal: { color: '#b98cff', glow: true, curl: 0, material: 'glass', reads: 'glowing crystal' },
  metal: { color: '#2b3036', glow: false, curl: 0.1, material: 'gunmetal', reads: 'gunmetal' },
  flame: { color: '#ff8a1a', glow: true, curl: 0.2, reads: 'flame' },
  spark: { color: '#d6ecff', glow: true, curl: 0, reads: 'white-blue lightning' },
  toxin: { color: '#9cff3a', glow: true, curl: 0.4, reads: 'acid green' },
  shade: { color: '#1a1424', glow: false, curl: 0.6, reads: 'shadow' },
  gold: { color: '#d8b25a', glow: true, curl: 0.5, material: 'gold', reads: 'burning gold' },
});
export const MOTIF_NAMES = Object.freeze(Object.keys(MOTIFS));
