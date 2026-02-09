/*
The MIT License (MIT)

Copyright (c) 2014 Chris Wilson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

window.AudioContext = window.AudioContext || window.webkitAudioContext;

var audioContext = null;
var isPlaying = false;
var sourceNode = null;
var analyser = null;
var theBuffer = null;
var DEBUGCANVAS = null;
var mediaStreamSource = null;
var mediaStream = null;
var detectorElem,
	canvasElem,
	waveCanvas,
	pitchElem,
	noteElem,
	detuneElem,
	detuneAmount,
	noteStringArray;

var notetoDraw = "A";
var octavetoDraw = "4"

window.onload = function() {
	audioContext = new AudioContext();
	MAX_SIZE = Math.max(4,Math.floor(audioContext.sampleRate/5000));	// corresponds to a 5kHz signal

	detectorElem = document.getElementById( "detector" );
	canvasElem = document.getElementById( "output" );
	DEBUGCANVAS = document.getElementById( "waveform" );
	if (DEBUGCANVAS) {
		waveCanvas = DEBUGCANVAS.getContext("2d");
		waveCanvas.strokeStyle = "black";
		waveCanvas.lineWidth = 1;
	}
	pitchElem = document.getElementById( "pitch" );
	noteElem = document.getElementById( "note" );
	detuneElem = document.getElementById( "detune" );
	detuneAmount = document.getElementById( "detune_amt" );

	detectorElem.ondragenter = function () {
		this.classList.add("droptarget");
		return false; };
	detectorElem.ondragleave = function () { this.classList.remove("droptarget"); return false; };
	detectorElem.ondrop = function (e) {
  		this.classList.remove("droptarget");
  		e.preventDefault();
		theBuffer = null;

	  	var reader = new FileReader();
	  	reader.onload = function (event) {
	  		audioContext.decodeAudioData( event.target.result, function(buffer) {
	    		theBuffer = buffer;
	  		}, function(){alert("error loading!");} );

	  	};
	  	reader.onerror = function (event) {
	  		alert("Error: " + reader.error );
		};
	  	reader.readAsArrayBuffer(e.dataTransfer.files[0]);
	  	return false;
	};

}
function togglePitchDetect() {
    if (isPlaying) {
        stopPitchDetect();
    } else {
        startPitchDetect();
    }
}

function startPitchDetect() {
    // grab an audio context
    audioContext = new AudioContext();

    // Attempt to get audio input
    navigator.mediaDevices.getUserMedia(
    {
        "audio": {
            "mandatory": {
                "googEchoCancellation": "false",
                "googAutoGainControl": "false",
                "googNoiseSuppression": "false",
                "googHighpassFilter": "false"
            },
            "optional": []
        },
    }).then((stream) => {
        // Store the stream so we can stop it later
        mediaStream = stream;

        // Create an AudioNode from the stream.
        mediaStreamSource = audioContext.createMediaStreamSource(stream);

	    // Connect it to the destination.
	    analyser = audioContext.createAnalyser();
	    analyser.fftSize = 4096;  // Increased for better low frequency detection
	    mediaStreamSource.connect( analyser );

	    // Update state and show stop button
	    isPlaying = true;
	    document.getElementById("stopButton").style.display = "inline-block";

	    updatePitch();
    }).catch((err) => {
        // always check for errors at the end.
        console.error(`${err.name}: ${err.message}`);
        alert('Stream generation failed.');
    });
}

function stopPitchDetect() {
    // Stop the animation frame
    if (rafID) {
        if (!window.cancelAnimationFrame)
            window.cancelAnimationFrame = window.webkitCancelAnimationFrame;
        window.cancelAnimationFrame(rafID);
        rafID = null;
    }

    // Stop all tracks in the media stream
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }

    // Close the audio context
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }

    // Reset state
    analyser = null;
    mediaStreamSource = null;
    isPlaying = false;
    pitchHistory = [];

    // Hide stop button and reset instrument selector
    document.getElementById("stopButton").style.display = "none";
    document.getElementById("instrument").selectedIndex = 0;

    // Reset display
    detectorElem.className = "vague";
    detectorElem.style.backgroundColor = "white";
    pitchElem.innerText = "--";
    noteElem.innerText = "-";
    detuneElem.className = "";
    detuneAmount.innerText = "--";

    // Reset notation display
    lastRenderedInstrument = null;
    renderNotation(null, null, "");
}

function error() {
    alert('Stream generation failed.');
}



function gotStream(stream) {
    // Create an AudioNode from the stream.
    mediaStreamSource = audioContext.createMediaStreamSource(stream);

    // Connect it to the destination.
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 4096;  // Increased for better low frequency detection
    mediaStreamSource.connect( analyser );
    updatePitch();
}



function toggleLiveInput() {
    if (isPlaying) {
        //stop playing and return
        sourceNode.stop( 0 );
        sourceNode = null;
        analyser = null;
        isPlaying = false;
		if (!window.cancelAnimationFrame)
			window.cancelAnimationFrame = window.webkitCancelAnimationFrame;
        window.cancelAnimationFrame( rafID );
    }
		audioContext.resume().then(() => {
			console.log('Playback resumed successfully');
		});
    getUserMedia(
    	{
            "audio": {
                "mandatory": {
                    "googEchoCancellation": "false",
                    "googAutoGainControl": "false",
                    "googNoiseSuppression": "false",
                    "googHighpassFilter": "false"
                },
                "optional": []
            },
        }, gotStream);
}



var rafID = null;
var tracks = null;
var buflen = 4096;  // Increased for better low frequency detection
var buf = new Float32Array( buflen );

var noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
var octave = [0,1,2,3,4,5,6,7,8]

function noteFromPitch( frequency ) {
	var noteNum = 12 * (Math.log( frequency / 440 )/Math.log(2) );
	return Math.round( noteNum ) + 69;
}

function frequencyFromNoteNumber( note ) {
	return 440 * Math.pow(2,(note-69)/12);
}

function octaveFromPitch ( frequency ){
	if (frequency < 31 ){
		return 0;
	}
	if (frequency < 65.4 && frequency > 32.7 ){
		return 1;
	}
	if (frequency < 125  && frequency > 63 ){
		return 2;
	}
	if (frequency < 250 && frequency > 125){
		return 3;
	}
	if (frequency < 510 && frequency > 250 ){
		return 4;
	}
	if (frequency < 1010 && frequency > 510 ){
		return 5;
	}
	if (frequency < 2000 && frequency > 1010 ){
		return 6;
	}
	if (frequency < 3951 && frequency > 2000 ){
		return 7;
	}
}

function centsOffFromPitch( frequency, note ) {
	return Math.floor( 1200 * Math.log( frequency / frequencyFromNoteNumber( note ))/Math.log(2) );
}

function autoCorrelate( buf, sampleRate ) {
	// McLeod Pitch Method (MPM) using Normalized Square Difference Function
	// Reference: "A Smarter Way to Find Pitch" by Philip McLeod and Geoff Wyvill
	var SIZE = buf.length;
	var rms = 0;

	for (var i = 0; i < SIZE; i++) {
		var val = buf[i];
		rms += val * val;
	}
	rms = Math.sqrt(rms / SIZE);
	if (rms < 0.01)
		return { frequency: -1, confidence: 0 };

	// Compute NSDF: nsdf[tau] = 2*r(tau) / m(tau)
	// where r(tau) = sum of x[j]*x[j+tau]  (autocorrelation)
	// and   m(tau) = sum of x[j]^2 + x[j+tau]^2  (normalization)
	// This normalizes values to [-1, 1], making peak selection reliable
	var maxLag = Math.floor(SIZE / 2);
	var nsdf = new Float32Array(maxLag);

	for (var tau = 0; tau < maxLag; tau++) {
		var acf = 0;
		var m = 0;
		for (var j = 0; j < SIZE - tau; j++) {
			acf += buf[j] * buf[j + tau];
			m += buf[j] * buf[j] + buf[j + tau] * buf[j + tau];
		}
		nsdf[tau] = m > 0 ? 2 * acf / m : 0;
	}

	// Find peaks: local maxima in positive regions after zero crossings
	// Skip the initial peak at tau=0 (always 1.0) by waiting for
	// the first negative-going crossing before collecting peaks
	var peaks = [];
	var pastInitial = false;
	var inPositiveRegion = false;
	var peakLag = 0;
	var peakVal = -Infinity;

	for (var tau = 1; tau < maxLag; tau++) {
		if (!pastInitial) {
			if (nsdf[tau] < 0) pastInitial = true;
			continue;
		}

		if (nsdf[tau] > 0 && nsdf[tau - 1] <= 0) {
			// Positive-going zero crossing — start of new positive region
			inPositiveRegion = true;
			peakLag = tau;
			peakVal = nsdf[tau];
		} else if (nsdf[tau] <= 0 && nsdf[tau - 1] > 0 && inPositiveRegion) {
			// Negative-going zero crossing — record the peak of this region
			peaks.push({ lag: peakLag, value: peakVal });
			inPositiveRegion = false;
		} else if (inPositiveRegion && nsdf[tau] > peakVal) {
			peakLag = tau;
			peakVal = nsdf[tau];
		}
	}
	if (inPositiveRegion) {
		peaks.push({ lag: peakLag, value: peakVal });
	}

	if (peaks.length === 0) return { frequency: -1, confidence: 0 };

	// Find the highest peak value across all candidate peaks
	var maxPeakValue = 0;
	for (var i = 0; i < peaks.length; i++) {
		if (peaks[i].value > maxPeakValue) maxPeakValue = peaks[i].value;
	}

	// MPM key step: select the FIRST peak above the threshold.
	// The first strong peak corresponds to the fundamental frequency,
	// while later peaks at 2x, 3x lag are sub-harmonics (octave errors).
	var PEAK_THRESHOLD = 0.93;
	var threshold = maxPeakValue * PEAK_THRESHOLD;

	var bestPeak = null;
	for (var i = 0; i < peaks.length; i++) {
		if (peaks[i].value >= threshold) {
			bestPeak = peaks[i];
			break;
		}
	}

	if (!bestPeak || bestPeak.value < 0.5)
		return { frequency: -1, confidence: 0 };

	// Parabolic interpolation for sub-sample accuracy
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

function updatePitch( time ) {
	var cycles = new Array;
	analyser.getFloatTimeDomainData( buf );
	var ac = autoCorrelate( buf, audioContext.sampleRate );

	if (DEBUGCANVAS) {  // This draws the current waveform, useful for debugging
		waveCanvas.clearRect(0,0,512,256);
		waveCanvas.strokeStyle = "red";
		waveCanvas.beginPath();
		waveCanvas.moveTo(0,0);
		waveCanvas.lineTo(0,256);
		waveCanvas.moveTo(128,0);
		waveCanvas.lineTo(128,256);
		waveCanvas.moveTo(256,0);
		waveCanvas.lineTo(256,256);
		waveCanvas.moveTo(384,0);
		waveCanvas.lineTo(384,256);
		waveCanvas.moveTo(512,0);
		waveCanvas.lineTo(512,256);
		waveCanvas.stroke();
		waveCanvas.strokeStyle = "black";
		waveCanvas.beginPath();
		waveCanvas.moveTo(0,buf[0]);
		for (var i=1;i<512;i++) {
			waveCanvas.lineTo(i,128+(buf[i]*128));
		}
		waveCanvas.stroke();
	}

	// Check if we have a valid pitch with sufficient confidence
	var validPitch = false;
	var detectedFreq = ac.frequency;
	var confidence = ac.confidence;

	if (detectedFreq > 0 && confidence >= MIN_CONFIDENCE) {
		// Check if frequency is within instrument range
		var range = getInstrumentRange();
		if (detectedFreq >= range.min && detectedFreq <= range.max) {
			// Check if this is a significant note change (more than a semitone from recent average)
			// If so, reset history to allow faster response to new notes
			if (pitchHistory.length > 0) {
				var avgRecent = pitchHistory.reduce(function(a, b) { return a + b; }, 0) / pitchHistory.length;
				if (!isWithinTolerance(detectedFreq, avgRecent, NOTE_CHANGE_THRESHOLD)) {
					// Significant note change detected - reset history
					pitchHistory = [];
				}
			}

			// Add to pitch history for smoothing
			pitchHistory.push(detectedFreq);
			if (pitchHistory.length > SMOOTHING_COUNT) {
				pitchHistory.shift();
			}

			// Check if we have enough consistent readings
			if (pitchHistory.length >= SMOOTHING_COUNT) {
				var median = medianOfArray(pitchHistory);
				var consistent = true;
				for (var i = 0; i < pitchHistory.length; i++) {
					if (!isWithinTolerance(pitchHistory[i], median, SMOOTHING_TOLERANCE)) {
						consistent = false;
						break;
					}
				}
				if (consistent) {
					validPitch = true;
					detectedFreq = median;  // Use smoothed value for display
				}
			}
		}
	} else {
		// Reset pitch history on invalid reading
		pitchHistory = [];
	}

 	if (!validPitch) {
 		detectorElem.className = "vague";
 		detectorElem.style.backgroundColor = "white";
	 	pitchElem.innerText = "--";
		noteElem.innerText = "-";
		detuneElem.className = "";
		detuneAmount.innerText = "--";
 	} else {
	 	detectorElem.className = "confident";
	 	pitch = detectedFreq;

	 	// Get concert pitch note (for detuning calculation)
	 	var concertNote = noteFromPitch(pitch);

	 	// Apply transposition to get written pitch
	 	var transposition = getTransposition();
	 	var writtenNote = concertNote + transposition;

	 	// Calculate written pitch frequency for display
	 	var writtenFreq = frequencyFromNoteNumber(writtenNote);
	 	pitchElem.innerText = Math.round(writtenFreq);

	 	// Get written note name and octave
	 	notetoDraw = noteStrings[writtenNote % 12];
	 	octavetoDraw = Math.floor(writtenNote / 12) - 1; // MIDI note to octave

		// Display note name with enharmonic equivalent if applicable
		var enharmonic = getEnharmonic(notetoDraw, octavetoDraw);
		if (enharmonic) {
			// Show both sharp and flat spellings
			noteElem.innerHTML = enharmonic.sharp.name + " / " + enharmonic.flat.name;
		} else {
			noteElem.innerHTML = notetoDraw;
		}

		// Update VexFlow notation display
		updateNotation();

		// Detuning is still based on concert pitch (how in-tune they actually are)
		var detune = centsOffFromPitch(pitch, concertNote);

		// Calculate background color intensity based on how out of tune
		// 0 cents = white, 50+ cents = fully saturated color
		var absDetune = Math.abs(detune);
		var maxDetune = 50; // cents at which we reach maximum darkness
		var intensity = Math.min(absDetune / maxDetune, 1.0);

		// Apply background color to detector container
		// Blue for flat (negative detune), red for sharp (positive detune)
		if (detune == 0) {
			detuneElem.className = "";
			detuneAmount.innerHTML = "--";
			detectorElem.className = "confident";
			detectorElem.style.backgroundColor = "white";
		} else {
			if (detune < 0) {
				// Flat: dark blue gradient
				detuneElem.className = "flat";
				detectorElem.className = "confident flat";
				// Blend from white to dark blue
				var r = Math.round(255 - (255 - 30) * intensity);
				var g = Math.round(255 - (255 - 60) * intensity);
				var b = Math.round(255 - (255 - 120) * intensity);
				detectorElem.style.backgroundColor = "rgb(" + r + ", " + g + ", " + b + ")";
			} else {
				// Sharp: dark red gradient
				detuneElem.className = "sharp";
				detectorElem.className = "confident sharp";
				// Blend from white to dark red
				var r = Math.round(255 - (255 - 140) * intensity);
				var g = Math.round(255 - (255 - 30) * intensity);
				var b = Math.round(255 - (255 - 30) * intensity);
				detectorElem.style.backgroundColor = "rgb(" + r + ", " + g + ", " + b + ")";
			}
			detuneAmount.innerHTML = Math.abs(detune);
		}
	}

	if (!window.requestAnimationFrame)
		window.requestAnimationFrame = window.webkitRequestAnimationFrame;
	rafID = window.requestAnimationFrame( updatePitch );
}

// Treble clef instruments
var trebleClefInstruments = [
	"treble clef", "flute", "oboe", "clarinet", "bass clarinet",
	"alto sax", "tenor sax", "bari sax",
	"trumpet", "horn", "glockenspiel"
];

// Bass clef instruments
var bassClefInstruments = ["bass clef", "bassoon", "trombone", "euphonium", "tuba"];

// Transposition map: semitones to add to concert pitch to get written pitch
// Positive = written pitch is higher than concert pitch
var transpositionMap = {
	"": 0,                // No instrument selected - concert pitch
	"treble clef": 0,     // Generic treble clef - concert pitch
	"bass clef": 0,       // Generic bass clef - concert pitch
	"flute": 0,           // C instrument - concert pitch
	"oboe": 0,            // C instrument - concert pitch
	"clarinet": 2,        // Bb instrument - up major 2nd
	"bass clarinet": 14,  // Bb instrument - up major 9th (octave + M2)
	"bassoon": 0,         // C instrument - concert pitch
	"alto sax": 9,        // Eb instrument - up major 6th
	"tenor sax": 14,      // Bb instrument - up major 9th (octave + M2)
	"bari sax": 21,       // Eb instrument - up major 13th (octave + M6)
	"trumpet": 2,         // Bb instrument - up major 2nd
	"horn": 7,            // F instrument - up perfect 5th
	"trombone": 0,        // C instrument - concert pitch
	"euphonium": 0,       // C instrument - concert pitch
	"tuba": 0,            // C instrument - concert pitch
	"glockenspiel": -24   // Sounds 2 octaves higher than written
};

// Get transposition for current instrument
function getTransposition() {
	var instrumentSelect = document.getElementById("instrument");
	var instrument = instrumentSelect ? instrumentSelect.value : "";
	return transpositionMap[instrument] || 0;
}

// Instrument frequency ranges (concert pitch in Hz) - min and max playable frequencies
var instrumentRanges = {
	"": { min: 20, max: 5000 },              // No limit for generic
	"treble clef": { min: 20, max: 5000 },   // No limit for generic treble
	"bass clef": { min: 20, max: 5000 },     // No limit for generic bass
	"flute": { min: 262, max: 2093 },        // C4 to C7
	"oboe": { min: 233, max: 1568 },         // Bb3 to G6
	"clarinet": { min: 165, max: 1568 },     // E3 to G6 (concert pitch)
	"bass clarinet": { min: 87, max: 698 },  // F2 to F5 (concert pitch)
	"bassoon": { min: 58, max: 622 },        // Bb1 to Eb5
	"alto sax": { min: 139, max: 831 },      // Db3 to Ab5 (concert pitch)
	"tenor sax": { min: 104, max: 622 },     // Ab2 to Eb5 (concert pitch)
	"bari sax": { min: 69, max: 415 },       // Db2 to Ab4 (concert pitch)
	"trumpet": { min: 138, max: 988 },       // C#3 to B5 (concert pitch) - expanded low range
	"horn": { min: 65, max: 880 },           // C2 to A5 (concert pitch) - expanded range for horn's wide tessitura
	"trombone": { min: 30, max: 700 },       // Very low pedal tones to F5 - expanded for low brass
	"euphonium": { min: 30, max: 700 },      // Very low pedal tones to F5 - expanded for low brass
	"tuba": { min: 25, max: 400 },           // Below Bb0 to G4 - expanded range
	"glockenspiel": { min: 784, max: 4186 }  // G5 to C8 (concert pitch)
};

// Get frequency range for current instrument
function getInstrumentRange() {
	var instrumentSelect = document.getElementById("instrument");
	var instrument = instrumentSelect ? instrumentSelect.value : "";
	return instrumentRanges[instrument] || { min: 20, max: 5000 };
}

// Pitch smoothing variables
var pitchHistory = [];
var SMOOTHING_COUNT = 3;  // Number of consistent readings for median filter
var SMOOTHING_TOLERANCE = 50;  // Cents tolerance for "same note" (median handles outliers)
var MIN_CONFIDENCE = 0.80;  // Minimum NSDF confidence to accept pitch
var NOTE_CHANGE_THRESHOLD = 80;  // Cents threshold to detect note change (reset smoothing buffer)

// Check if a frequency is within tolerance of another (in cents)
function isWithinTolerance(freq1, freq2, cents) {
	if (freq1 <= 0 || freq2 <= 0) return false;
	var centsDiff = Math.abs(1200 * Math.log(freq1 / freq2) / Math.log(2));
	return centsDiff <= cents;
}

// Median filter — more robust than mean for rejecting single-frame outliers
function medianOfArray(arr) {
	var sorted = arr.slice().sort(function(a, b) { return a - b; });
	var mid = Math.floor(sorted.length / 2);
	if (sorted.length % 2 === 0) {
		return (sorted[mid - 1] + sorted[mid]) / 2;
	}
	return sorted[mid];
}

// VexFlow rendering variables
var lastRenderedNote = null;
var lastRenderedOctave = null;
var lastRenderedInstrument = null;
var resizeTimeout = null;

// Fixed internal dimensions for VexFlow (maintains aspect ratio)
// Smaller values = larger staff appearance (content fills more of the viewBox)
var VEXFLOW_WIDTH = 240;
var VEXFLOW_HEIGHT = 120;

// Enharmonic equivalents: sharp -> flat mapping
var enharmonicMap = {
	"C#": { flat: "Db", sharpOctaveAdjust: 0, flatOctaveAdjust: 0 },
	"D#": { flat: "Eb", sharpOctaveAdjust: 0, flatOctaveAdjust: 0 },
	"F#": { flat: "Gb", sharpOctaveAdjust: 0, flatOctaveAdjust: 0 },
	"G#": { flat: "Ab", sharpOctaveAdjust: 0, flatOctaveAdjust: 0 },
	"A#": { flat: "Bb", sharpOctaveAdjust: 0, flatOctaveAdjust: 0 }
};

// Get enharmonic equivalent of a note
function getEnharmonic(noteName, octave) {
	if (enharmonicMap[noteName]) {
		return {
			sharp: { name: noteName, octave: octave + enharmonicMap[noteName].sharpOctaveAdjust },
			flat: { name: enharmonicMap[noteName].flat, octave: octave + enharmonicMap[noteName].flatOctaveAdjust }
		};
	}
	return null; // No enharmonic (natural note)
}

// Initialize VexFlow when page loads
function initVexFlow() {
	var outputDiv = document.getElementById("vexflow-output");
	if (!outputDiv) return;

	// Draw initial empty staff
	renderNotation(null, null, "");
}

// Render notation with VexFlow
function renderNotation(noteName, octave, instrument) {
	var outputDiv = document.getElementById("vexflow-output");
	if (!outputDiv) return;

	// Clear previous content
	outputDiv.innerHTML = "";

	var VF = Vex.Flow;

	// Create new renderer at fixed internal size
	var renderer = new VF.Renderer(outputDiv, VF.Renderer.Backends.SVG);
	renderer.resize(VEXFLOW_WIDTH, VEXFLOW_HEIGHT);
	var context = renderer.getContext();

	// Set viewBox on the SVG to enable proportional scaling
	var svgElement = outputDiv.querySelector("svg");
	if (svgElement) {
		svgElement.setAttribute("viewBox", "0 0 " + VEXFLOW_WIDTH + " " + VEXFLOW_HEIGHT);
		svgElement.setAttribute("preserveAspectRatio", "xMidYMid meet");
		svgElement.style.width = "100%";
		svgElement.style.height = "100%";
	}

	// Determine clef based on instrument
	var clef = "treble"; // default
	if (bassClefInstruments.includes(instrument)) {
		clef = "bass";
	} else if (trebleClefInstruments.includes(instrument)) {
		clef = "treble";
	}

	// Fixed stave dimensions (will scale with viewBox)
	var staveWidth = VEXFLOW_WIDTH - 20;
	var staveY = 20;

	// Create stave
	var stave = new VF.Stave(10, staveY, staveWidth);
	stave.addClef(clef);
	stave.setContext(context).draw();

	// If we have a note to display, render it
	if (noteName && octave) {
		// Check if note has an enharmonic equivalent
		var enharmonic = getEnharmonic(noteName, octave);

		try {
			var notes = [];

			if (enharmonic) {
				// Create sharp note (half note to fit both)
				var sharpKey = enharmonic.sharp.name.toLowerCase() + "/" + enharmonic.sharp.octave;
				var sharpNote = new VF.StaveNote({
					clef: clef,
					keys: [sharpKey],
					duration: "h"  // half note
				});
				sharpNote.addAccidental(0, new VF.Accidental("#"));
				notes.push(sharpNote);

				// Create flat note (half note)
				var flatKey = enharmonic.flat.name.replace("b", "").toLowerCase() + "b/" + enharmonic.flat.octave;
				var flatNote = new VF.StaveNote({
					clef: clef,
					keys: [flatKey],
					duration: "h"  // half note
				});
				flatNote.addAccidental(0, new VF.Accidental("b"));
				notes.push(flatNote);
			} else {
				// Natural note - single whole note
				var vexNote = noteName.toLowerCase();
				var noteKey = vexNote + "/" + octave;
				var note = new VF.StaveNote({
					clef: clef,
					keys: [noteKey],
					duration: "w"  // whole note
				});
				notes.push(note);
			}

			// Create a voice and add notes
			var voice = new VF.Voice({
				num_beats: 4,
				beat_value: 4
			}).setStrict(false);
			voice.addTickables(notes);

			// Format and draw
			new VF.Formatter().joinVoices([voice]).format([voice], staveWidth - 80);
			voice.draw(context, stave);
		} catch (e) {
			// Note might be out of range for the clef, just show empty staff
			console.log("Could not render note:", noteName, octave, e.message);
		}
	}
}

// Handle window resize with debouncing
function handleResize() {
	if (resizeTimeout) {
		clearTimeout(resizeTimeout);
	}
	resizeTimeout = setTimeout(function() {
		// Force re-render at new size
		lastRenderedNote = null;
		lastRenderedOctave = null;
		updateNotation();
	}, 100);
}

// Update the notation display (called when note changes)
function updateNotation() {
	var instrumentSelect = document.getElementById("instrument");
	var currentInstrument = instrumentSelect ? instrumentSelect.value : "";

	// Only re-render if something changed
	if (notetoDraw !== lastRenderedNote ||
		octavetoDraw !== lastRenderedOctave ||
		currentInstrument !== lastRenderedInstrument) {

		renderNotation(notetoDraw, octavetoDraw, currentInstrument);

		lastRenderedNote = notetoDraw;
		lastRenderedOctave = octavetoDraw;
		lastRenderedInstrument = currentInstrument;
	}
}

// Re-render when instrument changes or window resizes
document.addEventListener("DOMContentLoaded", function() {
	initVexFlow();

	var instrumentSelect = document.getElementById("instrument");
	if (instrumentSelect) {
		instrumentSelect.addEventListener("change", function() {
			// If an instrument is selected, auto-start pitch detection
			if (instrumentSelect.value !== "") {
				// Force re-render with new clef
				lastRenderedInstrument = null;
				updateNotation();

				// Start pitch detection if not already playing
				if (!isPlaying) {
					startPitchDetect();
				}
			}
		});
	}

	// Handle window resize
	window.addEventListener("resize", handleResize);
});
