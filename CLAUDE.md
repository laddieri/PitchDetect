# CLAUDE.md - AI Assistant Guide for PitchDetect

## Project Overview

**PitchDetect** is a real-time pitch detection web application that analyzes audio input from a microphone and displays the detected musical pitch. Originally created by Chris Wilson in 2014, this project demonstrates the Web Audio API's capabilities for audio analysis.

**Live Demo:** https://webaudiodemos.appspot.com/pitchdetect/

**License:** MIT

## Repository Structure

```
PitchDetect/
├── index.html          # Main HTML entry point with UI elements
├── js/
│   └── pitchdetect.js  # Core pitch detection logic (~400 lines)
├── img/
│   └── forkme.png      # GitHub fork ribbon image
├── README.md           # Original project readme
├── LICENSE.txt         # MIT License
├── _config.yml         # Jekyll theme config for GitHub Pages
└── CLAUDE.md           # This file
```

## Technology Stack

| Technology | Purpose |
|------------|---------|
| **JavaScript (ES6)** | Core application logic |
| **Web Audio API** | Real-time audio capture and analysis |
| **p5.js v0.7.3** | Canvas-based musical staff visualization |
| **HTML5/CSS** | UI structure and styling |
| **Jekyll** | GitHub Pages hosting (minimal theme) |

## Key Files and Their Responsibilities

### `index.html`
- Entry point for the application
- Contains inline CSS styles for UI states (confident/vague)
- Includes Start button, instrument selector dropdown
- Detector box displays pitch, note, and detuning
- Loads p5.js from CDN for visualization

### `js/pitchdetect.js`
Core JavaScript file containing all pitch detection logic:

| Function | Line | Purpose |
|----------|------|---------|
| `startPitchDetect()` | 87 | Initiates getUserMedia for live audio input |
| `updatePitch()` | 261 | Main animation loop processing audio data |
| `autoCorrelate(buf, sampleRate)` | 216 | ACF2+ pitch detection algorithm |
| `noteFromPitch(frequency)` | 176 | Converts Hz to MIDI note number |
| `octaveFromPitch(frequency)` | 185 | Determines octave (0-7) from frequency |
| `frequencyFromNoteNumber(note)` | 181 | Converts MIDI note back to Hz |
| `centsOffFromPitch(frequency, note)` | 212 | Calculates detuning in cents |
| `setup()` / `draw()` | 335/342 | p5.js canvas initialization and rendering |
| `drawStaff()` / `drawNote()` | 359/368 | Musical staff visualization helpers |

## Core Algorithm: ACF2+ (Auto-Correlation)

The pitch detection uses an auto-correlation algorithm:
1. Calculates RMS of the audio buffer
2. Returns -1 if signal is below threshold (RMS < 0.01)
3. Trims buffer edges below threshold (0.2)
4. Computes auto-correlation coefficients
5. Finds the peak correlation after the first minimum
6. Uses parabolic interpolation for sub-sample accuracy
7. Returns detected frequency as `sampleRate / T0`

**Musical Constants:**
- Reference pitch: A4 = 440 Hz
- FFT Size: 2048 samples
- Note strings: `["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]`

## Development Workflow

### No Build System
This is a static web application with no build process:
- No package.json or npm dependencies
- No bundler or transpilation
- Direct browser execution
- Open `index.html` in a browser to run

### Local Development
```bash
# Serve locally with any HTTP server
python -m http.server 8000
# or
npx serve .

# Then open http://localhost:8000
```

### Testing
- No automated tests exist
- Manual testing: Click "Start", grant microphone access, whistle or play an instrument
- Verify pitch display updates in real-time
- Check that note names and detuning are accurate

## Browser Requirements

- Modern browser with Web Audio API support
- `navigator.mediaDevices.getUserMedia()` API
- Canvas support (for p5.js visualization)
- `requestAnimationFrame` support

**Tested on:** Chrome, Firefox, Safari, Edge (modern versions)

## UI States

The detector element has two CSS states:
- **`.confident`** - Black text, valid pitch detected
- **`.vague`** - Light grey text, no valid pitch (silence or noise)

Detuning states:
- **`.flat`** - Shows flat symbol (♭) when pitch is below target note
- **`.sharp`** - Shows sharp symbol (♯) when pitch is above target note

## Common Modifications

### Adding a New Instrument
Edit `index.html` to add an option to the instrument selector:
```html
<option value="new_instrument">new instrument</option>
```
Note: The instrument selector UI exists but currently has no functional effect on pitch detection.

### Adjusting Detection Sensitivity
In `js/pitchdetect.js`:
- Line 226: Change RMS threshold (`0.01`) for signal detection sensitivity
- Line 229: Change edge threshold (`0.2`) for buffer trimming

### Changing Reference Pitch
In `js/pitchdetect.js`:
- Line 177: A4 reference is `440` Hz - modify for alternate tuning systems

## Known Limitations

1. **Monophonic only** - Works best with single-note sources (whistling, flute, guitar tuning)
2. **Strong harmonics** - May throw off detection accuracy
3. **No polyphonic detection** - Cannot detect chords
4. **Instrument selector** - UI present but not functional (no transposition implemented)

## Code Style Conventions

- **Indentation:** Tabs
- **Naming:** camelCase for functions and variables
- **Global variables:** Used extensively (audioContext, analyser, etc.)
- **Comments:** Minimal inline comments
- **No modules:** All code in global scope

## Important Implementation Notes

1. **getUserMedia constraints:** Uses deprecated Chrome-specific constraints (`googEchoCancellation`, etc.) - may need updating for cross-browser compatibility

2. **AudioContext resumption:** Browser autoplay policies require user interaction before audio context starts - handled by Start button click

3. **Animation loop:** Uses `requestAnimationFrame` for ~60 FPS updates with webkit fallback

4. **p5.js integration:** Runs in global mode, not instance mode - `setup()` and `draw()` are global functions

## Potential Improvements for AI Assistants

When working on this codebase, consider:

1. **Modernization opportunities:**
   - Convert to ES modules
   - Replace deprecated getUserMedia constraints
   - Add TypeScript types
   - Use modern async/await patterns consistently

2. **Feature additions:**
   - Implement instrument transposition
   - Add pitch history/graph
   - Improve visualization
   - Add tuning modes (equal temperament, just intonation)

3. **Code quality:**
   - Reduce global variables
   - Add error handling
   - Add unit tests for pitch calculation functions
   - Document algorithm implementation

## Git Workflow

- Main branch: `master`
- Commits should be descriptive of changes
- No CI/CD pipeline configured
- Deploy by pushing to GitHub Pages or hosting static files

## Quick Reference

```javascript
// Convert frequency to note name
const noteNum = noteFromPitch(440);  // Returns 69 (A4)
const noteName = noteStrings[noteNum % 12];  // Returns "A"

// Check detuning
const cents = centsOffFromPitch(442, 69);  // Returns positive (sharp)

// Pitch detection from audio buffer
const frequency = autoCorrelate(buf, sampleRate);  // Returns Hz or -1
```
