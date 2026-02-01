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
	    analyser.fftSize = 2048;
	    mediaStreamSource.connect( analyser );

	    // Update state and button
	    isPlaying = true;
	    document.getElementById("startStopButton").innerText = "Stop";

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

    // Update button text
    document.getElementById("startStopButton").innerText = "Start";

    // Reset display
    detectorElem.className = "vague";
    pitchElem.innerText = "--";
    noteElem.innerText = "-";
    detuneElem.className = "";
    detuneAmount.innerText = "--";
}

function error() {
    alert('Stream generation failed.');
}



function gotStream(stream) {
    // Create an AudioNode from the stream.
    mediaStreamSource = audioContext.createMediaStreamSource(stream);

    // Connect it to the destination.
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
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
var buflen = 2048;
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
	// Implements the ACF2+ algorithm
	var SIZE = buf.length;
	var rms = 0;

	for (var i=0;i<SIZE;i++) {
		var val = buf[i];
		rms += val*val;
	}
	rms = Math.sqrt(rms/SIZE);
	if (rms<0.01) // not enough signal
		return -1;

	var r1=0, r2=SIZE-1, thres=0.2;
	for (var i=0; i<SIZE/2; i++)
		if (Math.abs(buf[i])<thres) { r1=i; break; }
	for (var i=1; i<SIZE/2; i++)
		if (Math.abs(buf[SIZE-i])<thres) { r2=SIZE-i; break; }

	buf = buf.slice(r1,r2);
	SIZE = buf.length;

	var c = new Array(SIZE).fill(0);
	for (var i=0; i<SIZE; i++)
		for (var j=0; j<SIZE-i; j++)
			c[i] = c[i] + buf[j]*buf[j+i];

	var d=0; while (c[d]>c[d+1]) d++;
	var maxval=-1, maxpos=-1;
	for (var i=d; i<SIZE; i++) {
		if (c[i] > maxval) {
			maxval = c[i];
			maxpos = i;
		}
	}
	var T0 = maxpos;

	var x1=c[T0-1], x2=c[T0], x3=c[T0+1];
	a = (x1 + x3 - 2*x2)/2;
	b = (x3 - x1)/2;
	if (a) T0 = T0 - b/(2*a);

	return sampleRate/T0;
}

function updatePitch( time ) {
	var cycles = new Array;
	analyser.getFloatTimeDomainData( buf );
	var ac = autoCorrelate( buf, audioContext.sampleRate );
	// TODO: Paint confidence meter on canvasElem here.

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

 	if (ac == -1) {
 		detectorElem.className = "vague";
	 	pitchElem.innerText = "--";
		noteElem.innerText = "-";
		detuneElem.className = "";
		detuneAmount.innerText = "--";
 	} else {
	 	detectorElem.className = "confident";
	 	pitch = ac;

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

		noteElem.innerHTML = notetoDraw;

		// Update VexFlow notation display
		updateNotation();

		// Detuning is still based on concert pitch (how in-tune they actually are)
		var detune = centsOffFromPitch(pitch, concertNote);
		if (detune == 0) {
			detuneElem.className = "";
			detuneAmount.innerHTML = "--";
		} else {
			if (detune < 0)
				detuneElem.className = "flat";
			else
				detuneElem.className = "sharp";
			detuneAmount.innerHTML = Math.abs(detune);
		}
	}

	if (!window.requestAnimationFrame)
		window.requestAnimationFrame = window.webkitRequestAnimationFrame;
	rafID = window.requestAnimationFrame( updatePitch );
}

// Treble clef instruments
var trebleClefInstruments = ["flute", "clarinet", "alto sax", "trumpet", "horn"];

// Bass clef instruments
var bassClefInstruments = ["trombone", "euphonium"];

// Transposition map: semitones to add to concert pitch to get written pitch
// Positive = written pitch is higher than concert pitch
var transpositionMap = {
	"": 0,              // No instrument selected - concert pitch
	"flute": 0,         // C instrument - concert pitch
	"clarinet": 2,      // Bb instrument - up major 2nd
	"alto sax": 9,      // Eb instrument - up major 6th
	"trumpet": 2,       // Bb instrument - up major 2nd
	"horn": 7,          // F instrument - up perfect 5th
	"trombone": 0,      // C instrument - concert pitch
	"euphonium": 0      // C instrument - concert pitch
};

// Get transposition for current instrument
function getTransposition() {
	var instrumentSelect = document.getElementById("instrument");
	var instrument = instrumentSelect ? instrumentSelect.value : "";
	return transpositionMap[instrument] || 0;
}

// VexFlow rendering variables
var lastRenderedNote = null;
var lastRenderedOctave = null;
var lastRenderedInstrument = null;

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

	// Create new renderer each time (VexFlow 3.x approach)
	var renderer = new VF.Renderer(outputDiv, VF.Renderer.Backends.SVG);
	renderer.resize(320, 180);
	var context = renderer.getContext();

	// Determine clef based on instrument
	var clef = "treble"; // default
	if (bassClefInstruments.includes(instrument)) {
		clef = "bass";
	} else if (trebleClefInstruments.includes(instrument)) {
		clef = "treble";
	}

	// Create stave
	var stave = new VF.Stave(10, 40, 300);
	stave.addClef(clef);
	stave.setContext(context).draw();

	// If we have a note to display, render it
	if (noteName && octave) {
		// Convert note name to VexFlow format (e.g., "C#" -> "c#", octave 4 -> "c#/4")
		var vexNote = noteName.toLowerCase();

		// Adjust octave for bass clef display (VexFlow handles this automatically)
		var displayOctave = octave;

		// Create the note key in VexFlow format
		var noteKey = vexNote + "/" + displayOctave;

		try {
			// Create a whole note
			var note = new VF.StaveNote({
				clef: clef,
				keys: [noteKey],
				duration: "w"  // whole note
			});

			// Add accidental if needed (VexFlow 3.x uses addAccidental with index)
			if (noteName.includes("#")) {
				note.addAccidental(0, new VF.Accidental("#"));
			} else if (noteName.includes("b")) {
				note.addAccidental(0, new VF.Accidental("b"));
			}

			// Create a voice and add the note
			var voice = new VF.Voice({
				num_beats: 4,
				beat_value: 4
			}).setStrict(false);
			voice.addTickables([note]);

			// Format and draw
			new VF.Formatter().joinVoices([voice]).format([voice], 250);
			voice.draw(context, stave);
		} catch (e) {
			// Note might be out of range for the clef, just show empty staff
			console.log("Could not render note:", noteKey, e.message);
		}
	}
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

// Re-render when instrument changes
document.addEventListener("DOMContentLoaded", function() {
	initVexFlow();

	var instrumentSelect = document.getElementById("instrument");
	if (instrumentSelect) {
		instrumentSelect.addEventListener("change", function() {
			// Force re-render with new clef
			lastRenderedInstrument = null;
			updateNotation();
		});
	}
});
