/*
 * Fingering Charts for Note Trainer
 * Contains fingering data and SVG diagram rendering for instruments
 */

// ============================================================================
// TRUMPET FINGERINGS
// ============================================================================
// Trumpet has 3 valves. Fingerings stored as arrays: [1, 2, 3] means all pressed
// Written pitch (trumpet in Bb) - MIDI note numbers
var trumpetFingerings = {
	// Low register (written)
	52: { primary: [], alternates: [] },           // E3 - open
	53: { primary: [1, 2], alternates: [] },       // F3
	54: { primary: [1, 2, 3], alternates: [] },    // F#3
	55: { primary: [1, 3], alternates: [] },       // G3
	56: { primary: [2, 3], alternates: [] },       // G#3
	57: { primary: [1, 2], alternates: [] },       // A3
	58: { primary: [1], alternates: [] },          // A#3
	59: { primary: [2], alternates: [] },          // B3

	// Middle register
	60: { primary: [], alternates: [] },           // C4 - open
	61: { primary: [1, 2, 3], alternates: [] },    // C#4
	62: { primary: [1, 3], alternates: [] },       // D4
	63: { primary: [2, 3], alternates: [] },       // D#4
	64: { primary: [1, 2], alternates: [] },       // E4
	65: { primary: [1], alternates: [] },          // F4
	66: { primary: [2], alternates: [] },          // F#4
	67: { primary: [], alternates: [] },           // G4 - open
	68: { primary: [2, 3], alternates: [] },       // G#4
	69: { primary: [1, 2], alternates: [] },       // A4
	70: { primary: [1], alternates: [] },          // A#4
	71: { primary: [2], alternates: [] },          // B4

	// Upper register
	72: { primary: [], alternates: [] },           // C5 - open
	73: { primary: [1, 2], alternates: [] },       // C#5
	74: { primary: [1], alternates: [] },          // D5
	75: { primary: [], alternates: [] },           // D#5 - open
	76: { primary: [1, 2], alternates: [] },       // E5
	77: { primary: [1], alternates: [] },          // F5
	78: { primary: [2], alternates: [] },          // F#5
	79: { primary: [], alternates: [] },           // G5 - open
	80: { primary: [2, 3], alternates: [] },       // G#5
	81: { primary: [1, 2], alternates: [] },       // A5
	82: { primary: [1], alternates: [] },          // A#5
	83: { primary: [2], alternates: [] },          // B5
	84: { primary: [], alternates: [] },           // C6 - open
};

// ============================================================================
// FLUTE FINGERINGS
// ============================================================================
// Flute fingering representation:
// LT = Left Thumb - two keys: B-natural and Bb
// L1, L2, L3 = Left hand fingers 1, 2, 3
// RT = Right Thumb (support, not a key)
// R1, R2, R3, R4 = Right hand fingers
// Keys: Gsharp, Dsharp, Dnatural, Csharp, C, B
// Format: { left: [Bnat_thumb, Bb_thumb, 1, 2, 3], right: [1, 2, 3, 4], foot: [Dsharp, Dnat, Csharp, C, B] }
// 1 = pressed, 0 = open

var fluteFingerings = {
	// Low register (first octave)
	60: { // C4 (middle C)
		primary: { left: [0, 0, 1, 1, 1], right: [1, 1, 1, 0], foot: [0, 0, 1, 1, 0] },
		alternates: []
	},
	61: { // C#4
		primary: { left: [0, 0, 1, 1, 1], right: [1, 1, 1, 0], foot: [0, 0, 1, 0, 0] },
		alternates: []
	},
	62: { // D4
		primary: { left: [0, 0, 1, 1, 1], right: [1, 1, 1, 0], foot: [0, 0, 0, 0, 0] },
		alternates: []
	},
	63: { // D#4
		primary: { left: [0, 0, 1, 1, 1], right: [1, 1, 1, 0], foot: [1, 0, 0, 0, 0] },
		alternates: [{ left: [0, 0, 1, 1, 1], right: [1, 1, 0, 1], foot: [0, 0, 0, 0, 0] }]
	},
	64: { // E4
		primary: { left: [0, 0, 1, 1, 1], right: [1, 1, 0, 0], foot: [0, 0, 0, 0, 0] },
		alternates: []
	},
	65: { // F4
		primary: { left: [0, 0, 1, 1, 1], right: [1, 0, 0, 0], foot: [0, 0, 0, 0, 0] },
		alternates: []
	},
	66: { // F#4
		primary: { left: [0, 0, 1, 1, 1], right: [0, 1, 1, 0], foot: [0, 0, 0, 0, 0] },
		alternates: [{ left: [0, 0, 1, 1, 1], right: [0, 0, 1, 0], foot: [0, 0, 0, 0, 0] }]
	},
	67: { // G4
		primary: { left: [0, 0, 1, 1, 1], right: [0, 0, 0, 0], foot: [0, 0, 0, 0, 0] },
		alternates: []
	},
	68: { // G#4
		primary: { left: [0, 0, 1, 1, 0], right: [0, 0, 0, 1], foot: [0, 0, 0, 0, 0] },
		alternates: []
	},
	69: { // A4
		primary: { left: [0, 0, 1, 1, 0], right: [0, 0, 0, 0], foot: [0, 0, 0, 0, 0] },
		alternates: []
	},
	70: { // A#4 / Bb4
		primary: { left: [0, 1, 1, 0, 0], right: [0, 0, 0, 0], foot: [0, 0, 0, 0, 0] },
		alternates: [
			{ left: [0, 0, 1, 0, 0], right: [1, 0, 0, 0], foot: [0, 0, 0, 0, 0] },
			{ left: [1, 0, 1, 1, 0], right: [0, 0, 0, 0], foot: [0, 0, 0, 0, 0] }
		]
	},
	71: { // B4
		primary: { left: [1, 0, 1, 0, 0], right: [0, 0, 0, 0], foot: [0, 0, 0, 0, 0] },
		alternates: []
	},

	// Second octave (same fingerings, different embouchure)
	72: { // C5
		primary: { left: [0, 0, 0, 1, 0], right: [0, 0, 0, 0], foot: [0, 0, 0, 0, 0] },
		alternates: [{ left: [1, 0, 1, 0, 0], right: [0, 0, 0, 0], foot: [0, 0, 0, 0, 0] }]
	},
	73: { // C#5
		primary: { left: [0, 0, 0, 0, 0], right: [0, 0, 0, 0], foot: [0, 0, 0, 0, 0] },
		alternates: []
	},
	74: { // D5
		primary: { left: [0, 0, 1, 1, 1], right: [1, 1, 1, 0], foot: [0, 0, 0, 0, 0] },
		alternates: []
	},
	75: { // D#5
		primary: { left: [0, 0, 1, 1, 1], right: [1, 1, 1, 0], foot: [1, 0, 0, 0, 0] },
		alternates: [{ left: [0, 0, 1, 1, 1], right: [1, 1, 0, 1], foot: [0, 0, 0, 0, 0] }]
	},
	76: { // E5
		primary: { left: [0, 0, 1, 1, 1], right: [1, 1, 0, 0], foot: [0, 0, 0, 0, 0] },
		alternates: []
	},
	77: { // F5
		primary: { left: [0, 0, 1, 1, 1], right: [1, 0, 0, 0], foot: [0, 0, 0, 0, 0] },
		alternates: []
	},
	78: { // F#5
		primary: { left: [0, 0, 1, 1, 1], right: [0, 1, 1, 0], foot: [0, 0, 0, 0, 0] },
		alternates: [{ left: [0, 0, 1, 1, 1], right: [0, 0, 1, 0], foot: [0, 0, 0, 0, 0] }]
	},
	79: { // G5
		primary: { left: [0, 0, 1, 1, 1], right: [0, 0, 0, 0], foot: [0, 0, 0, 0, 0] },
		alternates: []
	},
	80: { // G#5
		primary: { left: [0, 0, 1, 1, 0], right: [0, 0, 0, 1], foot: [0, 0, 0, 0, 0] },
		alternates: []
	},
	81: { // A5
		primary: { left: [0, 0, 1, 1, 0], right: [0, 0, 0, 0], foot: [0, 0, 0, 0, 0] },
		alternates: []
	},
	82: { // A#5 / Bb5
		primary: { left: [0, 1, 1, 0, 0], right: [0, 0, 0, 0], foot: [0, 0, 0, 0, 0] },
		alternates: [{ left: [1, 0, 1, 1, 0], right: [0, 0, 0, 0], foot: [0, 0, 0, 0, 0] }]
	},
	83: { // B5
		primary: { left: [1, 0, 1, 0, 0], right: [0, 0, 0, 0], foot: [0, 0, 0, 0, 0] },
		alternates: []
	},

	// Third octave
	84: { // C6
		primary: { left: [0, 0, 0, 1, 0], right: [0, 0, 0, 0], foot: [0, 0, 0, 0, 0] },
		alternates: []
	},
	85: { // C#6
		primary: { left: [0, 0, 0, 0, 0], right: [0, 0, 0, 0], foot: [0, 0, 0, 0, 0] },
		alternates: []
	},
	86: { // D6
		primary: { left: [0, 0, 1, 1, 1], right: [1, 1, 0, 0], foot: [0, 0, 0, 0, 0] },
		alternates: []
	},
	87: { // D#6
		primary: { left: [0, 0, 1, 1, 1], right: [1, 0, 1, 0], foot: [0, 0, 0, 0, 0] },
		alternates: []
	},
	88: { // E6
		primary: { left: [0, 0, 1, 1, 1], right: [0, 1, 0, 0], foot: [0, 0, 0, 0, 0] },
		alternates: []
	},
	89: { // F6
		primary: { left: [0, 0, 1, 1, 0], right: [1, 1, 0, 0], foot: [0, 0, 0, 0, 0] },
		alternates: []
	},
	90: { // F#6
		primary: { left: [0, 0, 1, 1, 0], right: [0, 1, 1, 0], foot: [0, 0, 0, 0, 0] },
		alternates: []
	},
	91: { // G6
		primary: { left: [0, 0, 1, 1, 0], right: [0, 0, 1, 0], foot: [0, 0, 0, 0, 0] },
		alternates: []
	},
	92: { // G#6
		primary: { left: [0, 0, 1, 1, 0], right: [0, 0, 0, 1], foot: [0, 0, 0, 0, 0] },
		alternates: []
	},
	93: { // A6
		primary: { left: [0, 0, 1, 0, 1], right: [1, 1, 0, 0], foot: [0, 0, 0, 0, 0] },
		alternates: []
	},
	94: { // A#6
		primary: { left: [0, 0, 1, 0, 1], right: [0, 1, 0, 0], foot: [0, 0, 0, 0, 0] },
		alternates: []
	},
	95: { // B6
		primary: { left: [0, 0, 1, 0, 0], right: [1, 0, 0, 0], foot: [0, 0, 0, 0, 0] },
		alternates: []
	},
	96: { // C7
		primary: { left: [0, 0, 0, 1, 0], right: [1, 1, 0, 0], foot: [0, 0, 0, 0, 0] },
		alternates: []
	}
};

// ============================================================================
// IMAGE-BASED FINGERING DISPLAY
// ============================================================================

// Map of instruments to their fingering image folders.
// transposition: semitones to subtract from the written MIDI note to get the
// image filename index.
//   0  = use written pitch directly (C instruments & clarinet written pitch)
//   9  = alto sax (written - 9 = concert pitch, which the images are indexed by)
//   14 = tenor sax
//   21 = bari sax
var imageFingeringMap = {
	"bassoon":   { folder: "Bassoon",   ext: "png", transposition: 0  },
	"clarinet":  { folder: "Clarinet",  ext: "png", transposition: 0  },
	"flute":     { folder: "Flute",     ext: "png", transposition: 0  },
	"oboe":      { folder: "Oboe",      ext: "png", transposition: 0  },
	"alto sax":  { folder: "Saxophone", ext: "png", transposition: 9  },
	"tenor sax": { folder: "Saxophone", ext: "png", transposition: 14 },
	"bari sax":  { folder: "Saxophone", ext: "png", transposition: 21 },
	"trombone":  { folder: "Trombone",  ext: "gif", transposition: 0  }
};

// Display fingering using an image file from img/Fingerings/
function displayImageFingering(container, instrument, writtenMidi) {
	var info = imageFingeringMap[instrument];
	var imageMidi = writtenMidi - info.transposition;
	var imgPath = "img/Fingerings/" + info.folder + "/" + imageMidi + "." + info.ext;

	var img = document.createElement("img");
	img.alt = "Fingering diagram";
	img.style.maxWidth = "100%";
	img.style.maxHeight = "280px";
	img.style.display = "block";
	img.style.margin = "0 auto";

	img.onerror = function() {
		container.innerHTML = '<div style="text-align:center;color:#999;padding:20px;">No fingering image available for this note</div>';
	};

	// Set src after attaching onerror so the handler is guaranteed to fire
	img.src = imgPath;
	container.appendChild(img);

	return false;  // No alternate fingerings for image-based instruments
}

// ============================================================================
// SVG DIAGRAM RENDERING
// ============================================================================

// Draw trumpet valve diagram
function drawTrumpetFingering(container, valves, isAlternate) {
	var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("viewBox", "0 0 200 120");
	svg.setAttribute("width", "200");
	svg.setAttribute("height", "120");
	svg.style.display = "block";
	svg.style.margin = "0 auto";

	if (isAlternate) {
		svg.style.opacity = "0.7";
	}

	// Colors
	var pressedColor = "#2196F3";  // Blue for pressed
	var openColor = "#fff";         // White for open
	var strokeColor = "#333";

	// Draw three valves
	var valveX = [50, 100, 150];
	var valveY = 50;
	var valveRadius = 25;

	for (var i = 0; i < 3; i++) {
		var isPressed = valves.includes(i + 1);

		// Valve casing (outer circle)
		var casing = document.createElementNS("http://www.w3.org/2000/svg", "circle");
		casing.setAttribute("cx", valveX[i]);
		casing.setAttribute("cy", valveY);
		casing.setAttribute("r", valveRadius);
		casing.setAttribute("fill", isPressed ? pressedColor : openColor);
		casing.setAttribute("stroke", strokeColor);
		casing.setAttribute("stroke-width", "3");
		svg.appendChild(casing);

		// Valve number
		var text = document.createElementNS("http://www.w3.org/2000/svg", "text");
		text.setAttribute("x", valveX[i]);
		text.setAttribute("y", valveY + 6);
		text.setAttribute("text-anchor", "middle");
		text.setAttribute("font-size", "20");
		text.setAttribute("font-weight", "bold");
		text.setAttribute("fill", isPressed ? "#fff" : "#333");
		text.textContent = (i + 1).toString();
		svg.appendChild(text);
	}

	// Label
	var label = document.createElementNS("http://www.w3.org/2000/svg", "text");
	label.setAttribute("x", "100");
	label.setAttribute("y", "105");
	label.setAttribute("text-anchor", "middle");
	label.setAttribute("font-size", "14");
	label.setAttribute("fill", "#666");
	if (valves.length === 0) {
		label.textContent = "Open (no valves)";
	} else {
		label.textContent = "Valves: " + valves.join("-");
	}
	svg.appendChild(label);

	container.appendChild(svg);
}

// Draw flute fingering diagram
function drawFluteFingering(container, fingering, isAlternate) {
	var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("viewBox", "0 0 320 140");
	svg.setAttribute("width", "320");
	svg.setAttribute("height", "140");
	svg.style.display = "block";
	svg.style.margin = "0 auto";

	if (isAlternate) {
		svg.style.opacity = "0.7";
	}

	// Colors
	var pressedColor = "#2196F3";
	var openColor = "#fff";
	var strokeColor = "#333";
	var bodyColor = "#e0e0e0";

	// Draw flute body (simplified)
	var body = document.createElementNS("http://www.w3.org/2000/svg", "rect");
	body.setAttribute("x", "10");
	body.setAttribute("y", "40");
	body.setAttribute("width", "300");
	body.setAttribute("height", "30");
	body.setAttribute("rx", "15");
	body.setAttribute("fill", bodyColor);
	body.setAttribute("stroke", strokeColor);
	body.setAttribute("stroke-width", "2");
	svg.appendChild(body);

	// Key positions and sizes
	var keyRadius = 12;
	var smallKeyRadius = 8;

	// Left hand keys (2 thumb keys + 3 fingers)
	var leftKeys = [
		{ x: 70, y: 55, r: keyRadius, label: "1", pressed: fingering.left[2] },         // L1
		{ x: 100, y: 55, r: keyRadius, label: "2", pressed: fingering.left[3] },        // L2
		{ x: 130, y: 55, r: keyRadius, label: "3", pressed: fingering.left[4] }         // L3
	];

	// Thumb keys (below the body)
	var thumbKeys = [
		{ x: 40, y: 90, r: smallKeyRadius, label: "B♮", pressed: fingering.left[0] },   // B-natural key
		{ x: 60, y: 90, r: smallKeyRadius, label: "B♭", pressed: fingering.left[1] }    // Bb key
	];

	// Right hand keys (4 fingers)
	var rightKeys = [
		{ x: 170, y: 55, r: keyRadius, label: "1", pressed: fingering.right[0] },       // R1
		{ x: 200, y: 55, r: keyRadius, label: "2", pressed: fingering.right[1] },       // R2
		{ x: 230, y: 55, r: keyRadius, label: "3", pressed: fingering.right[2] },       // R3
		{ x: 260, y: 55, r: smallKeyRadius, label: "4", pressed: fingering.right[3] }   // R4 (pinky)
	];

	// Foot joint keys (simplified)
	var footKeys = [
		{ x: 175, y: 85, r: smallKeyRadius - 2, label: "D#", pressed: fingering.foot[0] },
		{ x: 195, y: 85, r: smallKeyRadius - 2, label: "D", pressed: fingering.foot[1] },
		{ x: 215, y: 85, r: smallKeyRadius - 2, label: "C#", pressed: fingering.foot[2] },
		{ x: 235, y: 85, r: smallKeyRadius - 2, label: "C", pressed: fingering.foot[3] },
		{ x: 255, y: 85, r: smallKeyRadius - 2, label: "B", pressed: fingering.foot[4] }
	];

	// Draw all keys
	function drawKey(key) {
		var circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
		circle.setAttribute("cx", key.x);
		circle.setAttribute("cy", key.y);
		circle.setAttribute("r", key.r);
		circle.setAttribute("fill", key.pressed ? pressedColor : openColor);
		circle.setAttribute("stroke", strokeColor);
		circle.setAttribute("stroke-width", "2");
		svg.appendChild(circle);

		// Small text label for thumb keys and foot keys
		if (key.label && (key.r < keyRadius - 2 || key.label.includes("♮") || key.label.includes("♭"))) {
			var text = document.createElementNS("http://www.w3.org/2000/svg", "text");
			text.setAttribute("x", key.x);
			text.setAttribute("y", key.y + 3);
			text.setAttribute("text-anchor", "middle");
			text.setAttribute("font-size", "8");
			text.setAttribute("fill", key.pressed ? "#fff" : "#333");
			text.textContent = key.label;
			svg.appendChild(text);
		}
	}

	leftKeys.forEach(drawKey);
	rightKeys.forEach(drawKey);
	thumbKeys.forEach(drawKey);
	footKeys.forEach(drawKey);

	// Hand labels
	var leftLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
	leftLabel.setAttribute("x", "100");
	leftLabel.setAttribute("y", "15");
	leftLabel.setAttribute("text-anchor", "middle");
	leftLabel.setAttribute("font-size", "12");
	leftLabel.setAttribute("fill", "#666");
	leftLabel.textContent = "Left Hand";
	svg.appendChild(leftLabel);

	var rightLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
	rightLabel.setAttribute("x", "215");
	rightLabel.setAttribute("y", "15");
	rightLabel.setAttribute("text-anchor", "middle");
	rightLabel.setAttribute("font-size", "12");
	rightLabel.setAttribute("fill", "#666");
	rightLabel.textContent = "Right Hand";
	svg.appendChild(rightLabel);

	var footLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
	footLabel.setAttribute("x", "215");
	footLabel.setAttribute("y", "110");
	footLabel.setAttribute("text-anchor", "middle");
	footLabel.setAttribute("font-size", "10");
	footLabel.setAttribute("fill", "#666");
	footLabel.textContent = "Foot Keys";
	svg.appendChild(footLabel);

	// Thumb keys label
	var thumbLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
	thumbLabel.setAttribute("x", "50");
	thumbLabel.setAttribute("y", "110");
	thumbLabel.setAttribute("text-anchor", "middle");
	thumbLabel.setAttribute("font-size", "10");
	thumbLabel.setAttribute("fill", "#666");
	thumbLabel.textContent = "Thumb Keys";
	svg.appendChild(thumbLabel);

	container.appendChild(svg);
}

// ============================================================================
// MAIN FINGERING DISPLAY FUNCTION
// ============================================================================

// Get fingering for a given instrument and MIDI note
function getFingering(instrument, midiNote) {
	switch (instrument) {
		case "trumpet":
			return trumpetFingerings[midiNote] || null;
		case "flute":
			return fluteFingerings[midiNote] || null;
		default:
			return null;
	}
}

// Display fingering in the specified container
function displayFingering(container, instrument, midiNote, showAlternates) {
	container.innerHTML = "";

	// Image-based instruments take priority
	if (imageFingeringMap[instrument]) {
		return displayImageFingering(container, instrument, midiNote);
	}

	var fingering = getFingering(instrument, midiNote);

	if (!fingering) {
		var noData = document.createElement("div");
		noData.className = "no-fingering";
		noData.textContent = "No fingering data available for this note";
		noData.style.textAlign = "center";
		noData.style.color = "#999";
		noData.style.padding = "20px";
		container.appendChild(noData);
		return false;  // No alternates available
	}

	// Primary fingering label
	var primaryLabel = document.createElement("div");
	primaryLabel.className = "fingering-label";
	primaryLabel.textContent = "Primary Fingering";
	primaryLabel.style.textAlign = "center";
	primaryLabel.style.fontWeight = "bold";
	primaryLabel.style.marginBottom = "10px";
	primaryLabel.style.color = "#333";
	container.appendChild(primaryLabel);

	// Draw primary fingering
	var primaryContainer = document.createElement("div");
	primaryContainer.className = "primary-fingering";
	container.appendChild(primaryContainer);

	if (instrument === "trumpet") {
		drawTrumpetFingering(primaryContainer, fingering.primary, false);
	} else if (instrument === "flute") {
		drawFluteFingering(primaryContainer, fingering.primary, false);
	}

	// Check for alternates
	var hasAlternates = fingering.alternates && fingering.alternates.length > 0;

	// Show alternates if requested
	if (showAlternates && hasAlternates) {
		var altLabel = document.createElement("div");
		altLabel.className = "fingering-label";
		altLabel.textContent = "Alternate Fingerings";
		altLabel.style.textAlign = "center";
		altLabel.style.fontWeight = "bold";
		altLabel.style.marginTop = "20px";
		altLabel.style.marginBottom = "10px";
		altLabel.style.color = "#666";
		container.appendChild(altLabel);

		fingering.alternates.forEach(function(alt, index) {
			var altContainer = document.createElement("div");
			altContainer.className = "alternate-fingering";
			altContainer.style.marginTop = "10px";
			container.appendChild(altContainer);

			if (instrument === "trumpet") {
				drawTrumpetFingering(altContainer, alt, true);
			} else if (instrument === "flute") {
				drawFluteFingering(altContainer, alt, true);
			}
		});
	}

	return hasAlternates;
}

// Check if instrument has fingering data
function hasFingeringData(instrument) {
	return instrument === "trumpet" || instrument in imageFingeringMap;
}
