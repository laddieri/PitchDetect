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
│   └── vendor/
│       └── vexflow-min.js  # VexFlow (staff/notation rendering)
├── img/Fingerings/     # Fingering chart images per instrument
├── CLAUDE.md           # This file
└── _config.yml         # Jekyll config for GitHub Pages hosting
```

There is **no build system, no package.json, no tests in-repo**. The page runs
directly in a browser.

## Architecture (`js/notetrainer.js`)

All state is module-global. The main clusters:

| Area | Key functions / state |
|---|---|
| **Written/concert pitch** | `transpositionMap`, `getTransposition()`, `getWrittenKey()`, `keyToFifths`. Placed/detected notes are stored as *written* pitch (`currentMidi`, `detectedMidi`); concert = written − transposition. |
| **Staff rendering** | `drawStaff()` (target staff, ghost notes, key signature), `drawDetectedStaff()` (second staff), `redrawStavesForCurrentState()`. SVGs use a fixed internal coordinate width (capped by `MAX_INTERNAL_WIDTH`) and stretch to fill their container — a ResizeObserver re-renders on container size changes so the two staves stay at equal scale. |
| **Note placement** | `handleStaffClick()`, `handleStaffMouseMove()` (ghost preview), `yPositionToNote()` (click Y → note, chromatic between lines), `adjustPitch()` / `handleKeyDown()` (▲▼ buttons, arrow keys). No instrument required — the default is concert-pitch treble clef. |
| **Pitch detection** | `autoCorrelate()` — McLeod Pitch Method (NSDF); returns `{frequency, confidence}`; gated at confidence > 0.85. `updateListenPitch()` is the rAF loop with debouncing: a new note must hold `NOTE_CONFIRM_FRAMES` (3) frames; dropouts under `NOTE_CLEAR_HOLD_MS` (300) keep the last note displayed. |
| **Tuner meter** | `updateTunerMeter()` — cents vs nearest semitone via `centsOffFromPitch()`, EMA-smoothed needle, in-tune/close/off color states. |
| **Match/fireworks** | `commitDetectedNote()` fires `launchFireworks()` on target match; `reevaluateMatch()` re-checks whenever the *target* changes. |
| **Synthesis** | `instrumentTimbres` (per-instrument harmonic stacks, vibrato, breath noise), `synthesizeWind()` / `synthesizeStruck()`, sustain mode with click-free portamento (`retuneSustainedNote()`), fade-out teardown in `stopNote()`. |
| **UI state sync** | `updateControlStates()` (enable/disable), `updateIdleState()` (note panel becomes a big Listen button when there's nothing to show), `updateNoteDisplay()` / `updateConcertPitchDisplay()`, `updateFingeringDisplay()`, `updatePianoDisplay()`, `updatePanePager()` (mobile fingering/piano pages), `updateKeyChip()` / `updateKeyDropdown()` `applyResponsiveControls()` (breakpoint DOM moves), `showToast()` (inline errors — never use `alert()`). |

### `js/fingerings.js`

- `trumpetFingerings` (3-valve map, shared via `threeValveOffset` with euphonium/tuba)
- `fluteFingerings` (key diagrams)
- `imageFingeringMap` — instruments using chart images from `img/Fingerings/`
  (bassoon, clarinet, flute, oboe, saxes, trombone, double horn)
- `hasFingeringData()`, `displayFingering()` — entry points used by the app.
- Instruments with **no** fingering data: bare clefs, bass clarinet,
  glockenspiel (they get piano-only panels).

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
  the Listen button (`.listen-cta`, shown via `#note-display.idle`), and an
  empty staff shows a faint pulsing note on the middle line
  (`.staff-container.staff-idle`) to signal it's tappable. Empty fingering /
  piano panels show a dash / an unlit keyboard rather than "place a note…"
  text. Keep it that way.
- The **dual-staff** listen layout (`.main-display.dual-staff`) slides the
  second staff open; it's opened by `startListening()` *and* by
  `handleStaffClick()` when a target is placed mid-listen.

### Kid mode

A header switch (`#kidModeToggle` → `setKidMode()`, persisted as
`pitchdetect-kid-mode`) adds `body.kid-mode`, which strips the app to
instrument + Listen, a big note name colored by letter (`data-letter` on
`#note-display`), the single staff, and a word-based meter ("Too low / Just
right! / Too high"). Everything else is hidden by one CSS rule list in the
"Kid mode" block at the end of the `<style>`. JS side: staff clicks/hover are
ignored, entering kid mode clears any target, note labels use one spelling
(`writtenNoteHTML`), and `updateKidCelebration()` fires fireworks once a note
is held in tune for `KID_CELEBRATE_MS`. Elements with `.std-only` / `.kid-only`
swap text between modes.

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
3. `fingerings.js` (optional): valve map via `threeValveOffset`, or images via
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
