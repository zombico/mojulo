/**
 * STRATEGIES: one way a mind meets a situation (./vocab.js SITUATIONS), and what it takes. Each lists, most specific
 * first; the last of every situation needs nothing, so every mind resolves every situation.
 *
 *   needs      every word must hold: an action or a capability (./measure.js)
 *   needsAny   at least one must hold
 *   when       { motivation?: [...], aggr?: [min, max] } on the authored axes (aggr: AGGRESSIVENESS levels, inclusive)
 *   unless     { motivation?: [...] }
 *   status     what makes it today, as the cosmos registry says it: built · local (inside one game only) · absent
 *   lowers     the module that makes it, when one does (the engine's mind for every fighting strategy)
 *
 * Pure data.
 */
const MIND = 'lib/graph/worlds/controllable/mind.js';
const TUTORIAL = 'lib/graph/worlds/controllable/tutorial.js';
const ATTACKS = [1, 5];   // defensive and up: everyone but the passive strikes back

export const STRATEGIES = Object.freeze({
  idle: [
    { id: 'post', line: 'holds its post', when: { motivation: ['guard'] }, status: 'built', lowers: MIND },
    { id: 'patrol', line: 'walks its waypoints', needs: ['route'], status: 'built', lowers: TUTORIAL },
    { id: 'graze', line: 'wanders from food to food', when: { motivation: ['forage'] }, status: 'absent' },
    { id: 'follow-ally', line: 'keeps to its ally', when: { motivation: ['escort'] }, status: 'absent' },
    { id: 'wander', line: 'roams', when: { motivation: ['wander', 'territorial'] }, status: 'absent' },
    { id: 'stand', line: 'stays where it is', status: 'built', lowers: TUTORIAL },
  ],
  notice: [
    { id: 'flee', line: 'turns and runs inside its fear radius', when: { motivation: ['flee'] }, status: 'built', lowers: MIND },
    { id: 'warn', line: 'warns before it attacks', when: { motivation: ['territorial'] }, status: 'absent' },
    { id: 'open-fire', line: 'opens with fire, after its reaction time', needs: ['ranged'], when: { aggr: [2, 5] }, unless: { motivation: ['ambient', 'forage', 'escort'] }, status: 'built', lowers: MIND },
    { id: 'close-in', line: 'closes to blade range', needs: ['melee'], when: { aggr: [2, 5] }, unless: { motivation: ['ambient', 'forage', 'escort'] }, status: 'built', lowers: MIND },
    { id: 'ignore', line: 'pays it no mind', status: 'built' },
  ],
  engage: [
    { id: 'keep-away', line: 'keeps its distance from the threat', when: { motivation: ['flee'] }, status: 'built', lowers: MIND },
    { id: 'circle', line: 'circles in three dimensions', needs: ['flier'], needsAny: ['ranged', 'melee'], when: { aggr: ATTACKS }, status: 'built', lowers: MIND },
    { id: 'siege', line: 'holds back and lobs', needs: ['lob'], when: { aggr: ATTACKS }, status: 'built', lowers: MIND },
    { id: 'rush', line: 'presses in with a spray weapon', needs: ['area'], when: { aggr: ATTACKS }, status: 'built', lowers: MIND },
    { id: 'kite', line: 'backs off while it shoots (the arena commander\'s posture)', needs: ['ranged', 'commanded'], when: { aggr: ATTACKS }, status: 'built', lowers: 'lib/graph/worlds/controllable/commander.js', note: 'a commander\'s kite posture, spaced by the mind' },
    { id: 'skirmish', line: 'holds mid range and weaves', needs: ['ranged'], when: { aggr: ATTACKS }, status: 'built', lowers: MIND },
    { id: 'brawl', line: 'fights at blade range', needs: ['melee'], when: { aggr: ATTACKS }, status: 'built', lowers: MIND },
    { id: 'hold', line: 'stands its ground', status: 'built' },
  ],
  strike: [
    { id: 'counter', line: 'charges a raw swing (charge beats swing)', needs: ['tackle'], when: { aggr: [4, 4] }, status: 'built', lowers: MIND },
    { id: 'melee-commit', line: 'commits to a blade string, with a timeout', needs: ['melee'], when: { aggr: ATTACKS }, status: 'built', lowers: MIND },
    { id: 'fire-burst', line: 'fires in bursts when aimed and clear', needs: ['ranged'], when: { aggr: ATTACKS }, status: 'built', lowers: MIND },
    { id: 'none', line: 'does not attack', status: 'built' },
  ],
  pressed: [
    { id: 'break-and-flee', line: 'breaks off and runs', when: { motivation: ['flee'] }, status: 'built', lowers: MIND },
    { id: 'dodge', line: 'rolls off the line when it recovers', needs: ['dodge'], when: { aggr: ATTACKS }, status: 'built', lowers: MIND },
    { id: 'retreat', line: 'dashes back off a clash and switches to guns', needs: ['dash', 'ranged'], when: { aggr: ATTACKS }, status: 'built', lowers: MIND },
    { id: 'fight-on', line: 'takes it and carries on', status: 'built' },
  ],
  lost: [
    { id: 'return-to-post', line: 'goes back to its post', when: { motivation: ['guard'] }, status: 'built', lowers: MIND },
    { id: 'search-last-seen', line: 'searches where it last saw the target', needs: ['memory'], status: 'absent' },
    { id: 'switch-tools', line: 'gives up the blade for guns a while', needs: ['melee', 'ranged'], when: { aggr: ATTACKS }, status: 'built', lowers: MIND },
    { id: 'forget', line: 'lets it go', status: 'built' },
  ],
});
