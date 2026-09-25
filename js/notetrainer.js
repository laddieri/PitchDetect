/*
 * Note Trainer - Click on staff to identify notes
 */

// Audio context for playing sounds
var audioContext = null;
var activeAudioNodes = [];  // Track all active nodes for cleanup

// References to the currently sustaining wind voice, so a pitch change can
// glide the existing oscillators to the new pitch (portamento) instead of
// tearing down and rebuilding the graph — which causes audible clicks/pops.
var sustainVoiceOscillators = [];   // [{ osc, ratio }] harmonic oscillators
var sustainVoiceNoiseFilter = null; // breath-noise bandpass filter (retuned too)

// Current note state
var currentNote = null;
var currentOctave = null;
var currentFrequency = null;
var currentMidi = null;  // Track MIDI note number for arrow key navigation

// Ghost note state (follows mouse)
var ghostNote = null;
var ghostOctave = null;
var ghostMidi = null;
var currentModifier = null;  // Track shift/alt for sharp/flat ghost notes

// Fingering display state
var showingAlternates = false;

// Sustain state
var sustainPlaying = false;

// Pending removal of the Play button's one-shot highlight
var oneshotTimer = null;

// Listen (mic pitch detection) state
var listenActive = false;
var listenStarting = false;  // mic permission/stream request in flight
var listenAudioContext = null;
var listenAnalyser = null;
var listenStream = null;
var listenRafID = null;
var listenBuffer = new Float32Array(4096);
var detectedNote = null;
var detectedOctave = null;
var detectedMidi = null;

// Detected-note debouncing: a new note must hold for a few consecutive frames
// before the display switches to it, and a brief dropout (breath, transition)
// keeps the last note on screen instead of blanking it.
var pendingMidi = null;
var pendingFrames = 0;
var lastPitchTime = 0;
var NOTE_CONFIRM_FRAMES = 3;
var NOTE_CLEAR_HOLD_MS = 300;

// Smoothed cents-offset value driving the tuner meter needle
var smoothedCents = null;

// Success state (detected note matches placed note)
var isSuccess = false;
var fireworksAnimID = null;
var fireworksParticles = [];

// Staff rendering constants
var STAFF_WIDTH = 200;
var STAFF_HEIGHT = 140;
var STAFF_X = 10;
var STAFF_Y = 50;
var LINE_SPACING = 10;  // Space between staff lines in internal coordinates
var MAX_INTERNAL_WIDTH = 260;  // Max VexFlow coordinate width — kept narrow so staff scales up tall
var STAFF_VIEWBOX_HEIGHT = 120;  // Tight viewBox height around staff lines

// Hover-based ghost preview only makes sense with a real hovering pointer.
// On touch devices a tap synthesizes a mousemove immediately before the click;
// letting that render a ghost note swaps the note panel out of its idle
// state mid-tap, which can shift the layout before the click reads its
// coordinate. Touch placement has no drag preview by design,
// so skip the hover preview entirely there.
var staffHoverEnabled = !(window.matchMedia && window.matchMedia("(hover: none), (pointer: coarse)").matches);

// Dynamic staff layout values (updated by drawStaff from VexFlow)
var staffTopLineY = null;
var staffHalfSpacing = 5;
var staffNoteStartX = null;
var staffNoteEndX = null;

// Treble clef instruments
var trebleClefInstruments = [
	"treble clef", "flute", "oboe", "clarinet", "bass clarinet",
	"alto sax", "tenor sax", "bari sax",
	"trumpet", "horn", "glockenspiel"
];

// Bass clef instruments
var bassClefInstruments = ["bass clef", "bassoon", "trombone", "euphonium", "tuba"];

// Transposition map (same as pitchdetect.js)
var transpositionMap = {
	"": 0,
	"treble clef": 0,
	"bass clef": 0,
	"flute": 0,
	"oboe": 0,
	"clarinet": 2,
	"bass clarinet": 14,
	"bassoon": 0,
	"alto sax": 9,
	"tenor sax": 14,
	"bari sax": 21,
	"trumpet": 2,
	"horn": 7,
	"trombone": 0,
	"euphonium": 0,
	"tuba": 0,
	"glockenspiel": -24
};

// Note names
var noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// Key signature state (concert key)
var concertKey = "Bb"; // Default: B-flat major concert

// Circle of fifths: key name → number of sharps(+) or flats(-)
var keyToFifths = {
	"Gb": -6, "Db": -5, "Ab": -4, "Eb": -3, "Bb": -2, "F": -1,
	"C":   0,  "G":  1,  "D":  2,  "A":  3,  "E":  4, "B":  5, "F#": 6
};

// Circle of fifths: fifths count → key name
var fifthsToKey = {
	"-6": "Gb", "-5": "Db", "-4": "Ab", "-3": "Eb", "-2": "Bb", "-1": "F",
	"0": "C", "1": "G", "2": "D", "3": "A", "4": "E", "5": "B", "6": "F#"
};

// Instrument transposition semitones → change in circle-of-fifths position
var transpositionFifthsDelta = { 0: 0, 2: 2, 7: 1, 9: 3 };

// Notes that have accidentals in each key signature
var keySignatureNotes = {
	"C":  [],
	"G":  ["F#"],
	"D":  ["F#", "C#"],
	"A":  ["F#", "C#", "G#"],
	"E":  ["F#", "C#", "G#", "D#"],
	"B":  ["F#", "C#", "G#", "D#", "A#"],
	"F#": ["F#", "C#", "G#", "D#", "A#", "E#"],
	"F":  ["Bb"],
	"Bb": ["Bb", "Eb"],
	"Eb": ["Bb", "Eb", "Ab"],
	"Ab": ["Bb", "Eb", "Ab", "Db"],
	"Db": ["Bb", "Eb", "Ab", "Db", "Gb"],
	"Gb": ["Bb", "Eb", "Ab", "Db", "Gb", "Cb"]
};

// Pitch class → note name, sharp and flat spellings
var sharpNoteSpellings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
var flatNoteSpellings  = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
var flatKeyNames = ["Gb", "Db", "Ab", "Eb", "Bb", "F"];

// Return the VexFlow written key name for the current instrument + concert key
function getWrittenKey() {
	var t = getTransposition();
	// Use mod-12 so octave-shifted instruments (bass clarinet=14, bari sax=21, glockenspiel=-24) map correctly
	var tMod = ((t % 12) + 12) % 12;
	var fifthsDelta = { 0: 0, 2: 2, 7: 1, 9: 3 }[tMod] || 0;
	var concertFifths = keyToFifths[concertKey] !== undefined ? keyToFifths[concertKey] : 0;
	var writtenFifths = concertFifths + fifthsDelta;
	if (writtenFifths > 6) writtenFifths -= 12;
	if (writtenFifths < -6) writtenFifths += 12;
	return fifthsToKey[String(writtenFifths)] || "C";
}

// Return the spelled note name for pitch class pc, using the key's accidental preference
function spellNoteForKey(pc, writtenKey) {
	return (flatKeyNames.indexOf(writtenKey) >= 0 ? flatNoteSpellings : sharpNoteSpellings)[pc];
}

// Enharmonic equivalents
var enharmonicMap = {
	"C#": "Db",
	"D#": "Eb",
	"F#": "Gb",
	"G#": "Ab",
	"A#": "Bb"
};

// Get current clef based on instrument
function getCurrentClef() {
	var instrument = document.getElementById("instrument").value;
	if (bassClefInstruments.includes(instrument)) {
		return "bass";
	}
	return "treble";
}

// Get transposition for current instrument
function getTransposition() {
	var instrument = document.getElementById("instrument").value;
	return transpositionMap[instrument] || 0;
}

// Convert frequency to MIDI note number
function noteFromPitch(frequency) {
	var noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
	return Math.round(noteNum) + 69;
}

// Convert MIDI note number to frequency
function frequencyFromNoteNumber(note) {
	return 440 * Math.pow(2, (note - 69) / 12);
}

// Cents offset of a frequency from the exact pitch of a MIDI note
function centsOffFromPitch(frequency, note) {
	return 1200 * Math.log(frequency / frequencyFromNoteNumber(note)) / Math.log(2);
}

// Get staff line/space position for a note
// Returns the Y position relative to the middle line of the staff
// Treble clef: middle line is B4
// Bass clef: middle line is D3
function getStaffPosition(noteName, octave, clef) {
	// Note positions on staff (0 = middle line, positive = up, negative = down)
	// Each step is a line or space
	var notePositions = {
		"C": 0, "D": 1, "E": 2, "F": 3, "G": 4, "A": 5, "B": 6
	};

	// Get base note without accidental
	var baseNote = noteName.replace("#", "").replace("b", "");
	var position = notePositions[baseNote];

	if (clef === "treble") {
		// Middle line (B4) = 0
		// B4 is position 6 in octave 4
		var referencePosition = 6 + (4 * 7);  // B4
		var notePosition = position + (octave * 7);
		return notePosition - referencePosition;
	} else {
		// Bass clef: middle line is D3
		// D3 is position 1 in octave 3
		var referencePosition = 1 + (3 * 7);  // D3
		var notePosition = position + (octave * 7);
		return notePosition - referencePosition;
	}
}

// Convert click Y position to note using chromatic mapping
// Clicking on staff lines/spaces = natural notes
// Clicking between staff lines/spaces = sharps/flats
function yPositionToNote(yPos, clef) {
	// Use actual VexFlow rendering positions (set by drawStaff)
	var topLineY = staffTopLineY !== null ? staffTopLineY : 100;
	var halfSpacing = staffHalfSpacing;

	// Calculate staff position (0 = top line, positive = going down)
	// Don't round - we'll use the fractional part to determine sharps/flats
	var staffPosExact = (yPos - topLineY) / halfSpacing;
	var staffPos = Math.floor(staffPosExact);
	var fraction = staffPosExact - staffPos;

	// Convert staff position to note name and octave
	var noteName, octave;
	var noteToSemitone = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11};

	if (clef === "treble") {
		// Treble clef: Top line = F5
		// Notes going down: F, E, D, C, B, A, G (repeating)
		var noteNames = ["F", "E", "D", "C", "B", "A", "G"];
		var baseOctaves = [5, 5, 5, 5, 4, 4, 4];

		var cyclePos = staffPos >= 0 ? staffPos % 7 : ((staffPos % 7) + 7) % 7;
		var cycleNum = Math.floor(staffPos / 7);

		noteName = noteNames[cyclePos];
		octave = baseOctaves[cyclePos] - cycleNum;

		// Check if we should show a sharp/flat based on position between staff lines
		// fraction close to 0 = on the current line/space (higher pitch)
		// fraction close to 1 = approaching next line/space (lower pitch)

		if (fraction >= 0.75) {
			// Very close to next staff position (lower pitch) - advance to that note
			var nextPos = (cyclePos + 1) % 7;
			var nextCycleNum = cycleNum + (nextPos < cyclePos ? 1 : 0);
			noteName = noteNames[nextPos];
			octave = baseOctaves[nextPos] - nextCycleNum;
		} else if (fraction > 0.25) {
			// Between staff positions - check if there's a black key here
			var currentMidi = noteToSemitone[noteName] + (octave + 1) * 12;

			// Get the note below (next in sequence = lower pitch)
			var nextPos = (cyclePos + 1) % 7;
			var nextCycleNum = cycleNum + (nextPos < cyclePos ? 1 : 0);
			var nextOctave = baseOctaves[nextPos] - nextCycleNum;
			var nextNoteName = noteNames[nextPos];
			var nextMidi = noteToSemitone[nextNoteName] + (nextOctave + 1) * 12;

			// If there's a whole step between them (2 semitones), there's a black key
			if (currentMidi - nextMidi === 2) {
				// Show the sharp of the lower-pitched note (the chromatic note between them)
				// E.g., between B and A, show A# (not B# which would be C)
				noteName = nextNoteName + "#";
				octave = nextOctave;
			}
			// If only half step (E-F or B-C), stick with the closer natural note
		}
		// If fraction < 0.25, we're on or very close to current position - use current note
	} else {
		// Bass clef: Top line = A3
		var noteNames = ["A", "G", "F", "E", "D", "C", "B"];
		var baseOctaves = [3, 3, 3, 3, 3, 3, 2];

		var cyclePos = staffPos >= 0 ? staffPos % 7 : ((staffPos % 7) + 7) % 7;
		var cycleNum = Math.floor(staffPos / 7);

		noteName = noteNames[cyclePos];
		octave = baseOctaves[cyclePos] - cycleNum;

		if (fraction >= 0.75) {
			// Very close to next staff position (lower pitch) - advance to that note
			var nextPos = (cyclePos + 1) % 7;
			var nextCycleNum = cycleNum + (nextPos < cyclePos ? 1 : 0);
			noteName = noteNames[nextPos];
			octave = baseOctaves[nextPos] - nextCycleNum;
		} else if (fraction > 0.25) {
			// Between staff positions - check if there's a black key here
			var currentMidi = noteToSemitone[noteName] + (octave + 1) * 12;

			var nextPos = (cyclePos + 1) % 7;
			var nextCycleNum = cycleNum + (nextPos < cyclePos ? 1 : 0);
			var nextOctave = baseOctaves[nextPos] - nextCycleNum;
			var nextNoteName = noteNames[nextPos];
			var nextMidi = noteToSemitone[nextNoteName] + (nextOctave + 1) * 12;

			if (currentMidi - nextMidi === 2) {
				// Show the sharp of the lower-pitched note (the chromatic note between them)
				noteName = nextNoteName + "#";
				octave = nextOctave;
			}
		}
		// If fraction < 0.25, we're on or very close to current position - use current note
	}

	// Convert to MIDI
	var baseNote = noteName.replace("#", "").replace("b", "");
	var midi = noteToSemitone[baseNote] + (octave + 1) * 12;

	// Add semitone for sharp
	if (noteName.includes("#")) {
		midi += 1;
	} else if (noteName.includes("b")) {
		midi -= 1;
	}

	// Clamp to reasonable range
	midi = Math.max(24, Math.min(96, midi));

	// Convert awkward enharmonics to natural notes
	// B# -> C, Cb -> B, E# -> F, Fb -> E
	var noteNum = midi % 12;
	if ((noteName === "B#" || noteName === "Cb") && noteNum === 0) {
		// B# or Cb = C
		noteName = "C";
		octave = Math.floor(midi / 12) - 1;
	} else if ((noteName === "E#" || noteName === "Fb") && noteNum === 5) {
		// E# or Fb = F
		noteName = "F";
		octave = Math.floor(midi / 12) - 1;
	} else if (noteName === "Cb" && noteNum === 11) {
		// Cb = B
		noteName = "B";
		octave = Math.floor(midi / 12) - 1;
	} else if (noteName === "Fb" && noteNum === 4) {
		// Fb = E
		noteName = "E";
		octave = Math.floor(midi / 12) - 1;
	}

	return { note: noteName, octave: octave, midi: midi };
}

// Pitch detection using McLeod Pitch Method (MPM / Normalized Square Difference Function)
function autoCorrelate(buf, sampleRate) {
	var SIZE = buf.length;
	var rms = 0;
	for (var i = 0; i < SIZE; i++) {
		var val = buf[i];
		rms += val * val;
	}
	rms = Math.sqrt(rms / SIZE);
	if (rms < 0.01) return { frequency: -1, confidence: 0 };

	var maxLag = Math.floor(SIZE / 2);
	var nsdf = new Float32Array(maxLag);
	for (var tau = 0; tau < maxLag; tau++) {
		var acf = 0, m = 0;
		for (var j = 0; j < SIZE - tau; j++) {
			acf += buf[j] * buf[j + tau];
			m += buf[j] * buf[j] + buf[j + tau] * buf[j + tau];
		}
		nsdf[tau] = m > 0 ? 2 * acf / m : 0;
	}

	var peaks = [];
	var pastInitial = false, inPositiveRegion = false;
	var peakLag = 0, peakVal = -Infinity;
	for (var tau = 1; tau < maxLag; tau++) {
		if (!pastInitial) { if (nsdf[tau] < 0) pastInitial = true; continue; }
		if (nsdf[tau] > 0 && nsdf[tau - 1] <= 0) {
			inPositiveRegion = true; peakLag = tau; peakVal = nsdf[tau];
		} else if (nsdf[tau] <= 0 && nsdf[tau - 1] > 0 && inPositiveRegion) {
			peaks.push({ lag: peakLag, value: peakVal }); inPositiveRegion = false;
		} else if (inPositiveRegion && nsdf[tau] > peakVal) {
			peakLag = tau; peakVal = nsdf[tau];
		}
	}
	if (inPositiveRegion) peaks.push({ lag: peakLag, value: peakVal });
	if (peaks.length === 0) return { frequency: -1, confidence: 0 };

	var maxPeakValue = 0;
	for (var i = 0; i < peaks.length; i++) {
		if (peaks[i].value > maxPeakValue) maxPeakValue = peaks[i].value;
	}
	var threshold = maxPeakValue * 0.93;
	var bestPeak = null;
	for (var i = 0; i < peaks.length; i++) {
		if (peaks[i].value >= threshold) { bestPeak = peaks[i]; break; }
	}
	if (!bestPeak || bestPeak.value < 0.5) return { frequency: -1, confidence: 0 };

	var T0 = bestPeak.lag;
	var confidence = bestPeak.value;
	if (T0 > 0 && T0 < maxLag - 1) {
		var x1 = nsdf[T0 - 1], x2 = nsdf[T0], x3 = nsdf[T0 + 1];
		var a = (x1 + x3 - 2 * x2) / 2;
		var b = (x3 - x1) / 2;
		if (a !== 0) T0 = T0 - b / (2 * a);
	}
	return { frequency: sampleRate / T0, confidence: confidence };
}

// Draw the staff with VexFlow
function drawStaff(noteName, octave, ghostNoteName, ghostNoteOctave, ghostModifier) {
	var outputDiv = document.getElementById("staff-output");
	if (!outputDiv) return null;

	outputDiv.innerHTML = "";

	var VF = Vex.Flow;
	var instrument = document.getElementById("instrument").value;
	var clef = getCurrentClef();

	// Use a fixed internal coordinate space so the SVG scales up to fill the container.
	// Cap the internal width so wide containers (single staff) produce a larger visual.
	var containerEl = document.getElementById("staff-container");
	var containerW = containerEl.clientWidth;
	var containerH = containerEl.clientHeight;
	var rawWidth = Math.max(containerW - 20, 150);
	var internalWidth = Math.min(rawWidth, MAX_INTERNAL_WIDTH);
	var internalHeight = STAFF_VIEWBOX_HEIGHT;

	// Place staff lines centered in the internal coordinate space
	var staffLinesSpan = 4 * LINE_SPACING;  // 40px
	var dynamicStaffY = Math.round((internalHeight - staffLinesSpan) / 2);

	// Create renderer at internal coordinate size
	var renderer = new VF.Renderer(outputDiv, VF.Renderer.Backends.SVG);
	renderer.resize(internalWidth, internalHeight);
	var context = renderer.getContext();

	// Let the SVG scale to fill the container; xMidYMid meet keeps aspect ratio
	var svgElement = outputDiv.querySelector("svg");
	if (svgElement) {
		svgElement.setAttribute("viewBox", "0 0 " + internalWidth + " " + internalHeight);
		svgElement.setAttribute("preserveAspectRatio", "xMidYMid meet");
		svgElement.style.width = "100%";
		svgElement.style.height = "100%";
	}

	// Create stave with key signature
	var staveWidth = internalWidth - 30;
	var writtenKey = getWrittenKey();
	var stave = new VF.Stave(STAFF_X, dynamicStaffY, staveWidth);
	stave.addClef(clef);
	stave.addKeySignature(writtenKey);
	stave.setContext(context).draw();

	// Capture actual staff positions for accurate mouse-to-note mapping
	staffTopLineY = stave.getYForLine(0);
	staffHalfSpacing = (stave.getYForLine(1) - stave.getYForLine(0)) / 2;
	staffNoteStartX = stave.getNoteStartX();
	staffNoteEndX = stave.getNoteEndX();

	// Center the 5 staff lines vertically within the viewBox (fixed position)
	var staffCenter = (stave.getYForLine(0) + stave.getYForLine(4)) / 2;
	var viewBoxOffsetY = staffCenter - internalHeight / 2;
	if (svgElement) {
		svgElement.setAttribute("viewBox", "0 " + viewBoxOffsetY + " " + internalWidth + " " + internalHeight);
	}

	// Note area width (after clef + key signature)
	var noteAreaWidth = stave.getNoteEndX() - stave.getNoteStartX() - 20;

	// Helper function to render notes (key-signature-aware)
	function renderNotes(noteName, noteOctave, isGhost, modifier) {
		try {
			var notes = [];
			var keySigList = keySignatureNotes[writtenKey] || [];
			var pc = noteStrings.indexOf(noteName);

			if (isGhost && modifier) {
				// Explicit shift/alt modifier — override key signature
				var baseNote = noteName.charAt(0).toLowerCase();
				var accidental = modifier === "sharp" ? "#" : "b";
				var note = new VF.StaveNote({ clef: clef, keys: [baseNote + accidental + "/" + noteOctave], duration: "w" });
				note.addAccidental(0, new VF.Accidental(accidental));
				note.setStyle({ fillStyle: "rgba(0, 128, 0, 0.4)", strokeStyle: "rgba(0, 128, 0, 0.4)" });
				notes.push(note);
			} else {
				var spelledName = spellNoteForKey(pc, writtenKey);
				var firstLetter = spelledName.charAt(0);
				var isInKeySig = keySigList.indexOf(spelledName) >= 0;
				var isNatural = spelledName.length === 1 || (spelledName.length > 1 && spelledName.charAt(1) !== "#" && spelledName.charAt(1) !== "b");
				var isNaturalContraKey = !isInKeySig && isNatural &&
					keySigList.some(function(n) { return n.charAt(0) === firstLetter; });

				if (isInKeySig) {
					// In key signature — no explicit accidental needed
					var note = new VF.StaveNote({ clef: clef, keys: [spelledName.toLowerCase() + "/" + noteOctave], duration: "w" });
					if (isGhost) note.setStyle({ fillStyle: "rgba(0, 128, 0, 0.4)", strokeStyle: "rgba(0, 128, 0, 0.4)" });
					notes.push(note);
				} else if (isNaturalContraKey) {
					// Natural note that the key would otherwise alter — show natural sign
					var note = new VF.StaveNote({ clef: clef, keys: [firstLetter.toLowerCase() + "/" + noteOctave], duration: "w" });
					note.addAccidental(0, new VF.Accidental("n"));
					if (isGhost) note.setStyle({ fillStyle: "rgba(0, 128, 0, 0.4)", strokeStyle: "rgba(0, 128, 0, 0.4)" });
					notes.push(note);
				} else if (enharmonicMap[noteName] && !isGhost) {
					// Enharmonic note not covered by key — show both spellings as half notes
					var sharpSpelled = sharpNoteSpellings[pc];
					var flatSpelled  = flatNoteSpellings[pc];

					var sharpNote = new VF.StaveNote({ clef: clef, keys: [sharpSpelled.toLowerCase() + "/" + noteOctave], duration: "h" });
					sharpNote.addAccidental(0, new VF.Accidental("#"));
					notes.push(sharpNote);

					var flatNote = new VF.StaveNote({ clef: clef, keys: [flatSpelled.toLowerCase() + "/" + noteOctave], duration: "h" });
					flatNote.addAccidental(0, new VF.Accidental("b"));
					notes.push(flatNote);
				} else {
					// Normal note — add explicit accidental only if note has one and is not in key
					var note = new VF.StaveNote({ clef: clef, keys: [spelledName.toLowerCase() + "/" + noteOctave], duration: "w" });
					if (spelledName.includes("#")) {
						note.addAccidental(0, new VF.Accidental("#"));
					} else if (spelledName.length > 1 && spelledName.charAt(1) === "b") {
						note.addAccidental(0, new VF.Accidental("b"));
					}
					if (isGhost) note.setStyle({ fillStyle: "rgba(0, 128, 0, 0.4)", strokeStyle: "rgba(0, 128, 0, 0.4)" });
					notes.push(note);
				}
			}

			var voice = new VF.Voice({ num_beats: 4, beat_value: 4 }).setStrict(false);
			voice.addTickables(notes);
			new VF.Formatter().joinVoices([voice]).format([voice], noteAreaWidth);
			voice.draw(context, stave);
		} catch (e) {
			console.log("Could not render note:", noteName, noteOctave, e.message);
		}
	}

	// Render placed note or ghost note
	var idleHint = false;
	if (noteName && octave !== null) {
		renderNotes(noteName, octave, false, null);
	} else if (ghostNoteName && ghostNoteOctave !== null) {
		renderNotes(ghostNoteName, ghostNoteOctave, true, ghostModifier);
	} else if (!listenActive) {
		// Empty staff: draw a faint note on the middle line (pulsed via CSS)
		// so the staff reads as tappable without instruction text. No
		// accidental is added, so it never implies a pitch.
		idleHint = true;
		try {
			var hint = new VF.StaveNote({ clef: clef, keys: [clef === "bass" ? "d/3" : "b/4"], duration: "w" });
			hint.setStyle({ fillStyle: "rgba(79, 70, 229, 0.6)", strokeStyle: "rgba(79, 70, 229, 0.6)" });
			var hintVoice = new VF.Voice({ num_beats: 4, beat_value: 4 }).setStrict(false);
			hintVoice.addTickables([hint]);
			new VF.Formatter().joinVoices([hintVoice]).format([hintVoice], noteAreaWidth);
			hintVoice.draw(context, stave);
		} catch (e) {
			console.log("Could not render staff hint:", e.message);
		}
	}
	containerEl.classList.toggle("staff-idle", idleHint);

	// Position the clickable key-signature overlay over the clef + key signature
	positionKeySigHotspot();

	// Return stave info for click calculations
	return {
		topY: STAFF_Y,
		lineSpacing: 10,  // VexFlow default
		clef: clef
	};
}

// Size and position the transparent key-signature hotspot over the start of
// the staff (clef + key signature). Uses the staff coordinates captured by
// drawStaff so it can also be re-run on resize without re-rendering. Including
// the clef guarantees a stable click target even for keys with no accidentals.
function positionKeySigHotspot() {
	var hotspot = document.getElementById("key-sig-hotspot");
	var container = document.getElementById("staff-container");
	var outputDiv = document.getElementById("staff-output");
	if (!hotspot || !container || !outputDiv) return;

	var svg = outputDiv.querySelector("svg");
	var ctm = svg && svg.getScreenCTM ? svg.getScreenCTM() : null;
	if (!ctm || staffNoteStartX === null || staffTopLineY === null) {
		hotspot.classList.remove("active");
		return;
	}

	var lineSpan = staffHalfSpacing * 2;
	var x1 = STAFF_X;
	var x2 = staffNoteStartX;            // note start = just after clef + key sig
	var yTop = staffTopLineY - lineSpan * 2;
	var yBot = staffTopLineY + 6 * lineSpan; // line 4 (+4 spans) plus a 2-span margin

	function toScreen(x, y) {
		var p = svg.createSVGPoint();
		p.x = x;
		p.y = y;
		return p.matrixTransform(ctm);
	}

	var tl = toScreen(x1, yTop);
	var br = toScreen(x2, yBot);
	var crect = container.getBoundingClientRect();

	hotspot.style.left = (tl.x - crect.left) + "px";
	hotspot.style.top = (tl.y - crect.top) + "px";
	hotspot.style.width = Math.max(0, br.x - tl.x) + "px";
	hotspot.style.height = Math.max(0, br.y - tl.y) + "px";
	hotspot.classList.add("active");
}

// Draw the detected (live mic) note on the second staff
function drawDetectedStaff(noteName, octave) {
	var outputDiv = document.getElementById("staff-output-2");
	if (!outputDiv) return;

	outputDiv.innerHTML = "";

	var VF = Vex.Flow;
	var clef = getCurrentClef();

	// Use a fixed internal coordinate space so the SVG scales to fill the container
	var containerEl2 = document.getElementById("staff-container-2");
	var containerW2 = containerEl2.clientWidth;
	var rawWidth2 = Math.max(containerW2 - 20, 150);
	var internalWidth2 = Math.min(rawWidth2, MAX_INTERNAL_WIDTH);
	var internalHeight2 = STAFF_VIEWBOX_HEIGHT;

	// Place staff lines centered in the internal coordinate space
	var staffLinesSpan2 = 4 * LINE_SPACING;
	var dynamicStaffY2 = Math.round((internalHeight2 - staffLinesSpan2) / 2);

	var renderer = new VF.Renderer(outputDiv, VF.Renderer.Backends.SVG);
	renderer.resize(internalWidth2, internalHeight2);
	var context = renderer.getContext();

	var svgElement = outputDiv.querySelector("svg");
	if (svgElement) {
		svgElement.setAttribute("viewBox", "0 0 " + internalWidth2 + " " + internalHeight2);
		svgElement.setAttribute("preserveAspectRatio", "xMidYMid meet");
		svgElement.style.width = "100%";
		svgElement.style.height = "100%";
	}

	var staveWidth = internalWidth2 - 30;
	var writtenKey = getWrittenKey();
	var stave = new VF.Stave(STAFF_X, dynamicStaffY2, staveWidth);
	stave.addClef(clef);
	stave.addKeySignature(writtenKey);
	stave.setContext(context).draw();

	// Center the 5 staff lines vertically within the viewBox (fixed position)
	var staffCenter2 = (stave.getYForLine(0) + stave.getYForLine(4)) / 2;
	var viewBoxOffsetY2 = staffCenter2 - internalHeight2 / 2;
	if (svgElement) {
		svgElement.setAttribute("viewBox", "0 " + viewBoxOffsetY2 + " " + internalWidth2 + " " + internalHeight2);
	}

	if (!noteName || octave === null) return;

	try {
		var keySigList = keySignatureNotes[writtenKey] || [];
		var pc = noteStrings.indexOf(noteName);
		var spelledName = spellNoteForKey(pc, writtenKey);
		var firstLetter = spelledName.charAt(0);
		var isInKeySig = keySigList.indexOf(spelledName) >= 0;
		var isNatural = spelledName.length === 1 || (spelledName.length > 1 && spelledName.charAt(1) !== "#" && spelledName.charAt(1) !== "b");
		var isNaturalContraKey = !isInKeySig && isNatural &&
			keySigList.some(function(n) { return n.charAt(0) === firstLetter; });

		var notes = [];
		var noteAreaWidth = stave.getNoteEndX() - stave.getNoteStartX() - 20;

		if (isInKeySig) {
			// In key signature — no explicit accidental
			var note = new VF.StaveNote({ clef: clef, keys: [spelledName.toLowerCase() + "/" + octave], duration: "w" });
			notes.push(note);
		} else if (isNaturalContraKey) {
			// Natural sign needed
			var note = new VF.StaveNote({ clef: clef, keys: [firstLetter.toLowerCase() + "/" + octave], duration: "w" });
			note.addAccidental(0, new VF.Accidental("n"));
			notes.push(note);
		} else if (enharmonicMap[noteName]) {
			// Enharmonic note not covered by key — show both spellings
			var sharpSpelled = sharpNoteSpellings[pc];
			var flatSpelled  = flatNoteSpellings[pc];

			var sharpNote = new VF.StaveNote({ clef: clef, keys: [sharpSpelled.toLowerCase() + "/" + octave], duration: "h" });
			sharpNote.addAccidental(0, new VF.Accidental("#"));
			notes.push(sharpNote);

			var flatNote = new VF.StaveNote({ clef: clef, keys: [flatSpelled.toLowerCase() + "/" + octave], duration: "h" });
			flatNote.addAccidental(0, new VF.Accidental("b"));
			notes.push(flatNote);
		} else {
			// Normal note with explicit accidental if needed
			var note = new VF.StaveNote({ clef: clef, keys: [spelledName.toLowerCase() + "/" + octave], duration: "w" });
			if (spelledName.includes("#")) {
				note.addAccidental(0, new VF.Accidental("#"));
			} else if (spelledName.length > 1 && spelledName.charAt(1) === "b") {
				note.addAccidental(0, new VF.Accidental("b"));
			}
			notes.push(note);
		}

		var voice = new VF.Voice({ num_beats: 4, beat_value: 4 }).setStrict(false);
		voice.addTickables(notes);
		new VF.Formatter().joinVoices([voice]).format([voice], noteAreaWidth);
		voice.draw(context, stave);
	} catch (e) {
		console.log("Could not render detected note on staff 2:", noteName, octave, e.message);
	}

}

// Redraw both staves from the current app state at their containers' present
// size. Used when the containers change size (window resize, the dual-staff
// slide), since a staff rendered at a stale width scales differently than
// its neighbor.
function redrawStavesForCurrentState() {
	if (currentNote !== null) {
		drawStaff(currentNote, currentOctave, null, null, null);
	} else if (ghostNote !== null) {
		drawStaff(null, null, ghostNote, ghostOctave, currentModifier);
	} else if (listenActive && detectedNote !== null) {
		drawStaff(detectedNote, detectedOctave, null, null, null);
	} else {
		drawStaff(null, null, null, null, null);
	}

	// The second staff only participates while the dual-staff layout is open
	if (document.querySelector(".main-display").classList.contains("dual-staff")) {
		drawDetectedStaff(detectedNote, detectedOctave);
	}
}

// Get SVG coordinates from mouse event
function getSvgCoordinates(event) {
	var outputDiv = document.getElementById("staff-output");
	var svgElement = outputDiv.querySelector("svg");

	if (!svgElement) return null;

	// Use SVG's built-in coordinate transformation
	// This properly handles viewBox scaling and preserveAspectRatio
	var pt = svgElement.createSVGPoint();
	pt.x = event.clientX;
	pt.y = event.clientY;

	// Transform from screen coordinates to SVG coordinates
	var svgCoords = pt.matrixTransform(svgElement.getScreenCTM().inverse());

	return {
		x: svgCoords.x,
		y: svgCoords.y
	};
}

// Handle mouse move over staff (show ghost note)
function handleStaffMouseMove(event) {
	// Skip the hover preview on touch devices — the synthetic mousemove a tap
	// fires would shift the staff before the click reads its coordinates.
	if (!staffHoverEnabled) return;

	// Don't show ghost note if we already have a placed note
	if (currentNote !== null) return;

	var coords = getSvgCoordinates(event);
	if (!coords) return;

	var clef = getCurrentClef();
	var noteInfo = yPositionToNote(coords.y, clef);

	// Use the note directly from Y position (includes sharps if between staff positions)
	var displayNote = noteInfo.note;
	var displayOctave = noteInfo.octave;
	var displayMidi = noteInfo.midi;

	// Only update if ghost note changed
	if (displayNote !== ghostNote || displayOctave !== ghostOctave || displayMidi !== ghostMidi) {
		ghostNote = displayNote;
		ghostOctave = displayOctave;
		ghostMidi = displayMidi;
		currentModifier = null;

		// Redraw staff and note panel with the ghost note
		drawStaff(null, null, ghostNote, ghostOctave, null);
		updateNoteDisplay();
	}
}

// Handle mouse leave from staff (clear ghost note)
function handleStaffMouseLeave(event) {
	// Clear stored mouse event
	var staffContainer = document.getElementById("staff-container");
	staffContainer._lastMouseEvent = null;

	if (currentNote !== null) return;  // Don't clear if we have a placed note

	ghostNote = null;
	ghostOctave = null;
	ghostMidi = null;
	currentModifier = null;

	// Redraw without the ghost — falling back to the live mic detection if
	// one is showing, rather than blanking it until the next note change
	redrawStavesForCurrentState();
	updateNoteDisplay();
}

// Handle click on staff
function handleStaffClick(event) {
	var coords = getSvgCoordinates(event);
	if (!coords) return;

	var clef = getCurrentClef();
	var noteInfo = yPositionToNote(coords.y, clef);

	// Use the note directly from Y position (includes sharps if between staff positions)
	var placeNote = noteInfo.note;
	var placeOctave = noteInfo.octave;
	var placeMidi = noteInfo.midi;

	// Apply transposition (convert written pitch to concert pitch for frequency)
	var transposition = getTransposition();
	var concertMidi = placeMidi - transposition;
	var frequency = frequencyFromNoteNumber(concertMidi);

	// Store current note (written pitch)
	currentNote = placeNote;
	currentOctave = placeOctave;
	currentFrequency = frequency;
	currentMidi = placeMidi;

	// Clear ghost note
	ghostNote = null;
	ghostOctave = null;

	// Update display
	updateNoteDisplay();

	// Redraw staff with placed note
	drawStaff(currentNote, currentOctave, null, null);

	// If listening started before a target existed, the layout is still
	// single-staff — open the second staff now so detected notes have
	// somewhere visible to go, and move the current detection onto it.
	if (listenActive && !document.querySelector(".main-display").classList.contains("dual-staff")) {
		document.querySelector(".main-display").classList.add("dual-staff");
		drawDetectedStaff(detectedNote, detectedOctave);
	}

	// The success state belongs to the previous target — re-evaluate it
	// against the new one (celebrating immediately on a live match)
	reevaluateMatch();

	// Enable the controls now that a note is placed
	document.getElementById("note-display").classList.add("active");
	updateControlStates();

	// Update fingering display
	showingAlternates = false;
	updateFingeringDisplay();

	// If a note was sustaining, seamlessly switch to the new pitch
	if (sustainPlaying) {
		playNote();
	}
}

// Handle keyboard input for arrow key navigation
function handleKeyDown(event) {
	if (event.key === "Escape") {
		closePopovers();
		return;
	}

	// Leave arrow keys to form controls (changing the instrument or key from
	// the keyboard) and to browser/OS shortcuts
	var target = event.target;
	if (target && (target.tagName === "SELECT" || target.tagName === "INPUT" ||
			target.tagName === "TEXTAREA" || target.isContentEditable)) return;
	if (event.altKey || event.ctrlKey || event.metaKey) return;

	// Only handle arrow keys when we have a placed note
	if (currentNote === null || currentMidi === null) return;

	var newMidi = currentMidi;

	if (event.key === "ArrowUp") {
		newMidi = Math.min(96, currentMidi + 1);  // Move up one half step
		event.preventDefault();
	} else if (event.key === "ArrowDown") {
		newMidi = Math.max(24, currentMidi - 1);  // Move down one half step
		event.preventDefault();
	} else {
		return;  // Not an arrow key we care about
	}

	// Update note if it changed
	if (newMidi !== currentMidi) {
		currentMidi = newMidi;
		currentNote = noteStrings[currentMidi % 12];
		currentOctave = Math.floor(currentMidi / 12) - 1;

		// Recalculate frequency with transposition
		var transposition = getTransposition();
		var concertMidi = currentMidi - transposition;
		currentFrequency = frequencyFromNoteNumber(concertMidi);

		// Update display and redraw staff
		updateNoteDisplay();
		drawStaff(currentNote, currentOctave, null, null);

		// Update fingering display
		updateFingeringDisplay();

		// The success state belongs to the previous target — re-evaluate
		reevaluateMatch();

		// If a note was sustaining, glide it to the new pitch (click-free).
		// Fall back to restarting if there's no live voice to retune.
		if (sustainPlaying) {
			if (!retuneSustainedNote(currentFrequency)) {
				playNote();
			}
		}
	}
}

// Draw a one-octave piano keyboard SVG highlighting concertPc (0–11)
function drawPianoKeyboard(concertPc, concertNoteDisplay) {
	var display = document.getElementById("piano-display");
	if (!display) return;

	var W = 36, WH = 84, BW = 20, BH = 52, labelH = 26;
	var totalWidth = 7 * W;
	var totalHeight = WH + labelH;
	var cs = getComputedStyle(document.documentElement);
	var accent = cs.getPropertyValue("--accent").trim() || "#4f46e5";
	var border = cs.getPropertyValue("--border-strong").trim() || "#cdd5e0";

	// [pitch class, left-edge x]
	var wk = [[0,0],[2,W],[4,2*W],[5,3*W],[7,4*W],[9,5*W],[11,6*W]];
	var bk = [
		[1,  1*W - Math.round(BW/2)],
		[3,  2*W - Math.round(BW/2)],
		[6,  4*W - Math.round(BW/2)],
		[8,  5*W - Math.round(BW/2)],
		[10, 6*W - Math.round(BW/2)]
	];

	var labelX = totalWidth / 2;
	// 1px margin so the outer border's stroke isn't clipped at the edges
	var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 ' + (totalWidth + 2) + ' ' + (totalHeight + 2) + '" style="display:block">';

	// White key background with outer border
	s += '<rect x="0" y="0" width="' + totalWidth + '" height="' + WH + '" fill="#fff" stroke="' + border + '" stroke-width="1" rx="4"/>';

	// Highlight active white key
	for (var i = 0; i < wk.length; i++) {
		if (wk[i][0] === concertPc) {
			s += '<rect x="' + (wk[i][1]+1) + '" y="1" width="' + (W-2) + '" height="' + (WH-2) + '" fill="' + accent + '" rx="3"/>';
			labelX = wk[i][1] + W / 2;
		}
	}

	// White key dividers
	for (var i = 1; i < 7; i++) {
		s += '<line x1="' + (i*W) + '" y1="0" x2="' + (i*W) + '" y2="' + WH + '" stroke="' + border + '" stroke-width="1"/>';
	}

	// Redraw outer border on top of dividers
	s += '<rect x="0" y="0" width="' + totalWidth + '" height="' + WH + '" fill="none" stroke="' + border + '" stroke-width="1" rx="4"/>';

	// Black keys
	for (var i = 0; i < bk.length; i++) {
		var pc = bk[i][0], x = bk[i][1];
		var active = pc === concertPc;
		s += '<rect x="' + x + '" y="0" width="' + BW + '" height="' + BH + '" fill="' + (active ? accent : "#1e293b") + '" rx="2"/>';
		if (active) labelX = x + BW / 2;
	}

	// Note label below keyboard
	s += '<text x="' + labelX + '" y="' + (WH + labelH - 4) + '" text-anchor="middle" font-size="17" font-weight="700" fill="' + accent + '" font-family="Inter,-apple-system,BlinkMacSystemFont,sans-serif">' + concertNoteDisplay + '</text>';

	s += '</svg>';
	display.innerHTML = s;
}

// Show/hide the piano keyboard and update it for the given written MIDI note
function updatePianoDisplay(writtenMidi) {
	var container = document.getElementById("piano-container");
	if (!container) return;

	// Always reserved (with a placeholder until there's a note), so placing
	// a note fills the box rather than expanding the bottom row.
	container.classList.add("active");

	if (writtenMidi === null || writtenMidi === undefined) {
		// An unlit keyboard: shows what this panel is for without any text
		drawPianoKeyboard(-1, "");
		return;
	}

	var transposition = getTransposition();
	var concertMidi = writtenMidi - transposition;
	var concertPc = ((concertMidi % 12) + 12) % 12;
	var concertNoteName = spellNoteForKey(concertPc, concertKey);
	drawPianoKeyboard(concertPc, keyDisplayName(concertNoteName));
}

// Build the big note label as HTML: note letters with real sharp/flat glyphs
// and a smaller octave number, e.g. A4 or C(sharp)4 / D(flat)4 for enharmonics
function writtenNoteHTML(noteName, octave) {
	var html = keyDisplayName(noteName) + '<span class="note-octave">' + octave + '</span>';
	if (enharmonicMap[noteName]) {
		html += ' / ' + keyDisplayName(enharmonicMap[noteName]) + '<span class="note-octave">' + octave + '</span>';
	}
	return html;
}

// Update the two lines under the big note name. The first shows the sounding
// concert pitch (with octave) and its frequency; the second labels the big
// note as written pitch when the instrument transposes, so written vs concert
// is never ambiguous.
function updateConcertPitchDisplay(writtenMidi) {
	var freqElem = document.getElementById("frequency-display");
	var writtenElem = document.getElementById("concert-pitch-display");
	if (!freqElem || !writtenElem) return;

	if (writtenMidi === null || writtenMidi === undefined) {
		freqElem.textContent = "";
		writtenElem.textContent = "";
		return;
	}

	var transposition = getTransposition();
	var concertMidi = writtenMidi - transposition;
	var concertPc = ((concertMidi % 12) + 12) % 12;
	var concertOctave = Math.floor(concertMidi / 12) - 1;
	var concertNoteName = spellNoteForKey(concertPc, concertKey);
	var freq = frequencyFromNoteNumber(concertMidi);
	freqElem.textContent = "Concert " + keyDisplayName(concertNoteName) + concertOctave +
		" \u00b7 " + Math.round(freq) + " Hz";

	if (transposition !== 0) {
		var sel = document.getElementById("instrument");
		var label = sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex].text : "";
		writtenElem.textContent = "as written for " + label;
	} else {
		writtenElem.textContent = "";
	}
}

// Update the note name display. Same priority as the single staff (see
// redrawStavesForCurrentState): placed target, else the hover ghost (dimmed),
// else the live mic detection, else nothing.
function updateNoteDisplay() {
	var noteNameElem = document.getElementById("note-name");
	var midi = null;

	if (currentNote && currentOctave !== null) {
		noteNameElem.innerHTML = writtenNoteHTML(currentNote, currentOctave);
		noteNameElem.style.opacity = "1";
		midi = currentMidi;
	} else if (ghostNote !== null) {
		noteNameElem.innerHTML = writtenNoteHTML(ghostNote, ghostOctave);
		noteNameElem.style.opacity = "0.5";
		midi = ghostMidi;
	} else if (listenActive && detectedNote !== null) {
		noteNameElem.innerHTML = writtenNoteHTML(detectedNote, detectedOctave);
		noteNameElem.style.opacity = "1";
		midi = detectedMidi;
	} else {
		noteNameElem.textContent = "-";
		noteNameElem.style.opacity = "1";
	}
	updateConcertPitchDisplay(midi);
	updatePianoDisplay(midi);
	updateIdleState();
}

// Shrink the note-name text so longer labels (sharps/flats shown with their
// enharmonic spelling, e.g. "C♯ / D♭") fit on a single line. Without this the
// text wraps and the note box grows taller, shifting the rest of the layout.
// The CSS clamp() defines the maximum size; this only ever scales down from it,
// and is re-run whenever the text or the box width changes.
function fitNoteName() {
	var el = document.getElementById("note-name");
	if (!el) return;
	var parent = el.parentElement;
	if (!parent) return;

	// Measure against the CSS-defined size each time so we recover the full size
	// for short labels and on wider layouts.
	el.style.fontSize = "";
	var cs = getComputedStyle(parent);
	var available = parent.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
	if (available <= 0) return;

	// scrollWidth is the single-line width (white-space: nowrap); when it exceeds
	// the box, scale the font down proportionally with a hair of breathing room.
	var contentWidth = el.scrollWidth;
	if (contentWidth > available) {
		var baseSize = parseFloat(getComputedStyle(el).fontSize);
		el.style.fontSize = (baseSize * (available / contentWidth) * 0.98) + "px";
	}
}

// Enable or disable the toolbar/pitch controls for the current state. The
// controls are always present in the layout so nothing shifts as the app
// moves between states; they are simply disabled until they become usable.
function updateControlStates() {
	var hasNote = currentNote !== null && currentMidi !== null;

	document.getElementById("playButton").disabled = !hasNote;
	document.getElementById("clearButton").disabled = !hasNote;
	document.getElementById("pitchUpButton").disabled = !hasNote;
	document.getElementById("pitchDownButton").disabled = !hasNote;

	var sustainSwitch = document.getElementById("sustainSwitch");
	var sustainToggle = document.getElementById("sustainToggle");
	sustainSwitch.classList.toggle("is-disabled", !hasNote);
	sustainToggle.disabled = !hasNote;

	updateIdleState();
}

// With nothing to show (no placed, hovered, or heard note, and not
// listening), the note panel becomes a big Listen button. An active listen
// session counts as "has a note" so silence doesn't flip the panel back.
function updateIdleState() {
	var display = document.getElementById("note-display");
	if (!display) return;
	var idle = currentNote === null && ghostNote === null && detectedMidi === null && !listenActive;
	display.classList.toggle("idle", idle);
}

// Adjust pitch by semitones (for mobile pitch control buttons)
function adjustPitch(semitones) {
	// Only work if we have a placed note
	if (currentNote === null || currentMidi === null) return;

	var newMidi = currentMidi + semitones;

	// Clamp to reasonable range
	newMidi = Math.max(24, Math.min(96, newMidi));

	if (newMidi !== currentMidi) {
		currentMidi = newMidi;
		currentNote = noteStrings[currentMidi % 12];
		currentOctave = Math.floor(currentMidi / 12) - 1;

		// Recalculate frequency with transposition
		var transposition = getTransposition();
		var concertMidi = currentMidi - transposition;
		currentFrequency = frequencyFromNoteNumber(concertMidi);

		// Update display and redraw staff
		updateNoteDisplay();
		drawStaff(currentNote, currentOctave, null, null);

		// Update fingering display
		updateFingeringDisplay();

		// The success state belongs to the previous target — re-evaluate
		reevaluateMatch();

		// If a note was sustaining, glide it to the new pitch (click-free).
		// Fall back to restarting if there's no live voice to retune.
		if (sustainPlaying) {
			if (!retuneSustainedNote(currentFrequency)) {
				playNote();
			}
		}
	}
}

// Instrument timbre profiles for synthesis
// Each profile defines harmonics, envelope, and character for realistic sound
var instrumentTimbres = {
	// Piano-like default for generic treble/bass clef
	"default": {
		type: "struck", gain: 0.35,
		harmonics: [[1, 1.0], [2, 0.5], [3, 0.35], [4, 0.20], [5, 0.12], [6, 0.07], [7, 0.04], [8, 0.02]],
		attack: 0.005, duration: 2.5, detuneSpread: 1.5,
		inharmonicity: 0.0004, decayScale: 0.8, strikeNoise: 0.3
	},
	// Flute: very pure tone, strong fundamental, breathy
	"flute": {
		type: "wind", gain: 0.30,
		harmonics: [[1, 1.0], [2, 0.08], [3, 0.12], [4, 0.03]],
		attack: 0.06, duration: 2.0,
		vibrato: { rate: 5, depth: 4, delay: 0.3 },
		breathNoise: 0.12, breathFilterQ: 1
	},
	// Oboe: rich harmonics, nasal, reedy
	"oboe": {
		type: "wind", gain: 0.18,
		harmonics: [[1, 1.0], [2, 0.7], [3, 0.6], [4, 0.5], [5, 0.35], [6, 0.25], [7, 0.15], [8, 0.1]],
		attack: 0.04, duration: 2.0,
		vibrato: { rate: 5.5, depth: 3, delay: 0.2 },
		breathNoise: 0.04, breathFilterQ: 3
	},
	// Clarinet: strong odd harmonics, weak even (cylindrical bore characteristic)
	"clarinet": {
		type: "wind", gain: 0.22,
		harmonics: [[1, 1.0], [2, 0.1], [3, 0.7], [4, 0.05], [5, 0.5], [6, 0.03], [7, 0.3]],
		attack: 0.04, duration: 2.0,
		vibrato: { rate: 5, depth: 2, delay: 0.5 },
		breathNoise: 0.03, breathFilterQ: 2
	},
	// Bass clarinet: darker, more fundamental weight
	"bass clarinet": {
		type: "wind", gain: 0.22,
		harmonics: [[1, 1.0], [2, 0.12], [3, 0.6], [4, 0.06], [5, 0.4], [6, 0.04], [7, 0.25]],
		attack: 0.05, duration: 2.0,
		vibrato: { rate: 4.5, depth: 2, delay: 0.5 },
		breathNoise: 0.05, breathFilterQ: 1.5
	},
	// Alto sax: warm, rich, wider vibrato
	"alto sax": {
		type: "wind", gain: 0.20,
		harmonics: [[1, 1.0], [2, 0.6], [3, 0.4], [4, 0.35], [5, 0.2], [6, 0.15]],
		attack: 0.04, duration: 2.0,
		vibrato: { rate: 5, depth: 6, delay: 0.2 },
		breathNoise: 0.06, breathFilterQ: 2
	},
	// Tenor sax: similar to alto but darker
	"tenor sax": {
		type: "wind", gain: 0.20,
		harmonics: [[1, 1.0], [2, 0.55], [3, 0.45], [4, 0.3], [5, 0.2], [6, 0.12]],
		attack: 0.04, duration: 2.0,
		vibrato: { rate: 5, depth: 6, delay: 0.2 },
		breathNoise: 0.07, breathFilterQ: 1.5
	},
	// Bari sax: dark, powerful fundamental
	"bari sax": {
		type: "wind", gain: 0.22,
		harmonics: [[1, 1.0], [2, 0.5], [3, 0.4], [4, 0.25], [5, 0.15], [6, 0.1]],
		attack: 0.05, duration: 2.0,
		vibrato: { rate: 4.5, depth: 5, delay: 0.25 },
		breathNoise: 0.08, breathFilterQ: 1
	},
	// Trumpet: bright, strong upper harmonics
	"trumpet": {
		type: "wind", gain: 0.18,
		harmonics: [[1, 1.0], [2, 0.8], [3, 0.6], [4, 0.45], [5, 0.3], [6, 0.2], [7, 0.1]],
		attack: 0.03, duration: 2.0,
		vibrato: { rate: 5.5, depth: 4, delay: 0.3 },
		breathNoise: 0.03, breathFilterQ: 3
	},
	// French horn: warm, mellow
	"horn": {
		type: "wind", gain: 0.22,
		harmonics: [[1, 1.0], [2, 0.6], [3, 0.35], [4, 0.2], [5, 0.1], [6, 0.05]],
		attack: 0.05, duration: 2.0,
		vibrato: { rate: 5, depth: 3, delay: 0.3 },
		breathNoise: 0.03, breathFilterQ: 1.5
	},
	// Bassoon: rich, buzzy, reedy
	"bassoon": {
		type: "wind", gain: 0.16,
		harmonics: [[1, 1.0], [2, 0.8], [3, 0.7], [4, 0.5], [5, 0.35], [6, 0.25], [7, 0.15]],
		attack: 0.05, duration: 2.0,
		vibrato: { rate: 5, depth: 3, delay: 0.3 },
		breathNoise: 0.05, breathFilterQ: 2.5
	},
	// Trombone: rich, warm to bright
	"trombone": {
		type: "wind", gain: 0.18,
		harmonics: [[1, 1.0], [2, 0.7], [3, 0.5], [4, 0.3], [5, 0.2], [6, 0.1]],
		attack: 0.04, duration: 2.0,
		vibrato: { rate: 5, depth: 5, delay: 0.3 },
		breathNoise: 0.04, breathFilterQ: 2
	},
	// Euphonium: warm, round, mellow
	"euphonium": {
		type: "wind", gain: 0.22,
		harmonics: [[1, 1.0], [2, 0.5], [3, 0.3], [4, 0.15], [5, 0.08]],
		attack: 0.05, duration: 2.0,
		vibrato: { rate: 5, depth: 4, delay: 0.3 },
		breathNoise: 0.03, breathFilterQ: 1.5
	},
	// Tuba: dark, heavy fundamental
	"tuba": {
		type: "wind", gain: 0.25,
		harmonics: [[1, 1.0], [2, 0.4], [3, 0.2], [4, 0.1], [5, 0.05]],
		attack: 0.06, duration: 2.0,
		vibrato: { rate: 4.5, depth: 3, delay: 0.4 },
		breathNoise: 0.04, breathFilterQ: 1
	},
	// Glockenspiel: bright, metallic, inharmonic partials from struck bars
	"glockenspiel": {
		type: "struck", gain: 0.25,
		harmonics: [[1, 1.0], [2.76, 0.55], [5.40, 0.3], [8.93, 0.12]],
		attack: 0.001, duration: 3.5, detuneSpread: 0,
		inharmonicity: 0, decayScale: 0.15, strikeNoise: 0.35,
		strikeFilterMult: 8, strikeFilterQ: 4
	}
};

function getTimbre(instrumentName) {
	return instrumentTimbres[instrumentName] || instrumentTimbres["default"];
}

// Synthesize a wind/brass instrument tone
// sustain=true: hold note indefinitely (no release scheduled; nodes stopped via stopNote())
function synthesizeWind(freq, timbre, t, dest, sustain) {
	var duration = timbre.duration;
	var releaseTime = 0.3;
	var sustainEnd = t + duration - releaseTime;

	// Create vibrato LFO shared by all harmonic oscillators
	var vibratoGainNode = null;
	if (timbre.vibrato) {
		var vibratoOsc = audioContext.createOscillator();
		vibratoGainNode = audioContext.createGain();
		vibratoOsc.type = "sine";
		vibratoOsc.frequency.setValueAtTime(timbre.vibrato.rate, t);
		// Delayed onset: no vibrato at first, then ramp in
		vibratoGainNode.gain.setValueAtTime(0, t);
		vibratoGainNode.gain.setValueAtTime(0, t + timbre.vibrato.delay);
		vibratoGainNode.gain.linearRampToValueAtTime(
			timbre.vibrato.depth, t + timbre.vibrato.delay + 0.3
		);
		vibratoOsc.connect(vibratoGainNode);
		vibratoOsc.start(t);
		if (!sustain) vibratoOsc.stop(t + duration);
		activeAudioNodes.push(vibratoOsc);
	}

	// Create harmonic oscillators
	timbre.harmonics.forEach(function(h) {
		var harmonicNum = h[0];
		var amplitude = h[1];
		var harmonicFreq = freq * harmonicNum;

		if (harmonicFreq > audioContext.sampleRate / 2) return;

		var osc = audioContext.createOscillator();
		var gain = audioContext.createGain();

		osc.type = "sine";
		osc.frequency.setValueAtTime(harmonicFreq, t);

		// Connect vibrato LFO to oscillator detune (cents)
		if (vibratoGainNode) {
			vibratoGainNode.connect(osc.detune);
		}

		// Wind envelope: attack -> sustain level (hold if sustaining, else release)
		gain.gain.setValueAtTime(0, t);
		gain.gain.linearRampToValueAtTime(amplitude, t + timbre.attack);

		osc.connect(gain);
		gain.connect(dest);
		osc.start(t);
		activeAudioNodes.push(osc);

		if (!sustain) {
			gain.gain.setValueAtTime(amplitude, sustainEnd);
			gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
			osc.stop(t + duration);
		} else {
			// In sustain mode: hold at amplitude indefinitely (stopped via
			// stopNote). Track the oscillator so its pitch can be glided.
			sustainVoiceOscillators.push({ osc: osc, ratio: harmonicNum });
		}
	});

	// Breath noise: sustained filtered noise following the note envelope
	if (timbre.breathNoise > 0) {
		// In sustain mode use a short looping buffer; otherwise a one-shot for the duration
		var noiseBufferDur = sustain ? 1.0 : duration;
		var noiseLen = Math.ceil(audioContext.sampleRate * noiseBufferDur);
		var noiseBuf = audioContext.createBuffer(1, noiseLen, audioContext.sampleRate);
		var noiseData = noiseBuf.getChannelData(0);
		for (var i = 0; i < noiseLen; i++) {
			noiseData[i] = Math.random() * 2 - 1;
		}

		var noiseSrc = audioContext.createBufferSource();
		noiseSrc.buffer = noiseBuf;
		if (sustain) noiseSrc.loop = true;

		var noiseFilter = audioContext.createBiquadFilter();
		noiseFilter.type = "bandpass";
		noiseFilter.frequency.setValueAtTime(freq * 2, t);
		noiseFilter.Q.setValueAtTime(timbre.breathFilterQ || 1.5, t);

		var noiseGain = audioContext.createGain();
		noiseGain.gain.setValueAtTime(0, t);
		noiseGain.gain.linearRampToValueAtTime(timbre.breathNoise, t + timbre.attack);

		noiseSrc.connect(noiseFilter);
		noiseFilter.connect(noiseGain);
		noiseGain.connect(dest);
		noiseSrc.start(t);
		activeAudioNodes.push(noiseSrc);

		if (!sustain) {
			noiseGain.gain.setValueAtTime(timbre.breathNoise, sustainEnd);
			noiseGain.gain.exponentialRampToValueAtTime(0.001, t + duration);
			noiseSrc.stop(t + duration + 0.01);
		} else {
			// In sustain mode: hold at breathNoise level (stopped via stopNote).
			// Track the filter so its center frequency tracks pitch changes.
			sustainVoiceNoiseFilter = noiseFilter;
		}
	}
}

// Synthesize a struck/percussive instrument tone (piano, glockenspiel)
// sustain parameter accepted for API consistency; struck tones decay naturally
function synthesizeStruck(freq, timbre, t, dest, sustain) {
	var duration = timbre.duration;
	var detuneOffsets = timbre.detuneSpread > 0
		? [-timbre.detuneSpread, timbre.detuneSpread] : [0];
	var decayScale = timbre.decayScale || 0.8;

	detuneOffsets.forEach(function(detuneCents) {
		timbre.harmonics.forEach(function(h) {
			var harmonicNum = h[0];
			var amplitude = h[1];
			var harmonicFreq = freq * harmonicNum;

			if (harmonicFreq > audioContext.sampleRate / 2) return;

			// Apply inharmonicity (piano string stiffness)
			if (timbre.inharmonicity > 0) {
				harmonicFreq *= 1 + timbre.inharmonicity * harmonicNum * harmonicNum;
			}

			var osc = audioContext.createOscillator();
			var gain = audioContext.createGain();

			osc.type = "sine";
			osc.frequency.setValueAtTime(harmonicFreq, t);
			if (detuneCents !== 0) {
				osc.detune.setValueAtTime(detuneCents, t);
			}

			// Higher harmonics decay faster
			var decayRate = 1 + harmonicNum * decayScale;
			var peakLevel = amplitude / detuneOffsets.length;

			gain.gain.setValueAtTime(0, t);
			gain.gain.linearRampToValueAtTime(peakLevel, t + timbre.attack);
			gain.gain.exponentialRampToValueAtTime(peakLevel * 0.4, t + 0.15 * decayRate);
			gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

			osc.connect(gain);
			gain.connect(dest);

			osc.start(t);
			osc.stop(t + duration);
			activeAudioNodes.push(osc);
		});
	});

	// Strike noise transient
	if (timbre.strikeNoise > 0) {
		var noiseLength = Math.ceil(audioContext.sampleRate * 0.04);
		var noiseBuffer = audioContext.createBuffer(1, noiseLength, audioContext.sampleRate);
		var noiseData = noiseBuffer.getChannelData(0);
		for (var i = 0; i < noiseLength; i++) {
			noiseData[i] = (Math.random() * 2 - 1) * 0.5;
		}

		var noiseSource = audioContext.createBufferSource();
		noiseSource.buffer = noiseBuffer;

		var noiseFilter = audioContext.createBiquadFilter();
		noiseFilter.type = "bandpass";
		noiseFilter.frequency.setValueAtTime(
			freq * (timbre.strikeFilterMult || 4), t
		);
		noiseFilter.Q.setValueAtTime(timbre.strikeFilterQ || 2, t);

		var noiseGain = audioContext.createGain();
		noiseGain.gain.setValueAtTime(timbre.strikeNoise, t);
		noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

		noiseSource.connect(noiseFilter);
		noiseFilter.connect(noiseGain);
		noiseGain.connect(dest);

		noiseSource.start(t);
		noiseSource.stop(t + 0.05);
		activeAudioNodes.push(noiseSource);
	}
}

// Handle play button click — delegates based on sustain state
function handlePlayButton() {
	if (sustainPlaying) {
		stopSustain();
	} else {
		playNote();
	}
}

// Stop a sustaining note and restore the play button label/style
function stopSustain() {
	stopNote();
	sustainPlaying = false;
	document.getElementById("playLabel").textContent = "Play Sound";
	document.getElementById("playButton").classList.remove("sustaining");
}

// Called when the sustain toggle changes
function onSustainChange() {
	// If turned off while a note is sustaining, stop it immediately
	if (sustainPlaying && !document.getElementById("sustainToggle").checked) {
		stopSustain();
	}
}

// Play the current note with instrument-specific timbre
function playNote() {
	if (!currentFrequency) return;

	// Stop any currently playing note
	stopNote();
	sustainPlaying = false;

	// Create (or recreate) audio context if needed
	if (!audioContext || audioContext.state === "closed") {
		try {
			audioContext = new (window.AudioContext || window.webkitAudioContext)();
		} catch(e) {
			console.error("PitchDetect: failed to create AudioContext:", e);
			return;
		}
	}

	// Capture values now (before any async gap)
	var instrument = document.getElementById("instrument").value;
	var timbre = getTimbre(instrument);
	var freq = currentFrequency;
	var sustain = document.getElementById("sustainToggle").checked;

	function startAudio() {
		try {
			// Small lookahead ensures scheduled events are always in the future
			var t = audioContext.currentTime + 0.05;

			// Master gain for overall volume control
			var masterGain = audioContext.createGain();
			masterGain.gain.setValueAtTime(timbre.gain, t);
			masterGain.connect(audioContext.destination);
			activeAudioNodes.push(masterGain);

			if (timbre.type === "wind") {
				synthesizeWind(freq, timbre, t, masterGain, sustain);
			} else {
				synthesizeStruck(freq, timbre, t, masterGain, sustain);
			}

			if (sustain) {
				sustainPlaying = true;
				document.getElementById("playLabel").textContent = "Stop";
				document.getElementById("playButton").classList.add("sustaining");
			} else {
				// Brief visual feedback so the user can see the click registered.
				// Restart the timer on replay so an earlier note's timeout
				// doesn't cut the highlight short while this one still sounds.
				var playButton = document.getElementById("playButton");
				playButton.classList.add("playing-oneshot");
				if (oneshotTimer) clearTimeout(oneshotTimer);
				oneshotTimer = setTimeout(function() {
					oneshotTimer = null;
					playButton.classList.remove("playing-oneshot");
				}, timbre.duration * 1000 + 100);
			}
		} catch(e) {
			console.error("PitchDetect: audio synthesis error:", e);
		}
	}

	// Resume if not running (handles suspended, interrupted, etc.), then schedule audio
	if (audioContext.state !== "running") {
		audioContext.resume()
			.then(startAudio)
			.catch(function(e) {
				console.error("PitchDetect: AudioContext resume failed:", e);
			});
	} else {
		startAudio();
	}
}

// Glide the currently sustaining wind voice to a new concert-pitch frequency
// instead of restarting it. Frequency automation is phase-continuous, so this
// is inherently click-free and gapless (a short portamento). Returns false if
// there is no live sustaining voice to retune (e.g. a struck instrument), in
// which case the caller should fall back to restarting the note.
function retuneSustainedNote(newFreq) {
	if (!audioContext || audioContext.state === "closed") return false;
	if (sustainVoiceOscillators.length === 0) return false;

	var now = audioContext.currentTime;
	var glide = 0.04; // 40 ms portamento — smooth, no zipper noise
	var nyquist = audioContext.sampleRate / 2;

	sustainVoiceOscillators.forEach(function(voice) {
		try {
			var target = Math.min(newFreq * voice.ratio, nyquist);
			var param = voice.osc.frequency;
			param.cancelScheduledValues(now);
			param.setValueAtTime(param.value, now);
			param.linearRampToValueAtTime(target, now + glide);
		} catch (e) {
			// Oscillator may have been stopped; ignore
		}
	});

	if (sustainVoiceNoiseFilter) {
		try {
			var fParam = sustainVoiceNoiseFilter.frequency;
			fParam.cancelScheduledValues(now);
			fParam.setValueAtTime(fParam.value, now);
			fParam.linearRampToValueAtTime(newFreq * 2, now + glide);
		} catch (e) {
			// Filter gone; ignore
		}
	}

	return true;
}

// Smoothly ramp an AudioParam down to silence, anchoring at its current
// value so there is no instantaneous jump (which would click).
function rampGainToZero(param, now, fade) {
	try {
		if (param.cancelAndHoldAtTime) {
			param.cancelAndHoldAtTime(now);
		} else {
			param.cancelScheduledValues(now);
			param.setValueAtTime(param.value, now);
		}
	} catch (e) {
		try {
			param.cancelScheduledValues(now);
			param.setValueAtTime(param.value, now);
		} catch (e2) {
			// Param automation unavailable; nothing more we can do here
		}
	}
	param.linearRampToValueAtTime(0, now + fade);
}

// Stop the current note. Rather than cutting the signal instantly (which
// leaves a waveform discontinuity the speakers reproduce as a "pop"), fade
// the master gain to zero over a few milliseconds, then stop and disconnect
// the nodes once the fade has completed.
function stopNote() {
	if (activeAudioNodes.length === 0) return;

	// Hand ownership of the current nodes to this stop operation so that a
	// new note started immediately afterwards gets its own clean list.
	var nodesToStop = activeAudioNodes;
	activeAudioNodes = [];

	// These nodes are about to be torn down — drop the sustaining-voice
	// references so a later retune never touches stopped oscillators.
	sustainVoiceOscillators = [];
	sustainVoiceNoiseFilter = null;

	var FADE = 0.02; // 20 ms release — inaudible but enough to kill clicks

	// If we have no usable audio clock, fall back to an immediate teardown.
	if (!audioContext || audioContext.state === "closed") {
		nodesToStop.forEach(function(node) {
			try {
				node.disconnect();
				if (node.stop) node.stop();
			} catch (e) {
				// Already stopped or disconnected
			}
		});
		return;
	}

	var now = audioContext.currentTime;
	var stopTime = now + FADE + 0.005;

	// Fade every gain node (the master gain routes all sound, so this
	// silences the output smoothly) before anything is stopped.
	nodesToStop.forEach(function(node) {
		if (node.gain) {
			rampGainToZero(node.gain, now, FADE);
		}
	});

	// Schedule sources/oscillators to stop just after the fade finishes.
	nodesToStop.forEach(function(node) {
		if (node.stop) {
			try {
				node.stop(stopTime);
			} catch (e) {
				try { node.stop(); } catch (e2) { /* already stopped */ }
			}
		}
	});

	// Disconnect after the fade + stop have completed.
	setTimeout(function() {
		nodesToStop.forEach(function(node) {
			try { node.disconnect(); } catch (e) { /* already disconnected */ }
		});
	}, (FADE + 0.02) * 1000);
}

// Launch fireworks celebration on the staff canvas when user plays the correct note
function launchFireworks() {
	var staffContainer = document.getElementById("staff-container");
	if (!staffContainer) return;

	// Create or reuse the canvas overlay
	var canvas = document.getElementById("fireworks-canvas");
	if (!canvas) {
		canvas = document.createElement("canvas");
		canvas.id = "fireworks-canvas";
		canvas.style.position = "absolute";
		canvas.style.top = "0";
		canvas.style.left = "0";
		canvas.style.width = "100%";
		canvas.style.height = "100%";
		canvas.style.pointerEvents = "none";
		canvas.style.borderRadius = "12px";
		staffContainer.appendChild(canvas);
	}

	// Cancel any previous animation
	if (fireworksAnimID) {
		cancelAnimationFrame(fireworksAnimID);
		fireworksAnimID = null;
	}

	// Match canvas pixel dimensions to the container
	canvas.width = staffContainer.clientWidth;
	canvas.height = staffContainer.clientHeight;

	var colors = ["#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff", "#c77dff", "#ff9f1c", "#ff4d6d", "#00b4d8"];
	fireworksParticles = [];

	// Launch 3 bursts from different positions across the staff
	var burstPoints = [
		{ x: canvas.width * 0.25, y: canvas.height * 0.45 },
		{ x: canvas.width * 0.5,  y: canvas.height * 0.35 },
		{ x: canvas.width * 0.75, y: canvas.height * 0.45 }
	];

	burstPoints.forEach(function(pt) {
		for (var i = 0; i < 25; i++) {
			var angle = Math.random() * Math.PI * 2;
			var speed = 1.5 + Math.random() * 4;
			fireworksParticles.push({
				x: pt.x, y: pt.y,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed - 1,  // slight upward bias
				color: colors[Math.floor(Math.random() * colors.length)],
				radius: 2.5 + Math.random() * 3,
				alpha: 1,
				decay: 0.012 + Math.random() * 0.008,
				gravity: 0.08 + Math.random() * 0.04
			});
		}
	});

	var startTime = performance.now();
	var animDuration = 2500;

	function step(timestamp) {
		var elapsed = timestamp - startTime;
		var ctx = canvas.getContext("2d");
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		if (elapsed > animDuration) {
			fireworksAnimID = null;
			return;
		}

		var allDone = true;
		fireworksParticles.forEach(function(p) {
			if (p.alpha <= 0) return;
			allDone = false;
			p.x += p.vx;
			p.y += p.vy;
			p.vy += p.gravity;
			p.vx *= 0.98;
			p.alpha -= p.decay;
			ctx.save();
			ctx.globalAlpha = Math.max(0, p.alpha);
			ctx.fillStyle = p.color;
			ctx.beginPath();
			ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
			ctx.fill();
			ctx.restore();
		});

		if (!allDone) {
			fireworksAnimID = requestAnimationFrame(step);
		} else {
			fireworksAnimID = null;
		}
	}

	fireworksAnimID = requestAnimationFrame(step);
}

// Re-evaluate the success state after the target note changes. The previous
// match verdict belongs to the old target: without this, a stale success
// suppresses fireworks for the next genuine match, and a live detection that
// already equals the new target would never celebrate (the detection loop
// only re-checks when the DETECTED note changes).
function reevaluateMatch() {
	var wasSuccess = isSuccess;
	isSuccess = listenActive && detectedMidi !== null &&
		currentMidi !== null && detectedMidi === currentMidi;
	if (isSuccess && !wasSuccess) {
		launchFireworks();
	}
}

// Show a confirmed detected note on the staff and note displays
function commitDetectedNote(writtenMidi) {
	detectedMidi = writtenMidi;
	detectedNote = noteStrings[writtenMidi % 12];
	detectedOctave = Math.floor(writtenMidi / 12) - 1;

	// Check if detected note matches the placed note (success!)
	var matched = (currentMidi !== null && detectedMidi === currentMidi);
	if (matched && !isSuccess) {
		isSuccess = true;
		launchFireworks();
	} else if (!matched) {
		isSuccess = false;
	}

	// Draw detected note — on second staff if a note is placed, otherwise on
	// the single staff (unless a hover ghost is being previewed there)
	if (currentNote !== null) {
		drawDetectedStaff(detectedNote, detectedOctave);
		updateIdleState();
	} else {
		redrawStavesForCurrentState();
		updateNoteDisplay();
	}
}

// Clear the detected note from the staff and note displays
function clearDetectedNote() {
	detectedMidi = null;
	detectedNote = null;
	detectedOctave = null;
	isSuccess = false;
	if (currentNote !== null) {
		drawDetectedStaff(null, null);
		updateIdleState();
	} else {
		redrawStavesForCurrentState();
		updateNoteDisplay();
	}
}

// Update the tuner meter with a cents offset (-50..+50 shown), or null when
// no pitch is detected. Smooths the value so the needle glides, and colors
// the needle/readout by how close to in-tune the player is.
function updateTunerMeter(cents) {
	var meter = document.getElementById("tuner-meter");
	var needle = document.getElementById("tuner-needle");
	var readout = document.getElementById("tuner-readout");
	if (!meter || !needle || !readout) return;

	if (cents === null) {
		smoothedCents = null;
		meter.classList.add("idle");
		meter.classList.remove("in-tune", "close", "off");
		needle.style.left = "50%";
		readout.textContent = "\u2013";  // en dash
		return;
	}

	// Light exponential smoothing so the needle glides instead of jittering
	smoothedCents = smoothedCents === null ? cents : smoothedCents * 0.6 + cents * 0.4;
	var c = Math.max(-50, Math.min(50, smoothedCents));
	var absC = Math.abs(c);

	meter.classList.remove("idle");
	meter.classList.toggle("in-tune", absC <= 10);
	meter.classList.toggle("close", absC > 10 && absC <= 25);
	meter.classList.toggle("off", absC > 25);

	// The track spans ±50¢, so 1¢ = 1% of the width
	needle.style.left = (50 + c) + "%";

	var rounded = Math.round(c);
	readout.textContent = (rounded > 0 ? "+" : "") + rounded + "\u00a2";  // cents sign
}

// Mic pitch detection animation loop
function updateListenPitch() {
	if (!listenActive) return;

	listenAnalyser.getFloatTimeDomainData(listenBuffer);
	var result = autoCorrelate(listenBuffer, listenAudioContext.sampleRate);
	var now = performance.now();

	if (result.frequency > 0 && result.confidence > 0.85) {
		lastPitchTime = now;
		var concertMidi = noteFromPitch(result.frequency);
		// Convert concert pitch to written pitch for this instrument
		var transposition = getTransposition();
		var writtenMidi = concertMidi + transposition;
		// Clamp to reasonable range
		writtenMidi = Math.max(24, Math.min(96, writtenMidi));

		// Intonation relative to the nearest semitone (standard tuner behavior)
		updateTunerMeter(centsOffFromPitch(result.frequency, concertMidi));

		// Debounce note changes: only switch the displayed note once the same
		// new note has held for a few consecutive frames, so brief detection
		// wobbles (attacks, transitions) don't flicker the staff.
		if (writtenMidi === detectedMidi) {
			pendingMidi = null;
			pendingFrames = 0;
		} else if (writtenMidi === pendingMidi) {
			pendingFrames++;
			if (pendingFrames >= NOTE_CONFIRM_FRAMES) {
				pendingMidi = null;
				pendingFrames = 0;
				commitDetectedNote(writtenMidi);
			}
		} else {
			pendingMidi = writtenMidi;
			pendingFrames = 1;
		}
	} else {
		// No clear pitch this frame — idle the meter immediately, but hold the
		// displayed note briefly so short dropouts don't blank the display.
		pendingMidi = null;
		pendingFrames = 0;
		updateTunerMeter(null);
		if (detectedMidi !== null && now - lastPitchTime > NOTE_CLEAR_HOLD_MS) {
			clearDetectedNote();
		}
	}

	listenRafID = requestAnimationFrame(updateListenPitch);
}

// Start listening to the microphone
function startListening() {
	if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
		showToast("Microphone access is not supported in this browser.");
		return;
	}

	// Ignore repeat presses while the mic request is pending — a second
	// request would open a second stream that stopListening never releases
	if (listenStarting) return;
	listenStarting = true;

	navigator.mediaDevices.getUserMedia({
		audio: {
			echoCancellation: false,
			autoGainControl: false,
			noiseSuppression: false
		}
	}).then(function(stream) {
		listenStarting = false;
		listenStream = stream;
		listenAudioContext = new (window.AudioContext || window.webkitAudioContext)();
		var source = listenAudioContext.createMediaStreamSource(stream);
		listenAnalyser = listenAudioContext.createAnalyser();
		listenAnalyser.fftSize = 4096;
		source.connect(listenAnalyser);
		listenBuffer = new Float32Array(listenAnalyser.fftSize);

		listenActive = true;
		pendingMidi = null;
		pendingFrames = 0;
		lastPitchTime = 0;
		updateListenPitch();

		// Switch the note panel out of its idle Listen button immediately (it
		// stays in note mode for the whole session; see updateIdleState)
		updateIdleState();

		// Slide the tuner meter open (idle until a pitch is detected)
		updateTunerMeter(null);
		var meter = document.getElementById("tuner-meter");
		if (meter) meter.classList.add("active");

		// Only expand to the second staff if the user has placed a note. The
		// .dual-staff class drives the panel and labels in CSS (the second staff
		// is always reserved in the layout and slides open), so we just toggle
		// the class and re-render the staves at their new widths.
		if (currentNote !== null) {
			document.querySelector(".main-display").classList.add("dual-staff");
			// Re-render first staff at new (wider) width now that panel 2 is visible
			drawStaff(currentNote, currentOctave, null, null, null);
			drawDetectedStaff(null, null);
		}

		var listenButton = document.getElementById("listenButton");
		document.getElementById("listenLabel").textContent = "Stop";
		listenButton.classList.add("listening");
	}).catch(function(err) {
		listenStarting = false;
		console.error("Microphone access error:", err);
		showToast("Could not access the microphone. Check the browser's mic permission and try again.");
	});
}

// Stop microphone listening and clear detected note
function stopListening() {
	listenActive = false;

	if (listenRafID) {
		cancelAnimationFrame(listenRafID);
		listenRafID = null;
	}
	if (listenStream) {
		listenStream.getTracks().forEach(function(track) { track.stop(); });
		listenStream = null;
	}
	if (listenAudioContext) {
		listenAudioContext.close();
		listenAudioContext = null;
	}
	listenAnalyser = null;
	detectedMidi = null;
	detectedNote = null;
	detectedOctave = null;
	isSuccess = false;
	pendingMidi = null;
	pendingFrames = 0;

	// Collapse and reset the tuner meter
	updateTunerMeter(null);
	var meter = document.getElementById("tuner-meter");
	if (meter) meter.classList.remove("active");

	// Clear any active fireworks animation
	if (fireworksAnimID) {
		cancelAnimationFrame(fireworksAnimID);
		fireworksAnimID = null;
	}
	var fireworksCanvas = document.getElementById("fireworks-canvas");
	if (fireworksCanvas) {
		fireworksCanvas.getContext("2d").clearRect(0, 0, fireworksCanvas.width, fireworksCanvas.height);
	}

	// Collapse the second staff if it was shown (note was placed). Removing
	// .dual-staff slides panel 2 back to zero width and hides the labels via CSS.
	if (currentNote !== null) {
		document.querySelector(".main-display").classList.remove("dual-staff");
		drawDetectedStaff(null, null);
		drawStaff(currentNote, currentOctave, null, null, null);
	} else {
		// No placed note — clear the detection from the single staff and
		// the note panel (including its concert-pitch line and piano)
		redrawStavesForCurrentState();
		updateNoteDisplay();
	}

	var listenButton = document.getElementById("listenButton");
	if (listenButton) {
		document.getElementById("listenLabel").textContent = "Listen";
		listenButton.classList.remove("listening");
	}

	updateIdleState();
}

// Format a key name for display, replacing b/# with ♭/♯
function keyDisplayName(key) {
	if (key.length > 1 && key.charAt(key.length - 1) === "b") {
		return key.charAt(0) + "\u266d";  // ♭
	}
	if (key.charAt(key.length - 1) === "#") {
		return key.charAt(0) + "\u266f";  // ♯
	}
	return key;
}

// Rebuild the key-select dropdown using written keys for the current instrument
function updateKeyDropdown() {
	var select = document.getElementById("key-select");
	if (!select) return;

	var t = getTransposition();
	var tMod = ((t % 12) + 12) % 12;
	var fifthsDelta = { 0: 0, 2: 2, 7: 1, 9: 3 }[tMod] || 0;

	var allConcertKeys = ["Gb", "Db", "Ab", "Eb", "Bb", "F", "C", "G", "D", "A", "E", "B", "F#"];
	var accidentalCount = { "Gb": 6, "Db": 5, "Ab": 4, "Eb": 3, "Bb": 2, "F": 1,
	                        "C": 0, "G": 1, "D": 2, "A": 3, "E": 4, "B": 5, "F#": 6 };

	select.innerHTML = "";

	allConcertKeys.forEach(function(ck) {
		var concertFifths = keyToFifths[ck];
		var writtenFifths = concertFifths + fifthsDelta;
		if (writtenFifths > 6) writtenFifths -= 12;
		if (writtenFifths < -6) writtenFifths += 12;
		var wk = fifthsToKey[String(writtenFifths)] || "C";

		var count = accidentalCount[wk] || 0;
		var isFlat = flatKeyNames.indexOf(wk) >= 0;
		var accDesc;
		if (count === 0) {
			accDesc = "no sharps or flats";
		} else if (count === 1) {
			accDesc = "1 " + (isFlat ? "flat" : "sharp");
		} else {
			accDesc = count + " " + (isFlat ? "flats" : "sharps");
		}

		var label = keyDisplayName(wk) + " \u2013 " + accDesc + " (" + keyDisplayName(ck) + " concert)";
		var option = document.createElement("option");
		option.value = ck;
		option.textContent = label;
		select.appendChild(option);
	});

	select.value = concertKey;
	updateKeyChip();
}

// Keep the always-visible key chip in sync with the staff's written key.
// The chip shows the written key (matching the drawn key signature); the
// tooltip carries the concert key for transposing instruments.
function updateKeyChip() {
	var chip = document.getElementById("key-chip");
	if (!chip) return;
	var written = keyDisplayName(getWrittenKey());
	chip.textContent = "Key: " + written + " \u25be";  // small down triangle
	chip.title = keyDisplayName(concertKey) + " concert \u2014 click to change the key signature";
}

// Toggle the key signature popup panel, anchored near the clicked key signature
function toggleKeySigPopup(event) {
	if (event) event.stopPropagation();
	var popup = document.getElementById("key-sig-popup");
	if (!popup) return;

	if (popup.style.display === "block") {
		popup.style.display = "none";
		return;
	}

	// Anchor just below whatever opened the popup (the key chip or the staff's
	// key-signature hotspot); fall back to the hotspot, then the click point,
	// then a fixed corner.
	var anchorEl = (event && event.currentTarget && event.currentTarget.getBoundingClientRect)
		? event.currentTarget : null;
	if (!anchorEl) {
		var hotspot = document.getElementById("key-sig-hotspot");
		if (hotspot && hotspot.classList.contains("active")) anchorEl = hotspot;
	}
	var anchorLeft, anchorTop, anchorRect = null;
	if (anchorEl) {
		anchorRect = anchorEl.getBoundingClientRect();
		anchorLeft = anchorRect.left;
		anchorTop = anchorRect.bottom + 6;
	} else if (event && event.clientX) {
		anchorLeft = event.clientX;
		anchorTop = event.clientY + 6;
	} else {
		anchorLeft = 20;
		anchorTop = 20;
	}

	// Reveal first so we can measure it, then clamp within the viewport.
	popup.style.left = "0px";
	popup.style.top = "0px";
	popup.style.display = "block";

	var margin = 8;
	var pw = popup.offsetWidth;
	var ph = popup.offsetHeight;
	var left = Math.max(margin, Math.min(anchorLeft, window.innerWidth - pw - margin));
	var top = Math.min(anchorTop, window.innerHeight - ph - margin);

	// If it would spill below the viewport, flip it above the key signature.
	if (anchorRect && anchorTop > window.innerHeight - ph - margin) {
		top = anchorRect.top - ph - 6;
	}
	top = Math.max(margin, top);

	popup.style.left = left + "px";
	popup.style.top = top + "px";
}

// Handle concert key signature change
function onKeyChange() {
	concertKey = document.getElementById("key-select").value;
	try { localStorage.setItem("pitchdetect-key", concertKey); } catch(e) {}
	updateKeyChip();
	var popup = document.getElementById("key-sig-popup");
	if (popup) popup.style.display = "none";
	redrawStavesForCurrentState();
	// The concert-pitch line and piano label spell notes by the concert key
	// (A♯ vs B♭), so they need refreshing too
	updateNoteDisplay();
}

// Handle Listen button click — toggle listening on/off
function handleListenButton() {
	if (listenActive) {
		stopListening();
	} else {
		startListening();
	}
}

// Update fingering display for current note
function updateFingeringDisplay() {
	var instrument = document.getElementById("instrument").value;
	var fingeringContainer = document.getElementById("fingering-container");
	var fingeringDisplay = document.getElementById("fingering-display");
	var alternateButton = document.getElementById("alternateButton");

	// Instruments without fingering data never reserve the box.
	if (!hasFingeringData(instrument)) {
		fingeringContainer.classList.remove("active");
		updatePanePager();
		return;
	}

	// Reserve the box as soon as the instrument is chosen. Before a note is
	// placed, show a placeholder so the panel keeps its footprint and placing
	// a note fills it rather than growing the page.
	fingeringContainer.classList.add("active");
	updatePanePager();
	fingeringDisplay.style.setProperty("--fingering-h", fingeringBoxHeight(instrument));

	if (currentMidi === null) {
		fingeringDisplay.innerHTML = '<div class="panel-placeholder">\u2013</div>';
		alternateButton.style.display = "none";
		return;
	}

	// Display the fingering
	var hasAlternates = displayFingering(fingeringDisplay, instrument, currentMidi, showingAlternates);

	// Reveal the alternate-fingering button when this note has alternates. For
	// valve instruments the button's slot stays reserved (visibility) even when
	// a note has no alternates, so the fingering glyph doesn't shift sideways as
	// you move between notes. Image-based instruments never have alternates, so
	// their button is removed entirely rather than leaving a blank slot.
	var imageBased = (typeof imageFingeringMap !== "undefined") && (instrument in imageFingeringMap);
	if (imageBased) {
		alternateButton.style.display = "none";
	} else {
		alternateButton.style.display = "inline-block";
		alternateButton.style.visibility = hasAlternates ? "visible" : "hidden";
		alternateButton.textContent = showingAlternates ? "Hide Alternate Fingerings" : "Show Alternate Fingerings";
		alternateButton.classList.toggle("active", showingAlternates && hasAlternates);
	}
}

// Toggle alternate fingerings display
function toggleAlternateFingerings() {
	showingAlternates = !showingAlternates;
	updateFingeringDisplay();
}

// ---------------------------------------------------------------------------
// Mobile overflow menu
// On small screens Sustain moves to an overflow menu; on desktop it stays in
// the toolbar.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Fingering / piano pager (mobile)
// On small screens the two panels are pages of a horizontal scroll-snap
// strip: fingering first, swipe left for the piano. The dots mirror the
// current page and switch pages on tap. On desktop the strip is a plain row
// showing both, and none of this has any visible effect.
// ---------------------------------------------------------------------------

// The panes currently in the pager (the fingering pane drops out for
// instruments without fingering data, leaving the piano alone)
function visiblePanes() {
	var pager = document.getElementById("pane-pager");
	if (!pager) return [];
	return Array.prototype.filter.call(pager.children, function(pane) {
		return pane.classList.contains("active");
	});
}

// Scroll to pane i (0 = fingering, 1 = piano when both are present)
function showPane(i, instant) {
	var pager = document.getElementById("pane-pager");
	var pane = visiblePanes()[i];
	if (!pager || !pane) return;
	pager.scrollTo({ left: pane.offsetLeft, behavior: instant ? "auto" : "smooth" });
	setActivePaneDot(i);
}

// Which pane the pager is showing, by nearest scroll position
function currentPaneIndex() {
	var pager = document.getElementById("pane-pager");
	var panes = visiblePanes();
	if (!pager || panes.length === 0) return 0;
	var best = 0;
	for (var i = 1; i < panes.length; i++) {
		if (Math.abs(panes[i].offsetLeft - pager.scrollLeft) < Math.abs(panes[best].offsetLeft - pager.scrollLeft)) {
			best = i;
		}
	}
	return best;
}

function setActivePaneDot(i) {
	[0, 1].forEach(function(n) {
		var dot = document.getElementById("pane-dot-" + n);
		if (!dot) return;
		dot.classList.toggle("active", n === i);
		if (n === i) dot.setAttribute("aria-current", "true");
		else dot.removeAttribute("aria-current");
	});
}

// Show the dots only when there are two panes to page between
function updatePanePager() {
	var panels = document.getElementById("bottom-panels");
	if (!panels) return;
	panels.classList.toggle("has-pages", visiblePanes().length > 1);
	setActivePaneDot(currentPaneIndex());
}

// Show a transient inline error notice (replaces alert(), which blocks the
// page and reads as a browser failure rather than an app message)
var toastTimer = null;
function showToast(message) {
	var toast = document.getElementById("toast");
	if (!toast) return;
	toast.textContent = message;
	toast.classList.add("visible");
	if (toastTimer) clearTimeout(toastTimer);
	toastTimer = setTimeout(function() {
		toast.classList.remove("visible");
	}, 4000);
}

// Close the key-signature popup and the overflow menu (outside click, Escape)
function closePopovers() {
	var popup = document.getElementById("key-sig-popup");
	if (popup) popup.style.display = "none";
	var overflow = document.getElementById("overflow-popover");
	if (overflow) overflow.classList.remove("open");
	var overflowButton = document.getElementById("overflowButton");
	if (overflowButton) overflowButton.setAttribute("aria-expanded", "false");
}

// Toggle the mobile overflow menu (holds the Sustain switch)
function toggleOverflowMenu(event) {
	if (event) event.stopPropagation();
	var popover = document.getElementById("overflow-popover");
	var button = document.getElementById("overflowButton");
	if (!popover) return;
	var open = !popover.classList.contains("open");
	popover.classList.toggle("open", open);
	if (button) button.setAttribute("aria-expanded", open ? "true" : "false");
}

// Adapt the toolbar to the breakpoint. Sustain lives in the toolbar on
// desktop and in the overflow menu on mobile, where toolbar space is scarce —
// moving the same node between the two homes keeps a single checkbox as the
// source of truth.
var mobileLayoutMq = window.matchMedia ? window.matchMedia("(max-width: 700px)") : null;
function applyResponsiveControls() {
	var sustain = document.getElementById("sustainSwitch");
	var popover = document.getElementById("overflow-popover");
	var divider = document.querySelector(".controls .controls-divider");
	if (sustain && popover && divider) {
		if (mobileLayoutMq && mobileLayoutMq.matches) {
			popover.appendChild(sustain);
		} else {
			// Desktop home: end of the playback group, just before the
			// (hidden) overflow button
			divider.parentNode.insertBefore(sustain, document.getElementById("overflowButton"));
		}
	}

	// The compact single-row toolbar clips the long placeholder; shorten it
	// there
	var placeholder = document.querySelector('#instrument option[value=""]');
	if (placeholder) {
		placeholder.textContent = (mobileLayoutMq && mobileLayoutMq.matches)
			? "Instrument\u2026" : "Select an instrument";
	}
}

// Clear the current note
function clearNote() {
	stopNote();
	sustainPlaying = false;

	// Clearing the target doesn't stop the mic (listening works without a
	// target) — it just collapses back to the single staff, which shows the
	// live detection
	document.querySelector(".main-display").classList.remove("dual-staff");

	currentNote = null;
	currentOctave = null;
	currentFrequency = null;
	currentMidi = null;
	ghostNote = null;
	ghostOctave = null;
	ghostMidi = null;
	showingAlternates = false;
	isSuccess = false;

	updateNoteDisplay();
	redrawStavesForCurrentState();

	document.getElementById("playLabel").textContent = "Play Sound";
	document.getElementById("playButton").classList.remove("sustaining");
	document.getElementById("note-display").classList.remove("active");
	updateControlStates();

	// Keep the fingering box reserved (showing its placeholder) when the
	// selected instrument supports fingerings, so clearing a note doesn't
	// collapse the bottom panels. updateNoteDisplay() above already reset the
	// piano panel to its placeholder via updatePianoDisplay(null).
	updateFingeringDisplay();
}

// Initialize
document.addEventListener("DOMContentLoaded", function() {
	// Draw initial empty staff
	var instrument = document.getElementById("instrument");

	instrument.addEventListener("change", function() {
		// Persist selection so the pitch detector page stays in sync
		try { localStorage.setItem('pitchdetect-instrument', instrument.value); } catch(e) {}

		// Enable the listen button once an instrument is selected
		updateControlStates();

		// Stop sustaining note if instrument changes
		if (sustainPlaying) {
			stopSustain();
		}

		// Clear any existing note when instrument changes
		ghostNote = null;
		ghostOctave = null;
		ghostMidi = null;
		showingAlternates = false;

		// The placed target keeps its written pitch; recalculate its sounding
		// frequency with the new transposition
		if (currentMidi !== null) {
			currentFrequency = frequencyFromNoteNumber(currentMidi - getTransposition());
		}

		// A live detection was written for the old transposition — drop it
		// and let the detection loop re-confirm it under the new one
		if (listenActive) {
			pendingMidi = null;
			pendingFrames = 0;
			detectedMidi = null;
			detectedNote = null;
			detectedOctave = null;
			isSuccess = false;
		}

		// Reserve the fingering/piano panels for the newly selected instrument
		// (placeholders when no note is placed) so they don't pop in later.
		updateFingeringDisplay();
		updateKeyDropdown();
		updateNoteDisplay();
		redrawStavesForCurrentState();

		// A new instrument starts on its fingering (the default pane)
		showPane(0, true);
	});

	// Set up event handlers for staff interaction
	var staffContainer = document.getElementById("staff-container");
	staffContainer.addEventListener("click", handleStaffClick);
	staffContainer.addEventListener("mousemove", handleStaffMouseMove);
	staffContainer.addEventListener("mouseleave", handleStaffMouseLeave);

	// Keep the pager dots in step with swipes
	var panePager = document.getElementById("pane-pager");
	if (panePager) {
		panePager.addEventListener("scroll", function() {
			setActivePaneDot(currentPaneIndex());
		}, { passive: true });
	}

	// Set up keyboard handler for arrow key navigation
	document.addEventListener("keydown", handleKeyDown);

	// Re-render the staves whenever their containers change size. The SVGs
	// stretch to fill their container, but their internal coordinate width is
	// chosen from the container width at render time — so a staff drawn
	// mid-transition (the dual-staff slide) or before a resize ends up at a
	// different scale than its neighbor. Observing the containers redraws at
	// the final size; the rAF collapses transition bursts to one redraw per
	// frame. (This also realigns the key-signature hotspot via drawStaff.)
	if (window.ResizeObserver) {
		var staffRedrawPending = false;
		var staffObserver = new ResizeObserver(function() {
			if (staffRedrawPending) return;
			staffRedrawPending = true;
			requestAnimationFrame(function() {
				staffRedrawPending = false;
				redrawStavesForCurrentState();
			});
		});
		staffObserver.observe(document.getElementById("staff-container"));
		staffObserver.observe(document.getElementById("staff-container-2"));
	} else {
		window.addEventListener("resize", redrawStavesForCurrentState);
	}
	window.addEventListener("resize", positionKeySigHotspot);

	// Keep the note-name text fitted on one line. A MutationObserver re-fits
	// whenever the label changes; a ResizeObserver re-fits as the note box's
	// width changes (window resize, mobile reflow, the dual-staff slide). Both
	// fall back to a window resize listener on older browsers.
	var noteNameEl = document.getElementById("note-name");
	if (noteNameEl) {
		if (window.MutationObserver) {
			new MutationObserver(fitNoteName).observe(noteNameEl, { childList: true, characterData: true, subtree: true });
		}
		if (window.ResizeObserver) {
			new ResizeObserver(fitNoteName).observe(noteNameEl.parentElement);
		}
	}
	window.addEventListener("resize", fitNoteName);

	// Close key sig popup and overflow menu when clicking anywhere outside them
	document.addEventListener("click", closePopovers);

	// Toolbar adapts to the breakpoint (sustain placement, placeholder text)
	// and follows it live (rotation, window resize)
	applyResponsiveControls();
	if (mobileLayoutMq) {
		if (mobileLayoutMq.addEventListener) {
			mobileLayoutMq.addEventListener("change", applyResponsiveControls);
		} else if (mobileLayoutMq.addListener) {
			mobileLayoutMq.addListener(applyResponsiveControls);
		}
	}

	// Restore instrument saved from the pitch detector page (or a previous session)
	try {
		var saved = localStorage.getItem('pitchdetect-instrument');
		if (saved) {
			instrument.value = saved;
			// Reset if the saved value isn't a valid option in this list
			if (instrument.value !== saved) instrument.value = '';
		}
	} catch(e) {}

	// Set the initial control/panel state: every control is present but
	// disabled until usable, and the fingering/piano panels reserve their
	// space (with placeholders) for the restored instrument.
	updateControlStates();
	updateFingeringDisplay();
	updatePianoDisplay(null);

	// Restore saved concert key, then build dropdown using correct transposition
	try {
		var savedKey = localStorage.getItem("pitchdetect-key");
		if (savedKey && keyToFifths[savedKey] !== undefined) {
			concertKey = savedKey;
		}
	} catch(e) {}
	updateKeyDropdown();

	// Draw initial staff (uses restored instrument and key for correct clef/key sig)
	drawStaff(null, null, null, null);
});
