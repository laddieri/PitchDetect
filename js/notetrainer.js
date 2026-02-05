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

// Ghost note state (follows mouse)
var ghostNote = null;
var ghostOctave = null;

// Staff rendering constants
var STAFF_WIDTH = 400;
var STAFF_HEIGHT = 200;
var STAFF_X = 10;
var STAFF_Y = 50;
var LINE_SPACING = 10;  // Space between staff lines in internal coordinates

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

// Convert click Y position to note
function yPositionToNote(yPos, clef) {
	// VexFlow stave positioning:
	// - STAFF_Y is the top of the stave bounding box
	// - VexFlow adds 4 line-spacings of headroom above the top line
	// - Line spacing is 10 units by default
	var lineSpacing = 10;
	var headroom = 4;  // VexFlow's default space_above_staff_ln

	// Calculate the actual Y position of the top line (line 0)
	var topLineY = STAFF_Y + (headroom * lineSpacing);

	// Each half-lineSpacing is one note step (line or space)
	var halfSpacing = lineSpacing / 2;

	// Calculate steps from top line (positive = below top line)
	var stepsFromTopLine = Math.round((yPos - topLineY) / halfSpacing);

	// Convert steps to MIDI note
	// Treble clef: top line (line 0) = F5 (MIDI 77)
	// Bass clef: top line (line 0) = A3 (MIDI 57)
	var midiNote;
	if (clef === "treble") {
		// Top line is F5 (MIDI 77), going down = lower notes
		midiNote = 77 - stepsFromTopLine;
	} else {
		// Bass clef: top line is A3 (MIDI 57)
		midiNote = 57 - stepsFromTopLine;
	}

	// Clamp to reasonable range
	midiNote = Math.max(24, Math.min(96, midiNote));

	var noteName = noteStrings[midiNote % 12];
	var octave = Math.floor(midiNote / 12) - 1;

	return { note: noteName, octave: octave, midi: midiNote };
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

	// If we have a placed note to display, render it
	if (noteName && octave !== null) {
		try {
			var vexNote = noteName.toLowerCase();
			var noteKey = vexNote + "/" + octave;

			var note = new VF.StaveNote({
				clef: clef,
				keys: [noteKey],
				duration: "w"
			});

			// Add accidental if needed
			if (noteName.includes("#")) {
				note.addAccidental(0, new VF.Accidental("#"));
			} else if (noteName.includes("b")) {
				note.addAccidental(0, new VF.Accidental("b"));
			}

			var voice = new VF.Voice({
				num_beats: 4,
				beat_value: 4
			}).setStrict(false);
			voice.addTickables([note]);

			new VF.Formatter().joinVoices([voice]).format([voice], staveWidth - 80);
			voice.draw(context, stave);
		} catch (e) {
			console.log("Could not render note:", noteKey, e.message);
		}
	}
	// If we have a ghost note (no placed note), render it semi-transparent
	else if (ghostNoteName && ghostNoteOctave !== null) {
		try {
			var vexNote = ghostNoteName.toLowerCase();
			var noteKey = vexNote + "/" + ghostNoteOctave;

			var note = new VF.StaveNote({
				clef: clef,
				keys: [noteKey],
				duration: "w"
			});

			// Add accidental if needed
			if (ghostNoteName.includes("#")) {
				note.addAccidental(0, new VF.Accidental("#"));
			} else if (ghostNoteName.includes("b")) {
				note.addAccidental(0, new VF.Accidental("b"));
			}

			// Set style for ghost note (semi-transparent)
			note.setStyle({ fillStyle: "rgba(0, 128, 0, 0.4)", strokeStyle: "rgba(0, 128, 0, 0.4)" });

			var voice = new VF.Voice({
				num_beats: 4,
				beat_value: 4
			}).setStrict(false);
			voice.addTickables([note]);

			new VF.Formatter().joinVoices([voice]).format([voice], staveWidth - 80);
			voice.draw(context, stave);
		} catch (e) {
			console.log("Could not render ghost note:", noteKey, e.message);
		}
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

	// Only update if ghost note changed
	if (noteInfo.note !== ghostNote || noteInfo.octave !== ghostOctave) {
		ghostNote = noteInfo.note;
		ghostOctave = noteInfo.octave;

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
	if (currentNote !== null) return;  // Don't clear if we have a placed note

	ghostNote = null;
	ghostOctave = null;

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

	// Apply transposition (convert written pitch to concert pitch for frequency)
	var transposition = getTransposition();
	var concertMidi = noteInfo.midi - transposition;
	var frequency = frequencyFromNoteNumber(concertMidi);

	// Store current note (written pitch)
	currentNote = noteInfo.note;
	currentOctave = noteInfo.octave;
	currentFrequency = frequency;

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

// Clear the current note
function clearNote() {
	stopNote();

	currentNote = null;
	currentOctave = null;
	currentFrequency = null;
	ghostNote = null;
	ghostOctave = null;

	updateNoteDisplay();
	drawStaff(null, null, null, null);

	document.getElementById("playButton").style.display = "none";
	document.getElementById("clearButton").style.display = "none";
	document.getElementById("note-display").classList.remove("active");
}

// Initialize
document.addEventListener("DOMContentLoaded", function() {
	// Draw initial empty staff
	var instrument = document.getElementById("instrument");

	instrument.addEventListener("change", function() {
		// Clear any existing note when instrument changes
		ghostNote = null;
		ghostOctave = null;

		// Redraw staff with new clef
		if (currentNote && currentOctave !== null) {
			// Recalculate frequency with new transposition
			var midiNote = noteStrings.indexOf(currentNote.replace("#", "").replace("b", ""));
			if (currentNote.includes("#")) midiNote = noteStrings.indexOf(currentNote);
			var fullMidi = midiNote + ((currentOctave + 1) * 12);
			var transposition = getTransposition();
			currentFrequency = frequencyFromNoteNumber(fullMidi - transposition);
			updateNoteDisplay();
		}
		drawStaff(currentNote, currentOctave, null, null);
	});

	// Set up event handlers for staff interaction
	var staffContainer = document.getElementById("staff-container");
	staffContainer.addEventListener("click", handleStaffClick);
	staffContainer.addEventListener("mousemove", handleStaffMouseMove);
	staffContainer.addEventListener("mouseleave", handleStaffMouseLeave);

	// Draw initial staff (empty, treble clef)
	drawStaff(null, null, null, null);
});
