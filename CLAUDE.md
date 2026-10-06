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
│   ├── firstfive.js    # "First 5 Notes" practice game (loaded last)
│   └── vendor/
│       └── vexflow-min.js  # VexFlow (staff/notation rendering)
├── img/Fingerings/     # Fingering chart images per instrument
├── img/favicon.svg     # Favicon (favicon.ico at the root is its 32px fallback)
├── CLAUDE.md           # This file
└── _config.yml         # Jekyll config for GitHub Pages hosting
```

There is **no build system, no package.json, no tests in-repo**. The page runs
directly in a browser.

## Architecture (`js/notetrainer.js`)

All state is module-global. The main clusters:

| Area | Key functions / state |
|---|---|
| **Written/concert pitch** | `transpositionMap`, `getTransposition()`, `getWrittenKey()`, `keyToFifths`. Placed/detected notes are stored as *written* pitch (`currentMidi`, `detectedMidi`); concert = written − transposition. `spellNoteForKey()` names black keys as flats (band parts read in flats) unless the key signature sharps that note, and always F♯ rather than G♭ unless the key signature has G♭; the main page shows one spelling, never "C♯ / D♭". |
| **Staff rendering** | `drawStaff()` (target staff, ghost notes, key signature), `drawDetectedStaff()` (second staff), `redrawStavesForCurrentState()`. SVGs use a fixed internal coordinate width (capped by `MAX_INTERNAL_WIDTH`) and stretch to fill their container — a ResizeObserver re-renders on container size changes so the two staves stay at equal scale. |
| **Note placement** | `handleStaffClick()`, `handleStaffMouseMove()` (ghost preview), `yPositionToNote()` (click Y → note, chromatic between lines), `adjustPitch()` / `handleKeyDown()` (▲▼ buttons, arrow keys). No instrument required — the default is concert-pitch treble clef. |
| **Pitch detection** | `autoCorrelate()` — McLeod Pitch Method (NSDF); returns `{frequency, confidence}`; gated at confidence > 0.85. `updateListenPitch()` is the rAF loop with debouncing: a new note must hold `NOTE_CONFIRM_FRAMES` (3) frames; dropouts under `NOTE_CLEAR_HOLD_MS` (300) keep the last note displayed. |
| **Tuner meter** | `updateTunerMeter()` — cents vs nearest semitone via `centsOffFromPitch()`, EMA-smoothed needle, in-tune/close/off color states. |
| **Match/fireworks** | `commitDetectedNote()` fires `launchFireworks()` on target match; `reevaluateMatch()` re-checks whenever the *target* changes. |
| **Synthesis** | `instrumentTimbres` (per-instrument harmonic stacks, vibrato, breath noise), `synthesizeWind()` / `synthesizeStruck()`, `playTone(freq, sustain, onStarted, length)` (shared by Play and practice; `length` gives a sequenced note its own `TONE_RELEASE` so it ends before the next), sustain mode with click-free portamento (`retuneSustainedNote()`), fade-out teardown in `stopNote()`. |
| **UI state sync** | `updateControlStates()` (enable/disable), `updateIdleState()` (note panel becomes a big Listen button when there's nothing to show), `updateNoteDisplay()` / `updateConcertPitchDisplay()`, `updateFingeringDisplay()`, `updatePianoDisplay()`, `updatePanePager()` (mobile fingering/piano pages), `updateKeyChip()` / `updateKeyDropdown()` `applyResponsiveControls()` (breakpoint DOM moves), `showToast(message, duration)` (inline errors — never use `alert()`;
mic failures go through `micErrorMessage()`, which says what to do next). |

### `js/firstfive.js` — First 5 Notes practice

A full-screen practice view (`#practice-view`, opened by the toolbar's
**Practice** button → `openPractice()`; the app behind it is made `inert`).
It opens on a **menu** (`showPracticeMenu()`, `PRACTICE_ACTIVITIES`) of
activities, each card showing its best result: **Learn the first 5 notes**
(lessons), **First 5 note quiz** (the challenge round), **Practice note
names** and **Practice fingerings** (drills; "slide positions" on trombone,
"the keyboard" without charts). `#practice-view[data-mode]` (`setPracticeMode()`:
menu / lesson / challenge / drill / songs / song / editor / import / firstsounds) decides what shows; the note map is
lessons-only. The back arrow / Escape (`practiceBack()`) returns an activity
to the menu and the menu to the app; the menu also stops the mic. Browser
history mirrors these screens (`syncPracticeHistory()`, run after every
`setPracticeMode()` and in `closePractice()`), so Android's back button and
iOS's swipe-back step back like the arrow: each screen has a depth (menu 1,
More 2, activity 2 or 3, song 4); deeper pushes, sideways replaces, shallower
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
- Whenever the mic is on, the practice header shows a red mic badge
  (`#practice-mic` in the header's right spacer, `updatePracticeMicBadge()`,
  called by `startListening()` / `stopListening()`), its ring swelling with
  the level (`--mic-level`). Audio never leaves the device: it only feeds an
  `AnalyserNode`; nothing is recorded or sent.
- `practice.ignoreUntil` mutes the check while the example tone sounds, so
  the app can't pass the student's turn for them.
- Note names in the map stay hidden (numbers) until learned, so the map never
  answers the Read step. The practice staff has no key signature — explicit
  flats only.
- **Quiz / challenge round** (`startChallenge()`): from the menu, and offered
  on the lesson result when the fifth note is first learned. `CHALLENGE_LENGTH` notes from `makeChallengeSequence()`
  (each note at least once, no back-to-back repeats), staff only, held for
  `CHALLENGE_HOLD_MS`; progress dots replace the step chips. Feedback never
  names the target. **Help** (`showChallengeHelp()`) reveals name, fingering
  and sound, but only unhelped notes score; `challengeStars()` turns the
  score into 0–3 trophy stars, best score per instrument in
  `pitchdetect-first-five-challenge`.
- **B♭ scale** (two cards on the menu's **More** page: activities marked
  `more` in `PRACTICE_ACTIVITIES` show only after the `#practice-more`
  arrow under the main cards → `showPracticeMenu("more")`;
  `practice.menuPage` / `#practice-view[data-menu-page]`, and the back
  arrow returns an activity to its page and More to the main menu): **Learn the
  B♭ scale** runs the same lessons over `SCALE_STEPS` (concert B♭ up the
  octave, 8 notes) — lesson sets live in `LESSON_SETS` /
  `practice.lessons`, `practice.lesson` picks one, `currentLesson()` gives
  its notes and stars (best per note in `pitchdetect-bb-scale`); the Read
  step offers each name once. **Play the B♭ scale** (`startScaleRun()`) is a
  challenge round (`practice.challenge.kind === "scale"`) in order up and
  back down (`scaleRunSequence()`, 15 notes), best in
  `pitchdetect-bb-scale-run`; `challengeStars(score, total)` scales the
  10/8/5 thresholds. The quiz and drills stay on the first five notes.
- **Songs** (`showSongList()` → `playThroughSong(id)`, a wide card on the
  menu's **More** page, under the B♭ scale cards): `SONGS` holds public
  domain tunes, each with a `level` the song list groups them by
  (`SONG_LEVELS`): each level is a colored button (hint, stars earned) that
  opens its songs in place below it, closed by default; `songLevelsOpen`
  keeps what's open for the session, and the level of the song just played
  opens on the way back. The list sits at the top of the card (not centered)
  so opening a level doesn't move the others. **Beginner** (first five
  notes, plain rhythms: Hot Cross Buns, Au Clair de la Lune, Mary Had a
  Little Lamb, Lightly Row, Ode to Joy, Go Tell Aunt Rhody, Jingle Bells),
  **Intermediate** (rests, dotted notes or notes past the fifth: Goin' Home,
  When the Saints, Twinkle, All My Little Ducklings), **Advanced** (eighth
  notes on the whole scale: London Bridge, Michael Row the Boat, Row Row Row
  Your Boat). Keep `SONGS` in level order (Next song follows it). Each measure is a
  string of scale degree + duration (`"3q 2q 1h"`, `"5q. 68"` dotted,
  `"rq"` a rest; degrees 1–8 index the B♭ scale, spelled up the letters from
  the first note so alto sax gets F♯); a song may set `time` (e.g. `"6/8"`),
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
  along and the mic ignoring it; `setPracticeMode()` and `closePractice()`
  stop it. Help works as in the quiz; best unhelped-note score per song
  per instrument in `pitchdetect-songs`, shown as `challengeStars()`. Back
  from a song returns to the song list, and from the list to More.
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
  Songs go through `songEvents(song)` (notes *and* rests: `{ midi|null,
  dur, dots, measure, letter, alter, octave }`); `songNotes()` keeps the
  playable ones, each with its `event` index. `renderSongLine()` draws a
  line for both song mode and the editor; built-in songs render exactly as
  before (no key/time signature, every flat written out).
- **My songs** (`openSongEditor(id)`, mode `editor`, under "My songs" in the
  song list, with **Make a song** and a pencil per song): the student copies
  a tune from their own printed part. Stored per instrument, in written pitch,
  in `pitchdetect-my-songs` as `{ id, title, time, key, notes }`, a note being
  `{ s: diatonic step (octave × 7 + letter), a: −1/0/1, d: w|h|q|8, dot }` or
  a rest `{ r: 1, d, dot }`; `customSongEvents()` fills measures from the time
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
  are tappable. **Measures never overflow** (`overflowingNotes()`,
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
  sharer's instrument if none is chosen, and walks menu → More → song list →
  the import screen (mode `import`, `showSongImport()`) so back steps out
  normally; a pending import survives until Practice opens
  (`pendingSongImport`). A friend on another instrument gets
  `transposeSharedSong()`: same sounding tune, in their octave (the two
  instruments' first band notes line up), key moved round the circle of
  fifths, notes respelled. **Add to My songs** skips an identical copy.
- **Drills** (`startDrill("names" | "fingerings")`, no mic): races against
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
  barrel", alto sax "Learn the mouthpiece & neck". `startFirstSounds()` →
  `goToFirstSoundsStep()`: Set up (tips + `firstSoundsSVG()` drawing) → one
  step per sound in the config → final (`firstSoundsFinalStep()`;
  `"switch"`: alternate both sounds, flute; `"long"`: hold the last sound for
  `FIRST_SOUNDS_LONG_TONE_MS`) → result. Flute: Set up / Open / Covered /
  Switch; clarinet and sax skip the mouthpiece alone (not how beginners are
  started): Set up / Barrel or Neck / Hold. Stars = parts completed scaled to
  3, best per instrument in `pitchdetect-first-five-headjoint` (key predates
  clarinet/sax). Concert pitches with accepted cents bands: flute open ≈ A5
  (accepts G5–B5), covered ≈ A4 (accepts G4–B♭4; can overblow to E6) — wide
  because real head joints vary; clarinet
  mouthpiece + barrel ≈ F♯5; alto sax mouthpiece + neck ≈ A♭4 (usually a bit
  above). The staff shows the written pitch (`sharp` spells F♯/G♯).
  First sounds are breathy, so this mode uses a looser confidence gate
  (`practiceConfidenceGate()` → `FIRST_SOUNDS_MIN_CONFIDENCE` 0.7; the mic
  loop passes practice its own gated frequency, the main display keeps 0.85)
  and forgives dropouts up to `FIRST_SOUNDS_GAP_MS` in a hold.
  `updateFirstSoundsListen()` takes over the mic loop in this mode and gives
  per-instrument hints: the other sound (flute only, `confusable`), squeaks,
  low/high, and no sound after 6 s.
- `practiceFingeringBox()` builds the chart for the Finger step and challenge
  Help. Trombone charts share a wide canvas (bell fixed, room for the slide at
  7th position), so `centerChartDrawing()` measures the drawn pixels and
  shifts the image to center them; `.practice-fingering` clips the blank part.
  The main app's fingering panel leaves charts as drawn.
- The header's big instrument picker (`#practice-instrument`, a styled native
  select cloned from `#instrument`) switches instruments in place:
  `changePracticeInstrument()` sets the app's select, fires its `change`
  handler (which persists it), and `loadPracticeInstrument()` restarts.
- Toolbar placement: beside Listen, always labeled "Practice". In kid mode on
  phones the star is dropped and the toolbar's Listen (mostly an invisible
  placeholder there — the note panel is the Listen button) becomes a round
  44px icon that shows a stop square while listening, so the label and the
  instrument name both fit. In the full app on mobile Practice moves to the
  overflow menu (`applyResponsiveControls()`).

- `trumpetFingerings` (3-valve map, shared via `threeValveOffset` with euphonium/tuba)
- `fluteFingerings` (key diagrams)
- `clarinetFingerings` — written E3–G6 (incl. lower altissimo), drawn as SVG
  by `drawClarinetFingering()` (keys listed by id: `Reg`, `T`, `L1`–`R3`,
  side keys `S1`–`S4`, `CsGs`, pinkies `lE`/`lF`/`lFs`, `rE`/`rF`/`rFs`/`rAb`).
  Like a printed chart, only the register key, thumb and tone holes always
  show; other key groups appear only when the note uses one of their keys.
  Alternates (left/right pinky E/B, F/C, F♯/C♯; throat-tone resonance) show
  side by side with captions via the Show Alternate Fingerings button.
  `img/Fingerings/Clarinet/` is no longer used.
- `imageFingeringMap` — instruments using chart images from `img/Fingerings/`
  (bassoon, flute, oboe, saxes, trombone, double horn)
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
- **No instruction text.** The UI explains itself: the empty note panel *is*
  the Listen button (`.listen-cta`, shown via `#note-display.idle`; meanwhile
  a `body:has(#note-display.idle)` rule hides the toolbar's `#listenButton` so there's only ever one
  Listen button — the toolbar one returns as Stop, or when a note is shown), and an
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
3. **The idle state never flickers:** an active listen session counts as "has
   a note" so silence doesn't flip the note panel back to the Listen button.

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

No test suite exists. Changes are verified by driving the real app, ideally
with Playwright + Chromium using a WAV file as a fake microphone:

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
4. Screen-reader support is partial: no `aria-live` announcements of detected
   notes; staff placement is pointer-only.

## Git Workflow

- Default branch: `master`; deployed via GitHub Pages (static hosting).
- No CI. Verify by running the app before pushing.
