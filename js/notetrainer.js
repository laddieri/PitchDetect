/*
 * Note Trainer - Click on staff to identify notes
 */

// Audio context for playing sounds
var audioContext = null;
var currentOscillator = null;

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

// Staff rendering constants
var STAFF_WIDTH = 400;
var STAFF_HEIGHT = 200;
var STAFF_X = 10;
var STAFF_Y = 50;
var LINE_SPACING = 10;  // Space between staff lines in internal coordinates

// Dynamic staff layout values (updated by drawStaff from VexFlow)
var staffTopLineY = null;
var staffHalfSpacing = 5;

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

// Convert click Y position to note using diatonic (staff) mapping
function yPositionToNote(yPos, clef) {
	// The staff uses diatonic spacing (7 notes per octave), not chromatic (12)
	// Each line or space represents one diatonic step

	// Use actual VexFlow rendering positions (set by drawStaff)
	var topLineY = staffTopLineY !== null ? staffTopLineY : 100;
	var halfSpacing = staffHalfSpacing;

	// Calculate staff position (0 = top line, positive = going down)
	var staffPos = Math.round((yPos - topLineY) / halfSpacing);

	// Convert staff position to note name and octave
	var noteName, octave;

	if (clef === "treble") {
		// Treble clef: Top line = F5
		// Notes going down: F, E, D, C, B, A, G (repeating)
		var noteNames = ["F", "E", "D", "C", "B", "A", "G"];
		// Octaves for positions 0-6: F5, E5, D5, C5, B4, A4, G4
		var baseOctaves = [5, 5, 5, 5, 4, 4, 4];

		// Handle the cycling through octaves
		var cyclePos = staffPos >= 0 ? staffPos % 7 : ((staffPos % 7) + 7) % 7;
		var cycleNum = Math.floor(staffPos / 7);

		noteName = noteNames[cyclePos];
		octave = baseOctaves[cyclePos] - cycleNum;
	} else {
		// Bass clef: Top line = A3
		// Notes going down: A, G, F, E, D, C, B (repeating)
		var noteNames = ["A", "G", "F", "E", "D", "C", "B"];
		// Octaves for positions 0-6: A3, G3, F3, E3, D3, C3, B2
		var baseOctaves = [3, 3, 3, 3, 3, 3, 2];

		var cyclePos = staffPos >= 0 ? staffPos % 7 : ((staffPos % 7) + 7) % 7;
		var cycleNum = Math.floor(staffPos / 7);

		noteName = noteNames[cyclePos];
		octave = baseOctaves[cyclePos] - cycleNum;
	}

	// Convert to MIDI
	var noteToSemitone = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11};
	var midi = noteToSemitone[noteName] + (octave + 1) * 12;

	// Clamp to reasonable range
	midi = Math.max(24, Math.min(96, midi));

	return { note: noteName, octave: octave, midi: midi };
}

// Draw the staff with VexFlow
function drawStaff(noteName, octave, ghostNoteName, ghostNoteOctave) {
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

	// Capture actual staff line positions for accurate mouse-to-note mapping
	staffTopLineY = stave.getYForLine(0);
	staffHalfSpacing = (stave.getYForLine(1) - stave.getYForLine(0)) / 2;

	// Helper function to render notes (handles enharmonic display)
	function renderNotes(noteName, noteOctave, isGhost) {
		try {
			var notes = [];
			var hasEnharmonic = enharmonicMap[noteName];

			if (hasEnharmonic) {
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
				// Natural note - single whole note
				var vexNote = noteName.toLowerCase();
				var noteKey = vexNote + "/" + noteOctave;
				var note = new VF.StaveNote({
					clef: clef,
					keys: [noteKey],
					duration: "w"
				});
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

	// If we have a placed note to display, render it
	if (noteName && octave !== null) {
		renderNotes(noteName, octave, false);
	}
	// If we have a ghost note (no placed note), render it semi-transparent
	else if (ghostNoteName && ghostNoteOctave !== null) {
		renderNotes(ghostNoteName, ghostNoteOctave, true);
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
	// Store last mouse event for modifier key updates
	var staffContainer = document.getElementById("staff-container");
	staffContainer._lastMouseEvent = event;

	var instrument = document.getElementById("instrument").value;
	if (!instrument) return;

	// Don't show ghost note if we already have a placed note
	if (currentNote !== null) return;

	var coords = getSvgCoordinates(event);
	if (!coords) return;

	var clef = getCurrentClef();
	var noteInfo = yPositionToNote(coords.y, clef);

	// Check for modifier keys to show sharp/flat
	var modifier = null;
	if (event.shiftKey) {
		modifier = "sharp";
	} else if (event.altKey) {
		modifier = "flat";
	}

	// Apply modifier to get sharp/flat version
	var displayNote = noteInfo.note;
	var displayOctave = noteInfo.octave;
	var displayMidi = noteInfo.midi;

	if (modifier === "sharp") {
		// Move up one half step
		displayMidi = Math.min(96, noteInfo.midi + 1);
		displayNote = noteStrings[displayMidi % 12];
		displayOctave = Math.floor(displayMidi / 12) - 1;
	} else if (modifier === "flat") {
		// Move down one half step
		displayMidi = Math.max(24, noteInfo.midi - 1);
		displayNote = noteStrings[displayMidi % 12];
		displayOctave = Math.floor(displayMidi / 12) - 1;
	}

	// Only update if ghost note changed
	if (displayNote !== ghostNote || displayOctave !== ghostOctave || displayMidi !== ghostMidi) {
		ghostNote = displayNote;
		ghostOctave = displayOctave;
		ghostMidi = displayMidi;

		// Redraw staff with ghost note
		drawStaff(null, null, ghostNote, ghostOctave);

		// Update display with ghost note info (lighter styling handled by CSS)
		var noteNameElem = document.getElementById("note-name");
		var displayName = ghostNote;
		if (enharmonicMap[ghostNote]) {
			displayName = ghostNote + " / " + enharmonicMap[ghostNote];
		}
		noteNameElem.textContent = displayName;
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

	// Check for modifier keys to place sharp/flat
	var placeMidi = noteInfo.midi;
	if (event.shiftKey) {
		placeMidi = Math.min(96, noteInfo.midi + 1);
	} else if (event.altKey) {
		placeMidi = Math.max(24, noteInfo.midi - 1);
	}

	var placeNote = noteStrings[placeMidi % 12];
	var placeOctave = Math.floor(placeMidi / 12) - 1;

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
	document.getElementById("note-name").style.opacity = "1";

	// Redraw staff with placed note
	drawStaff(currentNote, currentOctave, null, null);

	// Show buttons
	document.getElementById("playButton").style.display = "inline-block";
	document.getElementById("clearButton").style.display = "inline-block";
	document.getElementById("note-display").classList.add("active");

	// Update fingering display
	showingAlternates = false;
	updateFingeringDisplay();
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

		// Update display and redraw staff
		updateNoteDisplay();
		drawStaff(currentNote, currentOctave, null, null);

		// Update fingering display
		updateFingeringDisplay();
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

// Play the current note
function playNote() {
	if (!currentFrequency) return;

	// Stop any currently playing note
	stopNote();

	// Create audio context if needed
	if (!audioContext) {
		audioContext = new (window.AudioContext || window.webkitAudioContext)();
	}

	// Resume if suspended (browser autoplay policy)
	if (audioContext.state === "suspended") {
		audioContext.resume();
	}

	// Create oscillator
	currentOscillator = audioContext.createOscillator();
	var gainNode = audioContext.createGain();

	currentOscillator.type = "sine";
	currentOscillator.frequency.setValueAtTime(currentFrequency, audioContext.currentTime);

	// Envelope for smoother sound
	gainNode.gain.setValueAtTime(0, audioContext.currentTime);
	gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1);
	gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.3);
	gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 1.5);

	currentOscillator.connect(gainNode);
	gainNode.connect(audioContext.destination);

	currentOscillator.start(audioContext.currentTime);
	currentOscillator.stop(audioContext.currentTime + 1.5);

	currentOscillator.onended = function() {
		currentOscillator = null;
	};
}

// Stop the current note
function stopNote() {
	if (currentOscillator) {
		try {
			currentOscillator.stop();
		} catch (e) {
			// Already stopped
		}
		currentOscillator = null;
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

	document.getElementById("playButton").style.display = "none";
	document.getElementById("clearButton").style.display = "none";
	document.getElementById("note-display").classList.remove("active");
	document.getElementById("fingering-container").classList.remove("active");
}

// Initialize
document.addEventListener("DOMContentLoaded", function() {
	// Draw initial empty staff
	var instrument = document.getElementById("instrument");

	instrument.addEventListener("change", function() {
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

	// Set up keyboard handlers for modifier keys (shift/alt for sharp/flat ghost notes)
	document.addEventListener("keydown", handleModifierKey);
	document.addEventListener("keyup", handleModifierKey);

	// Draw initial staff (empty, treble clef)
	drawStaff(null, null, null, null);
});

// Handle modifier key press/release to update ghost note
function handleModifierKey(event) {
	// Only care about shift and alt
	if (event.key !== "Shift" && event.key !== "Alt") return;

	// Don't update if we have a placed note
	if (currentNote !== null) return;

	// Trigger a fake mousemove to update the ghost note
	var staffContainer = document.getElementById("staff-container");
	var lastMouseEvent = staffContainer._lastMouseEvent;
	if (lastMouseEvent) {
		handleStaffMouseMove(lastMouseEvent);
	}
}
