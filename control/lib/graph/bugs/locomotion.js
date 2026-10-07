// BUG LOCOMOTION — the gaits an arthropod can be minted with, by order, a worked species' own row over its order's.
// Every walking gait is one footfall rule (gait.js): ground leg pair j steps `w` of a stride after the pair behind it
// (`wave: 'direct'`, hind to front, the insect's and the millipede's way) or in front of it ('retrograde', the
// centipede's), the two sides half a stride apart. `w` ½ is the alternating tripod on six legs and the alternating
// tetrapod on eight; a small `w` is a wave running down many legs. `duty` the share of a stride a foot is planted,
// `stride` its excursion as a share of body length, `lift` the swing's height as a share of the leg's hip height.
// A flight's `hz` is the order's measured wingbeat (beats a second), which gait.js shows beating or as a blur.
// Sources: Delcomyn 1971 and Wilson 1966 (insect tripod and wave gaits); Wilson 1967 (spider alternating tetrapod);
// Manton 1977 (myriapod waves); Burrows & Hoyle 1973 (crab sideways walking); Dudley 2000 (wing strokes and
// wingbeat frequencies).

const WALK = { pattern: 'metachronal', w: 0.5, wave: 'direct', duty: 0.5, stride: 0.32, lift: 0.35, rock: 3 };
const RUN = { pattern: 'metachronal', w: 0.5, wave: 'direct', duty: 0.35, stride: 0.5, lift: 0.4, rock: 4 };
const FLY = { pattern: 'stroke', amp: 55, sweep: 12, lag: 0, tuck: 0.55, hz: 50 };

export const ORDERS = {
  default: { gaits: { walk: WALK } },
  // the insects: a tripod walk, a run where they hurry; flight where the bug carries flight wings (gait.js drops it
  // where it carries none)
  Hymenoptera: { gaits: { walk: WALK, fly: { ...FLY, amp: 60, hz: 230 } } },
  Formicidae: { gaits: { walk: WALK, run: RUN } },
  Diptera: { gaits: { walk: WALK, fly: { ...FLY, amp: 65, hz: 190 } } },
  Culicidae: { gaits: { walk: { ...WALK, stride: 0.25 }, fly: { ...FLY, amp: 45, hz: 600 } } },
  Lepidoptera: { gaits: { walk: { ...WALK, stride: 0.2 }, fly: { ...FLY, amp: 70, sweep: 5, tuck: 0.3, hz: 10 } } },
  Coleoptera: { gaits: { walk: WALK, fly: { ...FLY, amp: 60, cases: 40, hz: 80 } } },
  Curculionidae: { gaits: { walk: { ...WALK, stride: 0.25 } } },
  Odonata: { gaits: { walk: { ...WALK, stride: 0.2 }, fly: { ...FLY, amp: 45, lag: 0.25, hz: 30 } } },   // fore and hind out of phase
  Orthoptera: { gaits: { walk: WALK, fly: { ...FLY, amp: 50, hz: 20 } } },
  Mantodea: { gaits: { walk: { ...WALK, duty: 0.6, stride: 0.22, rock: 6 } } },   // the slow rocking stalk
  Phasmida: { gaits: { walk: { ...WALK, duty: 0.65, stride: 0.18, rock: 8 } } },   // swaying like a twig in the wind
  Blattodea: { gaits: { walk: WALK, run: { ...RUN, stride: 0.6 } } },
  Hemiptera: { gaits: { walk: WALK, fly: { ...FLY, hz: 50 } } },
  Cicadidae: { gaits: { walk: WALK, fly: { ...FLY, hz: 45 } } },
  Neuroptera: { gaits: { walk: WALK, fly: { ...FLY, amp: 50, lag: 0.2, hz: 25 } } },
  Ephemeroptera: { gaits: { walk: WALK, fly: { ...FLY, amp: 45, hz: 20 } } },
  Dermaptera: { gaits: { walk: WALK, run: RUN } },
  Siphonaptera: { gaits: { walk: WALK } },
  // the arachnids: the alternating tetrapod
  Araneae: { gaits: { walk: { ...WALK, duty: 0.55 }, run: { ...RUN, duty: 0.4 } } },
  Scorpiones: { gaits: { walk: { ...WALK, duty: 0.6, stride: 0.25 } } },
  Opiliones: { gaits: { walk: { ...WALK, duty: 0.5, stride: 0.6, lift: 0.25 } } },
  Ixodida: { gaits: { walk: { ...WALK, duty: 0.65, stride: 0.15 } } },
  Xiphosura: { gaits: { walk: { ...WALK, duty: 0.65, stride: 0.15 } } },
  // the myriapods: waves down many legs (the millipede's direct wave, many legs down at once; the centipede's
  // retrograde wave, the body snaking)
  Diplopoda: { gaits: { walk: { ...WALK, w: 0.09, duty: 0.75, stride: 0.08, lift: 0.3, rock: 0 } } },
  Chilopoda: { gaits: { walk: { ...WALK, w: 0.18, wave: 'retrograde', duty: 0.55, stride: 0.18, rock: 0, snake: 2 }, run: { ...RUN, w: 0.18, wave: 'retrograde', stride: 0.28, rock: 0, snake: 3 } } },
  Isopoda: { gaits: { walk: { ...WALK, w: 0.18, duty: 0.6, stride: 0.15, rock: 0 } } },
  // the crustaceans: the decapods walk, the crabs sideways; the lobsters and the crayfish flip their tails to escape
  Brachyura: { gaits: { sideways: { ...WALK, sideways: true, duty: 0.55, stride: 0.35 }, walk: { ...WALK, duty: 0.6, stride: 0.15 } } },
  Astacidea: { gaits: { walk: { ...WALK, duty: 0.6, stride: 0.18 }, tailFlip: { pattern: 'tailFlip', curl: 70 } } },
  Achelata: { gaits: { walk: { ...WALK, duty: 0.6, stride: 0.18 }, tailFlip: { pattern: 'tailFlip', curl: 60 } } },
};

// worked species whose moves differ from their order's
export const SPECIES_GAITS = {
  tigerBeetle: { run: { ...RUN, stride: 0.7, duty: 0.3 } },   // the fastest runner for its size
  divingBeetle: { swim: { pattern: 'row', legs: 'hind', amp: 55 } },
  groundBeetle: { run: RUN },
  flea: { walk: { ...WALK, stride: 0.2 } },
  crayfish: { swim: { pattern: 'tailFlip', curl: 70 } },
  harvestman: { walk: { ...WALK, duty: 0.5, stride: 0.7, lift: 0.2 } },
};

/** The gaits a bug moves by: its order's, its species' row over them. */
export function bugGaits(order, id) {
  const base = (ORDERS[order] || ORDERS.default).gaits;
  return { ...base, ...(id && SPECIES_GAITS[id] ? SPECIES_GAITS[id] : {}) };
}
