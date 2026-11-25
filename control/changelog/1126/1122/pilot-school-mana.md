### Pilot School on mana-ui: the logbook's look, and the instructor's brief before each lesson

Pilot School's game now runs on mana-ui the way Rebel Storm's does.

- **Its look** (`playscape/ui/theme-cards/logbook.json`, a new card in the `clean` family). A flying school's training
  logbook laid on a sectional chart: cream paper ruled in navy, a safety-orange tab for what matters, the chart's water
  blue, nothing drawn across the view out of the canopy. The rail's starter dresses its game in it
  (`ui: { theme: 'logbook' }`; the creator's own `ui` wins), so its title, its lessons, its pause and each lesson's
  graded result are drawn by mana-ui, and the shell remembers each lesson's best medal.
- **The instructor's brief before each lesson** (`gameworld/lesson-brief.js` its words, `scene/channels/lesson-brief.js`
  its page, an airspace level's `lesson` key). It opens over the lesson's own field as it loads and says:
  - the lesson's place in the syllabus ("Lesson 1 of 4");
  - what the lesson teaches;
  - the sky it is flown in (the hour, the weather, the wind in knots, the moon at night);
  - its tasks in the instructor's words, in the order they come (each said again in the air as it begins);
  - what earns gold, silver and bronze, by every criterion the lesson is graded on.

  Until Start the lesson is held behind it on the shell's pause, so the clock its grade reads starts with the student.
  It takes the keyboard as it opens, so Enter starts it from inside the game's shell. A world reads a lesson's brief and
  says each fault in it. A page without one emits none of it.
- Each Pilot School lesson carries its brief (`lessonLevel(lesson, { n, of })`), the same tasks its goal flies.
