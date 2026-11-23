/**
 * Steel Serpents' own sounds (the `steel-serpents` rail, stealth action: a covert operative slipping through a guarded
 * compound): a FLAVOR, heard only by a game of that flavor. Its sheet's slots (quiet steps on concrete and steel, a
 * vault, a drop, a roll, a knife), its doors, a keycard, and its guards' voices where its foes are drawn as people.
 * Described as sounds of their own, never as another game's.
 *
 * Being spotted (`alarm`) and the extraction (`goal`) stay the shelf's cues: asked for "over a radio", their takes came
 * back as voices, and a cue must stay a cue (a prompt for a cue names no radio, speaker or announcer).
 */

const FLAVOR = 'steel-serpents';
const shot = (id, shelf, prompt, seconds = 0.6, extra = {}) => ({ id, shelf, flavor: FLAVOR, role: 'one-shot', prompt: `${prompt}, a stealth action game sound effect, realistic, clean, no music`, seconds, influence: 0.55, loop: false, takes: 3, ...extra });

export const CARDS = [
  // the operative: quiet on its feet
  shot('ss-step', 'step', 'a covert operative\'s careful footstep on concrete, a soft rubber boot sole, quiet, no voice', 0.5),
  shot('ss-step-metal', 'step-metal', 'a covert operative\'s careful footstep on a steel catwalk, a soft muted clank, no voice', 0.5),
  shot('ss-jump', 'jump', 'a soldier vaulting over a crate, webbing and gear rustling, a soft push-off, no voice', 0.6),
  shot('ss-land', 'land', 'a soldier dropping down quietly, a soft knees-bent thud and gear rustle, no voice', 0.6),
  shot('ss-dodge', 'dodge', 'a quick tactical roll on concrete, gear rustling, no voice', 0.8),
  shot('ss-swing', 'blade-swing', 'a combat knife slashing fast through the air, a short sharp swish, no voice', 0.5),
  shot('ss-strike', 'blade-hit', 'a close-quarters takedown blow, a muffled body thud and cloth, no voice', 0.6),
  // the compound
  shot('ss-latch', 'latch', 'a security door keycard reader beeping and its electronic lock clunking open, no voice', 1.2),
  shot('ss-door', 'door', 'a heavy steel security door sliding open with a pneumatic hiss, no voice', 1.5),
  shot('ss-pickup', 'pickup', 'picking up a keycard, a soft plastic click and a short confirming beep, no voice', 0.6),
  // its guards, where they are drawn as people
  shot('ss-guard-shout', 'attack-shout', 'a soldier\'s sharp short shout as he lunges, a wordless yell', 0.6),
  shot('ss-guard-hurt', 'hurt-grunt', 'a soldier grunting as he is struck, a short wordless grunt', 0.5),
  shot('ss-guard-down', 'hurt-heavy', 'a soldier knocked out, a wordless groan and a body slumping to a concrete floor', 1.2),
];
