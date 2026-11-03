/** hero-held-words — the door's words for the moves that hold a thing (hero-motion.js MOTION_GAITS): the carry holds
 * (hero-carry.js HOLDS) and the sword guards with their mirrors (hero-grip.js GUARD_NAMES). Names only, a leaf module, so
 * the door lists them at load without the solvers behind them, which import the gear (and through it the gameworld's
 * vibes, which read the gaits); hero-held-words.test.js pins them to the tables. */
export const HOLD_WORDS = Object.freeze(['pistolSide', 'pistolLowReady', 'pistolIsosceles', 'pistolOneHand', 'pistolDual', 'carbineLowReady', 'carbineTrail', 'carbineAim', 'shotgunLowReady', 'shotgunTrail', 'shotgunAim', 'lmgSide', 'lmgAim', 'rifleAim', 'rifleLowReady', 'sniperAim', 'sniperLowReady', 'smgAim', 'smgLowReady', 'handgunAim', 'handgunLowReady', 'boxFront', 'suitcaseSide', 'lanternSide', 'lanternOut', 'sackShoulder', 'swordSide', 'greatswordSide', 'greatswordPlanted']);
export const GUARD_WORDS = Object.freeze(['chudan', 'chudanLeft', 'jodan', 'jodanLeft', 'hasso', 'hassoLeft', 'gedan', 'gedanLeft', 'waki', 'wakiLeft', 'terza', 'terzaLeft', 'hanging', 'hangingLeft', 'niten', 'nitenLeft', 'shield', 'shieldLeft', 'challenge', 'challengeLeft', 'reverse', 'reverseLeft', 'trailing', 'trailingLeft']);
/** the bow's shots (hero-bow.js BOW_SHOT_NAMES): one-shots played as a guard is (the stance entered, the arms solved) */
export const BOW_WORDS = Object.freeze(['bowDraw', 'bowLoose']);
/** each shot's seconds (hero-bow.js reads them; the door lists them at load) */
export const BOW_SECONDS = Object.freeze({ bowDraw: 1.6, bowLoose: 1.3 });
/** the throws (hero-throw.js THROWS) by the door's words: one-shots played as a guard is, the ball a prop of the throwing
 * hand until the release (the readout names when it leaves and how fast) */
export const THROW_WORDS = Object.freeze({ throwOverhand: 'overhand', throwPass: 'quarterback', throwSidearm: 'sidearm', throwUnderhand: 'underhand', bowlRoll: 'bowl', chestPass: 'chestPass', setShot: 'setShot', throwIn: 'throwIn', tossServe: 'toss' });
/** the catches (hero-catch.js CATCHES) by the door's words: one-shots, the ball a prop of the catching hand from the touch */
export const CATCH_WORDS = Object.freeze({ catchHigh: 'high', catchLow: 'low', catchChest: 'chest', catchOneHand: 'oneHand', catchSkyball: 'skyball' });
