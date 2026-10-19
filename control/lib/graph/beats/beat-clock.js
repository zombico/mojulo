/**
 * THE BEAT CLOCK — the music's pulse said on the bus (audio.beat: { every, lead }, beats-world.js), as the World page
 * says it (scene/channels/audio.js __beatClock) and the Godot kernel does (kernel/level.gd _beat_tick): at a clock
 * reading `t` (the music's own time since its start, plus `lead`), every beat n with n × every ≤ t not said yet is
 * said as { type: 'beat', n }, but one already a whole period stale is passed over, and at most four a reading.
 * The page reads its AudioContext, Godot its music player; the harness reads the level's fixed step, the same number
 * in both, so this one function is the twin they are held to.
 *
 *   beatsDue(clock, t, every) → [{ type: 'beat', n }]   clock: { n } (the next beat), advanced in place
 */
export function beatsDue(clock, t, every) {
  const out = [];
  let k = 0;
  while (clock.n * every <= t && k++ < 4) {
    if (t - clock.n * every < every) out.push({ type: 'beat', n: clock.n });
    clock.n++;
  }
  return out;
}
