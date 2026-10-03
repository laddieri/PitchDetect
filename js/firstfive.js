/*
 * First 5 Notes — a step-by-step practice game for beginning band students.
 *
 * Every instrument learns the band-method first five notes, concert
 * B♭ C D E♭ F, shown at its own written pitch. Each note is a short lesson:
 *   1. Read   — name the note on the staff (multiple choice)
 *   2. Finger — see how to play it (fingering chart, or the piano keyboard
 *               for instruments without fingering data)
 *   3. Hear   — listen to the app play it
 *   4. Play   — play it into the mic and hold it until the bar fills
 * Stars (up to 3 per note, best kept per instrument in localStorage):
 *   named it on the first try, played it, and played it right in tune.
 *
 * Uses notetrainer.js globals: playTone(), startListening()/stopListening(),
 * launchFireworks(), getTransposition(), drawPianoKeyboard(), keyDisplayName(),
 * and fingerings.js: hasFingeringData(), displayFingering(), fingeringBoxHeight().
 */

// Concert MIDI note of each instrument's first note (concert B♭) in the
// octave band methods teach it; the five notes are this + PRACTICE_STEPS.
var practiceStartConcertMidi = {
	"treble clef": 70,    // B♭4
	"bass clef": 46,      // B♭2
	"flute": 70,          // B♭4
	"oboe": 70,           // B♭4
	"clarinet": 58,       // written C4
	"bass clarinet": 46,  // written C4
	"bassoon": 46,        // B♭2
	"alto sax": 58,       // written G4
	"tenor sax": 46,      // written C4
	"bari sax": 46,       // written G4
	"trumpet": 58,        // written C4
	"horn": 58,           // written F4
	"trombone": 46,       // B♭2
	"euphonium": 46,      // B♭2
	"tuba": 34,           // B♭1
	"glockenspiel": 94    // written B♭4 (sounds two octaves higher)
};
var PRACTICE_STEPS = [0, 2, 4, 5, 7];  // B♭ C D E♭ F

var PRACTICE_STORAGE_KEY = "pitchdetect-first-five";
var PRACTICE_HOLD_MS = 1200;       // how long the note must be held to pass
var PRACTICE_PASS_CENTS = 30;      // "close enough" for a beginner
var PRACTICE_TUNE_CENTS = 12;      // average offset for the in-tune star
var PRACTICE_GAP_MS = 250;         // dropouts shorter than this keep the hold
var PRACTICE_HINT_FRAMES = 4;      // frames a wrong note must last to be named

var practiceOpen = false;
var practiceStartedMic = false;
var practiceAdvanceTimer = null;
var practice = null;  // per-session state, see openPractice()

// Written MIDI notes of the five practice notes for the selected instrument
function practiceNotes() {
	var instrument = document.getElementById("instrument").value;
	var start = practiceStartConcertMidi[instrument];
	if (start === undefined) start = 70;
	var t = getTransposition();
	return PRACTICE_STEPS.map(function(step) { return start + step + t; });
}

// Note letter for a written MIDI note (these five never need sharps)
function practiceNoteName(writtenMidi) {
	return keyDisplayName(flatNoteSpellings[((writtenMidi % 12) + 12) % 12]);
}

function loadPracticeStars(instrument) {
	try {
		var all = JSON.parse(localStorage.getItem(PRACTICE_STORAGE_KEY) || "{}");
		var stars = all[instrument];
		if (Array.isArray(stars) && stars.length === 5) return stars;
	} catch (e) {}
	return [0, 0, 0, 0, 0];
}

function savePracticeStars(instrument, stars) {
	try {
		var all = JSON.parse(localStorage.getItem(PRACTICE_STORAGE_KEY) || "{}");
		all[instrument] = stars;
		localStorage.setItem(PRACTICE_STORAGE_KEY, JSON.stringify(all));
	} catch (e) {}
}

function openPractice() {
	var select = document.getElementById("instrument");
	if (!select.value) {
		showToast("Choose your instrument first.");
		return;
	}

	// Practice owns the audio while it's open
	if (sustainPlaying) stopSustain();
	if (listenActive) stopListening();
	closePopovers();

	// The header's instrument picker offers the app's instruments (minus the
	// "Select an instrument" placeholder)
	var picker = document.getElementById("practice-instrument");
	picker.innerHTML = select.innerHTML;
	var placeholder = picker.querySelector('option[value=""]');
	if (placeholder) placeholder.remove();

	practiceOpen = true;
	practiceStartedMic = false;
	var view = document.getElementById("practice-view");
	view.hidden = false;
	document.querySelector(".container").inert = true;

	loadPracticeInstrument();
	document.getElementById("practice-close").focus();
}

// (Re)start practice for the app's selected instrument, on the first note
// that still has stars to earn
function loadPracticeInstrument() {
	var select = document.getElementById("instrument");
	practice = {
		instrument: select.value,
		notes: practiceNotes(),
		stars: loadPracticeStars(select.value),
		index: 0,
		step: 0
	};
	var next = practice.stars.findIndex(function(s) { return s < 3; });
	practice.index = next >= 0 ? next : 0;
	document.getElementById("practice-instrument").value = practice.instrument;
	startPracticeNote(practice.index);
}

// Switch instruments from the practice header. The app's own select is the
// source of truth, so its change handler saves the choice and updates the
// app behind the practice view.
function changePracticeInstrument(value) {
	var select = document.getElementById("instrument");
	if (!value || value === select.value) return;
	stopNote();
	select.value = value;
	select.dispatchEvent(new Event("change"));
	loadPracticeInstrument();
}

function closePractice() {
	if (!practiceOpen) return;
	practiceOpen = false;
	clearTimeout(practiceAdvanceTimer);
	stopNote();
	if (practiceStartedMic && listenActive) stopListening();
	practiceStartedMic = false;
	document.getElementById("practice-view").hidden = true;
	document.querySelector(".container").inert = false;
	var button = document.getElementById("practiceButton");
	if (button && button.offsetParent !== null) button.focus();
}

// Begin (or restart) the lesson for note i
function startPracticeNote(i) {
	practice.index = i;
	practice.target = practice.notes[i];
	practice.firstTry = true;
	practice.answered = false;
	practice.reached = 0;
	practice.earned = null;
	renderPracticeMap();
	drawPracticeStaff(practice.target);
	goToPracticeStep(0);
}

// Show step s: 0 read, 1 finger, 2 hear, 3 play, 4 result
function goToPracticeStep(s) {
	clearTimeout(practiceAdvanceTimer);
	practice.step = s;
	if (s <= 3) practice.reached = Math.max(practice.reached, s);
	resetPracticeHold();
	if (s !== 2 && s !== 3) stopNote();

	var name = practiceNoteName(practice.target);
	var prompt = document.getElementById("practice-prompt");
	var body = document.getElementById("practice-body");
	var view = document.getElementById("practice-view");
	view.setAttribute("data-step", ["read", "finger", "hear", "play", "done"][s]);
	body.innerHTML = "";

	renderPracticeSteps();

	if (s === 0) {
		prompt.textContent = "What\u2019s the name of this note?";
		var answers = document.createElement("div");
		answers.className = "practice-answers";
		practice.notes.forEach(function(midi) {
			var b = document.createElement("button");
			b.className = "practice-answer";
			b.textContent = practiceNoteName(midi);
			b.onclick = function() { answerPracticeNote(b, midi); };
			answers.appendChild(b);
		});
		body.appendChild(answers);
	} else if (s === 1) {
		var hasFingering = hasFingeringData(practice.instrument);
		var slide = practice.instrument === "trombone";
		prompt.textContent = slide ? "This is the slide position for " + name + "."
			: hasFingering ? "This is how you play " + name + "."
			: "Find " + name + " on the keyboard.";
		var box = document.createElement("div");
		box.className = "practice-fingering";
		body.appendChild(box);
		if (hasFingering) {
			box.style.setProperty("--fingering-h", fingeringBoxHeight(practice.instrument));
			displayFingering(box, practice.instrument, practice.target, false);
		} else {
			var concertPc = (((practice.target - getTransposition()) % 12) + 12) % 12;
			drawPianoKeyboard(concertPc, name, box);
		}
		body.appendChild(practiceButton(slide ? "Got it" : hasFingering ? "I\u2019ve got it" : "Found it", "primary",
			function() { goToPracticeStep(2); }));
	} else if (s === 2) {
		prompt.textContent = "Listen to how " + name + " sounds.";
		body.appendChild(practiceButton("\u25b6 Play it again", "secondary practice-hear", playPracticeExample));
		body.appendChild(practiceButton("Now I\u2019ll play it", "primary", function() { goToPracticeStep(3); }));
		playPracticeExample();
	} else if (s === 3) {
		prompt.textContent = "Now you play " + name + "!";
		body.innerHTML =
			'<div class="practice-feedback" id="practice-feedback" aria-live="polite">Get ready\u2026</div>' +
			'<div class="practice-feedback-sub" id="practice-feedback-sub">&nbsp;</div>' +
			'<div class="practice-hold" aria-hidden="true"><div class="practice-hold-fill" id="practice-hold-fill"></div></div>';
		body.appendChild(practiceButton("\u25b6 Hear it again", "secondary", playPracticeExample));
		if (!listenActive) {
			practiceStartedMic = true;
			startListening();
		}
		setPracticeFeedback("Play " + name + " and hold it", "\u00a0");
	} else {
		renderPracticeResult();
	}
}

// A button for the step body
function practiceButton(text, kind, onclick) {
	var b = document.createElement("button");
	b.className = "practice-btn " + kind;
	b.textContent = text;
	b.onclick = onclick;
	return b;
}

function answerPracticeNote(button, midi) {
	if (practice.answered) return;
	var correct = (((midi - practice.target) % 12) + 12) % 12 === 0;
	if (!correct) {
		practice.firstTry = false;
		button.classList.remove("wrong");
		void button.offsetWidth;  // restart the shake
		button.classList.add("wrong");
		button.disabled = true;
		document.getElementById("practice-prompt").textContent = "Not that one \u2014 try again!";
		return;
	}
	practice.answered = true;
	button.classList.add("right");
	document.getElementById("practice-prompt").textContent = "Yes! That\u2019s " + practiceNoteName(practice.target) + ".";
	practiceAdvanceTimer = setTimeout(function() { goToPracticeStep(1); }, 900);
}

// Play the target with the instrument's timbre. While it sounds (and briefly
// after), the mic ignores it so the app can't pass the student's turn for them.
function playPracticeExample() {
	var freq = frequencyFromNoteNumber(practice.target - getTransposition());
	practice.ignoreUntil = performance.now() + 2500;
	playTone(freq, false, function(timbre) {
		practice.ignoreUntil = performance.now() + timbre.duration * 1000 + 300;
	});
	resetPracticeHold();
}

function resetPracticeHold() {
	if (!practice) return;
	practice.holdMs = 0;
	practice.centsTotal = 0;
	practice.lastFrame = null;
	practice.lastGood = 0;
	practice.lastSound = 0;
	practice.hintDiff = null;
	practice.hintFrames = 0;
	var fill = document.getElementById("practice-hold-fill");
	if (fill) fill.style.width = "0%";
}

function setPracticeFeedback(main, sub, state) {
	var el = document.getElementById("practice-feedback");
	var subEl = document.getElementById("practice-feedback-sub");
	if (!el) return;
	if (el.textContent !== main) el.textContent = main;
	if (subEl.textContent !== sub) subEl.textContent = sub;
	el.setAttribute("data-state", state || "");
}

// Called from the mic loop every frame while practice is open. freq is the
// confidently detected concert frequency, or null for silence/noise.
function updatePracticeListen(now, freq) {
	if (!practice || practice.step !== 3) return;
	var dt = practice.lastFrame === null ? 0 : Math.min(now - practice.lastFrame, 100);
	practice.lastFrame = now;
	var name = practiceNoteName(practice.target);

	if (now < (practice.ignoreUntil || 0)) {
		setPracticeFeedback("Listen\u2026", "\u00a0");
		return;
	}

	var inZone = false;
	if (freq) {
		practice.lastSound = now;
		var written = 69 + 12 * Math.log(freq / 440) / Math.LN2 + getTransposition();
		var diff = written - practice.target;  // semitones, fractional
		var cents = diff * 100;
		if (Math.abs(cents) <= PRACTICE_PASS_CENTS) {
			inZone = true;
			practice.holdMs += dt;
			practice.centsTotal += Math.abs(cents) * dt;
			practice.lastGood = now;
			practice.hintDiff = null;
			practice.hintFrames = 0;
			setPracticeFeedback(Math.abs(cents) <= PRACTICE_TUNE_CENTS ? "Just right! Hold it\u2026" : "That\u2019s it! Hold it\u2026",
				Math.abs(cents) <= PRACTICE_TUNE_CENTS ? "\u00a0" : (cents < 0 ? "A tiny bit low" : "A tiny bit high"), "good");
		} else {
			// Name a wrong note only once it's steady, so attacks don't flash hints
			var r = Math.round(diff);
			if (r === practice.hintDiff) {
				practice.hintFrames++;
			} else {
				practice.hintDiff = r;
				practice.hintFrames = 1;
			}
			if (practice.hintFrames >= PRACTICE_HINT_FRAMES) {
				if (r === 0) {
					setPracticeFeedback(cents < 0 ? "A little low" : "A little high",
						cents < 0 ? "Push the pitch up a bit" : "Relax the pitch down a bit", "close");
				} else if (r % 12 === 0) {
					setPracticeFeedback("Right note, wrong octave",
						r > 0 ? "That\u2019s a higher " + name + " \u2014 try the lower one" : "That\u2019s a lower " + name + " \u2014 try the higher one", "off");
				} else {
					var check = practice.instrument === "trombone" ? ". Check your slide."
						: hasFingeringData(practice.instrument) ? ". Check your fingering." : ". Try again.";
					setPracticeFeedback("Not quite!", "That sounded like " + practiceNoteName(practice.target + r) + check, "off");
				}
			}
		}
	} else if (now - practice.lastSound > 1500) {
		setPracticeFeedback("Play " + name + " and hold it", "\u00a0");
	}

	// Short gaps (a breath, a wobble) keep the progress; longer ones reset it
	if (!inZone && now - practice.lastGood > PRACTICE_GAP_MS && practice.holdMs > 0) {
		practice.holdMs = 0;
		practice.centsTotal = 0;
	}

	var fill = document.getElementById("practice-hold-fill");
	if (fill) fill.style.width = Math.min(100, practice.holdMs / PRACTICE_HOLD_MS * 100) + "%";

	if (practice.holdMs >= PRACTICE_HOLD_MS) {
		var avgCents = practice.centsTotal / practice.holdMs;
		finishPracticeNote(avgCents <= PRACTICE_TUNE_CENTS);
	}
}

function finishPracticeNote(inTune) {
	var earned = [practice.firstTry, true, inTune];
	var count = earned.filter(Boolean).length;
	var wasComplete = practice.stars.every(function(s) { return s > 0; });
	practice.earned = earned;
	practice.newBest = count > practice.stars[practice.index];
	practice.stars[practice.index] = Math.max(practice.stars[practice.index], count);
	savePracticeStars(practice.instrument, practice.stars);
	practice.allLearned = !wasComplete && practice.stars.every(function(s) { return s > 0; });
	renderPracticeMap();
	goToPracticeStep(4);
	launchFireworks(document.getElementById("practice-stage"));
}

function renderPracticeResult() {
	var name = practiceNoteName(practice.target);
	var prompt = document.getElementById("practice-prompt");
	var body = document.getElementById("practice-body");
	prompt.textContent = practice.allLearned
		? "You learned all five notes!"
		: "You played " + name + "!";

	var labels = ["Named it first try", "Played it", "Right in tune"];
	var list = document.createElement("div");
	list.className = "practice-results";
	practice.earned.forEach(function(got, i) {
		var row = document.createElement("div");
		row.className = "practice-result" + (got ? " got" : "");
		row.innerHTML = '<span class="practice-result-star" aria-hidden="true">' + (got ? "\u2605" : "\u2606") + '</span>';
		var text = document.createElement("span");
		text.textContent = labels[i];
		row.appendChild(text);
		row.setAttribute("aria-label", labels[i] + (got ? ": star earned" : ": no star this time"));
		list.appendChild(row);
	});
	body.appendChild(list);

	var actions = document.createElement("div");
	actions.className = "practice-actions";
	actions.appendChild(practiceButton("Try " + name + " again", "secondary", function() {
		startPracticeNote(practice.index);
	}));
	var nextIndex = (practice.index + 1) % 5;
	actions.appendChild(practiceButton("Next note \u2192", "primary", function() {
		startPracticeNote(nextIndex);
	}));
	body.appendChild(actions);
}

// The five notes across the top. A note's name stays hidden (a number shows
// instead) until it's been learned, so the map never answers the Read step.
function renderPracticeMap() {
	var map = document.getElementById("practice-map");
	map.innerHTML = "";
	practice.notes.forEach(function(midi, i) {
		var stars = practice.stars[i];
		var b = document.createElement("button");
		b.className = "practice-map-note" + (i === practice.index ? " current" : "") + (stars > 0 ? " learned" : "");
		var label = stars > 0 ? practiceNoteName(midi) : String(i + 1);
		b.innerHTML = '<span class="practice-map-name"></span><span class="practice-map-stars" aria-hidden="true"></span>';
		b.firstChild.textContent = label;
		b.lastChild.textContent = "\u2605\u2605\u2605".slice(0, stars) + "\u2606\u2606\u2606".slice(0, 3 - stars);
		b.setAttribute("aria-label", "Note " + (i + 1) + (stars > 0 ? ", " + label : "") + ", " + stars + " of 3 stars");
		if (i === practice.index) b.setAttribute("aria-current", "true");
		b.onclick = function() { startPracticeNote(i); };
		map.appendChild(b);
	});
}

// Read / Finger / Hear / Play chips. Steps already reached can be revisited.
function renderPracticeSteps() {
	var labels = ["Read", practice.instrument === "trombone" ? "Slide"
		: hasFingeringData(practice.instrument) ? "Finger" : "Find", "Hear", "Play"];
	var list = document.getElementById("practice-steps");
	list.innerHTML = "";
	labels.forEach(function(label, i) {
		var b = document.createElement("button");
		b.className = "practice-step" +
			(i === practice.step ? " current" : "") +
			(i < practice.step || practice.step === 4 ? " done" : "");
		b.innerHTML = '<span class="practice-step-num"></span><span class="practice-step-label"></span>';
		b.firstChild.textContent = (i < practice.step || practice.step === 4) ? "\u2713" : String(i + 1);
		b.lastChild.textContent = label;
		// The Read step is the quiz: once answered it can't be retaken for
		// free, and later steps open only after they've been reached
		b.disabled = practice.step === 4 || i > practice.reached || (i === 0 && practice.answered);
		if (i === practice.step) b.setAttribute("aria-current", "step");
		b.onclick = function() { goToPracticeStep(i); };
		list.appendChild(b);
	});
}

// Draw the note on a plain staff: no key signature, explicit flats, so a
// beginner sees exactly what to play
function drawPracticeStaff(writtenMidi) {
	var out = document.getElementById("practice-staff-output");
	out.innerHTML = "";
	var VF = Vex.Flow;
	var clef = getCurrentClef();
	var W = 170, H = STAFF_VIEWBOX_HEIGHT;
	var renderer = new VF.Renderer(out, VF.Renderer.Backends.SVG);
	renderer.resize(W, H);
	var context = renderer.getContext();
	var stave = new VF.Stave(5, Math.round((H - 4 * LINE_SPACING) / 2), W - 10);
	stave.addClef(clef);
	stave.setContext(context).draw();

	var spelled = flatNoteSpellings[((writtenMidi % 12) + 12) % 12];
	var octave = Math.floor(writtenMidi / 12) - 1;
	try {
		var note = new VF.StaveNote({ clef: clef, keys: [spelled.toLowerCase() + "/" + octave], duration: "w" });
		if (spelled.length > 1) note.addAccidental(0, new VF.Accidental("b"));
		var voice = new VF.Voice({ num_beats: 4, beat_value: 4 }).setStrict(false);
		voice.addTickables([note]);
		new VF.Formatter().joinVoices([voice]).format([voice], stave.getNoteEndX() - stave.getNoteStartX() - 20);
		voice.draw(context, stave);
	} catch (e) {
		console.log("Could not render practice note:", spelled, octave, e.message);
	}

	var svg = out.querySelector("svg");
	if (svg) {
		var center = (stave.getYForLine(0) + stave.getYForLine(4)) / 2;
		svg.setAttribute("viewBox", "0 " + (center - H / 2) + " " + W + " " + H);
		svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
		svg.style.width = "100%";
		svg.style.height = "100%";
	}
}

document.addEventListener("keydown", function(event) {
	if (practiceOpen && event.key === "Escape") closePractice();
});
