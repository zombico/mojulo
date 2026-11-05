/**
 * THE JOB WORDS — what the jobs inside a req are told, kept apart from the code that runs them so the plugin's agent
 * definitions (scripts/plugin-agents.mjs) are generated from the same words the server serves. No imports: a script
 * reads it with plain node.
 *
 *   LENSES       what a critic reads with (jobs.js)
 *   STYLES       the director's styles; POSTURE_OF, the assistant director's posture each sets; POSTURES, what each asks
 */

/** The plugin's agent for each kind of job (scripts/plugin-agents.mjs writes them): a brief names it for a host that
 * declares `capabilities.jobAgents` and has the plugin's agents installed. */
export const JOB_AGENTS = Object.freeze({ author: 'mojulo-author', diverge: 'mojulo-author', critic: 'mojulo-critic', assistant: 'mojulo-assistant' });

export const LENSES = Object.freeze({
  design: 'against the remit and the precedent: does it do what it was asked, and is its one new idea there?',
  play: 'as a player: the way in, what stands in the way, the way out; where it is a default and plays like one',
  look: 'as a viewer: the first sight of it, its palette against the world, what reads as a default',
});

export const STYLES = Object.freeze({
  yeoman: 'deliver it well and on time: the work is sound, the remit met',
  auteur: 'a signature held: every choice consistent with the vision',
  'avant-garde': 'novelty is the point: beyond the default, within the world\'s laws',
});
export const DEFAULT_STYLE = 'auteur';

export const POSTURE_OF = Object.freeze({ yeoman: 'assistive', auteur: 'strict', 'avant-garde': 'elevating' });
export const POSTURES = Object.freeze({
  assistive: 'Is it done, and done well? Pass it up when it is sound and its remit met; rework it only for what blocks (a gate that fails, a remit unmet, a gap in its asks). Note sameness and uncited choices, never block on them.',
  strict: 'Is it ours? Pass it up when every decision traces to the intent, the book and the precedent; rework what drifts from the established voice (a palette off key, a foe outside the world\'s language, a choice the seed made). With little established yet, hold it as assistive would, and say so.',
  elevating: 'What would make it memorable? Pass it up when it does something the precedent does not; elevate what reads as the default, repeats the last unit or plays it safe, with a bolder angle. Stay within the world\'s laws: bolder, never incoherent.',
});
