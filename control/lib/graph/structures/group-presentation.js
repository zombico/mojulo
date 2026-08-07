/**
 * group-presentation — the PURE structure→group step (math-worlds.plan.md, Phase 1).
 *
 * A finite group given by a small family spec, realized as a concrete multiplication table.
 * The whole engine is ONE idea: every target group (ℤ/n, Dₙ, Sₙ, Q₈) is a permutation group,
 * so we (1) name a couple of generator permutations, (2) BFS the closure under composition from
 * the identity, and (3) index elements in discovery order. Multiplication, inverse, and a
 * shortest generator WORD for every element all fall out of that one traversal. No CSG, no
 * geometry, no I/O — this file knows nothing about cities. It is unit-tested in isolation from
 * the graph→geometry step exactly as the plan's wiring checklist requires.
 *
 * Convention: elements ARE permutation arrays; the group operation is function composition
 *   mul(a,b)[p] = a[b[p]]   (apply b, then a)
 * so "walk generator x from element g" is the RIGHT product mul(g, x) = g∘x, i.e. the right
 * Cayley graph. Every layout/edge/walk downstream assumes this one convention.
 */

// perm helpers — a permutation is an int[] where perm[i] is the image of point i.
const identityPerm = (m) => Array.from({ length: m }, (_, i) => i);
const compose = (a, b) => b.map((bi) => a[bi]);          // (a∘b)[p] = a[b[p]]
const permKey = (p) => p.join(',');

// n-cycle (0 1 2 … n-1): the canonical "rotation" generator.
const cyclePerm = (n) => Array.from({ length: n }, (_, i) => (i + 1) % n);
// reflection i ↦ (n - i) mod n: the canonical dihedral "flip".
const reflectPerm = (n) => Array.from({ length: n }, (_, i) => (n - i) % n);
// transposition (a b) on n points, identity elsewhere.
const transposePerm = (n, a, b) => identityPerm(n).map((i) => (i === a ? b : i === b ? a : i));

// Q₈ as its left-regular representation on its own 8 elements, so the permutation-closure engine
// needs no special case. Abstract elements 0..7 = [1, -1, i, -i, j, -j, k, -k]; we compute the
// 8×8 table from quaternion sign algebra, then L_g[h] = g·h is a faithful permutation, and
// L_{g}∘L_{h} = L_{g·h}. Generators i and j regenerate all of Q₈.
function quaternionTable() {
  // basis multiply on {1,i,j,k}: returns [signIndexProduct]. Encode unit as index 0..3 with sign.
  const UNITS = ['1', 'i', 'j', 'k'];
  const mulUnit = (a, b) => {
    if (a === 0) return [1, b];
    if (b === 0) return [1, a];
    if (a === b) return [-1, 0];                          // i²=j²=k²=-1
    const cyc = { '12': [1, 3], '23': [1, 1], '31': [1, 2] };   // ij=k, jk=i, ki=j
    const key = `${a}${b}`;
    if (cyc[key]) return cyc[key];
    const rev = `${b}${a}`;
    if (cyc[rev]) return [-cyc[rev][0], cyc[rev][1]];      // ji=-k, etc.
    return [1, 0];
  };
  // element index ↔ (sign, unit): 0:1 1:-1 2:i 3:-i 4:j 5:-j 6:k 7:-k
  const toSU = (idx) => [idx % 2 === 0 ? 1 : -1, Math.floor(idx / 2)];
  const toIdx = (sign, unit) => unit * 2 + (sign > 0 ? 0 : 1);
  const table = [];
  for (let g = 0; g < 8; g++) {
    const [sg, ug] = toSU(g);
    const row = [];
    for (let h = 0; h < 8; h++) {
      const [sh, uh] = toSU(h);
      const [s, u] = mulUnit(ug, uh);
      row.push(toIdx(sg * sh * s, u));
    }
    table.push(row);
  }
  return table;                                           // table[g] IS the permutation L_g
}

// Family → { m (points), gens: [{ name, symbol, perm }], relations, title }. relations are
// descriptive strings for narration / cards; they are not used by the closure (the perms ARE
// the group), but every family states them because "the loop that brings you home" is the point.
function familySpec({ family, n = 4 } = {}) {
  const k = Math.max(1, Math.floor(n));
  switch (family) {
    case 'cyclic':
      return {
        family, order: k, m: Math.max(k, 1), title: `ℤ/${k}`,
        gens: [{ name: 'a', symbol: 'a', perm: cyclePerm(Math.max(k, 1)) }],
        relations: [`a^${k} = e`],
      };
    case 'dihedral':
      return {
        family, order: 2 * k, m: k, title: `D${subscript(k)}`,
        gens: [
          { name: 'r', symbol: 'r', perm: cyclePerm(k) },
          { name: 's', symbol: 's', perm: reflectPerm(k) },
        ],
        relations: [`r^${k} = e`, 's² = e', 'srs = r⁻¹'],
      };
    case 'symmetric': {
      const s = Math.max(k, 2);
      return {
        family, order: factorial(s), m: s, title: `S${subscript(s)}`,
        gens: [
          { name: 't', symbol: '(1 2)', perm: transposePerm(s, 0, 1) },
          { name: 'c', symbol: `(1…${s})`, perm: cyclePerm(s) },
        ],
        relations: s === 3 ? ['c³ = e', 't² = e', 'tct = c⁻¹'] : [`c^${s} = e`, 't² = e', 'braid relations'],
      };
    }
    case 'quaternion': {
      const T = quaternionTable();
      return {
        family, order: 8, m: 8, title: 'Q₈',
        gens: [
          { name: 'i', symbol: 'i', perm: T[2] },         // L_i
          { name: 'j', symbol: 'j', perm: T[4] },         // L_j
        ],
        relations: ['i⁴ = e', 'i² = j²', 'j i j⁻¹ = i⁻¹'],
      };
    }
    default:
      return familySpec({ family: 'dihedral', n: 4 });    // sensible fallback, mirrors view builders
  }
}

const factorial = (x) => (x <= 1 ? 1 : x * factorial(x - 1));
const SUBS = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
const subscript = (x) => String(x).split('').map((c) => SUBS[c] || c).join('');

/**
 * buildGroup({ family, n }) → a fully-realized finite group.
 *
 * BFS the Cayley closure from the identity permutation under the family's generators. Discovery
 * order fixes the element indices (identity = 0). Every element carries the SHORTEST generator
 * word that spells it (BFS parent chain) — that word is what the layout uses to place plazas and
 * what a "walk a relation" waypoint route replays.
 *
 * @returns {{
 *   family: string, order: number, title: string, relations: string[],
 *   generators: {name:string, symbol:string}[],
 *   elements: {index:number, word:string[], label:string}[],
 *   identity: number,
 *   mul(i:number, j:number): number,
 *   inv(i:number): number,
 *   step(i:number, genName:string): number,
 * }}
 */
export function buildGroup(spec = {}) {
  const { order: expectedOrder, m, gens, relations, title, family } = familySpec(spec);
  const id = identityPerm(m);
  const byKey = new Map();                                // permKey → index
  const perms = [];                                       // index → perm
  const words = [];                                       // index → shortest generator-name word
  const push = (perm, word) => {
    const key = permKey(perm);
    if (byKey.has(key)) return byKey.get(key);
    const idx = perms.length;
    byKey.set(key, idx);
    perms.push(perm);
    words.push(word);
    return idx;
  };
  push(id, []);                                           // identity is always index 0
  const queue = [0];
  while (queue.length) {
    const cur = queue.shift();
    for (const g of gens) {
      const next = compose(perms[cur], g.perm);           // right product cur∘g
      const key = permKey(next);
      if (!byKey.has(key)) {
        const idx = push(next, [...words[cur], g.name]);
        queue.push(idx);
      }
    }
  }
  if (Number.isFinite(expectedOrder) && perms.length !== expectedOrder) {
    // A closure that misses its declared order is a family-spec bug, not user input — fail loud.
    throw new Error(`buildGroup(${family}): closure order ${perms.length} ≠ expected ${expectedOrder}`);
  }
  const order = perms.length;
  const mul = (a, b) => byKey.get(permKey(compose(perms[a], perms[b])));
  const inv = (a) => {
    // small groups: inverse is the (unique) b with a∘b = e — one linear scan, no perm algebra.
    for (let b = 0; b < order; b++) if (mul(a, b) === 0) return b;
    return 0;
  };
  const genByName = new Map(gens.map((g) => [g.name, g]));
  const step = (a, genName) => {
    const g = genByName.get(genName);
    if (!g) throw new Error(`group ${title}: no generator '${genName}'`);
    return byKey.get(permKey(compose(perms[a], g.perm)));
  };
  const elements = perms.map((_, index) => ({ index, word: words[index], label: wordLabel(words[index], gens) }));
  return {
    family, order, title, relations,
    generators: gens.map((g) => ({ name: g.name, symbol: g.symbol })),
    elements, identity: 0, mul, inv, step,
  };
}

// A readable label for an element from its generator word: 'e' for identity, else the word with
// runs collapsed to powers (r,r,r → r³). Purely cosmetic (plaza signage / probe labels).
function wordLabel(word, gens) {
  if (!word.length) return 'e';
  const sym = new Map(gens.map((g) => [g.name, g.symbol.length === 1 ? g.symbol : g.name]));
  let out = '';
  let i = 0;
  while (i < word.length) {
    let j = i;
    while (j < word.length && word[j] === word[i]) j++;
    const run = j - i;
    out += (sym.get(word[i]) || word[i]) + (run > 1 ? superscript(run) : '');
    i = j;
  }
  return out;
}
const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
const superscript = (x) => String(x).split('').map((c) => SUP[c] || c).join('');

export const GROUP_FAMILIES = ['cyclic', 'dihedral', 'symmetric', 'quaternion'];
