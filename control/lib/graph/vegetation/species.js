// vegetation/species — the species a pool can grow, as plain data (no growth code loads with it). pool.js grows them;
// a manifest validator can name them without loading the engine.
export const LEVELS = ['L0', 'L1', 'L2', 'L3'];
/**
 * The species table: what each name grows. Heights are the placement range a scatter should draw from; `bark` is the
 * fracture preset its trunk wears (`fir`, the self-organizing Massart tree, keeps pine's plates); `leafLife` (years a
 * leaf is kept, over the architecture's own) makes a tree evergreen; `fig` names a fig row (ficus.js), whose architecture
 * carries its roots, lattice or buttresses; `over` retunes its architecture's numbers; `bloom` dresses its leaf faces as
 * blossom (a flowering tree in flower).
 */
export const SPECIES = Object.freeze({
  oak: { kind: 'tree', bark: 'oak', arch: 'rauh', years: 20, leafScale: 1.5, heights: [11, 20] },
  beech: { kind: 'tree', bark: 'beech', arch: 'troll', years: 20, leafScale: 1.5, heights: [10, 18] },
  fir: { kind: 'tree', bark: 'pine', arch: 'massart', years: 16, leafScale: 1, heights: [9, 17] },
  // the umbrella tree of tropical mountains: Leeuwenberg's sympodial crown on a short forking bole, evergreen
  schefflera: { kind: 'tree', bark: 'beech', arch: 'leeuwenberg', years: 18, leafScale: 1.4, leafLife: 3, heights: [10, 24] },
  // the figs of a tropical forest (ficus.js): a banyan on its pillar roots, an emergent strangler on its lattice, a rubber
  // fig on plank buttresses
  banyan: { kind: 'tree', bark: 'beech', arch: 'rauh', fig: 'banyan', years: 22, leafScale: 1.3, heights: [12, 22] },
  strangler: { kind: 'tree', bark: 'beech', arch: 'rauh', fig: 'strangler', years: 24, leafScale: 1.4, heights: [25, 38] },
  rubberfig: { kind: 'tree', bark: 'beech', arch: 'troll', fig: 'rubberfig', years: 24, leafScale: 1.2, heights: [20, 35] },
  // the flowering cherry (Prunus × yedoensis 'Somei-yoshino') in full bloom: Rauh's upright trunk made decurrent (`over`:
  // weaker apical control, wider-set limbs), so it forks low into a dome about as wide as it is tall —
  // its leaves are its blossom (`bloom`: the deep, the petal and the lit tone the leaf faces are recoloured between; `fill`
  // the blossom's area over the leaves', a spur carrying several flower clusters), kept two years along the spurs (`leafLife`)
  cherry: { kind: 'tree', bark: 'beech', arch: 'rauh', over: { apical: [0.5, 0.44], matureAt: 8, setPoint: [0, 52, 64, 74] }, years: 12, leafScale: 1.8, leafLife: 2, heights: [5, 9], bloom: { fill: 3, deep: [222, 150, 178], petal: [246, 200, 214], lit: [255, 236, 242] } },
  coconut: { kind: 'palm', palm: 'coconut', ages: [22, 32, 45], heights: [8, 26] },
  date: { kind: 'palm', palm: 'date', ages: [18, 30, 45], heights: [5, 16] },
  washingtonia: { kind: 'palm', palm: 'washingtonia', ages: [25, 40], heights: [11, 18] },
  treefern: { kind: 'palm', palm: 'treefern', ages: [35, 50, 65], heights: [3, 9] },
  moso: { kind: 'culm', bamboo: 'moso', sizes: [0.8, 1.0, 1.15], heights: [10, 17] },
  vulgaris: { kind: 'culm', bamboo: 'vulgaris', sizes: [0.85, 1.0], heights: [8, 15] },
  reed: { kind: 'tuft', bamboo: 'reed', stems: 12, heights: [1.5, 3.5] },
  // the conifers, grown by rule (conifer.js); `stand` is the live crown they are grown with (0 open, 1 closed), and a pine
  // wears two barks, plated low and papery orange above
  spruce: { kind: 'conifer', conifer: 'spruce', bark: 'spruce', stand: 0.6, heights: [18, 34] },
  silverfir: { kind: 'conifer', conifer: 'silverfir', bark: 'silverfir', stand: 0.6, heights: [18, 32] },
  pine: { kind: 'conifer', conifer: 'pine', bark: 'pine', barkHigh: 'pineUpper', stand: 0.5, heights: [15, 27] },
});
