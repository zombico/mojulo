// Test-environment install state.
//
// Pins the install groups to creative only, so a suite measures the same surface on
// every machine: without it, physical detection would add the recall group wherever
// @huggingface/transformers happens to resolve (lib/mcp/packs.js, INSTALL_GROUPS).
// Until 3.0 this also turned the chatbot pack on; that pack left mojulo with the
// chatbot factory.
//
// This is a floor, not an override: it only fills MOJULO_PACKS when nothing set
// it, so a suite that deliberately exercises gating (packs.test.js sets the env
// per case, or passes an explicit env object that never reads process.env) still
// controls its own state.
process.env.MOJULO_PACKS ||= 'creative';

// The recipe book bundled at control/book is off by default under test, so a suite
// measures core alone (the empty book snapshot) unless it opts in. Bundled-book
// suites set MOJULO_BUNDLED_BOOK per case (lib/graph/views/recipe-book/bundled.test.js).
process.env.MOJULO_BUNDLED_BOOK ||= 'off';
