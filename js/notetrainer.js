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
function yPositionToNote(yPos, clef, staveTopY, lineSpacing) {
	// Calculate position relative to middle line
	// Staff has 5 lines, middle line is the 3rd line
	var middleLineY = staveTopY + (2 * lineSpacing);

	// Each half-lineSpacing is one note step
	var halfSpacing = lineSpacing / 2;
	var stepsFromMiddle = Math.round((middleLineY - yPos) / halfSpacing);

	// Convert steps to note
	if (clef === "treble") {
		// Middle line is B4
		// Steps: B4=0, C5=1, D5=2, etc. (going up)
		// Steps: A4=-1, G4=-2, etc. (going down)
		var midiNote = 71 + stepsFromMiddle;  // B4 = MIDI 71
	} else {
		// Bass clef: middle line is D3
		var midiNote = 50 + stepsFromMiddle;  // D3 = MIDI 50
	}

	// Clamp to reasonable range
	midiNote = Math.max(24, Math.min(96, midiNote));

	var noteName = noteStrings[midiNote % 12];
	var octave = Math.floor(midiNote / 12) - 1;

	return { note: noteName, octave: octave, midi: midiNote };
}

// Draw the staff with VexFlow
function drawStaff(noteName, octave) {
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

	// If we have a note to display, render it
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

	// Return stave info for click calculations
	return {
		topY: STAFF_Y,
		lineSpacing: 10,  // VexFlow default
		clef: clef
	};
}

// Handle click on staff
function handleStaffClick(event) {
	var instrument = document.getElementById("instrument").value;
	if (!instrument) {
		alert("Please select an instrument first");
		return;
	}

	var container = document.getElementById("staff-container");
	var outputDiv = document.getElementById("staff-output");
	var svgElement = outputDiv.querySelector("svg");

	if (!svgElement) return;

	// Get click position relative to SVG
	var rect = svgElement.getBoundingClientRect();
	var clickX = event.clientX - rect.left;
	var clickY = event.clientY - rect.top;

	// Convert to SVG coordinates (accounting for viewBox scaling)
	var scaleX = STAFF_WIDTH / rect.width;
	var scaleY = STAFF_HEIGHT / rect.height;
	var svgX = clickX * scaleX;
	var svgY = clickY * scaleY;

	// Get current clef
	var clef = getCurrentClef();

	// Convert Y position to note (using VexFlow's coordinate system)
	// VexFlow staff: top line at STAFF_Y, lines are 10 units apart
	var staveTopY = STAFF_Y;
	var lineSpacing = 10;

	var noteInfo = yPositionToNote(svgY, clef, staveTopY, lineSpacing);

	// Apply transposition (convert written pitch to concert pitch for frequency)
	var transposition = getTransposition();
	var concertMidi = noteInfo.midi - transposition;
	var frequency = frequencyFromNoteNumber(concertMidi);

	// Store current note (written pitch)
	currentNote = noteInfo.note;
	currentOctave = noteInfo.octave;
	currentFrequency = frequency;

	// Update display
	updateNoteDisplay();

	// Redraw staff with note
	drawStaff(currentNote, currentOctave);

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

	updateNoteDisplay();
	drawStaff(null, null);

	document.getElementById("playButton").style.display = "none";
	document.getElementById("clearButton").style.display = "none";
	document.getElementById("note-display").classList.remove("active");
}

// Initialize
document.addEventListener("DOMContentLoaded", function() {
	// Draw initial empty staff
	var instrument = document.getElementById("instrument");

	instrument.addEventListener("change", function() {
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
		drawStaff(currentNote, currentOctave);
	});

	// Set up click handler
	var staffContainer = document.getElementById("staff-container");
	staffContainer.addEventListener("click", handleStaffClick);

	// Draw initial staff (empty, treble clef)
	drawStaff(null, null);
});
