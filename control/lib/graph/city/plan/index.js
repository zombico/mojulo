// the city plan (city-rails): a city recipe laid on rails, layer by layer, read as a book, walked as its massing
export { readCityPlan, inferCity, CITY_KEYS, DISTRICT_USES, SITE_USES, LOT_USES } from './card.js';
export { CITY_GRAMMARS as EARTH_GRAMMARS, PLAY_SCALES, TRANSIT_MODES, grammarAtPlay, grammarFromFlavor } from './grammar.js';
export { GRAMMAR_IDS, GRAMMAR_SCHEMA, WORLD_GRAMMAR_DOCS, WORLD_GRAMMARS, resolveGrammar } from './grammars.js';
export { FACADE_FIELDS, MASS_SHAPES, readFacade, skinLot } from './facades.js';
export { designCity, cityStats, streamOf } from './design.js';
export { CITY_LAWS, CITY_LAW_IDS, evaluateLaws } from './laws.js';
export { readCity, cityReadout, openCityConcerns, cityNextSteps, CITY_OUTCOMES } from './read.js';
export { assembleCityScene, cityBoxes } from './scene.js';
export { cityBookHtml, cityPlanSvg } from './book-html.js';
