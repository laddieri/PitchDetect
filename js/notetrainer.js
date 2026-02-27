/*
 * Note Trainer - Click on staff to identify notes
 */

// Audio context for playing sounds
var audioContext = null;
var activeAudioNodes = [];  // Track all active nodes for cleanup

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

// Listen (mic pitch detection) state
var listenActive = false;
var listenAudioContext = null;
var listenAnalyser = null;
var listenStream = null;
var listenRafID = null;
var listenBuffer = new Float32Array(4096);
var detectedNote = null;
var detectedOctave = null;
var detectedMidi = null;

// Success state (detected note matches placed note)
var isSuccess = false;
var fireworksAnimID = null;
var fireworksParticles = [];

// Staff rendering constants
var STAFF_WIDTH = 280;
var STAFF_HEIGHT = 140;
var STAFF_X = 10;
var STAFF_Y = 35;
var LINE_SPACING = 10;  // Space between staff lines in internal coordinates

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
function drawStaff(noteName, octave, ghostNoteName, ghostNoteOctave, ghostModifier, detectedNoteName, detectedNoteOctave) {
	var outputDiv = document.getElementById("staff-output");
	if (!outputDiv) return null;

	outputDiv.innerHTML = "";

	var VF = Vex.Flow;
	var instrument = document.getElementById("instrument").value;
	var clef = getCurrentClef();

	// Create renderer
	var renderer = new VF.Renderer(outputDiv, VF.Renderer.Backends.SVG);
	renderer.resize(STAFF_WIDTH, STAFF_HEIGHT);
	var context = renderer.getContext();

	// Set viewBox for scaling
	var svgElement = outputDiv.querySelector("svg");
	if (svgElement) {
		svgElement.setAttribute("viewBox", "0 0 " + STAFF_WIDTH + " " + STAFF_HEIGHT);
		svgElement.setAttribute("preserveAspectRatio", "xMidYMid meet");
		svgElement.style.width = "100%";
		svgElement.style.height = "100%";
	}

	// Create stave
	var staveWidth = STAFF_WIDTH - 30;
	var stave = new VF.Stave(STAFF_X, STAFF_Y, staveWidth);
	stave.addClef(clef);
	stave.setContext(context).draw();

	// Capture actual staff positions for accurate mouse-to-note mapping
	staffTopLineY = stave.getYForLine(0);
	staffHalfSpacing = (stave.getYForLine(1) - stave.getYForLine(0)) / 2;
	staffNoteStartX = stave.getNoteStartX();
	staffNoteEndX = stave.getNoteEndX();

	// Helper function to render notes (handles enharmonic display)
	function renderNotes(noteName, noteOctave, isGhost, modifier) {
		try {
			var notes = [];
			var hasEnharmonic = enharmonicMap[noteName];

			if (isGhost && modifier) {
				// Ghost note with explicit accidental - render single note
				var baseNote = noteName.charAt(0).toLowerCase();
				var accidental = modifier === "sharp" ? "#" : "b";
				var noteKey = baseNote + accidental + "/" + noteOctave;
				var note = new VF.StaveNote({
					clef: clef,
					keys: [noteKey],
					duration: "w"
				});
				note.addAccidental(0, new VF.Accidental(accidental));
				note.setStyle({ fillStyle: "rgba(0, 128, 0, 0.4)", strokeStyle: "rgba(0, 128, 0, 0.4)" });
				notes.push(note);
			} else if (hasEnharmonic) {
				// Render both sharp and flat versions as half notes
				var flatName = enharmonicMap[noteName];

				// Sharp note
				var sharpKey = noteName.toLowerCase() + "/" + noteOctave;
				var sharpNote = new VF.StaveNote({
					clef: clef,
					keys: [sharpKey],
					duration: "h"
				});
				sharpNote.addAccidental(0, new VF.Accidental("#"));
				if (isGhost) {
					sharpNote.setStyle({ fillStyle: "rgba(0, 128, 0, 0.4)", strokeStyle: "rgba(0, 128, 0, 0.4)" });
				}
				notes.push(sharpNote);

				// Flat note
				var flatBase = flatName.replace("b", "").toLowerCase();
				var flatKey = flatBase + "b/" + noteOctave;
				var flatNote = new VF.StaveNote({
					clef: clef,
					keys: [flatKey],
					duration: "h"
				});
				flatNote.addAccidental(0, new VF.Accidental("b"));
				if (isGhost) {
					flatNote.setStyle({ fillStyle: "rgba(0, 128, 0, 0.4)", strokeStyle: "rgba(0, 128, 0, 0.4)" });
				}
				notes.push(flatNote);
			} else {
				// Single note (natural or accidental without enharmonic entry)
				var vexNote = noteName.toLowerCase();
				var noteKey = vexNote + "/" + noteOctave;
				var note = new VF.StaveNote({
					clef: clef,
					keys: [noteKey],
					duration: "w"
				});
				// Add accidental if present in note name
				if (noteName.includes("#")) {
					note.addAccidental(0, new VF.Accidental("#"));
				} else if (noteName.length > 1 && noteName.endsWith("b")) {
					note.addAccidental(0, new VF.Accidental("b"));
				}
				if (isGhost) {
					note.setStyle({ fillStyle: "rgba(0, 128, 0, 0.4)", strokeStyle: "rgba(0, 128, 0, 0.4)" });
				}
				notes.push(note);
			}

			var voice = new VF.Voice({
				num_beats: 4,
				beat_value: 4
			}).setStrict(false);
			voice.addTickables(notes);

			new VF.Formatter().joinVoices([voice]).format([voice], staveWidth - 80);
			voice.draw(context, stave);
		} catch (e) {
			console.log("Could not render note:", noteName, noteOctave, e.message);
		}
	}

	// Render the detected note (gray) overlaid on the placed note.
	// Shows both enharmonic spellings as half notes when applicable (mirrors pitch detect page behavior).
	// Drawn first so the placed note renders on top and stays fully visible.
	function renderDetectedGhostNote(detName, detOct) {
		try {
			var grayStyle = { fillStyle: "rgba(140,140,140,0.65)", strokeStyle: "rgba(140,140,140,0.65)" };
			var hasEnharmonic = enharmonicMap[detName];
			var detectedNotes = [];

			if (hasEnharmonic) {
				// Show both enharmonic spellings as gray half notes (same as how placed accidental notes are shown)
				var sharpKey = detName.toLowerCase() + "/" + detOct;
				var sharpNote = new VF.StaveNote({ clef: clef, keys: [sharpKey], duration: "h" });
				sharpNote.addAccidental(0, new VF.Accidental("#"));
				sharpNote.setStyle(grayStyle);
				detectedNotes.push(sharpNote);

				var flatBase = hasEnharmonic.replace("b", "").toLowerCase();
				var flatNote = new VF.StaveNote({ clef: clef, keys: [flatBase + "b/" + detOct], duration: "h" });
				flatNote.addAccidental(0, new VF.Accidental("b"));
				flatNote.setStyle(grayStyle);
				detectedNotes.push(flatNote);
			} else {
				var base = detName.charAt(0).toLowerCase();
				var acc = detName.includes("#") ? "#" : (detName.length > 1 && detName.endsWith("b") ? "b" : "");
				var detVFNote = new VF.StaveNote({ clef: clef, keys: [base + acc + "/" + detOct], duration: "w" });
				if (detName.includes("#")) detVFNote.addAccidental(0, new VF.Accidental("#"));
				else if (detName.length > 1 && detName.endsWith("b")) detVFNote.addAccidental(0, new VF.Accidental("b"));
				detVFNote.setStyle(grayStyle);
				detectedNotes.push(detVFNote);
			}

			var voice = new VF.Voice({ num_beats: 4, beat_value: 4 }).setStrict(false);
			voice.addTickables(detectedNotes);
			new VF.Formatter().joinVoices([voice]).format([voice], staveWidth - 80);
			voice.draw(context, stave);
		} catch (e) {
			console.log("Could not render detected ghost note:", e.message);
		}
	}

	// Render placed (black) and detected (gray) notes side by side for success feedback.
	function renderSuccessNotes(placedName, placedOct, detName, detOct) {
		try {
			var notes = [];

			// Placed note: black half note
			var pBase = placedName.charAt(0).toLowerCase();
			var pAcc = placedName.includes("#") ? "#" : (placedName.length > 1 && placedName.endsWith("b") ? "b" : "");
			var pNote = new VF.StaveNote({ clef: clef, keys: [pBase + pAcc + "/" + placedOct], duration: "h" });
			if (pAcc === "#") pNote.addAccidental(0, new VF.Accidental("#"));
			else if (pAcc === "b") pNote.addAccidental(0, new VF.Accidental("b"));
			notes.push(pNote);

			// Detected note: gray half note (same pitch, confirming success)
			var dBase = detName.charAt(0).toLowerCase();
			var dAcc = detName.includes("#") ? "#" : (detName.length > 1 && detName.endsWith("b") ? "b" : "");
			var dNote = new VF.StaveNote({ clef: clef, keys: [dBase + dAcc + "/" + detOct], duration: "h" });
			if (dAcc === "#") dNote.addAccidental(0, new VF.Accidental("#"));
			else if (dAcc === "b") dNote.addAccidental(0, new VF.Accidental("b"));
			dNote.setStyle({ fillStyle: "rgba(140,140,140,0.65)", strokeStyle: "rgba(140,140,140,0.65)" });
			notes.push(dNote);

			var voice = new VF.Voice({ num_beats: 4, beat_value: 4 }).setStrict(false);
			voice.addTickables(notes);
			new VF.Formatter().joinVoices([voice]).format([voice], staveWidth - 80);
			voice.draw(context, stave);
		} catch (e) {
			console.log("Could not render success notes:", e.message);
		}
	}

	// If we have a placed note to display, render it
	if (noteName && octave !== null) {
		if (isSuccess && detectedNoteName != null && detectedNoteOctave != null) {
			// Success state: show placed (black) and detected (gray) notes side by side
			renderSuccessNotes(noteName, octave, detectedNoteName, detectedNoteOctave);
		} else {
			// Normal state: gray detected note drawn first so placed note renders on top
			if (detectedNoteName != null && detectedNoteOctave != null) {
				renderDetectedGhostNote(detectedNoteName, detectedNoteOctave);
			}
			renderNotes(noteName, octave, false, null);
		}
	}
	// If we have a ghost note (no placed note), render it semi-transparent
	else if (ghostNoteName && ghostNoteOctave !== null) {
		renderNotes(ghostNoteName, ghostNoteOctave, true, ghostModifier);
	}

	// Return stave info for click calculations
	return {
		topY: STAFF_Y,
		lineSpacing: 10,  // VexFlow default
		clef: clef
	};
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
	var instrument = document.getElementById("instrument").value;
	if (!instrument) return;

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

		// Redraw staff with ghost note
		drawStaff(null, null, ghostNote, ghostOctave, null);

		// Update display with ghost note info
		var noteNameElem = document.getElementById("note-name");
		// Show enharmonic equivalent if it exists
		var enharmonic = enharmonicMap[ghostNote];
		if (enharmonic) {
			noteNameElem.textContent = ghostNote + " / " + enharmonic;
		} else {
			noteNameElem.textContent = ghostNote;
		}
		noteNameElem.style.opacity = "0.5";
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

	// Redraw staff without ghost note
	drawStaff(null, null, null, null);

	// Reset display
	var noteNameElem = document.getElementById("note-name");
	noteNameElem.textContent = "-";
	noteNameElem.style.opacity = "1";
}

// Handle click on staff
function handleStaffClick(event) {
	var instrument = document.getElementById("instrument").value;
	if (!instrument) {
		alert("Please select an instrument first");
		return;
	}

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

	// Stop listening if active — user placed a new note
	if (listenActive) {
		stopListening();
	}

	// Update display
	updateNoteDisplay();
	document.getElementById("note-name").style.opacity = "1";

	// Redraw staff with placed note
	drawStaff(currentNote, currentOctave, null, null);

	// Show buttons
	document.getElementById("playButton").style.display = "inline-block";
	document.getElementById("listenButton").style.display = "inline-block";
	document.getElementById("clearButton").style.display = "inline-block";
	document.getElementById("sustainSwitch").style.display = "flex";
	document.getElementById("note-display").classList.add("active");
	document.getElementById("pitchUpButton").classList.add("active");
	document.getElementById("pitchDownButton").classList.add("active");

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

		// Stop listening if active — note changed via arrow key
		if (listenActive) {
			stopListening();
		}

		// Update display and redraw staff
		updateNoteDisplay();
		drawStaff(currentNote, currentOctave, null, null);

		// Update fingering display
		updateFingeringDisplay();

		// If a note was sustaining, seamlessly switch to the new pitch
		if (sustainPlaying) {
			playNote();
		}
	}
}

// Update the note name display
function updateNoteDisplay() {
	var noteNameElem = document.getElementById("note-name");
	var freqElem = document.getElementById("frequency-display");

	if (currentNote && currentOctave !== null) {
		// Check for enharmonic equivalent
		var displayName = currentNote;
		if (enharmonicMap[currentNote]) {
			displayName = currentNote + " / " + enharmonicMap[currentNote];
		}

		noteNameElem.textContent = displayName;
		freqElem.textContent = Math.round(currentFrequency) + " Hz (concert pitch)";
	} else {
		noteNameElem.textContent = "-";
		freqElem.textContent = "";
	}
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

		// Stop listening if active — note changed via pitch button
		if (listenActive) {
			stopListening();
		}

		// Update display and redraw staff
		updateNoteDisplay();
		drawStaff(currentNote, currentOctave, null, null);

		// Update fingering display
		updateFingeringDisplay();

		// If a note was sustaining, seamlessly switch to the new pitch
		if (sustainPlaying) {
			playNote();
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
		}
		// In sustain mode: hold at amplitude indefinitely; stopped via stopNote()
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
		}
		// In sustain mode: hold at breathNoise level; stopped via stopNote()
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
	var playButton = document.getElementById("playButton");
	playButton.textContent = "Play Sound";
	playButton.classList.remove("sustaining");
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
				var playButton = document.getElementById("playButton");
				playButton.textContent = "Stop";
				playButton.classList.add("sustaining");
			} else {
				// Brief visual feedback so the user can see the click registered
				var playButton = document.getElementById("playButton");
				playButton.classList.add("playing-oneshot");
				setTimeout(function() {
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

// Stop the current note
function stopNote() {
	activeAudioNodes.forEach(function(node) {
		try {
			node.disconnect();
			if (node.stop) node.stop();
		} catch (e) {
			// Already stopped or disconnected
		}
	});
	activeAudioNodes = [];
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

// Mic pitch detection animation loop
function updateListenPitch() {
	if (!listenActive) return;

	listenAnalyser.getFloatTimeDomainData(listenBuffer);
	var result = autoCorrelate(listenBuffer, listenAudioContext.sampleRate);

	if (result.frequency > 0 && result.confidence > 0.85) {
		var concertMidi = noteFromPitch(result.frequency);
		// Convert concert pitch to written pitch for this instrument
		var transposition = getTransposition();
		var writtenMidi = concertMidi + transposition;
		// Clamp to reasonable range
		writtenMidi = Math.max(24, Math.min(96, writtenMidi));

		if (writtenMidi !== detectedMidi) {
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

			drawStaff(currentNote, currentOctave, null, null, null, detectedNote, detectedOctave);
		}
	} else {
		// No clear pitch detected — clear the detected note display
		if (detectedMidi !== null) {
			detectedMidi = null;
			detectedNote = null;
			detectedOctave = null;
			isSuccess = false;
			drawStaff(currentNote, currentOctave, null, null, null, null, null);
		}
	}

	listenRafID = requestAnimationFrame(updateListenPitch);
}

// Start listening to the microphone
function startListening() {
	if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
		alert("Microphone access is not supported in this browser.");
		return;
	}

	navigator.mediaDevices.getUserMedia({
		audio: {
			echoCancellation: false,
			autoGainControl: false,
			noiseSuppression: false
		}
	}).then(function(stream) {
		listenStream = stream;
		listenAudioContext = new (window.AudioContext || window.webkitAudioContext)();
		var source = listenAudioContext.createMediaStreamSource(stream);
		listenAnalyser = listenAudioContext.createAnalyser();
		listenAnalyser.fftSize = 4096;
		source.connect(listenAnalyser);
		listenBuffer = new Float32Array(listenAnalyser.fftSize);

		listenActive = true;
		updateListenPitch();

		var listenButton = document.getElementById("listenButton");
		listenButton.textContent = "Stop Listening";
		listenButton.classList.add("listening");
	}).catch(function(err) {
		console.error("Microphone access error:", err);
		alert("Could not access microphone. Please allow microphone access and try again.");
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

	// Clear any active fireworks animation
	if (fireworksAnimID) {
		cancelAnimationFrame(fireworksAnimID);
		fireworksAnimID = null;
	}
	var fireworksCanvas = document.getElementById("fireworks-canvas");
	if (fireworksCanvas) {
		fireworksCanvas.getContext("2d").clearRect(0, 0, fireworksCanvas.width, fireworksCanvas.height);
	}

	// Redraw staff without detected note
	if (currentNote && currentOctave !== null) {
		drawStaff(currentNote, currentOctave, null, null, null, null, null);
	}

	var listenButton = document.getElementById("listenButton");
	if (listenButton) {
		listenButton.textContent = "Listen to me";
		listenButton.classList.remove("listening");
	}
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

	// Check if this instrument has fingering data
	if (!hasFingeringData(instrument) || currentMidi === null) {
		fingeringContainer.classList.remove("active");
		return;
	}

	// Show the fingering container
	fingeringContainer.classList.add("active");

	// Display the fingering
	var hasAlternates = displayFingering(fingeringDisplay, instrument, currentMidi, showingAlternates);

	// Show/hide alternate button based on whether alternates exist
	if (hasAlternates) {
		alternateButton.style.display = "inline-block";
		alternateButton.textContent = showingAlternates ? "Hide Alternate Fingerings" : "Show Alternate Fingerings";
		if (showingAlternates) {
			alternateButton.classList.add("active");
		} else {
			alternateButton.classList.remove("active");
		}
	} else {
		alternateButton.style.display = "none";
	}
}

// Toggle alternate fingerings display
function toggleAlternateFingerings() {
	showingAlternates = !showingAlternates;
	updateFingeringDisplay();
}

// Clear the current note
function clearNote() {
	stopNote();
	sustainPlaying = false;

	// Stop listening if active
	if (listenActive) {
		stopListening();
	}

	currentNote = null;
	currentOctave = null;
	currentFrequency = null;
	currentMidi = null;
	ghostNote = null;
	ghostOctave = null;
	ghostMidi = null;
	showingAlternates = false;

	updateNoteDisplay();
	drawStaff(null, null, null, null);

	var playButton = document.getElementById("playButton");
	playButton.textContent = "Play Sound";
	playButton.classList.remove("sustaining");
	playButton.style.display = "none";
	document.getElementById("listenButton").style.display = "none";
	document.getElementById("clearButton").style.display = "none";
	document.getElementById("sustainSwitch").style.display = "none";
	document.getElementById("note-display").classList.remove("active");
	document.getElementById("fingering-container").classList.remove("active");
	document.getElementById("pitchUpButton").classList.remove("active");
	document.getElementById("pitchDownButton").classList.remove("active");
}

// Initialize
document.addEventListener("DOMContentLoaded", function() {
	// Draw initial empty staff
	var instrument = document.getElementById("instrument");

	instrument.addEventListener("change", function() {
		// Persist selection so the pitch detector page stays in sync
		try { localStorage.setItem('pitchdetect-instrument', instrument.value); } catch(e) {}

		// Show/hide listen button based on instrument selection
		document.getElementById("listenButton").style.display = instrument.value ? "inline-block" : "none";

		// Stop sustaining note if instrument changes
		if (sustainPlaying) {
			stopSustain();
		}

		// Clear any existing note when instrument changes
		ghostNote = null;
		ghostOctave = null;
		showingAlternates = false;

		// Redraw staff with new clef
		if (currentNote && currentOctave !== null) {
			// Recalculate frequency with new transposition
			var midiNote = noteStrings.indexOf(currentNote.replace("#", "").replace("b", ""));
			if (currentNote.includes("#")) midiNote = noteStrings.indexOf(currentNote);
			var fullMidi = midiNote + ((currentOctave + 1) * 12);
			var transposition = getTransposition();
			currentFrequency = frequencyFromNoteNumber(fullMidi - transposition);
			updateNoteDisplay();
			updateFingeringDisplay();
		} else {
			document.getElementById("fingering-container").classList.remove("active");
		}
		drawStaff(currentNote, currentOctave, null, null);
	});

	// Set up event handlers for staff interaction
	var staffContainer = document.getElementById("staff-container");
	staffContainer.addEventListener("click", handleStaffClick);
	staffContainer.addEventListener("mousemove", handleStaffMouseMove);
	staffContainer.addEventListener("mouseleave", handleStaffMouseLeave);

	// Set up keyboard handler for arrow key navigation
	document.addEventListener("keydown", handleKeyDown);

	// Restore instrument saved from the pitch detector page (or a previous session)
	try {
		var saved = localStorage.getItem('pitchdetect-instrument');
		if (saved) {
			instrument.value = saved;
			// Reset if the saved value isn't a valid option in this list
			if (instrument.value !== saved) instrument.value = '';
			if (instrument.value) {
				document.getElementById("listenButton").style.display = "inline-block";
			}
		}
	} catch(e) {}

	// Draw initial staff (uses restored instrument for correct clef)
	drawStaff(null, null, null, null);
});
