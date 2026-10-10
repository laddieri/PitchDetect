# CLAUDE.md - AI Assistant Guide for PitchDetect

## Project Overview

**PitchDetect** is a note identification and practice web app for band/orchestra
students. Its primary feature: press **Listen**, play a note on your instrument,
and the app names it and shows it on a staff (with a cents tuner meter).
Secondary feature: click/tap the staff to set a **target note** — the app shows
its fingering, concert pitch, and plays it back with an instrument-like timbre;
playing the matching note into the mic triggers a fireworks celebration.

The repo began as Chris Wilson's 2014 pitch detector demo but has been fully
rebuilt; the original `js/pitchdetect.js` / p5.js code no longer exists.

**License:** MIT

## Repository Structure

```
PitchDetect/
├── index.html          # Single page: all CSS (inline <style>) + markup
├── js/
│   ├── notetrainer.js  # All app logic (~2,700 lines, global scope)
│   ├── fingerings.js   # Fingering data + diagram rendering
│   ├── firstfive.js    # "First 5 Notes" practice game
│   ├── progress.js     # Students, XP/levels, streaks, badges, path (loaded last)
│   └── vendor/
│       └── vexflow-min.js  # VexFlow (staff/notation rendering)
├── img/Fingerings/     # Fingering chart images per instrument
├── img/favicon.svg     # Favicon (favicon.ico at the root is its 32px fallback)
├── img/icon-192.png, icon-512.png  # App icons (rendered from favicon.svg)
├── manifest.webmanifest  # Installable app (PWA)
├── sw.js               # Service worker: network first, cached copy offline
├── tests/smoke.js      # Playwright smoke test (fake mic, storage, offline)
├── CLAUDE.md           # This file
└── _config.yml         # Jekyll config for GitHub Pages hosting
```

There is **no build system and no package.json**; the page runs directly in
a browser. `tests/smoke.js` is the one scripted test (see Testing).

## Architecture (`js/notetrainer.js`)

All state is module-global. The main clusters:

| Area | Key functions / state |
|---|---|
| **Written/concert pitch** | `transpositionMap`, `getTransposition()`, `getWrittenKey()`, `keyToFifths`. Placed/detected notes are stored as *written* pitch (`currentMidi`, `detectedMidi`); concert = written − transposition. `spellNoteForKey()` names black keys as flats (band parts read in flats) unless the key signature sharps that note, and always F♯ rather than G♭ unless the key signature has G♭; the main page shows one spelling, never "C♯ / D♭". |
| **Staff rendering** | `drawStaff()` (target staff, ghost notes, key signature), `drawDetectedStaff()` (second staff), `redrawStavesForCurrentState()`. SVGs use a fixed internal coordinate width (capped by `MAX_INTERNAL_WIDTH`) and stretch to fill their container — a ResizeObserver re-renders on container size changes so the two staves stay at equal scale. |
| **Note placement** | `handleStaffClick()`, `handleStaffMouseMove()` (ghost preview), `yPositionToNote()` (click Y → note, chromatic between lines), `adjustPitch()` / `handleKeyDown()` (▲▼ buttons, arrow keys). No instrument required — the default is concert-pitch treble clef. |
| **Pitch detection** | `autoCorrelate()` — McLeod Pitch Method (NSDF); returns `{frequency, confidence}`; gated at confidence > 0.85. `updateListenPitch()` is the rAF loop with debouncing: a new note must hold `NOTE_CONFIRM_FRAMES` (3) frames; dropouts under `NOTE_CLEAR_HOLD_MS` (300) keep the last note displayed. |
| **Tuner meter** | `updateTunerMeter()` — cents vs nearest semitone via `centsOffFromPitch()`, EMA-smoothed needle, in-tune/close/off color states. Kid mode's meter is calmer: it smooths the pitch itself more heavily (`KID_METER_SMOOTHING`, restarting on a jump to another note), "Just right!" has hysteresis (`KID_IN_TUNE_CENTS` / `KID_OUT_OF_TUNE_CENTS`, `kidJustRight`, also used by the celebration) and the needle holds through dropouts under `NOTE_CLEAR_HOLD_MS`. |
| **Match/fireworks** | `commitDetectedNote()` fires `launchFireworks()` on target match; `reevaluateMatch()` re-checks whenever the *target* changes. |
| **Synthesis** | `instrumentTimbres` (per-instrument harmonic stacks, vibrato, breath noise), `synthesizeWind()` / `synthesizeStruck()`, `playTone(freq, sustain, onStarted, length)` (shared by Play and practice; `length` gives a sequenced note its own `TONE_RELEASE` so it ends before the next), sustain mode with click-free portamento (`retuneSustainedNote()`), fade-out teardown in `stopNote()`. The first `playTone()` of a visit shows `showSoundHint()` (an info toast: turn up your volume); `setAudioSessionType()` sets iOS's `navigator.audioSession` to `playback` (`play-and-record` while listening) so the silent switch doesn't mute the notes. |
| **UI state sync** | `updateControlStates()` (enable/disable), `updateNoteDisplay()` / `updateConcertPitchDisplay()`, `updateFingeringDisplay()`, `updatePianoDisplay()`, `updatePanePager()` (mobile fingering/piano pages), `updateKeyChip()` / `updateKeyDropdown()` `applyResponsiveControls()` (breakpoint DOM moves), `showToast(message, duration)` (inline errors — never use `alert()`;
mic failures go through `micErrorMessage()`, which says what to do next). |

### `js/firstfive.js` — First 5 Notes practice

A full-screen practice view (`#practice-view`, opened by the toolbar's
**Practice** button → `openPractice()`; the app behind it is made `inert`).
It opens on a **menu** (`showPracticeMenu(page)`, `PRACTICE_ACTIVITIES`) of
activities, each card showing its best result. Students see one **unit** at
a time (`PRACTICE_UNITS`: Your first notes, The first 5 notes, Notes 6 and
beyond, The B♭ scale, then one unit per concert scale: The E♭ / A♭ / F / C
scale; menu pages `unit1`–`unit8`, `practiceUnit()`): the
unit's cards in path order (a half card left unpaired goes wide), a unit
bar above (`#practice-units`, `renderPracticeUnits()`: "Unit n of 8", steps
done, ‹ › arrows, a dot on the arrow toward the next path step) and a
dashed card at the end leading on (`practiceUnitNextCard()`). Past the last
unit is **Every activity**: the old tabbed pages below, where teachers
start. Which of the two a student uses sticks (`practice.menuAll`, saved as
`profile.menuAll`); `menuPageFor(id)` is the page to return to from an
activity, `defaultMenuPage()` the unit with the next path step. Every
activity's three pages are picked by tabs (`PRACTICE_PAGES`, `#practice-tabs`, `renderPracticeTabs()`; each
activity's `page`, `activityPage()`; `practice.menuPage` /
`#practice-view[data-menu-page]`), all row cards read top to bottom,
easiest first. Leaving an activity returns to its page; opening Practice
shows the page with the next path step.
**Lessons** (`lessons`): first sounds, **Learn the first 3 notes** (an
easier start: concert D C B♭, `FIRST3_STEPS`, best stars in
`pitchdetect-first-three`; its result leads to the name drill), **Learn the
first 5 notes**, **Learn notes 6 and beyond** (`learn4`, lesson set `next4`:
`NEXT4_STEPS`, concert G, A♭, the low A♭, the low A, the band-method notes
after the first five, named on the card by `nextFourText()`; best stars in
`pitchdetect-next-four`; its result leads to the 9 note quiz), **Learn the
B♭ scale**, and **Learn the E♭ / A♭ / F / C scale** (`MORE_SCALES`, lesson
sets and activity ids `scaleEb` `scaleAb` `scaleF` `scaleC`, units 5–8: the
concert major scales after B♭, one octave each from `tonic` steps above the
first B♭, `octave` moving an instrument's start an octave to stay in a
beginner's range and on its charts, read through `lessonSteps()`; each card
says "Concert E♭: F up to F" at the written pitch, `moreScaleText()`; best
stars in `pitchdetect-eb-scale` etc.; each result leads to its scale run).
Each also has drills and a scale run like the B♭ scale's, their ids the
B♭ ones plus the key (`namesscaleEb`, `fingeringsscaleEb`, `scalerunEb`;
`scaleSetOf(id)` gives the lesson set, `scaleName(set)` its name; run
bests in `practice.scaleRunBest[set]`, stored under `SCALE_RUN_STORAGE_KEYS`,
e.g. `pitchdetect-eb-scale-run`). Their notes are spelled in the written key
(`spell` → the lesson's `spellings`, from `scaleSpellings()`, which
`practiceSpelling()` uses during the lesson and, via
`practice.challenge.spellings`, its drills and run: trumpet's concert C
scale reads D E F♯ G A B C♯ D). Flute and oboe also have **Learn B, A and G**
(`FIRST3_BAG_STEPS` / `FIRST3_BAG_INSTRUMENTS`, in
`pitchdetect-first-three-bag`, where their classes start), and get both
sets' cards side by side: lesson, name and fingering drills, songs and song
writing, each set's titled with its notes ("Name B, A and G", "Name D, C
and B♭"); the B A G cards are the `...bag` ids (`names3bag`,
`fingerings3bag`, `quiz3bag`, `songs3bag`, `write3bag`). `THREE_SET_ACTIVITIES` maps
each 3-note activity to its set; opening one (or `startLesson()` /
`startDrill()` on one) sets `practice.threeSet`, which the song list, song
writing and `threeNotes(set)` / `threeNotesText(set)` /
`threeNoteCustomSongs(set)` / `songStars(song, set)` default to.
`defaultThreeSet()` (B A G on flute and oboe) is the set on the learning
path; `firstThreeActivity()` its lesson, `threeSetActivity(id, set)` adds
`bag`. Activities with `instruments` show only for those
(`practiceActivityAvailable()`).
**Practice drills** (`drills`), its cards grouped under headings (each
activity's `group`, `practiceGroupTitle()`; `.practice-menu[data-grouped]`
holds a `.practice-group` per heading, from `practiceGroupSection()`, and
scrolls if it must; Practice playing notes comes first). Each heading is a
big card like the activities' (`.practice-choice.practice-group-toggle`:
icon, title, `practiceGroupSub()`, chevron) that folds its cards away
(`.practice-group.closed`; folded groups kept device-wide in
`pitchdetect-drill-groups-closed`, `practiceGroupsClosed()`; a folded group
holding the next path step shows a dot): **Practice note names** (drills
`names3` / `names` / `names9` / `namesscale`: **Name the 3 notes**, **Name
the first 5 notes**, **Name 9 notes**, **Name the B♭ scale notes**),
**Practice fingerings** ("slide positions" on trombone, "the keyboard"
without charts; `fingerings3` / `fingerings` / `fingerings9` /
`fingeringsscale`) — the 3- and 5-note cards' subtitles list their notes
(`notesText()`) — and **Practice playing notes**: **3 note quiz** (`quiz3`, and `quiz3bag` "Play
B, A and G" on flute and oboe; `startThreeQuiz(set)`, kind `quiz3` with
`challenge.set`: the quiz over that set, `QUIZ3_LENGTH` (6) notes, best per
set in `QUIZ3_STORAGE_KEYS`, `practice.quiz3Best[set]`; on the path after
the 3-note fingering drill), **First 5 note quiz** (the challenge round), **9 note
quiz** (`quiz9`, `startNineQuiz()`: the quiz over the first five notes plus
notes 6 and beyond, `QUIZ9_LENGTH` (12) notes, one answer button per name
low to high so the two A♭s share one; best in `pitchdetect-nine-note-quiz`,
on the path after notes 6 and beyond) and **Play the B♭ scale**.
**Songs** (`songs`): **Play 3-note songs** (`songs3`:
`showSongList("three")`), **Write a 3-note song** (`write3`: the editor in
3-note mode), **Play 5-note songs** (`songs5`: `showSongList("five")`, the
Beginner songs and the student's 5-note songs; `listSongs(list)` gives each
list's built-in songs, `listCustomSongs(list)` its own songs), **Write a
5-note song** (`write5`: the editor on the first 5 notes, `song.three =
"first5"`, `fiveNoteCustomSongs()`) and **More songs** (`songs`:
`showSongList("all")`, every level but Beginner, and all the student's songs).
`#practice-view[data-mode]` (`setPracticeMode()`:
menu / lesson / challenge / drill / songs / song / editor / import / firstsounds, plus profile / signin from progress.js) decides what shows; the note map is
lessons-only. The back arrow / Escape (`practiceBack()`) returns an activity
to the menu and the menu to the app; the menu also stops the mic. Browser
history mirrors these screens (`syncPracticeHistory()`, run after every
`setPracticeMode()` and in `closePractice()`), so Android's back button and
iOS's swipe-back step back like the arrow: each screen has a depth (menu 1,
any page, so tabs replace; activity 2, song 3); deeper pushes, sideways replaces, shallower
`history.go()`s back, and `popstate` shows the entry's screen. Keep new
screens inside `practiceHistoryState()`. The lessons
teach the band-method first five notes, concert B♭ C D E♭ F, at each
instrument's written pitch (`practiceStartConcertMidi` holds each instrument's
concert B♭; `PRACTICE_STEPS` the intervals). Opening a lesson set shows an
**overview** first (`showLessonOverview()`, `data-step="overview"`): every
note on one staff with its name underneath (`drawLessonOverview(hl)`),
**Hear them** (plays them via `playSongEvents()`, highlighting each) and
**Let's start**, which goes to the first note with stars left to earn, so
the Read step never asks a name that hasn't been shown. Each note is a lesson of four
steps — **Read** (pick the name; the quiz), **Finger** (chart via
`displayFingering()`, "Slide" for trombone, or the piano via
`drawPianoKeyboard(pc, label, el)` for instruments without charts), **Hear**
(`playTone()`), **Play** (mic) — then a result card. Stars (max 3: named it
first try, played it, average within `PRACTICE_TUNE_CENTS`) are kept as the
best per note per instrument in localStorage (`pitchdetect-first-five`).

- The mic loop calls `updatePracticeListen(now, freq)` while `practiceOpen`
  (instead of kid celebration); it measures cents against the *target*, so a
  note passes within `PRACTICE_PASS_CENTS` held for `PRACTICE_HOLD_MS`, with
  gaps under `PRACTICE_GAP_MS` forgiven. Wrong notes are named only after
  `PRACTICE_HINT_FRAMES` steady frames (octave errors get their own hint).
  At the same moment the wrong note appears as a faint gray whole note just
  right of the target (`setPracticeGhost()` → `drawPracticeGhost()`, in the
  lesson Play step, quiz, scale run and songs; not for an out-of-tune right
  note or anything over an octave off). It clears in tune, after
  `PRACTICE_GHOST_CLEAR_MS` of silence, or on the next note.
- **Tuning tips:** a student who plays every note a bit flat or sharp
  can't fix it note by note, so `trackTuning(cents, dt)` (lesson Play, quiz,
  scale run, note-by-note songs; frames within 50¢ of the target) keeps each
  note's average offset, and `endTuningNote()` (from `resetPracticeHold()`)
  keeps the last `TUNING_SAMPLES`. All leaning one way by
  `TUNING_BIAS_CENTS` on average, or one note held right but outside the
  pass zone for `TUNING_STUCK_MS`, brings up `showTuningTip(sharp)`: the
  `#tuning-tip` card (styled like the level-up card) with
  `tuningTip(instrument, sharp)`'s advice: head joint (flute), mouthpiece on
  the cork (saxes), corners/barrel (clarinets), reed (oboe, bassoon), main
  tuning slide (brass), plus embouchure. None for bells. The mic is ignored
  while it's up; at most one per `TUNING_TIP_COOLDOWN_MS`.
- Whenever the mic is on, the practice header shows a red mic badge
  (`#practice-mic` in the header's right spacer, `updatePracticeMicBadge()`,
  called by `startListening()` / `stopListening()`), its ring swelling with
  the level (`--mic-level`). Audio never leaves the device: it only feeds an
  `AnalyserNode`; nothing is recorded or sent.
- Lesson notes are spelled by `practiceSpelling()` (via `practiceNoteName()`
  and the practice staves): flats, except F♯ (alto/bari sax read concert A
  as F♯).
- `practice.ignoreUntil` mutes the check while the example tone sounds, so
  the app can't pass the student's turn for them.
- Note names in the map stay hidden (numbers) until learned, so the map never
  answers the Read step. The practice staff has no key signature — explicit
  flats only.
- **Quiz / challenge round** (`startChallenge()`): from the menu, and offered
  on the lesson result when the fifth note is first learned. `CHALLENGE_LENGTH` notes from `makeChallengeSequence()`
  (each note at least once, no back-to-back repeats), staff only. Each note
  asks its name first (`showChallengeName()`, answer buttons, no mic
  scoring; a wrong name must be fixed and the note no longer scores), then
  to play it (`showChallengePlay()`), held for `CHALLENGE_HOLD_MS`; progress
  dots replace the step chips. **Help** (`showChallengeHelp()`, in either
  step) reveals the name in big letters (`.challenge-help-name`), a bigger
  fingering chart (`data-step="challenge-help"` scales `--fingering-h`) and
  the sound, but only unhelped notes score; `challengeStars()` turns the
  score into 0–3 trophy stars, best score per instrument in
  `pitchdetect-first-five-challenge`.
- **B♭ scale** (**Learn the B♭ scale** on the Lessons page,
  **Play the B♭ scale** on Practice drills): **Learn the
  B♭ scale** runs the same lessons over `SCALE_STEPS` (concert B♭ up the
  octave, 8 notes) — lesson sets (`first3`, `first3bag`, `first5`, `next4`, `scale`) live in
  `LESSON_SETS` / `practice.lessons` (menu ids map to them via
  `LESSON_ACTIVITIES`), `practice.lesson` picks one, `currentLesson()` gives
  its notes and stars (best per note in `pitchdetect-bb-scale`); the Read
  step offers each name once. **Play the B♭ scale** (`startScaleRun(set)`,
  default `"scale"`) is a challenge round (`practice.challenge.kind ===
  "scale"`, `challenge.set` the lesson set) in order up and
  back down (`scaleRunSequence()`, 15 notes; no name step, and feedback
  never names the target), best in
  `pitchdetect-bb-scale-run`; `challengeStars(score, total)` scales the
  10/8/5 thresholds. The first 5 note quiz stays on the first five notes; the `namesscale` /
  `fingeringsscale` drills cover the scale.
- **Songs** (`showSongList()` → `playThroughSong(id)`, the cards on the
  menu's **Songs** page): `SONGS` holds public
  domain tunes, each with a `level` the song list groups them by
  (`SONG_LEVELS`): each level is a colored button (hint, stars earned) that
  opens its songs in place below it, closed by default; `songLevelsOpen`
  keeps what's open for the session, and the level of the song just played
  opens on the way back. The list sits at the top of the card (not centered)
  so opening a level doesn't move the others. **First 3 notes** (degrees
  1–3 only, which are the student's first 3 notes from the bottom,
  `threeNoteScale()`: B♭ C D, or G A B on a flute or oboe on B A G; Hot
  Cross Buns, Merrily We Roll Along, Stepping Stones, Up and Down, Au Clair
  de la Lune; bests on
  B A G are kept apart under `id@bag`, `songBestKey()`). The Play 3-note songs
  list (`showSongList("three")`, `practice.songList`, kept for back
  and Next song) shows only these and the student's 3-note songs.
  **Beginner** (first five
  notes, plain rhythms, on the Play 5-note songs list
  (`showSongList("five")`) and left out of More songs: Mary Had a
  Little Lamb, Lightly Row, Ode to Joy, Go Tell Aunt Rhody, Jingle Bells),
  **Notes 6 and beyond** (`beyond`: Hot Cross Buns in E♭ and in A♭, Mary
  Had a Little Lamb in A♭, Old MacDonald, Yankee Doodle, Deck the Halls; a
  song with `steps`, `BEYOND_AB_STEPS` / `BEYOND_A_STEPS`, numbers its notes
  1–8 from those concert steps instead of the B♭ scale, and `tonic` makes
  `songTitle()` add " in <key>" at the student's written pitch),
  **Intermediate** (rests, dotted notes or notes past the fifth: Goin' Home,
  When the Saints, Twinkle, All My Little Ducklings), **Advanced** (eighth
  notes on the whole scale: London Bridge, Michael Row the Boat, Row Row Row
  Your Boat, This Old Man), **Scale songs** (`scales`: Joy to the World, `JOY_TO_THE_WORLD`,
  once per scale, ids `joyscale`, `joyscaleEb`...; a song with `scale` (a
  lesson set) numbers its notes 1–8 up that scale's lesson notes, so it gets
  the lesson's octave and written-key spelling, and `songTitle()` adds
  " (E♭ scale)"; the units 5–8 hold the More songs card and the path has
  each one after its scale run), then a level per new scale (**E♭ / A♭ / F /
  C scale songs**, ids `songsEb`...): five tunes from the levels above,
  numbered up that scale the same way (`SCALE_SONG_TUNES`, ids the tune's
  plus the scale's, `odetojoyscaleEb`; only tunes that stay on degrees 1–8).
  Keep `SONGS` in level order (Next song follows it). Each measure is a
  string of scale degree + duration (`"3q 2q 1h"`, `"5q. 68"` dotted,
  `"rq"` a rest; degrees 1–8 index the B♭ scale, spelled up the letters from
  the first note by `spellScale()` so alto sax gets F♯); a song may set `time` (e.g. `"6/8"`),
  which is then shown. `drawSongLine()`
  draws one line of `SONG_MEASURES_PER_LINE` measures with real rhythms
  (played notes green, the current one in the accent color with a bobbing
  arrow above it, `opts.arrow` → `drawSongArrow()`; not during playback);
  `renderSongProgress()` shows one dot per line. `updateSongListen()` takes
  over the mic loop: a note passes after `SONG_HOLD_MS`; rhythm isn't
  judged (no hold bar: it distracted). A repeated note needs re-tonguing (`practice.needRetongue`): a
  pitch dropout or a loudness dip below `SONG_RETONGUE_DIP` × the held
  level. For that the mic loop passes the frame's RMS (`autoCorrelate()`
  returns `rms`) as `updatePracticeListen()`'s third argument. Still
  sounding the previous note isn't a mistake (no hint, then a "Next note!"
  nudge). **Hear the song** (`playSong()` / `stopSongPlayback()`,
  `songPlayTimer`) plays the tune at `SONG_TEMPO`, with the staff following
  along and the mic ignoring it, and the fingering chart changing with each
  note (`showSongFingerings()`: one `practiceFingeringBox(true, midi)` per
  pitch built up front in `#song-fingering`, only the sounding one shown,
  rests keep the last; a Help chart is hidden meanwhile; the area has one
  fixed height for the song and `contain: strict`, so no chart can move the
  staff; image charts go on one shared canvas, `lineUpChartImages()`: one
  scale, each file placed by `fingeringImageBox()` (fingerings.js,
  `fingeringImageLayouts`: measured offsets and every file's size, since
  files are cropped per note), laid out at once, before the images load, so
  the tone holes don't move;
  `removeSongFingerings()` from `stopSongPlayback()`); `setPracticeMode()` and `closePractice()`
  stop it. Help works as in the quiz; best unhelped-note score per song
  per instrument in `pitchdetect-songs`, shown as `challengeStars()`. Back
  from a song returns to the song list, and from the list to the Songs page.
  A song opens in **Play it through** (`playThroughSong()`; the song list,
  the editor's Play it, Next song); note by note (`startSong()`) is the
  practice path, behind **Note by note** and **Practice the red notes**, and
  its result leads back to Play it through. Play it through: the whole song stacked as in whole song view
  (`data-step="song-free"`, `practice.song.free`), no arrow and no waiting
  on each note. The mic follows along instead (`updateFollowListen()`, run
  from `updateSongListen()`): the sound is cut into notes (a new semitone,
  or the same pitch re-tongued: a loudness dip below `SONG_RETONGUE_DIP`
  then a rise), each counting after `FOLLOW_NOTE_MS`; `followNote()`
  re-aligns everything heard with the song by edit distance
  (`alignFollow()`: right / octave / wrong / missed, extra notes free, a
  skip in a run of repeats marked on the last). Right notes turn green as
  they're played; `finishFollow()` (last note right, **Stop and score**, or
  `FOLLOW_END_SILENCE_MS` quiet; stopped partway, unreached notes stay
  black) turns the mic off and marks mistakes red with a score and stars
  (best notes right saved in `pitchdetect-songs`, shared with note by note;
  a perfect run offers Next song). **Practice the red notes** opens note-by-note at the start
  of the first red note's line (`startSong(id, from)`: earlier notes count
  done, no best saved, the result offers Play it through again). Hear the
  song restarts the run; **Note by note** returns to `startSong()`.
  **Pick a part** (on Play it through, its result and note by note):
  `showSongPicker(id, back, pick)` (mode `song`, `data-step="song-pick"`,
  `practice.song.pick` `{ a, b }` measures, mic off) shows the whole song;
  a tap (`songPickerTap()`) picks a measure, a second tap the part's last
  measure, a third starts over (the result's preselects the first red
  note's measure). **Practice it** runs `startSong(id, from, to)` over just
  those notes (`songPartNotes()`; `songEnd()` stops there, one progress dot
  per measure, the rest of the song grayed out, Hear plays only the part,
  `songPart()` / `partLabel()`); no best saved, the result offers Play
  again, Pick another part and Play it through.
  Songs go through `songEvents(song)` (notes *and* rests: `{ midi|null,
  dur, dots, measure, letter, alter, octave }`); `songNotes()` keeps the
  playable ones, each with its `event` index. `renderSongLine()` draws a
  line for both song mode and the editor.
- **Key signature or accidentals** (`songKeySignatures`, persisted
  device-wide as `pitchdetect-song-key-signature`, off by default): off,
  songs have no key signature and every sharp and flat is written on its
  note (how the built-in songs always read); on, each song shows its
  written key (`songKey()`: a custom song's `key`, a built-in song's from
  its tonic as the song spells it) and accidentals last the measure as
  printed. Set in the song view by `songKeyButton()` →
  `setSongKeySignatures()`: beside the whole song toggle in note by note and
  the import screen, alone above the staff on Play it through and Pick a
  part; not shown for a song in a key without sharps or flats. The editor always shows its key (`opts.keySig`).
- **My songs** (`openSongEditor(id)`, mode `editor`, under "My songs" in the
  song list, with **Make a song** and a pencil per song): the student copies
  a tune from their own printed part. Stored per instrument, in written pitch,
  in `pitchdetect-my-songs` as `{ id, title, time, key, notes }`, a note being
  `{ s: diatonic step (octave × 7 + letter), a: −1/0/1, d: w|h|q|8, dot }` or
  a rest `{ r: 1, d, dot }`; a 3- or 5-note song (`openSongEditor(null, set)`,
  set `practice.threeSet` or `"first5"`) also stores `three` (its lesson
  set): the editor then has no key picker, one button per note in place of ♭♮♯ (`setEditorThreeNote()`: adds at
  the end, or changes the selected note), and taps, ▲▼ and letters snap to
  the three notes (`editorThreeNear()`); `customSongEvents()` fills measures from the time
  signature (`SONG_TIMES`; no ties or pickups). Key signatures (`SONG_KEYS`,
  labeled by counting flats/sharps) and accidentals lasting the measure
  follow print rules; changing the key moves notes that followed the old one.
  Editing: tap past the last note to add one, after which the editor moves
  on to the next note (caret at the end; the line stays on the last note
  until a note goes on the next line). Tap a note to select it, tap it again
  to move it (`editorStaffTap()`). ▲▼ (diatonic; `#editor-staff-arrows`,
  beside the staff, added and removed with the editor) and ♭♮♯ change
  `editorTargetIndex()`: the selected note, or at the end the last one
  placed (shown in the accent color). Length, dot, rest and delete buttons
  sit below; on desktop letters A–G, R, 1/2/4/8, `.`, arrows and Backspace
  (`editorKeyDown()`). Phones get one measure per line so lines and spaces
  are tappable; there the measures before it stack above the current one
  (`renderSongView()`'s `opts.through`, `data-editor-stack`, scrolling, the
  current line pinned to the bottom with ▲▼ beside it via `--editor-line-h`),
  so a full measure stays in sight. **Measures never overflow** (`overflowingNotes()`,
  `editorNotesFit()`): every measure but the last stays exactly full and
  edits before the last measure never move a bar line. At the end, lengths
  that don't fit the room left (`editorRoomAtEnd()`) are disabled and the
  next note takes the longest that fits (`editorNextLength()`); a selected
  note's length changes via `editorNotesWithLength()` (shortening leaves
  rests from `restsFor()`, lengthening uses up the rests right after it,
  else only in the last measure). Inserting goes only into the last measure
  (`editorInLastMeasure()`); deleting earlier turns a note into a rest, and
  tapping a selected rest makes it a note. A time signature the notes don't
  fit is refused with a toast. Older/shared songs that already overflow
  stay editable (edits just can't add overflow). Every change autosaves
  (`saveEditorSong()`; a song emptied of notes is removed, and changed notes
  clear its best score); Delete takes two taps. Back returns to the list.
- **Whole song view** (`songWholeView`, persisted as `pitchdetect-song-whole`,
  `#practice-view[data-whole]`): a toggle (`songViewButton()`, beside the
  song's line dots, the editor's nav dots and on the import screen) stacks
  every line in `#practice-staff-output`, which becomes the scroller.
  `renderSongView()` wraps `renderSongLine()` for all three screens: one
  `.song-line` div per line (shorter viewBox, `SONG_WHOLE_LINE_HEIGHT`,
  ledger notes overhang), keeps the scroll position across redraws and
  scrolls the current line into view only as far as needed (so it follows
  along while playing). It returns layouts by line; the editor's tap handler
  uses the tapped `.song-line`'s layout.
- **Sharing songs** (no server): the editor's share button
  (`shareEditorSong()`) makes a link `#song=<payload>` — base64url JSON
  `{ v, t, i (instrument), k, m, n }`, notes as tokens like `q.Bb4` / `hr`
  (`encodeSongShare()` / `decodeSongShare()`, which validates everything) —
  and hands it to `navigator.share`, else copies it. Opening a link
  (`checkSongLink()` on load and `hashchange`) strips the hash, picks the
  sharer's instrument if none is chosen, and walks menu (Songs) → song list →
  the import screen (mode `import`, `showSongImport()`) so back steps out
  normally; a pending import survives until Practice opens
  (`pendingSongImport`). A friend on another instrument gets
  `transposeSharedSong()`: same sounding tune, in their octave (the two
  instruments' first band notes line up), key moved round the circle of
  fifths, notes respelled. **Add to My songs** skips an identical copy.
- **Drills** (`startDrill(kind)`: `names` / `fingerings` and their `3`,
  `9`, `3bag` and `scale` kinds, no mic; `drillNotes(kind)`, held in
  `practice.drillNotes`: the first 5, the 3 notes of the kind's set, those
  plus notes 6 and beyond, or the B♭ scale; bests are kept by kind. Past five notes the answers are one button per name,
  low to high (`drillChoices()`; the two A♭s, the two B♭s share one), and
  any octave counts, `sameNoteName()`): races against
  the clock: name as many notes as you can in `DRILL_SECONDS` (30), trying
  to beat your best. Random notes (`nextDrillNote()`, no back-to-back
  repeats); a note scores if named on the first try (a wrong one must still
  be fixed), and a right answer moves on after `DRILL_NEXT_MS` with just the chime and
  bounce; the balloons wait for the result screen. The clock
  (`startDrillClock()`, `drillClockTimer`, cleared by `setPracticeMode()` /
  `closePractice()`) starts once the answers can be tapped;
  `renderDrillProgress()` replaces the dots with seconds left, a draining
  bar and the score (gold once past the best). The big balloon
  (`#drill-balloon`, `--drill-balloon-w`, `--fill`) sits in the stage's
  top right corner, floating over the staff or chart (only the phone prompt
  wraps short of it), inflates with each right answer toward the goal written on it
  (`drillBalloonGoal()`: `DRILL_BALLOON_GOAL` (10), and once the best has
  reached that, best + 1, so popping it again means beating your best) and
  pops (`popDrillBalloon()`: `playPop()` and
  `launchConfetti()`, skipped under reduced motion); the round carries on. Names shows the staff;
  fingerings hides it and shows only the chart (`practiceFingeringBox(true)`
  leaves the piano key unlabeled). Result via `showRoundResult()` with stars
  out of `DRILL_STAR_GOAL`; bests (notes per round) in
  `pitchdetect-first-five-drills-timed`, shown on the menu cards as "Best: n".
  In the fingerings drill, `drillChoices()` drops notes that share the
  target's fingering (trumpet C/G open; trombone, euphonium, tuba B♭/F) so
  only one answer is right. While those keys load, the question shows with
  the answers disabled in place. `loadFingeringKeys()` keys valve/clarinet notes by
  their fingering data and image charts by a hash of the file
  (`fingeringImagePath()`), since shared fingerings share identical images.
- **Correct answers** in the quiz, both drills (no balloons until the end)
  and the lesson's Read step
  get `celebrateCorrect()`: balloons rising through the card
  (`launchBalloons()`, a `.balloon-layer` that clips them and ignores taps;
  skipped under reduced motion), a short chime (`playChime()`, outside
  `activeAudioNodes`; in the quiz the mic isn't scoring between notes, so it
  can't count), a bounce on the button, a varied `praiseWord()` and a streak
  callout from 3 in a row (`streakText()`).
- **First sounds** (`FIRST_SOUNDS`, one config per instrument; the menu card
  appears only for instruments in it and leads the menu, full-width on
  desktop): flute "Learn the head joint", clarinet "Learn the mouthpiece &
  barrel", alto sax "Learn the mouthpiece & neck", oboe "Learn the reed"
  (a crow), and trumpet, horn, trombone, euphonium, tuba "Learn to buzz"
  (`brassBuzzConfig()`). `startFirstSounds()` →
  `goToFirstSoundsStep()`: Set up (tips + `firstSoundsSVG()` drawing) → one
  step per sound in the config → final (`firstSoundsFinalStep()`;
  `"switch"`: alternate both sounds, flute; `"long"`: hold the last sound for
  `FIRST_SOUNDS_LONG_TONE_MS`) → result. Flute: Set up / Open / Covered /
  Switch; clarinet and sax skip the mouthpiece alone (not how beginners are
  started): Set up / Barrel or Neck / Hold; oboe Set up / Crow / Hold; brass
  Set up / Buzz / Hold. Stars = parts completed scaled to
  3, best per instrument in `pitchdetect-first-five-headjoint` (key predates
  clarinet/sax). Concert pitches with accepted cents bands: flute open ≈ A5
  (accepts G5–B5), covered ≈ A4 (accepts G4–B♭4; can overblow to E6) — wide
  because real head joints vary; clarinet
  mouthpiece + barrel ≈ F♯5; alto sax mouthpiece + neck ≈ A♭4 (usually a bit
  above); oboe reed crow ≈ C5/C6 (accepts B♭4–D6); brass mouthpiece buzz has
  no pitch of its own, so each band is ~2½ octaves around a typical buzz
  (trumpet G3–C6, horn F3–C6, trombone/euphonium F2–B♭4, tuba B♭1–C♯4).
  The staff shows the written pitch (`sharp` spells F♯/G♯); wide-band sounds
  (`follow`) redraw it to the note being played, and skip the example tone
  (`noExample`).
  First sounds are breathy, so this mode uses a looser confidence gate
  (`practiceConfidenceGate()` → `FIRST_SOUNDS_MIN_CONFIDENCE` 0.7; the mic
  loop passes practice its own gated frequency, the main display keeps 0.85)
  and forgives dropouts up to `FIRST_SOUNDS_GAP_MS` in a hold.
  `updateFirstSoundsListen()` takes over the mic loop in this mode and gives
  per-instrument hints: the other sound (flute only, `confusable`), squeaks,
  low/high, and no sound after 6 s.
- `practiceFingeringBox()` builds the chart for the Finger step and challenge
  Help. Flutes on B A G keep the thumb on the B♮ key: in the B A G lesson,
  its fingering drill and songs on only B, A and G (`fluteBThumbNow()`,
  `fluteBThumbSong()`) G and A show `img/Fingerings/Flute/67-b-thumb.png` /
  `69-b-thumb.png` instead of the charts' B♭-lever thumb. Trombone charts share a wide canvas (bell fixed, room for the slide at
  7th position), so `centerChartDrawing()` measures the drawn pixels and
  shifts the image to center them; `.practice-fingering` clips the blank part.
  Hear the song's charts are shown in turn, so they share one shift
  (`centerChartsTogether()`, the span they draw together): the bell stays put
  and only the slide moves.
  The main app's fingering panel leaves charts as drawn.
- The header's big instrument pill (`#practice-instrument`) is only a label
  (set by `loadPracticeInstrument()`); the instrument is changed on the
  profile (see progress.js).
- Placement: in the header (`.header-actions`), beside the Advanced mode
  switch, always labeled "Practice" (the star is dropped on phones). Up to
  1100px the header is a grid: title left, Practice and the switch right;
  on phones `.header-actions` is `display: contents` so Practice sits beside
  the title and the switch (just "Advanced") under it, beside kid mode's
  tagline.

### `js/progress.js` — students and the game layer

Loaded after firstfive.js; no server, everything stays on the device.

- **Students:** Practice opens on **Who's practicing?** (`showSignIn()`, mode
  `signin`) until someone has chosen on this device: a first name
  (`cleanStudentName()`, at most `STUDENT_NAME_MAX`, capital first letter,
  only ever set as text) or **Practice as a guest**. There are no student
  IDs to type: a new name gets an ID made up for it (`newStudentId()`), and
  the students on the device are found from their saved profiles
  (`deviceStudents()`). A name already used here goes to **Which Maya are
  you?** (`showSameNameStep()`, `practice.signinStep = "samename"`, back
  returns to sign-in): a button per student with that name, or a new
  student types the first letter of their last name (`cleanInitial()`,
  `profile.initial`; an initial already there signs that student in).
  `studentLabel()` gives "Maya" or "Maya R." (`namedStudentLabel()`), else
  "Guest". An old student ID typed as the name (`legacyStudentId()`) still
  signs that student in; one with no name is then asked for it
  (`showNameStep()`). `currentStudent` (`pitchdetect-student`: the ID, `""`
  for a guest, absent = not chosen) stays signed in until **Switch
  student** on the profile. `studentKey(key)` appends `@<ID>` to every
  practice progress key (stars, bests, my songs, first sounds, the profile)
  — firstfive.js's load/save helpers all go through it (via
  `progressGet()` / `progressSet()`) — so students sharing
  a device each keep their own; the guest uses the bare keys, so progress
  from before sign-in stays with the guest. `pitchdetect-song-whole` stays
  device-wide. `signInStudent(id, named)` reloads practice and restores the
  student's saved instrument (if the current mode offers it).
- **Names:** the profile's pencil (`showNameStep("rename")`) changes the
  name and the optional last initial; a name + initial another student
  here already has is refused with a toast (`studentNameTaken()`).
- **Instrument:** after the name (or Skip, or a guest), anyone whose profile
  has no `instrument` yet gets **What do you play?** (`continueSignIn()` →
  `showInstrumentStep()`, buttons from `instrumentPicker()`). From then on
  it changes only in the profile's **Your instrument** drop-down
  (`profileInstrumentMenu()`): picking one shows an inline "Switch to …?"
  (`.instrument-confirm`; Cancel or Escape puts the menu back) before
  `setStudentInstrument()`: `openPractice()` and `signInStudent()` put the
  app back on it (`applyStudentInstrument()`), so changing the instrument
  in the app outside Practice doesn't move the student. Practice doesn't
  need an instrument chosen in the app (the toolbar button is always
  enabled): `openPractice()` goes to sign-in, or to the instrument step when
  `practice.instrument` is empty, and back from there closes Practice.
- **Teacher mode:** typing `TEACHER_CODE` ("900900900"; spaces and
  dashes dropped) as the name on **Who's practicing?** calls
  `enterTeacherMode()`. Every activity, any instrument: the header's pill
  becomes a drop-down (`#practice-instrument-select`,
  `updateTeacherHeader()`, `teacherPickInstrument()`: reloads practice and
  returns to the menu page), and a teacher bar (`#teacher-bar`, menu only,
  `.practice-view.teacher`) replaces the player bar, with **Leave**
  (`leaveTeacherMode()` → sign-in). Practice storage goes through
  `progressGet()` / `progressSet()`: in teacher mode stars, bests and the
  profile live in `teacherStore` (memory, gone on reload); only My songs are
  written, under `@teacher`. `progressCounts()` is false, so no XP, badges,
  practice time or path marks; `practiceSignedIn()` counts the teacher as
  signed in. It lasts the browser session (`sessionStorage`
  `pitchdetect-teacher`); signing a student in ends it.
- **Profile** (`pitchdetect-profile[@ID]`, `loadProfile()` / `saveProfile()`):
  `{ name, initial, xp, avatar, goal, days: { "YYYY-MM-DD": seconds }, streak, bestStreak,
  lastGoalDay, freezes, badges: { id: day }, instrument }`.
- **XP / levels:** the result handlers in firstfive.js call
  `recordProgress(xp)` (lesson note 10 + 5/star, quiz and scale run 10 +
  3/note, drill 5 + 2/note, songs 10 + 2/note, +15 perfect play-through,
  first sounds 15/part, `NEW_BEST_XP` for a new best); it earns any badges
  (`earnBadges()`, `BADGE_XP` each) and awards it all at once
  (`awardXp()`). `levelForXp()`: 100 XP to level 2, then 50 more per level;
  `LEVEL_TITLES`; `showLevelUp()` card (`#level-up`). Avatars (`AVATARS`)
  unlock by level. Pops (`showProgressPop()`, `#progress-pops`) queue one
  after another.
- **Practice time / goal / streak:** `practiceTick()` (every second) adds a
  second to today while practicing (`practicing()`: an activity open, not a
  menu, or the mic on) and there was a sound (`markPracticeActive()`, called
  from the mic loop in notetrainer.js) or a tap in the practice view in the
  last `ACTIVE_WINDOW_MS`. Reaching the daily goal (`DAILY_GOAL_OPTIONS`,
  chosen on the profile) → `reachDailyGoal()`: streak +1, `GOAL_XP`, a
  streak freeze every 7 days (max `MAX_FREEZES`). `settleStreak()` spends
  freezes on missed days or resets the streak.
- **Badges:** `BADGES` (`test(progressSnapshot())`; `available()` hides
  first sounds for instruments without it). They're tested against the
  current instrument's progress; `onPracticeLoaded()` (end of
  `loadPracticeInstrument()`) quietly awards ones already earned.
- **Learning path:** `learningPath()` orders the activities (each step
  has a `unit`: the first unit with its activity, `firstUnitWith()`, except
  intermediate and advanced songs, in unit 4; the profile lists the path
  under a heading per unit) (first sounds,
  the first 3 notes (the student's set), naming, fingering and the quiz on them, 2
  3-note songs, writing a 3-note song, each first-five note, quiz, both drills, 3 beginner songs,
  writing a 5-note song, notes 6 and beyond, 2 of its songs, B♭ scale,
  scale run, 3 intermediate, 3 advanced songs, then learning and playing
  the E♭, A♭, F and C scales and Joy to the World on each, one unit each). Nothing is locked: the menu
  marks the next step (`markNextUp()`, `.next-up` + "Next" tag, or a dot on
  the tab of the page it's on), and the profile lists the path; tapping a step opens it.
- **Screens:** the player bar (`#player-bar`, menu only: avatar, level, XP
  bar, streak, today's goal ring; `updatePlayerBar()`, run by
  `onPracticeMenuShown()`) opens the profile (`showProfile()`, mode
  `profile`, depth 2 in history): level and XP, avatar picker, streak /
  today / total, this week's bars and the goal picker, the path, badges,
  Switch student. Both render into `#practice-hub`.
- **PWA:** `manifest.webmanifest` + `sw.js` (registered at the end of
  progress.js over http(s)). Bump `CACHE` in sw.js only to drop old caches;
  it's network first, so updates arrive without it, but after
  `NETWORK_TIMEOUT_MS` (3 s) a cached copy answers instead (the network's
  reply still updates the cache). Add new app files to `APP_FILES`. Once
  the worker is ready, `cacheInstrumentCharts()` fetches every chart of the
  selected instrument (`fingeringImagePaths()`; on load and each `#instrument`
  change, skipping ones already cached), so charts work offline unseen.
- **Keeping progress safe:** `progressSet()` catches a failed write (full or
  blocked storage) and `warnSaveFailed()` toasts once a visit — callers
  needn't. `requestPersistentStorage()` (`navigator.storage.persist()`, at
  sign-in and on load once someone has signed in) asks the browser not to
  evict the data. iOS Safari outside the Home Screen deletes a site's
  storage after ~7 days unvisited, so `maybeShowInstallHint()` (from
  `onPracticeMenuShown()`, signed in, not teacher mode) shows an info toast
  (`showInfoToast()`) to Add to Home Screen, at most every
  `INSTALL_HINT_EVERY_DAYS`, the day stored in `pitchdetect-install-hint`.
- **Data versions:** `pitchdetect-data-version` (device-wide) is the shape of
  the saved progress; no value means version 1. **When a saved format
  changes** (a key renamed, a field's meaning changed), bump `DATA_VERSION`
  and add `DATA_MIGRATIONS[old]`, which rewrites localStorage for every
  student's keys. `migrateProgress()` runs them in order at the top of
  progress.js, before anything reads progress; a data version newer than the
  app's is left alone. Adding an optional field with a default in
  `loadProfile()` needs no migration.

### Fingerings (`js/fingerings.js`)

- `trumpetFingerings` (3-valve map, shared via `threeValveOffset` with euphonium/tuba)
- `fluteFingerings` (key diagrams)
- `clarinetFingerings` — written E3–G6 (incl. lower altissimo), drawn as SVG
  by `drawClarinetFingering()` (keys listed by id: `Reg`, `T`, `L1`–`R3`,
  side keys `S1`–`S4`, `CsGs`, the E♭/B♭ sliver key `Sl`, pinkies `lE`/`lF`/`lFs`, `rE`/`rF`/`rFs`/`rAb`).
  Like a printed chart, only the register key, thumb and tone holes always
  show; other key groups appear only when the note uses one of their keys.
  Alternates (left/right pinky E/B, F/C, F♯/C♯; throat-tone resonance) show
  side by side with captions via the Show Alternate Fingerings button.
  `img/Fingerings/Clarinet/` is no longer used.
- `imageFingeringMap` — instruments using chart images from `img/Fingerings/`
  (bassoon, flute, oboe, saxes, trombone, double horn); `first` / `last`
  (file numbers) and `extra` list every file in a set, for
  `fingeringImagePaths()` (offline caching; the smoke test checks they all
  exist, so update them when adding or removing chart files); `alternates`
  (by file number, the saxophones' chromatic F♯ charts `54-fork` /
  `66-fork` and bis B♭ charts `58-bis` / `70-bis`, also in `extra` via
  `saxAlternateFiles`) shows them side by side with captions, like
  the clarinet's, behind the same Show Alternate Fingerings button
- `hasFingeringData()`, `displayFingering()` — entry points used by the app.
- Instruments with **no** fingering data: bare clefs, bass clarinet,
  bells (value `glockenspiel`; they get piano-only panels).

## Layout System

- **Desktop (>700px):** note panel left, staff column right, fingering/piano
  panels inline at the bottom. Everything fits the viewport without scrolling
  (`html, body { height: 100% }`, flex columns, `min-height: 0`).
- **Mobile (≤700px, single `@media` block):** one-screen layout — compact
  header, single-row icon toolbar, fixed-height one-line note strip, a compact
  staff (`clamp(140px, 30vh, 250px)`), and below it a **swipeable pager**
  (`#pane-pager`, CSS scroll-snap) filling the remaining height: fingering
  first, swipe left for the piano, with page dots (`.pane-dots`, tappable)
  shown only when both panes exist (`.bottom-panels.has-pages`). Charts scale
  to fit the pane. `showPane()` / `updatePanePager()` drive it; an instrument
  change returns to the fingering pane. On desktop the same `#pane-pager` is a
  plain row showing both panels. Sustain relocates into an overflow (⋯) popover
  — `applyResponsiveControls()` physically moves the same DOM node between
  homes at the breakpoint.
- **No instruction text.** The UI explains itself: the note panel shows a
  dash until there's a note (Listen is the toolbar's `#listenButton`, beside
  the instrument; it turns into Stop while listening), and an
  empty staff shows a faint pulsing note on the middle line
  (`.staff-container.staff-idle`) to signal it's tappable. Empty fingering /
  piano panels show a dash / an unlit keyboard rather than "place a note…"
  text. Keep it that way.
- The **dual-staff** listen layout (`.main-display.dual-staff`) slides the
  second staff open; it's opened by `startListening()` *and* by
  `handleStaffClick()` when a target is placed mid-listen.

### Kid mode

Kid mode is the **default**: `<body class="kid-mode">` in the HTML and
`kidMode = true` in JS, so the full app never flashes on load. The header's
**Advanced mode** switch (`#advancedModeToggle` → `setKidMode(!checked)`,
persisted as `pitchdetect-advanced-mode`) turns it off. `body.kid-mode` strips the app to
instrument + Listen, a big note name colored by letter (`data-letter` on
`#note-display`), the single staff, and a word-based meter ("Too low / Just
right! / Too high"). The instrument list is trimmed to the beginning band
instruments (`KID_INSTRUMENTS`; euphonium shows as "Baritone", what beginning
bands call it):
`applyInstrumentList()` rebuilds `#instrument` from its original markup on
each mode switch (removing options, since iOS ignores hidden ones) and clears
a selection kid mode doesn't offer. Everything else is hidden by one CSS rule list in the
"Kid mode" block at the end of the `<style>`. JS side: staff clicks/hover are
ignored, entering kid mode clears any target, note labels use one spelling
(`writtenNoteHTML`), the staff has no key signature (kid mode has no key
picker; notes get explicit accidentals, spelled for the written key), and `updateKidCelebration()` fires fireworks once a note
is held in tune for `KID_CELEBRATE_MS`. Elements with `.std-only` / `.kid-only`
swap text between modes.

Kid mode has a cartoon theme: `body.kid-mode` redefines the color/radius
tokens and `--font` (Fredoka; the note name uses Baloo 2, whose letters keep
open counters under the outline), adds `--cartoon-border` / `--cartoon-shadow`
(thick ink outlines, hard offset shadows), and a polka-dot sky background.
Text outlines are stacked `text-shadow`s, not `-webkit-text-stroke`, which
traces the overlapping contours inside variable-font glyphs.

### Layout stability rules (load-bearing conventions)

1. **Reserve, don't pop:** panels keep their footprint with placeholders;
   controls are disabled, not hidden; the second staff and tuner meter slide
   open from zero rather than appearing.
2. **Fixed-height text slots:** the mobile note strip is a hard 54px with
   `nowrap`; `#concert-pitch-display` has a fixed em-height on desktop —
   accidental glyphs (♯/♭) fall back to taller fonts and would otherwise
   reflow the layout. `fitNoteName()` shrinks the big note label to one line.
   The desktop fingering panel has a fixed height per instrument
   (`fingeringBoxHeight()` → `--fingering-h`); image charts draw in a box sized
   to the set's largest chart (`imageFingeringMap` w/h), and out-of-range notes
   show a message inside that box instead of collapsing it.
3. **Silence never flickers:** dropouts under `NOTE_CLEAR_HOLD_MS` keep the
   last note shown; after that the note panel goes back to a dash.

## Code Conventions

- **Indentation:** tabs. **Naming:** camelCase. Global scope, no modules.
- **Non-ASCII in JS strings must use `\uXXXX` escapes** (e.g. `✓` for the
  checkmark, `·` middle dot, `♭` flat, `—` em dash). Literals
  are fine in comments and in HTML (the page declares UTF-8), but string
  escapes are the established convention.
- Inline `onclick` handlers in HTML call global functions.
- User-visible errors go through `showToast()`, never `alert()`.

## Development Workflow

```bash
# Serve locally (any static server)
python3 -m http.server 8000
# open http://localhost:8000
```

### Testing (manual + scripted)

Run the smoke test before pushing:

```bash
npm install --no-save playwright   # once (or: NODE_PATH=$(npm root -g) with a global install)
node tests/smoke.js                # CHROMIUM=/path/to/chrome for a browser of your own
```

It serves the repo itself and checks: no errors or page scroll at desktop and
phone sizes; Listen names a 440 Hz tone; a student signs in, and their
profile, instrument and XP survive a reload; a failed save warns; the iPhone
Home Screen hint shows once; the service worker keeps every chart of the
instrument, answers from cache on a slow network, and loads offline. Add a
check there when adding something a broken change would silently lose.

For anything else, drive the real app with Playwright + Chromium using a WAV
file as a fake microphone:

```
--use-fake-ui-for-media-stream
--use-fake-device-for-media-stream
--use-file-for-fake-audio-capture=/path/tone.wav   # e.g. 440 Hz sine
```

A 440 Hz tone reads as A4 concert (written B4 on trumpet, 0¢ on the meter);
445 Hz reads ≈ +20¢ sharp. Tones with silent gaps exercise the detection
hold/debounce paths. Check both 390×844 (mobile) and ~1280×800 (desktop),
and assert no page scroll overflow on mobile.

## Common Modifications

**Add an instrument:**
1. `index.html`: add an `<option>` inside the right `<optgroup>`.
2. `notetrainer.js`: add to `trebleClefInstruments` or `bassClefInstruments`,
   `transpositionMap` (semitones, written − concert), and `instrumentTimbres`
   (or it falls back to the piano-like default).
3. `firstfive.js`: add its concert B♭ to `practiceStartConcertMidi`.
4. `fingerings.js` (optional): valve map via `threeValveOffset`, or images via
   `imageFingeringMap`; otherwise it's piano-only automatically.

**Change reference pitch / detection sensitivity:** A4=440 in
`frequencyFromNoteNumber()` / `noteFromPitch()`; RMS gate (0.01) and
confidence threshold (0.85) in `autoCorrelate()` / `updateListenPitch()`.

## Known Limitations

1. Monophonic detection only (MPM); no chords.
2. Touch note placement has no drag preview — tap, then nudge with ▲▼.
3. No dark mode yet (CSS custom properties are in place for it).
4. Student progress lives only on the device it was earned on (no sync or
   transfer), and anyone can sign in as any name on the device.
5. Screen-reader support is partial: no `aria-live` announcements of detected
   notes; staff placement is pointer-only.

## Git Workflow

- Default branch: `master`; deployed via GitHub Pages (static hosting).
- No CI. Run `node tests/smoke.js` and verify in the app before pushing.
