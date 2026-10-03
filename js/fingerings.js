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
	// Low register (written). F#3 (all three valves) is the lowest note a
	// 3-valve trumpet can finger; notes below it show "no fingering data".
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
	75: { primary: [2], alternates: [] },           // D#5
	76: { primary: [], alternates: [] },            // E5 - open
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
// CLARINET FINGERINGS
// ============================================================================
// Boehm-system Bb clarinet, written pitch (MIDI). Each fingering lists the
// keys/holes that are pressed (see drawClarinetFingering() for the layout):
//   Reg = register key, T = thumb hole, A / Gs = throat A and G# keys,
//   L1-L3 / R1-R3 = left/right hand tone holes,
//   S1-S4 = right-hand side (trill) keys, top to bottom,
//   CsGs = C#/G# key,
//   lE, lF, lFs = left pinky E/B, F/C, F#/C#,
//   rE, rF, rFs, rAb = right pinky E/B, F/C, F#/C#, Ab/Eb.
// E/B, F/C and F#/C# exist for both pinkies, which is what the pinky
// alternates are for: alternate hands so you never slide one pinky between
// two keys. On a standard clarinet Ab/Eb is right-only.
// Altissimo (above C6) uses the standard fifth-partial fingerings: first
// finger lifted as a vent, Ab/Eb key down.
var clarinetLH = ["T", "L1", "L2", "L3"];
var clarinetRH = ["R1", "R2", "R3"];
var clarinetAll = clarinetLH.concat(clarinetRH);
var clarinetClarion = ["Reg"].concat(clarinetAll);

var clarinetFingerings = {
	// Chalumeau
	52: { // E3
		primary: { keys: clarinetAll.concat(["lE"]), label: "Left pinky" },
		alternates: [{ keys: clarinetAll.concat(["rE"]), label: "Right pinky" }]
	},
	53: { // F3
		primary: { keys: clarinetAll.concat(["rF"]), label: "Right pinky" },
		alternates: [{ keys: clarinetAll.concat(["lF"]), label: "Left pinky" }]
	},
	54: { // F#3
		primary: { keys: clarinetAll.concat(["lFs"]), label: "Left pinky" },
		alternates: [{ keys: clarinetAll.concat(["rFs"]), label: "Right pinky" }]
	},
	55: { primary: { keys: clarinetAll }, alternates: [] },                  // G3
	56: { primary: { keys: clarinetAll.concat(["rAb"]) }, alternates: [] },  // G#3
	57: { primary: { keys: clarinetLH.concat(["R1", "R2"]) }, alternates: [] },  // A3
	58: { primary: { keys: clarinetLH.concat(["R1"]) }, alternates: [] },    // A#3
	59: { primary: { keys: clarinetLH.concat(["R2"]) }, alternates: [] },    // B3
	60: { primary: { keys: clarinetLH }, alternates: [] },                   // C4
	61: { primary: { keys: clarinetLH.concat(["CsGs"]) }, alternates: [] },  // C#4
	62: { primary: { keys: ["T", "L1", "L2"] }, alternates: [] },            // D4
	63: { primary: { keys: ["T", "L1", "L2", "S4"] }, alternates: [] },      // D#4
	64: { primary: { keys: ["T", "L1"] }, alternates: [] },                  // E4
	65: { primary: { keys: ["T"] }, alternates: [] },                        // F4
	66: { primary: { keys: ["L1"] }, alternates: [] },                       // F#4

	// Throat tones
	67: { primary: { keys: [] }, alternates: [] },                           // G4 (open)
	68: { primary: { keys: ["Gs"] }, alternates: [] },                       // G#4
	69: { // A4
		primary: { keys: ["A"], label: "Standard" },
		alternates: [{ keys: ["A"].concat(clarinetRH), label: "Resonance" }]
	},
	70: { // A#4
		primary: { keys: ["Reg", "A"], label: "Standard" },
		alternates: [{ keys: ["Reg", "A"].concat(clarinetRH), label: "Resonance" }]
	},

	// Clarion
	71: { // B4
		primary: { keys: clarinetClarion.concat(["lE"]), label: "Left pinky" },
		alternates: [{ keys: clarinetClarion.concat(["rE"]), label: "Right pinky" }]
	},
	72: { // C5
		primary: { keys: clarinetClarion.concat(["rF"]), label: "Right pinky" },
		alternates: [{ keys: clarinetClarion.concat(["lF"]), label: "Left pinky" }]
	},
	73: { // C#5
		primary: { keys: clarinetClarion.concat(["lFs"]), label: "Left pinky" },
		alternates: [{ keys: clarinetClarion.concat(["rFs"]), label: "Right pinky" }]
	},
	74: { primary: { keys: clarinetClarion }, alternates: [] },                  // D5
	75: { primary: { keys: clarinetClarion.concat(["rAb"]) }, alternates: [] },  // D#5
	76: { primary: { keys: ["Reg"].concat(clarinetLH, ["R1", "R2"]) }, alternates: [] },  // E5
	77: { primary: { keys: ["Reg"].concat(clarinetLH, ["R1"]) }, alternates: [] },        // F5
	78: { primary: { keys: ["Reg"].concat(clarinetLH, ["R2"]) }, alternates: [] },        // F#5
	79: { primary: { keys: ["Reg"].concat(clarinetLH) }, alternates: [] },                // G5
	80: { primary: { keys: ["Reg"].concat(clarinetLH, ["CsGs"]) }, alternates: [] },      // G#5
	81: { primary: { keys: ["Reg", "T", "L1", "L2"] }, alternates: [] },        // A5
	82: { primary: { keys: ["Reg", "T", "L1", "L2", "S4"] }, alternates: [] },  // A#5
	83: { primary: { keys: ["Reg", "T", "L1"] }, alternates: [] },              // B5
	84: { primary: { keys: ["Reg", "T"] }, alternates: [] },                    // C6

	// Altissimo
	85: { primary: { keys: ["Reg", "T", "L2", "L3", "R1", "R2", "rAb"] }, alternates: [] },  // C#6
	86: { primary: { keys: ["Reg", "T", "L2", "L3", "R1", "rAb"] }, alternates: [] },        // D6
	87: { primary: { keys: ["Reg", "T", "L2", "L3", "R2", "rAb"] }, alternates: [] },        // D#6
	88: { primary: { keys: ["Reg", "T", "L2", "L3", "rAb"] }, alternates: [] },              // E6
	89: { primary: { keys: ["Reg", "T", "L2", "L3", "CsGs", "rAb"] }, alternates: [] },      // F6
	90: { primary: { keys: ["Reg", "T", "L2", "rAb"] }, alternates: [] },                    // F#6
	91: { primary: { keys: ["Reg", "T", "L2", "R1", "R2", "rAb"] }, alternates: [] }         // G6
};

// ============================================================================
// IMAGE-BASED FINGERING DISPLAY
// ============================================================================

// Map of instruments to their fingering image folders.
// transposition: semitones to subtract from the written MIDI note to get the
// image filename index.
//   0  = use written pitch directly (C instruments)
//   9  = alto sax (written - 9 = concert pitch, which the images are indexed by)
//   14 = tenor sax
//   21 = bari sax
// w/h are the largest width and height found in the set. Every chart is drawn
// inside a box of that size (scaled down to fit the window), so the panel stays
// the same size from note to note even though individual images differ.
// (Trombone and horn images are uniform.)
var imageFingeringMap = {
	"bassoon":   { folder: "Bassoon",   ext: "png", transposition: 0,  w: 331, h: 476 },
	"flute":     { folder: "Flute",     ext: "png", transposition: 0,  w: 496, h: 163 },
	"oboe":      { folder: "Oboe",      ext: "png", transposition: 0,  w: 223, h: 469 },
	// All saxophones share the same fingering images indexed at writtenMidi - 12.
	// (The image set uses a MIDI numbering where C4 = 48 instead of 60,
	//  so we subtract 12 regardless of which saxophone is selected.)
	// Range: 46 (written low Bb3) through 73 (written C#6).
	"alto sax":  { folder: "Saxophone", ext: "png", transposition: 12, w: 221, h: 462 },
	"tenor sax": { folder: "Saxophone", ext: "png", transposition: 12, w: 221, h: 462 },
	"bari sax":  { folder: "Saxophone", ext: "png", transposition: 12, w: 221, h: 462 },
	"trombone":  { folder: "Trombone",  ext: "gif", transposition: 0,  w: 534, h: 112 },
	// Double F/Bb horn: F side through written G4, Bb side (thumb) from G#4.
	// Range: 42 (written F#2) through 84 (written C6).
	"horn":      { folder: "Horn",      ext: "png", transposition: 0,  w: 360, h: 160 }
};

// Display fingering using an image file from img/Fingerings/
function displayImageFingering(container, instrument, writtenMidi) {
	var info = imageFingeringMap[instrument];
	var imageMidi = writtenMidi - info.transposition;
	var imgPath = "img/Fingerings/" + info.folder + "/" + imageMidi + "." + info.ext;

	// Reuse a persistent <img> and just swap its src. The browser keeps showing
	// the current image until the new one finishes loading, so the panel never
	// collapses to empty (and back) while the image downloads.
	var img = container.querySelector("img.fingering-image");
	var missing = container.querySelector(".no-fingering");
	if (!img || !missing) {
		container.innerHTML = "";
		img = document.createElement("img");
		img.className = "fingering-image";
		img.alt = "Fingering diagram";
		// Sizing (incl. a viewport-relative max-height cap) is handled in CSS via
		// "#fingering-display img" so the chart scales to fit the window.
		img.style.display = "block";
		img.style.margin = "0 auto";
		// Notes outside the chart set 404. Swap in a message rather than
		// replacing the <img>, so the panel keeps its reserved size.
		missing = document.createElement("div");
		missing.className = "no-fingering";
		missing.textContent = "No fingering image available for this note";
		missing.style.display = "none";
		img.onload = function() {
			img.style.display = "block";
			missing.style.display = "none";
		};
		img.onerror = function() {
			img.style.display = "none";
			missing.style.display = "block";
		};
		container.appendChild(img);
		container.appendChild(missing);
	}

	// Fix the box to the set's largest chart (via aspect-ratio, which unlike the
	// width/height attributes isn't replaced by each image's own ratio once it
	// loads). CSS sets the height and keeps it responsive.
	if (info.w && info.h) {
		img.width = info.w;
		img.height = info.h;
		img.style.aspectRatio = info.w + " / " + info.h;
	}

	img.src = imgPath;

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

// Draw clarinet fingering diagram. Laid out like a standard clarinet chart:
// register key and thumb hole on the left, the six tone holes down the
// middle, throat keys on top, side keys and the C#/G# key at the break,
// left pinky keys beside the right hand, right pinky keys at the bottom.
// Pressed keys are filled black. Returns the <svg>.
function drawClarinetFingering(keys) {
	var ns = "http://www.w3.org/2000/svg";
	var svg = document.createElementNS(ns, "svg");
	svg.setAttribute("viewBox", "0 0 180 510");
	svg.setAttribute("width", "180");
	svg.setAttribute("height", "510");

	var ink = "#111";
	function isDown(id) {
		return keys.indexOf(id) !== -1;
	}
	function style(el, id) {
		el.setAttribute("fill", isDown(id) ? ink : "#fff");
		el.setAttribute("stroke", ink);
		el.setAttribute("stroke-width", "2.5");
		svg.appendChild(el);
		return el;
	}
	function circle(id, cx, cy, r) {
		var c = document.createElementNS(ns, "circle");
		c.setAttribute("cx", cx);
		c.setAttribute("cy", cy);
		c.setAttribute("r", r);
		return style(c, id);
	}
	function oval(id, cx, cy, rx, ry, angle) {
		var e = document.createElementNS(ns, "ellipse");
		e.setAttribute("cx", cx);
		e.setAttribute("cy", cy);
		e.setAttribute("rx", rx);
		e.setAttribute("ry", ry);
		if (angle) {
			e.setAttribute("transform", "rotate(" + angle + " " + cx + " " + cy + ")");
		}
		return style(e, id);
	}
	function path(id, d) {
		var el = document.createElementNS(ns, "path");
		el.setAttribute("d", d);
		return style(el, id);
	}
	function label(id, x, y, text) {
		var t = document.createElementNS(ns, "text");
		t.setAttribute("x", x);
		t.setAttribute("y", y);
		t.setAttribute("text-anchor", "middle");
		t.setAttribute("dominant-baseline", "central");
		t.setAttribute("font-size", text.length > 1 ? "12" : "14");
		t.setAttribute("font-weight", "700");
		t.setAttribute("font-family", "sans-serif");
		t.setAttribute("fill", isDown(id) ? "#fff" : ink);
		t.textContent = text;
		svg.appendChild(t);
	}

	// The register key, thumb hole and tone holes always show. Every other
	// key group (throat keys, side keys, C#/G# key, each pinky cluster) is
	// drawn only when one of its keys is used, like a printed chart.
	function anyDown(ids) {
		return ids.some(isDown);
	}

	// Register key (teardrop) and thumb hole
	path("Reg", "M32 8 C26 44 21 80 23 94 A9 9 0 0 0 41 94 C43 80 38 44 32 8 Z");
	circle("T", 28, 134, 19);

	// Throat A and G# keys
	if (anyDown(["A", "Gs"])) {
		oval("A", 78, 60, 8, 15);
		path("Gs", "M116 34 C108 36 112 52 118 66 C124 82 118 98 126 104 C136 108 138 86 132 70 C126 54 128 38 116 34 Z");
	}

	// Tone holes, with the joint line between the hands
	[["L1", 112], ["L2", 167], ["L3", 222], ["R1", 302], ["R2", 357], ["R3", 412]].forEach(function(h) {
		circle(h[0], 78, h[1], 19);
	});
	var joint = document.createElementNS(ns, "line");
	joint.setAttribute("x1", "60");
	joint.setAttribute("x2", "96");
	joint.setAttribute("y1", "262");
	joint.setAttribute("y2", "262");
	joint.setAttribute("stroke", ink);
	joint.setAttribute("stroke-width", "2.5");
	svg.appendChild(joint);

	// Side (trill) keys
	var sideKeys = ["S1", "S2", "S3", "S4"];
	if (anyDown(sideKeys)) {
		sideKeys.forEach(function(id, i) {
			oval(id, 30, 234 + i * 15, 10, 6);
		});
	}

	// C#/G# key
	if (isDown("CsGs")) {
		path("CsGs", "M98 248 C108 240 126 238 134 243 C140 248 128 254 98 248 Z");
	}

	// Left pinky keys (E/B, F/C, F#/C#), beside the right hand
	if (anyDown(["lE", "lF", "lFs"])) {
		path("lE", "M112 312 C108 290 110 278 120 278 C130 278 132 290 128 312 L128 340 L112 340 Z");
		label("lE", 120, 312, "E");
		path("lF", "M136 312 C132 296 134 288 144 288 C154 288 156 296 152 312 L152 340 L136 340 Z");
		label("lF", 144, 312, "F");
		oval("lFs", 152, 266, 18, 10, -12);
		label("lFs", 152, 266, "F\u266F");
	}

	// Right pinky keys at the bottom: F#/C# and Ab/Eb above, E/B and F/C below
	if (anyDown(["rE", "rF", "rFs", "rAb"])) {
		oval("rFs", 52, 452, 24, 12, 8);
		label("rFs", 52, 452, "F\u266F");
		oval("rAb", 106, 452, 24, 12, 8);
		label("rAb", 106, 452, "A\u266D");
		oval("rE", 52, 486, 24, 12, 8);
		label("rE", 52, 486, "E");
		oval("rF", 106, 486, 24, 12, 8);
		label("rF", 106, 486, "F");
	}

	return svg;
}

// Draw a clarinet note's fingerings side by side (the primary, plus the
// alternates when shown). Each gets a caption slot, kept even when empty so
// the diagrams stay the same size from note to note.
function displayClarinetFingering(container, fingering, showAlternates) {
	var list = [fingering.primary];
	if (showAlternates) {
		list = list.concat(fingering.alternates);
	}
	var row = document.createElement("div");
	row.className = "clarinet-fingerings";
	list.forEach(function(f, i) {
		var cell = document.createElement("div");
		cell.className = "clarinet-fingering" + (i > 0 ? " alternate" : "");
		cell.appendChild(drawClarinetFingering(f.keys));
		var caption = document.createElement("div");
		caption.className = "clarinet-caption";
		caption.textContent = f.label || "\u00A0";
		cell.appendChild(caption);
		row.appendChild(cell);
	});
	container.appendChild(row);
}

// ============================================================================
// MAIN FINGERING DISPLAY FUNCTION
// ============================================================================

// Get fingering for a given instrument and MIDI note
// Instruments that share trumpet 3-valve fingerings, with an offset
// to map their concert-pitch MIDI note to the equivalent trumpet written MIDI.
//   Euphonium: non-transposing, one octave below trumpet → offset +14
//   Tuba (BBb): non-transposing, two octaves below trumpet → offset +26
var threeValveOffset = {
	"trumpet": 0,
	"euphonium": 14,
	"tuba": 26
};

function getFingering(instrument, midiNote) {
	if (instrument in threeValveOffset) {
		return trumpetFingerings[midiNote + threeValveOffset[instrument]] || null;
	}
	switch (instrument) {
		case "flute":
			return fluteFingerings[midiNote] || null;
		case "clarinet":
			return clarinetFingerings[midiNote] || null;
		default:
			return null;
	}
}

// Display fingering in the specified container
function displayFingering(container, instrument, midiNote, showAlternates) {
	// Image-based instruments manage their own content (they reuse a persistent
	// <img> and swap its src to avoid a load-time layout collapse), so don't
	// clear the container here for them.
	if (imageFingeringMap[instrument]) {
		return displayImageFingering(container, instrument, midiNote);
	}

	container.innerHTML = "";

	var fingering = getFingering(instrument, midiNote);

	if (!fingering) {
		var noData = document.createElement("div");
		noData.className = "no-fingering";
		noData.textContent = "No fingering data available for this note";
		container.appendChild(noData);
		return false;  // No alternates available
	}

	var hasAlternates = fingering.alternates && fingering.alternates.length > 0;

	if (instrument === "clarinet") {
		displayClarinetFingering(container, fingering, showAlternates);
		return hasAlternates;
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

	if (instrument in threeValveOffset) {
		drawTrumpetFingering(primaryContainer, fingering.primary, false);
	} else if (instrument === "flute") {
		drawFluteFingering(primaryContainer, fingering.primary, false);
	}

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

			if (instrument in threeValveOffset) {
				drawTrumpetFingering(altContainer, alt, true);
			} else if (instrument === "flute") {
				drawFluteFingering(altContainer, alt, true);
			}
		});
	}

	return hasAlternates;
}

// Height reserved for an instrument's fingering panel on desktop, as a CSS
// length. It depends only on the instrument, never the note, so stepping
// through notes can't resize the panel (and shift the layout above it).
function fingeringBoxHeight(instrument) {
	var info = imageFingeringMap[instrument];
	if (info) {
		return "min(" + info.h + "px, 280px, 34vh)";
	}
	if (instrument === "clarinet") {
		return "min(280px, 34vh)";
	}
	return "min(120px, 16vh)";  // one valve diagram
}

// Check if instrument has fingering data
function hasFingeringData(instrument) {
	return instrument in threeValveOffset || instrument in imageFingeringMap || instrument === "clarinet";
}
