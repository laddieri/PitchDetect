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
	 	pitchElem.innerText = Math.round( pitch ) ;
	 	var note =  noteFromPitch( pitch );
		octavetoDraw = octaveFromPitch(pitch);
		notetoDraw = noteStrings[note%12];
		noteElem.innerHTML = notetoDraw;
		var detune = centsOffFromPitch( pitch, note );
		if (detune == 0 ) {
			detuneElem.className = "";
			detuneAmount.innerHTML = "--";
		} else {
			if (detune < 0)
				detuneElem.className = "flat";
			else
				detuneElem.className = "sharp";
			detuneAmount.innerHTML = Math.abs( detune );
		}
	}

	if (!window.requestAnimationFrame)
		window.requestAnimationFrame = window.webkitRequestAnimationFrame;
	rafID = window.requestAnimationFrame( updatePitch );
}

let noteName = {
	"A":225,
	"B":200,
	"C":175,
	"D":150,
	"E":125,
	"F":100,
	"G":75,
}


// Setup p5.js canvas
function setup() {
  var xwidth=400
  var yheight=400;
  createCanvas(xwidth, yheight);
  frameRate(60);
}

function draw() {
	noteStringArray = notetoDraw.split("");
	background(255)
	drawStaff(100);

	// Check if selected instrument uses treble clef
	var instrumentSelect = document.getElementById("instrument");
	var selectedInstrument = instrumentSelect ? instrumentSelect.value : "";
	var noteOffset = 0;

	if (trebleClefInstruments.includes(selectedInstrument)) {
		// Draw treble clef on the G line (y=250, which is 100 + 150)
		drawTrebleClef(50, 250);
		noteOffset = 50; // Shift notes right to make room for clef
	} else if (bassClefInstruments.includes(selectedInstrument)) {
		// Draw bass clef on the F line (y=150, which is 100 + 50)
		drawBassClef(50, 150);
		noteOffset = 50; // Shift notes right to make room for clef
	}

	let note = noteName[noteStringArray[0]];
	note = adujustForOctave(note);
	if (typeof noteStringArray[1] !== "undefined"){
		drawNote(200-75+noteOffset,note);
		drawSharp(200-150+noteOffset,note+17);
		drawNote(200+75+noteOffset,note-25);
		drawFlat(200+10+noteOffset,note-25+17);
	}	else {
		drawNote(200+noteOffset,note);
	}

}

function drawStaff(y){
	strokeWeight(4);
  line(0,y,400,y);
  line(0,y+50,400,y+50);
  line(0,y+100,400,y+100);
  line(0,y+150,400,y+150);
  line(0,y+200,400,y+200);
}

function drawNote(noteX,noteY){
  noFill();
  strokeWeight(7);
  ellipse(noteX,noteY,50,50);
}

function drawSharp(x,noteY){
  noteY=noteY-1;
  line (x,noteY+10,x,noteY-40)
  line (x+25,noteY+10,x+25,noteY-40)
  line (x-10,noteY-5,x+35,noteY-5)
  line (x-10,noteY-28,x+35,noteY-28)
}

function drawFlat(x,y){
  line (x,y-50,x,y);
	curve(x-325, y+125, x, y, x, y-25, x-10, y+90);
}

// Treble clef instruments
var trebleClefInstruments = ["flute", "clarinet", "alto sax", "trumpet", "horn"];

// Bass clef instruments
var bassClefInstruments = ["trombone", "euphonium"];

function drawTrebleClef(x, y) {
	// Draw treble clef (G-clef) at position x, y where y is the G line (second from bottom)
	// The clef is drawn relative to the G line at y=250 when staff starts at y=100
	push();
	strokeWeight(4);
	noFill();

	// Main spiral curl around G line
	beginShape();
	// Start from bottom tail
	curveVertex(x + 15, y + 95);
	curveVertex(x + 15, y + 95);
	curveVertex(x + 5, y + 70);
	curveVertex(x - 5, y + 40);
	curveVertex(x - 5, y + 10);
	curveVertex(x + 5, y - 20);
	curveVertex(x + 20, y - 50);
	curveVertex(x + 30, y - 80);
	curveVertex(x + 25, y - 110);
	curveVertex(x + 10, y - 130);
	curveVertex(x - 5, y - 120);
	curveVertex(x - 10, y - 95);
	curveVertex(x - 5, y - 70);
	curveVertex(x + 10, y - 50);
	curveVertex(x + 25, y - 35);
	curveVertex(x + 30, y - 10);
	curveVertex(x + 25, y + 15);
	curveVertex(x + 10, y + 30);
	curveVertex(x - 10, y + 25);
	curveVertex(x - 15, y + 5);
	curveVertex(x - 10, y - 10);
	curveVertex(x + 5, y - 10);
	curveVertex(x + 5, y - 10);
	endShape();

	// Small dot at the bottom of the tail
	fill(0);
	ellipse(x + 15, y + 100, 12, 12);
	noFill();

	pop();
}

function drawBassClef(x, y) {
	// Draw bass clef (F-clef) at position x, y where y is the F line (4th line from bottom)
	// The clef is drawn relative to the F line at y=150 when staff starts at y=100
	push();
	strokeWeight(4);
	noFill();

	// Main curved body of bass clef
	beginShape();
	curveVertex(x + 5, y - 5);
	curveVertex(x + 5, y - 5);
	curveVertex(x + 15, y - 15);
	curveVertex(x + 20, y - 35);
	curveVertex(x + 15, y - 55);
	curveVertex(x, y - 65);
	curveVertex(x - 15, y - 55);
	curveVertex(x - 20, y - 30);
	curveVertex(x - 15, y);
	curveVertex(x, y + 30);
	curveVertex(x + 20, y + 60);
	curveVertex(x + 45, y + 85);
	curveVertex(x + 45, y + 85);
	endShape();

	// Two dots next to the F line
	fill(0);
	ellipse(x + 30, y - 25, 10, 10); // Dot above F line
	ellipse(x + 30, y + 25, 10, 10); // Dot below F line

	// Starting dot on F line
	ellipse(x + 5, y, 12, 12);
	noFill();

	pop();
}

function adujustForOctave (frequency){
	if (octavetoDraw == 4){
		return frequency;
	}
	if (octavetoDraw == 3){
		return frequency+175;
	}
	if (octavetoDraw == 2){
		return frequency+350;
	}
	if (octavetoDraw == 5){
		return frequency-175;
	}
}
