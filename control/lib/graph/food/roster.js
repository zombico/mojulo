/**
 * THE FOOD SHELF'S ROWS: what a work shift's things look like, by the words people say. Three tables, each a row a
 * thing; a new food is a row, never code.
 *
 *   INGREDIENTS   a raw thing: its words, its FORM (the builder in forms.js that draws it whole), its colours, and what
 *                 it looks like PREPPED (worked at a station: chopped, sliced, cut) and COOKED (run alone: in a pot, a pan,
 *                 an oven): each a form and its colours. `family` groups the rows a word no row names falls back to.
 *   STATES        what a station does to one thing, read from its words or from the station: whole, prepped, cooked,
 *                 packed (a bucket that takes one thing and makes another: a crate of it, a sack of it), burnt
 *   DISHES        what an assembly makes, by its words: the ARRANGEMENT its parts are composed in (nigiri: a base and a
 *                 topping; a roll: rings cut from a wrap; a bowl, a salad, a soup, a stack, a plate) and its vessel
 *
 * Colours are a thing's own (a fillet's flesh, a tomato's red), chosen to be told apart at gameplay distance from above:
 * the raw and the prepped of one thing differ in form or colour, never in neither (food/laws.js).
 */

const row = (o) => Object.freeze(o);

export const INGREDIENTS = Object.freeze({
  fish: row({ words: ['fish', 'salmon', 'tuna', 'mackerel', 'cod', 'trout'], family: 'fish', form: 'fish', colours: ['#8fb3c9', '#dfe9ee'],
    prepped: { form: 'fillet', colours: ['#f08a6c', '#fbd3c4'] }, cooked: { form: 'fillet', colours: ['#c9784a', '#e9b38a'] } }),
  rice: row({ words: ['rice', 'grain'], family: 'grain', form: 'sack', colours: ['#e6d6b0', '#8a6a43'],
    prepped: { form: 'mound', colours: ['#f4efe2'] }, cooked: { form: 'mound', colours: ['#fbfaf5'], vessel: 'bowl' } }),
  wheat: row({ words: ['wheat', 'barley', 'oats', 'corn'], family: 'grain', form: 'sheaf', colours: ['#e2bf5c', '#b8913a'],
    prepped: { form: 'mound', colours: ['#e8cf86'] }, cooked: { form: 'loaf', colours: ['#c98a45', '#e8b773'] } }),
  flour: row({ words: ['flour', 'meal', 'sugar', 'salt'], family: 'grain', form: 'sack', colours: ['#f3efe6', '#b9b2a2'],
    prepped: { form: 'mound', colours: ['#f7f4ec'] }, cooked: { form: 'loaf', colours: ['#c98a45', '#e8b773'] } }),
  seed: row({ words: ['seed', 'seeds', 'beans', 'peas'], family: 'grain', form: 'sack', colours: ['#c7a76b', '#8a6e43'],
    prepped: { form: 'mound', colours: ['#a98a55'] }, cooked: { form: 'mound', colours: ['#7f6a45'], vessel: 'bowl' } }),
  lettuce: row({ words: ['lettuce', 'cabbage', 'greens', 'spinach', 'kale'], family: 'leafy', form: 'head', colours: ['#79c257', '#c4e6a3'],
    prepped: { form: 'shreds', colours: ['#86cc62', '#c4e6a3'] }, cooked: { form: 'shreds', colours: ['#4f8a3a'], vessel: 'bowl' } }),
  tomato: row({ words: ['tomato', 'tomatoes', 'apple', 'cherry', 'pepper', 'chili'], family: 'fruit', form: 'fruit', colours: ['#e0452f', '#3f8a3a'],
    prepped: { form: 'slices', colours: ['#e0452f', '#f6a08f'] }, cooked: { form: 'sauce', colours: ['#b8321f'], vessel: 'bowl' } }),
  orange: row({ words: ['orange', 'lemon', 'lime', 'citrus'], family: 'fruit', form: 'fruit', colours: ['#f29a2e', '#3f8a3a'],
    prepped: { form: 'slices', colours: ['#f29a2e', '#fcd9a4'] }, cooked: { form: 'sauce', colours: ['#d9822a'], vessel: 'bowl' } }),
  carrot: row({ words: ['carrot', 'carrots', 'radish'], family: 'root', form: 'carrot', colours: ['#ef8a2c', '#4f9a3a'],
    prepped: { form: 'cubes', colours: ['#ef8a2c'] }, cooked: { form: 'cubes', colours: ['#c96a22'], vessel: 'bowl' } }),
  potato: row({ words: ['potato', 'potatoes', 'yam'], family: 'root', form: 'lump', colours: ['#b58a5a'],
    prepped: { form: 'cubes', colours: ['#efd9a6'] }, cooked: { form: 'cubes', colours: ['#e0a94e'] } }),
  onion: row({ words: ['onion', 'onions', 'garlic', 'shallot'], family: 'root', form: 'bulb', colours: ['#b0628f', '#e9d6c2'],
    prepped: { form: 'rings', colours: ['#efe2ec'] }, cooked: { form: 'rings', colours: ['#c98f4a'] } }),
  mushroom: row({ words: ['mushroom', 'mushrooms'], family: 'root', form: 'mushroom', colours: ['#a37c5c', '#eadfcf'],
    prepped: { form: 'slices', colours: ['#cdb79c', '#eadfcf'] }, cooked: { form: 'slices', colours: ['#8a6440', '#b8946a'] } }),
  meat: row({ words: ['meat', 'beef', 'steak', 'pork', 'lamb', 'chicken', 'ham', 'bacon'], family: 'meat', form: 'slab', colours: ['#c8524a', '#f2d6cc'],
    prepped: { form: 'strips', colours: ['#d4645b'] }, cooked: { form: 'slab', colours: ['#7a3f26', '#b8743f'] } }),
  egg: row({ words: ['egg', 'eggs'], family: 'egg', form: 'egg', colours: ['#f3ead8'],
    prepped: { form: 'cracked', colours: ['#fbfaf5', '#f2b62c'] }, cooked: { form: 'fried', colours: ['#fbfaf5', '#f2a81c'] } }),
  bread: row({ words: ['bread', 'bun', 'buns', 'dough', 'tortilla'], family: 'bread', form: 'loaf', colours: ['#d39a55', '#f0cf98'],
    prepped: { form: 'slices', colours: ['#e3b06c', '#f6e2bd'] }, cooked: { form: 'loaf', colours: ['#a8642b', '#d39a55'] } }),
  cheese: row({ words: ['cheese', 'butter', 'tofu'], family: 'dairy', form: 'wedge', colours: ['#f2cc4a'],
    prepped: { form: 'cubes', colours: ['#f2cc4a'] }, cooked: { form: 'sauce', colours: ['#f0b52a'], vessel: 'bowl' } }),
  seaweed: row({ words: ['seaweed', 'nori', 'kelp'], family: 'leafy', form: 'sheet', colours: ['#2c4a34'],
    prepped: { form: 'shreds', colours: ['#355a3f'] }, cooked: { form: 'shreds', colours: ['#24402c'], vessel: 'bowl' } }),
  noodles: row({ words: ['noodles', 'noodle', 'pasta', 'spaghetti', 'ramen'], family: 'grain', form: 'bundle', colours: ['#f1dca0'],
    prepped: { form: 'bundle', colours: ['#f1dca0'] }, cooked: { form: 'nest', colours: ['#f6e4b0'], vessel: 'bowl' } }),
  water: row({ words: ['water', 'broth', 'stock', 'milk', 'oil'], family: 'liquid', form: 'jug', colours: ['#7fb7d9', '#e4eef2'],
    prepped: { form: 'jug', colours: ['#7fb7d9', '#e4eef2'] }, cooked: { form: 'sauce', colours: ['#c9b27a'], vessel: 'bowl' } }),
});

/** What a family looks like where no row names the word (a word its family's words point at). */
export const FAMILY_WORDS = Object.freeze({
  fish: ['prawn', 'shrimp', 'crab', 'squid', 'eel', 'clam'], grain: ['millet', 'quinoa'], leafy: ['herb', 'herbs', 'basil', 'mint', 'parsley', 'chard'],
  fruit: ['berry', 'berries', 'plum', 'peach', 'pear', 'grape'], root: ['beet', 'turnip', 'ginger', 'leek'], meat: ['sausage', 'duck', 'turkey'],
});

/** What a station does to the one thing it takes: read from the made thing's own words first, else from the station. */
export const STATES = Object.freeze({
  whole: row({ words: [], about: 'as it comes: raw, from its crate' }),
  prepped: row({ words: ['sliced', 'chopped', 'cut', 'diced', 'minced', 'shredded', 'peeled', 'grated', 'washed', 'prepped', 'filleted'], about: 'worked at a station: a shovel that does not run alone' }),
  cooked: row({ words: ['cooked', 'boiled', 'fried', 'grilled', 'baked', 'roasted', 'steamed', 'stewed', 'seared', 'toasted'], about: 'run alone: a pot, a pan, an oven' }),
  packed: row({ words: ['crate', 'crated', 'bag', 'bagged', 'sack', 'box', 'boxed', 'packed', 'parcel', 'bundle'], about: 'a bucket that takes one thing: a box or a sack of it' }),
  burnt: row({ words: ['burnt', 'burned', 'charred'], about: 'left past its hold' }),
});

/** What an assembly makes, by its words: how its parts are composed, and on what. */
export const DISHES = Object.freeze({
  nigiri: row({ words: ['sushi', 'nigiri', 'sashimi'], arrangement: 'nigiri', vessel: 'plate', about: 'a base pressed in a block, the topping laid over it' }),
  roll: row({ words: ['roll', 'maki', 'wrap', 'burrito', 'kimbap'], arrangement: 'roll', vessel: 'plate', about: 'rings cut from a wrap, the parts in the middle' }),
  salad: row({ words: ['salad', 'slaw'], arrangement: 'heap', vessel: 'bowl', about: 'the parts tossed in a bowl' }),
  soup: row({ words: ['soup', 'stew', 'curry', 'broth', 'chowder', 'ramen'], arrangement: 'soup', vessel: 'bowl', about: 'a bowl of it, its parts floating' }),
  stack: row({ words: ['burger', 'sandwich', 'stack', 'toastie', 'sub'], arrangement: 'stack', vessel: 'plate', about: 'the parts layered between bread' }),
  pie: row({ words: ['pie', 'pizza', 'tart', 'quiche', 'flatbread'], arrangement: 'round', vessel: 'plate', about: 'a round base, the parts over it' }),
  plate: row({ words: ['plate', 'meal', 'dinner', 'lunch', 'breakfast', 'platter', 'special'], arrangement: 'plate', vessel: 'plate', about: 'the parts side by side on a plate' }),
});

/** The vessels a thing is served or kept in. */
export const VESSELS = Object.freeze({
  plate: row({ colours: ['#f6f3ec', '#d9d4c8'] }),
  bowl: row({ colours: ['#f2eee6', '#7f9bb0'] }),
  crate: row({ colours: ['#c9a978', '#9b7a4e'] }),
  sack: row({ colours: ['#d8c49a', '#9b8458'] }),
});
