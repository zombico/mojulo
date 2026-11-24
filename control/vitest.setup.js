// Test-environment install state.
//
// Pins the install groups to creative only, so a suite measures the same surface on
// every machine: without it, physical detection would add the recall group wherever
// @huggingface/transformers happens to resolve (lib/mcp/packs.js, INSTALL_GROUPS).
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

// A design_game run audits its reach and survive levels and reads every level's opening frame in a headless browser
// when one is installed (lib/graph/game/first-frame-check.js levelBrowser). Off under test, so a suite that runs
// design_game never launches Chrome by accident; a suite that means to render injects its own finder or sets this.
process.env.MOJULO_GAME_BROWSER ||= 'off';
// A design_game run stops at its budget and leaves the rest pending (design-game.js RUN_BUDGET_MS): unbounded under test,
// so a suite's run makes every ready step in one call however slow the machine; a suite that tests the budget sets it.
process.env.MOJULO_RUN_BUDGET_MS ||= '0';
// The recorded sound library (lib/graph/sound-library/library.js) is never the developer's under test: a machine that
// installed it would otherwise resolve the shelf's realistic one-shots to their recordings and move every pin that
// reads them. A suite that tests the library builds its own and points MOJULO_SOUNDS_DIR there per case.
process.env.MOJULO_SOUNDS_DIR ||= '/nonexistent/mojulo-sound-library-under-test';
