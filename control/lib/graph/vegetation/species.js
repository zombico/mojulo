// vegetation/species — the species a pool can grow, as plain data (no growth code loads with it). pool.js grows them;
// a manifest validator can name them without loading the engine.
export const LEVELS = ['L0', 'L1', 'L2', 'L3'];
/**
 * The species table: what each name grows. Heights are the placement range a scatter should draw from; `bark` is the
 * fracture preset its trunk wears (a fir takes pine's plates, the only conifer bark the model has).
 */
export const SPECIES = Object.freeze({
  oak: { kind: 'tree', bark: 'oak', arch: 'rauh', years: 20, leafScale: 1.5, heights: [11, 20] },
  beech: { kind: 'tree', bark: 'beech', arch: 'troll', years: 20, leafScale: 1.5, heights: [10, 18] },
  fir: { kind: 'tree', bark: 'pine', arch: 'massart', years: 16, leafScale: 1, heights: [9, 17] },
  coconut: { kind: 'palm', palm: 'coconut', ages: [22, 32, 45], heights: [8, 26] },
  date: { kind: 'palm', palm: 'date', ages: [18, 30, 45], heights: [5, 16] },
  washingtonia: { kind: 'palm', palm: 'washingtonia', ages: [25, 40], heights: [11, 18] },
  moso: { kind: 'culm', bamboo: 'moso', sizes: [0.8, 1.0, 1.15], heights: [10, 17] },
  vulgaris: { kind: 'culm', bamboo: 'vulgaris', sizes: [0.85, 1.0], heights: [8, 15] },
  reed: { kind: 'tuft', bamboo: 'reed', stems: 12, heights: [1.5, 3.5] },
});
