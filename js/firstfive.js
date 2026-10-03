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
 * Practice opens on a menu of four activities (showPracticeMenu()):
 *   Learn  — the lessons above
 *   Quiz   — the challenge round: CHALLENGE_LENGTH notes mixed at random,
 *            staff only, played into the mic. Help reveals a note's name,
 *            fingering and sound, but only notes played without help score.
 *   Names  — a drill: name each note shown on the staff (no mic)
 *   Fingerings — a drill: name the note a fingering chart shows (no mic)
 * Rounds score notes done unaided; the best score per instrument is kept.
 *
 * Flute, clarinet and alto sax also get a "first sounds" tutorial
 * (startFirstSounds(), configured by FIRST_SOUNDS): playing just the head
 * joint / mouthpiece and barrel / mouthpiece and neck before the first notes.
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

var CHALLENGE_STORAGE_KEY = "pitchdetect-first-five-challenge";
var CHALLENGE_LENGTH = 10;
var CHALLENGE_HOLD_MS = 800;       // shorter hold keeps the round moving
var DRILL_STORAGE_KEY = "pitchdetect-first-five-drills";

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

// Best challenge score (notes played without help) for an instrument, or null
function loadChallengeBest(instrument) {
	try {
		var best = JSON.parse(localStorage.getItem(CHALLENGE_STORAGE_KEY) || "{}")[instrument];
		if (typeof best === "number") return best;
	} catch (e) {}
	return null;
}

function saveChallengeBest(instrument, score) {
	try {
		var all = JSON.parse(localStorage.getItem(CHALLENGE_STORAGE_KEY) || "{}");
		all[instrument] = score;
		localStorage.setItem(CHALLENGE_STORAGE_KEY, JSON.stringify(all));
	} catch (e) {}
}

// Trophy stars for a challenge score
function challengeStars(score) {
	return score >= CHALLENGE_LENGTH ? 3 : score >= 8 ? 2 : score >= 5 ? 1 : 0;
}

// Best drill scores for an instrument: { names: n, fingerings: n }
function loadDrillBest(instrument) {
	try {
		var best = JSON.parse(localStorage.getItem(DRILL_STORAGE_KEY) || "{}")[instrument];
		if (best && typeof best === "object") return best;
	} catch (e) {}
	return {};
}

function saveDrillBest(instrument, best) {
	try {
		var all = JSON.parse(localStorage.getItem(DRILL_STORAGE_KEY) || "{}");
		all[instrument] = best;
		localStorage.setItem(DRILL_STORAGE_KEY, JSON.stringify(all));
	} catch (e) {}
}

// "★★☆"-style text for 0–3 stars
function starText(stars) {
	return "\u2605\u2605\u2605".slice(0, stars) + "\u2606\u2606\u2606".slice(0, 3 - stars);
}

function allNotesLearned() {
	return practice.stars.every(function(s) { return s > 0; });
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
	showPracticeMenu();
	document.getElementById("practice-close").focus();
}

// Load practice state for the app's selected instrument
function loadPracticeInstrument() {
	var select = document.getElementById("instrument");
	practice = {
		instrument: select.value,
		mode: "menu",
		notes: practiceNotes(),
		stars: loadPracticeStars(select.value),
		challengeBest: loadChallengeBest(select.value),
		drillBest: loadDrillBest(select.value),
		firstSoundsBest: loadFirstSoundsBest(select.value),
		index: 0,
		step: -1
	};
	document.getElementById("practice-instrument").value = practice.instrument;
}

// The view's data-mode drives which parts show (menu vs. activity card, and
// the note map only for lessons). Switching modes also ends any fireworks
// still playing from the last result.
function setPracticeMode(mode) {
	practice.mode = mode;
	if (fireworksAnimID) {
		cancelAnimationFrame(fireworksAnimID);
		fireworksAnimID = null;
	}
	var canvas = document.getElementById("fireworks-canvas");
	if (canvas && canvas.parentNode && canvas.parentNode.id === "practice-stage") {
		canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
	}
	document.getElementById("practice-view").setAttribute("data-mode", mode);
	var back = document.getElementById("practice-close");
	var label = mode === "menu" ? "Back to the app" : "Back to the practice menu";
	back.setAttribute("aria-label", label);
	back.title = label;
}

// The four activities, each with its best result for this instrument
var PRACTICE_ACTIVITIES = [
	{ id: "learn", icon: "\u266a", title: "Learn the first 5 notes", sub: "Read, finger, hear and play each note" },
	{ id: "quiz", icon: "trophy", title: "First 5 note quiz", sub: "Play the notes you see" },
	{ id: "names", icon: "A\u00a0B", title: "Practice note names", sub: "Name the notes on the staff" },
	{ id: "fingerings", icon: "fingering", title: "Practice fingerings", sub: "Name the note from its fingering" },
	{ id: "firstsounds", firstSounds: true }  // title, sub and icon from FIRST_SOUNDS
];

function showPracticeMenu() {
	clearTimeout(practiceAdvanceTimer);
	stopNote();
	practice.step = -1;
	setPracticeMode("menu");
	// Nothing on the menu listens; the mic restarts with the next Play step
	if (practiceStartedMic && listenActive) stopListening();
	practiceStartedMic = false;
	var slide = practice.instrument === "trombone";
	var chart = hasFingeringData(practice.instrument);

	var menu = document.getElementById("practice-menu");
	menu.innerHTML = "";
	// Instrument-specific activities (the head joint) lead the menu
	var fsCfg = FIRST_SOUNDS[practice.instrument];
	var activities = PRACTICE_ACTIVITIES.filter(function(a) { return !a.firstSounds || fsCfg; });
	activities.sort(function(a, b) { return (b.firstSounds ? 1 : 0) - (a.firstSounds ? 1 : 0); });
	menu.setAttribute("data-count", activities.length);
	activities.forEach(function(a) {
		var title = a.firstSounds ? fsCfg.title : a.title;
		var sub = a.firstSounds ? fsCfg.sub : a.sub;
		if (a.id === "fingerings" && slide) {
			title = "Practice slide positions";
			sub = "Name the note from its slide position";
		} else if (a.id === "fingerings" && !chart) {
			title = "Practice the keyboard";
			sub = "Name the note from its key";
		}

		var score;
		if (a.id === "learn") {
			var total = practice.stars.reduce(function(t, n) { return t + n; }, 0);
			score = total + " / 15 \u2605";
		} else if (a.firstSounds) {
			score = starText(practice.firstSoundsBest);
		} else {
			var best = a.id === "quiz" ? practice.challengeBest : practice.drillBest[a.id];
			score = typeof best === "number" ? starText(challengeStars(best)) : "\u2606\u2606\u2606";
		}

		var b = document.createElement("button");
		b.className = "practice-choice";
		b.setAttribute("data-activity", a.id);
		b.innerHTML = '<span class="practice-choice-icon" aria-hidden="true"></span>' +
			'<span class="practice-choice-text"><span class="practice-choice-title"></span>' +
			'<span class="practice-choice-sub"></span></span>' +
			'<span class="practice-choice-score"></span>';
		var icon = b.firstChild;
		if (a.icon === "trophy") icon.innerHTML = TROPHY_SVG;
		else if (a.icon === "fingering") icon.innerHTML = FINGERING_SVG;
		else if (a.firstSounds) icon.innerHTML = fsCfg.icon;
		else icon.textContent = a.icon;
		b.querySelector(".practice-choice-title").textContent = title;
		b.querySelector(".practice-choice-sub").textContent = sub;
		b.querySelector(".practice-choice-score").textContent = score;
		b.onclick = function() { startPracticeActivity(a.id); };
		menu.appendChild(b);
	});
}

function startPracticeActivity(id) {
	if (id === "learn") {
		// Start on the first note that still has stars to earn
		var next = practice.stars.findIndex(function(s) { return s < 3; });
		startPracticeNote(next >= 0 ? next : 0);
	} else if (id === "quiz") {
		startChallenge();
	} else if (id === "firstsounds") {
		startFirstSounds();
	} else {
		startDrill(id);
	}
}

// The back arrow (and Escape): an activity returns to the menu, the menu
// leaves practice
function practiceBack() {
	if (practice && practice.mode !== "menu") {
		showPracticeMenu();
	} else {
		closePractice();
	}
}

// The activity the student is in, for restarting it after an instrument change
function currentPracticeActivity() {
	if (practice.mode === "lesson") return "learn";
	if (practice.mode === "challenge") return "quiz";
	if (practice.mode === "drill") return practice.drillKind;
	if (practice.mode === "firstsounds") return "firstsounds";
	return "menu";
}

// Switch instruments from the practice header. The app's own select is the
// source of truth, so its change handler saves the choice and updates the
// app behind the practice view.
function changePracticeInstrument(value) {
	var select = document.getElementById("instrument");
	if (!value || value === select.value) return;
	var activity = currentPracticeActivity();
	clearTimeout(practiceAdvanceTimer);
	stopNote();
	select.value = value;
	select.dispatchEvent(new Event("change"));
	loadPracticeInstrument();
	// First sounds exist for some instruments only; others land on the menu
	if (activity === "menu" || (activity === "firstsounds" && !FIRST_SOUNDS[value])) {
		showPracticeMenu();
	} else {
		startPracticeActivity(activity);
	}
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
	setPracticeMode("lesson");
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
		body.appendChild(practiceFingeringBox());
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

// The target's fingering chart (or its piano key, for instruments without
// charts) in a box for the step body
function practiceFingeringBox(hideName) {
	var box = document.createElement("div");
	box.className = "practice-fingering";
	if (hasFingeringData(practice.instrument)) {
		box.style.setProperty("--fingering-h", fingeringBoxHeight(practice.instrument));
		displayFingering(box, practice.instrument, practice.target, false);
		if (practice.instrument === "trombone") centerChartDrawing(box);
	} else {
		var concertPc = (((practice.target - getTransposition()) % 12) + 12) % 12;
		drawPianoKeyboard(concertPc, hideName ? "" : practiceNoteName(practice.target), box);
	}
	return box;
}

// Trombone charts share one wide canvas so the bell stays put and the slide
// reaches right; in a lone chart that blank reach reads as the picture
// sitting left of center. Shift the image so its drawn part is centered (the
// box clips the blank part pushed past its edge). Skipped if the pixels
// can't be read.
function centerChartDrawing(box) {
	var img = box.querySelector("img.fingering-image");
	if (!img) return;
	function center() {
		try {
			var w = img.naturalWidth, h = img.naturalHeight;
			var canvas = document.createElement("canvas");
			canvas.width = w;
			canvas.height = h;
			var ctx = canvas.getContext("2d");
			ctx.drawImage(img, 0, 0);
			var d = ctx.getImageData(0, 0, w, h).data;
			var minX = w, maxX = -1;
			for (var y = 0; y < h; y++) {
				for (var x = 0; x < w; x++) {
					var k = (y * w + x) * 4;
					if (d[k + 3] > 20 && (d[k] < 240 || d[k + 1] < 240 || d[k + 2] < 240)) {
						if (x < minX) minX = x;
						if (x > maxX) maxX = x;
					}
				}
			}
			if (maxX < 0) return;
			var shift = (w - (minX + maxX + 1)) / 2 / w * 100;
			img.style.transform = "translateX(" + shift + "%)";
		} catch (e) {
			// Cross-origin or decode failure: leave the chart as drawn
		}
	}
	if (img.complete && img.naturalWidth) {
		center();
	} else {
		img.addEventListener("load", center, { once: true });
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
	document.getElementById("practice-prompt").textContent = praiseWord() + " That\u2019s " + practiceNoteName(practice.target) + ".";
	celebrateCorrect(button);
	practiceAdvanceTimer = setTimeout(function() { goToPracticeStep(1); }, 1300);
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
	if (practice && practice.mode === "firstsounds") {
		updateFirstSoundsListen(now, freq);
		return;
	}
	if (!practice || practice.step !== 3) return;
	var dt = practice.lastFrame === null ? 0 : Math.min(now - practice.lastFrame, 100);
	practice.lastFrame = now;
	// The challenge is reading from the staff, so feedback never names the
	// target (naming what the student actually played is fine)
	var challenge = practice.mode === "challenge";
	var name = practiceNoteName(practice.target);
	var holdNeeded = challenge ? CHALLENGE_HOLD_MS : PRACTICE_HOLD_MS;

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
					var which = challenge ? "one" : name;
					setPracticeFeedback("Right note, wrong octave",
						r > 0 ? "That\u2019s a higher " + which + " \u2014 try the lower one" : "That\u2019s a lower " + which + " \u2014 try the higher one", "off");
				} else {
					var check = practice.instrument === "trombone" ? ". Check your slide."
						: hasFingeringData(practice.instrument) ? ". Check your fingering." : ". Try again.";
					setPracticeFeedback("Not quite!", "That sounded like " + practiceNoteName(practice.target + r) + check, "off");
				}
			}
		}
	} else if (now - practice.lastSound > 1500) {
		setPracticeFeedback(challenge ? "Hold it until the bar fills" : "Play " + name + " and hold it", "\u00a0");
	}

	// Short gaps (a breath, a wobble) keep the progress; longer ones reset it
	if (!inZone && now - practice.lastGood > PRACTICE_GAP_MS && practice.holdMs > 0) {
		practice.holdMs = 0;
		practice.centsTotal = 0;
	}

	var fill = document.getElementById("practice-hold-fill");
	if (fill) fill.style.width = Math.min(100, practice.holdMs / holdNeeded * 100) + "%";

	if (practice.holdMs >= holdNeeded) {
		if (challenge) {
			passChallengeNote();
		} else {
			finishPracticeNote(practice.centsTotal / practice.holdMs <= PRACTICE_TUNE_CENTS);
		}
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
	actions.appendChild(practiceButton("Next note \u2192", practice.allLearned ? "secondary" : "primary", function() {
		startPracticeNote(nextIndex);
	}));
	if (practice.allLearned) {
		actions.appendChild(practiceButton("Take the quiz \u2192", "primary", startChallenge));
	}
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
		b.lastChild.textContent = starText(stars);
		b.setAttribute("aria-label", "Note " + (i + 1) + (stars > 0 ? ", " + label : "") + ", " + stars + " of 3 stars");
		if (i === practice.index) b.setAttribute("aria-current", "true");
		b.onclick = function() { startPracticeNote(i); };
		map.appendChild(b);
	});
}

var TROPHY_SVG = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
	'<path d="M7 3h10v2h3v3a4 4 0 0 1-4 4h-.35A5 5 0 0 1 13 14.9V17h3v2H8v-2h3v-2.1A5 5 0 0 1 8.35 12H8a4 4 0 0 1-4-4V5h3V3zm0 4H6v1a2 2 0 0 0 1 1.73V7zm10 0v2.73A2 2 0 0 0 18 8V7h-1z"/>' +
	'<rect x="6" y="20" width="12" height="2" rx="1"/></svg>';
// Three valve buttons, for the fingerings activity
var FINGERING_SVG = '<svg width="30" height="24" viewBox="0 0 30 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">' +
	'<circle cx="5" cy="12" r="4"/><circle cx="15" cy="12" r="4" fill="currentColor"/><circle cx="25" cy="12" r="4"/></svg>';

// Read / Finger / Hear / Play chips. Steps already reached can be revisited.
function renderPracticeSteps() {
	if (practice.mode === "challenge" || practice.mode === "drill") {
		renderChallengeProgress();
		return;
	}
	if (practice.mode === "firstsounds") {
		renderFirstSoundsSteps();
		return;
	}
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

// ---------------------------------------------------------------------------
// Challenge round
// ---------------------------------------------------------------------------

// Every note at least once (two shuffled passes), never the same note twice
// in a row
function makeChallengeSequence() {
	function shuffled() {
		var a = [0, 1, 2, 3, 4];
		for (var i = a.length - 1; i > 0; i--) {
			var j = Math.floor(Math.random() * (i + 1));
			var t = a[i]; a[i] = a[j]; a[j] = t;
		}
		return a;
	}
	var seq = [];
	while (seq.length < CHALLENGE_LENGTH) {
		var pass = shuffled();
		if (seq.length && pass[0] === seq[seq.length - 1]) {
			pass.push(pass.shift());
		}
		seq = seq.concat(pass);
	}
	return seq.slice(0, CHALLENGE_LENGTH);
}

function startChallenge() {
	clearTimeout(practiceAdvanceTimer);
	setPracticeMode("challenge");
	practice.index = -1;
	practice.challenge = { seq: makeChallengeSequence(), pos: 0, results: [] };
	showChallengeNote();
}

function showChallengeNote() {
	var c = practice.challenge;
	clearTimeout(practiceAdvanceTimer);
	stopNote();
	practice.target = practice.notes[c.seq[c.pos]];
	practice.step = 3;
	c.helped = false;
	resetPracticeHold();

	document.getElementById("practice-view").setAttribute("data-step", "challenge");
	drawPracticeStaff(practice.target);
	renderPracticeSteps();
	document.getElementById("practice-prompt").textContent = "Play this note!";
	var body = document.getElementById("practice-body");
	body.innerHTML =
		'<div class="practice-feedback" id="practice-feedback" aria-live="polite">Get ready\u2026</div>' +
		'<div class="practice-feedback-sub" id="practice-feedback-sub">&nbsp;</div>' +
		'<div class="practice-hold" aria-hidden="true"><div class="practice-hold-fill" id="practice-hold-fill"></div></div>';
	var help = practiceButton("Help", "secondary", function() { showChallengeHelp(help); });
	body.appendChild(help);

	if (!listenActive) {
		practiceStartedMic = true;
		startListening();
	}
	setPracticeFeedback("Hold it until the bar fills", "\u00a0");
}

// Reveal the name, fingering and sound. The note still has to be played,
// but it no longer scores.
function showChallengeHelp(button) {
	var c = practice.challenge;
	c.helped = true;
	renderPracticeSteps();
	var name = practiceNoteName(practice.target);
	document.getElementById("practice-view").setAttribute("data-step", "challenge-help");
	document.getElementById("practice-prompt").textContent = "This is " + name + ". Play it!";

	button.parentNode.insertBefore(practiceFingeringBox(), button);
	button.textContent = "\u25b6 Hear it";
	button.onclick = playPracticeExample;
	playPracticeExample();
}

function passChallengeNote() {
	var c = practice.challenge;
	practice.step = 4;  // stop scoring until the next note
	c.results.push(!c.helped);
	c.streak = c.helped ? 0 : (c.streak || 0) + 1;
	var fill = document.getElementById("practice-hold-fill");
	if (fill) fill.style.width = "100%";
	setPracticeFeedback(praiseWord() + " That\u2019s " + practiceNoteName(practice.target) + "!",
		streakText(c.streak).trim() || "\u00a0", "good");
	renderPracticeSteps();
	// The mic isn't scoring until the next note (step 4), so the chime can't
	// count as the student playing
	celebrateCorrect(null);
	practiceAdvanceTimer = setTimeout(function() {
		c.pos++;
		if (c.pos < CHALLENGE_LENGTH) {
			showChallengeNote();
		} else {
			finishChallenge();
		}
	}, 900);
}

function finishChallenge() {
	var score = practice.challenge.results.filter(Boolean).length;
	var newBest = practice.challengeBest === null || score > practice.challengeBest;
	if (newBest) {
		practice.challengeBest = score;
		saveChallengeBest(practice.instrument, score);
	}
	showRoundResult(score, newBest,
		score === CHALLENGE_LENGTH ? "Perfect! You know all five notes!" : "Quiz complete!",
		"You played " + score + " of " + CHALLENGE_LENGTH + " on your own",
		startChallenge);
}

// End of a quiz or drill round: trophy, stars, score line, what's next
function showRoundResult(score, newBest, title, scoreText, again) {
	stopNote();
	var stars = challengeStars(score);
	practice.step = -1;
	document.getElementById("practice-view").setAttribute("data-step", "challenge-done");
	document.getElementById("practice-prompt").textContent = title;
	var body = document.getElementById("practice-body");
	body.innerHTML = "";

	var trophy = document.createElement("div");
	trophy.className = "challenge-trophy";
	trophy.innerHTML = TROPHY_SVG;
	body.appendChild(trophy);

	var starRow = document.createElement("div");
	starRow.className = "challenge-stars";
	starRow.textContent = starText(stars);
	starRow.setAttribute("aria-label", stars + " of 3 stars");
	body.appendChild(starRow);

	var line = document.createElement("div");
	line.className = "challenge-score";
	line.textContent = scoreText + (newBest && score > 0 ? " \u2014 a new best!" : ".");
	body.appendChild(line);

	var actions = document.createElement("div");
	actions.className = "practice-actions";
	actions.appendChild(practiceButton("Back to the menu", "secondary", showPracticeMenu));
	actions.appendChild(practiceButton("Play again", "primary", again));
	body.appendChild(actions);

	if (stars > 0) launchFireworks(document.getElementById("practice-stage"));
}

// Ten dots in place of the step chips: green = played on your own, yellow =
// played with help, ringed = the current note
function renderChallengeProgress() {
	var c = practice.challenge;
	var list = document.getElementById("practice-steps");
	list.innerHTML = "";
	var row = document.createElement("div");
	row.className = "challenge-progress";
	row.setAttribute("role", "img");
	row.setAttribute("aria-label", "Note " + Math.min(c.pos + 1, CHALLENGE_LENGTH) + " of " + CHALLENGE_LENGTH);
	for (var i = 0; i < CHALLENGE_LENGTH; i++) {
		var dot = document.createElement("span");
		dot.className = "challenge-dot" +
			(i < c.results.length ? (c.results[i] ? " own" : " helped")
				: i === c.pos ? " current" + (c.helped ? " helping" : "") : "");
		row.appendChild(dot);
	}
	list.appendChild(row);
}

// ---------------------------------------------------------------------------
// Drills: note names and fingerings (no mic)
// ---------------------------------------------------------------------------

// A round of CHALLENGE_LENGTH questions. kind "names" shows the note on the
// staff; "fingerings" shows only its chart (or unlabeled piano key). Either
// way the student picks its name; a note scores if named on the first try.
// Shares the challenge's sequence, progress dots and result screen.
function startDrill(kind) {
	clearTimeout(practiceAdvanceTimer);
	stopNote();
	setPracticeMode("drill");
	practice.drillKind = kind;
	practice.index = -1;
	practice.challenge = { seq: makeChallengeSequence(), pos: 0, results: [] };
	showDrillQuestion();
}

// One key per practice note, equal when two notes share a fingering (trumpet
// C and G are both open; trombone B♭ and F are both 1st position). Valve and
// clarinet keys come from the fingering data; image charts are fingerprinted
// by their file contents, since notes sharing a fingering share an identical
// chart. Without charts (piano), every note is distinct. Calls back with the
// keys; anything unreadable gets a unique key, so it is never hidden.
function loadFingeringKeys(callback) {
	var instrument = practice.instrument;
	var notes = practice.notes;
	if (!hasFingeringData(instrument)) {
		callback(notes.map(String));
		return;
	}
	if (!imageFingeringMap[instrument]) {
		callback(notes.map(function(midi) {
			var f = getFingering(instrument, midi);
			return f ? JSON.stringify(f.primary) : "none:" + midi;
		}));
		return;
	}
	Promise.all(notes.map(function(midi) {
		return fetch(fingeringImagePath(instrument, midi))
			.then(function(r) { return r.ok ? r.arrayBuffer() : Promise.reject(); })
			.then(function(buf) {
				// FNV-1a over the bytes, plus the length
				var bytes = new Uint8Array(buf), h = 0x811c9dc5;
				for (var i = 0; i < bytes.length; i++) {
					h ^= bytes[i];
					h = Math.imul(h, 0x01000193);
				}
				return bytes.length + ":" + (h >>> 0).toString(16);
			})
			.catch(function() { return "unread:" + midi; });
	})).then(callback);
}

// The answer choices for the current question: all five notes, except in the
// fingerings drill, where notes sharing the target's fingering are left out
// so only one answer is right
function drillChoices() {
	if (practice.drillKind !== "fingerings" || !practice.fingeringKeys) return practice.notes;
	var keys = practice.fingeringKeys;
	var targetKey = keys[practice.notes.indexOf(practice.target)];
	return practice.notes.filter(function(midi, i) {
		return midi === practice.target || keys[i] !== targetKey;
	});
}

function showDrillQuestion() {
	var c = practice.challenge;
	clearTimeout(practiceAdvanceTimer);
	var pos = c.pos;
	practice.target = practice.notes[c.seq[pos]];
	practice.step = -1;  // no mic scoring
	c.helped = false;    // set by a wrong answer
	c.answered = false;

	var names = practice.drillKind === "names";
	document.getElementById("practice-view").setAttribute("data-step", names ? "drill-names" : "drill-fingerings");
	renderPracticeSteps();
	var prompt = document.getElementById("practice-prompt");
	var body = document.getElementById("practice-body");
	body.innerHTML = "";

	if (names) {
		drawPracticeStaff(practice.target);
		prompt.textContent = "What\u2019s the name of this note?";
	} else {
		prompt.textContent = practice.instrument === "trombone" ? "Which note uses this slide position?"
			: hasFingeringData(practice.instrument) ? "Which note has this fingering?"
			: "Which note is this key?";
		body.appendChild(practiceFingeringBox(true));
	}

	// The fingerings drill needs the fingerprints (a moment: five small local
	// files) to pick its choices; the question shows now, with all five
	// answers disabled in place until then (unless the student has left this
	// question by the time they load)
	var answers = drillAnswers();
	body.appendChild(answers);
	if (!names && !practice.fingeringKeys) {
		var state = practice;
		answers.querySelectorAll("button").forEach(function(b) { b.disabled = true; });
		loadFingeringKeys(function(keys) {
			state.fingeringKeys = keys;
			if (practice === state && state.challenge === c && c.pos === pos && state.mode === "drill" && answers.parentNode) {
				answers.parentNode.replaceChild(drillAnswers(), answers);
			}
		});
	}
}

// The answer buttons for the current drill question
function drillAnswers() {
	var answers = document.createElement("div");
	answers.className = "practice-answers";
	var choices = drillChoices();
	answers.style.gridTemplateColumns = "repeat(" + choices.length + ", minmax(0, 80px))";
	choices.forEach(function(midi) {
		var b = document.createElement("button");
		b.className = "practice-answer";
		b.textContent = practiceNoteName(midi);
		b.onclick = function() { answerDrill(b, midi); };
		answers.appendChild(b);
	});
	return answers;
}

function answerDrill(button, midi) {
	var c = practice.challenge;
	if (c.answered) return;
	var prompt = document.getElementById("practice-prompt");
	if (midi !== practice.target) {
		c.helped = true;
		button.classList.remove("wrong");
		void button.offsetWidth;  // restart the shake
		button.classList.add("wrong");
		button.disabled = true;
		prompt.textContent = "Not that one \u2014 try again!";
		renderPracticeSteps();
		return;
	}
	c.answered = true;
	c.results.push(!c.helped);
	c.streak = c.helped ? 0 : (c.streak || 0) + 1;
	button.classList.add("right");
	prompt.textContent = praiseWord() + " That\u2019s " + practiceNoteName(practice.target) + "." + streakText(c.streak);
	renderPracticeSteps();
	celebrateCorrect(button);
	practiceAdvanceTimer = setTimeout(function() {
		c.pos++;
		if (c.pos < CHALLENGE_LENGTH) {
			showDrillQuestion();
		} else {
			finishDrill();
		}
	}, 1200);
}

function finishDrill() {
	var kind = practice.drillKind;
	var score = practice.challenge.results.filter(Boolean).length;
	var prev = practice.drillBest[kind];
	var newBest = typeof prev !== "number" || score > prev;
	if (newBest) {
		practice.drillBest[kind] = score;
		saveDrillBest(practice.instrument, practice.drillBest);
	}
	showRoundResult(score, newBest,
		score === CHALLENGE_LENGTH ? "Perfect score!" : "Round complete!",
		"You got " + score + " of " + CHALLENGE_LENGTH + " right on the first try",
		function() { startDrill(kind); });
}

// ---------------------------------------------------------------------------
// First sounds: the flute head joint, the clarinet mouthpiece and barrel,
// the alto sax mouthpiece and neck
// ---------------------------------------------------------------------------

function loadFirstSoundsBest(instrument) {
	try {
		var best = JSON.parse(localStorage.getItem(FIRST_SOUNDS_STORAGE_KEY) || "{}")[instrument];
		if (typeof best === "number") return best;
	} catch (e) {}
	return 0;
}

function saveFirstSoundsBest(instrument, stars) {
	try {
		var all = JSON.parse(localStorage.getItem(FIRST_SOUNDS_STORAGE_KEY) || "{}");
		all[instrument] = stars;
		localStorage.setItem(FIRST_SOUNDS_STORAGE_KEY, JSON.stringify(all));
	} catch (e) {}
}

// The dashed air stream, ending in an arrowhead at (x, y)
function airArrowSVG(x, y) {
	return '<path d="M' + (x - 26) + ' ' + (y - 24) + ' Q' + (x - 8) + ' ' + (y - 20) + ' ' + (x - 2) + ' ' + (y - 4) +
		'" fill="none" stroke="#4d96ff" stroke-width="3" stroke-linecap="round" stroke-dasharray="5 5"/>' +
		'<path d="M' + (x - 7) + ' ' + (y - 8) + ' L' + (x - 1) + ' ' + (y - 1) + ' L' + (x + 2) + ' ' + (y - 10) +
		'" fill="none" stroke="#4d96ff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
}

// Drawings for each setup (drawing ids are used by FIRST_SOUNDS)
function firstSoundsSVG(drawing) {
	var label = {
		"flute-open": "Head joint with the end open",
		"flute-covered": "Head joint with the end covered by your palm",
		"clarinet-barrel": "Clarinet mouthpiece and barrel",
		"sax-neck": "Saxophone mouthpiece on the neck"
	}[drawing];
	var s = '<svg class="first-sounds-drawing" viewBox="0 0 250 84" role="img" aria-label="' + label + '">';

	if (drawing === "flute-open" || drawing === "flute-covered") {
		s += airArrowSVG(49, 32) +
			'<rect x="6" y="38" width="14" height="20" rx="4" fill="#aeb8c4" stroke="#6b7685" stroke-width="2"/>' +
			'<rect x="18" y="40" width="208" height="16" rx="3" fill="#dfe5ec" stroke="#6b7685" stroke-width="2"/>' +
			'<ellipse cx="50" cy="40" rx="20" ry="8" fill="#cfd7e0" stroke="#6b7685" stroke-width="2"/>' +
			'<ellipse cx="50" cy="40" rx="7" ry="3.5" fill="#2b2140"/>';
		if (drawing === "flute-covered") {
			s += '<ellipse cx="230" cy="48" rx="17" ry="25" fill="#f4c99f" stroke="#b9805a" stroke-width="2"/>' +
				'<ellipse cx="214" cy="30" rx="6" ry="10" transform="rotate(-30 214 30)" fill="#f4c99f" stroke="#b9805a" stroke-width="2"/>';
		} else {
			s += '<ellipse cx="226" cy="48" rx="4" ry="8" fill="#2b2140"/>';
		}
	} else if (drawing === "clarinet-barrel") {
		var x0 = 40;
		s += airArrowSVG(x0 + 2, 46) +
			// reed under the beak, mouthpiece body, ligature, tenon
			'<path d="M' + (x0 + 4) + ' 55 L' + (x0 + 70) + ' 55 L' + (x0 + 70) + ' 59 L' + (x0 + 8) + ' 59 Z" fill="#e8c77a" stroke="#a8843a" stroke-width="1.5"/>' +
			'<path d="M' + x0 + ' 50 Q' + (x0 + 10) + ' 38 ' + (x0 + 34) + ' 36 L' + (x0 + 90) + ' 36 L' + (x0 + 90) + ' 56 L' + (x0 + 2) + ' 55 Z" fill="#2f2f38" stroke="#15151b" stroke-width="2"/>' +
			'<rect x="' + (x0 + 48) + '" y="33" width="14" height="28" rx="3" fill="#c7cfd8" stroke="#6b7685" stroke-width="2"/>' +
			'<rect x="' + (x0 + 90) + '" y="39" width="16" height="14" fill="#3a3a44" stroke="#15151b" stroke-width="2"/>' +
			'<path d="M' + (x0 + 106) + ' 32 Q' + (x0 + 150) + ' 26 ' + (x0 + 194) + ' 32 L' + (x0 + 194) + ' 60 Q' + (x0 + 150) + ' 66 ' + (x0 + 106) + ' 60 Z" fill="#2f2f38" stroke="#15151b" stroke-width="2"/>' +
				'<rect x="' + (x0 + 106) + '" y="30" width="6" height="32" rx="2" fill="#c7cfd8" stroke="#6b7685" stroke-width="1.5"/>' +
				'<rect x="' + (x0 + 188) + '" y="30" width="6" height="32" rx="2" fill="#c7cfd8" stroke="#6b7685" stroke-width="1.5"/>';
	} else {
		var m0 = 14;
		s += airArrowSVG(m0 + 2, 46) +
			'<path d="M' + (m0 + 4) + ' 55 L' + (m0 + 64) + ' 55 L' + (m0 + 64) + ' 59 L' + (m0 + 8) + ' 59 Z" fill="#e8c77a" stroke="#a8843a" stroke-width="1.5"/>' +
			'<path d="M' + m0 + ' 50 Q' + (m0 + 12) + ' 34 ' + (m0 + 40) + ' 33 L' + (m0 + 100) + ' 38 L' + (m0 + 100) + ' 54 L' + (m0 + 2) + ' 55 Z" fill="#2f2f38" stroke="#15151b" stroke-width="2"/>' +
			'<rect x="' + (m0 + 40) + '" y="31" width="16" height="30" rx="3" fill="#c7cfd8" stroke="#6b7685" stroke-width="2"/>' +
			// the brass neck, curving down and widening toward the body joint
			'<path d="M' + (m0 + 92) + ' 40 Q' + (m0 + 170) + ' 34 ' + (m0 + 205) + ' 56 L' + (m0 + 220) + ' 80 L' + (m0 + 198) + ' 82 L' + (m0 + 188) + ' 64 Q' + (m0 + 160) + ' 50 ' + (m0 + 92) + ' 54 Z" fill="#e9c46a" stroke="#a37b1e" stroke-width="2"/>' +
				'<circle cx="' + (m0 + 150) + '" cy="40" r="4" fill="#d4a93a" stroke="#a37b1e" stroke-width="1.5"/>';
	}
	return s + '</svg>';
}

var FLUTE_ICON_SVG = '<svg width="34" height="20" viewBox="0 0 34 20" aria-hidden="true">' +
	'<rect x="1" y="7" width="32" height="7" rx="2" fill="none" stroke="currentColor" stroke-width="2"/>' +
	'<ellipse cx="9" cy="7" rx="5" ry="2.5" fill="currentColor"/></svg>';
var MOUTHPIECE_ICON_SVG = '<svg width="34" height="20" viewBox="0 0 34 20" aria-hidden="true">' +
	'<path d="M2 13 Q5 5 12 5 L31 6 L31 15 L3 15 Z" fill="currentColor"/>' +
	'<rect x="13" y="3" width="5" height="14" rx="1" fill="none" stroke="currentColor" stroke-width="2"/></svg>';

function startFirstSounds() {
	var cfg = FIRST_SOUNDS[practice.instrument];
	if (!cfg) {
		showPracticeMenu();
		return;
	}
	clearTimeout(practiceAdvanceTimer);
	stopNote();
	setPracticeMode("firstsounds");
	practice.index = -1;
	// one part per sound, plus the final step
	var done = cfg.sounds.map(function() { return false; }).concat(false);
	practice.firstSounds = { cfg: cfg, step: 0, reached: 0, done: done };
	goToFirstSoundsStep(0);
}

// Step numbers for an instrument's tutorial: 0 set up, 1..n one per sound,
// then the final step (switch / long tone), then the result
function firstSoundsFinalStep(cfg) {
	return cfg.sounds.length + 1;
}

function goToFirstSoundsStep(s) {
	var fs = practice.firstSounds, cfg = fs.cfg;
	var finalStep = firstSoundsFinalStep(cfg);
	clearTimeout(practiceAdvanceTimer);
	stopNote();
	fs.step = s;
	if (s <= finalStep) fs.reached = Math.max(fs.reached, s);
	fs.sound = null;  // which sound the mic is listening for
	resetPracticeHold();
	renderPracticeSteps();

	var view = document.getElementById("practice-view");
	view.setAttribute("data-step", s === 0 ? "fs-setup" : s < finalStep ? "fs-sound" : s === finalStep ? "fs-final" : "fs-done");
	var prompt = document.getElementById("practice-prompt");
	var body = document.getElementById("practice-body");
	body.innerHTML = "";

	if (s === 0) {
		prompt.textContent = cfg.setupTitle;
		body.insertAdjacentHTML("beforeend", firstSoundsSVG(cfg.sounds[0].drawing));
		var list = document.createElement("ol");
		list.className = "first-sounds-tips";
		cfg.tips.forEach(function(t) {
			var li = document.createElement("li");
			li.textContent = t;
			list.appendChild(li);
		});
		body.appendChild(list);
		body.appendChild(practiceButton("I\u2019m ready", "primary", function() { goToFirstSoundsStep(1); }));
	} else if (s < finalStep) {
		var sound = cfg.sounds[s - 1];
		prompt.textContent = sound.prompt;
		showFirstSoundListen(sound, true);
	} else if (s === finalStep) {
		if (cfg.final === "switch") {
			// Alternate, starting either way, so every prompt is a change
			var first = Math.random() < 0.5 ? 0 : 1;
			fs.seq = [];
			for (var i = 0; i < FIRST_SOUNDS_SWITCH_LENGTH; i++) fs.seq.push((first + i) % 2);
			fs.pos = 0;
			showFirstSoundsSwitch();
		} else {
			// A long tone on the full setup
			var last = cfg.sounds[cfg.sounds.length - 1];
			prompt.textContent = "Long tone! Hold it steady for " + FIRST_SOUNDS_LONG_TONE_MS / 1000 + " seconds.";
			showFirstSoundListen(last, false);
		}
	} else {
		renderFirstSoundsResult();
	}
}

// Listening body for one sound: the written note it makes, the drawing,
// feedback, the hold bar and (optionally) an example to hear
function showFirstSoundListen(sound, withExample) {
	var fs = practice.firstSounds;
	var body = document.getElementById("practice-body");
	resetPracticeHold();
	fs.sound = sound;
	fs.started = performance.now();
	fs.heard = false;
	practice.target = sound.midi + getTransposition();  // staff shows written pitch
	drawPracticeStaff(practice.target, sound.sharp);
	body.innerHTML = "";
	body.insertAdjacentHTML("beforeend", firstSoundsSVG(sound.drawing));
	body.insertAdjacentHTML("beforeend",
		'<div class="practice-feedback" id="practice-feedback" aria-live="polite">Get ready\u2026</div>' +
		'<div class="practice-feedback-sub" id="practice-feedback-sub">&nbsp;</div>' +
		'<div class="practice-hold" aria-hidden="true"><div class="practice-hold-fill" id="practice-hold-fill"></div></div>');
	if (withExample) {
		body.appendChild(practiceButton("\u25b6 Hear what it sounds like", "secondary", playPracticeExample));
	}
	if (!listenActive) {
		practiceStartedMic = true;
		startListening();
	}
	setPracticeFeedback(sound.idle, "\u00a0");
}

function showFirstSoundsSwitch() {
	var fs = practice.firstSounds;
	var sound = fs.cfg.sounds[fs.seq[fs.pos]];
	document.getElementById("practice-prompt").textContent = sound.switchPrompt;
	showFirstSoundListen(sound, false);
	// progress dots for the switch round, under the hold bar
	var dots = document.createElement("div");
	dots.className = "challenge-progress";
	for (var i = 0; i < FIRST_SOUNDS_SWITCH_LENGTH; i++) {
		var dot = document.createElement("span");
		dot.className = "challenge-dot" + (i < fs.pos ? " own" : i === fs.pos ? " current" : "");
		dots.appendChild(dot);
	}
	document.getElementById("practice-body").appendChild(dots);
}

// Mic frames while a first sound is being listened for. Measured in concert
// pitch against the sound's accepted band; misses get a specific hint (the
// other sound, an overblown squeak, or low / high with a fix).
function updateFirstSoundsListen(now, freq) {
	var fs = practice.firstSounds;
	if (!fs || !fs.sound) return;
	var cfg = fs.cfg, sound = fs.sound;
	var dt = practice.lastFrame === null ? 0 : Math.min(now - practice.lastFrame, 100);
	practice.lastFrame = now;
	if (now < (practice.ignoreUntil || 0)) {
		setPracticeFeedback("Listen\u2026", "\u00a0");
		return;
	}

	var onFinal = fs.step === firstSoundsFinalStep(cfg);
	var holdNeeded = !onFinal ? PRACTICE_HOLD_MS
		: cfg.final === "switch" ? FIRST_SOUNDS_SWITCH_HOLD_MS : FIRST_SOUNDS_LONG_TONE_MS;
	var inZone = false;
	if (freq) {
		fs.heard = true;
		practice.lastSound = now;
		var m = 69 + 12 * Math.log(freq / 440) / Math.LN2;  // concert, fractional MIDI
		var cents = (m - sound.midi) * 100;
		if (cents >= sound.low && cents <= sound.high) {
			inZone = true;
			practice.holdMs += dt;
			practice.lastGood = now;
			practice.hintFrames = 0;
			setPracticeFeedback(onFinal && cfg.final === "long" ? "Steady\u2026 keep it going!" : "That\u2019s it! Keep blowing\u2026", "\u00a0", "good");
		} else {
			// Hint only once a wrong sound is steady
			var r = Math.round(m);
			if (r === practice.hintDiff) {
				practice.hintFrames++;
			} else {
				practice.hintDiff = r;
				practice.hintFrames = 1;
			}
			if (practice.hintFrames >= PRACTICE_HINT_FRAMES) {
				// confusable: both sounds come from one setup (the flute head
				// joint), so name the other one if that's what was played
				var other = cfg.confusable ? (cfg.sounds[0] === sound ? cfg.sounds[1] : cfg.sounds[0]) : null;
				var otherCents = other ? (m - other.midi) * 100 : NaN;
				if (other && otherCents >= other.low && otherCents <= other.high) {
					setPracticeFeedback(sound.otherHint[0], sound.otherHint[1], "off");
				} else if (cents > sound.high && (sound.squeakMidi ? Math.abs(m - sound.squeakMidi) <= 1 : cents >= 300)) {
					setPracticeFeedback("That\u2019s a squeak", cfg.squeakHint, "close");
				} else if (cents < sound.low) {
					setPracticeFeedback("A little low", cfg.lowHint, "close");
				} else {
					setPracticeFeedback("A little high", cfg.highHint, "close");
				}
			}
		}
	} else if (now - practice.lastSound > 1500) {
		setPracticeFeedback(sound.idle, !fs.heard && now - fs.started > 6000 ? cfg.noSoundHint : "\u00a0");
	}

	if (!inZone && now - practice.lastGood > PRACTICE_GAP_MS && practice.holdMs > 0) {
		practice.holdMs = 0;
	}
	var fill = document.getElementById("practice-hold-fill");
	if (fill) fill.style.width = Math.min(100, practice.holdMs / holdNeeded * 100) + "%";

	if (practice.holdMs >= holdNeeded) passFirstSound();
}

function passFirstSound() {
	var fs = practice.firstSounds;
	var sound = fs.sound;
	fs.sound = null;  // stop listening until the next prompt
	var fill = document.getElementById("practice-hold-fill");
	if (fill) fill.style.width = "100%";

	var finalStep = firstSoundsFinalStep(fs.cfg);
	if (fs.step === finalStep && fs.cfg.final === "switch") {
		fs.pos++;
		setPracticeFeedback("Yes!", "\u00a0", "good");
		practiceAdvanceTimer = setTimeout(function() {
			if (fs.pos < FIRST_SOUNDS_SWITCH_LENGTH) {
				showFirstSoundsSwitch();
			} else {
				fs.done[finalStep - 1] = true;
				goToFirstSoundsStep(finalStep + 1);
			}
		}, 600);
		return;
	}
	if (fs.step === finalStep) {
		fs.done[finalStep - 1] = true;
		setPracticeFeedback("What a long tone!", "\u00a0", "good");
		practiceAdvanceTimer = setTimeout(function() { goToFirstSoundsStep(finalStep + 1); }, 1200);
		return;
	}
	fs.done[fs.step - 1] = true;
	setPracticeFeedback(sound.passTitle, sound.passSub, "good");
	launchFireworks(document.getElementById("practice-stage"));
	practiceAdvanceTimer = setTimeout(function() { goToFirstSoundsStep(fs.step + 1); }, 1800);
}

function renderFirstSoundsResult() {
	var fs = practice.firstSounds, cfg = fs.cfg;
	// Out of 3 whatever the number of parts, so finishing them all is 3 stars
	var stars = Math.round(fs.done.filter(Boolean).length / fs.done.length * 3);
	if (stars > practice.firstSoundsBest) {
		practice.firstSoundsBest = stars;
		saveFirstSoundsBest(practice.instrument, stars);
	}
	document.getElementById("practice-prompt").textContent = cfg.doneTitle;
	var body = document.getElementById("practice-body");

	var list = document.createElement("div");
	list.className = "practice-results";
	fs.done.forEach(function(got, i) {
		var row = document.createElement("div");
		row.className = "practice-result" + (got ? " got" : "");
		row.innerHTML = '<span class="practice-result-star" aria-hidden="true">' + (got ? "\u2605" : "\u2606") + '</span>';
		var text = document.createElement("span");
		text.textContent = cfg.results[i];
		row.appendChild(text);
		list.appendChild(row);
	});
	body.appendChild(list);

	var actions = document.createElement("div");
	actions.className = "practice-actions";
	actions.appendChild(practiceButton("Play it again", "secondary", startFirstSounds));
	actions.appendChild(practiceButton("Learn the first 5 notes \u2192", "primary", function() {
		startPracticeActivity("learn");
	}));
	body.appendChild(actions);
	launchFireworks(document.getElementById("practice-stage"));
}

// Step chips (labels from the instrument's config); reached steps can be
// revisited
function renderFirstSoundsSteps() {
	var fs = practice.firstSounds;
	var list = document.getElementById("practice-steps");
	list.innerHTML = "";
	fs.cfg.steps.forEach(function(label, i) {
		var b = document.createElement("button");
		var finished = fs.step > firstSoundsFinalStep(fs.cfg);
		var done = i < fs.step || finished;
		b.className = "practice-step" + (i === fs.step ? " current" : "") + (done ? " done" : "");
		b.innerHTML = '<span class="practice-step-num"></span><span class="practice-step-label"></span>';
		b.firstChild.textContent = done ? "\u2713" : String(i + 1);
		b.lastChild.textContent = label;
		b.disabled = finished || i > fs.reached;
		if (i === fs.step) b.setAttribute("aria-current", "step");
		b.onclick = function() { goToFirstSoundsStep(i); };
		list.appendChild(b);
	});
}

// First sounds: before the first notes, students play just part of the
// instrument. Pitches are concert MIDI notes; low/high are the accepted
// range in cents around them.
//   Flute head joint: end open ≈ A5 (usually a little flat, so down to A♭5);
//     covered by the right palm ≈ A4, an octave lower; a covered head joint
//     can also overblow to E6.
//   Clarinet: mouthpiece and barrel ≈ concert F♯5. (The mouthpiece alone
//     would be ≈ concert C6, but beginners start on the barrel.)
//   Alto sax: mouthpiece and neck ≈ concert A♭4, usually a bit above. (The
//     mouthpiece alone would be ≈ concert A5; beginners start on the neck.)
// Each sound is a step, then the final step: "switch" alternates the two
// sounds (both are possible on one setup); "long" holds the last sound for
// FIRST_SOUNDS_LONG_TONE_MS.
var FIRST_SOUNDS_STORAGE_KEY = "pitchdetect-first-five-headjoint";  // name predates clarinet/sax
var FIRST_SOUNDS_SWITCH_LENGTH = 6;
var FIRST_SOUNDS_SWITCH_HOLD_MS = 700;
var FIRST_SOUNDS_LONG_TONE_MS = 4000;
var REED_TIPS_START = "Wet the reed, then put the reed and ligature on the mouthpiece.";
var FIRST_SOUNDS = {
	"flute": {
		title: "Learn the head joint",
		sub: "Your first flute sounds: end open and covered",
		icon: FLUTE_ICON_SVG,
		setupTitle: "First sounds: just the head joint!",
		tips: [
			"Take the head joint off the flute.",
			"Hold it with your left hand and rest the lip plate on your chin.",
			"Cover about a quarter of the hole with your bottom lip.",
			"Blow a gentle stream of air across the hole, like saying \u201ctoo.\u201d"
		],
		steps: ["Set up", "Open", "Covered", "Switch"],
		final: "switch",
		confusable: true,
		sounds: [
			{ midi: 81, low: -130, high: 40, drawing: "flute-open",
				prompt: "Leave the end open and blow.", switchPrompt: "Open!",
				idle: "Blow across the hole and hold it",
				passTitle: "Great open sound!", passSub: "That\u2019s about an A",
				otherHint: ["That\u2019s the covered sound", "Take your hand away from the end"] },
			{ midi: 69, low: -70, high: 50, drawing: "flute-covered", squeakMidi: 88,
				prompt: "Now cover the end with your right palm and blow.", switchPrompt: "Covered!",
				idle: "Cover the end and blow",
				passTitle: "Great covered sound!", passSub: "An octave lower than open",
				otherHint: ["That\u2019s the open sound", "Cover the end completely with your palm"] }
		],
		squeakHint: "Blow slower and aim the air a little lower",
		lowHint: "Aim your air a bit higher, across the hole",
		highHint: "Blow slower and aim the air a bit lower",
		noSoundHint: "No sound yet? Make the opening between your lips smaller.",
		results: ["Open sound", "Covered sound", "Switched back and forth"],
		doneTitle: "You can play the head joint!"
	},
	"clarinet": {
		title: "Learn the mouthpiece & barrel",
		sub: "Your first clarinet sounds",
		icon: MOUTHPIECE_ICON_SVG,
		setupTitle: "First sounds: mouthpiece and barrel!",
		tips: [
			REED_TIPS_START,
			"Twist the mouthpiece gently into the barrel.",
			"Roll your bottom lip over your bottom teeth and rest your top teeth on the mouthpiece.",
			"Firm the corners, flatten your chin, and blow fast, steady air."
		],
		steps: ["Set up", "Barrel", "Hold"],
		final: "long",
		sounds: [
			{ midi: 78, low: -60, high: 50, drawing: "clarinet-barrel", sharp: true,
				prompt: "Play on the mouthpiece and barrel.",
				idle: "Blow and hold it steady",
				passTitle: "Great sound!", passSub: "That\u2019s about a concert F\u266f" }
		],
		squeakHint: "Take a little less mouthpiece and don\u2019t bite",
		lowHint: "Firm the corners and blow faster air",
		highHint: "Relax your jaw \u2014 don\u2019t bite or squeeze",
		noSoundHint: "No sound yet? Check the reed is wet and lined up with the tip.",
		results: ["Mouthpiece & barrel sound", "Long tone"],
		doneTitle: "You can play the mouthpiece and barrel!"
	},
	"alto sax": {
		title: "Learn the mouthpiece & neck",
		sub: "Your first saxophone sounds",
		icon: MOUTHPIECE_ICON_SVG,
		setupTitle: "First sounds: mouthpiece and neck!",
		tips: [
			REED_TIPS_START,
			"Push the mouthpiece onto the neck cork, about halfway.",
			"Cover your bottom teeth with your bottom lip and rest your top teeth on the mouthpiece.",
			"Seal the corners and blow warm, steady air."
		],
		steps: ["Set up", "Neck", "Hold"],
		final: "long",
		sounds: [
			{ midi: 68, low: -40, high: 90, drawing: "sax-neck",
				prompt: "Play on the mouthpiece and neck.",
				idle: "Blow and hold it steady",
				passTitle: "Great sound!", passSub: "That\u2019s about a concert A\u266d" }
		],
		squeakHint: "Take a little less mouthpiece and don\u2019t bite",
		lowHint: "Firm the corners and blow faster air",
		highHint: "Relax your jaw \u2014 don\u2019t bite",
		noSoundHint: "No sound yet? Check the reed is wet and lined up with the tip.",
		results: ["Mouthpiece & neck sound", "Long tone"],
		doneTitle: "You can play the mouthpiece and neck!"
	}
};

// ---------------------------------------------------------------------------
// Celebrating a correct answer (quiz, drills, the lesson's Read step):
// balloons float up across the card, a bright chime plays, and the prompt
// cheers with a varied word plus a streak count
// ---------------------------------------------------------------------------

var PRAISE_WORDS = ["Yes!", "Awesome!", "You got it!", "Nailed it!", "Great job!", "Super!", "Way to go!"];
var BALLOON_COLORS = ["#ff4d6d", "#ffd23f", "#5ad86a", "#4d96ff", "#c77dff", "#ff9f1c", "#2ec4b6"];
var lastPraise = null;

// A praise word, never the same one twice in a row
function praiseWord() {
	var word;
	do {
		word = PRAISE_WORDS[Math.floor(Math.random() * PRAISE_WORDS.length)];
	} while (word === lastPraise);
	lastPraise = word;
	return word;
}

// " 3 in a row!" once a streak reaches 3, else ""
function streakText(streak) {
	return streak >= 3 ? " " + streak + " in a row!" : "";
}

// The whole celebration for one correct answer
function celebrateCorrect(button) {
	if (button) {
		button.classList.remove("cheer");
		void button.offsetWidth;  // restart the bounce
		button.classList.add("cheer");
	}
	launchBalloons();
	playChime();
}

// Balloons rise from the bottom of the practice card, swaying, and are
// removed when done. A layer of their own clips them to the card and lets
// taps through. Skipped when the student prefers reduced motion.
function launchBalloons() {
	if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
	var stage = document.getElementById("practice-stage");
	if (!stage) return;
	var layer = document.getElementById("balloon-layer");
	if (!layer) {
		layer = document.createElement("div");
		layer.id = "balloon-layer";
		layer.className = "balloon-layer";
		layer.setAttribute("aria-hidden", "true");
	}
	if (layer.parentNode !== stage) stage.appendChild(layer);

	var count = 7;
	for (var i = 0; i < count; i++) {
		var b = document.createElement("div");
		b.className = "balloon";
		var color = BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)];
		var size = 34 + Math.random() * 20;
		// spread across the width, a little random within each slot
		b.style.left = ((i + 0.15 + Math.random() * 0.7) / count * 100) + "%";
		b.style.width = size + "px";
		b.style.setProperty("--rise", (1.6 + Math.random() * 0.9) + "s");
		// all the way up past the top of the card (balloon is ~1.8x as tall as wide)
		b.style.setProperty("--travel", (stage.clientHeight + size * 2) + "px");
		b.style.setProperty("--sway", (Math.random() < 0.5 ? -1 : 1) * (10 + Math.random() * 16) + "px");
		b.style.animationDelay = (Math.random() * 0.25) + "s";
		b.innerHTML = '<svg viewBox="0 0 40 72" aria-hidden="true">' +
			'<path d="M20 50 Q16 58 21 63 T19 72" fill="none" stroke="#8a80a3" stroke-width="1.5"/>' +
			'<ellipse cx="20" cy="23" rx="17" ry="21" fill="' + color + '"/>' +
			'<ellipse cx="13" cy="14" rx="4" ry="7" fill="#fff" opacity="0.45" transform="rotate(-20 13 14)"/>' +
			'<path d="M17 43 L23 43 L21 47 L19 47 Z" fill="' + color + '"/></svg>';
		b.addEventListener("animationend", function(e) { e.currentTarget.remove(); });
		layer.appendChild(b);
	}
}

// A quick rising three-note chime (C6 E6 G6). Kept out of activeAudioNodes so
// stopping the example tone never cuts it off.
function playChime() {
	try {
		if (!audioContext || audioContext.state === "closed") {
			audioContext = new (window.AudioContext || window.webkitAudioContext)();
		}
		if (audioContext.state !== "running") audioContext.resume();
		var t0 = audioContext.currentTime + 0.02;
		[1046.5, 1318.5, 1568].forEach(function(freq, i) {
			var t = t0 + i * 0.08;
			var osc = audioContext.createOscillator();
			var gain = audioContext.createGain();
			osc.type = "triangle";
			osc.frequency.setValueAtTime(freq, t);
			gain.gain.setValueAtTime(0.0001, t);
			gain.gain.exponentialRampToValueAtTime(0.12, t + 0.015);
			gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
			osc.connect(gain);
			gain.connect(audioContext.destination);
			osc.start(t);
			osc.stop(t + 0.4);
		});
	} catch (e) {
		// No audio available; the balloons still celebrate
	}
}

// Draw the note on a plain staff: no key signature, explicit flats, so a
// beginner sees exactly what to play
function drawPracticeStaff(writtenMidi, sharp) {
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

	var spelled = (sharp ? sharpNoteSpellings : flatNoteSpellings)[((writtenMidi % 12) + 12) % 12];
	var octave = Math.floor(writtenMidi / 12) - 1;
	try {
		var note = new VF.StaveNote({ clef: clef, keys: [spelled.toLowerCase() + "/" + octave], duration: "w" });
		if (spelled.length > 1) note.addAccidental(0, new VF.Accidental(spelled.charAt(1)));
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
	if (practiceOpen && event.key === "Escape") practiceBack();
});
