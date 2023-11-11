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
var detectorElem,
	canvasElem,
	waveCanvas,
	pitchElem,
	noteElem,
	detuneElem,
	detuneAmount,
	noteStringArray;

var notetoDraw = "A";
var octavetoDraw = "5"


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
        // Create an AudioNode from the stream.
        mediaStreamSource = audioContext.createMediaStreamSource(stream);

	    // Connect it to the destination.
	    analyser = audioContext.createAnalyser();
	    analyser.fftSize = 2048;
	    mediaStreamSource.connect( analyser );
	    updatePitch();
    }).catch((err) => {
        // always check for errors at the end.
        console.error(`${err.name}: ${err.message}`);
        alert('Stream generation failed.');
    });
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
	var key = document.getElementById('my-select').value;
	if (key == "C"){

		if (frequency < 20){
			return 0;
		}
		if (frequency < 39 && frequency > 20){
			return 1;
		}
		if (frequency < 80  && frequency > 39 ){
			return 2;
		}
		if (frequency < 160 && frequency > 80){
			return 3;
		}
		if (frequency < 315 && frequency > 160 ){
			return 4;
		}
		if (frequency < 640 && frequency > 315 ){
			return 5;
		}
		if (frequency < 1280 && frequency > 640){
			return 6;
		}
		if (frequency < 4186 && frequency > 1280 ){
			return 7;
		}
	}
	if (key=="Bb"){

		if (frequency < 20){
			return 0;
		}
		if (frequency < 34 && frequency > 20){
			return 1;
		}
		if (frequency < 70  && frequency > 34 ){
			return 2;
		}
		if (frequency < 140 && frequency > 70){
			return 3;
		}
		if (frequency < 280 && frequency > 140 ){
			return 4;
		}
		if (frequency < 560 && frequency > 280 ){
			return 5;
		}
		if (frequency < 1100&& frequency > 560){
			return 6;
		}
		if (frequency < 2200 && frequency > 1100 ){
			return 7;
		}
	}
	if (key=="Eb"){

		if (frequency < 20){
			return 0;
		}
		if (frequency < 45  && frequency > 20 ){
			return 2;
		}
		if (frequency < 92 && frequency > 45){
			return 3;
		}
		if (frequency < 185 && frequency > 92 ){
			return 4;
		}
		if (frequency < 350 && frequency > 185 ){
			return 5;
		}
		if (frequency < 720 && frequency > 350){
			return 6;
		}
		if (frequency < 1400 && frequency > 720 ){
			return 7;
		}
	}
	if (key=="F"){

		if (frequency < 20){
			return 0;
		}
		if (frequency < 52  && frequency > 20 ){
			return 2;
		}
		if (frequency < 105 && frequency > 52){
			return 3;
		}
		if (frequency < 210 && frequency > 105 ){
			return 4;
		}
		if (frequency < 420 && frequency > 210 ){
			return 5;
		}
		if (frequency < 840 && frequency > 420){
			return 6;
		}
		if (frequency < 1600 && frequency > 840 ){
			return 7;
		}
	}
	if (key=="BC"){
		if (frequency < 20){
			return 2;
		}
		if (frequency < 45 && frequency >20 ){
			return 3;
		}
		if (frequency < 90 && frequency > 45 ){
			return 4;
		}
		if (frequency < 180 && frequency > 90 ){
			return 5;
		}
		if (frequency < 355 && frequency > 180){
			return 6;
		}
		if (frequency < 720 && frequency > 355 ){
			return 7;
		}
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

		octavetoDraw = octaveFromPitch(pitch);

	 	var note =  noteFromPitch( pitch );

		var key = document.getElementById('my-select').value;

		note = transpose(note);

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

let notePosition = {
	1:300,
	2:275,
	3:250,
	4:225,
	5:200,
	6:175,
	7:150,
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
	let note = notePosition[getNotePositionfromNoteStringArray(noteStringArray[0])];
	note = adjustForOctave(note);

	if (typeof noteStringArray[1] !== "undefined"){
		drawNote(200-75,note);
		drawSharp(200-150,note+17);
		drawNote(200+75,note-25);
		drawFlat(200+10,note-25+17);
	}	else {
		drawNote(200,note);
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

	if (noteY > 325 || noteY < 75){
		if (noteY%50 == 0){
				line(noteX-35,noteY, noteX+35,noteY);
		}	else {
				line(noteX-35,noteY-25, noteX+35,noteY-25);
		}}}

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

function getNotePositionfromNoteStringArray(note){
	let position;

	var key = document.getElementById('my-select').value;

	if (key == "BC"){
		if (note=="G"){
			return 1;
		}
		if (note=="A"){
			return 2;
		}
		if (note=="B"){
			return 3;
		}
		if (note=="C"){
			return 4;
		}
		if (note=="D"){
			return 5;
		}
		if (note=="E"){
			return 6;
		}
		if (note=="F"){
			return 7;
		}

	}

	if (note=="E"){
		return 1;
	}
	if (note=="F"){
		return 2;
	}
	if (note=="G"){
		return 3;
	}
	if (note=="A"){
		return 4;
	}
	if (note=="B"){
		return 5;
	}
	if (note=="C"){
		return 6;
	}
	if (note=="D"){
		return 7;
	}

	return position;
}

function adjustForOctave (note){
	if (octavetoDraw == 2){
		return note+525;
	}
	if (octavetoDraw == 3){
		return note+350;
	}
	if (octavetoDraw == 4){
		return note+175;
	}
	if (octavetoDraw == 5){
		return note;
	}
	if (octavetoDraw == 6){
		return note-175;
	}
}

function transpose (note) {
	var key = document.getElementById('my-select').value;
	if (key =="C" || key=="BC"){
		return note;
	}
	if (key =="Bb"){
		note = note+2;
		return note;
		}
	if (key =="Eb"){
			note = note+9;
			return note;
	}
	if (key =="F"){
			note = note+7;
			return note;
	}
}
