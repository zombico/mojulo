### The animation studio: a scene written as a screenplay, filmed in Blender, from the agent

In progress. The first step of a sibling studio to the game studio, whose outcome is a directed film rather than a
game.

- **Ask for a short film of your characters.** Write a scene as a screenplay (who says what, a feeling in brackets,
  who crosses to where, who turns to whom, a pause) and name who plays each part. Your agent now hands it to the
  cinematics department directly. Before, that took a command run by hand. The characters act it (their faces and
  bodies on the words, listening and nodding while the other speaks). It is shot the way a director would shoot it.
  It comes back as a Blender film: each actor with its performance, the cameras cut together, and a film look
  (Cycles) or an anime look (EEVEE), ready to render to video in one command.
- **Cast a persona and it plays itself.** A persona you made is the actor: its character, its way of speaking, its
  acting style and its role come with it. Anything the scene says for that part wins.
- **The director's notes come back with the film**, such as a shot held too long or a speaker turned away from whom
  they're talking to. Each comes with a change to the script that answers it. They never stop the film.
- **See the film before it is made: a storyboard.** Ask for a scene and the first thing back is its storyboard, in
  seconds, with nothing rendered. There is a panel for each shot the director would take, drawn as a sketch with
  stand-in figures where the actors stand and seen from that shot's camera. Beside each panel is a plan of the room
  from above, showing where everyone stands, the path they walk and where the camera is. Under it are the shot's name,
  how long it holds, its lens, whether the camera moves, the lines spoken in it and any director's note about it. Look
  through the cut there before the film is made: the film is made from the same plan, so what you approve is what you
  get.
- **An animatic.** Ask for a video and the storyboard is played as one: each panel held for as long as its shot lasts,
  with the line being spoken shown under it. Several scenes' animatics can be stitched into one cut.
- **Your recordings set the scene.** Give the scene a recording of any line, from the voice worker or from a person.
  - That line now lasts exactly as long as the recording.
  - The character's face, gestures and mouth are fitted to the recording, and whoever is listening nods on its
    stressed words.
  - The storyboard's animatic plays the recordings with captions. The Blender film carries the voice and plays it
    under the render.
  - A recording that was made for different words than its line is pointed out.
- **Dubbed versions.** Give the same scene in other languages, one recording per line. The picture stays exactly the
  same and only the mouths change to match the new language.
  - The animatic carries each language as its own audio track and subtitles.
  - The Blender film switches between languages with one command.
  - A dubbed line that runs into the next one is pointed out, with how far over it goes.
- **A set.** Put a scene in a world you made (a room, a hall, a trail, a level).
  - Its rooms and doorways become places the script can send the actors to.
  - Anyone not placed stands in the biggest room.
  - The world comes into the Blender film under the actors.
  - A shot whose camera would be behind a wall is pointed out.
- **A whole short film: the animation studio.** Write a film as a set of scenes that share one cast, with the places
  they are set, one look and the order they play in. It is kept as one piece of work, and its page is the film's book.
  - **Departments.** It is made the way a studio makes one, in departments: the script, casting, the sets,
    performance, the camera, voice and dubbing, the look, the edit and the render. Each says how its part stands and
    gives its own advice, such as a part nobody plays, a wall in a shot, or a scene where nobody looks at whom they
    talk to. The film also says what to do next.
  - **Boards and approval.** Board every scene in seconds, then look at the boards and approve them one scene at a
    time. Change a scene afterwards and its approval is marked as out of date.
  - **The animatic.** Cut every scene into one animatic, with the voices and each dubbed language as their own tracks
    and subtitles.
  - **Blender.** Send the whole film to Blender, scene by scene. A long film is made over several calls, each picking
    up where the last stopped, and a single script joins the rendered scenes into one cut with their sound.
- **Rendering the film in Blender.** A single command renders a scene, or the whole film, in Blender on your machine.
  - **Stop and go on.** It works through the film a short piece at a time and can stop whenever you like. Run it again
    and it carries on from where it stopped, never redrawing a frame it already has.
  - **The finished film.** It finishes each scene with its voice, then joins the scenes into the finished film.
  - **Progress.** The film's book shows how far each scene has got.
  - **Change a scene and only that scene is rendered again.** Edit a scene after it was rendered and the next run
    renders that scene afresh, keeps the others and joins the film again. Before, the old render was taken for the
    new scene.
- **A bare stage for a scene with no set.** A scene that is not set in one of your worlds now plays on a plain stage:
  a floor, a soft sky and a light. Before, the film opened on Blender's own starting cube, with the actors standing
  inside it, and each actor brought a second floor and spare cameras of its own.
- **A set is lit as you made it.** A scene set in one of your worlds now takes that world's light into Blender: its
  sky, its sun, or indoors its lamps at their strength. Before, a room came in dark, its torches barely glowing.
- **Each language has its own picture.** A dubbed version is now drawn on its own, so going from one language to
  another, or back to the original, always shows the right mouths. Before, a dubbed render kept the original's mouths
  under the new voice, and the frames of whichever language was rendered first were used again for the next. A scene
  with no dub in a language plays its own voice in that language's cut.
- **Film a scene in a room you decorated.** A room fitted out by the interior designer can now be a film's set.
  Before, a scene set in one was refused: the room named nowhere to stand.
  - **Places a script can name.** Each piece of furniture, the fireplace, the door and each window is a place:
    "Ada crosses to the fireplace.", "Jon crosses to the door.", "to the sofa". The place is the clear floor nearest
    the piece's front, so nobody is stood inside a table.
  - **Where the cast stands.** With no marks of their own, the cast stands on the room's open floor with the most room
    left for a camera, not in the room's middle where the coffee table is.
  - **The camera stays in the room.** A real room has four walls, so each camera stands inside them on a wider lens,
    and stops in front of a bookcase or a chimney breast rather than in or behind it. Before, a wide shot stood
    outside the wall and saw only its back.
  - **Walking round the furniture.** A cross goes round the sofa, the table and the other actors by the shortest
    clear way, turning at each corner. Before, it was a straight line through whatever stood between.
  - **House lights.** A room with no lamps of its own is lit by a soft light under its ceiling. Before, it rendered
    black.
- **Walk up to someone.** A script can send a character to another character ("Ada crosses to Jon."), not only to a
  place. They walk up and stop at a conversation's distance.
- **Lighting each shot like a film crew.** Ask for it and every shot gets its own lights, placed from where that
  shot's camera stands and which way the actor faces: the main light on the far side of the face, a softer fill
  across from it, and a rim light from behind that lifts the figure off the background. The lights change on each cut,
  as a crew relights each setup.
- **Focus and motion blur.** The camera can focus on whoever it is looking at, with the background softly out of
  focus, and fast movement can blur as it would through a real lens.
