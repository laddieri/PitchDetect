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
	{ id: "fingerings", icon: "fingering", title: "Practice fingerings", sub: "Name the note from its fingering" }
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
	PRACTICE_ACTIVITIES.forEach(function(a) {
		var title = a.title, sub = a.sub;
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
	if (activity === "menu") {
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
	var fill = document.getElementById("practice-hold-fill");
	if (fill) fill.style.width = "100%";
	setPracticeFeedback("Yes! That\u2019s " + practiceNoteName(practice.target) + "!", "\u00a0", "good");
	renderPracticeSteps();
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
	var round = practice.challenge = { seq: makeChallengeSequence(), pos: 0, results: [] };
	if (kind === "fingerings" && !practice.fingeringKeys) {
		// Wait for the fingerprints (a moment: five small local files), then
		// start unless the student has left this round or instrument
		var state = practice;
		document.getElementById("practice-view").setAttribute("data-step", "drill-fingerings");
		document.getElementById("practice-prompt").textContent = "\u00a0";
		document.getElementById("practice-body").innerHTML = "";
		renderPracticeSteps();
		loadFingeringKeys(function(keys) {
			state.fingeringKeys = keys;
			if (practice === state && state.challenge === round && state.mode === "drill") showDrillQuestion();
		});
		return;
	}
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
	practice.target = practice.notes[c.seq[c.pos]];
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
	body.appendChild(answers);
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
	button.classList.add("right");
	prompt.textContent = "Yes! That\u2019s " + practiceNoteName(practice.target) + ".";
	renderPracticeSteps();
	practiceAdvanceTimer = setTimeout(function() {
		c.pos++;
		if (c.pos < CHALLENGE_LENGTH) {
			showDrillQuestion();
		} else {
			finishDrill();
		}
	}, 800);
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
	if (practiceOpen && event.key === "Escape") practiceBack();
});
