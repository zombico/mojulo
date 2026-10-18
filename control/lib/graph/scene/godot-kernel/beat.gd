extends RefCounted
# mojulo-godot kernel — the MUSIC'S BEAT, said early by its own clock (beats/beat-clock.js beatsDue, line for line): at a
# clock reading t, each beat not said yet, a period-stale one passed over, four at most a reading. Pure: kernel/level.gd
# reads the clock (the music player's position, or the harness's fixed step) and puts what is due on the bus. Held equal
# by the seeded clock corpus and a level played in both engines (godot-beat.test.js).
#
#   const Beat := preload("res://kernel/beat.gd")
#   Beat.beats_due(n, t, every) → [events, the next beat]


static func beats_due(n: int, t: float, every: float) -> Array:
	var out: Array = []
	var k := 0
	while n * every <= t and k < 4:
		k += 1
		if t - n * every < every:
			out.append({"type": "beat", "n": n})
		n += 1
	return [out, n]
