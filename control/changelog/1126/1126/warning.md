### A warning: a boss coming, said as its own

- A cue's `warning` (`playscape/ui/cues.js`): `{ warning: '<words>' | { say, title?, ttl? } }`, the moment a boss, or a
  fight that plays as one, is coming. Not a banner among the others: a band across the screen in translucent red over a
  dim of the world, hazard stripes along its edges, its title (WARNING by default; CAUTION, or any word up to 16 letters)
  large and spaced over the words, the band blinking as it comes, gone after its seconds (3.2).
- Its own sound: a two-tone klaxon synthesised on the page (a square wave stepped between two pitches through a low-pass,
  three times; no file), through the page's audio where it has it and silent while it is muted.
- Its page layer (`scene/channels/warning.js`) is read off the bus's vars each frame, as the screen layer is, and emitted
  only where a level's events raise a warning: a page without one carries none of it.
- A frame operation's task alarm (`tasks[].alarm`) is a warning now, where it was a banner, a borrowed missile beep and a
  flash.
